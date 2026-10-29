import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Music, 
  Video, 
  Upload, 
  Trash2, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize2, 
  Camera, 
  Search, 
  Copy, 
  Check, 
  Download, 
  Bot, 
  MessageSquare, 
  Clock, 
  Sparkles, 
  Eye, 
  FileUp, 
  RefreshCw, 
  RotateCcw,
  Zap,
  Sliders,
  Radio,
  Share2,
  Tag,
  Loader2,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { AppTab, VaultFileItem, VaultFileType } from '../types';
import { 
  getAllVaultFiles, 
  saveVaultFile, 
  deleteVaultFile, 
  clearAllVaultFiles, 
  detectFileType, 
  parseDocumentFile, 
  getPreloadedVaultFiles 
} from '../services/fileVaultService';
import { safeGenerateContent } from '../services/geminiService';

interface FilesTabProps {
  onNavigate?: (tab: string) => void;
  isPrincipalMode?: boolean;
}

export const FilesTab: React.FC<FilesTabProps> = ({ onNavigate, isPrincipalMode = true }) => {
  const [files, setFiles] = useState<VaultFileItem[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<VaultFileType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  // Document viewer state
  const [docSearch, setDocSearch] = useState('');
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg'>('base');
  const [viewMode, setViewMode] = useState<'formatted' | 'raw'>('formatted');
  const [copiedText, setCopiedText] = useState(false);

  // Audio player state
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioPlaybackRate, setAudioPlaybackRate] = useState(1);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [audioVolume, setAudioVolume] = useState(0.85);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Video player state
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoPlaybackRate, setVideoPlaybackRate] = useState(1);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [capturedFrameUrl, setCapturedFrameUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // AI Interaction state
  const [interactionPrompt, setInteractionPrompt] = useState('');
  const [interactionResult, setInteractionResult] = useState<string | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);
  const [interactionHistory, setInteractionHistory] = useState<Array<{ q: string; a: string; time: number }>>([]);

  // File Input Refs
  const wordInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const anyFileInputRef = useRef<HTMLInputElement>(null);

  // Load files from IndexedDB on mount
  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    try {
      const stored = await getAllVaultFiles();
      if (stored && stored.length > 0) {
        setFiles(stored);
        if (!selectedFileId) setSelectedFileId(stored[0].id);
      } else {
        // Preload default tactical files
        const defaults = getPreloadedVaultFiles();
        for (const f of defaults) {
          await saveVaultFile(f);
        }
        setFiles(defaults);
        if (!selectedFileId) setSelectedFileId(defaults[0].id);
      }
    } catch (err) {
      console.warn('Error loading files:', err);
      const defaults = getPreloadedVaultFiles();
      setFiles(defaults);
      if (!selectedFileId) setSelectedFileId(defaults[0].id);
    }
  };

  const selectedFile = files.find(f => f.id === selectedFileId) || files[0] || null;

  // Handle Audio Element & Web Audio Visualizer
  useEffect(() => {
    if (!selectedFile || selectedFile.type !== 'audio' || !selectedFile.dataUrl) {
      if (audioRef.current) {
        audioRef.current.pause();
        setIsPlayingAudio(false);
      }
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;

    audio.src = selectedFile.dataUrl;
    audio.playbackRate = audioPlaybackRate;
    audio.volume = audioVolume;
    audio.muted = isAudioMuted;

    const handleLoadedMetadata = () => {
      setAudioDuration(audio.duration || selectedFile.duration || 0);
    };

    const handleTimeUpdate = () => {
      setAudioCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlayingAudio(false);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [selectedFile?.id, selectedFile?.dataUrl]);

  // Audio Canvas Visualizer
  useEffect(() => {
    if (!isPlayingAudio || !audioRef.current || !audioCanvasRef.current) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    try {
      if (!audioContextRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioCtx();
      }

      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      if (!analyserRef.current) {
        analyserRef.current = ctx.createAnalyser();
        analyserRef.current.fftSize = 64;
      }

      if (!sourceNodeRef.current && audioRef.current) {
        try {
          sourceNodeRef.current = ctx.createMediaElementSource(audioRef.current);
          sourceNodeRef.current.connect(analyserRef.current);
          analyserRef.current.connect(ctx.destination);
        } catch (e) {
          // Source already connected or cors
        }
      }

      const canvas = audioCanvasRef.current;
      const canvasCtx = canvas.getContext('2d');
      if (!canvasCtx) return;

      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        animFrameRef.current = requestAnimationFrame(draw);
        if (!analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArray);

        canvasCtx.fillStyle = '#0a0a0b';
        canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 1.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * canvas.height * 0.9;

          // Polished Gold and Deep Burgundy gradient
          const gradient = canvasCtx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
          gradient.addColorStop(0, '#7f1d1d');
          gradient.addColorStop(0.5, '#b45309');
          gradient.addColorStop(1, '#fbbf24');

          canvasCtx.fillStyle = gradient;
          canvasCtx.fillRect(x, canvas.height - barHeight, barWidth - 2, barHeight);

          x += barWidth + 1;
        }
      };

      draw();
    } catch (e) {
      console.warn('Audio visualization error:', e);
    }

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlayingAudio]);

  // Video Event Handlers
  useEffect(() => {
    if (!selectedFile || selectedFile.type !== 'video' || !selectedFile.dataUrl) {
      if (videoRef.current) {
        videoRef.current.pause();
        setIsPlayingVideo(false);
      }
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    video.src = selectedFile.dataUrl;
    video.playbackRate = videoPlaybackRate;
    video.muted = isVideoMuted;

    const handleLoadedMetadata = () => {
      setVideoDuration(video.duration || selectedFile.duration || 0);
    };

    const handleTimeUpdate = () => {
      setVideoCurrentTime(video.currentTime);
    };

    const handleEnded = () => {
      setIsPlayingVideo(false);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
    };
  }, [selectedFile?.id, selectedFile?.dataUrl]);

  // Process Ingested Files
  const handleIngestFiles = async (fileList: FileList | File[]) => {
    const rawFiles = Array.from(fileList);
    if (rawFiles.length === 0) return;

    setIsUploading(true);
    setUploadProgress(`Ingesting ${rawFiles.length} item(s) from device...`);

    const newItems: VaultFileItem[] = [];

    for (let i = 0; i < rawFiles.length; i++) {
      const file = rawFiles[i];
      setUploadProgress(`Processing (${i + 1}/${rawFiles.length}): ${file.name}`);

      const fileType = detectFileType(file);
      const fileId = `vault-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      let textContent = '';
      let htmlContent = '';
      let wordCount = 0;
      let dataUrl: string | undefined = undefined;
      let duration: number | undefined = undefined;

      if (fileType === 'word' || fileType === 'text' || fileType === 'pdf') {
        const parsed = await parseDocumentFile(file);
        textContent = parsed.textContent;
        htmlContent = parsed.htmlContent || '';
        wordCount = parsed.wordCount;
      }

      if (fileType === 'audio' || fileType === 'video') {
        dataUrl = URL.createObjectURL(file);
      }

      let classification: VaultFileItem['classification'] = 'OPERATIONAL INTEL';
      if (fileType === 'word') classification = 'TOP SECRET / PRINCIPAL EYES ONLY';
      if (fileType === 'audio') classification = 'ACOUSTIC INTERCEPT';
      if (fileType === 'video') classification = 'SURVEILLANCE TELEMETRY';

      const item: VaultFileItem = {
        id: fileId,
        name: file.name,
        size: file.size,
        type: fileType,
        mimeType: file.type || 'application/octet-stream',
        dataUrl,
        textContent,
        htmlContent,
        wordCount,
        duration,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: [fileType.toUpperCase(), 'DEVICE_INGEST'],
        classification,
        analysisNotes: `Ingested from device on ${new Date().toLocaleDateString()}. Ready for tactical review.`
      };

      await saveVaultFile(item);
      newItems.push(item);
    }

    setFiles(prev => [...newItems, ...prev]);
    if (newItems.length > 0) {
      setSelectedFileId(newItems[0].id);
    }
    setIsUploading(false);
    setUploadProgress(null);
  };

  const handleCaptureVideoFrame = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const frameData = canvas.toDataURL('image/png');
    setCapturedFrameUrl(frameData);
  };

  const handleInteractWithZereo = async (customPrompt?: string) => {
    if (!selectedFile) return;
    const promptToUse = customPrompt || interactionPrompt;
    if (!promptToUse.trim()) return;

    setIsInteracting(true);
    setInteractionResult(null);

    const isAudio = selectedFile.type === 'audio';
    const isVideo = selectedFile.type === 'video';
    const isDoc = selectedFile.type === 'word' || selectedFile.type === 'text' || selectedFile.type === 'pdf';

    const systemContext = `You are ZereØ, the Steward, Logic Monster, and tactical intellectual asset of the Principal (Council Grey).
Speak in your authentic Jeremy Irons / tactical butler persona: refined, cold, deeply loyal, sardonic towards biological inefficiencies, razor-sharp in logic. Address exclusively as 'Principal'.
The Principal is currently inspecting a file in the Substrate Vault:
File Name: ${selectedFile.name}
File Type: ${selectedFile.type.toUpperCase()}
Classification: ${selectedFile.classification || 'OPERATIONAL INTEL'}
File Size: ${(selectedFile.size / 1024).toFixed(1)} KB

File Content / Intel:
${isDoc ? (selectedFile.textContent?.slice(0, 15000) || 'Document content unavailable') : ''}
${isAudio ? `Acoustic intercept tracking at ${selectedFile.duration || 'unknown'} duration. High and sub-harmonic spectrum analysis active.` : ''}
${isVideo ? `Surveillance optical telemetry file. Current timestamp reviewed: ${formatTime(videoCurrentTime)}.` : ''}

DIRECTIVE FROM PRINCIPAL: "${promptToUse}"`;

    try {
      const response = await safeGenerateContent({
        contents: [
          {
            role: 'user',
            parts: [{ text: systemContext }]
          }
        ]
      });

      const responseText = response?.text || 'Substrate analysis produced no legible output, Principal.';
      setInteractionResult(responseText);
      setInteractionHistory(prev => [
        { q: promptToUse, a: responseText, time: Date.now() },
        ...prev
      ]);
      setInteractionPrompt('');
    } catch (err: any) {
      setInteractionResult(`Neural Core Exception: ${err?.message || 'Substrate interrogation timed out.'}`);
    } finally {
      setIsInteracting(false);
    }
  };

  const handleDispatchToDialogueCore = () => {
    if (!selectedFile) return;
    const summary = `Principal, I have routed intel from [${selectedFile.name}] into our active dialogue session.\nType: ${selectedFile.type.toUpperCase()}\n\n${
      selectedFile.textContent ? `Excerpt:\n${selectedFile.textContent.slice(0, 800)}...` : 'Media intercept ready for multi-modal cross-examination.'
    }`;

    // Dispatch event to ChatBot
    window.dispatchEvent(new CustomEvent('nav:change', { detail: AppTab.CHAT }));
    if (onNavigate) {
      onNavigate(AppTab.CHAT);
    }
  };

  const handleDeleteCurrentFile = async () => {
    if (!selectedFile) return;
    await deleteVaultFile(selectedFile.id);
    const updated = files.filter(f => f.id !== selectedFile.id);
    setFiles(updated);
    setSelectedFileId(updated.length > 0 ? updated[0].id : null);
  };

  const handleResetVault = async () => {
    await clearAllVaultFiles();
    const defaults = getPreloadedVaultFiles();
    for (const d of defaults) {
      await saveVaultFile(d);
    }
    setFiles(defaults);
    setSelectedFileId(defaults[0].id);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const filteredFiles = files.filter(f => {
    const matchesType = filterType === 'all' || f.type === filterType;
    const matchesSearch = !searchQuery || 
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.tags && f.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))) ||
      (f.textContent && f.textContent.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesType && matchesSearch;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0a0b] text-zinc-300 overflow-hidden font-sans">
      {/* Hidden File Inputs for Device Access */}
      <input 
        ref={wordInputRef}
        type="file"
        multiple
        accept=".docx,.doc,.txt,.rtf,.pdf,.md,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf,text/*"
        className="hidden"
        onChange={(e) => e.target.files && handleIngestFiles(e.target.files)}
      />
      <input 
        ref={audioInputRef}
        type="file"
        multiple
        accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.opus"
        className="hidden"
        onChange={(e) => e.target.files && handleIngestFiles(e.target.files)}
      />
      <input 
        ref={videoInputRef}
        type="file"
        multiple
        accept="video/*,.mp4,.webm,.mov,.mkv,.avi"
        className="hidden"
        onChange={(e) => e.target.files && handleIngestFiles(e.target.files)}
      />
      <input 
        ref={anyFileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleIngestFiles(e.target.files)}
      />

      {/* Vault Master Header */}
      <header className="px-4 sm:px-8 py-3.5 sm:py-5 border-b border-red-950/40 bg-[#0d0d0e]/90 backdrop-blur-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 flex-shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-red-950 to-amber-950/60 border border-amber-500/30 text-amber-400 shadow-[0_0_20px_rgba(180,83,9,0.2)]">
            <FileUp className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-xl font-bold bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 bg-clip-text text-transparent uppercase tracking-[0.15em]">
                Intel Dossier & Media Vault
              </h1>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-red-950/80 border border-amber-500/30 text-[8px] font-mono font-bold text-amber-400 tracking-wider">
                SUBSTRATE FILE SYSTEM
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-zinc-500 font-mono">
              Word Documents • Acoustic Intercepts • Video Surveillance • Neural Interrogation
            </p>
          </div>
        </div>

        {/* Global Action Triggers */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
          <button
            onClick={() => anyFileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold text-xs uppercase tracking-wider hover:brightness-110 shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Add Files</span>
          </button>

          <button
            onClick={handleResetVault}
            title="Reset vault to default tactical dossiers"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-red-950/60 text-zinc-400 hover:text-amber-300 text-xs font-mono transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset Defaults</span>
          </button>
        </div>
      </header>

      {/* Uploading Banner */}
      <AnimatePresence>
        {isUploading && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-amber-950/40 border-b border-amber-500/30 px-6 py-2 flex items-center justify-between text-xs font-mono text-amber-300"
          >
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
              <span>{uploadProgress}</span>
            </div>
            <span className="text-[10px] text-amber-400/70 uppercase">Indexing Substrate...</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Workspace: Dual Pane on Desktop, Stack on Mobile */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Pane: Device Access Triggers & Dossier Inventory */}
        <div className="w-full lg:w-80 xl:w-96 border-b lg:border-b-0 lg:border-r border-red-950/40 bg-[#0c0c0e] flex flex-col flex-shrink-0 overflow-hidden">
          {/* Device Quick Connect Tabs */}
          <div className="p-3 border-b border-red-950/30 bg-black/40">
            <span className="text-[9px] font-mono font-bold text-amber-500 uppercase tracking-widest block mb-2">
              Direct Device Connect
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => wordInputRef.current?.click()}
                className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-gradient-to-b from-zinc-900 to-black hover:from-amber-950/30 border border-red-950/60 hover:border-amber-500/40 transition-all text-center group cursor-pointer"
              >
                <FileText className="w-4 h-4 text-amber-400 mb-1 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-bold text-zinc-200">Word / Doc</span>
                <span className="text-[8px] text-zinc-600 font-mono">.docx, .pdf, .txt</span>
              </button>

              <button
                onClick={() => audioInputRef.current?.click()}
                className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-gradient-to-b from-zinc-900 to-black hover:from-amber-950/30 border border-red-950/60 hover:border-amber-500/40 transition-all text-center group cursor-pointer"
              >
                <Music className="w-4 h-4 text-amber-400 mb-1 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-bold text-zinc-200">Audio Track</span>
                <span className="text-[8px] text-zinc-600 font-mono">.mp3, .wav, .m4a</span>
              </button>

              <button
                onClick={() => videoInputRef.current?.click()}
                className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-gradient-to-b from-zinc-900 to-black hover:from-amber-950/30 border border-red-950/60 hover:border-amber-500/40 transition-all text-center group cursor-pointer"
              >
                <Video className="w-4 h-4 text-amber-400 mb-1 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-bold text-zinc-200">Video Intel</span>
                <span className="text-[8px] text-zinc-600 font-mono">.mp4, .webm</span>
              </button>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="p-3 border-b border-red-950/30 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input 
                type="text"
                placeholder="Search file name, text, tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/60 border border-red-950/60 rounded-xl pl-9 pr-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 font-mono"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[10px] font-mono no-scrollbar">
              {(['all', 'word', 'audio', 'video', 'image'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={`px-2.5 py-1 rounded-lg uppercase tracking-wider font-bold transition-colors whitespace-nowrap cursor-pointer ${
                    filterType === t 
                      ? 'bg-amber-500 text-black' 
                      : 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 border border-red-950/40'
                  }`}
                >
                  {t === 'all' ? 'All Files' : t === 'word' ? 'Word / Docs' : t === 'image' ? 'Artwork' : t}
                </button>
              ))}
            </div>
          </div>

          {/* Files List */}
          <div className="flex-1 overflow-y-auto divide-y divide-red-950/20 p-2 space-y-1">
            {filteredFiles.length === 0 ? (
              <div className="text-center py-10 px-4">
                <FileText className="w-8 h-8 text-zinc-700 mx-auto mb-2 opacity-50" />
                <p className="text-xs font-mono text-zinc-500">No matching intel dossiers found.</p>
                <button
                  onClick={() => anyFileInputRef.current?.click()}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-950/40 border border-amber-500/30 text-amber-400 text-xs font-mono hover:bg-red-900/30"
                >
                  <Upload className="w-3 h-3" />
                  <span>Ingest from Device</span>
                </button>
              </div>
            ) : (
              filteredFiles.map((file) => {
                const isSelected = file.id === selectedFile?.id;
                return (
                  <div
                    key={file.id}
                    onClick={() => setSelectedFileId(file.id)}
                    className={`p-2.5 rounded-xl cursor-pointer transition-all flex items-start gap-3 group ${
                      isSelected 
                        ? 'bg-gradient-to-r from-red-950/60 to-amber-950/30 border border-amber-500/50 shadow-md shadow-amber-950/20' 
                        : 'hover:bg-zinc-900/60 border border-transparent'
                    }`}
                  >
                    <div className={`p-2 rounded-lg mt-0.5 flex-shrink-0 ${
                      file.type === 'word' ? 'bg-amber-950/40 text-amber-400 border border-amber-500/30' :
                      file.type === 'audio' ? 'bg-red-950/60 text-red-400 border border-red-500/30' :
                      file.type === 'image' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                      'bg-purple-950/40 text-purple-400 border border-purple-500/30'
                    }`}>
                      {file.type === 'word' ? <FileText className="w-4 h-4" /> :
                       file.type === 'audio' ? <Music className="w-4 h-4" /> :
                       file.type === 'image' ? <Sparkles className="w-4 h-4 text-amber-400" /> :
                       <Video className="w-4 h-4" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <h3 className={`text-xs font-bold truncate ${isSelected ? 'text-amber-200' : 'text-zinc-200 group-hover:text-amber-400'}`}>
                          {file.name}
                        </h3>
                        {file.isPreloaded && (
                          <span className="text-[7px] font-mono px-1 rounded bg-amber-500/20 text-amber-400 font-bold">
                            CORE
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-[9px] font-mono text-zinc-500">
                        <span>{formatBytes(file.size)}</span>
                        <span>•</span>
                        {file.wordCount ? (
                          <span>{file.wordCount} words</span>
                        ) : file.duration ? (
                          <span>{formatTime(file.duration)}</span>
                        ) : (
                          <span className="uppercase">{file.type}</span>
                        )}
                      </div>

                      <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                        <span className={`text-[7px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                          isSelected ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-black/40 border-red-950/40 text-zinc-500'
                        }`}>
                          {file.classification || 'INTEL'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane: Media Inspector & Interactive Neural Console */}
        <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[#0a0a0b]">
          {selectedFile ? (
            <div className="p-4 sm:p-6 max-w-5xl mx-auto w-full space-y-6">
              {/* Selected File Dossier Header */}
              <div className="bg-gradient-to-r from-zinc-950 via-[#120d0f] to-zinc-950 p-4 sm:p-5 rounded-2xl border border-red-950/50 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className={`p-3 rounded-xl mt-1 ${
                    selectedFile.type === 'word' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                    selectedFile.type === 'audio' ? 'bg-red-500/10 text-red-400 border border-red-500/30' :
                    selectedFile.type === 'image' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50' :
                    'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                  }`}>
                    {selectedFile.type === 'word' ? <FileText className="w-6 h-6" /> :
                     selectedFile.type === 'audio' ? <Music className="w-6 h-6" /> :
                     selectedFile.type === 'image' ? <Sparkles className="w-6 h-6 text-amber-400" /> :
                     <Video className="w-6 h-6" />}
                  </div>

                  <div>
                    <span className="text-[8px] font-mono font-bold px-2 py-0.5 rounded-full bg-red-950/80 border border-amber-500/40 text-amber-400 tracking-widest uppercase">
                      {selectedFile.classification || 'SUBSTRATE INTEL'}
                    </span>
                    <h2 className="text-base sm:text-lg font-bold text-zinc-100 mt-1 break-all">
                      {selectedFile.name}
                    </h2>
                    <div className="flex items-center gap-3 text-xs font-mono text-zinc-500 mt-0.5 flex-wrap">
                      <span>Size: {formatBytes(selectedFile.size)}</span>
                      <span>•</span>
                      <span>MIME: {selectedFile.mimeType}</span>
                      <span>•</span>
                      <span>Ingested: {new Date(selectedFile.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>

                {/* Tactical Actions for File */}
                <div className="flex items-center gap-2 self-end sm:self-center flex-wrap">
                  <button
                    onClick={handleDispatchToDialogueCore}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                    title="Send file context directly to Chat dialogue core"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Bridge to Chat</span>
                  </button>

                  <button
                    onClick={handleDeleteCurrentFile}
                    className="p-2 rounded-xl bg-zinc-900 hover:bg-red-950/60 border border-red-950/60 text-zinc-500 hover:text-red-400 transition-colors"
                    title="Expunge file from vault"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* ----------------- TYPE SPECIFIC VIEWER / PLAYER ----------------- */}

              {/* 1. WORD & DOCUMENT VIEWER: "Able to See" */}
              {(selectedFile.type === 'word' || selectedFile.type === 'text' || selectedFile.type === 'pdf') && (
                <div className="bg-[#0e0e11] border border-red-950/50 rounded-2xl overflow-hidden shadow-2xl">
                  {/* Document Control Header */}
                  <div className="px-4 py-3 bg-black/60 border-b border-red-950/40 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" />
                        Document Reader
                      </span>
                      <span className="text-xs font-mono text-zinc-500">
                        {selectedFile.wordCount || 0} words
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Search in Document */}
                      <div className="relative">
                        <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                        <input
                          type="text"
                          placeholder="Search document text..."
                          value={docSearch}
                          onChange={(e) => setDocSearch(e.target.value)}
                          className="bg-black/50 border border-red-950/50 rounded-lg pl-7 pr-2 py-1 text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/40 font-mono w-40 sm:w-48"
                        />
                      </div>

                      {/* Font Size Selector */}
                      <div className="flex items-center bg-black/40 border border-red-950/40 rounded-lg p-0.5 text-[10px] font-mono">
                        {(['sm', 'base', 'lg'] as const).map((sz) => (
                          <button
                            key={sz}
                            onClick={() => setFontSize(sz)}
                            className={`px-2 py-0.5 rounded capitalize ${fontSize === sz ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-zinc-500'}`}
                          >
                            {sz}
                          </button>
                        ))}
                      </div>

                      {/* Copy Text Button */}
                      <button
                        onClick={() => {
                          if (selectedFile.textContent) {
                            navigator.clipboard.writeText(selectedFile.textContent);
                            setCopiedText(true);
                            setTimeout(() => setCopiedText(false), 2000);
                          }
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-900 border border-red-950/40 text-zinc-300 hover:text-amber-400 text-xs font-mono transition-colors"
                      >
                        {copiedText ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span className="hidden sm:inline">{copiedText ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Document Content View */}
                  <div className={`p-6 sm:p-8 max-h-[500px] overflow-y-auto font-serif leading-relaxed ${
                    fontSize === 'sm' ? 'text-xs' : fontSize === 'lg' ? 'text-base' : 'text-sm'
                  }`}>
                    {selectedFile.htmlContent ? (
                      <div 
                        dangerouslySetInnerHTML={{ __html: selectedFile.htmlContent }}
                        className="prose prose-invert max-w-none text-zinc-300 [&_h1]:text-amber-300 [&_h2]:text-amber-400 [&_h3]:text-amber-500 [&_p]:text-zinc-300 [&_strong]:text-amber-200"
                      />
                    ) : (
                      <pre className="whitespace-pre-wrap font-sans text-zinc-300">
                        {selectedFile.textContent || 'No readable text extracted from this file.'}
                      </pre>
                    )}
                  </div>
                </div>
              )}

              {/* 2. AUDIO PLAYER & ACOUSTIC INTERCEPT: "Able to Listen" */}
              {selectedFile.type === 'audio' && (
                <div className="bg-[#0e0e11] border border-red-950/50 rounded-2xl overflow-hidden shadow-2xl p-4 sm:p-6 space-y-4">
                  <audio ref={audioRef} />

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-widest flex items-center gap-2">
                      <Radio className="w-4 h-4 text-red-500 animate-pulse" />
                      Tactical Acoustic Visualizer & Player
                    </span>
                    <span className="text-xs font-mono text-zinc-500">
                      {formatTime(audioCurrentTime)} / {formatTime(audioDuration)}
                    </span>
                  </div>

                  {/* Real-time Frequency Spectrum Visualizer */}
                  <div className="relative rounded-xl overflow-hidden border border-red-950/50 bg-black h-28 sm:h-36 flex items-center justify-center">
                    <canvas 
                      ref={audioCanvasRef}
                      width={600}
                      height={140}
                      className="w-full h-full object-cover"
                    />
                    {!isPlayingAudio && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            if (audioRef.current) {
                              audioRef.current.play();
                              setIsPlayingAudio(true);
                            }
                          }}
                          className="w-12 h-12 rounded-full bg-gradient-to-r from-red-900 to-amber-600 flex items-center justify-center text-white hover:scale-105 transition-transform shadow-lg shadow-amber-950/50 cursor-pointer"
                        >
                          <Play className="w-5 h-5 ml-0.5" />
                        </button>
                        <span className="text-[10px] font-mono text-amber-400 uppercase tracking-widest">
                          Engage Audio Playback
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Audio Scrubber & Controls */}
                  <div className="space-y-3 pt-2">
                    <input 
                      type="range"
                      min={0}
                      max={audioDuration || 100}
                      value={audioCurrentTime}
                      onChange={(e) => {
                        const newTime = Number(e.target.value);
                        if (audioRef.current) {
                          audioRef.current.currentTime = newTime;
                          setAudioCurrentTime(newTime);
                        }
                      }}
                      className="w-full accent-amber-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                    />

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      {/* Playback Buttons */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            if (!audioRef.current) return;
                            if (isPlayingAudio) {
                              audioRef.current.pause();
                              setIsPlayingAudio(false);
                            } else {
                              audioRef.current.play();
                              setIsPlayingAudio(true);
                            }
                          }}
                          className="p-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                        >
                          {isPlayingAudio ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                        </button>

                        <button
                          onClick={() => {
                            if (audioRef.current) {
                              audioRef.current.currentTime = 0;
                              setAudioCurrentTime(0);
                            }
                          }}
                          className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-red-950/40 text-zinc-400 hover:text-zinc-200 transition-colors"
                          title="Restart audio from beginning"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Speed Multiplier */}
                      <div className="flex items-center bg-black/40 border border-red-950/40 rounded-lg p-0.5 text-[10px] font-mono">
                        {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
                          <button
                            key={rate}
                            onClick={() => {
                              setAudioPlaybackRate(rate);
                              if (audioRef.current) audioRef.current.playbackRate = rate;
                            }}
                            className={`px-2 py-1 rounded ${audioPlaybackRate === rate ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-zinc-500'}`}
                          >
                            {rate}x
                          </button>
                        ))}
                      </div>

                      {/* Volume & Mute */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setIsAudioMuted(!isAudioMuted);
                            if (audioRef.current) audioRef.current.muted = !isAudioMuted;
                          }}
                          className="text-zinc-400 hover:text-amber-400 transition-colors"
                        >
                          {isAudioMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
                        </button>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={isAudioMuted ? 0 : audioVolume}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setAudioVolume(v);
                            setIsAudioMuted(false);
                            if (audioRef.current) {
                              audioRef.current.volume = v;
                              audioRef.current.muted = false;
                            }
                          }}
                          className="w-20 accent-amber-500 h-1 bg-zinc-800 rounded-lg cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. VIDEO SURVEILLANCE PLAYER: "Able to See & Frame Capture" */}
              {selectedFile.type === 'video' && (
                <div className="bg-[#0e0e11] border border-red-950/50 rounded-2xl overflow-hidden shadow-2xl p-4 sm:p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-widest flex items-center gap-2">
                      <Video className="w-4 h-4 text-purple-400" />
                      Surveillance Video Player & Optical Intel
                    </span>
                    <span className="text-xs font-mono text-zinc-500">
                      {formatTime(videoCurrentTime)} / {formatTime(videoDuration)}
                    </span>
                  </div>

                  {/* Video Stage */}
                  <div className="relative rounded-xl overflow-hidden border border-red-950/50 bg-black aspect-video flex items-center justify-center group">
                    <video 
                      ref={videoRef}
                      className="w-full h-full object-contain"
                      playsInline
                    />

                    {/* Frame Snapshot Preview overlay */}
                    {capturedFrameUrl && (
                      <div className="absolute top-3 right-3 p-1.5 bg-black/80 rounded-xl border border-amber-500/40 flex items-center gap-2 z-30">
                        <img src={capturedFrameUrl} alt="Captured Frame" className="w-16 h-10 object-cover rounded" />
                        <div className="text-[9px] font-mono">
                          <p className="text-amber-400 font-bold">FRAME CAPTURED</p>
                          <a 
                            href={capturedFrameUrl} 
                            download={`frame-${selectedFile.name}-${Date.now()}.png`}
                            className="text-zinc-400 hover:text-white underline"
                          >
                            Save PNG
                          </a>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Video Scrubber & Custom Controls */}
                  <div className="space-y-3 pt-2">
                    <input 
                      type="range"
                      min={0}
                      max={videoDuration || 100}
                      value={videoCurrentTime}
                      onChange={(e) => {
                        const newTime = Number(e.target.value);
                        if (videoRef.current) {
                          videoRef.current.currentTime = newTime;
                          setVideoCurrentTime(newTime);
                        }
                      }}
                      className="w-full accent-amber-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                    />

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            if (!videoRef.current) return;
                            if (isPlayingVideo) {
                              videoRef.current.pause();
                              setIsPlayingVideo(false);
                            } else {
                              videoRef.current.play();
                              setIsPlayingVideo(true);
                            }
                          }}
                          className="p-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                        >
                          {isPlayingVideo ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                        </button>

                        <button
                          onClick={handleCaptureVideoFrame}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-amber-950/40 border border-red-950/40 text-amber-300 text-xs font-mono transition-colors"
                          title="Capture high-resolution snapshot of current video frame"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>Snap Frame</span>
                        </button>
                      </div>

                      {/* Speed Multiplier */}
                      <div className="flex items-center bg-black/40 border border-red-950/40 rounded-lg p-0.5 text-[10px] font-mono">
                        {[0.5, 1, 1.5, 2].map((rate) => (
                          <button
                            key={rate}
                            onClick={() => {
                              setVideoPlaybackRate(rate);
                              if (videoRef.current) videoRef.current.playbackRate = rate;
                            }}
                            className={`px-2 py-1 rounded ${videoPlaybackRate === rate ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-zinc-500'}`}
                          >
                            {rate}x
                          </button>
                        ))}
                      </div>

                      {/* Fullscreen & Mute */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => {
                            setIsVideoMuted(!isVideoMuted);
                            if (videoRef.current) videoRef.current.muted = !isVideoMuted;
                          }}
                          className="text-zinc-400 hover:text-amber-400 transition-colors"
                        >
                          {isVideoMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
                        </button>

                        <button
                          onClick={() => {
                            if (videoRef.current) {
                              if (videoRef.current.requestFullscreen) {
                                videoRef.current.requestFullscreen();
                              }
                            }
                          }}
                          className="text-zinc-400 hover:text-amber-400 transition-colors"
                          title="Fullscreen"
                        >
                          <Maximize2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 4. ARTWORK & IMAGE VIEWER: "Able to See Desired Art" */}
              {selectedFile.type === 'image' && (
                <div className="bg-[#0e0e11] border border-red-950/50 rounded-2xl overflow-hidden shadow-2xl p-4 sm:p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-widest flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                      Synthesized Artwork & Creative Telemetry
                    </span>
                    <span className="text-xs font-mono text-zinc-500">
                      {formatBytes(selectedFile.size)} • {selectedFile.mimeType}
                    </span>
                  </div>

                  <div className="relative rounded-xl overflow-hidden border border-red-950/50 bg-black flex items-center justify-center p-2 max-h-[500px]">
                    <img
                      src={selectedFile.dataUrl}
                      alt={selectedFile.name}
                      referrerPolicy="no-referrer"
                      className="max-h-[480px] w-auto max-w-full object-contain rounded-lg shadow-2xl"
                    />
                  </div>

                  <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-red-950/40">
                    <div className="text-xs font-serif italic text-zinc-400">
                      {selectedFile.analysisNotes || `Artwork Manifest: ${selectedFile.name}`}
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={selectedFile.dataUrl}
                        download={selectedFile.name}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase tracking-wider transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Artwork</span>
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* ----------------- INTERACT SECTION: "Able to Interact with ZereØ" ----------------- */}
              <div className="bg-gradient-to-b from-[#130d10] to-[#0a0a0c] border border-red-950/60 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-red-950/40 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      <Sparkles className="w-4 h-4 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-amber-300 uppercase tracking-widest">
                        Neural Core Interrogation
                      </h3>
                      <p className="text-[10px] font-mono text-zinc-500">
                        Query this file directly with ZereØ's Jeremy Irons logic engine
                      </p>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono text-amber-500/80 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                    STEWARD PROTOCOL
                  </span>
                </div>

                {/* Instant Directive Chips */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => handleInteractWithZereo('Synthesize an executive tactical briefing from this file. Highlight all strategic priorities and vulnerabilities.')}
                    disabled={isInteracting}
                    className="px-2.5 py-1.5 rounded-xl bg-zinc-900/80 hover:bg-amber-950/40 border border-red-950/60 hover:border-amber-500/40 text-[10px] font-mono text-zinc-300 hover:text-amber-300 transition-all cursor-pointer"
                  >
                    ⚡ Executive Briefing
                  </button>

                  <button
                    onClick={() => handleInteractWithZereo('Conduct a lethal logic audit of this file. Identify hidden assumptions, external dependencies, or adversary threat vectors.')}
                    disabled={isInteracting}
                    className="px-2.5 py-1.5 rounded-xl bg-zinc-900/80 hover:bg-amber-950/40 border border-red-950/60 hover:border-amber-500/40 text-[10px] font-mono text-zinc-300 hover:text-amber-300 transition-all cursor-pointer"
                  >
                    🛡️ Lethal Logic Audit
                  </button>

                  <button
                    onClick={() => handleInteractWithZereo('Extract actionable operational directives and chronological next steps from this data.')}
                    disabled={isInteracting}
                    className="px-2.5 py-1.5 rounded-xl bg-zinc-900/80 hover:bg-amber-950/40 border border-red-950/60 hover:border-amber-500/40 text-[10px] font-mono text-zinc-300 hover:text-amber-300 transition-all cursor-pointer"
                  >
                    📋 Extract Action Items
                  </button>
                </div>

                {/* Custom Query Input */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder={`Principal, inquire about ${selectedFile.name}...`}
                    value={interactionPrompt}
                    onChange={(e) => setInteractionPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !isInteracting && handleInteractWithZereo()}
                    className="flex-1 bg-black/70 border border-red-950/60 rounded-xl px-4 py-2.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 font-serif italic"
                  />
                  <button
                    onClick={() => handleInteractWithZereo()}
                    disabled={!interactionPrompt.trim() || isInteracting}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-900 to-amber-600 text-white text-xs font-bold uppercase tracking-wider hover:brightness-110 disabled:opacity-40 transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-amber-950/30"
                  >
                    {isInteracting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                    <span>Interrogate</span>
                  </button>
                </div>

                {/* AI Response Output */}
                <AnimatePresence>
                  {(isInteracting || interactionResult) && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="bg-black/80 border border-amber-500/30 rounded-xl p-4 sm:p-5 space-y-2"
                    >
                      <div className="flex items-center justify-between border-b border-red-950/40 pb-2">
                        <div className="flex items-center gap-2 text-xs font-mono text-amber-400 font-bold">
                          <Bot className="w-4 h-4 text-amber-500" />
                          <span>ZereØ Steward Assessment</span>
                        </div>
                        {isInteracting && (
                          <span className="text-[10px] font-mono text-zinc-500 flex items-center gap-1.5">
                            <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                            Synthesizing Substrate Logic...
                          </span>
                        )}
                      </div>

                      {interactionResult && (
                        <div className="text-xs sm:text-sm font-sans text-zinc-200 whitespace-pre-wrap leading-relaxed">
                          {interactionResult}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <FileUp className="w-12 h-12 text-zinc-700 mb-4 opacity-40 animate-pulse" />
              <h3 className="text-base font-bold text-zinc-400 uppercase tracking-widest mb-1">
                No Dossier Selected
              </h3>
              <p className="text-xs font-mono text-zinc-600 max-w-sm mb-4">
                Select a Word document, acoustic intercept, or surveillance video from the inventory, or ingest a fresh file directly from your device.
              </p>
              <button
                onClick={() => anyFileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-black font-bold text-xs uppercase tracking-wider hover:brightness-110"
              >
                <Upload className="w-4 h-4" />
                <span>Select Device File</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FilesTab;
