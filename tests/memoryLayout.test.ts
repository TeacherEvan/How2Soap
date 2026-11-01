import { describe, expect, it } from 'vitest';
import {
  MAX_SPECIES,
  SAB_BYTE_LENGTH,
  SharedWorldView,
  TELEMETRY,
} from '../src/engine/memoryLayout';

describe('SharedWorldView layout', () => {
  it('allocates the arithmetically correct 67,648-byte buffer', () => {
    expect(SAB_BYTE_LENGTH).toBe(67648);
    const sab = new SharedArrayBuffer(SAB_BYTE_LENGTH);
    const view = new SharedWorldView(sab);
    expect(view.syncFlags.length).toBe(16);
    expect(view.vesselTelemetry.length).toBe(32 * 8);
    expect(view.vesselMoles.length).toBe(32 * MAX_SPECIES);
  });

  it('round-trips telemetry and moles at fixed strides', () => {
    const view = new SharedWorldView(new SharedArrayBuffer(SAB_BYTE_LENGTH));
    view.setTelemetry(3, TELEMETRY.TEMP_K, 345.25);
    view.setTelemetry(3, TELEMETRY.PH, 13.71);
    view.setMoles(3, 4, 0.52);
    expect(view.getTelemetry(3, TELEMETRY.TEMP_K)).toBe(345.25);
    expect(view.getTelemetry(3, TELEMETRY.PH)).toBe(13.71);
    expect(view.getMoles(3, 4)).toBe(0.52);
    expect(view.getMoles(4, 4)).toBe(0);
  });

  it('rejects a buffer that is too small', () => {
    expect(() => new SharedWorldView(new SharedArrayBuffer(1024))).toThrow(/too small/);
  });
});

describe('SeqLock torn-read protection', () => {
  it('refuses to read while the writer holds an odd lock', () => {
    const view = new SharedWorldView(new SharedArrayBuffer(SAB_BYTE_LENGTH));
    view.beginWorkerWrite();
    expect(() => view.readSnapshot(1)).toThrow(/consistent snapshot/);
    view.endWorkerWrite(1);
  });

  it('returns an immutable, consistent snapshot after an even lock', () => {
    const view = new SharedWorldView(new SharedArrayBuffer(SAB_BYTE_LENGTH));
    view.setMoles(0, 0, 55.5);
    view.beginWorkerWrite();
    view.setMoles(0, 0, 55.4);
    view.setTelemetry(0, TELEMETRY.TEMP_K, 373.15);
    view.endWorkerWrite(7);

    const snapshot = view.readSnapshot();
    expect(snapshot.tick).toBe(7);
    expect(snapshot.moles[0]).toBe(55.4);
    expect(snapshot.telemetry[TELEMETRY.TEMP_K]).toBe(373.15);

    view.setMoles(0, 0, 1);
    expect(snapshot.moles[0]).toBe(55.4);
  });
});
