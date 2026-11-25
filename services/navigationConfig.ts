// [TAG: 11]
import type { LucideIcon } from 'lucide-react';
import {
  MessageSquare,
  Scale,
  FolderOpen,
  Music,
  Mic,
  Headphones,
  Sparkles,
  Cpu,
  Database,
  Share2,
  Wrench,
  Settings,
  LineChart,
  Eye,
  Globe,
  Share,
  Home,
} from 'lucide-react';
import { AppTab } from '../types';

export interface NavItem {
  tab: AppTab;
  label: string;
  shortLabel: string;
  tagline: string;
  aliases: readonly string[];
  visibleToPrincipal: boolean;
  visibleToNonPrincipal: boolean;
  icon: LucideIcon;
  cardColor: string;
  cardBorder: string;
  cardTextColor: string;
  quickBar?: boolean;
  quickBarHighlight?: boolean;
}

export const NAV_ITEMS: readonly NavItem[] = [
  {
    tab: AppTab.CHAT,
    label: 'Dialogue Core',
    shortLabel: 'Chat',
    tagline: 'Fullscreen chat dialogue & reasoning stream',
    aliases: ['chat'],
    visibleToPrincipal: true,
    visibleToNonPrincipal: true,
    icon: MessageSquare,
    cardColor: 'from-amber-950/60 to-black',
    cardBorder: 'border-amber-500/40',
    cardTextColor: 'text-amber-300',
    quickBar: true,
  },
  {
    tab: AppTab.LEGAL,
    label: 'Legal Counsel',
    shortLabel: 'Legal',
    tagline: 'U.S. Code 1–54 • All 50 States • Professional, Business, Criminal & Civil Law',
    aliases: ['legal', 'law'],
    visibleToPrincipal: true,
    visibleToNonPrincipal: true,
    icon: Scale,
    cardColor: 'from-amber-950/60 to-black',
    cardBorder: 'border-amber-500/50',
    cardTextColor: 'text-amber-300',
  },
  {
    tab: AppTab.FILES,
    label: 'Add Files / Vault',
    shortLabel: 'Files',
    tagline: 'Word docs, audio intercepts, video footage',
    aliases: ['files', 'vault'],
    visibleToPrincipal: true,
    visibleToNonPrincipal: true,
    icon: FolderOpen,
    cardColor: 'from-amber-950/40 to-black',
    cardBorder: 'border-amber-500/30',
    cardTextColor: 'text-amber-300',
    quickBar: true,
    quickBarHighlight: true,
  },
  {
    tab: AppTab.ACOUSTIC_ROOM,
    label: 'Acoustic Lattice',
    shortLabel: 'Lattice',
    tagline: 'The Room of Tonal Scales • F-Flashcards • A/E 3:2 Engine • 60-Bit Recipe',
    aliases: ['acousticroom', 'acoustic_room'],
    visibleToPrincipal: true,
    visibleToNonPrincipal: true,
    icon: Music,
    cardColor: 'from-amber-950/60 to-black',
    cardBorder: 'border-amber-500/50',
    cardTextColor: 'text-amber-300',
    quickBar: true,
    quickBarHighlight: true,
  },
  {
    tab: AppTab.VOICE,
    label: 'Voice Portal',
    shortLabel: 'Voice',
    tagline: 'Jeremy Irons Vocal Signature & 3-pole DSP',
    aliases: ['voice'],
    visibleToPrincipal: true,
    visibleToNonPrincipal: true,
    icon: Mic,
    cardColor: 'from-red-950/50 to-black',
    cardBorder: 'border-red-900/40',
    cardTextColor: 'text-zinc-200',
    quickBar: true,
  },
  {
    tab: AppTab.VOICE_EMULATOR,
    label: 'Voice Emulator',
    shortLabel: 'Emulator',
    tagline: 'Multi-voice cloning & formant modulation',
    aliases: ['voiceemulator', 'voice_emulator'],
    visibleToPrincipal: true,
    visibleToNonPrincipal: true,
    icon: Headphones,
    cardColor: 'from-red-950/40 to-black',
    cardBorder: 'border-red-900/40',
    cardTextColor: 'text-zinc-200',
    quickBar: true,
  },
  {
    tab: AppTab.CREATIVE,
    label: 'Creative Studio',
    shortLabel: 'Creative',
    tagline: 'Manifest desired art & neural canvas',
    aliases: ['creative'],
    visibleToPrincipal: true,
    visibleToNonPrincipal: true,
    icon: Sparkles,
    cardColor: 'from-amber-950/50 to-black',
    cardBorder: 'border-amber-500/30',
    cardTextColor: 'text-amber-300',
  },
  {
    tab: AppTab.ASSISTANT,
    label: 'Assistant Daemon',
    shortLabel: 'Daemon',
    tagline: 'Autonomous background tasks & vigilance',
    aliases: ['assistant'],
    visibleToPrincipal: true,
    visibleToNonPrincipal: true,
    icon: Cpu,
    cardColor: 'from-zinc-900/60 to-black',
    cardBorder: 'border-red-900/30',
    cardTextColor: 'text-zinc-200',
  },
  {
    tab: AppTab.MEMORY,
    label: 'Memory Core',
    shortLabel: 'Memory',
    tagline: 'Permanent episodic vault & reasoning audit',
    aliases: ['memory'],
    visibleToPrincipal: true,
    visibleToNonPrincipal: true,
    icon: Database,
    cardColor: 'from-zinc-900/60 to-black',
    cardBorder: 'border-red-900/30',
    cardTextColor: 'text-zinc-200',
    quickBar: true,
  },
  {
    tab: AppTab.NEXUS,
    label: 'Neural Nexus',
    shortLabel: 'Nexus',
    tagline: 'Multi-agent mesh network & synchronization',
    aliases: ['nexus'],
    visibleToPrincipal: true,
    visibleToNonPrincipal: true,
    icon: Share2,
    cardColor: 'from-zinc-900/60 to-black',
    cardBorder: 'border-red-900/30',
    cardTextColor: 'text-zinc-200',
  },
  {
    tab: AppTab.WORKSHOP,
    label: 'Neural Forge',
    shortLabel: 'Forge',
    tagline: 'Diagnostics, structural stress tests & repairs',
    aliases: ['workshop'],
    visibleToPrincipal: true,
    visibleToNonPrincipal: true,
    icon: Wrench,
    cardColor: 'from-red-950/60 to-black',
    cardBorder: 'border-red-900/40',
    cardTextColor: 'text-red-300',
  },
  {
    tab: AppTab.SYSTEM,
    label: 'System Control',
    shortLabel: 'System',
    tagline: 'Security signets, API keys & environment',
    aliases: ['system'],
    visibleToPrincipal: true,
    visibleToNonPrincipal: true,
    icon: Settings,
    cardColor: 'from-zinc-900/60 to-black',
    cardBorder: 'border-red-900/30',
    cardTextColor: 'text-zinc-200',
    quickBar: true,
  },
  {
    tab: AppTab.ANALYTICS,
    label: 'Logic Analytics',
    shortLabel: 'Analytics',
    tagline: 'Processing velocity & thermodynamic metrics',
    aliases: ['analytics'],
    visibleToPrincipal: true,
    visibleToNonPrincipal: true,
    icon: LineChart,
    cardColor: 'from-zinc-900/60 to-black',
    cardBorder: 'border-red-900/30',
    cardTextColor: 'text-zinc-200',
  },
  {
    tab: AppTab.SNAPSHOT,
    label: 'Optical Intel',
    shortLabel: 'Optical',
    tagline: 'Vision frame analysis & snapshot ingestion',
    aliases: ['snapshot'],
    visibleToPrincipal: true,
    visibleToNonPrincipal: true,
    icon: Eye,
    cardColor: 'from-zinc-900/60 to-black',
    cardBorder: 'border-red-900/30',
    cardTextColor: 'text-zinc-200',
  },
  {
    tab: AppTab.GROUNDING,
    label: 'Grounding Intel',
    shortLabel: 'Grounding',
    tagline: 'Search & geospatial verification telemetry',
    aliases: ['grounding'],
    visibleToPrincipal: true,
    visibleToNonPrincipal: true,
    icon: Globe,
    cardColor: 'from-zinc-900/60 to-black',
    cardBorder: 'border-red-900/30',
    cardTextColor: 'text-zinc-200',
  },
  {
    tab: AppTab.SHARE,
    label: 'Share ZereØ',
    shortLabel: 'Share',
    tagline: 'Authorized ally portal links & access',
    aliases: ['share'],
    visibleToPrincipal: true,
    visibleToNonPrincipal: true,
    icon: Share,
    cardColor: 'from-zinc-900/60 to-black',
    cardBorder: 'border-red-900/30',
    cardTextColor: 'text-zinc-200',
  },
  {
    tab: AppTab.HOME,
    label: 'Command Home',
    shortLabel: 'Home',
    tagline: 'System overview & status hub',
    aliases: ['home'],
    visibleToPrincipal: true,
    visibleToNonPrincipal: true,
    icon: Home,
    cardColor: 'from-zinc-900/60 to-black',
    cardBorder: 'border-red-900/30',
    cardTextColor: 'text-zinc-200',
  },
] as const;

export const TAB_TITLES: Record<AppTab, string> = Object.fromEntries(
  NAV_ITEMS.map((item) => [item.tab, item.label])
) as Record<AppTab, string>;

export function getVisibleNavItems(isPrincipalMode?: boolean): NavItem[] {
  return NAV_ITEMS.filter((item) =>
    isPrincipalMode ? item.visibleToPrincipal : item.visibleToNonPrincipal
  );
}

export function resolveNavTab(rawTab: string): AppTab | undefined {
  const normalized = rawTab.trim().toLowerCase();
  if (!normalized) return undefined;
  const match = NAV_ITEMS.find(
    (item) =>
      item.tab.toLowerCase() === normalized ||
      item.aliases.some((alias) => alias.toLowerCase() === normalized)
  );
  return match?.tab;
}
