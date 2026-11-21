import React, { useEffect, useMemo, useState } from 'react';
import {
  Play,
  Square,
  Trash2,
  Download,
  FileJson,
  FileText,
  Search,
  Volume2,
  Mic,
  MessageSquare,
  RotateCcw,
  CheckSquare,
  Square as UncheckedSquare
} from 'lucide-react';
import { Socket } from 'socket.io-client';
import { VoiceCommandLogEntry, VoiceCommandSource } from '../types';
import {
  fetchVoiceCommandLogs,
  replayVoiceLogEntry,
  stopVoiceLogReplay,
  deleteVoiceCommandLog,
  clearVoiceCommandLogs,
  exportSelectedVoiceLogs,
  hasCachedLiveAudio,
  ReplayMode,
  ReplayPhase
} from '../services/voiceCommandLogService';
import TranscriptWaveform from './TranscriptWaveform';

interface VoiceCommandLogPanelProps {
  socket?: Socket | null;
  onFocusSynthesizer?: () => void;
  refreshSignal?: number;
}

type SourceFilter = 'all' | VoiceCommandSource;

const SOURCE_LABELS: Record<VoiceCommandSource, string> = {
  live_bridge: 'Live Bridge',
  conversation_mode: 'Conversation Mode',
  synthesizer: 'Vocal Synthesizer'
};

const VoiceCommandLogPanel: React.FC<VoiceCommandLogPanelProps> = ({
  socket,
  onFocusSynthesizer,
  refreshSignal = 0
}) => {
  const [logs, setLogs] = useState<VoiceCommandLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [activeReplayId, setActiveReplayId] = useState<string | null>(null);
  const [replayPhase, setReplayPhase] = useState<ReplayPhase>('idle');
  const [replayMode, setReplayMode] = useState<ReplayMode>('full');
  const [confirmClearAll, setConfirmClearAll] = useState<boolean>(false);

  const loadLogs = async () => {
    const items = await fetchVoiceCommandLogs({ limit: 250 });
    setLogs(items);
    setIsLoading(false);
  };

  useEffect(() => {
    void loadLogs();
  }, [refreshSignal]);

  // Keep selectedIds synced with existing logs so deleted entries don't linger
  useEffect(() => {
    const validIds = new Set(logs.map((l) => l.id));
    setSelectedIds((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (validIds.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [logs]);

  useEffect(() => {
    if (!socket) return;

    const handleLogged = (entry: VoiceCommandLogEntry) => {
      if (!entry || !entry.id) return;
      setLogs((prev) => {
        const filtered = prev.filter((item) => item.id !== entry.id);
        return [entry, ...filtered].slice(0, 250);
      });
    };

    const handleReplayed = (updated: VoiceCommandLogEntry) => {
      if (!updated || !updated.id) return;
      setLogs((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    };

    const handleDeleted = ({ id }: { id: string }) => {
      setLogs((prev) => prev.filter((item) => item.id !== id));
    };

    const handleCleared = () => {
      setLogs([]);
      setSelectedIds(new Set());
    };

    socket.on('voice:command_logged', handleLogged);
    socket.on('voice:command_replayed', handleReplayed);
    socket.on('voice:command_deleted', handleDeleted);
    socket.on('voice:commands_cleared', handleCleared);

    return () => {
      socket.off('voice:command_logged', handleLogged);
      socket.off('voice:command_replayed', handleReplayed);
      socket.off('voice:command_deleted', handleDeleted);
      socket.off('voice:commands_cleared', handleCleared);
    };
  }, [socket]);

  useEffect(() => {
    return () => {
      stopVoiceLogReplay();
    };
  }, []);

  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return logs.filter((entry) => {
      if (sourceFilter !== 'all' && entry.source !== sourceFilter) return false;
      if (!q) return true;
      return (
        String(entry.commandText || '').toLowerCase().includes(q) ||
        String(entry.responseText || '').toLowerCase().includes(q) ||
        String(entry.voiceProfile || '').toLowerCase().includes(q)
      );
    });
  }, [logs, sourceFilter, searchQuery]);

  const counts = useMemo(() => {
    return {
      all: logs.length,
      live_bridge: logs.filter((l) => l.source === 'live_bridge').length,
      conversation_mode: logs.filter((l) => l.source === 'conversation_mode').length,
      synthesizer: logs.filter((l) => l.source === 'synthesizer').length
    };
  }, [logs]);

  const selectedEntries = useMemo(() => {
    if (selectedIds.size === 0) return [];
    return logs.filter((entry) => selectedIds.has(entry.id));
  }, [logs, selectedIds]);

  const allVisibleSelected =
    filteredLogs.length > 0 && filteredLogs.every((entry) => selectedIds.has(entry.id));

  const exportTargetLogs = selectedEntries.length > 0 ? selectedEntries : filteredLogs;
  const exportScopeLabel =
    selectedEntries.length > 0
      ? `${selectedEntries.length} manually selected transcript(s)`
      : `All ${filteredLogs.length} filtered transcript(s) (${sourceFilter})`;

  const toggleSelectEntry = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const entry of filteredLogs) {
          next.delete(entry.id);
        }
      } else {
        for (const entry of filteredLogs) {
          next.add(entry.id);
        }
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleExport = (format: 'txt' | 'json') => {
    if (exportTargetLogs.length === 0) return;
    exportSelectedVoiceLogs(exportTargetLogs, format, exportScopeLabel);
  };

  const handleReplay = async (entry: VoiceCommandLogEntry, mode: ReplayMode = 'full') => {
    if (activeReplayId === entry.id) {
      stopVoiceLogReplay();
      setActiveReplayId(null);
      setReplayPhase('idle');
      return;
    }

    setActiveReplayId(entry.id);
    setReplayMode(mode);
    setReplayPhase(mode === 'response' ? 'response' : 'command');

    await replayVoiceLogEntry(entry, mode, {
      onPhaseChange: (phase) => setReplayPhase(phase),
      onReplayRecorded: (updated) => {
        setLogs((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      },
      onFinish: () => {
        setActiveReplayId((curr) => (curr === entry.id ? null : curr));
        setReplayPhase('idle');
      }
    });
  };

  const handleStopReplay = () => {
    stopVoiceLogReplay();
    setActiveReplayId(null);
    setReplayPhase('idle');
  };

  const handleDeleteEntry = async (id: string) => {
    if (activeReplayId === id) {
      handleStopReplay();
    }
    const ok = await deleteVoiceCommandLog(id);
    if (ok) {
      setLogs((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const handleClearAll = async () => {
    if (!confirmClearAll) {
      setConfirmClearAll(true);
      setTimeout(() => setConfirmClearAll(false), 4000);
      return;
    }
    handleStopReplay();
    const ok = await clearVoiceCommandLogs();
    if (ok) {
      setLogs([]);
      setSelectedIds(new Set());
    }
    setConfirmClearAll(false);
  };

  const formatTimestamp = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    const timePart = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (sameDay) return timePart;
    const datePart = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return `${datePart}, ${timePart}`;
  };

  const renderSourceIcon = (source: VoiceCommandSource) => {
    if (source === 'live_bridge') return <Mic className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
    if (source === 'conversation_mode') return <MessageSquare className="w-3.5 h-3.5 text-red-400 shrink-0" />;
    return <Volume2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
  };

  return (
    <section
      aria-label="Voice Command Log and Replay"
      className="w-full max-w-4xl z-10 bg-zinc-950/90 border border-red-900/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6"
    >
      {/* Header Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-zinc-800/80">
        <div>
          <h3 className="text-lg font-bold tracking-wide text-zinc-100">
            Voice Command Log &amp; Replay
          </h3>
          <p className="text-xs text-zinc-400 mt-1 tabular-nums">
            {logs.length} {logs.length === 1 ? 'interaction' : 'interactions'} archived
            {selectedEntries.length > 0 && (
              <>
                <span className="mx-2 text-zinc-600" aria-hidden="true">·</span>
                <span className="text-amber-400 font-medium">{selectedEntries.length} selected for audit</span>
              </>
            )}
            <span className="mx-2 text-zinc-600" aria-hidden="true">·</span>
            <span>Persistent transcript &amp; vocal playback</span>
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {activeReplayId && (
            <button
              type="button"
              onClick={handleStopReplay}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 text-black hover:bg-amber-400 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop Playback</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleExport('txt')}
            disabled={exportTargetLogs.length === 0}
            title={
              selectedEntries.length > 0
                ? `Export ${selectedEntries.length} selected transcript(s) as text`
                : `Export ${filteredLogs.length} filtered transcript(s) as text`
            }
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-900 text-zinc-200 border border-zinc-700 hover:border-amber-500/50 hover:text-amber-300 transition-colors disabled:opacity-35 disabled:pointer-events-none flex items-center gap-2 whitespace-nowrap shrink-0 tabular-nums cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>
              {selectedEntries.length > 0
                ? `Export Text (${selectedEntries.length})`
                : `Export Text (${filteredLogs.length})`}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleExport('json')}
            disabled={exportTargetLogs.length === 0}
            title={
              selectedEntries.length > 0
                ? `Export ${selectedEntries.length} selected transcript(s) as JSON`
                : `Export ${filteredLogs.length} filtered transcript(s) as JSON`
            }
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-900 text-amber-300 border border-amber-500/40 hover:bg-amber-950/40 hover:border-amber-400 transition-colors disabled:opacity-35 disabled:pointer-events-none flex items-center gap-2 whitespace-nowrap shrink-0 tabular-nums cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <FileJson className="w-3.5 h-3.5" />
            <span>
              {selectedEntries.length > 0
                ? `Export JSON (${selectedEntries.length})`
                : `Export JSON (${filteredLogs.length})`}
            </span>
          </button>

          <button
            type="button"
            onClick={handleClearAll}
            disabled={logs.length === 0}
            className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-colors disabled:opacity-35 disabled:pointer-events-none flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
              confirmClearAll
                ? 'bg-red-800 text-white border-red-500 hover:bg-red-700'
                : 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:border-red-700 hover:text-red-300'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{confirmClearAll ? 'Confirm Clear' : 'Clear Log'}</span>
          </button>
        </div>
      </div>

      {/* Filter, Selection & Search Toolbar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Filter voice logs by source"
            className="flex items-center gap-1 p-1 bg-black/70 border border-zinc-800 rounded-xl overflow-x-auto"
          >
            {(
              [
                { id: 'all', label: `All (${counts.all})` },
                { id: 'live_bridge', label: `Live Bridge (${counts.live_bridge})` },
                { id: 'conversation_mode', label: `Conversation (${counts.conversation_mode})` },
                { id: 'synthesizer', label: `Synthesizer (${counts.synthesizer})` }
              ] as Array<{ id: SourceFilter; label: string }>
            ).map((tab) => {
              const active = sourceFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={active}
                  type="button"
                  onClick={() => setSourceFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 tabular-nums cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                    active
                      ? 'bg-red-900/70 text-amber-300 border border-amber-500/40'
                      : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="relative flex-1 md:max-w-xs">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search transcripts..."
              aria-label="Search voice transcripts"
              className="w-full pl-10 pr-4 py-2 bg-black/60 border border-zinc-800 rounded-xl text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50"
            />
          </div>
        </div>

        {/* Batch Selection Controls when entries are visible */}
        {!isLoading && filteredLogs.length > 0 && (
          <div className="flex items-center justify-between gap-3 text-xs text-zinc-400 px-1">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleSelectAllVisible}
                className="inline-flex items-center gap-2 text-xs font-medium text-zinc-300 hover:text-amber-300 transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded px-1.5 py-1"
              >
                {allVisibleSelected ? (
                  <CheckSquare className="w-4 h-4 text-amber-400" />
                ) : (
                  <UncheckedSquare className="w-4 h-4 text-zinc-500" />
                )}
                <span>{allVisibleSelected ? 'Deselect Visible' : 'Select All Visible'}</span>
              </button>

              {selectedEntries.length > 0 && (
                <>
                  <span className="text-zinc-700" aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded px-1.5 py-1"
                  >
                    Clear Selection ({selectedEntries.length})
                  </button>
                </>
              )}
            </div>

            <span className="hidden sm:inline text-zinc-500 tabular-nums">
              {selectedEntries.length > 0
                ? `Audit export will include ${selectedEntries.length} selected`
                : 'Select entries or export all visible'}
            </span>
          </div>
        )}
      </div>

      {/* State 1: Loading Skeleton */}
      {isLoading && (
        <div className="space-y-3" aria-busy="true">
          {[1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="p-5 rounded-2xl border border-zinc-800/80 bg-zinc-900/30 animate-pulse space-y-3"
            >
              <div className="h-3 w-48 bg-zinc-800 rounded" />
              <div className="h-4 w-3/4 bg-zinc-800/80 rounded" />
              <div className="h-4 w-2/3 bg-zinc-800/60 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* State 2: Empty State (Zero Recorded Interactions) */}
      {!isLoading && logs.length === 0 && (
        <div className="py-12 px-6 text-center border border-dashed border-zinc-800 rounded-2xl bg-black/40 space-y-4">
          <div className="w-11 h-11 mx-auto rounded-xl bg-red-950/50 border border-red-900/40 flex items-center justify-center text-amber-400">
            <Volume2 className="w-5 h-5" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <p className="text-sm font-semibold text-zinc-200">No Voice Interactions Logged Yet</p>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Engage the Live Audio Bridge, speak in Conversation Mode, or run the Vocal Synthesizer below. Every command and spoken response will be archived here for replay and audit export.
            </p>
          </div>
          {onFocusSynthesizer && (
            <button
              type="button"
              onClick={onFocusSynthesizer}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-amber-600 text-black hover:bg-amber-500 transition-colors inline-flex items-center gap-2 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Vocalize Test Command</span>
            </button>
          )}
        </div>
      )}

      {/* State 3: Filtered Empty State */}
      {!isLoading && logs.length > 0 && filteredLogs.length === 0 && (
        <div className="py-10 px-6 text-center border border-zinc-800/80 rounded-2xl bg-black/40 space-y-3">
          <p className="text-sm font-medium text-zinc-300">No matching voice transcripts found</p>
          <button
            type="button"
            onClick={() => {
              setSourceFilter('all');
              setSearchQuery('');
            }}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-900 text-amber-400 border border-zinc-700 hover:border-amber-500/50 transition-colors inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Filters</span>
          </button>
        </div>
      )}

      {/* State 4: Populated Voice Log Ledger */}
      {!isLoading && filteredLogs.length > 0 && (
        <div className="max-h-[480px] overflow-y-auto space-y-3 pr-1 custom-scrollbar">
          {filteredLogs.map((entry) => {
            const isPlayingThis = activeReplayId === entry.id;
            const isSelected = selectedIds.has(entry.id);
            const hasCommand = Boolean(
              entry.commandText &&
                entry.commandText.trim() &&
                !entry.commandText.startsWith('(Spoken response')
            );
            const hasResponse = Boolean(entry.responseText && entry.responseText.trim());
            const isLiveCached = hasCachedLiveAudio(entry.id);

            return (
              <article
                key={entry.id}
                className={`p-5 rounded-2xl border transition-colors ${
                  isPlayingThis
                    ? 'bg-amber-950/20 border-amber-500/60'
                    : isSelected
                    ? 'bg-red-950/20 border-amber-500/45'
                    : 'bg-zinc-900/40 border-zinc-800/90 hover:border-red-900/50'
                }`}
              >
                {/* Top Metadata + Primary Controls Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800/60">
                  <div className="flex items-center gap-2.5 text-xs text-zinc-400 font-mono tabular-nums flex-wrap">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={isSelected}
                      aria-label={`Select transcript from ${formatTimestamp(entry.timestamp)}`}
                      onClick={() => toggleSelectEntry(entry.id)}
                      className="p-1 -ml-1 rounded text-zinc-400 hover:text-amber-300 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-amber-400" />
                      ) : (
                        <UncheckedSquare className="w-4 h-4 text-zinc-500" />
                      )}
                    </button>

                    {renderSourceIcon(entry.source)}
                    <span className="text-zinc-200 font-sans font-medium">
                      {SOURCE_LABELS[entry.source]}
                    </span>
                    <span className="text-zinc-600" aria-hidden="true">·</span>
                    <span>{formatTimestamp(entry.timestamp)}</span>
                    {entry.voiceProfile && (
                      <>
                        <span className="text-zinc-600" aria-hidden="true">·</span>
                        <span className="text-zinc-400">{entry.voiceProfile}</span>
                      </>
                    )}
                    {typeof entry.durationMs === 'number' && entry.durationMs > 0 && (
                      <>
                        <span className="text-zinc-600" aria-hidden="true">·</span>
                        <span>{(entry.durationMs / 1000).toFixed(1)}s</span>
                      </>
                    )}
                    {(entry.replayCount || 0) > 0 && (
                      <>
                        <span className="text-zinc-600" aria-hidden="true">·</span>
                        <span className="text-amber-400/90">
                          Replayed {entry.replayCount}×
                        </span>
                      </>
                    )}
                    {isLiveCached && (
                      <>
                        <span className="text-zinc-600" aria-hidden="true">·</span>
                        <span className="text-emerald-400">Original Live Audio</span>
                      </>
                    )}
                  </div>

                  {/* Replay & Single-Entry Audit Actions */}
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <button
                      type="button"
                      onClick={() => void handleReplay(entry, 'full')}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                        isPlayingThis
                          ? 'bg-amber-500 text-black hover:bg-amber-400'
                          : 'bg-red-900/70 text-amber-300 border border-amber-500/30 hover:bg-red-800'
                      }`}
                    >
                      {isPlayingThis ? (
                        <>
                          <Square className="w-3 h-3 fill-current" />
                          <span>
                            {replayPhase === 'command'
                              ? 'Playing Command'
                              : replayPhase === 'response'
                              ? 'Playing Response'
                              : 'Stop'}
                          </span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 fill-current" />
                          <span>{hasCommand && hasResponse ? 'Replay Exchange' : 'Play'}</span>
                        </>
                      )}
                    </button>

                    {hasCommand && hasResponse && (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleReplay(entry, 'command')}
                          title="Replay Principal command only"
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 text-zinc-300 border border-zinc-700 hover:border-zinc-500 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                        >
                          Command
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleReplay(entry, 'response')}
                          title="Replay Steward response only"
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 text-zinc-300 border border-zinc-700 hover:border-amber-500/50 hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                        >
                          Response
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => exportSelectedVoiceLogs([entry], 'json', `Single transcript (${entry.id})`)}
                      title="Download this entry as JSON"
                      aria-label={`Export entry from ${formatTimestamp(entry.timestamp)} as JSON`}
                      className="p-2 rounded-lg text-zinc-500 hover:text-amber-300 hover:bg-zinc-800/80 transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleDeleteEntry(entry.id)}
                      aria-label={`Delete voice log entry from ${formatTimestamp(entry.timestamp)}`}
                      className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-950/30 transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Transcript Body */}
                <div className="mt-3 space-y-2.5 text-sm leading-relaxed">
                  {hasCommand && (
                    <div
                      className={`transition-opacity ${
                        isPlayingThis && replayPhase === 'response' ? 'opacity-65' : 'opacity-100'
                      }`}
                    >
                      <span className="text-xs font-semibold text-zinc-400 mr-2">
                        {entry.source === 'synthesizer' ? 'Synthesized:' : 'Principal:'}
                      </span>
                      <span className="text-zinc-100">{entry.commandText}</span>
                    </div>
                  )}

                  {hasResponse && entry.responseText && (
                    <div
                      className={`pt-2 border-t border-zinc-800/40 transition-opacity ${
                        isPlayingThis && replayPhase === 'command' ? 'opacity-65' : 'opacity-100'
                      }`}
                    >
                      <span className="text-xs font-semibold text-amber-400 mr-2">
                        Steward:
                      </span>
                      <span className="text-amber-100/90 font-serif italic">
                        {entry.responseText}
                      </span>
                    </div>
                  )}
                </div>

                {/* Audio Intensity Waveform */}
                <TranscriptWaveform
                  entry={entry}
                  isPlaying={isPlayingThis}
                  replayPhase={isPlayingThis ? replayPhase : 'idle'}
                  replayMode={isPlayingThis ? replayMode : 'full'}
                  onPlaySegment={(mode) => void handleReplay(entry, mode)}
                />
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default VoiceCommandLogPanel;
