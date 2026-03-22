
import { GoogleGenAI, GenerateContentResponse, Modality } from "@google/genai";
import { GeminiModel } from "../types";

let cachedConfig: { API_KEY?: string; GEMINI_API_KEY?: string } = {};

export const refreshConfig = async () => {
  console.log("refreshConfig: Initiating config fetch...");
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.warn("refreshConfig: Config fetch timed out.");
      controller.abort();
    }, 3000);
    const res = await fetch('/api/config', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      cachedConfig = await res.json();
      console.log("refreshConfig: Config fetched successfully:", cachedConfig);
    } else {
      console.error("refreshConfig: Failed to fetch config, status:", res.status);
    }
  } catch (err) {
    console.error("refreshConfig: Exception during config fetch:", err);
  }
};

export const getApiKey = () => {
  console.log("getApiKey: Attempting to retrieve API key.");
  const keys = [
    typeof window !== 'undefined' ? localStorage.getItem('ZEREO_API_KEY') : undefined,
    cachedConfig.API_KEY,
    cachedConfig.GEMINI_API_KEY,
    typeof process !== 'undefined' ? process.env?.API_KEY : undefined,
    typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : undefined
  ];
  console.log("getApiKey: Candidate keys array:", keys);

  for (const key of keys) {
    if (
      key && 
      typeof key === 'string' && 
      key !== 'undefined' && 
      key !== 'null' && 
      !key.includes('***') &&
      key.trim() !== ''
    ) {
      console.log("getApiKey: Valid key found and returned.");
      return key.trim();
    }
  }
  console.log("getApiKey: No valid key found.");
  return '';
};

export const saveApiKey = (key: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('ZEREO_API_KEY', key.trim());
    refreshConfig(); // Trigger a re-sync
  }
};

export const getSignet = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('ZEREO_SIGNET') || '';
  }
  return '';
};

export const saveSignet = (signet: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('ZEREO_SIGNET', signet.trim());
  }
};

export const clearApiKey = () => {
  cachedConfig.API_KEY = undefined;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('ZEREO_API_KEY');
  }
};

export const getAI = () => {
  const apiKey = getApiKey();
  return new GoogleGenAI({ apiKey });
};

export const decodeBase64 = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

export const encodeBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};

export async function generateTTS(text: string, voiceName: string = 'Kore'): Promise<AudioBuffer | null> {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: GeminiModel.FLASH_TTS,
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) return null;

    const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const audioBuffer = await decodeAudioData(
      decodeBase64(base64Audio),
      outputAudioContext,
      24000,
      1
    );
    return audioBuffer;
  } catch (error) {
    console.error("TTS generation failed:", error);
    return null;
  }
}

export const safeGenerateContent = async (params: any) => {
  const ai = getAI();
  try {
    const result = await ai.models.generateContent(params);
    return result;
  } catch (err: any) {
    console.error("geminiService: generateContent error:", err);
    const msg = err.message || "";
    if (msg.includes('429') || msg.includes('Too Many Requests') || msg.includes('quota')) {
      throw new Error("NEURAL_LIMIT: Principal, my processing arrays are temporarily exhausted. The daily quota for this API key has been reached. Please try again tomorrow or provide a fresh key in System Control.");
    }
    if (msg.includes('403') || msg.includes('API key not valid') || msg.includes('invalid')) {
      throw new Error("AUTH_ERROR: Principal, our neural authorization has been rejected. The current API key is invalid or has been revoked.");
    }
    throw err;
  }
};
