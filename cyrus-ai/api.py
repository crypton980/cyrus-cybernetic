"""
CYRUS AI Service — FastAPI application.

Exposes the memory system, learning engine, decision brain, planner, and
autonomy loop over HTTP so the Node.js backend can integrate without
spawning in-process Python.

Endpoints
---------
GET  /health                        → liveness probe
GET  /memory/stats                  → collection statistics
POST /memory/store                  → embed and persist a memory entry
POST /memory/query                  → semantic similarity search
DELETE /memory/{id}                 → hard-delete a memory entry
POST /feedback                      → log interaction feedback + learning strategy
POST /interaction                   → log a raw CYRUS interaction
POST /brain/process                 → LLM reasoning + plan + context retrieval
POST /plan                          → generate a multi-step execution plan
POST /cognitive/process             → full multi-agent pipeline
GET  /system/performance            → metrics summary + recent records
DELETE /system/performance/metrics  → clear metrics store
GET  /system/benchmark              → run built-in benchmark suite
GET  /system/state                  → real-time system health (queue depth, uptime…)
POST /platform/ingest               → enqueue a real-time event
GET  /platform/intelligence         → last fused intelligence picture
POST /platform/action               → execute an external action
"""

import logging
import os
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from memory_service import store_memory, query_memory, delete_memory, memory_stats
from learning_engine import learn_from_feedback, update_behavior, store_interaction
from brain import process_input, process_input_multi_agent
from planner import create_plan, describe_plan
from autonomy import start_autonomy_loop
from metrics.tracker import get_metrics, get_summary, clear_metrics
from ingestion.stream_ingestor import ingest_event, queue_size, ingestor_stats
from fusion.fusion_engine import get_last_fusion
from actions.action_executor import execute_action, list_action_types

# ── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("cyrus.ai")


# ── Lifespan (autonomy thread) ────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start the autonomy monitoring loop when the service boots."""
    thread = start_autonomy_loop()
    logger.info("[App] Autonomy loop started (thread=%s)", thread.name)
    yield
    # Daemon thread — stops automatically when process exits.
    logger.info("[App] Shutting down")


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="CYRUS AI Service",
    description="Memory, learning, reasoning, and decision intelligence microservice.",
    version="2.0.0",
    docs_url="/docs" if os.getenv("NODE_ENV") != "production" else None,
    redoc_url=None,
    lifespan=lifespan,
)

# Restrict CORS to the Node.js backend only
_ALLOWED_ORIGINS = os.getenv("AI_ALLOWED_ORIGINS", "http://localhost:3105").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)

# ── Request / response models ─────────────────────────────────────────────────


class MemoryStoreRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=50_000)
    metadata: dict[str, Any] = Field(default_factory=dict)


class MemoryQueryRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2_000)
    n_results: int = Field(default=5, ge=1, le=20)


class FeedbackRequest(BaseModel):
    input: str = Field(..., min_length=1)
    response: str = Field(..., min_length=1)
    rating: float = Field(..., ge=1.0, le=5.0)
    userId: str | None = None
    context: str | None = None


class InteractionRequest(BaseModel):
    userInput: str = Field(..., min_length=1)
    cyrusResponse: str = Field(..., min_length=1)
    metadata: dict[str, Any] = Field(default_factory=dict)


class BrainRequest(BaseModel):
    input: str = Field(..., min_length=1, max_length=5_000)
    n_context: int = Field(default=5, ge=1, le=10)


class PlanRequest(BaseModel):
    input: str = Field(..., min_length=1, max_length=5_000)
    intent: str | None = Field(default=None)


class CognitiveRequest(BaseModel):
    """Request model for the multi-agent cognitive pipeline."""

    input: str = Field(..., min_length=1, max_length=5_000)
    n_memory: int = Field(default=5, ge=1, le=20)
    feedback: dict[str, Any] | None = Field(
        default=None,
        description=(
            "Optional feedback payload for the LearningAgent step. "
            'Must contain at least "rating" (float 1–5).'
        ),
    )


# ── Routes ────────────────────────────────────────────────────────────────────


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "cyrus-ai", "version": "2.0.0"}


@app.get("/memory/stats")
def get_memory_stats() -> dict[str, Any]:
    return memory_stats()


@app.post("/memory/store")
def store(req: MemoryStoreRequest) -> dict[str, str]:
    try:
        memory_id = store_memory(req.text, req.metadata)
        return {"status": "stored", "id": memory_id}
    except Exception as exc:  # noqa: BLE001
        logger.exception("[API] /memory/store failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/memory/query")
def query(req: MemoryQueryRequest) -> dict[str, Any]:
    try:
        results = query_memory(req.query, n_results=req.n_results)
        return results
    except Exception as exc:  # noqa: BLE001
        logger.exception("[API] /memory/query failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.delete("/memory/{memory_id}")
def delete(memory_id: str) -> dict[str, Any]:
    success = delete_memory(memory_id)
    if not success:
        raise HTTPException(status_code=404, detail="Memory entry not found")
    return {"status": "deleted", "id": memory_id}


@app.post("/feedback")
def feedback(req: FeedbackRequest) -> dict[str, Any]:
    """Log feedback, run learning engine, and determine behavioural strategy."""
    try:
        payload = req.model_dump()
        learning_result = learn_from_feedback(payload)
        strategy_result = update_behavior(payload)
        return {
            "learning": learning_result,
            "strategy": strategy_result,
        }
    except Exception as exc:  # noqa: BLE001
        logger.exception("[API] /feedback failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/interaction")
def interaction(req: InteractionRequest) -> dict[str, str]:
    try:
        memory_id = store_interaction(req.userInput, req.cyrusResponse, req.metadata)
        return {"status": "logged", "id": memory_id}
    except Exception as exc:  # noqa: BLE001
        logger.exception("[API] /interaction failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/brain/process")
def brain_process(req: BrainRequest) -> dict[str, Any]:
    """Run LLM reasoning (with keyword fallback) and return plan + decision."""
    try:
        result = process_input(req.input, n_context=req.n_context)
        return result
    except Exception as exc:  # noqa: BLE001
        logger.exception("[API] /brain/process failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/plan")
def plan(req: PlanRequest) -> dict[str, Any]:
    """Generate a multi-step execution plan without running the full brain."""
    steps = create_plan(req.input, intent=req.intent)
    detail = describe_plan(steps)
    return {"plan": steps, "plan_detail": detail, "intent": req.intent or "default"}


@app.post("/cognitive/process")
def cognitive_process(req: CognitiveRequest) -> dict[str, Any]:
    """
    Run the full multi-agent intelligence pipeline.

    Pipeline:
      SecurityAgent → MemoryAgent → AnalysisAgent → MissionAgent
      (→ LearningAgent when feedback is supplied)

    Returns
    -------
    dict with keys:
        ``type``        — "multi-agent"
        ``security``    — input validation result
        ``memory``      — ChromaDB retrieval results
        ``analysis``    — LLM deep analysis
        ``mission``     — execution plan
        ``learning``    — strategy (only when feedback provided)
        ``pipeline_ms`` — elapsed processing time in milliseconds
    """
    try:
        result = process_input_multi_agent(
            req.input,
            feedback=req.feedback,
            n_memory=req.n_memory,
        )
        return result
    except Exception as exc:  # noqa: BLE001
        logger.exception("[API] /cognitive/process failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/system/performance")
def system_performance() -> dict[str, Any]:
    """
    Return current performance telemetry for the CYRUS pipeline.

    Includes aggregate statistics computed from the in-memory metrics store
    and the last 50 individual request records.

    Returns
    -------
    dict with keys:
        ``summary``  — aggregate stats (avg latency, p95, error_rate, …)
        ``metrics``  — last 50 individual request metrics
        ``count``    — total entries in the metrics store
    """
    summary = get_summary()
    recent = get_metrics(limit=50)
    return {
        "summary": summary,
        "metrics": recent,
        "count": summary.get("count", 0),
    }


@app.delete("/system/performance/metrics")
def clear_performance_metrics() -> dict[str, Any]:
    """Clear the in-memory metrics store and return the number of entries removed."""
    cleared = clear_metrics()
    return {"status": "cleared", "removed": cleared}


@app.get("/system/benchmark")
def system_benchmark() -> dict[str, Any]:
    """
    Run the built-in benchmark suite against the Commander and return results.

    Each test exercises a different agent/intent combination and reports
    pass/fail, latency, and evaluation score.

    This endpoint is compute-bound; avoid calling it under high load.
    """
    try:
        from benchmarks.test_suite import run_benchmark  # noqa: PLC0415
        from brain import _get_commander              # noqa: PLC0415

        commander = _get_commander()
        results = run_benchmark(commander)
        return results
    except Exception as exc:  # noqa: BLE001
        logger.exception("[API] /system/benchmark failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/system/state")
def system_state() -> dict[str, Any]:
    """
    Return real-time system health and operational state.

    Returns
    -------
    dict with keys:
        ``status``          — always "active"
        ``uptime_sec``      — process uptime in seconds
        ``events_queue``    — pending events in ingestion queue
        ``ingestor``        — ingestion statistics (total_ingested, drop_rate)
        ``metrics_count``   — number of metric entries in store
        ``available_actions`` — list of registered action types
    """
    import time as _time  # noqa: PLC0415
    try:
        start_time = getattr(system_state, "_start_time", None)
        if start_time is None:
            system_state._start_time = _time.time()  # type: ignore[attr-defined]
            start_time = system_state._start_time
        uptime = round(_time.time() - start_time, 1)
    except Exception:  # noqa: BLE001
        uptime = 0.0

    metrics_summary = get_summary()
    return {
        "status": "active",
        "uptime_sec": uptime,
        "events_queue": queue_size(),
        "ingestor": ingestor_stats(),
        "metrics_count": metrics_summary.get("count", 0),
        "available_actions": list_action_types(),
    }


# ── Platform API ───────────────────────────────────────────────────────────────


class IngestRequest(BaseModel):
    source: str = Field(..., description="Origin system or device identifier")
    type: str = Field(..., description="Event category (alert, telemetry, command, …)")
    payload: dict[str, Any] = Field(default_factory=dict)
    priority: int = Field(default=5, ge=1, le=10)
    correlation_id: str = Field(default="")


@app.post("/platform/ingest")
def platform_ingest(req: IngestRequest) -> dict[str, Any]:
    """
    Enqueue a real-time event into the ingestion layer.

    The event will be picked up and processed by the autonomy loop on the
    next cycle (default: 30 seconds).  For immediate processing the caller
    can POST to ``/cognitive/process`` directly.

    Returns
    -------
    dict with ``queued`` (bool), ``queue_size`` (int), and ``dropped`` (bool).
    """
    queued = ingest_event(
        source=req.source,
        type=req.type,
        payload=req.payload,
        priority=req.priority,
        correlation_id=req.correlation_id,
    )
    return {
        "queued": queued,
        "dropped": not queued,
        "queue_size": queue_size(),
    }


@app.get("/platform/intelligence")
def platform_intelligence() -> dict[str, Any]:
    """
    Return the most recent fused intelligence picture.

    The fusion snapshot is updated after every successful Commander pipeline
    execution and by the autonomy loop when live events are processed.

    Returns ``{"available": false}`` if no fusion has occurred yet.
    """
    fusion = get_last_fusion()
    if fusion is None:
        return {"available": False}
    return {"available": True, "fusion": fusion}


class ActionRequest(BaseModel):
    action: str = Field(..., description="Action type (log, alert, store, metric, webhook, …)")
    payload: dict[str, Any] = Field(default_factory=dict)


@app.post("/platform/action")
def platform_action(req: ActionRequest) -> dict[str, Any]:
    """
    Execute a named external action.

    Built-in actions: ``log``, ``alert``, ``store``, ``metric``, ``webhook``.
    Custom actions can be registered via ``register_action_handler()``.

    Returns
    -------
    dict — ActionResult serialisation with ``action``, ``status``, ``detail``.
    """
    return execute_action(req.action, req.payload)
