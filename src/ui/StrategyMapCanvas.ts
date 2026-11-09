/**
 * Strategy Map Canvas & Labor Command Dock (Axial Hex Rewrite)
 *
 * Implements §7.1, §7.2, §7.3 of Civ VII 4X Conversion Plan (v8):
 * - Axial Hex Map representation (q, r).
 * - Culls hexes to viewport; draws category-tinted biome cells.
 * - Renders settlements & frontier/influence rings.
 * - Colonist tokens navigate along hex paths.
 * - Desire path wear rendered as roads for wear > 96.
 * - Fog of War rendering (unrevealed hexes dimmed/hidden).
 * - Command Dock UI: Roster List, Recruitment Drawer, Job & Wage selectors, Stimulant bar.
 *
 * M1 Task 10 — map feedback drive (ColonyState + minuteOfDay driven loops):
 * - Colonist walk/idle/harvest per archetype tint (getArchetypeColor) with
 *   stimulant surge gait (+20-55%) / crash slump (-5-25%) via expDecay pose blend.
 * - Biome sway 2-4px (tree/bush/water/crystal) vertex-offset loops.
 * - Hearth smoke/glow scaled by computeDiurnalLighting.hearthRadiusPx.
 * - Desire-path fade by wear (alpha from computeDesirePathAlpha) + road >96.
 * - Hotspot TimingRingStrike shrink + fog sweep as pooled sprites.
 * Pooled sprite draws are capped at MAX_SPRITE_DRAWS (200); reduced-motion
 * freezes loops at FROZEN_TIME; DPR is clamped to [1, 2].
 *
 * Sprite atlas choice (bundle-safe, measured): src/assets/sprites/*.png
 * (flame 160KB, fume 127KB, bubbles 83KB, ember 73KB) are NOT imported here.
 * StrategyMap is Canvas2D on a lazy chunk; main entrypoint is ~45KB (200KB
 * budget has headroom), so asset/resource imports would not bloat JS — but
 * four extra media files plus a Canvas2D sheet-crop path cost far more than
 * they return for top-down tokens/glow. Mirroring LabBench3DCanvas Task 9's
 * sprite-free precedent, hearth smoke, fog wisps, and ring pulses are
 * procedural pooled arcs shaded with fillStyles (zero asset fetches, O(1)
 * per sprite). Revisit only if node-measured pixels beat procedural cost.
 */

import {
  type ColonistArchetype,
  type ColonyState,
  type WageContract,
  type WageCommodity,
  WAGE_COMMODITIES,
} from '../engine/colony';
import {
  BIOME_DAG,
  getSpeciesWorldPosition,
} from '../data/biomeNodes';
import {
  generateHexMap,
  hexToPixel,
  type HexMapGrid,
} from '../engine/campaign/hexMap';
import {
  worldToScreen,
  screenToWorld,
  computeDiurnalLighting,
  computeDesirePathAlpha,
  getArchetypeColor,
  getBiomeColor,
  getRoadWearColor,
  getUnrevealedColor,
  MAX_SPRITE_DRAWS,
  FROZEN_TIME,
  clampDpr,
  blendPose,
  getBiomeSwayOffset,
  getColonistPose,
  getHearthPulse,
  getFogSweep,
  getTimingRingRadius,
  type ViewportState,
  type DiurnalLighting,
} from './mapMath';
import { CLIPS } from './gl/lowPolyMeshes';

export {
  worldToScreen,
  screenToWorld,
  computeDiurnalLighting,
  computeDesirePathAlpha,
  getArchetypeColor,
  getBiomeColor,
  getRoadWearColor,
  getUnrevealedColor,
  MAX_SPRITE_DRAWS,
  FROZEN_TIME,
  clampDpr,
  blendPose,
  getBiomeSwayOffset,
  getColonistPose,
  getHearthPulse,
  getFogSweep,
  getTimingRingRadius,
};
export type { ViewportState, DiurnalLighting };

import terrainMapImg from '../assets/tutorial/blender_terrain_map.png';

import { escapeHtml } from './escapeHtml';

export interface StrategyMapCanvasOptions {
  onRecruit?: (candidate: { name: string; archetype: ColonistArchetype; wageContract: WageContract }) => void;
  onAssignJob?: (colonistId: string, speciesId: string, partId: string) => void;
  onAdministerStimulant?: (colonistId: string, stimulantId: string) => void;
  onSetWageContract?: (colonistId: string, wageContract: WageContract) => void;
  onHarvestBoost?: (speciesId: string, bonus: boolean) => void;
}

export interface MapHotspot {
  id: string;
  speciesId: string;
  name: string;
  expiresAtMs: number;
}

export interface TimingRingStrike {
  speciesId: string;
  worldX: number;
  worldY: number;
  startMs: number;
  durationMs: number;
  innerRadius: number;
  outerRadius: number;
}

export class StrategyMapCanvas {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dockContainer: HTMLElement;
  private options: StrategyMapCanvasOptions;
  private colonyState: ColonyState | null = null;
  private minuteOfDay = 720;
  private animFrameId: number | null = null;

  public hexGrid: HexMapGrid;

  public viewport: ViewportState = {
    width: 800,
    height: 500,
    panX: 0,
    panY: 0,
    zoom: 0.22,
  };

  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private panStartX = 0;
  private panStartY = 0;
  private showReliefUnderlay = true;
  private reliefImage: HTMLImageElement | null = null;
  private noisePattern: CanvasPattern | null = null;

  public activeHotspots: MapHotspot[] = [];
  public activeTimingRing: TimingRingStrike | null = null;
  private lastHotspotSpawnMs = 0;

  /** M1 Task 10 — feedback drive timing (seconds, frame-rate independent). */
  private animTimeSec = 0;
  private lastRenderMs: number | null = null;
  private reducedMotion = false;
  private mediaQuery: MediaQueryList | null = null;
  private readonly onMediaChange = (): void => {
    this.onReducedMotionChange();
  };
  /** expDecay-smoothed pose channels keyed by colonist id (bob, lean, scale). */
  private smoothedPose = new Map<string, { bob: number; lean: number; scale: number }>();
  /** Pooled sprite budget (smoke, fog, ring, gait accents) — capped at 200. */
  private drawCount = 0;
  public lastSpriteDrawCount = 0;

  constructor(container: HTMLElement, options: StrategyMapCanvasOptions = {}) {
    this.container = container;
    this.options = options;
    this.hexGrid = generateHexMap(1337, 10);

    this.container.classList.add('strategy-map-view');
    this.container.innerHTML = `
      <div class="strategy-canvas-wrapper">
        <canvas class="strategy-canvas" width="800" height="500"></canvas>
        <div class="map-controls-overlay">
          <button class="map-btn" data-action="zoom-in" title="Zoom In (+)">+</button>
          <button class="map-btn" data-action="zoom-out" title="Zoom Out (-)">−</button>
          <button class="map-btn" data-action="center" title="Center Hearth (Space)">⌂</button>
          <button class="map-btn" data-action="toggle-relief" title="Toggle 3D Relief">⛰</button>
        </div>
      </div>
      <aside class="strategy-dock" aria-label="Strategy Map & Labor Command Dock">
        <header class="dock-header">
          <h3>Labor Roster</h3>
          <span class="roster-count">0</span> Hands
        </header>
        <div class="colonist-roster-list" role="list"></div>
        <div class="recruitment-drawer">
          <h4>Recruitment Tavern</h4>
          <div class="recruitment-cards-container"></div>
        </div>
      </aside>
    `;

    this.canvas = this.container.querySelector<HTMLCanvasElement>('.strategy-canvas')!;
    this.ctx = this.canvas.getContext('2d')!;
    this.dockContainer = this.container.querySelector<HTMLElement>('.strategy-dock')!;

    if (typeof Image !== 'undefined') {
      this.reliefImage = new Image();
      this.reliefImage.src = terrainMapImg;
    }

    this.initEventListeners();
    this.initRecruitmentDrawer();
    this.renderDock();

    // Reduced-motion freeze (matchMedia precedent from app/splash.ts + LabBench3DCanvas).
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      try {
        this.mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        this.reducedMotion = this.mediaQuery.matches;
        if (typeof this.mediaQuery.addEventListener === 'function') {
          this.mediaQuery.addEventListener('change', this.onMediaChange);
        }
      } catch {
        /* matchMedia unavailable — animate normally */
      }
    }

    this.startRenderLoop();
  }

  private onReducedMotionChange(): void {
    this.reducedMotion = this.mediaQuery?.matches ?? false;
  }

  private canDrawSprite(): boolean {
    return this.drawCount < MAX_SPRITE_DRAWS;
  }

  private countSprite(n = 1): void {
    this.drawCount += n;
  }

  public update(colony: ColonyState, minuteOfDay: number): void {
    this.colonyState = colony;
    this.minuteOfDay = minuteOfDay;
    this.renderDock();
  }

  public resizeCanvas(): void {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      const rawDpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
      const dpr = clampDpr(rawDpr);
      this.canvas.width = Math.round(rect.width * dpr);
      this.canvas.height = Math.round(rect.height * dpr);
      this.canvas.style.width = `${rect.width}px`;
      this.canvas.style.height = `${rect.height}px`;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.viewport.width = rect.width;
      this.viewport.height = rect.height;
    }
  }

  private abortController: AbortController | null = new AbortController();

  private createNoisePattern(ctx: CanvasRenderingContext2D): CanvasPattern {
    // Create 64x64 noise pattern for 1.5% anti-banding dither
    const size = 64;
    const noiseCanvas = document.createElement('canvas');
    noiseCanvas.width = size;
    noiseCanvas.height = size;
    const noiseCtx = noiseCanvas.getContext('2d')!;
    const imageData = noiseCtx.createImageData(size, size);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const val = Math.random() * 255;
      data[i] = val;     // R
      data[i + 1] = val; // G
      data[i + 2] = val; // B
      data[i + 3] = 255; // A
    }
    noiseCtx.putImageData(imageData, 0, 0);
    return ctx.createPattern(noiseCanvas, 'repeat')!;
  }

  public destroy(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.mediaQuery && typeof this.mediaQuery.removeEventListener === 'function') {
      try {
        this.mediaQuery.removeEventListener('change', this.onMediaChange);
      } catch {
        /* mock environments may not implement full MediaQueryList */
      }
      this.mediaQuery = null;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  private initEventListeners(): void {
    const { canvas } = this;
    const signal = this.abortController?.signal;

    canvas.addEventListener('pointerdown', (e: PointerEvent) => {
      this.isDragging = true;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.panStartX = this.viewport.panX;
      this.panStartY = this.viewport.panY;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // Fallback in environments without pointer capture
      }
    }, { signal });

    canvas.addEventListener('pointermove', (e: PointerEvent) => {
      if (!this.isDragging) return;
      this.viewport.panX = this.panStartX + (e.clientX - this.dragStartX);
      this.viewport.panY = this.panStartY + (e.clientY - this.dragStartY);
    }, { signal });

    const endDrag = (e: PointerEvent) => {
      if (this.isDragging) {
        this.isDragging = false;
        try {
          if (canvas.hasPointerCapture(e.pointerId)) {
            canvas.releasePointerCapture(e.pointerId);
          }
        } catch {
          // Fallback in environments without pointer capture
        }
      }
    };

    canvas.addEventListener('pointerup', endDrag as EventListener, { signal });
    canvas.addEventListener('pointercancel', endDrag as EventListener, { signal });
    // Fallback for environments without pointer capture: release anywhere ends the drag.
    canvas.addEventListener('lostpointercapture', endDrag as EventListener, { signal });
    window.addEventListener('pointerup', endDrag as EventListener, { signal });

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      const rect = canvas.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      const worldPos = screenToWorld(cursorX, cursorY, this.viewport);
      this.viewport.zoom = Math.max(0.08, Math.min(1.5, this.viewport.zoom * zoomFactor));

      const newScreen = worldToScreen(worldPos.x, worldPos.y, this.viewport);
      this.viewport.panX += cursorX - newScreen.x;
      this.viewport.panY += cursorY - newScreen.y;
    }, { passive: false, signal });

    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      this.handleNodeClick(screenX, screenY);
    }, { signal });

    this.container.querySelectorAll<HTMLButtonElement>('.map-btn, .map-ctrl-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (action === 'zoom-in') this.viewport.zoom = Math.min(1.5, this.viewport.zoom * 1.25);
        if (action === 'zoom-out') this.viewport.zoom = Math.max(0.08, this.viewport.zoom * 0.8);
        if (action === 'center') {
          this.viewport.panX = 0;
          this.viewport.panY = 0;
        }
        if (action === 'toggle-relief') this.showReliefUnderlay = !this.showReliefUnderlay;
      }, { signal });
    });
  }

  private handleNodeClick(screenX: number, screenY: number): void {
    const worldPos = screenToWorld(screenX, screenY, this.viewport);

    if (this.activeTimingRing) {
      const ringPos = worldToScreen(this.activeTimingRing.worldX, this.activeTimingRing.worldY, this.viewport);
      const dist = Math.hypot(screenX - ringPos.x, screenY - ringPos.y);

      if (dist <= this.activeTimingRing.outerRadius + 14) {
        const elapsed = Date.now() - this.activeTimingRing.startMs;
        const progress = elapsed / this.activeTimingRing.durationMs;
        const isPerfect = progress >= 0.70 && progress <= 0.98;
        this.options.onHarvestBoost?.(this.activeTimingRing.speciesId, isPerfect);
        this.activeTimingRing = null;
        return;
      }
    }

    for (const cat of BIOME_DAG) {
      for (const sp of cat.species) {
        const pos = getSpeciesWorldPosition(sp);
        const dist = Math.hypot(worldPos.x - pos.x, worldPos.y - pos.y);
        if (dist <= 40) {
          this.activeTimingRing = {
            speciesId: sp.id,
            worldX: pos.x,
            worldY: pos.y,
            startMs: Date.now(),
            durationMs: 1200,
            innerRadius: 10,
            outerRadius: 36,
          };
          return;
        }
      }
    }
  }

  private startRenderLoop(): void {
    const loop = (nowMs?: number) => {
      if (!this.container.classList.contains('hidden') && this.container.offsetParent !== null) {
        const stamp = typeof nowMs === 'number' && Number.isFinite(nowMs)
          ? nowMs
          : (typeof performance !== 'undefined' ? performance.now() : Date.now());
        this.renderCanvas(stamp);
      }
      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  /** Pooled sprite pool sizes (fixed, no per-frame allocation). */
  private static readonly SMOKE_POOL_SIZE = 10;
  private static readonly FOG_POOL_SIZE = 6;

  public renderCanvas(nowMs: number = typeof performance !== 'undefined' ? performance.now() : Date.now()): void {
    const { ctx, viewport, minuteOfDay } = this;
    const { width, height } = viewport;

    // M1 Task 10 — frame-rate independent drive timing; reduced-motion freezes.
    this.drawCount = 0;
    const dt = this.lastRenderMs === null
      ? 0
      : Math.max(0, (nowMs - this.lastRenderMs) / 1000);
    this.lastRenderMs = nowMs;
    if (this.reducedMotion) {
      this.animTimeSec = FROZEN_TIME;
    } else {
      this.animTimeSec += dt;
    }
    const timeSec = this.animTimeSec;
    const smoothDt = this.reducedMotion ? 0 : dt;
    // Wall clock for hotspot/ring logic (startMs is Date.now() in handleNodeClick).
    // nowMs above is the rAF/performance timestamp for frame dt only.
    const wallNowMs = Date.now();

    ctx.save();
    ctx.fillStyle = '#12151c';
    ctx.fillRect(0, 0, width, height);

    if (this.showReliefUnderlay && this.reliefImage) {
      const origin = worldToScreen(0, 0, viewport);
      const reliefRadius = 1600 * viewport.zoom;
      ctx.save();
      ctx.beginPath();
      ctx.arc(origin.x, origin.y, reliefRadius, 0, Math.PI * 2);
      ctx.clip();
      ctx.globalAlpha = 0.35;
      ctx.drawImage(
        this.reliefImage,
        origin.x - reliefRadius,
        origin.y - reliefRadius,
        reliefRadius * 2,
        reliefRadius * 2,
      );
      // Anti-banding 1.5% noise dither
      if (!this.noisePattern) {
        this.noisePattern = this.createNoisePattern(ctx);
      }
      ctx.globalAlpha = 0.015;
      ctx.fillStyle = this.noisePattern;
      ctx.fillRect(origin.x - reliefRadius, origin.y - reliefRadius, reliefRadius * 2, reliefRadius * 2);
      ctx.restore();
    }

    // Render Axial Hex Grid
    this.renderHexGrid();

    // Astrolabe concentric range rings
    const rings = [100, 300, 600, 1200, 1600];
    const origin = worldToScreen(0, 0, viewport);

    for (const r of rings) {
      const screenRadius = r * viewport.zoom;
      ctx.beginPath();
      ctx.arc(origin.x, origin.y, screenRadius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(224, 164, 88, 0.22)';
      ctx.setLineDash([4, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(224, 164, 88, 0.45)';
      ctx.font = '9px monospace';
      ctx.fillText(`${r}m`, origin.x + screenRadius + 4, origin.y - 2);
    }

    // Pooled fog sweep (procedural wisps drifting over the survey).
    for (let i = 0; i < StrategyMapCanvas.FOG_POOL_SIZE; i++) {
      if (!this.canDrawSprite()) break;
      const fog = getFogSweep(timeSec, width, i);
      if (fog.alpha <= 0.01) continue;
      const fogY = height * (0.2 + (i % 3) * 0.18);
      ctx.save();
      ctx.globalAlpha = fog.alpha;
      ctx.fillStyle = '#dce6ec';
      ctx.beginPath();
      ctx.arc(fog.x, fogY, 28 + (i % 3) * 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      this.countSprite();
    }

    // Biome resource nodes (2-4px vertex-offset sway loops)
    if (wallNowMs - this.lastHotspotSpawnMs > 45000) {
      this.lastHotspotSpawnMs = wallNowMs;
      const allSpecies = BIOME_DAG.flatMap((c) => c.species);
      const chosen = allSpecies[Math.floor(Math.random() * allSpecies.length)];
      if (chosen && !this.activeHotspots.some((h) => h.speciesId === chosen.id)) {
        this.activeHotspots.push({
          id: `hotspot_${wallNowMs}`,
          speciesId: chosen.id,
          name: chosen.name,
          expiresAtMs: wallNowMs + 30000,
        });
      }
    }
    this.activeHotspots = this.activeHotspots.filter((h) => h.expiresAtMs > wallNowMs);

    for (const cat of BIOME_DAG) {
      for (const sp of cat.species) {
        const pos = getSpeciesWorldPosition(sp);
        // Deterministic phase seed from world position (no per-frame RNG).
        const swaySeed = (pos.x * 0.37 + pos.y * 0.61) % 10;
        const sway = getBiomeSwayOffset(timeSec, cat.key, swaySeed);
        const s = worldToScreen(pos.x, pos.y, viewport);
        const sx = s.x + sway.dx;
        const sy = s.y + sway.dy;
        const isHotspot = this.activeHotspots.some((h) => h.speciesId === sp.id);

        if (isHotspot) {
          ctx.beginPath();
          ctx.arc(sx, sy, 14, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 215, 0, 0.35)';
          ctx.fill();
          ctx.strokeStyle = '#ffd700';
          ctx.lineWidth = 2;
          ctx.stroke();
          this.countSprite();
        }

        ctx.beginPath();
        ctx.arc(sx, sy, 6, 0, Math.PI * 2);
        ctx.fillStyle = isHotspot
          ? '#ffd700'
          : cat.key === 'TREES'
          ? '#4caf50'
          : cat.key === 'ROCKS_MINERALS'
          ? '#e0a458'
          : cat.key === 'MUSHROOMS_FLORA'
          ? '#9c27b0'
          : '#ff9800';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = isHotspot ? '#ffe57f' : '#dce6ec';
        ctx.font = isHotspot ? 'bold 10px serif' : '10px serif';
        ctx.fillText(isHotspot ? `★ ${sp.name} (3x!)` : sp.name, sx + 8, sy + 3);
      }
    }

    // Active timing ring strike (shrink via getTimingRingRadius, pooled pulse)
    if (this.activeTimingRing) {
      const elapsed = wallNowMs - this.activeTimingRing.startMs;
      if (elapsed > this.activeTimingRing.durationMs) {
        this.activeTimingRing = null;
      } else {
        const progress = elapsed / this.activeTimingRing.durationMs;
        const currentRadius = getTimingRingRadius(
          progress,
          this.activeTimingRing.outerRadius,
          this.activeTimingRing.innerRadius,
        );
        const ringPos = worldToScreen(this.activeTimingRing.worldX, this.activeTimingRing.worldY, viewport);

        ctx.beginPath();
        ctx.arc(ringPos.x, ringPos.y, this.activeTimingRing.innerRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(76, 175, 80, 0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(ringPos.x, ringPos.y, currentRadius, 0, Math.PI * 2);
        const inPerfectZone = progress >= 0.70 && progress <= 0.98;
        ctx.strokeStyle = inPerfectZone ? '#4caf50' : '#ffd700';
        ctx.lineWidth = inPerfectZone ? 3 : 2;
        ctx.stroke();

        // Pooled highlight pulse riding the shrink (frozen under reduced-motion).
        if (this.canDrawSprite()) {
          const pulse = 0.5 + 0.5 * Math.sin((this.reducedMotion ? FROZEN_TIME : timeSec) * Math.PI * 2);
          const pulseR = this.activeTimingRing.innerRadius + pulse * (currentRadius - this.activeTimingRing.innerRadius);
          ctx.save();
          ctx.globalAlpha = 0.25 * (1 - progress);
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(ringPos.x, ringPos.y, Math.max(1, pulseR), 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
          this.countSprite(2);
        }

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText(inPerfectZone ? 'STRIKE NOW!' : 'Harvesting...', ringPos.x - 24, ringPos.y - 18);
      }
    }

    // Camp Hearth at (0, 0) — smoke/glow scaled by diurnal hearthRadiusPx.
    const diurnal = computeDiurnalLighting(minuteOfDay);
    const hearthClip = CLIPS.HEARTH_GLOW;
    const hearthTime = timeSec * (hearthClip ? hearthClip.fps / 6 : 1);
    const hearth = getHearthPulse(this.reducedMotion ? FROZEN_TIME : hearthTime, diurnal.hearthRadiusPx);
    const hearthGrad = ctx.createRadialGradient(
      origin.x,
      origin.y,
      4,
      origin.x,
      origin.y,
      hearth.radiusPx,
    );
    hearthGrad.addColorStop(0, `rgba(255, 170, 50, ${(0.85 * hearth.glowAlpha).toFixed(3)})`);
    hearthGrad.addColorStop(0.3, `rgba(230, 90, 20, ${(0.45 * hearth.glowAlpha).toFixed(3)})`);
    hearthGrad.addColorStop(1, 'rgba(230, 90, 20, 0)');
    ctx.fillStyle = hearthGrad;
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, hearth.radiusPx, 0, Math.PI * 2);
    ctx.fill();

    // Pooled hearth smoke (procedural arcs rising above the glow).
    for (let i = 0; i < StrategyMapCanvas.SMOKE_POOL_SIZE; i++) {
      if (!this.canDrawSprite()) break;
      const loopFrac = (timeSec * 0.08 + i * 0.13) % 1;
      const rise = loopFrac * hearth.smokePx;
      const drift = Math.sin(timeSec * 0.9 + i * 1.7) * 8 * loopFrac;
      const puffR = 3 + loopFrac * 9;
      ctx.save();
      ctx.globalAlpha = (1 - loopFrac) * 0.32 * hearth.glowAlpha;
      ctx.fillStyle = '#dce6ec';
      ctx.beginPath();
      ctx.arc(origin.x + drift, origin.y - rise - 6, puffR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      this.countSprite();
    }

    ctx.beginPath();
    ctx.arc(origin.x, origin.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffaa33';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#ffd9a0';
    ctx.font = 'bold 10px serif';
    ctx.fillText('Camp Hearth', origin.x + 8, origin.y + 3);

    // Colonists tokens & Job path polyline (walk/idle/harvest gait + pose blend)
    if (this.colonyState?.colonists) {
      const walkClip = CLIPS.COLONIST_WALK;
      const harvestClip = CLIPS.COLONIST_HARVEST;
      const idleClip = CLIPS.COLONIST_IDLE;
      for (const c of this.colonyState.colonists) {
        const s = worldToScreen(c.position.x, c.position.y, viewport);

        if (c.assignedJob) {
          const targetPos = getSpeciesWorldPosition(c.assignedJob.speciesId);
          const targetScreen = worldToScreen(targetPos.x, targetPos.y, viewport);

          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(targetScreen.x, targetScreen.y);
          ctx.strokeStyle = c.status === 'STRIKE' ? 'rgba(217, 108, 108, 0.4)' : 'rgba(95, 179, 161, 0.35)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Sample the status clip for phase scale, then blend via expDecay.
        const stimPhase = c.activeStimulant ? (c.activeStimulant.phase as 'BOOST' | 'CRASH') : null;
        const stimMult = c.activeStimulant ? c.activeStimulant.speedMultiplier : 1;
        const clipScale = c.status === 'TRAVELING' || c.status === 'RETURNING'
          ? (walkClip.fps / 8)
          : c.status === 'GATHERING'
            ? (harvestClip.fps / 6)
            : (idleClip.fps / 6);
        const target = getColonistPose(c.status, stimPhase, stimMult, timeSec * clipScale);
        const prev = this.smoothedPose.get(c.id) ?? { bob: 0, lean: 0, scale: 1 };
        // Reduced-motion snaps to the frozen-time posed frame (no blend drift).
        const smoothed = this.reducedMotion
          ? { bob: target.bobPx, lean: target.leanPx, scale: target.radiusScale }
          : {
            bob: blendPose(prev.bob, target.bobPx, 8, smoothDt),
            lean: blendPose(prev.lean, target.leanPx, 8, smoothDt),
            scale: blendPose(prev.scale, target.radiusScale, 8, smoothDt),
          };
        this.smoothedPose.set(c.id, smoothed);

        const color = getArchetypeColor(c.archetype);
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, target.alpha));
        ctx.beginPath();
        ctx.arc(s.x + smoothed.lean, s.y + smoothed.bob, Math.max(3, 7 * smoothed.scale), 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = c.status === 'STRIKE' ? '#d96c6c' : '#ffffff';
        ctx.lineWidth = c.status === 'STRIKE' ? 2 : 1;
        ctx.stroke();
        ctx.restore();
        this.countSprite();

        ctx.fillStyle = '#ffffff';
        ctx.font = '9px monospace';
        ctx.fillText(c.name, s.x + smoothed.lean + 9, s.y + smoothed.bob + 3);
      }
    }

    this.lastSpriteDrawCount = this.drawCount;
    ctx.restore();
  }

  private renderHexGrid(): void {
    const { ctx, viewport, hexGrid } = this;
    const hexSize = 60 * viewport.zoom;

    for (const tile of hexGrid.tiles.values()) {
      const pos = hexToPixel(tile.q, tile.r, 60);
      const s = worldToScreen(pos.x, pos.y, viewport);

      if (
        s.x + hexSize < 0 ||
        s.x - hexSize > viewport.width ||
        s.y + hexSize < 0 ||
        s.y - hexSize > viewport.height
      ) {
        continue;
      }

      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        const hx = s.x + hexSize * Math.cos(angle);
        const hy = s.y + hexSize * Math.sin(angle);
        if (i === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      if (typeof ctx.closePath === 'function') {
        ctx.closePath();
      }

      if (!tile.revealed) {
        ctx.fillStyle = getUnrevealedColor();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.stroke();
        continue;
      }

      ctx.fillStyle = getBiomeColor(tile.biome);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Desire-path fade by wear (alpha from computeDesirePathAlpha) + road >96.
      const pathAlpha = computeDesirePathAlpha(tile.roadWear);
      if (pathAlpha > 0) {
        ctx.save();
        ctx.globalAlpha = pathAlpha;
        ctx.fillStyle = getRoadWearColor();
        ctx.fill();
        ctx.restore();
      }

      if (tile.roadWear > 96) {
        ctx.beginPath();
        ctx.arc(s.x, s.y, hexSize * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = getRoadWearColor();
        ctx.fill();
      }
    }
  }

  private initRecruitmentDrawer(): void {
    if (!this.dockContainer || typeof this.dockContainer.querySelector !== 'function') return;
    const recruitEl = this.dockContainer.querySelector<HTMLElement>('.recruitment-cards-container');
    if (!recruitEl) return;

    const archetypes: ColonistArchetype[] = ['FORAGER', 'MINER', 'HERBALIST', 'APPRENTICE_CHEMIST'];
    recruitEl.innerHTML = archetypes
      .map(
        (arc) => `
      <button class="recruit-btn" data-recruit-archetype="${arc}" type="button" style="margin: 0.2rem; padding: 0.4rem 0.6rem; font-size: 0.75rem;">
        Recruit ${arc}
      </button>
    `,
      )
      .join('');

    recruitEl.querySelectorAll<HTMLButtonElement>('.recruit-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const archetype = btn.dataset.recruitArchetype as ColonistArchetype;
        let defaultCommodity: WageCommodity = 'BAR_SOAP';
        if (archetype === 'FORAGER') defaultCommodity = 'FIELD_MUSHROOM';
        if (archetype === 'MINER') defaultCommodity = 'COPPER_INGOT';
        if (archetype === 'HERBALIST') defaultCommodity = 'WILLOW_TEA';

        this.options.onRecruit?.({
          name: `${archetype} ${Math.floor(Math.random() * 900) + 100}`,
          archetype,
          wageContract: { commodity: defaultCommodity, dailyAmount: 1 },
        });
      });
    });
  }

  private lastColonistsDigest = '';

  private renderDock(): void {
    if (!this.colonyState) return;
    if (!this.dockContainer || typeof this.dockContainer.querySelector !== 'function') return;

    // Skip DOM updates if the container is hidden/detached
    if (this.dockContainer.offsetParent === null) return;

    // Quick digest of colonist status, jobs, wages, morale to prevent full rebuilds when unchanged
    const digest = this.colonyState.colonists
      .map(c => `${c.id}:${c.status}:${c.assignedJob?.speciesId}:${c.morale}`)
      .join('|');
    if (digest === this.lastColonistsDigest) return;
    this.lastColonistsDigest = digest;

    const rosterCount = this.dockContainer.querySelector('.roster-count');
    if (rosterCount) rosterCount.textContent = String(this.colonyState.colonists.length);

    const rosterList = this.dockContainer.querySelector('.colonist-roster-list');
    if (!rosterList) return;

    if (this.colonyState.colonists.length === 0) {
      rosterList.innerHTML = `<p class="empty-roster">No colonists recruited yet. Visit the Guild to hire laborers.</p>`;
      return;
    }

    const jobOptions: Array<{ label: string; value: string }> = [];
    for (const cat of BIOME_DAG) {
      for (const sp of cat.species) {
        for (const p of sp.parts) {
          jobOptions.push({
            label: `${sp.name} - ${p.name}`,
            value: `${sp.id}::${p.id}`,
          });
        }
      }
    }

    const wageCommodities = WAGE_COMMODITIES;

    if (
      typeof document !== 'undefined' &&
      rosterList.contains(document.activeElement) &&
      document.activeElement?.tagName === 'SELECT'
    ) {
      return;
    }

    rosterList.innerHTML = this.colonyState.colonists
      .map((c) => {
        const activeJobKey = c.assignedJob ? `${c.assignedJob.speciesId}::${c.assignedJob.partId}` : '';
        const isStrike = c.status === 'STRIKE';
        const color = getArchetypeColor(c.archetype);

        const safeName = escapeHtml(c.name);
        const safeArchetype = escapeHtml(c.archetype);

        return `
        <div class="colonist-card ${isStrike ? 'card-strike' : ''}" data-colonist-id="${escapeHtml(c.id)}">
          <div class="colonist-head">
            <span class="archetype-badge" style="background: ${color}"></span>
            <strong class="colonist-name">${safeName}</strong>
            <span class="colonist-archetype">${safeArchetype}</span>
            <span class="status-pill status-${c.status.toLowerCase()}">${isStrike ? '✊ STRIKE' : escapeHtml(c.status)}</span>
          </div>

          <div class="morale-bar-track" title="Morale: ${c.morale}%">
            <div class="morale-bar-fill ${c.morale < 25 ? 'low' : ''}" style="width: ${c.morale}%"></div>
          </div>

          <div class="colonist-controls">
            <div class="control-row">
              <label>Job:</label>
              <select data-job-colonist="${escapeHtml(c.id)}" class="select-job" aria-label="Assign Job">
                <option value="">-- Idle at Camp --</option>
                ${jobOptions
                  .map(
                    (opt) => `
                  <option value="${opt.value}" ${opt.value === activeJobKey ? 'selected' : ''}>
                    ${opt.label}
                  </option>
                `,
                  )
                  .join('')}
              </select>
            </div>

            <div class="control-row">
              <label>Wage:</label>
              <select data-wage-colonist="${escapeHtml(c.id)}" class="select-wage" aria-label="Wage Commodity">
                ${wageCommodities
                  .map(
                    (comm) => `
                  <option value="${comm}" ${comm === c.wageContract.commodity ? 'selected' : ''}>
                    1x ${comm}
                  </option>
                `,
                  )
                  .join('')}
              </select>
            </div>

            <div class="stimulant-bar">
              <span class="stim-label">Dose:</span>
              <button class="btn btn-micro" data-action="stimulant" data-colonist-id="${escapeHtml(c.id)}" data-stimulant="WILLOW_TEA" title="Willow Tea (+25% speed)">Tea</button>
              <button class="btn btn-micro" data-action="stimulant" data-colonist-id="${escapeHtml(c.id)}" data-stimulant="MINT_TONIC" title="Mint Tonic (+40% speed)">Mint</button>
              <button class="btn btn-micro" data-action="stimulant" data-colonist-id="${escapeHtml(c.id)}" data-stimulant="NITROUS_TONIC" title="Nitrous Tonic (+60% speed)">Ether</button>
            </div>
          </div>
        </div>
      `;
      })
      .join('');

    rosterList.querySelectorAll<HTMLSelectElement>('[data-job-colonist]').forEach((select) => {
      select.addEventListener('change', () => {
        const colonistId = select.dataset.jobColonist!;
        const val = select.value;
        if (!val) {
          const colonist = this.colonyState?.colonists.find((c) => c.id === colonistId);
          if (colonist) {
            colonist.assignedJob = null;
            colonist.status = 'IDLE';
          }
          this.options.onAssignJob?.(colonistId, '', '');
          return;
        }
        const [speciesId, partId] = val.split('::');
        this.options.onAssignJob?.(colonistId, speciesId, partId);
      });
    });

    rosterList.querySelectorAll<HTMLSelectElement>('[data-wage-colonist]').forEach((select) => {
      select.addEventListener('change', () => {
        const colonistId = select.dataset.wageColonist!;
        const commodity = select.value;
        this.options.onSetWageContract?.(colonistId, { commodity, dailyAmount: 1 });
      });
    });

    rosterList.querySelectorAll<HTMLButtonElement>('[data-action="stimulant"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const colonistId = btn.dataset.colonistId!;
        const stimulant = btn.dataset.stimulant!;
        this.options.onAdministerStimulant?.(colonistId, stimulant);
      });
    });
  }
}
