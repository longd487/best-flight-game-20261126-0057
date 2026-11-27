// Ridge Runner — the world: terrain, the aircraft, the rings and the rules.
// Everything here is deterministic for a given seed: the same seed builds
// the same valley, the same rings and the same clouds, so a screenshot
// staged from it always shows the same frame.

import { COURSE, FLIGHT, RUNWAY, STEP, TERRAIN } from './config.js';
import { clamp, lerp, mulberry32, noise1, noise2, smoothstep } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

export const EVENT_NONE = 0;
export const EVENT_RING = 1;
export const EVENT_OVER = 2;
export const EVENT_WIN = 4;

/** The valley's centreline: where the river, the runway line and the rings sit. */
export function valleyCentre(z) {
  return 260 * Math.sin(z * 0.00011) + 120 * Math.sin(z * 0.00029 + 0.6);
}

/**
 * Ground height at a world point. The valley floor runs along the
 * centreline; the ground rises into mountains either side, with noisy
 * ridges. The runway rectangle is flattened to the strip height.
 */
export function terrainHeight(x, z, seed) {
  const cx = valleyCentre(z);
  const d = Math.abs(x - cx);
  const floor = TERRAIN.floor + 6 * noise2(x * 0.004, z * 0.004, seed + 11);
  const rise = smoothstep(TERRAIN.flatHalf, TERRAIN.riseHalf, d);
  const ridge =
    TERRAIN.mountain +
    TERRAIN.peakExtra * (0.5 + 0.5 * noise1(x * 0.0016 + z * 0.0007, seed + 23));
  let h = floor + rise * ridge;
  h += rise * 26 * noise2(x * 0.01, z * 0.01, seed + 31);
  // Flatten the strip so the runway sits level.
  const inRunway =
    x > RUNWAY.x - RUNWAY.halfWidth - 30 &&
    x < RUNWAY.x + RUNWAY.halfWidth + 30 &&
    z > RUNWAY.zStart - 40 &&
    z < RUNWAY.zEnd + 40;
  if (inRunway) {
    const edge = Math.min(
      Math.abs(x - (RUNWAY.x - RUNWAY.halfWidth - 30)),
      Math.abs(x - (RUNWAY.x + RUNWAY.halfWidth + 30)),
      Math.abs(z - (RUNWAY.zStart - 40)),
      Math.abs(z - (RUNWAY.zEnd + 40)),
    );
    const blend = smoothstep(0, 30, edge);
    h = lerp(RUNWAY.height, h, blend);
  }
  return h;
}

/** Build one ring on the valley route. */
function makeRing(index, seed, level) {
  const rng = mulberry32(seed * 7919 + index * 104729 + level * 31);
  const z = COURSE.firstRingZ + index * COURSE.ringGap;
  const cx = valleyCentre(z);
  const x = cx + (rng() * 2 - 1) * 150;
  const ground = terrainHeight(x, z, seed);
  const y = ground + 70 + rng() * 90;
  return { index, x, y, z, r: COURSE.ringRadius, passed: false };
}

/** Build the cloud field for a level: seeded billboards above the valley. */
function makeClouds(seed, level) {
  const rng = mulberry32(seed * 104729 + level * 101);
  const clouds = [];
  for (let i = 0; i < 16; i += 1) {
    clouds.push({
      x: (rng() * 2 - 1) * 1600,
      y: 340 + rng() * 320,
      z: 400 + rng() * 4200,
      s: 90 + rng() * 160,
      puffs: 3 + Math.floor(rng() * 3),
      seed: Math.floor(rng() * 100000),
    });
  }
  return clouds;
}

export class World {
  constructor(seed = 1) {
    this.seed = seed;
    this.best = 0;
    this.reset(1);
  }

  reset(level = 1) {
    this.level = level;
    this.screen = SCREEN_TITLE;
    this.score = 0;
    this.ringsHit = 0;
    this.timeLeft = COURSE.levelTime;
    this.elapsed = 0;
    this.message = '';
    this.messageUntil = 0;
    this.warning = '';
    this.particles = [];
    this.clouds = makeClouds(this.seed, level);
    this.rings = [];
    for (let i = 0; i < COURSE.ringsPerLevel; i += 1) {
      this.rings.push(makeRing(i, this.seed, level));
    }
    this.nextRing = 0;
    // The aircraft starts on the strip, lined up, engines idling.
    this.plane = {
      x: RUNWAY.x,
      z: 40,
      alt: RUNWAY.height,
      heading: 0,
      pitch: 0,
      roll: 0,
      speed: 0,
      throttle: 0,
      onGround: true,
    };
    this.crash = null;
  }

  get nextRingObj() {
    return this.rings[this.nextRing] ?? null;
  }

  say(text, seconds = 2.5) {
    this.message = text;
    this.messageUntil = this.elapsed + seconds;
  }

  /** Burst of confetti when a ring is flown. */
  burst(x, y, z, colour) {
    const rng = mulberry32(this.seed * 13 + this.ringsHit * 977 + 5);
    for (let i = 0; i < 26; i += 1) {
      this.particles.push({
        x,
        y,
        z,
        vx: (rng() * 2 - 1) * 14,
        vy: (rng() * 2 - 1) * 14,
        vz: (rng() * 2 - 1) * 14,
        life: 0.9 + rng() * 0.5,
        age: 0,
        colour,
      });
    }
  }

  /**
   * One fixed step of the real rules. `input` is { pitch, roll, throttle }
   * with each axis in -1..1 (throttle is a delta). Returns an event mask.
   */
  step(dt, input) {
    if (this.screen !== SCREEN_PLAY) return EVENT_NONE;
    const p = this.plane;
    this.elapsed += dt;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      return this.endFlight(false, 'OUT OF TIME');
    }

    // Throttle chases the stick; speed chases the throttle.
    p.throttle = clamp(p.throttle + input.throttle * dt * 0.7, 0, 1);
    const targetSpeed = FLIGHT.baseSpeed + p.throttle * (FLIGHT.maxSpeed - FLIGHT.baseSpeed);
    p.speed += clamp(targetSpeed - p.speed, -FLIGHT.accel * dt, FLIGHT.accel * dt);

    // Attitude chases the stick.
    const wantPitch = input.pitch * FLIGHT.maxPitch;
    const wantRoll = input.roll * FLIGHT.maxRoll;
    p.pitch += clamp(wantPitch - p.pitch, -FLIGHT.pitchRate * dt, FLIGHT.pitchRate * dt);
    p.roll += clamp(wantRoll - p.roll, -FLIGHT.rollRate * dt, FLIGHT.rollRate * dt);

    // A bank turns the aircraft; a climb trades speed for height.
    p.heading -= p.roll * FLIGHT.turnRate * (p.speed / 60) * dt;
    const climb = p.onGround ? 0 : Math.sin(p.pitch) * p.speed * 0.92;
    p.x += Math.sin(p.heading) * p.speed * dt;
    p.z += Math.cos(p.heading) * p.speed * dt;
    p.alt = Math.min(FLIGHT.ceiling, p.alt + climb * dt);

    // Take-off: hold the strip until rotation speed, then lift with
    // enough clearance that the next step is not a terrain strike.
    if (p.onGround) {
      p.alt = RUNWAY.height;
      if (p.speed >= FLIGHT.rotateSpeed && p.pitch > 0.08) {
        p.onGround = false;
        p.alt = RUNWAY.height + 4;
        this.say('AIRBORNE — GEAR UP, FLAPS UP');
      }
    }

    // Stall: too slow in the air and the wing gives up.
    if (!p.onGround && p.speed < FLIGHT.minSpeed) {
      p.alt -= (FLIGHT.minSpeed - p.speed) * 0.9 * dt;
    }

    // Terrain. Half a metre of grace: the wing clears the ground on
    // rotation, and only a real strike ends the flight.
    const ground = terrainHeight(p.x, p.z, this.seed);
    if (!p.onGround && p.alt <= ground + 0.5) {
      this.crash = { x: p.x, y: ground, z: p.z };
      return this.endFlight(true, 'TERRAIN — YOU FLEW INTO THE MOUNTAIN');
    }

    // Warnings for the HUD.
    const clearance = p.alt - ground;
    if (!p.onGround && clearance < 55 && climb < 0) {
      this.warning = 'PULL UP';
    } else if (!p.onGround && p.speed < FLIGHT.minSpeed + 4) {
      this.warning = 'STALL';
    } else {
      this.warning = '';
    }

    // Rings: flown when the aircraft crosses the ring's plane inside it.
    const ring = this.nextRingObj;
    if (ring) {
      const prevZ = p.z - Math.cos(p.heading) * p.speed * dt;
      const crossed =
        (prevZ < ring.z && p.z >= ring.z) || (prevZ > ring.z && p.z <= ring.z);
      if (crossed) {
        const dx = p.x - ring.x;
        const dy = p.alt - ring.y;
        const dist = Math.hypot(dx, dy);
        if (dist < ring.r) {
          ring.passed = true;
          this.nextRing += 1;
          this.ringsHit += 1;
          this.score += COURSE.ringPoints;
          this.timeLeft += COURSE.ringTimeBonus;
          this.burst(ring.x, ring.y, ring.z, '#37e08b');
          this.say(`RING ${ring.index + 1} — +${COURSE.ringPoints}  ·  +${COURSE.ringTimeBonus}s`);
          if (this.nextRing >= this.rings.length) {
            return this.winLevel();
          }
        }
      }
    }

    // Particles age out.
    for (const pt of this.particles) {
      pt.age += dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.z += pt.vz * dt;
      pt.vy -= 6 * dt;
    }
    this.particles = this.particles.filter((pt) => pt.age < pt.life);
    return EVENT_NONE;
  }

  endFlight(crashed, reason) {
    this.screen = SCREEN_OVER;
    this.best = Math.max(this.best, this.score);
    this.crashReason = reason;
    this.crashed = crashed;
    if (crashed) this.burst(this.plane.x, this.plane.alt, this.plane.z, '#ff7a3c');
    return EVENT_OVER;
  }

  winLevel() {
    const bonus = Math.round(this.timeLeft) * COURSE.levelBonusPerSecond;
    this.score += bonus;
    this.best = Math.max(this.best, this.score);
    this.screen = SCREEN_WIN;
    this.levelBonus = bonus;
    return EVENT_WIN;
  }

  nextLevel() {
    const keepScore = this.score;
    const keepBest = this.best;
    this.reset(this.level + 1);
    this.score = keepScore;
    this.best = keepBest;
    this.screen = SCREEN_PLAY;
  }

  start() {
    this.reset(this.level);
    this.screen = SCREEN_PLAY;
  }
}

/**
 * The autopilot behind the screenshots: it flies the real rules forward,
 * so a staged frame is a moment a real game reaches. On the strip it
 * holds the centreline, opens the throttle and rotates; in the air it
 * banks toward the next ring and pitches for its height.
 */
export function autopilot(world) {
  const p = world.plane;
  if (p.onGround) {
    return { pitch: 1, roll: -p.heading * 2, throttle: 1 };
  }
  const ring = world.nextRingObj;
  // Terrain first: never trade a ring for a mountainside.
  const ground = terrainHeight(p.x, p.z, world.seed);
  if (p.alt - ground < 60) {
    return { pitch: 1, roll: 0, throttle: 0.9 };
  }
  if (!ring) return { pitch: 0, roll: 0, throttle: 0.6 };
  const wantHeading = Math.atan2(ring.x - p.x, ring.z - p.z);
  let dh = wantHeading - p.heading;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  const roll = clamp(-dh * 1.4, -1, 1);
  const altErr = ring.y - p.alt;
  const pitch = clamp(altErr * 0.012, -1, 1);
  return { pitch, roll, throttle: 0.75 };
}

/** Fixed-step helper: run the world forward `seconds` under the autopilot. */
export function simulate(world, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (world.step(STEP, autopilot(world)) & (EVENT_OVER | EVENT_WIN)) break;
  }
}
