
import { GoogleGenAI, GenerateContentResponse, Modality } from "@google/genai";
import { GeminiModel } from "../types";

let cachedConfig: { API_KEY?: string; GEMINI_API_KEY?: string; isPrincipalActive?: boolean } = {};

export const isServerPrincipalActive = () => {
  return !!cachedConfig.isPrincipalActive;
};

export const refreshConfig = async () => {
  console.log("refreshConfig: Initiating config fetch...");
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.warn("refreshConfig: Config fetch timed out.");
      controller.abort();
    }, 8000);
    const res = await fetch('/api/config', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      cachedConfig = await res.json();
      console.log("refreshConfig: Config fetched successfully:", cachedConfig);
    } else {
      console.warn("refreshConfig: Failed to fetch config, status:", res.status);
    }
  } catch (err: any) {
    if (err.name === 'AbortError' || (err.message && err.message.includes('aborted'))) {
      console.warn("refreshConfig: Config fetch request aborted or timed out.");
    } else {
      console.error("refreshConfig: Exception during config fetch:", err);
    }
  }
};

export const getApiKey = () => {
  const localStorageKey = typeof window !== 'undefined' ? localStorage.getItem('ZEREO_API_KEY') : undefined;
  const serverKey = cachedConfig.API_KEY;
  const serverGeminiKey = cachedConfig.GEMINI_API_KEY;
  
  // Mask helper
  const mask = (s: string | undefined) => s ? `${s.substring(0, 4)}...${s.substring(s.length - 4)}` : 'MISSING';

  if (localStorageKey && localStorageKey.trim() && !localStorageKey.includes('***') && localStorageKey !== 'undefined') {
    console.log(`getApiKey: Detected Local Neural Identification [${mask(localStorageKey)}]`);
    return localStorageKey.trim();
  }
  if (serverKey && serverKey.trim() && !serverKey.includes('***') && serverKey !== 'undefined') {
    console.log(`getApiKey: Detected Core Bridge Authorization [${mask(serverKey)}]`);
    return serverKey.trim();
  }
  if (serverGeminiKey && serverGeminiKey.trim() && !serverGeminiKey.includes('***') && serverGeminiKey !== 'undefined') {
    console.log(`getApiKey: Detected Primary Strategic Link [${mask(serverGeminiKey)}]`);
    return serverGeminiKey.trim();
  }

  console.log("getApiKey: Critical Failure - No valid neural authorization present in central arrays.");
  return '';
};

export const testApiKey = async (): Promise<{ success: boolean; message: string }> => {
  // Check platform key first if in AI Studio, but only if we don't have a local key
  if (typeof window !== 'undefined' && (window as any).aistudio) {
    try {
      const hasKey = await (window as any).aistudio.hasSelectedApiKey();
      const localKey = getApiKey();
      if (!hasKey && !localKey) {
        console.log("testApiKey: No neural key found. Opening platform dialog.");
        await (window as any).aistudio.openSelectKey();
        return { success: false, message: "Please select a neural key in the platform dialog." };
      }
    } catch (e: any) {
      console.warn("testApiKey: Platform key check failed:", e);
    }
  }

  const apiKey = getApiKey();
  if (!apiKey) return { success: false, message: "No API key found in any neural array. Please provide one in System Control." };
  
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: GeminiModel.FLASH_PREVIEW,
      contents: [{ role: 'user', parts: [{ text: "Neural pulse check. Respond with 'PULSE_OK'." }] }],
      config: { maxOutputTokens: 10 }
    });
    
    console.log("testApiKey: Neural handshake response:", response);

    if (response.text?.includes('PULSE_OK')) {
      const mask = apiKey ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` : 'NONE';
      return { success: true, message: `Neural handshake optimal. Bridge established via ID: ${mask}` };
    }

    const finishReason = response.candidates?.[0]?.finishReason;
    const safetyRatings = response.candidates?.[0]?.safetyRatings;
    let detail = response.text ? `Data: ${response.text}` : `FinishReason: ${finishReason || 'UNKNOWN'}`;
    if (safetyRatings) {
       console.warn("testApiKey: Safety issues detected:", safetyRatings);
    }

    return { success: false, message: `Unexpected response status. ${detail}` };
  } catch (err: any) {
    console.error("testApiKey: Critical Bridge Failure:", err);
    // Extract more detail from the error if possible
    const errorDetail = err.response?.data?.error?.message || err.message || "Unknown neural interference.";
    return { success: false, message: `Neural handshake failed: ${errorDetail}` };
  }
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
  cachedConfig.GEMINI_API_KEY = undefined;
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
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("AUTH_ERROR: Neural Authorization missing. Please provide an API key in System Control or select one from the platform.");
  }
  const ai = new GoogleGenAI({ apiKey });
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
