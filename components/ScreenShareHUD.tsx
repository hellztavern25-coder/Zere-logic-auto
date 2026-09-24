import React, { useRef, useEffect, useState } from 'react';
import { Monitor, X, Maximize2, Minimize2, Camera, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ScreenShareHUDProps {
  stream: MediaStream | null;
  onStop: () => void;
  onCaptureFrame?: (imageDataBase64: string, prompt?: string) => void;
  autoAttachOnSend?: boolean;
  setAutoAttachOnSend?: (val: boolean) => void;
}

export const ScreenShareHUD: React.FC<ScreenShareHUDProps> = ({
  stream,
  onStop,
  onCaptureFrame,
  autoAttachOnSend = false,
  setAutoAttachOnSend,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [resolution, setResolution] = useState<string>('Detecting...');
  const [isCapturing, setIsCapturing] = useState<boolean>(false);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(err => {
        console.warn('Screen video autoplay blocked or error:', err);
      });

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const settings = videoTrack.getSettings();
        if (settings.width && settings.height) {
          setResolution(`${settings.width}×${settings.height}`);
        }
        videoTrack.onended = () => {
          onStop();
        };
      }
    }
  }, [stream, onStop]);

  if (!stream) return null;

  const captureCurrentFrame = (customPrompt?: string) => {
    if (!videoRef.current) return;
    setIsCapturing(true);
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        const base64 = dataUrl.split(',')[1];
        onCaptureFrame?.(base64, customPrompt);
      }
    } catch (err) {
      console.error('Failed to capture frame from screen stream:', err);
    } finally {
      setTimeout(() => setIsCapturing(false), 400);
    }
  };

  return (
    <div className="fixed bottom-28 sm:bottom-36 right-4 sm:right-8 z-40">
      <AnimatePresence>
        {!isMinimized ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="w-80 sm:w-96 bg-[#0c090a]/95 border-2 border-amber-500/50 rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.8)] overflow-hidden backdrop-blur-xl"
          >
            {/* Header bar */}
            <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-red-950/80 via-black to-red-950/80 border-b border-red-900/40">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 flex items-center gap-1.5">
                  <Monitor className="w-3.5 h-3.5" />
                  Live Screen Stream
                </span>
                <span className="text-[9px] font-mono text-zinc-500 px-1.5 py-0.5 rounded bg-black/50 border border-zinc-800">
                  {resolution}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsMinimized(true)}
                  title="Minimize Stream"
                  className="p-1 rounded text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 transition-colors"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={onStop}
                  title="Disconnect Screen"
                  className="p-1 rounded text-red-400 hover:text-red-200 hover:bg-red-950 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Video preview container */}
            <div className="relative aspect-video bg-black/90 flex items-center justify-center overflow-hidden group">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-contain"
              />

              {/* Shutter flash overlay */}
              {isCapturing && (
                <div className="absolute inset-0 bg-amber-400/40 animate-pulse pointer-events-none" />
              )}

              {/* Hover quick capture overlay */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-xs">
                <button
                  onClick={() => captureCurrentFrame()}
                  className="px-3 py-1.5 bg-amber-500 text-black font-black text-[10px] uppercase tracking-wider rounded-lg shadow-lg hover:bg-amber-400 transition-all flex items-center gap-1.5 active:scale-95"
                >
                  <Camera className="w-3 h-3" />
                  Attach Frame
                </button>
              </div>
            </div>

            {/* Tactical Action Dock */}
            <div className="p-2.5 space-y-2 bg-gradient-to-b from-black/80 to-[#12080a]">
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() =>
                    captureCurrentFrame(
                      'Analyze what is currently visible on my screen. Provide a direct, tactical breakdown of the key elements, state, and any necessary actions, Principal.'
                    )
                  }
                  className="px-2.5 py-1.5 bg-red-950/80 hover:bg-red-900/90 border border-red-800/60 rounded-xl text-[9px] font-bold text-amber-300 uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow"
                >
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  Analyze Screen
                </button>

                <button
                  onClick={() =>
                    captureCurrentFrame(
                      'Examine the code, terminal output, or errors displayed on this screen. Identify any bugs, syntax issues, or architectural flaws with rigorous logic.'
                    )
                  }
                  className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/60 rounded-xl text-[9px] font-bold text-zinc-200 uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow"
                >
                  <AlertCircle className="w-3 h-3 text-amber-500" />
                  Debug Code/Logs
                </button>
              </div>

              {/* Auto-attach toggle checkbox */}
              <div className="flex items-center justify-between px-2 pt-1 border-t border-zinc-900 text-[9px] text-zinc-400 font-mono">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoAttachOnSend}
                    onChange={(e) => setAutoAttachOnSend?.(e.target.checked)}
                    className="rounded border-red-900 text-amber-500 focus:ring-amber-500/30 bg-zinc-950"
                  />
                  <span>Auto-attach live screen on send</span>
                </label>
                <button
                  onClick={() => captureCurrentFrame()}
                  className="text-amber-500/80 hover:text-amber-400 underline uppercase text-[8px]"
                >
                  Snap Frame
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          /* Minimized pill state */
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => setIsMinimized(false)}
            className="cursor-pointer flex items-center gap-2.5 px-3.5 py-2 bg-red-950/90 border border-amber-500/40 rounded-full shadow-2xl backdrop-blur-md hover:border-amber-500 transition-all hover:scale-105"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <Monitor className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[10px] font-mono font-bold text-zinc-200 uppercase tracking-wider">
              Screen Active ({resolution})
            </span>
            <Maximize2 className="w-3 h-3 text-zinc-400 ml-1" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ScreenShareHUD;
