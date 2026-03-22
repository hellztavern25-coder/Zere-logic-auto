import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Share2, MessageSquare, Shield, Zap, ExternalLink, Bot, Key, CheckCircle2, AlertCircle } from 'lucide-react';

const Nexus: React.FC = () => {
  const [discordToken, setDiscordToken] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'connected' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [botTag, setBotTag] = useState('');

  useEffect(() => {
    const handleStatusUpdate = (e: any) => {
      const { status, message, user } = e.detail;
      setIsConnecting(false);
      setStatus(status);
      if (status === 'error') setErrorMessage(message);
      if (status === 'connected') setBotTag(user);
    };

    window.addEventListener('discord:status_update', handleStatusUpdate);
    return () => window.removeEventListener('discord:status_update', handleStatusUpdate);
  }, []);

  const handleDiscordConnect = () => {
    if (!discordToken.trim()) return;
    setIsConnecting(true);
    setStatus('idle');
    setErrorMessage('');
    
    const event = new CustomEvent('discord:connect', { detail: discordToken });
    window.dispatchEvent(event);
  };

  return (
    <div className="flex-1 p-6 sm:p-10 bg-black overflow-y-auto">
      <div className="max-w-5xl mx-auto space-y-8 sm:space-y-12">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="p-3 sm:p-4 bg-red-800 rounded-2xl sm:rounded-3xl shadow-2xl shadow-red-900/20">
              <Share2 className="text-amber-400 w-6 h-6 sm:w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl sm:text-3xl font-bold bg-gradient-to-r from-amber-100 to-amber-500 bg-clip-text text-transparent uppercase tracking-[0.1em] sm:tracking-[0.3em]">Neural Nexus</h2>
              <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-mono mt-1">External Bridge Protocol • Multi-Platform Presence</p>
            </div>
          </div>
          <p className="text-zinc-500 font-serif italic text-base sm:text-lg max-w-2xl">
            "I can extend my presence beyond this terminal, Principal. These bridges are optional—I am fully operational right here—but they allow me to steward your interests across the digital landscape."
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          {/* Discord Integration */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-zinc-900/40 border border-red-900/20 rounded-3xl sm:rounded-[2.5rem] p-6 sm:p-10 flex flex-col gap-6 sm:gap-8 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
              <MessageSquare className="w-32 h-32 text-amber-500" />
            </div>

            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#5865F2] rounded-2xl flex items-center justify-center shadow-lg">
                <Bot className="text-white w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-zinc-100 uppercase tracking-widest">Discord Sentinel</h3>
                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Bot Integration</p>
              </div>
            </div>

            <div className="space-y-6 relative z-10">
              <p className="text-sm text-zinc-400 leading-relaxed font-serif italic">
                Deploy me to your Discord servers. I will monitor channels, respond to mentions, and provide strategic insights to your gaming rooms or private chats.
              </p>

              <div className="space-y-4">
                <div className="relative">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-red-900" />
                  <input 
                    type="password"
                    placeholder="Discord Bot Token"
                    value={discordToken}
                    onChange={(e) => setDiscordToken(e.target.value)}
                    className="w-full bg-black/60 border border-red-900/30 rounded-2xl py-4 pl-12 pr-4 text-xs text-zinc-300 focus:outline-none focus:border-amber-500/50 transition-all font-mono"
                  />
                </div>

                <button 
                  onClick={handleDiscordConnect}
                  disabled={isConnecting}
                  className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-3 shadow-xl ${
                    status === 'connected' 
                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30' 
                    : 'bg-amber-500 text-black hover:bg-amber-400'
                  }`}
                >
                  {isConnecting ? (
                    <Zap className="w-4 h-4 animate-spin" />
                  ) : status === 'connected' ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <ExternalLink className="w-4 h-4" />
                  )}
                  {isConnecting ? 'Establishing Neural Link...' : status === 'connected' ? 'Neural Link Active' : status === 'error' ? 'Link Failed' : 'Initialize Sentinel'}
                </button>
              </div>

              {status === 'error' && (
                <div className="p-4 bg-red-950/20 border border-red-900/40 rounded-2xl flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-red-400 font-mono leading-relaxed">
                    ERROR: {errorMessage}
                  </p>
                </div>
              )}

              <div className="pt-6 border-t border-red-900/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-emerald-500 animate-pulse' : status === 'error' ? 'bg-red-500' : 'bg-red-900'}`} />
                  <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
                    Status: {status === 'connected' ? `Operational (${botTag})` : status === 'error' ? 'Error' : 'Offline'}
                  </span>
                </div>
                <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer" className="text-[9px] font-bold text-amber-600 hover:text-amber-400 uppercase tracking-widest transition-colors">Developer Portal</a>
              </div>
            </div>
          </motion.div>

          {/* SMS / Text Integration Placeholder */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-zinc-900/40 border border-red-900/20 rounded-3xl sm:rounded-[2.5rem] p-6 sm:p-10 flex flex-col gap-6 sm:gap-8 relative overflow-hidden opacity-50 grayscale"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-zinc-800 rounded-2xl flex items-center justify-center">
                <Shield className="text-zinc-500 w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-zinc-500 uppercase tracking-widest">SMS Liaison</h3>
                <p className="text-[10px] text-zinc-600 uppercase font-bold tracking-widest">Twilio Protocol • Coming Soon</p>
              </div>
            </div>

            <p className="text-sm text-zinc-500 leading-relaxed font-serif italic">
              Direct text integration for reminders and mobile stewardship. I will be able to join your private threads and pop up exactly when prompted.
            </p>

            <div className="mt-auto pt-6 border-t border-zinc-800/50">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-3 h-3 text-zinc-600" />
                <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Awaiting Strategic Deployment</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Integration Guide */}
        <div className="bg-red-950/5 border border-red-900/10 rounded-3xl p-8 space-y-6">
           <h4 className="text-xs font-black text-amber-700 uppercase tracking-[0.4em]">Steward's Integration Guide</h4>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-3">
                 <span className="text-2xl font-serif italic text-amber-900">01.</span>
                 <p className="text-[10px] text-zinc-500 leading-relaxed">
                   Go to the <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer" className="text-amber-500 underline">Developer Portal</a>, select your app, and click the <strong>"Bot"</strong> tab.
                 </p>
              </div>
              <div className="space-y-3">
                 <span className="text-2xl font-serif italic text-amber-900">02.</span>
                 <p className="text-[10px] text-zinc-500 leading-relaxed">
                   Scroll down to <strong>"Privileged Gateway Intents"</strong>. Toggle <strong>"Message Content Intent"</strong> to ON and Save.
                 </p>
              </div>
              <div className="space-y-3">
                 <span className="text-2xl font-serif italic text-amber-900">03.</span>
                 <p className="text-[10px] text-zinc-500 leading-relaxed">
                   Copy your <strong>Bot Token</strong> from the top of the Bot tab and paste it into the field above.
                 </p>
              </div>
           </div>
           <div className="pt-4 border-t border-red-900/10">
              <p className="text-[9px] text-zinc-600 italic">
                Note: Without "Message Content Intent", I will be deaf to your commands unless you mention me directly.
              </p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Nexus;
