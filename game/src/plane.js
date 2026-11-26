// The flight model: one small prop courier plane, flown arcade-style.
// Throttle sets a target speed, pitch trades speed for altitude, bank turns
// the plane, and a slow wing stalls. Fuel and damage turn a sortie into
// decisions. The autopilot only feeds the same controls a player uses.
import { LANDING, PLANE, RUNWAY, STEP } from './config.js';

/** A fresh plane parked at the south threshold, nose pointing north. */
export function createPlane() {
  return {
    x: RUNWAY.x,
    z: RUNWAY.zSouth - 60,
    alt: 0,
    heading: 0, // north
    pitch: 0,
    bank: 0,
    speed: 0,
    throttle: 0,
    fuel: 100,
    damage: 0,
    verticalSpeed: 0,
    airborne: false,
    landed: false,
    crashed: false,
  };
}

/** Wrap an angle to [-PI, PI]. */
export function angleDiff(target, current) {
  let d = target - current;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Step the plane one tick. `ctl` is {pitch, bank, throttle} with pitch and
 * bank in [-1, 1] as stick deflection and throttle in [0, 1]. `wind` is a
 * sideways push in m/s. Returns nothing; the plane mutates in place.
 */
export function stepPlane(plane, ctl, wind, dt = STEP) {
  if (plane.crashed || plane.landed) return;
  const targetPitch = ctl.pitch * PLANE.maxPitch;
  const targetBank = ctl.bank * PLANE.maxBank;
  plane.pitch += clamp(targetPitch - plane.pitch, -PLANE.pitchRate * dt, PLANE.pitchRate * dt);
  plane.bank += clamp(targetBank - plane.bank, -PLANE.bankRate * dt, PLANE.bankRate * dt);
  plane.throttle = clamp(ctl.throttle, 0, 1);

  // Throttle chases a target speed; climbing and turning bleed it away.
  // An empty tank cuts the thrust: the plane glides, it does not fall.
  const effectiveThrottle = plane.fuel <= 0 ? 0 : plane.throttle;
  const targetSpeed = PLANE.minSpeed + effectiveThrottle * (PLANE.maxSpeed - PLANE.minSpeed);
  let speed = plane.speed + clamp(targetSpeed - plane.speed, -PLANE.accel * dt, PLANE.accel * dt);
  speed -= Math.max(0, plane.pitch) * PLANE.climbBleed * speed * dt * 4;
  speed -= Math.abs(plane.bank) * PLANE.turnBleed * speed * dt * 2;
  plane.speed = Math.max(0, speed);

  // A wing below flying speed sinks instead of climbing.
  const stalling = plane.speed < PLANE.minSpeed + 4;
  const climbRate = stalling
    ? -PLANE.glideSink
    : plane.speed * Math.sin(plane.pitch);
  plane.verticalSpeed = climbRate;
  plane.alt = Math.max(0, plane.alt + climbRate * dt);
  if (plane.alt > 0.5) plane.airborne = true;

  // Bank turns the nose; the turn rate grows as the wing bites.
  const turnRate = (9.81 * Math.tan(plane.bank)) / Math.max(plane.speed, 12);
  plane.heading += turnRate * dt;
  if (plane.heading > Math.PI) plane.heading -= Math.PI * 2;
  if (plane.heading < -Math.PI) plane.heading += Math.PI * 2;

  // Move along the heading, with the wind pushing sideways.
  const dx = Math.sin(plane.heading) * plane.speed * dt;
  const dz = -Math.cos(plane.heading) * plane.speed * dt;
  plane.x += dx + wind * dt * 0.4;
  plane.z += dz;

  // Fuel burns with the throttle; an empty tank means a glide, not a fall.
  if (plane.throttle > 0 && plane.fuel > 0) {
    plane.fuel = Math.max(0, plane.fuel - PLANE.fuelBurn * plane.throttle * dt);
  }
}

/** Is the plane sitting on the runway strip, aligned for a landing? */
export function runwayTouchdown(plane) {
  const onStrip =
    Math.abs(plane.x - RUNWAY.x) < RUNWAY.halfWidth &&
    plane.z > RUNWAY.zNorth - 30 &&
    plane.z < RUNWAY.zSouth + 30;
  if (!onStrip) return { ok: false };
  const headingError = Math.abs(angleDiff(RUNWAY.headingSouth, plane.heading));
  const ok =
    plane.verticalSpeed > -LANDING.maxVSpeed &&
    Math.abs(plane.bank) < LANDING.maxBank &&
    headingError < LANDING.maxHeadingError &&
    plane.speed < LANDING.maxSpeed;
  return {
    ok,
    headingError,
    reason: ok
      ? ''
      : headingError >= LANDING.maxHeadingError
        ? 'mendarat menyamping dari landasan'
        : Math.abs(plane.bank) >= LANDING.maxBank
          ? 'sayap miring saat menyentuh landasan'
          : plane.speed >= LANDING.maxSpeed
            ? 'terlalu cepat saat menyentuh landasan'
            : 'menukik terlalu curam ke landasan',
  };
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Autopilot for the screenshot scenes only: it feeds the same stick the
 * player holds, steering at the next ring, then at the runway threshold.
 * `target` is {x, y, z} in the air or {x, z, land: true} for the approach.
 */
export function autopilotControl(plane, target) {
  const dx = target.x - plane.x;
  const dz = target.z - plane.z;
  const dist = Math.hypot(dx, dz);
  // Heading to the target: north is -z, east is +x.
  const wantHeading = Math.atan2(dx, -dz);
  const headingError = angleDiff(wantHeading, plane.heading);
  const bank = clamp(headingError * 1.6, -1, 1);

  let pitch = 0;
  let throttle = 0.72;
  if (target.land) {
    // Final approach: low, slow, descending onto the strip. The heading
    // aims at a point far past the runway so the plane flies *through* the
    // strip, while the altitude follows the signed along-track distance to
    // the touchdown point — it keeps falling past it, so the wheels really
    // meet the concrete instead of levelling off a few metres above it.
    const dAlt = target.altAlong ?? dist;
    const wantAlt = dAlt > 400 ? dAlt * 0.055 : dAlt * 0.02;
    pitch = clamp((wantAlt - plane.alt) * 0.06, -0.6, 0.4);
    throttle = dist > 500 ? 0.55 : 0.34;
    if (plane.alt < 40 && dist < 260) throttle = 0.3;
  } else {
    const wantAlt = target.y;
    pitch = clamp((wantAlt - plane.alt) * 0.01, -0.8, 0.7);
    throttle = dist < 220 ? 0.55 : 0.75;
    if (plane.alt < wantAlt - 60) throttle = 0.85;
  }
  return { pitch, bank, throttle };
}
