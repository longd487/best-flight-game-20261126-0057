// Ridge Runner — boot and the game loop. In play the loop runs on a fixed
// step with the real rules; with ?shot= in the URL it stages one scene,
// draws one frame and stops, so a screenshot is a deterministic render.

import { STEP, VIEW } from './config.js';
import { World, EVENT_OVER, EVENT_RING, EVENT_WIN, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './world.js';
import { render } from './render.js';
import { attachInput, clearPressed, readStick, wasPressed } from './input.js';
import { clickBlip, crashThud, createAudio, ringChime, setMuted, unlockAudio, updateAudio } from './audio.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') ?? 1) || 1;

const world = new World(seed);
const input = attachInput(canvas);
const audio = createAudio();
let paused = false;
let time = 0;
let accumulator = 0;
let last = performance.now();

/** Start flying from the title screen. */
function startFlight() {
  unlockAudio(audio);
  clickBlip(audio);
  world.start();
  paused = false;
}

function onEvent(mask) {
  if (mask & EVENT_RING) ringChime(audio);
  if (mask & EVENT_OVER) crashThud(audio);
  if (mask & EVENT_WIN) ringChime(audio);
}

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  time += dt;

  if (wasPressed(input, 'mute')) setMuted(audio, !audio.muted);
  if (wasPressed(input, 'pause') && world.screen === SCREEN_PLAY) paused = !paused;

  if (world.screen === SCREEN_TITLE && wasPressed(input, 'confirm')) {
    startFlight();
  } else if (world.screen === SCREEN_OVER && wasPressed(input, 'restart')) {
    startFlight();
  } else if (world.screen === SCREEN_WIN && wasPressed(input, 'confirm')) {
    world.nextLevel();
  }

  if (!paused && world.screen === SCREEN_PLAY) {
    accumulator += dt;
    while (accumulator >= STEP) {
      accumulator -= STEP;
      const mask = world.step(STEP, readStick(input));
      if (mask) onEvent(mask);
      if (world.screen !== SCREEN_PLAY) break;
    }
  }
  updateAudio(audio, world.plane, world.screen === SCREEN_PLAY && !paused);
  render(ctx, world, time, 'day');
  clearPressed(input);
  requestAnimationFrame(frame);
}

if (shotName) {
  // Screenshot mode: stage the scene, draw one frame, stop. No loop,
  // no audio, no animation — the capture is the same every run.
  const staged = stageShot(shotName, world);
  render(ctx, world, 4, staged.palette);
  window.__shotReady = true;
} else {
  document.title = 'Ridge Runner — Alpine Air Courier';
  requestAnimationFrame(frame);
}
