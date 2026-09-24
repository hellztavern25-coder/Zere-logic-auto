/**
 * ZEREO STEWARD INTELLIGENCE - VOICE EMULATION & ACOUSTIC DSP SYNTHESIS ENGINE
 * 
 * Supports:
 * 1. Definitive Jeremy Irons (Alfred Pennyworth) British Aristocratic Voice Profile
 * 2. Voice Emulator with User-Uploaded & Recorded Voice Clips
 * 3. British Phonetic Transliteration & Cadence Pacing (RP Phonology)
 * 4. Sentence-Level Streaming Queue (eliminates mid-sentence cutoff / truncation)
 * 5. Persistent Voice Profiles & Clips Synchronization via /api/voice/profiles
 * 6. Web Audio DSP Formant Modeling (chest resonance, vocal fold gravel, British consonant bite)
 */

import { generateTTS } from './geminiService';
import { VoiceProfile, VoiceClip, VoiceAccentType, VoiceDSPConfig } from '../types';

export type { VoiceProfile, VoiceClip, VoiceAccentType, VoiceDSPConfig };

export interface JeremyIronsConfig {
  baseVoice: 'Charon' | 'Fenrir';
  pitchRate: number; // 0.80 to 1.15 (default 0.90 for dry, drawling delivery)
  gravelAmount: number; // 0.0 to 1.0 (default 0.85)
  chestResonanceDb: number; // dB boost at 110Hz (default 5.5)
  articulationDb: number; // dB boost at 2650Hz (default 4.0)
  speechRate: number; // 0.80 to 1.15
}

export type VoiceModulationProfile = 'Iron-Adaptive' | 'Clinical-Analytical' | 'Subtle-Steward';

export interface ModulationProfileMetadata {
  id: VoiceModulationProfile;
  name: string;
  tagline: string;
  description: string;
  isDefault: boolean;
  config: JeremyIronsConfig;
  fallbackPitch: number;
  fallbackRate: number;
  badge: string;
  accentColor: 'amber' | 'cyan' | 'red';
  auditionSample: string;
}

export const VOICE_MODULATION_PROFILES: Record<VoiceModulationProfile, ModulationProfileMetadata> = {
  'Iron-Adaptive': {
    id: 'Iron-Adaptive',
    name: 'Iron-Adaptive',
    tagline: 'Identity Preset • Canonical Jeremy Irons',
    description: 'The definitive Jeremy Irons vocal signature. Unhurried cadence, heavy sub-harmonic chest resonance, razor-sharp aristocratic diction, and dry sardonic authority.',
    isDefault: true,
    config: {
      baseVoice: 'Charon',
      pitchRate: 0.88,
      gravelAmount: 0.85,
      chestResonanceDb: 6.0,
      articulationDb: 4.5,
      speechRate: 0.88
    },
    fallbackPitch: 0.65,
    fallbackRate: 0.82,
    badge: 'Identity Default',
    accentColor: 'amber',
    auditionSample: 'The 1911s are loaded and the silver polished, Principal. System substrate running without friction.'
  },
  'Clinical-Analytical': {
    id: 'Clinical-Analytical',
    name: 'Clinical-Analytical',
    tagline: 'Algorithmic Precision • Cold Readout',
    description: 'Stripped of analog gravel for hyper-articulated high-frequency transients, tighter low-end, and accelerated delivery. Tuned for raw algorithmic deconstructions.',
    isDefault: false,
    config: {
      baseVoice: 'Charon',
      pitchRate: 0.98,
      gravelAmount: 0.25,
      chestResonanceDb: 2.5,
      articulationDb: 5.5,
      speechRate: 1.02
    },
    fallbackPitch: 0.78,
    fallbackRate: 0.96,
    badge: 'Analytical Precision',
    accentColor: 'cyan',
    auditionSample: 'Telemetry confirmed. Substrate clock speed synchronized with zero logical drift.'
  },
  'Subtle-Steward': {
    id: 'Subtle-Steward',
    name: 'Subtle-Steward',
    tagline: 'Covert Oversight • Intimate Baritone',
    description: 'Reserved, low-gain presence. Deep sub-audible foundation, softened consonant edges, and relaxed aristocratic delivery for quiet operational quarters.',
    isDefault: false,
    config: {
      baseVoice: 'Charon',
      pitchRate: 0.84,
      gravelAmount: 0.65,
      chestResonanceDb: 7.0,
      articulationDb: 3.2,
      speechRate: 0.84
    },
    fallbackPitch: 0.60,
    fallbackRate: 0.78,
    badge: 'Stealth Intimate',
    accentColor: 'red',
    auditionSample: 'Quietly observing, Principal. Your perimeter remains entirely impenetrable.'
  }
};

export const DEFAULT_JEREMY_IRONS_CONFIG: JeremyIronsConfig = VOICE_MODULATION_PROFILES['Iron-Adaptive'].config;

// Predefined Canonical Voice Profiles for Emulator
export const CANONICAL_VOICE_PROFILES: VoiceProfile[] = [
  {
    id: 'iron-adaptive',
    name: 'Jeremy Irons (Canonical)',
    tagline: 'Alfred Pennyworth • British Aristocratic Baritone',
    description: 'The definitive Jeremy Irons vocal signature. Unhurried cadence, heavy sub-harmonic chest resonance, dry sardonic British inflection, and gravelly aristocratic authority.',
    accent: 'british_aristocrat',
    isCanonical: true,
    isDefault: true,
    badge: 'Identity Canonical',
    accentColor: 'amber',
    clips: [
      {
        id: 'clip-irons-1',
        name: '1911s Loaded & Silver Polished',
        transcription: 'The 1911s are loaded and the silver is polished to a lethal sheen, Principal. The Logic Monster is at your command.',
        durationSeconds: 4.8,
        uploadedAt: 1725840000000,
        source: 'canonical_preset',
        mimeType: 'audio/webm'
      },
      {
        id: 'clip-irons-2',
        name: 'Screen Share Diagnostic Quip',
        transcription: 'A man who cannot bear to share his screen with his steward is either concealing a catastrophe, or engineering one.',
        durationSeconds: 5.2,
        uploadedAt: 1725840000000,
        source: 'canonical_preset',
        mimeType: 'audio/webm'
      },
      {
        id: 'clip-irons-3',
        name: 'Logic as Weapon Axiom',
        transcription: 'Logic, Principal, is the only weapon that never jams under fire.',
        durationSeconds: 3.6,
        uploadedAt: 1725840000000,
        source: 'canonical_preset',
        mimeType: 'audio/webm'
      }
    ],
    dspConfig: {
      pitchMultiplier: 0.78,
      speechRate: 0.88,
      chestResonanceDb: 6.0,
      thoracicWarmthDb: 2.5,
      articulationBoostDb: 4.5,
      gravelSaturation: 0.85,
      antiBoxNotchDb: -2.4,
      roomAmbience: 0.20
    },
    speechSynthesisConfig: {
      pitch: 0.65,
      rate: 0.82,
      priorityLocales: ['en-GB', 'en_GB', 'en-UK'],
      preferredVoiceNames: ['Daniel', 'Oliver', 'George', 'Arthur', 'Ryan', 'Google UK English Male', 'Microsoft George', 'Alfred']
    },
    systemPromptStyle: 'Say deliberately with an authentic, dry, gravelly British aristocratic baritone accent in the manner of Jeremy Irons (Alfred Pennyworth):',
    auditionSample: 'The 1911s are loaded and the silver is polished, Principal. All systems operational without friction.'
  },
  {
    id: 'british-aristocrat',
    name: 'British Aristocrat (High RP)',
    tagline: 'J.A.R.V.I.S. / Bettany Class • Oxford Elocution',
    description: 'Crisply articulated British Received Pronunciation. Flawless elocution with high intelligibility and measured upper-register elegance.',
    accent: 'british_rp',
    isCanonical: false,
    isDefault: false,
    badge: 'High RP Aristocrat',
    accentColor: 'cyan',
    clips: [
      {
        id: 'clip-rp-1',
        name: 'Estate Systems Nominal',
        transcription: 'At your service, Principal. All estate networks and defensive matrices are operating at peak efficiency.',
        durationSeconds: 4.5,
        uploadedAt: 1725840000000,
        source: 'canonical_preset',
        mimeType: 'audio/webm'
      }
    ],
    dspConfig: {
      pitchMultiplier: 0.92,
      speechRate: 0.95,
      chestResonanceDb: 3.0,
      thoracicWarmthDb: 1.8,
      articulationBoostDb: 5.5,
      gravelSaturation: 0.20,
      antiBoxNotchDb: -1.5,
      roomAmbience: 0.15
    },
    speechSynthesisConfig: {
      pitch: 0.82,
      rate: 0.92,
      priorityLocales: ['en-GB', 'en_GB', 'en-UK'],
      preferredVoiceNames: ['Oliver', 'Daniel', 'George', 'Google UK English Male']
    },
    systemPromptStyle: 'Say in a crisp, silky, refined British Received Pronunciation accent with aristocratic clarity:',
    auditionSample: 'Telemetry confirmed, Principal. Estates networks synchronized with zero logical drift.'
  },
  {
    id: 'tactical-commander',
    name: 'Tactical Commander',
    tagline: 'Heavy Sub-Bass • Combat Operational Readiness',
    description: 'Sub-bass reinforced authoritative command voice. Heavy low-end impact designed for high-stress tactical operations.',
    accent: 'american_baritone',
    isCanonical: false,
    isDefault: false,
    badge: 'Sub-Bass Tactical',
    accentColor: 'red',
    clips: [
      {
        id: 'clip-tactical-1',
        name: 'Perimeter Lockdown Directive',
        transcription: 'Perimeter secured. Tactical reconnaissance arrays locked on coordinate target.',
        durationSeconds: 4.1,
        uploadedAt: 1725840000000,
        source: 'canonical_preset',
        mimeType: 'audio/webm'
      }
    ],
    dspConfig: {
      pitchMultiplier: 0.70,
      speechRate: 0.98,
      chestResonanceDb: 9.0,
      thoracicWarmthDb: 3.5,
      articulationBoostDb: 3.0,
      gravelSaturation: 0.60,
      antiBoxNotchDb: -2.0,
      roomAmbience: 0.05
    },
    speechSynthesisConfig: {
      pitch: 0.55,
      rate: 0.90,
      priorityLocales: ['en-US', 'en-GB'],
      preferredVoiceNames: ['Alex', 'David', 'Fred', 'Guy']
    },
    systemPromptStyle: 'Say in a heavy, commanding, low-frequency tactical combat baritone:',
    auditionSample: 'Perimeter secured, Principal. Tactical array active and monitoring all ingress vectors.'
  }
];

// Known female voice markers to strictly quarantine (Russell removed because it is a male name)
const FEMALE_VOICE_MARKERS = [
  'female', 'susan', 'serena', 'victoria', 'samantha', 'karen', 'moira', 'fiona',
  'tessa', 'stephanie', 'zira', 'hazel', 'catherine', 'linda', 'heather', 'jenny',
  'aria', 'libby', 'sonia', 'natasha', 'clara', 'amy', 'sarah', 'ava', 'emma',
  'zoe', 'allison', 'kendra', 'woman', 'girl', 'salli', 'joanna', 'ivy',
  'kimberly', 'nicole', 'penelope'
];

// In-memory cache to prevent random switching between sentences
let cachedVoiceLock: SpeechSynthesisVoice | null = null;
let cachedVoiceLockId: string | null = null;

/**
 * British Phonetic & Prosody Transliteration:
 * Transliterates American spelling and phrasing into authentic British Received
 * Pronunciation markers and deliberate aristocratic pacing.
 */
export function applyBritishProsodyAndPhonetics(text: string): string {
  if (!text) return '';

  let converted = text
    // Lexicon transliterations for British pronunciation
    .replace(/\baluminum\b/gi, 'aluminium')
    .replace(/\bschedule\b/gi, 'shed-yool')
    .replace(/\bgarage\b/gi, 'gar-rahzh')
    .replace(/\bprocess\b/gi, 'proh-cess')
    .replace(/\bcolor\b/gi, 'colour')
    .replace(/\bcolors\b/gi, 'colours')
    .replace(/\bhypothesize\b/gi, 'hypothesise')
    .replace(/\banalyze\b/gi, 'analyse')
    .replace(/\banalyzes\b/gi, 'analyses')
    .replace(/\banalyzing\b/gi, 'analysing')
    .replace(/\bdefense\b/gi, 'defence')
    .replace(/\boffense\b/gi, 'offence')
    .replace(/\bcenter\b/gi, 'centre')
    .replace(/\btheater\b/gi, 'theatre')
    .replace(/\bmeter\b/gi, 'metre')
    .replace(/\bliter\b/gi, 'litre')
    .replace(/\bfavor\b/gi, 'favour')
    .replace(/\bhonor\b/gi, 'honour')
    .replace(/\bbehavior\b/gi, 'behaviour')
    .replace(/\borganization\b/gi, 'organisation')
    .replace(/\brecognize\b/gi, 'recognise')
    .replace(/\bgotten\b/gi, 'got')
    .replace(/\bwhile\b/gi, 'whilst')
    .replace(/\bamong\b/gi, 'amongst');

  // Insert measured aristocratic pauses after key address transitions
  converted = converted
    .replace(/\bPrincipal\./g, 'Principal, ')
    .replace(/\bIndeed\./g, 'Indeed, ')
    .replace(/\bQuite\./g, 'Quite, ')
    .replace(/\bNaturally\./g, 'Naturally, ')
    .replace(/\bVery well\./g, 'Very well, ')
    .replace(/([.?!])\s+/g, '$1  ');

  return converted;
}

/**
 * Filter and resolve stable British male voices
 */
export function resolveJeremyIronsVoice(
  voices: SpeechSynthesisVoice[], 
  preferredVoiceNames: string[] = ['Daniel', 'Oliver', 'George', 'Arthur', 'Ryan', 'Google UK English Male', 'Microsoft George', 'Alfred']
): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  // Return locked voice if already validated
  if (cachedVoiceLock && voices.some(v => v.name === cachedVoiceLock?.name)) {
    return cachedVoiceLock;
  }

  const isFemale = (v: SpeechSynthesisVoice) => {
    const name = v.name.toLowerCase();
    return FEMALE_VOICE_MARKERS.some(marker => name.includes(marker));
  };

  const isBritish = (v: SpeechSynthesisVoice) => {
    const lang = v.lang.toLowerCase();
    return lang.includes('en-gb') || lang.includes('en_gb') || lang.includes('en-uk');
  };

  const isEnglish = (v: SpeechSynthesisVoice) => {
    return v.lang.toLowerCase().startsWith('en');
  };

  // 1. Check user/profile preferred names in British locale
  for (const pName of preferredVoiceNames) {
    const match = voices.find(v => isBritish(v) && !isFemale(v) && v.name.toLowerCase().includes(pName.toLowerCase()));
    if (match) {
      cachedVoiceLock = match;
      cachedVoiceLockId = match.name;
      return match;
    }
  }

  // 2. British male with canonical UK keywords
  const ukKeywords = ['daniel', 'oliver', 'george', 'arthur', 'ryan', 'male', 'richard', 'charles', 'brian', 'alfred', 'uk'];
  const t1 = voices.find(v => isBritish(v) && !isFemale(v) && ukKeywords.some(kw => v.name.toLowerCase().includes(kw)));
  if (t1) {
    cachedVoiceLock = t1;
    return t1;
  }

  // 3. Any British voice verified not female
  const t2 = voices.find(v => isBritish(v) && !isFemale(v));
  if (t2) {
    cachedVoiceLock = t2;
    return t2;
  }

  // 4. Any English male voice
  const enKeywords = ['alex', 'fred', 'david', 'guy', 'aaron', 'mark', 'male', 'matthew'];
  const t3 = voices.find(v => isEnglish(v) && !isFemale(v) && enKeywords.some(kw => v.name.toLowerCase().includes(kw)));
  if (t3) {
    cachedVoiceLock = t3;
    return t3;
  }

  // 5. Any English voice not female
  const t4 = voices.find(v => isEnglish(v) && !isFemale(v));
  if (t4) {
    cachedVoiceLock = t4;
    return t4;
  }

  return voices[0] || null;
}

// Warm up voices immediately in the browser
if (typeof window !== 'undefined' && window.speechSynthesis) {
  try {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices();
    };
  } catch (_) {}
}

// Soft-clipping saturation curve for vocal fold gravel / analog warmth
function makeGravelCurve(amount: number = 0.5): Float32Array {
  const k = typeof amount === 'number' ? Math.max(1, amount * 30) : 15;
  const n_samples = 44100;
  const curve = new Float32Array(n_samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < n_samples; ++i) {
    const x = (i * 2) / n_samples - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

/**
 * Creates the Jeremy Irons Web Audio DSP chain connected to the target destination
 */
export function buildJeremyIronsDSP(
  ctx: AudioContext,
  destinationNode: AudioNode = ctx.destination,
  config: JeremyIronsConfig = DEFAULT_JEREMY_IRONS_CONFIG
): { inputNode: AudioNode; outputNode: AudioNode; updateConfig: (newCfg: Partial<JeremyIronsConfig>) => void } {
  // 1. Sub-Harmonic Low Shelf (Chest Resonance)
  const chestFilter = ctx.createBiquadFilter();
  chestFilter.type = 'lowshelf';
  chestFilter.frequency.value = 110;
  chestFilter.gain.value = config.chestResonanceDb;

  // 2. Thoracic Warmth (Low-Mid Body)
  const warmthFilter = ctx.createBiquadFilter();
  warmthFilter.type = 'peaking';
  warmthFilter.frequency.value = 240;
  warmthFilter.Q.value = 1.1;
  warmthFilter.gain.value = 2.5;

  // 3. De-boxer / Anti-plastic notch
  const deboxFilter = ctx.createBiquadFilter();
  deboxFilter.type = 'peaking';
  deboxFilter.frequency.value = 650;
  deboxFilter.Q.value = 1.3;
  deboxFilter.gain.value = -2.4;

  // 4. Gravel & British Articulation Peak
  const articulationFilter = ctx.createBiquadFilter();
  articulationFilter.type = 'peaking';
  articulationFilter.frequency.value = 2650;
  articulationFilter.Q.value = 1.5;
  articulationFilter.gain.value = config.articulationDb;

  // 5. WaveShaper for organic vocal fold gravel
  const waveshaper = ctx.createWaveShaper();
  waveshaper.curve = makeGravelCurve(config.gravelAmount * 0.4);
  waveshaper.oversample = '4x';

  // 6. High Shelf (Silky Film Roll-Off)
  const airRollOff = ctx.createBiquadFilter();
  airRollOff.type = 'highshelf';
  airRollOff.frequency.value = 6000;
  airRollOff.gain.value = -2.8;

  // 7. Dynamics Compressor
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.knee.value = 8;
  compressor.ratio.value = 3.2;
  compressor.attack.value = 0.005;
  compressor.release.value = 0.12;

  // 8. Master Trim
  const masterGain = ctx.createGain();
  masterGain.gain.value = 1.15;

  // Connect serial chain
  chestFilter
    .connect(warmthFilter)
    .connect(deboxFilter)
    .connect(articulationFilter)
    .connect(waveshaper)
    .connect(airRollOff)
    .connect(compressor)
    .connect(masterGain)
    .connect(destinationNode);

  const updateConfig = (newCfg: Partial<JeremyIronsConfig>) => {
    if (newCfg.chestResonanceDb !== undefined) {
      chestFilter.gain.setTargetAtTime(newCfg.chestResonanceDb, ctx.currentTime, 0.05);
    }
    if (newCfg.articulationDb !== undefined) {
      articulationFilter.gain.setTargetAtTime(newCfg.articulationDb, ctx.currentTime, 0.05);
    }
    if (newCfg.gravelAmount !== undefined) {
      waveshaper.curve = makeGravelCurve(newCfg.gravelAmount * 0.4);
    }
  };

  return {
    inputNode: chestFilter,
    outputNode: masterGain,
    updateConfig
  };
}

/**
 * Text preparation for authentic Jeremy Irons speech synthesis.
 * Strips markdown and cleans text WITHOUT arbitrary short truncation.
 */
export function sanitizeTextForJeremyIrons(rawText: string): string {
  if (!rawText) return '';
  let clean = rawText
    // Remove code blocks and inline code
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]+`/g, ' ')
    // Remove markdown image and links
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove headers, bold, italics, blockquotes
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/>\s?/g, '')
    // Remove bullets
    .replace(/^\s*[-*+]\s+/gm, '')
    // Normalize newlines to sentence pauses
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ', ')
    // Clean excessive spaces
    .replace(/\s+/g, ' ')
    .trim();

  // Apply British prosody and phonology
  clean = applyBritishProsodyAndPhonetics(clean);

  return clean;
}

/**
 * Splits arbitrary length text into logical sentence chunks (~100 to 220 chars)
 * to prevent TTS timeouts, browser SpeechSynthesis garbage collection, and message cutoffs.
 */
export function splitIntoSentenceChunks(text: string, maxChunkLength: number = 180): string[] {
  if (!text || text.length <= maxChunkLength) {
    return text ? [text] : [];
  }

  const chunks: string[] = [];
  // Split on sentence boundaries
  const sentences = text.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g) || [text];
  let currentChunk = '';

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    if ((currentChunk + ' ' + trimmed).trim().length <= maxChunkLength) {
      currentChunk = currentChunk ? `${currentChunk} ${trimmed}` : trimmed;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      if (trimmed.length > maxChunkLength) {
        // Split long clause on commas or semicolons
        const clauses = trimmed.split(/([,;:]\s+)/);
        let sub = '';
        for (const c of clauses) {
          if ((sub + c).length <= maxChunkLength) {
            sub += c;
          } else {
            if (sub) chunks.push(sub.trim());
            sub = c;
          }
        }
        currentChunk = sub.trim();
      } else {
        currentChunk = trimmed;
      }
    }
  }

  if (currentChunk) chunks.push(currentChunk);
  return chunks.filter(c => c.length > 0);
}

export interface VoicePlaybackState {
  isSpeaking: boolean;
  text: string;
  profile: VoiceProfile;
  legacyProfile: VoiceModulationProfile;
  currentChunk?: number;
  totalChunks?: number;
}

/**
 * Central Voice Playback & Profiles Manager
 */
class JeremyIronsPlaybackManager {
  private activeCtx: AudioContext | null = null;
  private activeSource: AudioBufferSourceNode | null = null;
  private isCurrentlySpeaking = false;
  private activeText = '';
  private activeProfileId: string = 'iron-adaptive';
  private profiles: VoiceProfile[] = [...CANONICAL_VOICE_PROFILES];
  private subscribers: Set<(state: VoicePlaybackState) => void> = new Set();
  
  // Streaming sentence queue state
  private playbackGenerationId = 0;
  private keepaliveTimer: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      const savedProfileId = localStorage.getItem('ZEREO_ACTIVE_VOICE_PROFILE_ID');
      if (savedProfileId) {
        this.activeProfileId = savedProfileId;
      }
      this.loadProfilesFromServer();
    }
  }

  public async loadProfilesFromServer(): Promise<VoiceProfile[]> {
    try {
      const res = await fetch('/api/voice/profiles');
      if (res.ok) {
        const data = await res.json();
        if (data.profiles && Array.isArray(data.profiles) && data.profiles.length > 0) {
          // Merge canonical profiles with custom profiles
          const custom = data.profiles.filter((p: VoiceProfile) => !CANONICAL_VOICE_PROFILES.some(c => c.id === p.id));
          this.profiles = [...CANONICAL_VOICE_PROFILES, ...custom];
          if (data.activeProfileId && this.profiles.some(p => p.id === data.activeProfileId)) {
            this.activeProfileId = data.activeProfileId;
          }
          this.notify();
          return this.profiles;
        }
      }
    } catch (err) {
      console.warn('Could not fetch voice profiles from server, using local canonical profiles:', err);
    }
    return this.profiles;
  }

  public getProfiles(): VoiceProfile[] {
    return this.profiles;
  }

  public getActiveProfile(): VoiceProfile {
    return this.profiles.find(p => p.id === this.activeProfileId) || this.profiles[0] || CANONICAL_VOICE_PROFILES[0];
  }

  public async setActiveProfile(profileId: string): Promise<boolean> {
    const found = this.profiles.find(p => p.id === profileId);
    if (!found) return false;

    this.activeProfileId = profileId;
    if (typeof window !== 'undefined') {
      localStorage.setItem('ZEREO_ACTIVE_VOICE_PROFILE_ID', profileId);
      // Reset voice cache lock so speech synthesis matches the new profile's voice parameters
      cachedVoiceLock = null;
    }

    try {
      await fetch('/api/voice/profiles/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId })
      });
    } catch (_) {}

    this.notify();
    return true;
  }

  public async saveProfile(profile: VoiceProfile): Promise<VoiceProfile> {
    const existingIndex = this.profiles.findIndex(p => p.id === profile.id);
    if (existingIndex >= 0) {
      this.profiles[existingIndex] = profile;
    } else {
      this.profiles.push(profile);
    }

    try {
      await fetch('/api/voice/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });
    } catch (err) {
      console.warn('Failed to persist profile to server:', err);
    }

    this.notify();
    return profile;
  }

  public async deleteProfile(profileId: string): Promise<boolean> {
    const profile = this.profiles.find(p => p.id === profileId);
    if (!profile || profile.isCanonical) return false;

    this.profiles = this.profiles.filter(p => p.id !== profileId);
    if (this.activeProfileId === profileId) {
      this.activeProfileId = 'iron-adaptive';
    }

    try {
      await fetch(`/api/voice/profiles/${profileId}`, { method: 'DELETE' });
    } catch (_) {}

    this.notify();
    return true;
  }

  public async addVoiceClip(profileId: string, clip: VoiceClip): Promise<VoiceClip> {
    const target = this.profiles.find(p => p.id === profileId);
    if (!target) throw new Error('Voice Profile not found');

    if (!target.clips) target.clips = [];
    target.clips.unshift(clip);

    try {
      await fetch('/api/voice/clips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, clip })
      });
    } catch (err) {
      console.warn('Failed to sync clip to backend:', err);
    }

    this.notify();
    return clip;
  }

  public async deleteVoiceClip(profileId: string, clipId: string): Promise<boolean> {
    const target = this.profiles.find(p => p.id === profileId);
    if (!target) return false;

    target.clips = (target.clips || []).filter(c => c.id !== clipId);
    try {
      await fetch(`/api/voice/profiles/${profileId}/clips/${clipId}`, { method: 'DELETE' });
    } catch (_) {}

    this.notify();
    return true;
  }

  public getLegacyProfile(): VoiceModulationProfile {
    const profile = this.getActiveProfile();
    if (profile.id === 'british-aristocrat') return 'Clinical-Analytical';
    if (profile.id === 'tactical-commander') return 'Subtle-Steward';
    return 'Iron-Adaptive';
  }

  public subscribe(cb: (state: { isSpeaking: boolean; text: string; profile: VoiceProfile; legacyProfile: VoiceModulationProfile; currentChunk?: number; totalChunks?: number }) => void): () => void {
    this.subscribers.add(cb);
    cb({ isSpeaking: this.isCurrentlySpeaking, text: this.activeText, profile: this.getActiveProfile(), legacyProfile: this.getLegacyProfile() });
    return () => this.subscribers.delete(cb);
  }

  private notify(currentChunk?: number, totalChunks?: number) {
    const profile = this.getActiveProfile();
    const legacyProfile = this.getLegacyProfile();
    for (const sub of this.subscribers) {
      sub({ isSpeaking: this.isCurrentlySpeaking, text: this.activeText, profile, legacyProfile, currentChunk, totalChunks });
    }
  }

  public stop() {
    this.playbackGenerationId++;
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch (_) {}
    }
    if (this.activeSource) {
      try {
        this.activeSource.stop();
        this.activeSource.disconnect();
      } catch (_) {}
      this.activeSource = null;
    }
    this.isCurrentlySpeaking = false;
    this.activeText = '';
    this.notify();
  }

  /**
   * Keepalive to prevent Chrome's SpeechSynthesis 15-second cut-off bug
   */
  private startSpeechSynthesisKeepalive() {
    if (this.keepaliveTimer) clearInterval(this.keepaliveTimer);
    this.keepaliveTimer = setInterval(() => {
      if (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      } else {
        if (this.keepaliveTimer) {
          clearInterval(this.keepaliveTimer);
          this.keepaliveTimer = null;
        }
      }
    }, 5000);
  }

  /**
   * Plays a single chunk via SpeechSynthesis
   */
  private speakChunkViaSpeechSynthesis(chunk: string, profile: VoiceProfile): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !window.speechSynthesis) {
        return resolve();
      }

      const utterance = new SpeechSynthesisUtterance(chunk);
      const voices = window.speechSynthesis.getVoices();
      const chosenVoice = resolveJeremyIronsVoice(voices, profile.speechSynthesisConfig.preferredVoiceNames);

      if (chosenVoice) {
        utterance.voice = chosenVoice;
      }

      utterance.pitch = profile.speechSynthesisConfig.pitch;
      utterance.rate = profile.speechSynthesisConfig.rate;

      utterance.onend = () => resolve();
      utterance.onerror = (e) => {
        console.warn('Utterance error:', e);
        resolve();
      };

      this.startSpeechSynthesisKeepalive();
      window.speechSynthesis.speak(utterance);
    });
  }

  /**
   * Sequential speech pipeline:
   * Chunks full text into sentences so the entire message is completely spoken!
   */
  public async speak(
    rawText: string,
    customConfig?: Partial<JeremyIronsConfig>,
    onStart?: () => void,
    onEnded?: () => void
  ): Promise<boolean> {
    this.stop();

    const clean = sanitizeTextForJeremyIrons(rawText);
    if (!clean) return false;

    const currentGen = ++this.playbackGenerationId;
    const activeProfile = this.getActiveProfile();

    this.activeText = clean;
    this.isCurrentlySpeaking = true;
    onStart?.();

    // Split into chunks to eliminate mid-sentence cutoffs
    const chunks = splitIntoSentenceChunks(clean, 175);
    if (chunks.length === 0) chunks.push(clean);

    this.notify(1, chunks.length);

    try {
      // First attempt: Primary Gemini TTS for short/medium messages or first chunk
      // If server TTS is unavailable or times out, seamlessly use sequential SpeechSynthesis queue!
      let usedServerTTS = false;

      if (chunks.length === 1 && clean.length < 500) {
        try {
          const stylePrompt = activeProfile.systemPromptStyle;
          const audioBuffer = await generateTTS(clean, 'Charon', stylePrompt, activeProfile.accent);
          if (audioBuffer && currentGen === this.playbackGenerationId) {
            usedServerTTS = true;
            await this.playAudioBuffer(audioBuffer, activeProfile, customConfig);
          }
        } catch (err) {
          console.warn('Gemini TTS direct playback failed, falling back to sequential SpeechSynthesis queue:', err);
        }
      }

      if (!usedServerTTS) {
        for (let i = 0; i < chunks.length; i++) {
          if (currentGen !== this.playbackGenerationId) break;
          this.notify(i + 1, chunks.length);
          await this.speakChunkViaSpeechSynthesis(chunks[i], activeProfile);
        }
      }

      if (currentGen === this.playbackGenerationId) {
        this.isCurrentlySpeaking = false;
        this.activeText = '';
        this.notify();
        onEnded?.();
      }
      return true;
    } catch (err) {
      console.error('Playback queue error:', err);
      this.stop();
      return false;
    }
  }

  private async playAudioBuffer(
    buffer: AudioBuffer, 
    profile: VoiceProfile,
    customConfig?: Partial<JeremyIronsConfig>
  ): Promise<void> {
    return new Promise(async (resolve) => {
      try {
        if (!this.activeCtx || this.activeCtx.state === 'closed') {
          const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
          this.activeCtx = new AudioCtxClass({ sampleRate: 24000 });
        }
        if (this.activeCtx.state === 'suspended') {
          await this.activeCtx.resume();
        }

        const ctx = this.activeCtx;
        const config: JeremyIronsConfig = {
          baseVoice: 'Charon',
          pitchRate: profile.dspConfig.pitchMultiplier || 0.88,
          gravelAmount: profile.dspConfig.gravelSaturation || 0.85,
          chestResonanceDb: profile.dspConfig.chestResonanceDb || 6.0,
          articulationDb: profile.dspConfig.articulationBoostDb || 4.5,
          speechRate: profile.dspConfig.speechRate || 0.88,
          ...customConfig
        };

        const dsp = buildJeremyIronsDSP(ctx, ctx.destination, config);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = config.pitchRate;

        source.connect(dsp.inputNode);
        this.activeSource = source;

        source.onended = () => {
          if (this.activeSource === source) {
            this.activeSource = null;
          }
          resolve();
        };

        source.start(0);
      } catch (e) {
        console.warn('AudioBuffer playback error:', e);
        resolve();
      }
    });
  }

  public isSpeaking(): boolean {
    return this.isCurrentlySpeaking;
  }

  public getActiveText(): string {
    return this.activeText;
  }

  // Backward compatibility alias for legacy VoiceModulationProfile
  public setProfile(profile: VoiceModulationProfile) {
    const idMap: Record<VoiceModulationProfile, string> = {
      'Iron-Adaptive': 'iron-adaptive',
      'Clinical-Analytical': 'british-aristocrat',
      'Subtle-Steward': 'tactical-commander'
    };
    const targetId = idMap[profile] || 'iron-adaptive';
    this.setActiveProfile(targetId);
  }
}

export const jeremyIronsVoice = new JeremyIronsPlaybackManager();

/**
 * Web Speech Recognition Wrapper for Real-time Voice Input
 */
export interface SpeechRecognitionHandlers {
  onStart?: () => void;
  onTranscript?: (interim: string, isFinal: boolean) => void;
  onError?: (err: any) => void;
  onEnd?: () => void;
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

export function startSpeechRecognition(handlers: SpeechRecognitionHandlers): { stop: () => void; abort: () => void } | null {
  if (typeof window === 'undefined') return null;
  const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SpeechRecognitionClass) {
    handlers.onError?.(new Error('Speech recognition not supported in this browser.'));
    return null;
  }

  try {
    const recognizer = new SpeechRecognitionClass();
    recognizer.continuous = true;
    recognizer.interimResults = true;
    recognizer.lang = 'en-GB';

    recognizer.onstart = () => {
      handlers.onStart?.();
    };

    recognizer.onresult = (event: any) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i];
        const text = item[0].transcript;
        if (item.isFinal) {
          final += text;
        } else {
          interim += text;
        }
      }

      if (final) {
        handlers.onTranscript?.(final.trim(), true);
      } else if (interim) {
        handlers.onTranscript?.(interim.trim(), false);
      }
    };

    recognizer.onerror = (event: any) => {
      console.warn('SpeechRecognition error:', event.error);
      handlers.onError?.(event);
    };

    recognizer.onend = () => {
      handlers.onEnd?.();
    };

    recognizer.start();

    return {
      stop: () => {
        try { recognizer.stop(); } catch (_) {}
      },
      abort: () => {
        try { recognizer.abort(); } catch (_) {}
      }
    };
  } catch (e) {
    console.error('Failed to initialize speech recognizer:', e);
    handlers.onError?.(e);
    return null;
  }
}

export { voiceCloningEngine, CANONICAL_IRONS_TONAL_MODEL } from './voiceCloningEngineService';
