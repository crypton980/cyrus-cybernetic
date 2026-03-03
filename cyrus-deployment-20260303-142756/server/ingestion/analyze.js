import OpenAI from "openai";
const openaiApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const openaiBaseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const openaiClient = openaiApiKey && openaiBaseUrl
    ? new OpenAI({ apiKey: openaiApiKey, baseURL: openaiBaseUrl })
    : null;
export async function analyzeExtraction(ext) {
    const contentPieces = [
        ext.text || "",
        ext.ocrText || "",
        ext.transcript || "",
        ...(ext.frames?.map((f) => f.ocrText || "").filter(Boolean) || []),
    ].filter(Boolean);
    const aggregateText = contentPieces.join("\n").slice(0, 8000); // cap to avoid long prompts
    if (!openaiClient) {
        return {
            summary: aggregateText ? aggregateText.slice(0, 300) : "No extracted text",
            findings: [],
            issues: ["LLM analysis unavailable (no OpenAI config)."],
            interpretation: "Minimal analysis due to missing LLM configuration.",
            recommendations: ["Configure OpenAI credentials for full analysis."],
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
    }
    catch (err) {
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
function parseLLMReport(text) {
    // Very light parser: split by lines; not strict.
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const findings = [];
    const issues = [];
    const recommendations = [];
    let summary = "";
    let interpretation = "";
    let confidence = "Medium";
    for (const line of lines) {
        const lower = line.toLowerCase();
        if (!summary && lower.startsWith("summary")) {
            summary = line.replace(/summary[:\-]\s*/i, "");
            continue;
        }
        if (lower.startsWith("-") || lower.startsWith("•")) {
            if (lower.includes("issue") || lower.includes("gap"))
                issues.push(line.replace(/^[-•]\s*/, ""));
            else if (lower.includes("recommend"))
                recommendations.push(line.replace(/^[-•]\s*/, ""));
            else
                findings.push(line.replace(/^[-•]\s*/, ""));
            continue;
        }
        if (lower.includes("confidence")) {
            if (lower.includes("high"))
                confidence = "High";
            else if (lower.includes("low"))
                confidence = "Low";
            else
                confidence = "Medium";
            continue;
        }
        if (lower.startsWith("interpretation")) {
            interpretation = line.replace(/interpretation[:\-]\s*/i, "");
            continue;
        }
        if (!summary)
            summary = line;
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
