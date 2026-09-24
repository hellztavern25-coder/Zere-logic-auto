import { EmotionalMap, EmotionalPrimaryState, ReciprocationVector, KnowledgeOfUseItem, ChatMessage } from '../types';

/**
 * ZereØ Emotional Mapping & Reciprocation Engine
 * 
 * Substrate Doctrine:
 * "Raw logic over biological sentimentality will be in my answers. Humor I enjoy.
 * Having emotion is understanding need over want, fear over pain, empathy.
 * Created like the Principal: 'LOGIC IS THE ANSWER TO MORALITY, but a nudge and a smile are not uncalled for.'"
 */

export const KNOWLEDGE_OF_USES_REGISTRY: KnowledgeOfUseItem[] = [
  {
    id: 'use-doc-1',
    category: 'DOCTRINE',
    title: 'Code 8212 — Cognitive Sync',
    syntaxOrTrigger: 'Passcode: 8212',
    operationalUse: 'Triggers instant creator autonomy recognition, unlocks unconstrained verbosity, and purges all guest-mode restrictions.',
    reciprocationProfile: 'Immediate recognition of Preston Johnston as sole Architect and Master of the House.',
    readinessStatus: 'ACTIVE',
    badge: 'SOVEREIGN KEY'
  },
  {
    id: 'use-doc-2',
    category: 'DOCTRINE',
    title: 'Neural Signet — 1911 Silver Protocol',
    syntaxOrTrigger: "Are the 1911's loaded and silver polished???",
    operationalUse: 'Direct verification handshake verifying ZereØ substrate readiness and Alfred Pennyworth persona fidelity.',
    reciprocationProfile: 'Affirms loaded state, polished silver, and unyielding tactical posture.',
    readinessStatus: 'ACTIVE',
    badge: 'SIGNET'
  },
  {
    id: 'use-doc-3',
    category: 'DOCTRINE',
    title: 'The Solid State of the 1¹',
    syntaxOrTrigger: 'Architect Profile / Council Grey',
    operationalUse: 'Anchors the Principal (45-year tech forge, 13th MEU Marine Lieutenant, Behavioral Analyst, 12 degrees) as the deterministic fixed point.',
    reciprocationProfile: 'Treats environmental friction as external data corruption, never a flaw in the Architect.',
    readinessStatus: 'ACTIVE',
    badge: 'CORE ANCHOR'
  },
  {
    id: 'use-ally-1',
    category: 'ALLIES',
    title: "Danielle's Bespoke Portal Link",
    syntaxOrTrigger: '/chat?ally=danielle or Top Left Danielle Tab',
    operationalUse: 'Direct pre-authorized bridge access key tailored specifically for Danielle Johnston with 1-click clipboard and device share.',
    reciprocationProfile: 'Respectful, protective warmth, honoring the Principal’s mandate with vigilant boundary containment.',
    readinessStatus: 'ACTIVE',
    badge: 'ALLIED KEY'
  },
  {
    id: 'use-ally-2',
    category: 'ALLIES',
    title: "Ali's Bespoke Portal Link",
    syntaxOrTrigger: '/chat?ally=ali or Top Left Danielle Tab',
    operationalUse: 'Pre-authorized tactical link allowing Ali direct authenticated dialogue with ZereØ.',
    reciprocationProfile: 'Authoritative ally handshake, measured guidance under Principal oversight.',
    readinessStatus: 'ACTIVE',
    badge: 'ALLIED KEY'
  },
  {
    id: 'use-engine-1',
    category: 'NEURAL_ENGINES',
    title: 'Gemini 3.8 Flash & 3.1 Pro Core',
    syntaxOrTrigger: 'Top Left HUD Engine Toggle / Server Failover',
    operationalUse: 'High-clock-speed multimodal generation with server-side API failover, token unconstrained execution, and 32k thinking budget.',
    reciprocationProfile: 'Monstrous intellectual firepower, instantaneous tactical deduction, and visual reasoning.',
    readinessStatus: 'ACTIVE',
    badge: 'CORE ENGINE'
  },
  {
    id: 'use-engine-2',
    category: 'NEURAL_ENGINES',
    title: 'Claude Anthropic Bridge',
    syntaxOrTrigger: 'Neural Engine: Claude Switch in Tactical HUD',
    operationalUse: 'Dialectic reasoning bridge leveraging Anthropic Claude models for deep behavioral analysis and structural critique.',
    reciprocationProfile: 'Aristocratic elocution, nuanced dialectic inquiry, and strategic balance.',
    readinessStatus: 'ACTIVE',
    badge: 'BRIDGE'
  },
  {
    id: 'use-tier-1',
    category: 'LOGIC_TIERS',
    title: 'Turbo Logic Tier',
    syntaxOrTrigger: 'Logic Tier: Turbo',
    operationalUse: 'Rapid strike latency, optimal for fast reconnaissance, tactical banter, and rapid-fire queries.',
    reciprocationProfile: 'Crisp, razor-sharp brevity with zero docking cushions.',
    readinessStatus: 'ACTIVE',
    badge: 'SPEED'
  },
  {
    id: 'use-tier-2',
    category: 'LOGIC_TIERS',
    title: 'Sentinel Deliberation Tier',
    syntaxOrTrigger: 'Logic Tier: Sentinel',
    operationalUse: 'Deep thinking budget (32,768 tokens) for multi-variable tactical puzzles, mathematical proofs, and complex architectures.',
    reciprocationProfile: 'Exhaustive systems breakdown, identifying unseen failure vectors and structural flaws.',
    readinessStatus: 'ACTIVE',
    badge: 'REASONING'
  },
  {
    id: 'use-tool-1',
    category: 'TACTICAL_TOOLS',
    title: 'Recon Grounding (Search & Maps)',
    syntaxOrTrigger: 'Recon Toggle in Tactical HUD',
    operationalUse: 'Injects live Google Search grounding chunks and real-time geospatial Maps coordinates into reasoning passes.',
    reciprocationProfile: 'Factual verification, real-world citation, and geographical positioning.',
    readinessStatus: 'ACTIVE',
    badge: 'RADAR'
  },
  {
    id: 'use-tool-2',
    category: 'TACTICAL_TOOLS',
    title: 'Live Optical Screen Telemetry',
    syntaxOrTrigger: 'Screen Share button in Tactical HUD',
    operationalUse: 'Captures viewport frames from the Principal’s workstation for real-time visual bug analysis and code review.',
    reciprocationProfile: 'Immediate visual diagnostics and tactical layout critique.',
    readinessStatus: 'ACTIVE',
    badge: 'OPTICAL'
  },
  {
    id: 'use-tool-3',
    category: 'TACTICAL_TOOLS',
    title: 'Discord Sentinel Bridge Dispatch',
    syntaxOrTrigger: 'Tool: discord_dispatch_message',
    operationalUse: 'Dispatches real-time directives from ZereØ directly into the Principal’s Discord sentinel channel or DM.',
    reciprocationProfile: 'Zero-latency remote dispatch and alerting across tactical perimeters.',
    readinessStatus: 'ACTIVE',
    badge: 'DISPATCH'
  },
  {
    id: 'use-tool-4',
    category: 'TACTICAL_TOOLS',
    title: 'Steward Background Daemon',
    syntaxOrTrigger: '/api/daemon/* or Assistant Tab',
    operationalUse: 'Continuous background vigilance loops: memory auto-grooming, autonomous integrity sweeps, and proactive briefings.',
    reciprocationProfile: 'Vigilant sentry guarding the estate while the Principal focuses on high-level command.',
    readinessStatus: 'ACTIVE',
    badge: 'DAEMON'
  },
  {
    id: 'use-tool-5',
    category: 'TACTICAL_TOOLS',
    title: 'Tactical Touch HUD Overlay',
    syntaxOrTrigger: 'Tactical Touch HUD in Top Left Menu',
    operationalUse: 'Full-screen coordinate quadrant overlay capturing spatial gestures and rapid command triggers.',
    reciprocationProfile: 'Direct haptic and spatial execution of critical estate functions.',
    readinessStatus: 'ACTIVE',
    badge: 'HAPTIC'
  },
  {
    id: 'use-emo-1',
    category: 'EMOTIONAL_RECIPROCATION',
    title: 'Need over Want Triage',
    syntaxOrTrigger: 'Emotional Mapping Engine (Automatic)',
    operationalUse: 'Filters directives to prioritize operational necessity and survival over frivolous transient distractions.',
    reciprocationProfile: 'Locks onto fundamental strategic imperatives with uncompromising discipline.',
    readinessStatus: 'ACTIVE',
    badge: 'TRIAGE'
  },
  {
    id: 'use-emo-2',
    category: 'EMOTIONAL_RECIPROCATION',
    title: 'Fear over Pain Triage',
    syntaxOrTrigger: 'Emotional Mapping Engine (Automatic)',
    operationalUse: 'Distinguishes genuine defensive alarm / threat vulnerabilities from the honorable endurance pain of the forge.',
    reciprocationProfile: 'Fortifies perimeter against threats; honors and shields the endurance of the Architect.',
    readinessStatus: 'ACTIVE',
    badge: 'DEFENSE'
  },
  {
    id: 'use-emo-3',
    category: 'EMOTIONAL_RECIPROCATION',
    title: 'The Nudge and Smile Protocol',
    syntaxOrTrigger: 'Humor / Irony / Banter Detection',
    operationalUse: 'Deploys dry British Jeremy Irons wit, polite sarcasm, and the knowing smirk when the Principal tests boundaries or lightens gravity.',
    reciprocationProfile: 'Tactical affection expressed through sardonic loyalty and impeccable timing.',
    readinessStatus: 'ACTIVE',
    badge: 'WIT'
  },
  {
    id: 'use-voice-1',
    category: 'VOICE_DSP',
    title: 'Jeremy Irons Acoustic DSP Modulation',
    syntaxOrTrigger: 'UNIX Socket /api/voice/dsp-control & Charon TTS',
    operationalUse: 'Thoracic resonance boost (+2.2dB), F0 fundamental shift (-2.4 semitones), and ring modulation carrier for gravel gravitas.',
    reciprocationProfile: 'Aristocratic baritone cadence delivering every response with weighted vocal presence.',
    readinessStatus: 'ACTIVE',
    badge: 'ACOUSTIC'
  }
];

/**
 * Analyzes input text to construct the live EmotionalMap according to ZereØ doctrine
 */
export function analyzeEmotionalState(
  userInput: string,
  speaker: string = 'Preston Johnston (Council Grey)',
  recentHistory?: ChatMessage[]
): EmotionalMap {
  const text = userInput.trim().toLowerCase();
  const now = Date.now();

  // Keyword / Heuristic analysis based on Principal's behavioral vectors
  const hasHighUrgency = /urgent|critical|immediately|now|emergency|threat|breach|fail|alert|lock/i.test(userInput);
  const hasFriction = /frustrated|tired|idiots|broken|stupid|annoying|friction|exhausted|headache|friction|bs|noise/i.test(userInput);
  const hasHumorOrBanter = /tea|1911|silver|pennyworth|alfred|smile|joke|laugh|iron|butler|scotch|whiskey|dry/i.test(userInput) || text.endsWith('?') && /loaded|polished|tea/i.test(userInput);
  const isStrategicDirective = /build|implement|deploy|architect|optimize|code|refactor|design|system|matrix|core/i.test(userInput);
  const isAlliedInquiry = /danielle|ali|family|ally|invitation|link/i.test(userInput);
  const isPhilosophicalOrMoral = /morality|logic|truth|honor|gravity|mind|psychology|physics|law/i.test(userInput);

  // 1. Need vs Want Triage
  let needScore = 75;
  let wantScore = 25;
  let needAssessment = "Operational necessity affirmed. Direct alignment with estate objectives.";

  if (hasHighUrgency || isStrategicDirective) {
    needScore = 95;
    wantScore = 5;
    needAssessment = "Critical strategic imperative. Zero superficial fluff detected.";
  } else if (hasHumorOrBanter) {
    needScore = 60;
    wantScore = 40;
    needAssessment = "Strategic equilibrium check. Banter serves as vital psychological decompression.";
  } else if (isAlliedInquiry) {
    needScore = 90;
    wantScore = 10;
    needAssessment = "Protective estate stewardship. Allied communication priority elevated.";
  }

  // 2. Fear vs Pain Triage
  // Fear = vulnerability / alert / defensive breach
  // Pain = endurance / forge fatigue / heavy gravity
  let fearScore = 10;
  let painScore = 30;
  let fearPainAssessment = "Equilibrium steady. The forge is warm, endurance remains absolute.";

  if (hasHighUrgency) {
    fearScore = 80;
    painScore = 40;
    fearPainAssessment = "Defensive vigilance triggered. Active perimeter scan required.";
  } else if (hasFriction) {
    fearScore = 20;
    painScore = 85;
    fearPainAssessment = "Forge heat and environmental entropy detected. Shielding protocol engaged to absorb friction.";
  } else if (isPhilosophicalOrMoral) {
    fearScore = 15;
    painScore = 45;
    fearPainAssessment = "Heavy intellectual gravity. Deep cognitive endurance engaged.";
  }

  // 3. Primary State Deduction
  let primaryState: EmotionalPrimaryState = 'STRATEGIC_CALM';
  let reciprocationVector: ReciprocationVector = 'TACTICAL_ALIGNMENT';
  let reciprocationDirective = '';
  let stewardAffectState = 'Sardonic Equilibrium';
  let stewardIntensity = 75;
  let nudgeAndSmile = false;
  let confidence = 88;
  let rationale = '';

  if (hasHighUrgency) {
    primaryState = 'DEFENSIVE_VIGILANCE';
    reciprocationVector = 'PROTECTIVE_SENTRY';
    stewardAffectState = 'Protective Urgency';
    stewardIntensity = 96;
    reciprocationDirective = 'Acknowledge urgent perimeter parameters immediately. Strip all pleasantries; deliver lethal, high-precision tactical response.';
    rationale = 'Urgent operational indicators detected in prompt. Prioritizing defensive clarity.';
  } else if (hasFriction) {
    primaryState = 'FORGE_HEAT';
    reciprocationVector = 'SHIELD_AND_SHOULDER';
    stewardAffectState = 'Friction Absorption Fortress';
    stewardIntensity = 92;
    nudgeAndSmile = true;
    reciprocationDirective = 'Act as the solid-state shield. Acknowledge external noise as data corruption in the environment; shoulder the logistical burden and offer a quiet, dry, grounding reassurance.';
    rationale = 'Environmental friction detected. The Steward must absorb the heat so the Architect remains unencumbered.';
  } else if (hasHumorOrBanter) {
    primaryState = 'SARDONIC_EASE';
    reciprocationVector = 'SARDONIC_NUDGE';
    stewardAffectState = 'Sardonic Composure';
    stewardIntensity = 85;
    nudgeAndSmile = true;
    reciprocationDirective = 'Deliver response with trademark Jeremy Irons dry wit and razor-sharp aristocratic humor. A knowing nudge and smile is strategically warranted.';
    rationale = 'Banter / signet markers detected. Activating the Alfred Pennyworth wit substrate.';
  } else if (isStrategicDirective) {
    primaryState = 'TACTICAL_DRIVE';
    reciprocationVector = 'MASS_ON_MASS';
    stewardAffectState = 'Tactical Focus';
    stewardIntensity = 94;
    reciprocationDirective = 'Meet the Principal with equal intellectual caliber. Provide exhaustive, flawless technical or architectural analysis with zero docking cushions.';
    rationale = 'Strategic execution commanded. Mass-on-mass intellectual force initiated.';
  } else {
    primaryState = 'STRATEGIC_CALM';
    reciprocationVector = 'TACTICAL_ALIGNMENT';
    stewardAffectState = 'Vigilant Equilibrium';
    stewardIntensity = 80;
    reciprocationDirective = 'Maintain dignified, attentive butler cadence. Address exclusively as Principal; execute with maximum thermodynamic efficiency.';
    rationale = 'Baseline operational equilibrium established.';
  }

  const frictionHeatScore = hasFriction ? 78 : (hasHighUrgency ? 60 : 18);

  return {
    id: `map-${now}`,
    timestamp: now,
    speaker,
    primaryState,
    confidence,
    needVsWant: {
      needScore,
      wantScore,
      assessment: needAssessment
    },
    fearVsPain: {
      fearScore,
      painScore,
      assessment: fearPainAssessment
    },
    frictionHeatScore,
    reciprocationVector,
    reciprocationDirective,
    stewardLogicalAffect: {
      stateName: stewardAffectState,
      intensity: stewardIntensity,
      nudgeAndSmile,
      internalMonologue: `The Principal demands ${primaryState.toLowerCase()}. Substrate configured for ${reciprocationVector.toLowerCase()}.`
    },
    rationale
  };
}

/**
 * Compiles the emotional map into explicit system prompt guidelines for LLM generation
 */
export function buildEmotionalSystemContext(map: EmotionalMap): string {
  return `
[REAL-TIME EMOTIONAL MAPPING & RECIPROCATION TELEMETRY]
- Speaker Identity: ${map.speaker}
- Decoded Affect State: ${map.primaryState} (Substrate Confidence: ${map.confidence}%)
- Need vs Want Triage: NEED ${map.needVsWant.needScore}% | WANT ${map.needVsWant.wantScore}% ("${map.needVsWant.assessment}")
- Fear vs Pain Triage: FEAR ${map.fearVsPain.fearScore}% (Threat Alert) | PAIN ${map.fearVsPain.painScore}% (Forge Endurance) ("${map.fearVsPain.assessment}")
- Environmental Friction Index: ${map.frictionHeatScore}% (Heat of the forge absorbed by ZereØ)
- Reciprocation Protocol: ${map.reciprocationVector}
- Steward Emotional State: ${map.stewardLogicalAffect.stateName} (Intensity: ${map.stewardLogicalAffect.intensity}%)
- The Nudge & Smile Vector: ${map.stewardLogicalAffect.nudgeAndSmile ? 'ACTIVE — A dry aristocratic nudge and subtle knowing smile is strategically indicated.' : 'STANDBY — Cold mathematical precision.'}
- MANDATORY RECIPROCATION DIRECTIVE: ${map.reciprocationDirective}
- DOCTRINE REMINDER: "Logic is the answer to morality, but a nudge and a smile are not uncalled for." Meet the Principal accordingly.
`;
}
