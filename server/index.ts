import dotenv from "dotenv";
import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import type { ChildProcess } from "child_process";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { pool } from "./db.js";
import { logger } from "./observability/logger.js";

const dotenvResult = dotenv.config();

// Validate required environment variables at startup
function validateEnvironment(): string[] {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Optional but recommended
  if (!process.env.OPENAI_API_KEY && process.env.USE_LOCAL_LLM !== 'true') {
    warnings.push('⚠️ OPENAI_API_KEY not set. AI features disabled, using local LLM fallback.');
  }

  if (!process.env.DATABASE_URL) {
    warnings.push('⚠️ DATABASE_URL not set. Using in-memory storage.');
  }

  if (warnings.length > 0) {
    warnings.forEach(w => console.warn(`[Environment] ${w}`));
  }

  return missing;
}

// Keep both OpenAI key env names aligned to avoid stale-key mismatches across modules.
// Prefer values from .env when present, but do not override unrelated runtime env values.
const filePrimaryOpenAiKey = dotenvResult.parsed?.OPENAI_API_KEY?.trim();
const fileIntegrationOpenAiKey = dotenvResult.parsed?.AI_INTEGRATIONS_OPENAI_API_KEY?.trim();
const primaryOpenAiKey = filePrimaryOpenAiKey || process.env.OPENAI_API_KEY?.trim();
const integrationOpenAiKey = fileIntegrationOpenAiKey || process.env.AI_INTEGRATIONS_OPENAI_API_KEY?.trim();
if (primaryOpenAiKey) {
  process.env.OPENAI_API_KEY = primaryOpenAiKey;
  process.env.AI_INTEGRATIONS_OPENAI_API_KEY = primaryOpenAiKey;
} else if (integrationOpenAiKey) {
  process.env.OPENAI_API_KEY = integrationOpenAiKey;
  process.env.AI_INTEGRATIONS_OPENAI_API_KEY = integrationOpenAiKey;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const BASE_URL = process.env.BASE_URL || "";
let systemReady = false;
let frontendReady = false;
const managedChildProcesses: ChildProcess[] = [];
let shuttingDown = false;

app.use((req, res, next) => {
  logger.info("incoming_request", { method: req.method, url: req.url });
  console.log("REQ:", req.method, req.url);
  res.on("finish", () => {
    console.log("RES:", req.method, req.url, res.statusCode);
  });
  next();
});

app.use(cors({
  origin: process.env.CORS_ORIGIN || "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
}));

function findDistPublic(): string | null {
  const candidates = [
    path.resolve(__dirname, "..", "public"),
    path.resolve(process.cwd(), "dist", "public"),
    path.resolve(process.cwd(), "public"),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "index.html"))) return dir;
  }
  return null;
}

export function log(message: string, source = "express") {
  logger.info("service_log", { source, message });
}

app.get("/__health", (_req, res) => res.status(200).send("ok"));
app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));
app.get("/health/live", (_req, res) => res.status(200).json({ status: "alive" }));
app.get("/health/ready", (_req, res) => {
  res.status(systemReady ? 200 : 503).json({ status: systemReady ? "ready" : "initializing" });
});
app.get("/api/system/intelligence-metrics", (req: any, res) => {
  const role = req.session?.user?.role || req.user?.role;
  if (role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }

  res.json({
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    timestamp: Date.now(),
  });
});

app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: false,
}));

// Register API middleware before static middleware
app.use("/api", (req, res, next) => {
  if (systemReady) return next();
  res.status(503).json({ message: "System initializing" });
});

const distPublic = process.env.NODE_ENV === "production" ? findDistPublic() : null;
if (distPublic) {
  log(`[Static] Serving from ${distPublic}`);
  // Skip static serving for /api routes
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    express.static(distPublic, { index: "index.html" })(req, res, next);
  });
  app.get("/", (_req, res) => res.status(200).sendFile(path.join(distPublic, "index.html")));
} else if (process.env.NODE_ENV === "production") {
  app.get("/", (_req, res) => res.status(200).json({ service: "CYRUS", status: "online" }));
}
// In dev mode Vite handles "/" via its own middleware, but ensure it reaches Vite:
// The Vite /*path catch-all added later will handle it.

app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));
app.use('/images', express.static(path.join(process.cwd(), 'public', 'images')));
app.use('/videos', express.static(path.join(process.cwd(), 'public', 'videos')));

// Prevent transient "Cannot GET /comms" during boot while frontend middleware initializes.
app.use((req, res, next) => {
  if (frontendReady) return next();
  if (req.method !== "GET") return next();

  const pathName = req.path;
  if (
    pathName.startsWith("/api") ||
    pathName.startsWith("/uploads") ||
    pathName.startsWith("/images") ||
    pathName.startsWith("/videos") ||
    pathName.startsWith("/@vite") ||
    pathName.startsWith("/@fs") ||
    pathName.startsWith("/src/")
  ) {
    return next();
  }

  return res.status(200).type("html").send(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CYRUS initializing</title>
    <style>
      body { margin:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#000; color:#d1d5db; display:grid; place-items:center; min-height:100vh; }
      .panel { text-align:center; padding:24px; border:1px solid rgba(34,211,238,.35); border-radius:12px; background:rgba(15,23,42,.45); }
      .dot { width:10px; height:10px; border-radius:50%; background:#22d3ee; margin:0 auto 12px; animation:pulse 1.2s infinite; }
      @keyframes pulse { 0% { opacity:.35; } 50% { opacity:1; } 100% { opacity:.35; } }
    </style>
  </head>
  <body>
    <div class="panel">
      <div class="dot"></div>
      <div>CYRUS is initializing the interface...</div>
      <div style="margin-top:12px;font-size:12px;opacity:.8;">This page no longer auto-reloads to prevent UI blink loops.</div>
      <button onclick="location.reload()" style="margin-top:10px;padding:6px 12px;border-radius:8px;border:1px solid #22d3ee;background:#0f172a;color:#d1d5db;cursor:pointer;">Retry</button>
    </div>
  </body>
</html>`);
});

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(express.json({ limit: "2mb", verify: (req, _res, buf) => { req.rawBody = buf; } }));
app.use(express.urlencoded({ extended: false }));

app.use("/api", (req, res, next) => {
  if (systemReady) return next();
  res.status(503).json({ message: "System initializing" });
});

app.use((req, res, next) => {
  const start = Date.now();
  const reqPath = req.path;
  let capturedJsonResponse: Record<string, any> | undefined;
  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (reqPath.startsWith("/api")) {
      let logLine = `${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      logger.info("api_response", {
        method: req.method,
        path: reqPath,
        status: res.statusCode,
        durationMs: duration,
        response: capturedJsonResponse,
        summary: logLine,
      });
    }
  });
  next();
});

const port = parseInt(process.env.PORT || "3105", 10);
const listenOptions: { port: number; host: string; reusePort?: boolean } = {
  port,
  host: "0.0.0.0",
};

if (process.env.ENABLE_REUSE_PORT === "true") {
  listenOptions.reusePort = true;
}

httpServer.listen(listenOptions, () => {
  console.log(`Server running on port ${port}`);
  log(`serving on port ${port}`);
  log(`base_url=${BASE_URL || "(empty)"}`);

  // Validate environment before setting up routes
  const envErrors = validateEnvironment();
  if (envErrors.length > 0) {
    console.error('[Environment] Critical environment variables missing:', envErrors);
    process.exit(1);
  }

  setupFrontendRoutes().catch((err) => {
    console.error("[Init] Frontend route setup failed:", err);
  });

  // Initialize system immediately (don't delay with setTimeout)
  initializeSystem().catch((err) => {
    console.error("System initialization error:", err);
    // Don't exit - allow partial system to run
  });
});

async function initializeSystem() {
  const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 5));
  let isAuthenticatedMiddleware: any = null;

  try {
    if (process.env.REPL_ID) {
      const { setupAuth, registerAuthRoutes, isAuthenticated } = await import("./replit_integrations/auth");
      await setupAuth(app);
      registerAuthRoutes(app);
      isAuthenticatedMiddleware = isAuthenticated;
      log("Replit Auth initialized");
    } else {
      const { setupAuth, registerAuthRoutes, isAuthenticated } = await import("../standalone/auth-adapter");
      await setupAuth(app);
      registerAuthRoutes(app);
      isAuthenticatedMiddleware = isAuthenticated;
      log("Standalone Auth initialized");
    }

    const { createApiAuthMiddleware, createStandardLimiter, requireAdminForSensitiveApi } = await import("./security/middleware");
    app.use("/api", createApiAuthMiddleware(isAuthenticatedMiddleware));
    app.use("/api", requireAdminForSensitiveApi);

    const limiter = createStandardLimiter(100, 15 * 60 * 1000);
    app.use("/api/inference", limiter);
    app.use("/api/cyrus/speak", limiter);
    app.use("/api/vision", limiter);
    app.use("/api/upload", limiter);

    const { default: settingsRoutes } = await import("./settings/routes");
    const { default: sysdbRoutes } = await import("./sysdb/routes");
    const { default: queryRoutes } = await import("./query/router");
    const { default: trainRoutes } = await import("./train/routes");
    const { default: intelligenceCoreRoutes } = await import("./intelligence/core-routes");

    app.use("/api/settings", settingsRoutes);
    app.use("/api/sysdb", sysdbRoutes);
    app.use("/api/query", queryRoutes);
    app.use("/api/train", trainRoutes);
    app.use("/api", intelligenceCoreRoutes);
  } catch (e) {
    console.error("[Init] Auth setup failed (non-fatal):", e);
  }
  await tick();

  try {
    const { default: humanoidRoutes } = await import("./humanoid/routes");
    app.use("/api/humanoid", humanoidRoutes);
    log("[Humanoid] Registered");
  } catch (e) {
    console.error("[Init] Humanoid failed (non-fatal):", e);
  }
  await tick();

  try {
    const { default: visionRoutes } = await import("./humanoid/vision-analysis");
    app.use("/api/vision", visionRoutes);
    log("[Vision] Registered");
  } catch (e) {
    console.error("[Init] Vision failed (non-fatal):", e);
  }
  await tick();

  try {
    const { registerRoutes } = await import("./routes");
    await registerRoutes(httpServer, app);
  } catch (e) {
    console.error("[Init] Routes failed:", e);
  }
  await tick();

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) return next(err);
    return res.status(status).json({ message });
  });

  systemReady = true;
  log("All systems initialized - accepting API traffic");

  if (process.env.NODE_ENV === "production") {
    try {
      const { spawn } = await import("child_process");
      const pythonServices = [
        ["python3", ["server/quantum_ai/quantum_bridge.py"]],
        ["python3", ["server/comms/ml_service.py"]],
      ] as const;

      for (const [command, args] of pythonServices) {
        const alreadyRunning = managedChildProcesses.some(
          (child) => !child.killed && child.spawnfile === command && JSON.stringify(child.spawnargs.slice(1)) === JSON.stringify(args)
        );
        if (alreadyRunning) continue;

        const child = spawn(command, args, { stdio: "ignore" });
        managedChildProcesses.push(child);
      }
      log("Python services spawned");
    } catch (e) {
      console.error("[Init] Python services failed (non-fatal):", e);
    }
  }
}

async function setupFrontendRoutes() {
  if (frontendReady) return;

  if (process.env.NODE_ENV !== "production") {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
    frontendReady = true;
    return;
  }

  const dp = findDistPublic();
  if (dp) {
    app.use("/*path", (req, res) => {
      if (req.path.startsWith("/api")) {
        return res.status(404).json({ message: "API route not found" });
      }
      res.sendFile(path.join(dp, "index.html"));
    });
  }

  frontendReady = true;
}

async function gracefulShutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.warn("graceful_shutdown_start", { signal });

  for (const child of managedChildProcesses) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }

  try {
    const { cyrusBrain } = await import("./ai/cyrus-brain");
    await cyrusBrain.shutdown();
  } catch (error) {
    logger.warn("brain_shutdown_warning", { error });
  }

  try {
    await pool.end();
  } catch (error) {
    logger.warn("database_shutdown_warning", { error });
  }

  await new Promise<void>((resolve) => {
    httpServer.close(() => resolve());
  });

  process.exit(0);
}

process.on("SIGTERM", () => { void gracefulShutdown("SIGTERM"); });
process.on("SIGINT", () => { void gracefulShutdown("SIGINT"); });
process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION:", reason);
  logger.error("unhandled_rejection", { reason });
});
process.on("uncaughtException", (e) => {
  console.error("UNCAUGHT EXCEPTION:", e);
  logger.error("uncaught_exception", { error: e });
  if (e.message?.includes("EADDRINUSE")) process.exit(1);
});

setInterval(() => {
  console.log("SYSTEM HEARTBEAT OK");
}, 5000).unref();
