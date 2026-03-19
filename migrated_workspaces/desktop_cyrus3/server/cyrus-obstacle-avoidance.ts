import { GPSCoordinate, DroneState } from "./cyrus-voice-drone-controller";

export interface Obstacle {
  id: string;
  type: ObstacleType;
  position: GPSCoordinate;
  radius: number;
  height: number;
  threatLevel: "low" | "medium" | "high" | "critical";
  detected: Date;
  source: "radar" | "lidar" | "camera" | "infrared" | "manual";
}

export type ObstacleType = 
  | "building"
  | "tower"
  | "tree"
  | "power_line"
  | "aircraft"
  | "bird"
  | "weather"
  | "no_fly_zone"
  | "terrain"
  | "unknown";

export interface AvoidanceManeuver {
  id: string;
  type: "climb" | "descend" | "turn_left" | "turn_right" | "stop" | "reverse" | "route_around";
  urgency: "normal" | "urgent" | "emergency";
  newHeading?: number;
  newAltitude?: number;
  description: string;
  estimatedClearTime: number;
}

export interface FlightCorridor {
  waypoints: GPSCoordinate[];
  width: number;
  minAltitude: number;
  maxAltitude: number;
  obstacles: Obstacle[];
  isClear: boolean;
}

export interface AvoidanceResult {
  obstacleDetected: boolean;
  obstacle?: Obstacle;
  maneuver?: AvoidanceManeuver;
  alternateRoute?: GPSCoordinate[];
  voiceWarning: string;
  safetyScore: number;
}

const SAFETY_MARGINS = {
  horizontal: 50,
  vertical: 30,
  aircraft: 500,
  no_fly_zone: 100,
};

const DETECTION_RANGE = 500;

export class ObstacleAvoidanceSystem {
  private knownObstacles: Map<string, Obstacle> = new Map();
  private noFlyZones: Obstacle[] = [];
  private lastScan: Date = new Date();
  private avoidanceHistory: AvoidanceManeuver[] = [];

  constructor() {
    this.initializeKnownObstacles();
    this.initializeNoFlyZones();
  }

  private initializeKnownObstacles(): void {
    const staticObstacles: Obstacle[] = [
      {
        id: "tower-1",
        type: "tower",
        position: { latitude: -24.6300, longitude: 25.9250, altitude: 0 },
        radius: 15,
        height: 120,
        threatLevel: "high",
        detected: new Date(),
        source: "manual"
      },
      {
        id: "powerline-1",
        type: "power_line",
        position: { latitude: -24.6350, longitude: 25.9200, altitude: 25 },
        radius: 200,
        height: 30,
        threatLevel: "high",
        detected: new Date(),
        source: "manual"
      },
    ];

    staticObstacles.forEach(obs => this.knownObstacles.set(obs.id, obs));
  }

  private initializeNoFlyZones(): void {
    this.noFlyZones = [
      {
        id: "nfz-airport",
        type: "no_fly_zone",
        position: { latitude: -24.5552, longitude: 25.9189, altitude: 0 },
        radius: 5000,
        height: 3000,
        threatLevel: "critical",
        detected: new Date(),
        source: "manual"
      },
      {
        id: "nfz-military",
        type: "no_fly_zone",
        position: { latitude: -24.6700, longitude: 25.8500, altitude: 0 },
        radius: 2000,
        height: 5000,
        threatLevel: "critical",
        detected: new Date(),
        source: "manual"
      }
    ];
    
    this.noFlyZones.forEach(nfz => this.knownObstacles.set(nfz.id, nfz));
  }

  scanForObstacles(droneState: DroneState, heading: number): Obstacle[] {
    this.lastScan = new Date();
    const detectedObstacles: Obstacle[] = [];

    for (const obstacle of Array.from(this.knownObstacles.values())) {
      const distance = this.calculateDistance(droneState.position, obstacle.position);
      
      if (distance <= DETECTION_RANGE) {
        const bearing = this.calculateBearing(droneState.position, obstacle.position);
        const bearingDiff = Math.abs(this.normalizeBearing(bearing - heading));
        
        if (bearingDiff <= 60 || distance <= SAFETY_MARGINS.horizontal * 2) {
          detectedObstacles.push(obstacle);
        }
      }
    }

    return detectedObstacles.sort((a, b) => {
      const distA = this.calculateDistance(droneState.position, a.position);
      const distB = this.calculateDistance(droneState.position, b.position);
      return distA - distB;
    });
  }

  checkFlightPath(
    from: GPSCoordinate, 
    to: GPSCoordinate, 
    altitude: number
  ): FlightCorridor {
    const waypoints = this.interpolateWaypoints(from, to, 10);
    const obstacles: Obstacle[] = [];
    let isClear = true;

    for (const waypoint of waypoints) {
      for (const obstacle of Array.from(this.knownObstacles.values())) {
        const distance = this.calculateDistance(waypoint, obstacle.position);
        const verticalClear = altitude > obstacle.height + SAFETY_MARGINS.vertical ||
                             altitude < (obstacle.position.altitude || 0) - SAFETY_MARGINS.vertical;

        if (distance < obstacle.radius + SAFETY_MARGINS.horizontal && !verticalClear) {
          if (!obstacles.find(o => o.id === obstacle.id)) {
            obstacles.push(obstacle);
          }
          isClear = false;
        }
      }
    }

    return {
      waypoints,
      width: SAFETY_MARGINS.horizontal * 2,
      minAltitude: Math.max(50, altitude - 100),
      maxAltitude: Math.min(7620, altitude + 100),
      obstacles,
      isClear
    };
  }

  calculateAvoidanceManeuver(
    droneState: DroneState, 
    obstacle: Obstacle
  ): AvoidanceManeuver {
    const distance = this.calculateDistance(droneState.position, obstacle.position);
    const bearing = this.calculateBearing(droneState.position, obstacle.position);
    
    let urgency: AvoidanceManeuver["urgency"] = "normal";
    if (distance < SAFETY_MARGINS.horizontal * 2) urgency = "urgent";
    if (distance < SAFETY_MARGINS.horizontal) urgency = "emergency";

    if (obstacle.type === "no_fly_zone") {
      const escapeHeading = this.normalizeBearing(bearing + 180);
      return {
        id: `avoid-${Date.now()}`,
        type: "reverse",
        urgency: "emergency",
        newHeading: escapeHeading,
        description: `NO-FLY ZONE DETECTED! Reversing course immediately.`,
        estimatedClearTime: 10
      };
    }

    if (droneState.altitude < obstacle.height + SAFETY_MARGINS.vertical * 2) {
      const clearAltitude = obstacle.height + SAFETY_MARGINS.vertical + 20;
      if (clearAltitude <= 7620) {
        return {
          id: `avoid-${Date.now()}`,
          type: "climb",
          urgency,
          newAltitude: clearAltitude,
          description: `Climbing to ${clearAltitude}m to clear ${obstacle.type}.`,
          estimatedClearTime: Math.abs(clearAltitude - droneState.altitude) / 5
        };
      }
    }

    const leftHeading = this.normalizeBearing(bearing - 90);
    const rightHeading = this.normalizeBearing(bearing + 90);
    
    const preferLeft = Math.random() > 0.5;
    const newHeading = preferLeft ? leftHeading : rightHeading;
    const turnDirection = preferLeft ? "turn_left" : "turn_right";

    return {
      id: `avoid-${Date.now()}`,
      type: turnDirection,
      urgency,
      newHeading,
      description: `Turning ${preferLeft ? 'left' : 'right'} to avoid ${obstacle.type}.`,
      estimatedClearTime: 15
    };
  }

  evaluateFlightSafety(droneState: DroneState, destination: GPSCoordinate): AvoidanceResult {
    const corridor = this.checkFlightPath(droneState.position, destination, droneState.altitude);
    
    if (corridor.isClear) {
      return {
        obstacleDetected: false,
        voiceWarning: "",
        safetyScore: 100
      };
    }

    const nearestObstacle = corridor.obstacles[0];
    const maneuver = this.calculateAvoidanceManeuver(droneState, nearestObstacle);
    const alternateRoute = this.calculateAlternateRoute(droneState.position, destination, corridor.obstacles);

    let safetyScore = 100;
    corridor.obstacles.forEach(obs => {
      const distance = this.calculateDistance(droneState.position, obs.position);
      const distanceScore = Math.min(100, (distance / DETECTION_RANGE) * 100);
      safetyScore = Math.min(safetyScore, distanceScore);
      
      if (obs.type === "no_fly_zone") safetyScore -= 30;
      if (obs.threatLevel === "critical") safetyScore -= 20;
    });

    let voiceWarning = "";
    if (maneuver.urgency === "emergency") {
      voiceWarning = `Warning! ${nearestObstacle.type.replace("_", " ")} detected ahead! ${maneuver.description}`;
    } else if (maneuver.urgency === "urgent") {
      voiceWarning = `Caution: ${nearestObstacle.type.replace("_", " ")} in flight path. ${maneuver.description}`;
    } else {
      voiceWarning = `Obstacle detected: ${nearestObstacle.type.replace("_", " ")}. Adjusting course.`;
    }

    this.avoidanceHistory.push(maneuver);

    return {
      obstacleDetected: true,
      obstacle: nearestObstacle,
      maneuver,
      alternateRoute,
      voiceWarning,
      safetyScore: Math.max(0, safetyScore)
    };
  }

  private calculateAlternateRoute(
    from: GPSCoordinate, 
    to: GPSCoordinate, 
    obstacles: Obstacle[]
  ): GPSCoordinate[] {
    const directBearing = this.calculateBearing(from, to);
    const distance = this.calculateDistance(from, to);
    
    const offsetDistance = 200;
    const offsetBearing = this.normalizeBearing(directBearing + 90);
    
    const waypointA = this.projectPoint(from, offsetBearing, offsetDistance);
    const midpoint = this.getMidpoint(from, to);
    const waypointB = this.projectPoint(midpoint, offsetBearing, offsetDistance);

    return [from, waypointA, waypointB, to];
  }

  private interpolateWaypoints(from: GPSCoordinate, to: GPSCoordinate, count: number): GPSCoordinate[] {
    const waypoints: GPSCoordinate[] = [];
    
    for (let i = 0; i <= count; i++) {
      const fraction = i / count;
      waypoints.push({
        latitude: from.latitude + (to.latitude - from.latitude) * fraction,
        longitude: from.longitude + (to.longitude - from.longitude) * fraction,
        altitude: (from.altitude || 0) + ((to.altitude || 0) - (from.altitude || 0)) * fraction
      });
    }

    return waypoints;
  }

  private calculateDistance(from: GPSCoordinate, to: GPSCoordinate): number {
    const R = 6371000;
    const lat1 = from.latitude * Math.PI / 180;
    const lat2 = to.latitude * Math.PI / 180;
    const deltaLat = (to.latitude - from.latitude) * Math.PI / 180;
    const deltaLon = (to.longitude - from.longitude) * Math.PI / 180;

    const a = Math.sin(deltaLat / 2) ** 2 +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  private calculateBearing(from: GPSCoordinate, to: GPSCoordinate): number {
    const lat1 = from.latitude * Math.PI / 180;
    const lat2 = to.latitude * Math.PI / 180;
    const deltaLon = (to.longitude - from.longitude) * Math.PI / 180;

    const y = Math.sin(deltaLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) -
              Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);

    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    return this.normalizeBearing(bearing);
  }

  private normalizeBearing(bearing: number): number {
    return ((bearing % 360) + 360) % 360;
  }

  private projectPoint(from: GPSCoordinate, bearing: number, distance: number): GPSCoordinate {
    const R = 6371000;
    const bearingRad = bearing * Math.PI / 180;
    const lat1 = from.latitude * Math.PI / 180;
    const lon1 = from.longitude * Math.PI / 180;
    const angularDistance = distance / R;

    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearingRad)
    );

    const lon2 = lon1 + Math.atan2(
      Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
    );

    return {
      latitude: lat2 * 180 / Math.PI,
      longitude: lon2 * 180 / Math.PI,
      altitude: from.altitude
    };
  }

  private getMidpoint(from: GPSCoordinate, to: GPSCoordinate): GPSCoordinate {
    return {
      latitude: (from.latitude + to.latitude) / 2,
      longitude: (from.longitude + to.longitude) / 2,
      altitude: ((from.altitude || 0) + (to.altitude || 0)) / 2
    };
  }

  addObstacle(obstacle: Obstacle): void {
    this.knownObstacles.set(obstacle.id, obstacle);
  }

  removeObstacle(obstacleId: string): void {
    this.knownObstacles.delete(obstacleId);
  }

  getKnownObstacles(): Obstacle[] {
    return Array.from(this.knownObstacles.values());
  }

  getAvoidanceHistory(): AvoidanceManeuver[] {
    return [...this.avoidanceHistory];
  }

  checkNoFlyZones(position: GPSCoordinate): { inNoFlyZone: boolean; zoneName?: string; distance?: number } {
    for (const zone of this.noFlyZones) {
      const distance = this.calculateDistance(position, zone.position);
      const margin = SAFETY_MARGINS.no_fly_zone;
      
      if (distance < zone.radius + margin) {
        const altitude = position.altitude || 0;
        if (altitude < zone.height) {
          return {
            inNoFlyZone: true,
            zoneName: zone.id.includes("airport") ? "Airport Restricted Airspace" : 
                      zone.id.includes("military") ? "Military Zone" : "Restricted Airspace",
            distance
          };
        }
      }
    }
    
    return { inNoFlyZone: false };
  }

  analyzeFlightCorridor(
    from: GPSCoordinate, 
    to: GPSCoordinate, 
    altitude: number
  ): { isClear: boolean; obstacles: Obstacle[]; alternateRoute?: GPSCoordinate } {
    const obstacles: Obstacle[] = [];
    const corridorWidth = 100;
    
    const bearing = this.calculateBearing(from, to);
    const distance = this.calculateDistance(from, to);
    const checkPoints = Math.ceil(distance / 50);
    
    for (let i = 0; i <= checkPoints; i++) {
      const fraction = i / checkPoints;
      const checkPoint: GPSCoordinate = {
        latitude: from.latitude + (to.latitude - from.latitude) * fraction,
        longitude: from.longitude + (to.longitude - from.longitude) * fraction,
        altitude
      };
      
      for (const obstacle of Array.from(this.knownObstacles.values())) {
        const distToObstacle = this.calculateDistance(checkPoint, obstacle.position);
        
        if (distToObstacle < obstacle.radius + corridorWidth) {
          if (altitude < obstacle.height + SAFETY_MARGINS.vertical) {
            if (!obstacles.find(o => o.id === obstacle.id)) {
              obstacles.push(obstacle);
            }
          }
        }
      }
      
      const nfzCheck = this.checkNoFlyZones(checkPoint);
      if (nfzCheck.inNoFlyZone) {
        const nfz = this.noFlyZones.find(z => 
          this.calculateDistance(checkPoint, z.position) < z.radius + SAFETY_MARGINS.no_fly_zone
        );
        if (nfz && !obstacles.find(o => o.id === nfz.id)) {
          obstacles.push(nfz);
        }
      }
    }
    
    if (obstacles.length > 0) {
      const altRoute = this.calculateAlternateRoute(from, to, obstacles);
      const midPoint = altRoute[Math.floor(altRoute.length / 2)];
      
      return {
        isClear: false,
        obstacles,
        alternateRoute: midPoint
      };
    }
    
    return { isClear: true, obstacles: [] };
  }
}

export const obstacleAvoidanceSystem = new ObstacleAvoidanceSystem();
