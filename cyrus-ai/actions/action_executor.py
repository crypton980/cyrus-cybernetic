"""
CYRUS Action Executor — extensible external action interface.

Enables the intelligence system to trigger real-world effects based on
mission outputs and fused situational awareness.

Built-in action types
----------------------
log         — write payload to the structured logger
alert       — emit a high-visibility WARNING log
store       — persist payload to ChromaDB memory
metric      — log a custom metric entry to the metrics tracker
webhook     — POST payload to a configured webhook URL (requires
              CYRUS_WEBHOOK_URL env var or per-call url in payload)

Extension mechanism
-------------------
Call ``register_action_handler(action_type, handler_fn)`` to add new
action types at startup or via plugins.  Handlers receive:

    handler(action_type: str, payload: dict) -> dict

and must return a dict with at minimum ``{"status": "executed"}`` or
``{"status": "error", "reason": "..."}``..

Design principles
------------------
* `execute_action()` never raises — all exceptions are caught and
  returned as ``{"status": "error", ...}``.
* Built-in handlers are registered at module import time.
* Thread-safe handler registry.
"""

from __future__ import annotations

import logging
import os
import threading
import urllib.error
import urllib.request
import json
from dataclasses import dataclass, asdict
from typing import Any, Callable

logger = logging.getLogger(__name__)

# ── Data structure ────────────────────────────────────────────────────────────


@dataclass
class ActionResult:
    """Result of executing a single action."""

    action: str
    status: str  # "executed" | "error" | "skipped"
    payload_summary: str = ""
    detail: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


# ── Handler registry ──────────────────────────────────────────────────────────

ActionHandler = Callable[[str, dict[str, Any]], dict[str, Any]]

_handlers: dict[str, ActionHandler] = {}
_registry_lock: threading.Lock = threading.Lock()


def register_action_handler(action_type: str, handler: ActionHandler) -> None:
    """
    Register a custom action handler.

    Overwrites any existing handler for ``action_type``.

    Parameters
    ----------
    action_type : str
        Unique action type identifier (e.g. ``"send_email"``).
    handler : Callable[[str, dict], dict]
        Function that executes the action.
    """
    with _registry_lock:
        _handlers[action_type] = handler
    logger.info("[ActionExecutor] registered handler for action_type=%s", action_type)


def list_action_types() -> list[str]:
    """Return all registered action type identifiers."""
    with _registry_lock:
        return list(_handlers.keys())


# ── Built-in handlers ──────────────────────────────────────────────────────────


def _handle_log(action: str, payload: dict[str, Any]) -> dict[str, Any]:
    logger.info("[Action:log] %s", payload)
    return {"status": "executed", "detail": "logged"}


def _handle_alert(action: str, payload: dict[str, Any]) -> dict[str, Any]:
    logger.warning("[Action:ALERT] %s", payload)
    return {"status": "executed", "detail": "alert emitted"}


def _handle_store(action: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Persist payload to ChromaDB long-term memory."""
    try:
        from memory_service import store_memory  # noqa: PLC0415

        text = payload.get("text") or json.dumps(payload, default=str)
        metadata = payload.get("metadata") or {"type": "action_store"}
        store_memory(text, metadata)
        return {"status": "executed", "detail": "stored to memory"}
    except Exception as exc:  # noqa: BLE001
        return {"status": "error", "reason": str(exc)}


def _handle_metric(action: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Log a custom metric entry."""
    try:
        from metrics.tracker import log_metric  # noqa: PLC0415

        log_metric(payload)
        return {"status": "executed", "detail": "metric logged"}
    except Exception as exc:  # noqa: BLE001
        return {"status": "error", "reason": str(exc)}


def _is_private_host(url: str) -> bool:
    """Return True if the URL resolves to a private/loopback IP range.

    Blocks SSRF to internal infrastructure even when the env URL is
    correctly set to an https:// address that could resolve to a private IP.
    Checked ranges: 127.x, 10.x, 172.16-31.x, 192.168.x, ::1 (IPv6 loopback).
    """
    import ipaddress  # noqa: PLC0415
    import urllib.parse  # noqa: PLC0415
    import socket  # noqa: PLC0415

    try:
        host = urllib.parse.urlparse(url).hostname or ""
        if not host:
            return True  # can't parse → reject
        addr = ipaddress.ip_address(socket.gethostbyname(host))
        return addr.is_private or addr.is_loopback or addr.is_link_local
    except Exception:  # noqa: BLE001
        return False  # DNS failure is handled later by urlopen


class _NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    """HTTP handler that disables all redirect following.

    Prevents redirect-based SSRF bypass where an attacker-controlled
    server redirects to an internal address after passing the initial
    IP validation.
    """

    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: ANN001,ANN201
        raise urllib.error.HTTPError(newurl, code, f"Redirect blocked: {newurl}", headers, fp)


def _handle_webhook(action: str, payload: dict[str, Any]) -> dict[str, Any]:
    """POST payload to a webhook URL.

    The destination URL must be configured via the CYRUS_WEBHOOK_URL
    environment variable.  Per-request URL overrides from the payload are
    intentionally NOT supported to prevent SSRF.

    Additional SSRF protections:
    * Only http:// and https:// schemes are accepted.
    * The resolved host must not be a private, loopback, or link-local address.
    * HTTP redirects are disabled to prevent redirect-based SSRF bypass.
    """
    env_url = os.getenv("CYRUS_WEBHOOK_URL", "").strip()
    if not env_url:
        return {"status": "error", "reason": "CYRUS_WEBHOOK_URL is not configured"}

    # Validate scheme to allow only https/http (block file://, ftp://, etc.)
    if not (env_url.startswith("https://") or env_url.startswith("http://")):
        return {"status": "error", "reason": "CYRUS_WEBHOOK_URL must use http or https scheme"}

    # Block private/loopback destinations
    if _is_private_host(env_url):
        return {"status": "error", "reason": "CYRUS_WEBHOOK_URL must not resolve to a private IP"}

    body = json.dumps(payload, default=str).encode()
    req = urllib.request.Request(
        env_url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        opener = urllib.request.build_opener(_NoRedirectHandler)
        with opener.open(req, timeout=5) as resp:  # noqa: S310
            status_code = resp.getcode()
        return {"status": "executed", "detail": f"webhook HTTP {status_code}"}
    except Exception as exc:  # noqa: BLE001
        return {"status": "error", "reason": str(exc)}


# Register built-ins at import time
register_action_handler("log", _handle_log)
register_action_handler("alert", _handle_alert)
register_action_handler("store", _handle_store)
register_action_handler("metric", _handle_metric)
register_action_handler("webhook", _handle_webhook)


# ── Public API ─────────────────────────────────────────────────────────────────


def execute_action(
    action: str,
    payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Execute a named action with the given payload.

    Parameters
    ----------
    action : str
        Action type identifier (must be registered).
    payload : dict | None
        Arbitrary data passed to the handler.

    Returns
    -------
    dict — serialised ActionResult:
        ``action``          — echo of the requested action type
        ``status``          — ``"executed"`` | ``"error"`` | ``"skipped"``
        ``payload_summary`` — truncated payload preview
        ``detail``          — handler-specific description
    """
    payload = payload or {}
    payload_summary = str(payload)[:120]

    # ── HITL Approval gate ────────────────────────────────────────────────────
    # High-risk actions (e.g. webhook) require explicit human approval when
    # CYRUS_REQUIRE_APPROVAL is configured.
    try:
        from control.approval import needs_approval, request_approval  # noqa: PLC0415
        if needs_approval(action):
            approval_response = request_approval(action, payload)
            logger.info(
                "[ActionExecutor] action=%s gated for HITL approval action_id=%s",
                action,
                approval_response.get("action_id"),
            )
            return {
                "action": action,
                "status": "pending_approval",
                "payload_summary": payload_summary,
                "detail": approval_response.get("message", "Awaiting human approval"),
                "action_id": approval_response.get("action_id"),
            }
    except Exception:  # noqa: BLE001
        pass  # approval module unavailable — proceed without gate

    with _registry_lock:
        handler = _handlers.get(action)

    if handler is None:
        logger.warning("[ActionExecutor] unknown action_type=%s", action)
        return ActionResult(
            action=action,
            status="skipped",
            payload_summary=payload_summary,
            detail=f"No handler registered for action_type '{action}'.",
        ).to_dict()

    try:
        result = handler(action, payload)
        status = result.get("status", "executed")
        detail = result.get("detail") or result.get("reason", "")
        logger.info(
            "[ActionExecutor] action=%s status=%s detail=%s",
            action,
            status,
            detail,
        )
        return ActionResult(
            action=action,
            status=status,
            payload_summary=payload_summary,
            detail=detail,
        ).to_dict()
    except Exception as exc:  # noqa: BLE001
        logger.exception("[ActionExecutor] handler for '%s' raised", action)
        return ActionResult(
            action=action,
            status="error",
            payload_summary=payload_summary,
            detail=str(exc),
        ).to_dict()
