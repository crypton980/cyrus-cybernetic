/**
 * System Database Routes — Robust, Scalable API
 *
 * Endpoints:
 *   POST   /api/sysdb/upload          Upload a single record
 *   POST   /api/sysdb/bulk-upload     Upload many records at once (up to 500)
 *   GET    /api/sysdb/records         List records (cursor-based pagination)
 *   DELETE /api/sysdb/records/:id     Soft-delete a record
 *   PUT    /api/sysdb/records/:id     Update a record
 *   GET    /api/sysdb/records/:id     Get a single record
 *   GET    /api/sysdb/verify/:id      Verify record integrity
 *   GET    /api/sysdb/search          Deep multi-strategy text search
 *   POST   /api/sysdb/search/face     AI-powered face image matching
 *   GET    /api/sysdb/stats           Database statistics
 */

import { Router, Request, Response } from "express";
import { eq, desc, and, lt } from "drizzle-orm";
import { db } from "../db";
import { systemDatabase } from "../../shared/schema";
import { deepSearch, verifyRecord, getDatabaseStats } from "./search-engine";
import { createHash } from "crypto";

const router = Router();

const VALID_TYPES = [
  "face",
  "fingerprint",
  "iris",
  "barcode",
  "qrcode",
  "reference",
  "document",
  "image",
  "text",
] as const;

type RecordType = (typeof VALID_TYPES)[number];

// ── Input sanitisation ────────────────────────────────────────────────────────

function sanitiseString(v: unknown, maxLen = 2000): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, maxLen);
}

function computeChecksum(recordType: string, label: string, value: string): string {
  return createHash("sha256")
    .update(`${recordType}|${label}|${value}`)
    .digest("hex");
}

// ── Upload / Register a record ────────────────────────────────────────────────
router.post("/upload", async (req: Request, res: Response) => {
  try {
    const {
      recordType,
      label,
      value,
      imageData,
      metadata,
      tags,
      sourceModule,
      userId,
    } = req.body as Record<string, unknown>;

    const rt = sanitiseString(recordType);
    const lbl = sanitiseString(label);

    if (!rt || !lbl) {
      return res.status(400).json({ error: "recordType and label are required" });
    }
    if (!VALID_TYPES.includes(rt as RecordType)) {
      return res.status(400).json({
        error: `Invalid recordType. Must be one of: ${VALID_TYPES.join(", ")}`,
      });
    }

    // Validate imageData is base64 if provided
    if (imageData && typeof imageData === "string") {
      const stripped = (imageData as string).replace(/^data:image\/\w+;base64,/, "");
      if (stripped.length > 0 && !/^[A-Za-z0-9+/=\r\n]+$/.test(stripped.slice(0, 100))) {
        return res.status(400).json({ error: "imageData must be a valid base64 string" });
      }
    }

    const valStr = sanitiseString(value, 4000);

    const [record] = await db
      .insert(systemDatabase)
      .values({
        recordType: rt,
        label: lbl,
        value: valStr,
        imageData: imageData ? String(imageData).slice(0, 2_000_000) : null,
        metadata: metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : null,
        tags: sanitiseString(tags, 500),
        sourceModule: sanitiseString(sourceModule, 100) || "unknown",
        userId: sanitiseString(userId, 100) || null,
        searchVector: "",
        isDeleted: 0,
        checksum: computeChecksum(rt, lbl, valStr),
        updatedAt: new Date(),
      })
      .returning({ id: systemDatabase.id, recordType: systemDatabase.recordType, label: systemDatabase.label });

    return res.json({ success: true, record });
  } catch (err: any) {
    console.error("[SysDB] Upload error:", err);
    return res.status(500).json({ error: "Failed to save record", details: err?.message });
  }
});

// ── Bulk upload (up to 500 records per call) ──────────────────────────────────
router.post("/bulk-upload", async (req: Request, res: Response) => {
  try {
    const { records } = req.body as { records?: unknown[] };
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: "records array is required" });
    }
    if (records.length > 500) {
      return res.status(400).json({ error: "Maximum 500 records per bulk upload" });
    }

    const validated: Array<Record<string, unknown>> = [];
    const errors: string[] = [];

    for (let i = 0; i < records.length; i++) {
      const rec = records[i] as Record<string, unknown>;
      const rt = sanitiseString(rec.recordType);
      const lbl = sanitiseString(rec.label);
      if (!rt || !VALID_TYPES.includes(rt as RecordType)) {
        errors.push(`Row ${i}: invalid recordType "${rt}"`);
        continue;
      }
      if (!lbl) {
        errors.push(`Row ${i}: label is required`);
        continue;
      }
      const valStr = sanitiseString(rec.value, 4000);
      validated.push({
        recordType: rt,
        label: lbl,
        value: valStr,
        imageData: rec.imageData ? String(rec.imageData).slice(0, 2_000_000) : null,
        metadata: rec.metadata && typeof rec.metadata === "object" ? rec.metadata : null,
        tags: sanitiseString(rec.tags, 500),
        sourceModule: sanitiseString(rec.sourceModule, 100) || "unknown",
        userId: sanitiseString(rec.userId, 100) || null,
        searchVector: "",
        isDeleted: 0,
        checksum: computeChecksum(rt, lbl, valStr),
        updatedAt: new Date(),
      });
    }

    if (validated.length === 0) {
      return res.status(400).json({ error: "No valid records to insert", validationErrors: errors });
    }

    // Insert in batches of 100 to avoid query parameter limits
    const BATCH = 100;
    let inserted = 0;
    for (let i = 0; i < validated.length; i += BATCH) {
      const batch = validated.slice(i, i + BATCH);
      await db.insert(systemDatabase).values(batch as any);
      inserted += batch.length;
    }

    return res.json({
      success: true,
      inserted,
      skipped: records.length - validated.length,
      validationErrors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    console.error("[SysDB] Bulk upload error:", err);
    return res.status(500).json({ error: "Bulk upload failed", details: err?.message });
  }
});

// ── List records (cursor-based pagination for millions of rows) ───────────────
router.get("/records", async (req: Request, res: Response) => {
  try {
    const {
      type,
      module: srcModule,
      limit = "50",
      cursor,
      includeDeleted,
    } = req.query as Record<string, string | undefined>;

    const pageSize = Math.min(Number(limit) || 50, 200);
    const showDeleted = includeDeleted === "true";

    const conditions: Array<ReturnType<typeof eq>> = [];

    if (!showDeleted) {
      conditions.push(eq(systemDatabase.isDeleted, 0));
    }
    if (type && VALID_TYPES.includes(type as RecordType)) {
      conditions.push(eq(systemDatabase.recordType, type));
    }
    if (srcModule) {
      conditions.push(eq(systemDatabase.sourceModule, srcModule));
    }
    if (cursor) {
      conditions.push(lt(systemDatabase.createdAt, new Date(cursor)));
    }

    const records = await db
      .select({
        id: systemDatabase.id,
        recordType: systemDatabase.recordType,
        label: systemDatabase.label,
        value: systemDatabase.value,
        tags: systemDatabase.tags,
        sourceModule: systemDatabase.sourceModule,
        userId: systemDatabase.userId,
        metadata: systemDatabase.metadata,
        isDeleted: systemDatabase.isDeleted,
        createdAt: systemDatabase.createdAt,
        updatedAt: systemDatabase.updatedAt,
      })
      .from(systemDatabase)
      .where(conditions.length > 0 ? and(...(conditions as [ReturnType<typeof eq>, ...ReturnType<typeof eq>[]])) : undefined)
      .orderBy(desc(systemDatabase.createdAt))
      .limit(pageSize + 1);

    const hasMore = records.length > pageSize;
    const page = hasMore ? records.slice(0, pageSize) : records;
    const nextCursor = hasMore ? page[page.length - 1]?.createdAt?.toISOString() : null;

    return res.json({
      records: page,
      pagination: {
        limit: pageSize,
        hasMore,
        nextCursor,
        count: page.length,
      },
    });
  } catch (err: any) {
    console.error("[SysDB] List error:", err);
    return res.status(500).json({ error: "Failed to list records", details: err?.message });
  }
});

// ── Get a single record (includes imageData) ──────────────────────────────────
router.get("/records/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      return res.status(400).json({ error: "Invalid record ID" });
    }
    const [record] = await db
      .select()
      .from(systemDatabase)
      .where(and(eq(systemDatabase.id, id), eq(systemDatabase.isDeleted, 0)));

    if (!record) return res.status(404).json({ error: "Record not found" });
    return res.json({ record });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch record", details: err?.message });
  }
});

// ── Update a record ────────────────────────────────────────────────────────────
router.put("/records/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      return res.status(400).json({ error: "Invalid record ID" });
    }

    const { label, value, tags, metadata, imageData } = req.body as Record<string, unknown>;
    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (label) updates.label = sanitiseString(label);
    if (value !== undefined) updates.value = sanitiseString(value, 4000);
    if (tags !== undefined) updates.tags = sanitiseString(tags, 500);
    if (metadata !== undefined && typeof metadata === "object") updates.metadata = metadata;
    if (imageData) updates.imageData = String(imageData).slice(0, 2_000_000);

    if (updates.label || updates.value !== undefined) {
      const [existing] = await db
        .select({ label: systemDatabase.label, value: systemDatabase.value, recordType: systemDatabase.recordType })
        .from(systemDatabase)
        .where(eq(systemDatabase.id, id));
      if (existing) {
        updates.checksum = computeChecksum(
          existing.recordType,
          String(updates.label || existing.label),
          String(updates.value !== undefined ? updates.value : (existing.value || "")),
        );
      }
    }

    await db
      .update(systemDatabase)
      .set(updates as any)
      .where(and(eq(systemDatabase.id, id), eq(systemDatabase.isDeleted, 0)));

    return res.json({ success: true });
  } catch (err: any) {
    console.error("[SysDB] Update error:", err);
    return res.status(500).json({ error: "Failed to update record", details: err?.message });
  }
});

// ── Soft-delete a record ──────────────────────────────────────────────────────
router.delete("/records/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      return res.status(400).json({ error: "Invalid record ID" });
    }
    await db
      .update(systemDatabase)
      .set({ isDeleted: 1, updatedAt: new Date() } as any)
      .where(eq(systemDatabase.id, id));
    return res.json({ success: true });
  } catch (err: any) {
    console.error("[SysDB] Delete error:", err);
    return res.status(500).json({ error: "Failed to delete record", details: err?.message });
  }
});

// ── Verify record integrity ───────────────────────────────────────────────────
router.get("/verify/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      return res.status(400).json({ error: "Invalid record ID" });
    }
    const result = await verifyRecord(id);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: "Verification failed", details: err?.message });
  }
});

// ── Deep multi-strategy text search ──────────────────────────────────────────
router.get("/search", async (req: Request, res: Response) => {
  try {
    const {
      q,
      type,
      module: srcModule,
      limit = "30",
      cursor,
      minSimilarity = "0.15",
      noai,
    } = req.query as Record<string, string | undefined>;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({ error: "Query parameter 'q' is required" });
    }
    if (q.trim().length < 2) {
      return res.status(400).json({ error: "Query must be at least 2 characters" });
    }

    const results = await deepSearch({
      query: q,
      recordType: type && VALID_TYPES.includes(type as RecordType) ? type : undefined,
      sourceModule: srcModule,
      limit: Math.min(Number(limit) || 30, 100),
      cursor,
      minSimilarity: Math.min(1, Math.max(0, Number(minSimilarity) || 0.15)),
      useAI: noai !== "true",
    });

    return res.json({
      matches: results,
      query: q,
      totalFound: results.length,
    });
  } catch (err: any) {
    console.error("[SysDB] Search error:", err);
    return res.status(500).json({ error: "Search failed", details: err?.message });
  }
});

// ── Face image search ─────────────────────────────────────────────────────────
router.post("/search/face", async (req: Request, res: Response) => {
  try {
    const { image } = req.body as { image?: string };
    if (!image || typeof image !== "string") {
      return res.status(400).json({ error: "image (base64 string) required" });
    }

    const stripped = image.replace(/^data:image\/\w+;base64,/, "");
    if (stripped.length < 100) {
      return res.status(400).json({ error: "Image data too small" });
    }

    const faceRecords = await db
      .select({
        id: systemDatabase.id,
        label: systemDatabase.label,
        metadata: systemDatabase.metadata,
        createdAt: systemDatabase.createdAt,
      })
      .from(systemDatabase)
      .where(and(eq(systemDatabase.recordType, "face"), eq(systemDatabase.isDeleted, 0)))
      .orderBy(desc(systemDatabase.createdAt))
      .limit(200);

    if (faceRecords.length === 0) {
      return res.json({ matches: [], message: "No face records in database" });
    }

    const openaiApiKey =
      process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return res.json({ matches: [], message: "Vision AI not configured — facial matching unavailable" });
    }

    const openai = new (await import("openai")).default({ apiKey: openaiApiKey });

    const BATCH_SIZE = 10;
    const allMatches: Array<{ knownFaceId: string; label: string; confidence: number; reason: string }> = [];

    for (let i = 0; i < faceRecords.length; i += BATCH_SIZE) {
      const batch = faceRecords.slice(i, i + BATCH_SIZE);
      const faceDescriptions = batch
        .map((r, idx) => `Record ${idx + 1}: id="${r.id}", label="${r.label}", metadata=${JSON.stringify(r.metadata || {})}`)
        .join("\n");

      const probeBase64 = image.replace(/^data:image\/\w+;base64,/, "");

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are CYRUS facial recognition system.
Given a probe image and stored face records, identify matches with confidence.
Return JSON: {"matches": [{"recordId": "...", "label": "...", "confidence": 0.0-1.0, "reason": "..."}]}
Only include confidence >= 0.4. If no match, return {"matches": []}.`,
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${probeBase64}`, detail: "low" },
              },
              {
                type: "text",
                text: `Compare this probe image against:\n${faceDescriptions}\n\nReturn JSON.`,
              },
            ],
          },
        ],
        max_tokens: 500,
        response_format: { type: "json_object" },
      });

      type FaceMatch = { recordId: string; label: string; confidence: number; reason: string };
      let batchResult: { matches: FaceMatch[] } = { matches: [] };
      try {
        batchResult = JSON.parse(response.choices[0].message.content || "{}");
      } catch {
        batchResult = { matches: [] };
      }

      for (const match of batchResult.matches || []) {
        allMatches.push({
          knownFaceId: match.recordId,
          label: match.label,
          confidence: match.confidence,
          reason: match.reason,
        });
      }

      if (allMatches.some((m) => m.confidence >= 0.85)) break;
    }

    allMatches.sort((a, b) => b.confidence - a.confidence);
    return res.json({ matches: allMatches.slice(0, 10) });
  } catch (err: any) {
    console.error("[SysDB] Face search error:", err);
    return res.status(500).json({ error: "Face search failed", details: err?.message });
  }
});

// ── Database statistics ───────────────────────────────────────────────────────
router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const stats = await getDatabaseStats();
    return res.json(stats);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to get stats", details: err?.message });
  }
});

export default router;
console.log("[SysDB] Robust system database routes initialized");
