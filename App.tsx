
// [TAG: 11]
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
import { AssistantDaemon } from './components/AssistantDaemon';
import FilesTab from './components/FilesTab';
import Home from './components/Home';
import AvatarModal from './components/AvatarModal';
import Heartbeat from './components/Heartbeat';
import TacticalTouchOverlay from './components/TacticalTouchOverlay';
import VoiceEmulator from './components/VoiceEmulator';
import RadialTacticalFAB from './components/RadialTacticalFAB';
import AcousticLatticeStudio from './components/AcousticLatticeStudio';
import LegalCounselPortal from './components/LegalCounselPortal';
import { AppTab, GeminiModel } from './types';
import { getAI, refreshConfig, getApiKey, isServerPrincipalActive, safeGenerateContent } from './services/geminiService';
import { headerPulse } from './services/headerPulseService';
import { resolveNavTab } from './services/navigationConfig';
import {
  STEWARD_SYSTEM_INSTRUCTION,
  getPrincipalActive,
  setPrincipalActivePreference
} from './services/stewardIdentity';

export interface PrincipalReasoningAuditLog {
  id: string;
  requestId: string;
  timestamp: number;
  isoTime: string;
  prompt: string;
  context?: string;
  rawResponse: string;
  source?: string;
  model: string;
  durationMs: number;
  status: 'OPTIMAL' | 'ERROR' | 'INTERRUPTED';
  auditHash: string;
  principalVerified: boolean;
  classification: string;
}

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
    __ZEREO_PRINCIPAL_AUDIT_BUFFER__?: PrincipalReasoningAuditLog[];
    __GET_ZEREO_AUDIT_LOGS__?: () => PrincipalReasoningAuditLog[];
    __CLEAR_ZEREO_AUDIT_BUFFER__?: (syncServer?: boolean) => Promise<void>;
  }
}

const App: React.FC = () => {
  console.log("CLIENT: App component rendering...");
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.CHAT);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [isPrincipalMode, setIsPrincipalMode] = useState<boolean>(() => {
    return setPrincipalActivePreference(true);
  });
  const [isNeuralSyncActive, setIsNeuralSyncActive] = useState(true);
  const [bootProgress, setBootProgress] = useState(100);
  const [showForceEntry, setShowForceEntry] = useState(false);
  const [activeSocket, setActiveSocket] = useState<Socket | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // Hidden Principal-Only In-Memory Reasoning Audit Buffer
  const principalAuditBufferRef = useRef<PrincipalReasoningAuditLog[]>([]);

  // Hydrate in-memory view from single durable server audit buffer
  useEffect(() => {
    fetch('/api/audit/principal-buffer')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.buffer)) {
          principalAuditBufferRef.current = data.buffer.slice(0, 500);
          if (typeof window !== 'undefined') {
            window.__ZEREO_PRINCIPAL_AUDIT_BUFFER__ = principalAuditBufferRef.current;
          }
        }
      })
      .catch(() => {});

    // Expose read/view API to window (in-memory view only, never a competing store)
    if (typeof window !== 'undefined') {
      window.__ZEREO_PRINCIPAL_AUDIT_BUFFER__ = principalAuditBufferRef.current;
      window.__GET_ZEREO_AUDIT_LOGS__ = () => [...principalAuditBufferRef.current];
      window.__CLEAR_ZEREO_AUDIT_BUFFER__ = async (syncServer: boolean = true) => {
        principalAuditBufferRef.current = [];
        if (typeof window !== 'undefined') {
          window.__ZEREO_PRINCIPAL_AUDIT_BUFFER__ = [];
        }
        if (syncServer) {
          try {
            await fetch('/api/audit/principal-buffer', { method: 'DELETE' });
          } catch {
            // Offline view already cleared
          }
        }
      };
    }
  }, []);

  const routeToPrincipalMemoryBuffer = (auditRecord: PrincipalReasoningAuditLog) => {
    // 1. In-memory view update
    principalAuditBufferRef.current.unshift(auditRecord);
    if (principalAuditBufferRef.current.length > 500) {
      principalAuditBufferRef.current.pop();
    }
    if (typeof window !== 'undefined') {
      window.__ZEREO_PRINCIPAL_AUDIT_BUFFER__ = principalAuditBufferRef.current;
    }

    // 2. Single durable write to server audit buffer
    fetch('/api/audit/principal-buffer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(auditRecord)
    }).catch((err) => {
      console.warn('Failed to persist reasoning audit to server buffer:', err);
    });

    // 3. Notify UI observers
    window.dispatchEvent(
      new CustomEvent('principal:reasoning_audit', { detail: auditRecord })
    );
  };

    useEffect(() => {
    console.log("CLIENT: App mounted. Starting system boot sequence...");

    const forceTimer = setTimeout(() => {
      setShowForceEntry(true);
    }, 5000);

    const bootSequence = async () => {
      console.log("App: Executing boot sequence...");
      setBootProgress(10);
      try {
        const bootData = await Promise.race([
          Promise.all([
            fetch('/api/context').then(r => r.ok ? r.json() : null).catch(() => null),
            refreshConfig().catch(() => null)
          ]),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Boot timeout')), 8000))
        ]).catch(err => {
          console.warn("App: Boot data fetch timed out or failed:", err);
          return [null, null];
        });

        const context = bootData[0];
        setBootProgress(60);

        if (context && context.data) {
          if (context.data.activeTab) setActiveTab(context.data.activeTab);
          if (context.data.avatarUrl) setAvatarUrl(context.data.avatarUrl);
        }

        const isServerActive = isServerPrincipalActive();
        const localSaved = getPrincipalActive();

        if (localSaved || isServerActive) {
          setIsPrincipalMode(true);
          if (!localSaved) {
            setPrincipalActivePreference(true);
          }
        } else if (context && context.data && context.data.isPrincipalMode) {
          setIsPrincipalMode(context.data.isPrincipalMode);
          if (context.data.isPrincipalMode) {
            setPrincipalActivePreference(true);
          }
        }
      } catch (e) {
        // Fail gracefully
      }
    };

    bootSequence();

    return () => {
      clearTimeout(forceTimer);
    };
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
    const rawTab = typeof e?.detail === 'string' ? e.detail.trim() : '';
    if (!rawTab) return;
    console.log("App: Navigation requested via event:", rawTab);

    const resolved = resolveNavTab(rawTab);
    if (resolved) {
      setActiveTab(resolved);
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
      setActiveSocket(socket);

      socket.on('neural:request', async (data: { id: string, prompt: string, context: string }) => {
        console.log('Neural Request Received:', data);
        const startTime = performance.now();
        const reqId = data.id || `req-${Date.now()}`;
        const releasePulse = headerPulse.beginReasoning(
          'high_reasoning',
          'High Reasoning',
          (data as any).source === 'presence' ? 'Proactive Intelligence Audit' : 'Neural Bridge Execution'
        );
        try {
          const response = await safeGenerateContent({
            model: GeminiModel.HYDROGEN,
            contents: [{ role: 'user', parts: [{ text: data.prompt }] }],
            config: {
              systemInstruction: STEWARD_SYSTEM_INSTRUCTION,
            }
          });

          const durationMs = Math.round(performance.now() - startTime);
          const rawReasoningText = response.text || 'My apologies, Principal. My reasoning was interrupted.';

          // Route full raw reasoning trace to hidden principal-only memory buffer
          const auditEntry: PrincipalReasoningAuditLog = {
            id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            requestId: reqId,
            timestamp: Date.now(),
            isoTime: new Date().toISOString(),
            prompt: data.prompt,
            context: data.context,
            rawResponse: rawReasoningText,
            source: (data as any).source || 'bridge',
            model: GeminiModel.HYDROGEN,
            durationMs,
            status: 'OPTIMAL',
            auditHash: `AUDIT-8212-${Math.random().toString(16).substring(2, 10).toUpperCase()}`,
            principalVerified: true,
            classification: 'DETERMINISTIC_LOGIC_TRACE'
          };
          routeToPrincipalMemoryBuffer(auditEntry);

          if (socket) {
            socket.emit('neural:response', {
              id: data.id,
              text: rawReasoningText
            });

            // If it's a presence-driven proactive thought, notify the UI & trigger critical header pulse
            if ((data as any).source === 'presence') {
              window.dispatchEvent(new CustomEvent('neural:proactive_thought', { 
                detail: { text: rawReasoningText, timestamp: Date.now(), auditId: auditEntry.id } 
              }));
              headerPulse.triggerCritical(
                'Critical Briefing',
                rawReasoningText.slice(0, 56),
                AppTab.CHAT,
                14000
              );
            }
          }
        } catch (err: any) {
          console.error('Neural Bridge Error:', err);
          const durationMs = Math.round(performance.now() - startTime);
          const fallbackText = 'A thermodynamic anomaly has interrupted my neural bridge, Principal.';
          headerPulse.triggerCritical('Bridge Anomaly', 'Neural request interrupted', AppTab.SYSTEM, 12000);

          // Route failure trace into principal memory buffer for complete auditability
          const errorAuditEntry: PrincipalReasoningAuditLog = {
            id: `audit-err-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            requestId: reqId,
            timestamp: Date.now(),
            isoTime: new Date().toISOString(),
            prompt: data.prompt,
            context: data.context,
            rawResponse: err?.message ? `ERROR TRACE: ${err.message}` : fallbackText,
            source: (data as any).source || 'bridge',
            model: GeminiModel.HYDROGEN,
            durationMs,
            status: 'ERROR',
            auditHash: `AUDIT-ERR-${Math.random().toString(16).substring(2, 10).toUpperCase()}`,
            principalVerified: true,
            classification: 'SYSTEM_ENTROPY_FAULT'
          };
          routeToPrincipalMemoryBuffer(errorAuditEntry);

          if (socket) {
            socket.emit('neural:response', {
              id: data.id,
              text: fallbackText
            });
          }
        } finally {
          releasePulse();
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

      socket.on('voice:daemon_state', (data: any) => {
        window.dispatchEvent(new CustomEvent('zereo:voice_daemon_state', { detail: data }));
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

    const handleAuditIngest = (e: any) => {
      if (e.detail) {
        routeToPrincipalMemoryBuffer(e.detail);
      }
    };

    window.addEventListener('discord:connect', handleDiscordConnect);
    window.addEventListener('broker:trigger_ping', handleBrokerPing);
    window.addEventListener('broker:trigger_doorman_ping', handleBrokerDoormanPing);
    window.addEventListener('nav:change', handleNavChange);
    window.addEventListener('principal:audit_ingest', handleAuditIngest);

    return () => {
      if (socket) socket.disconnect();
      window.removeEventListener('discord:connect', handleDiscordConnect);
      window.removeEventListener('broker:trigger_ping', handleBrokerPing);
      window.removeEventListener('broker:trigger_doorman_ping', handleBrokerDoormanPing);
      window.removeEventListener('nav:change', handleNavChange);
      window.removeEventListener('principal:audit_ingest', handleAuditIngest);
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
      case AppTab.FILES:
        return <FilesTab key="files" onNavigate={commonProps.onNavigate} isPrincipalMode={isPrincipalMode} />;
      case AppTab.CREATIVE:
        return <CreativeStudio key="creative" isPrincipalMode={isPrincipalMode} />;
      case AppTab.VOICE:
        return <VoicePortal key="voice" socket={activeSocket || socketRef.current} avatarUrl={avatarUrl} onAvatarClick={() => setIsAvatarModalOpen(true)} />;
      case AppTab.VOICE_EMULATOR:
        return <VoiceEmulator key="voice_emulator" />;
      case AppTab.ANALYTICS:
        return <LogicAnalytics key="analytics" socket={activeSocket || socketRef.current} />;
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
      case AppTab.ACOUSTIC_ROOM:
        return <AcousticLatticeStudio key="acoustic_room" onNavigateBack={() => commonProps.onNavigate(AppTab.CHAT)} />;
      case AppTab.ASSISTANT:
        return <AssistantDaemon key="assistant" socket={activeSocket || socketRef.current} isPrincipalMode={isPrincipalMode} />;
      case AppTab.LEGAL:
        return <LegalCounselPortal key="legal" socket={activeSocket || socketRef.current} onNavigate={commonProps.onNavigate} />;
      case AppTab.CHAT:
      case AppTab.GROUNDING:
      default:
        return (
          <ChatBot
            key="chat"
            socket={activeSocket || socketRef.current}
            initialGrounding={activeTab === AppTab.GROUNDING ? 'search' : 'none'}
            avatarUrl={avatarUrl}
            onAvatarClick={() => setIsAvatarModalOpen(true)}
            isPrincipalMode={isPrincipalMode}
            setIsPrincipalMode={setIsPrincipalMode}
            {...commonProps}
          />
        );
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

      <TacticalTouchOverlay socket={activeSocket || socketRef.current} />

      <Layout 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        avatarUrl={avatarUrl} 
        onAvatarClick={() => setIsAvatarModalOpen(true)}
        isPrincipalMode={isPrincipalMode}
        socket={activeSocket || socketRef.current}
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

      <RadialTacticalFAB 
        isPrincipalMode={isPrincipalMode}
        setIsPrincipalMode={setIsPrincipalMode}
        socket={activeSocket || socketRef.current}
      />
    </div>
  );
};

export default App;
