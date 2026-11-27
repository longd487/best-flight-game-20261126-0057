// Ridge Runner — the screenshot scenes behind ?shot=ring|takeoff|valley|dusk.
// Each one plays the real rules forward from a fresh world for a fixed
// number of steps, steered by the autopilot, so the frame is what a real
// game reaches and the same seed always gives the same frame.

import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN, simulate } from './world.js';

const SECONDS = {
  takeoff: 7,
  ring: 26,
  valley: 42,
  dusk: 32,
};

/** Forward distance to the next ring, in metres. */
function ringAhead(world) {
  const ring = world.nextRingObj;
  if (!ring) return Infinity;
  const p = world.plane;
  return (ring.z - p.z) * Math.cos(p.heading) + (ring.x - p.x) * Math.sin(p.heading);
}

/**
 * After the base staging, keep flying until the next ring fills the
 * frame (or the extra budget runs out), so the ring is a presence in the
 * shot rather than a speck on the horizon.
 */
function closeOnRing(world, target, extraSeconds) {
  const steps = Math.round(extraSeconds * 60);
  for (let i = 0; i < steps; i += 1) {
    if (ringAhead(world) <= target) break;
    simulate(world, 1 / 60);
    if (world.screen === SCREEN_OVER || world.screen === SCREEN_WIN) break;
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * Any unknown name stages the title-on-the-strip scene.
 */
export function stageShot(name, world) {
  world.reset(1);
  // The rules only run in play, so stage under play and put the title
  // overlay back on afterwards for the take-off scene.
  world.screen = SCREEN_PLAY;
  if (name === 'takeoff') {
    simulate(world, SECONDS.takeoff);
    world.screen = SCREEN_TITLE;
    return { screen: SCREEN_TITLE, palette: 'day' };
  }
  if (name === 'dusk') {
    simulate(world, SECONDS.dusk);
    closeOnRing(world, 380, 10);
    if (world.screen === SCREEN_OVER || world.screen === SCREEN_WIN) {
      world.screen = SCREEN_PLAY;
    }
    return { screen: SCREEN_PLAY, palette: 'dusk' };
  }
  if (name === 'valley') {
    simulate(world, SECONDS.valley);
    closeOnRing(world, 380, 10);
    if (world.screen === SCREEN_OVER || world.screen === SCREEN_WIN) {
      world.screen = SCREEN_PLAY;
    }
    return { screen: SCREEN_PLAY, palette: 'day' };
  }
  // 'ring' and anything else: mid-flight, next ring ahead, HUD lit.
  simulate(world, SECONDS.ring);
  closeOnRing(world, 320, 10);
  if (world.screen === SCREEN_OVER || world.screen === SCREEN_WIN) {
    world.screen = SCREEN_PLAY;
  }
  return { screen: SCREEN_PLAY, palette: 'day' };
}

/** The four shots, in the order they are handed in (first is the cover). */
export const SHOTS = [
  { name: '1-ring.jpg', query: '?shot=ring&seed=1' },
  { name: '2-takeoff.jpg', query: '?shot=takeoff&seed=1' },
  { name: '3-valley.jpg', query: '?shot=valley&seed=1' },
  { name: '4-dusk.jpg', query: '?shot=dusk&seed=1' },
];
