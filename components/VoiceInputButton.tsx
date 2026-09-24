import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader2, Radio } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  isSpeechRecognitionSupported,
  startSpeechRecognition,
} from '../services/jeremyIronsVoiceService';

interface VoiceInputButtonProps {
  onTranscriptChange: (transcript: string, isFinal: boolean) => void;
  onTranscriptComplete?: (finalText: string) => void;
  isThinking?: boolean;
}

export const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({
  onTranscriptChange,
  onTranscriptComplete,
  isThinking = false,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [hasSupport, setHasSupport] = useState(true);
  const recognizerRef = useRef<{ stop: () => void; abort: () => void } | null>(null);

  useEffect(() => {
    setHasSupport(isSpeechRecognitionSupported());
  }, []);

  const stopListening = () => {
    if (recognizerRef.current) {
      recognizerRef.current.stop();
      recognizerRef.current = null;
    }
    setIsListening(false);
    if (interimText.trim() && onTranscriptComplete) {
      onTranscriptComplete(interimText.trim());
    }
    setInterimText('');
  };

  const startListening = () => {
    if (isThinking) return;
    if (isListening) {
      stopListening();
      return;
    }

    setInterimText('');
    const rec = startSpeechRecognition({
      onStart: () => {
        setIsListening(true);
      },
      onTranscript: (text, isFinal) => {
        setInterimText(text);
        onTranscriptChange(text, isFinal);
        if (isFinal && onTranscriptComplete) {
          onTranscriptComplete(text);
          stopListening();
        }
      },
      onError: (err) => {
        console.warn('Speech recognition error:', err);
        setIsListening(false);
      },
      onEnd: () => {
        setIsListening(false);
      },
    });

    recognizerRef.current = rec;
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (recognizerRef.current) {
        recognizerRef.current.abort();
      }
    };
  }, []);

  return (
    <div className="relative inline-flex items-center">
      {/* Listening Indicator overlay tooltip / banner */}
      <AnimatePresence>
        {isListening && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute bottom-full mb-3 right-0 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 z-50 whitespace-nowrap bg-black/95 border border-amber-500/50 rounded-xl px-3 py-1.5 shadow-[0_10px_30px_rgba(251,191,36,0.3)] backdrop-blur-xl flex items-center gap-2"
          >
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
              onClick={stopListening}
              className="text-[9px] font-bold text-amber-400/80 hover:text-amber-300 uppercase px-1.5 py-0.5 rounded bg-red-950/80 border border-red-800 ml-1"
            >
              Done
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={startListening}
        disabled={isThinking || !hasSupport}
        title={
          !hasSupport
            ? 'Speech recognition not supported on this browser'
            : isListening
            ? 'Stop Voice Input'
            : 'Voice Input (Dictate directive to Jeremy Irons)'
        }
        className={`p-2 sm:p-3 rounded-xl sm:rounded-2xl transition-all relative group active:scale-95 disabled:opacity-30 ${
          isListening
            ? 'bg-red-900 text-amber-300 border-2 border-amber-500 shadow-[0_0_20px_rgba(251,191,36,0.5)] animate-pulse'
            : 'text-zinc-500 hover:text-amber-400 hover:bg-red-950/30'
        }`}
      >
        {isListening ? (
          <Mic className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
        ) : (
          <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
        )}

        {/* Pulse ring when listening */}
        {isListening && (
          <span className="absolute -inset-1 rounded-2xl border border-amber-400/60 animate-ping pointer-events-none" />
        )}
      </button>
    </div>
  );
};

export default VoiceInputButton;
