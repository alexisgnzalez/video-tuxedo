/**
 * Deterministic PRNG (Mulberry32) for reproducible procedural art
 * (Petare hill houses, El Ávila mountain facets, clouds, Soto lines).
 */
export function createRNG(seed: number) {
  let s = seed >>> 0;
  return function next(): number {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Returns random float in [min, max) using provided RNG function */
export function randRange(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** Returns random integer in [min, max] using provided RNG function */
export function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(randRange(rng, min, max + 1));
}

/** Picks random item from array using provided RNG function */
export function randChoice<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}
