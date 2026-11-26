// The three sorties. Each one is a ring course over the archipelago that
// ends in a landing back on Pulau Bunga's runway: rings pay, a smooth
// landing pays more, and the fuel left over pays the rest.
import { RING_RADIUS, RUNWAY, START_FUEL } from './config.js';

export const MISSIONS = [
  {
    id: 0,
    name: 'Surat untuk Pulau Bunga',
    brief: 'Antar surat ke Pulau Api, lalu pulang dan mendarat di landasan.',
    dusk: false,
    fuel: START_FUEL,
    wind: 2,
    rings: [
      { x: 0, y: 170, z: -1250 },
      { x: 950, y: 220, z: -2150 },
      { x: 1650, y: 300, z: -2150 },
      { x: -500, y: 200, z: -1500 },
    ],
  },
  {
    id: 1,
    name: 'Penumpang Terakhir',
    brief: 'Enam ring melintasi sawah dan karang — bahan bakar pas-pasan.',
    dusk: false,
    fuel: 100,
    wind: 4,
    rings: [
      { x: -700, y: 150, z: -900 },
      { x: -1900, y: 130, z: -1300 },
      { x: -2400, y: 210, z: -2100 },
      { x: 300, y: 300, z: -2600 },
      { x: 1500, y: 240, z: -800 },
      { x: 700, y: 170, z: 1200 },
    ],
  },
  {
    id: 2,
    name: 'Senja di Selat',
    brief: 'Terbang senja dengan tangki tiga perempat — jangan boros gas.',
    dusk: true,
    fuel: 90,
    wind: 5,
    rings: [
      { x: 500, y: 200, z: -1400 },
      { x: 2300, y: 320, z: -2900 },
      { x: 900, y: 260, z: -3400 },
      { x: -900, y: 180, z: -3300 },
      { x: -400, y: 150, z: -1800 },
    ],
  },
];

/** The next ring the pilot must fly through, or null when all are done. */
export function nextRing(mission, ringIndex) {
  return ringIndex < mission.rings.length ? mission.rings[ringIndex] : null;
}

/** True when the plane's nose passes through the ring's disc. */
export function ringPassed(plane, ring) {
  const dx = plane.x - ring.x;
  const dy = plane.alt - ring.y;
  const dz = plane.z - ring.z;
  return dx * dx + dy * dy + dz * dz < RING_RADIUS * RING_RADIUS;
}

/** Points for a ring: full marks close to its centre, less at the edge. */
export function ringScore(plane, ring) {
  const dx = plane.x - ring.x;
  const dy = plane.alt - ring.y;
  const dz = plane.z - ring.z;
  const off = Math.sqrt(dx * dx + dy * dy + dz * dz) / RING_RADIUS;
  return Math.round(400 + 200 * Math.max(0, 1 - off));
}

/** Landing bonus: smoothness, speed discipline and fuel left over. */
export function landingBonus(plane) {
  const smooth = Math.max(0, 1 - Math.abs(plane.verticalSpeed) / 6);
  const slow = Math.max(0, 1 - Math.max(0, plane.speed - 40) / 22);
  const fuel = plane.fuel / 100;
  return Math.round(600 + 400 * smooth + 300 * slow + 500 * fuel);
}

/** The runway threshold the approach aims at, from the north, heading south. */
export function approachTarget() {
  return { x: RUNWAY.x, z: RUNWAY.zNorth - 500, land: true };
}

/** The touchdown point used by the autopilot's final leg. */
export function touchdownTarget() {
  return { x: RUNWAY.x, z: RUNWAY.zNorth + 120, land: true };
}
