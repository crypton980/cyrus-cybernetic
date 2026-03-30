"""
CYRUS Dataset Builder — collect system interactions for fine-tuning.

Every time the multi-agent pipeline processes a request it can log the
``(input, output)`` pair to a JSONL file.  Accumulating these examples
over time builds a dataset that mirrors CYRUS's own reasoning, which can
then be used to fine-tune a local model so it learns to replicate (and
eventually improve upon) those reasoning patterns.

Design principles
-----------------
* Writes are appended atomically to a JSONL file using a threading lock.
* The dataset file is a standard HuggingFace-compatible JSONL format with
  ``instruction`` / ``output`` keys (Alpaca-style) so it can be consumed
  by the ``datasets`` library without transformation.
* ``export_hf_dataset()`` returns a HuggingFace ``Dataset`` object ready
  for ``Trainer`` consumption.  Falls back gracefully when ``datasets``
  is not installed.
* ``log_training_example()`` never raises — exceptions are swallowed and
  logged at DEBUG level so that a disk-full or permission error never
  kills a request.

Configuration (env vars)
------------------------
CYRUS_TRAINING_DATASET → path for the JSONL dataset file
                         (default: "./training_data.jsonl")
CYRUS_MIN_QUALITY_SCORE → minimum evaluation score for an example to be
                           included in the dataset (default: 0.5)
"""

from __future__ import annotations

import json
import logging
import os
import threading
import time
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# ── Configuration ──────────────────────────────────────────────────────────────

DATASET_FILE: str = os.getenv(
    "CYRUS_TRAINING_DATASET",
    str(Path(__file__).parent.parent / "training_data.jsonl"),
)
_MIN_QUALITY_SCORE: float = float(os.getenv("CYRUS_MIN_QUALITY_SCORE", "0.5"))

# Maximum character lengths applied to training examples before writing.
# These caps keep the dataset compact and prevent runaway memory usage when
# very long inputs or outputs are logged.
_MAX_INSTRUCTION_CHARS: int = 2_000
_MAX_OUTPUT_CHARS: int = 4_000

_write_lock: threading.Lock = threading.Lock()
_write_count: int = 0


# ── Public API ─────────────────────────────────────────────────────────────────


def log_training_example(
    input_text: str,
    output: Any,
    *,
    metadata: dict[str, Any] | None = None,
    quality_score: float | None = None,
) -> bool:
    """
    Append one training example to the JSONL dataset file.

    The example is only written when ``quality_score`` is absent (unknown)
    or meets the configured minimum threshold.  This prevents low-quality
    interactions from polluting the training set.

    Parameters
    ----------
    input_text : str
        The operator prompt / raw input.
    output : Any
        The system response (dict or str).  Dicts are serialised to JSON.
    metadata : dict | None
        Optional extra fields (intent, confidence, node_id, …) stored
        alongside the example for traceability.
    quality_score : float | None
        Evaluation score (0–1).  If below threshold the example is skipped.

    Returns
    -------
    bool
        True if the example was written, False if skipped or on error.
    """
    global _write_count  # noqa: PLW0603

    # Quality gate
    if quality_score is not None and quality_score < _MIN_QUALITY_SCORE:
        logger.debug(
            "[DatasetBuilder] skipped example (score=%.2f < threshold=%.2f)",
            quality_score,
            _MIN_QUALITY_SCORE,
        )
        return False

    # Serialise output
    if isinstance(output, dict):
        output_str = json.dumps(output, default=str)
    else:
        output_str = str(output)

    record: dict[str, Any] = {
        "instruction": input_text[:_MAX_INSTRUCTION_CHARS],
        "output": output_str[:_MAX_OUTPUT_CHARS],
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        **(metadata or {}),
    }

    try:
        with _write_lock:
            with open(DATASET_FILE, "a", encoding="utf-8") as fh:
                fh.write(json.dumps(record, default=str) + "\n")
            _write_count += 1
        logger.debug("[DatasetBuilder] logged example #%d", _write_count)
        return True
    except Exception as exc:  # noqa: BLE001
        logger.debug("[DatasetBuilder] write error: %s", exc)
        return False


def get_dataset_stats() -> dict[str, Any]:
    """
    Return statistics about the current training dataset.

    Returns
    -------
    dict with keys:
        ``file``            — absolute path to the dataset file
        ``exists``          — bool
        ``num_examples``    — total line count
        ``size_bytes``      — file size in bytes
        ``in_memory_count`` — examples written in the current process run
    """
    path = Path(DATASET_FILE)
    exists = path.exists()
    num_lines = 0
    size = 0
    if exists:
        try:
            size = path.stat().st_size
            with path.open("r", encoding="utf-8") as fh:
                num_lines = sum(1 for _ in fh)
        except Exception as exc:  # noqa: BLE001
            logger.debug("[DatasetBuilder] stats error: %s", exc)

    return {
        "file": str(path.resolve()),
        "exists": exists,
        "num_examples": num_lines,
        "size_bytes": size,
        "in_memory_count": _write_count,
        "min_quality_threshold": _MIN_QUALITY_SCORE,
    }


def load_dataset_records(max_records: int = 10_000) -> list[dict[str, Any]]:
    """
    Load up to *max_records* training examples from the JSONL file.

    Returns an empty list if the file doesn't exist or cannot be read.
    """
    path = Path(DATASET_FILE)
    if not path.exists():
        return []
    records: list[dict[str, Any]] = []
    try:
        with path.open("r", encoding="utf-8") as fh:
            for line in fh:
                if len(records) >= max_records:
                    break
                line = line.strip()
                if line:
                    try:
                        records.append(json.loads(line))
                    except json.JSONDecodeError:
                        pass
    except Exception as exc:  # noqa: BLE001
        logger.warning("[DatasetBuilder] load error: %s", exc)
    return records


def export_hf_dataset() -> Any | None:
    """
    Return a HuggingFace ``Dataset`` built from the JSONL file, or ``None``
    if the ``datasets`` package is not installed or the file doesn't exist.

    The returned dataset has columns ``instruction``, ``output``,
    ``timestamp``, and any extras stored in the metadata.
    """
    path = Path(DATASET_FILE)
    if not path.exists():
        logger.warning("[DatasetBuilder] dataset file not found: %s", path)
        return None
    try:
        from datasets import load_dataset as _load_dataset  # noqa: PLC0415

        ds = _load_dataset("json", data_files=str(path), split="train")
        logger.info("[DatasetBuilder] exported HF dataset with %d rows", len(ds))
        return ds
    except ImportError:
        logger.warning("[DatasetBuilder] `datasets` package not installed — export skipped")
        return None
    except Exception as exc:  # noqa: BLE001
        logger.warning("[DatasetBuilder] HF export error: %s", exc)
        return None
