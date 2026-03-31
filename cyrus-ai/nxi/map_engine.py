"""
cyrus-ai/nxi/map_engine.py
============================
NXI Global Intelligence Map — the live fused world model for the CYRUS
swarm intelligence stack.

The NXIMap maintains a thread-safe, always-current snapshot of:
* **drones**  — registered drone IDs → latest telemetry + status
* **targets** — tracked entity IDs → latest predicted position + metadata
* **events**  — capped ring buffer of world events (detections, faults, etc.)

Every mutation publishes a compact delta to the ``cyrus:nxi`` Redis channel so
all distributed CYRUS nodes share a consistent world view.

Singleton access via ``get_nxi_map()``.
"""

from __future__ import annotations

import os
import threading
import time
from collections import deque
from typing import Any, Deque, Dict, List, Optional, Tuple

try:
    from observability.logger import get_logger
except ImportError:  # pragma: no cover
    import logging
    get_logger = logging.getLogger  # type: ignore[assignment]

try:
    from distributed.message_bus import publish_event
except ImportError:  # pragma: no cover
    def publish_event(event: dict) -> None:  # type: ignore[misc]
        pass

logger = get_logger(__name__)

# ── configuration ─────────────────────────────────────────────────────────────

MAX_EVENTS:     int   = int(os.getenv("CYRUS_NXI_MAX_EVENTS", "500"))
DRONE_TTL:      float = float(os.getenv("CYRUS_NXI_DRONE_TTL", "60"))    # seconds
TARGET_TTL:     float = float(os.getenv("CYRUS_NXI_TARGET_TTL", "30"))   # seconds
PUBLISH_EVERY:  int   = int(os.getenv("CYRUS_NXI_PUBLISH_EVERY", "1"))   # mutate-count

Position = Tuple[float, float]


# ── NXIMap ────────────────────────────────────────────────────────────────────

class NXIMap:
    """
    Thread-safe global intelligence map.

    The map is a single source of truth for drone and target positions,
    augmented with a bounded event log.  All state-mutating methods are
    safe to call from multiple threads simultaneously.

    Delta publishing
    ----------------
    After every ``CYRUS_NXI_PUBLISH_EVERY`` mutations a lightweight delta is
    published to the Redis ``cyrus:nxi`` pub/sub channel.  This keeps
    bandwidth low for high-frequency updates while still providing
    near-real-time cluster sync.
    """

    def __init__(self) -> None:
        self._lock     = threading.Lock()
        self._drones:  Dict[str, Dict[str, Any]] = {}
        self._targets: Dict[str, Dict[str, Any]] = {}
        self._events:  Deque[Dict[str, Any]]     = deque(maxlen=MAX_EVENTS)
        self._mutation_count = 0

    # ── drone updates ─────────────────────────────────────────────────────────

    def update_drone(
        self,
        drone_id: str,
        data: Dict[str, Any],
        *,
        publish: bool = True,
    ) -> None:
        """
        Update the telemetry record for *drone_id*.

        ``data`` is merged into the existing record (partial updates are OK).
        A ``ts`` (Unix timestamp) field is added automatically.
        """
        ts = time.time()
        with self._lock:
            existing = self._drones.get(drone_id, {})
            existing.update(data)
            existing["ts"] = ts
            existing["drone_id"] = drone_id
            self._drones[drone_id] = existing
            count = self._bump_mutation()

        if publish and count % PUBLISH_EVERY == 0:
            publish_event({
                "type":     "drone_update",
                "drone_id": drone_id,
                "data":     {k: v for k, v in data.items()
                             if isinstance(v, (int, float, str, bool, type(None)))},
                "ts":       ts,
            })

    def remove_drone(self, drone_id: str) -> bool:
        with self._lock:
            if drone_id in self._drones:
                del self._drones[drone_id]
                self._bump_mutation()
                return True
            return False

    def get_drone(self, drone_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            rec = self._drones.get(drone_id)
            return dict(rec) if rec else None

    def get_all_drones(self) -> Dict[str, Dict[str, Any]]:
        with self._lock:
            return {did: dict(rec) for did, rec in self._drones.items()}

    # ── target updates ────────────────────────────────────────────────────────

    def update_target(
        self,
        target_id: str,
        position: Position,
        *,
        metadata: Optional[Dict[str, Any]] = None,
        publish: bool = True,
    ) -> None:
        """
        Update the known position (and optional metadata) for a tracked target.
        """
        ts = time.time()
        with self._lock:
            existing = self._targets.get(target_id, {})
            existing["position"]  = position
            existing["ts"]        = ts
            existing["target_id"] = target_id
            if metadata:
                existing.update(metadata)
            self._targets[target_id] = existing
            count = self._bump_mutation()

        if publish and count % PUBLISH_EVERY == 0:
            publish_event({
                "type":      "target_update",
                "target_id": target_id,
                "position":  position,
                "ts":        ts,
            })

    def remove_target(self, target_id: str) -> bool:
        with self._lock:
            if target_id in self._targets:
                del self._targets[target_id]
                self._bump_mutation()
                return True
            return False

    def get_target(self, target_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            rec = self._targets.get(target_id)
            return dict(rec) if rec else None

    def get_all_targets(self) -> Dict[str, Dict[str, Any]]:
        with self._lock:
            return {tid: dict(rec) for tid, rec in self._targets.items()}

    # ── event log ─────────────────────────────────────────────────────────────

    def add_event(
        self,
        event: Dict[str, Any],
        *,
        publish: bool = True,
    ) -> None:
        """
        Append a world event to the ring buffer.

        The event dict is augmented with a ``ts`` field if not already present.
        """
        ts = time.time()
        event.setdefault("ts", ts)
        with self._lock:
            self._events.append(event)
            count = self._bump_mutation()

        if publish and count % PUBLISH_EVERY == 0:
            publish_event({
                "type":  "event",
                "event": {k: v for k, v in event.items()
                          if isinstance(v, (int, float, str, bool, type(None)))},
            })

    def get_events(self, last_n: int = 50) -> List[Dict[str, Any]]:
        """Return the last *last_n* events (oldest first)."""
        with self._lock:
            events = list(self._events)
        return events[-last_n:]

    # ── stale-record cleanup ──────────────────────────────────────────────────

    def evict_stale(self) -> Dict[str, int]:
        """
        Remove drone and target records that have not been updated within
        their TTL.  Returns counts of evicted records.
        """
        now = time.time()
        evicted: Dict[str, int] = {"drones": 0, "targets": 0}

        with self._lock:
            stale_drones = [
                did for did, rec in self._drones.items()
                if now - rec.get("ts", now) > DRONE_TTL
            ]
            for did in stale_drones:
                del self._drones[did]
            evicted["drones"] = len(stale_drones)

            stale_targets = [
                tid for tid, rec in self._targets.items()
                if now - rec.get("ts", now) > TARGET_TTL
            ]
            for tid in stale_targets:
                del self._targets[tid]
            evicted["targets"] = len(stale_targets)

        if stale_drones or stale_targets:
            logger.info(
                "[NXI] evicted %d stale drones, %d stale targets",
                evicted["drones"], evicted["targets"],
            )
        return evicted

    # ── full state snapshot ───────────────────────────────────────────────────

    def get_state(self, *, events_n: int = 20) -> Dict[str, Any]:
        """
        Return a complete, JSON-serialisable snapshot of the world model.
        """
        with self._lock:
            return {
                "drones":  {did: dict(rec) for did, rec in self._drones.items()},
                "targets": {tid: dict(rec) for tid, rec in self._targets.items()},
                "events":  list(self._events)[-events_n:],
                "stats": {
                    "drone_count":    len(self._drones),
                    "target_count":   len(self._targets),
                    "event_count":    len(self._events),
                    "mutation_count": self._mutation_count,
                },
            }

    def stats(self) -> Dict[str, int]:
        with self._lock:
            return {
                "drones":    len(self._drones),
                "targets":   len(self._targets),
                "events":    len(self._events),
                "mutations": self._mutation_count,
            }

    # ── internal ──────────────────────────────────────────────────────────────

    def _bump_mutation(self) -> int:
        """Increment and return the mutation counter (lock must be held)."""
        self._mutation_count += 1
        return self._mutation_count


# ── module-level singleton ────────────────────────────────────────────────────

_nxi_map:  Optional[NXIMap] = None
_nxi_lock = threading.Lock()


def get_nxi_map() -> NXIMap:
    """Return the module-level NXIMap singleton (lazily created)."""
    global _nxi_map
    with _nxi_lock:
        if _nxi_map is None:
            _nxi_map = NXIMap()
            logger.info("[NXI] world map initialised (max_events=%d)", MAX_EVENTS)
    return _nxi_map
