import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bookmark,
  BookmarkCheck,
  Star,
  Play,
  Square,
  RotateCcw,
  Plus,
  Copy,
  Trash2,
  Edit3,
  Sliders,
  Check,
  Flame,
  Gauge,
  Sparkles,
  Volume2,
  Shield,
  Info,
  Tag,
  Search,
  Filter,
  ArrowRight,
  ExternalLink,
  Wand2,
  CheckCircle2,
  SlidersHorizontal
} from 'lucide-react';
import { VoiceTonalPreset, PresetPersonaType, PersistentTonalModel, VoiceDSPConfig } from '../types';
import { voicePresetManager, FACTORY_VOICE_PRESETS } from '../services/voicePresetService';
import { voiceCloningEngine } from '../services/voiceCloningEngineService';
import { jeremyIronsVoice } from '../services/jeremyIronsVoiceService';

interface VoicePresetManagerProps {
  onPresetActivated?: (preset: VoiceTonalPreset) => void;
  activeModelOverride?: PersistentTonalModel | null;
  className?: string;
}

export const VoicePresetManager: React.FC<VoicePresetManagerProps> = ({
  onPresetActivated,
  activeModelOverride,
  className = ''
}) => {
  const [presets, setPresets] = useState<VoiceTonalPreset[]>(() => voicePresetManager.getPresets());
  const [activePreset, setActivePreset] = useState<VoiceTonalPreset>(() => voicePresetManager.getActivePreset());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPersonaFilter, setSelectedPersonaFilter] = useState<string>('ALL');
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  // Audition state
  const [isAuditioning, setIsAuditioning] = useState(false);
  const [auditioningPresetId, setAuditioningPresetId] = useState<string | null>(null);
  const [customAuditionText, setCustomAuditionText] = useState(
    "The 1911s are loaded and the silver is polished to a lethal sheen, Principal. Systems nominal with zero logical drift."
  );

  // Modal: Save/Edit Preset
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<VoiceTonalPreset | null>(null);

  // Form Fields
  const [formName, setFormName] = useState('Iron-Adaptive-V1');
  const [formCodeName, setFormCodeName] = useState('IRON-ADAPTIVE-V1');
  const [formTagline, setFormTagline] = useState('Dynamic Alfred Pennyworth Baritone');
  const [formDescription, setFormDescription] = useState('Fine-tuned Jeremy Irons acoustic configuration with dynamic gravitas and razor plosives.');
  const [formPersona, setFormPersona] = useState<PresetPersonaType>('alfred_pennyworth');
  const [formIntensity, setFormIntensity] = useState<number>(1.0);
  const [formTags, setFormTags] = useState<string>('Adaptive, Canonical, Gravitas');
  const [formNotes, setFormNotes] = useState<string>('Calibrated for direct tactical stewardship of the Principal.');
  const [formActivateImmediately, setFormActivateImmediately] = useState(true);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Subscribe to preset changes
  useEffect(() => {
    const unsub = voicePresetManager.subscribe((newPresets, active) => {
      setPresets(newPresets);
      setActivePreset(active);
    });
    return () => unsub();
  }, []);

  // Filtered Presets
  const filteredPresets = useMemo(() => {
    return presets.filter(preset => {
      // Favorites filter
      if (onlyFavorites && !preset.isFavorite) return false;

      // Persona filter
      if (selectedPersonaFilter !== 'ALL' && preset.targetPersona !== selectedPersonaFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchName = preset.name.toLowerCase().includes(query);
        const matchCode = preset.codeName.toLowerCase().includes(query);
        const matchTagline = preset.tagline.toLowerCase().includes(query);
        const matchTags = preset.tags.some(t => t.toLowerCase().includes(query));
        return matchName || matchCode || matchTagline || matchTags;
      }

      return true;
    });
  }, [presets, searchQuery, selectedPersonaFilter, onlyFavorites]);

  // Activate preset
  const handleActivatePreset = async (preset: VoiceTonalPreset) => {
    try {
      await voicePresetManager.setActivePreset(preset.id);
      showToast(`Engaged Preset: [${preset.name}] (${preset.codeName})`);
      if (onPresetActivated) {
        onPresetActivated(preset);
      }
    } catch (err: any) {
      showToast('Failed to activate preset: ' + (err?.message || 'Error'));
    }
  };

  // Audition preset
  const handleAuditionPreset = async (preset: VoiceTonalPreset) => {
    if (isAuditioning) return;
    setIsAuditioning(true);
    setAuditioningPresetId(preset.id);

    try {
      await voicePresetManager.auditionPreset(preset, customAuditionText);
      showToast(`Auditioned preset [${preset.name}]`);
    } catch (err: any) {
      console.warn('Audition error:', err);
      showToast('Audition failed: ' + (err?.message || 'Error'));
    } finally {
      setIsAuditioning(false);
      setAuditioningPresetId(null);
    }
  };

  // Toggle favorite
  const handleToggleFavorite = (presetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const isFav = voicePresetManager.toggleFavorite(presetId);
    showToast(isFav ? 'Marked as favorite preset' : 'Removed from favorites');
  };

  // Duplicate preset
  const handleDuplicatePreset = async (presetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const copy = await voicePresetManager.duplicatePreset(presetId);
      if (copy) {
        showToast(`Created duplicate: "${copy.name}"`);
      }
    } catch (err: any) {
      showToast('Duplicate failed: ' + (err?.message || 'Error'));
    }
  };

  // Delete preset
  const handleDeletePreset = async (preset: VoiceTonalPreset, e: React.MouseEvent) => {
    e.stopPropagation();
    if (preset.isBuiltin) {
      showToast('Cannot delete canonical factory presets.');
      return;
    }

    if (!confirm(`Are you certain you wish to delete preset "${preset.name}"?`)) {
      return;
    }

    try {
      await voicePresetManager.deletePreset(preset.id);
      showToast(`Deleted preset "${preset.name}"`);
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete preset');
    }
  };

  // Open modal to create a new preset from current state
  const handleOpenCreateModal = () => {
    const currentModel = activeModelOverride || voiceCloningEngine.getActiveModel();
    const currentIntensity = currentModel?.tonalIntensity ?? 1.0;

    // Generate unique suggested name like 'Iron-Adaptive-V2'
    const existingAdaptiveCount = presets.filter(p => p.name.startsWith('Iron-Adaptive')).length;
    const defaultName = existingAdaptiveCount > 0 ? `Iron-Adaptive-V${existingAdaptiveCount + 1}` : 'Iron-Adaptive-V1';

    setEditingPreset(null);
    setFormName(defaultName);
    setFormCodeName(defaultName.toUpperCase().replace(/\s+/g, '-'));
    setFormTagline('Calibrated Alfred Pennyworth Configuration');
    setFormDescription(currentModel?.description || 'Custom configured Jeremy Irons acoustic model with modulated formants and gravitas.');
    setFormPersona('alfred_pennyworth');
    setFormIntensity(currentIntensity);
    setFormTags('Adaptive, Irons, Custom, Tactical');
    setFormNotes('Directly captured from neural tuning substrate.');
    setFormActivateImmediately(true);
    setIsModalOpen(true);
  };

  // Open modal to edit existing custom preset
  const handleOpenEditModal = (preset: VoiceTonalPreset, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPreset(preset);
    setFormName(preset.name);
    setFormCodeName(preset.codeName);
    setFormTagline(preset.tagline);
    setFormDescription(preset.description);
    setFormPersona(preset.targetPersona);
    setFormIntensity(preset.tonalIntensity);
    setFormTags(preset.tags.join(', '));
    setFormNotes(preset.metadata?.customNotes || '');
    setFormActivateImmediately(preset.id === activePreset.id);
    setIsModalOpen(true);
  };

  // Save preset from modal
  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast('Preset name is required.');
      return;
    }

    const currentModel = activeModelOverride || voiceCloningEngine.getActiveModel();
    const baseDsp = editingPreset?.dspConfig || currentModel.dspConfig;
    const modulatedDsp = voiceCloningEngine.calculateIntensityModulatedDSP(baseDsp, formIntensity);
    const modulatedPrompt = voiceCloningEngine.getIntensityModulatedPrompt(
      editingPreset?.systemPromptDirective || currentModel.systemPromptStyle,
      formIntensity
    );

    const parsedTags = formTags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    try {
      const saved = await voicePresetManager.savePreset({
        id: editingPreset?.id,
        name: formName.trim(),
        codeName: formCodeName.trim() || formName.toUpperCase().replace(/\s+/g, '-'),
        tagline: formTagline.trim(),
        description: formDescription.trim(),
        targetPersona: formPersona,
        tonalIntensity: formIntensity,
        sourceModelId: currentModel.id,
        sourceModelName: currentModel.name,
        dspConfig: modulatedDsp,
        systemPromptDirective: modulatedPrompt,
        tags: parsedTags,
        metadata: {
          author: 'Principal (Architect)',
          version: '1.0',
          gravitasLevel: `${Math.round(formIntensity * 100)}% Intensity`,
          customNotes: formNotes.trim()
        }
      });

      if (formActivateImmediately) {
        await voicePresetManager.setActivePreset(saved.id);
      }

      showToast(`Preset "${saved.name}" successfully saved!`);
      setIsModalOpen(false);
    } catch (err: any) {
      showToast('Failed to save preset: ' + (err?.message || 'Error'));
    }
  };

  // Helper for persona styling
  const getPersonaBadge = (persona: PresetPersonaType) => {
    switch (persona) {
      case 'theatrical_menace':
        return { label: 'Theatrical Menace', color: 'bg-red-950/80 text-red-300 border-red-800/40' };
      case 'tactical_command':
        return { label: '13th MEU Command', color: 'bg-orange-950/80 text-orange-300 border-orange-800/40' };
      case 'subtle_steward':
        return { label: 'Subtle Steward', color: 'bg-sky-950/80 text-sky-300 border-sky-800/40' };
      case 'oxford_dignitary':
        return { label: 'Oxford Dignitary', color: 'bg-purple-950/80 text-purple-300 border-purple-800/40' };
      case 'alfred_pennyworth':
      default:
        return { label: 'Alfred Pennyworth', color: 'bg-amber-950/80 text-amber-300 border-amber-800/40' };
    }
  };

  return (
    <div className={`space-y-5 ${className}`}>
      {/* Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-3 bg-amber-500/20 border border-amber-500/50 rounded-xl text-amber-200 text-xs font-mono flex items-center gap-2 shadow-xl shadow-black/80"
          >
            <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Preset Banner */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-red-950/40 via-black/80 to-amber-950/30 border border-red-900/40 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-32 bg-amber-500/5 blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                <BookmarkCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Active Voice Preset:</span>
              </span>
              <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider bg-amber-500 text-black shadow-sm">
                Engaged Substrate
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="text-xl font-bold text-amber-400 font-serif tracking-tight">
                {activePreset.name}
              </h3>
              <span className="px-2 py-0.5 rounded font-mono text-xs font-bold text-zinc-300 bg-black/60 border border-red-900/30">
                [{activePreset.codeName}]
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium border ${getPersonaBadge(activePreset.targetPersona).color}`}>
                {getPersonaBadge(activePreset.targetPersona).label}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono text-amber-300 bg-amber-950/60 border border-amber-800/30 flex items-center gap-1">
                <Flame className="w-3 h-3 text-amber-400" />
                <span>{Math.round(activePreset.tonalIntensity * 100)}% Gravitas</span>
              </span>
            </div>

            <p className="text-xs text-zinc-300 max-w-2xl font-mono leading-relaxed">
              {activePreset.tagline} — <span className="text-zinc-400">{activePreset.description}</span>
            </p>
          </div>

          {/* Quick Audition & Save Buttons */}
          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto shrink-0">
            <button
              onClick={() => handleAuditionPreset(activePreset)}
              disabled={isAuditioning}
              className="px-3 py-2 rounded-xl text-xs font-mono font-bold bg-amber-500 text-black hover:bg-amber-400 transition-all flex items-center gap-2 shadow-md shadow-amber-950/40 disabled:opacity-50"
            >
              {isAuditioning && auditioningPresetId === activePreset.id ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5 animate-spin text-black" />
                  <span>Auditioning...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Audition Active</span>
                </>
              )}
            </button>

            <button
              onClick={handleOpenCreateModal}
              className="px-3 py-2 rounded-xl text-xs font-mono font-bold bg-black/80 hover:bg-red-950/60 text-amber-300 border border-amber-500/40 hover:border-amber-400 transition-all flex items-center gap-2 shadow-md"
            >
              <Plus className="w-3.5 h-3.5 text-amber-400" />
              <span>Save Cloned Model as Preset</span>
            </button>
          </div>
        </div>
      </div>

      {/* Control Bar: Search, Filters & Quick Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-black/50 p-3 rounded-xl border border-red-900/30">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search presets (e.g. Iron-Adaptive, Menace, RP)..."
              className="w-full pl-8 pr-3 py-1.5 bg-black/80 rounded-lg text-xs font-mono text-zinc-200 border border-red-900/30 focus:border-amber-500/50 focus:outline-none placeholder-zinc-600"
            />
          </div>

          {/* Persona Filter Dropdown */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3 h-3 text-zinc-500" />
            <select
              value={selectedPersonaFilter}
              onChange={(e) => setSelectedPersonaFilter(e.target.value)}
              className="bg-black/80 border border-red-900/30 rounded-lg px-2 py-1.5 text-xs font-mono text-zinc-300 focus:outline-none focus:border-amber-500/50"
            >
              <option value="ALL">All Personas</option>
              <option value="alfred_pennyworth">Alfred Pennyworth</option>
              <option value="theatrical_menace">Theatrical Menace</option>
              <option value="tactical_command">13th MEU Command</option>
              <option value="subtle_steward">Subtle Steward</option>
              <option value="oxford_dignitary">Oxford Dignitary</option>
              <option value="custom_iron">Custom Configurations</option>
            </select>
          </div>

          {/* Favorites Filter Toggle */}
          <button
            onClick={() => setOnlyFavorites(!onlyFavorites)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 border transition-all ${
              onlyFavorites
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                : 'bg-black/60 text-zinc-400 border-red-900/30 hover:text-zinc-200'
            }`}
          >
            <Star className={`w-3 h-3 ${onlyFavorites ? 'fill-amber-400 text-amber-400' : ''}`} />
            <span>Favorites</span>
          </button>
        </div>

        <div className="text-[10px] font-mono text-zinc-500 self-end md:self-auto">
          Showing {filteredPresets.length} of {presets.length} configured tonal presets
        </div>
      </div>

      {/* Preset Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {filteredPresets.map((preset) => {
          const isActive = preset.id === activePreset.id;
          const personaMeta = getPersonaBadge(preset.targetPersona);

          return (
            <motion.div
              key={preset.id}
              layout
              className={`p-4 rounded-xl transition-all border relative flex flex-col justify-between ${
                isActive
                  ? 'bg-gradient-to-br from-amber-950/40 via-black/90 to-red-950/40 border-amber-500/60 shadow-lg shadow-amber-950/30 ring-1 ring-amber-500/30'
                  : 'bg-black/60 hover:bg-black/80 border-red-900/30 hover:border-red-800/50'
              }`}
            >
              <div className="space-y-3">
                {/* Card Header: Badges & Actions */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-base font-bold font-serif text-amber-300">
                        {preset.name}
                      </span>
                      <span className="px-1.5 py-0.5 rounded font-mono text-[10px] font-bold text-zinc-400 bg-black/60 border border-red-900/30">
                        [{preset.codeName}]
                      </span>
                      {preset.isBuiltin && (
                        <span className="px-1.5 py-0.5 rounded font-mono text-[9px] font-bold uppercase tracking-wider bg-red-950/80 text-red-300 border border-red-800/30">
                          Canonical
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-medium border ${personaMeta.color}`}>
                        {personaMeta.label}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-400">
                        • {Math.round(preset.tonalIntensity * 100)}% Intensity
                      </span>
                    </div>
                  </div>

                  {/* Favorite & Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleToggleFavorite(preset.id, e)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        preset.isFavorite
                          ? 'text-amber-400 hover:text-amber-300'
                          : 'text-zinc-600 hover:text-zinc-400'
                      }`}
                      title={preset.isFavorite ? 'Unfavorite' : 'Mark favorite'}
                    >
                      <Star className={`w-3.5 h-3.5 ${preset.isFavorite ? 'fill-current' : ''}`} />
                    </button>

                    <button
                      onClick={(e) => handleDuplicatePreset(preset.id, e)}
                      className="p-1.5 text-zinc-500 hover:text-zinc-300 rounded-lg hover:bg-black/60 transition-colors"
                      title="Duplicate preset"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    {!preset.isBuiltin && (
                      <>
                        <button
                          onClick={(e) => handleOpenEditModal(preset, e)}
                          className="p-1.5 text-zinc-500 hover:text-amber-400 rounded-lg hover:bg-black/60 transition-colors"
                          title="Edit preset metadata"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDeletePreset(preset, e)}
                          className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg hover:bg-black/60 transition-colors"
                          title="Delete custom preset"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Tagline & Description */}
                <div className="space-y-1">
                  <p className="text-xs font-mono font-medium text-zinc-200">
                    {preset.tagline}
                  </p>
                  <p className="text-[11px] font-mono text-zinc-400 leading-relaxed">
                    {preset.description}
                  </p>
                </div>

                {/* Formant DNA Matrix Mini-Stats */}
                <div className="grid grid-cols-4 gap-1.5 p-2 rounded-lg bg-black/40 border border-red-900/20 text-[9px] font-mono">
                  <div className="space-y-0.5">
                    <div className="text-zinc-500 uppercase">Chest (110Hz)</div>
                    <div className="font-bold text-amber-400">+{preset.dspConfig.chestResonanceDb} dB</div>
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-zinc-500 uppercase">Gravel</div>
                    <div className="font-bold text-amber-400">{Math.round(preset.dspConfig.gravelSaturation * 100)}%</div>
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-zinc-500 uppercase">Bite (2.6kHz)</div>
                    <div className="font-bold text-amber-400">+{preset.dspConfig.articulationBoostDb} dB</div>
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-zinc-500 uppercase">Cadence</div>
                    <div className="font-bold text-amber-400">{preset.dspConfig.speechRate}x</div>
                  </div>
                </div>

                {/* Tags */}
                {preset.tags && preset.tags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 pt-1">
                    {preset.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-1.5 py-0.5 rounded text-[8px] font-mono text-zinc-400 bg-black/60 border border-red-900/20"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Card Footer: Action Buttons */}
              <div className="pt-3 mt-3 border-t border-red-900/20 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleAuditionPreset(preset)}
                  disabled={isAuditioning}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-mono text-zinc-300 hover:text-white bg-black/60 hover:bg-black/90 border border-red-900/20 hover:border-amber-500/30 transition-all flex items-center gap-1.5 disabled:opacity-50"
                  title="Audition this configuration"
                >
                  {isAuditioning && auditioningPresetId === preset.id ? (
                    <>
                      <RotateCcw className="w-3 h-3 animate-spin text-amber-400" />
                      <span>Speaking...</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3 h-3 text-amber-400" />
                      <span>Audition</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleActivatePreset(preset)}
                  disabled={isActive}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
                    isActive
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 cursor-default'
                      : 'bg-gradient-to-r from-red-950 to-amber-950 hover:from-red-900 hover:to-amber-900 text-amber-200 border border-red-900/40 hover:border-amber-500/40 shadow-sm'
                  }`}
                >
                  {isActive ? (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[3] text-amber-400" />
                      <span>Engaged</span>
                    </>
                  ) : (
                    <>
                      <span>Engage Preset</span>
                      <ArrowRight className="w-3 h-3" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Bottom Audition Console */}
      <div className="p-4 rounded-xl bg-black/60 border border-red-900/30 space-y-3 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-amber-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
            <Volume2 className="w-4 h-4 text-amber-500" />
            <span>Preset Audition Lab</span>
          </div>
          <span className="text-[10px] font-mono text-zinc-400">
            Testing against active preset: <strong className="text-amber-300">[{activePreset.name}]</strong>
          </span>
        </div>

        <div className="space-y-2">
          <div className="relative">
            <textarea
              rows={2}
              value={customAuditionText}
              onChange={(e) => setCustomAuditionText(e.target.value)}
              className="w-full bg-black/90 p-2.5 text-xs font-mono text-zinc-200 border border-red-900/30 rounded-lg focus:border-amber-500/60 focus:outline-none leading-relaxed"
              placeholder="Enter phrase for tonal audition..."
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1 text-[9px] font-mono text-zinc-500">
              <span>Quick Test Prompts:</span>
              {[
                "1911s loaded and silver polished.",
                "Zero logical drift detected.",
                "A witty saying proves nothing.",
                "Tactical perimeter secure."
              ].map((phrase) => (
                <button
                  key={phrase}
                  onClick={() => setCustomAuditionText(phrase)}
                  className="px-1.5 py-0.5 rounded bg-black/60 border border-red-900/20 text-zinc-400 hover:text-amber-300 hover:border-amber-500/30 transition-colors"
                >
                  "{phrase}"
                </button>
              ))}
            </div>

            <button
              onClick={() => handleAuditionPreset(activePreset)}
              disabled={isAuditioning}
              className="px-4 py-1.5 rounded-lg text-xs font-mono font-bold bg-amber-500 text-black hover:bg-amber-400 transition-all flex items-center gap-1.5 shadow-md shadow-amber-950/40 disabled:opacity-50"
            >
              {isAuditioning ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                  <span>Synthesizing Audition...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Audition Phrase</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Save Cloned Model as Preset */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-zinc-950 border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-4 bg-gradient-to-r from-red-950/60 to-black border-b border-red-900/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bookmark className="w-4 h-4 text-amber-400" />
                  <h4 className="text-sm font-bold font-serif text-amber-300">
                    {editingPreset ? `Edit Preset: ${editingPreset.name}` : 'Save Cloned Model as Preset'}
                  </h4>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-zinc-500 hover:text-zinc-200 text-xs font-mono px-2 py-1 rounded"
                >
                  ✕
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleSaveModal} className="p-4 space-y-4 overflow-y-auto flex-1 font-mono text-xs">
                {/* Name & Codename */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-zinc-400 text-[10px] uppercase">
                      Preset Name (e.g. Iron-Adaptive-V1) *
                    </label>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => {
                        setFormName(e.target.value);
                        if (!editingPreset) {
                          setFormCodeName(e.target.value.toUpperCase().replace(/\s+/g, '-'));
                        }
                      }}
                      className="w-full p-2 bg-black rounded-lg border border-red-900/30 focus:border-amber-500/60 focus:outline-none text-zinc-200"
                      placeholder="Iron-Adaptive-V1"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-zinc-400 text-[10px] uppercase">
                      System Codename *
                    </label>
                    <input
                      type="text"
                      required
                      value={formCodeName}
                      onChange={(e) => setFormCodeName(e.target.value.toUpperCase())}
                      className="w-full p-2 bg-black rounded-lg border border-red-900/30 focus:border-amber-500/60 focus:outline-none text-zinc-200 uppercase"
                      placeholder="IRON-ADAPTIVE-V1"
                    />
                  </div>
                </div>

                {/* Persona & Tonal Intensity */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-zinc-400 text-[10px] uppercase">
                      Target Persona Archetype
                    </label>
                    <select
                      value={formPersona}
                      onChange={(e) => setFormPersona(e.target.value as PresetPersonaType)}
                      className="w-full p-2 bg-black rounded-lg border border-red-900/30 focus:border-amber-500/60 focus:outline-none text-zinc-200"
                    >
                      <option value="alfred_pennyworth">Alfred Pennyworth (Canonical)</option>
                      <option value="theatrical_menace">Theatrical Menace (Scar/Gruber)</option>
                      <option value="tactical_command">13th MEU Command Steel</option>
                      <option value="subtle_steward">Subtle Domestic Steward</option>
                      <option value="oxford_dignitary">Royal Oxford Dignitary</option>
                      <option value="custom_iron">Custom Iron Derivative</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-zinc-400">
                      <span className="uppercase">Tonal Gravitas Intensity</span>
                      <span className="text-amber-400 font-bold">{Math.round(formIntensity * 100)}% ({formIntensity.toFixed(2)}x)</span>
                    </div>
                    <input
                      type="range"
                      min="0.2"
                      max="2.0"
                      step="0.05"
                      value={formIntensity}
                      onChange={(e) => setFormIntensity(parseFloat(e.target.value))}
                      className="w-full h-2 bg-zinc-900 rounded-lg appearance-none cursor-pointer accent-amber-500 border border-red-900/30"
                    />
                  </div>
                </div>

                {/* Tagline */}
                <div className="space-y-1">
                  <label className="text-zinc-400 text-[10px] uppercase">
                    Tagline
                  </label>
                  <input
                    type="text"
                    value={formTagline}
                    onChange={(e) => setFormTagline(e.target.value)}
                    className="w-full p-2 bg-black rounded-lg border border-red-900/30 focus:border-amber-500/60 focus:outline-none text-zinc-200"
                    placeholder="Dynamic Alfred Pennyworth Baritone..."
                  />
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="text-zinc-400 text-[10px] uppercase">
                    Detailed Configuration Description
                  </label>
                  <textarea
                    rows={2}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full p-2 bg-black rounded-lg border border-red-900/30 focus:border-amber-500/60 focus:outline-none text-zinc-200 leading-relaxed"
                    placeholder="Describe the acoustic timbre, vocal rasp, and intended scenario..."
                  />
                </div>

                {/* Tags */}
                <div className="space-y-1">
                  <label className="text-zinc-400 text-[10px] uppercase">
                    Tags (comma separated)
                  </label>
                  <input
                    type="text"
                    value={formTags}
                    onChange={(e) => setFormTags(e.target.value)}
                    className="w-full p-2 bg-black rounded-lg border border-red-900/30 focus:border-amber-500/60 focus:outline-none text-zinc-200"
                    placeholder="Adaptive, Canonical, Gravitas, RP"
                  />
                </div>

                {/* Notes */}
                <div className="space-y-1">
                  <label className="text-zinc-400 text-[10px] uppercase">
                    Operational Notes
                  </label>
                  <input
                    type="text"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    className="w-full p-2 bg-black rounded-lg border border-red-900/30 focus:border-amber-500/60 focus:outline-none text-zinc-200"
                    placeholder="Context notes for deployment..."
                  />
                </div>

                {/* Activate immediately checkbox */}
                <div className="pt-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="activate-immediately"
                    checked={formActivateImmediately}
                    onChange={(e) => setFormActivateImmediately(e.target.checked)}
                    className="rounded border-red-900/40 text-amber-500 focus:ring-amber-500/40 bg-black"
                  />
                  <label htmlFor="activate-immediately" className="text-zinc-300 text-xs cursor-pointer select-none">
                    Engage as active voice substrate immediately upon save
                  </label>
                </div>

                {/* Modal Footer */}
                <div className="pt-3 border-t border-red-900/30 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-3 py-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 bg-black/60 border border-red-900/30"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg font-bold bg-amber-500 text-black hover:bg-amber-400 transition-all flex items-center gap-1.5 shadow-md shadow-amber-950/40"
                  >
                    <BookmarkCheck className="w-3.5 h-3.5" />
                    <span>Save Preset Configuration</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
