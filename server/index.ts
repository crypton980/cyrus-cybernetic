import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

const initState = {
  ready: false,
  shuttingDown: false,
};

function findDistPublic(): string | null {
  const candidates = [
    path.resolve(__dirname, "..", "public"),
    path.resolve(process.cwd(), "dist", "public"),
    path.resolve(process.cwd(), "public"),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "index.html"))) {
      return dir;
    }
  }
  return null;
}

app.get("/__health", (_req, res) => {
  res.status(200).send("ok");
});

app.get("/health/live", (_req, res) => {
  res.status(200).json({ status: "alive", timestamp: new Date().toISOString() });
});

app.get("/health/ready", (_req, res) => {
  if (initState.ready && !initState.shuttingDown) {
    return res.status(200).json({ status: "ready" });
  }
  res.status(503).json({ status: "initializing" });
});

const distPublic = process.env.NODE_ENV === "production" ? findDistPublic() : null;
if (distPublic) {
  console.log(`[Static] Serving from ${distPublic}`);
  app.use(express.static(distPublic, { index: "index.html" }));
  app.get("/", (_req, res) => {
    res.status(200).sendFile(path.join(distPublic, "index.html"));
  });
} else if (process.env.NODE_ENV === "production") {
  console.warn("[Static] No dist/public found, serving fallback for /");
  app.get("/", (_req, res) => {
    res.status(200).json({ service: "CYRUS Humanoid AI System", status: "online" });
  });
}

app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));
app.use('/images', express.static(path.join(process.cwd(), 'public', 'images')));
app.use('/videos', express.static(path.join(process.cwd(), 'public', 'videos')));

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const reqPath = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (reqPath.startsWith("/api")) {
      let logLine = `${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

const port = parseInt(process.env.PORT || "5000", 10);
httpServer.listen(
  {
    port,
    host: "0.0.0.0",
    reusePort: true,
  },
  () => {
    log(`serving on port ${port}`);
    log(`Health check: http://0.0.0.0:${port}/`);

    setImmediate(() => {
      initializeSystem().catch((err) => {
        console.error("System initialization error:", err);
      });
    });
  },
);

async function initializeSystem() {
  try {
    const { setupAuth, registerAuthRoutes } = await import("./replit_integrations/auth");
    await setupAuth(app);
    registerAuthRoutes(app);
  } catch (authErr) {
    console.error("[Init] Auth setup failed (non-fatal):", authErr);
  }

  try {
    const { default: humanoidRoutes } = await import("./humanoid/routes");
    const { default: visionRoutes } = await import("./humanoid/vision-analysis");
    app.use("/api/humanoid", humanoidRoutes);
    app.use("/api/vision", visionRoutes);
    console.log("[Humanoid] Professional Presenter & Conversation Engine registered");
    console.log("[Vision] Always-on people analysis system registered");
  } catch (humanoidErr) {
    console.error("[Init] Humanoid module failed (non-fatal):", humanoidErr);
  }

  const { registerRoutes } = await import("./routes");
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV !== "production") {
    try {
      const { setupVite } = await import("./vite");
      await setupVite(httpServer, app);
    } catch (viteErr) {
      console.error("[Init] Vite setup failed:", viteErr);
    }
  } else {
    const distPublic = findDistPublic();
    if (distPublic) {
      app.use("*", (_req, res) => {
        res.sendFile(path.join(distPublic, "index.html"));
      });
    }
  }

  initState.ready = true;
  log("All systems initialized");

  if (process.env.NODE_ENV === "production") {
    try {
      const { spawn } = await import("child_process");
      const pyBridge = spawn("python", ["server/quantum_ai/quantum_bridge.py"], {
        stdio: "ignore",
        detached: true,
      });
      pyBridge.unref();
      log("Quantum AI Bridge spawned (background)");

      const pyML = spawn("python", ["server/comms/ml_service.py"], {
        stdio: "ignore",
        detached: true,
      });
      pyML.unref();
      log("Comms ML Service spawned (background)");
    } catch (pyErr) {
      console.error("[Init] Python services failed to spawn (non-fatal):", pyErr);
    }
  }
}

process.on("SIGTERM", () => {
  initState.shuttingDown = true;
  httpServer.close();
});

process.on("unhandledRejection", (reason) => {
  console.error("[Process] Unhandled rejection (non-fatal):", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[Process] Uncaught exception:", err);
  if (err.message?.includes("EADDRINUSE")) {
    process.exit(1);
  }
});
