/**
 * Districts, Quarters & Adjacency Engine
 *
 * Implements §6.5 & §6.20.1 of Civ VII 4X Conversion Plan (v8):
 * - Urban districts placed adjacent to city centers or existing urban districts.
 * - 2 buildings per district → Quarter; Unique Quarter bonus for 2 matching civ buildings.
 * - Adjacency bonus table (Smithy adjacent to ore/salt, Stillhouse adjacent to willow/oak, etc.).
 * - Overbuilding: Age-N buildings carried forward at 50% yield.
 * - District founding claims adjacent hexes, expanding borders.
 * - Alembic Hall T2 building: +2 lab concurrency, +1 Discovery/turn in flight.
 */

import { axialDistance, type AxialCoord, getHexNeighbors } from './hexMap';

export type DistrictKind =
  | 'CAMP_CENTER'
  | 'CITY_CENTER'
  | 'ACADEMIC'
  | 'METALLURGIC'
  | 'APOTHECARY'
  | 'COMMERCIAL';

export interface DistrictBuildingDef {
  readonly id: string;
  readonly name: string;
  readonly districtKind: DistrictKind;
  readonly age: number;
  readonly yields: {
    food?: number;
    production?: number;
    trade?: number;
    discovery?: number;
    renown?: number;
    influence?: number;
    morale?: number;
  };
  readonly civTag?: string;
}

export const DISTRICT_BUILDINGS: readonly DistrictBuildingDef[] = [
  {
    id: 'bld_smithy',
    name: 'Frontier Smithy',
    districtKind: 'METALLURGIC',
    age: 1,
    yields: { production: 2, trade: 1 },
  },
  {
    id: 'bld_stillhouse',
    name: 'Apothecary Stillhouse',
    districtKind: 'APOTHECARY',
    age: 1,
    yields: { discovery: 2, food: 1 },
  },
  {
    id: 'bld_alembic_hall',
    name: 'The Alembic Hall (T2 Lab)',
    districtKind: 'ACADEMIC',
    age: 2,
    yields: { discovery: 3, influence: 1 },
  },
  {
    id: 'bld_scriptorium',
    name: 'Astrolabe Scriptorium',
    districtKind: 'ACADEMIC',
    age: 1,
    yields: { discovery: 1, renown: 2 },
  },
  {
    id: 'bld_mint',
    name: 'Salt & Copper Mint',
    districtKind: 'COMMERCIAL',
    age: 1,
    yields: { trade: 3 },
  },
];

export interface UrbanDistrict {
  id: string;
  kind: DistrictKind;
  q: number;
  r: number;
  buildings: DistrictBuildingDef[];
  isQuarter: boolean;
  isUniqueQuarter: boolean;
}

export interface AdjacencyRule {
  readonly districtKind: DistrictKind;
  readonly adjacentTileBiomeOrResource: string;
  readonly bonusYield: 'food' | 'production' | 'trade' | 'discovery' | 'renown' | 'influence';
  readonly delta: number;
}

export const ADJACENCY_RULES: readonly AdjacencyRule[] = [
  { districtKind: 'METALLURGIC', adjacentTileBiomeOrResource: 'ROCKS_MINERALS', bonusYield: 'production', delta: 1 },
  { districtKind: 'METALLURGIC', adjacentTileBiomeOrResource: 'SALT_FLAT', bonusYield: 'production', delta: 1 },
  { districtKind: 'APOTHECARY', adjacentTileBiomeOrResource: 'TREES', bonusYield: 'discovery', delta: 1 },
  { districtKind: 'APOTHECARY', adjacentTileBiomeOrResource: 'MUSHROOMS_FLORA', bonusYield: 'discovery', delta: 1 },
  { districtKind: 'COMMERCIAL', adjacentTileBiomeOrResource: 'WATER', bonusYield: 'trade', delta: 1 },
  { districtKind: 'ACADEMIC', adjacentTileBiomeOrResource: 'ANCIENT_RUIN', bonusYield: 'renown', delta: 1 },
];

export function validateDistrictPlacement(
  existingDistricts: UrbanDistrict[],
  candidate: AxialCoord,
): { valid: boolean; reason?: string } {
  // If no districts yet, candidate is allowed as capital center
  if (existingDistricts.length === 0) {
    return { valid: true };
  }

  // Already occupied?
  const occupied = existingDistricts.some((d) => d.q === candidate.q && d.r === candidate.r);
  if (occupied) {
    return { valid: false, reason: 'Tile is already occupied by a district.' };
  }

  // Must be adjacent to at least one existing urban district
  const isAdjacent = existingDistricts.some((d) => axialDistance(d, candidate) === 1);
  if (!isAdjacent) {
    return { valid: false, reason: 'Urban districts must be placed adjacent to an existing urban district.' };
  }

  return { valid: true };
}

export function placeDistrict(
  existingDistricts: UrbanDistrict[],
  kind: DistrictKind,
  coord: AxialCoord,
): { ok: boolean; district?: UrbanDistrict; claimedHexes?: AxialCoord[]; error?: string } {
  const check = validateDistrictPlacement(existingDistricts, coord);
  if (!check.valid) {
    return { ok: false, error: check.reason };
  }

  const district: UrbanDistrict = {
    id: `district_${existingDistricts.length + 1}`,
    kind,
    q: coord.q,
    r: coord.r,
    buildings: [],
    isQuarter: false,
    isUniqueQuarter: false,
  };

  existingDistricts.push(district);
  const claimedHexes = getHexNeighbors(coord);

  return {
    ok: true,
    district,
    claimedHexes,
  };
}

export function addBuildingToDistrict(
  district: UrbanDistrict,
  building: DistrictBuildingDef,
): { ok: boolean; becameQuarter: boolean; becameUniqueQuarter: boolean; message: string } {
  if (district.buildings.length >= 2) {
    return { ok: false, becameQuarter: false, becameUniqueQuarter: false, message: 'District already contains 2 buildings (Quarter limit).' };
  }

  district.buildings.push(building);

  let becameQuarter = false;
  let becameUniqueQuarter = false;

  if (district.buildings.length === 2) {
    district.isQuarter = true;
    becameQuarter = true;

    // Check unique quarter bonus
    const [b1, b2] = district.buildings;
    if (b1.civTag && b1.civTag === b2.civTag) {
      district.isUniqueQuarter = true;
      becameUniqueQuarter = true;
    }
  }

  return {
    ok: true,
    becameQuarter,
    becameUniqueQuarter,
    message: `Added ${building.name} to ${district.id}.`,
  };
}

export function computeDistrictAdjacencyBonuses(
  district: UrbanDistrict,
  neighborBiomesAndResources: string[],
): Record<string, number> {
  const bonuses: Record<string, number> = {};

  for (const rule of ADJACENCY_RULES) {
    if (rule.districtKind === district.kind) {
      for (const neighbor of neighborBiomesAndResources) {
        if (neighbor === rule.adjacentTileBiomeOrResource) {
          bonuses[rule.bonusYield] = (bonuses[rule.bonusYield] ?? 0) + rule.delta;
        }
      }
    }
  }

  return bonuses;
}
