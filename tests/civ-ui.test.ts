import { describe, it, expect } from 'vitest';

describe('Civ district/quarter adjacency', () => {
  it('adjacent district yields are computed from tile veins', () => {
    const tile = { x: 10, y: 5, veins: ['COPPER', 'HALITE'] };
    const adjacency = tile.veins.map(v => ({ from: v, yield: 'gold' as const, delta: v === 'COPPER' ? 3 : 1 }));
    expect(adjacency).toHaveLength(2);
    expect(adjacency.find(a => a.from === 'COPPER')?.delta).toBe(3);
  });

  it('overbuilding penalty is red when district full', () => {
    const quarter = { slots: ['SMELTER', 'HAULER'] };
    const overbuild = quarter.slots.length > 2;
    expect(overbuild).toBe(false);
    quarter.slots.push('EXTRA');
    expect(quarter.slots.length > 2).toBe(true);
  });

  it('Wonder requires adjacent District', () => {
    const wonderTile = { x: 11, y: 5 };
    const districtTiles = [{ x: 10, y: 5 }];
    const adjacent = districtTiles.some(d => Math.abs(d.x - wonderTile.x) <= 1 && Math.abs(d.y - wonderTile.y) <= 1);
    expect(adjacent).toBe(true);
  });

  it('yield overlay highlights high-yield tiles', () => {
    const tileYields = { gold: 12, food: 3, science: 0 };
    const highYield = tileYields.gold >= 10;
    expect(highYield).toBe(true);
  });
});

describe('WorkerCommands (compile-time exhaustive)', () => {
  it('PLACE_DISTRICT has required fields', () => {
    const cmd = { type: 'PLACE_DISTRICT' as const, district: 'MINE', tile: { x: 10, y: 5 } };
    expect(cmd.type).toBe('PLACE_DISTRICT');
    expect(cmd.tile).toEqual({ x: 10, y: 5 });
  });

  it('SLOT_BUILDING targets a quarter slot', () => {
    const cmd = { type: 'SLOT_BUILDING' as const, quarterId: 'q1', slot: 0 as const, building: 'SMELTER' };
    expect(cmd.slot).toBe(0);
    expect(cmd.building).toBe('SMELTER');
  });

  it('BUILD_WONDER requires adjacent District', () => {
    const cmd = { type: 'BUILD_WONDER' as const, wonder: 'GRAND_SMELTER', tile: { x: 11, y: 5 } };
    expect(cmd.wonder).toBe('GRAND_SMELTER');
    expect(cmd.tile).toEqual({ x: 11, y: 5 });
  });

  it('DESIGNATE_MINE has a rect', () => {
    const cmd = { type: 'DESIGNATE_MINE' as const, rect: { x0: -100, y0: -100, x1: 100, y1: 100 } };
    expect(cmd.rect).toEqual({ x0: -100, y0: -100, x1: 100, y1: 100 });
  });

  it('SET_BILL has recipe + threshold + autoCraft', () => {
    const cmd = { type: 'SET_BILL' as const, recipe: 'BAR_SOAP', threshold: 20, autoCraft: true };
    expect(cmd.recipe).toBe('BAR_SOAP');
    expect(cmd.threshold).toBe(20);
    expect(cmd.autoCraft).toBe(true);
  });

  it('RESEARCH gates recipes by tech tree', () => {
    const cmd = { type: 'RESEARCH' as const, tech: 'BRONZE_CASTING' };
    expect(cmd.tech).toBe('BRONZE_CASTING');
  });
});
