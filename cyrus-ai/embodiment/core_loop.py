"""
CYRUS Embodied Core Loop

The ``CyrusCoreLoop`` continuously:
1. Polls the ``VisionSystem`` for perception data (objects in view)
2. Feeds perception + last telemetry through the CYRUS brain to get a decision
3. Dispatches the decision to the ``MissionEngine``
4. Logs every cycle to the audit log and metrics tracker
5. Checks the CYRUS safety lockdown before each cycle — halts if locked

Key design choices
------------------
* Safety-first: lockdown is checked at the **top** of every tick
* Non-blocking: the loop runs in a daemon thread so the FastAPI server
  continues to handle requests during operation
* Graceful: exceptions inside a tick are caught and logged; the loop
  does not crash on transient hardware errors
* Configurable tick rate via ``CYRUS_EMBODIMENT_TICK_SEC`` (default: 1.0)
* Configurable max perception latency via ``CYRUS_PERCEPTION_TIMEOUT_SEC``

Configuration (env vars)
------------------------
CYRUS_EMBODIMENT_TICK_SEC       → seconds between loop ticks (default: 1.0)
CYRUS_EMBODIMENT_AUTO_MISSION   → true to auto-dispatch missions from brain output
CYRUS_PERCEPTION_TIMEOUT_SEC    → max seconds for a perception frame (default: 0.5)
"""

from __future__ import annotations

import logging
import os
import threading
import time
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from embodiment.drone_controller import DroneController
    from perception.vision import VisionSystem
    from mission.engine import MissionEngine

logger = logging.getLogger(__name__)

_TICK_SEC: float = float(os.getenv("CYRUS_EMBODIMENT_TICK_SEC", "1.0"))
_AUTO_MISSION: bool = os.getenv("CYRUS_EMBODIMENT_AUTO_MISSION", "true").lower() == "true"
_PERCEPTION_TIMEOUT: float = float(os.getenv("CYRUS_PERCEPTION_TIMEOUT_SEC", "0.5"))


class EmbodimentStatus(str, Enum):
    IDLE     = "idle"
    RUNNING  = "running"
    PAUSED   = "paused"
    STOPPED  = "stopped"
    ERROR    = "error"


@dataclass
class LoopStats:
    ticks:           int   = 0
    errors:          int   = 0
    missions_started: int   = 0
    started_at:      float = field(default_factory=time.time)
    last_tick_at:    float = 0.0
    status:          EmbodimentStatus = EmbodimentStatus.IDLE

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["status"] = self.status.value
        d["uptime_sec"] = round(time.time() - self.started_at, 1)
        return d


class CyrusCoreLoop:
    """
    Continuous perception → cognition → action loop for the CYRUS embodied agent.

    Parameters
    ----------
    drone         : DroneController  — hardware interface
    vision        : VisionSystem     — perception / object detection
    mission_engine : MissionEngine   — autonomous mission execution
    """

    def __init__(
        self,
        drone: "DroneController",
        vision: "VisionSystem",
        mission_engine: "MissionEngine",
    ) -> None:
        self.drone = drone
        self.vision = vision
        self.mission_engine = mission_engine
        self._thread: threading.Thread | None = None
        self._stop_event = threading.Event()
        self.stats = LoopStats()

    # ── Lifecycle ──────────────────────────────────────────────────────────────

    def start(self) -> None:
        """Start the core loop in a background daemon thread."""
        if self._thread and self._thread.is_alive():
            logger.warning("[CoreLoop] already running")
            return
        self._stop_event.clear()
        self._thread = threading.Thread(
            target=self._loop, daemon=True, name="cyrus-embodiment-loop"
        )
        self.stats.status = EmbodimentStatus.RUNNING
        self._thread.start()
        logger.info("[CoreLoop] started (tick=%.2fs)", _TICK_SEC)

    def stop(self) -> None:
        """Signal the loop to stop and wait for the thread to exit."""
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=max(_TICK_SEC * 3, 5))
        self.stats.status = EmbodimentStatus.STOPPED
        logger.info("[CoreLoop] stopped after %d ticks", self.stats.ticks)

    def is_running(self) -> bool:
        return bool(self._thread and self._thread.is_alive() and not self._stop_event.is_set())

    # ── Main loop ──────────────────────────────────────────────────────────────

    def _loop(self) -> None:
        while not self._stop_event.is_set():
            tick_start = time.time()
            try:
                self._tick()
            except Exception as exc:  # noqa: BLE001
                self.stats.errors += 1
                logger.error("[CoreLoop] tick error: %s", exc)
                if self.stats.errors > 50:
                    logger.critical("[CoreLoop] too many errors (%d) — stopping loop", self.stats.errors)
                    self.stats.status = EmbodimentStatus.ERROR
                    break

            elapsed = time.time() - tick_start
            sleep_for = max(0.0, _TICK_SEC - elapsed)
            self._stop_event.wait(timeout=sleep_for)

    def _tick(self) -> None:
        """One iteration of the sense → think → act cycle."""
        # 1. Safety lockdown gate
        try:
            from safety.override import is_locked  # noqa: PLC0415
            if is_locked():
                if self.stats.status != EmbodimentStatus.PAUSED:
                    logger.warning("[CoreLoop] system in lockdown — pausing embodiment loop")
                    self.stats.status = EmbodimentStatus.PAUSED
                return
            if self.stats.status == EmbodimentStatus.PAUSED:
                logger.info("[CoreLoop] lockdown cleared — resuming")
                self.stats.status = EmbodimentStatus.RUNNING
        except Exception:  # noqa: BLE001
            pass

        # 2. Perception
        perception = self._sense()

        # 3. Cognition
        decision = self._think(perception)

        # 4. Action
        if decision:
            self._act(decision)

        # 5. Metrics
        self.stats.ticks += 1
        self.stats.last_tick_at = time.time()

        try:
            from metrics.tracker import record_metric  # noqa: PLC0415
            record_metric({
                "source": "embodiment_loop",
                "tick": self.stats.ticks,
                "objects_detected": len(perception.get("objects", [])),
                "mission_active": self.mission_engine.is_active(),
            })
        except Exception:  # noqa: BLE001
            pass

    def _sense(self) -> dict[str, Any]:
        """Gather perception data from the vision system and drone telemetry."""
        perception: dict[str, Any] = {}

        # Visual perception
        try:
            frame = self.vision.capture_frame(timeout_sec=_PERCEPTION_TIMEOUT)
            if frame is not None:
                detections = self.vision.detect(frame)
                perception["objects"] = [d.__dict__ for d in detections]
                perception["frame_shape"] = getattr(frame, "shape", None)
        except Exception as exc:  # noqa: BLE001
            logger.debug("[CoreLoop] vision error: %s", exc)
            perception["objects"] = []

        # Drone telemetry
        try:
            telem = self.drone.telemetry
            perception["drone"] = telem.to_dict()
        except Exception:  # noqa: BLE001
            pass

        return perception

    def _think(self, perception: dict[str, Any]) -> dict[str, Any] | None:
        """Feed perception context to the CYRUS brain and return a decision."""
        try:
            from brain import process_embodied_input  # noqa: PLC0415
            return process_embodied_input(perception)
        except Exception as exc:  # noqa: BLE001
            logger.debug("[CoreLoop] brain error: %s", exc)
            return None

    def _act(self, decision: dict[str, Any]) -> None:
        """Dispatch the brain's decision to the mission engine or drone."""
        if not _AUTO_MISSION:
            return

        mission = decision.get("mission")
        if mission and isinstance(mission, dict):
            if not self.mission_engine.is_active():
                logger.info("[CoreLoop] dispatching mission from brain decision")
                self.stats.missions_started += 1
                # Run mission asynchronously to avoid blocking the loop
                t = threading.Thread(
                    target=self._run_mission_safe,
                    args=(mission,),
                    daemon=True,
                    name="cyrus-auto-mission",
                )
                t.start()

        # Direct drone commands (emergency overrides)
        cmd = decision.get("drone_command")
        if cmd:
            self._execute_drone_command(cmd)

    def _run_mission_safe(self, mission: dict[str, Any]) -> None:
        try:
            self.mission_engine.execute_mission(mission)
        except Exception as exc:  # noqa: BLE001
            logger.error("[CoreLoop] mission execution error: %s", exc)

    def _execute_drone_command(self, cmd: dict[str, Any]) -> None:
        """Execute a direct drone command issued by the brain."""
        action = cmd.get("action", "").lower()
        try:
            if action == "hover":
                self.drone.hover()
            elif action == "rtl":
                self.drone.return_to_launch()
            elif action == "land":
                self.drone.land()
            elif action == "disarm":
                self.drone.disarm()
            else:
                logger.debug("[CoreLoop] unknown drone command action: %s", action)
        except Exception as exc:  # noqa: BLE001
            logger.error("[CoreLoop] drone command error action=%s: %s", action, exc)
