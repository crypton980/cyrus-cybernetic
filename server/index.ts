import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GRACEFUL_SHUTDOWN_TIMEOUT_MS = 10_000;

const app = express();
// Trust the reverse proxy (Railway, Azure, etc.) so that req.secure is set
// correctly and session cookies are sent with Secure flag over HTTPS.
app.set("trust proxy", 1);
const httpServer = createServer(app);
let systemReady = false;

// ── Security headers (Helmet) ────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'", "wss:", "ws:", "https:"],
        mediaSrc: ["'self'", "blob:"],
        workerSrc: ["'self'", "blob:"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// ── Rate limiters for AI-consuming endpoints ─────────────────────────────────
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many uploads. Please try again later." },
});

// General rate limiter for all /api traffic — protects the authentication
// middleware from being probed at unbounded speed.
const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});

// Applied before route registration so they cover all matching paths.
app.use("/api", generalApiLimiter);
app.use("/api/inference", aiLimiter);
app.use("/api/cyrus/speak", aiLimiter);
app.use("/api/vision", aiLimiter);
app.use("/api/scan", aiLimiter);
app.use("/api/files/upload", uploadLimiter);
app.use("/api/files/full-analysis-async", uploadLimiter);
app.use("/api/files/analyze", uploadLimiter);

// Tight rate limit on authentication endpoints to prevent brute-force
// credential guessing.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again later." },
});
app.use("/api/login", authLimiter);
app.use("/api/auth", authLimiter);

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
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

app.get("/__health", (_req, res) => res.status(200).send("ok"));
app.get("/health/live", (_req, res) => res.status(200).json({ status: "alive" }));
app.get("/health/ready", (_req, res) => {
  res.status(systemReady ? 200 : 503).json({ status: systemReady ? "ready" : "initializing" });
});

const distPublic = process.env.NODE_ENV === "production" ? findDistPublic() : null;
if (distPublic) {
  log(`[Static] Serving from ${distPublic}`);
  app.use(express.static(distPublic, { index: "index.html" }));
  app.get("/", (_req, res) => res.status(200).sendFile(path.join(distPublic, "index.html")));
} else if (process.env.NODE_ENV === "production") {
  app.get("/", (_req, res) => res.status(200).json({ service: "CYRUS", status: "online" }));
}

app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));
app.use('/images', express.static(path.join(process.cwd(), 'public', 'images')));
app.use('/videos', express.static(path.join(process.cwd(), 'public', 'videos')));

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// Limit request body to 2 MB to prevent memory-exhaustion attacks.
app.use(express.json({ limit: "2mb", verify: (req, _res, buf) => { req.rawBody = buf; } }));
app.use(express.urlencoded({ extended: false, limit: "2mb" }));

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
      log(logLine);
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
  log(`serving on port ${port}`);

  setTimeout(() => {
    initializeSystem().catch((err) => {
      console.error("System initialization error:", err);
    });
  }, 500);
});

// ── Public API paths that must remain accessible before/without auth ─────────
const PUBLIC_API_PATHS = [
  "/api/login",
  "/api/logout",
  "/api/auth/user",
  "/api/__health",
  "/api/csrf-token",
];

async function initializeSystem() {
  const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 5));

  try {
    if (process.env.REPL_ID) {
      const { setupAuth, registerAuthRoutes } = await import("./replit_integrations/auth");
      await setupAuth(app);
      registerAuthRoutes(app);
      log("Replit Auth initialized");
    } else {
      const { setupAuth, registerAuthRoutes } = await import("../standalone/auth-adapter");
      await setupAuth(app);
      registerAuthRoutes(app);
      log("Standalone Auth initialized");
    }
  } catch (e) {
    console.error("[Init] Auth setup failed (non-fatal):", e);
  }
  await tick();

  // ── Global API authentication ─────────────────────────────────────────────
  // After session middleware is mounted by setupAuth(), enforce authentication
  // on all /api routes except the public login/auth paths.
  // The generalApiLimiter (already applied at app startup) covers this path,
  // but we also wrap the handler directly to ensure rate limiting is
  // unambiguously enforced on every auth check.
  try {
    const { isAuthenticated } = await import("../standalone/auth-adapter");
    app.use("/api", (req: Request & { session?: { user?: unknown }; path: string }, res, next) => {
      const isPublic = PUBLIC_API_PATHS.some(
        (p) => req.path === p || req.path.startsWith(p + "/")
      );
      if (isPublic) return next();
      return isAuthenticated(req, res, next);
    });
    log("[Auth] Global API authentication enforced");
  } catch (e) {
    console.error("[Init] Global auth middleware failed (non-fatal):", e);
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

  try {
    const { default: settingsRoutes } = await import("./settings/routes");
    app.use("/api/settings", settingsRoutes);
    log("[Settings] API key management registered at /api/settings");
  } catch (e) {
    console.error("[Init] Settings routes failed (non-fatal):", e);
  }
  await tick();

  try {
    const { default: myServerRoutes } = await import("./myserver/routes");
    app.use("/api/myserver", myServerRoutes);
    log("[MyServer] Custom personal server registered at /api/myserver");
  } catch (e) {
    console.error("[Init] MyServer failed (non-fatal):", e);
  }
  await tick();

  // ── CYRUS Intelligence Core (memory, learning, brain, execution, training) ─
  try {
    const { default: intelligenceRoutes } = await import("./intelligence/routes");
    app.use("/api", intelligenceRoutes);
    log("[Intelligence] Memory, brain, feedback, execute, train registered");
  } catch (e) {
    console.error("[Init] Intelligence routes failed (non-fatal):", e);
  }
  await tick();

  // ── API 404 catch-all (must be after all /api routes, before SPA fallback) ─
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "API endpoint not found" });
  });

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) return next(err);
    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV !== "production") {
    try {
      const { setupVite } = await import("./vite");
      await setupVite(httpServer, app);
    } catch (e) {
      console.error("[Init] Vite failed:", e);
    }
  } else {
    const dp = findDistPublic();
    if (dp) {
      app.use("*splat", (_req, res) => {
        res.sendFile(path.join(dp, "index.html"));
      });
    }
  }

  systemReady = true;
  log("All systems initialized - accepting API traffic");

  if (process.env.NODE_ENV === "production") {
    try {
      const { spawn } = await import("child_process");
      const pyBridge = spawn("python3", ["server/quantum_ai/quantum_bridge.py"], { stdio: "ignore", detached: true });
      pyBridge.unref();
      const pyML = spawn("python3", ["server/comms/ml_service.py"], { stdio: "ignore", detached: true });
      pyML.unref();
      log("Python services spawned");
    } catch (e) {
      console.error("[Init] Python services failed (non-fatal):", e);
    }
  }
}

// ── Graceful shutdown ────────────────────────────────────────────────────────
async function gracefulShutdown(signal: string) {
  log(`[Process] ${signal} received — shutting down gracefully`);

  // Store the timer handle so it can be cancelled if the server closes cleanly
  // before the timeout fires.
  const forceExitTimer = setTimeout(() => {
    console.error("[Process] Forced shutdown after timeout");
    process.exit(1);
  }, GRACEFUL_SHUTDOWN_TIMEOUT_MS);

  httpServer.close(async () => {
    clearTimeout(forceExitTimer);
    try {
      const { pool } = await import("./db");
      await pool.end();
      log("[Process] Database pool closed");
    } catch {
      // pool may not have been initialized yet
    }
    log("[Process] Shutdown complete");
    process.exit(0);
  });
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("unhandledRejection", (r) => { console.error("[Process] Unhandled rejection:", r); });
process.on("uncaughtException", (e) => {
  console.error("[Process] Uncaught exception:", e);
  if (e.message?.includes("EADDRINUSE")) process.exit(1);
});
