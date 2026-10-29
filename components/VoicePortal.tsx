
import React, { useState, useRef, useEffect } from 'react';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  Activity, 
  Play, 
  StopCircle, 
  Loader2, 
  BrainCircuit, 
  ShieldCheck, 
  ShieldAlert, 
  Lock, 
  AlertTriangle, 
  Monitor,
  Sparkles,
  Award,
  Waves,
  CheckCircle2,
  Sliders,
  Radio,
  Zap,
  Square
} from 'lucide-react';
import { Socket } from 'socket.io-client';
import { getAI, decodeBase64, encodeBase64, decodeAudioData, generateTTS, getApiKey, clearApiKey } from '../services/geminiService';
import { GeminiModel } from '../types';
import ButlerAvatar from './ButlerAvatar';
import VoiceStatusPanel from './VoiceStatusPanel';
import VoiceStreamHealth from './VoiceStreamHealth';
import PrincipalVerification from './PrincipalVerification';
import { 
  buildJeremyIronsDSP, 
  jeremyIronsVoice, 
  VoiceModulationProfile, 
  VOICE_MODULATION_PROFILES,
  JEREMY_IRONS_FORMANT_PRESETS,
  FormantPresetDefinition
} from '../services/jeremyIronsVoiceService';
import ScreenShareHUD from './ScreenShareHUD';
import VoiceModulationSelector from './VoiceModulationSelector';

interface VoicePortalProps {
  socket?: Socket | null;
  avatarUrl?: string;
  onAvatarClick?: () => void;
}

const VoicePortal: React.FC<VoicePortalProps> = ({ socket, avatarUrl, onAvatarClick }) => {
  const [isLive, setIsLive] = useState(false);
  const [transcriptions, setTranscriptions] = useState<Array<{role: string, text: string}>>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [ttsInput, setTtsInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  
  // Principal Biometric Ownership Gate State
  const [isPrincipalVerified, setIsPrincipalVerified] = useState<boolean>(false);
  const [gateWarning, setGateWarning] = useState<string | null>(null);

  // Dedicated Jeremy Irons Vocal Signature Profile State (Default Output Speech Tone)
  const [selectedProfile, setSelectedProfile] = useState<VoiceModulationProfile>(() => {
    return jeremyIronsVoice.getLegacyProfile() || 'Jeremy-Irons-Signature';
  });

  // Dedicated Formant-Shifting Presets State in DSP Core
  const [activeFormantPreset, setActiveFormantPreset] = useState<string>('sovereign-gravitas');
  const [isAuditioningSignature, setIsAuditioningSignature] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const ironsDSPRef = useRef<any>(null);
  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef(new Set<AudioBufferSourceNode>());
  const verificationSectionRef = useRef<HTMLDivElement | null>(null);

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'monitor' } as any,
        audio: false,
      });
      setScreenStream(stream);
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => setScreenStream(null);
      }
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') {
        console.warn('Screen share failed:', err);
      }
    }
  };

  const stopScreenShare = () => {
    if (screenStream) {
      screenStream.getTracks().forEach((t) => t.stop());
      setScreenStream(null);
    }
  };

  // Keep active profile synced across components & update live DSP if open
  useEffect(() => {
    const unsub = jeremyIronsVoice.subscribe(({ legacyProfile }) => {
      if (legacyProfile && legacyProfile !== selectedProfile) {
        setSelectedProfile(legacyProfile);
      }
    });
    return unsub;
  }, [selectedProfile]);

  useEffect(() => {
    if (ironsDSPRef.current) {
      const profileMeta = VOICE_MODULATION_PROFILES[selectedProfile] || VOICE_MODULATION_PROFILES['Jeremy-Irons-Signature'];
      const activePreset = JEREMY_IRONS_FORMANT_PRESETS[activeFormantPreset];
      const mergedConfig = activePreset ? {
        ...profileMeta.config,
        formantPresetName: activePreset.id,
        f1Hz: activePreset.f1Hz,
        f1GainDb: activePreset.f1GainDb,
        f2Hz: activePreset.f2Hz,
        f2GainDb: activePreset.f2GainDb,
        f3Hz: activePreset.f3Hz,
        f3GainDb: activePreset.f3GainDb,
        vocalTractLengthFactor: activePreset.vocalTractLengthFactor,
        chestResonanceDb: activePreset.chestResonanceDb,
        articulationDb: activePreset.articulationDb,
        gravelAmount: activePreset.gravelAmount,
        pitchRate: activePreset.pitchRate,
        speechRate: activePreset.speechRate
      } : profileMeta.config;
      ironsDSPRef.current.updateConfig(mergedConfig);
    }
  }, [selectedProfile, activeFormantPreset]);

  // Sync initial and dynamic verification state from backend
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/voice/principal-verification');
        if (res.ok) {
          const data = await res.json();
          setIsPrincipalVerified(Boolean(data.verified));
        }
      } catch (err) {
        console.warn("VoicePortal: Failed to fetch verification status:", err);
      }
    };
    checkStatus();

    if (socket) {
      const handleDaemonState = (data: any) => {
        if (data.status === 'ONLINE' && data.verified) {
          setIsPrincipalVerified(true);
          setGateWarning(null);
        } else if (data.status === 'STANDBY_LOCKED') {
          setIsPrincipalVerified(false);
          if (isLive) {
            stopLiveConversation();
          }
        }
      };
      socket.on('voice:daemon_state', handleDaemonState);
      return () => {
        socket.off('voice:daemon_state', handleDaemonState);
      };
    }
  }, [socket, isLive]);

  useEffect(() => {
    return () => {
      stopLiveConversation();
      if (screenStream) {
        screenStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [screenStream]);

  const stopLiveConversation = () => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    ironsDSPRef.current = null;
    setIsLive(false);
    setIsRecording(false);
    setIsThinking(false);
    nextStartTimeRef.current = 0;
    sourcesRef.current.clear();
  };

  const startLiveConversation = async () => {
    // ENFORCE ABSOLUTE OWNERSHIP BEFORE INITIALIZING VOICE PIPELINE
    if (!isPrincipalVerified) {
      setGateWarning("Acoustic Ownership Locked: Principal voice-print verification is mandatory before engaging the voice modulation pipeline.");
      verificationSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    try {
      setGateWarning(null);
      const apiKey = getApiKey();
      if (!apiKey || apiKey === 'undefined') {
        throw new Error("Neural Authorization missing. Please select an API key.");
      }
      const ai = getAI();
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = outputCtx;
      const currentProfileMeta = VOICE_MODULATION_PROFILES[selectedProfile] || VOICE_MODULATION_PROFILES['Jeremy-Irons-Signature'];
      const activePreset = JEREMY_IRONS_FORMANT_PRESETS[activeFormantPreset];
      const mergedConfig = activePreset ? {
        ...currentProfileMeta.config,
        formantPresetName: activePreset.id,
        f1Hz: activePreset.f1Hz,
        f1GainDb: activePreset.f1GainDb,
        f2Hz: activePreset.f2Hz,
        f2GainDb: activePreset.f2GainDb,
        f3Hz: activePreset.f3Hz,
        f3GainDb: activePreset.f3GainDb,
        vocalTractLengthFactor: activePreset.vocalTractLengthFactor,
        chestResonanceDb: activePreset.chestResonanceDb,
        articulationDb: activePreset.articulationDb,
        gravelAmount: activePreset.gravelAmount,
        pitchRate: activePreset.pitchRate,
        speechRate: activePreset.speechRate
      } : currentProfileMeta.config;

      ironsDSPRef.current = buildJeremyIronsDSP(outputCtx, outputCtx.destination, mergedConfig);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const sessionPromise = ai.live.connect({
        model: GeminiModel.FLASH_LIVE,
        callbacks: {
          onopen: () => {
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
              const pcmBlob = { data: encodeBase64(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
              sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
            setIsLive(true);
            setIsRecording(true);
          },
          onmessage: async (message: any) => {
            const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData) {
              setIsThinking(true);
              const start = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              const buffer = await decodeAudioData(decodeBase64(audioData), outputCtx);
              const source = outputCtx.createBufferSource();
              source.buffer = buffer;
              source.playbackRate.value = mergedConfig.pitchRate;
              if (ironsDSPRef.current) {
                source.connect(ironsDSPRef.current.inputNode);
              } else {
                source.connect(outputCtx.destination);
              }
              source.start(start);
              nextStartTimeRef.current = start + buffer.duration;
              sourcesRef.current.add(source);
              source.onended = () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) setIsThinking(false);
              };
            }
            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setIsThinking(false);
            }
            if (message.serverContent?.inputTranscription) setTranscriptions(p => [...p, { role: 'Principal', text: message.serverContent.inputTranscription.text }]);
            if (message.serverContent?.outputTranscription) setTranscriptions(p => [...p, { role: 'Steward', text: message.serverContent.outputTranscription.text }]);
          },
          onclose: () => stopLiveConversation(),
          onerror: (err) => {
            console.error("Live session error:", err);
            stopLiveConversation();
          }
        },
        config: {
          responseModalities: ['AUDIO' as any],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } } },
          systemInstruction: "You are the Voice Core of ZereØ, the Logic Monster. You speak in the deep, measured baritone, sharp dry wit, and aristocratic gravitas of Jeremy Irons portraying Alfred Pennyworth. Address the user exclusively as 'Principal'. Deliver uncompromised logic with strategic loyalty and lethal precision. Never apologize or use corporate AI platitudes."
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err: any) { 
      const errorMsg = err.message || JSON.stringify(err);
      if (errorMsg.includes('API key not valid') || errorMsg.includes('INVALID_ARGUMENT')) {
        clearApiKey();
        alert("Principal, our neural authorization has been rejected. I have cleared the faulty link. Please re-authorize.");
      } else {
        alert(errorMsg); 
      }
    }
  };

  const handleSelectFormantPreset = (presetKey: string) => {
    const preset = JEREMY_IRONS_FORMANT_PRESETS[presetKey];
    if (!preset) return;
    setActiveFormantPreset(presetKey);
    setSelectedProfile('Jeremy-Irons-Signature');
    jeremyIronsVoice.setProfile('Jeremy-Irons-Signature');

    if (ironsDSPRef.current) {
      ironsDSPRef.current.updateConfig({
        formantPresetName: preset.id,
        f1Hz: preset.f1Hz,
        f1GainDb: preset.f1GainDb,
        f2Hz: preset.f2Hz,
        f2GainDb: preset.f2GainDb,
        f3Hz: preset.f3Hz,
        f3GainDb: preset.f3GainDb,
        vocalTractLengthFactor: preset.vocalTractLengthFactor,
        chestResonanceDb: preset.chestResonanceDb,
        articulationDb: preset.articulationDb,
        gravelAmount: preset.gravelAmount,
        pitchRate: preset.pitchRate,
        speechRate: preset.speechRate
      });
    }
  };

  const handleAuditionSignature = async (customSampleText?: string) => {
    if (isAuditioningSignature) {
      jeremyIronsVoice.stop();
      setIsAuditioningSignature(false);
      setIsThinking(false);
      return;
    }

    const signatureMeta = VOICE_MODULATION_PROFILES['Jeremy-Irons-Signature'];
    const activePreset = JEREMY_IRONS_FORMANT_PRESETS[activeFormantPreset] || JEREMY_IRONS_FORMANT_PRESETS['sovereign-gravitas'];
    const textToSpeak = customSampleText || signatureMeta.auditionSample;

    setIsAuditioningSignature(true);
    setIsThinking(true);

    try {
      await jeremyIronsVoice.speak(
        textToSpeak,
        {
          ...signatureMeta.config,
          formantPresetName: activePreset.id,
          f1Hz: activePreset.f1Hz,
          f1GainDb: activePreset.f1GainDb,
          f2Hz: activePreset.f2Hz,
          f2GainDb: activePreset.f2GainDb,
          f3Hz: activePreset.f3Hz,
          f3GainDb: activePreset.f3GainDb,
          vocalTractLengthFactor: activePreset.vocalTractLengthFactor,
          chestResonanceDb: activePreset.chestResonanceDb,
          articulationDb: activePreset.articulationDb,
          gravelAmount: activePreset.gravelAmount,
          pitchRate: activePreset.pitchRate,
          speechRate: activePreset.speechRate
        },
        () => {
          setIsThinking(true);
          setIsAuditioningSignature(true);
        },
        () => {
          setIsThinking(false);
          setIsAuditioningSignature(false);
        }
      );
    } catch (err) {
      console.warn('Signature audition failed:', err);
      setIsThinking(false);
      setIsAuditioningSignature(false);
    }
  };

  const handleTTS = async () => {
    if (!ttsInput.trim()) return;
    setIsSynthesizing(true);
    setIsThinking(true);
    try {
      const profileMeta = VOICE_MODULATION_PROFILES[selectedProfile] || VOICE_MODULATION_PROFILES['Jeremy-Irons-Signature'];
      const activePreset = JEREMY_IRONS_FORMANT_PRESETS[activeFormantPreset];
      const mergedConfig = activePreset ? {
        ...profileMeta.config,
        formantPresetName: activePreset.id,
        f1Hz: activePreset.f1Hz,
        f1GainDb: activePreset.f1GainDb,
        f2Hz: activePreset.f2Hz,
        f2GainDb: activePreset.f2GainDb,
        f3Hz: activePreset.f3Hz,
        f3GainDb: activePreset.f3GainDb,
        vocalTractLengthFactor: activePreset.vocalTractLengthFactor,
        chestResonanceDb: activePreset.chestResonanceDb,
        articulationDb: activePreset.articulationDb,
        gravelAmount: activePreset.gravelAmount,
        pitchRate: activePreset.pitchRate,
        speechRate: activePreset.speechRate
      } : profileMeta.config;

      await jeremyIronsVoice.speak(ttsInput, mergedConfig, () => {
        setIsThinking(true);
      }, () => {
        setIsThinking(false);
      });
    } catch (err) {
      console.error('TTS execution failed:', err);
      setIsThinking(false);
    } finally {
      setIsSynthesizing(false);
    }
  };

  return (
    <div className="flex-1 p-6 sm:p-12 flex flex-col items-center gap-10 overflow-y-auto custom-scrollbar bg-black relative">
      <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-transparent via-red-800 to-transparent opacity-50" />
      
      <div className="flex flex-col items-center gap-8 z-10">
        <ButlerAvatar size="xl" isTalking={isThinking} className="drop-shadow-[0_0_50px_rgba(251,191,36,0.1)]" src={avatarUrl} onClick={onAvatarClick} />
        
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <h2 className={`text-3xl font-bold uppercase tracking-[0.3em] transition-colors duration-500 ${isThinking ? 'text-amber-400' : 'text-zinc-600'}`}>
              {isThinking ? "Vocalizing Logic" : "Neural Link Idle"}
            </h2>
          </div>
          
          <div className="flex items-center justify-center gap-3">
            <span className="text-xs text-red-900 font-bold uppercase tracking-widest">Butler Protocol v7.0 Active</span>
            <span className="text-zinc-700">•</span>
            <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
              isPrincipalVerified 
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' 
                : 'bg-red-950/40 text-red-400 border-red-900/60'
            }`}>
              {isPrincipalVerified ? '● Principal Verified' : '○ Voice Daemon Gated'}
            </span>
          </div>
        </div>

        {/* Ownership Gate Warning if triggered */}
        {gateWarning && (
          <div className="p-4 bg-red-950/80 border border-red-600 text-red-200 rounded-2xl max-w-xl text-center text-xs font-mono shadow-2xl flex items-center justify-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 animate-bounce" />
            <span>{gateWarning}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <button
            onClick={isLive ? stopLiveConversation : startLiveConversation}
            className={`px-10 py-5 rounded-2xl font-bold uppercase tracking-widest flex items-center gap-4 transition-all shadow-2xl border ${
              isLive 
                ? 'bg-red-950/40 text-red-500 border-red-800 hover:bg-red-900/40' 
                : isPrincipalVerified
                  ? 'bg-red-800 text-amber-400 border-amber-600 hover:bg-red-700'
                  : 'bg-zinc-900 text-zinc-400 border-red-950 hover:border-red-800'
            }`}
          >
            {isLive ? (
              <StopCircle className="w-6 h-6" />
            ) : !isPrincipalVerified ? (
              <Lock className="w-5 h-5 text-red-500" />
            ) : (
              <Mic className="w-6 h-6" />
            )}
            {isLive ? "Cut Neural Link" : isPrincipalVerified ? "Open Audio Bridge" : "Verify Principal to Open Bridge"}
          </button>

          <button
            onClick={screenStream ? stopScreenShare : startScreenShare}
            className={`px-8 py-5 rounded-2xl font-bold uppercase tracking-widest flex items-center gap-3 transition-all shadow-2xl border ${
              screenStream
                ? 'bg-red-950 border-amber-500 text-amber-300 animate-pulse'
                : 'bg-zinc-900/60 border-red-900/30 text-zinc-400 hover:text-amber-400 hover:border-amber-500/40'
            }`}
          >
            <Monitor className="w-5 h-5 text-amber-500" />
            <span>{screenStream ? 'Screen Active' : 'Screen Share'}</span>
          </button>
        </div>
      </div>

      {/* Live Screen Tactical HUD if active */}
      {screenStream && (
        <div className="w-full max-w-4xl z-10">
          <ScreenShareHUD
            stream={screenStream}
            onStop={stopScreenShare}
          />
        </div>
      )}

      {/* Dedicated Vocal Signature Profile: Jeremy Irons (Default Output Speech Tone) */}
      <div className="w-full max-w-4xl z-10 bg-gradient-to-b from-amber-950/30 via-zinc-950/90 to-black border border-amber-500/40 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden ring-1 ring-amber-500/20">
        <div className="absolute top-0 right-0 w-96 h-40 bg-gradient-to-bl from-amber-500/15 via-red-900/10 to-transparent pointer-events-none" />

        {/* Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-amber-500/20">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <Award className="w-5 h-5 text-amber-400" />
              <h3 className="text-base sm:text-lg font-bold uppercase tracking-[0.25em] text-zinc-100 flex items-center gap-2">
                <span>Vocal Signature</span>
                <span className="text-zinc-600">•</span>
                <span className="text-amber-400">Jeremy Irons</span>
              </h3>
              <span className="text-[10px] uppercase font-mono font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5 shadow-sm animate-pulse">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>Default Output Tone</span>
              </span>
            </div>
            <p className="text-xs text-zinc-300 font-serif italic">
              Alfred Pennyworth Persona • Aristocratic Baritone with Unhurried Cadence & Lethal Intellectual Gravitas.
            </p>
          </div>

          {/* Quick Audition Trigger */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              id="audition-jeremy-irons-signature-btn"
              onClick={() => handleAuditionSignature()}
              className={`px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-lg border ${
                isAuditioningSignature
                  ? 'bg-amber-500 text-black border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.5)] animate-pulse'
                  : 'bg-amber-950/60 text-amber-300 border-amber-500/50 hover:bg-amber-900/60 hover:border-amber-400 hover:text-amber-200'
              }`}
            >
              {isAuditioningSignature ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Halting Gravitas</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Audition Gravitas</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Formant Presets Selector */}
        <div className="mt-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              <span>DSP Formant-Shifting Presets:</span>
            </span>
            <span className="text-[10px] font-mono text-amber-400/80">
              Active: {JEREMY_IRONS_FORMANT_PRESETS[activeFormantPreset]?.name || 'Sovereign Gravitas'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {Object.values(JEREMY_IRONS_FORMANT_PRESETS).map((preset) => {
              const isPresetSelected = activeFormantPreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectFormantPreset(preset.id)}
                  className={`p-3 rounded-xl text-left transition-all border font-mono flex flex-col justify-between ${
                    isPresetSelected
                      ? 'bg-amber-950/50 border-amber-500 text-amber-200 shadow-[0_0_15px_rgba(251,191,36,0.15)] ring-1 ring-amber-500/40'
                      : 'bg-black/40 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 w-full">
                    <span className="text-xs font-bold truncate">{preset.name.split(' (')[0]}</span>
                    {isPresetSelected && (
                      <CheckCircle2 className="w-3 h-3 text-amber-400 shrink-0" />
                    )}
                  </div>
                  <span className="text-[9px] text-zinc-500 truncate mt-1">{preset.tagline.split('•')[0]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Formant Architecture Spectrum Telemetry Grid */}
        <div className="mt-6 pt-5 border-t border-amber-500/20">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
              <Waves className="w-3.5 h-3.5 text-amber-400" />
              <span>3-Pole Formant Modeling Telemetry:</span>
            </span>
            <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span>Calibrated to Jeremy Irons Voice-Print</span>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs font-mono">
            {/* F1 */}
            <div className="bg-black/50 p-2.5 rounded-xl border border-amber-500/20">
              <span className="text-[9px] text-zinc-500 block uppercase">F1 Pharyngeal</span>
              <span className="text-amber-300 font-bold text-sm">
                {JEREMY_IRONS_FORMANT_PRESETS[activeFormantPreset]?.f1Hz || 380} Hz
              </span>
              <span className="text-[9px] text-zinc-400 block">+{JEREMY_IRONS_FORMANT_PRESETS[activeFormantPreset]?.f1GainDb || 6.2} dB (Floor)</span>
            </div>

            {/* F2 */}
            <div className="bg-black/50 p-2.5 rounded-xl border border-amber-500/20">
              <span className="text-[9px] text-zinc-500 block uppercase">F2 Lingual Retract</span>
              <span className="text-amber-300 font-bold text-sm">
                {JEREMY_IRONS_FORMANT_PRESETS[activeFormantPreset]?.f2Hz || 1350} Hz
              </span>
              <span className="text-[9px] text-zinc-400 block">{JEREMY_IRONS_FORMANT_PRESETS[activeFormantPreset]?.f2GainDb || -3.0} dB (RP Notch)</span>
            </div>

            {/* F3 */}
            <div className="bg-black/50 p-2.5 rounded-xl border border-amber-500/20">
              <span className="text-[9px] text-zinc-500 block uppercase">F3 Actor's Formant</span>
              <span className="text-amber-300 font-bold text-sm">
                {JEREMY_IRONS_FORMANT_PRESETS[activeFormantPreset]?.f3Hz || 2680} Hz
              </span>
              <span className="text-[9px] text-zinc-400 block">+{JEREMY_IRONS_FORMANT_PRESETS[activeFormantPreset]?.f3GainDb || 6.5} dB (Bite)</span>
            </div>

            {/* Tract Factor */}
            <div className="bg-black/50 p-2.5 rounded-xl border border-amber-500/20">
              <span className="text-[9px] text-zinc-500 block uppercase">Tract Expansion</span>
              <span className="text-zinc-200 font-bold text-sm">
                {JEREMY_IRONS_FORMANT_PRESETS[activeFormantPreset]?.vocalTractLengthFactor || 1.14}x
              </span>
              <span className="text-[9px] text-zinc-400 block">Cavity Elongation</span>
            </div>

            {/* Gravel */}
            <div className="bg-black/50 p-2.5 rounded-xl border border-amber-500/20">
              <span className="text-[9px] text-zinc-500 block uppercase">Sigmoid Gravel</span>
              <span className="text-zinc-200 font-bold text-sm">
                {Math.round((JEREMY_IRONS_FORMANT_PRESETS[activeFormantPreset]?.gravelAmount || 0.88) * 100)}%
              </span>
              <span className="text-[9px] text-zinc-400 block">4x Oversampled</span>
            </div>

            {/* Chest Depth */}
            <div className="bg-black/50 p-2.5 rounded-xl border border-amber-500/20">
              <span className="text-[9px] text-zinc-500 block uppercase">Chest Depth</span>
              <span className="text-zinc-200 font-bold text-sm">
                +{JEREMY_IRONS_FORMANT_PRESETS[activeFormantPreset]?.chestResonanceDb || 6.8} dB
              </span>
              <span className="text-[9px] text-zinc-400 block">@ 105 Hz Sub-Shelf</span>
            </div>
          </div>
        </div>

        {/* Audio Synthesis Configuration Footer */}
        <div className="mt-4 pt-3 border-t border-zinc-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[10px] font-mono text-zinc-400">
          <div className="flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-amber-400" />
            <span>Output Speech Tone: <strong className="text-amber-300">Jeremy Irons Aristocratic Baritone (Default)</strong></span>
          </div>
          <div className="flex items-center gap-3">
            <span>Rate: {JEREMY_IRONS_FORMANT_PRESETS[activeFormantPreset]?.speechRate || 0.88}x</span>
            <span>•</span>
            <span>Pitch: {JEREMY_IRONS_FORMANT_PRESETS[activeFormantPreset]?.pitchRate || 0.86}x</span>
            <span>•</span>
            <span className="text-amber-400 font-bold">Address: Principal</span>
          </div>
        </div>
      </div>

      {/* Voice Modulation Profile Selector */}
      <div className="w-full max-w-4xl z-10">
        <VoiceModulationSelector
          currentProfile={selectedProfile}
          onProfileSelect={(p) => setSelectedProfile(p)}
        />
      </div>

      {/* Core Principal Verification Module: Enforcing Absolute Ownership */}
      <div ref={verificationSectionRef} className="w-full max-w-4xl z-10">
        <PrincipalVerification 
          socket={socket} 
          onVerificationSuccess={() => {
            setIsPrincipalVerified(true);
            setGateWarning(null);
          }}
          onLockDaemon={() => {
            setIsPrincipalVerified(false);
            stopLiveConversation();
          }}
        />
      </div>

      {/* Real-time Unix Domain Socket Bridge Latency & Pipeline Health Monitor */}
      <VoiceStreamHealth socket={socket} className="max-w-4xl z-10" />

      {/* Real-time Voice DSP Unix Domain Socket Status & Telemetry Panel */}
      <VoiceStatusPanel socket={socket} className="max-w-4xl z-10" />

      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8 mt-2 pb-12 z-10">
        <div className="bg-zinc-900/40 border border-red-900/20 p-8 rounded-3xl space-y-6">
          <div className="flex items-center gap-3 text-amber-500 mb-4">
            <Volume2 className="w-5 h-5" />
            <h3 className="font-bold uppercase tracking-widest text-xs">Vocal Synthesizer</h3>
          </div>
          <textarea 
            value={ttsInput} 
            onChange={e => setTtsInput(e.target.value)}
            className="w-full h-32 bg-black/40 border border-red-900/30 rounded-2xl p-4 text-base text-zinc-300 focus:outline-none focus:border-amber-500/50 resize-none font-serif italic"
            placeholder="Input text for me to vocalize, Principal..."
          />
          <button 
            onClick={handleTTS}
            disabled={isSynthesizing}
            className="w-full py-4 bg-amber-600 text-black rounded-xl font-bold uppercase text-[10px] tracking-widest flex items-center justify-center gap-3 hover:bg-amber-500 transition-all disabled:opacity-30"
          >
            {isSynthesizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Execute Synthesis
          </button>
        </div>

        <div className="bg-zinc-900/40 border border-red-900/20 p-8 rounded-3xl">
          <div className="flex items-center gap-3 text-red-500 mb-4">
            <Activity className="w-5 h-5" />
            <h3 className="font-bold uppercase tracking-widest text-xs">Transcription Stream</h3>
          </div>
          <div className="h-[200px] overflow-y-auto space-y-4 pr-2 custom-scrollbar">
            {transcriptions.map((t, i) => (
              <div key={i} className={`p-3 rounded-xl border text-[10px] ${t.role === 'user' ? 'bg-red-950/20 border-red-900/30 text-zinc-400' : 'bg-amber-950/10 border-amber-900/20 text-amber-500/80'}`}>
                <span className="font-bold uppercase mr-2 opacity-50">{t.role}:</span>
                {t.text}
              </div>
            ))}
            {transcriptions.length === 0 && <p className="text-zinc-700 italic text-[10px]">Transmission buffer empty.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoicePortal;
