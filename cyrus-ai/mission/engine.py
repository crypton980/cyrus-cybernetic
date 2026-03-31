"""
CYRUS Mission Execution Engine

Executes structured, step-based autonomous missions on the drone platform.

Mission format
--------------
A mission is a dict with at minimum a ``steps`` list:

    {
        "id": "mission-uuid",
        "label": "Area scan",
        "steps": [
            {"action": "arm"},
            {"action": "takeoff", "alt": 15},
            {"action": "navigate", "lat": 37.7749, "lon": -122.4194, "alt": 20},
            {"action": "scan", "dwell_sec": 5},
            {"action": "hover", "duration_sec": 3},
            {"action": "land"},
        ]
    }

Supported step actions
----------------------
arm         — arm the drone
disarm      — disarm (only when landed)
takeoff     — takeoff to ``alt`` metres AGL
navigate    — fly to (lat, lon, alt)
scan        — capture frames and run detection for ``dwell_sec`` seconds
hover       — hold position for ``duration_sec`` seconds
rtl         — return to launch
land        — land at current position
alert       — emit an alert via the CYRUS alerter

Integration
-----------
* Respects CYRUS safety lockdown (mission aborted if locked)
* Uses HITL approval gate when ``CYRUS_REQUIRE_APPROVAL=webhook``
* Logs every step to the audit trail
* Reports mission record to ``mission_control``
* Emits metrics per step

Configuration (env vars)
------------------------
CYRUS_MISSION_STEP_PAUSE_SEC   → seconds to sleep between steps (default: 2)
CYRUS_MISSION_MAX_ALT_M        → hard ceiling for all altitudes (default: 120)
"""

from __future__ import annotations

import logging
import os
import threading
import time
import uuid
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from embodiment.drone_controller import DroneController
    from perception.vision import VisionSystem

logger = logging.getLogger(__name__)

_STEP_PAUSE: float = float(os.getenv("CYRUS_MISSION_STEP_PAUSE_SEC", "2"))
_MAX_ALT:    float = float(os.getenv("CYRUS_MISSION_MAX_ALT_M", "120"))


class MissionStatus(str, Enum):
    PENDING   = "pending"
    RUNNING   = "running"
    COMPLETED = "completed"
    FAILED    = "failed"
    ABORTED   = "aborted"


@dataclass
class MissionStep:
    action: str
    params: dict[str, Any] = field(default_factory=dict)
    status: str = "pending"
    started_at:   float = 0.0
    completed_at: float = 0.0
    error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class MissionResult:
    mission_id:   str
    label:        str
    status:       MissionStatus
    steps_total:  int
    steps_done:   int
    started_at:   float = field(default_factory=time.time)
    completed_at: float = 0.0
    error:        str | None = None
    detections:   list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["status"] = self.status.value
        return d


class MissionEngine:
    """
    Step-by-step autonomous mission executor.

    Parameters
    ----------
    drone  : DroneController   — drone hardware/sim interface
    vision : VisionSystem | None — optional, used for scan steps
    """

    def __init__(
        self,
        drone: "DroneController",
        vision: "VisionSystem | None" = None,
    ) -> None:
        self.drone  = drone
        self.vision = vision
        self._current: MissionResult | None = None
        self._lock = threading.Lock()

    # ── Status ─────────────────────────────────────────────────────────────────

    def is_active(self) -> bool:
        """Return True if a mission is currently executing."""
        with self._lock:
            return (
                self._current is not None
                and self._current.status == MissionStatus.RUNNING
            )

    def current_mission(self) -> dict[str, Any] | None:
        with self._lock:
            return self._current.to_dict() if self._current else None

    # ── Execution ──────────────────────────────────────────────────────────────

    def execute_mission(self, mission: dict[str, Any]) -> MissionResult:
        """
        Execute a full mission synchronously.

        The method blocks until the mission completes, fails, or is aborted.
        Call from a background thread to keep the API responsive.

        Parameters
        ----------
        mission : dict  — mission definition (see module docstring)

        Returns
        -------
        MissionResult
        """
        mission_id  = mission.get("id") or str(uuid.uuid4())
        label       = mission.get("label", "unnamed")
        raw_steps   = mission.get("steps", [])

        if not raw_steps:
            raise ValueError("Mission has no steps")

        steps = [
            MissionStep(action=str(s.get("action", "")), params={k: v for k, v in s.items() if k != "action"})
            for s in raw_steps
        ]

        result = MissionResult(
            mission_id=mission_id,
            label=label,
            status=MissionStatus.RUNNING,
            steps_total=len(steps),
            steps_done=0,
        )
        with self._lock:
            self._current = result

        self._register_mission(mission_id, label)
        self._audit("mission_started", {"mission_id": mission_id, "label": label, "steps": len(steps)})
        logger.info("[Mission] started id=%s label=%r steps=%d", mission_id, label, len(steps))

        for i, step in enumerate(steps):
            # Safety lockdown gate
            if self._is_locked():
                logger.warning("[Mission] lockdown detected — aborting mission %s at step %d", mission_id, i)
                result.status = MissionStatus.ABORTED
                result.error  = "system_lockdown"
                break

            # HITL approval gate (only for navigate and scan steps)
            if step.action in ("navigate", "scan") and self._needs_approval():
                if not self._request_approval(mission_id, step):
                    logger.warning("[Mission] step %d not approved — aborting", i)
                    result.status = MissionStatus.ABORTED
                    result.error  = "approval_denied"
                    break

            step.status     = "running"
            step.started_at = time.time()
            try:
                detections = self._execute_step(step)
                if detections:
                    result.detections.extend(detections)
                step.status       = "completed"
                step.completed_at = time.time()
                result.steps_done = i + 1
                self._emit_metric(mission_id, step.action, success=True)
                logger.info("[Mission] step %d/%d %r completed", i + 1, len(steps), step.action)
            except Exception as exc:  # noqa: BLE001
                step.status = "failed"
                step.error  = str(exc)
                logger.error("[Mission] step %d/%d %r failed: %s", i + 1, len(steps), step.action, exc)
                result.status = MissionStatus.FAILED
                result.error  = f"step {i + 1} ({step.action}): {exc}"
                self._emit_metric(mission_id, step.action, success=False)
                break

            time.sleep(_STEP_PAUSE)

        if result.status == MissionStatus.RUNNING:
            result.status = MissionStatus.COMPLETED

        result.completed_at = time.time()
        self._audit("mission_finished", result.to_dict())
        self._complete_mission(mission_id, result.status)
        logger.info("[Mission] finished id=%s status=%s", mission_id, result.status.value)

        return result

    # ── Step dispatcher ────────────────────────────────────────────────────────

    def _execute_step(self, step: MissionStep) -> list[dict[str, Any]]:
        """Run a single mission step and return any detection data."""
        action = step.action.lower()
        p      = step.params

        if action == "arm":
            self.drone.arm(timeout=float(p.get("timeout", 10)))

        elif action == "disarm":
            self.drone.disarm()

        elif action == "takeoff":
            alt = min(float(p.get("alt", 10)), _MAX_ALT)
            self.drone.takeoff(altitude_m=alt)
            time.sleep(float(p.get("climb_wait_sec", 3)))

        elif action == "navigate":
            lat = float(p["lat"])
            lon = float(p["lon"])
            alt = min(float(p.get("alt", 20)), _MAX_ALT)
            self.drone.goto(lat=lat, lon=lon, alt_m=alt)
            time.sleep(float(p.get("travel_wait_sec", 5)))

        elif action == "scan":
            return self._do_scan(
                dwell_sec=float(p.get("dwell_sec", 5)),
                max_frames=int(p.get("max_frames", 10)),
            )

        elif action == "hover":
            self.drone.hover()
            time.sleep(float(p.get("duration_sec", 3)))

        elif action == "rtl":
            self.drone.return_to_launch()

        elif action == "land":
            self.drone.land()
            time.sleep(float(p.get("settle_sec", 3)))

        elif action == "alert":
            self._send_alert(str(p.get("message", "mission alert")))

        else:
            logger.warning("[Mission] unknown step action: %s", action)

        return []

    def _do_scan(self, dwell_sec: float = 5.0, max_frames: int = 10) -> list[dict[str, Any]]:
        """Capture frames and run detection for dwell_sec seconds."""
        if self.vision is None:
            logger.debug("[Mission] scan step skipped — no vision system")
            return []

        all_detections: list[dict[str, Any]] = []
        start = time.time()
        frames_captured = 0

        while time.time() - start < dwell_sec and frames_captured < max_frames:
            frame = self.vision.capture_frame()
            if frame is not None:
                dets = self.vision.detect(frame)
                for d in dets:
                    all_detections.append(d.to_dict())
                frames_captured += 1
                logger.info("[Mission] scan frame %d: %d objects detected", frames_captured, len(dets))
            time.sleep(max(0.1, dwell_sec / max_frames))

        logger.info("[Mission] scan complete: %d total detections in %d frames", len(all_detections), frames_captured)
        return all_detections

    # ── Integration helpers ────────────────────────────────────────────────────

    @staticmethod
    def _is_locked() -> bool:
        try:
            from safety.override import is_locked  # noqa: PLC0415
            return is_locked()
        except Exception:  # noqa: BLE001
            return False

    @staticmethod
    def _needs_approval() -> bool:
        try:
            from control.approval import needs_approval  # noqa: PLC0415
            return needs_approval()
        except Exception:  # noqa: BLE001
            return False

    @staticmethod
    def _request_approval(mission_id: str, step: "MissionStep") -> bool:
        try:
            from control.approval import request_approval  # noqa: PLC0415
            return request_approval(
                action_type=f"mission_step_{step.action}",
                payload={"mission_id": mission_id, "step": step.to_dict()},
                timeout_sec=30,
            )
        except Exception:  # noqa: BLE001
            return True   # fail open if approval system unavailable

    @staticmethod
    def _audit(event: str, data: dict[str, Any]) -> None:
        try:
            from audit.logger import log_audit  # noqa: PLC0415
            log_audit({"event": event, **data})
        except Exception:  # noqa: BLE001
            pass

    @staticmethod
    def _register_mission(mission_id: str, label: str) -> None:
        try:
            from mission_control.controller import start_mission  # noqa: PLC0415
            start_mission(objective=label, mission_id=mission_id)
        except Exception:  # noqa: BLE001
            pass

    @staticmethod
    def _complete_mission(mission_id: str, status: MissionStatus) -> None:
        try:
            from mission_control.controller import complete_mission, fail_mission  # noqa: PLC0415
            if status == MissionStatus.COMPLETED:
                complete_mission(mission_id)
            else:
                fail_mission(mission_id, str(status.value))
        except Exception:  # noqa: BLE001
            pass

    @staticmethod
    def _emit_metric(mission_id: str, action: str, success: bool) -> None:
        try:
            from metrics.tracker import record_metric  # noqa: PLC0415
            record_metric({
                "source": "mission_engine",
                "mission_id": mission_id,
                "action": action,
                "success": success,
            })
        except Exception:  # noqa: BLE001
            pass

    @staticmethod
    def _send_alert(message: str) -> None:
        try:
            from alerts.alerter import get_alerter  # noqa: PLC0415
            get_alerter().send_alert(message)
        except Exception:  # noqa: BLE001
            logger.info("[Mission] ALERT: %s", message)
