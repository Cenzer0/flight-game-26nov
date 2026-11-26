// Boot and the one loop: input is drained every frame, the world advances
// in fixed 1/60 s steps, and the renderer paints what is there. The game
// moves between five screens: title, play, paused, landed and crashed.
//
// ?seed=N fixes the island scatter. ?shot=start|play|approach|end (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_CRASH, EVENT_LAND, EVENT_OVER, EVENT_RING, EVENT_WARN, startMission, stepWorld } from './world.js';
import { createInput } from './input.js';
import { createRenderer, OVER_BUTTON, SCREEN_CRASHED, SCREEN_LANDED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, TITLE_CARDS } from './render.js';
import { stageShot } from './shots.js';
import { sfx, toggleMute } from './audio.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261126;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score lasts this visit.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, world);
  let screen = SCREEN_TITLE;
  let best = readBest();
  world.best = best;
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function beginMission(index) {
    sfx.unlock();
    startMission(world, index);
    world.best = best;
    screen = SCREEN_PLAY;
    announce(`Misi ${index + 1}: ${world.mission.name}. Terbang melewati ring, lalu mendarat.`);
  }

  function finishFlight() {
    if (world.score > best) {
      best = world.score;
      world.best = best;
      saveBest(best);
    }
    announce(world.state === 'landed'
      ? `Misi selesai! Skor ${world.score}. Terbaik ${best}.`
      : `Pesawat jatuh — ${world.crashReason}. Skor ${world.score}.`);
  }

  function hit(rect, x, y) {
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  }

  function handleQueue() {
    for (const item of input.takeQueue()) {
      if (item.type === 'click') {
        sfx.unlock();
        if (screen === SCREEN_TITLE) {
          for (let i = 0; i < TITLE_CARDS.length; i += 1) {
            if (hit(TITLE_CARDS[i], item.x, item.y)) {
              sfx.click();
              beginMission(i);
              break;
            }
          }
        } else if (screen === SCREEN_LANDED || screen === SCREEN_CRASHED) {
          if (hit(OVER_BUTTON, item.x, item.y)) {
            sfx.click();
            beginMission(world.missionIndex);
          }
        }
        continue;
      }
      if (item.type === 'confirm') {
        sfx.unlock();
        if (screen === SCREEN_TITLE) beginMission(world.missionIndex);
        else if (screen === SCREEN_PAUSED) screen = SCREEN_PLAY;
        else if (screen === SCREEN_LANDED || screen === SCREEN_CRASHED) beginMission(world.missionIndex);
        continue;
      }
      if (item.type === 'mute') {
        toggleMute();
        continue;
      }
      if (item.type === 'pause') {
        if (screen === SCREEN_PLAY) {
          screen = SCREEN_PAUSED;
          announce('Jeda.');
        } else if (screen === SCREEN_PAUSED) {
          screen = SCREEN_PLAY;
          announce('Bermain.');
        }
        continue;
      }
      if (item.type === 'restart') {
        if (screen !== SCREEN_TITLE) beginMission(world.missionIndex);
        continue;
      }
      if (item.type === 'mission') {
        if (screen === SCREEN_TITLE) beginMission(item.index);
        continue;
      }
    }
  }

  function step() {
    if (screen !== SCREEN_PLAY) return;
    const events = stepWorld(world, input.readStick());
    if (events & EVENT_RING) sfx.ring();
    if (events & EVENT_LAND) sfx.land();
    if (events & EVENT_CRASH) sfx.crash();
    if (events & EVENT_WARN) sfx.warn();
    if (events & EVENT_OVER) {
      screen = world.state === 'landed' ? SCREEN_LANDED : SCREEN_CRASHED;
      finishFlight();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleQueue();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step();
        accumulator -= STEP;
      }
      sfx.engine(world.plane.throttle, world.plane.speed);
    } else {
      accumulator = 0;
      sfx.engine(0, 0);
    }
    renderer.draw(world, screen);
  }

  // Leaving the tab pauses a running game rather than letting fuel burn.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Jeda.');
    }
  });

  announce('Langit Nusantara. Pilih misi, lalu terbang melewati ring dan mendarat.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
