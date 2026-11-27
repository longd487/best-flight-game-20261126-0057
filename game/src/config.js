// Ridge Runner — Alpine Air Courier.
// Shared constants for the flight game: view, physics, course and palettes.
// All distances are metres, all speeds metres per second, angles radians.
// Display converts to knots / feet at the HUD only.

export const VIEW = {
  width: 1280,
  height: 800,
  // Focal length of the chase camera in pixels. Larger = narrower view.
  focal: 760,
};

export const STEP = 1 / 60;

// Flight model. Speeds are m/s; 1 m/s is about 1.944 kt.
export const FLIGHT = {
  minSpeed: 30, // below this, airborne, the wing stalls
  baseSpeed: 34, // speed at idle throttle
  maxSpeed: 92, // speed at full throttle, level flight
  accel: 7, // how fast speed chases its throttle target
  rotateSpeed: 38, // take-off rotation speed on the runway
  maxPitch: 0.42, // steepest climb / dive the stick commands
  maxRoll: 1.05, // steepest bank the stick commands
  pitchRate: 1.6, // rad/s toward the commanded pitch
  rollRate: 2.4, // rad/s toward the commanded roll
  // Heading change per second at full bank, scaled by speed.
  turnRate: 0.34,
  ceiling: 900, // metres; the air thins out above this
};

// Course: one valley, eight rings, then the next valley.
export const COURSE = {
  ringsPerLevel: 8,
  ringRadius: 30,
  ringGap: 700, // metres between rings along the valley
  firstRingZ: 950,
  levelTime: 100, // seconds on the clock at the start of a level
  ringTimeBonus: 6, // seconds added per ring flown
  ringPoints: 100,
  levelBonusPerSecond: 10,
};

// The strip. The runway sits flat on the valley floor at the route start.
export const RUNWAY = {
  x: 0,
  zStart: 0,
  zEnd: 620,
  halfWidth: 13,
  height: 12,
};

// Sky palettes, picked per shot / level. Day is the normal game light,
// dusk is the golden-hour shot. Values are canvas colour stops.
export const PALETTES = {
  day: {
    skyTop: '#2f6fd0',
    skyMid: '#7fb2e8',
    skyLow: '#cfe6f7',
    sun: '#fff3c4',
    sunGlow: 'rgba(255, 236, 170, 0.55)',
    haze: '#cfe0ee',
    cloud: 'rgba(255,255,255,0.92)',
    cloudShade: 'rgba(226,238,248,0.9)',
  },
  dusk: {
    skyTop: '#2b3a6e',
    skyMid: '#c96a4e',
    skyLow: '#f7b267',
    sun: '#ffd9a0',
    sunGlow: 'rgba(255, 170, 90, 0.6)',
    haze: '#e8b48a',
    cloud: 'rgba(255, 214, 178, 0.92)',
    cloudShade: 'rgba(214, 150, 120, 0.9)',
  },
};

// The valley's winding centreline, terrain and field colours.
export const TERRAIN = {
  // Valley floor height and mountain height (metres).
  floor: 10,
  mountain: 320,
  peakExtra: 300,
  // How far from the centreline the valley stays flat, and where the
  // mountains take over (metres). Wide and gentle: rolling ridges, not
  // canyon walls.
  flatHalf: 320,
  riseHalf: 1600,
  // Snow starts above this height.
  snowLine: 520,
  // Patchwork field colours on the valley floor.
  fields: ['#7fae56', '#8fb95e', '#6da34e', '#a8b45a', '#5f9a52'],
  forest: '#3f7a3a',
  rock: '#8a7a68',
  snow: '#f4f7fa',
  water: '#3f8fd0',
  waterDeep: '#2b6cb0',
};
