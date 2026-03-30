"""
CYRUS Safety Override System — emergency lockdown control.

Provides a global lockdown mechanism that can instantly halt all
intelligence processing.  When the system is in lockdown:

* ``Commander.execute()`` returns an error immediately without running
  the pipeline.
* All FastAPI endpoints that perform intelligence processing check
  ``is_locked()`` before proceeding and return 503.
* The autonomy loop skips its cycle.

Lockdown state is in-process (reset on process restart).  For persistent
lockdown across restarts, write the state to a file or Redis and read it
at startup — see ``CYRUS_LOCKDOWN_FILE`` for the file-based option.

Configuration (env vars)
------------------------
CYRUS_LOCKDOWN_FILE  → optional file path; if the file exists at startup
                       the system starts in lockdown mode.
                       Write an empty file to trigger startup lockdown.
                       Delete the file to clear it.
"""

from __future__ import annotations

import logging
import os
import time
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# ── Configuration ──────────────────────────────────────────────────────────────

_LOCKDOWN_FILE: str | None = os.getenv("CYRUS_LOCKDOWN_FILE", "")

# ── State ──────────────────────────────────────────────────────────────────────

_SYSTEM_LOCKDOWN: bool = False
_locked_at: float | None = None
_locked_by: str = "unknown"


def _init_lockdown_from_file() -> None:
    """
    Check for a lockdown file at startup and enable lockdown if found.

    This allows operators to pre-stage a lockdown before the process starts,
    e.g. in a Kubernetes init container or deployment pipeline.
    """
    global _SYSTEM_LOCKDOWN, _locked_at, _locked_by  # noqa: PLW0603

    if not _LOCKDOWN_FILE:
        return
    if Path(_LOCKDOWN_FILE).exists():
        _SYSTEM_LOCKDOWN = True
        _locked_at = time.time()
        _locked_by = f"startup (file: {_LOCKDOWN_FILE})"
        logger.critical(
            "[Safety] SYSTEM LOCKDOWN active from startup file: %s", _LOCKDOWN_FILE
        )


# Initialise once at import time
_init_lockdown_from_file()


# ── Public API ─────────────────────────────────────────────────────────────────


def enable_lockdown(reason: str = "operator command") -> dict[str, Any]:
    """
    Activate the global lockdown.

    All intelligence processing will be halted until ``disable_lockdown()``
    is called.  Logs at CRITICAL level so the event is always visible.

    Parameters
    ----------
    reason : str
        Human-readable explanation recorded in the lockdown state.

    Returns
    -------
    dict — current lockdown state.
    """
    global _SYSTEM_LOCKDOWN, _locked_at, _locked_by  # noqa: PLW0603

    _SYSTEM_LOCKDOWN = True
    _locked_at = time.time()
    _locked_by = reason

    # Optionally persist to file
    if _LOCKDOWN_FILE:
        try:
            Path(_LOCKDOWN_FILE).write_text(reason, encoding="utf-8")
        except Exception as exc:  # noqa: BLE001
            logger.warning("[Safety] could not write lockdown file: %s", exc)

    logger.critical(
        "[Safety] *** SYSTEM LOCKDOWN ENABLED *** reason=%s", reason
    )
    return get_lockdown_state()


def disable_lockdown(reason: str = "operator command") -> dict[str, Any]:
    """
    Deactivate the global lockdown and resume normal operation.

    Parameters
    ----------
    reason : str
        Human-readable explanation for the unlock event.

    Returns
    -------
    dict — current lockdown state.
    """
    global _SYSTEM_LOCKDOWN, _locked_at, _locked_by  # noqa: PLW0603

    _SYSTEM_LOCKDOWN = False
    _locked_at = None
    _locked_by = "none"

    # Remove lockdown file if configured
    if _LOCKDOWN_FILE:
        try:
            p = Path(_LOCKDOWN_FILE)
            if p.exists():
                p.unlink()
        except Exception as exc:  # noqa: BLE001
            logger.warning("[Safety] could not remove lockdown file: %s", exc)

    logger.warning("[Safety] system lockdown DISABLED (%s)", reason)
    return get_lockdown_state()


def is_locked() -> bool:
    """Return ``True`` if the system is in lockdown mode."""
    return _SYSTEM_LOCKDOWN


def get_lockdown_state() -> dict[str, Any]:
    """Return the full lockdown state as a dict."""
    return {
        "locked": _SYSTEM_LOCKDOWN,
        "locked_at": _locked_at,
        "locked_by": _locked_by,
        "duration_sec": (
            round(time.time() - _locked_at, 1) if _locked_at else None
        ),
    }
