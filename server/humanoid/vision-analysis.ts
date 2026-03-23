import { Router, Request, Response } from "express";
import { localVision } from "../scan/local-vision-client";
import { db } from "../db";
import { systemDatabase } from "../../shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

const useLocalVision = process.env.USE_LOCAL_VISION !== 'false';

async function getOpenAIClient(): Promise<any | null> {
  if (!useLocalVision) {
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
    if (!apiKey) return null;
    const openai = await import("openai");
    return new openai.default({ apiKey, baseURL });
  }
  return null;
}

interface PersonAnalysis {
  id: number;
  gender: string;
  ageRange: string;
  description: string;
  isRecognized: boolean;
  name?: string;
}

// ── In-memory fallback (used when DB is unavailable) ──────────────────────────
const knownFacesMemory: Map<string, { name: string; role: string }> = new Map();

async function loadKnownFacesFromDB(): Promise<Array<{ id: string; name: string; role: string; imageData?: string | null }>> {
  try {
    const rows = await db
      .select()
      .from(systemDatabase)
      .where(eq(systemDatabase.recordType, "face"));
    return rows.map((r) => ({
      id: r.id,
      name: r.label,
      role: (r.metadata as any)?.role || "User",
      imageData: r.imageData,
    }));
  } catch {
    return Array.from(knownFacesMemory.entries()).map(([id, d]) => ({ id, name: d.name, role: d.role }));
  }
}

const analysisTimestamps: Map<string, number> = new Map();
const RATE_LIMIT_MS = 3000;
const MAX_IMAGE_SIZE = 500000;

router.post("/analyze-people", async (req: Request, res: Response) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: "Image data required" });
    }

    const clientIP = req.ip || "unknown";
    const lastAnalysis = analysisTimestamps.get(clientIP) || 0;
    const now = Date.now();
    if (now - lastAnalysis < RATE_LIMIT_MS) {
      return res.status(429).json({ error: "Rate limited", retryAfter: RATE_LIMIT_MS });
    }
    analysisTimestamps.set(clientIP, now);

    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    if (base64Data.length > MAX_IMAGE_SIZE) {
      return res.status(413).json({ error: "Image too large" });
    }

    const client = await getOpenAIClient();
    if (!client) {
      return res.status(500).json({ error: "Vision API not configured" });
    }

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are CYRUS's vision system. Analyze the image and identify all visible people.
For each person, provide:
- gender: "Male", "Female", or "Unknown"
- ageRange: estimated age range like "20-30", "30-40", etc.
- description: brief physical description (clothing, hair, notable features)

Return JSON format:
{
  "peopleCount": number,
  "persons": [
    {
      "id": 1,
      "gender": "Male/Female/Unknown",
      "ageRange": "20-30",
      "description": "Brief description"
    }
  ]
}

If no people are visible, return {"peopleCount": 0, "persons": []}.
Be professional and respectful in descriptions.`,
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Data}`,
                detail: "low",
              },
            },
            {
              type: "text",
              text: "Analyze all people visible in this image. Provide count, gender, age estimate, and brief description for each.",
            },
          ],
        },
      ],
      max_tokens: 500,
      response_format: { type: "json_object" },
    });

    let result: { peopleCount: number; persons: PersonAnalysis[] };
    try {
      result = JSON.parse(response.choices[0].message.content || '{"peopleCount": 0, "persons": []}');
    } catch {
      result = { peopleCount: 0, persons: [] };
    }

    result.persons = result.persons.map((person) => ({
      ...person,
      isRecognized: false,
    }));

    res.json(result);
  } catch (error: any) {
    console.error("[Vision] Analysis error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ── Multi-frame composite analysis ────────────────────────────────────────────
// Accepts an array of frames captured at different angles/times and produces a
// unified analysis by describing what is seen across all frames together.
router.post("/multi-frame-analyze", async (req: Request, res: Response) => {
  try {
    const { frames } = req.body as { frames?: string[] };
    if (!Array.isArray(frames) || frames.length === 0) {
      return res.status(400).json({ error: "frames array required" });
    }

    const clientIP = req.ip || "unknown";
    const lastAnalysis = analysisTimestamps.get(`mf:${clientIP}`) || 0;
    const now = Date.now();
    if (now - lastAnalysis < RATE_LIMIT_MS) {
      return res.status(429).json({ error: "Rate limited", retryAfter: RATE_LIMIT_MS });
    }
    analysisTimestamps.set(`mf:${clientIP}`, now);

    const client = await getOpenAIClient();
    if (!client) {
      return res.status(500).json({ error: "Vision API not configured" });
    }

    // Cap to 4 frames to stay within token limits
    const cappedFrames = frames.slice(0, 4);

    const imageContent = cappedFrames.map((frame) => ({
      type: "image_url" as const,
      image_url: {
        url: frame.startsWith("data:") ? frame : `data:image/jpeg;base64,${frame}`,
        detail: "low" as const,
      },
    }));

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are CYRUS's advanced multi-frame vision system. You are given ${cappedFrames.length} frames captured from the same scene at different moments/angles during a live feed.

Perform a composite analysis as if stitching the views together:
1. Describe the overall scene across all frames
2. Identify all people present (with count, descriptions, any recurring individuals across frames)
3. Identify objects and their positions
4. Note any motion or changes between frames
5. Detect any barcodes, QR codes, text, reference numbers visible in any frame
6. Provide an overall threat/safety assessment

Return JSON:
{
  "compositeScene": "overall scene description",
  "peopleCount": number,
  "persons": [{"id": N, "description": "...", "appearsInFrames": [1,2,...]}],
  "objects": ["..."],
  "motionDetected": boolean,
  "motionDescription": "...",
  "codesDetected": [{"type": "qr|barcode|text", "value": "..."}],
  "safetyAssessment": "safe|caution|alert",
  "safetyReason": "..."
}`,
        },
        {
          role: "user",
          content: [
            ...imageContent,
            {
              type: "text" as const,
              text: `Analyze these ${cappedFrames.length} frames from the live feed and provide a composite scene report.`,
            },
          ],
        },
      ],
      max_tokens: 800,
      response_format: { type: "json_object" },
    });

    let result: Record<string, unknown> = {};
    try {
      result = JSON.parse(response.choices[0].message.content || "{}");
    } catch {
      result = { error: "Failed to parse vision result" };
    }

    res.json({ success: true, frameCount: cappedFrames.length, analysis: result });
  } catch (error: any) {
    console.error("[Vision] Multi-frame analysis error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ── Register / enroll a face (persisted to system database) ───────────────────
router.post("/register-face", async (req: Request, res: Response) => {
  try {
    const { name, role, faceId, imageData } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    // Persist to system database
    try {
      await db.insert(systemDatabase).values({
        recordType: "face",
        label: name,
        value: name,
        imageData: imageData || null,
        metadata: { role: role || "User", faceId },
        tags: "face,biometric",
        sourceModule: "vision",
        updatedAt: new Date(),
      });
    } catch {
      // DB unavailable — fall back to memory store
      knownFacesMemory.set(faceId || name, { name, role: role || "User" });
    }

    res.json({ success: true, message: `Registered ${name} in system database` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── List known faces (from system database + memory fallback) ─────────────────
router.get("/known-faces", async (req: Request, res: Response) => {
  try {
    const faces = await loadKnownFacesFromDB();
    res.json({ faces });
  } catch {
    const faces = Array.from(knownFacesMemory.entries()).map(([id, data]) => ({
      id,
      ...data,
    }));
    res.json({ faces });
  }
});

// ── Face match against system database ────────────────────────────────────────
router.post("/match-people", async (req: Request, res: Response) => {
  try {
    const { image, sensitivity = 0.5 } = req.body as { image?: string; sensitivity?: number };
    if (!image) {
      return res.status(400).json({ error: "image required" });
    }

    const dbFaces = await loadKnownFacesFromDB();
    if (dbFaces.length === 0) {
      return res.json({ matches: [] });
    }

    const client = await getOpenAIClient();
    if (!client) {
      return res.json({ matches: [] });
    }

    const probeBase64 = image.replace(/^data:image\/\w+;base64,/, "");
    const faceList = dbFaces
      .slice(0, 10)
      .map((f, i) => `${i + 1}. name="${f.name}", role="${f.role}"`)
      .join("\n");

    const resp = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are CYRUS's face matching system. Compare the probe image with the list of known people and identify matches.
Return JSON: {"matches": [{"knownFaceId": "...", "knownFaceName": "...", "confidence": 0.0-1.0}]}
Only include matches with confidence >= ${sensitivity}.`,
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${probeBase64}`, detail: "low" },
            },
            { type: "text", text: `Known people in database:\n${faceList}\n\nIdentify any matches in this image.` },
          ],
        },
      ],
      max_tokens: 300,
      response_format: { type: "json_object" },
    });

    let parsed: { matches: Array<{ knownFaceId: string; knownFaceName: string; confidence: number }> } = { matches: [] };
    try {
      parsed = JSON.parse(resp.choices[0].message.content || "{}");
    } catch {
      parsed = { matches: [] };
    }

    // Map index-based IDs back to real DB IDs
    const enrichedMatches = (parsed.matches || []).map((m) => {
      const idx = parseInt(m.knownFaceId, 10) - 1;
      const dbFace = !isNaN(idx) && dbFaces[idx] ? dbFaces[idx] : dbFaces.find((f) => f.name === m.knownFaceName);
      return dbFace
        ? { knownFaceId: dbFace.id, knownFaceName: dbFace.name, confidence: m.confidence }
        : m;
    });

    res.json({ matches: enrichedMatches });
  } catch (error: any) {
    console.error("[Vision] Match error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

console.log("[Vision Analysis] People detection system initialized");

const router = Router();

const useLocalVision = process.env.USE_LOCAL_VISION !== 'false';

async function getOpenAIClient(): Promise<any | null> {
  if (!useLocalVision) {
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
    if (!apiKey) return null;
    const openai = await import("openai");
    return new openai.default({ apiKey, baseURL });
  }
  return null;
}

interface PersonAnalysis {
  id: number;
  gender: string;
  ageRange: string;
  description: string;
  isRecognized: boolean;
  name?: string;
}

const knownFaces: Map<string, { name: string; role: string }> = new Map();

const analysisTimestamps: Map<string, number> = new Map();
const RATE_LIMIT_MS = 3000;
const MAX_IMAGE_SIZE = 500000;

router.post("/analyze-people", async (req: Request, res: Response) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: "Image data required" });
    }

    const clientIP = req.ip || "unknown";
    const lastAnalysis = analysisTimestamps.get(clientIP) || 0;
    const now = Date.now();
    if (now - lastAnalysis < RATE_LIMIT_MS) {
      return res.status(429).json({ error: "Rate limited", retryAfter: RATE_LIMIT_MS });
    }
    analysisTimestamps.set(clientIP, now);

    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    if (base64Data.length > MAX_IMAGE_SIZE) {
      return res.status(413).json({ error: "Image too large" });
    }

    const client = await getOpenAIClient();
    if (!client) {
      return res.status(500).json({ error: "Vision API not configured" });
    }

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are CYRUS's vision system. Analyze the image and identify all visible people.
For each person, provide:
- gender: "Male", "Female", or "Unknown"
- ageRange: estimated age range like "20-30", "30-40", etc.
- description: brief physical description (clothing, hair, notable features)

Return JSON format:
{
  "peopleCount": number,
  "persons": [
    {
      "id": 1,
      "gender": "Male/Female/Unknown",
      "ageRange": "20-30",
      "description": "Brief description"
    }
  ]
}

If no people are visible, return {"peopleCount": 0, "persons": []}.
Be professional and respectful in descriptions.`,
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Data}`,
                detail: "low",
              },
            },
            {
              type: "text",
              text: "Analyze all people visible in this image. Provide count, gender, age estimate, and brief description for each.",
            },
          ],
        },
      ],
      max_tokens: 500,
      response_format: { type: "json_object" },
    });

    let result: { peopleCount: number; persons: PersonAnalysis[] };
    try {
      result = JSON.parse(response.choices[0].message.content || '{"peopleCount": 0, "persons": []}');
    } catch {
      result = { peopleCount: 0, persons: [] };
    }

    result.persons = result.persons.map((person) => ({
      ...person,
      isRecognized: false,
    }));

    res.json(result);
  } catch (error: any) {
    console.error("[Vision] Analysis error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/register-face", async (req: Request, res: Response) => {
  try {
    const { name, role, faceId } = req.body;
    if (!name || !faceId) {
      return res.status(400).json({ error: "Name and faceId required" });
    }
    knownFaces.set(faceId, { name, role: role || "User" });
    res.json({ success: true, message: `Registered ${name}` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/known-faces", (req: Request, res: Response) => {
  const faces = Array.from(knownFaces.entries()).map(([id, data]) => ({
    id,
    ...data,
  }));
  res.json({ faces });
});

export default router;

console.log("[Vision Analysis] People detection system initialized");
