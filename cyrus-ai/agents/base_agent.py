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
from typing import Any


logger = logging.getLogger(__name__)


class BaseAgent:
    """
    Abstract base class for all CYRUS intelligence agents.

    Parameters
    ----------
    name : str
        Human-readable identifier used in logging and telemetry.
    """

    def __init__(self, name: str) -> None:
        self.name = name
        self._logger = logging.getLogger(f"cyrus.agent.{name}")

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

    # ── Shared helpers ────────────────────────────────────────────────────

    def _error_result(self, reason: str, exc: Exception | None = None) -> dict[str, Any]:
        """
        Return a standardised error payload and log the failure.

        Never raises — always returns a safe dict that the Commander can
        propagate or suppress as appropriate.
        """
        msg = f"[{self.name}] error: {reason}"
        if exc:
            self._logger.exception(msg)
        else:
            self._logger.error(msg)
        return {"status": "error", "agent": self.name, "reason": reason}

    def __repr__(self) -> str:  # pragma: no cover
        return f"<{self.__class__.__name__} name={self.name!r}>"
