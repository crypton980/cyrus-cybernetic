"""
cyrus-ai/swarm/formation.py
============================
Formation geometry utilities for the CYRUS swarm intelligence stack.

Provides pure-function formation calculators (no side effects) and a
higher-level helper that issues ``goto`` commands to registered drones.
All angles are in radians internally; positions are (lat, lon) or (x, y)
floating-point tuples — the coordinate system is caller-defined.

Supported formations
--------------------
circle  — evenly spaced around a centre point
line    — equally spaced along a bearing
wedge   — V-shape, two angled arms from an apex
"""

from __future__ import annotations

import math
from typing import Any, Dict, List, Optional, Tuple

Position = Tuple[float, float]


# ── circle formation ──────────────────────────────────────────────────────────

def circle_formation(
    center: Position,
    radius: float,
    num_drones: int,
    *,
    offset_angle: float = 0.0,
) -> List[Position]:
    """
    Return *num_drones* positions equally spaced on a circle of *radius*
    around *center*.

    Parameters
    ----------
    center:       (x, y) or (lat, lon) of the formation centre.
    radius:       Distance from centre to each drone.
    num_drones:   Number of positions to generate.
    offset_angle: Initial angle offset in radians (default 0 = East / right).

    Returns
    -------
    List of (x, y) positions, length == num_drones.
    """
    if num_drones <= 0:
        return []
    positions: List[Position] = []
    for i in range(num_drones):
        angle = offset_angle + (2 * math.pi / num_drones) * i
        x = center[0] + radius * math.cos(angle)
        y = center[1] + radius * math.sin(angle)
        positions.append((x, y))
    return positions


# ── line formation ────────────────────────────────────────────────────────────

def line_formation(
    start: Position,
    bearing: float,
    spacing: float,
    num_drones: int,
    *,
    perpendicular: bool = False,
) -> List[Position]:
    """
    Return *num_drones* positions along a line.

    Parameters
    ----------
    start:         Leading position (first drone).
    bearing:       Direction of travel in radians (0 = +x / East).
    spacing:       Distance between consecutive drones.
    num_drones:    Total drones in the line.
    perpendicular: If True, the line is perpendicular to *bearing* (side-by-side).

    Returns
    -------
    List of (x, y) positions.
    """
    if num_drones <= 0:
        return []
    direction = bearing + (math.pi / 2 if perpendicular else 0.0)
    positions: List[Position] = []
    for i in range(num_drones):
        x = start[0] + spacing * i * math.cos(direction)
        y = start[1] + spacing * i * math.sin(direction)
        positions.append((x, y))
    return positions


# ── wedge / V formation ───────────────────────────────────────────────────────

def wedge_formation(
    apex: Position,
    bearing: float,
    spacing: float,
    num_drones: int,
    *,
    half_angle: float = math.pi / 6,
) -> List[Position]:
    """
    Return *num_drones* positions in a V-shape (wedge) with the apex at front.

    The first drone occupies the apex; subsequent drones alternate left/right
    along the two arms of the V.

    Parameters
    ----------
    apex:        Tip of the V (leading position).
    bearing:     Forward direction in radians.
    spacing:     Distance between successive drone pairs along each arm.
    num_drones:  Total drones (including apex).
    half_angle:  Half-angle of the V in radians (default 30°).

    Returns
    -------
    List of (x, y) positions.
    """
    if num_drones <= 0:
        return []
    positions: List[Position] = [apex]

    left_bearing  = bearing + math.pi - half_angle   # rear-left
    right_bearing = bearing + math.pi + half_angle   # rear-right

    pair = 1
    placed = 1
    while placed < num_drones:
        dist = spacing * pair
        # Left arm
        if placed < num_drones:
            x = apex[0] + dist * math.cos(left_bearing)
            y = apex[1] + dist * math.sin(left_bearing)
            positions.append((x, y))
            placed += 1
        # Right arm
        if placed < num_drones:
            x = apex[0] + dist * math.cos(right_bearing)
            y = apex[1] + dist * math.sin(right_bearing)
            positions.append((x, y))
            placed += 1
        pair += 1

    return positions


# ── high-level formation dispatcher ──────────────────────────────────────────

def assign_formation_to_swarm(
    drone_records: Dict[str, Any],
    positions: List[Position],
    altitude: float = 10.0,
) -> Dict[str, Optional[Position]]:
    """
    Assign a pre-computed list of formation *positions* to drones in
    *drone_records* and issue goto commands.

    Drones are matched to positions in registry-iteration order (deterministic
    in Python 3.7+).  Extra positions without a matching drone are ignored;
    drones without a matching position are left untouched.

    Parameters
    ----------
    drone_records: Dict of {drone_id: rec} as stored in SwarmController.
    positions:     List of (x, y) target positions from a formation function.
    altitude:      Altitude (m) passed to ``goto(x, y, alt)``.

    Returns
    -------
    Dict mapping drone_id → assigned position (or None if skipped).
    """
    result: Dict[str, Optional[Position]] = {}
    ids = [did for did, rec in drone_records.items()
           if rec.get("status") not in ("faulted",)]

    for i, drone_id in enumerate(ids):
        if i >= len(positions):
            break
        pos = positions[i]
        ctrl = drone_records[drone_id].get("controller")
        if ctrl and hasattr(ctrl, "goto"):
            try:
                ctrl.goto(pos[0], pos[1], altitude)
            except Exception:  # noqa: BLE001
                pass
        result[drone_id] = pos

    return result
