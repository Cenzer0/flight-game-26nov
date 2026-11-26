// Langit Nusantara — Kurir Langit. Layout, tuning and palette in one place.
// The canvas is a fixed 1280x800 stage; the renderer scales it to the window.
// Distances are metres, speeds m/s, altitudes metres, headings radians
// (0 = north, turning clockwise). Every module reads its numbers from here.
export const W = 1280;
export const H = 800;
export const STEP = 1 / 60;

export const BEST_KEY = 'langit-nusantara-best';
export const START_FUEL = 100;

// Camera: metres behind the plane, metres above it, focal length in pixels,
// and how far below the horizon the lens looks by default.
export const CAMERA_BACK = 34;
export const CAMERA_UP = 10;
export const FOCAL = 780;
export const LOOK_DOWN = 0.085;

// The flight model: arcade, but throttle and turn discipline matter.
export const PLANE = {
  minSpeed: 24, // below this the wing stops flying
  cruiseSpeed: 58,
  maxSpeed: 92,
  accel: 14, // m/s gained per second towards the throttle target
  climbBleed: 0.22, // speed lost per radian of pitch while climbing
  turnBleed: 0.10, // speed lost per radian of bank while turning
  maxPitch: 0.38,
  pitchRate: 0.9, // rad/s towards the commanded pitch
  maxBank: 1.05,
  bankRate: 2.2, // rad/s towards the commanded bank
  fuelBurn: 0.35, // fuel units per second at full throttle
  glideSink: 9, // m/s sunk when the tank is dry and slow
};

export const RING_RADIUS = 30;
export const RUNWAY = {
  x: 0, // centre line, metres east of the home island centre
  zNorth: -420, // threshold at the north end
  zSouth: 420, // threshold at the south end
  halfWidth: 14,
  headingSouth: Math.PI, // land heading south (+z)
};

// Landing only counts when all of these hold at touchdown.
export const LANDING = {
  maxVSpeed: 6, // m/s of descent
  maxBank: 0.25, // rad
  maxHeadingError: 0.35, // rad off the runway heading
  maxSpeed: 62, // m/s over the threshold
};

// Palette: one style for sky, sea and land — a bright tropical morning,
// with a dusk variant for the third mission.
export const SKY = {
  day: { top: '#2f7fd0', mid: '#7db8e8', horizon: '#cfe8f7', sun: '#fff3b0' },
  dusk: { top: '#3a2d63', mid: '#c96f4a', horizon: '#f2b879', sun: '#ffdf8a' },
};
export const SEA = {
  day: { far: '#2b6ea6', near: '#3f8fbf', sparkle: '#bfe3f2' },
  dusk: { far: '#4a3a6e', near: '#7a5578', sparkle: '#e8b48a' },
};
export const LAND = {
  sand: '#e8d29a',
  grass: '#4d9e4f',
  jungle: '#2f7a38',
  hill: '#6db35e',
  volcano: '#5d4a42',
  lava: '#e05d2a',
  village: '#f2ead8',
  roof: '#c65a3c',
  terrace: '#8fbf6a',
  runway: '#3c4148',
  runwayLine: '#f5f0dc',
};
export const INK = '#12233a';
export const PANEL = '#0e1b2ee8';
export const PANEL_EDGE = '#2c4a6b';
export const LIT_GREEN = '#7dffa8';
export const LIT_AMBER = '#ffc857';
export const LIT_RED = '#ff6b5e';
export const LIT_CYAN = '#7de3ff';
