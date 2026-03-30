"""
CYRUS LearningAgent — adaptive behaviour update specialist.

Translates a feedback payload into a forward-looking behavioural strategy
by delegating to `update_behavior()` from the learning_engine module.
This agent does not modify memory directly — it returns the strategy
directive for upstream consumers.
"""

from __future__ import annotations

import logging
from typing import Any

from agents.base_agent import BaseAgent
from learning_engine import update_behavior

logger = logging.getLogger(__name__)


class LearningAgent(BaseAgent):
    """
    Computes an adaptive behavioural strategy from a feedback signal.

    Returns one of three strategies:
        ``adjust``    — rating < 3 — actively change behaviour
        ``observe``   — rating 3   — collect more data
        ``reinforce`` — rating ≥ 4 — amplify the pattern
    """

    def __init__(self) -> None:
        super().__init__("learning")

    def process(
        self,
        feedback: dict[str, Any],
        **kwargs: Any,
    ) -> dict[str, Any]:
        """
        Derive a behavioural strategy from a feedback payload.

        Parameters
        ----------
        feedback : dict
            Must contain at least ``"rating"`` (float 1–5).
            Optional keys: ``"input"``, ``"response"``, ``"userId"``.

        Returns
        -------
        dict with key ``"strategy"`` ("adjust" | "observe" | "reinforce")
        and ``"rating"`` (float).
        """
        try:
            result = update_behavior(feedback)
            rating = float(feedback.get("rating", 3))
            self._logger.info(
                "[LearningAgent] strategy=%s rating=%.1f",
                result.get("strategy"),
                rating,
            )
            return {**result, "rating": rating}
        except Exception as exc:  # noqa: BLE001
            return self._error_result("learning strategy computation failed", exc)
