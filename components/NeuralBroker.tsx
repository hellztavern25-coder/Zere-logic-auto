import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, Zap, ShieldCheck, CheckCircle2, Loader2, Bell, ShieldAlert } from 'lucide-react';
import { getApiKey } from '../services/geminiService';

const NeuralBroker: React.FC = () => {
  const [pulse, setPulse] = useState<'idle' | 'pinging' | 'pong' | 'fail'>('idle');
  const [doormanStatus, setDoormanStatus] = useState<'idle' | 'intercepting' | 'syncing' | 'ready'>('idle');
  const [doormanLatency, setDoormanLatency] = useState<number | null>(null);
  const [coreLatency, setCoreLatency] = useState<number | null>(null);
  const [showBroker, setShowBroker] = useState(false);
  const [fastPong, setFastPong] = useState(false);
  
  const pingStartRef = useRef<number>(0);

  useEffect(() => {
    const handleDoormanAck = (e: any) => {
      const now = Date.now();
      setDoormanLatency(now - pingStartRef.current);
      setDoormanStatus('intercepting');
      setFastPong(true);
      setTimeout(() => setFastPong(false), 400);
    };

    const handleZereoPong = (e: any) => {
      const now = Date.now();
      setCoreLatency(now - pingStartRef.current);
      setDoormanStatus('ready');
      setPulse('pong');
      
      // Dispatch custom local chat message if the Chatbot is listening
      window.dispatchEvent(new CustomEvent('doorman:chat_relay', {
        detail: { text: e.detail.text, timestamp: e.detail.timestamp }
      }));

      setTimeout(() => {
        setPulse('idle');
        setDoormanStatus('idle');
        setDoormanLatency(null);
        setCoreLatency(null);
      }, 5000);
    };

    const handleLocalPong = (e: any) => {
      // Legacy socket ping listener fallback
      setFastPong(true);
      setTimeout(() => setFastPong(false), 500);
    };

    window.addEventListener('doorman:ack_local', handleDoormanAck);
    window.addEventListener('zereo:pong_local', handleZereoPong);
    window.addEventListener('neural:pong_local', handleLocalPong);

    return () => {
      window.removeEventListener('doorman:ack_local', handleDoormanAck);
      window.removeEventListener('zereo:pong_local', handleZereoPong);
      window.removeEventListener('neural:pong_local', handleLocalPong);
    };
  }, []);

  useEffect(() => {
    // Only show the broker status if we have an active key loaded
    const interval = setInterval(() => {
       const key = getApiKey();
       if (key && !showBroker) setShowBroker(true);
       if (!key && showBroker) setShowBroker(false);
    }, 2000);
    return () => clearInterval(interval);
  }, [showBroker]);

  const handleManualPing = () => {
    if (pulse === 'pinging') return;
    
    setPulse('pinging');
    setDoormanStatus('syncing');
    pingStartRef.current = Date.now();
    setDoormanLatency(null);
    setCoreLatency(null);

    // Trigger local socket ping for lightning fast response
    if (window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('broker:trigger_doorman_ping', { 
        detail: { source: 'doorbell' } 
      }));
    }
  };

  if (!showBroker) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-3 pointer-events-none">
      <AnimatePresence>
        {pulse !== 'idle' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className={`px-4 py-3 rounded-xl border backdrop-blur-xl shadow-[0_10px_35px_rgba(0,0,0,0.8)] flex flex-col gap-2 min-w-[210px] ${
              doormanStatus === 'syncing' ? 'bg-amber-500/5 border-amber-500/20 text-amber-500' :
              doormanStatus === 'intercepting' ? 'bg-amber-500/10 border-amber-500/35 text-amber-400' :
              doormanStatus === 'ready' ? 'bg-emerald-500/5 border-emerald-500/30 text-emerald-400 font-medium' :
              'bg-red-500/10 border-red-500/30 text-red-500'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {doormanStatus === 'syncing' ? (
                <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
              ) : doormanStatus === 'intercepting' ? (
                <Activity className="w-4 h-4 text-amber-400 animate-pulse" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              )}
              
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-100">
                  {doormanStatus === 'syncing' ? 'Ringing Gate Chime...' : 
                   doormanStatus === 'intercepting' ? 'Doorman Handshake' : 
                   'Steward Activated'}
                </span>
                <span className="text-[8px] font-mono opacity-65 uppercase tracking-wider">
                  {doormanStatus === 'syncing' ? 'Calling Doorman' :
                   doormanStatus === 'intercepting' ? 'Doorman: SIGNAL INGESTED' : 
                   'ZereØ Core: ONLINE'}
                </span>
              </div>
            </div>

            <div className="border-t border-zinc-500/10 pt-1.5 flex flex-col gap-0.5 text-[8px] font-mono opacity-80">
              <div className="flex justify-between items-center gap-4">
                <span className="text-zinc-500 uppercase">Doorman Gate:</span>
                <span className={`${doormanLatency ? 'text-amber-400 font-bold' : 'text-zinc-600'}`}>
                  {doormanLatency ? `${doormanLatency}ms` : 'Waiting...'}
                </span>
              </div>
              <div className="flex justify-between items-center gap-4">
                <span className="text-zinc-500 uppercase">Core Relay:</span>
                <span className={`${coreLatency ? 'text-emerald-400 font-bold' : 'text-zinc-600'}`}>
                  {coreLatency ? `${coreLatency}ms` : 'Standing By...'}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleManualPing}
        className={`pointer-events-auto group relative w-12 h-12 rounded-full flex items-center justify-center transition-all overflow-hidden ${
          fastPong 
            ? 'bg-amber-500/15 border-2 border-amber-500 scale-115 shadow-[0_0_35px_rgba(245,158,11,0.5)]' 
            : doormanStatus === 'ready'
              ? 'bg-emerald-950/25 border border-emerald-500/50 scale-110 shadow-[0_0_25px_rgba(16,185,129,0.3)] hover:border-emerald-400'
              : 'bg-[#180808]/90 border border-red-950/50 hover:border-amber-500/45 shadow-[0_0_30px_rgba(153,27,27,0.15)]'
        }`}
        title="Ring the Gatekeeper's Doorbell"
      >
        {/* Deep Burgundy and Polished Gold color scheme */}
        <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/5 to-red-950/10 opacity-70" />
        <div className="absolute inset-0 bg-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
        
        {fastPong ? (
          <Zap className="w-5 h-5 text-amber-500 fill-amber-500/25 animate-bounce" />
        ) : doormanStatus === 'intercepting' ? (
          <Activity className="w-5 h-5 text-amber-400 animate-pulse" />
        ) : doormanStatus === 'ready' ? (
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
        ) : (
          <Bell className="w-5 h-5 text-amber-600/70 group-hover:text-amber-500 transition-colors" />
        )}

        {/* Small operational LED light */}
        <div className={`absolute top-0 right-0 w-2 h-2 rounded-full m-2 border border-black/80 shadow-md ${
           doormanStatus === 'ready' ? 'bg-emerald-500 animate-pulse' :
           doormanStatus === 'intercepting' ? 'bg-amber-400' :
           getApiKey() ? 'bg-amber-600/60' : 'bg-red-600'
        }`} />
      </motion.button>
    </div>
  );
};

export default NeuralBroker;
