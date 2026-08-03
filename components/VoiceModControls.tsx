import React, { useState, useEffect } from 'react';
import { BrainCircuit, RefreshCw, Sliders, Zap } from 'lucide-react';

interface VoiceModControlsProps {
  className?: string;
  onParamsChange?: (params: { pitch: number; ringMod: number; gain: number }) => void;
}

export const VoiceModControls: React.FC<VoiceModControlsProps> = ({ className = '', onParamsChange }) => {
  const [dspStatus, setDspStatus] = useState<{ status: string; pitch?: number; ring_mod?: number; gain?: number }>({ status: 'checking' });
  const [pitch, setPitch] = useState<number>(0.85);
  const [ringMod, setRingMod] = useState<number>(0.0);
  const [gain, setGain] = useState<number>(1.0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const fetchDspStatus = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/voicemod', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_status' })
      });
      const data = await res.json();
      setDspStatus(data);
      if (data.status === 'ok') {
        if (data.pitch !== undefined) setPitch(data.pitch);
        if (data.ring_mod !== undefined) setRingMod(data.ring_mod);
        if (data.gain !== undefined) setGain(data.gain);
      }
    } catch {
      setDspStatus({ status: 'offline' });
    } finally {
      setIsSyncing(false);
    }
  };

  const updateDspParams = async (newPitch: number, newRing: number, newGain: number) => {
    setPitch(newPitch);
    setRingMod(newRing);
    setGain(newGain);
    if (onParamsChange) {
      onParamsChange({ pitch: newPitch, ringMod: newRing, gain: newGain });
    }
    try {
      const res = await fetch('/api/voicemod', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_params',
          pitch: newPitch,
          ring_mod: newRing,
          gain: newGain
        })
      });
      const data = await res.json();
      if (data.status === 'ok') {
        setDspStatus({ status: 'ok', pitch: newPitch, ring_mod: newRing, gain: newGain });
      }
    } catch {
      setDspStatus({ status: 'offline' });
    }
  };

  useEffect(() => {
    fetchDspStatus();
  }, []);

  return (
    <div className={`w-full max-w-4xl bg-zinc-900/50 border border-red-900/30 p-6 md:p-8 rounded-3xl space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-red-900/20 pb-4">
        <div className="flex items-center gap-3">
          <BrainCircuit className="w-5 h-5 text-amber-400" />
          <div>
            <h3 className="font-bold uppercase tracking-widest text-xs text-amber-400">
              voicemod-daemon / Voice DSP Engine
            </h3>
            <p className="text-[10px] text-zinc-500 font-mono">
              IPC Socket: /tmp/voicemod.sock
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-black/40 px-3 py-1 rounded-full border border-red-900/30">
            <span className={`w-2 h-2 rounded-full ${dspStatus.status === 'ok' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-amber-500 animate-pulse'}`} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-mono">
              {dspStatus.status === 'ok' ? 'DAEMON ONLINE' : dspStatus.status === 'checking' ? 'CHECKING...' : 'DAEMON STANDBY'}
            </span>
          </div>
          <button
            onClick={fetchDspStatus}
            disabled={isSyncing}
            className="flex items-center gap-1 text-[9px] uppercase font-mono px-3 py-1 bg-red-950/60 border border-red-900/40 hover:bg-red-900/40 text-amber-400 rounded-lg transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
            Sync
          </button>
        </div>
      </div>

      {/* Sliders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Pitch Shift Slider */}
        <div className="space-y-3 bg-black/40 p-4 rounded-2xl border border-red-900/20 hover:border-red-900/40 transition-colors">
          <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Sliders className="w-3 h-3 text-amber-400" />
              Pitch Shift
            </span>
            <span className="text-amber-400 font-mono bg-red-950/50 px-2 py-0.5 rounded border border-red-900/40">
              {pitch.toFixed(2)}x
            </span>
          </div>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.05"
            value={pitch}
            onChange={(e) => updateDspParams(parseFloat(e.target.value), ringMod, gain)}
            className="w-full accent-amber-500 cursor-pointer bg-zinc-800 rounded-lg h-1.5"
          />
          <p className="text-[9px] text-zinc-500 italic">0.75x Deep | 1.0x Normal | 1.25x High</p>
        </div>

        {/* Ring Modulation Slider */}
        <div className="space-y-3 bg-black/40 p-4 rounded-2xl border border-red-900/20 hover:border-red-900/40 transition-colors">
          <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-amber-400" />
              Ring Mod
            </span>
            <span className="text-amber-400 font-mono bg-red-950/50 px-2 py-0.5 rounded border border-red-900/40">
              {ringMod.toFixed(1)} Hz
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="200"
            step="1"
            value={ringMod}
            onChange={(e) => updateDspParams(pitch, parseFloat(e.target.value), gain)}
            className="w-full accent-amber-500 cursor-pointer bg-zinc-800 rounded-lg h-1.5"
          />
          <p className="text-[9px] text-zinc-500 italic">Cybernetic Frequency (0 = Off)</p>
        </div>

        {/* Gain Slider */}
        <div className="space-y-3 bg-black/40 p-4 rounded-2xl border border-red-900/20 hover:border-red-900/40 transition-colors">
          <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Sliders className="w-3 h-3 text-amber-400" />
              Master Gain
            </span>
            <span className="text-amber-400 font-mono bg-red-950/50 px-2 py-0.5 rounded border border-red-900/40">
              {gain.toFixed(2)}x
            </span>
          </div>
          <input
            type="range"
            min="0.0"
            max="2.5"
            step="0.05"
            value={gain}
            onChange={(e) => updateDspParams(pitch, ringMod, parseFloat(e.target.value))}
            className="w-full accent-amber-500 cursor-pointer bg-zinc-800 rounded-lg h-1.5"
          />
          <p className="text-[9px] text-zinc-500 italic">DSP Signal Gain Multiplier</p>
        </div>
      </div>

      {/* Quick Presets */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-red-900/20">
        <span className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider mr-1">
          Presets:
        </span>
        <button
          onClick={() => updateDspParams(0.75, 0.0, 1.25)}
          className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase font-mono transition-all border ${
            pitch === 0.75 && ringMod === 0.0
              ? 'bg-amber-500 text-black border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
              : 'bg-red-950/60 border-red-800/40 text-amber-400 hover:bg-amber-500 hover:text-black'
          }`}
        >
          Tactical Deep (0.75x)
        </button>
        <button
          onClick={() => updateDspParams(0.85, 45.0, 1.1)}
          className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase font-mono transition-all border ${
            pitch === 0.85 && ringMod === 45.0
              ? 'bg-amber-500 text-black border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
              : 'bg-red-950/60 border-red-800/40 text-amber-400 hover:bg-amber-500 hover:text-black'
          }`}
        >
          Cybernetic (0.85x / 45Hz)
        </button>
        <button
          onClick={() => updateDspParams(0.92, 12.0, 1.0)}
          className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase font-mono transition-all border ${
            pitch === 0.92 && ringMod === 12.0
              ? 'bg-amber-500 text-black border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
              : 'bg-red-950/60 border-red-800/40 text-amber-400 hover:bg-amber-500 hover:text-black'
          }`}
        >
          Steward Calibration
        </button>
        <button
          onClick={() => updateDspParams(1.0, 0.0, 1.0)}
          className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase font-mono transition-all border ${
            pitch === 1.0 && ringMod === 0.0
              ? 'bg-zinc-200 text-black border-zinc-100'
              : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
          }`}
        >
          Bypass
        </button>
      </div>
    </div>
  );
};

export default VoiceModControls;
