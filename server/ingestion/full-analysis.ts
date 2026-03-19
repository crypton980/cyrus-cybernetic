import { detectFile } from "./detect";
import { extractFile } from "./extract";
import { analyzeExtraction, type AnalysisCitation, type AnalysisOptions } from "./analyze";

export interface FullAnalysisResponse {
  detection: Awaited<ReturnType<typeof detectFile>>;
  extraction: {
    text: string;
    metadata: {
      attempted: string[];
      warnings: string[];
      pageCount?: number;
      textLength?: number;
      transcript?: string;
      ocrText?: string;
      frames?: Array<{ index: number; ocrText?: string; visionNotes?: string }>;
      visionNotes?: string;
    };
    error?: string;
  };
  analysis: {
    summary: string;
    keyFindings: string[];
    issues: string[];
    interpretation: string;
    confidence: "High" | "Medium" | "Low";
    documentType: string;
    documentTypeConfidence: "High" | "Medium" | "Low";
    decisionActions: Array<{
      action: string;
      owner: string;
      deadline: string;
      obligation: string;
    }>;
    executiveBrief: string;
    knowledgeApplied: string[];
    capabilitySummary: string;
    jurisdictionApplied: string;
    strictLegalReview: boolean;
    citationAnchors: AnalysisCitation[];
    chunksAnalyzed?: number;
    entities: Array<{ type: string; value: string }>;
    riskLevel: "low" | "medium" | "high";
    recommendations: string[];
  };
  generatedAt: string;
}

export async function performFullAnalysis(
  buffer: Buffer,
  mimetype?: string,
  options: AnalysisOptions = {},
): Promise<FullAnalysisResponse> {
  const det = await detectFile(buffer, mimetype);
  const ext = await extractFile(buffer, mimetype);
  const analysis = await analyzeExtraction(ext, options);
  const hasContent = !!(ext.text || ext.ocrText || ext.transcript || (ext.frames && ext.frames.some((f) => f.ocrText)));

  const riskLevel: "low" | "medium" | "high" =
    analysis.confidence === "Low" ? "high" : analysis.confidence === "Medium" ? "medium" : "low";

  return {
    detection: det,
    extraction: {
      text: ext.text || ext.ocrText || ext.transcript || "",
      metadata: {
        attempted: ext.attempted,
        warnings: ext.warnings,
        pageCount: ext.pageCount,
        textLength: ext.textLength,
        transcript: ext.transcript,
        ocrText: ext.ocrText,
        frames: ext.frames,
        visionNotes: ext.visionNotes,
      },
      error: hasContent ? undefined : "No extractable content found",
    },
    analysis: {
      summary: analysis.summary,
      keyFindings: analysis.findings,
      issues: analysis.issues,
      interpretation: analysis.interpretation,
      confidence: analysis.confidence,
      documentType: analysis.documentType,
      documentTypeConfidence: analysis.documentTypeConfidence,
      decisionActions: analysis.decisionActions,
      executiveBrief: analysis.executiveBrief,
      knowledgeApplied: analysis.knowledgeApplied,
      capabilitySummary: analysis.capabilitySummary,
      jurisdictionApplied: analysis.jurisdictionApplied,
      strictLegalReview: analysis.strictLegalReview,
      citationAnchors: analysis.citationAnchors,
      chunksAnalyzed: analysis.chunksAnalyzed,
      entities: [],
      riskLevel,
      recommendations: analysis.recommendations,
    },
    generatedAt: new Date().toISOString(),
  };
}