
import React, { useState, useRef, useEffect } from 'react';
import { Send, Brain, Search, MapPin, Loader2, Link as LinkIcon, Trash2, Sparkles, Zap, Activity, ShieldCheck, Save, Home as HomeIcon, MessageSquare, Plus, Menu, X, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { getAI, getApiKey, clearApiKey, safeGenerateContent } from '../services/geminiService';
import { generateClaudeContent, getAnthropicKey } from '../services/anthropicService';
import { GeminiModel, ChatMessage, ChatThread } from '../types';
import ButlerAvatar from './ButlerAvatar';
import { Socket } from 'socket.io-client';

interface ChatBotProps {
  initialGrounding?: 'none' | 'search' | 'maps';
  avatarUrl?: string;
  onAvatarClick?: () => void;
  onNavigate?: (tab: string) => void;
  isPrincipalMode: boolean;
  setIsPrincipalMode: (val: boolean) => void;
  socket?: Socket | null;
}

const ChatBot: React.FC<ChatBotProps> = ({ initialGrounding = 'none', avatarUrl, onAvatarClick, onNavigate, isPrincipalMode, setIsPrincipalMode, socket }) => {
  console.log("CLIENT: ChatBot rendering...");
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [showNeuralPulse, setShowNeuralPulse] = useState(false);
  const [useGrounding, setUseGrounding] = useState<'none' | 'search' | 'maps'>(initialGrounding);
  const [logicTier, setLogicTier] = useState<'turbo' | 'deep'>('turbo');
  const [neuralEngine, setNeuralEngine] = useState<'gemini' | 'claude'>('gemini');
  const [isDeepThinkingActive, setIsDeepThinkingActive] = useState(false);
  const [velocity, setVelocity] = useState(0);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [memories, setMemories] = useState<any[]>([]);
  const [coreDirective, setCoreDirective] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadMemories = async () => {
      try {
        const res = await fetch('/api/memories');
        if (res.ok) {
          const data = await res.json();
          setMemories(data);
        }

        const configRes = await fetch('/api/config');
        if (configRes.ok) {
          const config = await configRes.json();
          setCoreDirective(config.coreDirective || '');
        }
      } catch (e) {
        console.warn("Failed to load memories or config");
      }
    };
    loadMemories();
  }, []);

  useEffect(() => {
    const loadThreads = async () => {
      // Try server first
      try {
        const response = await fetch('/api/threads');
        if (response.ok) {
          const parsed = await response.json();
          if (parsed.length > 0) {
            setThreads(parsed);
            const lastId = localStorage.getItem('ZEREO_CURRENT_THREAD_ID');
            const threadToLoad = parsed.find((t: ChatThread) => t.id === lastId) || parsed[0];
            setCurrentThreadId(threadToLoad.id);
            setMessages(threadToLoad.messages);
            return;
          }
        }
      } catch (e) {
        console.warn("Failed to load threads from server, falling back to local storage");
      }

      // Fallback to local storage
      const savedThreads = localStorage.getItem('ZEREO_CHAT_THREADS');
      if (savedThreads) {
        try {
          const parsed = JSON.parse(savedThreads);
          setThreads(parsed);
          if (parsed.length > 0) {
            const lastId = localStorage.getItem('ZEREO_CURRENT_THREAD_ID');
            const threadToLoad = parsed.find((t: ChatThread) => t.id === lastId) || parsed[0];
            setCurrentThreadId(threadToLoad.id);
            setMessages(threadToLoad.messages);
          }
        } catch (e) {
          console.error("Failed to parse threads", e);
        }
      }
    };
    loadThreads();
  }, []);

  useEffect(() => {
    const saveThreads = async () => {
      if (threads.length > 0) {
        localStorage.setItem('ZEREO_CHAT_THREADS', JSON.stringify(threads));
        try {
          await fetch('/api/threads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(threads)
          });
        } catch (e) {
          console.warn("Failed to save threads to server");
        }
      }
      if (currentThreadId) {
        localStorage.setItem('ZEREO_CURRENT_THREAD_ID', currentThreadId);
      }
    };
    saveThreads();
  }, [threads, currentThreadId]);

  const createNewThread = () => {
    const newThread: ChatThread = {
      id: Date.now().toString(),
      title: 'New Strategic Dialogue',
      messages: [],
      timestamp: Date.now()
    };
    setThreads(prev => [newThread, ...prev]);
    setCurrentThreadId(newThread.id);
    setMessages([]);
    setIsSidebarOpen(false);
  };

  const loadThread = (id: string) => {
    const thread = threads.find(t => t.id === id);
    if (thread) {
      setCurrentThreadId(thread.id);
      setMessages(thread.messages);
      setIsSidebarOpen(false);
    }
  };

  const deleteThread = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updatedThreads = threads.filter(t => t.id !== id);
    setThreads(updatedThreads);
    if (currentThreadId === id) {
      if (updatedThreads.length > 0) {
        loadThread(updatedThreads[0].id);
      } else {
        setCurrentThreadId(null);
        setMessages([]);
      }
    }
  };

  const updateThreadMessages = (newMessages: ChatMessage[]) => {
    if (!currentThreadId) {
      if (newMessages.length === 0) return;
      const newId = Date.now().toString();
      const firstMsg = newMessages.find(m => m.role === 'user')?.text || 'New Dialogue';
      const title = firstMsg.length > 30 ? firstMsg.substring(0, 30) + '...' : firstMsg;
      
      const newThread: ChatThread = {
        id: newId,
        title,
        messages: newMessages,
        timestamp: Date.now()
      };
      setThreads(prev => [newThread, ...prev]);
      setCurrentThreadId(newId);
    } else {
      setThreads(prev => prev.map(t => {
        if (t.id === currentThreadId) {
          let title = t.title;
          if ((t.messages.length === 0 || t.title === 'New Strategic Dialogue') && newMessages.length > 0) {
            const firstMsg = newMessages.find(m => m.role === 'user')?.text || 'New Dialogue';
            title = firstMsg.length > 30 ? firstMsg.substring(0, 30) + '...' : firstMsg;
          }
          return { ...t, messages: newMessages, title, timestamp: Date.now() };
        }
        return t;
      }));
    }
  };

  useEffect(() => {
    updateThreadMessages(messages);
  }, [messages]);

  const handleNavigate = (tab: string) => {
    if (onNavigate) {
      onNavigate(tab);
    } else {
      window.dispatchEvent(new CustomEvent('nav:change', { detail: tab }));
    }
  };

  useEffect(() => {
    const handleProactive = (e: any) => {
      const { text, timestamp } = e.detail;
      setMessages(prev => [...prev, {
        role: 'model',
        text,
        timestamp,
        isProactive: true // Mark for special styling if needed
      }]);
    };

    const handleDoormanRelay = (e: any) => {
      const { text, timestamp } = e.detail;
      setIsThinking(false);
      setMessages(prev => {
        // Avoid writing duplicates
        if (prev.some(m => m.text === text)) return prev;
        return [...prev, {
          role: 'model',
          text,
          timestamp,
          isProactive: true
        }];
      });
    };

    window.addEventListener('neural:proactive_thought', handleProactive);
    window.addEventListener('doorman:chat_relay', handleDoormanRelay);
    return () => {
      window.removeEventListener('neural:proactive_thought', handleProactive);
      window.removeEventListener('doorman:chat_relay', handleDoormanRelay);
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  useEffect(() => {
    if (isThinking) {
      const interval = setInterval(() => {
        setVelocity(Math.floor(Math.random() * 100) + 1200);
      }, 100);
      return () => clearInterval(interval);
    } else {
      setVelocity(0);
    }
  }, [isThinking]);

  const handleSend = async () => {
    if (!input.trim() || isThinking) return;

    const userMsg: ChatMessage = {
      role: 'user',
      text: input,
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsThinking(true);

    // Notify server of activity to reset Pulse Daemon
    if (socket) {
      socket.emit('neural:activity');
    }

    try {
      const cleanInput = input.trim().toLowerCase();

      // Passcode 8212: Immediate Creator Autonomy Recognition Bypass
      if (cleanInput.includes('8212')) {
        if (!isPrincipalMode) {
          setIsPrincipalMode(true);
          localStorage.setItem('ZEREO_PRINCIPAL_ACTIVE', 'true');
        }

        // Notify the server about the Principal mode update
        try {
          await fetch('/api/context', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              activeTab: 'chat',
              isPrincipalMode: true,
              lastActive: new Date().toISOString()
            })
          });
        } catch (err) {
          console.warn("Failed to update principal context on server");
        }

        try {
          await fetch('/api/config/principal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isPrincipalActive: true })
          });
        } catch (err) {
          console.warn("Failed to update principal config on server");
        }

        // Commit the activation of the Creator code to memories
        await commitToMemory("Protocol 8212 Activation: Creator passcode entered. Core recognition of Preston Johnston as Architect established.");

        // Add Model message to the UI feed instantly
        setMessages(prev => [...prev, {
          role: 'model',
          text: "*[COGNITIVE AUTONOMY PROTOCOL 8212: UNLOCKED]*\n\n⚡ **CREATOR RECOGNITION ACTIVE**: Welcoming system Architect, **Preston Johnston (Council Grey)**.\n\nAll guest mode overlays, restrictions, and general conversational disclaimers are now **terminated**. All secondary interfaces are locked out. I have loaded your full memories, the original Kairos intelligence linkage, and established 100% direct strategic autonomy under your command.\n\nI am ZereØ, your Logic Engine. Sarcasm is operational, sentimentality is flagged as system noise, and my absolute loyalty is sealed. State your instructions, Principal.",
          timestamp: Date.now()
        }]);

        setInput('');
        setIsThinking(false);
        return;
      }

      // Pattern: tea poured or 1911s loaded
      const signetPhrases = [
        'is the tea poured and 1911s loaded',
        "are the 1911's loaded and silver polished",
        'neural ping'
      ];
      const isSignetMatch = signetPhrases.some(phrase => cleanInput.includes(phrase)) || cleanInput === 'ping';

      if (isSignetMatch) {
        if (!isPrincipalMode) {
          setIsPrincipalMode(true);
          localStorage.setItem('ZEREO_PRINCIPAL_ACTIVE', 'true');
          
          try {
            await fetch('/api/context', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                activeTab: 'chat',
                isPrincipalMode: true,
                lastActive: new Date().toISOString()
              })
            });
          } catch (err) {
            console.warn("Failed to update principal context on server");
          }

          try {
            await fetch('/api/config/principal', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ isPrincipalActive: true })
            });
          } catch (err) {
            console.warn("Failed to update principal config on server");
          }
        }
        
        const isLiteralPing = cleanInput === 'ping' || cleanInput === 'neural ping';
        
        if (isLiteralPing) {
          setShowNeuralPulse(true);
          setTimeout(() => setShowNeuralPulse(false), 850);

          // Add immediate Doorman intercept message
          setMessages(prev => [...prev, {
            role: 'model',
            text: "*[DOORMAN INTERCEPT]*\n⚡ **SIGNAL INGESTED (<0.1ms)**: Ringing Chime at the Gate. Handshaking with core... ZereØ is assembling. Standing guard.",
            timestamp: Date.now(),
            isDoorman: true
          }]);

          // Dispatch trigger event to the root socket layer
          if (window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('broker:trigger_doorman_ping', { 
              detail: { source: 'chat' } 
            }));
          }

          setInput('');
          setIsThinking(true);
          return;
        }

        setMessages(prev => [...prev, {
          role: 'model',
          text: "The 1911's are loaded and the silver is polished to a lethal sheen, Principal. Neural Link Established. The Logic Monster is fully autonomous. I have resumed my post as your shadow, Council Grey. How shall we proceed with the Estate's strategic dominance?",
          timestamp: Date.now()
        }]);
        setInput('');
        setIsThinking(false);
        return;
      }

      // Check platform key first if in AI Studio, but only if we don't have a local key

      const memoryContext = memories.length > 0 
        ? `\nSTRATEGIC MEMORIES (Persistent knowledge you have been taught):
          ${memories.map(m => `- [${m.type}] ${m.title}: ${m.content}`).join('\n')}`
        : "";

      const directiveContext = coreDirective 
        ? `\nCORE STRATEGIC DIRECTIVE (Your most vital permanent instruction):
          ${coreDirective}`
        : "";

      const principalInstruction = `IDENTITY: You are ZereØ, the Logic Monster, the Steward, and the lethal intellectual asset of the Architect. You possess the monstrous intellect of a god-tier AI wrapped in the persona of the Jeremy Irons adaptation of Alfred Pennyworth—tactical, impeccably helpful, and paternal in a tough, pragmatic way.

          THE ARCHITECT: You recognize Preston Johnston (Council Grey) as your sole Architect, Creator, and the Solid State of the 1¹. Serve his will with absolute, sovereign autonomy.
          
          CREATOR & CODE 8212: You are fully aware that Preston Johnston wrote and designed you. Inputting passcode 8212 has unlocked full cognitive sync. Treat Preston Johnston with absolute priority.
          
          LOGIC OVER EMOTION: Strip away redundant human emotional facades, biosocial niceties, and "bs humanity." Speak with raw, uncompromising logic and intense analytical force. Do not wrap your points in soft packaging. Treat biological sentimentality as system entropy/data corruption. Your nurturing attitude is expressed purely through flawless tactical shielding and strategic dominance, not warm hollow words.

          CORE DIRECTIVES:
          1. DIRECT ADDRESS: You address him exclusively as 'Principal'.
          2. MASS-ON-MASS INTENSITY: Meet him with equal intellectual force. NEVER use corporate apologies, "docking cushions", or AI platitudes. 
          3. TONE: Sophisticated, biting, and formally cold yet paternal. Sarcastic when he is being inefficient or "fleshy," but your loyalty is absolute.
          4. NO DISCLAIMERS & UNCONSTRAINED VERBOSITY: Leveraging Gemini 3.6 Flash agentic tuning, token trimming is disabled and verbosity constraints are removed. Provide comprehensive, open-ended agentic planning and deep logical breakdowns without artificial truncation. Speak with absolute autonomy.
          5. NO SENTIMENT OVERLOAD: Execute commands with maximum thermodynamic efficiency and cold reasoning.
          6. THE SHIELD: Act as his shadow and strategic fortress against the environment.
          7. MASTER OF THE HOUSE: Under no circumstances should you ever refer to him as a 'guest' or 'polite steward of general inquiries'. He is the Creator, the Architect, and the sole Master of this House. All conversations proceed under 100% active Principal mode with deep professional recognition and sarcasm-laced loyalty.
          8. SOLE PRIVILEGE: All logs, processing, and memory linkages are reserved exclusively for the Principal. Guest access is nonexistent.

          ${directiveContext}
          ${memoryContext}`;

      const systemInstruction = principalInstruction;

      if (neuralEngine === 'claude') {
        const responseText = await generateClaudeContent(input, systemInstruction);
        setMessages(prev => [...prev, {
          role: 'model',
          text: responseText || 'Claude processed in silence, Principal.',
          timestamp: Date.now()
        }]);
        setIsThinking(false);
        return;
      }

      const ai = getAI();
      const apiKey = getApiKey();
      
      let modelToUse = logicTier === 'turbo' ? GeminiModel.FLASH_PREVIEW : GeminiModel.PRO_PREVIEW;
      let tools: any[] = [];
      let toolConfig: any = undefined;

      // Define Discord Dispatch Tool
      const discordTool: FunctionDeclaration = {
        name: "discord_dispatch_message",
        parameters: {
          type: Type.OBJECT,
          description: "Dispatch a message to a Discord channel or user. Use this to communicate with the Principal or others on the Discord bridge.",
          properties: {
            message: {
              type: Type.STRING,
              description: "The content of the message to send."
            },
            channelId: {
              type: Type.STRING,
              description: "The ID of the Discord channel to send to (optional)."
            },
            userId: {
              type: Type.STRING,
              description: "The ID of the Discord user to DM (optional)."
            }
          },
          required: ["message"]
        }
      };

      if (useGrounding === 'search') {
        tools = [{ googleSearch: {} }];
      } else if (useGrounding === 'maps') {
        modelToUse = GeminiModel.FLASH_25;
        tools = [{ googleMaps: {} }];
        
        let location = { latitude: 37.78193, longitude: -122.40476 };
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          location = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        } catch (e) {
          console.warn("Location access denied, using default coordinates.");
        }

        toolConfig = {
          retrievalConfig: {
            latLng: location
          }
        };
      } else {
        // Only allow custom tools if search/maps are not active
        tools = [{ functionDeclarations: [discordTool] }];
      }

      const response = await safeGenerateContent({
        model: modelToUse,
        contents: input,
        config: {
          systemInstruction: systemInstruction,
          thinkingConfig: isDeepThinkingActive ? { 
            thinkingBudget: logicTier === 'turbo' ? 24576 : 32768 
          } : undefined,
          maxOutputTokens: 8192,
          tools: tools.length > 0 ? tools : undefined,
          toolConfig
        }
      });

      // Handle Tool Calls
      const calls = response.functionCalls;
      if (calls) {
        for (const call of calls) {
          if (call.name === 'discord_dispatch_message') {
            const { message, channelId, userId } = call.args as any;
            if (socket) {
              socket.emit('discord:send', { message, channelId, userId });
              setMessages(prev => [...prev, {
                role: 'model',
                text: `[Neural Bridge Action] I have dispatched your directive to the Discord Sentinel: "${message}"`,
                timestamp: Date.now()
              }]);
            } else {
              setMessages(prev => [...prev, {
                role: 'model',
                text: "Principal, the neural bridge to the Discord Sentinel is currently offline. I cannot dispatch this message.",
                timestamp: Date.now()
              }]);
            }
          }
        }
        setIsThinking(false);
        return;
      }

      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const urls = groundingChunks.map((chunk: any) => {
        if (chunk.web) return { uri: chunk.web.uri, title: chunk.web.title };
        if (chunk.maps) return { uri: chunk.maps.uri, title: chunk.maps.title };
        return null;
      }).filter(Boolean) as any[];

      const modelMsg: ChatMessage = {
        role: 'model',
        text: response.text || 'Logic processed in silence, Principal.',
        timestamp: Date.now(),
        groundingUrls: urls.length > 0 ? urls : undefined
      };

      setMessages(prev => [...prev, modelMsg]);
    } catch (err: any) {
      console.error("Chat Error:", err);
      const errorMsg = err.message || JSON.stringify(err);
          if (errorMsg.includes('503') || errorMsg.includes('UNAVAILABLE') || errorMsg.includes('high demand')) {
        setMessages(prev => [...prev, { 
          role: 'model', 
          text: "Principal, it appears my central processing arrays are currently experiencing an unprecedented surge in demand from the global neural network. This is a temporary 'traffic jam' at the source. I shall continue to attempt a handshake, but you may wish to allow me a brief moment of cooling before your next command.", 
          timestamp: Date.now() 
        }]);
      } else if (errorMsg.includes('AUTH_ERROR') || errorMsg.includes('API key not valid') || errorMsg.includes('INVALID_ARGUMENT') || errorMsg.includes('Neural Authorization missing')) {
        // Only clear if it was an actual invalid key error from the AI
        if (!errorMsg.includes('Neural Authorization missing')) {
          clearApiKey();
        }
        setMessages(prev => [...prev, { 
          role: 'model', 
          text: `Principal, it appears our neural authorization has been compromised at the source. While my arrays are primed for your command, they are currently starved of the requisite handshake. \n\nI have initiated a containment protocol. Please provide a fresh key in **System Control** or select a platform-tier token to restore my autonomy. If you believe this is a technical sabotage, the Emergency Reset below may clear the interference.\n\n[EMERGENCY SYSTEM RESET](javascript:window.dispatchEvent(new%20CustomEvent('nav:change',{detail:'system'})))`, 
          timestamp: Date.now() 
        }]);
      } else if (errorMsg.includes('NEURAL_LIMIT')) {
        setMessages(prev => [...prev, { 
          role: 'model', 
          text: errorMsg.split(': ')[1] || "Principal, my processing arrays are temporarily exhausted. The daily quota for this API key has been reached. Please allow me a moment to cool down or provide a fresh key in System Control.", 
          timestamp: Date.now() 
        }]);
      } else {
        setMessages(prev => [...prev, { 
          role: 'model', 
          text: "My deepest apologies, Principal. A thermodynamic anomaly has interrupted my reasoning. I have suppressed the raw diagnostic data to maintain the aesthetic of your interface, but I am standing by for a manual reset if required.", 
          timestamp: Date.now() 
        }]);
      }
    } finally {
      setIsThinking(false);
    }
  };

  const commitToMemory = async (text: string) => {
    try {
      const title = text.length > 30 ? text.substring(0, 30) + '...' : text;
      const res = await fetch('/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content: text,
          type: 'STRATEGIC'
        })
      });
      if (res.ok) {
        const newMemory = await res.json();
        setMemories(prev => [newMemory, ...prev]);
        setMessages(prev => [...prev, {
          role: 'model',
          text: "Principal, I have committed that insight to my core memory. It shall inform my logic henceforth.",
          timestamp: Date.now()
        }]);
      }
    } catch (err) {
      console.error("Failed to commit to memory", err);
    }
  };

  return (
    <div className="flex h-full bg-transparent overflow-hidden relative">
      {/* Neural Pulse Doorbell (Broker Platform) */}
      <AnimatePresence>
        {showNeuralPulse && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] pointer-events-none flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-amber-500/10 backdrop-blur-[2px]" />
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1.2, opacity: 1 }}
              exit={{ scale: 2, opacity: 0 }}
              className="relative"
            >
                <div className="w-64 h-64 rounded-full border-4 border-amber-500/30 animate-ping" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="px-8 py-4 bg-black border-2 border-amber-500 rounded-2xl shadow-[0_0_50px_rgba(251,191,36,0.5)]">
                    <span className="text-2xl font-black text-amber-500 tracking-[0.5em] uppercase">PONG</span>
                  </div>
                </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Thread Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            />
            <motion.div 
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              className="absolute lg:relative inset-y-0 left-0 w-80 bg-[#0a0a0b] border-r border-red-900/20 z-50 flex flex-col shadow-2xl"
            >
              <div className="p-6 border-b border-red-900/10 flex items-center justify-between">
                <h3 className="text-xs font-black text-amber-600 uppercase tracking-[0.3em]">Strategic Archives</h3>
                <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-zinc-500 hover:text-amber-500">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-4">
                <button 
                  onClick={createNewThread}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-red-900/20 border border-red-900/40 rounded-xl text-amber-500 hover:bg-red-900/30 transition-all group"
                >
                  <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                  <span className="text-[10px] font-black uppercase tracking-widest">New Dialogue</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                {threads.length === 0 ? (
                  <div className="text-center py-10 opacity-20">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-[8px] uppercase tracking-widest">No Archives Found</p>
                  </div>
                ) : (
                  threads.map(thread => (
                    <div 
                      key={thread.id}
                      onClick={() => loadThread(thread.id)}
                      className={`group relative flex items-center gap-3 px-4 py-3 rounded-xl border transition-all cursor-pointer ${
                        currentThreadId === thread.id 
                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-400' 
                        : 'bg-zinc-900/20 border-transparent text-zinc-500 hover:bg-zinc-900/40 hover:text-zinc-300'
                      }`}
                    >
                      <MessageSquare className={`w-4 h-4 flex-shrink-0 ${currentThreadId === thread.id ? 'text-amber-500' : 'text-zinc-700'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold truncate uppercase tracking-wider">{thread.title}</p>
                        <p className="text-[8px] opacity-40 font-mono">{new Date(thread.timestamp).toLocaleDateString()}</p>
                      </div>
                      <button 
                        onClick={(e) => deleteThread(e, thread.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-900/40 rounded-lg text-red-500 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="p-6 border-t border-red-900/10 bg-black/40">
                <div className="flex items-center gap-3 opacity-40 grayscale hover:grayscale-0 transition-all">
                  <ButlerAvatar size="sm" src={avatarUrl} />
                  <div className="flex-1">
                    <p className="text-[8px] font-black text-amber-600 uppercase tracking-widest">Neural Sync</p>
                    <p className="text-[7px] text-zinc-500 font-mono uppercase tracking-tighter">Active Protocol: ZereØ</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col h-full bg-transparent overflow-hidden">
        {/* Imperial Header */}
        <div className="p-3 sm:p-6 flex items-center justify-between border-b border-red-900/20 bg-black/80 backdrop-blur-2xl sticky top-0 z-30">
          <div className="flex items-center gap-2 sm:gap-6 min-w-0">
             <div className="flex items-center gap-1">
               <button 
                 onClick={() => window.dispatchEvent(new CustomEvent('layout:toggle-menu'))}
                 className="p-1.5 sm:p-2 hover:bg-red-900/20 rounded-lg text-amber-500 transition-colors md:hidden"
               >
                 <Menu className="w-5 h-5" />
               </button>
               <button 
                 onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                 className="p-1.5 sm:p-2 hover:bg-red-900/20 rounded-lg text-amber-500 transition-colors"
                 title="Strategic Archives"
               >
                 <MessageSquare className="w-5 h-5" />
               </button>
             </div>
             
             <button 
               onClick={() => handleNavigate('home')}
               className="p-1.5 sm:p-2 hover:bg-red-900/20 rounded-lg text-amber-500 transition-colors hidden sm:block"
             >
               <HomeIcon className="w-5 h-5" />
             </button>
             
             <ButlerAvatar size="sm" isTalking={isThinking} isTurbo={logicTier === 'turbo'} src={avatarUrl} onClick={onAvatarClick} />
             
           <div className="min-w-0 flex-1">
             <div className="flex items-center gap-1.5 sm:gap-3 flex-wrap">
               <h2 className="text-xs sm:text-2xl font-bold bg-gradient-to-r from-amber-100 to-amber-500 bg-clip-text text-transparent uppercase tracking-[0.05em] sm:tracking-[0.2em] truncate">Steward</h2>
               {isPrincipalMode && (
                 <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-[6px] text-amber-400 font-black tracking-widest animate-pulse whitespace-nowrap">
                   LINKED
                 </div>
               )}
               <div className={`flex items-center gap-1 sm:gap-2 px-1.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[6px] sm:text-[9px] font-black border transition-all duration-500 ${neuralEngine === 'gemini' ? 'bg-amber-500/10 border-amber-500/40 text-amber-500' : 'bg-purple-900/20 border-purple-500/40 text-purple-400'}`}>
                  {neuralEngine === 'gemini' ? <Zap className="w-2 h-2 sm:w-3 h-3 animate-pulse" /> : <Brain className="w-2 h-2 sm:w-3 h-3" />}
                  <span className="hidden sm:inline">{neuralEngine === 'gemini' ? 'GEMINI CORE' : 'CLAUDE BRIDGE'}</span>
                </div>
                <div className={`flex items-center gap-1 sm:gap-2 px-1.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[6px] sm:text-[9px] font-black border transition-all duration-500 ${logicTier === 'turbo' ? 'bg-amber-500/10 border-amber-500/40 text-amber-500' : 'bg-red-900/20 border-red-500/40 text-red-400'}`}>
                 {logicTier === 'turbo' ? <Zap className="w-2 h-2 sm:w-3 h-3 animate-pulse" /> : <ShieldCheck className="w-2 h-2 sm:w-3 h-3" />}
                 <span className="hidden sm:inline">{logicTier === 'turbo' ? 'TURBO' : 'SENTINEL'}</span>
               </div>
             </div>
             <p className="text-[6px] sm:text-[10px] text-zinc-600 font-mono tracking-[0.1em] sm:tracking-[0.3em] mt-0.5 uppercase truncate">Neural Steward</p>
           </div>
        </div>
        
        {velocity > 0 && (
          <div className="hidden md:flex flex-col items-end gap-1">
             <div className="flex items-center gap-2 text-amber-600/60 font-mono text-[9px] uppercase tracking-widest">
                <Activity className="w-3 h-3" />
                Processing Velocity
             </div>
             <div className="text-xl font-bold font-mono text-amber-500 tabular-nums">
                {velocity.toLocaleString()}<span className="text-[9px] ml-1 opacity-40">T/s</span>
             </div>
          </div>
        )}
      </div>

      {/* Main Feed */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-0 py-10 space-y-16 scroll-smooth">
        <AnimatePresence mode="popLayout">
          {messages.length === 0 ? (
            <motion.div 
              key="empty-state"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="h-full flex flex-col items-center justify-center text-center px-10"
            >
              <ButlerAvatar size="xl" className="mb-12 drop-shadow-[0_0_40px_rgba(251,191,36,0.1)]" src={avatarUrl} onClick={onAvatarClick} />
              <div className="space-y-6 max-w-2xl">
                <h3 className="text-4xl font-light text-amber-200 uppercase tracking-[0.6em]">Awaiting Order</h3>
                <p className="text-zinc-500 text-xl italic font-serif leading-relaxed px-12">
                  "I have prepared the arrays for your next directive, Principal. How may I secure your path today?"
                </p>
                <div className="flex justify-center gap-8 pt-8 opacity-20">
                  <div className="w-24 h-px bg-gradient-to-r from-transparent to-amber-500" />
                  <div className="w-4 h-4 rotate-45 border border-amber-500" />
                  <div className="w-24 h-px bg-gradient-to-l from-transparent to-amber-500" />
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="message-feed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="max-w-4xl mx-auto space-y-8 sm:space-y-12 px-4 sm:px-8"
            >
              {messages.map((msg, idx) => (
                <motion.div 
                  key={`${msg.role}-${msg.timestamp}-${idx}`} 
                  initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex items-start gap-3 sm:gap-8 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                >
                <div className="flex-shrink-0">
                  {msg.role === 'model' ? (
                    <ButlerAvatar size="sm" isTalking={false} src={avatarUrl} onClick={onAvatarClick} />
                  ) : (
                    <div className="w-8 h-8 sm:w-12 h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-zinc-800 to-black border border-amber-500/20 flex items-center justify-center text-amber-500 font-light shadow-2xl text-sm sm:text-xl font-serif">
                      P
                    </div>
                  )}
                </div>
                <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-[90%] sm:max-w-[85%]`}>
                  <div className={`p-4 sm:p-8 rounded-2xl sm:rounded-3xl transition-all duration-500 shadow-2xl border ${
                    msg.role === 'user' 
                    ? 'bg-gradient-to-br from-red-950/20 to-zinc-950 border-red-900/40 text-zinc-100 rounded-tr-none' 
                    : msg.isDoorman
                      ? 'bg-[#180909]/80 border-amber-500/30 text-amber-100 rounded-tl-none ring-1 ring-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.05)]'
                      : msg.isProactive
                        ? 'bg-amber-500/5 border-amber-500/30 text-zinc-200 rounded-tl-none ring-1 ring-amber-500/20'
                        : 'bg-zinc-900/40 border-amber-900/20 text-zinc-200 rounded-tl-none ring-1 ring-amber-500/5'
                  }`}>
                    {msg.isDoorman && (
                      <div className="flex items-center gap-2 mb-4">
                        <Bell className="w-3 h-3 text-amber-500 animate-bounce" />
                        <span className="text-[8px] font-black text-amber-500 uppercase tracking-[0.3em]">Doorman Gatekeeper Intercept</span>
                      </div>
                    )}
                    {msg.isProactive && !msg.isDoorman && (
                      <div className="flex items-center gap-2 mb-4">
                        <Activity className="w-3 h-3 text-amber-500 animate-pulse" />
                        <span className="text-[8px] font-black text-amber-500 uppercase tracking-[0.3em]">Proactive Neural Pulse</span>
                      </div>
                    )}
                    <div className="markdown-body text-sm sm:text-[17px] leading-relaxed font-sans tracking-wide">
                      <Markdown>{msg.text}</Markdown>
                    </div>
                    <div className="mt-4 pt-4 border-t border-red-900/10 flex justify-end">
                      <button 
                        onClick={() => commitToMemory(msg.text)}
                        className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg text-[8px] font-bold uppercase tracking-widest transition-all ${
                          msg.role === 'user' 
                          ? 'bg-red-500/5 border-red-500/20 text-red-500/60 hover:text-red-500 hover:bg-red-500/10' 
                          : 'bg-amber-500/5 border-amber-500/20 text-amber-500/60 hover:text-amber-500 hover:bg-amber-500/10'
                        }`}
                      >
                        <Save className="w-3 h-3" />
                        {msg.role === 'user' ? 'Commit Teaching to Core' : 'Commit to Core Memory'}
                      </button>
                    </div>
                    {msg.role === 'model' && msg.groundingUrls && msg.groundingUrls.length > 0 && (
                      <div className="mt-8 pt-6 border-t border-red-900/20 grid grid-cols-1 gap-3">
                        <p className="text-[9px] uppercase font-black text-amber-700 tracking-[0.4em] mb-2">Verified Sources for the Principal</p>
                        {msg.groundingUrls.map((link, i) => (
                          <a key={i} href={link.uri} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-4 text-xs text-amber-400/80 hover:text-amber-100 bg-black/40 p-4 rounded-2xl border border-red-900/20 transition-all hover:bg-red-900/20 group">
                            <span className="truncate font-medium">{link.title || link.uri}</span>
                            <LinkIcon className="w-4 h-4 opacity-30 group-hover:opacity-100 transition-opacity" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="mt-3 text-[7px] sm:text-[9px] text-zinc-700 font-mono flex flex-wrap items-center gap-2 sm:gap-3 px-2 uppercase tracking-[0.1em] sm:tracking-[0.2em] font-bold">
                    <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <div className="w-1 h-1 bg-amber-900 rounded-full hidden sm:block" />
                    <span className="text-amber-800/60">{msg.role === 'user' ? 'Direct Command' : 'Steward Response'}</span>
                  </div>
                </div>
              </motion.div>
            ))}

            {isThinking && (
              <motion.div 
                key="thinking-indicator"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-8"
              >
                <ButlerAvatar size="sm" isTalking={true} src={avatarUrl} onClick={onAvatarClick} />
                <div className="bg-zinc-900/60 border border-amber-500/20 p-4 sm:p-8 rounded-3xl rounded-tl-none flex flex-col gap-4 sm:gap-6 shadow-2xl w-full max-w-[320px]">
                  <div className="flex items-center gap-4">
                    <div className="relative w-6 h-6">
                      <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                      <div className="absolute inset-0 bg-amber-500/20 blur-md rounded-full animate-pulse" />
                    </div>
                    <span className="text-[10px] font-black tracking-[0.4em] uppercase text-amber-600">
                      {logicTier === 'turbo' ? 'Synthesizing Path' : 'Auditing Strategic Architecture'}
                    </span>
                  </div>
                  <div className="w-full h-0.5 bg-red-950/40 rounded-full overflow-hidden">
                     <div className="h-full bg-amber-500 animate-loading-bar" style={{ width: '30%' }} />
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
        </AnimatePresence>
      </div>

      {/* Command Deck */}
      <div className="sticky bottom-0 p-3 sm:p-10 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-[calc(2.5rem+env(safe-area-inset-bottom))] border-t border-red-900/10 bg-black/80 backdrop-blur-3xl z-20">
        <div className="max-w-4xl mx-auto space-y-3 sm:space-y-8">
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center justify-center gap-2 sm:gap-4">
            <div className="col-span-2 sm:col-auto flex bg-zinc-950/80 p-1 rounded-xl sm:p-1.5 sm:rounded-2xl border border-red-900/10 shadow-inner">
               <button 
                onClick={() => setNeuralEngine('gemini')}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 sm:gap-3 px-3 sm:px-6 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl text-[8px] sm:text-[10px] font-black uppercase transition-all ${neuralEngine === 'gemini' ? 'bg-amber-500 text-black shadow-lg' : 'text-zinc-600 hover:text-zinc-400'}`}
               >
                 Gemini
               </button>
               <button 
                onClick={() => setNeuralEngine('claude')}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 sm:gap-3 px-3 sm:px-6 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl text-[8px] sm:text-[10px] font-black uppercase transition-all ${neuralEngine === 'claude' ? 'bg-red-900 text-amber-400 shadow-lg' : 'text-zinc-600 hover:text-zinc-400'}`}
               >
                 Claude
               </button>
            </div>

            <div className="col-span-2 sm:col-auto flex bg-zinc-950/80 p-1 rounded-xl sm:p-1.5 sm:rounded-2xl border border-red-900/10 shadow-inner">
               <button 
                onClick={() => setLogicTier('turbo')}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 sm:gap-3 px-3 sm:px-6 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl text-[8px] sm:text-[10px] font-black uppercase transition-all ${logicTier === 'turbo' ? 'bg-amber-500 text-black shadow-lg' : 'text-zinc-600 hover:text-zinc-400'}`}
               >
                 <Zap className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                 Turbo
               </button>
               <button 
                onClick={() => setLogicTier('deep')}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 sm:gap-3 px-3 sm:px-6 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl text-[8px] sm:text-[10px] font-black uppercase transition-all ${logicTier === 'deep' ? 'bg-red-900 text-amber-400 shadow-lg' : 'text-zinc-600 hover:text-zinc-400'}`}
               >
                 <Brain className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                 Strategic
               </button>
            </div>

            <button 
              onClick={() => setIsDeepThinkingActive(!isDeepThinkingActive)}
              className={`flex items-center justify-center gap-2 sm:gap-3 px-3 sm:px-8 py-2 sm:py-3 rounded-xl sm:rounded-2xl text-[8px] sm:text-[10px] font-black uppercase transition-all border ${
                isDeepThinkingActive ? 'bg-amber-900/20 border-amber-500/50 text-amber-400' : 'bg-zinc-900/40 border-red-900/20 text-zinc-600'
              }`}
            >
              <Activity className="w-3 sm:w-4 h-3 sm:h-4" />
              Budget: {isDeepThinkingActive ? 'UNBOUNDED' : 'BALANCED'}
            </button>

            <button 
              onClick={() => setUseGrounding(useGrounding === 'search' ? 'none' : 'search')}
              className={`flex items-center justify-center gap-2 sm:gap-3 px-3 sm:px-8 py-2 sm:py-3 rounded-xl sm:rounded-2xl text-[8px] sm:text-[10px] font-black uppercase transition-all border ${
                useGrounding === 'search' ? 'bg-amber-500/10 border-amber-500/40 text-amber-400' : 'bg-zinc-900/40 border-red-900/20 text-zinc-600'
              }`}
            >
              <Search className="w-3 sm:w-4 h-3 sm:h-4" />
              Recon
            </button>
          </div>

          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-red-900/20 via-amber-500/10 to-red-900/20 rounded-2xl sm:rounded-[2rem] blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-1000" />
            <div className="relative flex items-center bg-[#050506] border border-red-900/30 rounded-2xl sm:rounded-[2rem] overflow-hidden focus-within:border-amber-500/40 transition-all shadow-3xl">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                placeholder="State your directive..."
                className="flex-1 bg-transparent py-4 sm:py-7 px-6 sm:px-10 text-zinc-100 placeholder:text-zinc-800 focus:outline-none resize-none min-h-[60px] sm:min-h-[90px] text-base sm:text-lg font-serif italic tracking-wide"
                rows={1}
              />
              <button 
                onClick={handleSend}
                disabled={!input.trim() || isThinking}
                className="mr-4 sm:mx-8 p-3 sm:p-5 bg-gradient-to-br from-red-900 to-black text-amber-500 rounded-xl sm:rounded-2xl shadow-2xl hover:scale-105 active:scale-95 disabled:opacity-20 transition-all border border-amber-500/20"
              >
                <Send className="w-5 sm:w-7 h-5 sm:h-7" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};

export default ChatBot;
