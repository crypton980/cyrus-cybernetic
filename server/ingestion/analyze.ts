import { localLLM } from "../ai/local-llm-client";
import { ExtractionResult } from "./extract";
import fs from "fs/promises";
import path from "path";

const openaiApiKey = process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const openaiBaseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;

// Use local LLM as primary, OpenAI as fallback
const useLocalLLM = process.env.USE_LOCAL_LLM !== 'false';
const openaiClient =
  (!useLocalLLM && openaiApiKey)
    ? new (await import("openai")).default({ apiKey: openaiApiKey, baseURL: openaiBaseUrl })
    : null;

// Path to constitutional knowledge base
const LEGAL_KNOWLEDGE_DIR = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "../ai/interactive/legal-knowledge"
);

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface AnalysisCitation {
  text: string;
  page?: number;
  location?: string;
}

export interface AnalysisOptions {
  jurisdiction?: string;
  caseType?: string;
  strictLegalReview?: boolean;
  [key: string]: unknown;
}

export interface LegalApplicableLaw {
  law: string;
  section: string;
  relevance: string;
}

export interface LegalConstitutionalProvision {
  article: string;
  text: string;
  application: string;
}

export interface LegalDocumentEdit {
  section: string;
  issue: string;
  suggestion: string;
}

export interface LegalDocumentAnalysis {
  isLegalDocument: boolean;
  documentCategory:
    | "case_file"
    | "court_order"
    | "contract"
    | "statute"
    | "affidavit"
    | "agreement"
    | "charge_sheet"
    | "notice"
    | "other";
  detectedJurisdiction: string;
  legalInterpretation: string;
  applicableLaws: LegalApplicableLaw[];
  constitutionalProvisions: LegalConstitutionalProvision[];
  criminalProcedureAnalysis: string | null;
  legalAdvice: string[];
  suggestedEdits: LegalDocumentEdit[];
  complianceStatus: "compliant" | "non_compliant" | "requires_review";
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
  chunksAnalyzed?: number;
  legalAnalysis?: LegalDocumentAnalysis;
}

// ─── Jurisdiction detection ───────────────────────────────────────────────────

const JURISDICTION_PATTERNS: Array<{ pattern: RegExp; jurisdiction: string; constitutionFile: string }> = [
  { pattern: /botswana|bw\b|high court of botswana|republic of botswana|magistrat.{0,10}court.*botswana/i, jurisdiction: "Botswana", constitutionFile: "constitution-botswana.md" },
  { pattern: /united states|usa\b|u\.s\.a|u\.s\. |federal court|supreme court of the united states|u\.s\. code|usc §/i, jurisdiction: "United States", constitutionFile: "constitution-united-states.md" },
  { pattern: /united kingdom|uk\b|england|wales|scotland|northern ireland|crown court|magistrates.{0,5}court.*uk|parliament of the uk/i, jurisdiction: "United Kingdom", constitutionFile: "constitution-united-kingdom.md" },
  { pattern: /australia|commonwealth of australia|federal court of australia|high court of australia|state of new south wales|victoria|queensland/i, jurisdiction: "Australia", constitutionFile: "constitution-australia.md" },
  { pattern: /canada|canadian|federal court of canada|supreme court of canada|province of ontario|province of british columbia/i, jurisdiction: "Canada", constitutionFile: "constitution-canada.md" },
  { pattern: /germany|deutschland|bundesrepublik|grundgesetz|bundesverfassungsgericht|amtsgericht|landgericht/i, jurisdiction: "Germany", constitutionFile: "constitution-germany.md" },
  { pattern: /france|french republic|republique française|tribunal|cour d.appel|code civil|code pénal/i, jurisdiction: "France", constitutionFile: "constitution-france.md" },
  { pattern: /japan|japanese|japanese court|district court.*japan|supreme court.*japan/i, jurisdiction: "Japan", constitutionFile: "constitution-japan.md" },
  { pattern: /china|people's republic|prc\b|zhonghua|chinese court/i, jurisdiction: "China", constitutionFile: "constitution-china.md" },
];

const LEGAL_DOCUMENT_PATTERNS = [
  /\b(plaintiff|defendant|respondent|applicant|appellant|petitioner)\b/i,
  /\b(court|tribunal|magistrate|judge|judgment|verdict|sentence|hearing|trial|prosecution|defense|counsel|attorney|advocate|solicitor)\b/i,
  /\b(affidavit|deposition|subpoena|warrant|indictment|charge\s?sheet|summons|injunction|order of court|writ)\b/i,
  /\b(contract|agreement|clause|party|parties|hereby|thereto|heretofore|pursuant to|notwithstanding|in witness whereof)\b/i,
  /\b(section\s*\d+|article\s*\d+|regulation\s*\d+|act\s+no\.?\s*\d+|chapter\s+\d+)\b/i,
  /\b(criminal|civil|constitutional|statutory|legislative|judicial|legal|law|act|statute|ordinance|bylaw)\b/i,
  /\b(case no\.?|docket|cause number|matter of|in re:|versus|vs\.)\b/i,
];

const CRIMINAL_DOCUMENT_PATTERNS = [
  /\b(accused|charge|charge\s?sheet|indictment|arraignment|bail|remand|custody|detention|arrest|warrant)\b/i,
  /\b(criminal\s+(?:procedure|case|charge|trial|matter)|prosecution|prosecutor|state\s+v\.?\s+|republic\s+v\.?\s+)\b/i,
  /\b(sentence|imprisonment|fine|probation|parole|acquittal|conviction|guilty|not guilty|plead)\b/i,
];

function detectLegalDocument(text: string): boolean {
  const matches = LEGAL_DOCUMENT_PATTERNS.filter((p) => p.test(text));
  return matches.length >= 2;
}

function detectCriminalDocument(text: string): boolean {
  return CRIMINAL_DOCUMENT_PATTERNS.some((p) => p.test(text));
}

function detectJurisdiction(text: string, explicitJurisdiction?: string): { jurisdiction: string; constitutionFile: string } {
  if (explicitJurisdiction) {
    const match = JURISDICTION_PATTERNS.find((j) =>
      j.jurisdiction.toLowerCase() === explicitJurisdiction.toLowerCase() ||
      j.pattern.test(explicitJurisdiction)
    );
    if (match) return { jurisdiction: match.jurisdiction, constitutionFile: match.constitutionFile };
  }

  for (const jp of JURISDICTION_PATTERNS) {
    if (jp.pattern.test(text)) return { jurisdiction: jp.jurisdiction, constitutionFile: jp.constitutionFile };
  }

  // Default to Botswana (system home jurisdiction)
  return { jurisdiction: "Botswana", constitutionFile: "constitution-botswana.md" };
}

async function loadConstitution(constitutionFile: string): Promise<string> {
  try {
    const filePath = path.join(LEGAL_KNOWLEDGE_DIR, constitutionFile);
    const raw = await fs.readFile(filePath, "utf-8");
    // Trim to ~6000 chars to leave room in the prompt for document content
    return raw.slice(0, 6000);
  } catch {
    return "";
  }
}

// ─── Legal analysis engine ────────────────────────────────────────────────────

async function performLegalAnalysis(
  documentText: string,
  options: AnalysisOptions,
  isCriminal: boolean,
): Promise<LegalDocumentAnalysis> {
  const { jurisdiction, constitutionFile } = detectJurisdiction(documentText, options.jurisdiction);
  const constitutionText = await loadConstitution(constitutionFile);
  const caseType = options.caseType || (isCriminal ? "Criminal" : "Civil/General");

  const systemPrompt = `You are CYRUS, an advanced legal analysis AI. You are a constitutional law expert, criminal procedure specialist, and experienced advocate. Your analysis must be legally precise, constitutionally grounded, and practically actionable.

Jurisdiction: ${jurisdiction}
Case/Document Type: ${caseType}

You have access to the ${jurisdiction} constitution and must cite specific articles and provisions. Your response MUST be valid JSON matching exactly this structure:
{
  "documentCategory": "case_file|court_order|contract|statute|affidavit|agreement|charge_sheet|notice|other",
  "legalInterpretation": "...",
  "applicableLaws": [{"law": "...", "section": "...", "relevance": "..."}],
  "constitutionalProvisions": [{"article": "...", "text": "...", "application": "..."}],
  "criminalProcedureAnalysis": "..." or null,
  "legalAdvice": ["...", "..."],
  "suggestedEdits": [{"section": "...", "issue": "...", "suggestion": "..."}],
  "complianceStatus": "compliant|non_compliant|requires_review"
}`;

  const userPrompt = `DOCUMENT TO ANALYSE:
${documentText.slice(0, 5000)}

CONSTITUTIONAL REFERENCE (${jurisdiction}):
${constitutionText}

Perform a comprehensive legal analysis covering:
1. Document category and legal nature
2. Legal interpretation: What does this document mean legally? What rights, obligations, duties, and powers does it create or affect?
3. Applicable laws: Which specific statutes, acts, regulations, and codes apply? Cite section numbers.
4. Constitutional provisions: Which specific constitutional articles apply? Quote relevant text and explain application to this document.
${isCriminal ? "5. Criminal procedure analysis: Assess compliance with criminal procedure requirements (charges, rights of accused, procedural steps, bail, trial procedure, sentencing guidelines)." : "5. Compliance analysis: Are there any procedural or substantive compliance issues?"}
6. Legal advice: Practical, actionable advice for each party in this document.
7. Suggested edits: Identify any legal errors, non-compliant clauses, missing elements, or improvements needed — give specific rewrite suggestions.
8. Compliance status: Overall assessment.

Be thorough, cite specific laws and constitutional articles, and provide concrete advice.`;

  const llmCall = async (client: any) => {
    const resp = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 2500,
    });
    return resp.choices[0].message.content || "{}";
  };

  let rawJson = "{}";
  try {
    if (openaiClient) {
      rawJson = await llmCall(openaiClient);
    } else if (useLocalLLM) {
      rawJson = await localLLM.chat([
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ], { temperature: 0.1, max_tokens: 2500 });
    }
  } catch (err) {
    console.warn("[LegalAnalysis] LLM call failed:", err);
  }

  let parsed: any = {};
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    // Attempt to extract JSON from freeform text
    const match = rawJson.match(/\{[\s\S]*\}/);
    if (match) {
      try { parsed = JSON.parse(match[0]); } catch { /* ignore */ }
    }
  }

  const validCategories = ["case_file", "court_order", "contract", "statute", "affidavit", "agreement", "charge_sheet", "notice", "other"];
  const validCompliance = ["compliant", "non_compliant", "requires_review"];

  return {
    isLegalDocument: true,
    documentCategory: validCategories.includes(parsed.documentCategory) ? parsed.documentCategory : "other",
    detectedJurisdiction: jurisdiction,
    legalInterpretation: typeof parsed.legalInterpretation === "string" && parsed.legalInterpretation
      ? parsed.legalInterpretation
      : "Legal interpretation could not be determined from the document content.",
    applicableLaws: Array.isArray(parsed.applicableLaws)
      ? parsed.applicableLaws.filter((l: any) => l && typeof l.law === "string")
      : [],
    constitutionalProvisions: Array.isArray(parsed.constitutionalProvisions)
      ? parsed.constitutionalProvisions.filter((p: any) => p && typeof p.article === "string")
      : [],
    criminalProcedureAnalysis: isCriminal
      ? (typeof parsed.criminalProcedureAnalysis === "string" ? parsed.criminalProcedureAnalysis : null)
      : null,
    legalAdvice: Array.isArray(parsed.legalAdvice)
      ? parsed.legalAdvice.filter((a: any) => typeof a === "string")
      : [],
    suggestedEdits: Array.isArray(parsed.suggestedEdits)
      ? parsed.suggestedEdits.filter((e: any) => e && typeof e.section === "string")
      : [],
    complianceStatus: validCompliance.includes(parsed.complianceStatus) ? parsed.complianceStatus : "requires_review",
  };
}

// ─── Generic analysis ─────────────────────────────────────────────────────────

export async function analyzeExtraction(ext: ExtractionResult, options: AnalysisOptions = {}): Promise<AnalysisResult> {
  const contentPieces = [
    ext.text || "",
    ext.ocrText || "",
    ext.transcript || "",
    ...(ext.frames?.map((f) => f.ocrText || "").filter(Boolean) || []),
  ].filter(Boolean);
  const aggregateText = contentPieces.join("\n").slice(0, 8000); // cap to avoid long prompts

  if (!openaiClient && !useLocalLLM) {
    return {
      summary: aggregateText ? aggregateText.slice(0, 300) : "No extracted text",
      findings: [],
      issues: ["AI analysis unavailable (no OpenAI config and local LLM disabled)."],
      interpretation: "Minimal analysis due to missing AI configuration.",
      recommendations: ["Configure OpenAI credentials or enable local LLM for full analysis."],
      confidence: aggregateText ? "Low" : "Low",
      documentType: "Unknown",
      documentTypeConfidence: "Low",
      decisionActions: [],
      executiveBrief: "",
      knowledgeApplied: [],
      capabilitySummary: "",
      jurisdictionApplied: "",
      strictLegalReview: false,
      citationAnchors: [],
    };
  }

  // Detect whether the document is legal in nature
  const isLegal = detectLegalDocument(aggregateText) || options.strictLegalReview === true;
  const isCriminal = detectCriminalDocument(aggregateText);

  // Run generic analysis and (if legal) legal analysis in parallel
  const jurisdictionNote = options.jurisdiction ? `\n- Apply ${options.jurisdiction} jurisdiction rules.` : '';
  const legalNote = isLegal ? '\n- Apply strict legal review standards; identify constitutional and statutory issues.' : '';
  const prompt = `
You are a professional analyst. Given extracted content from an uploaded file, produce a concise report:
- Summary (2-4 sentences)
- Key Findings (bullets)
- Issues/Gaps (bullets)
- Interpretation (1-2 sentences)
- Recommendations (bullets)
- Confidence (High/Medium/Low)${jurisdictionNote}${legalNote}

If content is minimal, explain that and keep confidence Low.
`;

  const genericAnalysisPromise = (async () => {
    if (useLocalLLM) {
      try {
        const localPrompt = `${prompt}\n\nContent to analyze:\n${aggregateText || "No content extracted."}`;
        const localResponse = await localLLM.chat([
          { role: "system", content: "You are a professional analyst providing concise, factual analysis." },
          { role: "user", content: localPrompt }
        ], { temperature: 0.3, max_tokens: 600 });
        return parseLLMReport(localResponse, options);
      } catch (error) {
        console.warn("[LocalLLM] Analysis failed, falling back to OpenAI:", error);
      }
    }
    if (!openaiClient) throw new Error("OpenAI not configured");
    const resp = await openaiClient.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: aggregateText || "No content extracted." },
      ],
      max_tokens: 600,
    });
    return parseLLMReport(resp.choices[0].message.content || "", options);
  })();

  const legalAnalysisPromise = isLegal && aggregateText
    ? performLegalAnalysis(aggregateText, options, isCriminal).catch((err) => {
        console.warn("[LegalAnalysis] Failed:", err);
        return undefined;
      })
    : Promise.resolve(undefined);

  let genericResult: AnalysisResult;
  try {
    genericResult = await genericAnalysisPromise;
  } catch (err) {
    genericResult = {
      summary: aggregateText ? aggregateText.slice(0, 300) : "No extracted text",
      findings: [],
      issues: [`LLM analysis failed: ${err}`],
      interpretation: "Partial analysis; LLM call failed.",
      recommendations: ["Retry analysis later."],
      confidence: "Low",
      documentType: "Unknown",
      documentTypeConfidence: "Low",
      decisionActions: [],
      executiveBrief: "",
      knowledgeApplied: [],
      capabilitySummary: "",
      jurisdictionApplied: options.jurisdiction || "",
      strictLegalReview: options.strictLegalReview || false,
      citationAnchors: [],
    };
  }

  const legalAnalysis = await legalAnalysisPromise;

  if (legalAnalysis) {
    const { jurisdiction } = detectJurisdiction(aggregateText, options.jurisdiction);
    genericResult.jurisdictionApplied = jurisdiction;
    genericResult.strictLegalReview = true;
    genericResult.legalAnalysis = legalAnalysis;
    genericResult.documentType = legalAnalysis.documentCategory;
    genericResult.documentTypeConfidence = "High";
    if (!genericResult.knowledgeApplied.includes("legal-knowledge-base")) {
      genericResult.knowledgeApplied.push("legal-knowledge-base");
    }
    if (!genericResult.knowledgeApplied.includes(`constitution-${jurisdiction.toLowerCase().replace(/\s+/g, "-")}`)) {
      genericResult.knowledgeApplied.push(`constitution-${jurisdiction.toLowerCase().replace(/\s+/g, "-")}`);
    }
  }

  return genericResult;
}

// ─── Result parser ────────────────────────────────────────────────────────────

function parseLLMReport(text: string, options: AnalysisOptions = {}): AnalysisResult {
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
    documentType: "Document",
    documentTypeConfidence: "Low",
    decisionActions: [],
    executiveBrief: summary || "Summary unavailable",
    knowledgeApplied: [],
    capabilitySummary: "",
    jurisdictionApplied: options.jurisdiction || "",
    strictLegalReview: options.strictLegalReview || false,
    citationAnchors: [],
  };
}

