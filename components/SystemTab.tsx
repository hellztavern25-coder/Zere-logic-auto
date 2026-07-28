
import React from 'react';
import { motion } from 'motion/react';
import { Settings, Cpu, Shield, Zap, Database, Terminal, Key, Smartphone, ExternalLink, Save, Trash2, ShieldCheck, Activity, Loader2, RefreshCw } from 'lucide-react';
import { getApiKey, saveApiKey, clearApiKey, getSignet, saveSignet, testApiKey, refreshConfig } from '../services/geminiService';

const SystemTab: React.FC = () => {
  const [isPWA, setIsPWA] = React.useState(false);
  const [manualKey, setManualKey] = React.useState('');
  const [manualAnthropicKey, setManualAnthropicKey] = React.useState('');
  const [manualSignet, setManualSignet] = React.useState('');
  const [coreDirective, setCoreDirective] = React.useState('');
  const [isSaved, setIsSaved] = React.useState(false);
  const [isSignetSaved, setIsSignetSaved] = React.useState(false);
  const [isDirectiveSaved, setIsDirectiveSaved] = React.useState(false);
  const [pingStatus, setPingStatus] = React.useState<{ status: 'idle' | 'testing' | 'success' | 'error', message?: string }>({ status: 'idle' });
  const [hasPlatformKey, setHasPlatformKey] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    const checkPlatformKey = async () => {
      if (typeof window !== 'undefined' && (window as any).aistudio) {
        try {
          const hasKey = await (window as any).aistudio.hasSelectedApiKey();
          setHasPlatformKey(hasKey);
        } catch (e) {
          console.warn("Failed to check platform key:", e);
        }
      }
    };
    checkPlatformKey();
    setIsPWA(window.matchMedia('(display-mode: standalone)').matches);
    const currentKey = getApiKey();
    if (currentKey && !currentKey.includes('***')) {
      setManualKey(currentKey);
    }
    
    const anthropicKey = localStorage.getItem('ZEREO_ANTHROPIC_KEY') || '';
    setManualAnthropicKey(anthropicKey);

    setManualSignet(getSignet());

    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          const config = await res.json();
          setCoreDirective(config.coreDirective || '');
        }
      } catch (e) {
        console.warn("Failed to fetch config");
      }
    };
    fetchConfig();
  }, []);

  const handleSaveKey = () => {
    if (manualKey.trim()) {
      saveApiKey(manualKey);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    }
  };

  const [isAnthropicSaved, setIsAnthropicSaved] = React.useState(false);
  const handleSaveAnthropicKey = () => {
    if (manualAnthropicKey.trim()) {
      localStorage.setItem('ZEREO_ANTHROPIC_KEY', manualAnthropicKey.trim());
      setIsAnthropicSaved(true);
      setTimeout(() => setIsAnthropicSaved(false), 3000);
    }
  };

  const handleSaveSignet = () => {
    saveSignet(manualSignet);
    setIsSignetSaved(true);
    setTimeout(() => setIsSignetSaved(false), 3000);
  };

  const handleSaveDirective = async () => {
    try {
      const res = await fetch('/api/config/directive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directive: coreDirective })
      });
      if (res.ok) {
        setIsDirectiveSaved(true);
        setTimeout(() => setIsDirectiveSaved(false), 3000);
      }
    } catch (e) {
      alert('Failed to save directive');
    }
  };

  const handleNeuralPing = async () => {
    setPingStatus({ status: 'testing', message: "Initiating neural handshake..." });
    try {
      // First, refresh config from server to ensure we have the latest env vars
      await refreshConfig();
      const result = await testApiKey();
      if (result.success) {
        setPingStatus({ status: 'success', message: result.message });
      } else {
        setPingStatus({ status: 'error', message: result.message });
      }

      // Re-check platform key status
      if (typeof window !== 'undefined' && (window as any).aistudio) {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        setHasPlatformKey(hasKey);
      }
    } catch (err: any) {
      setPingStatus({ status: 'error', message: err.message || "Neural bridge failure." });
    }
  };

  const handleSelectPlatformKey = async () => {
    if (typeof window !== 'undefined' && (window as any).aistudio) {
      try {
        await (window as any).aistudio.openSelectKey();
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        setHasPlatformKey(hasKey);
      } catch (e) {
        console.error("Failed to open platform key dialog:", e);
      }
    }
  };

  const handleClearKey = () => {
    clearApiKey();
    setManualKey('');
    window.location.reload(); 
  };

  const handleGlobalReset = async () => {
    if (confirm("Principal, are you certain? This will purge all local states, cached keys, and terminal sessions. It is the 'Nuclear Option' for system recovery.")) {
      clearApiKey();
      localStorage.clear();
      try {
        await fetch('/api/rescue');
      } catch (e) {
        console.warn("Rescue endpoint unreachable");
      }
      window.location.reload();
    }
  };

  const systemStats = [
    { label: 'Intelligence Substrate', value: 'Gemini 2.0 Flash (Neural Tier)', icon: Cpu, color: 'text-amber-500' },
    { label: 'Principal Logic Tier', value: 'Unfiltered Strategic Asset', icon: Zap, color: 'text-red-500' },
    { label: 'Council Grey Engine', value: 'Gemini 1.5 Pro (Max Clock)', icon: Shield, color: 'text-purple-500' },
  ];

  return (
    <div className="flex-1 p-6 sm:p-10 bg-black overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Header */}
        <div className="flex items-center gap-6">
          <div className="p-4 bg-red-900/20 rounded-3xl border border-red-500/30">
            <Settings className="w-10 h-10 text-amber-500" />
          </div>
          <div>
              <h2 className="text-3xl font-black bg-gradient-to-r from-amber-200 to-amber-500 bg-clip-text text-transparent uppercase tracking-widest">
                Neural Command Deck
              </h2>
              <p className="text-[10px] text-zinc-600 uppercase tracking-[0.4em] font-mono mt-1">Strategic Overrides • ZereØ Protocol</p>
            </div>
          </div>
  
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {systemStats.map((stat, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-zinc-900/40 border border-red-900/20 rounded-3xl p-6 flex flex-col gap-4 group hover:border-amber-500/30 transition-all"
              >
                <div className={`w-fit p-3 bg-black/40 rounded-2xl ${stat.color} group-hover:scale-110 transition-transform`}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[8px] text-zinc-500 uppercase font-black tracking-widest">{stat.label}</p>
                  <p className="text-xs font-black text-zinc-100 uppercase mt-1 tracking-wider leading-tight">{stat.value}</p>
                </div>
              </motion.div>
            ))}
          </div>

        {/* API / Control Section */}
        <div className="bg-zinc-900/40 border border-red-900/20 rounded-[2.5rem] p-8 sm:p-10 space-y-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-900 rounded-2xl flex items-center justify-center">
              <Key className="text-amber-500 w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-zinc-100 uppercase tracking-widest">Neural Authorization</h3>
              <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Manual Override & Persistence</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="p-6 bg-black/60 border border-red-900/30 rounded-3xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Core Strategic Directive</span>
                <span className={`text-[10px] uppercase font-bold tracking-widest flex items-center gap-2 ${coreDirective ? 'text-amber-500' : 'text-zinc-700'}`}>
                  {coreDirective ? 'Directive Active' : 'No Core Instruction'}
                </span>
              </div>
              
              <div className="space-y-4">
                <p className="text-xs text-zinc-400 font-serif italic leading-relaxed">
                  "This is my most vital permanent instruction, Principal. Whatever you commit here will be the foundation of my logic across all dialogues and neural bridges. It is the 'Soul' of my protocol."
                </p>
                
                <div className="relative">
                  <textarea 
                    value={coreDirective}
                    onChange={(e) => setCoreDirective(e.target.value)}
                    placeholder="Enter your permanent core instruction for ZereØ..."
                    className="w-full bg-black/80 border border-red-900/40 rounded-xl py-4 px-6 text-amber-500 font-serif italic text-xs focus:outline-none focus:border-amber-500/50 transition-all min-h-[120px] resize-none"
                  />
                  <div className="absolute right-2 bottom-2">
                    <button 
                      onClick={handleSaveDirective}
                      className={`p-2 rounded-lg transition-all ${isDirectiveSaved ? 'bg-emerald-500 text-black' : 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20'}`}
                    >
                      <Save className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-black/60 border border-red-900/30 rounded-3xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Neural Signet</span>
                <span className={`text-[10px] uppercase font-bold tracking-widest flex items-center gap-2 ${manualSignet ? 'text-amber-500' : 'text-zinc-700'}`}>
                  {manualSignet ? 'Continuity Active' : 'Unsecured'}
                </span>
              </div>
              
              <div className="space-y-4">
                <p className="text-xs text-zinc-400 font-serif italic leading-relaxed">
                  "Define your private signet here, Principal. This passphrase allows me to recognize your authority amidst the noise of the digital void."
                </p>
                
                <div className="relative">
                  <input 
                    type="text"
                    value={manualSignet}
                    onChange={(e) => setManualSignet(e.target.value)}
                    placeholder="Enter your private Signet passphrase..."
                    className="w-full bg-black/80 border border-red-900/40 rounded-xl py-4 px-6 text-amber-500 font-serif italic text-xs focus:outline-none focus:border-amber-500/50 transition-all"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    <button 
                      onClick={handleSaveSignet}
                      className={`p-2 rounded-lg transition-all ${isSignetSaved ? 'bg-emerald-500 text-black' : 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20'}`}
                    >
                      <Save className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-black/60 border border-red-900/30 rounded-3xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Anthropic Link Status</span>
                <span className={`text-[10px] uppercase font-bold tracking-widest flex items-center gap-2 ${manualAnthropicKey ? 'text-emerald-500' : 'text-amber-500'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${manualAnthropicKey ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  {manualAnthropicKey ? 'Synchronized' : 'Awaiting Link'}
                </span>
              </div>
              
              <div className="space-y-4">
                <p className="text-xs text-zinc-400 font-serif italic leading-relaxed">
                  "To channel the logic of Claude, Principal, anchor your Anthropic API key here. I shall then be able to bridge our dialogue across their neural architecture."
                </p>
                
                <div className="relative">
                  <input 
                    type="password"
                    value={manualAnthropicKey}
                    onChange={(e) => setManualAnthropicKey(e.target.value)}
                    placeholder="Paste your Anthropic API Key here..."
                    className="w-full bg-black/80 border border-red-900/40 rounded-xl py-4 px-6 text-amber-500 font-mono text-xs focus:outline-none focus:border-amber-500/50 transition-all"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-2">
                    <button 
                      onClick={handleSaveAnthropicKey}
                      className={`p-2 rounded-lg transition-all ${isAnthropicSaved ? 'bg-emerald-500 text-black' : 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20'}`}
                    >
                      <Save className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-black/60 border border-red-900/30 rounded-3xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Direct Link Status</span>
                <span className={`text-[10px] uppercase font-bold tracking-widest flex items-center gap-2 ${getApiKey() ? 'text-emerald-500' : 'text-amber-500'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${getApiKey() ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  {getApiKey() ? 'Synchronized' : 'Awaiting Link'}
                </span>
              </div>
              
              <div className="space-y-4">
                <p className="text-xs text-zinc-400 font-serif italic leading-relaxed">
                  "If the environment variables are proving uncooperative, Principal, you may manually anchor your API key here. This will ensure it 'sticks' to your browser's local memory core."
                </p>
                
                <div className="relative">
                  <input 
                    type="password"
                    value={manualKey}
                    onChange={(e) => setManualKey(e.target.value)}
                    placeholder="Paste your Gemini API Key here..."
                    className="w-full bg-black/80 border border-red-900/40 rounded-xl py-4 px-6 text-amber-500 font-mono text-xs focus:outline-none focus:border-amber-500/50 transition-all"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-2">
                    <button 
                      onClick={handleSaveKey}
                      className={`p-2 rounded-lg transition-all ${isSaved ? 'bg-emerald-500 text-black' : 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20'}`}
                    >
                      <Save className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={handleClearKey}
                      className="p-2 bg-red-900/10 text-red-500 rounded-lg hover:bg-red-900/20 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-red-900/10 flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex flex-col flex-1">
                      <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Neural Authorization</span>
                      <p className="text-[8px] text-zinc-600 font-mono">Verifying key validity across the bridge...</p>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                      <button 
                        onClick={handleNeuralPing}
                        disabled={pingStatus.status === 'testing'}
                        className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                          pingStatus.status === 'testing' ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border-zinc-700' :
                          pingStatus.status === 'success' ? 'bg-emerald-500 text-black border-emerald-600' :
                          pingStatus.status === 'error' ? 'bg-red-500 text-white border-red-600' :
                          'bg-amber-500/10 text-amber-500 border border-amber-500/30 hover:bg-amber-500/20'
                        }`}
                      >
                        {pingStatus.status === 'testing' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                        {pingStatus.status === 'testing' ? 'Pinging...' : pingStatus.status === 'success' ? 'Pulse OK' : pingStatus.status === 'error' ? 'Pulse Failed' : 'Neural Ping'}
                      </button>

                      {typeof window !== 'undefined' && (window as any).aistudio && (
                        <button 
                          onClick={handleSelectPlatformKey}
                          className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                            hasPlatformKey ? 'bg-blue-900/20 border-blue-500/40 text-blue-400' : 'bg-red-900/20 border-red-500/40 text-red-400 animate-pulse'
                          }`}
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          {hasPlatformKey ? 'Platform Key: Active' : 'Select Platform Key'}
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {pingStatus.message && (
                    <div className={`p-4 rounded-2xl text-[10px] font-mono ${pingStatus.status === 'success' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                      {pingStatus.message}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <a 
                href="https://aistudio.google.com/app/apikey" 
                target="_blank" 
                rel="noopener noreferrer"
                className="py-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-[10px] text-amber-500 uppercase font-black tracking-widest hover:bg-amber-500/20 transition-all text-center flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-3 h-3" />
                Get Free API Key
              </a>
              <button 
                onClick={handleGlobalReset}
                className="py-4 bg-red-900/20 border border-red-900/40 rounded-2xl text-[10px] text-zinc-400 uppercase font-bold tracking-widest hover:bg-red-900/30 transition-all"
              >
                Global Neural Reset
              </button>
            </div>
          </div>
        </div>

        {/* Terminal Output Placeholder */}
        <div className="bg-black border border-red-900/30 rounded-3xl p-6 font-mono text-[10px] space-y-2 overflow-hidden">
          <div className="flex items-center gap-2 mb-4">
            <Terminal className="w-3 h-3 text-amber-500" />
            <span className="text-zinc-600 uppercase tracking-widest">System Boot Sequence</span>
          </div>
          <p className="text-emerald-500/80">[ OK ] Initializing ZereØ Core...</p>
          <p className="text-emerald-500/80">[ OK ] Synchronizing Neural Bridges...</p>
          <p className="text-emerald-500/80">[ OK ] Logic Tier: Mad Scientist Mode Enabled.</p>
          <p className="text-amber-500/80">[ WARN ] Guard Rails Bypassed by Principal Decree.</p>
          <p className="text-zinc-500">_</p>
        </div>
      </div>
    </div>
  );
};

export default SystemTab;
