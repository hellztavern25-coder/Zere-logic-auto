
export enum AppTab {
  HOME = 'Home',
  CHAT = 'Chat',
  FILES = 'Files',
  ASSISTANT = 'Assistant',
  CREATIVE = 'Creative',
  VOICE = 'Voice',
  VOICE_EMULATOR = 'VoiceEmulator',
  ANALYTICS = 'Analytics',
  GROUNDING = 'Grounding',
  MEMORY = 'Memory',
  NEXUS = 'Nexus',
  SHARE = 'Share',
  SYSTEM = 'System',
  WORKSHOP = 'Workshop',
  SNAPSHOT = 'Snapshot',
  ACOUSTIC_ROOM = 'AcousticRoom'
}

export type DaemonStatus = 'RUNNING' | 'PAUSED' | 'SWEEPING' | 'DISPATCHING' | 'IDLE';
export type DaemonTaskPriority = 'CRITICAL' | 'HIGH' | 'ROUTINE';
export type DaemonTaskCategory = 'SECURITY_SWEEP' | 'MEMORY_INDEX' | 'SITUATIONAL_BRIEFING' | 'DISCORD_DISPATCH' | 'SYSTEM_DIAGNOSTIC' | 'CUSTOM_DIRECTIVE';
export type DaemonTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export interface DaemonTask {
  id: string;
  title: string;
  description?: string;
  category: DaemonTaskCategory;
  priority: DaemonTaskPriority;
  status: DaemonTaskStatus;
  createdAt: number;
  completedAt?: number;
  result?: string;
  error?: string;
}

export interface DaemonLogEntry {
  id: string;
  timestamp: number;
  tag: 'SYS' | 'DAEMON' | 'TASK' | 'VIGILANCE' | 'DISPATCH' | 'WARN' | 'BRIEFING';
  message: string;
}

export interface DaemonCapabilities {
  autonomousVigilance: boolean;
  proactiveBriefings: boolean;
  memoryAutoGrooming: boolean;
  discordRelay: boolean;
  neuralWatchdog: boolean;
}

export interface DaemonState {
  status: DaemonStatus;
  uptimeSeconds: number;
  tickCount: number;
  lastTickAt: number;
  lastSweepAt: number;
  tasksCompleted: number;
  tasksFailed: number;
  capabilities: DaemonCapabilities;
  currentTask: DaemonTask | null;
  tasks: DaemonTask[];
  latestBriefing: { text: string; timestamp: number } | null;
  urgencyScore: number;
  memoryHealthScore: number;
}

export enum GeminiModel {
  FLASH_38 = 'gemini-3.8-flash',
  FLASH_36 = 'gemini-3.8-flash', // Stable alias for legacy 3.6 calls to prevent 503 errors
  FLASH_PREVIEW = 'gemini-3.8-flash',
  PRO_PREVIEW = 'gemini-3.1-pro-preview',
  FLASH_LITE = 'gemini-3.1-flash-lite',
  FLASH_IMAGE = 'gemini-3.1-flash-image',
  PRO_IMAGE_PREVIEW = 'gemini-3-pro-image',
  FLASH_TTS = 'gemini-3.1-flash-tts-preview',
  FLASH_LIVE = 'gemini-3.1-flash-live-preview',
  VEO_FAST = 'veo-3.1-lite-generate-preview',
  VEO_QUALITY = 'veo-3.1-generate-preview',
  FLASH_25 = 'gemini-3.8-flash'
}

export type EmotionalPrimaryState = 
  | 'TACTICAL_DRIVE' 
  | 'COGNITIVE_FRICTION' 
  | 'FORGE_HEAT' 
  | 'DEFENSIVE_VIGILANCE' 
  | 'SARDONIC_EASE' 
  | 'STRATEGIC_CALM';

export type ReciprocationVector = 
  | 'SHIELD_AND_SHOULDER' 
  | 'MASS_ON_MASS' 
  | 'SARDONIC_NUDGE' 
  | 'TACTICAL_ALIGNMENT' 
  | 'PROTECTIVE_SENTRY';

export interface EmotionalMap {
  id: string;
  timestamp: number;
  speaker: string; // 'Preston Johnston (Council Grey)' | 'Danielle' | 'Ali' | 'System'
  primaryState: EmotionalPrimaryState;
  confidence: number; // 0 - 100%
  needVsWant: {
    needScore: number; // 0 - 100%
    wantScore: number; // 0 - 100%
    assessment: string;
  };
  fearVsPain: {
    fearScore: number; // 0 - 100% (threat vigilance)
    painScore: number; // 0 - 100% (forge endurance fatigue)
    assessment: string;
  };
  frictionHeatScore: number; // 0 - 100% (environmental entropy index)
  reciprocationVector: ReciprocationVector;
  reciprocationDirective: string;
  stewardLogicalAffect: {
    stateName: string;
    intensity: number; // 0 - 100%
    nudgeAndSmile: boolean; // whether a nudge and smile is strategically warranted
    internalMonologue?: string;
  };
  rationale: string;
}

export type KnowledgeCategory = 
  | 'DOCTRINE' 
  | 'ALLIES' 
  | 'NEURAL_ENGINES' 
  | 'LOGIC_TIERS' 
  | 'TACTICAL_TOOLS' 
  | 'EMOTIONAL_RECIPROCATION' 
  | 'VOICE_DSP';

export interface KnowledgeOfUseItem {
  id: string;
  category: KnowledgeCategory;
  title: string;
  syntaxOrTrigger: string;
  operationalUse: string;
  reciprocationProfile: string;
  readinessStatus: 'ACTIVE' | 'PRIMED' | 'STANDBY';
  badge: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  groundingUrls?: Array<{ uri: string; title: string }>;
  isThinking?: boolean;
  isProactive?: boolean;
  isDoorman?: boolean;
  imageData?: string;
  imageMime?: string;
  generatedArt?: {
    prompt: string;
    imageUrl: string;
    title?: string;
    aspectRatio?: string;
    style?: string;
  };
  emotionalMap?: EmotionalMap;
}

export interface ChatThread {
  id: string;
  title: string;
  messages: ChatMessage[];
  timestamp: number;
  avatarUrl?: string;
}

export interface GroundingChunk {
  web?: { uri: string; title: string };
  maps?: { uri: string; title: string };
}

export type VisualCaptureSource = 'creative_session' | 'screen_snapshot' | 'neural_optical' | 'user_upload';

export interface VisualCapture {
  id: string;
  title: string;
  description?: string;
  imageUrl: string;
  source: VisualCaptureSource;
  metadata?: {
    prompt?: string;
    aspectRatio?: string;
    model?: string;
    resolution?: string;
    mode?: string;
    tags?: string[];
    anomalies?: string[];
    confidence?: number;
    dimensions?: { width: number; height: number };
  };
  timestamp: string | number;
}

export type VoiceAccentType = 
  | 'british_aristocrat' 
  | 'british_rp' 
  | 'british_cockney' 
  | 'american_baritone' 
  | 'scottish' 
  | 'custom';

export interface VoiceClip {
  id: string;
  name: string;
  transcription?: string;
  audioUrl?: string;
  audioBase64?: string;
  durationSeconds: number;
  uploadedAt: number;
  source: 'upload' | 'recorded' | 'canonical_preset';
  mimeType?: string;
}

export interface FormantShiftPreset {
  f1Hz: number;
  f1GainDb: number;
  f2Hz: number;
  f2GainDb: number;
  f3Hz: number;
  f3GainDb: number;
  vocalTractLengthFactor: number;
  description?: string;
}

export interface VoiceDSPConfig {
  pitchMultiplier: number;
  speechRate: number;
  chestResonanceDb: number;
  thoracicWarmthDb: number;
  articulationBoostDb: number;
  gravelSaturation: number;
  antiBoxNotchDb: number;
  roomAmbience: number;
  formantPresetName?: string;
  formants?: FormantShiftPreset;
}

export interface VoiceProfile {
  id: string;
  name: string;
  tagline?: string;
  description: string;
  accent: VoiceAccentType;
  isCanonical?: boolean;
  isDefault?: boolean;
  badge?: string;
  accentColor?: string;
  clips: VoiceClip[];
  dspConfig: VoiceDSPConfig;
  speechSynthesisConfig: {
    pitch: number;
    rate: number;
    priorityLocales: string[];
    preferredVoiceNames: string[];
  };
  systemPromptStyle?: string;
  auditionSample?: string;
}

export interface AcousticFeatureExtraction {
  fundamentalF0Hz: number;
  pitchVariance: number;
  f0Confidence: number;
  jitterPercent: number;
  shimmerPercent: number;
  harmonicsToNoiseRatioDb: number;
  gravelSaturation: number;
  formants: {
    f1Hz: number;
    f2Hz: number;
    f3Hz: number;
  };
  spectralCentroidHz: number;
  spectralTiltDb: number;
  chestResonanceDb: number;
  warmthDb: number;
  articulationDb: number;
}

export interface ProsodyExtraction {
  speechRateWpm: number;
  cadenceMultiplier: number;
  pauseToSpeechRatio: number;
  averageClausePauseMs: number;
  elocutionCrispness: number;
  drawlCoefficient: number;
}

export interface STTAnalysisResult {
  rawTranscript: string;
  confidence: number;
  wordCount: number;
  phoneticTransliteration?: string;
  detectedAccent: VoiceAccentType;
  keyPhonemesDetected: string[];
  elocutionNotes: string[];
}

export interface PersistentTonalModel {
  id: string;
  name: string;
  tagline: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  sourceClipIds: string[];
  sourceClipNames: string[];
  sttAnalysis: STTAnalysisResult;
  acousticDNA: AcousticFeatureExtraction;
  prosodyDNA: ProsodyExtraction;
  systemPromptStyle: string;
  dspConfig: VoiceDSPConfig;
  speechSynthesisConfig: {
    pitch: number;
    rate: number;
    preferredVoiceNames: string[];
    priorityLocales: string[];
  };
  isActive: boolean;
  tonalIntensity?: number;
  cloningEngineVersion: string;
  spectralFingerprint?: number[];
}

export type PresetPersonaType = 
  | 'alfred_pennyworth' 
  | 'theatrical_menace' 
  | 'subtle_steward' 
  | 'tactical_command' 
  | 'oxford_dignitary' 
  | 'custom_iron';

export interface VoiceTonalPreset {
  id: string;
  name: string; // e.g. 'Iron-Adaptive-V1'
  codeName: string; // e.g. 'IRON-ADAPTIVE-V1'
  tagline: string;
  description: string;
  targetPersona: PresetPersonaType;
  tonalIntensity: number; // 0.2 to 2.0 (1.0 = Canonical)
  sourceModelId?: string;
  sourceModelName?: string;
  dspConfig: VoiceDSPConfig;
  systemPromptDirective: string;
  speechSynthesisConfig: {
    pitch: number;
    rate: number;
    preferredVoiceNames: string[];
    priorityLocales: string[];
  };
  tags: string[];
  isBuiltin?: boolean;
  isFavorite?: boolean;
  createdAt: number;
  updatedAt: number;
  metadata?: {
    author?: string;
    version?: string;
    gravitasLevel?: string;
    elocutionNotes?: string[];
    recommendedContext?: string;
    customNotes?: string;
  };
}

export type VaultFileType = 'word' | 'audio' | 'video' | 'image' | 'pdf' | 'text' | 'archive' | 'other';

export interface VaultFileItem {
  id: string;
  name: string;
  size: number;
  type: VaultFileType;
  mimeType: string;
  dataUrl?: string;
  blob?: Blob;
  textContent?: string;
  htmlContent?: string;
  wordCount?: number;
  duration?: number;
  resolution?: { width: number; height: number };
  createdAt: number;
  updatedAt: number;
  tags: string[];
  isPreloaded?: boolean;
  analysisNotes?: string;
  classification?: 'TOP SECRET / PRINCIPAL EYES ONLY' | 'OPERATIONAL INTEL' | 'ACOUSTIC INTERCEPT' | 'SURVEILLANCE TELEMETRY' | 'RESTRICTED';
}

// -------------------------------------------------------------
// TONAL SCALE ROOM, INVARIANT FLASHCARDS & 60-BIT RECIPE TYPES
// -------------------------------------------------------------

export type ScaleSyllable = 'Do' | 'Re' | 'Mi' | 'Fa' | 'So' | 'La' | 'Ti';

export interface RoomCoordinate {
  note: string; // e.g. 'F4', 'A4', 'E4'
  pitchClass: 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';
  octave: number;
  fundamentalHz: number; // e.g. 349.23 for F4, 440.00 for A4
  syllable: ScaleSyllable; // 'Fa', 'La', 'Mi', etc.
  ratioFromA4: number; // e.g. 1.0 for A4, 1.5 for E4 (3:2)
  pythagoreanSteps: number; // fifths from reference
  isAnchor: boolean; // true for A and E (or F)
}

export interface AcousticTimbreFingerprint {
  instrumentName: string;
  sourceRecord: string;
  artistOrEnsemble: string;
  recordingYear?: number;
  genre: string;
  harmonicAmplitudes: number[]; // relative strength of H1, H2, H3, ... H8
  spectralCentroidHz: number;
  formants: {
    f1: number;
    f2: number;
    f3: number;
  };
  attackTimeMs: number;
  decayTimeMs: number;
  sustainLevel: number;
  releaseTimeMs: number;
  gravelOrAirNoise: number; // 0.0 - 1.0
  description: string;
}

export interface NoteFlashcard {
  id: string;
  targetPitch: string; // e.g. 'F4' or 'F3'
  invariantHz: number; // e.g. 349.23
  sourceRecord: string;
  sourceArtist: string;
  genre: string;
  year?: number;
  timbreProfile: AcousticTimbreFingerprint;
  isolatedInvariantConfidence: number; // e.g. 99.8%
  status: 'MASTERED' | 'TRAINING' | 'INVARIANT_LOCKED';
  timesAudited: number;
  notes: string;
}

export interface SixtyBitScoreToken {
  pitchClassIdx: number; // 0-11 (4 bits)
  octave: number; // 1-7 (3 bits)
  durationMs: number; // 10ms - 4000ms (10 bits)
  velocity: number; // 0-31 (5 bits)
  timbrePresetId: number; // 0-63 (6 bits)
  formantShapeIdx: number; // 0-15 (4 bits)
  transientBite: number; // 0-7 (3 bits)
  lyricPhoneme?: string; // compressed phonetic token
  calculatedBits: number; // ~60 bits total
}

export interface RecipePerformancePiece {
  id: string;
  title: string;
  composerOrOrigin: string;
  totalTokens: number;
  rawPcmSizeKb: number; // Size if stored as uncompressed WAV
  pinPrickRecipeSizeBits: number; // Size stored as 60-bit recipe
  compressionRatio: number; // e.g. 21,500 : 1
  tokens: SixtyBitScoreToken[];
}

export interface ClosedLoopEarAudit {
  isListening: boolean;
  detectedPitchHz: number | null;
  nearestNote: string | null;
  centsCentsOffset: number | null;
  confidence: number;
  timbreMatchScore: number; // 0 - 100% match with Jeremy Irons target
  targetFormants: { f1: number; f2: number; f3: number };
  detectedFormants: { f1: number; f2: number; f3: number };
  auditStatus: 'CALIBRATING' | 'LOCK_OPTIMAL' | 'DEVIATION_HIGH' | 'IDLE';
}

// -------------------------------------------------------------
// 6. ANCHOR ENGINE & PITCH FIELD INTERPOLATION
// -------------------------------------------------------------

export interface AnchorOctaveValue {
  note: string; // e.g. 'A0' to 'A8', 'E0' to 'E8'
  pitchClass: 'A' | 'E';
  octave: number; // 0 to 8
  justIntonationHz: number; // Pure 3:2 ratio from A4
  equalTemperamentHz: number; // Standard 12-TET
  centsDeviation: number; // Difference in cents (Pythagorean comma)
  wavelengthMeters: number; // Speed of sound (343 m/s) / frequency
  periodMs: number; // 1000 / frequency
  ratioFromA4: number; // Frequency / A4
}

export interface PitchFieldInterpolationResult {
  targetInput: string | number;
  targetFrequencyHz: number;
  nearestNote: string;
  lowerAnchor: AnchorOctaveValue;
  upperAnchor: AnchorOctaveValue;
  interpolationWeight: number; // t in [0, 1] logarithmic
  octaveSpan: number;
  centsFromLower: number;
  centsFromUpper: number;
  pythagoreanGenerator: {
    alphaFifths: number;
    betaOctaves: number;
    derivedHz: number;
    deviationCents: number;
  };
  derivationFormula: string;
}

export interface InstrumentArchetype {
  id: string;
  name: string;
  category: string;
  sourceOrigin: string;
  harmonicAmplitudes: number[]; // 8 harmonics relative to fundamental
  formants: { f1: number; f2: number; f3: number };
  envelope: {
    attackMs: number;
    decayMs: number;
    sustainLevel: number;
    releaseMs: number;
  };
  airGravelNoise: number;
  description: string;
}

export interface DerivedInstrumentTone {
  archetypeId: string;
  archetypeName: string;
  category: string;
  targetFrequencyHz: number;
  targetNote: string;
  interpolationCoordinates: PitchFieldInterpolationResult;
  harmonicSeries: Array<{
    harmonic: number;
    frequencyHz: number;
    relativeAmplitude: number;
  }>;
  formants: { f1: number; f2: number; f3: number };
  envelope: {
    attackMs: number;
    decayMs: number;
    sustainLevel: number;
    releaseMs: number;
  };
  airGravelNoise: number;
  recipeBits: number;
  acousticDescription: string;
}

export interface AnchorEngineLedger {
  version: string;
  timestamp: number;
  baseA4Hz: number;
  justFifthRatio: number;
  aOctaves: AnchorOctaveValue[];
  eOctaves: AnchorOctaveValue[];
  interleavedSequence: AnchorOctaveValue[];
  lastAuditTimestamp: number;
  status: 'CALIBRATED' | 'SYNCHRONIZED';
}


