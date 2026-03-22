
import React, { useState, useRef, useEffect } from 'react';
import { FileText, Search, Play, Upload, Image as ImageIcon, Video, Brain, Loader2, Info, Activity, Camera, RefreshCw, StopCircle, Globe, Link as LinkIcon, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { getAI, fileToBase64 } from '../services/geminiService';
import { GeminiModel } from '../types';

const LogicAnalytics: React.FC = () => {
  const [file, setFile] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'image' | 'video' | null>(null);
  const [analysis, setAnalysis] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [useSearch, setUseSearch] = useState(false);
  const [groundingUrls, setGroundingUrls] = useState<{ uri: string, title: string }[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsLiveMode(false);
  };

  const startCamera = async (mode: 'user' | 'environment') => {
    try {
      if (stream) stopCamera();
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode }
      });
      setStream(newStream);
      if (videoRef.current) videoRef.current.srcObject = newStream;
      setIsLiveMode(true);
      setFacingMode(mode);
    } catch (err: any) {
      alert(`Camera Access Denied: ${err.message}`);
    }
  };

  const captureAndAnalyze = async (taskPrompt: string) => {
    if (!isLiveMode || !videoRef.current || !canvasRef.current) return;
    
    setIsAnalyzing(true);
    setGroundingUrls([]);
    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0);
      
      const base64Data = canvas.toDataURL('image/jpeg').split(',')[1];
      
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: GeminiModel.PRO_PREVIEW,
        contents: { parts: [{ inlineData: { data: base64Data, mimeType: 'image/jpeg' } }, { text: taskPrompt }] },
        config: { 
          systemInstruction: "Analyze this live visual feed with the clinical precision of a high-end AI butler. Use a formal tone, addressing the Principal. Provide structured, logical insights based on the real-time surroundings. If search is enabled, find the best deals, facts, or real-time data to assist the Principal.", 
          temperature: 0.1,
          tools: useSearch ? [{ googleSearch: {} }] : undefined
        }
      });

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const urls = chunks.map((c: any) => c.web ? { uri: c.web.uri, title: c.web.title } : null).filter(Boolean) as any[];
      setGroundingUrls(urls);
      
      setAnalysis(response.text || 'Analysis failed to yield coherent logic.');
    } catch (err: any) { 
      alert(err.message); 
    } finally { 
      setIsAnalyzing(false); 
    }
  };

  const performAnalysis = async (taskPrompt: string) => {
    if (isLiveMode) {
      captureAndAnalyze(taskPrompt);
      return;
    }
    if (!file) return;
    setIsAnalyzing(true);
    setGroundingUrls([]);
    try {
      const ai = getAI();
      const base64Data = file.split(',')[1];
      const mimeType = file.split(';')[0].split(':')[1];
      const response = await ai.models.generateContent({
        model: GeminiModel.PRO_PREVIEW,
        contents: { parts: [{ inlineData: { data: base64Data, mimeType } }, { text: taskPrompt }] },
        config: { 
          systemInstruction: "Analyze this data with the clinical precision of a high-end AI butler. Use a formal tone, addressing the Principal. Provide structured, logical insights. If search is enabled, cross-reference with real-time web data.", 
          temperature: 0.1,
          tools: useSearch ? [{ googleSearch: {} }] : undefined
        }
      });

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const urls = chunks.map((c: any) => c.web ? { uri: c.web.uri, title: c.web.title } : null).filter(Boolean) as any[];
      setGroundingUrls(urls);

      setAnalysis(response.text || 'Analysis failed to yield coherent logic.');
    } catch (err: any) { alert(err.message); } finally { setIsAnalyzing(false); }
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  return (
    <div className="flex-1 p-4 sm:p-10 grid grid-cols-1 xl:grid-cols-12 gap-6 sm:gap-10 overflow-hidden bg-black">
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="xl:col-span-4 flex flex-col gap-6 sm:gap-8"
      >
        <div className="bg-zinc-900/40 border border-red-900/20 p-6 sm:p-8 rounded-2xl sm:rounded-3xl shadow-xl space-y-6 sm:space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 bg-red-800 rounded-xl flex items-center justify-center shadow-lg shadow-red-900/40">
                  {isLiveMode ? <Camera className="text-amber-400 w-5 h-5" /> : <Upload className="text-amber-400 w-5 h-5" />}
               </div>
               <h2 className="text-sm font-bold text-amber-500 uppercase tracking-widest">{isLiveMode ? 'Neural Vision' : 'Evidence Input'}</h2>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setUseSearch(!useSearch)}
                className={`p-2 rounded-lg border transition-all ${useSearch ? 'bg-amber-500/20 border-amber-500 text-amber-500' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-amber-500'}`}
                title="Web Recon (Google Search)"
              >
                <Globe className="w-4 h-4" />
              </button>
              <button 
                onClick={() => isLiveMode ? stopCamera() : startCamera('environment')}
                className={`p-2 rounded-lg border transition-all ${isLiveMode ? 'bg-red-900/20 border-red-500 text-red-500' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-amber-500'}`}
                title={isLiveMode ? "Stop Camera" : "Start Camera"}
              >
                {isLiveMode ? <StopCircle className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
              </button>
              {isLiveMode && (
                <button 
                  onClick={() => startCamera(facingMode === 'user' ? 'environment' : 'user')}
                  className="p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-amber-500 transition-all"
                  title="Switch Camera"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div 
            onClick={() => !isLiveMode && fileInputRef.current?.click()}
            className={`aspect-video rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center relative overflow-hidden group ${isLiveMode ? 'border-amber-500/50 bg-black' : 'border-red-900/30 hover:border-amber-500/50 cursor-pointer bg-black/40'}`}
          >
            {isLiveMode ? (
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                className="w-full h-full object-cover"
              />
            ) : file ? (
              fileType === 'image' ? <img src={file} className="w-full h-full object-contain p-2" /> : <video src={file} className="w-full h-full object-contain" />
            ) : (
              <div className="text-center group-hover:scale-110 transition-transform">
                <ImageIcon className="w-10 h-10 text-red-900 mb-2 mx-auto" />
                <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Ingest Data</p>
              </div>
            )}
            <input type="file" ref={fileInputRef} onChange={async (e) => {
              const f = e.target.files?.[0]; if (f) {
                const b = await fileToBase64(f); setFile(`data:${f.type};base64,${b}`); setFileType(f.type.startsWith('video') ? 'video' : 'image'); setAnalysis('');
              }
            }} hidden />
            <canvas ref={canvasRef} className="hidden" />
          </div>

          <div className="space-y-3">
             {[
               { icon: Search, label: isLiveMode ? 'Scan Surroundings' : 'Deep Pattern Scan', prompt: 'Identify anomalies and patterns in the current visual field.' },
               { icon: FileText, label: isLiveMode ? 'Extract Visual Data' : 'Metadata Extraction', prompt: 'Extract text, objects, and key visual data points.' },
               { icon: Info, label: isLiveMode ? 'Situational Summary' : 'Semantic Summary', prompt: 'Summarize the core meaning and context of this scene.' }
             ].map((btn, i) => (
               <button 
                key={i}
                onClick={() => performAnalysis(btn.prompt)}
                disabled={(!file && !isLiveMode) || isAnalyzing}
                className="w-full py-4 rounded-xl border border-red-900/20 bg-zinc-900/60 text-zinc-400 hover:text-amber-400 hover:border-amber-600/30 flex items-center gap-4 px-6 transition-all disabled:opacity-30 group"
               >
                 <btn.icon className="w-4 h-4 group-hover:text-amber-500" />
                 <span className="text-[10px] font-bold uppercase tracking-widest">{btn.label}</span>
               </button>
             ))}
          </div>
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="xl:col-span-8 bg-[#0d0d0e] border border-red-900/30 rounded-3xl overflow-hidden flex flex-col shadow-2xl"
      >
        <div className="p-6 border-b border-red-900/20 bg-red-950/10 flex items-center justify-between">
           <div className="flex items-center gap-3">
             <Activity className="w-5 h-5 text-amber-500 animate-pulse" />
             <h2 className="text-xs font-bold text-amber-500 uppercase tracking-widest">Analytical Buffer</h2>
           </div>
           {isAnalyzing && <div className="text-[10px] text-red-500 font-bold animate-pulse tracking-widest uppercase">Computing...</div>}
           {!isAnalyzing && analysis && (
             <button 
               onClick={async () => {
                 try {
                   await fetch('/api/memories', {
                     method: 'POST',
                     headers: { 'Content-Type': 'application/json' },
                     body: JSON.stringify({
                       title: `Visual Analysis - ${new Date().toLocaleTimeString()}`,
                       content: analysis,
                       type: 'Visual Logic'
                     })
                   });
                   alert('Committed to Memory Core, Principal.');
                 } catch (err) {
                   alert('Failed to commit memory.');
                 }
               }}
               className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[10px] font-bold text-amber-500 uppercase tracking-widest hover:bg-amber-500/20 transition-all"
             >
               <Save className="w-3 h-3" />
               Commit to Memory
             </button>
           )}
        </div>
        <div className="flex-1 p-10 font-serif text-lg leading-relaxed text-zinc-300 overflow-y-auto italic markdown-body">
           <AnimatePresence mode="wait">
             {isAnalyzing ? (
               <motion.div 
                key="analyzing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6 opacity-30"
               >
                 <div className="h-6 bg-red-900/20 rounded w-full animate-pulse" />
                 <div className="h-6 bg-red-900/20 rounded w-[90%] animate-pulse" />
                 <div className="h-6 bg-red-900/20 rounded w-[95%] animate-pulse" />
               </motion.div>
             ) : analysis ? (
               <motion.div
                key="analysis"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
               >
                 <Markdown>{analysis}</Markdown>
                 {groundingUrls.length > 0 && (
                   <div className="mt-8 pt-6 border-t border-red-900/20 grid grid-cols-1 gap-3">
                     <p className="text-[9px] uppercase font-black text-amber-700 tracking-[0.4em] mb-2">Verified Sources for the Principal</p>
                     {groundingUrls.map((link, i) => (
                       <a key={i} href={link.uri} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-4 text-xs text-amber-400/80 hover:text-amber-100 bg-black/40 p-4 rounded-2xl border border-red-900/20 transition-all hover:bg-red-900/20 group">
                         <span className="truncate font-medium">{link.title || link.uri}</span>
                         <LinkIcon className="w-4 h-4 opacity-30 group-hover:opacity-100 transition-opacity" />
                       </a>
                     ))}
                   </div>
                 )}
               </motion.div>
             ) : (
               <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full flex flex-col items-center justify-center opacity-20 grayscale scale-90"
               >
                  <Brain className="w-20 h-20 mb-6" />
                  <p className="uppercase tracking-[0.4em] font-bold text-xs">Awaiting Analysis Directive</p>
               </motion.div>
             )}
           </AnimatePresence>
        </div>
        <div className="p-4 border-t border-red-900/20 bg-black/60 flex justify-between px-8">
           <p className="text-[9px] font-bold text-amber-800 uppercase tracking-widest">Confidence Index: High</p>
           <p className="text-[9px] font-bold text-red-800 uppercase tracking-widest">Discretion: Guaranteed</p>
        </div>
      </motion.div>
    </div>
  );
};

export default LogicAnalytics;
