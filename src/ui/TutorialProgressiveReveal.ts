import { audio } from './audio';

export type TutorialBeat = 'stoke' | 'render' | 'deliver' | 'complete';

export interface TutorialBeatDef {
  id: TutorialBeat;
  title: string;
  hint: string;
  targetSelector: string;
  sensorCheck: (ctx: TutorialEvalContext) => boolean;
}

export interface TutorialEvalContext {
  state: any;
  snapshot: any | null;
  inventory?: any;
  colony?: any;
}

export interface ProgressiveRevealOptions {
  onBeatComplete?: (beat: TutorialBeat) => void;
  onAllComplete?: () => void;
  onSkip?: () => void;
}

const BEAT_DEFS: TutorialBeatDef[] = [
  {
    id: 'stoke',
    title: 'Stoke',
    hint: 'Gather two softwood logs. Harvest pine or oak deadfall.',
    targetSelector: '[data-node-id="TREE_SCOTS_PINE"] .btn-harvest, [data-node-id="TREE_WHITE_OAK"] .btn-harvest, .category-block[data-category="TREES"]',
    sensorCheck: (ctx) => (ctx.state?.inventory?.items ?? []).some((it: any) => it.id?.includes('DEADFALL') || it.id?.includes('LOG_') || it.id?.includes('WOOD')),
  },
  {
    id: 'render',
    title: 'Render',
    hint: 'Run your first Soap Kettle. Complete any batch.',
    targetSelector: '#btn-open-workbench, .workbench-canvas, [data-tab="WORKBENCH"]',
    sensorCheck: (ctx) => {
      const items = ctx.state?.inventory?.items ?? [];
      if (items.some((it: any) => it.id === 'BAR_SOAP')) return true;
      if (!ctx.snapshot) return false;
      return (ctx.snapshot.moles?.[15] ?? 0) + (ctx.snapshot.moles?.[16] ?? 0) > 0.05;
    },
  },
  {
    id: 'deliver',
    title: 'Deliver',
    hint: 'Fulfill any Town Request.',
    targetSelector: '[data-tab="COUNCIL"], .timed-requests-widget, .requests-panel',
    sensorCheck: (ctx) => (ctx.state?.colony?.ledger?.length ?? 0) > 0,
  },
];

const BEAT_ORDER: TutorialBeat[] = ['stoke', 'render', 'deliver'];

export class TutorialProgressiveReveal {
  private currentBeatIndex = 0;
  private completedBeats = new Set<TutorialBeat>();
  private dismissed = false;
  private rafId: number | null = null;
  private coachmarkEl: HTMLElement | null = null;
  private spotlightRingEl: HTMLElement | null = null;
  private currentSpotlightEl: HTMLElement | null = null;
  private prefersReducedMotion = false;
  private readonly options: ProgressiveRevealOptions;

  constructor(options: ProgressiveRevealOptions = {}) {
    this.options = options;
    this.initReducedMotion();
    this.createCoachmarkDom();
  }

  private initReducedMotion(): void {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.prefersReducedMotion = mq.matches;
      mq.addEventListener('change', (e) => {
        this.prefersReducedMotion = e.matches;
        this.updateCoachmark();
      });
    }
  }

  private createCoachmarkDom(): void {
    const existing = document.getElementById('tutorial-progressive-coachmark');
    if (existing) existing.remove();

    this.coachmarkEl = document.createElement('div');
    this.coachmarkEl.id = 'tutorial-progressive-coachmark';
    this.coachmarkEl.className = 'tutorial-progressive-coachmark hidden';
    document.body.appendChild(this.coachmarkEl);

    this.spotlightRingEl = document.createElement('div');
    this.spotlightRingEl.id = 'tutorial-progressive-spotlight';
    this.spotlightRingEl.className = 'tutorial-progressive-spotlight';
    document.body.appendChild(this.spotlightRingEl);
  }

  public start(): void {
    this.dismissed = false;
    this.currentBeatIndex = 0;
    this.completedBeats.clear();
    this.updateCoachmark();
    this.startRafLoop();
  }

  public skip(): void {
    this.dismissed = true;
    this.stopRafLoop();
    this.hideCoachmark();
    this.clearSpotlight();
    BEAT_ORDER.forEach((b) => this.completedBeats.add(b));
    this.options.onSkip?.();
  }

  public destroy(): void {
    this.stopRafLoop();
    this.hideCoachmark();
    this.clearSpotlight();
    if (this.coachmarkEl) {
      this.coachmarkEl.remove();
      this.coachmarkEl = null;
    }
    if (this.spotlightRingEl) {
      this.spotlightRingEl.remove();
      this.spotlightRingEl = null;
    }
  }

  public snapshot() {
    return {
      currentBeatIndex: this.currentBeatIndex,
      completedBeats: Array.from(this.completedBeats),
      dismissed: this.dismissed,
    };
  }

  public restore(save?: {
    currentBeatIndex?: number;
    completedBeats?: string[];
    dismissed?: boolean;
  }): void {
    if (!save) return;
    if (typeof save.currentBeatIndex === 'number') this.currentBeatIndex = save.currentBeatIndex;
    if (Array.isArray(save.completedBeats)) this.completedBeats = new Set(save.completedBeats as TutorialBeat[]);
    if (typeof save.dismissed === 'boolean') this.dismissed = save.dismissed;
    if (!this.dismissed) {
      this.updateCoachmark();
      this.startRafLoop();
    }
  }

  public checkProgress(ctx: TutorialEvalContext): void {
    if (this.dismissed) return;
    if (this.currentBeatIndex >= BEAT_ORDER.length) return;

    const beatDef = BEAT_DEFS[this.currentBeatIndex];
    if (beatDef.sensorCheck(ctx)) {
      this.completedBeats.add(BEAT_ORDER[this.currentBeatIndex]);
      audio.chime();
      this.currentBeatIndex++;
      if (this.currentBeatIndex >= BEAT_ORDER.length) {
        audio.levelUp();
        this.dismissed = true;
        this.stopRafLoop();
        this.hideCoachmark();
        this.clearSpotlight();
        this.options.onAllComplete?.();
      } else {
        this.updateCoachmark();
      }
      this.options.onBeatComplete?.(BEAT_ORDER[this.currentBeatIndex - 1]);
    }
  }

  public isDismissed(): boolean {
    return this.dismissed;
  }

  private startRafLoop(): void {
    if (this.rafId !== null) return;
    const loop = () => {
      this.updateSpotlightPosition();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private stopRafLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private updateCoachmark(): void {
    if (!this.coachmarkEl) return;
    if (this.dismissed) {
      this.coachmarkEl.classList.add('hidden');
      return;
    }

    if (this.currentBeatIndex >= BEAT_ORDER.length) {
      this.coachmarkEl.classList.remove('hidden');
      this.coachmarkEl.innerHTML = `
        <div class="coachmark-content">
          <div class="coachmark-badge" style="color:#7fc98b">🎉 Guided Arc Complete!</div>
          <div class="coachmark-hint">The Academy remains open for deeper study.</div>
        </div>
        <div class="coachmark-actions"><button id="progressive-open-academy" class="btn btn-primary btn-sm">Academy</button></div>
      `;
      const btn = this.coachmarkEl.querySelector<HTMLButtonElement>('#progressive-open-academy');
      if (btn) btn.onclick = () => window.dispatchEvent(new CustomEvent('tutorial:open-academy'));
      return;
    }

    const beatDef = BEAT_DEFS[this.currentBeatIndex];
    if (!beatDef) return;

    this.coachmarkEl.classList.remove('hidden');
    this.coachmarkEl.innerHTML = `
      <div class="coachmark-content">
        <div class="coachmark-badge">🎓 Step ${this.currentBeatIndex + 1}/3: <strong>${beatDef.title}</strong></div>
        <div class="coachmark-hint">${beatDef.hint}</div>
      </div>
      <div class="coachmark-actions">
        <button id="progressive-skip-btn" class="btn btn-secondary btn-sm" title="Skip (Academy stays open)">Skip</button>
        <button id="progressive-open-academy" class="btn btn-primary btn-sm">Academy</button>
      </div>
    `;

    const btnSkip = this.coachmarkEl.querySelector<HTMLButtonElement>('#progressive-skip-btn');
    if (btnSkip) btnSkip.onclick = () => this.skip();

    const btnAcademy = this.coachmarkEl.querySelector<HTMLButtonElement>('#progressive-open-academy');
    if (btnAcademy) btnAcademy.onclick = () => window.dispatchEvent(new CustomEvent('tutorial:open-academy'));

    this.applySpotlight(beatDef.targetSelector);
  }

  private applySpotlight(selector: string): void {
    this.clearSpotlight();
    try {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (el) {
        el.classList.add('tutorial-focus');
        this.currentSpotlightEl = el;

        if (this.prefersReducedMotion) {
          const rect = el.getBoundingClientRect();
          if (this.spotlightRingEl) {
            this.spotlightRingEl.style.left = `${rect.left - 4}px`;
            this.spotlightRingEl.style.top = `${rect.top - 4}px`;
            this.spotlightRingEl.style.width = `${rect.width + 8}px`;
            this.spotlightRingEl.style.height = `${rect.height + 8}px`;
            this.spotlightRingEl.style.display = 'block';
            this.spotlightRingEl.style.animation = 'none';
            this.spotlightRingEl.style.borderColor = '#e0a458';
          }
        } else if (this.spotlightRingEl) {
          this.spotlightRingEl.style.display = 'block';
          this.spotlightRingEl.style.animation = 'tutorial-brass-pulse 2s ease-in-out infinite';
        }
      }
    } catch {}
  }

  private clearSpotlight(): void {
    if (this.currentSpotlightEl) {
      this.currentSpotlightEl.classList.remove('tutorial-focus');
      this.currentSpotlightEl = null;
    }
    if (this.spotlightRingEl) {
      this.spotlightRingEl.style.display = 'none';
    }
  }

  private hideCoachmark(): void {
    if (this.coachmarkEl) this.coachmarkEl.classList.add('hidden');
  }

  private updateSpotlightPosition(): void {
    if (!this.currentSpotlightEl || !this.spotlightRingEl || this.spotlightRingEl.style.display === 'none') return;
    if (this.prefersReducedMotion) return;

    try {
      const rect = this.currentSpotlightEl.getBoundingClientRect();
      this.spotlightRingEl.style.left = `${rect.left - 4}px`;
      this.spotlightRingEl.style.top = `${rect.top - 4}px`;
      this.spotlightRingEl.style.width = `${rect.width + 8}px`;
      this.spotlightRingEl.style.height = `${rect.height + 8}px`;
    } catch {}
  }
}

export { BEAT_DEFS, BEAT_ORDER };