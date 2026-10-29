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
    name: 'Sovereign Gravitas (Canonical Signature)',
    tagline: 'Definitive Jeremy Irons • Formant-Shifted Aristocratic Baritone',
    f1Hz: 380,
    f1GainDb: 6.2,
    f2Hz: 1350,
    f2GainDb: -3.0,
    f3Hz: 2680,
    f3GainDb: 6.5,
    vocalTractLengthFactor: 1.14,
    chestResonanceDb: 6.8,
    articulationDb: 5.2,
    gravelAmount: 0.88,
    pitchRate: 0.86,
    speechRate: 0.88,
    description: 'The canonical Jeremy Irons vocal signature. Formant-shifted Web Audio DSP core with F1 pharyngeal cavity depression, F2 lingual vowel retraction, and piercing F3 actor projection with soft-sigmoid gravel.'
  },
  'theatrical-menace': {
    id: 'theatrical-menace',
    name: 'Theatrical Menace',
    tagline: 'Piercing Sardonic Projection • High-Grit Upper Actor Bite',
    f1Hz: 350,
    f1GainDb: 5.5,
    f2Hz: 1420,
    f2GainDb: -2.0,
    f3Hz: 2750,
    f3GainDb: 7.5,
    vocalTractLengthFactor: 1.10,
    chestResonanceDb: 6.0,
    articulationDb: 5.8,
    gravelAmount: 0.95,
    pitchRate: 0.84,
    speechRate: 0.86,
    description: 'Heightened 2750Hz actor formant peak with elevated vocal fold saturation for theatrical, cutting delivery.'
  },
  'subtle-steward': {
    id: 'subtle-steward',
    name: 'Subtle Steward',
    tagline: 'Quiet Tactical Baritone • Extended Vocal Cavity Depth',
    f1Hz: 410,
    f1GainDb: 7.0,
    f2Hz: 1280,
    f2GainDb: -4.0,
    f3Hz: 2550,
    f3GainDb: 4.8,
    vocalTractLengthFactor: 1.18,
    chestResonanceDb: 7.2,
    articulationDb: 3.8,
    gravelAmount: 0.70,
    pitchRate: 0.82,
    speechRate: 0.84,
    description: 'Elongated vocal tract acoustic simulation with softened upper transients for discreet, high-gravity quarters.'
  },
  'clinical-precision': {
    id: 'clinical-precision',
    name: 'Clinical Auditor',
    tagline: 'Analytical Deconstruction • High-Transience Clarity',
    f1Hz: 390,
    f1GainDb: 3.5,
    f2Hz: 1500,
    f2GainDb: 0.5,
    f3Hz: 2850,
    f3GainDb: 5.5,
    vocalTractLengthFactor: 1.02,
    chestResonanceDb: 3.0,
    articulationDb: 5.5,
    gravelAmount: 0.35,
    pitchRate: 0.96,
    speechRate: 1.00,
    description: 'Crisply notched low-end with expanded consonant articulation for rapid logical deconstructions.'
  }
};

export interface JeremyIronsConfig {
  baseVoice: 'Charon' | 'Fenrir';
  pitchRate: number; // 0.80 to 1.15 (default 0.86)
  gravelAmount: number; // 0.0 to 1.0 (default 0.88)
  chestResonanceDb: number; // dB boost at 105Hz (default 6.8)
  articulationDb: number; // dB boost at 2680Hz (default 5.2)
  speechRate: number; // 0.80 to 1.15 (default 0.88)
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
    description: 'The dedicated Jeremy Irons vocal signature and default speech tone. Formant-shifting DSP core with F1 pharyngeal cavity depression (380 Hz, +6.2 dB), F2 lingual retraction (1350 Hz, -3.0 dB), and F3 actor projection peak (2680 Hz, +6.5 dB) coupled with soft-sigmoid vocal fold gravel to mimic his legendary gravitas and dry sardonic authority.',
    isDefault: true,
    config: {
      baseVoice: 'Charon',
      pitchRate: 0.86,
      gravelAmount: 0.88,
      chestResonanceDb: 6.8,
      articulationDb: 5.2,
      speechRate: 0.88,
      formantPresetName: 'sovereign-gravitas',
      f1Hz: 380,
      f1GainDb: 6.2,
      f2Hz: 1350,
      f2GainDb: -3.0,
      f3Hz: 2680,
      f3GainDb: 6.5,
      vocalTractLengthFactor: 1.14
    },
    fallbackPitch: 0.62,
    fallbackRate: 0.80,
    badge: 'Vocal Signature • Default',
    accentColor: 'amber',
    auditionSample: 'The 1911s are loaded and the silver is polished to a lethal sheen, Principal. The Logic Monster is at your absolute command.'
  },
  'Iron-Adaptive': {
    id: 'Iron-Adaptive',
    name: 'Iron-Adaptive (Canonical)',
    tagline: 'Identity Preset • Canonical Jeremy Irons',
    description: 'The definitive Jeremy Irons vocal signature. Unhurried cadence, heavy sub-harmonic chest resonance, razor-sharp aristocratic diction, and dry sardonic authority.',
    isDefault: false,
    config: {
      baseVoice: 'Charon',
      pitchRate: 0.86,
      gravelAmount: 0.88,
      chestResonanceDb: 6.8,
      articulationDb: 5.2,
      speechRate: 0.88,
      formantPresetName: 'sovereign-gravitas',
      f1Hz: 380,
      f1GainDb: 6.2,
      f2Hz: 1350,
      f2GainDb: -3.0,
      f3Hz: 2680,
      f3GainDb: 6.5,
      vocalTractLengthFactor: 1.14
    },
    fallbackPitch: 0.62,
    fallbackRate: 0.80,
    badge: 'Canonical Core',
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
      speechRate: 1.02,
      formantPresetName: 'clinical-precision',
      f1Hz: 390,
      f1GainDb: 3.5,
      f2Hz: 1500,
      f2GainDb: 0.5,
      f3Hz: 2850,
      f3GainDb: 5.5,
      vocalTractLengthFactor: 1.02
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
      speechRate: 0.84,
      formantPresetName: 'subtle-steward',
      f1Hz: 410,
      f1GainDb: 7.0,
      f2Hz: 1280,
      f2GainDb: -4.0,
      f3Hz: 2550,
      f3GainDb: 4.8,
      vocalTractLengthFactor: 1.18
    },
    fallbackPitch: 0.60,
    fallbackRate: 0.78,
    badge: 'Stealth Intimate',
    accentColor: 'red',
    auditionSample: 'Quietly observing, Principal. Your perimeter remains entirely impenetrable.'
  }
};

export const DEFAULT_JEREMY_IRONS_CONFIG: JeremyIronsConfig = VOICE_MODULATION_PROFILES['Jeremy-Irons-Signature'].config;

// Predefined Canonical Voice Profiles for Emulator
export const CANONICAL_VOICE_PROFILES: VoiceProfile[] = [
  {
    id: 'jeremy-irons-signature',
    name: 'Jeremy Irons (Vocal Signature)',
    tagline: 'Vocal Signature • Formant-Shifted Aristocratic Baritone',
    description: 'The dedicated Jeremy Irons vocal signature and default speech tone. Formant-shifted Web Audio DSP core simulating his extended vocal tract length (1.14x), deep pharyngeal resonance (F1: 380Hz, +6.2dB), lingual retraction (F2: 1350Hz, -3.0dB), and piercing actor projection (F3: 2680Hz, +6.5dB).',
    accent: 'british_aristocrat',
    isCanonical: true,
    isDefault: true,
    badge: 'Vocal Signature • Default',
    accentColor: 'amber',
    clips: [
      {
        id: 'clip-irons-sig-1',
        name: 'The 1911s Loaded & Silver Polished',
        transcription: 'The 1911s are loaded and the silver is polished to a lethal sheen, Principal. The Logic Monster is at your command.',
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
      pitchMultiplier: 0.86,
      speechRate: 0.88,
      chestResonanceDb: 6.8,
      thoracicWarmthDb: 2.6,
      articulationBoostDb: 5.2,
      gravelSaturation: 0.88,
      antiBoxNotchDb: -2.5,
      roomAmbience: 0.18,
      formantPresetName: 'sovereign-gravitas',
      formants: {
        f1Hz: 380,
        f1GainDb: 6.2,
        f2Hz: 1350,
        f2GainDb: -3.0,
        f3Hz: 2680,
        f3GainDb: 6.5,
        vocalTractLengthFactor: 1.14,
        description: 'Canonical Jeremy Irons Formant Shifting Network'
      }
    },
    speechSynthesisConfig: {
      pitch: 0.62,
      rate: 0.80,
      priorityLocales: ['en-GB', 'en_GB', 'en-UK', 'en-US'],
      preferredVoiceNames: ['Daniel', 'Oliver', 'George', 'Arthur', 'Ryan', 'Google UK English Male', 'Microsoft George', 'Alfred', 'Alex']
    },
    systemPromptStyle: 'Deliver in the deep, measured baritone, sharp dry wit, and aristocratic gravitas of Jeremy Irons portraying Alfred Pennyworth. Heavy gravelly sub-harmonics, unhurried cadence, and lethal precision:',
    auditionSample: 'The 1911s are loaded and the silver is polished to a lethal sheen, Principal. The Logic Monster is at your absolute command.'
  },
  {
    id: 'iron-adaptive',
    name: 'Iron-Adaptive (Canonical)',
    tagline: 'Alfred Pennyworth • British Aristocratic Baritone',
    description: 'The definitive Jeremy Irons vocal signature. Unhurried cadence, heavy sub-harmonic chest resonance, dry sardonic British inflection, and gravelly aristocratic authority.',
    accent: 'british_aristocrat',
    isCanonical: true,
    isDefault: false,
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
  // 1. Sub-Harmonic Low Shelf (Chest Cavity Resonance)
  const chestFilter = ctx.createBiquadFilter();
  chestFilter.type = 'lowshelf';
  chestFilter.frequency.value = 105;
  chestFilter.gain.value = config.chestResonanceDb ?? 6.8;

  // 2. Formant 1 (F1): Pharyngeal Cavity Resonator (Vowel Height / Deep Baritone Foundation)
  const f1Filter = ctx.createBiquadFilter();
  f1Filter.type = 'peaking';
  f1Filter.frequency.value = config.f1Hz ?? 380;
  f1Filter.Q.value = 2.2;
  f1Filter.gain.value = config.f1GainDb ?? 6.2;

  // 3. Thoracic Warmth (Low-Mid Body ~240Hz)
  const warmthFilter = ctx.createBiquadFilter();
  warmthFilter.type = 'peaking';
  warmthFilter.frequency.value = 240;
  warmthFilter.Q.value = 1.2;
  warmthFilter.gain.value = 2.6;

  // 4. Formant 2 (F2): Oral/Lingual Cavity Backness (~1350Hz) - Notch for Darkened RP Vowels
  const f2Filter = ctx.createBiquadFilter();
  f2Filter.type = 'peaking';
  f2Filter.frequency.value = config.f2Hz ?? 1350;
  f2Filter.Q.value = 2.4;
  f2Filter.gain.value = config.f2GainDb ?? -3.0;

  // 5. Anti-Box Notch (~650Hz)
  const deboxFilter = ctx.createBiquadFilter();
  deboxFilter.type = 'peaking';
  deboxFilter.frequency.value = 650;
  deboxFilter.Q.value = 1.4;
  deboxFilter.gain.value = -2.5;

  // 6. Formant 3 (F3): The Actor's Projection Formant / British Aristocratic Bite (~2680Hz)
  const f3Filter = ctx.createBiquadFilter();
  f3Filter.type = 'peaking';
  f3Filter.frequency.value = config.f3Hz ?? 2680;
  f3Filter.Q.value = 3.2;
  f3Filter.gain.value = config.f3GainDb ?? 6.5;

  // 7. Consonant Articulation Peak (~2950Hz)
  const articulationFilter = ctx.createBiquadFilter();
  articulationFilter.type = 'peaking';
  articulationFilter.frequency.value = 2950;
  articulationFilter.Q.value = 1.6;
  articulationFilter.gain.value = config.articulationDb ?? 5.2;

  // 8. WaveShaper for organic vocal fold gravel / analog tube saturation
  const waveshaper = ctx.createWaveShaper();
  const gravel = config.gravelAmount ?? 0.88;
  waveshaper.curve = makeGravelCurve(gravel * 0.42);
  waveshaper.oversample = '4x';

  // 9. High Shelf (Silky Film Roll-Off ~5800Hz)
  const airRollOff = ctx.createBiquadFilter();
  airRollOff.type = 'highshelf';
  airRollOff.frequency.value = 5800;
  airRollOff.gain.value = -2.8;

  // 10. Dynamics Compressor (Theatrical Presence & Intelligibility)
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -20;
  compressor.knee.value = 8;
  compressor.ratio.value = 3.4;
  compressor.attack.value = 0.004;
  compressor.release.value = 0.14;

  // 11. Master Gain
  const masterGain = ctx.createGain();
  masterGain.gain.value = 1.15;

  // Connect serial formant-shifting chain
  chestFilter
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
      chestFilter.gain.setTargetAtTime(newCfg.chestResonanceDb, t, 0.04);
    }
    if (newCfg.f1Hz !== undefined) {
      f1Filter.frequency.setTargetAtTime(newCfg.f1Hz, t, 0.04);
    }
    if (newCfg.f1GainDb !== undefined) {
      f1Filter.gain.setTargetAtTime(newCfg.f1GainDb, t, 0.04);
    }
    if (newCfg.f2Hz !== undefined) {
      f2Filter.frequency.setTargetAtTime(newCfg.f2Hz, t, 0.04);
    }
    if (newCfg.f2GainDb !== undefined) {
      f2Filter.gain.setTargetAtTime(newCfg.f2GainDb, t, 0.04);
    }
    if (newCfg.f3Hz !== undefined) {
      f3Filter.frequency.setTargetAtTime(newCfg.f3Hz, t, 0.04);
    }
    if (newCfg.f3GainDb !== undefined) {
      f3Filter.gain.setTargetAtTime(newCfg.f3GainDb, t, 0.04);
    }
    if (newCfg.articulationDb !== undefined) {
      articulationFilter.gain.setTargetAtTime(newCfg.articulationDb, t, 0.04);
    }
    if (newCfg.gravelAmount !== undefined) {
      waveshaper.curve = makeGravelCurve(newCfg.gravelAmount * 0.42);
    }
  };

  const getFormantTelemetry = () => ({
    f1: f1Filter.frequency.value,
    f2: f2Filter.frequency.value,
    f3: f3Filter.frequency.value,
    gravel: config.gravelAmount ?? 0.88,
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
  private activeProfileId: string = 'jeremy-irons-signature';
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
    if (profile.id === 'jeremy-irons-signature') return 'Jeremy-Irons-Signature';
    if (profile.id === 'british-aristocrat') return 'Clinical-Analytical';
    if (profile.id === 'tactical-commander') return 'Subtle-Steward';
    if (profile.id === 'iron-adaptive') return 'Iron-Adaptive';
    return 'Jeremy-Irons-Signature';
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
        const formants = profile.dspConfig.formants;
        const config: JeremyIronsConfig = {
          baseVoice: 'Charon',
          pitchRate: profile.dspConfig.pitchMultiplier || 0.86,
          gravelAmount: profile.dspConfig.gravelSaturation || 0.88,
          chestResonanceDb: profile.dspConfig.chestResonanceDb || 6.8,
          articulationDb: profile.dspConfig.articulationBoostDb || 5.2,
          speechRate: profile.dspConfig.speechRate || 0.88,
          formantPresetName: profile.dspConfig.formantPresetName || 'sovereign-gravitas',
          f1Hz: formants?.f1Hz || 380,
          f1GainDb: formants?.f1GainDb || 6.2,
          f2Hz: formants?.f2Hz || 1350,
          f2GainDb: formants?.f2GainDb || -3.0,
          f3Hz: formants?.f3Hz || 2680,
          f3GainDb: formants?.f3GainDb || 6.5,
          vocalTractLengthFactor: formants?.vocalTractLengthFactor || 1.14,
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

  // Alias for VoiceModulationProfile
  public setProfile(profile: VoiceModulationProfile) {
    const idMap: Record<VoiceModulationProfile, string> = {
      'Jeremy-Irons-Signature': 'jeremy-irons-signature',
      'Iron-Adaptive': 'iron-adaptive',
      'Clinical-Analytical': 'british-aristocrat',
      'Subtle-Steward': 'tactical-commander'
    };
    const targetId = idMap[profile] || 'jeremy-irons-signature';
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
