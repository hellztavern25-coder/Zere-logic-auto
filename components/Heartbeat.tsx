import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Activity, RefreshCw } from 'lucide-react';

const Heartbeat: React.FC = () => {
  const [lastPulse, setLastPulse] = useState<string>(() => new Date().toLocaleTimeString());
  const [status, setStatus] = useState<'active' | 'warning' | 'error'>('active');
  const [isPulsing, setIsPulsing] = useState<boolean>(false);
  const consecutiveFailuresRef = useRef<number>(0);
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef<boolean>(true);

  const performPulse = useCallback(async (isManual: boolean = false) => {
    if (isPulsing && !isManual) return;
    setIsPulsing(true);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);

    try {
      const res = await fetch('/api/heartbeat', {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      });

      clearTimeout(timer);

      if (!isMountedRef.current) return;

      if (res.ok) {
        consecutiveFailuresRef.current = 0;
        setLastPulse(new Date().toLocaleTimeString());
        setStatus('active');
      } else {
        consecutiveFailuresRef.current += 1;
        setStatus(consecutiveFailuresRef.current >= 3 ? 'error' : 'warning');
      }
    } catch (err: any) {
      clearTimeout(timer);
      if (!isMountedRef.current) return;

      consecutiveFailuresRef.current += 1;
      
      // If network temporarily drops or server is booting, mark as warning and gently retry
      if (consecutiveFailuresRef.current >= 3) {
        setStatus('error');
        // Gentle diagnostic warning, avoiding unhandled console.error alert spam
        console.warn('Neural Pulse: Connection degraded after multiple attempts, retrying...', err?.message || err);
      } else {
        setStatus('warning');
      }

      // Schedule a fast retry in 3 seconds on failure
      if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          performPulse(false);
        }
      }, 3000);
    } finally {
      if (isMountedRef.current) {
        setIsPulsing(false);
      }
    }
  }, [isPulsing]);

  useEffect(() => {
    isMountedRef.current = true;

    // Initial pulse on mount with slight delay to ensure dev server Vite proxy is settled
    const initialTimer = setTimeout(() => {
      performPulse(false);
    }, 400);

    // Regular keep-alive heartbeat every 20 seconds
    const interval = setInterval(() => {
      performPulse(false);
    }, 20000);

    // Auto-pulse when device comes back online
    const handleOnline = () => {
      consecutiveFailuresRef.current = 0;
      performPulse(true);
    };

    window.addEventListener('online', handleOnline);

    return () => {
      isMountedRef.current = false;
      clearTimeout(initialTimer);
      clearInterval(interval);
      if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
      window.removeEventListener('online', handleOnline);
    };
  }, [performPulse]);

  return (
    <div 
      onClick={() => performPulse(true)}
      title="ZereØ Neural Pulse Monitor (Click to re-ping substrate)"
      className="fixed bottom-4 right-4 z-[100] flex items-center gap-2 px-3 py-1.5 bg-black/70 hover:bg-black/90 backdrop-blur-md border border-red-900/40 hover:border-amber-500/50 rounded-full cursor-pointer transition-all shadow-lg group select-none"
    >
      <div className={`w-2 h-2 rounded-full transition-all ${
        status === 'active' 
          ? 'bg-emerald-400 shadow-[0_0_10px_#34d399] animate-pulse' 
          : status === 'warning' 
          ? 'bg-amber-400 shadow-[0_0_10px_#fbbf24] animate-bounce' 
          : 'bg-red-500 shadow-[0_0_10px_#ef4444]'
      }`} />
      
      <span className="text-[8px] font-black text-zinc-400 group-hover:text-amber-300 uppercase tracking-widest transition-colors font-mono">
        Pulse: {lastPulse}
      </span>

      {isPulsing ? (
        <RefreshCw className="w-3 h-3 text-amber-400 animate-spin" />
      ) : (
        <Activity className={`w-3 h-3 transition-colors ${
          status === 'active' ? 'text-emerald-400 group-hover:text-emerald-300' :
          status === 'warning' ? 'text-amber-400 group-hover:text-amber-300' :
          'text-red-400'
        }`} />
      )}
    </div>
  );
};

export default Heartbeat;
