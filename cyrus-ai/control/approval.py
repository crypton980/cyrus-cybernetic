"""
CYRUS Human-in-the-Loop Approval System.

Provides a gate for high-risk external actions (e.g. webhook calls, external
API calls) that require explicit operator approval before execution.

Design
------
* Pending actions are stored in a module-level dict (in-process, volatile).
  For multi-node clusters, Redis-backed persistence is recommended; this
  implementation gracefully works in single-node mode without Redis.
* Each pending action has a UUID ``action_id`` returned to the caller.
* An operator must call ``approve_action()`` or ``reject_action()`` via the
  dashboard API before the action can proceed.
* Approved actions are removed from the pending store and returned to the
  caller.  Rejected actions are also removed and flagged with an error.
* A TTL (``CYRUS_APPROVAL_TTL_SEC``) automatically expires stale pending
  actions to prevent the store from growing unboundedly.

Configuration (env vars)
------------------------
CYRUS_REQUIRE_APPROVAL  → comma-separated action types that need approval
                          (default: "webhook")
CYRUS_APPROVAL_TTL_SEC  → seconds before a pending action auto-expires
                          (default: 3600)
"""

from __future__ import annotations

import logging
import os
import threading
import time
import uuid
from dataclasses import dataclass, asdict, field
from typing import Any

logger = logging.getLogger(__name__)

# ── Configuration ──────────────────────────────────────────────────────────────

_APPROVAL_TTL: int = int(os.getenv("CYRUS_APPROVAL_TTL_SEC", "3600"))

# Action types that require human approval before execution
_RAW_REQUIRE = os.getenv("CYRUS_REQUIRE_APPROVAL", "webhook")
REQUIRE_APPROVAL: frozenset[str] = frozenset(
    x.strip() for x in _RAW_REQUIRE.split(",") if x.strip()
)


# ── Data model ─────────────────────────────────────────────────────────────────

@dataclass
class PendingAction:
    action_id: str
    action_type: str
    payload: dict[str, Any]
    requested_at: float = field(default_factory=time.time)
    status: str = "pending"          # pending | approved | rejected | expired

    def is_expired(self) -> bool:
        return time.time() - self.requested_at > _APPROVAL_TTL

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["age_sec"] = round(time.time() - self.requested_at, 1)
        d["expires_in_sec"] = max(0, round(_APPROVAL_TTL - (time.time() - self.requested_at), 1))
        return d


# ── State ──────────────────────────────────────────────────────────────────────

_pending: dict[str, PendingAction] = {}
_lock: threading.Lock = threading.Lock()


# ── Helpers ────────────────────────────────────────────────────────────────────

def _evict_expired() -> None:
    """Remove expired actions from the pending store (called on writes)."""
    expired = [k for k, v in _pending.items() if v.is_expired()]
    for k in expired:
        _pending[k].status = "expired"
        del _pending[k]
        logger.info("[Approval] action_id=%s expired and evicted", k)


# ── Public API ─────────────────────────────────────────────────────────────────


def needs_approval(action_type: str) -> bool:
    """Return True if *action_type* requires human approval."""
    return action_type in REQUIRE_APPROVAL


def request_approval(
    action_type: str,
    payload: dict[str, Any],
    action_id: str | None = None,
) -> dict[str, Any]:
    """
    Register an action for human approval.

    Parameters
    ----------
    action_type : str
        The action identifier (e.g. ``"webhook"``).
    payload : dict
        The full action payload to be approved.
    action_id : str | None
        Optional caller-supplied ID.  A UUID is generated when omitted.

    Returns
    -------
    dict with keys:
        ``status``    — always ``"pending"``
        ``action_id`` — the ID callers need to poll or approve/reject
        ``message``   — human-readable status
    """
    action_id = action_id or str(uuid.uuid4())

    with _lock:
        _evict_expired()
        _pending[action_id] = PendingAction(
            action_id=action_id,
            action_type=action_type,
            payload=payload,
        )

    logger.info(
        "[Approval] action_id=%s type=%s registered for approval",
        action_id,
        action_type,
    )
    return {
        "status": "pending",
        "action_id": action_id,
        "message": (
            f"Action '{action_type}' requires human approval. "
            f"Approve or reject via POST /control/approve/{action_id}"
        ),
    }


def approve_action(action_id: str) -> dict[str, Any] | None:
    """
    Approve a pending action and return its payload.

    The action is removed from the pending store and returned.
    Returns ``None`` if the action ID is unknown or already resolved.
    """
    with _lock:
        action = _pending.pop(action_id, None)
        if action is None:
            return None
        if action.is_expired():
            logger.warning("[Approval] action_id=%s was expired at approval time", action_id)
            return None
        action.status = "approved"

    logger.info("[Approval] action_id=%s approved", action_id)
    return action.to_dict()


def reject_action(action_id: str, reason: str = "rejected by operator") -> bool:
    """
    Reject a pending action.

    Returns True if the action was found and rejected, False otherwise.
    """
    with _lock:
        action = _pending.pop(action_id, None)
        if action is None:
            return False
        action.status = "rejected"

    logger.info("[Approval] action_id=%s rejected (%s)", action_id, reason)
    return True


def get_approval(action_id: str) -> dict[str, Any] | None:
    """Return the pending action dict, or None if not found / expired."""
    with _lock:
        action = _pending.get(action_id)
        if action is None:
            return None
        if action.is_expired():
            del _pending[action_id]
            return None
        return action.to_dict()


def list_pending_approvals() -> list[dict[str, Any]]:
    """Return all currently pending (non-expired) actions."""
    with _lock:
        _evict_expired()
        return [v.to_dict() for v in _pending.values()]
