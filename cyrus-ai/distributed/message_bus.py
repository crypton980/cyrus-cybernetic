"""
CYRUS Distributed Message Bus — Redis pub/sub for inter-node communication.

All CYRUS nodes publish and subscribe to a shared Redis channel so that
memory updates, task events, and intelligence signals propagate across the
entire cluster in real-time.

Resilience design
-----------------
* The Redis client is lazily initialised on first use.
* If Redis is unavailable at startup or the connection drops, every public
  function degrades gracefully:
  - ``publish_event()``   → logs a warning and returns False
  - ``subscribe_events()``→ logs a warning and returns without blocking
  - ``is_redis_available``→ returns False
* The client is reset after a connection failure so that the next call
  retries the connection automatically (e.g. when Redis comes back up).

Configuration (env vars)
------------------------
REDIS_URL          → full Redis connection URL (default: redis://localhost:6379/0)
CYRUS_EVENT_CHANNEL → pub/sub channel name (default: "cyrus_events")
"""

from __future__ import annotations

import json
import logging
import os
import threading
from typing import Any, Callable

logger = logging.getLogger(__name__)

# ── Configuration ──────────────────────────────────────────────────────────────

REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379")
CHANNEL: str = os.getenv("CYRUS_EVENT_CHANNEL", "cyrus_events")
_CONNECT_TIMEOUT_SEC: int = 2

# ── Redis client (lazy singleton, thread-safe) ─────────────────────────────────

_client_lock: threading.Lock = threading.Lock()
_client: Any | None = None  # redis.Redis instance or None


def _reset_client() -> None:
    """Clear the cached client so the next call retries the connection."""
    global _client  # noqa: PLW0603
    with _client_lock:
        _client = None


def get_redis_client() -> Any | None:
    """
    Return a connected ``redis.Redis`` client, or ``None`` if Redis is
    unavailable.

    The client is cached after the first successful connection.  On
    connection failure the cache is not populated, so subsequent calls
    will retry.
    """
    global _client  # noqa: PLW0603

    with _client_lock:
        if _client is not None:
            return _client

    try:
        import redis as _redis  # noqa: PLC0415

        r: Any = _redis.Redis.from_url(
            REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=_CONNECT_TIMEOUT_SEC,
            socket_timeout=_CONNECT_TIMEOUT_SEC,
        )
        r.ping()  # verify reachability

        with _client_lock:
            _client = r

        # Log only the host/db portion — omit credentials from the URL
        safe_url = REDIS_URL.split("@")[-1]
        logger.info("[MessageBus] connected to Redis at %s channel=%s", safe_url, CHANNEL)
        return _client

    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "[MessageBus] Redis unavailable (%s) — distributed messaging disabled",
            exc,
        )
        return None


def is_redis_available() -> bool:
    """Return True if a Redis connection is established."""
    return get_redis_client() is not None


# ── Public API ─────────────────────────────────────────────────────────────────


def publish_event(event: dict[str, Any]) -> bool:
    """
    Publish a serialised event dict to the shared cluster channel.

    Parameters
    ----------
    event : dict
        Arbitrary JSON-serialisable event data.

    Returns
    -------
    bool
        True if published successfully, False if Redis is unavailable or
        the publish call fails.
    """
    r = get_redis_client()
    if r is None:
        return False
    try:
        r.publish(CHANNEL, json.dumps(event, default=str))
        logger.debug("[MessageBus] published type=%s", event.get("type", "?"))
        return True
    except Exception as exc:  # noqa: BLE001
        logger.warning("[MessageBus] publish failed: %s", exc)
        _reset_client()
        return False


def subscribe_events(callback: Callable[[dict[str, Any]], None]) -> None:
    """
    Subscribe to the cluster channel and invoke *callback* for each message.

    This is a **blocking** function — it runs an infinite receive loop.
    Call it from a daemon thread, not from the FastAPI event loop.

    Parameters
    ----------
    callback : Callable[[dict], None]
        Function invoked with the deserialised event dict.  Exceptions
        raised by the callback are caught and logged so the loop
        continues.

    Notes
    -----
    The loop exits if the Redis connection is broken or if Redis is not
    reachable at call time.  The caller (``start_listener``) should
    restart this function after a delay for resilience.
    """
    r = get_redis_client()
    if r is None:
        logger.warning("[MessageBus] subscribe skipped — Redis not available")
        return

    try:
        pubsub = r.pubsub()
        pubsub.subscribe(CHANNEL)
        logger.info("[MessageBus] subscribed to channel=%s", CHANNEL)

        for message in pubsub.listen():
            if message.get("type") != "message":
                continue
            try:
                data: dict[str, Any] = json.loads(message["data"])
                callback(data)
            except json.JSONDecodeError as exc:
                logger.warning("[MessageBus] invalid JSON in message: %s", exc)
            except Exception as exc:  # noqa: BLE001
                logger.warning("[MessageBus] callback error: %s", exc)

    except Exception as exc:  # noqa: BLE001
        logger.error("[MessageBus] subscribe loop terminated: %s", exc)
        _reset_client()
