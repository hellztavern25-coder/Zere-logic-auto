// [TAG: 11]
import { GoogleGenAI, Modality } from "@google/genai";
import { GeminiModel } from "../types";

let cachedConfig: { hasGeminiKey?: boolean; isPrincipalActive?: boolean; coreDirective?: string } = {
  hasGeminiKey: true,
  isPrincipalActive: true
};

let ttsClientCooldownUntil = 0;
let lastTtsQuotaNotice: string | null = null;

export const getTtsQuotaNotice = () => lastTtsQuotaNotice;

export const markTtsQuotaExhausted = (message?: string, retryAfterSeconds?: number) => {
  const retrySec = Math.min(Math.max(Number(retryAfterSeconds) || 300, 30), 900);
  ttsClientCooldownUntil = Date.now() + retrySec * 1000;
  lastTtsQuotaNotice =
    message ||
    'Cloud neural TTS reached its Free Tier daily quota. British DSP Speech synthesis is active.';
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('zereo:tts_notice', {
        detail: { quotaExhausted: true, message: lastTtsQuotaNotice }
      })
    );
  }
};

export const clearTtsQuotaNotice = () => {
  ttsClientCooldownUntil = 0;
  if (lastTtsQuotaNotice !== null) {
    lastTtsQuotaNotice = null;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('zereo:tts_notice', {
          detail: { quotaExhausted: false, message: null }
        })
      );
    }
  }
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

export function isRealKey(key: string | undefined): key is string {
  return !!key && key.trim() !== '' && key !== 'undefined' && !key.includes('***') && key !== 'ZEREO_CORE_LINK';
}

export const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const key = getApiKey();
  if (isRealKey(key)) {
    headers['Authorization'] = `Bearer ${key.trim()}`;
  }
  return headers;
};

export const hasServerGeminiKey = (): boolean => cachedConfig.hasGeminiKey !== false;

export const hasActiveNeuralKey = (): boolean =>
  Boolean(getAuthHeaders()['Authorization']) || hasServerGeminiKey();

export const testApiKey = async (): Promise<{ success: boolean; message: string }> => {
  const headers = getAuthHeaders();

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
    clearTtsQuotaNotice();
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
  const authHeader = getAuthHeaders()['Authorization'];
  const apiKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!isRealKey(apiKey)) {
    throw new Error("A user-configured Gemini API key is required for direct browser SDK calls. Server-managed keys route through /api/* endpoints.");
  }
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

let sharedDecodeCtx: AudioContext | null = null;

function getSharedDecodeAudioContext(): AudioContext {
  if (!sharedDecodeCtx || sharedDecodeCtx.state === 'closed') {
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    sharedDecodeCtx = new AudioCtxClass({ sampleRate: 24000 });
  }
  return sharedDecodeCtx;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  // Handle RIFF/WAVE container payloads cleanly if upstream returns wrapped WAV
  if (
    data.byteLength >= 44 &&
    data[0] === 0x52 && // R
    data[1] === 0x49 && // I
    data[2] === 0x46 && // F
    data[3] === 0x46    // F
  ) {
    try {
      const cloned = data.slice().buffer;
      return await ctx.decodeAudioData(cloned);
    } catch {
      // Fall through to raw PCM stripping 44-byte WAV header
      data = data.subarray(44);
    }
  }

  const alignedByteLen = data.byteLength - (data.byteLength % 2);
  const alignedCopy = new Uint8Array(alignedByteLen);
  alignedCopy.set(data.subarray(0, alignedByteLen));
  const dataInt16 = new Int16Array(alignedCopy.buffer);
  const frameCount = Math.max(1, Math.floor(dataInt16.length / numChannels));
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
  if (Date.now() < ttsClientCooldownUntil) {
    return null;
  }

  const headers = getAuthHeaders();

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

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      console.warn('TTS response non-JSON or status:', res.status);
      return null;
    }

    const data = await res.json().catch(() => null);
    if (res.status === 429 || data?.quotaExhausted) {
      markTtsQuotaExhausted(data?.error, data?.retryAfterSeconds);
      return null;
    }

    if (!res.ok || !data || !data.audioData) {
      return null;
    }

    clearTtsQuotaNotice();
    const outputAudioContext = getSharedDecodeAudioContext();
    const audioBuffer = await decodeAudioData(
      decodeBase64(data.audioData),
      outputAudioContext,
      24000,
      1
    );
    return audioBuffer;
  } catch (error) {
    console.warn("TTS generation deferred to speech synthesis fallback:", error);
    return null;
  }
}

export const safeGenerateContent = async (params: any) => {
  const headers = getAuthHeaders();

  const adjustedParams = { ...params };
  const toolsArr = Array.isArray(adjustedParams.config?.tools) ? adjustedParams.config.tools : [];
  const hasServerSideTools = toolsArr.some(
    (t: any) => t && (t.googleSearch || t.googleMaps || t.urlContext || t.codeExecution)
  );
  if (hasServerSideTools) {
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

    if (!res.ok || !contentType.includes('application/json')) {
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
      if (res.status === 504 || res.status === 502 || msg.includes('UPSTREAM_TIMEOUT') || msg.includes('GATEWAY_TIMEOUT') || msg.includes('DEADLINE_EXCEEDED') || rawText.includes('<!doctype') || rawText.includes('<html>')) {
        throw new Error("GATEWAY_TIMEOUT: Upstream neural bridge latency spike detected. Failover engaged.");
      }
      if (res.status === 422 || msg.includes('CONTENT_BLOCKED') || msg.includes('SAFETY')) {
        throw new Error(`CONTENT_BLOCKED: ${msg}`);
      }
      throw new Error(msg || "SERVER_RESPONSE_INVALID: Upstream server returned non-JSON data. Please retry directive.");
    }

    const data = await res.json();
    return {
      text: data.text || '',
      candidates: data.candidates || [],
      functionCalls: data.functionCalls || undefined,
      usageMetadata: data.usageMetadata,
      servedByModel: data.servedByModel
    };
  } catch (err: any) {
    console.warn("geminiService: generateContent issue:", err?.message || err);
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
  const headers = getAuthHeaders();

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

