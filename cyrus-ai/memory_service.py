"""
CYRUS Memory Service — persistent vector memory using ChromaDB.

Stores and retrieves semantic memories (conversations, decisions, mission logs,
feedback entries, training documents) using embedding-based similarity search.

The ChromaDB client is configured to persist to disk so memories survive
service restarts.  Set CHROMA_PERSIST_DIR env var to override the default.
"""

import os
import uuid
import logging
from typing import Any

import chromadb
from chromadb.config import Settings

logger = logging.getLogger(__name__)

PERSIST_DIR = os.getenv("CHROMA_PERSIST_DIR", "./chroma_data")

# ── Client & collection ───────────────────────────────────────────────────────

_client = chromadb.PersistentClient(
    path=PERSIST_DIR,
    settings=Settings(anonymized_telemetry=False),
)

_collection = _client.get_or_create_collection(
    name="cyrus_memory",
    metadata={"hnsw:space": "cosine"},
)


# ── Public interface ──────────────────────────────────────────────────────────

def store_memory(text: str, metadata: dict[str, Any]) -> str:
    """Embed and persist a memory entry.  Returns the generated memory ID."""
    memory_id = str(uuid.uuid4())
    _collection.add(
        documents=[text],
        metadatas=[metadata],
        ids=[memory_id],
    )
    logger.info("[Memory] stored id=%s type=%s", memory_id, metadata.get("type", "general"))
    return memory_id


def query_memory(query: str, n_results: int = 5) -> dict[str, Any]:
    """Return the top-N semantically similar memories for the given query."""
    results = _collection.query(
        query_texts=[query],
        n_results=n_results,
        include=["documents", "metadatas", "distances"],
    )
    return results


def delete_memory(memory_id: str) -> bool:
    """Hard-delete a specific memory entry by ID."""
    try:
        _collection.delete(ids=[memory_id])
        logger.info("[Memory] deleted id=%s", memory_id)
        return True
    except Exception as exc:  # noqa: BLE001
        logger.warning("[Memory] delete failed id=%s: %s", memory_id, exc)
        return False


def memory_stats() -> dict[str, Any]:
    """Return collection-level statistics."""
    return {
        "collection": _collection.name,
        "count": _collection.count(),
        "persist_dir": PERSIST_DIR,
    }
