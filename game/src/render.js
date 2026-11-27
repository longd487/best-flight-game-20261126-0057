// Ridge Runner — world rendering: sky, terrain, river, runway, rings, clouds.
// The camera rides 16 m behind the aircraft and 4.5 m above it, looking
// along the aircraft's heading, so the world scrolls past a chase view.

import { PALETTES, RUNWAY, TERRAIN, VIEW } from './config.js';
import { clamp, lerp, noise2, smoothstep } from './random.js';
import { terrainHeight, valleyCentre } from './world.js';
import { drawPlane } from './aircraft.js';
import { drawHud, drawScreen } from './hud.js';

const { width: W, height: H, focal: FOCAL } = VIEW;

/** Chase camera: behind and above the aircraft, sharing its attitude. */
export function chaseCamera(plane) {
  const sh = Math.sin(plane.heading);
  const ch = Math.cos(plane.heading);
  return {
    x: plane.x - sh * 16,
    y: plane.alt + 4.5,
    z: plane.z - ch * 16,
    heading: plane.heading,
    pitch: plane.pitch,
    roll: plane.roll,
  };
}

/**
 * Project a world point into screen space. Returns null when the point is
 * behind the camera. `s` is the perspective scale at that depth.
 */
export function project(cam, x, y, z) {
  const dx = x - cam.x;
  const dy = y - cam.y;
  const dz = z - cam.z;
  const sh = Math.sin(cam.heading);
  const ch = Math.cos(cam.heading);
  const fwd = dx * sh + dz * ch;
  const right = dx * ch - dz * sh;
  if (fwd < 8) return null;
  const sp = Math.sin(cam.pitch);
  const cp = Math.cos(cam.pitch);
  const fwd2 = fwd * cp + dy * sp;
  const up2 = -fwd * sp + dy * cp;
  if (fwd2 < 8) return null;
  const s = FOCAL / fwd2;
  let sx = W / 2 + right * s;
  let sy = H / 2 - up2 * s;
  if (cam.roll !== 0) {
    const sr = Math.sin(cam.roll);
    const cr = Math.cos(cam.roll);
    const rx = sx - W / 2;
    const ry = sy - H / 2;
    sx = W / 2 + rx * cr - ry * sr;
    sy = H / 2 + rx * sr + ry * cr;
  }
  return { x: sx, y: sy, s, fwd: fwd2 };
}

/** Parse a colour written as #rrggbb or rgb(r,g,b) into [r, g, b]. */
function parseColour(c) {
  if (c.startsWith('#')) {
    const n = parseInt(c.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = c.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0];
}

/** Mix a colour toward another by t (0..1). Either may be hex or rgb(). */
export function mixHex(a, b, t) {
  const pa = parseColour(a);
  const pb = parseColour(b);
  const r = Math.round(lerp(pa[0], pb[0], t));
  const g = Math.round(lerp(pa[1], pb[1], t));
  const bl = Math.round(lerp(pa[2], pb[2], t));
  return `rgb(${r},${g},${bl})`;
}

function drawSky(ctx, palette, sunY) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, palette.skyTop);
  g.addColorStop(0.45, palette.skyMid);
  g.addColorStop(0.75, palette.skyLow);
  g.addColorStop(1, palette.haze);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Sun with a soft glow.
  const sg = ctx.createRadialGradient(W * 0.78, sunY, 4, W * 0.78, sunY, 180);
  sg.addColorStop(0, palette.sunGlow);
  sg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sg;
  ctx.fillRect(W * 0.78 - 190, sunY - 190, 380, 380);
  ctx.fillStyle = palette.sun;
  ctx.beginPath();
  ctx.arc(W * 0.78, sunY, 34, 0, Math.PI * 2);
  ctx.fill();
}

/** Ground colour for a terrain sample, by height and patchwork noise. */
function groundColour(h, px, pz, seed) {
  let base;
  if (h < 34) {
    const patch = Math.floor((noise2(px * 0.008, pz * 0.008, seed + 41) * 0.5 + 0.5) * 5);
    base = TERRAIN.fields[clamp(patch, 0, 4)];
  } else if (h < 170) {
    base = mixHex(TERRAIN.fields[1], TERRAIN.forest, smoothstep(34, 170, h));
  } else if (h < 360) {
    base = mixHex(TERRAIN.forest, TERRAIN.rock, smoothstep(170, 360, h));
  } else {
    base = mixHex(TERRAIN.rock, TERRAIN.snow, smoothstep(430, 560, h));
  }
  return base;
}

/** The valley floor and the mountains, as far-to-near perspective strips. */
function drawTerrain(ctx, cam, seed, palette) {
  const slices = 28;
  const lines = [];
  const rightX = Math.cos(cam.heading);
  const rightZ = -Math.sin(cam.heading);
  const fwdX = Math.sin(cam.heading);
  const fwdZ = Math.cos(cam.heading);
  for (let k = 0; k < slices; k += 1) {
    const d = 55 * Math.pow(1.15, k);
    const bx = cam.x + fwdX * d;
    const bz = cam.z + fwdZ * d;
    const line = [];
    for (let t = -1500; t <= 1500; t += 100) {
      const x = bx + rightX * t;
      const z = bz + rightZ * t;
      const y = terrainHeight(x, z, seed);
      const p = project(cam, x, y, z);
      line.push(p ? { ...p, h: y, x, z } : null);
    }
    lines.push({ d, line });
  }
  // Painter's order: farthest strip first.
  for (let k = slices - 1; k >= 1; k -= 1) {
    const far = lines[k];
    const near = lines[k - 1];
    const haze = clamp(near.d / 3200, 0, 0.62);
    for (let j = 0; j < near.line.length - 1; j += 1) {
      const a = far.line[j];
      const b = far.line[j + 1];
      const c = near.line[j + 1];
      const d0 = near.line[j];
      if (!a || !b || !c || !d0) continue;
      const h = (c.h + d0.h + a.h + b.h) / 4;
      const col = groundColour(h, (c.x + d0.x) / 2, (c.z + d0.z) / 2, seed);
      // The outermost columns fade into the haze so the terrain never
      // ends in a hard wall against the sky.
      const tMid = Math.abs(-1500 + (j + 0.5) * 100);
      const edge = smoothstep(1000, 1500, tMid) * 0.7;
      ctx.fillStyle = mixHex(col, palette.haze, haze * (1 - edge) + edge);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(d0.x, d0.y);
      ctx.closePath();
      ctx.fill();
    }
  }
}

/** The river ribbon, wound along the valley centreline. */
function drawRiver(ctx, cam, seed) {
  const ptsL = [];
  const ptsR = [];
  for (let z = cam.z + 20; z < cam.z + 2600; z += 50) {
    const cx = valleyCentre(z);
    const y = terrainHeight(cx, z, seed) + 0.6;
    const pl = project(cam, cx - 11, y, z);
    const pr = project(cam, cx + 11, y, z);
    if (pl) ptsL.push(pl);
    if (pr) ptsR.push(pr);
  }
  if (ptsL.length < 2 || ptsR.length < 2) return;
  const g = ctx.createLinearGradient(0, H * 0.5, 0, H);
  g.addColorStop(0, TERRAIN.water);
  g.addColorStop(1, TERRAIN.waterDeep);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(ptsL[0].x, ptsL[0].y);
  for (const p of ptsL) ctx.lineTo(p.x, p.y);
  for (let i = ptsR.length - 1; i >= 0; i -= 1) ctx.lineTo(ptsR[i].x, ptsR[i].y);
  ctx.closePath();
  ctx.fill();
}

/** The strip: asphalt, centreline dashes, thresholds and a windsock. */
function drawRunway(ctx, cam, seed) {
  const y = RUNWAY.height + 0.4;
  const step = 40;
  for (let z = RUNWAY.zStart; z < RUNWAY.zEnd; z += step) {
    const z2 = Math.min(z + step, RUNWAY.zEnd);
    const a = project(cam, RUNWAY.x - RUNWAY.halfWidth, y, z);
    const b = project(cam, RUNWAY.x + RUNWAY.halfWidth, y, z);
    const c = project(cam, RUNWAY.x + RUNWAY.halfWidth, y, z2);
    const d = project(cam, RUNWAY.x - RUNWAY.halfWidth, y, z2);
    if (!a || !b || !c || !d) continue;
    ctx.fillStyle = '#3a3f46';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();
    ctx.fill();
    // Centreline dash on every other segment.
    if (Math.floor(z / step) % 2 === 0) {
      const m1 = project(cam, RUNWAY.x - 1, y + 0.1, z + 6);
      const m2 = project(cam, RUNWAY.x + 1, y + 0.1, z + 6);
      const m3 = project(cam, RUNWAY.x + 1, y + 0.1, z + step - 6);
      const m4 = project(cam, RUNWAY.x - 1, y + 0.1, z + step - 6);
      if (m1 && m2 && m3 && m4) {
        ctx.fillStyle = '#f2f2e8';
        ctx.beginPath();
        ctx.moveTo(m1.x, m1.y);
        ctx.lineTo(m2.x, m2.y);
        ctx.lineTo(m3.x, m3.y);
        ctx.lineTo(m4.x, m4.y);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
  // Threshold bars at both ends.
  for (const zt of [RUNWAY.zStart + 8, RUNWAY.zEnd - 8]) {
    for (let k = -2; k <= 2; k += 1) {
      const a = project(cam, RUNWAY.x + k * 4 - 1.4, y + 0.1, zt);
      const b = project(cam, RUNWAY.x + k * 4 + 1.4, y + 0.1, zt);
      const c = project(cam, RUNWAY.x + k * 4 + 1.4, y + 0.1, zt + 14);
      const d = project(cam, RUNWAY.x + k * 4 - 1.4, y + 0.1, zt + 14);
      if (!a || !b || !c || !d) continue;
      ctx.fillStyle = '#f2f2e8';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.closePath();
      ctx.fill();
    }
  }
  // Windsock beside the strip.
  const base = project(cam, RUNWAY.x + 30, RUNWAY.height, 120);
  const top = project(cam, RUNWAY.x + 30, RUNWAY.height + 9, 120);
  if (base && top) {
    ctx.strokeStyle = '#e8e8e8';
    ctx.lineWidth = Math.max(1, 3 * top.s);
    ctx.beginPath();
    ctx.moveTo(base.x, base.y);
    ctx.lineTo(top.x, top.y);
    ctx.stroke();
    ctx.fillStyle = '#ff7a3c';
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(top.x + 14 * top.s, top.y + 2);
    ctx.lineTo(top.x, top.y + 5);
    ctx.closePath();
    ctx.fill();
  }
}

/** Target rings: the next one glows cyan, later ones amber, flown ones gone. */
function drawRings(ctx, cam, world, time) {
  for (const ring of world.rings) {
    if (ring.passed) continue;
    const p = project(cam, ring.x, ring.y, ring.z);
    if (!p || p.fwd < 15 || p.fwd > 2600) continue;
    const isNext = ring === world.nextRingObj;
    const pulse = isNext ? 1 + 0.03 * Math.sin(time * 4) : 1;
    const rx = ring.r * p.s * pulse;
    const ry = rx * 0.94;
    const colour = isNext ? '#35f2c8' : '#ffc357';
    ctx.save();
    ctx.globalAlpha = isNext ? 0.95 : 0.55;
    ctx.strokeStyle = colour;
    ctx.lineWidth = Math.max(2, rx * 0.1);
    ctx.shadowColor = colour;
    ctx.shadowBlur = isNext ? 22 : 8;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = isNext ? 0.1 : 0.05;
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // A faint post down to the ground, for depth.
    const g = project(cam, ring.x, terrainHeight(ring.x, ring.z, world.seed), ring.z);
    if (g) {
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = colour;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y + ry);
      ctx.lineTo(g.x, g.y);
      ctx.stroke();
      ctx.restore();
    }
    // Ring number.
    if (rx > 26) {
      ctx.save();
      ctx.fillStyle = isNext ? '#dffff5' : 'rgba(255,255,255,0.75)';
      ctx.font = `bold ${Math.max(13, Math.round(rx * 0.32))}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(ring.index + 1), p.x, p.y - ry - 16);
      ctx.restore();
    }
  }
}

/** Seeded clouds, billboarded at their world positions. */
function drawClouds(ctx, cam, world, palette) {
  for (const c of world.clouds) {
    const p = project(cam, c.x, c.y, c.z);
    if (!p || p.fwd < 60 || p.fwd > 4500) continue;
    const size = clamp(c.s * p.s, 18, 260);
    ctx.save();
    ctx.globalAlpha = 0.88;
    ctx.fillStyle = palette.cloud;
    for (let i = 0; i < c.puffs; i += 1) {
      const off = ((c.seed + i * 7919) % 100) / 100;
      const px = p.x + (off - 0.5) * size * 1.7;
      const py = p.y + (off * 0.7 - 0.35) * size * 0.45;
      const r = size * (0.28 + off * 0.22);
      ctx.beginPath();
      ctx.ellipse(px, py, r, r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = palette.cloudShade;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + size * 0.16, size * 0.75, size * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/** Ring-burst confetti and crash smoke, drifting in world space. */
function drawParticles(ctx, cam, world) {
  for (const pt of world.particles) {
    const p = project(cam, pt.x, pt.y, pt.z);
    if (!p || p.fwd < 10) continue;
    const a = 1 - pt.age / pt.life;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = pt.colour;
    ctx.beginPath();
    // Capped on screen: a burst the aircraft just flew through sits a few
    // metres ahead, and an uncapped radius would paint a solid disc.
    ctx.arc(p.x, p.y, clamp(3 * p.s, 1.5, 10), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/**
 * Draw one frame. `time` is seconds of animation (blinking lights, pulses);
 * `paletteName` picks the sky ('day' or 'dusk').
 */
export function render(ctx, world, time, paletteName = 'day') {
  const palette = PALETTES[paletteName] ?? PALETTES.day;
  const cam = chaseCamera(world.plane);
  const sunY = paletteName === 'dusk' ? H * 0.3 : H * 0.16;
  drawSky(ctx, palette, sunY);
  drawTerrain(ctx, cam, world.seed, palette);
  drawRiver(ctx, cam, world.seed);
  drawRunway(ctx, cam, world.seed);
  drawClouds(ctx, cam, world, palette);
  drawRings(ctx, cam, world, time);
  drawParticles(ctx, cam, world);
  drawPlane(ctx, world, time);
  drawHud(ctx, world, time);
  drawScreen(ctx, world, time);
  // A gentle vignette, so the frame reads like a photograph.
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.95);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}
