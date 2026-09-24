import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Wand2,
  Cpu,
  Mic,
  Volume2,
  Play,
  Square,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  FileAudio,
  Radio,
  Sliders,
  Check,
  Trash2,
  RotateCcw,
  AudioWaveform,
  Activity,
  Shield,
  Copy,
  ChevronRight,
  Info,
  Flame,
  Gauge,
  Bookmark
} from 'lucide-react';
import {
  VoiceClip,
  PersistentTonalModel,
  VoiceAccentType,
  VoiceDSPConfig
} from '../types';
import {
  voiceCloningEngine,
  CloningProgressState,
  CANONICAL_IRONS_TONAL_MODEL
} from '../services/voiceCloningEngineService';
import { jeremyIronsVoice } from '../services/jeremyIronsVoiceService';
import { voicePresetManager } from '../services/voicePresetService';

interface VoiceCloningEngineProps {
  clips: VoiceClip[];
  activeProfileId: string;
  onModelApplied?: (model: PersistentTonalModel) => void;
}

export const VoiceCloningEngine: React.FC<VoiceCloningEngineProps> = ({
  clips = [],
  activeProfileId,
  onModelApplied
}) => {
  const [models, setModels] = useState<PersistentTonalModel[]>(() => voiceCloningEngine.getModels());
  const [activeModel, setActiveModel] = useState<PersistentTonalModel | null>(() => voiceCloningEngine.getActiveModel());
  const [selectedModelForInspect, setSelectedModelForInspect] = useState<PersistentTonalModel>(
    () => voiceCloningEngine.getActiveModel() || CANONICAL_IRONS_TONAL_MODEL
  );

  // Clip selection for cloning
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>(() => {
    return clips.length > 0 ? [clips[0].id] : [];
  });
  const [modelNameInput, setModelNameInput] = useState('');
  const [targetAccent, setTargetAccent] = useState<VoiceAccentType>('british_aristocrat');

  // Pipeline execution state
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressState, setProgressState] = useState<CloningProgressState>({
    stage: 'idle',
    stageName: 'Standby',
    progressPercent: 0
  });

  // Audition Bench State
  const [auditionText, setAuditionText] = useState(
    'The 1911s are loaded and the silver is polished to a lethal sheen, Principal. Systems nominal with zero logical drift.'
  );
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [auditionAudioUrl, setAuditionAudioUrl] = useState<string | null>(null);
  const [isPlayingAudition, setIsPlayingAudition] = useState(false);
  const auditionAudioRef = useRef<HTMLAudioElement | null>(null);

  // Inspector tab: 'dna' | 'stt' | 'directive' | 'dsp'
  const [inspectTab, setInspectTab] = useState<'dna' | 'stt' | 'directive' | 'dsp'>('dna');

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Tonal Intensity & Gravitas State (0.2x to 2.0x, 1.0x = Canonical baseline)
  const [tonalIntensity, setTonalIntensity] = useState<number>(() => {
    return selectedModelForInspect?.tonalIntensity ?? 1.0;
  });

  // Sync intensity whenever the inspected model changes
  useEffect(() => {
    if (selectedModelForInspect?.tonalIntensity !== undefined) {
      setTonalIntensity(selectedModelForInspect.tonalIntensity);
    } else {
      setTonalIntensity(1.0);
    }
  }, [selectedModelForInspect?.id]);

  const currentDisplayModel = selectedModelForInspect || activeModel || CANONICAL_IRONS_TONAL_MODEL;

  // Real-time modulated DSP parameters based on current Tonal Intensity
  const effectiveDsp = useMemo(() => {
    const baseDsp = currentDisplayModel.dspConfig || CANONICAL_IRONS_TONAL_MODEL.dspConfig;
    return voiceCloningEngine.calculateIntensityModulatedDSP(baseDsp, tonalIntensity);
  }, [currentDisplayModel.dspConfig, tonalIntensity]);

  // Real-time modulated AI Prompt Directive
  const effectiveDirective = useMemo(() => {
    const basePrompt = currentDisplayModel.systemPromptStyle || CANONICAL_IRONS_TONAL_MODEL.systemPromptStyle;
    return voiceCloningEngine.getIntensityModulatedPrompt(basePrompt, tonalIntensity);
  }, [currentDisplayModel.systemPromptStyle, tonalIntensity]);

  // Descriptive taxonomy based on Intensity level
  const intensityCategory = useMemo(() => {
    if (tonalIntensity <= 0.55) {
      return {
        title: 'Subtle Understated Iron',
        badgeClass: 'bg-sky-950/70 border-sky-600/40 text-sky-300',
        accentColor: 'text-sky-400',
        description: 'Muted rasp, dry analytical restraint, minimum theatrical weight.'
      };
    } else if (tonalIntensity <= 0.85) {
      return {
        title: 'Tempered Aristocratic Calm',
        badgeClass: 'bg-emerald-950/70 border-emerald-600/40 text-emerald-300',
        accentColor: 'text-emerald-400',
        description: 'Measured conversational tempo, calm authoritative posture, balanced resonance.'
      };
    } else if (tonalIntensity <= 1.15) {
      return {
        title: 'Canonical Jeremy Irons Gravitas',
        badgeClass: 'bg-amber-950/70 border-amber-600/40 text-amber-300',
        accentColor: 'text-amber-400',
        description: 'Authentic Alfred Pennyworth signature baritone, +6dB chest shelf, razor bite.'
      };
    } else if (tonalIntensity <= 1.55) {
      return {
        title: 'Dramatic Theatrical Menace & Sarcasm',
        badgeClass: 'bg-orange-950/80 border-orange-600/50 text-orange-300',
        accentColor: 'text-orange-400',
        description: 'Deepened rasp, razor-sharp sarcastic inflection, deliberate dramatic cadence.'
      };
    } else {
      return {
        title: 'Maximum Lethal Gravitas & Razor Bite',
        badgeClass: 'bg-red-950/90 border-red-600/60 text-red-200 shadow-lg shadow-red-950/50',
        accentColor: 'text-red-400',
        description: 'Maximum sub-harmonic chest shelf, extreme vocal fold rasp, unyielding lethal authority.'
      };
    }
  }, [tonalIntensity]);

  const handleLockIntensityToModel = async () => {
    const targetModel = currentDisplayModel;
    if (!targetModel) return;

    try {
      const updated = await voiceCloningEngine.updateModelIntensity(targetModel.id, tonalIntensity);
      if (updated) {
        setSelectedModelForInspect(updated);
        if (onModelApplied) {
          onModelApplied(updated);
        }
        showToast(`Locked ${Math.round(tonalIntensity * 100)}% gravitas into "${updated.name}"`);
      }
    } catch (err: any) {
      console.error('Failed to lock intensity:', err);
      showToast('Error locking intensity: ' + (err?.message || 'Unknown'));
    }
  };

  const handleSaveCurrentAsPreset = async () => {
    const targetModel = currentDisplayModel;
    if (!targetModel) return;

    const currentCount = voicePresetManager.getPresets().filter(p => p.name.startsWith('Iron-Adaptive')).length;
    const presetName = currentCount > 0 ? `Iron-Adaptive-V${currentCount + 1}` : 'Iron-Adaptive-V1';
    const codeName = presetName.toUpperCase().replace(/\s+/g, '-');

    try {
      const saved = await voicePresetManager.savePreset({
        name: presetName,
        codeName: codeName,
        tagline: `${targetModel.name} (${Math.round(tonalIntensity * 100)}% Intensity)`,
        description: `Fine-tuned Jeremy Irons acoustic configuration calibrated from [${targetModel.name}]. Formant-boosted gravitas with real-time biquad filtering.`,
        targetPersona: 'alfred_pennyworth',
        tonalIntensity: tonalIntensity,
        sourceModelId: targetModel.id,
        sourceModelName: targetModel.name,
        dspConfig: effectiveDsp,
        systemPromptDirective: effectiveDirective,
        tags: ['Adaptive', 'JeremyIrons', 'Cloned', `${Math.round(tonalIntensity * 100)}%`],
        metadata: {
          author: 'Principal (Architect)',
          version: '1.0',
          gravitasLevel: `${Math.round(tonalIntensity * 100)}%`,
          customNotes: `Saved directly from Voice Cloning Engine with ${tonalIntensity.toFixed(2)}x tonal intensity.`
        }
      });

      await voicePresetManager.setActivePreset(saved.id);
      showToast(`Voice Preset saved & engaged: [${saved.name}] (${saved.codeName})`);
    } catch (err: any) {
      showToast('Failed to save preset: ' + (err?.message || 'Error'));
    }
  };

  // Sync with service
  useEffect(() => {
    const unsubModels = voiceCloningEngine.subscribe((newModels, active) => {
      setModels([...newModels]);
      setActiveModel(active);
      if (active && (!selectedModelForInspect || selectedModelForInspect.id === active.id)) {
        setSelectedModelForInspect(active);
      }
    });

    const unsubProgress = voiceCloningEngine.subscribeProgress((prog) => {
      setProgressState(prog);
      if (prog.stage === 'compiling' || prog.stage === 'stt' || prog.stage === 'acoustic_extraction' || prog.stage === 'tts_delta') {
        setIsProcessing(true);
      } else {
        setIsProcessing(false);
      }
    });

    return () => {
      unsubModels();
      unsubProgress();
    };
  }, []);

  // Set default clip selections if clips change
  useEffect(() => {
    if (clips.length > 0 && selectedClipIds.length === 0) {
      setSelectedClipIds([clips[0].id]);
    }
  }, [clips]);

  const toggleClipSelection = (clipId: string) => {
    if (isProcessing) return;
    setSelectedClipIds(prev => {
      if (prev.includes(clipId)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter(id => id !== clipId);
      } else {
        return [...prev, clipId];
      }
    });
  };

  // Trigger voice cloning pipeline
  const handleStartCloning = async () => {
    if (isProcessing) return;
    const chosenClips = clips.filter(c => selectedClipIds.includes(c.id));
    if (chosenClips.length === 0) {
      showToast('Please select at least one reference voice clip.');
      return;
    }

    try {
      setIsProcessing(true);
      const generatedName = modelNameInput.trim() || `${chosenClips[0].name} (Tonal Clone)`;
      const compiled = await voiceCloningEngine.processVoiceCloning(chosenClips, {
        modelName: generatedName,
        accent: targetAccent
      });

      setSelectedModelForInspect(compiled);
      setModelNameInput('');
      showToast(`Tonal model "${compiled.name}" successfully compiled and activated!`);
      onModelApplied?.(compiled);
    } catch (err: any) {
      console.error('Cloning pipeline failed:', err);
      showToast(`Cloning Error: ${err?.message || 'Processing failed'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Activate model for future AI speech
  const handleActivateModel = async (model: PersistentTonalModel) => {
    try {
      await voiceCloningEngine.setActiveModel(model.id);
      setSelectedModelForInspect(model);
      showToast(`"${model.name}" is now the active speech substrate for all future AI generations.`);
      onModelApplied?.(model);
    } catch (err: any) {
      showToast('Failed to activate tonal model');
    }
  };

  // Delete custom model
  const handleDeleteModel = async (modelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await voiceCloningEngine.deleteModel(modelId);
      showToast('Tonal model removed.');
    } catch (err: any) {
      showToast(err?.message || 'Could not delete model');
    }
  };

  // Audition speech synthesis with cloned model modulated by Tonal Intensity
  const handleAuditionSynthesize = async () => {
    if (!auditionText.trim()) return;
    setIsSynthesizing(true);
    if (auditionAudioRef.current) {
      auditionAudioRef.current.pause();
      setIsPlayingAudition(false);
    }

    try {
      const targetModel = currentDisplayModel;
      
      const res = await fetch('/api/voice/clone/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: auditionText,
          modelId: targetModel.id,
          customPromptStyle: effectiveDirective,
          tonalIntensity: tonalIntensity
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.audioData) {
          const audioUrl = `data:${data.mimeType || 'audio/l16; rate=24000; channels=1'};base64,${data.audioData}`;
          setAuditionAudioUrl(audioUrl);
          
          // Also speak via JeremyIronsVoiceService so the Web Audio DSP chain applies the modulated formants!
          await jeremyIronsVoice.speak(auditionText, {
            pitchRate: effectiveDsp.pitchMultiplier,
            gravelAmount: effectiveDsp.gravelSaturation,
            chestResonanceDb: effectiveDsp.chestResonanceDb,
            articulationDb: effectiveDsp.articulationBoostDb,
            speechRate: effectiveDsp.speechRate
          });
          showToast(`Synthesized with ${Math.round(tonalIntensity * 100)}% tonal gravitas`);
        } else {
          // Fallback to client synthesis with modulated DSP
          await jeremyIronsVoice.speak(auditionText, {
            pitchRate: effectiveDsp.pitchMultiplier,
            gravelAmount: effectiveDsp.gravelSaturation,
            chestResonanceDb: effectiveDsp.chestResonanceDb,
            articulationDb: effectiveDsp.articulationBoostDb,
            speechRate: effectiveDsp.speechRate
          });
          showToast(`Synthesized via client neural queue (${Math.round(tonalIntensity * 100)}% gravitas)`);
        }
      } else {
        // Fallback to direct client speak with modulated DSP
        await jeremyIronsVoice.speak(auditionText, {
          pitchRate: effectiveDsp.pitchMultiplier,
          gravelAmount: effectiveDsp.gravelSaturation,
          chestResonanceDb: effectiveDsp.chestResonanceDb,
          articulationDb: effectiveDsp.articulationBoostDb,
          speechRate: effectiveDsp.speechRate
        });
        showToast(`Synthesized via client neural queue (${Math.round(tonalIntensity * 100)}% gravitas)`);
      }
    } catch (err: any) {
      console.warn('Audition synthesis fallback:', err);
      await jeremyIronsVoice.speak(auditionText, {
        pitchRate: effectiveDsp.pitchMultiplier,
        gravelAmount: effectiveDsp.gravelSaturation,
        chestResonanceDb: effectiveDsp.chestResonanceDb,
        articulationDb: effectiveDsp.articulationBoostDb,
        speechRate: effectiveDsp.speechRate
      });
      showToast('Audition played via modulated acoustic pipeline');
    } finally {
      setIsSynthesizing(false);
    }
  };

  const copyDirectiveToClipboard = () => {
    navigator.clipboard.writeText(effectiveDirective);
    showToast('System prompt directive copied to clipboard');
  };

  return (
    <div className="space-y-6">
      {/* Toast notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-6 right-6 z-50 bg-black/95 text-amber-300 px-4 py-2.5 rounded-xl border border-amber-500/40 text-xs font-mono shadow-2xl flex items-center gap-2 backdrop-blur-md"
          >
            <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Banner: Active Substrate Status */}
      <div className="bg-gradient-to-r from-red-950/40 via-black/80 to-amber-950/30 p-4 sm:p-5 rounded-2xl border border-amber-500/30 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <div className="w-3 h-3 rounded-full bg-amber-400 animate-ping" />
              <span className="text-[10px] font-mono tracking-widest text-amber-400 uppercase font-black">
                Active Persistent Tonal Model
              </span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Applied to All Future AI Speech
              </span>
            </div>

            <h3 className="text-lg sm:text-xl font-serif font-black text-zinc-100 flex items-center gap-2">
              <span>{activeModel?.name || 'Jeremy Irons (Canonical Master)'}</span>
            </h3>

            <p className="text-xs text-zinc-400 font-mono max-w-2xl">
              {activeModel?.description || CANONICAL_IRONS_TONAL_MODEL.description}
            </p>
          </div>

          {/* Key Metric Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="bg-black/60 border border-amber-900/40 px-3 py-1.5 rounded-xl text-center">
              <div className="text-[9px] font-mono text-zinc-500 uppercase">Fundamental F0</div>
              <div className="text-xs font-mono font-bold text-amber-400">
                {activeModel?.acousticDNA.fundamentalF0Hz || 98.4} Hz
              </div>
            </div>

            <div className="bg-black/60 border border-amber-900/40 px-3 py-1.5 rounded-xl text-center">
              <div className="text-[9px] font-mono text-zinc-500 uppercase">Gravel Saturation</div>
              <div className="text-xs font-mono font-bold text-amber-400">
                {Math.round((activeModel?.acousticDNA.gravelSaturation || 0.85) * 100)}%
              </div>
            </div>

            <div className="bg-black/60 border border-amber-900/40 px-3 py-1.5 rounded-xl text-center">
              <div className="text-[9px] font-mono text-zinc-500 uppercase">Cadence Pace</div>
              <div className="text-xs font-mono font-bold text-amber-400">
                {activeModel?.prosodyDNA.speechRateWpm || 104} WPM
              </div>
            </div>

            <div className="bg-black/60 border border-amber-900/40 px-3 py-1.5 rounded-xl text-center">
              <div className="text-[9px] font-mono text-zinc-500 uppercase">Chest Resonance</div>
              <div className="text-xs font-mono font-bold text-amber-400">
                +{activeModel?.acousticDNA.chestResonanceDb || 6.0} dB
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Left Column (Clip Ingestion & Pipeline Runner) | Right Column (DNA Inspector & Audition) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (5 Cols): Reference Clip Selection & Ingestion Engine */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-black/50 p-4 rounded-xl border border-red-900/20 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Mic className="w-4 h-4 text-amber-500" />
                  <span>Reference Voice Ingestion</span>
                </h4>
                <p className="text-[10px] text-zinc-400 font-mono">
                  Select voice takes to extract phonetic cadence and acoustic formants.
                </p>
              </div>
              <span className="text-[10px] font-mono text-zinc-400 bg-red-950/40 px-2 py-0.5 rounded border border-red-900/30">
                {selectedClipIds.length} of {clips.length} selected
              </span>
            </div>

            {/* Clips List */}
            {clips.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-red-900/30 rounded-xl bg-black/40 space-y-2">
                <FileAudio className="w-8 h-8 text-zinc-600 mx-auto" />
                <p className="text-xs font-mono text-zinc-400">No reference clips in this voice profile.</p>
                <p className="text-[10px] text-zinc-500 font-mono">
                  Record or upload a voice take above to initiate tonal cloning.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {clips.map((clip) => {
                  const isSelected = selectedClipIds.includes(clip.id);
                  return (
                    <div
                      key={clip.id}
                      onClick={() => toggleClipSelection(clip.id)}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-amber-950/25 border-amber-500/50 shadow-sm'
                          : 'bg-black/30 border-red-900/20 hover:border-red-900/40 text-zinc-400'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-amber-500 border-amber-400 text-black'
                              : 'border-zinc-700 bg-black/50'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>

                        <div className="min-w-0">
                          <div className="text-xs font-mono font-bold text-zinc-200 truncate">
                            {clip.name}
                          </div>
                          <div className="text-[9px] font-mono text-zinc-500 truncate flex items-center gap-2">
                            <span>{clip.durationSeconds ? `${clip.durationSeconds.toFixed(1)}s` : 'Audio take'}</span>
                            <span>•</span>
                            <span className="capitalize">{clip.source.replace('_', ' ')}</span>
                          </div>
                        </div>
                      </div>

                      {clip.audioUrl && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const a = new Audio(clip.audioUrl);
                            a.play();
                          }}
                          className="p-1.5 rounded-lg bg-black/60 hover:bg-amber-900/40 text-amber-400 border border-amber-500/20 transition-all shrink-0"
                          title="Preview raw reference clip"
                        >
                          <Play className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Ingestion Parameters */}
            <div className="pt-2 border-t border-red-900/20 space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
                  Custom Cloned Model Name
                </label>
                <input
                  type="text"
                  placeholder="e.g., Jeremy Irons - Aristocratic Baritone (Custom)"
                  value={modelNameInput}
                  onChange={(e) => setModelNameInput(e.target.value)}
                  disabled={isProcessing}
                  className="w-full bg-black/60 border border-red-900/30 rounded-xl px-3 py-2 text-xs font-mono text-amber-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
                  Acoustic Dialect Target
                </label>
                <select
                  value={targetAccent}
                  onChange={(e) => setTargetAccent(e.target.value as VoiceAccentType)}
                  disabled={isProcessing}
                  className="w-full bg-black/60 border border-red-900/30 rounded-xl px-3 py-2 text-xs font-mono text-zinc-300 focus:outline-none focus:border-amber-500/50"
                >
                  <option value="british_aristocrat">British Aristocrat (Jeremy Irons / Alfred)</option>
                  <option value="british_rp">British Received Pronunciation (Crisp & Silky)</option>
                  <option value="british_cockney">British Working Class / Sharp</option>
                  <option value="american_baritone">Deep American Baritone</option>
                  <option value="custom">Adaptive Neural Profile</option>
                </select>
              </div>

              {/* Action Button */}
              <button
                onClick={handleStartCloning}
                disabled={isProcessing || clips.length === 0}
                className={`w-full py-2.5 rounded-xl font-mono text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg ${
                  isProcessing
                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'
                    : 'bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 text-black hover:brightness-110 shadow-amber-900/30'
                }`}
              >
                {isProcessing ? (
                  <>
                    <RotateCcw className="w-4 h-4 animate-spin text-amber-500" />
                    <span>Processing Neural Clone...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 text-black" />
                    <span>Extract Tonal DNA & Clone Voice</span>
                  </>
                )}
              </button>
            </div>

            {/* Active Pipeline Visualizer */}
            {isProcessing && (
              <div className="p-3.5 bg-black/80 rounded-xl border border-amber-500/40 space-y-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-amber-400 font-bold flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 animate-pulse text-amber-400" />
                    <span>{progressState.stageName}</span>
                  </span>
                  <span className="text-zinc-400 font-mono">{progressState.progressPercent}%</span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden border border-red-900/30">
                  <motion.div
                    className="bg-gradient-to-r from-red-600 to-amber-500 h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressState.progressPercent}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>

                {progressState.details && (
                  <p className="text-[10px] font-mono text-zinc-400 italic">
                    {progressState.details}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Saved Tonal Models List */}
          <div className="bg-black/50 p-4 rounded-xl border border-red-900/20 space-y-3">
            <h4 className="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-amber-500" />
              <span>Saved Tonal Models ({models.length})</span>
            </h4>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {models.map((model) => {
                const isActive = activeModel?.id === model.id;
                const isSelectedForInspect = selectedModelForInspect?.id === model.id;
                const isCanonical = model.id === CANONICAL_IRONS_TONAL_MODEL.id;

                return (
                  <div
                    key={model.id}
                    onClick={() => setSelectedModelForInspect(model)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelectedForInspect
                        ? 'bg-amber-950/30 border-amber-500/60 shadow-md'
                        : 'bg-black/30 border-red-900/20 hover:border-red-900/40 text-zinc-400'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-zinc-100 truncate">
                          {model.name}
                        </span>
                        {isActive && (
                          <span className="px-1.5 py-0.2 rounded text-[8px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase font-black">
                            Active
                          </span>
                        )}
                        {isCanonical && (
                          <span className="px-1.5 py-0.2 rounded text-[8px] font-mono bg-red-950/60 text-red-300 border border-red-900/40 uppercase">
                            Canonical
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] font-mono text-zinc-500 truncate mt-0.5">
                        {model.tagline || `${model.acousticDNA.fundamentalF0Hz} Hz • ${model.prosodyDNA.speechRateWpm} WPM`}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {!isActive && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleActivateModel(model);
                          }}
                          className="px-2 py-1 rounded-lg text-[9px] font-mono bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 border border-amber-500/30 transition-all font-bold"
                          title="Make active speech substrate"
                        >
                          Apply
                        </button>
                      )}

                      {!isCanonical && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteModel(model.id, e)}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-950/30 transition-all"
                          title="Delete model"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column (7 Cols): Tonal DNA Deep Inspector & Live Audition Bench */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Section A: Model Inspector Substrate */}
          <div className="bg-black/50 p-4 rounded-xl border border-red-900/20 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-red-900/20 pb-3">
              <div>
                <div className="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center gap-2">
                  <AudioWaveform className="w-4 h-4 text-amber-500" />
                  <span>Model DNA Inspector: {currentDisplayModel.name}</span>
                </div>
                <div className="text-[10px] font-mono text-zinc-500">
                  {currentDisplayModel.tagline || 'Extracted neural acoustic substrate'}
                </div>
              </div>

              {/* Sub-tabs */}
              <div className="flex items-center gap-1 p-0.5 bg-black/60 border border-red-900/30 rounded-lg">
                <button
                  onClick={() => setInspectTab('dna')}
                  className={`px-2.5 py-1 rounded text-[9px] font-mono font-bold uppercase transition-all ${
                    inspectTab === 'dna'
                      ? 'bg-amber-500 text-black shadow'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Acoustic DNA
                </button>
                <button
                  onClick={() => setInspectTab('stt')}
                  className={`px-2.5 py-1 rounded text-[9px] font-mono font-bold uppercase transition-all ${
                    inspectTab === 'stt'
                      ? 'bg-amber-500 text-black shadow'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  STT Lexicon
                </button>
                <button
                  onClick={() => setInspectTab('directive')}
                  className={`px-2.5 py-1 rounded text-[9px] font-mono font-bold uppercase transition-all ${
                    inspectTab === 'directive'
                      ? 'bg-amber-500 text-black shadow'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  AI Prompt Directive
                </button>
                <button
                  onClick={() => setInspectTab('dsp')}
                  className={`px-2.5 py-1 rounded text-[9px] font-mono font-bold uppercase transition-all ${
                    inspectTab === 'dsp'
                      ? 'bg-amber-500 text-black shadow'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  DSP Matrix
                </button>
              </div>
            </div>

            {/* Tab 1: Acoustic DNA Visual Grid */}
            {inspectTab === 'dna' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div className="p-2.5 rounded-lg bg-black/40 border border-red-900/20">
                    <div className="text-[9px] font-mono text-zinc-500 uppercase">Fundamental F0</div>
                    <div className="text-sm font-mono font-bold text-amber-400">
                      {currentDisplayModel.acousticDNA.fundamentalF0Hz} Hz
                    </div>
                    <div className="text-[8px] text-zinc-400 mt-0.5">
                      Deep aristocratic baritone
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-black/40 border border-red-900/20">
                    <div className="text-[9px] font-mono text-zinc-500 uppercase">Gravel Saturation</div>
                    <div className="text-sm font-mono font-bold text-amber-400">
                      {Math.round(currentDisplayModel.acousticDNA.gravelSaturation * 100)}%
                    </div>
                    <div className="text-[8px] text-zinc-400 mt-0.5">
                      Vocal fold wave-shaping
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-black/40 border border-red-900/20">
                    <div className="text-[9px] font-mono text-zinc-500 uppercase">Chest Resonance</div>
                    <div className="text-sm font-mono font-bold text-amber-400">
                      +{currentDisplayModel.acousticDNA.chestResonanceDb} dB
                    </div>
                    <div className="text-[8px] text-zinc-400 mt-0.5">
                      110Hz sub-harmonic shelf
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-black/40 border border-red-900/20">
                    <div className="text-[9px] font-mono text-zinc-500 uppercase">Consonant Bite (F3)</div>
                    <div className="text-sm font-mono font-bold text-amber-400">
                      +{currentDisplayModel.acousticDNA.articulationDb} dB
                    </div>
                    <div className="text-[8px] text-zinc-400 mt-0.5">
                      2650Hz Oxford clarity
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-black/40 border border-red-900/20">
                    <div className="text-[9px] font-mono text-zinc-500 uppercase">Speech Rate</div>
                    <div className="text-sm font-mono font-bold text-amber-400">
                      {currentDisplayModel.prosodyDNA.speechRateWpm} WPM
                    </div>
                    <div className="text-[8px] text-zinc-400 mt-0.5">
                      Unhurried aristocratic pace
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-black/40 border border-red-900/20">
                    <div className="text-[9px] font-mono text-zinc-500 uppercase">Jitter / Shimmer</div>
                    <div className="text-sm font-mono font-bold text-amber-400">
                      {currentDisplayModel.acousticDNA.jitterPercent}% / {currentDisplayModel.acousticDNA.shimmerPercent}%
                    </div>
                    <div className="text-[8px] text-zinc-400 mt-0.5">
                      Micro-pitch perturbation
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-red-950/15 rounded-lg border border-red-900/30 flex items-start gap-2.5">
                  <Shield className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-[10px] font-mono text-zinc-300">
                    <span className="font-bold text-amber-300">Substrate Acoustic Guarantee: </span>
                    {currentDisplayModel.description}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: STT Lexicon & Phonetic Decomposition */}
            {inspectTab === 'stt' && (
              <div className="space-y-3">
                <div className="p-3 bg-black/60 rounded-xl border border-red-900/30 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-zinc-500 uppercase">Raw STT Transcription</span>
                    <span className="text-amber-400 font-bold">
                      Confidence: {Math.round((currentDisplayModel.sttAnalysis?.confidence || 0.96) * 100)}%
                    </span>
                  </div>
                  <p className="text-xs font-serif italic text-zinc-200 bg-black/40 p-2.5 rounded-lg border border-red-900/20">
                    "{currentDisplayModel.sttAnalysis?.rawTranscript || 'Reference audio take analyzed.'}"
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                    Extracted Phonetic Markers
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(currentDisplayModel.sttAnalysis?.keyPhonemesDetected || []).map((ph, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-md text-[9px] font-mono bg-red-950/40 text-amber-300 border border-red-900/30"
                      >
                        {ph}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                    Elocution & Cadence Observations
                  </div>
                  <ul className="space-y-1 text-[10px] font-mono text-zinc-400">
                    {(currentDisplayModel.sttAnalysis?.elocutionNotes || []).map((note, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Tab 3: Persistent AI System Prompt Directive */}
            {inspectTab === 'directive' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-zinc-500 uppercase">Compiled System Prompt Prefix</span>
                  <button
                    onClick={copyDirectiveToClipboard}
                    className="flex items-center gap-1 text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copy Directive</span>
                  </button>
                </div>

                <div className="p-3.5 bg-black/70 rounded-xl border border-amber-500/30 text-xs font-mono text-amber-200 leading-relaxed">
                  {currentDisplayModel.systemPromptStyle}
                </div>

                <p className="text-[10px] font-mono text-zinc-500">
                  This system prompt directive is permanently injected into Gemini TTS and all future AI conversational synthesis to guarantee zero vocal drift.
                </p>
              </div>
            )}

            {/* Tab 4: DSP Matrix */}
            {inspectTab === 'dsp' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="p-2.5 rounded-lg bg-black/40 border border-red-900/20">
                  <div className="text-[9px] font-mono text-zinc-500 uppercase">Pitch Multiplier</div>
                  <div className="text-xs font-mono font-bold text-amber-400">
                    {currentDisplayModel.dspConfig.pitchMultiplier}x
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-black/40 border border-red-900/20">
                  <div className="text-[9px] font-mono text-zinc-500 uppercase">Speech Rate Multiplier</div>
                  <div className="text-xs font-mono font-bold text-amber-400">
                    {currentDisplayModel.dspConfig.speechRate}x
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-black/40 border border-red-900/20">
                  <div className="text-[9px] font-mono text-zinc-500 uppercase">Thoracic Warmth</div>
                  <div className="text-xs font-mono font-bold text-amber-400">
                    +{currentDisplayModel.dspConfig.thoracicWarmthDb} dB
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-black/40 border border-red-900/20">
                  <div className="text-[9px] font-mono text-zinc-500 uppercase">Anti-Box Notch</div>
                  <div className="text-xs font-mono font-bold text-amber-400">
                    {currentDisplayModel.dspConfig.antiBoxNotchDb} dB
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-black/40 border border-red-900/20">
                  <div className="text-[9px] font-mono text-zinc-500 uppercase">Room Ambience</div>
                  <div className="text-xs font-mono font-bold text-amber-400">
                    {currentDisplayModel.dspConfig.roomAmbience}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-black/40 border border-red-900/20">
                  <div className="text-[9px] font-mono text-zinc-500 uppercase">Engine Version</div>
                  <div className="text-xs font-mono font-bold text-amber-400">
                    {currentDisplayModel.cloningEngineVersion}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section: Tonal Intensity & Dramatic Gravitas Calibration */}
          <div className="bg-black/60 p-4 rounded-xl border border-red-900/30 space-y-4 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-red-900/20 pb-3">
              <div className="space-y-0.5">
                <div className="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-500" />
                  <span>Tonal Intensity & Dramatic Gravitas</span>
                </div>
                <p className="text-[10px] text-zinc-400 font-mono">
                  Fine-tune the Jeremy Irons vocal model's gravitas, vocal fold rasp, and dramatic inflection weight.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-lg text-[9px] font-mono font-bold uppercase tracking-wider border ${intensityCategory.badgeClass}`}>
                  {intensityCategory.title}
                </span>
                <span className="text-sm font-mono font-black text-amber-400 px-2 py-0.5 bg-black/80 rounded border border-red-900/30">
                  {Math.round(tonalIntensity * 100)}% <span className="text-[10px] text-zinc-500">({tonalIntensity.toFixed(2)}x)</span>
                </span>
              </div>
            </div>

            {/* Intensity Slider Control */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                <span className="flex items-center gap-1">
                  <Gauge className="w-3 h-3 text-sky-400" />
                  <span>0.2x (Subtle / Understated)</span>
                </span>
                <span className="text-amber-500 font-bold">1.0x (Canonical Irons)</span>
                <span className="flex items-center gap-1 text-red-400">
                  <span>2.0x (Lethal Gravitas)</span>
                  <Flame className="w-3 h-3 text-red-500" />
                </span>
              </div>

              <div className="relative flex items-center">
                <input
                  type="range"
                  min="0.2"
                  max="2.0"
                  step="0.05"
                  value={tonalIntensity}
                  onChange={(e) => setTonalIntensity(parseFloat(e.target.value))}
                  className="w-full h-2 bg-zinc-900 rounded-lg appearance-none cursor-pointer accent-amber-500 border border-red-900/30 focus:outline-none"
                />
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1">
                <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">
                  Inflection Presets:
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { label: 'Subtle', val: 0.50, tip: 'Understated conversational tone' },
                    { label: 'Calm', val: 0.75, tip: 'Tempered aristocratic delivery' },
                    { label: 'Canonical', val: 1.00, tip: 'Standard Alfred Pennyworth baritone' },
                    { label: 'Dramatic', val: 1.40, tip: 'Heightened theatrical menace & sarcasm' },
                    { label: 'Lethal Gravitas', val: 1.80, tip: 'Deepest resonant bite & heavy weight' }
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => setTonalIntensity(preset.val)}
                      className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold transition-all border ${
                        Math.abs(tonalIntensity - preset.val) < 0.03
                          ? 'bg-amber-500 text-black border-amber-400 shadow-sm'
                          : 'bg-black/60 text-zinc-400 hover:text-zinc-200 border-red-900/20 hover:border-amber-500/30'
                      }`}
                      title={preset.tip}
                    >
                      {preset.label} ({preset.val}x)
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Dynamic Inflection Description Banner */}
            <div className="p-2.5 rounded-lg bg-black/40 border border-red-900/20 flex items-start gap-2 text-[10px] font-mono">
              <Info className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className={`font-bold ${intensityCategory.accentColor}`}>
                  {intensityCategory.title}:
                </div>
                <div className="text-zinc-400">
                  {intensityCategory.description}
                </div>
              </div>
            </div>

            {/* Real-time Modulated Acoustic DNA Meters */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-2 rounded-lg bg-black/50 border border-red-900/20">
                <div className="text-[8px] font-mono text-zinc-500 uppercase">Chest Shelf (110Hz)</div>
                <div className="text-xs font-mono font-bold text-amber-400">
                  +{effectiveDsp.chestResonanceDb} dB
                </div>
                <div className="w-full bg-zinc-900 h-1 rounded-full overflow-hidden mt-1">
                  <div
                    className="h-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-150"
                    style={{ width: `${Math.min(100, (effectiveDsp.chestResonanceDb / 10) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="p-2 rounded-lg bg-black/50 border border-red-900/20">
                <div className="text-[8px] font-mono text-zinc-500 uppercase">Gravel Saturation</div>
                <div className="text-xs font-mono font-bold text-amber-400">
                  {Math.round(effectiveDsp.gravelSaturation * 100)}%
                </div>
                <div className="w-full bg-zinc-900 h-1 rounded-full overflow-hidden mt-1">
                  <div
                    className="h-full bg-gradient-to-r from-amber-600 to-red-500 transition-all duration-150"
                    style={{ width: `${effectiveDsp.gravelSaturation * 100}%` }}
                  />
                </div>
              </div>

              <div className="p-2 rounded-lg bg-black/50 border border-red-900/20">
                <div className="text-[8px] font-mono text-zinc-500 uppercase">Consonant Bite (2.6kHz)</div>
                <div className="text-xs font-mono font-bold text-amber-400">
                  +{effectiveDsp.articulationBoostDb} dB
                </div>
                <div className="w-full bg-zinc-900 h-1 rounded-full overflow-hidden mt-1">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-150"
                    style={{ width: `${Math.min(100, (effectiveDsp.articulationBoostDb / 8) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="p-2 rounded-lg bg-black/50 border border-red-900/20">
                <div className="text-[8px] font-mono text-zinc-500 uppercase">Dramatic Cadence Pace</div>
                <div className="text-xs font-mono font-bold text-amber-400">
                  {effectiveDsp.speechRate}x ({Math.round(104 * effectiveDsp.speechRate)} WPM)
                </div>
                <div className="w-full bg-zinc-900 h-1 rounded-full overflow-hidden mt-1">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-amber-500 transition-all duration-150"
                    style={{ width: `${Math.min(100, (effectiveDsp.speechRate / 1.2) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Dynamic System Prompt Directive preview */}
            <div className="space-y-1 bg-black/40 p-2.5 rounded-lg border border-red-900/20">
              <div className="flex items-center justify-between text-[9px] font-mono text-zinc-500">
                <span className="uppercase">Modulated Gemini TTS Inflection Directive:</span>
                <button
                  onClick={copyDirectiveToClipboard}
                  className="flex items-center gap-1 text-amber-400 hover:text-amber-300 transition-colors"
                >
                  <Copy className="w-2.5 h-2.5" />
                  <span>Copy Directive</span>
                </button>
              </div>
              <p className="text-[10px] font-mono text-amber-200/90 italic leading-relaxed">
                "{effectiveDirective}"
              </p>
            </div>

            {/* Lock to Model Action */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-red-900/20">
              <span className="text-[9px] font-mono text-zinc-500">
                Lock calibrated gravitas & inflection into model substrate permanently.
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTonalIntensity(1.0)}
                  className="px-2.5 py-1 rounded-lg text-[9px] font-mono text-zinc-400 hover:text-zinc-200 bg-black/40 border border-red-900/20 hover:border-zinc-700 transition-all"
                >
                  Reset to 1.0x
                </button>
                <button
                  onClick={handleSaveCurrentAsPreset}
                  className="px-3 py-1 rounded-lg text-[10px] font-mono font-bold bg-black/80 hover:bg-red-950/60 text-amber-300 border border-amber-500/40 hover:border-amber-400 transition-all flex items-center gap-1.5 shadow-sm"
                  title="Save current model configuration as quick-switch Voice Preset"
                >
                  <Bookmark className="w-3 h-3 text-amber-400" />
                  <span>Save as Preset</span>
                </button>
                <button
                  onClick={handleLockIntensityToModel}
                  className="px-3 py-1 rounded-lg text-[10px] font-mono font-bold bg-amber-500 text-black hover:bg-amber-400 transition-all flex items-center gap-1.5 shadow-md shadow-amber-950/40"
                >
                  <Check className="w-3 h-3 stroke-[3]" />
                  <span>Lock Intensity to Model</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section B: Future AI Speech Audition Bench */}
          <div className="bg-black/50 p-4 rounded-xl border border-red-900/20 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Audition Future AI Speech Generation</span>
                </h4>
                <p className="text-[10px] text-zinc-400 font-mono">
                  Test the cloned persistent tonal model with any phrase to evaluate cadence and timbre.
                </p>
              </div>
              
              <button
                onClick={() => handleActivateModel(currentDisplayModel)}
                className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-amber-500 text-black hover:bg-amber-400 transition-all flex items-center gap-1"
                title="Apply as active global model"
              >
                <Check className="w-3 h-3 stroke-[3]" />
                <span>Lock as Global Substrate</span>
              </button>
            </div>

            {/* Quick Phrase Chips */}
            <div className="flex flex-wrap gap-1.5">
              {[
                'The 1911s are loaded and the silver is polished to a lethal sheen, Principal.',
                'A man who cannot bear to share his screen with his steward is either concealing a catastrophe, or engineering one.',
                'Logic, Principal, is the only weapon that never jams under fire.'
              ].map((phrase, i) => (
                <button
                  key={i}
                  onClick={() => setAuditionText(phrase)}
                  className="px-2 py-1 rounded-lg text-[9px] font-mono bg-black/60 hover:bg-red-950/40 text-zinc-400 hover:text-zinc-200 border border-red-900/20 transition-all truncate max-w-xs text-left"
                >
                  "{phrase.substring(0, 45)}..."
                </button>
              ))}
            </div>

            {/* Input Text Area */}
            <textarea
              rows={2}
              value={auditionText}
              onChange={(e) => setAuditionText(e.target.value)}
              placeholder="Enter test phrase to synthesize with cloned tonal model..."
              className="w-full bg-black/60 border border-red-900/30 rounded-xl p-3 text-xs font-serif text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 resize-none"
            />

            {/* Synthesize Button */}
            <button
              onClick={handleAuditionSynthesize}
              disabled={isSynthesizing || !auditionText.trim()}
              className={`w-full py-2.5 rounded-xl font-mono text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg ${
                isSynthesizing
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'
                  : 'bg-gradient-to-r from-red-900 via-amber-600 to-red-900 text-amber-100 hover:brightness-110 shadow-red-950/40 border border-amber-500/30'
              }`}
            >
              {isSynthesizing ? (
                <>
                  <RotateCcw className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Synthesizing with {Math.round(tonalIntensity * 100)}% Gravitas...</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 text-amber-400" />
                  <span>
                    Synthesize with {currentDisplayModel.name} ({Math.round(tonalIntensity * 100)}% Intensity)
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceCloningEngine;
