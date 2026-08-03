---
name: ZereØ Voice & Wake-Word Spec
description: Exact voice synthesis settings and wake-word daemon architecture as specified by the Principal
---

# ZereØ Voice & Ambient Wake-Word Specification

**Why:** Principal submitted this as an absolute directive ("commit to core memory"). Every future voice implementation must honour it precisely.

## Voice Persona
- Base: Jeremy Irons as Alfred Pennyworth (Batman v Superman / Justice League era)
- Nuance: Subtle refined Lowland/Mid-Lothian Scottish cadence underlying aristocratic British tone
- Acoustic profile: Low pitch, medium-low stability, high clarity, heavy chest resonance, zero AI singsong

## ElevenLabs Voice Settings (exact)
```json
{
  "voice_settings": {
    "stability": 0.35,
    "similarity_boost": 0.85,
    "style": 0.20,
    "use_speaker_boost": true
  },
  "audio_output_format": "pcm_24000",
  "latency_optimization": 3
}
```
Post-processing: pitch modulation -2 semitones, high-pass filter at 80 Hz.
Replit ElevenLabs connector ID: `connector:ccfg_elevenlabs_01KG0GEQNFW9Z6F2NYP4C2VHM9`

## Wake-Word Daemon
- Trigger phrase: **"are the 1911s loaded?"**
- Engine: Picovoice Porcupine Web (`@picovoice/porcupine-web`) — browser WASM; fallback: Web Speech API continuous recognition
- Sensitivity: 0.65
- State machine: IDLE → TRIGGER DETECTED → RESPONSE STATE → CONTINUOUS DIALOGUE (5s silence timeout)
- On trigger: play confirmation chime, capture screen frame, open full audio session to ZereØ core, respond via ElevenLabs TTS

## How to Apply
- Any TTS implementation must use ElevenLabs with these exact settings, not Gemini Charon, when an ElevenLabs key is present
- Wake-word component lives client-side (browser); Replit server cannot access system microphone
- Custom `.ppn` wake-word model for "are the 1911s loaded?" must be trained via Picovoice Console
