"""
CYRUS AnalysisAgent — LLM-powered deep analysis specialist.

Calls GPT-4o-mini to produce a structured analytical response grounded in
the memory context supplied by the MemoryAgent.

Fallback behaviour
------------------
* When OPENAI_API_KEY is not set the agent returns a keyword-extracted
  summary without any LLM call.
* When the LLM call fails (network error, rate-limit, etc.) the agent logs
  the error and returns a degraded-but-safe response — the pipeline never
  crashes.
"""

from __future__ import annotations

import logging
import os
from typing import Any

from agents.base_agent import BaseAgent

logger = logging.getLogger(__name__)

_MAX_CONTEXT_CHARS = 8_000   # guard against huge ChromaDB payloads
_MAX_INPUT_CHARS = 5_000     # mirrors security agent's check


class AnalysisAgent(BaseAgent):
    """
    Performs deep analysis of *input_text* using GPT-4o-mini.

    Parameters
    ----------
    model : str
        OpenAI chat model to use (default: ``"gpt-4o-mini"``).
    max_tokens : int
        Maximum tokens in the completion (default: 512).
    """

    def __init__(
        self,
        model: str = "gpt-4o-mini",
        max_tokens: int = 512,
    ) -> None:
        super().__init__("analysis")
        self._model = model
        self._max_tokens = max_tokens
        self._client: Any = None  # lazy-initialised

    # ── OpenAI client ────────────────────────────────────────────────────

    def _get_client(self) -> Any | None:
        if self._client is not None:
            return self._client
        api_key = os.getenv("OPENAI_API_KEY", "")
        if not api_key:
            return None
        try:
            from openai import OpenAI  # noqa: PLC0415
            self._client = OpenAI(api_key=api_key)
        except Exception:  # noqa: BLE001
            self._logger.warning("[AnalysisAgent] OpenAI import failed")
            self._client = None
        return self._client

    # ── Fallback ─────────────────────────────────────────────────────────

    @staticmethod
    def _offline_analysis(input_text: str, context_text: str) -> str:
        """Return a simple deterministic analysis when LLM is unavailable."""
        words = input_text.split()
        keyword_sample = ", ".join(words[:10]) if words else "(empty)"
        has_context = "yes" if context_text.strip() else "no"
        return (
            f"[Offline analysis] Input contains {len(words)} words. "
            f"Key terms: {keyword_sample}. "
            f"Memory context available: {has_context}. "
            "Full LLM analysis unavailable — OPENAI_API_KEY not configured."
        )

    # ── Public interface ──────────────────────────────────────────────────

    def process(
        self,
        input_text: str,
        context: dict[str, Any] | str | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """
        Analyse *input_text* grounded in *context*.

        Parameters
        ----------
        input_text : str
            The raw user / system input to analyse.
        context : dict | str | None
            Either a raw ChromaDB result dict (as returned by MemoryAgent)
            or a pre-formatted context string.

        Returns
        -------
        dict with keys ``analysis`` (str) and ``source`` (``"llm"`` | ``"offline"``).
        """
        # ── Normalise context ─────────────────────────────────────────────
        if isinstance(context, dict):
            docs = (context.get("documents") or [[]])[0]
            context_text = "\n".join(str(d) for d in docs[:5] if d)
        elif isinstance(context, str):
            context_text = context
        else:
            context_text = ""

        # Truncate to avoid excessively large prompts
        context_text = context_text[:_MAX_CONTEXT_CHARS]
        input_text = input_text[:_MAX_INPUT_CHARS]

        client = self._get_client()
        if client is None:
            self.record_success()  # offline path is not a failure
            return {
                "analysis": self._offline_analysis(input_text, context_text),
                "source": "offline",
            }

        prompt = (
            "You are CYRUS, an autonomous intelligence system performing deep analysis.\n\n"
            "Memory context:\n"
            f"{context_text or '(no relevant memory retrieved)'}\n\n"
            "Input to analyse:\n"
            f"{input_text}\n\n"
            "Provide a thorough, structured analytical response covering:\n"
            "1. Intent — what is the operator trying to achieve?\n"
            "2. Key entities — people, systems, objectives mentioned.\n"
            "3. Risk assessment — potential issues or conflicts.\n"
            "4. Recommended action — concrete next step for CYRUS.\n"
        )

        result = self._safe_llm_call(client, prompt)
        return result

    def _safe_llm_call(
        self,
        client: Any,
        prompt: str,
        retries: int = 2,
    ) -> dict[str, Any]:
        """
        Call the LLM with automatic retry on transient failure.

        Parameters
        ----------
        client : OpenAI
            Initialised OpenAI client.
        prompt : str
            The full prompt string.
        retries : int
            Total number of attempts before giving up (default: 2).

        Returns
        -------
        dict with ``analysis`` (str) and ``source`` ("llm" | "offline_fallback").
        """
        last_exc: Exception | None = None
        for attempt in range(1, retries + 1):
            try:
                response = client.chat.completions.create(
                    model=self._model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.2,
                    max_tokens=self._max_tokens,
                )
                analysis_text = (response.choices[0].message.content or "").strip()
                self._logger.info(
                    "[AnalysisAgent] LLM analysis complete attempt=%d (%d chars)",
                    attempt,
                    len(analysis_text),
                )
                self.record_success()
                return {"analysis": analysis_text, "source": "llm"}
            except Exception as exc:  # noqa: BLE001
                last_exc = exc
                self._logger.warning(
                    "[AnalysisAgent] LLM call failed (attempt %d/%d): %s",
                    attempt,
                    retries,
                    exc,
                )

        self.record_failure()
        self._logger.error(
            "[AnalysisAgent] all %d LLM attempts failed, returning offline fallback: %s",
            retries,
            last_exc,
        )
        # Extract plain-text context from the prompt for offline fallback
        input_text = prompt.split("Input to analyse:\n")[-1].split("\n")[0]
        return {
            "analysis": self._offline_analysis(input_text, ""),
            "source": "offline_fallback",
        }
