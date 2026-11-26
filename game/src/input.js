// Keyboard and mouse, read by the loop once a frame. Arrow keys fly the
// plane, W/S work the throttle, and the mouse steers while its button is held
// and works the on-screen buttons and the throttle bar.
import { H, W } from './config.js';

export function createInput(canvas, world) {
  const keys = new Set();
  const queue = [];
  let mouse = { x: W / 2, y: H / 2, down: false };

  function push(type, data) {
    queue.push({ type, ...data });
  }

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
      event.preventDefault();
    }
    if (event.repeat) return;
    keys.add(event.key.toLowerCase());
    if (event.key === ' ') push('confirm');
    else if (event.key === 'p' || event.key === 'P' || event.key === 'Escape') push('pause');
    else if (event.key === 'm' || event.key === 'M') push('mute');
    else if (event.key === 'r' || event.key === 'R') push('restart');
    else if (event.key === '1') push('mission', { index: 0 });
    else if (event.key === '2') push('mission', { index: 1 });
    else if (event.key === '3') push('mission', { index: 2 });
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.key.toLowerCase());
  });
  window.addEventListener('blur', () => keys.clear());

  function readMouse(event) {
    const rect = canvas.getBoundingClientRect();
    mouse = {
      x: ((event.clientX - rect.left) / rect.width) * W,
      y: ((event.clientY - rect.top) / rect.height) * H,
      down: mouse.down,
    };
  }
  canvas.addEventListener('mousemove', readMouse);
  canvas.addEventListener('mousedown', (event) => {
    readMouse(event);
    mouse.down = true;
    push('click', { x: mouse.x, y: mouse.y });
  });
  window.addEventListener('mouseup', () => {
    mouse.down = false;
  });

  return {
    /** Drain the queued one-shot actions (clicks, keys that act once). */
    takeQueue() {
      return queue.splice(0, queue.length);
    },
    /** The held stick: pitch, bank and throttle from keys and mouse. */
    readStick() {
      let pitch = 0;
      let bank = 0;
      if (keys.has('arrowup')) pitch -= 1;
      if (keys.has('arrowdown')) pitch += 1;
      if (keys.has('arrowleft')) bank -= 1;
      if (keys.has('arrowright')) bank += 1;
      // Mouse steering: hold the button and the plane banks towards the
      // pointer, climbing when it rides high on the screen.
      if (mouse.down) {
        bank += Math.max(-1, Math.min(1, (mouse.x - W / 2) / (W * 0.28)));
        pitch += Math.max(-1, Math.min(1, (H * 0.42 - mouse.y) / (H * 0.28))) * -1;
      }
      let throttle = world.plane.throttle;
      if (keys.has('w')) throttle = Math.min(1, throttle + 0.012);
      if (keys.has('s')) throttle = Math.max(0, throttle - 0.012);
      return {
        pitch: Math.max(-1, Math.min(1, pitch)),
        bank: Math.max(-1, Math.min(1, bank)),
        throttle,
      };
    },
    /** Where the mouse is now, in stage pixels. */
    mouse() {
      return mouse;
    },
  };
}
