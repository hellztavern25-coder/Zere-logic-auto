// [TAG: 11]
import { ChatMessage, ChatThread } from '../types';
import { ClaudeTurnMessage } from './anthropicService';

export interface StoredMemory {
  id: string;
  title: string;
  content: string;
  type: string;
  timestamp: string | number;
  dedupeKey?: string;
}

export interface RecallContextResult {
  promptBlock: string;
  recalledMemoryCount: number;
  recalledThreadCount: number;
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'you', 'your', 'are', 'was',
  'were', 'have', 'has', 'had', 'from', 'but', 'not', 'what', 'when', 'where',
  'who', 'why', 'how', 'can', 'could', 'would', 'should', 'will', 'just',
  'about', 'into', 'than', 'then', 'them', 'they', 'their', 'there', 'here',
  'been', 'being', 'some', 'such', 'only', 'also', 'very', 'more', 'most',
  'please', 'zereo', 'steward', 'principal', 'tell', 'know', 'remember'
]);

function extractKeywords(text: string): string[] {
  if (!text) return [];
  const matches = text.toLowerCase().match(/[a-z0-9]{3,}/g) || [];
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const w of matches) {
    if (!STOP_WORDS.has(w) && !seen.has(w)) {
      seen.add(w);
      unique.push(w);
    }
  }
  return unique;
}

export function cleanSnippet(text: string, maxLen: number): string {
  if (!text) return '';
  const flattened = text
    .replace(/data:image\/[a-zA-Z+]+;base64,[A-Za-z0-9+/=]+/g, '[image]')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '[image]')
    .replace(/\s+/g, ' ')
    .trim();
  if (flattened.length <= maxLen) return flattened;
  return flattened.slice(0, maxLen - 1).trimEnd() + '…';
}

export function isNoisyMemory(m: Partial<StoredMemory> | null | undefined): boolean {
  const c = String(m?.content || '').toLowerCase();
  if (!c.trim()) return true;
  return (
    c.includes('daily quota for this api key has been reached') ||
    c.includes('processing arrays are temporarily exhausted') ||
    c.includes('upstream neural routing latency spike') ||
    c.includes('thermodynamic anomaly has interrupted reasoning')
  );
}

export interface CompactThreadRecall {
  id?: string;
  title: string;
  timestamp?: number;
  exchanges: Array<{ role: 'Principal' | 'ZereØ'; text: string }>;
}

export function extractThreadExcerpt(
  thread: Partial<ChatThread>,
  maxTextLen: number = 170
): CompactThreadRecall | null {
  const validMsgs = Array.isArray(thread?.messages)
    ? thread.messages.filter((m) => typeof m?.text === 'string' && m.text.trim().length > 0 && !isTransientErrorMessage(m))
    : [];
  if (validMsgs.length === 0) return null;

  const picks =
    validMsgs.length <= 4
      ? validMsgs
      : [validMsgs[0], validMsgs[1], ...validMsgs.slice(-2)];

  return {
    id: thread.id,
    title: thread.title || 'Dialogue',
    timestamp: thread.timestamp,
    exchanges: picks.map((m) => ({
      role: m.role === 'user' ? 'Principal' : 'ZereØ',
      text: cleanSnippet(m.text, maxTextLen),
    })),
  };
}

export function buildRecallSummaryPayload(
  memories: StoredMemory[],
  threads: ChatThread[]
): {
  memories: Array<{
    id: string;
    type: string;
    title: string;
    content: string;
    timestamp: string | number;
  }>;
  recentThreads: CompactThreadRecall[];
} {
  const compactThreads = (Array.isArray(threads) ? threads : [])
    .filter((t) => Array.isArray(t?.messages) && t.messages.length > 0)
    .slice(0, 8)
    .map((t) => extractThreadExcerpt(t, 180))
    .filter((t): t is CompactThreadRecall => Boolean(t));

  const compactMemories = (Array.isArray(memories) ? memories : [])
    .filter((m) => !isNoisyMemory(m))
    .slice(0, 20)
    .map((m) => ({
      id: m.id,
      type: m.type,
      title: m.title,
      content: cleanSnippet(String(m.content || ''), 260),
      timestamp: m.timestamp,
    }));

  return {
    memories: compactMemories,
    recentThreads: compactThreads,
  };
}

export function isTransientErrorMessage(msg: ChatMessage): boolean {
  if (!msg) return false;
  if (msg.isErrorNotice) return true;
  if (msg.role !== 'model') return false;
  const t = (msg.text || '').toLowerCase();
  return (
    t.includes('a thermodynamic anomaly has interrupted reasoning') ||
    t.includes('an upstream neural routing latency spike was intercepted') ||
    t.includes('central processing arrays encountered elevated demand') ||
    t.includes('my processing arrays are temporarily exhausted') ||
    t.includes('packet formatting anomaly occurred during transmission') ||
    t.includes('neural authorization has been compromised at the source')
  );
}

const THREAD_CACHE_STORAGE_KEY = 'ZEREO_CHAT_THREADS';

/**
 * Produces a lightweight copy of threads safe for browser localStorage cache,
 * stripping heavy base64 image payloads from messages while preserving all dialogue text.
 */
export function buildLightweightThreadsForLocalStorage(threads: ChatThread[]): ChatThread[] {
  return threads.slice(0, 40).map((t) => ({
    ...t,
    messages: (t.messages || []).map((m) => {
      const copy: ChatMessage = { ...m };
      if (copy.imageData) {
        delete copy.imageData;
        copy.text = copy.text || '[Visual attachment archived]';
      }
      if (copy.generatedArt?.imageUrl?.startsWith('data:')) {
        copy.generatedArt = {
          ...copy.generatedArt,
          imageUrl: '',
        };
      }
      return copy;
    }),
  }));
}

/**
 * Cache-only read helper (never authoritative source of truth; only for offline display when /api/threads is unreachable).
 */
export function readReadOnlyThreadCache(): ChatThread[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(THREAD_CACHE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Cache-only write helper invoked only after server /api/threads truth is resolved or saved.
 */
export function writeThreadCache(threads: ChatThread[]): void {
  if (typeof window === 'undefined') return;
  try {
    const lightThreads = buildLightweightThreadsForLocalStorage(threads);
    localStorage.setItem(THREAD_CACHE_STORAGE_KEY, JSON.stringify(lightThreads));
  } catch (err) {
    console.warn('Skipped localStorage thread cache due to quota:', err);
  }
}

/**
 * Builds properly alternating multi-turn Gemini `contents` from the active thread's history
 * plus the current user prompt & optional current image attachment.
 * Historical images are stripped to prevent payload bloat while preserving conversational continuity.
 */
export function buildMultiTurnContents(
  history: ChatMessage[],
  currentInput: string,
  currentImage?: string | null,
  currentMime: string = 'image/png',
  maxTurns: number = 24,
  extraInlineParts?: Array<{ mimeType: string; data: string }>
): Array<{ role: 'user' | 'model'; parts: any[] }> {
  const recentHistory = (history || []).filter((m) => !isTransientErrorMessage(m)).slice(-maxTurns);
  const contents: Array<{ role: 'user' | 'model'; parts: any[] }> = [];

  for (const msg of recentHistory) {
    const baseText = (msg.text || '').trim();
    const textWithImageNote =
      msg.imageData && !baseText.includes('[Visual')
        ? `${baseText}\n[Earlier visual/screen frame was inspected in this turn]`.trim()
        : baseText;

    if (!textWithImageNote) continue;

    const last = contents[contents.length - 1];
    if (last && last.role === msg.role) {
      last.parts[0].text = `${last.parts[0].text}\n\n${textWithImageNote}`;
    } else {
      contents.push({
        role: msg.role,
        parts: [{ text: textWithImageNote }],
      });
    }
  }

  // Gemini generateContent expects the conversation to begin with a 'user' turn.
  if (contents.length > 0 && contents[0].role === 'model') {
    contents.unshift({
      role: 'user',
      parts: [{ text: '[Channel opened — resuming dialogue with the Steward.]' }],
    });
  }

  const finalParts: any[] = [
    { text: (currentInput || '').trim() || 'Analyze this input.' },
  ];
  if (currentImage) {
    finalParts.push({
      inlineData: {
        mimeType: currentMime || 'image/png',
        data: currentImage,
      },
    });
  }
  if (extraInlineParts && extraInlineParts.length > 0) {
    for (const part of extraInlineParts) {
      if (part?.data && part?.mimeType) {
        finalParts.push({
          inlineData: {
            mimeType: part.mimeType,
            data: part.data,
          },
        });
      }
    }
  }

  const last = contents[contents.length - 1];
  if (last && last.role === 'user') {
    // Ensure clean separation if an orphaned user message wasn't answered before retry
    contents.push({
      role: 'model',
      parts: [{ text: '[Acknowledged, continuing.]' }],
    });
  }

  contents.push({
    role: 'user',
    parts: finalParts,
  });

  return contents;
}

/**
 * Builds properly alternating multi-turn message history for Anthropic Claude.
 */
export function buildClaudeHistory(
  history: ChatMessage[],
  currentInput: string,
  maxTurns: number = 24
): ClaudeTurnMessage[] {
  const recentHistory = (history || []).filter((m) => !isTransientErrorMessage(m)).slice(-maxTurns);
  const result: ClaudeTurnMessage[] = [];

  for (const msg of recentHistory) {
    const text = (msg.text || '').trim();
    if (!text) continue;
    const role: 'user' | 'assistant' = msg.role === 'user' ? 'user' : 'assistant';
    const last = result[result.length - 1];
    if (last && last.role === role) {
      last.content = `${last.content}\n\n${text}`;
    } else {
      result.push({ role, content: text });
    }
  }

  if (result.length > 0 && result[0].role === 'assistant') {
    result.unshift({
      role: 'user',
      content: '[Channel opened — resuming dialogue with the Steward.]',
    });
  }

  const cleanInput = (currentInput || '').trim() || 'Analyze input.';
  const last = result[result.length - 1];
  if (last && last.role === 'user') {
    result.push({ role: 'assistant', content: '[Acknowledged, continuing.]' });
  }

  result.push({ role: 'user', content: cleanInput });
  return result;
}

/**
 * Combines:
 * 1) Persistent Core Memories & Episodic Conversation Digests (`/api/memories`)
 * 2) Earlier turns from the active thread if longer than the 24-turn live window
 * 3) Ranked relevant & recent past conversation threads from `threads.json`
 * into a concise system-instruction block for both Text Chat and Conversation Mode.
 */
export function buildCrossConversationRecallContext(params: {
  memories: StoredMemory[];
  threads: ChatThread[];
  currentThreadId: string | null;
  currentMessages: ChatMessage[];
  queryText: string;
  isConversationMode?: boolean;
}): RecallContextResult {
  const {
    memories = [],
    threads = [],
    currentThreadId,
    currentMessages = [],
    queryText = '',
    isConversationMode = false,
  } = params;

  const keywords = extractKeywords(queryText);

  // 1. Score & select persistent memories
  const filteredMemories = memories.filter((m) => !isNoisyMemory(m));
  const isEpisodic = (m: StoredMemory) => String(m.type || '').toUpperCase() === 'CONVERSATION_RECALL';
  const coreMemories = filteredMemories.filter((m) => !isEpisodic(m));
  const episodicMemories = filteredMemories.filter((m) => isEpisodic(m));

  const scoreText = (txt: string): number => {
    if (!txt || keywords.length === 0) return 0;
    const lower = txt.toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) score += 3;
    }
    return score;
  };

  const rankedCore = [...coreMemories]
    .sort((a, b) => scoreText(`${b.title} ${b.content}`) - scoreText(`${a.title} ${a.content}`))
    .slice(0, 15);

  const rankedEpisodic = [...episodicMemories]
    .sort((a, b) => {
      const sDiff = scoreText(`${b.title} ${b.content}`) - scoreText(`${a.title} ${a.content}`);
      if (sDiff !== 0) return sDiff;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    })
    .slice(0, 6);

  // 2. Summarize overflow history in the current thread if > 24 turns
  let overflowBlock = '';
  if (currentMessages.length > 24) {
    const olderMsgs = currentMessages.slice(0, currentMessages.length - 24);
    const keyOlder = olderMsgs
      .filter((m) => (m.text || '').trim().length > 0)
      .slice(-8)
      .map((m) => `${m.role === 'user' ? 'Principal' : 'ZereØ'}: ${cleanSnippet(m.text, 160)}`);
    if (keyOlder.length > 0) {
      overflowBlock = `\nEARLIER IN THIS ACTIVE CONVERSATION (${olderMsgs.length} prior turns condensed):\n${keyOlder.join('\n')}`;
    }
  }

  // 3. Rank & extract cross-thread past conversations
  const pastThreads = (threads || []).filter(
    (t) => t.id !== currentThreadId && Array.isArray(t.messages) && t.messages.length > 0
  );

  const now = Date.now();
  const scoredThreads = pastThreads
    .map((t) => {
      const combinedText = `${t.title || ''} ${t.messages.map((m) => m.text || '').join(' ')}`;
      const kwScore = scoreText(combinedText);
      const ageDays = Math.max(0, (now - (t.timestamp || 0)) / (1000 * 60 * 60 * 24));
      const recencyBonus = Math.max(0, 6 - ageDays * 0.5);
      return { thread: t, totalScore: kwScore + recencyBonus };
    })
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 5);

  const threadDigests = scoredThreads
    .map(({ thread }) => {
      const excerpt = extractThreadExcerpt(thread, 170);
      if (!excerpt) return null;
      const dateLabel = thread.timestamp
        ? new Date(thread.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : 'Recent';
      const lines = excerpt.exchanges.map((ex) => `  ${ex.role}: ${ex.text}`);
      return `• [${excerpt.title} • ${dateLabel}]\n${lines.join('\n')}`;
    })
    .filter((d): d is string => Boolean(d));

  const sections: string[] = [];

  if (rankedCore.length > 0) {
    sections.push(
      `CORE PERSISTENT MEMORIES (Always remember and honor across all conversations):\n` +
        rankedCore
          .map((m) => `- [${m.type}] ${cleanSnippet(m.title, 60)}: ${cleanSnippet(m.content, 240)}`)
          .join('\n')
    );
  }

  if (rankedEpisodic.length > 0) {
    sections.push(
      `DISTILLED PAST SESSION RECALL:\n` +
        rankedEpisodic
          .map((m) => `- ${cleanSnippet(m.title, 70)}: ${cleanSnippet(m.content, 240)}`)
          .join('\n')
    );
  }

  if (threadDigests.length > 0) {
    sections.push(
      `RECENT & RELEVANT PAST CONVERSATIONS (Cross-thread continuity — treat these as shared history you genuinely recall):\n` +
        threadDigests.join('\n')
    );
  }

  if (overflowBlock) {
    sections.push(overflowBlock.trim());
  }

  if (isConversationMode) {
    sections.push(
      `ACTIVE VOICE CONVERSATION MODE:\n` +
        `- You are speaking live aloud with the Principal in the Jeremy Irons voice, back-and-forth.\n` +
        `- Write naturally for spoken delivery: crisp, resonant prose without markdown tables, code fences, or bullet clutter unless requested.\n` +
        `- Reference recalled details from past conversations naturally when relevant so dialogue feels seamless and continuous.`
    );
  }

  return {
    promptBlock: sections.length > 0 ? `\n${sections.join('\n\n')}` : '',
    recalledMemoryCount: rankedCore.length + rankedEpisodic.length,
    recalledThreadCount: threadDigests.length,
  };
}

export interface SaveMemoryInput {
  title?: string;
  content: string;
  type?: string;
  dedupeKey?: string;
}

export async function fetchMemoryRecords(): Promise<StoredMemory[]> {
  try {
    const res = await fetch('/api/memories');
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * Canonical single POST writer for `/api/memories`. All client memory writes route through this helper.
 */
export async function saveMemoryRecord(input: SaveMemoryInput): Promise<StoredMemory | null> {
  const cleanContent = typeof input?.content === 'string' ? input.content.trim() : '';
  if (!cleanContent) return null;
  try {
    const res = await fetch('/api/memories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: input.title,
        content: cleanContent,
        type: input.type || 'STRATEGIC',
        ...(input.dedupeKey ? { dedupeKey: input.dedupeKey } : {}),
      }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function deleteMemoryRecord(id: string): Promise<boolean> {
  if (!id) return false;
  try {
    const res = await fetch(`/api/memories/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Distills a thread into a compact, deduplicated episodic recall entry and saves it via the single memory writer.
 * Uses `dedupeKey` on the server so each thread keeps a single up-to-date memory record cleanly.
 */
export async function syncThreadEpisodicMemory(
  threadId: string | null,
  threadTitle: string,
  messages: ChatMessage[]
): Promise<StoredMemory | null> {
  const cleanMessages = messages.filter((m) => !isTransientErrorMessage(m));
  if (cleanMessages.length < 2) return null;

  const userTurns = cleanMessages.filter((m) => m.role === 'user' && (m.text || '').trim().length > 0);
  if (userTurns.length === 0) return null;

  const firstTopic = cleanSnippet(userTurns[0].text, 90);
  const recentPairs = cleanMessages
    .filter((m) => (m.text || '').trim().length > 0)
    .slice(-4)
    .map((m) => `${m.role === 'user' ? 'Principal' : 'ZereØ'}: ${cleanSnippet(m.text, 130)}`);

  const digestContent = `Thread "${cleanSnippet(threadTitle || firstTopic, 50)}" (${userTurns.length} Principal turns). Initial focus: "${firstTopic}". Latest exchange -> ${recentPairs.join(' | ')}`;
  const dedupeKey = `thread_recall_${threadId}`;

  return saveMemoryRecord({
    title: `Dialogue Recall: ${cleanSnippet(threadTitle || firstTopic, 48)}`,
    content: digestContent,
    type: 'CONVERSATION_RECALL',
    dedupeKey,
  });
}
