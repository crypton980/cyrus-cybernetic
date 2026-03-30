"""
CYRUS Backup & Recovery Manager

Provides scheduled and on-demand backup of critical CYRUS data:

* Training dataset (``training_data.jsonl``)
* Audit log (``audit_log.jsonl``)
* ChromaDB vector store directory
* Custom paths via ``CYRUS_BACKUP_PATHS``

Each backup is a timestamped ``.tar.gz`` archive stored in
``CYRUS_BACKUP_DIR`` (default: ``./backups``).

Backup rotation removes archives older than ``CYRUS_BACKUP_KEEP`` days
(default: 7).

Manifest files (``<timestamp>.manifest.json``) are written alongside each
archive to record the files included and SHA-256 checksums for integrity
verification on restore.

Configuration (env vars)
------------------------
CYRUS_BACKUP_DIR       → backup destination directory (default: ./backups)
CYRUS_BACKUP_KEEP      → days to retain backups (default: 7)
CYRUS_BACKUP_PATHS     → colon-separated additional paths to include
CYRUS_CHROMA_DIR       → ChromaDB persist directory (auto-detected)
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import shutil
import tarfile
import threading
import time
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# ── Configuration ──────────────────────────────────────────────────────────────

_BASE_DIR = Path(__file__).parent.parent   # cyrus-ai/
_BACKUP_DIR = Path(os.getenv("CYRUS_BACKUP_DIR", str(_BASE_DIR / "backups")))
_KEEP_DAYS: int = int(os.getenv("CYRUS_BACKUP_KEEP", "7"))
_EXTRA_PATHS: list[str] = [
    p.strip() for p in os.getenv("CYRUS_BACKUP_PATHS", "").split(":") if p.strip()
]

# Default sources (relative to _BASE_DIR; skip if not present)
_DEFAULT_SOURCES: list[Path] = [
    _BASE_DIR / "training_data.jsonl",
    _BASE_DIR / "audit_log.jsonl",
    _BASE_DIR / os.getenv("CHROMA_PERSIST_DIR", "chroma_db"),
    *[Path(p) for p in _EXTRA_PATHS],
]

_lock = threading.Lock()


# ── Data model ─────────────────────────────────────────────────────────────────

@dataclass
class BackupManifest:
    backup_id: str
    timestamp: float
    archive_path: str
    sources: list[dict[str, Any]] = field(default_factory=list)
    size_bytes: int = 0
    checksum_sha256: str = ""
    duration_sec: float = 0.0
    status: str = "ok"
    error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    def save(self, path: Path) -> None:
        path.write_text(json.dumps(self.to_dict(), default=str, indent=2), encoding="utf-8")

    @classmethod
    def load(cls, path: Path) -> "BackupManifest":
        data = json.loads(path.read_text(encoding="utf-8"))
        return cls(**data)


# ── Helpers ────────────────────────────────────────────────────────────────────

def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    try:
        with path.open("rb") as fh:
            for chunk in iter(lambda: fh.read(65536), b""):
                h.update(chunk)
    except Exception:  # noqa: BLE001
        return ""
    return h.hexdigest()


def _sha256_dir(path: Path) -> str:
    """Return a combined hash of all files in a directory (sorted paths)."""
    h = hashlib.sha256()
    try:
        for child in sorted(path.rglob("*")):
            if child.is_file():
                h.update(child.read_bytes())
    except Exception:  # noqa: BLE001
        pass
    return h.hexdigest()


def _rotate_old_backups() -> int:
    """Delete archives and manifests older than _KEEP_DAYS days. Returns count removed."""
    cutoff = time.time() - _KEEP_DAYS * 86_400
    removed = 0
    try:
        for p in _BACKUP_DIR.iterdir():
            if p.is_file() and p.stat().st_mtime < cutoff:
                p.unlink()
                removed += 1
    except Exception as exc:  # noqa: BLE001
        logger.warning("[Backup] rotation error: %s", exc)
    return removed


# ── Public API ─────────────────────────────────────────────────────────────────

def backup_now(label: str = "") -> BackupManifest:
    """
    Perform an immediate backup of all configured data sources.

    Parameters
    ----------
    label : str
        Optional human-readable label appended to the backup ID.

    Returns
    -------
    BackupManifest — metadata about the completed backup.
    """
    with _lock:
        return _run_backup(label)


def _run_backup(label: str) -> BackupManifest:
    start = time.time()
    ts = int(start)
    safe_label = label.replace(" ", "_")[:40] if label else ""
    backup_id = f"{ts}_{safe_label}" if safe_label else str(ts)

    _BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    archive_path = _BACKUP_DIR / f"{backup_id}.tar.gz"
    manifest_path = _BACKUP_DIR / f"{backup_id}.manifest.json"

    manifest = BackupManifest(
        backup_id=backup_id,
        timestamp=start,
        archive_path=str(archive_path),
    )

    try:
        source_info: list[dict[str, Any]] = []

        with tarfile.open(archive_path, "w:gz") as tar:
            for source in _DEFAULT_SOURCES:
                if not source.exists():
                    continue
                arcname = source.name
                if source.is_dir():
                    checksum = _sha256_dir(source)
                    tar.add(str(source), arcname=arcname, recursive=True)
                else:
                    checksum = _sha256_file(source)
                    tar.add(str(source), arcname=arcname)
                source_info.append({
                    "path": str(source),
                    "arcname": arcname,
                    "is_dir": source.is_dir(),
                    "checksum_sha256": checksum,
                })

        manifest.sources = source_info
        manifest.size_bytes = archive_path.stat().st_size
        manifest.checksum_sha256 = _sha256_file(archive_path)
        manifest.duration_sec = round(time.time() - start, 3)
        manifest.status = "ok"

        logger.info(
            "[Backup] completed id=%s size=%d bytes in %.2fs",
            backup_id,
            manifest.size_bytes,
            manifest.duration_sec,
        )

    except Exception as exc:  # noqa: BLE001
        manifest.status = "error"
        manifest.error = str(exc)
        logger.error("[Backup] failed: %s", exc)
        # Remove partial archive if it exists
        if archive_path.exists():
            archive_path.unlink(missing_ok=True)

    finally:
        manifest.save(manifest_path)

    # Rotate old backups
    removed = _rotate_old_backups()
    if removed:
        logger.info("[Backup] rotated %d old backup file(s)", removed)

    return manifest


def list_backups(limit: int = 20) -> list[dict[str, Any]]:
    """
    List available backups (newest first).

    Returns
    -------
    list[dict] — backup manifests.
    """
    if not _BACKUP_DIR.exists():
        return []

    manifests: list[BackupManifest] = []
    for p in _BACKUP_DIR.glob("*.manifest.json"):
        try:
            manifests.append(BackupManifest.load(p))
        except Exception:  # noqa: BLE001
            pass

    manifests.sort(key=lambda m: m.timestamp, reverse=True)
    return [m.to_dict() for m in manifests[:limit]]


def restore_backup(backup_id: str, restore_dir: str | None = None) -> dict[str, Any]:
    """
    Restore a backup archive to *restore_dir*.

    Parameters
    ----------
    backup_id  : str        — the backup ID (matches archive filename prefix)
    restore_dir : str | None — target directory (default: ``_BASE_DIR``)

    Returns
    -------
    dict with ``status``, ``extracted_to``, and ``files`` keys.

    Raises
    ------
    FileNotFoundError — if the archive cannot be found.
    """
    archive = _BACKUP_DIR / f"{backup_id}.tar.gz"
    if not archive.exists():
        raise FileNotFoundError(f"Backup archive not found: {archive}")

    dest = Path(restore_dir) if restore_dir else _BASE_DIR
    dest.mkdir(parents=True, exist_ok=True)

    extracted: list[str] = []
    with tarfile.open(archive, "r:gz") as tar:
        members = tar.getmembers()
        for member in members:
            # Security: prevent path traversal
            target = dest / member.name
            try:
                target.resolve().relative_to(dest.resolve())
            except ValueError:
                logger.warning("[Backup] skipping dangerous path in archive: %s", member.name)
                continue
            tar.extract(member, path=dest)  # noqa: S202
            extracted.append(member.name)

    logger.info("[Backup] restored backup_id=%s to %s (%d files)", backup_id, dest, len(extracted))
    return {"status": "ok", "extracted_to": str(dest), "files": extracted}


def get_backup_stats() -> dict[str, Any]:
    """Return statistics about the backup store."""
    if not _BACKUP_DIR.exists():
        return {"backup_dir": str(_BACKUP_DIR), "exists": False, "count": 0, "total_size_bytes": 0}

    archives = list(_BACKUP_DIR.glob("*.tar.gz"))
    total_size = sum(a.stat().st_size for a in archives if a.exists())
    latest_ts = max((a.stat().st_mtime for a in archives), default=None)

    return {
        "backup_dir": str(_BACKUP_DIR),
        "exists": True,
        "count": len(archives),
        "total_size_bytes": total_size,
        "keep_days": _KEEP_DAYS,
        "latest_backup_at": latest_ts,
    }
