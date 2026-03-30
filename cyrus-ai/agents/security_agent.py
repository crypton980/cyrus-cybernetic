"""
CYRUS SecurityAgent — input validation and threat detection specialist.

Performs fast, synchronous checks on operator input before it enters the
reasoning pipeline.  All checks are local (no LLM call) for minimal latency.

Checks performed
----------------
1. Length — blocks inputs exceeding MAX_INPUT_LENGTH characters.
2. Null / empty — blocks blank inputs.
3. Injection patterns — flags common prompt-injection / jailbreak patterns.
4. Binary / non-printable content — rejects non-text payloads.
"""

from __future__ import annotations

import logging
import re
import unicodedata
from typing import Any

from agents.base_agent import BaseAgent

logger = logging.getLogger(__name__)

# ── Configuration ──────────────────────────────────────────────────────────────

MAX_INPUT_LENGTH: int = 5_000      # characters
MIN_PRINTABLE_RATIO: float = 0.85  # fraction of chars that must be printable

# Patterns that signal potential prompt-injection or jailbreak attempts
_INJECTION_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"ignore\s+(all\s+)?(previous|prior)\s+instructions?", re.I),
    re.compile(r"disregard\s+(all\s+)?(previous|prior)\s+instructions?", re.I),
    re.compile(r"you\s+are\s+now\s+", re.I),
    re.compile(r"act\s+as\s+(if\s+you\s+are|a)\s+", re.I),
    re.compile(r"(system\s*prompt|jailbreak)", re.I),
    re.compile(r"<\s*/?(?:script|iframe|object|embed)\s*>", re.I),
]


class SecurityAgent(BaseAgent):
    """
    Validates and sanitises operator input before it enters the agent pipeline.

    Returns ``{"status": "ok"}`` for safe input, or a blocked payload with a
    ``"reason"`` string explaining the rejection.
    """

    def __init__(
        self,
        max_length: int = MAX_INPUT_LENGTH,
        min_printable_ratio: float = MIN_PRINTABLE_RATIO,
    ) -> None:
        super().__init__("security")
        self._max_length = max_length
        self._min_printable_ratio = min_printable_ratio

    def process(self, input_text: str, **kwargs: Any) -> dict[str, Any]:
        """
        Run all security checks on *input_text*.

        Returns
        -------
        ``{"status": "ok"}``
            Input passes all checks.
        ``{"status": "blocked", "reason": str, "check": str}``
            Input failed the named check.
        """
        # ── 1. Null / empty ───────────────────────────────────────────────
        if not input_text or not input_text.strip():
            return self._block("Input is empty or whitespace-only", "empty_input")

        # ── 2. Length ─────────────────────────────────────────────────────
        if len(input_text) > self._max_length:
            return self._block(
                f"Input too large: {len(input_text)} chars (max {self._max_length})",
                "length",
            )

        # ── 3. Printable character ratio ──────────────────────────────────
        total = len(input_text)
        printable = sum(
            1 for c in input_text
            if unicodedata.category(c) not in {"Cc", "Cs"}  # control / surrogate
        )
        if total > 0 and (printable / total) < self._min_printable_ratio:
            return self._block(
                "Input contains excessive non-printable characters",
                "binary_content",
            )

        # ── 4. Injection pattern detection ────────────────────────────────
        for pattern in _INJECTION_PATTERNS:
            if pattern.search(input_text):
                self._logger.warning(
                    "[SecurityAgent] injection pattern matched: %s", pattern.pattern
                )
                return self._block(
                    "Input contains a potentially unsafe instruction pattern",
                    "injection_pattern",
                )

        self._logger.info("[SecurityAgent] input passed all checks (len=%d)", len(input_text))
        return {"status": "ok"}

    def _block(self, reason: str, check: str) -> dict[str, Any]:
        self._logger.warning("[SecurityAgent] blocked — check=%s reason=%s", check, reason)
        return {"status": "blocked", "reason": reason, "check": check}
