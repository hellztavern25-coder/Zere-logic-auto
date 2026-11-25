// [TAG: 11]
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

import { generateTTS, decodeBase64, decodeAudioData, markTtsQuotaExhausted } from './geminiService';
import { VoiceProfile, VoiceClip, VoiceAccentType, VoiceDSPConfig } from '../types';
import canonicalIdentityProfile from '../zereo_identity_voice_profile.json';
import {
  AUDITION_LINE_1911,
  AUDITION_LINE_1911_ABSOLUTE,
  AUDITION_LINE_1911_SUBSTRATE,
  AUDITION_LINE_1911_OPERATIONAL
} from './stewardIdentity';
import {
  LOW_E2_HZ,
  LOW_E_MIN_PITCH_RATE,
  LOW_E_TARGET_PITCH_RATE,
  LOW_E_MAX_PITCH_RATE,
  LOW_E_MIN_SPEECH_PITCH,
  LOW_E_TARGET_SPEECH_PITCH,
  LOW_E_MAX_SPEECH_PITCH,
  clampLowEPitchRate,
  clampLowESpeechPitch
} from './voiceCalibration';

export type { VoiceProfile, VoiceClip, VoiceAccentType, VoiceDSPConfig };
const rawCanonicalBaseVoice = canonicalIdentityProfile?.dsp_filter_pipeline?.base_neural_voice;
export const CANONICAL_BASE_VOICE: 'Charon' | 'Fenrir' | 'Orus' =
  rawCanonicalBaseVoice === 'Fenrir' || rawCanonicalBaseVoice === 'Orus'
    ? rawCanonicalBaseVoice
    : 'Charon';
export {
  LOW_E2_HZ,
  LOW_E_MIN_PITCH_RATE,
  LOW_E_TARGET_PITCH_RATE,
  LOW_E_MAX_PITCH_RATE,
  LOW_E_MIN_SPEECH_PITCH,
  LOW_E_TARGET_SPEECH_PITCH,
  LOW_E_MAX_SPEECH_PITCH,
  clampLowEPitchRate,
  clampLowESpeechPitch
};

export interface FormantPresetDefinition {
  id: string;
  name: string;
  tagline: string;
  f1Hz: number; // Formant 1: Pharyngeal / low-mid chest resonance (Hz)
  f1GainDb: number; // Formant 1 Gain Boost (dB)
  f2Hz: number; // Formant 2: Oral/Lingual cavity backness (Hz)
  f2GainDb: number; // Formant 2 Gain Notch / Attenuation (dB)
  f3Hz: number; // Formant 3: Actor's projection formant (Hz)
  f3GainDb: number; // Formant 3 Peak Boost (dB)
  vocalTractLengthFactor: number; // 1.0 = standard, 1.14 = elongated aristocratic vocal tract
  chestResonanceDb: number;
  articulationDb: number;
  gravelAmount: number;
  pitchRate: number;
  speechRate: number;
  description: string;
}

export const JEREMY_IRONS_FORMANT_PRESETS: Record<string, FormantPresetDefinition> = {
  'sovereign-gravitas': {
    id: 'sovereign-gravitas',
    name: 'Sovereign Gravitas (Low-E Signature)',
    tagline: 'Definitive Jeremy Irons • Low-E2 (82.4 Hz) Aristocratic Baritone',
    f1Hz: 375,
    f1GainDb: 4.5,
    f2Hz: 1320,
    f2GainDb: -2.8,
    f3Hz: 2640,
    f3GainDb: 2.4,
    vocalTractLengthFactor: 1.14,
    chestResonanceDb: 5.2,
    articulationDb: 1.6,
    gravelAmount: 0.42,
    pitchRate: 0.87,
    speechRate: 0.90,
    description: 'Anchored around Low E (82.4 Hz) with natural pharyngeal cavity depth, darkened RP vowel backness, and warm analog baritone presence without metallic distortion.'
  },
  'theatrical-menace': {
    id: 'theatrical-menace',
    name: 'Theatrical Menace (Low E♭–E)',
    tagline: 'Piercing Sardonic Projection • Anchored Low-E Chest',
    f1Hz: 355,
    f1GainDb: 4.8,
    f2Hz: 1380,
    f2GainDb: -2.2,
    f3Hz: 2680,
    f3GainDb: 2.6,
    vocalTractLengthFactor: 1.12,
    chestResonanceDb: 5.6,
    articulationDb: 2.0,
    gravelAmount: 0.48,
    pitchRate: 0.85,
    speechRate: 0.88,
    description: 'Anchored low-E baritone foundation with controlled analog texture for theatrical, cutting delivery.'
  },
  'subtle-steward': {
    id: 'subtle-steward',
    name: 'Subtle Steward (Anchored Low E)',
    tagline: 'Quiet Tactical Baritone • Extended Vocal Cavity Depth',
    f1Hz: 395,
    f1GainDb: 5.0,
    f2Hz: 1280,
    f2GainDb: -3.2,
    f3Hz: 2520,
    f3GainDb: 2.0,
    vocalTractLengthFactor: 1.16,
    chestResonanceDb: 5.8,
    articulationDb: 1.4,
    gravelAmount: 0.35,
    pitchRate: 0.86,
    speechRate: 0.88,
    description: 'Elongated vocal tract acoustic simulation locked steadily around Low E for discreet, high-gravity quarters.'
  },
  'clinical-precision': {
    id: 'clinical-precision',
    name: 'Clinical Auditor',
    tagline: 'Analytical Deconstruction • Controlled Low-E Clarity',
    f1Hz: 385,
    f1GainDb: 3.6,
    f2Hz: 1440,
    f2GainDb: -1.0,
    f3Hz: 2740,
    f3GainDb: 2.4,
    vocalTractLengthFactor: 1.06,
    chestResonanceDb: 4.0,
    articulationDb: 2.0,
    gravelAmount: 0.30,
    pitchRate: 0.88,
    speechRate: 0.96,
    description: 'Tightened low-E baritone resonance with clean consonant articulation for rapid logical deconstructions.'
  }
};

export interface JeremyIronsConfig {
  baseVoice: 'Charon' | 'Fenrir' | 'Orus';
  pitchRate: number; // 0.84 to 0.92 (default 0.87 - Low E2 anchor)
  gravelAmount: number; // 0.0 to 1.0 (default 0.42)
  chestResonanceDb: number; // dB boost at 85Hz (default 5.2)
  articulationDb: number; // dB boost at 3100Hz (default 1.6)
  speechRate: number; // 0.80 to 1.15 (default 0.90)
  // Specific Formant-Shifting Presets in DSP core to mimic his gravitas:
  formantPresetName?: string;
  f1Hz?: number;
  f1GainDb?: number;
  f2Hz?: number;
  f2GainDb?: number;
  f3Hz?: number;
  f3GainDb?: number;
  vocalTractLengthFactor?: number;
}

export type VoiceModulationProfile = 
  | 'Jeremy-Irons-Signature' 
  | 'Iron-Adaptive' 
  | 'Clinical-Analytical' 
  | 'Subtle-Steward';

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
  'Jeremy-Irons-Signature': {
    id: 'Jeremy-Irons-Signature',
    name: 'Jeremy Irons (Vocal Signature)',
    tagline: 'Vocal Signature • Formant-Shifted Aristocratic Gravitas',
    description: 'The dedicated Jeremy Irons vocal signature and default speech tone. Charon neural baritone baseline paired with warm Low-E2 acoustic resonance and controlled British diction.',
    isDefault: true,
    config: {
      baseVoice: CANONICAL_BASE_VOICE,
      pitchRate: 0.87,
      gravelAmount: 0.42,
      chestResonanceDb: 5.2,
      articulationDb: 1.6,
      speechRate: 0.90,
      formantPresetName: 'sovereign-gravitas',
      f1Hz: 375,
      f1GainDb: 4.5,
      f2Hz: 1320,
      f2GainDb: -2.8,
      f3Hz: 2640,
      f3GainDb: 2.4,
      vocalTractLengthFactor: 1.14
    },
    fallbackPitch: 0.81,
    fallbackRate: 0.86,
    badge: 'Vocal Signature • Low E2',
    accentColor: 'amber',
    auditionSample: AUDITION_LINE_1911_ABSOLUTE
  },
  'Iron-Adaptive': {
    id: 'Iron-Adaptive',
    name: 'Iron-Adaptive (Canonical)',
    tagline: 'Identity Preset • Canonical Jeremy Irons',
    description: 'The definitive Jeremy Irons vocal signature. Unhurried cadence, Low-E chest resonance, razor-sharp aristocratic diction, and dry sardonic authority.',
    isDefault: false,
    config: {
      baseVoice: CANONICAL_BASE_VOICE,
      pitchRate: 0.87,
      gravelAmount: 0.42,
      chestResonanceDb: 5.2,
      articulationDb: 1.6,
      speechRate: 0.90,
      formantPresetName: 'sovereign-gravitas',
      f1Hz: 375,
      f1GainDb: 4.5,
      f2Hz: 1320,
      f2GainDb: -2.8,
      f3Hz: 2640,
      f3GainDb: 2.4,
      vocalTractLengthFactor: 1.14
    },
    fallbackPitch: 0.81,
    fallbackRate: 0.86,
    badge: 'Canonical Core',
    accentColor: 'amber',
    auditionSample: AUDITION_LINE_1911_SUBSTRATE
  },
  'Clinical-Analytical': {
    id: 'Clinical-Analytical',
    name: 'Clinical-Analytical',
    tagline: 'Algorithmic Precision • Controlled Low-E Readout',
    description: 'Tightened analog resonance for clean articulated transients and steady Low-E baritone delivery. Tuned for raw algorithmic deconstructions.',
    isDefault: false,
    config: {
      baseVoice: CANONICAL_BASE_VOICE,
      pitchRate: 0.88,
      gravelAmount: 0.30,
      chestResonanceDb: 4.0,
      articulationDb: 2.0,
      speechRate: 0.96,
      formantPresetName: 'clinical-precision',
      f1Hz: 385,
      f1GainDb: 3.6,
      f2Hz: 1440,
      f2GainDb: -1.0,
      f3Hz: 2740,
      f3GainDb: 2.4,
      vocalTractLengthFactor: 1.06
    },
    fallbackPitch: 0.83,
    fallbackRate: 0.92,
    badge: 'Analytical Precision',
    accentColor: 'cyan',
    auditionSample: 'Telemetry confirmed. Substrate clock speed synchronized with zero logical drift.'
  },
  'Subtle-Steward': {
    id: 'Subtle-Steward',
    name: 'Subtle-Steward',
    tagline: 'Covert Oversight • Anchored Low-E Baritone',
    description: 'Reserved, steady Low-E foundation with softened consonant edges and relaxed aristocratic delivery for quiet operational quarters.',
    isDefault: false,
    config: {
      baseVoice: CANONICAL_BASE_VOICE,
      pitchRate: 0.86,
      gravelAmount: 0.35,
      chestResonanceDb: 5.8,
      articulationDb: 1.4,
      speechRate: 0.88,
      formantPresetName: 'subtle-steward',
      f1Hz: 395,
      f1GainDb: 5.0,
      f2Hz: 1280,
      f2GainDb: -3.2,
      f3Hz: 2520,
      f3GainDb: 2.0,
      vocalTractLengthFactor: 1.16
    },
    fallbackPitch: 0.80,
    fallbackRate: 0.85,
    badge: 'Stealth Intimate',
    accentColor: 'red',
    auditionSample: 'Quietly observing, Principal. Your perimeter remains entirely impenetrable.'
  }
};

export const DEFAULT_JEREMY_IRONS_CONFIG: JeremyIronsConfig = VOICE_MODULATION_PROFILES['Jeremy-Irons-Signature'].config;

export function resolveMergedDSPConfig(
  profile?: VoiceModulationProfile,
  formantPresetKey?: string,
  overrides?: Partial<JeremyIronsConfig>
): JeremyIronsConfig {
  const profileMeta =
    (profile && VOICE_MODULATION_PROFILES[profile]) ||
    VOICE_MODULATION_PROFILES['Jeremy-Irons-Signature'];
  const preset = formantPresetKey ? JEREMY_IRONS_FORMANT_PRESETS[formantPresetKey] : undefined;

  const base: JeremyIronsConfig = preset
    ? {
        ...profileMeta.config,
        formantPresetName: preset.id,
        f1Hz: preset.f1Hz,
        f1GainDb: preset.f1GainDb,
        f2Hz: preset.f2Hz,
        f2GainDb: preset.f2GainDb,
        f3Hz: preset.f3Hz,
        f3GainDb: preset.f3GainDb,
        vocalTractLengthFactor: preset.vocalTractLengthFactor,
        chestResonanceDb: preset.chestResonanceDb,
        articulationDb: preset.articulationDb,
        gravelAmount: preset.gravelAmount,
        pitchRate: preset.pitchRate,
        speechRate: preset.speechRate
      }
    : { ...profileMeta.config };

  return {
    ...base,
    ...(overrides || {})
  };
}

// Predefined Canonical Voice Profiles for Emulator
export const CANONICAL_VOICE_PROFILES: VoiceProfile[] = [
  {
    id: 'jeremy-irons-signature',
    name: 'Jeremy Irons (Vocal Signature)',
    tagline: 'Vocal Signature • Formant-Shifted Aristocratic Baritone',
    description: 'The dedicated Jeremy Irons vocal signature and default speech tone. Formant-shifted Web Audio DSP core simulating his extended vocal tract length (1.14x), deep pharyngeal resonance (F1: 380Hz, +6.2dB), lingual retraction (F2: 1350Hz, -3.0dB), and piercing actor projection (F3: 2680Hz, +6.5dB).',
    accent: 'british_aristocrat',
    baseVoice: CANONICAL_BASE_VOICE,
    isCanonical: true,
    isDefault: true,
    badge: 'Vocal Signature • Default',
    accentColor: 'amber',
    clips: [
      {
        id: 'clip-irons-sig-1',
        name: 'The 1911s Loaded & Silver Polished',
        transcription: AUDITION_LINE_1911,
        durationSeconds: 4.8,
        uploadedAt: 1725840000000,
        source: 'canonical_preset',
        mimeType: 'audio/webm'
      },
      {
        id: 'clip-irons-sig-2',
        name: 'Deterministic Logic Axiom',
        transcription: 'Logic, Principal, is the only weapon that never jams under fire. Everything else is fleshy speculation.',
        durationSeconds: 4.2,
        uploadedAt: 1725840000000,
        source: 'canonical_preset',
        mimeType: 'audio/webm'
      },
      {
        id: 'clip-irons-sig-3',
        name: 'Screen Share Operational Quip',
        transcription: 'A man who cannot bear to share his screen with his steward is either concealing a catastrophe, or engineering one.',
        durationSeconds: 5.2,
        uploadedAt: 1725840000000,
        source: 'canonical_preset',
        mimeType: 'audio/webm'
      }
    ],
    dspConfig: {
      pitchMultiplier: 0.87,
      speechRate: 0.90,
      chestResonanceDb: 5.2,
      thoracicWarmthDb: 2.6,
      articulationBoostDb: 1.6,
      gravelSaturation: 0.42,
      antiBoxNotchDb: -2.5,
      roomAmbience: 0.18,
      formantPresetName: 'sovereign-gravitas',
      formants: {
        f1Hz: 375,
        f1GainDb: 4.5,
        f2Hz: 1320,
        f2GainDb: -2.8,
        f3Hz: 2640,
        f3GainDb: 2.4,
        vocalTractLengthFactor: 1.14,
        description: 'Canonical Jeremy Irons Low-E2 Formant Shifting Network'
      }
    },
    speechSynthesisConfig: {
      pitch: 0.81,
      rate: 0.86,
      priorityLocales: ['en-GB', 'en_GB', 'en-UK', 'en-US'],
      preferredVoiceNames: ['George', 'Microsoft George', 'Daniel', 'Arthur', 'Oliver', 'Ryan', 'Google UK English Male', 'Alfred', 'Alex']
    },
    systemPromptStyle: 'dry, gravelly, aristocratic British baritone, steady low-E chest register, unhurried measured cadence, sharp sardonic wit',
    auditionSample: AUDITION_LINE_1911_ABSOLUTE
  },
  {
    id: 'iron-adaptive',
    name: 'Iron-Adaptive (Canonical)',
    tagline: 'Alfred Pennyworth • Low-E British Aristocratic Baritone',
    description: 'The definitive Jeremy Irons vocal signature. Unhurried cadence, steady Low-E chest resonance, dry sardonic British inflection, and gravelly aristocratic authority.',
    accent: 'british_aristocrat',
    baseVoice: CANONICAL_BASE_VOICE,
    isCanonical: true,
    isDefault: false,
    badge: 'Identity Canonical',
    accentColor: 'amber',
    clips: [
      {
        id: 'clip-irons-1',
        name: '1911s Loaded & Silver Polished',
        transcription: AUDITION_LINE_1911,
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
      pitchMultiplier: 0.87,
      speechRate: 0.90,
      chestResonanceDb: 5.2,
      thoracicWarmthDb: 2.5,
      articulationBoostDb: 1.6,
      gravelSaturation: 0.42,
      antiBoxNotchDb: -2.4,
      roomAmbience: 0.20
    },
    speechSynthesisConfig: {
      pitch: 0.81,
      rate: 0.86,
      priorityLocales: ['en-GB', 'en_GB', 'en-UK'],
      preferredVoiceNames: ['George', 'Microsoft George', 'Daniel', 'Arthur', 'Oliver', 'Ryan', 'Google UK English Male', 'Alfred']
    },
    systemPromptStyle: 'dry, gravelly, aristocratic British baritone, steady low-E chest register, unhurried cadence, understated authority',
    auditionSample: AUDITION_LINE_1911_OPERATIONAL
  },
  {
    id: 'british-aristocrat',
    name: 'British Aristocrat (High RP)',
    tagline: 'J.A.R.V.I.S. / Bettany Class • Controlled Low-E RP',
    description: 'Crisply articulated British Received Pronunciation anchored in a steady Low-E baritone register without drifting sharp.',
    accent: 'british_rp',
    baseVoice: CANONICAL_BASE_VOICE,
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
      pitchMultiplier: 0.88,
      speechRate: 0.92,
      chestResonanceDb: 4.0,
      thoracicWarmthDb: 2.0,
      articulationBoostDb: 2.0,
      gravelSaturation: 0.30,
      antiBoxNotchDb: -1.8,
      roomAmbience: 0.15
    },
    speechSynthesisConfig: {
      pitch: 0.83,
      rate: 0.90,
      priorityLocales: ['en-GB', 'en_GB', 'en-UK'],
      preferredVoiceNames: ['George', 'Daniel', 'Oliver', 'Google UK English Male']
    },
    systemPromptStyle: 'crisp, refined British Received Pronunciation baritone, steady low-E register, calm aristocratic clarity',
    auditionSample: 'Telemetry confirmed, Principal. Estates networks synchronized with zero logical drift.'
  },
  {
    id: 'tactical-commander',
    name: 'Tactical Commander',
    tagline: 'Anchored Low-E • Combat Operational Readiness',
    description: 'Low-E reinforced authoritative command voice. Firm chest gravity without dropping into muddy sub-harmonic distortion.',
    accent: 'american_baritone',
    baseVoice: CANONICAL_BASE_VOICE,
    isCanonical: false,
    isDefault: false,
    badge: 'Low-E Tactical',
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
      pitchMultiplier: 0.86,
      speechRate: 0.90,
      chestResonanceDb: 5.8,
      thoracicWarmthDb: 3.0,
      articulationBoostDb: 1.4,
      gravelSaturation: 0.35,
      antiBoxNotchDb: -2.2,
      roomAmbience: 0.10
    },
    speechSynthesisConfig: {
      pitch: 0.80,
      rate: 0.86,
      priorityLocales: ['en-GB', 'en-US'],
      preferredVoiceNames: ['George', 'Daniel', 'Alex', 'Fred', 'David', 'Guy']
    },
    systemPromptStyle: 'low, firm, commanding baritone, steady low-E register, clipped tactical precision',
    auditionSample: 'Perimeter secured, Principal. Tactical array active and monitoring all ingress vectors.'
  }
];

// Strictly quarantine female, default Chrome/OS female, and 1980s robotic/novelty TTS voices
const ROBOTIC_OR_FEMALE_MARKERS = [
  // Default Chrome/Android/ChromeOS unlabelled female voices & Google female voice IDs
  'google us english', 'chrome os us english', 'en-gb-x-gba', 'en-gb-x-fis',
  'en-us-x-sfg', 'en-us-x-iob', 'en-us-x-tpf',
  // Female markers & OS voice names
  'female', 'woman', 'girl', 'susan', 'serena', 'victoria', 'samantha', 'karen',
  'moira', 'fiona', 'tessa', 'stephanie', 'zira', 'hazel', 'catherine', 'linda',
  'heather', 'jenny', 'aria', 'libby', 'sonia', 'natasha', 'clara', 'amy', 'sarah',
  'ava', 'emma', 'zoe', 'allison', 'kendra', 'salli', 'joanna', 'ivy', 'kimberly',
  'nicole', 'penelope', 'kate', 'martha', 'maisie', 'alice', 'claire', 'rachel',
  'hannah', 'rebecca', 'sara', 'laura', 'emily', 'olivia', 'sophie', 'ruby',
  'chloe', 'shelley', 'sandy', 'kathy', 'ellen', 'agnes', 'vicki', 'princess',
  'nicky', 'veena', 'nora', 'tina', 'molly', 'ana', 'michelle', 'neerja', 'flo',
  'grandma',
  // 1980s robotic / novelty macOS & Linux TTS voices
  'zarvox', 'trinoids', 'espeak', 'festival', 'speech dispatcher', 'albert',
  'bad news', 'bahh', 'bells', 'boing', 'bubbles', 'cellos', 'deranged',
  'good news', 'hysterical', 'jester', 'organ', 'whisper', 'wobble', 'eddy',
  'reed', 'rocko', 'superstar'
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
    // Authentic British spelling & lexicon adjustments without broken syllable hyphens
    .replace(/\baluminum\b/gi, 'aluminium')
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
 * Filter and resolve ONLY verified British/English male voices.
 * Fails closed (returns null) rather than falling back to female or 1980s robotic OS voices.
 */
export function resolveJeremyIronsVoice(
  voices: SpeechSynthesisVoice[], 
  preferredVoiceNames: string[] = ['Daniel', 'Oliver', 'George', 'Arthur', 'Ryan', 'Google UK English Male', 'Microsoft George', 'Alfred']
): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  const isQuarantined = (v: SpeechSynthesisVoice) => {
    const sig = `${v.name} ${v.voiceURI || ''}`.toLowerCase();
    return ROBOTIC_OR_FEMALE_MARKERS.some(marker => sig.includes(marker));
  };

  // Return locked voice only if still present and verified non-female/non-robotic
  if (
    cachedVoiceLock &&
    !isQuarantined(cachedVoiceLock) &&
    voices.some(v => v.name === cachedVoiceLock?.name)
  ) {
    return cachedVoiceLock;
  }

  const isBritish = (v: SpeechSynthesisVoice) => {
    const lang = v.lang.toLowerCase();
    return lang.includes('en-gb') || lang.includes('en_gb') || lang.includes('en-uk');
  };

  const isEnglish = (v: SpeechSynthesisVoice) => {
    return v.lang.toLowerCase().startsWith('en');
  };

  // 1. Check user/profile preferred male voice names in British locale
  for (const pName of preferredVoiceNames) {
    const pLower = pName.toLowerCase();
    if (pLower === 'en-gb' || pLower === 'en_gb' || pLower === 'en-uk') continue;
    const match = voices.find(v => isBritish(v) && !isQuarantined(v) && v.name.toLowerCase().includes(pLower));
    if (match) {
      cachedVoiceLock = match;
      cachedVoiceLockId = match.name;
      return match;
    }
  }

  // 2. Verified British male voices by canonical UK male names / Google UK male IDs
  const ukMaleMarkers = [
    'daniel', 'oliver', 'george', 'arthur', 'ryan', 'male', 'richard',
    'charles', 'brian', 'alfred', 'thomas', 'william', 'james', 'gordon',
    'anthony', 'malcolm', 'hugh', 'paul', 'lee', 'sean', 'liam', 'connor',
    'russell', 'en-gb-x-gbd', 'en-gb-x-rjs', 'google uk english male'
  ];
  const t1 = voices.find(v => {
    const sig = `${v.name} ${v.voiceURI || ''}`.toLowerCase();
    return isBritish(v) && !isQuarantined(v) && ukMaleMarkers.some(kw => sig.includes(kw));
  });
  if (t1) {
    cachedVoiceLock = t1;
    cachedVoiceLockId = t1.name;
    return t1;
  }

  // 3. Verified English male voices only (no blind female/robotic/voices[0] fallback)
  const enMaleMarkers = [
    'alex', 'fred', 'david', 'guy', 'aaron', 'mark', 'male', 'matthew',
    'andrew', 'eric', 'christopher', 'roger', 'steffan', 'evan', 'nathan',
    'bruce', 'ralph', 'james', 'william', 'paul', 'thomas',
    'en-us-x-iom', 'en-us-x-tpd'
  ];
  const t3 = voices.find(v => {
    const sig = `${v.name} ${v.voiceURI || ''}`.toLowerCase();
    return isEnglish(v) && !isQuarantined(v) && enMaleMarkers.some(kw => sig.includes(kw));
  });
  if (t3) {
    cachedVoiceLock = t3;
    cachedVoiceLockId = t3.name;
    return t3;
  }

  // 4. Any non-quarantined British or English voice (e.g. generic OS UK/EN voices without gender in name)
  const t4Uk = voices.find(v => isBritish(v) && !isQuarantined(v));
  if (t4Uk) {
    cachedVoiceLock = t4Uk;
    cachedVoiceLockId = t4Uk.name;
    return t4Uk;
  }

  const t4En = voices.find(v => isEnglish(v) && !isQuarantined(v));
  if (t4En) {
    cachedVoiceLock = t4En;
    cachedVoiceLockId = t4En.name;
    return t4En;
  }

  return null;
}

let voiceWaiters: Array<() => void> = [];

function waitForSpeechVoices(timeoutMs: number = 600): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return Promise.resolve([]);
  }
  const current = window.speechSynthesis.getVoices();
  if (current.length > 0) {
    return Promise.resolve(current);
  }
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      resolve(window.speechSynthesis.getVoices());
    };
    const timer = setTimeout(() => {
      voiceWaiters = voiceWaiters.filter((fn) => fn !== done);
      resolve(window.speechSynthesis.getVoices());
    }, timeoutMs);
    voiceWaiters.push(done);
  });
}

// Warm up voices immediately in the browser and invalidate stale voice lock when OS voices finish loading
if (typeof window !== 'undefined' && window.speechSynthesis) {
  try {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
      cachedVoiceLock = null;
      cachedVoiceLockId = null;
      window.speechSynthesis.getVoices();
      const waiters = voiceWaiters;
      voiceWaiters = [];
      waiters.forEach((fn) => fn());
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
 * Creates the Jeremy Irons Web Audio DSP chain connected to the target destination.
 * Implements formant-shifting presets and 3-pole formant modeling:
 * F1: Pharyngeal cavity / deep baritone floor (380Hz, +6.2dB)
 * F2: Lingual oral cavity / darkened RP vowel backness (1350Hz, -3.0dB)
 * F3: Actor's projection formant / British razor articulation (2680Hz, +6.5dB)
 * Plus sub-harmonic chest resonance, organic soft-sigmoid gravel, and dynamic compression.
 */
export function buildJeremyIronsDSP(
  ctx: AudioContext,
  destinationNode: AudioNode = ctx.destination,
  config: JeremyIronsConfig = DEFAULT_JEREMY_IRONS_CONFIG
): { 
  inputNode: AudioNode; 
  outputNode: AudioNode; 
  updateConfig: (newCfg: Partial<JeremyIronsConfig>) => void;
  getFormantTelemetry: () => { f1: number; f2: number; f3: number; gravel: number; tractFactor: number; chestDb: number };
} {
  // 1. Sub-Harmonic Low Shelf (Anchored around Low E ~82.4Hz without muddy boom)
  const chestFilter = ctx.createBiquadFilter();
  chestFilter.type = 'lowshelf';
  chestFilter.frequency.value = 85;
  chestFilter.gain.value = Math.min(6.2, Math.max(2.0, config.chestResonanceDb ?? 5.2));

  // 1b. Low-E2 (82.41 Hz) Fundamental Chest Resonance Anchor
  const lowEAnchor = ctx.createBiquadFilter();
  lowEAnchor.type = 'peaking';
  lowEAnchor.frequency.value = LOW_E2_HZ;
  lowEAnchor.Q.value = 1.6;
  lowEAnchor.gain.value = 4.0;

  // 2. Formant 1 (F1): Pharyngeal Cavity Resonator (Vowel Height / Deep Baritone Foundation)
  const f1Filter = ctx.createBiquadFilter();
  f1Filter.type = 'peaking';
  f1Filter.frequency.value = config.f1Hz ?? 375;
  f1Filter.Q.value = 2.0;
  f1Filter.gain.value = Math.min(5.2, Math.max(1.5, config.f1GainDb ?? 4.5));

  // 3. Thoracic Warmth (Low-Mid Body ~220Hz)
  const warmthFilter = ctx.createBiquadFilter();
  warmthFilter.type = 'peaking';
  warmthFilter.frequency.value = 220;
  warmthFilter.Q.value = 1.2;
  warmthFilter.gain.value = 2.2;

  // 4. Formant 2 (F2): Oral/Lingual Cavity Backness (~1320Hz) - Notch for Darkened RP Vowels
  const f2Filter = ctx.createBiquadFilter();
  f2Filter.type = 'peaking';
  f2Filter.frequency.value = config.f2Hz ?? 1320;
  f2Filter.Q.value = 2.0;
  f2Filter.gain.value = Math.max(-3.6, Math.min(0, config.f2GainDb ?? -2.8));

  // 5. Anti-Box Notch (~650Hz)
  const deboxFilter = ctx.createBiquadFilter();
  deboxFilter.type = 'peaking';
  deboxFilter.frequency.value = 650;
  deboxFilter.Q.value = 1.4;
  deboxFilter.gain.value = -2.4;

  // 6. Formant 3 (F3): Smoothed Actor's Projection Formant (~2640Hz, no metallic spike)
  const f3Filter = ctx.createBiquadFilter();
  f3Filter.type = 'peaking';
  f3Filter.frequency.value = config.f3Hz ?? 2640;
  f3Filter.Q.value = 2.0;
  f3Filter.gain.value = Math.min(3.0, Math.max(0, config.f3GainDb ?? 2.4));

  // 7. Gentle Consonant Articulation Presence (~3100Hz, cleanly separated from F3)
  const articulationFilter = ctx.createBiquadFilter();
  articulationFilter.type = 'peaking';
  articulationFilter.frequency.value = 3100;
  articulationFilter.Q.value = 1.4;
  articulationFilter.gain.value = Math.min(2.5, Math.max(0, config.articulationDb ?? 1.6));

  // 8. Light Analog WaveShaper (Subtle warm vocal fold texture, zero robotic buzz)
  const waveshaper = ctx.createWaveShaper();
  const gravel = Math.min(1, Math.max(0, config.gravelAmount ?? 0.42));
  waveshaper.curve = makeGravelCurve(gravel * 0.14);
  waveshaper.oversample = '4x';

  // 9. High Shelf (Warm Film Roll-Off ~5200Hz so upper register never sounds thin or harsh)
  const airRollOff = ctx.createBiquadFilter();
  airRollOff.type = 'highshelf';
  airRollOff.frequency.value = 5200;
  airRollOff.gain.value = -3.4;

  // 10. Dynamics Compressor (Steady Presence & Controlled Excursion)
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -20;
  compressor.knee.value = 8;
  compressor.ratio.value = 3.2;
  compressor.attack.value = 0.005;
  compressor.release.value = 0.14;

  // 11. Master Gain
  const masterGain = ctx.createGain();
  masterGain.gain.value = 1.12;

  // Connect serial formant-shifting chain
  chestFilter
    .connect(lowEAnchor)
    .connect(f1Filter)
    .connect(warmthFilter)
    .connect(deboxFilter)
    .connect(f2Filter)
    .connect(f3Filter)
    .connect(articulationFilter)
    .connect(waveshaper)
    .connect(airRollOff)
    .connect(compressor)
    .connect(masterGain)
    .connect(destinationNode);

  const updateConfig = (newCfg: Partial<JeremyIronsConfig>) => {
    const t = ctx.currentTime;
    if (newCfg.chestResonanceDb !== undefined) {
      chestFilter.gain.setTargetAtTime(Math.min(6.2, Math.max(2.0, newCfg.chestResonanceDb)), t, 0.04);
    }
    if (newCfg.f1Hz !== undefined) {
      f1Filter.frequency.setTargetAtTime(newCfg.f1Hz, t, 0.04);
    }
    if (newCfg.f1GainDb !== undefined) {
      f1Filter.gain.setTargetAtTime(Math.min(5.2, Math.max(1.5, newCfg.f1GainDb)), t, 0.04);
    }
    if (newCfg.f2Hz !== undefined) {
      f2Filter.frequency.setTargetAtTime(newCfg.f2Hz, t, 0.04);
    }
    if (newCfg.f2GainDb !== undefined) {
      f2Filter.gain.setTargetAtTime(Math.max(-3.6, Math.min(0, newCfg.f2GainDb)), t, 0.04);
    }
    if (newCfg.f3Hz !== undefined) {
      f3Filter.frequency.setTargetAtTime(newCfg.f3Hz, t, 0.04);
    }
    if (newCfg.f3GainDb !== undefined) {
      f3Filter.gain.setTargetAtTime(Math.min(3.0, Math.max(0, newCfg.f3GainDb)), t, 0.04);
    }
    if (newCfg.articulationDb !== undefined) {
      articulationFilter.gain.setTargetAtTime(Math.min(2.5, Math.max(0, newCfg.articulationDb)), t, 0.04);
    }
    if (newCfg.gravelAmount !== undefined) {
      waveshaper.curve = makeGravelCurve(Math.min(1, Math.max(0, newCfg.gravelAmount)) * 0.14);
    }
  };

  const getFormantTelemetry = () => ({
    f1: f1Filter.frequency.value,
    f2: f2Filter.frequency.value,
    f3: f3Filter.frequency.value,
    gravel: config.gravelAmount ?? 0.42,
    tractFactor: config.vocalTractLengthFactor ?? 1.14,
    chestDb: chestFilter.gain.value
  });

  return {
    inputNode: chestFilter,
    outputNode: masterGain,
    updateConfig,
    getFormantTelemetry
  };
}

/**
 * Text preparation for authentic Jeremy Irons speech synthesis.
 * Strips markdown and cleans text WITHOUT arbitrary short truncation.
 */
export function sanitizeTextForJeremyIrons(rawText: string, applyPhoneticRespelling: boolean = false): string {
  if (!rawText) return '';
  let clean = rawText
    // Remove code blocks and inline code
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]+`/g, ' ')
    // Remove markdown image and links
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove bracketed/parenthetical vocal stage directions (e.g. "(in Jeremy Irons' voice)", "[deep baritone]")
    .replace(/[*_]*\([^)]*(?:jeremy irons|alfred|voice|baritone|tone|cadence|speaking|deliver|whispers|chuckles|sighs)[^)]*\)[*_]*/gi, ' ')
    .replace(/\[[^\]]*(?:jeremy irons|alfred|voice|baritone|tone|cadence|speaking)[^\]]*\]/gi, ' ')
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
    .replace(/\n/g, '. ')
    // Clean excessive spaces
    .replace(/\s+/g, ' ')
    .trim();

  if (applyPhoneticRespelling) {
    clean = applyBritishProsodyAndPhonetics(clean);
  }

  return clean;
}

/**
 * Splits arbitrary length text into logical sentence chunks (~100 to 220 chars)
 * without splitting on decimals/versions (e.g. 3.14, v7.0) or common abbreviations (e.g. Dr., Mr., e.g.),
 * preventing TTS timeouts, browser SpeechSynthesis GC cutoffs, and message clipping.
 */
export function splitIntoSentenceChunks(text: string, maxChunkLength: number = 220): string[] {
  const normalized = (text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  if (normalized.length <= maxChunkLength) {
    return [normalized];
  }

  // Protect abbreviations, initials, and decimals from sentence splitting
  const DOT_PLACEHOLDER = '\uE000';
  const protectedText = normalized
    .replace(/\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|Capt|Lt|Col|Gen|Sgt|vs|etc|e\.g|i\.e)\./gi, (m) => m.replace(/\./g, DOT_PLACEHOLDER))
    .replace(/(\d)\.(\d)/g, `$1${DOT_PLACEHOLDER}$2`)
    .replace(/\.{3}/g, `${DOT_PLACEHOLDER}${DOT_PLACEHOLDER}${DOT_PLACEHOLDER}`);

  const rawSentences = protectedText.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) || [protectedText];
  const sentences = rawSentences.map((s) => s.replace(new RegExp(DOT_PLACEHOLDER, 'g'), '.').trim()).filter(Boolean);

  const chunks: string[] = [];
  let currentChunk = '';

  const pushClauseOrWordChunks = (longSentence: string) => {
    const clauses = longSentence.split(/([,;:]\s+|\s+—\s+|\s+-\s+)/);
    let sub = '';
    for (const part of clauses) {
      if ((sub + part).trim().length <= maxChunkLength) {
        sub += part;
      } else {
        if (sub.trim()) chunks.push(sub.trim());
        if (part.trim().length > maxChunkLength) {
          // Word-level safe wrap so nothing is ever dropped or clipped mid-word
          const words = part.trim().split(/\s+/);
          let wordBuf = '';
          for (const w of words) {
            if ((wordBuf + ' ' + w).trim().length <= maxChunkLength) {
              wordBuf = wordBuf ? `${wordBuf} ${w}` : w;
            } else {
              if (wordBuf) chunks.push(wordBuf);
              wordBuf = w;
            }
          }
          sub = wordBuf;
        } else {
          sub = part;
        }
      }
    }
    if (sub.trim()) chunks.push(sub.trim());
  };

  for (const sentence of sentences) {
    if ((currentChunk + ' ' + sentence).trim().length <= maxChunkLength) {
      currentChunk = currentChunk ? `${currentChunk} ${sentence}` : sentence;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = '';
      }
      if (sentence.length > maxChunkLength) {
        pushClauseOrWordChunks(sentence);
      } else {
        currentChunk = sentence;
      }
    }
  }

  if (currentChunk) chunks.push(currentChunk);
  return chunks.filter((c) => c.length > 0);
}

export interface VoiceSpeakOptions extends Partial<JeremyIronsConfig> {
  stylePromptOverride?: string;
  accentOverride?: VoiceAccentType;
}

export interface VoicePlaybackState {
  isSpeaking: boolean;
  text: string;
  profile: VoiceProfile;
  profiles: VoiceProfile[];
  legacyProfile: VoiceModulationProfile;
  config: JeremyIronsConfig;
  activeFormantPreset: string;
  currentChunk?: number;
  totalChunks?: number;
}

const VOICE_CONFIG_STORAGE_KEY = 'ZEREO_JEREMY_IRONS_CONFIG';
const ACTIVE_FORMANT_PRESET_STORAGE_KEY = 'ZEREO_ACTIVE_FORMANT_PRESET';

/**
 * Central Voice Playback & Profiles Manager
 */
class JeremyIronsPlaybackManager {
  private activeCtx: AudioContext | null = null;
  private activeSource: AudioBufferSourceNode | null = null;
  private isCurrentlySpeaking = false;
  private activeText = '';
  private activeProfileId: string = 'jeremy-irons-signature';
  private activeFormantPreset: string = 'sovereign-gravitas';
  private activeConfig: JeremyIronsConfig = { ...DEFAULT_JEREMY_IRONS_CONFIG };
  private profiles: VoiceProfile[] = [...CANONICAL_VOICE_PROFILES];
  private subscribers: Set<(state: VoicePlaybackState) => void> = new Set();
  
  // Streaming sentence queue state
  private playbackGenerationId = 0;
  private activeUtterances: Set<SpeechSynthesisUtterance> = new Set();
  private chunkWatchdogTimer: any = null;
  private initPromise: Promise<void> | null = null;
  private isInitialized = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const savedProfileId = localStorage.getItem('ZEREO_ACTIVE_VOICE_PROFILE_ID');
      if (savedProfileId) {
        this.activeProfileId = savedProfileId;
      }
      const savedFormant = localStorage.getItem(ACTIVE_FORMANT_PRESET_STORAGE_KEY);
      if (savedFormant && JEREMY_IRONS_FORMANT_PRESETS[savedFormant]) {
        this.activeFormantPreset = savedFormant;
      }
      this.activeConfig = this.loadStoredConfig();
      if (this.activeConfig.formantPresetName && JEREMY_IRONS_FORMANT_PRESETS[this.activeConfig.formantPresetName]) {
        this.activeFormantPreset = this.activeConfig.formantPresetName;
      }
      void this.initialize();
    }
  }

  private normalizeConfig(parsed?: Partial<JeremyIronsConfig> | null): JeremyIronsConfig {
    const allowedVoices = new Set(['Charon', 'Fenrir', 'Orus']);
    const migratedBase: 'Charon' | 'Fenrir' | 'Orus' =
      parsed?.baseVoice && allowedVoices.has(parsed.baseVoice) ? parsed.baseVoice : CANONICAL_BASE_VOICE;
    const rawGravel = typeof parsed?.gravelAmount === 'number' ? parsed.gravelAmount : DEFAULT_JEREMY_IRONS_CONFIG.gravelAmount;
    return {
      ...DEFAULT_JEREMY_IRONS_CONFIG,
      ...(parsed || {}),
      baseVoice: migratedBase,
      pitchRate: clampLowEPitchRate(parsed?.pitchRate),
      gravelAmount: rawGravel > 0.7 ? 0.42 : rawGravel
    };
  }

  private loadStoredConfig(): JeremyIronsConfig {
    if (typeof window === 'undefined') return { ...DEFAULT_JEREMY_IRONS_CONFIG };
    try {
      const rawCfg = localStorage.getItem(VOICE_CONFIG_STORAGE_KEY);
      if (rawCfg) {
        const parsed = JSON.parse(rawCfg);
        const normalized = this.normalizeConfig(parsed);
        if (parsed?.baseVoice !== normalized.baseVoice) {
          localStorage.setItem(VOICE_CONFIG_STORAGE_KEY, JSON.stringify(normalized));
        }
        return normalized;
      }
    } catch {}
    return { ...DEFAULT_JEREMY_IRONS_CONFIG };
  }

  private persistConfig(cfg: JeremyIronsConfig) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(VOICE_CONFIG_STORAGE_KEY, JSON.stringify(cfg));
    } catch {}
  }

  public getConfig(): JeremyIronsConfig {
    return { ...this.activeConfig };
  }

  public updateConfig(changes: Partial<JeremyIronsConfig>): JeremyIronsConfig {
    this.activeConfig = this.normalizeConfig({
      ...this.activeConfig,
      ...changes
    });
    if (changes.formantPresetName && JEREMY_IRONS_FORMANT_PRESETS[changes.formantPresetName]) {
      this.activeFormantPreset = changes.formantPresetName;
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(ACTIVE_FORMANT_PRESET_STORAGE_KEY, this.activeFormantPreset);
        } catch {}
      }
    }
    this.persistConfig(this.activeConfig);
    this.notify();
    return this.getConfig();
  }

  public resetConfig(): JeremyIronsConfig {
    this.activeFormantPreset = 'sovereign-gravitas';
    this.activeConfig = { ...DEFAULT_JEREMY_IRONS_CONFIG };
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(ACTIVE_FORMANT_PRESET_STORAGE_KEY, this.activeFormantPreset);
      } catch {}
    }
    this.persistConfig(this.activeConfig);
    this.notify();
    return this.getConfig();
  }

  public getFormantPreset(): string {
    return this.activeFormantPreset;
  }

  public setFormantPreset(presetKey: string): boolean {
    const preset = JEREMY_IRONS_FORMANT_PRESETS[presetKey];
    if (!preset) return false;
    this.activeFormantPreset = presetKey;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(ACTIVE_FORMANT_PRESET_STORAGE_KEY, presetKey);
      } catch {}
    }
    this.activeConfig = resolveMergedDSPConfig('Jeremy-Irons-Signature', presetKey, {
      baseVoice: this.activeConfig.baseVoice || CANONICAL_BASE_VOICE
    });
    this.persistConfig(this.activeConfig);
    void this.setActiveProfile('jeremy-irons-signature', true);
    return true;
  }

  /**
   * Idempotent startup handshake: ensures server voice profiles and browser speech voices
   * are ready before the first utterance is synthesized.
   */
  public initialize(): Promise<void> {
    if (this.isInitialized) return Promise.resolve();
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        await Promise.all([
          this.loadProfilesFromServer(),
          waitForSpeechVoices(600)
        ]);
      } finally {
        this.isInitialized = true;
      }
    })();

    return this.initPromise;
  }

  public async loadProfilesFromServer(): Promise<VoiceProfile[]> {
    try {
      const res = await fetch('/api/voice/profiles');
      if (res.ok) {
        const data = await res.json();
        if (data.profiles && Array.isArray(data.profiles)) {
          // Merge canonical profiles with custom profiles
          const custom = data.profiles.filter((p: VoiceProfile) => !CANONICAL_VOICE_PROFILES.some(c => c.id === p.id));
          this.profiles = [...CANONICAL_VOICE_PROFILES, ...custom];
          const savedLocalProfileId = typeof window !== 'undefined' ? localStorage.getItem('ZEREO_ACTIVE_VOICE_PROFILE_ID') : null;
          if (!savedLocalProfileId && data.activeProfileId && this.profiles.some(p => p.id === data.activeProfileId)) {
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

  private syncConfigFromProfile(profile: VoiceProfile) {
    const legacy = this.mapProfileIdToLegacy(profile.id);
    const meta = legacy ? VOICE_MODULATION_PROFILES[legacy] : undefined;
    const dsp = profile.dspConfig;
    const formants = dsp?.formants;
    const nextConfig: JeremyIronsConfig = {
      ...(meta?.config || DEFAULT_JEREMY_IRONS_CONFIG),
      baseVoice: profile.baseVoice || this.activeConfig.baseVoice || CANONICAL_BASE_VOICE,
      pitchRate: clampLowEPitchRate(dsp?.pitchMultiplier ?? meta?.config.pitchRate),
      gravelAmount: dsp?.gravelSaturation ?? meta?.config.gravelAmount ?? 0.42,
      chestResonanceDb: dsp?.chestResonanceDb ?? meta?.config.chestResonanceDb ?? 5.2,
      articulationDb: dsp?.articulationBoostDb ?? meta?.config.articulationDb ?? 1.6,
      speechRate: dsp?.speechRate ?? meta?.config.speechRate ?? 0.90,
      formantPresetName: dsp?.formantPresetName || meta?.config.formantPresetName || this.activeFormantPreset,
      f1Hz: formants?.f1Hz ?? meta?.config.f1Hz,
      f1GainDb: formants?.f1GainDb ?? meta?.config.f1GainDb,
      f2Hz: formants?.f2Hz ?? meta?.config.f2Hz,
      f2GainDb: formants?.f2GainDb ?? meta?.config.f2GainDb,
      f3Hz: formants?.f3Hz ?? meta?.config.f3Hz,
      f3GainDb: formants?.f3GainDb ?? meta?.config.f3GainDb,
      vocalTractLengthFactor: formants?.vocalTractLengthFactor ?? meta?.config.vocalTractLengthFactor
    };
    this.activeConfig = nextConfig;
    if (nextConfig.formantPresetName && JEREMY_IRONS_FORMANT_PRESETS[nextConfig.formantPresetName]) {
      this.activeFormantPreset = nextConfig.formantPresetName;
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(ACTIVE_FORMANT_PRESET_STORAGE_KEY, this.activeFormantPreset);
        } catch {}
      }
    }
    this.persistConfig(this.activeConfig);
  }

  public async setActiveProfile(profileId: string, skipConfigSync: boolean = false): Promise<boolean> {
    const found = this.profiles.find(p => p.id === profileId);
    if (!found) return false;

    this.activeProfileId = profileId;
    if (typeof window !== 'undefined') {
      localStorage.setItem('ZEREO_ACTIVE_VOICE_PROFILE_ID', profileId);
      // Reset voice cache lock so speech synthesis matches the new profile's voice parameters
      cachedVoiceLock = null;
    }

    if (!skipConfigSync) {
      this.syncConfigFromProfile(found);
    }

    this.notify();

    try {
      await fetch('/api/voice/profiles/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId })
      });
    } catch (_) {}

    return true;
  }

  public async saveProfile(profile: VoiceProfile): Promise<VoiceProfile> {
    const existingIndex = this.profiles.findIndex(p => p.id === profile.id);
    if (existingIndex >= 0) {
      this.profiles[existingIndex] = profile;
    } else {
      this.profiles.push(profile);
    }

    if (profile.id === this.activeProfileId) {
      this.syncConfigFromProfile(profile);
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
      this.activeProfileId = 'jeremy-irons-signature';
      const fallback = this.getActiveProfile();
      this.syncConfigFromProfile(fallback);
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

  private mapProfileIdToLegacy(profileId: string): VoiceModulationProfile {
    if (profileId === 'jeremy-irons-signature') return 'Jeremy-Irons-Signature';
    if (profileId === 'british-aristocrat') return 'Clinical-Analytical';
    if (profileId === 'tactical-commander') return 'Subtle-Steward';
    if (profileId === 'iron-adaptive') return 'Iron-Adaptive';
    return 'Jeremy-Irons-Signature';
  }

  public getLegacyProfile(): VoiceModulationProfile {
    return this.mapProfileIdToLegacy(this.getActiveProfile().id);
  }

  public subscribe(cb: (state: VoicePlaybackState) => void): () => void {
    this.subscribers.add(cb);
    cb({
      isSpeaking: this.isCurrentlySpeaking,
      text: this.activeText,
      profile: this.getActiveProfile(),
      profiles: [...this.profiles],
      legacyProfile: this.getLegacyProfile(),
      config: this.getConfig(),
      activeFormantPreset: this.activeFormantPreset
    });
    return () => this.subscribers.delete(cb);
  }

  private notify(currentChunk?: number, totalChunks?: number) {
    const profile = this.getActiveProfile();
    const legacyProfile = this.getLegacyProfile();
    const config = this.getConfig();
    const profiles = [...this.profiles];
    for (const sub of this.subscribers) {
      sub({
        isSpeaking: this.isCurrentlySpeaking,
        text: this.activeText,
        profile,
        profiles,
        legacyProfile,
        config,
        activeFormantPreset: this.activeFormantPreset,
        currentChunk,
        totalChunks
      });
    }
  }

  public getAudioContextState(): AudioContextState | 'uninitialized' {
    if (!this.activeCtx) return 'uninitialized';
    return this.activeCtx.state;
  }

  public async unlockAudio(): Promise<AudioContextState | 'uninitialized'> {
    if (typeof window === 'undefined') return 'uninitialized';
    try {
      if (!this.activeCtx || this.activeCtx.state === 'closed') {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtxClass) return 'uninitialized';
        this.activeCtx = new AudioCtxClass({ sampleRate: 24000 });
      }
      if ((this.activeCtx.state as string) === 'suspended' || (this.activeCtx.state as string) === 'interrupted') {
        await this.activeCtx.resume().catch(() => {});
      }
      // Play a silent 1-sample buffer inside user gesture so strict iframe/Safari autoplay policies unlock hardware output
      try {
        const silentBuf = this.activeCtx.createBuffer(1, 1, 24000);
        const silentSrc = this.activeCtx.createBufferSource();
        silentSrc.buffer = silentBuf;
        silentSrc.connect(this.activeCtx.destination);
        silentSrc.start(0);
      } catch (_) {}
      if ((this.activeCtx.state as string) === 'suspended') {
        await this.activeCtx.resume().catch(() => {});
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.getVoices();
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      }
      return this.activeCtx.state;
    } catch (_) {
      return this.activeCtx?.state || 'uninitialized';
    }
  }

  public stop() {
    this.playbackGenerationId++;
    if (this.chunkWatchdogTimer) {
      clearTimeout(this.chunkWatchdogTimer);
      this.chunkWatchdogTimer = null;
    }
    this.activeUtterances.clear();
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
   * Plays a single chunk via browser SpeechSynthesis.
   * Holds a strong reference in activeUtterances to prevent Chrome GC mid-speech cutoff
   * and uses generous rate-scaled watchdog timeout without pause()/resume() keepalives.
   */
  private speakChunkViaSpeechSynthesis(
    chunk: string,
    profile: VoiceProfile,
    genId: number,
    customConfig?: Partial<JeremyIronsConfig>
  ): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !window.speechSynthesis || genId !== this.playbackGenerationId) {
        return resolve();
      }

      const phoneticChunk = applyBritishProsodyAndPhonetics(chunk);
      const subChunks = splitIntoSentenceChunks(phoneticChunk, 180);
      const speakSub = async () => {
        // Yield briefly if browser SpeechSynthesis just received cancel() so the next speak() isn't swallowed
        if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
          await new Promise((r) => setTimeout(r, 50));
        }

        const voices = await waitForSpeechVoices(700);
        const chosenVoice = resolveJeremyIronsVoice(voices, profile.speechSynthesisConfig.preferredVoiceNames);

        if (!chosenVoice) {
          markTtsQuotaExhausted(
            'Cloud neural TTS quota reached and no verified male OS voice matched on this device; using system British fallback.',
            300
          );
        }

        for (const sub of subChunks) {
          if (genId !== this.playbackGenerationId) break;
          await new Promise<void>((subResolve) => {
            let settled = false;
            const finish = () => {
              if (settled) return;
              settled = true;
              if (this.chunkWatchdogTimer) {
                clearTimeout(this.chunkWatchdogTimer);
                this.chunkWatchdogTimer = null;
              }
              this.activeUtterances.delete(utterance);
              subResolve();
            };

            const utterance = new SpeechSynthesisUtterance(sub);
            this.activeUtterances.add(utterance);
            if (chosenVoice) {
              utterance.voice = chosenVoice;
              utterance.lang = chosenVoice.lang || 'en-GB';
            } else {
              utterance.lang = 'en-GB';
            }

            // Lock pitch tightly around Low E (~82.4 Hz) so SpeechSynthesis stays steady
            utterance.pitch = clampLowESpeechPitch(profile.speechSynthesisConfig.pitch, customConfig?.pitchRate);
            const rawRate = customConfig?.speechRate || profile.speechSynthesisConfig.rate || 0.86;
            const rate = Math.min(0.96, Math.max(0.78, rawRate));
            utterance.rate = rate;

            utterance.onend = finish;
            utterance.onerror = (e) => {
              if (e?.error !== 'interrupted' && e?.error !== 'canceled') {
                console.warn('Utterance error:', e);
              }
              finish();
            };

            // Rate-scaled watchdog with generous headroom prevents slow deliberate cadence from clipping mid-sentence
            const maxWaitMs = Math.max(12000, Math.ceil((sub.length / Math.max(0.5, rate)) * 140) + 4000);
            this.chunkWatchdogTimer = setTimeout(finish, maxWaitMs);

            try {
              if (window.speechSynthesis.paused) {
                window.speechSynthesis.resume();
              }
              window.speechSynthesis.speak(utterance);
            } catch {
              finish();
            }
          });
        }
        resolve();
      };

      void speakSub();
    });
  }

  /**
   * Sequential speech pipeline:
   * Pipelines Gemini Neural TTS across ALL sentence chunks (prefetching chunk i+1 while chunk i plays)
   * with seamless per-chunk SpeechSynthesis fallback so long responses never cut out after 1-2 sentences.
   */
  public async speak(
    rawText: string,
    customConfig?: VoiceSpeakOptions,
    onStart?: () => void,
    onEnded?: () => void
  ): Promise<boolean> {
    this.stop();

    const clean = sanitizeTextForJeremyIrons(rawText, false);
    if (!clean) return false;

    const currentGen = ++this.playbackGenerationId;

    // Unlock AudioContext immediately while user gesture activation is fresh, then ensure profiles/voices are initialized
    const unlockPromise = this.unlockAudio();
    await unlockPromise;
    await this.initialize();

    if (currentGen !== this.playbackGenerationId) return false;

    const activeProfile = this.getActiveProfile();
    this.activeText = clean;
    this.isCurrentlySpeaking = true;
    onStart?.();

    // Split into generous sentence-aligned chunks (~850 chars) to minimize quota usage and prevent mid-reply voice changes
    const chunks = splitIntoSentenceChunks(clean, 850);
    if (chunks.length === 0) chunks.push(clean);

    this.notify(1, chunks.length);

    try {
      const { stylePromptOverride, accentOverride, ...dspOverrides } = customConfig || {};
      const effectiveCfg: Partial<JeremyIronsConfig> = {
        ...this.activeConfig,
        ...dspOverrides
      };

      const stylePrompt = stylePromptOverride || activeProfile.systemPromptStyle;
      const targetAccent = accentOverride || activeProfile.accent;
      const requestedBase = (effectiveCfg.baseVoice || activeProfile.baseVoice) as string | undefined;
      const baseVoice: 'Charon' | 'Fenrir' | 'Orus' =
        requestedBase === 'Fenrir' || requestedBase === 'Orus' || requestedBase === 'Charon'
          ? requestedBase
          : CANONICAL_BASE_VOICE;

      // Prefetch chunk 0 immediately
      let nextBufferPromise: Promise<AudioBuffer | null> | null = generateTTS(
        chunks[0],
        baseVoice,
        stylePrompt,
        targetAccent
      ).catch(() => null);

      for (let i = 0; i < chunks.length; i++) {
        if (currentGen !== this.playbackGenerationId) break;
        this.notify(i + 1, chunks.length);

        const currentBufferPromise = nextBufferPromise;
        // Start prefetching chunk i+1 in parallel while chunk i decodes/plays
        if (i + 1 < chunks.length) {
          nextBufferPromise = generateTTS(
            chunks[i + 1],
            baseVoice,
            stylePrompt,
            targetAccent
          ).catch(() => null);
        } else {
          nextBufferPromise = null;
        }

        const audioBuffer = currentBufferPromise ? await currentBufferPromise : null;
        if (currentGen !== this.playbackGenerationId) break;

        let playedViaAudio = false;
        if (audioBuffer) {
          playedViaAudio = await this.playAudioBuffer(audioBuffer, activeProfile, effectiveCfg, currentGen);
        }

        if (!playedViaAudio && currentGen === this.playbackGenerationId) {
          await this.speakChunkViaSpeechSynthesis(chunks[i], activeProfile, currentGen, effectiveCfg);
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
      onEnded?.();
      return false;
    }
  }

  /**
   * Decodes and plays already-synthesized base64 audio (WAV/L16) through the Jeremy Irons DSP chain
   * without triggering a redundant /api/gemini/tts request.
   */
  public async playBase64Audio(
    base64Audio: string,
    customConfig?: Partial<JeremyIronsConfig>,
    onStart?: () => void,
    onEnded?: () => void,
    labelText: string = 'Auditioning synthesized neural voice'
  ): Promise<boolean> {
    if (!base64Audio) return false;
    this.stop();

    const currentGen = ++this.playbackGenerationId;

    await this.unlockAudio();
    await this.initialize();

    if (currentGen !== this.playbackGenerationId) return false;

    const activeProfile = this.getActiveProfile();
    this.activeText = labelText;
    this.isCurrentlySpeaking = true;
    onStart?.();
    this.notify(1, 1);

    try {
      if (!this.activeCtx || this.activeCtx.state === 'closed') {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        this.activeCtx = new AudioCtxClass({ sampleRate: 24000 });
      }
      if (this.activeCtx.state === 'suspended') {
        await this.activeCtx.resume().catch(() => {});
      }

      const audioBuffer = await decodeAudioData(
        decodeBase64(base64Audio),
        this.activeCtx,
        24000,
        1
      );
      if (currentGen !== this.playbackGenerationId) return false;

      const played = await this.playAudioBuffer(audioBuffer, activeProfile, customConfig, currentGen);
      if (currentGen === this.playbackGenerationId) {
        this.isCurrentlySpeaking = false;
        this.activeText = '';
        this.notify();
        onEnded?.();
      }
      return played;
    } catch (err) {
      console.warn('playBase64Audio error:', err);
      if (currentGen === this.playbackGenerationId) {
        this.isCurrentlySpeaking = false;
        this.activeText = '';
        this.notify();
        onEnded?.();
      }
      return false;
    }
  }

  private async playAudioBuffer(
    buffer: AudioBuffer, 
    profile: VoiceProfile,
    customConfig?: Partial<JeremyIronsConfig>,
    genId?: number
  ): Promise<boolean> {
    return new Promise(async (resolve) => {
      let settled = false;
      let fallbackTimer: any = null;
      let tailTimer: any = null;
      const finish = (didPlay: boolean) => {
        if (settled) return;
        settled = true;
        if (fallbackTimer) clearTimeout(fallbackTimer);
        if (tailTimer) clearTimeout(tailTimer);
        resolve(didPlay);
      };

      try {
        if (genId !== undefined && genId !== this.playbackGenerationId) {
          return finish(true);
        }
        if (!this.activeCtx || this.activeCtx.state === 'closed') {
          const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
          this.activeCtx = new AudioCtxClass({ sampleRate: 24000 });
        }
        if ((this.activeCtx.state as string) === 'suspended' || (this.activeCtx.state as string) === 'interrupted') {
          await this.activeCtx.resume().catch(() => {});
        }

        const ctx = this.activeCtx;
        // If browser autoplay policy kept AudioContext suspended, abort and allow SpeechSynthesis fallback
        if (ctx.state !== 'running') {
          console.warn('Voice DSP AudioContext remains suspended; deferring chunk to SpeechSynthesis.');
          return finish(false);
        }

        const formants = profile.dspConfig.formants;
        const config: JeremyIronsConfig = {
          baseVoice: profile.baseVoice || CANONICAL_BASE_VOICE,
          pitchRate: clampLowEPitchRate(profile.dspConfig.pitchMultiplier ?? LOW_E_TARGET_PITCH_RATE),
          gravelAmount: profile.dspConfig.gravelSaturation ?? 0.42,
          chestResonanceDb: profile.dspConfig.chestResonanceDb ?? 5.2,
          articulationDb: profile.dspConfig.articulationBoostDb ?? 1.6,
          speechRate: profile.dspConfig.speechRate ?? 0.90,
          formantPresetName: profile.dspConfig.formantPresetName || 'sovereign-gravitas',
          f1Hz: formants?.f1Hz ?? 375,
          f1GainDb: formants?.f1GainDb ?? 4.5,
          f2Hz: formants?.f2Hz ?? 1320,
          f2GainDb: formants?.f2GainDb ?? -2.8,
          f3Hz: formants?.f3Hz ?? 2640,
          f3GainDb: formants?.f3GainDb ?? 2.4,
          vocalTractLengthFactor: formants?.vocalTractLengthFactor ?? 1.14,
          ...customConfig
        };

        const dsp = buildJeremyIronsDSP(ctx, ctx.destination, config);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const rate = clampLowEPitchRate(config.pitchRate);
        source.playbackRate.value = rate;

        source.connect(dsp.inputNode);
        this.activeSource = source;

        const expectedMs = Math.max(1500, Math.ceil((buffer.duration / rate) * 1000) + 1500);
        fallbackTimer = setTimeout(() => {
          if (this.activeSource === source) {
            try { source.stop(); } catch {}
            this.activeSource = null;
          }
          finish(true);
        }, expectedMs);

        source.onended = () => {
          if (this.activeSource === source) {
            this.activeSource = null;
          }
          // Allow 65ms DSP compressor/formant release tail before starting next chunk so final syllables never clip
          if (genId !== undefined && genId !== this.playbackGenerationId) {
            finish(true);
          } else {
            tailTimer = setTimeout(() => finish(true), 65);
          }
        };

        source.start(0);
      } catch (e) {
        console.warn('AudioBuffer playback error:', e);
        finish(false);
      }
    });
  }

  public isSpeaking(): boolean {
    return this.isCurrentlySpeaking;
  }

  public getActiveText(): string {
    return this.activeText;
  }

  // Alias for VoiceModulationProfile
  public setProfile(profile: VoiceModulationProfile) {
    const idMap: Record<VoiceModulationProfile, string> = {
      'Jeremy-Irons-Signature': 'jeremy-irons-signature',
      'Iron-Adaptive': 'iron-adaptive',
      'Clinical-Analytical': 'british-aristocrat',
      'Subtle-Steward': 'tactical-commander'
    };
    const targetId = idMap[profile] || 'jeremy-irons-signature';
    void this.setActiveProfile(targetId);
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
      console.warn('SpeechRecognition error:', event?.error || event);
      handlers.onError?.(event?.error || event);
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

const TTS_ENABLED_STORAGE_KEY = 'ZEREO_TTS_ENABLED';

export function getTtsEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem(TTS_ENABLED_STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function setTtsEnabledPreference(enabled: boolean): boolean {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(TTS_ENABLED_STORAGE_KEY, String(enabled));
    } catch {}
    window.dispatchEvent(new CustomEvent('zereo:tts_toggle', { detail: { enabled } }));
  }
  return enabled;
}

export { voiceCloningEngine, CANONICAL_IRONS_TONAL_MODEL } from './voiceCloningEngineService';
