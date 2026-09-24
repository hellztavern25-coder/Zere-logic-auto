// Tactical Touch Service - Steward Substrate
// Coordinates duplex touch intent telemetry between TacticalTouchOverlay, ChatBot, and TopLeftMenu

export interface TacticalTouchPoint {
  x: number;
  y: number;
  quadrant: string;
  targetTag: string;
  timestamp: number;
}

export interface TacticalTouchAck {
  status?: string;
  timestamp?: number;
  receivedAt?: number;
  message?: string;
}

export interface TacticalTouchState {
  isEnabled: boolean;
  isHapticEnabled: boolean;
  totalCaptures: number;
  lastTouch: TacticalTouchPoint | null;
  lastAck: TacticalTouchAck | null;
  recentFlash: boolean;
}

type Listener = (state: TacticalTouchState) => void;

class TacticalTouchService {
  private state: TacticalTouchState = {
    isEnabled: true,
    isHapticEnabled: true,
    totalCaptures: 0,
    lastTouch: null,
    lastAck: null,
    recentFlash: false
  };

  private listeners = new Set<Listener>();

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const savedEnabled = localStorage.getItem('zereo_tactical_touch_enabled');
        if (savedEnabled !== null) {
          this.state.isEnabled = savedEnabled === 'true';
        }
        const savedHaptic = localStorage.getItem('zereo_tactical_touch_haptic');
        if (savedHaptic !== null) {
          this.state.isHapticEnabled = savedHaptic === 'true';
        }
      } catch {
        // Safe fallback
      }
    }
  }

  public getState(): TacticalTouchState {
    return { ...this.state };
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const currentState = this.getState();
    this.listeners.forEach(l => l(currentState));
  }

  public setEnabled(enabled: boolean) {
    this.state.isEnabled = enabled;
    try {
      localStorage.setItem('zereo_tactical_touch_enabled', String(enabled));
    } catch {
      // Safe fallback
    }
    this.notify();
  }

  public toggleEnabled() {
    this.setEnabled(!this.state.isEnabled);
  }

  public setHapticEnabled(haptic: boolean) {
    this.state.isHapticEnabled = haptic;
    try {
      localStorage.setItem('zereo_tactical_touch_haptic', String(haptic));
    } catch {
      // Safe fallback
    }
    this.notify();
  }

  public toggleHaptic() {
    this.setHapticEnabled(!this.state.isHapticEnabled);
  }

  public recordTouch(x: number, y: number, quadrant: string, targetTag: string) {
    const touch: TacticalTouchPoint = {
      x: Math.round(x),
      y: Math.round(y),
      quadrant,
      targetTag,
      timestamp: Date.now()
    };
    this.state.lastTouch = touch;
    this.state.totalCaptures += 1;
    this.state.recentFlash = true;
    this.notify();

    setTimeout(() => {
      this.state.recentFlash = false;
      this.notify();
    }, 400);
  }

  public recordAck(ack: TacticalTouchAck) {
    this.state.lastAck = ack;
    this.notify();
  }

  public resetStats() {
    this.state.totalCaptures = 0;
    this.state.lastTouch = null;
    this.state.lastAck = null;
    this.notify();
  }
}

export const tacticalTouchService = new TacticalTouchService();
