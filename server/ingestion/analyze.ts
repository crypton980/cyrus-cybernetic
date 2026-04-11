import { localLLM } from "../ai/local-llm-client.js";
import { ExtractionResult } from "./extract.js";

const openaiApiKey = process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const openaiBaseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;

// Use local LLM as primary, OpenAI as fallback
const useLocalLLM = process.env.USE_LOCAL_LLM !== 'false';
let openaiClient: any = null;

async function initOpenAIClient() {
  if (!openaiClient && !useLocalLLM && openaiApiKey) {
    const OpenAI = (await import("openai")).default;
    openaiClient = new OpenAI({ apiKey: openaiApiKey, baseURL: openaiBaseUrl });
  }
}

export interface AnalysisOptions {
  jurisdiction?: string;
  strictLegalReview?: boolean;
}

export interface AnalysisCitation {
  clause: string;
  excerpt: string;
  rationale: string;
}

export interface AnalysisResult {
  summary: string;
  findings: string[];
  issues: string[];
  interpretation: string;
  recommendations: string[];
  confidence: "High" | "Medium" | "Low";
  documentType?: string;
  documentTypeConfidence?: "High" | "Medium" | "Low";
  decisionActions?: Array<{
    action: string;
    owner: string;
    deadline: string;
    obligation: string;
  }>;
  executiveBrief?: string;
  knowledgeApplied?: string[];
  capabilitySummary?: string;
  jurisdictionApplied?: string;
  strictLegalReview?: boolean;
  citationAnchors?: AnalysisCitation[];
  chunksAnalyzed?: number;
  entities?: Array<{ type: string; value: string }>;
  riskLevel?: "low" | "medium" | "high";
}

export async function analyzeExtraction(ext: ExtractionResult, options: AnalysisOptions = {}): Promise<AnalysisResult> {
  // Initialize OpenAI client if needed
  await initOpenAIClient();

  const contentPieces = [
    ext.text || "",
    ext.ocrText || "",
    ext.transcript || "",
    ...(ext.frames?.map((f) => f.ocrText || "").filter(Boolean) || []),
  ].filter(Boolean);
  const aggregateText = contentPieces.join("\n").slice(0, 8000); // cap to avoid long prompts

  // Detect if this is a legal document
  const isLegalDocument = detectLegalDocument(aggregateText);

  // If it's a legal document, try to use the advanced legal analysis module
  if (isLegalDocument && options.jurisdiction) {
    try {
      const legalAnalysis = await performLegalAnalysis(aggregateText, options.jurisdiction, options.strictLegalReview || false);
      if (legalAnalysis) {
        return legalAnalysis;
      }
    } catch (error) {
      console.warn("[Legal Analysis] Advanced legal analysis failed, falling back to standard analysis:", error);
      // Continue to standard analysis
    }
  }

  if (!openaiClient && !useLocalLLM) {
    return {
      summary: aggregateText ? aggregateText.slice(0, 300) : "No extracted text",
      findings: [],
      issues: ["AI analysis unavailable (no OpenAI config and local LLM disabled)."],
      interpretation: "Minimal analysis due to missing AI configuration.",
      recommendations: ["Configure OpenAI credentials or enable local LLM for full analysis."],
      confidence: aggregateText ? "Low" : "Low",
    };
  }

  const prompt = `
You are a professional analyst. Given extracted content from an uploaded file, produce a concise report:
- Summary (2-4 sentences)
- Key Findings (bullets)
- Issues/Gaps (bullets)
- Interpretation (1-2 sentences)
- Recommendations (bullets)
- Confidence (High/Medium/Low)

If content is minimal, explain that and keep confidence Low.
`;

  // Try local LLM first
  if (useLocalLLM) {
    try {
      const localPrompt = `${prompt}\n\nContent to analyze:\n${aggregateText || "No content extracted."}`;
      const localResponse = await localLLM.chat([
        { role: "system", content: "You are a professional analyst providing concise, factual analysis." },
        { role: "user", content: localPrompt }
      ], { temperature: 0.3, max_tokens: 600 });

      return parseLLMReport(localResponse);
    } catch (error) {
      console.warn("[LocalLLM] Analysis failed, falling back to OpenAI:", error);
      // Continue to OpenAI fallback
    }
  }

  try {
    const resp = await openaiClient.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: aggregateText || "No content extracted." },
      ],
      max_tokens: 600,
    });
    const text = resp.choices[0].message.content || "";
    return parseLLMReport(text);
  } catch (err) {
    return {
      summary: aggregateText ? aggregateText.slice(0, 300) : "No extracted text",
      findings: [],
      issues: [`LLM analysis failed: ${err}`],
      interpretation: "Partial analysis; LLM call failed.",
      recommendations: ["Retry analysis later."],
      confidence: "Low",
    };
  }
}

function parseLLMReport(text: string): AnalysisResult {
  // Very light parser: split by lines; not strict.
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const findings: string[] = [];
  const issues: string[] = [];
  const recommendations: string[] = [];
  let summary = "";
  let interpretation = "";
  let confidence: "High" | "Medium" | "Low" = "Medium";

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (!summary && lower.startsWith("summary")) {
      summary = line.replace(/summary[:\-]\s*/i, "");
      continue;
    }
    if (lower.startsWith("-") || lower.startsWith("•")) {
      if (lower.includes("issue") || lower.includes("gap")) issues.push(line.replace(/^[-•]\s*/, ""));
      else if (lower.includes("recommend")) recommendations.push(line.replace(/^[-•]\s*/, ""));
      else findings.push(line.replace(/^[-•]\s*/, ""));
      continue;
    }
    if (lower.includes("confidence")) {
      if (lower.includes("high")) confidence = "High";
      else if (lower.includes("low")) confidence = "Low";
      else confidence = "Medium";
      continue;
    }
    if (lower.startsWith("interpretation")) {
      interpretation = line.replace(/interpretation[:\-]\s*/i, "");
      continue;
    }
    if (!summary) summary = line;
  }

  return {
    summary: summary || "Summary unavailable",
    findings,
    issues,
    interpretation: interpretation || "Interpretation unavailable",
    recommendations,
    confidence,
  };
}

function detectLegalDocument(content: string): boolean {
  const legalKeywords = [
    'court', 'case', 'law', 'legal', 'act', 'statute', 'regulation', 'constitution',
    'plaintiff', 'defendant', 'judge', 'attorney', 'lawyer', 'evidence', 'testimony',
    'contract', 'agreement', 'breach', 'damages', 'liability', 'negligence',
    'criminal', 'civil', 'tort', 'property', 'contract law', 'constitutional law',
    'supreme court', 'high court', 'magistrate', 'prosecution', 'defense',
    'witness', 'affidavit', 'pleading', 'motion', 'judgment', 'sentence',
    'botswana', 'constitution of botswana', 'penal code', 'civil procedure'
  ];

  const lowerContent = content.toLowerCase();
  const keywordMatches = legalKeywords.filter(keyword => lowerContent.includes(keyword)).length;

  // Consider it a legal document if it has 3+ legal keywords
  return keywordMatches >= 3;
}

async function performLegalAnalysis(content: string, jurisdiction: string, strictReview: boolean): Promise<AnalysisResult | null> {
  try {
    const bridgeBase = process.env.QUANTUM_BRIDGE_URL || "http://quantum-bridge:5001";
    // Call the quantum bridge for legal analysis
    const response = await fetch(`${bridgeBase}/legal/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
        jurisdiction,
        strictLegalReview: strictReview
      }),
    });

    if (!response.ok) {
      throw new Error(`Legal analysis request failed: ${response.status}`);
    }

    const result = await response.json();

    if (result.error) {
      console.warn("[Legal Analysis] Python module error:", result.error);
      return null;
    }

    // Transform the Python module result to match our AnalysisResult interface
    const legalAnalysis = result.legal_analysis || {};
    const documentInfo = result.document_info || {};

    return {
      summary: legalAnalysis.summary || documentInfo.summary || "Legal document analysis completed",
      findings: legalAnalysis.key_findings || [],
      issues: legalAnalysis.issues || [],
      interpretation: legalAnalysis.interpretation || "Legal analysis performed",
      recommendations: legalAnalysis.recommendations || [],
      confidence: result.confidence || "Medium",
      documentType: legalAnalysis.document_type || "Legal Document",
      documentTypeConfidence: "High",
      decisionActions: legalAnalysis.recommended_proceedings || [],
      executiveBrief: legalAnalysis.executive_summary || "",
      knowledgeApplied: legalAnalysis.applicable_laws || [],
      capabilitySummary: legalAnalysis.capability_summary || "",
      jurisdictionApplied: jurisdiction,
      strictLegalReview: strictReview,
      citationAnchors: legalAnalysis.citation_anchors || [],
      chunksAnalyzed: legalAnalysis.chunks_analyzed || 1,
      entities: legalAnalysis.entities || [],
      riskLevel: legalAnalysis.risk_level || "medium"
    };

  } catch (error) {
    console.error("[Legal Analysis] Failed to perform legal analysis:", error);
    return null;
  }
}

