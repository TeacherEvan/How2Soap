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

describe('ES-3 couplings are live in a fresh game', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('applies labor quality from an APPRENTICE_CHEMIST after one turn', async () => {
    const { posted, send } = await bootWorker();

    send({ type: 'INIT', sab: new SharedArrayBuffer(SAB_BYTE_LENGTH) });
    send({
      type: 'RECRUIT_COLONIST',
      name: 'Apprentice',
      archetype: 'APPRENTICE_CHEMIST',
      wageContract: { commodity: 'BAR_SOAP', dailyAmount: 1 },
    });

    posted.length = 0;
    send({ type: 'ADVANCE', hours: 24 });

    const ledgerSync = posted.filter((m) => m.type === 'LEDGER_SYNC').at(-1);
    expect(ledgerSync).toBeDefined();
    expect(ledgerSync?.couplingEffects?.laborQuality).not.toBeNull();
    expect(ledgerSync?.couplingSpoilageSeed).not.toBe(0);
  });

  it('honours an explicit off flag', async () => {
    const { posted, send } = await bootWorker();

    send({
      type: 'INIT',
      sab: new SharedArrayBuffer(SAB_BYTE_LENGTH),
      featureFlags: { colonyChemistryLink: false },
    });
    send({
      type: 'RECRUIT_COLONIST',
      name: 'Apprentice',
      archetype: 'APPRENTICE_CHEMIST',
      wageContract: { commodity: 'BAR_SOAP', dailyAmount: 1 },
    });

    posted.length = 0;
    send({ type: 'ADVANCE', hours: 24 });

    const ledgerSync = posted.filter((m) => m.type === 'LEDGER_SYNC').at(-1);
    expect(ledgerSync?.couplingEffects?.laborQuality ?? null).toBeNull();
    expect(ledgerSync?.couplingSpoilageSeed).toBe(0);
  });
});
