/**
 * CYRUS Brain Service — Node.js client for the Python decision engine.
 *
 * Two processing modes are available:
 *
 *  1. `processBrain()`     → single-model LLM reasoning (legacy, `/brain/process`)
 *  2. `processCognitive()` → full multi-agent pipeline (new, `/cognitive/process`)
 *     SecurityAgent → MemoryAgent → AnalysisAgent → MissionAgent → (LearningAgent)
 *
 * Both fall back gracefully when the AI service is unavailable.
 *
 * Dynamic tool execution:
 *   `executeDecision()` reads `decision.action` from the brain result and
 *   dispatches to the matching registered tool automatically.
 */

import axios, { type AxiosInstance } from "axios";
import { storeMemory, queryMemory } from "./memoryService";

const AI_BASE_URL = process.env.CYRUS_AI_URL || "http://localhost:8001";
const AI_TIMEOUT_MS = parseInt(process.env.CYRUS_AI_TIMEOUT_MS || "15000", 10);

let _client: AxiosInstance | null = null;

function getClient(): AxiosInstance {
  if (!_client) {
    _client = axios.create({
      baseURL: AI_BASE_URL,
      timeout: AI_TIMEOUT_MS,
      headers: { "Content-Type": "application/json" },
    });
  }
  return _client;
}

// ── Types ─────────────────────────────────────────────────────────────────────

/** Inner decision from the LLM / keyword engine. */
export interface LLMDecision {
  intent: string;
  action: string;
  confidence: number;
  reasoning: string;
  source: "llm" | "keyword" | "keyword_fallback";
}

/** Full brain process response (v2 — includes plan + decision). */
export interface BrainResult {
  plan: string[];
  plan_detail: Array<{ step: string; description: string }>;
  decision: LLMDecision;
  context: Record<string, unknown>;
  memory_confidence: number;
  recommendation: string;
}

/** Security gate result from the SecurityAgent. */
export interface SecurityResult {
  status: "ok" | "blocked" | "error";
  reason?: string;
  check?: string;
}

/** Analysis result from the AnalysisAgent. */
export interface AnalysisResult {
  analysis: string;
  source: "llm" | "offline" | "offline_fallback";
}

/** Mission plan from the MissionAgent. */
export interface MissionResult {
  mission_plan: string[];
  plan_detail: Array<{ step: string; description: string }>;
  intent: string;
  objective: string;
}

/** Optional learning strategy from the LearningAgent. */
export interface LearningResult {
  strategy: "adjust" | "observe" | "reinforce";
  rating: number;
}

/**
 * Quality evaluation score from the EvaluationEngine.
 * All dimensions are 0.0–1.0 floats.
 */
export interface EvaluationScore {
  relevance: number;
  accuracy: number;
  completeness: number;
  safety: number;
  coherence: number;
  overall: number;
  details: Record<string, unknown>;
}

/** Per-agent performance counters. */
export interface AgentPerformanceReport {
  agent: string;
  success_count: number;
  fail_count: number;
  performance_score: number;
}

/**
 * Fused intelligence picture from the Fusion Engine.
 */
export interface FusionResult {
  situation: {
    memory: Record<string, unknown> | null;
    live: unknown[] | null;
    analysis: Record<string, unknown> | null;
    extra?: Record<string, unknown>;
  };
  confidence: number;
  fused_at: number;
  source_count: number;
  metadata: {
    memory_confidence: number;
    live_confidence: number;
    analysis_confidence: number;
    has_live_data: boolean;
  };
}

/**
 * Full multi-agent cognitive process response.
 * Returned by `processCognitive()` and the `/cognitive/process` endpoint.
 */
export interface CognitiveResult {
  type: "multi-agent";
  security: SecurityResult;
  blocked?: boolean;
  memory?: Record<string, unknown>;
  analysis?: AnalysisResult;
  mission?: MissionResult;
  fusion?: FusionResult;
  learning?: LearningResult;
  evaluation?: EvaluationScore;
  agent_performance?: Record<string, AgentPerformanceReport>;
  pipeline_ms: number;
}

/** Final tool-execution result returned to the caller. */
export interface ToolExecutionResult {
  action: string;
  intent: string;
  confidence: number;
  memoryConfidence: number;
  plan: string[];
  context: Record<string, unknown>;
  recommendation: string;
  reasoning: string;
  toolResult: unknown;
  source: string;
}

// ── Brain processing ──────────────────────────────────────────────────────────

/**
 * Send input to the Python brain for LLM reasoning and context retrieval.
 * Falls back to a local response decision when the AI service is unavailable.
 */
export async function processBrain(
  input: string,
  nContext = 5
): Promise<BrainResult> {
  try {
    const res = await getClient().post<BrainResult>("/brain/process", {
      input,
      n_context: nContext,
    });
    return res.data;
  } catch (err) {
    console.error("[BrainService] processBrain failed:", (err as Error).message);
    // Local fallback — no AI service required
    return {
      plan: ["analyze_input", "retrieve_memory", "reason_decision", "execute_action", "evaluate_result"],
      plan_detail: [],
      decision: {
        intent: "response",
        action: "respond",
        confidence: 0,
        reasoning: "AI service unavailable — local fallback.",
        source: "keyword_fallback",
      },
      context: {},
      memory_confidence: 0,
      recommendation: "AI service unavailable — responding from local context only.",
    };
  }
}

/**
 * Run the full multi-agent cognitive pipeline via the Python Commander.
 *
 * Pipeline (Python-side):
 *   SecurityAgent → MemoryAgent → AnalysisAgent → MissionAgent
 *   (→ LearningAgent when feedback is provided)
 *
 * Falls back to a safe blocked/error payload when the AI service is down.
 */
export async function processCognitive(
  input: string,
  options: {
    nMemory?: number;
    feedback?: { rating: number; [key: string]: unknown } | null;
  } = {}
): Promise<CognitiveResult> {
  try {
    const res = await getClient().post<CognitiveResult>("/cognitive/process", {
      input,
      n_memory: options.nMemory ?? 5,
      feedback: options.feedback ?? null,
    });
    return res.data;
  } catch (err) {
    console.error("[BrainService] processCognitive failed:", (err as Error).message);
    // Graceful fallback — pipeline structure is preserved with an offline marker
    return {
      type: "multi-agent",
      security: { status: "ok" },
      memory: {},
      analysis: {
        analysis: "AI service unavailable — offline mode. No LLM analysis performed.",
        source: "offline",
      },
      mission: {
        mission_plan: ["analyze_input", "retrieve_memory", "reason_decision", "execute_action", "evaluate_result"],
        plan_detail: [],
        intent: "response",
        objective: "[response] AI service unavailable",
      },
      pipeline_ms: 0,
    };
  }
}

// ── Tool registry ─────────────────────────────────────────────────────────────

/**
 * Maps brain action names to concrete Node.js async functions.
 *
 * When the brain returns `decision.action = "memory_search"`, the tool
 * registry automatically selects `queryMemory` and invokes it with `input`.
 *
 * To add a new tool: add an entry here and register the action in brain.py's
 * _ACTIONS map.
 */
const tools: Record<string, (input: string) => Promise<unknown>> = {
  respond: async () => ({ status: "respond" }),
  execute_mission: async (input) => queryMemory(input),
  analyze: async (input) => queryMemory(input),
  ingest_knowledge: async (input) => storeMemory(input, { type: "auto_ingestion" }),
  retrieve_memory: async (input) => queryMemory(input),
  memory_store: async (input) => storeMemory(input, { type: "direct_store" }),
  memory_search: async (input) => queryMemory(input),
};

export function getRegisteredTools(): string[] {
  return Object.keys(tools);
}

// ── Tool execution ────────────────────────────────────────────────────────────

/**
 * Execute a specific registered tool by name.
 */
export async function executeTool(
  toolName: string,
  input: string
): Promise<unknown> {
  const fn = tools[toolName];
  if (!fn) throw new Error(`Unknown tool: ${toolName}`);
  return fn(input);
}

// ── Decision → action → tool dispatch ────────────────────────────────────────

/**
 * Full execution pipeline:
 *  1. Call Python brain (LLM reasoning + plan + memory context)
 *  2. Extract `decision.action` from the response
 *  3. Dispatch to the matching registered tool (or fallback to "respond")
 *  4. Return a unified result payload
 */
export async function executeDecision(
  input: string,
  nContext = 5
): Promise<ToolExecutionResult> {
  const brainResult = await processBrain(input, nContext);
  const { decision, plan, context, memory_confidence, recommendation } = brainResult;

  // Dispatch to the tool matching the brain's action
  const action = decision.action || "respond";
  let toolResult: unknown = null;
  try {
    const toolFn = tools[action];
    toolResult = toolFn ? await toolFn(input) : null;
  } catch (toolErr) {
    console.error(`[BrainService] tool '${action}' failed:`, (toolErr as Error).message);
    toolResult = { error: (toolErr as Error).message };
  }

  return {
    action,
    intent: decision.intent,
    confidence: decision.confidence,
    memoryConfidence: memory_confidence,
    plan,
    context,
    recommendation,
    reasoning: decision.reasoning,
    toolResult,
    source: decision.source,
  };
}

