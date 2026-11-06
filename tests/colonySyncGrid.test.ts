import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SAB_BYTE_LENGTH } from '../src/engine/memoryLayout';

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

function lastColonySync(posted: Array<Record<string, any>>): Record<string, any> | undefined {
  return posted.filter((m) => m.type === 'COLONY_SYNC').at(-1);
}

describe('colony sync — dirty-only desire-grid transfer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('sends the grid on the first sync, omits it while static, and resends after movement', async () => {
    const { posted, send } = await bootWorker();

    send({ type: 'INIT', sab: new SharedArrayBuffer(SAB_BYTE_LENGTH) });
    const initial = lastColonySync(posted);
    expect(initial?.colony.desirePathGrid).toBeInstanceOf(Uint8Array);

    posted.length = 0;
    send({
      type: 'RECRUIT_COLONIST',
      name: 'Walker',
      archetype: 'FORAGER',
      wageContract: { commodity: 'BAR_SOAP', dailyAmount: 1 },
    });
    const recruited = lastColonySync(posted);
    expect(recruited?.colony.desirePathGrid).toBeUndefined();
    const colonistId = recruited?.colony.colonists[0].id;
    expect(typeof colonistId).toBe('string');

    posted.length = 0;
    send({
      type: 'ASSIGN_COLONIST_JOB',
      colonistId,
      speciesId: 'TREE_WHITE_OAK',
      partId: 'OAK_HEARTWOOD_LOG',
    });
    send({ type: 'ADVANCE', hours: 1 });

    const afterTravel = lastColonySync(posted);
    expect(afterTravel?.colony.desirePathGrid).toBeInstanceOf(Uint8Array);
  });
});
