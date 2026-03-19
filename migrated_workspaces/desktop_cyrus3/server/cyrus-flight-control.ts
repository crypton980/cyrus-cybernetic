/**
 * CYRUS AUTONOMOUS FLIGHT CONTROL
 * ================================
 * 
 * Flight envelope management with graceful degradation per BLACKTALON doctrine.
 * 
 * "Endurance is prioritized over peak performance."
 * "Power systems are designed to support autonomous mission completion 
 *  without uplink dependency and graceful degradation rather than abrupt mission abort."
 * 
 * Implements:
 * - Flight envelope protection
 * - Autonomous navigation fallback
 * - Graceful degradation strategies
 * - Self-healing recovery procedures
 */

import type { Drone, Mission, Telemetry } from "@shared/schema";
import type { Decision, OODACycleResult } from "./cyrus-cognitive-core";

// ============================================================================
// FLIGHT ENVELOPE DEFINITIONS
// ============================================================================

export interface FlightEnvelope {
  altitude: { min: number; max: number; ceiling: number };
  speed: { min: number; max: number; cruise: number };
  bank: { max: number };
  pitch: { min: number; max: number };
  gLoad: { min: number; max: number };
  batteryThresholds: {
    normal: number;
    caution: number;
    warning: number;
    critical: number;
    emergency: number;
  };
  signalThresholds: {
    normal: number;
    degraded: number;
    critical: number;
    lost: number;
  };
}

export interface FlightControlState {
  mode: FlightMode;
  authority: "pilot" | "cyrus" | "shared" | "emergency";
  envelopeStatus: "nominal" | "caution" | "warning" | "critical";
  autopilotEngaged: boolean;
  holdPattern: HoldPattern | null;
  activeManeuver: Maneuver | null;
  degradationLevel: number;
  failsafes: FailsafeState[];
}

export type FlightMode = 
  | "manual"
  | "autopilot"
  | "waypoint_nav"
  | "loiter"
  | "rtb"
  | "emergency_rtb"
  | "emergency_land"
  | "gps_denied"
  | "autonomous";

export interface HoldPattern {
  type: "orbit" | "figure8" | "racetrack" | "hover";
  center: { lat: number; lng: number };
  radius: number;
  altitude: number;
  direction: "cw" | "ccw";
  duration?: number;
}

export interface Maneuver {
  id: string;
  type: "climb" | "descend" | "turn" | "accelerate" | "decelerate" | "evasive" | "approach" | "departure";
  targetState: Partial<FlightState>;
  startTime: Date;
  estimatedDuration: number;
  priority: "routine" | "urgent" | "emergency";
  progress: number;
}

export interface FlightState {
  altitude: number;
  airspeed: number;
  groundSpeed: number;
  heading: number;
  pitch: number;
  roll: number;
  yaw: number;
  verticalSpeed: number;
  gLoad: number;
}

export interface FailsafeState {
  id: string;
  type: "battery" | "signal" | "gps" | "engine" | "control" | "structural";
  triggered: boolean;
  triggerTime?: Date;
  action: string;
  status: "armed" | "triggered" | "resolved" | "disabled";
}

export interface DegradationStrategy {
  trigger: string;
  level: number;
  actions: string[];
  missionImpact: string;
  recoverable: boolean;
}

// ============================================================================
// DEFAULT FLIGHT ENVELOPE (BLACKTALON SPEC)
// ============================================================================

const BLACKTALON_ENVELOPE: FlightEnvelope = {
  altitude: {
    min: 50,        // 50m AGL minimum
    max: 7620,      // 25,000 ft service ceiling
    ceiling: 9144,  // 30,000 ft absolute ceiling
  },
  speed: {
    min: 35,        // 35 m/s stall speed
    max: 90,        // 90 m/s max speed
    cruise: 55,     // 55 m/s cruise speed
  },
  bank: {
    max: 60,        // 60 degree max bank
  },
  pitch: {
    min: -30,       // 30 degree nose down
    max: 45,        // 45 degree nose up
  },
  gLoad: {
    min: -1.5,
    max: 3.8,
  },
  batteryThresholds: {
    normal: 40,
    caution: 30,
    warning: 20,
    critical: 15,
    emergency: 10,
  },
  signalThresholds: {
    normal: 60,
    degraded: 40,
    critical: 20,
    lost: 5,
  },
};

// ============================================================================
// DEGRADATION STRATEGIES
// ============================================================================

const DEGRADATION_STRATEGIES: DegradationStrategy[] = [
  {
    trigger: "BATTERY_CAUTION",
    level: 1,
    actions: ["REDUCE_SENSOR_POWER", "OPTIMIZE_FLIGHT_PROFILE"],
    missionImpact: "Reduced sensor capability",
    recoverable: true,
  },
  {
    trigger: "BATTERY_WARNING",
    level: 2,
    actions: ["DISABLE_NON_ESSENTIAL", "PLAN_RTB", "NOTIFY_OPERATOR"],
    missionImpact: "Mission curtailment recommended",
    recoverable: true,
  },
  {
    trigger: "BATTERY_CRITICAL",
    level: 3,
    actions: ["INITIATE_RTB", "MINIMUM_POWER_MODE", "EMERGENCY_BROADCAST"],
    missionImpact: "Mission abort - RTB mandatory",
    recoverable: false,
  },
  {
    trigger: "SIGNAL_DEGRADED",
    level: 1,
    actions: ["INCREASE_ALTITUDE", "REDUCE_DATA_RATE", "BUFFER_TELEMETRY"],
    missionImpact: "Reduced data throughput",
    recoverable: true,
  },
  {
    trigger: "SIGNAL_LOST",
    level: 3,
    actions: ["EXECUTE_LOST_LINK", "AUTONOMOUS_RTB", "CONTINUE_MISSION_TIMER"],
    missionImpact: "Lost link protocol activated",
    recoverable: true,
  },
  {
    trigger: "GPS_DENIED",
    level: 2,
    actions: ["SWITCH_TO_INS", "VISUAL_NAV_ASSIST", "REDUCE_SPEED"],
    missionImpact: "Navigation accuracy degraded",
    recoverable: true,
  },
  {
    trigger: "ENGINE_PARTIAL",
    level: 2,
    actions: ["REDUCE_POWER", "ADJUST_TRIM", "PLAN_RECOVERY"],
    missionImpact: "Reduced performance envelope",
    recoverable: true,
  },
  {
    trigger: "ENGINE_FAILURE",
    level: 4,
    actions: ["DECLARE_EMERGENCY", "BEST_GLIDE", "SELECT_LANDING_SITE"],
    missionImpact: "Emergency landing required",
    recoverable: false,
  },
];

// ============================================================================
// FLIGHT CONTROL ENGINE
// ============================================================================

export class FlightControlEngine {
  private envelope: FlightEnvelope = BLACKTALON_ENVELOPE;
  private controlState: Map<string, FlightControlState> = new Map();
  private flightStates: Map<string, FlightState> = new Map();
  private maneuverQueue: Map<string, Maneuver[]> = new Map();
  private degradationStrategies = DEGRADATION_STRATEGIES;
  private commandHistory: FlightCommand[] = [];

  // ============================================================================
  // FLIGHT STATE MANAGEMENT
  // ============================================================================

  getControlState(droneId: string): FlightControlState {
    if (!this.controlState.has(droneId)) {
      this.initializeControlState(droneId);
    }
    return this.controlState.get(droneId)!;
  }

  private initializeControlState(droneId: string): void {
    const state: FlightControlState = {
      mode: "manual",
      authority: "pilot",
      envelopeStatus: "nominal",
      autopilotEngaged: false,
      holdPattern: null,
      activeManeuver: null,
      degradationLevel: 0,
      failsafes: this.initializeFailsafes(),
    };
    this.controlState.set(droneId, state);
  }

  private initializeFailsafes(): FailsafeState[] {
    return [
      { id: "FS-BAT", type: "battery", triggered: false, action: "RTB_ON_LOW", status: "armed" },
      { id: "FS-SIG", type: "signal", triggered: false, action: "LOST_LINK_PROCEDURE", status: "armed" },
      { id: "FS-GPS", type: "gps", triggered: false, action: "INS_FALLBACK", status: "armed" },
      { id: "FS-ENG", type: "engine", triggered: false, action: "BEST_GLIDE", status: "armed" },
      { id: "FS-CTL", type: "control", triggered: false, action: "STABILIZE", status: "armed" },
    ];
  }

  updateFlightState(droneId: string, telemetry: Telemetry): FlightState {
    const flightState: FlightState = {
      altitude: telemetry.altitude,
      airspeed: telemetry.speed,
      groundSpeed: telemetry.speed,
      heading: telemetry.heading,
      pitch: 0,
      roll: 0,
      yaw: telemetry.heading,
      verticalSpeed: 0,
      gLoad: 1,
    };

    this.flightStates.set(droneId, flightState);
    return flightState;
  }

  // ============================================================================
  // ENVELOPE PROTECTION
  // ============================================================================

  checkEnvelopeCompliance(droneId: string, drone: Drone, telemetry?: Telemetry): EnvelopeCheck {
    const violations: EnvelopeViolation[] = [];
    const warnings: string[] = [];

    // Battery checks
    const battery = telemetry?.batteryLevel ?? drone.batteryLevel;
    if (battery <= this.envelope.batteryThresholds.emergency) {
      violations.push({
        parameter: "battery",
        value: battery,
        limit: this.envelope.batteryThresholds.emergency,
        severity: "critical",
        action: "EMERGENCY_LAND",
      });
    } else if (battery <= this.envelope.batteryThresholds.critical) {
      violations.push({
        parameter: "battery",
        value: battery,
        limit: this.envelope.batteryThresholds.critical,
        severity: "high",
        action: "IMMEDIATE_RTB",
      });
    } else if (battery <= this.envelope.batteryThresholds.warning) {
      warnings.push(`Battery at ${battery}% - RTB recommended`);
    } else if (battery <= this.envelope.batteryThresholds.caution) {
      warnings.push(`Battery at ${battery}% - Monitor closely`);
    }

    // Signal checks
    const signal = telemetry?.signalStrength ?? drone.signalStrength;
    if (signal <= this.envelope.signalThresholds.lost) {
      violations.push({
        parameter: "signal",
        value: signal,
        limit: this.envelope.signalThresholds.lost,
        severity: "critical",
        action: "LOST_LINK_PROCEDURE",
      });
    } else if (signal <= this.envelope.signalThresholds.critical) {
      violations.push({
        parameter: "signal",
        value: signal,
        limit: this.envelope.signalThresholds.critical,
        severity: "high",
        action: "INCREASE_ALTITUDE",
      });
    } else if (signal <= this.envelope.signalThresholds.degraded) {
      warnings.push(`Signal degraded at ${signal}%`);
    }

    // Altitude checks
    if (telemetry) {
      if (telemetry.altitude > this.envelope.altitude.ceiling) {
        violations.push({
          parameter: "altitude",
          value: telemetry.altitude,
          limit: this.envelope.altitude.ceiling,
          severity: "high",
          action: "DESCEND_IMMEDIATELY",
        });
      } else if (telemetry.altitude < this.envelope.altitude.min) {
        violations.push({
          parameter: "altitude",
          value: telemetry.altitude,
          limit: this.envelope.altitude.min,
          severity: "high",
          action: "CLIMB_IMMEDIATELY",
        });
      }
    }

    // GPS check
    if (!drone.gpsLock) {
      warnings.push("GPS lock lost - navigation accuracy degraded");
    }

    // Determine overall status
    let status: EnvelopeCheck["status"] = "nominal";
    if (violations.some(v => v.severity === "critical")) {
      status = "critical";
    } else if (violations.length > 0) {
      status = "warning";
    } else if (warnings.length > 0) {
      status = "caution";
    }

    // Update control state
    const controlState = this.getControlState(droneId);
    controlState.envelopeStatus = status;
    this.controlState.set(droneId, controlState);

    return {
      droneId,
      timestamp: new Date(),
      status,
      violations,
      warnings,
      recommendedAction: violations.length > 0 ? violations[0].action : null,
    };
  }

  // ============================================================================
  // AUTONOMOUS CONTROL COMMANDS
  // ============================================================================

  executeFlightCommand(
    droneId: string,
    command: FlightCommandType,
    parameters: Record<string, unknown>
  ): FlightCommandResult {
    const controlState = this.getControlState(droneId);
    
    // Record command
    const flightCommand: FlightCommand = {
      id: `CMD-${Date.now()}`,
      droneId,
      command,
      parameters,
      timestamp: new Date(),
      source: controlState.authority,
      status: "pending",
    };

    // Validate command against current state
    const validation = this.validateCommand(droneId, command, parameters);
    if (!validation.valid) {
      flightCommand.status = "rejected";
      flightCommand.rejectionReason = validation.reason;
      this.commandHistory.push(flightCommand);
      
      return {
        success: false,
        commandId: flightCommand.id,
        message: validation.reason,
        executedAt: new Date(),
      };
    }

    // Execute command
    switch (command) {
      case "SET_MODE":
        this.setFlightMode(droneId, parameters.mode as FlightMode);
        break;
      case "ENGAGE_AUTOPILOT":
        controlState.autopilotEngaged = true;
        controlState.authority = "cyrus";
        break;
      case "DISENGAGE_AUTOPILOT":
        controlState.autopilotEngaged = false;
        controlState.authority = "pilot";
        break;
      case "SET_ALTITUDE":
        this.queueManeuver(droneId, {
          id: `MAN-${Date.now()}`,
          type: parameters.altitude as number > (this.flightStates.get(droneId)?.altitude || 0) ? "climb" : "descend",
          targetState: { altitude: parameters.altitude as number },
          startTime: new Date(),
          estimatedDuration: 60,
          priority: "routine",
          progress: 0,
        });
        break;
      case "SET_HEADING":
        this.queueManeuver(droneId, {
          id: `MAN-${Date.now()}`,
          type: "turn",
          targetState: { heading: parameters.heading as number },
          startTime: new Date(),
          estimatedDuration: 30,
          priority: "routine",
          progress: 0,
        });
        break;
      case "SET_SPEED":
        this.queueManeuver(droneId, {
          id: `MAN-${Date.now()}`,
          type: parameters.speed as number > (this.flightStates.get(droneId)?.airspeed || 0) ? "accelerate" : "decelerate",
          targetState: { airspeed: parameters.speed as number },
          startTime: new Date(),
          estimatedDuration: 20,
          priority: "routine",
          progress: 0,
        });
        break;
      case "INITIATE_RTB":
        this.setFlightMode(droneId, parameters.emergency ? "emergency_rtb" : "rtb");
        break;
      case "ENTER_HOLD":
        this.setHoldPattern(droneId, parameters.pattern as HoldPattern);
        break;
      case "EXECUTE_EVASIVE":
        this.executeEvasiveManeuver(droneId);
        break;
    }

    flightCommand.status = "executed";
    this.commandHistory.push(flightCommand);
    this.controlState.set(droneId, controlState);

    return {
      success: true,
      commandId: flightCommand.id,
      message: `Command ${command} executed successfully`,
      executedAt: new Date(),
    };
  }

  private validateCommand(
    droneId: string,
    command: FlightCommandType,
    parameters: Record<string, unknown>
  ): { valid: boolean; reason: string } {
    const controlState = this.getControlState(droneId);

    // Emergency mode restricts some commands
    if (controlState.mode === "emergency_land" && command !== "DISENGAGE_AUTOPILOT") {
      return { valid: false, reason: "Cannot execute commands during emergency landing" };
    }

    // Validate altitude commands against envelope
    if (command === "SET_ALTITUDE") {
      const altitude = parameters.altitude as number;
      if (altitude > this.envelope.altitude.ceiling) {
        return { valid: false, reason: `Altitude ${altitude}m exceeds ceiling of ${this.envelope.altitude.ceiling}m` };
      }
      if (altitude < this.envelope.altitude.min) {
        return { valid: false, reason: `Altitude ${altitude}m below minimum of ${this.envelope.altitude.min}m` };
      }
    }

    // Validate speed commands
    if (command === "SET_SPEED") {
      const speed = parameters.speed as number;
      if (speed > this.envelope.speed.max) {
        return { valid: false, reason: `Speed ${speed}m/s exceeds maximum of ${this.envelope.speed.max}m/s` };
      }
      if (speed < this.envelope.speed.min) {
        return { valid: false, reason: `Speed ${speed}m/s below stall speed of ${this.envelope.speed.min}m/s` };
      }
    }

    return { valid: true, reason: "" };
  }

  private setFlightMode(droneId: string, mode: FlightMode): void {
    const controlState = this.getControlState(droneId);
    controlState.mode = mode;

    // Adjust authority based on mode
    if (mode === "autonomous" || mode === "waypoint_nav" || mode === "rtb" || mode.startsWith("emergency")) {
      controlState.authority = "cyrus";
      controlState.autopilotEngaged = true;
    } else if (mode === "manual") {
      controlState.authority = "pilot";
      controlState.autopilotEngaged = false;
    }

    this.controlState.set(droneId, controlState);
  }

  private setHoldPattern(droneId: string, pattern: HoldPattern): void {
    const controlState = this.getControlState(droneId);
    controlState.holdPattern = pattern;
    controlState.mode = "loiter";
    this.controlState.set(droneId, controlState);
  }

  private queueManeuver(droneId: string, maneuver: Maneuver): void {
    if (!this.maneuverQueue.has(droneId)) {
      this.maneuverQueue.set(droneId, []);
    }
    this.maneuverQueue.get(droneId)!.push(maneuver);
    
    const controlState = this.getControlState(droneId);
    if (!controlState.activeManeuver) {
      controlState.activeManeuver = maneuver;
    }
    this.controlState.set(droneId, controlState);
  }

  private executeEvasiveManeuver(droneId: string): void {
    const maneuver: Maneuver = {
      id: `MAN-EVASIVE-${Date.now()}`,
      type: "evasive",
      targetState: {},
      startTime: new Date(),
      estimatedDuration: 15,
      priority: "emergency",
      progress: 0,
    };
    this.queueManeuver(droneId, maneuver);
  }

  // ============================================================================
  // GRACEFUL DEGRADATION
  // ============================================================================

  handleDegradation(droneId: string, trigger: string): DegradationResponse {
    const strategy = this.degradationStrategies.find(s => s.trigger === trigger);
    const controlState = this.getControlState(droneId);

    if (!strategy) {
      return {
        handled: false,
        trigger,
        message: `Unknown degradation trigger: ${trigger}`,
        actions: [],
        level: 0,
      };
    }

    // Update degradation level
    controlState.degradationLevel = Math.max(controlState.degradationLevel, strategy.level);

    // Execute actions
    const executedActions: string[] = [];
    for (const action of strategy.actions) {
      this.executeDegradationAction(droneId, action);
      executedActions.push(action);
    }

    this.controlState.set(droneId, controlState);

    return {
      handled: true,
      trigger,
      message: strategy.missionImpact,
      actions: executedActions,
      level: strategy.level,
      recoverable: strategy.recoverable,
    };
  }

  private executeDegradationAction(droneId: string, action: string): void {
    switch (action) {
      case "INITIATE_RTB":
        this.setFlightMode(droneId, "rtb");
        break;
      case "AUTONOMOUS_RTB":
        this.setFlightMode(droneId, "emergency_rtb");
        break;
      case "MINIMUM_POWER_MODE":
        // Would reduce non-essential systems
        break;
      case "SWITCH_TO_INS":
        this.setFlightMode(droneId, "gps_denied");
        break;
      case "EXECUTE_LOST_LINK":
        this.executeFlightCommand(droneId, "INITIATE_RTB", { emergency: false });
        break;
      case "BEST_GLIDE":
        // Would configure for best glide speed
        break;
      case "SELECT_LANDING_SITE":
        this.setFlightMode(droneId, "emergency_land");
        break;
    }
  }

  // ============================================================================
  // INTEGRATION WITH CYRUS COGNITIVE CORE
  // ============================================================================

  processDecision(droneId: string, decision: Decision): FlightCommandResult[] {
    const results: FlightCommandResult[] = [];

    // Map decision actions to flight commands
    switch (decision.action) {
      case "INITIATE_EMERGENCY_PROTOCOL":
        results.push(this.executeFlightCommand(droneId, "INITIATE_RTB", { emergency: true }));
        break;
      case "EVASIVE_MANEUVER":
        results.push(this.executeFlightCommand(droneId, "EXECUTE_EVASIVE", {}));
        break;
      case "RTB_IMMEDIATE":
        results.push(this.executeFlightCommand(droneId, "INITIATE_RTB", { emergency: true }));
        break;
      case "RTB_PLANNED":
        results.push(this.executeFlightCommand(droneId, "INITIATE_RTB", { emergency: false }));
        break;
      case "CONTINUE_MISSION":
        // No immediate action needed, continue current operations
        break;
      case "MAINTAIN_STATION":
        results.push(this.executeFlightCommand(droneId, "SET_MODE", { mode: "loiter" }));
        break;
    }

    return results;
  }

  // ============================================================================
  // STATUS REPORTING
  // ============================================================================

  getFlightStatus(droneId: string): FlightStatus {
    const controlState = this.getControlState(droneId);
    const flightState = this.flightStates.get(droneId);
    const maneuvers = this.maneuverQueue.get(droneId) || [];

    return {
      droneId,
      controlState,
      flightState: flightState || null,
      queuedManeuvers: maneuvers.length,
      envelope: this.envelope,
      commandHistory: this.commandHistory.filter(c => c.droneId === droneId).slice(-10),
    };
  }

  getCommandHistory(droneId?: string, limit = 50): FlightCommand[] {
    let history = this.commandHistory;
    if (droneId) {
      history = history.filter(c => c.droneId === droneId);
    }
    return history.slice(-limit);
  }
}

// ============================================================================
// TYPES
// ============================================================================

export type FlightCommandType = 
  | "SET_MODE"
  | "ENGAGE_AUTOPILOT"
  | "DISENGAGE_AUTOPILOT"
  | "SET_ALTITUDE"
  | "SET_HEADING"
  | "SET_SPEED"
  | "INITIATE_RTB"
  | "ENTER_HOLD"
  | "EXECUTE_EVASIVE"
  | "ABORT_MISSION";

export interface FlightCommand {
  id: string;
  droneId: string;
  command: FlightCommandType;
  parameters: Record<string, unknown>;
  timestamp: Date;
  source: FlightControlState["authority"];
  status: "pending" | "executed" | "rejected" | "failed";
  rejectionReason?: string;
}

export interface FlightCommandResult {
  success: boolean;
  commandId: string;
  message: string;
  executedAt: Date;
}

export interface EnvelopeCheck {
  droneId: string;
  timestamp: Date;
  status: "nominal" | "caution" | "warning" | "critical";
  violations: EnvelopeViolation[];
  warnings: string[];
  recommendedAction: string | null;
}

export interface EnvelopeViolation {
  parameter: string;
  value: number;
  limit: number;
  severity: "low" | "medium" | "high" | "critical";
  action: string;
}

export interface DegradationResponse {
  handled: boolean;
  trigger: string;
  message: string;
  actions: string[];
  level: number;
  recoverable?: boolean;
}

export interface FlightStatus {
  droneId: string;
  controlState: FlightControlState;
  flightState: FlightState | null;
  queuedManeuvers: number;
  envelope: FlightEnvelope;
  commandHistory: FlightCommand[];
}

// Export singleton instance
export const flightControlEngine = new FlightControlEngine();
