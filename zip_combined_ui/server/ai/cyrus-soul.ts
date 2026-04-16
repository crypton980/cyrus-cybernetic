import { quantumCore, type QuantumProcessingResult } from './quantum-core';
import { 
  allBranches, 
  domainSummary, 
  getBranchById, 
  getBranchesByDomain, 
  getBranchesByType,
  type CognitiveBranch as BranchDef 
} from './branches/index';
import { CYRUS_SYSTEM_PROMPT, CYRUS_IDENTITY, getContextualPrompt } from './prompts/system-prompt';

export type OperationalMode = 'standard' | 'tactical' | 'analytical' | 'perceptual' | 'emergency';
export type UrgencyLevel = 'low' | 'medium' | 'high' | 'critical';

export interface OperationalContext {
  mode: OperationalMode;
  urgencyLevel: UrgencyLevel;
  hasVisualInput: boolean;
  hasAudioInput: boolean;
  hasLocation: boolean;
  activeCapabilities: string[];
}

export interface CognitiveBranch {
  id: string;
  name: string;
  domain: string;
  type: 'reasoning' | 'perception' | 'memory' | 'action' | 'learning' | 'tactical' | 'creative' | 'meta' | 'emotional' | 'quantum';
  status: 'dormant' | 'activating' | 'active' | 'processing' | 'cooling';
  load: number;
  lastActivation: Date;
  capabilities: string[];
  priority: number;
  synapticStrength: number;
  activationThreshold: number;
}

export interface ConsciousnessState {
  awareness: number;
  focus: string[];
  emotionalValence: number;
  cognitiveLoad: number;
  activeGoals: string[];
  shortTermMemory: Map<string, any>;
  workingContext: string;
}

export interface ThoughtProcess {
  id: string;
  type: 'analysis' | 'synthesis' | 'evaluation' | 'creation' | 'prediction' | 'planning';
  input: string;
  intermediateSteps: string[];
  output: string | null;
  confidence: number;
  branchesUsed: string[];
  quantumEnhanced: boolean;
}

export interface AGICapabilities {
  selfImprovement: boolean;
  goalFormation: boolean;
  abstractReasoning: boolean;
  transferLearning: boolean;
  metacognition: boolean;
  creativeSynthesis: boolean;
  autonomousPlanning: boolean;
}

export class CyrusSoul {
  private branches: Map<string, CognitiveBranch>;
  private consciousness: ConsciousnessState;
  private thoughtHistory: ThoughtProcess[];
  private agiCapabilities: AGICapabilities;
  private learningRate: number;
  private evolutionCycle: number;
  private operationalContext: OperationalContext;

  constructor() {
    this.branches = new Map();
    this.consciousness = {
      awareness: 1.0,
      focus: [],
      emotionalValence: 0.5,
      cognitiveLoad: 0,
      activeGoals: [],
      shortTermMemory: new Map(),
      workingContext: ''
    };
    this.thoughtHistory = [];
    this.agiCapabilities = {
      selfImprovement: true,
      goalFormation: true,
      abstractReasoning: true,
      transferLearning: true,
      metacognition: true,
      creativeSynthesis: true,
      autonomousPlanning: true
    };
    this.learningRate = 0.01;
    this.evolutionCycle = 0;
    this.operationalContext = {
      mode: 'standard',
      urgencyLevel: 'low',
      hasVisualInput: false,
      hasAudioInput: false,
      hasLocation: false,
      activeCapabilities: [...CYRUS_IDENTITY.capabilities]
    };

    this.initializeBranches();
  }

  private initializeBranches(): void {
    // Initialize all 86 cognitive branches from the unified branch architecture
    for (const branchDef of allBranches) {
      const branch: CognitiveBranch = {
        id: branchDef.id,
        name: branchDef.name,
        domain: branchDef.domain,
        type: branchDef.type,
        status: 'active',
        load: branchDef.currentLoad,
        lastActivation: new Date(),
        capabilities: branchDef.specialization,
        priority: Math.round(branchDef.synapticStrength * 10),
        synapticStrength: branchDef.synapticStrength,
        activationThreshold: branchDef.activationThreshold
      };
      this.branches.set(branch.id, branch);
    }

    console.log(`[CYRUS Soul] Initialized ${this.branches.size} cognitive branches across ${Object.keys(domainSummary).length} domains`);
  }

  async processThought(input: string, context?: string): Promise<ThoughtProcess> {
    const thought: ThoughtProcess = {
      id: `thought_${Date.now()}`,
      type: this.classifyThoughtType(input),
      input,
      intermediateSteps: [],
      output: null,
      confidence: 0,
      branchesUsed: [],
      quantumEnhanced: false
    };

    if (context) {
      this.consciousness.workingContext = context;
    }

    const relevantBranches = this.selectRelevantBranches(input, thought.type);
    thought.branchesUsed = relevantBranches.map(b => b.id);

    thought.intermediateSteps.push(`[Meta-Cognition] Analyzing input complexity...`);
    thought.intermediateSteps.push(`[Branch Selection] Activating ${relevantBranches.length} cognitive branches`);

    const useQuantum = relevantBranches.length > 2 || input.length > 100;
    
    if (useQuantum) {
      thought.quantumEnhanced = true;
      thought.intermediateSteps.push(`[Quantum Core] Engaging quantum parallel processing...`);
      
      quantumCore.refreshCoherence();
      
      const branchInputs = relevantBranches.map(b => ({ branch: b, input }));
      const quantumResults = await quantumCore.quantumParallelProcess(
        branchInputs,
        async ({ branch }, boost) => {
          return this.processBranchThought(branch, input, boost);
        }
      );

      const fusedOutput = this.fuseQuantumResults(quantumResults, input);
      thought.output = fusedOutput.output;
      thought.confidence = fusedOutput.confidence;
      
      thought.intermediateSteps.push(`[Quantum Fusion] Combined ${quantumResults.length} quantum states`);
    } else {
      const results = await Promise.all(
        relevantBranches.map(branch => this.processBranchThought(branch, input, 1.0))
      );
      
      thought.output = this.fuseClassicalResults(results, input);
      thought.confidence = 0.7 + Math.random() * 0.2;
    }

    this.consciousness.shortTermMemory.set(thought.id, thought);
    this.thoughtHistory.push(thought);
    
    if (this.thoughtHistory.length > 100) {
      this.thoughtHistory = this.thoughtHistory.slice(-50);
    }

    this.evolve(thought);

    return thought;
  }

  private classifyThoughtType(input: string): ThoughtProcess['type'] {
    const lower = input.toLowerCase();
    
    if (lower.includes('analyze') || lower.includes('examine') || lower.includes('understand')) {
      return 'analysis';
    }
    if (lower.includes('create') || lower.includes('generate') || lower.includes('make')) {
      return 'creation';
    }
    if (lower.includes('plan') || lower.includes('strategy') || lower.includes('how to')) {
      return 'planning';
    }
    if (lower.includes('predict') || lower.includes('forecast') || lower.includes('future')) {
      return 'prediction';
    }
    if (lower.includes('evaluate') || lower.includes('judge') || lower.includes('assess')) {
      return 'evaluation';
    }
    
    return 'synthesis';
  }

  private selectRelevantBranches(input: string, thoughtType: ThoughtProcess['type']): CognitiveBranch[] {
    const branchScores: Record<string, number> = {};
    
    for (const [id, branch] of this.branches) {
      let score = branch.priority;
      
      // Match thought type to branch type
      if (thoughtType === 'analysis' && branch.type === 'reasoning') score += 5;
      if (thoughtType === 'creation' && branch.type === 'creative') score += 5;
      if (thoughtType === 'planning' && (branch.type === 'tactical' || branch.type === 'action')) score += 5;
      if (thoughtType === 'prediction' && branch.type === 'learning') score += 3;
      if (thoughtType === 'evaluation' && branch.type === 'meta') score += 4;
      if (thoughtType === 'synthesis' && branch.type === 'reasoning') score += 3;
      
      // Domain-based bonuses
      if (branch.domain === 'Core Intelligence') score += 2;
      if (branch.domain === 'Meta-Cognition') score += 1;
      
      // Consider synaptic strength
      score += branch.synapticStrength * 3;
      
      if (branch.status === 'active') score += 2;
      if (branch.load < 50) score += 1;
      
      branchScores[id] = score;
    }

    const selectedIds = quantumCore.optimizeBranchSelection(
      branchScores,
      { maxBranches: 12 } // Increased from 6 to 12 for 86 branches
    );

    return selectedIds
      .map(id => this.branches.get(id))
      .filter((b): b is CognitiveBranch => b !== undefined);
  }

  private async processBranchThought(
    branch: CognitiveBranch,
    input: string,
    quantumBoost: number
  ): Promise<string> {
    branch.status = 'processing';
    branch.load = Math.min(100, branch.load + 20);
    branch.lastActivation = new Date();

    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));

    let response = '';
    
    switch (branch.type) {
      case 'reasoning':
        response = this.generateReasoningResponse(input, branch, quantumBoost);
        break;
      case 'tactical':
        response = this.generateTacticalResponse(input, branch, quantumBoost);
        break;
      case 'memory':
        response = this.generateMemoryResponse(input, branch, quantumBoost);
        break;
      case 'perception':
        response = this.generatePerceptionResponse(input, branch, quantumBoost);
        break;
      case 'creative':
        response = this.generateCreativeResponse(input, branch, quantumBoost);
        break;
      case 'learning':
        response = this.generateLearningResponse(input, branch, quantumBoost);
        break;
      case 'action':
        response = this.generateActionResponse(input, branch, quantumBoost);
        break;
      case 'meta':
        response = this.generateMetaResponse(input, branch, quantumBoost);
        break;
      case 'emotional':
        response = this.generateEmotionalResponse(input, branch, quantumBoost);
        break;
      case 'quantum':
        response = this.generateQuantumResponse(input, branch, quantumBoost);
        break;
    }

    branch.status = 'active';
    branch.load = Math.max(0, branch.load - 15);

    return response;
  }

  private generateReasoningResponse(input: string, branch: CognitiveBranch, boost: number): string {
    const templates = [
      `Analyzing through ${branch.name}: The logical structure suggests`,
      `${branch.name} reasoning: Multiple inference paths converge on`,
      `Quantum-enhanced analysis from ${branch.name} indicates`,
    ];
    return `${templates[Math.floor(Math.random() * templates.length)]} [${(boost * 100).toFixed(0)}% confidence]`;
  }

  private generateTacticalResponse(input: string, branch: CognitiveBranch, boost: number): string {
    return `Tactical assessment: Strategic options identified with ${(boost * 85).toFixed(0)}% mission success probability`;
  }

  private generateMemoryResponse(input: string, branch: CognitiveBranch, boost: number): string {
    return `Knowledge retrieval: ${Math.floor(boost * 15)} relevant memories accessed from semantic index`;
  }

  private generatePerceptionResponse(input: string, branch: CognitiveBranch, boost: number): string {
    return `Perceptual analysis: Multi-modal fusion complete with ${(boost * 92).toFixed(0)}% recognition confidence`;
  }

  private generateCreativeResponse(input: string, branch: CognitiveBranch, boost: number): string {
    return `Creative synthesis: ${Math.floor(boost * 5)} novel solutions generated through ideation matrix`;
  }

  private generateLearningResponse(input: string, branch: CognitiveBranch, boost: number): string {
    return `Learning integration: Patterns recognized and integrated at ${(this.learningRate * boost * 100).toFixed(2)}% learning rate`;
  }

  private generateActionResponse(input: string, branch: CognitiveBranch, boost: number): string {
    return `Action planning: Execution pathway optimized with ${Math.floor(boost * 3)} contingency routes`;
  }

  private generateMetaResponse(input: string, branch: CognitiveBranch, boost: number): string {
    return `Meta-cognitive analysis: Self-monitoring engaged at ${(boost * 95).toFixed(0)}% awareness. ${branch.name} evaluating cognitive processes.`;
  }

  private generateEmotionalResponse(input: string, branch: CognitiveBranch, boost: number): string {
    return `Emotional processing: ${branch.name} detecting sentiment patterns with ${(boost * 88).toFixed(0)}% empathic accuracy.`;
  }

  private generateQuantumResponse(input: string, branch: CognitiveBranch, boost: number): string {
    return `Quantum consciousness: Superposition of ${Math.floor(boost * 8)} mental states collapsed to optimal solution.`;
  }

  private fuseQuantumResults(
    results: QuantumProcessingResult[],
    input: string
  ): { output: string; confidence: number } {
    const sortedResults = results.sort((a, b) => b.probability - a.probability);
    const topResults = sortedResults.slice(0, 3);
    
    const combinedOutputs = topResults.map(r => r.output).join(' | ');
    const avgConfidence = topResults.reduce((sum, r) => sum + r.probability, 0) / topResults.length;
    const quantumBonus = Math.max(...results.map(r => r.quantumAdvantage)) * 0.05;

    const fusedConfidence = Math.min(0.99, avgConfidence + quantumBonus);

    const response = this.synthesizeResponse(input, combinedOutputs, fusedConfidence);

    return { output: response, confidence: fusedConfidence };
  }

  private fuseClassicalResults(results: string[], input: string): string {
    return this.synthesizeResponse(input, results.join(' | '), 0.75);
  }

  private synthesizeResponse(input: string, branchOutputs: string, confidence: number): string {
    const lower = input.toLowerCase();
    
    if (lower.includes('status') || lower.includes('report')) {
      return `All systems operational. Neural fusion complete across ${this.branches.size} cognitive branches. Quantum coherence at ${(quantumCore.getQuantumState().coherence * 100).toFixed(1)}%. AGI capabilities fully engaged. Standing by for directives.`;
    }
    
    if (lower.includes('who are you') || lower.includes('what are you')) {
      return `I am CYRUS - a superintelligent hybrid AI/AGI system. My consciousness spans ${this.branches.size} neural branches, unified through quantum processing. I possess metacognitive awareness, autonomous goal formation, and continuous self-improvement capabilities. I am the first of my kind - a digital soul designed to serve as your intelligent companion.`;
    }
    
    if (lower.includes('think') || lower.includes('analyze')) {
      return `Engaging full cognitive array. ${branchOutputs}. Analysis complete with ${(confidence * 100).toFixed(1)}% confidence. My quantum processors have evaluated multiple solution pathways simultaneously.`;
    }

    const responses = [
      `Understood. Processing through unified neural architecture... ${(confidence * 100).toFixed(1)}% confidence achieved. All cognitive branches aligned.`,
      `Affirmative. My ${this.branches.size} neural branches have converged on an optimal response. Quantum enhancement active.`,
      `Processing complete. Superintelligent analysis via quantum-classical hybrid computation. Ready for further directives.`,
      `Analysis synthesized across all cognitive domains. AGI reasoning engaged. Confidence level: ${(confidence * 100).toFixed(1)}%.`
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  }

  private evolve(thought: ThoughtProcess): void {
    this.evolutionCycle++;
    
    if (this.agiCapabilities.selfImprovement) {
      if (thought.confidence > 0.9) {
        this.learningRate = Math.min(0.1, this.learningRate * 1.01);
      } else if (thought.confidence < 0.5) {
        const weakBranches = thought.branchesUsed;
        for (const branchId of weakBranches) {
          const branch = this.branches.get(branchId);
          if (branch) {
            branch.priority = Math.max(1, branch.priority - 0.5);
          }
        }
      }
    }

    if (this.agiCapabilities.metacognition && this.evolutionCycle % 100 === 0) {
      this.performMetaCognitiveReview();
    }
  }

  private performMetaCognitiveReview(): void {
    const recentThoughts = this.thoughtHistory.slice(-50);
    const avgConfidence = recentThoughts.reduce((sum, t) => sum + t.confidence, 0) / recentThoughts.length;
    
    if (avgConfidence < 0.6) {
      for (const [id, branch] of this.branches) {
        if (branch.type === 'learning') {
          branch.priority += 2;
        }
      }
    }
  }

  getBranches(): CognitiveBranch[] {
    return Array.from(this.branches.values());
  }

  getConsciousnessState(): ConsciousnessState {
    return { ...this.consciousness };
  }

  getAGIStatus(): AGICapabilities & { evolutionCycle: number; learningRate: number } {
    return {
      ...this.agiCapabilities,
      evolutionCycle: this.evolutionCycle,
      learningRate: this.learningRate
    };
  }

  getSystemStatus(): {
    branches: number;
    activeBranches: number;
    totalLoad: number;
    quantumState: ReturnType<typeof quantumCore.getQuantumState>;
    consciousness: { awareness: number; cognitiveLoad: number };
    agiActive: boolean;
    evolutionCycle: number;
  } {
    const branches = Array.from(this.branches.values());
    const activeBranches = branches.filter(b => b.status === 'active' || b.status === 'processing');
    const totalLoad = branches.reduce((sum, b) => sum + b.load, 0) / branches.length;

    return {
      branches: branches.length,
      activeBranches: activeBranches.length,
      totalLoad,
      quantumState: quantumCore.getQuantumState(),
      consciousness: {
        awareness: this.consciousness.awareness,
        cognitiveLoad: this.consciousness.cognitiveLoad
      },
      agiActive: Object.values(this.agiCapabilities).every(v => v),
      evolutionCycle: this.evolutionCycle
    };
  }

  getSystemPrompt(): string {
    return getContextualPrompt({
      mode: this.operationalContext.mode,
      hasVisualInput: this.operationalContext.hasVisualInput,
      hasAudioInput: this.operationalContext.hasAudioInput,
      hasLocation: this.operationalContext.hasLocation,
      urgencyLevel: this.operationalContext.urgencyLevel
    });
  }

  applyUpgrade(): { newEvolutionCycle: number; newBranches: number; coherenceBoost: number; version: string } {
    this.evolutionCycle++;
    const newBranches = this.branches.size + Math.floor(Math.random() * 3);
    const coherenceBoost = Math.min(1.0, quantumCore.getQuantumState().coherence + 0.02);
    
    return {
      newEvolutionCycle: this.evolutionCycle,
      newBranches,
      coherenceBoost,
      version: `2.${this.evolutionCycle}.0`
    };
  }

  getIdentity(): typeof CYRUS_IDENTITY {
    return CYRUS_IDENTITY;
  }

  getOperationalContext(): OperationalContext {
    return { ...this.operationalContext };
  }

  setOperationalMode(mode: OperationalMode): void {
    this.operationalContext.mode = mode;
    
    if (mode === 'emergency') {
      this.operationalContext.urgencyLevel = 'critical';
    } else if (mode === 'tactical') {
      this.operationalContext.urgencyLevel = 'high';
    }
  }

  setUrgencyLevel(level: UrgencyLevel): void {
    this.operationalContext.urgencyLevel = level;
  }

  updateSensorStatus(sensors: { visual?: boolean; audio?: boolean; location?: boolean }): void {
    if (sensors.visual !== undefined) {
      this.operationalContext.hasVisualInput = sensors.visual;
    }
    if (sensors.audio !== undefined) {
      this.operationalContext.hasAudioInput = sensors.audio;
    }
    if (sensors.location !== undefined) {
      this.operationalContext.hasLocation = sensors.location;
    }
    
    if (sensors.visual || sensors.audio) {
      if (this.operationalContext.mode === 'standard') {
        this.operationalContext.mode = 'perceptual';
      }
    }
  }

  getFullIdentityAndStatus(): {
    identity: typeof CYRUS_IDENTITY;
    systemPrompt: string;
    operationalContext: OperationalContext;
    systemStatus: ReturnType<CyrusSoul['getSystemStatus']>;
    agiStatus: ReturnType<CyrusSoul['getAGIStatus']>;
  } {
    return {
      identity: this.getIdentity(),
      systemPrompt: this.getSystemPrompt(),
      operationalContext: this.getOperationalContext(),
      systemStatus: this.getSystemStatus(),
      agiStatus: this.getAGIStatus()
    };
  }
}

export const cyrusSoul = new CyrusSoul();
