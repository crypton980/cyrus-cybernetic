/**
 * CYRUS Session Memory — Redis-backed short-term (working) memory.
 *
 * Stores the last N interactions per user in a Redis list so the brain can
 * inject recent context into decisions.  The service degrades gracefully when
 * Redis is unavailable — all operations return safe defaults instead of
 * throwing, so the rest of the system is unaffected.
 *
 * Key schema:
 *   cyrus:session:<userId>   → Redis list, newest entry at index 0
 *
 * Config (env vars):
 *   REDIS_URL            — full Redis connection URL (default: redis://127.0.0.1:6379)
 *   CYRUS_SESSION_TTL    — TTL in seconds for each session key (default: 3600)
 *   CYRUS_SESSION_DEPTH  — max interactions to keep per user (default: 10)
 */

import Redis from "ioredis";

// ── Config ────────────────────────────────────────────────────────────────────

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const SESSION_TTL = parseInt(process.env.CYRUS_SESSION_TTL || "3600", 10);
const SESSION_DEPTH = parseInt(process.env.CYRUS_SESSION_DEPTH || "10", 10);
const KEY_PREFIX = "cyrus:session:";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SessionEntry {
  input: string;
  decision: Record<string, unknown>;
  timestamp: number;
  userId: string;
}

// ── Redis client (lazy, singleton) ────────────────────────────────────────────

let _redis: Redis | null = null;
let _redisUnavailable = false;

function getRedis(): Redis | null {
  if (_redisUnavailable) return null;
  if (_redis) return _redis;

  try {
    _redis = new Redis(REDIS_URL, {
      enableReadyCheck: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 2_000,
      lazyConnect: true,
    });

    _redis.on("error", (err) => {
      if (!_redisUnavailable) {
        console.warn("[SessionMemory] Redis unavailable:", err.message);
        _redisUnavailable = true;
        _redis = null;
      }
    });

    _redis.on("connect", () => {
      _redisUnavailable = false;
      console.log("[SessionMemory] Redis connected");
    });
  } catch (err) {
    console.warn("[SessionMemory] Redis init failed:", (err as Error).message);
    _redisUnavailable = true;
    _redis = null;
  }

  return _redis;
}

// ── Public interface ──────────────────────────────────────────────────────────

/**
 * Prepend a session entry to the user's history list and trim to SESSION_DEPTH.
 * Resets the TTL on each write.  No-ops silently if Redis is unavailable.
 */
export async function storeSession(
  userId: string,
  entry: Omit<SessionEntry, "userId" | "timestamp">
): Promise<void> {
  const client = getRedis();
  if (!client) return;

  const key = `${KEY_PREFIX}${userId}`;
  const record: SessionEntry = {
    ...entry,
    userId,
    timestamp: Date.now(),
  };

  try {
    await client.lpush(key, JSON.stringify(record));
    await client.ltrim(key, 0, SESSION_DEPTH - 1);
    await client.expire(key, SESSION_TTL);
  } catch (err) {
    console.warn("[SessionMemory] storeSession failed:", (err as Error).message);
  }
}

/**
 * Return the last SESSION_DEPTH interactions for the given user.
 * Returns an empty array if Redis is unavailable.
 */
export async function getSession(userId: string): Promise<SessionEntry[]> {
  const client = getRedis();
  if (!client) return [];

  const key = `${KEY_PREFIX}${userId}`;

  try {
    const items = await client.lrange(key, 0, SESSION_DEPTH - 1);
    return items.map((raw) => {
      try {
        return JSON.parse(raw) as SessionEntry;
      } catch {
        return null;
      }
    }).filter((x): x is SessionEntry => x !== null);
  } catch (err) {
    console.warn("[SessionMemory] getSession failed:", (err as Error).message);
    return [];
  }
}

/**
 * Clear all session history for a user (e.g. on logout).
 */
export async function clearSession(userId: string): Promise<void> {
  const client = getRedis();
  if (!client) return;

  try {
    await client.del(`${KEY_PREFIX}${userId}`);
  } catch (err) {
    console.warn("[SessionMemory] clearSession failed:", (err as Error).message);
  }
}

/**
 * Return true if the Redis connection is alive.
 */
export async function isRedisOnline(): Promise<boolean> {
  if (_redisUnavailable) return false;
  const client = getRedis();
  if (!client) return false;
  try {
    await client.ping();
    return true;
  } catch {
    return false;
  }
}
