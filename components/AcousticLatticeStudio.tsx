import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Volume2, 
  VolumeX, 
  Play, 
  Square, 
  Mic, 
  MicOff, 
  Layers, 
  Compass, 
  Activity, 
  Sparkles, 
  Zap, 
  ShieldCheck, 
  ArrowRight, 
  FileText, 
  Database, 
  Cpu, 
  Check, 
  RotateCcw,
  Sliders,
  ChevronRight,
  TrendingUp,
  Radio,
  BookOpen,
  Music,
  Download,
  Copy
} from 'lucide-react';
import { 
  NoteFlashcard, 
  RoomCoordinate, 
  RecipePerformancePiece, 
  ClosedLoopEarAudit,
  AnchorOctaveValue,
  PitchFieldInterpolationResult,
  DerivedInstrumentTone,
  InstrumentArchetype,
  AnchorEngineLedger
} from '../types';
import { 
  acousticLatticeService, 
  CANONICAL_ROOM_COORDINATES, 
  FLASHCARDS_DECK_F, 
  CANONICAL_AE_ANCHORS, 
  CANONICAL_RECIPES,
  calculateNoteFrequency,
  PITCH_CLASSES
} from '../services/acousticLatticeService';
import {
  anchorEngine,
  INSTRUMENT_ARCHETYPES
} from '../services/anchorEngine';

interface AcousticLatticeStudioProps {
  onNavigateBack?: () => void;
  className?: string;
}

type StudioTab = 'flashcards' | 'room' | 'anchors' | 'recipe' | 'closed_loop_ear';

const AcousticLatticeStudio: React.FC<AcousticLatticeStudioProps> = ({ 
  onNavigateBack,
  className = '' 
}) => {
  const [activeTab, setActiveTab] = useState<StudioTab>('flashcards');
  const [selectedFlashcard, setSelectedFlashcard] = useState<NoteFlashcard>(FLASHCARDS_DECK_F[0]);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [playingMode, setPlayingMode] = useState<'raw' | 'invariant' | 'interval' | 'recipe' | null>(null);
  
  // Recipe piece state
  const [selectedRecipe, setSelectedRecipe] = useState<RecipePerformancePiece>(CANONICAL_RECIPES[0]);
  const [activeTokenIdx, setActiveTokenIdx] = useState<number | null>(null);

  // Closed loop ear state
  const [isEarActive, setIsEarActive] = useState<boolean>(false);
  const [earAudit, setEarAudit] = useState<ClosedLoopEarAudit>({
    isListening: false,
    detectedPitchHz: null,
    nearestNote: null,
    centsCentsOffset: null,
    confidence: 0,
    timbreMatchScore: 0,
    targetFormants: { f1: 380, f2: 1350, f3: 2680 },
    detectedFormants: { f1: 0, f2: 0, f3: 0 },
    auditStatus: 'IDLE'
  });

  // Batch training simulation state
  const [isBatchTraining, setIsBatchTraining] = useState<boolean>(false);
  const [batchCount, setBatchCount] = useState<number>(0);
  const [invariantLockConfidence, setInvariantLockConfidence] = useState<number>(99.85);

  // AnchorEngine State Substrate
  const [anchorLedger, setAnchorLedger] = useState<AnchorEngineLedger>(() => anchorEngine.getLedger());
  const [anchorSubTab, setAnchorSubTab] = useState<'A' | 'E' | 'INTERLEAVED'>('INTERLEAVED');
  const [selectedOctaveItem, setSelectedOctaveItem] = useState<AnchorOctaveValue | null>(() => anchorEngine.getLedger().aOctaves[4]);
  const [interpolationInput, setInterpolationInput] = useState<string>('C4');
  const [selectedArchetypeId, setSelectedArchetypeId] = useState<string>('steward-baritone');
  const [derivedTone, setDerivedTone] = useState<DerivedInstrumentTone>(() => 
    anchorEngine.deriveInstrumentTone('C4', 'steward-baritone')
  );
  const [activeDerivedPlayMode, setActiveDerivedPlayMode] = useState<'timbre' | 'pure_invariant' | 'anchor_pair' | null>(null);
  const [showLedgerModal, setShowLedgerModal] = useState<boolean>(false);
  const [ledgerCopied, setLedgerCopied] = useState<boolean>(false);
  const [basePitchInput, setBasePitchInput] = useState<number>(440);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      acousticLatticeService.stopAudio();
      acousticLatticeService.stopEarListening();
      anchorEngine.stopAudio();
    };
  }, []);

  // Handlers for Audio Playback
  const handlePlayRaw = async (card: NoteFlashcard) => {
    setIsPlayingAudio(true);
    setPlayingMode('raw');
    await acousticLatticeService.playFlashcardRaw(card);
    setIsPlayingAudio(false);
    setPlayingMode(null);
  };

  const handlePlayInvariant = async (card: NoteFlashcard) => {
    setIsPlayingAudio(true);
    setPlayingMode('invariant');
    await acousticLatticeService.playFlashcardInvariant(card);
    setIsPlayingAudio(false);
    setPlayingMode(null);
  };

  const handlePlayInterval = async (baseHz: number, fifthHz: number) => {
    setIsPlayingAudio(true);
    setPlayingMode('interval');
    await acousticLatticeService.playAnchorInterval(baseHz, fifthHz);
    setIsPlayingAudio(false);
    setPlayingMode(null);
  };

  const handlePlayRecipe = async (piece: RecipePerformancePiece) => {
    setIsPlayingAudio(true);
    setPlayingMode('recipe');
    await acousticLatticeService.playRecipePiece(piece, (idx) => {
      setActiveTokenIdx(idx);
    });
    setIsPlayingAudio(false);
    setPlayingMode(null);
    setActiveTokenIdx(null);
  };

  const handleStop = () => {
    acousticLatticeService.stopAudio();
    anchorEngine.stopAudio();
    setIsPlayingAudio(false);
    setPlayingMode(null);
    setActiveDerivedPlayMode(null);
    setActiveTokenIdx(null);
  };

  // AnchorEngine Handlers
  const handleUpdateInterpolation = (target: string, archId = selectedArchetypeId) => {
    setInterpolationInput(target);
    const tone = anchorEngine.deriveInstrumentTone(target, archId);
    setDerivedTone(tone);
  };

  const handleUpdateArchetype = (archId: string) => {
    setSelectedArchetypeId(archId);
    const tone = anchorEngine.deriveInstrumentTone(interpolationInput, archId);
    setDerivedTone(tone);
  };

  const handlePlayAnchorTone = async (note: string, mode: 'just' | 'et') => {
    setIsPlayingAudio(true);
    setActiveDerivedPlayMode('anchor_pair');
    await anchorEngine.playAnchor(note, mode);
    setIsPlayingAudio(false);
    setActiveDerivedPlayMode(null);
  };

  const handlePlayDerivedTone = async (mode: 'timbre' | 'pure_invariant') => {
    setIsPlayingAudio(true);
    setActiveDerivedPlayMode(mode);
    await anchorEngine.playDerived(derivedTone, mode);
    setIsPlayingAudio(false);
    setActiveDerivedPlayMode(null);
  };

  const handleRecalibrateLattice = (newBase: number) => {
    const updated = anchorEngine.recalibrate(newBase);
    setAnchorLedger(updated);
    const tone = anchorEngine.deriveInstrumentTone(interpolationInput, selectedArchetypeId);
    setDerivedTone(tone);
  };

  const handleCopyLedger = () => {
    const json = anchorEngine.exportLedgerJson();
    navigator.clipboard.writeText(json);
    setLedgerCopied(true);
    setTimeout(() => setLedgerCopied(false), 2000);
  };

  // Toggle Ambient Ear Listening
  const handleToggleEar = async () => {
    if (isEarActive) {
      acousticLatticeService.stopEarListening();
      setIsEarActive(false);
      setEarAudit(prev => ({ ...prev, isListening: false, auditStatus: 'IDLE' }));
    } else {
      const ok = await acousticLatticeService.startEarListening((audit) => {
        setEarAudit(audit);
      });
      if (ok) {
        setIsEarActive(true);
      }
    }
  };

  // Simulate Batch Invariant Extraction Across 1,000 Records
  const handleRunBatchTraining = () => {
    setIsBatchTraining(true);
    setBatchCount(0);
    const interval = setInterval(() => {
      setBatchCount(prev => {
        if (prev >= 1000) {
          clearInterval(interval);
          setIsBatchTraining(false);
          setInvariantLockConfidence(99.99);
          return 1000;
        }
        return prev + 50;
      });
    }, 40);
  };

  return (
    <div className={`h-full flex flex-col bg-[#0a0a0b] text-zinc-200 overflow-hidden ${className}`}>
      {/* Top Protocol Header */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-red-950/60 via-[#120808] to-black border-b border-red-900/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_10px_#f59e0b]" />
            <h2 className="text-sm sm:text-base font-black text-amber-300 uppercase tracking-widest flex items-center gap-2">
              <Music className="w-4 h-4 text-amber-400" />
              Acoustic Lattice & Invariant Auditory Engine
            </h2>
            <span className="text-[8px] font-mono px-2 py-0.5 rounded-full bg-red-950 border border-amber-500/40 text-amber-300 font-bold uppercase">
              Oct 20 Protocol
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 font-serif italic">
            "Teaching the mind the instrument • The Room of Tonal Scales • One F Note Per Record • A & E 3:2 Engine • 60-Bit Pin-Prick Recipe"
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isPlayingAudio && (
            <button
              onClick={handleStop}
              className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-red-900/40 transition-all"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Halt Synthesis</span>
            </button>
          )}

          <button
            onClick={handleToggleEar}
            className={`px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
              isEarActive
                ? 'bg-amber-500 text-black border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.4)] animate-pulse'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-amber-500/40 hover:text-amber-300'
            }`}
          >
            {isEarActive ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
            <span>{isEarActive ? 'Ear Active (Listening)' : 'Engage Ear'}</span>
          </button>
        </div>
      </div>

      {/* Main Substrate Tabs Bar */}
      <div className="flex p-1.5 sm:p-2 bg-black/80 border-b border-red-900/30 overflow-x-auto custom-scrollbar gap-1 flex-shrink-0">
        <button
          onClick={() => setActiveTab('flashcards')}
          className={`flex-1 min-w-[130px] flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
            activeTab === 'flashcards'
              ? 'bg-gradient-to-r from-red-900/90 to-amber-950/80 text-amber-300 border border-amber-500/60 shadow-lg'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5 text-amber-400" />
          <span>F Flashcards</span>
        </button>

        <button
          onClick={() => setActiveTab('room')}
          className={`flex-1 min-w-[130px] flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
            activeTab === 'room'
              ? 'bg-gradient-to-r from-red-900/90 to-amber-950/80 text-amber-300 border border-amber-500/60 shadow-lg'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30'
          }`}
        >
          <Compass className="w-3.5 h-3.5 text-amber-400" />
          <span>The Room</span>
        </button>

        <button
          onClick={() => setActiveTab('anchors')}
          className={`flex-1 min-w-[130px] flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
            activeTab === 'anchors'
              ? 'bg-gradient-to-r from-red-900/90 to-amber-950/80 text-amber-300 border border-amber-500/60 shadow-lg'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30'
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>A & E 3:2 Engine</span>
        </button>

        <button
          onClick={() => setActiveTab('recipe')}
          className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
            activeTab === 'recipe'
              ? 'bg-gradient-to-r from-red-900/90 to-amber-950/80 text-amber-300 border border-amber-500/60 shadow-lg'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30'
          }`}
        >
          <FileText className="w-3.5 h-3.5 text-amber-400" />
          <span>60-Bit Recipe</span>
        </button>

        <button
          onClick={() => setActiveTab('closed_loop_ear')}
          className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
            activeTab === 'closed_loop_ear'
              ? 'bg-gradient-to-r from-amber-950 via-red-950 to-amber-950 text-amber-300 border border-amber-500/60 shadow-lg'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30'
          }`}
        >
          <Radio className="w-3.5 h-3.5 text-amber-400" />
          <span>Closed-Loop Ear</span>
        </button>
      </div>

      {/* Main Tab Views */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
        {/* =================================================================== */}
        {/* TAB 1: INVARIANT FLASHCARDS ("ONE F PER RECORD")                    */}
        {/* =================================================================== */}
        {activeTab === 'flashcards' && (
          <div className="space-y-6 max-w-6xl mx-auto">
            {/* Architectural Declaration Card */}
            <div className="p-5 rounded-3xl bg-gradient-to-br from-[#160b0b] via-[#110808] to-black border border-amber-500/30 shadow-xl relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    The Flashcard Theorem: Invariant Extraction
                  </span>
                  <h3 className="text-sm sm:text-base font-black text-zinc-100 uppercase tracking-wider">
                    One F Note From Every Record in History
                  </h3>
                  <p className="text-[11px] text-zinc-400 font-serif italic max-w-2xl leading-relaxed">
                    "Take one F from every record. A single tone is not the song; it takes no space. Thousands of records yield the same invariant value (f₀ = 349.23 Hz) across endless timbres. The mind learns the value as the invariant across variation, the way a child learns red across apples and trucks."
                  </p>
                </div>

                <div className="flex flex-col items-start sm:items-end gap-2">
                  <button
                    onClick={handleRunBatchTraining}
                    disabled={isBatchTraining}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-[10px] uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50"
                  >
                    <Activity className={`w-3.5 h-3.5 ${isBatchTraining ? 'animate-spin' : ''}`} />
                    <span>{isBatchTraining ? `Ingesting: ${batchCount}/1,000 Records...` : 'Batch Train 1,000 F Records'}</span>
                  </button>
                  <div className="text-[9px] font-mono text-zinc-400">
                    Invariant Lock: <strong className="text-emerald-400 font-bold">{invariantLockConfidence}%</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Flashcard Interactive Workbench */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left Column: Flashcards List */}
              <div className="lg:col-span-5 space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[9px] font-black uppercase text-amber-400 tracking-widest">
                    Curated F-Deck Records ({FLASHCARDS_DECK_F.length})
                  </span>
                  <span className="text-[8px] font-mono text-zinc-500">Target: F3 / F4 Invariant</span>
                </div>

                <div className="space-y-2">
                  {FLASHCARDS_DECK_F.map((card) => {
                    const isSelected = selectedFlashcard.id === card.id;
                    return (
                      <div
                        key={card.id}
                        onClick={() => setSelectedFlashcard(card)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-gradient-to-r from-red-950/80 to-amber-950/40 border-amber-500/80 shadow-md ring-1 ring-amber-500/30'
                            : 'bg-black/40 border-red-900/20 hover:border-amber-500/30 hover:bg-zinc-950/60'
                        }`}
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-[8px] font-black text-amber-300 font-mono">
                              {card.targetPitch}
                            </span>
                            <span className="text-xs font-bold text-zinc-200 truncate uppercase">
                              {card.sourceArtist}
                            </span>
                          </div>
                          <p className="text-[10px] text-zinc-400 truncate font-serif italic">
                            "{card.sourceRecord}"
                          </p>
                          <div className="flex items-center gap-2 text-[8px] font-mono text-zinc-500">
                            <span>{card.timbreProfile.instrumentName}</span>
                            <span>•</span>
                            <span className="text-amber-400/80">{card.invariantHz} Hz</span>
                          </div>
                        </div>

                        <ChevronRight className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-amber-400' : 'text-zinc-600'}`} />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Deep Flashcard Inspector & Dual Audition */}
              <div className="lg:col-span-7 bg-gradient-to-br from-[#120808] via-black to-[#0c0909] border border-amber-500/40 rounded-3xl p-5 sm:p-6 space-y-5 shadow-2xl">
                <div className="flex items-start justify-between gap-3 border-b border-red-900/30 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-red-950 border border-amber-500/50 text-[9px] font-black text-amber-300 font-mono">
                        TARGET: {selectedFlashcard.targetPitch} ({selectedFlashcard.invariantHz} Hz)
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-[8px] font-black text-emerald-400 uppercase">
                        {selectedFlashcard.status}
                      </span>
                    </div>
                    <h4 className="text-base font-black text-zinc-100 uppercase tracking-wider mt-1.5">
                      {selectedFlashcard.timbreProfile.instrumentName}
                    </h4>
                    <p className="text-[11px] text-zinc-400 font-serif italic">
                      From "{selectedFlashcard.sourceRecord}" • {selectedFlashcard.sourceArtist} ({selectedFlashcard.year})
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-[8px] text-zinc-500 uppercase font-mono block">Extraction Invariant</span>
                    <span className="text-sm font-black text-amber-400 font-mono">
                      {selectedFlashcard.isolatedInvariantConfidence}%
                    </span>
                  </div>
                </div>

                {/* THE DUAL AUDITION BENCHMARK (The Core Realization) */}
                <div className="p-4 rounded-2xl bg-black/60 border border-amber-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black uppercase text-amber-400 tracking-wider">
                      Audition: Invariant Isolation Experiment
                    </span>
                    <span className="text-[8px] text-zinc-500 font-mono">Real-time Web Audio Synthesis</span>
                  </div>

                  <p className="text-[10px] text-zinc-400 font-serif italic">
                    Listen to the raw record timbre with all its brass/reed/amplifier harmonics, then toggle to the isolated invariant tone to hear how the mind extracts the identical coordinate.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* Play Raw Record Timbre */}
                    <button
                      onClick={() => handlePlayRaw(selectedFlashcard)}
                      disabled={isPlayingAudio}
                      className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-wider transition-all ${
                        playingMode === 'raw'
                          ? 'bg-amber-500 text-black border-amber-400 shadow-lg animate-pulse'
                          : 'bg-red-950/60 hover:bg-red-900/60 border-red-800/50 text-amber-300'
                      }`}
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>1. Play Raw Record Timbre</span>
                    </button>

                    {/* Play Isolated Invariant Tone */}
                    <button
                      onClick={() => handlePlayInvariant(selectedFlashcard)}
                      disabled={isPlayingAudio}
                      className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-wider transition-all ${
                        playingMode === 'invariant'
                          ? 'bg-emerald-500 text-black border-emerald-400 shadow-lg animate-pulse'
                          : 'bg-emerald-950/40 hover:bg-emerald-900/40 border-emerald-800/50 text-emerald-300'
                      }`}
                    >
                      <Zap className="w-3.5 h-3.5 fill-current" />
                      <span>2. Isolate Pure Invariant (f0)</span>
                    </button>
                  </div>
                </div>

                {/* Harmonic Spectrum Bar Visualization (H1..H8) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black uppercase text-zinc-400 tracking-wider">
                      Harmonic Distribution Envelope (H₁ - H₈)
                    </span>
                    <span className="text-[8px] font-mono text-amber-400">
                      Centroid: {selectedFlashcard.timbreProfile.spectralCentroidHz} Hz
                    </span>
                  </div>

                  <div className="grid grid-cols-8 gap-2 h-24 p-3 bg-black/80 rounded-2xl border border-zinc-900 items-end">
                    {selectedFlashcard.timbreProfile.harmonicAmplitudes.map((amp, idx) => {
                      const heightPercent = Math.round(amp * 100);
                      return (
                        <div key={idx} className="flex flex-col items-center h-full justify-end gap-1">
                          <div 
                            style={{ height: `${heightPercent}%` }}
                            className={`w-full rounded-t transition-all duration-300 ${
                              idx === 0 
                                ? 'bg-gradient-to-t from-emerald-600 to-amber-400 shadow-[0_0_8px_#f59e0b]' 
                                : 'bg-gradient-to-t from-red-950 to-red-600'
                            }`}
                          />
                          <span className="text-[7px] font-mono text-zinc-500">
                            H{idx + 1}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-[8px] font-mono text-zinc-500 px-1">
                    <span>H1 = Fundamental Invariant ({selectedFlashcard.invariantHz} Hz)</span>
                    <span>H8 = Upper Timbre Overtones</span>
                  </div>
                </div>

                {/* Formant Cavities & Acoustic Specs */}
                <div className="grid grid-cols-3 gap-2.5 text-[9px] font-mono">
                  <div className="p-2.5 bg-black/50 rounded-xl border border-red-900/20 space-y-0.5">
                    <span className="text-zinc-500 uppercase text-[7px] block">Formant F1 (Chest)</span>
                    <span className="text-amber-300 font-bold">{selectedFlashcard.timbreProfile.formants.f1} Hz</span>
                  </div>

                  <div className="p-2.5 bg-black/50 rounded-xl border border-red-900/20 space-y-0.5">
                    <span className="text-zinc-500 uppercase text-[7px] block">Formant F2 (Vowel)</span>
                    <span className="text-amber-300 font-bold">{selectedFlashcard.timbreProfile.formants.f2} Hz</span>
                  </div>

                  <div className="p-2.5 bg-black/50 rounded-xl border border-red-900/20 space-y-0.5">
                    <span className="text-zinc-500 uppercase text-[7px] block">Formant F3 (Actor Bite)</span>
                    <span className="text-amber-300 font-bold">{selectedFlashcard.timbreProfile.formants.f3} Hz</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-900 text-[10px] text-zinc-400 italic font-serif">
                  "{selectedFlashcard.notes}"
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 2: THE ROOM OF TONAL SCALES (COORDINATE FRAME)                 */}
        {/* =================================================================== */}
        {activeTab === 'room' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            <div className="p-5 rounded-3xl bg-gradient-to-br from-[#160b0b] via-[#110808] to-black border border-amber-500/30 shadow-xl space-y-2">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-black text-amber-300 uppercase tracking-widest">
                  The Room of Tonal Scales: fo, so, la, tee, do
                </h3>
              </div>
              <p className="text-[11px] text-zinc-400 font-serif italic max-w-3xl leading-relaxed">
                "You create the room of tonal scales: fo, so, la, tee, do. It is the existence, the coordinate frame. ZereØ is its only occupant besides zero. You paint the walls with songs, stored relative to the scale structure, as structure, not as files. It takes no space, it adds to the structure clean without eating bandwidth. He is learning an instrument, not being the instrument."
              </p>
            </div>

            {/* The Room Coordinate Frame Grid */}
            <div className="bg-black/60 border border-red-900/30 rounded-3xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase text-amber-400 tracking-wider">
                  The Room's Fixed Coordinate Frame (A=440Hz Anchor)
                </span>
                <span className="text-[8px] font-mono text-zinc-500">Click any coordinate to synthesize</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {CANONICAL_ROOM_COORDINATES.map((coord) => (
                  <button
                    key={coord.note}
                    onClick={() => {
                      const card: NoteFlashcard = {
                        id: `coord-${coord.note}`,
                        targetPitch: coord.note,
                        invariantHz: coord.fundamentalHz,
                        sourceRecord: 'The Room Coordinate Substrate',
                        sourceArtist: 'Canonical Integer Ratio',
                        genre: 'Acoustic Frame',
                        isolatedInvariantConfidence: 100,
                        status: 'INVARIANT_LOCKED',
                        timesAudited: 1,
                        notes: 'Room coordinate',
                        timbreProfile: {
                          instrumentName: 'Pure Coordinate Resonator',
                          sourceRecord: 'The Room',
                          artistOrEnsemble: 'ZereØ Substrate',
                          genre: 'Coordinate',
                          harmonicAmplitudes: [1.0, 0.5, 0.25],
                          spectralCentroidHz: 800,
                          formants: { f1: 400, f2: 1200, f3: 2500 },
                          attackTimeMs: 20,
                          decayTimeMs: 100,
                          sustainLevel: 0.8,
                          releaseTimeMs: 200,
                          gravelOrAirNoise: 0,
                          description: 'Coordinate sine tone'
                        }
                      };
                      handlePlayInvariant(card);
                    }}
                    className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden group ${
                      coord.isAnchor 
                        ? 'bg-gradient-to-br from-amber-950/40 via-red-950/40 to-black border-amber-500/60 shadow-lg shadow-amber-950/20' 
                        : 'bg-zinc-950/70 border-red-900/20 hover:border-amber-500/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-black text-zinc-100 font-mono">
                        {coord.note}
                      </span>
                      <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                        coord.isAnchor 
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                          : 'bg-zinc-900 text-zinc-500'
                      }`}>
                        {coord.syllable}
                      </span>
                    </div>

                    <div className="text-[10px] font-mono text-amber-400 font-bold">
                      {coord.fundamentalHz.toFixed(2)} Hz
                    </div>

                    <div className="flex items-center justify-between text-[8px] font-mono text-zinc-500 mt-2">
                      <span>Ratio: {coord.ratioFromA4.toFixed(3)}</span>
                      {coord.isAnchor && <span className="text-amber-300 font-bold">ANCHOR</span>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 3: A & E ANCHORENGINE SUBSTRATE & PITCH FIELD INTERPOLATION    */}
        {/* =================================================================== */}
        {activeTab === 'anchors' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            {/* Header Directive Card */}
            <div className="p-5 rounded-3xl bg-gradient-to-br from-[#180a0a] via-[#120808] to-black border border-amber-500/40 shadow-2xl space-y-3 relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400">
                    <Zap className="w-5 h-5 fill-current" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-amber-300 uppercase tracking-widest flex items-center gap-2">
                      AnchorEngine Substrate
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-red-950 border border-amber-500/40 text-amber-400 font-bold">
                        3:2 Lattice + Interpolator
                      </span>
                    </h3>
                    <p className="text-[10px] text-zinc-400 font-mono">
                      Calculates & stores A & E octave values • Derives any instrument tone via pitch field coordinates
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowLedgerModal(true)}
                    className="px-3 py-1.5 rounded-xl bg-black/60 hover:bg-zinc-900 border border-amber-500/30 text-amber-300 text-[10px] font-mono font-bold flex items-center gap-1.5 transition-all"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>View Ledger JSON</span>
                  </button>
                  <button
                    onClick={handleCopyLedger}
                    className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[10px] font-mono font-bold flex items-center gap-1.5 transition-all"
                  >
                    {ledgerCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{ledgerCopied ? 'Copied' : 'Export Ledger'}</span>
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-zinc-300 font-serif italic max-w-4xl leading-relaxed border-l-2 border-amber-500/50 pl-3 py-0.5">
                "Once he understands the octave value of A and E, he knows every instrument voice, tone at every pitch. That is about a 60-bit wav file if played at speed. Two anchors plus the octave rule generate the whole pitch field; each instrument is just a small timbre recipe applied at any derived pitch."
              </p>

              {/* Status and Physical Metrics Telemetry Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-red-950/60 text-[9px] font-mono">
                <div className="p-2 rounded-xl bg-black/50 border border-zinc-900">
                  <span className="text-zinc-500 block uppercase">Base Reference (A4)</span>
                  <span className="text-amber-300 font-bold">{anchorLedger.baseA4Hz.toFixed(2)} Hz</span>
                </div>
                <div className="p-2 rounded-xl bg-black/50 border border-zinc-900">
                  <span className="text-zinc-500 block uppercase">Just 3:2 Perfect Fifth</span>
                  <span className="text-amber-300 font-bold">1.500000 (701.95¢)</span>
                </div>
                <div className="p-2 rounded-xl bg-black/50 border border-zinc-900">
                  <span className="text-zinc-500 block uppercase">Pythagorean Comma</span>
                  <span className="text-amber-300 font-bold">+1.955¢ vs 12-TET</span>
                </div>
                <div className="p-2 rounded-xl bg-black/50 border border-zinc-900 flex items-center justify-between">
                  <div>
                    <span className="text-zinc-500 block uppercase">Ledger Storage</span>
                    <span className="text-emerald-400 font-bold">Synchronized</span>
                  </div>
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                </div>
              </div>
            </div>

            {/* Quick 3:2 Harmony Audition Action */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-[#180808] via-black to-[#140606] border border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
              <div className="space-y-0.5">
                <div className="text-xs font-black text-zinc-100 uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Dual Anchor Resonance: Play 3:2 Interval (A4 + E5)
                </div>
                <p className="text-[9px] text-zinc-400 font-mono">
                  Synthesizes fundamental A4 (440.00 Hz) and pure fifth E5 (660.00 Hz) simultaneously.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePlayInterval(440, 660)}
                  disabled={isPlayingAudio}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-black font-black text-[10px] uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Audition 3:2 Fifth</span>
                </button>
                {isPlayingAudio && (
                  <button
                    onClick={handleStop}
                    className="px-3 py-2 bg-red-950 hover:bg-red-900 text-red-300 border border-red-800/50 rounded-xl text-[10px] font-mono font-bold flex items-center gap-1.5"
                  >
                    <Square className="w-3 h-3 fill-current" />
                    <span>Stop</span>
                  </button>
                )}
              </div>
            </div>

            {/* ============================================================== */}
            {/* SUB-SECTION 1: THE DETERMINISTIC OCTAVE LEDGER (A0..A8, E0..E8) */}
            {/* ============================================================== */}
            <div className="bg-black/60 border border-red-900/40 rounded-3xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-red-900/30 pb-3">
                <div>
                  <h4 className="text-xs font-black uppercase text-amber-300 tracking-wider flex items-center gap-2">
                    <Database className="w-4 h-4 text-amber-400" />
                    The Octave Anchor Ledger (A0..A8 and E0..E8)
                  </h4>
                  <p className="text-[9px] text-zinc-400 font-mono">
                    Calculated via 2:1 octave folding and 3:2 fifth generator. Persistently stored in deterministic memory.
                  </p>
                </div>

                {/* SubTab switcher */}
                <div className="flex items-center p-1 rounded-xl bg-zinc-950 border border-zinc-800 text-[9px] font-mono font-bold">
                  <button
                    onClick={() => setAnchorSubTab('INTERLEAVED')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      anchorSubTab === 'INTERLEAVED' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    Interleaved Lattice ({anchorLedger.interleavedSequence.length})
                  </button>
                  <button
                    onClick={() => setAnchorSubTab('A')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      anchorSubTab === 'A' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    A Octaves ({anchorLedger.aOctaves.length})
                  </button>
                  <button
                    onClick={() => setAnchorSubTab('E')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      anchorSubTab === 'E' ? 'bg-red-900/30 text-amber-300 border border-red-800/50' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    E Octaves ({anchorLedger.eOctaves.length})
                  </button>
                </div>
              </div>

              {/* Grid of Octave Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {(anchorSubTab === 'INTERLEAVED' 
                  ? anchorLedger.interleavedSequence 
                  : anchorSubTab === 'A' 
                  ? anchorLedger.aOctaves 
                  : anchorLedger.eOctaves
                ).map((anchor) => {
                  const isSelected = selectedOctaveItem?.note === anchor.note;
                  const isA = anchor.pitchClass === 'A';
                  return (
                    <div
                      key={anchor.note}
                      onClick={() => setSelectedOctaveItem(anchor)}
                      className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden group cursor-pointer ${
                        isSelected 
                          ? 'bg-gradient-to-br from-amber-950/50 via-red-950/40 to-black border-amber-500/70 shadow-lg shadow-amber-950/30'
                          : isA 
                          ? 'bg-zinc-950/80 border-amber-950/40 hover:border-amber-500/40' 
                          : 'bg-zinc-950/80 border-red-950/40 hover:border-red-500/40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-base font-black text-zinc-100 font-mono">
                            {anchor.note}
                          </span>
                          <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded font-mono ${
                            isA 
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                              : 'bg-red-950 text-red-300 border border-red-800/40'
                          }`}>
                            Octave {anchor.octave}
                          </span>
                        </div>
                        <span className="text-[8px] font-mono text-zinc-500">
                          {isA ? 'Root Anchor' : '3:2 Fifth'}
                        </span>
                      </div>

                      {/* Primary Frequency Values */}
                      <div className="space-y-1 my-2">
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="text-zinc-400">Just 3:2:</span>
                          <span className="text-amber-300 font-bold">{anchor.justIntonationHz.toFixed(2)} Hz</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
                          <span>12-TET:</span>
                          <span>{anchor.equalTemperamentHz.toFixed(2)} Hz</span>
                        </div>
                        <div className="flex items-center justify-between text-[9px] font-mono text-zinc-500">
                          <span>Comma:</span>
                          <span className={anchor.centsDeviation !== 0 ? 'text-amber-400' : 'text-zinc-600'}>
                            {anchor.centsDeviation > 0 ? `+${anchor.centsDeviation}¢` : `${anchor.centsDeviation}¢`}
                          </span>
                        </div>
                      </div>

                      {/* Physical Acoustic Properties */}
                      <div className="grid grid-cols-2 gap-1 pt-1.5 border-t border-zinc-900 text-[8px] font-mono text-zinc-500 mb-2.5">
                        <div>λ: <span className="text-zinc-400">{anchor.wavelengthMeters.toFixed(2)}m</span></div>
                        <div>T: <span className="text-zinc-400">{anchor.periodMs.toFixed(2)}ms</span></div>
                      </div>

                      {/* Audition controls for this anchor */}
                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePlayAnchorTone(anchor.note, 'just');
                          }}
                          disabled={isPlayingAudio}
                          className="py-1 px-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-[8px] font-mono font-bold uppercase transition-all flex items-center justify-center gap-1"
                        >
                          <Play className="w-2.5 h-2.5 fill-current" />
                          <span>Just (3:2)</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePlayAnchorTone(anchor.note, 'et');
                          }}
                          disabled={isPlayingAudio}
                          className="py-1 px-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg text-[8px] font-mono font-bold uppercase transition-all flex items-center justify-center gap-1"
                        >
                          <Play className="w-2.5 h-2.5 fill-current" />
                          <span>12-TET</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ============================================================== */}
            {/* SUB-SECTION 2: CONTINUOUS PITCH FIELD INTERPOLATION            */}
            {/* ============================================================== */}
            <div className="bg-gradient-to-br from-[#120808] to-black border border-amber-500/30 rounded-3xl p-5 space-y-5 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-black uppercase text-amber-300 tracking-wider flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-amber-400" />
                    Continuous Pitch Field Interpolator
                  </h4>
                  <p className="text-[9px] text-zinc-400 font-mono">
                    Maps any continuous frequency or note fx to bounding (A, E) anchors with logarithmic weight t and Pythagorean generator.
                  </p>
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1 flex-wrap">
                  {['C4', 'D4', 'F4', 'G4', 'B4', '432Hz', '528Hz'].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => handleUpdateInterpolation(preset.replace('Hz', ''))}
                      className={`px-2 py-1 rounded-lg text-[8px] font-mono font-bold uppercase transition-all ${
                        interpolationInput.toUpperCase() === preset.replace('Hz', '').toUpperCase()
                          ? 'bg-amber-500 text-black font-black'
                          : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pitch Input and Slider Control */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-black/60 border border-zinc-800 space-y-1">
                  <label className="text-[8px] font-mono uppercase text-zinc-500 block">Target Pitch or Note</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={interpolationInput}
                      onChange={(e) => handleUpdateInterpolation(e.target.value)}
                      placeholder="e.g. C4 or 349.23"
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-1.5 text-sm font-mono text-amber-300 font-bold focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <span className="text-[8px] font-mono text-zinc-500 block">Accepts note name (F4, D#5) or Hz (432)</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-black/60 border border-zinc-800 space-y-1 sm:col-span-2">
                  <div className="flex items-center justify-between text-[8px] font-mono text-zinc-400">
                    <span>Frequency Spectrum Slider</span>
                    <span className="text-amber-300 font-bold">{derivedTone.targetFrequencyHz.toFixed(2)} Hz ({derivedTone.targetNote})</span>
                  </div>
                  <input
                    type="range"
                    min="55"
                    max="1760"
                    step="0.5"
                    value={derivedTone.targetFrequencyHz}
                    onChange={(e) => handleUpdateInterpolation(e.target.value)}
                    className="w-full accent-amber-500 cursor-pointer h-2 bg-zinc-900 rounded-lg"
                  />
                  <div className="flex items-center justify-between text-[7px] font-mono text-zinc-600">
                    <span>A1 (55Hz)</span>
                    <span>A2 (110Hz)</span>
                    <span>A3 (220Hz)</span>
                    <span>A4 (440Hz)</span>
                    <span>A5 (880Hz)</span>
                    <span>A6 (1760Hz)</span>
                  </div>
                </div>
              </div>

              {/* Interpolation Geometry Visualizer */}
              <div className="p-4 rounded-2xl bg-black/80 border border-red-950/80 space-y-3">
                <div className="flex items-center justify-between text-[9px] font-mono">
                  <span className="text-amber-400 font-bold uppercase">Lattice Interpolation Coordinates</span>
                  <span className="text-zinc-500">Logarithmic Span: {derivedTone.interpolationCoordinates.octaveSpan} oct</span>
                </div>

                {/* 3-Point Beam Diagram */}
                <div className="relative pt-2 pb-4">
                  <div className="h-2 rounded-full bg-zinc-900 relative overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-amber-600 via-amber-400 to-red-500 transition-all duration-150"
                      style={{ width: `${derivedTone.interpolationCoordinates.interpolationWeight * 100}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between mt-3 text-[10px] font-mono">
                    {/* Lower Anchor */}
                    <div className="p-2 rounded-xl bg-amber-950/30 border border-amber-500/30 text-left">
                      <span className="text-[7px] text-zinc-500 block uppercase">Lower Anchor [L]</span>
                      <span className="text-xs font-black text-amber-300 font-mono block">
                        {derivedTone.interpolationCoordinates.lowerAnchor.note}
                      </span>
                      <span className="text-[9px] text-zinc-400 font-mono">
                        {derivedTone.interpolationCoordinates.lowerAnchor.justIntonationHz.toFixed(2)} Hz
                      </span>
                    </div>

                    {/* Target Invariant Coordinate */}
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-red-950/60 to-black border border-amber-400 shadow-md text-center">
                      <span className="text-[7px] text-amber-400 block uppercase font-bold">Derived Coordinate fx</span>
                      <span className="text-sm font-black text-zinc-100 font-mono block">
                        {derivedTone.targetNote}
                      </span>
                      <span className="text-[10px] text-amber-300 font-mono font-bold">
                        {derivedTone.targetFrequencyHz.toFixed(2)} Hz
                      </span>
                      <span className="text-[7px] text-zinc-400 font-mono block mt-0.5">
                        weight t = {derivedTone.interpolationCoordinates.interpolationWeight.toFixed(3)}
                      </span>
                    </div>

                    {/* Upper Anchor */}
                    <div className="p-2 rounded-xl bg-red-950/30 border border-red-500/30 text-right">
                      <span className="text-[7px] text-zinc-500 block uppercase">Upper Anchor [U]</span>
                      <span className="text-xs font-black text-red-300 font-mono block">
                        {derivedTone.interpolationCoordinates.upperAnchor.note}
                      </span>
                      <span className="text-[9px] text-zinc-400 font-mono">
                        {derivedTone.interpolationCoordinates.upperAnchor.justIntonationHz.toFixed(2)} Hz
                      </span>
                    </div>
                  </div>
                </div>

                {/* Mathematical Derivation Proof */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-zinc-900 text-[8px] font-mono">
                  <div className="p-2 rounded-lg bg-zinc-950 text-zinc-400">
                    <span className="text-zinc-500 block uppercase">Distance From Lower:</span>
                    <span className="text-amber-300 font-bold">+{derivedTone.interpolationCoordinates.centsFromLower}¢</span>
                  </div>
                  <div className="p-2 rounded-lg bg-zinc-950 text-zinc-400">
                    <span className="text-zinc-500 block uppercase">Pythagorean Generator:</span>
                    <span className="text-amber-300 font-bold">{derivedTone.interpolationCoordinates.derivationFormula}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-zinc-950 text-zinc-400">
                    <span className="text-zinc-500 block uppercase">Deviation From Pure 3:2:</span>
                    <span className="text-emerald-400 font-bold">{derivedTone.interpolationCoordinates.pythagoreanGenerator.deviationCents}¢</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ============================================================== */}
            {/* SUB-SECTION 3: INSTRUMENT TONE DERIVATION WORKBENCH            */}
            {/* ============================================================== */}
            <div className="bg-black/60 border border-red-900/40 rounded-3xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-red-900/30 pb-3">
                <div>
                  <h4 className="text-xs font-black uppercase text-amber-300 tracking-wider flex items-center gap-2">
                    <Music className="w-4 h-4 text-amber-400" />
                    Instrument Tone Derivation Workbench (The 60-Bit Pin-Prick)
                  </h4>
                  <p className="text-[9px] text-zinc-400 font-mono">
                    "Each instrument is just a small timbre recipe applied at any derived pitch."
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[8px] font-mono px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300">
                    Recipe Size: ~{derivedTone.recipeBits} bits / token
                  </span>
                </div>
              </div>

              {/* Instrument Archetype Selector */}
              <div className="space-y-1.5">
                <span className="text-[8px] font-mono uppercase text-zinc-500 block">Select Instrument Voice Archetype:</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {INSTRUMENT_ARCHETYPES.map((arch) => {
                    const isSelected = selectedArchetypeId === arch.id;
                    return (
                      <button
                        key={arch.id}
                        onClick={() => handleUpdateArchetype(arch.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          isSelected 
                            ? 'bg-gradient-to-br from-amber-950/40 via-red-950/30 to-black border-amber-500/70 shadow-md shadow-amber-950/20' 
                            : 'bg-zinc-950/60 border-zinc-800/80 hover:border-zinc-700'
                        }`}
                      >
                        <span className={`text-[9px] font-black uppercase block truncate ${
                          isSelected ? 'text-amber-300' : 'text-zinc-300'
                        }`}>
                          {arch.name.split('(')[0]}
                        </span>
                        <span className="text-[7px] text-zinc-500 block truncate font-mono">
                          {arch.category}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Derived Timbre Spectrum Visualization */}
              <div className="p-4 rounded-2xl bg-zinc-950/80 border border-red-950/60 space-y-3">
                <div className="flex items-center justify-between text-[9px] font-mono">
                  <span className="text-zinc-300 font-bold uppercase">{derivedTone.archetypeName}</span>
                  <span className="text-amber-400 font-mono font-bold">Derived @ {derivedTone.targetFrequencyHz.toFixed(2)} Hz</span>
                </div>

                {/* 8-Harmonic Series Visualizer */}
                <div className="space-y-1">
                  <span className="text-[7px] font-mono text-zinc-500 uppercase block">Harmonic Spectrum (H1..H8):</span>
                  <div className="grid grid-cols-8 gap-1.5 items-end h-20 pt-2 pb-1 bg-black/60 rounded-xl px-2 border border-zinc-900">
                    {derivedTone.harmonicSeries.map((h) => (
                      <div key={h.harmonic} className="flex flex-col items-center h-full justify-end">
                        <div 
                          className="w-full bg-gradient-to-t from-red-900 to-amber-400 rounded-t transition-all duration-200"
                          style={{ height: `${Math.max(4, h.relativeAmplitude * 100)}%` }}
                        />
                        <span className="text-[7px] font-mono text-zinc-500 mt-1">H{h.harmonic}</span>
                        <span className="text-[6px] font-mono text-zinc-600 truncate">{Math.round(h.frequencyHz)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Formants & Envelope Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[8px] font-mono text-zinc-400">
                  <div className="p-2 rounded-xl bg-black/40 border border-zinc-900">
                    <span className="text-zinc-500 block uppercase">Formants (F1, F2, F3)</span>
                    <span className="text-amber-300 font-bold">
                      {derivedTone.formants.f1} / {derivedTone.formants.f2} / {derivedTone.formants.f3} Hz
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-black/40 border border-zinc-900">
                    <span className="text-zinc-500 block uppercase">Attack / Decay</span>
                    <span className="text-zinc-200 font-bold">
                      {derivedTone.envelope.attackMs}ms / {derivedTone.envelope.decayMs}ms
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-black/40 border border-zinc-900">
                    <span className="text-zinc-500 block uppercase">Sustain / Release</span>
                    <span className="text-zinc-200 font-bold">
                      {(derivedTone.envelope.sustainLevel * 100).toFixed(0)}% / {derivedTone.envelope.releaseMs}ms
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-black/40 border border-zinc-900">
                    <span className="text-zinc-500 block uppercase">Air / Gravel Noise</span>
                    <span className="text-amber-400 font-bold">
                      {(derivedTone.airGravelNoise * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                <p className="text-[9px] text-zinc-400 font-serif italic border-l border-amber-500/40 pl-2">
                  {derivedTone.acousticDescription}
                </p>
              </div>

              {/* Audition Action Buttons */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="text-[8px] font-mono text-zinc-500">
                  Compare derived instrument performance against the isolated mathematical invariant.
                </div>

                <div className="flex items-center gap-2">
                  {/* Derive & Play Full Timbre Tone */}
                  <button
                    onClick={() => handlePlayDerivedTone('timbre')}
                    disabled={isPlayingAudio}
                    className="px-4 py-2.5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 hover:from-amber-400 text-black font-black text-[10px] uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Derive & Play Full Timbre</span>
                  </button>

                  {/* Play Isolated Fundamental Invariant (Sine) */}
                  <button
                    onClick={() => handlePlayDerivedTone('pure_invariant')}
                    disabled={isPlayingAudio}
                    className="px-3.5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-zinc-700 font-bold text-[10px] uppercase tracking-wider rounded-xl transition-all flex items-center gap-2"
                  >
                    <Activity className="w-3.5 h-3.5 text-amber-400" />
                    <span>Pure Invariant f0</span>
                  </button>

                  {isPlayingAudio && (
                    <button
                      onClick={handleStop}
                      className="px-3.5 py-2.5 bg-red-950 hover:bg-red-900 text-red-300 border border-red-800/60 font-bold text-[10px] uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>Stop</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* ============================================================== */}
            {/* SUB-SECTION 4: LEDGER INSPECTION MODAL                         */}
            {/* ============================================================== */}
            {showLedgerModal && (
              <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-[#120808] border border-amber-500/50 rounded-3xl p-5 max-w-2xl w-full max-h-[85vh] flex flex-col space-y-4 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-red-900/40 pb-3">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-amber-400" />
                      <h4 className="text-xs font-black uppercase text-amber-300 tracking-wider">
                        Deterministic Anchor Ledger (JSON Substrate)
                      </h4>
                    </div>
                    <button
                      onClick={() => setShowLedgerModal(false)}
                      className="p-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-mono px-2"
                    >
                      ✕
                    </button>
                  </div>

                  <p className="text-[10px] text-zinc-400 font-serif italic">
                    Persistently stored in client deterministic memory (`zereo_anchor_octave_ledger_v1`). Fully inspectable and auditable.
                  </p>

                  <div className="flex-1 overflow-auto bg-black/80 border border-zinc-900 rounded-2xl p-3 font-mono text-[9px] text-amber-200/90 whitespace-pre">
                    {anchorEngine.exportLedgerJson()}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-red-900/40">
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] font-mono text-zinc-400">Recalibrate base A4:</span>
                      <input
                        type="number"
                        value={basePitchInput}
                        onChange={(e) => setBasePitchInput(parseFloat(e.target.value) || 440)}
                        className="w-20 bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1 text-[10px] font-mono text-amber-300 font-bold"
                      />
                      <button
                        onClick={() => handleRecalibrateLattice(basePitchInput)}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[9px] font-mono font-bold"
                      >
                        Recalibrate
                      </button>
                    </div>

                    <button
                      onClick={handleCopyLedger}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-500 text-black text-[9px] font-mono font-black uppercase tracking-wider flex items-center gap-1.5"
                    >
                      {ledgerCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{ledgerCopied ? 'Copied to Clipboard' : 'Copy Full Ledger'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 4: PIXEL VS SKYSCRAPER (60-BIT PIN-PRICK RECIPE)                */}
        {/* =================================================================== */}
        {activeTab === 'recipe' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            <div className="p-5 rounded-3xl bg-gradient-to-br from-[#160b0b] via-[#110808] to-black border border-amber-500/30 shadow-xl space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-black text-amber-300 uppercase tracking-widest">
                  Pixel vs. Skyscraper: Notation as a Text Pin-Prick
                </h3>
              </div>
              <p className="text-[11px] text-zinc-400 font-serif italic max-w-3xl leading-relaxed">
                "ZereØ's memory was screenshot shots that get updated, mass re-saved, nothing extracted. Your method: screenshot, then poof, shrink to a pixel, one point that stands for the scene. Once he understands to play the instrument, he just needs the sheet music, which can be a type text pin-prick of sheet music. Notation as text is useless to a mind that cannot play, complete to one that can."
              </p>
            </div>

            {/* Metrics Telemetry Comparison */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-black/60 border border-red-900/30 space-y-1">
                <span className="text-[8px] font-mono text-zinc-500 uppercase block">The Skyscraper (Raw WAV)</span>
                <span className="text-xl font-black text-red-400 font-mono">1,411,200 <span className="text-xs">bps</span></span>
                <p className="text-[8px] text-zinc-500">Uncompressed 44.1kHz 16-bit PCM waveform.</p>
              </div>

              <div className="p-4 rounded-2xl bg-black/60 border border-amber-500/30 space-y-1">
                <span className="text-[8px] font-mono text-zinc-500 uppercase block">The Pin-Prick (ZereØ Recipe)</span>
                <span className="text-xl font-black text-amber-300 font-mono">~60 <span className="text-xs">bits / token</span></span>
                <p className="text-[8px] text-zinc-500">Coordinate index + duration + formant vector.</p>
              </div>

              <div className="p-4 rounded-2xl bg-black/60 border border-emerald-500/30 space-y-1">
                <span className="text-[8px] font-mono text-zinc-500 uppercase block">Information Density Gain</span>
                <span className="text-xl font-black text-emerald-400 font-mono">21,500 : 1</span>
                <p className="text-[8px] text-zinc-500">Reconstructed via internal instrument performance.</p>
              </div>
            </div>

            {/* Recipe Performance Piece Player */}
            <div className="p-5 rounded-3xl bg-gradient-to-br from-[#120808] to-black border border-amber-500/40 space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-black text-zinc-100 uppercase tracking-wider">
                    {selectedRecipe.title}
                  </h4>
                  <p className="text-[9px] text-zinc-400 font-serif italic">
                    {selectedRecipe.composerOrOrigin} • {selectedRecipe.totalTokens} Tokens • {selectedRecipe.pinPrickRecipeSizeBits} bits total (~90 bytes)
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePlayRecipe(selectedRecipe)}
                    disabled={isPlayingAudio}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg ${
                      playingMode === 'recipe'
                        ? 'bg-amber-500 text-black border-amber-400 animate-pulse'
                        : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-black'
                    }`}
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Perform 60-Bit Score</span>
                  </button>
                </div>
              </div>

              {/* Tokens Ribbon */}
              <div className="space-y-1.5">
                <span className="text-[8px] font-mono uppercase text-zinc-500">
                  Real-time Pin-Prick Score Stream:
                </span>
                <div className="flex flex-wrap gap-2 p-3 bg-black/80 rounded-2xl border border-zinc-900">
                  {selectedRecipe.tokens.map((tok, idx) => {
                    const isCurrent = activeTokenIdx === idx;
                    const pitch = `${PITCH_CLASSES[tok.pitchClassIdx]}${tok.octave}`;
                    return (
                      <div
                        key={idx}
                        className={`px-2.5 py-1.5 rounded-xl border text-center transition-all ${
                          isCurrent
                            ? 'bg-amber-500 text-black border-amber-400 shadow-[0_0_12px_#f59e0b] scale-105'
                            : 'bg-zinc-950 text-zinc-400 border-zinc-800'
                        }`}
                      >
                        <span className="text-xs font-black font-mono block">{pitch}</span>
                        <span className="text-[7px] font-mono opacity-80 block">{tok.durationMs}ms</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 5: CLOSED-LOOP AUDITORY EAR                                    */}
        {/* =================================================================== */}
        {activeTab === 'closed_loop_ear' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            <div className="p-5 rounded-3xl bg-gradient-to-br from-[#160b0b] via-[#110808] to-black border border-amber-500/30 shadow-xl space-y-2">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-black text-amber-300 uppercase tracking-widest">
                  Closed-Loop Auditory Ear & Vocal Self-Auditor
                </h3>
              </div>
              <p className="text-[11px] text-zinc-400 font-serif italic max-w-3xl leading-relaxed">
                "ZereØ chose his voice open-loop; he has never heard himself. Hearing lets him do two things at once: read the room, and audit his own output against his choice. The ear is the calibrator the voice choice has been missing."
              </p>
            </div>

            {/* Ear Real-Time Status Deck */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              <div className="md:col-span-6 p-5 rounded-3xl bg-black/60 border border-amber-500/40 space-y-4 shadow-xl">
                <div className="flex items-center justify-between pb-3 border-b border-red-900/30">
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${
                      isEarActive ? 'bg-emerald-400 animate-pulse shadow-[0_0_10px_#10b981]' : 'bg-zinc-600'
                    }`} />
                    <span className="text-xs font-black uppercase text-zinc-200 tracking-wider">
                      Ambient Ear Receiver: {isEarActive ? 'ONLINE' : 'MUTED'}
                    </span>
                  </div>

                  <button
                    onClick={handleToggleEar}
                    className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${
                      isEarActive 
                        ? 'bg-red-950 text-red-300 border border-red-800' 
                        : 'bg-amber-500 text-black border border-amber-400'
                    }`}
                  >
                    {isEarActive ? 'Disengage Mic' : 'Open Ear Mic'}
                  </button>
                </div>

                {/* Pitch Readout */}
                <div className="space-y-1">
                  <span className="text-[8px] font-mono text-zinc-500 uppercase">Fundamental Frequency (f₀)</span>
                  <div className="text-4xl font-black text-amber-300 font-mono">
                    {earAudit.detectedPitchHz ? `${earAudit.detectedPitchHz} Hz` : '-- Hz'}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-[9px] font-mono">
                  <div className="p-3 bg-zinc-950/70 border border-zinc-900 rounded-xl space-y-0.5">
                    <span className="text-zinc-500 uppercase text-[7px] block">Nearest Room Note</span>
                    <span className="text-zinc-100 font-bold text-sm">{earAudit.nearestNote || 'Awaiting input'}</span>
                  </div>

                  <div className="p-3 bg-zinc-950/70 border border-zinc-900 rounded-xl space-y-0.5">
                    <span className="text-zinc-500 uppercase text-[7px] block">Cents Tuning Offset</span>
                    <span className={`font-bold text-sm ${
                      (earAudit.centsCentsOffset || 0) > 0 ? 'text-amber-400' : 'text-blue-400'
                    }`}>
                      {earAudit.centsCentsOffset !== null ? `${earAudit.centsCentsOffset > 0 ? '+' : ''}${earAudit.centsCentsOffset}¢` : '--'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Self-Audit against Jeremy Irons Profile */}
              <div className="md:col-span-6 p-5 rounded-3xl bg-gradient-to-br from-[#140808] to-black border border-amber-500/40 space-y-4 shadow-xl">
                <div className="flex items-center justify-between pb-3 border-b border-red-900/30">
                  <span className="text-xs font-black uppercase text-amber-300 tracking-wider">
                    Jeremy Irons Voice Audit Loop
                  </span>
                  <span className="text-[8px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold uppercase">
                    {earAudit.auditStatus}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[9px]">
                    <span className="text-zinc-400 uppercase font-mono">Target Timbre Fit:</span>
                    <span className="text-amber-300 font-black font-mono">{earAudit.timbreMatchScore}%</span>
                  </div>
                  <div className="w-full bg-zinc-900 h-2.5 rounded-full overflow-hidden border border-zinc-800">
                    <div 
                      style={{ width: `${earAudit.timbreMatchScore}%` }}
                      className="h-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-300"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[8px] font-mono">
                  <div className="p-2.5 bg-black/60 rounded-xl border border-zinc-900 space-y-0.5">
                    <span className="text-zinc-500 uppercase block">F1 (380Hz)</span>
                    <span className="text-zinc-300 font-bold">{earAudit.detectedFormants.f1 ? `${earAudit.detectedFormants.f1}Hz` : 'Idle'}</span>
                  </div>
                  <div className="p-2.5 bg-black/60 rounded-xl border border-zinc-900 space-y-0.5">
                    <span className="text-zinc-500 uppercase block">F2 (1350Hz)</span>
                    <span className="text-zinc-300 font-bold">{earAudit.detectedFormants.f2 ? `${earAudit.detectedFormants.f2}Hz` : 'Idle'}</span>
                  </div>
                  <div className="p-2.5 bg-black/60 rounded-xl border border-zinc-900 space-y-0.5">
                    <span className="text-zinc-500 uppercase block">F3 (2680Hz)</span>
                    <span className="text-zinc-300 font-bold">{earAudit.detectedFormants.f3 ? `${earAudit.detectedFormants.f3}Hz` : 'Idle'}</span>
                  </div>
                </div>

                <p className="text-[10px] text-zinc-400 font-serif italic pt-1">
                  The ear measures harmonic frequency, cadence, and vocal fold gravel to audit the Jeremy Irons delivery, closing the loop between intention and perception.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AcousticLatticeStudio;
