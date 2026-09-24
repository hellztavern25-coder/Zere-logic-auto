import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Socket } from 'socket.io-client';
import { Zap, Crosshair, Radio, Shield, Activity, Sliders, Volume2, VolumeX } from 'lucide-react';
import { tacticalTouchService, TacticalTouchState } from '../services/tacticalTouchService';

interface TacticalTouchOverlayProps {
  socket?: Socket | null;
}

interface TouchPoint {
  id: string | number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  startTime: number;
  quadrant: string;
  targetTag: string;
  pressure: number;
  isReleased?: boolean;
}

interface RippleEffect {
  id: string;
  x: number;
  y: number;
  timestamp: number;
  quadrant: string;
}

interface IntentAck {
  timestamp?: number;
  receivedAt?: number;
  status?: string;
  coords?: { x: number; y: number };
  quadrant?: string;
  totalCaptures?: number;
  message?: string;
}

export const TacticalTouchOverlay: React.FC<TacticalTouchOverlayProps> = ({ socket }) => {
  const [activeTouches, setActiveTouches] = useState<TouchPoint[]>([]);
  const [ripples, setRipples] = useState<RippleEffect[]>([]);
  const [lastAck, setLastAck] = useState<IntentAck | null>(null);
  const [totalCaptures, setTotalCaptures] = useState<number>(0);
  const [isEnabled, setIsEnabled] = useState<boolean>(true);
  const [isHapticEnabled, setIsHapticEnabled] = useState<boolean>(true);
  const [recentSignalFlash, setRecentSignalFlash] = useState<boolean>(false);

  const activeTouchesRef = useRef<Map<string | number, TouchPoint>>(new Map());
  const throttleEmitRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Subscribe to tacticalTouchService
  useEffect(() => {
    const unsub = tacticalTouchService.subscribe((state: TacticalTouchState) => {
      setIsEnabled(state.isEnabled);
      setIsHapticEnabled(state.isHapticEnabled);
      setTotalCaptures(state.totalCaptures);
      setRecentSignalFlash(state.recentFlash);
      if (state.lastAck) setLastAck(state.lastAck);
    });
    return unsub;
  }, []);

  // Subtle acoustic tactile chime
  const playTacticalChime = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) audioContextRef.current = new AudioCtx();
      }
      if (audioContextRef.current && audioContextRef.current.state === 'running') {
        const ctx = audioContextRef.current;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
        osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.08); // A6

        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      }
    } catch {
      // Audio context restricted until first user interaction; safe to ignore
    }
  }, []);

  // Compute quadrant based on viewport
  const getQuadrant = (x: number, y: number): string => {
    const w = window.innerWidth || 1000;
    const h = window.innerHeight || 800;
    const isWest = x < w / 2;
    const isNorth = y < h / 2;

    if (isNorth && isWest) return 'SECTOR I (NW)';
    if (isNorth && !isWest) return 'SECTOR II (NE)';
    if (!isNorth && isWest) return 'SECTOR III (SW)';
    return 'SECTOR IV (SE)';
  };

  // Signal touch intent to Butler's reasoning engine
  const signalIntentToButler = useCallback((x: number, y: number, targetTag: string, quadrant: string) => {
    const now = Date.now();
    setTotalCaptures(prev => prev + 1);
    setRecentSignalFlash(true);
    setTimeout(() => setRecentSignalFlash(false), 400);

    // Record in global tacticalTouchService
    tacticalTouchService.recordTouch(x, y, quadrant, targetTag);

    // Haptic feedback
    if (isHapticEnabled && typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([18, 10, 18]);
      } catch {
        // Safe vibration fallback
      }
    }

    playTacticalChime();

    // Socket transmission directly to Butler substrate
    if (socket) {
      socket.emit('tactical:touch_intent', {
        x: Math.round(x),
        y: Math.round(y),
        quadrant,
        targetTag,
        timestamp: now
      });
      socket.emit('neural:activity');
    }

    // Local DOM event dispatch for components (ChatBot, VoicePortal, Heartbeat)
    window.dispatchEvent(new CustomEvent('neural:intent_capture', {
      detail: {
        x: Math.round(x),
        y: Math.round(y),
        quadrant,
        targetTag,
        timestamp: now,
        source: 'tactical_touch_overlay'
      }
    }));
  }, [socket, isHapticEnabled, playTacticalChime]);

  // Handle server acknowledgment
  useEffect(() => {
    if (!socket) return;
    const handleAck = (data: IntentAck) => {
      setLastAck(data);
      tacticalTouchService.recordAck(data);
    };
    socket.on('tactical:intent_ack', handleAck);
    return () => {
      socket.off('tactical:intent_ack', handleAck);
    };
  }, [socket]);

  // Global Pointer & Touch Listeners
  useEffect(() => {
    if (!isEnabled) return;

    const handlePointerDown = (e: PointerEvent) => {
      const id = e.pointerId ?? 'primary';
      const x = e.clientX;
      const y = e.clientY;
      const target = e.target as HTMLElement | null;
      const targetTag = target?.tagName ? `${target.tagName.toLowerCase()}${target.id ? '#' + target.id : ''}` : 'viewport';
      const quadrant = getQuadrant(x, y);

      const touch: TouchPoint = {
        id,
        x,
        y,
        startX: x,
        startY: y,
        startTime: Date.now(),
        quadrant,
        targetTag,
        pressure: e.pressure || 1
      };

      activeTouchesRef.current.set(id, touch);
      setActiveTouches(Array.from(activeTouchesRef.current.values()));

      // Add ripple effect
      const rippleId = `rip_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      setRipples(prev => [...prev.slice(-9), { id: rippleId, x, y, timestamp: Date.now(), quadrant }]);

      // Signal intent immediately
      signalIntentToButler(x, y, targetTag, quadrant);
    };

    const handlePointerMove = (e: PointerEvent) => {
      const id = e.pointerId ?? 'primary';
      if (!activeTouchesRef.current.has(id)) return;

      const existing = activeTouchesRef.current.get(id)!;
      const x = e.clientX;
      const y = e.clientY;
      const quadrant = getQuadrant(x, y);

      const updated: TouchPoint = {
        ...existing,
        x,
        y,
        quadrant,
        pressure: e.pressure || existing.pressure
      };

      activeTouchesRef.current.set(id, updated);
      setActiveTouches(Array.from(activeTouchesRef.current.values()));

      // Throttled motion signal
      const now = Date.now();
      if (now - throttleEmitRef.current > 120) {
        throttleEmitRef.current = now;
        if (socket) {
          socket.emit('neural:activity');
        }
      }
    };

    const handlePointerUpOrCancel = (e: PointerEvent) => {
      const id = e.pointerId ?? 'primary';
      if (activeTouchesRef.current.has(id)) {
        activeTouchesRef.current.delete(id);
        setActiveTouches(Array.from(activeTouchesRef.current.values()));
      }
    };

    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUpOrCancel, { passive: true });
    window.addEventListener('pointercancel', handlePointerUpOrCancel, { passive: true });

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUpOrCancel);
      window.removeEventListener('pointercancel', handlePointerUpOrCancel);
    };
  }, [isEnabled, signalIntentToButler, socket]);

  // Clean up old ripples
  useEffect(() => {
    if (ripples.length === 0) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setRipples(prev => prev.filter(r => now - r.timestamp < 1200));
    }, 400);
    return () => clearInterval(timer);
  }, [ripples]);

  const primaryTouch = activeTouches[0] || null;

  return (
    <div 
      id="tactical-touch-overlay"
      className="fixed inset-0 pointer-events-none z-[80] overflow-hidden select-none"
    >
      {/* 1. Tactical Screen Corner HUD Brackets */}
      <div className="absolute inset-4 pointer-events-none transition-opacity duration-300">
        {/* Top-Left */}
        <div className={`absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 transition-all duration-300 ${
          activeTouches.length > 0 ? 'border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.5)]' : 'border-red-900/30'
        }`} />
        {/* Top-Right */}
        <div className={`absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 transition-all duration-300 ${
          activeTouches.length > 0 ? 'border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.5)]' : 'border-red-900/30'
        }`} />
        {/* Bottom-Left */}
        <div className={`absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 transition-all duration-300 ${
          activeTouches.length > 0 ? 'border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.5)]' : 'border-red-900/30'
        }`} />
        {/* Bottom-Right */}
        <div className={`absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 transition-all duration-300 ${
          activeTouches.length > 0 ? 'border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.5)]' : 'border-red-900/30'
        }`} />
      </div>

      {/* 2. Global Laser Hairlines on Active Touch */}
      {isEnabled && primaryTouch && (
        <>
          {/* Horizontal cross-hairline */}
          <div 
            className="absolute left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent pointer-events-none transition-all duration-75"
            style={{ top: `${primaryTouch.y}px` }}
          />
          {/* Vertical cross-hairline */}
          <div 
            className="absolute top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-amber-500/40 to-transparent pointer-events-none transition-all duration-75"
            style={{ left: `${primaryTouch.x}px` }}
          />
        </>
      )}

      {/* 3. Expanding Sonar Ripples on Contact */}
      <AnimatePresence>
        {isEnabled && ripples.map(ripple => (
          <motion.div
            key={ripple.id}
            initial={{ scale: 0.2, opacity: 0.9 }}
            animate={{ scale: 2.8, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{ left: `${ripple.x}px`, top: `${ripple.y}px` }}
          >
            {/* Outer shockwave */}
            <div className="w-24 h-24 rounded-full border border-amber-500/60 shadow-[0_0_20px_rgba(245,158,11,0.4)]" />
            {/* Secondary wave */}
            <div className="absolute inset-2 rounded-full border border-red-700/50 animate-ping" />
          </motion.div>
        ))}
      </AnimatePresence>

      {/* 4. Active Touch Reticles & Telemetry Panels */}
      {isEnabled && activeTouches.map((touch, index) => {
        const isNearRightEdge = touch.x > (window.innerWidth || 1000) - 220;
        const isNearBottomEdge = touch.y > (window.innerHeight || 800) - 140;

        return (
          <div 
            key={touch.id}
            className="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${touch.x}px`, top: `${touch.y}px` }}
          >
            {/* Concentric Rotating Reticle Ring */}
            <div className="relative w-28 h-28 flex items-center justify-center -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2">
              
              {/* Outer Golden Compass Ring */}
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-0 rounded-full border border-dashed border-amber-500/60"
              />

              {/* Counter-rotating Segmented Red-Burgundy Ring */}
              <motion.div 
                animate={{ rotate: -360 }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-2 rounded-full border-2 border-red-800/60 border-t-transparent border-b-transparent"
              />

              {/* Inner Pulsing Radar Core */}
              <motion.div 
                animate={{ scale: [0.85, 1.15, 0.85] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute w-8 h-8 rounded-full bg-red-950/40 border border-amber-400 flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.6)]"
              >
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              </motion.div>

              {/* Crosshair Ticks */}
              <div className="absolute top-0 w-0.5 h-2 bg-amber-400" />
              <div className="absolute bottom-0 w-0.5 h-2 bg-amber-400" />
              <div className="absolute left-0 w-2 h-0.5 bg-amber-400" />
              <div className="absolute right-0 w-2 h-0.5 bg-amber-400" />

              {/* Contact Point Identifier */}
              <span className="absolute -bottom-5 text-[8px] font-mono font-black text-amber-300 uppercase tracking-widest bg-black/80 px-1.5 py-0.5 rounded border border-red-900/40">
                P-0{index + 1}
              </span>
            </div>

            {/* Tactical Leader Line & Holographic Readout Panel */}
            <div 
              className={`absolute flex flex-col pointer-events-none transition-all ${
                isNearRightEdge ? 'right-16 text-right items-end' : 'left-16 text-left items-start'
              } ${
                isNearBottomEdge ? 'bottom-12' : 'top-6'
              }`}
            >
              {/* Leader Line Vector */}
              <div className={`h-[1px] w-12 bg-gradient-to-r ${
                isNearRightEdge ? 'from-transparent to-amber-500' : 'from-amber-500 to-transparent'
              } mb-1`} />

              {/* Tactical Readout Box */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-black/90 border border-amber-500/50 rounded-lg p-2.5 shadow-2xl backdrop-blur-md min-w-[190px]"
              >
                <div className="flex items-center justify-between gap-2 border-b border-red-900/30 pb-1 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                    <span className="text-[9px] font-mono font-black text-amber-400 uppercase tracking-wider">
                      INTENT VECTOR LOCKED
                    </span>
                  </div>
                  <span className="text-[8px] font-mono text-zinc-400">1¹ CORE</span>
                </div>

                <div className="space-y-0.5 font-mono text-[9px]">
                  <div className="flex items-center justify-between text-zinc-300">
                    <span className="text-zinc-500">COORDS:</span>
                    <span className="text-amber-300 font-bold">X:{Math.round(touch.x)} Y:{Math.round(touch.y)}</span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-300">
                    <span className="text-zinc-500">SECTOR:</span>
                    <span className="text-zinc-200">{touch.quadrant}</span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-300">
                    <span className="text-zinc-500">TARGET:</span>
                    <span className="text-zinc-400 truncate max-w-[100px]">{touch.targetTag}</span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-300 pt-1 border-t border-red-900/20">
                    <span className="text-emerald-400 font-bold">SIGNAL:</span>
                    <span className="text-emerald-400 font-bold uppercase">BUTLER ENGAGED</span>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TacticalTouchOverlay;
