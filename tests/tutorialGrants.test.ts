import { describe, it, expect } from 'vitest';
import { TUTORIAL_LESSONS } from '../src/ui/tutorialCurriculum';

describe('Tutorial Practice Grants Separation', () => {
  it('beg_4_saponify does not complete immediately from practice grant without producing soap salts', () => {
    const lesson = TUTORIAL_LESSONS.find((l) => l.id === 'beg_4_saponify');
    expect(lesson).toBeDefined();

    // Context with only raw adipose fat and KOH (unreacted)
    const initialContext = {
      state: {
        inventory: {
          items: [{ id: 'RAW_ADIPOSE_FAT', count: 2, massKg: 1.0 }],
        },
      },
      snapshot: {
        tick: 0,
        telemetry: new Float64Array(256),
        // Moles: index 15 (K_STEARATE) and 16 (NA_STEARATE) are 0
        moles: new Float64Array(2048),
      },
    };

    expect(lesson!.isComplete(initialContext as any)).toBe(false);

    // After saponification produces soap salts in vessel:
    const reactedContext = {
      state: {
        inventory: {
          items: [{ id: 'RAW_ADIPOSE_FAT', count: 1, massKg: 0.5 }],
        },
      },
      snapshot: {
        tick: 10,
        telemetry: new Float64Array(256),
        moles: new Float64Array(2048),
      },
    };
    reactedContext.snapshot.moles[15] = 0.5; // K_STEARATE produced

    expect(lesson!.isComplete(reactedContext as any)).toBe(true);
  });

  it('int_3_bronze requires bronze item or bronze alloy, not just copper/tin ingots', () => {
    const lesson = TUTORIAL_LESSONS.find((l) => l.id === 'int_3_bronze');
    expect(lesson).toBeDefined();

    // Context with only copper and tin ingots from practice grant
    const ingotsOnlyContext = {
      state: {
        inventory: {
          items: [
            { id: 'COPPER_INGOT', count: 4, massKg: 2.0 },
            { id: 'TIN_INGOT', count: 1, massKg: 0.5 },
          ],
          tools: {},
        },
      },
      snapshot: {
        tick: 0,
        telemetry: new Float64Array(256),
        moles: new Float64Array(2048),
      },
    };

    expect(lesson!.isComplete(ingotsOnlyContext as any)).toBe(false);

    // After casting bronze tool
    const bronzeToolContext = {
      state: {
        inventory: {
          items: [],
          tools: {
            EATING_UTENSIL: { id: 'BRONZE_FORK', name: 'Bronze Fork' },
          },
        },
      },
      snapshot: ingotsOnlyContext.snapshot,
    };
    expect(lesson!.isComplete(bronzeToolContext as any)).toBe(true);

    // Or bronze species formed in crucible (index 23)
    const bronzeAlloyContext = {
      state: {
        inventory: { items: [], tools: {} },
      },
      snapshot: {
        tick: 5,
        telemetry: new Float64Array(256),
        moles: new Float64Array(2048),
      },
    };
    bronzeAlloyContext.snapshot.moles[23] = 0.2;
    expect(lesson!.isComplete(bronzeAlloyContext as any)).toBe(true);
  });

  it('phd_4_distill requires active condensation target or actual distillate', () => {
    const lesson = TUTORIAL_LESSONS.find((l) => l.id === 'phd_4_distill');
    expect(lesson).toBeDefined();

    // Initially with unconfigured vessel
    const unconfiguredContext = {
      state: {
        inventory: { items: [] },
        vessels: [{ id: 0, condenserTargetVesselId: -1 }],
      },
      snapshot: {
        tick: 0,
        telemetry: new Float64Array(256),
        moles: new Float64Array(2048),
      },
    };
    expect(lesson!.isComplete(unconfiguredContext as any)).toBe(false);

    // With condenser configured to vessel 1 and distillate transferred
    const activeDistillContext = {
      state: {
        inventory: { items: [] },
        vessels: [{ id: 0, condenserTargetVesselId: 1 }],
      },
      snapshot: {
        tick: 10,
        telemetry: new Float64Array(256),
        moles: new Float64Array(2048),
      },
    };
    // Dest vessel (1) moles offset = 64
    activeDistillContext.snapshot.moles[64 + 25] = 0.3; // Ethanol in receiving vessel
    expect(lesson!.isComplete(activeDistillContext as any)).toBe(true);
  });
});
