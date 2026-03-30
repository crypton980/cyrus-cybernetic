"""
CYRUS BaseAgent — abstract base class for all specialist agents.

Every agent in the CYRUS multi-agent system inherits from BaseAgent.
Subclasses must implement the `process()` method.

Design notes
------------
* `process()` is synchronous; if an agent needs async I/O, use
  `asyncio.run()` internally or add a separate `async_process()` helper.
* Agents must never raise uncaught exceptions — wrap risky calls and
  return an error payload instead so the Commander can handle failures
  gracefully and continue the pipeline.
"""

from __future__ import annotations

import logging
import threading
from typing import Any


logger = logging.getLogger(__name__)


class BaseAgent:
    """
    Abstract base class for all CYRUS intelligence agents.

    Parameters
    ----------
    name : str
        Human-readable identifier used in logging and telemetry.

    Performance tracking
    --------------------
    Each agent tracks its own success/failure counts so the metrics system
    and benchmarking layer can report per-agent reliability.
    Counters are thread-safe (protected by a lock).
    """

    def __init__(self, name: str) -> None:
        self.name = name
        self._logger = logging.getLogger(f"cyrus.agent.{name}")
        self._count_lock = threading.Lock()
        self.success_count: int = 0
        self.fail_count: int = 0

    # ── Public interface ──────────────────────────────────────────────────

    def process(self, input_data: Any, **kwargs: Any) -> Any:
        """
        Process the given input and return a structured result.

        Must be overridden by every concrete subclass.

        Raises
        ------
        NotImplementedError
            When called directly on the abstract base.
        """
        raise NotImplementedError(
            f"Agent '{self.name}' must implement process()"
        )

    # ── Performance tracking ──────────────────────────────────────────────

    def record_success(self) -> None:
        """Increment the success counter (thread-safe)."""
        with self._count_lock:
            self.success_count += 1

    def record_failure(self) -> None:
        """Increment the failure counter (thread-safe)."""
        with self._count_lock:
            self.fail_count += 1

    @property
    def performance_score(self) -> float:
        """
        Success rate as a float in [0.0, 1.0].

        Returns 1.0 when no calls have been recorded yet (optimistic prior).
        """
        with self._count_lock:
            total = self.success_count + self.fail_count
            if total == 0:
                return 1.0
            return round(self.success_count / total, 3)

    def performance_report(self) -> dict[str, Any]:
        """Return a dict summary of this agent's performance counters."""
        with self._count_lock:
            return {
                "agent": self.name,
                "success_count": self.success_count,
                "fail_count": self.fail_count,
                "performance_score": self.performance_score,
            }

    # ── Shared helpers ────────────────────────────────────────────────────

    def _error_result(self, reason: str, exc: Exception | None = None) -> dict[str, Any]:
        """
        Return a standardised error payload and log the failure.

        Also records a failure in the performance counters.
        Never raises — always returns a safe dict.
        """
        msg = f"[{self.name}] error: {reason}"
        if exc:
            self._logger.exception(msg)
        else:
            self._logger.error(msg)
        self.record_failure()
        return {"status": "error", "agent": self.name, "reason": reason}

    def __repr__(self) -> str:  # pragma: no cover
        return f"<{self.__class__.__name__} name={self.name!r}>"
