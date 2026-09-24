import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Activity, 
  Cpu, 
  HardDrive, 
  Wifi, 
  WifiOff, 
  Clock, 
  Zap, 
  RefreshCw, 
  ShieldCheck, 
  Layers, 
  Radio, 
  AlertTriangle, 
  Server, 
  Gauge, 
  TrendingUp, 
  BarChart3, 
  Database, 
  Terminal, 
  Play, 
  Pause, 
  Flame,
  CheckCircle2,
  Sliders,
  Crosshair
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Socket } from 'socket.io-client';

interface SystemHealthDashboardProps {
  socket?: Socket | null;
}

interface TelemetryData {
  status: string;
  timestamp: number;
  serverUptime: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
  cpu: {
    user: number;
    system: number;
    cores: number;
    loadAvg: number[];
  };
  system: {
    platform: string;
    arch: string;
    totalMem: number;
    freeMem: number;
    nodeVersion: string;
  };
  daemon: {
    urgency: number;
    lastActivity: number;
    silenceSec: number;
    isActive: boolean;
    proactiveThreshold: number;
  };
  bridge: {
    clientsCount: number;
    pendingRequests: number;
  };
  tactical?: {
    totalCaptured: number;
    lastTouch: { x: number; y: number; quadrant: string; timestamp: number } | null;
  };
}

interface LatencySample {
  id: string;
  timestamp: number;
  latency: number;
  type: 'socket' | 'rest';
  status: 'optimal' | 'nominal' | 'elevated';
}

interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'warn' | 'pulse';
}

const formatBytes = (bytes: number, decimals = 1): string => {
  if (!bytes || bytes === 0) return '0 MB';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

const formatSeconds = (sec: number): string => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export const SystemHealthDashboard: React.FC<SystemHealthDashboardProps> = ({ socket }) => {
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [latencyHistory, setLatencyHistory] = useState<LatencySample[]>([]);
  const [currentLatency, setCurrentLatency] = useState<number | null>(null);
  const [isSocketConnected, setIsSocketConnected] = useState<boolean>(socket?.connected ?? false);
  const [isPinging, setIsPinging] = useState(false);
  const [pingInterval, setPingInterval] = useState<number>(3000); // 3 seconds
  const [isAutoPingActive, setIsAutoPingActive] = useState<boolean>(true);
  const [sessionStartTime] = useState<number>(() => {
    const saved = sessionStorage.getItem('ZEREO_SESSION_START');
    if (saved) return parseInt(saved, 10);
    const now = Date.now();
    sessionStorage.setItem('ZEREO_SESSION_START', now.toString());
    return now;
  });
  const [sessionDuration, setSessionDuration] = useState<number>(0);
  const [pingsSentCount, setPingsSentCount] = useState<number>(0);
  const [pongsReceivedCount, setPongsReceivedCount] = useState<number>(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [clientHeapMB, setClientHeapMB] = useState<number | null>(null);

  const socketPingStartRef = useRef<number>(0);
  const restPingStartRef = useRef<number>(0);

  const addLog = (message: string, type: 'info' | 'success' | 'warn' | 'pulse' = 'info') => {
    const entry: LogEntry = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toLocaleTimeString(),
      message,
      type
    };
    setLogs(prev => [entry, ...prev.slice(0, 39)]);
  };

  // Track session timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSessionDuration(Math.floor((Date.now() - sessionStartTime) / 1000));
      
      // Measure client browser memory if supported (Chromium)
      if (typeof window !== 'undefined' && (performance as any)?.memory) {
        const used = (performance as any).memory.usedJSHeapSize;
        setClientHeapMB(Math.round(used / (1024 * 1024)));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [sessionStartTime]);

  // Fetch telemetry from server
  const fetchTelemetry = async () => {
    const startTime = performance.now();
    restPingStartRef.current = startTime;
    try {
      const res = await fetch('/api/system/health');
      const rtt = Math.round(performance.now() - startTime);
      if (res.ok) {
        const data: TelemetryData = await res.json();
        setTelemetry(data);
        
        // If socket is unavailable, record REST RTT
        if (!socket || !socket.connected) {
          recordLatency(rtt, 'rest');
        }
      }
    } catch (err: any) {
      addLog(`Telemetry link anomaly: ${err.message}`, 'warn');
    }
  };

  const recordLatency = (latencyMs: number, type: 'socket' | 'rest') => {
    setCurrentLatency(latencyMs);
    setPongsReceivedCount(prev => prev + 1);
    
    let status: 'optimal' | 'nominal' | 'elevated' = 'optimal';
    if (latencyMs > 60) status = 'elevated';
    else if (latencyMs > 25) status = 'nominal';

    const sample: LatencySample = {
      id: `${Date.now()}_${Math.random().toString(36).substring(7)}`,
      timestamp: Date.now(),
      latency: latencyMs,
      type,
      status
    };

    setLatencyHistory(prev => [...prev.slice(-29), sample]);
  };

  // Socket listener setup
  useEffect(() => {
    if (!socket) return;

    const onConnect = () => {
      setIsSocketConnected(true);
      addLog("Neural Bridge Socket link synchronized [Full Duplex]", "success");
    };

    const onDisconnect = (reason: string) => {
      setIsSocketConnected(false);
      addLog(`Neural Bridge Socket severed: ${reason}`, "warn");
    };

    const onNeuralPong = (data: any) => {
      const now = performance.now();
      const rtt = socketPingStartRef.current ? Math.round(now - socketPingStartRef.current) : 5;
      recordLatency(rtt, 'socket');
      setIsPinging(false);
      addLog(`Neural Pong captured: ${rtt}ms RTT • Core Synced`, 'pulse');
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('neural:pong', onNeuralPong);

    if (socket.connected) {
      setIsSocketConnected(true);
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('neural:pong', onNeuralPong);
    };
  }, [socket]);

  // Window event fallback for Doorman / Local pongs
  useEffect(() => {
    const handleLocalPong = (e: any) => {
      if (socketPingStartRef.current) {
        const rtt = Math.round(performance.now() - socketPingStartRef.current);
        recordLatency(rtt, 'socket');
        setIsPinging(false);
      }
    };
    window.addEventListener('neural:pong_local', handleLocalPong);
    
    const handleIntentCapture = (e: any) => {
      const { x, y, quadrant } = e.detail || {};
      addLog(`Tactical intent captured at [${x}, ${y}] (${quadrant || 'SECTOR'}) • Butler reasoning engaged`, 'pulse');
    };
    window.addEventListener('neural:intent_capture', handleIntentCapture);

    return () => {
      window.removeEventListener('neural:pong_local', handleLocalPong);
      window.removeEventListener('neural:intent_capture', handleIntentCapture);
    };
  }, []);

  // Dispatch ping function
  const triggerPing = () => {
    setIsPinging(true);
    setPingsSentCount(prev => prev + 1);
    
    if (socket && socket.connected) {
      socketPingStartRef.current = performance.now();
      socket.emit('neural:ping', { clientTime: Date.now() });
    } else {
      fetchTelemetry();
    }
  };

  // Auto polling / ping interval
  useEffect(() => {
    // Initial fetch
    fetchTelemetry();
    triggerPing();

    if (!isAutoPingActive || pingInterval <= 0) return;

    const interval = setInterval(() => {
      fetchTelemetry();
      triggerPing();
    }, pingInterval);

    return () => clearInterval(interval);
  }, [isAutoPingActive, pingInterval, socket]);

  // Derived statistics
  const stats = useMemo(() => {
    if (latencyHistory.length === 0) {
      return { avg: 0, min: 0, max: 0, jitter: 0 };
    }
    const values = latencyHistory.map(s => s.latency);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = Math.round(sum / values.length);
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    // Calculate variance / jitter
    const variance = values.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / values.length;
    const jitter = Math.round(Math.sqrt(variance));

    return { avg, min, max, jitter };
  }, [latencyHistory]);

  const packetLoss = useMemo(() => {
    if (pingsSentCount === 0) return 0;
    const loss = Math.max(0, pingsSentCount - pongsReceivedCount);
    return ((loss / pingsSentCount) * 100).toFixed(1);
  }, [pingsSentCount, pongsReceivedCount]);

  const heapPercent = useMemo(() => {
    if (!telemetry?.memory) return 0;
    return Math.round((telemetry.memory.heapUsed / telemetry.memory.heapTotal) * 100);
  }, [telemetry]);

  const serverRamPercent = useMemo(() => {
    if (!telemetry?.system) return 0;
    const used = telemetry.system.totalMem - telemetry.system.freeMem;
    return Math.round((used / telemetry.system.totalMem) * 100);
  }, [telemetry]);

  return (
    <div id="system-health-dashboard" className="w-full flex flex-col gap-6 text-zinc-300">
      {/* Top Banner: Status & Quick Controls */}
      <div className="bg-[#0d0d0e] border border-red-900/30 rounded-2xl p-5 shadow-2xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="relative">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-950 via-zinc-900 to-black border border-red-800/40 flex items-center justify-center shadow-lg shadow-red-950/50">
              <Radio className="w-6 h-6 text-amber-500 animate-pulse" />
            </div>
            <span className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#0d0d0e] ${
              isSocketConnected ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-amber-500 shadow-[0_0_10px_#f59e0b]'
            }`} />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-amber-400 uppercase tracking-widest">
                Neural Bridge & System Health
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase bg-red-950/60 border border-red-800/40 text-amber-300">
                Principal Steward Substrate
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 font-mono tracking-wider mt-0.5">
              Protocol: WebSocket duplex • Host: Local Cloud Ingress :3000 • Status: {isSocketConnected ? 'Optimal Handshake' : 'Polling Bridge'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Interval Selector */}
          <div className="flex items-center bg-black/60 border border-red-900/20 rounded-xl p-1 text-[10px] font-mono">
            {[
              { label: '1s', val: 1000 },
              { label: '3s', val: 3000 },
              { label: '5s', val: 5000 },
            ].map(item => (
              <button
                key={item.val}
                onClick={() => { setPingInterval(item.val); setIsAutoPingActive(true); }}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  pingInterval === item.val && isAutoPingActive
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 font-bold' 
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={() => setIsAutoPingActive(!isAutoPingActive)}
              className={`p-1.5 rounded-lg ml-1 transition-all ${
                !isAutoPingActive ? 'text-amber-400 bg-amber-500/10' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title={isAutoPingActive ? "Pause Telemetry" : "Resume Telemetry"}
            >
              {isAutoPingActive ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            </button>
          </div>

          {/* Manual Pulse Handshake */}
          <button
            id="pulse-handshake-btn"
            onClick={triggerPing}
            disabled={isPinging}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-950 via-zinc-900 to-red-950 border border-amber-500/40 hover:border-amber-400 text-amber-300 rounded-xl text-[11px] font-bold uppercase tracking-widest shadow-lg shadow-red-950/40 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
          >
            <Zap className={`w-3.5 h-3.5 text-amber-400 ${isPinging ? 'animate-bounce' : ''}`} />
            <span>{isPinging ? 'Pinging Core...' : 'Pulse Handshake'}</span>
          </button>
        </div>
      </div>

      {/* Grid Section: Latency Telemetry & Resources */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* Left Column (xl:col-span-7): Neural Bridge Latency Engine */}
        <div className="xl:col-span-7 flex flex-col gap-6">
          {/* Main Latency Card */}
          <div className="bg-[#0d0d0e] border border-red-900/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-red-900/20 pb-4 mb-5">
              <div className="flex items-center gap-3">
                <Gauge className="w-5 h-5 text-amber-500" />
                <h2 className="text-xs font-bold text-amber-400 uppercase tracking-widest">
                  Neural Bridge Round-Trip Latency (RTT)
                </h2>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span>Live Feed</span>
              </div>
            </div>

            {/* Prominent Latency Gauge / Number */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="sm:col-span-1 bg-black/50 border border-red-900/25 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden">
                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400">Current RTT</span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className={`text-4xl font-mono font-black ${
                    currentLatency === null ? 'text-zinc-600' :
                    currentLatency < 25 ? 'text-emerald-400' :
                    currentLatency < 60 ? 'text-amber-400' : 'text-rose-500'
                  }`}>
                    {currentLatency !== null ? currentLatency : '--'}
                  </span>
                  <span className="text-xs font-mono font-bold text-zinc-400">ms</span>
                </div>
                <div className="mt-3 flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${
                    currentLatency === null ? 'bg-zinc-700' :
                    currentLatency < 25 ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' :
                    currentLatency < 60 ? 'bg-amber-500 shadow-[0_0_8px_#f59e0b]' : 'bg-rose-500'
                  }`} />
                  <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-400">
                    {currentLatency === null ? 'Awaiting Pulse' :
                     currentLatency < 25 ? 'Optimal (Zero Friction)' :
                     currentLatency < 60 ? 'Nominal Operation' : 'Elevated Latency'}
                  </span>
                </div>
              </div>

              {/* Statistical Metrics */}
              <div className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-black/30 border border-red-900/15 rounded-xl p-3 flex flex-col justify-center">
                  <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest">Average</span>
                  <span className="text-lg font-mono font-bold text-amber-300 mt-1">
                    {stats.avg} <span className="text-[10px] text-zinc-400">ms</span>
                  </span>
                </div>
                <div className="bg-black/30 border border-red-900/15 rounded-xl p-3 flex flex-col justify-center">
                  <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest">Fastest (Min)</span>
                  <span className="text-lg font-mono font-bold text-emerald-400 mt-1">
                    {stats.min} <span className="text-[10px] text-zinc-400">ms</span>
                  </span>
                </div>
                <div className="bg-black/30 border border-red-900/15 rounded-xl p-3 flex flex-col justify-center">
                  <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest">Peak (Max)</span>
                  <span className="text-lg font-mono font-bold text-rose-400 mt-1">
                    {stats.max} <span className="text-[10px] text-zinc-400">ms</span>
                  </span>
                </div>
                <div className="bg-black/30 border border-red-900/15 rounded-xl p-3 flex flex-col justify-center">
                  <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest">Jitter (Var)</span>
                  <span className="text-lg font-mono font-bold text-zinc-300 mt-1">
                    ±{stats.jitter} <span className="text-[10px] text-zinc-400">ms</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Sparkline Visual Graph */}
            <div className="bg-black/60 border border-red-900/20 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400">
                    Temporal RTT Graph (Last 30 Pulses)
                  </span>
                </div>
                <span className="text-[9px] font-mono text-zinc-400">Sample window: ~90s</span>
              </div>

              {/* SVG Timeline / Chart */}
              <div className="w-full h-28 relative flex items-end pt-4 pb-2">
                {latencyHistory.length === 0 ? (
                  <div className="w-full h-full flex items-center justify-center text-[10px] font-mono text-zinc-600 uppercase tracking-widest">
                    Initializing Handshake telemetry...
                  </div>
                ) : (
                  <div className="w-full h-full flex items-end gap-1 px-1">
                    {latencyHistory.map((sample, idx) => {
                      const maxVal = Math.max(80, stats.max * 1.2);
                      const heightPercent = Math.min(100, Math.max(12, (sample.latency / maxVal) * 100));
                      return (
                        <div 
                          key={sample.id}
                          className="flex-1 flex flex-col items-center group relative h-full justify-end"
                        >
                          {/* Tooltip on hover */}
                          <div className="absolute -top-8 hidden group-hover:flex px-2 py-1 bg-zinc-900 border border-amber-500/50 rounded text-[9px] font-mono text-amber-300 whitespace-nowrap z-30 shadow-lg pointer-events-none">
                            {sample.latency}ms ({sample.type})
                          </div>
                          
                          {/* Bar */}
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: `${heightPercent}%` }}
                            transition={{ duration: 0.2 }}
                            className={`w-full rounded-t-sm transition-all group-hover:brightness-125 ${
                              sample.latency < 25 ? 'bg-emerald-500/70 group-hover:bg-emerald-400' :
                              sample.latency < 60 ? 'bg-amber-500/70 group-hover:bg-amber-400' :
                              'bg-rose-500/80 group-hover:bg-rose-400'
                            }`}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Threshold legend */}
              <div className="flex items-center justify-between border-t border-red-900/20 pt-2.5 mt-2 text-[9px] font-mono text-zinc-400">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> Optimal (&lt;25ms)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" /> Nominal (25-60ms)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500" /> Elevated (&gt;60ms)
                  </span>
                </div>
                <span>Transport: {isSocketConnected ? 'Duplex WebSocket' : 'REST Fallback'}</span>
              </div>
            </div>

            {/* Session Transmission Counters */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-red-900/20 text-[10px] font-mono">
              <div>
                <span className="text-zinc-400">Pings Dispatched:</span>
                <p className="text-zinc-200 font-bold mt-0.5">{pingsSentCount}</p>
              </div>
              <div>
                <span className="text-zinc-400">Pongs Verified:</span>
                <p className="text-zinc-200 font-bold mt-0.5">{pongsReceivedCount}</p>
              </div>
              <div>
                <span className="text-zinc-400">Packet Integrity:</span>
                <p className="text-emerald-400 font-bold mt-0.5">{100 - parseFloat(packetLoss.toString())}%</p>
              </div>
              <div>
                <span className="text-zinc-400">Active Sockets:</span>
                <p className="text-amber-400 font-bold mt-0.5">{telemetry?.bridge?.clientsCount ?? 1} Node</p>
              </div>
            </div>
          </div>

          {/* Steward Pulse Daemon Watchdog */}
          <div className="bg-[#0d0d0e] border border-red-900/30 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-red-900/20 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <Flame className="w-5 h-5 text-amber-500" />
                <h2 className="text-xs font-bold text-amber-400 uppercase tracking-widest">
                  Estate Pulse Daemon & Watchdog State
                </h2>
              </div>
              <span className="text-[10px] font-mono px-2.5 py-0.5 bg-red-950/40 border border-red-900/30 rounded-full text-zinc-300">
                Daemon Active: {telemetry?.daemon?.isActive ? 'TRUE' : 'FALSE'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-black/40 border border-red-900/20 rounded-xl p-3.5">
                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400">Watchdog Urgency</span>
                <div className="flex items-baseline gap-2 mt-1.5">
                  <span className="text-2xl font-mono font-black text-amber-400">
                    {telemetry?.daemon?.urgency?.toFixed(1) ?? '0.0'}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400">/ 85.0 trigger</span>
                </div>
                <div className="w-full h-1.5 bg-zinc-800 rounded-full mt-2.5 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 transition-all duration-500"
                    style={{ width: `${Math.min(100, ((telemetry?.daemon?.urgency ?? 0) / 85) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="bg-black/40 border border-red-900/20 rounded-xl p-3.5">
                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400">Silence Duration</span>
                <div className="flex items-baseline gap-1.5 mt-1.5">
                  <span className="text-2xl font-mono font-black text-zinc-200">
                    {telemetry?.daemon?.silenceSec ?? 0}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400">seconds</span>
                </div>
                <p className="text-[9px] font-mono text-zinc-400 mt-2">Time since Principal interaction</p>
              </div>

              <div className="bg-black/40 border border-red-900/20 rounded-xl p-3.5">
                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400">Proactive Threshold</span>
                <div className="flex items-baseline gap-1.5 mt-1.5">
                  <span className="text-2xl font-mono font-black text-emerald-400">
                    85.0
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400">index</span>
                </div>
                <p className="text-[9px] font-mono text-zinc-400 mt-2">Automated Butler intervention gate</p>
              </div>
            </div>
          </div>

          {/* Tactical Intent Capture Status */}
          <div className="bg-[#0d0d0e] border border-red-900/30 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-red-900/20 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <Crosshair className="w-5 h-5 text-amber-500" />
                <h2 className="text-xs font-bold text-amber-400 uppercase tracking-widest">
                  Tactical Intent Capture Engine (Touch HUD)
                </h2>
              </div>
              <span className="text-[10px] font-mono px-2.5 py-0.5 bg-amber-950/40 border border-amber-900/40 rounded-full text-amber-300">
                Overlay Status: ACTIVE
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-black/40 border border-red-900/20 rounded-xl p-3.5">
                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400">Total Vectors Captured</span>
                <div className="flex items-baseline gap-2 mt-1.5">
                  <span className="text-2xl font-mono font-black text-amber-400">
                    {telemetry?.tactical?.totalCaptured ?? 0}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400">signals</span>
                </div>
                <p className="text-[9px] font-mono text-zinc-400 mt-2">Duplex bridge touches registered</p>
              </div>

              <div className="bg-black/40 border border-red-900/20 rounded-xl p-3.5">
                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400">Last Target Vector</span>
                <div className="flex items-baseline gap-1.5 mt-1.5">
                  <span className="text-xl font-mono font-black text-zinc-200">
                    {telemetry?.tactical?.lastTouch ? `X:${telemetry.tactical.lastTouch.x} Y:${telemetry.tactical.lastTouch.y}` : 'Awaiting Touch'}
                  </span>
                </div>
                <p className="text-[9px] font-mono text-zinc-400 mt-2">
                  {telemetry?.tactical?.lastTouch?.quadrant || 'Sector coordinate grid ready'}
                </p>
              </div>

              <div className="bg-black/40 border border-red-900/20 rounded-xl p-3.5">
                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400">Butler Reasoning Link</span>
                <div className="flex items-baseline gap-1.5 mt-1.5">
                  <span className="text-xl font-mono font-black text-emerald-400">
                    COGNITIVE LOCK
                  </span>
                </div>
                <p className="text-[9px] font-mono text-zinc-400 mt-2">Zero-friction tactile intent sync</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (xl:col-span-5): Resource Usage Stats for Current Session */}
        <div className="xl:col-span-5 flex flex-col gap-6">
          {/* Session Resources Overview */}
          <div className="bg-[#0d0d0e] border border-red-900/30 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-red-900/20 pb-4 mb-5">
              <div className="flex items-center gap-3">
                <HardDrive className="w-5 h-5 text-amber-500" />
                <h2 className="text-xs font-bold text-amber-400 uppercase tracking-widest">
                  Current Session Resources
                </h2>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-amber-300">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Session: {formatSeconds(sessionDuration)}</span>
              </div>
            </div>

            {/* Memory Partitions */}
            <div className="space-y-4">
              {/* Process RSS */}
              <div className="bg-black/40 border border-red-900/20 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                    <Server className="w-3.5 h-3.5 text-amber-400" />
                    Resident Set Size (Process RSS)
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-400">
                    {formatBytes(telemetry?.memory?.rss ?? 0)}
                  </span>
                </div>
                <p className="text-[9px] font-mono text-zinc-400">Total physical RAM allocated by Node.js runtime container</p>
              </div>

              {/* V8 Heap Memory */}
              <div className="bg-black/40 border border-red-900/20 rounded-xl p-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                    <Database className="w-3.5 h-3.5 text-amber-400" />
                    V8 Virtual Machine Heap
                  </span>
                  <span className="text-xs font-mono font-bold text-zinc-200">
                    {formatBytes(telemetry?.memory?.heapUsed ?? 0)} <span className="text-zinc-500">/ {formatBytes(telemetry?.memory?.heapTotal ?? 0)}</span>
                  </span>
                </div>
                
                {/* Heap progress bar */}
                <div className="w-full h-2 bg-zinc-800 rounded-full mt-2 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all duration-500"
                    style={{ width: `${heapPercent}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[9px] font-mono text-zinc-400 mt-1.5">
                  <span>Heap Utilization</span>
                  <span>{heapPercent}%</span>
                </div>
              </div>

              {/* Additional Resource Allocations */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-black/30 border border-red-900/15 rounded-xl p-3">
                  <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest">External Buffers</span>
                  <p className="text-sm font-mono font-bold text-zinc-200 mt-1">
                    {formatBytes(telemetry?.memory?.external ?? 0)}
                  </p>
                </div>
                <div className="bg-black/30 border border-red-900/15 rounded-xl p-3">
                  <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest">ArrayBuffers</span>
                  <p className="text-sm font-mono font-bold text-zinc-200 mt-1">
                    {formatBytes(telemetry?.memory?.arrayBuffers ?? 0)}
                  </p>
                </div>
              </div>

              {/* Client Browser JS Heap */}
              {clientHeapMB !== null && (
                <div className="bg-black/30 border border-red-900/15 rounded-xl p-3 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Client Browser Heap</span>
                  <span className="text-xs font-mono font-bold text-emerald-400">{clientHeapMB} MB</span>
                </div>
              )}
            </div>

            {/* Compute & Host Machine Stats */}
            <div className="mt-5 pt-4 border-t border-red-900/20 space-y-3">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-amber-400" />
                  Host CPU Cores:
                </span>
                <span className="text-zinc-200 font-bold">{telemetry?.cpu?.cores ?? 'Detected 4'} Cores</span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-amber-400" />
                  Load Average (1m/5m/15m):
                </span>
                <span className="text-zinc-200 font-bold">
                  {telemetry?.cpu?.loadAvg ? telemetry.cpu.loadAvg.map(l => l.toFixed(2)).join(' • ') : '0.12 • 0.08 • 0.05'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-amber-400" />
                  Server Uptime:
                </span>
                <span className="text-amber-300 font-bold">
                  {formatSeconds(telemetry?.serverUptime ?? 0)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-amber-400" />
                  Node.js Platform:
                </span>
                <span className="text-zinc-300 font-mono">
                  {telemetry?.system?.nodeVersion ?? process.version} ({telemetry?.system?.platform ?? 'linux'})
                </span>
              </div>
            </div>
          </div>

          {/* Telemetry Stream Log */}
          <div className="bg-[#0d0d0e] border border-red-900/30 rounded-2xl p-5 shadow-xl flex-1 flex flex-col min-h-[220px]">
            <div className="flex items-center justify-between border-b border-red-900/20 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-bold text-amber-400 uppercase tracking-widest">
                  Live Telemetry Log
                </h3>
              </div>
              <button 
                onClick={() => setLogs([])}
                className="text-[9px] font-mono text-zinc-500 hover:text-amber-400 uppercase tracking-wider"
              >
                Clear Log
              </button>
            </div>

            <div className="flex-1 overflow-y-auto max-h-48 space-y-1.5 pr-1 font-mono text-[10px]">
              {logs.length === 0 ? (
                <div className="h-full flex items-center justify-center text-zinc-600 text-center py-6">
                  Telemetry stream awaiting events...
                </div>
              ) : (
                logs.map(log => (
                  <div 
                    key={log.id} 
                    className="flex items-start gap-2 py-0.5 border-b border-zinc-900/60"
                  >
                    <span className="text-zinc-600 select-none">[{log.timestamp}]</span>
                    <span className={`flex-1 ${
                      log.type === 'pulse' ? 'text-amber-300 font-medium' :
                      log.type === 'success' ? 'text-emerald-400' :
                      log.type === 'warn' ? 'text-rose-400' : 'text-zinc-400'
                    }`}>
                      {log.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemHealthDashboard;
