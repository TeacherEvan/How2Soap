import { describe, it, expect } from 'vitest';
import {
  FABRICATION_RECIPES,
  INITIAL_PRIMITIVE_TOOLS,
} from '../src/engine/fabrication';
import {
  createInventoryState,
  addItemToContainer,
  removeItemFromContainer,
  unlockBackpack,
  getContainerTotalMassKg,
} from '../src/engine/inventory';

describe('Tool Fabrication & Inventory System (OBJ-003, OBJ-004, OBJ-005 / AC-006, AC-007)', () => {
  it('starts with Bare Hands (2 slots) and locked Backpack (24 slots)', () => {
    const inv = createInventoryState();
    expect(inv.bareHands.unlocked).toBe(true);
    expect(inv.bareHands.maxSlots).toBe(2);
    expect(inv.bareHands.maxMassKg).toBe(12.0);

    expect(inv.backpack.unlocked).toBe(false);
    expect(inv.backpack.maxSlots).toBe(24);
    expect(inv.backpack.maxMassKg).toBe(40.0);
  });

  it('rejects adding items to locked backpack until unlocked', () => {
    const inv = createInventoryState();
    const added = addItemToContainer(inv.backpack, {
      itemId: 'FLINT_NODULE',
      count: 1,
      massKg: 1.5,
      label: 'Flint',
    });
    expect(added).toBe(false);

    unlockBackpack(inv);
    expect(inv.backpack.unlocked).toBe(true);

    const addedAfter = addItemToContainer(inv.backpack, {
      itemId: 'FLINT_NODULE',
      count: 1,
      massKg: 1.5,
      label: 'Flint',
    });
    expect(addedAfter).toBe(true);
    expect(getContainerTotalMassKg(inv.backpack)).toBe(1.5);
  });

  it('enforces bare hands mass capacity (max 12 kg)', () => {
    const inv = createInventoryState();
    // Try to add 15kg rock to hands
    const added = addItemToContainer(inv.bareHands, {
      itemId: 'HEAVY_BOULDER',
      count: 1,
      massKg: 15.0,
      label: 'Heavy Boulder',
    });
    expect(added).toBe(false);
  });

  it('tracks initial River Hammerstone in PERCUSSION_MINING slot', () => {
    expect(INITIAL_PRIMITIVE_TOOLS.PERCUSSION_MINING?.name).toBe('River Hammerstone');
    expect(INITIAL_PRIMITIVE_TOOLS.PERCUSSION_MINING?.mohs).toBe(6.5);
  });

  it('contains full 6-step leather backpack pipeline recipes', () => {
    const recipeIds = FABRICATION_RECIPES.map((r) => r.id);
    expect(recipeIds).toContain('RECIPE_KNAP_FLINT');
    expect(recipeIds).toContain('RECIPE_CRAFT_FLINT_ADZE');
    expect(recipeIds).toContain('RECIPE_CARVE_WOODEN_BUCKET');
    expect(recipeIds).toContain('RECIPE_DEHAIR_HIDE');
    expect(recipeIds).toContain('RECIPE_TANNIN_STEEP');
    expect(recipeIds).toContain('RECIPE_STITCH_BACKPACK');
  });

  it('stacks identical items in container and removes them accurately', () => {
    const inv = createInventoryState();
    addItemToContainer(inv.bareHands, { itemId: 'WOOD_BRANCH', count: 1, massKg: 0.5, label: 'Branch' });
    addItemToContainer(inv.bareHands, { itemId: 'WOOD_BRANCH', count: 2, massKg: 0.5, label: 'Branch' });

    expect(inv.bareHands.slots[0]?.count).toBe(3);

    removeItemFromContainer(inv.bareHands, 'WOOD_BRANCH', 2);
    expect(inv.bareHands.slots[0]?.count).toBe(1);

    removeItemFromContainer(inv.bareHands, 'WOOD_BRANCH', 1);
    expect(inv.bareHands.slots[0]).toBeNull();
  });
});
