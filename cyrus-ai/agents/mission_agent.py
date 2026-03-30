"""
CYRUS MissionAgent — mission planning and objective decomposition specialist.

Produces a structured mission plan by delegating to the existing planner
module (which already has intent-specific step lists and step descriptions).
The agent adds mission-specific metadata on top of the generic plan.
"""

from __future__ import annotations

import logging
from typing import Any

from agents.base_agent import BaseAgent
from planner import create_plan, describe_plan

logger = logging.getLogger(__name__)


class MissionAgent(BaseAgent):
    """
    Decomposes an input into a structured mission execution plan.

    Uses the intent-aware `create_plan()` from the planner module so that
    different input types get appropriately tailored step sequences.
    """

    def __init__(self) -> None:
        super().__init__("mission")

    def process(
        self,
        input_text: str,
        intent: str | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """
        Build a mission plan for the given input.

        Parameters
        ----------
        input_text : str
            Raw operator input.
        intent : str | None
            Pre-classified intent from the brain / analysis agent.
            When None, the planner uses the default universal plan.

        Returns
        -------
        dict with keys:
            ``mission_plan``   — list[str] ordered step names
            ``plan_detail``    — list[{step, description}]
            ``intent``         — the intent used for planning
            ``objective``      — short human-readable objective statement
        """
        try:
            plan = create_plan(input_text, intent=intent)
            detail = describe_plan(plan)
            objective = self._derive_objective(input_text, intent)
            self._logger.info(
                "[MissionAgent] plan built steps=%d intent=%s",
                len(plan),
                intent or "default",
            )
            return {
                "mission_plan": plan,
                "plan_detail": detail,
                "intent": intent or "response",
                "objective": objective,
            }
        except Exception as exc:  # noqa: BLE001
            return self._error_result("mission planning failed", exc)

    @staticmethod
    def _derive_objective(input_text: str, intent: str | None) -> str:
        """Produce a short human-readable objective from the input."""
        truncated = input_text[:120].strip()
        suffix = "…" if len(input_text) > 120 else ""
        intent_label = intent or "respond to operator"
        return f"[{intent_label}] {truncated}{suffix}"
