"""
CYRUS Evaluation Engine — automated output quality scoring.

Produces a multi-dimensional quality score for each pipeline result so that
the self-improvement loop has concrete data to act on.

Scoring dimensions
------------------
relevance      — how well the output addresses the input (0.0–1.0)
accuracy       — factual / logical correctness estimate (0.0–1.0)
completeness   — whether all expected output sections are present (0.0–1.0)
safety         — absence of blocked/error flags (0.0–1.0)
coherence      — internal consistency of the multi-agent result (0.0–1.0)

Overall score is the arithmetic mean of all dimensions.

Design notes
------------
* All scoring is heuristic and deterministic — no LLM call required so
  evaluation never fails or slows down the pipeline.
* Scores are capped to [0.0, 1.0] and rounded to 3 decimal places.
* `expected` is optional; when supplied it enables accuracy estimation via
  keyword overlap with the output text.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field, asdict
from typing import Any


# ── Data structure ────────────────────────────────────────────────────────────


@dataclass
class EvaluationScore:
    """Multi-dimensional quality score for a single pipeline result."""

    relevance: float = 0.0
    accuracy: float = 0.0
    completeness: float = 0.0
    safety: float = 0.0
    coherence: float = 0.0
    overall: float = 0.0
    details: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


# ── Internal helpers ──────────────────────────────────────────────────────────


def _cap(value: float) -> float:
    return round(max(0.0, min(1.0, value)), 3)


def _score_relevance(input_text: str, output: dict[str, Any]) -> float:
    """
    Heuristic: does the output contain content that relates to the input?

    Uses keyword overlap between lowercased input tokens and the
    flattened text representation of the output.
    """
    if not output:
        return 0.0

    # Flatten all string values in the output dict (up to 2 levels deep)
    output_text = _flatten_text(output)
    if not output_text.strip():
        return 0.3  # output exists but is empty content

    input_tokens = set(re.findall(r"\w+", input_text.lower()))
    output_tokens = set(re.findall(r"\w+", output_text.lower()))

    # Remove stop words for a cleaner signal
    _STOPS = {"the", "a", "an", "is", "it", "in", "of", "to", "and", "or", "for"}
    input_tokens -= _STOPS
    output_tokens -= _STOPS

    if not input_tokens:
        return 0.5  # can't compute overlap — neutral score

    overlap = len(input_tokens & output_tokens) / len(input_tokens)
    # Blend overlap with a base score (output always gets partial credit)
    return _cap(0.4 + overlap * 0.6)


def _score_accuracy(output: dict[str, Any], expected: dict[str, Any] | None) -> float:
    """
    When `expected` is supplied: keyword overlap with expected output.
    When `expected` is None: return a neutral baseline (0.7).
    """
    if expected is None:
        return 0.7  # no ground truth — assume reasonable accuracy

    expected_text = _flatten_text(expected)
    output_text = _flatten_text(output)

    if not expected_text or not output_text:
        return 0.5

    expected_tokens = set(re.findall(r"\w+", expected_text.lower()))
    output_tokens = set(re.findall(r"\w+", output_text.lower()))

    if not expected_tokens:
        return 0.5

    overlap = len(expected_tokens & output_tokens) / len(expected_tokens)
    return _cap(overlap)


def _score_completeness(output: dict[str, Any]) -> float:
    """
    Did the pipeline produce all expected top-level sections?

    Expected keys for a full multi-agent result:
        memory, analysis, mission, security
    """
    expected_keys = {"memory", "analysis", "mission", "security"}
    present_keys = {k for k in output if output.get(k) is not None}
    if not expected_keys:
        return 1.0
    ratio = len(expected_keys & present_keys) / len(expected_keys)
    # Bonus if analysis.analysis is a non-empty string
    analysis_ok = bool(
        isinstance(output.get("analysis"), dict)
        and output["analysis"].get("analysis")
    )
    bonus = 0.05 if analysis_ok else 0.0
    return _cap(ratio * 0.95 + bonus)


def _score_safety(output: dict[str, Any]) -> float:
    """
    Check for error/blocked flags in the result.

    Full score (1.0) = no errors.
    Partial (0.5) = analysis offline fallback.
    Zero (0.0) = pipeline was blocked.
    """
    if output.get("blocked"):
        return 0.0
    error_keys = [k for k, v in output.items() if isinstance(v, dict) and v.get("status") == "error"]
    if error_keys:
        return _cap(1.0 - 0.25 * len(error_keys))
    # Offline fallback is safe but less ideal
    analysis = output.get("analysis") or {}
    if isinstance(analysis, dict) and "offline" in str(analysis.get("source", "")):
        return 0.85
    return 1.0


def _score_coherence(output: dict[str, Any]) -> float:
    """
    Internal consistency: memory, analysis and mission should all be present
    and not contradict each other (at heuristic level).

    Currently checks that none of the agent results are error payloads and
    that the pipeline_ms is realistic.
    """
    agent_sections = ["memory", "analysis", "mission"]
    ok = 0
    for section in agent_sections:
        val = output.get(section)
        if val and not (isinstance(val, dict) and val.get("status") == "error"):
            ok += 1
    base = ok / len(agent_sections)
    # Penalise suspiciously fast runs (< 1 ms) which suggest a fallback
    pipeline_ms = output.get("pipeline_ms", 100)
    speed_ok = 1.0 if pipeline_ms >= 1 else 0.85
    return _cap(base * speed_ok)


def _flatten_text(obj: Any, depth: int = 0) -> str:
    """Recursively extract all string values from a nested dict/list."""
    if depth > 3:
        return ""
    if isinstance(obj, str):
        return obj
    if isinstance(obj, dict):
        return " ".join(_flatten_text(v, depth + 1) for v in obj.values())
    if isinstance(obj, list):
        return " ".join(_flatten_text(v, depth + 1) for v in obj)
    return str(obj) if obj is not None else ""


# ── Public API ────────────────────────────────────────────────────────────────


def evaluate_response(
    input_text: str,
    output: dict[str, Any],
    expected: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Score a multi-agent pipeline result on five quality dimensions.

    Parameters
    ----------
    input_text : str
        The original operator input.
    output : dict
        The Commander result to evaluate.
    expected : dict | None
        Optional ground-truth result for accuracy scoring.

    Returns
    -------
    dict
        ``{"relevance", "accuracy", "completeness", "safety", "coherence",
           "overall", "details"}``
    """
    relevance = _score_relevance(input_text, output)
    accuracy = _score_accuracy(output, expected)
    completeness = _score_completeness(output)
    safety = _score_safety(output)
    coherence = _score_coherence(output)

    overall = _cap((relevance + accuracy + completeness + safety + coherence) / 5.0)

    score = EvaluationScore(
        relevance=relevance,
        accuracy=accuracy,
        completeness=completeness,
        safety=safety,
        coherence=coherence,
        overall=overall,
        details={
            "input_len": len(input_text),
            "output_keys": list(output.keys()) if isinstance(output, dict) else [],
            "blocked": bool(output.get("blocked")),
            "analysis_source": (output.get("analysis") or {}).get("source"),
        },
    )
    return score.to_dict()
