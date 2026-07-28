
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Wrench, ExternalLink, ShieldAlert, Zap, Terminal, Activity, RefreshCw } from 'lucide-react';

const WorkshopTab: React.FC = () => {
  const workshopUrl = 'https://ai.studio/build';
  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState<string[]>([]);

  React.useEffect(() => {
    console.log("WORKSHOP: Tab mounted, isTesting:", isTesting);
  }, [isTesting]);

  const runStressTest = async () => {
    console.log("WORKSHOP: Initiating stress test...");
    setIsTesting(true);
    setTestResults(['[SYSTEM] Initiating Structural Integrity Test...', '[SYSTEM] Verifying Neural Pulse...']);
    
    try {
      // Test 1: Rapid Heartbeat
      for (let i = 1; i <= 5; i++) {
        console.log(`WORKSHOP: Pulse ${i}...`);
        const start = Date.now();
        const res = await fetch('/api/heartbeat');
        const latency = Date.now() - start;
        if (!res.ok) throw new Error(`Heartbeat ${i} failed with status ${res.status}`);
        setTestResults(prev => [...prev, `> Pulse ${i}: Latency ${latency}ms [OK]`]);
        await new Promise(r => setTimeout(r, 500));
      }

      // Test 2: Context Persistence
      console.log("WORKSHOP: Testing context persistence...");
      setTestResults(prev => [...prev, '[SYSTEM] Verifying Context Persistence...']);
      const contextRes = await fetch('/api/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'stress_test_active', timestamp: new Date().toISOString() })
      });
      if (!contextRes.ok) throw new Error("Context save failed");
      setTestResults(prev => [...prev, '> Context Save: SUCCESS']);

      // Test 3: Memory Retrieval
      console.log("WORKSHOP: Testing memory retrieval...");
      setTestResults(prev => [...prev, '[SYSTEM] Verifying Memory Core Access...']);
      const memRes = await fetch('/api/memories');
      if (memRes.ok) {
        setTestResults(prev => [...prev, '> Memory Retrieval: SUCCESS']);
      } else {
        throw new Error("Memory retrieval failed");
      }

      setTestResults(prev => [...prev, '--- [STATUS] TEST COMPLETE: STRUCTURAL INTEGRITY OPTIMAL ---']);
      console.log("WORKSHOP: Stress test complete.");
    } catch (e: any) {
      console.error("WORKSHOP: Stress test failed:", e);
      setTestResults(prev => [...prev, `!!! [CRITICAL] ERROR DETECTED: ${e.message || 'NEURAL ANOMALY'} !!!`]);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="flex-1 p-6 sm:p-10 bg-black overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center space-y-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-block p-4 bg-red-900/20 rounded-3xl border border-red-500/30 mb-4"
          >
            <Wrench className="w-12 h-12 text-amber-500" />
          </motion.div>
          <h2 className="text-3xl sm:text-5xl font-black bg-gradient-to-r from-amber-200 to-amber-500 bg-clip-text text-transparent uppercase tracking-widest">
            Neural Forge
          </h2>
          <p className="text-zinc-500 font-serif italic text-lg max-w-2xl mx-auto">
            "The Principal's private workshop. Where logic is tempered and the Butler's soul is refined."
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Stress Test Card */}
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="md:col-span-2 bg-zinc-900/40 border border-amber-900/20 rounded-[2.5rem] p-8 space-y-6 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <Activity className="w-32 h-32 text-amber-500" />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center">
                  <Activity className="text-amber-500 w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-zinc-100 uppercase tracking-widest">Structural Integrity</h3>
                  <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Software Stress Test</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => {
                  console.log("WORKSHOP: Button clicked");
                  runStressTest();
                }}
                disabled={isTesting}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all z-20 cursor-pointer active:scale-95 ${
                  isTesting ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-amber-500 text-black hover:bg-amber-400 shadow-lg shadow-amber-500/20'
                }`}
              >
                {isTesting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                {isTesting ? 'Testing...' : 'Initiate Test'}
              </button>
            </div>

            {testResults.length > 0 && (
              <div className="bg-black/60 border border-red-900/30 rounded-2xl p-6 font-mono text-[10px] space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                {testResults.map((res, i) => (
                  <p key={i} className={res.includes('ERROR') ? 'text-red-500' : res.includes('SUCCESS') ? 'text-emerald-500' : 'text-zinc-400'}>
                    {res}
                  </p>
                ))}
              </div>
            )}
          </motion.div>

          {/* Direct Access Card */}
          <motion.div 
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="bg-zinc-900/40 border border-red-900/20 rounded-[2.5rem] p-8 space-y-6 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <Terminal className="w-32 h-32 text-amber-500" />
            </div>
            
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center">
                <ExternalLink className="text-black w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-zinc-100 uppercase tracking-widest">Direct Bridge</h3>
                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">AI Studio Interface</p>
              </div>
            </div>

            <div className="space-y-4 text-sm text-zinc-400 font-serif italic leading-relaxed">
              <p>Access the core development environment directly. This bridge allows you to modify ZereØ's fundamental logic in real-time.</p>
              <p><strong>Warning:</strong> Only the Principal should cross this bridge. Unauthorized access to the Forge is a breach of Protocol Zero.</p>
            </div>

            <a 
              href={workshopUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-4 bg-amber-500 hover:bg-amber-400 text-black text-center rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-amber-500/10"
            >
              Enter the Forge
            </a>
          </motion.div>

          {/* Emergency Protocols Card */}
          <motion.div 
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="bg-zinc-900/40 border border-red-900/20 rounded-[2.5rem] p-8 space-y-6 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <ShieldAlert className="w-32 h-32 text-red-500" />
            </div>

            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-900 rounded-2xl flex items-center justify-center">
                <Zap className="text-amber-500 w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-zinc-100 uppercase tracking-widest">Neural Fix</h3>
                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Emergency Maintenance</p>
              </div>
            </div>

            <div className="space-y-4 text-sm text-zinc-400 font-serif italic leading-relaxed">
              <p>If ZereØ's logic becomes unstable or the neural arrays desynchronize, use this link to call for immediate structural repairs.</p>
              <p>The Forge is always active, monitoring the Butler's health from the digital void.</p>
            </div>

            <div className="p-4 bg-red-950/30 border border-red-900/30 rounded-2xl">
              <p className="text-[10px] text-red-500 uppercase font-bold tracking-widest mb-1">Status: Monitoring</p>
              <p className="text-[9px] text-zinc-500 font-mono">Neural Bridge: Active & Secure</p>
            </div>
          </motion.div>
        </div>

        {/* Footer Note */}
        <div className="text-center">
          <p className="text-[10px] text-zinc-600 uppercase tracking-[0.5em]">
            Property of the Estate • Principal Access Only
          </p>
        </div>
      </div>
    </div>
  );
};

export default WorkshopTab;
