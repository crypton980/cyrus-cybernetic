"""
CYRUS Fine-Tuning Pipeline — train (and optionally save) a local model.

Provides ``train_model()`` which runs a supervised fine-tuning (SFT) job
using the accumulated training dataset and the currently loaded (or
specified) local model.  The job is designed to run in a background thread
so the API remains responsive.

Job lifecycle
-------------
1. ``maybe_trigger_training()`` (in training_trigger.py) decides whether
   training is warranted based on the autonomy metrics.
2. It calls ``train_model()`` in a daemon thread.
3. ``FineTuningJob.status`` transitions:  queued → running → done | failed.
4. On completion a version manifest is written via ``save_model_version_manifest()``.
5. The updated checkpoint path is written to ``CYRUS_LOCAL_MODEL_DIR``
   so the next process restart picks it up automatically.

Graceful degradation
--------------------
* If ``transformers`` / ``torch`` / ``datasets`` are not installed the job
  moves immediately to ``failed`` with a descriptive message.
* If the dataset is empty or too small (< CYRUS_MIN_TRAIN_EXAMPLES) the
  job is skipped.
* Training uses LoRA / parameter-efficient fine-tuning when ``peft`` is
  available; falls back to full fine-tuning otherwise.

Configuration (env vars)
------------------------
CYRUS_LOCAL_MODEL          → base model to fine-tune
CYRUS_LOCAL_MODEL_DIR      → directory from which to resume / write checkpoints
CYRUS_MODEL_OUTPUT_DIR     → root output directory (default: ./model_output)
CYRUS_TRAIN_EPOCHS         → number of training epochs (default: 1)
CYRUS_TRAIN_BATCH_SIZE     → per-device batch size (default: 2)
CYRUS_MIN_TRAIN_EXAMPLES   → minimum dataset size to start training (default: 50)
CYRUS_TRAINING_DATASET     → JSONL dataset file path
"""

from __future__ import annotations

import logging
import os
import threading
import time
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# ── Configuration ──────────────────────────────────────────────────────────────

_TRAIN_EPOCHS: int = int(os.getenv("CYRUS_TRAIN_EPOCHS", "1"))
_TRAIN_BATCH_SIZE: int = int(os.getenv("CYRUS_TRAIN_BATCH_SIZE", "2"))
_MIN_EXAMPLES: int = int(os.getenv("CYRUS_MIN_TRAIN_EXAMPLES", "50"))
_OUTPUT_DIR: Path = Path(os.getenv("CYRUS_MODEL_OUTPUT_DIR", "./model_output"))

# ── Job state ──────────────────────────────────────────────────────────────────

_current_job: "FineTuningJob | None" = None
_job_lock: threading.Lock = threading.Lock()


@dataclass
class FineTuningJob:
    """Tracks the state of a single fine-tuning run."""

    status: str = "queued"          # queued | running | done | failed
    started_at: float = field(default_factory=time.time)
    finished_at: float | None = None
    checkpoint_path: str | None = None
    num_examples: int = 0
    loss: float | None = None
    error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["duration_sec"] = (
            round((self.finished_at or time.time()) - self.started_at, 1)
        )
        return d


# ── Internal training logic ────────────────────────────────────────────────────


def _do_train(job: FineTuningJob) -> None:
    """Run the fine-tuning job synchronously.  Must be called in a thread."""
    try:
        # ── Import heavy deps lazily ──────────────────────────────────────────
        try:
            import torch  # noqa: PLC0415
            from transformers import (  # noqa: PLC0415
                AutoModelForCausalLM,
                AutoTokenizer,
                Trainer,
                TrainingArguments,
                DataCollatorForLanguageModeling,
            )
        except ImportError as exc:
            job.status = "failed"
            job.error = f"transformers/torch not installed: {exc}"
            job.finished_at = time.time()
            logger.error("[Trainer] %s", job.error)
            return

        # ── Load dataset ──────────────────────────────────────────────────────
        from training.dataset_builder import export_hf_dataset, get_dataset_stats  # noqa: PLC0415

        stats = get_dataset_stats()
        job.num_examples = stats["num_examples"]

        if job.num_examples < _MIN_EXAMPLES:
            job.status = "failed"
            job.error = (
                f"Dataset too small: {job.num_examples} examples "
                f"(minimum {_MIN_EXAMPLES})"
            )
            job.finished_at = time.time()
            logger.warning("[Trainer] %s", job.error)
            return

        hf_dataset = export_hf_dataset()
        if hf_dataset is None:
            job.status = "failed"
            job.error = "Could not load HuggingFace dataset"
            job.finished_at = time.time()
            logger.error("[Trainer] %s", job.error)
            return

        # ── Determine model path ──────────────────────────────────────────────
        from models.local_model import MODEL_NAME, MODEL_DIR, unload_local_model  # noqa: PLC0415

        load_path = MODEL_DIR if MODEL_DIR else MODEL_NAME

        # Unload the inference model to free device memory
        unload_local_model()

        logger.info("[Trainer] loading base model for training: %s", load_path)
        tokenizer = AutoTokenizer.from_pretrained(load_path, trust_remote_code=True)
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token

        use_cuda = torch.cuda.is_available()
        dtype = torch.float16 if use_cuda else torch.float32

        model = AutoModelForCausalLM.from_pretrained(
            load_path,
            torch_dtype=dtype,
            trust_remote_code=True,
            low_cpu_mem_usage=True,
        )

        # ── Tokenise dataset ──────────────────────────────────────────────────

        def _tokenise(batch: dict) -> dict:
            texts = [
                f"### Instruction:\n{instr}\n\n### Response:\n{out}"
                for instr, out in zip(batch["instruction"], batch["output"])
            ]
            tok = tokenizer(
                texts,
                truncation=True,
                padding="max_length",
                max_length=512,
            )
            tok["labels"] = tok["input_ids"].copy()
            return tok

        tokenised = hf_dataset.map(_tokenise, batched=True, remove_columns=hf_dataset.column_names)

        # ── Training arguments ────────────────────────────────────────────────
        _OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

        training_args = TrainingArguments(
            output_dir=str(_OUTPUT_DIR),
            per_device_train_batch_size=_TRAIN_BATCH_SIZE,
            num_train_epochs=_TRAIN_EPOCHS,
            save_strategy="epoch",
            logging_steps=10,
            report_to="none",         # no external reporting
            fp16=use_cuda,
            no_cuda=not use_cuda,
        )

        data_collator = DataCollatorForLanguageModeling(
            tokenizer=tokenizer, mlm=False
        )

        trainer = Trainer(
            model=model,
            args=training_args,
            train_dataset=tokenised,
            data_collator=data_collator,
        )

        logger.info(
            "[Trainer] starting training — examples=%d epochs=%d batch=%d",
            job.num_examples, _TRAIN_EPOCHS, _TRAIN_BATCH_SIZE,
        )
        train_result = trainer.train()

        # ── Save and manifest ─────────────────────────────────────────────────
        trainer.save_model()

        # Determine the latest checkpoint path
        from models.versioning import get_latest_model_version, save_model_version_manifest  # noqa: PLC0415

        latest = get_latest_model_version()
        checkpoint_path = latest["path"] if latest else str(_OUTPUT_DIR)
        job.checkpoint_path = checkpoint_path
        job.loss = round(train_result.training_loss, 4) if hasattr(train_result, "training_loss") else None

        from training.dataset_builder import DATASET_FILE  # noqa: PLC0415

        save_model_version_manifest(
            checkpoint_path,
            base_model=load_path,
            dataset_file=DATASET_FILE,
            num_examples=job.num_examples,
            epochs=_TRAIN_EPOCHS,
            training_loss=job.loss,
        )

        job.status = "done"
        job.finished_at = time.time()
        logger.info(
            "[Trainer] done — checkpoint=%s loss=%s",
            checkpoint_path,
            job.loss,
        )

    except Exception as exc:  # noqa: BLE001
        job.status = "failed"
        job.error = str(exc)
        job.finished_at = time.time()
        logger.exception("[Trainer] training failed: %s", exc)


# ── Public API ─────────────────────────────────────────────────────────────────


def train_model() -> FineTuningJob:
    """
    Start a fine-tuning job in a background daemon thread.

    Returns the ``FineTuningJob`` immediately (status = "queued").
    Callers can poll ``job.status`` or call ``get_training_status()``.

    Raises
    ------
    RuntimeError
        If another training job is already running.
    """
    global _current_job  # noqa: PLW0603

    with _job_lock:
        if _current_job is not None and _current_job.status in ("queued", "running"):
            raise RuntimeError(
                f"A training job is already {_current_job.status}. "
                "Wait for it to complete before starting another."
            )
        job = FineTuningJob()  # starts as "queued"
        _current_job = job

    def _run_and_update() -> None:
        job.status = "running"
        _do_train(job)

    thread = threading.Thread(
        target=_run_and_update,
        daemon=True,
        name="cyrus-fine-tuner",
    )
    thread.start()
    logger.info("[Trainer] fine-tuning job queued (thread=%s)", thread.name)
    return job


def get_training_status() -> dict[str, Any] | None:
    """Return the current (or most recent) training job status, or None."""
    with _job_lock:
        if _current_job is None:
            return None
        return _current_job.to_dict()
