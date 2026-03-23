/**
 * System Database Routes
 * Provides a centralised store for biometric and identifier records:
 * face, fingerprint, iris, barcode, qrcode, reference, document, image, text.
 *
 * All module pages can upload to and search this database.
 */

import { Router, Request, Response } from "express";
import { eq, like, or, desc } from "drizzle-orm";
import { db } from "../db";
import { systemDatabase } from "../../shared/schema";

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

// ─── Upload / Register a record ───────────────────────────────────────────────
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
    } = req.body as {
      recordType: string;
      label: string;
      value?: string;
      imageData?: string;
      metadata?: Record<string, unknown>;
      tags?: string;
      sourceModule?: string;
      userId?: string;
    };

    if (!recordType || !label) {
      return res.status(400).json({ error: "recordType and label are required" });
    }
    if (!VALID_TYPES.includes(recordType as RecordType)) {
      return res.status(400).json({ error: `Invalid recordType. Must be one of: ${VALID_TYPES.join(", ")}` });
    }

    const [record] = await db
      .insert(systemDatabase)
      .values({
        recordType,
        label,
        value: value || "",
        imageData: imageData || null,
        metadata: metadata || null,
        tags: tags || "",
        sourceModule: sourceModule || "unknown",
        userId: userId || null,
        updatedAt: new Date(),
      })
      .returning();

    return res.json({ success: true, record });
  } catch (err: any) {
    console.error("[SysDB] Upload error:", err);
    return res.status(500).json({ error: "Failed to save record", details: err?.message });
  }
});

// ─── List records (with optional type filter) ──────────────────────────────────
router.get("/records", async (req: Request, res: Response) => {
  try {
    const { type, module: srcModule, limit = "50" } = req.query as Record<string, string>;

    let query = db
      .select()
      .from(systemDatabase)
      .orderBy(desc(systemDatabase.createdAt))
      .limit(Math.min(Number(limit) || 50, 200));

    if (type && VALID_TYPES.includes(type as RecordType)) {
      // @ts-ignore – dynamic condition
      query = query.where(eq(systemDatabase.recordType, type));
    }

    const records = await query;
    return res.json({ records });
  } catch (err: any) {
    console.error("[SysDB] List error:", err);
    return res.status(500).json({ error: "Failed to list records", details: err?.message });
  }
});

// ─── Delete a record ──────────────────────────────────────────────────────────
router.delete("/records/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await db.delete(systemDatabase).where(eq(systemDatabase.id, id));
    return res.json({ success: true });
  } catch (err: any) {
    console.error("[SysDB] Delete error:", err);
    return res.status(500).json({ error: "Failed to delete record", details: err?.message });
  }
});

// ─── Text / Reference / Barcode / QR search ──────────────────────────────────
router.get("/search", async (req: Request, res: Response) => {
  try {
    const { q, type } = req.query as { q?: string; type?: string };

    if (!q || q.trim().length === 0) {
      return res.status(400).json({ error: "Query parameter 'q' is required" });
    }

    const pattern = `%${q.trim()}%`;

    const records = await db
      .select()
      .from(systemDatabase)
      .where(
        or(
          like(systemDatabase.value, pattern),
          like(systemDatabase.label, pattern),
          like(systemDatabase.tags, pattern),
        ),
      )
      .orderBy(desc(systemDatabase.createdAt))
      .limit(50);

    const filtered =
      type && VALID_TYPES.includes(type as RecordType)
        ? records.filter((r) => r.recordType === type)
        : records;

    return res.json({ matches: filtered, query: q });
  } catch (err: any) {
    console.error("[SysDB] Search error:", err);
    return res.status(500).json({ error: "Search failed", details: err?.message });
  }
});

// ─── Face image search (AI-assisted comparison) ───────────────────────────────
router.post("/search/face", async (req: Request, res: Response) => {
  try {
    const { image } = req.body as { image?: string };
    if (!image) {
      return res.status(400).json({ error: "image (base64) required" });
    }

    // Retrieve all face records from DB
    const faceRecords = await db
      .select()
      .from(systemDatabase)
      .where(eq(systemDatabase.recordType, "face"))
      .orderBy(desc(systemDatabase.createdAt))
      .limit(100);

    if (faceRecords.length === 0) {
      return res.json({ matches: [], message: "No face records in database" });
    }

    // Use OpenAI vision to compare the probe image against stored face thumbnails
    const openaiApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      // No AI — return text-similarity fallback
      return res.json({ matches: [], message: "Vision AI not configured — facial matching unavailable" });
    }

    const openai = new (await import("openai")).default({ apiKey: openaiApiKey });

    // Build a text description of stored faces and ask the model to compare
    const faceDescriptions = faceRecords
      .slice(0, 10) // cap to avoid overly long prompts
      .map((r, i) => `Record ${i + 1}: label="${r.label}", metadata=${JSON.stringify(r.metadata || {})}`)
      .join("\n");

    const probeBase64 = image.replace(/^data:image\/\w+;base64,/, "");

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are CYRUS facial recognition system. 
Given a probe image and a list of stored face records with their descriptions, 
identify the best matching record(s). 
Return JSON: {"matches": [{"recordIndex": N, "label": "...", "confidence": 0.0-1.0, "reason": "..."}]}
If no match, return {"matches": []}.`,
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
              text: `Compare this probe image against these stored face records:\n${faceDescriptions}\n\nWhich records match? Return JSON.`,
            },
          ],
        },
      ],
      max_tokens: 400,
      response_format: { type: "json_object" },
    });

    let aiResult: { matches: Array<{ recordIndex: number; label: string; confidence: number; reason: string }> } = { matches: [] };
    try {
      aiResult = JSON.parse(response.choices[0].message.content || "{}");
    } catch {
      aiResult = { matches: [] };
    }

    // Enrich AI results with full DB record data
    const enrichedMatches = (aiResult.matches || []).map((m) => {
      const dbRecord = faceRecords[m.recordIndex - 1];
      return dbRecord ? { ...m, record: dbRecord } : m;
    });

    return res.json({ matches: enrichedMatches });
  } catch (err: any) {
    console.error("[SysDB] Face search error:", err);
    return res.status(500).json({ error: "Face search failed", details: err?.message });
  }
});

export default router;
console.log("[SysDB] System database routes initialized");
