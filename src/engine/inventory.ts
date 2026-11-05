/**
 * Inventory Containers & Slots System
 *
 * Implements Section 2.2 and Section 5 of Master Technical Specification:
 * - Dedicated 6-slot Tool Menu (Cutting, Chopping, Percussion, Thermal, Stitching, Eating)
 * - Container 1: Bare Hands (2 slots, max 6.0 kg per slot, 12 kg total)
 * - Container 2: Camp Ground Cache (6 slots at coordinates 0,0)
 * - Container 3: Leather Backpack (24 slots, 40.0 kg payload, locked until crafted)
 */

import type { ToolSlotKey, ToolItem } from './fabrication';

export interface InventorySlot {
  itemId: string;
  count: number;
  massKg: number;
  label: string;
}

export interface InventoryContainer {
  id: string;
  name: string;
  unlocked: boolean;
  maxSlots: number;
  maxMassKg: number;
  slots: Array<InventorySlot | null>;
}

export interface InventoryState {
  tools: Record<ToolSlotKey, ToolItem | null>;
  bareHands: InventoryContainer;
  campCache: InventoryContainer;
  backpack: InventoryContainer;
}

export function createInventoryState(): InventoryState {
  return {
    tools: {
      CUTTING_SKINNING: null,
      CHOPPING_CARVING: null,
      PERCUSSION_MINING: {
        id: 'RIVER_HAMMERSTONE',
        name: 'River Hammerstone',
        slot: 'PERCUSSION_MINING',
        mohs: 6.5,
        mechanicalAdvantage: 1.5,
        durability: 100,
        maxDurability: 100,
      },
      THERMAL_HANDLING: null,
      STITCHING_MEDICAL: null,
      EATING_UTENSIL: null,
    },
    bareHands: {
      id: 'CONTAINER_BARE_HANDS',
      name: 'Bare Hands (2 Slots)',
      unlocked: true,
      maxSlots: 2,
      maxMassKg: 12.0, // 6 kg max per hand
      slots: [null, null],
    },
    campCache: {
      id: 'CONTAINER_CAMP_CACHE',
      name: 'Camp Ground Cache (6 Slots)',
      unlocked: true,
      maxSlots: 6,
      maxMassKg: 150.0,
      slots: [null, null, null, null, null, null],
    },
    backpack: {
      id: 'CONTAINER_BACKPACK',
      name: 'Leather Backpack (24 Slots)',
      unlocked: false, // Locked at game start per spec!
      maxSlots: 24,
      maxMassKg: 40.0,
      slots: new Array(24).fill(null),
    },
  };
}

export function getContainerTotalMassKg(container: InventoryContainer): number {
  return container.slots.reduce((acc, slot) => acc + (slot ? slot.massKg * slot.count : 0), 0);
}

export function addItemToContainer(
  container: InventoryContainer,
  item: InventorySlot,
): boolean {
  if (!container.unlocked) return false;

  const totalMass = getContainerTotalMassKg(container);
  const additionalMass = item.massKg * item.count;
  if (totalMass + additionalMass > container.maxMassKg) {
    return false; // Exceeds container weight capacity
  }

  // 1. Try stacking if existing slot has same item
  for (let i = 0; i < container.slots.length; i++) {
    const slot = container.slots[i];
    if (slot && slot.itemId === item.itemId) {
      slot.count += item.count;
      return true;
    }
  }

  // 2. Otherwise place in first empty slot
  for (let i = 0; i < container.slots.length; i++) {
    if (!container.slots[i]) {
      container.slots[i] = { ...item };
      return true;
    }
  }

  return false; // Out of slots
}

export function removeItemFromContainer(
  container: InventoryContainer,
  itemId: string,
  count: number,
): boolean {
  let needed = count;
  for (let i = 0; i < container.slots.length; i++) {
    const slot = container.slots[i];
    if (slot && slot.itemId === itemId) {
      if (slot.count > needed) {
        slot.count -= needed;
        return true;
      } else {
        needed -= slot.count;
        container.slots[i] = null;
        if (needed === 0) return true;
      }
    }
  }
  return needed === 0;
}

export function unlockBackpack(inventory: InventoryState): void {
  inventory.backpack.unlocked = true;
}

export function cloneInventoryContainer(container: InventoryContainer): InventoryContainer {
  return {
    ...container,
    slots: container.slots.map(s => (s ? { ...s } : null)),
  };
}

export function cloneInventoryState(inventory: InventoryState): InventoryState {
  return {
    tools: { ...inventory.tools },
    bareHands: cloneInventoryContainer(inventory.bareHands),
    campCache: cloneInventoryContainer(inventory.campCache),
    backpack: cloneInventoryContainer(inventory.backpack),
  };
}

export function removeItemFromAnyContainer(
  inventory: InventoryState,
  itemId: string,
  count: number,
): boolean {
  // Count available across all containers first
  let available = 0;
  for (const container of [inventory.bareHands, inventory.backpack, inventory.campCache]) {
    for (const s of container.slots) {
      if (s && s.itemId === itemId) available += s.count;
    }
  }
  if (available < count) return false;

  // Deduct atomically
  let needed = count;
  for (const container of [inventory.backpack, inventory.bareHands, inventory.campCache]) {
    for (let i = 0; i < container.slots.length && needed > 0; i++) {
      const s = container.slots[i];
      if (s && s.itemId === itemId) {
        const take = Math.min(s.count, needed);
        s.count -= take;
        needed -= take;
        if (s.count <= 0) container.slots[i] = null;
      }
    }
  }
  return true;
}

export function addItemToAnyContainer(inventory: InventoryState, item: InventorySlot): boolean {
  return (
    addItemToContainer(inventory.bareHands, item) ||
    addItemToContainer(inventory.backpack, item) ||
    addItemToContainer(inventory.campCache, item)
  );
}

export function canFitItemsInInventory(inventory: InventoryState, items: InventorySlot[]): boolean {
  const sim = cloneInventoryState(inventory);
  for (const item of items) {
    if (!addItemToAnyContainer(sim, item)) {
      return false;
    }
  }
  return true;
}

