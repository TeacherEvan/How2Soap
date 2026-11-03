/** Deterministic PRNG for the sim worker. Never use Math.random() in the worker. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** fnv1a string hash → uint32, for callers that want a stable seed from text. */
export function hashSeed(input: string): number {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function createSeededRng(seed: number): {
  next: () => number;
  roll: (probability: number) => boolean;
  seed: number;
} {
  const next = mulberry32(seed >>> 0);
  return {
    next,
    roll: (probability: number) => next() < probability,
    seed: seed >>> 0,
  };
}
