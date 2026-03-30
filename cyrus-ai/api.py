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
GET  /system/health                 → node health + distributed status
GET  /system/node                   → node identity + cluster info
POST /platform/ingest               → enqueue a real-time event
GET  /platform/intelligence         → last fused intelligence picture
POST /platform/action               → execute an external action
GET  /model/status                  → local model info and availability
GET  /training/stats                → training dataset stats + job status
POST /training/trigger              → manually trigger a fine-tuning run
GET  /control/audit                 → recent immutable audit log entries
GET  /control/audit/stats           → audit log statistics + chain hash
POST /control/audit/verify          → verify hash chain integrity
GET  /control/pending-actions       → list pending HITL approval requests
POST /control/approve/{action_id}   → approve a pending action
POST /control/reject/{action_id}    → reject a pending action
GET  /control/lockdown              → current lockdown state
POST /control/lockdown/enable       → enable safety lockdown (halt all processing)
POST /control/lockdown/disable      → disable safety lockdown
GET  /mission/list                  → list missions (optional ?status= filter)
POST /mission/start                 → start a new mission
POST /mission/stop                  → stop a running mission
POST /mission/complete              → complete a mission
GET  /mission/{id}                  → get a mission by ID
"""

import logging
import os
import threading
import time
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
from distributed.node_sync import NODE_ID, start_node_keepalive
from distributed.message_bus import is_redis_available
from distributed.listener import start_listener

# ── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("cyrus.ai")


# ── Lifespan (autonomy thread) ────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start the autonomy monitoring loop and distributed listener when the service boots."""
    thread = start_autonomy_loop()
    logger.info("[App] Autonomy loop started (thread=%s)", thread.name)

    # Distributed listener — subscribes to Redis cluster channel (daemon thread)
    listener_thread = threading.Thread(
        target=start_listener, daemon=True, name="cyrus-dist-listener"
    )
    listener_thread.start()
    logger.info("[App] Distributed listener started (thread=%s)", listener_thread.name)

    # Node keepalive — registers this node and refreshes cluster TTL
    keepalive_thread = start_node_keepalive()
    logger.info(
        "[App] Node keepalive started node=%s (thread=%s)",
        NODE_ID,
        keepalive_thread.name,
    )

    yield
    # Daemon threads — stop automatically when process exits.
    logger.info("[App] Shutting down node=%s", NODE_ID)


# ── Service start time (for uptime reporting) ──────────────────────────────────

_SERVICE_START_TIME: float = time.time()


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
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": "cyrus-ai",
        "version": "2.0.0",
        "node_id": NODE_ID,
    }


@app.get("/system/health")
def system_health() -> dict[str, Any]:
    """
    Detailed node health including Redis/distributed status.

    Returns
    -------
    dict with keys:
        ``status``         — "healthy" | "degraded"
        ``node``           — node identity string
        ``redis``          — whether Redis is currently reachable
        ``ingestion_queue``— pending event count
    """
    redis_up = is_redis_available()
    return {
        "status": "healthy" if redis_up else "degraded",
        "node": NODE_ID,
        "redis": redis_up,
        "ingestion_queue": queue_size(),
    }


@app.get("/system/node")
def node_info() -> dict[str, Any]:
    """
    Return identity and cluster information for this node.

    Returns
    -------
    dict with keys:
        ``node_id``       — unique identifier for this CYRUS instance
        ``redis``         — Redis connectivity status
        ``cluster_size``  — number of currently registered cluster nodes
        ``active_nodes``  — list of known peer node IDs
    """
    from distributed.node_sync import get_active_nodes  # noqa: PLC0415

    active = get_active_nodes()
    return {
        "node_id": NODE_ID,
        "redis": is_redis_available(),
        "cluster_size": len(active),
        "active_nodes": active,
    }


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
    try:
        uptime = round(time.time() - _SERVICE_START_TIME, 1)
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


# ── Model and Training Endpoints ───────────────────────────────────────────────


@app.get("/model/status")
def model_status() -> dict[str, Any]:
    """
    Return the current state of the local inference model.

    Includes model name, load status, device configuration, and the
    active model mode (``CYRUS_MODEL_MODE``).
    """
    from models.local_model import get_local_model_info  # noqa: PLC0415
    from brain import MODEL_MODE  # noqa: PLC0415

    info = get_local_model_info()
    info["model_mode"] = MODEL_MODE
    return info


@app.get("/training/stats")
def training_stats() -> dict[str, Any]:
    """
    Return training dataset statistics and the current fine-tuning job status.

    Response keys
    -------------
    ``dataset``     — file path, example count, size in bytes
    ``job``         — current or most recent job status (or null)
    ``auto_train``  — whether autonomous training is enabled
    ``versions``    — list of known checkpoint versions (latest first)
    """
    from training.dataset_builder import get_dataset_stats  # noqa: PLC0415
    from training.train import get_training_status  # noqa: PLC0415
    from training.training_trigger import _AUTO_TRAIN  # noqa: PLC0415
    from models.versioning import list_model_versions  # noqa: PLC0415

    versions = list_model_versions()
    return {
        "dataset": get_dataset_stats(),
        "job": get_training_status(),
        "auto_train": _AUTO_TRAIN,
        "versions": list(reversed(versions)),  # latest first
        "node_id": NODE_ID,
    }


class TrainingTriggerRequest(BaseModel):
    force: bool = Field(
        default=False,
        description=(
            "When True, bypass the dataset-size guard and start training even "
            "with fewer than the minimum required examples.  Use with caution."
        ),
    )


@app.post("/training/trigger")
def trigger_training(req: TrainingTriggerRequest) -> dict[str, Any]:
    """
    Manually trigger a fine-tuning run.

    The job runs in a background daemon thread so this endpoint returns
    immediately with ``{"status": "queued"}`` (or raises 409 if a job
    is already running).

    Raises
    ------
    503 — if ``transformers`` / ``torch`` are not installed.
    409 — if a training job is already in progress.
    """
    from training.dataset_builder import get_dataset_stats  # noqa: PLC0415
    from training.train import train_model, _MIN_EXAMPLES  # noqa: PLC0415

    # Check dataset size unless force=True
    if not req.force:
        stats = get_dataset_stats()
        if stats["num_examples"] < _MIN_EXAMPLES:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Dataset too small: {stats['num_examples']} examples. "
                    f"Need at least {_MIN_EXAMPLES}. "
                    "Pass force=true to override."
                ),
            )

    try:
        job = train_model()
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    return {"status": job.status, "job": job.to_dict()}



# ── Control Layer API ─────────────────────────────────────────────────────────

# ── Audit endpoints ───────────────────────────────────────────────────────────


@app.get("/control/audit")
def get_audit(max_entries: int = 100) -> dict[str, Any]:
    """
    Return the most recent audit log entries (newest last).

    Query params
    ------------
    max_entries : int  — max records to return (default 100, max 1000)
    """
    from audit.logger import load_recent_audit_logs  # noqa: PLC0415

    max_entries = min(max(1, max_entries), 1000)
    entries = load_recent_audit_logs(max_entries)
    return {"count": len(entries), "entries": entries}


@app.get("/control/audit/stats")
def get_audit_stats_endpoint() -> dict[str, Any]:
    """Return audit log statistics including file size and chain hash."""
    from audit.logger import get_audit_stats  # noqa: PLC0415

    return get_audit_stats()


@app.post("/control/audit/verify")
def verify_audit_chain() -> dict[str, Any]:
    """
    Verify the SHA-256 hash chain integrity of the audit log.

    A broken chain indicates tampering (deletion, modification, or
    out-of-order insertion).
    """
    from audit.logger import verify_chain  # noqa: PLC0415

    return verify_chain(max_entries=10_000)


# ── HITL approval endpoints ───────────────────────────────────────────────────


@app.get("/control/pending-actions")
def get_pending_actions() -> dict[str, Any]:
    """Return all currently pending HITL approval requests."""
    from control.approval import list_pending_approvals  # noqa: PLC0415

    pending = list_pending_approvals()
    return {"count": len(pending), "pending": pending}


@app.post("/control/approve/{action_id}")
def approve_pending_action(action_id: str) -> dict[str, Any]:
    """
    Approve a pending HITL action.

    The action is removed from the pending store and its details are
    returned.

    Raises
    ------
    404 — if the action_id is unknown or already expired/resolved.
    """
    from control.approval import approve_action  # noqa: PLC0415
    from audit.logger import log_audit  # noqa: PLC0415

    result = approve_action(action_id)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"Action '{action_id}' not found (unknown, expired, or already resolved).",
        )
    log_audit({
        "event": "action_approved",
        "action_id": action_id,
        "action_type": result.get("action_type"),
    })
    return {"status": "approved", "action": result}


class RejectRequest(BaseModel):
    reason: str = "rejected by operator"


@app.post("/control/reject/{action_id}")
def reject_pending_action(action_id: str, req: RejectRequest = RejectRequest()) -> dict[str, Any]:
    """
    Reject a pending HITL action.

    Raises
    ------
    404 — if the action_id is unknown or already expired/resolved.
    """
    from control.approval import reject_action  # noqa: PLC0415
    from audit.logger import log_audit  # noqa: PLC0415

    success = reject_action(action_id, req.reason)
    if not success:
        raise HTTPException(
            status_code=404,
            detail=f"Action '{action_id}' not found (unknown, expired, or already resolved).",
        )
    log_audit({
        "event": "action_rejected",
        "action_id": action_id,
        "reason": req.reason,
    })
    return {"status": "rejected", "action_id": action_id, "reason": req.reason}


# ── Safety lockdown endpoints ─────────────────────────────────────────────────


@app.get("/control/lockdown")
def get_lockdown_status() -> dict[str, Any]:
    """Return the current safety lockdown state."""
    from safety.override import get_lockdown_state  # noqa: PLC0415

    return get_lockdown_state()


class LockdownRequest(BaseModel):
    reason: str = "operator command"


@app.post("/control/lockdown/enable")
def lockdown_enable(req: LockdownRequest) -> dict[str, Any]:
    """
    Activate the global safety lockdown.

    **All intelligence processing will halt immediately.**  The autonomy
    loop, Commander pipeline, and all training jobs will refuse to run.

    Use ``POST /control/lockdown/disable`` to resume normal operation.
    """
    from safety.override import enable_lockdown  # noqa: PLC0415
    from audit.logger import log_audit  # noqa: PLC0415

    state = enable_lockdown(req.reason)
    log_audit({"event": "lockdown_enabled", "reason": req.reason})
    return state


@app.post("/control/lockdown/disable")
def lockdown_disable(req: LockdownRequest) -> dict[str, Any]:
    """Deactivate the global safety lockdown and resume normal operation."""
    from safety.override import disable_lockdown  # noqa: PLC0415
    from audit.logger import log_audit  # noqa: PLC0415

    state = disable_lockdown(req.reason)
    log_audit({"event": "lockdown_disabled", "reason": req.reason})
    return state


# ── Mission Control API ───────────────────────────────────────────────────────


@app.get("/mission/list")
def list_missions_endpoint(status: str | None = None, limit: int = 50) -> dict[str, Any]:
    """
    List missions, optionally filtered by status.

    Query params
    ------------
    status : str | None  — ``running`` | ``stopped`` | ``completed`` | ``failed``
    limit  : int         — max records (default 50, max 200)
    """
    from mission_control.controller import list_missions  # noqa: PLC0415

    limit = min(max(1, limit), 200)
    missions = list_missions(status=status, limit=limit)
    return {"count": len(missions), "missions": missions}


class StartMissionRequest(BaseModel):
    objective: str = Field(..., min_length=1, description="Mission objective")
    mission_id: str | None = Field(default=None, description="Optional caller-supplied ID")
    metadata: dict[str, Any] = Field(default_factory=dict)


@app.post("/mission/start")
def start_mission_endpoint(req: StartMissionRequest) -> dict[str, Any]:
    """
    Start a new mission.

    Raises
    ------
    409 — if a mission with the given mission_id already exists.
    """
    from mission_control.controller import start_mission  # noqa: PLC0415
    from audit.logger import log_audit  # noqa: PLC0415

    try:
        record = start_mission(req.objective, req.mission_id, req.metadata)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    log_audit({
        "event": "mission_started",
        "mission_id": record.mission_id,
        "objective": req.objective[:200],
    })
    return record.to_dict()


class StopMissionRequest(BaseModel):
    mission_id: str
    reason: str = "operator stop"


@app.post("/mission/stop")
def stop_mission_endpoint(req: StopMissionRequest) -> dict[str, Any]:
    """
    Stop a running mission.

    Raises
    ------
    404 — if the mission_id is not found.
    """
    from mission_control.controller import stop_mission  # noqa: PLC0415
    from audit.logger import log_audit  # noqa: PLC0415

    record = stop_mission(req.mission_id, req.reason)
    if record is None:
        raise HTTPException(status_code=404, detail=f"Mission '{req.mission_id}' not found.")
    log_audit({"event": "mission_stopped", "mission_id": req.mission_id, "reason": req.reason})
    return record.to_dict()


class CompleteMissionRequest(BaseModel):
    mission_id: str
    result_summary: str | None = None


@app.post("/mission/complete")
def complete_mission_endpoint(req: CompleteMissionRequest) -> dict[str, Any]:
    """
    Mark a mission as completed.

    Raises
    ------
    404 — if the mission_id is not found.
    """
    from mission_control.controller import complete_mission  # noqa: PLC0415
    from audit.logger import log_audit  # noqa: PLC0415

    record = complete_mission(req.mission_id, req.result_summary)
    if record is None:
        raise HTTPException(status_code=404, detail=f"Mission '{req.mission_id}' not found.")
    log_audit({
        "event": "mission_completed",
        "mission_id": req.mission_id,
        "result_summary": req.result_summary,
    })
    return record.to_dict()


@app.get("/mission/{mission_id}")
def get_mission_endpoint(mission_id: str) -> dict[str, Any]:
    """
    Retrieve a mission by ID.

    Raises
    ------
    404 — if the mission_id is not found.
    """
    from mission_control.controller import get_mission  # noqa: PLC0415

    record = get_mission(mission_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"Mission '{mission_id}' not found.")
    return record.to_dict()
