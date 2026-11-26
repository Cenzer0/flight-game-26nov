// The screenshot scenes behind ?shot=start|play|approach|end. Each one
// plays the real rules forward from a fresh world, steered by the same
// autopilot a player could never out-fly — so every frame is what the real
// game looks like, and the same seed always gives the same frame.
import { STEP } from './config.js';
import { autopilotStick, startMission, stepWorld } from './world.js';
import { SCREEN_CRASHED, SCREEN_LANDED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

/** Step the world with the autopilot until `stop` says enough, or the cap. */
function flyFor(world, seconds, stop) {
  const maxSteps = Math.floor(seconds / STEP);
  for (let i = 0; i < maxSteps; i += 1) {
    stepWorld(world, autopilotStick(world));
    if (world.state !== 'play') break;
    if (stop && stop(world)) break;
  }
}

/** Set `world` to the named scene and return the screen to draw over it. */
export function stageShot(name, world) {
  if (name === 'start') {
    // Parked on the runway, engine idling, title cards over a live scene.
    startMission(world, 0);
    world.plane.throttle = 0.35;
    for (let i = 0; i < 4 / STEP; i += 1) {
      stepWorld(world, { pitch: 0, bank: 0, throttle: 0.35 });
      if (world.state !== 'play') break;
    }
    world.state = 'title';
    world.plane.throttle = 0;
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    // Twenty seconds in: climbing out over the sea, first ring dead ahead.
    startMission(world, 0);
    flyFor(world, 22, (w) => w.ringIndex >= 1);
    return { screen: SCREEN_PLAY, best: world.best };
  }
  if (name === 'approach') {
    // Final approach: all rings done, runway filling the windscreen.
    startMission(world, 0);
    flyFor(world, 240, (w) => {
      if (w.state !== 'play') return true;
      const p = w.plane;
      return w.ringIndex >= w.mission.rings.length && p.z > -850 && p.alt < 75;
    });
    if (world.state === 'play') return { screen: SCREEN_PLAY, best: world.best };
    return { screen: world.state === 'landed' ? SCREEN_LANDED : SCREEN_CRASHED, best: world.best };
  }
  // end: fly the whole first mission to a landing and show the score.
  startMission(world, 0);
  flyFor(world, 420, (w) => w.state !== 'play');
  if (world.state === 'landed') return { screen: SCREEN_LANDED, best: world.best };
  if (world.state === 'crashed') return { screen: SCREEN_CRASHED, best: world.best };
  return { screen: SCREEN_PLAY, best: world.best };
}
