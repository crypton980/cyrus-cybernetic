"""
CYRUS Commander — central orchestrator for the multi-agent intelligence system.

The Commander coordinates all specialist agents through a deterministic
five-step pipeline:

  1. Security    — validate and sanitise input (fast, local, no LLM)
  2. Memory      — retrieve semantically similar context from ChromaDB
  3. Analysis    — LLM-powered deep analysis grounded in memory context
  4. Mission     — build a structured execution plan
  5. Learning    — derive a forward-looking behavioural strategy (optional)

Any step that fails returns an error payload rather than raising an exception
so that the pipeline is maximally robust.  The Commander's `execute()` method
never crashes the caller.

Architecture notes
------------------
* The Commander is a singleton — instantiate once at module level and reuse.
* Each agent is stateless from the Commander's perspective; agents own their
  own state (e.g. the OpenAI client in AnalysisAgent).
* The learning step is skipped when no feedback data is available in the
  input, preserving backward compatibility with calls that don't include it.
"""

from __future__ import annotations

import logging
import time
from typing import Any

from agents.memory_agent import MemoryAgent
from agents.analysis_agent import AnalysisAgent
from agents.mission_agent import MissionAgent
from agents.learning_agent import LearningAgent
from agents.security_agent import SecurityAgent

logger = logging.getLogger(__name__)


class Commander:
    """
    Central intelligence orchestrator.

    Coordinates MemoryAgent → AnalysisAgent → MissionAgent in sequence,
    gated by SecurityAgent, with an optional LearningAgent pass when
    feedback data is present in the request.
    """

    def __init__(self) -> None:
        self.memory = MemoryAgent()
        self.analysis = AnalysisAgent()
        self.mission = MissionAgent()
        self.learning = LearningAgent()
        self.security = SecurityAgent()
        logger.info("[Commander] initialised — 5 agents ready")

    # ── Primary entry point ───────────────────────────────────────────────────

    def execute(
        self,
        input_text: str,
        feedback: dict[str, Any] | None = None,
        n_memory: int = 5,
    ) -> dict[str, Any]:
        """
        Run the full multi-agent pipeline for *input_text*.

        Parameters
        ----------
        input_text : str
            Raw operator input.
        feedback : dict | None
            Optional feedback payload ``{"rating": float, ...}``.  When
            supplied, the LearningAgent step is also executed.
        n_memory : int
            Number of memory entries to retrieve (default: 5).

        Returns
        -------
        dict with keys:
            ``type``        — always ``"multi-agent"``
            ``security``    — security check result
            ``memory``      — ChromaDB retrieval result
            ``analysis``    — LLM analysis result
            ``mission``     — mission plan result
            ``learning``    — strategy result (only when feedback is supplied)
            ``pipeline_ms`` — total elapsed milliseconds for this call
        """
        start_ts = time.monotonic()

        # ── Step 1: Security gate ─────────────────────────────────────────
        security_result = self.security.process(input_text)
        if security_result.get("status") != "ok":
            elapsed = int((time.monotonic() - start_ts) * 1_000)
            logger.warning(
                "[Commander] pipeline blocked by security agent: %s",
                security_result.get("reason"),
            )
            return {
                "type": "multi-agent",
                "security": security_result,
                "blocked": True,
                "pipeline_ms": elapsed,
            }

        # ── Step 2: Memory retrieval ──────────────────────────────────────
        memory_result = self.memory.process(input_text)

        # ── Step 3: Analysis (LLM) ────────────────────────────────────────
        analysis_result = self.analysis.process(input_text, context=memory_result)

        # ── Step 4: Mission planning ──────────────────────────────────────
        # Pass intent from analysis if available (future: parse from analysis_result)
        mission_result = self.mission.process(input_text, intent=None)

        # ── Step 5: Learning (optional) ───────────────────────────────────
        learning_result: dict[str, Any] | None = None
        if feedback:
            learning_result = self.learning.process(feedback)

        elapsed = int((time.monotonic() - start_ts) * 1_000)
        logger.info(
            "[Commander] pipeline complete in %d ms (memory/analysis/mission steps done)",
            elapsed,
        )

        result: dict[str, Any] = {
            "type": "multi-agent",
            "security": security_result,
            "memory": memory_result,
            "analysis": analysis_result,
            "mission": mission_result,
            "pipeline_ms": elapsed,
        }
        if learning_result is not None:
            result["learning"] = learning_result

        return result
