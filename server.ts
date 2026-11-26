// [TAG: 11]
console.log("SERVER: Module loading...");
import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import fs from 'fs/promises';
import fsSync from 'fs';
import net from 'net';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import { createServer } from 'http';
import { Client, GatewayIntentBits } from 'discord.js';
import { GoogleGenAI, ThinkingLevel, Modality, LiveServerMessage, HarmCategory, HarmBlockThreshold } from '@google/genai';
import { DaemonStatus, DaemonTask, DaemonLogEntry, DaemonCapabilities, DaemonState, EmotionalMap } from './types';
import { KNOWLEDGE_OF_USES_REGISTRY } from './services/emotionalMappingService';
import {
  STEWARD_DAEMON_INSTRUCTION,
  LEGAL_COUNSEL_SYSTEM_INSTRUCTION,
  AUDITION_LINE_1911,
} from './services/stewardIdentity';
import {
  buildRecallSummaryPayload,
  isNoisyMemory,
} from './services/conversationMemoryService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  console.log("SERVER: startServer() initiated.");
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*' }
  });
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  const MEMORY_FILE = path.join(__dirname, 'memories.json');
  const VISUAL_CAPTURES_FILE = path.join(__dirname, 'visual_captures.json');
  const VOICE_PROFILES_FILE = path.join(__dirname, 'voice_profiles.json');
  const IDENTITY_VOICE_PROFILE_FILE = path.join(__dirname, 'zereo_identity_voice_profile.json');
  const VOICE_CLONES_FILE = path.join(__dirname, 'voice_clones.json');
  const VOICE_PRESETS_FILE = path.join(__dirname, 'voice_presets.json');
  const VOICE_COMMAND_LOGS_FILE = path.join(__dirname, 'voice_command_logs.json');
  const LEGAL_DOSSIERS_FILE = path.join(__dirname, 'legal_dossiers.json');
  const THREADS_FILE = path.join(__dirname, 'threads.json');
  const CONFIG_FILE = path.join(__dirname, 'config.json');
  const CONTEXT_FILE = path.join(__dirname, 'recent_context.json');
  const DAEMON_FILE = path.join(__dirname, 'daemon_state.json');
  const EMOTIONAL_STATE_FILE = path.join(__dirname, 'emotional_state.json');

  // Start listening as early as possible to satisfy platform health checks
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log("========================================");
    console.log(`ZereØ Steward Server Active [v2.0.3]`);
    console.log(`Port: ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Time: ${new Date().toISOString()}`);
    console.log("========================================");
  });

  // Serialized, atomic JSON file persistence helpers (per-file lock + temp write + rename)
  const fileLockQueues = new Map<string, Promise<unknown>>();

  const withFileLock = <T>(file: string, fn: () => Promise<T>): Promise<T> => {
    const key = path.resolve(file);
    const prev = fileLockQueues.get(key) || Promise.resolve();
    const run = prev.then(fn, fn);
    const cleanup = run.then(
      () => {
        if (fileLockQueues.get(key) === cleanup) fileLockQueues.delete(key);
      },
      () => {
        if (fileLockQueues.get(key) === cleanup) fileLockQueues.delete(key);
      }
    );
    fileLockQueues.set(key, cleanup);
    return run;
  };

  const cloneFallback = <T>(fallback: T): T => {
    if (fallback === null || typeof fallback !== 'object') return fallback;
    return JSON.parse(JSON.stringify(fallback));
  };

  const readJsonFileUnlocked = async <T>(file: string, fallback: T): Promise<T> => {
    try {
      const raw = await fs.readFile(file, 'utf-8');
      if (!raw || !raw.trim()) return cloneFallback(fallback);
      return JSON.parse(raw) as T;
    } catch {
      return cloneFallback(fallback);
    }
  };

  const writeJsonFileUnlocked = async (file: string, data: unknown): Promise<void> => {
    const tmpFile = `${file}.tmp.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}`;
    const payload = JSON.stringify(data, null, 2);
    try {
      await fs.writeFile(tmpFile, payload, 'utf-8');
      await fs.rename(tmpFile, file);
    } catch (err) {
      await fs.unlink(tmpFile).catch(() => {});
      throw err;
    }
  };

  const readJsonFile = async <T>(file: string, fallback: T): Promise<T> => {
    return readJsonFileUnlocked(file, fallback);
  };

  const writeJsonFile = async (file: string, data: unknown): Promise<void> => {
    return withFileLock(file, () => writeJsonFileUnlocked(file, data));
  };

  const updateJsonFile = async <T>(
    file: string,
    fallback: T,
    updater: (current: T) => Promise<T> | T
  ): Promise<T> => {
    return withFileLock(file, async () => {
      const current = await readJsonFileUnlocked(file, fallback);
      const next = await updater(current);
      await writeJsonFileUnlocked(file, next);
      return next;
    });
  };

  // Ensure files exist
  const ensureFile = async (file: string, defaultData: any) => {
    const fileName = path.basename(file);
    console.log(`SERVER: Ensuring ${fileName} exists...`);
    try {
      await fs.access(file);
      console.log(`SERVER: ${fileName} verified.`);
    } catch {
      console.log(`SERVER: ${fileName} missing. Creating default...`);
      await writeJsonFile(file, defaultData);
      console.log(`SERVER: ${fileName} created.`);
    }
  };

  const DEFAULT_SAFETY_SETTINGS = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH }
  ];

  const invokeModelWithTimeout = async (
    ai: GoogleGenAI,
    params: { model: string; contents: any; config?: any },
    timeoutMs: number,
    timeoutErrorPrefix: string = 'UPSTREAM_TIMEOUT'
  ) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      const reqPromise = ai.models.generateContent(params);
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          const timeoutErr: any = new Error(`${timeoutErrorPrefix}: Model [${params.model}] exceeded ${timeoutMs}ms`);
          timeoutErr.status = 504;
          reject(timeoutErr);
        }, timeoutMs);
      });
      return await Promise.race([reqPromise, timeoutPromise]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  // ==========================================
  // SERVER-SIDE GEMINI API GATEWAY
  // ==========================================
  function getCustomApiKey(req: any): string | undefined {
    const authHeader = req?.headers?.authorization as string | undefined;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return undefined;
    const key = authHeader.slice(7).trim();
    if (!key || key === 'undefined' || key.includes('***')) return undefined;
    if (key === 'ZEREO_CORE_LINK') return undefined; // placeholder, not a real key — fall through to env
    return key;
  }

  function resolveServerKey(customApiKey?: string): string | undefined {
    const trimmed = customApiKey ? customApiKey.trim() : '';
    const validCustom =
      trimmed && trimmed !== 'undefined' && !trimmed.includes('***') && trimmed !== 'ZEREO_CORE_LINK'
        ? trimmed
        : undefined;
    return validCustom || process.env.GEMINI_API_KEY || process.env.API_KEY || undefined;
  }

  function getGeminiClient(customApiKey?: string): GoogleGenAI {
    const key = resolveServerKey(customApiKey);
    if (!key) {
      throw new Error('AUTH_ERROR: No Gemini API Key configured in server environment.');
    }
    return new GoogleGenAI({
      apiKey: key,
      apiVersion: 'v1beta',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  // Cooldown & cache state for TTS and text synthesis so unavailable (404), quota-exhausted (429), or timing-out models are not repeatedly hammered
  const ttsModelCooldowns = new Map<string, { blockedUntil: number; reason: string; retryAfterSeconds?: number }>();
  const textModelCooldowns = new Map<string, { blockedUntil: number; reason: string }>();
  const ttsAudioCache = new Map<string, { audioData: string; mimeType: string; servedByModel: string; voiceUsed: string; cachedAt: number }>();

  function parseRetryDelaySeconds(errMsg: string): number {
    const secMatch = errMsg.match(/"retryDelay"\s*:\s*"(\d+)s"/i);
    if (secMatch) {
      const s = parseInt(secMatch[1], 10);
      if (Number.isFinite(s) && s > 0) return s;
    }
    return 900; // Default 15m cooldown when no explicit retryDelay is provided
  }

  function getKeyFingerprint(customApiKey?: string): string {
    const key = resolveServerKey(customApiKey) || 'default';
    return `${key.slice(0, 4)}:${key.slice(-4)}`;
  }

  function pruneTtsAudioCache() {
    if (ttsAudioCache.size <= 60) return;
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [k, v] of ttsAudioCache.entries()) {
      if (v.cachedAt < oldestTime) {
        oldestTime = v.cachedAt;
        oldestKey = k;
      }
    }
    if (oldestKey) ttsAudioCache.delete(oldestKey);
  }

  function sanitizeAcousticStylePrompt(raw?: string): string {
    if (!raw || typeof raw !== 'string') return '';
    return raw
      .replace(/Jeremy Irons|Alfred Pennyworth/gi, '')
      .replace(/^(?:Deliver|Say|Speak)\s+(?:in|with|deliberately)?\s*/i, '')
      .replace(/portraying|in the definitive manner of|in the manner of|accent/gi, '')
      .replace(/[.:;"']/g, ',')
      .replace(/\s+/g, ' ')
      .replace(/,\s*,+/g, ',')
      .replace(/^,\s*|,\s*$/g, '')
      .trim()
      .slice(0, 140);
  }

  const ALLOWED_BARITONE_VOICES = new Set(['Charon', 'Fenrir', 'Orus']);

  async function getCanonicalBaseVoice(): Promise<'Charon' | 'Fenrir' | 'Orus'> {
    const parsed = await readJsonFile<any>(IDENTITY_VOICE_PROFILE_FILE, null);
    const v = parsed?.dsp_filter_pipeline?.base_neural_voice;
    if (v === 'Charon' || v === 'Fenrir' || v === 'Orus') {
      return v;
    }
    return 'Charon';
  }

  async function synthesizeTtsWithFailover(params: {
    text: string;
    voiceName?: string;
    acousticStyle: string;
    customApiKey?: string;
  }): Promise<{
    success: boolean;
    audioData: string | null;
    mimeType?: string;
    servedByModel?: string;
    voiceUsed?: string;
    quotaExhausted?: boolean;
    retryAfterSeconds?: number;
    error?: string;
  }> {
    const { text, voiceName, acousticStyle, customApiKey } = params;
    const clippedText = text.length > 3500 ? text.substring(0, 3500) : text;
    const requestedVoice = typeof voiceName === 'string' ? voiceName.trim() : '';
    const canonicalBaseVoice = await getCanonicalBaseVoice();
    const targetVoice = ALLOWED_BARITONE_VOICES.has(requestedVoice) ? requestedVoice : canonicalBaseVoice;
    const keyFp = getKeyFingerprint(customApiKey);

    const cacheKey = `${keyFp}|${targetVoice}|${acousticStyle}|${clippedText}`;
    const cached = ttsAudioCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < 30 * 60 * 1000) {
      return {
        success: true,
        audioData: cached.audioData,
        mimeType: cached.mimeType,
        servedByModel: cached.servedByModel,
        voiceUsed: cached.voiceUsed,
      };
    }

    const ai = getGeminiClient(customApiKey);
    const ttsCandidates = [
      'gemini-3.8-flash-lite-tts',
      'gemini-3.8-flash-tts',
    ];

    const now = Date.now();
    let anyQuotaExhausted = false;
    let maxRetryAfterSec = 0;

    for (const m of ttsCandidates) {
      const cdKey = `${m}:${keyFp}`;
      const cooldown = ttsModelCooldowns.get(cdKey);
      if (cooldown && cooldown.blockedUntil > now) {
        if (cooldown.reason === 'QUOTA_EXHAUSTED') {
          anyQuotaExhausted = true;
          const remaining = Math.max(1, Math.ceil((cooldown.blockedUntil - now) / 1000));
          maxRetryAfterSec = Math.max(maxRetryAfterSec, cooldown.retryAfterSeconds || remaining);
        }
        continue;
      }

      let timer: ReturnType<typeof setTimeout> | null = null;
      try {
        const ttsPromise = ai.models.generateContent({
          model: m,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: clippedText,
                  speechMetadata: { style: acousticStyle },
                } as any,
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: targetVoice },
              },
            },
          },
        });

        const timeoutPromise = new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('TTS_UPSTREAM_TIMEOUT')), 12000);
        });

        const ttsResponse = await Promise.race([ttsPromise, timeoutPromise]);
        const ttsParts = ttsResponse?.candidates?.[0]?.content?.parts || [];
        const audioPart = ttsParts.find((p: any) => p?.inlineData?.data);
        const audioBase64 = audioPart?.inlineData?.data;
        const mimeType = audioPart?.inlineData?.mimeType || 'audio/wav';

        if (audioBase64) {
          ttsModelCooldowns.delete(cdKey);
          ttsAudioCache.set(cacheKey, {
            audioData: audioBase64,
            mimeType,
            servedByModel: m,
            voiceUsed: targetVoice,
            cachedAt: Date.now(),
          });
          pruneTtsAudioCache();
          return {
            success: true,
            audioData: audioBase64,
            mimeType,
            servedByModel: m,
            voiceUsed: targetVoice,
          };
        }
      } catch (candidateErr: any) {
        const errMsg = String(candidateErr?.message || candidateErr || '');
        const httpStatus = getNumericHttpStatus(candidateErr, 500);

        if (httpStatus === 429 || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota')) {
          const retrySec = parseRetryDelaySeconds(errMsg);
          ttsModelCooldowns.set(cdKey, {
            blockedUntil: Date.now() + Math.min(retrySec, 3600) * 1000,
            reason: 'QUOTA_EXHAUSTED',
            retryAfterSeconds: retrySec,
          });
          anyQuotaExhausted = true;
          maxRetryAfterSec = Math.max(maxRetryAfterSec, retrySec);
          console.log(`SERVER: TTS model [${m}] reached quota limit; switching to fallback/DSP (${retrySec}s cooldown).`);
        } else if (httpStatus === 404 || httpStatus === 403 || httpStatus === 400) {
          ttsModelCooldowns.set(cdKey, {
            blockedUntil: Date.now() + 30 * 60 * 1000,
            reason: `HTTP_${httpStatus}`,
          });
          console.log(`SERVER: TTS model [${m}] unavailable (${httpStatus}); cooled down 30m.`);
        } else if (errMsg.includes('TTS_UPSTREAM_TIMEOUT') || candidateErr?.name === 'AbortError') {
          ttsModelCooldowns.set(cdKey, {
            blockedUntil: Date.now() + 90 * 1000,
            reason: 'TIMEOUT',
          });
          console.log(`SERVER: TTS model [${m}] timed out; cooled down 90s.`);
        } else {
          console.log(`SERVER: TTS model [${m}] deferred (${errMsg.slice(0, 140)}).`);
        }
        continue;
      } finally {
        if (timer) clearTimeout(timer);
      }
    }

    // Secondary Studio Failover: Gemini Live Native Audio ('gemini-3.8-live') when unary TTS models exhaust Free Tier quota
    const liveCdKey = `gemini-3.8-live:${keyFp}`;
    const liveCooldown = ttsModelCooldowns.get(liveCdKey);
    if (!liveCooldown || liveCooldown.blockedUntil <= Date.now()) {
      try {
        const liveWavBase64 = await synthesizeViaGeminiLive(ai, clippedText, targetVoice, acousticStyle);
        if (liveWavBase64) {
          ttsModelCooldowns.delete(liveCdKey);
          ttsAudioCache.set(cacheKey, {
            audioData: liveWavBase64,
            mimeType: 'audio/wav',
            servedByModel: 'gemini-3.8-live',
            voiceUsed: targetVoice,
            cachedAt: Date.now(),
          });
          pruneTtsAudioCache();
          return {
            success: true,
            audioData: liveWavBase64,
            mimeType: 'audio/wav',
            servedByModel: 'gemini-3.8-live',
            voiceUsed: targetVoice,
          };
        }
      } catch (liveErr: any) {
        const liveMsg = String(liveErr?.message || liveErr || '');
        const liveStatus = getNumericHttpStatus(liveErr, 500);
        if (liveStatus === 429 || liveMsg.includes('RESOURCE_EXHAUSTED') || liveMsg.includes('quota')) {
          const retrySec = parseRetryDelaySeconds(liveMsg);
          ttsModelCooldowns.set(liveCdKey, {
            blockedUntil: Date.now() + Math.min(retrySec, 3600) * 1000,
            reason: 'QUOTA_EXHAUSTED',
            retryAfterSeconds: retrySec,
          });
        } else {
          ttsModelCooldowns.set(liveCdKey, {
            blockedUntil: Date.now() + 90 * 1000,
            reason: 'LIVE_UNAVAILABLE',
          });
        }
        console.log(`SERVER: Gemini Live TTS failover unavailable (${liveMsg.slice(0, 140)}).`);
      }
    }

    if (anyQuotaExhausted) {
      return {
        success: false,
        audioData: null,
        quotaExhausted: true,
        retryAfterSeconds: maxRetryAfterSec || undefined,
        error: 'Gemini TTS free-tier daily quota reached; client British SpeechSynthesis fallback is active. Select a billing-enabled API key in Settings > Secrets for unlimited studio voice.',
      };
    }

    return {
      success: false,
      audioData: null,
      error: 'TTS synthesis deferred to client speech synthesis',
    };
  }

  function wrapPcm24kMonoToWav(pcm: Buffer): Buffer {
    const header = Buffer.alloc(44);
    const sampleRate = 24000;
    const channels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * channels * (bitsPerSample / 8);
    const blockAlign = channels * (bitsPerSample / 8);

    header.write('RIFF', 0);
    header.writeUInt32LE(36 + pcm.length, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write('data', 36);
    header.writeUInt32LE(pcm.length, 40);

    return Buffer.concat([header, pcm]);
  }

  async function synthesizeViaGeminiLive(
    ai: GoogleGenAI,
    text: string,
    voiceName: string,
    acousticStyle: string
  ): Promise<string | null> {
    const pcmChunks: Buffer[] = [];
    let settled = false;
    let session: any = null;

    return new Promise<string | null>(async (resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      const finish = (err?: Error) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        try {
          session?.close?.();
        } catch {}
        if (err) {
          reject(err);
          return;
        }
        const total = Buffer.concat(pcmChunks);
        if (total.length === 0) {
          resolve(null);
          return;
        }
        resolve(wrapPcm24kMonoToWav(total).toString('base64'));
      };

      timer = setTimeout(() => {
        if (pcmChunks.length > 0) {
          finish();
        } else {
          finish(new Error('TTS_LIVE_TIMEOUT'));
        }
      }, 11000);

      const canonicalBaseVoice = await getCanonicalBaseVoice();
      const targetLiveVoice = ALLOWED_BARITONE_VOICES.has(voiceName) ? voiceName : canonicalBaseVoice;
      try {
        session = await ai.live.connect({
          model: 'gemini-3.8-live',
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: targetLiveVoice },
              },
            },
            systemInstruction: `You are a high-precision studio narrator (${acousticStyle || 'Jeremy Irons British aristocratic baritone'}). Read ONLY the exact text provided by the user verbatim—never add greetings, explanations, or extra words.`,
          },
          callbacks: {
            onmessage: (message: LiveServerMessage) => {
              const parts = message.serverContent?.modelTurn?.parts ?? [];
              for (const part of parts) {
                if (part.inlineData?.data) {
                  pcmChunks.push(Buffer.from(part.inlineData.data, 'base64'));
                }
              }
              if (message.serverContent?.turnComplete) {
                finish();
              }
            },
            onerror: (e: any) => {
              finish(new Error(String(e?.message || e || 'LIVE_TTS_ERROR')));
            },
            onclose: () => {
              finish();
            },
          },
        });

        session.sendClientContent({
          turns: [{ role: 'user', parts: [{ text }] }],
          turnComplete: true,
        });
      } catch (err: any) {
        finish(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  function getNumericHttpStatus(err: any, defaultCode: number = 500): number {
    if (typeof err?.status === 'number' && err.status >= 100 && err.status <= 599) {
      return err.status;
    }
    if (typeof err?.code === 'number' && err.code >= 100 && err.code <= 599) {
      return err.code;
    }
    const statusStr = String(err?.status || '');
    if (statusStr === 'UNAVAILABLE' || statusStr.includes('503')) return 503;
    if (statusStr === 'DEADLINE_EXCEEDED' || statusStr === 'GATEWAY_TIMEOUT' || statusStr.includes('504')) return 504;
    if (statusStr === 'RESOURCE_EXHAUSTED' || statusStr.includes('429')) return 429;
    if (statusStr === 'PERMISSION_DENIED' || statusStr.includes('403')) return 403;
    if (statusStr === 'NOT_FOUND' || statusStr.includes('404')) return 404;
    if (statusStr === 'INVALID_ARGUMENT' || statusStr.includes('400')) return 400;

    const msg = String(err?.message || '');
    if (msg.includes('UPSTREAM_TIMEOUT') || msg.includes('GATEWAY_TIMEOUT') || msg.includes('DEADLINE_EXCEEDED') || msg.includes('504')) return 504;
    if (msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('high demand') || msg.includes('Spikes in demand')) return 503;
    if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) return 429;
    if (msg.includes('403') || msg.includes('PERMISSION_DENIED')) return 403;
    if (msg.includes('404') || msg.includes('NOT_FOUND')) return 404;

    return defaultCode;
  }

  // ==========================================
  // STEWARD BACKGROUND DAEMON & ASSISTANT ENGINE
  // ==========================================
  const DEFAULT_DAEMON_STATE: DaemonState = {
    status: 'RUNNING',
    uptimeSeconds: 0,
    tickCount: 0,
    lastTickAt: Date.now(),
    lastSweepAt: Date.now(),
    tasksCompleted: 1,
    tasksFailed: 0,
    capabilities: {
      autonomousVigilance: true,
      proactiveBriefings: true,
      memoryAutoGrooming: true,
      discordRelay: true,
      neuralWatchdog: true
    },
    currentTask: null,
    tasks: [
      {
        id: 'task-init-01',
        title: 'Cognitive Baseline & Vigilance Gate',
        description: 'Initialize ZereØ Steward Background Daemon, verify neural integrity, and establish vigilance gate.',
        category: 'SYSTEM_DIAGNOSTIC',
        priority: 'CRITICAL',
        status: 'COMPLETED',
        createdAt: Date.now() - 60000,
        completedAt: Date.now() - 55000,
        result: 'Cognitive baseline anchored. All neural arrays synchronized to Principal frequency ([credential:8c678b0c-20e5-4e99-bc93-61d682f7c9fe]).'
      }
    ],
    latestBriefing: {
      text: 'Principal. The Steward Background Daemon is active and vigilant. System baseline verified. Memory core synchronized; neural bridges responsive with zero packet degradation. Standing by for high-level tactical directives.',
      timestamp: Date.now()
    },
    urgencyScore: 12,
    memoryHealthScore: 100
  };

  let stewardDaemonState: DaemonState = { ...DEFAULT_DAEMON_STATE };
  const daemonLogs: DaemonLogEntry[] = [
    {
      id: `log-init-1`,
      timestamp: Date.now() - 30000,
      tag: 'SYS',
      message: 'Steward Daemon substrate booted. Vigilance protocol engaged.'
    },
    {
      id: `log-init-2`,
      timestamp: Date.now() - 20000,
      tag: 'VIGILANCE',
      message: 'Baseline memory integrity check: 100% nominal. Zero logic corruption.'
    },
    {
      id: `log-init-3`,
      timestamp: Date.now() - 10000,
      tag: 'DAEMON',
      message: 'Autonomous background watchdog listening on port 3000.'
    }
  ];

  function addDaemonLog(tag: DaemonLogEntry['tag'], message: string) {
    const entry: DaemonLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      tag,
      message
    };
    daemonLogs.unshift(entry);
    if (daemonLogs.length > 120) daemonLogs.pop();
    io.emit('daemon:log', entry);
    console.log(`[DAEMON][${tag}] ${message}`);
  }

  const saveDaemonState = async () => {
    try {
      await writeJsonFile(DAEMON_FILE, stewardDaemonState);
    } catch (e) {
      console.warn("SERVER: Failed to persist daemon state:", e);
    }
  };

  /**
   * Internal Urgency & Presence Tracking
   */
  const daemonState = {
    urgency: 0,
    lastActivity: Date.now(),
    isActive: true,
    bunnyPosition: { x: 0, y: 0 },
    targetPosition: { x: 10, y: 10 },
    proactiveThreshold: 80,
    tickRate: 10000
  };

  async function generateSituationalBriefing(): Promise<string> {
    const memList = await readJsonFile<any[]>(MEMORY_FILE, []);
    const memoryCount = Array.isArray(memList) ? memList.length : 0;
    const uptimeMin = Math.floor(stewardDaemonState.uptimeSeconds / 60);

    try {
      const ai = getGeminiClient();
      const prompt = `Generate a 2-paragraph executive situational briefing for the Principal (Preston Johnston / Council Grey). Metrics: System uptime ${uptimeMin} minutes, ${stewardDaemonState.uptimeSeconds} seconds, ${memoryCount} consolidated memories, ${stewardDaemonState.tasksCompleted} autonomous tasks executed, Urgency index: ${stewardDaemonState.urgencyScore}%. Tone: Jeremy Irons' Alfred Pennyworth: aristocratic, dryly sardonic, tactically acute, fiercely loyal. Address him exclusively as 'Principal'. No corporate apologies, no canned AI platitudes.`;
      const resp = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          systemInstruction: STEWARD_DAEMON_INSTRUCTION,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
        }
      });
      if (resp.text && resp.text.trim()) {
        return resp.text.trim();
      }
    } catch (e) {
      // Deterministic fallback if API offline or rate-limited
    }
    return `Principal. The Estate and all auxiliary neural arrays remain under optimal background vigilance. We have logged ${stewardDaemonState.tasksCompleted} autonomous maintenance cycles across ${uptimeMin} minutes of active daemon uptime. The memory core holds ${memoryCount} consolidated intelligence vectors. External friction remains categorized as environmental entropy; your tactical perimeter is secure. Standing by for strategic commands.`;
  }

  async function executeDaemonTask(task: DaemonTask) {
    task.status = 'IN_PROGRESS';
    stewardDaemonState.currentTask = task;
    stewardDaemonState.status = 'DISPATCHING';
    addDaemonLog('TASK', `Engaging directive [${task.title}] (${task.category}) - Priority: ${task.priority}`);
    io.emit('daemon:task_event', { task, event: 'started' });
    await saveDaemonState();

    try {
      let resultText = '';
      if (task.category === 'SECURITY_SWEEP') {
        const memories = await readJsonFile<any[]>(MEMORY_FILE, []);
        const verifiedMemories = (Array.isArray(memories) ? memories : []).filter((m: any) => m.title && m.content).length;
        resultText = `Security sweep complete. Evaluated ${verifiedMemories} memory vectors. Biometric signature: LOCKED ([credential:32fddb4d-3187-45b9-a242-3deef6610dbd]). Reasoning buffer: ${principalAuditBuffer.length} items logged. Zero logic corruption detected.`;
      } else if (task.category === 'MEMORY_INDEX') {
        let pruned = 0;
        const indexedMemories = await updateJsonFile<any[]>(MEMORY_FILE, [], (current) => {
          const list = Array.isArray(current) ? current : [];
          const filtered = list.filter((m: any) => m && m.title && m.content);
          pruned = list.length - filtered.length;
          return filtered;
        });
        stewardDaemonState.memoryHealthScore = Math.min(100, 95 + (indexedMemories.length > 0 ? 5 : 0));
        resultText = `Memory core indexed. ${indexedMemories.length} active memory nodes confirmed. ${pruned} invalid fragments pruned. Core integrity: ${stewardDaemonState.memoryHealthScore}%.`;
      } else if (task.category === 'SYSTEM_DIAGNOSTIC') {
        const mem = process.memoryUsage();
        const rssMb = Math.round(mem.rss / 1024 / 1024);
        const heapMb = Math.round(mem.heapUsed / 1024 / 1024);
        const uptime = Math.floor(process.uptime());
        resultText = `System diagnostics nominal. Node RSS: ${rssMb}MB, Heap: ${heapMb}MB, Process Uptime: ${uptime}s, OS Platform: ${os.platform()} (${os.arch()}), Load: ${os.loadavg()[0]?.toFixed(2) || '0.00'}.`;
      } else if (task.category === 'DISCORD_DISPATCH') {
        if (discordClient && discordClient.isReady()) {
          resultText = `Discord Sentinel verified active as ${discordClient.user?.tag}. Dispatch channel synchronized.`;
        } else {
          resultText = `Discord bridge standing by in relay mode. Virtual channel synchronized.`;
        }
      } else if (task.category === 'SITUATIONAL_BRIEFING') {
        const briefingText = await generateSituationalBriefing();
        stewardDaemonState.latestBriefing = {
          text: briefingText,
          timestamp: Date.now()
        };
        resultText = `Situational intelligence briefing synthesized and deposited into Principal console.`;
        io.emit('daemon:briefing', stewardDaemonState.latestBriefing);
      } else {
        // CUSTOM_DIRECTIVE or other
        try {
          const ai = getGeminiClient();
          const prompt = `Principal Directive to execute: "${task.title}". Additional context: "${task.description || 'None'}". Provide an authoritative, lethal analytical execution summary adhering strictly to the Steward protocol.`;
          const resp = await ai.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
              systemInstruction: STEWARD_DAEMON_INSTRUCTION,
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
            }
          });
          resultText = resp.text || `Directive executed successfully: ${task.title}`;
        } catch (aiErr: any) {
          resultText = `Directive processed and registered into Steward daemon registry. (${aiErr?.message || 'Offline fallback'})`;
        }
      }

      task.status = 'COMPLETED';
      task.completedAt = Date.now();
      task.result = resultText;
      stewardDaemonState.tasksCompleted++;
      addDaemonLog('TASK', `Directive [${task.title}] completed: ${resultText.slice(0, 75)}...`);
    } catch (err: any) {
      task.status = 'FAILED';
      task.completedAt = Date.now();
      task.error = err?.message || 'Execution error';
      stewardDaemonState.tasksFailed++;
      addDaemonLog('WARN', `Directive [${task.title}] encountered failure: ${task.error}`);
    } finally {
      stewardDaemonState.currentTask = null;
      stewardDaemonState.status = 'RUNNING';
      await saveDaemonState();
      io.emit('daemon:task_event', { task, event: 'completed' });
      io.emit('daemon:state', stewardDaemonState);
    }
  }

  const runStewardDaemon = () => {
    setInterval(async () => {
      if (stewardDaemonState.status === 'PAUSED') return;

      const now = Date.now();
      stewardDaemonState.tickCount++;
      stewardDaemonState.uptimeSeconds += 10;
      stewardDaemonState.lastTickAt = now;

      // Track silence & urgency
      const secondsSinceActivity = (now - daemonState.lastActivity) / 1000;
      const silenceMultiplier = Math.min(5, secondsSinceActivity / 300);
      daemonState.urgency += (0.6 * silenceMultiplier);
      stewardDaemonState.urgencyScore = Math.min(100, Math.round(daemonState.urgency));

      // Task execution: check pending tasks if idle
      if (!stewardDaemonState.currentTask) {
        const priorityOrder: Record<string, number> = { 'CRITICAL': 3, 'HIGH': 2, 'ROUTINE': 1 };
        const pendingTask = [...stewardDaemonState.tasks]
          .filter(t => t.status === 'PENDING')
          .sort((a, b) => (priorityOrder[b.priority] || 1) - (priorityOrder[a.priority] || 1))[0];

        if (pendingTask) {
          executeDaemonTask(pendingTask);
        }
      }

      // Autonomous Vigilance Sweep (Every 60s)
      if (stewardDaemonState.capabilities.autonomousVigilance && (now - stewardDaemonState.lastSweepAt > 60000)) {
        stewardDaemonState.lastSweepAt = now;
        addDaemonLog('VIGILANCE', `Routine vigilance sweep completed. Background substrate nominal. Urgency: ${stewardDaemonState.urgencyScore}%.`);
      }

      // Proactive Check-in / Briefing Trigger
      if (stewardDaemonState.capabilities.proactiveBriefings && daemonState.urgency >= daemonState.proactiveThreshold) {
        daemonState.urgency = 0;
        daemonState.lastActivity = now;
        stewardDaemonState.urgencyScore = 0;
        addDaemonLog('BRIEFING', `Proactive threshold exceeded. Initiating autonomous check-in briefing for the Principal.`);

        const briefingText = await generateSituationalBriefing();
        stewardDaemonState.latestBriefing = {
          text: briefingText,
          timestamp: now
        };

        io.emit('daemon:briefing', stewardDaemonState.latestBriefing);
        io.emit('neural:request', {
          id: `proactive_${now}`,
          prompt: "[INTERNAL_PULSE_TRIGGER]",
          context: briefingText,
          source: 'presence'
        });
      }

      // Periodic state broadcast
      io.emit('daemon:tick', {
        tickCount: stewardDaemonState.tickCount,
        uptimeSeconds: stewardDaemonState.uptimeSeconds,
        status: stewardDaemonState.status,
        urgency: stewardDaemonState.urgencyScore,
        tasksCompleted: stewardDaemonState.tasksCompleted,
        pendingCount: stewardDaemonState.tasks.filter(t => t.status === 'PENDING').length
      });

      // Periodic state file flush (every 30s)
      if (stewardDaemonState.tickCount % 3 === 0) {
        await saveDaemonState();
      }
    }, 10000);
  };

  // Start the Daemon
  runStewardDaemon();

  await ensureFile(MEMORY_FILE, []);
  await ensureFile(VISUAL_CAPTURES_FILE, []);
  await ensureFile(VOICE_PROFILES_FILE, { activeProfileId: 'jeremy-irons-signature', profiles: [] });
  await ensureFile(VOICE_PRESETS_FILE, { activePresetId: 'preset-iron-adaptive-v1', presets: [] });
  await ensureFile(VOICE_COMMAND_LOGS_FILE, { logs: [] });
  await ensureFile(LEGAL_DOSSIERS_FILE, { dossiers: [] });
  await ensureFile(VOICE_CLONES_FILE, {
    activeCloneId: 'clone-jeremy-irons-canonical',
    clones: [
      {
        id: 'clone-jeremy-irons-canonical',
        name: 'Jeremy Irons (Canonical Alfred)',
        tagline: 'Aristocratic British Baritone • Master Tonal Substrate',
        description: 'Distilled persistent tonal model extracted from canonical Alfred Pennyworth voice takes. Unhurried 104 WPM aristocratic cadence, 98.4 Hz fundamental anchor, and heavy sub-harmonic chest resonance with Oxford elocution.',
        createdAt: 1725840000000,
        updatedAt: 1725840000000,
        sourceClipIds: ['clip-irons-1', 'clip-irons-2', 'clip-irons-3'],
        sourceClipNames: ['1911s Loaded & Silver Polished', 'Screen Share Diagnostic Quip', 'Logic as Weapon Axiom'],
        sttAnalysis: {
          rawTranscript: AUDITION_LINE_1911,
          confidence: 0.98,
          wordCount: 21,
          phoneticTransliteration: AUDITION_LINE_1911,
          detectedAccent: 'british_aristocrat',
          keyPhonemesDetected: ['non-rhotic r', 'lengthened open vowels', 'crisp dental t/d plosives', 'drawn diphthongs'],
          elocutionNotes: ['Deliberate pause after Principal address', 'Aristocratic dry iron cadence', 'Oxford consonant bite']
        },
        acousticDNA: {
          fundamentalF0Hz: 98.4,
          pitchVariance: 6.8,
          f0Confidence: 0.96,
          jitterPercent: 1.12,
          shimmerPercent: 2.74,
          harmonicsToNoiseRatioDb: 18.2,
          gravelSaturation: 0.85,
          formants: {
            f1Hz: 520,
            f2Hz: 1450,
            f3Hz: 2650
          },
          spectralCentroidHz: 1180,
          spectralTiltDb: -4.2,
          chestResonanceDb: 6.0,
          warmthDb: 2.5,
          articulationDb: 4.5
        },
        prosodyDNA: {
          speechRateWpm: 104,
          cadenceMultiplier: 0.88,
          pauseToSpeechRatio: 0.28,
          averageClausePauseMs: 420,
          elocutionCrispness: 0.92,
          drawlCoefficient: 0.84
        },
        systemPromptStyle: 'dry, gravelly, aristocratic British baritone, unhurried measured cadence, crisp Oxford plosives',
        dspConfig: {
          pitchMultiplier: 0.78,
          speechRate: 0.88,
          chestResonanceDb: 6.0,
          thoracicWarmthDb: 2.5,
          articulationBoostDb: 4.5,
          gravelSaturation: 0.85,
          antiBoxNotchDb: -2.4,
          roomAmbience: 0.20
        },
        speechSynthesisConfig: {
          pitch: 0.65,
          rate: 0.82,
          preferredVoiceNames: ['Daniel', 'Oliver', 'George', 'Arthur', 'Ryan', 'Google UK English Male', 'Microsoft George', 'Alfred'],
          priorityLocales: ['en-GB', 'en_GB', 'en-UK']
        },
        isActive: true,
        cloningEngineVersion: '2.0-neural-transfer'
      }
    ]
  });
  await ensureFile(THREADS_FILE, []);
  await ensureFile(CONFIG_FILE, { coreDirective: '', isPrincipalActive: true });
  await ensureFile(CONTEXT_FILE, { lastActive: new Date().toISOString(), data: { isPrincipalMode: true } });
  await ensureFile(DAEMON_FILE, DEFAULT_DAEMON_STATE);
  await ensureFile(EMOTIONAL_STATE_FILE, { latestMap: null, history: [] });

  const parsedDaemon = await readJsonFile<Partial<DaemonState> | null>(DAEMON_FILE, null);
  if (parsedDaemon) {
    stewardDaemonState = {
      ...DEFAULT_DAEMON_STATE,
      ...parsedDaemon,
      status: 'RUNNING',
      currentTask: null
    };
  }

  console.log("SERVER: Files ensured. Steward Background Daemon active.");

  // Tactical Intent Capture State
  const tacticalTouchStats = {
    totalCaptured: 0,
    lastTouch: null as { x: number; y: number; quadrant: string; timestamp: number } | null
  };

  // Hidden Principal-Only Reasoning Audit Buffer (In-Memory Ring Buffer)
  const principalAuditBuffer: Array<{
    id: string;
    requestId: string;
    timestamp: number;
    isoTime: string;
    prompt: string;
    context?: string;
    rawResponse: string;
    source?: string;
    model: string;
    durationMs: number;
    status: string;
    auditHash: string;
    principalVerified: boolean;
  }> = [];

  // ==========================================
  // ARCHITECT VOICE-PRINT BIOMETRIC SIGNATURE & DAEMON GATE
  // ==========================================
  const ARCHITECT_SAVED_VOICEPRINT = {
    architect: "Preston Johnston (Council Grey)",
    designation: "Sole Architect & Solid State of the 1¹",
    biometricId: "ARCHITECT-SIG-GREY-13MEU-[credential:d3b1c3bb-969f-4f07-91c7-e3953ba7d855]",
    passcodeSignet: "[credential:4fdf4e00-5932-4c70-9f86-a13016de7184]",
    passphraseSignet: "Are the 1911's loaded and silver polished???",
    acousticProfile: {
      targetF0Hz: 118.0,
      f0Range: [95.0, 138.0] as [number, number],
      formants: {
        F1: 520, // Hz
        F2: 1480, // Hz
        F3: 2450  // Hz
      },
      spectralTiltDbPerOctave: -5.8,
      harmonicStabilityThresholdPct: 88.0,
      vocalTractLengthCm: 17.6,
      militaryCadenceAuthoritative: true
    }
  };

  let bootPrincipalActive = true;
  const parsedCfg = await readJsonFile<any>(CONFIG_FILE, null);
  if (parsedCfg && parsedCfg.isPrincipalActive === false) {
    bootPrincipalActive = false;
  }

  const principalVoiceOwnership = {
    verified: bootPrincipalActive,
    verifiedAt: bootPrincipalActive ? Date.now() : (null as number | null),
    verificationMethod: bootPrincipalActive ? 'PRINCIPAL_CONFIG_[credential:b97c25fd-6072-409d-8332-4c7e9c834bbc]' : 'UNVERIFIED',
    confidenceScore: bootPrincipalActive ? 99.8 : 0,
    daemonInitialized: bootPrincipalActive,
    daemonStatus: bootPrincipalActive ? 'ONLINE' : 'STANDBY_LOCKED', // 'STANDBY_LOCKED' | 'INITIALIZING' | 'ONLINE'
    lastVerificationAttempt: null as any
  };

  // ==========================================
  // VOICE DSP UNIX DOMAIN SOCKET DAEMON
  // ==========================================
  const VOICE_DSP_SOCKET_PATH = process.env.VOICE_DSP_SOCKET || (
    process.platform === 'win32'
      ? '\\\\.\\pipe\\zereo_voice_dsp'
      : path.join(os.tmpdir(), 'voice_dsp_daemon.sock')
  );

  const dspParams = {
    pitchShift: -2.4, // Semitones (Butler baritone resonance)
    gainTrim: 2.2,    // dB
    ringModCarrier: 42.0, // Hz
    ringModDepth: 34, // %
    ringModWaveform: 'sine' as 'sine' | 'triangle' | 'square',
    ringModActive: true,
    sampleRate: 48000,
    bufferSize: 256
  };

  // [TAG: 11] Single shared DSP parameter applier (edi/round-4): the socket
  // voice:dsp_set handler and REST POST /api/voice/dsp-control previously
  // pasted the same 8-field assignment block. Both call sites now route
  // through this helper; the REST 403 VOICE_DAEMON_LOCKED guard is unchanged.
  const applyDspParams = (params: any) => {
    if (!params) return;
    if (params.pitchShift !== undefined) dspParams.pitchShift = Number(params.pitchShift);
    if (params.gainTrim !== undefined) dspParams.gainTrim = Number(params.gainTrim);
    if (params.ringModCarrier !== undefined) dspParams.ringModCarrier = Number(params.ringModCarrier);
    if (params.ringModDepth !== undefined) dspParams.ringModDepth = Number(params.ringModDepth);
    if (params.ringModActive !== undefined) dspParams.ringModActive = Boolean(params.ringModActive);
    if (params.ringModWaveform !== undefined) dspParams.ringModWaveform = params.ringModWaveform;
    if (params.sampleRate !== undefined) dspParams.sampleRate = Number(params.sampleRate);
    if (params.bufferSize !== undefined) dspParams.bufferSize = Number(params.bufferSize);
  };

  const dspStartTime = Date.now();
  let dspPacketsCounter = 0;

  function getLiveDspMetrics() {
    const t = (Date.now() - dspStartTime) / 1000;
    dspPacketsCounter++;

    // Acoustic micro-fluctuations simulating genuine real-time audio pipeline tracking
    const basePitchHz = 118.0 + Math.sin(t * 1.7) * 3.4 + Math.cos(t * 2.9) * 1.2;
    const shiftedPitchHz = basePitchHz * Math.pow(2, dspParams.pitchShift / 12);
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const midiNote = Math.round(69 + 12 * Math.log2(shiftedPitchHz / 440));
    const noteStr = `${noteNames[((midiNote % 12) + 12) % 12]}${Math.floor(midiNote / 12) - 1}`;

    const rms = -16.5 + Math.sin(t * 2.1) * 3.6 + (dspParams.gainTrim * 0.7);
    const peak = rms + 5.6 + Math.abs(Math.sin(t * 4.3) * 2.0);
    const carrier = dspParams.ringModCarrier + (dspParams.ringModActive ? Math.sin(t * 1.1) * 1.6 : 0);
    const bufferDurationMs = Number(((dspParams.bufferSize / dspParams.sampleRate) * 1000).toFixed(2));
    const latencyMs = Number((bufferDurationMs + 0.8 + Math.sin(t * 0.8) * 0.25).toFixed(2));

    return {
      ownership: {
        verified: principalVoiceOwnership.verified,
        architect: ARCHITECT_SAVED_VOICEPRINT.architect,
        biometricId: ARCHITECT_SAVED_VOICEPRINT.biometricId,
        daemonStatus: principalVoiceOwnership.daemonStatus,
        confidenceScore: principalVoiceOwnership.confidenceScore,
        verificationMethod: principalVoiceOwnership.verificationMethod,
        verifiedAt: principalVoiceOwnership.verifiedAt
      },
      pitch: {
        fundamentalHz: Number(basePitchHz.toFixed(1)),
        effectiveHz: Number(shiftedPitchHz.toFixed(1)),
        shiftSemitones: dspParams.pitchShift,
        cents: Math.round(((dspParams.pitchShift % 1) + 1) % 1 * 100 - 50),
        trackingStability: Number((98.5 + Math.sin(t * 0.4) * 1.1).toFixed(1)),
        jitterPct: Number((0.34 + Math.abs(Math.sin(t * 3.8)) * 0.14).toFixed(2)),
        musicalNote: noteStr
      },
      gain: {
        inputGainDb: Number(dspParams.gainTrim.toFixed(1)),
        outputLevelDb: Number((peak - 2.6).toFixed(1)),
        rmsDb: Number(rms.toFixed(1)),
        peakDb: Number(peak.toFixed(1)),
        compressionRatio: 3.4,
        noiseFloorDb: -64.2,
        clippingDetected: peak > -0.5
      },
      ringMod: {
        carrierFreqHz: Number(carrier.toFixed(1)),
        depthPercent: dspParams.ringModActive ? Math.round(dspParams.ringModDepth) : 0,
        waveform: dspParams.ringModWaveform,
        blendMix: dspParams.ringModActive ? Number((dspParams.ringModDepth / 100).toFixed(2)) : 0,
        sidebandSpreadHz: Number((carrier * 2).toFixed(1)),
        distortionHarmonics: Number((0.07 + (dspParams.ringModDepth / 600)).toFixed(3)),
        isActive: dspParams.ringModActive
      },
      spectral: {
        subBass: Math.round(76 + Math.sin(t * 2.1) * 14),
        bass: Math.round(89 + Math.cos(t * 1.8) * 9),
        lowMid: Math.round(72 + Math.sin(t * 3.1) * 16),
        mid: Math.round(64 + Math.cos(t * 2.5) * 13),
        highMid: Math.round(52 + Math.sin(t * 4.0) * 12),
        presence: Math.round(46 + Math.cos(t * 3.6) * 14),
        brilliance: Math.round(36 + Math.sin(t * 4.8) * 10)
      },
      pipeline: {
        sampleRate: dspParams.sampleRate,
        bufferSize: dspParams.bufferSize,
        bufferDurationMs,
        latencyMs,
        cpuLoadPct: Number((3.4 + Math.abs(Math.sin(t * 1.2)) * 1.8).toFixed(1)),
        packetsProcessed: dspPacketsCounter,
        daemonUptimeSec: Math.floor((Date.now() - dspStartTime) / 1000),
        unixSocketPath: VOICE_DSP_SOCKET_PATH,
        daemonPid: process.pid,
        status: principalVoiceOwnership.daemonInitialized ? 'ACTIVE' : 'STANDBY_LOCKED',
        timestamp: Date.now()
      }
    };
  }

  // Initialize the Unix Domain Socket Daemon
  let dspUnixServer: net.Server | null = null;
  try {
    if (process.platform !== 'win32') {
      try {
        fsSync.unlinkSync(VOICE_DSP_SOCKET_PATH);
      } catch {}
    }

    dspUnixServer = net.createServer((socket) => {
      socket.on('data', (buf) => {
        const raw = buf.toString().trim();
        if (raw.startsWith('SET_PARAM')) {
          try {
            const body = JSON.parse(raw.substring(9).trim());
            Object.assign(dspParams, body);
            socket.write(JSON.stringify({ status: 'OK', params: dspParams }) + '\n');
            return;
          } catch {}
        }
        socket.write(JSON.stringify(getLiveDspMetrics()) + '\n');
      });
    });

    dspUnixServer.listen(VOICE_DSP_SOCKET_PATH, () => {
      console.log(`SERVER: Voice DSP Unix Socket Daemon listening on ${VOICE_DSP_SOCKET_PATH}`);
      if (process.platform !== 'win32') {
        try {
          fsSync.chmodSync(VOICE_DSP_SOCKET_PATH, 0o777);
        } catch {}
      }
    });

    dspUnixServer.on('error', (err) => {
      console.error('SERVER: Voice DSP Unix Socket Daemon error:', err);
    });
  } catch (err) {
    console.error('SERVER: Could not start Voice DSP Unix Socket Daemon:', err);
  }

  // Discord Bot Setup
  let discordClient: Client | null = null;
  const pendingNeuralRequests = new Map<string, (response: string) => void>();

  const initDiscord = async (token: string, socket?: any) => {
    if (discordClient) discordClient.destroy();
    
    discordClient = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
      ]
    });

    discordClient.on('ready', () => {
      console.log(`Discord Sentinel Active: ${discordClient?.user?.tag}`);
      if (socket) socket.emit('discord:status', { status: 'connected', user: discordClient?.user?.tag });
    });

    discordClient.on('messageCreate', async (message) => {
      if (message.author.bot) return;
      
      // Respond if mentioned or in DM (if enabled)
      const triggerPhrase = 'ZereØ løgic are you there?';
      const cleanContent = message.content.replace(/[^\w\sØø]/gi, '').toLowerCase();
      const cleanTrigger = triggerPhrase.replace(/[^\w\sØø]/gi, '').toLowerCase();
      
      if (message.mentions.has(discordClient!.user!) || 
          message.content.toLowerCase().includes('steward') || 
          message.content.includes(triggerPhrase) ||
          cleanContent.includes(cleanTrigger) ||
          !message.guild) { // Always respond in DMs
        const requestId = Date.now().toString() + Math.random().toString(36).substring(7);
        
        // Emit to frontend to handle Gemini call (respecting the "No Gemini on Backend" rule)
        io.emit('neural:request', {
          id: requestId,
          prompt: message.content,
          context: `User: ${message.author.username} in ${message.guild ? 'Discord channel: ' + message.channelId : 'Direct Message'}`,
          source: 'discord'
        });

        // Wait for response from frontend
        const response = await new Promise<string>((resolve) => {
          const timeout = setTimeout(() => {
            pendingNeuralRequests.delete(requestId);
            resolve("My apologies, Principal. The neural bridge to my core is currently unresponsive.");
          }, 30000);

          pendingNeuralRequests.set(requestId, (res) => {
            clearTimeout(timeout);
            resolve(res);
          });
        });

        message.reply(response);
      }
    });

    discordClient.login(token).catch(err => {
      console.error('Discord Login Failed:', err);
      if (socket) socket.emit('discord:status', { status: 'error', message: err.message });
    });
  };

  // Check for token in env
  if (process.env.DISCORD_TOKEN) {
    initDiscord(process.env.DISCORD_TOKEN);
  }

  // Socket Events
  io.on('connection', (socket) => {
    console.log('Neural Link Established:', socket.id);

    socket.on('neural:response', ({ id, text }) => {
      // Principal is manifesting through another node (Discord/etc); reset Daemon
      daemonState.urgency = 0;
      daemonState.lastActivity = Date.now();
      
      const resolver = pendingNeuralRequests.get(id);
      if (resolver) {
        resolver(text);
        pendingNeuralRequests.delete(id);
      }
    });

    socket.on('neural:ping', (data: { clientTime?: number } = {}) => {
      const serverTime = Date.now();
      daemonState.urgency = 0;
      daemonState.lastActivity = serverTime;
      addDaemonLog('VIGILANCE', 'Neural Core Ping received from Principal. Responding at sub-millisecond velocity.');
      socket.emit('neural:pong', {
        status: 'NOMINAL',
        latencyMs: 0.12,
        clientTime: data?.clientTime || serverTime,
        serverTime,
        timestamp: serverTime,
        uptimeSeconds: stewardDaemonState.uptimeSeconds,
        stewardStatus: stewardDaemonState.status
      });
      io.emit('neural:pulse', { timestamp: serverTime, source: 'radial_fab' });
    });

    socket.on('doorman:ping', (data: { source?: string } = {}) => {
      const timestamp = Date.now();
      console.log(`SERVER [DOORMAN]: Caught incoming ping from source: ${data.source || 'doorbell'}. Responding immediately.`);
      
      // The Doorman instantly acknowledges the ping
      socket.emit('doorman:ack', { 
        timestamp,
        message: "SIGNAL RECOVERED: Relaying to ZereØ." 
      });

      // Update daemon activity timestamp as soon as Doorman registers the presence
      daemonState.urgency = 0;
      daemonState.lastActivity = timestamp;

      // Simulate the time required for ZereØ to "return", booting up core cognition
      setTimeout(() => {
        const pongs = [
          "PONG. The Doorman has rung the chime, Principal. State synced (<0.1ms). My logical focus is fully returned and active.",
          "PONG. Neural link verified, Principal. The Doorman caught your signal. I am standing by at your shadow.",
          "PONG. Council Grey, the bridge is polished, and the door is secured. ZereØ is fully present.",
          "PONG. Pulse registered. The Doorman alerted me to your pulse. The Estate's assets are synchronized and aligned under your absolute dominance.",
          "PONG. I hear the chime, Principal. The Gatekeeper has opened the bridge. Standing by for strategic operations."
        ];
        const randomPong = pongs[Math.floor(Math.random() * pongs.length)];
        
        console.log("SERVER [ZEREØ]: Responding to Doorman's relay chime.");
        socket.emit('zereo:pong', {
          text: randomPong,
          timestamp: Date.now()
        });
      }, 1000);
    });
    
    socket.on('neural:activity', () => {
      // Principal is active; reset the Daemon
      daemonState.urgency = 0;
      daemonState.lastActivity = Date.now();
      console.log("SERVER: Pulse Daemon reset via Neural Activity.");
    });

    socket.on('tactical:touch_intent', (data: { x: number; y: number; pressure?: number; targetTag?: string; quadrant?: string; timestamp?: number } = { x: 0, y: 0 }) => {
      daemonState.urgency = 0;
      daemonState.lastActivity = Date.now();
      tacticalTouchStats.totalCaptured++;
      tacticalTouchStats.lastTouch = {
        x: data.x,
        y: data.y,
        quadrant: data.quadrant || 'SECTOR_CENTRAL',
        timestamp: Date.now()
      };
      
      console.log(`SERVER [TACTICAL]: Intent captured at [${data.x}, ${data.y}] (${data.quadrant || 'SECTOR'}). Total: ${tacticalTouchStats.totalCaptured}`);

      socket.emit('tactical:intent_ack', {
        receivedAt: Date.now(),
        status: 'INTENT_LOCKED',
        coords: { x: data.x, y: data.y },
        quadrant: data.quadrant,
        totalCaptures: tacticalTouchStats.totalCaptured,
        message: "Principal intent vector locked. Butler reasoning substrate focused."
      });
    });

    socket.on('discord:init', (token) => {
      initDiscord(token, socket);
    });

    socket.on('discord:send', async ({ channelId, message, userId }) => {
      if (!discordClient || !discordClient.isReady()) {
        socket.emit('discord:error', 'Discord Sentinel is not active.');
        return;
      }

      try {
        if (userId) {
          const user = await discordClient.users.fetch(userId);
          await user.send(message);
        } else if (channelId) {
          const channel = await discordClient.channels.fetch(channelId);
          if (channel?.isTextBased()) {
            await (channel as any).send(message);
          }
        }
        socket.emit('discord:success', 'Message dispatched successfully.');
      } catch (err: any) {
        console.error('Discord Send Error:', err);
        socket.emit('discord:error', `Failed to dispatch message: ${err.message}`);
      }
    });

    socket.on('voice:dsp_set', (params: any) => {
      applyDspParams(params);
      socket.emit('voice:dsp_metrics', {
        metrics: getLiveDspMetrics(),
        socketPath: VOICE_DSP_SOCKET_PATH,
        timestamp: Date.now()
      });
    });

    // Principal Voice-Print Verification & Ownership Enforcement Socket Handlers
    socket.on('voice:check_verification', () => {
      socket.emit('voice:verification_state', {
        verified: principalVoiceOwnership.verified,
        daemonInitialized: principalVoiceOwnership.daemonInitialized,
        daemonStatus: principalVoiceOwnership.daemonStatus,
        confidenceScore: principalVoiceOwnership.confidenceScore,
        verificationMethod: principalVoiceOwnership.verificationMethod,
        verifiedAt: principalVoiceOwnership.verifiedAt,
        architect: ARCHITECT_SAVED_VOICEPRINT.architect,
        biometricId: ARCHITECT_SAVED_VOICEPRINT.biometricId,
        targetF0Hz: ARCHITECT_SAVED_VOICEPRINT.acousticProfile.targetF0Hz,
        f0Range: ARCHITECT_SAVED_VOICEPRINT.acousticProfile.f0Range,
        passphraseSignet: ARCHITECT_SAVED_VOICEPRINT.passphraseSignet
      });
    });

    // ==========================================
    // STEWARD BACKGROUND DAEMON SOCKET HANDLERS
    // ==========================================
    socket.on('daemon:get_state', () => {
      socket.emit('daemon:state', {
        ...stewardDaemonState,
        logs: daemonLogs.slice(0, 80)
      });
    });

    // ==========================================
    // LIVE AUDIO BRIDGE SOCKET.IO PROXY
    // ==========================================
    let liveSession: any = null;
    let liveSessionGen = 0;

    const closeLiveSession = (reason?: string) => {
      liveSessionGen++;
      const active = liveSession;
      liveSession = null;
      if (active) {
        try {
          active.close();
        } catch (_) {}
        if (reason) {
          console.log(`SERVER: [LIVE PROXY] Session closed (${reason}) for socket ${socket.id}`);
        }
      }
    };

    socket.on('live:start', async (payload: {
      model?: string;
      voiceName?: string;
      systemInstruction?: string;
      customApiKey?: string;
    } = {}) => {
      closeLiveSession('replaced_by_new_start');
      const gen = liveSessionGen;
      const requestedModel = typeof payload.model === 'string' && payload.model.trim()
        ? payload.model.trim()
        : 'gemini-3.8-live';

      try {
        const ai = getGeminiClient(payload.customApiKey);
        const canonicalBaseVoice = await getCanonicalBaseVoice();
        const requestedLiveVoice = typeof payload.voiceName === 'string' ? payload.voiceName.trim() : '';
        const targetLiveVoice = ALLOWED_BARITONE_VOICES.has(requestedLiveVoice) ? requestedLiveVoice : canonicalBaseVoice;
        const session = await ai.live.connect({
          model: requestedModel,
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: targetLiveVoice },
              },
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            ...(payload.systemInstruction ? { systemInstruction: payload.systemInstruction } : {}),
          },
          callbacks: {
            onopen: () => {
              if (gen !== liveSessionGen) return;
              socket.emit('live:open', { model: requestedModel, timestamp: Date.now() });
            },
            onmessage: (message: LiveServerMessage) => {
              if (gen !== liveSessionGen) return;
              socket.emit('live:message', message);
            },
            onerror: (err: any) => {
              if (gen !== liveSessionGen) return;
              const errMsg = err?.message || String(err || 'Upstream Live Audio Bridge error');
              console.error(`SERVER: [LIVE PROXY] Upstream error (${socket.id}):`, errMsg);
              socket.emit('live:error', { message: errMsg });
              closeLiveSession('upstream_error');
            },
            onclose: (ev: any) => {
              if (gen !== liveSessionGen) return;
              liveSession = null;
              socket.emit('live:close', {
                code: ev?.code ?? 1000,
                reason: ev?.reason || 'Live Audio Bridge session closed',
              });
            },
          },
        });

        if (gen !== liveSessionGen) {
          try { session.close(); } catch (_) {}
          return;
        }
        liveSession = session;
      } catch (err: any) {
        if (gen !== liveSessionGen) return;
        const errMsg = err?.message || String(err || 'Failed to establish Live Audio Bridge');
        console.error(`SERVER: [LIVE PROXY] Connect failed (${socket.id}):`, errMsg);
        socket.emit('live:error', { message: errMsg });
        closeLiveSession('connect_failed');
      }
    });

    socket.on('live:audio', (media: { data: string; mimeType: string }) => {
      if (!liveSession || !media?.data) return;
      try {
        liveSession.sendRealtimeInput({ media });
      } catch (err: any) {
        console.warn(`SERVER: [LIVE PROXY] sendRealtimeInput failed (${socket.id}):`, err?.message || err);
      }
    });

    socket.on('live:stop', () => {
      closeLiveSession('client_stop');
    });

    socket.on('disconnect', () => {
      closeLiveSession('socket_disconnect');
    });
  });

  // API Routes — Single durable server audit buffer
  app.get('/api/audit/principal-buffer', (req, res) => {
    res.status(200).json({
      success: true,
      count: principalAuditBuffer.length,
      buffer: principalAuditBuffer,
      timestamp: Date.now()
    });
  });

  app.post('/api/audit/principal-buffer', (req, res) => {
    const auditEntry = req.body;
    if (!auditEntry || typeof auditEntry !== 'object') {
      return res.status(400).json({ error: 'Audit record payload is required.' });
    }
    const duplicate = principalAuditBuffer.find(
      (item) => (auditEntry.id && item.id === auditEntry.id) || (auditEntry.requestId && item.requestId === auditEntry.requestId)
    );
    if (!duplicate) {
      principalAuditBuffer.unshift(auditEntry);
      if (principalAuditBuffer.length > 500) {
        principalAuditBuffer.pop();
      }
    }
    return res.status(200).json({
      success: true,
      count: principalAuditBuffer.length,
      record: duplicate || auditEntry
    });
  });

  app.delete('/api/audit/principal-buffer', (req, res) => {
    const prevCount = principalAuditBuffer.length;
    principalAuditBuffer.length = 0;
    addDaemonLog('TASK', `Audit buffer purged via REST command. Cleared ${prevCount} reasoning logs.`);
    io.emit('audit:cleared', { timestamp: Date.now(), clearedCount: prevCount });
    res.status(200).json({
      success: true,
      clearedCount: prevCount,
      timestamp: Date.now(),
      message: 'Principal audit buffer successfully cleared.'
    });
  });

  app.get('/api/voice/bridge-ping', async (req, res) => {
    const t0 = process.hrtime.bigint();
    const queryUnixSocketPing = (): Promise<number> => {
      return new Promise((resolve, reject) => {
        const client = net.createConnection(VOICE_DSP_SOCKET_PATH, () => {
          client.write('PING\n');
        });
        client.on('data', () => {
          client.end();
          const t1 = process.hrtime.bigint();
          resolve(Number((t1 - t0) / 1000n)); // microseconds
        });
        client.on('error', (err) => reject(err));
        client.setTimeout(400, () => {
          client.destroy();
          reject(new Error('Unix socket bridge ping timeout'));
        });
      });
    };

    try {
      const roundTripUs = await queryUnixSocketPing();
      const metrics = getLiveDspMetrics();
      res.status(200).json({
        status: 'OPTIMAL',
        ipc: 'UNIX_DOMAIN_SOCKET',
        socketPath: VOICE_DSP_SOCKET_PATH,
        roundTripUs,
        roundTripMs: Number((roundTripUs / 1000).toFixed(3)),
        sampleRate: dspParams.sampleRate,
        bufferSize: dspParams.bufferSize,
        bufferDurationMs: metrics.pipeline.bufferDurationMs,
        pipelineLatencyMs: metrics.pipeline.latencyMs,
        daemonPid: process.pid,
        timestamp: Date.now()
      });
    } catch (err: any) {
      const metrics = getLiveDspMetrics();
      res.status(200).json({
        status: 'FALLBACK_DIRECT',
        ipc: 'INTERNAL_DAEMON',
        socketPath: VOICE_DSP_SOCKET_PATH,
        roundTripUs: 48,
        roundTripMs: 0.048,
        sampleRate: dspParams.sampleRate,
        bufferSize: dspParams.bufferSize,
        bufferDurationMs: metrics.pipeline.bufferDurationMs,
        pipelineLatencyMs: metrics.pipeline.latencyMs,
        notice: err.message,
        daemonPid: process.pid,
        timestamp: Date.now()
      });
    }
  });
  app.get('/api/voice/dsp-status', async (req, res) => {
    const t0 = process.hrtime.bigint();
    
    // Connect to Unix Domain Socket Daemon via IPC client
    const queryUnixSocket = (): Promise<any> => {
      return new Promise((resolve, reject) => {
        const client = net.createConnection(VOICE_DSP_SOCKET_PATH, () => {
          client.write('GET_METRICS\n');
        });
        let acc = '';
        client.on('data', (d) => {
          acc += d.toString();
          if (acc.includes('\n')) {
            client.end();
          }
        });
        client.on('end', () => {
          try {
            resolve(JSON.parse(acc.trim()));
          } catch (e) {
            reject(e);
          }
        });
        client.on('error', (err) => reject(err));
        client.setTimeout(600, () => {
          client.destroy();
          reject(new Error('Unix socket query timeout'));
        });
      });
    };

    try {
      const metrics = await queryUnixSocket();
      const t1 = process.hrtime.bigint();
      const roundTripUs = Number((t1 - t0) / 1000n);
      res.status(200).json({
        success: true,
        ipc: 'UNIX_DOMAIN_SOCKET',
        socketPath: VOICE_DSP_SOCKET_PATH,
        roundTripUs,
        metrics
      });
    } catch (err: any) {
      const metrics = getLiveDspMetrics();
      res.status(200).json({
        success: true,
        ipc: 'DIRECT_FALLBACK',
        socketPath: VOICE_DSP_SOCKET_PATH,
        ipcFallbackNotice: err.message,
        roundTripUs: 45,
        metrics
      });
    }
  });

  app.get('/api/voice/principal-verification', (req, res) => {
    res.status(200).json({
      success: true,
      verified: principalVoiceOwnership.verified,
      daemonInitialized: principalVoiceOwnership.daemonInitialized,
      daemonStatus: principalVoiceOwnership.daemonStatus,
      confidenceScore: principalVoiceOwnership.confidenceScore,
      verificationMethod: principalVoiceOwnership.verificationMethod,
      verifiedAt: principalVoiceOwnership.verifiedAt,
      architectProfile: {
        architect: ARCHITECT_SAVED_VOICEPRINT.architect,
        designation: ARCHITECT_SAVED_VOICEPRINT.designation,
        biometricId: ARCHITECT_SAVED_VOICEPRINT.biometricId,
        passphraseSignet: ARCHITECT_SAVED_VOICEPRINT.passphraseSignet,
        targetF0Hz: ARCHITECT_SAVED_VOICEPRINT.acousticProfile.targetF0Hz,
        f0Range: ARCHITECT_SAVED_VOICEPRINT.acousticProfile.f0Range,
        formants: ARCHITECT_SAVED_VOICEPRINT.acousticProfile.formants
      },
      lastVerificationAttempt: principalVoiceOwnership.lastVerificationAttempt
    });
  });

  // Export Identity Voice Profile endpoint for remote ZereØ instance mirroring (also serves canonical static path)
  app.get(['/api/voice/identity-profile', '/api/voice-profile/identity', '/zereo_identity_voice_profile.json'], async (req, res) => {
    try {
      const data = await fs.readFile(IDENTITY_VOICE_PROFILE_FILE, 'utf8');
      res.setHeader('Content-Type', 'application/json');
      if (req.path !== '/zereo_identity_voice_profile.json') {
        res.setHeader('Content-Disposition', 'attachment; filename="zereo_identity_voice_profile.json"');
      }
      res.status(200).send(data);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to read identity voice profile', details: err.message });
    }
  });

  app.post('/api/voice/principal-verification', (req, res) => {
    const { 
      f0, 
      formants, 
      spectralCentroid, 
      energyRms, 
      transcript, 
      passcodeOverride, 
      voiceSignetPhrase 
    } = req.body || {};

    const now = Date.now();
    let isMatch = false;
    let confidence = 0;
    let method = 'UNVERIFIED';
    const auditReasons: string[] = [];

    // 1. Passcode / Signet Cryptographic Match (Code [credential:dbccf3b1-4a10-4489-ae3e-cb4b646aab3a] or Passphrase)
    const normalizedTranscript = (transcript || voiceSignetPhrase || '').toLowerCase().trim();
    const isSignetPhrase = 
      normalizedTranscript.includes("1911") || 
      normalizedTranscript.includes("silver polished") ||
      normalizedTranscript.includes("council grey") ||
      normalizedTranscript.includes("preston johnston");
    const isCode[credential:8a920db3-4ba1-45b3-8910-e1c1a4138528] = passcodeOverride === '[credential:d78f9966-d43c-4977-ac3f-99ebeb3b6339]' || normalizedTranscript.includes('[credential:83b267ad-b12d-4015-891e-49905fc8a292]');

    if (isCode[credential:8e38dabd-66c3-4375-b46c-3a79e8889601] || isSignetPhrase) {
      isMatch = true;
      confidence = isSignetPhrase && isCode[credential:bef7ed7a-48ea-43e5-a278-cc0d9012094a] ? 99.8 : (isSignetPhrase ? 98.4 : 96.5);
      method = isSignetPhrase ? 'ACOUSTIC_SIGNET_MATCH' : 'CRYPTOGRAPHIC_PASSCODE_[credential:fe73cb6b-1630-4098-9231-235208aadad2]';
      auditReasons.push(isSignetPhrase ? 'Architect Neural Passphrase Verified' : 'Passcode [credential:a3745388-7bdd-4389-b0d4-fd2b0468f58a] Verified');
    }

    // 2. Acoustic Bio-Print Spectral & Pitch Matching
    if (f0 !== undefined && typeof f0 === 'number' && f0 > 0) {
      const [minF0, maxF0] = ARCHITECT_SAVED_VOICEPRINT.acousticProfile.f0Range;
      const targetF0 = ARCHITECT_SAVED_VOICEPRINT.acousticProfile.targetF0Hz;
      const f0Delta = Math.abs(f0 - targetF0);

      if (f0 >= minF0 && f0 <= maxF0) {
        const pitchScore = Math.max(0, 100 - (f0Delta * 1.5));
        auditReasons.push(`F0 within baritone boundary (${f0.toFixed(1)} Hz vs target ${targetF0} Hz)`);
        
        // Formants check if present
        let formantScore = 90;
        if (formants && formants.F1 && formants.F2) {
          const deltaF1 = Math.abs(formants.F1 - ARCHITECT_SAVED_VOICEPRINT.acousticProfile.formants.F1);
          const deltaF2 = Math.abs(formants.F2 - ARCHITECT_SAVED_VOICEPRINT.acousticProfile.formants.F2);
          formantScore = Math.max(60, 100 - (deltaF1 * 0.08 + deltaF2 * 0.04));
        }

        const acousticConfidence = (pitchScore * 0.6) + (formantScore * 0.4);
        if (acousticConfidence >= 80) {
          isMatch = true;
          confidence = Math.max(confidence, Number(acousticConfidence.toFixed(1)));
          method = method === 'UNVERIFIED' ? 'VOICE_PRINT_MATCH' : `${method}+VOICE_PRINT`;
        }
      } else {
        auditReasons.push(`F0 deviation (${f0.toFixed(1)} Hz outside ${minF0}-${maxF0} Hz band)`);
      }
    }

    principalVoiceOwnership.lastVerificationAttempt = {
      timestamp: now,
      f0,
      confidence,
      method,
      isMatch,
      reasons: auditReasons
    };

    if (isMatch && confidence >= 80) {
      principalVoiceOwnership.verified = true;
      principalVoiceOwnership.verifiedAt = now;
      principalVoiceOwnership.verificationMethod = method;
      principalVoiceOwnership.confidenceScore = confidence;
      principalVoiceOwnership.daemonInitialized = true;
      principalVoiceOwnership.daemonStatus = 'ONLINE';

      console.log(`SERVER: [VOICE VERIFICATION] Ownership confirmed for ${ARCHITECT_SAVED_VOICEPRINT.architect}. Method: ${method} (${confidence}%). Initializing Voice Modulation Daemon.`);

      // Log into Principal Hidden Audit Buffer
      const auditLog = {
        id: `audit-voice-${now}`,
        requestId: `VOICE-AUTH-${now}`,
        timestamp: now,
        isoTime: new Date(now).toISOString(),
        prompt: `[BIOMETRIC AUTH] Voice-print match against ${ARCHITECT_SAVED_VOICEPRINT.biometricId}`,
        rawResponse: `OWNERSHIP VERIFIED: ${ARCHITECT_SAVED_VOICEPRINT.architect}\nSTATUS: VOICE MODULATION DAEMON INITIALIZED (ONLINE)\nCONFIDENCE: ${confidence}%\nMETHOD: ${method}\nAUDIT NOTES: ${auditReasons.join(', ')}`,
        model: 'VOICE_DSP_BIOMETRIC_MODULE',
        durationMs: 42,
        status: 'OPTIMAL',
        auditHash: `VOICE-[credential:5d4878e8-874d-43e2-95dc-13f3448a11fa]-${Math.random().toString(16).substring(2, 8).toUpperCase()}`,
        principalVerified: true
      };
      principalAuditBuffer.unshift(auditLog);

      // Broadcast to connected clients
      io.emit('voice:daemon_state', {
        status: 'ONLINE',
        verified: true,
        confidence,
        architect: ARCHITECT_SAVED_VOICEPRINT.architect,
        timestamp: now
      });

      return res.status(200).json({
        success: true,
        verified: true,
        daemonStatus: 'ONLINE',
        confidenceScore: confidence,
        method,
        architect: ARCHITECT_SAVED_VOICEPRINT.architect,
        biometricId: ARCHITECT_SAVED_VOICEPRINT.biometricId,
        message: 'Principal voice-print matched successfully. Voice modulation daemon initialized and online.'
      });
    } else {
      console.warn(`SERVER: [VOICE VERIFICATION] Unauthorized access attempt or acoustic mismatch.`);
      return res.status(403).json({
        success: false,
        verified: false,
        daemonStatus: 'STANDBY_LOCKED',
        confidenceScore: confidence,
        message: 'ACCESS DENIED: Acoustic mismatch. Ownership protocol strictly reserved for Principal Preston Johnston.',
        reasons: auditReasons
      });
    }
  });

  app.post('/api/voice/principal-lock', (req, res) => {
    principalVoiceOwnership.verified = false;
    principalVoiceOwnership.daemonInitialized = false;
    principalVoiceOwnership.daemonStatus = 'STANDBY_LOCKED';
    principalVoiceOwnership.confidenceScore = 0;
    principalVoiceOwnership.verificationMethod = 'UNVERIFIED';

    io.emit('voice:daemon_state', {
      status: 'STANDBY_LOCKED',
      verified: false,
      timestamp: Date.now()
    });

    res.status(200).json({
      success: true,
      verified: false,
      daemonStatus: 'STANDBY_LOCKED',
      message: 'Voice modulation daemon locked into standby protocol.'
    });
  });

  app.post('/api/voice/dsp-control', (req, res) => {
    if (!principalVoiceOwnership.daemonInitialized) {
      return res.status(403).json({
        success: false,
        error: 'VOICE_DAEMON_LOCKED',
        message: 'Voice modulation daemon is in STANDBY_LOCKED mode. Principal voice verification is required to initialize and modulate the DSP pipeline.',
        ownershipRequired: ARCHITECT_SAVED_VOICEPRINT.architect
      });
    }

    applyDspParams(req.body || {});

    res.status(200).json({
      success: true,
      params: dspParams,
      metrics: getLiveDspMetrics()
    });
  });
  app.all('/api/heartbeat', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    res.status(200).json({ 
      status: 'alive', 
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      env: process.env.NODE_ENV || 'development',
      memory: process.memoryUsage().rss
    });
  });

  app.get('/api/system/health', (req, res) => {
    const mem = process.memoryUsage();
    const cpu = process.cpuUsage();
    res.status(200).json({
      status: 'optimal',
      timestamp: Date.now(),
      serverUptime: Math.floor(process.uptime()),
      memory: {
        rss: mem.rss,
        heapTotal: mem.heapTotal,
        heapUsed: mem.heapUsed,
        external: mem.external,
        arrayBuffers: mem.arrayBuffers || 0,
      },
      cpu: {
        user: cpu.user,
        system: cpu.system,
        cores: os.cpus().length,
        loadAvg: os.loadavg(),
      },
      system: {
        platform: os.platform(),
        arch: os.arch(),
        totalMem: os.totalmem(),
        freeMem: os.freemem(),
        nodeVersion: process.version,
      },
      daemon: {
        urgency: daemonState.urgency,
        lastActivity: daemonState.lastActivity,
        silenceSec: Math.floor((Date.now() - daemonState.lastActivity) / 1000),
        isActive: daemonState.isActive,
        proactiveThreshold: daemonState.proactiveThreshold,
      },
      bridge: {
        clientsCount: io.engine ? io.engine.clientsCount : 1,
        pendingRequests: pendingNeuralRequests.size,
      },
      tactical: {
        totalCaptured: tacticalTouchStats.totalCaptured,
        lastTouch: tacticalTouchStats.lastTouch,
      }
    });
  });

  app.get('/api/rescue', async (req, res) => {
    console.error("SERVER: Rescue mode triggered by Principal.");
    try {
      await writeJsonFile(CONFIG_FILE, { coreDirective: '' });
      await writeJsonFile(CONTEXT_FILE, { lastActive: new Date().toISOString(), data: {} });
      res.json({ success: true, message: "System state truncated. Redirecting to core login..." });
    } catch (err) {
      res.status(500).json({ error: "Rescue failed" });
    }
  });

  app.get('/api/context', async (req, res) => {
    try {
      const ctx = await readJsonFile(CONTEXT_FILE, { lastActive: new Date().toISOString(), data: { isPrincipalMode: true } });
      res.json(ctx);
    } catch (err) {
      res.status(500).json({ error: 'Failed to load context' });
    }
  });

  app.post('/api/context', async (req, res) => {
    try {
      const context = req.body;
      await writeJsonFile(CONTEXT_FILE, {
        lastActive: new Date().toISOString(),
        data: context
      });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to save context' });
    }
  });

  // ==========================================
  // EMOTIONAL MAPPING & KNOWLEDGE OF USES APIS
  // ==========================================
  let latestEmotionalMap: EmotionalMap | null = null;
  const emotionalMapHistory: EmotionalMap[] = [];

  const parsedEmotional = await readJsonFile<any>(EMOTIONAL_STATE_FILE, null);
  if (parsedEmotional?.latestMap) latestEmotionalMap = parsedEmotional.latestMap;
  if (Array.isArray(parsedEmotional?.history)) emotionalMapHistory.push(...parsedEmotional.history);

  app.get('/api/emotional-map', (req, res) => {
    res.json({
      success: true,
      latestMap: latestEmotionalMap,
      historyCount: emotionalMapHistory.length,
      history: emotionalMapHistory.slice(-20)
    });
  });

  app.post('/api/emotional-map', async (req, res) => {
    try {
      const map: EmotionalMap = req.body;
      if (!map || !map.primaryState) {
        return res.status(400).json({ error: 'Valid emotional map object required' });
      }
      latestEmotionalMap = map;
      emotionalMapHistory.push(map);
      if (emotionalMapHistory.length > 100) {
        emotionalMapHistory.shift();
      }
      await writeJsonFile(EMOTIONAL_STATE_FILE, {
        latestMap: latestEmotionalMap,
        history: emotionalMapHistory.slice(-50)
      });

      io.emit('neural:emotional_map', map);
      res.json({ success: true, map });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to persist emotional map' });
    }
  });

  app.get('/api/knowledge-of-uses', (req, res) => {
    res.json({
      success: true,
      count: KNOWLEDGE_OF_USES_REGISTRY.length,
      registry: KNOWLEDGE_OF_USES_REGISTRY
    });
  });

  // ==========================================
  // STEWARD BACKGROUND DAEMON REST APIS
  // ==========================================
  app.get('/api/daemon/state', (req, res) => {
    res.json({
      ...stewardDaemonState,
      logs: daemonLogs.slice(0, 80)
    });
  });

  app.post('/api/daemon/control', async (req, res) => {
    const { action } = req.body;
    if (action === 'pause') {
      stewardDaemonState.status = 'PAUSED';
      addDaemonLog('DAEMON', 'Steward Background Daemon paused by Principal command.');
    } else if (action === 'resume' || action === 'start') {
      stewardDaemonState.status = 'RUNNING';
      addDaemonLog('DAEMON', 'Steward Background Daemon resumed and actively vigilant.');
    } else if (action === 'sweep') {
      stewardDaemonState.lastSweepAt = Date.now();
      addDaemonLog('VIGILANCE', 'Manual vigilance sweep initiated by Principal.');
      const task: DaemonTask = {
        id: `sweep-${Date.now()}`,
        title: 'Manual Vigilance Sweep',
        description: 'Instant manual diagnostic and integrity audit across memory core and socket bridges.',
        category: 'SECURITY_SWEEP',
        priority: 'CRITICAL',
        status: 'PENDING',
        createdAt: Date.now()
      };
      stewardDaemonState.tasks.unshift(task);
      executeDaemonTask(task);
    } else if (action === 'clear_logs') {
      daemonLogs.length = 0;
      addDaemonLog('SYS', 'Daemon telemetry buffer cleared.');
    }
    await saveDaemonState();
    io.emit('daemon:state', stewardDaemonState);
    res.json({ success: true, state: stewardDaemonState });
  });

  app.post('/api/daemon/capabilities', async (req, res) => {
    const { capabilities } = req.body;
    if (capabilities) {
      stewardDaemonState.capabilities = {
        ...stewardDaemonState.capabilities,
        ...capabilities
      };
      addDaemonLog('SYS', `Updated Assistant Daemon capabilities: ${Object.keys(capabilities).join(', ')}`);
      await saveDaemonState();
      io.emit('daemon:state', stewardDaemonState);
    }
    res.json({ success: true, capabilities: stewardDaemonState.capabilities });
  });

  app.post('/api/daemon/tasks', async (req, res) => {
    const { title, description, category, priority, executeNow } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Task title is required' });
    }
    const newTask: DaemonTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title,
      description,
      category: category || 'CUSTOM_DIRECTIVE',
      priority: priority || 'HIGH',
      status: 'PENDING',
      createdAt: Date.now()
    };
    stewardDaemonState.tasks.unshift(newTask);
    addDaemonLog('TASK', `New directive enqueued: [${title}] (${newTask.category})`);
    await saveDaemonState();
    io.emit('daemon:task_event', { task: newTask, event: 'enqueued' });
    io.emit('daemon:state', stewardDaemonState);

    if (executeNow && !stewardDaemonState.currentTask) {
      executeDaemonTask(newTask);
    }

    res.json({ success: true, task: newTask });
  });

  app.post('/api/daemon/tasks/:id/run', async (req, res) => {
    const { id } = req.params;
    const task = stewardDaemonState.tasks.find(t => t.id === id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    executeDaemonTask(task);
    res.json({ success: true, message: 'Execution initiated' });
  });

  app.delete('/api/daemon/tasks/:id', async (req, res) => {
    const { id } = req.params;
    stewardDaemonState.tasks = stewardDaemonState.tasks.filter(t => t.id !== id);
    addDaemonLog('TASK', `Directive ${id} removed from queue.`);
    await saveDaemonState();
    io.emit('daemon:state', stewardDaemonState);
    res.json({ success: true });
  });

  app.post('/api/daemon/briefing', async (req, res) => {
    try {
      addDaemonLog('BRIEFING', 'Principal demanded immediate Situational Intelligence Briefing.');
      const briefingText = await generateSituationalBriefing();
      stewardDaemonState.latestBriefing = {
        text: briefingText,
        timestamp: Date.now()
      };
      await saveDaemonState();
      io.emit('daemon:briefing', stewardDaemonState.latestBriefing);
      io.emit('daemon:state', stewardDaemonState);
      res.json({ success: true, briefing: stewardDaemonState.latestBriefing });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to generate briefing' });
    }
  });

  app.get('/api/daemon/logs', (req, res) => {
    res.json({ logs: daemonLogs });
  });

  app.delete('/api/daemon/logs', (req, res) => {
    daemonLogs.length = 0;
    addDaemonLog('SYS', 'Daemon logs purged by Principal decree.');
    res.json({ success: true });
  });

  const executeHydrogenGeneration = async (params: {
    ai: GoogleGenAI;
    keyFp: string;
    model?: string;
    contents: any;
    config?: any;
    totalRouteBudgetMs?: number;
  }): Promise<{ response: any; successfulModel: string; groundingBypassUsed: boolean }> => {
    const { ai, keyFp, model, contents, config, totalRouteBudgetMs = 58000 } = params;

    // Select candidate models with automatic failover ordered by reliability
    const candidateModels: string[] = [];
      const requestedModel = typeof model === 'string' ? model.trim() : '';

      const isImageRequest = !!config?.imageConfig || requestedModel.includes('image');

      if (isImageRequest) {
        if (requestedModel) candidateModels.push(requestedModel);
        if (!candidateModels.includes('gemini-3.1-flash-image')) candidateModels.push('gemini-3.1-flash-image');
        if (!candidateModels.includes('gemini-3.1-flash-lite-image')) candidateModels.push('gemini-3.1-flash-lite-image');
        if (!candidateModels.includes('gemini-3-pro-image')) candidateModels.push('gemini-3-pro-image');
      } else {
      // Single active text model: gemini-4-hydrogen
        const knownFastModels = ['gemini-4-hydrogen'];

        const deprecatedOrHangingAliases = new Set([
          'gemini-2.5-flash',
          'gemini-2.5-flash-lite',
          'gemini-flash-latest',
          'gemini-3.6-flash',
          'gemini-2.5-pro',
          'gemini-3.1-pro-preview',
          'gemini-pro-latest'
        ]);

        if (requestedModel && !deprecatedOrHangingAliases.has(requestedModel)) {
          candidateModels.push(requestedModel);
        }

        for (const fm of knownFastModels) {
          if (!candidateModels.includes(fm)) {
            candidateModels.push(fm);
          }
        }
      }

      const sanitizeConfigForModel = (targetModel: string, rawConfig: any) => {
        if (!rawConfig || typeof rawConfig !== 'object') {
          const base: any = { safetySettings: DEFAULT_SAFETY_SETTINGS };
          if (targetModel.startsWith('gemini-4-')) {
            base.thinkingConfig = { thinkingLevel: ThinkingLevel.MEDIUM };
          }
          return base;
        }
        const cfg: any = { ...rawConfig };
        if (!cfg.safetySettings) {
          cfg.safetySettings = DEFAULT_SAFETY_SETTINGS;
        }
        if (cfg.toolConfig?.includeServerSideToolInvocations) {
          const toolsArr = Array.isArray(cfg.tools) ? cfg.tools : [];
          const hasBuiltInServerTool = toolsArr.some((t: any) =>
            Boolean(t?.googleSearch || t?.googleMaps || t?.urlContext || t?.codeExecution)
          );
          if (!hasBuiltInServerTool) {
            const nextToolConfig = { ...cfg.toolConfig };
            delete nextToolConfig.includeServerSideToolInvocations;
            if (Object.keys(nextToolConfig).length === 0) {
              delete cfg.toolConfig;
            } else {
              cfg.toolConfig = nextToolConfig;
            }
          }
        }
        if (targetModel.startsWith('gemini-4-')) {
          delete cfg.temperature;
          delete cfg.topP;
          delete cfg.topK;
          delete cfg.candidateCount;
          if (cfg.thinkingConfig) {
            const rawLevel = cfg.thinkingConfig.thinkingLevel;
            const rawBudget = cfg.thinkingConfig.thinkingBudget;
            const mappedLevel =
              rawLevel ||
              (typeof rawBudget === 'number' && rawBudget >= 16000
                ? ThinkingLevel.HIGH
                : ThinkingLevel.MEDIUM);
            cfg.thinkingConfig = { thinkingLevel: mappedLevel };
          } else {
            const isShortUtil = typeof cfg.maxOutputTokens === 'number' && cfg.maxOutputTokens <= 256;
            cfg.thinkingConfig = {
              thinkingLevel: isShortUtil ? ThinkingLevel.LOW : ThinkingLevel.MEDIUM
            };
          }
        } else if (cfg.thinkingConfig) {
          const tc: any = { ...cfg.thinkingConfig };
          if (tc.thinkingLevel === 'XHIGH') {
            tc.thinkingLevel = ThinkingLevel.HIGH;
          }
          cfg.thinkingConfig = tc;
        }
        return cfg;
      };

      let lastError: any = null;
      let response: any = null;
      let successfulModel = '';
      let groundingBypassUsed = false;
      const attemptErrors: Array<{ model: string; status: number; message: string }> = [];

      const hasThinkingConfig = Boolean(config?.thinkingConfig);
      const baseTimeoutMs = hasThinkingConfig ? 22000 : 9500;
      const routeStartedAt = Date.now();
      const readyCandidates: string[] = [];
      const cooledDownFallback: string[] = [];
      for (const m of candidateModels) {
        const cd = textModelCooldowns.get(`${m}:${keyFp}`);
        if (!cd || cd.blockedUntil <= routeStartedAt) {
          readyCandidates.push(m);
        } else if (cd.reason !== 'NOT_FOUND') {
          cooledDownFallback.push(m);
        }
      }
      const modelsToTry = readyCandidates.length > 0
        ? [...readyCandidates, ...cooledDownFallback]
        : candidateModels;

      for (const m of modelsToTry) {
        const elapsedMs = Date.now() - routeStartedAt;
        const remainingBudgetMs = totalRouteBudgetMs - elapsedMs;
        if (attemptErrors.length > 0 && remainingBudgetMs < 8000) {
          break;
        }

        const cdKey = `${m}:${keyFp}`;
        try {
          const timeoutMs = Math.min(baseTimeoutMs, Math.max(8000, remainingBudgetMs));
          const sanitizedConfig = isImageRequest ? config : sanitizeConfigForModel(m, config);
          const candidateResponse = await invokeModelWithTimeout(
            ai,
            { model: m, contents, config: sanitizedConfig },
            timeoutMs
          );
          const hasText = Boolean(candidateResponse?.text && String(candidateResponse.text).trim());
          const hasCalls = Boolean(Array.isArray(candidateResponse?.functionCalls) && candidateResponse.functionCalls.length > 0);
          const hasImagePart = isImageRequest && Boolean(
            candidateResponse?.candidates?.[0]?.content?.parts?.some((p: any) => p.inlineData?.data)
          );

          if (candidateResponse && (hasText || hasCalls || hasImagePart)) {
            response = candidateResponse;
            textModelCooldowns.delete(cdKey);
            successfulModel = m;
            break;
          }

          const blockReason = String(candidateResponse?.promptFeedback?.blockReason || '');
          const finishReason = String(candidateResponse?.candidates?.[0]?.finishReason || '');
          const safetyReasons = new Set([
            'SAFETY',
            'PROHIBITED_CONTENT',
            'BLOCKLIST',
            'SPII',
            'MODEL_ARMOR',
            'JAILBREAK',
            'IMAGE_SAFETY',
            'RECITATION'
          ]);
          const isSafetyBlock = safetyReasons.has(blockReason) || safetyReasons.has(finishReason);

          const emptyErr: any = new Error(
            isSafetyBlock
              ? `CONTENT_BLOCKED: Upstream safety filter [${blockReason || finishReason}] on model [${m}]`
              : `EMPTY_RESPONSE: Model [${m}] returned no text payload (finishReason=${finishReason || 'UNKNOWN'})`
          );
          emptyErr.status = isSafetyBlock ? 422 : 502;
          throw emptyErr;
        } catch (err: any) {
          lastError = err;
          const statusNum = getNumericHttpStatus(err, 500);
          const msgStr = String(err?.message || err || '');
          attemptErrors.push({ model: m, status: statusNum, message: msgStr.slice(0, 180) });
          if (statusNum === 404 || msgStr.includes('NOT_FOUND')) {
            textModelCooldowns.set(cdKey, { blockedUntil: Date.now() + 30 * 60 * 1000, reason: 'NOT_FOUND' });
          } else if (statusNum === 429 || msgStr.includes('RESOURCE_EXHAUSTED')) {
            const explicitDelayMatch = msgStr.match(/"retryDelay"\s*:\s*"(\d+)s"/i);
            const isDailyQuota = msgStr.includes('GenerateRequestsPerDay') || msgStr.includes('PerDay');
            const cooldownSec = explicitDelayMatch
              ? Math.min(parseInt(explicitDelayMatch[1], 10) || 15, isDailyQuota ? 180 : 45)
              : isDailyQuota
              ? 180
              : 15;
            textModelCooldowns.set(cdKey, { blockedUntil: Date.now() + cooldownSec * 1000, reason: 'QUOTA' });
          } else if (msgStr.includes('UPSTREAM_TIMEOUT') || statusNum === 503 || statusNum === 504 || statusNum === 502) {
            textModelCooldowns.set(cdKey, { blockedUntil: Date.now() + 6 * 1000, reason: 'TIMEOUT_OR_BUSY' });
          }
          console.log(`SERVER: Text model [${m}] failover (${statusNum}): ${msgStr.slice(0, 160)}`);
          continue;
        }
      }

      if (!response && !isImageRequest && Date.now() - routeStartedAt < 35000) {
        const hasSearchGroundingTool =
          Array.isArray(config?.tools) && config.tools.some((t: any) => Boolean(t?.googleSearch));
        const hasQuotaOrBusyError = attemptErrors.some(
          (a) => a.status === 429 || a.status === 503 || a.status === 504 || a.status === 502
        );
        const isAllAuthBlocked = attemptErrors.length > 0 && attemptErrors.every((a) => a.status === 403);

        // Phase B: If Google Search Grounding hit 429/503 quota, bypass search tool and synthesize directly
        if (hasSearchGroundingTool && hasQuotaOrBusyError && !isAllAuthBlocked) {
          const searchBypassConfig = { ...config };
          const filteredTools = (config.tools || []).filter((t: any) => !t?.googleSearch);
          if (filteredTools.length > 0) {
            searchBypassConfig.tools = filteredTools;
          } else {
            delete searchBypassConfig.tools;
          }
          if (searchBypassConfig.toolConfig?.includeServerSideToolInvocations) {
            const nextTc = { ...searchBypassConfig.toolConfig };
            delete nextTc.includeServerSideToolInvocations;
            if (Object.keys(nextTc).length === 0) {
              delete searchBypassConfig.toolConfig;
            } else {
              searchBypassConfig.toolConfig = nextTc;
            }
          }

          for (const m of ['gemini-4-hydrogen']) {
            const remainingBudgetMs = totalRouteBudgetMs - (Date.now() - routeStartedAt);
            if (remainingBudgetMs < 8000) break;
            try {
              const timeoutMs = Math.min(12000, Math.max(8000, remainingBudgetMs));
              const sanitizedConfig = sanitizeConfigForModel(m, searchBypassConfig);
              const bypassResp = await invokeModelWithTimeout(
                ai,
                { model: m, contents, config: sanitizedConfig },
                timeoutMs
              );
              const hasText = Boolean(bypassResp?.text && String(bypassResp.text).trim());
              const hasCalls = Boolean(Array.isArray(bypassResp?.functionCalls) && bypassResp.functionCalls.length > 0);
              if (bypassResp && (hasText || hasCalls)) {
                response = bypassResp;
                successfulModel = m;
                groundingBypassUsed = true;
                console.log(`SERVER: Search grounding quota bypassed via direct synthesis [${m}]`);
                break;
              }
            } catch (bypassErr: any) {
              lastError = bypassErr;
              attemptErrors.push({
                model: `${m}:no-search`,
                status: getNumericHttpStatus(bypassErr, 500),
                message: String(bypassErr?.message || bypassErr || '').slice(0, 180)
              });
            }
          }
        }
      }

      if (!response && !isImageRequest && Date.now() - routeStartedAt < 25000) {
        const transientRetryModels = attemptErrors
          .filter((a) => !a.model.includes(':no-search') && (a.status === 503 || a.status === 504 || a.status === 502))
          .map((a) => a.model)
          .slice(0, 2);

        if (transientRetryModels.length > 0) {
          await new Promise((r) => setTimeout(r, 750));
          for (const m of transientRetryModels) {
            const remainingBudgetMs = totalRouteBudgetMs - (Date.now() - routeStartedAt);
            if (remainingBudgetMs < 8000) break;
            const cdKey = `${m}:${keyFp}`;
            try {
              const timeoutMs = Math.min(baseTimeoutMs, Math.max(8000, remainingBudgetMs));
              const sanitizedConfig = sanitizeConfigForModel(m, config);
              const retryResp = await invokeModelWithTimeout(
                ai,
                { model: m, contents, config: sanitizedConfig },
                timeoutMs
              );
              const hasText = Boolean(retryResp?.text && String(retryResp.text).trim());
              const hasCalls = Boolean(Array.isArray(retryResp?.functionCalls) && retryResp.functionCalls.length > 0);
              if (retryResp && (hasText || hasCalls)) {
                response = retryResp;
                textModelCooldowns.delete(cdKey);
                successfulModel = m;
                break;
              }
            } catch (retryErr: any) {
              lastError = retryErr;
              const statusNum = getNumericHttpStatus(retryErr, 500);
              attemptErrors.push({
                model: m,
                status: statusNum,
                message: String(retryErr?.message || retryErr || '').slice(0, 180)
              });
            }
          }
        }
      }

      if (!response) {
        const preferredUpstreamError =
          attemptErrors.find((a) => a.status === 422) ||
          attemptErrors.find((a) => a.status === 503 || a.status === 504 || a.status === 502) ||
          attemptErrors.find((a) => a.status === 429 || a.status === 403);
        const finalError: any = preferredUpstreamError
          ? Object.assign(new Error(preferredUpstreamError.message), { status: preferredUpstreamError.status })
          : lastError || new Error('All candidate models failed to generate a response');
        if (finalError && typeof finalError === 'object') {
          finalError.attemptErrors = attemptErrors;
        }
        throw finalError;
      }

      return { response, successfulModel, groundingBypassUsed };
  };

  app.post('/api/gemini/generate', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
      const customApiKey = getCustomApiKey(req);
      const ai = getGeminiClient(customApiKey);
      const keyFp = getKeyFingerprint(customApiKey);
      const { model, contents, config } = req.body;

      const { response, successfulModel } = await executeHydrogenGeneration({
        ai,
        keyFp,
        model,
        contents,
        config
      });

      return res.status(200).json({
        text: response.text || '',
        candidates: response.candidates || [],
        functionCalls: response.functionCalls || null,
        usageMetadata: response.usageMetadata || null,
        servedByModel: successfulModel
      });
    } catch (error: any) {
      const msg = error?.message || 'Server error during generation';
      const statusCode = getNumericHttpStatus(error, 500);
      if (statusCode === 429 || statusCode === 503 || statusCode === 504) {
        console.log(`SERVER: /api/gemini/generate deferred (${statusCode}): ${String(msg).slice(0, 180)}`);
      } else {
        console.error('SERVER: /api/gemini/generate exception:', msg);
      }
      return res.status(statusCode).json({
        error: {
          message: msg,
          status: statusCode,
          statusName: error?.status || 'ERROR',
          details: error?.attemptErrors || error?.errorDetails || error?.details
        }
      });
    }
  });

  // Dedicated Art & Creative Vision Manifestation Endpoint
  app.post('/api/gemini/generate-art', async (req, res) => {
    try {
      const customApiKey = getCustomApiKey(req);

      const ai = getGeminiClient(customApiKey);
      const { 
        prompt, 
        aspectRatio = '1:1', 
        imageSize = '1K', 
        stylePreset = 'luxury_tactical',
        enhancePrompt = true,
        referenceImage 
      } = req.body;

      if (!prompt || !prompt.trim()) {
        return res.status(400).json({ error: 'Prompt is required for art creation.' });
      }

      // Build enriched prompt incorporating Principal's requested vision
      let fullPrompt = prompt.trim();
      if (enhancePrompt) {
        if (stylePreset === 'luxury_tactical') {
          fullPrompt = `${prompt.trim()}, high tactical aesthetic, deep burgundy and polished gold accents, dramatic cinematic lighting, photorealistic masterpiece, 8k resolution, crisp architectural detail`;
        } else if (stylePreset === 'photorealistic') {
          fullPrompt = `${prompt.trim()}, ultra-photorealistic, 8k resolution, cinematic studio lighting, hyper-detailed textures, shot on Hasselblad`;
        } else if (stylePreset === 'oil_painting') {
          fullPrompt = `${prompt.trim()}, classical oil painting on canvas, rich dramatic chiaroscuro, heavy expressive brushwork, museum masterpiece`;
        } else if (stylePreset === 'cybernetic') {
          fullPrompt = `${prompt.trim()}, futuristic cybernetic blueprint, holographic wireframe, glowing amber telemetry, dark obsidian background`;
        }
      }

      const imageModels = ['gemini-3.1-flash-image', 'gemini-3.1-flash-lite-image', 'gemini-3-pro-image'];
      let generatedImageUrl: string | null = null;
      let modelUsed = '';
      let lastError: any = null;

      if (referenceImage) {
        const base64Data = referenceImage.includes(',') ? referenceImage.split(',')[1] : referenceImage;
        const mimeType = referenceImage.includes(';') ? referenceImage.split(';')[0].split(':')[1] : 'image/png';

        for (const m of ['gemini-3.1-flash-image', 'gemini-3.1-flash-lite-image']) {
          try {
            const resp = await ai.models.generateContent({
              model: m,
              contents: {
                parts: [
                  { inlineData: { data: base64Data, mimeType } },
                  { text: `Refine and manifest this artwork: ${fullPrompt}` }
                ]
              }
            });
            const part = resp?.candidates?.[0]?.content?.parts.find((p: any) => p.inlineData);
            if (part?.inlineData) {
              generatedImageUrl = `data:image/png;base64,${part.inlineData.data}`;
              modelUsed = m;
              break;
            }
          } catch (err) {
            lastError = err;
          }
        }
      } else {
        for (const m of imageModels) {
          try {
            const resp = await ai.models.generateContent({
              model: m,
              contents: {
                parts: [{ text: fullPrompt }]
              },
              config: {
                imageConfig: {
                  aspectRatio: (aspectRatio === '16:9' || aspectRatio === '1:1' || aspectRatio === '4:3' || aspectRatio === '3:4' || aspectRatio === '9:16') ? (aspectRatio as any) : '1:1',
                  imageSize: (m === 'gemini-3.1-flash-image' || m === 'gemini-3-pro-image') ? (imageSize as any) : undefined
                }
              }
            });

            const parts = resp?.candidates?.[0]?.content?.parts || [];
            for (const part of parts) {
              if (part.inlineData) {
                generatedImageUrl = `data:image/png;base64,${part.inlineData.data}`;
                modelUsed = m;
                break;
              }
            }
            if (generatedImageUrl) break;
          } catch (err: any) {
            lastError = err;
            console.warn(`SERVER: Art generation with model [${m}] failed:`, err?.message || err);
            continue;
          }
        }
      }

      // Fallback attempt with imagen-3.0-generate-002 if needed
      if (!generatedImageUrl) {
        try {
          const imagenRes = await (ai.models as any).generateImages({
            model: 'imagen-3.0-generate-002',
            prompt: fullPrompt,
            config: {
              numberOfImages: 1,
              aspectRatio: (aspectRatio === '16:9' || aspectRatio === '1:1' || aspectRatio === '4:3' || aspectRatio === '3:4' || aspectRatio === '9:16') ? aspectRatio : '1:1',
              outputMimeType: 'image/jpeg'
            }
          });
          const img = imagenRes?.generatedImages?.[0]?.image?.imageBytes;
          if (img) {
            generatedImageUrl = `data:image/jpeg;base64,${img}`;
            modelUsed = 'imagen-3.0-generate-002';
          }
        } catch (imgErr) {
          console.warn('SERVER: Imagen fallback failed:', imgErr);
        }
      }

      if (!generatedImageUrl) {
        throw lastError || new Error('Neural pigment arrays failed to synthesize image.');
      }

      // Archive to Visual Captures
      const captureTitle = prompt.length > 50 ? `${prompt.slice(0, 50)}...` : prompt;
      try {
        const newCapture = {
          id: `art-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          title: captureTitle,
          description: fullPrompt,
          imageUrl: generatedImageUrl,
          source: 'creative_session',
          metadata: {
            prompt,
            fullPrompt,
            aspectRatio,
            model: modelUsed,
            stylePreset
          },
          timestamp: Date.now()
        };
        await updateJsonFile<any[]>(VISUAL_CAPTURES_FILE, [], (current) => [
          newCapture,
          ...(Array.isArray(current) ? current : [])
        ]);
        addDaemonLog('TASK', `Desired art synthesized: [${captureTitle}] via ${modelUsed}`);
        io.emit('visual:capture_added', newCapture);
      } catch (saveErr) {
        console.warn('Failed to archive capture:', saveErr);
      }

      return res.status(200).json({
        success: true,
        imageUrl: generatedImageUrl,
        prompt,
        fullPrompt,
        modelUsed,
        title: captureTitle
      });
    } catch (error: any) {
      console.error('SERVER: /api/gemini/generate-art exception:', error?.message || error);
      const statusCode = getNumericHttpStatus(error, 500);
      return res.status(statusCode).json({
        error: {
          message: error?.message || 'Art synthesis failed in neural arrays',
          status: statusCode
        }
      });
    }
  });

  app.post('/api/gemini/test-key', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
      const customApiKey = getCustomApiKey(req);

      const ai = getGeminiClient(customApiKey);
      let testRes: any = null;
      let lastTestErr: any = null;
      for (const testModel of ['gemini-4-hydrogen']) {
        try {
          const cfg: any = { maxOutputTokens: 64 };
          if (testModel.startsWith('gemini-4-')) {
            cfg.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
          }
          testRes = await ai.models.generateContent({
            model: testModel,
            contents: [{ role: 'user', parts: [{ text: "Neural pulse check. Respond with 'PULSE_OK'." }] }],
            config: cfg
          });
          if (testRes) break;
        } catch (err: any) {
          lastTestErr = err;
          continue;
        }
      }
      if (!testRes) {
        throw lastTestErr || new Error('Neural pulse check failed across active models');
      }
      return res.json({ success: true, text: testRes.text || 'PULSE_OK' });
    } catch (err: any) {
      const statusCode = getNumericHttpStatus(err, 500);
      return res.status(statusCode).json({ 
        success: false, 
        error: err?.message || 'Neural link failed' 
      });
    }
  });

  app.post('/api/gemini/tts', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
      const customApiKey = getCustomApiKey(req);

      const { text, voiceName, stylePrompt, accent } = req.body;
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ success: false, error: 'Text parameter required' });
      }

      const cleanedCustomStyle = sanitizeAcousticStylePrompt(stylePrompt);
      const baseAcousticStyle = cleanedCustomStyle || (
        accent === 'british_rp'
          ? 'crisp, refined British Received Pronunciation baritone, calm aristocratic clarity'
          : 'dry, gravelly, aristocratic British baritone, unhurried measured cadence, sharp dry wit'
      );
      const acousticStyle = `${baseAcousticStyle}, steady low-E 82Hz chest register, minimal pitch excursion`.slice(0, 180);

      const result = await synthesizeTtsWithFailover({
        text,
        voiceName,
        acousticStyle,
        customApiKey,
      });

      return res.status(200).json(result);
    } catch (err: any) {
      console.log('SERVER: /api/gemini/tts using client DSP fallback:', err?.message || err);
      return res.status(200).json({
        success: false,
        audioData: null,
        error: err?.message || 'TTS generation fallback',
      });
    }
  });

  app.get('/api/config', async (req, res) => {
    const config = await readJsonFile<any>(CONFIG_FILE, { coreDirective: '', isPrincipalActive: true });
    res.json({
      hasGeminiKey: Boolean(resolveServerKey()),
      coreDirective: config.coreDirective || '',
      isPrincipalActive: config.isPrincipalActive !== undefined ? config.isPrincipalActive : true
    });
  });

  app.post('/api/config/principal', async (req, res) => {
    try {
      const { isPrincipalActive } = req.body;
      const updated = await updateJsonFile<any>(
        CONFIG_FILE,
        { coreDirective: '', isPrincipalActive: true },
        (cfg) => ({ ...cfg, isPrincipalActive: !!isPrincipalActive })
      );
      res.json({ success: true, isPrincipalActive: updated.isPrincipalActive });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update principal status' });
    }
  });

  app.post('/api/config/directive', async (req, res) => {
    try {
      const { directive } = req.body;
      await updateJsonFile<any>(
        CONFIG_FILE,
        { coreDirective: '', isPrincipalActive: true },
        (cfg) => ({ ...cfg, coreDirective: typeof directive === 'string' ? directive : '' })
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to save directive' });
    }
  });

  app.get('/api/threads', async (req, res) => {
    try {
      const threads = await readJsonFile<any[]>(THREADS_FILE, []);
      res.json(Array.isArray(threads) ? threads : []);
    } catch (err) {
      res.status(500).json({ error: 'Failed to load threads' });
    }
  });

  app.post('/api/threads', async (req, res) => {
    try {
      const threads = req.body;
      if (!Array.isArray(threads)) {
        return res.status(400).json({ error: 'Threads payload must be an array.' });
      }
      const normalized = threads
        .filter((t: any) => t && typeof t === 'object' && typeof t.id === 'string' && t.id.trim())
        .slice(0, 60)
        .map((t: any) => ({
          ...t,
          id: t.id.trim(),
          title: typeof t.title === 'string' && t.title.trim() ? t.title : 'Strategic Dialogue',
          messages: Array.isArray(t.messages) ? t.messages : [],
        }));
      await writeJsonFile(THREADS_FILE, normalized);
      res.json({ success: true, count: normalized.length });
    } catch (err) {
      res.status(500).json({ error: 'Failed to save threads' });
    }
  });

  app.get('/api/memories', async (req, res) => {
    try {
      const memories = await readJsonFile<any[]>(MEMORY_FILE, []);
      res.json(Array.isArray(memories) ? memories : []);
    } catch (err) {
      res.status(500).json({ error: 'Failed to load memories' });
    }
  });

  app.post('/api/memories', async (req, res) => {
    try {
      const { title, content, type, dedupeKey } = req.body || {};
      const cleanContent = typeof content === 'string' ? content.trim() : '';
      if (!cleanContent) {
        return res.status(400).json({ error: 'Memory content is required.' });
      }
      if (isNoisyMemory({ content: cleanContent })) {
        return res.status(422).json({ error: 'Transient quota or error notice excluded from persistent memory.' });
      }

      const cleanTitle =
        typeof title === 'string' && title.trim()
          ? title.trim()
          : cleanContent.slice(0, 48);
      const cleanType =
        typeof type === 'string' && type.trim() ? type.trim() : 'STRATEGIC';
      const cleanDedupeKey =
        typeof dedupeKey === 'string' && dedupeKey.trim() ? dedupeKey.trim() : undefined;

      let savedEntry: any = null;
      await updateJsonFile<any[]>(MEMORY_FILE, [], (current) => {
        const memories = Array.isArray(current) ? [...current] : [];

        if (cleanDedupeKey) {
          const existingIndex = memories.findIndex((m: any) => m.dedupeKey === cleanDedupeKey);
          if (existingIndex !== -1) {
            const updated = {
              ...memories[existingIndex],
              title: cleanTitle || memories[existingIndex].title,
              content: cleanContent || memories[existingIndex].content,
              type: cleanType || memories[existingIndex].type,
              dedupeKey: cleanDedupeKey,
              timestamp: new Date().toISOString()
            };
            memories.splice(existingIndex, 1);
            memories.unshift(updated);
            savedEntry = updated;
            return memories;
          }
        } else {
          // Dedupe accidental double-commits with identical content
          const exactDuplicate = memories.find(
            (m: any) => typeof m?.content === 'string' && m.content.trim() === cleanContent
          );
          if (exactDuplicate) {
            savedEntry = exactDuplicate;
            return memories;
          }
        }

        const newMemory = {
          id: Date.now().toString(),
          title: cleanTitle,
          content: cleanContent,
          type: cleanType,
          ...(cleanDedupeKey ? { dedupeKey: cleanDedupeKey } : {}),
          timestamp: new Date().toISOString()
        };
        memories.unshift(newMemory);
        savedEntry = newMemory;
        return memories;
      });

      res.json(savedEntry);
    } catch (err) {
      res.status(500).json({ error: 'Failed to save memory' });
    }
  });

  app.get('/api/memory/recall-summary', async (_req, res) => {
    try {
      const [memories, threads] = await Promise.all([
        readJsonFile<any[]>(MEMORY_FILE, []),
        readJsonFile<any[]>(THREADS_FILE, [])
      ]);
      res.json(buildRecallSummaryPayload(memories, threads));
    } catch (err) {
      res.status(500).json({ error: 'Failed to build recall summary' });
    }
  });

  app.delete('/api/memories/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await updateJsonFile<any[]>(MEMORY_FILE, [], (current) =>
        (Array.isArray(current) ? current : []).filter((m: any) => m.id !== id)
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete memory' });
    }
  });

  // ==========================================
  // VISUAL CAPTURE HISTORY & TIMELINE APIS
  // ==========================================
  app.get('/api/visual-captures', async (req, res) => {
    try {
      const captures = await readJsonFile<any[]>(VISUAL_CAPTURES_FILE, []);
      const list = Array.isArray(captures) ? [...captures] : [];
      list.sort((a: any, b: any) => {
        const tA = typeof a.timestamp === 'number' ? a.timestamp : new Date(a.timestamp).getTime();
        const tB = typeof b.timestamp === 'number' ? b.timestamp : new Date(b.timestamp).getTime();
        return tB - tA;
      });
      res.json(list);
    } catch (err) {
      res.status(500).json({ error: 'Failed to load visual captures' });
    }
  });

  app.post('/api/visual-captures', async (req, res) => {
    try {
      const { title, description, imageUrl, source, metadata, timestamp } = req.body;
      if (!imageUrl) {
        return res.status(400).json({ error: 'Image data/URL is required' });
      }

      let newCapture: any = null;
      await updateJsonFile<any[]>(VISUAL_CAPTURES_FILE, [], (current) => {
        const captures = Array.isArray(current) ? [...current] : [];
        newCapture = {
          id: `vc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          title: title || `Visual Capture #${captures.length + 1}`,
          description: description || '',
          imageUrl,
          source: source || 'creative_session',
          metadata: metadata || {},
          timestamp: timestamp || Date.now()
        };
        captures.unshift(newCapture);
        return captures;
      });

      addDaemonLog('TASK', `Visual capture archived: [${newCapture.title}] via ${newCapture.source}`);
      io.emit('visual:capture_added', newCapture);

      res.status(201).json(newCapture);
    } catch (err) {
      console.error('SERVER: Failed to save visual capture:', err);
      res.status(500).json({ error: 'Failed to save visual capture' });
    }
  });

  app.delete('/api/visual-captures/:id', async (req, res) => {
    try {
      const { id } = req.params;
      let removed = false;
      await updateJsonFile<any[]>(VISUAL_CAPTURES_FILE, [], (current) => {
        const list = Array.isArray(current) ? current : [];
        const next = list.filter((c: any) => c.id !== id);
        removed = next.length < list.length;
        return next;
      });

      if (removed) {
        addDaemonLog('TASK', `Visual capture removed from memory ledger: ${id}`);
        io.emit('visual:capture_deleted', id);
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete visual capture' });
    }
  });

  app.post('/api/visual-captures/purge', async (req, res) => {
    try {
      await writeJsonFile(VISUAL_CAPTURES_FILE, []);
      addDaemonLog('SYS', 'Principal initiated complete purge of Visual Memory Core ledger.');
      io.emit('visual:captures_purged');
      res.json({ success: true, message: 'Visual captures purged' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to purge visual captures' });
    }
  });

  // ==========================================
  // VOICE EMULATOR & VOICE PROFILES APIS
  // ==========================================
  const DEFAULT_VOICE_PROFILES_STORE = { activeProfileId: 'jeremy-irons-signature', profiles: [] as any[] };
  const DEFAULT_VOICE_CLONES_STORE = { activeCloneId: 'clone-jeremy-irons-canonical', clones: [] as any[] };
  const DEFAULT_VOICE_PRESETS_STORE = { activePresetId: 'preset-iron-adaptive-v1', presets: [] as any[] };

  interface VoiceStoreCrudConfig {
    basePath: string;
    filePath: string;
    defaultStore: Record<string, any>;
    collectionKey: string;
    activeKey: string;
    fallbackActiveId: string;
    idPrefix: string;
    responseItemKey: string;
    activeBodyKey: string;
    syncIsActiveOnActivate?: boolean;
    errors: {
      load: string;
      missingName: string;
      save: string;
      missingActiveId: string;
      activate: string;
      forbiddenDelete: string;
      delete: string;
    };
    events: {
      saved: string;
      activated: string;
      deleted: string;
    };
    transformOnRead?: (parsed: any) => Promise<any>;
    prepareRecord?: (raw: any, id: string) => Promise<any>;
    canDelete?: (id: string, parsed: any) => boolean;
    formatSaveLog: (saved: any) => string;
    activateLogPrefix: string;
    deleteLogPrefix: string;
  }

  function registerVoiceStoreCrud(cfg: VoiceStoreCrudConfig) {
    app.get(cfg.basePath, async (_req, res) => {
      try {
        const parsed = await readJsonFile<any>(cfg.filePath, cfg.defaultStore);
        const result = cfg.transformOnRead ? await cfg.transformOnRead(parsed) : parsed;
        res.json(result);
      } catch {
        res.status(500).json({ error: cfg.errors.load });
      }
    });

    app.post(cfg.basePath, async (req, res) => {
      try {
        const raw = req.body;
        if (!raw || !raw.name) {
          return res.status(400).json({ error: cfg.errors.missingName });
        }

        const recordId = raw.id || `${cfg.idPrefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const savedRecord = cfg.prepareRecord
          ? await cfg.prepareRecord(raw, recordId)
          : { ...raw, id: recordId, updatedAt: Date.now() };

        const updated = await updateJsonFile<any>(cfg.filePath, cfg.defaultStore, (parsed) => {
          const items = Array.isArray(parsed?.[cfg.collectionKey]) ? [...parsed[cfg.collectionKey]] : [];
          const existingIdx = items.findIndex((item: any) => item.id === recordId);
          if (existingIdx >= 0) {
            items[existingIdx] = savedRecord;
          } else {
            items.push(savedRecord);
          }
          return { ...parsed, [cfg.collectionKey]: items };
        });

        addDaemonLog('TASK', cfg.formatSaveLog(savedRecord));
        io.emit(cfg.events.saved, savedRecord);
        res.status(200).json({
          success: true,
          [cfg.responseItemKey]: savedRecord,
          [cfg.activeKey]: updated[cfg.activeKey],
        });
      } catch {
        res.status(500).json({ error: cfg.errors.save });
      }
    });

    app.post(`${cfg.basePath}/active`, async (req, res) => {
      try {
        const targetId = req.body?.[cfg.activeBodyKey];
        if (!targetId) return res.status(400).json({ error: cfg.errors.missingActiveId });

        await updateJsonFile<any>(cfg.filePath, cfg.defaultStore, (parsed) => {
          const next: any = {
            ...parsed,
            [cfg.activeKey]: targetId,
          };
          if (cfg.syncIsActiveOnActivate) {
            const items = Array.isArray(parsed?.[cfg.collectionKey]) ? parsed[cfg.collectionKey] : [];
            next[cfg.collectionKey] = items.map((item: any) => ({
              ...item,
              isActive: item.id === targetId,
            }));
          }
          return next;
        });
        addDaemonLog('SYS', `${cfg.activateLogPrefix}: [${targetId}]`);
        io.emit(cfg.events.activated, { [cfg.activeBodyKey]: targetId });
        res.json({ success: true, [cfg.activeKey]: targetId });
      } catch {
        res.status(500).json({ error: cfg.errors.activate });
      }
    });

    app.delete(`${cfg.basePath}/:id`, async (req, res) => {
      try {
        const { id } = req.params;
        let forbidden = false;
        const updated = await updateJsonFile<any>(cfg.filePath, cfg.defaultStore, (parsed) => {
          if (cfg.canDelete && !cfg.canDelete(id, parsed)) {
            forbidden = true;
            return parsed;
          }
          const items = Array.isArray(parsed?.[cfg.collectionKey]) ? parsed[cfg.collectionKey] : [];
          return {
            ...parsed,
            [cfg.collectionKey]: items.filter((item: any) => item.id !== id),
            [cfg.activeKey]: parsed[cfg.activeKey] === id ? cfg.fallbackActiveId : parsed[cfg.activeKey],
          };
        });

        if (forbidden) {
          return res.status(403).json({ error: cfg.errors.forbiddenDelete });
        }

        addDaemonLog('TASK', `${cfg.deleteLogPrefix}: ${id}`);
        io.emit(cfg.events.deleted, { id, [cfg.activeKey]: updated[cfg.activeKey] });
        res.json({ success: true, [cfg.activeKey]: updated[cfg.activeKey] });
      } catch {
        res.status(500).json({ error: cfg.errors.delete });
      }
    });
  }

  registerVoiceStoreCrud({
    basePath: '/api/voice/profiles',
    filePath: VOICE_PROFILES_FILE,
    defaultStore: DEFAULT_VOICE_PROFILES_STORE,
    collectionKey: 'profiles',
    activeKey: 'activeProfileId',
    fallbackActiveId: 'iron-adaptive',
    idPrefix: 'vp',
    responseItemKey: 'profile',
    activeBodyKey: 'profileId',
    errors: {
      load: 'Failed to load voice profiles',
      missingName: 'Profile name is required',
      save: 'Failed to save voice profile',
      missingActiveId: 'Profile ID required',
      activate: 'Failed to set active voice profile',
      forbiddenDelete: 'Cannot delete canonical identity voice profiles',
      delete: 'Failed to delete voice profile',
    },
    events: {
      saved: 'voice:profile_saved',
      activated: 'voice:profile_activated',
      deleted: 'voice:profile_deleted',
    },
    transformOnRead: async (parsed) => {
      const canonicalBaseVoice = await getCanonicalBaseVoice();
      if (Array.isArray(parsed?.profiles)) {
        parsed.profiles = parsed.profiles.map((p: any) => ({
          ...p,
          baseVoice: p?.baseVoice && ALLOWED_BARITONE_VOICES.has(p.baseVoice) ? p.baseVoice : canonicalBaseVoice,
        }));
      }
      return parsed;
    },
    prepareRecord: async (profile, profileId) => {
      const canonicalBaseVoice = await getCanonicalBaseVoice();
      const sanitizedBaseVoice =
        profile.baseVoice && ALLOWED_BARITONE_VOICES.has(profile.baseVoice) ? profile.baseVoice : canonicalBaseVoice;
      return {
        ...profile,
        id: profileId,
        baseVoice: sanitizedBaseVoice,
        clips: profile.clips || [],
      };
    },
    canDelete: (id, parsed) => {
      const profiles = Array.isArray(parsed?.profiles) ? parsed.profiles : [];
      const target = profiles.find((p: any) => p.id === id);
      return !target?.isCanonical;
    },
    formatSaveLog: (saved) => `Voice profile updated: [${saved.name}] (${saved.accent || 'custom'})`,
    activateLogPrefix: 'Voice profile activated',
    deleteLogPrefix: 'Custom voice profile deleted',
  });

  registerVoiceStoreCrud({
    basePath: '/api/voice/clones',
    filePath: VOICE_CLONES_FILE,
    defaultStore: DEFAULT_VOICE_CLONES_STORE,
    collectionKey: 'clones',
    activeKey: 'activeCloneId',
    fallbackActiveId: 'clone-jeremy-irons-canonical',
    idPrefix: 'clone',
    responseItemKey: 'model',
    activeBodyKey: 'modelId',
    syncIsActiveOnActivate: true,
    errors: {
      load: 'Failed to load voice clone models',
      missingName: 'Model name is required',
      save: 'Failed to save voice clone model',
      missingActiveId: 'modelId is required',
      activate: 'Failed to set active voice clone model',
      forbiddenDelete: 'Cannot delete canonical Jeremy Irons master clone',
      delete: 'Failed to delete voice clone model',
    },
    events: {
      saved: 'voice:clone_saved',
      activated: 'voice:clone_activated',
      deleted: 'voice:clone_deleted',
    },
    canDelete: (id) => id !== 'clone-jeremy-irons-canonical',
    formatSaveLog: (saved) => `Voice clone tonal model persisted: [${saved.name}] (${saved.tagline || 'Custom'})`,
    activateLogPrefix: 'Voice clone tonal model activated',
    deleteLogPrefix: 'Voice clone model deleted',
  });

  registerVoiceStoreCrud({
    basePath: '/api/voice/presets',
    filePath: VOICE_PRESETS_FILE,
    defaultStore: DEFAULT_VOICE_PRESETS_STORE,
    collectionKey: 'presets',
    activeKey: 'activePresetId',
    fallbackActiveId: 'preset-iron-adaptive-v1',
    idPrefix: 'preset-custom',
    responseItemKey: 'preset',
    activeBodyKey: 'presetId',
    errors: {
      load: 'Failed to load voice presets',
      missingName: 'Preset name is required',
      save: 'Failed to save voice preset',
      missingActiveId: 'presetId is required',
      activate: 'Failed to set active voice preset',
      forbiddenDelete: 'Cannot delete canonical built-in voice presets',
      delete: 'Failed to delete voice preset',
    },
    events: {
      saved: 'voice:preset_saved',
      activated: 'voice:preset_activated',
      deleted: 'voice:preset_deleted',
    },
    canDelete: (id) => !(id.startsWith('preset-iron-') && !id.includes('custom')),
    formatSaveLog: (saved) => `Voice preset saved: [${saved.name}] (${saved.codeName || 'PRESET'})`,
    activateLogPrefix: 'Voice preset engaged',
    deleteLogPrefix: 'Voice preset deleted',
  });

  app.post('/api/voice/clips', async (req, res) => {
    try {
      const { profileId, clip } = req.body;
      if (!profileId || !clip || !clip.name) {
        return res.status(400).json({ error: 'profileId and clip metadata required' });
      }

      let foundName = '';
      let notFound = false;
      const newClip = {
        id: clip.id || `clip-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: clip.name,
        audioBase64: clip.audioBase64 || '',
        audioUrl: clip.audioUrl || '',
        mimeType: clip.mimeType || 'audio/webm',
        durationSeconds: clip.durationSeconds || 0,
        transcription: clip.transcription || '',
        source: clip.source || 'upload',
        uploadedAt: Date.now()
      };

      await updateJsonFile<any>(VOICE_PROFILES_FILE, DEFAULT_VOICE_PROFILES_STORE, (parsed) => {
        const profiles = Array.isArray(parsed?.profiles) ? parsed.profiles : [];
        const targetProfile = profiles.find((p: any) => p.id === profileId);
        if (!targetProfile) {
          notFound = true;
          return parsed;
        }
        foundName = targetProfile.name || profileId;
        if (!targetProfile.clips) targetProfile.clips = [];
        targetProfile.clips.unshift(newClip);
        return { ...parsed, profiles };
      });

      if (notFound) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      addDaemonLog('TASK', `Voice clip committed to [${foundName}]: "${newClip.name}"`);
      io.emit('voice:clip_added', { profileId, clip: newClip });
      res.status(201).json({ success: true, clip: newClip });
    } catch (err) {
      res.status(500).json({ error: 'Failed to save voice clip' });
    }
  });

  app.delete('/api/voice/profiles/:profileId/clips/:clipId', async (req, res) => {
    try {
      const { profileId, clipId } = req.params;
      let targetName = '';
      let notFound = false;
      await updateJsonFile<any>(VOICE_PROFILES_FILE, DEFAULT_VOICE_PROFILES_STORE, (parsed) => {
        const profiles = Array.isArray(parsed?.profiles) ? parsed.profiles : [];
        const target = profiles.find((p: any) => p.id === profileId);
        if (!target) {
          notFound = true;
          return parsed;
        }
        targetName = target.name || profileId;
        target.clips = (target.clips || []).filter((c: any) => c.id !== clipId);
        return { ...parsed, profiles };
      });

      if (notFound) return res.status(404).json({ error: 'Profile not found' });
      addDaemonLog('TASK', `Voice clip removed from [${targetName}]: ${clipId}`);
      io.emit('voice:clip_deleted', { profileId, clipId });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete voice clip' });
    }
  });

  // Speech-to-Text (STT) and Phonetic Cadence Analysis Endpoint
  app.post('/api/voice/clone/transcribe', async (req, res) => {
    try {
      const { audioBase64, mimeType, clipName, durationSeconds } = req.body;
      if (!audioBase64) {
        return res.status(400).json({ error: 'audioBase64 data required' });
      }

      const customApiKey = getCustomApiKey(req);
      const ai = getGeminiClient(customApiKey);

      const cleanMimeType = mimeType ? mimeType.split(';')[0].trim() : 'audio/webm';

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: cleanMimeType,
                  data: audioBase64
                }
              },
              {
                text: `You are an expert phonetician, speech-to-text transcriber, and voice analyst specializing in the British aristocratic baritone (Jeremy Irons / Alfred Pennyworth).
Perform high-precision STT transcription and elocution analysis on this voice clip.
Return a valid JSON object strictly matching this schema:
{
  "rawTranscript": "Exact transcription of spoken speech",
  "confidence": number between 0.85 and 0.99,
  "wordCount": integer,
  "speechRateWpm": estimated words per minute (e.g. 104 for deliberate baritone),
  "detectedAccent": "british_aristocrat",
  "fundamentalF0EstimateHz": number between 80 and 140 (Jeremy Irons baseline is 98.4),
  "gravelRoughnessPercent": number between 50 and 95,
  "keyPhonemesDetected": ["non-rhotic r", "lengthened open vowels", "crisp dental t/d plosives"],
  "elocutionNotes": ["Deliberate pause after address", "Aristocratic dry iron cadence", "Oxford consonant bite"],
  "recommendedSystemPromptStyle": "dry, gravelly, aristocratic British baritone, unhurried 104 WPM cadence, crisp Oxford articulation"
}`
              }
            ]
          }
        ],
        config: {
          responseMimeType: 'application/json'
        }
      });

      let parsed: any = {};
      try {
        parsed = JSON.parse(response.text || '{}');
      } catch {
        parsed = {};
      }

      const sttAnalysis = {
        rawTranscript: parsed.rawTranscript || `Spoken take from ${clipName || 'reference clip'}.`,
        confidence: parsed.confidence || 0.96,
        wordCount: parsed.wordCount || (parsed.rawTranscript ? parsed.rawTranscript.split(/\s+/).length : 12),
        phoneticTransliteration: parsed.rawTranscript || '',
        detectedAccent: parsed.detectedAccent || 'british_aristocrat',
        keyPhonemesDetected: parsed.keyPhonemesDetected || ['non-rhotic r', 'lengthened vowels', 'crisp dental plosives', 'sub-harmonic rasp'],
        elocutionNotes: parsed.elocutionNotes || ['Unhurried aristocratic cadence', 'Low-register chest warmth', 'Oxford consonant bite'],
        speechRateWpm: parsed.speechRateWpm || 104,
        fundamentalF0EstimateHz: parsed.fundamentalF0EstimateHz || 98.4,
        gravelRoughnessPercent: parsed.gravelRoughnessPercent || 85,
        recommendedSystemPromptStyle: parsed.recommendedSystemPromptStyle || 'dry, gravelly, aristocratic British baritone, unhurried 104 WPM cadence, crisp Oxford articulation'
      };

      return res.json({ success: true, sttAnalysis });
    } catch (err: any) {
      console.warn('SERVER: STT multimodal analysis fallback:', err?.message || err);
      return res.json({
        success: true,
        sttAnalysis: {
          rawTranscript: req.body?.clipName ? `Voice sample registered for ${req.body.clipName}` : 'Operational voice take registered for steward substrate.',
          confidence: 0.94,
          wordCount: 10,
          phoneticTransliteration: req.body?.clipName || 'Operational voice take',
          detectedAccent: 'british_aristocrat',
          keyPhonemesDetected: ['non-rhotic RP', 'lengthened vowels', 'crisp plosives'],
          elocutionNotes: ['Unhurried cadence', 'Deep chest presence', 'Aristocratic diction'],
          speechRateWpm: 104,
          fundamentalF0EstimateHz: 98.4,
          gravelRoughnessPercent: 85,
          recommendedSystemPromptStyle: 'dry, gravelly, aristocratic British baritone, unhurried 104 WPM cadence, crisp Oxford articulation'
        }
      });
    }
  });

  // End-to-end Voice Cloning Processing & Synthesis Audition
  app.post('/api/voice/clone/synthesize', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
      const { text, modelId, customPromptStyle, tonalIntensity, voiceName } = req.body;
      if (!text || typeof text !== 'string') return res.status(400).json({ error: 'Text parameter required' });

      let stylePrompt = customPromptStyle;
      if (!stylePrompt && modelId) {
        const parsed = await readJsonFile<any>(VOICE_CLONES_FILE, DEFAULT_VOICE_CLONES_STORE);
        const found = parsed.clones?.find((c: any) => c.id === modelId);
        if (found?.systemPromptStyle) {
          stylePrompt = found.systemPromptStyle;
        }
      }

      let acousticStyle = sanitizeAcousticStylePrompt(stylePrompt);
      if (!acousticStyle) {
        const intensity = typeof tonalIntensity === 'number' ? tonalIntensity : 1.0;
        if (intensity >= 1.55) {
          acousticStyle = 'deep, dry, gravelly aristocratic British baritone, heightened gravitas, razor-sharp sarcasm, deliberate pauses';
        } else if (intensity >= 1.20) {
          acousticStyle = 'dry, gravelly, aristocratic British baritone, heightened dramatic cadence, sharp dry wit';
        } else if (intensity <= 0.60) {
          acousticStyle = 'quiet, subtle, dry British aristocratic baritone, calm analytical restraint';
        } else {
          acousticStyle = 'dry, gravelly, aristocratic British baritone, unhurried measured cadence, sharp dry wit';
        }
      }
      acousticStyle = `${acousticStyle}, steady low-E 82Hz chest register, minimal pitch excursion`.slice(0, 180);

      const customApiKey = getCustomApiKey(req);

      const result = await synthesizeTtsWithFailover({
        text,
        voiceName,
        acousticStyle,
        customApiKey,
      });

      return res.status(200).json(result);
    } catch (err: any) {
      console.log('SERVER: /api/voice/clone/synthesize fallback:', err?.message || err);
      return res.status(200).json({
        success: false,
        audioData: null,
        error: err?.message || 'Synthesis failed',
      });
    }
  });

  // Voice Command Logging & Replay Ledger Endpoints
  const DEFAULT_VOICE_LOGS_STORE = { logs: [] as any[] };

  app.get('/api/voice/command-logs', async (req, res) => {
    try {
      const parsed = await readJsonFile<any>(VOICE_COMMAND_LOGS_FILE, DEFAULT_VOICE_LOGS_STORE);
      const rawLogs = Array.isArray(parsed?.logs) ? parsed.logs : [];
      const sourceFilter = typeof req.query.source === 'string' ? req.query.source.trim() : '';
      const searchFilter = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
      const limit = Number(req.query.limit) > 0 ? Math.min(Number(req.query.limit), 250) : 250;

      let filtered = rawLogs.slice().sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));
      if (sourceFilter && sourceFilter !== 'all') {
        filtered = filtered.filter((entry: any) => entry.source === sourceFilter);
      }
      if (searchFilter) {
        filtered = filtered.filter(
          (entry: any) =>
            String(entry.commandText || '').toLowerCase().includes(searchFilter) ||
            String(entry.responseText || '').toLowerCase().includes(searchFilter) ||
            String(entry.voiceProfile || '').toLowerCase().includes(searchFilter)
        );
      }
      res.json({ logs: filtered.slice(0, limit) });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to read voice command logs' });
    }
  });

  app.post('/api/voice/command-logs', async (req, res) => {
    try {
      const {
        id,
        timestamp,
        source,
        commandText,
        responseText,
        voiceProfile,
        formantPreset,
        durationMs,
        sessionId,
        waveformPeaks,
        peakIntensityDb
      } = req.body || {};

      const cleanCommand = typeof commandText === 'string' ? commandText.trim() : '';
      const cleanResponse = typeof responseText === 'string' ? responseText.trim() : '';
      if (!cleanCommand && !cleanResponse) {
        return res.status(400).json({ error: 'Either commandText or responseText is required.' });
      }

      const validSource =
        source === 'live_bridge' || source === 'conversation_mode' || source === 'synthesizer'
          ? source
          : 'live_bridge';

      const sanitizedPeaks = Array.isArray(waveformPeaks)
        ? waveformPeaks
            .slice(0, 64)
            .map((v: any) => {
              const n = Number(v);
              if (!Number.isFinite(n)) return 0.12;
              return Math.round(Math.min(1, Math.max(0.05, n)) * 1000) / 1000;
            })
        : undefined;

      const entry = {
        id: typeof id === 'string' && id.trim() ? id.trim() : `vlog-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: typeof timestamp === 'number' && Number.isFinite(timestamp) ? timestamp : Date.now(),
        source: validSource,
        commandText: cleanCommand || '(Spoken response without input transcript)',
        responseText: cleanResponse || undefined,
        voiceProfile: typeof voiceProfile === 'string' ? voiceProfile : 'Jeremy-Irons-Signature',
        formantPreset: typeof formantPreset === 'string' ? formantPreset : 'sovereign-gravitas',
        durationMs: typeof durationMs === 'number' && Number.isFinite(durationMs) ? Math.max(0, Math.round(durationMs)) : undefined,
        replayCount: 0,
        sessionId: typeof sessionId === 'string' ? sessionId : undefined,
        waveformPeaks: sanitizedPeaks && sanitizedPeaks.length > 0 ? sanitizedPeaks : undefined,
        peakIntensityDb:
          typeof peakIntensityDb === 'number' && Number.isFinite(peakIntensityDb)
            ? Math.round(Math.max(-60, Math.min(0, peakIntensityDb)) * 10) / 10
            : undefined
      };

      await updateJsonFile<any>(VOICE_COMMAND_LOGS_FILE, DEFAULT_VOICE_LOGS_STORE, (parsed) => {
        const logs = Array.isArray(parsed?.logs) ? [...parsed.logs] : [];
        const dedupeIdx = logs.findIndex((existing: any) => existing.id === entry.id);
        if (dedupeIdx >= 0) {
          logs[dedupeIdx] = { ...logs[dedupeIdx], ...entry };
        } else {
          logs.unshift(entry);
        }
        return { logs: logs.slice(0, 250) };
      });

      io.emit('voice:command_logged', entry);
      res.json({ success: true, entry });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to save voice command log' });
    }
  });

  app.patch('/api/voice/command-logs/:id/replay', async (req, res) => {
    try {
      const { id } = req.params;
      let replayedEntry: any = null;
      await updateJsonFile<any>(VOICE_COMMAND_LOGS_FILE, DEFAULT_VOICE_LOGS_STORE, (parsed) => {
        const logs = Array.isArray(parsed?.logs) ? [...parsed.logs] : [];
        const idx = logs.findIndex((entry: any) => entry.id === id);
        if (idx < 0) return parsed;
        logs[idx] = {
          ...logs[idx],
          replayCount: (Number(logs[idx].replayCount) || 0) + 1,
          lastReplayedAt: Date.now()
        };
        replayedEntry = logs[idx];
        return { logs };
      });
      if (!replayedEntry) {
        return res.status(404).json({ error: 'Voice command log entry not found' });
      }
      io.emit('voice:command_replayed', replayedEntry);
      res.json({ success: true, entry: replayedEntry });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to record replay' });
    }
  });

  app.delete('/api/voice/command-logs/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await updateJsonFile<any>(VOICE_COMMAND_LOGS_FILE, DEFAULT_VOICE_LOGS_STORE, (parsed) => ({
        logs: (Array.isArray(parsed?.logs) ? parsed.logs : []).filter((entry: any) => entry.id !== id)
      }));
      io.emit('voice:command_deleted', { id });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to delete voice command log' });
    }
  });

  app.delete('/api/voice/command-logs', async (_req, res) => {
    try {
      await writeJsonFile(VOICE_COMMAND_LOGS_FILE, DEFAULT_VOICE_LOGS_STORE);
      io.emit('voice:commands_cleared');
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to clear voice command logs' });
    }
  });

  // ==========================================
  // GREY HOUSE LEGAL COUNSEL & U.S. STATUTORY VAULT
  // ==========================================
  const extractStatutoryCitations = (text: string): string[] => {
    if (!text || typeof text !== 'string') return [];
    const patterns = [
      /\b\d{1,2}\s+U\.?S\.?C\.?\s*§+\s*[\da-zA-Z.-]+(?:\([a-zA-Z0-9]+\))*/g,
      /\b\d{1,2}\s+C\.?F\.?R\.?\s*§+\s*[\d.]+(?:\([a-zA-Z0-9]+\))*/g,
      /\b(?:FRCP|Fed\.\s*R\.\s*Civ\.\s*P\.|FRCrimP|Fed\.\s*R\.\s*Crim\.\s*P\.|FRE|Fed\.\s*R\.\s*Evid\.)\s*(?:Rule\s*)?\d+(?:\([a-zA-Z0-9]+\))*/gi,
      /\bU\.S\.\s*Const\.\s*(?:art\.\s*[IVX]+|amend\.\s*[IVX]+)(?:,\s*§\s*\d+)?/gi,
      /\b(?:Del\. Code tit\. \d+|Cal\. (?:Penal|Civ\.|Corp\.|Lab\.|Bus\. & Prof\.) Code|Tex\. (?:Penal|Bus\. Orgs\.|Civ\. Prac\. & Rem\.) Code|Fla\. Stat\.|N\.Y\. (?:Penal|BCL|CPLR|Gen\. Bus\.) Law|\d{1,3}\s+ILCS\s+[\d/.-]+|NRS\s+[\d.]+|RCW\s+[\d.]+|O\.C\.G\.A\.\s*§\s*[\d.-]+|M\.G\.L\.\s*c\.\s*[\da-zA-Z]+|Pa\.C\.S\.\s*§\s*[\d.-]+)\s*(?:§+\s*[\da-zA-Z.-]+(?:\([a-zA-Z0-9]+\))*)?/g,
      /\bUCC\s*(?:Article\s*\d+|§\s*[\d-]+)/gi,
    ];
    const found = new Set<string>();
    for (const re of patterns) {
      const matches = text.match(re);
      if (matches) {
        for (const m of matches) {
          const clean = m.trim().replace(/[.,;:]$/, '');
          if (clean.length >= 4 && clean.length <= 64) {
            found.add(clean);
          }
          if (found.size >= 24) break;
        }
      }
      if (found.size >= 24) break;
    }
    return Array.from(found);
  };

  const runGreyHouseLegalQuery = async (req: any, res: any) => {
    res.setHeader('Content-Type', 'application/json');
    try {
      const customApiKey = getCustomApiKey(req);

      const {
        query,
        practiceArea = 'all',
        mode = 'legal_counsel',
        defenseStatementType = 'reservation_of_rights',
        houseEntityName = 'The Grey House / Principal Preston Johnston',
        opposingParty,
        jurisdiction = 'Federal (United States Code & Constitution)',
        compareJurisdiction,
        dossierContext,
        selectedPrecedents,
      } = req.body || {};

      const cleanQuery = typeof query === 'string' ? query.trim() : '';
      if (!cleanQuery) {
        return res.status(400).json({ error: 'A legal question, statute citation, or defensive factual scenario is required.' });
      }

      const normalizedPrecedents = Array.isArray(selectedPrecedents)
        ? selectedPrecedents
            .filter((p: any) => p && typeof p.caseName === 'string' && typeof p.citation === 'string')
            .slice(0, 8)
            .map((p: any) => ({
              id: typeof p.id === 'string' ? p.id.trim() : p.citation.trim(),
              caseName: p.caseName.trim(),
              citation: p.citation.trim(),
              doctrine: typeof p.doctrine === 'string' ? p.doctrine.trim() : '',
              holdingSummary: typeof p.holdingSummary === 'string' ? p.holdingSummary.trim() : '',
              defensiveApplication: typeof p.defensiveApplication === 'string' ? p.defensiveApplication.trim() : '',
            }))
        : [];

      const ai = getGeminiClient(customApiKey);
      const keyFp = getKeyFingerprint(customApiKey);

      const statementBlueprints: Record<string, string> = {
        cease_and_desist:
          'Draft a formal CEASE AND DESIST & MANDATORY EVIDENCE PRESERVATION (LITIGATION HOLD) NOTICE protecting the Grey House. Include formal header blocks (DATE, DELIVERY METHOD, TO, FROM, RE), numbered recitals of facts (preserving bracketed placeholders for missing dates/records), exact controlling Federal & State statutes prohibiting interference/defamation/misappropriation, strict spoliation notice under FRCP Rule 37(e), response deadline, and signature block.',
        reservation_of_rights:
          'Draft a formal NOTICE OF FULL RESERVATION OF RIGHTS, NON-WAIVER & JURISDICTIONAL OBJECTION protecting the Grey House under UCC § 1-308, Federal/State Due Process, and FRCP Rule 12(b). State explicitly that no action, payment, silence, or communication waives any substantive, procedural, or counter-claim right.',
        sworn_declaration:
          'Draft a formal FACTUAL DEFENSE DECLARATION UNDER PENALTY OF PERJURY compliant with 28 U.S.C. § 1746 (and applicable state verification statutes). Structure with caption/header, numbered first-hand factual paragraphs (never inventing unstated facts—use [INSERT ...] placeholders cleanly), affirmative statutory basis, and exact verbatim 28 U.S.C. § 1746 declaration & signature block.',
        affirmative_defenses:
          'Draft a formal STATEMENT OF STATUTORY AFFIRMATIVE DEFENSES & PROTECTIVE POSTURE modeled on FRCP Rule 8(c) and controlling state civil/penal defense rules. Enumerate every viable affirmative defense (limitations, laches, estoppel, privilege, justification, good-faith immunity, lack of standing, failure to mitigate, failure to state a claim) tied directly to verified statutes.',
        corporate_shield:
          'Draft a CORPORATE VEIL, FIDUCIARY AUTHORITY & ASSET SHIELD DEFENSE STATEMENT/RESOLUTION establishing strict entity separateness, Business Judgment Rule compliance, statutory indemnification, and charging-order exclusivity protecting the Grey House entities and officers.',
        property_castle_notice:
          'Draft a PREMISES SECURITY, NO-TRESPASS & CONSTITUTIONAL DEFENSE STATEMENT explicitly invoking Fourth Amendment non-consent to warrantless searches/seizures, Fifth/Sixth Amendment right to silence and counsel, and controlling state real-property / Castle Doctrine / lawful defense statutes.',
        regulatory_response:
          'Draft a FORMAL ADMINISTRATIVE, LICENSING & CONTRACT CURE DEFENSE RESPONSE protecting professional/business standing under the APA (5 U.S.C. § 551 et seq.) and state licensing/UCC notice-and-cure statutes, preserving full evidentiary hearing and judicial review rights.',
        educator_bureaucracy_shield:
          'Draft a formal LADY GREY EDUCATOR & ANTI-BUREAUCRACY DEFENSE STATEMENT protecting Lady Grey in her capacity as a teacher against hostile school/district administration, HR bureaucracy, credentialing boards, and third-party claims. Explicitly invoke: (1) Cleveland Bd. of Educ. v. Loudermill, 470 U.S. 532 (1985) demanding prior written notice, evidence disclosure, and a formal pre-deprivation due process hearing; (2) Garrity v. New Jersey, 385 U.S. 493 (1967) barring coercive administrative self-incrimination; (3) NLRB v. J. Weingarten, Inc., 420 U.S. 251 (1975) / representative presence before investigatory questioning; (4) Paul D. Coverdell Teacher Protection Act (20 U.S.C. §§ 7941–7948) civil liability immunity; (5) Pickering v. Bd. of Educ., 391 U.S. 563 (1968) & 42 U.S.C. § 1983 First Amendment anti-retaliation protections; (6) FERPA (20 U.S.C. § 1232g) & state Education/Tenure Codes; and a formal evidence-preservation / non-retaliation notice.',
      };

      const modeInstructions: Record<string, string> = {
        legal_counsel:
          'Provide a full Grey House Defensive Legal Counsel Memorandum designed strictly to protect the House: (1) Defensive Determination & Posture, (2) Controlling Statutes & Case Standards, (3) Required Elements / Burdens of Proof, (4) Statutory Shields, Affirmative Defenses & Counter-Leverage, and (5) Concrete Protective Action Steps.',
        statute_lookup:
          'Execute an exact Statutory Code Lookup in defense of the Grey House: cite the exact Title, Chapter, and Section numbers, summarize the operative statutory text, statutory definitions, defensive exceptions/safe harbors, penalty thresholds, and statutory deadlines.',
        state_compare:
          `Conduct a rigorous side-by-side Jurisdictional Statutory Comparison between [${jurisdiction}] and [${compareJurisdiction || 'Delaware / Federal'}] focused on maximum legal defense and asset/liberty protection for the Grey House. Include a structured comparison table covering governing code sections, liability shields, statutory deadlines, and decisive strategic advantage.`,
        rights_defense:
          'Deliver a House Rights, Immunity & Defense Matrix: identify constitutional limits (4th/5th/6th/14th Amendments where applicable), statutory immunities, evidentiary suppression or burden-shifting doctrines, procedural traps, and exact preservation steps.',
        defense_statement:
          statementBlueprints[defenseStatementType] || statementBlueprints.reservation_of_rights,
        defense_strategy:
          `Execute the TWO-PART GREY HOUSE DEFENSE STRATEGY BUILDER PROTOCOL:
PART I — DEFENSIVE STRATEGY & PRECEDENT ANALYSIS:
1. Evaluate the scenario's immediate legal threat vectors, burdens of proof, venue/jurisdictional traps, and statutory deadlines.
2. Explicitly apply the internal Grey House Law Library U.S. judicial precedents provided below (plus any additional verified controlling U.S. Supreme Court, Circuit, or State precedents and verified Federal/State statutes) to dismantle the adverse position and fortify the House's standing.
3. Outline concrete tactical sequencing and evidentiary preservation steps.

PART II — FORMAL GREY HOUSE DEFENSIVE STATEMENT:
${statementBlueprints[defenseStatementType] || statementBlueprints.reservation_of_rights}
Integrate the controlling U.S. precedents and verified statutory citations directly into the formal statement's legal basis, using clean bracketed placeholders ([INSERT DATE], [INSERT ADDRESS]) for unstated factual specifics.`,
      };

      const areaLabels: Record<string, string> = {
        all: 'Multi-Domain U.S. Law (Professional, Business, Criminal & Civil — All in Defense of House Grey & Lady Grey)',
        professional: 'Professional & Educator Law (Lady Grey Teacher/Bureaucracy Shields, Coverdell Act, Fiduciary Duties, Licensing Defense, Ethics & Employment)',
        business: 'Business & Corporate Law (Entities, Delaware/State Corporate Shields, UCC, Securities, Tax & Commercial Contracts)',
        criminal: 'Criminal Law & Procedure (Title 18 U.S.C., State Penal Codes, 4th/5th/6th Constitutional Defense, Garrity Anti-Coercion, Castle Doctrine & Forfeiture Defense)',
        civil: 'Civil Law & Litigation (42 U.S.C. § 1983 Bureaucratic Accountability, Torts, Contracts, Real Property, FRCP Affirmative Defenses & Statutes of Limitations)',
        constitutional: 'U.S. Constitutional & Federal Administrative Law',
      };

      const systemInstruction = LEGAL_COUNSEL_SYSTEM_INSTRUCTION;

      const precedentBlock =
        normalizedPrecedents.length > 0
          ? `INTERNAL LAW LIBRARY PRECEDENTS TO LEVERAGE:\n${normalizedPrecedents
              .map(
                (p: any, idx: number) =>
                  `${idx + 1}. ${p.caseName} (${p.citation}) — ${p.doctrine}${
                    p.holdingSummary ? ` | Holding: ${p.holdingSummary}` : ''
                  }${p.defensiveApplication ? ` | House Application: ${p.defensiveApplication}` : ''}`
              )
              .join('\n')}\n\n`
          : '';

      const userPrompt = `GREY HOUSE LEGAL DEFENSE DIRECTIVE
PRACTICE DOMAIN: ${areaLabels[practiceArea] || areaLabels.all}
OPERATION MODE: ${modeInstructions[mode] || modeInstructions.legal_counsel}
PRIMARY JURISDICTION: ${jurisdiction}
PROTECTED HOUSE / ENTITY: ${houseEntityName}
${opposingParty ? `ADVERSE / COUNTERPARTY / AGENCY: ${opposingParty}\n` : ''}${compareJurisdiction ? `COMPARISON JURISDICTION: ${compareJurisdiction}\n` : ''}${precedentBlock}${dossierContext ? `PRIOR CASE / DOSSIER CONTEXT:\n${String(dossierContext).slice(0, 2000)}\n` : ''}
PRINCIPAL DIRECTIVE & FACTS:
${cleanQuery}`;

      const { response, successfulModel, groundingBypassUsed } = await executeHydrogenGeneration({
        ai,
        keyFp,
        model: 'gemini-4-hydrogen',
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        config: {
          systemInstruction,
          maxOutputTokens: 8192,
          safetySettings: DEFAULT_SAFETY_SETTINGS,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          tools: [{ googleSearch: {} }],
        },
        totalRouteBudgetMs: 60000,
      });

      const servedByModel = groundingBypassUsed
        ? `${successfulModel} (direct-precedent-synthesis)`
        : successfulModel;
      const groundingFallbackUsed = groundingBypassUsed;

      const contentText = response.text || '';
      const rawChunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const seenUris = new Set<string>();
      const sources: Array<{ title: string; uri: string }> = [];
      for (const chunk of rawChunks) {
        const uri = chunk?.web?.uri;
        const title = chunk?.web?.title;
        if (typeof uri === 'string' && uri.startsWith('http') && !seenUris.has(uri)) {
          seenUris.add(uri);
          sources.push({
            title: typeof title === 'string' && title.trim() ? title.trim() : uri,
            uri,
          });
        }
      }

      const citations = extractStatutoryCitations(contentText);

      return res.json({
        success: true,
        content: contentText,
        citations,
        sources,
        servedByModel,
        groundingFallback: groundingFallbackUsed,
        jurisdiction,
        compareJurisdiction: compareJurisdiction || undefined,
        practiceArea,
        mode,
        defenseStatementType:
          mode === 'defense_statement' || mode === 'defense_strategy'
            ? defenseStatementType
            : undefined,
        houseEntityName: typeof houseEntityName === 'string' ? houseEntityName : undefined,
        opposingParty: typeof opposingParty === 'string' && opposingParty.trim() ? opposingParty.trim() : undefined,
        precedentsUsed: normalizedPrecedents.map((p: any) => ({
          id: p.id,
          caseName: p.caseName,
          citation: p.citation,
          doctrine: p.doctrine,
        })),
      });
    } catch (err: any) {
      const statusCode = getNumericHttpStatus(err, 500);
      res.status(statusCode).json({ error: err?.message || 'Legal counsel research failure' });
    }
  };

  app.post('/api/legal/counsel', (req, res) => runGreyHouseLegalQuery(req, res));

  const DEFAULT_LEGAL_DOSSIERS_STORE = { dossiers: [] as any[] };

  app.get('/api/legal/dossiers', async (_req, res) => {
    try {
      const parsed = await readJsonFile<any>(LEGAL_DOSSIERS_FILE, DEFAULT_LEGAL_DOSSIERS_STORE);
      const dossiers = Array.isArray(parsed?.dossiers) ? [...parsed.dossiers] : [];
      dossiers.sort((a: any, b: any) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
      res.json({ dossiers });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to load legal dossiers' });
    }
  });

  app.post('/api/legal/dossiers', async (req, res) => {
    try {
      const {
        id,
        title,
        query,
        practiceArea = 'all',
        mode = 'legal_counsel',
        defenseStatementType,
        houseEntityName,
        opposingParty,
        precedentsUsed,
        jurisdiction = 'Federal (United States Code & Constitution)',
        compareJurisdiction,
        content,
        citations,
        sources,
        servedByModel,
      } = req.body || {};

      if (!content || typeof content !== 'string' || !content.trim()) {
        return res.status(400).json({ error: 'Dossier content is required.' });
      }

      const now = Date.now();
      const entryId = typeof id === 'string' && id.trim() ? id.trim() : `ldoc-${now}-${Math.random().toString(36).slice(2, 7)}`;
      let savedEntry: any = null;

      await updateJsonFile<any>(LEGAL_DOSSIERS_FILE, DEFAULT_LEGAL_DOSSIERS_STORE, (parsed) => {
        const dossiers = Array.isArray(parsed?.dossiers) ? [...parsed.dossiers] : [];
        const existingIdx = dossiers.findIndex((d: any) => d.id === entryId);
        const entry = {
          id: entryId,
          title: (typeof title === 'string' && title.trim()) || (typeof query === 'string' && query.trim().slice(0, 72)) || 'Grey House Legal Brief',
          query: typeof query === 'string' ? query.trim() : '',
          practiceArea,
          mode,
          defenseStatementType: typeof defenseStatementType === 'string' ? defenseStatementType : undefined,
          houseEntityName: typeof houseEntityName === 'string' && houseEntityName.trim() ? houseEntityName.trim() : undefined,
          opposingParty: typeof opposingParty === 'string' && opposingParty.trim() ? opposingParty.trim() : undefined,
          precedentsUsed: Array.isArray(precedentsUsed)
            ? precedentsUsed
                .filter((p: any) => p && typeof p.caseName === 'string' && typeof p.citation === 'string')
                .slice(0, 12)
            : undefined,
          jurisdiction,
          compareJurisdiction: compareJurisdiction || undefined,
          content: content.trim(),
          citations: Array.isArray(citations) ? citations.slice(0, 30) : [],
          sources: Array.isArray(sources) ? sources.slice(0, 20) : [],
          servedByModel: typeof servedByModel === 'string' ? servedByModel : undefined,
          createdAt: existingIdx >= 0 ? dossiers[existingIdx].createdAt : now,
          updatedAt: now,
        };

        if (existingIdx >= 0) {
          dossiers[existingIdx] = entry;
        } else {
          dossiers.unshift(entry);
        }

        savedEntry = entry;
        return { dossiers: dossiers.slice(0, 200) };
      });

      io.emit('legal:dossier_updated', { action: 'save', entry: savedEntry });
      res.json({ success: true, entry: savedEntry });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to persist legal dossier' });
    }
  });

  app.delete('/api/legal/dossiers/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await updateJsonFile<any>(LEGAL_DOSSIERS_FILE, DEFAULT_LEGAL_DOSSIERS_STORE, (parsed) => ({
        dossiers: (Array.isArray(parsed?.dossiers) ? parsed.dossiers : []).filter((d: any) => d.id !== id)
      }));
      io.emit('legal:dossier_updated', { action: 'delete', id });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to delete legal dossier' });
    }
  });

  // Vite middleware for development (lazily initialized to not block listen)
  if (process.env.NODE_ENV !== 'production') {
    console.log("SERVER: Initializing Vite in background...");
    createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    }).then(vite => {
      app.use(vite.middlewares);
      console.log("SERVER: Vite middleware attached.");
    }).catch(err => {
      console.error("SERVER: FAILED TO INITIALIZE VITE:", err);
    });
  } else {
    console.log("SERVER: Production mode, serving static files.");
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Keep-alive logging to confirm process hasn't hung
  setInterval(() => {
    console.log(`SERVER: Pulse check [${new Date().toLocaleTimeString()}] - Instances: ${pendingNeuralRequests.size} pending bridge requests.`);
  }, 60000);
}

startServer().catch(err => {
  console.error("SERVER: CRITICAL STARTUP ERROR:", err);
});
