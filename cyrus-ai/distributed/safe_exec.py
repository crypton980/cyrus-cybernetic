"""
CYRUS Safe Execute — fault-tolerant execution wrapper.

Provides ``safe_execute()`` for wrapping any callable in a try/except so
that individual failures in pipeline steps, background tasks, or plugin
handlers do not crash the calling code.

Design principles
-----------------
* Never re-raises the caught exception.
* Returns a configurable *default* value on failure.
* Logs the full traceback at ERROR level for observability.
* Zero external dependencies — safe to import anywhere.
"""

from __future__ import annotations

import logging
from typing import Any, Callable, TypeVar

logger = logging.getLogger(__name__)

_T = TypeVar("_T")


def safe_execute(
    fn: Callable[[], _T],
    default: Any = None,
    label: str = "",
) -> _T | Any:
    """
    Execute ``fn()`` and return its result.

    On any unhandled exception, log the traceback and return *default*
    without propagating the error to the caller.

    Parameters
    ----------
    fn : Callable[[], T]
        Zero-argument callable to execute.
    default : Any
        Value to return when ``fn`` raises (default: ``None``).
    label : str
        Optional descriptive label included in the error log message.

    Returns
    -------
    T | Any
        The return value of ``fn()`` on success, or *default* on failure.

    Examples
    --------
    >>> result = safe_execute(lambda: 1 / 0, default={"error": "divide by zero"})
    >>> result
    {'error': 'divide by zero'}
    """
    try:
        return fn()
    except Exception as exc:  # noqa: BLE001
        tag = f" [{label}]" if label else ""
        logger.exception("[SafeExec]%s uncaught exception — returning default: %s", tag, exc)
        return default
