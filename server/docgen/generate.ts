import OpenAI from "openai";

const openaiApiKey = process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const openaiBaseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const openaiClient = openaiApiKey
  ? new OpenAI({ apiKey: openaiApiKey, ...(openaiBaseUrl ? { baseURL: openaiBaseUrl } : {}) })
  : null;

export interface DataVisualSpec {
  id: string;
  kind: "table" | "bar_chart" | "line_chart" | "pie_chart" | "pictograph";
  title: string;
  sectionTitle: string;
  placement: string;
  rationale: string;
  sourceReference: string;
  unit?: string;
  icon?: string;
  labels?: string[];
  values?: number[];
  columns?: string[];
  rows?: string[][];
}

export interface GeneratedDocument {
  docType: string;
  audience: string;
  title: string;
  confidence: "High" | "Medium" | "Low";
  assumptions: string[];
  missing: string[];
  sections: Array<{ title: string; content: string }>;
  outline: Array<{ level: string; title: string; purpose: string }>;
  pullQuotes: Array<{ quote: string; sectionTitle: string; placement: string }>;
  layoutPlan: Array<{ kind: string; title: string; placement: string; notes: string }>;
  graphicsPlan: Array<{ sectionTitle: string; assetType: string; placement: string; brief: string }>;
  dataVisuals: DataVisualSpec[];
  rendered: string;
  htmlRendered: string;
  wordCount: number;
  estimatedPages: number;
  targetPages?: number;
}

export interface DocGenInput {
  docType?: string;
  content?: string;
  audience?: string;
  targetPages?: number;
  wordsPerPage?: number;
  includeImages?: boolean;
  imageStyle?: "realistic_3d" | "graphical" | "schematic";
  // legacy fields kept for compatibility
  mode?: string;
  purpose?: string;
  topic?: string;
  rawText?: string;
  data?: string;
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function sectionsToMarkdown(sections: Array<{ title: string; content: string }>): string {
  return sections
    .map((s) => `## ${s.title}\n\n${s.content}`)
    .join("\n\n---\n\n");
}

function sectionsToHtml(
  title: string,
  docType: string,
  audience: string,
  sections: Array<{ title: string; content: string }>,
): string {
  const sectionHtml = sections
    .map(
      (s) =>
        `<section class="doc-section">
  <h2>${s.title}</h2>
  <div class="section-content">${s.content.replace(/\n/g, "<br/>")}</div>
</section>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${title}</title>
<style>
  body { font-family: 'Georgia', serif; max-width: 900px; margin: 0 auto; padding: 48px 32px; color: #1a1a1a; line-height: 1.7; }
  h1 { font-size: 2rem; border-bottom: 3px solid #333; padding-bottom: 12px; margin-bottom: 8px; }
  .meta { color: #555; font-size: 0.9rem; margin-bottom: 36px; }
  h2 { font-size: 1.3rem; color: #222; border-left: 4px solid #666; padding-left: 12px; margin-top: 32px; }
  .doc-section { margin-bottom: 28px; }
  .section-content { margin-top: 8px; }
  hr { border: none; border-top: 1px solid #ddd; margin: 28px 0; }
  @media print { body { padding: 24px 16px; } }
</style>
</head>
<body>
<h1>${title}</h1>
<div class="meta">Document Type: ${docType} &nbsp;|&nbsp; Audience: ${audience}</div>
${sectionHtml}
</body>
</html>`;
}

function buildSystemPrompt(
  docType: string,
  audience: string,
  targetPages: number,
  wordsPerPage: number,
): string {
  const targetWords = targetPages * wordsPerPage;
  return `You are an expert document writer and layout designer. Produce a complete, submission-ready ${docType} document.

Requirements:
- Audience: ${audience}
- Target length: approximately ${targetWords} words across all sections (about ${targetPages} pages at ${wordsPerPage} words/page)
- Write each section with full prose, not bullet points (unless naturally a list)
- Professional, formal tone appropriate for a ${audience} audience
- Each section must have substantive content — do NOT leave placeholders

Return ONLY a valid JSON object (no markdown, no extra text) with exactly these fields:
{
  "title": "Document title",
  "confidence": "High | Medium | Low",
  "assumptions": ["assumption 1", "assumption 2"],
  "missing": ["item that was missing from input", "..."],
  "sections": [
    { "title": "Section Title", "content": "Full prose content for this section..." },
    ...
  ],
  "outline": [
    { "level": "1 | 2 | 3", "title": "Outline item title", "purpose": "What this section accomplishes" },
    ...
  ],
  "pullQuotes": [
    { "quote": "A compelling quote from the content", "sectionTitle": "Source section", "placement": "after introduction | sidebar | end of section" },
    ...
  ],
  "layoutPlan": [
    { "kind": "header | section | callout | figure | table | footer", "title": "Layout item title", "placement": "page position description", "notes": "Design notes" },
    ...
  ],
  "graphicsPlan": [
    { "sectionTitle": "Section this graphic belongs to", "assetType": "photograph | illustration | chart | diagram | icon", "placement": "left | right | full-width | inline", "brief": "Description of what the graphic should show" },
    ...
  ],
  "dataVisuals": [
    { "id": "unique-id", "kind": "table | bar_chart | line_chart | pie_chart | pictograph", "title": "Visual title", "sectionTitle": "Section this belongs to", "placement": "inline | sidebar", "rationale": "Why this visual is useful", "sourceReference": "Based on...", "labels": ["label1", "label2"], "values": [10, 20] }
  ]
}`;
}

function safeParseJson(text: string): any | null {
  const cleaned = text.replace(/^```(?:json)?\n?/i, "").replace(/\n?```\s*$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
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

function buildFallbackDocument(input: DocGenInput): GeneratedDocument {
  const rawContent = input.content || input.rawText || input.topic || input.purpose || "No content provided.";
  const docType = input.docType || "report";
  const audience = input.audience || "official";
  const targetPages = input.targetPages || 12;
  const wordsPerPage = input.wordsPerPage || 280;

  const sections = [
    { title: "Executive Summary", content: rawContent },
    { title: "Introduction", content: "This document provides an overview of the subject matter." },
    { title: "Main Body", content: rawContent },
    { title: "Conclusions", content: "Further analysis is recommended." },
    { title: "Recommendations", content: "Please review and provide additional information for a complete analysis." },
  ];

  const rendered = sectionsToMarkdown(sections);
  const wordCount = countWords(rendered);

  return {
    docType,
    audience,
    title: "Generated Document",
    confidence: "Low",
    assumptions: ["AI document generation unavailable; placeholder content inserted."],
    missing: ["OpenAI API key required for full document generation"],
    sections,
    outline: sections.map((s, i) => ({ level: "1", title: s.title, purpose: `Section ${i + 1}` })),
    pullQuotes: [],
    layoutPlan: [],
    graphicsPlan: [],
    dataVisuals: [],
    rendered,
    htmlRendered: sectionsToHtml("Generated Document", docType, audience, sections),
    wordCount,
    estimatedPages: Math.max(1, Math.round(wordCount / wordsPerPage)),
    targetPages,
  };
}

export async function generateDocument(
  input: DocGenInput,
  _hooks?: {
    onProgress?: (progress: number, stage: string) => void;
    shouldCancel?: () => boolean;
  },
): Promise<GeneratedDocument> {
  const docType = input.docType || "report";
  const audience = input.audience || "official";
  const targetPages = input.targetPages || 12;
  const wordsPerPage = input.wordsPerPage || 280;
  const rawContent = input.content || input.rawText || input.topic || input.purpose || "";

  if (!openaiClient) {
    return buildFallbackDocument(input);
  }

  const systemPrompt = buildSystemPrompt(docType, audience, targetPages, wordsPerPage);
  const userContent = rawContent
    ? `Generate a ${docType} document based on the following content/notes:\n\n${rawContent}`
    : `Generate a complete ${docType} document for a ${audience} audience. Since no specific content was provided, create a well-structured ${docType} with placeholder content that demonstrates the format and structure.`;

  try {
    const resp = await openaiClient.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      max_tokens: 4000,
      temperature: 0.4,
    });

    const responseText = resp.choices[0].message.content || "";
    const parsed = safeParseJson(responseText);

    if (!parsed) {
      return buildFallbackDocument(input);
    }

    const sections: Array<{ title: string; content: string }> = Array.isArray(parsed.sections)
      ? parsed.sections.map((s: any) => ({ title: String(s.title || ""), content: String(s.content || "") }))
      : [{ title: "Content", content: rawContent || "No content available." }];

    const rendered = sectionsToMarkdown(sections);
    const wordCount = countWords(rendered);
    const title = String(parsed.title || `${docType.charAt(0).toUpperCase() + docType.slice(1)} Document`);

    return {
      docType,
      audience,
      title,
      confidence: (["High", "Medium", "Low"].includes(parsed.confidence) ? parsed.confidence : "Medium") as "High" | "Medium" | "Low",
      assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions.map(String) : [],
      missing: Array.isArray(parsed.missing) ? parsed.missing.map(String) : [],
      sections,
      outline: Array.isArray(parsed.outline)
        ? parsed.outline.map((o: any) => ({
            level: String(o.level || "1"),
            title: String(o.title || ""),
            purpose: String(o.purpose || ""),
          }))
        : sections.map((s) => ({ level: "1", title: s.title, purpose: "" })),
      pullQuotes: Array.isArray(parsed.pullQuotes)
        ? parsed.pullQuotes.map((q: any) => ({
            quote: String(q.quote || ""),
            sectionTitle: String(q.sectionTitle || ""),
            placement: String(q.placement || ""),
          }))
        : [],
      layoutPlan: Array.isArray(parsed.layoutPlan)
        ? parsed.layoutPlan.map((l: any) => ({
            kind: String(l.kind || ""),
            title: String(l.title || ""),
            placement: String(l.placement || ""),
            notes: String(l.notes || ""),
          }))
        : [],
      graphicsPlan: Array.isArray(parsed.graphicsPlan)
        ? parsed.graphicsPlan.map((g: any) => ({
            sectionTitle: String(g.sectionTitle || ""),
            assetType: String(g.assetType || ""),
            placement: String(g.placement || ""),
            brief: String(g.brief || ""),
          }))
        : [],
      dataVisuals: Array.isArray(parsed.dataVisuals)
        ? parsed.dataVisuals.map((v: any) => ({
            id: String(v.id || Math.random().toString(36).slice(2)),
            kind: v.kind || "table",
            title: String(v.title || ""),
            sectionTitle: String(v.sectionTitle || ""),
            placement: String(v.placement || "inline"),
            rationale: String(v.rationale || ""),
            sourceReference: String(v.sourceReference || ""),
            unit: v.unit ? String(v.unit) : undefined,
            icon: v.icon ? String(v.icon) : undefined,
            labels: Array.isArray(v.labels) ? v.labels.map(String) : undefined,
            values: Array.isArray(v.values) ? v.values.map(Number) : undefined,
            columns: Array.isArray(v.columns) ? v.columns.map(String) : undefined,
            rows: Array.isArray(v.rows) ? v.rows.map((r: any) => (Array.isArray(r) ? r.map(String) : [])) : undefined,
          }))
        : [],
      rendered,
      htmlRendered: sectionsToHtml(title, docType, audience, sections),
      wordCount,
      estimatedPages: Math.max(1, Math.round(wordCount / wordsPerPage)),
      targetPages,
    };
  } catch (err) {
    console.error("[Docgen] Generation failed:", err);
    return buildFallbackDocument(input);
  }
}

