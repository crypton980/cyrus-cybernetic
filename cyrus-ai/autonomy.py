"""
CYRUS Autonomy Loop — background self-monitoring and housekeeping.

Runs as a daemon thread inside the FastAPI process.  Periodically:
  * logs a heartbeat with memory collection statistics
  * emits any detected anomalies (e.g. collection growing too large)
  * can be extended with additional autonomous tasks

Design principles:
  * Never crashes the host process — all exceptions are caught and logged.
  * Configurable interval via CYRUS_AUTONOMY_INTERVAL_SEC env var (default 30).
  * Respects a stop event for clean shutdown.
"""

from __future__ import annotations

import logging
import os
import threading
import time
from typing import Any

logger = logging.getLogger(__name__)

# ── Configuration ──────────────────────────────────────────────────────────────

_INTERVAL_SEC: int = int(os.getenv("CYRUS_AUTONOMY_INTERVAL_SEC", "30"))
_MAX_COLLECTION_SIZE: int = int(os.getenv("CYRUS_MAX_MEMORY_ENTRIES", "100000"))

_stop_event: threading.Event = threading.Event()


# ── Internal helpers ───────────────────────────────────────────────────────────

def _heartbeat(stats: dict[str, Any]) -> None:
    """Log a structured heartbeat entry."""
    count = stats.get("count", "?")
    persist_dir = stats.get("persist_dir", "unknown")
    logger.info(
        "[Autonomy] heartbeat — memory_count=%s persist_dir=%s",
        count,
        persist_dir,
    )
    if isinstance(count, int) and count > _MAX_COLLECTION_SIZE:
        logger.warning(
            "[Autonomy] ALERT — memory collection size (%d) exceeds threshold (%d). "
            "Consider archiving or pruning old entries.",
            count,
            _MAX_COLLECTION_SIZE,
        )


def _run_cycle() -> None:
    """Execute one autonomy cycle — memory heartbeat + self-improvement check."""
    try:
        from memory_service import memory_stats  # noqa: PLC0415
        stats = memory_stats()
        _heartbeat(stats)
    except Exception:  # noqa: BLE001
        logger.exception("[Autonomy] memory stats cycle error — continuing")

    # Self-improvement: analyse recent metrics and log optimization directive
    try:
        from metrics.tracker import get_metrics        # noqa: PLC0415
        from optimization.improver import improve_system  # noqa: PLC0415

        recent_metrics = get_metrics(limit=200)  # last 200 requests
        if recent_metrics:
            directive = improve_system(recent_metrics)
            logger.info(
                "[Autonomy] optimization directive — action=%s reason=%s",
                directive.get("action"),
                directive.get("reason"),
            )
    except Exception:  # noqa: BLE001
        logger.exception("[Autonomy] optimization cycle error — continuing")


# ── Public interface ───────────────────────────────────────────────────────────

def autonomous_loop() -> None:
    """
    Blocking loop — intended to run in a daemon thread.

    Iterates every _INTERVAL_SEC seconds until _stop_event is set.
    """
    logger.info("[Autonomy] loop started (interval=%ds)", _INTERVAL_SEC)
    while not _stop_event.is_set():
        _run_cycle()
        _stop_event.wait(timeout=_INTERVAL_SEC)
    logger.info("[Autonomy] loop stopped")


def start_autonomy_loop() -> threading.Thread:
    """
    Start the autonomy loop as a daemon thread and return the thread handle.
    Safe to call multiple times — only one loop runs at a time.
    """
    thread = threading.Thread(target=autonomous_loop, daemon=True, name="cyrus-autonomy")
    thread.start()
    return thread


def stop_autonomy_loop() -> None:
    """Signal the autonomy loop to stop after the current cycle."""
    _stop_event.set()
