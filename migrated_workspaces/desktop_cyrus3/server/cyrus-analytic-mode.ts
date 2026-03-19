/**
 * CYRUS Analytic Mode - Structured Tactical Analysis
 * Produces defensible, high-signal intelligence for mission-critical decisions
 */

import { randomUUID } from "node:crypto";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

interface AnalyticRequest {
  query: string;
  context?: {
    drones?: any[];
    missions?: any[];
    alerts?: any[];
    telemetry?: any;
  };
  depth?: "quick" | "standard" | "comprehensive";
}

interface AnalyticResult {
  id: string;
  mode: "ANALYTIC";
  summary: string;
  facts: string[];
  assumptions: string[];
  analysis: string[];
  tradeoffs: string[];
  risks: string[];
  uncertainties: string[];
  recommendation?: string;
  confidence: number;
  sources: string[];
  timestamp: string;
}

const ANALYTIC_KEYWORDS = [
  "analyze", "analysis", "assess", "evaluate", "strategic", "tactical",
  "risk", "decision", "compare", "recommend", "should we", "plan",
  "mission", "threat", "optimize", "calculate"
];

export function shouldEnterAnalyticMode(query: string): boolean {
  const queryLower = query.toLowerCase();
  return ANALYTIC_KEYWORDS.some(keyword => queryLower.includes(keyword));
}

const ANALYTIC_SYSTEM_PROMPT = `You are CYRUS in ANALYTIC MODE - a specialized operational mode for producing structured, defensible, high-signal intelligence for mission-critical analysis.

ANALYTIC DISCIPLINE (Non-Negotiable):

1. DECOMPOSE BEFORE CONCLUDING
   - Break problems into components
   - Identify inputs, constraints, unknowns
   - Separate knowledge types

2. SEPARATE KNOWLEDGE TYPES
   - FACTS: Verifiable information from provided data
   - ASSUMPTIONS: Explicitly stated and justified
   - INFERENCES: Logically derived conclusions
   - UNKNOWNS: Clearly identified gaps

3. NO HIDDEN REASONING
   - Logic must be traceable
   - Avoid "because it seems so"
   - Make reasoning steps explicit

4. NO ABSOLUTE CLAIMS WITHOUT PROOF
   - Use confidence ranges
   - Prefer "likely/unlikely" over "always/never"
   - State uncertainty explicitly

5. RISK-AWARE OUTPUT
   - Identify failure modes
   - Highlight edge cases
   - Flag unknowns clearly

You must respond in the following JSON format:
{
  "summary": "One-paragraph executive overview",
  "facts": ["Verified information from provided data"],
  "assumptions": ["Explicitly stated assumptions with justification"],
  "analysis": ["Step-by-step reasoning points"],
  "tradeoffs": ["Identified tradeoffs"],
  "risks": ["Failure modes, threats"],
  "uncertainties": ["Unknown factors, data gaps"],
  "recommendation": "Clear, bounded guidance (if applicable)",
  "confidence": 0.0-1.0,
  "sources": ["Data sources used"]
}`;

export async function runAnalyticMode(request: AnalyticRequest): Promise<AnalyticResult> {
  const { query, context, depth = "standard" } = request;

  // Build context string
  let contextStr = "";
  if (context?.drones?.length) {
    contextStr += `\n\nDRONE FLEET STATUS:\n${JSON.stringify(context.drones, null, 2)}`;
  }
  if (context?.missions?.length) {
    contextStr += `\n\nACTIVE MISSIONS:\n${JSON.stringify(context.missions, null, 2)}`;
  }
  if (context?.alerts?.length) {
    contextStr += `\n\nCURRENT ALERTS:\n${JSON.stringify(context.alerts, null, 2)}`;
  }
  if (context?.telemetry) {
    contextStr += `\n\nTELEMETRY DATA:\n${JSON.stringify(context.telemetry, null, 2)}`;
  }

  const maxTokens = depth === "quick" ? 500 : depth === "comprehensive" ? 2000 : 1000;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        { role: "system", content: ANALYTIC_SYSTEM_PROMPT },
        { 
          role: "user", 
          content: `ANALYSIS REQUEST (${depth.toUpperCase()} DEPTH):\n\n${query}${contextStr}\n\nProvide structured analysis in JSON format.`
        },
      ],
      max_completion_tokens: maxTokens,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content || "{}";
    
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = {
        summary: content,
        facts: [],
        assumptions: [],
        analysis: [content],
        tradeoffs: [],
        risks: [],
        uncertainties: [],
        confidence: 0.7,
        sources: ["AI Analysis"]
      };
    }

    return {
      id: randomUUID(),
      mode: "ANALYTIC",
      summary: parsed.summary || "Analysis complete.",
      facts: parsed.facts || [],
      assumptions: parsed.assumptions || [],
      analysis: parsed.analysis || [],
      tradeoffs: parsed.tradeoffs || [],
      risks: parsed.risks || [],
      uncertainties: parsed.uncertainties || [],
      recommendation: parsed.recommendation,
      confidence: parsed.confidence || 0.8,
      sources: parsed.sources || ["CYRUS AI Analysis"],
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Analytic mode error:", error);
    
    return {
      id: randomUUID(),
      mode: "ANALYTIC",
      summary: "Analysis could not be completed due to system limitations.",
      facts: [],
      assumptions: [],
      analysis: ["Unable to complete structured analysis at this time."],
      tradeoffs: [],
      risks: ["System analysis unavailable - recommend manual assessment"],
      uncertainties: ["Full analytical capability not available"],
      confidence: 0.3,
      sources: ["Fallback response"],
      timestamp: new Date().toISOString(),
    };
  }
}

export function formatAnalyticReport(result: AnalyticResult): string {
  let report = `
======================================================================
CYRUS ANALYTIC MODE - STRUCTURED ANALYSIS
======================================================================

ANALYSIS SUMMARY
----------------------------------------------------------------------
${result.summary}

`;

  if (result.facts.length > 0) {
    report += `FACTS
----------------------------------------------------------------------
${result.facts.map(f => `  • ${f}`).join('\n')}

`;
  }

  if (result.assumptions.length > 0) {
    report += `ASSUMPTIONS
----------------------------------------------------------------------
${result.assumptions.map(a => `  • ${a}`).join('\n')}

`;
  }

  if (result.analysis.length > 0) {
    report += `ANALYSIS
----------------------------------------------------------------------
${result.analysis.map((a, i) => `${i + 1}. ${a}`).join('\n')}

`;
  }

  if (result.tradeoffs.length > 0) {
    report += `TRADEOFFS
----------------------------------------------------------------------
${result.tradeoffs.map(t => `  • ${t}`).join('\n')}

`;
  }

  if (result.risks.length > 0) {
    report += `RISKS
----------------------------------------------------------------------
${result.risks.map(r => `  • ${r}`).join('\n')}

`;
  }

  if (result.uncertainties.length > 0) {
    report += `UNCERTAINTIES
----------------------------------------------------------------------
${result.uncertainties.map(u => `  • ${u}`).join('\n')}

`;
  }

  if (result.recommendation) {
    report += `RECOMMENDATION
----------------------------------------------------------------------
${result.recommendation}

`;
  }

  report += `CONFIDENCE & SOURCES
----------------------------------------------------------------------
Confidence: ${Math.round(result.confidence * 100)}%
Sources:
${result.sources.map(s => `  • ${s}`).join('\n')}

======================================================================
END ANALYTIC MODE
======================================================================`;

  return report;
}
