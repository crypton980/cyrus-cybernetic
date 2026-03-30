"""
CYRUS Planner — multi-step execution planning engine.

Given a classified intent or raw input, the planner produces an ordered
list of steps that the brain and tool-execution layer will walk through.

The plan is deterministic (no LLM call) so it is fast and always available,
even when the OpenAI key is absent.  It serves as the skeleton that the LLM
reasoning layer fills with context and decisions.
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

# ── Step registry ──────────────────────────────────────────────────────────────

# Each plan is a list of human-readable step names.  The steps are consumed by
# the brain / tool-execution layer in Node.js and the autonomy loop.

_PLANS: dict[str, list[str]] = {
    "mission": [
        "analyze_input",
        "retrieve_memory",
        "reason_decision",
        "build_execution_plan",
        "execute_action",
        "store_outcome",
        "evaluate_result",
    ],
    "analysis": [
        "analyze_input",
        "retrieve_memory",
        "reason_decision",
        "synthesize_intelligence",
        "store_outcome",
        "evaluate_result",
    ],
    "training": [
        "analyze_input",
        "validate_source",
        "ingest_document",
        "index_knowledge",
        "verify_ingestion",
    ],
    "memory": [
        "analyze_input",
        "retrieve_memory",
        "rank_results",
        "surface_findings",
    ],
    "response": [
        "analyze_input",
        "retrieve_memory",
        "reason_decision",
        "formulate_response",
        "store_outcome",
    ],
}

_DEFAULT_PLAN: list[str] = [
    "analyze_input",
    "retrieve_memory",
    "reason_decision",
    "execute_action",
    "evaluate_result",
]


# ── Public interface ───────────────────────────────────────────────────────────

def create_plan(input_text: str, intent: str | None = None) -> list[str]:
    """
    Return an ordered list of execution steps for the given intent.

    Parameters
    ----------
    input_text : str
        Raw input (used for logging / future dynamic planning).
    intent : str | None
        Pre-classified intent key.  When None the default plan is returned.

    Returns
    -------
    list[str]  Ordered step names.
    """
    plan = _PLANS.get(intent or "", _DEFAULT_PLAN)
    logger.info("[Planner] intent=%s steps=%d", intent or "default", len(plan))
    return plan


def describe_plan(plan: list[str]) -> list[dict[str, Any]]:
    """
    Annotate each step with a short description for operator visibility.
    """
    _DESCRIPTIONS: dict[str, str] = {
        "analyze_input": "Parse and tokenize the incoming request.",
        "retrieve_memory": "Fetch semantically similar past memories.",
        "reason_decision": "Apply LLM reasoning over input and memory context.",
        "build_execution_plan": "Construct a concrete action sequence for the mission.",
        "execute_action": "Invoke the selected tool or external system.",
        "store_outcome": "Persist the decision and outcome to memory.",
        "evaluate_result": "Score and log the quality of the outcome.",
        "synthesize_intelligence": "Cross-correlate retrieved intel into a coherent report.",
        "validate_source": "Verify document integrity and source authenticity.",
        "ingest_document": "Extract and chunk document text for embedding.",
        "index_knowledge": "Add document embeddings to the vector store.",
        "verify_ingestion": "Query memory to confirm successful knowledge ingestion.",
        "rank_results": "Re-rank retrieved memories by relevance score.",
        "surface_findings": "Format and return ranked memory entries.",
        "formulate_response": "Compose a grounded response from reasoning output.",
    }
    return [
        {"step": step, "description": _DESCRIPTIONS.get(step, "Execute step.")}
        for step in plan
    ]
