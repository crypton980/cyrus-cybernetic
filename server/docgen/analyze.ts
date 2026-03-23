import OpenAI, { AzureOpenAI } from 'openai';
import { DocumentAnalysisClient, AzureKeyCredential } from '@azure/ai-form-recognizer';
import { DefaultAzureCredential, getBearerTokenProvider } from '@azure/identity';
import { localLLM } from "../ai/local-llm-client";
import { Audience, DocType, templates, toneByAudience, defaultDocType } from "./templates";

const openaiApiKey = process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const openaiBaseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;

const llmClient =
  openaiApiKey && openaiBaseUrl
    ? new AzureOpenAI({ endpoint: openaiBaseUrl, apiKey: openaiApiKey })
    : openaiBaseUrl
      ? new AzureOpenAI({ endpoint: openaiBaseUrl, azureADTokenProvider: getBearerTokenProvider(new DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default") })
      : null;

const documentIntelligenceKey = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;
const documentIntelligenceEndpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;

// Use managed identity if no API key provided
const documentClient =
  documentIntelligenceEndpoint
    ? documentIntelligenceKey
      ? new DocumentAnalysisClient(documentIntelligenceEndpoint, new AzureKeyCredential(documentIntelligenceKey))
      : new DocumentAnalysisClient(documentIntelligenceEndpoint, new DefaultAzureCredential())
    : null;

export interface SectionContent {
  title: string;
  content: string;
}

export interface AnalysisOutput {
  sections: SectionContent[];
  confidence: "High" | "Medium" | "Low";
  assumptions: string[];
  missing: string[];
}

export interface DocGenInput {
  mode: "full" | "convert" | "assist";
  docType?: DocType;
  audience?: Audience;
  purpose?: string;
  topic?: string;
  rawText?: string;
  data?: string;
  jurisdiction?: string;
  parties?: Record<string, string>;
}

async function extractDocumentText(data: string): Promise<string> {
  if (!documentClient) return data; // fallback to raw data

  try {
    // Assume data is base64 encoded file
    const buffer = Buffer.from(data, 'base64');
    const poller = await documentClient.beginAnalyzeDocument("prebuilt-read", buffer);
    const result = await poller.pollUntilDone();

    let extractedText = '';
    if (result.content) {
      extractedText = result.content;
    } else {
      // Fallback to pages
      for (const page of result.pages || []) {
        for (const line of page.lines || []) {
          extractedText += line.content + '\n';
        }
      }
    }
    return extractedText || data;
  } catch (error) {
    console.error('Document Intelligence error:', error);
    return data; // fallback
  }
}

function fallbackContent(template: DocType, payload: DocGenInput): AnalysisOutput {
  const secs = templates[template] || templates[defaultDocType];
  const baseContent =
    payload.rawText ||
    payload.topic ||
    payload.purpose ||
    "Content not provided. Populate this section with mission-relevant details.";
  const sections = secs.map((s) => ({
    title: s.title,
    content: `${baseContent} [Placeholder; additional details required]`,
  }));
  return {
    sections,
    confidence: "Low",
    assumptions: ["LLM analysis unavailable; placeholder text inserted."],
    missing: [],
  };
}

const LEGAL_DOC_TYPES: DocType[] = [
  "summons", "legal_report", "nda", "memorandum_of_agreement", "case_report",
  "affidavit", "court_order", "legal_notice", "settlement_agreement", "power_of_attorney",
];

function isLegalDocType(docType: DocType): boolean {
  return LEGAL_DOC_TYPES.includes(docType);
}

function buildLegalSystemPrompt(payload: DocGenInput, tone: string, sectionTitles: string[]): string {
  const jurisdiction = payload.jurisdiction || "the applicable jurisdiction";
  const parties = payload.parties
    ? Object.entries(payload.parties).map(([role, name]) => `${role}: ${name}`).join("; ")
    : null;

  return `You are CYRUS, an expert legal drafter and advocate. You draft submission-ready legal documents that are precise, unambiguous, and jurisdiction-compliant.

Jurisdiction: ${jurisdiction}
Document Type: ${payload.docType}
Tone: ${tone}
${parties ? `Parties: ${parties}` : ""}

Rules:
- Use the provided section titles exactly.
- Write in proper legal language appropriate for ${jurisdiction}.
- Reference applicable statutes, acts, regulations, and procedural rules of ${jurisdiction} where relevant.
- Include all standard legal boilerplate, recitals, definitions, and signature blocks appropriate to the document type.
- Number paragraphs/clauses in legal convention (1, 1.1, 1.1.1 etc.) within each section where appropriate.
- Do NOT invent specific case numbers, dates, or party details that were not provided — use placeholders like [CASE NO.], [DATE], [NAME] for missing details.
- Keep confidence lower if critical information (parties, dates, case numbers) is missing.
- In the signature block, include appropriate signatory lines, witness lines, and commissioner of oaths block as required by ${jurisdiction} law.

Return JSON with: sections (array of {title, content}), confidence (High/Medium/Low), assumptions (array), missing (array of section titles lacking info).
`;
}

export async function analyzeDocument(payload: DocGenInput): Promise<AnalysisOutput> {
  const docType = payload.docType || defaultDocType;
  const template = templates[docType] || templates[defaultDocType];
  const isLegal = isLegalDocType(docType);

  const tone = toneByAudience[payload.audience || (isLegal ? "legal" : "official")] || toneByAudience.official;
  const sectionTitles = template.map((s) => s.title);

  // Extract text from uploaded document if provided
  let rawText = payload.rawText;
  if (payload.data && !rawText) {
    rawText = await extractDocumentText(payload.data);
  }

  // Determine model — use gpt-4o for legal docs, gpt-4o-mini for others
  const model = isLegal ? "gpt-4o" : "gpt-4o-mini";

  const systemPrompt = isLegal
    ? buildLegalSystemPrompt(payload, tone, sectionTitles)
    : `
You are a professional ${payload.audience || "official"} writer. Produce a submission-ready document.
Rules:
- Use the provided section titles exactly.
- Write in formal, ${tone} tone.
- Avoid casual language.
- Keep each section concise but complete.
- If information is missing, state assumptions explicitly in-line.
- Do NOT invent data; keep confidence lower if information is sparse.
Return JSON with: sections (array of {title, content}), confidence (High/Medium/Low), assumptions (array), missing (array of section titles lacking info).
`;

  const userContent = {
    mode: payload.mode,
    docType,
    purpose: payload.purpose,
    topic: payload.topic,
    rawText,
    data: payload.data,
    jurisdiction: payload.jurisdiction,
    parties: payload.parties,
    sections: sectionTitles,
  };

  if (!llmClient && !process.env.OPENAI_API_KEY && !process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    // Try local LLM
    try {
      const localPrompt = `${systemPrompt}\n\nDocument details:\n${JSON.stringify(userContent, null, 2)}`;
      const raw = await localLLM.chat([
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(userContent) },
      ], { temperature: 0.2, max_tokens: 2000 });
      const parsed = JSON.parse(raw);
      const sections: SectionContent[] = Array.isArray(parsed.sections) ? parsed.sections : template.map((t) => ({ title: t.title, content: "" }));
      const confidence: "High" | "Medium" | "Low" = parsed.confidence === "High" || parsed.confidence === "Low" ? parsed.confidence : "Medium";
      return { sections, confidence, assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions : [], missing: Array.isArray(parsed.missing) ? parsed.missing : [] };
    } catch {
      return fallbackContent(docType, payload);
    }
  }

  if (!llmClient) return fallbackContent(docType, payload);

  try {
    const resp = await llmClient.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(userContent) },
      ],
      response_format: { type: "json_object" },
      max_tokens: isLegal ? 2500 : 900,
    });
    const parsed = JSON.parse(resp.choices[0].message.content || "{}");
    const sections: SectionContent[] = Array.isArray(parsed.sections)
      ? parsed.sections
      : template.map((t) => ({ title: t.title, content: "" }));
    const confidence: "High" | "Medium" | "Low" =
      parsed.confidence === "High" || parsed.confidence === "Low" ? parsed.confidence : "Medium";
    const assumptions: string[] = Array.isArray(parsed.assumptions) ? parsed.assumptions : [];
    const missing: string[] = Array.isArray(parsed.missing) ? parsed.missing : [];
    return { sections, confidence, assumptions, missing };
  } catch (err) {
    // Try local LLM as fallback
    try {
      const raw = await localLLM.chat([
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(userContent) },
      ], { temperature: 0.2, max_tokens: 2000 });
      const parsed = JSON.parse(raw);
      const sections: SectionContent[] = Array.isArray(parsed.sections) ? parsed.sections : template.map((t) => ({ title: t.title, content: "" }));
      const confidence: "High" | "Medium" | "Low" = parsed.confidence === "High" || parsed.confidence === "Low" ? parsed.confidence : "Medium";
      return { sections, confidence, assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions : [], missing: Array.isArray(parsed.missing) ? parsed.missing : [] };
    } catch {
      return fallbackContent(docType, payload);
    }
  }
}

