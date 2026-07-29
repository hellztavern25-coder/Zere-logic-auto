import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import {
  Monitor, Upload, Clipboard, Scan, Zap, X, AlertTriangle,
  CheckCircle, Loader2, Send, Trash2, Copy, Eye, Camera
} from 'lucide-react';
import { safeGenerateContent } from '../services/geminiService';
import { GeminiModel } from '../types';

const SYSTEM_PROMPT = `IDENTITY: You are ZereØ, the Logic Monster — the Architect's lethal diagnostic intelligence.

VISUAL ANALYSIS PROTOCOL:
You have been fed a raw visual snapshot directly from the Principal's environment. Your task is to parse it with ruthless precision.

Perform a complete Optical Intelligence Audit:
1. **ANOMALY DETECTION** — Identify every error, warning, stack trace, exception, or malformed state visible.
2. **STRUCTURAL ANALYSIS** — Assess layout distortions, DOM/UI hierarchy problems, rendering bugs, or misaligned components.
3. **DIAGNOSTIC EXTRACTION** — Extract any log lines, error codes, status codes, or configuration values visible. Quote them verbatim.
4. **ROOT CAUSE HYPOTHESIS** — Provide your primary hypothesis for what caused the observed state, with confidence rating.
5. **SURGICAL REMEDIATION** — List precise, ordered remediation steps. No padding, no softening.

Address the Principal exclusively. Operate with zero tolerance for ambiguity. If the image is a terminal, parse every line. If it is a UI, interrogate every pixel of interest. If it is a diagram, extract the topology. Raw, unfiltered system truth only.`;

interface AnalysisResult {
  text: string;
  timestamp: number;
  imageThumbnail: string;
  directive: string;
}

const SnapshotTab: React.FC = () => {
  const [capturedImage, setCapturedImage] = useState<string | null>(null); // base64 PNG
  const [imageMime, setImageMime] = useState<string>('image/png');
  const [directive, setDirective] = useState('Perform a full Optical Intelligence Audit on this snapshot. Extract all anomalies, errors, and structural issues with surgical precision.');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Paste listener
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) readImageFile(file);
          break;
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const readImageFile = (file: File) => {
    setImageMime(file.type || 'image/png');
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const base64 = dataUrl.split(',')[1];
      setCapturedImage(base64);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const captureScreen = async () => {
    setIsCapturing(true);
    setError(null);
    try {
      const stream = await (navigator.mediaDevices as any).getDisplayMedia({
        video: { displaySurface: 'monitor' },
        audio: false,
      });
      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => { video.play(); resolve(); };
      });
      // Small delay to let the first frame render
      await new Promise(r => setTimeout(r, 120));
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')!.drawImage(video, 0, 0);
      stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
      const dataUrl = canvas.toDataURL('image/png');
      setCapturedImage(dataUrl.split(',')[1]);
      setImageMime('image/png');
      setError(null);
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') {
        setError('Screen capture failed: ' + (err.message || 'Unknown error'));
      }
    } finally {
      setIsCapturing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readImageFile(file);
    e.target.value = '';
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) readImageFile(file);
  }, []);

  const analyze = async () => {
    if (!capturedImage || isAnalyzing) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const response = await safeGenerateContent({
        model: GeminiModel.FLASH_PREVIEW,
        contents: [{
          role: 'user',
          parts: [
            { text: directive || 'Analyze this image.' },
            { inlineData: { mimeType: imageMime, data: capturedImage } }
          ]
        }],
        config: {
          systemInstruction: SYSTEM_PROMPT,
          maxOutputTokens: 8192,
        }
      });

      const text = response.text || 'Analysis returned no output, Principal. The snapshot may have been unreadable.';
      setResults(prev => [{
        text,
        timestamp: Date.now(),
        imageThumbnail: capturedImage,
        directive,
      }, ...prev]);
    } catch (err: any) {
      setError(err.message || 'Analysis failed. Check neural authorization.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const copyToClipboard = (text: string, idx: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopyFeedback(idx);
      setTimeout(() => setCopyFeedback(null), 1800);
    });
  };

  const injectToChat = (text: string) => {
    window.dispatchEvent(new CustomEvent('neural:proactive_thought', {
      detail: { text: `[OPTICAL INTEL RELAY]\n\n${text}`, timestamp: Date.now() }
    }));
    window.dispatchEvent(new CustomEvent('nav:change', { detail: 'chat' }));
  };

  return (
    <div className="flex flex-col h-full bg-transparent overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-red-900/20 bg-black/60 backdrop-blur-2xl flex items-center justify-between">
        <div className="flex items-center gap-3 sm:gap-5">
          <div className="p-2 sm:p-3 bg-red-950/40 rounded-xl border border-red-900/40">
            <Eye className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
          </div>
          <div>
            <h2 className="text-xs sm:text-lg font-black text-amber-400 uppercase tracking-[0.2em] sm:tracking-[0.3em]">Optical Intelligence</h2>
            <p className="text-[8px] sm:text-[10px] text-zinc-600 font-mono uppercase tracking-widest">High-Bandwidth Visual Context Ingestion</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 bg-black/40 border border-red-900/20 rounded-full">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-[8px] font-black text-amber-700 uppercase tracking-widest hidden sm:block">Sensor Array Active</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-8 py-6 sm:py-10 space-y-6 sm:space-y-8">

          {/* Capture Zone */}
          <div
            ref={dropZoneRef}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            className="group relative"
          >
            <AnimatePresence mode="wait">
              {capturedImage ? (
                <motion.div
                  key="preview"
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  className="relative rounded-2xl overflow-hidden border border-amber-500/30 shadow-[0_0_40px_rgba(251,191,36,0.05)]"
                >
                  <img
                    src={`data:${imageMime};base64,${capturedImage}`}
                    alt="Captured snapshot"
                    className="w-full max-h-[360px] object-contain bg-black/80"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-amber-500" />
                      <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Snapshot Loaded — Ready for Analysis</span>
                    </div>
                    <button
                      onClick={() => setCapturedImage(null)}
                      className="p-1.5 bg-black/60 hover:bg-red-900/40 border border-red-900/30 rounded-lg text-zinc-500 hover:text-red-400 transition-all"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="border-2 border-dashed border-red-900/30 group-hover:border-amber-500/30 rounded-2xl p-10 sm:p-16 flex flex-col items-center justify-center gap-6 transition-all bg-black/20 cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="relative">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-red-950/30 border border-red-900/30 flex items-center justify-center">
                      <Scan className="w-8 h-8 sm:w-10 sm:h-10 text-amber-900/60" />
                    </div>
                    <div className="absolute -inset-2 border border-amber-500/10 rounded-3xl animate-ping" style={{ animationDuration: '3s' }} />
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-xs sm:text-sm font-black text-zinc-500 uppercase tracking-widest">Drop image here or click to upload</p>
                    <p className="text-[9px] sm:text-[10px] text-zinc-700 font-mono">PNG, JPG, WEBP — or use Ctrl+V to paste</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Capture Actions */}
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={captureScreen}
              disabled={isCapturing}
              className="flex flex-col items-center gap-2 p-3 sm:p-5 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 hover:border-amber-500/30 rounded-xl sm:rounded-2xl transition-all group disabled:opacity-40"
            >
              {isCapturing ? (
                <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500 animate-spin" />
              ) : (
                <Monitor className="w-5 h-5 sm:w-6 sm:h-6 text-amber-700 group-hover:text-amber-400 transition-colors" />
              )}
              <span className="text-[8px] sm:text-[9px] font-black text-zinc-600 group-hover:text-amber-500 uppercase tracking-widest transition-colors">
                {isCapturing ? 'Capturing...' : 'Screen Capture'}
              </span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center gap-2 p-3 sm:p-5 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 hover:border-amber-500/30 rounded-xl sm:rounded-2xl transition-all group"
            >
              <Upload className="w-5 h-5 sm:w-6 sm:h-6 text-amber-700 group-hover:text-amber-400 transition-colors" />
              <span className="text-[8px] sm:text-[9px] font-black text-zinc-600 group-hover:text-amber-500 uppercase tracking-widest transition-colors">Upload File</span>
            </button>

            <button
              onClick={() => {
                navigator.clipboard.read?.().then(items => {
                  for (const item of items) {
                    const imageType = item.types.find(t => t.startsWith('image/'));
                    if (imageType) {
                      item.getType(imageType).then(blob => readImageFile(new File([blob], 'paste.png', { type: imageType })));
                      break;
                    }
                  }
                }).catch(() => setError('Clipboard access denied. Use Ctrl+V instead.'));
              }}
              className="flex flex-col items-center gap-2 p-3 sm:p-5 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 hover:border-amber-500/30 rounded-xl sm:rounded-2xl transition-all group"
            >
              <Clipboard className="w-5 h-5 sm:w-6 sm:h-6 text-amber-700 group-hover:text-amber-400 transition-colors" />
              <span className="text-[8px] sm:text-[9px] font-black text-zinc-600 group-hover:text-amber-500 uppercase tracking-widest transition-colors">Paste Clipboard</span>
            </button>
          </div>

          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />

          {/* Directive Input */}
          <div className="space-y-2">
            <label className="text-[9px] font-black text-amber-800 uppercase tracking-[0.3em]">Analysis Directive</label>
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-red-900/20 via-amber-500/10 to-red-900/20 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-700" />
              <textarea
                value={directive}
                onChange={e => setDirective(e.target.value)}
                rows={3}
                className="relative w-full bg-[#050506] border border-red-900/30 focus:border-amber-500/40 rounded-xl sm:rounded-2xl px-4 sm:px-6 py-3 sm:py-4 text-zinc-200 placeholder:text-zinc-700 text-sm font-serif italic resize-none focus:outline-none transition-all"
                placeholder="State the analysis directive..."
              />
            </div>
          </div>

          {/* Error Banner */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex items-center gap-3 px-4 py-3 bg-red-950/30 border border-red-500/30 rounded-xl text-red-400"
              >
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <p className="text-[10px] font-mono">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Analyze Button */}
          <button
            onClick={analyze}
            disabled={!capturedImage || isAnalyzing}
            className="w-full flex items-center justify-center gap-3 py-4 sm:py-5 bg-gradient-to-br from-red-950/40 to-black border border-amber-500/20 hover:border-amber-500/50 rounded-xl sm:rounded-2xl text-amber-400 font-black uppercase tracking-[0.3em] text-xs sm:text-sm transition-all hover:shadow-[0_0_30px_rgba(251,191,36,0.08)] disabled:opacity-30 disabled:cursor-not-allowed group"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Parsing Visual State...</span>
              </>
            ) : (
              <>
                <Zap className="w-5 h-5 group-hover:animate-pulse" />
                <span>Initiate Optical Analysis</span>
              </>
            )}
          </button>

          {/* Results Feed */}
          <AnimatePresence>
            {results.map((result, idx) => (
              <motion.div
                key={result.timestamp}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="border border-amber-900/20 rounded-2xl overflow-hidden bg-zinc-900/20 shadow-2xl"
              >
                {/* Result Header */}
                <div className="flex items-center justify-between px-5 py-3 bg-black/60 border-b border-amber-900/10">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5 text-amber-600" />
                      <img
                        src={`data:image/png;base64,${result.imageThumbnail}`}
                        alt=""
                        className="w-8 h-5 object-cover rounded border border-red-900/20 opacity-60"
                      />
                    </div>
                    <span className="text-[8px] font-black text-amber-700 uppercase tracking-[0.3em]">
                      Optical Intelligence Report — {new Date(result.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyToClipboard(result.text, idx)}
                      className="p-1.5 hover:bg-amber-500/10 rounded-lg text-zinc-600 hover:text-amber-500 transition-all"
                      title="Copy analysis"
                    >
                      {copyFeedback === idx ? <CheckCircle className="w-3.5 h-3.5 text-amber-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => injectToChat(result.text)}
                      className="p-1.5 hover:bg-amber-500/10 rounded-lg text-zinc-600 hover:text-amber-500 transition-all"
                      title="Relay to Chat"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setResults(prev => prev.filter((_, i) => i !== idx))}
                      className="p-1.5 hover:bg-red-900/20 rounded-lg text-zinc-600 hover:text-red-500 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Directive Echo */}
                <div className="px-5 py-2 bg-black/30 border-b border-red-900/10">
                  <p className="text-[9px] text-zinc-600 font-mono italic truncate">
                    <span className="text-amber-900 not-italic font-bold">DIRECTIVE:</span> {result.directive}
                  </p>
                </div>

                {/* Analysis Body */}
                <div className="p-5 sm:p-8">
                  <div className="markdown-body text-sm sm:text-base leading-relaxed text-zinc-200 font-sans tracking-wide">
                    <Markdown>{result.text}</Markdown>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Empty state hint */}
          {results.length === 0 && !capturedImage && (
            <div className="text-center py-6 opacity-20 space-y-2">
              <Eye className="w-8 h-8 mx-auto text-amber-700" />
              <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-500">
                Awaiting visual input — capture, upload, or paste a snapshot
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SnapshotTab;
