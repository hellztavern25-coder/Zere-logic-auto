
export enum AppTab {
  HOME = 'Home',
  CHAT = 'Chat',
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
  SNAPSHOT = 'Snapshot'
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

export interface VoiceDSPConfig {
  pitchMultiplier: number;
  speechRate: number;
  chestResonanceDb: number;
  thoracicWarmthDb: number;
  articulationBoostDb: number;
  gravelSaturation: number;
  antiBoxNotchDb: number;
  roomAmbience: number;
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
