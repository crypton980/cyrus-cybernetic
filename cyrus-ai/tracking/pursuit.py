"""
cyrus-ai/tracking/pursuit.py
==============================
Real-time target tracking and pursuit prediction for the CYRUS swarm stack.

Algorithm
---------
* Maintains a sliding window of observed positions (configurable depth).
* Uses **exponentially-smoothed linear velocity** to predict the next
  position — more recent observations are weighted higher than older ones.
* ``generate_intercept()`` accounts for drone flight speed to compute a
  *lead* point the drone should fly toward (proportional navigation).
* Supports **multiple independent targets** via a per-target history dict so
  the same engine can track a whole scene.

Numpy is used when available; a pure-Python fallback is provided for
environments where numpy is not installed.
"""

from __future__ import annotations

import math
import os
import threading
import time
from typing import Dict, List, Optional, Tuple

try:
    import numpy as np
    _HAS_NUMPY = True
except ImportError:  # pragma: no cover
    _HAS_NUMPY = False

try:
    from observability.logger import get_logger
except ImportError:  # pragma: no cover
    import logging
    get_logger = logging.getLogger  # type: ignore[assignment]

logger = get_logger(__name__)

# ── configuration ─────────────────────────────────────────────────────────────

HISTORY_DEPTH:    int   = int(os.getenv("CYRUS_PURSUIT_HISTORY", "10"))
SMOOTHING_ALPHA:  float = float(os.getenv("CYRUS_PURSUIT_ALPHA", "0.7"))  # Exponential Moving Average weight: higher = more weight on recent observations
MAX_TARGETS:      int   = int(os.getenv("CYRUS_PURSUIT_MAX_TARGETS", "32"))
TARGET_TTL:       float = float(os.getenv("CYRUS_PURSUIT_TARGET_TTL", "30"))  # seconds

Position = Tuple[float, float]
Velocity = Tuple[float, float]


# ── core prediction functions ─────────────────────────────────────────────────

def _predict_linear_numpy(history: List[Position]) -> Position:
    """Predict next position using exponentially-smoothed velocity (numpy path)."""
    if len(history) < 2:
        return history[-1]

    positions = np.array(history, dtype=float)
    velocities = np.diff(positions, axis=0)  # shape (n-1, 2)

    n = len(velocities)
    weights = np.array([SMOOTHING_ALPHA ** (n - 1 - i) for i in range(n)])
    weights /= weights.sum()

    avg_vel = (velocities * weights[:, None]).sum(axis=0)
    predicted = positions[-1] + avg_vel
    return (float(predicted[0]), float(predicted[1]))


def _predict_linear_pure(history: List[Position]) -> Position:
    """Predict next position using exponentially-smoothed velocity (pure Python)."""
    if len(history) < 2:
        return history[-1]

    velocities = [
        (history[i][0] - history[i - 1][0], history[i][1] - history[i - 1][1])
        for i in range(1, len(history))
    ]
    n = len(velocities)
    weights = [SMOOTHING_ALPHA ** (n - 1 - i) for i in range(n)]
    total = sum(weights)

    avg_dx = sum(w * v[0] for w, v in zip(weights, velocities)) / total
    avg_dy = sum(w * v[1] for w, v in zip(weights, velocities)) / total

    last = history[-1]
    return (last[0] + avg_dx, last[1] + avg_dy)


def _predict_next(history: List[Position]) -> Position:
    if _HAS_NUMPY:
        return _predict_linear_numpy(history)
    return _predict_linear_pure(history)


def _lead_point(
    drone_pos: Position,
    target_current: Position,
    target_predicted: Position,
    drone_speed: float,
) -> Position:
    """
    Compute a proportional-navigation lead intercept point.

    The drone flies toward a point ahead of the target such that both arrive
    at approximately the same location.  Falling back to *target_predicted*
    when the geometry is degenerate (target too close or drone too slow).
    """
    tx, ty = target_current
    px, py = target_predicted
    dx, dy = px - tx, py - ty
    target_speed = math.sqrt(dx ** 2 + dy ** 2)

    if target_speed < 1e-6 or drone_speed <= 0:
        return target_predicted

    # Distance drone → target
    rx, ry = tx - drone_pos[0], ty - drone_pos[1]
    dist = math.sqrt(rx ** 2 + ry ** 2)

    if dist < 1e-6:
        return target_predicted

    # Time-to-intercept approximation
    tti = dist / drone_speed
    lead_x = tx + dx * tti
    lead_y = ty + dy * tti
    return (lead_x, lead_y)


# ── per-target state ──────────────────────────────────────────────────────────

class _TargetState:
    __slots__ = ("history", "last_seen")

    def __init__(self) -> None:
        self.history:   List[Position] = []
        self.last_seen: float = time.monotonic()

    def update(self, position: Position) -> None:
        self.history.append(position)
        if len(self.history) > HISTORY_DEPTH:
            self.history.pop(0)
        self.last_seen = time.monotonic()

    def predict(self) -> Optional[Position]:
        if not self.history:
            return None
        return _predict_next(self.history)

    def is_stale(self) -> bool:
        return (time.monotonic() - self.last_seen) > TARGET_TTL


# ── PursuitEngine ─────────────────────────────────────────────────────────────

class PursuitEngine:
    """
    Multi-target real-time pursuit and prediction engine.

    Usage
    -----
    .. code-block:: python

        engine = PursuitEngine()
        # Feed detections from the vision system
        engine.update_target("person_01", (37.421, -122.084))
        # Predict where the target will be next
        next_pos = engine.predict_position("person_01")
        # Generate an intercept point for a drone at (37.420, -122.085)
        intercept = engine.generate_intercept("person_01", (37.420, -122.085),
                                              drone_speed=15.0)
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._targets: Dict[str, _TargetState] = {}

    # ── public API ────────────────────────────────────────────────────────────

    def update_target(self, target_id: str, position: Position) -> None:
        """Record a new observed position for *target_id*."""
        with self._lock:
            if target_id not in self._targets:
                if len(self._targets) >= MAX_TARGETS:
                    self._evict_stale()
                    if len(self._targets) >= MAX_TARGETS:
                        logger.warning("[Pursuit] max targets reached — dropping update for %s",
                                       target_id)
                        return
                self._targets[target_id] = _TargetState()
            self._targets[target_id].update(position)

    def predict_position(self, target_id: str) -> Optional[Position]:
        """Return the predicted next position for *target_id*, or ``None``."""
        with self._lock:
            state = self._targets.get(target_id)
        if state is None:
            return None
        return state.predict()

    def generate_intercept(
        self,
        target_id: str,
        drone_pos: Position,
        *,
        drone_speed: float = 15.0,
    ) -> Optional[Position]:
        """
        Generate a proportional-navigation intercept point.

        Parameters
        ----------
        target_id:   ID of the tracked target.
        drone_pos:   Current drone position (x, y) or (lat, lon).
        drone_speed: Drone cruise speed in the same units as position deltas/s.
                     Defaults to 15 (m/s or arbitrary units).

        Returns
        -------
        (x, y) lead intercept position, or ``None`` if target unknown.
        """
        with self._lock:
            state = self._targets.get(target_id)
        if state is None or not state.history:
            return None

        current   = state.history[-1]
        predicted = state.predict()
        if predicted is None:
            return current

        return _lead_point(drone_pos, current, predicted, drone_speed)

    def get_velocity(self, target_id: str) -> Optional[Velocity]:
        """Return the smoothed (dx, dy) velocity estimate for *target_id*."""
        with self._lock:
            state = self._targets.get(target_id)
        if state is None or len(state.history) < 2:
            return None
        predicted = state.predict()
        if predicted is None:
            return None
        last = state.history[-1]
        return (predicted[0] - last[0], predicted[1] - last[1])

    def remove_target(self, target_id: str) -> bool:
        """Forget a tracked target."""
        with self._lock:
            if target_id in self._targets:
                del self._targets[target_id]
                return True
            return False

    def list_targets(self) -> List[str]:
        with self._lock:
            return [tid for tid, s in self._targets.items() if not s.is_stale()]

    def get_summary(self) -> dict:
        """Return a JSON-serialisable state snapshot."""
        with self._lock:
            return {
                tid: {
                    "last_position": state.history[-1] if state.history else None,
                    "history_depth": len(state.history),
                    "stale":         state.is_stale(),
                }
                for tid, state in self._targets.items()
            }

    # ── internal ──────────────────────────────────────────────────────────────

    def _evict_stale(self) -> None:
        """Remove stale targets (must be called with lock held)."""
        stale = [tid for tid, s in self._targets.items() if s.is_stale()]
        for tid in stale:
            del self._targets[tid]
        if stale:
            logger.info("[Pursuit] evicted %d stale targets", len(stale))


# ── module-level singleton ────────────────────────────────────────────────────

_pursuit_engine: Optional[PursuitEngine] = None
_pursuit_lock = threading.Lock()


def get_pursuit_engine() -> PursuitEngine:
    """Return the module-level PursuitEngine singleton."""
    global _pursuit_engine
    with _pursuit_lock:
        if _pursuit_engine is None:
            _pursuit_engine = PursuitEngine()
    return _pursuit_engine
