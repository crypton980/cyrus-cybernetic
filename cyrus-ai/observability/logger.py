"""
CYRUS Structured Logger (Python / loguru)

Provides a production-ready, structured logger backed by loguru with a
stdlib ``logging`` bridge so that third-party libraries that use the stdlib
``logging`` module (FastAPI, uvicorn, httpx, chromadb, etc.) are routed
through the same sink.

Features
--------
* JSON-lines output in production (``CYRUS_LOG_FORMAT=json`` or
  ``NODE_ENV=production``)
* Human-readable colourised output in development
* Configurable level via ``CYRUS_LOG_LEVEL`` env var (default: ``INFO``)
* Automatic log rotation when the file exceeds ``CYRUS_LOG_MAX_BYTES``
* Retention of last ``CYRUS_LOG_KEEP`` rotated files
* Correlation-ID context via ``logger.bind(request_id=...)``

Usage
-----
::

    from observability.logger import get_logger

    log = get_logger(__name__)
    log.info("AI service started", port=8001)
    log.bind(request_id="abc123").warning("Slow inference", latency_ms=3200)
"""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path
from typing import TYPE_CHECKING

from loguru import logger as _loguru_logger

if TYPE_CHECKING:
    pass

# ── Configuration ──────────────────────────────────────────────────────────────

_LEVEL: str = os.getenv("CYRUS_LOG_LEVEL", "INFO").upper()
_FORMAT: str = os.getenv("CYRUS_LOG_FORMAT", "json" if os.getenv("NODE_ENV") == "production" else "pretty")
_LOG_FILE: str = os.getenv("CYRUS_LOG_FILE", "")
_MAX_BYTES: int = int(os.getenv("CYRUS_LOG_MAX_BYTES", str(10 * 1024 * 1024)))   # 10 MB
_KEEP_FILES: int = int(os.getenv("CYRUS_LOG_KEEP", "7"))

# ── Loguru sinks ───────────────────────────────────────────────────────────────

_PRETTY_FORMAT = (
    "<green>{time:HH:mm:ss.SSS}</green> "
    "| <level>{level: <8}</level> "
    "| <cyan>{name}</cyan>:<cyan>{line}</cyan> "
    "— <level>{message}</level>"
    "{extra}"
)


def _json_serializer(record: dict) -> str:
    """Loguru JSON serialiser used as the sink formatter."""
    import json  # noqa: PLC0415
    import time as _time  # noqa: PLC0415

    payload = {
        "timestamp": record["time"].timestamp(),
        "level": record["level"].name,
        "message": record["message"],
        "logger": record["name"],
        "file": record["file"].name,
        "line": record["line"],
        "function": record["function"],
        **record["extra"],
    }
    if record["exception"] is not None:
        exc = record["exception"]
        payload["exception"] = {
            "type": exc.type.__name__ if exc.type else None,
            "value": str(exc.value) if exc.value else None,
        }
    return json.dumps(payload, default=str)


# ── stdlib → loguru bridge ────────────────────────────────────────────────────


class _InterceptHandler(logging.Handler):
    """
    Route stdlib ``logging`` records into loguru.

    Install once via ``logging.basicConfig(handlers=[_InterceptHandler()])``.
    """

    def emit(self, record: logging.LogRecord) -> None:
        try:
            level = _loguru_logger.level(record.levelname).name
        except ValueError:
            level = record.levelno  # type: ignore[assignment]

        frame, depth = sys._getframe(6), 6
        while frame and frame.f_code.co_filename == logging.__file__:
            frame = frame.f_back  # type: ignore[assignment]
            depth += 1

        _loguru_logger.opt(depth=depth, exception=record.exc_info).log(
            level, record.getMessage()
        )


# ── Public API ─────────────────────────────────────────────────────────────────

_configured: bool = False


def configure_logging() -> None:
    """
    Configure loguru sinks and bridge stdlib logging.

    Call once at application startup (from ``api.py`` lifespan or module init).
    Safe to call multiple times — subsequent calls are no-ops.
    """
    global _configured  # noqa: PLW0603
    if _configured:
        return

    # Remove default loguru handler
    _loguru_logger.remove()

    # Console sink
    if _FORMAT == "json":
        _loguru_logger.add(
            sys.stdout,
            level=_LEVEL,
            format=_json_serializer,
            colorize=False,
            serialize=False,
        )
    else:
        _loguru_logger.add(
            sys.stdout,
            level=_LEVEL,
            format=_PRETTY_FORMAT,
            colorize=True,
        )

    # Optional file sink with rotation
    if _LOG_FILE:
        _loguru_logger.add(
            _LOG_FILE,
            level=_LEVEL,
            rotation=_MAX_BYTES,
            retention=_KEEP_FILES,
            format=_json_serializer if _FORMAT == "json" else _PRETTY_FORMAT,
            colorize=False,
            enqueue=True,       # thread-safe async write
            catch=True,
        )

    # Bridge stdlib logging → loguru
    logging.basicConfig(handlers=[_InterceptHandler()], level=0, force=True)
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access", "fastapi", "httpx"):
        _lib_logger = logging.getLogger(name)
        _lib_logger.handlers = [_InterceptHandler()]
        _lib_logger.propagate = False

    _configured = True


def get_logger(name: str = "cyrus") -> "loguru.Logger":
    """Return a loguru logger bound to *name* as the ``module`` extra."""
    configure_logging()
    return _loguru_logger.bind(module=name)
