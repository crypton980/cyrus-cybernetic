/**
 * Real-time Telemetry Simulation
 * Generates realistic drone telemetry data for dashboard visualization
 */

import type { WebSocket } from "ws";
import { storage } from "./storage";

interface TelemetryState {
  droneId: string;
  altitude: number;
  speed: number;
  heading: number;
  latitude: number;
  longitude: number;
  batteryLevel: number;
  batteryVoltage: number;
  signalStrength: number;
  gpsAccuracy: number;
  temperature: number;
  windSpeed: number;
}

const droneStates: Map<string, TelemetryState> = new Map();
const connectedClients: Set<WebSocket> = new Set();
let simulationInterval: NodeJS.Timeout | null = null;

function initializeDroneState(droneId: string, baseLatitude = 37.7749, baseLongitude = -122.4194): TelemetryState {
  return {
    droneId,
    altitude: 50 + Math.random() * 150,
    speed: 10 + Math.random() * 30,
    heading: Math.random() * 360,
    latitude: baseLatitude + (Math.random() - 0.5) * 0.01,
    longitude: baseLongitude + (Math.random() - 0.5) * 0.01,
    batteryLevel: 60 + Math.random() * 40,
    batteryVoltage: 22.2 + Math.random() * 2,
    signalStrength: 70 + Math.random() * 30,
    gpsAccuracy: 1 + Math.random() * 3,
    temperature: 20 + Math.random() * 15,
    windSpeed: Math.random() * 15,
  };
}

function updateDroneState(state: TelemetryState): TelemetryState {
  const deltaTime = 1;
  
  const headingChange = (Math.random() - 0.5) * 10;
  state.heading = (state.heading + headingChange + 360) % 360;
  
  const headingRad = state.heading * Math.PI / 180;
  const speedKmPerSec = state.speed / 3600;
  const latChange = speedKmPerSec * Math.cos(headingRad) * deltaTime / 111;
  const lonChange = speedKmPerSec * Math.sin(headingRad) * deltaTime / (111 * Math.cos(state.latitude * Math.PI / 180));
  
  state.latitude += latChange + (Math.random() - 0.5) * 0.0001;
  state.longitude += lonChange + (Math.random() - 0.5) * 0.0001;
  
  state.altitude += (Math.random() - 0.5) * 5;
  state.altitude = Math.max(10, Math.min(500, state.altitude));
  
  state.speed += (Math.random() - 0.5) * 5;
  state.speed = Math.max(0, Math.min(100, state.speed));
  
  state.batteryLevel -= 0.01 + Math.random() * 0.02;
  state.batteryLevel = Math.max(0, state.batteryLevel);
  state.batteryVoltage = 18 + (state.batteryLevel / 100) * 7;
  
  state.signalStrength += (Math.random() - 0.5) * 5;
  state.signalStrength = Math.max(20, Math.min(100, state.signalStrength));
  
  state.gpsAccuracy += (Math.random() - 0.5) * 0.5;
  state.gpsAccuracy = Math.max(0.5, Math.min(10, state.gpsAccuracy));
  
  state.temperature += (Math.random() - 0.5) * 1;
  state.temperature = Math.max(10, Math.min(50, state.temperature));
  
  state.windSpeed += (Math.random() - 0.5) * 2;
  state.windSpeed = Math.max(0, Math.min(30, state.windSpeed));
  
  return state;
}

function generateTelemetryPacket(state: TelemetryState) {
  return {
    droneId: state.droneId,
    timestamp: new Date().toISOString(),
    altitude: Math.round(state.altitude * 10) / 10,
    speed: Math.round(state.speed * 10) / 10,
    heading: Math.round(state.heading),
    latitude: Math.round(state.latitude * 1000000) / 1000000,
    longitude: Math.round(state.longitude * 1000000) / 1000000,
    batteryLevel: Math.round(state.batteryLevel),
    batteryVoltage: Math.round(state.batteryVoltage * 100) / 100,
    signalStrength: Math.round(state.signalStrength),
    gpsAccuracy: Math.round(state.gpsAccuracy * 10) / 10,
    temperature: Math.round(state.temperature * 10) / 10,
    windSpeed: Math.round(state.windSpeed * 10) / 10,
    subsystems: {
      propulsion: state.batteryLevel > 15 ? "nominal" : "degraded",
      navigation: state.gpsAccuracy < 5 ? "nominal" : "degraded",
      sensors: "nominal",
      communication: state.signalStrength > 30 ? "nominal" : "degraded",
      payload: "nominal",
    },
  };
}

async function simulationTick() {
  try {
    const drones = await storage.getDrones();
    
    const activeDrones = drones.filter(d => 
      d.status === "online" || d.status === "mission" || d.status === "returning"
    );
    
    const telemetryUpdates: any[] = [];
    
    for (const drone of activeDrones) {
      let state = droneStates.get(drone.id);
      
      if (!state) {
        state = initializeDroneState(drone.id);
        droneStates.set(drone.id, state);
      }
      
      state = updateDroneState(state);
      droneStates.set(drone.id, state);
      
      const packet = generateTelemetryPacket(state);
      telemetryUpdates.push(packet);
      
      await storage.updateTelemetry(drone.id, packet);
    }
    
    if (telemetryUpdates.length > 0) {
      broadcast({
        type: "telemetry_update",
        data: telemetryUpdates,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error("Telemetry simulation error:", error);
  }
}

function broadcast(message: any) {
  const payload = JSON.stringify(message);
  
  Array.from(connectedClients).forEach(client => {
    try {
      if (client.readyState === 1) {
        client.send(payload);
      }
    } catch (error) {
      console.error("WebSocket broadcast error:", error);
    }
  });
}

export function addClient(ws: WebSocket) {
  connectedClients.add(ws);
  
  ws.on("close", () => {
    connectedClients.delete(ws);
  });
  
  ws.on("error", () => {
    connectedClients.delete(ws);
  });
  
  ws.send(JSON.stringify({
    type: "connection_established",
    message: "Connected to DroneCommand telemetry stream",
    timestamp: new Date().toISOString(),
  }));
}

export function startSimulation(intervalMs = 1000) {
  if (simulationInterval) {
    return;
  }
  
  console.log(`Starting telemetry simulation (${intervalMs}ms interval)`);
  simulationInterval = setInterval(simulationTick, intervalMs);
  simulationTick();
}

export function stopSimulation() {
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
    console.log("Telemetry simulation stopped");
  }
}

export function getConnectedClientsCount(): number {
  return connectedClients.size;
}

export function broadcastAlert(alert: any) {
  broadcast({
    type: "alert",
    data: alert,
    timestamp: new Date().toISOString(),
  });
}

export function broadcastDroneStatus(droneId: string, status: any) {
  broadcast({
    type: "drone_status",
    droneId,
    data: status,
    timestamp: new Date().toISOString(),
  });
}
