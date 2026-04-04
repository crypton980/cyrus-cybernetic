import type { Express } from "express";

// In-memory swarm state (simulation mode; replace with Python 8001 proxy when cyrus-ai is available)
interface DroneState {
  id: string;
  name: string;
  status: "active" | "idle" | "fault" | "pursuing";
  battery: number;
  latitude: number;
  longitude: number;
  altitude: number;
  heading: number;
  speed: number;
  task?: string;
  lastHeartbeat: number;
}

interface SwarmState {
  drones: Map<string, DroneState>;
  formation: "circle" | "line" | "wedge" | "none";
  activePursuits: string[];
  nxiEvents: Array<{ id: string; type: string; data: unknown; ts: number }>;
}

const swarmState: SwarmState = {
  drones: new Map(),
  formation: "none",
  activePursuits: [],
  nxiEvents: [],
};

const MAX_NXI_EVENTS = 50;
const PURSUIT_INTERPOLATION_FACTOR = 0.1;

// Seed two simulation drones on first call
function ensureSimDrones() {
  if (swarmState.drones.size === 0) {
    const sim: DroneState[] = [
      {
        id: "sim-alpha",
        name: "Alpha",
        status: "idle",
        battery: 92,
        latitude: -24.6282,
        longitude: 25.9231,
        altitude: 0,
        heading: 0,
        speed: 0,
        lastHeartbeat: Date.now(),
      },
      {
        id: "sim-bravo",
        name: "Bravo",
        status: "idle",
        battery: 85,
        latitude: -24.631,
        longitude: 25.926,
        altitude: 0,
        heading: 45,
        speed: 0,
        lastHeartbeat: Date.now(),
      },
    ];
    sim.forEach((d) => swarmState.drones.set(d.id, d));
  }
}

function dronesToArray(): DroneState[] {
  return Array.from(swarmState.drones.values());
}

export function registerSwarmRoutes(app: Express): void {
  console.log("[Swarm] Registering swarm intelligence API routes");

  // GET /api/swarm/state  — full swarm snapshot
  app.get("/api/swarm/state", (_req, res) => {
    ensureSimDrones();
    // Simulate telemetry drift for active drones
    for (const d of swarmState.drones.values()) {
      if (d.status === "active" || d.status === "pursuing") {
        d.latitude += (Math.random() - 0.5) * 0.0001;
        d.longitude += (Math.random() - 0.5) * 0.0001;
        d.altitude = Math.max(0, d.altitude + (Math.random() - 0.5) * 2);
        d.speed = Math.max(0, d.speed + (Math.random() - 0.4) * 0.5);
        d.battery = Math.max(0, d.battery - 0.01);
      }
      d.lastHeartbeat = Date.now();
    }
    res.json({
      success: true,
      drones: dronesToArray(),
      formation: swarmState.formation,
      activePursuits: swarmState.activePursuits,
      totalDrones: swarmState.drones.size,
      activeDrones: dronesToArray().filter((d) => d.status !== "idle").length,
      timestamp: new Date().toISOString(),
    });
  });

  // GET /api/swarm/drones  — drone list
  app.get("/api/swarm/drones", (_req, res) => {
    ensureSimDrones();
    res.json({ success: true, drones: dronesToArray() });
  });

  // GET /api/swarm/drone/:id/state
  app.get("/api/swarm/drone/:id/state", (req, res) => {
    ensureSimDrones();
    const drone = swarmState.drones.get(req.params.id);
    if (!drone) return res.status(404).json({ success: false, error: "Drone not found" });
    res.json({ success: true, drone });
  });

  // POST /api/swarm/register  — register / add a drone
  app.post("/api/swarm/register", (req, res) => {
    const { id, name } = req.body;
    if (!id || !name) {
      return res.status(400).json({ success: false, error: "id and name required" });
    }
    const drone: DroneState = {
      id,
      name,
      status: "idle",
      battery: 100,
      latitude: -24.6282 + (Math.random() - 0.5) * 0.01,
      longitude: 25.9231 + (Math.random() - 0.5) * 0.01,
      altitude: 0,
      heading: 0,
      speed: 0,
      lastHeartbeat: Date.now(),
    };
    swarmState.drones.set(id, drone);
    res.json({ success: true, drone });
  });

  // POST /api/swarm/formation  — set formation
  app.post("/api/swarm/formation", (req, res) => {
    const { formation } = req.body;
    const valid = ["circle", "line", "wedge", "none"];
    if (!formation || !valid.includes(formation)) {
      return res.status(400).json({ success: false, error: `formation must be one of: ${valid.join(", ")}` });
    }
    swarmState.formation = formation as SwarmState["formation"];
    // Transition all non-fault drones to active
    for (const d of swarmState.drones.values()) {
      if (d.status !== "fault") d.status = "active";
    }
    console.log(`[Swarm] Formation set to: ${formation}`);
    res.json({ success: true, formation: swarmState.formation, drones: dronesToArray() });
  });

  // POST /api/swarm/track  — begin pursuit of a target
  app.post("/api/swarm/track", (req, res) => {
    const { targetId, latitude, longitude } = req.body;
    if (!targetId) {
      return res.status(400).json({ success: false, error: "targetId required" });
    }
    if (!swarmState.activePursuits.includes(targetId)) {
      swarmState.activePursuits.push(targetId);
    }
    for (const d of swarmState.drones.values()) {
      if (d.status !== "fault") {
        d.status = "pursuing";
        d.task = `Pursuing ${targetId}`;
        if (latitude != null) d.latitude += (latitude - d.latitude) * PURSUIT_INTERPOLATION_FACTOR;
        if (longitude != null) d.longitude += (longitude - d.longitude) * PURSUIT_INTERPOLATION_FACTOR;
      }
    }
    // Record NXI event
    const event = {
      id: `nxi-${Date.now()}`,
      type: "target_detected",
      data: { targetId, latitude, longitude },
      ts: Date.now(),
    };
    swarmState.nxiEvents.unshift(event);
    if (swarmState.nxiEvents.length > MAX_NXI_EVENTS) swarmState.nxiEvents.length = MAX_NXI_EVENTS;
    res.json({ success: true, targetId, activePursuits: swarmState.activePursuits, drones: dronesToArray() });
  });

  // POST /api/swarm/event  — generic swarm event
  app.post("/api/swarm/event", (req, res) => {
    const { type, data } = req.body;
    if (!type) return res.status(400).json({ success: false, error: "type required" });
    const event = { id: `nxi-${Date.now()}`, type, data: data || {}, ts: Date.now() };
    swarmState.nxiEvents.unshift(event);
    if (swarmState.nxiEvents.length > MAX_NXI_EVENTS) swarmState.nxiEvents.length = MAX_NXI_EVENTS;

    if (type === "drone_fault") {
      const { droneId } = (data as Record<string, string>) || {};
      if (droneId && swarmState.drones.has(droneId)) {
        swarmState.drones.get(droneId)!.status = "fault";
      }
    }
    res.json({ success: true, event });
  });

  // GET /api/swarm/nxi  — NXI world-model events (last 50)
  app.get("/api/swarm/nxi", (_req, res) => {
    res.json({
      success: true,
      events: swarmState.nxiEvents,
      totalEvents: swarmState.nxiEvents.length,
      timestamp: new Date().toISOString(),
    });
  });

  console.log("[Swarm] Routes registered: state, drones, register, formation, track, event, nxi");
}
