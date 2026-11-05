import { describe, it, expect } from 'vitest';
import {
  createInitialPatronState,
  assignPatronFromRecipe,
  createFirstCommission,
  PATRONS,
  getPatronEnding,
} from '../src/engine/campaign/patron';

describe('Patron & First Commission Flow (M2 / §6.22)', () => {
  it('initializes patron state as unassigned stranger with 0 completed commissions', () => {
    const patron = createInitialPatronState();
    expect(patron.patronId).toBeNull();
    expect(patron.trustTier).toBe(1);
    expect(patron.trustScore).toBe(20);
    expect(patron.firstCraftCompleted).toBe(false);
    expect(patron.activeCommission).toBeNull();
  });

  it('silently assigns correct patron based on first recipe fabricated', () => {
    // Spear / Knife / Axe -> Odric Vane (Warden / Soldier)
    expect(assignPatronFromRecipe('RECIPE_CRAFT_FLINT_SPEAR')).toBe('odric_vane');
    expect(assignPatronFromRecipe('RECIPE_BRONZE_KNIFE')).toBe('odric_vane');

    // Soap / Saponify / Tallow -> Madame Serafine (Guild of Scents)
    expect(assignPatronFromRecipe('RECIPE_SAPONIFY_COLD')).toBe('madame_serafine');
    expect(assignPatronFromRecipe('RECIPE_RENDER_TALLOW')).toBe('madame_serafine');

    // Willow / Tincture / Salve -> Sister Aurel of the Weir
    expect(assignPatronFromRecipe('RECIPE_STEEP_WILLOW_BARK')).toBe('sister_aurel');
    expect(assignPatronFromRecipe('RECIPE_HEALING_SALVE')).toBe('sister_aurel');

    // Charcoal / Smelt / Ingot -> The Forge Clans
    expect(assignPatronFromRecipe('RECIPE_ROAST_CHARCOAL')).toBe('forge_clans');
    expect(assignPatronFromRecipe('RECIPE_SMELT_BRONZE')).toBe('forge_clans');

    // Unknown or wander off -> The Hedge-Witch
    expect(assignPatronFromRecipe(null)).toBe('hedge_witch');
    expect(assignPatronFromRecipe('UNKNOWN_RECIPE')).toBe('hedge_witch');
  });

  it('generates appropriate first commission for each patron', () => {
    for (const p of PATRONS) {
      const comm = createFirstCommission(p.id, 1);
      expect(comm.patronId).toBe(p.id);
      expect(comm.deadlineTurn).toBeGreaterThan(1);
      expect(comm.askCount).toBeGreaterThan(0);
      expect(comm.rewardStock.length).toBeGreaterThan(0);
      expect(comm.completed).toBe(false);
    }
  });

  it('resolves unique epilogue endings for all 5 patrons', () => {
    for (const p of PATRONS) {
      const ending = getPatronEnding(p.id);
      expect(ending.patronId).toBe(p.id);
      expect(ending.endingTitle).toBeDefined();
      expect(ending.epilogueProse.length).toBeGreaterThan(20);
    }
  });
});
