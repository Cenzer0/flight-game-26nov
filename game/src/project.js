// The chase camera and the world-to-screen projection. Everything in the
// scene is a point in metres (x east, z south, y up); the camera sits behind
// the plane, looks along its heading, and projects with a pinhole lens.
import { CAMERA_BACK, CAMERA_UP, FOCAL, H, LOOK_DOWN, W } from './config.js';

/** Where the horizon line sits on screen for this camera tilt. */
export function horizonY(camera) {
  return H * 0.5 - (camera.tilt - LOOK_DOWN) * FOCAL;
}

/** Build the camera from the plane: behind it, above it, tilted with pitch. */
export function makeCamera(plane) {
  const dirX = Math.sin(plane.heading);
  const dirZ = -Math.cos(plane.heading);
  return {
    x: plane.x - dirX * CAMERA_BACK,
    y: plane.alt + CAMERA_UP,
    z: plane.z - dirZ * CAMERA_BACK,
    heading: plane.heading,
    tilt: LOOK_DOWN + plane.pitch * 0.55,
  };
}

/**
 * Project a world point to screen pixels, or null when it is behind the lens
 * or too close to show. Returns {x, y, depth, scale} where scale shrinks a
 * metre at that depth to pixels.
 */
export function project(camera, px, py, pz) {
  const dx = px - camera.x;
  const dz = pz - camera.z;
  const sinH = Math.sin(camera.heading);
  const cosH = Math.cos(camera.heading);
  // Forward is -z at heading 0; right is +x at heading 0.
  const forward = -dx * sinH - dz * cosH;
  const right = dx * cosH - dz * sinH;
  if (forward < 3) return null;
  const up = py - camera.y;
  const scale = FOCAL / forward;
  return {
    x: W / 2 + right * scale,
    y: horizonY(camera) - (up - forward * camera.tilt) * scale,
    depth: forward,
    scale,
  };
}

/** True when the projected point lands inside the visible frame. */
export function onScreen(p, margin = 80) {
  return p && p.x > -margin && p.x < W + margin && p.y > -margin && p.y < H + margin;
}
