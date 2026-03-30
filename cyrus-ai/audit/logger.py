"""
CYRUS Audit Logger — immutable, append-only decision audit trail.

Every decision made by the Commander pipeline is written to a JSONL
append-only audit log.  Entries include a SHA-256 chained hash so that
any tampering (deletion, modification, insertion) can be detected by
verifying the chain integrity.

Design principles
-----------------
* Append-only — the file is only ever opened in "a" mode.
* Thread-safe — a global lock serialises writes.
* Hash-chained — each entry records ``prev_hash`` (the SHA-256 of the
  previous line) so the chain can be verified offline.
* Bounded — the file is NOT rotated automatically (use log management
  tooling like logrotate), but ``get_audit_stats()`` reports size so
  operators can act.

Configuration (env vars)
------------------------
CYRUS_AUDIT_FILE     → path to the JSONL audit log
                       (default: ./audit_log.jsonl relative to cyrus-ai/)
CYRUS_AUDIT_MAX_LINES → emit a WARNING when the file exceeds this many
                        entries (default: 500_000)
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import threading
import time
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# ── Configuration ──────────────────────────────────────────────────────────────

AUDIT_FILE: str = os.getenv(
    "CYRUS_AUDIT_FILE",
    str(Path(__file__).parent.parent / "audit_log.jsonl"),
)
_MAX_LINES: int = int(os.getenv("CYRUS_AUDIT_MAX_LINES", "500000"))

# ── Chain state ────────────────────────────────────────────────────────────────

_write_lock: threading.Lock = threading.Lock()
_prev_hash: str = "0" * 64          # genesis hash — 64 zero hex chars
_entry_count: int = 0
_initialized: bool = False


def _init_chain() -> None:
    """
    Bootstrap ``_prev_hash`` from the last line of an existing audit file.

    Called once, under ``_write_lock``, the first time ``log_audit()`` is
    invoked.  This ensures a process restart continues the hash chain from
    where the previous run left off.
    """
    global _prev_hash, _entry_count, _initialized  # noqa: PLW0603

    path = Path(AUDIT_FILE)
    if not path.exists():
        _initialized = True
        return

    last_line: str = ""
    count = 0
    try:
        with path.open("r", encoding="utf-8") as fh:
            for raw in fh:
                raw = raw.strip()
                if raw:
                    last_line = raw
                    count += 1
    except Exception as exc:  # noqa: BLE001
        logger.warning("[Audit] failed to read existing log: %s", exc)
        _initialized = True
        return

    _entry_count = count

    if last_line:
        _prev_hash = hashlib.sha256(last_line.encode()).hexdigest()

    if count > _MAX_LINES:
        logger.warning(
            "[Audit] audit log has %d entries (threshold: %d). "
            "Consider archiving and rotating the file.",
            count,
            _MAX_LINES,
        )

    _initialized = True


# ── Public API ─────────────────────────────────────────────────────────────────


def log_audit(entry: dict[str, Any]) -> bool:
    """
    Append one audit record to the immutable JSONL log.

    Each record is hash-chained: its ``hash`` field is the SHA-256 of the
    serialised JSON line, and its ``prev_hash`` field is the hash of the
    previous record (forming a tamper-evident chain).

    Parameters
    ----------
    entry : dict
        Audit payload.  Typically includes ``input``, ``output``,
        ``evaluation``, ``node_id``, ``pipeline_ms``, etc.  A
        ``timestamp`` field is injected automatically.

    Returns
    -------
    bool
        True if the record was written, False on error.
    """
    global _prev_hash, _entry_count  # noqa: PLW0603

    try:
        record: dict[str, Any] = {
            "timestamp": time.time(),
            "prev_hash": _prev_hash,
            **entry,
        }

        line = json.dumps(record, default=str, sort_keys=True)
        current_hash = hashlib.sha256(line.encode()).hexdigest()
        # Inject the self-hash AFTER computing so the hash is stable
        record["hash"] = current_hash
        line = json.dumps(record, default=str, sort_keys=True)

        with _write_lock:
            if not _initialized:
                _init_chain()
                # Re-compute with updated prev_hash from file
                record["prev_hash"] = _prev_hash
                line = json.dumps(record, default=str, sort_keys=True)
                current_hash = hashlib.sha256(line.encode()).hexdigest()
                record["hash"] = current_hash
                line = json.dumps(record, default=str, sort_keys=True)

            with open(AUDIT_FILE, "a", encoding="utf-8") as fh:
                fh.write(line + "\n")

            _prev_hash = current_hash
            _entry_count += 1

        logger.debug("[Audit] entry #%d logged (hash=%s…)", _entry_count, current_hash[:12])
        return True

    except Exception as exc:  # noqa: BLE001
        logger.warning("[Audit] write error: %s", exc)
        return False


def load_recent_audit_logs(max_entries: int = 100) -> list[dict[str, Any]]:
    """
    Return the most recent *max_entries* audit log entries (newest last).

    Returns an empty list when the file doesn't exist or is unreadable.
    All JSON parse errors are silently skipped.
    """
    path = Path(AUDIT_FILE)
    if not path.exists():
        return []

    lines: list[str] = []
    try:
        with path.open("r", encoding="utf-8") as fh:
            for raw in fh:
                raw = raw.strip()
                if raw:
                    lines.append(raw)
    except Exception as exc:  # noqa: BLE001
        logger.warning("[Audit] read error: %s", exc)
        return []

    records: list[dict[str, Any]] = []
    for raw in lines[-max_entries:]:
        try:
            records.append(json.loads(raw))
        except json.JSONDecodeError:
            pass
    return records


def get_audit_stats() -> dict[str, Any]:
    """
    Return statistics about the audit log.

    Response keys
    -------------
    ``file``          — absolute path to the audit log
    ``exists``        — bool
    ``num_entries``   — total entry count (as reported by this process)
    ``size_bytes``    — file size in bytes
    ``current_hash``  — hash of the most recently written entry
    ``threshold``     — maximum recommended entry count
    """
    path = Path(AUDIT_FILE)
    exists = path.exists()
    size = 0
    if exists:
        try:
            size = path.stat().st_size
        except Exception:  # noqa: BLE001
            pass

    return {
        "file": str(path.resolve()),
        "exists": exists,
        "num_entries": _entry_count,
        "size_bytes": size,
        "current_hash": _prev_hash,
        "threshold": _MAX_LINES,
    }


def verify_chain(max_entries: int = 10_000) -> dict[str, Any]:
    """
    Verify the hash chain integrity of the last *max_entries* log records.

    Returns a dict with ``valid`` (bool) and ``checked`` (int) fields.
    Also returns the index of the first broken link in ``broken_at`` (-1
    if the chain is intact).
    """
    records = load_recent_audit_logs(max_entries)
    if not records:
        return {"valid": True, "checked": 0, "broken_at": -1}

    prev = records[0].get("prev_hash", "0" * 64)
    for i, record in enumerate(records):
        claimed_prev = record.get("prev_hash", "")
        if i > 0 and claimed_prev != prev:
            return {"valid": False, "checked": i + 1, "broken_at": i}
        # Recompute the record's hash (excluding the "hash" field itself)
        h = record.get("hash", "")
        check = {k: v for k, v in record.items() if k != "hash"}
        recomputed = hashlib.sha256(
            json.dumps(check, default=str, sort_keys=True).encode()
        ).hexdigest()
        if recomputed != h:
            return {"valid": False, "checked": i + 1, "broken_at": i}
        prev = h

    return {"valid": True, "checked": len(records), "broken_at": -1}
