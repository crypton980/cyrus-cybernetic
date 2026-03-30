"""
CYRUS Learning Engine — reinforcement-style feedback processing.

Each interaction is persisted to the vector memory store with a numeric
rating.  The engine classifies feedback quality, tags entries accordingly,
and returns an action directive that upstream systems can act upon.

Feedback taxonomy
-----------------
  poor    (rating < 3) → "adjust"   — pattern should be corrected
  neutral (rating = 3) → "observe"  — keep monitoring
  good    (rating > 3) → "reinforce" — pattern should be amplified

Interaction logging
-------------------
Every store_interaction() call produces a structured memory entry that CYRUS
can retrieve later during context-aware decision making.
"""

import logging
from typing import Any

from memory_service import store_memory

logger = logging.getLogger(__name__)

# ── Feedback classification ───────────────────────────────────────────────────

POOR_THRESHOLD = 3
GOOD_THRESHOLD = 3


def classify_feedback(rating: float) -> str:
    """Translate a numeric rating into a learning directive."""
    if rating < POOR_THRESHOLD:
        return "adjust"
    if rating == GOOD_THRESHOLD:
        return "observe"
    return "reinforce"


def learn_from_feedback(feedback: dict[str, Any]) -> dict[str, Any]:
    """
    Process a feedback entry and store it in memory.

    Expected input:
        {
            "input":    "<original user input>",
            "response": "<CYRUS response>",
            "rating":   <float 1-5>,
            "userId":   "<optional user id>",
            "context":  "<optional context tags>"
        }

    Returns:
        { "action": "adjust"|"observe"|"reinforce", "memoryId": "<uuid>" }
    """
    rating: float = float(feedback.get("rating", 3))
    action = classify_feedback(rating)

    text = (
        f"INPUT: {feedback.get('input', '')}\n"
        f"RESPONSE: {feedback.get('response', '')}\n"
        f"RATING: {rating}\n"
        f"ACTION: {action}"
    )

    metadata: dict[str, Any] = {
        "type": "feedback",
        "action": action,
        "rating": rating,
    }
    if feedback.get("userId"):
        metadata["userId"] = feedback["userId"]
    if feedback.get("context"):
        metadata["context"] = feedback["context"]

    memory_id = store_memory(text, metadata)
    logger.info("[Learning] feedback stored action=%s rating=%.1f id=%s", action, rating, memory_id)

    return {"action": action, "memoryId": memory_id}


def store_interaction(
    user_input: str,
    cyrus_response: str,
    metadata: dict[str, Any] | None = None,
) -> str:
    """Log every CYRUS interaction for future context retrieval."""
    text = f"USER: {user_input}\nCYRUS: {cyrus_response}"
    meta: dict[str, Any] = {"type": "interaction", **(metadata or {})}
    memory_id = store_memory(text, meta)
    logger.info("[Learning] interaction stored id=%s", memory_id)
    return memory_id
