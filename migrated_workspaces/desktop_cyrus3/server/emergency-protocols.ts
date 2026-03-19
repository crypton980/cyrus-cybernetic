import { Drone, Mission, Alert } from "@shared/schema";
import { autonomousEngine, AutonomousDecision } from "./autonomous-engine";
import { cyrusInferAsync } from "./cyrus-ai";

export type EmergencyType = 
  | "battery_critical"
  | "signal_lost"
  | "gps_lost"
  | "collision_imminent"
  | "subsystem_failure"
  | "weather_emergency"
  | "restricted_airspace"
  | "operator_emergency"
  | "link_degraded";

export interface EmergencyProtocol {
  type: EmergencyType;
  priority: 1 | 2 | 3 | 4 | 5;
  name: string;
  actions: EmergencyAction[];
  conditions: string[];
  timeout: number;
}

export interface EmergencyAction {
  step: number;
  action: string;
  command: string;
  parameters: Record<string, unknown>;
  critical: boolean;
}

export interface EmergencyResponse {
  id: string;
  type: EmergencyType;
  droneId: string;
  timestamp: Date;
  protocol: EmergencyProtocol;
  actions: {
    step: number;
    action: string;
    status: "pending" | "executing" | "completed" | "failed";
    result?: string;
  }[];
  status: "initiated" | "in_progress" | "resolved" | "escalated";
  aiAnalysis?: string;
}

const EMERGENCY_PROTOCOLS: EmergencyProtocol[] = [
  {
    type: "battery_critical",
    priority: 1,
    name: "Critical Battery Emergency RTB",
    conditions: ["Battery level below 15%", "Insufficient power for current mission"],
    timeout: 60,
    actions: [
      { step: 1, action: "Abort current mission", command: "MISSION_ABORT", parameters: {}, critical: true },
      { step: 2, action: "Calculate direct RTB route", command: "CALC_DIRECT_RTB", parameters: { avoidObstacles: true }, critical: true },
      { step: 3, action: "Set minimum power mode", command: "SET_POWER_MODE", parameters: { mode: "minimum" }, critical: true },
      { step: 4, action: "Transmit mayday beacon", command: "MAYDAY_BEACON", parameters: { frequency: "emergency" }, critical: false },
      { step: 5, action: "Execute emergency landing if RTB not possible", command: "EMERGENCY_LAND", parameters: { closest: true }, critical: true }
    ]
  },
  {
    type: "signal_lost",
    priority: 2,
    name: "Communication Link Lost Protocol",
    conditions: ["Signal strength below 10%", "No contact for 30 seconds"],
    timeout: 120,
    actions: [
      { step: 1, action: "Switch to backup frequency", command: "SWITCH_FREQ", parameters: { frequency: "backup" }, critical: true },
      { step: 2, action: "Climb to signal altitude", command: "CLIMB", parameters: { altitude: 500, rate: 5 }, critical: true },
      { step: 3, action: "Circle for signal recovery", command: "ORBIT", parameters: { radius: 100, duration: 60 }, critical: false },
      { step: 4, action: "Initiate autonomous RTB", command: "AUTO_RTB", parameters: { useLastKnownRoute: true }, critical: true },
      { step: 5, action: "Broadcast location beacon", command: "LOCATION_BEACON", parameters: { interval: 10 }, critical: true }
    ]
  },
  {
    type: "gps_lost",
    priority: 2,
    name: "GPS Navigation Lost Protocol",
    conditions: ["GPS lock lost", "Navigation uncertainty high"],
    timeout: 90,
    actions: [
      { step: 1, action: "Enable hover hold", command: "HOVER_HOLD", parameters: { duration: 30 }, critical: true },
      { step: 2, action: "Switch to inertial navigation", command: "NAV_MODE", parameters: { mode: "inertial" }, critical: true },
      { step: 3, action: "Reduce altitude for visual reference", command: "DESCEND", parameters: { altitude: 100 }, critical: false },
      { step: 4, action: "Attempt GPS reacquisition", command: "GPS_REACQUIRE", parameters: { timeout: 60 }, critical: true },
      { step: 5, action: "Execute controlled landing if GPS not recovered", command: "CONTROLLED_LAND", parameters: {}, critical: true }
    ]
  },
  {
    type: "collision_imminent",
    priority: 1,
    name: "Collision Avoidance Emergency",
    conditions: ["Object detected within safe distance", "Immediate evasive action required"],
    timeout: 10,
    actions: [
      { step: 1, action: "Execute immediate evasion", command: "EVADE", parameters: { direction: "auto", intensity: "maximum" }, critical: true },
      { step: 2, action: "Climb to safe altitude", command: "EMERGENCY_CLIMB", parameters: { rate: 10, duration: 5 }, critical: true },
      { step: 3, action: "Scan for additional threats", command: "THREAT_SCAN", parameters: { range: 500 }, critical: true },
      { step: 4, action: "Report incident", command: "INCIDENT_REPORT", parameters: { type: "near_miss" }, critical: false },
      { step: 5, action: "Resume mission or RTB", command: "EVALUATE_CONTINUE", parameters: {}, critical: false }
    ]
  },
  {
    type: "subsystem_failure",
    priority: 2,
    name: "Subsystem Failure Response",
    conditions: ["Critical subsystem offline", "Reduced capability detected"],
    timeout: 120,
    actions: [
      { step: 1, action: "Isolate failed subsystem", command: "ISOLATE_SUBSYSTEM", parameters: { auto: true }, critical: true },
      { step: 2, action: "Switch to redundant system", command: "ENABLE_REDUNDANCY", parameters: {}, critical: true },
      { step: 3, action: "Assess mission viability", command: "MISSION_ASSESS", parameters: {}, critical: true },
      { step: 4, action: "Reduce operational envelope", command: "REDUCE_ENVELOPE", parameters: { safetyMargin: 1.5 }, critical: false },
      { step: 5, action: "Continue or abort based on assessment", command: "DECISION_EXECUTE", parameters: {}, critical: true }
    ]
  },
  {
    type: "weather_emergency",
    priority: 3,
    name: "Adverse Weather Response",
    conditions: ["High winds detected", "Precipitation affecting sensors", "Visibility reduced"],
    timeout: 180,
    actions: [
      { step: 1, action: "Reduce speed and altitude", command: "REDUCE_PARAMS", parameters: { speedFactor: 0.5, altitudeDelta: -50 }, critical: true },
      { step: 2, action: "Enable weather compensation", command: "WEATHER_COMP", parameters: { mode: "aggressive" }, critical: true },
      { step: 3, action: "Assess weather progression", command: "WEATHER_ASSESS", parameters: {}, critical: false },
      { step: 4, action: "Abort mission if conditions worsen", command: "WEATHER_ABORT_CHECK", parameters: { threshold: "moderate" }, critical: true },
      { step: 5, action: "Seek shelter or RTB", command: "SHELTER_RTB", parameters: {}, critical: true }
    ]
  },
  {
    type: "restricted_airspace",
    priority: 1,
    name: "Restricted Airspace Incursion Response",
    conditions: ["Entered restricted zone", "Airspace violation detected"],
    timeout: 30,
    actions: [
      { step: 1, action: "Immediate stop", command: "FULL_STOP", parameters: {}, critical: true },
      { step: 2, action: "Calculate exit vector", command: "CALC_EXIT", parameters: { method: "shortest" }, critical: true },
      { step: 3, action: "Execute exit maneuver", command: "EXIT_RESTRICTED", parameters: { speed: "maximum_safe" }, critical: true },
      { step: 4, action: "Log violation for reporting", command: "LOG_VIOLATION", parameters: {}, critical: true },
      { step: 5, action: "Notify command", command: "NOTIFY_COMMAND", parameters: { priority: "urgent" }, critical: true }
    ]
  },
  {
    type: "link_degraded",
    priority: 3,
    name: "Degraded Link Protocol",
    conditions: ["Signal strength below 40%", "Packet loss detected"],
    timeout: 300,
    actions: [
      { step: 1, action: "Increase transmission power", command: "BOOST_TX", parameters: { power: 1.5 }, critical: true },
      { step: 2, action: "Reduce data rate", command: "REDUCE_DATARATE", parameters: { mode: "essential" }, critical: false },
      { step: 3, action: "Move toward base station", command: "MOVE_TOWARD_BASE", parameters: { distance: 500 }, critical: false },
      { step: 4, action: "Enable link recovery mode", command: "LINK_RECOVERY", parameters: {}, critical: true },
      { step: 5, action: "Prepare for autonomous operation", command: "PREP_AUTONOMOUS", parameters: {}, critical: false }
    ]
  }
];

export class EmergencyResponseEngine {
  private activeResponses: Map<string, EmergencyResponse> = new Map();
  private responseHistory: EmergencyResponse[] = [];

  detectEmergency(drone: Drone, telemetry?: { 
    batteryLevel: number; 
    signalStrength: number; 
    gpsLock: boolean;
    subsystems?: Record<string, string>;
  }): EmergencyType | null {
    const battery = telemetry?.batteryLevel ?? drone.batteryLevel;
    const signal = telemetry?.signalStrength ?? drone.signalStrength;
    const gps = telemetry?.gpsLock ?? drone.gpsLock;

    if (battery < 15) return "battery_critical";
    if (signal < 10) return "signal_lost";
    if (!gps) return "gps_lost";

    if (telemetry?.subsystems) {
      const criticalSystems = Object.entries(telemetry.subsystems)
        .filter(([_, status]) => status === "critical" || status === "offline");
      if (criticalSystems.length > 0) return "subsystem_failure";
    }

    if (signal < 40) return "link_degraded";

    return null;
  }

  initiateEmergencyResponse(
    droneId: string,
    emergencyType: EmergencyType
  ): EmergencyResponse {
    const protocol = EMERGENCY_PROTOCOLS.find(p => p.type === emergencyType);
    if (!protocol) {
      throw new Error(`Unknown emergency type: ${emergencyType}`);
    }

    const response: EmergencyResponse = {
      id: `ER-${Date.now()}-${droneId.slice(0, 8)}`,
      type: emergencyType,
      droneId,
      timestamp: new Date(),
      protocol,
      actions: protocol.actions.map(a => ({
        step: a.step,
        action: a.action,
        status: "pending" as const
      })),
      status: "initiated"
    };

    this.activeResponses.set(response.id, response);
    return response;
  }

  async executeEmergencyStep(
    responseId: string,
    stepNumber: number
  ): Promise<{ success: boolean; result: string }> {
    const response = this.activeResponses.get(responseId);
    if (!response) {
      return { success: false, result: "Response not found" };
    }

    const action = response.actions.find(a => a.step === stepNumber);
    if (!action) {
      return { success: false, result: "Step not found" };
    }

    action.status = "executing";
    response.status = "in_progress";

    await new Promise(resolve => setTimeout(resolve, 500));

    const success = Math.random() > 0.1;
    action.status = success ? "completed" : "failed";
    action.result = success ? "Executed successfully" : "Execution failed";

    const allCompleted = response.actions.every(a => 
      a.status === "completed" || a.status === "failed"
    );
    if (allCompleted) {
      const anyFailed = response.actions.some(a => a.status === "failed");
      response.status = anyFailed ? "escalated" : "resolved";
      this.responseHistory.push(response);
    }

    return { success, result: action.result };
  }

  async executeFullProtocol(droneId: string, emergencyType: EmergencyType): Promise<EmergencyResponse> {
    const response = this.initiateEmergencyResponse(droneId, emergencyType);

    for (const action of response.actions) {
      await this.executeEmergencyStep(response.id, action.step);
      if (action.status === "failed" && response.protocol.actions.find(a => a.step === action.step)?.critical) {
        response.status = "escalated";
        break;
      }
    }

    return response;
  }

  async getAIEmergencyAnalysis(
    drone: Drone,
    emergencyType: EmergencyType
  ): Promise<string> {
    try {
      const result = await cyrusInferAsync(
        `Emergency situation analysis required.
        
        Drone: ${drone.name} (${drone.model})
        Emergency Type: ${emergencyType}
        Battery: ${drone.batteryLevel}%
        Signal: ${drone.signalStrength}%
        GPS Lock: ${drone.gpsLock}
        Status: ${drone.status}
        
        Provide tactical assessment and immediate action recommendations.`,
        { drone_name: drone.name }
      );

      return result.result.answer;
    } catch {
      return `Standard ${emergencyType} protocol in effect. Execute emergency procedures.`;
    }
  }

  getActiveResponses(): EmergencyResponse[] {
    return Array.from(this.activeResponses.values());
  }

  getResponseHistory(): EmergencyResponse[] {
    return [...this.responseHistory];
  }

  getProtocol(type: EmergencyType): EmergencyProtocol | undefined {
    return EMERGENCY_PROTOCOLS.find(p => p.type === type);
  }

  getAllProtocols(): EmergencyProtocol[] {
    return [...EMERGENCY_PROTOCOLS];
  }

  resolveEmergency(responseId: string): boolean {
    const response = this.activeResponses.get(responseId);
    if (response) {
      response.status = "resolved";
      this.responseHistory.push(response);
      this.activeResponses.delete(responseId);
      return true;
    }
    return false;
  }
}

export const emergencyEngine = new EmergencyResponseEngine();
