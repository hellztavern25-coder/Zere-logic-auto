// [TAG: 11]
import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Sliders, Play, Square, Sparkles, Check, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  jeremyIronsVoice,
  JeremyIronsConfig,
  VoiceModulationProfile,
  clampLowEPitchRate
} from '../services/jeremyIronsVoiceService';
import { getTtsQuotaNotice } from '../services/geminiService';
import { AUDITION_LINE_1911 } from '../services/stewardIdentity';

interface JeremyIronsVoiceControlProps {
  ttsEnabled: boolean;
  onToggleTTS: () => void;
  className?: string;
}

export const JeremyIronsVoiceControl: React.FC<JeremyIronsVoiceControlProps> = ({
  ttsEnabled,
  onToggleTTS,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [activeProfile, setActiveProfile] = useState<VoiceModulationProfile>(() => {
    return jeremyIronsVoice.getLegacyProfile() || 'Jeremy-Irons-Signature';
  });
  const [config, setConfig] = useState<JeremyIronsConfig>(() => jeremyIronsVoice.getConfig());

  const [ttsQuotaNotice, setTtsQuotaNotice] = useState<string | null>(() => getTtsQuotaNotice());

  useEffect(() => {
    const unsub = jeremyIronsVoice.subscribe(({ isSpeaking, text, legacyProfile, config: storeConfig }) => {
      setIsSpeaking(isSpeaking);
      setCurrentText(text);
      if (legacyProfile) setActiveProfile(legacyProfile);
      if (storeConfig) setConfig(storeConfig);
    });
    const onTtsNotice = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      setTtsQuotaNotice(detail?.quotaExhausted ? (detail?.message || getTtsQuotaNotice()) : null);
    };
    window.addEventListener('zereo:tts_notice', onTtsNotice);
    return () => {
      unsub();
      window.removeEventListener('zereo:tts_notice', onTtsNotice);
    };
  }, []);

  const handleProfileSelect = (p: VoiceModulationProfile) => {
    jeremyIronsVoice.setProfile(p);
  };

  const handleConfigChange = (changes: Partial<JeremyIronsConfig>) => {
    jeremyIronsVoice.updateConfig(changes);
  };

  const handleTestVoice = () => {
    if (isSpeaking) {
      jeremyIronsVoice.stop();
      return;
    }
    const testLines = [
      AUDITION_LINE_1911,
      "A man who cannot bear to share his screen with his steward is either concealing a catastrophe, or engineering one.",
      "Logic, Principal, is the only weapon that never jams under fire.",
    ];
    const line = testLines[Math.floor(Math.random() * testLines.length)];
    void jeremyIronsVoice.speak(line);
  };

  return (
    <div className={`relative ${className}`}>
      {/* Voice Status Pill & Quick Controls */}
      <div className="flex items-center gap-1.5 bg-zinc-950/90 border border-red-900/30 rounded-xl sm:rounded-2xl p-1 shadow-inner">
        <button
          onClick={onToggleTTS}
          title={ttsEnabled ? 'Jeremy Irons Voice Active — Click to Mute' : 'Jeremy Irons Voice Muted — Click to Enable'}
          className={`flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-bold uppercase transition-all tracking-wider ${
            ttsEnabled
              ? 'bg-red-950 text-amber-400 border border-red-800/80 shadow-[0_0_15px_rgba(153,27,27,0.4)]'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          {ttsEnabled ? (
            <>
              <Volume2 className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden xs:inline">Jeremy Irons Voice</span>
              <span className="xs:hidden">Irons</span>
              {isSpeaking && (
                <span className="flex gap-0.5 items-end h-3">
                  <span className="w-0.5 bg-amber-400 animate-pulse h-3"></span>
                  <span className="w-0.5 bg-amber-400 animate-pulse h-2 delay-75"></span>
                  <span className="w-0.5 bg-amber-400 animate-pulse h-3.5 delay-150"></span>
                </span>
              )}
            </>
          ) : (
            <>
              <VolumeX className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Voice Muted</span>
              <span className="xs:hidden">Mute</span>
            </>
          )}
        </button>

        {/* Settings button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          title="Jeremy Irons Acoustic DSP Settings"
          className="p-1.5 rounded-lg text-zinc-500 hover:text-amber-400 hover:bg-red-950/40 transition-colors"
        >
          <Sliders className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Settings Popover */}
      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              className="absolute left-0 sm:right-0 sm:left-auto top-full mt-2 w-80 bg-[#090506]/95 border border-amber-500/30 rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.9)] z-50 backdrop-blur-2xl text-zinc-200"
            >
              <div className="flex items-center justify-between pb-3 border-b border-red-950">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-amber-400" />
                  <h4 className="text-xs font-black uppercase tracking-widest text-amber-400">
                    Jeremy Irons Acoustics
                  </h4>
                </div>
                <span className="text-[8px] font-mono px-2 py-0.5 rounded bg-red-950/80 text-amber-500/80 border border-red-900/50">
                  {config.baseVoice || 'Charon'} DSP
                </span>
              </div>

              <div className="space-y-3.5 py-3 text-xs">
                {ttsQuotaNotice && (
                  <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-[10px] leading-relaxed text-amber-200">
                    <span className="font-bold uppercase tracking-wider text-amber-400 block mb-0.5">
                      Cloud Neural TTS Free Quota Reached
                    </span>
                    {ttsQuotaNotice} Select a billing-enabled Gemini API key in{' '}
                    <span className="font-semibold text-amber-300">Settings &gt; Secrets</span> to restore cloud neural voices.
                  </div>
                )}

                {/* Voice Modulation Profile Presets */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[9px] font-mono uppercase text-zinc-400 tracking-wider">
                      Voice Modulation Profile
                    </label>
                    <span className="text-[8px] font-mono text-amber-400 uppercase font-bold">
                      {activeProfile === 'Jeremy-Irons-Signature' ? '★ Signature Default' : activeProfile}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['Jeremy-Irons-Signature', 'Iron-Adaptive', 'Clinical-Analytical', 'Subtle-Steward'] as VoiceModulationProfile[]).map((pKey) => {
                      const isCur = activeProfile === pKey;
                      const label = pKey === 'Jeremy-Irons-Signature' ? 'Signature' : pKey === 'Iron-Adaptive' ? 'Canonical' : pKey === 'Clinical-Analytical' ? 'Clinical' : 'Subtle';
                      return (
                        <button
                          key={pKey}
                          onClick={() => handleProfileSelect(pKey)}
                          className={`p-1.5 rounded-lg border text-[9px] font-mono font-bold uppercase transition-all flex flex-col items-center text-center ${
                            isCur
                              ? pKey === 'Jeremy-Irons-Signature' || pKey === 'Iron-Adaptive'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 ring-1 ring-amber-500/30'
                                : pKey === 'Clinical-Analytical'
                                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/60 ring-1 ring-cyan-500/30'
                                : 'bg-red-500/20 text-red-300 border-red-500/60 ring-1 ring-red-500/30'
                              : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                          }`}
                        >
                          <span className="truncate w-full">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Voice Model Selection */}
                <div>
                  <label className="text-[9px] font-mono uppercase text-zinc-400 block mb-1.5 tracking-wider">
                    Harmonic Substrate
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      onClick={() => handleConfigChange({ baseVoice: 'Charon' })}
                      className={`px-2 py-1.5 rounded-xl border text-[9px] font-bold uppercase transition-all flex items-center justify-center gap-1 ${
                        config.baseVoice === 'Charon'
                          ? 'bg-amber-500 text-black border-amber-400 shadow'
                          : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      {config.baseVoice === 'Charon' && <Check className="w-3 h-3 shrink-0" />}
                      Charon (Deep)
                    </button>
                    <button
                      onClick={() => handleConfigChange({ baseVoice: 'Orus' })}
                      className={`px-2 py-1.5 rounded-xl border text-[9px] font-bold uppercase transition-all flex items-center justify-center gap-1 ${
                        config.baseVoice === 'Orus'
                          ? 'bg-amber-500 text-black border-amber-400 shadow'
                          : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      {config.baseVoice === 'Orus' && <Check className="w-3 h-3 shrink-0" />}
                      Orus (Firm)
                    </button>
                    <button
                      onClick={() => handleConfigChange({ baseVoice: 'Fenrir' })}
                      className={`px-2 py-1.5 rounded-xl border text-[9px] font-bold uppercase transition-all flex items-center justify-center gap-1 ${
                        config.baseVoice === 'Fenrir'
                          ? 'bg-amber-500 text-black border-amber-400 shadow'
                          : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      {config.baseVoice === 'Fenrir' && <Check className="w-3 h-3 shrink-0" />}
                      Fenrir (Tone)
                    </button>
                  </div>
                </div>

                {/* Pitch / Low-E Register Calibration */}
                <div>
                  <div className="flex items-center justify-between text-[9px] font-mono uppercase text-zinc-400 mb-1">
                    <span>Register Lock (Low E2 ~82.4 Hz)</span>
                    <span className="text-amber-400">{clampLowEPitchRate(config.pitchRate).toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.84"
                    max="0.92"
                    step="0.01"
                    value={clampLowEPitchRate(config.pitchRate)}
                    onChange={(e) => handleConfigChange({ pitchRate: clampLowEPitchRate(parseFloat(e.target.value)) })}
                    className="w-full accent-amber-500 h-1 bg-zinc-800 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[8px] text-zinc-600 font-mono mt-0.5">
                    <span>Anchor E2 (0.84x)</span>
                    <span>Target E2 (0.87x)</span>
                    <span>Crisp F2 (0.92x)</span>
                  </div>
                </div>

                {/* Vocal Cord Gravel */}
                <div>
                  <div className="flex items-center justify-between text-[9px] font-mono uppercase text-zinc-400 mb-1">
                    <span>Alfred Gravel / Saturation</span>
                    <span className="text-amber-400">{Math.round(config.gravelAmount * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="1.0"
                    step="0.05"
                    value={config.gravelAmount}
                    onChange={(e) => handleConfigChange({ gravelAmount: parseFloat(e.target.value) })}
                    className="w-full accent-amber-500 h-1 bg-zinc-800 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Chest Resonance */}
                <div>
                  <div className="flex items-center justify-between text-[9px] font-mono uppercase text-zinc-400 mb-1">
                    <span>Sub-Bass Chest Resonance</span>
                    <span className="text-amber-400">+{config.chestResonanceDb.toFixed(1)} dB</span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="8.0"
                    step="0.5"
                    value={config.chestResonanceDb}
                    onChange={(e) => handleConfigChange({ chestResonanceDb: parseFloat(e.target.value) })}
                    className="w-full accent-amber-500 h-1 bg-zinc-800 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-red-950/60 flex items-center justify-between gap-2">
                <button
                  onClick={() => jeremyIronsVoice.resetConfig()}
                  className="text-[9px] font-mono text-zinc-500 hover:text-zinc-300 uppercase tracking-wider"
                >
                  Reset Defaults
                </button>

                <button
                  onClick={handleTestVoice}
                  className={`px-3.5 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-wider flex items-center gap-1.5 transition-all shadow ${
                    isSpeaking
                      ? 'bg-red-900 text-amber-300 hover:bg-red-800'
                      : 'bg-amber-500 text-black hover:bg-amber-400'
                  }`}
                >
                  {isSpeaking ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
                  {isSpeaking ? 'Halt Voice' : 'Test Acoustic Line'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default JeremyIronsVoiceControl;
