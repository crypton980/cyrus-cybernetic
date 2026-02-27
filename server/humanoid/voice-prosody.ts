interface ProsodySettings {
  emotion: string;
  speed: number;
  intensity: number;
  includeBreaths: boolean;
  includeHesitations: boolean;
  includeBackchanneling: boolean;
}

interface ProsodyResult {
  enhancedText: string;
  voiceSettings: {
    stability: number;
    similarity_boost: number;
    style: number;
    use_speaker_boost: boolean;
  };
  suggestedPauses: number[];
  naturalDelay: number;
}

const EMOTION_VOICE_PROFILES: Record<string, { stability: number; similarity_boost: number; style: number }> = {
  neutral:    { stability: 0.65, similarity_boost: 0.85, style: 0.0 },
  happy:      { stability: 0.55, similarity_boost: 0.90, style: 0.8 },
  excited:    { stability: 0.45, similarity_boost: 0.90, style: 1.0 },
  sad:        { stability: 0.80, similarity_boost: 0.80, style: 0.3 },
  angry:      { stability: 0.70, similarity_boost: 0.85, style: 0.6 },
  calm:       { stability: 0.85, similarity_boost: 0.80, style: 0.2 },
  confident:  { stability: 0.60, similarity_boost: 0.90, style: 0.7 },
  uncertain:  { stability: 0.75, similarity_boost: 0.75, style: 0.2 },
  empathetic: { stability: 0.70, similarity_boost: 0.85, style: 0.4 },
  curious:    { stability: 0.55, similarity_boost: 0.85, style: 0.5 },
  thoughtful: { stability: 0.75, similarity_boost: 0.85, style: 0.3 },
};

const THINKING_FILLERS = [
  "Hmm...",
  "Well...",
  "Let me think...",
  "Interesting...",
  "You know...",
  "So...",
  "Actually...",
  "I mean...",
];

const ACKNOWLEDGMENT_SOUNDS = [
  "Mmhmm.",
  "Yeah.",
  "I see.",
  "Right.",
  "Okay.",
  "Sure.",
  "Absolutely.",
  "Of course.",
];

const EMPATHETIC_INTERJECTIONS: Record<string, string[]> = {
  sad: ["I hear you.", "That must be tough.", "I understand."],
  happy: ["That's wonderful!", "I love hearing that!", "How fantastic!"],
  angry: ["I get it.", "That's frustrating.", "I understand your concern."],
  confused: ["Let me help clarify.", "I see what you mean.", "Good question."],
  excited: ["That's amazing!", "How exciting!", "Incredible!"],
};

class VoiceProsodyEngine {
  addNaturalProsody(text: string, settings: Partial<ProsodySettings> = {}): ProsodyResult {
    const {
      emotion = 'neutral',
      speed = 1.0,
      intensity = 0.5,
      includeBreaths = true,
      includeHesitations = true,
      includeBackchanneling = false,
    } = settings;

    let enhanced = text;

    if (includeHesitations && text.length > 50) {
      enhanced = this.insertThinkingPauses(enhanced, intensity);
    }

    enhanced = this.addEmotionalProsodyMarkers(enhanced, emotion, intensity);

    if (includeBreaths && text.length > 100) {
      enhanced = this.insertBreathMarkers(enhanced);
    }

    enhanced = this.adjustPaceForContent(enhanced);

    const voiceProfile = EMOTION_VOICE_PROFILES[emotion] || EMOTION_VOICE_PROFILES.neutral;
    const voiceSettings = {
      stability: voiceProfile.stability,
      similarity_boost: voiceProfile.similarity_boost,
      style: voiceProfile.style * intensity,
      use_speaker_boost: true,
    };

    const naturalDelay = this.calculateNaturalResponseDelay(text, emotion);

    const suggestedPauses = this.identifyPausePoints(enhanced);

    return {
      enhancedText: enhanced,
      voiceSettings,
      suggestedPauses,
      naturalDelay,
    };
  }

  private insertThinkingPauses(text: string, intensity: number): string {
    const sentences = text.split(/(?<=[.!?])\s+/);
    if (sentences.length <= 1) return text;

    const result: string[] = [];
    for (let i = 0; i < sentences.length; i++) {
      if (i > 0 && i < sentences.length - 1 && Math.random() < intensity * 0.3) {
        const filler = THINKING_FILLERS[Math.floor(Math.random() * THINKING_FILLERS.length)];
        result.push(filler);
      }
      result.push(sentences[i]);
    }
    return result.join(' ');
  }

  private addEmotionalProsodyMarkers(text: string, emotion: string, intensity: number): string {
    if (intensity < 0.3) return text;

    const sentences = text.split(/(?<=[.!?])\s+/);
    if (sentences.length === 0) return text;

    if (emotion === 'excited' || emotion === 'happy') {
      sentences[sentences.length - 1] = sentences[sentences.length - 1]
        .replace(/\.$/, '!')
        .replace(/,\s*$/, '!');
    }

    if (emotion === 'uncertain' || emotion === 'confused') {
      if (!sentences[sentences.length - 1].endsWith('?')) {
        const lastSentence = sentences[sentences.length - 1];
        if (lastSentence.length < 60 && Math.random() < 0.3) {
          sentences[sentences.length - 1] = lastSentence.replace(/[.!]$/, '...');
        }
      }
    }

    return sentences.join(' ');
  }

  private insertBreathMarkers(text: string): string {
    const sentences = text.split(/(?<=[.!?])\s+/);
    const result: string[] = [];

    for (let i = 0; i < sentences.length; i++) {
      result.push(sentences[i]);
      if (i > 0 && (i + 1) % 3 === 0 && i < sentences.length - 1) {
        result.push('');
      }
    }

    return result.join(' ');
  }

  private adjustPaceForContent(text: string): string {
    return text
      .replace(/(\d+\.?\d*)\s*(percent|%)/gi, '$1 percent')
      .replace(/(\d{4,})/g, (match) => {
        return match.split('').join(' ');
      });
  }

  private calculateNaturalResponseDelay(userInput: string, emotion: string): number {
    const wordCount = userInput.split(/\s+/).length;
    let baseDelay = 400 + wordCount * 30;

    const emotionDelays: Record<string, number> = {
      thoughtful: 800,
      sad: 600,
      uncertain: 700,
      calm: 500,
      empathetic: 600,
      neutral: 300,
      happy: 200,
      excited: 100,
      angry: 150,
      confident: 200,
    };

    baseDelay += emotionDelays[emotion] || 300;

    baseDelay += (Math.random() - 0.5) * 200;

    return Math.max(200, Math.min(2000, baseDelay));
  }

  private identifyPausePoints(text: string): number[] {
    const pausePoints: number[] = [];
    let pos = 0;

    for (const char of text) {
      pos++;
      if (char === '.' || char === '!' || char === '?') {
        pausePoints.push(pos);
      } else if (char === ',') {
        pausePoints.push(pos);
      }
    }

    return pausePoints;
  }

  generateBackchannel(userEmotion: string): string {
    if (userEmotion in EMPATHETIC_INTERJECTIONS) {
      const options = EMPATHETIC_INTERJECTIONS[userEmotion];
      return options[Math.floor(Math.random() * options.length)];
    }
    return ACKNOWLEDGMENT_SOUNDS[Math.floor(Math.random() * ACKNOWLEDGMENT_SOUNDS.length)];
  }

  getEmotionFromSentiment(sentimentScore: number, confidence: number): string {
    if (confidence < 0.3) return 'neutral';
    if (sentimentScore > 0.6) return 'happy';
    if (sentimentScore > 0.3) return 'confident';
    if (sentimentScore > 0) return 'calm';
    if (sentimentScore > -0.3) return 'thoughtful';
    if (sentimentScore > -0.6) return 'empathetic';
    return 'sad';
  }

  deriveAIEmotion(userEmotion: string): string {
    const empathyMap: Record<string, string> = {
      happy: 'happy',
      excited: 'excited',
      sad: 'empathetic',
      angry: 'calm',
      confused: 'confident',
      neutral: 'neutral',
      calm: 'calm',
      uncertain: 'confident',
      curious: 'curious',
      thoughtful: 'thoughtful',
    };

    return empathyMap[userEmotion] || 'neutral';
  }

  addHumanLikeQualities(text: string, personality: 'professional' | 'casual' | 'warm' = 'professional'): string {
    let result = text;

    if (personality === 'casual') {
      result = result
        .replace(/\bI am\b/g, () => Math.random() > 0.5 ? "I'm" : "I am")
        .replace(/\bdo not\b/g, () => Math.random() > 0.5 ? "don't" : "do not")
        .replace(/\bcan not\b/g, () => Math.random() > 0.5 ? "can't" : "cannot")
        .replace(/\bwill not\b/g, () => Math.random() > 0.5 ? "won't" : "will not");
    }

    if (personality === 'warm') {
      const warmOpeners = ["You know, ", "I think ", "Honestly, ", "I feel like "];
      if (Math.random() > 0.7 && !result.startsWith("I ")) {
        const opener = warmOpeners[Math.floor(Math.random() * warmOpeners.length)];
        result = opener + result.charAt(0).toLowerCase() + result.slice(1);
      }
    }

    return result;
  }
}

export const voiceProsody = new VoiceProsodyEngine();
console.log("[Voice Prosody] Natural speech prosody engine initialized");
console.log("[Voice Prosody] Emotion profiles: " + Object.keys(EMOTION_VOICE_PROFILES).length + " modes");
