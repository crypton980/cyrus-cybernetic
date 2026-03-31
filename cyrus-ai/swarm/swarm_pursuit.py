"""
cyrus-ai/swarm/swarm_pursuit.py
=================================
SwarmPursuitCoordinator — integrates the SwarmController, PursuitEngine,
and NXIMap into a single detection-to-intercept pipeline.

On each ``handle_detection()`` call the coordinator:
1. Feeds the new position to the PursuitEngine.
2. Predicts the target's next position.
3. Updates the NXI world model with the predicted position.
4. Logs a detection event to the NXI event log.
5. Assigns the best available drone to an intercept task via the SwarmController.
6. Publishes the outcome to the Redis ``cyrus:swarm`` channel.

For formation interception the caller can optionally request a *formation*
mode, which places multiple drones around the predicted position using the
formation utilities.
"""

from __future__ import annotations

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

try:
    from safety.override import is_locked_down
except ImportError:  # pragma: no cover
    def is_locked_down() -> bool:  # type: ignore[misc]
        return False

try:
    from audit.logger import log_audit
except ImportError:  # pragma: no cover
    def log_audit(entry: dict) -> None:  # type: ignore[misc]
        pass

logger = get_logger(__name__)

Position = Tuple[float, float]

# ── configuration ─────────────────────────────────────────────────────────────

DRONE_SPEED:        float = float(os.getenv("CYRUS_PURSUIT_DRONE_SPEED", "15.0"))
INTERCEPT_ALTITUDE: float = float(os.getenv("CYRUS_PURSUIT_ALTITUDE", "20.0"))
FORMATION_RADIUS:   float = float(os.getenv("CYRUS_PURSUIT_FORMATION_RADIUS", "50.0"))


# ── SwarmPursuitCoordinator ───────────────────────────────────────────────────

class SwarmPursuitCoordinator:
    """
    Orchestration layer connecting perception → prediction → world model → action.

    Parameters
    ----------
    swarm:     SwarmController instance (manages drone fleet).
    pursuit:   PursuitEngine instance (velocity prediction).
    nxi_map:   NXIMap instance (global world model).
    """

    def __init__(self, swarm: Any, pursuit: Any, nxi_map: Any) -> None:
        self.swarm   = swarm
        self.pursuit = pursuit
        self.map     = nxi_map
        self._lock   = threading.Lock()

        # Track last-assigned drone per target for hysteresis
        self._assignments: Dict[str, str] = {}

    # ── main entry point ──────────────────────────────────────────────────────

    def handle_detection(
        self,
        target_id: str,
        position: Position,
        *,
        confidence: float = 1.0,
        label: str = "unknown",
        drone_pos: Optional[Position] = None,
    ) -> Optional[str]:
        """
        Process a new target detection and assign a drone to intercept.

        Parameters
        ----------
        target_id:  Unique identifier for the tracked target.
        position:   Current observed position (x, y) or (lat, lon).
        confidence: Detection confidence [0, 1].
        label:      Object class label from the vision system.
        drone_pos:  Optional hint for the lead calculation (use nearest drone if None).

        Returns
        -------
        The assigned drone_id, or ``None`` if no drone is available or system
        is in lockdown.
        """
        # Safety gate — honour global lockdown
        if is_locked_down():
            logger.warning("[SwarmPursuit] lockdown active — ignoring detection %s", target_id)
            return None

        # 1. Update pursuit engine
        self.pursuit.update_target(target_id, position)

        # 2. Predict next position
        predicted = self.pursuit.predict_position(target_id) or position

        # 3. Compute intercept (proportional navigation)
        effective_drone_pos = drone_pos or self._nearest_drone_pos(predicted)
        intercept = (
            self.pursuit.generate_intercept(
                target_id,
                effective_drone_pos,
                drone_speed=DRONE_SPEED,
            )
            if effective_drone_pos is not None
            else predicted
        ) or predicted

        # 4. Update NXI world model
        self.map.update_target(
            target_id,
            intercept,
            metadata={
                "label":      label,
                "confidence": round(confidence, 3),
                "observed":   position,
                "predicted":  predicted,
            },
        )

        # 5. Log detection event to NXI
        self.map.add_event({
            "type":      "target_detected",
            "target_id": target_id,
            "position":  position,
            "predicted": predicted,
            "intercept": intercept,
            "label":     label,
            "confidence": round(confidence, 3),
        })

        # 6. Assign drone
        task: Dict[str, Any] = {
            "type":      "intercept",
            "target_id": target_id,
            "target":    intercept,
            "altitude":  INTERCEPT_ALTITUDE,
        }
        assigned = self.swarm.assign_task(task)

        if assigned:
            with self._lock:
                self._assignments[target_id] = assigned
            # Reflect assignment in NXI drone record
            self.map.update_drone(assigned, {"status": "assigned", "task": task})

        # 7. Audit log
        log_audit({
            "event":       "swarm_intercept",
            "target_id":   target_id,
            "drone_id":    assigned,
            "position":    position,
            "intercept":   intercept,
            "label":       label,
            "confidence":  round(confidence, 3),
        })

        # 8. Metrics
        if _metrics:
            _metrics.record(
                metric_type="swarm_detection",
                value=confidence,
                context={"target_id": target_id, "assigned": bool(assigned)},
            )

        # 9. Publish to Redis
        publish_event({
            "event":      "intercept_assigned",
            "target_id":  target_id,
            "drone_id":   assigned,
            "intercept":  intercept,
            "ts":         time.time(),
        })

        return assigned

    # ── formation intercept ───────────────────────────────────────────────────

    def handle_detection_formation(
        self,
        target_id: str,
        position: Position,
        num_drones: int = 3,
        *,
        formation_type: str = "circle",
        confidence: float = 1.0,
        label: str = "unknown",
    ) -> List[Optional[str]]:
        """
        Assign *num_drones* drones around the predicted intercept point in a
        formation.  Returns a list of assigned drone IDs (None for unassigned slots).
        """
        from swarm.formation import circle_formation, line_formation, wedge_formation  # noqa: PLC0415

        if is_locked_down():
            logger.warning("[SwarmPursuit] lockdown — formation intercept blocked for %s",
                           target_id)
            return []

        self.pursuit.update_target(target_id, position)
        predicted = self.pursuit.predict_position(target_id) or position
        self.map.update_target(target_id, predicted, metadata={"label": label,
                                                                "confidence": confidence})

        if formation_type == "line":
            import math  # noqa: PLC0415
            positions = line_formation(
                predicted, bearing=0.0, spacing=FORMATION_RADIUS / max(num_drones, 1),
                num_drones=num_drones, perpendicular=True,
            )
        elif formation_type == "wedge":
            import math  # noqa: PLC0415
            positions = wedge_formation(
                predicted, bearing=0.0, spacing=FORMATION_RADIUS / max(num_drones - 1, 1),
                num_drones=num_drones,
            )
        else:
            positions = circle_formation(predicted, FORMATION_RADIUS, num_drones)

        assigned_ids: List[Optional[str]] = []
        for pos in positions:
            task: Dict[str, Any] = {
                "type":      "formation_intercept",
                "target_id": target_id,
                "target":    pos,
                "altitude":  INTERCEPT_ALTITUDE,
            }
            assigned_ids.append(self.swarm.assign_task(task))

        self.map.add_event({
            "type":      "formation_intercept",
            "target_id": target_id,
            "formation": formation_type,
            "positions": positions,
            "assigned":  assigned_ids,
        })
        return assigned_ids

    # ── queries ───────────────────────────────────────────────────────────────

    def current_assignments(self) -> Dict[str, str]:
        """Return a snapshot of {target_id: drone_id} assignments."""
        with self._lock:
            return dict(self._assignments)

    # ── helpers ───────────────────────────────────────────────────────────────

    def _nearest_drone_pos(self, target_pos: Position) -> Optional[Position]:
        """Return the position of the nearest idle drone to *target_pos*."""
        import math as _math  # noqa: PLC0415
        best_pos: Optional[Position] = None
        best_dist = float("inf")
        state = self.swarm.get_state()
        for rec in state.get("drones", {}).values():
            pos = rec.get("position")
            if not pos or rec.get("status") == "faulted":
                continue
            d = _math.sqrt((pos[0] - target_pos[0]) ** 2 + (pos[1] - target_pos[1]) ** 2)
            if d < best_dist:
                best_dist = d
                best_pos = pos
        return best_pos


# ── module-level singleton ────────────────────────────────────────────────────

_coordinator: Optional[SwarmPursuitCoordinator] = None
_coord_lock = threading.Lock()


def get_coordinator() -> SwarmPursuitCoordinator:
    """
    Return the module-level SwarmPursuitCoordinator singleton.

    Lazily wires together the SwarmController, PursuitEngine, and NXIMap
    singletons on first call.
    """
    global _coordinator
    with _coord_lock:
        if _coordinator is None:
            from swarm.swarm_controller import get_swarm_controller  # noqa: PLC0415
            from tracking.pursuit import get_pursuit_engine          # noqa: PLC0415
            from nxi.map_engine import get_nxi_map                   # noqa: PLC0415
            _coordinator = SwarmPursuitCoordinator(
                swarm=get_swarm_controller(),
                pursuit=get_pursuit_engine(),
                nxi_map=get_nxi_map(),
            )
            logger.info("[SwarmPursuit] coordinator initialised")
    return _coordinator
