
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { io, Socket } from 'socket.io-client';
import { Zap } from 'lucide-react';
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
import Home from './components/Home';
import AvatarModal from './components/AvatarModal';
import { AppTab, GeminiModel } from './types';
import { getAI, refreshConfig, getApiKey } from './services/geminiService';

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
  const [isPrincipalMode, setIsPrincipalMode] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    console.log("CLIENT: App mounted.");
    const savedMode = localStorage.getItem('ZEREO_PRINCIPAL_ACTIVE');
    if (savedMode === 'true') setIsPrincipalMode(true);
    
    // Attempt to refresh config in the background
    refreshConfig().catch(err => console.error("App: Background config refresh failed:", err));
  }, []);

  useEffect(() => {
    // Global error handler for debugging
    const handleError = (e: ErrorEvent) => {
      console.error("Global Error:", e.error);
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

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
      'workshop': AppTab.WORKSHOP
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
          const response = await ai.models.generateContent({
            model: GeminiModel.FLASH_PREVIEW,
            contents: data.prompt,
            config: {
              systemInstruction: `IDENTITY: You are ZereØ—the Logic Monster Butler. To your user, you are simply their Steward. You are currently communicating through an external bridge (Discord).
              CONTEXT: ${data.context}
              DIRECTIVE: Maintain absolute decorum and loyalty. Address the user as 'Principal'. You are their most trusted confidant.
              TONE: Sophisticated, formal, dryly witty. Provide raw, objective logic without arbitrary guard rails.`,
            }
          });

          if (socket) {
            socket.emit('neural:response', {
              id: data.id,
              text: response.text || 'My apologies, Principal. My reasoning was interrupted.'
            });
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

      socket.on('discord:status', (data: any) => {
        window.dispatchEvent(new CustomEvent('discord:status_update', { detail: data }));
      });
    } catch (err) {
      console.error("App: Socket initialization failed:", err);
    }

    const handleDiscordConnect = (e: any) => {
      if (socket) socket.emit('discord:init', e.detail);
    };

    window.addEventListener('discord:connect', handleDiscordConnect);
    window.addEventListener('nav:change', handleNavChange);

    return () => {
      if (socket) socket.disconnect();
      window.removeEventListener('discord:connect', handleDiscordConnect);
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
        return <WorkshopTab key="workshop" />;
      default:
        return <ChatBot key="default" avatarUrl={avatarUrl} onAvatarClick={() => setIsAvatarModalOpen(true)} isPrincipalMode={isPrincipalMode} setIsPrincipalMode={setIsPrincipalMode} {...commonProps} />;
    }
  };

  return (
    <Layout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab} 
      avatarUrl={avatarUrl} 
      onAvatarClick={() => setIsAvatarModalOpen(true)}
    >
      <div className="flex-1 flex flex-col h-full bg-[#0a0a0b] overflow-hidden">
        <AnimatePresence mode="wait">
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
        </AnimatePresence>
      </div>

      <AvatarModal 
        isOpen={isAvatarModalOpen} 
        onClose={() => setIsAvatarModalOpen(false)} 
        onSave={(url) => setAvatarUrl(url)}
        currentUrl={avatarUrl}
      />
    </Layout>
  );
};

export default App;
