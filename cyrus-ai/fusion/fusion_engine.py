"""
CYRUS Intelligence Fusion Engine — multi-source situational awareness.

Combines three intelligence streams into a single fused picture:

* memory      — long-term ChromaDB knowledge retrieved by MemoryAgent
* live_data   — real-time events from the ingestion queue (may be None)
* analysis    — LLM-generated analytical reasoning from AnalysisAgent

Confidence scoring
------------------
The fused confidence is computed as a weighted average of individual
stream confidences:

    memory_confidence   — 0.9 if memory has results, else 0.3
    live_confidence     — 0.85 if live events are present, else 0.0
    analysis_confidence — derived from analysis source ("llm" = 0.9,
                          "offline_fallback" = 0.5, unknown = 0.7)

The weights reflect the information value of each stream:
    memory      → 0.35
    live_data   → 0.25  (zero weight when no live data)
    analysis    → 0.40

When live_data is absent the remaining weight is redistributed
proportionally between memory (0.47) and analysis (0.53).

State persistence
-----------------
The last fused result is kept in `_last_fusion` so the
``GET /platform/intelligence`` endpoint can return the current
situational picture without re-running the pipeline.
"""

from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass, field, asdict
from typing import Any

logger = logging.getLogger(__name__)

# ── Data structure ────────────────────────────────────────────────────────────


@dataclass
class FusionResult:
    """Complete fused intelligence picture for one pipeline cycle."""

    situation: dict[str, Any]
    confidence: float
    fused_at: float = field(default_factory=time.time)
    source_count: int = 0
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


# ── Last-fusion state ──────────────────────────────────────────────────────────

_last_fusion: FusionResult | None = None
_fusion_lock: threading.Lock = threading.Lock()


def _set_last_fusion(result: FusionResult) -> None:
    global _last_fusion  # noqa: PLW0603
    with _fusion_lock:
        _last_fusion = result


def get_last_fusion() -> dict[str, Any] | None:
    """Return the most recent fused intelligence picture (or None if never run)."""
    with _fusion_lock:
        return _last_fusion.to_dict() if _last_fusion is not None else None


# ── Confidence helpers ─────────────────────────────────────────────────────────


def _memory_confidence(memory: Any) -> float:
    if not memory or not isinstance(memory, dict):
        return 0.3
    docs = (memory.get("documents") or [[]])[0]
    if docs:
        return 0.9
    return 0.4


def _live_confidence(live_data: Any) -> float:
    if not live_data:
        return 0.0
    if isinstance(live_data, list) and len(live_data) > 0:
        return 0.85
    if isinstance(live_data, dict):
        return 0.8
    return 0.5


def _analysis_confidence(analysis: Any) -> float:
    if not analysis or not isinstance(analysis, dict):
        return 0.5
    source = analysis.get("source", "unknown")
    return {"llm": 0.9, "offline": 0.75, "offline_fallback": 0.5}.get(source, 0.7)


# ── Public API ─────────────────────────────────────────────────────────────────


def fuse_intelligence(
    memory: Any,
    live_data: Any,
    analysis: Any,
    extra_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Fuse memory, live event data, and LLM analysis into a situational picture.

    Parameters
    ----------
    memory : dict | None
        Result from MemoryAgent (ChromaDB retrieval).
    live_data : list[IngestEvent] | dict | None
        Real-time events from the ingestion queue.  Pass None when no live
        events are available for this cycle.
    analysis : dict | None
        Result from AnalysisAgent (LLM reasoning).
    extra_context : dict | None
        Optional additional signal (e.g. external sensor data).

    Returns
    -------
    dict — serialised FusionResult:
        ``situation``    — dict of all input streams
        ``confidence``   — weighted fusion confidence (0.0–1.0)
        ``fused_at``     — Unix timestamp
        ``source_count`` — number of non-null input sources
        ``metadata``     — per-source confidence scores
    """
    mem_conf = _memory_confidence(memory)
    live_conf = _live_confidence(live_data)
    ana_conf = _analysis_confidence(analysis)

    has_live = live_conf > 0.0
    source_count = sum(
        1 for v in [memory, live_data, analysis] if v is not None
    )

    if has_live:
        confidence = round(
            mem_conf * 0.35 + live_conf * 0.25 + ana_conf * 0.40, 3
        )
    else:
        # Redistribute live weight proportionally
        confidence = round(mem_conf * 0.47 + ana_conf * 0.53, 3)

    # Serialize live data for storage
    live_serial: Any
    if isinstance(live_data, list):
        live_serial = [e.to_dict() if hasattr(e, "to_dict") else e for e in live_data]
    else:
        live_serial = live_data

    situation: dict[str, Any] = {
        "memory": memory,
        "live": live_serial,
        "analysis": analysis,
    }
    if extra_context:
        situation["extra"] = extra_context

    metadata = {
        "memory_confidence": mem_conf,
        "live_confidence": live_conf,
        "analysis_confidence": ana_conf,
        "has_live_data": has_live,
    }

    result = FusionResult(
        situation=situation,
        confidence=confidence,
        source_count=source_count,
        metadata=metadata,
    )
    _set_last_fusion(result)

    logger.debug(
        "[Fusion] fused %d sources confidence=%.3f has_live=%s",
        source_count,
        confidence,
        has_live,
    )
    return result.to_dict()
