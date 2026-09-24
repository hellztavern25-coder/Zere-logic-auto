import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Database, Trash2, Clock, FileText, Search, Brain, Loader2, Cloud,
  ShieldCheck, Eye, RefreshCw, Image as ImageIcon, Camera, Upload, Download,
  ZoomIn, ZoomOut, Maximize2, ExternalLink, Calendar, Sparkles, Wand2,
  Grid, List, Check, Copy, X, Plus, Monitor, Tag
} from 'lucide-react';
import { VisualCapture, VisualCaptureSource } from '../types';

interface Memory {
  id: string;
  title: string;
  content: string;
  type: string;
  timestamp: string;
}

const MemoryCore: React.FC = () => {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [visualCaptures, setVisualCaptures] = useState<VisualCapture[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingVisuals, setIsLoadingVisuals] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'strategic' | 'audit' | 'visual'>('visual');
  const [visualSourceFilter, setVisualSourceFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'timeline' | 'grid'>('timeline');
  const [selectedAuditTrace, setSelectedAuditTrace] = useState<Memory | null>(null);
  const [selectedCapture, setSelectedCapture] = useState<VisualCapture | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isCapturingScreen, setIsCapturingScreen] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMemories = async () => {
    try {
      const res = await fetch('/api/memories');
      const data = await res.json();
      setMemories(data);
    } catch (err) {
      console.error('Failed to load memories');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchVisualCaptures = async () => {
    setIsLoadingVisuals(true);
    try {
      const res = await fetch('/api/visual-captures');
      const data = await res.json();
      setVisualCaptures(data);
    } catch (err) {
      console.error('Failed to load visual captures');
    } finally {
      setIsLoadingVisuals(false);
    }
  };

  const deleteMemory = async (id: string) => {
    try {
      await fetch(`/api/memories/${id}`, { method: 'DELETE' });
      setMemories(prev => prev.filter(m => m.id !== id));
      if (selectedAuditTrace?.id === id) {
        setSelectedAuditTrace(null);
      }
    } catch (err) {
      console.error('Failed to delete memory', err);
    }
  };

  const deleteVisualCapture = async (id: string) => {
    try {
      await fetch(`/api/visual-captures/${id}`, { method: 'DELETE' });
      setVisualCaptures(prev => prev.filter(c => c.id !== id));
      if (selectedCapture?.id === id) {
        setSelectedCapture(null);
      }
    } catch (err) {
      console.error('Failed to delete visual capture', err);
    }
  };

  // Direct Screen Capture from inside Memory Core
  const captureScreenToVault = async () => {
    if (isCapturingScreen) return;
    setIsCapturingScreen(true);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' } as any,
        audio: false,
      });

      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }

      stream.getTracks().forEach(track => track.stop());

      const dataUrl = canvas.toDataURL('image/png');
      const payload = {
        title: `Screen Capture [${new Date().toLocaleTimeString()}]`,
        description: 'Direct display snapshot ingested into Visual Memory Core.',
        imageUrl: dataUrl,
        source: 'screen_snapshot',
        metadata: {
          aspectRatio: `${canvas.width}:${canvas.height}`,
          resolution: `${canvas.width}x${canvas.height}`,
          tags: ['screen_capture', 'direct_ingest', 'estate_telemetry']
        },
        timestamp: Date.now()
      };

      const res = await fetch('/api/visual-captures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const saved = await res.json();
        setVisualCaptures(prev => [saved, ...prev]);
        setActiveFilter('visual');
      }
    } catch (err) {
      console.error('Screen capture cancelled or failed:', err);
    } finally {
      setIsCapturingScreen(false);
    }
  };

  // Manual File Ingest
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const imageUrl = event.target?.result as string;
      if (!imageUrl) return;

      const payload = {
        title: file.name.replace(/\.[^/.]+$/, "") || `Uploaded Asset [${new Date().toLocaleTimeString()}]`,
        description: `Manual visual asset committed to vault: ${file.name} (${Math.round(file.size / 1024)} KB).`,
        imageUrl,
        source: 'user_upload',
        metadata: {
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          tags: ['manual_upload', 'asset']
        },
        timestamp: Date.now()
      };

      try {
        const res = await fetch('/api/visual-captures', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const saved = await res.json();
          setVisualCaptures(prev => [saved, ...prev]);
          setActiveFilter('visual');
        }
      } catch (err) {
        console.error('Failed to commit uploaded asset:', err);
      }
    };
    reader.readAsDataURL(file);
    if (e.target) e.target.value = '';
  };

  useEffect(() => {
    fetchMemories();
    fetchVisualCaptures();

    const handleNewAudit = () => {
      fetchMemories();
    };

    const handleNewVisualCapture = (e: any) => {
      if (e.detail) {
        setVisualCaptures(prev => {
          if (prev.some(item => item.id === e.detail.id)) return prev;
          return [e.detail, ...prev];
        });
      } else {
        fetchVisualCaptures();
      }
    };

    const handleFilterVisual = () => {
      setActiveFilter('visual');
    };

    window.addEventListener('principal:reasoning_audit', handleNewAudit);
    window.addEventListener('visual:new_capture_saved', handleNewVisualCapture);
    window.addEventListener('memory:filter_visual', handleFilterVisual);

    return () => {
      window.removeEventListener('principal:reasoning_audit', handleNewAudit);
      window.removeEventListener('visual:new_capture_saved', handleNewVisualCapture);
      window.removeEventListener('memory:filter_visual', handleFilterVisual);
    };
  }, []);

  const copyPromptText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  // Navigations
  const openInCreative = () => {
    window.dispatchEvent(new CustomEvent('nav:change', { detail: 'creative' }));
  };

  const openInSnapshot = () => {
    window.dispatchEvent(new CustomEvent('nav:change', { detail: 'snapshot' }));
  };

  // Filtered Text Memories
  const filteredMemories = memories.filter(m => {
    const matchesSearch = 
      m.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      m.content.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;
    if (activeFilter === 'strategic') return m.type !== 'principal_audit';
    if (activeFilter === 'audit') return m.type === 'principal_audit';
    return true;
  });

  // Filtered Visual Captures
  const filteredVisuals = visualCaptures.filter(c => {
    const matchesSearch = 
      c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.description && c.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.metadata?.prompt && c.metadata.prompt.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.metadata?.tags && c.metadata.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase())));

    if (!matchesSearch) return false;
    if (visualSourceFilter !== 'all' && c.source !== visualSourceFilter) return false;
    return true;
  });

  // Group Visual Captures by Date for the Timeline
  const groupedVisuals = filteredVisuals.reduce((acc, capture) => {
    const d = new Date(capture.timestamp);
    const dateKey = d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(capture);
    return acc;
  }, {} as Record<string, VisualCapture[]>);

  const auditCount = memories.filter(m => m.type === 'principal_audit').length;
  const visualCount = visualCaptures.length;

  const getSourceBadge = (source: VisualCaptureSource | string) => {
    switch (source) {
      case 'creative_session':
        return {
          label: 'CREATIVE SESSION',
          color: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
          icon: <Wand2 className="w-3 h-3 text-amber-400" />
        };
      case 'screen_snapshot':
        return {
          label: 'SCREEN SNAPSHOT',
          color: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
          icon: <Monitor className="w-3 h-3 text-sky-400" />
        };
      case 'neural_optical':
        return {
          label: 'OPTICAL AUDIT',
          color: 'bg-red-500/15 text-red-400 border-red-500/30',
          icon: <Eye className="w-3 h-3 text-red-400" />
        };
      case 'user_upload':
      default:
        return {
          label: 'MANUAL INGEST',
          color: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
          icon: <Upload className="w-3 h-3 text-purple-400" />
        };
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-black overflow-hidden relative">
      {/* Hidden File Input for Direct Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-red-900/20 bg-red-950/10 backdrop-blur-md flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="p-2.5 sm:p-3 bg-red-950/80 border border-red-800/60 rounded-2xl shadow-lg shadow-red-950/50">
            <Database className="text-amber-400 w-5 h-5 sm:w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-xl font-bold text-amber-500 uppercase tracking-[0.15em] sm:tracking-[0.25em]">
                Memory Core & Visual Vault
              </h2>
              <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold">
                v2.4
              </span>
            </div>
            <p className="text-[8px] sm:text-[10px] text-zinc-400 uppercase tracking-widest font-mono">
              Persistent Strategic Archive • Visual Timeline Grid • Principal Reasoning Vault
            </p>
          </div>
        </div>

        {/* Global Action & Ingest Controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto">
          {/* Direct Screen Ingest */}
          <button
            onClick={captureScreenToVault}
            disabled={isCapturingScreen}
            className="px-3 py-2 bg-red-950/40 hover:bg-red-900/40 border border-red-800/40 rounded-xl text-amber-400 text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-sm"
            title="Grab screen snapshot directly into Visual Memory Core"
          >
            {isCapturingScreen ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
            ) : (
              <Camera className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">Capture Screen</span>
          </button>

          {/* Direct Upload Ingest */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-2 bg-zinc-900/60 hover:bg-zinc-800 border border-red-900/30 rounded-xl text-zinc-300 hover:text-white text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-sm"
            title="Upload visual asset to vault"
          >
            <Upload className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">Upload Asset</span>
          </button>

          {/* Refresh */}
          <button
            onClick={() => { fetchMemories(); fetchVisualCaptures(); }}
            className="p-2.5 bg-zinc-900/60 border border-red-900/30 text-amber-400 rounded-xl hover:bg-zinc-800 transition-colors"
            title="Refresh Vault Registers"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Navigation Sub-Bar & Filter Matrix */}
      <div className="px-4 sm:px-6 py-3 border-b border-red-900/15 bg-black/40 flex flex-wrap items-center justify-between gap-3">
        {/* Primary Filter Tabs */}
        <div className="flex items-center bg-zinc-950/80 border border-red-900/30 rounded-xl p-1 gap-1">
          <button
            onClick={() => setActiveFilter('visual')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase transition-all flex items-center gap-1.5 ${
              activeFilter === 'visual'
                ? 'bg-amber-600 text-black shadow-md shadow-amber-900/40'
                : 'text-zinc-400 hover:text-amber-300'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Visual Captures ({visualCount})</span>
          </button>

          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase transition-all ${
              activeFilter === 'all'
                ? 'bg-amber-600 text-black shadow-md shadow-amber-900/40'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            All Text ({memories.length})
          </button>

          <button
            onClick={() => setActiveFilter('strategic')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase transition-all ${
              activeFilter === 'strategic'
                ? 'bg-amber-600 text-black'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Strategic
          </button>

          <button
            onClick={() => setActiveFilter('audit')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase transition-all flex items-center gap-1.5 ${
              activeFilter === 'audit'
                ? 'bg-red-700 text-amber-300 shadow-md shadow-red-950/40'
                : 'text-red-400 hover:text-red-300'
            }`}
          >
            <ShieldCheck className="w-3 h-3" />
            <span>Reasoning Audits ({auditCount})</span>
          </button>
        </div>

        {/* Sub-Filters & Search Field */}
        <div className="flex items-center gap-2.5 flex-1 sm:flex-initial justify-end">
          {/* Visual Source Filter (Active only in Visual tab) */}
          {activeFilter === 'visual' && (
            <div className="flex items-center gap-1 bg-zinc-950/60 border border-red-900/20 rounded-xl p-1 text-[9px] font-mono">
              <button
                onClick={() => setVisualSourceFilter('all')}
                className={`px-2 py-1 rounded-md transition-colors ${
                  visualSourceFilter === 'all' ? 'bg-zinc-800 text-amber-400 font-bold' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                All Sources
              </button>
              <button
                onClick={() => setVisualSourceFilter('creative_session')}
                className={`px-2 py-1 rounded-md transition-colors flex items-center gap-1 ${
                  visualSourceFilter === 'creative_session' ? 'bg-amber-950 text-amber-300 font-bold border border-amber-800/40' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Wand2 className="w-2.5 h-2.5" />
                Creative
              </button>
              <button
                onClick={() => setVisualSourceFilter('screen_snapshot')}
                className={`px-2 py-1 rounded-md transition-colors flex items-center gap-1 ${
                  visualSourceFilter === 'screen_snapshot' ? 'bg-sky-950 text-sky-300 font-bold border border-sky-800/40' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Monitor className="w-2.5 h-2.5" />
                Snapshots
              </button>
              <button
                onClick={() => setVisualSourceFilter('neural_optical')}
                className={`px-2 py-1 rounded-md transition-colors flex items-center gap-1 ${
                  visualSourceFilter === 'neural_optical' ? 'bg-red-950 text-red-300 font-bold border border-red-800/40' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Eye className="w-2.5 h-2.5" />
                Telemetry
              </button>
            </div>
          )}

          {/* View Mode Toggle for Visuals */}
          {activeFilter === 'visual' && (
            <div className="flex items-center bg-zinc-950/80 border border-red-900/30 rounded-xl p-1 gap-1">
              <button
                onClick={() => setViewMode('timeline')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'timeline' ? 'bg-amber-500/20 text-amber-400' : 'text-zinc-500 hover:text-zinc-300'
                }`}
                title="Timeline Axis View"
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'grid' ? 'bg-amber-500/20 text-amber-400' : 'text-zinc-500 hover:text-zinc-300'
                }`}
                title="Masonry Grid View"
              >
                <Grid className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Search Bar */}
          <div className="relative w-48 sm:w-60">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <input 
              type="text"
              placeholder={activeFilter === 'visual' ? "Search Visuals & Prompts..." : "Search Archives..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-900/40 border border-red-900/20 rounded-xl py-1.5 pl-9 pr-3 text-xs text-zinc-300 focus:outline-none focus:border-amber-500/50 transition-all font-mono placeholder:text-zinc-600"
            />
          </div>
        </div>
      </div>

      {/* Main Archive Display Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
        {/* ========================================================= */}
        {/* VISUAL CAPTURE TIMELINE & GRID VIEW                        */}
        {/* ========================================================= */}
        {activeFilter === 'visual' ? (
          isLoadingVisuals ? (
            <div className="h-full flex flex-col items-center justify-center opacity-40">
              <Loader2 className="w-12 h-12 animate-spin text-amber-500 mb-4" />
              <p className="text-[10px] font-bold uppercase tracking-widest font-mono text-zinc-400">
                Retrieving Visual Neural Ledger...
              </p>
            </div>
          ) : filteredVisuals.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 max-w-md mx-auto">
              <div className="p-4 bg-red-950/30 rounded-3xl border border-red-900/30 mb-4">
                <ImageIcon className="w-12 h-12 text-amber-600 opacity-60" />
              </div>
              <h3 className="text-base font-bold uppercase tracking-[0.2em] text-zinc-200">
                Visual Ledger Empty
              </h3>
              <p className="text-xs mt-2 italic font-serif text-zinc-400 leading-relaxed">
                "No visual captures or processed images found for this register, Principal. Create assets in Creative Studio, snap screens in Snapshot Hub, or capture the display above."
              </p>
              <div className="flex items-center gap-3 mt-6">
                <button
                  onClick={captureScreenToVault}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-black font-mono font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-amber-950/40"
                >
                  <Camera className="w-4 h-4" />
                  <span>Capture Screen</span>
                </button>
                <button
                  onClick={openInCreative}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-mono text-xs rounded-xl border border-red-900/30 flex items-center gap-2"
                >
                  <Wand2 className="w-4 h-4 text-amber-500" />
                  <span>Launch Creative Studio</span>
                </button>
              </div>
            </div>
          ) : viewMode === 'timeline' ? (
            /* TIMELINE VIEW */
            <div className="max-w-6xl mx-auto space-y-10 py-4">
              {Object.entries(groupedVisuals).map(([dateLabel, captures]) => (
                <div key={dateLabel} className="relative">
                  {/* Date Pillar Header */}
                  <div className="sticky top-0 z-10 py-2 mb-6 bg-black/80 backdrop-blur-md flex items-center gap-3 border-b border-red-900/30">
                    <div className="p-1.5 bg-amber-500/20 rounded-lg border border-amber-500/40">
                      <Calendar className="w-4 h-4 text-amber-400" />
                    </div>
                    <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-amber-400">
                      {dateLabel}
                    </h3>
                    <div className="h-px flex-1 bg-gradient-to-r from-red-900/40 to-transparent" />
                    <span className="text-[10px] font-mono text-zinc-500">
                      {captures.length} {captures.length === 1 ? 'capture' : 'captures'}
                    </span>
                  </div>

                  {/* Vertical Axis Line */}
                  <div className="relative pl-6 sm:pl-8 border-l-2 border-red-950 space-y-8">
                    {captures.map((capture) => {
                      const badge = getSourceBadge(capture.source);
                      return (
                        <motion.div
                          key={capture.id}
                          layout
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="relative group"
                        >
                          {/* Pulsing Node Anchor on the vertical timeline axis */}
                          <div className="absolute -left-[31px] sm:-left-[39px] top-6 w-3.5 h-3.5 rounded-full bg-black border-2 border-amber-500 group-hover:border-amber-300 group-hover:scale-125 transition-all shadow-md shadow-amber-900/50" />

                          {/* Visual Capture Card in Timeline */}
                          <div className="bg-zinc-950/80 hover:bg-zinc-900/80 border border-red-900/30 hover:border-amber-500/50 rounded-2xl p-4 sm:p-5 transition-all shadow-xl shadow-black flex flex-col md:flex-row gap-5 items-start">
                            {/* Visual Thumbnail Frame */}
                            <div 
                              onClick={() => { setSelectedCapture(capture); setZoomLevel(1); }}
                              className="relative w-full md:w-64 h-48 rounded-xl overflow-hidden bg-black border border-red-950 flex-shrink-0 cursor-pointer group/img"
                            >
                              <img
                                src={capture.imageUrl}
                                alt={capture.title}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-105"
                                loading="lazy"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover/img:opacity-30 transition-opacity" />
                              <div className="absolute top-2 right-2 p-1.5 bg-black/70 rounded-lg text-amber-400 opacity-0 group-hover/img:opacity-100 transition-opacity">
                                <Maximize2 className="w-3.5 h-3.5" />
                              </div>
                              {capture.metadata?.aspectRatio && (
                                <span className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-mono text-zinc-400 border border-zinc-800">
                                  {capture.metadata.aspectRatio}
                                </span>
                              )}
                            </div>

                            {/* Details & Telemetry */}
                            <div className="flex-1 min-w-0 flex flex-col justify-between h-full gap-3">
                              <div>
                                <div className="flex items-center justify-between gap-2 mb-2">
                                  <span className={`text-[8px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border flex items-center gap-1.5 ${badge.color}`}>
                                    {badge.icon}
                                    {badge.label}
                                  </span>
                                  <div className="flex items-center gap-1 text-[9px] font-mono text-zinc-500">
                                    <Clock className="w-3 h-3 text-zinc-600" />
                                    <span>{new Date(capture.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                  </div>
                                </div>

                                <h4 
                                  onClick={() => { setSelectedCapture(capture); setZoomLevel(1); }}
                                  className="text-sm sm:text-base font-bold text-zinc-100 hover:text-amber-400 cursor-pointer transition-colors truncate"
                                >
                                  {capture.title}
                                </h4>

                                {capture.description && (
                                  <p className="text-xs text-zinc-400 font-sans mt-1 line-clamp-2 leading-relaxed">
                                    {capture.description}
                                  </p>
                                )}

                                {/* Prompt Quote Block if available */}
                                {capture.metadata?.prompt && (
                                  <div className="mt-2.5 p-2.5 rounded-xl bg-black/60 border border-red-950 flex items-start justify-between gap-2">
                                    <p className="text-[11px] font-mono text-amber-300/80 line-clamp-2 italic">
                                      "{capture.metadata.prompt}"
                                    </p>
                                    <button
                                      onClick={() => copyPromptText(capture.metadata?.prompt || '')}
                                      className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-amber-400 flex-shrink-0"
                                      title="Copy Prompt"
                                    >
                                      <Copy className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Tags & Action Row */}
                              <div className="pt-3 border-t border-red-900/15 flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {capture.metadata?.model && (
                                    <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                                      {capture.metadata.model}
                                    </span>
                                  )}
                                  {capture.metadata?.tags?.map((t, idx) => (
                                    <span key={idx} className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-red-950/40 text-amber-600/80 border border-red-900/20">
                                      #{t}
                                    </span>
                                  ))}
                                </div>

                                <div className="flex items-center gap-1.5 ml-auto">
                                  <button
                                    onClick={() => { setSelectedCapture(capture); setZoomLevel(1); }}
                                    className="p-2 bg-zinc-900 hover:bg-amber-950 text-zinc-400 hover:text-amber-300 rounded-lg transition-colors"
                                    title="Open Optical Inspector"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  <a
                                    href={capture.imageUrl}
                                    download={`zereo-capture-${capture.id}.png`}
                                    className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 rounded-lg transition-colors"
                                    title="Download Asset"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </a>
                                  <button
                                    onClick={() => deleteVisualCapture(capture.id)}
                                    className="p-2 bg-red-950/30 hover:bg-red-900/40 text-zinc-500 hover:text-red-400 rounded-lg transition-colors"
                                    title="Purge Capture"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* GRID VIEW */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
              <AnimatePresence mode="popLayout">
                {filteredVisuals.map((capture) => {
                  const badge = getSourceBadge(capture.source);
                  return (
                    <motion.div
                      key={capture.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-zinc-950/80 hover:bg-zinc-900/90 border border-red-900/30 hover:border-amber-500/50 rounded-2xl overflow-hidden transition-all shadow-lg flex flex-col group"
                    >
                      {/* Thumbnail with overlay badge */}
                      <div 
                        onClick={() => { setSelectedCapture(capture); setZoomLevel(1); }}
                        className="relative aspect-video w-full bg-black overflow-hidden cursor-pointer"
                      >
                        <img
                          src={capture.imageUrl}
                          alt={capture.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
                        <div className="absolute top-2 left-2">
                          <span className={`text-[7px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border flex items-center gap-1 ${badge.color}`}>
                            {badge.icon}
                            {badge.label}
                          </span>
                        </div>
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="p-1 bg-black/80 rounded text-amber-400">
                            <Maximize2 className="w-3 h-3" />
                          </div>
                        </div>
                        <div className="absolute bottom-2 right-2 text-[9px] font-mono text-zinc-400 bg-black/70 px-1.5 py-0.5 rounded">
                          {new Date(capture.timestamp).toLocaleDateString([], { month: 'numeric', day: 'numeric' })}
                        </div>
                      </div>

                      {/* Content Info */}
                      <div className="p-3.5 flex-1 flex flex-col justify-between gap-2.5">
                        <div>
                          <h4 
                            onClick={() => { setSelectedCapture(capture); setZoomLevel(1); }}
                            className="text-xs font-bold text-zinc-100 hover:text-amber-400 cursor-pointer truncate"
                          >
                            {capture.title}
                          </h4>
                          {capture.metadata?.prompt ? (
                            <p className="text-[10px] font-mono text-zinc-400 line-clamp-2 mt-1 italic">
                              "{capture.metadata.prompt}"
                            </p>
                          ) : (
                            <p className="text-[10px] text-zinc-500 line-clamp-2 mt-1">
                              {capture.description}
                            </p>
                          )}
                        </div>

                        {/* Card Footer */}
                        <div className="pt-2 border-t border-red-900/15 flex items-center justify-between text-[8px] font-mono">
                          <span className="text-zinc-500 truncate max-w-[120px]">
                            {capture.metadata?.model || 'GEMINI-PRO'}
                          </span>
                          <div className="flex items-center gap-1">
                            <a
                              href={capture.imageUrl}
                              download={`capture-${capture.id}.png`}
                              className="p-1 text-zinc-500 hover:text-amber-400 rounded"
                              title="Download"
                            >
                              <Download className="w-3 h-3" />
                            </a>
                            <button
                              onClick={() => deleteVisualCapture(capture.id)}
                              className="p-1 text-zinc-600 hover:text-red-400 rounded"
                              title="Purge"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )
        ) : (
          /* ========================================================= */
          /* STANDARD TEXT & REASONING AUDIT ARCHIVES                  */
          /* ========================================================= */
          isLoading ? (
            <div className="h-full flex flex-col items-center justify-center opacity-30">
              <Loader2 className="w-12 h-12 animate-spin text-amber-500 mb-4" />
              <p className="text-[10px] font-bold uppercase tracking-widest">Accessing Vault...</p>
            </div>
          ) : filteredMemories.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-30">
              <Brain className="w-20 h-20 text-red-800 mb-4" />
              <h3 className="text-lg font-light uppercase tracking-[0.3em] text-zinc-300">No Matching Archives</h3>
              <p className="text-xs mt-2 italic font-serif text-zinc-400">"All filtered registers are currently clear, Principal."</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <AnimatePresence mode="popLayout">
                {filteredMemories.map((memory) => {
                  const isAudit = memory.type === 'principal_audit';
                  return (
                    <motion.div
                      key={memory.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className={`border rounded-3xl p-6 flex flex-col gap-4 transition-all group relative overflow-hidden ${
                        isAudit
                          ? 'bg-red-950/20 border-amber-600/40 hover:border-amber-400 shadow-lg shadow-red-950/30'
                          : 'bg-zinc-900/40 border-red-900/20 hover:border-amber-500/30'
                      }`}
                    >
                      <div className="absolute top-0 right-0 p-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isAudit && (
                          <button 
                            onClick={() => setSelectedAuditTrace(memory)}
                            className="p-2 bg-amber-600/20 text-amber-300 rounded-xl hover:bg-amber-600/40 transition-colors"
                            title="Inspect Raw Reasoning Trace"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        <button 
                          onClick={() => deleteMemory(memory.id)}
                          className="p-2 bg-red-900/20 text-red-500 rounded-xl hover:bg-red-900/40 transition-colors"
                          title="Purge Entry"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isAudit ? 'bg-red-900/50 text-amber-400' : 'bg-red-950/40 text-amber-500'}`}>
                          {isAudit ? <ShieldCheck className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-bold text-zinc-100 truncate pr-16">{memory.title}</h4>
                          <div className="flex items-center gap-2 text-[8px] text-zinc-400 uppercase font-mono mt-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {new Date(memory.timestamp).toLocaleString()}
                          </div>
                        </div>
                      </div>

                      <div 
                        onClick={() => isAudit && setSelectedAuditTrace(memory)}
                        className={`flex-1 text-xs font-mono text-zinc-300 whitespace-pre-line line-clamp-4 ${
                          isAudit ? 'bg-black/50 p-3 rounded-xl border border-red-900/30 cursor-pointer hover:border-amber-500/40' : 'italic font-serif leading-relaxed'
                        }`}
                      >
                        {memory.content}
                      </div>

                      <div className="pt-4 border-t border-red-900/10 flex items-center justify-between">
                        <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${
                          isAudit ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-red-900'
                        }`}>
                          {isAudit ? 'PRINCIPAL AUDIT TRACE' : memory.type}
                        </span>
                        <Cloud className="w-3 h-3 text-amber-900 opacity-30" />
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )
        )}
      </div>

      {/* ========================================================= */}
      {/* OPTICAL LIGHTBOX INSPECTOR MODAL                          */}
      {/* ========================================================= */}
      {selectedCapture && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-2 sm:p-6 animate-fade-in">
          {/* Top Bar Controls */}
          <div className="w-full max-w-6xl flex items-center justify-between pb-3 mb-2 border-b border-red-900/30">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-950 border border-amber-500/30 rounded-xl">
                <Eye className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-zinc-100 flex items-center gap-2">
                  <span>{selectedCapture.title}</span>
                  <span className="text-[9px] text-amber-500 font-normal">
                    [{selectedCapture.id}]
                  </span>
                </h3>
                <p className="text-[9px] font-mono text-zinc-400">
                  {new Date(selectedCapture.timestamp).toUTCString()}
                </p>
              </div>
            </div>

            {/* Lightbox Action Controls */}
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-zinc-900 border border-red-900/30 rounded-xl p-1 gap-1">
                <button
                  onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.25))}
                  className="p-1.5 text-zinc-400 hover:text-white rounded"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-[10px] font-mono text-amber-400 px-2">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  onClick={() => setZoomLevel(prev => Math.min(3, prev + 0.25))}
                  className="p-1.5 text-zinc-400 hover:text-white rounded"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setZoomLevel(1)}
                  className="px-2 py-1 text-[9px] font-mono text-zinc-400 hover:text-amber-400"
                >
                  Reset
                </button>
              </div>

              <button
                onClick={() => setSelectedCapture(null)}
                className="p-2 bg-red-950/80 hover:bg-red-900 border border-red-800 text-zinc-300 hover:text-white rounded-xl transition-colors"
                title="Exit Lightbox"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Center Layout (Image + Meta Drawer) */}
          <div className="w-full max-w-6xl flex-1 flex flex-col lg:flex-row gap-4 overflow-hidden items-stretch">
            {/* Viewport Canvas */}
            <div className="flex-1 bg-zinc-950 rounded-2xl border border-red-900/30 overflow-hidden relative flex items-center justify-center p-4">
              <div 
                className="relative max-h-full max-w-full transition-transform duration-200 ease-out"
                style={{ transform: `scale(${zoomLevel})` }}
              >
                <img
                  src={selectedCapture.imageUrl}
                  alt={selectedCapture.title}
                  className="rounded-xl shadow-[0_0_80px_rgba(0,0,0,0.9)] max-h-[72vh] max-w-full object-contain border border-red-900/40"
                />
              </div>
            </div>

            {/* Metadata & Actions Drawer */}
            <div className="w-full lg:w-80 bg-[#0a0505] rounded-2xl border border-red-900/30 p-5 flex flex-col justify-between overflow-y-auto custom-scrollbar gap-4">
              <div className="space-y-4">
                <div>
                  <span className="text-[8px] font-mono uppercase tracking-widest text-amber-500 font-bold">
                    ORIGIN CLASSIFICATION
                  </span>
                  <div className="mt-1 flex items-center gap-2">
                    {(() => {
                      const b = getSourceBadge(selectedCapture.source);
                      return (
                        <span className={`text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-1 rounded border flex items-center gap-1.5 ${b.color}`}>
                          {b.icon}
                          {b.label}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {selectedCapture.description && (
                  <div>
                    <span className="text-[8px] font-mono uppercase tracking-widest text-zinc-500 font-bold">
                      SYSTEM DESCRIPTION
                    </span>
                    <p className="text-xs text-zinc-300 font-sans mt-1 leading-relaxed">
                      {selectedCapture.description}
                    </p>
                  </div>
                )}

                {selectedCapture.metadata?.prompt && (
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] font-mono uppercase tracking-widest text-amber-500 font-bold">
                        SYNTHESIS DIRECTIVE / PROMPT
                      </span>
                      <button
                        onClick={() => copyPromptText(selectedCapture.metadata?.prompt || '')}
                        className="text-[9px] font-mono text-amber-400 hover:underline flex items-center gap-1"
                      >
                        {copiedPrompt ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedPrompt ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <div className="mt-1.5 p-3 rounded-xl bg-black border border-red-950 font-mono text-[11px] text-amber-200/90 leading-relaxed max-h-36 overflow-y-auto">
                      {selectedCapture.metadata.prompt}
                    </div>
                  </div>
                )}

                {/* Technical Specifications */}
                <div>
                  <span className="text-[8px] font-mono uppercase tracking-widest text-zinc-500 font-bold">
                    TECHNICAL PARAMETERS
                  </span>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] font-mono">
                    <div className="p-2 bg-black/60 rounded-lg border border-red-950">
                      <span className="text-zinc-500 block text-[8px]">MODEL</span>
                      <span className="text-zinc-200 truncate block">
                        {selectedCapture.metadata?.model || 'GEMINI-PRO'}
                      </span>
                    </div>
                    <div className="p-2 bg-black/60 rounded-lg border border-red-950">
                      <span className="text-zinc-500 block text-[8px]">RATIO / DIMS</span>
                      <span className="text-zinc-200 block">
                        {selectedCapture.metadata?.aspectRatio || '16:9'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tags */}
                {selectedCapture.metadata?.tags && selectedCapture.metadata.tags.length > 0 && (
                  <div>
                    <span className="text-[8px] font-mono uppercase tracking-widest text-zinc-500 font-bold">
                      LEDGER TAGS
                    </span>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {selectedCapture.metadata.tags.map((tag, i) => (
                        <span key={i} className="text-[9px] font-mono px-2 py-0.5 rounded bg-red-950/40 text-amber-400/90 border border-red-900/20">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-red-900/20 space-y-2">
                <a
                  href={selectedCapture.imageUrl}
                  download={`zereo-vault-${selectedCapture.id}.png`}
                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-black font-mono font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-950/40 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Master Asset</span>
                </a>

                <button
                  onClick={() => { setSelectedCapture(null); openInSnapshot(); }}
                  className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 font-mono text-xs rounded-xl border border-red-900/30 flex items-center justify-center gap-2 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5 text-amber-500" />
                  <span>Analyze in Optical Hub</span>
                </button>

                <button
                  onClick={() => deleteVisualCapture(selectedCapture.id)}
                  className="w-full py-2 bg-red-950/30 hover:bg-red-900/40 text-red-400 font-mono text-xs rounded-xl border border-red-900/40 flex items-center justify-center gap-2 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Purge From Vault</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Raw Reasoning Modal View */}
      {selectedAuditTrace && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#0e0a0a] border border-amber-600/50 rounded-3xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
          >
            <div className="p-5 border-b border-red-900/30 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-mono font-bold uppercase tracking-widest text-amber-300">
                  {selectedAuditTrace.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedAuditTrace(null)}
                className="px-3 py-1 bg-red-950/60 border border-red-800/40 text-zinc-300 hover:text-white rounded-lg text-xs font-mono"
              >
                Close Trace
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 font-mono text-xs text-zinc-200">
              <pre className="bg-black/70 p-4 rounded-2xl border border-red-900/30 whitespace-pre-wrap leading-relaxed text-zinc-300 text-[11px]">
                {selectedAuditTrace.content}
              </pre>
            </div>
          </motion.div>
        </div>
      )}

      {/* Footer Status */}
      <div className="p-3.5 border-t border-red-900/20 bg-red-950/5 flex flex-wrap items-center justify-between gap-3 px-6">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest font-mono">
            Vault Active • Visual Captures: {visualCount} • Reasoning Audits: {auditCount}
          </p>
        </div>
        <p className="text-[9px] font-bold text-red-900 uppercase tracking-widest font-mono">
          Solid State Ledger: 1¹ Synchronized
        </p>
      </div>
    </div>
  );
};

export default MemoryCore;

