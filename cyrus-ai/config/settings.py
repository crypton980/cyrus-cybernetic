"""
cyrus-ai/config/settings.py
============================
Centralised, environment-aware configuration for the CYRUS Intelligence Platform.

All tuneable constants live here so that every subsystem reads from a single
source of truth.  Values can be overridden via environment variables at
runtime without code changes.

Usage
-----
    from config.settings import Settings

    interval = Settings.LOOP_INTERVAL
    max_d    = Settings.MAX_DRONES
"""

from __future__ import annotations

import os


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name, "")
    if not raw:
        return default
    return raw.lower() in ("1", "true", "yes", "on")


class Settings:
    """Namespace of platform-wide constants.  All values read once at import time."""

    # ── Swarm ──────────────────────────────────────────────────────────────────
    MAX_DRONES: int                = _env_int("CYRUS_MAX_DRONES", 10)
    DRONE_HEARTBEAT_TTL: float     = _env_float("CYRUS_DRONE_HEARTBEAT_TTL", 30.0)
    DRONE_BATTERY_LOW: float       = _env_float("CYRUS_DRONE_BATTERY_LOW", 20.0)
    DRONE_BATTERY_CRIT: float      = _env_float("CYRUS_DRONE_BATTERY_CRIT", 10.0)
    MAX_TASKS_PER_DRONE: int       = _env_int("CYRUS_SWARM_MAX_TASKS", 3)

    # ── Pursuit / Tracking ────────────────────────────────────────────────────
    TRACKING_HISTORY: int          = _env_int("CYRUS_TRACKING_HISTORY", 5)
    PREDICTION_STEPS: int          = _env_int("CYRUS_PREDICTION_STEPS", 1)

    # ── NXI World Model ───────────────────────────────────────────────────────
    NXI_EVENT_BUFFER: int          = _env_int("CYRUS_NXI_EVENT_BUFFER", 500)
    NXI_TARGET_TTL: float          = _env_float("CYRUS_NXI_TARGET_TTL", 120.0)

    # ── Global Brain Loop ─────────────────────────────────────────────────────
    LOOP_INTERVAL: float           = _env_float("CYRUS_LOOP_INTERVAL", 0.5)
    AUTONOMY_INTERVAL: int         = _env_int("CYRUS_AUTONOMY_INTERVAL_SEC", 30)

    # ── Perception ────────────────────────────────────────────────────────────
    EMBODIMENT_TICK: float         = _env_float("CYRUS_EMBODIMENT_TICK_SEC", 1.0)
    PERCEPTION_TIMEOUT: float      = _env_float("CYRUS_PERCEPTION_TIMEOUT_SEC", 0.5)
    PERCEPTION_MAX_FPS: float      = _env_float("CYRUS_PERCEPTION_MAX_FPS", 10.0)

    # ── Memory / Ingestion ────────────────────────────────────────────────────
    MAX_MEMORY_ENTRIES: int        = _env_int("CYRUS_MAX_MEMORY_ENTRIES", 100_000)
    INGESTION_QUEUE_CAP: int       = _env_int("CYRUS_INGEST_QUEUE_CAP", 10_000)
    AUTONOMY_DRAIN_BATCH: int      = _env_int("CYRUS_AUTONOMY_DRAIN_BATCH", 20)

    # ── Distributed ───────────────────────────────────────────────────────────
    NODE_ID: str                   = os.getenv("CYRUS_NODE_ID", "cyrus-node-0")
    REDIS_URL: str                 = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    EVENT_CHANNEL: str             = os.getenv("CYRUS_EVENT_CHANNEL", "cyrus_events")

    # ── Safety ────────────────────────────────────────────────────────────────
    REQUIRE_APPROVAL: bool         = _env_bool("CYRUS_REQUIRE_APPROVAL", False)
    LOCKDOWN_FILE: str             = os.getenv("CYRUS_LOCKDOWN_FILE", "")

    # ── AI / LLM ──────────────────────────────────────────────────────────────
    MODEL_MODE: str                = os.getenv("MODEL_MODE", "openai")   # openai|local|hybrid
    LOCAL_MODEL: str               = os.getenv("CYRUS_LOCAL_MODEL", "")
    AUTO_TRAIN: bool               = _env_bool("CYRUS_AUTO_TRAIN", False)
    MIN_TRAIN_EXAMPLES: int        = _env_int("CYRUS_MIN_TRAIN_EXAMPLES", 100)
