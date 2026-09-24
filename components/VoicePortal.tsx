
import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Volume2, Activity, Play, StopCircle, Loader2, BrainCircuit, ShieldCheck, ShieldAlert, Lock, AlertTriangle, Monitor } from 'lucide-react';
import { Socket } from 'socket.io-client';
import { getAI, decodeBase64, encodeBase64, decodeAudioData, generateTTS, getApiKey, clearApiKey } from '../services/geminiService';
import { GeminiModel } from '../types';
import ButlerAvatar from './ButlerAvatar';
import VoiceStatusPanel from './VoiceStatusPanel';
import VoiceStreamHealth from './VoiceStreamHealth';
import PrincipalVerification from './PrincipalVerification';
import { buildJeremyIronsDSP, jeremyIronsVoice, VoiceModulationProfile, VOICE_MODULATION_PROFILES } from '../services/jeremyIronsVoiceService';
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

  // Voice Modulation Profile State - Defaults to Iron-Adaptive (Jeremy Irons canonical signature)
  const [selectedProfile, setSelectedProfile] = useState<VoiceModulationProfile>(() => {
    return jeremyIronsVoice.getLegacyProfile() || 'Iron-Adaptive';
  });

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
      const profileMeta = VOICE_MODULATION_PROFILES[selectedProfile] || VOICE_MODULATION_PROFILES['Iron-Adaptive'];
      ironsDSPRef.current.updateConfig(profileMeta.config);
    }
  }, [selectedProfile]);

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
      const currentProfileMeta = VOICE_MODULATION_PROFILES[selectedProfile] || VOICE_MODULATION_PROFILES['Iron-Adaptive'];
      ironsDSPRef.current = buildJeremyIronsDSP(outputCtx, outputCtx.destination, currentProfileMeta.config);
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
              const activeMeta = VOICE_MODULATION_PROFILES[selectedProfile] || VOICE_MODULATION_PROFILES['Iron-Adaptive'];
              source.playbackRate.value = activeMeta.config.pitchRate;
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

  const handleTTS = async () => {
    if (!ttsInput.trim()) return;
    setIsSynthesizing(true);
    setIsThinking(true);
    try {
      const profileMeta = VOICE_MODULATION_PROFILES[selectedProfile] || VOICE_MODULATION_PROFILES['Iron-Adaptive'];
      await jeremyIronsVoice.speak(ttsInput, profileMeta.config, () => {
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
