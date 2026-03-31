"""
CYRUS Human Interaction System

Manages natural multi-turn conversations with individual users.  Each user
has an isolated conversation memory that persists for the session lifetime.

Features
--------
* Per-user conversation history (ring-buffer, configurable depth)
* Intent detection: mission, status, emergency, greeting, question, command
* Adaptive behavior modes based on interaction history
* Integration with the CYRUS brain (brain.process_input) for LLM-backed replies
* Integration with memory_service to persist notable interactions
* Voice input support (text extracted upstream via STT; handled here as text)

Behavior modes
--------------
normal      → standard helpful replies
adaptive    → extra context from past interactions injected into brain call
focused     → terse, operational replies (active mission context)
emergency   → minimal-latency, safety-prioritized replies

Configuration (env vars)
------------------------
CYRUS_INTERACTION_MAX_HISTORY    → max messages per user (default: 20)
CYRUS_INTERACTION_ADAPTIVE_AFTER → interactions before adaptive mode (default: 5)
"""

from __future__ import annotations

import logging
import os
import time
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Any

logger = logging.getLogger(__name__)

_MAX_HISTORY: int         = int(os.getenv("CYRUS_INTERACTION_MAX_HISTORY", "20"))
_ADAPTIVE_AFTER: int      = int(os.getenv("CYRUS_INTERACTION_ADAPTIVE_AFTER", "5"))


class BehaviorMode(str, Enum):
    NORMAL    = "normal"
    ADAPTIVE  = "adaptive"
    FOCUSED   = "focused"
    EMERGENCY = "emergency"


# ── Intent keywords (lightweight, no external NLP library required) ──────────

_INTENT_PATTERNS: dict[str, list[str]] = {
    "emergency": ["emergency", "help", "crash", "abort", "stop now", "mayday", "danger"],
    "mission":   ["mission", "fly", "navigate", "scan", "takeoff", "land", "patrol", "survey"],
    "status":    ["status", "state", "where", "position", "battery", "altitude", "how are"],
    "greeting":  ["hello", "hi", "hey", "good morning", "good afternoon", "good evening"],
    "command":   ["arm", "disarm", "rtl", "return", "hover", "go to", "move to"],
}


@dataclass
class InteractionRecord:
    user_id:    str
    text:       str
    role:       str          # "user" | "assistant"
    intent:     str = "unknown"
    timestamp:  float = field(default_factory=time.time)
    mode:       str = BehaviorMode.NORMAL.value

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class HumanInteraction:
    """
    Stateful human–CYRUS conversation manager.

    One instance is expected to be shared for the process lifetime.
    User state is kept in memory and optionally persisted to CYRUS memory_service.
    """

    def __init__(self) -> None:
        self._histories: dict[str, list[InteractionRecord]] = {}
        self._interaction_counts: dict[str, int] = {}
        self._modes: dict[str, BehaviorMode] = {}

    # ── Public API ─────────────────────────────────────────────────────────────

    def process_input(
        self,
        user_id: str,
        text: str,
        context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Process a user utterance and return a structured response.

        Parameters
        ----------
        user_id : unique user identifier
        text    : raw text input (from keyboard or STT)
        context : optional ambient context (e.g. drone telemetry, mission state)

        Returns
        -------
        dict with keys: response (str), intent (str), mode (str), user_id (str)
        """
        text = text.strip()
        if not text:
            return self._make_response(user_id, "I didn't catch that.", "unknown")

        intent = self._detect_intent(text)
        mode   = self.adapt_behavior(user_id, intent)

        # Build the reply
        response = self._generate_response(user_id, text, intent, mode, context or {})

        # Store in history
        user_rec  = InteractionRecord(user_id=user_id, text=text, role="user", intent=intent, mode=mode.value)
        agent_rec = InteractionRecord(user_id=user_id, text=response, role="assistant", intent=intent, mode=mode.value)
        self._append_history(user_id, user_rec)
        self._append_history(user_id, agent_rec)
        self._interaction_counts[user_id] = self._interaction_counts.get(user_id, 0) + 1

        # Persist notable interactions to CYRUS memory
        if intent in ("mission", "emergency", "command"):
            self._persist_memory(user_id, text, response, intent)

        logger.info(
            "[HumanInteraction] user=%s intent=%s mode=%s",
            user_id, intent, mode.value,
        )

        return self._make_response(user_id, response, intent, mode)

    def adapt_behavior(
        self,
        user_id: str,
        current_intent: str = "unknown",
    ) -> BehaviorMode:
        """
        Select the appropriate behavior mode for this user.

        Priority (highest first):
        1. Emergency intent → EMERGENCY mode
        2. Active mission → FOCUSED mode
        3. Enough history → ADAPTIVE mode
        4. Default → NORMAL mode
        """
        if current_intent == "emergency":
            mode = BehaviorMode.EMERGENCY
        elif self._mission_active():
            mode = BehaviorMode.FOCUSED
        elif self._interaction_counts.get(user_id, 0) >= _ADAPTIVE_AFTER:
            mode = BehaviorMode.ADAPTIVE
        else:
            mode = BehaviorMode.NORMAL

        self._modes[user_id] = mode
        return mode

    def get_history(self, user_id: str, last_n: int = 10) -> list[dict[str, Any]]:
        """Return the last *last_n* interaction records for a user."""
        recs = self._histories.get(user_id, [])
        return [r.to_dict() for r in recs[-last_n:]]

    def clear_history(self, user_id: str) -> None:
        """Erase the conversation history for a user."""
        self._histories.pop(user_id, None)
        self._interaction_counts.pop(user_id, None)
        self._modes.pop(user_id, None)
        logger.info("[HumanInteraction] cleared history for user=%s", user_id)

    def user_stats(self, user_id: str) -> dict[str, Any]:
        return {
            "user_id":     user_id,
            "total_turns": self._interaction_counts.get(user_id, 0),
            "mode":        self._modes.get(user_id, BehaviorMode.NORMAL).value,
            "history_len": len(self._histories.get(user_id, [])),
        }

    # ── Response generation ────────────────────────────────────────────────────

    def _generate_response(
        self,
        user_id: str,
        text: str,
        intent: str,
        mode: BehaviorMode,
        context: dict[str, Any],
    ) -> str:
        """
        Generate a response using the CYRUS brain when available,
        falling back to rule-based replies.
        """
        # Emergency — always immediate, no LLM latency
        if mode == BehaviorMode.EMERGENCY:
            return self._emergency_response(text)

        # Try the CYRUS brain (LLM-backed)
        try:
            from brain import process_input  # noqa: PLC0415
            history = self._histories.get(user_id, [])
            history_text = "\n".join(
                f"{r.role.upper()}: {r.text}" for r in history[-6:]
            )
            prompt = (
                f"[Context]\n{self._format_context(context, mode)}\n\n"
                f"[History]\n{history_text}\n\n"
                f"USER: {text}"
            )
            result = process_input(prompt)
            reply = (
                result.get("response")
                or result.get("answer")
                or result.get("output")
            )
            if reply and isinstance(reply, str) and len(reply) > 3:
                return reply.strip()
        except Exception as exc:  # noqa: BLE001
            logger.debug("[HumanInteraction] brain unavailable: %s", exc)

        # Fallback: rule-based
        return self._rule_response(text, intent, context, mode)

    def _rule_response(
        self,
        text: str,
        intent: str,
        context: dict[str, Any],
        mode: BehaviorMode,
    ) -> str:
        """Lightweight rule-based fallback replies."""
        terse = mode == BehaviorMode.FOCUSED

        if intent == "greeting":
            return "CYRUS online. Systems nominal." if terse else "Hello! I'm CYRUS. All systems are operational. How can I assist?"
        if intent == "status":
            drone = context.get("drone", {})
            state = drone.get("state", "unknown")
            alt   = drone.get("alt_m", 0.0)
            batt  = drone.get("battery_pct", 100.0)
            if terse:
                return f"State: {state} | Alt: {alt:.1f}m | Batt: {batt:.0f}%"
            return (
                f"Current state: {state}. Altitude: {alt:.1f} m. Battery: {batt:.0f}%."
            )
        if intent == "mission":
            if terse:
                return "Mission ready. Provide mission parameters."
            return "Mission execution system is ready. Please provide the mission parameters."
        if intent == "command":
            return "Command received. Standby."
        return "Command received and logged." if terse else "I've received your input. How can I assist further?"

    def _emergency_response(self, text: str) -> str:
        text_lower = text.lower()
        if "abort" in text_lower or "stop" in text_lower:
            return "ABORT acknowledged. Initiating emergency stop. RTL activated."
        if "crash" in text_lower:
            return "CRASH alert received. Triggering emergency protocol."
        return "EMERGENCY acknowledged. All non-critical operations halted. Awaiting instructions."

    # ── Intent detection ───────────────────────────────────────────────────────

    @staticmethod
    def _detect_intent(text: str) -> str:
        lower = text.lower()
        for intent, keywords in _INTENT_PATTERNS.items():
            if any(kw in lower for kw in keywords):
                return intent
        return "unknown"

    # ── Helpers ────────────────────────────────────────────────────────────────

    def _append_history(self, user_id: str, record: InteractionRecord) -> None:
        if user_id not in self._histories:
            self._histories[user_id] = []
        buf = self._histories[user_id]
        buf.append(record)
        # Rolling window
        if len(buf) > _MAX_HISTORY:
            self._histories[user_id] = buf[-_MAX_HISTORY:]

    @staticmethod
    def _format_context(context: dict[str, Any], mode: BehaviorMode) -> str:
        if not context:
            return "No ambient context."
        parts: list[str] = []
        drone = context.get("drone", {})
        if drone:
            parts.append(
                f"Drone: state={drone.get('state','?')} "
                f"alt={drone.get('alt_m',0):.1f}m "
                f"batt={drone.get('battery_pct',100):.0f}%"
            )
        objs = context.get("objects", [])
        if objs:
            labels = [o.get("label", "?") for o in objs[:5]]
            parts.append(f"Vision: {len(objs)} objects detected ({', '.join(labels)})")
        return "\n".join(parts) if parts else "Environment nominal."

    @staticmethod
    def _mission_active() -> bool:
        try:
            from mission_control.controller import get_controller  # noqa: PLC0415
            return bool(get_controller().active_missions())
        except Exception:  # noqa: BLE001
            return False

    @staticmethod
    def _persist_memory(user_id: str, text: str, response: str, intent: str) -> None:
        try:
            from memory_service import store_memory  # noqa: PLC0415
            store_memory(
                text=f"User {user_id} [{intent}]: {text[:200]}",
                metadata={"source": "human_interaction", "user_id": user_id, "intent": intent},
            )
        except Exception:  # noqa: BLE001
            pass

    @staticmethod
    def _make_response(
        user_id: str,
        response: str,
        intent: str,
        mode: BehaviorMode | None = None,
    ) -> dict[str, Any]:
        return {
            "user_id":  user_id,
            "response": response,
            "intent":   intent,
            "mode":     (mode.value if mode else BehaviorMode.NORMAL.value),
            "timestamp": time.time(),
        }


# ── Module-level singleton ─────────────────────────────────────────────────────

_interaction_singleton: HumanInteraction | None = None


def get_interaction() -> HumanInteraction:
    """Return the process-level HumanInteraction singleton."""
    global _interaction_singleton  # noqa: PLW0603
    if _interaction_singleton is None:
        _interaction_singleton = HumanInteraction()
    return _interaction_singleton
