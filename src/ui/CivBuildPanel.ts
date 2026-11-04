/**
 * CivBuildPanel — Civilization VII-style district/quarter construction UI.
 * Left build panel with adjacency/delta arrows, District→Quarter progression,
 * Wonder tier, predictive yield panel on hover.
 *
 * HUD layout (Civ VII canonical):
 *   Top bar: yields (Gold, Food, Science, Culture, Happiness, Influence, Settlement X/Y)
 *   Top-right: Leader banners (collapsible)
 *   Bottom-right: Turn/end-turn + action wheel
 *   Bottom-left: Settlements/production queue
 *   Left panel: contextual build menu
 */

export interface Yields {
  gold: number;
  food: number;
  science: number;
  culture: number;
  happiness: number;
  influence: number;
}

export interface DistrictType {
  id: string;
  name: string;
  icon: string;
  baseYields: Partial<Yields>;
  tags: string[];
  buildTime: number;
}

export interface AdjacencyBonus {
  from: string; // tile label (e.g. 'Copper Vein')
  yield: keyof Yields;
  delta: number; // +2, -1, etc.
}

export class CivBuildPanel {
  private panel: HTMLElement;
  private yieldBar: HTMLElement;
  private adjacency: AdjacencyBonus[] = [];
  private selectedDistrict: DistrictType | null = null;

  constructor(container: HTMLElement) {
    this.panel = document.createElement('div');
    this.panel.className = 'civ-build-panel';
    this.panel.setAttribute('aria-label', 'Build menu');
    container.appendChild(this.panel);

    this.yieldBar = document.createElement('div');
    this.yieldBar.className = 'civ-yield-bar';
    this.yieldBar.setAttribute('aria-label', 'Resource yields');
    container.prepend(this.yieldBar);
  }

  /** Top bar: Gold, Science, Culture, Happiness, Influence, Settlement X/Y. */
  updateYields(yields: Yields, settlementLimit: string) {
    const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
    this.yieldBar.innerHTML = `
      <span class="yield gold">🪙 ${fmt(yields.gold)}</span>
      <span class="yield science">🔬 ${fmt(yields.science)}</span>
      <span class="yield culture">🎭 ${fmt(yields.culture)}</span>
      <span class="yield happiness">😊 ${fmt(yields.happiness)}</span>
      <span class="yield influence">⚖️ ${fmt(yields.influence)}</span>
      <span class="yield settlement">🏘️ ${settlementLimit}</span>
    `;
  }

  /** Left panel: District → 2 build slots = Quarter. */
  showDistricts(districts: DistrictType[]) {
    this.panel.innerHTML = districts.map(d => `
      <button class="district-btn" data-id="${d.id}">
        <span class="district-icon">${d.icon}</span>
        <span class="district-name">${d.name}</span>
        <span class="district-time">${d.buildTime}t</span>
      </button>
    `).join('');

    this.panel.querySelectorAll('.district-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedDistrict = districts.find(d => d.id === (btn as HTMLElement).dataset.id) || null;
        this.showQuarterSlots();
      });
    });
  }

  /** Quarter = District tile + 2 building slots. */
  showQuarterSlots() {
    if (!this.selectedDistrict) return;
    const d = this.selectedDistrict;
    this.panel.innerHTML = `
      <div class="quarter-header">${d.icon} ${d.name} — Quarter</div>
      <div class="slot empty" data-slot="0">Slot 1 — empty (click to build)</div>
      <div class="slot empty" data-slot="1">Slot 2 — empty (click to build)</div>
      <div class="adjacency">${this.renderAdjacency()}</div>
      <button class="wonder-btn">Grand Smelter (Wonder — 1 tile, adjacent to District)</button>
    `;
  }

  private renderAdjacency(): string {
    if (this.adjacency.length === 0) return '<span class="adj-none">No adjacency bonuses — place near resource veins</span>';
    return this.adjacency.map(a => {
      const sign = a.delta >= 0 ? '↑' : '↓';
      const cls = a.delta >= 0 ? 'up' : 'down';
      return `<div class="adj-row ${cls}">${sign} ${a.from}: ${a.yield} ${a.delta >= 0 ? '+' : ''}${a.delta}</div>`;
    }).join('');
  }

  /** Placement mode: hover tile → predicted yields + "place me here" ghost. */
  showPlacementPreview(tileYields: Partial<Yields>, adjacency: AdjacencyBonus[]) {
    this.adjacency = adjacency;
    const arrows = Object.entries(tileYields).map(([k, v]) => {
      const n = v as number;
      const sign = n >= 0 ? '↑' : '↓';
      const cls = n >= 0 ? 'up' : 'down';
      return `<span class="${cls}">${sign} ${k} ${n >= 0 ? '+' : ''}${n}</span>`;
    }).join(' ');
    this.panel.innerHTML = `
      <div class="placement">Place me here — predicted yields:</div>
      <div class="yields">${arrows}</div>
      <div class="adjacency">${this.renderAdjacency()}</div>
    `;
  }
}
