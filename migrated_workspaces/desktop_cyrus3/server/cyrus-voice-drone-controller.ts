import { flightControlEngine } from "./cyrus-flight-control";
import { autonomousEngine } from "./autonomous-engine";
import { missionCommander } from "./cyrus-mission-commander";

export interface VoiceCommand {
  id: string;
  rawText: string;
  intent: DroneCommandIntent;
  parameters: CommandParameters;
  confidence: number;
  timestamp: Date;
  status: "parsed" | "validated" | "executing" | "completed" | "failed";
}

export type DroneCommandIntent =
  | "FLY_TO_LOCATION"
  | "TAKEOFF"
  | "LAND"
  | "RETURN_HOME"
  | "HOVER"
  | "SET_ALTITUDE"
  | "SET_SPEED"
  | "FOLLOW_PATH"
  | "PATROL_AREA"
  | "SEARCH_AREA"
  | "CAPTURE_IMAGE"
  | "START_RECORDING"
  | "STOP_RECORDING"
  | "EMERGENCY_STOP"
  | "STATUS_REPORT"
  | "START_MISSION"
  | "ABORT_MISSION"
  | "UNKNOWN";

export interface CommandParameters {
  destination?: GPSCoordinate;
  altitude?: number;
  speed?: number;
  heading?: number;
  waypoints?: GPSCoordinate[];
  patrolRadius?: number;
  missionType?: string;
  duration?: number;
}

export interface GPSCoordinate {
  latitude: number;
  longitude: number;
  altitude?: number;
  name?: string;
}

export interface DroneState {
  droneId: string;
  position: GPSCoordinate;
  heading: number;
  speed: number;
  altitude: number;
  batteryLevel: number;
  signalStrength: number;
  isFlying: boolean;
  currentMission?: string;
  status: "idle" | "takeoff" | "flying" | "hovering" | "landing" | "emergency";
}

export interface CommandResult {
  success: boolean;
  message: string;
  voiceFeedback: string;
  droneState?: DroneState;
  estimatedTime?: number;
  warnings?: string[];
}

const KNOWN_LOCATIONS: Record<string, GPSCoordinate> = {
  "home": { latitude: -24.6282, longitude: 25.9231, altitude: 0, name: "Home Base" },
  "base": { latitude: -24.6282, longitude: 25.9231, altitude: 0, name: "Home Base" },
  "headquarters": { latitude: -24.6541, longitude: 25.9087, altitude: 0, name: "Headquarters" },
  "airport": { latitude: -24.5552, longitude: 25.9189, altitude: 0, name: "Airport" },
  "city center": { latitude: -24.6580, longitude: 25.9127, altitude: 0, name: "City Center" },
  "north point": { latitude: -24.5000, longitude: 25.9231, altitude: 0, name: "North Point" },
  "south point": { latitude: -24.7500, longitude: 25.9231, altitude: 0, name: "South Point" },
  "east point": { latitude: -24.6282, longitude: 26.0500, altitude: 0, name: "East Point" },
  "west point": { latitude: -24.6282, longitude: 25.8000, altitude: 0, name: "West Point" },
};

export class VoiceDroneController {
  private commandHistory: VoiceCommand[] = [];
  private activeDrones: Map<string, DroneState> = new Map();
  private activeMissions: Map<string, string> = new Map();

  parseVoiceCommand(rawText: string): VoiceCommand {
    const text = rawText.toLowerCase().trim();
    const { intent, parameters, confidence } = this.extractIntent(text);

    const command: VoiceCommand = {
      id: `vc-${Date.now()}`,
      rawText,
      intent,
      parameters,
      confidence,
      timestamp: new Date(),
      status: "parsed"
    };

    this.commandHistory.push(command);
    return command;
  }

  private extractIntent(text: string): { intent: DroneCommandIntent; parameters: CommandParameters; confidence: number } {
    let intent: DroneCommandIntent = "UNKNOWN";
    let parameters: CommandParameters = {};
    let confidence = 0.5;

    if (text.match(/fly\s+(to|towards?)\s+/i) || text.match(/go\s+(to|towards?)\s+/i) || text.match(/navigate\s+(to|towards?)\s+/i)) {
      intent = "FLY_TO_LOCATION";
      parameters.destination = this.extractLocation(text);
      parameters.altitude = this.extractAltitude(text);
      parameters.speed = this.extractSpeed(text);
      confidence = parameters.destination ? 0.9 : 0.6;
    }
    else if (text.match(/take\s*off|launch|lift\s*off/i)) {
      intent = "TAKEOFF";
      parameters.altitude = this.extractAltitude(text) || 50;
      confidence = 0.95;
    }
    else if (text.match(/land|touch\s*down|descend\s+and\s+land/i)) {
      intent = "LAND";
      parameters.destination = this.extractLocation(text);
      confidence = 0.95;
    }
    else if (text.match(/return\s+(to\s+)?(home|base)|rtb|come\s+back|go\s+home/i)) {
      intent = "RETURN_HOME";
      confidence = 0.95;
    }
    else if (text.match(/hover|hold\s+position|stay\s+(here|there)|wait/i)) {
      intent = "HOVER";
      confidence = 0.9;
    }
    else if (text.match(/set\s+altitude|go\s+(up|down)|climb|descend/i)) {
      intent = "SET_ALTITUDE";
      parameters.altitude = this.extractAltitude(text);
      confidence = parameters.altitude ? 0.9 : 0.6;
    }
    else if (text.match(/set\s+speed|go\s+(faster|slower)|speed\s+up|slow\s+down/i)) {
      intent = "SET_SPEED";
      parameters.speed = this.extractSpeed(text);
      confidence = parameters.speed ? 0.9 : 0.7;
    }
    else if (text.match(/patrol|circle|orbit/i)) {
      intent = "PATROL_AREA";
      parameters.destination = this.extractLocation(text);
      parameters.patrolRadius = this.extractRadius(text) || 100;
      confidence = 0.85;
    }
    else if (text.match(/search|scan|sweep/i)) {
      intent = "SEARCH_AREA";
      parameters.destination = this.extractLocation(text);
      confidence = 0.85;
    }
    else if (text.match(/take\s+(a\s+)?photo|capture\s+(image|photo)|photograph/i)) {
      intent = "CAPTURE_IMAGE";
      confidence = 0.95;
    }
    else if (text.match(/start\s+record|begin\s+record|record\s+video/i)) {
      intent = "START_RECORDING";
      confidence = 0.95;
    }
    else if (text.match(/stop\s+record|end\s+record/i)) {
      intent = "STOP_RECORDING";
      confidence = 0.95;
    }
    else if (text.match(/emergency|stop\s+now|halt|abort|freeze/i)) {
      intent = "EMERGENCY_STOP";
      confidence = 0.99;
    }
    else if (text.match(/status|report|where\s+are\s+you|position|battery|how\s+are\s+you/i)) {
      intent = "STATUS_REPORT";
      confidence = 0.9;
    }
    else if (text.match(/start\s+mission|begin\s+mission|execute\s+mission/i)) {
      intent = "START_MISSION";
      parameters.missionType = this.extractMissionType(text);
      confidence = 0.85;
    }
    else if (text.match(/abort\s+mission|cancel\s+mission|stop\s+mission/i)) {
      intent = "ABORT_MISSION";
      confidence = 0.95;
    }

    return { intent, parameters, confidence };
  }

  private extractLocation(text: string): GPSCoordinate | undefined {
    for (const [name, coords] of Object.entries(KNOWN_LOCATIONS)) {
      if (text.includes(name)) {
        return { ...coords, name };
      }
    }

    const coordMatch = text.match(/(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/);
    if (coordMatch) {
      return {
        latitude: parseFloat(coordMatch[1]),
        longitude: parseFloat(coordMatch[2]),
        name: "Custom Location"
      };
    }

    return undefined;
  }

  private extractAltitude(text: string): number | undefined {
    const match = text.match(/(\d+)\s*(meters?|m|feet|ft)/i);
    if (match) {
      const value = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      if (unit.startsWith("f")) {
        return Math.round(value * 0.3048);
      }
      return value;
    }
    return undefined;
  }

  private extractSpeed(text: string): number | undefined {
    const match = text.match(/(\d+)\s*(m\/s|mps|km\/h|kph|mph)/i);
    if (match) {
      const value = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      if (unit === "km/h" || unit === "kph") {
        return Math.round(value / 3.6);
      }
      if (unit === "mph") {
        return Math.round(value * 0.447);
      }
      return value;
    }
    return undefined;
  }

  private extractRadius(text: string): number | undefined {
    const match = text.match(/(\d+)\s*(meter|m)\s*radius/i);
    if (match) {
      return parseInt(match[1]);
    }
    return undefined;
  }

  private extractMissionType(text: string): string {
    if (text.includes("reconnaissance") || text.includes("recon")) return "reconnaissance";
    if (text.includes("surveillance")) return "surveillance";
    if (text.includes("patrol")) return "patrol";
    if (text.includes("search") || text.includes("rescue")) return "search_rescue";
    if (text.includes("delivery")) return "delivery";
    if (text.includes("inspection")) return "inspection";
    return "general";
  }

  async executeCommand(command: VoiceCommand, droneId: string = "drone-1"): Promise<CommandResult> {
    command.status = "executing";

    const droneState = this.getDroneState(droneId);
    
    const validation = this.validateCommand(command, droneState);
    if (!validation.valid) {
      command.status = "failed";
      return {
        success: false,
        message: validation.reason || "Command validation failed",
        voiceFeedback: `I cannot execute that command. ${validation.reason}`,
        droneState,
        warnings: validation.warnings
      };
    }

    command.status = "validated";

    try {
      const result = await this.executeIntent(command, droneState);
      command.status = result.success ? "completed" : "failed";
      return result;
    } catch (error) {
      command.status = "failed";
      return {
        success: false,
        message: `Execution error: ${error}`,
        voiceFeedback: "I encountered an error while executing the command. Please try again.",
        droneState
      };
    }
  }

  private validateCommand(command: VoiceCommand, droneState: DroneState): { valid: boolean; reason?: string; warnings?: string[] } {
    const warnings: string[] = [];

    // Battery safety checks
    if (droneState.batteryLevel < 10) {
      if (command.intent !== "EMERGENCY_STOP" && command.intent !== "LAND") {
        return { valid: false, reason: "Battery critically low at " + droneState.batteryLevel + "%. Only emergency landing allowed.", warnings };
      }
    }

    if (droneState.batteryLevel < 20) {
      warnings.push("Battery level is low at " + droneState.batteryLevel + "%. Consider returning to base soon.");
    }

    if (droneState.batteryLevel < 30 && command.intent === "FLY_TO_LOCATION") {
      const distance = command.parameters.destination ? 
        this.calculateDistance(droneState.position, command.parameters.destination) : 0;
      if (distance > 5000) {
        return { valid: false, reason: "Insufficient battery for long-distance flight. Distance: " + Math.round(distance) + "m. Return to base recommended.", warnings };
      }
    }

    // Signal strength check
    if (droneState.signalStrength < 30) {
      warnings.push("Signal strength is weak. Maintain line of sight.");
    }

    if (droneState.signalStrength < 15 && command.intent !== "RETURN_HOME" && command.intent !== "EMERGENCY_STOP") {
      return { valid: false, reason: "Signal too weak for command execution. Return to base initiated.", warnings };
    }

    // Flight state checks
    if (command.intent === "TAKEOFF" && droneState.isFlying) {
      return { valid: false, reason: "Drone is already airborne.", warnings };
    }

    if (command.intent === "LAND" && !droneState.isFlying) {
      return { valid: false, reason: "Drone is already on the ground.", warnings };
    }

    if (command.intent === "FLY_TO_LOCATION" && !command.parameters.destination) {
      return { valid: false, reason: "No destination specified. Please tell me where to fly.", warnings };
    }

    // Coordinate validation
    if (command.parameters.destination) {
      const dest = command.parameters.destination;
      if (dest.latitude < -90 || dest.latitude > 90) {
        return { valid: false, reason: "Invalid latitude coordinate. Must be between -90 and 90 degrees.", warnings };
      }
      if (dest.longitude < -180 || dest.longitude > 180) {
        return { valid: false, reason: "Invalid longitude coordinate. Must be between -180 and 180 degrees.", warnings };
      }
      
      // Check distance limit (max 50km range)
      const distance = this.calculateDistance(droneState.position, dest);
      if (distance > 50000) {
        return { valid: false, reason: "Destination exceeds maximum range of 50km. Distance: " + Math.round(distance/1000) + "km.", warnings };
      }
    }

    // Altitude validation
    if (command.parameters.altitude) {
      if (command.parameters.altitude > 7620) {
        return { valid: false, reason: "Requested altitude exceeds maximum flight ceiling of 7620 meters.", warnings };
      }
      if (command.parameters.altitude < 10) {
        warnings.push("Low altitude requested. Ensure clear terrain.");
      }
      if (command.parameters.altitude < 0) {
        return { valid: false, reason: "Invalid altitude. Cannot fly below ground level.", warnings };
      }
    }

    // Speed validation
    if (command.parameters.speed) {
      if (command.parameters.speed > 90) {
        return { valid: false, reason: "Requested speed exceeds maximum of 90 m/s.", warnings };
      }
      if (command.parameters.speed < 0) {
        return { valid: false, reason: "Invalid speed. Speed must be positive.", warnings };
      }
    }

    return { valid: true, warnings };
  }

  private async executeIntent(command: VoiceCommand, droneState: DroneState): Promise<CommandResult> {
    switch (command.intent) {
      case "TAKEOFF":
        return this.executeTakeoff(droneState, command.parameters);

      case "LAND":
        return this.executeLand(droneState, command.parameters);

      case "FLY_TO_LOCATION":
        return this.executeFlyTo(droneState, command.parameters);

      case "RETURN_HOME":
        return this.executeReturnHome(droneState);

      case "HOVER":
        return this.executeHover(droneState);

      case "SET_ALTITUDE":
        return this.executeSetAltitude(droneState, command.parameters);

      case "SET_SPEED":
        return this.executeSetSpeed(droneState, command.parameters);

      case "PATROL_AREA":
        return this.executePatrol(droneState, command.parameters);

      case "SEARCH_AREA":
        return this.executeSearch(droneState, command.parameters);

      case "CAPTURE_IMAGE":
        return this.executeCaptureImage(droneState);

      case "START_RECORDING":
        return this.executeStartRecording(droneState);

      case "STOP_RECORDING":
        return this.executeStopRecording(droneState);

      case "EMERGENCY_STOP":
        return this.executeEmergencyStop(droneState);

      case "STATUS_REPORT":
        return this.executeStatusReport(droneState);

      case "START_MISSION":
        return this.executeStartMission(droneState, command.parameters);

      case "ABORT_MISSION":
        return this.executeAbortMission(droneState);

      default:
        return {
          success: false,
          message: "Unknown command intent",
          voiceFeedback: "I didn't understand that command. Please try again with a clearer instruction.",
          droneState
        };
    }
  }

  private async executeTakeoff(state: DroneState, params: CommandParameters): Promise<CommandResult> {
    const altitude = params.altitude || 50;
    
    state.isFlying = true;
    state.status = "takeoff";
    state.altitude = altitude;
    this.updateDroneState(state);

    return {
      success: true,
      message: `Drone taking off to ${altitude} meters`,
      voiceFeedback: `Initiating takeoff. Climbing to ${altitude} meters altitude. All systems nominal.`,
      droneState: state,
      estimatedTime: 15
    };
  }

  private async executeLand(state: DroneState, params: CommandParameters): Promise<CommandResult> {
    state.status = "landing";
    
    setTimeout(() => {
      state.isFlying = false;
      state.status = "idle";
      state.altitude = 0;
      this.updateDroneState(state);
    }, 5000);

    return {
      success: true,
      message: "Drone initiating landing sequence",
      voiceFeedback: `Beginning landing sequence at current position. Descending safely. Stand clear of landing zone.`,
      droneState: state,
      estimatedTime: 30
    };
  }

  private async executeFlyTo(state: DroneState, params: CommandParameters): Promise<CommandResult> {
    if (!params.destination) {
      return {
        success: false,
        message: "No destination specified",
        voiceFeedback: "I need to know where you want me to fly. Please specify a destination.",
        droneState: state
      };
    }

    const distance = this.calculateDistance(state.position, params.destination);
    const speed = params.speed || 45;
    const estimatedTime = Math.round(distance / speed);

    state.status = "flying";
    state.heading = this.calculateHeading(state.position, params.destination);
    state.speed = speed;
    if (params.altitude) state.altitude = params.altitude;
    this.updateDroneState(state);

    const destName = params.destination.name || `coordinates ${params.destination.latitude.toFixed(4)}, ${params.destination.longitude.toFixed(4)}`;

    return {
      success: true,
      message: `Flying to ${destName}`,
      voiceFeedback: `Navigation engaged. Flying to ${destName}. Distance: ${Math.round(distance)} meters. Estimated arrival: ${estimatedTime} seconds at ${speed} meters per second.`,
      droneState: state,
      estimatedTime
    };
  }

  private async executeReturnHome(state: DroneState): Promise<CommandResult> {
    const homeBase = KNOWN_LOCATIONS["home"];
    const distance = this.calculateDistance(state.position, homeBase);
    const estimatedTime = Math.round(distance / 45);

    state.status = "flying";
    state.heading = this.calculateHeading(state.position, homeBase);
    state.speed = 45;
    this.updateDroneState(state);

    return {
      success: true,
      message: "Returning to home base",
      voiceFeedback: `Return to base initiated. Flying home. Distance: ${Math.round(distance)} meters. Estimated arrival: ${estimatedTime} seconds.`,
      droneState: state,
      estimatedTime
    };
  }

  private async executeHover(state: DroneState): Promise<CommandResult> {
    state.status = "hovering";
    state.speed = 0;
    this.updateDroneState(state);

    return {
      success: true,
      message: "Drone holding position",
      voiceFeedback: `Holding position at current location. Altitude: ${state.altitude} meters. GPS lock stable.`,
      droneState: state
    };
  }

  private async executeSetAltitude(state: DroneState, params: CommandParameters): Promise<CommandResult> {
    const newAltitude = params.altitude || state.altitude;
    const direction = newAltitude > state.altitude ? "Climbing" : "Descending";
    
    state.altitude = newAltitude;
    this.updateDroneState(state);

    return {
      success: true,
      message: `Altitude set to ${newAltitude} meters`,
      voiceFeedback: `${direction} to ${newAltitude} meters altitude.`,
      droneState: state,
      estimatedTime: Math.abs(newAltitude - state.altitude) / 5
    };
  }

  private async executeSetSpeed(state: DroneState, params: CommandParameters): Promise<CommandResult> {
    const newSpeed = params.speed || 45;
    state.speed = newSpeed;
    this.updateDroneState(state);

    return {
      success: true,
      message: `Speed set to ${newSpeed} m/s`,
      voiceFeedback: `Speed adjusted to ${newSpeed} meters per second.`,
      droneState: state
    };
  }

  private async executePatrol(state: DroneState, params: CommandParameters): Promise<CommandResult> {
    const center = params.destination || state.position;
    const radius = params.patrolRadius || 100;

    state.status = "flying";
    state.currentMission = "patrol";
    this.updateDroneState(state);

    return {
      success: true,
      message: `Patrol initiated with ${radius}m radius`,
      voiceFeedback: `Beginning patrol pattern. Radius: ${radius} meters. I will continuously orbit the designated area and report any observations.`,
      droneState: state
    };
  }

  private async executeSearch(state: DroneState, params: CommandParameters): Promise<CommandResult> {
    state.status = "flying";
    state.currentMission = "search";
    this.updateDroneState(state);

    return {
      success: true,
      message: "Search pattern initiated",
      voiceFeedback: `Initiating search pattern. Cameras active. I will systematically scan the area and report any findings.`,
      droneState: state
    };
  }

  private async executeCaptureImage(state: DroneState): Promise<CommandResult> {
    return {
      success: true,
      message: "Image captured",
      voiceFeedback: `Photo captured at current position. Image saved to mission log.`,
      droneState: state
    };
  }

  private async executeStartRecording(state: DroneState): Promise<CommandResult> {
    return {
      success: true,
      message: "Recording started",
      voiceFeedback: `Video recording started. All cameras active.`,
      droneState: state
    };
  }

  private async executeStopRecording(state: DroneState): Promise<CommandResult> {
    return {
      success: true,
      message: "Recording stopped",
      voiceFeedback: `Video recording stopped. Footage saved to mission log.`,
      droneState: state
    };
  }

  private async executeEmergencyStop(state: DroneState): Promise<CommandResult> {
    state.status = "emergency";
    state.speed = 0;
    this.updateDroneState(state);

    return {
      success: true,
      message: "EMERGENCY STOP ACTIVATED",
      voiceFeedback: `Emergency stop activated! All motors holding. Hovering in place. Awaiting further instructions. Say 'land' to descend safely or 'resume' to continue.`,
      droneState: state,
      warnings: ["Emergency stop activated - drone is hovering in place"]
    };
  }

  private async executeStatusReport(state: DroneState): Promise<CommandResult> {
    const statusText = state.isFlying 
      ? `Currently ${state.status} at ${state.altitude} meters altitude, heading ${state.heading} degrees, speed ${state.speed} meters per second.`
      : "Currently on the ground, all systems ready.";

    return {
      success: true,
      message: "Status report generated",
      voiceFeedback: `Status report: ${statusText} Battery at ${state.batteryLevel} percent. Signal strength ${state.signalStrength} percent. Position: ${state.position.latitude.toFixed(4)}, ${state.position.longitude.toFixed(4)}.`,
      droneState: state
    };
  }

  private async executeStartMission(state: DroneState, params: CommandParameters): Promise<CommandResult> {
    const missionType = params.missionType || "general";
    
    state.currentMission = missionType;
    state.status = "flying";
    this.updateDroneState(state);

    return {
      success: true,
      message: `${missionType} mission started`,
      voiceFeedback: `${missionType} mission initiated. All systems engaged. Beginning autonomous operation. I will provide regular status updates.`,
      droneState: state
    };
  }

  private async executeAbortMission(state: DroneState): Promise<CommandResult> {
    state.currentMission = undefined;
    state.status = "hovering";
    state.speed = 0;
    this.updateDroneState(state);

    return {
      success: true,
      message: "Mission aborted",
      voiceFeedback: `Mission aborted. Holding position. Awaiting new instructions. All mission data has been saved.`,
      droneState: state
    };
  }

  private getDroneState(droneId: string): DroneState {
    if (!this.activeDrones.has(droneId)) {
      const defaultState: DroneState = {
        droneId,
        position: { ...KNOWN_LOCATIONS["home"] },
        heading: 0,
        speed: 0,
        altitude: 0,
        batteryLevel: 100,
        signalStrength: 95,
        isFlying: false,
        status: "idle"
      };
      this.activeDrones.set(droneId, defaultState);
    }
    return this.activeDrones.get(droneId)!;
  }

  private updateDroneState(state: DroneState): void {
    this.activeDrones.set(state.droneId, state);
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

  private calculateHeading(from: GPSCoordinate, to: GPSCoordinate): number {
    const lat1 = from.latitude * Math.PI / 180;
    const lat2 = to.latitude * Math.PI / 180;
    const deltaLon = (to.longitude - from.longitude) * Math.PI / 180;

    const y = Math.sin(deltaLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) -
              Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);

    let heading = Math.atan2(y, x) * 180 / Math.PI;
    heading = (heading + 360) % 360;

    return Math.round(heading);
  }

  getCommandHistory(): VoiceCommand[] {
    return [...this.commandHistory];
  }

  getAllDroneStates(): DroneState[] {
    return Array.from(this.activeDrones.values());
  }
}

export const voiceDroneController = new VoiceDroneController();
