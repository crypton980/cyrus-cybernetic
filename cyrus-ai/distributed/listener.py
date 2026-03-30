"""
CYRUS Distributed Event Listener — inter-node intelligence synchronisation.

Subscribes to the Redis cluster channel and processes incoming events
published by other CYRUS nodes.  Runs as a blocking daemon thread so that
the main process remains free to handle HTTP requests.

Event types handled
-------------------
``memory_update``  — a remote node stored a new memory entry.
                     Forwarded to the local ingestion queue so the autonomy
                     loop can optionally react to it.
``task``           — a task routed to this node by the task router.
                     Logged for now; extend ``_handle_task()`` for custom
                     task execution.
``*``              — all unknown types are logged at DEBUG level.

Resilience
----------
* The outer restart loop in ``start_listener()`` ensures the subscriber
  thread keeps running even if the Redis connection drops.
* Per-message exceptions are caught inside ``handle_event()`` so that a
  single bad message never kills the loop.
"""

from __future__ import annotations

import logging
import time

from distributed.message_bus import subscribe_events
from distributed.node_sync import NODE_ID

logger = logging.getLogger(__name__)

_RESTART_DELAY_SEC: int = 10


# ── Handlers ───────────────────────────────────────────────────────────────────


def _handle_memory_update(event: dict) -> None:
    """Forward a remote memory update into the local ingestion queue."""
    source_node = event.get("node_id", "unknown")
    # Ignore our own events (we already stored the memory locally)
    if source_node == NODE_ID:
        return

    data = event.get("data", {})
    logger.info(
        "[Listener] memory_update from node=%s: %s",
        source_node,
        str(data)[:120],
    )

    try:
        from ingestion.stream_ingestor import ingest_event  # noqa: PLC0415

        payload: dict = data if isinstance(data, dict) else {"raw": str(data)}
        ingest_event(
            source=f"distributed/{source_node}",
            type="memory_update",
            payload=payload,
            priority=3,
            correlation_id=event.get("correlation_id", ""),
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("[Listener] failed to enqueue memory_update: %s", exc)


def _handle_task(event: dict) -> None:
    """Handle a task routed to this node."""
    target = event.get("target_node", "?")
    if target not in (NODE_ID, "broadcast"):
        return  # not for us
    source = event.get("source_node", "unknown")
    task = event.get("task", {})
    logger.info(
        "[Listener] task received from node=%s task_id=%s",
        source,
        task.get("id", "?"),
    )
    # Extendable: dispatch to task executor here


_HANDLERS = {
    "memory_update": _handle_memory_update,
    "task": _handle_task,
}


def handle_event(event: dict) -> None:
    """
    Route an incoming distributed event to the appropriate handler.

    This function is passed as the callback to ``subscribe_events()`` and
    is called once per message received from the Redis channel.
    """
    event_type = event.get("type", "unknown")
    handler = _HANDLERS.get(event_type)
    if handler:
        try:
            handler(event)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "[Listener] handler for type=%s raised: %s", event_type, exc
            )
    else:
        logger.debug(
            "[Listener] unhandled event type=%s node=%s",
            event_type,
            event.get("node_id", "?"),
        )


# ── Entry point ────────────────────────────────────────────────────────────────


def start_listener() -> None:
    """
    Start the distributed event listener.

    **Blocking** — runs until the process exits.  Call this from a daemon
    thread via ``threading.Thread(target=start_listener, daemon=True).start()``.

    Automatically restarts the subscribe loop after a ``_RESTART_DELAY_SEC``
    delay if the Redis connection is lost, so the listener recovers when
    Redis comes back online.
    """
    logger.info("[Listener] distributed event listener starting on node=%s", NODE_ID)
    while True:
        try:
            subscribe_events(handle_event)
        except Exception as exc:  # noqa: BLE001
            logger.warning("[Listener] subscribe loop exited: %s — restarting in %ds", exc, _RESTART_DELAY_SEC)
        time.sleep(_RESTART_DELAY_SEC)
