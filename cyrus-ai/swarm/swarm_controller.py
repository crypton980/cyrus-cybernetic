"""
cyrus-ai/swarm/swarm_controller.py
====================================
Multi-drone task-allocation engine for the CYRUS swarm intelligence stack.

Design principles
-----------------
* **Weighted scoring** — assignment cost = normalised distance + battery penalty
  + optional latency/RTT weight so overloaded drones are avoided.
* **Fault detection** — each drone has a heartbeat timestamp; drones that miss
  ``CYRUS_DRONE_HEARTBEAT_TTL`` seconds are marked *faulted* and their
  in-flight tasks are requeued automatically.
* **Redis event bus** — every assignment and fault is published to the
  ``cyrus:swarm`` channel so the distributed cluster stays in sync.
* **Thread safety** — a single ``threading.Lock`` protects the drone registry
  and task queue; no GIL-reliant dict mutations happen outside the lock.
* **Graceful degradation** — if Redis is offline the controller continues
  operating locally without raising exceptions.
"""

from __future__ import annotations

import math
import os
import threading
import time
from typing import Any, Dict, List, Optional, Tuple

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

try:
    from metrics.tracker import get_tracker
    _metrics = get_tracker()
except Exception:  # noqa: BLE001  # pragma: no cover
    _metrics = None

logger = get_logger(__name__)

# ── constants ─────────────────────────────────────────────────────────────────

HEARTBEAT_TTL: float = float(os.getenv("CYRUS_DRONE_HEARTBEAT_TTL", "30"))
BATTERY_LOW:   float = float(os.getenv("CYRUS_DRONE_BATTERY_LOW", "20"))
BATTERY_CRIT:  float = float(os.getenv("CYRUS_DRONE_BATTERY_CRIT", "10"))
MAX_TASKS_PER_DRONE: int = int(os.getenv("CYRUS_SWARM_MAX_TASKS", "3"))

# ── types ─────────────────────────────────────────────────────────────────────

Position = Tuple[float, float]       # (lat, lon)  or  (x, y) in sim
Task     = Dict[str, Any]
DroneRec = Dict[str, Any]


# ── SwarmController ──────────────────────────────────────────────────────────

class SwarmController:
    """
    Central coordinator for a heterogeneous drone swarm.

    Each drone is identified by a *drone_id* string.  The controller tracks
    live state (position, battery, status, heartbeat) and assigns incoming
    tasks to the best available drone using a configurable scoring function.

    Task lifecycle:  ``pending``  →  ``assigned``  →  ``completed``
                                                   ↘  ``failed`` (requeued)
    """

    def __init__(self) -> None:
        self._lock:  threading.Lock = threading.Lock()
        self.drones: Dict[str, DroneRec] = {}
        self.task_queue: List[Task] = []
        self._fault_monitor_thread: Optional[threading.Thread] = None
        self._running = False

    # ── lifecycle ─────────────────────────────────────────────────────────────

    def start(self) -> None:
        """Start the background fault-monitor thread."""
        if self._running:
            return
        self._running = True
        t = threading.Thread(target=self._fault_monitor_loop, daemon=True)
        t.start()
        self._fault_monitor_thread = t
        logger.info("[Swarm] controller started — heartbeat TTL %.0fs", HEARTBEAT_TTL)

    def stop(self) -> None:
        self._running = False
        logger.info("[Swarm] controller stopped")

    # ── drone registry ────────────────────────────────────────────────────────

    def register_drone(
        self,
        drone_id: str,
        controller: Any,
        *,
        initial_position: Optional[Position] = None,
        initial_battery: float = 100.0,
    ) -> None:
        """Register a new drone with the swarm."""
        with self._lock:
            self.drones[drone_id] = {
                "controller":   controller,
                "status":       "idle",
                "position":     initial_position,
                "battery":      initial_battery,
                "heartbeat":    time.monotonic(),
                "task_count":   0,
                "current_task": None,
                "faults":       0,
            }
        logger.info("[Swarm] registered drone %s (battery=%.0f%%)", drone_id, initial_battery)
        publish_event({
            "event": "drone_registered",
            "drone_id": drone_id,
            "battery": initial_battery,
        })

    def unregister_drone(self, drone_id: str) -> bool:
        """Remove a drone from the registry.  Requeues its active task."""
        with self._lock:
            if drone_id not in self.drones:
                return False
            rec = self.drones.pop(drone_id)
            if rec.get("current_task"):
                self.task_queue.insert(0, rec["current_task"])
                logger.warning("[Swarm] drone %s removed — task requeued", drone_id)
        return True

    def update_state(
        self,
        drone_id: str,
        position: Position,
        battery: float,
        status: Optional[str] = None,
    ) -> None:
        """Update telemetry for a registered drone (called by drone heartbeat)."""
        with self._lock:
            if drone_id not in self.drones:
                return
            rec = self.drones[drone_id]
            rec["position"]  = position
            rec["battery"]   = battery
            rec["heartbeat"] = time.monotonic()
            if status:
                rec["status"] = status
            # Battery safety
            if battery <= BATTERY_CRIT:
                if rec["status"] not in ("returning", "landing", "faulted"):
                    rec["status"] = "returning"
                    logger.warning(
                        "[Swarm] drone %s battery CRITICAL (%.0f%%) — RTL", drone_id, battery
                    )
                    if rec["current_task"]:
                        self.task_queue.insert(0, rec["current_task"])
                        rec["current_task"] = None
            elif battery <= BATTERY_LOW and rec["status"] == "idle":
                logger.info("[Swarm] drone %s battery low (%.0f%%)", drone_id, battery)

    def complete_task(self, drone_id: str, *, success: bool = True) -> None:
        """Mark the drone's current task as completed or failed."""
        with self._lock:
            if drone_id not in self.drones:
                return
            rec = self.drones[drone_id]
            task = rec.pop("current_task", None)
            rec["task_count"] = max(0, rec.get("task_count", 1) - 1)
            if rec["task_count"] == 0:
                rec["status"] = "idle"
            if not success and task:
                task.setdefault("_retries", 0)
                task["_retries"] += 1
                if task["_retries"] < 3:
                    self.task_queue.insert(0, task)
                    logger.warning("[Swarm] drone %s task failed — requeued (attempt %d)",
                                   drone_id, task["_retries"])
        if _metrics:
            _metrics.record(
                metric_type="swarm_task",
                value=1.0 if success else 0.0,
                context={"drone_id": drone_id, "success": success},
            )

    # ── task assignment ───────────────────────────────────────────────────────

    def assign_task(self, task: Task) -> Optional[str]:
        """
        Assign *task* to the best available drone.

        Scoring (lower = better):
            score = euclidean_distance(drone_pos, task_target)
                  + (100 - battery) * 0.1   # battery penalty
                  + task_count * 0.5         # busy penalty

        Returns the assigned ``drone_id`` or ``None`` if no drone is available.
        """
        target: Optional[Position] = task.get("target")
        if target is None:
            logger.warning("[Swarm] task missing 'target' field — skipped")
            return None

        with self._lock:
            best: Optional[str] = None
            best_score: float = float("inf")

            for drone_id, rec in self.drones.items():
                # Skip unavailable drones
                if rec["status"] in ("faulted", "returning", "landing"):
                    continue
                if rec.get("battery", 0) <= BATTERY_LOW:
                    continue
                if rec.get("task_count", 0) >= MAX_TASKS_PER_DRONE:
                    continue
                if rec["position"] is None:
                    continue

                dist    = self._euclidean(rec["position"], target)
                battery = rec.get("battery", 100.0)
                busy    = rec.get("task_count", 0)
                score   = dist + (100.0 - battery) * 0.1 + busy * 0.5

                if score < best_score:
                    best_score = score
                    best = drone_id

            if best is None:
                # No drone available — queue the task
                self.task_queue.append(task)
                logger.warning("[Swarm] no drone available — task queued (queue size=%d)",
                               len(self.task_queue))
                return None

            rec = self.drones[best]
            rec["status"]       = "assigned"
            rec["task_count"]   = rec.get("task_count", 0) + 1
            rec["current_task"] = task

        # Call drone controller outside the lock to avoid blocking
        try:
            if hasattr(rec["controller"], "goto"):
                rec["controller"].goto(*target)
        except Exception as exc:  # noqa: BLE001
            logger.error("[Swarm] failed to send goto to drone %s: %s", best, exc)

        logger.info("[Swarm] task '%s' assigned to drone %s (score=%.2f)",
                    task.get("type", "?"), best, best_score)
        publish_event({
            "event":     "task_assigned",
            "drone_id":  best,
            "task_type": task.get("type"),
            "target":    target,
            "score":     round(best_score, 3),
        })
        return best

    def dispatch_pending(self) -> int:
        """Try to assign all queued tasks.  Returns number of tasks dispatched."""
        dispatched = 0
        with self._lock:
            remaining: List[Task] = []
            for task in list(self.task_queue):
                if self._has_available_drone_unsafe(task.get("target")):
                    remaining = self.task_queue[self.task_queue.index(task) + 1:]
                    self.task_queue = remaining
                    break  # Will release lock and re-assign
            else:
                return 0
        # Re-assign outside lock
        if task:
            result = self.assign_task(task)
            if result:
                dispatched += 1
        return dispatched

    # ── state queries ─────────────────────────────────────────────────────────

    def get_state(self) -> dict:
        """Return a JSON-serialisable snapshot of the swarm state."""
        with self._lock:
            return {
                "drones": {
                    did: {
                        k: v for k, v in rec.items()
                        if k not in ("controller",)
                    }
                    for did, rec in self.drones.items()
                },
                "queued_tasks": len(self.task_queue),
            }

    def drone_ids(self) -> List[str]:
        with self._lock:
            return list(self.drones.keys())

    # ── fault monitor ─────────────────────────────────────────────────────────

    def _fault_monitor_loop(self) -> None:
        """Background thread: detect heartbeat timeouts and requeue tasks."""
        while self._running:
            time.sleep(max(HEARTBEAT_TTL / 3, 5))
            now = time.monotonic()
            faulted_drones: List[str] = []

            with self._lock:
                for drone_id, rec in self.drones.items():
                    if rec["status"] == "faulted":
                        continue
                    age = now - rec.get("heartbeat", now)
                    if age > HEARTBEAT_TTL:
                        rec["status"] = "faulted"
                        rec["faults"] = rec.get("faults", 0) + 1
                        faulted_drones.append(drone_id)
                        # Requeue active task
                        task = rec.pop("current_task", None)
                        if task:
                            task.setdefault("_retries", 0)
                            task["_retries"] += 1
                            self.task_queue.insert(0, task)

            for did in faulted_drones:
                logger.error("[Swarm] drone %s FAULTED (heartbeat timeout)", did)
                publish_event({
                    "event":    "drone_faulted",
                    "drone_id": did,
                    "reason":   "heartbeat_timeout",
                })

    # ── helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _euclidean(p1: Position, p2: Position) -> float:
        return math.sqrt((p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2)

    def _has_available_drone_unsafe(self, target: Optional[Position]) -> bool:
        """Check (without acquiring lock) if any drone can take a task."""
        for rec in self.drones.values():
            if (
                rec["status"] not in ("faulted", "returning", "landing")
                and rec.get("battery", 0) > BATTERY_LOW
                and rec.get("task_count", 0) < MAX_TASKS_PER_DRONE
                and rec["position"] is not None
            ):
                return True
        return False


# ── module-level singleton ────────────────────────────────────────────────────

_swarm_controller: Optional[SwarmController] = None
_swarm_lock = threading.Lock()


def get_swarm_controller() -> SwarmController:
    """Return the module-level SwarmController singleton (created on first call)."""
    global _swarm_controller
    with _swarm_lock:
        if _swarm_controller is None:
            _swarm_controller = SwarmController()
            _swarm_controller.start()
    return _swarm_controller
