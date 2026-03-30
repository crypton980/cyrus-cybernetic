"""
CYRUS Distributed Tracing (OpenTelemetry)

Instruments the FastAPI application with OpenTelemetry traces.  The module
gracefully degrades when the optional OpenTelemetry packages are not installed
so that the main service always starts regardless.

Features
--------
* FastAPI auto-instrumentation (every HTTP request becomes a span)
* OTLP exporter configured via ``OTEL_EXPORTER_OTLP_ENDPOINT``
  (defaults to disabled — Jaeger/Tempo/etc. endpoint optional)
* Console exporter enabled when ``CYRUS_TRACING_CONSOLE=true``
* Service name configurable via ``OTEL_SERVICE_NAME``
  (default: ``cyrus-ai``)
* Safe no-op when ``CYRUS_TRACING_ENABLED=false`` or packages absent

Configuration (env vars)
------------------------
CYRUS_TRACING_ENABLED         → ``true`` | ``false`` (default: ``true``)
OTEL_SERVICE_NAME             → service name tag (default: ``cyrus-ai``)
OTEL_EXPORTER_OTLP_ENDPOINT   → gRPC OTLP endpoint, e.g. ``http://jaeger:4317``
CYRUS_TRACING_CONSOLE         → ``true`` to also print spans to stdout
"""

from __future__ import annotations

import logging
import os
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from fastapi import FastAPI

logger = logging.getLogger(__name__)

_ENABLED: bool = os.getenv("CYRUS_TRACING_ENABLED", "true").lower() == "true"
_SERVICE_NAME: str = os.getenv("OTEL_SERVICE_NAME", "cyrus-ai")
_OTLP_ENDPOINT: str = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "")
_CONSOLE: bool = os.getenv("CYRUS_TRACING_CONSOLE", "false").lower() == "true"


def setup_tracing(app: "FastAPI") -> bool:
    """
    Instrument *app* with OpenTelemetry tracing.

    Returns ``True`` if tracing was successfully configured, ``False`` when
    the OpenTelemetry packages are not installed or tracing is disabled.

    Parameters
    ----------
    app : FastAPI
        The FastAPI application instance to instrument.
    """
    if not _ENABLED:
        logger.info("[Tracing] disabled via CYRUS_TRACING_ENABLED=false")
        return False

    try:
        from opentelemetry import trace  # noqa: PLC0415
        from opentelemetry.sdk.trace import TracerProvider  # noqa: PLC0415
        from opentelemetry.sdk.trace.export import BatchSpanProcessor  # noqa: PLC0415
        from opentelemetry.sdk.resources import Resource  # noqa: PLC0415
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor  # noqa: PLC0415
    except ImportError as exc:
        logger.info(
            "[Tracing] OpenTelemetry packages not installed (%s) — tracing disabled", exc
        )
        return False

    resource = Resource.create({"service.name": _SERVICE_NAME})
    provider = TracerProvider(resource=resource)
    span_processors: list[Any] = []

    # OTLP exporter (Jaeger / Grafana Tempo / etc.)
    if _OTLP_ENDPOINT:
        try:
            from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import (  # noqa: PLC0415
                OTLPSpanExporter,
            )

            otlp_exporter = OTLPSpanExporter(endpoint=_OTLP_ENDPOINT, insecure=True)
            span_processors.append(BatchSpanProcessor(otlp_exporter))
            logger.info("[Tracing] OTLP exporter configured → %s", _OTLP_ENDPOINT)
        except ImportError:
            logger.warning(
                "[Tracing] opentelemetry-exporter-otlp-proto-grpc not installed — OTLP disabled"
            )

    # Optional console exporter for local debugging
    if _CONSOLE:
        try:
            from opentelemetry.sdk.trace.export.in_memory_span_exporter import (  # noqa: PLC0415
                InMemorySpanExporter,
            )
            from opentelemetry.sdk.trace.export import ConsoleSpanExporter  # noqa: PLC0415

            span_processors.append(BatchSpanProcessor(ConsoleSpanExporter()))
            logger.info("[Tracing] console span exporter enabled")
        except Exception:  # noqa: BLE001
            pass

    for processor in span_processors:
        provider.add_span_processor(processor)

    trace.set_tracer_provider(provider)

    # Auto-instrument all FastAPI routes
    FastAPIInstrumentor.instrument_app(
        app,
        tracer_provider=provider,
        excluded_urls="/healthz,/health,/metrics",
    )

    logger.info("[Tracing] OpenTelemetry instrumentation active service=%s", _SERVICE_NAME)
    return True
