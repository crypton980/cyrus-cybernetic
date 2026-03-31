"""
CYRUS Drone Controller — MAVLink / PX4 interface.

Provides full drone lifecycle control via the MAVLink protocol:
* arm / disarm
* takeoff / land / return-to-launch (RTL)
* goto (GPS-frame waypoint navigation)
* velocity setpoint (body-frame NED)
* real-time telemetry (position, attitude, battery, armed state)

Graceful degradation
--------------------
The module checks for ``pymavlink`` at import time and falls back to a
*simulated* no-op implementation when the library is not installed. This
allows the rest of the CYRUS stack to import and test without hardware.

Configuration (env vars)
------------------------
CYRUS_DRONE_CONNECTION   → MAVLink connection string (default: udp:127.0.0.1:14550)
CYRUS_DRONE_TIMEOUT_SEC  → seconds to wait for heartbeat (default: 10)
CYRUS_DRONE_SIMULATED    → ``true`` to force simulated mode regardless of hardware
"""

from __future__ import annotations

import logging
import math
import os
import threading
import time
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Any, Optional

logger = logging.getLogger(__name__)

_CONNECTION_STRING: str = os.getenv("CYRUS_DRONE_CONNECTION", "udp:127.0.0.1:14550")
_HEARTBEAT_TIMEOUT: int = int(os.getenv("CYRUS_DRONE_TIMEOUT_SEC", "10"))
_SIMULATED: bool = os.getenv("CYRUS_DRONE_SIMULATED", "false").lower() == "true"

# ── MAVLink availability check ────────────────────────────────────────────────

try:
    if _SIMULATED:
        raise ImportError("simulated mode forced via CYRUS_DRONE_SIMULATED=true")
    from pymavlink import mavutil as _mavutil  # type: ignore[import]
    _MAVLINK_AVAILABLE = True
except ImportError:
    _mavutil = None  # type: ignore[assignment]
    _MAVLINK_AVAILABLE = False
    logger.info("[DroneController] pymavlink not available — running in simulated mode")


# ── Data model ─────────────────────────────────────────────────────────────────

class DroneState(str, Enum):
    DISCONNECTED = "disconnected"
    CONNECTED    = "connected"
    ARMED        = "armed"
    AIRBORNE     = "airborne"
    LANDING      = "landing"
    RETURNING    = "returning"
    ERROR        = "error"


@dataclass
class TelemetryData:
    state:      DroneState = DroneState.DISCONNECTED
    lat:        float = 0.0
    lon:        float = 0.0
    alt_m:      float = 0.0          # altitude above home in metres
    heading_deg: float = 0.0
    groundspeed_ms: float = 0.0
    battery_pct: float = 100.0
    armed:      bool = False
    mode:       str = "STABILIZE"
    timestamp:  float = field(default_factory=time.time)

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["state"] = self.state.value
        return d


# ── DroneController ────────────────────────────────────────────────────────────

class DroneController:
    """
    High-level MAVLink drone controller.

    Wraps pymavlink's mavlink_connection with a clean, thread-safe API.
    When pymavlink is not available (or simulated mode is forced), all
    commands are logged but not transmitted so the rest of the stack
    continues to function.
    """

    def __init__(self, connection_string: str | None = None) -> None:
        self._conn_str = connection_string or _CONNECTION_STRING
        self._master: Any = None
        self._telemetry = TelemetryData()
        self._lock = threading.Lock()
        self._telemetry_thread: threading.Thread | None = None
        self._running = False
        self.simulated = not _MAVLINK_AVAILABLE

    # ── Connection ─────────────────────────────────────────────────────────────

    def connect(self) -> bool:
        """
        Open the MAVLink connection and wait for a heartbeat.

        Returns True on success.  In simulated mode always returns True.
        """
        if self.simulated:
            logger.info("[Drone] Simulated mode — connection OK")
            with self._lock:
                self._telemetry.state = DroneState.CONNECTED
            self._start_telemetry_loop()
            return True

        try:
            self._master = _mavutil.mavlink_connection(self._conn_str)
            self._master.wait_heartbeat(timeout=_HEARTBEAT_TIMEOUT)
            logger.info(
                "[Drone] Heartbeat received from system=%d component=%d",
                self._master.target_system,
                self._master.target_component,
            )
            with self._lock:
                self._telemetry.state = DroneState.CONNECTED
            self._start_telemetry_loop()
            return True
        except Exception as exc:  # noqa: BLE001
            logger.error("[Drone] Connection failed: %s", exc)
            with self._lock:
                self._telemetry.state = DroneState.ERROR
            return False

    def disconnect(self) -> None:
        """Close the MAVLink connection and stop the telemetry thread."""
        self._running = False
        if self._master and not self.simulated:
            try:
                self._master.close()
            except Exception:  # noqa: BLE001
                pass
        with self._lock:
            self._telemetry.state = DroneState.DISCONNECTED
        logger.info("[Drone] Disconnected")

    # ── Safety gate ────────────────────────────────────────────────────────────

    def _check_connected(self) -> None:
        """Raise RuntimeError if not connected."""
        if self._telemetry.state == DroneState.DISCONNECTED:
            raise RuntimeError("DroneController not connected — call connect() first")

    # ── Commands ───────────────────────────────────────────────────────────────

    def arm(self, timeout: float = 10.0) -> bool:
        """
        Arm the vehicle motors.

        Returns True when armed, False on timeout.
        """
        self._check_connected()
        if self.simulated:
            logger.info("[Drone][SIM] arm()")
            with self._lock:
                self._telemetry.armed = True
                self._telemetry.state = DroneState.ARMED
            return True

        self._master.arducopter_arm()
        deadline = time.time() + timeout
        while time.time() < deadline:
            msg = self._master.recv_match(type="HEARTBEAT", blocking=True, timeout=1)
            if msg and msg.base_mode & 0x80:   # MAV_MODE_FLAG_SAFETY_ARMED
                with self._lock:
                    self._telemetry.armed = True
                    self._telemetry.state = DroneState.ARMED
                logger.info("[Drone] Armed")
                return True
        logger.warning("[Drone] Arm timeout")
        return False

    def disarm(self) -> bool:
        """Disarm the vehicle motors (only safe when landed)."""
        self._check_connected()
        if self.simulated:
            logger.info("[Drone][SIM] disarm()")
            with self._lock:
                self._telemetry.armed = False
                self._telemetry.state = DroneState.CONNECTED
            return True

        self._master.arducopter_disarm()
        logger.info("[Drone] Disarmed")
        with self._lock:
            self._telemetry.armed = False
            self._telemetry.state = DroneState.CONNECTED
        return True

    def takeoff(self, altitude_m: float = 10.0) -> None:
        """
        Command the vehicle to take off to *altitude_m* metres AGL.

        The vehicle must be armed first.
        """
        self._check_connected()
        if self.simulated:
            logger.info("[Drone][SIM] takeoff(alt=%.1f m)", altitude_m)
            with self._lock:
                self._telemetry.alt_m = altitude_m
                self._telemetry.state = DroneState.AIRBORNE
            return

        self._master.mav.command_long_send(
            self._master.target_system,
            self._master.target_component,
            _mavutil.mavlink.MAV_CMD_NAV_TAKEOFF,
            0,                    # confirmation
            0, 0, 0, math.nan,    # p1-p4 (pitch, yaw; nan = keep current)
            0, 0,                 # lat/lon (0 = use current)
            altitude_m,
        )
        with self._lock:
            self._telemetry.state = DroneState.AIRBORNE
        logger.info("[Drone] Takeoff command sent alt=%.1f m", altitude_m)

    def land(self) -> None:
        """Command the vehicle to land at its current position."""
        self._check_connected()
        if self.simulated:
            logger.info("[Drone][SIM] land()")
            with self._lock:
                self._telemetry.alt_m = 0.0
                self._telemetry.state = DroneState.CONNECTED
                self._telemetry.armed = False
            return

        self._master.mav.command_long_send(
            self._master.target_system,
            self._master.target_component,
            _mavutil.mavlink.MAV_CMD_NAV_LAND,
            0, 0, 0, 0, math.nan, 0, 0, 0,
        )
        with self._lock:
            self._telemetry.state = DroneState.LANDING
        logger.info("[Drone] Land command sent")

    def return_to_launch(self) -> None:
        """Command the vehicle to return to home position and land (RTL)."""
        self._check_connected()
        if self.simulated:
            logger.info("[Drone][SIM] return_to_launch()")
            with self._lock:
                self._telemetry.state = DroneState.RETURNING
            return

        self._master.mav.command_long_send(
            self._master.target_system,
            self._master.target_component,
            _mavutil.mavlink.MAV_CMD_NAV_RETURN_TO_LAUNCH,
            0, 0, 0, 0, 0, 0, 0, 0,
        )
        with self._lock:
            self._telemetry.state = DroneState.RETURNING
        logger.info("[Drone] RTL command sent")

    def goto(self, lat: float, lon: float, alt_m: float) -> None:
        """
        Navigate to a global GPS position.

        Parameters
        ----------
        lat   : decimal degrees (WGS-84)
        lon   : decimal degrees (WGS-84)
        alt_m : altitude in metres above home
        """
        self._check_connected()
        if self.simulated:
            logger.info("[Drone][SIM] goto(lat=%.6f lon=%.6f alt=%.1f)", lat, lon, alt_m)
            with self._lock:
                self._telemetry.lat = lat
                self._telemetry.lon = lon
                self._telemetry.alt_m = alt_m
            return

        self._master.mav.set_position_target_global_int_send(
            0,                                                           # time_boot_ms (unused)
            self._master.target_system,
            self._master.target_component,
            _mavutil.mavlink.MAV_FRAME_GLOBAL_RELATIVE_ALT_INT,
            int(0b110111111000),                                         # type_mask: position only
            int(lat * 1e7),
            int(lon * 1e7),
            alt_m,
            0, 0, 0,                                                     # velocity (ignored)
            0, 0, 0,                                                     # acceleration (ignored)
            0, 0,                                                        # yaw, yaw_rate (ignored)
        )
        logger.info("[Drone] goto lat=%.6f lon=%.6f alt=%.1f m", lat, lon, alt_m)

    def set_velocity(self, vx: float, vy: float, vz: float) -> None:
        """
        Set body-frame NED velocity setpoint in m/s.

        vx → forward, vy → right, vz → down (positive = descend).
        """
        self._check_connected()
        if self.simulated:
            logger.info("[Drone][SIM] set_velocity(vx=%.2f vy=%.2f vz=%.2f)", vx, vy, vz)
            return

        self._master.mav.set_position_target_local_ned_send(
            0,
            self._master.target_system,
            self._master.target_component,
            _mavutil.mavlink.MAV_FRAME_BODY_OFFSET_NED,
            int(0b110111000111),   # type_mask: velocity only
            0, 0, 0,               # position (ignored)
            vx, vy, vz,
            0, 0, 0,               # acceleration (ignored)
            0, 0,
        )

    def hover(self) -> None:
        """Halt horizontal motion and hold current position."""
        self.set_velocity(0.0, 0.0, 0.0)

    # ── Telemetry ──────────────────────────────────────────────────────────────

    @property
    def telemetry(self) -> TelemetryData:
        """Return a snapshot of the latest telemetry data."""
        with self._lock:
            import copy
            return copy.copy(self._telemetry)

    def _start_telemetry_loop(self) -> None:
        if self._telemetry_thread and self._telemetry_thread.is_alive():
            return
        self._running = True
        self._telemetry_thread = threading.Thread(
            target=self._telemetry_loop, daemon=True, name="cyrus-drone-telemetry"
        )
        self._telemetry_thread.start()

    def _telemetry_loop(self) -> None:
        """Background thread: poll MAVLink messages and update telemetry."""
        while self._running:
            if self.simulated:
                time.sleep(1)
                continue
            try:
                msg = self._master.recv_match(
                    type=["GLOBAL_POSITION_INT", "HEARTBEAT", "SYS_STATUS"],
                    blocking=True,
                    timeout=1,
                )
                if msg is None:
                    continue
                mt = msg.get_type()
                with self._lock:
                    if mt == "GLOBAL_POSITION_INT":
                        self._telemetry.lat = msg.lat / 1e7
                        self._telemetry.lon = msg.lon / 1e7
                        self._telemetry.alt_m = msg.relative_alt / 1000.0
                        self._telemetry.heading_deg = msg.hdg / 100.0 if msg.hdg != 65535 else 0.0
                        speed = math.sqrt(msg.vx**2 + msg.vy**2) / 100.0
                        self._telemetry.groundspeed_ms = speed
                    elif mt == "HEARTBEAT":
                        self._telemetry.armed = bool(msg.base_mode & 0x80)
                        self._telemetry.mode = _mavutil.mode_string_v10(msg)
                    elif mt == "SYS_STATUS":
                        if msg.battery_remaining >= 0:
                            self._telemetry.battery_pct = float(msg.battery_remaining)
                    self._telemetry.timestamp = time.time()
            except Exception as exc:  # noqa: BLE001
                logger.debug("[Drone] telemetry read error: %s", exc)
