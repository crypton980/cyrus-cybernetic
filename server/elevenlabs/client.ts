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
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.5,
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
        model_id: "eleven_multilingual_v2",
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
        model_id: "eleven_multilingual_v2",
        voice_settings: voiceSettings,
        optimize_streaming_latency: 3,
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
    .replace(/—/g, " - ")
    .replace(/[│┌┐└┘├┤┬┴┼═║╒╓╔╕╖╗╘╙╚╛╜╝╞╟╠╡╢╣╤╥╦╧╨╩╪╫╬]/g, "")
    .replace(/[◈━╭╮╯╰▸▶◀◁►▷▹▻●○◐◑◒◓◔◕◖◗★☆✓✔✕✖✗✘]/g, "")
    .replace(/\([^)]*\)/g, (match) => {
      if (match.length > 50) return "";
      return match;
    })
    .trim();

  if (!processed || processed.length === 0) {
    processed = text.replace(/[^\w\s.,!?'-]/g, " ").replace(/\s+/g, " ").trim();
  }

  if (!processed || processed.length === 0) {
    processed = "I processed your request.";
  }

  return processed;
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
