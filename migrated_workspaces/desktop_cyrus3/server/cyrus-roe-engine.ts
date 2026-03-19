/**
 * CYRUS RULES OF ENGAGEMENT (ROE) ENGINE
 * =======================================
 * 
 * Dynamic Rules Engine per BLACKTALON-MCN-1 Doctrine
 * 
 * Implements 4-layer hierarchical rules system:
 * - Layer 1: Immutable Laws (LOAC, Geneva Conventions)
 * - Layer 2: National Policy (country-specific restrictions)
 * - Layer 3: Coalition Agreements (joint operations caveats)
 * - Layer 4: Mission-Specific (commander's intent, time-phased ROE)
 * 
 * "The system may recommend. It may execute pre-authorized actions.
 *  It may not redefine intent." - BLACKTALON Doctrine
 */

import type { Drone, Mission } from "@shared/schema";

// ============================================================================
// ROE LAYER DEFINITIONS
// ============================================================================

export type ROELayer = "immutable" | "national" | "coalition" | "mission";
export type AuthorityLevel = "peacetime" | "elevated" | "combat" | "weapons_free";
export type WeaponsStatus = "safe" | "armed" | "hot";

export interface ImmutableLaw {
  id: string;
  name: string;
  description: string;
  source: "LOAC" | "GENEVA" | "IHL" | "HUMANITARIAN";
  constraints: string[];
  cannotOverride: true;
}

export interface NationalPolicy {
  id: string;
  nation: string;
  restrictions: string[];
  weaponAuthorities: string[];
  targetCategories: string[];
  collateralDamageThreshold: "zero" | "minimal" | "acceptable" | "elevated";
  approvalChain: string[];
}

export interface CoalitionAgreement {
  id: string;
  name: string;
  participants: string[];
  sharedAirspaceRules: string[];
  coordinationRequirements: string[];
  caveats: Record<string, string[]>;
}

export interface MissionROE {
  id: string;
  missionId: string;
  commanderIntent: string;
  authorityLevel: AuthorityLevel;
  weaponsStatus: WeaponsStatus;
  engagementRules: EngagementRule[];
  geographicBoundaries: GeographicBoundary[];
  timeConstraints: TimeConstraint[];
  targetCategories: TargetCategory[];
  collateralDamageEstimate: number;
  effectiveFrom: Date;
  effectiveUntil?: Date;
  version: number;
  authorizedBy: string;
  signature: string;
}

export interface EngagementRule {
  id: string;
  condition: string;
  action: "engage" | "observe" | "report" | "evade" | "defend" | "defer_to_human";
  requiresHumanAuth: boolean;
  priority: number;
}

export interface GeographicBoundary {
  type: "include" | "exclude" | "weapons_free" | "no_fly";
  coordinates: { lat: number; lng: number }[];
  altitude_min?: number;
  altitude_max?: number;
  description: string;
}

export interface TimeConstraint {
  type: "window" | "blackout" | "priority";
  startTime: Date;
  endTime: Date;
  description: string;
}

export interface TargetCategory {
  id: string;
  name: string;
  classification: "hostile" | "suspect" | "neutral" | "friendly" | "protected";
  engagementAuthority: "pre_authorized" | "on_request" | "prohibited";
  positiveIdRequired: boolean;
  collateralEstimate: "none" | "low" | "medium" | "high";
}

// ============================================================================
// IMMUTABLE LAWS (LAYER 1) - CANNOT BE OVERRIDDEN
// ============================================================================

const IMMUTABLE_LAWS: ImmutableLaw[] = [
  {
    id: "IL-001",
    name: "Distinction",
    description: "Attacks must distinguish between combatants and civilians",
    source: "LOAC",
    constraints: [
      "MUST_IDENTIFY_TARGET_TYPE",
      "CIVILIAN_TARGETING_PROHIBITED",
      "PROTECTED_OBJECTS_INVIOLABLE",
    ],
    cannotOverride: true,
  },
  {
    id: "IL-002",
    name: "Proportionality",
    description: "Attack effects must not be excessive relative to military advantage",
    source: "LOAC",
    constraints: [
      "COLLATERAL_DAMAGE_ASSESSMENT_REQUIRED",
      "DISPROPORTIONATE_ATTACK_PROHIBITED",
      "MILITARY_NECESSITY_REQUIRED",
    ],
    cannotOverride: true,
  },
  {
    id: "IL-003",
    name: "Precaution",
    description: "All feasible precautions must be taken to minimize harm",
    source: "GENEVA",
    constraints: [
      "TARGET_VERIFICATION_MANDATORY",
      "ALTERNATIVE_MEANS_CONSIDERED",
      "TIMING_OPTIMIZED_FOR_PROTECTION",
    ],
    cannotOverride: true,
  },
  {
    id: "IL-004",
    name: "Protected Persons",
    description: "Medical personnel, chaplains, and POWs are protected",
    source: "GENEVA",
    constraints: [
      "MEDICAL_FACILITIES_PROTECTED",
      "RELIGIOUS_PERSONNEL_PROTECTED",
      "PRISONERS_PROTECTED",
      "WOUNDED_PROTECTED",
    ],
    cannotOverride: true,
  },
  {
    id: "IL-005",
    name: "Superfluous Injury",
    description: "Weapons causing unnecessary suffering are prohibited",
    source: "IHL",
    constraints: [
      "PROHIBITED_WEAPONS_BLOCKED",
      "SUFFERING_MINIMIZATION_REQUIRED",
    ],
    cannotOverride: true,
  },
  {
    id: "IL-006",
    name: "Human Authority",
    description: "Lethal decisions require human authorization",
    source: "HUMANITARIAN",
    constraints: [
      "LETHAL_ACTION_REQUIRES_HUMAN_AUTH",
      "AUTONOMOUS_WEAPONS_PROHIBITED",
      "HUMAN_IN_LOOP_MANDATORY",
    ],
    cannotOverride: true,
  },
];

// ============================================================================
// DEFAULT NATIONAL POLICIES (LAYER 2)
// ============================================================================

const DEFAULT_NATIONAL_POLICY: NationalPolicy = {
  id: "NP-DEFAULT",
  nation: "DEFAULT",
  restrictions: [
    "NO_FIRST_STRIKE",
    "PID_REQUIRED_FOR_ENGAGEMENT",
    "COLLATERAL_DAMAGE_MINIMIZATION",
  ],
  weaponAuthorities: ["PRECISION_GUIDED", "ISR_SENSORS"],
  targetCategories: ["MILITARY_HARDWARE", "COMBATANTS"],
  collateralDamageThreshold: "minimal",
  approvalChain: ["TACTICAL_COMMANDER", "OPERATIONAL_COMMANDER"],
};

// ============================================================================
// ROE ENGINE CLASS
// ============================================================================

export class ROEEngine {
  private immutableLaws: ImmutableLaw[] = IMMUTABLE_LAWS;
  private nationalPolicy: NationalPolicy = DEFAULT_NATIONAL_POLICY;
  private coalitionAgreements: CoalitionAgreement[] = [];
  private activeMissionROE: Map<string, MissionROE> = new Map();
  private roeHistory: ROEChangeEvent[] = [];
  private currentAuthorityLevel: AuthorityLevel = "peacetime";
  private currentWeaponsStatus: WeaponsStatus = "safe";

  constructor() {
    this.initializeDefaultROE();
  }

  private initializeDefaultROE(): void {
    // Log initialization
    this.logROEChange({
      timestamp: new Date(),
      type: "INITIALIZATION",
      oldValue: null,
      newValue: "DEFAULT_PEACETIME_ROE",
      authorizedBy: "SYSTEM",
      reason: "ROE Engine initialized",
    });
  }

  // ============================================================================
  // ROE EVALUATION
  // ============================================================================

  evaluateAction(
    action: ProposedAction,
    context: ActionContext
  ): ROEEvaluation {
    const violations: ROEViolation[] = [];
    const constraints: string[] = [];
    let requiresHumanAuth = false;
    let isPermitted = true;
    let hardBlocked = false; // BLACKTALON: Hard block for immutable law violations

    // Layer 1: Check immutable laws (CANNOT BE BYPASSED - HARD BLOCK)
    // Per BLACKTALON doctrine: Immutable laws are absolute constraints
    for (const law of this.immutableLaws) {
      const lawCheck = this.checkImmutableLaw(action, law, context);
      if (lawCheck.violated) {
        violations.push({
          layer: "immutable",
          ruleId: law.id,
          ruleName: law.name,
          description: lawCheck.reason,
          severity: "critical",
          canOverride: false,
        });
        isPermitted = false;
        hardBlocked = true; // IMMUTABLE LAW VIOLATION - CANNOT PROCEED
      }
      constraints.push(...law.constraints);
    }
    
    // If immutable law violated, immediately return blocked result
    // This is a hard stop - no further evaluation needed
    if (hardBlocked) {
      return {
        action: action.name,
        isPermitted: false,
        requiresHumanAuthorization: false, // Not even human can override
        violations,
        constraints,
        authorityLevel: this.currentAuthorityLevel,
        weaponsStatus: this.currentWeaponsStatus,
        recommendation: `HARD BLOCK: Immutable law violation - ${violations[0]?.description}`,
        auditHash: this.generateAuditHash(action, context, violations),
        timestamp: new Date(),
        hardBlocked: true,
      };
    }

    // Layer 2: Check national policy
    const policyCheck = this.checkNationalPolicy(action, context);
    if (policyCheck.restricted) {
      if (policyCheck.canElevate) {
        requiresHumanAuth = true;
        violations.push({
          layer: "national",
          ruleId: this.nationalPolicy.id,
          ruleName: "National Policy",
          description: policyCheck.reason,
          severity: "high",
          canOverride: true,
        });
      } else {
        isPermitted = false;
        violations.push({
          layer: "national",
          ruleId: this.nationalPolicy.id,
          ruleName: "National Policy",
          description: policyCheck.reason,
          severity: "high",
          canOverride: false,
        });
      }
    }

    // Layer 3: Check coalition agreements
    for (const agreement of this.coalitionAgreements) {
      const coalitionCheck = this.checkCoalitionAgreement(action, agreement, context);
      if (coalitionCheck.restricted) {
        violations.push({
          layer: "coalition",
          ruleId: agreement.id,
          ruleName: agreement.name,
          description: coalitionCheck.reason,
          severity: "medium",
          canOverride: coalitionCheck.canOverride,
        });
        if (!coalitionCheck.canOverride) {
          isPermitted = false;
        }
      }
    }

    // Layer 4: Check mission-specific ROE
    const missionROE = this.activeMissionROE.get(context.missionId || "");
    if (missionROE) {
      const missionCheck = this.checkMissionROE(action, missionROE, context);
      if (!missionCheck.authorized) {
        if (missionCheck.canRequest) {
          requiresHumanAuth = true;
        } else {
          isPermitted = false;
        }
        violations.push({
          layer: "mission",
          ruleId: missionROE.id,
          ruleName: "Mission ROE",
          description: missionCheck.reason,
          severity: missionCheck.canRequest ? "low" : "medium",
          canOverride: missionCheck.canRequest,
        });
      }
    }

    // Human auth requirements
    if (action.type === "engagement" || action.type === "weapons_release") {
      requiresHumanAuth = true;
    }

    return {
      action: action.name,
      isPermitted: isPermitted && violations.filter(v => !v.canOverride).length === 0,
      requiresHumanAuthorization: requiresHumanAuth,
      violations,
      constraints,
      authorityLevel: this.currentAuthorityLevel,
      weaponsStatus: this.currentWeaponsStatus,
      recommendation: this.generateRecommendation(isPermitted, requiresHumanAuth, violations),
      auditHash: this.generateAuditHash(action, context, violations),
      timestamp: new Date(),
    };
  }

  private checkImmutableLaw(
    action: ProposedAction,
    law: ImmutableLaw,
    context: ActionContext
  ): { violated: boolean; reason: string } {
    // Check for lethal action without human auth
    if (law.id === "IL-006" && action.type === "engagement") {
      if (!context.humanAuthorized) {
        return {
          violated: true,
          reason: "Lethal action requires human authorization per IL-006",
        };
      }
    }

    // Check for civilian targeting
    if (law.id === "IL-001" && action.type === "engagement") {
      if (context.targetClassification === "civilian" || context.targetClassification === "protected") {
        return {
          violated: true,
          reason: "Target classified as civilian/protected - engagement prohibited per IL-001",
        };
      }
    }

    // Check for proportionality
    if (law.id === "IL-002" && action.type === "engagement") {
      if (context.collateralEstimate === "high" || context.collateralEstimate === "excessive") {
        return {
          violated: true,
          reason: "Collateral damage estimate exceeds proportionality threshold per IL-002",
        };
      }
    }

    return { violated: false, reason: "" };
  }

  private checkNationalPolicy(
    action: ProposedAction,
    context: ActionContext
  ): { restricted: boolean; canElevate: boolean; reason: string } {
    // Check if action type is restricted
    if (action.type === "engagement" && this.nationalPolicy.restrictions.includes("NO_FIRST_STRIKE")) {
      if (!context.underAttack) {
        return {
          restricted: true,
          canElevate: true,
          reason: "First strike prohibited under current national policy - requires elevation",
        };
      }
    }

    // Check PID requirement
    if (this.nationalPolicy.restrictions.includes("PID_REQUIRED_FOR_ENGAGEMENT")) {
      if (action.type === "engagement" && !context.positiveId) {
        return {
          restricted: true,
          canElevate: false,
          reason: "Positive identification required before engagement",
        };
      }
    }

    return { restricted: false, canElevate: false, reason: "" };
  }

  private checkCoalitionAgreement(
    action: ProposedAction,
    agreement: CoalitionAgreement,
    context: ActionContext
  ): { restricted: boolean; canOverride: boolean; reason: string } {
    // Check coordination requirements
    if (agreement.coordinationRequirements.includes("NOTIFY_BEFORE_ENGAGEMENT")) {
      if (action.type === "engagement" && !context.coalitionNotified) {
        return {
          restricted: true,
          canOverride: true,
          reason: `Coalition ${agreement.name} requires notification before engagement`,
        };
      }
    }

    return { restricted: false, canOverride: true, reason: "" };
  }

  private checkMissionROE(
    action: ProposedAction,
    roe: MissionROE,
    context: ActionContext
  ): { authorized: boolean; canRequest: boolean; reason: string } {
    // Check weapons status
    if (action.type === "engagement" && roe.weaponsStatus === "safe") {
      return {
        authorized: false,
        canRequest: true,
        reason: "Weapons status is SAFE - engagement not authorized",
      };
    }

    // Check authority level
    if (action.type === "engagement" && roe.authorityLevel === "peacetime") {
      return {
        authorized: false,
        canRequest: true,
        reason: "Peacetime ROE active - engagement requires authorization",
      };
    }

    // Check engagement rules
    for (const rule of roe.engagementRules) {
      if (this.matchesCondition(rule.condition, context)) {
        if (rule.action === "defer_to_human") {
          return {
            authorized: false,
            canRequest: true,
            reason: `Rule ${rule.id} requires human decision`,
          };
        }
      }
    }

    return { authorized: true, canRequest: false, reason: "" };
  }

  private matchesCondition(condition: string, context: ActionContext): boolean {
    // Simple condition matching
    if (condition.includes("UNKNOWN_TARGET") && context.targetClassification === "unknown") {
      return true;
    }
    if (condition.includes("LOW_CONFIDENCE") && (context.confidence || 1) < 0.7) {
      return true;
    }
    return false;
  }

  private generateRecommendation(
    isPermitted: boolean,
    requiresHumanAuth: boolean,
    violations: ROEViolation[]
  ): string {
    if (!isPermitted) {
      const criticalViolation = violations.find(v => v.severity === "critical");
      if (criticalViolation) {
        return `ACTION PROHIBITED: ${criticalViolation.description}`;
      }
      return `ACTION NOT AUTHORIZED: ${violations.length} rule violation(s) detected`;
    }

    if (requiresHumanAuth) {
      return "ACTION REQUIRES HUMAN AUTHORIZATION before execution";
    }

    return "ACTION PERMITTED within current ROE parameters";
  }

  private generateAuditHash(
    action: ProposedAction,
    context: ActionContext,
    violations: ROEViolation[]
  ): string {
    const data = JSON.stringify({ action, context, violations, timestamp: Date.now() });
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `ROE-${Math.abs(hash).toString(16).toUpperCase()}`;
  }

  // ============================================================================
  // ROE MANAGEMENT
  // ============================================================================

  updateMissionROE(missionId: string, roe: Partial<MissionROE>): ROEUpdateResult {
    const existing = this.activeMissionROE.get(missionId);
    const newVersion = existing ? existing.version + 1 : 1;

    const updatedROE: MissionROE = {
      id: roe.id || `ROE-${missionId}-${newVersion}`,
      missionId,
      commanderIntent: roe.commanderIntent || existing?.commanderIntent || "Conduct ISR operations",
      authorityLevel: roe.authorityLevel || existing?.authorityLevel || "peacetime",
      weaponsStatus: roe.weaponsStatus || existing?.weaponsStatus || "safe",
      engagementRules: roe.engagementRules || existing?.engagementRules || [],
      geographicBoundaries: roe.geographicBoundaries || existing?.geographicBoundaries || [],
      timeConstraints: roe.timeConstraints || existing?.timeConstraints || [],
      targetCategories: roe.targetCategories || existing?.targetCategories || [],
      collateralDamageEstimate: roe.collateralDamageEstimate ?? existing?.collateralDamageEstimate ?? 0,
      effectiveFrom: roe.effectiveFrom || new Date(),
      effectiveUntil: roe.effectiveUntil,
      version: newVersion,
      authorizedBy: roe.authorizedBy || "SYSTEM",
      signature: roe.signature || this.generateSignature(),
    };

    this.activeMissionROE.set(missionId, updatedROE);
    this.currentAuthorityLevel = updatedROE.authorityLevel;
    this.currentWeaponsStatus = updatedROE.weaponsStatus;

    this.logROEChange({
      timestamp: new Date(),
      type: "MISSION_ROE_UPDATE",
      oldValue: existing ? JSON.stringify(existing) : null,
      newValue: JSON.stringify(updatedROE),
      authorizedBy: updatedROE.authorizedBy,
      reason: `ROE updated to version ${newVersion}`,
    });

    return {
      success: true,
      roeId: updatedROE.id,
      version: newVersion,
      effectiveFrom: updatedROE.effectiveFrom,
      message: `Mission ROE updated. Authority: ${updatedROE.authorityLevel}, Weapons: ${updatedROE.weaponsStatus}`,
    };
  }

  setAuthorityLevel(level: AuthorityLevel, authorizedBy: string): void {
    const oldLevel = this.currentAuthorityLevel;
    this.currentAuthorityLevel = level;

    this.logROEChange({
      timestamp: new Date(),
      type: "AUTHORITY_LEVEL_CHANGE",
      oldValue: oldLevel,
      newValue: level,
      authorizedBy,
      reason: `Authority level changed from ${oldLevel} to ${level}`,
    });

    // Update weapons status based on authority level
    if (level === "peacetime") {
      this.currentWeaponsStatus = "safe";
    } else if (level === "combat" || level === "weapons_free") {
      this.currentWeaponsStatus = "armed";
    }
  }

  setWeaponsStatus(status: WeaponsStatus, authorizedBy: string): void {
    // Cannot set weapons hot in peacetime
    if (this.currentAuthorityLevel === "peacetime" && status === "hot") {
      throw new Error("Cannot set weapons hot under peacetime ROE");
    }

    const oldStatus = this.currentWeaponsStatus;
    this.currentWeaponsStatus = status;

    this.logROEChange({
      timestamp: new Date(),
      type: "WEAPONS_STATUS_CHANGE",
      oldValue: oldStatus,
      newValue: status,
      authorizedBy,
      reason: `Weapons status changed from ${oldStatus} to ${status}`,
    });
  }

  private generateSignature(): string {
    return `SIG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  }

  private logROEChange(event: ROEChangeEvent): void {
    this.roeHistory.push(event);
    if (this.roeHistory.length > 1000) {
      this.roeHistory = this.roeHistory.slice(-1000);
    }
  }

  // ============================================================================
  // STATUS AND REPORTING
  // ============================================================================

  getCurrentROEStatus(): ROEStatus {
    const activeMissions = Array.from(this.activeMissionROE.entries());

    return {
      authorityLevel: this.currentAuthorityLevel,
      weaponsStatus: this.currentWeaponsStatus,
      immutableLawsActive: this.immutableLaws.length,
      nationalPolicyId: this.nationalPolicy.id,
      coalitionAgreements: this.coalitionAgreements.map(a => a.name),
      activeMissionROE: activeMissions.map(([missionId, roe]) => ({
        missionId,
        roeId: roe.id,
        version: roe.version,
        authorityLevel: roe.authorityLevel,
        weaponsStatus: roe.weaponsStatus,
      })),
      lastUpdate: this.roeHistory.length > 0 
        ? this.roeHistory[this.roeHistory.length - 1].timestamp 
        : new Date(),
    };
  }

  getROEHistory(limit = 50): ROEChangeEvent[] {
    return this.roeHistory.slice(-limit);
  }

  getImmutableLaws(): ImmutableLaw[] {
    return this.immutableLaws;
  }
}

// ============================================================================
// TYPES
// ============================================================================

export interface ProposedAction {
  name: string;
  type: "movement" | "observation" | "engagement" | "weapons_release" | "communication" | "defensive";
  target?: string;
  parameters: Record<string, unknown>;
}

export interface ActionContext {
  missionId?: string;
  droneId: string;
  position: { lat: number; lng: number; altitude: number };
  targetClassification?: "hostile" | "suspect" | "neutral" | "friendly" | "civilian" | "protected" | "unknown";
  positiveId?: boolean;
  humanAuthorized?: boolean;
  underAttack?: boolean;
  collateralEstimate?: "none" | "low" | "medium" | "high" | "excessive";
  confidence?: number;
  coalitionNotified?: boolean;
}

export interface ROEViolation {
  layer: ROELayer;
  ruleId: string;
  ruleName: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  canOverride: boolean;
}

export interface ROEEvaluation {
  action: string;
  isPermitted: boolean;
  requiresHumanAuthorization: boolean;
  violations: ROEViolation[];
  constraints: string[];
  authorityLevel: AuthorityLevel;
  weaponsStatus: WeaponsStatus;
  recommendation: string;
  auditHash: string;
  timestamp: Date;
  hardBlocked?: boolean; // True if immutable law violation - cannot proceed under any circumstances
}

export interface ROEChangeEvent {
  timestamp: Date;
  type: string;
  oldValue: string | null;
  newValue: string;
  authorizedBy: string;
  reason: string;
}

export interface ROEUpdateResult {
  success: boolean;
  roeId: string;
  version: number;
  effectiveFrom: Date;
  message: string;
}

export interface ROEStatus {
  authorityLevel: AuthorityLevel;
  weaponsStatus: WeaponsStatus;
  immutableLawsActive: number;
  nationalPolicyId: string;
  coalitionAgreements: string[];
  activeMissionROE: {
    missionId: string;
    roeId: string;
    version: number;
    authorityLevel: AuthorityLevel;
    weaponsStatus: WeaponsStatus;
  }[];
  lastUpdate: Date;
}

// Export singleton instance
export const roeEngine = new ROEEngine();
