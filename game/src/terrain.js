// The archipelago: five islands a pilot can recognise — a home island with
// the runway, a volcano island, a terraced island, a reef islet and a misty
// far island — plus the clouds that drift above them. All shapes are plain
// world-coordinate polygons; the renderer projects them.
import { LAND } from './config.js';
import { range } from './random.js';

/** Build one island's outline: a ring of points around its centre. */
function islandOutline(random, cx, cz, radius, wobble) {
  const points = [];
  const count = 14;
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2;
    const r = radius * (1 + (random() - 0.5) * wobble);
    points.push({ x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r * 0.85 });
  }
  return points;
}

/** Shrink a polygon towards its centre for the inner grass ring. */
export function shrinkOutline(points, cx, cz, factor) {
  return points.map((p) => ({
    x: cx + (p.x - cx) * factor,
    z: cz + (p.z - cz) * factor,
  }));
}

export function buildIslands(random) {
  const islands = [
    {
      name: 'Pulau Bunga',
      cx: 0, cz: 0, radius: 980, height: 10,
      kind: 'home',
      outline: islandOutline(random, 0, 0, 980, 0.22),
      villages: [
        { x: -260, z: 240, houses: 9 },
        { x: 300, z: -180, houses: 7 },
        { x: 180, z: 560, houses: 6 },
      ],
      palms: 26,
    },
    {
      name: 'Pulau Api',
      cx: 2300, cz: -2600, radius: 720, height: 14,
      kind: 'volcano',
      outline: islandOutline(random, 2300, -2600, 720, 0.18),
      volcano: { x: 2300, z: -2600, height: 320, base: 420 },
      villages: [{ x: 1980, z: -2250, houses: 8 }],
      palms: 10,
    },
    {
      name: 'Pulau Sawah',
      cx: -2500, cz: -1300, radius: 820, height: 12,
      kind: 'terraces',
      outline: islandOutline(random, -2500, -1300, 820, 0.2),
      terraces: { x: -2500, z: -1300, rings: 5, step: 110 },
      villages: [{ x: -2150, z: -1000, houses: 10 }],
      palms: 18,
    },
    {
      name: 'Pulau Karang',
      cx: 700, cz: 2500, radius: 340, height: 6,
      kind: 'reef',
      outline: islandOutline(random, 700, 2500, 340, 0.3),
      villages: [],
      palms: 8,
    },
    {
      name: 'Pulau Kabut',
      cx: -900, cz: -3600, radius: 620, height: 16,
      kind: 'mist',
      outline: islandOutline(random, -900, -3600, 620, 0.24),
      villages: [{ x: -700, z: -3400, houses: 6 }],
      palms: 12,
    },
  ];
  // Palm clusters: deterministic scatter inside each island.
  for (const island of islands) {
    island.palmSpots = [];
    for (let i = 0; i < island.palms; i += 1) {
      const a = random() * Math.PI * 2;
      const r = island.radius * (0.35 + random() * 0.5);
      island.palmSpots.push({
        x: island.cx + Math.cos(a) * r,
        z: island.cz + Math.sin(a) * r * 0.8,
      });
    }
  }
  return islands;
}

/** Clouds drift slowly above the sea; the renderer draws them far to near. */
export function buildClouds(random) {
  const clouds = [];
  for (let i = 0; i < 16; i += 1) {
    clouds.push({
      x: range(random, -3800, 3800),
      y: range(random, 320, 520),
      z: range(random, -4200, 3200),
      size: range(random, 90, 220),
      drift: range(random, 1.5, 4),
    });
  }
  return clouds;
}

/** Sea sparkle streaks: short dashes on the water that sell the motion. */
export function buildSparkles(random) {
  const sparkles = [];
  for (let i = 0; i < 90; i += 1) {
    sparkles.push({
      x: range(random, -4000, 4000),
      z: range(random, -4500, 3500),
      len: range(random, 18, 46),
    });
  }
  return sparkles;
}

/** Which island, if any, covers a world point (for crash vs land checks). */
export function islandAt(islands, x, z) {
  for (const island of islands) {
    const dx = (x - island.cx) / island.radius;
    const dz = (z - island.cz) / (island.radius * 0.85);
    if (dx * dx + dz * dz < 0.78) return island;
  }
  return null;
}

export { LAND };
