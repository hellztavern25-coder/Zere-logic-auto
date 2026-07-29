
import React, { useState } from 'react';
import { 
  MessageSquare, 
  Image as ImageIcon, 
  Mic, 
  LineChart, 
  Search, 
  Zap, 
  Menu,
  X,
  Terminal,
  Database,
  Share2,
  Home as HomeIcon,
  Share as ShareIcon,
  Settings,
  Wrench,
  Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppTab } from '../types';
import ButlerAvatar from './ButlerAvatar';
import NeuralBroker from './NeuralBroker';
import { getApiKey } from '../services/geminiService';

interface LayoutProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  children: React.ReactNode;
  avatarUrl?: string;
  onAvatarClick?: () => void;
  isPrincipalMode?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ activeTab, setActiveTab, children, avatarUrl, onAvatarClick, isPrincipalMode }) => {
  console.log("CLIENT: Layout rendering, activeTab:", activeTab);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  React.useEffect(() => {
    const handleToggleMenu = () => setIsMobileMenuOpen(prev => !prev);
    window.addEventListener('layout:toggle-menu', handleToggleMenu);
    return () => window.removeEventListener('layout:toggle-menu', handleToggleMenu);
  }, []);

  const navItems = isPrincipalMode ? [
    { id: AppTab.CHAT, icon: MessageSquare, label: 'Dialogue Core' },
  ] : [
    { id: AppTab.HOME, icon: HomeIcon, label: 'Home' },
    { id: AppTab.CHAT, icon: MessageSquare, label: 'Chat' },
    { id: AppTab.CREATIVE, icon: ImageIcon, label: 'Creative Studio' },
    { id: AppTab.VOICE, icon: Mic, label: 'Voice Portal' },
    { id: AppTab.ANALYTICS, icon: LineChart, label: 'Logic Analytics' },
    { id: AppTab.GROUNDING, icon: Search, label: 'Grounding' },
    { id: AppTab.MEMORY, icon: Database, label: 'Memory Core' },
    { id: AppTab.NEXUS, icon: Share2, label: 'Neural Nexus' },
    { id: AppTab.SHARE, icon: ShareIcon, label: 'Share ZereØ' },
    { id: AppTab.SYSTEM, icon: Settings, label: 'System Control' },
    { id: AppTab.WORKSHOP, icon: Wrench, label: 'Neural Forge' },
    { id: AppTab.SNAPSHOT, icon: Eye, label: 'Optical Intel' },
  ];

  const handleNavClick = (tab: AppTab) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  const SidebarContent = () => (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-3">
           <div className="bg-red-800 p-2 rounded shadow-lg">
              <Terminal className="text-amber-400 w-6 h-6" />
           </div>
           <span className="font-bold text-amber-500 uppercase tracking-widest text-sm">Main Protocol</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(false)}
          className="p-2 hover:bg-red-900/20 rounded-lg text-zinc-500 transition-colors md:hidden"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <nav className="flex-1 space-y-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleNavClick(item.id)}
            className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-200 group ${
              activeTab === item.id 
              ? 'bg-red-900/30 text-amber-400 border border-red-800 shadow-lg shadow-red-900/20' 
              : 'text-zinc-500 hover:text-amber-200 hover:bg-red-900/10 border border-transparent'
            }`}
          >
            <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-amber-400' : 'group-hover:text-amber-400'}`} />
            <span className="font-bold text-xs uppercase tracking-widest">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="mt-auto pt-6 border-t border-red-900/30">
        <div className="bg-black/50 rounded-2xl p-4 border border-red-900/30 flex items-center gap-3">
           <ButlerAvatar size="sm" src={avatarUrl} onClick={onAvatarClick} />
           <div>
             <p className="text-xs font-bold text-amber-500 uppercase">Protocol Engine</p>
             <p className="text-[10px] text-zinc-500 font-mono">Status: Optimal Efficiency</p>
           </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-[100dvh] w-full bg-[#0a0a0b] text-zinc-300 font-sans overflow-hidden">
      {/* Desktop Sidebar */}
      {!isPrincipalMode && (
        <aside className="hidden md:flex flex-col w-72 bg-[#0d0d0e] border-r border-red-900/30 p-6 shadow-2xl z-50">
          <SidebarContent />
        </aside>
      )}

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Navigation Bar (Mobile Only) */}
        {!isPrincipalMode && activeTab !== AppTab.CHAT && activeTab !== AppTab.GROUNDING && (
          <header className="h-16 border-b border-red-900/30 bg-[#0d0d0e] flex items-center justify-between px-4 z-50 md:hidden">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="p-2 hover:bg-red-900/20 rounded-lg text-amber-500 transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
              <h1 className="text-xs font-bold bg-gradient-to-r from-amber-200 to-amber-500 bg-clip-text text-transparent uppercase tracking-[0.1em]">
                ZereØ
              </h1>
            </div>

            <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-full border border-red-900/30">
              <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${getApiKey() && getApiKey() !== 'undefined' ? 'bg-emerald-500' : 'bg-amber-500/50'}`} />
              <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">{getApiKey() && getApiKey() !== 'undefined' ? 'Linked' : 'Standard Mode'}</span>
              <ButlerAvatar size="sm" src={avatarUrl} onClick={onAvatarClick} />
            </div>
          </header>
        )}

        {/* Slide-over Menu Overlay (Mobile Only) */}
        <AnimatePresence>
          {isMobileMenuOpen && !isPrincipalMode && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] md:hidden"
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <motion.aside 
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed top-0 left-0 h-full w-72 bg-[#0d0d0e] border-r border-red-900/50 p-6 z-[70] flex flex-col shadow-2xl md:hidden"
              >
                <SidebarContent />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col h-full overflow-hidden relative">
          <div className={`flex-1 flex flex-col h-full w-full ${isPrincipalMode ? 'max-w-7xl' : 'md:max-w-5xl md:border-x border-red-900/10'} mx-auto relative bg-black/20 shadow-2xl`}>
            {/* Luxury Background Accents */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-900/10 blur-[150px] rounded-full pointer-events-none -z-10" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-amber-900/5 blur-[150px] rounded-full pointer-events-none -z-10" />
            {children}
          </div>
          <NeuralBroker />
        </main>
      </div>
    </div>
  );
};

export default Layout;
