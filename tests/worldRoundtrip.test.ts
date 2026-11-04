/**
 * Spine coverage for src/engine/world.ts: stepWorld orchestration +
 * syncWorldToShared → readSnapshot round-trip through the SeqLock.
 */
import { describe, expect, it } from 'vitest';
import {
  createWorld,
  createWorldVessel,
  findVessel,
  stepWorld,
  syncWorldToShared,
} from '../src/engine/world';
import {
  SharedWorldView,
  SAB_BYTE_LENGTH,
  MAX_SPECIES,
  TELEMETRY,
} from '../src/engine/memoryLayout';
import { SPECIES } from '../src/data/speciesRegistry';

describe('world.ts orchestration spine', () => {
  it('createWorldVessel is idempotent and findVessel locates it', () => {
    const world = createWorld(300);
    const a = createWorldVessel(world, 7, 'WOOD', 5);
    const b = createWorldVessel(world, 7, 'FIRED_CERAMIC', 2);
    expect(a).toBe(b);
    expect(world.vessels).toHaveLength(1);
    expect(findVessel(world, 7)?.material).toBe('WOOD');
    expect(findVessel(world, 999)).toBeUndefined();
  });

  it('stepWorld advances tick and sim seconds deterministically', () => {
    const world = createWorld(288.15);
    createWorldVessel(world, 1, 'WOOD', 5);
    for (let i = 0; i < 10; i += 1) stepWorld(world, 360);
    expect(world.tick).toBe(10);
    expect(world.simSeconds).toBe(3600);
  });

  it('syncWorldToShared → readSnapshot copies vessel telemetry and moles through the SeqLock', () => {
    const world = createWorld(288.15);
    const vessel = createWorldVessel(world, 3, 'FIRED_CERAMIC', 2);
    vessel.moles[SPECIES.NACL] = 1.25;
    vessel.heaterWatts = 400;
    for (let i = 0; i < 4; i += 1) stepWorld(world, 360);

    const sab = new SharedArrayBuffer(SAB_BYTE_LENGTH);
    const view = new SharedWorldView(sab);
    syncWorldToShared(world, view);

    const snap = view.readSnapshot();
    expect(snap.tick).toBe(4);
    // Vessel is index 0 in the SAB layout (world order)
    const base = 0 * MAX_SPECIES;
    expect(snap.moles[base + SPECIES.NACL]).toBeCloseTo(1.25, 6);
    expect(snap.telemetry[TELEMETRY.HEATER_W]).toBe(400);
    expect(snap.telemetry[TELEMETRY.TEMP_K]).toBeCloseTo(vessel.temperatureK, 4);
  });

  it('full round-trip: advancing the world and re-syncing updates the snapshot tick monotonically', () => {
    const world = createWorld(288.15);
    createWorldVessel(world, 1, 'COPPER', 1, true);
    const sab = new SharedArrayBuffer(SAB_BYTE_LENGTH);
    const view = new SharedWorldView(sab);

    syncWorldToShared(world, view);
    const first = view.readSnapshot();
    for (let i = 0; i < 240; i += 1) stepWorld(world, 360); // one full game day
    syncWorldToShared(world, view);
    const second = view.readSnapshot();

    expect(second.tick).toBe(240);
    expect(second.tick).toBeGreaterThan(first.tick);
  });
});
