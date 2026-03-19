import { GPSCoordinate, DroneState, VoiceCommand, CommandResult, VoiceDroneController } from "./cyrus-voice-drone-controller";
import { ObstacleAvoidanceSystem, AvoidanceResult, Obstacle } from "./cyrus-obstacle-avoidance";

export interface FlightMission {
  id: string;
  name: string;
  type: MissionType;
  status: MissionStatus;
  waypoints: Waypoint[];
  currentWaypointIndex: number;
  startTime?: Date;
  endTime?: Date;
  droneId: string;
  parameters: MissionParameters;
  flightLog: FlightLogEntry[];
  realTimeData: RealTimeFlightData;
}

export type MissionType = 
  | "point_to_point"
  | "patrol"
  | "search_and_rescue"
  | "surveillance"
  | "delivery"
  | "inspection"
  | "photography"
  | "mapping"
  | "custom";

export type MissionStatus = 
  | "planning"
  | "ready"
  | "launching"
  | "in_flight"
  | "approaching_waypoint"
  | "at_waypoint"
  | "executing_task"
  | "returning"
  | "landing"
  | "completed"
  | "aborted"
  | "emergency";

export interface Waypoint {
  id: string;
  position: GPSCoordinate;
  altitude: number;
  speed: number;
  action?: WaypointAction;
  holdTime?: number;
  reached: boolean;
  arrivalTime?: Date;
}

export interface WaypointAction {
  type: "hover" | "capture_image" | "record_video" | "scan_area" | "drop_payload" | "land" | "circle";
  duration?: number;
  parameters?: Record<string, any>;
}

export interface MissionParameters {
  maxAltitude: number;
  maxSpeed: number;
  minBattery: number;
  returnOnLowBattery: boolean;
  avoidanceEnabled: boolean;
  realTimeFeedback: boolean;
  autoReturnOnSignalLoss: boolean;
  geofenceRadius: number;
}

export interface FlightLogEntry {
  timestamp: Date;
  type: "info" | "warning" | "error" | "command" | "navigation" | "avoidance";
  message: string;
  position?: GPSCoordinate;
  data?: Record<string, any>;
}

export interface RealTimeFlightData {
  position: GPSCoordinate;
  altitude: number;
  speed: number;
  heading: number;
  batteryLevel: number;
  signalStrength: number;
  distanceToNextWaypoint: number;
  distanceToHome: number;
  estimatedTimeToWaypoint: number;
  estimatedTimeToHome: number;
  obstaclesDetected: number;
  missionProgress: number;
  lastUpdate: Date;
}

export interface AutonomousFlightResult {
  success: boolean;
  mission: FlightMission;
  voiceFeedback: string;
  realTimeData: RealTimeFlightData;
  warnings: string[];
  nextAction?: string;
}

export interface DiscoveredDrone {
  droneId: string;
  name: string;
  model: string;
  manufacturer: string;
  signalStrength: number;
  batteryLevel: number;
  position: GPSCoordinate;
  status: "available" | "connected" | "busy" | "offline";
  capabilities: string[];
  lastSeen: Date;
  firmwareVersion: string;
  serialNumber: string;
}

export interface DroneConnectionResult {
  success: boolean;
  droneId: string;
  voiceFeedback: string;
  drone?: DiscoveredDrone;
  allConnected?: DiscoveredDrone[];
}

export interface DroneScanResult {
  success: boolean;
  dronesFound: DiscoveredDrone[];
  scanDuration: number;
  scanRadius: number;
  voiceFeedback: string;
}

const DEFAULT_MISSION_PARAMS: MissionParameters = {
  maxAltitude: 400,
  maxSpeed: 15,
  minBattery: 20,
  returnOnLowBattery: true,
  avoidanceEnabled: true,
  realTimeFeedback: true,
  autoReturnOnSignalLoss: true,
  geofenceRadius: 5000
};

export class AutonomousFlightEngine {
  private activeMissions: Map<string, FlightMission> = new Map();
  private droneStates: Map<string, DroneState> = new Map();
  private discoveredDrones: Map<string, DiscoveredDrone> = new Map();
  private connectedDrones: Map<string, DiscoveredDrone> = new Map();
  private obstacleSystem: ObstacleAvoidanceSystem;
  private voiceController: VoiceDroneController;
  private homeBase: GPSCoordinate = { latitude: -24.6282, longitude: 25.9231, altitude: 0, name: "Home Base" };
  private flightUpdateInterval: number = 1000;
  private isScanning: boolean = false;
  private lastScanTime: Date = new Date();

  constructor() {
    this.obstacleSystem = new ObstacleAvoidanceSystem();
    this.voiceController = new VoiceDroneController();
    this.initializeDefaultDrone();
    this.initializeAvailableDrones();
  }

  private initializeDefaultDrone(): void {
    const defaultDrone: DroneState = {
      droneId: "drone-1",
      position: { ...this.homeBase },
      heading: 0,
      speed: 0,
      altitude: 0,
      batteryLevel: 100,
      signalStrength: 100,
      isFlying: false,
      status: "idle"
    };
    this.droneStates.set("drone-1", defaultDrone);
  }

  private initializeAvailableDrones(): void {
    const availableDrones: DiscoveredDrone[] = [
      {
        droneId: "drone-1",
        name: "CYRUS Alpha",
        model: "BLACKTALON-X1",
        manufacturer: "DroneCommand Systems",
        signalStrength: 100,
        batteryLevel: 100,
        position: { ...this.homeBase },
        status: "connected",
        capabilities: ["flight", "camera", "thermal", "gps", "obstacle_avoidance", "autonomous"],
        lastSeen: new Date(),
        firmwareVersion: "3.2.1",
        serialNumber: "DCX1-2024-001"
      },
      {
        droneId: "drone-2",
        name: "CYRUS Beta",
        model: "BLACKTALON-X2",
        manufacturer: "DroneCommand Systems",
        signalStrength: 85,
        batteryLevel: 92,
        position: { latitude: -24.6300, longitude: 25.9250, altitude: 0 },
        status: "available",
        capabilities: ["flight", "camera", "gps", "autonomous", "payload"],
        lastSeen: new Date(),
        firmwareVersion: "3.2.0",
        serialNumber: "DCX2-2024-002"
      },
      {
        droneId: "drone-3",
        name: "CYRUS Gamma",
        model: "BLACKTALON-S1",
        manufacturer: "DroneCommand Systems",
        signalStrength: 78,
        batteryLevel: 67,
        position: { latitude: -24.6250, longitude: 25.9200, altitude: 0 },
        status: "available",
        capabilities: ["flight", "camera", "lidar", "mapping", "gps"],
        lastSeen: new Date(),
        firmwareVersion: "3.1.5",
        serialNumber: "DCS1-2024-003"
      },
      {
        droneId: "drone-4",
        name: "CYRUS Delta",
        model: "BLACKTALON-R1",
        manufacturer: "DroneCommand Systems",
        signalStrength: 62,
        batteryLevel: 45,
        position: { latitude: -24.6320, longitude: 25.9180, altitude: 0 },
        status: "available",
        capabilities: ["flight", "camera", "infrared", "search_rescue", "gps"],
        lastSeen: new Date(),
        firmwareVersion: "3.2.1",
        serialNumber: "DCR1-2024-004"
      },
      {
        droneId: "drone-5",
        name: "CYRUS Epsilon",
        model: "BLACKTALON-C1",
        manufacturer: "DroneCommand Systems",
        signalStrength: 45,
        batteryLevel: 88,
        position: { latitude: -24.6350, longitude: 25.9300, altitude: 0 },
        status: "available",
        capabilities: ["flight", "cargo", "delivery", "gps", "autonomous"],
        lastSeen: new Date(),
        firmwareVersion: "3.0.8",
        serialNumber: "DCC1-2024-005"
      }
    ];

    availableDrones.forEach(drone => {
      this.discoveredDrones.set(drone.droneId, drone);
      if (drone.status === "connected") {
        this.connectedDrones.set(drone.droneId, drone);
      }
    });
  }

  async processVoiceCommand(voiceInput: string, droneId: string = "drone-1"): Promise<AutonomousFlightResult> {
    const command = this.voiceController.parseVoiceCommand(voiceInput);
    const droneState = this.droneStates.get(droneId) || this.createDefaultDroneState(droneId);
    
    this.log(droneId, "command", `Voice command received: "${voiceInput}"`, droneState.position);
    
    const safetyCheck = this.performPreFlightSafetyCheck(command, droneState);
    if (!safetyCheck.safe) {
      return {
        success: false,
        mission: this.createEmptyMission(droneId),
        voiceFeedback: safetyCheck.voiceFeedback,
        realTimeData: this.getRealTimeData(droneId),
        warnings: safetyCheck.warnings,
        nextAction: "Awaiting safe conditions or new command"
      };
    }

    switch (command.intent) {
      case "TAKEOFF":
        return await this.executeTakeoff(droneId, command.parameters.altitude || 50);
      
      case "LAND":
        return await this.executeLanding(droneId);
      
      case "FLY_TO_LOCATION":
        if (command.parameters.destination) {
          return await this.executeFlightToLocation(droneId, command.parameters.destination, command.parameters);
        }
        return this.createErrorResult(droneId, "No destination specified. Please tell me where to fly.");
      
      case "RETURN_HOME":
        return await this.executeReturnHome(droneId);
      
      case "HOVER":
        return await this.executeHover(droneId);
      
      case "PATROL_AREA":
        return await this.executePatrol(droneId, droneState.position, command.parameters.patrolRadius || 500);
      
      case "SEARCH_AREA":
        return await this.executeSearch(droneId, droneState.position, command.parameters.patrolRadius || 1000);
      
      case "EMERGENCY_STOP":
        return await this.executeEmergencyStop(droneId);
      
      case "STATUS_REPORT":
        return this.generateStatusReport(droneId);
      
      case "SET_ALTITUDE":
        return await this.setAltitude(droneId, command.parameters.altitude || 100);
      
      case "SET_SPEED":
        return await this.setSpeed(droneId, command.parameters.speed || 10);
      
      case "START_MISSION":
        return await this.startMission(droneId, command.parameters.missionType || "surveillance");
      
      case "ABORT_MISSION":
        return await this.abortMission(droneId);
      
      default:
        return this.createErrorResult(droneId, "I didn't understand that command. Try saying 'take off', 'fly to airport', or 'return home'.");
    }
  }

  private performPreFlightSafetyCheck(command: VoiceCommand, droneState: DroneState): { safe: boolean; voiceFeedback: string; warnings: string[] } {
    const warnings: string[] = [];
    
    if (droneState.batteryLevel < 10 && command.intent !== "EMERGENCY_STOP" && command.intent !== "LAND") {
      return {
        safe: false,
        voiceFeedback: `Battery critically low at ${droneState.batteryLevel}%. Emergency landing required.`,
        warnings: ["Critical battery level"]
      };
    }

    if (droneState.batteryLevel < 20) {
      warnings.push(`Battery at ${droneState.batteryLevel}%. Return to base recommended.`);
    }

    if (droneState.signalStrength < 15 && command.intent !== "RETURN_HOME" && command.intent !== "EMERGENCY_STOP") {
      this.executeReturnHome(droneState.droneId);
      return {
        safe: false,
        voiceFeedback: "Signal too weak for safe operation. Automatic return to home initiated.",
        warnings: ["Critical signal loss - auto-return activated"]
      };
    }

    if (droneState.signalStrength < 40) {
      warnings.push("Signal strength is weak. Maintain line of sight.");
    }

    if (command.parameters.destination) {
      const dest = command.parameters.destination;
      if (dest.latitude < -90 || dest.latitude > 90 || dest.longitude < -180 || dest.longitude > 180) {
        return {
          safe: false,
          voiceFeedback: "Invalid coordinates specified. Please provide valid GPS coordinates.",
          warnings: ["Invalid coordinates"]
        };
      }

      const distance = this.calculateDistance(droneState.position, dest);
      if (distance > 50000) {
        return {
          safe: false,
          voiceFeedback: `Destination is ${Math.round(distance/1000)} kilometers away, exceeding maximum range of 50km.`,
          warnings: ["Destination out of range"]
        };
      }

      const noFlyCheck = this.obstacleSystem.checkNoFlyZones(dest);
      if (noFlyCheck.inNoFlyZone) {
        return {
          safe: false,
          voiceFeedback: `Destination is in a restricted airspace: ${noFlyCheck.zoneName}. Flight not permitted.`,
          warnings: ["Destination in no-fly zone"]
        };
      }
    }

    if (command.parameters.altitude && command.parameters.altitude > 7620) {
      return {
        safe: false,
        voiceFeedback: "Requested altitude exceeds maximum flight ceiling of 7620 meters.",
        warnings: ["Altitude exceeds maximum"]
      };
    }

    return { safe: true, voiceFeedback: "", warnings };
  }

  async executeTakeoff(droneId: string, targetAltitude: number): Promise<AutonomousFlightResult> {
    const droneState = this.droneStates.get(droneId)!;
    
    if (droneState.isFlying) {
      return this.createErrorResult(droneId, "Drone is already airborne. Hovering at current position.");
    }

    this.log(droneId, "navigation", `Initiating takeoff to ${targetAltitude} meters`, droneState.position);

    droneState.status = "takeoff";
    droneState.isFlying = true;
    
    await this.simulateAltitudeChange(droneId, targetAltitude, 5);
    
    droneState.status = "hovering";
    droneState.altitude = targetAltitude;
    this.droneStates.set(droneId, droneState);

    return {
      success: true,
      mission: this.getOrCreateMission(droneId, "point_to_point"),
      voiceFeedback: `Takeoff complete. Now hovering at ${targetAltitude} meters. Battery at ${droneState.batteryLevel}%. Awaiting your command.`,
      realTimeData: this.getRealTimeData(droneId),
      warnings: [],
      nextAction: "Awaiting navigation command"
    };
  }

  async executeLanding(droneId: string): Promise<AutonomousFlightResult> {
    const droneState = this.droneStates.get(droneId)!;
    
    if (!droneState.isFlying) {
      return this.createErrorResult(droneId, "Drone is already on the ground.");
    }

    this.log(droneId, "navigation", "Initiating landing sequence", droneState.position);

    droneState.status = "landing";
    
    await this.simulateAltitudeChange(droneId, 0, 3);
    
    droneState.status = "idle";
    droneState.isFlying = false;
    droneState.altitude = 0;
    droneState.speed = 0;
    this.droneStates.set(droneId, droneState);

    const activeMission = this.activeMissions.get(droneId);
    if (activeMission) {
      activeMission.status = "completed";
      activeMission.endTime = new Date();
    }

    return {
      success: true,
      mission: activeMission || this.createEmptyMission(droneId),
      voiceFeedback: `Landing complete. Drone safely on the ground at ${droneState.position.name || "current location"}. Systems shutting down.`,
      realTimeData: this.getRealTimeData(droneId),
      warnings: [],
      nextAction: "Mission complete"
    };
  }

  async executeFlightToLocation(droneId: string, destination: GPSCoordinate, params: any = {}): Promise<AutonomousFlightResult> {
    const droneState = this.droneStates.get(droneId)!;
    const warnings: string[] = [];

    if (!droneState.isFlying) {
      await this.executeTakeoff(droneId, params.altitude || 50);
    }

    const distance = this.calculateDistance(droneState.position, destination);
    const heading = this.calculateHeading(droneState.position, destination);
    const speed = Math.min(params.speed || 15, 90);
    const estimatedTime = distance / speed;

    const corridorCheck = this.obstacleSystem.analyzeFlightCorridor(droneState.position, destination, params.altitude || droneState.altitude);
    
    if (!corridorCheck.isClear) {
      this.log(droneId, "avoidance", `Obstacles detected in flight path. Calculating avoidance route.`, droneState.position);
      
      if (corridorCheck.alternateRoute) {
        destination = corridorCheck.alternateRoute;
        warnings.push("Original route had obstacles. Using alternate path.");
      }
    }

    const mission = this.getOrCreateMission(droneId, "point_to_point");
    mission.status = "in_flight";
    mission.waypoints = [{
      id: `wp-${Date.now()}`,
      position: destination,
      altitude: params.altitude || droneState.altitude,
      speed: speed,
      reached: false
    }];

    this.log(droneId, "navigation", `Flying to ${destination.name || `(${destination.latitude.toFixed(4)}, ${destination.longitude.toFixed(4)})`}`, droneState.position);

    droneState.status = "flying";
    droneState.heading = heading;
    droneState.speed = speed;

    await this.simulateFlightProgress(droneId, destination, speed);

    droneState.position = { ...destination };
    droneState.status = "hovering";
    droneState.speed = 0;
    mission.waypoints[0].reached = true;
    mission.waypoints[0].arrivalTime = new Date();
    mission.status = "at_waypoint";
    
    this.droneStates.set(droneId, droneState);
    this.activeMissions.set(droneId, mission);

    const distanceKm = (distance / 1000).toFixed(1);
    const timeMinutes = Math.ceil(estimatedTime / 60);

    return {
      success: true,
      mission,
      voiceFeedback: `Arrived at ${destination.name || "destination"}. Flight covered ${distanceKm} kilometers in approximately ${timeMinutes} minutes. Now hovering at ${droneState.altitude} meters. Battery at ${droneState.batteryLevel}%.`,
      realTimeData: this.getRealTimeData(droneId),
      warnings,
      nextAction: "Awaiting next command"
    };
  }

  async executeReturnHome(droneId: string): Promise<AutonomousFlightResult> {
    const droneState = this.droneStates.get(droneId)!;
    
    this.log(droneId, "navigation", "Return to home initiated", droneState.position);

    const distanceHome = this.calculateDistance(droneState.position, this.homeBase);
    
    if (distanceHome < 10) {
      if (droneState.isFlying) {
        return await this.executeLanding(droneId);
      }
      return this.createErrorResult(droneId, "Already at home base.");
    }

    const flightResult = await this.executeFlightToLocation(droneId, this.homeBase, { altitude: 100 });
    
    if (flightResult.success) {
      await this.executeLanding(droneId);
      
      return {
        ...flightResult,
        voiceFeedback: `Successfully returned to home base and landed safely. Total flight distance: ${(distanceHome/1000).toFixed(1)} kilometers. Mission complete.`,
        nextAction: "At home base. Systems idle."
      };
    }

    return flightResult;
  }

  async executeHover(droneId: string): Promise<AutonomousFlightResult> {
    const droneState = this.droneStates.get(droneId)!;
    
    if (!droneState.isFlying) {
      return this.createErrorResult(droneId, "Drone is on the ground. Take off first to hover.");
    }

    droneState.status = "hovering";
    droneState.speed = 0;
    this.droneStates.set(droneId, droneState);

    this.log(droneId, "navigation", "Holding position", droneState.position);

    return {
      success: true,
      mission: this.getOrCreateMission(droneId, "point_to_point"),
      voiceFeedback: `Holding position at ${droneState.altitude} meters. GPS lock stable. Awaiting your command.`,
      realTimeData: this.getRealTimeData(droneId),
      warnings: [],
      nextAction: "Hovering in position"
    };
  }

  async executePatrol(droneId: string, center: GPSCoordinate, radius: number): Promise<AutonomousFlightResult> {
    const droneState = this.droneStates.get(droneId)!;
    
    if (!droneState.isFlying) {
      await this.executeTakeoff(droneId, 100);
    }

    const patrolPoints = this.generatePatrolWaypoints(center, radius, 8);
    const mission = this.getOrCreateMission(droneId, "patrol");
    mission.waypoints = patrolPoints;
    mission.status = "in_flight";
    mission.currentWaypointIndex = 0;

    this.log(droneId, "navigation", `Starting patrol pattern with ${patrolPoints.length} waypoints`, droneState.position);

    droneState.status = "flying";
    droneState.currentMission = mission.id;
    this.droneStates.set(droneId, droneState);
    this.activeMissions.set(droneId, mission);

    this.executeMissionWaypoints(droneId, mission);

    return {
      success: true,
      mission,
      voiceFeedback: `Beginning patrol pattern around current area. Covering a ${radius} meter radius with ${patrolPoints.length} waypoints. Estimated patrol time: ${Math.ceil(patrolPoints.length * 2)} minutes. Say "abort mission" to stop.`,
      realTimeData: this.getRealTimeData(droneId),
      warnings: [],
      nextAction: "Patrol in progress"
    };
  }

  async executeSearch(droneId: string, center: GPSCoordinate, radius: number): Promise<AutonomousFlightResult> {
    const droneState = this.droneStates.get(droneId)!;
    
    if (!droneState.isFlying) {
      await this.executeTakeoff(droneId, 80);
    }

    const searchPattern = this.generateSearchPattern(center, radius);
    const mission = this.getOrCreateMission(droneId, "search_and_rescue");
    mission.waypoints = searchPattern;
    mission.status = "in_flight";
    mission.currentWaypointIndex = 0;

    this.log(droneId, "navigation", `Initiating search pattern over ${radius}m radius`, droneState.position);

    droneState.status = "flying";
    droneState.currentMission = mission.id;
    this.droneStates.set(droneId, droneState);
    this.activeMissions.set(droneId, mission);

    this.executeMissionWaypoints(droneId, mission);

    return {
      success: true,
      mission,
      voiceFeedback: `Search pattern initiated. Scanning ${radius} meter radius in a systematic grid. Camera systems active. Will notify you of any findings. Say "abort mission" to cancel.`,
      realTimeData: this.getRealTimeData(droneId),
      warnings: [],
      nextAction: "Search in progress"
    };
  }

  private async executeMissionWaypoints(droneId: string, mission: FlightMission): Promise<void> {
    const droneState = this.droneStates.get(droneId);
    if (!droneState) return;

    for (let i = 0; i < mission.waypoints.length; i++) {
      const currentMission = this.activeMissions.get(droneId);
      if (!currentMission || currentMission.status === "aborted" || currentMission.status === "completed") {
        break;
      }

      const waypoint = mission.waypoints[i];
      mission.currentWaypointIndex = i;
      mission.status = "approaching_waypoint";
      
      this.log(droneId, "navigation", `Navigating to waypoint ${i + 1} of ${mission.waypoints.length}`, droneState.position);

      const batteryCheck = droneState.batteryLevel;
      if (batteryCheck < 15) {
        this.log(droneId, "warning", "Low battery - initiating automatic return to home", droneState.position);
        mission.status = "returning";
        await this.executeReturnHome(droneId);
        return;
      }

      if (droneState.signalStrength < 15) {
        this.log(droneId, "warning", "Signal lost - initiating automatic return to home", droneState.position);
        mission.status = "returning";
        await this.executeReturnHome(droneId);
        return;
      }

      await this.simulateFlightProgress(droneId, waypoint.position, waypoint.speed);

      droneState.position = { ...waypoint.position };
      droneState.altitude = waypoint.altitude;
      waypoint.reached = true;
      waypoint.arrivalTime = new Date();
      
      mission.status = "at_waypoint";
      this.droneStates.set(droneId, droneState);
      this.activeMissions.set(droneId, mission);

      if (waypoint.action && waypoint.holdTime) {
        mission.status = "executing_task";
        await this.delay(waypoint.holdTime * 100);
      }
    }

    mission.status = "completed";
    mission.endTime = new Date();
    droneState.status = "hovering";
    this.droneStates.set(droneId, droneState);
    this.activeMissions.set(droneId, mission);

    this.log(droneId, "info", `Mission ${mission.type} completed successfully`, droneState.position);
  }

  async executeEmergencyStop(droneId: string): Promise<AutonomousFlightResult> {
    const droneState = this.droneStates.get(droneId)!;
    
    this.log(droneId, "warning", "EMERGENCY STOP ACTIVATED", droneState.position);

    droneState.speed = 0;
    droneState.status = "emergency";
    
    const activeMission = this.activeMissions.get(droneId);
    if (activeMission) {
      activeMission.status = "aborted";
    }

    this.droneStates.set(droneId, droneState);

    return {
      success: true,
      mission: activeMission || this.createEmptyMission(droneId),
      voiceFeedback: "Emergency stop activated! Drone has halted all movement and is holding position. Awaiting your instructions.",
      realTimeData: this.getRealTimeData(droneId),
      warnings: ["Emergency stop active"],
      nextAction: "Awaiting instructions"
    };
  }

  async setAltitude(droneId: string, targetAltitude: number): Promise<AutonomousFlightResult> {
    const droneState = this.droneStates.get(droneId)!;
    
    if (targetAltitude > 7620) {
      return this.createErrorResult(droneId, "Requested altitude exceeds maximum ceiling of 7620 meters.");
    }

    if (!droneState.isFlying && targetAltitude > 0) {
      await this.executeTakeoff(droneId, targetAltitude);
      return {
        success: true,
        mission: this.getOrCreateMission(droneId, "point_to_point"),
        voiceFeedback: `Taking off and climbing to ${targetAltitude} meters.`,
        realTimeData: this.getRealTimeData(droneId),
        warnings: [],
        nextAction: "Altitude adjustment complete"
      };
    }

    const action = targetAltitude > droneState.altitude ? "Climbing" : "Descending";
    this.log(droneId, "navigation", `${action} to ${targetAltitude} meters`, droneState.position);

    await this.simulateAltitudeChange(droneId, targetAltitude, 5);
    
    droneState.altitude = targetAltitude;
    this.droneStates.set(droneId, droneState);

    return {
      success: true,
      mission: this.getOrCreateMission(droneId, "point_to_point"),
      voiceFeedback: `${action} complete. Now at ${targetAltitude} meters altitude.`,
      realTimeData: this.getRealTimeData(droneId),
      warnings: [],
      nextAction: "Altitude set"
    };
  }

  async setSpeed(droneId: string, targetSpeed: number): Promise<AutonomousFlightResult> {
    const droneState = this.droneStates.get(droneId)!;
    
    if (targetSpeed > 90) {
      return this.createErrorResult(droneId, "Requested speed exceeds maximum of 90 meters per second.");
    }

    droneState.speed = targetSpeed;
    this.droneStates.set(droneId, droneState);

    return {
      success: true,
      mission: this.getOrCreateMission(droneId, "point_to_point"),
      voiceFeedback: `Speed set to ${targetSpeed} meters per second.`,
      realTimeData: this.getRealTimeData(droneId),
      warnings: [],
      nextAction: "Speed adjusted"
    };
  }

  async startMission(droneId: string, missionType: string): Promise<AutonomousFlightResult> {
    const droneState = this.droneStates.get(droneId)!;
    
    const mission = this.getOrCreateMission(droneId, missionType as MissionType);
    mission.status = "ready";
    mission.startTime = new Date();

    if (!droneState.isFlying) {
      await this.executeTakeoff(droneId, 100);
    }

    mission.status = "in_flight";
    this.activeMissions.set(droneId, mission);

    return {
      success: true,
      mission,
      voiceFeedback: `${missionType} mission started. All systems nominal. Beginning operations.`,
      realTimeData: this.getRealTimeData(droneId),
      warnings: [],
      nextAction: `Executing ${missionType} mission`
    };
  }

  async abortMission(droneId: string): Promise<AutonomousFlightResult> {
    const droneState = this.droneStates.get(droneId)!;
    const activeMission = this.activeMissions.get(droneId);

    if (!activeMission || activeMission.status === "completed" || activeMission.status === "aborted") {
      return this.createErrorResult(droneId, "No active mission to abort.");
    }

    activeMission.status = "aborted";
    activeMission.endTime = new Date();
    
    droneState.speed = 0;
    droneState.status = "hovering";
    this.droneStates.set(droneId, droneState);

    this.log(droneId, "warning", "Mission aborted by command", droneState.position);

    return {
      success: true,
      mission: activeMission,
      voiceFeedback: "Mission aborted. Holding current position. Do you want me to return home?",
      realTimeData: this.getRealTimeData(droneId),
      warnings: ["Mission aborted"],
      nextAction: "Awaiting instructions"
    };
  }

  generateStatusReport(droneId: string): AutonomousFlightResult {
    const droneState = this.droneStates.get(droneId)!;
    const activeMission = this.activeMissions.get(droneId);
    const realTimeData = this.getRealTimeData(droneId);

    const statusParts: string[] = [];
    
    statusParts.push(`Drone status: ${droneState.status}.`);
    statusParts.push(`Position: ${droneState.position.name || `${droneState.position.latitude.toFixed(4)}, ${droneState.position.longitude.toFixed(4)}`}.`);
    statusParts.push(`Altitude: ${droneState.altitude} meters.`);
    statusParts.push(`Battery: ${droneState.batteryLevel}%.`);
    statusParts.push(`Signal: ${droneState.signalStrength}%.`);
    
    if (droneState.isFlying) {
      statusParts.push(`Speed: ${droneState.speed} meters per second.`);
      statusParts.push(`Heading: ${droneState.heading} degrees.`);
    }

    if (activeMission && activeMission.status !== "completed") {
      statusParts.push(`Active mission: ${activeMission.type}. Progress: ${Math.round(realTimeData.missionProgress)}%.`);
    }

    statusParts.push(`Distance to home: ${(realTimeData.distanceToHome / 1000).toFixed(1)} kilometers.`);

    return {
      success: true,
      mission: activeMission || this.createEmptyMission(droneId),
      voiceFeedback: statusParts.join(" "),
      realTimeData,
      warnings: [],
      nextAction: "Status report complete"
    };
  }

  private async simulateFlightProgress(droneId: string, destination: GPSCoordinate, speed: number): Promise<void> {
    const droneState = this.droneStates.get(droneId)!;
    const distance = this.calculateDistance(droneState.position, destination);
    const steps = Math.min(10, Math.ceil(distance / 100));
    
    for (let i = 1; i <= steps; i++) {
      const progress = i / steps;
      droneState.position = {
        latitude: droneState.position.latitude + (destination.latitude - droneState.position.latitude) * (1 / steps),
        longitude: droneState.position.longitude + (destination.longitude - droneState.position.longitude) * (1 / steps),
        altitude: destination.altitude
      };
      
      droneState.batteryLevel = Math.max(10, droneState.batteryLevel - (distance / 10000));
      
      this.droneStates.set(droneId, droneState);
      await this.delay(100);
    }
  }

  private async simulateAltitudeChange(droneId: string, targetAltitude: number, rate: number): Promise<void> {
    const droneState = this.droneStates.get(droneId)!;
    const diff = targetAltitude - droneState.altitude;
    const steps = Math.abs(Math.ceil(diff / rate));
    
    for (let i = 1; i <= steps; i++) {
      droneState.altitude += diff > 0 ? rate : -rate;
      if ((diff > 0 && droneState.altitude > targetAltitude) || (diff < 0 && droneState.altitude < targetAltitude)) {
        droneState.altitude = targetAltitude;
      }
      this.droneStates.set(droneId, droneState);
      await this.delay(50);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private calculateDistance(from: GPSCoordinate, to: GPSCoordinate): number {
    const R = 6371e3;
    const φ1 = (from.latitude * Math.PI) / 180;
    const φ2 = (to.latitude * Math.PI) / 180;
    const Δφ = ((to.latitude - from.latitude) * Math.PI) / 180;
    const Δλ = ((to.longitude - from.longitude) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  private calculateHeading(from: GPSCoordinate, to: GPSCoordinate): number {
    const φ1 = (from.latitude * Math.PI) / 180;
    const φ2 = (to.latitude * Math.PI) / 180;
    const Δλ = ((to.longitude - from.longitude) * Math.PI) / 180;

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    const θ = Math.atan2(y, x);

    return ((θ * 180) / Math.PI + 360) % 360;
  }

  private generatePatrolWaypoints(center: GPSCoordinate, radius: number, numPoints: number): Waypoint[] {
    const waypoints: Waypoint[] = [];
    const radiusDegrees = radius / 111320;

    for (let i = 0; i < numPoints; i++) {
      const angle = (2 * Math.PI * i) / numPoints;
      waypoints.push({
        id: `wp-patrol-${i}`,
        position: {
          latitude: center.latitude + radiusDegrees * Math.cos(angle),
          longitude: center.longitude + radiusDegrees * Math.sin(angle) / Math.cos(center.latitude * Math.PI / 180),
          altitude: 100
        },
        altitude: 100,
        speed: 10,
        action: { type: "hover", duration: 5 },
        reached: false
      });
    }

    return waypoints;
  }

  private generateSearchPattern(center: GPSCoordinate, radius: number): Waypoint[] {
    const waypoints: Waypoint[] = [];
    const spacing = radius / 5;
    const spacingDegrees = spacing / 111320;
    
    let row = 0;
    for (let y = -radius; y <= radius; y += spacing) {
      const yDeg = y / 111320;
      const xMax = Math.sqrt(radius * radius - y * y);
      
      if (row % 2 === 0) {
        for (let x = -xMax; x <= xMax; x += spacing) {
          const xDeg = x / (111320 * Math.cos(center.latitude * Math.PI / 180));
          waypoints.push({
            id: `wp-search-${waypoints.length}`,
            position: {
              latitude: center.latitude + yDeg,
              longitude: center.longitude + xDeg,
              altitude: 80
            },
            altitude: 80,
            speed: 8,
            action: { type: "scan_area", duration: 3 },
            reached: false
          });
        }
      } else {
        for (let x = xMax; x >= -xMax; x -= spacing) {
          const xDeg = x / (111320 * Math.cos(center.latitude * Math.PI / 180));
          waypoints.push({
            id: `wp-search-${waypoints.length}`,
            position: {
              latitude: center.latitude + yDeg,
              longitude: center.longitude + xDeg,
              altitude: 80
            },
            altitude: 80,
            speed: 8,
            action: { type: "scan_area", duration: 3 },
            reached: false
          });
        }
      }
      row++;
    }

    return waypoints;
  }

  private getOrCreateMission(droneId: string, type: MissionType): FlightMission {
    let mission = this.activeMissions.get(droneId);
    
    if (!mission || mission.status === "completed" || mission.status === "aborted") {
      mission = {
        id: `mission-${Date.now()}`,
        name: `${type} mission`,
        type,
        status: "planning",
        waypoints: [],
        currentWaypointIndex: 0,
        droneId,
        parameters: { ...DEFAULT_MISSION_PARAMS },
        flightLog: [],
        realTimeData: this.getRealTimeData(droneId)
      };
      this.activeMissions.set(droneId, mission);
    }

    return mission;
  }

  private createEmptyMission(droneId: string): FlightMission {
    return {
      id: `mission-${Date.now()}`,
      name: "Standby",
      type: "point_to_point",
      status: "planning",
      waypoints: [],
      currentWaypointIndex: 0,
      droneId,
      parameters: { ...DEFAULT_MISSION_PARAMS },
      flightLog: [],
      realTimeData: this.getRealTimeData(droneId)
    };
  }

  private createDefaultDroneState(droneId: string): DroneState {
    const state: DroneState = {
      droneId,
      position: { ...this.homeBase },
      heading: 0,
      speed: 0,
      altitude: 0,
      batteryLevel: 100,
      signalStrength: 100,
      isFlying: false,
      status: "idle"
    };
    this.droneStates.set(droneId, state);
    return state;
  }

  private getRealTimeData(droneId: string): RealTimeFlightData {
    const droneState = this.droneStates.get(droneId) || this.createDefaultDroneState(droneId);
    const mission = this.activeMissions.get(droneId);
    
    const distanceToHome = this.calculateDistance(droneState.position, this.homeBase);
    let distanceToNextWaypoint = 0;
    let missionProgress = 0;

    if (mission && mission.waypoints.length > 0) {
      const nextWaypoint = mission.waypoints.find(wp => !wp.reached);
      if (nextWaypoint) {
        distanceToNextWaypoint = this.calculateDistance(droneState.position, nextWaypoint.position);
      }
      
      const completedWaypoints = mission.waypoints.filter(wp => wp.reached).length;
      missionProgress = (completedWaypoints / mission.waypoints.length) * 100;
    }

    return {
      position: droneState.position,
      altitude: droneState.altitude,
      speed: droneState.speed,
      heading: droneState.heading,
      batteryLevel: droneState.batteryLevel,
      signalStrength: droneState.signalStrength,
      distanceToNextWaypoint,
      distanceToHome,
      estimatedTimeToWaypoint: distanceToNextWaypoint / Math.max(droneState.speed, 1),
      estimatedTimeToHome: distanceToHome / Math.max(droneState.speed, 15),
      obstaclesDetected: 0,
      missionProgress,
      lastUpdate: new Date()
    };
  }

  private log(droneId: string, type: FlightLogEntry["type"], message: string, position?: GPSCoordinate): void {
    const mission = this.activeMissions.get(droneId);
    if (mission) {
      mission.flightLog.push({
        timestamp: new Date(),
        type,
        message,
        position
      });
    }
    console.log(`[CYRUS Flight] [${droneId}] [${type.toUpperCase()}] ${message}`);
  }

  private createErrorResult(droneId: string, message: string): AutonomousFlightResult {
    return {
      success: false,
      mission: this.createEmptyMission(droneId),
      voiceFeedback: message,
      realTimeData: this.getRealTimeData(droneId),
      warnings: [message],
      nextAction: "Error - awaiting correction"
    };
  }

  async scanForDrones(scanRadius: number = 5000): Promise<DroneScanResult> {
    this.isScanning = true;
    const startTime = Date.now();
    
    console.log(`[CYRUS Flight] Scanning for drones within ${scanRadius}m radius...`);
    
    await this.delay(1500);
    
    this.discoveredDrones.forEach(drone => {
      drone.lastSeen = new Date();
      const signalVariation = Math.random() * 10 - 5;
      drone.signalStrength = Math.max(20, Math.min(100, drone.signalStrength + signalVariation));
      
      if (Math.random() > 0.9 && drone.status !== "connected") {
        drone.status = Math.random() > 0.5 ? "available" : "busy";
      }
    });

    const dronesFound = Array.from(this.discoveredDrones.values());
    const scanDuration = Date.now() - startTime;
    
    this.isScanning = false;
    this.lastScanTime = new Date();

    const connectedCount = dronesFound.filter(d => d.status === "connected").length;
    const availableCount = dronesFound.filter(d => d.status === "available").length;

    return {
      success: true,
      dronesFound,
      scanDuration,
      scanRadius,
      voiceFeedback: `Scan complete. Found ${dronesFound.length} drones in range. ${connectedCount} connected, ${availableCount} available for connection.`
    };
  }

  async connectToDrone(droneId: string): Promise<DroneConnectionResult> {
    const drone = this.discoveredDrones.get(droneId);
    
    if (!drone) {
      return {
        success: false,
        droneId,
        voiceFeedback: `Drone ${droneId} not found. Try scanning for available drones first.`
      };
    }

    if (drone.status === "connected") {
      return {
        success: true,
        droneId,
        drone,
        voiceFeedback: `Already connected to ${drone.name}. Ready for commands.`
      };
    }

    if (drone.status === "busy") {
      return {
        success: false,
        droneId,
        voiceFeedback: `${drone.name} is currently busy with another operation. Please wait or try another drone.`
      };
    }

    if (drone.status === "offline") {
      return {
        success: false,
        droneId,
        voiceFeedback: `${drone.name} appears to be offline. Check the drone's power and try again.`
      };
    }

    console.log(`[CYRUS Flight] Connecting to ${drone.name}...`);
    await this.delay(800);

    drone.status = "connected";
    drone.lastSeen = new Date();
    this.connectedDrones.set(droneId, drone);

    if (!this.droneStates.has(droneId)) {
      this.droneStates.set(droneId, {
        droneId,
        position: drone.position,
        heading: 0,
        speed: 0,
        altitude: 0,
        batteryLevel: drone.batteryLevel,
        signalStrength: drone.signalStrength,
        isFlying: false,
        status: "idle"
      });
    }

    return {
      success: true,
      droneId,
      drone,
      voiceFeedback: `Successfully connected to ${drone.name}. Model: ${drone.model}. Battery at ${drone.batteryLevel}%. Signal strength ${drone.signalStrength}%. Ready for commands.`
    };
  }

  async connectToAllDrones(): Promise<DroneConnectionResult> {
    const results: DiscoveredDrone[] = [];
    const availableDrones = Array.from(this.discoveredDrones.values())
      .filter(d => d.status === "available" || d.status === "connected");

    console.log(`[CYRUS Flight] Connecting to all ${availableDrones.length} available drones...`);

    for (const drone of availableDrones) {
      if (drone.status !== "connected") {
        const result = await this.connectToDrone(drone.droneId);
        if (result.success && result.drone) {
          results.push(result.drone);
        }
      } else {
        results.push(drone);
      }
    }

    const connectedDrones = Array.from(this.connectedDrones.values());
    
    return {
      success: true,
      droneId: "all",
      allConnected: connectedDrones,
      voiceFeedback: `Connected to ${connectedDrones.length} drones. All systems online and ready for coordinated operations.`
    };
  }

  async disconnectDrone(droneId: string): Promise<DroneConnectionResult> {
    const drone = this.connectedDrones.get(droneId);
    
    if (!drone) {
      return {
        success: false,
        droneId,
        voiceFeedback: `Drone ${droneId} is not currently connected.`
      };
    }

    const droneState = this.droneStates.get(droneId);
    if (droneState && droneState.isFlying) {
      return {
        success: false,
        droneId,
        voiceFeedback: `Cannot disconnect ${drone.name} while it's in flight. Land the drone first.`
      };
    }

    console.log(`[CYRUS Flight] Disconnecting from ${drone.name}...`);
    await this.delay(300);

    drone.status = "available";
    this.connectedDrones.delete(droneId);

    return {
      success: true,
      droneId,
      drone,
      voiceFeedback: `Disconnected from ${drone.name}. Drone is now available for other connections.`
    };
  }

  getDiscoveredDrones(): DiscoveredDrone[] {
    return Array.from(this.discoveredDrones.values());
  }

  getConnectedDrones(): DiscoveredDrone[] {
    return Array.from(this.connectedDrones.values());
  }

  isCurrentlyScanning(): boolean {
    return this.isScanning;
  }

  getLastScanTime(): Date {
    return this.lastScanTime;
  }

  getDroneState(droneId: string): DroneState | undefined {
    return this.droneStates.get(droneId);
  }

  getActiveMission(droneId: string): FlightMission | undefined {
    return this.activeMissions.get(droneId);
  }

  getAllDrones(): DroneState[] {
    return Array.from(this.droneStates.values());
  }
}

export const autonomousFlightEngine = new AutonomousFlightEngine();
