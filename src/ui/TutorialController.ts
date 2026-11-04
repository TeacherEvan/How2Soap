import './tutorial.css';
import {
  TUTORIAL_LESSONS,
  type TutorialTierId,
  type TutorialEvalContext,
} from './tutorialCurriculum';
import { globalOverlayStack } from './overlayStack';
import { audio } from './audio';
import type { WorldSnapshot } from '../engine/memoryLayout';

// Asset references
import terrainMapImg from '../assets/tutorial/blender_terrain_map.png';
import minesGeologyImg from '../assets/tutorial/blender_mines_geology.png';
import elementsCrucibleImg from '../assets/tutorial/blender_elements_crucible.png';
import tutorialTiersImg from '../assets/tutorial/blender_tutorial_tiers.png';

const PLATE_IMAGES: Record<string, string> = {
  TERRAIN: terrainMapImg,
  MINES: minesGeologyImg,
  ELEMENTS: elementsCrucibleImg,
  TIERS: tutorialTiersImg,
};

export interface TutorialControllerOptions {
  onDispatchWorkerCommand: (cmd: any) => void;
  onSwitchTab?: (tab: string) => void;
}

export class TutorialController {
  private activeTier: TutorialTierId = 'BEGINNER';
  private activeLessonId: string | null = 'beg_1_forage';
  private completedLessonIds = new Set<string>();
  private phdTelemetryEnabled = false;
  private modalEl: HTMLElement | null = null;
  private currentOverlayEntry: { id: string; close: () => void } | null = null;
  private coachmarkEl: HTMLElement | null = null;
  private currentSpotlightEl: HTMLElement | null = null;

  constructor(private readonly options: TutorialControllerOptions) {
    this.createHudTrigger();
    this.createCoachmarkDom();
  }

  public getActiveTier(): TutorialTierId {
    return this.activeTier;
  }

  public isPhdTelemetryEnabled(): boolean {
    return this.phdTelemetryEnabled;
  }

  public setPhdTelemetryEnabled(enabled: boolean): void {
    this.phdTelemetryEnabled = enabled;
  }

  private createHudTrigger(): void {
    const hud = document.querySelector('.hud-right') || document.querySelector('header .controls') || document.querySelector('.telemetry');
    if (!hud) return;

    const existing = document.getElementById('btn-open-tutorial');
    if (existing) existing.remove();

    const btn = document.createElement('button');
    btn.id = 'btn-open-tutorial';
    btn.className = 'btn btn-secondary btn-dock';
    btn.setAttribute('aria-label', 'Open How to Play Tutorial Academy');
    btn.title = 'How to Play Tutorial & Compendium Academy';
    btn.innerHTML = `<span class="btn-icon">🎓</span> How to Play <span id="tutorial-hud-tier" class="badge-tier">Tier I</span>`;
    btn.onclick = () => this.openAcademyModal();
    hud.prepend(btn);
  }

  private createCoachmarkDom(): void {
    const existing = document.getElementById('tutorial-coachmark');
    if (existing) existing.remove();

    this.coachmarkEl = document.createElement('div');
    this.coachmarkEl.id = 'tutorial-coachmark';
    this.coachmarkEl.className = 'tutorial-coachmark hidden';
    document.body.appendChild(this.coachmarkEl);
  }

  public openAcademyModal(): void {
    if (this.modalEl) this.modalEl.remove();

    this.modalEl = document.createElement('div');
    this.modalEl.id = 'tutorial-modal-overlay';
    this.modalEl.className = 'modal-overlay';
    this.renderAcademyModalContent();
    document.body.appendChild(this.modalEl);

    const overlayEntry = {
      id: 'tutorial-modal-overlay',
      close: () => {
        this.closeAcademyModal();
      },
    };
    this.currentOverlayEntry = overlayEntry;
    globalOverlayStack.push(overlayEntry);
  }

  public closeAcademyModal(): void {
    if (this.modalEl) {
      this.modalEl.remove();
      this.modalEl = null;
      if (this.currentOverlayEntry) {
        globalOverlayStack.remove(this.currentOverlayEntry);
        this.currentOverlayEntry = null;
      }
    }
  }

  private renderAcademyModalContent(): void {
    if (!this.modalEl) return;

    const lessons = TUTORIAL_LESSONS.filter((l) => l.tier === this.activeTier);
    const activeLesson = lessons.find((l) => l.id === this.activeLessonId) ?? lessons[0];
    const plateImg = PLATE_IMAGES[activeLesson?.plateKey ?? 'TIERS'];

    this.modalEl.innerHTML = `
      <div class="modal-card tutorial-modal-card">
        <div class="modal-header">
          <div class="tutorial-header-titles">
            <h2>🎓 Alchemical Academy &amp; Field Chronicle</h2>
            <p class="subtitle">Quantitative Chemical Survival · Mohs Mechanics · Physical Metallurgy</p>
          </div>
          <button id="tutorial-close-btn" class="modal-close-btn" aria-label="Close Academy Modal">&times;</button>
        </div>

        <div class="tutorial-tier-bar">
          <button class="tier-tab-btn ${this.activeTier === 'BEGINNER' ? 'active' : ''}" data-tier="BEGINNER">
            🌱 Tier I: Beginner (Survival &amp; Soap)
          </button>
          <button class="tier-tab-btn ${this.activeTier === 'INTERMEDIATE' ? 'active' : ''}" data-tier="INTERMEDIATE">
            ⚒️ Tier II: Intermediate (Bronze &amp; Colony)
          </button>
          <button class="tier-tab-btn ${this.activeTier === 'PHD' ? 'active' : ''}" data-tier="PHD">
            ⚛️ Tier III: PhD Student (Arrhenius, SID &amp; Faraday)
          </button>
        </div>

        <div class="tutorial-modal-body">
          <div class="tutorial-left-col">
            <div class="blender-plate-viewer">
              <img src="${plateImg}" alt="${activeLesson?.title ?? 'Academy Plate'}" class="blender-plate-img" />
              <div class="plate-caption">
                <span>3D Survey Plate: <strong>${activeLesson?.plateKey}</strong></span>
                <label class="telemetry-toggle-label">
                  <input type="checkbox" id="chk-phd-telemetry" ${this.phdTelemetryEnabled ? 'checked' : ''} />
                  <span>🔬 PhD Telemetry Overlay</span>
                </label>
              </div>
            </div>

            <div class="active-lesson-detail">
              <h3>${activeLesson?.stepNumber}. ${activeLesson?.title}</h3>
              <p class="lesson-subtitle">${activeLesson?.subtitle}</p>
              <div class="lesson-summary">${activeLesson?.summaryHtml}</div>
              ${
                activeLesson?.formulaHtml
                  ? `<div class="lesson-formula"><strong>Thermodynamics:</strong> ${activeLesson.formulaHtml}</div>`
                  : ''
              }
              <div class="lesson-actions-row">
                <button id="btn-spawn-reagents" class="btn btn-secondary btn-sm" title="Grant reagents for this lesson to camp cache">
                  🧪 Spawn Lesson Reagents (Practice)
                </button>
                <button id="btn-start-spotlight" class="btn btn-primary btn-sm">
                  ▶ Guided Spotlight
                </button>
              </div>
            </div>
          </div>

          <div class="tutorial-right-col">
            <h4>Curriculum Steps (${lessons.length})</h4>
            <div class="lesson-list">
              ${lessons
                .map((l) => {
                  const done = this.completedLessonIds.has(l.id);
                  const isCur = l.id === this.activeLessonId;
                  return `
                    <div class="lesson-item-card ${isCur ? 'active' : ''} ${done ? 'completed' : ''}" data-lesson-id="${l.id}">
                      <div class="lesson-item-header">
                        <span class="lesson-num">${l.stepNumber}</span>
                        <span class="lesson-name">${l.title}</span>
                        <span class="lesson-status">${done ? '✓ Done' : isCur ? 'Active' : ''}</span>
                      </div>
                      <p class="lesson-short-hint">${l.actionHint}</p>
                    </div>
                  `;
                })
                .join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    // Wire close button
    const closeBtn = this.modalEl.querySelector('#tutorial-close-btn');
    if (closeBtn) (closeBtn as HTMLElement).onclick = () => this.closeAcademyModal();

    // Wire tier switcher buttons
    const tierBtns = this.modalEl.querySelectorAll('.tier-tab-btn');
    tierBtns.forEach((btn) => {
      (btn as HTMLElement).onclick = (e) => {
        const targetTier = (e.currentTarget as HTMLElement).getAttribute('data-tier') as TutorialTierId;
        if (targetTier && targetTier !== this.activeTier) {
          this.activeTier = targetTier;
          const firstInTier = TUTORIAL_LESSONS.find((l) => l.tier === targetTier);
          if (firstInTier) this.activeLessonId = firstInTier.id;
          this.updateHudTierBadge();
          this.renderAcademyModalContent();
          this.updateCoachmark();
        }
      };
    });

    // Wire lesson item clicks
    const lessonCards = this.modalEl.querySelectorAll('.lesson-item-card');
    lessonCards.forEach((card) => {
      (card as HTMLElement).onclick = (e) => {
        const lid = (e.currentTarget as HTMLElement).getAttribute('data-lesson-id');
        if (lid) {
          this.activeLessonId = lid;
          this.renderAcademyModalContent();
          this.updateCoachmark();
        }
      };
    });

    // Wire telemetry checkbox
    const chkTelemetry = this.modalEl.querySelector('#chk-phd-telemetry') as HTMLInputElement | null;
    if (chkTelemetry) {
      chkTelemetry.onchange = () => {
        this.phdTelemetryEnabled = chkTelemetry.checked;
      };
    }

    // Wire spawn reagents button
    const btnSpawn = this.modalEl.querySelector('#btn-spawn-reagents') as HTMLElement | null;
    if (btnSpawn && activeLesson) {
      btnSpawn.onclick = () => {
        this.options.onDispatchWorkerCommand({
          type: 'GRANT_TUTORIAL_REAGENTS',
          ...activeLesson.practiceGrant,
        });
        btnSpawn.innerText = '✓ Reagents Granted!';
        setTimeout(() => {
          if (btnSpawn) btnSpawn.innerText = '🧪 Spawn Lesson Reagents (Practice)';
        }, 1500);
      };
    }

    // Wire start spotlight
    const btnSpotlight = this.modalEl.querySelector('#btn-start-spotlight') as HTMLElement | null;
    if (btnSpotlight && activeLesson) {
      btnSpotlight.onclick = () => {
        this.closeAcademyModal();
        if (this.options.onSwitchTab && activeLesson.tabTarget) {
          this.options.onSwitchTab(activeLesson.tabTarget);
        }
        this.updateCoachmark();
      };
    }
  }

  private updateHudTierBadge(): void {
    const badge = document.getElementById('tutorial-hud-tier');
    if (badge) {
      const labels: Record<TutorialTierId, string> = {
        BEGINNER: 'Tier I',
        INTERMEDIATE: 'Tier II',
        PHD: 'Tier III (PhD)',
      };
      badge.textContent = labels[this.activeTier];
    }
  }

  public updateCoachmark(): void {
    if (!this.coachmarkEl) return;
    const lesson = TUTORIAL_LESSONS.find((l) => l.id === this.activeLessonId);
    if (!lesson) {
      this.coachmarkEl.classList.add('hidden');
      this.clearSpotlight();
      return;
    }

    this.coachmarkEl.classList.remove('hidden');
    this.coachmarkEl.innerHTML = `
      <div class="coachmark-content">
        <div class="coachmark-badge">
          🎓 Step ${lesson.stepNumber}/5: <strong>${lesson.title}</strong>
        </div>
        <div class="coachmark-hint">${lesson.actionHint}</div>
      </div>
      <div class="coachmark-actions">
        <button id="coachmark-grant-btn" class="btn btn-secondary btn-sm" title="Grant test reagents">
          🧪 Grant Reagents
        </button>
        <button id="coachmark-open-modal" class="btn btn-primary btn-sm">
          Field Manual
        </button>
      </div>
    `;

    const btnGrant = this.coachmarkEl.querySelector('#coachmark-grant-btn') as HTMLElement | null;
    if (btnGrant) {
      btnGrant.onclick = () => {
        this.options.onDispatchWorkerCommand({
          type: 'GRANT_TUTORIAL_REAGENTS',
          ...lesson.practiceGrant,
        });
        btnGrant.innerText = '✓ Granted';
        setTimeout(() => {
          if (btnGrant) btnGrant.innerText = '🧪 Grant Reagents';
        }, 1200);
      };
    }

    const btnManual = this.coachmarkEl.querySelector('#coachmark-open-modal') as HTMLElement | null;
    if (btnManual) {
      btnManual.onclick = () => this.openAcademyModal();
    }

    this.applySpotlight(lesson.spotlightSelector);
  }

  private applySpotlight(selector: string): void {
    this.clearSpotlight();
    try {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (el) {
        el.classList.add('tutorial-spotlight-target');
        this.currentSpotlightEl = el;
      }
    } catch {
      // Ignore selector errors
    }
  }

  private clearSpotlight(): void {
    if (this.currentSpotlightEl) {
      this.currentSpotlightEl.classList.remove('tutorial-spotlight-target');
      this.currentSpotlightEl = null;
    }
  }

  public checkProgress(ctx: TutorialEvalContext): void {
    if (!this.activeLessonId) return;
    const lesson = TUTORIAL_LESSONS.find((l) => l.id === this.activeLessonId);
    if (!lesson) return;

    if (lesson.isComplete(ctx)) {
      if (!this.completedLessonIds.has(lesson.id)) {
        this.completedLessonIds.add(lesson.id);
        audio.chime();

        // Advance to next step in tier
        const tierLessons = TUTORIAL_LESSONS.filter((l) => l.tier === this.activeTier);
        const curIdx = tierLessons.findIndex((l) => l.id === lesson.id);
        if (curIdx !== -1 && curIdx + 1 < tierLessons.length) {
          this.activeLessonId = tierLessons[curIdx + 1].id;
          this.updateCoachmark();
        } else {
          audio.levelUp();
        }
      }
    }
  }
}

/**
 * Pure thermodynamic calculation for Tier III PhD Telemetry Mode
 */
export function computeVesselPhdTelemetry(
  vesselIndex: number,
  snapshot: WorldSnapshot,
): {
  tempK: number;
  ph: number;
  sidMolL: number;
  arrheniusRateK: number;
  newtonCoolingWatts: number;
} {
  const tBase = vesselIndex * 8;
  const tempK = snapshot.telemetry[tBase + 0] ?? 288.15;
  const ph = snapshot.telemetry[tBase + 1] ?? 7.0;

  // SID estimate from pH quadratic relation: [H+] = 10^(-pH)
  const hConc = Math.pow(10, -Math.min(14, Math.max(0, ph)));
  const kw = 1e-14;
  const ohConc = kw / Math.max(1e-15, hConc);
  const sidMolL = ohConc - hConc;

  // Arrhenius rate constant for saponification: k(T) = A * exp(-Ea / RT)
  // Tripalmitin Ea ≈ 48,000 J/mol, A ≈ 1.2e7 L/(mol*s)
  const R = 8.314;
  const Ea = 48000;
  const A = 1.2e7;
  const arrheniusRateK = A * Math.exp(-Ea / (R * Math.max(200, tempK)));

  // Newton cooling loss Q = U * A * (T - T_amb)
  const U_A = 12.5; // W/K
  const ambientK = 288.15;
  const newtonCoolingWatts = Math.max(0, U_A * (tempK - ambientK));

  return {
    tempK,
    ph,
    sidMolL,
    arrheniusRateK,
    newtonCoolingWatts,
  };
}
