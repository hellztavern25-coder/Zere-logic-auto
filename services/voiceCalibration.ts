export const LOW_E2_HZ = 82.41;
export const LOW_E_MIN_PITCH_RATE = 0.84;
export const LOW_E_TARGET_PITCH_RATE = 0.87;
export const LOW_E_MAX_PITCH_RATE = 0.92;

export const LOW_E_MIN_SPEECH_PITCH = 0.76;
export const LOW_E_TARGET_SPEECH_PITCH = 0.81;
export const LOW_E_MAX_SPEECH_PITCH = 0.86;

export function clampLowEPitchRate(rate?: number): number {
  if (typeof rate !== 'number' || !Number.isFinite(rate)) return LOW_E_TARGET_PITCH_RATE;
  return Math.min(LOW_E_MAX_PITCH_RATE, Math.max(LOW_E_MIN_PITCH_RATE, Number(rate.toFixed(2))));
}

export function clampLowESpeechPitch(rawPitch?: number, customPitchRate?: number): number {
  if (typeof customPitchRate === 'number' && Number.isFinite(customPitchRate)) {
    const clampedRate = clampLowEPitchRate(customPitchRate);
    const mapped = LOW_E_TARGET_SPEECH_PITCH + (clampedRate - LOW_E_TARGET_PITCH_RATE) * 1.1;
    return Math.min(LOW_E_MAX_SPEECH_PITCH, Math.max(LOW_E_MIN_SPEECH_PITCH, Number(mapped.toFixed(2))));
  }
  if (typeof rawPitch !== 'number' || !Number.isFinite(rawPitch)) return LOW_E_TARGET_SPEECH_PITCH;
  return Math.min(LOW_E_MAX_SPEECH_PITCH, Math.max(LOW_E_MIN_SPEECH_PITCH, Number(rawPitch.toFixed(2))));
}
