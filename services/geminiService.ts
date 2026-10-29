import { GoogleGenAI, Modality } from "@google/genai";
import { GeminiModel } from "../types";

let cachedConfig: { hasGeminiKey?: boolean; isPrincipalActive?: boolean; coreDirective?: string } = {
  hasGeminiKey: true,
  isPrincipalActive: true
};

export const isServerPrincipalActive = () => {
  return !!cachedConfig.isPrincipalActive;
};

export const refreshConfig = async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 6000);
    const res = await fetch('/api/config', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      cachedConfig = await res.json();
    }
  } catch (err: any) {
    // Silent failover
  }
};

export const getApiKey = () => {
  const localStorageKey = typeof window !== 'undefined' ? localStorage.getItem('ZEREO_API_KEY') : undefined;
  if (localStorageKey && localStorageKey.trim() && !localStorageKey.includes('***') && localStorageKey !== 'undefined') {
    return localStorageKey.trim();
  }
  if (cachedConfig.hasGeminiKey !== false) {
    return 'ZEREO_CORE_LINK';
  }
  return '';
};

export const testApiKey = async (): Promise<{ success: boolean; message: string }> => {
  const localKey = typeof window !== 'undefined' ? localStorage.getItem('ZEREO_API_KEY') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (localKey && localKey.trim() && !localKey.includes('***') && localKey !== 'undefined') {
    headers['Authorization'] = `Bearer ${localKey.trim()}`;
  }

  try {
    const res = await fetch('/api/gemini/test-key', {
      method: 'POST',
      headers
    });
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok) {
      let errMsg = '';
      if (contentType.includes('application/json')) {
        try {
          const errJson = await res.json();
          errMsg = errJson.error || errJson.message;
        } catch (_) {}
      }
      return { 
        success: false, 
        message: `Neural handshake rejected (${res.status}): ${errMsg || res.statusText || 'Substrate unavailable'}` 
      };
    }

    if (!contentType.includes('application/json')) {
      return { success: false, message: "Neural handshake returned non-JSON format." };
    }

    const data = await res.json();
    if (data.success) {
      return { success: true, message: "Neural handshake optimal. Substrate core synchronized." };
    }
    return { success: false, message: `Neural handshake failed: ${data.error || 'Connection error'}` };
  } catch (err: any) {
    return { success: false, message: `Neural link unreachable: ${err?.message || err}` };
  }
};

export const saveApiKey = (key: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('ZEREO_API_KEY', key.trim());
    refreshConfig();
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
  if (typeof window !== 'undefined') {
    localStorage.removeItem('ZEREO_API_KEY');
  }
};

export const getAI = () => {
  const apiKey = getApiKey() || 'ZEREO_CORE_LINK';
  return new GoogleGenAI({ 
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
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

export async function generateTTS(
  text: string, 
  voiceName: string = 'Charon',
  stylePrompt?: string,
  accent?: string
): Promise<AudioBuffer | null> {
  const localKey = typeof window !== 'undefined' ? localStorage.getItem('ZEREO_API_KEY') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (localKey && localKey.trim() && !localKey.includes('***') && localKey !== 'undefined') {
    headers['Authorization'] = `Bearer ${localKey.trim()}`;
  }

  try {
    const res = await fetch('/api/gemini/tts', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        text,
        voiceName: voiceName || 'Charon',
        stylePrompt,
        accent
      })
    });

    if (!res.ok) {
      console.warn('TTS request to /api/gemini/tts failed with status:', res.status);
      return null;
    }

    const data = await res.json();
    if (!data.audioData) return null;

    const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const audioBuffer = await decodeAudioData(
      decodeBase64(data.audioData),
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
  const localKey = typeof window !== 'undefined' ? localStorage.getItem('ZEREO_API_KEY') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (localKey && localKey.trim() && !localKey.includes('***') && localKey !== 'undefined') {
    headers['Authorization'] = `Bearer ${localKey.trim()}`;
  }

  const adjustedParams = { ...params };
  if (adjustedParams.config?.tools && adjustedParams.config.tools.length > 0) {
    adjustedParams.config = {
      ...adjustedParams.config,
      toolConfig: {
        includeServerSideToolInvocations: true,
        ...(adjustedParams.config.toolConfig || {})
      }
    };
  }

  try {
    const res = await fetch('/api/gemini/generate', {
      method: 'POST',
      headers,
      body: JSON.stringify(adjustedParams)
    });

    const contentType = res.headers.get('content-type') || '';

    if (!res.ok) {
      let errorData: any = {};
      let rawText = '';
      if (contentType.includes('application/json')) {
        try {
          errorData = await res.json();
        } catch (_) {}
      } else {
        try {
          rawText = await res.text();
        } catch (_) {}
      }

      const msg = errorData.error?.message || errorData.message || (rawText && rawText.length < 200 ? rawText : '') || res.statusText || 'Server Error';
      if (res.status === 503 || msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('high demand') || msg.includes('Spikes in demand')) {
        throw new Error("SERVER_UNAVAILABLE: Central processing arrays are experiencing elevated network traffic. Automatic failover initiated.");
      }
      if (res.status === 429 || msg.includes('429') || msg.includes('quota') || msg.includes('Too Many Requests') || msg.includes('RESOURCE_EXHAUSTED')) {
        throw new Error("NEURAL_LIMIT: Principal, my processing arrays are temporarily exhausted. The daily quota for this API key has been reached. Please try again tomorrow or provide a fresh key in System Control.");
      }
      if (res.status === 403 || msg.includes('403') || msg.includes('PERMISSION_DENIED') || msg.includes('invalid')) {
        throw new Error("AUTH_ERROR: Principal, our neural authorization has been rejected. The current API key is invalid or has been revoked.");
      }
      throw new Error(msg);
    }

    if (!contentType.includes('application/json')) {
      const text = await res.text().catch(() => '');
      console.warn("Unexpected non-JSON response from /api/gemini/generate:", text.slice(0, 150));
      throw new Error("SERVER_RESPONSE_INVALID: Upstream server returned non-JSON data. Please retry directive.");
    }

    const data = await res.json();
    return {
      text: data.text || '',
      candidates: data.candidates || [],
      functionCalls: data.functionCalls || undefined,
      usageMetadata: data.usageMetadata
    };
  } catch (err: any) {
    console.error("geminiService: generateContent error:", err?.message || err);
    throw err;
  }
};

export interface GenerateArtParams {
  prompt: string;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  imageSize?: '1K' | '2K' | '4K';
  stylePreset?: 'luxury_tactical' | 'photorealistic' | 'oil_painting' | 'cybernetic' | 'minimalist' | 'none';
  enhancePrompt?: boolean;
  referenceImage?: string;
}

export interface GenerateArtResult {
  imageUrl: string;
  prompt: string;
  fullPrompt?: string;
  modelUsed?: string;
  title: string;
}

export const generateDesiredArt = async (params: GenerateArtParams): Promise<GenerateArtResult> => {
  const localKey = typeof window !== 'undefined' ? localStorage.getItem('ZEREO_API_KEY') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (localKey && localKey.trim() && !localKey.includes('***') && localKey !== 'undefined') {
    headers['Authorization'] = `Bearer ${localKey.trim()}`;
  }

  const res = await fetch('/api/gemini/generate-art', {
    method: 'POST',
    headers,
    body: JSON.stringify(params)
  });

  if (!res.ok) {
    let errMsg = 'Failed to generate desired art';
    try {
      const errJson = await res.json();
      errMsg = errJson.error?.message || errJson.message || errMsg;
    } catch {}
    throw new Error(errMsg);
  }

  const data = await res.json();
  return {
    imageUrl: data.imageUrl,
    prompt: data.prompt,
    fullPrompt: data.fullPrompt,
    modelUsed: data.modelUsed,
    title: data.title
  };
};

