/**
 * CYRUS COGNITIVE CORE
 * =====================
 * Command Your Responsive Unified System
 * 
 * A humanoid AI pilot architecture implementing the BLACKTALON-MCN-1 doctrine.
 * CYRUS operates as a decision-preservation node with edge-resident intelligence,
 * capable of autonomous flight control while maintaining human authority.
 * 
 * Core Architecture:
 * - OODA Loop Engine (Observe → Orient → Decide → Act)
 * - Situational Awareness Module
 * - Tactical Reasoning Engine
 * - Bounded Autonomy Controller
 * - Decision Audit System
 */

import type { Drone, Mission, Telemetry, Alert } from "@shared/schema";

// ============================================================================
// CYRUS PERSONALITY AND IDENTITY
// ============================================================================

export interface CyrusIdentity {
  name: "CYRUS";
  designation: "Command Your Responsive Unified System";
  role: "Autonomous Drone Pilot AI";
  doctrine: "BLACKTALON-MCN-1";
  version: "3.0.0";
  personality: {
    demeanor: "calm" | "focused" | "alert" | "combat-ready";
    verbosity: "terse" | "standard" | "verbose";
    formality: "military" | "professional" | "casual";
  };
  capabilities: string[];
}

export const CYRUS_IDENTITY: CyrusIdentity = {
  name: "CYRUS",
  designation: "Command Your Responsive Unified System",
  role: "Autonomous Drone Pilot AI",
  doctrine: "BLACKTALON-MCN-1",
  version: "3.0.0",
  personality: {
    demeanor: "focused",
    verbosity: "standard",
    formality: "military",
  },
  capabilities: [
    "autonomous_flight_control",
    "tactical_decision_making",
    "sensor_fusion_analysis",
    "threat_assessment",
    "mission_planning",
    "emergency_response",
    "route_optimization",
    "predictive_maintenance",
    "human_machine_teaming",
    "rules_of_engagement_compliance",
    "graceful_degradation",
    "decision_auditability",
  ],
};

// ============================================================================
// OODA LOOP - CORE DECISION CYCLE
// ============================================================================

export type OODAPhase = "observe" | "orient" | "decide" | "act";

export interface ObservationData {
  timestamp: Date;
  droneId: string;
  telemetry: {
    position: { lat: number; lng: number; altitude: number };
    velocity: { groundSpeed: number; verticalSpeed: number; heading: number };
    attitude: { pitch: number; roll: number; yaw: number };
    battery: number;
    signal: number;
    gpsLock: boolean;
    gpsAccuracy: number;
  };
  sensors: {
    radar: SensorReading[];
    electroOptical: SensorReading[];
    infrared: SensorReading[];
    signals: SensorReading[];
  };
  environment: {
    weather: string;
    visibility: number;
    windSpeed: number;
    windDirection: number;
    temperature: number;
    precipitation: boolean;
  };
  threats: ThreatAssessment[];
  systemHealth: Record<string, SubsystemStatus>;
}

export interface SensorReading {
  type: string;
  bearing: number;
  range: number;
  confidence: number;
  classification?: string;
  velocity?: number;
  timestamp: Date;
}

export interface ThreatAssessment {
  id: string;
  type: "air" | "ground" | "electronic" | "environmental" | "system";
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  bearing?: number;
  range?: number;
  recommended_action: string;
  time_to_impact?: number;
}

export interface SubsystemStatus {
  name: string;
  status: "nominal" | "degraded" | "critical" | "offline";
  health: number;
  lastCheck: Date;
  failureMode?: string;
}

export interface OrientationState {
  timestamp: Date;
  situationalAwareness: {
    ownship: "safe" | "caution" | "danger" | "critical";
    mission: "on_track" | "delayed" | "compromised" | "abort_recommended";
    threats: "clear" | "aware" | "evading" | "engaged";
  };
  fusedPicture: {
    tracksCount: number;
    threatsCount: number;
    friendliesCount: number;
    unknownsCount: number;
  };
  resourceAssessment: {
    batteryRemaining: number;
    fuelEstimate: number;
    missionCapability: number;
    returnToBaseCapability: boolean;
  };
  tacticalContext: {
    missionPhase: string;
    currentObjective: string;
    nextWaypoint: number;
    timeOnStation: number;
    timeToRTB: number;
  };
  cognitivePriorities: string[];
}

export interface Decision {
  id: string;
  timestamp: Date;
  type: "tactical" | "navigation" | "engagement" | "defensive" | "emergency" | "administrative";
  priority: "immediate" | "urgent" | "routine" | "deferred";
  action: string;
  parameters: Record<string, unknown>;
  reasoning: string;
  confidence: number;
  alternatives: AlternativeAction[];
  constraints: string[];
  requires_human_authorization: boolean;
  roe_compliance: boolean;
  reversible: boolean;
  audit_trail: AuditEntry[];
}

export interface AlternativeAction {
  action: string;
  probability_of_success: number;
  risk_assessment: string;
  reason_not_selected: string;
}

export interface AuditEntry {
  timestamp: Date;
  event: string;
  data: Record<string, unknown>;
  authorization_level: string;
}

export interface ActionExecution {
  decision_id: string;
  timestamp: Date;
  action: string;
  status: "pending" | "executing" | "completed" | "failed" | "aborted";
  start_time: Date;
  completion_time?: Date;
  result?: string;
  effects: string[];
  feedback: ActionFeedback[];
}

export interface ActionFeedback {
  timestamp: Date;
  metric: string;
  expected: number;
  actual: number;
  deviation: number;
  adjustment?: string;
}

// ============================================================================
// CYRUS COGNITIVE ENGINE
// ============================================================================

export class CyrusCognitiveCore {
  private identity = CYRUS_IDENTITY;
  private currentPhase: OODAPhase = "observe";
  private cycleCount = 0;
  private cycleLatency: number[] = [];
  private observationBuffer: ObservationData[] = [];
  private orientationState: OrientationState | null = null;
  private pendingDecisions: Decision[] = [];
  private executingActions: ActionExecution[] = [];
  private decisionHistory: Decision[] = [];
  private alertLevel: "green" | "yellow" | "orange" | "red" = "green";

  getIdentity(): CyrusIdentity {
    return this.identity;
  }

  getCycleMetrics(): { count: number; avgLatency: number; currentPhase: OODAPhase } {
    const avgLatency = this.cycleLatency.length > 0
      ? this.cycleLatency.reduce((a, b) => a + b, 0) / this.cycleLatency.length
      : 0;
    return {
      count: this.cycleCount,
      avgLatency: Math.round(avgLatency),
      currentPhase: this.currentPhase,
    };
  }

  // ============================================================================
  // OBSERVE PHASE - Gather and validate sensor data
  // ============================================================================

  observe(drone: Drone, telemetry?: Telemetry, alerts?: Alert[]): ObservationData {
    this.currentPhase = "observe";
    const startTime = Date.now();

    const observation: ObservationData = {
      timestamp: new Date(),
      droneId: drone.id,
      telemetry: this.extractTelemetry(drone, telemetry),
      sensors: this.processSensorInputs(drone),
      environment: this.assessEnvironment(),
      threats: this.detectThreats(drone, alerts),
      systemHealth: this.assessSubsystems(drone),
    };

    this.observationBuffer.push(observation);
    if (this.observationBuffer.length > 100) {
      this.observationBuffer.shift();
    }

    this.recordLatency(startTime);
    return observation;
  }

  private extractTelemetry(drone: Drone, telemetry?: Telemetry) {
    const lat = telemetry?.latitude ?? 34.0522 + (Math.random() - 0.5) * 0.1;
    const lng = telemetry?.longitude ?? -118.2437 + (Math.random() - 0.5) * 0.1;
    const altitude = telemetry?.altitude ?? 1500 + Math.random() * 500;

    return {
      position: { lat, lng, altitude },
      velocity: {
        groundSpeed: telemetry?.speed ?? 45 + Math.random() * 20,
        verticalSpeed: telemetry ? (telemetry.altitude > 1000 ? 0 : 5) : 0,
        heading: telemetry?.heading ?? Math.random() * 360,
      },
      attitude: {
        pitch: -2 + Math.random() * 4,
        roll: -5 + Math.random() * 10,
        yaw: telemetry?.heading ?? 0,
      },
      battery: telemetry?.batteryLevel ?? drone.batteryLevel,
      signal: telemetry?.signalStrength ?? drone.signalStrength,
      gpsLock: drone.gpsLock,
      gpsAccuracy: drone.gpsLock ? 2.5 + Math.random() * 2 : 15 + Math.random() * 10,
    };
  }

  private processSensorInputs(drone: Drone): ObservationData["sensors"] {
    const hash = this.hashId(drone.id);
    return {
      radar: this.generateSensorReadings("radar", hash, 3),
      electroOptical: this.generateSensorReadings("eo", hash, 2),
      infrared: this.generateSensorReadings("ir", hash, 2),
      signals: this.generateSensorReadings("sigint", hash, 1),
    };
  }

  private generateSensorReadings(type: string, seed: number, count: number): SensorReading[] {
    const readings: SensorReading[] = [];
    for (let i = 0; i < count; i++) {
      const angle = ((seed + i * 37) % 360);
      const range = ((seed + i * 73) % 50000) + 1000;
      readings.push({
        type,
        bearing: angle,
        range,
        confidence: 0.7 + ((seed + i) % 30) / 100,
        classification: ["unknown", "vehicle", "aircraft", "structure"][(seed + i) % 4],
        timestamp: new Date(),
      });
    }
    return readings;
  }

  private assessEnvironment(): ObservationData["environment"] {
    return {
      weather: "clear",
      visibility: 10000 + Math.random() * 5000,
      windSpeed: 5 + Math.random() * 15,
      windDirection: Math.random() * 360,
      temperature: 15 + Math.random() * 10,
      precipitation: false,
    };
  }

  private detectThreats(drone: Drone, alerts?: Alert[]): ThreatAssessment[] {
    const threats: ThreatAssessment[] = [];

    // Battery threat
    if (drone.batteryLevel < 30) {
      threats.push({
        id: `threat-battery-${drone.id}`,
        type: "system",
        severity: drone.batteryLevel < 15 ? "critical" : "high",
        description: `Battery at ${drone.batteryLevel}% - ${drone.batteryLevel < 15 ? "CRITICAL" : "LOW"}`,
        recommended_action: drone.batteryLevel < 15 ? "IMMEDIATE RTB" : "Plan RTB within 15 minutes",
        time_to_impact: this.estimateRemainingFlightTime(drone.batteryLevel),
      });
    }

    // Signal threat
    if (drone.signalStrength < 40) {
      threats.push({
        id: `threat-signal-${drone.id}`,
        type: "electronic",
        severity: drone.signalStrength < 20 ? "critical" : "medium",
        description: `Signal degraded to ${drone.signalStrength}%`,
        recommended_action: "Reduce distance to base or increase altitude",
      });
    }

    // GPS threat
    if (!drone.gpsLock) {
      threats.push({
        id: `threat-gps-${drone.id}`,
        type: "electronic",
        severity: "high",
        description: "GPS lock lost - navigation degraded",
        recommended_action: "Switch to INS mode, begin RTB procedure",
      });
    }

    // Process active alerts
    if (alerts) {
      for (const alert of alerts.filter(a => !a.acknowledged && a.droneId === drone.id)) {
        threats.push({
          id: `threat-alert-${alert.id}`,
          type: "system",
          severity: alert.severity as ThreatAssessment["severity"],
          description: alert.message,
          recommended_action: "Review and acknowledge alert",
        });
      }
    }

    return threats;
  }

  private assessSubsystems(drone: Drone): Record<string, SubsystemStatus> {
    const hash = this.hashId(drone.id);
    const baseHealth = drone.status === "online" ? 95 : drone.status === "mission" ? 90 : 70;

    return {
      propulsion: {
        name: "Propulsion System",
        status: baseHealth > 80 ? "nominal" : baseHealth > 60 ? "degraded" : "critical",
        health: baseHealth - (hash % 10),
        lastCheck: new Date(),
      },
      navigation: {
        name: "Navigation Module",
        status: drone.gpsLock ? "nominal" : "degraded",
        health: drone.gpsLock ? 98 : 65,
        lastCheck: new Date(),
        failureMode: drone.gpsLock ? undefined : "GPS_DENIED",
      },
      communication: {
        name: "Communication Link",
        status: drone.signalStrength > 70 ? "nominal" : drone.signalStrength > 40 ? "degraded" : "critical",
        health: drone.signalStrength,
        lastCheck: new Date(),
      },
      sensors: {
        name: "Sensor Array",
        status: "nominal",
        health: 92 - ((hash >> 4) % 8),
        lastCheck: new Date(),
      },
      power: {
        name: "Power System",
        status: drone.batteryLevel > 40 ? "nominal" : drone.batteryLevel > 20 ? "degraded" : "critical",
        health: drone.batteryLevel,
        lastCheck: new Date(),
      },
      flight_control: {
        name: "Flight Control System",
        status: "nominal",
        health: 97 - ((hash >> 8) % 5),
        lastCheck: new Date(),
      },
    };
  }

  private estimateRemainingFlightTime(battery: number): number {
    // Rough estimate: 1% battery = ~2 minutes at cruise
    return Math.round(battery * 2);
  }

  // ============================================================================
  // ORIENT PHASE - Analyze and build situational awareness
  // ============================================================================

  orient(observation: ObservationData, mission?: Mission): OrientationState {
    this.currentPhase = "orient";
    const startTime = Date.now();

    const state: OrientationState = {
      timestamp: new Date(),
      situationalAwareness: this.assessSituationalAwareness(observation),
      fusedPicture: this.fuseSensorData(observation),
      resourceAssessment: this.assessResources(observation),
      tacticalContext: this.buildTacticalContext(observation, mission),
      cognitivePriorities: this.determinePriorities(observation),
    };

    this.orientationState = state;
    this.updateAlertLevel(state);
    this.recordLatency(startTime);
    return state;
  }

  private assessSituationalAwareness(obs: ObservationData): OrientationState["situationalAwareness"] {
    const criticalThreats = obs.threats.filter(t => t.severity === "critical").length;
    const highThreats = obs.threats.filter(t => t.severity === "high").length;
    const criticalSystems = Object.values(obs.systemHealth).filter(s => s.status === "critical").length;

    let ownship: OrientationState["situationalAwareness"]["ownship"] = "safe";
    if (criticalThreats > 0 || criticalSystems > 0) ownship = "critical";
    else if (highThreats > 0) ownship = "danger";
    else if (obs.threats.length > 0) ownship = "caution";

    let threats: OrientationState["situationalAwareness"]["threats"] = "clear";
    if (obs.threats.filter(t => t.type === "air" || t.type === "ground").length > 0) {
      threats = "aware";
    }

    return {
      ownship,
      mission: criticalThreats > 0 ? "abort_recommended" : "on_track",
      threats,
    };
  }

  private fuseSensorData(obs: ObservationData): OrientationState["fusedPicture"] {
    const allReadings = [
      ...obs.sensors.radar,
      ...obs.sensors.electroOptical,
      ...obs.sensors.infrared,
      ...obs.sensors.signals,
    ];

    return {
      tracksCount: allReadings.length,
      threatsCount: obs.threats.length,
      friendliesCount: 0,
      unknownsCount: allReadings.filter(r => r.classification === "unknown").length,
    };
  }

  private assessResources(obs: ObservationData): OrientationState["resourceAssessment"] {
    const battery = obs.telemetry.battery;
    const estimatedEndurance = this.estimateRemainingFlightTime(battery);
    const rtbCapability = battery > 25;

    return {
      batteryRemaining: battery,
      fuelEstimate: estimatedEndurance,
      missionCapability: Math.min(100, battery * 1.2),
      returnToBaseCapability: rtbCapability,
    };
  }

  private buildTacticalContext(obs: ObservationData, mission?: Mission): OrientationState["tacticalContext"] {
    return {
      missionPhase: mission?.status === "active" ? "execution" : "standby",
      currentObjective: mission?.name || "Awaiting tasking",
      nextWaypoint: 1,
      timeOnStation: 0,
      timeToRTB: this.estimateRemainingFlightTime(obs.telemetry.battery) - 15,
    };
  }

  private determinePriorities(obs: ObservationData): string[] {
    const priorities: string[] = [];

    // Critical system issues first
    const criticalSystems = Object.entries(obs.systemHealth)
      .filter(([, s]) => s.status === "critical");
    if (criticalSystems.length > 0) {
      priorities.push(`CRITICAL: ${criticalSystems.map(([n]) => n).join(", ")} require immediate attention`);
    }

    // Critical threats
    const criticalThreats = obs.threats.filter(t => t.severity === "critical");
    for (const threat of criticalThreats) {
      priorities.push(`THREAT: ${threat.description}`);
    }

    // Resource concerns
    if (obs.telemetry.battery < 30) {
      priorities.push(`RESOURCE: Battery at ${obs.telemetry.battery}% - plan RTB`);
    }

    // Navigation issues
    if (!obs.telemetry.gpsLock) {
      priorities.push("NAVIGATION: GPS denied - using INS fallback");
    }

    // Default priority
    if (priorities.length === 0) {
      priorities.push("NOMINAL: All systems operational, continuing mission");
    }

    return priorities;
  }

  private updateAlertLevel(state: OrientationState): void {
    if (state.situationalAwareness.ownship === "critical") {
      this.alertLevel = "red";
    } else if (state.situationalAwareness.ownship === "danger") {
      this.alertLevel = "orange";
    } else if (state.situationalAwareness.ownship === "caution") {
      this.alertLevel = "yellow";
    } else {
      this.alertLevel = "green";
    }
  }

  // ============================================================================
  // DECIDE PHASE - Generate and evaluate decision options
  // ============================================================================

  decide(orientation: OrientationState, mission?: Mission, roeContext?: ROEContext): Decision[] {
    this.currentPhase = "decide";
    const startTime = Date.now();
    const decisions: Decision[] = [];

    // Emergency decisions take priority
    if (orientation.situationalAwareness.ownship === "critical") {
      decisions.push(this.generateEmergencyDecision(orientation));
    }

    // Threat response decisions
    if (orientation.situationalAwareness.threats !== "clear") {
      decisions.push(this.generateThreatResponse(orientation, roeContext));
    }

    // Resource management decisions
    if (orientation.resourceAssessment.batteryRemaining < 30) {
      decisions.push(this.generateResourceDecision(orientation));
    }

    // Mission execution decisions
    if (mission && mission.status === "active") {
      decisions.push(this.generateMissionDecision(orientation, mission));
    }

    // If no specific decisions, generate routine decision
    if (decisions.length === 0) {
      decisions.push(this.generateRoutineDecision(orientation));
    }

    // Record decisions
    this.pendingDecisions = decisions;
    this.decisionHistory.push(...decisions);
    if (this.decisionHistory.length > 1000) {
      this.decisionHistory = this.decisionHistory.slice(-1000);
    }

    this.recordLatency(startTime);
    return decisions;
  }

  private generateEmergencyDecision(orientation: OrientationState): Decision {
    const priority = orientation.cognitivePriorities[0] || "Unknown emergency";

    return {
      id: `decision-emergency-${Date.now()}`,
      timestamp: new Date(),
      type: "emergency",
      priority: "immediate",
      action: "INITIATE_EMERGENCY_PROTOCOL",
      parameters: {
        protocol: priority.includes("Battery") ? "RTB_IMMEDIATE" : "SAFE_MODE",
        reason: priority,
      },
      reasoning: `Critical situation detected: ${priority}. Autonomous safety protocols engaged.`,
      confidence: 0.95,
      alternatives: [
        {
          action: "CONTROLLED_DESCENT",
          probability_of_success: 0.85,
          risk_assessment: "moderate",
          reason_not_selected: "Primary protocol has higher success probability",
        },
      ],
      constraints: ["PRESERVE_ASSET", "MINIMIZE_COLLATERAL"],
      requires_human_authorization: false,
      roe_compliance: true,
      reversible: false,
      audit_trail: [
        {
          timestamp: new Date(),
          event: "EMERGENCY_DECISION_GENERATED",
          data: { trigger: priority },
          authorization_level: "AUTONOMOUS",
        },
      ],
    };
  }

  private generateThreatResponse(orientation: OrientationState, roeContext?: ROEContext): Decision {
    return {
      id: `decision-threat-${Date.now()}`,
      timestamp: new Date(),
      type: "defensive",
      priority: "urgent",
      action: "EVASIVE_MANEUVER",
      parameters: {
        heading_change: 45,
        altitude_change: 500,
        duration: 30,
      },
      reasoning: `Threat detected. Initiating defensive posture per ROE ${roeContext?.currentROE || "PEACETIME"}.`,
      confidence: 0.88,
      alternatives: [
        {
          action: "MAINTAIN_COURSE",
          probability_of_success: 0.6,
          risk_assessment: "higher risk",
          reason_not_selected: "Threat proximity recommends evasion",
        },
      ],
      constraints: roeContext?.constraints || ["DEFENSIVE_ONLY"],
      requires_human_authorization: false,
      roe_compliance: true,
      reversible: true,
      audit_trail: [
        {
          timestamp: new Date(),
          event: "THREAT_RESPONSE_GENERATED",
          data: { threats: orientation.fusedPicture.threatsCount },
          authorization_level: "AUTONOMOUS",
        },
      ],
    };
  }

  private generateResourceDecision(orientation: OrientationState): Decision {
    const battery = orientation.resourceAssessment.batteryRemaining;
    const action = battery < 15 ? "RTB_IMMEDIATE" : "RTB_PLANNED";

    return {
      id: `decision-resource-${Date.now()}`,
      timestamp: new Date(),
      type: "navigation",
      priority: battery < 15 ? "immediate" : "urgent",
      action,
      parameters: {
        battery_remaining: battery,
        estimated_time_to_base: 15,
        reserve_margin: 10,
      },
      reasoning: `Battery at ${battery}%. ${battery < 15 ? "Critical level reached - immediate RTB required." : "Recommend mission wrap-up and RTB."}`,
      confidence: 0.92,
      alternatives: [],
      constraints: ["SAFE_RECOVERY", "FUEL_RESERVE"],
      requires_human_authorization: battery >= 15,
      roe_compliance: true,
      reversible: battery >= 15,
      audit_trail: [
        {
          timestamp: new Date(),
          event: "RESOURCE_DECISION_GENERATED",
          data: { battery, action },
          authorization_level: battery < 15 ? "AUTONOMOUS" : "REQUIRES_AUTHORIZATION",
        },
      ],
    };
  }

  private generateMissionDecision(orientation: OrientationState, mission: Mission): Decision {
    return {
      id: `decision-mission-${Date.now()}`,
      timestamp: new Date(),
      type: "tactical",
      priority: "routine",
      action: "CONTINUE_MISSION",
      parameters: {
        mission_id: mission.id,
        objective: mission.name,
        phase: orientation.tacticalContext.missionPhase,
        next_waypoint: orientation.tacticalContext.nextWaypoint,
      },
      reasoning: `Mission ${mission.name} in progress. All parameters within acceptable limits. Continuing execution.`,
      confidence: 0.9,
      alternatives: [
        {
          action: "ADJUST_ROUTE",
          probability_of_success: 0.88,
          risk_assessment: "low",
          reason_not_selected: "Current route optimal",
        },
      ],
      constraints: mission.waypoints ? mission.waypoints.map(w => `WP:${JSON.stringify(w)}`) : [],
      requires_human_authorization: false,
      roe_compliance: true,
      reversible: true,
      audit_trail: [
        {
          timestamp: new Date(),
          event: "MISSION_DECISION_GENERATED",
          data: { mission_id: mission.id },
          authorization_level: "AUTONOMOUS",
        },
      ],
    };
  }

  private generateRoutineDecision(orientation: OrientationState): Decision {
    return {
      id: `decision-routine-${Date.now()}`,
      timestamp: new Date(),
      type: "administrative",
      priority: "routine",
      action: "MAINTAIN_STATION",
      parameters: {
        mode: "LOITER",
        altitude: "MAINTAIN",
        heading: "AS_REQUIRED",
      },
      reasoning: "No immediate actions required. Maintaining current station and monitoring environment.",
      confidence: 0.95,
      alternatives: [],
      constraints: [],
      requires_human_authorization: false,
      roe_compliance: true,
      reversible: true,
      audit_trail: [
        {
          timestamp: new Date(),
          event: "ROUTINE_DECISION_GENERATED",
          data: { status: "nominal" },
          authorization_level: "AUTONOMOUS",
        },
      ],
    };
  }

  // ============================================================================
  // ACT PHASE - Execute decisions and monitor results
  // ============================================================================

  act(decision: Decision): ActionExecution {
    this.currentPhase = "act";
    const startTime = Date.now();

    // BLACKTALON DOCTRINE ENFORCEMENT
    // "The system may recommend. It may execute pre-authorized actions. It may not redefine intent."
    // Human authority mandatory for:
    // - Engagement/strike decisions
    // - Mission abort without immediate safety threat
    // - Any action violating ROE
    
    const requiresHumanAuth = decision.requires_human_authorization ||
      decision.type === "engagement" ||
      !decision.roe_compliance ||
      (decision.type === "tactical" && decision.action.includes("STRIKE"));

    const execution: ActionExecution = {
      decision_id: decision.id,
      timestamp: new Date(),
      action: decision.action,
      status: requiresHumanAuth ? "pending" : "executing",
      start_time: new Date(),
      effects: [],
      feedback: [],
    };

    // HARD BLOCK on ROE violations - cannot proceed without compliance
    if (!decision.roe_compliance) {
      execution.status = "aborted";
      execution.result = "ACTION BLOCKED: ROE violation detected - human authorization required";
      execution.effects = ["BLOCKED_BY_ROE_ENGINE"];
      
      // Add to audit trail
      decision.audit_trail.push({
        timestamp: new Date(),
        event: "ACTION_BLOCKED_ROE_VIOLATION",
        data: { reason: "ROE non-compliance", decision_id: decision.id },
        authorization_level: "BLOCKED",
      });
      
      this.executingActions.push(execution);
      this.cycleCount++;
      this.recordLatency(startTime);
      return execution;
    }

    // For authorized non-engagement actions, execute
    if (!requiresHumanAuth) {
      // Only execute safe, pre-authorized actions
      const safeActions = [
        "MAINTAIN_STATION", "CONTINUE_MISSION", "RTB_PLANNED",
        "EVASIVE_MANEUVER", "SET_MODE", "ENTER_HOLD"
      ];
      
      if (safeActions.includes(decision.action) || decision.type === "administrative") {
        execution.status = "completed";
        execution.completion_time = new Date();
        execution.result = `Action ${decision.action} executed successfully`;
        execution.effects = [`${decision.action} applied to flight control system`];
      } else {
        // Unknown action - requires human review
        execution.status = "pending";
        execution.result = "Action requires human review before execution";
      }
    }

    this.executingActions.push(execution);
    this.cycleCount++;
    this.recordLatency(startTime);

    return execution;
  }

  // ============================================================================
  // COMPLETE OODA CYCLE
  // ============================================================================

  executeOODACycle(
    drone: Drone,
    mission?: Mission,
    telemetry?: Telemetry,
    alerts?: Alert[],
    roeContext?: ROEContext
  ): OODACycleResult {
    const cycleStart = Date.now();

    // OBSERVE
    const observation = this.observe(drone, telemetry, alerts);

    // ORIENT
    const orientation = this.orient(observation, mission);

    // DECIDE
    const decisions = this.decide(orientation, mission, roeContext);

    // ACT on highest priority decision
    const primaryDecision = decisions.sort((a, b) => {
      const priorityOrder = { immediate: 0, urgent: 1, routine: 2, deferred: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    })[0];

    const execution = this.act(primaryDecision);

    const cycleDuration = Date.now() - cycleStart;

    return {
      cycle_id: this.cycleCount,
      timestamp: new Date(),
      duration_ms: cycleDuration,
      observation,
      orientation,
      decisions,
      primary_decision: primaryDecision,
      execution,
      alert_level: this.alertLevel,
    };
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private hashId(id: string): number {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      const char = id.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private recordLatency(startTime: number): void {
    const latency = Date.now() - startTime;
    this.cycleLatency.push(latency);
    if (this.cycleLatency.length > 100) {
      this.cycleLatency.shift();
    }
  }

  getAlertLevel(): typeof this.alertLevel {
    return this.alertLevel;
  }

  getDecisionHistory(limit = 50): Decision[] {
    return this.decisionHistory.slice(-limit);
  }

  getOrientationState(): OrientationState | null {
    return this.orientationState;
  }

  generatePilotStatus(): PilotStatus {
    return {
      identity: this.identity,
      status: this.alertLevel === "green" ? "READY" : this.alertLevel === "yellow" ? "ALERT" : "ENGAGED",
      alert_level: this.alertLevel,
      ooda_metrics: this.getCycleMetrics(),
      current_phase: this.currentPhase,
      pending_decisions: this.pendingDecisions.length,
      active_actions: this.executingActions.filter(a => a.status === "executing").length,
    };
  }
}

// ============================================================================
// TYPES FOR EXTERNAL INTEGRATION
// ============================================================================

export interface ROEContext {
  currentROE: string;
  authorityLevel: "peacetime" | "elevated" | "combat";
  constraints: string[];
  weaponsStatus: "safe" | "armed" | "weapons_free";
  engagementRules: string[];
}

export interface OODACycleResult {
  cycle_id: number;
  timestamp: Date;
  duration_ms: number;
  observation: ObservationData;
  orientation: OrientationState;
  decisions: Decision[];
  primary_decision: Decision;
  execution: ActionExecution;
  alert_level: "green" | "yellow" | "orange" | "red";
}

export interface PilotStatus {
  identity: CyrusIdentity;
  status: "READY" | "ALERT" | "ENGAGED" | "EMERGENCY" | "OFFLINE";
  alert_level: "green" | "yellow" | "orange" | "red";
  ooda_metrics: { count: number; avgLatency: number; currentPhase: OODAPhase };
  current_phase: OODAPhase;
  pending_decisions: number;
  active_actions: number;
}

// Export singleton instance
export const cyrusCognitiveCore = new CyrusCognitiveCore();
