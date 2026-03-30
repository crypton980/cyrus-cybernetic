"""cyrus-ai/training package — dataset building and fine-tuning pipeline."""

from training.dataset_builder import (
    log_training_example,
    get_dataset_stats,
    load_dataset_records,
    export_hf_dataset,
    DATASET_FILE,
)
from training.train import (
    train_model,
    get_training_status,
    FineTuningJob,
)
from training.training_trigger import (
    maybe_trigger_training,
    is_training_running,
)

__all__ = [
    "log_training_example",
    "get_dataset_stats",
    "load_dataset_records",
    "export_hf_dataset",
    "DATASET_FILE",
    "train_model",
    "get_training_status",
    "FineTuningJob",
    "maybe_trigger_training",
    "is_training_running",
]
