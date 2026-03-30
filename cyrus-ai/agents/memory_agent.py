"""
CYRUS MemoryAgent — semantic memory retrieval specialist.

Wraps the ChromaDB-backed `query_memory` function from the memory_service
module.  Returns a standardised result dict so the Commander can consume
it without knowing the underlying storage implementation.
"""

from __future__ import annotations

import logging
from typing import Any

from agents.base_agent import BaseAgent
from memory_service import query_memory

logger = logging.getLogger(__name__)


class MemoryAgent(BaseAgent):
    """
    Retrieves semantically similar memories from the vector store.

    Parameters
    ----------
    n_results : int
        Number of top-K results to retrieve (default: 5).
    """

    def __init__(self, n_results: int = 5) -> None:
        super().__init__("memory")
        self._n_results = n_results

    def process(self, input_text: str, **kwargs: Any) -> dict[str, Any]:
        """
        Query ChromaDB for memories semantically similar to *input_text*.

        Returns
        -------
        dict
            Raw ChromaDB result structure with keys `documents`, `ids`,
            `distances`, `metadatas` — or an error payload on failure.
        """
        try:
            results = query_memory(input_text, n_results=self._n_results)
            self._logger.info(
                "[MemoryAgent] retrieved %d results",
                len((results.get("ids") or [[]])[0]),
            )
            return results
        except Exception as exc:  # noqa: BLE001
            return self._error_result("memory retrieval failed", exc)

    def get_documents(self, memory_results: dict[str, Any]) -> list[str]:
        """
        Helper: extract the flat document list from a query result.
        """
        docs = (memory_results.get("documents") or [[]])[0]
        return [d for d in docs if d]
