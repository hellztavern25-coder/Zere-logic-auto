// [TAG: 11]
import { VoiceCommandLogEntry, VoiceCommandSource } from '../types';
import {
  jeremyIronsVoice,
  resolveMergedDSPConfig,
  VoiceModulationProfile,
  JeremyIronsConfig
} from './jeremyIronsVoiceService';

export type ReplayMode = 'full' | 'command' | 'response';
export type ReplayPhase = 'idle' | 'command' | 'response';

export interface LogVoiceInteractionInput {
  id?: string;
  timestamp?: number;
  source: VoiceCommandSource;
  commandText: string;
  responseText?: string;
  voiceProfile?: string;
  formantPreset?: string;
  durationMs?: number;
  sessionId?: string;
  responseWavBase64?: string;
  pcmBase64Chunks?: string[];
  waveformPeaks?: number[];
  peakIntensityDb?: number;
}

// In-session cache of original captured audio (WAV base64) keyed by log entry ID
const sessionAudioCache = new Map<string, string>();
let activeReplayToken = 0;

/**
 * Encodes an array of raw 24kHz 16-bit mono PCM chunks (Uint8Array / base64) into a standard WAV base64 string
 * so Live API turns can be replayed with their original captured audio during the session.
 */
export function encodePcmChunksToWavBase64(pcmBase64Chunks: string[], sampleRate: number = 24000): string | undefined {
  if (!pcmBase64Chunks || pcmBase64Chunks.length === 0) return undefined;
  try {
    const decodedChunks: Uint8Array[] = [];
    let totalBytes = 0;
    // Cap at ~2.5 MB raw PCM (~50s @ 24kHz) so browser memory stays lean
    const MAX_PCM_BYTES = 2_500_000;

    for (const b64 of pcmBase64Chunks) {
      if (!b64) continue;
      const binStr = atob(b64);
      const bytes = new Uint8Array(binStr.length);
      for (let i = 0; i < binStr.length; i++) {
        bytes[i] = binStr.charCodeAt(i);
      }
      if (totalBytes + bytes.length > MAX_PCM_BYTES) break;
      decodedChunks.push(bytes);
      totalBytes += bytes.length;
    }

    if (totalBytes === 0) return undefined;

    const wavBuffer = new ArrayBuffer(44 + totalBytes);
    const view = new DataView(wavBuffer);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + totalBytes, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // PCM chunk size
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // Byte rate
    view.setUint16(32, 2, true); // Block align
    view.setUint16(34, 16, true); // Bits per sample
    writeString(36, 'data');
    view.setUint32(40, totalBytes, true);

    const wavBytes = new Uint8Array(wavBuffer);
    let offset = 44;
    for (const chunk of decodedChunks) {
      wavBytes.set(chunk, offset);
      offset += chunk.length;
    }

    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < wavBytes.length; i += chunkSize) {
      binary += String.fromCharCode(...wavBytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  } catch (err) {
    console.warn('Could not encode PCM chunks to WAV:', err);
    return undefined;
  }
}

/**
 * Computes a normalized amplitude peak/RMS envelope and true peak dBFS from raw 16-bit mono PCM chunks.
 */
export function extractWaveformEnvelopeFromPcmChunks(
  pcmBase64Chunks: string[],
  barCount: number = 40
): { peaks: number[]; peakIntensityDb: number } | null {
  if (!pcmBase64Chunks || pcmBase64Chunks.length === 0 || barCount <= 0) return null;
  try {
    const sampleArrays: Int16Array[] = [];
    let totalSamples = 0;

    for (const b64 of pcmBase64Chunks) {
      if (!b64) continue;
      const binStr = atob(b64);
      const byteLen = binStr.length - (binStr.length % 2);
      if (byteLen <= 0) continue;
      const bytes = new Uint8Array(byteLen);
      for (let i = 0; i < byteLen; i++) {
        bytes[i] = binStr.charCodeAt(i);
      }
      const samples = new Int16Array(bytes.buffer);
      sampleArrays.push(samples);
      totalSamples += samples.length;
    }

    if (totalSamples < barCount) return null;

    const merged = new Int16Array(totalSamples);
    let offset = 0;
    for (const arr of sampleArrays) {
      merged.set(arr, offset);
      offset += arr.length;
    }

    const bucketSize = Math.floor(totalSamples / barCount);
    const rawRms: number[] = [];
    let maxSampleAbs = 1;

    for (let b = 0; b < barCount; b++) {
      const start = b * bucketSize;
      const end = b === barCount - 1 ? totalSamples : start + bucketSize;
      let sumSq = 0;
      let count = 0;
      // Stride slightly if huge buffer for sub-ms performance
      const step = Math.max(1, Math.floor((end - start) / 160));
      for (let i = start; i < end; i += step) {
        const s = merged[i] / 32768;
        const abs = Math.abs(merged[i]);
        if (abs > maxSampleAbs) maxSampleAbs = abs;
        sumSq += s * s;
        count++;
      }
      const rms = count > 0 ? Math.sqrt(sumSq / count) : 0;
      rawRms.push(rms);
    }

    const maxRms = Math.max(...rawRms, 0.02);
    const peaks = rawRms.map((v) => {
      const norm = Math.pow(v / maxRms, 0.72);
      return Math.round(Math.min(1, Math.max(0.08, norm)) * 1000) / 1000;
    });
    const peakIntensityDb = Math.round(Math.max(-60, Math.min(0, 20 * Math.log10(maxSampleAbs / 32768))) * 10) / 10;

    return { peaks, peakIntensityDb };
  } catch {
    return null;
  }
}

/**
 * Generates a deterministic acoustic intensity contour based on word cadence, syllable density,
 * punctuation pauses, and speaker split when raw PCM telemetry is not stored.
 */
export function deriveProsodyWaveformEnvelope(
  commandText: string,
  responseText?: string,
  barCount: number = 40
): { peaks: number[]; splitRatio: number | null } {
  const cleanCmd = (commandText || '').replace(/^\(Spoken response without input transcript\)$/i, '').trim();
  const cleanResp = (responseText || '').trim();

  const buildSegmentBars = (text: string, count: number, seedBias: number): number[] => {
    if (count <= 0) return [];
    const normalized = text || 'pause';
    const bars: number[] = [];
    const charCount = normalized.length;

    for (let i = 0; i < count; i++) {
      const startIdx = Math.floor((i / count) * charCount);
      const endIdx = Math.max(startIdx + 1, Math.floor(((i + 1) / count) * charCount));
      const slice = normalized.slice(startIdx, endIdx);

      let energy = 0.24;
      for (let c = 0; c < slice.length; c++) {
        const ch = slice[c];
        const code = ch.charCodeAt(0);
        if (/[.!?]/.test(ch)) {
          energy -= 0.14;
        } else if (/[,;:\s—-]/.test(ch)) {
          energy -= 0.05;
        } else if (/[A-Z]/.test(ch)) {
          energy += 0.22;
        } else if (/[aeiouAEIOU]/.test(ch)) {
          energy += 0.16 + ((code % 5) * 0.04);
        } else {
          energy += 0.11 + ((code % 7) * 0.03);
        }
      }

      // Natural phrase arc + subtle harmonic cadence variation
      const pos = count > 1 ? i / (count - 1) : 0.5;
      const phraseArc = Math.sin(pos * Math.PI) * 0.18 + 0.82;
      const harmonic = 0.08 * Math.sin(i * 1.45 + seedBias);
      const val = Math.min(0.98, Math.max(0.1, (energy / Math.max(1, Math.sqrt(slice.length))) * phraseArc + harmonic));
      bars.push(Math.round(val * 1000) / 1000);
    }
    return bars;
  };

  if (cleanCmd && cleanResp) {
    const totalLen = cleanCmd.length + cleanResp.length;
    const rawCmdBars = Math.round((cleanCmd.length / Math.max(1, totalLen)) * barCount);
    const cmdBars = Math.max(8, Math.min(barCount - 10, rawCmdBars));
    const respBars = barCount - cmdBars;

    const left = buildSegmentBars(cleanCmd, cmdBars, 0.7);
    const right = buildSegmentBars(cleanResp, respBars, 2.3);
    // Subtle pause valley at the handoff bar
    if (left.length > 0) left[left.length - 1] = 0.12;
    if (right.length > 0) right[0] = 0.14;

    return {
      peaks: [...left, ...right],
      splitRatio: cmdBars / barCount
    };
  }

  const singleText = cleanCmd || cleanResp;
  return {
    peaks: buildSegmentBars(singleText, barCount, 1.1),
    splitRatio: null
  };
}

export function getEntryWaveformData(entry: VoiceCommandLogEntry): {
  peaks: number[];
  splitRatio: number | null;
  peakPercent: number;
  isTruePcm: boolean;
} {
  const cleanCmd = (entry.commandText || '').replace(/^\(Spoken response without input transcript\)$/i, '').trim();
  const cleanResp = (entry.responseText || '').trim();
  const derived = deriveProsodyWaveformEnvelope(cleanCmd, cleanResp, 40);

  if (Array.isArray(entry.waveformPeaks) && entry.waveformPeaks.length >= 12) {
    // If two-way exchange and waveformPeaks captured the Steward PCM turn, compose command cadence + real Steward PCM
    if (cleanCmd && cleanResp && derived.splitRatio !== null) {
      const cmdCount = Math.round(derived.splitRatio * 40);
      const respCount = 40 - cmdCount;
      const cmdSegment = derived.peaks.slice(0, cmdCount);
      const respSegment: number[] = [];
      for (let i = 0; i < respCount; i++) {
        const srcIdx = Math.min(
          entry.waveformPeaks.length - 1,
          Math.floor((i / Math.max(1, respCount)) * entry.waveformPeaks.length)
        );
        respSegment.push(entry.waveformPeaks[srcIdx]);
      }
      const combined = [...cmdSegment, ...respSegment];
      const maxPeak = Math.max(...combined, 0.1);
      return {
        peaks: combined,
        splitRatio: derived.splitRatio,
        peakPercent: Math.round(maxPeak * 100),
        isTruePcm: true
      };
    }

    const maxPeak = Math.max(...entry.waveformPeaks, 0.1);
    return {
      peaks: entry.waveformPeaks,
      splitRatio: derived.splitRatio,
      peakPercent: Math.round(maxPeak * 100),
      isTruePcm: true
    };
  }

  const maxPeak = Math.max(...derived.peaks, 0.1);
  return {
    peaks: derived.peaks,
    splitRatio: derived.splitRatio,
    peakPercent: Math.round(maxPeak * 100),
    isTruePcm: false
  };
}

export async function fetchVoiceCommandLogs(params?: {
  source?: string;
  search?: string;
  limit?: number;
}): Promise<VoiceCommandLogEntry[]> {
  try {
    const query = new URLSearchParams();
    if (params?.source && params.source !== 'all') query.set('source', params.source);
    if (params?.search) query.set('search', params.search);
    if (params?.limit) query.set('limit', String(params.limit));

    const qs = query.toString();
    const res = await fetch(`/api/voice/command-logs${qs ? `?${qs}` : ''}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.logs) ? data.logs : [];
  } catch (err) {
    console.warn('Failed to fetch voice command logs:', err);
    return [];
  }
}

export async function logVoiceInteraction(
  input: LogVoiceInteractionInput
): Promise<VoiceCommandLogEntry | null> {
  const cleanCommand = (input.commandText || '').trim();
  const cleanResponse = (input.responseText || '').trim();
  if (!cleanCommand && !cleanResponse) return null;

  const entryId = input.id || `vlog-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  if (input.responseWavBase64) {
    sessionAudioCache.set(entryId, input.responseWavBase64);
    // Keep session audio cache bounded to most recent 25 turns
    if (sessionAudioCache.size > 25) {
      const oldestKey = sessionAudioCache.keys().next().value;
      if (oldestKey) sessionAudioCache.delete(oldestKey);
    }
  }

  let waveformPeaks = input.waveformPeaks;
  let peakIntensityDb = input.peakIntensityDb;

  if (!waveformPeaks && input.pcmBase64Chunks && input.pcmBase64Chunks.length > 0) {
    const extracted = extractWaveformEnvelopeFromPcmChunks(input.pcmBase64Chunks, 40);
    if (extracted) {
      waveformPeaks = extracted.peaks;
      if (peakIntensityDb === undefined) {
        peakIntensityDb = extracted.peakIntensityDb;
      }
    }
  }

  if (!waveformPeaks) {
    waveformPeaks = deriveProsodyWaveformEnvelope(cleanCommand, cleanResponse, 40).peaks;
  }

  try {
    const res = await fetch('/api/voice/command-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: entryId,
        timestamp: input.timestamp || Date.now(),
        source: input.source,
        commandText: cleanCommand,
        responseText: cleanResponse || undefined,
        voiceProfile: input.voiceProfile || jeremyIronsVoice.getLegacyProfile(),
        formantPreset: input.formantPreset || 'sovereign-gravitas',
        durationMs: input.durationMs,
        sessionId: input.sessionId,
        waveformPeaks,
        peakIntensityDb
      })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.entry || null;
  } catch (err) {
    console.warn('Failed to persist voice interaction log:', err);
    return null;
  }
}

export async function recordVoiceLogReplay(id: string): Promise<VoiceCommandLogEntry | null> {
  try {
    const res = await fetch(`/api/voice/command-logs/${encodeURIComponent(id)}/replay`, {
      method: 'PATCH'
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.entry || null;
  } catch {
    return null;
  }
}

export async function deleteVoiceCommandLog(id: string): Promise<boolean> {
  sessionAudioCache.delete(id);
  try {
    const res = await fetch(`/api/voice/command-logs/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function clearVoiceCommandLogs(): Promise<boolean> {
  sessionAudioCache.clear();
  try {
    const res = await fetch('/api/voice/command-logs', { method: 'DELETE' });
    return res.ok;
  } catch {
    return false;
  }
}

function buildConfigForEntry(entry: VoiceCommandLogEntry): Partial<JeremyIronsConfig> {
  const profileKey = (entry.voiceProfile as VoiceModulationProfile) || 'Jeremy-Irons-Signature';
  return resolveMergedDSPConfig(profileKey, entry.formantPreset);
}

export function stopVoiceLogReplay(): void {
  activeReplayToken++;
  jeremyIronsVoice.stop();
}

export function hasCachedLiveAudio(entryId: string): boolean {
  return sessionAudioCache.has(entryId);
}

/**
 * Replays a logged voice interaction (either full Principal -> Steward exchange, command only, or response only)
 * directly through the Jeremy Irons DSP playback pipeline (or cached Live Bridge PCM audio when available).
 */
export async function replayVoiceLogEntry(
  entry: VoiceCommandLogEntry,
  mode: ReplayMode = 'full',
  callbacks?: {
    onPhaseChange?: (phase: ReplayPhase) => void;
    onReplayRecorded?: (updated: VoiceCommandLogEntry) => void;
    onFinish?: () => void;
  }
): Promise<void> {
  const myToken = ++activeReplayToken;
  jeremyIronsVoice.stop();
  await jeremyIronsVoice.unlockAudio();

  const resolvedConfig = buildConfigForEntry(entry);
  const hasCommand = Boolean(entry.commandText && entry.commandText.trim() && !entry.commandText.startsWith('(Spoken response'));
  const hasResponse = Boolean(entry.responseText && entry.responseText.trim());

  // Record replay telemetry non-blockingly
  void recordVoiceLogReplay(entry.id).then((updated) => {
    if (updated) callbacks?.onReplayRecorded?.(updated);
  });

  const waitSpeak = (text: string, cfg: Partial<JeremyIronsConfig>): Promise<void> => {
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve();
      };
      void jeremyIronsVoice
        .speak(text, cfg, undefined, finish)
        .then((started) => {
          if (!started) finish();
        })
        .catch(() => finish());
    });
  };

  const waitCachedWav = (wavBase64: string, cfg: Partial<JeremyIronsConfig>, label: string): Promise<boolean> => {
    return new Promise((resolve) => {
      let done = false;
      const finish = (ok: boolean) => {
        if (done) return;
        done = true;
        resolve(ok);
      };
      void jeremyIronsVoice
        .playBase64Audio(wavBase64, cfg, undefined, () => finish(true), label)
        .then((ok) => {
          if (!ok) finish(false);
        })
        .catch(() => finish(false));
    });
  };

  try {
    // 1. Synthesizer entries speak the synthesized text directly under the Steward voice
    if (entry.source === 'synthesizer' && hasCommand) {
      if (myToken !== activeReplayToken) return;
      callbacks?.onPhaseChange?.('command');
      await waitSpeak(entry.commandText, resolvedConfig);
      return;
    }

    // 2. Play Principal command if mode is 'command' or 'full'
    if ((mode === 'command' || mode === 'full') && hasCommand) {
      if (myToken !== activeReplayToken) return;
      callbacks?.onPhaseChange?.('command');
      const commandConfig: Partial<JeremyIronsConfig> = {
        ...resolvedConfig,
        baseVoice: 'Charon',
        pitchRate: 0.87,
        speechRate: 0.94,
        gravelAmount: 0.35
      };
      await waitSpeak(entry.commandText, commandConfig);
    }

    if (myToken !== activeReplayToken) return;

    // Pause briefly between speakers when replaying a two-way exchange
    if (mode === 'full' && hasCommand && hasResponse) {
      await new Promise((r) => setTimeout(r, 280));
      if (myToken !== activeReplayToken) return;
    }

    // 3. Play Steward response if mode is 'response' or 'full'
    if ((mode === 'response' || mode === 'full') && hasResponse && entry.responseText) {
      callbacks?.onPhaseChange?.('response');
      const cachedWav = sessionAudioCache.get(entry.id);
      let playedCached = false;
      if (cachedWav) {
        playedCached = await waitCachedWav(cachedWav, resolvedConfig, entry.responseText);
      }
      if (!playedCached && myToken === activeReplayToken) {
        await waitSpeak(entry.responseText, resolvedConfig);
      }
    }
  } finally {
    if (myToken === activeReplayToken) {
      callbacks?.onPhaseChange?.('idle');
      callbacks?.onFinish?.();
    }
  }
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  if (typeof document === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const formatSourceAuditLabel = (src: VoiceCommandSource): string =>
  src === 'live_bridge'
    ? 'Live Audio Bridge'
    : src === 'conversation_mode'
    ? 'Conversation Mode'
    : 'Vocal Synthesizer';

export function exportVoiceLogsAsText(logs: VoiceCommandLogEntry[], selectionLabel?: string): void {
  if (!logs || logs.length === 0 || typeof document === 'undefined') return;

  const now = new Date();
  const lines = [
    'ZEREO STEWARD — VOICE COMMAND AUDIT TRANSCRIPT',
    `Exported (UTC):   ${now.toISOString()}`,
    `Exported (Local): ${now.toLocaleString()}`,
    `Selection Scope:  ${selectionLabel || `${logs.length} archived interaction(s)`}`,
    '========================================================================',
    ''
  ];

  logs.forEach((entry, index) => {
    const d = new Date(entry.timestamp);
    const metaParts = [
      `Entry #${index + 1}`,
      `ID: ${entry.id}`,
      `Source: ${formatSourceAuditLabel(entry.source)}`,
      `Profile: ${entry.voiceProfile || 'Jeremy-Irons-Signature'}`,
      entry.formantPreset ? `Formant: ${entry.formantPreset}` : '',
      typeof entry.durationMs === 'number' ? `Duration: ${(entry.durationMs / 1000).toFixed(1)}s` : '',
      typeof entry.replayCount === 'number' && entry.replayCount > 0 ? `Replays: ${entry.replayCount}` : '',
      entry.sessionId ? `Session: ${entry.sessionId}` : ''
    ].filter(Boolean);

    lines.push(`[${d.toISOString()} | ${d.toLocaleString()}]`);
    lines.push(metaParts.join(' · '));
    if (entry.commandText) {
      lines.push(
        entry.source === 'synthesizer'
          ? `Synthesized Prompt: ${entry.commandText}`
          : `Principal Command:  ${entry.commandText}`
      );
    }
    if (entry.responseText) {
      lines.push(`Steward Response:   ${entry.responseText}`);
    }
    lines.push('------------------------------------------------------------------------');
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  triggerBlobDownload(blob, `zereo-voice-audit-${now.toISOString().slice(0, 10)}.txt`);
}

export function exportVoiceLogsAsJson(logs: VoiceCommandLogEntry[], selectionLabel?: string): void {
  if (!logs || logs.length === 0 || typeof document === 'undefined') return;

  const now = new Date();
  const payload = {
    archive: 'ZEREO_VOICE_AUDIT_TRANSCRIPT',
    schemaVersion: '1.0',
    exportedAt: now.toISOString(),
    exportedLocal: now.toLocaleString(),
    selectionScope: selectionLabel || `${logs.length} interaction(s)`,
    totalEntries: logs.length,
    sourcesIncluded: Array.from(new Set(logs.map((l) => l.source))),
    entries: logs.map((entry) => ({
      id: entry.id,
      timestamp: entry.timestamp,
      isoTimestamp: new Date(entry.timestamp).toISOString(),
      source: entry.source,
      sourceLabel: formatSourceAuditLabel(entry.source),
      voiceProfile: entry.voiceProfile || 'Jeremy-Irons-Signature',
      formantPreset: entry.formantPreset || 'sovereign-gravitas',
      durationMs: entry.durationMs ?? null,
      replayCount: entry.replayCount ?? 0,
      lastReplayedAt: entry.lastReplayedAt ? new Date(entry.lastReplayedAt).toISOString() : null,
      sessionId: entry.sessionId ?? null,
      commandText: entry.commandText,
      responseText: entry.responseText ?? null
    }))
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8'
  });
  triggerBlobDownload(blob, `zereo-voice-audit-${now.toISOString().slice(0, 10)}.json`);
}

export function exportSelectedVoiceLogs(
  logs: VoiceCommandLogEntry[],
  format: 'txt' | 'json',
  selectionLabel?: string
): void {
  if (format === 'json') {
    exportVoiceLogsAsJson(logs, selectionLabel);
  } else {
    exportVoiceLogsAsText(logs, selectionLabel);
  }
}

export function exportVoiceLogsTranscript(logs: VoiceCommandLogEntry[]): void {
  exportVoiceLogsAsText(logs);
}
