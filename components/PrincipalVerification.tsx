import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Socket } from 'socket.io-client';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Mic, 
  MicOff, 
  Fingerprint, 
  Lock, 
  Unlock, 
  Volume2, 
  Activity, 
  Sparkles, 
  Radio, 
  CheckCircle2, 
  AlertOctagon, 
  RefreshCw, 
  Cpu,
  Sliders,
  AudioWaveform as WaveformIcon
} from 'lucide-react';

interface ArchitectProfile {
  architect: string;
  designation: string;
  biometricId: string;
  passphraseSignet: string;
  targetF0Hz: number;
  f0Range: [number, number];
  formants: { F1: number; F2: number; F3: number };
}

interface PrincipalVerificationProps {
  socket?: Socket | null;
  onVerificationSuccess?: () => void;
  onLockDaemon?: () => void;
  className?: string;
}

export const PrincipalVerification: React.FC<PrincipalVerificationProps> = ({
  socket,
  onVerificationSuccess,
  onLockDaemon,
  className = ''
}) => {
  // Verification State
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [daemonStatus, setDaemonStatus] = useState<'STANDBY_LOCKED' | 'INITIALIZING' | 'ONLINE'>('STANDBY_LOCKED');
  const [confidenceScore, setConfidenceScore] = useState<number>(0);
  const [verificationMethod, setVerificationMethod] = useState<string>('UNVERIFIED');
  const [architectProfile, setArchitectProfile] = useState<ArchitectProfile>({
    architect: 'Preston Johnston (Council Grey)',
    designation: 'Sole Architect & Solid State of the 1¹',
    biometricId: 'ARCHITECT-SIG-GREY-13MEU-8212',
    passphraseSignet: "Are the 1911's loaded and silver polished???",
    targetF0Hz: 118.0,
    f0Range: [95.0, 138.0],
    formants: { F1: 520, F2: 1480, F3: 2450 }
  });

  // Microphone & Acoustic Analysis State
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [liveF0, setLiveF0] = useState<number>(0);
  const [liveRmsDb, setLiveRmsDb] = useState<number>(-90);
  const [liveCentroid, setLiveCentroid] = useState<number>(0);
  const [liveFormants, setLiveFormants] = useState<{ F1: number; F2: number; F3: number }>({ F1: 0, F2: 0, F3: 0 });
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [acousticCorrelation, setAcousticCorrelation] = useState<number>(0);
  const [verificationFeedback, setVerificationFeedback] = useState<string>('Microphone offline. Authorization required to engage DSP modulation daemon.');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [manualCodeInput, setManualCodeInput] = useState<string>('');
  const [showManualOverride, setShowManualOverride] = useState<boolean>(false);

  // Audio Context & Stream Refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const matchHoldTimerRef = useRef<number>(0);

  // Canvas Refs
  const liveWaveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const masterWaveCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Fetch initial status from server
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/voice/principal-verification');
      if (res.ok) {
        const data = await res.json();
        setIsVerified(data.verified);
        setDaemonStatus(data.daemonStatus);
        setConfidenceScore(data.confidenceScore || 0);
        setVerificationMethod(data.verificationMethod || 'UNVERIFIED');
        if (data.architectProfile) {
          setArchitectProfile(data.architectProfile);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch voice verification status:', err);
    }
  }, []);

  useEffect(() => {
    fetchStatus();

    if (socket) {
      const handleDaemonState = (data: any) => {
        if (data.status === 'ONLINE' && data.verified) {
          setIsVerified(true);
          setDaemonStatus('ONLINE');
          setConfidenceScore(data.confidence || 98.4);
        } else if (data.status === 'STANDBY_LOCKED') {
          setIsVerified(false);
          setDaemonStatus('STANDBY_LOCKED');
          setConfidenceScore(0);
        }
      };

      const handleVerificationState = (data: any) => {
        setIsVerified(data.verified);
        setDaemonStatus(data.daemonStatus);
        setConfidenceScore(data.confidenceScore);
      };

      socket.on('voice:daemon_state', handleDaemonState);
      socket.on('voice:verification_state', handleVerificationState);
      socket.emit('voice:check_verification');

      return () => {
        socket.off('voice:daemon_state', handleDaemonState);
        socket.off('voice:verification_state', handleVerificationState);
      };
    }
  }, [socket, fetchStatus]);

  // Autocorrelation pitch extraction (F0 in Hz)
  const autoCorrelate = (buf: Float32Array, sampleRate: number): number => {
    let SIZE = buf.length;
    let rms = 0;
    for (let i = 0; i < SIZE; i++) {
      const val = buf[i];
      rms += val * val;
    }
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.012) return -1; // Not enough signal energy

    // Truncate search buffer for voice pitch range (60 Hz to 500 Hz)
    let r1 = 0, r2 = SIZE - 1, thres = 0.2;
    for (let i = 0; i < SIZE / 2; i++) {
      if (Math.abs(buf[i]) < thres) {
        r1 = i;
        break;
      }
    }
    for (let i = 1; i < SIZE / 2; i++) {
      if (Math.abs(buf[SIZE - i]) < thres) {
        r2 = SIZE - i;
        break;
      }
    }

    const trimmed = buf.slice(r1, r2);
    SIZE = trimmed.length;

    const c = new Float32Array(SIZE);
    for (let i = 0; i < SIZE; i++) {
      for (let j = 0; j < SIZE - i; j++) {
        c[i] = c[i] + trimmed[j] * trimmed[j + i];
      }
    }

    let d = 0;
    while (c[d] > c[d + 1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i = d; i < SIZE; i++) {
      if (c[i] > maxval) {
        maxval = c[i];
        maxpos = i;
      }
    }

    let T0 = maxpos;
    if (maxval > 0.4 && T0 > 0) {
      // Parabolic interpolation for fine tuning
      const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
      const a = (x1 + x3 - 2 * x2) / 2;
      const b = (x3 - x1) / 2;
      if (a) T0 = T0 - b / (2 * a);
      return sampleRate / T0;
    }
    return -1;
  };

  // Play auditory authorization confirmation pulse
  const playAuthTone = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(118.0, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(236.0, ctx.currentTime + 0.18);
      osc.frequency.exponentialRampToValueAtTime(354.0, ctx.currentTime + 0.35);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch {}
  };

  // Stop microphone capture and clean up
  const stopCapture = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    setIsCapturing(false);
    setIsAnalyzing(false);
  };

  // Execute verification request to backend
  const submitVerification = async (acousticPayload: {
    f0?: number;
    formants?: { F1: number; F2: number; F3: number };
    spectralCentroid?: number;
    energyRms?: number;
    transcript?: string;
    passcodeOverride?: string;
    voiceSignetPhrase?: string;
  }) => {
    setDaemonStatus('INITIALIZING');
    setVerificationFeedback('Correlating acoustic parameters against Architect master vault...');

    try {
      const res = await fetch('/api/voice/principal-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(acousticPayload)
      });

      const data = await res.json();
      if (res.ok && data.verified) {
        setIsVerified(true);
        setDaemonStatus('ONLINE');
        setConfidenceScore(data.confidenceScore || 98.4);
        setVerificationMethod(data.method || 'VOICE_PRINT_MATCH');
        setVerificationFeedback(`Acoustic match confirmed (${data.confidenceScore}%). Voice modulation daemon initialized.`);
        playAuthTone();
        stopCapture();

        if (onVerificationSuccess) {
          onVerificationSuccess();
        }
      } else {
        setDaemonStatus('STANDBY_LOCKED');
        setVerificationFeedback(data.message || 'ACCESS DENIED: Acoustic profile does not match Principal signature.');
        setErrorMessage(data.message || 'Acoustic mismatch.');
      }
    } catch (err: any) {
      setDaemonStatus('STANDBY_LOCKED');
      setVerificationFeedback('Neural bridge communication fault during voice-print correlation.');
      setErrorMessage(err.message || 'Network error');
    }
  };

  // Start microphone and real-time acoustic analysis
  const startVoicePrintMatch = async () => {
    setErrorMessage(null);
    setVerificationFeedback('Initializing microphone telemetry. Recite signet or speak with baritone command...');
    matchHoldTimerRef.current = 0;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      micStreamRef.current = stream;
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.82;
      source.connect(analyser);
      analyserRef.current = analyser;

      setIsCapturing(true);
      setIsAnalyzing(true);

      // Initialize Speech Recognition for neural signet phrase detection if supported
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = 'en-US';

          recognition.onresult = (event: any) => {
            let fullText = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              fullText += event.results[i][0].transcript;
            }
            setLiveTranscript(fullText);

            const lower = fullText.toLowerCase();
            if (
              lower.includes("1911") || 
              lower.includes("silver polished") || 
              lower.includes("council grey") ||
              lower.includes("preston")
            ) {
              setVerificationFeedback('Neural Signet Phrase detected! Executing instantaneous verification...');
              submitVerification({
                transcript: fullText,
                voiceSignetPhrase: fullText,
                f0: liveF0 > 0 ? liveF0 : 118.0
              });
            }
          };

          recognition.onerror = (e: any) => {
            console.warn('Speech recognition notice:', e.error);
          };

          recognition.start();
          recognitionRef.current = recognition;
        } catch (e) {
          console.warn('Speech recognition initialization bypassed:', e);
        }
      }

      // Real-time Audio DSP analysis loop
      const timeData = new Float32Array(analyser.fftSize);
      const freqData = new Uint8Array(analyser.frequencyBinCount);

      let consecutiveMatches = 0;

      const analyzeAudio = () => {
        if (!analyserRef.current) return;

        analyserRef.current.getFloatTimeDomainData(timeData);
        analyserRef.current.getByteFrequencyData(freqData);

        // Calculate RMS in dB
        let sumSquares = 0;
        for (let i = 0; i < timeData.length; i++) {
          sumSquares += timeData[i] * timeData[i];
        }
        const rms = Math.sqrt(sumSquares / timeData.length);
        const rmsDb = rms > 0.00001 ? Math.max(-90, Math.round(20 * Math.log10(rms))) : -90;
        setLiveRmsDb(rmsDb);

        // Pitch extraction (F0)
        const detectedF0 = autoCorrelate(timeData, audioCtx.sampleRate);
        if (detectedF0 > 60 && detectedF0 < 350) {
          setLiveF0(Math.round(detectedF0 * 10) / 10);
        }

        // Spectral centroid
        let num = 0, den = 0;
        const binWidth = audioCtx.sampleRate / analyser.fftSize;
        for (let i = 0; i < freqData.length; i++) {
          const mag = freqData[i];
          const freq = i * binWidth;
          num += freq * mag;
          den += mag;
        }
        const centroid = den > 0 ? Math.round(num / den) : 0;
        setLiveCentroid(centroid);

        // Estimate formants from spectral peaks in human speech bands
        let peakF1 = 500, maxF1 = 0;
        let peakF2 = 1500, maxF2 = 0;
        let peakF3 = 2500, maxF3 = 0;

        for (let i = 2; i < freqData.length - 2; i++) {
          const freq = i * binWidth;
          const mag = freqData[i];
          if (freq >= 300 && freq <= 850 && mag > maxF1) {
            maxF1 = mag;
            peakF1 = Math.round(freq);
          } else if (freq > 850 && freq <= 2000 && mag > maxF2) {
            maxF2 = mag;
            peakF2 = Math.round(freq);
          } else if (freq > 2000 && freq <= 3200 && mag > maxF3) {
            maxF3 = mag;
            peakF3 = Math.round(freq);
          }
        }
        setLiveFormants({ F1: peakF1, F2: peakF2, F3: peakF3 });

        // Biometric acoustic correlation calculation
        if (detectedF0 > 0 && rmsDb > -38) {
          const targetF0 = architectProfile.targetF0Hz;
          const [minF0, maxF0] = architectProfile.f0Range;
          
          let pitchScore = 0;
          if (detectedF0 >= minF0 && detectedF0 <= maxF0) {
            const delta = Math.abs(detectedF0 - targetF0);
            pitchScore = Math.max(0, 100 - (delta * 1.8));
          } else {
            const delta = detectedF0 < minF0 ? (minF0 - detectedF0) : (detectedF0 - maxF0);
            pitchScore = Math.max(0, 70 - (delta * 2.5));
          }

          const formantScore = Math.max(40, 100 - (Math.abs(peakF1 - 520) * 0.05 + Math.abs(peakF2 - 1480) * 0.03));
          const score = Math.min(99.4, Math.round((pitchScore * 0.65) + (formantScore * 0.35)));
          setAcousticCorrelation(score);

          if (score >= 84) {
            consecutiveMatches++;
            if (consecutiveMatches >= 18) {
              // Sustained biometric lock achieved!
              submitVerification({
                f0: detectedF0,
                formants: { F1: peakF1, F2: peakF2, F3: peakF3 },
                spectralCentroid: centroid,
                energyRms: rmsDb
              });
              return;
            }
          } else {
            consecutiveMatches = Math.max(0, consecutiveMatches - 1);
          }
        } else {
          setAcousticCorrelation(prev => Math.max(0, prev - 2));
        }

        // Draw Live Oscilloscope Waveform
        const canvas = liveWaveCanvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.lineWidth = 2;
            
            // Color shifts from muted red to bright gold as correlation increases
            if (acousticCorrelation > 80) {
              ctx.strokeStyle = '#fbbf24';
              ctx.shadowColor = '#d97706';
              ctx.shadowBlur = 8;
            } else if (acousticCorrelation > 50) {
              ctx.strokeStyle = '#f59e0b';
              ctx.shadowBlur = 4;
            } else {
              ctx.strokeStyle = '#ef4444';
              ctx.shadowBlur = 0;
            }

            ctx.beginPath();
            const sliceWidth = canvas.width / timeData.length;
            let x = 0;
            for (let i = 0; i < timeData.length; i += 4) {
              const v = timeData[i] * 0.9;
              const y = (canvas.height / 2) + (v * (canvas.height / 2));
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
              x += sliceWidth * 4;
            }
            ctx.stroke();
            ctx.shadowBlur = 0;
          }
        }

        animationFrameRef.current = requestAnimationFrame(analyzeAudio);
      };

      animationFrameRef.current = requestAnimationFrame(analyzeAudio);
    } catch (err: any) {
      console.error('Microphone access denied or error:', err);
      setIsCapturing(false);
      setIsAnalyzing(false);
      setErrorMessage(err.message || 'Microphone access denied. Check browser permissions.');
      setVerificationFeedback('Microphone permission blocked. Use cryptographic override if required.');
    }
  };

  // Draw Architect Reference Waveform
  useEffect(() => {
    const canvas = masterWaveCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let t = 0;
    let animId: number;

    const renderMasterSignature = () => {
      t += 0.04;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#d97706';
      ctx.shadowColor = 'rgba(245, 158, 11, 0.4)';
      ctx.shadowBlur = 6;

      ctx.beginPath();
      const points = 120;
      for (let i = 0; i < points; i++) {
        const x = (i / (points - 1)) * canvas.width;
        // Harmonic baritone composite: 118 Hz base + 2nd and 3rd harmonics
        const phase = (i * 0.14) - t;
        const wave = 
          Math.sin(phase) * 0.55 + 
          Math.sin(phase * 2.0 + 0.4) * 0.25 + 
          Math.sin(phase * 3.0 + 0.8) * 0.15;
        const y = (canvas.height / 2) + wave * (canvas.height * 0.38);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
      animId = requestAnimationFrame(renderMasterSignature);
    };

    renderMasterSignature();
    return () => cancelAnimationFrame(animId);
  }, []);

  // Lock voice modulation daemon back to standby
  const handleLockDaemon = async () => {
    stopCapture();
    try {
      const res = await fetch('/api/voice/principal-lock', { method: 'POST' });
      if (res.ok) {
        setIsVerified(false);
        setDaemonStatus('STANDBY_LOCKED');
        setConfidenceScore(0);
        setVerificationMethod('UNVERIFIED');
        setVerificationFeedback('Voice modulation daemon locked into standby protocol. Principal verification mandatory.');
        if (onLockDaemon) onLockDaemon();
      }
    } catch (err) {
      console.error('Failed to lock daemon:', err);
    }
  };

  // Cryptographic Passcode 8212 Instant Verification
  const handleCodeOverride = async () => {
    if (!manualCodeInput.trim()) return;
    await submitVerification({
      passcodeOverride: manualCodeInput.trim(),
      f0: 118.0
    });
    setManualCodeInput('');
    setShowManualOverride(false);
  };

  return (
    <div className={`w-full bg-[#0d0708] border border-red-900/40 rounded-3xl overflow-hidden shadow-2xl relative ${className}`}>
      {/* Background Accent Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(#991b1b_1px,transparent_1px)] [background-size:24px_24px] opacity-10 pointer-events-none" />

      {/* Module Header */}
      <div className="p-6 sm:p-8 border-b border-red-900/30 bg-gradient-to-r from-red-950/40 via-black to-red-950/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`p-3.5 rounded-2xl border transition-all duration-500 ${
            isVerified 
              ? 'bg-amber-950/60 border-amber-500/60 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.25)]' 
              : 'bg-red-950/80 border-red-800 text-red-500'
          }`}>
            {isVerified ? <ShieldCheck className="w-6 h-6" /> : <Fingerprint className="w-6 h-6 animate-pulse" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold uppercase tracking-[0.2em] text-zinc-100">
                Principal Verification
              </h2>
              <span className={`text-[9px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                isVerified 
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/40' 
                  : 'bg-red-950/80 text-red-400 border-red-800'
              }`}>
                {isVerified ? 'OWNERSHIP CONFIRMED' : 'ACCESS LOCKED'}
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 font-mono tracking-wider mt-0.5">
              Target Profile: <span className="text-amber-300 font-semibold">{architectProfile.architect}</span> • Signet: <span className="text-zinc-300 font-semibold">{architectProfile.biometricId}</span>
            </p>
          </div>
        </div>

        {/* Tactical Status & Actions */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          <div className="text-right font-mono">
            <span className="text-[9px] text-zinc-400 uppercase tracking-widest block">Modulation Daemon</span>
            <span className={`text-xs font-bold uppercase tracking-wider ${
              daemonStatus === 'ONLINE' ? 'text-emerald-400' : daemonStatus === 'INITIALIZING' ? 'text-amber-400 animate-pulse' : 'text-red-400'
            }`}>
              {daemonStatus === 'ONLINE' ? '● ONLINE / ACTIVE' : daemonStatus === 'INITIALIZING' ? 'INITIALIZING...' : '○ STANDBY LOCKED'}
            </span>
          </div>

          {isVerified ? (
            <button
              onClick={handleLockDaemon}
              className="px-4 py-2 bg-red-950/50 hover:bg-red-900/60 border border-red-800/60 text-red-300 hover:text-red-100 rounded-xl text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 transition-all"
              title="Enforce lock on voice modulation daemon"
            >
              <Lock className="w-3.5 h-3.5" />
              Lock Daemon
            </button>
          ) : (
            <button
              onClick={fetchStatus}
              className="p-2 bg-zinc-900/60 border border-red-900/30 text-amber-400 rounded-xl hover:bg-zinc-800"
              title="Refresh Authentication State"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Verification Visualizer Body */}
      <div className="p-6 sm:p-8 space-y-6">
        {/* Banner Announcement */}
        <div className={`p-4 rounded-2xl border flex items-center gap-4 text-xs font-mono ${
          isVerified
            ? 'bg-amber-950/20 border-amber-600/30 text-amber-200'
            : 'bg-red-950/30 border-red-900/40 text-zinc-300'
        }`}>
          {isVerified ? (
            <CheckCircle2 className="w-5 h-5 text-amber-400 flex-shrink-0" />
          ) : (
            <AlertOctagon className="w-5 h-5 text-red-500 flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <span className="font-bold uppercase tracking-wider block text-[11px] text-zinc-100">
              {isVerified ? 'Sovereign Ownership Enforced' : 'Voice Modulation Daemon Gated'}
            </span>
            <span className="text-[10px] text-zinc-400 leading-relaxed">
              {verificationFeedback}
            </span>
          </div>
        </div>

        {/* Acoustic Dual Spectrogram / Waveform Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Master Architect Saved Signature */}
          <div className="bg-black/60 border border-amber-900/30 rounded-2xl p-5 space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-300">
                  Architect Master Voice-Print Signature
                </span>
              </div>
              <span className="text-[9px] font-mono text-zinc-400 uppercase bg-amber-950/50 px-2 py-0.5 rounded border border-amber-800/40">
                Ground Truth Vault
              </span>
            </div>

            <canvas
              ref={masterWaveCanvasRef}
              width={400}
              height={80}
              className="w-full h-20 rounded-xl bg-black/80 border border-amber-950"
            />

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-amber-900/20 text-center font-mono">
              <div className="bg-zinc-950/80 p-2 rounded-lg border border-amber-900/20">
                <span className="text-[8px] text-zinc-400 uppercase block">Target $F_0$</span>
                <span className="text-xs font-bold text-amber-400">118.0 Hz</span>
              </div>
              <div className="bg-zinc-950/80 p-2 rounded-lg border border-amber-900/20">
                <span className="text-[8px] text-zinc-400 uppercase block">Baritone Band</span>
                <span className="text-xs font-bold text-amber-300">95 - 138 Hz</span>
              </div>
              <div className="bg-zinc-950/80 p-2 rounded-lg border border-amber-900/20">
                <span className="text-[8px] text-zinc-400 uppercase block">Formant $F_1 / F_2$</span>
                <span className="text-xs font-bold text-zinc-300">520 / 1480 Hz</span>
              </div>
            </div>
          </div>

          {/* Live Microphone Stream & Autocorrelation Extractor */}
          <div className="bg-black/60 border border-red-900/30 rounded-2xl p-5 space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mic className={`w-4 h-4 ${isCapturing ? 'text-amber-400 animate-pulse' : 'text-zinc-500'}`} />
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-200">
                  Live Microphone Acoustic Stream
                </span>
              </div>
              <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded border ${
                isCapturing 
                  ? 'bg-red-950 text-red-400 border-red-800' 
                  : 'bg-zinc-900 text-zinc-500 border-zinc-800'
              }`}>
                {isCapturing ? 'STREAMING ACTIVE' : 'STANDBY'}
              </span>
            </div>

            <canvas
              ref={liveWaveCanvasRef}
              width={400}
              height={80}
              className="w-full h-20 rounded-xl bg-black/80 border border-red-950/60"
            />

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-red-900/20 text-center font-mono">
              <div className="bg-zinc-950/80 p-2 rounded-lg border border-red-900/20">
                <span className="text-[8px] text-zinc-400 uppercase block">Live $F_0$ Pitch</span>
                <span className={`text-xs font-bold ${
                  liveF0 >= 95 && liveF0 <= 138 ? 'text-amber-400' : 'text-zinc-400'
                }`}>
                  {liveF0 > 0 ? `${liveF0} Hz` : '--'}
                </span>
              </div>
              <div className="bg-zinc-950/80 p-2 rounded-lg border border-red-900/20">
                <span className="text-[8px] text-zinc-400 uppercase block">Energy RMS</span>
                <span className="text-xs font-bold text-zinc-300">
                  {liveRmsDb > -90 ? `${liveRmsDb} dB` : 'SILENCE'}
                </span>
              </div>
              <div className="bg-zinc-950/80 p-2 rounded-lg border border-red-900/20">
                <span className="text-[8px] text-zinc-400 uppercase block">Acoustic Match</span>
                <span className={`text-xs font-bold ${
                  acousticCorrelation >= 80 ? 'text-amber-400' : acousticCorrelation >= 50 ? 'text-amber-500' : 'text-zinc-500'
                }`}>
                  {acousticCorrelation}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Biometric Correlation Meter & Neural Signet Passphrase */}
        <div className="bg-zinc-950/60 border border-red-900/30 rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-amber-400 block">
                Biometric Signature Correlation Gauge
              </span>
              <span className="text-[10px] font-mono text-zinc-400">
                Minimum verification threshold: 80.0% acoustic distance match
              </span>
            </div>
            <div className="text-right font-mono">
              <span className="text-lg font-bold text-amber-300">
                {isVerified ? `${confidenceScore.toFixed(1)}%` : `${acousticCorrelation.toFixed(1)}%`}
              </span>
              <span className="text-[9px] text-zinc-400 ml-1 uppercase">Confidence</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-3 bg-black rounded-full overflow-hidden border border-red-900/30 relative">
            <motion.div
              className={`h-full transition-all duration-300 ${
                isVerified 
                  ? 'bg-gradient-to-r from-amber-600 via-amber-400 to-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.5)]' 
                  : acousticCorrelation >= 80 
                    ? 'bg-gradient-to-r from-red-600 via-amber-500 to-amber-400' 
                    : 'bg-gradient-to-r from-red-900 to-red-600'
              }`}
              style={{ width: `${isVerified ? confidenceScore : acousticCorrelation}%` }}
            />
            {/* Threshold Line at 80% */}
            <div className="absolute top-0 bottom-0 left-[80%] w-0.5 bg-amber-400/80 pointer-events-none" />
          </div>

          {/* Spoken Signet Passphrase Guide */}
          <div className="p-3 bg-black/40 border border-amber-900/20 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono">
            <div>
              <span className="text-[9px] text-zinc-400 uppercase block font-bold">Acoustic Signet Passphrase</span>
              <span className="text-amber-300/90 italic font-serif text-sm">
                "{architectProfile.passphraseSignet}"
              </span>
            </div>
            {liveTranscript && (
              <div className="text-right text-[10px] text-zinc-300 bg-red-950/40 px-2.5 py-1 rounded border border-red-900/40">
                <span className="text-zinc-400 uppercase text-[8px] block">Detected Voice:</span>
                "{liveTranscript}"
              </div>
            )}
          </div>
        </div>

        {/* Verification Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-3">
            {!isCapturing ? (
              <button
                onClick={startVoicePrintMatch}
                disabled={isVerified}
                className={`px-6 py-3.5 rounded-2xl font-mono font-bold uppercase tracking-wider text-xs flex items-center gap-3 transition-all shadow-xl ${
                  isVerified
                    ? 'bg-zinc-900 text-zinc-600 border border-zinc-800 cursor-not-allowed'
                    : 'bg-red-800 hover:bg-red-700 text-amber-300 border border-amber-600/50 hover:shadow-red-900/50'
                }`}
              >
                <Mic className="w-4 h-4" />
                Capture Microphone & Verify Voice-Print
              </button>
            ) : (
              <button
                onClick={stopCapture}
                className="px-6 py-3.5 rounded-2xl font-mono font-bold uppercase tracking-wider text-xs flex items-center gap-3 bg-red-950/80 hover:bg-red-900 border border-red-700 text-red-300 transition-all"
              >
                <MicOff className="w-4 h-4" />
                Cease Microphone Capture
              </button>
            )}

            {/* Instant Neural Signet Simulation Trigger */}
            {!isVerified && (
              <button
                onClick={() => submitVerification({
                  transcript: architectProfile.passphraseSignet,
                  voiceSignetPhrase: architectProfile.passphraseSignet,
                  f0: 118.0
                })}
                className="px-4 py-3.5 bg-amber-600/10 hover:bg-amber-600/20 border border-amber-500/40 text-amber-300 rounded-2xl text-xs font-mono font-bold uppercase tracking-wider transition-all"
                title="Simulate acoustic match of neural passphrase signet"
              >
                Transmit Vocal Signet
              </button>
            )}
          </div>

          {/* Cryptographic Fallback Button */}
          <div>
            <button
              onClick={() => setShowManualOverride(p => !p)}
              className="text-[10px] font-mono text-zinc-400 hover:text-zinc-200 uppercase tracking-widest flex items-center gap-1.5"
            >
              <Cpu className="w-3.5 h-3.5" />
              {showManualOverride ? 'Hide Code Override' : 'Code 8212 Override'}
            </button>
          </div>
        </div>

        {/* Manual Passcode 8212 Override Drawer */}
        <AnimatePresence>
          {showManualOverride && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="p-4 bg-black/80 border border-red-900/30 rounded-2xl space-y-3"
            >
              <span className="text-[10px] font-mono uppercase text-zinc-400 block font-bold">
                Tactical One-Touch Cryptographic Sync (Passcode 8212)
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter Code 8212..."
                  value={manualCodeInput}
                  onChange={e => setManualCodeInput(e.target.value)}
                  className="flex-1 bg-zinc-900/60 border border-red-900/40 rounded-xl px-4 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-amber-500/50"
                />
                <button
                  onClick={handleCodeOverride}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-black font-mono font-bold uppercase text-xs rounded-xl"
                >
                  Verify Signet
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {errorMessage && (
          <div className="p-3 bg-red-950/60 border border-red-800 text-red-300 rounded-xl text-xs font-mono">
            {errorMessage}
          </div>
        )}
      </div>

      {/* Module Footer Status */}
      <div className="p-3.5 px-6 sm:px-8 border-t border-red-900/20 bg-red-950/10 flex flex-col sm:flex-row items-center justify-between text-[9px] font-mono text-zinc-400 uppercase tracking-wider gap-2">
        <span>Protocol: Architect Acoustic Verification Matrix</span>
        <span>
          Verification Status: <strong className={isVerified ? 'text-amber-400' : 'text-red-400'}>
            {isVerified ? `VERIFIED (${verificationMethod})` : 'UNVERIFIED - DAEMON GATED'}
          </strong>
        </span>
      </div>
    </div>
  );
};

export default PrincipalVerification;
