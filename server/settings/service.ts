/**
 * Settings Service — reads and writes runtime configuration (API keys, etc.)
 * from the system_settings database table.  Values stored here take priority
 * over environment variables so that keys can be updated without restarting
 * the server.
 */

import { db } from "../db";
import { systemSettings } from "../../shared/schema";
import { eq } from "drizzle-orm";

// ─── Generic helpers ──────────────────────────────────────────────────────────

export async function getSetting(key: string): Promise<string | null> {
  try {
    const rows = await db
      .select({ value: systemSettings.value })
      .from(systemSettings)
      .where(eq(systemSettings.key, key))
      .limit(1);
    return rows[0]?.value ?? null;
  } catch {
    return null;
  }
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(systemSettings)
    .values({ key, value })
    .onConflictDoUpdate({ target: systemSettings.key, set: { value, updatedAt: new Date() } });
}

export async function deleteSetting(key: string): Promise<void> {
  await db.delete(systemSettings).where(eq(systemSettings.key, key));
}

// ─── Typed helpers for each known API key ────────────────────────────────────

const OPENAI_KEY = "openai_api_key";
const OPENAI_MODEL_KEY = "openai_model";
const OPENAI_BASE_URL_KEY = "openai_base_url";
const ELEVENLABS_KEY = "elevenlabs_api_key";
const NEWS_API_KEY = "news_api_key";

export async function getOpenAIKey(): Promise<string | null> {
  return (await getSetting(OPENAI_KEY)) ||
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY ||
    process.env.OPENAI_API_KEY ||
    null;
}

export async function getOpenAIModel(): Promise<string> {
  return (await getSetting(OPENAI_MODEL_KEY)) ||
    process.env.AI_INTEGRATIONS_OPENAI_MODEL ||
    process.env.OPENAI_MODEL ||
    "gpt-4o";
}

export async function getOpenAIBaseUrl(): Promise<string | null> {
  return (await getSetting(OPENAI_BASE_URL_KEY)) ||
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ||
    process.env.OPENAI_BASE_URL ||
    null;
}

export async function getElevenLabsKey(): Promise<string | null> {
  return (await getSetting(ELEVENLABS_KEY)) ||
    process.env.ELEVENLABS_API_KEY ||
    null;
}

export async function getNewsApiKey(): Promise<string | null> {
  return (await getSetting(NEWS_API_KEY)) ||
    process.env.NEWS_API_KEY ||
    null;
}

// ─── Bulk status (for the Settings UI) ───────────────────────────────────────

function maskKey(key: string | null): string {
  if (!key) return "";
  if (key.length <= 8) return "*".repeat(key.length);
  // For short keys, show only the last 4 chars to limit exposure
  if (key.length < 20) return "*".repeat(key.length - 4) + key.slice(-4);
  return key.slice(0, 4) + "*".repeat(key.length - 8) + key.slice(-4);
}

export async function getSettingsStatus() {
  const [openaiKey, elevenLabsKey, newsKey, model, baseUrl] = await Promise.all([
    getOpenAIKey(),
    getElevenLabsKey(),
    getNewsApiKey(),
    getOpenAIModel(),
    getOpenAIBaseUrl(),
  ]);
  return {
    openai: {
      configured: !!openaiKey,
      maskedKey: maskKey(openaiKey),
      model,
      baseUrl: baseUrl ?? "",
    },
    elevenLabs: {
      configured: !!elevenLabsKey,
      maskedKey: maskKey(elevenLabsKey),
    },
    newsApi: {
      configured: !!newsKey,
      maskedKey: maskKey(newsKey),
    },
  };
}
