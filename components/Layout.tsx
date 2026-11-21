import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Image as ImageIcon, 
  Mic, 
  LineChart, 
  Search, 
  Menu,
  X,
  Terminal,
  Database,
  Share2,
  Home as HomeIcon,
  Share as ShareIcon,
  Settings,
  Wrench,
  Eye,
  Cpu,
  Headphones,
  FolderOpen,
  BrainCircuit,
  AlertTriangle,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Socket } from 'socket.io-client';
import { AppTab } from '../types';
import ButlerAvatar from './ButlerAvatar';
import NeuralBroker from './NeuralBroker';
import { headerPulse, HeaderPulseState } from '../services/headerPulseService';

interface LayoutProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  children: React.ReactNode;
  avatarUrl?: string;
  onAvatarClick?: () => void;
  isPrincipalMode?: boolean;
  socket?: Socket | null;
}

const TAB_TITLES: Record<AppTab, string> = {
  [AppTab.HOME]: 'Home',
  [AppTab.CHAT]: 'Dialogue Core',
  [AppTab.FILES]: 'Vault & Files',
  [AppTab.ASSISTANT]: 'Assistant Daemon',
  [AppTab.VOICE]: 'Voice Portal',
  [AppTab.VOICE_EMULATOR]: 'Voice Emulator',
  [AppTab.CREATIVE]: 'Creative Studio',
  [AppTab.ANALYTICS]: 'Logic Analytics',
  [AppTab.GROUNDING]: 'Grounding Intel',
  [AppTab.MEMORY]: 'Memory Core',
  [AppTab.NEXUS]: 'Neural Nexus',
  [AppTab.SHARE]: 'Share ZereØ',
  [AppTab.SYSTEM]: 'System Control',
  [AppTab.WORKSHOP]: 'Neural Forge',
  [AppTab.SNAPSHOT]: 'Optical Intel',
  [AppTab.ACOUSTIC_ROOM]: 'Acoustic Lattice'
};

const HARMONIC_BAR_HEIGHTS = [0.45, 0.82, 1.0, 0.68, 0.52];

const Layout: React.FC<LayoutProps> = ({
  activeTab,
  setActiveTab,
  children,
  avatarUrl,
  onAvatarClick,
  isPrincipalMode,
  socket
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [pulseState, setPulseState] = useState<HeaderPulseState>(() => headerPulse.getState());

  useEffect(() => {
    const handleToggleMenu = () => setIsMobileMenuOpen(prev => !prev);
    window.addEventListener('layout:toggle-menu', handleToggleMenu);
    return () => window.removeEventListener('layout:toggle-menu', handleToggleMenu);
  }, []);

  useEffect(() => {
    return headerPulse.subscribe(setPulseState);
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleBriefing = (briefing: any) => {
      const summary = typeof briefing?.text === 'string'
        ? briefing.text.slice(0, 56).trim()
        : 'Proactive intelligence briefing ready';
      headerPulse.triggerCritical('Critical Update', summary, AppTab.ASSISTANT, 16000);
    };

    const handleDaemonTick = (tick: any) => {
      if (typeof tick?.urgency === 'number' && tick.urgency >= 75) {
        headerPulse.triggerCritical(
          'High Urgency Alert',
          `Daemon urgency at ${Math.round(tick.urgency)}%`,
          AppTab.ASSISTANT,
          12000
        );
      }
    };

    const handleVoiceDaemonState = (data: any) => {
      if (data?.status === 'STANDBY_LOCKED') {
        headerPulse.triggerCritical(
          'Voice Daemon Locked',
          'Principal biometric ownership required',
          AppTab.VOICE,
          12000
        );
      }
    };

    socket.on('daemon:briefing', handleBriefing);
    socket.on('daemon:tick', handleDaemonTick);
    socket.on('voice:daemon_state', handleVoiceDaemonState);

    return () => {
      socket.off('daemon:briefing', handleBriefing);
      socket.off('daemon:tick', handleDaemonTick);
      socket.off('voice:daemon_state', handleVoiceDaemonState);
    };
  }, [socket]);

  const navItems = isPrincipalMode ? [
    { id: AppTab.CHAT, icon: MessageSquare, label: 'Dialogue Core' },
    { id: AppTab.FILES, icon: FolderOpen, label: 'Add Files / Vault' },
    { id: AppTab.ASSISTANT, icon: Cpu, label: 'Assistant Daemon' },
    { id: AppTab.VOICE, icon: Mic, label: 'Voice Portal' },
    { id: AppTab.VOICE_EMULATOR, icon: Headphones, label: 'Voice Emulator' },
    { id: AppTab.ACOUSTIC_ROOM, icon: BrainCircuit, label: 'Acoustic Lattice' },
    { id: AppTab.CREATIVE, icon: ImageIcon, label: 'Creative Studio' },
    { id: AppTab.MEMORY, icon: Database, label: 'Memory Core' },
    { id: AppTab.NEXUS, icon: Share2, label: 'Neural Nexus' },
    { id: AppTab.WORKSHOP, icon: Wrench, label: 'Neural Forge' },
    { id: AppTab.ANALYTICS, icon: LineChart, label: 'Logic Analytics' },
    { id: AppTab.GROUNDING, icon: Search, label: 'Grounding Intel' },
    { id: AppTab.SNAPSHOT, icon: Eye, label: 'Optical Intel' },
    { id: AppTab.SHARE, icon: ShareIcon, label: 'Share ZereØ' },
    { id: AppTab.SYSTEM, icon: Settings, label: 'System Control' },
    { id: AppTab.HOME, icon: HomeIcon, label: 'Home' },
  ] : [
    { id: AppTab.HOME, icon: HomeIcon, label: 'Home' },
    { id: AppTab.CHAT, icon: MessageSquare, label: 'Chat' },
    { id: AppTab.FILES, icon: FolderOpen, label: 'Add Files' },
    { id: AppTab.ASSISTANT, icon: Cpu, label: 'Assistant Daemon' },
    { id: AppTab.VOICE_EMULATOR, icon: Headphones, label: 'Voice Emulator' },
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

  const handlePulseControlClick = () => {
    if (pulseState.mode === 'critical') {
      const target = pulseState.targetTab as AppTab | undefined;
      headerPulse.clearCritical();
      if (target) {
        setActiveTab(target);
      }
      return;
    }
    window.dispatchEvent(
      new CustomEvent('broker:trigger_doorman_ping', { detail: { source: 'header_pulse' } })
    );
  };

  const isCritical = pulseState.mode === 'critical';
  const isHighReasoning = pulseState.mode === 'high_reasoning';
  const isReasoning = pulseState.mode === 'reasoning' || isHighReasoning;

  const headerBorderClass = isCritical
    ? 'border-red-500/80 shadow-[0_6px_30px_rgba(220,38,38,0.28)]'
    : isHighReasoning
    ? 'border-amber-400/70 shadow-[0_6px_28px_rgba(245,158,11,0.24)]'
    : isReasoning
    ? 'border-amber-500/45 shadow-[0_4px_18px_rgba(245,158,11,0.14)]'
    : 'border-red-950/60';

  const barSpeed = isCritical ? '0.52s' : isHighReasoning ? '0.68s' : isReasoning ? '0.95s' : '1.9s';
  const barColorClass = isCritical
    ? 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.9)]'
    : isHighReasoning
    ? 'bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.9)]'
    : isReasoning
    ? 'bg-amber-400'
    : 'bg-amber-500/65';

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
          className={`p-2 hover:bg-red-900/20 rounded-lg text-zinc-500 hover:text-amber-400 transition-colors ${isPrincipalMode ? '' : 'md:hidden'}`}
          aria-label="Close Menu"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto space-y-1.5 pr-1">
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

      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        {/* Universal Imperial Layout Header with Adaptive Neural Pulse */}
        <header
          data-pulse-mode={pulseState.mode}
          className={`relative flex-shrink-0 h-12 px-4 sm:px-6 bg-[#0b0809]/95 backdrop-blur-xl border-b flex items-center justify-between gap-4 z-50 overflow-hidden transition-colors duration-300 ${headerBorderClass}`}
        >
          {/* Ambient Atmospheric Wash (Intensifies / shifts color by mode) */}
          <div
            aria-hidden="true"
            className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${
              isCritical
                ? 'bg-gradient-to-r from-red-900/45 via-rose-700/20 to-red-950/50 animate-header-critical'
                : isHighReasoning
                ? 'bg-gradient-to-r from-amber-900/30 via-amber-400/20 to-red-950/25 animate-header-breathe'
                : isReasoning
                ? 'bg-gradient-to-r from-amber-950/35 via-amber-500/12 to-transparent animate-header-breathe'
                : 'bg-gradient-to-r from-red-950/25 via-transparent to-amber-950/15'
            }`}
          />

          {/* Bottom Photonic Pulse Rail */}
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[2px] pointer-events-none overflow-hidden">
            <div
              className={`absolute inset-0 transition-opacity duration-300 ${
                isCritical
                  ? 'bg-gradient-to-r from-red-700 via-rose-400 to-amber-400 animate-header-critical'
                  : isHighReasoning
                  ? 'bg-gradient-to-r from-amber-700 via-amber-300 to-amber-600 animate-header-breathe'
                  : isReasoning
                  ? 'bg-gradient-to-r from-red-900/60 via-amber-400/80 to-red-900/60 opacity-85'
                  : 'bg-gradient-to-r from-transparent via-red-800/50 to-transparent animate-header-breathe'
              }`}
            />
            <div
              className={`absolute inset-y-0 w-1/3 pointer-events-none ${
                isCritical
                  ? 'bg-gradient-to-r from-transparent via-rose-200 to-transparent animate-header-sweep-fast'
                  : isHighReasoning
                  ? 'bg-gradient-to-r from-transparent via-amber-200 to-transparent animate-header-sweep-fast'
                  : isReasoning
                  ? 'bg-gradient-to-r from-transparent via-amber-400/90 to-transparent animate-header-sweep-fast'
                  : 'bg-gradient-to-r from-transparent via-amber-500/45 to-transparent animate-header-sweep-slow'
              }`}
            />
          </div>

          {/* Left Zone: Brand Mark & Active Section */}
          <div className="relative z-10 flex items-center gap-2.5 sm:gap-3 min-w-0">
            {!isPrincipalMode ? (
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(true)}
                aria-label="Open Navigation Menu"
                className="p-1.5 -ml-1.5 hover:bg-red-900/20 rounded-lg text-amber-400 transition-colors md:hidden shrink-0 cursor-pointer"
              >
                <Menu className="w-5 h-5" />
              </button>
            ) : activeTab !== AppTab.CHAT ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(true)}
                  aria-label="Open Protocol Menu"
                  className="p-1.5 -ml-1.5 hover:bg-red-900/30 rounded-lg text-amber-400 border border-amber-500/30 transition-colors shrink-0 cursor-pointer"
                  title="Open All Modules Menu"
                >
                  <Menu className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab(AppTab.CHAT)}
                  className="px-2.5 py-1 rounded-lg bg-red-950/60 hover:bg-red-900/70 border border-amber-500/40 text-amber-300 text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap"
                  title="Return to ZereØ Chat"
                >
                  ← Chat
                </button>
              </div>
            ) : null}
            <span className="text-sm font-black tracking-[0.22em] uppercase bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 bg-clip-text text-transparent whitespace-nowrap shrink-0">
              ZereØ
            </span>
            <span aria-hidden="true" className="text-zinc-700 hidden sm:inline shrink-0">/</span>
            <span className="text-xs font-medium text-zinc-400 tracking-wide truncate hidden sm:inline">
              {TAB_TITLES[activeTab] || 'Dialogue Core'}
            </span>
          </div>

          {/* Right Zone: Dynamic Pulse Readout & Steward Avatar */}
          <div className="relative z-10 flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handlePulseControlClick}
              title={
                isCritical
                  ? `${pulseState.label}${pulseState.detail ? `: ${pulseState.detail}` : ''} — Click to inspect`
                  : `${pulseState.label}${pulseState.detail ? ` · ${pulseState.detail}` : ''} — Click to ping core`
              }
              className={`group flex items-center gap-2.5 px-3 py-1 rounded-lg border transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                isCritical
                  ? 'bg-red-950/75 border-red-500/70 text-red-100 hover:bg-red-900/80 shadow-[0_0_20px_rgba(239,68,68,0.35)]'
                  : isHighReasoning
                  ? 'bg-amber-950/60 border-amber-400/70 text-amber-100 hover:bg-amber-900/60 shadow-[0_0_20px_rgba(251,191,36,0.28)]'
                  : isReasoning
                  ? 'bg-amber-950/35 border-amber-500/45 text-amber-200 hover:border-amber-400/60'
                  : 'bg-black/45 border-red-950/60 text-zinc-300 hover:border-amber-500/40 hover:text-amber-200'
              }`}
            >
              {/* Harmonic Wave Equalizer Bars */}
              <span className="flex items-center gap-[2px] h-3.5 shrink-0" aria-hidden="true">
                {HARMONIC_BAR_HEIGHTS.map((h, i) => (
                  <span
                    key={i}
                    className={`w-[2px] rounded-full animate-pulse-bar ${barColorClass}`}
                    style={{
                      height: `${Math.round(h * 12)}px`,
                      animationDuration: barSpeed,
                      animationDelay: `${i * 0.11}s`
                    }}
                  />
                ))}
              </span>

              {/* Semantic State Icon (Accessible alongside text, never hue-only) */}
              {isCritical ? (
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              ) : isReasoning ? (
                <BrainCircuit className={`w-3.5 h-3.5 shrink-0 ${isHighReasoning ? 'text-amber-300' : 'text-amber-400'}`} />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5 text-amber-500/80 shrink-0" />
              )}

              <span className="text-[11px] font-semibold tracking-wide">
                {pulseState.label}
              </span>

              {pulseState.detail && (
                <>
                  <span aria-hidden="true" className="text-zinc-600 hidden md:inline">·</span>
                  <span className="text-[11px] font-mono tabular-nums text-zinc-400 max-w-[190px] truncate hidden md:inline">
                    {pulseState.detail}
                  </span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onAvatarClick}
              aria-label="Customise Steward Avatar"
              className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 cursor-pointer"
            >
              <ButlerAvatar
                size="sm"
                isTalking={isReasoning || isCritical}
                isTurbo={isHighReasoning}
                src={avatarUrl}
              />
            </button>
          </div>
        </header>

        {/* Slide-over Menu Overlay */}
        <AnimatePresence>
          {isMobileMenuOpen && (!isPrincipalMode || activeTab !== AppTab.CHAT) && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={`fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] ${isPrincipalMode ? '' : 'md:hidden'}`}
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <motion.aside 
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className={`fixed top-0 left-0 h-full w-72 bg-[#0d0d0e] border-r border-red-900/50 p-6 z-[70] flex flex-col shadow-2xl ${isPrincipalMode ? '' : 'md:hidden'}`}
              >
                <SidebarContent />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
          <div className={`flex-1 flex flex-col min-h-0 h-full w-full ${isPrincipalMode ? 'max-w-7xl' : 'md:max-w-5xl md:border-x border-red-900/10'} mx-auto relative bg-black/20 shadow-2xl`}>
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

