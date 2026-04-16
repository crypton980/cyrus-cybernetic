import type { Express, Request } from "express";
import { z } from "zod";
import fetch from "node-fetch";
import { getBestFix, updateFix } from "./position";
import { PositionFix, RouteRequest, RouteSummary } from "./types";
import { startShare, stopShare, getSharedFix } from "./share";

const manualFixSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  accuracy: z.number().min(1),
  source: z.enum(["gps", "network", "manual"]).default("manual"),
  timestamp: z.number().optional(),
});

const routeSchema = z.object({
  origin: z.object({ lat: z.number(), lon: z.number() }),
  destination: z.object({ lat: z.number(), lon: z.number() }),
  waypoints: z.array(z.object({ lat: z.number(), lon: z.number() })).optional(),
  mode: z.enum(["driving", "walking", "bicycling"]).optional(),
});

const shareStartSchema = z.object({
  recipientId: z.string(),
  durationSeconds: z.number().min(30).max(3600),
  mode: z.enum(["live", "snapshot"]).default("live"),
});

const shareStopSchema = z.object({
  token: z.string(),
});

async function fetchGoogleRoute(body: RouteRequest): Promise<RouteSummary> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY not set");
  }
  const params = new URLSearchParams();
  params.set("origin", `${body.origin.lat},${body.origin.lon}`);
  params.set("destination", `${body.destination.lat},${body.destination.lon}`);
  if (body.waypoints?.length) {
    params.set("waypoints", body.waypoints.map((w) => `${w.lat},${w.lon}`).join("|"));
  }
  params.set("mode", body.mode || "driving");
  params.set("key", apiKey);

  const url = `https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Directions API failed: ${resp.status}`);
  const data: any = await resp.json();
  if (data.status !== "OK") throw new Error(`Directions API error: ${data.status}`);
  const leg = data.routes?.[0]?.legs?.[0];
  if (!leg) throw new Error("No route returned");
  const distanceMeters = leg.distance?.value || 0;
  const durationSeconds = leg.duration?.value || 0;
  const polyline = data.routes?.[0]?.overview_polyline?.points;
  return {
    distanceMeters,
    durationSeconds,
    polyline,
    fetchedAt: Date.now(),
    confidence: 0.8,
    provider: "google",
  };
}

function simulateRoute(body: RouteRequest): RouteSummary {
  const distanceMeters = 1000;
  const durationSeconds = 900;
  return {
    distanceMeters,
    durationSeconds,
    fetchedAt: Date.now(),
    confidence: 0.2,
    provider: "simulated",
  };
}

export function registerNavRoutes(app: Express) {
  app.get("/api/nav/fix", (_req, res) => {
    const fix = getBestFix();
    if (!fix) return res.status(404).json({ error: "No fix available" });
    res.json(fix);
  });

  app.post("/api/nav/manual-fix", (req, res) => {
    const parsed = manualFixSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid fix", details: parsed.error.flatten() });
    }
    const fix: PositionFix = {
      ...parsed.data,
      timestamp: parsed.data.timestamp || Date.now(),
    };
    try {
      updateFix(fix);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/nav/route", async (req, res) => {
    const parsed = routeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid route request", details: parsed.error.flatten() });
    }
    try {
      let summary: RouteSummary;
      try {
        summary = await fetchGoogleRoute(parsed.data);
      } catch (err) {
        console.error("Google Directions failed, using simulated route:", err);
        summary = simulateRoute(parsed.data);
      }
      res.json(summary);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Routing failed" });
    }
  });

  app.post("/api/nav/share/start", (req, res) => {
    const parsed = shareStartSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid share payload", details: parsed.error.flatten() });
    }
    const token = startShare(parsed.data.recipientId, parsed.data.durationSeconds, parsed.data.mode);
    res.json({ token, expiresIn: parsed.data.durationSeconds });
  });

  app.post("/api/nav/share/stop", (req, res) => {
    const parsed = shareStopSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid stop payload", details: parsed.error.flatten() });
    }
    stopShare(parsed.data.token);
    res.json({ success: true });
  });

  app.get("/api/nav/share/stream", (req: Request, res) => {
    const token = req.query.token as string;
    if (!token) return res.status(400).json({ error: "token required" });
    const fix = getSharedFix(token);
    if (!fix) return res.status(404).json({ error: "share not found or expired" });
    res.json(fix);
  });
}

