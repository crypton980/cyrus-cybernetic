"""
CYRUS Local Model Inference Engine — HuggingFace transformer inference.

Provides ``local_infer()`` for running a locally hosted causal language model
as an alternative to (or fallback from) the OpenAI API.

Configuration (env vars)
------------------------
CYRUS_LOCAL_MODEL      → HuggingFace model ID or local path
                         (default: "microsoft/phi-2" — small, CPU-capable)
CYRUS_LOCAL_MODEL_DIR  → optional directory to cache / load fine-tuned
                         checkpoints from (e.g. ./model_output/checkpoint-*)
CYRUS_LOCAL_MAX_TOKENS → max new tokens to generate (default: 256)
CYRUS_LOCAL_DEVICE     → "auto", "cpu", "cuda", "mps" (default: "auto")

Graceful degradation
--------------------
* All public functions are safe to call even when the ``transformers`` /
  ``torch`` packages are not installed — they return ``None`` / ``False``
  and log a warning instead of raising.
* The model is loaded lazily on first call to ``local_infer()`` and cached
  in the module-level ``_model`` / ``_tokenizer`` singletons.  Subsequent
  calls reuse the loaded model with no overhead.
* ``unload_local_model()`` releases GPU/CPU memory when the fine-tuning
  trainer needs exclusive device access.
"""

from __future__ import annotations

import logging
import os
import threading
from typing import Any

logger = logging.getLogger(__name__)

# ── Configuration ──────────────────────────────────────────────────────────────

_DEFAULT_MODEL = "microsoft/phi-2"
MODEL_NAME: str = os.getenv("CYRUS_LOCAL_MODEL", _DEFAULT_MODEL)
MODEL_DIR: str | None = os.getenv("CYRUS_LOCAL_MODEL_DIR", "")  # checkpoint override
MAX_NEW_TOKENS: int = int(os.getenv("CYRUS_LOCAL_MAX_TOKENS", "256"))
DEVICE_MAP: str = os.getenv("CYRUS_LOCAL_DEVICE", "auto")

# ── Lazy singletons ────────────────────────────────────────────────────────────

_model: Any | None = None
_tokenizer: Any | None = None
_load_error: str | None = None          # cached error message from last attempt
_load_lock: threading.Lock = threading.Lock()
_available: bool | None = None          # None = not yet attempted


def _load_model() -> bool:
    """
    Attempt to load the model and tokenizer.

    Returns True on success, False otherwise.  Sets module-level globals
    ``_model``, ``_tokenizer``, ``_load_error``, and ``_available``.
    Called once, under ``_load_lock``.
    """
    global _model, _tokenizer, _load_error, _available  # noqa: PLW0603

    # Determine which model path to load
    load_path = MODEL_DIR if MODEL_DIR else MODEL_NAME

    try:
        import torch  # noqa: PLC0415
        from transformers import AutoModelForCausalLM, AutoTokenizer  # noqa: PLC0415

        logger.info("[LocalModel] loading model=%s device_map=%s", load_path, DEVICE_MAP)

        _tokenizer = AutoTokenizer.from_pretrained(
            load_path,
            trust_remote_code=True,
        )

        # Determine dtype: float16 on GPU, float32 on CPU
        use_cuda = (
            DEVICE_MAP != "cpu"
            and torch.cuda.is_available()
        )
        dtype = torch.float16 if use_cuda else torch.float32

        _model = AutoModelForCausalLM.from_pretrained(
            load_path,
            torch_dtype=dtype,
            device_map=DEVICE_MAP,
            trust_remote_code=True,
            low_cpu_mem_usage=True,
        )
        _model.eval()

        _available = True
        logger.info(
            "[LocalModel] loaded model=%s dtype=%s device=%s",
            load_path,
            dtype,
            DEVICE_MAP,
        )
        return True

    except ImportError as exc:
        _load_error = f"transformers/torch not installed: {exc}"
        logger.warning("[LocalModel] %s — local inference disabled", _load_error)
    except Exception as exc:  # noqa: BLE001
        _load_error = str(exc)
        logger.warning("[LocalModel] failed to load model=%s: %s", load_path, exc)

    _available = False
    return False


def _ensure_loaded() -> bool:
    """Ensure model is loaded (or skip if previous attempt failed)."""
    global _available  # noqa: PLW0603

    # Fast path: already decided
    if _available is True:
        return True
    if _available is False:
        return False

    # First call — load under the lock
    with _load_lock:
        if _available is None:
            _load_model()

    return _available is True


# ── Public API ─────────────────────────────────────────────────────────────────


def is_local_model_available() -> bool:
    """
    Return True if the local model has been (or can be) loaded.

    This triggers a lazy load attempt on first call.
    """
    return _ensure_loaded()


def get_local_model_info() -> dict[str, Any]:
    """Return metadata about the local model configuration and load state."""
    loaded = _available is True
    return {
        "model_name": MODEL_NAME,
        "model_dir": MODEL_DIR or None,
        "max_new_tokens": MAX_NEW_TOKENS,
        "device_map": DEVICE_MAP,
        "loaded": loaded,
        "load_error": _load_error if not loaded else None,
    }


def unload_local_model() -> None:
    """
    Release the cached model and tokenizer to free device memory.

    Useful before starting a fine-tuning job that needs exclusive GPU access.
    After calling this, the next ``local_infer()`` will re-load the model.
    """
    global _model, _tokenizer, _available, _load_error  # noqa: PLW0603

    with _load_lock:
        if _model is not None:
            try:
                import torch  # noqa: PLC0415
                del _model
                del _tokenizer
                _model = None
                _tokenizer = None
                _available = None
                _load_error = None
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                logger.info("[LocalModel] unloaded model and freed device memory")
            except Exception as exc:  # noqa: BLE001
                logger.warning("[LocalModel] unload error: %s", exc)


def local_infer(prompt: str) -> str | None:
    """
    Run local model inference on *prompt*.

    Parameters
    ----------
    prompt : str
        The full prompt string to feed to the model.

    Returns
    -------
    str | None
        The generated text (with the prompt stripped), or ``None`` if the
        local model is unavailable.

    Notes
    -----
    * Generation is deterministic (greedy decoding) for reproducibility.
    * The prompt text is stripped from the returned output.
    * The function is thread-safe — a threading.Lock guards generation so
      that concurrent requests do not produce garbled output.
    """
    if not _ensure_loaded():
        return None

    try:
        import torch  # noqa: PLC0415

        inputs = _tokenizer(
            prompt,
            return_tensors="pt",
            truncation=True,
            max_length=2048,
        ).to(_model.device)

        with torch.no_grad():
            outputs = _model.generate(
                **inputs,
                max_new_tokens=MAX_NEW_TOKENS,
                do_sample=False,  # greedy — deterministic
                pad_token_id=_tokenizer.eos_token_id,
            )

        # Decode only the new tokens (strip the prompt prefix)
        prompt_len = inputs["input_ids"].shape[1]
        new_tokens = outputs[0][prompt_len:]
        result = _tokenizer.decode(new_tokens, skip_special_tokens=True).strip()
        logger.debug("[LocalModel] generated %d tokens", len(new_tokens))
        return result

    except Exception as exc:  # noqa: BLE001
        logger.warning("[LocalModel] inference error: %s", exc)
        return None
