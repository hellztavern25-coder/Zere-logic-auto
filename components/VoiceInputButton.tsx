import React, { useState, useEffect, useRef } from 'react';
import { Mic, Radio } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  isSpeechRecognitionSupported,
  startSpeechRecognition,
  jeremyIronsVoice,
} from '../services/jeremyIronsVoiceService';

interface VoiceInputButtonProps {
  onTranscriptChange: (transcript: string, isFinal: boolean) => void;
  onTranscriptComplete?: (finalText: string) => void;
  onInterruptSpeaking?: () => void;
  onListeningStateChange?: (listening: boolean) => void;
  isThinking?: boolean;
  isSpeaking?: boolean;
  conversationMode?: boolean;
  isMicPaused?: boolean;
  autoSubmitOnComplete?: boolean;
  externalTriggerCount?: number;
}

export const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({
  onTranscriptChange,
  onTranscriptComplete,
  onInterruptSpeaking,
  onListeningStateChange,
  isThinking = false,
  isSpeaking = false,
  conversationMode = false,
  isMicPaused = false,
  autoSubmitOnComplete = false,
  externalTriggerCount = 0,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [hasSupport, setHasSupport] = useState(true);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  const recognizerRef = useRef<{ stop: () => void; abort: () => void } | null>(null);
  const accumulatedFinalRef = useRef<string>('');
  const latestInterimRef = useRef<string>('');
  const silenceTimerRef = useRef<any>(null);
  const retryTimerRef = useRef<any>(null);
  const prevTriggerRef = useRef<number>(externalTriggerCount);
  const noSpeechRetriesRef = useRef<number>(0);
  const suppressNextEndDispatchRef = useRef<boolean>(false);

  // Live refs to prevent stale closures inside Web Speech callbacks
  const isListeningRef = useRef(isListening);
  const isThinkingRef = useRef(isThinking);
  const isSpeakingRef = useRef(isSpeaking);
  const isMicPausedRef = useRef(isMicPaused);
  const conversationModeRef = useRef(conversationMode);
  const autoSubmitRef = useRef(autoSubmitOnComplete);
  const onTranscriptChangeRef = useRef(onTranscriptChange);
  const onTranscriptCompleteRef = useRef(onTranscriptComplete);
  const onInterruptSpeakingRef = useRef(onInterruptSpeaking);
  const onListeningStateChangeRef = useRef(onListeningStateChange);

  useEffect(() => { isListeningRef.current = isListening; }, [isListening]);
  useEffect(() => { isThinkingRef.current = isThinking; }, [isThinking]);
  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);
  useEffect(() => { isMicPausedRef.current = isMicPaused; }, [isMicPaused]);
  useEffect(() => { conversationModeRef.current = conversationMode; }, [conversationMode]);
  useEffect(() => { autoSubmitRef.current = autoSubmitOnComplete; }, [autoSubmitOnComplete]);
  useEffect(() => { onTranscriptChangeRef.current = onTranscriptChange; }, [onTranscriptChange]);
  useEffect(() => { onTranscriptCompleteRef.current = onTranscriptComplete; }, [onTranscriptComplete]);
  useEffect(() => { onInterruptSpeakingRef.current = onInterruptSpeaking; }, [onInterruptSpeaking]);
  useEffect(() => { onListeningStateChangeRef.current = onListeningStateChange; }, [onListeningStateChange]);

  useEffect(() => {
    setHasSupport(isSpeechRecognitionSupported());
  }, []);

  const updateListeningState = (next: boolean) => {
    isListeningRef.current = next;
    setIsListening(next);
    onListeningStateChangeRef.current?.(next);
  };

  const clearTimers = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  };

  const abortListeningSilently = () => {
    clearTimers();
    suppressNextEndDispatchRef.current = true;
    if (recognizerRef.current) {
      try { recognizerRef.current.abort(); } catch (_) {}
      recognizerRef.current = null;
    }
    accumulatedFinalRef.current = '';
    latestInterimRef.current = '';
    setInterimText('');
    setStatusNote(null);
    updateListeningState(false);
  };

  const stopListening = (dispatchFinal: boolean = true) => {
    clearTimers();
    suppressNextEndDispatchRef.current = !dispatchFinal;
    if (recognizerRef.current) {
      try { recognizerRef.current.stop(); } catch (_) {}
      recognizerRef.current = null;
    }
    updateListeningState(false);
    const combined = `${accumulatedFinalRef.current} ${latestInterimRef.current}`.trim();
    accumulatedFinalRef.current = '';
    latestInterimRef.current = '';
    setInterimText('');
    setStatusNote(null);
    if (dispatchFinal && combined && onTranscriptCompleteRef.current) {
      onTranscriptCompleteRef.current(combined);
    }
  };

  const beginRecognitionSession = () => {
    if (isThinkingRef.current || isMicPausedRef.current || !hasSupport) return;
    if (isListeningRef.current) return;

    jeremyIronsVoice.unlockAudio().catch(() => {});
    clearTimers();
    suppressNextEndDispatchRef.current = false;
    accumulatedFinalRef.current = '';
    latestInterimRef.current = '';
    setInterimText('');
    setStatusNote(null);

    const rec = startSpeechRecognition({
      onStart: () => {
        updateListeningState(true);
      },
      onTranscript: (text, isFinal) => {
        clearTimers();
        noSpeechRetriesRef.current = 0;
        setStatusNote(null);

        if (isFinal) {
          accumulatedFinalRef.current = `${accumulatedFinalRef.current} ${text}`.trim();
          latestInterimRef.current = '';
          const fullText = accumulatedFinalRef.current;
          setInterimText(fullText);
          onTranscriptChangeRef.current(fullText, true);

          if (autoSubmitRef.current || conversationModeRef.current) {
            // Brief 1.35s grace window so natural mid-sentence breaths don't clip the thought
            silenceTimerRef.current = setTimeout(() => {
              stopListening(true);
            }, 1350);
          }
        } else {
          latestInterimRef.current = text;
          const combined = `${accumulatedFinalRef.current} ${text}`.trim();
          setInterimText(combined);
          onTranscriptChangeRef.current(combined, false);
        }
      },
      onError: (err) => {
        clearTimers();
        recognizerRef.current = null;
        updateListeningState(false);

        const code = String(err || '').toLowerCase();
        if (code === 'not-allowed' || code === 'service-not-allowed') {
          setStatusNote('Microphone permission denied');
          return;
        }

        if (
          code === 'no-speech' &&
          conversationModeRef.current &&
          !isMicPausedRef.current &&
          !isThinkingRef.current &&
          !isSpeakingRef.current &&
          noSpeechRetriesRef.current < 1
        ) {
          noSpeechRetriesRef.current += 1;
          suppressNextEndDispatchRef.current = true;
          setStatusNote('Listening for your voice…');
          retryTimerRef.current = setTimeout(() => {
            if (
              conversationModeRef.current &&
              !isMicPausedRef.current &&
              !isThinkingRef.current &&
              !isSpeakingRef.current
            ) {
              beginRecognitionSession();
            }
          }, 350);
          return;
        }

        if (code === 'no-speech') {
          setStatusNote('Awaiting speech — tap mic');
        }
      },
      onEnd: () => {
        clearTimers();
        recognizerRef.current = null;
        updateListeningState(false);

        if (suppressNextEndDispatchRef.current) {
          suppressNextEndDispatchRef.current = false;
          return;
        }

        const combined = `${accumulatedFinalRef.current} ${latestInterimRef.current}`.trim();
        accumulatedFinalRef.current = '';
        latestInterimRef.current = '';
        setInterimText('');
        if (combined && onTranscriptCompleteRef.current) {
          onTranscriptCompleteRef.current(combined);
        }
      },
    });

    recognizerRef.current = rec;
  };

  const handleMicClick = () => {
    if (isThinkingRef.current) return;

    // Allow interrupting ZereØ mid-sentence to speak immediately
    if (isSpeakingRef.current && onInterruptSpeakingRef.current) {
      onInterruptSpeakingRef.current();
      noSpeechRetriesRef.current = 0;
      setTimeout(() => {
        beginRecognitionSession();
      }, 120);
      return;
    }

    if (isListeningRef.current) {
      stopListening(true);
      return;
    }

    noSpeechRetriesRef.current = 0;
    beginRecognitionSession();
  };

  // Auto-arm microphone when Conversation Mode hands turn back to the Principal
  useEffect(() => {
    if (externalTriggerCount > prevTriggerRef.current) {
      prevTriggerRef.current = externalTriggerCount;
      noSpeechRetriesRef.current = 0;
      if (!isListeningRef.current && !isThinkingRef.current && !isSpeakingRef.current && !isMicPausedRef.current && hasSupport) {
        beginRecognitionSession();
      }
    }
  }, [externalTriggerCount, hasSupport]);

  // Ensure mic is never open while ZereØ is speaking or while mic is explicitly paused
  useEffect(() => {
    if ((isSpeaking || isMicPaused) && isListeningRef.current) {
      abortListeningSilently();
    }
  }, [isSpeaking, isMicPaused]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      clearTimers();
      if (recognizerRef.current) {
        try { recognizerRef.current.abort(); } catch (_) {}
      }
    };
  }, []);

  return (
    <div className="relative inline-flex items-center">
      {/* Listening Indicator overlay tooltip / banner */}
      <AnimatePresence>
        {(isListening || (conversationMode && statusNote)) && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute bottom-full mb-3 right-0 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 z-50 whitespace-nowrap bg-black/95 border border-amber-500/50 rounded-xl px-3 py-1.5 shadow-[0_10px_30px_rgba(251,191,36,0.3)] backdrop-blur-xl flex items-center gap-2"
          >
            {isListening ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Radio className="w-3 h-3 text-red-500 animate-pulse" />
                  Listening to Principal...
                </span>
                {interimText && (
                  <span className="text-[10px] text-zinc-300 italic max-w-xs truncate border-l border-zinc-700 pl-2">
                    "{interimText}"
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => stopListening(true)}
                  className="text-[9px] font-bold text-amber-400/80 hover:text-amber-300 uppercase px-1.5 py-0.5 rounded bg-red-950/80 border border-red-800 ml-1 cursor-pointer"
                >
                  Done
                </button>
              </>
            ) : (
              <span className="text-[10px] font-mono text-amber-300/90 uppercase tracking-wider">
                {statusNote}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={handleMicClick}
        disabled={isThinking || !hasSupport}
        title={
          !hasSupport
            ? 'Speech recognition not supported on this browser'
            : isSpeaking
            ? 'Interrupt ZereØ & Speak Now'
            : isListening
            ? 'Stop Voice Input & Send'
            : conversationMode
            ? 'Speak Next Turn to ZereØ'
            : 'Voice Input (Dictate directive to ZereØ)'
        }
        className={`p-2 sm:p-3 rounded-xl sm:rounded-2xl transition-all relative group active:scale-95 disabled:opacity-30 cursor-pointer ${
          isListening
            ? 'bg-red-900 text-amber-300 border-2 border-amber-500 shadow-[0_0_20px_rgba(251,191,36,0.5)] animate-pulse'
            : conversationMode && !isMicPaused
            ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 hover:bg-amber-500/25'
            : 'text-zinc-500 hover:text-amber-400 hover:bg-red-950/30'
        }`}
      >
        <Mic className={`w-4 h-4 sm:w-5 sm:h-5 ${isListening ? 'text-amber-400' : ''}`} />

        {/* Pulse ring when listening */}
        {isListening && (
          <span className="absolute -inset-1 rounded-2xl border border-amber-400/60 animate-ping pointer-events-none" />
        )}
      </button>
    </div>
  );
};

export default VoiceInputButton;
