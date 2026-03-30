"""cyrus-ai/ingestion package — real-time event ingestion."""

from ingestion.stream_ingestor import (
    ingest_event,
    get_event,
    drain_events,
    queue_size,
    IngestEvent,
)

__all__ = [
    "ingest_event",
    "get_event",
    "drain_events",
    "queue_size",
    "IngestEvent",
]
