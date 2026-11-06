import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SAB_BYTE_LENGTH } from '../src/engine/memoryLayout';
import { deserializeSave, serializeSave, type SerializedWorldSave } from '../src/engine/persistence';
import { createInitialInfluenceState } from '../src/engine/campaign/influence';
import { createInitialBuiltWorks } from '../src/engine/campaign/builtWorks';
import { createInitialMissions } from '../src/engine/campaign/missions';
import { createInitialCorrespondence } from '../src/engine/campaign/correspondence';
import { createInitialVictoryState } from '../src/engine/campaign/victories';

interface FakeWorker {
  posted: Array<Record<string, any>>;
  send: (data: unknown) => void;
}

async function bootWorker(): Promise<FakeWorker> {
  const posted: Array<Record<string, any>> = [];
  const fakeSelf = {
    postMessage: (msg: unknown) => posted.push(msg as Record<string, any>),
    onmessage: null as null | ((event: { data: unknown }) => void),
  };
  vi.stubGlobal('self', fakeSelf);
  vi.resetModules();
  await import('../src/engine/sim.worker');
  return { posted, send: (data: unknown) => fakeSelf.onmessage!({ data }) };
}

function lastCampaign(posted: Array<Record<string, any>>): Record<string, any> | undefined {
  return posted.filter((m) => m.type === 'CAMPAIGN_SYNC').at(-1);
}

function baseSave(campaign: Record<string, any>): SerializedWorldSave {
  return {
    version: 3,
    timestamp: 0,
    tick: 0,
    day: 1,
    ambientTempK: 288.15,
    rngSeed: 1,
    player: {
      glucoseKcal: 1200,
      adiposeKcal: 15000,
      hydrationPct: 100,
      coreTempK: 310.15,
      clothingIclo: 0.05,
    },
    inventory: {},
    vessels: [],
    ever: {},
    renown: 0,
    affinity: { apothecary: 0, soapwright: 0, forgewright: 0 },
    chapter: 0,
    fabricatedRecipes: [],
    objectivesDone: [],
    lettersDone: [],
    epilogueSeen: false,
    campaign,
  } as SerializedWorldSave;
}

describe('campaign layer — worker-owned state', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('INIT syncs influence, correspondence, works, missions, and victories', async () => {
    const { posted, send } = await bootWorker();
    send({ type: 'INIT', sab: new SharedArrayBuffer(SAB_BYTE_LENGTH) });

    const campaign = lastCampaign(posted);
    expect(campaign).toBeDefined();
    expect(campaign?.influence.currentInfluencePool).toBe(20);
    expect(campaign?.correspondence.letters.length).toBeGreaterThan(0);
    expect(campaign?.builtWorks.engineeringCanonCount).toBe(0);
    expect(campaign?.missions.missionsDispatchedCount).toBe(0);
    expect(campaign?.victories.undertowStance).toBe('IGNORE');
  });

  it('POWER_ACTION spends influence and raises the power relation', async () => {
    const { posted, send } = await bootWorker();
    send({ type: 'INIT', sab: new SharedArrayBuffer(SAB_BYTE_LENGTH) });
    posted.length = 0;

    send({ type: 'POWER_ACTION', powerId: 'power_wolf_kin', action: 'BEFRIEND' });

    const campaign = lastCampaign(posted);
    const power = campaign?.influence.powers.find((p: any) => p.id === 'power_wolf_kin');
    expect(campaign?.influence.currentInfluencePool).toBe(10);
    expect(power?.influence).toBe(35);
    expect(power?.status).toBe('FRIENDLY');
  });

  it('CONSTRUCT_BUILT_WORK advances the engineering canon', async () => {
    const { posted, send } = await bootWorker();
    send({ type: 'INIT', sab: new SharedArrayBuffer(SAB_BYTE_LENGTH) });
    posted.length = 0;

    send({ type: 'CONSTRUCT_BUILT_WORK', workId: 'work_lime_cement' });

    const campaign = lastCampaign(posted);
    expect(campaign?.builtWorks.engineeringCanonCount).toBe(1);
    expect(campaign?.builtWorks.works.work_lime_cement).toBe(true);
  });

  it('EXECUTE_MISSION dispatches an operative and applies estate deltas', async () => {
    const { posted, send } = await bootWorker();
    send({ type: 'INIT', sab: new SharedArrayBuffer(SAB_BYTE_LENGTH) });
    posted.length = 0;

    send({ type: 'EXECUTE_MISSION', operativeId: 'op_courier', verb: 'SCOUT' });

    const campaign = lastCampaign(posted);
    expect(campaign?.missions.missionsDispatchedCount).toBe(1);
    expect(posted.some((m) => m.type === 'EVENTS')).toBe(true);
  });

  it('MARK_LETTER_READ and SET_UNDERTOW_STANCE update their slices', async () => {
    const { posted, send } = await bootWorker();
    send({ type: 'INIT', sab: new SharedArrayBuffer(SAB_BYTE_LENGTH) });
    posted.length = 0;

    send({ type: 'MARK_LETTER_READ', letterId: 'letter_welcome_court' });
    send({ type: 'SET_UNDERTOW_STANCE', stance: 'JOIN' });

    const campaign = lastCampaign(posted);
    const letter = campaign?.correspondence.letters.find((l: any) => l.id === 'letter_welcome_court');
    expect(letter?.isRead).toBe(true);
    expect(campaign?.victories.undertowStance).toBe('JOIN');
  });

  it('ADVANCE accrues victory scores', async () => {
    const { posted, send } = await bootWorker();
    send({ type: 'INIT', sab: new SharedArrayBuffer(SAB_BYTE_LENGTH) });
    posted.length = 0;

    send({ type: 'ADVANCE', hours: 24 });

    const campaign = lastCampaign(posted);
    expect(campaign?.victories.scores.dominion).toBeGreaterThan(0);
  });

  it('falls back to initial campaign state when the save payload is malformed', async () => {
    const { posted, send } = await bootWorker();
    send({
      type: 'LOAD_WORLD',
      sab: new SharedArrayBuffer(SAB_BYTE_LENGTH),
      save: baseSave({
        influence: { powers: 'not-an-array' },
        correspondence: { letters: null },
        builtWorks: { works: null },
        missions: {},
        victories: { scores: null },
      } as any),
    });

    const campaign = lastCampaign(posted);
    expect(campaign?.influence.currentInfluencePool).toBe(20);
    expect(Array.isArray(campaign?.influence.powers)).toBe(true);
    expect(Array.isArray(campaign?.correspondence.letters)).toBe(true);
    expect(campaign?.builtWorks.engineeringCanonCount).toBe(0);
    expect(Array.isArray(campaign?.missions.operatives)).toBe(true);
    expect(campaign?.victories.scores.dominion).toBe(0);
  });

  it('LOAD_WORLD restores the campaign slice', async () => {
    const influence = createInitialInfluenceState(1);
    influence.currentInfluencePool = 77;
    const builtWorks = createInitialBuiltWorks();
    builtWorks.engineeringCanonCount = 3;
    const missions = createInitialMissions();
    missions.missionsDispatchedCount = 4;
    const correspondence = createInitialCorrespondence();
    correspondence.letters[0].isRead = true;
    const victories = createInitialVictoryState();
    victories.undertowStance = 'FEED';

    const { posted, send } = await bootWorker();
    send({
      type: 'LOAD_WORLD',
      sab: new SharedArrayBuffer(SAB_BYTE_LENGTH),
      save: baseSave({ influence, correspondence, builtWorks, missions, victories }),
    });

    const campaign = lastCampaign(posted);
    expect(campaign?.influence.currentInfluencePool).toBe(77);
    expect(campaign?.builtWorks.engineeringCanonCount).toBe(3);
    expect(campaign?.missions.missionsDispatchedCount).toBe(4);
    expect(campaign?.correspondence.letters[0].isRead).toBe(true);
    expect(campaign?.victories.undertowStance).toBe('FEED');
  });
});

describe('campaign layer — save round-trip', () => {
  it('preserves the campaign slice through serialize/deserialize', () => {
    const influence = createInitialInfluenceState(1);
    influence.currentInfluencePool = 42;
    const campaign = {
      influence,
      correspondence: createInitialCorrespondence(),
      builtWorks: createInitialBuiltWorks(),
      missions: createInitialMissions(),
      victories: createInitialVictoryState(),
    };

    const restored = deserializeSave(serializeSave(baseSave(campaign)));
    expect(restored.campaign?.influence?.currentInfluencePool).toBe(42);
  });
});
