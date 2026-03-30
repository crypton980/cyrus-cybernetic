"""
CYRUS Metrics Tracker — per-request performance telemetry.

Provides a lightweight, thread-safe in-memory store for pipeline metrics.
Each request logged via `log_metric()` contributes to the running aggregate
that `get_summary()` exposes and the `improve_system()` optimizer consumes.

Store design
------------
* Capped at MAX_METRICS entries (ring-buffer semantics — oldest dropped).
* `threading.Lock` guards all mutations so multiple FastAPI worker threads
  can write concurrently without data races.
* No external dependencies — no Redis, no DB — so metrics survive Python
  process lifetime only.  For persistent metrics, callers should persist
  `get_metrics()` snapshots externally.
"""

from __future__ import annotations

import logging
import statistics
import threading
from typing import Any

logger = logging.getLogger(__name__)

# ── Configuration ──────────────────────────────────────────────────────────────

MAX_METRICS: int = 10_000  # hard cap on in-memory store size

# ── Store ──────────────────────────────────────────────────────────────────────

_store: list[dict[str, Any]] = []
_lock: threading.Lock = threading.Lock()


# ── Public API ─────────────────────────────────────────────────────────────────


def log_metric(entry: dict[str, Any]) -> None:
    """
    Append a metric entry to the in-memory store.

    The entry should contain at minimum:
        ``input``       (str)  — truncated operator input
        ``latency``     (int)  — pipeline_ms value
        ``confidence``  (float) — memory or evaluation confidence

    Drops the oldest entry when the store exceeds MAX_METRICS.
    Never raises — errors are logged and silently suppressed.
    """
    try:
        with _lock:
            if len(_store) >= MAX_METRICS:
                _store.pop(0)
            _store.append(entry)
    except Exception:  # noqa: BLE001
        logger.exception("[MetricsTracker] log_metric failed")


def get_metrics(limit: int | None = None) -> list[dict[str, Any]]:
    """
    Return a snapshot of the metrics store.

    Parameters
    ----------
    limit : int | None
        When provided, return only the last *limit* entries.

    Returns
    -------
    list[dict]
        Copy of the stored entries (safe to mutate).
    """
    with _lock:
        snapshot = list(_store)
    return snapshot[-limit:] if limit is not None else snapshot


def clear_metrics() -> int:
    """
    Clear all stored metrics.

    Returns
    -------
    int
        Number of entries that were cleared.
    """
    with _lock:
        count = len(_store)
        _store.clear()
    logger.info("[MetricsTracker] cleared %d entries", count)
    return count


def get_summary() -> dict[str, Any]:
    """
    Compute an aggregate summary of all stored metrics.

    Returns
    -------
    dict with keys:
        ``count``           — total entries in store
        ``avg_latency_ms``  — mean pipeline latency in ms
        ``p95_latency_ms``  — 95th-percentile latency
        ``max_latency_ms``  — worst observed latency
        ``avg_confidence``  — mean confidence score (0.0–1.0)
        ``avg_overall_score`` — mean evaluation overall score (0.0–1.0)
        ``error_rate``      — fraction of requests with error/blocked result
    """
    with _lock:
        snapshot = list(_store)

    if not snapshot:
        return {
            "count": 0,
            "avg_latency_ms": 0,
            "p95_latency_ms": 0,
            "max_latency_ms": 0,
            "avg_confidence": 0.0,
            "avg_overall_score": 0.0,
            "error_rate": 0.0,
        }

    latencies = [m.get("latency", 0) for m in snapshot]
    confidences = [m.get("confidence", 0.0) for m in snapshot]
    overall_scores = [m.get("overall_score", 0.0) for m in snapshot]
    errors = [1 for m in snapshot if m.get("error") or m.get("blocked")]

    sorted_lat = sorted(latencies)
    p95_idx = max(0, int(len(sorted_lat) * 0.95) - 1)

    return {
        "count": len(snapshot),
        "avg_latency_ms": round(statistics.mean(latencies), 1),
        "p95_latency_ms": sorted_lat[p95_idx],
        "max_latency_ms": max(latencies),
        "avg_confidence": round(statistics.mean(confidences), 3),
        "avg_overall_score": round(statistics.mean(overall_scores), 3),
        "error_rate": round(len(errors) / len(snapshot), 3),
    }
