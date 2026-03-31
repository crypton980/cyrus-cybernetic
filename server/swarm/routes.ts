/**
 * CYRUS Swarm & Orchestration Routes — Node.js proxy to Python FastAPI.
 *
 * Route map (all mounted at /api/swarm and /api/orchestrator):
 *   GET    /api/swarm/state                  — full swarm state
 *   GET    /api/swarm/drones                 — list registered drones
 *   POST   /api/swarm/register               — register a drone
 *   POST   /api/swarm/track                  — start pursuit tracking
 *   GET    /api/swarm/track/state            — current tracking state
 *   POST   /api/swarm/formation              — set formation type
 *   POST   /api/swarm/event                  — send a swarm event
 *   GET    /api/swarm/drone/:droneId/state   — single drone telemetry
 *   GET    /api/swarm/nxi                    — NXI world-model snapshot
 *
 *   GET    /api/orchestrator/status          — SystemOrchestrator status
 *   POST   /api/orchestrator/restart/:module — restart a subsystem module
 *   GET    /api/orchestrator/modules         — module health list (forwarded)
 */

import { Router, type Request, type Response } from "express";
import axios, { type AxiosInstance } from "axios";

const router = Router();

const AI_BASE_URL = process.env.CYRUS_AI_URL || "http://localhost:8001";
const AI_TIMEOUT_MS = 10_000;

let _client: AxiosInstance | null = null;
function getClient(): AxiosInstance {
  if (!_client) {
    _client = axios.create({
      baseURL: AI_BASE_URL,
      timeout: AI_TIMEOUT_MS,
      headers: { "Content-Type": "application/json" },
    });
  }
  return _client;
}

async function proxyGet(
  pythonPath: string,
  params: Record<string, unknown>,
  res: Response,
  tag: string,
): Promise<void> {
  try {
    const result = await getClient().get<Record<string, unknown>>(pythonPath, { params });
    res.json(result.data);
  } catch (err) {
    const message = (err as Error).message;
    console.warn(`[Swarm] ${tag} proxy error:`, message);
    res.status(503).json({ status: "error", error: "CYRUS AI service unavailable", detail: message });
  }
}

async function proxyPost(
  pythonPath: string,
  body: unknown,
  res: Response,
  tag: string,
): Promise<void> {
  try {
    const result = await getClient().post<Record<string, unknown>>(pythonPath, body);
    res.json(result.data);
  } catch (err) {
    const message = (err as Error).message;
    console.warn(`[Swarm] ${tag} proxy error:`, message);
    res.status(503).json({ status: "error", error: "CYRUS AI service unavailable", detail: message });
  }
}

// ── Swarm endpoints ──────────────────────────────────────────────────────────

router.get("/swarm/state", (_req: Request, res: Response) =>
  proxyGet("/swarm/state", {}, res, "swarm/state"),
);

router.get("/swarm/drones", (_req: Request, res: Response) =>
  proxyGet("/swarm/drones", {}, res, "swarm/drones"),
);

router.post("/swarm/register", (req: Request, res: Response) =>
  proxyPost("/swarm/register", req.body, res, "swarm/register"),
);

router.post("/swarm/track", (req: Request, res: Response) =>
  proxyPost("/swarm/track", req.body, res, "swarm/track"),
);

router.get("/swarm/track/state", (_req: Request, res: Response) =>
  proxyGet("/swarm/state", {}, res, "swarm/track/state"),
);

router.post("/swarm/formation", (req: Request, res: Response) =>
  proxyPost("/swarm/formation", req.body, res, "swarm/formation"),
);

router.post("/swarm/event", (req: Request, res: Response) =>
  proxyPost("/swarm/event", req.body, res, "swarm/event"),
);

router.get("/swarm/drone/:droneId/state", (req: Request, res: Response) =>
  proxyGet(`/swarm/drone/${req.params["droneId"]}/state`, {}, res, "swarm/drone/state"),
);

router.get("/swarm/nxi", (_req: Request, res: Response) =>
  proxyGet("/nxi/state", {}, res, "swarm/nxi"),
);

// ── Orchestrator endpoints ───────────────────────────────────────────────────

router.get("/orchestrator/status", (_req: Request, res: Response) =>
  proxyGet("/system/orchestrator", {}, res, "orchestrator/status"),
);

router.post("/orchestrator/restart/:module", (req: Request, res: Response) =>
  proxyPost(`/system/orchestrator/restart/${req.params["module"]}`, {}, res, "orchestrator/restart"),
);

/**
 * GET /api/orchestrator/modules
 * Returns module health list for the ModulesPage. Falls back to a static list
 * when the Python service is offline so the UI always renders.
 */
router.get("/orchestrator/modules", async (_req: Request, res: Response) => {
  try {
    const result = await getClient().get<Record<string, unknown>>("/system/orchestrator");
    const data = result.data as {
      subsystems?: Record<string, string>;
      loop_running?: boolean;
    };

    const subsystems = data.subsystems ?? {};
    const modules = Object.entries(subsystems).map(([id, status]) => ({
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1).replace(/_/g, " "),
      category: ["brain", "safety", "map"].includes(id) ? "core" : "advanced",
      status: status === "ok" ? "operational" : status === "degraded" ? "degraded" : "offline",
      metrics: { status, loop: data.loop_running ? "running" : "stopped" },
      lastUpdate: Date.now(),
    }));

    const operational = modules.filter((m) => m.status === "operational").length;
    const degraded = modules.filter((m) => m.status === "degraded").length;
    const offline = modules.filter((m) => m.status === "offline").length;

    res.json({
      success: true,
      modules,
      health: {
        operational,
        degraded,
        offline,
        overallHealth: modules.length > 0 ? Math.round((operational / modules.length) * 100) : 0,
      },
      totalModules: modules.length,
      coreModules: modules.filter((m) => m.category === "core").length,
      advancedModules: modules.filter((m) => m.category === "advanced").length,
    });
  } catch {
    // Fallback when Python service is offline — static module list
    const fallback = [
      "brain", "swarm", "vision", "mission", "map", "safety",
      "distributed", "autonomy", "listener", "embodiment",
    ].map((id) => ({
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1),
      category: ["brain", "safety", "map"].includes(id) ? "core" : "advanced",
      status: "offline",
      metrics: { status: "offline" },
      lastUpdate: Date.now(),
    }));

    res.json({
      success: false,
      modules: fallback,
      health: { operational: 0, degraded: 0, offline: fallback.length, overallHealth: 0 },
      totalModules: fallback.length,
      coreModules: 3,
      advancedModules: fallback.length - 3,
    });
  }
});

export default router;
