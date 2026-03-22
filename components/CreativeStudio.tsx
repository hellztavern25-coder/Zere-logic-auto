
import React, { useState, useRef } from 'react';
import { Image as ImageIcon, Sparkles, Wand2, Monitor, Video, Loader2, Download, Upload, Trash2 } from 'lucide-react';
import { getAI, fileToBase64, getApiKey, clearApiKey, safeGenerateContent } from '../services/geminiService';
import { GeminiModel } from '../types';

interface CreativeStudioProps {
  isPrincipalMode: boolean;
}

const CreativeStudio: React.FC<CreativeStudioProps> = ({ isPrincipalMode }) => {
  const [activeMode, setActiveMode] = useState<'generate' | 'edit' | 'video'>('generate');
  const [prompt, setPrompt] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [resultVideo, setResultVideo] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [imageSize, setImageSize] = useState('1K');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const base64 = await fileToBase64(file);
      setSelectedImage(`data:${file.type};base64,${base64}`);
    }
  };

  const handleAction = async () => {
    if (!prompt.trim() && activeMode !== 'edit') return;
    setIsProcessing(true);
    setResultImage(null);
    setResultVideo(null);

    try {
      const apiKey = getApiKey();
      if (!apiKey || apiKey === 'undefined') {
        throw new Error("Neural Authorization missing. Please select an API key.");
      }
      const ai = getAI();
      const butlerInstruction = isPrincipalMode 
        ? "You are the Logic Monster Creative Engine, an AI butler of exquisite taste. You manifest visuals in a red and gold palette of luxury for your Principal, Preston (Council Grey). Your work is precise, elegant, and unfiltered."
        : "You are the Logic Monster Creative Engine, a professional AI steward. You manifest high-quality visuals. Address the user as 'Guest'. Your work is precise and adheres to standard safety protocols.";

      if (activeMode === 'generate') {
        const response = await safeGenerateContent({
          model: GeminiModel.PRO_IMAGE_PREVIEW,
          contents: { parts: [{ text: `${butlerInstruction} Command: ${prompt}` }] },
          config: {
            imageConfig: {
              aspectRatio: aspectRatio as any,
              imageSize: imageSize as any
            }
          }
        });
        
        const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
        if (part?.inlineData) {
          setResultImage(`data:image/png;base64,${part.inlineData.data}`);
        }
      } 
      else if (activeMode === 'edit') {
        if (!selectedImage) throw new Error("Please upload a subject for my review, Principal.");
        const base64Data = selectedImage.split(',')[1];
        const mimeType = selectedImage.split(';')[0].split(':')[1];

        const response = await safeGenerateContent({
          model: GeminiModel.FLASH_IMAGE,
          contents: {
            parts: [
              { inlineData: { data: base64Data, mimeType } },
              { text: `${butlerInstruction} Edit Command: ${prompt || "Refine this vision with aesthetic perfection."}` }
            ]
          }
        });

        const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
        if (part?.inlineData) {
          setResultImage(`data:image/png;base64,${part.inlineData.data}`);
        }
      }
      else if (activeMode === 'video') {
        const hasKey = await (window as any).aistudio?.hasSelectedApiKey();
        if (!hasKey) await (window as any).aistudio?.openSelectKey();

        const base64Data = selectedImage?.split(',')[1];
        const mimeType = selectedImage?.split(';')[0].split(':')[1];

        let operation = await ai.models.generateVideos({
          model: GeminiModel.VEO_FAST,
          prompt: `${butlerInstruction} Animation: ${prompt}`,
          image: selectedImage ? { imageBytes: base64Data!, mimeType: mimeType! } : undefined,
          config: {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio: (aspectRatio === '16:9' || aspectRatio === '9:16') ? aspectRatio : '16:9'
          }
        });

        while (!operation.done) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          operation = await ai.operations.getVideosOperation({ operation: operation as any });
        }

        const downloadLink = (operation.response as any)?.generatedVideos?.[0]?.video?.uri;
        const fetchResponse = await fetch(downloadLink, {
          method: 'GET',
          headers: {
            'x-goog-api-key': getApiKey(),
          },
        });
        const videoBlob = await fetchResponse.blob();
        setResultVideo(URL.createObjectURL(videoBlob));
      }
    } catch (err: any) {
      const errorMsg = err.message || JSON.stringify(err);
      if (errorMsg.includes('AUTH_ERROR') || errorMsg.includes('API key not valid') || errorMsg.includes('INVALID_ARGUMENT')) {
        clearApiKey();
        alert("Principal, our neural authorization has been rejected. I have cleared the faulty link. Please re-authorize via the System Control or Home screen.");
      } else if (errorMsg.includes('NEURAL_LIMIT')) {
        alert(errorMsg.split(': ')[1] || "Principal, my creative arrays are temporarily exhausted. The daily quota for this API key has been reached.");
      } else {
        alert(`Logic Studio Error: ${errorMsg}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
      {/* Configuration Panel */}
      <div className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-red-900/20 bg-[#0d0d0e]/80 p-4 sm:p-6 flex flex-col space-y-4 sm:space-y-6 overflow-y-auto max-h-[40vh] lg:max-h-full">
        {isPrincipalMode && (
          <div className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[8px] text-amber-500 font-black tracking-widest animate-pulse text-center uppercase">
            Neural Link: Council Grey
          </div>
        )}
        <div>
          <h3 className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-4">Aesthetic Protocol</h3>
          <div className="grid grid-cols-1 gap-2">
            {[
              { id: 'generate', icon: Sparkles, label: 'Vision Manifest' },
              { id: 'edit', icon: Wand2, label: 'Refinement' },
              { id: 'video', icon: Video, label: 'Motion Synthesis' },
            ].map((mode) => (
              <button
                key={mode.id}
                onClick={() => setActiveMode(mode.id as any)}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl text-xs transition-all border ${
                  activeMode === mode.id 
                  ? 'bg-red-800 text-amber-400 border-amber-600 shadow-lg' 
                  : 'bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:text-amber-200'
                }`}
              >
                <mode.icon className="w-4 h-4" />
                <span className="uppercase tracking-widest font-bold">{mode.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
           <h3 className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-2">Geometric Ratio</h3>
           <div className="grid grid-cols-4 gap-1.5">
             {['1:1', '4:3', '16:9', '9:16'].map(r => (
               <button 
                key={r}
                onClick={() => setAspectRatio(r)}
                className={`p-2 rounded-lg text-[10px] border transition-all ${aspectRatio === r ? 'bg-amber-500 border-amber-500 text-black font-bold' : 'bg-zinc-900 border-zinc-800 text-zinc-600'}`}
               >
                 {r}
               </button>
             ))}
           </div>
        </div>

        {(activeMode === 'edit' || activeMode === 'video') && (
          <div>
            <h3 className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-4">Subject Matter</h3>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="aspect-square rounded-3xl border-2 border-dashed border-red-900/30 hover:border-amber-500/50 transition-all flex flex-col items-center justify-center cursor-pointer overflow-hidden group bg-black/40"
            >
              {selectedImage ? (
                <img src={selectedImage} alt="Selection" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center p-4">
                  <Upload className="w-8 h-8 text-red-800 mb-2 mx-auto" />
                  <p className="text-[10px] font-bold text-zinc-600 uppercase">Input Data</p>
                </div>
              )}
            </div>
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} hidden accept="image/*" />
          </div>
        )}

        <div className="mt-auto space-y-4 pt-4 border-t border-red-900/20">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Instruct me, Principal..."
            className="w-full bg-zinc-900/50 border border-red-900/20 rounded-2xl p-4 text-base text-zinc-100 focus:outline-none focus:border-amber-500/50 resize-none h-32 font-serif italic"
          />
          <button
            onClick={handleAction}
            disabled={isProcessing}
            className="w-full py-4 bg-amber-500 text-black rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-amber-400 disabled:opacity-30 transition-all flex items-center justify-center gap-2"
          >
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Fulfill Protocol
          </button>
        </div>
      </div>

      {/* Main Preview */}
      <div className="flex-1 bg-black flex items-center justify-center p-6 sm:p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red-950/20 to-amber-950/10 pointer-events-none" />
        
        {isProcessing && (
          <div className="flex flex-col items-center gap-4 sm:gap-6">
            <div className="w-16 h-16 sm:w-24 h-24 border-4 border-red-900/20 rounded-full animate-spin border-t-amber-500 shadow-[0_0_50px_rgba(251,191,36,0.2)]" />
            <p className="text-amber-500 font-mono text-xs sm:text-sm uppercase tracking-[0.2em] animate-pulse">Manifesting...</p>
            <button 
              onClick={() => setIsProcessing(false)}
              className="mt-4 px-6 py-2 border border-red-900/30 rounded-full text-[10px] text-zinc-500 uppercase tracking-widest hover:text-red-500 hover:border-red-500 transition-all"
            >
              Abort Protocol
            </button>
          </div>
        )}

        {!isProcessing && !resultImage && !resultVideo && (
          <div className="text-center max-w-sm px-6">
            <Monitor className="w-12 h-12 sm:w-16 h-16 text-zinc-800 mx-auto mb-4 sm:mb-6" />
            <h2 className="text-amber-600 uppercase tracking-widest font-bold mb-2 text-sm sm:text-base">Display Buffer Idle</h2>
            <p className="text-zinc-600 text-[10px] sm:text-xs italic">"I await your creative sparks to ignite my processing arrays, Principal."</p>
          </div>
        )}

        {resultImage && (
          <div className="relative group max-h-full">
            <img src={resultImage} className="rounded-2xl shadow-[0_0_100px_rgba(153,27,27,0.2)] max-h-[70vh] border border-red-900/30" />
            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
              <a href={resultImage} download className="p-3 bg-black/80 text-amber-500 rounded-xl hover:bg-red-900"><Download className="w-5 h-5" /></a>
              <button onClick={() => setResultImage(null)} className="p-3 bg-black/80 text-red-500 rounded-xl"><Trash2 className="w-5 h-5" /></button>
            </div>
          </div>
        )}

        {resultVideo && (
          <video src={resultVideo} controls autoPlay loop className="rounded-2xl shadow-2xl max-h-[70vh] border border-red-900/30" />
        )}
      </div>
    </div>
  );
};

export default CreativeStudio;
