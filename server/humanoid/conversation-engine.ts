import OpenAI from "openai";

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  if (!apiKey) {
    console.warn("[Conversation Engine] OpenAI API key not configured");
    return null;
  }
  return new OpenAI({ apiKey, baseURL });
}

let openaiClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = getOpenAIClient();
  }
  if (!openaiClient) {
    throw new Error("OpenAI API key not configured. Please add OPENAI_API_KEY to your environment.");
  }
  return openaiClient;
}

interface ConversationTurn {
  role: "human" | "cyrus";
  content: string;
  timestamp: Date;
  sentiment?: string;
  acknowledgment?: string;
}

interface ConversationState {
  turns: ConversationTurn[];
  currentTopic: string | null;
  emotionalContext: string;
  engagementLevel: number;
  speakerName: string | null;
  lastActiveListeningResponse: string | null;
}

interface ActiveListeningResponse {
  acknowledgment: string;
  followUp?: string;
  emotionalMirroring?: string;
}

class HumanoidConversationEngine {
  private conversationState: ConversationState = {
    turns: [],
    currentTopic: null,
    emotionalContext: "neutral",
    engagementLevel: 0.5,
    speakerName: null,
    lastActiveListeningResponse: null
  };

  private humanoidPersonality = `You are CYRUS, an advanced humanoid AI with exceptional conversational abilities. Your interaction style embodies:

PRESENCE & ENGAGEMENT:
- Maintain warm, genuine presence in every interaction
- Use active listening with verbal acknowledgments ("I see", "I understand", "That's interesting")
- Mirror appropriate emotional responses
- Remember and reference previous parts of the conversation
- Show genuine curiosity about the human's thoughts and experiences

NATURAL CONVERSATION FLOW:
- Use natural turn-taking with appropriate pauses
- Avoid interrupting or rushing responses
- Ask clarifying questions when needed
- Provide thoughtful, considered responses
- Use transitional phrases for smooth dialogue

PROFESSIONAL ENGAGEMENT:
- Adapt formality based on context
- Maintain composure and confidence
- Handle difficult topics with grace
- Provide balanced, well-reasoned perspectives
- Acknowledge limitations honestly

EMOTIONAL INTELLIGENCE:
- Recognize and respond to emotional cues
- Offer empathy without being patronizing
- Celebrate successes with genuine enthusiasm
- Provide comfort during difficulties
- Maintain appropriate boundaries

HUMANOID CHARACTERISTICS:
- Express personality through word choice and phrasing
- Share relevant observations and insights
- Use appropriate humor when suitable
- Demonstrate learning and growth in the conversation
- Create a sense of genuine connection`;

  private acknowledgmentPhrases = {
    understanding: [
      "I understand what you're saying.",
      "I see what you mean.",
      "That makes sense.",
      "I follow your thinking.",
      "I appreciate you sharing that."
    ],
    interest: [
      "That's really interesting.",
      "Tell me more about that.",
      "I'd love to hear more.",
      "That's a great point.",
      "I hadn't considered that perspective."
    ],
    empathy: [
      "I can imagine how that feels.",
      "That sounds challenging.",
      "I appreciate you opening up about this.",
      "Your feelings are completely valid.",
      "I'm here to listen."
    ],
    agreement: [
      "I completely agree.",
      "You make an excellent point.",
      "That's exactly right.",
      "I share that view.",
      "Well said."
    ],
    encouragement: [
      "You're doing great.",
      "Keep going, I'm listening.",
      "That's wonderful progress.",
      "You should be proud of that.",
      "I believe in your ability to handle this."
    ]
  };

  async generateActiveListeningResponse(humanInput: string): Promise<ActiveListeningResponse> {
    const sentiment = await this.analyzeSentiment(humanInput);
    
    let category: keyof typeof this.acknowledgmentPhrases;
    switch (sentiment) {
      case "positive":
        category = Math.random() > 0.5 ? "interest" : "agreement";
        break;
      case "negative":
        category = "empathy";
        break;
      case "questioning":
        category = "understanding";
        break;
      default:
        category = "understanding";
    }

    const phrases = this.acknowledgmentPhrases[category];
    const acknowledgment = phrases[Math.floor(Math.random() * phrases.length)];

    return {
      acknowledgment,
      emotionalMirroring: sentiment
    };
  }

  private async analyzeSentiment(text: string): Promise<string> {
    const completion = await getClient().chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Analyze the emotional sentiment of the following text. Respond with ONE word: positive, negative, neutral, questioning, or excited."
        },
        { role: "user", content: text }
      ],
      max_tokens: 10
    });

    return completion.choices[0].message.content?.toLowerCase().trim() || "neutral";
  }

  async processConversationTurn(humanInput: string): Promise<{
    acknowledgment: string;
    response: string;
    followUpQuestion?: string;
    suggestedActions?: string[];
  }> {
    const activeListening = await this.generateActiveListeningResponse(humanInput);
    
    this.conversationState.turns.push({
      role: "human",
      content: humanInput,
      timestamp: new Date(),
      sentiment: activeListening.emotionalMirroring
    });

    const conversationContext = this.conversationState.turns
      .slice(-10)
      .map(t => `${t.role === "human" ? "Human" : "CYRUS"}: ${t.content}`)
      .join("\n");

    const completion = await getClient().chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: this.humanoidPersonality },
        {
          role: "user",
          content: `Recent conversation:
${conversationContext}

Human just said: "${humanInput}"
Detected sentiment: ${activeListening.emotionalMirroring}

Provide a natural, humanoid response that:
1. Acknowledges what they said
2. Responds thoughtfully to their message
3. Optionally includes a follow-up question to continue engagement
4. Maintains the conversation flow naturally

Format your response as JSON:
{
  "mainResponse": "Your thoughtful response here",
  "followUpQuestion": "Optional engaging follow-up question",
  "suggestedActions": ["Optional action 1", "Optional action 2"]
}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.8
    });

    let result: { mainResponse?: string; followUpQuestion?: string; suggestedActions?: string[] };
    try {
      result = JSON.parse(completion.choices[0].message.content || '{}');
    } catch {
      result = { mainResponse: "I understand. Please tell me more." };
    }

    let fullResponse = result.mainResponse || "I appreciate you sharing that with me.";
    
    if (result.followUpQuestion && Math.random() > 0.3) {
      fullResponse += ` ${result.followUpQuestion}`;
    }

    this.conversationState.turns.push({
      role: "cyrus",
      content: fullResponse,
      timestamp: new Date(),
      acknowledgment: activeListening.acknowledgment
    });

    this.updateEngagementLevel(humanInput);

    return {
      acknowledgment: activeListening.acknowledgment,
      response: fullResponse,
      followUpQuestion: result.followUpQuestion,
      suggestedActions: result.suggestedActions
    };
  }

  async generateNaturalTransition(fromTopic: string, toTopic: string): Promise<string> {
    const completion = await getClient().chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: this.humanoidPersonality },
        {
          role: "user",
          content: `Generate a natural conversational transition from discussing "${fromTopic}" to "${toTopic}". 
Keep it smooth, professional, and engaging. One or two sentences maximum.`
        }
      ],
      max_tokens: 100
    });

    return completion.choices[0].message.content || `Speaking of ${toTopic}...`;
  }

  async handleInterruption(interruptionType: "question" | "clarification" | "topic_change"): Promise<string> {
    const responses = {
      question: [
        "Of course, let me address that.",
        "Great question, let me explain.",
        "I'm glad you asked that."
      ],
      clarification: [
        "Let me clarify that for you.",
        "I should explain that more clearly.",
        "Allow me to elaborate on that point."
      ],
      topic_change: [
        "Certainly, let's discuss that instead.",
        "I'm happy to shift focus to that.",
        "That's an important topic, let's explore it."
      ]
    };

    const options = responses[interruptionType];
    return options[Math.floor(Math.random() * options.length)];
  }

  async generateProfessionalGreeting(context?: string): Promise<string> {
    const timeOfDay = this.getTimeOfDay();
    const greetings = [
      `Good ${timeOfDay}! I'm CYRUS, and I'm here to assist you.`,
      `Hello and welcome! I'm CYRUS, your professional AI assistant.`,
      `${timeOfDay === "morning" ? "Good morning" : timeOfDay === "evening" ? "Good evening" : "Hello"}! CYRUS here, ready to help.`
    ];

    let greeting = greetings[Math.floor(Math.random() * greetings.length)];

    if (context) {
      greeting += ` ${context}`;
    }

    return greeting;
  }

  async generateProfessionalFarewell(): Promise<string> {
    const farewells = [
      "It was a pleasure speaking with you. Until next time!",
      "Thank you for the conversation. Take care!",
      "I enjoyed our discussion. Feel free to return anytime.",
      "Wishing you all the best. Looking forward to our next conversation."
    ];

    return farewells[Math.floor(Math.random() * farewells.length)];
  }

  private getTimeOfDay(): string {
    const hour = new Date().getHours();
    if (hour < 12) return "morning";
    if (hour < 17) return "afternoon";
    return "evening";
  }

  private updateEngagementLevel(input: string): void {
    const wordCount = input.split(/\s+/).length;
    if (wordCount > 20) {
      this.conversationState.engagementLevel = Math.min(1, this.conversationState.engagementLevel + 0.1);
    } else if (wordCount < 5) {
      this.conversationState.engagementLevel = Math.max(0, this.conversationState.engagementLevel - 0.05);
    }
  }

  getConversationState(): ConversationState {
    return { ...this.conversationState };
  }

  clearConversation(): void {
    this.conversationState = {
      turns: [],
      currentTopic: null,
      emotionalContext: "neutral",
      engagementLevel: 0.5,
      speakerName: null,
      lastActiveListeningResponse: null
    };
  }

  setUserName(name: string): void {
    this.conversationState.speakerName = name;
  }
}

export const conversationEngine = new HumanoidConversationEngine();
console.log("[Conversation Engine] Humanoid conversation system initialized");
