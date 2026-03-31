"""
cyrus-ai/core/system_orchestrator.py
======================================
Central lifecycle and orchestration layer for the CYRUS Intelligence Platform.

Responsibilities
----------------
* **Initialise** every subsystem in dependency order (config → safety → brain →
  swarm → vision → mission → NXI → distributed → autonomy).
* **Manage lifecycle** — start, stop, and graceful-restart of daemon threads.
* **Global Brain Loop** — a unified sense → think → act cycle that coordinates
  all modules at a configurable tick rate.
* **Safety gate** — the loop checks lockdown state before every tick; the entire
  platform halts non-destructively when locked down.
* **Fault tolerance** — every module call is wrapped so a single subsystem
  failure never crashes the orchestrator.
* **Module status** — ``get_status()`` returns a JSON-serialisable health
  snapshot for the ``/system/health`` and dashboard endpoints.

Architecture note
-----------------
The orchestrator is intentionally *thin*:  it wires existing singletons
together rather than owning logic itself.  Each subsystem remains independently
testable; the orchestrator is the composition layer.

Usage
-----
    from core.system_orchestrator import get_orchestrator

    orch = get_orchestrator()
    orch.start()          # called once at service boot
    # …
    orch.shutdown()       # called on SIGTERM / process exit
"""

from __future__ import annotations

import logging
import os
import threading
import time
from typing import Any

logger = logging.getLogger(__name__)


# ── helpers ───────────────────────────────────────────────────────────────────

def _safe_call(fn: Any, *args: Any, label: str = "", fallback: Any = None, **kwargs: Any) -> Any:
    """Invoke *fn*, catching and logging any exception; returns *fallback* on error."""
    try:
        return fn(*args, **kwargs)
    except Exception as exc:  # noqa: BLE001
        logger.error("[Orchestrator] %s error: %s", label or getattr(fn, "__name__", fn), exc)
        return fallback


# ── SystemOrchestrator ────────────────────────────────────────────────────────

class SystemOrchestrator:
    """
    Single entry-point that starts, monitors, and shuts down all CYRUS subsystems.

    The orchestrator maintains module references and a set of daemon threads.
    ``start()`` is idempotent — calling it twice is harmless.
    """

    def __init__(self) -> None:
        self._lock      = threading.Lock()
        self._running   = False
        self._threads:  list[threading.Thread] = []
        self._modules:  dict[str, Any]         = {}
        self._status:   dict[str, str]         = {}

        # Read loop interval from settings (or env directly as a fallback)
        try:
            from config.settings import Settings  # noqa: PLC0415
            self._loop_interval: float = Settings.LOOP_INTERVAL
        except Exception:  # noqa: BLE001
            self._loop_interval = float(os.getenv("CYRUS_LOOP_INTERVAL", "0.5"))

    # ── module initialisation ─────────────────────────────────────────────────

    def _init_brain(self) -> None:
        try:
            from brain import _get_commander  # noqa: PLC0415
            self._modules["brain"] = _get_commander()
            self._status["brain"]  = "ok"
            logger.info("[Orchestrator] brain initialised")
        except Exception as exc:  # noqa: BLE001
            self._status["brain"] = f"error: {exc}"
            logger.warning("[Orchestrator] brain init failed: %s", exc)

    def _init_swarm(self) -> None:
        try:
            from swarm.swarm_controller import get_swarm_controller  # noqa: PLC0415
            ctrl = get_swarm_controller()
            self._modules["swarm"] = ctrl
            self._status["swarm"]  = "ok"
            logger.info("[Orchestrator] swarm controller initialised")
        except Exception as exc:  # noqa: BLE001
            self._status["swarm"] = f"error: {exc}"
            logger.warning("[Orchestrator] swarm init failed: %s", exc)

    def _init_vision(self) -> None:
        try:
            from perception.vision import get_vision_system  # noqa: PLC0415
            self._modules["vision"] = get_vision_system()
            self._status["vision"]  = "ok"
            logger.info("[Orchestrator] vision system initialised")
        except Exception as exc:  # noqa: BLE001
            self._status["vision"] = f"unavailable: {exc}"
            logger.debug("[Orchestrator] vision init skipped: %s", exc)

    def _init_mission(self) -> None:
        try:
            from mission.engine import get_mission_engine  # noqa: PLC0415
            self._modules["mission"] = get_mission_engine()
            self._status["mission"]  = "ok"
            logger.info("[Orchestrator] mission engine initialised")
        except Exception as exc:  # noqa: BLE001
            self._status["mission"] = f"error: {exc}"
            logger.warning("[Orchestrator] mission engine init failed: %s", exc)

    def _init_nxi(self) -> None:
        try:
            from nxi.map_engine import get_nxi_map  # noqa: PLC0415
            self._modules["nxi"] = get_nxi_map()
            self._status["nxi"]  = "ok"
            logger.info("[Orchestrator] NXI map initialised")
        except Exception as exc:  # noqa: BLE001
            self._status["nxi"] = f"error: {exc}"
            logger.warning("[Orchestrator] NXI map init failed: %s", exc)

    def _init_safety(self) -> None:
        try:
            from safety.override import _init_lockdown_from_file  # noqa: PLC0415
            _init_lockdown_from_file()
            self._status["safety"] = "ok"
            logger.info("[Orchestrator] safety layer initialised")
        except Exception as exc:  # noqa: BLE001
            self._status["safety"] = f"error: {exc}"
            logger.warning("[Orchestrator] safety init failed: %s", exc)

    def _init_pursuit(self) -> None:
        try:
            from swarm.swarm_pursuit import get_coordinator  # noqa: PLC0415
            self._modules["pursuit"] = get_coordinator()
            self._status["pursuit"]  = "ok"
            logger.info("[Orchestrator] swarm-pursuit coordinator initialised")
        except Exception as exc:  # noqa: BLE001
            self._status["pursuit"] = f"error: {exc}"
            logger.warning("[Orchestrator] pursuit init failed: %s", exc)

    # ── distributed services ──────────────────────────────────────────────────

    def _start_distributed_services(self) -> None:
        """Start Redis listener and node-keepalive threads."""
        try:
            from distributed.listener import start_listener      # noqa: PLC0415
            from distributed.node_sync import start_node_keepalive  # noqa: PLC0415

            t_listener = threading.Thread(
                target=start_listener, daemon=True, name="cyrus-dist-listener"
            )
            t_listener.start()
            self._threads.append(t_listener)

            t_keepalive = start_node_keepalive()
            self._threads.append(t_keepalive)
            self._status["distributed"] = "ok"
            logger.info("[Orchestrator] distributed services started")
        except Exception as exc:  # noqa: BLE001
            self._status["distributed"] = f"offline: {exc}"
            logger.warning("[Orchestrator] distributed services unavailable: %s", exc)

    def _start_autonomy_loop(self) -> None:
        """Start the CYRUS autonomy daemon."""
        try:
            from autonomy import start_autonomy_loop  # noqa: PLC0415
            t = start_autonomy_loop()
            self._threads.append(t)
            self._status["autonomy"] = "ok"
            logger.info("[Orchestrator] autonomy loop started")
        except Exception as exc:  # noqa: BLE001
            self._status["autonomy"] = f"error: {exc}"
            logger.warning("[Orchestrator] autonomy loop failed to start: %s", exc)

    def _start_embodiment_loop(self) -> None:
        """Start the sense → think → act embodiment loop (if hardware/sim is available)."""
        try:
            from embodiment.core_loop import CyrusCoreLoop  # noqa: PLC0415
            from embodiment.drone_controller import get_drone_controller  # noqa: PLC0415
            from perception.vision import get_vision_system              # noqa: PLC0415
            from mission.engine import get_mission_engine                # noqa: PLC0415

            loop = CyrusCoreLoop(
                drone      = get_drone_controller(),
                vision     = get_vision_system(),
                mission    = get_mission_engine(),
            )
            t = threading.Thread(
                target=loop.run, daemon=True, name="cyrus-embodiment-loop"
            )
            t.start()
            self._modules["embodiment_loop"] = loop
            self._threads.append(t)
            self._status["embodiment"] = "ok"
            logger.info("[Orchestrator] embodiment loop started")
        except Exception as exc:  # noqa: BLE001
            self._status["embodiment"] = f"unavailable: {exc}"
            logger.debug("[Orchestrator] embodiment loop skipped: %s", exc)

    # ── global brain loop ─────────────────────────────────────────────────────

    def _global_brain_loop(self) -> None:
        """
        Unified sense → think → act cycle for the entire platform.

        Flow per tick:
            1. Safety gate   — skip if system is locked down
            2. Perception    — gather sensor data from all available sources
            3. Decision      — run through the multi-agent brain pipeline
            4. Routing       — dispatch the decision to the event router
            5. NXI update    — sync the global world model
        """
        from core.event_router import route_event  # noqa: PLC0415

        logger.info("[Orchestrator] global brain loop started (interval=%.2fs)", self._loop_interval)

        while self._running:
            tick_start = time.monotonic()

            # ── safety gate ───────────────────────────────────────────────────
            try:
                from safety.override import is_locked_down  # noqa: PLC0415
                if is_locked_down():
                    time.sleep(self._loop_interval)
                    continue
            except Exception:  # noqa: BLE001
                pass

            # ── perception ────────────────────────────────────────────────────
            perception: dict[str, Any] = {}
            if "vision" in self._modules:
                vision = self._modules["vision"]
                perception["objects"] = _safe_call(
                    vision.detect, label="vision.detect", fallback=[]
                ) or []

            swarm_ctrl = self._modules.get("swarm")
            if swarm_ctrl:
                perception["swarm"] = _safe_call(
                    swarm_ctrl.get_state, label="swarm.get_state", fallback={}
                ) or {}

            # ── brain decision ────────────────────────────────────────────────
            if perception:
                try:
                    from brain import process_embodied_input  # noqa: PLC0415
                    decision = _safe_call(
                        process_embodied_input,
                        perception,
                        label="brain.process_embodied_input",
                        fallback={"type": "noop"},
                    ) or {"type": "noop"}

                    # Route non-noop decisions through the event bus
                    if decision.get("type") not in ("noop", "error", None):
                        _safe_call(
                            route_event,
                            {"type": "decision", "data": decision},
                            label="route_event.decision",
                        )
                except Exception as exc:  # noqa: BLE001
                    logger.debug("[Orchestrator] brain decision error: %s", exc)

            # ── NXI world-model sync ──────────────────────────────────────────
            if "nxi" in self._modules and "swarm" in self._modules:
                swarm_state = _safe_call(
                    self._modules["swarm"].get_state,
                    label="swarm.get_state",
                    fallback={},
                ) or {}
                for drone_id, drone_data in swarm_state.get("drones", {}).items():
                    _safe_call(
                        self._modules["nxi"].update_drone,
                        drone_id,
                        drone_data,
                        label="nxi.update_drone",
                    )

            # ── pace the loop ─────────────────────────────────────────────────
            elapsed = time.monotonic() - tick_start
            sleep_for = max(0.0, self._loop_interval - elapsed)
            time.sleep(sleep_for)

        logger.info("[Orchestrator] global brain loop stopped")

    def _start_global_brain_loop(self) -> None:
        t = threading.Thread(
            target=self._global_brain_loop,
            daemon=True,
            name="cyrus-global-brain",
        )
        t.start()
        self._threads.append(t)

    # ── public interface ──────────────────────────────────────────────────────

    def start(self) -> None:
        """
        Initialise and start all CYRUS subsystems.

        Safe to call multiple times — subsequent calls are no-ops if already running.
        """
        with self._lock:
            if self._running:
                logger.debug("[Orchestrator] already running — ignoring start()")
                return
            self._running = True

        logger.info("[Orchestrator] ── CYRUS system starting ──────────────────────")

        # Initialise modules in dependency order
        self._init_safety()
        self._init_brain()
        self._init_nxi()
        self._init_swarm()
        self._init_pursuit()
        self._init_vision()
        self._init_mission()

        # Start background services
        self._start_distributed_services()
        self._start_autonomy_loop()
        self._start_embodiment_loop()
        self._start_global_brain_loop()

        logger.info(
            "[Orchestrator] ── CYRUS system online — modules: %s",
            ", ".join(f"{k}={v}" for k, v in self._status.items()),
        )

    def start_subsystems(self) -> None:
        """
        Initialise modules and start the global brain loop only.

        Use this variant when the calling context (e.g. the FastAPI lifespan)
        already manages the autonomy loop, Redis listener, and node-keepalive
        threads independently — calling ``start()`` would duplicate those threads.
        """
        with self._lock:
            if self._running:
                logger.debug("[Orchestrator] already running — ignoring start_subsystems()")
                return
            self._running = True

        logger.info("[Orchestrator] ── CYRUS subsystem init (lifespan-managed) ──")

        self._init_safety()
        self._init_brain()
        self._init_nxi()
        self._init_swarm()
        self._init_pursuit()
        self._init_vision()
        self._init_mission()
        self._start_embodiment_loop()
        self._start_global_brain_loop()

        self._status["distributed"] = "externally-managed"
        self._status["autonomy"]    = "externally-managed"

        logger.info(
            "[Orchestrator] ── subsystems online — modules: %s",
            ", ".join(f"{k}={v}" for k, v in self._status.items()),
        )

    def shutdown(self) -> None:
        """
        Signal all daemon threads to stop and clean up.

        The daemon threads will exit naturally when the main process terminates.
        This method sets the running flag so the global brain loop exits cleanly.
        """
        with self._lock:
            if not self._running:
                return
            self._running = False

        logger.info("[Orchestrator] shutting down …")

        # Stop swarm fault-monitor
        swarm = self._modules.get("swarm")
        if swarm:
            _safe_call(swarm.stop, label="swarm.stop")

        # Stop autonomy loop
        try:
            from autonomy import stop_autonomy_loop  # noqa: PLC0415
            stop_autonomy_loop()
        except Exception:  # noqa: BLE001
            pass

        logger.info("[Orchestrator] shutdown complete")

    def get_status(self) -> dict[str, Any]:
        """
        Return a JSON-serialisable health snapshot of all subsystems.

        Used by ``/system/health`` and the React dashboard.
        """
        running = [t.name for t in self._threads if t.is_alive()]
        return {
            "orchestrator": "running" if self._running else "stopped",
            "modules":      {**self._status},
            "threads":      running,
            "module_count": len(self._modules),
            "thread_count": len(running),
        }

    def restart_module(self, name: str) -> dict[str, str]:
        """Attempt to re-initialise a named module (for live recovery)."""
        init_map = {
            "brain":   self._init_brain,
            "swarm":   self._init_swarm,
            "vision":  self._init_vision,
            "mission": self._init_mission,
            "nxi":     self._init_nxi,
            "safety":  self._init_safety,
            "pursuit": self._init_pursuit,
        }
        fn = init_map.get(name)
        if fn is None:
            return {"status": "error", "reason": f"unknown module: {name}"}
        _safe_call(fn, label=f"restart.{name}")
        return {"status": self._status.get(name, "unknown"), "module": name}


# ── module-level singleton ────────────────────────────────────────────────────

_orchestrator:      SystemOrchestrator | None = None
_orchestrator_lock: threading.Lock            = threading.Lock()


def get_orchestrator() -> SystemOrchestrator:
    """Return the process-wide ``SystemOrchestrator`` singleton (lazy-initialised)."""
    global _orchestrator  # noqa: PLW0603
    with _orchestrator_lock:
        if _orchestrator is None:
            _orchestrator = SystemOrchestrator()
    return _orchestrator
