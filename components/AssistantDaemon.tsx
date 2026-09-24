import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Cpu,
  Activity,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Play,
  Pause,
  RefreshCw,
  Volume2,
  VolumeX,
  Terminal,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Send,
  Trash2,
  ListChecks,
  Radio,
  Sliders,
  Zap,
  Sparkles,
  Server,
  Layers,
  ArrowUpRight,
  Filter,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Socket } from 'socket.io-client';
import {
  DaemonState,
  DaemonTask,
  DaemonLogEntry,
  DaemonCapabilities,
  DaemonTaskCategory,
  DaemonTaskPriority,
  DaemonStatus
} from '../types';
import { jeremyIronsVoice } from '../services/jeremyIronsVoiceService';

interface AssistantDaemonProps {
  socket?: Socket | null;
  isPrincipalMode?: boolean;
}

const CATEGORY_LABELS: Record<DaemonTaskCategory, { label: string; color: string; border: string }> = {
  SECURITY_SWEEP: { label: 'Security Sweep', color: 'text-red-400 bg-red-950/40', border: 'border-red-800/40' },
  MEMORY_INDEX: { label: 'Memory Index', color: 'text-amber-400 bg-amber-950/40', border: 'border-amber-800/40' },
  SITUATIONAL_BRIEFING: { label: 'Situational Briefing', color: 'text-cyan-400 bg-cyan-950/40', border: 'border-cyan-800/40' },
  DISCORD_DISPATCH: { label: 'Discord Dispatch', color: 'text-indigo-400 bg-indigo-950/40', border: 'border-indigo-800/40' },
  SYSTEM_DIAGNOSTIC: { label: 'System Diagnostic', color: 'text-emerald-400 bg-emerald-950/40', border: 'border-emerald-800/40' },
  CUSTOM_DIRECTIVE: { label: 'Custom Directive', color: 'text-purple-400 bg-purple-950/40', border: 'border-purple-800/40' },
};

const PRIORITY_BADGES: Record<DaemonTaskPriority, { label: string; badge: string }> = {
  CRITICAL: { label: 'CRITICAL', badge: 'bg-red-600 text-white font-black animate-pulse' },
  HIGH: { label: 'HIGH', badge: 'bg-amber-600/90 text-black font-bold' },
  ROUTINE: { label: 'ROUTINE', badge: 'bg-zinc-800 text-zinc-300 font-medium' },
};

export const AssistantDaemon: React.FC<AssistantDaemonProps> = ({ socket, isPrincipalMode = true }) => {
  const [state, setState] = useState<DaemonState | null>(null);
  const [logs, setLogs] = useState<DaemonLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSweeping, setIsSweeping] = useState<boolean>(false);
  const [isBriefingLoading, setIsBriefingLoading] = useState<boolean>(false);
  const [isSpeakingBriefing, setIsSpeakingBriefing] = useState<boolean>(false);

  // Task creation form state
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState<DaemonTaskCategory>('CUSTOM_DIRECTIVE');
  const [newPriority, setNewPriority] = useState<DaemonTaskPriority>('HIGH');
  const [executeImmediately, setExecuteImmediately] = useState(true);
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);

  // Filters
  const [taskFilter, setTaskFilter] = useState<'ALL' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'>('ALL');
  const [logFilter, setLogFilter] = useState<string>('ALL');
  const [autoScrollLogs, setAutoScrollLogs] = useState(true);

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Initial data fetch
  const fetchDaemonState = async () => {
    try {
      const res = await fetch('/api/daemon/state');
      if (res.ok) {
        const data = await res.json();
        setState(data);
        if (data.logs) {
          setLogs(data.logs);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch daemon state:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDaemonState();
    const interval = setInterval(fetchDaemonState, 8000);
    return () => clearInterval(interval);
  }, []);

  // Socket listener bindings
  useEffect(() => {
    if (!socket) return;

    socket.emit('daemon:get_state');

    const handleState = (updatedState: DaemonState & { logs?: DaemonLogEntry[] }) => {
      setState(updatedState);
      if (updatedState.logs && updatedState.logs.length > 0) {
        setLogs(updatedState.logs);
      }
    };

    const handleTick = (tickData: any) => {
      setState(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          tickCount: tickData.tickCount ?? prev.tickCount + 1,
          uptimeSeconds: tickData.uptimeSeconds ?? prev.uptimeSeconds + 10,
          status: tickData.status ?? prev.status,
          urgencyScore: tickData.urgency ?? prev.urgencyScore,
          tasksCompleted: tickData.tasksCompleted ?? prev.tasksCompleted,
        };
      });
    };

    const handleLog = (entry: DaemonLogEntry) => {
      setLogs(prev => [entry, ...prev.slice(0, 100)]);
    };

    const handleTaskEvent = ({ task, event }: { task: DaemonTask; event: string }) => {
      setState(prev => {
        if (!prev) return prev;
        const exists = prev.tasks.some(t => t.id === task.id);
        const updatedTasks = exists
          ? prev.tasks.map(t => (t.id === task.id ? task : t))
          : [task, ...prev.tasks];
        return {
          ...prev,
          tasks: updatedTasks,
          currentTask: event === 'completed' ? null : (event === 'started' ? task : prev.currentTask)
        };
      });
    };

    const handleBriefing = (briefing: { text: string; timestamp: number }) => {
      setState(prev => {
        if (!prev) return prev;
        return { ...prev, latestBriefing: briefing };
      });
      setIsBriefingLoading(false);
    };

    socket.on('daemon:state', handleState);
    socket.on('daemon:tick', handleTick);
    socket.on('daemon:log', handleLog);
    socket.on('daemon:task_event', handleTaskEvent);
    socket.on('daemon:briefing', handleBriefing);

    return () => {
      socket.off('daemon:state', handleState);
      socket.off('daemon:tick', handleTick);
      socket.off('daemon:log', handleLog);
      socket.off('daemon:task_event', handleTaskEvent);
      socket.off('daemon:briefing', handleBriefing);
    };
  }, [socket]);

  // Auto-scroll logs
  useEffect(() => {
    if (autoScrollLogs && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScrollLogs]);

  // Actions
  const handleToggleDaemon = async () => {
    if (!state) return;
    const action = state.status === 'PAUSED' ? 'resume' : 'pause';
    try {
      const res = await fetch('/api/daemon/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      if (res.ok) {
        const data = await res.json();
        setState(data.state);
      }
    } catch (err) {
      console.error('Daemon control error:', err);
    }
  };

  const handleManualSweep = async () => {
    setIsSweeping(true);
    try {
      const res = await fetch('/api/daemon/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sweep' })
      });
      if (res.ok) {
        const data = await res.json();
        setState(data.state);
      }
    } catch (err) {
      console.error('Sweep error:', err);
    } finally {
      setTimeout(() => setIsSweeping(false), 800);
    }
  };

  const handleToggleCapability = async (key: keyof DaemonCapabilities) => {
    if (!state) return;
    const current = state.capabilities[key];
    const updated = { ...state.capabilities, [key]: !current };
    try {
      const res = await fetch('/api/daemon/capabilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capabilities: { [key]: !current } })
      });
      if (res.ok) {
        setState(prev => prev ? { ...prev, capabilities: updated } : null);
      }
    } catch (err) {
      console.error('Capability update error:', err);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setIsSubmittingTask(true);
    try {
      const res = await fetch('/api/daemon/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim(),
          category: newCategory,
          priority: newPriority,
          executeNow: executeImmediately
        })
      });
      if (res.ok) {
        setNewTitle('');
        setNewDescription('');
        await fetchDaemonState();
      }
    } catch (err) {
      console.error('Create task error:', err);
    } finally {
      setIsSubmittingTask(false);
    }
  };

  const handleQuickPresetDirective = async (
    title: string,
    description: string,
    category: DaemonTaskCategory,
    priority: DaemonTaskPriority
  ) => {
    try {
      await fetch('/api/daemon/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          category,
          priority,
          executeNow: true
        })
      });
      await fetchDaemonState();
    } catch (err) {
      console.error('Preset dispatch error:', err);
    }
  };

  const handleRunTask = async (id: string) => {
    try {
      await fetch(`/api/daemon/tasks/${id}/run`, { method: 'POST' });
      await fetchDaemonState();
    } catch (err) {
      console.error('Run task error:', err);
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      await fetch(`/api/daemon/tasks/${id}`, { method: 'DELETE' });
      setState(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: prev.tasks.filter(t => t.id !== id)
        };
      });
    } catch (err) {
      console.error('Delete task error:', err);
    }
  };

  const handleDemandBriefing = async () => {
    setIsBriefingLoading(true);
    try {
      const res = await fetch('/api/daemon/briefing', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setState(prev => prev ? { ...prev, latestBriefing: data.briefing } : null);
      }
    } catch (err) {
      console.error('Demand briefing error:', err);
    } finally {
      setIsBriefingLoading(false);
    }
  };

  const handleSpeakBriefing = async () => {
    if (!state?.latestBriefing?.text) return;
    if (isSpeakingBriefing) {
      jeremyIronsVoice.stop();
      setIsSpeakingBriefing(false);
      return;
    }
    setIsSpeakingBriefing(true);
    await jeremyIronsVoice.speak(
      state.latestBriefing.text,
      {},
      () => setIsSpeakingBriefing(true),
      () => setIsSpeakingBriefing(false)
    );
  };

  const handleClearLogs = async () => {
    try {
      await fetch('/api/daemon/logs', { method: 'DELETE' });
      setLogs([]);
    } catch (err) {
      console.error('Clear logs error:', err);
    }
  };

  // Filtered tasks & logs
  const filteredTasks = useMemo(() => {
    if (!state?.tasks) return [];
    if (taskFilter === 'ALL') return state.tasks;
    return state.tasks.filter(t => t.status === taskFilter);
  }, [state?.tasks, taskFilter]);

  const filteredLogs = useMemo(() => {
    if (logFilter === 'ALL') return logs;
    return logs.filter(l => l.tag === logFilter);
  }, [logs, logFilter]);

  // Format helper
  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  const statusColor = (status: DaemonStatus) => {
    switch (status) {
      case 'RUNNING':
        return 'text-emerald-400 border-emerald-500/40 bg-emerald-950/20';
      case 'PAUSED':
        return 'text-amber-400 border-amber-500/40 bg-amber-950/20';
      case 'SWEEPING':
        return 'text-cyan-400 border-cyan-500/40 bg-cyan-950/20';
      case 'DISPATCHING':
        return 'text-purple-400 border-purple-500/40 bg-purple-950/20';
      default:
        return 'text-zinc-400 border-zinc-700 bg-zinc-900';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0d0707] text-zinc-100 overflow-y-auto p-4 md:p-6 font-sans">
      <div className="max-w-7xl w-full mx-auto space-y-6">

        {/* 1. TOP HEADER & TELEMETRY HUD */}
        <div className="bg-[#170909] border border-red-900/40 rounded-xl p-5 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-red-900/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10 border-b border-red-950/80 pb-5">
            <div className="flex items-center space-x-3.5">
              <div className="p-3 bg-red-950/50 border border-red-800/50 rounded-lg text-amber-400 shadow-inner">
                <Cpu className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center space-x-2.5">
                  <h1 className="text-xl font-bold tracking-wide text-zinc-100 uppercase">
                    Steward Background Daemon & Assistant
                  </h1>
                  <span className={`px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider rounded-full border ${statusColor(state?.status || 'RUNNING')}`}>
                    ● {state?.status || 'INITIALIZING'}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Autonomous Vigilance Substrate • Background Intelligence Queue • Discrete Neural Sentinel
                </p>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={handleToggleDaemon}
                id="daemon-toggle-run-btn"
                className={`flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold rounded-lg border transition-all ${
                  state?.status === 'PAUSED'
                    ? 'bg-emerald-950/50 border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/50'
                    : 'bg-amber-950/40 border-amber-700/60 text-amber-300 hover:bg-amber-900/50'
                }`}
              >
                {state?.status === 'PAUSED' ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                <span>{state?.status === 'PAUSED' ? 'Resume Daemon' : 'Pause Daemon'}</span>
              </button>

              <button
                onClick={handleManualSweep}
                disabled={isSweeping}
                id="daemon-sweep-btn"
                className="flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-red-950/50 border border-red-700/60 text-red-200 hover:bg-red-900/50 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isSweeping ? 'animate-spin' : ''}`} />
                <span>Trigger Vigilance Sweep</span>
              </button>

              <button
                onClick={handleDemandBriefing}
                disabled={isBriefingLoading}
                id="daemon-briefing-btn"
                className="flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-amber-950/40 border border-amber-700/60 text-amber-200 hover:bg-amber-900/50 transition-all disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Demand Briefing</span>
              </button>
            </div>
          </div>

          {/* Real-Time Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4 pt-1">
            <div className="bg-black/40 border border-red-950/60 rounded-lg p-3">
              <span className="text-[10px] uppercase font-mono text-zinc-500 tracking-wider">Uptime</span>
              <div className="text-sm font-bold font-mono text-zinc-200 mt-1">
                {formatUptime(state?.uptimeSeconds || 0)}
              </div>
            </div>

            <div className="bg-black/40 border border-red-950/60 rounded-lg p-3">
              <span className="text-[10px] uppercase font-mono text-zinc-500 tracking-wider">Heartbeat Ticks</span>
              <div className="text-sm font-bold font-mono text-amber-400 mt-1">
                {state?.tickCount || 0}
              </div>
            </div>

            <div className="bg-black/40 border border-red-950/60 rounded-lg p-3">
              <span className="text-[10px] uppercase font-mono text-zinc-500 tracking-wider">Tasks Completed</span>
              <div className="text-sm font-bold font-mono text-emerald-400 mt-1">
                {state?.tasksCompleted || 0}
              </div>
            </div>

            <div className="bg-black/40 border border-red-950/60 rounded-lg p-3">
              <span className="text-[10px] uppercase font-mono text-zinc-500 tracking-wider">Active Queue</span>
              <div className="text-sm font-bold font-mono text-cyan-400 mt-1">
                {state?.tasks.filter(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS').length || 0}
              </div>
            </div>

            <div className="bg-black/40 border border-red-950/60 rounded-lg p-3">
              <span className="text-[10px] uppercase font-mono text-zinc-500 tracking-wider">Memory Health</span>
              <div className="text-sm font-bold font-mono text-emerald-400 mt-1 flex items-center space-x-1.5">
                <span>{state?.memoryHealthScore || 100}%</span>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              </div>
            </div>

            <div className="bg-black/40 border border-red-950/60 rounded-lg p-3">
              <span className="text-[10px] uppercase font-mono text-zinc-500 tracking-wider">Urgency Index</span>
              <div className="text-sm font-bold font-mono text-red-400 mt-1 flex items-center space-x-1.5">
                <span>{state?.urgencyScore || 0}%</span>
                <Activity className="w-3.5 h-3.5 text-red-400" />
              </div>
            </div>
          </div>
        </div>

        {/* 2. EXECUTIVE SITUATIONAL INTELLIGENCE BRIEFING */}
        <div className="bg-[#150707] border border-amber-900/30 rounded-xl p-5 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-red-950/80 pb-3 mb-4">
            <div className="flex items-center space-x-2.5">
              <Radio className="w-4 h-4 text-amber-400 animate-pulse" />
              <h2 className="text-sm font-bold tracking-wide uppercase text-amber-200">
                Executive Situational Intelligence Briefing
              </h2>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono text-zinc-500">
                {state?.latestBriefing?.timestamp
                  ? new Date(state.latestBriefing.timestamp).toLocaleTimeString()
                  : 'STANDBY'}
              </span>
              <button
                onClick={handleSpeakBriefing}
                id="daemon-speak-briefing-btn"
                className={`flex items-center space-x-1.5 px-3 py-1 text-xs font-semibold rounded border transition-all ${
                  isSpeakingBriefing
                    ? 'bg-amber-500 text-black border-amber-400 animate-pulse'
                    : 'bg-red-950/40 border-amber-800/40 text-amber-300 hover:bg-amber-950/50'
                }`}
              >
                {isSpeakingBriefing ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                <span>{isSpeakingBriefing ? 'Halt Vocalization' : 'Vocalize Briefing (Irons DSP)'}</span>
              </button>
            </div>
          </div>

          <div className="bg-black/50 border border-red-950/60 rounded-lg p-4 font-serif text-sm leading-relaxed text-zinc-200 tracking-wide">
            {state?.latestBriefing?.text ? (
              <p className="whitespace-pre-wrap">{state.latestBriefing.text}</p>
            ) : (
              <p className="italic text-zinc-500">
                No situational briefing synthesized yet. Click &quot;Demand Briefing&quot; to synthesize an immediate executive report.
              </p>
            )}
          </div>
        </div>

        {/* 3. ASSISTANT INTELLIGENCE CAPABILITIES (AUTONOMOUS TOGGLES) */}
        <div className="bg-[#170909] border border-red-900/40 rounded-xl p-5 shadow-xl">
          <div className="flex items-center space-x-2.5 mb-4 pb-2 border-b border-red-950/80">
            <Sliders className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold tracking-wide uppercase text-zinc-200">
              Assistant Daemon Autonomous Capabilities
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {/* Capability 1 */}
            <div
              onClick={() => handleToggleCapability('autonomousVigilance')}
              className={`p-3.5 rounded-lg border cursor-pointer transition-all flex items-start justify-between ${
                state?.capabilities.autonomousVigilance
                  ? 'bg-red-950/20 border-red-800/60 hover:border-red-600'
                  : 'bg-black/30 border-zinc-800 opacity-60 hover:opacity-100'
              }`}
            >
              <div>
                <div className="flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-red-400" />
                  <h3 className="text-xs font-bold uppercase text-zinc-200">Vigilance Sweeps</h3>
                </div>
                <p className="text-[11px] text-zinc-400 mt-1 pr-2">
                  Periodic background sweeps of memory integrity, logic consistency, and socket links.
                </p>
              </div>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-black ${
                state?.capabilities.autonomousVigilance ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-500'
              }`}>
                {state?.capabilities.autonomousVigilance ? <Check className="w-3 h-3" /> : '✕'}
              </div>
            </div>

            {/* Capability 2 */}
            <div
              onClick={() => handleToggleCapability('proactiveBriefings')}
              className={`p-3.5 rounded-lg border cursor-pointer transition-all flex items-start justify-between ${
                state?.capabilities.proactiveBriefings
                  ? 'bg-amber-950/20 border-amber-800/60 hover:border-amber-600'
                  : 'bg-black/30 border-zinc-800 opacity-60 hover:opacity-100'
              }`}
            >
              <div>
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-bold uppercase text-zinc-200">Proactive Briefings</h3>
                </div>
                <p className="text-[11px] text-zinc-400 mt-1 pr-2">
                  Synthesizes unprompted tactical observations when operational silence passes urgency threshold.
                </p>
              </div>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-black ${
                state?.capabilities.proactiveBriefings ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-500'
              }`}>
                {state?.capabilities.proactiveBriefings ? <Check className="w-3 h-3" /> : '✕'}
              </div>
            </div>

            {/* Capability 3 */}
            <div
              onClick={() => handleToggleCapability('memoryAutoGrooming')}
              className={`p-3.5 rounded-lg border cursor-pointer transition-all flex items-start justify-between ${
                state?.capabilities.memoryAutoGrooming
                  ? 'bg-purple-950/20 border-purple-800/60 hover:border-purple-600'
                  : 'bg-black/30 border-zinc-800 opacity-60 hover:opacity-100'
              }`}
            >
              <div>
                <div className="flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-purple-400" />
                  <h3 className="text-xs font-bold uppercase text-zinc-200">Memory Grooming</h3>
                </div>
                <p className="text-[11px] text-zinc-400 mt-1 pr-2">
                  Autonomous consolidation and pruning of memory fragments to prevent logic entropy.
                </p>
              </div>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-black ${
                state?.capabilities.memoryAutoGrooming ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-500'
              }`}>
                {state?.capabilities.memoryAutoGrooming ? <Check className="w-3 h-3" /> : '✕'}
              </div>
            </div>

            {/* Capability 4 */}
            <div
              onClick={() => handleToggleCapability('discordRelay')}
              className={`p-3.5 rounded-lg border cursor-pointer transition-all flex items-start justify-between ${
                state?.capabilities.discordRelay
                  ? 'bg-indigo-950/20 border-indigo-800/60 hover:border-indigo-600'
                  : 'bg-black/30 border-zinc-800 opacity-60 hover:opacity-100'
              }`}
            >
              <div>
                <div className="flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-xs font-bold uppercase text-zinc-200">Discord Sentinel Relay</h3>
                </div>
                <p className="text-[11px] text-zinc-400 mt-1 pr-2">
                  Dispatches high-priority security alarms and autonomous beacons over the Discord socket bridge.
                </p>
              </div>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-black ${
                state?.capabilities.discordRelay ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-500'
              }`}>
                {state?.capabilities.discordRelay ? <Check className="w-3 h-3" /> : '✕'}
              </div>
            </div>

            {/* Capability 5 */}
            <div
              onClick={() => handleToggleCapability('neuralWatchdog')}
              className={`p-3.5 rounded-lg border cursor-pointer transition-all flex items-start justify-between ${
                state?.capabilities.neuralWatchdog
                  ? 'bg-cyan-950/20 border-cyan-800/60 hover:border-cyan-600'
                  : 'bg-black/30 border-zinc-800 opacity-60 hover:opacity-100'
              }`}
            >
              <div>
                <div className="flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-xs font-bold uppercase text-zinc-200">Neural Watchdog</h3>
                </div>
                <p className="text-[11px] text-zinc-400 mt-1 pr-2">
                  Monitors server-side Gemini gateway latencies and automatically executes model failovers.
                </p>
              </div>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-black ${
                state?.capabilities.neuralWatchdog ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-500'
              }`}>
                {state?.capabilities.neuralWatchdog ? <Check className="w-3 h-3" /> : '✕'}
              </div>
            </div>
          </div>
        </div>

        {/* 4. MISSION DISPATCH & AUTONOMOUS TASK QUEUE */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Left Column: Quick Presets & Custom Directive Form (5 cols) */}
          <div className="lg:col-span-5 space-y-5">
            {/* Quick Dispatch Presets */}
            <div className="bg-[#170909] border border-red-900/40 rounded-xl p-5 shadow-xl">
              <div className="flex items-center space-x-2 pb-2 mb-3 border-b border-red-950/80">
                <Zap className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold uppercase text-zinc-200">Quick Directive Presets</h3>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={() => handleQuickPresetDirective(
                    'Full Estate Security & Integrity Sweep',
                    'Scan memory vectors, check principal biometric signature (8212), inspect reasoning buffer.',
                    'SECURITY_SWEEP',
                    'CRITICAL'
                  )}
                  className="w-full text-left p-2.5 rounded bg-black/40 hover:bg-red-950/40 border border-red-950/80 hover:border-red-700/60 text-xs transition-all flex items-center justify-between"
                >
                  <span className="font-semibold text-zinc-200">Estate Security & Integrity Sweep</span>
                  <span className="text-[10px] font-mono uppercase text-red-400 bg-red-950/60 px-1.5 py-0.5 rounded border border-red-900/40">CRITICAL</span>
                </button>

                <button
                  onClick={() => handleQuickPresetDirective(
                    'Consolidate & Index Memory Core',
                    'Audit all stored memories, purge corrupted/empty records, update health index.',
                    'MEMORY_INDEX',
                    'HIGH'
                  )}
                  className="w-full text-left p-2.5 rounded bg-black/40 hover:bg-amber-950/40 border border-red-950/80 hover:border-amber-700/60 text-xs transition-all flex items-center justify-between"
                >
                  <span className="font-semibold text-zinc-200">Consolidate & Index Memory Core</span>
                  <span className="text-[10px] font-mono uppercase text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-900/40">HIGH</span>
                </button>

                <button
                  onClick={() => handleQuickPresetDirective(
                    'Synthesize Situational Intelligence Briefing',
                    'Compile operational metrics, evaluate silence urgency, output executive report.',
                    'SITUATIONAL_BRIEFING',
                    'HIGH'
                  )}
                  className="w-full text-left p-2.5 rounded bg-black/40 hover:bg-cyan-950/40 border border-red-950/80 hover:border-cyan-700/60 text-xs transition-all flex items-center justify-between"
                >
                  <span className="font-semibold text-zinc-200">Synthesize Situational Briefing</span>
                  <span className="text-[10px] font-mono uppercase text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-900/40">HIGH</span>
                </button>

                <button
                  onClick={() => handleQuickPresetDirective(
                    'Host Substrate Diagnostics & Memory Check',
                    'Query Node process memory RSS, heap usage, CPU platform metrics and load averages.',
                    'SYSTEM_DIAGNOSTIC',
                    'ROUTINE'
                  )}
                  className="w-full text-left p-2.5 rounded bg-black/40 hover:bg-emerald-950/40 border border-red-950/80 hover:border-emerald-700/60 text-xs transition-all flex items-center justify-between"
                >
                  <span className="font-semibold text-zinc-200">Host Substrate Diagnostics</span>
                  <span className="text-[10px] font-mono uppercase text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-900/40">ROUTINE</span>
                </button>
              </div>
            </div>

            {/* Custom Directive Dispatch Form */}
            <div className="bg-[#170909] border border-red-900/40 rounded-xl p-5 shadow-xl">
              <div className="flex items-center space-x-2 pb-2 mb-3 border-b border-red-950/80">
                <Send className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold uppercase text-zinc-200">Dispatch Custom Directive</h3>
              </div>

              <form onSubmit={handleCreateTask} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-mono uppercase text-zinc-400 mb-1">
                    Directive Title
                  </label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    placeholder="e.g. Audit perimeter defense vectors"
                    className="w-full px-3 py-2 text-xs rounded bg-black/60 border border-red-900/50 text-zinc-200 focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-mono uppercase text-zinc-400 mb-1">
                      Category
                    </label>
                    <select
                      value={newCategory}
                      onChange={e => setNewCategory(e.target.value as DaemonTaskCategory)}
                      className="w-full px-2.5 py-2 text-xs rounded bg-black/60 border border-red-900/50 text-zinc-200 focus:outline-none focus:border-amber-500"
                    >
                      <option value="CUSTOM_DIRECTIVE">Custom Directive</option>
                      <option value="SECURITY_SWEEP">Security Sweep</option>
                      <option value="MEMORY_INDEX">Memory Index</option>
                      <option value="SITUATIONAL_BRIEFING">Situational Briefing</option>
                      <option value="SYSTEM_DIAGNOSTIC">System Diagnostic</option>
                      <option value="DISCORD_DISPATCH">Discord Dispatch</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono uppercase text-zinc-400 mb-1">
                      Priority
                    </label>
                    <select
                      value={newPriority}
                      onChange={e => setNewPriority(e.target.value as DaemonTaskPriority)}
                      className="w-full px-2.5 py-2 text-xs rounded bg-black/60 border border-red-900/50 text-zinc-200 focus:outline-none focus:border-amber-500"
                    >
                      <option value="CRITICAL">Critical</option>
                      <option value="HIGH">High</option>
                      <option value="ROUTINE">Routine</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase text-zinc-400 mb-1">
                    Instructions / Context (Optional)
                  </label>
                  <textarea
                    value={newDescription}
                    onChange={e => setNewDescription(e.target.value)}
                    placeholder="Specific tactical context or reasoning parameters..."
                    rows={3}
                    className="w-full px-3 py-2 text-xs rounded bg-black/60 border border-red-900/50 text-zinc-200 focus:outline-none focus:border-amber-500 resize-none"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center space-x-2 text-xs text-zinc-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={executeImmediately}
                      onChange={e => setExecuteImmediately(e.target.checked)}
                      className="rounded border-red-900 bg-black text-amber-500 focus:ring-0"
                    />
                    <span>Execute immediately</span>
                  </label>

                  <button
                    type="submit"
                    disabled={isSubmittingTask || !newTitle.trim()}
                    id="daemon-submit-task-btn"
                    className="px-4 py-2 text-xs font-bold rounded bg-amber-500 text-black hover:bg-amber-400 transition-all disabled:opacity-50"
                  >
                    {isSubmittingTask ? 'Enqueuing...' : 'Dispatch to Daemon'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Right Column: Active & Historical Task Queue (7 cols) */}
          <div className="lg:col-span-7 bg-[#170909] border border-red-900/40 rounded-xl p-5 shadow-xl flex flex-col h-[580px]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-3 border-b border-red-950/80 gap-2">
              <div className="flex items-center space-x-2">
                <ListChecks className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold uppercase text-zinc-200">
                  Daemon Directives Queue ({filteredTasks.length})
                </h3>
              </div>

              {/* Task filter tabs */}
              <div className="flex items-center space-x-1 overflow-x-auto">
                {(['ALL', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setTaskFilter(tab)}
                    className={`px-2 py-1 text-[10px] font-mono font-semibold rounded uppercase transition-all ${
                      taskFilter === tab
                        ? 'bg-amber-500 text-black'
                        : 'bg-black/50 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Task list container */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {filteredTasks.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-zinc-500 italic">
                  No directives matching filter &quot;{taskFilter}&quot;.
                </div>
              ) : (
                filteredTasks.map(task => {
                  const categoryMeta = CATEGORY_LABELS[task.category] || CATEGORY_LABELS.CUSTOM_DIRECTIVE;
                  const priorityMeta = PRIORITY_BADGES[task.priority] || PRIORITY_BADGES.ROUTINE;

                  return (
                    <div
                      key={task.id}
                      className={`p-3.5 rounded-lg border bg-black/40 transition-all ${
                        task.status === 'IN_PROGRESS'
                          ? 'border-amber-500/60 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                          : 'border-red-950/80 hover:border-red-900/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className={`px-1.5 py-0.5 text-[9px] uppercase font-mono rounded ${priorityMeta.badge}`}>
                              {priorityMeta.label}
                            </span>
                            <span className={`px-2 py-0.5 text-[10px] font-mono rounded border ${categoryMeta.color} ${categoryMeta.border}`}>
                              {categoryMeta.label}
                            </span>
                            <span className="text-[10px] font-mono text-zinc-500">
                              {new Date(task.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-zinc-100">{task.title}</h4>
                        </div>

                        {/* Status & Actions */}
                        <div className="flex items-center space-x-1.5">
                          {task.status === 'IN_PROGRESS' && (
                            <span className="flex items-center space-x-1 text-[10px] font-mono text-amber-400 animate-pulse bg-amber-950/50 px-2 py-0.5 rounded border border-amber-800/40">
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              <span>RUNNING</span>
                            </span>
                          )}

                          {task.status === 'PENDING' && (
                            <button
                              onClick={() => handleRunTask(task.id)}
                              title="Execute Now"
                              className="px-2 py-0.5 text-[10px] font-mono font-bold bg-amber-500 text-black rounded hover:bg-amber-400 transition-all"
                            >
                              RUN
                            </button>
                          )}

                          {task.status === 'COMPLETED' && (
                            <span className="flex items-center space-x-1 text-[10px] font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>DONE</span>
                            </span>
                          )}

                          {task.status === 'FAILED' && (
                            <span className="flex items-center space-x-1 text-[10px] font-mono text-red-400 bg-red-950/40 px-2 py-0.5 rounded border border-red-800/40">
                              <AlertTriangle className="w-3 h-3" />
                              <span>FAILED</span>
                            </span>
                          )}

                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            title="Remove Directive"
                            className="p-1 text-zinc-500 hover:text-red-400 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {task.description && (
                        <p className="text-[11px] text-zinc-400 mt-1.5 leading-relaxed">
                          {task.description}
                        </p>
                      )}

                      {/* Result Output */}
                      {task.result && (
                        <div className="mt-2 p-2.5 rounded bg-black/60 border border-emerald-950/60 text-[11px] font-mono text-emerald-300/90 leading-normal">
                          <span className="text-zinc-500 text-[10px] block mb-0.5 uppercase">Execution Output:</span>
                          {task.result}
                        </div>
                      )}

                      {task.error && (
                        <div className="mt-2 p-2.5 rounded bg-red-950/30 border border-red-900/60 text-[11px] font-mono text-red-300 leading-normal">
                          <span className="text-red-500 text-[10px] block mb-0.5 uppercase">Error:</span>
                          {task.error}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* 5. DAEMON TELEMETRY & EVENT STREAM (TERMINAL VIEW) */}
        <div className="bg-[#120505] border border-red-900/40 rounded-xl p-5 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-3 border-b border-red-950/80 gap-2">
            <div className="flex items-center space-x-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold uppercase text-zinc-200">
                Daemon Telemetry & Event Stream
              </h3>
            </div>

            <div className="flex items-center space-x-2">
              {/* Tag filters */}
              <div className="flex items-center space-x-1">
                {['ALL', 'SYS', 'DAEMON', 'TASK', 'VIGILANCE', 'BRIEFING', 'WARN'].map(tag => (
                  <button
                    key={tag}
                    onClick={() => setLogFilter(tag)}
                    className={`px-2 py-0.5 text-[9px] font-mono font-semibold rounded uppercase transition-all ${
                      logFilter === tag
                        ? 'bg-zinc-200 text-black'
                        : 'bg-black/50 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>

              <button
                onClick={handleClearLogs}
                title="Flush Log Buffer"
                className="px-2 py-0.5 text-[10px] font-mono text-zinc-400 hover:text-red-400 border border-zinc-800 hover:border-red-900 rounded"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="bg-black/80 border border-red-950/60 rounded-lg p-3 font-mono text-xs text-zinc-300 h-64 overflow-y-auto space-y-1.5 select-text">
            {filteredLogs.length === 0 ? (
              <div className="h-full flex items-center justify-center text-zinc-600 italic">
                No telemetry entries logged yet.
              </div>
            ) : (
              filteredLogs.map(log => {
                const tagColor =
                  log.tag === 'WARN'
                    ? 'text-red-400 font-bold'
                    : log.tag === 'VIGILANCE'
                    ? 'text-cyan-400'
                    : log.tag === 'TASK'
                    ? 'text-amber-400'
                    : log.tag === 'BRIEFING'
                    ? 'text-purple-400'
                    : 'text-emerald-400';

                return (
                  <div key={log.id} className="leading-relaxed hover:bg-white/5 px-1 rounded transition-colors flex items-start space-x-2">
                    <span className="text-zinc-500 shrink-0 text-[10px]">
                      [{new Date(log.timestamp).toLocaleTimeString()}]
                    </span>
                    <span className={`shrink-0 text-[10px] uppercase font-bold ${tagColor}`}>
                      [{log.tag}]
                    </span>
                    <span className="text-zinc-200 break-words flex-1">
                      {log.message}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={logsEndRef} />
          </div>
        </div>

      </div>
    </div>
  );
};
