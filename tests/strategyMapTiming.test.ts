import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StrategyMapCanvas } from '../src/ui/StrategyMapCanvas';

describe('StrategyMapCanvas Timing Ring & Hotspots', () => {
  let prevDoc: any;
  let prevWin: any;
  let mockCtx: any;

  beforeEach(() => {
    prevDoc = (globalThis as any).document;
    prevWin = (globalThis as any).window;

    mockCtx = {
      resetTransform: () => {},
      scale: () => {},
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      arc: () => {},
      fill: () => {},
      stroke: () => {},
      fillRect: () => {},
      fillText: () => {},
      createRadialGradient: () => ({ addColorStop: () => {} }),
      moveTo: () => {},
      lineTo: () => {},
      setLineDash: () => {},
    };

    (globalThis as any).document = {
      createElement: () => ({
        getContext: () => mockCtx,
        classList: { add: () => {} },
        style: {},
        addEventListener: () => {},
        setAttribute: () => {},
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 500 }),
      }),
      activeElement: null,
    };
    (globalThis as any).window = {
      devicePixelRatio: 1,
      addEventListener: () => {},
      removeEventListener: () => {},
      requestAnimationFrame: () => 1,
      cancelAnimationFrame: () => {},
    };
    (globalThis as any).requestAnimationFrame = () => 1;
    (globalThis as any).cancelAnimationFrame = () => {};
  });

  afterEach(() => {
    (globalThis as any).document = prevDoc;
    (globalThis as any).window = prevWin;
  });

  it('triggers timing ring and fires harvest boost', () => {
    const mockContainer: any = {
      classList: { add: () => {} },
      innerHTML: '',
      querySelector: () => ({
        getContext: () => mockCtx,
        classList: { add: () => {} },
        style: {},
        addEventListener: () => {},
        setAttribute: () => {},
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 500 }),
      }),
      querySelectorAll: () => [],
    };

    const map = new StrategyMapCanvas(mockContainer);
    expect(map.activeTimingRing).toBeNull();
    expect(map.activeHotspots).toHaveLength(0);

    map.activeTimingRing = {
      speciesId: 'TREE_WHITE_OAK',
      worldX: 50,
      worldY: 50,
      startMs: Date.now() - 950,
      durationMs: 1200,
      innerRadius: 10,
      outerRadius: 36,
    };

    let boostAwarded = false;
    (map as any).options.onHarvestBoost = (id: string, perfect: boolean) => {
      boostAwarded = true;
      expect(id).toBe('TREE_WHITE_OAK');
      expect(perfect).toBe(true);
    };

    // Screen coords at ring pos (worldX 50 -> panX 0 + 50 * 0.22 + 400 = 411)
    (map as any).handleNodeClick(411, 261);
    expect(boostAwarded).toBe(true);
    expect(map.activeTimingRing).toBeNull();
  });
});
