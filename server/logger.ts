/**
 * CYRUS Structured Logger (Node.js / Winston)
 *
 * Provides a production-ready, structured JSON logger backed by Winston.
 * Features:
 *   - JSON lines output in production (LOG_FORMAT=json or NODE_ENV=production)
 *   - Colourised human-readable output in development
 *   - Configurable level via LOG_LEVEL env var (default: "info")
 *   - Request-scoped child loggers via logger.child({ requestId })
 *   - Safe serialisation of Error objects (stack trace preserved)
 *
 * Usage:
 *   import { logger } from "./logger";
 *   logger.info("Server started", { port: 3105 });
 *   logger.error("Unhandled exception", { err });
 *
 *   const reqLogger = logger.child({ requestId: "abc123" });
 *   reqLogger.warn("Slow query detected", { queryMs: 3200 });
 */

import winston from "winston";

// ── Configuration ─────────────────────────────────────────────────────────────

const LOG_LEVEL = process.env["LOG_LEVEL"] ?? "info";
const LOG_FORMAT = process.env["LOG_FORMAT"] ?? (process.env["NODE_ENV"] === "production" ? "json" : "pretty");

// ── Formatters ────────────────────────────────────────────────────────────────

const { combine, timestamp, errors, json, colorize, printf, label } = winston.format;

/** Serialise Error objects so the stack trace is captured in the JSON payload. */
const errorSerializer = winston.format((info) => {
  if (info["err"] instanceof Error) {
    const err = info["err"] as Error;
    info["err"] = {
      message: err.message,
      name: err.name,
      stack: err.stack,
    };
  }
  return info;
})();

const jsonFormat = combine(
  timestamp({ format: "YYYY-MM-DDTHH:mm:ss.SSSZ" }),
  errors({ stack: true }),
  errorSerializer,
  json(),
);

const prettyFormat = combine(
  colorize({ all: true }),
  timestamp({ format: "HH:mm:ss.SSS" }),
  errors({ stack: true }),
  errorSerializer,
  printf(({ level, message, timestamp: ts, ...meta }) => {
    const metaStr = Object.keys(meta).length
      ? " " + JSON.stringify(meta)
      : "";
    return `${ts} [${level}] ${message}${metaStr}`;
  }),
);

// ── Transports ────────────────────────────────────────────────────────────────

const transports: winston.transport[] = [
  new winston.transports.Console({
    handleExceptions: true,
    handleRejections: true,
    format: LOG_FORMAT === "json" ? jsonFormat : prettyFormat,
  }),
];

// ── Logger instance ───────────────────────────────────────────────────────────

export const logger = winston.createLogger({
  level: LOG_LEVEL,
  transports,
  exitOnError: false,
});

/**
 * Create an Express/Fastify-style request logger middleware that writes an
 * INFO log line for every HTTP request with method, url, status, and latency.
 */
export function createRequestLogger() {
  return (
    req: { method: string; url: string },
    res: { statusCode: number; on: (event: string, cb: () => void) => void },
    next: () => void,
  ): void => {
    const start = Date.now();
    res.on("finish", () => {
      const ms = Date.now() - start;
      const level = res.statusCode >= 500 ? "error"
        : res.statusCode >= 400 ? "warn"
        : "info";
      logger[level]("HTTP request", {
        method: req.method,
        url: req.url,
        status: res.statusCode,
        responseTimeMs: ms,
      });
    });
    next();
  };
}

export default logger;
