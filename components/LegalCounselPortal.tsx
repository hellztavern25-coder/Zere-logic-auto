// [TAG: 11]
import React, { useEffect, useMemo, useState } from 'react';
import Markdown from 'react-markdown';
import { Socket } from 'socket.io-client';
import {
  Scale,
  Search,
  BookOpen,
  Building2,
  ShieldAlert,
  Briefcase,
  Gavel,
  Landmark,
  ExternalLink,
  Volume2,
  Square,
  Save,
  Trash2,
  Download,
  Copy,
  Check,
  Loader2,
  ArrowLeftRight,
  MessageSquare,
  FolderArchive,
  AlertCircle,
  Shield,
  FileSignature,
  Library,
  Sparkles,
  Plus,
  X,
} from 'lucide-react';
import {
  AppTab,
  LawLibraryPrecedent,
  LegalCounselResponse,
  LegalDefenseStatementType,
  LegalDossierEntry,
  LegalJurisdictionEntry,
  LegalPracticeArea,
  LegalResearchMode,
  USCodeTitleEntry,
} from '../types';
import {
  LEGAL_DEFENSE_STATEMENT_TEMPLATES,
  LEGAL_QUICK_TEMPLATES,
  US_CODE_TITLES,
  US_JURISDICTIONS,
  US_LAW_LIBRARY_PRECEDENTS,
  matchPrecedentsForScenario,
} from '../services/usLawRegistry';
import { getAuthHeaders } from '../services/geminiService';
import { jeremyIronsVoice } from '../services/jeremyIronsVoiceService';

interface LegalCounselPortalProps {
  socket?: Socket | null;
  onNavigate?: (tab: string) => void;
}

function useFilteredList<T>(
  items: readonly T[],
  query: string,
  predicate: (item: T, normalizedQuery: string) => boolean,
  deps: React.DependencyList = [],
  postProcess?: (filtered: T[]) => T[]
): T[] {
  return useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = items.filter((item) => predicate(item, normalizedQuery));
    return postProcess ? postProcess(filtered) : filtered;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, query, ...deps]);
}

const PRACTICE_TABS: Array<{
  id: LegalPracticeArea;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'all', label: 'All U.S. Law', icon: Scale },
  { id: 'professional', label: 'Professional', icon: Briefcase },
  { id: 'business', label: 'Business', icon: Building2 },
  { id: 'criminal', label: 'Criminal', icon: ShieldAlert },
  { id: 'civil', label: 'Civil', icon: Gavel },
];

const MODE_OPTIONS: Array<{ id: LegalResearchMode; label: string }> = [
  { id: 'legal_counsel', label: 'Counsel Brief' },
  { id: 'defense_strategy', label: 'Strategy Builder' },
  { id: 'defense_statement', label: 'Defense Statement' },
  { id: 'statute_lookup', label: 'Statute Lookup' },
  { id: 'state_compare', label: 'State Compare' },
  { id: 'rights_defense', label: 'Rights & Defense' },
];

const PRACTICE_LABELS: Record<LegalPracticeArea, string> = {
  ...(Object.fromEntries(PRACTICE_TABS.map((t) => [t.id, t.label])) as Record<LegalPracticeArea, string>),
  all: 'All Domains',
  constitutional: 'Constitutional',
};

const MODE_LABELS: Record<LegalResearchMode, string> = {
  ...(Object.fromEntries(MODE_OPTIONS.map((m) => [m.id, m.label])) as Record<LegalResearchMode, string>),
  state_compare: 'Jurisdiction Compare',
};

const LegalCounselPortal: React.FC<LegalCounselPortalProps> = ({ socket, onNavigate }) => {
  const [workspaceView, setWorkspaceView] = useState<'desk' | 'strategy' | 'library' | 'archive'>('desk');
  const [directoryTab, setDirectoryTab] = useState<'jurisdictions' | 'uscode'>('jurisdictions');
  const [directorySearch, setDirectorySearch] = useState('');

  const [practiceArea, setPracticeArea] = useState<LegalPracticeArea>('all');
  const [mode, setMode] = useState<LegalResearchMode>('legal_counsel');
  const [defenseStatementType, setDefenseStatementType] =
    useState<LegalDefenseStatementType>('cease_and_desist');
  const [houseEntityName, setHouseEntityName] = useState<string>(
    'The Grey House / Principal Preston Johnston'
  );
  const [opposingParty, setOpposingParty] = useState<string>('');
  const [jurisdictionCode, setJurisdictionCode] = useState<string>('US-FED');
  const [compareJurisdictionCode, setCompareJurisdictionCode] = useState<string>('DE');
  const [query, setQuery] = useState<string>('');
  const [dossierTitle, setDossierTitle] = useState<string>('');

  const [isResearching, setIsResearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeBrief, setActiveBrief] = useState<LegalCounselResponse | null>(null);
  const [activeBriefTitle, setActiveBriefTitle] = useState<string>('');

  const [dossiers, setDossiers] = useState<LegalDossierEntry[]>([]);
  const [isLoadingDossiers, setIsLoadingDossiers] = useState(false);
  const [isSavingDossier, setIsSavingDossier] = useState(false);
  const [archiveSearch, setArchiveSearch] = useState('');
  const [archiveAreaFilter, setArchiveAreaFilter] = useState<LegalPracticeArea>('all');

  const [copiedState, setCopiedState] = useState<'brief' | 'saved' | null>(null);
  const [isSpeakingBrief, setIsSpeakingBrief] = useState(false);

  const [selectedPrecedentIds, setSelectedPrecedentIds] = useState<string[]>([]);
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryDomainFilter, setLibraryDomainFilter] = useState<LegalPracticeArea>('all');
  const [precedentPickerSearch, setPrecedentPickerSearch] = useState('');

  const selectedJurisdiction: LegalJurisdictionEntry = useMemo(
    () => US_JURISDICTIONS.find((j) => j.code === jurisdictionCode) || US_JURISDICTIONS[0],
    [jurisdictionCode]
  );

  const selectedCompareJurisdiction: LegalJurisdictionEntry | undefined = useMemo(
    () =>
      mode === 'state_compare'
        ? US_JURISDICTIONS.find((j) => j.code === compareJurisdictionCode)
        : undefined,
    [mode, compareJurisdictionCode]
  );

  const filteredJurisdictions = useFilteredList(
    US_JURISDICTIONS,
    directorySearch,
    (j, q) =>
      !q ||
      j.name.toLowerCase().includes(q) ||
      j.code.toLowerCase().includes(q) ||
      j.officialCodeName.toLowerCase().includes(q) ||
      j.statutoryFocus.toLowerCase().includes(q)
  );

  const filteredUsCodeTitles = useFilteredList(
    US_CODE_TITLES,
    directorySearch,
    (t, q) => {
      if (practiceArea !== 'all' && t.domain !== practiceArea && t.domain !== 'constitutional' && !q) {
        return false;
      }
      if (!q) return true;
      return (
        t.label.toLowerCase().includes(q) ||
        t.summary.toLowerCase().includes(q) ||
        String(t.titleNumber) === q
      );
    },
    [practiceArea]
  );

  const visibleTemplates = useMemo(() => {
    if (practiceArea === 'all' || practiceArea === 'constitutional') {
      const priorityIds = [
        'prof-lady-grey-teacher',
        'civ-1983-bureaucracy',
        'crim-4th-5th-6th',
        'crim-self-defense',
        'civ-injunction-frcp',
        'biz-entity-shield',
      ];
      const priority = priorityIds
        .map((id) => LEGAL_QUICK_TEMPLATES.find((t) => t.id === id))
        .filter((t): t is (typeof LEGAL_QUICK_TEMPLATES)[number] => Boolean(t));
      return priority.length > 0 ? priority : LEGAL_QUICK_TEMPLATES.slice(0, 6);
    }
    return LEGAL_QUICK_TEMPLATES.filter((t) => t.domain === practiceArea);
  }, [practiceArea]);

  const filteredDossiers = useFilteredList(
    dossiers,
    archiveSearch,
    (d, q) => {
      if (archiveAreaFilter !== 'all' && d.practiceArea !== archiveAreaFilter) return false;
      if (!q) return true;
      return (
        d.title.toLowerCase().includes(q) ||
        d.query.toLowerCase().includes(q) ||
        d.jurisdiction.toLowerCase().includes(q) ||
        d.content.toLowerCase().includes(q)
      );
    },
    [archiveAreaFilter]
  );

  const selectedPrecedents: LawLibraryPrecedent[] = useMemo(
    () =>
      selectedPrecedentIds
        .map((id) => US_LAW_LIBRARY_PRECEDENTS.find((p) => p.id === id))
        .filter((p): p is LawLibraryPrecedent => Boolean(p)),
    [selectedPrecedentIds]
  );

  const filteredLibraryPrecedents = useFilteredList(
    US_LAW_LIBRARY_PRECEDENTS,
    librarySearch,
    (p, q) => {
      if (libraryDomainFilter !== 'all' && p.domain !== libraryDomainFilter) return false;
      if (!q) return true;
      return (
        p.caseName.toLowerCase().includes(q) ||
        p.citation.toLowerCase().includes(q) ||
        p.doctrine.toLowerCase().includes(q) ||
        p.holdingSummary.toLowerCase().includes(q) ||
        p.defensiveApplication.toLowerCase().includes(q) ||
        p.relatedStatutes.some((s) => s.toLowerCase().includes(q))
      );
    },
    [libraryDomainFilter]
  );

  const pickerPrecedents = useFilteredList(
    US_LAW_LIBRARY_PRECEDENTS,
    precedentPickerSearch,
    (p, q) =>
      !q ||
      p.caseName.toLowerCase().includes(q) ||
      p.citation.toLowerCase().includes(q) ||
      p.doctrine.toLowerCase().includes(q) ||
      p.defensiveApplication.toLowerCase().includes(q),
    [practiceArea],
    (list) =>
      [...list].sort((a, b) => {
        const aMatch = practiceArea === 'all' || a.domain === practiceArea ? 0 : 1;
        const bMatch = practiceArea === 'all' || b.domain === practiceArea ? 0 : 1;
        return aMatch - bMatch;
      })
  );

  const togglePrecedent = (id: string) => {
    setSelectedPrecedentIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= 8) {
        return [...prev.slice(1), id];
      }
      return [...prev, id];
    });
  };

  const handleAutoMatchPrecedents = () => {
    const matched = matchPrecedentsForScenario(practiceArea, query, 4);
    setSelectedPrecedentIds(matched.map((p) => p.id));
  };

  const fetchDossiers = async () => {
    setIsLoadingDossiers(true);
    try {
      const res = await fetch('/api/legal/dossiers');
      if (res.ok) {
        const data = await res.json();
        setDossiers(Array.isArray(data?.dossiers) ? data.dossiers : []);
      }
    } catch {
      // ignore transient load failure
    } finally {
      setIsLoadingDossiers(false);
    }
  };

  useEffect(() => {
    fetchDossiers();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => {
      fetchDossiers();
    };
    socket.on('legal:dossier_updated', handleUpdate);
    return () => {
      socket.off('legal:dossier_updated', handleUpdate);
    };
  }, [socket]);

  const executeCounselQuery = async (override?: {
    queryText?: string;
    practice?: LegalPracticeArea;
    researchMode?: LegalResearchMode;
    statementType?: LegalDefenseStatementType;
    jurisdictionName?: string;
    titleHint?: string;
    precedentsOverride?: LawLibraryPrecedent[];
  }) => {
    const targetQuery = (override?.queryText ?? query).trim();
    if (!targetQuery) {
      setErrorMsg('Enter a legal question, statute citation, or factual defensive scenario.');
      return;
    }

    const targetArea = override?.practice ?? practiceArea;
    const targetMode = override?.researchMode ?? mode;
    const targetStatementType = override?.statementType ?? defenseStatementType;
    const targetJurisdiction =
      override?.jurisdictionName ??
      `${selectedJurisdiction.name} — ${selectedJurisdiction.officialCodeName}`;
    const compareTarget =
      targetMode === 'state_compare' && selectedCompareJurisdiction
        ? `${selectedCompareJurisdiction.name} — ${selectedCompareJurisdiction.officialCodeName}`
        : undefined;

    let effectivePrecedents: LawLibraryPrecedent[] =
      override?.precedentsOverride ?? selectedPrecedents;
    if (targetMode === 'defense_strategy' && effectivePrecedents.length === 0) {
      effectivePrecedents = matchPrecedentsForScenario(targetArea, targetQuery, 4);
      setSelectedPrecedentIds(effectivePrecedents.map((p) => p.id));
    }

    setIsResearching(true);
    setErrorMsg(null);
    if (targetMode === 'defense_strategy') {
      setWorkspaceView('strategy');
    } else if (workspaceView === 'archive' || workspaceView === 'library') {
      setWorkspaceView('desk');
    }

    try {
      const headers = getAuthHeaders();

      const res = await fetch('/api/legal/counsel', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: targetQuery,
          practiceArea: targetArea,
          mode: targetMode,
          defenseStatementType:
            targetMode === 'defense_statement' || targetMode === 'defense_strategy'
              ? targetStatementType
              : undefined,
          houseEntityName: houseEntityName.trim() || 'The Grey House / Principal Preston Johnston',
          opposingParty: opposingParty.trim() || undefined,
          jurisdiction: targetJurisdiction,
          compareJurisdiction: compareTarget,
          selectedPrecedents:
            targetMode === 'defense_strategy' || effectivePrecedents.length > 0
              ? effectivePrecedents.map((p) => ({
                  id: p.id,
                  caseName: p.caseName,
                  citation: p.citation,
                  doctrine: p.doctrine,
                  holdingSummary: p.holdingSummary,
                  defensiveApplication: p.defensiveApplication,
                }))
              : undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.content) {
        throw new Error(
          typeof data?.error === 'string'
            ? data.error
            : data?.error?.message || `Statutory research failed (HTTP ${res.status})`
        );
      }

      setActiveBrief(data as LegalCounselResponse);
      setActiveBriefTitle(
        override?.titleHint || dossierTitle.trim() || targetQuery.slice(0, 72)
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to execute statutory research.');
    } finally {
      setIsResearching(false);
    }
  };

  const handleSelectUsCodeTitle = (titleItem: USCodeTitleEntry) => {
    setJurisdictionCode('US-FED');
    setMode('statute_lookup');
    if (titleItem.domain !== 'constitutional') {
      setPracticeArea(titleItem.domain);
    }
    const presetPrompt = `Provide an authoritative statutory breakdown of ${titleItem.titleNumber} U.S.C. (${titleItem.label}), covering core chapters, governing definitions, key compliance or liability sections, penalties, and recent amendments.`;
    setQuery(presetPrompt);
    setDossierTitle(`${titleItem.titleNumber} U.S.C. Overview`);
    executeCounselQuery({
      queryText: presetPrompt,
      practice: titleItem.domain === 'constitutional' ? 'all' : titleItem.domain,
      researchMode: 'statute_lookup',
      jurisdictionName: US_JURISDICTIONS[0].name,
      titleHint: `${titleItem.titleNumber} U.S.C. Statutory Breakdown`,
    });
  };

  const handleCitationLookup = (citation: string) => {
    const prompt = `Look up and analyze the exact text, statutory elements, controlling exceptions, and Grey House strategic implications of ${citation}.`;
    setMode('statute_lookup');
    setQuery(prompt);
    executeCounselQuery({
      queryText: prompt,
      researchMode: 'statute_lookup',
      titleHint: citation,
    });
  };

  const handleSaveDossier = async () => {
    if (!activeBrief || isSavingDossier) return;
    setIsSavingDossier(true);
    try {
      const res = await fetch('/api/legal/dossiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: activeBriefTitle || query.slice(0, 72) || 'Grey House Legal Brief',
          query: query.trim(),
          practiceArea: activeBrief.practiceArea,
          mode: activeBrief.mode,
          defenseStatementType: activeBrief.defenseStatementType,
          houseEntityName: activeBrief.houseEntityName,
          opposingParty: activeBrief.opposingParty,
          jurisdiction: activeBrief.jurisdiction,
          compareJurisdiction: activeBrief.compareJurisdiction,
          precedentsUsed: activeBrief.precedentsUsed,
          content: activeBrief.content,
          citations: activeBrief.citations,
          sources: activeBrief.sources,
          servedByModel: activeBrief.servedByModel,
        }),
      });
      if (!res.ok) throw new Error('Failed to save dossier');
      await fetchDossiers();
      setCopiedState('saved');
      setTimeout(() => setCopiedState(null), 2200);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save dossier to vault.');
    } finally {
      setIsSavingDossier(false);
    }
  };

  const handleDeleteDossier = async (id: string) => {
    try {
      const res = await fetch(`/api/legal/dossiers/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setDossiers((prev) => prev.filter((d) => d.id !== id));
      }
    } catch {
      // ignore
    }
  };

  const handleSpeakBrief = async () => {
    if (!activeBrief?.content) return;
    if (isSpeakingBrief) {
      jeremyIronsVoice.stop();
      setIsSpeakingBrief(false);
      return;
    }
    setIsSpeakingBrief(true);
    try {
      await jeremyIronsVoice.speak(
        activeBrief.content.slice(0, 3200),
        undefined,
        () => setIsSpeakingBrief(true),
        () => setIsSpeakingBrief(false)
      );
    } catch {
      setIsSpeakingBrief(false);
    }
  };

  const handleCopyBrief = async () => {
    if (!activeBrief?.content) return;
    try {
      await navigator.clipboard.writeText(activeBrief.content);
      setCopiedState('brief');
      setTimeout(() => setCopiedState(null), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleExportBrief = (format: 'md' | 'txt' | 'json', entry?: LegalDossierEntry) => {
    const payload = entry || {
      title: activeBriefTitle || 'Grey House Legal Counsel Brief',
      query,
      ...activeBrief,
      exportedAt: new Date().toISOString(),
    };
    const safeSlug = String(payload.title || 'grey-house-legal-brief')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 48);

    const precedentsText =
      payload.precedentsUsed && payload.precedentsUsed.length > 0
        ? payload.precedentsUsed.map((p) => `${p.caseName} (${p.citation})`).join('; ')
        : '';

    const contentStr =
      format === 'json'
        ? JSON.stringify(payload, null, 2)
        : format === 'txt'
        ? `${String(payload.title || 'GREY HOUSE DEFENSE STATEMENT').toUpperCase()}\nJurisdiction: ${payload.jurisdiction}\nDomain: ${payload.practiceArea}\nMode: ${payload.mode}${
            payload.houseEntityName ? `\nProtected House/Entity: ${payload.houseEntityName}` : ''
          }${payload.opposingParty ? `\nAdverse Party: ${payload.opposingParty}` : ''}${
            precedentsText ? `\nLaw Library Precedents Applied: ${precedentsText}` : ''
          }\n\n${payload.content}\n\nCITATIONS:\n${
            (payload.citations || []).join(', ') || 'None'
          }\n`
        : `# ${payload.title}\n\n- Practice Area: ${payload.practiceArea}\n- Mode: ${payload.mode}\n- Jurisdiction: ${payload.jurisdiction}\n${
            payload.compareJurisdiction ? `- Comparison Jurisdiction: ${payload.compareJurisdiction}\n` : ''
          }${precedentsText ? `- Law Library Precedents Applied: ${precedentsText}\n` : ''}\n## Statutory Citations\n${
            (payload.citations || []).map((c) => `- ${c}`).join('\n') || '- None extracted'
          }\n\n## Legal Analysis\n\n${payload.content}\n\n## Verified Sources\n${
            (payload.sources || []).map((s) => `- [${s.title}](${s.uri})`).join('\n') || '- None'
          }\n`;

    const blob = new Blob([contentStr], {
      type:
        format === 'json'
          ? 'application/json'
          : format === 'txt'
          ? 'text/plain;charset=utf-8'
          : 'text/markdown;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeSlug}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadDossier = (entry: LegalDossierEntry) => {
    setActiveBrief({
      success: true,
      content: entry.content,
      citations: entry.citations,
      sources: entry.sources,
      servedByModel: entry.servedByModel || 'archive',
      jurisdiction: entry.jurisdiction,
      compareJurisdiction: entry.compareJurisdiction,
      practiceArea: entry.practiceArea,
      mode: entry.mode,
      defenseStatementType: entry.defenseStatementType,
      houseEntityName: entry.houseEntityName,
      opposingParty: entry.opposingParty,
      precedentsUsed: entry.precedentsUsed,
    });
    setActiveBriefTitle(entry.title);
    setQuery(entry.query);
    setPracticeArea(entry.practiceArea);
    setMode(entry.mode);
    if (entry.defenseStatementType) {
      setDefenseStatementType(entry.defenseStatementType);
    }
    if (entry.houseEntityName) {
      setHouseEntityName(entry.houseEntityName);
    }
    if (entry.opposingParty !== undefined) {
      setOpposingParty(entry.opposingParty || '');
    }
    if (entry.precedentsUsed && entry.precedentsUsed.length > 0) {
      setSelectedPrecedentIds(entry.precedentsUsed.map((p) => p.id).filter(Boolean));
    }
    setWorkspaceView(entry.mode === 'defense_strategy' ? 'strategy' : 'desk');
  };

  const handleSendToChat = async () => {
    if (!activeBrief?.content) return;
    const summaryText = `Grey House Legal Brief (${activeBrief.jurisdiction} · ${PRACTICE_LABELS[activeBrief.practiceArea]}):\n\n${activeBrief.content.slice(0, 2400)}`;
    try {
      await navigator.clipboard.writeText(summaryText);
    } catch {
      // ignore
    }
    if (onNavigate) {
      onNavigate(AppTab.CHAT);
    }
  };

  const handleSelectLadyGreyShield = (includeEducatorPrecedents: boolean) => {
    setHouseEntityName('Lady Grey (Educator) — House Grey');
    setDefenseStatementType('educator_bureaucracy_shield');
    setPracticeArea('professional');
    if (includeEducatorPrecedents) {
      const eduPrecedents = matchPrecedentsForScenario(
        'professional',
        'teacher lady grey school district bureaucracy loudermill garrity pickering',
        5
      );
      setSelectedPrecedentIds(eduPrecedents.map((p) => p.id));
    }
  };

  const renderProtectedAndAdversePartyFields = (inputBgClass: string, includeEducatorPrecedents: boolean) => (
    <>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <label className="text-[11px] font-mono text-zinc-400">Protected Party</label>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setHouseEntityName('The Grey House / Principal Preston Johnston')}
              className="text-[10px] font-mono text-amber-400 hover:text-amber-300 cursor-pointer"
            >
              House Grey
            </button>
            <span className="text-zinc-600 text-[10px]">·</span>
            <button
              type="button"
              onClick={() => handleSelectLadyGreyShield(includeEducatorPrecedents)}
              className="text-[10px] font-mono text-amber-400 hover:text-amber-300 cursor-pointer"
            >
              Lady Grey (Teacher)
            </button>
          </div>
        </div>
        <input
          type="text"
          value={houseEntityName}
          onChange={(e) => setHouseEntityName(e.target.value)}
          placeholder="The Grey House / Lady Grey"
          className={`w-full px-2.5 ${inputBgClass} border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-amber-500/50`}
        />
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-mono text-zinc-400 block">
          Adverse Party / Claimant / Agency (Optional)
        </label>
        <input
          type="text"
          value={opposingParty}
          onChange={(e) => setOpposingParty(e.target.value)}
          placeholder="Opposing party, claimant, or agency"
          className={`w-full px-2.5 ${inputBgClass} border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-amber-500/50`}
        />
      </div>
    </>
  );

  const renderBriefOutput = () => (
    <>
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-500/40 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 text-xs text-red-200">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => executeCounselQuery()}
            className="px-2.5 py-1 rounded-md text-[11px] font-mono font-bold bg-black/60 border border-red-400/40 text-red-200 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {activeBrief ? (
        <div className="bg-zinc-950/80 border border-red-900/30 rounded-xl p-4 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-red-900/20 pb-4">
            <div className="space-y-1 min-w-0">
              <h2 className="text-base font-black text-amber-300 tracking-tight break-words">
                {activeBriefTitle || 'Grey House Statutory Counsel Brief'}
              </h2>
              <div className="text-[11px] font-mono text-zinc-400">
                {activeBrief.jurisdiction}
                {activeBrief.compareJurisdiction ? ` vs ${activeBrief.compareJurisdiction}` : ''} ·{' '}
                {PRACTICE_LABELS[activeBrief.practiceArea]} · {MODE_LABELS[activeBrief.mode]}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleSpeakBrief}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                  isSpeakingBrief
                    ? 'bg-red-900 text-amber-300 border-amber-500/60'
                    : 'bg-black text-zinc-200 border-zinc-800 hover:border-amber-500/50'
                }`}
              >
                {isSpeakingBrief ? (
                  <>
                    <Square className="w-3 h-3" />
                    <span>Stop Voice</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>Speak Brief</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleSaveDossier}
                disabled={isSavingDossier}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-black text-zinc-200 border border-zinc-800 hover:border-amber-500/50 whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
              >
                {copiedState === 'saved' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Saved</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5 text-amber-400" />
                    <span>Save Dossier</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleCopyBrief}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-black text-zinc-300 border border-zinc-800 hover:border-amber-500/50 whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
              >
                {copiedState === 'brief' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleExportBrief('txt')}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-black text-zinc-300 border border-zinc-800 hover:border-amber-500/50 whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>.TXT</span>
              </button>

              <button
                type="button"
                onClick={() => handleExportBrief('md')}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-black text-zinc-300 border border-zinc-800 hover:border-amber-500/50 whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>.MD</span>
              </button>

              <button
                type="button"
                onClick={() => handleExportBrief('json')}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-black text-zinc-300 border border-zinc-800 hover:border-amber-500/50 whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>.JSON</span>
              </button>

              {onNavigate && (
                <button
                  type="button"
                  onClick={handleSendToChat}
                  title="Copy brief & switch to Dialogue Core"
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-black text-zinc-300 border border-zinc-800 hover:border-amber-500/50 whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Chat</span>
                </button>
              )}
            </div>
          </div>

          {activeBrief.precedentsUsed && activeBrief.precedentsUsed.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
                Law Library Precedents Applied
              </div>
              <div className="flex flex-wrap gap-1.5">
                {activeBrief.precedentsUsed.map((p) => (
                  <button
                    type="button"
                    key={p.id || p.citation}
                    onClick={() => setWorkspaceView('library')}
                    title={p.doctrine}
                    className="px-2.5 py-1 rounded-md bg-red-950/60 border border-amber-500/30 hover:border-amber-400 text-[11px] font-mono text-zinc-200 transition-colors cursor-pointer"
                  >
                    <span className="text-amber-300 font-semibold">{p.caseName}</span> · {p.citation}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeBrief.citations && activeBrief.citations.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
                Cited Authorities (Click to Inspect Statute)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {activeBrief.citations.map((cite) => (
                  <button
                    type="button"
                    key={cite}
                    onClick={() => handleCitationLookup(cite)}
                    className="px-2 py-1 rounded-md bg-black border border-amber-500/30 hover:border-amber-400 text-[11px] font-mono text-amber-300 transition-colors cursor-pointer"
                  >
                    {cite}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="prose prose-invert prose-sm max-w-none prose-headings:text-amber-300 prose-headings:font-bold prose-strong:text-zinc-100 prose-a:text-amber-400 prose-table:border-collapse prose-th:border prose-th:border-zinc-800 prose-th:bg-black prose-th:px-3 prose-th:py-2 prose-td:border prose-td:border-zinc-800 prose-td:px-3 prose-td:py-2 text-zinc-300 leading-relaxed">
            <Markdown>{activeBrief.content}</Markdown>
          </div>

          {activeBrief.sources && activeBrief.sources.length > 0 && (
            <div className="pt-4 border-t border-red-900/20 space-y-2">
              <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                Verified Statutory & Government Sources
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {activeBrief.sources.map((src) => (
                  <a
                    key={src.uri}
                    href={src.uri}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2.5 rounded-lg bg-black border border-zinc-800 hover:border-amber-500/40 flex items-center justify-between gap-2 text-xs text-zinc-300 hover:text-amber-300 transition-colors"
                  >
                    <span className="truncate">{src.title}</span>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0 text-zinc-500" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-zinc-950/60 border border-red-900/20 rounded-xl p-8 text-center space-y-3">
          <Scale className="w-8 h-8 text-amber-500/70 mx-auto" />
          <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider">
            Grey House Legal Vault Standing By
          </h3>
          <p className="text-xs text-zinc-400 max-w-xl mx-auto leading-relaxed">
            Select Federal or any of the 50 U.S. States, attach controlling U.S. Law Library precedents in the Defense Strategy Builder, or submit your directive above to verify controlling statutes immediately.
          </p>
        </div>
      )}
    </>
  );

  return (
    <div className="h-full w-full overflow-y-auto bg-[#0a0a0b] text-zinc-200 custom-scrollbar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-5">
        {/* Header Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-red-900/30 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <Scale className="w-5 h-5 text-amber-400 shrink-0" />
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-zinc-100 uppercase">
                Grey House Legal Counsel
              </h1>
            </div>
            <p className="text-xs text-zinc-400 font-mono">
              Defense of House Grey (Civil & Criminal) · Lady Grey Educator Anti-Bureaucracy Shield · U.S. Code 1–54 & All 50 States
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (mode === 'defense_strategy') setMode('legal_counsel');
                setWorkspaceView('desk');
              }}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer ${
                workspaceView === 'desk'
                  ? 'bg-amber-500 text-black border-amber-400'
                  : 'bg-zinc-950 text-zinc-300 border-zinc-800 hover:border-amber-500/40'
              }`}
            >
              <Landmark className="w-3.5 h-3.5" />
              <span>Counsel Desk</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('defense_strategy');
                setWorkspaceView('strategy');
              }}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer ${
                workspaceView === 'strategy'
                  ? 'bg-amber-500 text-black border-amber-400'
                  : 'bg-zinc-950 text-zinc-300 border-zinc-800 hover:border-amber-500/40'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Defense Strategy Builder</span>
            </button>
            <button
              type="button"
              onClick={() => setWorkspaceView('library')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer tabular-nums ${
                workspaceView === 'library'
                  ? 'bg-amber-500 text-black border-amber-400'
                  : 'bg-zinc-950 text-zinc-300 border-zinc-800 hover:border-amber-500/40'
              }`}
            >
              <Library className="w-3.5 h-3.5" />
              <span>Law Library ({US_LAW_LIBRARY_PRECEDENTS.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setWorkspaceView('archive')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer tabular-nums ${
                workspaceView === 'archive'
                  ? 'bg-amber-500 text-black border-amber-400'
                  : 'bg-zinc-950 text-zinc-300 border-zinc-800 hover:border-amber-500/40'
              }`}
            >
              <FolderArchive className="w-3.5 h-3.5" />
              <span>Saved Dossiers ({dossiers.length})</span>
            </button>
          </div>
        </div>

        {/* Practice Area & Mode Bar */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 bg-zinc-950/80 border border-red-900/30 rounded-xl p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {PRACTICE_TABS.map((tab) => {
              const IconComp = tab.icon;
              const active = practiceArea === tab.id;
              return (
                <button
                  type="button"
                  key={tab.id}
                  onClick={() => setPracticeArea(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                    active
                      ? 'bg-red-950 text-amber-300 border border-amber-500/50'
                      : 'text-zinc-400 hover:text-zinc-200 border border-transparent hover:border-zinc-800'
                  }`}
                >
                  <IconComp className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 border-t xl:border-t-0 pt-2 xl:pt-0 border-zinc-800/80">
            {MODE_OPTIONS.map((opt) => (
              <button
                type="button"
                key={opt.id}
                onClick={() => {
                  setMode(opt.id);
                  if (opt.id === 'defense_strategy') {
                    setWorkspaceView('strategy');
                  } else if (workspaceView === 'strategy' || workspaceView === 'library' || workspaceView === 'archive') {
                    setWorkspaceView('desk');
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  mode === opt.id
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/50'
                    : 'bg-black/40 text-zinc-400 border border-zinc-800 hover:text-zinc-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {workspaceView === 'library' ? (
          /* Internal Grey House U.S. Law Library */
          <div className="bg-zinc-950/80 border border-red-900/30 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-red-900/20 pb-3">
              <div>
                <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">
                  Grey House Internal U.S. Law Library
                </h2>
                <p className="text-xs text-zinc-400">
                  Controlling U.S. Supreme Court, Appellate, and Delaware Chancery precedents curated for House defense.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={librarySearch}
                    onChange={(e) => setLibrarySearch(e.target.value)}
                    placeholder="Search case, doctrine, or statute..."
                    className="pl-8 pr-3 py-1.5 bg-black border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <select
                  value={libraryDomainFilter}
                  onChange={(e) => setLibraryDomainFilter(e.target.value as LegalPracticeArea)}
                  className="px-2.5 py-1.5 bg-black border border-zinc-800 rounded-lg text-xs text-zinc-300 focus:outline-none focus:border-amber-500/50"
                >
                  <option value="all">All Domains</option>
                  <option value="professional">Professional</option>
                  <option value="business">Business</option>
                  <option value="criminal">Criminal</option>
                  <option value="civil">Civil</option>
                  <option value="constitutional">Constitutional</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredLibraryPrecedents.map((prec) => {
                const isAttached = selectedPrecedentIds.includes(prec.id);
                return (
                  <div
                    key={prec.id}
                    className={`p-4 rounded-xl border bg-black/70 space-y-2.5 flex flex-col justify-between ${
                      isAttached ? 'border-amber-500/60' : 'border-zinc-800'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-bold text-amber-300">{prec.caseName}</h3>
                          <div className="text-[11px] font-mono text-zinc-400 tabular-nums">
                            {prec.citation} · {prec.court} · {prec.year} · {PRACTICE_LABELS[prec.domain]}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs font-semibold text-zinc-100">{prec.doctrine}</div>
                      <p className="text-xs text-zinc-400 leading-relaxed">{prec.holdingSummary}</p>
                      <div className="pt-1 border-t border-zinc-900 text-xs text-zinc-300 leading-relaxed">
                        <span className="font-mono text-[11px] uppercase tracking-wider text-amber-400 block mb-0.5">
                          House Defensive Application
                        </span>
                        {prec.defensiveApplication}
                      </div>
                      {prec.relatedStatutes.length > 0 && (
                        <div className="text-[11px] font-mono text-zinc-500">
                          Authorities: {prec.relatedStatutes.join(' · ')}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-900">
                      <button
                        type="button"
                        onClick={() => togglePrecedent(prec.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                          isAttached
                            ? 'bg-amber-500 text-black border-amber-400'
                            : 'bg-zinc-950 text-zinc-200 border-zinc-800 hover:border-amber-500/50'
                        }`}
                      >
                        {isAttached ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                        <span>{isAttached ? 'Attached to Strategy' : 'Add to Strategy Builder'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMode('legal_counsel');
                          const counselPrompt = `Analyze ${prec.caseName} (${prec.citation}) in full operational detail for defense of the Grey House, including elements, exceptions, current appellate posture, and how to invoke it alongside ${prec.relatedStatutes.join(', ')}.`;
                          setQuery(counselPrompt);
                          setDossierTitle(`${prec.caseName} Counsel Brief`);
                          executeCounselQuery({
                            queryText: counselPrompt,
                            practice: prec.domain === 'constitutional' ? 'all' : prec.domain,
                            researchMode: 'legal_counsel',
                            titleHint: `${prec.caseName} (${prec.citation})`,
                            precedentsOverride: [prec],
                          });
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-950 text-zinc-300 border border-zinc-800 hover:border-amber-500/40 whitespace-nowrap cursor-pointer"
                      >
                        Analyze Precedent
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : workspaceView === 'strategy' ? (
          /* Defense Strategy Builder Workspace */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left Column: Internal U.S. Law Library Precedent Selector */}
            <div className="lg:col-span-5 bg-zinc-950/80 border border-red-900/30 rounded-xl p-4 space-y-3.5">
              <div className="flex items-start justify-between gap-2 border-b border-red-900/20 pb-3">
                <div>
                  <h2 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Library className="w-3.5 h-3.5" />
                    <span>Law Library Precedents</span>
                  </h2>
                  <p className="text-[11px] text-zinc-400 mt-0.5 tabular-nums">
                    Attached: {selectedPrecedents.length} / 8 (auto-matches if empty)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAutoMatchPrecedents}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold bg-red-950 text-amber-300 border border-amber-500/40 hover:border-amber-400 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Auto-Match</span>
                </button>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={precedentPickerSearch}
                  onChange={(e) => setPrecedentPickerSearch(e.target.value)}
                  placeholder="Filter Law Library precedents..."
                  className="w-full pl-8 pr-3 py-1.5 bg-black border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div className="max-h-[540px] overflow-y-auto divide-y divide-zinc-900 pr-1 custom-scrollbar">
                {pickerPrecedents.map((prec) => {
                  const isAttached = selectedPrecedentIds.includes(prec.id);
                  return (
                    <div key={prec.id} className="py-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-amber-300 truncate">
                            {prec.caseName}
                          </div>
                          <div className="text-[11px] font-mono text-zinc-400 tabular-nums">
                            {prec.citation} · {prec.year} · {PRACTICE_LABELS[prec.domain]}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => togglePrecedent(prec.id)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            isAttached
                              ? 'bg-amber-500 text-black border-amber-400'
                              : 'bg-black text-zinc-300 border-zinc-800 hover:border-amber-500/40'
                          }`}
                        >
                          {isAttached ? 'Attached' : 'Attach'}
                        </button>
                      </div>
                      <div className="text-[11px] font-semibold text-zinc-200">{prec.doctrine}</div>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">
                        {prec.defensiveApplication}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Scenario Builder & Strategy Output */}
            <div className="lg:col-span-7 space-y-5">
              <div className="bg-zinc-950/80 border border-red-900/30 rounded-xl p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-red-900/20 pb-3">
                  <div>
                    <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider flex items-center gap-2">
                      <Shield className="w-4 h-4 text-amber-400" />
                      <span>Grey House Defense Strategy Builder</span>
                    </h2>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Synthesizes scenario threats, U.S. Law Library precedents, and live U.S. Code verification into a formal Defensive Statement.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-[11px] font-mono text-zinc-400">
                        Primary Jurisdiction
                      </label>
                      <a
                        href={selectedJurisdiction.officialUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-mono text-zinc-400 hover:text-amber-300 flex items-center gap-1"
                      >
                        <span>Code</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <select
                      value={jurisdictionCode}
                      onChange={(e) => setJurisdictionCode(e.target.value)}
                      className="w-full px-2.5 py-2 bg-black border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-amber-500/60"
                    >
                      {US_JURISDICTIONS.map((j) => (
                        <option key={j.code} value={j.code}>
                          {j.level === 'federal' ? j.name : `${j.name} (${j.code}) — ${j.officialCodeName}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-mono text-zinc-400 block">
                      Target Defensive Statement Instrument
                    </label>
                    <select
                      value={defenseStatementType}
                      onChange={(e) =>
                        setDefenseStatementType(e.target.value as LegalDefenseStatementType)
                      }
                      className="w-full px-2.5 py-2 bg-black border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-amber-500/60"
                    >
                      {LEGAL_DEFENSE_STATEMENT_TEMPLATES.map((tpl) => (
                        <option key={tpl.id} value={tpl.id}>
                          {tpl.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {renderProtectedAndAdversePartyFields('py-2 bg-black', true)}
                </div>

                {selectedPrecedents.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                      <span>Attached Precedents ({selectedPrecedents.length})</span>
                      <button
                        type="button"
                        onClick={() => setSelectedPrecedentIds([])}
                        className="text-zinc-500 hover:text-zinc-200 cursor-pointer"
                      >
                        Clear All
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedPrecedents.map((p) => (
                        <button
                          type="button"
                          key={p.id}
                          onClick={() => togglePrecedent(p.id)}
                          className="px-2.5 py-1 rounded-md bg-black border border-amber-500/40 text-[11px] font-mono text-amber-300 flex items-center gap-1.5 cursor-pointer hover:border-red-400"
                        >
                          <span>{p.caseName}</span>
                          <X className="w-3 h-3 text-zinc-400" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <textarea
                  rows={5}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                      e.preventDefault();
                      executeCounselQuery({ researchMode: 'defense_strategy' });
                    }
                  }}
                  placeholder="Describe the legal scenario, claim, subpoena, regulatory threat, contract dispute, or criminal/civil exposure facing the Grey House (Ctrl/Cmd + Enter)..."
                  className="w-full p-3 bg-black border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/60 resize-y"
                />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <input
                    type="text"
                    value={dossierTitle}
                    onChange={(e) => setDossierTitle(e.target.value)}
                    placeholder="Optional Strategy Dossier Title"
                    className="flex-1 px-3 py-2 bg-black border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50"
                  />
                  <button
                    type="button"
                    disabled={isResearching || !query.trim()}
                    onClick={() => executeCounselQuery({ researchMode: 'defense_strategy' })}
                    className="px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isResearching ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Synthesizing Strategy...</span>
                      </>
                    ) : (
                      <>
                        <Shield className="w-3.5 h-3.5" />
                        <span>Generate Defense Strategy & Statement</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {renderBriefOutput()}
            </div>
          </div>
        ) : workspaceView === 'archive' ? (
          /* Saved Dossiers Archive View */
          <div className="bg-zinc-950/80 border border-red-900/30 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-red-900/20 pb-3">
              <div>
                <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">
                  Grey House Legal Dossier Vault
                </h2>
                <p className="text-xs text-zinc-400">
                  Persisted legal opinions, U.S. statute citations, and jurisdictional comparisons for leisure audit.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={archiveSearch}
                    onChange={(e) => setArchiveSearch(e.target.value)}
                    placeholder="Filter saved briefs..."
                    className="pl-8 pr-3 py-1.5 bg-black border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <select
                  value={archiveAreaFilter}
                  onChange={(e) => setArchiveAreaFilter(e.target.value as LegalPracticeArea)}
                  className="px-2.5 py-1.5 bg-black border border-zinc-800 rounded-lg text-xs text-zinc-300 focus:outline-none focus:border-amber-500/50"
                >
                  <option value="all">All Practice Areas</option>
                  <option value="professional">Professional</option>
                  <option value="business">Business</option>
                  <option value="criminal">Criminal</option>
                  <option value="civil">Civil</option>
                </select>
              </div>
            </div>

            {isLoadingDossiers ? (
              <div className="py-12 flex items-center justify-center gap-2 text-xs text-zinc-400">
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                <span>Loading Grey House legal dossiers...</span>
              </div>
            ) : filteredDossiers.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <p className="text-sm text-zinc-300 font-medium">No saved legal dossiers match the current filter.</p>
                <p className="text-xs text-zinc-500">
                  Execute a statutory lookup or counsel inquiry on the Counsel Desk and save it here for permanent reference.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-red-900/20">
                {filteredDossiers.map((entry) => (
                  <div
                    key={entry.id}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <button
                        type="button"
                        onClick={() => handleLoadDossier(entry)}
                        className="text-left text-sm font-bold text-amber-300 hover:text-amber-200 transition-colors cursor-pointer truncate block max-w-full"
                      >
                        {entry.title}
                      </button>
                      <div className="text-[11px] font-mono text-zinc-400 tabular-nums truncate">
                        {PRACTICE_LABELS[entry.practiceArea] || entry.practiceArea} · {MODE_LABELS[entry.mode] || entry.mode} · {entry.jurisdiction} · {new Date(entry.updatedAt || entry.createdAt).toLocaleDateString()}
                      </div>
                      {entry.citations && entry.citations.length > 0 && (
                        <div className="text-[11px] font-mono text-zinc-500 truncate">
                          Citations: {entry.citations.slice(0, 4).join(', ')}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleLoadDossier(entry)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-black border border-zinc-800 hover:border-amber-500/40 text-zinc-200 whitespace-nowrap cursor-pointer"
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExportBrief('md', entry)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-black border border-zinc-800 hover:border-amber-500/40 text-zinc-300 whitespace-nowrap cursor-pointer"
                      >
                        Export
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteDossier(entry.id)}
                        title="Delete Dossier"
                        className="p-1.5 rounded-lg bg-black border border-zinc-800 hover:border-red-500/50 text-zinc-400 hover:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Main Two-Column Counsel Desk */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left Column: Jurisdictions & U.S. Code Statutory Index */}
            <div className="lg:col-span-4 bg-zinc-950/80 border border-red-900/30 rounded-xl p-4 space-y-4">
              {/* Primary Jurisdiction Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-bold">
                    Primary Jurisdiction
                  </label>
                  <a
                    href={selectedJurisdiction.officialUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-mono text-zinc-400 hover:text-amber-300 flex items-center gap-1 whitespace-nowrap"
                  >
                    <span>Official Code</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <select
                  value={jurisdictionCode}
                  onChange={(e) => setJurisdictionCode(e.target.value)}
                  className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-amber-500/60"
                >
                  {US_JURISDICTIONS.map((j) => (
                    <option key={j.code} value={j.code}>
                      {j.level === 'federal' ? j.name : `${j.name} (${j.code}) — ${j.officialCodeName}`}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  {selectedJurisdiction.statutoryFocus}
                </p>
              </div>

              {/* Comparison Jurisdiction Selector */}
              {mode === 'state_compare' && (
                <div className="space-y-2 pt-3 border-t border-red-900/20">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1.5">
                    <ArrowLeftRight className="w-3 h-3" />
                    <span>Compare Against Jurisdiction</span>
                  </label>
                  <select
                    value={compareJurisdictionCode}
                    onChange={(e) => setCompareJurisdictionCode(e.target.value)}
                    className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-amber-500/60"
                  >
                    {US_JURISDICTIONS.map((j) => (
                      <option key={j.code} value={j.code}>
                        {j.level === 'federal' ? j.name : `${j.name} (${j.code})`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Directory Switcher: 50 States vs 54 U.S. Code Titles */}
              <div className="pt-3 border-t border-red-900/20 space-y-3">
                <div className="grid grid-cols-2 gap-1.5 bg-black p-1 rounded-lg border border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setDirectoryTab('jurisdictions')}
                    className={`py-1.5 px-2 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                      directoryTab === 'jurisdictions'
                        ? 'bg-red-950 text-amber-300 border border-amber-500/40'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    All 50 States + Fed
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirectoryTab('uscode')}
                    className={`py-1.5 px-2 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                      directoryTab === 'uscode'
                        ? 'bg-red-950 text-amber-300 border border-amber-500/40'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    U.S. Code (1–54)
                  </button>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={directorySearch}
                    onChange={(e) => setDirectorySearch(e.target.value)}
                    placeholder={
                      directoryTab === 'jurisdictions'
                        ? 'Search state or code name...'
                        : 'Search U.S. Code title or subject...'
                    }
                    className="w-full pl-8 pr-3 py-1.5 bg-black border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div className="max-h-[420px] overflow-y-auto divide-y divide-zinc-900 pr-1 custom-scrollbar">
                  {directoryTab === 'jurisdictions'
                    ? filteredJurisdictions.map((j) => {
                        const isSelected = j.code === jurisdictionCode;
                        return (
                          <div
                            key={j.code}
                            className={`py-2.5 flex items-start justify-between gap-2 ${
                              isSelected ? 'text-amber-300' : 'text-zinc-300'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => setJurisdictionCode(j.code)}
                              className="text-left min-w-0 flex-1 cursor-pointer group"
                            >
                              <div className="text-xs font-bold flex items-center gap-1.5">
                                <span className="font-mono text-[11px] text-amber-500 tabular-nums">
                                  {j.code}
                                </span>
                                <span className="group-hover:text-amber-300 transition-colors truncate">
                                  {j.name}
                                </span>
                              </div>
                              <div className="text-[11px] text-zinc-500 truncate mt-0.5">
                                {j.officialCodeName}
                              </div>
                            </button>
                            <a
                              href={j.officialUrl}
                              target="_blank"
                              rel="noreferrer"
                              title={`Open ${j.officialCodeName}`}
                              className="p-1 text-zinc-500 hover:text-amber-300 shrink-0"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        );
                      })
                    : filteredUsCodeTitles.map((t) => (
                        <div key={t.titleNumber} className="py-2.5 flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => handleSelectUsCodeTitle(t)}
                            className="text-left min-w-0 flex-1 cursor-pointer group"
                          >
                            <div className="text-xs font-bold text-zinc-200 group-hover:text-amber-300 transition-colors tabular-nums">
                              {t.label}
                            </div>
                            <div className="text-[11px] text-zinc-500 line-clamp-2 mt-0.5">
                              {t.summary}
                            </div>
                          </button>
                          <a
                            href={t.url}
                            target="_blank"
                            rel="noreferrer"
                            title={`Open ${t.titleNumber} U.S.C. text`}
                            className="p-1 text-zinc-500 hover:text-amber-300 shrink-0"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      ))}
                </div>
              </div>
            </div>

            {/* Right Column: Legal Counsel Inquiry & Grounded Output */}
            <div className="lg:col-span-8 space-y-5">
              {/* Query Console */}
              <div className="bg-zinc-950/80 border border-red-900/30 rounded-xl p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="text-xs font-mono text-zinc-400">
                    Defense Scope:{' '}
                    <span className="text-amber-300 font-semibold">{selectedJurisdiction.name}</span>
                    {selectedCompareJurisdiction && (
                      <>
                        {' '}
                        vs{' '}
                        <span className="text-amber-300 font-semibold">
                          {selectedCompareJurisdiction.name}
                        </span>
                      </>
                    )}{' '}
                    · {PRACTICE_LABELS[practiceArea]} · {MODE_LABELS[mode]}
                  </div>
                  <button
                    type="button"
                    onClick={() => setMode('defense_statement')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-bold border transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                      mode === 'defense_statement'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/60'
                        : 'bg-black text-zinc-300 border-zinc-800 hover:border-amber-500/40'
                    }`}
                  >
                    <Shield className="w-3 h-3 text-amber-400" />
                    <span>Draft House Defense Statement</span>
                  </button>
                </div>

                {mode === 'defense_statement' && (
                  <div className="bg-black/70 border border-amber-500/30 rounded-lg p-3.5 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wider">
                      <FileSignature className="w-4 h-4 shrink-0" />
                      <span>Grey House Defense Statement Builder</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="sm:col-span-1 space-y-1">
                        <label className="text-[11px] font-mono text-zinc-400 block">
                          Statement Instrument
                        </label>
                        <select
                          value={defenseStatementType}
                          onChange={(e) => {
                            const val = e.target.value as LegalDefenseStatementType;
                            setDefenseStatementType(val);
                            const preset = LEGAL_DEFENSE_STATEMENT_TEMPLATES.find((p) => p.id === val);
                            if (preset && !query.trim()) {
                              setQuery(preset.defaultPrompt);
                              setDossierTitle(preset.label);
                            }
                          }}
                          className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-amber-500/50"
                        >
                          {LEGAL_DEFENSE_STATEMENT_TEMPLATES.map((tpl) => (
                            <option key={tpl.id} value={tpl.id}>
                              {tpl.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      {renderProtectedAndAdversePartyFields('py-1.5 bg-zinc-950', false)}
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {LEGAL_DEFENSE_STATEMENT_TEMPLATES.map((tpl) => (
                        <button
                          type="button"
                          key={tpl.id}
                          onClick={() => {
                            setDefenseStatementType(tpl.id);
                            setPracticeArea(tpl.domain);
                            setQuery(tpl.defaultPrompt);
                            setDossierTitle(tpl.label);
                          }}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-mono border transition-colors cursor-pointer ${
                            defenseStatementType === tpl.id
                              ? 'bg-red-950 text-amber-300 border-amber-500/50'
                              : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                          }`}
                        >
                          {tpl.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <textarea
                  rows={4}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                      e.preventDefault();
                      executeCounselQuery();
                    }
                  }}
                  placeholder={
                    mode === 'defense_statement'
                      ? 'Describe the facts, dates, adverse notice, threat, or asset to defend so ZereØ can draft a formal Grey House Defense Statement (Ctrl/Cmd + Enter)...'
                      : 'Enter your legal inquiry, defense posture, contract issue, criminal/civil statute, or multi-state comparison directive (Ctrl/Cmd + Enter to run)...'
                  }
                  className="w-full p-3 bg-black border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/60 resize-y"
                />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <input
                    type="text"
                    value={dossierTitle}
                    onChange={(e) => setDossierTitle(e.target.value)}
                    placeholder="Optional Dossier Title (for archiving)"
                    className="flex-1 px-3 py-2 bg-black border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50"
                  />
                  <button
                    type="button"
                    disabled={isResearching || !query.trim()}
                    onClick={() => executeCounselQuery()}
                    className="px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isResearching ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>
                          {mode === 'defense_statement'
                            ? 'Drafting Defense Statement...'
                            : 'Verifying Statutes...'}
                        </span>
                      </>
                    ) : (
                      <>
                        {mode === 'defense_statement' ? (
                          <FileSignature className="w-3.5 h-3.5" />
                        ) : (
                          <BookOpen className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {mode === 'defense_statement'
                            ? 'Draft Defense Statement'
                            : 'Run Counsel Research'}
                        </span>
                      </>
                    )}
                  </button>
                </div>

                {/* Quick Counsel Brief Presets */}
                <div className="pt-3 border-t border-red-900/20 space-y-2">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
                    Rapid Grey House Briefings
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {visibleTemplates.map((tpl) => (
                      <button
                        type="button"
                        key={tpl.id}
                        onClick={() => {
                          setPracticeArea(tpl.domain);
                          setMode(tpl.mode);
                          if (tpl.defenseStatementType) {
                            setDefenseStatementType(tpl.defenseStatementType);
                          }
                          if (tpl.id === 'prof-lady-grey-teacher') {
                            setHouseEntityName('Lady Grey (Educator) — House Grey');
                          }
                          const matched =
                            tpl.mode === 'defense_strategy'
                              ? matchPrecedentsForScenario(tpl.domain, tpl.prompt, 4)
                              : undefined;
                          if (matched) {
                            setSelectedPrecedentIds(matched.map((p) => p.id));
                          }
                          setQuery(tpl.prompt);
                          setDossierTitle(tpl.title);
                          executeCounselQuery({
                            queryText: tpl.prompt,
                            practice: tpl.domain,
                            researchMode: tpl.mode,
                            statementType: tpl.defenseStatementType,
                            titleHint: tpl.title,
                            precedentsOverride: matched,
                          });
                        }}
                        className="p-2.5 rounded-lg bg-black/70 border border-zinc-800 hover:border-amber-500/50 text-left transition-colors cursor-pointer group"
                      >
                        <div className="text-xs font-bold text-zinc-200 group-hover:text-amber-300 transition-colors">
                          {tpl.title}
                        </div>
                        <div className="text-[11px] font-mono text-zinc-500 mt-0.5">
                          {PRACTICE_LABELS[tpl.domain]} · {MODE_LABELS[tpl.mode]}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {renderBriefOutput()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LegalCounselPortal;
