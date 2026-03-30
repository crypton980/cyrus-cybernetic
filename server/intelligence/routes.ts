/**
 * CYRUS Intelligence Routes
 *
 * Exposes memory, learning, decision, execution, training, session memory,
 * multi-agent cognitive processing, and observability through the Node.js REST API.
 * All routes require authentication (enforced globally in server/index.ts).
 * Admin-only endpoints additionally require role === "admin".
 *
 * Route map:
 *   POST   /api/memory/store               — store a memory entry
 *   POST   /api/memory/query               — semantic memory search
 *   DELETE /api/memory/:id                 — remove a memory entry (admin)
 *   GET    /api/memory/stats               — collection statistics (admin)
 *   POST   /api/feedback                   — log rated interaction feedback
 *   POST   /api/execute                    — brain decision + tool execution + session log
 *   POST   /api/train                      — ingest a PDF/txt/md into memory (admin)
 *   GET    /api/session                    — retrieve current user's session history
 *   DELETE /api/session                    — clear current user's session history
 *   POST   /api/cognitive/process          — full multi-agent cognitive pipeline
 *   GET    /api/system/intelligence-metrics — system observability metrics
 */

import { Router, type Request, type RequestHandler } from "express";
import path from "path";
import fs from "fs";
import { storeMemory, queryMemory, deleteMemory, getMemoryStats, logFeedback } from "../services/memoryService";
import { executeDecision, processCognitive, getRegisteredTools } from "../services/brainService";
import { storeSession, getSession, clearSession, isRedisOnline } from "../services/sessionMemory";

const router = Router();

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
    return res.status(403).json({ error: "Forbidden: admin access required" });
  }
  return next();
};

// ── Memory routes ─────────────────────────────────────────────────────────────

/** POST /api/memory/store */
router.post("/memory/store", async (req, res) => {
  const { text, metadata } = req.body as { text?: string; metadata?: Record<string, unknown> };

  if (!text || typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "text is required" });
  }

  const id = await storeMemory(text.trim(), metadata ?? {});
  if (id === null) {
    return res.status(503).json({ error: "AI memory service unavailable" });
  }
  return res.json({ status: "stored", id });
});

/** POST /api/memory/query */
router.post("/memory/query", async (req, res) => {
  const { query, nResults } = req.body as { query?: string; nResults?: number };

  if (!query || typeof query !== "string" || !query.trim()) {
    return res.status(400).json({ error: "query is required" });
  }

  const results = await queryMemory(query.trim(), nResults ?? 5);
  return res.json(results);
});

/** DELETE /api/memory/:id (admin) */
router.delete("/memory/:id", requireAdmin, async (req, res) => {
  const deleted = await deleteMemory(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: "Memory entry not found or service unavailable" });
  }
  return res.json({ status: "deleted", id: req.params.id });
});

/** GET /api/memory/stats (admin) */
router.get("/memory/stats", requireAdmin, async (_req, res) => {
  const stats = await getMemoryStats();
  return res.json(stats);
});

// ── Feedback / learning route ─────────────────────────────────────────────────

/** POST /api/feedback */
router.post("/feedback", async (req, res) => {
  const { input, response, rating, userId, context } = req.body as {
    input?: string;
    response?: string;
    rating?: number;
    userId?: string;
    context?: string;
  };

  if (!input || !response) {
    return res.status(400).json({ error: "input and response are required" });
  }
  if (typeof rating !== "number" || rating < 1 || rating > 5) {
    return res.status(400).json({ error: "rating must be a number between 1 and 5" });
  }

  const result = await logFeedback({ input, response, rating, userId, context });
  return res.json({ status: "logged", ...result });
});

// ── Decision / execution route ────────────────────────────────────────────────

/** POST /api/execute */
router.post("/execute", async (req, res) => {
  const { input, nContext } = req.body as { input?: string; nContext?: number };

  if (!input || typeof input !== "string" || !input.trim()) {
    return res.status(400).json({ error: "input is required" });
  }

  const result = await executeDecision(input.trim(), nContext ?? 5);

  // Persist to session memory (non-blocking — errors don't fail the request)
  const user = getSessionUser(req);
  if (user?.id) {
    storeSession(user.id, {
      input: input.trim(),
      decision: result as unknown as Record<string, unknown>,
    }).catch((err) => {
      console.warn("[Intelligence] storeSession failed:", (err as Error).message);
    });
  }

  return res.json(result);
});

// ── Training / knowledge ingestion route ──────────────────────────────────────

/** POST /api/train (admin) */
router.post("/train", requireAdmin, async (req, res) => {
  const { filePath, text, source } = req.body as {
    filePath?: string;
    text?: string;
    source?: string;
  };

  // Mode 1: caller passes raw text directly
  if (text) {
    const id = await storeMemory(text.trim(), { type: "training", source: source ?? "manual" });
    if (id === null) {
      return res.status(503).json({ error: "AI memory service unavailable" });
    }
    return res.json({ status: "trained", id, source: source ?? "manual" });
  }

  // Mode 2: caller passes an absolute server-side file path
  if (filePath) {
    // Security: resolve both paths to their canonical forms and verify the
    // target is strictly inside the uploads directory.  Using path.relative()
    // avoids startsWith() bypass attacks (e.g. sibling directory names that
    // share a common prefix with uploadsDir).
    const uploadsDir = path.resolve(process.cwd(), "public", "uploads");
    const resolvedPath = path.resolve(filePath);
    const relativeToUploads = path.relative(uploadsDir, resolvedPath);
    const isOutsideUploads =
      !relativeToUploads ||
      relativeToUploads.startsWith("..") ||
      path.isAbsolute(relativeToUploads);

    if (isOutsideUploads) {
      return res.status(400).json({ error: "filePath must be within the uploads directory" });
    }

    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: "File not found" });
    }

    const ext = path.extname(resolvedPath).toLowerCase();

    if (ext === ".pdf") {
      try {
        const { default: pdfParse } = await import("pdf-parse");
        const buffer = fs.readFileSync(resolvedPath);
        const data = await pdfParse(buffer);
        const id = await storeMemory(data.text, {
          type: "training",
          source: source ?? path.basename(resolvedPath),
          pages: data.numpages,
        });
        if (id === null) {
          return res.status(503).json({ error: "AI memory service unavailable" });
        }
        return res.json({
          status: "trained",
          id,
          source: source ?? path.basename(resolvedPath),
          pages: data.numpages,
          chars: data.text.length,
        });
      } catch (err) {
        console.error("[Train] PDF parse error:", err);
        return res.status(500).json({ error: "Failed to parse PDF" });
      }
    }

    if (ext === ".txt" || ext === ".md") {
      const content = fs.readFileSync(resolvedPath, "utf8");
      const id = await storeMemory(content, {
        type: "training",
        source: source ?? path.basename(resolvedPath),
      });
      if (id === null) {
        return res.status(503).json({ error: "AI memory service unavailable" });
      }
      return res.json({ status: "trained", id, source: source ?? path.basename(resolvedPath) });
    }

    return res.status(400).json({ error: "Unsupported file type. Use .pdf, .txt, or .md" });
  }

  return res.status(400).json({ error: "Either text or filePath is required" });
});

// ── Session memory routes ─────────────────────────────────────────────────────

/** GET /api/session — retrieve current user's recent interaction history */
router.get("/session", async (req, res) => {
  const user = getSessionUser(req);
  if (!user?.id) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  const history = await getSession(user.id);
  return res.json({ userId: user.id, count: history.length, history });
});

/** DELETE /api/session — clear current user's session history */
router.delete("/session", async (req, res) => {
  const user = getSessionUser(req);
  if (!user?.id) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  await clearSession(user.id);
  return res.json({ status: "cleared", userId: user.id });
});

// ── Cognitive / multi-agent route ─────────────────────────────────────────────

/**
 * POST /api/cognitive/process
 *
 * Runs the full multi-agent intelligence pipeline:
 *   SecurityAgent → MemoryAgent → AnalysisAgent → MissionAgent
 *   (→ LearningAgent when feedback is provided)
 *
 * Body:
 *   { input: string, nMemory?: number, feedback?: { rating: number, ... } }
 *
 * Returns the complete CognitiveResult payload and stores the interaction
 * in session memory (non-blocking).
 */
router.post("/cognitive/process", async (req, res) => {
  const { input, nMemory, feedback } = req.body as {
    input?: string;
    nMemory?: number;
    feedback?: { rating: number; [key: string]: unknown } | null;
  };

  if (!input || typeof input !== "string" || !input.trim()) {
    return res.status(400).json({ error: "input is required" });
  }

  const result = await processCognitive(input.trim(), {
    nMemory: typeof nMemory === "number" ? nMemory : 5,
    feedback: feedback ?? null,
  });

  // Persist interaction to session memory (non-blocking)
  const user = getSessionUser(req);
  if (user?.id) {
    storeSession(user.id, {
      input: input.trim(),
      decision: result as unknown as Record<string, unknown>,
    }).catch((err) => {
      console.warn("[Intelligence] storeSession (cognitive) failed:", (err as Error).message);
    });
  }

  return res.json(result);
});

// ── Observability / metrics route ─────────────────────────────────────────────

/** GET /api/system/intelligence-metrics */
router.get("/system/intelligence-metrics", async (_req, res) => {
  const [memStats, redisOnline] = await Promise.all([
    getMemoryStats(),
    isRedisOnline(),
  ]);

  return res.json({
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    timestamp: Date.now(),
    registeredTools: getRegisteredTools(),
    redis: { online: redisOnline },
    vectorMemory: memStats,
  });
});

export default router;
