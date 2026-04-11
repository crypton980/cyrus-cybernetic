import OpenAI from "openai";
import { templates, toneByAudience, defaultDocType } from "./templates";
const openaiApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const openaiBaseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const llmClient = openaiApiKey && openaiBaseUrl
    ? new OpenAI({ apiKey: openaiApiKey, baseURL: openaiBaseUrl })
    : null;
function fallbackContent(template, payload) {
    const secs = templates[template] || templates[defaultDocType];
    const baseContent = payload.rawText ||
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
export async function analyzeDocument(payload) {
    const docType = payload.docType || defaultDocType;
    const template = templates[docType] || templates[defaultDocType];
    if (!llmClient)
        return fallbackContent(docType, payload);
    const tone = toneByAudience[payload.audience || "official"] || toneByAudience.official;
    const sectionTitles = template.map((s) => s.title);
    const systemPrompt = `
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
        rawText: payload.rawText,
        data: payload.data,
        sections: sectionTitles,
    };
    try {
        const resp = await llmClient.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: JSON.stringify(userContent) },
            ],
            response_format: { type: "json_object" },
            max_tokens: 900,
        });
        const parsed = JSON.parse(resp.choices[0].message.content || "{}");
        const sections = Array.isArray(parsed.sections)
            ? parsed.sections
            : template.map((t) => ({ title: t.title, content: "" }));
        const confidence = parsed.confidence === "High" || parsed.confidence === "Low" ? parsed.confidence : "Medium";
        const assumptions = Array.isArray(parsed.assumptions) ? parsed.assumptions : [];
        const missing = Array.isArray(parsed.missing) ? parsed.missing : [];
        return { sections, confidence, assumptions, missing };
    }
    catch (err) {
        return fallbackContent(docType, payload);
    }
}
