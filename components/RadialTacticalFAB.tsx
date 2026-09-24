import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Socket } from 'socket.io-client';
import { 
  Crosshair, 
  X, 
  Trash2, 
  ShieldCheck, 
  Zap, 
  Volume2, 
  VolumeX, 
  Monitor, 
  Radio, 
  CheckCircle2, 
  Clock, 
  Flame, 
  Lock,
  Bell
} from 'lucide-react';
import { jeremyIronsVoice } from '../services/jeremyIronsVoiceService';

interface RadialTacticalFABProps {
  isPrincipalMode: boolean;
  setIsPrincipalMode: React.Dispatch<React.SetStateAction<boolean>>;
  socket?: Socket | null;
  onScreenCaptureTrigger?: () => void;
}

interface ShortcutAction {
  id: string;
  label: string;
  description: string;
  angleDeg: number; // in degrees: 90 is directly Up, 180 is directly Left
  icon: React.ComponentType<{ className?: string }>;
  accentColor: 'gold' | 'red' | 'emerald' | 'cyan' | 'purple';
  isActive?: boolean;
  action: () => void | Promise<void>;
}

export const RadialTacticalFAB: React.FC<RadialTacticalFABProps> = ({
  isPrincipalMode,
  setIsPrincipalMode,
  socket,
  onScreenCaptureTrigger
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ title: string; detail?: string; type: 'success' | 'info' | 'pulse' } | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(() => {
    return localStorage.getItem('ZEREO_TTS_ENABLED') !== 'false';
  });
  const [isPinging, setIsPinging] = useState(false);
  const [pulseWave, setPulseWave] = useState(false);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Play subtle tactical audio feedback
  const playTacticalClick = useCallback((freq = 740, duration = 0.06, type: OscillatorType = 'sine') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Audio context might be restricted before interaction
    }
  }, []);

  const triggerToast = useCallback((title: string, detail?: string, type: 'success' | 'info' | 'pulse' = 'success') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage({ title, detail, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  }, []);

  // Listen for escape key to close menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        playTacticalClick(440, 0.04);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, playTacticalClick]);

  // Sync TTS state changes across window
  useEffect(() => {
    const handleTtsToggleEvent = (e: CustomEvent) => {
      if (e.detail?.enabled !== undefined) {
        setTtsEnabled(e.detail.enabled);
      }
    };
    window.addEventListener('zereo:tts_toggle' as any, handleTtsToggleEvent);
    return () => window.removeEventListener('zereo:tts_toggle' as any, handleTtsToggleEvent);
  }, []);

  // Action: Clear Audit Log
  const handleClearAuditLog = async () => {
    playTacticalClick(520, 0.08, 'triangle');
    let clearedCount = 0;

    // 1. Client buffer clear
    if (typeof window !== 'undefined' && window.__CLEAR_ZEREO_AUDIT_BUFFER__) {
      const logs = window.__GET_ZEREO_AUDIT_LOGS__?.() || [];
      clearedCount = logs.length;
      window.__CLEAR_ZEREO_AUDIT_BUFFER__();
    }
    try {
      localStorage.removeItem('ZEREO_PRINCIPAL_AUDIT_BUFFER');
    } catch {}

    // 2. Server buffer clear via REST
    try {
      const res = await fetch('/api/audit/principal-buffer', { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        clearedCount = Math.max(clearedCount, data.clearedCount || 0);
      }
    } catch {
      // Offline fallback
    }

    // 3. Socket broadcast
    if (socket && socket.connected) {
      socket.emit('audit:clear');
    }

    window.dispatchEvent(new CustomEvent('audit:cleared', { detail: { count: clearedCount } }));

    triggerToast(
      'Audit Log Purged',
      `${clearedCount > 0 ? `${clearedCount} reasoning records` : 'All in-memory traces'} scrubbed from the ledger.`,
      'success'
    );
    setIsOpen(false);
  };

  // Action: Toggle Principal Mode
  const handleTogglePrincipalMode = async () => {
    const nextState = !isPrincipalMode;
    setIsPrincipalMode(nextState);
    playTacticalClick(nextState ? 880 : 440, 0.1, 'sawtooth');

    try {
      localStorage.setItem('ZEREO_PRINCIPAL_ACTIVE', String(nextState));
    } catch {}

    // Notify backend
    try {
      await fetch('/api/config/principal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPrincipalActive: nextState })
      });
      await fetch('/api/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isPrincipalMode: nextState,
          lastActive: new Date().toISOString()
        })
      });
    } catch {
      // Continue client-side
    }

    triggerToast(
      nextState ? 'Principal Mode: ENGAGED' : 'Principal Mode: STANDBY',
      nextState 
        ? 'Passcode 8212 locked. Autonomous sovereign authority restored.' 
        : 'Restricted mode activated. System guardrails elevated.',
      nextState ? 'pulse' : 'info'
    );
    setIsOpen(false);
  };

  // Action: Ping Neural Core
  const handlePingNeuralCore = async () => {
    setIsPinging(true);
    setPulseWave(true);
    playTacticalClick(1046, 0.12, 'sine'); // High C
    const startTime = performance.now();

    // Trigger visual pulse in ChatBot / DOM
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('broker:trigger_doorman_ping', { 
        detail: { source: 'radial_fab' } 
      }));
    }

    // Socket ping
    if (socket && socket.connected) {
      socket.emit('neural:ping');
    }

    // REST latency measurement
    try {
      const res = await fetch('/api/neural/ping', { method: 'POST' });
      const durationMs = (performance.now() - startTime).toFixed(1);
      if (res.ok) {
        triggerToast(
          'Neural Core: NOMINAL',
          `Handshake confirmed in ${durationMs}ms. Substrate resonance 100%.`,
          'pulse'
        );
      } else {
        triggerToast(
          'Neural Ping Broadcasted',
          `Array signal dispatched in ${durationMs}ms.`,
          'info'
        );
      }
    } catch {
      const durationMs = (performance.now() - startTime).toFixed(1);
      triggerToast(
        'Neural Pulse Radiated',
        `Local acoustic & visual sweep executed (${durationMs}ms).`,
        'pulse'
      );
    } finally {
      setIsPinging(false);
      setTimeout(() => setPulseWave(false), 900);
      setIsOpen(false);
    }
  };

  // Action: Toggle Jeremy Irons Voice
  const handleToggleVoice = () => {
    const nextState = !ttsEnabled;
    setTtsEnabled(nextState);
    playTacticalClick(nextState ? 660 : 330, 0.08);

    try {
      localStorage.setItem('ZEREO_TTS_ENABLED', String(nextState));
    } catch {}

    if (!nextState) {
      jeremyIronsVoice.stop();
    }

    window.dispatchEvent(new CustomEvent('zereo:tts_toggle', { detail: { enabled: nextState } }));

    triggerToast(
      nextState ? 'Voice Cadence: ONLINE' : 'Voice Cadence: MUTED',
      nextState 
        ? "Jeremy Irons' aristocratic baritone synthesis active." 
        : 'Acoustic vocalization suspended.',
      nextState ? 'success' : 'info'
    );
    setIsOpen(false);
  };

  // Action: Screen Telemetry Capture
  const handleScreenCapture = () => {
    playTacticalClick(720, 0.08);
    if (onScreenCaptureTrigger) {
      onScreenCaptureTrigger();
    } else {
      window.dispatchEvent(new CustomEvent('zereo:trigger_screen_share'));
    }
    triggerToast('Screen Telemetry', 'Perceptual display capture initiated for visual reasoning.', 'info');
    setIsOpen(false);
  };

  // High-frequency shortcuts array
  // Radius calculation:
  // Spread in a quadrant from 95° (mostly top) to 175° (mostly left)
  const shortcuts: ShortcutAction[] = [
    {
      id: 'principal_mode',
      label: 'Toggle Principal Mode',
      description: isPrincipalMode ? 'State: Active (8212)' : 'State: Standby',
      angleDeg: 98,
      icon: isPrincipalMode ? ShieldCheck : Lock,
      accentColor: isPrincipalMode ? 'gold' : 'red',
      isActive: isPrincipalMode,
      action: handleTogglePrincipalMode
    },
    {
      id: 'neural_ping',
      label: 'Ring Chime / Core Ping',
      description: 'Doorman Chime & State Sync',
      angleDeg: 124,
      icon: Bell,
      accentColor: 'gold',
      isActive: isPinging,
      action: handlePingNeuralCore
    },
    {
      id: 'clear_audit',
      label: 'Clear Audit Log',
      description: 'Purge Reasoning Ledger',
      angleDeg: 152,
      icon: Trash2,
      accentColor: 'red',
      action: handleClearAuditLog
    },
    {
      id: 'voice_toggle',
      label: ttsEnabled ? 'Mute Voice Cadence' : 'Enable Voice Cadence',
      description: ttsEnabled ? 'Jeremy Irons Baritone' : 'Silent Telemetry',
      angleDeg: 178,
      icon: ttsEnabled ? Volume2 : VolumeX,
      accentColor: ttsEnabled ? 'emerald' : 'cyan',
      isActive: ttsEnabled,
      action: handleToggleVoice
    }
  ];

  // Radial distance from FAB button center
  const radius = 106; // pixels

  return (
    <>
      {/* Visual Neural Pulse Wave when Pinged */}
      <AnimatePresence>
        {pulseWave && (
          <motion.div
            initial={{ opacity: 0.8, scale: 0.96 }}
            animate={{ opacity: 0, scale: 1.05 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.85, ease: 'easeOut' }}
            className="fixed inset-0 pointer-events-none z-[100] border-2 border-amber-500/60 shadow-[inset_0_0_80px_rgba(245,158,11,0.25)]"
          />
        )}
      </AnimatePresence>

      {/* Backdrop Click-Away */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="radial-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => {
              setIsOpen(false);
              playTacticalClick(440, 0.04);
            }}
            className="fixed inset-0 bg-black/45 backdrop-blur-[2px] z-40"
          />
        )}
      </AnimatePresence>

      {/* Floating Action Button & Radial Nodes Container (Elevated above Command Deck) */}
      <div 
        className="fixed bottom-[calc(6.75rem+env(safe-area-inset-bottom))] sm:bottom-32 right-3.5 sm:right-6 z-50 pointer-events-none"
        style={{ width: '56px', height: '56px' }}
      >
        {/* Toast HUD Notification */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              key="radial-toast"
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute right-0 bottom-18 pointer-events-auto whitespace-nowrap"
            >
              <div className="bg-gradient-to-r from-zinc-950 via-[#150a0a] to-zinc-950 border border-amber-500/50 rounded-xl px-3.5 py-2.5 shadow-[0_10px_25px_rgba(0,0,0,0.8)] flex items-center gap-3 backdrop-blur-md">
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                  toastMessage.type === 'pulse'
                    ? 'bg-amber-400 animate-ping'
                    : toastMessage.type === 'success'
                    ? 'bg-emerald-400'
                    : 'bg-amber-400'
                }`} />
                <div className="flex flex-col">
                  <span className="text-[11px] font-mono font-black uppercase tracking-wider text-amber-300">
                    {toastMessage.title}
                  </span>
                  {toastMessage.detail && (
                    <span className="text-[9px] font-mono text-zinc-400 tracking-tight">
                      {toastMessage.detail}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Radial Shortcut Nodes */}
        <AnimatePresence>
          {isOpen && (
            shortcuts.map((shortcut, index) => {
              // Mathematical trigonometry conversion:
              // angleDeg: 90 = top (x=0, y=-R), 180 = left (x=-R, y=0)
              const rad = (shortcut.angleDeg * Math.PI) / 180;
              const x = Math.round(-radius * Math.sin(rad - Math.PI / 2)); // negative goes left
              const y = Math.round(-radius * Math.cos(rad - Math.PI / 2)); // negative goes up

              const Icon = shortcut.icon;

              return (
                <motion.div
                  key={shortcut.id}
                  initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                  animate={{ 
                    opacity: 1, 
                    scale: 1, 
                    x, 
                    y 
                  }}
                  exit={{ 
                    opacity: 0, 
                    scale: 0, 
                    x: 0, 
                    y: 0 
                  }}
                  transition={{ 
                    type: 'spring', 
                    damping: 20, 
                    stiffness: 280, 
                    delay: index * 0.035 
                  }}
                  className="absolute top-1 left-1 pointer-events-auto group"
                >
                  <div className="relative flex items-center">
                    {/* Interactive Radial Circular Button */}
                    <button
                      onClick={() => {
                        shortcut.action();
                      }}
                      title={`${shortcut.label} (${shortcut.description})`}
                      className={`relative w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 shadow-xl border cursor-pointer ${
                        shortcut.id === 'principal_mode' && isPrincipalMode
                          ? 'bg-gradient-to-br from-amber-950 via-zinc-950 to-red-950 border-amber-500 text-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.35)]'
                          : shortcut.id === 'clear_audit'
                          ? 'bg-zinc-950 hover:bg-red-950/80 border-red-900/50 hover:border-red-500 text-red-300 hover:text-red-200'
                          : shortcut.isActive
                          ? 'bg-zinc-950 border-amber-500/80 text-amber-400 hover:border-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.25)]'
                          : 'bg-zinc-950 hover:bg-zinc-900 border-zinc-700/60 hover:border-amber-500/50 text-zinc-300 hover:text-amber-400'
                      } hover:scale-110 active:scale-95 focus-visible:ring-2 focus-visible:ring-amber-400`}
                    >
                      <Icon className="w-5 h-5 transition-transform group-hover:rotate-12" />
                      
                      {/* Active Status Pip */}
                      {shortcut.isActive && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 border border-black animate-pulse" />
                      )}
                    </button>

                    {/* Precision Tooltip / Floating Label */}
                    <div 
                      className={`absolute right-14 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-50 bg-black/95 border border-amber-500/40 rounded-xl px-2.5 py-1 shadow-2xl backdrop-blur-md flex flex-col items-end text-right`}
                    >
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-300 whitespace-nowrap">
                        {shortcut.label}
                      </span>
                      <span className="text-[8px] font-mono text-zinc-400 whitespace-nowrap">
                        {shortcut.description}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>

        {/* Primary Floating Action Button (FAB) Anchor */}
        <button
          onClick={() => {
            playTacticalClick(isOpen ? 440 : 880, 0.05);
            setIsOpen(!isOpen);
          }}
          aria-label={isOpen ? "Close tactical radial menu" : "Open high-frequency tactical radial menu"}
          aria-expanded={isOpen}
          className={`relative w-13 h-13 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center transition-all duration-300 pointer-events-auto border cursor-pointer shadow-2xl ${
            isOpen
              ? 'bg-gradient-to-br from-red-900 via-zinc-950 to-black border-amber-400 text-amber-300 shadow-[0_0_25px_rgba(251,191,36,0.4)] scale-105'
              : isPrincipalMode
              ? 'bg-gradient-to-br from-red-950 via-zinc-950 to-black border-amber-500/70 hover:border-amber-400 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.25)] hover:scale-105'
              : 'bg-zinc-950 hover:bg-zinc-900 border-zinc-700 hover:border-amber-500/60 text-zinc-300 hover:text-amber-400 hover:scale-105'
          } active:scale-95 focus-visible:ring-2 focus-visible:ring-amber-400`}
          title={isOpen ? "Close Radial Shortcuts [Esc]" : "ZereØ Tactical Quick Actions [Radial HUD]"}
        >
          {/* Subtle Outer Pulsing Accent Ring when Principal Mode is Active */}
          {isPrincipalMode && !isOpen && (
            <div className="absolute inset-0 rounded-2xl border border-amber-500/30 animate-ping pointer-events-none opacity-40" />
          )}

          {/* Central Rotating Icon */}
          <motion.div
            animate={{ rotate: isOpen ? 135 : 0 }}
            transition={{ type: 'spring', damping: 15, stiffness: 220 }}
          >
            {isOpen ? (
              <X className="w-6 h-6 text-amber-300" />
            ) : (
              <Crosshair className="w-6 h-6 text-amber-400" />
            )}
          </motion.div>

          {/* Small Status Insignia Dot */}
          <span 
            className={`absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full border border-black ${
              isPrincipalMode ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]' : 'bg-zinc-600'
            }`}
            title={isPrincipalMode ? "Principal Recognition: Active" : "Principal Recognition: Standby"}
          />
        </button>
      </div>
    </>
  );
};

export default RadialTacticalFAB;
