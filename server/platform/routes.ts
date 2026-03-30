/**
 * CYRUS Platform Routes — API-first intelligence platform layer.
 *
 * Exposes real-time data ingestion, fused intelligence retrieval, external
 * action execution, and plugin management via the Node.js REST API.
 *
 * Route map:
 *   POST   /api/platform/ingest          — enqueue a real-time event
 *   GET    /api/platform/intelligence    — latest fused intelligence picture
 *   POST   /api/platform/action         — execute an external action
 *   GET    /api/platform/state          — system health (queue depth, uptime…)
 *   GET    /api/platform/plugins        — list registered plugins
 *
 * All routes proxy to the Python FastAPI service at CYRUS_AI_URL.
 * The plugin manifest endpoint is served locally (no Python call needed).
 */

import { Router, type Request, type Response } from "express";
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

/** POST /api/platform/action — execute a named external action. */
router.post("/action", async (req: Request, res: Response) => {
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

export default router;
