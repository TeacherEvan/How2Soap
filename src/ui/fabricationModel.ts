/**
 * Pure fabrication feasibility model — the Fabrication window's brain.
 * Mirrors the worker's FABRICATE guard exactly (energy via tool MA and
 * apprentice multiplier; container inputs; required tool slot), so the UI can
 * state "craftable now" honestly. The worker remains the final authority.
 */
import { FABRICATION_RECIPES, type FabricationRecipe } from '../engine/fabrication';
import { VESSEL_INPUTS } from '../engine/vesselInputs';
import type { ToolAndInventoryState } from '../ui/ToolAndInventoryPanel';

export interface InventorySlotLike {
  itemId: string;
  count: number;
}

/** Sum item counts across bare hands, backpack and camp cache. */
export function aggregateInventory(inventory: ToolAndInventoryState): Map<string, number> {
  const counts = new Map<string, number>();
  const containers = [inventory.bareHands, inventory.backpack, inventory.campCache ?? []];
  for (const container of containers) {
    for (const slot of container) {
      if (!slot?.itemId) continue;
      const id = slot.itemId;
      counts.set(id, (counts.get(id) ?? 0) + slot.count);
    }
  }
  return counts;
}

export interface RecipeAssessment {
  recipeId: string;
  feasible: boolean;
  /** Human-readable blockers when infeasible (glucose, tool, missing mats). */
  reasons: string[];
  /** "2× Charcoal" style missing list. */
  missing: string[];
  /** Bench inputs (handled by the worker, not this client check). */
  vesselInputsNeeded: string[];
  /** Glucose cost after tool + apprentice adjustment, matching the worker. */
  energyCostKcal: number;
}

export function assessRecipe(
  recipe: FabricationRecipe,
  counts: Map<string, number>,
  tools: ToolAndInventoryState['tools'],
  playerGlucoseKcal: number,
  apprenticeMult = 1,
): RecipeAssessment {
  const reasons: string[] = [];
  const missing: string[] = [];

  const tool = recipe.requiredToolSlot ? tools[recipe.requiredToolSlot] ?? null : null;
  if (recipe.requiredToolSlot && !tool) {
    reasons.push(`Requires tool in slot ${recipe.requiredToolSlot}`);
  }
  // METALLURGY_TOOLS carry mechanicalAdvantage at runtime even though the
  // ToolAndInventoryState type does not declare it.
  const toolMA = (tool as { mechanicalAdvantage?: number } | null)?.mechanicalAdvantage ?? 1.0;
  const energyCostKcal = Math.max(1, (recipe.energyCostKcal / Math.max(1.0, toolMA)) / Math.max(1, apprenticeMult));
  if (playerGlucoseKcal < energyCostKcal) {
    reasons.push(`Exhausted: requires ${energyCostKcal.toFixed(0)} kcal glucose`);
  }

  for (const input of recipe.inputs) {
    if (VESSEL_INPUTS[input.itemId]) continue; // bench-side check in the worker
    const have = counts.get(input.itemId) ?? 0;
    if (have < input.count) {
      missing.push(`${input.count - have}× ${input.label}`);
    }
  }
  if (missing.length > 0) reasons.push(`Missing: ${missing.join(', ')}`);

  const vesselInputsNeeded = recipe.inputs
    .filter((i) => VESSEL_INPUTS[i.itemId])
    .map((i) => i.itemId);

  return {
    recipeId: recipe.id,
    feasible: reasons.length === 0,
    reasons,
    missing,
    vesselInputsNeeded,
    energyCostKcal,
  };
}

export function assessAllRecipes(
  inventory: ToolAndInventoryState,
  playerGlucoseKcal: number,
  apprenticeMult = 1,
): Map<string, RecipeAssessment> {
  const counts = aggregateInventory(inventory);
  const map = new Map<string, RecipeAssessment>();
  for (const recipe of FABRICATION_RECIPES) {
    map.set(recipe.id, assessRecipe(recipe, counts, inventory.tools, playerGlucoseKcal, apprenticeMult));
  }
  return map;
}

/** True when the player has already fabricated this recipe at least once. */
export function hasFabricated(recipeId: string, fabricatedRecipes: readonly string[]): boolean {
  return fabricatedRecipes.includes(recipeId);
}
