/**
 * CYRUS MISSION COMMANDER
 * ========================
 * 
 * Mission planning, execution, re-tasking, and abort decisions per BLACKTALON doctrine.
 * 
 * "The system may recommend. It may execute pre-authorized actions.
 *  It may not redefine intent."
 * 
 * Implements:
 * - Intelligent mission planning
 * - Real-time mission execution monitoring
 * - Dynamic re-tasking capabilities
 * - Abort decision logic
 * - Mission success probability assessment
 */

import type { Drone, Mission, Telemetry } from "@shared/schema";
import type { OODACycleResult, OrientationState } from "./cyrus-cognitive-core";
import type { ROEEvaluation } from "./cyrus-roe-engine";

// ============================================================================
// MISSION TYPES
// ============================================================================

export type MissionType = 
  | "isr"           // Intelligence, Surveillance, Reconnaissance
  | "patrol"        // Area patrol
  | "escort"        // Asset escort
  | "strike"        // Precision strike (requires authorization)
  | "sar"           // Search and Rescue
  | "hadr"          // Humanitarian Assistance/Disaster Relief
  | "training"      // Training mission
  | "ferry";        // Ferry flight

export type MissionPhase = 
  | "planning"
  | "preflight"
  | "departure"
  | "enroute"
  | "on_station"
  | "executing"
  | "egress"
  | "recovery"
  | "complete"
  | "aborted";

export interface MissionPlan {
  id: string;
  missionId: string;
  type: MissionType;
  objective: string;
  priority: "critical" | "high" | "medium" | "low";
  constraints: MissionConstraint[];
  waypoints: MissionWaypoint[];
  timeline: MissionTimeline;
  resources: ResourceRequirement[];
  contingencies: ContingencyPlan[];
  successCriteria: SuccessCriterion[];
  riskAssessment: RiskAssessment;
  createdAt: Date;
  authorizedBy: string;
  // BLACKTALON DOCTRINE: Human authorization required for strike/lethal missions
  requiresHumanAuth: boolean;
  humanAuthStatus: "pending" | "approved" | "denied" | "not_required";
  humanAuthBy?: string;
  humanAuthTimestamp?: Date;
}

export interface MissionConstraint {
  type: "altitude" | "speed" | "airspace" | "time" | "fuel" | "weather" | "roe";
  description: string;
  value: unknown;
  mandatory: boolean;
}

export interface MissionWaypoint {
  id: string;
  sequence: number;
  name: string;
  position: { lat: number; lng: number; altitude: number };
  action: "transit" | "loiter" | "observe" | "engage" | "land" | "takeoff";
  duration?: number;
  onArrival?: string[];
  constraints?: string[];
}

export interface MissionTimeline {
  plannedStart: Date;
  plannedEnd: Date;
  actualStart?: Date;
  actualEnd?: Date;
  phases: {
    phase: MissionPhase;
    plannedDuration: number;
    actualDuration?: number;
  }[];
}

export interface ResourceRequirement {
  type: "fuel" | "battery" | "ammunition" | "sensor_time" | "communication_bandwidth";
  required: number;
  available: number;
  unit: string;
}

export interface ContingencyPlan {
  trigger: string;
  condition: string;
  action: string;
  priority: number;
}

export interface SuccessCriterion {
  id: string;
  description: string;
  metric: string;
  threshold: number;
  achieved: boolean;
  actualValue?: number;
}

export interface RiskAssessment {
  overallRisk: "low" | "medium" | "high" | "critical";
  factors: RiskFactor[];
  mitigations: string[];
  acceptedBy?: string;
}

export interface RiskFactor {
  category: "weather" | "enemy" | "technical" | "human" | "political";
  description: string;
  probability: number;
  impact: number;
  riskScore: number;
}

export interface MissionExecutionState {
  missionId: string;
  planId: string;
  currentPhase: MissionPhase;
  currentWaypoint: number;
  progress: number;
  elapsedTime: number;
  remainingTime: number;
  status: "nominal" | "delayed" | "at_risk" | "compromised" | "success" | "failed";
  events: MissionEvent[];
  decisions: MissionDecision[];
  metrics: MissionMetrics;
}

export interface MissionEvent {
  timestamp: Date;
  type: "info" | "warning" | "critical" | "milestone" | "decision";
  description: string;
  data?: Record<string, unknown>;
}

export interface MissionDecision {
  timestamp: Date;
  decisionType: "continue" | "modify" | "retask" | "abort" | "escalate";
  reasoning: string;
  confidence: number;
  humanRequired: boolean;
  executed: boolean;
}

export interface MissionMetrics {
  waypointsCompleted: number;
  waypointsTotal: number;
  objectivesAchieved: number;
  objectivesTotal: number;
  timeOnStation: number;
  distanceTraveled: number;
  batteryConsumed: number;
  alertsGenerated: number;
  decisionsAutonomous: number;
  decisionsHuman: number;
}

// ============================================================================
// MISSION COMMANDER ENGINE
// ============================================================================

export class MissionCommander {
  private missionPlans: Map<string, MissionPlan> = new Map();
  private executionStates: Map<string, MissionExecutionState> = new Map();
  private missionHistory: MissionPlan[] = [];

  // ============================================================================
  // MISSION PLANNING
  // ============================================================================

  createMissionPlan(
    mission: Mission,
    drone: Drone,
    missionType: MissionType,
    objective: string
  ): MissionPlan {
    const riskAssessment = this.assessMissionRisk(drone, missionType);
    
    // BLACKTALON DOCTRINE: Strike missions require human authorization
    const requiresHumanAuth = missionType === "strike" || missionType === "escort";
    
    const plan: MissionPlan = {
      id: `PLAN-${Date.now()}`,
      missionId: mission.id,
      type: missionType,
      objective,
      priority: this.determinePriority(missionType),
      constraints: this.generateConstraints(drone, missionType),
      waypoints: this.planWaypoints(mission, missionType),
      timeline: this.planTimeline(mission),
      resources: this.assessResources(drone, mission),
      contingencies: this.generateContingencies(missionType),
      successCriteria: this.defineSuccessCriteria(missionType, objective),
      riskAssessment,
      createdAt: new Date(),
      authorizedBy: "PENDING",
      // BLACKTALON: Human authorization for lethal/high-risk missions
      requiresHumanAuth,
      humanAuthStatus: requiresHumanAuth ? "pending" : "not_required",
    };

    this.missionPlans.set(mission.id, plan);
    return plan;
  }

  private determinePriority(type: MissionType): MissionPlan["priority"] {
    const priorities: Record<MissionType, MissionPlan["priority"]> = {
      strike: "critical",
      sar: "critical",
      escort: "high",
      isr: "high",
      patrol: "medium",
      hadr: "high",
      training: "low",
      ferry: "low",
    };
    return priorities[type];
  }

  private generateConstraints(drone: Drone, type: MissionType): MissionConstraint[] {
    const constraints: MissionConstraint[] = [
      {
        type: "fuel",
        description: "Minimum RTB fuel reserve",
        value: 20,
        mandatory: true,
      },
      {
        type: "altitude",
        description: "Operational altitude band",
        value: { min: 500, max: 5000 },
        mandatory: false,
      },
    ];

    if (type === "strike") {
      constraints.push({
        type: "roe",
        description: "Human authorization required for weapons release",
        value: "HUMAN_IN_LOOP",
        mandatory: true,
      });
    }

    return constraints;
  }

  private planWaypoints(mission: Mission, type: MissionType): MissionWaypoint[] {
    const waypoints: MissionWaypoint[] = [];
    let sequence = 1;

    // Add takeoff
    waypoints.push({
      id: `WP-${sequence}`,
      sequence: sequence++,
      name: "DEPARTURE",
      position: { lat: 34.0522, lng: -118.2437, altitude: 500 },
      action: "takeoff",
    });

    // Convert mission waypoints
    for (const wp of mission.waypoints) {
      waypoints.push({
        id: `WP-${sequence}`,
        sequence: sequence++,
        name: `WAYPOINT ${sequence - 1}`,
        position: { lat: wp.latitude, lng: wp.longitude, altitude: wp.altitude },
        action: this.mapWaypointAction(wp.action),
        duration: wp.duration,
      });
    }

    // Add RTB
    waypoints.push({
      id: `WP-${sequence}`,
      sequence: sequence++,
      name: "RECOVERY",
      position: { lat: 34.0522, lng: -118.2437, altitude: 500 },
      action: "land",
    });

    return waypoints;
  }

  private mapWaypointAction(action: string): MissionWaypoint["action"] {
    const mapping: Record<string, MissionWaypoint["action"]> = {
      hover: "loiter",
      photo: "observe",
      video: "observe",
      waypoint: "transit",
      land: "land",
    };
    return mapping[action] || "transit";
  }

  private planTimeline(mission: Mission): MissionTimeline {
    const now = new Date();
    const duration = mission.estimatedDuration || 60;

    return {
      plannedStart: now,
      plannedEnd: new Date(now.getTime() + duration * 60000),
      phases: [
        { phase: "preflight", plannedDuration: 5 },
        { phase: "departure", plannedDuration: 5 },
        { phase: "enroute", plannedDuration: Math.floor(duration * 0.2) },
        { phase: "on_station", plannedDuration: Math.floor(duration * 0.5) },
        { phase: "egress", plannedDuration: Math.floor(duration * 0.2) },
        { phase: "recovery", plannedDuration: 5 },
      ],
    };
  }

  private assessResources(drone: Drone, mission: Mission): ResourceRequirement[] {
    return [
      {
        type: "battery",
        required: 80,
        available: drone.batteryLevel,
        unit: "%",
      },
      {
        type: "sensor_time",
        required: mission.estimatedDuration || 60,
        available: 180,
        unit: "minutes",
      },
      {
        type: "communication_bandwidth",
        required: 50,
        available: drone.signalStrength,
        unit: "%",
      },
    ];
  }

  private generateContingencies(type: MissionType): ContingencyPlan[] {
    const contingencies: ContingencyPlan[] = [
      {
        trigger: "BATTERY_LOW",
        condition: "battery < 25%",
        action: "ABORT_AND_RTB",
        priority: 1,
      },
      {
        trigger: "SIGNAL_LOST",
        condition: "signal < 10% for 60s",
        action: "EXECUTE_LOST_LINK",
        priority: 2,
      },
      {
        trigger: "WEATHER_DETERIORATION",
        condition: "visibility < 1km",
        action: "CLIMB_OR_DIVERT",
        priority: 3,
      },
    ];

    if (type === "strike" || type === "escort") {
      contingencies.push({
        trigger: "THREAT_DETECTED",
        condition: "hostile_track_within_10km",
        action: "EVASIVE_MANEUVER",
        priority: 1,
      });
    }

    return contingencies;
  }

  private defineSuccessCriteria(type: MissionType, objective: string): SuccessCriterion[] {
    const criteria: SuccessCriterion[] = [
      {
        id: "SC-1",
        description: "Aircraft recovery",
        metric: "aircraft_status",
        threshold: 1,
        achieved: false,
      },
      {
        id: "SC-2",
        description: "Waypoints completed",
        metric: "waypoints_ratio",
        threshold: 0.8,
        achieved: false,
      },
    ];

    if (type === "isr") {
      criteria.push({
        id: "SC-3",
        description: "Area coverage",
        metric: "coverage_percentage",
        threshold: 0.9,
        achieved: false,
      });
    }

    return criteria;
  }

  private assessMissionRisk(drone: Drone, type: MissionType): RiskAssessment {
    const factors: RiskFactor[] = [];

    // Technical risk
    if (drone.batteryLevel < 50) {
      factors.push({
        category: "technical",
        description: "Low battery at mission start",
        probability: 0.6,
        impact: 0.8,
        riskScore: 0.48,
      });
    }

    if (!drone.gpsLock) {
      factors.push({
        category: "technical",
        description: "GPS lock not acquired",
        probability: 0.9,
        impact: 0.7,
        riskScore: 0.63,
      });
    }

    // Mission type risk
    if (type === "strike") {
      factors.push({
        category: "enemy",
        description: "Potential hostile response",
        probability: 0.4,
        impact: 0.9,
        riskScore: 0.36,
      });
    }

    const maxRisk = factors.reduce((max, f) => Math.max(max, f.riskScore), 0);
    let overallRisk: RiskAssessment["overallRisk"] = "low";
    if (maxRisk > 0.7) overallRisk = "critical";
    else if (maxRisk > 0.5) overallRisk = "high";
    else if (maxRisk > 0.3) overallRisk = "medium";

    return {
      overallRisk,
      factors,
      mitigations: this.generateMitigations(factors),
    };
  }

  private generateMitigations(factors: RiskFactor[]): string[] {
    const mitigations: string[] = [];

    for (const factor of factors) {
      if (factor.category === "technical" && factor.description.includes("battery")) {
        mitigations.push("Reduce mission duration or plan closer recovery site");
      }
      if (factor.category === "technical" && factor.description.includes("GPS")) {
        mitigations.push("Delay mission until GPS lock acquired or use INS backup");
      }
      if (factor.category === "enemy") {
        mitigations.push("Plan evasive routes and configure defensive systems");
      }
    }

    return mitigations;
  }

  // ============================================================================
  // MISSION EXECUTION
  // ============================================================================

  startMission(missionId: string, humanAuthBy?: string): MissionExecutionState {
    const plan = this.missionPlans.get(missionId);
    if (!plan) {
      throw new Error(`Mission plan not found for ${missionId}`);
    }

    // BLACKTALON DOCTRINE: Cannot start mission requiring human auth without authorization
    if (plan.requiresHumanAuth && plan.humanAuthStatus !== "approved") {
      throw new Error(`BLACKTALON VIOLATION: Mission type '${plan.type}' requires human authorization before execution. Current status: ${plan.humanAuthStatus}`);
    }

    const state: MissionExecutionState = {
      missionId,
      planId: plan.id,
      currentPhase: "preflight",
      currentWaypoint: 0,
      progress: 0,
      elapsedTime: 0,
      remainingTime: plan.timeline.phases.reduce((sum, p) => sum + p.plannedDuration, 0),
      status: "nominal",
      events: [
        {
          timestamp: new Date(),
          type: "milestone",
          description: "Mission execution started",
        },
      ],
      decisions: [],
      metrics: {
        waypointsCompleted: 0,
        waypointsTotal: plan.waypoints.length,
        objectivesAchieved: 0,
        objectivesTotal: plan.successCriteria.length,
        timeOnStation: 0,
        distanceTraveled: 0,
        batteryConsumed: 0,
        alertsGenerated: 0,
        decisionsAutonomous: 0,
        decisionsHuman: 0,
      },
    };

    this.executionStates.set(missionId, state);
    return state;
  }

  updateMissionExecution(
    missionId: string,
    drone: Drone,
    telemetry?: Telemetry,
    ooda?: OODACycleResult
  ): MissionExecutionState {
    let state = this.executionStates.get(missionId);
    if (!state) {
      state = this.startMission(missionId);
    }

    const plan = this.missionPlans.get(missionId);

    // Update progress
    state.elapsedTime += 1;
    state.remainingTime = Math.max(0, state.remainingTime - 1);
    state.progress = state.elapsedTime / (state.elapsedTime + state.remainingTime);

    // Update metrics
    if (telemetry) {
      state.metrics.batteryConsumed = 100 - telemetry.batteryLevel;
    }

    // Process OODA cycle results
    if (ooda) {
      state = this.processCycleResult(state, ooda);
    }

    // Evaluate mission status
    state.status = this.evaluateMissionStatus(state, drone, plan);

    // Generate autonomous decisions
    const decision = this.generateMissionDecision(state, drone, plan);
    if (decision) {
      state.decisions.push(decision);
      if (!decision.humanRequired) {
        state.metrics.decisionsAutonomous++;
      } else {
        state.metrics.decisionsHuman++;
      }
    }

    this.executionStates.set(missionId, state);
    return state;
  }

  private processCycleResult(state: MissionExecutionState, ooda: OODACycleResult): MissionExecutionState {
    // Add events based on OODA cycle
    if (ooda.alert_level === "red" || ooda.alert_level === "orange") {
      state.events.push({
        timestamp: new Date(),
        type: "warning",
        description: `Alert level elevated to ${ooda.alert_level.toUpperCase()}`,
        data: { orientation: ooda.orientation.situationalAwareness },
      });
      state.metrics.alertsGenerated++;
    }

    // Record primary decision
    if (ooda.primary_decision) {
      state.events.push({
        timestamp: new Date(),
        type: "decision",
        description: `CYRUS decision: ${ooda.primary_decision.action}`,
        data: { decision_id: ooda.primary_decision.id },
      });
    }

    return state;
  }

  private evaluateMissionStatus(
    state: MissionExecutionState,
    drone: Drone,
    plan?: MissionPlan
  ): MissionExecutionState["status"] {
    // Check for critical conditions
    if (drone.batteryLevel < 15) return "compromised";
    if (!drone.gpsLock && drone.signalStrength < 20) return "at_risk";
    if (drone.status === "emergency") return "failed";

    // Check progress
    const expectedProgress = state.elapsedTime / (state.elapsedTime + state.remainingTime);
    const actualProgress = state.metrics.waypointsCompleted / Math.max(1, state.metrics.waypointsTotal);

    if (actualProgress < expectedProgress * 0.7) return "delayed";
    if (state.metrics.alertsGenerated > 5) return "at_risk";

    return "nominal";
  }

  private generateMissionDecision(
    state: MissionExecutionState,
    drone: Drone,
    plan?: MissionPlan
  ): MissionDecision | null {
    // Check for abort conditions
    if (state.status === "compromised" || state.status === "failed") {
      return {
        timestamp: new Date(),
        decisionType: "abort",
        reasoning: `Mission ${state.status} - initiating abort procedure`,
        confidence: 0.95,
        humanRequired: false,
        executed: false,
      };
    }

    // Check for retask conditions
    if (state.status === "at_risk" && state.metrics.alertsGenerated > 3) {
      return {
        timestamp: new Date(),
        decisionType: "escalate",
        reasoning: "Multiple alerts generated - requesting human review",
        confidence: 0.8,
        humanRequired: true,
        executed: false,
      };
    }

    // Check for modification needs
    if (state.status === "delayed" && state.progress > 0.3) {
      return {
        timestamp: new Date(),
        decisionType: "modify",
        reasoning: "Mission delayed - recommend timeline adjustment",
        confidence: 0.75,
        humanRequired: false,
        executed: false,
      };
    }

    return null;
  }

  // ============================================================================
  // MISSION CONTROL
  // ============================================================================

  abortMission(missionId: string, reason: string): MissionExecutionState | null {
    const state = this.executionStates.get(missionId);
    if (!state) return null;

    state.currentPhase = "aborted";
    state.status = "failed";
    state.events.push({
      timestamp: new Date(),
      type: "critical",
      description: `Mission aborted: ${reason}`,
    });
    state.decisions.push({
      timestamp: new Date(),
      decisionType: "abort",
      reasoning: reason,
      confidence: 1.0,
      humanRequired: false,
      executed: true,
    });

    this.executionStates.set(missionId, state);
    return state;
  }

  completeMission(missionId: string): MissionExecutionState | null {
    const state = this.executionStates.get(missionId);
    const plan = this.missionPlans.get(missionId);
    if (!state || !plan) return null;

    state.currentPhase = "complete";
    state.status = "success";
    state.progress = 1;
    state.remainingTime = 0;

    // Evaluate success criteria
    for (const criterion of plan.successCriteria) {
      if (criterion.metric === "aircraft_status") {
        criterion.achieved = true;
        criterion.actualValue = 1;
      }
      if (criterion.metric === "waypoints_ratio") {
        criterion.actualValue = state.metrics.waypointsCompleted / state.metrics.waypointsTotal;
        criterion.achieved = criterion.actualValue >= criterion.threshold;
      }
      if (criterion.achieved) {
        state.metrics.objectivesAchieved++;
      }
    }

    state.events.push({
      timestamp: new Date(),
      type: "milestone",
      description: `Mission completed - ${state.metrics.objectivesAchieved}/${state.metrics.objectivesTotal} objectives achieved`,
    });

    // Archive
    this.missionHistory.push(plan);
    this.executionStates.set(missionId, state);

    return state;
  }

  // BLACKTALON: Human authorization for high-risk missions
  authorizeMission(missionId: string, authorizedBy: string, approved: boolean): MissionPlan | null {
    const plan = this.missionPlans.get(missionId);
    if (!plan) return null;

    if (!plan.requiresHumanAuth) {
      // Mission doesn't require authorization
      return plan;
    }

    plan.humanAuthStatus = approved ? "approved" : "denied";
    plan.humanAuthBy = authorizedBy;
    plan.humanAuthTimestamp = new Date();
    plan.authorizedBy = authorizedBy;

    this.missionPlans.set(missionId, plan);
    return plan;
  }

  retaskMission(missionId: string, newObjective: string, newWaypoints: MissionWaypoint[]): MissionPlan | null {
    const plan = this.missionPlans.get(missionId);
    const state = this.executionStates.get(missionId);
    if (!plan || !state) return null;

    // Update plan
    plan.objective = newObjective;
    plan.waypoints = [...plan.waypoints.slice(0, state.currentWaypoint), ...newWaypoints];

    // Log retask
    state.events.push({
      timestamp: new Date(),
      type: "info",
      description: `Mission retasked: ${newObjective}`,
    });
    state.decisions.push({
      timestamp: new Date(),
      decisionType: "retask",
      reasoning: `Retasked to: ${newObjective}`,
      confidence: 1.0,
      humanRequired: true,
      executed: true,
    });

    this.missionPlans.set(missionId, plan);
    this.executionStates.set(missionId, state);

    return plan;
  }

  // ============================================================================
  // STATUS QUERIES
  // ============================================================================

  getMissionPlan(missionId: string): MissionPlan | undefined {
    return this.missionPlans.get(missionId);
  }

  getMissionExecution(missionId: string): MissionExecutionState | undefined {
    return this.executionStates.get(missionId);
  }

  getAllActiveMissions(): { missionId: string; state: MissionExecutionState }[] {
    return Array.from(this.executionStates.entries())
      .filter(([, state]) => state.currentPhase !== "complete" && state.currentPhase !== "aborted")
      .map(([missionId, state]) => ({ missionId, state }));
  }

  getMissionHistory(): MissionPlan[] {
    return this.missionHistory;
  }

  calculateSuccessProbability(missionId: string, drone: Drone): number {
    const plan = this.missionPlans.get(missionId);
    if (!plan) return 0;

    let probability = 1.0;

    // Factor in risk assessment
    const riskPenalty = {
      low: 0.05,
      medium: 0.15,
      high: 0.30,
      critical: 0.50,
    };
    probability -= riskPenalty[plan.riskAssessment.overallRisk];

    // Factor in resources
    for (const resource of plan.resources) {
      if (resource.available < resource.required) {
        probability -= 0.2;
      }
    }

    // Factor in drone health
    if (drone.batteryLevel < 50) probability -= 0.1;
    if (!drone.gpsLock) probability -= 0.15;
    if (drone.signalStrength < 50) probability -= 0.1;

    return Math.max(0, Math.min(1, probability));
  }
}

// Export singleton instance
export const missionCommander = new MissionCommander();
