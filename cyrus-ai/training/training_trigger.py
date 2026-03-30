"""
CYRUS Training Trigger — autonomy-loop integration for self-improvement.

Bridges the metrics-driven optimization directives produced by
``optimization/improver.py`` and the fine-tuning pipeline in
``training/train.py``.

Trigger conditions
------------------
A training run is triggered when ALL of the following hold:
  1. ``CYRUS_AUTO_TRAIN`` env var is ``"true"`` (opt-in, default off)
  2. No training job is currently running or queued.
  3. The optimization directive indicates the system needs learning:
     ``high_error_rate`` or ``optimize_quality``.
  4. At least ``CYRUS_MIN_TRAIN_EXAMPLES`` examples exist in the dataset.
  5. The last completed training run was more than ``CYRUS_TRAIN_COOLDOWN_SEC``
     seconds ago (prevents thrashing).

Design
------
``maybe_trigger_training()`` is called once per autonomy cycle.  It is
idempotent and safe to call at any frequency; the cooldown and concurrency
guards protect against redundant runs.
"""

from __future__ import annotations

import logging
import os
import time

logger = logging.getLogger(__name__)

# ── Configuration ──────────────────────────────────────────────────────────────

_AUTO_TRAIN: bool = os.getenv("CYRUS_AUTO_TRAIN", "false").lower() == "true"
_COOLDOWN_SEC: int = int(os.getenv("CYRUS_TRAIN_COOLDOWN_SEC", "3600"))  # 1 h
_TRIGGER_ACTIONS: frozenset[str] = frozenset({"high_error_rate", "optimize_quality"})

_last_train_time: float = 0.0


def is_training_running() -> bool:
    """Return True if a fine-tuning job is currently queued or running."""
    try:
        from training.train import get_training_status  # noqa: PLC0415

        status = get_training_status()
        return status is not None and status.get("status") in ("queued", "running")
    except Exception as exc:  # noqa: BLE001
        logger.debug("[TrainingTrigger] status check error: %s", exc)
        return False


def maybe_trigger_training(directive: dict) -> bool:
    """
    Evaluate the optimization directive and start a training job if warranted.

    Parameters
    ----------
    directive : dict
        The output of ``optimization.improver.improve_system()`` — must have
        an ``"action"`` key (e.g. ``"high_error_rate"``, ``"stable"``).

    Returns
    -------
    bool
        True if a training job was started, False otherwise.
    """
    global _last_train_time  # noqa: PLW0603

    if not _AUTO_TRAIN:
        return False

    action = directive.get("action", "stable")
    if action not in _TRIGGER_ACTIONS:
        return False

    # Concurrency guard
    if is_training_running():
        logger.debug("[TrainingTrigger] skipped — training already in progress")
        return False

    # Cooldown guard
    elapsed = time.time() - _last_train_time
    if elapsed < _COOLDOWN_SEC:
        logger.debug(
            "[TrainingTrigger] skipped — cooldown (%.0fs remaining)",
            _COOLDOWN_SEC - elapsed,
        )
        return False

    # Dataset size guard
    try:
        from training.dataset_builder import get_dataset_stats  # noqa: PLC0415
        from training.train import _MIN_EXAMPLES  # noqa: PLC0415

        stats = get_dataset_stats()
        if stats["num_examples"] < _MIN_EXAMPLES:
            logger.info(
                "[TrainingTrigger] skipped — dataset too small (%d < %d)",
                stats["num_examples"],
                _MIN_EXAMPLES,
            )
            return False
    except Exception as exc:  # noqa: BLE001
        logger.debug("[TrainingTrigger] dataset check error: %s", exc)
        return False

    # All checks passed — start training
    try:
        from training.train import train_model  # noqa: PLC0415

        job = train_model()
        _last_train_time = time.time()
        logger.info(
            "[TrainingTrigger] training job started (action=%s job_status=%s)",
            action,
            job.status,
        )
        return True
    except RuntimeError as exc:
        # Another job slipped in (race); safe to ignore
        logger.debug("[TrainingTrigger] race condition avoided: %s", exc)
        return False
    except Exception as exc:  # noqa: BLE001
        logger.warning("[TrainingTrigger] failed to start training: %s", exc)
        return False
