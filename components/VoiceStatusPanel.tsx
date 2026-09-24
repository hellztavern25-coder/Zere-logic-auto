import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { Socket } from 'socket.io-client';
import { 
  Activity, 
  Volume2, 
  Sliders, 
  Radio, 
  Zap, 
  RefreshCw, 
  Play, 
  Pause, 
  Cpu, 
  Layers, 
  Terminal, 
  CheckCircle2, 
  AlertTriangle,
  RotateCcw,
  Sparkles
} from 'lucide-react';

export interface VoiceDspMetrics {
  ownership?: {
    verified: boolean;
    architect: string;
    biometricId: string;
    daemonStatus: string;
    confidenceScore: number;
    verificationMethod: string;
    verifiedAt: number | null;
  };
  pitch: {
    fundamentalHz: number;
    effectiveHz: number;
    shiftSemitones: number;
    cents: number;
    trackingStability: number;
    jitterPct: number;
    musicalNote: string;
  };
  gain: {
    inputGainDb: number;
    outputLevelDb: number;
    rmsDb: number;
    peakDb: number;
    compressionRatio: number;
    noiseFloorDb: number;
    clippingDetected: boolean;
  };
  ringMod: {
    carrierFreqHz: number;
    depthPercent: number;
    waveform: 'sine' | 'triangle' | 'square';
    blendMix: number;
    sidebandSpreadHz: number;
    distortionHarmonics: number;
    isActive: boolean;
  };
  spectral: {
    subBass: number;
    bass: number;
    lowMid: number;
    mid: number;
    highMid: number;
    presence: number;
    brilliance: number;
  };
  pipeline: {
    sampleRate: number;
    bufferSize: number;
    latencyMs: number;
    cpuLoadPct: number;
    packetsProcessed: number;
    daemonUptimeSec: number;
    unixSocketPath: string;
    daemonPid: number;
    status: string;
    timestamp: number;
  };
}

export interface VoiceStatusResponse {
  success: boolean;
  ipc: string;
  socketPath: string;
  roundTripUs: number;
  metrics: VoiceDspMetrics;
}

interface VoiceStatusPanelProps {
  socket?: Socket | null;
  className?: string;
}

export const VoiceStatusPanel: React.FC<VoiceStatusPanelProps> = ({ socket, className = '' }) => {
  const [metrics, setMetrics] = useState<VoiceDspMetrics | null>(null);
  const [ipcInfo, setIpcInfo] = useState<{ ipc: string; socketPath: string; roundTripUs: number } | null>(null);
  const [isPolling, setIsPolling] = useState<boolean>(true);
  const [pollIntervalMs, setPollIntervalMs] = useState<number>(350);
  const [isUpdatingParam, setIsUpdatingParam] = useState<boolean>(false);
  const [lastPollTime, setLastPollTime] = useState<number>(Date.now());
  const [historyF0, setHistoryF0] = useState<number[]>([]);
  const [historyPeak, setHistoryPeak] = useState<number[]>([]);

  // Local control state mirrors
  const [pitchShift, setPitchShift] = useState<number>(-2.4);
  const [gainTrim, setGainTrim] = useState<number>(2.2);
  const [ringModCarrier, setRingModCarrier] = useState<number>(42.0);
  const [ringModDepth, setRingModDepth] = useState<number>(34);
  const [ringModActive, setRingModActive] = useState<boolean>(true);
  const [ringModWaveform, setRingModWaveform] = useState<'sine' | 'triangle' | 'square'>('sine');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Poll Unix Socket Daemon via HTTP API
  const fetchDspTelemetry = useCallback(async () => {
    try {
      const res = await fetch('/api/voice/dsp-status');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: VoiceStatusResponse = await res.json();
      
      if (data.metrics) {
        setMetrics(data.metrics);
        setIpcInfo({
          ipc: data.ipc,
          socketPath: data.socketPath,
          roundTripUs: data.roundTripUs
        });
        setLastPollTime(Date.now());

        // Update local history traces (up to 30 data points)
        setHistoryF0(prev => [...prev.slice(-29), data.metrics.pitch.fundamentalHz]);
        setHistoryPeak(prev => [...prev.slice(-29), data.metrics.gain.peakDb]);
      }
    } catch (err) {
      console.warn('Voice DSP polling error:', err);
    }
  }, []);

  // Polling loop
  useEffect(() => {
    if (!isPolling) return;

    fetchDspTelemetry();
    pollTimerRef.current = setInterval(fetchDspTelemetry, pollIntervalMs);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [isPolling, pollIntervalMs, fetchDspTelemetry]);

  // Listen for websocket telemetry push if available
  useEffect(() => {
    if (!socket) return;

    const handleWebsocketMetrics = (payload: { metrics: VoiceDspMetrics; socketPath: string }) => {
      if (payload?.metrics) {
        setMetrics(payload.metrics);
        setLastPollTime(Date.now());
      }
    };

    socket.on('voice:dsp_metrics', handleWebsocketMetrics);

    return () => {
      socket.off('voice:dsp_metrics', handleWebsocketMetrics);
    };
  }, [socket]);

  // Dispatch DSP parameters update to Unix Daemon
  const updateDspParam = async (updates: Partial<{
    pitchShift: number;
    gainTrim: number;
    ringModCarrier: number;
    ringModDepth: number;
    ringModActive: boolean;
    ringModWaveform: 'sine' | 'triangle' | 'square';
  }>) => {
    setIsUpdatingParam(true);
    try {
      if (socket) {
        socket.emit('voice:dsp_set', updates);
      }

      const res = await fetch('/api/voice/dsp-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      if (res.ok) {
        const data = await res.json();
        if (data.metrics) {
          setMetrics(data.metrics);
        }
      }
    } catch (err) {
      console.error('Failed to update DSP params:', err);
    } finally {
      setIsUpdatingParam(false);
    }
  };

  // Preset Handlers
  const applyPreset = (name: 'butler' | 'council' | 'radio' | 'bypass') => {
    switch (name) {
      case 'butler':
        setPitchShift(-2.4);
        setGainTrim(2.2);
        setRingModCarrier(42.0);
        setRingModDepth(34);
        setRingModActive(true);
        setRingModWaveform('sine');
        updateDspParam({
          pitchShift: -2.4,
          gainTrim: 2.2,
          ringModCarrier: 42.0,
          ringModDepth: 34,
          ringModActive: true,
          ringModWaveform: 'sine'
        });
        break;
      case 'council':
        setPitchShift(-1.8);
        setGainTrim(3.0);
        setRingModCarrier(58.0);
        setRingModDepth(22);
        setRingModActive(true);
        setRingModWaveform('sine');
        updateDspParam({
          pitchShift: -1.8,
          gainTrim: 3.0,
          ringModCarrier: 58.0,
          ringModDepth: 22,
          ringModActive: true,
          ringModWaveform: 'sine'
        });
        break;
      case 'radio':
        setPitchShift(0.0);
        setGainTrim(4.2);
        setRingModCarrier(115.0);
        setRingModDepth(52);
        setRingModActive(true);
        setRingModWaveform('square');
        updateDspParam({
          pitchShift: 0.0,
          gainTrim: 4.2,
          ringModCarrier: 115.0,
          ringModDepth: 52,
          ringModActive: true,
          ringModWaveform: 'square'
        });
        break;
      case 'bypass':
        setPitchShift(0.0);
        setGainTrim(0.0);
        setRingModCarrier(40.0);
        setRingModDepth(0);
        setRingModActive(false);
        setRingModWaveform('sine');
        updateDspParam({
          pitchShift: 0.0,
          gainTrim: 0.0,
          ringModCarrier: 40.0,
          ringModDepth: 0,
          ringModActive: false,
          ringModWaveform: 'sine'
        });
        break;
    }
  };

  // Real-time Canvas Waveform / Ring Mod Oscilloscope
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Dark tactical phosphor background
      ctx.fillStyle = '#0a0a0c';
      ctx.fillRect(0, 0, width, height);

      // Grid hairlines
      ctx.strokeStyle = 'rgba(153, 27, 27, 0.2)';
      ctx.lineWidth = 1;
      
      // Horizontal center
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      // Vertical quadrant ticks
      for (let x = 0; x < width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Draw Ring Modulated Signal Wave
      const carrierFreq = metrics?.ringMod.carrierFreqHz || ringModCarrier;
      const depth = (metrics?.ringMod.depthPercent ?? ringModDepth) / 100;
      const isActive = metrics?.ringMod.isActive ?? ringModActive;
      const waveformType = metrics?.ringMod.waveform || ringModWaveform;

      ctx.lineWidth = 2;
      ctx.strokeStyle = isActive ? '#fbbf24' : '#71717a';
      ctx.shadowColor = isActive ? '#f59e0b' : 'transparent';
      ctx.shadowBlur = isActive ? 8 : 0;

      ctx.beginPath();
      for (let x = 0; x < width; x++) {
        const normX = x / width;
        // Modulator: slow speech formant simulation
        const mod = Math.sin(normX * 12 + phase * 0.8) * Math.cos(normX * 4 + phase * 0.4);
        
        // Carrier wave
        let carrier = 0;
        const carrierPhase = normX * (carrierFreq / 4) + phase * 2.5;
        if (waveformType === 'square') {
          carrier = Math.sin(carrierPhase) >= 0 ? 0.8 : -0.8;
        } else if (waveformType === 'triangle') {
          carrier = (2 / Math.PI) * Math.asin(Math.sin(carrierPhase));
        } else {
          carrier = Math.sin(carrierPhase);
        }

        // Ring modulation = carrier * modulator (with depth blend)
        const sample = isActive 
          ? (mod * (1 - depth) + (mod * carrier) * depth) 
          : mod;

        const y = (height / 2) + sample * (height * 0.38);

        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Secondary crimson harmonic trace
      if (isActive) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.beginPath();
        for (let x = 0; x < width; x += 2) {
          const normX = x / width;
          const carrierPhase = normX * (carrierFreq / 2) + phase * 3.0;
          const sample = Math.sin(carrierPhase) * 0.3;
          const y = (height / 2) + sample * (height * 0.25);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      phase += 0.05;
      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [metrics, ringModCarrier, ringModDepth, ringModActive, ringModWaveform]);

  // Fallback / default metrics while booting
  const activePitch = metrics?.pitch || {
    fundamentalHz: 118.0,
    effectiveHz: 102.2,
    shiftSemitones: pitchShift,
    cents: -40,
    trackingStability: 98.8,
    jitterPct: 0.35,
    musicalNote: 'G#2'
  };

  const activeGain = metrics?.gain || {
    inputGainDb: gainTrim,
    outputLevelDb: -14.2,
    rmsDb: -17.8,
    peakDb: -11.4,
    compressionRatio: 3.4,
    noiseFloorDb: -64.2,
    clippingDetected: false
  };

  const activeRingMod = metrics?.ringMod || {
    carrierFreqHz: ringModCarrier,
    depthPercent: ringModDepth,
    waveform: ringModWaveform,
    blendMix: 0.34,
    sidebandSpreadHz: 84.0,
    distortionHarmonics: 0.09,
    isActive: ringModActive
  };

  const activeSpectral = metrics?.spectral || {
    subBass: 75,
    bass: 88,
    lowMid: 70,
    mid: 62,
    highMid: 54,
    presence: 48,
    brilliance: 38
  };

  const activePipeline = metrics?.pipeline || {
    sampleRate: 48000,
    bufferSize: 256,
    latencyMs: 2.35,
    cpuLoadPct: 3.4,
    packetsProcessed: 1,
    daemonUptimeSec: 10,
    unixSocketPath: '/tmp/voice_dsp_daemon.sock',
    daemonPid: 1,
    status: 'ACTIVE',
    timestamp: Date.now()
  };

  // Convert dB to percentage for VU meters (-60 dB to +6 dB scale)
  const dbToPercent = (db: number) => {
    const clamped = Math.max(-60, Math.min(6, db));
    return Math.round(((clamped + 60) / 66) * 100);
  };

  return (
    <div className={`w-full bg-[#0b0b0e] border border-red-900/30 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden ${className}`}>
      {/* Decorative top illumination rail */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />

      {/* 1. Header & Unix Socket Daemon Status Bar */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-red-900/30 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="relative flex items-center justify-center p-2.5 rounded-xl bg-red-950/40 border border-red-800/40 text-amber-400">
            <Radio className="w-5 h-5 animate-pulse" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-base font-bold text-amber-400 uppercase tracking-widest">
                Voice DSP Telemetry
              </h3>
              <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800/40 text-emerald-400 font-bold tracking-wider">
                {ipcInfo?.ipc || 'UNIX_SOCKET'}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-[10px] font-mono text-zinc-400">
                Unix Socket Daemon: <span className="text-zinc-300 font-semibold">{ipcInfo?.socketPath || activePipeline.unixSocketPath}</span>
              </p>
              <span className={`text-[8px] font-mono px-2 py-0.2 rounded-full font-bold uppercase ${
                metrics?.ownership?.verified || activePipeline.status === 'ACTIVE'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : 'bg-red-950/60 text-red-400 border border-red-800/40'
              }`}>
                {metrics?.ownership?.verified || activePipeline.status === 'ACTIVE' ? 'PRINCIPAL VERIFIED' : 'GATED / LOCKED'}
              </span>
            </div>
          </div>
        </div>

        {/* Polling & Telemetry Controls */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-between lg:justify-end">
          {/* IPC Latency badge */}
          <div className="px-3 py-1.5 rounded-xl bg-black/60 border border-red-900/30 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[9px] font-mono text-zinc-400 uppercase">IPC Latency:</span>
            <span className="text-[10px] font-mono font-bold text-amber-300">
              {ipcInfo?.roundTripUs ? `${(ipcInfo.roundTripUs / 1000).toFixed(2)} ms` : `${activePipeline.latencyMs} ms`}
            </span>
          </div>

          {/* Polling Speed Switcher */}
          <div className="flex items-center bg-black/60 border border-red-900/30 rounded-xl p-1 gap-1">
            <span className="text-[8px] font-mono text-zinc-400 px-1.5 uppercase">Poll Rate:</span>
            {[
              { label: '250ms', value: 250 },
              { label: '500ms', value: 500 },
              { label: '1s', value: 1000 }
            ].map(rate => (
              <button
                key={rate.value}
                onClick={() => setPollIntervalMs(rate.value)}
                className={`px-2 py-0.5 text-[9px] font-mono rounded transition-colors ${
                  pollIntervalMs === rate.value
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {rate.label}
              </button>
            ))}
          </div>

          {/* Pause / Resume Polling */}
          <button
            onClick={() => setIsPolling(!isPolling)}
            className={`p-2 rounded-xl border transition-all flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider ${
              isPolling
                ? 'bg-amber-950/30 text-amber-400 border-amber-500/40 hover:bg-amber-900/40'
                : 'bg-red-950/40 text-red-400 border-red-800/50 hover:bg-red-900/40'
            }`}
            title={isPolling ? 'Pause Unix Socket Polling' : 'Resume Unix Socket Polling'}
          >
            {isPolling ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPolling ? 'Live' : 'Paused'}</span>
          </button>

          {/* Manual Poll Trigger */}
          <button
            onClick={fetchDspTelemetry}
            className="p-2 rounded-xl bg-black/60 border border-red-900/40 text-zinc-400 hover:text-amber-300 transition-colors"
            title="Force Query Unix Socket Daemon"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Tactical Core Metrics Grid: Pitch, Gain, Ring Mod */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* ================= PITCH TELEMETRY ================= */}
        <div className="bg-black/50 border border-red-900/30 rounded-2xl p-5 space-y-4 relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-red-900/20 pb-2.5">
            <div className="flex items-center gap-2 text-amber-400">
              <Zap className="w-4 h-4" />
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider">Pitch Tracking & F0</h4>
            </div>
            <span className="text-[11px] font-mono font-black text-amber-300 px-2 py-0.5 rounded bg-amber-950/40 border border-amber-900/50">
              {activePitch.musicalNote}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[9px] font-mono uppercase text-zinc-400">Fundamental (F0)</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-2xl font-mono font-black text-amber-400">
                  {activePitch.fundamentalHz}
                </span>
                <span className="text-[10px] font-mono text-zinc-400">Hz</span>
              </div>
            </div>
            <div>
              <span className="text-[9px] font-mono uppercase text-zinc-400">Effective Pitch</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-2xl font-mono font-black text-zinc-200">
                  {activePitch.effectiveHz}
                </span>
                <span className="text-[10px] font-mono text-zinc-400">Hz</span>
              </div>
            </div>
          </div>

          {/* Pitch Shift Semitones & Detune Needle */}
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-[9px] font-mono">
              <span className="text-zinc-400">SEMITONE TRANSPOSE:</span>
              <span className="text-amber-300 font-bold">{activePitch.shiftSemitones > 0 ? `+${activePitch.shiftSemitones}` : activePitch.shiftSemitones} ST</span>
            </div>
            <input 
              type="range"
              min="-12"
              max="12"
              step="0.1"
              value={pitchShift}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setPitchShift(val);
                updateDspParam({ pitchShift: val });
              }}
              className="w-full accent-amber-500 bg-red-950/60 rounded-lg cursor-pointer h-1.5"
            />
            <div className="flex justify-between text-[8px] font-mono text-zinc-400">
              <span>-12 ST (Sub)</span>
              <span>0 (Flat)</span>
              <span>+12 ST (High)</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[9px] font-mono border-t border-red-900/20 pt-2 text-zinc-400">
            <span>STABILITY: <strong className="text-emerald-400">{activePitch.trackingStability}%</strong></span>
            <span>JITTER: <strong className="text-zinc-300">{activePitch.jitterPct}%</strong></span>
          </div>
        </div>

        {/* ================= GAIN & DYNAMICS ================= */}
        <div className="bg-black/50 border border-red-900/30 rounded-2xl p-5 space-y-4 relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-red-900/20 pb-2.5">
            <div className="flex items-center gap-2 text-amber-400">
              <Volume2 className="w-4 h-4" />
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider">Gain Stage & VU</h4>
            </div>
            {activeGain.clippingDetected ? (
              <span className="flex items-center gap-1 text-[9px] font-mono font-bold text-red-400 bg-red-950/60 px-2 py-0.5 rounded border border-red-700 animate-pulse">
                <AlertTriangle className="w-3 h-3" /> CLIP
              </span>
            ) : (
              <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-800/40">
                HEADROOM OK
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[9px] font-mono uppercase text-zinc-400">Peak Level</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className={`text-2xl font-mono font-black ${
                  activeGain.peakDb > -3 ? 'text-red-400' : 'text-amber-400'
                }`}>
                  {activeGain.peakDb}
                </span>
                <span className="text-[10px] font-mono text-zinc-400">dB</span>
              </div>
            </div>
            <div>
              <span className="text-[9px] font-mono uppercase text-zinc-400">RMS Energy</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-2xl font-mono font-black text-zinc-200">
                  {activeGain.rmsDb}
                </span>
                <span className="text-[10px] font-mono text-zinc-400">dB</span>
              </div>
            </div>
          </div>

          {/* VU Level Meters (Peak & RMS) */}
          <div className="space-y-2 pt-1">
            <div>
              <div className="flex justify-between text-[8px] font-mono text-zinc-400 mb-0.5">
                <span>PEAK</span>
                <span>{activeGain.peakDb} dB</span>
              </div>
              <div className="h-2 w-full bg-black rounded-full overflow-hidden border border-red-900/30 relative">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 via-amber-400 to-red-500 transition-all duration-150 rounded-full"
                  style={{ width: `${dbToPercent(activeGain.peakDb)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[8px] font-mono text-zinc-400 mb-0.5">
                <span>RMS</span>
                <span>{activeGain.rmsDb} dB</span>
              </div>
              <div className="h-1.5 w-full bg-black rounded-full overflow-hidden border border-red-900/30 relative">
                <div 
                  className="h-full bg-amber-400/80 transition-all duration-150 rounded-full"
                  style={{ width: `${dbToPercent(activeGain.rmsDb)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Input Gain Trim Slider */}
          <div className="space-y-1 border-t border-red-900/20 pt-2">
            <div className="flex justify-between text-[9px] font-mono">
              <span className="text-zinc-400">INPUT TRIM:</span>
              <span className="text-amber-300 font-bold">{activeGain.inputGainDb > 0 ? `+${activeGain.inputGainDb}` : activeGain.inputGainDb} dB</span>
            </div>
            <input 
              type="range"
              min="-12"
              max="12"
              step="0.2"
              value={gainTrim}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setGainTrim(val);
                updateDspParam({ gainTrim: val });
              }}
              className="w-full accent-amber-500 bg-red-950/60 rounded-lg cursor-pointer h-1.5"
            />
          </div>
        </div>

        {/* ================= RING MODULATION ================= */}
        <div className="bg-black/50 border border-red-900/30 rounded-2xl p-5 space-y-4 relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-red-900/20 pb-2.5">
            <div className="flex items-center gap-2 text-amber-400">
              <Activity className="w-4 h-4" />
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider">Ring Modulation</h4>
            </div>
            <button
              onClick={() => {
                const nextActive = !ringModActive;
                setRingModActive(nextActive);
                updateDspParam({ ringModActive: nextActive });
              }}
              className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded transition-colors ${
                activeRingMod.isActive
                  ? 'bg-amber-950/60 border border-amber-500/50 text-amber-300'
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-400'
              }`}
            >
              {activeRingMod.isActive ? 'ENGAGED' : 'BYPASSED'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[9px] font-mono uppercase text-zinc-400">Carrier Freq</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-2xl font-mono font-black text-amber-400">
                  {activeRingMod.carrierFreqHz}
                </span>
                <span className="text-[10px] font-mono text-zinc-400">Hz</span>
              </div>
            </div>
            <div>
              <span className="text-[9px] font-mono uppercase text-zinc-400">Mod Depth</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-2xl font-mono font-black text-zinc-200">
                  {activeRingMod.depthPercent}
                </span>
                <span className="text-[10px] font-mono text-zinc-400">%</span>
              </div>
            </div>
          </div>

          {/* Carrier Waveform Selector */}
          <div className="flex items-center justify-between gap-1 bg-black/60 p-1 rounded-xl border border-red-900/20">
            {(['sine', 'triangle', 'square'] as const).map(wf => (
              <button
                key={wf}
                onClick={() => {
                  setRingModWaveform(wf);
                  updateDspParam({ ringModWaveform: wf });
                }}
                className={`flex-1 py-1 text-[9px] font-mono uppercase rounded transition-colors ${
                  activeRingMod.waveform === wf
                    ? 'bg-red-950/60 border border-amber-500/40 text-amber-300 font-bold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {wf}
              </button>
            ))}
          </div>

          {/* Carrier Adjuster Slider */}
          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-[9px] font-mono">
              <span className="text-zinc-400">CARRIER SWEEP:</span>
              <span className="text-amber-300 font-bold">{activeRingMod.carrierFreqHz} Hz</span>
            </div>
            <input 
              type="range"
              min="10"
              max="240"
              step="1"
              value={ringModCarrier}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setRingModCarrier(val);
                updateDspParam({ ringModCarrier: val });
              }}
              className="w-full accent-amber-500 bg-red-950/60 rounded-lg cursor-pointer h-1.5"
            />
          </div>

          <div className="flex items-center justify-between text-[9px] font-mono border-t border-red-900/20 pt-2 text-zinc-400">
            <span>SIDEBANDS: <strong className="text-zinc-300">±{activeRingMod.sidebandSpreadHz} Hz</strong></span>
            <span>HARMONICS: <strong className="text-amber-400">{activeRingMod.distortionHarmonics}</strong></span>
          </div>
        </div>
      </div>

      {/* 3. Real-Time Oscilloscope & Multi-Band Spectral Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Ring Mod Oscilloscope Canvas (7 Cols) */}
        <div className="lg:col-span-7 bg-black/60 border border-red-900/30 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <h4 className="text-xs font-mono font-bold uppercase text-amber-400 tracking-wider">
                Phosphor DSP Oscilloscope Feed
              </h4>
            </div>
            <span className="text-[9px] font-mono text-zinc-400">
              BUFFER: {activePipeline.bufferSize} SMP @ {activePipeline.sampleRate / 1000} kHz
            </span>
          </div>

          <div className="relative rounded-xl overflow-hidden border border-red-900/40 shadow-inner">
            <canvas 
              ref={canvasRef} 
              width={540} 
              height={140}
              className="w-full h-[140px] block"
            />
            <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/80 border border-red-900/30 text-[8px] font-mono text-amber-400">
              {activeRingMod.isActive ? `${activeRingMod.waveform.toUpperCase()} • ${activeRingMod.carrierFreqHz} Hz` : 'BYPASS'}
            </div>
          </div>
        </div>

        {/* 7-Band Spectral Harvester (5 Cols) */}
        <div className="lg:col-span-5 bg-black/60 border border-red-900/30 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-400">
              <Layers className="w-4 h-4" />
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider">
                Spectral Energy Bands
              </h4>
            </div>
            <span className="text-[9px] font-mono text-zinc-400">EQ HARMONICS</span>
          </div>

          {/* 7 Vertical Spectrum Bars */}
          <div className="h-[140px] flex items-end justify-between gap-2 px-2 pt-2 pb-1 border border-red-900/30 rounded-xl bg-black/40">
            {[
              { label: 'Sub', value: activeSpectral.subBass },
              { label: 'Bass', value: activeSpectral.bass },
              { label: 'LoMid', value: activeSpectral.lowMid },
              { label: 'Mid', value: activeSpectral.mid },
              { label: 'HiMid', value: activeSpectral.highMid },
              { label: 'Pres', value: activeSpectral.presence },
              { label: 'Brill', value: activeSpectral.brilliance }
            ].map(band => (
              <div key={band.label} className="flex-1 flex flex-col items-center h-full justify-end gap-1.5">
                <span className="text-[7px] font-mono text-amber-300 font-bold">{band.value}%</span>
                <div className="w-full bg-red-950/40 rounded-t overflow-hidden flex flex-col justify-end h-full">
                  <div 
                    className="w-full bg-gradient-to-t from-red-800 via-amber-500 to-amber-300 rounded-t transition-all duration-200"
                    style={{ height: `${band.value}%` }}
                  />
                </div>
                <span className="text-[8px] font-mono text-zinc-400">{band.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Tactical Presets & Pipeline Diagnostics Footer */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-red-900/30 text-zinc-400 text-[10px] font-mono">
        {/* Presets */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[9px] font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Presets:
          </span>
          <button
            onClick={() => applyPreset('butler')}
            className="px-2.5 py-1 rounded-lg bg-red-950/40 border border-amber-600/40 text-amber-300 hover:bg-red-900/50 transition-colors font-bold"
          >
            Alfred Baritone
          </button>
          <button
            onClick={() => applyPreset('council')}
            className="px-2.5 py-1 rounded-lg bg-red-950/30 border border-red-800/40 text-zinc-300 hover:text-amber-200 hover:bg-red-900/40 transition-colors"
          >
            Council Cold
          </button>
          <button
            onClick={() => applyPreset('radio')}
            className="px-2.5 py-1 rounded-lg bg-red-950/30 border border-red-800/40 text-zinc-300 hover:text-amber-200 hover:bg-red-900/40 transition-colors"
          >
            Tactical Radio
          </button>
          <button
            onClick={() => applyPreset('bypass')}
            className="px-2.5 py-1 rounded-lg bg-black/60 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Pure / Flat
          </button>
        </div>

        {/* Pipeline Telemetry Snapshot */}
        <div className="flex items-center gap-4 text-[9px] font-mono text-zinc-400">
          <span>PACKETS: <strong className="text-zinc-200">{activePipeline.packetsProcessed}</strong></span>
          <span>UPTIME: <strong className="text-zinc-200">{activePipeline.daemonUptimeSec}s</strong></span>
          <span>PID: <strong className="text-amber-300">{activePipeline.daemonPid}</strong></span>
          <span>CPU: <strong className="text-emerald-400">{activePipeline.cpuLoadPct}%</strong></span>
        </div>
      </div>
    </div>
  );
};

export default VoiceStatusPanel;
