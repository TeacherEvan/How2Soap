/**
 * Lightweight snapshot signature helper for change detection
 */

export interface SnapshotSignatureInput {
  tick: number;
  glucose: number;
  seed: number;
  molesDigest?: number;
  day?: number;
}

export function snapshotSignature(input: SnapshotSignatureInput): string {
  const t = Math.floor(input.tick ?? 0);
  const g = Math.round((input.glucose ?? 0) * 100) / 100;
  const s = input.seed ?? 0;
  const m = input.molesDigest ? Math.round(input.molesDigest * 1000) / 1000 : 0;
  const d = input.day ?? 0;
  return `${t}:${g}:${s}:${m}:${d}`;
}
