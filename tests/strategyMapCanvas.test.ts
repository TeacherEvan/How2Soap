import { describe, it, expect, vi } from 'vitest';
import {
  worldToScreen,
  screenToWorld,
  computeDiurnalLighting,
  computeDesirePathAlpha,
  getArchetypeColor,
  type ViewportState,
  StrategyMapCanvas,
} from '../src/ui/StrategyMapCanvas';
import { createInitialColonyState, recruitColonist } from '../src/engine/colony';

// Lightweight in-memory DOM mocks for unit testing StrategyMapCanvas in node environment
function createMockElement(tag: string): any {
  const listeners: Record<string, Function[]> = {};
  const children: any[] = [];
  const attributes: Record<string, string> = {};
  const dataset: Record<string, string> = {};
  const classList = {
    classes: new Set<string>(),
    add: (c: string) => classList.classes.add(c),
    remove: (c: string) => classList.classes.delete(c),
    contains: (c: string) => classList.classes.has(c),
  };

  let innerHTMLStr = '';

  const el: any = {
    tagName: tag.toUpperCase(),
    dataset,
    attributes,
    classList,
    style: {},
    children,
    value: '',
    get innerHTML() {
      return innerHTMLStr;
    },
    set innerHTML(val: string) {
      innerHTMLStr = val;
      children.length = 0;
      // Parse basic elements for querySelector matching
      parseSimpleHTML(val, el);
    },
    get textContent() {
      return innerHTMLStr.replace(/<[^>]*>/g, '');
    },
    set textContent(val: string) {
      innerHTMLStr = val;
      children.length = 0;
    },
    addEventListener: (event: string, fn: Function) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(fn);
    },
    removeEventListener: (event: string, fn: Function) => {
      if (!listeners[event]) return;
      listeners[event] = listeners[event].filter(f => f !== fn);
    },
    dispatchEvent: (event: { type: string }) => {
      const fns = listeners[event.type] || [];
      fns.forEach(fn => fn(event));
    },
    click: () => {
      el.dispatchEvent({ type: 'click' });
    },
    querySelector: (selector: string) => {
      return querySelectorMock(el, selector);
    },
    querySelectorAll: (selector: string) => {
      return querySelectorAllMock(el, selector);
    },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 500 }),
    getContext: (type: string) => {
      if (type === '2d') {
        return {
          save: vi.fn(),
          restore: vi.fn(),
          fillRect: vi.fn(),
          beginPath: vi.fn(),
          arc: vi.fn(),
          fill: vi.fn(),
          stroke: vi.fn(),
          moveTo: vi.fn(),
          lineTo: vi.fn(),
          fillText: vi.fn(),
          setLineDash: vi.fn(),
          createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
          scale: vi.fn(),
          resetTransform: vi.fn(),
        };
      }
      return null;
    },
  };

  return el;
}

function parseSimpleHTML(html: string, parent: any) {
  // Regex to match tags: opening, closing, or self-closing
  const tagRegex = /<(\/)?([a-zA-Z0-9_-]+)([\s\S]*?)>/g;
  const stack: any[] = [parent];
  let match;
  while ((match = tagRegex.exec(html)) !== null) {
    const isClosing = Boolean(match[1]);
    const tagName = match[2];
    const attrString = match[3] || '';
    const isSelfClosing = attrString.trim().endsWith('/') || ['input', 'img', 'br', 'hr', 'meta', 'link'].includes(tagName.toLowerCase());

    if (isClosing) {
      if (stack.length > 1 && stack[stack.length - 1].tagName.toLowerCase() === tagName.toLowerCase()) {
        stack.pop();
      }
      continue;
    }

    const child = createMockElement(tagName);
    // Parse attributes
    const attrRegex = /([a-zA-Z0-9_-]+)(?:=["']([^"']*)["'])?/g;
    let attrMatch;
    while ((attrMatch = attrRegex.exec(attrString)) !== null) {
      const attrName = attrMatch[1];
      const attrVal = attrMatch[2] ?? '';
      child.attributes[attrName] = attrVal;
      if (attrName === 'class') {
        attrVal.split(/\s+/).filter(Boolean).forEach(c => child.classList.add(c));
      } else if (attrName.startsWith('data-')) {
        const dataKey = attrName.slice(5).replace(/-([a-z])/g, (_, g) => g.toUpperCase());
        child.dataset[dataKey] = attrVal;
      }
    }
    stack[stack.length - 1].children.push(child);
    if (!isSelfClosing) {
      stack.push(child);
    }
  }
}

function querySelectorMock(root: any, selector: string): any | null {
  const all = querySelectorAllMock(root, selector);
  return all.length > 0 ? all[0] : null;
}

function querySelectorAllMock(root: any, selector: string): any[] {
  const results: any[] = [];

  function matchElement(el: any): boolean {
    if (selector.startsWith('.')) {
      const className = selector.slice(1);
      return el.classList.contains(className);
    }
    // Attribute selector like [data-colonist-id="colonist_1"]
    if (selector.startsWith('[') && selector.endsWith(']')) {
      const inner = selector.slice(1, -1);
      const eqIdx = inner.indexOf('=');
      if (eqIdx !== -1) {
        const attr = inner.slice(0, eqIdx).trim();
        const val = inner.slice(eqIdx + 1).replace(/^["']|["']$/g, '').trim();
        return el.attributes[attr] === val;
      } else {
        return el.attributes[inner] !== undefined;
      }
    }
    if (selector.includes('[')) {
      const tag = selector.split('[')[0];
      if (tag && el.tagName.toLowerCase() !== tag.toLowerCase()) return false;
      const attrPart = selector.slice(tag.length);
      if (attrPart.startsWith('[') && attrPart.endsWith(']')) {
        const inner = attrPart.slice(1, -1);
        const eqIdx = inner.indexOf('=');
        if (eqIdx !== -1) {
          const attr = inner.slice(0, eqIdx).trim();
          const val = inner.slice(eqIdx + 1).replace(/^["']|["']$/g, '').trim();
          return el.attributes[attr] === val;
        } else {
          return el.attributes[inner] !== undefined;
        }
      }
    }
    if (el.tagName.toLowerCase() === selector.toLowerCase()) {
      return true;
    }
    return false;
  }

  function traverse(node: any) {
    for (const child of node.children) {
      if (matchElement(child)) {
        results.push(child);
      }
      traverse(child);
    }
  }

  traverse(root);
  return results;
}

describe('StrategyMapCanvas (Task 4)', () => {
  describe('Projection math (world to screen & screen to world)', () => {
    const viewport: ViewportState = {
      width: 800,
      height: 600,
      panX: 50,
      panY: -30,
      zoom: 1.5,
    };

    it('projects world origin (0,0) to center of canvas plus pan offset', () => {
      const screen = worldToScreen(0, 0, viewport);
      expect(screen.x).toBeCloseTo(450, 4);
      expect(screen.y).toBeCloseTo(270, 4);
    });

    it('inverts screen coordinates back to exact world coordinates across pan and zoom', () => {
      const testPoints = [
        { wx: 0, wy: 0 },
        { wx: -500, wy: 300 },
        { wx: 1200, wy: -800 },
        { wx: -1600, wy: 1600 },
      ];

      for (const pt of testPoints) {
        const screen = worldToScreen(pt.wx, pt.wy, viewport);
        const world = screenToWorld(screen.x, screen.y, viewport);
        expect(world.x).toBeCloseTo(pt.wx, 4);
        expect(world.y).toBeCloseTo(pt.wy, 4);
      }
    });

    it('scales distances proportionally with zoom', () => {
      const p1 = worldToScreen(0, 0, viewport);
      const p2 = worldToScreen(100, 0, viewport);
      expect(p2.x - p1.x).toBeCloseTo(100 * viewport.zoom, 4);
    });
  });

  describe('Diurnal lighting calculation', () => {
    it('returns daylight conditions around noon (minuteOfDay = 720)', () => {
      const noon = computeDiurnalLighting(720);
      expect(noon.ambientAlpha).toBeLessThan(0.15);
      expect(noon.colorTint).toContain('rgba(');
      expect(noon.isNight).toBe(false);
      expect(noon.hearthRadiusPx).toBeGreaterThan(0);
    });

    it('returns deep dark/slate twilight conditions around midnight (minuteOfDay = 0 or 1440)', () => {
      const midnight = computeDiurnalLighting(0);
      expect(midnight.ambientAlpha).toBeGreaterThan(0.45);
      expect(midnight.isNight).toBe(true);
      const noon = computeDiurnalLighting(720);
      expect(midnight.hearthRadiusPx).toBeGreaterThan(noon.hearthRadiusPx);
    });

    it('returns dawn/dusk amber tints around transition hours', () => {
      const dawn = computeDiurnalLighting(360);
      const dusk = computeDiurnalLighting(1080);
      expect(dawn.ambientAlpha).toBeGreaterThan(0.15);
      expect(dawn.ambientAlpha).toBeLessThan(0.65);
      expect(dusk.ambientAlpha).toBeGreaterThan(0.15);
      expect(dusk.ambientAlpha).toBeLessThan(0.65);
      expect(dawn.colorTint).toMatch(/rgba\(.*\)/);
      expect(dusk.colorTint).toMatch(/rgba\(.*\)/);
    });
  });

  describe('Desire path heatmap logic', () => {
    it('maps grid cell wear [0, 255] to alpha blend overlay [0, 0.75]', () => {
      expect(computeDesirePathAlpha(0)).toBe(0);
      expect(computeDesirePathAlpha(255)).toBeCloseTo(0.75, 2);
      expect(computeDesirePathAlpha(128)).toBeGreaterThan(0.2);
      expect(computeDesirePathAlpha(128)).toBeLessThan(0.5);
    });
  });

  describe('Colonist token placement and status indicator mapping', () => {
    it('returns distinct archetype colors', () => {
      const foragerColor = getArchetypeColor('FORAGER');
      const minerColor = getArchetypeColor('MINER');
      const herbalistColor = getArchetypeColor('HERBALIST');
      const chemistColor = getArchetypeColor('APPRENTICE_CHEMIST');

      expect(foragerColor).toBeTruthy();
      expect(minerColor).toBeTruthy();
      expect(herbalistColor).toBeTruthy();
      expect(chemistColor).toBeTruthy();

      const uniqueColors = new Set([foragerColor, minerColor, herbalistColor, chemistColor]);
      expect(uniqueColors.size).toBe(4);
    });
  });

  describe('StrategyMapCanvas Component & Command Dock UI actions', () => {
    it('mounts into DOM, sets up canvas, and dispatches UI callbacks', () => {
      // Mock global window if missing in pure node test environment
      if (typeof (globalThis as any).window === 'undefined') {
        (globalThis as any).window = {
          devicePixelRatio: 1,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          requestAnimationFrame: vi.fn((fn: Function) => setTimeout(fn, 0)),
          cancelAnimationFrame: vi.fn(),
        };
      }
      if (typeof (globalThis as any).requestAnimationFrame === 'undefined') {
        (globalThis as any).requestAnimationFrame = vi.fn((fn: Function) => setTimeout(fn, 0));
        (globalThis as any).cancelAnimationFrame = vi.fn();
      }

      const container = createMockElement('div');

      const onRecruit = vi.fn();
      const onAssignJob = vi.fn();
      const onAdministerStimulant = vi.fn();
      const onSetWageContract = vi.fn();

      const mapCanvas = new StrategyMapCanvas(container, {
        onRecruit,
        onAssignJob,
        onAdministerStimulant,
        onSetWageContract,
      });

      const canvas = container.querySelector('canvas');
      expect(canvas).toBeDefined();
      expect(canvas).not.toBeNull();

      // Check command dock DOM elements
      const rosterList = container.querySelector('.colonist-roster-list');
      const recruitDrawer = container.querySelector('.recruitment-drawer');
      expect(rosterList).toBeDefined();
      expect(recruitDrawer).toBeDefined();

      // Initial colony state with 1 colonist
      const colony = createInitialColonyState();
      const c1 = recruitColonist(colony, 'Eliza Thorn', 'HERBALIST', { commodity: 'WILLOW_TEA', dailyAmount: 1 }, 10);
      mapCanvas.update(colony, 720);

      // Verify colonist card rendered
      const card = container.querySelector(`[data-colonist-id="${c1.id}"]`);
      expect(card).not.toBeNull();
      expect(card?.attributes['data-colonist-id']).toBe(c1.id);

      // Test recruitment button
      const recruitForagerBtn = container.querySelector('[data-recruit-archetype="FORAGER"]');
      expect(recruitForagerBtn).not.toBeNull();
      recruitForagerBtn?.click();
      expect(onRecruit).toHaveBeenCalledTimes(1);
      expect(onRecruit.mock.calls[0][0].archetype).toBe('FORAGER');

      // Test Stimulant dosage button
      const teaBtn = container.querySelector('[data-stimulant="WILLOW_TEA"]');
      expect(teaBtn).not.toBeNull();
      teaBtn?.click();
      expect(onAdministerStimulant).toHaveBeenCalledWith(c1.id, 'WILLOW_TEA');

      // Test Job assignment selector
      const jobSelect = container.querySelector(`[data-job-colonist="${c1.id}"]`);
      expect(jobSelect).not.toBeNull();
      if (jobSelect) {
        jobSelect.value = 'TREE_WHITE_OAK::OAK_HEARTWOOD_LOG';
        jobSelect.dispatchEvent({ type: 'change' });
        expect(onAssignJob).toHaveBeenCalledWith(c1.id, 'TREE_WHITE_OAK', 'OAK_HEARTWOOD_LOG');
      }

      // Test Wage change dropdown
      const wageSelect = container.querySelector(`[data-wage-colonist="${c1.id}"]`);
      expect(wageSelect).not.toBeNull();
      if (wageSelect) {
        wageSelect.value = 'BAR_SOAP';
        wageSelect.dispatchEvent({ type: 'change' });
        expect(onSetWageContract).toHaveBeenCalledWith(c1.id, { commodity: 'BAR_SOAP', dailyAmount: 1 });
      }

      mapCanvas.destroy();
    });
  });
});
