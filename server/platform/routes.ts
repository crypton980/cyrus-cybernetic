/**
 * CYRUS Platform Routes — API-first intelligence platform layer.
 *
 * Exposes real-time data ingestion, fused intelligence retrieval, external
 * action execution, and plugin management via the Node.js REST API.
 *
 * Route map:
 *   POST   /api/platform/ingest          — enqueue a real-time event
 *   GET    /api/platform/intelligence    — latest fused intelligence picture
 *   POST   /api/platform/action         — execute an external action (admin)
 *   GET    /api/platform/state          — system health (queue depth, uptime…)
 *   GET    /api/platform/plugins        — list registered plugins
 *
 *   GET    /api/platform/control/audit            — audit log entries (admin)
 *   GET    /api/platform/control/audit/stats      — audit stats (admin)
 *   POST   /api/platform/control/audit/verify     — verify chain integrity (admin)
 *   GET    /api/platform/control/pending-actions  — HITL pending approvals (admin)
 *   POST   /api/platform/control/approve/:id      — approve HITL action (admin)
 *   POST   /api/platform/control/reject/:id       — reject HITL action (admin)
 *   GET    /api/platform/control/lockdown         — lockdown state (admin)
 *   POST   /api/platform/control/lockdown/enable  — enable lockdown (admin)
 *   POST   /api/platform/control/lockdown/disable — disable lockdown (admin)
 *
 *   GET    /api/platform/mission/list             — list missions (admin)
 *   POST   /api/platform/mission/start            — start a mission (admin)
 *   POST   /api/platform/mission/stop             — stop a mission (admin)
 *   POST   /api/platform/mission/complete         — complete a mission (admin)
 *   GET    /api/platform/mission/:id              — get a mission (admin)
 *
 * All routes proxy to the Python FastAPI service at CYRUS_AI_URL.
 * The plugin manifest endpoint is served locally (no Python call needed).
 */

import { Router, type Request, type Response, type RequestHandler } from "express";
import axios, { type AxiosInstance } from "axios";
import { getPluginManifest } from "../plugins/index";

const router = Router();

const AI_BASE_URL = process.env.CYRUS_AI_URL || "http://localhost:8001";
const AI_TIMEOUT_MS = parseInt(process.env.CYRUS_AI_TIMEOUT_MS || "15000", 10);

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

// ── Admin guard ───────────────────────────────────────────────────────────────

interface AuthSession {
  user?: { id: string; username: string; role: string };
}

function getSessionUser(req: Request): AuthSession["user"] | undefined {
  return (req as Request & { session: AuthSession }).session?.user;
}

const requireAdmin: RequestHandler = (req, res, next) => {
  const user = getSessionUser(req);
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Forbidden: admin access required" });
    return;
  }
  next();
};

// ── Generic Python proxy helper ───────────────────────────────────────────────

async function proxyGet(
  pythonPath: string,
  params: Record<string, unknown>,
  req: Request,
  res: Response,
  tag: string,
): Promise<void> {
  try {
    const result = await getClient().get<Record<string, unknown>>(pythonPath, { params });
    res.json(result.data);
  } catch (err) {
    const message = (err as Error).message;
    console.warn(`[Platform] ${tag} proxy error:`, message);
    res.status(503).json({ error: "CYRUS AI service unavailable", detail: message });
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
    console.warn(`[Platform] ${tag} proxy error:`, message);
    res.status(503).json({ error: "CYRUS AI service unavailable", detail: message });
  }
}

/** POST /api/platform/ingest — forward a real-time event to the Python ingestion layer. */
router.post("/ingest", async (req: Request, res: Response) => {
  const { source, type, payload, priority, correlation_id } = req.body as {
    source?: string;
    type?: string;
    payload?: Record<string, unknown>;
    priority?: number;
    correlation_id?: string;
  };

  if (!source || !type) {
    return res.status(400).json({ error: "source and type are required" });
  }

  try {
    const result = await getClient().post<Record<string, unknown>>("/platform/ingest", {
      source,
      type,
      payload: payload ?? {},
      priority: priority ?? 5,
      correlation_id: correlation_id ?? "",
    });
    return res.json(result.data);
  } catch (err) {
    const message = (err as Error).message;
    console.warn("[Platform] /ingest proxy error:", message);
    return res.status(503).json({ error: "CYRUS AI service unavailable", detail: message });
  }
});

/** GET /api/platform/intelligence — return the latest fused intelligence picture. */
router.get("/intelligence", async (_req: Request, res: Response) => {
  try {
    const result = await getClient().get<Record<string, unknown>>("/platform/intelligence");
    return res.json(result.data);
  } catch (err) {
    const message = (err as Error).message;
    console.warn("[Platform] /intelligence proxy error:", message);
    return res.status(503).json({ error: "CYRUS AI service unavailable", detail: message });
  }
});

/** POST /api/platform/action — execute a named external action. Admin only. */
router.post("/action", requireAdmin, async (req: Request, res: Response) => {
  const { action, payload } = req.body as {
    action?: string;
    payload?: Record<string, unknown>;
  };

  if (!action) {
    return res.status(400).json({ error: "action is required" });
  }

  try {
    const result = await getClient().post<Record<string, unknown>>("/platform/action", {
      action,
      payload: payload ?? {},
    });
    return res.json(result.data);
  } catch (err) {
    const message = (err as Error).message;
    console.warn("[Platform] /action proxy error:", message);
    return res.status(503).json({ error: "CYRUS AI service unavailable", detail: message });
  }
});

/** GET /api/platform/state — return real-time system health. */
router.get("/state", async (_req: Request, res: Response) => {
  try {
    const result = await getClient().get<Record<string, unknown>>("/system/state");
    return res.json(result.data);
  } catch (err) {
    const message = (err as Error).message;
    console.warn("[Platform] /state proxy error:", message);
    return res.status(503).json({ error: "CYRUS AI service unavailable", detail: message });
  }
});

/**
 * GET /api/platform/plugins — return a manifest of all registered Node.js plugins.
 *
 * Served locally (no Python call) — plugin registry lives in server/plugins/index.ts.
 */
router.get("/plugins", (_req: Request, res: Response) => {
  return res.json({ plugins: getPluginManifest() });
});

// ── Control / Safety / Audit endpoints (all admin-only) ───────────────────────

router.get("/control/audit", requireAdmin, (req: Request, res: Response) =>
  proxyGet("/control/audit", { max_entries: req.query["max_entries"] ?? 100 }, req, res, "/control/audit"),
);

router.get("/control/audit/stats", requireAdmin, (_req: Request, res: Response) =>
  proxyGet("/control/audit/stats", {}, _req, res, "/control/audit/stats"),
);

router.post("/control/audit/verify", requireAdmin, (_req: Request, res: Response) =>
  proxyPost("/control/audit/verify", {}, res, "/control/audit/verify"),
);

router.get("/control/pending-actions", requireAdmin, (_req: Request, res: Response) =>
  proxyGet("/control/pending-actions", {}, _req, res, "/control/pending-actions"),
);

router.post("/control/approve/:actionId", requireAdmin, (req: Request, res: Response) =>
  proxyPost(`/control/approve/${req.params["actionId"]}`, {}, res, "/control/approve"),
);

router.post("/control/reject/:actionId", requireAdmin, (req: Request, res: Response) =>
  proxyPost(
    `/control/reject/${req.params["actionId"]}`,
    { reason: (req.body as { reason?: string }).reason ?? "rejected by operator" },
    res,
    "/control/reject",
  ),
);

router.get("/control/lockdown", requireAdmin, (_req: Request, res: Response) =>
  proxyGet("/control/lockdown", {}, _req, res, "/control/lockdown"),
);

router.post("/control/lockdown/enable", requireAdmin, (req: Request, res: Response) =>
  proxyPost(
    "/control/lockdown/enable",
    { reason: (req.body as { reason?: string }).reason ?? "operator command" },
    res,
    "/control/lockdown/enable",
  ),
);

router.post("/control/lockdown/disable", requireAdmin, (req: Request, res: Response) =>
  proxyPost(
    "/control/lockdown/disable",
    { reason: (req.body as { reason?: string }).reason ?? "operator command" },
    res,
    "/control/lockdown/disable",
  ),
);

// ── Mission Control endpoints (all admin-only) ────────────────────────────────

router.get("/mission/list", requireAdmin, (req: Request, res: Response) =>
  proxyGet(
    "/mission/list",
    { status: req.query["status"], limit: req.query["limit"] ?? 50 },
    req,
    res,
    "/mission/list",
  ),
);

router.post("/mission/start", requireAdmin, (req: Request, res: Response) =>
  proxyPost("/mission/start", req.body, res, "/mission/start"),
);

router.post("/mission/stop", requireAdmin, (req: Request, res: Response) =>
  proxyPost("/mission/stop", req.body, res, "/mission/stop"),
);

router.post("/mission/complete", requireAdmin, (req: Request, res: Response) =>
  proxyPost("/mission/complete", req.body, res, "/mission/complete"),
);

router.get("/mission/:missionId", requireAdmin, (req: Request, res: Response) =>
  proxyGet(`/mission/${req.params["missionId"]}`, {}, req, res, "/mission/:id"),
);

// ── Training / Model endpoints ────────────────────────────────────────────────

router.get("/training/stats", requireAdmin, (_req: Request, res: Response) =>
  proxyGet("/training/stats", {}, _req, res, "/training/stats"),
);

router.post("/training/trigger", requireAdmin, (req: Request, res: Response) =>
  proxyPost("/training/trigger", req.body, res, "/training/trigger"),
);

router.get("/training/dataset/stats", requireAdmin, (_req: Request, res: Response) =>
  proxyGet("/training/dataset/stats", {}, _req, res, "/training/dataset/stats"),
);

router.get("/model/status", requireAdmin, (_req: Request, res: Response) =>
  proxyGet("/model/status", {}, _req, res, "/model/status"),
);

router.get("/model/checkpoints", requireAdmin, (_req: Request, res: Response) =>
  proxyGet("/model/checkpoints", {}, _req, res, "/model/checkpoints"),
);

// ── Observability / Backup / Alerts endpoints ─────────────────────────────────

router.get("/observability/health", (_req: Request, res: Response) =>
  proxyGet("/system/health", {}, _req, res, "/observability/health"),
);

router.get("/observability/metrics", (_req: Request, res: Response) =>
  proxyGet("/system/performance", {}, _req, res, "/observability/metrics"),
);

router.get("/control/alerts", requireAdmin, (_req: Request, res: Response) =>
  proxyGet("/control/alerts", {}, _req, res, "/control/alerts"),
);

router.post("/control/alerts/test", requireAdmin, (req: Request, res: Response) =>
  proxyPost("/control/alerts/test", req.body, res, "/control/alerts/test"),
);

router.post("/backup/trigger", requireAdmin, (req: Request, res: Response) =>
  proxyPost("/backup/trigger", req.body, res, "/backup/trigger"),
);

router.get("/backup/list", requireAdmin, (_req: Request, res: Response) =>
  proxyGet("/backup/list", {}, _req, res, "/backup/list"),
);

router.post("/backup/restore/:backupId", requireAdmin, (req: Request, res: Response) =>
  proxyPost(`/backup/restore/${req.params["backupId"]}`, req.body, res, "/backup/restore"),
);

// ── NXI World-Model endpoints ─────────────────────────────────────────────────

router.get("/nxi/state", (_req: Request, res: Response) =>
  proxyGet("/nxi/state", { events_n: _req.query["events_n"] ?? 50 }, _req, res, "/nxi/state"),
);

router.post("/nxi/update", (req: Request, res: Response) =>
  proxyPost("/nxi/update", req.body, res, "/nxi/update"),
);

export default router;

