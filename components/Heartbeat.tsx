
import React, { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';

const Heartbeat: React.FC = () => {
  const [lastPulse, setLastPulse] = useState<string>(new Date().toLocaleTimeString());
  const [status, setStatus] = useState<'active' | 'warning' | 'error'>('active');

  useEffect(() => {
    const pulse = async () => {
      try {
        const res = await fetch('/api/heartbeat');
        if (res.ok) {
          setLastPulse(new Date().toLocaleTimeString());
          setStatus('active');
        } else {
          setStatus('warning');
        }
      } catch (e) {
        console.error("Heartbeat Failure:", e);
        setStatus('error');
      }
    };

    // Initial pulse
    pulse();

    // Set interval for every 25 seconds to keep Cloud Run alive
    const interval = setInterval(pulse, 25000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex items-center gap-2 px-3 py-1.5 bg-black/60 backdrop-blur-md border border-red-900/30 rounded-full">
      <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${
        status === 'active' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 
        status === 'warning' ? 'bg-amber-500 shadow-[0_0_8px_#f59e0b]' : 
        'bg-red-500 shadow-[0_0_8px_#ef4444]'
      }`} />
      <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">
        Neural Pulse: {lastPulse}
      </span>
      <Activity className={`w-3 h-3 ${status === 'active' ? 'text-emerald-500' : 'text-zinc-500'}`} />
    </div>
  );
};

export default Heartbeat;
