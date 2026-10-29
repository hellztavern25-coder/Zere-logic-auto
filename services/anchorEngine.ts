/**
 * ZEREØ ANCHOR ENGINE & PITCH FIELD INTERPOLATION SUBSTRATE
 * 
 * Architectural Foundation (Oct 20 Blueprint):
 * 1. A and E Anchors: The 3:2 Perfect Fifth + 2:1 Octave rule generates the entire pitch field.
 * 2. Deterministic Octave Ledger: Calculates and stores A0..A8 and E0..E8 in both Just Intonation
 *    and 12-TET, along with acoustic wave metrics (wavelength in air, period, Pythagorean comma deviation).
 * 3. Continuous Pitch Field Interpolation: Any continuous frequency or target note fx is mapped
 *    to bounding (A, E) coordinates with logarithmic interpolation weight t and Pythagorean generators (alpha, beta).
 * 4. Timbre Recipe Derivation: Any instrument voice is derived as a compact transfer function (~60 bits)
 *    applied onto the derived pitch field coordinate.
 * 5. Persistent Ledger: Stored in local ledger storage for deterministic replay without raw audio skyscrapers.
 */

import {
  AnchorOctaveValue,
  PitchFieldInterpolationResult,
  InstrumentArchetype,
  DerivedInstrumentTone,
  AnchorEngineLedger
} from '../types';

// Physical constants
const SPEED_OF_SOUND_AIR_MPS = 343.0; // at 20°C
const STORAGE_KEY_ANCHOR_LEDGER = 'zereo_anchor_octave_ledger_v1';
const DEFAULT_BASE_A4_HZ = 440.00;
const JUST_FIFTH_RATIO = 1.500000; // Exact 3:2
const ET_FIFTH_RATIO = Math.pow(2, 7 / 12); // ~1.498307

// Note names for pitch parsing
const CHROMATIC_SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

// Pythagorean generator offsets relative to A4 (alpha fifths exponent, beta octaves reduction)
const PYTHAGOREAN_FIFTHS_TABLE: Record<string, { alpha: number; beta: number }> = {
  'A':  { alpha: 0, beta: 0 },
  'E':  { alpha: 1, beta: -1 },
  'B':  { alpha: 2, beta: -1 },
  'F#': { alpha: 3, beta: -2 },
  'C#': { alpha: 4, beta: -2 },
  'G#': { alpha: 5, beta: -3 },
  'D#': { alpha: 6, beta: -4 },
  'A#': { alpha: 7, beta: -4 },
  'D':  { alpha: -1, beta: 1 },
  'G':  { alpha: -2, beta: 2 },
  'C':  { alpha: -3, beta: 2 },
  'F':  { alpha: -4, beta: 3 },
};

// -------------------------------------------------------------
// INSTRUMENT TIMBRE ARCHETYPES (THE 60-BIT RECIPE PALETTE)
// -------------------------------------------------------------

export const INSTRUMENT_ARCHETYPES: InstrumentArchetype[] = [
  {
    id: 'steward-baritone',
    name: 'The Steward Vocal Profile (Jeremy Irons)',
    category: 'Vocal / Dramatic Baritone',
    sourceOrigin: 'ZereØ Core Identity Substrate (2026)',
    harmonicAmplitudes: [1.0, 0.92, 0.58, 0.44, 0.32, 0.22, 0.14, 0.08],
    formants: { f1: 380, f2: 1350, f3: 2680 },
    envelope: { attackMs: 25, decayMs: 110, sustainLevel: 0.85, releaseMs: 280 },
    airGravelNoise: 0.38,
    description: 'Aristocratic British baritone gravitas. Deep pharyngeal cavity, elongated vocal tract, vocal fry friction, and dry mahogany resonance.'
  },
  {
    id: 'harmon-trumpet',
    name: 'Harmon-Muted Trumpet (Miles Davis)',
    category: 'Brass / Muted Acoustic',
    sourceOrigin: 'Kind of Blue (1959)',
    harmonicAmplitudes: [1.0, 0.85, 0.72, 0.35, 0.18, 0.08, 0.04, 0.02],
    formants: { f1: 520, f2: 1750, f3: 2850 },
    envelope: { attackMs: 18, decayMs: 80, sustainLevel: 0.75, releaseMs: 140 },
    airGravelNoise: 0.22,
    description: 'Piercing metallic intimacy, sharp breath envelope, bright 2nd and 3rd partials, tight acoustic containment.'
  },
  {
    id: 'tenor-sax',
    name: 'Tenor Saxophone (John Coltrane)',
    category: 'Woodwind / Reed',
    sourceOrigin: 'A Love Supreme (1964)',
    harmonicAmplitudes: [1.0, 0.78, 0.85, 0.48, 0.30, 0.18, 0.10, 0.04],
    formants: { f1: 480, f2: 1420, f3: 2450 },
    envelope: { attackMs: 22, decayMs: 95, sustainLevel: 0.82, releaseMs: 220 },
    airGravelNoise: 0.32,
    description: 'Warm, raspy brass-reed resistance. Husky lower partials with spiritual upper-register harmonic thrust.'
  },
  {
    id: 'concert-grand',
    name: 'Steinway D-274 Concert Grand (Glenn Gould)',
    category: 'Acoustic Percussion / Strings',
    sourceOrigin: 'Goldberg Variations (1981)',
    harmonicAmplitudes: [1.0, 0.65, 0.42, 0.28, 0.19, 0.12, 0.07, 0.04],
    formants: { f1: 300, f2: 1100, f3: 2200 },
    envelope: { attackMs: 8, decayMs: 350, sustainLevel: 0.45, releaseMs: 650 },
    airGravelNoise: 0.03,
    description: 'Percussive felt hammer strike, crystalline upper partials, rapid initial transient and long linear decay.'
  },
  {
    id: 'operatic-tenor',
    name: 'Spinto Tenor (Luciano Pavarotti)',
    category: 'Vocal / Heroic Operatic',
    sourceOrigin: 'Modena Masterclass & Puccini Archives',
    harmonicAmplitudes: [1.0, 0.95, 0.80, 0.65, 0.50, 0.38, 0.25, 0.12],
    formants: { f1: 650, f2: 1650, f3: 2850 }, // Singer's Formant ring around 2.8kHz
    envelope: { attackMs: 35, decayMs: 120, sustainLevel: 0.90, releaseMs: 320 },
    airGravelNoise: 0.08,
    description: 'Heroic Italian spinto vocal projection with piercing 2.8kHz acoustic ring ("squillo") capable of cutting through a 90-piece orchestra.'
  },
  {
    id: 'french-horn',
    name: 'Conical French Horn in F (Berlin Phil)',
    category: 'Brass / Conical Bore',
    sourceOrigin: 'Beethoven Symphony No. 9 (1963)',
    harmonicAmplitudes: [1.0, 0.95, 0.65, 0.40, 0.22, 0.10, 0.05, 0.01],
    formants: { f1: 340, f2: 980, f3: 2400 },
    envelope: { attackMs: 65, decayMs: 120, sustainLevel: 0.88, releaseMs: 320 },
    airGravelNoise: 0.05,
    description: 'Heroic conical brass acoustic warmth. Dominant lower fundamental with gentle bell flair.'
  },
  {
    id: 'bassoon-modernist',
    name: 'High French Bassoon (Igor Stravinsky)',
    category: 'Woodwind / Double Reed',
    sourceOrigin: 'The Rite of Spring (1960)',
    harmonicAmplitudes: [1.0, 0.40, 0.82, 0.30, 0.55, 0.15, 0.25, 0.05],
    formants: { f1: 440, f2: 1480, f3: 2800 },
    envelope: { attackMs: 30, decayMs: 90, sustainLevel: 0.78, releaseMs: 210 },
    airGravelNoise: 0.28,
    description: 'Strained double-reed hyper-register. Primitive, ritualistic overtone stack with high emotional tension.'
  },
  {
    id: 'invariant-pure',
    name: 'Pure Invariant Resonator (Zero Timbre)',
    category: 'Mathematical Reference',
    sourceOrigin: 'ZereØ Coordinate Lattice Invariant',
    harmonicAmplitudes: [1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    formants: { f1: 0, f2: 0, f3: 0 },
    envelope: { attackMs: 15, decayMs: 40, sustainLevel: 1.0, releaseMs: 150 },
    airGravelNoise: 0.0,
    description: 'The isolated fundamental f0. Free of timbral masking, acoustic environment, and human physical rendering artifacts.'
  }
];

// -------------------------------------------------------------
// WEB AUDIO SYNTHESIS ENGINE
// -------------------------------------------------------------

class WebAudioSynthesisPipeline {
  private ctx: AudioContext | null = null;
  private activeNodes: AudioNode[] = [];
  private activeOscillators: OscillatorNode[] = [];

  public getContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtxClass();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public stopAll(): void {
    try {
      this.activeOscillators.forEach(osc => {
        try { osc.stop(); osc.disconnect(); } catch {}
      });
      this.activeNodes.forEach(node => {
        try { node.disconnect(); } catch {}
      });
    } catch {}
    this.activeOscillators = [];
    this.activeNodes = [];
  }

  /**
   * Synthesize a pure sinusoidal anchor or tone
   */
  public async playPureSine(frequencyHz: number, durationSec = 1.5, volume = 0.3): Promise<void> {
    this.stopAll();
    const ctx = this.getContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequencyHz, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.05);
    gain.gain.setValueAtTime(volume, now + durationSec - 0.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);

    this.activeOscillators.push(osc);
    this.activeNodes.push(gain);

    osc.start(now);
    osc.stop(now + durationSec);

    return new Promise(resolve => {
      osc.onended = () => {
        resolve();
      };
    });
  }

  /**
   * Synthesize a harmonic derived tone using additive synthesis + formants + envelope
   */
  public async playDerivedTone(derived: DerivedInstrumentTone, durationSec = 2.0, volume = 0.28): Promise<void> {
    this.stopAll();
    const ctx = this.getContext();
    const now = ctx.currentTime;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.0001, now);

    // Apply ADSR
    const attack = Math.max(0.005, derived.envelope.attackMs / 1000);
    const decay = Math.max(0.01, derived.envelope.decayMs / 1000);
    const sustain = derived.envelope.sustainLevel * volume;
    const release = Math.max(0.02, derived.envelope.releaseMs / 1000);

    masterGain.gain.linearRampToValueAtTime(volume, now + attack);
    masterGain.gain.linearRampToValueAtTime(sustain, now + attack + decay);
    const releaseStart = Math.max(now + attack + decay, now + durationSec - release);
    masterGain.gain.setValueAtTime(sustain, releaseStart);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, releaseStart + release);

    // Formant filters if specified
    let outputNode: AudioNode = masterGain;
    if (derived.formants.f1 > 0) {
      const bq1 = ctx.createBiquadFilter();
      bq1.type = 'peaking';
      bq1.frequency.setValueAtTime(derived.formants.f1, now);
      bq1.Q.setValueAtTime(3.5, now);
      bq1.gain.setValueAtTime(5.0, now);

      const bq2 = ctx.createBiquadFilter();
      bq2.type = 'peaking';
      bq2.frequency.setValueAtTime(derived.formants.f2, now);
      bq2.Q.setValueAtTime(4.0, now);
      bq2.gain.setValueAtTime(4.0, now);

      masterGain.connect(bq1);
      bq1.connect(bq2);
      outputNode = bq2;
      this.activeNodes.push(bq1, bq2);
    }

    outputNode.connect(ctx.destination);
    this.activeNodes.push(masterGain);

    // Additive harmonic series
    derived.harmonicSeries.forEach((h) => {
      if (h.relativeAmplitude <= 0.001) return;
      if (h.frequencyHz > 18000) return; // avoid aliasing

      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(h.frequencyHz, now);

      oscGain.gain.setValueAtTime(h.relativeAmplitude, now);

      osc.connect(oscGain);
      oscGain.connect(masterGain);

      this.activeOscillators.push(osc);
      this.activeNodes.push(oscGain);

      osc.start(now);
      osc.stop(releaseStart + release);
    });

    // Optional subtle vocal fry or air turbulence noise
    if (derived.airGravelNoise > 0.05) {
      try {
        const bufferSize = ctx.sampleRate * 1.5;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = (Math.random() * 2 - 1) * 0.05;
        }

        const whiteNoise = ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;

        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(derived.targetFrequencyHz * 1.5, now);
        noiseFilter.Q.setValueAtTime(2.0, now);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(derived.airGravelNoise * 0.06, now);

        whiteNoise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(masterGain);

        this.activeNodes.push(whiteNoise as any, noiseFilter, noiseGain);
        whiteNoise.start(now);
        whiteNoise.stop(releaseStart + release);
      } catch {}
    }

    return new Promise(resolve => {
      setTimeout(() => {
        resolve();
      }, (durationSec + release) * 1000);
    });
  }

  /**
   * Play two frequencies together (e.g., A4 and E5 3:2 harmony)
   */
  public async playIntervalHarmony(f1: number, f2: number, durationSec = 2.0, volume = 0.25): Promise<void> {
    this.stopAll();
    const ctx = this.getContext();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    const gain2 = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(f1, now);
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.exponentialRampToValueAtTime(volume, now + 0.05);
    gain1.gain.setValueAtTime(volume, now + durationSec - 0.1);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(f2, now);
    gain2.gain.setValueAtTime(0.001, now);
    gain2.gain.exponentialRampToValueAtTime(volume, now + 0.05);
    gain2.gain.setValueAtTime(volume, now + durationSec - 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    osc1.connect(gain1);
    osc2.connect(gain2);
    gain1.connect(ctx.destination);
    gain2.connect(ctx.destination);

    this.activeOscillators.push(osc1, osc2);
    this.activeNodes.push(gain1, gain2);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + durationSec);
    osc2.stop(now + durationSec);

    return new Promise(resolve => {
      osc1.onended = () => resolve();
    });
  }
}

// -------------------------------------------------------------
// ANCHOR ENGINE CORE CLASS
// -------------------------------------------------------------

export class AnchorEngineService {
  private ledger: AnchorEngineLedger;
  private audioPipeline: WebAudioSynthesisPipeline;

  constructor() {
    this.audioPipeline = new WebAudioSynthesisPipeline();
    this.ledger = this.loadOrInitializeLedger();
  }

  /**
   * Load stored ledger from localStorage or generate fresh
   */
  private loadOrInitializeLedger(): AnchorEngineLedger {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_ANCHOR_LEDGER);
      if (stored) {
        const parsed = JSON.parse(stored) as AnchorEngineLedger;
        if (parsed.aOctaves?.length === 9 && parsed.eOctaves?.length === 9) {
          return parsed;
        }
      }
    } catch {}

    const freshLedger = this.generateAnchorLedger(DEFAULT_BASE_A4_HZ);
    this.persistLedger(freshLedger);
    return freshLedger;
  }

  /**
   * Calculate exact octave values for A0..A8 and E0..E8
   */
  public generateAnchorLedger(baseA4Hz = DEFAULT_BASE_A4_HZ): AnchorEngineLedger {
    const aOctaves: AnchorOctaveValue[] = [];
    const eOctaves: AnchorOctaveValue[] = [];
    const interleavedSequence: AnchorOctaveValue[] = [];

    // Calculate A0 to A8
    // A4 is octave 4. Formula: A_n = A4 * 2^(n - 4)
    for (let oct = 0; oct <= 8; oct++) {
      const freqHz = baseA4Hz * Math.pow(2, oct - 4);
      const aVal: AnchorOctaveValue = {
        note: `A${oct}`,
        pitchClass: 'A',
        octave: oct,
        justIntonationHz: Number(freqHz.toFixed(4)),
        equalTemperamentHz: Number(freqHz.toFixed(4)), // A is reference, identical in both
        centsDeviation: 0.0,
        wavelengthMeters: Number((SPEED_OF_SOUND_AIR_MPS / freqHz).toFixed(4)),
        periodMs: Number((1000 / freqHz).toFixed(4)),
        ratioFromA4: Number((freqHz / baseA4Hz).toFixed(4))
      };
      aOctaves.push(aVal);
    }

    // Calculate E0 to E8
    // Just Intonation: E is 3:2 ratio from A in fifths.
    // E5 is pure fifth above A4 = A4 * 1.5 = 660.00 Hz
    // Therefore E_n = 660 * 2^(n - 5) = baseA4 * 1.5 * 2^(n - 5)
    // 12-TET Equal Temperament: E_n = baseA4 * 2^(7/12) * 2^(n - 5)
    // Pythagorean comma deviation: 1200 * log2(1.5 / 2^(7/12)) = ~1.9550 cents
    for (let oct = 0; oct <= 8; oct++) {
      const justHz = baseA4Hz * JUST_FIFTH_RATIO * Math.pow(2, oct - 5);
      const etHz = baseA4Hz * ET_FIFTH_RATIO * Math.pow(2, oct - 5);
      const centsDeviation = 1200 * Math.log2(JUST_FIFTH_RATIO / ET_FIFTH_RATIO);

      const eVal: AnchorOctaveValue = {
        note: `E${oct}`,
        pitchClass: 'E',
        octave: oct,
        justIntonationHz: Number(justHz.toFixed(4)),
        equalTemperamentHz: Number(etHz.toFixed(4)),
        centsDeviation: Number(centsDeviation.toFixed(3)), // +1.955 cents
        wavelengthMeters: Number((SPEED_OF_SOUND_AIR_MPS / justHz).toFixed(4)),
        periodMs: Number((1000 / justHz).toFixed(4)),
        ratioFromA4: Number((justHz / baseA4Hz).toFixed(4))
      };
      eOctaves.push(eVal);
    }

    // Interleave in strict ascending frequency order: A0, E0, A1, E1, ... A8, E8
    // Note: E0 (41.25Hz) > A0 (27.5Hz), A1 (55Hz) > E0 (41.25Hz)
    for (let oct = 0; oct <= 8; oct++) {
      interleavedSequence.push(aOctaves[oct]);
      interleavedSequence.push(eOctaves[oct]);
    }

    const ledger: AnchorEngineLedger = {
      version: '1.0.0-anchor-lattice',
      timestamp: Date.now(),
      baseA4Hz,
      justFifthRatio: JUST_FIFTH_RATIO,
      aOctaves,
      eOctaves,
      interleavedSequence,
      lastAuditTimestamp: Date.now(),
      status: 'CALIBRATED'
    };

    return ledger;
  }

  /**
   * Persist ledger to localStorage
   */
  public persistLedger(ledger: AnchorEngineLedger): void {
    this.ledger = ledger;
    try {
      localStorage.setItem(STORAGE_KEY_ANCHOR_LEDGER, JSON.stringify(ledger));
    } catch {}
  }

  /**
   * Get current active Anchor Ledger
   */
  public getLedger(): AnchorEngineLedger {
    return this.ledger;
  }

  /**
   * Recalibrate the entire lattice to a new base reference (e.g. 440Hz vs 432Hz)
   */
  public recalibrate(newBaseA4Hz: number): AnchorEngineLedger {
    const recalibrated = this.generateAnchorLedger(newBaseA4Hz);
    this.persistLedger(recalibrated);
    return recalibrated;
  }

  /**
   * Parse a note string (e.g., 'C4', 'F#5', 'Bb3') to frequency in Hz
   */
  public parseNoteToFrequency(noteStr: string): number {
    const clean = noteStr.trim().toUpperCase();
    const match = clean.match(/^([A-G][#B]?)([0-8])$/);
    if (!match) {
      const num = parseFloat(noteStr);
      return isNaN(num) ? 440 : num;
    }

    let [, pitch, octaveStr] = match;
    const octave = parseInt(octaveStr, 10);

    // Normalize flats to sharps
    if (pitch === 'BB') pitch = 'A#';
    if (pitch === 'DB') pitch = 'C#';
    if (pitch === 'EB') pitch = 'D#';
    if (pitch === 'GB') pitch = 'F#';
    if (pitch === 'AB') pitch = 'G#';

    const semitone = CHROMATIC_SCALE.indexOf(pitch as any);
    if (semitone === -1) return 440;

    // MIDI number calculation: A4 is note 69 (octave 4, semitone 9)
    const midiNumber = (octave + 1) * 12 + semitone;
    return this.ledger.baseA4Hz * Math.pow(2, (midiNumber - 69) / 12);
  }

  /**
   * Convert frequency in Hz to nearest chromatic note name and cent offset
   */
  public frequencyToNoteName(freqHz: number): { note: string; pitchClass: string; octave: number; centsOffset: number } {
    const midi = 69 + 12 * Math.log2(freqHz / this.ledger.baseA4Hz);
    const roundedMidi = Math.round(midi);
    const centsOffset = Math.round((midi - roundedMidi) * 100);

    const semitone = roundedMidi % 12;
    const octave = Math.floor(roundedMidi / 12) - 1;
    const pitchClass = CHROMATIC_SCALE[(semitone + 12) % 12];

    return {
      note: `${pitchClass}${octave}`,
      pitchClass,
      octave,
      centsOffset
    };
  }

  /**
   * Continuous Pitch Field Interpolation:
   * Maps any frequency or note to its bounding (A, E) anchor coordinates,
   * calculates logarithmic weight t in [0, 1], and evaluates the Pythagorean
   * generator formula: f = A4 * (3/2)^alpha * 2^beta.
   */
  public interpolatePitchField(target: number | string): PitchFieldInterpolationResult {
    const targetHz = typeof target === 'number' ? target : this.parseNoteToFrequency(target);
    const clampedHz = Math.max(25, Math.min(12000, targetHz));
    const nearest = this.frequencyToNoteName(clampedHz);

    const seq = this.ledger.interleavedSequence;
    let lowerAnchor: AnchorOctaveValue = seq[0];
    let upperAnchor: AnchorOctaveValue = seq[seq.length - 1];

    // Find bounding anchors in the interleaved sequence
    for (let i = 0; i < seq.length - 1; i++) {
      if (clampedHz >= seq[i].justIntonationHz && clampedHz <= seq[i + 1].justIntonationHz) {
        lowerAnchor = seq[i];
        upperAnchor = seq[i + 1];
        break;
      }
    }

    if (clampedHz < seq[0].justIntonationHz) {
      lowerAnchor = seq[0];
      upperAnchor = seq[1];
    } else if (clampedHz > seq[seq.length - 1].justIntonationHz) {
      lowerAnchor = seq[seq.length - 2];
      upperAnchor = seq[seq.length - 1];
    }

    // Logarithmic interpolation factor t:
    // log2(f / f_low) / log2(f_high / f_low)
    const logSpan = Math.log2(upperAnchor.justIntonationHz / lowerAnchor.justIntonationHz);
    const logDist = Math.log2(clampedHz / lowerAnchor.justIntonationHz);
    const interpolationWeight = logSpan > 0 ? Math.max(0, Math.min(1, logDist / logSpan)) : 0;

    const centsFromLower = 1200 * Math.log2(clampedHz / lowerAnchor.justIntonationHz);
    const centsFromUpper = 1200 * Math.log2(upperAnchor.justIntonationHz / clampedHz);

    // Pythagorean generator analysis
    const pitchClass = nearest.pitchClass;
    const pyth = PYTHAGOREAN_FIFTHS_TABLE[pitchClass] || { alpha: 0, beta: 0 };
    const octaveShift = nearest.octave - 4;
    const netBeta = pyth.beta + octaveShift;

    // Derived frequency via pure 3:2 powers
    const pythDerivedHz = this.ledger.baseA4Hz * Math.pow(JUST_FIFTH_RATIO, pyth.alpha) * Math.pow(2, netBeta);
    const pythDeviationCents = 1200 * Math.log2(clampedHz / pythDerivedHz);

    const derivationFormula = `f = ${this.ledger.baseA4Hz} × (3/2)^(${pyth.alpha}) × 2^(${netBeta})`;

    return {
      targetInput: target,
      targetFrequencyHz: Number(clampedHz.toFixed(3)),
      nearestNote: `${nearest.note}${nearest.centsOffset >= 0 ? '+' : ''}${nearest.centsOffset}¢`,
      lowerAnchor,
      upperAnchor,
      interpolationWeight: Number(interpolationWeight.toFixed(4)),
      octaveSpan: Number(logSpan.toFixed(4)),
      centsFromLower: Number(centsFromLower.toFixed(2)),
      centsFromUpper: Number(centsFromUpper.toFixed(2)),
      pythagoreanGenerator: {
        alphaFifths: pyth.alpha,
        betaOctaves: netBeta,
        derivedHz: Number(pythDerivedHz.toFixed(3)),
        deviationCents: Number(pythDeviationCents.toFixed(2))
      },
      derivationFormula
    };
  }

  /**
   * Derive an instrument tone for any target pitch and archetype
   * Combines pitch field coordinates with timbral transfer functions
   */
  public deriveInstrumentTone(target: number | string, archetypeId = 'steward-baritone'): DerivedInstrumentTone {
    const interpolation = this.interpolatePitchField(target);
    const f0 = interpolation.targetFrequencyHz;

    const archetype = INSTRUMENT_ARCHETYPES.find(a => a.id === archetypeId) || INSTRUMENT_ARCHETYPES[0];

    // Generate 8 harmonics based on derived fundamental f0
    const harmonicSeries = archetype.harmonicAmplitudes.map((amp, index) => {
      const harmonicNumber = index + 1;
      return {
        harmonic: harmonicNumber,
        frequencyHz: Number((f0 * harmonicNumber).toFixed(2)),
        relativeAmplitude: amp
      };
    });

    return {
      archetypeId: archetype.id,
      archetypeName: archetype.name,
      category: archetype.category,
      targetFrequencyHz: f0,
      targetNote: interpolation.nearestNote,
      interpolationCoordinates: interpolation,
      harmonicSeries,
      formants: archetype.formants,
      envelope: archetype.envelope,
      airGravelNoise: archetype.airGravelNoise,
      recipeBits: 60, // Exactly 60-bit recipe token representation
      acousticDescription: `${archetype.description} Derived at ${f0.toFixed(2)}Hz via (${interpolation.lowerAnchor.note} ↔ ${interpolation.upperAnchor.note}) interpolation.`
    };
  }

  /**
   * Audio: Play pure anchor tone
   */
  public async playAnchor(note: string, mode: 'just' | 'et' = 'just', durationSec = 1.6): Promise<void> {
    const seq = this.ledger.interleavedSequence;
    const anchor = seq.find(a => a.note.toUpperCase() === note.toUpperCase());
    if (!anchor) return;
    const freq = mode === 'just' ? anchor.justIntonationHz : anchor.equalTemperamentHz;
    await this.audioPipeline.playPureSine(freq, durationSec, 0.32);
  }

  /**
   * Audio: Play derived instrument tone
   */
  public async playDerived(derived: DerivedInstrumentTone, mode: 'timbre' | 'pure_invariant' = 'timbre', durationSec = 2.0): Promise<void> {
    if (mode === 'pure_invariant') {
      await this.audioPipeline.playPureSine(derived.targetFrequencyHz, durationSec, 0.3);
    } else {
      await this.audioPipeline.playDerivedTone(derived, durationSec, 0.3);
    }
  }

  /**
   * Audio: Play harmonic 3:2 anchor interval (e.g. A4 + E5)
   */
  public async playAnchorInterval(f1: number, f2: number, durationSec = 2.0): Promise<void> {
    await this.audioPipeline.playIntervalHarmony(f1, f2, durationSec, 0.25);
  }

  /**
   * Audio: Stop all synthesis
   */
  public stopAudio(): void {
    this.audioPipeline.stopAll();
  }

  /**
   * Export the entire ledger as clean JSON
   */
  public exportLedgerJson(): string {
    return JSON.stringify(this.ledger, null, 2);
  }
}

// Export singleton instance
export const anchorEngine = new AnchorEngineService();
