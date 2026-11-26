// Small WebAudio sound effects, synthesised — no audio files to ship.
// The engine is a low sawtooth whose pitch follows the throttle, with a
// soft wind noise beside it; rings chime, landings sing, crashes thud.
let ctx = null;
let engineOsc = null;
let engineGain = null;
let windGain = null;
let muted = false;

function ensureContext() {
  if (ctx) return true;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return false;
    ctx = new AudioContext();
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 52;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 320;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(ctx.destination);
    engineOsc.start();
    // Wind: a looped noise buffer through a band-pass filter.
    const len = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 480;
    windGain = ctx.createGain();
    windGain.gain.value = 0;
    noise.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(ctx.destination);
    noise.start();
    return true;
  } catch {
    return false;
  }
}

function tone(freq, at, dur, type = 'sine', vol = 0.12) {
  if (!ctx || muted) return;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, ctx.currentTime + at);
  gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + at + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + at + dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime + at);
  osc.stop(ctx.currentTime + at + dur + 0.05);
}

export const sfx = {
  /** Call from the first user gesture so the browser allows sound. */
  unlock() {
    if (ensureContext() && ctx.state === 'suspended') ctx.resume().catch(() => {});
  },
  /** Follow the throttle and the airspeed every frame while flying. */
  engine(throttle, speed) {
    if (!ctx || muted || !engineGain) return;
    engineOsc.frequency.value = 46 + throttle * 58 + speed * 0.25;
    engineGain.gain.value = 0.015 + throttle * 0.035;
    windGain.gain.value = Math.min(0.05, speed * 0.00045);
  },
  click() {
    if (ensureContext()) tone(660, 0, 0.08, 'square', 0.05);
  },
  ring() {
    if (ensureContext()) {
      tone(880, 0, 0.22);
      tone(1318, 0.09, 0.3);
    }
  },
  land() {
    if (ensureContext()) {
      tone(523, 0, 0.18);
      tone(659, 0.12, 0.18);
      tone(784, 0.24, 0.34);
    }
  },
  crash() {
    if (!ensureContext()) return;
    const noise = ctx.createBufferSource();
    noise.buffer = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
    const data = noise.buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const gain = ctx.createGain();
    gain.gain.value = 0.25;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 240;
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start();
    tone(70, 0, 0.4, 'sine', 0.2);
  },
  warn() {
    if (ensureContext()) tone(220, 0, 0.16, 'square', 0.06);
  },
};

export function toggleMute() {
  muted = !muted;
  if (engineGain) engineGain.gain.value = 0;
  if (windGain) windGain.gain.value = 0;
  return muted;
}
