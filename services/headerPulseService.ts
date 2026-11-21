export type HeaderPulseMode = 'nominal' | 'reasoning' | 'high_reasoning' | 'critical';

export interface HeaderPulseState {
  mode: HeaderPulseMode;
  label: string;
  detail?: string;
  targetTab?: string;
  updatedAt: number;
}

type PulseSubscriber = (state: HeaderPulseState) => void;

const NOMINAL_STATE: HeaderPulseState = {
  mode: 'nominal',
  label: 'Steward Nominal',
  detail: 'Substrate standing by',
  updatedAt: Date.now()
};

class HeaderPulseController {
  private subscribers = new Set<PulseSubscriber>();
  private state: HeaderPulseState = { ...NOMINAL_STATE };
  private activeReasoningCount = 0;
  private activeReasoningMode: 'reasoning' | 'high_reasoning' = 'reasoning';
  private activeReasoningLabel = 'Processing Directive';
  private activeReasoningDetail = '';
  private criticalAlert: HeaderPulseState | null = null;
  private criticalTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('zereo:pulse_state', (e: Event) => {
        const detail = (e as CustomEvent)?.detail;
        if (!detail || !detail.mode) return;
        if (detail.mode === 'critical') {
          this.triggerCritical(
            detail.label || 'Critical Update',
            detail.detail,
            detail.targetTab,
            detail.durationMs
          );
        } else if (detail.mode === 'high_reasoning' || detail.mode === 'reasoning') {
          this.setState({
            mode: detail.mode,
            label: detail.label || (detail.mode === 'high_reasoning' ? 'High Reasoning' : 'Reasoning Active'),
            detail: detail.detail,
            targetTab: detail.targetTab,
            updatedAt: Date.now()
          });
        } else {
          this.clearCritical();
        }
      });
    }
  }

  public getState(): HeaderPulseState {
    return this.state;
  }

  public subscribe(cb: PulseSubscriber): () => void {
    this.subscribers.add(cb);
    cb(this.state);
    return () => {
      this.subscribers.delete(cb);
    };
  }

  private notify() {
    for (const cb of this.subscribers) {
      cb(this.state);
    }
  }

  private recomputeState() {
    if (this.criticalAlert) {
      this.state = { ...this.criticalAlert };
    } else if (this.activeReasoningCount > 0) {
      this.state = {
        mode: this.activeReasoningMode,
        label: this.activeReasoningLabel,
        detail: this.activeReasoningDetail,
        updatedAt: Date.now()
      };
    } else {
      this.state = {
        ...NOMINAL_STATE,
        updatedAt: Date.now()
      };
    }
    this.notify();
  }

  private setState(next: HeaderPulseState) {
    this.state = next;
    this.notify();
  }

  /**
   * Marks start of a reasoning / high-reasoning task and returns a release callback.
   */
  public beginReasoning(
    mode: 'reasoning' | 'high_reasoning' = 'high_reasoning',
    label?: string,
    detail?: string
  ): () => void {
    this.activeReasoningCount += 1;
    // Escalate to high_reasoning if any concurrent task requires it
    if (mode === 'high_reasoning' || this.activeReasoningCount === 1) {
      this.activeReasoningMode = mode;
      this.activeReasoningLabel =
        label || (mode === 'high_reasoning' ? 'High Reasoning' : 'Synthesizing Logic');
      this.activeReasoningDetail = detail || '';
    }
    this.recomputeState();

    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.activeReasoningCount = Math.max(0, this.activeReasoningCount - 1);
      if (this.activeReasoningCount === 0) {
        this.activeReasoningMode = 'reasoning';
        this.activeReasoningLabel = 'Processing Directive';
        this.activeReasoningDetail = '';
      }
      this.recomputeState();
    };
  }

  /**
   * Elevates the header pulse to Critical alert mode for urgent Principal updates.
   */
  public triggerCritical(
    label: string,
    detail?: string,
    targetTab?: string,
    durationMs: number = 14000
  ) {
    if (this.criticalTimer) {
      clearTimeout(this.criticalTimer);
      this.criticalTimer = null;
    }

    this.criticalAlert = {
      mode: 'critical',
      label: label || 'Critical Update',
      detail,
      targetTab,
      updatedAt: Date.now()
    };
    this.recomputeState();

    if (durationMs > 0) {
      this.criticalTimer = setTimeout(() => {
        this.clearCritical();
      }, durationMs);
    }
  }

  public clearCritical() {
    if (this.criticalTimer) {
      clearTimeout(this.criticalTimer);
      this.criticalTimer = null;
    }
    if (this.criticalAlert) {
      this.criticalAlert = null;
      this.recomputeState();
    }
  }
}

export const headerPulse = new HeaderPulseController();
