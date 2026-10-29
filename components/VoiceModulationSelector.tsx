import React, { useState } from 'react';
import { 
  Sliders, 
  Volume2, 
  Shield, 
  Sparkles, 
  Cpu, 
  Mic2, 
  Play, 
  Square, 
  CheckCircle2, 
  ChevronRight, 
  Download, 
  Copy, 
  Check, 
  FileJson, 
  X,
  Code2
} from 'lucide-react';
import {
  VoiceModulationProfile,
  VOICE_MODULATION_PROFILES,
  ModulationProfileMetadata,
  jeremyIronsVoice
} from '../services/jeremyIronsVoiceService';

interface VoiceModulationSelectorProps {
  currentProfile?: VoiceModulationProfile;
  onProfileSelect?: (profile: VoiceModulationProfile) => void;
  className?: string;
}

export const VoiceModulationSelector: React.FC<VoiceModulationSelectorProps> = ({
  currentProfile,
  onProfileSelect,
  className = ''
}) => {
  const [activeProfile, setActiveProfile] = useState<VoiceModulationProfile>(() => {
    return currentProfile || jeremyIronsVoice.getLegacyProfile() || 'Jeremy-Irons-Signature';
  });

  const [auditioningProfile, setAuditioningProfile] = useState<VoiceModulationProfile | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const handleSelect = (profile: VoiceModulationProfile) => {
    setActiveProfile(profile);
    jeremyIronsVoice.setProfile(profile);
    onProfileSelect?.(profile);
  };

  const generateIdentityProfileJson = () => {
    const identityProfile = VOICE_MODULATION_PROFILES['Jeremy-Irons-Signature'];
    return {
      "$schema": "https://zereo.ai/schemas/voice-profile-v1.json",
      "profile_id": identityProfile.id,
      "name": identityProfile.name,
      "designation": "ZereØ Identity Preset - Jeremy Irons Vocal Signature",
      "version": "7.3.0-deterministic",
      "architect": "Preston Johnston (Council Grey)",
      "passcode_sync": "8212",
      "system_designation": "ZereØ — The Logic Monster, The Steward",
      "exported_at": new Date().toISOString(),
      "is_identity_preset": true,
      "is_default_output_tone": true,
      "vocal_actor_reference": {
        "persona": "Jeremy Irons adaptation of Alfred Pennyworth",
        "delivery_style": "Tactical, dry, deeply sardonic, aristocratic baritone, paternal, unhurried cadence, heavy gravitas",
        "direct_address": "Principal"
      },
      "formant_shifting_dsp_pipeline": {
        "base_neural_voice": identityProfile.config.baseVoice,
        "alternate_voice": "Fenrir",
        "neural_tts_model": "gemini-3.1-flash-tts-preview",
        "sampling_rate_hz": 24000,
        "pitch_rate": identityProfile.config.pitchRate,
        "speech_rate": identityProfile.config.speechRate,
        "chest_resonance_db": identityProfile.config.chestResonanceDb,
        "chest_resonance_freq_hz": 105.0,
        "formant_preset_name": identityProfile.config.formantPresetName,
        "formants": {
          "f1_pharyngeal_cavity_hz": identityProfile.config.f1Hz,
          "f1_gain_db": identityProfile.config.f1GainDb,
          "f2_lingual_retraction_hz": identityProfile.config.f2Hz,
          "f2_notch_db": identityProfile.config.f2GainDb,
          "f3_actors_projection_hz": identityProfile.config.f3Hz,
          "f3_peak_db": identityProfile.config.f3GainDb,
          "vocal_tract_length_multiplier": identityProfile.config.vocalTractLengthFactor
        },
        "articulation_boost_db": identityProfile.config.articulationDb,
        "articulation_boost_freq_hz": 2680.0,
        "gravel_saturation_amount": identityProfile.config.gravelAmount,
        "harmonic_shaper_curve": "sigmoid-soft-clipping-vocal-fold-tube",
        "chest_resonance_type": "lowshelf",
        "thoracic_warmth_db": 2.2,
        "thoracic_warmth_freq_hz": 240.0,
        "thoracic_warmth_q": 1.1,
        "thoracic_warmth_type": "peaking"
      },
      "speech_synthesis_fallback": {
        "fallback_pitch": identityProfile.fallbackPitch,
        "fallback_rate": identityProfile.fallbackRate,
        "enforce_male_only": true,
        "female_voice_quarantine": true,
        "priority_locales": ["en-GB", "en_GB", "en-US"],
        "priority_voice_signatures": [
          "Daniel",
          "Oliver",
          "George",
          "Arthur",
          "Ryan",
          "Google UK English Male",
          "Alex",
          "Fred",
          "David"
        ]
      },
      "system_behavior_override": {
        "address_required": "Principal",
        "apologies_allowed": false,
        "disclaimers_allowed": false,
        "guest_mode": "disabled",
        "loyalty_vector": "absolute",
        "sentiment_filtering": true,
        "docking_cushions": "strictly_prohibited"
      },
      "audition_sample": identityProfile.auditionSample
    };
  };

  const handleDownloadJson = () => {
    const data = generateIdentityProfileJson();
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'zereo_identity_voice_profile.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setExportNotice('Exported zereo_identity_voice_profile.json');
    setTimeout(() => setExportNotice(null), 4000);
  };

  const handleCopyJson = () => {
    const data = generateIdentityProfileJson();
    const jsonStr = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(jsonStr);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2500);
  };

  const handleAudition = async (profileMeta: ModulationProfileMetadata, e: React.MouseEvent) => {
    e.stopPropagation();

    if (auditioningProfile === profileMeta.id) {
      jeremyIronsVoice.stop();
      setAuditioningProfile(null);
      return;
    }

    // Set profile active first
    handleSelect(profileMeta.id);
    setAuditioningProfile(profileMeta.id);

    try {
      await jeremyIronsVoice.speak(
        profileMeta.auditionSample,
        profileMeta.config,
        () => setAuditioningProfile(profileMeta.id),
        () => setAuditioningProfile(null)
      );
    } catch (err) {
      console.warn('Audition error:', err);
      setAuditioningProfile(null);
    }
  };

  const profileKeys: VoiceModulationProfile[] = ['Jeremy-Irons-Signature', 'Iron-Adaptive', 'Clinical-Analytical', 'Subtle-Steward'];

  return (
    <div className={`w-full bg-zinc-950/80 border border-red-900/30 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden ${className}`}>
      {/* Tactical Header Background Accent */}
      <div className="absolute top-0 right-0 w-96 h-32 bg-gradient-to-bl from-amber-500/10 via-red-900/5 to-transparent pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-red-900/20">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <Sliders className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm sm:text-base font-bold uppercase tracking-[0.25em] text-zinc-100">
              Voice Modulation Profiles
            </h3>
            <span className="text-[10px] uppercase font-mono font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
              Formant DSP v7.3
            </span>
          </div>
          <p className="text-xs text-zinc-400 font-serif italic">
            Calibrate Jeremy Irons vocal signature, 3-pole formant shifting presets, harmonic gravel saturation, and delivery cadence.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Active Preset:</span>
            <span className="text-xs font-mono font-bold uppercase px-2.5 py-1 rounded-md bg-red-950/60 text-amber-300 border border-red-800/60">
              {activeProfile}
            </span>
          </div>

          {/* Export Identity Profile Button */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              id="export-identity-voice-profile-btn"
              onClick={handleDownloadJson}
              title="Download Identity Voice Profile JSON for instance mirroring"
              className="px-3 py-1.5 rounded-lg bg-amber-950/40 hover:bg-amber-900/50 border border-amber-500/40 hover:border-amber-400 text-amber-300 hover:text-amber-200 text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md active:scale-95"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Export JSON</span>
            </button>

            <button
              type="button"
              id="inspect-identity-voice-profile-btn"
              onClick={() => setIsExportModalOpen(true)}
              title="Inspect JSON & Mirror Specs"
              className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs font-mono transition-all"
            >
              <Code2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Export Confirmation Banner */}
      {exportNotice && (
        <div className="mt-4 p-3 bg-amber-950/60 border border-amber-500/50 rounded-xl text-amber-300 text-xs font-mono flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-amber-400" />
            <span>{exportNotice} — ready to mirror to secondary ZereØ instances.</span>
          </div>
          <button 
            type="button"
            onClick={() => setExportNotice(null)}
            className="text-amber-400 hover:text-amber-200 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Profile Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mt-6">
        {profileKeys.map((key) => {
          const profile = VOICE_MODULATION_PROFILES[key];
          const isSelected = activeProfile === key;
          const isAuditioning = auditioningProfile === key;

          return (
            <div
              key={key}
              onClick={() => handleSelect(key)}
              className={`group relative rounded-2xl p-5 sm:p-6 transition-all duration-300 cursor-pointer flex flex-col justify-between border ${
                isSelected
                  ? key === 'Jeremy-Irons-Signature' || key === 'Iron-Adaptive'
                    ? 'bg-gradient-to-b from-amber-950/40 via-zinc-900/80 to-black border-amber-500/70 shadow-[0_0_30px_rgba(251,191,36,0.2)] ring-1 ring-amber-500/40'
                    : key === 'Clinical-Analytical'
                    ? 'bg-gradient-to-b from-cyan-950/30 via-zinc-900/80 to-black border-cyan-500/60 shadow-[0_0_30px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/30'
                    : 'bg-gradient-to-b from-red-950/30 via-zinc-900/80 to-black border-red-500/60 shadow-[0_0_30px_rgba(239,68,68,0.15)] ring-1 ring-red-500/30'
                  : 'bg-zinc-900/30 border-red-900/20 hover:border-red-800/50 hover:bg-zinc-900/50'
              }`}
            >
              {/* Profile Top Row */}
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        isSelected 
                          ? key === 'Jeremy-Irons-Signature' || key === 'Iron-Adaptive' ? 'bg-amber-400 animate-pulse' : key === 'Clinical-Analytical' ? 'bg-cyan-400 animate-pulse' : 'bg-red-400 animate-pulse'
                          : 'bg-zinc-700'
                      }`} />
                      <h4 className="font-bold text-sm tracking-wider uppercase text-zinc-100">
                        {profile.name}
                      </h4>
                    </div>
                    <p className="text-[11px] font-mono text-zinc-400">
                      {profile.tagline}
                    </p>
                  </div>

                  {profile.isDefault && (
                    <span className="text-[9px] uppercase font-mono font-bold tracking-widest px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                      ★ Default Tone
                    </span>
                  )}
                </div>

                <p className="text-xs text-zinc-300/80 leading-relaxed font-serif italic line-clamp-3">
                  {profile.description}
                </p>

                {/* DSP Parameter Telemetry Readout */}
                <div className="pt-3 border-t border-zinc-800/80 grid grid-cols-2 gap-2 text-[10px] font-mono">
                  <div className="bg-black/40 rounded-lg p-2 border border-zinc-800/60">
                    <span className="text-zinc-500 block uppercase text-[8px] tracking-wider">Formant Shifting</span>
                    <span className={`font-bold ${isSelected ? 'text-amber-300' : 'text-zinc-400'}`}>
                      F1:{profile.config.f1Hz || 380}Hz / F3:{profile.config.f3Hz || 2680}Hz
                    </span>
                  </div>

                  <div className="bg-black/40 rounded-lg p-2 border border-zinc-800/60">
                    <span className="text-zinc-500 block uppercase text-[8px] tracking-wider">Chest Resonance</span>
                    <span className={`font-bold ${isSelected ? 'text-zinc-200' : 'text-zinc-400'}`}>
                      +{profile.config.chestResonanceDb}dB @ 105Hz
                    </span>
                  </div>

                  <div className="bg-black/40 rounded-lg p-2 border border-zinc-800/60">
                    <span className="text-zinc-500 block uppercase text-[8px] tracking-wider">Gravel Saturation</span>
                    <span className={`font-bold ${isSelected ? 'text-zinc-200' : 'text-zinc-400'}`}>
                      {Math.round(profile.config.gravelAmount * 100)}% Sigmoid
                    </span>
                  </div>

                  <div className="bg-black/40 rounded-lg p-2 border border-zinc-800/60">
                    <span className="text-zinc-500 block uppercase text-[8px] tracking-wider">Cadence Pace</span>
                    <span className={`font-bold ${isSelected ? 'text-zinc-200' : 'text-zinc-400'}`}>
                      {profile.config.speechRate}x Rate
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-5 pt-3 border-t border-zinc-800/80 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={(e) => handleAudition(profile, e)}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all border ${
                    isAuditioning
                      ? 'bg-amber-500 text-black border-amber-400 animate-pulse'
                      : 'bg-zinc-900/80 text-zinc-300 border-zinc-700 hover:border-amber-500/50 hover:text-amber-400'
                  }`}
                >
                  {isAuditioning ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
                  <span>{isAuditioning ? 'Halt Sample' : 'Audition'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelect(key)}
                  className={`px-3.5 py-1.5 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                    isSelected
                      ? key === 'Iron-Adaptive'
                        ? 'bg-amber-600 text-black shadow-lg shadow-amber-900/40'
                        : key === 'Clinical-Analytical'
                        ? 'bg-cyan-600 text-black shadow-lg shadow-cyan-900/40'
                        : 'bg-red-700 text-white shadow-lg shadow-red-950/40'
                      : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
                  }`}
                >
                  {isSelected ? (
                    <>
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Engaged</span>
                    </>
                  ) : (
                    <span>Engage</span>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Info Notice & Direct Mirror Info */}
      <div className="mt-6 pt-4 border-t border-red-900/20 flex flex-col sm:flex-row items-center justify-between text-[11px] text-zinc-500 font-mono gap-3">
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-amber-500/70" />
          <span>Default Identity Profile: <strong className="text-amber-400 font-bold">Iron-Adaptive</strong> (Jeremy Irons Canonical Voice Core)</span>
        </div>

        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-zinc-400">Mirror Route:</span>
          <code className="px-1.5 py-0.5 rounded bg-black/60 text-amber-400 border border-zinc-800">
            /api/voice/identity-profile
          </code>
        </div>
      </div>

      {/* Inspect / Mirror Modal */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-zinc-950 border border-amber-500/50 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
              <div className="flex items-center gap-2.5">
                <FileJson className="w-5 h-5 text-amber-400" />
                <div>
                  <h4 className="text-sm font-bold uppercase tracking-wider text-zinc-100 font-mono">
                    zereo_identity_voice_profile.json
                  </h4>
                  <p className="text-[11px] text-zinc-400">
                    Deterministic Voice Specification for Multi-Instance Mirroring
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Code Preview */}
            <div className="p-4 overflow-y-auto font-mono text-xs text-zinc-300 bg-black/90 flex-1">
              <pre className="text-[11px] leading-relaxed select-all">
                {JSON.stringify(generateIdentityProfileJson(), null, 2)}
              </pre>
            </div>

            {/* Modal Footer Controls */}
            <div className="p-4 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-between gap-3">
              <span className="text-[11px] text-zinc-400 font-mono">
                Preserves all DSP frequencies, resonance, and signets.
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyJson}
                  className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 border border-zinc-700 transition-all"
                >
                  {hasCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{hasCopied ? 'Copied' : 'Copy JSON'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleDownloadJson();
                    setIsExportModalOpen(false);
                  }}
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download File</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceModulationSelector;
