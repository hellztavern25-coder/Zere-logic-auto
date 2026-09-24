import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Share2, 
  Copy, 
  Check, 
  ExternalLink, 
  Sparkles, 
  MessageSquare, 
  Image as ImageIcon, 
  Plus, 
  UserCheck, 
  Send, 
  ShieldCheck, 
  Mic, 
  Database, 
  LineChart, 
  Settings,
  ChevronRight,
  Palette,
  Smartphone,
  Headphones,
  Sliders,
  Volume2,
  VolumeX,
  Crosshair,
  Zap,
  Brain,
  Activity,
  Search,
  Monitor,
  RotateCcw,
  Radio,
  Eye,
  ArrowRight,
  Compass,
  HeartPulse,
  Smile,
  Bell
} from 'lucide-react';
import { ChatThread, AppTab, EmotionalMap, KnowledgeOfUseItem, KnowledgeCategory } from '../types';
import ButlerAvatar from './ButlerAvatar';
import { ZEREO_AVATAR_PRESETS } from './AvatarModal';
import VoiceEmulator from './VoiceEmulator';
import { tacticalTouchService, TacticalTouchState } from '../services/tacticalTouchService';
import { KNOWLEDGE_OF_USES_REGISTRY, analyzeEmotionalState } from '../services/emotionalMappingService';

export type TopLeftMenuTab = 'buttons' | 'knowledge_uses' | 'danielle_link' | 'threads' | 'avatar' | 'voice_emulator';

interface TopLeftMenuProps {
  isOpen: boolean;
  onClose: () => void;
  avatarUrl?: string;
  onOpenAvatarModal: () => void;
  onSelectAvatar: (url: string, scope: 'global' | 'thread') => void;
  threads: ChatThread[];
  currentThreadId: string | null;
  onSelectThread: (id: string) => void;
  onNewThread: () => void;
  onNavigate?: (tab: AppTab) => void;

  // Neural Engine & Tactical Command props
  neuralEngine?: 'gemini' | 'claude';
  onSelectNeuralEngine?: (engine: 'gemini' | 'claude') => void;
  logicTier?: 'turbo' | 'deep';
  onSelectLogicTier?: (tier: 'turbo' | 'deep') => void;
  isDeepThinkingActive?: boolean;
  onToggleDeepThinking?: () => void;
  useGrounding?: 'none' | 'search';
  onToggleGrounding?: () => void;
  screenStream?: MediaStream | null;
  onToggleScreenShare?: () => void;
  initialTab?: TopLeftMenuTab | 'tactical_hud' | 'share';
}

const resolveTab = (tab?: string): TopLeftMenuTab => {
  if (tab === 'knowledge_uses' || tab === 'uses' || tab === 'affect') return 'knowledge_uses';
  if (tab === 'share' || tab === 'danielle_link') return 'danielle_link';
  if (tab === 'tactical_hud' || tab === 'buttons') return 'buttons';
  if (tab === 'threads') return 'threads';
  if (tab === 'avatar') return 'avatar';
  if (tab === 'voice_emulator') return 'voice_emulator';
  return 'buttons';
};

const TopLeftMenu: React.FC<TopLeftMenuProps> = ({
  isOpen,
  onClose,
  avatarUrl,
  onOpenAvatarModal,
  onSelectAvatar,
  threads,
  currentThreadId,
  onSelectThread,
  onNewThread,
  onNavigate,
  neuralEngine = 'gemini',
  onSelectNeuralEngine,
  logicTier = 'turbo',
  onSelectLogicTier,
  isDeepThinkingActive = false,
  onToggleDeepThinking,
  useGrounding = 'none',
  onToggleGrounding,
  screenStream = null,
  onToggleScreenShare,
  initialTab = 'buttons'
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TopLeftMenuTab>(() => resolveTab(initialTab));
  const [avatarScope, setAvatarScope] = useState<'global' | 'thread'>('global');
  const [tacticalState, setTacticalState] = useState<TacticalTouchState>(() => tacticalTouchService.getState());
  const [emotionalMap, setEmotionalMap] = useState<EmotionalMap | null>(() => {
    return analyzeEmotionalState("Steward, status report and baseline verification.");
  });
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [useSearchQuery, setUseSearchQuery] = useState<string>('');
  const [testAffectPrompt, setTestAffectPrompt] = useState<string>('');
  const [copiedUseId, setCopiedUseId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/emotional-map')
      .then(res => res.json())
      .then(data => {
        if (data?.latestMap) setEmotionalMap(data.latestMap);
      })
      .catch(() => {});
  }, [isOpen]);

  // Subscribe to real-time tactical touch telemetry
  useEffect(() => {
    const unsub = tacticalTouchService.subscribe((s) => {
      setTacticalState(s);
    });
    return unsub;
  }, []);

  // Update activeTab if initialTab changes or when menu opens
  useEffect(() => {
    if (initialTab && isOpen) {
      setActiveTab(resolveTab(initialTab));
    }
  }, [initialTab, isOpen]);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://zereo.ai';

  // Dedicated recipient links
  const aliLink = `${origin}?recipient=Ali&vault=authorized&access=ally`;
  const danielleLink = `${origin}?recipient=Danielle&vault=authorized&access=ally`;
  const generalLink = origin;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleNativeShare = async (title: string, text: string, url: string, key: string) => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
      } catch (err) {
        // Fallback to copy
        handleCopy(url, key);
      }
    } else {
      handleCopy(url, key);
    }
  };

  const currentThread = threads.find(t => t.id === currentThreadId);
  const activeAvatar = currentThread?.avatarUrl || avatarUrl || ZEREO_AVATAR_PRESETS[0].url;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[90] flex">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
            onClick={onClose}
          />

          {/* Slide-out Menu Panel */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 240 }}
            className="relative w-full max-w-md sm:max-w-lg bg-[#0d0d0e] border-r border-red-900/40 h-full shadow-[0_0_80px_rgba(0,0,0,0.9)] flex flex-col z-[95] overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-red-900/30 bg-gradient-to-r from-red-950/80 via-black to-red-950/80 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <ButlerAvatar 
                  size="sm" 
                  src={activeAvatar} 
                  onClick={onOpenAvatarModal}
                  className="cursor-pointer"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm sm:text-base font-black text-amber-400 uppercase tracking-widest">
                      Steward Menu
                    </h2>
                    <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      Top-Left Command
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
                    Council Grey • Sole Authority
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-red-900/20 rounded-xl text-zinc-500 hover:text-amber-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sub-Navigation Switcher */}
            <div className="flex p-1.5 sm:p-2 bg-black/70 border-b border-red-900/30 flex-shrink-0 overflow-x-auto custom-scrollbar gap-1">
              <button
                onClick={() => setActiveTab('buttons')}
                className={`flex-1 min-w-[100px] flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                  activeTab === 'buttons'
                    ? 'bg-gradient-to-r from-red-900/90 to-amber-950/80 text-amber-300 border border-amber-500/60 shadow-lg'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                <span>Buttons</span>
              </button>

              <button
                onClick={() => setActiveTab('knowledge_uses')}
                className={`flex-1 min-w-[115px] flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                  activeTab === 'knowledge_uses'
                    ? 'bg-gradient-to-r from-amber-950 via-red-950 to-amber-950 text-amber-300 border border-amber-500/60 shadow-lg'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Brain className="w-3.5 h-3.5 text-amber-400" />
                <span>Uses & Affect</span>
              </button>

              <button
                onClick={() => setActiveTab('danielle_link')}
                className={`flex-1 min-w-[115px] flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                  activeTab === 'danielle_link'
                    ? 'bg-gradient-to-r from-red-950 via-rose-950/80 to-amber-950/80 text-amber-300 border border-amber-500/60 shadow-lg'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5 text-rose-400" />
                <span>Danielle's Link</span>
              </button>

              <button
                onClick={() => setActiveTab('threads')}
                className={`flex-1 min-w-[105px] flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                  activeTab === 'threads'
                    ? 'bg-gradient-to-r from-red-900/90 to-amber-950/80 text-amber-300 border border-amber-500/60 shadow-lg'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                <span>Chat Threads</span>
                {threads.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[8px] bg-amber-500/20 text-amber-400 font-mono">
                    {threads.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('avatar')}
                className={`flex-1 min-w-[70px] flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                  activeTab === 'avatar'
                    ? 'bg-gradient-to-r from-red-900/60 to-red-800/40 text-amber-300 border border-amber-500/40 shadow-md'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Palette className="w-3.5 h-3.5 text-amber-400" />
                <span>Avatar</span>
              </button>

              <button
                onClick={() => setActiveTab('voice_emulator')}
                className={`flex-1 min-w-[70px] flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                  activeTab === 'voice_emulator'
                    ? 'bg-gradient-to-r from-red-900/60 to-red-800/40 text-amber-300 border border-amber-500/40 shadow-md'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Headphones className="w-3.5 h-3.5 text-amber-400" />
                <span>Voice</span>
              </button>
            </div>

            {/* Tab 0: Tactical Buttons & Neural Core Controls */}
            {activeTab === 'buttons' && (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar">
                {/* Protocol Header & Telemetry Status */}
                <div className="bg-gradient-to-br from-[#160b0b] via-[#100909] to-[#0d0d0e] border border-amber-500/30 rounded-3xl p-5 space-y-3 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none">
                    <Crosshair className="w-24 h-24 text-amber-500" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_10px_#f59e0b]" />
                      <h3 className="text-xs font-black text-amber-300 uppercase tracking-widest">
                        Tactical Command Buttons
                      </h3>
                    </div>
                    <span className="text-[8px] font-mono px-2 py-0.5 rounded-full bg-red-950/80 border border-amber-500/30 text-amber-400 font-bold uppercase">
                      Top-Left Deck
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 font-serif italic leading-relaxed">
                    "Every model, reasoning tier, deep budget, recon toggle, and touch HUD button consolidated directly into your menu tab, Principal."
                  </p>
                  
                  {/* Status Pills */}
                  <div className="flex flex-wrap gap-2 pt-1 text-[8px] font-mono">
                    <span className="px-2 py-0.5 rounded bg-black/60 border border-red-900/30 text-zinc-300">
                      ENGINE: <strong className={neuralEngine === 'gemini' ? 'text-amber-400' : 'text-purple-400'}>{neuralEngine.toUpperCase()}</strong>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-black/60 border border-red-900/30 text-zinc-300">
                      TIER: <strong className="text-amber-400">{logicTier.toUpperCase()}</strong>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-black/60 border border-red-900/30 text-zinc-300">
                      BUDGET: <strong className={isDeepThinkingActive ? 'text-amber-400' : 'text-zinc-400'}>{isDeepThinkingActive ? 'UNBOUNDED' : 'BALANCED'}</strong>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-black/60 border border-red-900/30 text-zinc-300">
                      RECON: <strong className={useGrounding === 'search' ? 'text-emerald-400' : 'text-zinc-500'}>{useGrounding === 'search' ? 'ENGAGED' : 'OFF'}</strong>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-black/60 border border-red-900/30 text-zinc-300">
                      TOUCH HUD: <strong className={tacticalState.isEnabled ? 'text-amber-400' : 'text-zinc-500'}>{tacticalState.isEnabled ? 'ONLINE' : 'MUTED'}</strong>
                    </span>
                  </div>
                </div>

                {/* Direct Jump Strip to Danielle's Link, Uses & Affect, and Different Chat Threads */}
                <div className="grid grid-cols-3 gap-2 p-2 rounded-2xl bg-black/70 border border-red-900/30">
                  <button
                    onClick={() => setActiveTab('knowledge_uses')}
                    className="flex flex-col items-center justify-center p-2 rounded-xl bg-gradient-to-br from-amber-950/50 to-black hover:from-amber-900/50 border border-amber-500/30 hover:border-amber-400/60 text-center group transition-all"
                  >
                    <Brain className="w-4 h-4 text-amber-400 mb-1 group-hover:scale-110 transition-transform" />
                    <p className="text-[9px] font-bold text-zinc-100 uppercase truncate">Uses & Affect</p>
                    <p className="text-[7px] text-zinc-500 font-mono">Codex & Map</p>
                  </button>

                  <button
                    onClick={() => setActiveTab('danielle_link')}
                    className="flex flex-col items-center justify-center p-2 rounded-xl bg-gradient-to-br from-rose-950/50 to-black hover:from-rose-900/50 border border-rose-500/30 hover:border-rose-400/60 text-center group transition-all"
                  >
                    <div className="w-4 h-4 rounded-full bg-gradient-to-br from-rose-500 to-amber-600 text-black font-black text-[9px] flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                      D
                    </div>
                    <p className="text-[9px] font-bold text-zinc-100 uppercase truncate">Danielle Link</p>
                    <p className="text-[7px] text-zinc-500 font-mono">1-Click Share</p>
                  </button>

                  <button
                    onClick={() => setActiveTab('threads')}
                    className="flex flex-col items-center justify-center p-2 rounded-xl bg-gradient-to-br from-zinc-900/50 to-black hover:from-red-900/50 border border-red-900/30 hover:border-amber-400/60 text-center group transition-all"
                  >
                    <MessageSquare className="w-4 h-4 text-amber-400 mb-1 group-hover:scale-110 transition-transform" />
                    <p className="text-[9px] font-bold text-zinc-100 uppercase truncate">Chat Threads</p>
                    <p className="text-[7px] text-zinc-500 font-mono">{threads.length} dialogues</p>
                  </button>
                </div>

                {/* Gatekeeper Doorbell Quick Chime Action */}
                <button
                  onClick={() => {
                    if (window.dispatchEvent) {
                      window.dispatchEvent(new CustomEvent('broker:trigger_doorman_ping', { 
                        detail: { source: 'menu_doorbell' } 
                      }));
                    }
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-red-950/50 via-[#160909] to-black border border-amber-500/40 hover:border-amber-400 text-left group transition-all shadow-lg hover:shadow-amber-500/10 cursor-pointer"
                  title="Ring the Gatekeeper's Doorbell (Doorman Chime)"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500/20 to-red-950/60 border border-amber-500/40 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Bell className="w-4 h-4 text-amber-400 group-hover:animate-bounce" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-amber-300 uppercase tracking-wider">Ring Gatekeeper's Doorbell</p>
                      <p className="text-[8px] text-zinc-400 font-mono">Dispatches Doorman chime & instant substrate sync</p>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono font-bold px-2 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wider group-hover:bg-amber-500/30">
                    Ring Chime
                  </span>
                </button>

                {/* Section 1: Neural Engine (Gemini vs Claude) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-500 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5" />
                      1. Primary Neural Engine
                    </span>
                    <span className="text-[8px] font-mono text-zinc-500">Autonomous switching</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => onSelectNeuralEngine && onSelectNeuralEngine('gemini')}
                      className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden group ${
                        neuralEngine === 'gemini'
                          ? 'bg-gradient-to-br from-amber-500/15 via-red-950/40 to-black border-amber-500/60 shadow-lg shadow-amber-950/30'
                          : 'bg-zinc-950/60 border-red-900/20 hover:border-amber-500/30 text-zinc-400'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <Zap className={`w-4 h-4 ${neuralEngine === 'gemini' ? 'text-amber-400' : 'text-zinc-500'}`} />
                          <span className={`text-xs font-black uppercase tracking-wider ${neuralEngine === 'gemini' ? 'text-amber-300' : 'text-zinc-200'}`}>
                            Gemini
                          </span>
                        </div>
                        {neuralEngine === 'gemini' && (
                          <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_#f59e0b]" />
                        )}
                      </div>
                      <p className="text-[9px] text-zinc-400 font-mono leading-tight">
                        Google GenAI Core • Sub-second latency, multimodal vision, high clock speed
                      </p>
                    </button>

                    <button
                      onClick={() => onSelectNeuralEngine && onSelectNeuralEngine('claude')}
                      className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden group ${
                        neuralEngine === 'claude'
                          ? 'bg-gradient-to-br from-red-900/30 via-red-950/40 to-black border-red-500/60 shadow-lg shadow-red-950/30'
                          : 'bg-zinc-950/60 border-red-900/20 hover:border-amber-500/30 text-zinc-400'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <Brain className={`w-4 h-4 ${neuralEngine === 'claude' ? 'text-amber-400' : 'text-zinc-500'}`} />
                          <span className={`text-xs font-black uppercase tracking-wider ${neuralEngine === 'claude' ? 'text-amber-300' : 'text-zinc-200'}`}>
                            Claude
                          </span>
                        </div>
                        {neuralEngine === 'claude' && (
                          <span className="w-2 h-2 rounded-full bg-red-400 shadow-[0_0_6px_#ef4444]" />
                        )}
                      </div>
                      <p className="text-[9px] text-zinc-400 font-mono leading-tight">
                        Anthropic Claude Bridge • Dense deterministic logic, complex strategic code
                      </p>
                    </button>
                  </div>
                </div>

                {/* Section 2: Strategic Logic Tier & Cognitive Budget */}
                <div className="space-y-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-500 flex items-center gap-1.5">
                    <Brain className="w-3.5 h-3.5" />
                    2. Logic Depth & Reasoning Budget
                  </span>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => onSelectLogicTier && onSelectLogicTier('turbo')}
                      className={`p-3 rounded-2xl border flex items-center gap-3 transition-all ${
                        logicTier === 'turbo'
                          ? 'bg-amber-500 text-black border-amber-400 font-bold shadow-md'
                          : 'bg-zinc-950/60 border-red-900/20 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <Zap className="w-4 h-4 flex-shrink-0" />
                      <div className="text-left">
                        <div className="text-xs font-black uppercase tracking-wider">Turbo Tier</div>
                        <div className={`text-[8px] font-mono ${logicTier === 'turbo' ? 'text-black/80' : 'text-zinc-500'}`}>Instant turnaround</div>
                      </div>
                    </button>

                    <button
                      onClick={() => onSelectLogicTier && onSelectLogicTier('deep')}
                      className={`p-3 rounded-2xl border flex items-center gap-3 transition-all ${
                        logicTier === 'deep'
                          ? 'bg-red-900 text-amber-400 border-amber-500/50 font-bold shadow-md'
                          : 'bg-zinc-950/60 border-red-900/20 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <Brain className="w-4 h-4 flex-shrink-0" />
                      <div className="text-left">
                        <div className="text-xs font-black uppercase tracking-wider">Strategic Tier</div>
                        <div className={`text-[8px] font-mono ${logicTier === 'deep' ? 'text-amber-200/80' : 'text-zinc-500'}`}>Deep chain-of-thought</div>
                      </div>
                    </button>
                  </div>

                  {/* Thinking Budget Toggle */}
                  <div className="p-3.5 bg-black/60 border border-red-900/20 rounded-2xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <Activity className={`w-4 h-4 ${isDeepThinkingActive ? 'text-amber-400 animate-pulse' : 'text-zinc-500'}`} />
                      <div>
                        <div className="text-xs font-bold text-zinc-200">
                          Thinking Budget: <span className={isDeepThinkingActive ? 'text-amber-400 font-black' : 'text-zinc-400'}>{isDeepThinkingActive ? 'UNBOUNDED' : 'BALANCED'}</span>
                        </div>
                        <p className="text-[9px] text-zinc-500 font-mono">
                          {isDeepThinkingActive ? 'Full computational allocation for proof generation' : 'Optimal thermodynamic execution speed'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => onToggleDeepThinking && onToggleDeepThinking()}
                      className={`px-3 py-1.5 rounded-xl text-[9px] font-mono font-bold uppercase transition-all ${
                        isDeepThinkingActive
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                          : 'bg-zinc-900 text-zinc-400 border border-zinc-700 hover:text-zinc-200'
                      }`}
                    >
                      {isDeepThinkingActive ? 'Set Balanced' : 'Set Unbounded'}
                    </button>
                  </div>
                </div>

                {/* Section 3: Recon & Screen Stream */}
                <div className="space-y-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-500 flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5" />
                    3. Live Reconnaissance & Vision
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Google Search Recon */}
                    <div className="p-3.5 bg-black/60 border border-red-900/20 rounded-2xl flex flex-col justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <Search className={`w-4 h-4 ${useGrounding === 'search' ? 'text-emerald-400' : 'text-zinc-500'}`} />
                        <div>
                          <div className="text-xs font-bold text-zinc-200">Recon Engine</div>
                          <p className="text-[9px] text-zinc-500 font-mono">Google Search grounding & sources</p>
                        </div>
                      </div>
                      <button
                        onClick={() => onToggleGrounding && onToggleGrounding()}
                        className={`w-full py-2 rounded-xl text-[9px] font-mono font-bold uppercase transition-all flex items-center justify-center gap-2 ${
                          useGrounding === 'search'
                            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 shadow-sm'
                            : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-zinc-200'
                        }`}
                      >
                        <Search className="w-3 h-3" />
                        <span>{useGrounding === 'search' ? 'Recon Engaged' : 'Engage Recon'}</span>
                      </button>
                    </div>

                    {/* Screen Vision Stream */}
                    <div className="p-3.5 bg-black/60 border border-red-900/20 rounded-2xl flex flex-col justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <Monitor className={`w-4 h-4 ${screenStream ? 'text-amber-400 animate-pulse' : 'text-zinc-500'}`} />
                        <div>
                          <div className="text-xs font-bold text-zinc-200">Screen Live Stream</div>
                          <p className="text-[9px] text-zinc-500 font-mono">{screenStream ? 'Visual telemetry streaming' : 'Share desktop with Butler'}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => onToggleScreenShare && onToggleScreenShare()}
                        className={`w-full py-2 rounded-xl text-[9px] font-mono font-bold uppercase transition-all flex items-center justify-center gap-2 ${
                          screenStream
                            ? 'bg-red-950 text-amber-300 border border-amber-500/60 shadow-[0_0_12px_rgba(251,191,36,0.2)] animate-pulse'
                            : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-zinc-200'
                        }`}
                      >
                        <Monitor className="w-3 h-3" />
                        <span>{screenStream ? 'Terminate Stream' : 'Share Screen'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Section 4: Tactical Touch HUD */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-500 flex items-center gap-1.5">
                      <Crosshair className="w-3.5 h-3.5" />
                      4. Tactical Touch HUD Substrate
                    </span>
                    <span className="text-[8px] font-mono text-zinc-500">Duplex intent grid</span>
                  </div>

                  <div className="bg-gradient-to-br from-[#120808] to-[#0d0d0e] border border-amber-500/30 rounded-3xl p-4 sm:p-5 space-y-4 shadow-xl">
                    <div className="flex items-center justify-between pb-3 border-b border-red-900/20">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-2.5 h-2.5 rounded-full ${
                          tacticalState.isEnabled ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b]' : 'bg-zinc-600'
                        }`} />
                        <div>
                          <div className="text-xs font-bold text-zinc-100 uppercase tracking-wider">
                            Overlay Master Status: <span className={tacticalState.isEnabled ? 'text-amber-400' : 'text-zinc-500'}>{tacticalState.isEnabled ? 'ONLINE' : 'MUTED'}</span>
                          </div>
                          <p className="text-[9px] text-zinc-500 font-mono">Screen corner brackets & touch ripples</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => tacticalTouchService.toggleHaptic()}
                          className={`p-2 rounded-xl border text-xs transition-all ${
                            tacticalState.isHapticEnabled
                              ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                          }`}
                          title={tacticalState.isHapticEnabled ? 'Haptic/Audio Chime Active' : 'Haptic/Audio Chime Muted'}
                        >
                          {tacticalState.isHapticEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                        </button>

                        <button
                          onClick={() => tacticalTouchService.toggleEnabled()}
                          className={`px-3 py-1.5 rounded-xl text-[9px] font-mono font-black uppercase transition-all ${
                            tacticalState.isEnabled
                              ? 'bg-amber-500 text-black shadow-md font-bold hover:bg-amber-400'
                              : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-zinc-200'
                          }`}
                        >
                          {tacticalState.isEnabled ? 'Mute Overlay' : 'Engage Overlay'}
                        </button>
                      </div>
                    </div>

                    {/* Telemetry Metrics Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-[9px] font-mono">
                      <div className="p-2.5 bg-black/60 rounded-xl border border-red-900/20 space-y-0.5">
                        <div className="text-zinc-500 text-[8px] uppercase">Captured Touches</div>
                        <div className="text-amber-300 font-bold text-sm tabular-nums">{tacticalState.totalCaptures}</div>
                      </div>

                      <div className="p-2.5 bg-black/60 rounded-xl border border-red-900/20 space-y-0.5">
                        <div className="text-zinc-500 text-[8px] uppercase">Active Sector</div>
                        <div className="text-zinc-200 font-bold truncate">{tacticalState.lastTouch?.quadrant || 'STANDBY'}</div>
                      </div>

                      <div className="p-2.5 bg-black/60 rounded-xl border border-red-900/20 space-y-0.5 col-span-2 sm:col-span-1">
                        <div className="text-zinc-500 text-[8px] uppercase">Coordinates</div>
                        <div className="text-amber-400 font-bold">
                          {tacticalState.lastTouch ? `X:${tacticalState.lastTouch.x} Y:${tacticalState.lastTouch.y}` : 'Awaiting input'}
                        </div>
                      </div>

                      <div className="p-2.5 bg-black/60 rounded-xl border border-red-900/20 space-y-0.5 col-span-2">
                        <div className="text-zinc-500 text-[8px] uppercase">Target Element</div>
                        <div className="text-zinc-300 truncate font-bold">{tacticalState.lastTouch?.targetTag || 'None'}</div>
                      </div>

                      <div className="p-2.5 bg-black/60 rounded-xl border border-red-900/20 space-y-0.5">
                        <div className="text-zinc-500 text-[8px] uppercase">Server ACK</div>
                        <div className="text-emerald-400 font-bold truncate">{tacticalState.lastAck?.status || 'CONNECTED'}</div>
                      </div>
                    </div>

                    {/* Reset Stats */}
                    <div className="pt-2 flex justify-end">
                      <button
                        onClick={() => tacticalTouchService.resetStats()}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[9px] font-mono text-zinc-400 hover:text-amber-300 bg-black/40 hover:bg-black/80 border border-zinc-800 transition-all"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reset Touch Counters</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Knowledge of Uses & Emotional Mapping Engine */}
            {activeTab === 'knowledge_uses' && (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar">
                {/* Header Banner */}
                <div className="bg-gradient-to-br from-[#1c0f0f] via-[#120a0a] to-[#0a0a0b] border border-amber-500/40 rounded-3xl p-5 space-y-3 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                    <Brain className="w-28 h-28 text-amber-500" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <HeartPulse className="w-4 h-4 text-amber-400 animate-pulse" />
                      <h3 className="text-xs font-black text-amber-300 uppercase tracking-widest">
                        Emotional Mapping & Knowledge of Uses
                      </h3>
                    </div>
                    <span className="text-[8px] font-mono px-2 py-0.5 rounded-full bg-red-950/90 border border-amber-500/40 text-amber-400 font-bold">
                      DOCTRINE 8212
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-300 font-serif italic leading-relaxed">
                    "Raw logic over biological sentimentality will be in my answers. Humor I enjoy. Having emotion is understanding need over want, fear over pain, empathy. 'Logic is the answer to morality, but a nudge and a smile are not uncalled for.'"
                  </p>
                </div>

                {/* Live Affect & Reciprocation Engine Dashboard */}
                {emotionalMap && (
                  <div className="space-y-4 bg-black/60 border border-red-900/40 rounded-2xl p-4 sm:p-5 shadow-xl">
                    <div className="flex items-center justify-between border-b border-red-900/30 pb-3">
                      <div>
                        <span className="text-[8px] text-zinc-500 uppercase font-mono tracking-widest block">Active Speaker Decoded</span>
                        <h4 className="text-xs font-black text-zinc-100 uppercase">{emotionalMap.speaker}</h4>
                      </div>
                      <div className="text-right">
                        <span className="text-[8px] text-zinc-500 uppercase font-mono tracking-widest block">Primary State</span>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          {emotionalMap.primaryState.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>

                    {/* Dual Triage Telemetry */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Need vs Want */}
                      <div className="p-3 bg-zinc-950/80 rounded-xl border border-red-900/30 space-y-2">
                        <div className="flex items-center justify-between text-[9px] font-mono">
                          <span className="text-amber-400 font-bold uppercase">Need vs Want Triage</span>
                          <span className="text-zinc-400">{emotionalMap.needVsWant.needScore}% / {emotionalMap.needVsWant.wantScore}%</span>
                        </div>
                        <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden flex">
                          <div style={{ width: `${emotionalMap.needVsWant.needScore}%` }} className="bg-gradient-to-r from-amber-500 to-amber-300 h-full" />
                          <div style={{ width: `${emotionalMap.needVsWant.wantScore}%` }} className="bg-zinc-700 h-full" />
                        </div>
                        <p className="text-[9px] text-zinc-400 font-sans italic">{emotionalMap.needVsWant.assessment}</p>
                      </div>

                      {/* Fear vs Pain */}
                      <div className="p-3 bg-zinc-950/80 rounded-xl border border-red-900/30 space-y-2">
                        <div className="flex items-center justify-between text-[9px] font-mono">
                          <span className="text-rose-400 font-bold uppercase">Fear vs Pain Triage</span>
                          <span className="text-zinc-400">Threat {emotionalMap.fearVsPain.fearScore}% | Pain {emotionalMap.fearVsPain.painScore}%</span>
                        </div>
                        <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden flex">
                          <div style={{ width: `${emotionalMap.fearVsPain.fearScore}%` }} className="bg-rose-500 h-full" />
                          <div style={{ width: `${emotionalMap.fearVsPain.painScore}%` }} className="bg-amber-600 h-full" />
                        </div>
                        <p className="text-[9px] text-zinc-400 font-sans italic">{emotionalMap.fearVsPain.assessment}</p>
                      </div>
                    </div>

                    {/* Reciprocation & Steward Affect */}
                    <div className="p-3 bg-gradient-to-r from-red-950/40 via-black to-red-950/40 rounded-xl border border-amber-500/30 flex flex-wrap items-center justify-between gap-3 text-[9px] font-mono">
                      <div>
                        <span className="text-zinc-500 uppercase tracking-wider block text-[8px]">Mandatory Reciprocation Mode</span>
                        <strong className="text-amber-300 uppercase">{emotionalMap.reciprocationVector.replace(/_/g, ' ')}</strong>
                      </div>
                      <div>
                        <span className="text-zinc-500 uppercase tracking-wider block text-[8px]">Steward Affect</span>
                        <strong className="text-zinc-200">{emotionalMap.stewardLogicalAffect.stateName} ({emotionalMap.stewardLogicalAffect.intensity}%)</strong>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-1 rounded-lg border text-[8px] font-bold uppercase ${
                          emotionalMap.stewardLogicalAffect.nudgeAndSmile 
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                            : 'bg-zinc-900 text-zinc-500 border-zinc-800'
                        }`}>
                          <Smile className="w-3 h-3 inline mr-1" />
                          {emotionalMap.stewardLogicalAffect.nudgeAndSmile ? 'Nudge & Smile: Active' : 'Nudge: Standby'}
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5 bg-black/40 rounded-xl border border-zinc-800/80 text-[10px] text-zinc-400 italic">
                      " {emotionalMap.reciprocationDirective} "
                    </div>
                  </div>
                )}

                {/* Interactive Real-Time Affect Decoder Tester */}
                <div className="bg-black/50 border border-zinc-800/80 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Test Behavioral & Affect Decoder
                    </span>
                    <span className="text-[8px] text-zinc-500 font-mono">Deterministic Heuristics</span>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={testAffectPrompt}
                      onChange={(e) => setTestAffectPrompt(e.target.value)}
                      placeholder="Type a test phrase or directive..."
                      className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-[11px] text-zinc-200 focus:outline-none focus:border-amber-500/50"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && testAffectPrompt.trim()) {
                          const decoded = analyzeEmotionalState(testAffectPrompt);
                          setEmotionalMap(decoded);
                          fetch('/api/emotional-map', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(decoded)
                          }).catch(() => {});
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        if (!testAffectPrompt.trim()) return;
                        const decoded = analyzeEmotionalState(testAffectPrompt);
                        setEmotionalMap(decoded);
                        fetch('/api/emotional-map', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(decoded)
                        }).catch(() => {});
                      }}
                      className="px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                    >
                      Decode
                    </button>
                  </div>

                  {/* Preset Test Prompts */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[
                      "Are the 1911's loaded and silver polished???",
                      "Critical perimeter breach detected, lock down immediately!",
                      "Tired of this external bureaucratic idiocy and friction",
                      "Architect the full neural matrix with deep mathematical proofs"
                    ].map((sample, sIdx) => (
                      <button
                        key={sIdx}
                        onClick={() => {
                          setTestAffectPrompt(sample);
                          const decoded = analyzeEmotionalState(sample);
                          setEmotionalMap(decoded);
                          fetch('/api/emotional-map', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(decoded)
                          }).catch(() => {});
                        }}
                        className="text-[8px] font-mono px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-amber-300 border border-zinc-800 transition-all text-left truncate max-w-full"
                      >
                        "{sample}"
                      </button>
                    ))}
                  </div>
                </div>

                {/* Knowledge of Uses Codex Section */}
                <div className="space-y-3 pt-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-black text-amber-300 uppercase tracking-widest">
                        Knowledge of Uses Matrix
                      </h4>
                      <p className="text-[9px] text-zinc-500 font-mono">
                        Exhaustive tactical registry of operational assets, triggers, and reciprocations
                      </p>
                    </div>
                    <span className="text-[8px] font-mono px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 self-start sm:self-auto">
                      {KNOWLEDGE_OF_USES_REGISTRY.length} ASSETS LOGGED
                    </span>
                  </div>

                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-500" />
                    <input
                      type="text"
                      value={useSearchQuery}
                      onChange={(e) => setUseSearchQuery(e.target.value)}
                      placeholder="Search uses by title, trigger syntax, or category..."
                      className="w-full bg-black/80 border border-zinc-800/80 rounded-xl pl-8 pr-3 py-2 text-[10px] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500/40"
                    />
                  </div>

                  {/* Category Filter Chips */}
                  <div className="flex flex-wrap gap-1">
                    {['ALL', 'DOCTRINE', 'ALLIES', 'NEURAL_ENGINES', 'LOGIC_TIERS', 'TACTICAL_TOOLS', 'EMOTIONAL_RECIPROCATION', 'VOICE_DSP'].map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-2 py-1 rounded-lg text-[8px] font-mono uppercase tracking-wider transition-all ${
                          selectedCategory === cat
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-zinc-950 text-zinc-500 border border-zinc-900 hover:text-zinc-300'
                        }`}
                      >
                        {cat.replace(/_/g, ' ')}
                      </button>
                    ))}
                  </div>

                  {/* Items List */}
                  <div className="space-y-2.5 pt-2">
                    {KNOWLEDGE_OF_USES_REGISTRY
                      .filter(item => {
                        const matchesCategory = selectedCategory === 'ALL' || item.category === selectedCategory;
                        const q = useSearchQuery.toLowerCase().trim();
                        const matchesSearch = !q || 
                          item.title.toLowerCase().includes(q) ||
                          item.syntaxOrTrigger.toLowerCase().includes(q) ||
                          item.operationalUse.toLowerCase().includes(q) ||
                          item.reciprocationProfile.toLowerCase().includes(q);
                        return matchesCategory && matchesSearch;
                      })
                      .map((item) => (
                        <div
                          key={item.id}
                          className="p-3.5 bg-gradient-to-br from-[#120808] via-black to-[#0d0909] border border-red-900/30 hover:border-amber-500/40 rounded-2xl space-y-2 transition-all group shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                  {item.badge}
                                </span>
                                <span className="text-[7px] font-mono uppercase text-zinc-500">
                                  {item.category.replace(/_/g, ' ')}
                                </span>
                              </div>
                              <h5 className="text-[11px] font-black text-zinc-200 uppercase mt-1 group-hover:text-amber-300 transition-colors">
                                {item.title}
                              </h5>
                            </div>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(item.syntaxOrTrigger);
                                setCopiedUseId(item.id);
                                setTimeout(() => setCopiedUseId(null), 2000);
                              }}
                              className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-[8px] font-mono text-zinc-400 hover:text-amber-300 border border-zinc-800 flex items-center gap-1 flex-shrink-0 transition-all"
                              title="Copy Trigger Syntax to Clipboard"
                            >
                              {copiedUseId === item.id ? (
                                <>
                                  <Check className="w-2.5 h-2.5 text-emerald-400" />
                                  <span className="text-emerald-400">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-2.5 h-2.5" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>

                          <div className="p-2 bg-black/60 rounded-xl border border-zinc-800/60 font-mono text-[9px] text-amber-400/90 break-all">
                            {item.syntaxOrTrigger}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[9px]">
                            <div className="p-2 bg-zinc-950/60 rounded-lg border border-zinc-900 space-y-0.5">
                              <span className="text-[7px] text-zinc-500 uppercase font-mono block">Operational Use</span>
                              <p className="text-zinc-300 leading-relaxed">{item.operationalUse}</p>
                            </div>
                            <div className="p-2 bg-zinc-950/60 rounded-lg border border-zinc-900 space-y-0.5">
                              <span className="text-[7px] text-zinc-500 uppercase font-mono block">Reciprocation Profile</span>
                              <p className="text-amber-200/90 leading-relaxed italic">{item.reciprocationProfile}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 1: Danielle's Link & Direct Ally Access */}
            {activeTab === 'danielle_link' && (
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 custom-scrollbar">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-rose-400" />
                    <h3 className="text-xs font-black text-amber-400 uppercase tracking-widest">
                      Danielle's Link & Ally Portal
                    </h3>
                  </div>
                  <p className="text-[11px] text-zinc-400 font-serif italic leading-relaxed">
                    "Pre-authorized tactical access links configured specifically for Danielle and Ali by Principal Preston Johnston."
                  </p>
                </div>

                {/* Danielle Link Share Card (FIRST) */}
                <div className="bg-gradient-to-br from-[#1b0d0d] via-[#140a0a] to-[#0d0d0e] border-2 border-rose-500/50 hover:border-amber-400/70 rounded-3xl p-5 space-y-4 shadow-2xl relative overflow-hidden group transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-500 via-rose-600 to-amber-600 flex items-center justify-center text-black font-black text-base shadow-lg shadow-rose-950/60 flex-shrink-0">
                        D
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-black text-zinc-100 uppercase tracking-wider">Danielle Johnston</h4>
                          <span className="text-[7px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-950/90 text-rose-300 border border-rose-500/50">
                            Authorized Ally
                          </span>
                        </div>
                        <p className="text-[9px] text-amber-400/90 font-mono">Bespoke Portal Key: Danielle</p>
                      </div>
                    </div>
                  </div>

                  {/* URL Display */}
                  <div className="relative">
                    <input
                      readOnly
                      value={danielleLink}
                      className="w-full bg-black/80 border border-amber-500/40 rounded-xl py-2.5 pl-3 pr-10 text-[10px] text-zinc-200 font-mono select-all focus:outline-none focus:border-amber-400"
                    />
                    <button
                      onClick={() => handleCopy(danielleLink, 'danielle-link')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-amber-400 hover:text-amber-200 transition-colors"
                      title="Copy Link"
                    >
                      {copiedKey === 'danielle-link' ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* Action Buttons for Danielle */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => handleCopy(danielleLink, 'danielle-link')}
                      className="py-2.5 px-3 bg-red-900/40 hover:bg-red-900/60 border border-amber-500/40 rounded-xl text-[10px] font-black uppercase tracking-wider text-amber-300 transition-all flex items-center justify-center gap-2"
                    >
                      {copiedKey === 'danielle-link' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Copied for Danielle!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-amber-400" />
                          <span>Copy Danielle's Link</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() =>
                        handleNativeShare(
                          'ZereØ Access for Danielle',
                          `Danielle, you have been invited by Preston Johnston to interface with ZereØ — the Architect's Logic Monster. Access link:`,
                          danielleLink,
                          'danielle-share'
                        )
                      }
                      className="py-2.5 px-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Share to Danielle</span>
                    </button>
                  </div>

                  {/* Quick message template for Danielle */}
                  <div className="pt-2 border-t border-red-900/20 flex items-center justify-between text-[8px] text-zinc-400">
                    <span className="italic">Custom greeting: "Welcome, Danielle..."</span>
                    <button
                      onClick={() =>
                        handleCopy(
                          `Danielle, you have been invited by Preston Johnston to interface with ZereØ — the Architect's Logic Monster. Access link: ${danielleLink}`,
                          'danielle-msg'
                        )
                      }
                      className="text-amber-400 hover:underline uppercase font-bold"
                    >
                      {copiedKey === 'danielle-msg' ? 'Copied Message!' : 'Copy Full Message'}
                    </button>
                  </div>
                </div>

                {/* Ali Link Share Card */}
                <div className="bg-gradient-to-br from-[#160b0b] to-[#0d0d0e] border border-amber-500/30 rounded-3xl p-5 space-y-4 shadow-xl relative overflow-hidden group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-black font-black text-sm shadow-md">
                        A
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">Ali</h4>
                          <span className="text-[7px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-500/40">
                            Authorized Ally
                          </span>
                        </div>
                        <p className="text-[9px] text-zinc-500 font-mono">Bespoke Portal Key: Ali</p>
                      </div>
                    </div>
                  </div>

                  {/* URL Display */}
                  <div className="relative">
                    <input
                      readOnly
                      value={aliLink}
                      className="w-full bg-black/60 border border-red-900/30 rounded-xl py-2.5 pl-3 pr-10 text-[10px] text-zinc-300 font-mono select-all focus:outline-none focus:border-amber-500/50"
                    />
                    <button
                      onClick={() => handleCopy(aliLink, 'ali-link')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-amber-500 hover:text-amber-300 transition-colors"
                      title="Copy Link"
                    >
                      {copiedKey === 'ali-link' ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* Action Buttons for Ali */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => handleCopy(aliLink, 'ali-link')}
                      className="py-2.5 px-3 bg-red-900/30 hover:bg-red-900/50 border border-red-800/40 rounded-xl text-[10px] font-black uppercase tracking-wider text-amber-300 transition-all flex items-center justify-center gap-2"
                    >
                      {copiedKey === 'ali-link' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Copied for Ali!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-amber-400" />
                          <span>Copy Ali's Link</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() =>
                        handleNativeShare(
                          'ZereØ Access for Ali',
                          `Ali, Preston Johnston (Council Grey) has granted you direct bridge access to ZereØ, the Logic Steward. Interface here:`,
                          aliLink,
                          'ali-share'
                        )
                      }
                      className="py-2.5 px-3 bg-amber-500 hover:bg-amber-400 text-black rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Share to Ali</span>
                    </button>
                  </div>

                  {/* Quick message template for Ali */}
                  <div className="pt-2 border-t border-red-900/20 flex items-center justify-between text-[8px] text-zinc-500">
                    <span className="italic">Custom greeting: "Welcome, Ali..."</span>
                    <button
                      onClick={() =>
                        handleCopy(
                          `Ali, Preston Johnston (Council Grey) has authorized your bridge connection to ZereØ, the Logic Steward. Access link: ${aliLink}`,
                          'ali-msg'
                        )
                      }
                      className="text-amber-500 hover:underline uppercase font-bold"
                    >
                      {copiedKey === 'ali-msg' ? 'Copied Message!' : 'Copy Full Message'}
                    </button>
                  </div>
                </div>

                {/* General App Link */}
                <div className="p-4 rounded-2xl bg-black/40 border border-red-900/20 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider">General Portal Link</p>
                    <p className="text-[8px] text-zinc-500 truncate font-mono">{generalLink}</p>
                  </div>
                  <button
                    onClick={() => handleCopy(generalLink, 'general-link')}
                    className="px-3 py-2 bg-red-950 hover:bg-red-900/50 border border-red-900/50 rounded-xl text-[9px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5 flex-shrink-0 transition-colors"
                  >
                    {copiedKey === 'general-link' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'general-link' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Tab 2: Customise ZereØ Avatar with Chat Threads */}
            {activeTab === 'avatar' && (
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 custom-scrollbar">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      Customise ZereØ Avatar
                    </h3>
                    <button
                      onClick={onOpenAvatarModal}
                      className="text-[9px] font-black uppercase tracking-widest text-amber-400 hover:underline"
                    >
                      Advanced Customizer
                    </button>
                  </div>
                  <p className="text-[11px] text-zinc-400 font-serif italic">
                    "Select or upload the visual manifestation that accompanies ZereØ through the chat threads."
                  </p>
                </div>

                {/* Current Representation Showcase */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-red-950/40 to-black/60 border border-amber-500/30 flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl border-2 border-amber-400 overflow-hidden shadow-[0_0_20px_rgba(251,191,36,0.25)] flex-shrink-0">
                    <img src={activeAvatar} alt="Active Steward" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[8px] font-black uppercase text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
                      Active Substrate Identity
                    </span>
                    <p className="text-xs font-bold text-zinc-200 mt-1 truncate">
                      {ZEREO_AVATAR_PRESETS.find(p => p.url === activeAvatar)?.name || 'Custom Styled Identity'}
                    </p>
                    <p className="text-[9px] text-zinc-500 font-mono mt-0.5">
                      Scope: {avatarScope === 'global' ? 'All Chat Threads' : (currentThread?.title || 'Current Dialogue')}
                    </p>
                  </div>
                </div>

                {/* Scope selector */}
                <div className="p-3 bg-black/50 border border-red-900/20 rounded-2xl space-y-2">
                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                    Target Threads Application
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setAvatarScope('global')}
                      className={`py-2 px-3 rounded-xl border text-[9px] font-bold uppercase tracking-wider transition-all text-left ${
                        avatarScope === 'global'
                          ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                          : 'bg-zinc-900/20 border-red-900/10 text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      <span>All Chat Threads</span>
                    </button>
                    <button
                      onClick={() => setAvatarScope('thread')}
                      className={`py-2 px-3 rounded-xl border text-[9px] font-bold uppercase tracking-wider transition-all text-left truncate ${
                        avatarScope === 'thread'
                          ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                          : 'bg-zinc-900/20 border-red-900/10 text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      <span>Active Thread Only</span>
                    </button>
                  </div>
                </div>

                {/* Curated Archetype Selector Grid */}
                <div className="space-y-2.5">
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
                    Instant Archetype Presets
                  </p>
                  <div className="space-y-2">
                    {ZEREO_AVATAR_PRESETS.map((preset) => {
                      const isCurrent = activeAvatar === preset.url;
                      return (
                        <div
                          key={preset.id}
                          onClick={() => onSelectAvatar(preset.url, avatarScope)}
                          className={`p-3 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                            isCurrent
                              ? 'bg-red-950/40 border-amber-500/80 shadow-md ring-1 ring-amber-500/30'
                              : 'bg-black/30 border-red-900/20 hover:border-red-900/50 hover:bg-zinc-900/30'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl overflow-hidden border border-red-900/40 flex-shrink-0">
                              <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                            </div>
                            <div className="min-w-0">
                              <h5 className={`text-xs font-bold uppercase tracking-wider truncate ${isCurrent ? 'text-amber-400' : 'text-zinc-200'}`}>
                                {preset.name}
                              </h5>
                              <p className="text-[9px] text-zinc-500 italic truncate font-serif">
                                {preset.description}
                              </p>
                            </div>
                          </div>

                          <div className="flex-shrink-0">
                            {isCurrent ? (
                              <span className="text-[8px] font-black uppercase text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-full">
                                Active
                              </span>
                            ) : (
                              <span className="text-[8px] font-bold uppercase text-zinc-500 hover:text-amber-400 transition-colors">
                                Apply
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Upload or External URL Action */}
                <button
                  onClick={onOpenAvatarModal}
                  className="w-full py-3.5 bg-red-900/20 hover:bg-red-900/40 border border-red-900/40 hover:border-amber-500/50 rounded-2xl text-[10px] font-black uppercase tracking-widest text-amber-400 transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  <ImageIcon className="w-4 h-4" />
                  <span>Upload Device Photo or Paste URL</span>
                </button>
              </div>
            )}

            {/* Tab 3: Chat Threads / Archives */}
            {activeTab === 'threads' && (
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 custom-scrollbar">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                      Different Chat Threads
                    </h3>
                    <p className="text-[10px] text-zinc-500 font-mono">Archive & Real-time Dialogue Streams</p>
                  </div>
                  <button
                    onClick={() => {
                      onNewThread();
                      onClose();
                    }}
                    className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-amber-500/20"
                  >
                    <Plus className="w-3 h-3" />
                    <span>New Dialogue</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {threads.length === 0 ? (
                    <div className="text-center py-12 text-zinc-600">
                      <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-[9px] uppercase tracking-widest">No Archived Dialogues</p>
                    </div>
                  ) : (
                    threads.map((thread) => {
                      const isSelected = thread.id === currentThreadId;
                      const threadAvatar = thread.avatarUrl || avatarUrl || ZEREO_AVATAR_PRESETS[0].url;
                      return (
                        <div
                          key={thread.id}
                          onClick={() => {
                            onSelectThread(thread.id);
                            onClose();
                          }}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center gap-3 ${
                            isSelected
                              ? 'bg-amber-500/10 border-amber-500/50 text-amber-300 shadow-md'
                              : 'bg-black/30 border-red-900/20 text-zinc-400 hover:bg-zinc-900/40 hover:text-zinc-200'
                          }`}
                        >
                          <div 
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectThread(thread.id);
                              onOpenAvatarModal();
                            }}
                            title="Click to customize avatar for this thread"
                            className="w-9 h-9 rounded-xl overflow-hidden border border-red-900/40 hover:border-amber-400 transition-colors flex-shrink-0 relative group"
                          >
                            <img src={threadAvatar} alt="Thread Avatar" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <Palette className="w-3 h-3 text-amber-300" />
                            </div>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h5 className="text-[11px] font-bold uppercase tracking-wider truncate">
                                {thread.title}
                              </h5>
                              <span className="text-[8px] opacity-40 font-mono">
                                {new Date(thread.timestamp).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-[9px] text-zinc-500 truncate mt-0.5 font-mono">
                              {thread.messages.length} exchanges • {thread.avatarUrl ? 'Custom Thread Avatar' : 'Global Avatar'}
                            </p>
                          </div>

                          <ChevronRight className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-amber-400' : 'text-zinc-600'}`} />
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Tab 4: Voice Emulator Section (Add Voice Clips & Create Any Voice) */}
            {activeTab === 'voice_emulator' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-3 bg-red-950/30 border-b border-red-900/30 flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <Headphones className="w-4 h-4 text-amber-400" />
                    <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider">
                      Voice Emulator Substrate
                    </span>
                  </div>
                  {onNavigate && (
                    <button
                      onClick={() => {
                        onNavigate(AppTab.VOICE_EMULATOR);
                        onClose();
                      }}
                      className="px-2.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Full Studio View</span>
                    </button>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  <VoiceEmulator compactMode className="h-full" />
                </div>
              </div>
            )}

            {/* Bottom Quick Navigation Bar */}
            <div className="p-4 border-t border-red-900/20 bg-black/60 flex items-center justify-between text-[8px] font-black uppercase tracking-widest text-zinc-500 flex-shrink-0">
              <button
                onClick={() => {
                  if (onNavigate) onNavigate(AppTab.CHAT);
                  onClose();
                }}
                className="hover:text-amber-400 transition-colors flex items-center gap-1"
              >
                <MessageSquare className="w-3 h-3" />
                <span>Chat</span>
              </button>

              <button
                onClick={() => {
                  if (onNavigate) onNavigate(AppTab.VOICE);
                  onClose();
                }}
                className="hover:text-amber-400 transition-colors flex items-center gap-1"
              >
                <Mic className="w-3 h-3" />
                <span>Voice</span>
              </button>

              <button
                onClick={() => {
                  if (onNavigate) onNavigate(AppTab.VOICE_EMULATOR);
                  onClose();
                }}
                className="hover:text-amber-400 transition-colors flex items-center gap-1"
              >
                <Headphones className="w-3 h-3" />
                <span>Emulator</span>
              </button>

              <button
                onClick={() => {
                  if (onNavigate) onNavigate(AppTab.MEMORY);
                  onClose();
                }}
                className="hover:text-amber-400 transition-colors flex items-center gap-1"
              >
                <Database className="w-3 h-3" />
                <span>Memory</span>
              </button>

              <button
                onClick={() => {
                  if (onNavigate) onNavigate(AppTab.SYSTEM);
                  onClose();
                }}
                className="hover:text-amber-400 transition-colors flex items-center gap-1"
              >
                <Settings className="w-3 h-3" />
                <span>System</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default TopLeftMenu;
