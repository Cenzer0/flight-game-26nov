// The game state: title, flying, paused, landed and crashed. The world
// owns the plane, the mission progress, the score and the clock; the loop
// feeds it one stick a tick and it answers with the events the loop sounds.
import { RUNWAY, STEP } from './config.js';
import { createRandom } from './random.js';
import { buildClouds, buildIslands, buildSparkles, islandAt } from './terrain.js';
import { angleDiff, autopilotControl, createPlane, runwayTouchdown, stepPlane } from './plane.js';
import { MISSIONS, landingBonus, nextRing, ringPassed, ringScore } from './missions.js';

export const EVENT_NONE = 0;
export const EVENT_RING = 1;
export const EVENT_LAND = 2;
export const EVENT_CRASH = 4;
export const EVENT_WARN = 8;
export const EVENT_OVER = 16;

export function createWorld(seed) {
  const random = createRandom(seed);
  return {
    seed,
    islands: buildIslands(random),
    clouds: buildClouds(random),
    sparkles: buildSparkles(random),
    missionIndex: 0,
    mission: MISSIONS[0],
    plane: createPlane(),
    ringIndex: 0,
    ringsDone: 0,
    score: 0,
    best: 0,
    time: 0,
    message: '',
    messageUntil: 0,
    state: 'title', // title | play | paused | landed | crashed
    crashReason: '',
    landing: null, // {bonus, smooth, slow, fuel} once landed
    warnedLowFuel: false,
    warnedStall: false,
  };
}

export function startMission(world, index) {
  world.missionIndex = index;
  world.mission = MISSIONS[index];
  world.plane = createPlane();
  world.plane.fuel = world.mission.fuel;
  world.ringIndex = 0;
  world.ringsDone = 0;
  world.score = 0;
  world.time = 0;
  world.message = world.mission.brief;
  world.messageUntil = 4;
  world.state = 'play';
  world.crashReason = '';
  world.landing = null;
  world.warnedLowFuel = false;
  world.warnedStall = false;
  world.onFinal = false;
  world.turning = false;
}

/** Show a centre-top message for `seconds`. */
export function flash(world, text, seconds = 2.5) {
  world.message = text;
  world.messageUntil = world.time + seconds;
}

function crash(world, reason) {
  world.state = 'crashed';
  world.crashReason = reason;
  world.plane.crashed = true;
  return EVENT_CRASH | EVENT_OVER;
}

/** Advance the world one tick with the given stick. Returns event flags. */
export function stepWorld(world, ctl, dt = STEP) {
  if (world.state !== 'play') return EVENT_NONE;
  let events = EVENT_NONE;
  world.time += dt;
  const plane = world.plane;
  const wind = world.mission.wind * Math.sin(world.time * 0.11);

  stepPlane(plane, ctl, wind, dt);

  // Rings: fly through the disc and it pays, then the next one lights up.
  const ring = nextRing(world.mission, world.ringIndex);
  if (ring && plane.airborne && ringPassed(plane, ring)) {
    const points = ringScore(plane, ring);
    world.score += points;
    world.ringIndex += 1;
    world.ringsDone += 1;
    flash(world, `RING! +${points}`, 2);
    events |= EVENT_RING;
  }

  // Touching down: a good landing on the strip ends the sortie in glory,
  // anything else is a crash with a reason the pilot can learn from.
  if (plane.airborne && plane.alt <= 0.5 && plane.verticalSpeed <= 0) {
    const island = islandAt(world.islands, plane.x, plane.z);
    const strip = runwayTouchdown(plane);
    if (strip.ok && world.ringIndex >= world.mission.rings.length) {
      const bonus = landingBonus(plane);
      world.score += bonus;
      world.landing = {
        bonus,
        rings: world.ringsDone,
        time: world.time,
        fuel: Math.round(plane.fuel),
      };
      plane.landed = true;
      plane.alt = 0;
      world.state = 'landed';
      flash(world, `MENDARAT MULUS! +${bonus}`, 3);
      return events | EVENT_LAND | EVENT_OVER;
    }
    if (strip.ok) {
      flash(world, 'Landasan benar — tapi ring belum semua dilewati! Lepas landas lagi.', 3);
      plane.alt = 0;
      plane.airborne = false;
      plane.speed = Math.max(plane.speed, 20);
      plane.verticalSpeed = 0;
      return events;
    }
    if (island) return events | crash(world, 'menabrak daratan Pulau ' + island.name);
    return events | crash(world, 'mencebur ke laut');
  }

  // Rolling on the ground off the strip (a runway overshoot, or a
  // touch-and-go that ran out of concrete) ends the sortie too.
  if (!plane.airborne && plane.alt <= 0.5 && plane.speed > 5) {
    const onStrip =
      Math.abs(plane.x - RUNWAY.x) < RUNWAY.halfWidth + 6 &&
      plane.z > RUNWAY.zNorth - 30 &&
      plane.z < RUNWAY.zSouth + 30;
    if (!onStrip) return events | crash(world, 'tergelincir keluar landasan');
  }

  // Flying into a hillside counts too: the volcano cone bites high above
  // the ground, so check it whenever the plane is over Pulau Api.
  const island = islandAt(world.islands, plane.x, plane.z);
  if (island && island.kind === 'volcano') {
    const dx = plane.x - island.volcano.x;
    const dz = plane.z - island.volcano.z;
    const dist = Math.hypot(dx, dz);
    const coneHeight = Math.max(0, island.volcano.height * (1 - dist / island.volcano.base));
    if (plane.alt < coneHeight) {
      return events | crash(world, 'menabrak lereng Gunung Api');
    }
  }

  // Warnings the pilot hears once: fuel and stall.
  if (plane.fuel < 20 && !world.warnedLowFuel) {
    world.warnedLowFuel = true;
    flash(world, 'BAHAN BAKAR RENDAH — cari landasan!', 3);
    events |= EVENT_WARN;
  }
  if (plane.fuel <= 0 && plane.alt > 120 && !world.warnedStall) {
    world.warnedStall = true;
    flash(world, 'TANGKI KOSONG — meluncur, jangan panik!', 3);
    events |= EVENT_WARN;
  }
  // Out of the archipelago: the sea has no edge, turn back.
  if (Math.hypot(plane.x, plane.z) > 5200) {
    flash(world, 'Terlalu jauh — putar balik ke kepulauan!', 2);
  }
  return events;
}

/** The stick the screenshot autopilot holds — same controls, no shortcuts. */
export function autopilotStick(world) {
  const ring = nextRing(world.mission, world.ringIndex);
  if (ring) return autopilotControl(world.plane, ring);
  // All rings done: land heading south. Three phases, all steered by a
  // lookahead point that moves with the plane, so the nose chases a point
  // 400 m ahead on the centreline and converges instead of orbiting a
  // fixed point: (1) fly to the gate north of the runway, (2) turn onto
  // the centreline holding 150 m, (3) fly the final down the strip.
  const plane = world.plane;
  const gateZ = RUNWAY.zNorth - 1300;
  const gateDist = Math.hypot(plane.x - RUNWAY.x, plane.z - gateZ);
  if (!world.onFinal && !world.turning && (gateDist < 500 || plane.z < gateZ)) {
    world.turning = true;
  }
  if (!world.onFinal && !world.turning) {
    return autopilotControl(plane, { x: RUNWAY.x, y: 150, z: gateZ });
  }
  if (!world.onFinal) {
    const southError = Math.abs(angleDiff(Math.PI, plane.heading));
    if (Math.abs(plane.x) < 200 && plane.z < -600 && southError < 0.9) {
      world.onFinal = true;
    } else {
      return autopilotControl(plane, { x: RUNWAY.x, y: 150, z: plane.z + 400 });
    }
  }
  // A missed approach climbs back to the gate for another try.
  if (plane.z > 500 && plane.alt > 5) {
    world.onFinal = false;
    world.turning = false;
    return autopilotControl(plane, { x: RUNWAY.x, y: 200, z: gateZ });
  }
  // Altitude follows the signed along-track distance to the touchdown
  // point (positive north of it, negative past it), so the glide keeps
  // falling through the touchdown instead of levelling off above it.
  const altAlong = (RUNWAY.zNorth + 120) - plane.z;
  return autopilotControl(plane, { x: RUNWAY.x, z: plane.z + 400, land: true, altAlong });
}
