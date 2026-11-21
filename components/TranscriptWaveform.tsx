import React, { useEffect, useMemo, useState } from 'react';
import { VoiceCommandLogEntry } from '../types';
import {
  getEntryWaveformData,
  ReplayMode,
  ReplayPhase
} from '../services/voiceCommandLogService';

interface TranscriptWaveformProps {
  entry: VoiceCommandLogEntry;
  isPlaying: boolean;
  replayPhase: ReplayPhase;
  replayMode: ReplayMode;
  onPlaySegment: (mode: ReplayMode) => void;
}

const TranscriptWaveform: React.FC<TranscriptWaveformProps> = ({
  entry,
  isPlaying,
  replayPhase,
  replayMode,
  onPlaySegment
}) => {
  const { peaks, splitRatio, peakPercent, isTruePcm } = useMemo(
    () => getEntryWaveformData(entry),
    [entry]
  );

  const [progress, setProgress] = useState<number>(0);

  // Estimate phase durations in ms from actual durationMs or text word/character cadence
  const { cmdDurationMs, respDurationMs } = useMemo(() => {
    const cmdChars = (entry.commandText || '').replace(/^\(Spoken response without input transcript\)$/i, '').trim().length;
    const respChars = (entry.responseText || '').trim().length;
    const totalChars = Math.max(1, cmdChars + respChars);
    const totalEstMs = entry.durationMs && entry.durationMs > 800
      ? entry.durationMs
      : Math.max(1800, Math.min(28000, totalChars * 72));

    if (cmdChars > 0 && respChars > 0) {
      const ratio = cmdChars / totalChars;
      return {
        cmdDurationMs: Math.max(900, Math.round(totalEstMs * ratio)),
        respDurationMs: Math.max(1100, Math.round(totalEstMs * (1 - ratio)))
      };
    }
    return {
      cmdDurationMs: cmdChars > 0 ? totalEstMs : 0,
      respDurationMs: respChars > 0 ? totalEstMs : 0
    };
  }, [entry.commandText, entry.responseText, entry.durationMs]);

  useEffect(() => {
    if (!isPlaying || replayPhase === 'idle') {
      setProgress(0);
      return;
    }

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const split = splitRatio ?? (replayMode === 'command' ? 1 : replayMode === 'response' ? 0 : 0.45);
    const segStart = replayPhase === 'response' && splitRatio !== null ? split : 0;
    const segEnd = replayPhase === 'command' && splitRatio !== null ? split : 1;

    if (reducedMotion) {
      setProgress((segStart + segEnd) / 2);
      return;
    }

    const segDuration = replayPhase === 'command' ? Math.max(900, cmdDurationMs) : Math.max(1100, respDurationMs);
    const startedAt = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const elapsed = now - startedAt;
      const frac = Math.min(0.98, elapsed / segDuration);
      setProgress(segStart + (segEnd - segStart) * frac);
      if (frac < 0.98) {
        rafId = requestAnimationFrame(tick);
      }
    };

    setProgress(segStart);
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, replayPhase, replayMode, splitRatio, cmdDurationMs, respDurationMs]);

  const barCount = peaks.length;
  const viewWidth = barCount * 10;
  const viewHeight = 36;
  const barWidth = 5.5;
  const playheadBarIdx = isPlaying ? Math.min(barCount - 1, Math.floor(progress * barCount)) : -1;

  const hasTwoWaySplit = splitRatio !== null && Boolean(entry.responseText?.trim());
  const splitX = splitRatio !== null ? Math.round(splitRatio * viewWidth) : null;

  const handleWaveformClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isPlaying) {
      onPlaySegment('full');
      return;
    }
    if (hasTwoWaySplit && splitRatio !== null) {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickRatio = (e.clientX - rect.left) / Math.max(1, rect.width);
      onPlaySegment(clickRatio < splitRatio ? 'command' : 'response');
    } else {
      onPlaySegment('full');
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-zinc-800/40 space-y-1.5">
      <button
        type="button"
        onClick={handleWaveformClick}
        aria-label={
          isPlaying
            ? 'Stop waveform playback'
            : hasTwoWaySplit
            ? 'Play audio waveform (left for Principal command, right for Steward response)'
            : 'Play audio waveform'
        }
        title={
          isPlaying
            ? 'Click to stop playback'
            : hasTwoWaySplit
            ? 'Click left half for Command, right half for Response'
            : 'Click waveform to play'
        }
        className={`w-full block rounded-xl px-3 py-2 border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
          isPlaying
            ? 'bg-amber-950/25 border-amber-500/40'
            : 'bg-black/50 border-zinc-800/80 hover:border-amber-500/35'
        }`}
      >
        <svg
          viewBox={`0 0 ${viewWidth} ${viewHeight}`}
          preserveAspectRatio="none"
          className="w-full h-9 overflow-visible"
          aria-hidden="true"
        >
          {/* Center baseline */}
          <line
            x1={0}
            y1={viewHeight / 2}
            x2={viewWidth}
            y2={viewHeight / 2}
            className="stroke-zinc-800/80"
            strokeWidth={0.8}
          />

          {/* Two-way speaker boundary divider */}
          {splitX !== null && (
            <line
              x1={splitX}
              y1={2}
              x2={splitX}
              y2={viewHeight - 2}
              className="stroke-red-800/70"
              strokeWidth={1}
              strokeDasharray="2 2"
            />
          )}

          {peaks.map((amp, idx) => {
            const clamped = Math.min(1, Math.max(0.08, amp));
            const h = Math.max(3, clamped * (viewHeight - 4));
            const y = (viewHeight - h) / 2;
            const x = idx * 10 + 2;

            let fillClass = 'fill-zinc-600/80';
            if (isPlaying) {
              if (idx < playheadBarIdx) {
                fillClass = 'fill-amber-400';
              } else if (idx === playheadBarIdx) {
                fillClass = 'fill-amber-200';
              } else if (clamped >= 0.72) {
                fillClass = 'fill-red-800/60';
              } else {
                fillClass = 'fill-zinc-700/60';
              }
            } else {
              if (clamped >= 0.76) {
                fillClass = 'fill-amber-500/90';
              } else if (clamped >= 0.48) {
                fillClass = 'fill-red-700/85';
              } else {
                fillClass = 'fill-zinc-600/85';
              }
            }

            return (
              <rect
                key={idx}
                x={x}
                y={y}
                width={barWidth}
                height={h}
                rx={1.5}
                className={`${fillClass} transition-colors duration-150`}
              />
            );
          })}
        </svg>
      </button>

      {/* Quiet unboxed intensity telemetry line */}
      <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 tabular-nums px-0.5">
        <div className="flex items-center gap-2">
          <span>{isTruePcm ? 'Live PCM Envelope' : 'Vocal Cadence Envelope'}</span>
          <span className="text-zinc-700" aria-hidden="true">·</span>
          <span className={peakPercent >= 75 ? 'text-amber-400/90' : 'text-zinc-400'}>
            Peak {peakPercent}%
          </span>
          {typeof entry.peakIntensityDb === 'number' && (
            <>
              <span className="text-zinc-700" aria-hidden="true">·</span>
              <span>{entry.peakIntensityDb.toFixed(1)} dBFS</span>
            </>
          )}
        </div>

        {hasTwoWaySplit ? (
          <div className="flex items-center gap-2 text-zinc-500">
            <span className={isPlaying && replayPhase === 'command' ? 'text-amber-300 font-semibold' : ''}>
              Principal
            </span>
            <span className="text-zinc-700" aria-hidden="true">/</span>
            <span className={isPlaying && replayPhase === 'response' ? 'text-amber-300 font-semibold' : ''}>
              Steward
            </span>
          </div>
        ) : (
          <span className={isPlaying ? 'text-amber-300 font-semibold' : ''}>
            {isPlaying ? 'Replaying Audio' : 'Audio Intensity'}
          </span>
        )}
      </div>
    </div>
  );
};

export default TranscriptWaveform;
