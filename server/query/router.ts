/**
 * CYRUS Universal Intelligent Query Router
 *
 * Processes any natural-language query, task, or question and routes it
 * across both internal sources (system database, memories, conversations,
 * files) and external sources (NewsAPI, web scraping), then returns:
 *
 *   - intent         : classified query intent
 *   - module         : the best-matching CYRUS module name
 *   - navigateTo     : client-side route path to open for the user
 *   - internalResults: records found in the internal database / memory
 *   - externalResults: results from live external sources
 *   - aiAnswer       : synthesised AI answer incorporating all sources
 *   - sources        : list of sources consulted
 *   - confidence     : 0–1 overall routing confidence
 *
 * ── Architecture ──────────────────────────────────────────────────────────────
 * Layer 1 – Keyword fast-path (< 1 ms)
 *   Maps common signal words to a module + intent without any API call.
 *
 * Layer 2 – Regex pattern matching (< 1 ms)
 *   More precise phrase patterns per module.
 *
 * Layer 3 – GPT-4o-mini intent classification (only when layers 1-2 are unsure)
 *   Sends a compact system prompt + query to classify intent + select module.
 *
 * Layer 4 – Parallel source search
 *   Internal: system database deep-search, memories, conversations
 *   External: NewsAPI + web scraping (when query needs live data)
 *
 * Layer 5 – AI synthesis
 *   Feeds all gathered context to GPT-4o for a final grounded answer.
 */

import { Router, Request, Response } from "express";
import { eq, desc, ilike, or } from "drizzle-orm";
import { db } from "../db";
import { memories, conversations, uploadedFiles } from "../../shared/schema";
import { deepSearch } from "../sysdb/search-engine";
import fetch from "node-fetch";

const router = Router();

// ── Module map ────────────────────────────────────────────────────────────────

interface ModuleDescriptor {
  name: string;
  path: string;
  keywords: string[];
  patterns: RegExp[];
  description: string;
  supportsExternalSearch: boolean;
}

const MODULES: ModuleDescriptor[] = [
  {
    name: "Vision / Scan",
    path: "/scan",
    keywords: ["scan", "face", "camera", "image", "photo", "qr", "barcode", "vision", "detect", "recognition", "iris", "fingerprint", "identify", "visual"],
    patterns: [/\b(scan|detect|recognize|identify|face|biometric|qr code|barcode|iris|fingerprint)\b/i],
    description: "Optical analysis, biometric scanning, QR/barcode, face recognition",
    supportsExternalSearch: false,
  },
  {
    name: "Communications",
    path: "/comms",
    keywords: ["message", "chat", "call", "comms", "communication", "contact", "talk", "voice", "signal", "radio", "broadcast"],
    patterns: [/\b(message|send|chat|call|contact|communicate|voice|radio|broadcast)\b/i],
    description: "Secure communications, messaging, voice channels",
    supportsExternalSearch: false,
  },
  {
    name: "Navigation",
    path: "/nav",
    keywords: ["navigate", "map", "location", "gps", "route", "direction", "geospatial", "coordinate", "place", "address", "where"],
    patterns: [/\b(navigate|map|location|gps|route|direction|coordinate|address|where is|near)\b/i],
    description: "Geospatial navigation, GPS, mapping",
    supportsExternalSearch: true,
  },
  {
    name: "Trading / Markets",
    path: "/trading",
    keywords: ["trade", "stock", "market", "price", "crypto", "bitcoin", "forex", "investment", "financial", "asset", "portfolio", "chart"],
    patterns: [/\b(trade|stock|market|crypto|bitcoin|forex|invest|price|asset|portfolio|etf|nasdaq|s&p|dow)\b/i],
    description: "Financial markets, trading intelligence",
    supportsExternalSearch: true,
  },
  {
    name: "Medical",
    path: "/medical",
    keywords: ["medical", "health", "doctor", "diagnosis", "symptom", "disease", "patient", "treatment", "drug", "medicine", "vital", "ecg", "blood pressure"],
    patterns: [/\b(medical|health|doctor|diagnos|symptom|disease|patient|treatment|drug|medicine|vital|ecg|blood pressure|heart rate)\b/i],
    description: "Medical diagnostics, health monitoring",
    supportsExternalSearch: true,
  },
  {
    name: "Drone / Aerospace",
    path: "/drone",
    keywords: ["drone", "uav", "flight", "aerial", "flyover", "altitude", "aircraft", "pilot", "autopilot", "waypoint"],
    patterns: [/\b(drone|uav|fly|flight|aerial|altitude|aircraft|autopilot|waypoint)\b/i],
    description: "UAV operations, aerial surveillance",
    supportsExternalSearch: false,
  },
  {
    name: "Device Control",
    path: "/device",
    keywords: ["device", "hardware", "sensor", "control", "system", "power", "cpu", "memory", "network", "iot"],
    patterns: [/\b(device|hardware|sensor|control system|power|cpu|memory usage|network|iot)\b/i],
    description: "Hardware control, system monitoring, IoT",
    supportsExternalSearch: false,
  },
  {
    name: "Security",
    path: "/security",
    keywords: ["security", "encrypt", "password", "threat", "intrusion", "firewall", "cyber", "access", "authentication", "surveillance"],
    patterns: [/\b(security|encrypt|password|threat|intrusion|firewall|cyber|access control|auth|surveillance)\b/i],
    description: "Cybersecurity, encryption, threat analysis",
    supportsExternalSearch: true,
  },
  {
    name: "Biology / Lab",
    path: "/biology",
    keywords: ["biology", "lab", "dna", "gene", "cell", "organism", "specimen", "analysis", "microscope", "protein", "enzyme"],
    patterns: [/\b(biology|lab|dna|gene|cell|organism|specimen|microscope|protein|enzyme|molecular)\b/i],
    description: "Laboratory analysis, biology, genetics",
    supportsExternalSearch: true,
  },
  {
    name: "Blood Sampling",
    path: "/blood",
    keywords: ["blood", "sample", "hemoglobin", "platelet", "cbc", "glucose", "cholesterol", "rbc", "wbc"],
    patterns: [/\b(blood|sample|hemoglobin|platelet|cbc|glucose|cholesterol|rbc|wbc|hematology)\b/i],
    description: "Blood analysis and sampling",
    supportsExternalSearch: false,
  },
  {
    name: "Quantum Intelligence",
    path: "/quantum",
    keywords: ["quantum", "neural", "ai", "intelligence", "cognitive", "brain", "deep learning", "reasoning", "algorithm"],
    patterns: [/\b(quantum|neural network|cognitive|intelligence engine|deep learning|reasoning|algorithm)\b/i],
    description: "Quantum AI, neural networks, advanced reasoning",
    supportsExternalSearch: false,
  },
  {
    name: "File Analysis",
    path: "/files",
    keywords: ["file", "document", "pdf", "analyze", "upload", "report", "extract", "parse", "word", "excel"],
    patterns: [/\b(file|document|pdf|analyze|upload|report|extract|parse|word|excel|spreadsheet)\b/i],
    description: "Document analysis, file processing",
    supportsExternalSearch: false,
  },
  {
    name: "Modules / Orchestration",
    path: "/modules",
    keywords: ["module", "orchestrat", "workflow", "automat", "task", "pipeline", "agent"],
    patterns: [/\b(module|orchestrat|workflow|automat|task|pipeline|agent)\b/i],
    description: "AI module orchestration and workflow automation",
    supportsExternalSearch: false,
  },
  {
    name: "Command / Dashboard",
    path: "/",
    keywords: ["status", "overview", "dashboard", "summary", "main", "home", "command"],
    patterns: [/\b(status|overview|dashboard|summary|main|command center)\b/i],
    description: "Primary command interface",
    supportsExternalSearch: false,
  },
];

// ── Layer 1 + 2: Fast keyword/pattern classification ─────────────────────────

interface ClassifyResult {
  module: ModuleDescriptor;
  confidence: number;
  method: "keyword" | "pattern" | "ai";
  needsExternal: boolean;
  queryType: "internal" | "external" | "both";
}

function classifyLocally(query: string): ClassifyResult | null {
  const q = query.toLowerCase();

  // Score every module
  const scores = MODULES.map((mod) => {
    let score = 0;
    // keyword hits (each +2)
    for (const kw of mod.keywords) {
      if (q.includes(kw)) score += 2;
    }
    // pattern hits (each +4)
    for (const pat of mod.patterns) {
      if (pat.test(query)) score += 4;
    }
    return { mod, score };
  });

  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];
  if (best.score === 0) return null;

  // Determine if external sources are needed
  const externalSignals = /\b(latest|current|today|news|live|real.?time|price|weather|update|trending|recent|search|web|google)\b/i.test(query);
  const needsExternal = externalSignals || best.mod.supportsExternalSearch;

  const queryType: ClassifyResult["queryType"] =
    needsExternal && best.score < 6 ? "both" : needsExternal ? "external" : "internal";

  return {
    module: best.mod,
    confidence: Math.min(1, best.score / 12),
    method: best.score >= 4 ? "pattern" : "keyword",
    needsExternal,
    queryType,
  };
}

// ── Layer 3: AI classification (fallback) ─────────────────────────────────────

async function classifyWithAI(query: string, openaiKey: string): Promise<ClassifyResult> {
  const moduleList = MODULES.map((m) => `"${m.name}" (path: ${m.path}): ${m.description}`).join("\n");

  try {
    const openai = new (await import("openai")).default({ apiKey: openaiKey });
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are CYRUS query classifier. Map the user query to the best module from this list:\n${moduleList}\n
Return JSON: {"module": "<name>", "path": "<path>", "queryType": "internal|external|both", "confidence": 0.0-1.0, "reasoning": "..."}`,
        },
        { role: "user", content: query },
      ],
      max_tokens: 200,
      response_format: { type: "json_object" },
    });

    type AIResult = { module: string; path: string; queryType: string; confidence: number; reasoning: string };
    const result: AIResult = JSON.parse(resp.choices[0].message.content || "{}");
    const matchedModule = MODULES.find((m) => m.path === result.path) || MODULES[MODULES.length - 1];

    return {
      module: matchedModule,
      confidence: result.confidence || 0.5,
      method: "ai",
      needsExternal: result.queryType !== "internal",
      queryType: (result.queryType as ClassifyResult["queryType"]) || "internal",
    };
  } catch {
    // Fall back to Command module
    return {
      module: MODULES[MODULES.length - 1],
      confidence: 0.3,
      method: "ai",
      needsExternal: false,
      queryType: "internal",
    };
  }
}

// ── Internal search ───────────────────────────────────────────────────────────

interface InternalResult {
  source: string;
  id: string;
  title: string;
  excerpt: string;
  score?: number;
  matchReason?: string;
  type: string;
}

async function searchInternal(query: string): Promise<InternalResult[]> {
  const results: InternalResult[] = [];

  // Run all internal searches in parallel
  const [sysdbResults, memoryResults, convResults] = await Promise.allSettled([
    // System database deep search
    deepSearch({ query, limit: 5, useAI: false }),

    // Memories
    db
      .select({ id: memories.id, content: memories.content, category: memories.category, importance: memories.importance })
      .from(memories)
      .where(ilike(memories.content, `%${query.trim().split(" ").slice(0, 3).join(" ")}%`))
      .orderBy(desc(memories.importance))
      .limit(5),

    // Conversations
    db
      .select({ id: conversations.id, title: conversations.title, summary: conversations.summary, createdAt: conversations.createdAt })
      .from(conversations)
      .where(
        or(
          ilike(conversations.title, `%${query.trim().slice(0, 40)}%`),
          ilike(conversations.summary as any, `%${query.trim().slice(0, 40)}%`),
        ),
      )
      .orderBy(desc(conversations.createdAt))
      .limit(3),
  ]);

  if (sysdbResults.status === "fulfilled") {
    for (const m of sysdbResults.value) {
      const rec = m.record as Record<string, unknown>;
      results.push({
        source: "System Database",
        id: String(rec.id || ""),
        title: String(rec.label || ""),
        excerpt: String(rec.value || "").slice(0, 200),
        score: m.score,
        matchReason: m.matchReason,
        type: String(rec.record_type || "record"),
      });
    }
  }

  if (memoryResults.status === "fulfilled") {
    for (const mem of memoryResults.value) {
      results.push({
        source: "Memory",
        id: String(mem.id || ""),
        title: `Memory [${mem.category || "general"}]`,
        excerpt: String(mem.content || "").slice(0, 200),
        score: (mem.importance as number) / 10,
        type: "memory",
      });
    }
  }

  if (convResults.status === "fulfilled") {
    for (const conv of convResults.value) {
      results.push({
        source: "Conversation",
        id: String(conv.id || ""),
        title: String(conv.title || "Untitled Conversation"),
        excerpt: String((conv as any).summary || "").slice(0, 200),
        type: "conversation",
      });
    }
  }

  return results;
}

// ── External search ───────────────────────────────────────────────────────────

interface ExternalResult {
  source: string;
  title: string;
  url?: string;
  excerpt: string;
  publishedAt?: string;
}

async function searchExternal(query: string): Promise<ExternalResult[]> {
  const results: ExternalResult[] = [];
  const newsKey = process.env.NEWS_API_KEY;

  await Promise.allSettled([
    // NewsAPI
    (async () => {
      if (!newsKey) return;
      try {
        const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query.slice(0, 100))}&pageSize=5&sortBy=relevancy&language=en&apiKey=${newsKey}`;
        const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!resp.ok) return;
        const data = await resp.json() as { articles?: Array<{ title: string; url: string; description: string; publishedAt: string; source: { name: string } }> };
        for (const a of data.articles || []) {
          results.push({
            source: `News: ${a.source?.name || "NewsAPI"}`,
            title: a.title || "",
            url: a.url,
            excerpt: (a.description || "").slice(0, 300),
            publishedAt: a.publishedAt,
          });
        }
      } catch {
        // ignore
      }
    })(),

    // Wikipedia summary (free, no key required)
    (async () => {
      try {
        // Extract a clean search term (first 3–5 significant words)
        const term = query.replace(/\b(what is|who is|how does|tell me about|explain|find|search for)\b/gi, "").trim().split(/\s+/).slice(0, 5).join(" ");
        if (!term) return;
        const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(term)}`;
        const resp = await fetch(url, { signal: AbortSignal.timeout(6000) });
        if (!resp.ok) return;
        const data = await resp.json() as { title?: string; extract?: string; content_urls?: { desktop?: { page?: string } } };
        if (data.extract) {
          results.push({
            source: "Wikipedia",
            title: data.title || term,
            url: data.content_urls?.desktop?.page,
            excerpt: data.extract.slice(0, 500),
          });
        }
      } catch {
        // ignore
      }
    })(),
  ]);

  return results;
}

// ── AI synthesis ──────────────────────────────────────────────────────────────

async function synthesiseAnswer(
  query: string,
  internal: InternalResult[],
  external: ExternalResult[],
  module: ModuleDescriptor,
  openaiKey: string,
): Promise<string> {
  if (!openaiKey) return "";

  try {
    const internalCtx = internal
      .slice(0, 5)
      .map((r) => `[${r.source}] ${r.title}: ${r.excerpt}`)
      .join("\n");

    const externalCtx = external
      .slice(0, 4)
      .map((r) => `[${r.source}] ${r.title}: ${r.excerpt}`)
      .join("\n");

    const context = [internalCtx, externalCtx].filter(Boolean).join("\n\n");

    const openai = new (await import("openai")).default({ apiKey: openaiKey });
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are CYRUS, an advanced AI assistant. Answer the user's query concisely using the provided context from internal and external sources. 
If no relevant context is available, answer from your knowledge. Be precise and actionable. 
The query has been routed to the "${module.name}" module (${module.path}).`,
        },
        {
          role: "user",
          content: context
            ? `Query: ${query}\n\nAvailable context:\n${context}`
            : `Query: ${query}`,
        },
      ],
      max_tokens: 600,
    });

    return resp.choices[0]?.message?.content || "";
  } catch {
    return "";
  }
}

// ── Main route handler ────────────────────────────────────────────────────────

router.post("/", async (req: Request, res: Response) => {
  try {
    const { query, searchInternal: doInternal = true, searchExternal: doExternal = true } = req.body as {
      query?: string;
      searchInternal?: boolean;
      searchExternal?: boolean;
    };

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: "query is required" });
    }
    if (query.trim().length < 2) {
      return res.status(400).json({ error: "Query must be at least 2 characters" });
    }

    const q = query.trim().slice(0, 500); // cap length
    const openaiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY || "";

    // ── Layer 1 & 2: fast local classification ────────────────────────────────
    let classification = classifyLocally(q);

    // ── Layer 3: AI classification if confidence is low ───────────────────────
    if (!classification || classification.confidence < 0.3) {
      if (openaiKey) {
        classification = await classifyWithAI(q, openaiKey);
      } else {
        classification = classification || {
          module: MODULES[MODULES.length - 1],
          confidence: 0.2,
          method: "keyword",
          needsExternal: false,
          queryType: "internal",
        };
      }
    }

    const { module, confidence, method, needsExternal, queryType } = classification;

    // ── Layer 4: Parallel source search ──────────────────────────────────────
    const runInternal = doInternal && (queryType === "internal" || queryType === "both");
    const runExternal = doExternal && (queryType === "external" || queryType === "both") && needsExternal;

    const [internalResults, externalResults] = await Promise.all([
      runInternal ? searchInternal(q) : Promise.resolve([] as InternalResult[]),
      runExternal ? searchExternal(q) : Promise.resolve([] as ExternalResult[]),
    ]);

    // ── Layer 5: AI synthesis ──────────────────────────────────────────────────
    const allHaveContext = internalResults.length > 0 || externalResults.length > 0;
    const aiAnswer = openaiKey && (allHaveContext || queryType === "external")
      ? await synthesiseAnswer(q, internalResults, externalResults, module, openaiKey)
      : "";

    const sources: string[] = [];
    if (internalResults.length > 0) sources.push("Internal Database");
    if (externalResults.some((r) => r.source.startsWith("News"))) sources.push("NewsAPI");
    if (externalResults.some((r) => r.source === "Wikipedia")) sources.push("Wikipedia");
    if (aiAnswer) sources.push("CYRUS AI");

    return res.json({
      query: q,
      intent: module.name,
      module: module.name,
      navigateTo: module.path,
      moduleDescription: module.description,
      confidence,
      classificationMethod: method,
      queryType,
      internalResults,
      externalResults,
      aiAnswer,
      sources,
      totalFound: internalResults.length + externalResults.length,
    });
  } catch (err: any) {
    console.error("[Query Router] Error:", err);
    return res.status(500).json({ error: "Query routing failed", details: err?.message });
  }
});

export default router;
console.log("[Query Router] Intelligent query router initialized");
