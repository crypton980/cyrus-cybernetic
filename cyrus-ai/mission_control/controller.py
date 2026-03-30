"""
CYRUS Mission Control Layer — lifecycle management for intelligence missions.

A "mission" is a named, tracked operational objective that the CYRUS system
is directed to pursue.  The mission control layer provides:

* ``start_mission()``    — register a new mission with an objective
* ``stop_mission()``     — pause/cancel a running mission
* ``complete_mission()`` — mark a mission as successfully completed
* ``get_mission()``      — retrieve mission state by ID
* ``list_missions()``    — list all missions with optional status filter

All state is in-process (volatile).  For production deployments with
multiple nodes, mirror the state to Redis via the distributed message bus.

The mission controller integrates with the Commander pipeline: each
``execute()`` call can optionally reference a ``mission_id`` to link
pipeline results to an active mission.

Configuration (env vars)
------------------------
CYRUS_MAX_MISSIONS  → maximum missions retained in the store (default: 1000)
"""

from __future__ import annotations

import logging
import threading
import time
import uuid
from collections import OrderedDict
from dataclasses import dataclass, field, asdict
from typing import Any

logger = logging.getLogger(__name__)

# ── Configuration ──────────────────────────────────────────────────────────────

_MAX_MISSIONS: int = int(__import__("os").getenv("CYRUS_MAX_MISSIONS", "1000"))

# ── Data model ─────────────────────────────────────────────────────────────────

_VALID_STATUSES = {"running", "stopped", "completed", "failed"}


@dataclass
class MissionRecord:
    """Represents a single CYRUS mission lifecycle."""

    mission_id: str
    objective: str
    status: str = "running"
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    completed_at: float | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
    result_summary: str | None = None

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["age_sec"] = round(time.time() - self.created_at, 1)
        return d


# ── State ──────────────────────────────────────────────────────────────────────

# OrderedDict preserves insertion order for paginated listing
_missions: OrderedDict[str, MissionRecord] = OrderedDict()
_lock: threading.Lock = threading.Lock()


# ── Helpers ────────────────────────────────────────────────────────────────────

def _evict_oldest_if_full() -> None:
    """Evict the oldest mission when the store is at capacity."""
    while len(_missions) >= _MAX_MISSIONS:
        oldest_key = next(iter(_missions))
        del _missions[oldest_key]
        logger.debug("[MissionControl] evicted oldest mission to stay within capacity")


# ── Public API ─────────────────────────────────────────────────────────────────


def start_mission(
    objective: str,
    mission_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> MissionRecord:
    """
    Register and start a new mission.

    Parameters
    ----------
    objective : str
        Human-readable mission objective.
    mission_id : str | None
        Optional caller-supplied ID.  A UUID is generated when omitted.
    metadata : dict | None
        Extra key/value pairs to store alongside the mission.

    Returns
    -------
    MissionRecord — the newly created (running) mission.

    Raises
    ------
    ValueError
        If a mission with the given ``mission_id`` already exists.
    """
    mission_id = mission_id or str(uuid.uuid4())

    with _lock:
        if mission_id in _missions:
            raise ValueError(f"Mission '{mission_id}' already exists")
        _evict_oldest_if_full()
        record = MissionRecord(
            mission_id=mission_id,
            objective=objective[:500],
            metadata=metadata or {},
        )
        _missions[mission_id] = record

    logger.info("[MissionControl] mission_id=%s started objective=%r", mission_id, objective[:80])
    return record


def stop_mission(mission_id: str, reason: str = "operator stop") -> MissionRecord | None:
    """
    Transition a running mission to ``stopped``.

    Returns the updated record, or ``None`` if the mission is not found.
    """
    with _lock:
        record = _missions.get(mission_id)
        if record is None:
            return None
        record.status = "stopped"
        record.updated_at = time.time()
        record.metadata["stop_reason"] = reason

    logger.info("[MissionControl] mission_id=%s stopped (%s)", mission_id, reason)
    return record


def complete_mission(
    mission_id: str,
    result_summary: str | None = None,
) -> MissionRecord | None:
    """
    Mark a mission as ``completed``.

    Returns the updated record, or ``None`` if the mission is not found.
    """
    with _lock:
        record = _missions.get(mission_id)
        if record is None:
            return None
        record.status = "completed"
        record.updated_at = time.time()
        record.completed_at = time.time()
        record.result_summary = result_summary

    logger.info("[MissionControl] mission_id=%s completed", mission_id)
    return record


def fail_mission(mission_id: str, error: str) -> MissionRecord | None:
    """Mark a mission as ``failed`` with an error message."""
    with _lock:
        record = _missions.get(mission_id)
        if record is None:
            return None
        record.status = "failed"
        record.updated_at = time.time()
        record.metadata["error"] = error

    logger.warning("[MissionControl] mission_id=%s failed: %s", mission_id, error)
    return record


def get_mission(mission_id: str) -> MissionRecord | None:
    """Return the mission record for *mission_id*, or ``None``."""
    with _lock:
        return _missions.get(mission_id)


def list_missions(
    status: str | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    """
    List missions, optionally filtered by status.

    Parameters
    ----------
    status : str | None
        Filter to ``"running"`` | ``"stopped"`` | ``"completed"`` | ``"failed"``.
        Returns all missions when ``None``.
    limit : int
        Maximum results to return (newest first).

    Returns
    -------
    list[dict] — missions sorted newest-first.
    """
    with _lock:
        all_missions = list(_missions.values())

    if status is not None:
        all_missions = [m for m in all_missions if m.status == status]

    # Newest first
    all_missions.sort(key=lambda m: m.created_at, reverse=True)
    return [m.to_dict() for m in all_missions[:limit]]
