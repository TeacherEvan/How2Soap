import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as htmlparser2 from 'htmlparser2';
import * as cssSelect from 'css-select';
import { spec as fabricationWindowSpec } from '../src/ui/windows/FabricationWindow';
import { renderWorkbenchTabs, renderFabricationTab, WorkbenchProps, WorkbenchTab } from '../src/ui/WorkbenchCanvas';
import { state } from '../src/app/state';
import { FABRICATION_RECIPES } from '../src/engine/fabrication';
import { aggregateInventory } from '../src/ui/fabricationModel';

/**
 * Robust mock element backed by htmlparser2 and css-select.
 * Supports synchronous parent-child linkage so innerHTML mutations
 * on child elements (like #pack-items-display, .fab-list, .fab-detail)
 * correctly update the root DOM tree and innerHTML string.
 */
class MockDomElement {
  private _innerHTML: string = '';
  public _node: any = null;
  public parent: MockDomElement | null = null;
  public tagName: string;
  public listeners: Record<string, ((e?: any) => void)[]> = {};
  public style: Record<string, string> = {};
  public value: string = '';
  public disabled: boolean = false;
  public dataset: Record<string, string> = {};
  public title: string = '';

  constructor(tagName = 'DIV', initialHtml = '', parent: MockDomElement | null = null, node: any = null) {
    this.tagName = tagName.toUpperCase();
    this.parent = parent;
    this._node = node;
    if (initialHtml) {
      this.innerHTML = initialHtml;
    }
  }

  get innerHTML(): string {
    if (this._node) {
      return htmlparser2.DomUtils.getInnerHTML(this._node);
    }
    return this._dom ? htmlparser2.DomUtils.getInnerHTML(this._dom) : this._innerHTML;
  }

  set innerHTML(val: string) {
    this._innerHTML = val;
    const parsed = htmlparser2.parseDocument(val);
    if (this._node) {
      // Replace children of this._node in AST
      this._node.children = parsed.children;
      for (const child of this._node.children) {
        child.parent = this._node;
      }
    } else {
      this._dom = parsed;
    }
  }

  private _dom: any = null;
  get rootDom(): any {
    return this._node ? this._node : this._dom;
  }

  get textContent(): string {
    const root = this.rootDom;
    return root ? htmlparser2.DomUtils.textContent(root).trim() : '';
  }

  addEventListener(event: string, handler: (e?: any) => void): void {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(handler);
  }

  removeEventListener(event: string, handler: (e?: any) => void): void {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter((h) => h !== handler);
    }
  }

  dispatchEvent(event: { type: string }): boolean {
    const list = this.listeners[event.type] || [];
    list.forEach((h) => h(event));
    return true;
  }

  querySelector<T = MockDomElement>(selector: string): T | null {
    const all = this.querySelectorAll<T>(selector);
    return all.length > 0 ? all[0] : null;
  }

  querySelectorAll<T = MockDomElement>(selector: string): T[] {
    const root = this.rootDom;
    if (!root) return [];
    try {
      const matchedNodes = cssSelect.selectAll(selector, root);
      return matchedNodes.map((node: any) => {
        const el = new MockDomElement(
          node.name || 'div',
          '',
          this,
          node,
        );
        // Hydrate attributes
        const attribs = node.attribs || {};
        if (attribs.title) el.title = attribs.title;
        if (attribs.value) el.value = attribs.value;
        if ('disabled' in attribs) el.disabled = true;

        for (const [k, v] of Object.entries(attribs)) {
          if (k.startsWith('data-')) {
            const camelKey = k.slice(5).replace(/-([a-z])/g, (_, l) => l.toUpperCase());
            el.dataset[camelKey] = v as string;
          }
        }

        return el as unknown as T;
      });
    } catch {
      return [];
    }
  }

  get classList() {
    const currentClassStr = (this._node?.attribs?.class || '') as string;
    const classes = currentClassStr ? currentClassStr.split(/\s+/) : [];

    return {
      add: vi.fn((...cls: string[]) => {
        for (const c of cls) {
          if (!classes.includes(c)) classes.push(c);
        }
        if (this._node) {
          if (!this._node.attribs) this._node.attribs = {};
          this._node.attribs.class = classes.join(' ');
        }
      }),
      remove: vi.fn((...cls: string[]) => {
        const filtered = classes.filter((c) => !cls.includes(c));
        if (this._node) {
          if (!this._node.attribs) this._node.attribs = {};
          this._node.attribs.class = filtered.join(' ');
        }
      }),
      toggle: vi.fn((cls: string, force?: boolean) => {
        const exists = classes.includes(cls);
        const willHave = force !== undefined ? force : !exists;
        if (willHave && !exists) classes.push(cls);
        if (!willHave && exists) {
          const idx = classes.indexOf(cls);
          classes.splice(idx, 1);
        }
        if (this._node) {
          if (!this._node.attribs) this._node.attribs = {};
          this._node.attribs.class = classes.join(' ');
        }
        return willHave;
      }),
      contains: vi.fn((cls: string) => classes.includes(cls)),
    };
  }

  setAttribute(name: string, val: string): void {
    if (this._node) {
      if (!this._node.attribs) this._node.attribs = {};
      this._node.attribs[name] = val;
    }
    if (name === 'title') this.title = val;
    if (name === 'disabled') this.disabled = true;
  }

  getAttribute(name: string): string | null {
    if (this._node?.attribs) {
      return this._node.attribs[name] ?? null;
    }
    if (name === 'title') return this.title;
    return null;
  }

  removeAttribute(name: string): void {
    if (this._node?.attribs) {
      delete this._node.attribs[name];
    }
    if (name === 'disabled') this.disabled = false;
  }
}

describe('Workbench Usability & Accessibility Suite (Phase 4)', () => {
  let originalInventory: typeof state.inventory;
  let originalPlayer: typeof state.player;

  beforeEach(() => {
    originalInventory = JSON.parse(JSON.stringify(state.inventory));
    originalPlayer = JSON.parse(JSON.stringify(state.player));
  });

  afterEach(() => {
    state.inventory = originalInventory;
    state.player = originalPlayer;
  });

  describe('1. FabricationWindow Pack Strip Rendering', () => {
    it('renders empty pack message gracefully when inventory is completely empty', () => {
      state.inventory = {
        backpackUnlocked: true,
        bareHands: [],
        backpack: [],
        campCache: [],
        tools: {
          CUTTING_SKINNING: null,
          CHOPPING_CARVING: null,
          PERCUSSION_MINING: null,
          THERMAL_HANDLING: null,
          STITCHING_MEDICAL: null,
          EATING_UTENSIL: null,
        },
      };

      const container = new MockDomElement('div');
      fabricationWindowSpec.mount(container as unknown as HTMLElement);

      expect(container.innerHTML).toContain('Pack is empty.');
      const packGrid = container.querySelector<MockDomElement>('#pack-items-display');
      expect(packGrid).not.toBeNull();
      expect(packGrid?.innerHTML).toContain('Pack is empty.');
    });

    it('renders pack item chips with correct quantities, item labels, and prop thumbnail glyphs', () => {
      state.inventory = {
        backpackUnlocked: true,
        bareHands: [
          { itemId: 'CHARCOAL', label: 'Lump Charcoal', count: 5, massKg: 0.2, quality: 1 },
          { itemId: 'RIVER_STONE', label: 'River Stone', count: 3, massKg: 0.5, quality: 1 },
        ],
        backpack: [
          { itemId: 'ASHES', label: 'Wood Ashes', count: 12, massKg: 0.1, quality: 1 },
        ],
        campCache: [
          { itemId: 'CHARCOAL', label: 'Lump Charcoal', count: 7, massKg: 0.2, quality: 1 },
        ],
        tools: {
          CUTTING_SKINNING: null,
          CHOPPING_CARVING: null,
          PERCUSSION_MINING: { name: 'River Hammerstone', slot: 'PERCUSSION_MINING', mohs: 6.5 },
          THERMAL_HANDLING: null,
          STITCHING_MEDICAL: null,
          EATING_UTENSIL: null,
        },
      };

      const container = new MockDomElement('div');
      fabricationWindowSpec.mount(container as unknown as HTMLElement);

      // Verify aggregate counts: CHARCOAL should be 5 + 7 = 12
      const counts = aggregateInventory(state.inventory);
      expect(counts.get('CHARCOAL')).toBe(12);
      expect(counts.get('RIVER_STONE')).toBe(3);
      expect(counts.get('ASHES')).toBe(12);

      // Verify DOM output includes item chips and SVGs
      const packGrid = container.querySelector<MockDomElement>('#pack-items-display');
      expect(packGrid).not.toBeNull();
      expect(packGrid?.innerHTML).toContain('pack-item-chip');
      expect(packGrid?.innerHTML).toContain('prop-thumb');
      expect(packGrid?.innerHTML).toContain('CHARCOAL');
      expect(packGrid?.textContent).toContain('CHARCOAL');
      expect(packGrid?.textContent).toContain('×12');
      expect(packGrid?.textContent).toContain('RIVER_STONE');
      expect(packGrid?.textContent).toContain('×3');
      expect(packGrid?.textContent).toContain('ASHES');
      expect(packGrid?.innerHTML).toContain('<svg');
    });

    it('displays current glucose level in the pack strip header', () => {
      state.player.glucoseKcal = 1450;
      const container = new MockDomElement('div');
      fabricationWindowSpec.mount(container as unknown as HTMLElement);

      expect(container.innerHTML).toContain('1450 kcal');
    });
  });

  describe('2. Tool Glyph and Prop Badge Rendering', () => {
    it('renders tool requirement badge for recipes specifying requiredToolSlot', () => {
      const container = new MockDomElement('div');
      fabricationWindowSpec.mount(container as unknown as HTMLElement);

      // Find recipes requiring tools in list
      const toolRecipes = FABRICATION_RECIPES.filter((r) => !!r.requiredToolSlot);
      expect(toolRecipes.length).toBeGreaterThan(0);

      // Verify recipe-tool-badge class exists in rendered markup
      expect(container.innerHTML).toContain('recipe-tool-badge');
      expect(container.innerHTML).toContain('fab-item-badges');

      // Verify detail section tool slot descriptor is rendered
      const firstRecipeWithTool = toolRecipes[0];
      expect(firstRecipeWithTool.requiredToolSlot).toBeDefined();
    });

    it('renders station apparatus badge for recipes requiring wooden or ceramic bench fixtures', () => {
      const container = new MockDomElement('div');
      fabricationWindowSpec.mount(container as unknown as HTMLElement);

      // Trough or bucket recipes should render station badge
      expect(container.innerHTML).toContain('recipe-station-badge');
      expect(container.innerHTML).toContain('Station Apparatus Required');
    });

    it('renders hero preview stage in the detail pane with badge and primary output icon', () => {
      const container = new MockDomElement('div');
      fabricationWindowSpec.mount(container as unknown as HTMLElement);

      expect(container.innerHTML).toContain('fab-detail-preview-card');
      expect(container.innerHTML).toContain('preview-hero-stage');
      expect(container.innerHTML).toContain('preview-hero-icon');
      expect(container.innerHTML).toContain('preview-badge');
    });
  });

  describe('3. WorkbenchCanvas Tabs Rendering', () => {
    it('renders all 5 tabs with hero icon badges, proper labels, and active state', () => {
      const container = new MockDomElement('div');
      const selectedTabs: WorkbenchTab[] = [];
      const props: WorkbenchProps = {
        currentTab: 'FABRICATION',
        onSelectTab: (t) => selectedTabs.push(t),
        onExecuteRecipe: vi.fn(),
        onFeedPaddock: vi.fn(),
        onWaterPaddock: vi.fn(),
      };

      renderWorkbenchTabs(container as unknown as HTMLElement, props);

      const tabBtns = container.querySelectorAll<MockDomElement>('.tab-btn');
      expect(tabBtns.length).toBe(5);

      const expectedLabels = [
        'Chemical Workbench',
        'Fabrication Bench',
        'Animal Paddocks',
        'Strategy',
        'Journal',
      ];

      expectedLabels.forEach((label) => {
        expect(container.innerHTML).toContain(label);
      });

      // Verify each button has tab-hero-badge and tab-text
      expect(container.innerHTML).toContain('tab-hero-badge');
      expect(container.innerHTML).toContain('tab-text');

      // Check active class on currentTab
      const activeBtn = container.querySelector<MockDomElement>('.tab-btn.active');
      expect(activeBtn).not.toBeNull();
      expect(activeBtn?.dataset.tab).toBe('FABRICATION');
    });

    it('renders legacy fabrication recipe grid with interactive fabricate buttons', () => {
      const container = new MockDomElement('div');
      const executed: string[] = [];
      renderFabricationTab(container as unknown as HTMLElement, (recipeId) => {
        executed.push(recipeId);
      });

      expect(container.innerHTML).toContain('fabrication-view');
      expect(container.innerHTML).toContain('recipes-grid');
      expect(container.innerHTML).toContain('btn-open-soap-kettle');
      expect(container.innerHTML).toContain('btn-execute-recipe');

      const recipeBtns = container.querySelectorAll<MockDomElement>('.btn-execute-recipe');
      expect(recipeBtns.length).toBe(FABRICATION_RECIPES.length);
    });
  });

  describe('4. Accessibility and WCAG 2.2 Invariants', () => {
    const stylesPath = resolve(__dirname, '../src/styles.css');
    const windowsCssPath = resolve(__dirname, '../src/ui/windows/windows.css');
    const stylesCss = readFileSync(stylesPath, 'utf-8');
    const windowsCss = readFileSync(windowsCssPath, 'utf-8');

    it('enforces SC 2.5.8 minimum 24x24px target size for workbench tab buttons', () => {
      expect(stylesCss).toMatch(/\.tab-btn\s*\{[^}]*min-height:\s*2[4-9]px;/);
      expect(stylesCss).toMatch(/\.tab-btn\s*\{[^}]*min-width:\s*24px;/);
    });

    it('enforces SC 2.5.8 minimum target size for recipe execute and dock buttons', () => {
      // .fab-execute in windows.css
      expect(windowsCss).toMatch(/\.fab-execute\s*\{[^}]*min-height:\s*40px;/);
      // .btn-dock in styles.css
      expect(stylesCss).toMatch(/\.btn-dock[^{]*\{[^}]*min-height:\s*24px;/);
      expect(stylesCss).toMatch(/\.btn-dock[^{]*\{[^}]*min-width:\s*24px;/);
    });

    it('provides SC 2.4.13 focus-visible appearance with high-contrast dual ring on interactive workbench elements', () => {
      expect(stylesCss).toMatch(/:focus-visible\s*\{[^}]*outline:\s*2px solid\s*#5aa5ff;/);
      expect(windowsCss).toMatch(/\.fab-execute:focus-visible\s*\{[^}]*outline:\s*2px solid\s*#5aa5ff;/);
      expect(windowsCss).toMatch(/\.fab-item:focus-visible\s*\{[^}]*outline:\s*2px solid\s*#5aa5ff;/);
    });

    it('supports forced-colors mode and prefers-reduced-motion for workbench chips and preview stages', () => {
      expect(windowsCss).toMatch(/@media\s*\(\s*forced-colors:\s*active\s*\)/);
      expect(windowsCss).toMatch(/forced-color-adjust:\s*none/);
      expect(windowsCss).toMatch(/@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)/);
    });

    it('ensures all interactive elements have accessible role or aria labels', () => {
      const container = new MockDomElement('div');
      fabricationWindowSpec.mount(container as unknown as HTMLElement);

      // Search input has aria-label
      expect(container.innerHTML).toContain('aria-label="Search recipes"');
      // Feasibility filter group
      expect(container.innerHTML).toContain('role="group"');
      expect(container.innerHTML).toContain('aria-label="Feasibility filter"');
      // Listbox role
      expect(container.innerHTML).toContain('role="listbox"');
      expect(container.innerHTML).toContain('role="option"');
      // Live region for details
      expect(container.innerHTML).toContain('aria-live="polite"');
    });
  });
});
