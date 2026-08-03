import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Monitor, 
  Share2, 
  PenTool, 
  Eraser, 
  Sparkles, 
  RefreshCw, 
  Zap, 
  Activity, 
  Maximize2, 
  Sliders, 
  Crosshair, 
  Hand, 
  Eye, 
  Layers, 
  BrainCircuit, 
  Camera, 
  AlertCircle,
  X
} from 'lucide-react';
import { getAI } from '../services/geminiService';
import { GeminiModel } from '../types';

interface TouchPoint {
  id: number;
  x: number;
  y: number;
  radius: number;
  opacity: number;
  timestamp: number;
  type: string;
}

interface DrawPath {
  id: string;
  color: string;
  width: number;
  points: { x: number; y: number }[];
}

export const AssistantManager: React.FC = () => {
  // Screen Sharing State
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isSimulatedFeed, setIsSimulatedFeed] = useState(false);
  const [screenResolution, setScreenResolution] = useState({ width: 1920, height: 1080 });
  const [fps, setFps] = useState(30);
  const [frameCount, setFrameCount] = useState(0);

  // Overlay & Touch Tool State
  const [activeTool, setActiveTool] = useState<'pointer' | 'pen' | 'laser' | 'grid'>('pointer');
  const [penColor, setPenColor] = useState('#f59e0b');
  const [penWidth, setPenWidth] = useState(4);
  const [overlayOpacity, setOverlayOpacity] = useState(0.85);
  const [rippleEnabled, setRippleEnabled] = useState(true);

  // Drawing & Touch Event State
  const [touchRipples, setTouchRipples] = useState<TouchPoint[]>([]);
  const [paths, setPaths] = useState<DrawPath[]>([]);
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [laserPos, setLaserPos] = useState<{ x: number; y: number } | null>(null);

  // Daemon IPC & AI State
  const [daemonStatus, setDaemonStatus] = useState<any>({ status: 'checking' });
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Fetch Daemon Status
  const fetchDaemonStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_status' })
      });
      const data = await res.json();
      setDaemonStatus(data);
    } catch {
      setDaemonStatus({ status: 'offline' });
    }
  }, []);

  useEffect(() => {
    fetchDaemonStatus();
    const interval = setInterval(fetchDaemonStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchDaemonStatus]);

  // Start Real Screen Sharing using getDisplayMedia
  const startScreenShare = async () => {
    try {
      setAiAnalysis(null);
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error('DisplayMedia API not supported in this environment.');
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
          frameRate: { max: 60 }
        } as any,
        audio: false
      });

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      let width = 1920;
      let height = 1080;
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const settings = videoTrack.getSettings();
        if (settings.width && settings.height) {
          width = settings.width;
          height = settings.height;
          setScreenResolution({ width, height });
        }
        videoTrack.onended = () => {
          stopScreenShare();
        };
      }

      setIsScreenSharing(true);
      setIsSimulatedFeed(false);

      // Notify Daemon
      fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_screen',
          active: true,
          width,
          height
        })
      }).catch(() => null);

    } catch (err: any) {
      console.warn('Screen share failed or denied, switching to Simulated HUD Feed:', err);
      startSimulatedFeed();
    }
  };

  // Start Simulated Screen Feed for Iframe/Sandbox compatibility
  const startSimulatedFeed = () => {
    setIsScreenSharing(true);
    setIsSimulatedFeed(true);
    setScreenResolution({ width: 1920, height: 1080 });
  };

  // Stop Screen Share
  const stopScreenShare = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScreenSharing(false);
    setIsSimulatedFeed(false);

    fetch('/api/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_screen', active: false })
    }).catch(() => null);
  };

  // Touch & Pointer Overlay Interactions
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Record Touch Ripple FX
    if (rippleEnabled) {
      const newRipple: TouchPoint = {
        id: Date.now() + Math.random(),
        x,
        y,
        radius: 12,
        opacity: 1.0,
        timestamp: Date.now(),
        type: e.pointerType || 'touch'
      };
      setTouchRipples(prev => [...prev.slice(-15), newRipple]);
    }

    if (activeTool === 'pen') {
      setIsDrawing(true);
      setCurrentPath([{ x, y }]);
    } else if (activeTool === 'laser') {
      setLaserPos({ x, y });
    }

    // Send touch event telemetry to daemon socket
    fetch('/api/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'record_touch',
        touch: {
          id: Date.now(),
          x: Math.round(x),
          y: Math.round(y),
          type: e.pointerType,
          pressure: e.pressure || 1.0,
          gesture: activeTool
        }
      })
    }).catch(() => null);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (activeTool === 'laser') {
      setLaserPos({ x, y });
    }

    if (isDrawing && activeTool === 'pen') {
      setCurrentPath(prev => [...prev, { x, y }]);
    }
  };

  const handlePointerUp = () => {
    if (isDrawing && currentPath.length > 0) {
      const newPath: DrawPath = {
        id: 'path_' + Date.now(),
        color: penColor,
        width: penWidth,
        points: currentPath
      };
      setPaths(prev => [...prev, newPath]);
      setCurrentPath([]);

      fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_annotation',
          annotation: newPath
        })
      }).catch(() => null);
    }
    setIsDrawing(false);
    setLaserPos(null);
  };

  // Render Overlay Canvas (Drawings, Ripples, Grid, Laser)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;

    const render = () => {
      if (!running) return;
      
      const width = containerRef.current?.clientWidth || 800;
      const height = containerRef.current?.clientHeight || 450;
      
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      ctx.clearRect(0, 0, width, height);

      // 1. Draw Grid Overlay if selected
      if (activeTool === 'grid') {
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.15)';
        ctx.lineWidth = 1;
        const gridSize = 40;
        for (let x = 0; x < width; x += gridSize) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
        for (let y = 0; y < height; y += gridSize) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }
      }

      // 2. Draw Stored Paths
      paths.forEach(path => {
        if (path.points.length < 2) return;
        ctx.strokeStyle = path.color;
        ctx.lineWidth = path.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(path.points[0].x, path.points[0].y);
        for (let i = 1; i < path.points.length; i++) {
          ctx.lineTo(path.points[i].x, path.points[i].y);
        }
        ctx.stroke();
      });

      // 3. Draw Active Path
      if (currentPath.length > 1) {
        ctx.strokeStyle = penColor;
        ctx.lineWidth = penWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(currentPath[0].x, currentPath[0].y);
        for (let i = 1; i < currentPath.length; i++) {
          ctx.lineTo(currentPath[i].x, currentPath[i].y);
        }
        ctx.stroke();
      }

      // 4. Draw Touch Ripples
      const now = Date.now();
      setTouchRipples(prev => 
        prev
          .map(r => {
            const age = (now - r.timestamp) / 1000;
            return {
              ...r,
              radius: 12 + age * 80,
              opacity: Math.max(0, 1 - age * 1.8)
            };
          })
          .filter(r => r.opacity > 0)
      );

      touchRipples.forEach(r => {
        ctx.strokeStyle = `rgba(245, 158, 11, ${r.opacity})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = `rgba(239, 68, 68, ${r.opacity * 0.8})`;
        ctx.beginPath();
        ctx.arc(r.x, r.y, 4, 0, Math.PI * 2);
        ctx.fill();

        // Target Reticle Box
        ctx.strokeStyle = `rgba(245, 158, 11, ${r.opacity * 0.5})`;
        ctx.strokeRect(r.x - 12, r.y - 12, 24, 24);
      });

      // 5. Laser Pointer FX
      if (laserPos) {
        const gradient = ctx.createRadialGradient(laserPos.x, laserPos.y, 0, laserPos.x, laserPos.y, 20);
        gradient.addColorStop(0, 'rgba(239, 68, 68, 1)');
        gradient.addColorStop(0.5, 'rgba(245, 158, 11, 0.6)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(laserPos.x, laserPos.y, 20, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(laserPos.x, laserPos.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      setFrameCount(c => c + 1);
      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => {
      running = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [activeTool, paths, currentPath, touchRipples, laserPos, penColor, penWidth]);

  // Clear Annotations
  const clearAnnotations = () => {
    setPaths([]);
    setCurrentPath([]);
    setTouchRipples([]);
    fetch('/api/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'clear_annotations' })
    }).catch(() => null);
  };

  // AI Vision Screen Scan
  const analyzeScreenWithAI = async () => {
    setIsAnalyzing(true);
    setAiAnalysis(null);
    try {
      const ai = getAI();
      const canvas = canvasRef.current;
      
      let imagePart = null;
      if (canvas) {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        imagePart = {
          inlineData: {
            data: dataUrl.split(',')[1],
            mimeType: 'image/jpeg'
          }
        };
      }

      const prompt = `
[ZEREO ASSISTANT MANAGER DAEMON AI SCREEN INSPECTOR]
Analyze the provided screen capture and touch overlay frame.
Provide:
1. Primary visual focal points and detected UI elements.
2. Annotations or touch reticles highlighted by the Principal.
3. Strategic summary or suggested action vector.
Keep the response sharp, objective, and in ZereØ Steward persona. Address as Principal.
`;

      const contents = imagePart ? [prompt, imagePart] : [prompt];
      const response = await ai.models.generateContent({
        model: GeminiModel.FLASH_36,
        contents
      });

      setAiAnalysis(response.text || 'Screen inspection complete. No anomalies detected.');

    } catch (err: any) {
      setAiAnalysis(`AI Screen Analysis Error: ${err.message || 'Inspection failed'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="w-full flex flex-col space-y-6">
      {/* Top Header Card */}
      <div className="bg-zinc-900/50 border border-red-900/30 p-6 md:p-8 rounded-3xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-red-900/20 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-950/60 border border-red-800/40 rounded-2xl text-amber-400">
              <BrainCircuit className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-widest text-amber-400 flex items-center gap-2">
                Assistant Manager Daemon
              </h2>
              <p className="text-xs text-zinc-400 font-mono">
                Screen Sharing Telemetry & Touch Overlay Engine • Socket: /tmp/assistant_mgr.sock
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-full border border-red-900/30">
              <span className={`w-2.5 h-2.5 rounded-full ${
                daemonStatus.status === 'ok' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-amber-500 animate-pulse'
              }`} />
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-300 font-mono">
                {daemonStatus.status === 'ok' ? 'DAEMON ONLINE' : 'DAEMON STANDBY'}
              </span>
            </div>

            <button
              onClick={fetchDaemonStatus}
              className="p-2 bg-red-950/60 border border-red-900/40 hover:bg-red-900/40 text-amber-400 rounded-xl transition-all"
              title="Sync Daemon"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Status Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
          <div className="bg-black/40 p-3 rounded-2xl border border-red-900/20">
            <span className="text-zinc-500 block uppercase text-[9px]">Screen Stream</span>
            <span className="text-amber-400 font-bold">
              {isScreenSharing ? (isSimulatedFeed ? 'SIMULATED HUD' : 'LIVE DISPLAY') : 'INACTIVE'}
            </span>
          </div>

          <div className="bg-black/40 p-3 rounded-2xl border border-red-900/20">
            <span className="text-zinc-500 block uppercase text-[9px]">Resolution / FPS</span>
            <span className="text-zinc-200 font-bold">
              {screenResolution.width}x{screenResolution.height} @ {fps}FPS
            </span>
          </div>

          <div className="bg-black/40 p-3 rounded-2xl border border-red-900/20">
            <span className="text-zinc-500 block uppercase text-[9px]">Active Touch Ripples</span>
            <span className="text-amber-400 font-bold">{touchRipples.length} Targets</span>
          </div>

          <div className="bg-black/40 p-3 rounded-2xl border border-red-900/20">
            <span className="text-zinc-500 block uppercase text-[9px]">Draw Paths</span>
            <span className="text-zinc-200 font-bold">{paths.length} Layers</span>
          </div>
        </div>
      </div>

      {/* Toolbar & Controls Bar */}
      <div className="bg-zinc-900/40 border border-red-900/20 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4">
        {/* Screen Control Group */}
        <div className="flex items-center gap-2">
          {!isScreenSharing ? (
            <button
              onClick={startScreenShare}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-black uppercase text-xs tracking-wider rounded-xl flex items-center gap-2 shadow-[0_0_15px_rgba(245,158,11,0.3)] transition-all"
            >
              <Share2 className="w-4 h-4" />
              Start Screen Share
            </button>
          ) : (
            <button
              onClick={stopScreenShare}
              className="px-4 py-2.5 bg-red-950 border border-red-800 text-red-400 hover:bg-red-900 hover:text-white font-bold uppercase text-xs tracking-wider rounded-xl flex items-center gap-2 transition-all"
            >
              <X className="w-4 h-4" />
              Stop Share
            </button>
          )}

          <button
            onClick={startSimulatedFeed}
            className={`px-3 py-2.5 border rounded-xl text-xs font-mono font-bold uppercase flex items-center gap-1.5 transition-all ${
              isSimulatedFeed 
                ? 'bg-red-950/80 border-amber-500 text-amber-400' 
                : 'bg-black/40 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Simulated Feed
          </button>
        </div>

        {/* Overlay Tool Selector */}
        <div className="flex items-center gap-1 bg-black/50 p-1 rounded-xl border border-red-900/30">
          <button
            onClick={() => setActiveTool('pointer')}
            className={`p-2 rounded-lg transition-all ${
              activeTool === 'pointer' ? 'bg-amber-500 text-black shadow' : 'text-zinc-400 hover:text-white'
            }`}
            title="Touch Target Ripple"
          >
            <Hand className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveTool('pen')}
            className={`p-2 rounded-lg transition-all ${
              activeTool === 'pen' ? 'bg-amber-500 text-black shadow' : 'text-zinc-400 hover:text-white'
            }`}
            title="Freehand Annotation Pen"
          >
            <PenTool className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveTool('laser')}
            className={`p-2 rounded-lg transition-all ${
              activeTool === 'laser' ? 'bg-amber-500 text-black shadow' : 'text-zinc-400 hover:text-white'
            }`}
            title="Laser Pointer"
          >
            <Crosshair className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveTool('grid')}
            className={`p-2 rounded-lg transition-all ${
              activeTool === 'grid' ? 'bg-amber-500 text-black shadow' : 'text-zinc-400 hover:text-white'
            }`}
            title="Tactical Grid HUD"
          >
            <Layers className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-zinc-800 mx-1" />

          {/* Color Picker */}
          <input
            type="color"
            value={penColor}
            onChange={(e) => setPenColor(e.target.value)}
            className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border-0"
            title="Pen Color"
          />

          <button
            onClick={clearAnnotations}
            className="p-2 text-zinc-400 hover:text-red-400 transition-colors"
            title="Clear Annotations"
          >
            <Eraser className="w-4 h-4" />
          </button>
        </div>

        {/* AI Screen Inspector Button */}
        <button
          onClick={analyzeScreenWithAI}
          disabled={isAnalyzing}
          className="px-4 py-2.5 bg-red-950/80 border border-red-800 hover:bg-amber-500 hover:text-black text-amber-400 font-bold text-xs uppercase tracking-wider rounded-xl flex items-center gap-2 transition-all disabled:opacity-50"
        >
          {isAnalyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          AI Screen Scan
        </button>
      </div>

      {/* Screen Share Stage & Touch Canvas Overlay */}
      <div 
        ref={containerRef}
        className="relative w-full aspect-video bg-black rounded-3xl border border-red-900/40 overflow-hidden shadow-2xl flex items-center justify-center select-none"
      >
        {/* Real Screen Video */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-contain ${
            isScreenSharing && !isSimulatedFeed ? 'block' : 'hidden'
          }`}
        />

        {/* Simulated Desktop HUD Feed when real screen share is inactive/simulated */}
        {(!isScreenSharing || isSimulatedFeed) && (
          <div className="absolute inset-0 w-full h-full bg-[#050508] p-8 flex flex-col justify-between overflow-hidden">
            {/* Animated Grid Lines */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f1915_1px,transparent_1px),linear-gradient(to_bottom,#1f1915_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-30" />

            {/* Top Bar HUD */}
            <div className="relative z-10 flex justify-between items-center border-b border-red-900/30 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_#ef4444]" />
                <span className="font-mono text-xs text-amber-400 font-bold uppercase tracking-widest">
                  ZereØ HUD DISPLAY MATRIX • 1920x1080
                </span>
              </div>
              <span className="font-mono text-[10px] text-zinc-500 uppercase">
                LATENCY: 4ms • TELEMETRY ACTIVE
              </span>
            </div>

            {/* Center Visual Area */}
            <div className="relative z-10 flex flex-col items-center justify-center text-center space-y-4 my-auto">
              <div className="relative">
                <div className="w-24 h-24 rounded-full border border-red-900/40 border-t-amber-500 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Monitor className="w-10 h-10 text-amber-400" />
                </div>
              </div>
              <p className="text-zinc-400 font-mono text-xs uppercase tracking-wider">
                {isSimulatedFeed 
                  ? "Simulated HUD Screen Stream Active • Touch Screen Overlay Ready" 
                  : "Click 'Start Screen Share' to stream your desktop display into the Manager"}
              </p>
            </div>

            {/* Bottom Status Bar */}
            <div className="relative z-10 flex justify-between items-center border-t border-red-900/30 pt-4 font-mono text-[10px] text-zinc-500">
              <span>TOUCH RETICLES: {touchRipples.length}</span>
              <span>OVERLAY OPACITY: {Math.round(overlayOpacity * 100)}%</span>
            </div>
          </div>
        )}

        {/* Interactive Touch Overlay Canvas */}
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{ opacity: overlayOpacity }}
          className="absolute inset-0 w-full h-full cursor-crosshair z-20 touch-none"
        />
      </div>

      {/* AI Screen Inspection Output Card */}
      <AnimatePresence>
        {aiAnalysis && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-zinc-900/80 border border-amber-500/40 p-6 rounded-3xl space-y-3 relative"
          >
            <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold uppercase text-xs tracking-wider">
                <BrainCircuit className="w-4 h-4" />
                AI Screen Analysis Report
              </div>
              <button 
                onClick={() => setAiAnalysis(null)} 
                className="text-zinc-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed">
              {aiAnalysis}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AssistantManager;
