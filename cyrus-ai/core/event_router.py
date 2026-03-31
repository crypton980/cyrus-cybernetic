"""
cyrus-ai/core/event_router.py
==============================
Unified event bus for the CYRUS Intelligence Platform.

Every subsystem that needs to communicate with another subsystem does so by
calling ``route_event(event)``.  This module decodes the event ``type`` field
and dispatches to the correct handler, keeping all cross-module wiring in one
place and avoiding circular imports at the call site.

Event envelope
--------------
Every event must be a dict with at minimum::

    {
        "type": "<event_type_string>",
        ...payload fields...
    }

Supported event types
---------------------
perception      → feed raw sensor data into the brain / swarm pursuit chain
swarm           → delegate to brain.process_swarm_event()
mission         → delegate to the mission engine
control         → safety / lockdown / approval actions
decision        → route brain decisions to downstream actuators
nxi             → direct NXI world-model updates (no brain involvement)
platform        → live-ingest a raw platform event
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


# ── helpers ───────────────────────────────────────────────────────────────────

def _safe(fn: Any, *args: Any, fallback: Any = None, **kwargs: Any) -> Any:
    """Call *fn* with given arguments; return *fallback* on any exception."""
    try:
        return fn(*args, **kwargs)
    except Exception as exc:  # noqa: BLE001
        logger.error("[EventRouter] %s error: %s", getattr(fn, "__name__", fn), exc)
        return fallback


# ── handlers ──────────────────────────────────────────────────────────────────

def handle_perception(event: dict[str, Any]) -> dict[str, Any]:
    """
    Feed a perception snapshot through the brain and, when targets are present,
    fire a ``target_detected`` swarm event automatically.
    """
    from brain import process_embodied_input  # noqa: PLC0415

    perception = event.get("data", event)
    decision = _safe(process_embodied_input, perception, fallback={"type": "noop"})

    # If vision detected objects, propagate as swarm intercept
    objects = event.get("data", {}).get("objects", [])
    for obj in objects:
        confidence = float(obj.get("confidence", 0.0))
        if confidence >= float(event.get("confidence_threshold", 0.5)):
            pos = obj.get("position") or obj.get("world_position")
            if pos:
                _safe(route_event, {
                    "type":       "swarm",
                    "subtype":    "target_detected",
                    "id":         obj.get("label", "target"),
                    "position":   pos,
                    "confidence": confidence,
                    "label":      obj.get("label", "unknown"),
                })

    return decision or {"type": "noop"}


def handle_swarm(event: dict[str, Any]) -> dict[str, Any]:
    """Delegate to ``brain.process_swarm_event()``."""
    from brain import process_swarm_event  # noqa: PLC0415

    # Flatten: if there is a ``subtype`` field use it as ``type``
    inner = {**event}
    if "subtype" in inner:
        inner["type"] = inner.pop("subtype")

    return _safe(process_swarm_event, inner, fallback={"type": "error", "reason": "swarm handler failed"})


def handle_mission(event: dict[str, Any]) -> dict[str, Any]:
    """Delegate mission actions to the MissionEngine."""
    from mission.engine import get_mission_engine  # noqa: PLC0415

    engine = get_mission_engine()
    action = event.get("action", "status")

    if action == "start":
        mission = event.get("mission", {})
        return _safe(engine.start_mission, mission, fallback={"status": "error"}) or {}
    if action == "stop":
        return _safe(engine.stop_mission, fallback={"status": "error"}) or {}
    if action == "status":
        return _safe(engine.get_status, fallback={}) or {}

    logger.warning("[EventRouter] unknown mission action: %s", action)
    return {"type": "error", "reason": f"unknown mission action: {action}"}


def handle_control(event: dict[str, Any]) -> dict[str, Any]:
    """Handle safety / control plane events."""
    from safety.override import enable_lockdown, disable_lockdown, is_locked_down  # noqa: PLC0415

    action = event.get("action", "")

    if action == "lockdown_enable":
        reason = event.get("reason", "api_request")
        actor  = event.get("actor",  "system")
        _safe(enable_lockdown, reason=reason, actor=actor)
        return {"status": "lockdown_enabled"}

    if action == "lockdown_disable":
        actor = event.get("actor", "system")
        _safe(disable_lockdown, actor=actor)
        return {"status": "lockdown_disabled"}

    if action == "lockdown_status":
        return {"locked": _safe(is_locked_down, fallback=False)}

    logger.warning("[EventRouter] unknown control action: %s", action)
    return {"type": "error", "reason": f"unknown control action: {action}"}


def handle_decision(event: dict[str, Any]) -> dict[str, Any]:
    """
    Route a brain decision to the appropriate actuator subsystem.

    A decision dict may contain:
    * ``drone_command``  → forwarded to the active DroneController
    * ``mission``        → forwarded to the MissionEngine as a start request
    * ``type``           → used for logging / tracing
    """
    decision = event.get("data", event)
    results: dict[str, Any] = {}

    drone_cmd = decision.get("drone_command")
    if drone_cmd:
        try:
            from embodiment.drone_controller import get_drone_controller  # noqa: PLC0415
            ctrl = get_drone_controller()
            action = drone_cmd.get("action", "")
            if action == "rtl":
                _safe(ctrl.return_to_launch)
            elif action == "goto" and "position" in drone_cmd:
                pos = drone_cmd["position"]
                _safe(ctrl.goto, *pos)
            elif action == "land":
                _safe(ctrl.land)
            results["drone_command"] = action
        except ImportError:
            logger.debug("[EventRouter] drone controller not available")

    mission_spec = decision.get("mission")
    if mission_spec:
        results["mission"] = _safe(route_event, {"type": "mission", "action": "start", "mission": mission_spec})

    return results


def handle_nxi(event: dict[str, Any]) -> dict[str, Any]:
    """Direct NXI world-model update — no brain involvement."""
    from nxi.map_engine import get_nxi_map  # noqa: PLC0415

    nxi    = get_nxi_map()
    action = event.get("action", "add_event")

    if action == "update_drone":
        _safe(nxi.update_drone, event["drone_id"], event.get("data", {}))
    elif action == "update_target":
        _safe(nxi.update_target, event["target_id"], event.get("position"))
    elif action == "add_event":
        _safe(nxi.add_event, event.get("data", event))
    elif action == "get_state":
        return _safe(nxi.get_state, fallback={}) or {}

    return {"status": "ok"}


def handle_platform(event: dict[str, Any]) -> dict[str, Any]:
    """Enqueue a live platform event into the ingestion pipeline."""
    from ingestion.stream_ingestor import ingest_event  # noqa: PLC0415

    payload = event.get("data", event)
    _safe(ingest_event, payload)
    return {"status": "queued"}


# ── dispatcher ────────────────────────────────────────────────────────────────

_HANDLERS = {
    "perception": handle_perception,
    "swarm":      handle_swarm,
    "mission":    handle_mission,
    "control":    handle_control,
    "decision":   handle_decision,
    "nxi":        handle_nxi,
    "platform":   handle_platform,
}


def route_event(event: dict[str, Any]) -> dict[str, Any]:
    """
    Route an event dict to the correct subsystem handler.

    Parameters
    ----------
    event:
        Must contain ``"type"`` key.  Additional keys are handler-specific.

    Returns
    -------
    dict
        Handler response, or ``{"type": "error", "reason": "..."}`` on failure.
    """
    if not isinstance(event, dict):
        logger.error("[EventRouter] event must be a dict, got %s", type(event).__name__)
        return {"type": "error", "reason": "invalid event format"}

    event_type = event.get("type", "")
    handler = _HANDLERS.get(event_type)

    if handler is None:
        logger.warning("[EventRouter] unrecognised event type: %s", event_type)
        return {"type": "error", "reason": f"unknown event type: {event_type}"}

    logger.debug("[EventRouter] routing %s event", event_type)
    return _safe(handler, event, fallback={"type": "error", "reason": "handler raised exception"})
