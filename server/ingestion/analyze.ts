import { localLLM } from "../ai/local-llm-client";
import { ExtractionResult } from "./extract";

const openaiApiKey = process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const openaiBaseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;

// Use local LLM as primary, OpenAI as fallback
const useLocalLLM = process.env.USE_LOCAL_LLM !== 'false';
const openaiClient =
  (!useLocalLLM && openaiApiKey)
    ? new (await import("openai")).default({ apiKey: openaiApiKey, baseURL: openaiBaseUrl })
    : null;

export interface AnalysisCitation {
  clause: string;
  excerpt: string;
  rationale: string;
}

export interface AnalysisOptions {
  jurisdiction?: string;
  strictLegalReview?: boolean;
  [key: string]: any;
}

export interface AnalysisResult {
  summary: string;
  findings: string[];
  issues: string[];
  interpretation: string;
  recommendations: string[];
  confidence: "High" | "Medium" | "Low";
  documentType: string;
  documentTypeConfidence: "High" | "Medium" | "Low";
  decisionActions: Array<{ action: string; owner: string; deadline: string; obligation: string }>;
  executiveBrief: string;
  knowledgeApplied: string[];
  capabilitySummary: string;
  jurisdictionApplied: string;
  strictLegalReview: boolean;
  citationAnchors: AnalysisCitation[];
  entities: Array<{ type: string; value: string }>;
  riskLevel: "low" | "medium" | "high";
  chunksAnalyzed?: number;
}

function buildSystemPrompt(jurisdiction: string, strictLegal: boolean): string {
  return `You are an expert document analyst and legal intelligence system. Your task is to perform a comprehensive, structured analysis of the provided document content.

Jurisdiction context: ${jurisdiction}
Strict legal review: ${strictLegal ? "ENABLED — apply rigorous legal scrutiny" : "DISABLED — standard analysis"}

Return ONLY a valid JSON object with exactly these fields (no markdown, no extra text):
{
  "summary": "2-5 sentence factual summary of the document",
  "documentType": "one of: contract, report, memo, legal_notice, invoice, policy, letter, form, transcript, article, technical_document, financial_statement, other",
  "documentTypeConfidence": "High | Medium | Low",
  "interpretation": "1-3 sentence interpretation of the document's purpose and intent",
  "executiveBrief": "1-2 paragraph executive-level brief for senior decision makers",
  "confidence": "High | Medium | Low (overall analysis confidence)",
  "riskLevel": "low | medium | high",
  "capabilitySummary": "summary of what analytical capabilities and knowledge domains were applied",
  "jurisdictionApplied": "${jurisdiction}",
  "strictLegalReview": ${strictLegal},
  "findings": ["key finding 1", "key finding 2", "..."],
  "issues": ["issue or gap 1", "issue or gap 2", "..."],
  "recommendations": ["recommendation 1", "recommendation 2", "..."],
  "knowledgeApplied": ["domain or knowledge area 1", "domain 2", "..."],
  "decisionActions": [
    { "action": "specific action to take", "owner": "responsible party", "deadline": "timeframe", "obligation": "mandatory | recommended | optional" }
  ],
  "citationAnchors": [
    { "clause": "clause or section reference", "excerpt": "exact or near-exact text excerpt", "rationale": "why this clause is significant" }
  ],
  "entities": [
    { "type": "PERSON | ORG | DATE | MONEY | LOCATION | LAW | CONTRACT_TERM", "value": "the entity value" }
  ]
}

If the content is empty or cannot be analyzed, still return the JSON with appropriate placeholder values and set confidence to "Low".`;
}

function safeJsonParse(text: string): any | null {
  // Strip markdown code fences if present
  const stripped = text.replace(/^```(?:json)?\n?/i, "").replace(/\n?```\s*$/i, "").trim();
  try {
    return JSON.parse(stripped);
  } catch {
    // Try to extract first JSON object from the text
    const match = stripped.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizeConfidence(val: any): "High" | "Medium" | "Low" {
  const s = String(val || "").toLowerCase();
  if (s === "high") return "High";
  if (s === "low") return "Low";
  return "Medium";
}

function normalizeRisk(val: any): "low" | "medium" | "high" {
  const s = String(val || "").toLowerCase();
  if (s === "high") return "high";
  if (s === "low") return "low";
  return "medium";
}

function buildFallbackResult(aggregateText: string, reason: string, options: AnalysisOptions): AnalysisResult {
  return {
    summary: aggregateText ? aggregateText.slice(0, 300) : "No extracted text available for analysis.",
    documentType: "other",
    documentTypeConfidence: "Low",
    interpretation: reason,
    executiveBrief: "Automated analysis was not available. Manual review is recommended.",
    confidence: "Low",
    riskLevel: aggregateText ? "medium" : "high",
    capabilitySummary: "Basic text extraction only; AI analysis unavailable.",
    jurisdictionApplied: options.jurisdiction || "Global",
    strictLegalReview: Boolean(options.strictLegalReview),
    findings: aggregateText ? ["Document content was extracted but could not be fully analyzed."] : [],
    issues: [reason],
    recommendations: ["Configure AI credentials and retry for full analysis.", "Perform manual document review."],
    knowledgeApplied: ["text extraction"],
    decisionActions: [],
    citationAnchors: [],
    entities: [],
  };
}

function parseJsonResult(parsed: any, options: AnalysisOptions): AnalysisResult {
  return {
    summary: String(parsed.summary || "Summary unavailable"),
    documentType: String(parsed.documentType || "other"),
    documentTypeConfidence: normalizeConfidence(parsed.documentTypeConfidence),
    interpretation: String(parsed.interpretation || "Interpretation unavailable"),
    executiveBrief: String(parsed.executiveBrief || ""),
    confidence: normalizeConfidence(parsed.confidence),
    riskLevel: normalizeRisk(parsed.riskLevel),
    capabilitySummary: String(parsed.capabilitySummary || ""),
    jurisdictionApplied: String(parsed.jurisdictionApplied || options.jurisdiction || "Global"),
    strictLegalReview: Boolean(parsed.strictLegalReview ?? options.strictLegalReview ?? false),
    findings: Array.isArray(parsed.findings) ? parsed.findings.map(String) : [],
    issues: Array.isArray(parsed.issues) ? parsed.issues.map(String) : [],
    recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.map(String) : [],
    knowledgeApplied: Array.isArray(parsed.knowledgeApplied) ? parsed.knowledgeApplied.map(String) : [],
    decisionActions: Array.isArray(parsed.decisionActions)
      ? parsed.decisionActions.map((d: any) => ({
          action: String(d.action || ""),
          owner: String(d.owner || ""),
          deadline: String(d.deadline || ""),
          obligation: String(d.obligation || ""),
        }))
      : [],
    citationAnchors: Array.isArray(parsed.citationAnchors)
      ? parsed.citationAnchors.map((c: any) => ({
          clause: String(c.clause || ""),
          excerpt: String(c.excerpt || ""),
          rationale: String(c.rationale || ""),
        }))
      : [],
    entities: Array.isArray(parsed.entities)
      ? parsed.entities.map((e: any) => ({
          type: String(e.type || ""),
          value: String(e.value || ""),
        }))
      : [],
  };
}

export async function analyzeExtraction(ext: ExtractionResult, options: AnalysisOptions = {}): Promise<AnalysisResult> {
  const jurisdiction = options.jurisdiction || "Global";
  const strictLegal = Boolean(options.strictLegalReview);

  const contentPieces = [
    ext.text || "",
    ext.ocrText || "",
    ext.transcript || "",
    ...(ext.frames?.map((f) => f.ocrText || "").filter(Boolean) || []),
  ].filter(Boolean);
  const aggregateText = contentPieces.join("\n").slice(0, 12000);

  if (!openaiClient && !useLocalLLM) {
    return buildFallbackResult(aggregateText, "AI analysis unavailable (no OpenAI config and local LLM disabled).", options);
  }

  const systemPrompt = buildSystemPrompt(jurisdiction, strictLegal);
  const userContent = aggregateText || "No content was extracted from this document.";

  // Try local LLM first
  if (useLocalLLM) {
    try {
      const localResponse = await localLLM.chat([
        { role: "system", content: systemPrompt },
        { role: "user", content: `Analyze this document content:\n\n${userContent}` },
      ], { temperature: 0.2, max_tokens: 1800 });

      const parsed = safeJsonParse(localResponse);
      if (parsed) {
        return parseJsonResult(parsed, options);
      }
      console.warn("[LocalLLM] JSON parse failed, falling back to OpenAI");
    } catch (error) {
      console.warn("[LocalLLM] Analysis failed, falling back to OpenAI:", error);
    }
  }

  if (!openaiClient) {
    return buildFallbackResult(aggregateText, "OpenAI client not configured.", options);
  }

  try {
    const resp = await openaiClient.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Analyze this document content:\n\n${userContent}` },
      ],
      max_tokens: 1800,
      temperature: 0.2,
    });
    const text = resp.choices[0].message.content || "";
    const parsed = safeJsonParse(text);
    if (parsed) {
      return parseJsonResult(parsed, options);
    }
    throw new Error("LLM returned non-parseable JSON");
  } catch (err) {
    return buildFallbackResult(aggregateText, `LLM analysis failed: ${err instanceof Error ? err.message : String(err)}`, options);
  }
}

