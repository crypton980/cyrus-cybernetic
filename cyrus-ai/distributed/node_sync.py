"""
CYRUS Node Sync — propagate local state changes to the distributed cluster.

Each CYRUS instance has a unique ``NODE_ID`` (set via the ``CYRUS_NODE_ID``
environment variable).  When local state changes (e.g. a new memory is
stored), ``sync_memory_update()`` publishes the change to the Redis channel
so all other nodes can apply it to their own context.

Node registration
-----------------
On startup the node registers itself in a Redis set (``cyrus:nodes``) with
a TTL of 60 seconds.  A background keepalive renews the TTL every 30 seconds
so the set always reflects currently alive nodes.  ``get_active_nodes()``
reads this set and is used by the task router.

Graceful degradation
--------------------
All functions are safe to call when Redis is offline — they log a debug
message and return without raising.
"""

from __future__ import annotations

import logging
import os
import threading
import time
from typing import Any

from distributed.message_bus import publish_event, get_redis_client

logger = logging.getLogger(__name__)

# ── Node identity ──────────────────────────────────────────────────────────────

NODE_ID: str = os.getenv("CYRUS_NODE_ID", "node-primary")

_REGISTRY_KEY: str = "cyrus:nodes"
_REGISTRY_TTL_SEC: int = 60
_KEEPALIVE_INTERVAL_SEC: int = 30


# ── Node registration ──────────────────────────────────────────────────────────


def _register_node() -> None:
    """Add this node to the Redis cluster registry with a TTL."""
    r = get_redis_client()
    if r is None:
        return
    try:
        r.sadd(_REGISTRY_KEY, NODE_ID)
        r.expire(_REGISTRY_KEY, _REGISTRY_TTL_SEC)
        logger.info("[NodeSync] node=%s registered in cluster registry", NODE_ID)
    except Exception as exc:  # noqa: BLE001
        logger.debug("[NodeSync] registry write failed: %s", exc)


def _keepalive_loop() -> None:
    """Daemon loop — refreshes the node registry TTL every 30 seconds."""
    while True:
        time.sleep(_KEEPALIVE_INTERVAL_SEC)
        _register_node()


def start_node_keepalive() -> threading.Thread:
    """
    Register this node in the cluster registry and start the keepalive thread.

    Safe to call multiple times — the thread is a daemon and will not prevent
    process shutdown.
    """
    _register_node()
    thread = threading.Thread(
        target=_keepalive_loop,
        daemon=True,
        name=f"cyrus-node-keepalive-{NODE_ID}",
    )
    thread.start()
    return thread


def get_active_nodes() -> list[str]:
    """
    Return the list of currently registered cluster nodes.

    Falls back to ``[NODE_ID]`` when Redis is unavailable.
    """
    r = get_redis_client()
    if r is None:
        return [NODE_ID]
    try:
        members = r.smembers(_REGISTRY_KEY)
        return list(members) if members else [NODE_ID]
    except Exception as exc:  # noqa: BLE001
        logger.debug("[NodeSync] get_active_nodes failed: %s", exc)
        return [NODE_ID]


# ── Sync helpers ───────────────────────────────────────────────────────────────


def sync_memory_update(memory_entry: dict[str, Any]) -> None:
    """
    Publish a ``memory_update`` event so all cluster nodes can react to
    a new memory being stored on this node.

    Parameters
    ----------
    memory_entry : dict
        Should contain at minimum ``{"text": str, "metadata": dict}``.
    """
    published = publish_event(
        {
            "type": "memory_update",
            "node_id": NODE_ID,
            "data": memory_entry,
        }
    )
    if published:
        logger.debug("[NodeSync] memory_update published from node=%s", NODE_ID)
    else:
        logger.debug("[NodeSync] memory_update skipped (Redis offline)")
