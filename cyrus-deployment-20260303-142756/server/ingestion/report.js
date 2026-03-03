export function buildReport(det, ext, analysis, success) {
    return {
        success,
        title: "File Analysis Report",
        docType: det.detectedMime || det.declaredMime || "unknown",
        sourceDescription: `Size: ${det.size} bytes; Declared: ${det.declaredMime || "-"}; Detected: ${det.detectedMime || "-"}; Hash: ${det.sha256}`,
        extractedSummary: analysis.summary,
        transcript: ext.transcript,
        ocrText: ext.ocrText,
        keyFindings: analysis.findings,
        issues: analysis.issues,
        interpretation: analysis.interpretation,
        recommendations: analysis.recommendations,
        confidence: analysis.confidence,
        attempted: ext.attempted,
        warnings: ext.warnings,
    };
}
