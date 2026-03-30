"""
CYRUS Model Versioning — track and manage fine-tuned model checkpoints.

Scans the model output directory for Hugging Face checkpoint subdirectories
(named ``checkpoint-<step>``), reads version manifests written after each
training run, and provides utilities for the autonomy loop and the API to
list, compare, and activate model versions.

Configuration (env vars)
------------------------
CYRUS_MODEL_OUTPUT_DIR → root directory for training output
                         (default: "./model_output" relative to cyrus-ai/)
"""

from __future__ import annotations

import json
import logging
import os
import re
import time
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# ── Configuration ──────────────────────────────────────────────────────────────

_MODEL_OUTPUT_DIR: Path = Path(
    os.getenv("CYRUS_MODEL_OUTPUT_DIR", "./model_output")
)
_MANIFEST_FILENAME = "cyrus_version_manifest.json"
_CHECKPOINT_PATTERN = re.compile(r"^checkpoint-(\d+)$")


# ── Helpers ────────────────────────────────────────────────────────────────────


def _ensure_output_dir() -> Path:
    """Create the output directory if it doesn't exist yet."""
    _MODEL_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    return _MODEL_OUTPUT_DIR


def _read_manifest(path: Path) -> dict[str, Any]:
    """Read a version manifest JSON from *path* (returns {} on error)."""
    manifest_path = path / _MANIFEST_FILENAME
    if not manifest_path.exists():
        return {}
    try:
        return json.loads(manifest_path.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        logger.debug("[Versioning] manifest read error at %s: %s", manifest_path, exc)
        return {}


def _checkpoint_step(name: str) -> int:
    """Return the training step from a ``checkpoint-<step>`` directory name."""
    m = _CHECKPOINT_PATTERN.match(name)
    return int(m.group(1)) if m else -1


# ── Public API ─────────────────────────────────────────────────────────────────


def list_model_versions() -> list[dict[str, Any]]:
    """
    Return a list of all known model versions (checkpoint directories).

    Each entry has:
        ``path``        — absolute path to the checkpoint directory
        ``step``        — training step number
        ``manifest``    — contents of the version manifest file (if present)

    Sorted by training step ascending.  Returns ``[]`` when the output
    directory does not exist or contains no checkpoint subdirectories.
    """
    out_dir = _MODEL_OUTPUT_DIR
    if not out_dir.exists():
        return []

    versions = []
    for entry in out_dir.iterdir():
        if not entry.is_dir():
            continue
        step = _checkpoint_step(entry.name)
        if step < 0:
            continue
        manifest = _read_manifest(entry)
        versions.append(
            {
                "path": str(entry.resolve()),
                "step": step,
                "name": entry.name,
                "manifest": manifest,
            }
        )

    return sorted(versions, key=lambda v: v["step"])


def get_latest_model_version() -> dict[str, Any] | None:
    """
    Return the checkpoint directory with the highest training step, or
    ``None`` if no checkpoints exist.
    """
    versions = list_model_versions()
    return versions[-1] if versions else None


def save_model_version_manifest(
    checkpoint_path: str | Path,
    *,
    base_model: str,
    dataset_file: str,
    num_examples: int,
    epochs: int,
    training_loss: float | None = None,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Write a ``cyrus_version_manifest.json`` into *checkpoint_path*.

    The manifest records provenance information so that any checkpoint can
    be traced back to the training run that produced it.

    Parameters
    ----------
    checkpoint_path : str | Path
        Path to the checkpoint directory (created by the Trainer).
    base_model : str
        Name of the base model that was fine-tuned.
    dataset_file : str
        Path to the JSONL dataset file used for training.
    num_examples : int
        Number of training examples in the dataset.
    epochs : int
        Number of epochs trained.
    training_loss : float | None
        Final training loss if available.
    extra : dict | None
        Any additional metadata to include.

    Returns
    -------
    dict — the manifest that was written.
    """
    path = Path(checkpoint_path)
    path.mkdir(parents=True, exist_ok=True)

    manifest: dict[str, Any] = {
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "base_model": base_model,
        "dataset_file": dataset_file,
        "num_examples": num_examples,
        "epochs": epochs,
        "training_loss": training_loss,
        **(extra or {}),
    }

    manifest_path = path / _MANIFEST_FILENAME
    manifest_path.write_text(
        json.dumps(manifest, indent=2, default=str),
        encoding="utf-8",
    )
    logger.info(
        "[Versioning] manifest written at %s (base=%s examples=%d)",
        manifest_path,
        base_model,
        num_examples,
    )
    return manifest
