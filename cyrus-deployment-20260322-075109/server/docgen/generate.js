import { templates, defaultDocType } from "./templates";
import { analyzeDocument } from "./analyze";
function renderMarkdown(doc) {
    const lines = [];
    lines.push(`# ${doc.docType.toUpperCase()}`);
    for (const sec of doc.sections) {
        lines.push(`## ${sec.title}`);
        lines.push(sec.content || "_Not provided_");
        lines.push("");
    }
    lines.push(`Confidence: ${doc.confidence}`);
    if (doc.assumptions.length)
        lines.push(`Assumptions: ${doc.assumptions.join("; ")}`);
    if (doc.missing.length)
        lines.push(`Missing: ${doc.missing.join("; ")}`);
    return lines.join("\n");
}
export async function generateDocument(input) {
    const docType = input.docType || defaultDocType;
    const audience = input.audience || "official";
    const analysis = await analyzeDocument(input);
    // Merge analysis sections with template to ensure all titles present
    const template = templates[docType] || templates[defaultDocType];
    const mergedSections = template.map((t) => {
        const found = analysis.sections.find((s) => s.title.toLowerCase() === t.title.toLowerCase());
        return { title: t.title, content: found?.content || "" };
    });
    const missing = [
        ...analysis.missing,
        ...template
            .filter((t) => t.required && !mergedSections.find((m) => m.title === t.title || (m.title.toLowerCase() === t.title.toLowerCase() && m.content.trim().length > 0)))
            .map((t) => t.title),
    ];
    const doc = {
        docType,
        audience,
        confidence: analysis.confidence,
        assumptions: analysis.assumptions || [],
        missing,
        sections: mergedSections,
        rendered: "",
    };
    doc.rendered = renderMarkdown(doc);
    return doc;
}
