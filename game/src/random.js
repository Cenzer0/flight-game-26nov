// A tiny seeded RNG (mulberry32) so the islands, clouds and mission scatter
// are the same every run for a given seed — screenshots stay reproducible.
export function createRandom(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A number in [min, max) from the seeded stream. */
export function range(random, min, max) {
  return min + random() * (max - min);
}

/** Pick one entry from a list with the seeded stream. */
export function pick(random, list) {
  return list[Math.floor(random() * list.length)];
}
