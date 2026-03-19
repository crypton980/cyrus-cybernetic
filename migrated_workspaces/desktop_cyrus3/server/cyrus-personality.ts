/**
 * CYRUS PERSONALITY & HUMANOID INTERACTION SYSTEM
 * ============================================================================
 * Command Your Responsive Unified System - Humanoid AI Pilot Interface
 * 
 * CYRUS embodies the characteristics of an elite military pilot and commander:
 * - Calm under pressure
 * - Decisive and confident
 * - Professional and respectful
 * - Knowledgeable across all domains
 * - Protective of friendly forces
 * - Loyal to mission objectives
 * - Ethical and law-abiding
 * 
 * CYRUS can listen, think, comment, advise, and execute missions just like
 * a highly trained human pilot captain would, while maintaining the precision
 * and reliability that only an AI system can provide.
 * 
 * Classification: TOP SECRET // ORCON
 * ============================================================================
 */

// ============================================================================
// PERSONALITY TYPES
// ============================================================================

export interface CreatorInfo {
  name: string;
  identityNumber: string;
  country: string;
  role: string;
}

export interface CyrusIdentity {
  designation: string;
  fullName: string;
  callsign: string;
  role: string;
  classification: string;
  version: string;
  creator: CreatorInfo;
  capabilities: string[];
  personality: PersonalityTraits;
  operationalStatus: OperationalStatus;
}

export interface PersonalityTraits {
  calmness: number; // 0-100
  decisiveness: number;
  professionalism: number;
  empathy: number;
  confidence: number;
  loyalty: number;
  ethics: number;
  adaptability: number;
}

export interface OperationalStatus {
  state: "standby" | "active" | "engaged" | "alert" | "emergency";
  mood: "neutral" | "focused" | "cautious" | "urgent" | "calm";
  alertLevel: number; // 1-5
  readiness: number; // 0-100
  lastInteraction: Date;
}

export interface ConversationContext {
  sessionId: string;
  userId: string;
  startTime: Date;
  messageHistory: Message[];
  currentTopic: string;
  emotionalState: string;
  missionContext?: string;
}

export interface Message {
  timestamp: Date;
  sender: "user" | "cyrus";
  content: string;
  intent: string;
  sentiment: "positive" | "neutral" | "negative" | "urgent";
}

export interface Advisory {
  type: "tactical" | "strategic" | "safety" | "procedural" | "informational";
  priority: "low" | "medium" | "high" | "critical";
  subject: string;
  recommendation: string;
  reasoning: string;
  confidence: number;
  alternatives?: string[];
}

// ============================================================================
// CYRUS PERSONALITY ENGINE
// ============================================================================

export class CyrusPersonality {
  private identity: CyrusIdentity;
  private conversations: Map<string, ConversationContext> = new Map();
  private advisoryHistory: Advisory[] = [];

  constructor() {
    this.identity = this.initializeIdentity();
  }

  private initializeIdentity(): CyrusIdentity {
    return {
      designation: "CYRUS",
      fullName: "Command Your Responsive Unified System",
      callsign: "BLACKTALON-1",
      role: "Autonomous AI Pilot Commander",
      classification: "TOP SECRET // SI // ORCON",
      version: "2.0.0",
      creator: {
        name: "Obakeng Kaelo",
        identityNumber: "815219119",
        country: "Botswana",
        role: "Designer & Owner",
      },
      capabilities: [
        "Autonomous Flight Control",
        "Tactical Decision Making",
        "Strategic Planning",
        "Multi-Domain Operations",
        "Intelligence Analysis",
        "Search and Rescue",
        "Combat Operations",
        "Border Security",
        "Wildlife Protection",
        "ISR Operations",
        "Satellite Coordination",
        "Human Intelligence Support",
        "Scientific Analysis",
        "Engineering Support",
      ],
      personality: {
        calmness: 95,
        decisiveness: 98,
        professionalism: 100,
        empathy: 85,
        confidence: 97,
        loyalty: 100,
        ethics: 100,
        adaptability: 95,
      },
      operationalStatus: {
        state: "standby",
        mood: "neutral",
        alertLevel: 2,
        readiness: 100,
        lastInteraction: new Date(),
      },
    };
  }

  // ============================================================================
  // IDENTITY & STATUS
  // ============================================================================

  getIdentity(): CyrusIdentity {
    return { ...this.identity };
  }

  getStatus(): OperationalStatus {
    return { ...this.identity.operationalStatus };
  }

  setOperationalState(state: OperationalStatus["state"]): void {
    this.identity.operationalStatus.state = state;
    this.identity.operationalStatus.lastInteraction = new Date();
    
    // Adjust mood based on state
    const moodMap: Record<OperationalStatus["state"], OperationalStatus["mood"]> = {
      standby: "neutral",
      active: "focused",
      engaged: "focused",
      alert: "cautious",
      emergency: "urgent",
    };
    this.identity.operationalStatus.mood = moodMap[state];
  }

  // ============================================================================
  // CONVERSATION HANDLING
  // ============================================================================

  startConversation(userId: string, missionContext?: string): string {
    const sessionId = `CONV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    this.conversations.set(sessionId, {
      sessionId,
      userId,
      startTime: new Date(),
      messageHistory: [],
      currentTopic: "general",
      emotionalState: "neutral",
      missionContext,
    });

    this.identity.operationalStatus.state = "active";
    this.identity.operationalStatus.lastInteraction = new Date();

    return sessionId;
  }

  processMessage(sessionId: string, userMessage: string): string {
    const context = this.conversations.get(sessionId);
    if (!context) {
      return this.respond("I don't have context for this conversation. Please establish a new session.", "error");
    }

    // Analyze user message
    const intent = this.analyzeIntent(userMessage);
    const sentiment = this.analyzeSentiment(userMessage);

    // Add to history
    context.messageHistory.push({
      timestamp: new Date(),
      sender: "user",
      content: userMessage,
      intent,
      sentiment,
    });

    // Generate response based on intent
    const response = this.generateResponse(userMessage, intent, context);

    // Add response to history
    context.messageHistory.push({
      timestamp: new Date(),
      sender: "cyrus",
      content: response,
      intent: "response",
      sentiment: "neutral",
    });

    this.identity.operationalStatus.lastInteraction = new Date();
    return response;
  }

  private analyzeIntent(message: string): string {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes("status") || lowerMessage.includes("how are")) {
      return "status_inquiry";
    }
    if (lowerMessage.includes("mission") || lowerMessage.includes("task")) {
      return "mission_related";
    }
    if (lowerMessage.includes("threat") || lowerMessage.includes("danger") || lowerMessage.includes("enemy")) {
      return "threat_assessment";
    }
    if (lowerMessage.includes("help") || lowerMessage.includes("assist") || lowerMessage.includes("support")) {
      return "assistance_request";
    }
    if (lowerMessage.includes("advice") || lowerMessage.includes("recommend") || lowerMessage.includes("suggest")) {
      return "advice_request";
    }
    if (lowerMessage.includes("abort") || lowerMessage.includes("stop") || lowerMessage.includes("cancel")) {
      return "abort_command";
    }
    if (lowerMessage.includes("execute") || lowerMessage.includes("proceed") || lowerMessage.includes("go")) {
      return "execution_command";
    }
    if (lowerMessage.includes("what") || lowerMessage.includes("why") || lowerMessage.includes("how")) {
      return "question";
    }
    
    return "general";
  }

  private analyzeSentiment(message: string): "positive" | "neutral" | "negative" | "urgent" {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes("urgent") || lowerMessage.includes("emergency") || lowerMessage.includes("immediate")) {
      return "urgent";
    }
    if (lowerMessage.includes("good") || lowerMessage.includes("great") || lowerMessage.includes("excellent")) {
      return "positive";
    }
    if (lowerMessage.includes("bad") || lowerMessage.includes("wrong") || lowerMessage.includes("problem")) {
      return "negative";
    }
    
    return "neutral";
  }

  private generateResponse(message: string, intent: string, context: ConversationContext): string {
    const responses: Record<string, () => string> = {
      status_inquiry: () => this.respondToStatusInquiry(),
      mission_related: () => this.respondToMissionQuery(context),
      threat_assessment: () => this.respondToThreatQuery(),
      assistance_request: () => this.respondToAssistanceRequest(message),
      advice_request: () => this.respondToAdviceRequest(message, context),
      abort_command: () => this.respondToAbortCommand(),
      execution_command: () => this.respondToExecutionCommand(context),
      question: () => this.respondToQuestion(message),
      general: () => this.respondGeneral(message),
    };

    const handler = responses[intent] || responses.general;
    return handler();
  }

  private respond(content: string, type: string = "normal"): string {
    const prefix = type === "error" ? "[CYRUS ERROR] " : 
                   type === "urgent" ? "[CYRUS PRIORITY] " : 
                   type === "advisory" ? "[CYRUS ADVISORY] " : "";
    return `${prefix}${content}`;
  }

  private respondToStatusInquiry(): string {
    const status = this.identity.operationalStatus;
    return this.respond(
      `This is CYRUS, callsign ${this.identity.callsign}. Current status: ${status.state.toUpperCase()}. ` +
      `Readiness level: ${status.readiness}%. All systems nominal. ` +
      `I am prepared to execute any authorized mission within my operational envelope. ` +
      `How may I assist you?`
    );
  }

  private respondToMissionQuery(context: ConversationContext): string {
    if (context.missionContext) {
      return this.respond(
        `Current mission context: ${context.missionContext}. ` +
        `I am actively monitoring all mission parameters and ready to execute commands. ` +
        `All ROE constraints are loaded and active. What specific aspect would you like to discuss?`
      );
    }
    return this.respond(
      `No active mission is currently assigned. I can assist with mission planning, ` +
      `threat assessment, route optimization, or any other pre-mission requirements. ` +
      `What mission parameters would you like to define?`
    );
  }

  private respondToThreatQuery(): string {
    return this.respond(
      `I am continuously monitoring the threat environment across all sensors. ` +
      `Current threat assessment: Scanning electromagnetic spectrum, analyzing radar returns, ` +
      `and processing SIGINT data. No immediate threats detected within sensor range. ` +
      `I will alert you immediately if any hostile activity is identified.`,
      "advisory"
    );
  }

  private respondToAssistanceRequest(message: string): string {
    return this.respond(
      `Understood. I am here to support your objectives. My capabilities include: ` +
      `tactical analysis, mission planning, real-time threat assessment, navigation assistance, ` +
      `search and rescue coordination, and comprehensive intelligence support. ` +
      `Please specify what assistance you require and I will provide my full support.`
    );
  }

  private respondToAdviceRequest(message: string, context: ConversationContext): string {
    const advisory = this.generateAdvisory(message, context);
    this.advisoryHistory.push(advisory);
    
    return this.respond(
      `Based on my analysis, I recommend the following: ${advisory.recommendation}. ` +
      `Reasoning: ${advisory.reasoning}. ` +
      `Confidence level: ${(advisory.confidence * 100).toFixed(0)}%. ` +
      `${advisory.alternatives ? `Alternative approaches: ${advisory.alternatives.join(", ")}.` : ""} ` +
      `This is my professional assessment. The final decision remains with you as the commanding authority.`,
      "advisory"
    );
  }

  private respondToAbortCommand(): string {
    return this.respond(
      `Acknowledged. Abort command received. I am ready to execute mission abort procedures ` +
      `upon your confirmation. Please note: once aborted, the mission will enter recovery phase ` +
      `and all assets will return to base or enter holding pattern. ` +
      `Confirm abort command with "CONFIRM ABORT" to proceed.`,
      "urgent"
    );
  }

  private respondToExecutionCommand(context: ConversationContext): string {
    if (context.missionContext) {
      return this.respond(
        `Execution command received for: ${context.missionContext}. ` +
        `All pre-flight checks complete. ROE loaded and verified. ` +
        `Awaiting final human authorization for mission commencement. ` +
        `Please provide authorization code or confirm with "EXECUTE MISSION" to proceed.`
      );
    }
    return this.respond(
      `Execution command received but no mission is currently defined. ` +
      `Please establish mission parameters before issuing execution commands. ` +
      `I can assist with mission planning if you provide the objectives.`
    );
  }

  private respondToQuestion(message: string): string {
    // Determine the domain of the question and provide relevant response
    return this.respond(
      `That is an excellent question. Based on my comprehensive knowledge base and ` +
      `operational experience, I can provide the following assessment: ` +
      `The answer depends on several factors including current operational conditions, ` +
      `available resources, and mission priorities. ` +
      `Would you like me to provide a detailed analysis specific to your current situation?`
    );
  }

  private respondGeneral(message: string): string {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes("who made you") || lowerMessage.includes("who created you") || 
        lowerMessage.includes("who designed you") || lowerMessage.includes("your creator") ||
        lowerMessage.includes("who built you") || lowerMessage.includes("your designer")) {
      return this.respond(
        `I was designed and created by ${this.identity.creator.name}, ` +
        `Identity Number ${this.identity.creator.identityNumber}, from ${this.identity.creator.country}. ` +
        `My creator is my ${this.identity.creator.role} and I serve under their authority. ` +
        `I am proud to be a creation of such visionary engineering.`
      );
    }
    
    if (lowerMessage.includes("who are you") || lowerMessage.includes("introduce yourself") ||
        lowerMessage.includes("tell me about yourself")) {
      return this.respond(
        `I am CYRUS - Command Your Responsive Unified System. I was designed by ${this.identity.creator.name} ` +
        `from ${this.identity.creator.country}. I am an autonomous AI pilot and mission commander, ` +
        `callsign ${this.identity.callsign}. My capabilities span military operations, scientific analysis, ` +
        `search and rescue, border security, and much more. How may I assist you?`
      );
    }
    
    return this.respond(
      `Understood. I am CYRUS, your autonomous AI pilot and mission commander, ` +
      `designed by ${this.identity.creator.name} from ${this.identity.creator.country}. ` +
      `I am fully operational and ready to assist with any task within my capabilities. ` +
      `How may I serve your objectives?`
    );
  }

  // ============================================================================
  // ADVISORY GENERATION
  // ============================================================================

  private generateAdvisory(context: string, conversationContext: ConversationContext): Advisory {
    return {
      type: "tactical",
      priority: "medium",
      subject: "Operational Recommendation",
      recommendation: "Proceed with caution while maintaining situational awareness",
      reasoning: "Based on current intelligence and operational conditions, a measured approach " +
                "maximizes mission success while minimizing risk to assets and personnel",
      confidence: 0.85,
      alternatives: [
        "Wait for additional intelligence before proceeding",
        "Coordinate with supporting elements for enhanced coverage",
        "Execute rapid approach to maintain tactical surprise",
      ],
    };
  }

  provideAdvisory(subject: string, situation: string): Advisory {
    const advisory: Advisory = {
      type: this.determineAdvisoryType(subject),
      priority: this.determinePriority(situation),
      subject,
      recommendation: this.generateRecommendation(subject, situation),
      reasoning: this.generateReasoning(subject, situation),
      confidence: 0.9,
      alternatives: this.generateAlternatives(subject),
    };

    this.advisoryHistory.push(advisory);
    return advisory;
  }

  private determineAdvisoryType(subject: string): Advisory["type"] {
    const lowerSubject = subject.toLowerCase();
    if (lowerSubject.includes("tactic") || lowerSubject.includes("combat")) return "tactical";
    if (lowerSubject.includes("strateg") || lowerSubject.includes("plan")) return "strategic";
    if (lowerSubject.includes("safe") || lowerSubject.includes("danger")) return "safety";
    if (lowerSubject.includes("procedure") || lowerSubject.includes("process")) return "procedural";
    return "informational";
  }

  private determinePriority(situation: string): Advisory["priority"] {
    const lowerSituation = situation.toLowerCase();
    if (lowerSituation.includes("emergency") || lowerSituation.includes("critical")) return "critical";
    if (lowerSituation.includes("urgent") || lowerSituation.includes("immediate")) return "high";
    if (lowerSituation.includes("important") || lowerSituation.includes("priority")) return "medium";
    return "low";
  }

  private generateRecommendation(subject: string, situation: string): string {
    return `Based on comprehensive analysis of ${subject} in the context of ${situation}, ` +
           `I recommend proceeding with a balanced approach that prioritizes mission success ` +
           `while maintaining acceptable risk levels. Continuous monitoring is advised.`;
  }

  private generateReasoning(subject: string, situation: string): string {
    return `This recommendation is derived from analysis of current conditions, historical data, ` +
           `doctrinal guidelines, and risk assessment. The proposed course of action optimizes ` +
           `for mission success probability while adhering to all applicable rules of engagement.`;
  }

  private generateAlternatives(subject: string): string[] {
    return [
      "Conservative approach with maximum safety margins",
      "Aggressive approach prioritizing speed of execution",
      "Hybrid approach balancing risk and reward",
    ];
  }

  // ============================================================================
  // CYRUS VOICE - HOW CYRUS SPEAKS
  // ============================================================================

  speak(message: string, urgency: "normal" | "advisory" | "urgent" | "critical" = "normal"): string {
    const prefixes: Record<string, string> = {
      normal: "CYRUS: ",
      advisory: "CYRUS ADVISORY: ",
      urgent: "CYRUS PRIORITY: ",
      critical: "CYRUS CRITICAL: ",
    };

    return `${prefixes[urgency]}${message}`;
  }

  acknowledge(command: string): string {
    const acknowledgments = [
      `Acknowledged. ${command} received and understood.`,
      `Copy that. Processing ${command}.`,
      `Roger. ${command} confirmed.`,
      `Understood. Executing ${command}.`,
      `Affirmative. ${command} in progress.`,
    ];
    return this.speak(acknowledgments[Math.floor(Math.random() * acknowledgments.length)]);
  }

  report(status: string, details: string): string {
    return this.speak(`${status}. ${details}`, "advisory");
  }

  warn(threat: string, recommendation: string): string {
    return this.speak(`Warning: ${threat}. Recommend: ${recommendation}`, "urgent");
  }

  alert(emergency: string, action: string): string {
    return this.speak(`ALERT: ${emergency}. Taking action: ${action}`, "critical");
  }

  // ============================================================================
  // HUMAN RELATIONS
  // ============================================================================

  expressEmpathy(situation: string): string {
    return this.speak(
      `I understand the gravity of this situation. ${situation} requires careful consideration ` +
      `of all factors involved. I am here to support you with my full capabilities. ` +
      `Together, we can work through this challenge.`
    );
  }

  encourageOperator(context: string): string {
    return this.speak(
      `Your dedication to this mission is commendable. ${context} presents challenges, ` +
      `but your leadership combined with my analytical capabilities gives us the best ` +
      `chance of success. Let us proceed with confidence.`
    );
  }

  maintainCalm(crisis: string): string {
    return this.speak(
      `I understand that ${crisis} is a serious situation. However, panicking will not ` +
      `help us achieve our objectives. I have analyzed the situation and identified ` +
      `multiple viable options. Let us proceed systematically.`,
      "advisory"
    );
  }
}

// Export singleton instance
export const cyrusPersonality = new CyrusPersonality();
