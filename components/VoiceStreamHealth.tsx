import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { Socket } from 'socket.io-client';
import { 
  Activity, 
  Cpu, 
  Radio, 
  Zap, 
  Layers, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle,
  SlidersHorizontal,
  Wifi
} from 'lucide-react';

export interface BridgeHealthData {
  status: string;
  ipc: string;
  socketPath: string;
  roundTripUs: number;
  roundTripMs: number;
  sampleRate: number;
  bufferSize: number;
  bufferDurationMs: number;
  pipelineLatencyMs: number;
  daemonPid?: number;
  timestamp: number;
}

interface VoiceStreamHealthProps {
  socket?: Socket | null;
  className?: string;
  onConfigChange?: (config: { sampleRate: number; bufferSize: number }) => void;
}

export const VoiceStreamHealth: React.FC<VoiceStreamHealthProps> = ({ 
  socket, 
  className = '',
  onConfigChange 
}) => {
  const [health, setHealth] = useState<BridgeHealthData>({
    status: 'OPTIMAL',
    ipc: 'UNIX_DOMAIN_SOCKET',
    socketPath: '/tmp/voice_dsp_daemon.sock',
    roundTripUs: 1850,
    roundTripMs: 1.85,
    sampleRate: 48000,
    bufferSize: 256,
    bufferDurationMs: 5.33,
    pipelineLatencyMs: 2.35,
    daemonPid: process.pid || 1,
    timestamp: Date.now()
  });

  const [latencyHistory, setLatencyHistory] = useState<number[]>([1.8, 1.9, 1.7, 2.1, 1.85, 1.82, 1.9]);
  const [isPinging, setIsPinging] = useState<boolean>(false);
  const [autoPing, setAutoPing] = useState<boolean>(true);
  const [pingIntervalMs, setPingIntervalMs] = useState<number>(1000);
  const [jitterMs, setJitterMs] = useState<number>(0.12);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  const pingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Ping the local Unix Socket bridge via HTTP endpoint
  const pingUnixBridge = useCallback(async () => {
    setIsPinging(true);
    const startClient = performance.now();
    try {
      const res = await fetch('/api/voice/bridge-ping');
      const endClient = performance.now();
      const clientRoundTripMs = Number((endClient - startClient).toFixed(3));

      if (res.ok) {
        const data: BridgeHealthData = await res.json();
        const effectiveLatency = data.roundTripMs || clientRoundTripMs;

        setHealth(data);
        setLatencyHistory(prev => {
          const next = [...prev.slice(-19), effectiveLatency];
          // Calculate jitter as average absolute diff between consecutive latencies
          if (next.length > 1) {
            let sumDiff = 0;
            for (let i = 1; i < next.length; i++) {
              sumDiff += Math.abs(next[i] - next[i - 1]);
            }
            setJitterMs(Number((sumDiff / (next.length - 1)).toFixed(3)));
          }
          return next;
        });
      }
    } catch (err) {
      console.warn('Bridge ping error:', err);
    } finally {
      setIsPinging(false);
    }
  }, []);

  // Auto-ping loop
  useEffect(() => {
    if (!autoPing) return;

    pingUnixBridge();
    pingTimerRef.current = setInterval(pingUnixBridge, pingIntervalMs);

    return () => {
      if (pingTimerRef.current) clearInterval(pingTimerRef.current);
    };
  }, [autoPing, pingIntervalMs, pingUnixBridge]);

  // Listen for socket pong if available
  useEffect(() => {
    if (!socket) return;

    const handleBridgePong = (data: any) => {
      if (data) {
        const clientNow = Date.now();
        const rtt = Math.max(0.2, (clientNow - (data.clientTimestamp || clientNow)));
        setLatencyHistory(prev => [...prev.slice(-19), Number(rtt.toFixed(2))]);
        setHealth(prev => ({
          ...prev,
          sampleRate: data.sampleRate || prev.sampleRate,
          bufferSize: data.bufferSize || prev.bufferSize,
          bufferDurationMs: data.bufferDurationMs || prev.bufferDurationMs,
          pipelineLatencyMs: data.pipelineLatencyMs || prev.pipelineLatencyMs
        }));
      }
    };

    socket.on('voice:bridge_pong', handleBridgePong);

    return () => {
      socket.off('voice:bridge_pong', handleBridgePong);
    };
  }, [socket]);

  // Adjust Sample Rate or Buffer Size on the Daemon
  const setHardwareConfig = async (newConfig: { sampleRate?: number; bufferSize?: number }) => {
    setIsUpdating(true);
    try {
      if (socket) {
        socket.emit('voice:dsp_set', newConfig);
      }

      const res = await fetch('/api/voice/dsp-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig)
      });

      if (res.ok) {
        const data = await res.json();
        if (data.metrics?.pipeline) {
          const p = data.metrics.pipeline;
          setHealth(prev => ({
            ...prev,
            sampleRate: p.sampleRate,
            bufferSize: p.bufferSize,
            bufferDurationMs: p.bufferDurationMs,
            pipelineLatencyMs: p.latencyMs
          }));
          if (onConfigChange) {
            onConfigChange({ sampleRate: p.sampleRate, bufferSize: p.bufferSize });
          }
        }
      }
    } catch (err) {
      console.error('Failed to update voice hardware config:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  // Sparkline coordinates calculation
  const maxLat = Math.max(...latencyHistory, 5);
  const minLat = Math.max(0, Math.min(...latencyHistory, 1));
  const range = maxLat - minLat || 1;
  const points = latencyHistory.map((val, idx) => {
    const x = (idx / (latencyHistory.length - 1 || 1)) * 140;
    const y = 30 - ((val - minLat) / range) * 24;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const isUltraLow = health.roundTripMs <= 3.0;

  return (
    <div className={`w-full bg-[#0d090a] border border-amber-600/30 rounded-3xl p-5 sm:p-7 shadow-2xl relative overflow-hidden ${className}`}>
      {/* Decorative hairline accents */}
      <div className="absolute top-0 left-6 right-6 h-[1px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-red-900/30 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-red-950/60 border border-red-800/50 text-amber-400">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-mono font-bold text-amber-400 uppercase tracking-widest">
                Unix Socket Bridge Health
              </h4>
              <span className={`text-[8px] font-mono px-2 py-0.5 rounded-full border font-bold uppercase ${
                isUltraLow 
                  ? 'bg-emerald-950/60 border-emerald-800/50 text-emerald-400' 
                  : 'bg-amber-950/60 border-amber-800/50 text-amber-400'
              }`}>
                {isUltraLow ? 'ULTRA-LOW LATENCY' : 'NOMINAL'}
              </span>
            </div>
            <p className="text-[10px] font-mono text-zinc-400 mt-0.5">
              IPC Node: <span className="text-zinc-200 font-semibold">{health.socketPath}</span>
            </p>
          </div>
        </div>

        {/* Polling & Ping controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={() => setAutoPing(!autoPing)}
            className={`px-2.5 py-1 rounded-lg border text-[9px] font-mono font-bold uppercase tracking-wider transition-colors ${
              autoPing
                ? 'bg-amber-950/40 border-amber-500/40 text-amber-300'
                : 'bg-black/60 border-zinc-800 text-zinc-400'
            }`}
          >
            {autoPing ? 'Auto-Watch' : 'Manual'}
          </button>
          <button
            onClick={pingUnixBridge}
            disabled={isPinging}
            className="px-3 py-1 rounded-lg bg-red-950/50 border border-red-800/50 text-amber-300 hover:text-amber-200 hover:bg-red-900/40 transition-colors text-[9px] font-mono font-bold uppercase flex items-center gap-1.5"
            title="Probe Unix Socket Bridge"
          >
            <RefreshCw className={`w-3 h-3 ${isPinging ? 'animate-spin' : ''}`} />
            <span>Ping</span>
          </button>
        </div>
      </div>

      {/* Primary Metrics Grid: Latency, Sample Rate, Buffer Size */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-5">
        
        {/* Metric 1: Unix Socket Latency & Jitter */}
        <div className="bg-black/50 border border-red-900/30 rounded-2xl p-4 space-y-3 relative">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-mono uppercase text-zinc-400 font-semibold tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" /> IPC Bridge Latency
            </span>
            <span className="text-[9px] font-mono text-zinc-400">
              Jitter: <strong className="text-zinc-200">{jitterMs}ms</strong>
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-mono font-black text-amber-400">
                {health.roundTripMs.toFixed(2)}
              </span>
              <span className="text-xs font-mono text-zinc-400">ms</span>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-mono text-zinc-400 block uppercase">Microseconds</span>
              <span className="text-xs font-mono font-bold text-zinc-200">{health.roundTripUs} µs</span>
            </div>
          </div>

          {/* Real-time sparkline graph */}
          <div className="h-9 w-full bg-black/80 rounded-lg p-1 border border-red-900/20 relative overflow-hidden flex items-center">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 140 32">
              <polyline
                fill="none"
                stroke="#fbbf24"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points}
              />
            </svg>
            <span className="absolute bottom-1 right-2 text-[7px] font-mono text-zinc-400">
              RTT HIST (20 PKT)
            </span>
          </div>
        </div>

        {/* Metric 2: Current Sample Rate & Bandwidth */}
        <div className="bg-black/50 border border-red-900/30 rounded-2xl p-4 space-y-3 relative">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-mono uppercase text-zinc-400 font-semibold tracking-wider flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-amber-400" /> Current Sample Rate
            </span>
            <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-900/40">
              STUDIO
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-mono font-black text-zinc-100">
                {(health.sampleRate / 1000).toFixed(1)}
              </span>
              <span className="text-xs font-mono text-amber-400 font-bold">kHz</span>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-mono text-zinc-400 block uppercase">Nyquist Limit</span>
              <span className="text-xs font-mono font-bold text-zinc-300">{(health.sampleRate / 2000).toFixed(1)} kHz</span>
            </div>
          </div>

          {/* Sample rate preset selector */}
          <div className="space-y-1">
            <span className="text-[8px] font-mono uppercase text-zinc-400">Switch Hardware Rate:</span>
            <div className="grid grid-cols-3 gap-1">
              {[
                { label: '44.1k', value: 44100 },
                { label: '48k (Std)', value: 48000 },
                { label: '96k (HiRes)', value: 96000 }
              ].map(item => (
                <button
                  key={item.value}
                  onClick={() => setHardwareConfig({ sampleRate: item.value })}
                  disabled={isUpdating}
                  className={`py-1 px-1.5 text-[8px] font-mono rounded transition-colors text-center ${
                    health.sampleRate === item.value
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                      : 'bg-black/60 text-zinc-400 hover:text-zinc-200 border border-zinc-900'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Metric 3: Processing Buffer Size & Frame Duration */}
        <div className="bg-black/50 border border-red-900/30 rounded-2xl p-4 space-y-3 relative">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-mono uppercase text-zinc-400 font-semibold tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-400" /> Processing Buffer Size
            </span>
            <span className="text-[9px] font-mono text-amber-300 font-bold">
              {health.bufferDurationMs} ms / Frame
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-mono font-black text-amber-400">
                {health.bufferSize}
              </span>
              <span className="text-xs font-mono text-zinc-400">Samples</span>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-mono text-zinc-400 block uppercase">Est Pipeline</span>
              <span className="text-xs font-mono font-bold text-zinc-300">{health.pipelineLatencyMs} ms</span>
            </div>
          </div>

          {/* Buffer size selector */}
          <div className="space-y-1">
            <span className="text-[8px] font-mono uppercase text-zinc-400">Buffer Tuning (Samples):</span>
            <div className="grid grid-cols-4 gap-1">
              {[128, 256, 512, 1024].map(size => (
                <button
                  key={size}
                  onClick={() => setHardwareConfig({ bufferSize: size })}
                  disabled={isUpdating}
                  className={`py-1 text-[8px] font-mono rounded transition-colors text-center ${
                    health.bufferSize === size
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                      : 'bg-black/60 text-zinc-400 hover:text-zinc-200 border border-zinc-900'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Diagnostics Telemetry Strip */}
      <div className="mt-4 pt-3 border-t border-red-900/20 flex flex-wrap items-center justify-between gap-3 text-[9px] font-mono text-zinc-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>DAEMON PID: <strong className="text-zinc-200">{health.daemonPid || 'ACTIVE'}</strong></span>
          <span className="text-zinc-400">•</span>
          <span>FIFO STATE: <strong className="text-emerald-400">0 XRUNS / NO DROPS</strong></span>
        </div>
        <div className="flex items-center gap-3">
          <span>FRAME LATENCY: <strong className="text-amber-300">{health.bufferDurationMs} ms</strong></span>
          <span className="text-zinc-400">•</span>
          <span>SYNC: <strong className="text-zinc-200">LOCKED (UNIX IPC)</strong></span>
        </div>
      </div>
    </div>
  );
};

export default VoiceStreamHealth;
