import { Drone, Mission, Telemetry, Waypoint as SchemaWaypoint } from "@shared/schema";
import { cyrusInferAsync } from "./cyrus-ai";

export interface NavigationWaypoint {
  id: string;
  lat: number;
  lng: number;
  altitude: number;
  speed: number;
  action: "hover" | "capture" | "scan" | "waypoint" | "rtb";
  duration?: number;
  heading?: number;
}

export interface FlightPath {
  id: string;
  missionId: string;
  droneId: string;
  waypoints: NavigationWaypoint[];
  totalDistance: number;
  estimatedDuration: number;
  status: "planned" | "executing" | "completed" | "aborted";
  currentWaypointIndex: number;
}

export interface AutonomousDecision {
  action: string;
  priority: "critical" | "high" | "medium" | "low";
  reasoning: string;
  parameters: Record<string, unknown>;
  confidence: number;
  timestamp: Date;
}

export interface FlightState {
  droneId: string;
  position: { lat: number; lng: number; altitude: number };
  velocity: { x: number; y: number; z: number };
  heading: number;
  batteryLevel: number;
  signalStrength: number;
  gpsLock: boolean;
  subsystems: Record<string, string>;
}

export class AutonomousDecisionEngine {
  private flightPaths: Map<string, FlightPath> = new Map();
  private flightStates: Map<string, FlightState> = new Map();
  private decisionLog: AutonomousDecision[] = [];

  async generateFlightPath(
    mission: Mission,
    drone: Drone,
    constraints?: {
      maxAltitude?: number;
      minAltitude?: number;
      maxSpeed?: number;
      avoidZones?: { lat: number; lng: number; radius: number }[];
    }
  ): Promise<FlightPath> {
    const waypoints = await this.computeOptimalWaypoints(mission, drone, constraints);
    
    const flightPath: FlightPath = {
      id: `fp-${Date.now()}-${drone.id}`,
      missionId: mission.id,
      droneId: drone.id,
      waypoints,
      totalDistance: this.calculateTotalDistance(waypoints),
      estimatedDuration: this.estimateFlightDuration(waypoints, drone),
      status: "planned",
      currentWaypointIndex: 0
    };

    this.flightPaths.set(drone.id, flightPath);
    return flightPath;
  }

  private async computeOptimalWaypoints(
    mission: Mission,
    drone: Drone,
    constraints?: {
      maxAltitude?: number;
      minAltitude?: number;
      maxSpeed?: number;
      avoidZones?: { lat: number; lng: number; radius: number }[];
    }
  ): Promise<NavigationWaypoint[]> {
    const baseAltitude = constraints?.minAltitude || 50;
    const maxAlt = constraints?.maxAltitude || 400;
    const speed = Math.min(constraints?.maxSpeed || 15, 25);

    const waypoints: NavigationWaypoint[] = [];
    const missionArea = this.getMissionAreaFromWaypoints(mission.waypoints);

    waypoints.push({
      id: `wp-${Date.now()}-0`,
      lat: missionArea.center.lat,
      lng: missionArea.center.lng,
      altitude: baseAltitude,
      speed: speed * 0.5,
      action: "hover",
      duration: 5,
      heading: 0
    });

    const missionType = this.inferMissionType(mission.name);
    const patternPoints = this.generateSearchPattern(missionArea, missionType);
    
    patternPoints.forEach((point, index) => {
      const altitude = Math.min(
        baseAltitude + (index % 3) * 20,
        maxAlt
      );

      waypoints.push({
        id: `wp-${Date.now()}-${index + 1}`,
        lat: point.lat,
        lng: point.lng,
        altitude,
        speed,
        action: index % 4 === 0 ? "scan" : "waypoint",
        heading: this.calculateHeading(
          waypoints[waypoints.length - 1],
          point
        )
      });
    });

    waypoints.push({
      id: `wp-${Date.now()}-rtb`,
      lat: missionArea.center.lat,
      lng: missionArea.center.lng,
      altitude: baseAltitude,
      speed: speed * 0.7,
      action: "rtb",
      heading: 0
    });

    return waypoints;
  }

  private getMissionAreaFromWaypoints(waypoints: SchemaWaypoint[]): {
    center: { lat: number; lng: number };
    radius: number;
  } {
    if (waypoints.length === 0) {
      return {
        center: { lat: 34.0522, lng: -118.2437 },
        radius: 2.0
      };
    }

    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;

    for (const wp of waypoints) {
      minLat = Math.min(minLat, wp.latitude);
      maxLat = Math.max(maxLat, wp.latitude);
      minLng = Math.min(minLng, wp.longitude);
      maxLng = Math.max(maxLng, wp.longitude);
    }

    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    const radius = Math.max(
      this.haversineDistance(centerLat, centerLng, maxLat, maxLng),
      0.5
    );

    return {
      center: { lat: centerLat, lng: centerLng },
      radius
    };
  }

  private inferMissionType(missionName: string): string {
    const name = missionName.toLowerCase();
    if (name.includes("recon") || name.includes("surveillance")) return "reconnaissance";
    if (name.includes("patrol")) return "patrol";
    if (name.includes("survey") || name.includes("mapping")) return "survey";
    return "standard";
  }

  private generateSearchPattern(
    area: { center: { lat: number; lng: number }; radius: number },
    missionType: string
  ): { lat: number; lng: number }[] {
    const points: { lat: number; lng: number }[] = [];
    const { center, radius } = area;

    if (missionType === "reconnaissance" || missionType === "surveillance") {
      const gridSize = 5;
      const step = (radius * 2) / gridSize;
      
      for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
          const direction = i % 2 === 0 ? j : gridSize - 1 - j;
          points.push({
            lat: center.lat - radius + i * step,
            lng: center.lng - radius + direction * step
          });
        }
      }
    } else if (missionType === "patrol") {
      const segments = 8;
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * 2 * Math.PI;
        points.push({
          lat: center.lat + radius * Math.cos(angle),
          lng: center.lng + radius * Math.sin(angle)
        });
      }
    } else {
      points.push(
        { lat: center.lat + radius * 0.5, lng: center.lng },
        { lat: center.lat, lng: center.lng + radius * 0.5 },
        { lat: center.lat - radius * 0.5, lng: center.lng },
        { lat: center.lat, lng: center.lng - radius * 0.5 }
      );
    }

    return points;
  }

  private calculateHeading(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
    const dLng = to.lng - from.lng;
    const y = Math.sin(dLng) * Math.cos(to.lat);
    const x = Math.cos(from.lat) * Math.sin(to.lat) -
              Math.sin(from.lat) * Math.cos(to.lat) * Math.cos(dLng);
    const heading = Math.atan2(y, x) * (180 / Math.PI);
    return (heading + 360) % 360;
  }

  private calculateTotalDistance(waypoints: NavigationWaypoint[]): number {
    let total = 0;
    for (let i = 1; i < waypoints.length; i++) {
      total += this.haversineDistance(
        waypoints[i - 1].lat, waypoints[i - 1].lng,
        waypoints[i].lat, waypoints[i].lng
      );
    }
    return Math.round(total * 100) / 100;
  }

  private haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private estimateFlightDuration(waypoints: NavigationWaypoint[], drone: Drone): number {
    let duration = 0;
    for (let i = 1; i < waypoints.length; i++) {
      const distance = this.haversineDistance(
        waypoints[i - 1].lat, waypoints[i - 1].lng,
        waypoints[i].lat, waypoints[i].lng
      );
      duration += (distance * 1000) / (waypoints[i].speed || 10);
      duration += waypoints[i].duration || 0;
    }
    return Math.round(duration);
  }

  async evaluateFlightState(state: FlightState): Promise<AutonomousDecision[]> {
    const decisions: AutonomousDecision[] = [];

    if (state.batteryLevel < 15) {
      decisions.push({
        action: "EMERGENCY_RTB",
        priority: "critical",
        reasoning: `Critical battery level at ${state.batteryLevel}%. Immediate return to base required.`,
        parameters: { targetAltitude: 100, directRoute: true },
        confidence: 0.99,
        timestamp: new Date()
      });
    } else if (state.batteryLevel < 25) {
      decisions.push({
        action: "INITIATE_RTB",
        priority: "high",
        reasoning: `Low battery at ${state.batteryLevel}%. RTB recommended to ensure safe return.`,
        parameters: { conserveEnergy: true },
        confidence: 0.95,
        timestamp: new Date()
      });
    }

    if (state.signalStrength < 20) {
      decisions.push({
        action: "CLIMB_FOR_SIGNAL",
        priority: "high",
        reasoning: `Signal strength critically low at ${state.signalStrength}%. Climbing to improve link.`,
        parameters: { targetAltitude: state.position.altitude + 50 },
        confidence: 0.85,
        timestamp: new Date()
      });
    }

    if (!state.gpsLock) {
      decisions.push({
        action: "HOVER_HOLD",
        priority: "critical",
        reasoning: "GPS lock lost. Holding position until lock reacquired.",
        parameters: { holdDuration: 30, retryGps: true },
        confidence: 0.90,
        timestamp: new Date()
      });
    }

    const failedSubsystems = Object.entries(state.subsystems)
      .filter(([_, status]) => status === "critical" || status === "offline");
    
    if (failedSubsystems.length > 0) {
      decisions.push({
        action: "SUBSYSTEM_CONTINGENCY",
        priority: "high",
        reasoning: `Subsystem failures detected: ${failedSubsystems.map(([name]) => name).join(", ")}`,
        parameters: { affectedSystems: failedSubsystems.map(([name]) => name) },
        confidence: 0.88,
        timestamp: new Date()
      });
    }

    this.decisionLog.push(...decisions);
    return decisions;
  }

  async executeWaypointNavigation(
    droneId: string,
    currentPosition: { lat: number; lng: number; altitude: number }
  ): Promise<{
    command: string;
    targetWaypoint: NavigationWaypoint | null;
    adjustments: { heading: number; altitude: number; speed: number };
  }> {
    const flightPath = this.flightPaths.get(droneId);
    if (!flightPath || flightPath.status !== "executing") {
      return {
        command: "HOLD",
        targetWaypoint: null,
        adjustments: { heading: 0, altitude: currentPosition.altitude, speed: 0 }
      };
    }

    const currentWaypoint = flightPath.waypoints[flightPath.currentWaypointIndex];
    const distanceToWaypoint = this.haversineDistance(
      currentPosition.lat, currentPosition.lng,
      currentWaypoint.lat, currentWaypoint.lng
    );

    if (distanceToWaypoint < 0.01) {
      flightPath.currentWaypointIndex++;
      
      if (flightPath.currentWaypointIndex >= flightPath.waypoints.length) {
        flightPath.status = "completed";
        return {
          command: "MISSION_COMPLETE",
          targetWaypoint: null,
          adjustments: { heading: 0, altitude: currentPosition.altitude, speed: 0 }
        };
      }

      const nextWaypoint = flightPath.waypoints[flightPath.currentWaypointIndex];
      return {
        command: "PROCEED_NEXT",
        targetWaypoint: nextWaypoint,
        adjustments: {
          heading: this.calculateHeading(currentPosition, nextWaypoint),
          altitude: nextWaypoint.altitude,
          speed: nextWaypoint.speed
        }
      };
    }

    return {
      command: "NAVIGATE",
      targetWaypoint: currentWaypoint,
      adjustments: {
        heading: this.calculateHeading(currentPosition, currentWaypoint),
        altitude: currentWaypoint.altitude,
        speed: currentWaypoint.speed
      }
    };
  }

  async getAIRecommendation(
    situation: string,
    context: { drone?: Drone; mission?: Mission; telemetry?: Telemetry }
  ): Promise<{ recommendation: string; confidence: number }> {
    try {
      const result = await cyrusInferAsync(
        `Tactical situation analysis required. ${situation}
        
        Drone status: ${context.drone ? `${context.drone.name} - Battery: ${context.drone.batteryLevel}%, Signal: ${context.drone.signalStrength}%` : 'Unknown'}
        Mission: ${context.mission ? `${context.mission.name} - ${context.mission.status}` : 'No active mission'}
        
        Provide a direct tactical recommendation.`,
        { drone_name: context.drone?.name }
      );

      return {
        recommendation: result.result.answer,
        confidence: result.result.confidence || 0.85
      };
    } catch {
      return {
        recommendation: "Maintain current operations. Monitor systems.",
        confidence: 0.5
      };
    }
  }

  startMission(droneId: string): boolean {
    const flightPath = this.flightPaths.get(droneId);
    if (flightPath && flightPath.status === "planned") {
      flightPath.status = "executing";
      return true;
    }
    return false;
  }

  abortMission(droneId: string): boolean {
    const flightPath = this.flightPaths.get(droneId);
    if (flightPath && flightPath.status === "executing") {
      flightPath.status = "aborted";
      return true;
    }
    return false;
  }

  getFlightPath(droneId: string): FlightPath | undefined {
    return this.flightPaths.get(droneId);
  }

  getDecisionLog(): AutonomousDecision[] {
    return [...this.decisionLog];
  }

  clearDecisionLog(): void {
    this.decisionLog = [];
  }
}

export const autonomousEngine = new AutonomousDecisionEngine();
