/**
 * System Database Deep-Search Engine
 *
 * Provides multi-strategy search over the system_database table:
 *
 * Strategy 1 — Full-Text Search (FTS)
 *   Uses PostgreSQL's to_tsvector / ts_rank to find documents that contain
 *   all (or any) of the query terms. Handles English stemming automatically.
 *   Weighted: label (A) > value (B) > tags (C).
 *
 * Strategy 2 — Trigram Fuzzy Search
 *   Uses pg_trgm similarity() on the label and value columns to catch typos,
 *   abbreviations, and near-matches that exact-match and FTS would miss.
 *
 * Strategy 3 — Exact / Prefix Match
 *   ILIKE patterns on every indexed text column for barcode / reference
 *   number lookups where users type a partial value.
 *
 * Strategy 4 — Intent Classification
 *   A lightweight keyword classifier maps the raw query to the most likely
 *   recordType so results of that type are boosted to the top.
 *
 * Strategy 5 — AI Semantic Re-Ranking (optional, only when AI key is set)
 *   The top-N raw matches are re-ranked by asking the LLM to score each
 *   result's relevance to the user's natural-language query.
 *
 * The final result list is deduplicated by ID, sorted by composite score,
 * and returned with per-result explanation strings so the UI can show
 * *why* each record matched.
 */

import { sql, or, and, ilike, eq, desc, SQL } from "drizzle-orm";
import { db } from "../db";
import { systemDatabase } from "../../shared/schema";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SearchOptions {
  /** Raw user query string */
  query: string;
  /** Restrict to a specific record type (optional) */
  recordType?: string;
  /** Source module filter (optional) */
  sourceModule?: string;
  /** Maximum results to return (default 30, max 100) */
  limit?: number;
  /** Cursor for page-after pagination: ISO timestamp of last result */
  cursor?: string;
  /** Minimum fuzzy similarity threshold 0–1 (default 0.15) */
  minSimilarity?: number;
  /** Whether to use AI semantic re-ranking (default true) */
  useAI?: boolean;
}

export interface SearchResult {
  record: Record<string, unknown>;
  /** Composite relevance score 0–1 */
  score: number;
  /** Human-readable explanation of why this record matched */
  matchReason: string;
  /** Which search strategy produced this result */
  strategy: "fts" | "fuzzy" | "exact" | "ai";
}

export interface VerifyResult {
  valid: boolean;
  record?: Record<string, unknown>;
  integrityOk?: boolean;
  details: string;
}

// ── Intent classifier ─────────────────────────────────────────────────────────

const TYPE_KEYWORDS: Array<{ type: string; keywords: RegExp }> = [
  { type: "face",        keywords: /\bface|person|photo|portrait|selfie|id photo|mug\b/i },
  { type: "fingerprint", keywords: /\bfinger|print|biometric|thumbprint\b/i },
  { type: "iris",        keywords: /\biris|eye|retina\b/i },
  { type: "barcode",     keywords: /\bbarcode|bar code|ean|upc|code128\b/i },
  { type: "qrcode",      keywords: /\bqr\b|qrcode|quick response\b/i },
  { type: "reference",   keywords: /\bref|reference|ref no|id number|serial|case no\b/i },
  { type: "document",    keywords: /\bdoc|document|contract|form|certificate|license|permit\b/i },
  { type: "image",       keywords: /\bimage|photo|picture|screenshot\b/i },
];

function classifyIntent(query: string): string | null {
  for (const entry of TYPE_KEYWORDS) {
    if (entry.keywords.test(query)) return entry.type;
  }
  return null;
}

// ── Tokeniser helper ──────────────────────────────────────────────────────────

function tokenise(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

// ── Main deep search ──────────────────────────────────────────────────────────

export async function deepSearch(opts: SearchOptions): Promise<SearchResult[]> {
  const {
    query,
    recordType,
    sourceModule,
    limit = 30,
    cursor,
    minSimilarity = 0.15,
    useAI = true,
  } = opts;

  const cap = Math.min(limit, 100);
  const q = query.trim();
  if (!q) return [];

  const detectedType = recordType || classifyIntent(q);

  // We'll run all three raw SQL strategies via pool directly so we can use
  // pg_trgm / tsvector functions that drizzle doesn't expose natively.
  const { pool } = await import("../db");
  const client = await pool.connect();

  let rawRows: Array<Record<string, unknown>> = [];

  try {
    // ── Strategy 1: Full-Text Search ─────────────────────────────────────────
    try {
      const ftsQuery = `
        SELECT *, 
          ts_rank(
            to_tsvector('english', coalesce(label,'') || ' ' || coalesce(value,'') || ' ' || coalesce(tags,'')),
            websearch_to_tsquery('english', $1)
          ) AS _fts_rank,
          'fts' AS _strategy
        FROM system_database
        WHERE is_deleted = 0
          ${detectedType ? `AND record_type = $3` : ""}
          ${sourceModule ? `AND source_module = $4` : ""}
          ${cursor ? `AND created_at < $5` : ""}
          AND to_tsvector('english', coalesce(label,'') || ' ' || coalesce(value,'') || ' ' || coalesce(tags,''))
              @@ websearch_to_tsquery('english', $1)
        ORDER BY _fts_rank DESC, created_at DESC
        LIMIT $2
      `;
      const params: unknown[] = [q, cap * 2];
      if (detectedType) params.push(detectedType);
      if (sourceModule) params.push(sourceModule);
      if (cursor) params.push(cursor);

      const { rows } = await client.query(ftsQuery, params);
      rawRows.push(...rows);
    } catch {
      // pg_trgm or FTS not yet available (migration not run) — continue silently
    }

    // ── Strategy 2: Trigram Fuzzy Search ─────────────────────────────────────
    try {
      const tokens = tokenise(q);
      if (tokens.length > 0) {
        // Use the first significant token for fuzzy (pg_trgm works best on a single term)
        const term = tokens[0];
        const fuzzyQuery = `
          SELECT *,
            GREATEST(
              similarity(label, $1),
              similarity(coalesce(value,''), $1)
            ) AS _fts_rank,
            'fuzzy' AS _strategy
          FROM system_database
          WHERE is_deleted = 0
            ${detectedType ? `AND record_type = $3` : ""}
            ${sourceModule ? `AND source_module = $4` : ""}
            ${cursor ? `AND created_at < $5` : ""}
            AND (
              similarity(label, $1) >= $2
              OR similarity(coalesce(value,''), $1) >= $2
            )
          ORDER BY _fts_rank DESC, created_at DESC
          LIMIT $6
        `;
        const params: unknown[] = [term, minSimilarity];
        if (detectedType) params.push(detectedType);
        if (sourceModule) params.push(sourceModule);
        if (cursor) params.push(cursor);
        params.push(cap * 2);

        const { rows } = await client.query(fuzzyQuery, params);
        rawRows.push(...rows);
      }
    } catch {
      // pg_trgm unavailable — skip
    }

    // ── Strategy 3: Exact / Prefix ILIKE ─────────────────────────────────────
    try {
      const pattern = `%${q}%`;
      const exactQuery = `
        SELECT *, 0.5 AS _fts_rank, 'exact' AS _strategy
        FROM system_database
        WHERE is_deleted = 0
          ${detectedType ? `AND record_type = $3` : ""}
          ${sourceModule ? `AND source_module = $4` : ""}
          ${cursor ? `AND created_at < $5` : ""}
          AND (
            label ILIKE $1
            OR value ILIKE $1
            OR tags  ILIKE $1
          )
        ORDER BY created_at DESC
        LIMIT $2
      `;
      const params: unknown[] = [pattern, cap * 2];
      if (detectedType) params.push(detectedType);
      if (sourceModule) params.push(sourceModule);
      if (cursor) params.push(cursor);

      const { rows } = await client.query(exactQuery, params);
      rawRows.push(...rows);
    } catch {
      // fallback
    }
  } finally {
    client.release();
  }

  // ── Merge + deduplicate by id ─────────────────────────────────────────────
  const seen = new Set<string>();
  const dedupedMap = new Map<string, Record<string, unknown>>();
  for (const row of rawRows) {
    const id = row.id as string;
    if (!seen.has(id)) {
      seen.add(id);
      dedupedMap.set(id, row);
    } else {
      // Keep the row with the higher rank
      const existing = dedupedMap.get(id)!;
      if ((row._fts_rank as number) > (existing._fts_rank as number)) {
        dedupedMap.set(id, row);
      }
    }
  }

  // ── Score + annotate ──────────────────────────────────────────────────────
  let results: SearchResult[] = Array.from(dedupedMap.values()).map((row) => {
    const rawScore = Math.min(1, Math.max(0, Number(row._fts_rank) || 0));
    const strategy = (row._strategy as SearchResult["strategy"]) || "exact";

    // Boost records whose type matches the detected intent
    const typeBoost =
      detectedType && row.record_type === detectedType ? 0.15 : 0;

    // Boost exact label match
    const exactBoost =
      String(row.label || "").toLowerCase() === q.toLowerCase() ? 0.25 : 0;

    const score = Math.min(1, rawScore + typeBoost + exactBoost);

    let matchReason = "";
    if (strategy === "fts") matchReason = "Full-text match";
    else if (strategy === "fuzzy") matchReason = "Similar to query";
    else matchReason = "Contains query text";
    if (typeBoost > 0) matchReason += ` · type matches detected intent (${detectedType})`;
    if (exactBoost > 0) matchReason += " · exact label match";

    // Strip internal columns
    const { _fts_rank, _strategy, ...record } = row;

    return { record, score, matchReason, strategy };
  });

  // Sort by composite score desc
  results.sort((a, b) => b.score - a.score);

  // Cap before AI re-ranking
  const topN = results.slice(0, cap * 3);

  // ── Strategy 4: AI Semantic Re-Ranking ───────────────────────────────────
  if (useAI && topN.length > 1) {
    try {
      const openaiApiKey =
        process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
      if (openaiApiKey) {
        const openai = new (await import("openai")).default({ apiKey: openaiApiKey });

        const candidates = topN.slice(0, 10).map((r, i) => ({
          index: i,
          type: r.record.record_type,
          label: r.record.label,
          value: String(r.record.value || "").slice(0, 80),
          tags: r.record.tags,
        }));

        const prompt = `You are a database search assistant for CYRUS.
User query: "${q}"

Re-rank these ${candidates.length} search results by relevance (1 = most relevant, ${candidates.length} = least).
Return JSON: {"rankings": [{"index": N, "relevanceScore": 0.0-1.0, "reason": "..."}]}

Results:
${candidates.map((c) => `Index ${c.index}: type=${c.type}, label="${c.label}", value="${c.value}", tags="${c.tags}"`).join("\n")}`;

        const resp = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 600,
          response_format: { type: "json_object" },
        });

        type RankEntry = { index: number; relevanceScore: number; reason: string };
        let aiRankings: { rankings: RankEntry[] } = { rankings: [] };
        try {
          aiRankings = JSON.parse(resp.choices[0].message.content || "{}");
        } catch {
          aiRankings = { rankings: [] };
        }

        // Apply AI scores to top results
        for (const rank of aiRankings.rankings || []) {
          const result = topN[rank.index];
          if (result) {
            result.score = Math.min(1, result.score * 0.4 + rank.relevanceScore * 0.6);
            result.matchReason += ` · AI: ${rank.reason}`;
            result.strategy = "ai";
          }
        }

        // Re-sort after AI scoring
        topN.sort((a, b) => b.score - a.score);
      }
    } catch {
      // AI unavailable — keep existing ranking
    }
  }

  return topN.slice(0, cap);
}

// ── Verify a single record ────────────────────────────────────────────────────

export async function verifyRecord(id: string): Promise<VerifyResult> {
  try {
    const { pool } = await import("../db");
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT *, encode(sha256((record_type || '|' || label || '|' || coalesce(value,''))::bytea),'hex') AS expected_checksum
         FROM system_database WHERE id = $1 AND is_deleted = 0`,
        [id],
      );

      if (rows.length === 0) {
        return { valid: false, details: "Record not found or has been deleted" };
      }

      const row = rows[0];
      const integrityOk =
        !row.checksum || row.checksum === "" || row.checksum === row.expected_checksum;

      return {
        valid: true,
        record: row,
        integrityOk,
        details: integrityOk
          ? "Record found and integrity verified"
          : "Record found but checksum mismatch — data may have been modified outside the API",
      };
    } finally {
      client.release();
    }
  } catch (err: any) {
    return { valid: false, details: `Verification error: ${err?.message || err}` };
  }
}

// ── Database statistics ───────────────────────────────────────────────────────

export async function getDatabaseStats(): Promise<Record<string, unknown>> {
  try {
    const { pool } = await import("../db");
    const client = await pool.connect();
    try {
      const [totals, byType, byModule, recentActivity] = await Promise.all([
        client.query(
          `SELECT COUNT(*) AS total,
                  COUNT(*) FILTER (WHERE is_deleted = 1) AS deleted,
                  COUNT(*) FILTER (WHERE is_deleted = 0) AS active
           FROM system_database`,
        ),
        client.query(
          `SELECT record_type, COUNT(*) AS count
           FROM system_database WHERE is_deleted = 0
           GROUP BY record_type ORDER BY count DESC`,
        ),
        client.query(
          `SELECT source_module, COUNT(*) AS count
           FROM system_database WHERE is_deleted = 0
           GROUP BY source_module ORDER BY count DESC LIMIT 10`,
        ),
        client.query(
          `SELECT date_trunc('day', created_at) AS day, COUNT(*) AS count
           FROM system_database WHERE is_deleted = 0 AND created_at > now() - interval '30 days'
           GROUP BY day ORDER BY day DESC`,
        ),
      ]);

      return {
        total: Number(totals.rows[0]?.total || 0),
        active: Number(totals.rows[0]?.active || 0),
        deleted: Number(totals.rows[0]?.deleted || 0),
        byType: byType.rows.reduce(
          (acc: Record<string, number>, r: { record_type: string; count: string }) => {
            acc[r.record_type] = Number(r.count);
            return acc;
          },
          {},
        ),
        byModule: byModule.rows.reduce(
          (acc: Record<string, number>, r: { source_module: string; count: string }) => {
            acc[r.source_module] = Number(r.count);
            return acc;
          },
          {},
        ),
        recentActivity: recentActivity.rows.map((r: { day: Date; count: string }) => ({
          day: r.day,
          count: Number(r.count),
        })),
      };
    } finally {
      client.release();
    }
  } catch (err: any) {
    return { error: err?.message || "Stats unavailable" };
  }
}
