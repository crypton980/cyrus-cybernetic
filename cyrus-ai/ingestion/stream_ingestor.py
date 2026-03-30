"""
CYRUS Stream Ingestor — real-time event ingestion layer.

Provides a thread-safe, bounded queue for live events arriving from external
sources (webhooks, IoT devices, data feeds, operator dashboards).

The autonomy loop drains this queue each cycle and forwards events to the
Commander pipeline so the intelligence system can react to live data.

Queue design
------------
* Bounded at MAX_QUEUE_SIZE (default 10,000) — oldest entries are dropped
  when full rather than blocking the producer, to avoid back-pressure.
* Thread-safe via threading.Lock around all mutations.
* Every event is typed (IngestEvent dataclass) and timestamped at ingestion
  time so the latency between arrival and processing can be measured.

Event schema
------------
Required:
    ``source``  (str) — origin identifier (e.g. "webhook", "sensor-01")
    ``type``    (str) — event category (e.g. "alert", "telemetry", "command")
    ``payload`` (dict) — arbitrary event data

Optional:
    ``priority`` (int, default 5) — 1=highest, 10=lowest (informational only)
    ``correlation_id`` (str) — trace ID for distributed request tracking
"""

from __future__ import annotations

import logging
import os
import threading
import time
from dataclasses import dataclass, field, asdict
from typing import Any

logger = logging.getLogger(__name__)

# ── Configuration ──────────────────────────────────────────────────────────────

MAX_QUEUE_SIZE: int = int(os.getenv("CYRUS_INGEST_QUEUE_SIZE", "10000"))

# ── Data structure ────────────────────────────────────────────────────────────


@dataclass
class IngestEvent:
    """A single event in the real-time ingestion queue."""

    source: str
    type: str
    payload: dict[str, Any]
    priority: int = 5
    correlation_id: str = ""
    ingested_at: float = field(default_factory=time.time)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


# ── Store ──────────────────────────────────────────────────────────────────────

_queue: list[IngestEvent] = []
_lock: threading.Lock = threading.Lock()
_total_ingested: int = 0
_total_dropped: int = 0


# ── Public API ─────────────────────────────────────────────────────────────────


def ingest_event(
    source: str,
    type: str,  # noqa: A002
    payload: dict[str, Any],
    priority: int = 5,
    correlation_id: str = "",
) -> bool:
    """
    Add an event to the ingestion queue.

    Parameters
    ----------
    source : str
        Origin system or device identifier.
    type : str
        Event category string (e.g. "alert", "telemetry").
    payload : dict
        Arbitrary event data.
    priority : int
        Priority level 1–10 (1=highest). Informational — queue is FIFO.
    correlation_id : str
        Optional distributed tracing identifier.

    Returns
    -------
    bool
        True if enqueued, False if dropped (queue full).
    """
    global _total_ingested, _total_dropped  # noqa: PLW0603

    event = IngestEvent(
        source=source,
        type=type,
        payload=payload,
        priority=priority,
        correlation_id=correlation_id,
    )

    with _lock:
        if len(_queue) >= MAX_QUEUE_SIZE:
            _total_dropped += 1
            logger.warning(
                "[Ingestor] queue full (%d) — dropping event source=%s type=%s",
                MAX_QUEUE_SIZE,
                source,
                type,
            )
            return False
        _queue.append(event)
        _total_ingested += 1

    logger.debug(
        "[Ingestor] enqueued source=%s type=%s qsize=%d",
        source,
        type,
        queue_size(),
    )
    return True


def get_event() -> IngestEvent | None:
    """
    Dequeue and return the oldest event, or None if the queue is empty.

    Returns
    -------
    IngestEvent | None
    """
    with _lock:
        if not _queue:
            return None
        return _queue.pop(0)


def drain_events(max_items: int = 50) -> list[IngestEvent]:
    """
    Drain up to *max_items* events from the queue in FIFO order.

    Used by the autonomy loop to batch-process a bounded number of events
    per cycle without starving other work.

    Parameters
    ----------
    max_items : int
        Maximum number of events to dequeue (default: 50).

    Returns
    -------
    list[IngestEvent]
        Batch of events (may be empty).
    """
    with _lock:
        batch = _queue[:max_items]
        del _queue[:max_items]
    return batch


def queue_size() -> int:
    """Return the current number of events pending in the queue."""
    with _lock:
        return len(_queue)


def ingestor_stats() -> dict[str, Any]:
    """Return aggregate ingestion statistics."""
    with _lock:
        qsize = len(_queue)
    return {
        "queue_size": qsize,
        "total_ingested": _total_ingested,
        "total_dropped": _total_dropped,
        "drop_rate": round(
            _total_dropped / max(_total_ingested, 1), 4
        ),
    }
