
import React, { useState, useRef } from 'react';
import { Mic, MicOff, Volume2, Activity, Play, StopCircle, Loader2, BrainCircuit } from 'lucide-react';
import { getAI, decodeBase64, encodeBase64, decodeAudioData, generateTTS, getApiKey, clearApiKey } from '../services/geminiService';
import { GeminiModel } from '../types';
import ButlerAvatar from './ButlerAvatar';

interface VoicePortalProps {
  avatarUrl?: string;
  onAvatarClick?: () => void;
}

const VoicePortal: React.FC<VoicePortalProps> = ({ avatarUrl, onAvatarClick }) => {
  const [isLive, setIsLive] = useState(false);
  const [transcriptions, setTranscriptions] = useState<Array<{role: string, text: string}>>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [ttsInput, setTtsInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  // DSP Daemon State
  const [dspStatus, setDspStatus] = useState<{ status: string; pitch?: number; ring_mod?: number; gain?: number }>({ status: 'checking' });
  const [pitch, setPitch] = useState<number>(0.85);
  const [ringMod, setRingMod] = useState<number>(0.0);
  const [gain, setGain] = useState<number>(1.0);

  const fetchDspStatus = async () => {
    try {
      const res = await fetch('/api/voicemod', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_status' })
      });
      const data = await res.json();
      setDspStatus(data);
      if (data.status === 'ok') {
        if (data.pitch !== undefined) setPitch(data.pitch);
        if (data.ring_mod !== undefined) setRingMod(data.ring_mod);
        if (data.gain !== undefined) setGain(data.gain);
      }
    } catch {
      setDspStatus({ status: 'offline' });
    }
  };

  const updateDspParams = async (newPitch: number, newRing: number, newGain: number) => {
    setPitch(newPitch);
    setRingMod(newRing);
    setGain(newGain);
    try {
      const res = await fetch('/api/voicemod', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_params',
          pitch: newPitch,
          ring_mod: newRing,
          gain: newGain
        })
      });
      const data = await res.json();
      if (data.status === 'ok') {
        setDspStatus({ status: 'ok', pitch: newPitch, ring_mod: newRing, gain: newGain });
      }
    } catch {
      setDspStatus({ status: 'offline' });
    }
  };

  React.useEffect(() => {
    fetchDspStatus();
  }, []);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef(new Set<AudioBufferSourceNode>());

  const stopLiveConversation = () => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsLive(false);
    setIsRecording(false);
    setIsThinking(false);
    nextStartTimeRef.current = 0;
    sourcesRef.current.clear();
  };

  const startLiveConversation = async () => {
    try {
      const apiKey = getApiKey();
      if (!apiKey || apiKey === 'undefined') {
        throw new Error("Neural Authorization missing. Please select an API key.");
      }
      const ai = getAI();
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = outputCtx;
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
              source.connect(outputCtx.destination);
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
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          systemInstruction: "You are the Voice Core of the Logic Monster. Your tone is Crimson Red and Metallic Gold excellence. Formal, refined, and discrete. Address the user as Principal."
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
    setIsSynthesizing(true); setIsThinking(true);
    const buffer = await generateTTS(ttsInput);
    setIsSynthesizing(false);
    if (buffer) {
      const ctx = new AudioContext();
      const source = ctx.createBufferSource();
      source.buffer = buffer; source.connect(ctx.destination);
      source.onended = () => setIsThinking(false); source.start(0);
    } else setIsThinking(false);
  };

  return (
    <div className="flex-1 p-12 flex flex-col items-center justify-center gap-12 overflow-hidden bg-black relative">
      <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-transparent via-red-800 to-transparent opacity-50" />
      
      <div className="flex flex-col items-center gap-8 z-10">
        <ButlerAvatar size="xl" isTalking={isThinking} className="drop-shadow-[0_0_50px_rgba(251,191,36,0.1)]" src={avatarUrl} onClick={onAvatarClick} />
        
        <div className="text-center space-y-2">
          <h2 className={`text-3xl font-bold uppercase tracking-[0.3em] transition-colors duration-500 ${isThinking ? 'text-amber-400' : 'text-zinc-600'}`}>
            {isThinking ? "Vocalizing Logic" : "Neural Link Idle"}
          </h2>
          <p className="text-xs text-red-900 font-bold uppercase tracking-widest">Butler Protocol v7.0 Active</p>
        </div>

        <div className="flex gap-6">
          <button
            onClick={isLive ? stopLiveConversation : startLiveConversation}
            className={`px-10 py-5 rounded-2xl font-bold uppercase tracking-widest flex items-center gap-4 transition-all shadow-2xl border ${
              isLive 
              ? 'bg-red-950/40 text-red-500 border-red-800 hover:bg-red-900/40' 
              : 'bg-red-800 text-amber-400 border-amber-600 hover:bg-red-700'
            }`}
          >
            {isLive ? <StopCircle className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            {isLive ? "Cut Neural Link" : "Open Audio Bridge"}
          </button>
        </div>
      </div>

      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8 mt-10">
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

      {/* Voice Modulation Daemon (voicemod-daemon) Controller Card */}
      <div className="w-full max-w-4xl bg-zinc-900/50 border border-red-900/30 p-8 rounded-3xl space-y-6">
        <div className="flex items-center justify-between border-b border-red-900/20 pb-4">
          <div className="flex items-center gap-3">
            <BrainCircuit className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold uppercase tracking-widest text-xs text-amber-400">voicemod-daemon / DSP Engine</h3>
              <p className="text-[10px] text-zinc-500 font-mono">Socket IPC: /tmp/voicemod.sock</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${dspStatus.status === 'ok' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-amber-500 animate-pulse'}`} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-mono">
              {dspStatus.status === 'ok' ? 'DAEMON ONLINE' : dspStatus.status === 'checking' ? 'CHECKING...' : 'DAEMON STANDBY'}
            </span>
            <button 
              onClick={fetchDspStatus}
              className="ml-2 text-[9px] uppercase px-2.5 py-1 bg-red-950/60 border border-red-900/40 hover:bg-red-900/40 text-amber-400 rounded-lg"
            >
              Sync
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2 bg-black/40 p-4 rounded-2xl border border-red-900/20">
            <div className="flex justify-between text-[10px] font-bold uppercase text-zinc-400">
              <span>Pitch Shift</span>
              <span className="text-amber-400 font-mono">{pitch.toFixed(2)}x</span>
            </div>
            <input 
              type="range" min="0.5" max="2.0" step="0.05"
              value={pitch}
              onChange={e => updateDspParams(parseFloat(e.target.value), ringMod, gain)}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <p className="text-[9px] text-zinc-600 italic">0.75x Tactical Deep | 1.0x Normal | 1.25x High</p>
          </div>

          <div className="space-y-2 bg-black/40 p-4 rounded-2xl border border-red-900/20">
            <div className="flex justify-between text-[10px] font-bold uppercase text-zinc-400">
              <span>Ring Modulation</span>
              <span className="text-amber-400 font-mono">{ringMod.toFixed(1)} Hz</span>
            </div>
            <input 
              type="range" min="0" max="200" step="1"
              value={ringMod}
              onChange={e => updateDspParams(pitch, parseFloat(e.target.value), gain)}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <p className="text-[9px] text-zinc-600 italic">Cybernetic Frequency Shift (0 = Disabled)</p>
          </div>

          <div className="space-y-2 bg-black/40 p-4 rounded-2xl border border-red-900/20">
            <div className="flex justify-between text-[10px] font-bold uppercase text-zinc-400">
              <span>Master Gain</span>
              <span className="text-amber-400 font-mono">{gain.toFixed(2)}x</span>
            </div>
            <input 
              type="range" min="0.0" max="2.5" step="0.05"
              value={gain}
              onChange={e => updateDspParams(pitch, ringMod, parseFloat(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <p className="text-[9px] text-zinc-600 italic">DSP Amplitude Multiplier</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <span className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider">Quick Profiles:</span>
          <button 
            onClick={() => updateDspParams(0.75, 0.0, 1.25)}
            className="px-3 py-1.5 bg-red-950/60 border border-red-800/40 text-amber-400 rounded-xl text-[10px] font-bold uppercase hover:bg-amber-500 hover:text-black transition-all"
          >
            Tactical Deep (0.75x)
          </button>
          <button 
            onClick={() => updateDspParams(0.85, 45.0, 1.1)}
            className="px-3 py-1.5 bg-red-950/60 border border-red-800/40 text-amber-400 rounded-xl text-[10px] font-bold uppercase hover:bg-amber-500 hover:text-black transition-all"
          >
            Cybernetic (0.85x / 45Hz)
          </button>
          <button 
            onClick={() => updateDspParams(0.92, 12.0, 1.0)}
            className="px-3 py-1.5 bg-red-950/60 border border-red-800/40 text-amber-400 rounded-xl text-[10px] font-bold uppercase hover:bg-amber-500 hover:text-black transition-all"
          >
            Steward Calibration
          </button>
          <button 
            onClick={() => updateDspParams(1.0, 0.0, 1.0)}
            className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-xl text-[10px] font-bold uppercase hover:bg-zinc-700 transition-all"
          >
            Bypass
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoicePortal;
