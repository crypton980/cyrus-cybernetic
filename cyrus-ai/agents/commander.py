"""
CYRUS Commander — central orchestrator for the multi-agent intelligence system.

The Commander coordinates all specialist agents through a deterministic
pipeline:

  1. Security    — validate and sanitise input (fast, local, no LLM)
  2. Memory      — retrieve semantically similar context from ChromaDB
  3. Analysis    — LLM-powered deep analysis grounded in memory context
  4. Mission     — build a structured execution plan
  5. Fusion      — combine memory + live events + analysis into a situational picture
  6. Learning    — derive a forward-looking behavioural strategy (optional)
  7. Evaluation  — score output quality on five dimensions
  8. Metrics     — log per-request telemetry for self-improvement loop

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
* ``live_data`` in execute() receives real-time events from the ingestion
  queue; callers can pass a batch or None.
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
from evaluation.evaluator import evaluate_response
from fusion.fusion_engine import fuse_intelligence
from metrics.tracker import log_metric

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
        live_data: list[Any] | None = None,
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
        live_data : list | None
            Optional batch of real-time IngestEvent objects from the
            ingestion queue.  Forwarded to the Fusion Engine.

        Returns
        -------
        dict with keys:
            ``type``        — always ``"multi-agent"``
            ``security``    — security check result
            ``memory``      — ChromaDB retrieval result
            ``analysis``    — LLM analysis result
            ``mission``     — mission plan result
            ``fusion``      — multi-source intelligence fusion picture
            ``learning``    — strategy result (only when feedback is supplied)
            ``evaluation``  — multi-dimensional quality score
            ``agent_performance`` — per-agent success/failure counters
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
            blocked_result: dict[str, Any] = {
                "type": "multi-agent",
                "security": security_result,
                "blocked": True,
                "pipeline_ms": elapsed,
            }
            log_metric({
                "input": input_text[:200],
                "latency": elapsed,
                "confidence": 0.0,
                "overall_score": 0.0,
                "blocked": True,
            })
            return blocked_result

        # ── Step 2: Memory retrieval ──────────────────────────────────────
        memory_result = self.memory.process(input_text)
        if memory_result.get("status") != "error":
            self.memory.record_success()

        # ── Step 3: Analysis (LLM) ────────────────────────────────────────
        analysis_result = self.analysis.process(input_text, context=memory_result)
        # success/failure already recorded inside AnalysisAgent._safe_llm_call

        # ── Step 4: Mission planning ──────────────────────────────────────
        mission_result = self.mission.process(input_text, intent=None)
        if mission_result.get("status") != "error":
            self.mission.record_success()

        # ── Step 5: Intelligence Fusion ───────────────────────────────────
        fusion_result = fuse_intelligence(memory_result, live_data, analysis_result)

        # ── Step 6: Learning (optional) ───────────────────────────────────
        learning_result: dict[str, Any] | None = None
        if feedback:
            learning_result = self.learning.process(feedback)
            if learning_result.get("status") != "error":
                self.learning.record_success()

        elapsed = int((time.monotonic() - start_ts) * 1_000)

        result: dict[str, Any] = {
            "type": "multi-agent",
            "security": security_result,
            "memory": memory_result,
            "analysis": analysis_result,
            "mission": mission_result,
            "fusion": fusion_result,
            "pipeline_ms": elapsed,
        }
        if learning_result is not None:
            result["learning"] = learning_result

        # ── Step 7: Evaluate output quality ───────────────────────────────
        evaluation = evaluate_response(input_text, result)
        result["evaluation"] = evaluation

        # ── Step 8: Log training example (dataset builder) ────────────────
        # Append a high-quality interaction to the training dataset so CYRUS
        # can learn from its own responses over time.
        try:
            from training.dataset_builder import log_training_example  # noqa: PLC0415
            from distributed.node_sync import NODE_ID  # noqa: PLC0415

            quality = float(evaluation.get("overall", 0.0))
            log_training_example(
                input_text,
                analysis_result,
                quality_score=quality,
                metadata={
                    "intent": (analysis_result or {}).get("intent"),
                    "source": (analysis_result or {}).get("source"),
                    "node_id": NODE_ID,
                    "pipeline_ms": elapsed,
                },
            )
        except Exception as exc:  # noqa: BLE001
            logger.debug("[Commander] training log skipped: %s", exc)

        # ── Step 9: Agent performance snapshot ───────────────────────────
        result["agent_performance"] = {
            agent.name: agent.performance_report()
            for agent in (
                self.security,
                self.memory,
                self.analysis,
                self.mission,
                self.learning,
            )
        }

        # ── Log metric for self-improvement loop ──────────────────────────
        log_metric({
            "input": input_text[:200],
            "latency": elapsed,
            "confidence": float(fusion_result.get("confidence", 0.0)),
            "overall_score": float(evaluation.get("overall", 0.0)),
            "blocked": False,
            "analysis_source": (analysis_result or {}).get("source"),
            "has_live_data": live_data is not None and len(live_data) > 0,
        })

        logger.info(
            "[Commander] pipeline complete in %d ms score=%.3f fusion_confidence=%.3f",
            elapsed,
            evaluation.get("overall", 0.0),
            fusion_result.get("confidence", 0.0),
        )

        return result

