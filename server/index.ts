import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import path from "path";
import fs from "fs";

const app = express();
const httpServer = createServer(app);

app.get("/__health", (_req, res) => {
  res.status(200).send("ok");
});

if (process.env.NODE_ENV === "production") {
  const distPath = path.resolve(import.meta.dirname, "..", "public");
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get("/", (_req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }
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
    setTimeout(() => {
      initializeSystem().catch((err) => {
        console.error("System initialization error:", err);
      });
    }, 0);
  },
);

async function initializeSystem() {
  const { setupAuth, registerAuthRoutes } = await import("./replit_integrations/auth");
  await setupAuth(app);
  registerAuthRoutes(app);

  const { default: humanoidRoutes } = await import("./humanoid/routes");
  const { default: visionRoutes } = await import("./humanoid/vision-analysis");
  app.use("/api/humanoid", humanoidRoutes);
  app.use("/api/vision", visionRoutes);
  console.log("[Humanoid] Professional Presenter & Conversation Engine registered");
  console.log("[Vision] Always-on people analysis system registered");

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
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  } else {
    const distPath = path.resolve(import.meta.dirname, "..", "public");
    if (fs.existsSync(distPath)) {
      app.use("*", (_req, res) => {
        res.sendFile(path.resolve(distPath, "index.html"));
      });
    }
  }

  log("All systems initialized");
}
