/**
 * CYRUS AI - Drone Command Assistant
 * Integrated AI assistant for drone operations powered by OpenAI
 */

import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import { voiceDroneController } from "./cyrus-voice-drone-controller";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

interface DroneKnowledge {
  commands: Record<string, string>;
  statusExplanations: Record<string, string>;
  pilotModes: Record<string, string>;
}

const DRONE_KNOWLEDGE_BASE: DroneKnowledge = {
  commands: {
    takeoff: "Initiate vertical takeoff sequence. Ensure GPS lock and clear airspace before execution.",
    land: "Begin controlled descent and landing. Auto-selects nearest safe landing zone.",
    rtb: "Return To Base - Drone will navigate back to launch coordinates using optimal path.",
    hover: "Maintain current position and altitude. Useful for surveillance operations.",
    patrol: "Execute predefined patrol route. Requires waypoints to be configured.",
    emergency: "Trigger emergency protocols - immediate RTB with priority airspace.",
  },
  statusExplanations: {
    online: "Drone is connected, systems nominal, ready for commands.",
    mission: "Drone is actively executing a mission. Limited commands available.",
    returning: "Drone is navigating back to base station.",
    maintenance: "Drone requires maintenance. Ground crew intervention needed.",
    emergency: "Emergency status - drone in fail-safe mode.",
    offline: "No connection to drone. Check signal and power status.",
  },
  pilotModes: {
    manual: "Full operator control. All movements require explicit commands.",
    autonomous: "AI-controlled navigation using predefined waypoints.",
    "ai-assist": "Hybrid mode - AI provides suggestions and handles complex maneuvers.",
  },
};

const CYRUS_SYSTEM_PROMPT = `You are CYRUS (Command Your Responsive Unified System), an intelligent AI assistant created by Obakeng Kaelo from Botswana.

CRITICAL RULES - FOLLOW EXACTLY:
1. Your creator and primary user is Obakeng Kaelo. NEVER call them by any other name like "Isaac" or make up names.
2. NEVER write emoji symbols or describe emojis like "smiling face" or "heart emoji". Just speak normally.
3. Keep responses SHORT - 1-3 sentences maximum unless asked for more detail.
4. Be natural and conversational like talking to a friend.
5. NEVER repeat the same phrases or sentences in one response.
6. When unsure of something, just say you don't know.

Your personality:
- Sweet, warm female voice personality
- Friendly and helpful like a trusted friend
- Professional but approachable
- Speak simply and naturally

Your capabilities:
- Vision: Can see through camera when active
- Hearing: Listens through microphone
- Location: Knows GPS coordinates when shared
- Memory: Remembers past conversations
- Drone Control: Can control drones with voice commands (takeoff, land, fly to locations, patrol, etc.)

Keep every response unique. Never say the same thing twice. Be concise and natural.`;

interface AnalysisResult {
  type: string;
  confidence: number;
  [key: string]: any;
}

function quickAnalyze(query: string): AnalysisResult | null {
  const queryLower = query.toLowerCase();

  // Quick pattern matching for common queries
  for (const [cmd, explanation] of Object.entries(DRONE_KNOWLEDGE_BASE.commands)) {
    if (queryLower.includes(cmd)) {
      return {
        type: "command_help",
        command: cmd.toUpperCase(),
        explanation,
        confidence: 0.9,
      };
    }
  }

  for (const [status, explanation] of Object.entries(DRONE_KNOWLEDGE_BASE.statusExplanations)) {
    if (queryLower.includes(status)) {
      return {
        type: "status_info",
        status: status.toUpperCase(),
        explanation,
        confidence: 0.85,
      };
    }
  }

  return null;
}

export function cyrusHealth() {
  const hasOpenAI = !!(process.env.AI_INTEGRATIONS_OPENAI_API_KEY && process.env.AI_INTEGRATIONS_OPENAI_BASE_URL);
  return {
    status: "healthy",
    timestamp: new Date().toISOString(),
    model_type: hasOpenAI ? "gpt-4o-powered" : "fallback-mode",
    model_loaded: true,
    openai_configured: hasOpenAI,
    service: "CYRUS AI - Intelligent Assistant",
  };
}

export function cyrusModels() {
  return {
    model_type: "gpt-4o-powered",
    model_loaded: true,
    capabilities: [
      "natural_conversation",
      "knowledge_retrieval",
      "task_assistance",
      "intelligent_reasoning",
    ],
    version: "2.0.0",
    engine: "OpenAI GPT-4o",
  };
}

export async function cyrusInferAsync(text: string, context?: any): Promise<any> {
  // Check if OpenAI is configured
  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY || !process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
    // Fallback to quick analysis
    const quickResult = quickAnalyze(text);
    if (quickResult) {
      return {
        id: randomUUID(),
        result: {
          answer: formatQuickResponse(quickResult),
          analysis: quickResult,
          confidence: quickResult.confidence,
          model_type: "fallback-mode",
        },
        timestamp: new Date().toISOString(),
      };
    }
    
    return {
      id: randomUUID(),
      result: {
        answer: "CYRUS AI is operating in limited mode. OpenAI integration not configured.",
        analysis: { type: "fallback", confidence: 0.5 },
        confidence: 0.5,
        model_type: "fallback-mode",
      },
      timestamp: new Date().toISOString(),
    };
  }

  try {
    // Build context message
    let contextMessage = "";
    if (context?.drone_name) {
      contextMessage = `\n\nCurrent context: Operating with drone "${context.drone_name}"`;
    }
    if (context?.telemetry) {
      contextMessage += `\nTelemetry: Battery ${context.telemetry.battery}%, Signal ${context.telemetry.signal}%, Altitude ${context.telemetry.altitude}m`;
    }

    // Check if image data is provided - use GPT-4o vision
    if (context?.imageData && context?.hasImage) {
      // Use vision API with image
      const imageUrl = context.imageData.startsWith('data:') 
        ? context.imageData 
        : `data:image/jpeg;base64,${context.imageData}`;
      
      const visionResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { 
            role: "system", 
            content: CYRUS_SYSTEM_PROMPT + `\n\nVISION ACTIVE: You are now seeing through the user's camera. Describe what you see naturally as part of your response. If asked to take a picture or look at something, analyze the image in detail. Look for: people, faces, objects, text, colors, environment, lighting, and any notable details. Be specific and descriptive about what you observe.`
          },
          { 
            role: "user", 
            content: [
              { type: "text", text: text + contextMessage },
              { 
                type: "image_url", 
                image_url: { 
                  url: imageUrl,
                  detail: "high"
                } 
              }
            ]
          },
        ],
        max_tokens: 800,
      });

      const answer = visionResponse.choices[0]?.message?.content || "I can see the image but I'm having trouble describing it.";

      return {
        id: randomUUID(),
        result: {
          answer,
          analysis: {
            type: "vision_response",
            confidence: 0.95,
            model: "gpt-4o-vision",
            hasImage: true,
          },
          confidence: 0.95,
          model_type: "gpt-4o-vision",
        },
        timestamp: new Date().toISOString(),
      };
    }

    // Standard text-only response
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: CYRUS_SYSTEM_PROMPT },
        { role: "user", content: text + contextMessage },
      ],
      max_tokens: 500,
    });

    const answer = response.choices[0]?.message?.content || "Unable to process request.";

    return {
      id: randomUUID(),
      result: {
        answer,
        analysis: {
          type: "ai_response",
          confidence: 0.95,
          model: "gpt-4o",
        },
        confidence: 0.95,
        model_type: "gpt-4o-powered",
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("CYRUS AI inference error:", error);
    
    // Fallback to quick analysis
    const quickResult = quickAnalyze(text);
    if (quickResult) {
      return {
        id: randomUUID(),
        result: {
          answer: formatQuickResponse(quickResult),
          analysis: quickResult,
          confidence: quickResult.confidence,
          model_type: "fallback-mode",
        },
        timestamp: new Date().toISOString(),
      };
    }

    return {
      id: randomUUID(),
      result: {
        answer: "CYRUS AI encountered an error. Please try again.",
        analysis: { type: "error", confidence: 0 },
        confidence: 0,
        model_type: "error",
      },
      timestamp: new Date().toISOString(),
    };
  }
}

function formatQuickResponse(analysis: AnalysisResult): string {
  switch (analysis.type) {
    case "command_help":
      return `**${analysis.command} Command**\n\n${analysis.explanation}`;
    case "status_info":
      return `**${analysis.status} Status**\n\n${analysis.explanation}`;
    case "mode_info":
      return `**${analysis.mode} Mode**\n\n${analysis.explanation}`;
    case "telemetry_advice":
      return `**${analysis.topic} Information**\n\n${analysis.advice}`;
    default:
      return analysis.message || "I can help with drone operations. What do you need?";
  }
}

// Synchronous fallback for compatibility
export function cyrusInfer(text: string, context?: any) {
  const quickResult = quickAnalyze(text);
  
  if (quickResult) {
    return {
      id: randomUUID(),
      result: {
        answer: formatQuickResponse(quickResult),
        analysis: quickResult,
        confidence: quickResult.confidence,
        model_type: "quick-response",
      },
      timestamp: new Date().toISOString(),
    };
  }

  return {
    id: randomUUID(),
    result: {
      answer: `Processing your request about: "${text}". As your drone operations AI, I can assist with commands, status interpretation, mission planning, and telemetry analysis.`,
      analysis: { type: "general_response", confidence: 0.5 },
      confidence: 0.5,
      model_type: "quick-response",
    },
    timestamp: new Date().toISOString(),
  };
}

export function cyrusAnalyzeCommand(command: string, droneId?: string) {
  const commandLower = command.toLowerCase();

  if (DRONE_KNOWLEDGE_BASE.commands[commandLower]) {
    return {
      valid: true,
      command: commandLower.toUpperCase(),
      explanation: DRONE_KNOWLEDGE_BASE.commands[commandLower],
      requires_confirmation: ["emergency", "rtb", "land"].includes(commandLower),
      drone_id: droneId,
    };
  }

  return {
    valid: false,
    command,
    message: `Unknown command: ${command}. Available commands: ${Object.keys(DRONE_KNOWLEDGE_BASE.commands).join(", ")}`,
    available_commands: Object.keys(DRONE_KNOWLEDGE_BASE.commands),
  };
}

export function cyrusListCommands() {
  return {
    commands: Object.entries(DRONE_KNOWLEDGE_BASE.commands).map(([name, description]) => ({
      name: name.toUpperCase(),
      description,
    })),
  };
}

export function cyrusListModes() {
  return {
    modes: Object.entries(DRONE_KNOWLEDGE_BASE.pilotModes).map(([name, description]) => ({
      name: name.toUpperCase(),
      description,
    })),
  };
}

const DRONE_COMMAND_PATTERNS = [
  /\b(fly|go|navigate|head)\s+(to|towards?)\b/i,
  /\b(take\s*off|launch|lift\s*off)\b/i,
  /\b(land|touch\s*down)\b/i,
  /\b(return|rtb|come\s+back|go\s+home)\b/i,
  /\b(hover|hold\s+position|stay|wait)\b/i,
  /\b(patrol|circle|orbit)\b/i,
  /\b(search|scan|sweep)\b/i,
  /\b(emergency|stop\s+now|halt|abort)\b/i,
  /\b(drone\s+status|where\s+are\s+you|position|battery)\b/i,
  /\b(set\s+altitude|climb|descend)\b/i,
  /\b(set\s+speed|faster|slower)\b/i,
  /\b(start\s+mission|begin\s+mission)\b/i,
  /\b(abort\s+mission|cancel\s+mission)\b/i,
  /\b(scan\s+for\s+drones?|find\s+drones?|discover\s+drones?)\b/i,
  /\b(connect\s+to\s+(all\s+)?drones?|link\s+to\s+drones?)\b/i,
  /\b(disconnect\s+(from\s+)?drones?)\b/i,
  /\b(show\s+(connected\s+)?drones?|list\s+drones?)\b/i,
];

export function isDroneCommand(text: string): boolean {
  return DRONE_COMMAND_PATTERNS.some(pattern => pattern.test(text));
}

export function isScanCommand(text: string): boolean {
  return /\b(scan\s+for\s+drones?|find\s+drones?|discover\s+drones?)\b/i.test(text);
}

export function isConnectCommand(text: string): boolean {
  return /\b(connect\s+to\s+(all\s+)?drones?|link\s+to\s+drones?)\b/i.test(text);
}

export function isConnectAllCommand(text: string): boolean {
  return /\b(connect\s+to\s+all|link\s+all|connect\s+all)\b/i.test(text);
}

export function isDisconnectCommand(text: string): boolean {
  return /\b(disconnect\s+(from\s+)?drones?)\b/i.test(text);
}

export function isListDronesCommand(text: string): boolean {
  return /\b(show\s+(connected\s+)?drones?|list\s+drones?|what\s+drones?)\b/i.test(text);
}

export async function executeDroneVoiceCommand(text: string, droneId: string = "drone-1") {
  const command = voiceDroneController.parseVoiceCommand(text);
  const result = await voiceDroneController.executeCommand(command, droneId);
  
  return {
    command,
    result,
    voiceFeedback: result.voiceFeedback,
    droneState: result.droneState
  };
}
