"""
CYRUS Task Router — distribute tasks across the cluster.

Routes a task to one of the currently registered CYRUS nodes by publishing
a ``task`` event to the shared Redis channel.  The target node's listener
picks up the event and executes the task locally.

Node discovery
--------------
Active nodes are read from the ``cyrus:nodes`` Redis set (populated by the
``node_sync`` keepalive loop).  When Redis is unavailable the router falls
back to the ``CYRUS_CLUSTER_NODES`` env var (comma-separated list), and
ultimately to single-node mode (current node only).

Routing strategies
------------------
``random`` (default) — uniform random selection across all active nodes.
``local``            — always route to the current node (bypass network).

The strategy is selected via ``CYRUS_TASK_ROUTE_STRATEGY`` env var.
"""

from __future__ import annotations

import logging
import os
import random
import time
import uuid
from typing import Any

from distributed.message_bus import publish_event
from distributed.node_sync import NODE_ID, get_active_nodes

logger = logging.getLogger(__name__)

_STRATEGY: str = os.getenv("CYRUS_TASK_ROUTE_STRATEGY", "random")


def _select_node(nodes: list[str]) -> str:
    """Select a target node according to the configured strategy."""
    if _STRATEGY == "local" or not nodes:
        return NODE_ID
    return random.choice(nodes)


def route_task(task: dict[str, Any]) -> str:
    """
    Route a task to a node in the cluster.

    Attaches a unique ``id`` and ``routed_at`` timestamp to the task,
    publishes a ``task`` event, and returns the target node ID.

    Parameters
    ----------
    task : dict
        Arbitrary task descriptor.  A ``type`` key is recommended
        (e.g. ``{"type": "infer", "input": "..."}``).

    Returns
    -------
    str
        ID of the node the task was routed to.
    """
    # Enrich the task with routing metadata
    enriched: dict[str, Any] = {
        "id": task.get("id") or str(uuid.uuid4()),
        "routed_at": time.time(),
        **task,
    }

    nodes = get_active_nodes()
    target = _select_node(nodes)

    published = publish_event(
        {
            "type": "task",
            "target_node": target,
            "source_node": NODE_ID,
            "task": enriched,
        }
    )

    if published:
        logger.debug(
            "[TaskRouter] task=%s routed to node=%s (strategy=%s, cluster_size=%d)",
            enriched["id"],
            target,
            _STRATEGY,
            len(nodes),
        )
    else:
        logger.warning(
            "[TaskRouter] task=%s could not be published (Redis offline); executing locally",
            enriched["id"],
        )
        target = NODE_ID

    return target
