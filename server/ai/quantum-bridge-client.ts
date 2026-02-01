/**
 * Quantum AI Bridge Client
 * Communicates with the Python Quantum AI Core to enhance CYRUS intelligence
 */

interface EnhancementResult {
  quantum_enhanced: boolean;
  processing_timestamp: string;
  original_query: string;
  query_classification: string;
  enhancements: {
    writing_style?: {
      input_style_analysis: {
        dominant_style: string;
        style_scores: Record<string, number>;
        confidence: number;
      };
      recommended_response_style: string;
      style_guidelines: {
        tone: string;
        vocabulary: string;
        sentence_structure: string;
        pronouns: string;
        contractions: string;
        examples: string[];
      };
    };
    response_structure?: {
      sections: string[];
      include_metrics: boolean;
      include_visualization: boolean;
    };
    confidence_metrics?: {
      query_clarity: number;
      query_specificity: number;
      response_confidence: number;
      recommendation: string;
    };
    analytical_framework?: {
      approach: string;
      steps: string[];
      output_format: string;
    };
    mathematical_context?: {
      notation_style: string;
      include_derivations: boolean;
      include_proofs: boolean;
      decimal_precision: number;
      scientific_notation: boolean;
    };
  };
  processing_time_seconds: number;
}

interface StyleAnalysis {
  style_scores: Record<string, number>;
  dominant_style: string;
  confidence: number;
  mechanics: Record<string, any>;
  grammar_patterns: Record<string, any>;
  sentence_structure: Record<string, any>;
  text_length: number;
  word_count: number;
}

interface AdaptedStyle {
  adapted_text: string;
  target_style: string;
}

const QUANTUM_BRIDGE_URL = 'http://127.0.0.1:5001';

class QuantumBridgeClient {
  private baseUrl: string;
  private isAvailable: boolean = false;
  private lastHealthCheck: number = 0;
  private healthCheckInterval: number = 30000;

  constructor(baseUrl: string = QUANTUM_BRIDGE_URL) {
    this.baseUrl = baseUrl;
  }

  async checkHealth(): Promise<boolean> {
    const now = Date.now();
    if (now - this.lastHealthCheck < this.healthCheckInterval && this.isAvailable) {
      return this.isAvailable;
    }

    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000)
      });
      this.isAvailable = response.ok;
      this.lastHealthCheck = now;
      return this.isAvailable;
    } catch (error) {
      this.isAvailable = false;
      this.lastHealthCheck = now;
      return false;
    }
  }

  async enhanceResponse(message: string, context?: Record<string, any>): Promise<EnhancementResult | null> {
    const isHealthy = await this.checkHealth();
    if (!isHealthy) {
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/enhance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, context }),
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        console.error('[Quantum Bridge] Enhancement failed:', response.status);
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('[Quantum Bridge] Enhancement error:', error);
      return null;
    }
  }

  async adaptStyle(text: string, targetStyle: string): Promise<AdaptedStyle | null> {
    const isHealthy = await this.checkHealth();
    if (!isHealthy) {
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/adapt-style`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, style: targetStyle }),
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('[Quantum Bridge] Style adaptation error:', error);
      return null;
    }
  }

  async analyzeStyle(text: string): Promise<StyleAnalysis | null> {
    const isHealthy = await this.checkHealth();
    if (!isHealthy) {
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/analyze-style`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('[Quantum Bridge] Style analysis error:', error);
      return null;
    }
  }

  buildSystemPromptEnhancement(enhancement: EnhancementResult): string {
    const parts: string[] = [];
    
    parts.push(`\n\n[QUANTUM INTELLIGENCE ENHANCEMENT - Active]`);
    parts.push(`Query Classification: ${enhancement.query_classification.toUpperCase()}`);
    
    if (enhancement.enhancements.writing_style) {
      const style = enhancement.enhancements.writing_style;
      parts.push(`\nRECOMMENDED WRITING STYLE: ${style.recommended_response_style.toUpperCase()}`);
      parts.push(`- Tone: ${style.style_guidelines.tone}`);
      parts.push(`- Vocabulary: ${style.style_guidelines.vocabulary}`);
      parts.push(`- Sentence Structure: ${style.style_guidelines.sentence_structure}`);
      parts.push(`- Contractions: ${style.style_guidelines.contractions}`);
    }
    
    if (enhancement.enhancements.response_structure) {
      const struct = enhancement.enhancements.response_structure;
      parts.push(`\nRESPONSE STRUCTURE:`);
      parts.push(`- Sections: ${struct.sections.join(' → ')}`);
      if (struct.include_metrics) parts.push(`- Include quantitative metrics where applicable`);
    }
    
    if (enhancement.enhancements.analytical_framework) {
      const framework = enhancement.enhancements.analytical_framework;
      parts.push(`\nANALYTICAL APPROACH: ${framework.approach}`);
      parts.push(`Steps: ${framework.steps.join(' → ')}`);
    }
    
    if (enhancement.enhancements.confidence_metrics) {
      const conf = enhancement.enhancements.confidence_metrics;
      if (conf.recommendation === 'high_detail') {
        parts.push(`\nDETAIL LEVEL: HIGH - User expects comprehensive, detailed response`);
      }
    }
    
    // Add instruction for structured output
    parts.push(`\nCRITICAL: You MUST use the following structure for your response. Do not include any other text outside these sections except your final natural response:
1. ◈ QUANTUM ANALYSIS START ◈
2. Engineering/Science Processing Pathway: (List specific algorithms used from your core: High-Dimensional, SVD, Random Walk, ML, etc.)
3. Technical Results & Metrics: (Include mathematical formulations and data points)
4. Core Interpretation: (Technical summary of the findings)
5. ◈ QUANTUM ANALYSIS END ◈
6. Natural conversational response following your personality guidelines (sweet, feminine, Botswana heritage).`);

    return parts.join('\n');
  }

  // Note: The main inference call happens in server/routes.ts or similar, 
  // utilizing the prompt from buildSystemPromptEnhancement.


  getStatus(): { available: boolean; lastCheck: number } {
    return {
      available: this.isAvailable,
      lastCheck: this.lastHealthCheck
    };
  }
}

export const quantumBridge = new QuantumBridgeClient();
export type { EnhancementResult, StyleAnalysis, AdaptedStyle };
