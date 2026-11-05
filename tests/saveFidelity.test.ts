import { describe, it, expect } from 'vitest';
import { buildSaveSnapshot } from '../src/app/autosave';
import { restoreWorldFromSave } from '../src/engine/worldRestore';
import { state } from '../src/app/state';
import { TELEMETRY, FLAG_CLOSED, FLAG_RUPTURED } from '../src/engine/memoryLayout';

describe('Save Fidelity & Vessel State Round-Trip (MVTH-2 / P1-1)', () => {
  it('persists complete vessel physical state and restores it faithfully', () => {
    // Setup state
    state.snapshot = {
      tick: 42,
      telemetry: new Float64Array(32 * 8),
      moles: new Float64Array(32 * 256),
    };

    // Configure Vessel 0 in state
    state.vessels = [
      {
        id: 101,
        material: 'BOROSILICATE',
        capacityL: 10,
        closed: true,
        label: 'Electrolysis Cell',
        condenserTargetVesselId: 102,
        appliedVolts: 12.5,
        cellResistanceOhm: 4.2,
      },
      {
        id: 102,
        material: 'COPPER',
        capacityL: 5,
        closed: false,
        label: 'Receiver',
        condenserTargetVesselId: -1,
        appliedVolts: 0,
        cellResistanceOhm: 2.0,
      },
    ];

    // Set telemetry values for Vessel 0 (index 0)
    const base0 = 0 * 8;
    state.snapshot.telemetry[base0 + TELEMETRY.TEMP_K] = 368.15; // hot
    state.snapshot.telemetry[base0 + TELEMETRY.PRESSURE_KPA] = 185.5; // pressurized
    state.snapshot.telemetry[base0 + TELEMETRY.HEATER_W] = 450; // heating
    state.snapshot.telemetry[base0 + TELEMETRY.FLAGS] = FLAG_CLOSED;

    // Set telemetry values for Vessel 1 (index 1)
    const base1 = 1 * 8;
    state.snapshot.telemetry[base1 + TELEMETRY.TEMP_K] = 295.15;
    state.snapshot.telemetry[base1 + TELEMETRY.PRESSURE_KPA] = 101.325;
    state.snapshot.telemetry[base1 + TELEMETRY.HEATER_W] = 0;
    state.snapshot.telemetry[base1 + TELEMETRY.FLAGS] = FLAG_RUPTURED;

    // Build snapshot
    const save = buildSaveSnapshot();

    // Verify save contains the fields
    expect(save.vessels.length).toBe(2);
    const v0Save = save.vessels[0];
    expect(v0Save.temperatureK).toBeCloseTo(368.15);
    expect(v0Save.heaterWatts).toBe(450);
    expect(v0Save.pressureKPa).toBeCloseTo(185.5);
    expect(v0Save.headspaceClosed).toBe(true);
    expect(v0Save.condenserTargetVesselId).toBe(102);
    expect(v0Save.appliedVolts).toBe(12.5);
    expect(v0Save.cellResistanceOhm).toBe(4.2);
    expect(v0Save.ruptured).toBe(false);

    // Restore into WorldState
    const labels = new Map<number, string>();
    const restoredWorld = restoreWorldFromSave(save, labels);

    expect(restoredWorld.vessels.length).toBe(2);
    const v0Restored = restoredWorld.vessels[0];
    expect(v0Restored.id).toBe(101);
    expect(v0Restored.material).toBe('BOROSILICATE');
    expect(v0Restored.capacityL).toBe(10);
    expect(v0Restored.headspaceClosed).toBe(true);
    expect(v0Restored.temperatureK).toBeCloseTo(368.15);
    expect(v0Restored.pressureKPa).toBeCloseTo(185.5);
    expect(v0Restored.heaterWatts).toBe(450);
    expect(v0Restored.condenserTargetVesselId).toBe(102);
    expect(v0Restored.appliedVolts).toBe(12.5);
    expect(v0Restored.cellResistanceOhm).toBe(4.2);
    expect(v0Restored.ruptured).toBe(false);

    const v1Restored = restoredWorld.vessels[1];
    expect(v1Restored.ruptured).toBe(true);

    // Legacy compatibility test: accepts `closed` as alias for `headspaceClosed`
    const legacySave: any = {
      version: 3,
      ambientTempK: 288.15,
      tick: 1,
      vessels: [
        {
          id: 201,
          material: 'WOOD',
          capacityL: 2,
          closed: true, // legacy alias
        },
      ],
    };
    const legacyWorld = restoreWorldFromSave(legacySave);
    expect(legacyWorld.vessels[0].headspaceClosed).toBe(true);
  });
});
