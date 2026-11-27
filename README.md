# Ridge Runner — Alpine Air Courier

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/longd487/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/longd487/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

This repository is an entry for the make.fun bounty ["Make the best flight game"](https://make.fun/bounty/best-flight-game-20261126-0057). The entry is a complete flight game that runs in a desktop browser from its own static files, with no network request: a bush plane takes off from a valley strip, threads glowing rings down a winding river valley, and races the clock.

## The game

**Ridge Runner — Alpine Air Courier.** You fly a STOL bush plane through a mountain valley. Take off from the grass strip, climb over the river, and thread all eight rings before the clock runs out. Each ring is worth 100 points and adds 6 seconds. Clear the valley and the next one is faster, with tighter rings.

- Chase view over recognisable terrain: a winding river valley, patchwork fields, forested slopes, snow-capped ridges, and a runway with threshold bars and a windsock
- The aircraft in frame, banking with the stick, propeller spinning, navigation lights blinking
- Lit instruments: a compass tape, airspeed and altitude readouts, and a bottom panel with airspeed, attitude, altitude, heading and vertical-speed gauges
- A target ring ahead, with a diamond marker and distance readout, plus PULL UP and STALL warnings when the terrain or the wing disagrees with you
- Synthesised engine and wind sound (WebAudio, no audio files), ring chimes, and a crash thud

## How to play

Open `game/index.html` in a desktop browser (or serve `game/` with any static server). No install, no network.

| Control | What it does |
| --- | --- |
| Arrow keys / WASD | Steer — bank and climb / descend |
| Shift / Ctrl | Throttle up / down |
| Mouse | Steer by position; click to start |
| P | Pause |
| M | Sound on / off |
| R | Restart after a crash |
| Enter | Start / next valley |

Take off: hold Shift to spool up, and pull back (Up / W) once the airspeed passes rotation. Fly through the glowing ring to score. Mind the mountains — the valley floor is the only forgiving ground.

## How the entry works

`main.ts` (Node 22, standard library only) hands the game in: it copies `game/` and `screenshots/` to `/output` and writes `/output/dossier.json` with the kit's `buildDossier` from `vendor/makefun-game.ts`. Running it twice writes the same bytes twice:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

The screenshots under `screenshots/` are real renders of the game's own code in a browser: each one stages a deterministic scene (`?shot=ring|takeoff|valley|dusk&seed=1`) that plays the real rules forward under the autopilot in `game/src/shots.js`, so the same seed always gives the same frame.

## What's in this repo

| File | What it is |
| --- | --- |
| `main.ts` | The entrypoint: copies the game and screenshots, writes the dossier |
| `vendor/makefun-game.ts` | The kit's dossier library, unchanged |
| `game/index.html` | The page shell: a 1280×800 canvas, no external references |
| `game/src/config.js` | View, flight model, course and palette constants |
| `game/src/random.js` | Seeded PRNG and value noise for the world |
| `game/src/world.js` | Terrain, the aircraft, the rings, the rules, the autopilot |
| `game/src/render.js` | Sky, terrain strips, river, runway, rings, clouds |
| `game/src/aircraft.js` | The bush plane in chase view |
| `game/src/hud.js` | Compass tape, readouts, lit instruments, screens |
| `game/src/input.js` | Keyboard and mouse |
| `game/src/audio.js` | Synthesised engine, wind, chimes |
| `game/src/shots.js` | The four deterministic screenshot scenes |
| `game/src/main.js` | Boot and the fixed-step game loop |
| `screenshots/` | Four real renders of the game (the first is the cover) |

<sub>Entered on [make.fun](https://make.fun/?ref=longd487&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
