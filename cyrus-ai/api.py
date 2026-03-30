"""
CYRUS AI Service — FastAPI application.

Exposes the memory system, learning engine, decision brain, planner, and
autonomy loop over HTTP so the Node.js backend can integrate without
spawning in-process Python.

Endpoints
---------
GET  /health                 → liveness probe
GET  /memory/stats           → collection statistics
POST /memory/store           → embed and persist a memory entry
POST /memory/query           → semantic similarity search
DELETE /memory/{id}          → hard-delete a memory entry
POST /feedback               → log interaction feedback + learning strategy
POST /interaction            → log a raw CYRUS interaction
POST /brain/process          → LLM reasoning + plan + context retrieval
POST /plan                   → generate a multi-step execution plan
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
from brain import process_input
from planner import create_plan, describe_plan
from autonomy import start_autonomy_loop

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
