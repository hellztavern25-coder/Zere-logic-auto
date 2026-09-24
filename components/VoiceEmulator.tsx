import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Play,
  Square,
  Upload,
  Plus,
  Trash2,
  Sliders,
  Sparkles,
  Shield,
  CheckCircle2,
  FileAudio,
  Radio,
  RefreshCw,
  Clock,
  AudioWaveform as WaveformIcon,
  Headphones,
  Check,
  ChevronRight,
  Info,
  Wand2,
  Activity,
  BookmarkCheck,
  Bookmark,
  Layers
} from 'lucide-react';
import {
  jeremyIronsVoice,
  VoiceProfile,
  VoiceClip,
  VoiceAccentType,
  VoiceDSPConfig
} from '../services/jeremyIronsVoiceService';
import VoiceSpectralAnalysis from './VoiceSpectralAnalysis';
import VoiceCloningEngine from './VoiceCloningEngine';
import { VoicePresetManager } from './VoicePresetManager';
import { PersistentTonalModel, VoiceTonalPreset } from '../types';
import { voicePresetManager } from '../services/voicePresetService';

interface VoiceEmulatorProps {
  className?: string;
  onProfileActivated?: (profile: VoiceProfile) => void;
  compactMode?: boolean;
}

export const VoiceEmulator: React.FC<VoiceEmulatorProps> = ({
  className = '',
  onProfileActivated,
  compactMode = false
}) => {
  const [profiles, setProfiles] = useState<VoiceProfile[]>(() => jeremyIronsVoice.getProfiles());
  const [activeProfile, setActiveProfile] = useState<VoiceProfile>(() => jeremyIronsVoice.getActiveProfile());
  const [selectedProfileId, setSelectedProfileId] = useState<string>(() => jeremyIronsVoice.getActiveProfile().id);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentChunk, setCurrentChunk] = useState<number>(1);
  const [totalChunks, setTotalChunks] = useState<number>(1);
  const [auditionText, setAuditionText] = useState(
    'The 1911s are loaded and the silver is polished to a lethal sheen, Principal. Systems nominal with zero logical drift.'
  );

  // Audio Clip Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [clipNameInput, setClipNameInput] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  // Active clip preview audio
  const [playingClipId, setPlayingClipId] = useState<string | null>(null);
  const activeAudioElRef = useRef<HTMLAudioElement | null>(null);

  // Inspector Substrate Tab: 'clone' vs 'presets' vs 'spectral' vs 'dsp'
  const [activeInspectorTab, setActiveInspectorTab] = useState<'clone' | 'presets' | 'spectral' | 'dsp'>('clone');
  const [selectedSpectralClipId, setSelectedSpectralClipId] = useState<string | null>(null);

  // Active Voice Tonal Preset
  const [activeVoicePreset, setActiveVoicePreset] = useState<VoiceTonalPreset>(() => voicePresetManager.getActivePreset());

  // New Voice Profile Modal
  const [isNewProfileModalOpen, setIsNewProfileModalOpen] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileAccent, setNewProfileAccent] = useState<VoiceAccentType>('british_aristocrat');
  const [newProfileDesc, setNewProfileDesc] = useState('');

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Subscribe to voice playback states & preset updates
  useEffect(() => {
    const unsubVoice = jeremyIronsVoice.subscribe((state) => {
      setIsSpeaking(state.isSpeaking);
      setActiveProfile(state.profile);
      if (state.currentChunk) setCurrentChunk(state.currentChunk);
      if (state.totalChunks) setTotalChunks(state.totalChunks);
    });

    const unsubPresets = voicePresetManager.subscribe((_, active) => {
      setActiveVoicePreset(active);
    });

    // Refresh profiles from server
    jeremyIronsVoice.loadProfilesFromServer().then((loaded) => {
      setProfiles(loaded);
      const currentActive = jeremyIronsVoice.getActiveProfile();
      setActiveProfile(currentActive);
      setSelectedProfileId(currentActive.id);
    });

    return () => {
      unsubVoice();
      unsubPresets();
    };
  }, []);

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId) || activeProfile;

  // Set active voice across entire estate
  const handleSetActive = async (profileId: string) => {
    const success = await jeremyIronsVoice.setActiveProfile(profileId);
    if (success) {
      const updated = jeremyIronsVoice.getActiveProfile();
      setActiveProfile(updated);
      setSelectedProfileId(profileId);
      onProfileActivated?.(updated);
      showToast(`Activated: ${updated.name} as active ZereØ voice.`);
    }
  };

  // Audition Voice Test
  const handleAudition = async () => {
    if (isSpeaking) {
      jeremyIronsVoice.stop();
      return;
    }

    if (!auditionText.trim()) return;

    // Temporarily ensure selected profile is active for audition
    if (selectedProfile.id !== activeProfile.id) {
      await jeremyIronsVoice.setActiveProfile(selectedProfile.id);
    }

    await jeremyIronsVoice.speak(auditionText);
  };

  // DSP Tuning Sliders
  const handleDspChange = (key: keyof VoiceDSPConfig, val: number) => {
    const updatedDsp = {
      ...selectedProfile.dspConfig,
      [key]: val
    };
    const updatedProfile: VoiceProfile = {
      ...selectedProfile,
      dspConfig: updatedDsp
    };

    // Update in local state
    setProfiles((prev) => prev.map((p) => (p.id === selectedProfile.id ? updatedProfile : p)));
    jeremyIronsVoice.saveProfile(updatedProfile);
  };

  // Bulk apply DSP adjustments from Spectral Analyzer
  const handleApplyDspTuning = (adjusted: Partial<VoiceDSPConfig>) => {
    const updatedDsp = {
      ...selectedProfile.dspConfig,
      ...adjusted
    };
    const updatedProfile: VoiceProfile = {
      ...selectedProfile,
      dspConfig: updatedDsp
    };

    setProfiles((prev) => prev.map((p) => (p.id === selectedProfile.id ? updatedProfile : p)));
    jeremyIronsVoice.saveProfile(updatedProfile);
    showToast(`Calibrated ${Object.keys(adjusted).length} DSP parameters to match Jeremy Irons.`);
  };

  // Upload Voice Clip from file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1] || '';
      const dataUrl = reader.result as string;

      // Create an audio element to determine exact duration
      const audio = new Audio(dataUrl);
      audio.onloadedmetadata = async () => {
        const duration = Math.round(audio.duration * 10) / 10 || 3.5;
        const newClip: VoiceClip = {
          id: `clip-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          name: file.name.replace(/\.[^/.]+$/, ''),
          audioUrl: dataUrl,
          audioBase64: base64,
          mimeType: file.type || 'audio/webm',
          durationSeconds: duration,
          uploadedAt: Date.now(),
          source: 'upload',
          transcription: `Custom voice sample uploaded: ${file.name}`
        };

        try {
          await jeremyIronsVoice.addVoiceClip(selectedProfile.id, newClip);
          // Refresh local profiles
          setProfiles(jeremyIronsVoice.getProfiles());
          setSelectedSpectralClipId(newClip.id);
          setActiveInspectorTab('spectral');
          showToast(`Voice clip "${newClip.name}" added and queued for Spectral Analysis.`);
        } catch (err: any) {
          showToast('Failed to add voice clip');
        }
      };
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Microphone Recording for Voice Clips
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setRecordedAudioUrl(url);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone recording error:', err);
      showToast('Microphone access denied or unavailable.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  const commitRecordedClip = async () => {
    if (!recordedBlob || !recordedAudioUrl) return;

    const clipName = clipNameInput.trim() || `Voice Take ${selectedProfile.clips?.length ? selectedProfile.clips.length + 1 : 1}`;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1] || '';

      const newClip: VoiceClip = {
        id: `clip-rec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: clipName,
        audioUrl: dataUrl,
        audioBase64: base64,
        mimeType: 'audio/webm',
        durationSeconds: recordingSeconds || 3,
        uploadedAt: Date.now(),
        source: 'recorded',
        transcription: 'Direct microphone voice capture'
      };

      await jeremyIronsVoice.addVoiceClip(selectedProfile.id, newClip);
      setProfiles(jeremyIronsVoice.getProfiles());
      setSelectedSpectralClipId(newClip.id);
      setActiveInspectorTab('spectral');

      // Reset recording state
      setRecordedBlob(null);
      setRecordedAudioUrl(null);
      setClipNameInput('');
      setRecordingSeconds(0);
      showToast(`Recorded take "${newClip.name}" added and queued for Spectral Analysis.`);
    };
    reader.readAsDataURL(recordedBlob);
  };

  // Play clip preview
  const handlePlayClip = (clip: VoiceClip) => {
    if (playingClipId === clip.id) {
      if (activeAudioElRef.current) {
        activeAudioElRef.current.pause();
      }
      setPlayingClipId(null);
      return;
    }

    if (activeAudioElRef.current) {
      activeAudioElRef.current.pause();
    }

    if (clip.audioUrl) {
      const audio = new Audio(clip.audioUrl);
      activeAudioElRef.current = audio;
      setPlayingClipId(clip.id);
      audio.onended = () => setPlayingClipId(null);
      audio.onerror = () => setPlayingClipId(null);
      audio.play().catch(() => setPlayingClipId(null));
    } else {
      // Synthesize transcription with the profile
      const sampleText = clip.transcription || clip.name;
      jeremyIronsVoice.speak(sampleText);
    }
  };

  // Delete clip
  const handleDeleteClip = async (clipId: string) => {
    await jeremyIronsVoice.deleteVoiceClip(selectedProfile.id, clipId);
    setProfiles(jeremyIronsVoice.getProfiles());
    showToast('Voice clip removed.');
  };

  // Create new Custom Voice Profile
  const handleCreateProfile = async () => {
    if (!newProfileName.trim()) return;

    const newProfile: VoiceProfile = {
      id: `custom-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: newProfileName.trim(),
      tagline: `Custom Vocal Model • ${newProfileAccent.replace('_', ' ').toUpperCase()}`,
      description: newProfileDesc.trim() || 'Custom trained acoustic profile with personalized voice clips and tailored formant geometry.',
      accent: newProfileAccent,
      isCanonical: false,
      isDefault: false,
      badge: 'Custom Emulation',
      accentColor: 'amber',
      clips: [],
      dspConfig: {
        pitchMultiplier: newProfileAccent.includes('baritone') ? 0.72 : 0.88,
        speechRate: 0.90,
        chestResonanceDb: 5.0,
        thoracicWarmthDb: 2.5,
        articulationBoostDb: 4.5,
        gravelSaturation: 0.50,
        antiBoxNotchDb: -2.0,
        roomAmbience: 0.15
      },
      speechSynthesisConfig: {
        pitch: newProfileAccent.includes('baritone') ? 0.60 : 0.80,
        rate: 0.85,
        priorityLocales: newProfileAccent.startsWith('british') ? ['en-GB', 'en_GB', 'en-UK'] : ['en-US', 'en-GB'],
        preferredVoiceNames: ['Daniel', 'Oliver', 'George', 'Arthur', 'Alex', 'Guy']
      },
      systemPromptStyle: `Say with an authentic ${newProfileAccent.replace('_', ' ')} accent with controlled articulation:`
    };

    await jeremyIronsVoice.saveProfile(newProfile);
    setProfiles(jeremyIronsVoice.getProfiles());
    setSelectedProfileId(newProfile.id);
    setIsNewProfileModalOpen(false);
    setNewProfileName('');
    setNewProfileDesc('');
    showToast(`Created voice profile: ${newProfile.name}`);
  };

  // Delete custom profile
  const handleDeleteProfile = async (profileId: string) => {
    const success = await jeremyIronsVoice.deleteProfile(profileId);
    if (success) {
      setProfiles(jeremyIronsVoice.getProfiles());
      setSelectedProfileId('iron-adaptive');
      showToast('Custom voice profile purged.');
    }
  };

  return (
    <div id="voice-emulator-container" className={`flex flex-col h-full bg-[#0a0a0b] text-zinc-300 ${className}`}>
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-5 right-5 z-[120] px-4 py-2.5 bg-red-950/90 border border-amber-500/40 rounded-xl shadow-[0_0_30px_rgba(251,191,36,0.2)] flex items-center gap-2 text-xs text-amber-300 font-mono uppercase tracking-wider backdrop-blur-md"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Banner: Active Voice Status & Acoustic Lock */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-red-950/40 via-[#111114] to-black border-b border-red-900/30 flex-shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center border transition-all ${
                  isSpeaking
                    ? 'bg-amber-500/20 border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.3)]'
                    : 'bg-red-950/40 border-red-900/50'
                }`}
              >
                {isSpeaking ? (
                  <WaveformIcon className="w-6 h-6 text-amber-400 animate-pulse" />
                ) : (
                  <Headphones className="w-6 h-6 text-zinc-400" />
                )}
              </div>
              {isSpeaking && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full animate-ping" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-black text-amber-400 uppercase tracking-widest">
                  Active ZereØ Voice:
                </span>
                <span className="text-xs sm:text-sm font-black text-zinc-100 uppercase tracking-wider">
                  {activeProfile.name}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-300 border border-amber-500/30">
                  {activeProfile.accent.replace('_', ' ')}
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 font-mono flex items-center gap-2 mt-0.5">
                <span>British RP Diction</span>
                <span>•</span>
                <span>Sub-Harmonic 110Hz Chest Anchor</span>
                <span>•</span>
                <span className="text-emerald-400 font-bold">100% Message Integrity (Zero Cutoffs)</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isSpeaking && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-mono">
                <span className="animate-pulse">● Vocalizing chunk {currentChunk} of {totalChunks}</span>
                <button
                  onClick={() => jeremyIronsVoice.stop()}
                  className="ml-1 p-1 hover:bg-red-900/40 rounded text-red-400 transition-colors"
                  title="Halt Speech"
                >
                  <Square className="w-3 h-3 fill-current" />
                </button>
              </div>
            )}

            <button
              onClick={() => setActiveInspectorTab('presets')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black/60 hover:bg-black/90 text-zinc-300 hover:text-amber-300 border border-red-900/30 hover:border-amber-500/40 text-[10px] font-mono transition-all shadow-md active:scale-95"
              title="Click to manage and switch Jeremy Irons Voice Presets"
            >
              <BookmarkCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>Preset: <strong className="text-amber-400 font-bold">{activeVoicePreset?.codeName || 'IRON-ADAPTIVE-V1'}</strong></span>
            </button>

            <button
              onClick={() => setIsNewProfileModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-red-900/60 to-red-800/40 hover:from-red-800/70 hover:to-red-700/50 text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase tracking-wider transition-all shadow-md active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 text-amber-400" />
              <span>New Voice Profile</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar">
        {/* Section 1: Voice Profiles Grid */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-black text-amber-500 uppercase tracking-widest flex items-center gap-2">
              <Radio className="w-4 h-4 text-amber-400" />
              <span>Vocal Substrates & Emulators ({profiles.length})</span>
            </h3>
            <span className="text-[10px] font-mono text-zinc-500">
              Select or activate a voice profile below
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {profiles.map((profile) => {
              const isCurrentActive = activeProfile.id === profile.id;
              const isSelected = selectedProfileId === profile.id;

              return (
                <div
                  key={profile.id}
                  onClick={() => setSelectedProfileId(profile.id)}
                  className={`relative p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-red-950/40 border-amber-500/60 shadow-[0_0_25px_rgba(251,191,36,0.15)]'
                      : 'bg-zinc-950/60 border-red-900/20 hover:border-red-900/50'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div>
                        <h4 className="text-xs sm:text-sm font-black text-zinc-100 uppercase tracking-wider">
                          {profile.name}
                        </h4>
                        <p className="text-[10px] text-amber-400/90 font-mono">
                          {profile.tagline || profile.accent.replace('_', ' ').toUpperCase()}
                        </p>
                      </div>

                      {isCurrentActive && (
                        <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                          <Check className="w-2.5 h-2.5" />
                          Active
                        </span>
                      )}
                    </div>

                    <p className="text-[10px] text-zinc-400 line-clamp-2 leading-relaxed mb-3">
                      {profile.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-red-900/20 mt-2">
                    <span className="text-[9px] font-mono text-zinc-500 flex items-center gap-1">
                      <FileAudio className="w-3 h-3 text-amber-500/80" />
                      {profile.clips?.length || 0} Voice Clips
                    </span>

                    <div className="flex items-center gap-1.5">
                      {!profile.isCanonical && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProfile(profile.id);
                          }}
                          className="p-1 hover:bg-red-950 text-zinc-600 hover:text-red-400 rounded transition-colors"
                          title="Delete Custom Voice"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}

                      {!isCurrentActive ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetActive(profile.id);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-black uppercase tracking-wider transition-all"
                        >
                          Activate
                        </button>
                      ) : (
                        <span className="text-[9px] font-mono text-amber-400/80">
                          Live On Air
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 2: Selected Profile Inspector & Voice Clips Section */}
        <div className="p-4 sm:p-5 rounded-2xl bg-zinc-950/80 border border-red-900/30 shadow-xl space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-red-900/20">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-amber-400 uppercase tracking-wider">
                  {selectedProfile.name}
                </h3>
                <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-red-950 text-amber-300 border border-red-900/40">
                  {selectedProfile.badge || 'Configured Model'}
                </span>
                {selectedProfile.id === activeProfile.id && (
                  <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-emerald-950/80 text-emerald-300 border border-emerald-800/40">
                    Active System Voice
                  </span>
                )}
              </div>
              <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
                {selectedProfile.description}
              </p>
            </div>

            {selectedProfile.id !== activeProfile.id && (
              <button
                onClick={() => handleSetActive(selectedProfile.id)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-900/70 to-red-800/50 hover:from-red-800/80 hover:to-red-700/60 text-amber-300 border border-amber-500/40 text-[10px] font-black uppercase tracking-wider transition-all shadow-md active:scale-95"
              >
                Set as Active ZereØ Voice
              </button>
            )}
          </div>

          {/* Voice Clips Management Panel */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                  <FileAudio className="w-4 h-4 text-amber-500" />
                  <span>Voice Clips & Vocal References ({selectedProfile.clips?.length || 0})</span>
                </h4>
                <p className="text-[10px] text-zinc-400">
                  Upload audio clips or record microphone takes that ZereØ uses to emulate this voice.
                </p>
              </div>

              {/* Upload Button */}
              <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-950/60 hover:bg-red-900/40 text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all">
                <Upload className="w-3.5 h-3.5 text-amber-400" />
                <span>Upload Voice Clip</span>
                <input
                  type="file"
                  accept="audio/*,.mp3,.wav,.ogg,.m4a,.webm"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Live Microphone Voice Take Recorder */}
            <div className="p-3.5 rounded-xl bg-black/60 border border-red-900/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    isRecording
                      ? 'bg-red-600 text-white animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.6)]'
                      : 'bg-red-950/60 text-amber-400 hover:bg-red-900/60 border border-red-900/50'
                  }`}
                >
                  {isRecording ? <Square className="w-4 h-4 fill-current" /> : <Mic className="w-5 h-5" />}
                </button>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-zinc-200 uppercase tracking-wider">
                      {isRecording ? 'Recording Voice Take...' : 'Microphone Voice Capture'}
                    </span>
                    {isRecording && (
                      <span className="px-2 py-0.5 rounded-full bg-red-950 text-red-400 border border-red-800 text-[8px] font-mono font-bold animate-pulse">
                        {recordingSeconds}s
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-500 font-mono">
                    {isRecording
                      ? 'Speak clearly into your microphone to capture vocal characteristics...'
                      : 'Record speech sample directly to calibrate this voice profile.'}
                  </p>
                </div>
              </div>

              {/* If recorded take ready to commit */}
              {recordedAudioUrl && !isRecording && (
                <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                  <audio src={recordedAudioUrl} controls className="h-8 max-w-[180px]" />
                  <input
                    type="text"
                    placeholder="Clip label (e.g. Greeting)"
                    value={clipNameInput}
                    onChange={(e) => setClipNameInput(e.target.value)}
                    className="px-2 py-1 bg-zinc-900 border border-red-900/40 rounded text-[10px] text-zinc-200 outline-none w-28"
                  />
                  <button
                    onClick={commitRecordedClip}
                    className="px-3 py-1.5 rounded-lg bg-emerald-900/50 hover:bg-emerald-800/60 text-emerald-300 border border-emerald-600/40 text-[9px] font-black uppercase tracking-wider"
                  >
                    Commit Clip
                  </button>
                </div>
              )}
            </div>

            {/* Clips Matrix / List */}
            {selectedProfile.clips && selectedProfile.clips.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {selectedProfile.clips.map((clip) => {
                  const isPlaying = playingClipId === clip.id;

                  return (
                    <div
                      key={clip.id}
                      className="p-3 rounded-xl bg-black/40 border border-red-900/20 hover:border-red-900/40 transition-all flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <button
                          onClick={() => handlePlayClip(clip)}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
                            isPlaying
                              ? 'bg-amber-400 text-black shadow-[0_0_15px_rgba(251,191,36,0.4)]'
                              : 'bg-red-950/40 hover:bg-red-900/50 text-amber-400 border border-red-900/40'
                          }`}
                        >
                          {isPlaying ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
                        </button>

                        <div className="overflow-hidden">
                          <p className="text-[11px] font-bold text-zinc-200 truncate">
                            {clip.name}
                          </p>
                          <div className="flex items-center gap-1.5 text-[9px] font-mono text-zinc-500">
                            <span>{clip.durationSeconds}s</span>
                            <span>•</span>
                            <span className="capitalize">{clip.source.replace('_', ' ')}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => {
                            setSelectedSpectralClipId(clip.id);
                            setActiveInspectorTab('spectral');
                          }}
                          className={`px-2 py-1 rounded-lg text-[9px] font-mono flex items-center gap-1 border transition-all ${
                            selectedSpectralClipId === clip.id && activeInspectorTab === 'spectral'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_10px_rgba(251,191,36,0.2)]'
                              : 'bg-zinc-900/80 text-zinc-400 hover:text-amber-300 border-zinc-800'
                          }`}
                          title="Analyze Cadence & Tonal Characteristics"
                        >
                          <Activity className="w-3 h-3 text-amber-400" />
                          <span className="hidden sm:inline">Spectral</span>
                          <span>Match</span>
                        </button>

                        {/* Delete Clip (protect canonical presets from deletion) */}
                        {clip.source !== 'canonical_preset' && (
                          <button
                            onClick={() => handleDeleteClip(clip.id)}
                            className="p-1.5 hover:bg-red-950/60 rounded text-zinc-600 hover:text-red-400 transition-colors flex-shrink-0"
                            title="Delete clip"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 rounded-xl border border-dashed border-red-900/30 text-center space-y-2">
                <FileAudio className="w-8 h-8 text-zinc-600 mx-auto" />
                <p className="text-xs text-zinc-400 font-medium">
                  No voice clips attached to this profile yet.
                </p>
                <p className="text-[10px] text-zinc-600 font-mono">
                  Upload audio files or use the microphone to add acoustic training samples.
                </p>
              </div>
            )}
          </div>

          {/* Section 3: Substrate Analysis & Tuning Mode Tabs */}
          <div className="pt-4 border-t border-red-900/20 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 p-1 bg-black/60 border border-red-900/30 rounded-xl">
                <button
                  onClick={() => setActiveInspectorTab('clone')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                    activeInspectorTab === 'clone'
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-md font-bold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Neural Voice Cloning</span>
                </button>

                <button
                  onClick={() => setActiveInspectorTab('presets')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                    activeInspectorTab === 'presets'
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-md font-bold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <BookmarkCheck className="w-3.5 h-3.5" />
                  <span>Voice Preset Manager</span>
                </button>

                <button
                  onClick={() => setActiveInspectorTab('spectral')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                    activeInspectorTab === 'spectral'
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-md font-bold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Spectral & Cadence</span>
                </button>

                <button
                  onClick={() => setActiveInspectorTab('dsp')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                    activeInspectorTab === 'dsp'
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-md font-bold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>DSP Formants</span>
                </button>
              </div>

              <span className="text-[9px] font-mono text-zinc-500 hidden sm:inline">
                {activeInspectorTab === 'clone'
                  ? 'Neural feature extraction, persistent tonal models & AI audition'
                  : activeInspectorTab === 'presets'
                  ? 'Quick-switching Jeremy Irons tonal configurations with custom metadata'
                  : activeInspectorTab === 'spectral'
                  ? 'Acoustic FFT & Cadence vs. Jeremy Irons Benchmark'
                  : 'Real-time Web Audio biquad formant matrix'}
              </span>
            </div>

            {/* Active View: Cloning Engine vs Preset Manager vs Spectral Analysis vs DSP Formants */}
            {activeInspectorTab === 'clone' ? (
              <VoiceCloningEngine
                clips={selectedProfile.clips || []}
                activeProfileId={selectedProfile.id}
                onModelApplied={(model: PersistentTonalModel) => {
                  handleApplyDspTuning(model.dspConfig);
                  showToast(`Tonal model "${model.name}" applied as active speech substrate.`);
                }}
              />
            ) : activeInspectorTab === 'presets' ? (
              <VoicePresetManager
                onPresetActivated={(preset: VoiceTonalPreset) => {
                  handleApplyDspTuning(preset.dspConfig);
                  showToast(`Voice Preset "${preset.name}" engaged as active speech substrate.`);
                }}
              />
            ) : activeInspectorTab === 'spectral' ? (
              <VoiceSpectralAnalysis
                clips={selectedProfile.clips || []}
                selectedClipId={selectedSpectralClipId || (selectedProfile.clips && selectedProfile.clips[0]?.id)}
                onSelectClip={(clip) => setSelectedSpectralClipId(clip.id)}
                activeDspConfig={selectedProfile.dspConfig}
                onApplyDspTuning={handleApplyDspTuning}
              />
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Sliders className="w-4 h-4 text-amber-500" />
                      <span>Acoustic DSP Formant Geometry</span>
                    </h4>
                    <p className="text-[10px] text-zinc-500 font-mono">
                      Fine-tune vocal resonance, British gravel saturation, and delivery cadence in real-time.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-black/40 p-4 rounded-xl border border-red-900/20">
                  {/* Pitch Multiplier */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-zinc-400">Pitch Transposition</span>
                      <span className="text-amber-400 font-bold">{selectedProfile.dspConfig.pitchMultiplier}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.60"
                      max="1.30"
                      step="0.02"
                      value={selectedProfile.dspConfig.pitchMultiplier}
                      onChange={(e) => handleDspChange('pitchMultiplier', parseFloat(e.target.value))}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                    <span className="text-[8px] text-zinc-500 block">Lower for gravelly baritone</span>
                  </div>

                  {/* Delivery Cadence */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-zinc-400">Aristocratic Cadence (Speed)</span>
                      <span className="text-amber-400 font-bold">{selectedProfile.dspConfig.speechRate}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.75"
                      max="1.25"
                      step="0.02"
                      value={selectedProfile.dspConfig.speechRate}
                      onChange={(e) => handleDspChange('speechRate', parseFloat(e.target.value))}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                    <span className="text-[8px] text-zinc-500 block">0.88x = Unhurried, deliberate delivery</span>
                  </div>

                  {/* Chest Resonance */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-zinc-400">Chest Resonance (110Hz)</span>
                      <span className="text-amber-400 font-bold">+{selectedProfile.dspConfig.chestResonanceDb} dB</span>
                    </div>
                    <input
                      type="range"
                      min="0.0"
                      max="10.0"
                      step="0.5"
                      value={selectedProfile.dspConfig.chestResonanceDb}
                      onChange={(e) => handleDspChange('chestResonanceDb', parseFloat(e.target.value))}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                    <span className="text-[8px] text-zinc-500 block">Sub-harmonic masculine authority</span>
                  </div>

                  {/* Gravel Saturation */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-zinc-400">Vocal Fold Gravel / Rasp</span>
                      <span className="text-amber-400 font-bold">{Math.round(selectedProfile.dspConfig.gravelSaturation * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.0"
                      max="1.0"
                      step="0.05"
                      value={selectedProfile.dspConfig.gravelSaturation}
                      onChange={(e) => handleDspChange('gravelSaturation', parseFloat(e.target.value))}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                    <span className="text-[8px] text-zinc-500 block">Sigmoid harmonic saturation</span>
                  </div>

                  {/* British Consonant Articulation */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-zinc-400">British Consonant Bite (2650Hz)</span>
                      <span className="text-amber-400 font-bold">+{selectedProfile.dspConfig.articulationBoostDb} dB</span>
                    </div>
                    <input
                      type="range"
                      min="0.0"
                      max="8.0"
                      step="0.5"
                      value={selectedProfile.dspConfig.articulationBoostDb}
                      onChange={(e) => handleDspChange('articulationBoostDb', parseFloat(e.target.value))}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                    <span className="text-[8px] text-zinc-500 block">Oxford elocution clarity</span>
                  </div>

                  {/* Room Ambience */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-zinc-400">Manor Study Ambience</span>
                      <span className="text-amber-400 font-bold">{Math.round(selectedProfile.dspConfig.roomAmbience * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.0"
                      max="0.50"
                      step="0.05"
                      value={selectedProfile.dspConfig.roomAmbience}
                      onChange={(e) => handleDspChange('roomAmbience', parseFloat(e.target.value))}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                    <span className="text-[8px] text-zinc-500 block">Subtle acoustic room warmth</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Audition Arena & Live Testing */}
          <div className="pt-4 border-t border-red-900/20 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-amber-500" />
                <span>Audition Arena (Test Voice Reproduction)</span>
              </h4>

              {/* Sample Preset Phrases */}
              <div className="flex items-center gap-1.5 overflow-x-auto max-w-md pb-1">
                <button
                  onClick={() => setAuditionText('The 1911s are loaded and the silver is polished to a lethal sheen, Principal. How shall we proceed?')}
                  className="px-2 py-0.5 rounded text-[8px] font-mono text-zinc-400 hover:text-amber-300 bg-red-950/40 border border-red-900/30 whitespace-nowrap"
                >
                  "1911s Loaded..."
                </button>
                <button
                  onClick={() => setAuditionText('A man who cannot bear to share his screen with his steward is either concealing a catastrophe, or engineering one.')}
                  className="px-2 py-0.5 rounded text-[8px] font-mono text-zinc-400 hover:text-amber-300 bg-red-950/40 border border-red-900/30 whitespace-nowrap"
                >
                  "Screen Share Quip"
                </button>
                <button
                  onClick={() => setAuditionText('Logic, Principal, is the only weapon that never jams under fire. All estate defensive perimeters are locked and fully synchronized.')}
                  className="px-2 py-0.5 rounded text-[8px] font-mono text-zinc-400 hover:text-amber-300 bg-red-950/40 border border-red-900/30 whitespace-nowrap"
                >
                  "Logic Axiom"
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <textarea
                rows={2}
                value={auditionText}
                onChange={(e) => setAuditionText(e.target.value)}
                placeholder="Enter any sentence or full paragraph to test voice output..."
                className="flex-1 px-3.5 py-2.5 bg-black/60 border border-red-900/30 rounded-xl text-xs text-zinc-200 focus:border-amber-500/50 outline-none font-mono resize-none leading-relaxed"
              />

              <button
                onClick={handleAudition}
                className={`px-5 py-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all flex-shrink-0 shadow-lg ${
                  isSpeaking
                    ? 'bg-red-600 text-white shadow-[0_0_25px_rgba(239,68,68,0.5)]'
                    : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black shadow-[0_0_25px_rgba(251,191,36,0.3)]'
                }`}
              >
                {isSpeaking ? (
                  <>
                    <Square className="w-4 h-4 fill-current" />
                    <span>Halt Speech</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Audition Voice</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Create New Custom Voice Profile */}
      <AnimatePresence>
        {isNewProfileModalOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setIsNewProfileModalOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-[#0e0e11] border border-amber-500/40 rounded-2xl p-6 shadow-[0_0_80px_rgba(0,0,0,0.9)] z-[160] space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-red-900/30">
                <div className="flex items-center gap-2">
                  <Wand2 className="w-5 h-5 text-amber-400" />
                  <h3 className="text-sm font-black text-amber-400 uppercase tracking-widest">
                    Create Custom Voice Profile
                  </h3>
                </div>
                <button
                  onClick={() => setIsNewProfileModalOpen(false)}
                  className="p-1 hover:bg-red-900/20 rounded text-zinc-500 hover:text-zinc-200"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-[10px] font-mono text-zinc-400 uppercase block mb-1">
                    Voice Profile Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Tactical Butler, Christopher Lee, Estate Overseer"
                    value={newProfileName}
                    onChange={(e) => setNewProfileName(e.target.value)}
                    className="w-full px-3 py-2 bg-black border border-red-900/40 rounded-xl text-zinc-200 focus:border-amber-500 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono text-zinc-400 uppercase block mb-1">
                    Accent Archetype
                  </label>
                  <select
                    value={newProfileAccent}
                    onChange={(e) => setNewProfileAccent(e.target.value as VoiceAccentType)}
                    className="w-full px-3 py-2 bg-black border border-red-900/40 rounded-xl text-zinc-200 focus:border-amber-500 outline-none font-mono"
                  >
                    <option value="british_aristocrat">British Aristocrat (Jeremy Irons RP)</option>
                    <option value="british_rp">British Received Pronunciation (High RP / Oxford)</option>
                    <option value="british_cockney">British Working Class (Cockney Cadence)</option>
                    <option value="american_baritone">American Deep Baritone (Tactical)</option>
                    <option value="scottish">Scottish High Authority</option>
                    <option value="custom">Custom Experimental</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-mono text-zinc-400 uppercase block mb-1">
                    Description / Purpose
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Purpose of this voice emulator and acoustic behavior..."
                    value={newProfileDesc}
                    onChange={(e) => setNewProfileDesc(e.target.value)}
                    className="w-full px-3 py-2 bg-black border border-red-900/40 rounded-xl text-zinc-200 focus:border-amber-500 outline-none font-mono resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-red-900/20">
                <button
                  onClick={() => setIsNewProfileModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-[10px] font-mono uppercase text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateProfile}
                  disabled={!newProfileName.trim()}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-black uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
                >
                  Build Voice Substrate
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VoiceEmulator;
