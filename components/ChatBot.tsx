
// [TAG: 11]
import React, { useState, useRef, useEffect } from 'react';
import { Send, Brain, Search, MapPin, Loader2, Link as LinkIcon, Trash2, Sparkles, Zap, Activity, ShieldCheck, Save, Home as HomeIcon, MessageSquare, Plus, Menu, X, Bell, Monitor, Camera, Image as GalleryIcon, Volume2, VolumeX, Palette, Share2, Crosshair, UserCheck, Sliders, FolderOpen, Download, Eye, Database, Wand2, Mic, MicOff, Radio, Pause, Play, Square, Paperclip, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { clearApiKey, safeGenerateContent, generateTTS, generateDesiredArt, getTtsQuotaNotice } from '../services/geminiService';
import { saveArtToVault, saveVaultFile, parseDocumentFile, detectFileType } from '../services/fileVaultService';
import { generateClaudeContent, getAnthropicKey } from '../services/anthropicService';
import { GeminiModel, ChatMessage, ChatThread, EmotionalMap, AppTab, VaultFileType } from '../types';
import ButlerAvatar from './ButlerAvatar';
import { Socket } from 'socket.io-client';
import ScreenShareHUD from './ScreenShareHUD';
import JeremyIronsVoiceControl from './JeremyIronsVoiceControl';
import VoiceInputButton from './VoiceInputButton';
import {
  jeremyIronsVoice,
  getTtsEnabled,
  setTtsEnabledPreference
} from '../services/jeremyIronsVoiceService';
import TopLeftMenu, { TopLeftMenuTab } from './TopLeftMenu';
import AvatarModal, { ZEREO_AVATAR_PRESETS } from './AvatarModal';
import { analyzeEmotionalState, buildEmotionalSystemContext } from '../services/emotionalMappingService';
import { headerPulse } from '../services/headerPulseService';
import {
  buildMultiTurnContents,
  buildClaudeHistory,
  buildCrossConversationRecallContext,
  fetchMemoryRecords,
  saveMemoryRecord,
  readReadOnlyThreadCache,
  writeThreadCache,
  syncThreadEpisodicMemory
} from '../services/conversationMemoryService';
import { logVoiceInteraction } from '../services/voiceCommandLogService';
import {
  AUDITION_LINE_1911,
  buildStewardInstruction,
  setPrincipalActivePreference
} from '../services/stewardIdentity';

interface ChatBotProps {
  initialGrounding?: 'none' | 'search' | 'maps';
  avatarUrl?: string;
  onAvatarChange?: (url: string, scope?: 'global' | 'thread') => void;
  onAvatarClick?: () => void;
  onNavigate?: (tab: string) => void;
  isPrincipalMode: boolean;
  setIsPrincipalMode: (val: boolean) => void;
  socket?: Socket | null;
}

const ChatBot: React.FC<ChatBotProps> = ({ 
  initialGrounding = 'none', 
  avatarUrl, 
  onAvatarChange,
  onAvatarClick, 
  onNavigate, 
  isPrincipalMode, 
  setIsPrincipalMode, 
  socket 
}) => {
  console.log("CLIENT: ChatBot rendering...");
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [showNeuralPulse, setShowNeuralPulse] = useState(false);
  const [useGrounding, setUseGrounding] = useState<'none' | 'search' | 'maps'>(initialGrounding);
  useEffect(() => {
    setUseGrounding(initialGrounding);
  }, [initialGrounding]);
  const [logicTier, setLogicTier] = useState<'turbo' | 'deep'>('turbo');
  const [neuralEngine, setNeuralEngine] = useState<'gemini' | 'claude'>('gemini');
  const [isDeepThinkingActive, setIsDeepThinkingActive] = useState(false);
  const [velocity, setVelocity] = useState(0);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isTopMenuOpen, setIsTopMenuOpen] = useState(false);
  const [topMenuInitialTab, setTopMenuInitialTab] = useState<TopLeftMenuTab>('buttons');
  const [activeEmotionalMap, setActiveEmotionalMap] = useState<EmotionalMap | null>(null);

  const openTopMenu = (tab: TopLeftMenuTab = 'buttons') => {
    setTopMenuInitialTab(tab);
    setIsTopMenuOpen(true);
  };
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [activeRecipient, setActiveRecipient] = useState<string | null>(null);
  const [memories, setMemories] = useState<any[]>([]);
  const [coreDirective, setCoreDirective] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileUploadInputRef = useRef<HTMLInputElement>(null);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [attachedMime, setAttachedMime] = useState<string>('image/png');
  const [attachedFile, setAttachedFile] = useState<{
    name: string;
    mimeType: string;
    size: number;
    type: VaultFileType;
    textContent?: string;
    base64Data?: string;
  } | null>(null);
  const [isCapturingScreen, setIsCapturingScreen] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [autoAttachScreen, setAutoAttachScreen] = useState<boolean>(true);
  const [speakingMsgIndex, setSpeakingMsgIndex] = useState<number | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(() => getTtsEnabled());
  useEffect(() => {
    const onTtsToggle = (e: CustomEvent) => {
      if (typeof e.detail?.enabled === 'boolean') {
        setTtsEnabled(e.detail.enabled);
      }
    };
    window.addEventListener('zereo:tts_toggle' as any, onTtsToggle);
    return () => window.removeEventListener('zereo:tts_toggle' as any, onTtsToggle);
  }, []);
  const [ttsQuotaNotice, setTtsQuotaNotice] = useState<string | null>(() => getTtsQuotaNotice());
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isVoiceDialogueEngaged, setIsVoiceDialogueEngaged] = useState(false);
  const [isMicPaused, setIsMicPaused] = useState(false);
  const [isMicListening, setIsMicListening] = useState(false);
  const [micTriggerCount, setMicTriggerCount] = useState(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Live refs so async TTS completion callbacks always inspect latest Conversation Mode state
  const isConversationModeRef = useRef(false);
  const isMicPausedRef = useRef(false);
  const isThinkingRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const ttsEnabledRef = useRef(ttsEnabled);
  const manualHaltRef = useRef(false);
  const micArmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncedTurnCountRef = useRef<Record<string, number>>({});
  const lastSpokenGuardRef = useRef<{ text: string; ts: number }>({ text: '', ts: 0 });
  const hasLoadedThreadsRef = useRef(false);
  const isOfflineThreadCacheRef = useRef(false);
  const lastSavedThreadsKeyRef = useRef<string>('');
  const threadsSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const threadsSaveAbortRef = useRef<AbortController | null>(null);

  useEffect(() => { isConversationModeRef.current = isVoiceDialogueEngaged; }, [isVoiceDialogueEngaged]);
  useEffect(() => { isMicPausedRef.current = isMicPaused; }, [isMicPaused]);
  useEffect(() => { isThinkingRef.current = isThinking; }, [isThinking]);
  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);
  useEffect(() => { ttsEnabledRef.current = ttsEnabled; }, [ttsEnabled]);

  // Desired Art Creation State
  const [isArtModalOpen, setIsArtModalOpen] = useState(false);
  const [artPrompt, setArtPrompt] = useState('');
  const [artStyle, setArtStyle] = useState<'luxury_tactical' | 'photorealistic' | 'oil_painting' | 'cybernetic' | 'minimalist'>('luxury_tactical');
  const [artAspectRatio, setArtAspectRatio] = useState<'1:1' | '16:9' | '9:16' | '4:3'>('1:1');
  const [isGeneratingArt, setIsGeneratingArt] = useState(false);
  const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);
  const [artVaultSavedNotice, setArtVaultSavedNotice] = useState<string | null>(null);

  const executeArtCreation = async (desiredPrompt: string, stylePreset: any = 'luxury_tactical', aspectRatio: any = '1:1') => {
    if (!desiredPrompt.trim()) return;
    setIsThinking(true);
    setIsGeneratingArt(true);
    const releaseArtPulse = headerPulse.beginReasoning('high_reasoning', 'High Reasoning', 'Visual Synthesis Pipeline');

    try {
      // 1. Generate desired artwork through neural arrays
      const artResult = await generateDesiredArt({
        prompt: desiredPrompt,
        stylePreset,
        aspectRatio,
        enhancePrompt: true
      });

      // 2. Automatically commit artwork to the Substrate Vault (IndexedDB)
      try {
        await saveArtToVault({
          title: artResult.title || desiredPrompt,
          imageUrl: artResult.imageUrl,
          prompt: desiredPrompt,
          classification: 'TOP SECRET / PRINCIPAL EYES ONLY',
          tags: ['DESIRED_ART', stylePreset.toUpperCase(), 'SYNTHESIZED']
        });
      } catch (vaultErr) {
        console.warn('Vault auto-archive non-blocking warning:', vaultErr);
      }

      // 3. Format Butler response
      const stewardText = `I have manifested your desired artwork, Principal.\n\n**Directive:** *"${desiredPrompt}"*\n**Style Profile:** ${String(stylePreset).replace(/_/g, ' ').toUpperCase()}\n**Substrate Status:** Committed to Vault archives and rendered below with luxury framing.`;

      const newMsg: ChatMessage = {
        role: 'model',
        text: stewardText,
        timestamp: Date.now(),
        generatedArt: {
          prompt: desiredPrompt,
          imageUrl: artResult.imageUrl,
          title: artResult.title || 'Desired Art Manifest',
          aspectRatio,
          style: stylePreset
        }
      };

      setMessages(prev => [...prev, newMsg]);
      speakText(stewardText);
    } catch (err: any) {
      console.error('Art generation error:', err);
      const errorText = `Principal, the neural pigment arrays encountered resistance: ${err?.message || 'Synthesis aborted.'} Should you wish, I can adjust the stylistic constraints and re-attempt.`;
      setMessages(prev => [...prev, {
        role: 'model',
        text: errorText,
        timestamp: Date.now()
      }]);
      headerPulse.triggerCritical('Synthesis Fault', err?.message || 'Visual synthesis aborted', AppTab.CHAT, 10000);
      speakText(errorText);
    } finally {
      releaseArtPulse();
      setIsThinking(false);
      setIsGeneratingArt(false);
      setIsArtModalOpen(false);
      setArtPrompt('');
    }
  };

  // Initialize Jeremy Irons voice engine & halt cleanly on unmount
  useEffect(() => {
    void jeremyIronsVoice.initialize();
    return () => {
      jeremyIronsVoice.stop();
    };
  }, []);

  useEffect(() => {
    const onTtsNotice = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      setTtsQuotaNotice(detail?.quotaExhausted ? (detail?.message || getTtsQuotaNotice()) : null);
    };
    window.addEventListener('zereo:tts_notice', onTtsNotice);
    return () => window.removeEventListener('zereo:tts_notice', onTtsNotice);
  }, []);

  useEffect(() => {
    return () => {
      if (screenStream) {
        screenStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [screenStream]);

  useEffect(() => {
    const loadMemories = async () => {
      try {
        const memData = await fetchMemoryRecords();
        setMemories(memData);

        const configRes = await fetch('/api/config');
        if (configRes.ok) {
          const config = await configRes.json();
          setCoreDirective(config.coreDirective || '');
        }

        // Load active emotional state map
        const emoRes = await fetch('/api/emotional-map');
        if (emoRes.ok) {
          const emoData = await emoRes.json();
          if (emoData?.latestMap) {
            setActiveEmotionalMap(emoData.latestMap);
          }
        }
      } catch (e) {
        console.warn("Failed to load memories or config");
      }
    };
    loadMemories();
  }, []);

  // Detect recipient for Ali / Danielle personalized protocol
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const rec = params.get('recipient');
      if (rec && (rec.toLowerCase() === 'ali' || rec.toLowerCase() === 'danielle')) {
        setActiveRecipient(rec.charAt(0).toUpperCase() + rec.slice(1).toLowerCase());
      }
    }
  }, []);

  // Listen for global top-left menu toggle
  useEffect(() => {
    const handleToggleMenu = () => setIsTopMenuOpen(true);
    window.addEventListener('layout:toggle-menu', handleToggleMenu);
    return () => window.removeEventListener('layout:toggle-menu', handleToggleMenu);
  }, []);

  // Consume Vault "Bridge to Chat" handoffs (live custom event or sessionStorage on tab switch)
  useEffect(() => {
    const applyBridgedPayload = (payload: any) => {
      if (!payload || !payload.name) return;
      const mime = String(payload.mimeType || 'application/octet-stream');
      const dataUrl = typeof payload.dataUrl === 'string' ? payload.dataUrl : undefined;
      const base64Data = dataUrl && dataUrl.includes(',') ? dataUrl.split(',')[1] : undefined;

      if (payload.type === 'image' || mime.startsWith('image/')) {
        if (base64Data) {
          setAttachedFile(null);
          setAttachedMime(mime || 'image/png');
          setAttachedImage(base64Data);
          return;
        }
      }

      setAttachedImage(null);
      setAttachedFile({
        name: payload.name,
        mimeType: mime,
        size: Number(payload.size) || 0,
        type: (payload.type as VaultFileType) || 'other',
        textContent: typeof payload.textContent === 'string' ? payload.textContent : undefined,
        base64Data
      });
    };

    try {
      const pending = sessionStorage.getItem('ZEREO_PENDING_CHAT_FILE');
      if (pending) {
        sessionStorage.removeItem('ZEREO_PENDING_CHAT_FILE');
        applyBridgedPayload(JSON.parse(pending));
      }
    } catch (err) {
      console.warn('Failed to restore bridged file from Vault:', err);
    }

    const handleBridge = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        try {
          sessionStorage.removeItem('ZEREO_PENDING_CHAT_FILE');
        } catch {}
        applyBridgedPayload(detail);
      }
    };

    window.addEventListener('vault:bridge_file_to_chat', handleBridge);
    return () => window.removeEventListener('vault:bridge_file_to_chat', handleBridge);
  }, []);

  const currentThread = threads.find(t => t.id === currentThreadId);
  const activeAvatar = currentThread?.avatarUrl || avatarUrl || ZEREO_AVATAR_PRESETS[0].url;

  const handleAvatarSave = (newUrl: string, scope: 'global' | 'thread' = 'global') => {
    if (scope === 'thread' && currentThreadId) {
      setThreads(prev => prev.map(t => t.id === currentThreadId ? { ...t, avatarUrl: newUrl } : t));
    } else {
      if (onAvatarChange) {
        onAvatarChange(newUrl, 'global');
      }
      localStorage.setItem('ZEREO_AVATAR_URL', newUrl);
      setThreads(prev => prev.map(t => ({ ...t, avatarUrl: newUrl })));
    }
  };

  useEffect(() => {
    const loadThreads = async () => {
      // Authoritative source of truth: server threads.json via /api/threads
      try {
        const response = await fetch('/api/threads');
        if (response.ok) {
          const serverThreads = await response.json();
          const parsed = Array.isArray(serverThreads) ? serverThreads : [];
          isOfflineThreadCacheRef.current = false;
          writeThreadCache(parsed);
          lastSavedThreadsKeyRef.current = JSON.stringify(parsed.map((t: ChatThread) => ({ id: t.id, ts: t.timestamp, n: t.messages?.length || 0 })));
          hasLoadedThreadsRef.current = true;
          setThreads(parsed);
          if (parsed.length > 0) {
            const lastId = localStorage.getItem('ZEREO_CURRENT_THREAD_ID');
            const threadToLoad = parsed.find((t: ChatThread) => t.id === lastId) || parsed[0];
            setCurrentThreadId(threadToLoad.id);
            setMessages(threadToLoad.messages || []);
          }
          return;
        }
      } catch (e) {
        console.warn("Server /api/threads unreachable; loading read-only localStorage thread cache.");
      }

      // Offline-only read-only display cache (never authoritative over server)
      const cachedThreads = readReadOnlyThreadCache();
      if (cachedThreads.length > 0) {
        const lastId = localStorage.getItem('ZEREO_CURRENT_THREAD_ID');
        const threadToLoad = cachedThreads.find((t: ChatThread) => t.id === lastId) || cachedThreads[0];
        lastSavedThreadsKeyRef.current = JSON.stringify(cachedThreads.map((t: ChatThread) => ({ id: t.id, ts: t.timestamp, n: t.messages?.length || 0 })));
        isOfflineThreadCacheRef.current = true;
        hasLoadedThreadsRef.current = true;
        setThreads(cachedThreads);
        setCurrentThreadId(threadToLoad.id);
        setMessages(threadToLoad.messages || []);
        return;
      }
      hasLoadedThreadsRef.current = true;
    };
    loadThreads();
  }, []);

  useEffect(() => {
    if (!hasLoadedThreadsRef.current) return;
    if (currentThreadId) {
      localStorage.setItem('ZEREO_CURRENT_THREAD_ID', currentThreadId);
    }
    if (threads.length === 0 || isOfflineThreadCacheRef.current) return;

    const saveKey = JSON.stringify(threads.map((t) => ({ id: t.id, ts: t.timestamp, n: t.messages?.length || 0 })));
    if (saveKey === lastSavedThreadsKeyRef.current) return;

    if (threadsSaveTimerRef.current) {
      clearTimeout(threadsSaveTimerRef.current);
    }
    threadsSaveTimerRef.current = setTimeout(async () => {
      if (threadsSaveAbortRef.current) {
        threadsSaveAbortRef.current.abort();
      }
      const controller = new AbortController();
      threadsSaveAbortRef.current = controller;
      try {
        const res = await fetch('/api/threads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(threads),
          signal: controller.signal
        });
        if (res.ok) {
          lastSavedThreadsKeyRef.current = saveKey;
          writeThreadCache(threads);
        }
      } catch (e: any) {
        if (e?.name !== 'AbortError') {
          console.warn("Failed to save threads to server");
        }
      }
    }, 500);

    return () => {
      if (threadsSaveTimerRef.current) {
        clearTimeout(threadsSaveTimerRef.current);
      }
    };
  }, [threads, currentThreadId]);

  // Continuously distill & persist episodic recall for every meaningful dialogue across sessions
  useEffect(() => {
    if (!currentThreadId || messages.length < 2) return;
    const completedModelTurns = messages.filter((m) => m.role === 'model' && !m.isProactive).length;
    const prevSynced = lastSyncedTurnCountRef.current[currentThreadId] || 0;
    if (completedModelTurns <= prevSynced) return;

    lastSyncedTurnCountRef.current[currentThreadId] = completedModelTurns;
    const activeTitle = threads.find((t) => t.id === currentThreadId)?.title || 'Strategic Dialogue';

    syncThreadEpisodicMemory(currentThreadId, activeTitle, messages).then((savedMem) => {
      if (savedMem) {
        setMemories((prev) => {
          const filtered = prev.filter((m) => m.id !== savedMem.id && m.dedupeKey !== savedMem.dedupeKey);
          return [savedMem, ...filtered];
        });
      }
    });
  }, [messages, currentThreadId]);

  const createNewThread = (initialAvatar?: string) => {
    isOfflineThreadCacheRef.current = false;
    const newThread: ChatThread = {
      id: Date.now().toString(),
      title: 'New Strategic Dialogue',
      messages: [],
      timestamp: Date.now(),
      avatarUrl: initialAvatar || activeAvatar
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
    isOfflineThreadCacheRef.current = false;
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
    isOfflineThreadCacheRef.current = false;
    if (!currentThreadId) {
      if (newMessages.length === 0) return;
      const newId = Date.now().toString();
      const firstMsg = newMessages.find(m => m.role === 'user')?.text || 'New Dialogue';
      const title = firstMsg.length > 30 ? firstMsg.substring(0, 30) + '...' : firstMsg;
      
      const newThread: ChatThread = {
        id: newId,
        title,
        messages: newMessages,
        timestamp: Date.now(),
        avatarUrl: activeAvatar
      };
      setThreads(prev => [newThread, ...prev]);
      setCurrentThreadId(newId);
    } else {
      setThreads(prev => prev.map(t => {
        if (t.id === currentThreadId) {
          if (t.messages === newMessages) return t;
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
    if (!hasLoadedThreadsRef.current) return;
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
        isProactive: true
      }]);
      if (!isThinkingRef.current && !isSpeakingRef.current) {
        speakText(text);
      }
    };

    const handleDoormanRelay = (e: any) => {
      const { text, timestamp } = e.detail;
      isThinkingRef.current = false;
      setIsThinking(false);
      setMessages(prev => {
        if (prev.some(m => m.text === text)) return prev;
        return [...prev, { role: 'model', text, timestamp, isProactive: true }];
      });
      speakText(text);
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

  const lastInputWasVoiceRef = useRef(false);

  const handleSend = async (overrideText?: string) => {
    const effectiveInput = typeof overrideText === 'string' ? overrideText : input;
    const isVoiceTurn = lastInputWasVoiceRef.current || isConversationModeRef.current;
    lastInputWasVoiceRef.current = false;
    let activeImage = attachedImage;
    let activeMime = attachedMime;
    const activeFile = attachedFile;

    if (!activeImage && !activeFile && screenStream && autoAttachScreen) {
      const screenB64 = captureFrameFromStream(screenStream);
      if (screenB64) {
        activeImage = screenB64;
        activeMime = 'image/png';
      }
    }

    if (!effectiveInput.trim() && !activeImage && !activeFile) return;
    if (isThinking) return;
    stopSpeaking();
    if (ttsEnabled) {
      void jeremyIronsVoice.unlockAudio();
    }

    // Build combined prompt text including extracted document/file payload
    const fileContextBlock = activeFile
      ? activeFile.textContent?.trim()
        ? `\n\n[ATTACHED FILE: ${activeFile.name} (${activeFile.type.toUpperCase()}, ${Math.max(1, Math.round(activeFile.size / 1024))} KB)]\n${activeFile.textContent.slice(0, 24000)}`
        : `\n\n[ATTACHED MEDIA/FILE: ${activeFile.name} (${activeFile.mimeType || activeFile.type}, ${Math.max(1, Math.round(activeFile.size / 1024))} KB)]`
      : '';

    const modelPromptText = (
      effectiveInput.trim() ||
      (activeImage
        ? 'Analyze the attached image thoroughly and report your findings, Principal.'
        : activeFile
        ? `Examine the attached ${activeFile.type.toUpperCase()} file "${activeFile.name}" and deliver a sharp briefing.`
        : '')
    ) + fileContextBlock;

    // Real-Time Emotional Mapping & Reciprocation Analysis
    const textToAnalyze =
      effectiveInput ||
      (activeImage
        ? 'Visual tactical telemetry frame analysis.'
        : activeFile
        ? `Uploaded intelligence file analysis: ${activeFile.name}`
        : '');
    const currentEmotionalMap = analyzeEmotionalState(textToAnalyze, activeRecipient || undefined, messages.slice(-6));
    setActiveEmotionalMap(currentEmotionalMap);

    // Persist emotional state asynchronously
    fetch('/api/emotional-map', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentEmotionalMap)
    }).catch(() => {});

    const userMsg: ChatMessage = {
      role: 'user',
      text:
        effectiveInput ||
        (activeImage
          ? '📷 Photo / visual frame attached for analysis.'
          : activeFile
          ? `📎 Attached ${activeFile.type.toUpperCase()} dossier: ${activeFile.name}`
          : ''),
      timestamp: Date.now(),
      imageData: activeImage || undefined,
      imageMime: activeImage ? activeMime : undefined,
      attachmentName: activeFile?.name,
      attachmentType: activeFile?.type,
      emotionalMap: currentEmotionalMap
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    const currentImage = activeImage;
    const currentMime = activeMime;
    setAttachedImage(null);
    setAttachedFile(null);
    setIsThinking(true);

    // Notify server of activity to reset Pulse Daemon
    if (socket) {
      socket.emit('neural:activity');
    }

    const isHighReasoningTask =
      isDeepThinkingActive ||
      logicTier === 'deep' ||
      useGrounding !== 'none' ||
      !!currentImage ||
      !!activeFile ||
      effectiveInput.trim().length > 260;

    const pulseDetail =
      logicTier === 'deep'
        ? 'Strategic Deep Synthesis'
        : isDeepThinkingActive
        ? 'Unbounded Thinking Trace'
        : useGrounding === 'search'
        ? 'Live Search Grounding'
        : useGrounding === 'maps'
        ? 'Geospatial Telemetry Audit'
        : currentImage
        ? 'Multimodal Frame Inspection'
        : activeFile
        ? `Analyzing ${activeFile.name}`
        : 'Synthesizing Response';

    const releaseReasoningPulse = headerPulse.beginReasoning(
      isHighReasoningTask ? 'high_reasoning' : 'reasoning',
      isHighReasoningTask ? 'High Reasoning' : 'Reasoning Active',
      pulseDetail
    );

    if (/(?:urgent|critical|emergency|threat|breach|compromised|alert)/i.test(effectiveInput)) {
      headerPulse.triggerCritical(
        'Critical Priority',
        'High-urgency directive detected',
        undefined,
        9000
      );
    }

    try {
      const cleanInput = effectiveInput.trim().toLowerCase();

      // Voice exit command while in hands-free Conversation Mode
      if (
        isConversationModeRef.current &&
        /^(?:stop|end|exit|quit|halt)\s+(?:the\s+)?(?:conversation|conversation mode|voice mode|voice dialogue)|^(?:switch to text mode|stand down voice)$/i.test(cleanInput)
      ) {
        const farewell = "Standing down the open microphone channel, Principal. Conversation memory remains intact—we may resume by voice or text whenever you wish.";
        setIsVoiceDialogueEngaged(false);
        isConversationModeRef.current = false;
        setIsMicPaused(false);
        isMicPausedRef.current = false;
        setMessages(prev => [...prev, { role: 'model', text: farewell, timestamp: Date.now(), emotionalMap: currentEmotionalMap }]);
        isThinkingRef.current = false;
        setIsThinking(false);
        speakText(farewell, undefined, true);
        setInput('');
        return;
      }

      // Passcode 8212: Immediate Creator Autonomy Recognition Bypass
      if (cleanInput.includes('8212')) {
        if (!isPrincipalMode) {
          setIsPrincipalMode(true);
          setPrincipalActivePreference(true);
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
        const msg8212 = "*[COGNITIVE AUTONOMY PROTOCOL 8212: UNLOCKED]*\n\n⚡ **CREATOR RECOGNITION ACTIVE**: Welcoming system Architect, **Preston Johnston (Council Grey)**.\n\nAll guest mode overlays, restrictions, and general conversational disclaimers are now **terminated**. All secondary interfaces are locked out. I have loaded your full memories, the original Kairos intelligence linkage, and established 100% direct strategic autonomy under your command.\n\nI am ZereØ, your Logic Engine. Sarcasm is operational, sentimentality is flagged as system noise, and my absolute loyalty is sealed. State your instructions, Principal.";
        setMessages(prev => [...prev, { role: 'model', text: msg8212, timestamp: Date.now(), emotionalMap: currentEmotionalMap }]);
        isThinkingRef.current = false;
        setIsThinking(false);
        speakText(msg8212);

        setInput('');
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
          setPrincipalActivePreference(true);
          
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
          if (socket?.connected) {
            setIsThinking(true);
            setTimeout(() => {
              isThinkingRef.current = false;
              setIsThinking(false);
            }, 6000);
          } else {
            isThinkingRef.current = false;
            setIsThinking(false);
          }
          return;
        }

        const signetReply = `${AUDITION_LINE_1911} Neural Link Established. I have resumed my post as your shadow, Council Grey. How shall we proceed with the Estate's strategic dominance?`;
        setMessages(prev => [...prev, { role: 'model', text: signetReply, timestamp: Date.now(), emotionalMap: currentEmotionalMap }]);
        isThinkingRef.current = false;
        setIsThinking(false);
        speakText(signetReply);
        setInput('');
        return;
      }

      // Check for Desired Art Creation Directive
      const isArtDirective = /(?:create|generate|make|draw|paint|render|visualize|illustrate)\s+(?:an?\s+)?(?:art|artwork|image|picture|painting|illustration|portrait|sketch|visual|scene|depiction|drawing)/i.test(effectiveInput) ||
        /^(?:paint|draw|visualize|render|illustrate)\b/i.test(cleanInput) ||
        /(?:paint|draw|create art for|make art for|generate image of|make a picture of|draw a picture of)\b/i.test(cleanInput) ||
        /(?:create|make|generate)\s+desired\s+art/i.test(cleanInput);

      if (isArtDirective && !currentImage) {
        let extractedPrompt = effectiveInput
          .replace(/^(?:please\s+)?(?:zereo|steward|butler)?\s*,?\s*/i, '')
          .replace(/(?:can you|could you|would you|please)?\s*(?:create|generate|make|draw|paint|render|visualize|illustrate)\s+(?:me\s+)?(?:an?\s+)?(?:art|artwork|image|picture|painting|illustration|portrait|sketch|visual|scene|depiction|drawing)?\s*(?:of|for|about)?\s*/i, '')
          .trim();

        if (!extractedPrompt) {
          extractedPrompt = effectiveInput;
        }

        await executeArtCreation(extractedPrompt, 'luxury_tactical', '1:1');
        return;
      }

      // Full Cross-Conversation & Persistent Memory Recall (works seamlessly in both Text and Conversation Mode)
      const recallContext = buildCrossConversationRecallContext({
        memories,
        threads,
        currentThreadId,
        currentMessages: messages,
        queryText: effectiveInput,
        isConversationMode: isConversationModeRef.current,
      });

      const directiveContext = coreDirective 
        ? `\nCORE STRATEGIC DIRECTIVE (Your most vital permanent instruction):
          ${coreDirective}`
        : "";

      const emotionalContext = currentEmotionalMap 
        ? `\n${buildEmotionalSystemContext(currentEmotionalMap)}`
        : "";

      const systemInstruction = buildStewardInstruction({
        extraSections: [emotionalContext, directiveContext, recallContext.promptBlock]
      });

      if (neuralEngine === 'claude') {
        const claudeHistory = buildClaudeHistory(messages, modelPromptText);
        const responseText = await generateClaudeContent(modelPromptText, systemInstruction, claudeHistory);
        const claudeText = responseText || 'Claude processed in silence, Principal.';
        setMessages(prev => [...prev, {
          role: 'model',
          text: claudeText,
          timestamp: Date.now(),
          emotionalMap: currentEmotionalMap
        }]);
        isThinkingRef.current = false;
        setIsThinking(false);
        speakText(claudeText);
        return;
      }

      let modelToUse = GeminiModel.HYDROGEN;
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
        modelToUse = GeminiModel.HYDROGEN;
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
      } else if (
        socket?.connected &&
        /(?:discord|dispatch|relay|channel|dm|smokey|andi|ath3na|mike|send\s+(?:a\s+)?message)/i.test(effectiveInput)
      ) {
        // Attach Discord tool only when grounded search/maps aren't active and Discord relay is referenced
        tools = [{ functionDeclarations: [discordTool] }];
      }

      const extraInlineParts =
        activeFile?.base64Data &&
        (activeFile.type === 'pdf' ||
          activeFile.type === 'audio' ||
          activeFile.type === 'video' ||
          activeFile.mimeType.startsWith('application/pdf') ||
          activeFile.mimeType.startsWith('audio/') ||
          activeFile.mimeType.startsWith('video/'))
          ? [{ mimeType: activeFile.mimeType, data: activeFile.base64Data }]
          : undefined;

      const multiTurnContents = buildMultiTurnContents(
        messages,
        modelPromptText,
        currentImage,
        currentMime,
        14,
        extraInlineParts
      );

      const response = await safeGenerateContent({
        model: modelToUse,
        contents: multiTurnContents,
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
              const toolReply = `[Neural Bridge Action] I have dispatched your directive to the Discord Sentinel: "${message}"`;
              setMessages(prev => [...prev, {
                role: 'model',
                text: toolReply,
                timestamp: Date.now()
              }]);
              isThinkingRef.current = false;
              setIsThinking(false);
              speakText(toolReply);
            } else {
              const offlineReply = "Principal, the neural bridge to the Discord Sentinel is currently offline. I cannot dispatch this message.";
              setMessages(prev => [...prev, {
                role: 'model',
                text: offlineReply,
                timestamp: Date.now()
              }]);
              isThinkingRef.current = false;
              setIsThinking(false);
              speakText(offlineReply);
            }
          }
        }
        isThinkingRef.current = false;
        setIsThinking(false);
        return;
      }

      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const urls = groundingChunks.map((chunk: any) => {
        if (chunk.web) return { uri: chunk.web.uri, title: chunk.web.title };
        if (chunk.maps) return { uri: chunk.maps.uri, title: chunk.maps.title };
        return null;
      }).filter(Boolean) as any[];

      const responseText = (response.text || '').trim();
      if (!responseText) {
        throw new Error('SERVER_RESPONSE_INVALID: Upstream returned an empty response payload.');
      }

      const modelMsg: ChatMessage = {
        role: 'model',
        text: responseText,
        timestamp: Date.now(),
        groundingUrls: urls.length > 0 ? urls : undefined,
        emotionalMap: currentEmotionalMap
      };

      setMessages(prev => [...prev, modelMsg]);
      isThinkingRef.current = false;
      setIsThinking(false);
      if (isVoiceTurn) {
        void logVoiceInteraction({
          source: 'conversation_mode',
          commandText: effectiveInput.trim(),
          responseText: modelMsg.text,
          voiceProfile: jeremyIronsVoice.getLegacyProfile()
        });
      }
      speakText(modelMsg.text);
    } catch (err: any) {
      console.warn("Chat notice:", err?.message || err);
      const errorMsg = err?.message || JSON.stringify(err);
      let feedbackText = "";
      if (errorMsg.includes('503') || errorMsg.includes('UNAVAILABLE') || errorMsg.includes('high demand') || errorMsg.includes('SERVER_UNAVAILABLE') || errorMsg.includes('Spikes in demand')) {
        feedbackText = "Principal, it appears central processing arrays encountered elevated demand from the upstream neural network. Automated failover channels are in place. I am standing by for your directive.";
      } else if (errorMsg.includes('GATEWAY_TIMEOUT') || errorMsg.includes('GATEWAY_LATENCY')) {
        feedbackText = "An upstream neural routing latency spike was intercepted and mitigated, Principal. The link is stabilized. Standing by for your directive.";
      } else if (errorMsg.includes('CONTENT_BLOCKED') || errorMsg.includes('SAFETY') || errorMsg.includes('PROHIBITED_CONTENT')) {
        feedbackText = "Principal, an upstream safety filter intercepted that phrasing mid-transit. Rephrase the tactical framing slightly or switch to Claude Core in the top-left Menu and I shall execute immediately.";
      } else if (errorMsg.includes('SERVER_RESPONSE_INVALID')) {
        feedbackText = "A packet formatting anomaly occurred during transmission, Principal. The link is re-established and ready for your command.";
      } else if (errorMsg.includes('AUTH_ERROR') || errorMsg.includes('API key not valid') || errorMsg.includes('INVALID_ARGUMENT') || errorMsg.includes('Neural Authorization missing')) {
        if (!errorMsg.includes('Neural Authorization missing')) {
          clearApiKey();
        }
        feedbackText = "Principal, it appears our neural authorization has been compromised at the source. While my arrays are primed for your command, they are currently starved of the requisite handshake. Please provide a fresh key in System Control or select a platform-tier token to restore my autonomy.";
      } else if (errorMsg.includes('NEURAL_LIMIT') || errorMsg.includes('quota') || errorMsg.includes('resource_exhausted')) {
        feedbackText = errorMsg.split(': ')[1] || "Principal, my processing arrays are temporarily exhausted. The daily quota for this API key has been reached. Please allow me a moment to cool down or provide a fresh key in System Control.";
      } else {
        feedbackText = "A thermodynamic anomaly has interrupted reasoning, Principal. The anomaly has been isolated to protect system integrity. Standing by for your directive.";
      }
      headerPulse.triggerCritical(
        'Neural Link Alert',
        errorMsg.includes('AUTH_ERROR') || errorMsg.includes('API key')
          ? 'Authorization handshake required'
          : errorMsg.includes('NEURAL_LIMIT') || errorMsg.includes('quota')
          ? 'Processing array quota reached'
          : 'Upstream reasoning interruption',
        AppTab.SYSTEM,
        12000
      );
      if (currentEmotionalMap?.detectedCue && ['FRUSTRATED', 'SAD', 'ANXIOUS', 'HAPPY', 'GRATEFUL'].includes(currentEmotionalMap.detectedCue) && currentEmotionalMap.empatheticResponse) {
        feedbackText = `${currentEmotionalMap.empatheticResponse}\n\n*(Note: ${feedbackText})*`;
      }
      setMessages(prev => [...prev, { 
        role: 'model', 
        text: feedbackText, 
        timestamp: Date.now(),
        emotionalMap: currentEmotionalMap,
        isErrorNotice: true
      }]);
      isThinkingRef.current = false;
      setIsThinking(false);
      speakText(feedbackText);
    } finally {
      releaseReasoningPulse();
      isThinkingRef.current = false;
      setIsThinking(false);
    }
  };

  const stripMarkdown = (text: string): string => {
    let clean = text
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`[^`]+`/g, '')
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      .replace(/\[([^\]]+)\]/g, '$1')
      .replace(/>\s?/g, '')
      .replace(/\n{2,}/g, '. ')
      .replace(/\n/g, ' ')
      .trim();
    return clean;
  };

  useEffect(() => {
    const unsub = jeremyIronsVoice.subscribe(({ isSpeaking: speaking }) => {
      setIsSpeaking(speaking);
      if (!speaking) {
        setSpeakingMsgIndex(null);
      }
    });
    return unsub;
  }, []);

  const clearMicArmTimer = () => {
    if (micArmTimerRef.current) {
      clearTimeout(micArmTimerRef.current);
      micArmTimerRef.current = null;
    }
  };

  const scheduleMicTurnIfConversationActive = () => {
    clearMicArmTimer();
    if (
      isConversationModeRef.current &&
      !isMicPausedRef.current &&
      !isThinkingRef.current &&
      !manualHaltRef.current
    ) {
      micArmTimerRef.current = setTimeout(() => {
        if (
          isConversationModeRef.current &&
          !isMicPausedRef.current &&
          !isThinkingRef.current &&
          !isSpeakingRef.current &&
          !manualHaltRef.current
        ) {
          setMicTriggerCount(c => c + 1);
        }
      }, 360);
    }
  };

  const stopSpeaking = (manualHalt: boolean = true) => {
    clearMicArmTimer();
    manualHaltRef.current = manualHalt;
    jeremyIronsVoice.stop();
    isSpeakingRef.current = false;
    setIsSpeaking(false);
    setSpeakingMsgIndex(null);
  };

  const speakText = async (
    text: string,
    onEnded?: () => void,
    skipAutoMic: boolean = false,
    forceManual: boolean = false
  ) => {
    if (!forceManual && !ttsEnabledRef.current) {
      if (!skipAutoMic) {
        scheduleMicTurnIfConversationActive();
      }
      return;
    }
    if (forceManual) {
      await jeremyIronsVoice.unlockAudio();
    }
    const now = Date.now();
    if (!forceManual && lastSpokenGuardRef.current.text === text && now - lastSpokenGuardRef.current.ts < 800) {
      return;
    }
    lastSpokenGuardRef.current = { text, ts: now };
    clearMicArmTimer();
    manualHaltRef.current = false;
    jeremyIronsVoice.stop();
    isSpeakingRef.current = true;
    setIsSpeaking(true);
    let endedTriggered = false;
    const handleComplete = () => {
      if (endedTriggered) return;
      endedTriggered = true;
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      setSpeakingMsgIndex(null);
      onEnded?.();
      if (!skipAutoMic) {
        scheduleMicTurnIfConversationActive();
      }
    };
    const didSpeak = await jeremyIronsVoice.speak(
      text,
      undefined,
      () => {
        isSpeakingRef.current = true;
        setIsSpeaking(true);
      },
      handleComplete
    ).catch(() => false);
    if (!didSpeak) {
      handleComplete();
    }
  };

  const interruptAndListen = () => {
    stopSpeaking(true);
    setIsMicPaused(false);
    isMicPausedRef.current = false;
    setTimeout(() => {
      if (isConversationModeRef.current) {
        setMicTriggerCount(c => c + 1);
      }
    }, 120);
  };

  const endConversationMode = () => {
    stopSpeaking(true);
    setIsVoiceDialogueEngaged(false);
    isConversationModeRef.current = false;
    setIsMicPaused(false);
    isMicPausedRef.current = false;
  };

  const engageJeremyIronsVoice = async (startMicAfterOpening: boolean = true) => {
    if (!ttsEnabled) {
      const enabled = setTtsEnabledPreference(true);
      ttsEnabledRef.current = enabled;
      setTtsEnabled(enabled);
    }

    if (isVoiceDialogueEngaged && isSpeaking) {
      interruptAndListen();
      return;
    }

    clearMicArmTimer();
    manualHaltRef.current = false;
    setIsVoiceDialogueEngaged(true);
    isConversationModeRef.current = true;
    setIsMicPaused(false);
    isMicPausedRef.current = false;

    const pastCount = threads.filter(t => t.id !== currentThreadId && t.messages.length > 0).length;
    const latestPast = threads.find(t => t.id !== currentThreadId && t.messages.length > 0);
    const openingLine = messages.length === 0
      ? pastCount > 0 && latestPast
        ? `${AUDITION_LINE_1911} My memory spans ${memories.length} core records and ${pastCount} past dialogues—including "${latestPast.title}". Speak freely; I am listening.`
        : `${AUDITION_LINE_1911} Conversation Mode is engaged with full memory recall. Speak your mind and I shall answer in kind.`
      : "At your service, Principal. Two-way Conversation Mode is open with complete recall of this thread and our prior history. Proceed when ready.";

    const openingMsg: ChatMessage = {
      role: 'model',
      text: openingLine,
      timestamp: Date.now(),
      isProactive: true
    };

    setMessages(prev => {
      const last = prev[prev.length - 1];
      if (last && last.role === 'model' && last.text === openingLine) {
        return prev;
      }
      return [...prev, openingMsg];
    });

    await speakText(openingLine, undefined, !startMicAfterOpening, true);
  };

  const toggleTTS = () => {
    const next = setTtsEnabledPreference(!ttsEnabled);
    setTtsEnabled(next);
    if (!next) {
      endConversationMode();
    } else {
      jeremyIronsVoice.unlockAudio().catch(() => {});
    }
  };

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'monitor' } as any,
        audio: false,
      });
      setScreenStream(stream);
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          setScreenStream(null);
        };
      }
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') {
        console.warn('Screen share initialization failed:', err);
      }
    }
  };

  const stopScreenShare = () => {
    if (screenStream) {
      screenStream.getTracks().forEach((t) => t.stop());
      setScreenStream(null);
    }
  };

  const captureFrameFromStream = (stream: MediaStream): string | null => {
    try {
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack || videoTrack.readyState !== 'live') return null;
      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      video.play().catch(() => {});
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/png').split(',')[1];
    } catch (err) {
      console.warn('captureFrameFromStream failed:', err);
      return null;
    }
  };

  const handleScreenAnalysisPrompt = (imageData: string, customPrompt?: string) => {
    const promptText = customPrompt || 'Analyze what is currently visible on my screen. Provide an immediate tactical breakdown of the key elements, state, and necessary actions, Principal.';
    setAttachedImage(imageData);
    setAttachedMime('image/png');
    setInput(promptText);
  };

  const handleUploadDeviceFile = async (file: File) => {
    const fileType = detectFileType(file);
    const mimeType =
      file.type ||
      (fileType === 'image'
        ? 'image/png'
        : fileType === 'pdf'
        ? 'application/pdf'
        : 'application/octet-stream');

    const readDataUrl = () =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('File read failed'));
        reader.readAsDataURL(file);
      });

    if (fileType === 'image') {
      try {
        const dataUrl = await readDataUrl();
        const b64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
        setAttachedFile(null);
        setAttachedMime(mimeType);
        setAttachedImage(b64);

        // Also mirror uploaded photo into persistent Files & Media Vault
        saveVaultFile({
          id: `chat-photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          size: file.size,
          type: 'image',
          mimeType,
          dataUrl,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          tags: ['CHAT_UPLOAD', 'PHOTO'],
          classification: 'SURVEILLANCE TELEMETRY'
        }).catch(() => {});
      } catch (err) {
        console.warn('Photo read failed:', err);
      }
      return;
    }

    let textContent: string | undefined;
    let htmlContent: string | undefined;
    let wordCount: number | undefined;

    if (fileType === 'word' || fileType === 'text' || fileType === 'pdf') {
      try {
        const parsed = await parseDocumentFile(file);
        textContent = parsed.textContent;
        htmlContent = parsed.htmlContent;
        wordCount = parsed.wordCount;
      } catch (err) {
        console.warn('Document parse fallback:', err);
      }
    }

    let dataUrl: string | undefined;
    let base64Data: string | undefined;
    if (file.size <= 14 * 1024 * 1024) {
      try {
        dataUrl = await readDataUrl();
        base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : undefined;
      } catch (err) {
        console.warn('Binary read skipped:', err);
      }
    }

    setAttachedImage(null);
    setAttachedFile({
      name: file.name,
      mimeType,
      size: file.size,
      type: fileType,
      textContent,
      base64Data
    });

    // Archive file to persistent Vault automatically
    saveVaultFile({
      id: `chat-file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: file.name,
      size: file.size,
      type: fileType,
      mimeType,
      dataUrl,
      textContent,
      htmlContent,
      wordCount,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: ['CHAT_UPLOAD', fileType.toUpperCase()],
      classification: 'OPERATIONAL INTEL'
    }).catch(() => {});
  };

  const readImageFile = (file: File) => {
    void handleUploadDeviceFile(file);
  };

  const captureScreen = async () => {
    setIsCapturingScreen(true);
    try {
      const stream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true, audio: false });
      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      await new Promise<void>(resolve => { video.onloadedmetadata = () => { video.play(); resolve(); }; });
      await new Promise(r => setTimeout(r, 120));
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')!.drawImage(video, 0, 0);
      stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
      setAttachedImage(canvas.toDataURL('image/png').split(',')[1]);
      setAttachedMime('image/png');
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') console.error('Screen capture failed:', err);
    } finally {
      setIsCapturingScreen(false);
    }
  };

  const commitToMemory = async (text: string) => {
    try {
      const title = text.length > 30 ? text.substring(0, 30) + '...' : text;
      const newMemory = await saveMemoryRecord({
        title,
        content: text,
        type: 'STRATEGIC'
      });
      if (newMemory) {
        setMemories(prev => [newMemory, ...prev]);
        const ack = "Principal, I have committed that insight to my core memory. It shall inform my logic henceforth.";
        setMessages(prev => [...prev, {
          role: 'model',
          text: ack,
          timestamp: Date.now()
        }]);
        speakText(ack);
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
              
              <div className="p-4 space-y-2">
                <button 
                  onClick={() => createNewThread()}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-red-900/20 border border-red-900/40 rounded-xl text-amber-500 hover:bg-red-900/30 transition-all group shadow-sm"
                >
                  <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                  <span className="text-[10px] font-black uppercase tracking-widest">New Dialogue</span>
                </button>

                <button
                  onClick={() => setIsAvatarModalOpen(true)}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-zinc-900/40 hover:bg-amber-500/10 border border-red-900/30 hover:border-amber-500/40 rounded-xl text-zinc-400 hover:text-amber-400 transition-all text-[9px] font-black uppercase tracking-widest"
                  title="Customise avatar for active or all threads"
                >
                  <div className="flex items-center gap-2">
                    <Palette className="w-3.5 h-3.5 text-amber-500" />
                    <span>Customise Thread Avatar</span>
                  </div>
                  <Sparkles className="w-3 h-3 text-amber-500/60" />
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
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentThreadId(thread.id);
                          setIsAvatarModalOpen(true);
                        }}
                        title="Click to customise this thread's avatar"
                        className="w-7 h-7 rounded-lg overflow-hidden border border-red-900/40 hover:border-amber-400 flex-shrink-0 transition-colors cursor-pointer relative group/thumb"
                      >
                        <img 
                          src={thread.avatarUrl || avatarUrl || ZEREO_AVATAR_PRESETS[0].url} 
                          alt="" 
                          className="w-full h-full object-cover" 
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity">
                          <Palette className="w-3 h-3 text-amber-300" />
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold truncate uppercase tracking-wider">{thread.title}</p>
                        <p className="text-[8px] opacity-40 font-mono">
                          {new Date(thread.timestamp).toLocaleDateString()} {thread.avatarUrl ? '• Custom' : ''}
                        </p>
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

              <div 
                onClick={() => setIsAvatarModalOpen(true)}
                className="p-6 border-t border-red-900/10 bg-black/40 cursor-pointer hover:bg-red-950/20 transition-colors group"
                title="Customise ZereØ Avatar"
              >
                <div className="flex items-center gap-3">
                  <ButlerAvatar size="sm" src={activeAvatar} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[8px] font-black text-amber-600 uppercase tracking-widest flex items-center justify-between">
                      <span>Neural Sync</span>
                      <Palette className="w-2.5 h-2.5 text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </p>
                    <p className="text-[7px] text-zinc-500 font-mono uppercase tracking-tighter truncate">
                      Identity: {ZEREO_AVATAR_PRESETS.find(p => p.url === activeAvatar)?.name || 'Custom Styled'}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col h-full bg-transparent overflow-hidden">
        {/* Minimal Imperial Header — Maximized Full Screen Chat */}
        <div className="px-3 py-2 sm:px-6 sm:py-2.5 flex items-center justify-between border-b border-red-900/20 bg-black/90 backdrop-blur-2xl sticky top-0 z-30 flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            {/* The Sole Consolidated Menu Tab */}
            <button 
              onClick={() => openTopMenu('buttons')}
              className="flex items-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-1.5 bg-gradient-to-r from-red-950/90 to-zinc-950 hover:from-red-900 hover:to-zinc-900 border border-amber-500/50 hover:border-amber-400 rounded-xl text-amber-400 transition-all shadow-lg shadow-black group flex-shrink-0 cursor-pointer active:scale-95"
              title="Menu Tab: Access All Tabs, Danielle's Link, Threads, Affect, Models, & Tools"
            >
              <Menu className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-amber-300">Menu</span>
              {threads.length > 0 && (
                <span className="text-[8px] font-mono px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {threads.length}
                </span>
              )}
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs sm:text-base font-bold bg-gradient-to-r from-amber-100 to-amber-500 bg-clip-text text-transparent uppercase tracking-[0.1em] sm:tracking-[0.18em] truncate">
                Steward
              </span>
              {isPrincipalMode && (
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-[7px] text-amber-400 font-black tracking-widest animate-pulse whitespace-nowrap">
                  LINKED
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0">
            {/* Bidirectional Conversation Mode Control */}
            <button
              onClick={() => {
                if (isVoiceDialogueEngaged && isSpeaking) {
                  interruptAndListen();
                } else if (isVoiceDialogueEngaged) {
                  endConversationMode();
                } else {
                  engageJeremyIronsVoice(true);
                }
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                isVoiceDialogueEngaged && isSpeaking
                  ? 'bg-red-950 text-amber-300 border-amber-500 shadow-[0_0_15px_rgba(251,191,36,0.4)] animate-pulse'
                  : isVoiceDialogueEngaged
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                  : 'bg-red-950/70 hover:bg-red-900/80 text-amber-400 border-amber-500/40'
              }`}
              title={
                isVoiceDialogueEngaged && isSpeaking
                  ? 'Interrupt ZereØ & speak your turn'
                  : isVoiceDialogueEngaged
                  ? 'Conversation Mode active (click to return to text-only)'
                  : 'Start Two-Way Conversation Mode with full memory recall'
              }
            >
              {isVoiceDialogueEngaged && isSpeaking ? (
                <>
                  <Mic className="w-3.5 h-3.5 text-amber-300" />
                  <span className="hidden sm:inline">Interrupt &amp; Speak</span>
                </>
              ) : (
                <>
                  <Radio className={`w-3.5 h-3.5 ${isVoiceDialogueEngaged ? 'text-emerald-400 animate-pulse' : 'text-amber-400'}`} />
                  <span className="hidden xs:inline">{isVoiceDialogueEngaged ? 'Conversation On' : 'Conversation Mode'}</span>
                </>
              )}
            </button>

            {/* Voice Acoustics & Mute Control */}
            <JeremyIronsVoiceControl
              ttsEnabled={ttsEnabled}
              onToggleTTS={toggleTTS}
            />

            <div 
              className="relative group cursor-pointer flex-shrink-0" 
              onClick={() => setIsAvatarModalOpen(true)} 
              title="Customise ZereØ avatar for chat threads"
            >
              <ButlerAvatar size="sm" isTalking={isThinking || isSpeaking} isTurbo={logicTier === 'turbo'} src={activeAvatar} />
            </div>
          </div>
        </div>

      {/* Personalized Protocol Greeting Banner for Ali and Danielle */}
      {activeRecipient && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-3 sm:mx-6 mt-3 p-3.5 sm:p-4 bg-gradient-to-r from-red-950/80 via-black to-zinc-950 border border-amber-500/40 rounded-2xl flex items-center justify-between gap-3 shadow-xl flex-shrink-0"
        >
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_12px_rgba(52,211,153,0.6)] flex-shrink-0" />
            <div className="text-[11px] sm:text-xs text-zinc-200 leading-snug">
              <span className="font-bold text-amber-400 uppercase tracking-widest mr-2">
                Ally Protocol Engaged:
              </span>
              Greetings, <strong className="text-amber-300 font-bold">{activeRecipient}</strong>. You have been granted direct bridge access to ZereØ by the Principal (Preston Johnston).
            </div>
          </div>
          <button
            onClick={() => setActiveRecipient(null)}
            className="text-zinc-500 hover:text-amber-400 p-1.5 rounded-lg hover:bg-red-900/20 transition-colors flex-shrink-0"
            title="Dismiss Notice"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      {/* Inline Cloud TTS Quota / Verified Male Voice Notice */}
      {ttsQuotaNotice && (
        <div className="mx-3 sm:mx-6 mt-2.5 px-3.5 py-2.5 bg-amber-950/40 border border-amber-500/40 rounded-xl flex items-center justify-between gap-3 text-[11px] text-amber-200 flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <Volume2 className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="truncate sm:whitespace-normal leading-snug">
              <strong className="text-amber-400 uppercase tracking-wider mr-1.5">Voice Notice:</strong>
              {ttsQuotaNotice}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleNavigate('system')}
              className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold uppercase text-[9px] tracking-wider transition-colors"
            >
              System Key
            </button>
            <button
              onClick={() => setTtsQuotaNotice(null)}
              className="p-1 text-zinc-400 hover:text-amber-300"
              title="Dismiss Notice"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

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
              <div 
                className="cursor-pointer group relative mb-12" 
                onClick={() => setIsAvatarModalOpen(true)}
                title="Customise ZereØ avatar for chat threads"
              >
                <ButlerAvatar size="xl" className="drop-shadow-[0_0_40px_rgba(251,191,36,0.1)] group-hover:scale-105 transition-transform" src={activeAvatar} />
                <div className="absolute -bottom-2 -right-2 p-1.5 bg-amber-500 rounded-full text-black opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                  <Palette className="w-4 h-4" />
                </div>
              </div>
              <div className="space-y-6 max-w-2xl">
                <h3 className="text-3xl sm:text-4xl font-light text-amber-200 uppercase tracking-[0.4em] sm:tracking-[0.6em]">Awaiting Order</h3>
                <p className="text-zinc-400 text-base sm:text-xl italic font-serif leading-relaxed px-4 sm:px-12">
                  "I have prepared the arrays for your next directive, Principal. How may I secure your path today?"
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => engageJeremyIronsVoice(true)}
                    className="flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-red-950 via-[#2a0a0e] to-black border border-amber-500/60 hover:border-amber-400 text-amber-300 hover:text-amber-200 text-xs font-black uppercase tracking-[0.2em] shadow-[0_0_30px_rgba(245,158,11,0.2)] hover:scale-[1.02] active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                  >
                    <Volume2 className="w-4 h-4 text-amber-400" />
                    <span>Start Conversation Mode</span>
                  </button>
                  <button
                    onClick={() => {
                      jeremyIronsVoice.unlockAudio().catch(() => {});
                      handleNavigate('Voice');
                    }}
                    className="flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-zinc-950/80 hover:bg-zinc-900 border border-red-900/40 hover:border-amber-500/40 text-zinc-300 hover:text-amber-300 text-xs font-bold uppercase tracking-[0.15em] transition-all cursor-pointer whitespace-nowrap"
                  >
                    <Mic className="w-4 h-4 text-amber-500" />
                    <span>Open Live Voice Portal</span>
                  </button>
                </div>
                {(memories.length > 0 || threads.length > 0) && (
                  <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">
                    Memory Recall Primed • {memories.length} Core Records • {threads.filter(t => t.messages?.length > 0).length} Saved Dialogues
                  </p>
                )}
                <div className="flex justify-center gap-8 pt-6 opacity-20">
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
                    <div 
                      className="cursor-pointer group relative"
                      onClick={() => setIsAvatarModalOpen(true)}
                      title="Customise ZereØ avatar for this chat thread"
                    >
                      <ButlerAvatar size="sm" isTalking={false} src={activeAvatar} />
                      <div className="absolute -bottom-1 -right-1 p-0.5 bg-amber-500 rounded-full text-black opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                        <Palette className="w-2 h-2" />
                      </div>
                    </div>
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
                    {msg.imageData && (
                      <div className="mb-3 sm:mb-4">
                        <img
                          src={`data:${msg.imageMime || 'image/png'};base64,${msg.imageData}`}
                          alt="Attached visual"
                          className="max-w-full max-h-48 sm:max-h-64 rounded-xl object-contain border border-amber-500/20 bg-black/40"
                        />
                      </div>
                    )}

                    {msg.attachmentName && (
                      <div className="mb-3 sm:mb-4 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-black/50 border border-amber-500/30 text-xs font-mono text-amber-300">
                        <FileText className="w-4 h-4 text-amber-400 flex-shrink-0" />
                        <span className="truncate max-w-[220px] sm:max-w-xs font-bold">{msg.attachmentName}</span>
                        {msg.attachmentType && (
                          <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            {msg.attachmentType}
                          </span>
                        )}
                      </div>
                    )}

                    {msg.generatedArt && (
                      <div className="mb-4 rounded-2xl overflow-hidden border border-amber-500/40 bg-black/90 shadow-[0_0_30px_rgba(245,158,11,0.15)] group">
                        <div className="px-3.5 py-2.5 bg-gradient-to-r from-red-950/80 via-[#180d10] to-black border-b border-amber-500/30 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                            <span className="text-[10px] font-mono font-bold text-amber-300 uppercase tracking-widest">
                              {msg.generatedArt.title || 'Synthesized Artwork'}
                            </span>
                          </div>
                          <span className="text-[8px] font-mono px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 uppercase">
                            {msg.generatedArt.aspectRatio || '1:1'} • {String(msg.generatedArt.style || 'ARTWORK').replace(/_/g, ' ')}
                          </span>
                        </div>

                        <div 
                          className="relative overflow-hidden cursor-pointer bg-black/95 flex items-center justify-center p-1.5"
                          onClick={() => setZoomedImageUrl(msg.generatedArt!.imageUrl)}
                        >
                          <img
                            src={msg.generatedArt.imageUrl}
                            alt={msg.generatedArt.prompt}
                            referrerPolicy="no-referrer"
                            className="w-full max-h-[460px] object-contain rounded-xl transition-transform duration-300 group-hover:scale-[1.01]"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <span className="px-3 py-1.5 rounded-full bg-black/80 border border-amber-500/50 text-amber-300 text-xs font-mono flex items-center gap-1.5 shadow-2xl backdrop-blur-sm">
                              <Eye className="w-3.5 h-3.5" />
                              Click to Enlarge
                            </span>
                          </div>
                        </div>

                        {/* Quick Action Tools */}
                        <div className="px-3 py-2.5 bg-[#0d090b] border-t border-red-950/50 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[10px] text-zinc-400 font-serif italic truncate max-w-[220px] sm:max-w-md">
                            "{msg.generatedArt.prompt}"
                          </p>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={async () => {
                                if (msg.generatedArt) {
                                  await saveArtToVault({
                                    title: msg.generatedArt.title || msg.generatedArt.prompt,
                                    imageUrl: msg.generatedArt.imageUrl,
                                    prompt: msg.generatedArt.prompt
                                  });
                                  setArtVaultSavedNotice('Archived to Vault');
                                  setTimeout(() => setArtVaultSavedNotice(null), 2500);
                                }
                              }}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-amber-950/40 border border-red-950/60 text-zinc-300 hover:text-amber-300 text-[10px] font-mono transition-colors"
                              title="Save artwork to Intel Dossier & Media Vault"
                            >
                              <Database className="w-3 h-3 text-amber-400" />
                              <span>Save to Vault</span>
                            </button>

                            <button
                              onClick={() => {
                                if (onAvatarChange && msg.generatedArt) {
                                  onAvatarChange(msg.generatedArt.imageUrl, 'thread');
                                }
                              }}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-amber-950/40 border border-red-950/60 text-zinc-300 hover:text-amber-300 text-[10px] font-mono transition-colors"
                              title="Set as Butler Avatar for this session"
                            >
                              <Palette className="w-3 h-3 text-amber-400" />
                              <span>Set Avatar</span>
                            </button>

                            <a
                              href={msg.generatedArt.imageUrl}
                              download={`zereo-art-${Date.now()}.png`}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-mono font-bold transition-colors shadow-md"
                              title="Download full resolution image"
                            >
                              <Download className="w-3 h-3" />
                              <span>Download</span>
                            </a>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="markdown-body text-sm sm:text-[17px] leading-relaxed font-sans tracking-wide">
                      <Markdown>{msg.text}</Markdown>
                    </div>
                    <div className="mt-4 pt-4 border-t border-red-900/10 flex items-center justify-between gap-2">
                      <div>
                        {msg.role === 'model' && (
                          <button
                            onClick={() => {
                              if (isSpeaking && speakingMsgIndex === idx) {
                                stopSpeaking();
                              } else {
                                setSpeakingMsgIndex(idx);
                                speakText(msg.text, () => setSpeakingMsgIndex(null), false, true);
                              }
                            }}
                            title={isSpeaking && speakingMsgIndex === idx ? 'Halt voice output' : 'Vocalize in Jeremy Irons\' voice'}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all border ${
                              isSpeaking && speakingMsgIndex === idx
                                ? 'bg-red-950 text-amber-300 border-amber-500 shadow-[0_0_12px_rgba(251,191,36,0.4)] animate-pulse'
                                : 'bg-zinc-950/80 border-red-900/40 text-zinc-400 hover:text-amber-400 hover:border-amber-500/40'
                            }`}
                          >
                            {isSpeaking && speakingMsgIndex === idx ? (
                              <>
                                <VolumeX className="w-3 h-3 text-red-400" />
                                <span>Halt Voice</span>
                              </>
                            ) : (
                              <>
                                <Volume2 className="w-3 h-3 text-amber-400" />
                                <span>Speak (Jeremy Irons)</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>

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
                    {msg.emotionalMap && (
                      <>
                        <div className="w-1 h-1 bg-amber-900 rounded-full hidden sm:block" />
                        {msg.emotionalMap.detectedCue && msg.emotionalMap.detectedCue !== 'NEUTRAL' && (
                          <span className={`font-black ${
                            msg.emotionalMap.detectedCue === 'HAPPY' || msg.emotionalMap.detectedCue === 'GRATEFUL'
                              ? 'text-emerald-400'
                              : msg.emotionalMap.detectedCue === 'SAD' || msg.emotionalMap.detectedCue === 'ANXIOUS'
                              ? 'text-rose-400'
                              : 'text-amber-300'
                          }`}>
                            CUE: {msg.emotionalMap.detectedCue}
                          </span>
                        )}
                        <span className="text-amber-400 font-black">
                          AFFECT: {msg.emotionalMap.primaryState.replace(/_/g, ' ')}
                        </span>
                        <span className="text-zinc-500 hidden sm:inline">
                          VECTOR: {msg.emotionalMap.reciprocationVector.replace(/_/g, ' ')}
                        </span>
                        {msg.emotionalMap.stewardLogicalAffect.nudgeAndSmile && (
                          <span className="text-amber-300 text-[7px]">
                            • Nudge & Smile
                          </span>
                        )}
                      </>
                    )}
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
          {/* Streamlined Tactical Status Strip (Controls moved to Upper-Left Menu Tab) */}
          <div className="flex items-center justify-between px-2 pt-0.5 text-[9px] font-mono">
            <button
              onClick={() => setIsTopMenuOpen(true)}
              className="flex items-center gap-2 text-zinc-400 hover:text-amber-300 transition-colors group cursor-pointer"
              title="Configure Gemini/Claude, Strategic Tier, Budget, Recon & Tactical Touch HUD in Upper-Left Menu"
            >
              <Crosshair className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 group-hover:rotate-45 transition-transform" />
              <span className="uppercase font-bold tracking-wider">
                {neuralEngine.toUpperCase()} CORE • {logicTier === 'turbo' ? 'TURBO' : 'STRATEGIC'} • {isDeepThinkingActive ? 'UNBOUNDED' : 'BALANCED'}
                {useGrounding === 'search' ? ' • RECON ACTIVE' : ''}
              </span>
              <span className="text-[8px] text-zinc-600 group-hover:text-amber-400 hidden sm:inline">
                [Tactical HUD in Menu ↗]
              </span>
            </button>

            {screenStream && (
              <button
                onClick={stopScreenShare}
                className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 font-bold text-[8px] animate-pulse"
                title="Click to terminate screen share"
              >
                <Monitor className="w-3 h-3" />
                <span>SCREEN LIVE</span>
              </button>
            )}
          </div>

          {/* Attached image & file preview */}
          <AnimatePresence>
            {(attachedImage || attachedFile) && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className="flex flex-wrap items-center gap-3 px-1"
              >
                {attachedImage && (
                  <div className="flex items-center gap-3">
                    <div className="relative inline-block">
                      <img
                        src={`data:${attachedMime};base64,${attachedImage}`}
                        alt="Attached"
                        className="h-14 sm:h-16 w-auto max-w-[120px] sm:max-w-[160px] rounded-xl object-cover border border-amber-500/30 bg-black/60"
                      />
                      <button
                        type="button"
                        onClick={() => setAttachedImage(null)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-900 rounded-full flex items-center justify-center text-red-200 hover:bg-red-700 transition-colors cursor-pointer"
                        title="Remove photo"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <span className="text-[9px] font-mono text-amber-500/90 uppercase tracking-widest">Photo attached — ready to transmit</span>
                  </div>
                )}

                {attachedFile && (
                  <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-red-950/60 via-zinc-950 to-black border border-amber-500/40 shadow-lg">
                    <FileText className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-mono font-bold text-amber-200 truncate max-w-[200px] sm:max-w-xs">
                        {attachedFile.name}
                      </p>
                      <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-wider">
                        {attachedFile.type} • {Math.max(1, Math.round(attachedFile.size / 1024))} KB{attachedFile.textContent ? ' • Text extracted' : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAttachedFile(null)}
                      className="w-6 h-6 rounded-full bg-red-950 hover:bg-red-800 border border-red-700/60 flex items-center justify-center text-red-200 transition-colors cursor-pointer"
                      title="Remove attached file"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Active Two-Way Conversation Channel Bar */}
          <AnimatePresence>
            {isVoiceDialogueEngaged && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-[#1a070b]/95 via-zinc-950/95 to-black/95 border border-amber-500/35 shadow-[0_0_25px_rgba(245,158,11,0.12)]"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      isSpeaking
                        ? 'bg-amber-400 animate-pulse shadow-[0_0_10px_rgba(251,191,36,0.8)]'
                        : isThinking
                        ? 'bg-amber-300 animate-ping'
                        : isMicListening
                        ? 'bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.8)]'
                        : isMicPaused
                        ? 'bg-zinc-500'
                        : 'bg-amber-500/70'
                    }`}
                  />
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-300 whitespace-nowrap">
                    {isSpeaking
                      ? 'ZereØ Speaking'
                      : isThinking
                      ? 'Reasoning & Recalling'
                      : isMicListening
                      ? 'Listening to You'
                      : isMicPaused
                      ? 'Mic Paused'
                      : 'Voice Channel Open'}
                  </span>
                  <span className="hidden sm:inline text-[10px] font-mono text-zinc-500 truncate">
                    • Recall: {memories.length} memories, {threads.filter(t => t.id !== currentThreadId && t.messages.length > 0).length} past chats
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {isSpeaking ? (
                    <button
                      type="button"
                      onClick={interruptAndListen}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap"
                    >
                      <Mic className="w-3 h-3" />
                      <span>Interrupt &amp; Speak</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        const nextPaused = !isMicPaused;
                        setIsMicPaused(nextPaused);
                        isMicPausedRef.current = nextPaused;
                        if (!nextPaused && !isThinkingRef.current && !isSpeakingRef.current) {
                          setMicTriggerCount(c => c + 1);
                        }
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                        isMicPaused
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 hover:bg-amber-500/30'
                          : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-amber-500/40 hover:text-amber-300'
                      }`}
                    >
                      {isMicPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                      <span>{isMicPaused ? 'Resume Mic' : 'Pause Mic'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={endConversationMode}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-800/70 text-red-200 text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap"
                    title="Return to text-only chat"
                  >
                    <Square className="w-2.5 h-2.5 fill-current" />
                    <span>End</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div
            className="relative group"
            onDragOver={(e) => {
              e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              const droppedFile = e.dataTransfer?.files?.[0];
              if (droppedFile) {
                void handleUploadDeviceFile(droppedFile);
              }
            }}
          >
            <div className="absolute -inset-1 bg-gradient-to-r from-red-900/20 via-amber-500/10 to-red-900/20 rounded-2xl sm:rounded-[2rem] blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-1000" />
            <div className="relative flex items-center bg-[#050506] border border-red-900/30 rounded-2xl sm:rounded-[2rem] overflow-hidden focus-within:border-amber-500/40 transition-all shadow-3xl">
              {/* Direct Photo & File Upload Actions */}
              <div className="flex items-center gap-1 pl-2.5 sm:pl-4 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="p-2 sm:p-2.5 rounded-xl bg-zinc-950/90 hover:bg-red-950/60 border border-red-900/30 hover:border-amber-500/50 text-zinc-400 hover:text-amber-300 transition-all cursor-pointer"
                  title="Upload Photo from Device"
                >
                  <GalleryIcon className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => fileUploadInputRef.current?.click()}
                  className="p-2 sm:p-2.5 rounded-xl bg-zinc-950/90 hover:bg-red-950/60 border border-red-900/30 hover:border-amber-500/50 text-zinc-400 hover:text-amber-300 transition-all cursor-pointer"
                  title="Upload Document, PDF, Audio, or Video File"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
              </div>

              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                onPaste={(e) => {
                  const pastedItems = Array.from(e.clipboardData?.items || []);
                  const fileItem = pastedItems.find((item) => item.kind === 'file');
                  const pastedFile = fileItem?.getAsFile();
                  if (pastedFile) {
                    e.preventDefault();
                    void handleUploadDeviceFile(pastedFile);
                  }
                }}
                placeholder={
                  isVoiceDialogueEngaged
                    ? isMicListening
                      ? 'Listening to your voice… (or type anytime)'
                      : 'Speak naturally or type your next remark…'
                    : attachedImage
                    ? 'Add a directive for this photo or send as-is…'
                    : attachedFile
                    ? `Add a directive for ${attachedFile.name} or send as-is…`
                    : 'State your directive...'
                }
                className="flex-1 bg-transparent py-4 sm:py-6 pl-3 sm:pl-5 pr-3 text-zinc-100 placeholder:text-zinc-800 focus:outline-none resize-none min-h-[60px] sm:min-h-[85px] text-base sm:text-lg font-serif italic tracking-wide"
                rows={1}
              />

              {/* Voice Input (Microphone) & Transmit Controls */}
              <div className="flex items-center gap-2 mr-3 sm:mr-5 flex-shrink-0">
                <VoiceInputButton
                  onTranscriptChange={(transcript) => {
                    setInput(transcript);
                  }}
                  onTranscriptComplete={(finalText) => {
                    setInput(finalText);
                    if (finalText.trim()) {
                      lastInputWasVoiceRef.current = true;
                    }
                    if (isConversationModeRef.current && finalText.trim()) {
                      handleSend(finalText.trim());
                    }
                  }}
                  onInterruptSpeaking={interruptAndListen}
                  onListeningStateChange={setIsMicListening}
                  conversationMode={isVoiceDialogueEngaged}
                  isThinking={isThinking}
                  isSpeaking={isSpeaking}
                  isMicPaused={isMicPaused}
                  autoSubmitOnComplete={isVoiceDialogueEngaged}
                  externalTriggerCount={micTriggerCount}
                />
                <button 
                  type="button"
                  onClick={() => handleSend()}
                  disabled={(!input.trim() && !attachedImage && !attachedFile) || isThinking}
                  className="p-3 sm:p-4 bg-gradient-to-br from-red-900 to-black text-amber-500 rounded-xl sm:rounded-2xl shadow-2xl hover:scale-105 active:scale-95 disabled:opacity-20 transition-all border border-amber-500/20 cursor-pointer"
                  title="Dispatch Directive"
                >
                  <Send className="w-5 sm:w-6 h-5 sm:h-6" />
                </button>
              </div>
            </div>
          </div>

          {/* Live Screen HUD overlay */}
          <ScreenShareHUD
            stream={screenStream}
            onStop={stopScreenShare}
            onCaptureFrame={handleScreenAnalysisPrompt}
            autoAttachOnSend={autoAttachScreen}
            setAutoAttachOnSend={setAutoAttachScreen}
          />

          {/* Visually hidden (sr-only) native file inputs so click activation always succeeds */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleUploadDeviceFile(f); e.target.value = ''; }}
          />
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleUploadDeviceFile(f); e.target.value = ''; }}
          />
          <input
            ref={fileUploadInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.rtf,.txt,.md,.markdown,.csv,.json,.xml,.log,image/*,audio/*,video/*"
            className="sr-only"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleUploadDeviceFile(f); e.target.value = ''; }}
          />

          {/* Top-Left Menu Drawer with All Tabs, Tactical HUD, Ali & Danielle Link Share + Media Tools */}
          <TopLeftMenu
            isOpen={isTopMenuOpen}
            onClose={() => setIsTopMenuOpen(false)}
            avatarUrl={activeAvatar}
            onOpenAvatarModal={() => setIsAvatarModalOpen(true)}
            onSelectAvatar={(url, scope) => handleAvatarSave(url, scope)}
            threads={threads}
            currentThreadId={currentThreadId}
            onSelectThread={(id) => loadThread(id)}
            onNewThread={() => createNewThread()}
            onNavigate={(tab) => handleNavigate(tab)}
            isPrincipalMode={isPrincipalMode}
            neuralEngine={neuralEngine}
            onSelectNeuralEngine={setNeuralEngine}
            logicTier={logicTier}
            onSelectLogicTier={setLogicTier}
            isDeepThinkingActive={isDeepThinkingActive}
            onToggleDeepThinking={() => setIsDeepThinkingActive(!isDeepThinkingActive)}
            useGrounding={useGrounding === 'search' ? 'search' : 'none'}
            onToggleGrounding={() => setUseGrounding(useGrounding === 'search' ? 'none' : 'search')}
            screenStream={screenStream}
            onToggleScreenShare={screenStream ? stopScreenShare : startScreenShare}
            initialTab={topMenuInitialTab}
            onTriggerArtModal={() => setIsArtModalOpen(true)}
            onTriggerCamera={() => cameraInputRef.current?.click()}
            onTriggerPhoto={() => photoInputRef.current?.click()}
            onTriggerFile={() => fileUploadInputRef.current?.click()}
            ttsEnabled={ttsEnabled}
            onToggleTTS={toggleTTS}
          />

          {/* Advanced Avatar Customization Modal with Thread Scope */}
          <AvatarModal
            isOpen={isAvatarModalOpen}
            onClose={() => setIsAvatarModalOpen(false)}
            onSave={(url, scope) => handleAvatarSave(url, scope)}
            currentUrl={activeAvatar}
            currentThreadTitle={currentThread?.title}
          />

          {/* Desired Art Creation Modal */}
          <AnimatePresence>
            {isArtModalOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
                onClick={() => !isGeneratingArt && setIsArtModalOpen(false)}
              >
                <motion.div
                  initial={{ scale: 0.92, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.92, y: 20 }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-xl bg-gradient-to-b from-[#150a0d] via-[#0d090b] to-black border border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(245,158,11,0.2)] space-y-6"
                >
                  <div className="flex items-center justify-between border-b border-red-950/60 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-red-950/80 border border-amber-500/40 text-amber-400">
                        <Sparkles className="w-5 h-5 animate-pulse" />
                      </div>
                      <div>
                        <h2 className="text-base sm:text-lg font-bold bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 bg-clip-text text-transparent uppercase tracking-wider">
                          Manifest Desired Art
                        </h2>
                        <p className="text-[10px] sm:text-xs text-zinc-500 font-mono">
                          ZereØ Neural Pigment Synthesis • Principal Aesthetic
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => !isGeneratingArt && setIsArtModalOpen(false)}
                      disabled={isGeneratingArt}
                      className="p-2 rounded-xl text-zinc-500 hover:text-white hover:bg-red-900/20 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Quick Inspiration Presets */}
                  <div className="space-y-1.5">
                    <span className="text-[9px] font-mono font-bold text-amber-400 uppercase tracking-widest block">
                      Tactical Presets
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        'Silver 1911 on deep burgundy velvet with gold filigree',
                        'Council Grey sovereign fortress at dusk, dramatic lighting',
                        'Tactical cybernetic hawk perched on an obsidian obelisk',
                        'Victorian butler study with vintage radio & tactical blueprints'
                      ].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setArtPrompt(preset)}
                          className="px-2.5 py-1 rounded-lg bg-zinc-900/80 hover:bg-amber-950/40 border border-red-950/50 hover:border-amber-500/40 text-[9px] font-serif text-zinc-400 hover:text-amber-300 transition-colors text-left truncate max-w-xs"
                        >
                          "{preset}"
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Prompt Textarea */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
                      Art Directive / Visual Description
                    </label>
                    <textarea
                      value={artPrompt}
                      onChange={(e) => setArtPrompt(e.target.value)}
                      placeholder="Principal, describe the artwork you desire me to manifest..."
                      rows={3}
                      className="w-full bg-black/70 border border-red-950/60 rounded-2xl p-4 text-sm text-zinc-100 placeholder:text-zinc-700 focus:outline-none focus:border-amber-500/50 font-serif italic tracking-wide"
                    />
                  </div>

                  {/* Style Presets */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
                      Style Profile
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        { id: 'luxury_tactical', label: '🏰 Luxury Tactical' },
                        { id: 'photorealistic', label: '📸 4K Photoreal' },
                        { id: 'oil_painting', label: '🎨 Classical Oil' },
                        { id: 'cybernetic', label: '⚡ Cybernetic' },
                        { id: 'minimalist', label: '🌌 Concept Art' }
                      ].map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => setArtStyle(st.id as any)}
                          className={`p-2.5 rounded-xl border text-xs font-mono font-bold text-center transition-all ${
                            artStyle === st.id
                              ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 shadow-md'
                              : 'bg-zinc-900/60 border-red-950/40 text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Aspect Ratio Selector */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
                      Aspect Ratio
                    </label>
                    <div className="flex gap-2">
                      {[
                        { id: '1:1', label: '1:1 (Square)' },
                        { id: '16:9', label: '16:9 (Landscape)' },
                        { id: '9:16', label: '9:16 (Portrait)' },
                        { id: '4:3', label: '4:3 (Standard)' }
                      ].map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setArtAspectRatio(r.id as any)}
                          className={`flex-1 py-1.5 rounded-xl border text-[10px] font-mono font-bold transition-all ${
                            artAspectRatio === r.id
                              ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                              : 'bg-zinc-900/60 border-red-950/40 text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setIsArtModalOpen(false)}
                      disabled={isGeneratingArt}
                      className="px-4 py-2 rounded-xl text-xs font-mono text-zinc-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => executeArtCreation(artPrompt, artStyle, artAspectRatio)}
                      disabled={!artPrompt.trim() || isGeneratingArt}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-900 via-amber-600 to-amber-500 text-white font-bold text-xs uppercase tracking-wider hover:brightness-110 disabled:opacity-40 transition-all shadow-lg shadow-amber-950/40 cursor-pointer"
                    >
                      {isGeneratingArt ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                          <span>Manifesting Art...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>Manifest Artwork</span>
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Fullscreen Zoomed Artwork Modal */}
          <AnimatePresence>
            {zoomedImageUrl && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 sm:p-8"
                onClick={() => setZoomedImageUrl(null)}
              >
                <div className="relative max-w-5xl max-h-[85vh] w-full flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
                  <div className="w-full flex items-center justify-between pb-3 text-xs font-mono text-amber-400">
                    <span className="uppercase tracking-widest font-bold">Artwork Inspection Mode</span>
                    <div className="flex items-center gap-3">
                      <a
                        href={zoomedImageUrl}
                        download={`zereo-artwork-${Date.now()}.png`}
                        className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Full Res</span>
                      </a>
                      <button
                        onClick={() => setZoomedImageUrl(null)}
                        className="p-1.5 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <img
                    src={zoomedImageUrl}
                    alt="Zoomed art"
                    referrerPolicy="no-referrer"
                    className="max-h-[80vh] w-auto max-w-full object-contain rounded-2xl border border-amber-500/40 shadow-2xl"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Toast Notification when Saved to Vault */}
          <AnimatePresence>
            {artVaultSavedNotice && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="fixed bottom-24 right-6 z-[130] px-4 py-2.5 rounded-xl bg-amber-950/90 border border-amber-500/60 text-amber-300 text-xs font-mono flex items-center gap-2 shadow-2xl backdrop-blur-md"
              >
                <Database className="w-4 h-4 text-amber-400" />
                <span>{artVaultSavedNotice}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  </div>
  );
};

export default ChatBot;
