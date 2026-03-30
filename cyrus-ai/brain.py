"""
CYRUS Brain — decision engine and context-aware intelligence router.

The brain receives raw input, retrieves relevant memories from the vector
store, classifies the intent, and returns a structured decision payload that
the Node.js backend can act upon.

Decision types
--------------
  mission   — operational objective detected
  analysis  — analytical/investigative request
  training  — knowledge ingestion command
  memory    — explicit memory retrieval request
  response  — general interaction (fallback)

Each decision carries:
  - type          : decision class
  - intent        : detected keyword that triggered the class
  - context       : top-K semantically similar memories
  - confidence    : distance-based confidence (0.0–1.0, higher is more confident)
  - recommendation: plain-language suggested next action
"""

import logging
from typing import Any

from memory_service import query_memory

logger = logging.getLogger(__name__)


# ── Intent classification rules ───────────────────────────────────────────────

_INTENT_MAP: list[tuple[list[str], str]] = [
    (["mission", "deploy", "objective", "operation", "execute", "target"], "mission"),
    (["analyze", "analyse", "assess", "evaluate", "report", "intelligence"], "analysis"),
    (["train", "ingest", "learn", "upload", "document", "dataset"], "training"),
    (["remember", "recall", "retrieve", "what did", "find memory", "search memory"], "memory"),
]


def _classify_intent(text: str) -> tuple[str, str]:
    """Return (decision_type, matched_keyword)."""
    lower = text.lower()
    for keywords, decision_type in _INTENT_MAP:
        for kw in keywords:
            if kw in lower:
                return decision_type, kw
    return "response", "general"


def _compute_confidence(distances: list[float]) -> float:
    """Convert average cosine distance to a 0.0–1.0 confidence score."""
    if not distances:
        return 0.0
    avg_dist = sum(distances) / len(distances)
    # cosine distance is in [0, 2]; convert to similarity
    return max(0.0, min(1.0, 1.0 - avg_dist / 2.0))


_RECOMMENDATION_MAP = {
    "mission": "Initiate mission planning sequence with retrieved operational context.",
    "analysis": "Apply analytical framework to retrieved intelligence context.",
    "training": "Queue knowledge ingestion pipeline with provided document source.",
    "memory": "Surface retrieved memory entries for operator review.",
    "response": "Synthesize contextual response using retrieved memory as grounding.",
}


# ── Public interface ──────────────────────────────────────────────────────────

def process_input(input_text: str, n_context: int = 5) -> dict[str, Any]:
    """
    Core decision function.

    Parameters
    ----------
    input_text : str
        Raw user / system input.
    n_context : int
        Number of memory entries to retrieve for context.

    Returns
    -------
    dict with keys: type, intent, context, confidence, recommendation
    """
    decision_type, intent = _classify_intent(input_text)

    memory_results = query_memory(input_text, n_results=n_context)

    # Extract distances from results for confidence computation
    raw_distances: list[float] = []
    if memory_results.get("distances") and memory_results["distances"]:
        raw_distances = memory_results["distances"][0] or []

    confidence = _compute_confidence(raw_distances)

    logger.info(
        "[Brain] input=%r type=%s intent=%s confidence=%.2f",
        input_text[:80],
        decision_type,
        intent,
        confidence,
    )

    return {
        "type": decision_type,
        "intent": intent,
        "context": memory_results,
        "confidence": confidence,
        "recommendation": _RECOMMENDATION_MAP[decision_type],
    }
