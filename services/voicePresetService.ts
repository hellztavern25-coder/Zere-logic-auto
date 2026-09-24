import { VoiceTonalPreset, PresetPersonaType, PersistentTonalModel, VoiceDSPConfig } from '../types';
import { jeremyIronsVoice } from './jeremyIronsVoiceService';
import { voiceCloningEngine, CANONICAL_IRONS_TONAL_MODEL } from './voiceCloningEngineService';

const PRESETS_STORAGE_KEY = 'zere0_voice_presets_v1';
const ACTIVE_PRESET_KEY = 'zere0_voice_active_preset_id_v1';

// Canonical Factory Presets inspired by Jeremy Irons
export const FACTORY_VOICE_PRESETS: VoiceTonalPreset[] = [
  {
    id: 'preset-iron-adaptive-v1',
    name: 'Iron-Adaptive-V1',
    codeName: 'IRON-ADAPTIVE-V1',
    tagline: 'Dynamic Alfred Pennyworth Baritone — Auto-Calibrated Inflection',
    description: 'Canonical Jeremy Irons British aristocratic baritone with dynamic acoustic formants, balanced gravel, and crisp Oxford plosive bite.',
    targetPersona: 'alfred_pennyworth',
    tonalIntensity: 1.0,
    sourceModelId: 'clone-jeremy-irons-canonical',
    sourceModelName: 'Jeremy Irons (Canonical Aristocrat)',
    dspConfig: {
      pitchMultiplier: 0.91,
      speechRate: 0.90,
      chestResonanceDb: 6.0,
      thoracicWarmthDb: 3.5,
      articulationBoostDb: 5.0,
      gravelSaturation: 0.85,
      antiBoxNotchDb: -3.0,
      roomAmbience: 0.18
    },
    systemPromptDirective: 'Say deliberately with an authentic, dry, gravelly British aristocratic baritone accent in the manner of Jeremy Irons (Alfred Pennyworth):',
    speechSynthesisConfig: {
      pitch: 0.88,
      rate: 0.90,
      preferredVoiceNames: ['Daniel', 'Oliver', 'George', 'Arthur', 'en-GB'],
      priorityLocales: ['en-GB', 'en_GB', 'en-UK']
    },
    tags: ['Adaptive', 'Canonical', 'Alfred', 'Gravitas', 'RP'],
    isBuiltin: true,
    isFavorite: true,
    createdAt: 1726000000000,
    updatedAt: 1726000000000,
    metadata: {
      author: 'Council Grey & ZereØ',
      version: '1.0-Adaptive',
      gravitasLevel: 'Canonical (1.0x)',
      elocutionNotes: ['Signature vocal fold gravel', 'Non-rhotic RP cadence', 'Deliberate phrase pauses'],
      recommendedContext: 'General tactical stewardship, strategic advisory, operational analysis.'
    }
  },
  {
    id: 'preset-iron-menace-v2',
    name: 'Iron-Menace-V2',
    codeName: 'IRON-MENACE-V2',
    tagline: 'Theatrical Menace & Razor Sarcasm — Maximum Lethal Gravitas',
    description: 'Deepened sub-harmonic chest resonance (+8.5dB shelf), aggressive vocal fold rasp (95%), and heavy deliberate cadence for uncompromising lethal authority.',
    targetPersona: 'theatrical_menace',
    tonalIntensity: 1.55,
    sourceModelId: 'clone-jeremy-irons-canonical',
    sourceModelName: 'Jeremy Irons (Canonical Aristocrat)',
    dspConfig: {
      pitchMultiplier: 0.86,
      speechRate: 0.85,
      chestResonanceDb: 8.5,
      thoracicWarmthDb: 4.5,
      articulationBoostDb: 6.8,
      gravelSaturation: 0.95,
      antiBoxNotchDb: -3.5,
      roomAmbience: 0.22
    },
    systemPromptDirective: 'Deliver with maximum lethal gravitas, profound theatrical menace, razor-sharp sarcastic iron inflection, and deep deliberate aristocratic pauses in the definitive manner of Jeremy Irons (Alfred Pennyworth):',
    speechSynthesisConfig: {
      pitch: 0.82,
      rate: 0.84,
      preferredVoiceNames: ['Daniel', 'George', 'Oliver', 'en-GB'],
      priorityLocales: ['en-GB', 'en_GB', 'en-UK']
    },
    tags: ['Menace', 'Sarcasm', 'Theatrical', 'Lethal-Weight', 'Heavy-Bass'],
    isBuiltin: true,
    isFavorite: true,
    createdAt: 1726000000001,
    updatedAt: 1726000000001,
    metadata: {
      author: 'Council Grey & ZereØ',
      version: '2.0-Menace',
      gravitasLevel: 'Lethal Gravitas (1.55x)',
      elocutionNotes: ['Extended ominous pauses', 'Deep guttural resonance', 'Razor-edged sarcasm on closing consonants'],
      recommendedContext: 'High-stakes confrontation, critical system warnings, absolute boundary enforcement.'
    }
  },
  {
    id: 'preset-iron-butler-calm',
    name: 'Iron-Butler-Calm',
    codeName: 'IRON-BUTLER-CALM',
    tagline: 'Subtle Domestic Steward — Quiet Dignity & Restraint',
    description: 'Tempered aristocratic delivery with smooth thoracic warmth, muted rasp, and gentle unhurried cadence. Ideal for low-friction daily briefing.',
    targetPersona: 'subtle_steward',
    tonalIntensity: 0.70,
    sourceModelId: 'clone-jeremy-irons-canonical',
    sourceModelName: 'Jeremy Irons (Canonical Aristocrat)',
    dspConfig: {
      pitchMultiplier: 0.93,
      speechRate: 0.92,
      chestResonanceDb: 4.5,
      thoracicWarmthDb: 3.2,
      articulationBoostDb: 4.2,
      gravelSaturation: 0.65,
      antiBoxNotchDb: -2.5,
      roomAmbience: 0.15
    },
    systemPromptDirective: 'Say with a tempered, dry British aristocratic baritone cadence, measured conversational calm and understated gravitas in the manner of Jeremy Irons (Alfred Pennyworth):',
    speechSynthesisConfig: {
      pitch: 0.90,
      rate: 0.92,
      preferredVoiceNames: ['Oliver', 'Daniel', 'en-GB'],
      priorityLocales: ['en-GB', 'en_GB', 'en-UK']
    },
    tags: ['Subtle', 'Domestic', 'Steward', 'Calm', 'Conversational'],
    isBuiltin: true,
    isFavorite: false,
    createdAt: 1726000000002,
    updatedAt: 1726000000002,
    metadata: {
      author: 'Council Grey & ZereØ',
      version: '1.2-Domestic',
      gravitasLevel: 'Tempered Calm (0.70x)',
      elocutionNotes: ['Softened rasp', 'Relaxed conversational tempo', 'Refined dry humor'],
      recommendedContext: 'Morning status briefings, casual query resolution, continuous ambient monitoring.'
    }
  },
  {
    id: 'preset-iron-tactical-command',
    name: 'Iron-Tactical-Command',
    codeName: 'IRON-TACTICAL-CMD',
    tagline: '13th MEU Steel — Razor Articulation & Rapid Decisiveness',
    description: 'Snapping consonant articulation (+7.2dB bite), compressed pause durations, and hard-edged delivery forged for high-clock-speed operational execution.',
    targetPersona: 'tactical_command',
    tonalIntensity: 1.30,
    sourceModelId: 'clone-jeremy-irons-canonical',
    sourceModelName: 'Jeremy Irons (Canonical Aristocrat)',
    dspConfig: {
      pitchMultiplier: 0.89,
      speechRate: 0.96,
      chestResonanceDb: 7.0,
      thoracicWarmthDb: 3.8,
      articulationBoostDb: 7.2,
      gravelSaturation: 0.88,
      antiBoxNotchDb: -3.0,
      roomAmbience: 0.14
    },
    systemPromptDirective: 'Deliver with tactical military precision, crisp razor-sharp Oxford consonant bite, unyielding authority, and decisive baritone cadence in the manner of Jeremy Irons (Alfred Pennyworth):',
    speechSynthesisConfig: {
      pitch: 0.86,
      rate: 0.95,
      preferredVoiceNames: ['Daniel', 'George', 'en-GB'],
      priorityLocales: ['en-GB', 'en_GB', 'en-UK']
    },
    tags: ['Tactical', '13th-MEU', 'Command', 'Crisp', 'Decisive'],
    isBuiltin: true,
    isFavorite: true,
    createdAt: 1726000000003,
    updatedAt: 1726000000003,
    metadata: {
      author: 'Council Grey & ZereØ',
      version: '1.4-Tactical',
      gravitasLevel: 'Command Steel (1.30x)',
      elocutionNotes: ['Rapid dental plosives', 'Zero hesitation', 'Hard acoustic transients'],
      recommendedContext: 'Incident response, code refactoring sprints, system defense operations.'
    }
  },
  {
    id: 'preset-iron-oxford-dignitary',
    name: 'Iron-Oxford-Dignitary',
    codeName: 'IRON-OXFORD-RP',
    tagline: 'Aristocratic Dignitary — High Received Pronunciation & Open Vowels',
    description: 'Lengthened open vowels, classic Shakespearian theater resonance, non-rhotic RP elocution, and spacious acoustic staging.',
    targetPersona: 'oxford_dignitary',
    tonalIntensity: 1.15,
    sourceModelId: 'clone-jeremy-irons-canonical',
    sourceModelName: 'Jeremy Irons (Canonical Aristocrat)',
    dspConfig: {
      pitchMultiplier: 0.90,
      speechRate: 0.88,
      chestResonanceDb: 6.5,
      thoracicWarmthDb: 4.2,
      articulationBoostDb: 5.5,
      gravelSaturation: 0.82,
      antiBoxNotchDb: -3.0,
      roomAmbience: 0.25
    },
    systemPromptDirective: 'Deliver with classical Oxford Shakespearian elocution, lengthened open vowels, dry aristocratic irony, and rich resonant theatrical dignity in the manner of Jeremy Irons:',
    speechSynthesisConfig: {
      pitch: 0.88,
      rate: 0.88,
      preferredVoiceNames: ['Oliver', 'Arthur', 'Daniel', 'en-GB'],
      priorityLocales: ['en-GB', 'en_GB', 'en-UK']
    },
    tags: ['Oxford', 'RP', 'Dignitary', 'Classical', 'Theater'],
    isBuiltin: true,
    isFavorite: false,
    createdAt: 1726000000004,
    updatedAt: 1726000000004,
    metadata: {
      author: 'Council Grey & ZereØ',
      version: '1.1-Oxford',
      gravitasLevel: 'Theatrical RP (1.15x)',
      elocutionNotes: ['Vowel prolongation', 'Subtle pitch melodic contouring', 'Spacious theatrical decay'],
      recommendedContext: 'Philosophical synthesis, formal presentations, deep intellectual debriefings.'
    }
  }
];

class VoicePresetManagerService {
  private presets: VoiceTonalPreset[] = [];
  private activePresetId: string = 'preset-iron-adaptive-v1';
  private listeners: Set<(presets: VoiceTonalPreset[], active: VoiceTonalPreset) => void> = new Set();
  private isInitialized = false;

  constructor() {
    this.loadInitialPresets();
  }

  private loadInitialPresets() {
    try {
      const stored = localStorage.getItem(PRESETS_STORAGE_KEY);
      const activeId = localStorage.getItem(ACTIVE_PRESET_KEY);

      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Merge factory presets with custom presets
          const customPresets = parsed.filter((p: VoiceTonalPreset) => !p.isBuiltin);
          this.presets = [...FACTORY_VOICE_PRESETS, ...customPresets];
        } else {
          this.presets = [...FACTORY_VOICE_PRESETS];
        }
      } else {
        this.presets = [...FACTORY_VOICE_PRESETS];
      }

      if (activeId && this.presets.some(p => p.id === activeId)) {
        this.activePresetId = activeId;
      } else {
        this.activePresetId = this.presets[0].id;
      }
    } catch (err) {
      console.warn('Failed to load voice presets from localStorage:', err);
      this.presets = [...FACTORY_VOICE_PRESETS];
      this.activePresetId = this.presets[0].id;
    }

    this.isInitialized = true;
    // Async background sync with server
    this.syncWithServer();
  }

  private async syncWithServer() {
    try {
      const res = await fetch('/api/voice/presets');
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.presets)) {
          const customServerPresets = data.presets.filter((p: VoiceTonalPreset) => !p.isBuiltin);
          
          // Merge unique custom presets
          const localCustom = this.presets.filter(p => !p.isBuiltin);
          const map = new Map<string, VoiceTonalPreset>();
          localCustom.forEach(p => map.set(p.id, p));
          customServerPresets.forEach((p: VoiceTonalPreset) => map.set(p.id, p));
          
          this.presets = [...FACTORY_VOICE_PRESETS, ...Array.from(map.values())];
          if (data.activePresetId && this.presets.some(p => p.id === data.activePresetId)) {
            this.activePresetId = data.activePresetId;
          }
          this.saveToStorage();
          this.notify();
        }
      }
    } catch (_) {
      // Offline fallback
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(this.presets));
      localStorage.setItem(ACTIVE_PRESET_KEY, this.activePresetId);
    } catch (err) {
      console.warn('Failed to save presets to localStorage:', err);
    }
  }

  private notify() {
    const active = this.getActivePreset();
    this.listeners.forEach(fn => fn([...this.presets], active));
  }

  public subscribe(listener: (presets: VoiceTonalPreset[], active: VoiceTonalPreset) => void): () => void {
    this.listeners.add(listener);
    listener([...this.presets], this.getActivePreset());
    return () => this.listeners.delete(listener);
  }

  public getPresets(): VoiceTonalPreset[] {
    return [...this.presets];
  }

  public getActivePreset(): VoiceTonalPreset {
    const found = this.presets.find(p => p.id === this.activePresetId);
    return found || this.presets[0] || FACTORY_VOICE_PRESETS[0];
  }

  /**
   * Seamlessly activates a preset across the entire audio stack:
   * - Updates activePresetId
   * - Updates jeremyIronsVoice DSP & profile prompt
   * - Updates voiceCloningEngine active model / intensity
   * - Persists active state to server
   */
  public async setActivePreset(presetId: string): Promise<boolean> {
    const target = this.presets.find(p => p.id === presetId);
    if (!target) return false;

    this.activePresetId = presetId;
    this.saveToStorage();

    // 1. Update JeremyIronsVoice Profile DSP
    const currentProfile = jeremyIronsVoice.getActiveProfile();
    const updatedProfile = {
      ...currentProfile,
      dspConfig: { ...target.dspConfig },
      speechSynthesisConfig: {
        ...currentProfile.speechSynthesisConfig,
        pitch: target.speechSynthesisConfig.pitch,
        rate: target.speechSynthesisConfig.rate,
        preferredVoiceNames: target.speechSynthesisConfig.preferredVoiceNames
      },
      systemPromptStyle: target.systemPromptDirective
    };
    jeremyIronsVoice.saveProfile(updatedProfile);

    // 2. Synchronize with VoiceCloningEngine if underlying model matches
    if (target.sourceModelId) {
      voiceCloningEngine.setActiveModel(target.sourceModelId);
      voiceCloningEngine.updateModelIntensity(target.sourceModelId, target.tonalIntensity);
    }

    // 3. Notify subscribers
    this.notify();

    // 4. Fire-and-forget sync to server
    fetch('/api/voice/presets/active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presetId })
    }).catch(() => {});

    return true;
  }

  /**
   * Save or update a preset
   */
  public async savePreset(presetData: Partial<VoiceTonalPreset>): Promise<VoiceTonalPreset> {
    const isNew = !presetData.id || presetData.id.startsWith('new-');
    const id = isNew 
      ? `preset-custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
      : presetData.id!;

    const existing = this.presets.find(p => p.id === id);

    const name = (presetData.name || 'Iron-Adaptive-Custom').trim();
    const codeName = (presetData.codeName || name.toUpperCase().replace(/\s+/g, '-')).trim();

    const fullPreset: VoiceTonalPreset = {
      id,
      name,
      codeName,
      tagline: presetData.tagline || 'Custom Jeremy Irons Tonal Configuration',
      description: presetData.description || 'Configured cloned model preset with custom acoustic formants.',
      targetPersona: presetData.targetPersona || 'custom_iron',
      tonalIntensity: presetData.tonalIntensity ?? 1.0,
      sourceModelId: presetData.sourceModelId || 'clone-jeremy-irons-canonical',
      sourceModelName: presetData.sourceModelName || 'Jeremy Irons (Cloned Substrate)',
      dspConfig: presetData.dspConfig || {
        pitchMultiplier: 0.91,
        speechRate: 0.90,
        chestResonanceDb: 6.0,
        thoracicWarmthDb: 3.5,
        articulationBoostDb: 5.0,
        gravelSaturation: 0.85,
        antiBoxNotchDb: -3.0,
        roomAmbience: 0.18
      },
      systemPromptDirective: presetData.systemPromptDirective || 'Say deliberately with an authentic, dry, gravelly British aristocratic baritone accent in the manner of Jeremy Irons (Alfred Pennyworth):',
      speechSynthesisConfig: presetData.speechSynthesisConfig || {
        pitch: 0.88,
        rate: 0.90,
        preferredVoiceNames: ['Daniel', 'Oliver', 'George', 'en-GB'],
        priorityLocales: ['en-GB', 'en_GB', 'en-UK']
      },
      tags: presetData.tags && presetData.tags.length > 0 ? presetData.tags : ['Custom', 'Adaptive', 'Irons'],
      isBuiltin: false,
      isFavorite: existing ? existing.isFavorite : false,
      createdAt: existing ? existing.createdAt : Date.now(),
      updatedAt: Date.now(),
      metadata: {
        author: 'Principal (Architect)',
        version: presetData.metadata?.version || '1.0',
        gravitasLevel: `${Math.round((presetData.tonalIntensity ?? 1.0) * 100)}% Intensity`,
        elocutionNotes: presetData.metadata?.elocutionNotes || ['Custom configured preset'],
        recommendedContext: presetData.metadata?.recommendedContext || 'General operations',
        customNotes: presetData.metadata?.customNotes || ''
      }
    };

    const idx = this.presets.findIndex(p => p.id === id);
    if (idx >= 0) {
      this.presets[idx] = fullPreset;
    } else {
      this.presets.push(fullPreset);
    }

    this.saveToStorage();
    this.notify();

    // Persist to server
    fetch('/api/voice/presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fullPreset)
    }).catch(() => {});

    return fullPreset;
  }

  /**
   * Helper to create a new Preset directly from an existing PersistentTonalModel
   */
  public async createPresetFromModel(
    model: PersistentTonalModel,
    meta: {
      name: string;
      codeName?: string;
      tagline?: string;
      description?: string;
      targetPersona?: PresetPersonaType;
      tonalIntensity?: number;
      tags?: string[];
      notes?: string;
    }
  ): Promise<VoiceTonalPreset> {
    const intensity = meta.tonalIntensity ?? model.tonalIntensity ?? 1.0;
    const modulatedDsp = voiceCloningEngine.calculateIntensityModulatedDSP(model.dspConfig, intensity);
    const modulatedPrompt = voiceCloningEngine.getIntensityModulatedPrompt(model.systemPromptStyle, intensity);

    const presetData: Partial<VoiceTonalPreset> = {
      name: meta.name.trim(),
      codeName: meta.codeName?.trim() || meta.name.toUpperCase().replace(/\s+/g, '-'),
      tagline: meta.tagline || `Configured preset derived from ${model.name}`,
      description: meta.description || model.description || 'Configured Jeremy Irons tonal model with custom gravitas.',
      targetPersona: meta.targetPersona || 'alfred_pennyworth',
      tonalIntensity: intensity,
      sourceModelId: model.id,
      sourceModelName: model.name,
      dspConfig: modulatedDsp,
      systemPromptDirective: modulatedPrompt,
      speechSynthesisConfig: { ...model.speechSynthesisConfig },
      tags: meta.tags || ['Cloned', 'Iron-Adaptive', 'Custom'],
      metadata: {
        author: 'Principal (Architect)',
        version: '1.0-Adaptive',
        gravitasLevel: `${Math.round(intensity * 100)}% Intensity`,
        customNotes: meta.notes || ''
      }
    };

    return this.savePreset(presetData);
  }

  /**
   * Delete a custom preset (built-ins are protected)
   */
  public async deletePreset(presetId: string): Promise<boolean> {
    const target = this.presets.find(p => p.id === presetId);
    if (!target) return false;
    if (target.isBuiltin) {
      throw new Error('Canonical built-in presets cannot be deleted.');
    }

    this.presets = this.presets.filter(p => p.id !== presetId);
    if (this.activePresetId === presetId) {
      this.activePresetId = this.presets[0]?.id || FACTORY_VOICE_PRESETS[0].id;
      this.setActivePreset(this.activePresetId);
    } else {
      this.saveToStorage();
      this.notify();
    }

    fetch(`/api/voice/presets/${presetId}`, { method: 'DELETE' }).catch(() => {});
    return true;
  }

  /**
   * Duplicate an existing preset to create an editable custom variant
   */
  public async duplicatePreset(presetId: string): Promise<VoiceTonalPreset | null> {
    const source = this.presets.find(p => p.id === presetId);
    if (!source) return null;

    const copyName = `${source.name}-Copy`;
    const copyCode = `${source.codeName}-COPY`;

    const duplicate: Partial<VoiceTonalPreset> = {
      ...source,
      id: undefined,
      name: copyName,
      codeName: copyCode,
      tagline: `Variation of ${source.name}`,
      isBuiltin: false,
      isFavorite: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    return this.savePreset(duplicate);
  }

  /**
   * Toggle favorite state for quick-filter access
   */
  public toggleFavorite(presetId: string): boolean {
    const p = this.presets.find(p => p.id === presetId);
    if (!p) return false;
    p.isFavorite = !p.isFavorite;
    this.saveToStorage();
    this.notify();
    return p.isFavorite;
  }

  /**
   * Quick audition of a preset with speech synthesis
   */
  public async auditionPreset(
    preset: VoiceTonalPreset,
    samplePhrase?: string
  ): Promise<void> {
    const text = samplePhrase || `Preset ${preset.name} active. Systems nominal with zero logical drift, Principal.`;

    try {
      // First try server synthesis
      const res = await fetch('/api/voice/clone/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          modelId: preset.sourceModelId,
          customPromptStyle: preset.systemPromptDirective,
          tonalIntensity: preset.tonalIntensity
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.audioData) {
          await jeremyIronsVoice.speak(text, {
            pitchRate: preset.dspConfig.pitchMultiplier,
            gravelAmount: preset.dspConfig.gravelSaturation,
            chestResonanceDb: preset.dspConfig.chestResonanceDb,
            articulationDb: preset.dspConfig.articulationBoostDb,
            speechRate: preset.dspConfig.speechRate
          });
          return;
        }
      }
    } catch (_) {}

    // Fallback to client synthesis with preset's exact DSP chain
    await jeremyIronsVoice.speak(text, {
      pitchRate: preset.dspConfig.pitchMultiplier,
      gravelAmount: preset.dspConfig.gravelSaturation,
      chestResonanceDb: preset.dspConfig.chestResonanceDb,
      articulationDb: preset.dspConfig.articulationBoostDb,
      speechRate: preset.dspConfig.speechRate
    });
  }
}

export const voicePresetManager = new VoicePresetManagerService();
