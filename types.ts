
export enum AppTab {
  HOME = 'Home',
  CHAT = 'Chat',
  CREATIVE = 'Creative',
  VOICE = 'Voice',
  ANALYTICS = 'Analytics',
  GROUNDING = 'Grounding',
  MEMORY = 'Memory',
  NEXUS = 'Nexus',
  SHARE = 'Share',
  SYSTEM = 'System',
  WORKSHOP = 'Workshop',
  SNAPSHOT = 'Snapshot'
}

export enum GeminiModel {
  FLASH_36 = 'gemini-3.6-flash',
  FLASH_PREVIEW = 'gemini-3.6-flash',
  PRO_PREVIEW = 'gemini-3.1-pro-preview',
  FLASH_LITE = 'gemini-3.1-flash-lite-preview',
  FLASH_IMAGE = 'gemini-2.5-flash-image',
  PRO_IMAGE_PREVIEW = 'gemini-3-pro-image-preview',
  FLASH_TTS = 'gemini-3.1-flash-tts-preview',
  FLASH_LIVE = 'gemini-3.1-flash-live-preview',
  VEO_FAST = 'veo-3.1-lite-generate-preview',
  VEO_QUALITY = 'veo-3.1-generate-preview',
  FLASH_25 = 'gemini-2.5-flash'
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  groundingUrls?: Array<{ uri: string; title: string }>;
  isThinking?: boolean;
  isProactive?: boolean;
  isDoorman?: boolean;
}

export interface ChatThread {
  id: string;
  title: string;
  messages: ChatMessage[];
  timestamp: number;
}

export interface GroundingChunk {
  web?: { uri: string; title: string };
  maps?: { uri: string; title: string };
}
