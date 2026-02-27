import fetch from "node-fetch";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1";

export const ELEVENLABS_VOICES = {
  rachel: "21m00Tcm4TlvDq8ikWAM",
  domi: "AZnzlk1XvdvUeBnXmlld",
  bella: "EXAVITQu4vr4xnSDxMaL",
  elli: "MF3mGyEYCl7XYWbV9V6O",
  charlotte: "XB0fDUnXU5powFXDhCwa",
  emily: "LcfcDJNUP1GQjkzn1xUU",
  sarah: "EXAVITQu4vr4xnSDxMaL",
} as const;

export type ElevenLabsVoice = keyof typeof ELEVENLABS_VOICES;

interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style?: number;
  use_speaker_boost?: boolean;
}

const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  stability: 0.42,
  similarity_boost: 0.95,
  style: 0.72,
  use_speaker_boost: true,
};

export async function textToSpeechElevenLabs(
  text: string,
  voice: ElevenLabsVoice = "rachel",
  settings: Partial<VoiceSettings> = {}
): Promise<Buffer> {
  if (!ELEVENLABS_API_KEY) {
    throw new Error("ELEVENLABS_API_KEY is not configured");
  }

  const voiceId = ELEVENLABS_VOICES[voice] || ELEVENLABS_VOICES.rachel;
  const voiceSettings = { ...DEFAULT_VOICE_SETTINGS, ...settings };

  const processedText = preprocessTextForSpeech(text);

  const response = await fetch(
    `${ELEVENLABS_BASE_URL}/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text: processedText,
        model_id: "eleven_turbo_v2_5",
        voice_settings: voiceSettings,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[ElevenLabs] TTS Error:", response.status, errorText);
    throw new Error(`ElevenLabs TTS failed: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function* textToSpeechStreamElevenLabs(
  text: string,
  voice: ElevenLabsVoice = "rachel",
  settings: Partial<VoiceSettings> = {}
): AsyncGenerator<Buffer> {
  if (!ELEVENLABS_API_KEY) {
    throw new Error("ELEVENLABS_API_KEY is not configured");
  }

  const voiceId = ELEVENLABS_VOICES[voice] || ELEVENLABS_VOICES.rachel;
  const voiceSettings = { ...DEFAULT_VOICE_SETTINGS, ...settings };

  const processedText = preprocessTextForSpeech(text);

  const response = await fetch(
    `${ELEVENLABS_BASE_URL}/text-to-speech/${voiceId}/stream`,
    {
      method: "POST",
      headers: {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text: processedText,
        model_id: "eleven_turbo_v2_5",
        voice_settings: voiceSettings,
        optimize_streaming_latency: 4,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[ElevenLabs] Stream Error:", response.status, errorText);
    throw new Error(`ElevenLabs streaming TTS failed: ${response.status}`);
  }

  const reader = response.body;
  if (!reader) {
    throw new Error("No response body");
  }

  for await (const chunk of reader as AsyncIterable<Buffer>) {
    yield chunk;
  }
}

function preprocessTextForSpeech(text: string): string {
  let processed = text
    .replace(/[#*_~`]/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, ", ")
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/\.{3,}/g, "...")
    .replace(/—/g, " — ")
    .replace(/ - /g, " — ")
    .replace(/[│┌┐└┘├┤┬┴┼═║╒╓╔╕╖╗╘╙╚╛╜╝╞╟╠╡╢╣╤╥╦╧╨╩╪╫╬]/g, "")
    .replace(/[◈━╭╮╯╰▸▶◀◁►▷▹▻●○◐◑◒◓◔◕◖◗★☆✓✔✕✖✗✘]/g, "")
    .replace(/\([^)]*\)/g, (match) => {
      if (match.length > 50) return "";
      return match;
    })
    .replace(/:\s*/g, ": ")
    .replace(/;\s*/g, "; ")
    .replace(/\.\s+/g, ". ")
    .replace(/,\s+/g, ", ")
    .replace(/!\s+/g, "! ")
    .replace(/\?\s+/g, "? ")
    .replace(/\bi\.e\./gi, "that is")
    .replace(/\be\.g\./gi, "for example")
    .replace(/\betc\./gi, "and so on")
    .replace(/\bvs\./gi, "versus")
    .replace(/\bDr\./gi, "Doctor")
    .replace(/\bMr\./gi, "Mister")
    .replace(/\bMrs\./gi, "Missus")
    .replace(/\bMs\./gi, "Miss")
    .replace(/(\d+)\.(\d+)/g, "$1 point $2")
    .replace(/(\d+)%/g, "$1 percent")
    .replace(/&/g, " and ")
    .replace(/\+/g, " plus ")
    .replace(/=/g, " equals ")
    .replace(/@/g, " at ")
    .trim();

  if (!processed || processed.length === 0) {
    processed = text.replace(/[^\w\s.,!?'-]/g, " ").replace(/\s+/g, " ").trim();
  }

  if (!processed || processed.length === 0) {
    processed = "I processed your request.";
  }

  processed = processed.replace(/\s{2,}/g, " ");

  return processed;
}

const EMOTION_VOICE_PRESETS: Record<string, Partial<VoiceSettings>> = {
  happy:       { stability: 0.35, similarity_boost: 0.96, style: 0.90, use_speaker_boost: true },
  excited:     { stability: 0.28, similarity_boost: 0.95, style: 1.0,  use_speaker_boost: true },
  joyful:      { stability: 0.32, similarity_boost: 0.96, style: 0.95, use_speaker_boost: true },
  sad:         { stability: 0.55, similarity_boost: 0.94, style: 0.45, use_speaker_boost: true },
  melancholic: { stability: 0.60, similarity_boost: 0.93, style: 0.38, use_speaker_boost: true },
  angry:       { stability: 0.50, similarity_boost: 0.94, style: 0.65, use_speaker_boost: true },
  frustrated:  { stability: 0.48, similarity_boost: 0.93, style: 0.60, use_speaker_boost: true },
  calm:        { stability: 0.55, similarity_boost: 0.95, style: 0.50, use_speaker_boost: true },
  peaceful:    { stability: 0.58, similarity_boost: 0.95, style: 0.45, use_speaker_boost: true },
  confident:   { stability: 0.40, similarity_boost: 0.96, style: 0.80, use_speaker_boost: true },
  assertive:   { stability: 0.38, similarity_boost: 0.95, style: 0.82, use_speaker_boost: true },
  empathetic:  { stability: 0.48, similarity_boost: 0.95, style: 0.55, use_speaker_boost: true },
  compassionate: { stability: 0.50, similarity_boost: 0.95, style: 0.50, use_speaker_boost: true },
  curious:     { stability: 0.38, similarity_boost: 0.95, style: 0.68, use_speaker_boost: true },
  intrigued:   { stability: 0.36, similarity_boost: 0.94, style: 0.72, use_speaker_boost: true },
  thoughtful:  { stability: 0.50, similarity_boost: 0.95, style: 0.48, use_speaker_boost: true },
  reflective:  { stability: 0.52, similarity_boost: 0.94, style: 0.42, use_speaker_boost: true },
  warm:        { stability: 0.42, similarity_boost: 0.96, style: 0.75, use_speaker_boost: true },
  tender:      { stability: 0.48, similarity_boost: 0.96, style: 0.62, use_speaker_boost: true },
  playful:     { stability: 0.30, similarity_boost: 0.95, style: 0.88, use_speaker_boost: true },
  amused:      { stability: 0.33, similarity_boost: 0.95, style: 0.82, use_speaker_boost: true },
  concerned:   { stability: 0.52, similarity_boost: 0.95, style: 0.52, use_speaker_boost: true },
  worried:     { stability: 0.55, similarity_boost: 0.94, style: 0.48, use_speaker_boost: true },
  surprised:   { stability: 0.30, similarity_boost: 0.95, style: 0.92, use_speaker_boost: true },
  grateful:    { stability: 0.45, similarity_boost: 0.96, style: 0.70, use_speaker_boost: true },
  proud:       { stability: 0.38, similarity_boost: 0.96, style: 0.78, use_speaker_boost: true },
  encouraging: { stability: 0.40, similarity_boost: 0.96, style: 0.75, use_speaker_boost: true },
  soothing:    { stability: 0.58, similarity_boost: 0.95, style: 0.40, use_speaker_boost: true },
  neutral:     { stability: 0.42, similarity_boost: 0.95, style: 0.72, use_speaker_boost: true },
};

export function getEmotionVoiceSettings(emotion: string): Partial<VoiceSettings> {
  const key = emotion.toLowerCase();
  return EMOTION_VOICE_PRESETS[key] || EMOTION_VOICE_PRESETS.neutral;
}

export async function textToSpeechWithEmotion(
  text: string,
  emotion: string = "neutral",
  voice: ElevenLabsVoice = "rachel"
): Promise<Buffer> {
  const emotionSettings = getEmotionVoiceSettings(emotion);
  return textToSpeechElevenLabs(text, voice, emotionSettings);
}

export async function getAvailableVoices(): Promise<any[]> {
  if (!ELEVENLABS_API_KEY) {
    throw new Error("ELEVENLABS_API_KEY is not configured");
  }

  const response = await fetch(`${ELEVENLABS_BASE_URL}/voices`, {
    headers: {
      "xi-api-key": ELEVENLABS_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get voices: ${response.status}`);
  }

  const data = await response.json() as { voices: any[] };
  return data.voices;
}

console.log("[ElevenLabs] Voice synthesis module initialized");
console.log("[ElevenLabs] Emotion presets: " + Object.keys(EMOTION_VOICE_PRESETS).length + " profiles");
console.log("[ElevenLabs] Voice: Rachel (sweet feminine) | Model: eleven_turbo_v2_5 | Low-latency mode");
