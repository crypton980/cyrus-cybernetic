/**
 * CYRUS Memory Service — Node.js client for the Python AI microservice.
 *
 * Communicates with the FastAPI service running at CYRUS_AI_URL (default
 * http://localhost:8001).  All calls degrade gracefully when the AI service
 * is unavailable — callers receive a structured fallback instead of an
 * uncaught exception crashing the Node process.
 */

import axios, { type AxiosInstance } from "axios";

const AI_BASE_URL = process.env.CYRUS_AI_URL || "http://localhost:8001";
const AI_TIMEOUT_MS = parseInt(process.env.CYRUS_AI_TIMEOUT_MS || "8000", 10);

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

export interface MemoryQueryResult {
  ids?: string[][];
  documents?: string[][];
  metadatas?: Record<string, unknown>[][];
  distances?: number[][];
}

export interface MemoryStoreResult {
  status: string;
  id: string;
}

// ── Memory operations ─────────────────────────────────────────────────────────

/**
 * Embed and persist a memory entry in the vector store.
 * Returns the generated memory ID, or null on failure.
 */
export async function storeMemory(
  text: string,
  metadata: Record<string, unknown> = {}
): Promise<string | null> {
  try {
    const res = await getClient().post<MemoryStoreResult>("/memory/store", { text, metadata });
    return res.data.id;
  } catch (err) {
    console.error("[MemoryService] storeMemory failed:", (err as Error).message);
    return null;
  }
}

/**
 * Semantic similarity search across all stored memories.
 */
export async function queryMemory(
  query: string,
  nResults = 5
): Promise<MemoryQueryResult> {
  try {
    const res = await getClient().post<MemoryQueryResult>("/memory/query", {
      query,
      n_results: nResults,
    });
    return res.data;
  } catch (err) {
    console.error("[MemoryService] queryMemory failed:", (err as Error).message);
    return {};
  }
}

/**
 * Delete a specific memory entry by ID.
 */
export async function deleteMemory(memoryId: string): Promise<boolean> {
  try {
    await getClient().delete(`/memory/${memoryId}`);
    return true;
  } catch (err) {
    console.error("[MemoryService] deleteMemory failed:", (err as Error).message);
    return false;
  }
}

/**
 * Return collection statistics (count, persist path, etc.).
 */
export async function getMemoryStats(): Promise<Record<string, unknown>> {
  try {
    const res = await getClient().get<Record<string, unknown>>("/memory/stats");
    return res.data;
  } catch (err) {
    console.error("[MemoryService] getMemoryStats failed:", (err as Error).message);
    return { error: "AI service unavailable" };
  }
}

// ── Feedback / interaction logging ────────────────────────────────────────────

export interface FeedbackPayload {
  input: string;
  response: string;
  rating: number;
  userId?: string;
  context?: string;
}

/**
 * Log a rated interaction to the learning engine.
 */
export async function logFeedback(
  payload: FeedbackPayload
): Promise<{ action: string; memoryId: string | null }> {
  try {
    const res = await getClient().post<{ action: string; memoryId: string }>("/feedback", payload);
    return res.data;
  } catch (err) {
    console.error("[MemoryService] logFeedback failed:", (err as Error).message);
    return { action: "unknown", memoryId: null };
  }
}

/**
 * Log a raw CYRUS interaction for future context retrieval.
 */
export async function logInteraction(
  userInput: string,
  cyrusResponse: string,
  metadata: Record<string, unknown> = {}
): Promise<string | null> {
  try {
    const res = await getClient().post<{ status: string; id: string }>("/interaction", {
      userInput,
      cyrusResponse,
      metadata,
    });
    return res.data.id;
  } catch (err) {
    console.error("[MemoryService] logInteraction failed:", (err as Error).message);
    return null;
  }
}

// ── AI service health ─────────────────────────────────────────────────────────

export async function isAiServiceOnline(): Promise<boolean> {
  try {
    await getClient().get("/health");
    return true;
  } catch {
    return false;
  }
}
