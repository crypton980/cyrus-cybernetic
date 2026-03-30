/**
 * CYRUS Brain Service — Node.js client for the Python decision engine.
 *
 * Routes input through the Python brain module which classifies intent,
 * retrieves semantic context, and returns a structured decision payload.
 * Also implements the tool execution layer that translates decisions into
 * concrete server-side actions.
 */

import axios, { type AxiosInstance } from "axios";
import { storeMemory, queryMemory } from "./memoryService";

const AI_BASE_URL = process.env.CYRUS_AI_URL || "http://localhost:8001";
const AI_TIMEOUT_MS = parseInt(process.env.CYRUS_AI_TIMEOUT_MS || "10000", 10);

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

export interface BrainDecision {
  type: "mission" | "analysis" | "training" | "memory" | "response";
  intent: string;
  context: Record<string, unknown>;
  confidence: number;
  recommendation: string;
}

export interface ToolExecutionResult {
  action: string;
  decisionType: string;
  intent: string;
  confidence: number;
  context: Record<string, unknown>;
  recommendation: string;
}

// ── Brain processing ──────────────────────────────────────────────────────────

/**
 * Send input to the Python brain for intent classification and context retrieval.
 * Falls back to a local response decision when the AI service is unavailable.
 */
export async function processBrain(
  input: string,
  nContext = 5
): Promise<BrainDecision> {
  try {
    const res = await getClient().post<BrainDecision>("/brain/process", {
      input,
      n_context: nContext,
    });
    return res.data;
  } catch (err) {
    console.error("[BrainService] processBrain failed:", (err as Error).message);
    // Local fallback — no AI service required
    return {
      type: "response",
      intent: "general",
      context: {},
      confidence: 0,
      recommendation: "AI service unavailable — responding from local context only.",
    };
  }
}

// ── Tool registry ─────────────────────────────────────────────────────────────

const tools: Record<string, (...args: unknown[]) => Promise<unknown>> = {
  memory_store: async (text: unknown, metadata: unknown) =>
    storeMemory(String(text), (metadata as Record<string, unknown>) ?? {}),
  memory_search: async (query: unknown) =>
    queryMemory(String(query)),
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
  ...args: unknown[]
): Promise<unknown> {
  const fn = tools[toolName];
  if (!fn) throw new Error(`Unknown tool: ${toolName}`);
  return fn(...args);
}

// ── Decision → action mapping ─────────────────────────────────────────────────

/**
 * Translate a brain decision into a server-side action.
 *
 * Decision types:
 *   mission   → execute_mission
 *   analysis  → analyze
 *   training  → ingest_knowledge
 *   memory    → retrieve_memory
 *   response  → respond
 */
export async function executeDecision(
  input: string,
  nContext = 5
): Promise<ToolExecutionResult> {
  const decision = await processBrain(input, nContext);

  let action: string;
  switch (decision.type) {
    case "mission":
      action = "execute_mission";
      break;
    case "analysis":
      action = "analyze";
      break;
    case "training":
      action = "ingest_knowledge";
      break;
    case "memory":
      action = "retrieve_memory";
      break;
    default:
      action = "respond";
  }

  return {
    action,
    decisionType: decision.type,
    intent: decision.intent,
    confidence: decision.confidence,
    context: decision.context,
    recommendation: decision.recommendation,
  };
}
