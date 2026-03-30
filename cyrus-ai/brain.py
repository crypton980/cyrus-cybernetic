"""
CYRUS Brain — LLM-powered reasoning engine with keyword fallback.

Primary path (when OPENAI_API_KEY is set):
  1. Retrieve top-K semantically similar memories from ChromaDB.
  2. Build a structured prompt injecting the memory context.
  3. Call GPT-4o-mini (JSON mode) for intent classification and reasoning.
  4. Run the multi-step planner to produce an execution plan.
  5. Return a unified decision payload.

Fallback path (no API key / network error):
  Keyword-based intent classification is used so the system never goes dark.

Decision types
--------------
  mission   — operational objective detected
  analysis  — analytical/investigative request
  training  — knowledge ingestion command
  memory    — explicit memory retrieval request
  response  — general interaction (fallback)
"""

from __future__ import annotations

import logging
import json
import os
import time
from typing import Any

from memory_service import query_memory
from planner import create_plan, describe_plan

logger = logging.getLogger(__name__)

# ── OpenAI client (optional) ──────────────────────────────────────────────────

_openai_client: Any = None  # lazy-initialised

def _get_openai_client() -> Any | None:
    """Return a cached OpenAI client, or None if the key is absent."""
    global _openai_client  # noqa: PLW0603
    if _openai_client is not None:
        return _openai_client
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        return None
    try:
        from openai import OpenAI  # noqa: PLC0415
        _openai_client = OpenAI(api_key=api_key)
        logger.info("[Brain] OpenAI client initialised")
    except Exception:  # noqa: BLE001
        logger.warning("[Brain] OpenAI not available — using keyword fallback")
        _openai_client = None
    return _openai_client


# ── Keyword fallback ──────────────────────────────────────────────────────────

_INTENT_MAP: list[tuple[list[str], str]] = [
    (["mission", "deploy", "objective", "operation", "execute", "target"], "mission"),
    (["analyze", "analyse", "assess", "evaluate", "report", "intelligence"], "analysis"),
    (["train", "ingest", "learn", "upload", "document", "dataset"], "training"),
    (["remember", "recall", "retrieve", "what did", "find memory", "search memory"], "memory"),
]

_ACTIONS: dict[str, str] = {
    "mission": "execute_mission",
    "analysis": "analyze",
    "training": "ingest_knowledge",
    "memory": "retrieve_memory",
    "response": "respond",
}

_RECOMMENDATIONS: dict[str, str] = {
    "mission": "Initiate mission planning sequence with retrieved operational context.",
    "analysis": "Apply analytical framework to retrieved intelligence context.",
    "training": "Queue knowledge ingestion pipeline with provided document source.",
    "memory": "Surface retrieved memory entries for operator review.",
    "response": "Synthesize contextual response using retrieved memory as grounding.",
}


def _keyword_classify(text: str) -> tuple[str, str]:
    """Return (intent, matched_keyword) from simple keyword matching."""
    lower = text.lower()
    for keywords, intent in _INTENT_MAP:
        for kw in keywords:
            if kw in lower:
                return intent, kw
    return "response", "general"


def _compute_confidence(distances: list[float]) -> float:
    """Convert average cosine distance → 0.0–1.0 confidence."""
    if not distances:
        return 0.0
    avg_dist = sum(distances) / len(distances)
    return max(0.0, min(1.0, 1.0 - avg_dist / 2.0))


# ── Memory context builder ────────────────────────────────────────────────────

def build_context(input_text: str, n_context: int = 5) -> tuple[dict[str, Any], str]:
    """
    Query the vector store and format a text context block.

    Returns
    -------
    (raw_memory_results, context_text)
    """
    memory_results = query_memory(input_text, n_results=n_context)
    docs: list[str] = []
    if memory_results.get("documents") and memory_results["documents"]:
        docs = memory_results["documents"][0] or []
    context_text = "\n".join(docs[:n_context]) if docs else ""
    return memory_results, context_text


# ── LLM reasoning ─────────────────────────────────────────────────────────────

_SYSTEM_PROMPT = (
    "You are CYRUS, an autonomous intelligence system. "
    "You reason precisely and always respond in the exact JSON format requested."
)

_VALID_INTENTS = {"mission", "analysis", "training", "memory", "response"}
_VALID_ACTIONS = set(_ACTIONS.values())

# ── Model mode ─────────────────────────────────────────────────────────────────
# CYRUS_MODEL_MODE: "openai" (default), "local", "hybrid"
# * openai  — use OpenAI GPT-4o-mini exclusively
# * local   — use local HuggingFace model exclusively
# * hybrid  — try local first, fall back to OpenAI on failure / unavailability
#
# NOTE: MODEL_MODE is read once at module import time from the environment.
# Changes to CYRUS_MODEL_MODE after process startup require a service restart.

MODEL_MODE: str = os.getenv("CYRUS_MODEL_MODE", "openai").lower()


def _parse_local_response(raw: str) -> dict[str, Any] | None:
    """
    Attempt to parse a JSON decision dict from a local model text response.

    The local model may not reliably output pure JSON, so this function
    tries a few extraction strategies before returning None.
    """
    if not raw:
        return None
    # Strategy 1: raw text is valid JSON
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass
    # Strategy 2: find the first {...} block
    start = raw.find("{")
    end = raw.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(raw[start : end + 1])
        except json.JSONDecodeError:
            pass
    return None


def _local_reason(input_text: str, context_text: str) -> dict[str, Any] | None:
    """
    Attempt classification using the local model.

    Returns a decision dict on success, or None if the local model is
    unavailable or produces an unparseable response.
    """
    try:
        from models.local_model import local_infer, is_local_model_available  # noqa: PLC0415

        if not is_local_model_available():
            return None

        prompt = (
            "You are CYRUS, an autonomous intelligence system.\n"
            "Classify the following input and respond with ONLY valid JSON.\n\n"
            "Context from memory:\n"
            f"{context_text or '(none)'}\n\n"
            "Input:\n"
            f"{input_text}\n\n"
            "Respond with ONLY a JSON object:\n"
            '{"intent": "mission|analysis|training|memory|response", '
            '"action": "execute_mission|analyze|ingest_knowledge|retrieve_memory|respond", '
            '"confidence": <float 0.0-1.0>, '
            '"reasoning": "<one sentence>"}'
        )

        raw = local_infer(prompt)
        if raw is None:
            return None

        parsed = _parse_local_response(raw)
        if parsed is None:
            logger.debug("[Brain] local model response unparseable: %s", raw[:200])
            return None

        intent = str(parsed.get("intent", "response"))
        if intent not in _VALID_INTENTS:
            intent = "response"
        action = str(parsed.get("action", _ACTIONS[intent]))
        if action not in _VALID_ACTIONS:
            action = _ACTIONS[intent]
        confidence = float(parsed.get("confidence", 0.5))
        confidence = max(0.0, min(1.0, confidence))
        reasoning = str(parsed.get("reasoning", ""))[:500]

        return {
            "intent": intent,
            "action": action,
            "confidence": confidence,
            "reasoning": reasoning,
            "source": "local_model",
        }

    except Exception as exc:  # noqa: BLE001
        logger.debug("[Brain] local reason error: %s", exc)
        return None


def hybrid_reason(input_text: str, context_text: str) -> dict[str, Any]:
    """
    Route reasoning through local model, OpenAI, or both — per MODEL_MODE.

    Strategies
    ----------
    ``local``   — local model only; keyword fallback on failure.
    ``hybrid``  — try local first, fall back to OpenAI (then keyword).
    ``openai``  — OpenAI only (same as original ``reason()``).
    """
    if MODEL_MODE == "local":
        result = _local_reason(input_text, context_text)
        if result is not None:
            return result
        # Local unavailable / failed → keyword fallback
        intent, keyword = _keyword_classify(input_text)
        return {
            "intent": intent,
            "action": _ACTIONS[intent],
            "confidence": 0.4,
            "reasoning": f"Local model unavailable — keyword fallback matched '{keyword}'.",
            "source": "keyword_fallback",
        }

    if MODEL_MODE == "hybrid":
        result = _local_reason(input_text, context_text)
        if result is not None:
            logger.debug("[Brain] hybrid: using local model result")
            return result
        # Local failed → try OpenAI
        logger.debug("[Brain] hybrid: local failed, falling back to OpenAI")
        return reason(input_text, context_text)

    # Default: openai-only path
    return reason(input_text, context_text)


def reason(input_text: str, context_text: str) -> dict[str, Any]:
    """
    Call GPT-4o-mini to produce a structured decision.

    Returns a dict with keys: intent, action, confidence, reasoning.
    Falls back to keyword classification on any error.
    """
    client = _get_openai_client()
    if client is None:
        intent, keyword = _keyword_classify(input_text)
        return {
            "intent": intent,
            "action": _ACTIONS[intent],
            "confidence": 0.5,
            "reasoning": f"Keyword fallback — matched '{keyword}' → intent '{intent}'.",
            "source": "keyword",
        }

    user_prompt = (
        "Context from memory:\n"
        f"{context_text or '(no relevant memories retrieved)'}\n\n"
        "Input:\n"
        f"{input_text}\n\n"
        "Respond with ONLY a JSON object (no markdown, no extra text):\n"
        "{\n"
        '  "intent": "mission|analysis|training|memory|response",\n'
        '  "action": "execute_mission|analyze|ingest_knowledge|retrieve_memory|respond",\n'
        '  "confidence": <float 0.0–1.0>,\n'
        '  "reasoning": "<one concise sentence explaining the decision>"\n'
        "}"
    )

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
            max_tokens=256,
        )
        raw = response.choices[0].message.content or "{}"
        parsed: dict[str, Any] = json.loads(raw)

        # Validate and sanitize fields
        intent = str(parsed.get("intent", "response"))
        if intent not in _VALID_INTENTS:
            intent = "response"
        action = str(parsed.get("action", _ACTIONS[intent]))
        if action not in _VALID_ACTIONS:
            action = _ACTIONS[intent]
        confidence = float(parsed.get("confidence", 0.5))
        confidence = max(0.0, min(1.0, confidence))
        reasoning = str(parsed.get("reasoning", ""))[:500]

        return {
            "intent": intent,
            "action": action,
            "confidence": confidence,
            "reasoning": reasoning,
            "source": "llm",
        }

    except Exception as exc:  # noqa: BLE001
        logger.warning("[Brain] LLM reasoning failed (%s) — using keyword fallback", exc)
        intent, keyword = _keyword_classify(input_text)
        return {
            "intent": intent,
            "action": _ACTIONS[intent],
            "confidence": 0.4,
            "reasoning": f"LLM error — keyword fallback matched '{keyword}'.",
            "source": "keyword_fallback",
        }


# ── Public interface ──────────────────────────────────────────────────────────

def process_input(input_text: str, n_context: int = 5) -> dict[str, Any]:
    """
    Core decision function.  Returns:
      {
        plan:       list[str]              — ordered execution steps
        plan_detail: list[{step, description}]
        decision:   {intent, action, confidence, reasoning, source}
        context:    <raw ChromaDB results>
        memory_confidence: float           — vector-distance confidence
        recommendation: str
      }
    """
    memory_results, context_text = build_context(input_text, n_context)

    # Extract distances for memory-level confidence
    raw_distances: list[float] = []
    if memory_results.get("distances") and memory_results["distances"]:
        raw_distances = memory_results["distances"][0] or []
    memory_confidence = _compute_confidence(raw_distances)

    # Route through hybrid_reason (honours MODEL_MODE env var)
    decision = hybrid_reason(input_text, context_text)

    # Build execution plan based on classified intent
    plan = create_plan(input_text, intent=decision["intent"])
    plan_detail = describe_plan(plan)

    logger.info(
        "[Brain] input=%r intent=%s action=%s source=%s confidence=%.2f",
        input_text[:80],
        decision["intent"],
        decision["action"],
        decision.get("source", "?"),
        decision["confidence"],
    )

    return {
        "plan": plan,
        "plan_detail": plan_detail,
        "decision": decision,
        "context": memory_results,
        "memory_confidence": memory_confidence,
        "recommendation": _RECOMMENDATIONS.get(decision["intent"], "Process input."),
    }


# ── Multi-agent entry point ───────────────────────────────────────────────────

# Commander singleton — initialised lazily to avoid circular imports.
# The None sentinel is set at module level before _get_commander() is defined
# so it is always present even if this module is partially imported.
_commander: Any | None = None


def _get_commander() -> Any:
    """Lazy-load the Commander singleton to avoid circular imports."""
    from agents.commander import Commander  # noqa: PLC0415
    global _commander  # noqa: PLW0603
    if _commander is None:
        _commander = Commander()
    return _commander


def process_input_multi_agent(
    input_text: str,
    feedback: dict[str, Any] | None = None,
    n_memory: int = 5,
) -> "dict[str, Any]":
    """
    Multi-agent entry point — routes through the Commander pipeline.

    This is the primary entry point when the full agent architecture is
    active.  The legacy `process_input()` above is retained for backward
    compatibility with the `/brain/process` endpoint.

    Parameters
    ----------
    input_text : str
        Raw operator input.
    feedback : dict | None
        Optional feedback payload for the LearningAgent step.
    n_memory : int
        Number of memory entries to retrieve (default: 5).

    Returns
    -------
    dict — Commander result with ``type = "multi-agent"``.
    """
    commander = _get_commander()
    return commander.execute(input_text, feedback=feedback, n_memory=n_memory)

