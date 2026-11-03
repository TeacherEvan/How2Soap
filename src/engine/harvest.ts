/**
 * Pure Harvest Pipeline
 *
 * Compares tool Mohs vs target Mohs,
 * mechanical advantage, radial haul), routes yield items through the container
 * chain (bare hands -> backpack -> camp cache), and rolls a seeded wound check
 * on animal-hunt parts.
 *
 * Pure and deterministic: no I/O, no Math.random(). Task 5 wires this into the
 * sim worker's HARVEST_PART command.
 */

import type { PlayerMetabolismState } from './metabolism';
import { addItemToContainer, type InventoryState } from './inventory';
import {
  calculateHarvestTotalCostKcal,
  type HarvestablePart,
} from '../data/biomeNodes';
import type { ToolSlotKey } from './fabrication';

export interface HarvestOutcome {
  ok: boolean;
  reason?: 'too_tired';
  kcalCost: number;
  added: Array<{ itemId: string; count: number; container: 'bareHands' | 'backpack' | 'campCache' }>;
  overflowKg: number;
  wound: boolean;   // true if the seeded roll opened a wound (animal_hunt parts only)
}

const ANIMAL_HUNT_IDS = new Set(['BOAR_HUNT']); // extend as the biome DAG grows: any part whose id endsWith('_HUNT')
const WOUND_CHANCE = 0.2;

export function applyHarvest(
  player: PlayerMetabolismState,
  inventory: InventoryState,
  part: HarvestablePart,
  speciesDistanceMeters: number,
  equippedToolSlot: ToolSlotKey | null,
  equippedTool: { mohs: number; mechanicalAdvantage: number } | null,
  rng: { roll: (p: number) => boolean },
): HarvestOutcome {
  const toolMohs = equippedTool?.mohs ?? 1.0;
  const toolMA = equippedTool?.mechanicalAdvantage ?? 1.0;
  const carriedMassKg = 0; // future: pass current hands mass; 0 keeps the closed form stable
  const requiredSlot = part.requiredToolSlot ?? null;
  void equippedToolSlot; void requiredSlot; // slot match is a UI affordance, not a hard blocker
  const targetMohs = Math.max(1.0, part.targetMohs ?? 1.0);
  const kcalCost = calculateHarvestTotalCostKcal(
    part.baseWorkJoules, toolMohs, targetMohs, toolMA, speciesDistanceMeters, carriedMassKg,
  );
  if (player.glucoseKcal < kcalCost) {
    return { ok: false, reason: 'too_tired', kcalCost, added: [], overflowKg: 0, wound: false };
  }
  player.glucoseKcal = Math.max(0, player.glucoseKcal - kcalCost);

  const added: HarvestOutcome['added'] = [];
  let overflowKg = 0;
  for (const y of part.yields) {
    const slot = { itemId: y.itemId, count: 1, massKg: y.massKg, label: y.name };
    if (addItemToContainer(inventory.bareHands, slot)) added.push({ itemId: y.itemId, count: 1, container: 'bareHands' });
    else if (inventory.backpack.unlocked && addItemToContainer(inventory.backpack, slot)) added.push({ itemId: y.itemId, count: 1, container: 'backpack' });
    else if (addItemToContainer(inventory.campCache, slot)) added.push({ itemId: y.itemId, count: 1, container: 'campCache' });
    else overflowKg += y.massKg;
  }

  const wound = ANIMAL_HUNT_IDS.has(part.id) || part.id.endsWith('_HUNT') ? rng.roll(WOUND_CHANCE) : false;
  if (wound) player.conditions.woundContamination = true;

  return { ok: true, kcalCost, added, overflowKg, wound };
}
