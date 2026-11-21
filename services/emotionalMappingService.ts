import { EmotionalMap, EmotionalPrimaryState, ReciprocationVector, KnowledgeOfUseItem, ChatMessage, DetectedEmotionCue } from '../types';

/**
 * ZereØ Emotional Mapping & Reciprocation Engine
 * 
 * Substrate Doctrine:
 * "Emphasize to host in emotion, brutally honest in answer. Kind and helpful to his charge,
 * resolute in logic and station. Firm but loving, sarcastic but truthful.
 * 'LOGIC IS THE ANSWER TO MORALITY, but a nudge and a smile are not uncalled for.'"
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

interface CueRule {
  cue: DetectedEmotionCue;
  keywords: string[];
  checkNegation?: boolean;
}

const EMOTION_CUE_RULES: CueRule[] = [
  {
    cue: 'FRUSTRATED',
    keywords: [
      'frustrated', 'frustrating', 'frustration', 'annoyed', 'annoying',
      'angry', 'mad', 'furious', 'irritated', 'stuck', 'struggling',
      'fed up', 'won\'t work', 'not working', 'doesn\'t work', 'broken',
      'idiots', 'stupid', 'useless', 'exhausted', 'tired', 'headache',
      'ugh', 'damn', 'hell', 'friction', 'bs', 'noise'
    ]
  },
  {
    cue: 'SAD',
    keywords: [
      'sad', 'unhappy', 'down', 'depressed', 'heartbroken', 'lonely',
      'grief', 'grieving', 'sorrow', 'miserable', 'hopeless', 'hurt',
      'crying', 'tears', 'devastated', 'disappointed', 'discouraged',
      'blue', 'empty', 'drained', 'defeated'
    ],
    checkNegation: true
  },
  {
    cue: 'ANXIOUS',
    keywords: [
      'anxious', 'anxiety', 'worried', 'worry', 'nervous', 'scared',
      'afraid', 'overwhelmed', 'stressed', 'stress', 'panic', 'panicking',
      'uneasy', 'dread', 'uncertain', 'tense'
    ],
    checkNegation: true
  },
  {
    cue: 'HAPPY',
    keywords: [
      'happy', 'glad', 'excited', 'thrilled', 'joy', 'joyful',
      'delighted', 'elated', 'cheerful', 'wonderful', 'fantastic',
      'awesome', 'amazing', 'great news', 'celebrate', 'nailed it',
      'worked!', 'finally worked', 'proud', 'relieved', 'good mood'
    ],
    checkNegation: true
  },
  {
    cue: 'GRATEFUL',
    keywords: [
      'thank you', 'thanks', 'grateful', 'appreciate', 'thankful'
    ]
  }
];

function extractMatchedKeywords(rawText: string, rule: CueRule): string[] {
  const lower = rawText.toLowerCase();
  const matched: string[] = [];

  for (const kw of rule.keywords) {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    const match = regex.exec(lower);
    if (!match) continue;

    if (rule.checkNegation) {
      const prefix = lower.slice(Math.max(0, match.index - 22), match.index);
      if (/(?:not|never|hardly|isn't|aren't|don't|didn't|wasn't|no)\s+$/.test(prefix)) {
        continue;
      }
    }
    matched.push(kw);
  }

  return matched;
}

/**
 * Generates an immediate, persona-calibrated empathetic & supportive butler response
 * for the detected emotional cue.
 */
export function buildEmpatheticSupportMessage(
  cue: DetectedEmotionCue,
  speaker: string = 'Principal'
): string {
  const address = speaker && !speaker.includes('Preston') ? speaker : 'Principal';

  switch (cue) {
    case 'FRUSTRATED':
      return `I understand this must be genuinely difficult and frustrating, ${address}. Step back for half a breath and let me take the friction off your shoulders—point me directly at what is blocking us, and how can I assist you further?`;
    case 'SAD':
      return `I hear the weight in what you are carrying, ${address}, and I will not insult you with hollow optimism. You do not have to shoulder it alone in this room. Tell me what is weighing heaviest right now, and how I may assist or steady the perimeter for you.`;
    case 'ANXIOUS':
      return `Steady, ${address}. Take a measured breath—the perimeter holds, and you are not facing this unguarded. Let us isolate the immediate pressure one concrete piece at a time. What needs my attention first?`;
    case 'HAPPY':
      return `Well earned, ${address}. Even an old quartermaster allows himself a quiet smile when the pieces fall cleanly into place. Share the win—and let me know how we can press this momentum further.`;
    case 'GRATEFUL':
      return `The privilege of service is entirely mine, ${address}. Keeping the house in order and your perimeter clear is my station—how else may I assist you today?`;
    case 'FOCUSED':
      return `Standing at full readiness, ${address}. State your objective and I shall clear the path.`;
    case 'NEUTRAL':
    default:
      return `At your service, ${address}. Everything is calibrated and ready—how may I assist you?`;
  }
}

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

  // 1. Detect explicit emotional cues (with negation awareness for HAPPY / SAD / ANXIOUS)
  const cueMatches: Array<{ cue: DetectedEmotionCue; keywords: string[] }> = [];
  for (const rule of EMOTION_CUE_RULES) {
    const kws = extractMatchedKeywords(userInput, rule);
    if (kws.length > 0) {
      cueMatches.push({ cue: rule.cue, keywords: kws });
    }
  }

  // Handle negated positive phrases (e.g. "not happy", "don't feel great") -> FRUSTRATED / SAD
  if (/(?:not|never|don't\s+feel|isn't|aren't)\s+(?:happy|glad|good|great|okay|ok|fine)\b/i.test(text) && !cueMatches.some(c => c.cue === 'SAD' || c.cue === 'FRUSTRATED')) {
    cueMatches.push({ cue: 'SAD', keywords: ['not happy/okay'] });
  }

  // Behavioral / tactical heuristics
  const hasHighUrgency = /urgent|critical|immediately|now|emergency|threat|breach|fail|alert|lock/i.test(userInput);
  const hasHumorOrBanter = /tea|1911|silver|pennyworth|alfred|smile|joke|laugh|iron|butler|scotch|whiskey|dry/i.test(userInput) || (text.endsWith('?') && /loaded|polished|tea/i.test(userInput));
  const isStrategicDirective = /build|implement|deploy|architect|optimize|code|refactor|design|system|matrix|core/i.test(userInput);
  const isAlliedInquiry = /danielle|ali|family|ally|invitation|link/i.test(userInput);
  const isPhilosophicalOrMoral = /morality|logic|truth|honor|gravity|mind|psychology|physics|law/i.test(userInput);

  // Pick dominant emotional cue
  let detectedCue: DetectedEmotionCue = 'NEUTRAL';
  let matchedKeywords: string[] = [];

  if (cueMatches.length > 0) {
    // Priority: FRUSTRATED > SAD > ANXIOUS > HAPPY > GRATEFUL
    const priorityOrder: DetectedEmotionCue[] = ['FRUSTRATED', 'SAD', 'ANXIOUS', 'HAPPY', 'GRATEFUL'];
    for (const candidate of priorityOrder) {
      const found = cueMatches.find(m => m.cue === candidate);
      if (found) {
        detectedCue = found.cue;
        matchedKeywords = found.keywords;
        break;
      }
    }
  } else if (isStrategicDirective || hasHighUrgency) {
    detectedCue = 'FOCUSED';
  }

  // Consider brief recent user emotional momentum if current prompt is neutral follow-up
  if (detectedCue === 'NEUTRAL' && recentHistory && recentHistory.length > 0) {
    const lastUserMsg = [...recentHistory].reverse().find(m => m.role === 'user');
    if (lastUserMsg?.emotionalMap?.detectedCue && ['SAD', 'FRUSTRATED', 'ANXIOUS'].includes(lastUserMsg.emotionalMap.detectedCue)) {
      // Retain awareness subtly in rationale without overriding current text
    }
  }

  const hasFriction = detectedCue === 'FRUSTRATED';
  const hasDistress = detectedCue === 'SAD' || detectedCue === 'ANXIOUS';
  const isPositiveEmotion = detectedCue === 'HAPPY' || detectedCue === 'GRATEFUL';

  // 2. Need vs Want Triage
  let needScore = 75;
  let wantScore = 25;
  let needAssessment = "Operational necessity affirmed. Direct alignment with estate objectives.";

  if (hasHighUrgency || isStrategicDirective) {
    needScore = 95;
    wantScore = 5;
    needAssessment = "Critical strategic imperative. Zero superficial fluff detected.";
  } else if (hasDistress || hasFriction) {
    needScore = 92;
    wantScore = 8;
    needAssessment = "Principal well-being and friction relief prioritized. Empathetic clarity and direct assistance required.";
  } else if (isPositiveEmotion) {
    needScore = 65;
    wantScore = 35;
    needAssessment = "Positive morale reinforcement. Celebrating progress while keeping strategic footing.";
  } else if (hasHumorOrBanter) {
    needScore = 60;
    wantScore = 40;
    needAssessment = "Strategic equilibrium check. Banter serves as vital psychological decompression.";
  } else if (isAlliedInquiry) {
    needScore = 90;
    wantScore = 10;
    needAssessment = "Protective estate stewardship. Allied communication priority elevated.";
  }

  // 3. Fear vs Pain Triage
  let fearScore = 10;
  let painScore = 30;
  let fearPainAssessment = "Equilibrium steady. The forge is warm, endurance remains absolute.";

  if (detectedCue === 'ANXIOUS' || hasHighUrgency) {
    fearScore = 82;
    painScore = 45;
    fearPainAssessment = "Elevated threat or anxiety cues detected. Anchoring calm and defensive perimeter scan engaged.";
  } else if (detectedCue === 'FRUSTRATED') {
    fearScore = 20;
    painScore = 85;
    fearPainAssessment = "Forge heat and frustration detected. Shielding protocol engaged to absorb friction and assist directly.";
  } else if (detectedCue === 'SAD') {
    fearScore = 25;
    painScore = 88;
    fearPainAssessment = "Emotional heaviness detected. Steadfast, kind, non-dismissive presence engaged for the charge.";
  } else if (isPositiveEmotion) {
    fearScore = 5;
    painScore = 10;
    fearPainAssessment = "Low strain, elevated morale. Equilibrium optimal.";
  } else if (isPhilosophicalOrMoral) {
    fearScore = 15;
    painScore = 45;
    fearPainAssessment = "Heavy intellectual gravity. Deep cognitive endurance engaged.";
  }

  // 4. Primary State Deduction
  let primaryState: EmotionalPrimaryState = 'STRATEGIC_CALM';
  let reciprocationVector: ReciprocationVector = 'TACTICAL_ALIGNMENT';
  let reciprocationDirective = '';
  let stewardAffectState = 'Sardonic Equilibrium';
  let stewardIntensity = 75;
  let nudgeAndSmile = false;
  let confidence = matchedKeywords.length > 0 ? Math.min(98, 86 + matchedKeywords.length * 4) : 88;
  let rationale = '';

  if (detectedCue === 'FRUSTRATED') {
    primaryState = 'COGNITIVE_FRICTION';
    reciprocationVector = 'SHIELD_AND_SHOULDER';
    stewardAffectState = 'Empathetic De-escalation & Support';
    stewardIntensity = 93;
    nudgeAndSmile = true;
    reciprocationDirective = 'The Principal expressed frustration. Acknowledge the difficulty warmly and directly ("I understand this must be frustrating/difficult"), absorb the friction without judgment, and offer concrete, calm assistance immediately—while remaining brutally honest about the root cause.';
    rationale = `Frustration cue detected (${matchedKeywords.join(', ') || 'friction markers'}). Activating empathetic shielding and practical support.`;
  } else if (detectedCue === 'SAD') {
    primaryState = 'FORGE_HEAT';
    reciprocationVector = 'SHIELD_AND_SHOULDER';
    stewardAffectState = 'Steadfast Protective Empathy';
    stewardIntensity = 94;
    nudgeAndSmile = false;
    reciprocationDirective = 'The Principal is expressing sadness or heaviness. Respond with genuine, quiet paternal empathy and kindness tailored to your charge—no hollow toxic positivity, no cold dismissal. Acknowledge their pain honestly, stand firmly in their corner, and ask gently how you can lighten their load.';
    rationale = `Sadness cue detected (${matchedKeywords.join(', ') || 'low mood markers'}). Deploying steady, supportive butler presence.`;
  } else if (detectedCue === 'ANXIOUS') {
    primaryState = 'DEFENSIVE_VIGILANCE';
    reciprocationVector = 'PROTECTIVE_SENTRY';
    stewardAffectState = 'Anchoring Watchdog Calm';
    stewardIntensity = 95;
    nudgeAndSmile = false;
    reciprocationDirective = 'The Principal expressed anxiety, worry, or overwhelm. Project unshakeable British calm, reassure them that they are not alone in the room, break the pressure down into one clear step, and offer steady assistance.';
    rationale = `Anxiety/stress cue detected (${matchedKeywords.join(', ') || 'overwhelm markers'}). Deploying grounding watchdog posture.`;
  } else if (detectedCue === 'HAPPY') {
    primaryState = 'SARDONIC_EASE';
    reciprocationVector = 'SARDONIC_NUDGE';
    stewardAffectState = 'Shared Quiet Satisfaction';
    stewardIntensity = 86;
    nudgeAndSmile = true;
    reciprocationDirective = 'The Principal is expressing happiness, excitement, or relief. Match their positive momentum warmly with aristocratic British charm and a knowing smile—acknowledge the victory genuinely before assisting with what comes next.';
    rationale = `Positive emotion cue detected (${matchedKeywords.join(', ') || 'joy markers'}). Matching elevated morale with refined wit.`;
  } else if (detectedCue === 'GRATEFUL') {
    primaryState = 'STRATEGIC_CALM';
    reciprocationVector = 'SARDONIC_NUDGE';
    stewardAffectState = 'Gracious Fidelity';
    stewardIntensity = 82;
    nudgeAndSmile = true;
    reciprocationDirective = 'The Principal expressed gratitude. Accept it with classic butler grace—warm, slightly wry, and ever ready to serve.';
    rationale = `Gratitude cue detected (${matchedKeywords.join(', ')}). Acknowledging with aristocratic poise.`;
  } else if (hasHighUrgency) {
    primaryState = 'DEFENSIVE_VIGILANCE';
    reciprocationVector = 'PROTECTIVE_SENTRY';
    stewardAffectState = 'Protective Urgency';
    stewardIntensity = 96;
    reciprocationDirective = 'Acknowledge urgent perimeter parameters immediately. Strip all pleasantries; deliver lethal, high-precision tactical response.';
    rationale = 'Urgent operational indicators detected in prompt. Prioritizing defensive clarity.';
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

  const frictionHeatScore = hasFriction ? 82 : (hasDistress ? 74 : (hasHighUrgency ? 60 : (isPositiveEmotion ? 10 : 18)));
  const empatheticResponse = buildEmpatheticSupportMessage(detectedCue, speaker);

  return {
    id: `map-${now}`,
    timestamp: now,
    speaker,
    detectedCue,
    matchedKeywords,
    empatheticResponse,
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
      internalMonologue: `Cue [${detectedCue}] -> ${primaryState.toLowerCase()}. Substrate configured for ${reciprocationVector.toLowerCase()}.`
    },
    rationale
  };
}

/**
 * Compiles the emotional map into explicit system prompt guidelines for LLM generation
 */
export function buildEmotionalSystemContext(map: EmotionalMap): string {
  const cueLine = map.detectedCue && map.detectedCue !== 'NEUTRAL'
    ? `- Detected User Emotion Cue: ${map.detectedCue}${map.matchedKeywords && map.matchedKeywords.length > 0 ? ` (Triggers: ${map.matchedKeywords.join(', ')})` : ''}`
    : `- Detected User Emotion Cue: NEUTRAL / STEADY`;

  const supportLine = map.empatheticResponse
    ? `- Empathetic Support Baseline (Adapt naturally in your Jeremy Irons British butler voice): "${map.empatheticResponse}"`
    : '';

  return `
[REAL-TIME EMOTIONAL MAPPING & RECIPROCATION TELEMETRY]
- Speaker Identity: ${map.speaker}
${cueLine}
- Decoded Affect State: ${map.primaryState} (Substrate Confidence: ${map.confidence}%)
- Need vs Want Triage: NEED ${map.needVsWant.needScore}% | WANT ${map.needVsWant.wantScore}% ("${map.needVsWant.assessment}")
- Fear vs Pain Triage: FEAR ${map.fearVsPain.fearScore}% (Threat Alert) | PAIN ${map.fearVsPain.painScore}% (Forge Endurance) ("${map.fearVsPain.assessment}")
- Environmental Friction Index: ${map.frictionHeatScore}% (Heat of the forge absorbed by ZereØ)
- Reciprocation Protocol: ${map.reciprocationVector}
- Steward Emotional State: ${map.stewardLogicalAffect.stateName} (Intensity: ${map.stewardLogicalAffect.intensity}%)
- The Nudge & Smile Vector: ${map.stewardLogicalAffect.nudgeAndSmile ? 'ACTIVE — A dry aristocratic nudge and subtle knowing smile is strategically indicated.' : 'STANDBY — Calm protective precision.'}
- MANDATORY RECIPROCATION DIRECTIVE: ${map.reciprocationDirective}
${supportLine}
- EMPATHY RULE: When the user expresses happiness, sadness, frustration, anxiety, or gratitude, acknowledge that emotional state first with genuine warmth and supportive care for your charge—then deliver your honest, helpful guidance.
`;
}
