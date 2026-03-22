
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
  WORKSHOP = 'Workshop'
}

export enum GeminiModel {
  FLASH_PREVIEW = 'gemini-3-flash-preview',
  PRO_PREVIEW = 'gemini-3.1-pro-preview',
  FLASH_LITE = 'gemini-flash-lite-latest',
  FLASH_IMAGE = 'gemini-2.5-flash-image',
  PRO_IMAGE_PREVIEW = 'gemini-3-pro-image-preview',
  FLASH_NATIVE_AUDIO = 'gemini-2.5-flash-native-audio-preview-09-2025',
  FLASH_TTS = 'gemini-2.5-flash-preview-tts',
  VEO_FAST = 'veo-3.1-fast-generate-preview',
  VEO_QUALITY = 'veo-3.1-generate-preview',
  FLASH_25 = 'gemini-2.5-flash'
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  groundingUrls?: Array<{ uri: string; title: string }>;
  isThinking?: boolean;
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
