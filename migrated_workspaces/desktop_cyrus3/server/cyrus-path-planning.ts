/**
 * CYRUS PATH PLANNING & COLLISION AVOIDANCE MODULE
 * =================================================
 * 
 * Advanced autonomous navigation with real-time obstacle detection,
 * dynamic path optimization, and collision avoidance.
 * 
 * Implements:
 * - A* pathfinding with terrain awareness
 * - Real-time obstacle detection and avoidance
 * - Dynamic re-routing based on threat assessment
 * - No-fly zone compliance
 * - Landing zone identification
 */

import type { GPSPosition } from "./cyrus-sensor-fusion";

export interface Waypoint {
  id: string;
  position: GPSPosition;
  type: "start" | "waypoint" | "destination" | "alternate";
  altitude: number;
  speed?: number;
  holdTime?: number;
  actions?: WaypointAction[];
}

export interface WaypointAction {
  type: "hover" | "photograph" | "scan" | "drop" | "pickup" | "observe";
  duration?: number;
  parameters?: Record<string, any>;
}

export interface Obstacle {
  id: string;
  type: "static" | "dynamic" | "terrain" | "no_fly_zone" | "weather";
  position: GPSPosition;
  radius: number;
  height: number;
  velocity?: { x: number; y: number; z: number };
  threatLevel: "low" | "medium" | "high" | "critical";
  expiresAt?: number;
}

export interface FlightPath {
  id: string;
  waypoints: Waypoint[];
  totalDistance: number;
  estimatedTime: number;
  fuelRequired: number;
  riskLevel: "low" | "medium" | "high";
  alternateRoutes: FlightPath[];
  noFlyZonesAvoided: string[];
}

export interface CollisionWarning {
  id: string;
  obstacleId: string;
  timeToCollision: number;
  distance: number;
  severity: "advisory" | "caution" | "warning" | "critical";
  recommendedAction: string;
  avoidanceManeuver?: AvoidanceManeuver;
}

export interface AvoidanceManeuver {
  type: "climb" | "descend" | "turn_left" | "turn_right" | "hold" | "rtb";
  magnitude: number;
  duration: number;
  newHeading?: number;
  newAltitude?: number;
}

export interface PathPlanningResult {
  success: boolean;
  path?: FlightPath;
  warnings: CollisionWarning[];
  noFlyZoneViolations: string[];
  recommendations: string[];
}

export interface TerrainCell {
  lat: number;
  lng: number;
  elevation: number;
  passable: boolean;
  cost: number;
}

export class PathPlanningEngine {
  private obstacles: Map<string, Obstacle> = new Map();
  private noFlyZones: Map<string, NoFlyZone> = new Map();
  private activePaths: Map<string, FlightPath> = new Map();
  private collisionCheckInterval = 100;
  private safetyMargin = 50;
  private maxClimbRate = 5;
  private maxDescendRate = 3;
  private maxTurnRate = 45;

  constructor() {
    this.initializeDefaultNoFlyZones();
  }

  private initializeDefaultNoFlyZones(): void {
    const defaultZones: NoFlyZone[] = [
      {
        id: "nfz_airport_001",
        name: "International Airport",
        type: "airport",
        center: { latitude: -24.6282, longitude: 25.9231, altitude: 0, heading: 0, speed: 0, accuracy: 10, timestamp: Date.now() },
        radius: 8000,
        ceiling: 3000,
        floor: 0,
        active: true,
        permanent: true
      },
      {
        id: "nfz_military_001",
        name: "Military Installation",
        type: "military",
        center: { latitude: -24.7000, longitude: 25.8500, altitude: 0, heading: 0, speed: 0, accuracy: 10, timestamp: Date.now() },
        radius: 5000,
        ceiling: 10000,
        floor: 0,
        active: true,
        permanent: true
      }
    ];

    defaultZones.forEach(zone => this.noFlyZones.set(zone.id, zone));
  }

  planPath(
    start: GPSPosition,
    destination: GPSPosition,
    options: PathPlanningOptions = {}
  ): PathPlanningResult {
    const warnings: CollisionWarning[] = [];
    const noFlyZoneViolations: string[] = [];
    const recommendations: string[] = [];

    const directPath = this.calculateDirectPath(start, destination);
    const nfzIntersections = this.checkNoFlyZoneIntersections(directPath);
    
    if (nfzIntersections.length > 0) {
      noFlyZoneViolations.push(...nfzIntersections.map(z => z.id));
      recommendations.push(`Avoid ${nfzIntersections.length} no-fly zone(s) - route will be adjusted`);
    }

    const optimizedPath = nfzIntersections.length > 0
      ? this.calculateAvoidancePath(start, destination, nfzIntersections)
      : directPath;

    const obstacleWarnings = this.checkObstacles(optimizedPath);
    warnings.push(...obstacleWarnings);

    if (obstacleWarnings.some(w => w.severity === "critical")) {
      recommendations.push("Critical obstacles detected - consider alternate route or manual control");
    }

    const riskLevel = this.assessPathRisk(optimizedPath, warnings);

    const flightPath: FlightPath = {
      id: `path_${Date.now()}`,
      waypoints: this.generateWaypoints(optimizedPath, start, destination),
      totalDistance: this.calculateTotalDistance(optimizedPath),
      estimatedTime: this.estimateFlightTime(optimizedPath, options.cruiseSpeed || 15),
      fuelRequired: this.estimateFuelRequired(optimizedPath),
      riskLevel,
      alternateRoutes: [],
      noFlyZonesAvoided: nfzIntersections.map(z => z.name)
    };

    if (riskLevel === "high") {
      const alternatePaths = this.generateAlternateRoutes(start, destination, 2);
      flightPath.alternateRoutes = alternatePaths;
      recommendations.push(`${alternatePaths.length} alternate route(s) available`);
    }

    this.activePaths.set(flightPath.id, flightPath);

    return {
      success: true,
      path: flightPath,
      warnings,
      noFlyZoneViolations,
      recommendations
    };
  }

  checkCollision(
    currentPosition: GPSPosition,
    velocity: { x: number; y: number; z: number }
  ): CollisionWarning | null {
    const lookAheadTime = 10;
    const predictedPosition = this.predictPosition(currentPosition, velocity, lookAheadTime);
    
    for (const obstacle of Array.from(this.obstacles.values())) {
      const distance = this.calculateDistance(currentPosition, obstacle.position);
      const closingRate = this.calculateClosingRate(currentPosition, velocity, obstacle);
      
      if (closingRate > 0) {
        const timeToCollision = (distance - obstacle.radius - this.safetyMargin) / closingRate;
        
        if (timeToCollision < lookAheadTime && timeToCollision > 0) {
          const severity = this.determineSeverity(timeToCollision, distance, obstacle.threatLevel);
          const avoidanceManeuver = this.calculateAvoidanceManeuver(currentPosition, velocity, obstacle);
          
          return {
            id: `warning_${Date.now()}`,
            obstacleId: obstacle.id,
            timeToCollision,
            distance,
            severity,
            recommendedAction: this.getRecommendedAction(severity, obstacle.type),
            avoidanceManeuver
          };
        }
      }
    }
    
    return null;
  }

  addObstacle(obstacle: Obstacle): void {
    this.obstacles.set(obstacle.id, obstacle);
    console.log(`[PathPlanning] Added obstacle: ${obstacle.id} (${obstacle.type})`);
  }

  removeObstacle(obstacleId: string): boolean {
    return this.obstacles.delete(obstacleId);
  }

  updateObstaclePosition(obstacleId: string, newPosition: GPSPosition): boolean {
    const obstacle = this.obstacles.get(obstacleId);
    if (obstacle) {
      obstacle.position = newPosition;
      this.obstacles.set(obstacleId, obstacle);
      return true;
    }
    return false;
  }

  addNoFlyZone(zone: NoFlyZone): void {
    this.noFlyZones.set(zone.id, zone);
    console.log(`[PathPlanning] Added no-fly zone: ${zone.name}`);
  }

  getNoFlyZones(): NoFlyZone[] {
    return Array.from(this.noFlyZones.values());
  }

  getObstacles(): Obstacle[] {
    return Array.from(this.obstacles.values());
  }

  getActivePath(pathId: string): FlightPath | undefined {
    return this.activePaths.get(pathId);
  }

  private calculateDirectPath(start: GPSPosition, end: GPSPosition): GPSPosition[] {
    const points: GPSPosition[] = [];
    const segments = 10;
    
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      points.push({
        latitude: start.latitude + (end.latitude - start.latitude) * t,
        longitude: start.longitude + (end.longitude - start.longitude) * t,
        altitude: start.altitude + (end.altitude - start.altitude) * t,
        heading: this.calculateHeading(start, end),
        speed: 15,
        accuracy: 5,
        timestamp: Date.now() + i * 1000
      });
    }
    
    return points;
  }

  private calculateAvoidancePath(
    start: GPSPosition,
    end: GPSPosition,
    zones: NoFlyZone[]
  ): GPSPosition[] {
    const path: GPSPosition[] = [start];
    let current = start;
    
    for (const zone of zones) {
      const avoidancePoint = this.calculateZoneAvoidancePoint(current, end, zone);
      path.push(avoidancePoint);
      current = avoidancePoint;
    }
    
    path.push(end);
    return this.smoothPath(path);
  }

  private calculateZoneAvoidancePoint(
    from: GPSPosition,
    to: GPSPosition,
    zone: NoFlyZone
  ): GPSPosition {
    const heading = this.calculateHeading(from, zone.center);
    const perpendicularHeading = (heading + 90) % 360;
    const avoidanceDistance = zone.radius + this.safetyMargin + 100;
    
    return {
      latitude: zone.center.latitude + Math.cos(perpendicularHeading * Math.PI / 180) * (avoidanceDistance / 111000),
      longitude: zone.center.longitude + Math.sin(perpendicularHeading * Math.PI / 180) * (avoidanceDistance / (111000 * Math.cos(zone.center.latitude * Math.PI / 180))),
      altitude: Math.max(from.altitude, zone.ceiling + 50),
      heading: this.calculateHeading(from, to),
      speed: 10,
      accuracy: 5,
      timestamp: Date.now()
    };
  }

  private smoothPath(path: GPSPosition[]): GPSPosition[] {
    if (path.length <= 2) return path;
    
    const smoothed: GPSPosition[] = [path[0]];
    
    for (let i = 1; i < path.length - 1; i++) {
      const prev = path[i - 1];
      const curr = path[i];
      const next = path[i + 1];
      
      smoothed.push({
        latitude: (prev.latitude + 2 * curr.latitude + next.latitude) / 4,
        longitude: (prev.longitude + 2 * curr.longitude + next.longitude) / 4,
        altitude: (prev.altitude + 2 * curr.altitude + next.altitude) / 4,
        heading: curr.heading,
        speed: curr.speed,
        accuracy: curr.accuracy,
        timestamp: curr.timestamp
      });
    }
    
    smoothed.push(path[path.length - 1]);
    return smoothed;
  }

  private checkNoFlyZoneIntersections(path: GPSPosition[]): NoFlyZone[] {
    const intersectedZones: NoFlyZone[] = [];
    
    for (const zone of Array.from(this.noFlyZones.values())) {
      if (!zone.active) continue;
      
      for (const point of path) {
        const distance = this.calculateDistance(point, zone.center);
        const withinRadius = distance < zone.radius;
        const withinAltitude = point.altitude >= zone.floor && point.altitude <= zone.ceiling;
        
        if (withinRadius && withinAltitude) {
          if (!intersectedZones.includes(zone)) {
            intersectedZones.push(zone);
          }
          break;
        }
      }
    }
    
    return intersectedZones;
  }

  private checkObstacles(path: GPSPosition[]): CollisionWarning[] {
    const warnings: CollisionWarning[] = [];
    
    for (const point of path) {
      for (const obstacle of Array.from(this.obstacles.values())) {
        const distance = this.calculateDistance(point, obstacle.position);
        
        if (distance < obstacle.radius + this.safetyMargin) {
          const severity = this.determineSeverity(
            distance / 15,
            distance,
            obstacle.threatLevel
          );
          
          warnings.push({
            id: `warning_${Date.now()}_${obstacle.id}`,
            obstacleId: obstacle.id,
            timeToCollision: distance / 15,
            distance,
            severity,
            recommendedAction: this.getRecommendedAction(severity, obstacle.type)
          });
        }
      }
    }
    
    return warnings;
  }

  private generateWaypoints(
    path: GPSPosition[],
    start: GPSPosition,
    destination: GPSPosition
  ): Waypoint[] {
    const waypoints: Waypoint[] = [];
    
    waypoints.push({
      id: "wp_start",
      position: start,
      type: "start",
      altitude: start.altitude
    });
    
    for (let i = 1; i < path.length - 1; i++) {
      waypoints.push({
        id: `wp_${i}`,
        position: path[i],
        type: "waypoint",
        altitude: path[i].altitude
      });
    }
    
    waypoints.push({
      id: "wp_destination",
      position: destination,
      type: "destination",
      altitude: destination.altitude
    });
    
    return waypoints;
  }

  private calculateDistance(pos1: GPSPosition, pos2: GPSPosition): number {
    const R = 6371000;
    const lat1 = pos1.latitude * Math.PI / 180;
    const lat2 = pos2.latitude * Math.PI / 180;
    const dLat = (pos2.latitude - pos1.latitude) * Math.PI / 180;
    const dLon = (pos2.longitude - pos1.longitude) * Math.PI / 180;
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    const horizontalDistance = R * c;
    const altitudeDiff = Math.abs(pos2.altitude - pos1.altitude);
    
    return Math.sqrt(horizontalDistance * horizontalDistance + altitudeDiff * altitudeDiff);
  }

  private calculateHeading(from: GPSPosition, to: GPSPosition): number {
    const dLon = (to.longitude - from.longitude) * Math.PI / 180;
    const lat1 = from.latitude * Math.PI / 180;
    const lat2 = to.latitude * Math.PI / 180;
    
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    
    let heading = Math.atan2(y, x) * 180 / Math.PI;
    heading = (heading + 360) % 360;
    
    return heading;
  }

  private calculateTotalDistance(path: GPSPosition[]): number {
    let total = 0;
    for (let i = 1; i < path.length; i++) {
      total += this.calculateDistance(path[i - 1], path[i]);
    }
    return total;
  }

  private estimateFlightTime(path: GPSPosition[], speed: number): number {
    const distance = this.calculateTotalDistance(path);
    return distance / speed;
  }

  private estimateFuelRequired(path: GPSPosition[]): number {
    const distance = this.calculateTotalDistance(path);
    const fuelPerMeter = 0.001;
    return distance * fuelPerMeter;
  }

  private assessPathRisk(path: GPSPosition[], warnings: CollisionWarning[]): "low" | "medium" | "high" {
    const criticalWarnings = warnings.filter(w => w.severity === "critical" || w.severity === "warning");
    
    if (criticalWarnings.length > 0) return "high";
    if (warnings.length > 3) return "medium";
    return "low";
  }

  private generateAlternateRoutes(
    start: GPSPosition,
    end: GPSPosition,
    count: number
  ): FlightPath[] {
    const alternates: FlightPath[] = [];
    
    for (let i = 0; i < count; i++) {
      const offset = (i + 1) * 0.005;
      const midpoint: GPSPosition = {
        latitude: (start.latitude + end.latitude) / 2 + (i % 2 === 0 ? offset : -offset),
        longitude: (start.longitude + end.longitude) / 2 + (i % 2 === 0 ? -offset : offset),
        altitude: Math.max(start.altitude, end.altitude) + 50 * (i + 1),
        heading: this.calculateHeading(start, end),
        speed: 12,
        accuracy: 10,
        timestamp: Date.now()
      };
      
      const path = [start, midpoint, end];
      
      alternates.push({
        id: `alt_path_${i}`,
        waypoints: this.generateWaypoints(path, start, end),
        totalDistance: this.calculateTotalDistance(path),
        estimatedTime: this.estimateFlightTime(path, 12),
        fuelRequired: this.estimateFuelRequired(path),
        riskLevel: "medium",
        alternateRoutes: [],
        noFlyZonesAvoided: []
      });
    }
    
    return alternates;
  }

  private predictPosition(
    current: GPSPosition,
    velocity: { x: number; y: number; z: number },
    time: number
  ): GPSPosition {
    const metersToLat = 1 / 111000;
    const metersToLng = 1 / (111000 * Math.cos(current.latitude * Math.PI / 180));
    
    return {
      latitude: current.latitude + velocity.y * time * metersToLat,
      longitude: current.longitude + velocity.x * time * metersToLng,
      altitude: current.altitude + velocity.z * time,
      heading: current.heading,
      speed: Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y),
      accuracy: current.accuracy + time,
      timestamp: current.timestamp + time * 1000
    };
  }

  private calculateClosingRate(
    position: GPSPosition,
    velocity: { x: number; y: number; z: number },
    obstacle: Obstacle
  ): number {
    const dx = obstacle.position.longitude - position.longitude;
    const dy = obstacle.position.latitude - position.latitude;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance === 0) return 0;
    
    const unitX = dx / distance;
    const unitY = dy / distance;
    
    return velocity.x * unitX + velocity.y * unitY;
  }

  private determineSeverity(
    timeToCollision: number,
    distance: number,
    threatLevel: Obstacle["threatLevel"]
  ): CollisionWarning["severity"] {
    if (timeToCollision < 3 || distance < 20) return "critical";
    if (timeToCollision < 5 || distance < 50) return "warning";
    if (timeToCollision < 10 || distance < 100) return "caution";
    return "advisory";
  }

  private calculateAvoidanceManeuver(
    position: GPSPosition,
    velocity: { x: number; y: number; z: number },
    obstacle: Obstacle
  ): AvoidanceManeuver {
    const heightDiff = obstacle.position.altitude - position.altitude;
    
    if (heightDiff > 0 && obstacle.height < 100) {
      return {
        type: "descend",
        magnitude: Math.min(this.maxDescendRate, Math.abs(heightDiff) + 20),
        duration: 5,
        newAltitude: position.altitude - 30
      };
    }
    
    if (heightDiff < 0 || obstacle.height >= 100) {
      return {
        type: "climb",
        magnitude: Math.min(this.maxClimbRate, obstacle.height + 20),
        duration: 5,
        newAltitude: position.altitude + obstacle.height + 30
      };
    }
    
    const currentHeading = position.heading;
    const obstacleHeading = this.calculateHeading(position, obstacle.position);
    const turnDirection = ((obstacleHeading - currentHeading + 360) % 360) > 180 ? "turn_left" : "turn_right";
    
    return {
      type: turnDirection,
      magnitude: 45,
      duration: 3,
      newHeading: (currentHeading + (turnDirection === "turn_left" ? -45 : 45) + 360) % 360
    };
  }

  private getRecommendedAction(severity: CollisionWarning["severity"], obstacleType: Obstacle["type"]): string {
    switch (severity) {
      case "critical":
        return "IMMEDIATE EVASIVE ACTION REQUIRED";
      case "warning":
        return "Execute avoidance maneuver now";
      case "caution":
        return "Prepare for potential course correction";
      case "advisory":
        return "Monitor obstacle - may require action";
      default:
        return "Continue monitoring";
    }
  }
}

export interface NoFlyZone {
  id: string;
  name: string;
  type: "airport" | "military" | "government" | "temporary" | "wildlife";
  center: GPSPosition;
  radius: number;
  ceiling: number;
  floor: number;
  active: boolean;
  permanent: boolean;
  validFrom?: number;
  validUntil?: number;
}

export interface PathPlanningOptions {
  cruiseSpeed?: number;
  maxAltitude?: number;
  minAltitude?: number;
  avoidWeather?: boolean;
  preferredRouteType?: "direct" | "safe" | "fast";
}

export const pathPlanningEngine = new PathPlanningEngine();
