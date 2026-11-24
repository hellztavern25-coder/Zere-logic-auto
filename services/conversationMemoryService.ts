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

function cleanSnippet(text: string, maxLen: number): string {
  if (!text) return '';
  const flattened = text
    .replace(/data:image\/[a-zA-Z+]+;base64,[A-Za-z0-9+/=]+/g, '[image]')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '[image]')
    .replace(/\s+/g, ' ')
    .trim();
  if (flattened.length <= maxLen) return flattened;
  return flattened.slice(0, maxLen - 1).trimEnd() + '…';
}

function isNoisyMemory(m: StoredMemory): boolean {
  const c = (m.content || '').toLowerCase();
  return (
    c.includes('daily quota for this api key has been reached') ||
    c.includes('processing arrays are temporarily exhausted') ||
    c.includes('upstream neural routing latency spike') ||
    c.includes('thermodynamic anomaly has interrupted reasoning')
  );
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

/**
 * Produces a lightweight copy of threads safe for browser localStorage fallback,
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
  const coreMemories = filteredMemories.filter((m) => m.type !== 'CONVERSATION_RECALL');
  const episodicMemories = filteredMemories.filter((m) => m.type === 'CONVERSATION_RECALL');

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

  const threadDigests = scoredThreads.map(({ thread }) => {
    const dateLabel = thread.timestamp
      ? new Date(thread.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : 'Recent';
    const userAndModel = (thread.messages || []).filter((m) => (m.text || '').trim().length > 0);
    // Grab opening context + most recent 2 exchanges so both topic and conclusion are recalled
    const picks: ChatMessage[] = [];
    if (userAndModel.length <= 4) {
      picks.push(...userAndModel);
    } else {
      picks.push(userAndModel[0], userAndModel[1], ...userAndModel.slice(-2));
    }
    const lines = picks.map(
      (m) => `  ${m.role === 'user' ? 'Principal' : 'ZereØ'}: ${cleanSnippet(m.text, 170)}`
    );
    return `• [${thread.title || 'Dialogue'} • ${dateLabel}]\n${lines.join('\n')}`;
  });

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

/**
 * Distills a thread into a compact, deduplicated episodic recall entry and saves it to `/api/memories`.
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

  try {
    const res = await fetch('/api/memories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `Dialogue Recall: ${cleanSnippet(threadTitle || firstTopic, 48)}`,
        content: digestContent,
        type: 'CONVERSATION_RECALL',
        dedupeKey,
      }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
