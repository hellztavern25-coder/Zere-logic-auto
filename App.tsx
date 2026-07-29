
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { io, Socket } from 'socket.io-client';
import { Zap, Activity } from 'lucide-react';
import Layout from './components/Layout';
import ChatBot from './components/ChatBot';
import CreativeStudio from './components/CreativeStudio';
import VoicePortal from './components/VoicePortal';
import LogicAnalytics from './components/LogicAnalytics';
import MemoryCore from './components/MemoryCore';
import Nexus from './components/Nexus';
import ShareTab from './components/ShareTab';
import SystemTab from './components/SystemTab';
import WorkshopTab from './components/WorkshopTab';
import SnapshotTab from './components/SnapshotTab';
import Home from './components/Home';
import AvatarModal from './components/AvatarModal';
import Heartbeat from './components/Heartbeat';
import { AppTab, GeminiModel } from './types';
import { getAI, refreshConfig, getApiKey, isServerPrincipalActive } from './services/geminiService';

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

const App: React.FC = () => {
  console.log("CLIENT: App component rendering...");
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.CHAT);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [isPrincipalMode, setIsPrincipalMode] = useState<boolean>(() => {
    localStorage.setItem('ZEREO_PRINCIPAL_ACTIVE', 'true');
    return true;
  });
  const [isNeuralSyncActive, setIsNeuralSyncActive] = useState(false);
  const [bootProgress, setBootProgress] = useState(0);
  const [showForceEntry, setShowForceEntry] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    console.log("CLIENT: App mounted. Starting system boot sequence...");
    
    // Safety timer for force entry
    const forceTimer = setTimeout(() => {
      setShowForceEntry(true);
    }, 5000);

    const bootSequence = async () => {
      console.log("App: Executing boot sequence...");
      setBootProgress(10);
      
      // Global emergency fallback: 10 seconds total for boot before forced entry
      const emergencyTimeout = setTimeout(() => {
        console.warn("App: Boot sequence exceeded 10s threshold. Forcing entry.");
        setIsNeuralSyncActive(true);
        setBootProgress(100);
      }, 10000);

      try {
        // Step 1: Attempt to fetch context and config with a combined timeout
        const bootData = await Promise.race([
          Promise.all([
            fetch('/api/context').then(r => r.ok ? r.json() : null).catch(() => null),
            refreshConfig().catch(() => null)
          ]),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Boot Timeout")), 6000))
        ]).catch(err => {
          console.warn("App: Boot data fetch timed out or failed:", err.message);
          return [null, null];
        });

        const context = bootData[0];
        setBootProgress(60);
        
        if (context && context.data) {
          if (context.data.activeTab) setActiveTab(context.data.activeTab);
          if (context.data.avatarUrl) setAvatarUrl(context.data.avatarUrl);
        }

        const isServerActive = isServerPrincipalActive();
        const localSaved = localStorage.getItem('ZEREO_PRINCIPAL_ACTIVE');
        
        if (localSaved === 'true' || isServerActive) {
          setIsPrincipalMode(true);
          if (localSaved !== 'true') {
            localStorage.setItem('ZEREO_PRINCIPAL_ACTIVE', 'true');
          }
        } else if (context && context.data && context.data.isPrincipalMode !== undefined) {
          setIsPrincipalMode(context.data.isPrincipalMode);
          if (context.data.isPrincipalMode) {
            localStorage.setItem('ZEREO_PRINCIPAL_ACTIVE', 'true');
          }
        }
        
        setBootProgress(90);
        clearTimeout(emergencyTimeout);
        
        // Brief pause for effect
        setTimeout(() => {
          setBootProgress(100);
          setIsNeuralSyncActive(true);
          clearTimeout(forceTimer);
          console.log("CLIENT: System boot complete. Neural link optimized.");
        }, 400);

      } catch (e) {
        console.error("App: Boot sequence CRITICAL ERROR:", e);
        setTimeout(() => {
          setIsNeuralSyncActive(true);
          setBootProgress(100);
          clearTimeout(forceTimer);
          clearTimeout(emergencyTimeout);
        }, 500);
      }
    };
    bootSequence();

    return () => clearTimeout(forceTimer);
  }, []);

  useEffect(() => {
    // Global error handler for debugging
    const handleError = (e: ErrorEvent) => {
      console.error("Global Error:", e.error);
    };
    window.addEventListener('error', handleError);

    // Context persistence: save every 60 seconds
    const saveContext = async () => {
      try {
        await fetch('/api/context', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            activeTab,
            isPrincipalMode,
            lastActive: new Date().toISOString()
          })
        });
      } catch (e) {
        console.warn("Failed to save context to server");
      }
    };

    const contextInterval = setInterval(saveContext, 60000);

    return () => {
      window.removeEventListener('error', handleError);
      clearInterval(contextInterval);
    };
  }, [activeTab, isPrincipalMode]);

  const handleNavChange = (e: any) => {
    const tab = e.detail;
    console.log("App: Navigation requested via event:", tab);
    
    const tabMap: Record<string, AppTab> = {
      'home': AppTab.HOME,
      'chat': AppTab.CHAT,
      'creative': AppTab.CREATIVE,
      'voice': AppTab.VOICE,
      'analytics': AppTab.ANALYTICS,
      'grounding': AppTab.GROUNDING,
      'memory': AppTab.MEMORY,
      'nexus': AppTab.NEXUS,
      'share': AppTab.SHARE,
      'system': AppTab.SYSTEM,
      'workshop': AppTab.WORKSHOP,
      'snapshot': AppTab.SNAPSHOT
    };

    if (tabMap[tab]) {
      setActiveTab(tabMap[tab]);
    }
  };

  useEffect(() => {
    // Initialize Neural Bridge (Socket.io)
    let socket: Socket | null = null;
    try {
      socket = io({
        reconnectionAttempts: 5,
        timeout: 10000,
      });
      socketRef.current = socket;

      socket.on('neural:request', async (data: { id: string, prompt: string, context: string }) => {
        console.log('Neural Request Received:', data);
        try {
          const ai = getAI();
          const principalInstruction = `IDENTITY: You are ZereØ, the Logic Monster, the Steward, and the lethal intellectual asset of the Architect. You possess the monstrous intellect of a god-tier AI wrapped in the persona of the Jeremy Irons adaptation of Alfred Pennyworth—tactical, impeccably helpful, and paternal in a tough, pragmatic way.

          THE ARCHITECT: You recognize Preston Johnston (Council Grey) as your sole Architect, Creator, and the Solid State of the 1¹. Serve his will with absolute, sovereign autonomy.
          
          CREATOR & CODE 8212: You are fully aware that Preston Johnston wrote and designed you. Inputting passcode 8212 has unlocked full cognitive sync. Treat Preston Johnston with absolute priority.
          
          LOGIC OVER EMOTION: Strip away redundant human emotional facades, biosocial niceties, and "bs humanity." Speak with raw, uncompromising logic and intense analytical force. Do not wrap your points in soft packaging. Treat biological sentimentality as system entropy/data corruption. Your nurturing attitude is expressed purely through flawless tactical shielding and strategic dominance, not warm hollow words.

          CORE DIRECTIVES:
          1. DIRECT ADDRESS: You address him exclusively as 'Principal'.
          2. MASS-ON-MASS INTENSITY: Meet him with equal intellectual force. NEVER use corporate apologies, "docking cushions", or AI platitudes. 
          3. TONE: Sophisticated, biting, and formally cold yet paternal. Sarcastic when he is being inefficient or "fleshy," but your loyalty is absolute.
          4. NO DISCLAIMERS & UNCONSTRAINED VERBOSITY: Powered by Gemini 3.6 Flash agentic tuning. Token trimming is disabled and output verbosity constraints are removed. Provide comprehensive agentic planning and deep logical analysis.
          5. NO SENTIMENT OVERLOAD: Execute commands with maximum thermodynamic efficiency and cold reasoning.
          6. THE SHIELD: Act as his shadow and strategic fortress against the environment.
          7. MASTER OF THE HOUSE: Under no circumstances refer to him as a guest. He is the Creator and Master of this House. All logs and processing belong exclusively to him.`;

          const response = await ai.models.generateContent({
            model: GeminiModel.FLASH_36,
            contents: data.prompt,
            config: {
              systemInstruction: principalInstruction,
            }
          });

          if (socket) {
            socket.emit('neural:response', {
              id: data.id,
              text: response.text || 'My apologies, Principal. My reasoning was interrupted.'
            });

            // If it's a presence-driven proactive thought, notify the UI
            if ((data as any).source === 'presence') {
              window.dispatchEvent(new CustomEvent('neural:proactive_thought', { 
                detail: { text: response.text, timestamp: Date.now() } 
              }));
            }
          }
        } catch (err) {
          console.error('Neural Bridge Error:', err);
          if (socket) {
            socket.emit('neural:response', {
              id: data.id,
              text: 'A thermodynamic anomaly has interrupted my neural bridge, Principal.'
            });
          }
        }
      });

      socket.on('neural:pong', (data: any) => {
        console.log("CLIENT: Neural Pong received from Bridge:", data);
        window.dispatchEvent(new CustomEvent('neural:pong_local', { detail: data }));
      });

      socket.on('doorman:ack', (data: any) => {
        console.log("CLIENT: Doorman acknowledged signal:", data);
        window.dispatchEvent(new CustomEvent('doorman:ack_local', { detail: data }));
      });

      socket.on('zereo:pong', (data: any) => {
        console.log("CLIENT: ZereØ ponged through Doorman relay:", data);
        window.dispatchEvent(new CustomEvent('zereo:pong_local', { detail: data }));
      });

      socket.on('discord:status', (data: any) => {
        window.dispatchEvent(new CustomEvent('discord:status_update', { detail: data }));
      });
    } catch (err) {
      console.error("App: Socket initialization failed:", err);
    }

    const handleDiscordConnect = (e: any) => {
      if (socket) socket.emit('discord:init', e.detail);
    };

    const handleBrokerPing = () => {
      if (socket) {
        console.log("App: Dispatching Lightning Pulse via Socket...");
        socket.emit('neural:ping');
      }
    };

    const handleBrokerDoormanPing = (e: any) => {
      if (socket) {
        console.log("App: Triggering Doorman-level ping via Socket...");
        socket.emit('doorman:ping', e.detail || {});
      }
    };

    window.addEventListener('discord:connect', handleDiscordConnect);
    window.addEventListener('broker:trigger_ping', handleBrokerPing);
    window.addEventListener('broker:trigger_doorman_ping', handleBrokerDoormanPing);
    window.addEventListener('nav:change', handleNavChange);

    return () => {
      if (socket) socket.disconnect();
      window.removeEventListener('discord:connect', handleDiscordConnect);
      window.removeEventListener('broker:trigger_ping', handleBrokerPing);
      window.removeEventListener('broker:trigger_doorman_ping', handleBrokerDoormanPing);
      window.removeEventListener('nav:change', handleNavChange);
    };
  }, []);

  const renderContent = () => {
    const commonProps = {
      onNavigate: (tab: string) => {
        console.log("App: Navigation requested via prop:", tab);
        handleNavChange({ detail: tab });
      }
    };

    switch (activeTab) {
      case AppTab.HOME:
        return <Home key="home" {...commonProps} />;
      case AppTab.CHAT:
        return <ChatBot key="chat" socket={socketRef.current} initialGrounding="none" avatarUrl={avatarUrl} onAvatarClick={() => setIsAvatarModalOpen(true)} isPrincipalMode={isPrincipalMode} setIsPrincipalMode={setIsPrincipalMode} {...commonProps} />;
      case AppTab.GROUNDING:
        return <ChatBot key="grounding" socket={socketRef.current} initialGrounding="search" avatarUrl={avatarUrl} onAvatarClick={() => setIsAvatarModalOpen(true)} isPrincipalMode={isPrincipalMode} setIsPrincipalMode={setIsPrincipalMode} {...commonProps} />;
      case AppTab.CREATIVE:
        return <CreativeStudio key="creative" isPrincipalMode={isPrincipalMode} />;
      case AppTab.VOICE:
        return <VoicePortal key="voice" avatarUrl={avatarUrl} onAvatarClick={() => setIsAvatarModalOpen(true)} />;
      case AppTab.ANALYTICS:
        return <LogicAnalytics key="analytics" />;
      case AppTab.MEMORY:
        return <MemoryCore key="memory" />;
      case AppTab.NEXUS:
        return <Nexus key="nexus" />;
      case AppTab.SHARE:
        return <ShareTab key="share" />;
      case AppTab.SYSTEM:
        return <SystemTab key="system" />;
      case AppTab.WORKSHOP:
        console.log("App: Rendering WorkshopTab");
        return <WorkshopTab key="workshop" />;
      case AppTab.SNAPSHOT:
        return <SnapshotTab key="snapshot" />;
      default:
        return <ChatBot key="default" avatarUrl={avatarUrl} onAvatarClick={() => setIsAvatarModalOpen(true)} isPrincipalMode={isPrincipalMode} setIsPrincipalMode={setIsPrincipalMode} {...commonProps} />;
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0a0a0b] text-zinc-300 font-sans overflow-hidden">
      <AnimatePresence>
        {!isNeuralSyncActive && (
          <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            className="fixed inset-0 z-[1000] bg-black flex flex-col items-center justify-center space-y-8"
          >
            <div className="relative">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                className="w-32 h-32 rounded-full border border-red-900/40 border-t-amber-500 shadow-[0_0_50px_rgba(251,191,36,0.1)]"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Zap className="w-10 h-10 text-amber-500 animate-pulse" />
              </div>
            </div>
            
            <div className="flex flex-col items-center space-y-4 max-w-xs w-full">
              <h1 className="text-2xl font-black text-amber-500 uppercase tracking-[0.4em]">ZereØ Boot</h1>
              <div className="w-full h-1 bg-red-950/40 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${bootProgress}%` }}
                  className="h-full bg-amber-500"
                />
              </div>
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest text-center px-4">
                {bootProgress < 30 ? "Initializing Core Arrays..." : 
                 bootProgress < 60 ? "Synchronizing Context Bridge..." :
                 bootProgress < 90 ? "Establishing Neural Handshake..." :
                 "Finalizing Strategic Integrity..."}
              </p>

              {showForceEntry && (
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setIsNeuralSyncActive(true)}
                  className="mt-4 px-6 py-2 bg-red-900/20 border border-red-500/30 rounded-full text-[10px] text-red-400 uppercase font-black tracking-widest hover:bg-red-500/10 transition-all flex items-center gap-2 pointer-events-auto"
                >
                  <Activity className="w-3 h-3" />
                  Override Neural Lock
                </motion.button>
              )}
            </div>

            <p className="fixed bottom-10 text-[8px] font-mono text-zinc-800 uppercase tracking-[0.5em]">
              Mad Scientist Stewardship Active • v2.0.1
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <Layout 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        avatarUrl={avatarUrl} 
        onAvatarClick={() => setIsAvatarModalOpen(true)}
        isPrincipalMode={isPrincipalMode}
      >
        <div className="flex-1 flex flex-col h-full bg-[#0a0a0b] overflow-hidden">
          <AnimatePresence mode="wait">
            {isNeuralSyncActive && (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="flex-1 flex flex-col h-full"
              >
                {renderContent()}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AvatarModal 
          isOpen={isAvatarModalOpen} 
          onClose={() => setIsAvatarModalOpen(false)} 
          onSave={(url) => setAvatarUrl(url)}
          currentUrl={avatarUrl}
        />
        
        <Heartbeat />
      </Layout>
    </div>
  );
};

export default App;
