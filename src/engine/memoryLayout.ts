/**
 * Zero-copy shared world view with a SeqLock for torn-read protection.
 *
 * Layout (bytes):
 *   0     .. 64      syncFlags: Int32Array(16)  [0]=SeqLock, [1]=world tick
 *   64    .. 2112    vesselTelemetry: 32 vessels * 8 Float64
 *   2112  .. 67648   vesselMoles: 32 vessels * 256 Float64
 *
 * NOTE: the master spec states SAB_BYTE_LENGTH = 67584, but its own layout
 * arithmetic (64 + 2048 + 65536) requires 67648. The code in the spec also
 * ends at byte 67648. We use the arithmetically correct value; the spec's
 * literal constant is recorded as a known documentation defect.
 */
export const MAX_VESSELS = 32;
export const MAX_SPECIES = 256;
export const TELEMETRY_STRIDE = 8;
export const HEADER_BYTES = 64;
export const TELEMETRY_BYTES = MAX_VESSELS * TELEMETRY_STRIDE * 8; // 2048
export const MOLES_BYTES = MAX_VESSELS * MAX_SPECIES * 8; // 65536
export const SAB_BYTE_LENGTH = HEADER_BYTES + TELEMETRY_BYTES + MOLES_BYTES; // 67648

export const TELEMETRY = {
  TEMP_K: 0,
  PH: 1,
  PRESSURE_KPA: 2,
  VOLUME_L: 3,
  MAX_TEMP_K: 4,
  MAX_PRESSURE_KPA: 5,
  HEATER_W: 6,
  FLAGS: 7,
} as const;

export const FLAG_CLOSED = 1 << 0;
export const FLAG_RUPTURED = 1 << 1;
export const FLAG_BOILING = 1 << 2;

export interface WorldSnapshot {
  tick: number;
  telemetry: Float64Array;
  moles: Float64Array;
}

export class SharedWorldView {
  public readonly syncFlags: Int32Array;
  public readonly vesselTelemetry: Float64Array;
  public readonly vesselMoles: Float64Array;
  private lastSnapshot: WorldSnapshot | null = null;
  private lastConsistentSeq = -1;

  constructor(sab: SharedArrayBuffer) {
    if (sab.byteLength < SAB_BYTE_LENGTH) {
      throw new Error(
        `SharedArrayBuffer too small: ${sab.byteLength} < ${SAB_BYTE_LENGTH}`,
      );
    }
    this.syncFlags = new Int32Array(sab, 0, 16);
    this.vesselTelemetry = new Float64Array(
      sab,
      HEADER_BYTES,
      MAX_VESSELS * TELEMETRY_STRIDE,
    );
    this.vesselMoles = new Float64Array(
      sab,
      HEADER_BYTES + TELEMETRY_BYTES,
      MAX_VESSELS * MAX_SPECIES,
    );
  }

  /** Marks the start of a worker write. Counter becomes ODD. */
  public beginWorkerWrite(): void {
    Atomics.add(this.syncFlags, 0, 1);
  }

  /** Marks the end of a worker write. Counter becomes EVEN. */
  public endWorkerWrite(currentTick: number): void {
    Atomics.store(this.syncFlags, 1, currentTick);
    Atomics.add(this.syncFlags, 0, 1);
  }

  public getMoles(vesselIdx: number, speciesIdx: number): number {
    return this.vesselMoles[vesselIdx * MAX_SPECIES + speciesIdx];
  }

  public setMoles(vesselIdx: number, speciesIdx: number, moles: number): void {
    this.vesselMoles[vesselIdx * MAX_SPECIES + speciesIdx] = Math.max(0, moles);
  }

  public setTelemetry(
    vesselIdx: number,
    field: (typeof TELEMETRY)[keyof typeof TELEMETRY],
    value: number,
  ): void {
    this.vesselTelemetry[vesselIdx * TELEMETRY_STRIDE + field] = value;
  }

  public getTelemetry(
    vesselIdx: number,
    field: (typeof TELEMETRY)[keyof typeof TELEMETRY],
  ): number {
    return this.vesselTelemetry[vesselIdx * TELEMETRY_STRIDE + field];
  }

  /**
   * Copy a consistent snapshot of the shared world. Retries while the
   * SeqLock is odd or changed between the two reads.
   */
  public readSnapshot(maxAttempts = 32): WorldSnapshot {
    let attempt = 0;
    for (;;) {
      const before = Atomics.load(this.syncFlags, 0);
      if ((before & 1) === 0) {
        if (before === this.lastConsistentSeq && this.lastSnapshot !== null) {
          return this.lastSnapshot;
        }
        const tick = Atomics.load(this.syncFlags, 1);
        const telemetry = this.vesselTelemetry.slice();
        const moles = this.vesselMoles.slice();
        const after = Atomics.load(this.syncFlags, 0);
        if (before === after && (after & 1) === 0) {
          this.lastConsistentSeq = before;
          this.lastSnapshot = { tick, telemetry, moles };
          return this.lastSnapshot;
        }
      }
      attempt += 1;
      if (attempt >= maxAttempts) {
        if (this.lastSnapshot !== null) {
          return this.lastSnapshot;
        }
        throw new Error('SharedWorldView: unable to obtain a consistent snapshot');
      }
    }
  }
}
