import { describe, it, expect } from 'vitest';
import {
  DISTRICT_BUILDINGS,
  validateDistrictPlacement,
  placeDistrict,
  addBuildingToDistrict,
  computeDistrictAdjacencyBonuses,
  type UrbanDistrict,
} from '../src/engine/campaign/districts';

describe('Milestone M5: Districts, Quarters & Adjacency Engine (§6.5, §6.20.1)', () => {
  it('validates district adjacency: must be adjacent to existing urban districts', () => {
    const districts: UrbanDistrict[] = [
      {
        id: 'district_1',
        kind: 'CITY_CENTER',
        q: 0,
        r: 0,
        buildings: [],
        isQuarter: false,
        isUniqueQuarter: false,
      },
    ];

    // Adjacent hex (1, 0)
    const valid = validateDistrictPlacement(districts, { q: 1, r: 0 });
    expect(valid.valid).toBe(true);

    // Non-adjacent hex (3, 3)
    const invalid = validateDistrictPlacement(districts, { q: 3, r: 3 });
    expect(invalid.valid).toBe(false);
    expect(invalid.reason).toContain('adjacent');

    // Already occupied (0, 0)
    const occupied = validateDistrictPlacement(districts, { q: 0, r: 0 });
    expect(occupied.valid).toBe(false);
    expect(occupied.reason).toContain('already occupied');
  });

  it('places district and returns claimed boundary hexes', () => {
    const districts: UrbanDistrict[] = [
      {
        id: 'district_1',
        kind: 'CITY_CENTER',
        q: 0,
        r: 0,
        buildings: [],
        isQuarter: false,
        isUniqueQuarter: false,
      },
    ];

    const res = placeDistrict(districts, 'METALLURGIC', { q: 1, r: 0 });
    expect(res.ok).toBe(true);
    expect(districts).toHaveLength(2);
    expect(res.claimedHexes).toHaveLength(6);
  });

  it('forms a Quarter when 2 buildings are added, capping at 2', () => {
    const district: UrbanDistrict = {
      id: 'district_1',
      kind: 'METALLURGIC',
      q: 1,
      r: 0,
      buildings: [],
      isQuarter: false,
      isUniqueQuarter: false,
    };

    const smithy = DISTRICT_BUILDINGS.find((b) => b.id === 'bld_smithy')!;
    const mint = DISTRICT_BUILDINGS.find((b) => b.id === 'bld_mint')!;

    const add1 = addBuildingToDistrict(district, smithy);
    expect(add1.ok).toBe(true);
    expect(district.isQuarter).toBe(false);

    const add2 = addBuildingToDistrict(district, mint);
    expect(add2.ok).toBe(true);
    expect(add2.becameQuarter).toBe(true);
    expect(district.isQuarter).toBe(true);

    // 3rd building rejected
    const add3 = addBuildingToDistrict(district, smithy);
    expect(add3.ok).toBe(false);
  });

  it('detects Unique Quarter bonus when 2 matching civ buildings are placed', () => {
    const district: UrbanDistrict = {
      id: 'district_unique',
      kind: 'ACADEMIC',
      q: 0,
      r: 1,
      buildings: [],
      isQuarter: false,
      isUniqueQuarter: false,
    };

    const b1 = { ...DISTRICT_BUILDINGS[0], civTag: 'ash_walkers' };
    const b2 = { ...DISTRICT_BUILDINGS[1], civTag: 'ash_walkers' };

    addBuildingToDistrict(district, b1);
    const res = addBuildingToDistrict(district, b2);

    expect(res.becameUniqueQuarter).toBe(true);
    expect(district.isUniqueQuarter).toBe(true);
  });

  it('computes adjacency bonuses according to table', () => {
    const district: UrbanDistrict = {
      id: 'district_metallurgic',
      kind: 'METALLURGIC',
      q: 1,
      r: 0,
      buildings: [],
      isQuarter: false,
      isUniqueQuarter: false,
    };

    const neighbors = ['ROCKS_MINERALS', 'SALT_FLAT', 'TREES'];
    const bonuses = computeDistrictAdjacencyBonuses(district, neighbors);

    // Both ROCKS_MINERALS and SALT_FLAT grant +1 production to METALLURGIC
    expect(bonuses.production).toBe(2);
  });

  it('includes Alembic Hall T2 building with high science output', () => {
    const alembicHall = DISTRICT_BUILDINGS.find((b) => b.id === 'bld_alembic_hall');
    expect(alembicHall).toBeDefined();
    expect(alembicHall?.yields.discovery).toBe(3);
    expect(alembicHall?.age).toBe(2);
  });
});
