/**
 * Strategy Map Canvas & Labor Command Dock
 *
 * Implements Section 2.1 & 2.2: Diegetic Top-Down 2D Strategy Viewport
 * - Alchemist's field survey styling: dark slate background (#12151c) with coordinate grid lines.
 * - Astrolabe concentric rings at 100m, 300m, 600m, 1200m, 1600m.
 * - Biome resource nodes placed at getSpeciesWorldPosition(speciesId).
 * - Camp Hearth at (0, 0) with glowing radial halo.
 * - Emergent desire path erosion tracks rendered as alpha-blended trails.
 * - Diurnal sky & lighting tint overlay based on minuteOfDay.
 * - Colonist tokens with archetype colors, heading vector, job path, and morale/strike status.
 * - Interactive Command Dock: Colonist Roster, Recruitment Drawer, Stimulant Apothecary, Wage Contract selector.
 */

import {
  type ColonistArchetype,
  type ColonyState,
  type WageContract,
  type WageCommodity,
  GRID_SIZE,
  GRID_HALF_EXTENT,
  CELL_SIZE,
} from '../engine/colony';
import {
  BIOME_DAG,
  getSpeciesWorldPosition,
} from '../data/biomeNodes';

import {
  worldToScreen,
  screenToWorld,
  computeDiurnalLighting,
  computeDesirePathAlpha,
  getArchetypeColor,
  type ViewportState,
  type DiurnalLighting,
} from './mapMath';

// Re-exported for backwards compatibility (tests & external modules).
export {
  worldToScreen,
  screenToWorld,
  computeDiurnalLighting,
  computeDesirePathAlpha,
  getArchetypeColor,
};
export type { ViewportState, DiurnalLighting };

import terrainMapImg from '../assets/tutorial/blender_terrain_map.png';

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
  durationMs: number; // 1200ms
  innerRadius: number; // 12px
  outerRadius: number; // 38px
}

export class StrategyMapCanvas {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private options: StrategyMapCanvasOptions;
  private colonyState: ColonyState | null = null;
  private minuteOfDay = 720;
  private animFrameId: number | null = null;

  public viewport: ViewportState = {
    width: 800,
    height: 500,
    panX: 0,
    panY: 0,
    zoom: 0.22, // Shows roughly [-1600m, +1600m] in 800x500 canvas
  };

  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private panStartX = 0;
  private panStartY = 0;
  private showReliefUnderlay = true;
  private reliefImage: HTMLImageElement | null = null;

  public activeHotspots: MapHotspot[] = [];
  public activeTimingRing: TimingRingStrike | null = null;
  private lastHotspotSpawnMs = 0;

  private dockContainer!: HTMLElement;

  constructor(container: HTMLElement, options: StrategyMapCanvasOptions = {}) {
    this.container = container;
    this.options = options;

    this.container.classList.add('strategy-map-view');
    this.container.innerHTML = `
      <div class="strategy-layout">
        <div class="strategy-viewport-container">
          <canvas class="strategy-map-canvas" tabindex="0" role="application" aria-label="Alchemical Strategy Map"></canvas>
          <div class="map-controls">
            <button class="map-btn btn-relief-toggle" title="Toggle 3D Relief Map" aria-label="Toggle 3D Topographic Relief Underlay">🗺️</button>
            <button class="map-btn btn-zoom-in" title="Zoom In" aria-label="Zoom In">+</button>
            <button class="map-btn btn-zoom-out" title="Zoom Out" aria-label="Zoom Out">−</button>
            <button class="map-btn btn-reset-view" title="Center Hearth" aria-label="Center on Camp Hearth">⌂</button>
          </div>
          <div class="map-legend">
            <span class="legend-chip"><span class="pip pip-forager"></span> Forager</span>
            <span class="legend-chip"><span class="pip pip-miner"></span> Miner</span>
            <span class="legend-chip"><span class="pip pip-herbalist"></span> Herbalist</span>
            <span class="legend-chip"><span class="pip pip-chemist"></span> Chemist</span>
          </div>
        </div>
        <aside class="strategy-dock">
          <div class="dock-section recruitment-drawer">
            <h4>Tavern &amp; Guild Recruitment</h4>
            <div class="recruit-cards">
              <button class="btn recruit-btn" data-recruit-archetype="FORAGER">
                <strong>+ Forager</strong>
                <span class="cost-hint">Fee: 1 Dried Meat / 1 Rowan</span>
              </button>
              <button class="btn recruit-btn" data-recruit-archetype="MINER">
                <strong>+ Miner</strong>
                <span class="cost-hint">Fee: 1 Copper / Bronze</span>
              </button>
              <button class="btn recruit-btn" data-recruit-archetype="HERBALIST">
                <strong>+ Herbalist</strong>
                <span class="cost-hint">Fee: 1 Willow / Mint</span>
              </button>
              <button class="btn recruit-btn" data-recruit-archetype="APPRENTICE_CHEMIST">
                <strong>+ Chemist</strong>
                <span class="cost-hint">Fee: 1 Bar Soap</span>
              </button>
            </div>
          </div>
          <div class="dock-section colonist-roster-drawer">
            <h4>Active Colonist Roster (<span class="roster-count">0</span>)</h4>
            <div class="colonist-roster-list">
              <p class="empty-roster">No colonists recruited yet. Visit the Guild to hire laborers.</p>
            </div>
          </div>
        </aside>
      </div>
    `;

    this.canvas = this.container.querySelector<HTMLCanvasElement>('canvas')!;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2D Canvas context not supported');
    this.ctx = ctx;

    this.dockContainer = this.container.querySelector<HTMLElement>('.strategy-dock')!;

    // Load 3D Relief underlay image
    if (typeof Image !== 'undefined') {
      const img = new Image();
      img.src = terrainMapImg;
      img.onload = () => {
        this.reliefImage = img;
      };
    }

    this.setupEvents();
    this.resizeCanvas();
    this.startRenderLoop();
  }

  public resizeCanvas(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = rect.width > 0 ? rect.width : 800;
    const h = rect.height > 0 ? rect.height : 500;

    this.viewport.width = w;
    this.viewport.height = h;

    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.ctx.resetTransform?.();
    this.ctx.scale(dpr, dpr);
  }

  public update(colony: ColonyState, minuteOfDay: number): void {
    this.colonyState = colony;
    this.minuteOfDay = minuteOfDay;
    this.renderDock();
  }

  private onWindowResize = () => this.resizeCanvas();
  private onWindowMouseMove = (e: MouseEvent) => {
    if (!this.isDragging) return;
    const dx = e.clientX - this.dragStartX;
    const dy = e.clientY - this.dragStartY;
    this.viewport.panX = this.panStartX + dx;
    this.viewport.panY = this.panStartY + dy;
  };
  private onWindowMouseUp = () => {
    this.isDragging = false;
  };

  private setupEvents(): void {
    // Window resize
    window.addEventListener('resize', this.onWindowResize);

    // Canvas Mouse / Wheel Pan and Zoom
    this.canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.panStartX = this.viewport.panX;
      this.panStartY = this.viewport.panY;

      // Check click on Biome node for timing ring or hotspot
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      this.handleNodeClick(mouseX, mouseY);
    });

    window.addEventListener('mousemove', this.onWindowMouseMove);

    window.addEventListener('mouseup', this.onWindowMouseUp);

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      const newZoom = Math.min(2.5, Math.max(0.08, this.viewport.zoom * zoomFactor));

      // Zoom toward cursor
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const worldBefore = screenToWorld(mouseX, mouseY, this.viewport);
      this.viewport.zoom = newZoom;
      const screenAfter = worldToScreen(worldBefore.x, worldBefore.y, this.viewport);

      this.viewport.panX += mouseX - screenAfter.x;
      this.viewport.panY += mouseY - screenAfter.y;
    }, { passive: false });

    // Buttons: Zoom In, Zoom Out, Reset
    this.container.querySelector('.btn-relief-toggle')?.addEventListener('click', () => {
      this.showReliefUnderlay = !this.showReliefUnderlay;
    });
    this.container.querySelector('.btn-zoom-in')?.addEventListener('click', () => {
      this.viewport.zoom = Math.min(2.5, this.viewport.zoom * 1.25);
    });
    this.container.querySelector('.btn-zoom-out')?.addEventListener('click', () => {
      this.viewport.zoom = Math.max(0.08, this.viewport.zoom * 0.8);
    });
    this.container.querySelector('.btn-reset-view')?.addEventListener('click', () => {
      this.viewport.panX = 0;
      this.viewport.panY = 0;
      this.viewport.zoom = 0.22;
    });

    // Keyboard navigation (WASD, Arrows, +, -, Space)
    if (typeof this.canvas.setAttribute === 'function') {
      this.canvas.setAttribute('tabindex', '0');
    }
    this.canvas.addEventListener?.('keydown', (e: KeyboardEvent) => {
      const panStep = 40;
      if (e.key === 'w' || e.key === 'ArrowUp') {
        this.viewport.panY += panStep;
      } else if (e.key === 's' || e.key === 'ArrowDown') {
        this.viewport.panY -= panStep;
      } else if (e.key === 'a' || e.key === 'ArrowLeft') {
        this.viewport.panX += panStep;
      } else if (e.key === 'd' || e.key === 'ArrowRight') {
        this.viewport.panX -= panStep;
      } else if (e.key === '+' || e.key === '=') {
        this.viewport.zoom = Math.min(2.5, this.viewport.zoom * 1.2);
      } else if (e.key === '-' || e.key === '_') {
        this.viewport.zoom = Math.max(0.08, this.viewport.zoom * 0.8);
      } else if (e.key === ' ') {
        e.preventDefault();
        this.viewport.panX = 0;
        this.viewport.panY = 0;
        this.viewport.zoom = 0.22;
      }
    });

    // Recruitment buttons
    this.container.querySelectorAll<HTMLButtonElement>('[data-recruit-archetype]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const archetype = btn.dataset.recruitArchetype as ColonistArchetype;
        if (!archetype) return;

        let name = 'Worker';
        let defaultCommodity: WageCommodity = 'BAR_SOAP';
        if (archetype === 'FORAGER') {
          name = 'Forager ' + (Math.floor(Math.random() * 900) + 100);
          defaultCommodity = 'FIELD_MUSHROOM';
        } else if (archetype === 'MINER') {
          name = 'Miner ' + (Math.floor(Math.random() * 900) + 100);
          defaultCommodity = 'COPPER_INGOT';
        } else if (archetype === 'HERBALIST') {
          name = 'Herbalist ' + (Math.floor(Math.random() * 900) + 100);
          defaultCommodity = 'WILLOW_TEA';
        } else if (archetype === 'APPRENTICE_CHEMIST') {
          name = 'Chemist ' + (Math.floor(Math.random() * 900) + 100);
          defaultCommodity = 'BAR_SOAP';
        }

        this.options.onRecruit?.({
          name,
          archetype,
          wageContract: { commodity: defaultCommodity, dailyAmount: 1 },
        });
      });
    });
  }

  private startRenderLoop(): void {
    const loop = () => {
      // Skip heavy 60Hz canvas redraws if container is hidden in tab view
      if (!this.container.classList.contains('hidden') && this.container.offsetParent !== null) {
        this.renderCanvas();
      }
      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  public renderCanvas(): void {
    const { ctx, viewport, minuteOfDay } = this;
    const { width, height } = viewport;

    ctx.save();
    // 1. Dark slate field survey background
    ctx.fillStyle = '#12151c';
    ctx.fillRect(0, 0, width, height);

    // 1b. Optional 3D Topographic Relief Underlay rendered from Blender
    if (this.showReliefUnderlay && this.reliefImage) {
      const origin = worldToScreen(0, 0, viewport);
      const reliefRadius = 1600 * viewport.zoom;
      ctx.save();
      ctx.beginPath();
      ctx.arc(origin.x, origin.y, reliefRadius, 0, Math.PI * 2);
      ctx.clip();
      ctx.globalAlpha = 0.45;
      ctx.drawImage(
        this.reliefImage,
        origin.x - reliefRadius,
        origin.y - reliefRadius,
        reliefRadius * 2,
        reliefRadius * 2,
      );
      ctx.restore();
    }

    // 2. Subtle coordinate grid lines (every 200m)
    ctx.strokeStyle = 'rgba(38, 50, 59, 0.45)';
    ctx.lineWidth = 1;
    const stepMeters = 200;
    const minW = screenToWorld(0, 0, viewport);
    const maxW = screenToWorld(width, height, viewport);

    const startX = Math.floor(minW.x / stepMeters) * stepMeters;
    const endX = Math.ceil(maxW.x / stepMeters) * stepMeters;
    const startY = Math.floor(minW.y / stepMeters) * stepMeters;
    const endY = Math.ceil(maxW.y / stepMeters) * stepMeters;

    ctx.beginPath();
    for (let x = startX; x <= endX; x += stepMeters) {
      const s = worldToScreen(x, 0, viewport);
      ctx.moveTo(s.x, 0);
      ctx.lineTo(s.x, height);
    }
    for (let y = startY; y <= endY; y += stepMeters) {
      const s = worldToScreen(0, y, viewport);
      ctx.moveTo(0, s.y);
      ctx.lineTo(width, s.y);
    }
    ctx.stroke();

    // 3. Astrolabe concentric range rings: 100m, 300m, 600m, 1200m, 1600m
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

      // Ring distance label
      ctx.fillStyle = 'rgba(224, 164, 88, 0.45)';
      ctx.font = '9px monospace';
      ctx.fillText(`${r}m`, origin.x + screenRadius + 4, origin.y - 2);
    }

    // 4. Desire path heatmap rendering from desirePathGrid
    if (this.colonyState?.desirePathGrid) {
      const grid = this.colonyState.desirePathGrid;
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          const val = grid[r * GRID_SIZE + c];
          if (val > 4) {
            const alpha = computeDesirePathAlpha(val);
            const wx = -GRID_HALF_EXTENT + c * CELL_SIZE;
            const wy = -GRID_HALF_EXTENT + r * CELL_SIZE;
            const s = worldToScreen(wx, wy, viewport);
            const sw = CELL_SIZE * viewport.zoom;
            const sh = CELL_SIZE * viewport.zoom;

            ctx.fillStyle = `rgba(210, 150, 80, ${alpha})`;
            ctx.fillRect(s.x, s.y, sw, sh);
          }
        }
      }
    }

    // 5. Biome resource nodes placed at getSpeciesWorldPosition
    const nowMs = Date.now();
    // Spawn periodic 30s bonus hotspot every 45s
    if (nowMs - this.lastHotspotSpawnMs > 45000) {
      this.lastHotspotSpawnMs = nowMs;
      const allSpecies = BIOME_DAG.flatMap(c => c.species);
      const chosen = allSpecies[Math.floor(Math.random() * allSpecies.length)];
      if (chosen && !this.activeHotspots.some(h => h.speciesId === chosen.id)) {
        this.activeHotspots.push({
          id: `hotspot_${nowMs}`,
          speciesId: chosen.id,
          name: chosen.name,
          expiresAtMs: nowMs + 30000,
        });
      }
    }
    // Filter expired hotspots
    this.activeHotspots = this.activeHotspots.filter(h => h.expiresAtMs > nowMs);

    for (const cat of BIOME_DAG) {
      for (const sp of cat.species) {
        const pos = getSpeciesWorldPosition(sp);
        const s = worldToScreen(pos.x, pos.y, viewport);

        // Check if hotspot active on this node
        const isHotspot = this.activeHotspots.some(h => h.speciesId === sp.id);

        if (isHotspot) {
          ctx.beginPath();
          ctx.arc(s.x, s.y, 14, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 215, 0, 0.35)';
          ctx.fill();
          ctx.strokeStyle = '#ffd700';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Node circle
        ctx.beginPath();
        ctx.arc(s.x, s.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = isHotspot ? '#ffd700' : cat.key === 'TREES' ? '#4caf50'
          : cat.key === 'ROCKS_MINERALS' ? '#e0a458'
          : cat.key === 'MUSHROOMS_FLORA' ? '#9c27b0'
          : '#ff9800';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Label
        ctx.fillStyle = isHotspot ? '#ffe57f' : '#dce6ec';
        ctx.font = isHotspot ? 'bold 10px serif' : '10px serif';
        ctx.fillText(isHotspot ? `★ ${sp.name} (3x!)` : sp.name, s.x + 8, s.y + 3);
      }
    }

    // Render active timing ring strike if any
    if (this.activeTimingRing) {
      const elapsed = nowMs - this.activeTimingRing.startMs;
      if (elapsed > this.activeTimingRing.durationMs) {
        this.activeTimingRing = null;
      } else {
        const progress = elapsed / this.activeTimingRing.durationMs;
        const currentRadius = this.activeTimingRing.outerRadius - progress * (this.activeTimingRing.outerRadius - this.activeTimingRing.innerRadius);
        const ringPos = worldToScreen(this.activeTimingRing.worldX, this.activeTimingRing.worldY, viewport);

        // Inner target circle
        ctx.beginPath();
        ctx.arc(ringPos.x, ringPos.y, this.activeTimingRing.innerRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(76, 175, 80, 0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Contracting outer ring
        ctx.beginPath();
        ctx.arc(ringPos.x, ringPos.y, Math.max(1, currentRadius), 0, Math.PI * 2);
        const inPerfectZone = progress >= 0.70 && progress <= 0.98;
        ctx.strokeStyle = inPerfectZone ? '#4caf50' : '#ffd700';
        ctx.lineWidth = inPerfectZone ? 3 : 2;
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText(inPerfectZone ? 'STRIKE NOW!' : 'Harvesting...', ringPos.x - 24, ringPos.y - 18);
      }
    }

    // 6. Camp Hearth at (0, 0)
    const diurnal = computeDiurnalLighting(minuteOfDay);
    const hearthGrad = ctx.createRadialGradient(
      origin.x,
      origin.y,
      4,
      origin.x,
      origin.y,
      diurnal.hearthRadiusPx,
    );
    hearthGrad.addColorStop(0, 'rgba(255, 170, 50, 0.85)');
    hearthGrad.addColorStop(0.3, 'rgba(230, 90, 20, 0.45)');
    hearthGrad.addColorStop(1, 'rgba(230, 90, 20, 0)');
    ctx.fillStyle = hearthGrad;
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, diurnal.hearthRadiusPx, 0, Math.PI * 2);
    ctx.fill();

    // Camp Hearth center icon
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

    // 7. Colonists tokens & Job path polyline
    if (this.colonyState?.colonists) {
      for (const c of this.colonyState.colonists) {
        const s = worldToScreen(c.position.x, c.position.y, viewport);

        // Heading / Job path line
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

        // Colonist token
        const color = getArchetypeColor(c.archetype);
        ctx.beginPath();
        ctx.arc(s.x, s.y, 7, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = c.status === 'STRIKE' ? '#d96c6c' : '#ffffff';
        ctx.lineWidth = c.status === 'STRIKE' ? 2 : 1;
        ctx.stroke();

        // Stimulant aura
        if (c.activeStimulant?.phase === 'BOOST') {
          ctx.beginPath();
          ctx.arc(s.x, s.y, 11, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255, 235, 59, 0.8)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // Name & status tag
        ctx.fillStyle = '#fff';
        ctx.font = '9px sans-serif';
        const statusText = c.status === 'STRIKE' ? '✊ STRIKE' : c.status;
        ctx.fillText(`${c.name} (${statusText})`, s.x + 9, s.y - 2);
      }
    }

    // 8. Diurnal sky lighting tint overlay
    ctx.fillStyle = diurnal.colorTint;
    ctx.fillRect(0, 0, width, height);

    ctx.restore();
  }

  private handleNodeClick(screenX: number, screenY: number): void {
    const now = Date.now();

    // Check if second click on active timing ring
    if (this.activeTimingRing) {
      const ringPos = worldToScreen(this.activeTimingRing.worldX, this.activeTimingRing.worldY, this.viewport);
      const dist = Math.hypot(screenX - ringPos.x, screenY - ringPos.y);
      if (dist <= 45) {
        const elapsed = now - this.activeTimingRing.startMs;
        const progress = elapsed / this.activeTimingRing.durationMs;
        // Perfect timing band: 0.70 to 0.95
        const isPerfect = progress >= 0.70 && progress <= 0.98;
        if (this.options.onHarvestBoost) {
          this.options.onHarvestBoost(this.activeTimingRing.speciesId, isPerfect);
        }
        this.activeTimingRing = null;
        return;
      }
    }

    // Check click on nodes or hotspots
    for (const cat of BIOME_DAG) {
      for (const sp of cat.species) {
        const pos = getSpeciesWorldPosition(sp);
        const s = worldToScreen(pos.x, pos.y, this.viewport);
        const dist = Math.hypot(screenX - s.x, screenY - s.y);
        if (dist <= 18) {
          // Check if hotspot clicked
          const hotspotIdx = this.activeHotspots.findIndex(h => h.speciesId === sp.id);
          if (hotspotIdx >= 0) {
            this.activeHotspots.splice(hotspotIdx, 1);
            if (this.options.onHarvestBoost) {
              this.options.onHarvestBoost(sp.id, true);
            }
            return;
          }

          // Trigger 1.2s timing ring strike
          this.activeTimingRing = {
            speciesId: sp.id,
            worldX: pos.x,
            worldY: pos.y,
            startMs: now,
            durationMs: 1200,
            innerRadius: 10,
            outerRadius: 36,
          };
          return;
        }
      }
    }
  }

  private renderDock(): void {
    if (!this.colonyState) return;

    const rosterCount = this.dockContainer.querySelector('.roster-count');
    if (rosterCount) rosterCount.textContent = String(this.colonyState.colonists.length);

    const rosterList = this.dockContainer.querySelector('.colonist-roster-list');
    if (!rosterList) return;

    if (this.colonyState.colonists.length === 0) {
      rosterList.innerHTML = `<p class="empty-roster">No colonists recruited yet. Visit the Guild to hire laborers.</p>`;
      return;
    }

    // Options for job assignments
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

    // Options for wage commodities
    const wageCommodities = [
      'BAR_SOAP',
      'MEAT_RAW',
      'FIELD_MUSHROOM',
      'COPPER_INGOT',
      'WILLOW_TEA',
      'MINT_TONIC',
      'NITROUS_TONIC',
    ];

    // Avoid blowing away open select dropdowns if user is currently interacting with one
    if (typeof document !== 'undefined' && rosterList.contains(document.activeElement) && document.activeElement?.tagName === 'SELECT') {
      return;
    }

    rosterList.innerHTML = this.colonyState.colonists.map((c) => {
      const activeJobKey = c.assignedJob ? `${c.assignedJob.speciesId}::${c.assignedJob.partId}` : '';
      const isStrike = c.status === 'STRIKE';
      const color = getArchetypeColor(c.archetype);

      return `
        <div class="colonist-card ${isStrike ? 'card-strike' : ''}" data-colonist-id="${c.id}">
          <div class="colonist-head">
            <span class="archetype-badge" style="background: ${color}"></span>
            <strong class="colonist-name">${c.name}</strong>
            <span class="colonist-archetype">${c.archetype}</span>
            <span class="status-pill status-${c.status.toLowerCase()}">${isStrike ? '✊ STRIKE' : c.status}</span>
          </div>

          <div class="morale-bar-track" title="Morale: ${c.morale}%">
            <div class="morale-bar-fill ${c.morale < 25 ? 'low' : ''}" style="width: ${c.morale}%"></div>
          </div>

          <div class="colonist-controls">
            <div class="control-row">
              <label>Job:</label>
              <select data-job-colonist="${c.id}" class="select-job" aria-label="Assign Job">
                <option value="">-- Idle at Camp --</option>
                ${jobOptions.map(opt => `
                  <option value="${opt.value}" ${opt.value === activeJobKey ? 'selected' : ''}>
                    ${opt.label}
                  </option>
                `).join('')}
              </select>
            </div>

            <div class="control-row">
              <label>Wage:</label>
              <select data-wage-colonist="${c.id}" class="select-wage" aria-label="Wage Commodity">
                ${wageCommodities.map(comm => `
                  <option value="${comm}" ${comm === c.wageContract.commodity ? 'selected' : ''}>
                    1x ${comm}
                  </option>
                `).join('')}
              </select>
            </div>

            <div class="stimulant-bar">
              <span class="stim-label">Dose:</span>
              <button class="btn btn-micro" data-action="stimulant" data-colonist-id="${c.id}" data-stimulant="WILLOW_TEA" title="Willow Tea (+25% speed)">Tea</button>
              <button class="btn btn-micro" data-action="stimulant" data-colonist-id="${c.id}" data-stimulant="MINT_TONIC" title="Mint Tonic (+40% speed)">Mint</button>
              <button class="btn btn-micro" data-action="stimulant" data-colonist-id="${c.id}" data-stimulant="NITROUS_TONIC" title="Nitrous Tonic (+60% speed)">Ether</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Wire Job assignment change events
    rosterList.querySelectorAll<HTMLSelectElement>('[data-job-colonist]').forEach((select) => {
      select.addEventListener('change', () => {
        const colonistId = select.dataset.jobColonist!;
        const val = select.value;
        if (!val) {
          const colonist = this.colonyState?.colonists.find(c => c.id === colonistId);
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

    // Wire Wage contract change events
    rosterList.querySelectorAll<HTMLSelectElement>('[data-wage-colonist]').forEach((select) => {
      select.addEventListener('change', () => {
        const colonistId = select.dataset.wageColonist!;
        const commodity = select.value;
        this.options.onSetWageContract?.(colonistId, { commodity, dailyAmount: 1 });
      });
    });

    // Wire Stimulant buttons
    rosterList.querySelectorAll<HTMLButtonElement>('[data-action="stimulant"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const colonistId = btn.dataset.colonistId!;
        const stimulant = btn.dataset.stimulant!;
        this.options.onAdministerStimulant?.(colonistId, stimulant);
      });
    });
  }

  public destroy(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    window.removeEventListener('resize', this.onWindowResize);
    window.removeEventListener('mousemove', this.onWindowMouseMove);
    window.removeEventListener('mouseup', this.onWindowMouseUp);
  }
}
