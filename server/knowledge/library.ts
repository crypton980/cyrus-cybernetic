/**
 * Document Knowledge Library
 *
 * Manages the indexed document store that allows CYRUS to reference
 * uploaded legal documents, constitutions, engineering books, military manuals,
 * and any other document the operator has provided.
 *
 * Features:
 * - Index documents from the file upload pipeline
 * - Full-text keyword search across all active documents
 * - Context injection for the CYRUS inference engine
 * - Bulk-index all previously uploaded files from disk
 */

import { createHash } from "crypto";
import { readFile, readdir, stat } from "fs/promises";
import path from "path";
import { db } from "../db";
import {
  documentLibrary,
  type InsertDocumentLibrary,
  type DocumentLibrary,
} from "../../shared/schema";
import { eq, ilike, and, or, desc, sql } from "drizzle-orm";

// Lazy-import heavy ingestion modules to avoid circular deps
async function getExtractFile() {
  const { extractFile } = await import("../ingestion/extract");
  return extractFile;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum characters stored in full_text column (~800 KB is plenty for most books) */
const MAX_TEXT_CHARS = 800_000;

/** Characters per context excerpt injected into AI prompts */
const EXCERPT_CHARS = 2_000;

/** Number of top documents returned for context injection */
const CONTEXT_TOP_K = 4;

/** Number of results for management list */
const LIST_LIMIT = 100;

// ─── Category inference ────────────────────────────────────────────────────────

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  constitution: ["constitution", "constitutional", "amendment", "preamble", "republic", "sovereign"],
  legal: ["law", "legal", "statute", "regulation", "ordinance", "court", "judicial", "attorney", "counsel", "jurisdiction"],
  military: ["military", "army", "navy", "air force", "battalion", "regiment", "operation", "doctrine", "warfare", "tactics"],
  engineering: ["engineering", "mechanical", "electrical", "structural", "civil", "materials", "thermodynamics", "circuit", "schematic"],
  medical: ["medical", "clinical", "diagnosis", "treatment", "pharmacology", "anatomy", "physiology", "surgery"],
};

function inferCategory(filename: string, text: string): string {
  const combined = (filename + " " + (text || "").slice(0, 5_000)).toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const matches = keywords.filter((kw) => combined.includes(kw));
    if (matches.length >= 2) return category;
  }
  return "general";
}

function extractKeyConcepts(text: string, limit = 20): string[] {
  const stop = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "shall", "should",
    "may", "might", "must", "can", "could", "of", "in", "on", "at", "to", "for",
    "with", "by", "from", "up", "about", "as", "that", "this", "it", "its",
    "and", "or", "but", "nor", "so", "yet", "both", "either", "neither",
    "each", "more", "all", "any", "few", "not", "only", "own", "same",
    "than", "too", "very", "just", "because", "if", "then", "when", "where",
    "which", "who", "whom", "how", "what", "there", "their", "they", "them",
    "we", "our", "he", "she", "his", "her", "my", "your", "also", "such",
  ]);

  const freq: Record<string, number> = {};
  const words = text
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 4 && !stop.has(w));

  for (const w of words) {
    freq[w] = (freq[w] || 0) + 1;
  }

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([w]) => w);
}

function sha256hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface IndexResult {
  doc: DocumentLibrary;
  alreadyIndexed: boolean;
}

/**
 * Index a document buffer into the library.
 * Extracts text, infers category, stores in DB.
 */
export async function indexDocument(
  buffer: Buffer,
  originalName: string,
  mimetype: string,
  overrideCategory?: string,
  filePath?: string,
): Promise<IndexResult> {
  const hash = sha256hex(buffer);

  // Check for duplicate by sha256
  const [existing] = await db
    .select()
    .from(documentLibrary)
    .where(eq(documentLibrary.sha256, hash))
    .limit(1);

  if (existing) {
    // Re-activate if it was deactivated
    if (!existing.isActive) {
      await db.update(documentLibrary).set({ isActive: 1 }).where(eq(documentLibrary.id, existing.id));
    }
    return { doc: existing, alreadyIndexed: true };
  }

  // Extract text
  const extractFile = await getExtractFile();
  let fullText = "";
  try {
    const ext = await extractFile(buffer, mimetype);
    fullText = ext.text || ext.ocrText || ext.transcript || "";
  } catch (extractErr: any) {
    console.warn(`[KnowledgeLib] Text extraction failed for "${originalName}":`, extractErr?.message || extractErr);
    fullText = buffer.toString("utf-8").slice(0, MAX_TEXT_CHARS);
  }

  // Truncate
  const truncated = fullText.slice(0, MAX_TEXT_CHARS);
  const category = overrideCategory || inferCategory(originalName, truncated);
  const keyConcepts = extractKeyConcepts(truncated);

  // Build short summary (first 600 chars of content)
  const summary = truncated.slice(0, 600).replace(/\s+/g, " ").trim();

  const insert: InsertDocumentLibrary = {
    originalName,
    category,
    documentType: category,
    summary,
    fullText: truncated,
    keyConcepts,
    isActive: 1,
    mimetype,
    size: buffer.length,
    sha256: hash,
    filePath: filePath || null,
  };

  const [doc] = await db.insert(documentLibrary).values(insert).returning();
  console.log(`[KnowledgeLib] Indexed "${originalName}" (${category}) — ${truncated.length} chars`);
  return { doc, alreadyIndexed: false };
}

export interface SearchResult {
  doc: DocumentLibrary;
  excerpt: string;
  score: number;
}

/**
 * Search the library for documents relevant to a query.
 * Uses keyword matching across document name, summary, and full text.
 */
export async function searchDocuments(
  query: string,
  category?: string,
  limit = 10,
): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 10);

  if (words.length === 0) return [];

  // Build OR conditions across name + summary + fullText for each query word
  const conditions = words.map((w) =>
    or(
      ilike(documentLibrary.originalName, `%${w}%`),
      ilike(documentLibrary.summary, `%${w}%`),
      ilike(documentLibrary.fullText, `%${w}%`),
    ),
  );

  const baseWhere = and(
    eq(documentLibrary.isActive, 1),
    category ? eq(documentLibrary.category, category) : undefined,
    or(...conditions),
  );

  const rows = await db
    .select()
    .from(documentLibrary)
    .where(baseWhere)
    .orderBy(desc(documentLibrary.accessCount), desc(documentLibrary.indexedAt))
    .limit(limit * 2); // Over-fetch for re-ranking

  // Score each doc by how many query words appear in it
  const scored: SearchResult[] = rows.map((doc) => {
    const haystack = (
      (doc.originalName || "") +
      " " +
      (doc.summary || "") +
      " " +
      (doc.fullText || "").slice(0, 50_000)
    ).toLowerCase();

    let score = 0;
    for (const w of words) {
      const idx = haystack.indexOf(w);
      if (idx !== -1) score += 1;
      if (haystack.includes(" " + w + " ")) score += 0.5; // whole-word bonus
    }

    // Build a relevant excerpt: find the first occurrence of any query word in fullText
    let excerpt = (doc.summary || "").slice(0, EXCERPT_CHARS);
    const ft = (doc.fullText || "").toLowerCase();
    for (const w of words) {
      const pos = ft.indexOf(w);
      if (pos !== -1) {
        const start = Math.max(0, pos - 100);
        const end = Math.min((doc.fullText || "").length, pos + EXCERPT_CHARS);
        excerpt = "..." + (doc.fullText || "").slice(start, end) + "...";
        break;
      }
    }

    return { doc, excerpt, score };
  });

  return scored
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Build a context string from the most relevant library documents
 * for injection into the CYRUS system prompt.
 */
export async function getDocumentContext(query: string): Promise<string> {
  const results = await searchDocuments(query, undefined, CONTEXT_TOP_K);
  if (results.length === 0) return "";

  // Update access stats
  const ids = results.map((r) => r.doc.id);
  for (const id of ids) {
    await db
      .update(documentLibrary)
      .set({
        lastAccessed: new Date(),
        accessCount: sql`${documentLibrary.accessCount} + 1`,
      })
      .where(eq(documentLibrary.id, id));
  }

  const sections = results.map((r) => {
    const header = `[DOCUMENT: "${r.doc.originalName}" | Category: ${r.doc.category}]`;
    return `${header}\n${r.excerpt}`;
  });

  return (
    `\n\n[KNOWLEDGE LIBRARY — ${results.length} relevant document(s) retrieved]\n` +
    sections.join("\n\n---\n\n") +
    "\n[END KNOWLEDGE LIBRARY]\n"
  );
}

/**
 * List all documents in the library (for management UI).
 */
export async function listDocuments(
  category?: string,
  includeInactive = false,
): Promise<DocumentLibrary[]> {
  const conditions = [];
  if (!includeInactive) conditions.push(eq(documentLibrary.isActive, 1));
  if (category) conditions.push(eq(documentLibrary.category, category));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  return db
    .select()
    .from(documentLibrary)
    .where(where)
    .orderBy(desc(documentLibrary.indexedAt))
    .limit(LIST_LIMIT);
}

/**
 * Get a single document record by ID.
 */
export async function getDocumentById(id: string): Promise<DocumentLibrary | null> {
  const [doc] = await db.select().from(documentLibrary).where(eq(documentLibrary.id, id)).limit(1);
  return doc || null;
}

/**
 * Toggle a document's active status.
 */
export async function toggleDocumentActive(id: string, active: boolean): Promise<DocumentLibrary | null> {
  const [doc] = await db
    .update(documentLibrary)
    .set({ isActive: active ? 1 : 0 })
    .where(eq(documentLibrary.id, id))
    .returning();
  return doc || null;
}

/**
 * Delete a document from the index (does NOT delete the original file).
 */
export async function deleteDocumentFromLibrary(id: string): Promise<boolean> {
  const result = await db.delete(documentLibrary).where(eq(documentLibrary.id, id)).returning();
  return result.length > 0;
}

/**
 * Bulk-index all files currently in the uploads directory.
 * Skips already-indexed files (by sha256).
 */
export async function bulkIndexUploadedFiles(uploadsDir: string): Promise<{
  total: number;
  indexed: number;
  skipped: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let indexed = 0;
  let skipped = 0;

  let files: string[] = [];
  try {
    files = await readdir(uploadsDir);
  } catch {
    return { total: 0, indexed: 0, skipped: 0, errors: [`Cannot read uploads dir: ${uploadsDir}`] };
  }

  const documentFiles = files.filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return [
      ".pdf", ".doc", ".docx", ".txt", ".md",
      ".pptx", ".xlsx", ".csv", ".rtf", ".odt",
    ].includes(ext);
  });

  for (const filename of documentFiles) {
    const fullPath = path.join(uploadsDir, filename);
    try {
      const stats = await stat(fullPath);
      if (!stats.isFile()) continue;

      // Skip very large files > 50MB
      if (stats.size > 50 * 1024 * 1024) {
        errors.push(`${filename}: skipped (file too large: ${Math.round(stats.size / 1024 / 1024)} MB)`);
        skipped++;
        continue;
      }

      const buffer = await readFile(fullPath);
      const ext = path.extname(filename).toLowerCase();
      const mimeMap: Record<string, string> = {
        ".pdf": "application/pdf",
        ".doc": "application/msword",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".txt": "text/plain",
        ".md": "text/markdown",
        ".rtf": "application/rtf",
        ".odt": "application/vnd.oasis.opendocument.text",
        ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".csv": "text/csv",
      };
      const mimetype = mimeMap[ext] || "application/octet-stream";

      const result = await indexDocument(buffer, filename, mimetype, undefined, fullPath);
      if (result.alreadyIndexed) {
        skipped++;
      } else {
        indexed++;
      }
    } catch (err: any) {
      errors.push(`${filename}: ${err?.message || String(err)}`);
      skipped++;
    }
  }

  return { total: documentFiles.length, indexed, skipped, errors };
}
