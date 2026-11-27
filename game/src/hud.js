// Ridge Runner — the HUD and the screens: compass tape, airspeed and
// altitude readouts, lit round instruments, messages, warnings, and the
// title, game-over and level-clear overlays.

import { COURSE, VIEW } from './config.js';
import { clamp } from './random.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './world.js';

const { width: W, height: H } = VIEW;

const MS_TO_KT = 1.94384;
const M_TO_FT = 3.28084;

/** Heading in degrees, 0..360. */
function headingDeg(heading) {
  const d = ((heading * 180) / Math.PI) % 360;
  return (d + 360) % 360;
}

function panel(ctx, x, y, w, h) {
  ctx.save();
  ctx.fillStyle = 'rgba(8, 14, 24, 0.62)';
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function text(ctx, s, x, y, size, colour, weight = 'bold', align = 'left') {
  ctx.save();
  ctx.fillStyle = colour;
  ctx.font = `${weight} ${size}px system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
  ctx.restore();
}

/** Compass tape across the top, with a caret on the current heading. */
function drawCompass(ctx, world) {
  const cx = W / 2;
  const hdg = headingDeg(world.plane.heading);
  panel(ctx, cx - 220, 12, 440, 44);
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - 220, 12, 440, 44);
  ctx.clip();
  for (let d = -60; d <= 60; d += 10) {
    const h = (Math.round(hdg / 10) * 10 + d + 360) % 360;
    const x = cx + d * 3.2;
    const major = h % 30 === 0;
    ctx.strokeStyle = major ? '#e8f2ff' : 'rgba(232,242,255,0.45)';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x, 18);
    ctx.lineTo(x, major ? 34 : 28);
    ctx.stroke();
    if (major) {
      const label = h === 0 ? 'N' : h === 90 ? 'E' : h === 180 ? 'S' : h === 270 ? 'W' : String(h).padStart(3, '0');
      text(ctx, label, x, 46, 12, '#e8f2ff');
    }
  }
  ctx.restore();
  // Caret and digital readout.
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.moveTo(cx - 7, 12);
  ctx.lineTo(cx + 7, 12);
  ctx.lineTo(cx, 22);
  ctx.closePath();
  ctx.fill();
  text(ctx, String(Math.round(hdg)).padStart(3, '0'), cx, 34, 15, '#ffd166', 'bold', 'center');
}

/** One round instrument: lit face, ticks, needle, glass glint. */
function gauge(ctx, x, y, r, label, value, min, max, unit, opts = {}) {
  ctx.save();
  ctx.translate(x, y);
  // Face.
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#1c2b3a');
  g.addColorStop(1, '#0a121c');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#8fa8c0';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Ticks.
  const start = opts.start ?? -210;
  const sweep = opts.sweep ?? 240;
  for (let i = 0; i <= 10; i += 1) {
    const a = ((start + (sweep * i) / 10) * Math.PI) / 180;
    const major = i % 5 === 0;
    const r1 = r - (major ? 10 : 6);
    ctx.strokeStyle = major ? '#e8f2ff' : 'rgba(232,242,255,0.5)';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
    ctx.lineTo(Math.cos(a) * (r - 2), Math.sin(a) * (r - 2));
    ctx.stroke();
  }
  // Needle.
  const frac = clamp((value - min) / (max - min), 0, 1);
  const na = ((start + sweep * frac) * Math.PI) / 180;
  ctx.strokeStyle = opts.needle ?? '#ff5d3c';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(na) * (r - 12), Math.sin(na) * (r - 12));
  ctx.stroke();
  ctx.fillStyle = '#dfe9f2';
  ctx.beginPath();
  ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
  ctx.fill();
  // Label and digital value.
  text(ctx, label, 0, r * 0.42, 11, '#9fb8cc', 'bold', 'center');
  text(ctx, String(Math.round(value)), 0, -r * 0.28, 17, '#ffffff', 'bold', 'center');
  text(ctx, unit, 0, r * 0.68, 9, '#9fb8cc', 'normal', 'center');
  // Glass glint.
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, r - 4, Math.PI * 1.15, Math.PI * 1.45);
  ctx.stroke();
  ctx.restore();
}

/** Artificial horizon: sky and ground halves, rolled and pitched. */
function attitude(ctx, x, y, r, world) {
  const p = world.plane;
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.rotate(p.roll);
  const pitchPx = clamp(p.pitch, -0.6, 0.6) * r * 1.1;
  ctx.fillStyle = '#3f8fd0';
  ctx.fillRect(-r, -r - pitchPx, r * 2, r + pitchPx);
  ctx.fillStyle = '#8a5a34';
  ctx.fillRect(-r, -pitchPx, r * 2, r + pitchPx);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r, -pitchPx);
  ctx.lineTo(r, -pitchPx);
  ctx.stroke();
  ctx.rotate(-p.roll);
  // Fixed aircraft symbol.
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-r * 0.55, 0);
  ctx.lineTo(-r * 0.18, 0);
  ctx.moveTo(r * 0.18, 0);
  ctx.lineTo(r * 0.55, 0);
  ctx.moveTo(0, -3);
  ctx.lineTo(0, 3);
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = '#8fa8c0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  text(ctx, 'ATT', x, y + r * 0.55, 10, '#ffffff', 'bold', 'center');
}

/** The whole HUD: tape, readouts, instruments, warnings, messages. */
export function drawHud(ctx, world, time) {
  const p = world.plane;
  const kt = p.speed * MS_TO_KT;
  const altFt = p.alt * M_TO_FT;
  const vsi = Math.sin(p.pitch) * p.speed * M_TO_FT * 60;

  drawCompass(ctx, world);
  // Airspeed, top left.
  panel(ctx, 16, 12, 150, 64);
  text(ctx, 'AIRSPEED', 28, 26, 11, '#9fb8cc');
  text(ctx, String(Math.round(kt)), 28, 52, 30, '#ffffff');
  text(ctx, 'KT', 132, 54, 12, '#9fb8cc');
  // Throttle bar under it.
  panel(ctx, 16, 84, 150, 18);
  ctx.fillStyle = '#37e08b';
  ctx.fillRect(20, 88, 142 * p.throttle, 10);
  text(ctx, 'THR', 20, 93, 9, '#0a121c', 'bold');
  // Altitude, top right.
  panel(ctx, W - 166, 12, 150, 64);
  text(ctx, 'ALTITUDE', W - 154, 26, 11, '#9fb8cc');
  text(ctx, String(Math.round(altFt)), W - 154, 52, 30, '#ffffff', 'bold', 'right');
  text(ctx, 'FT', W - 28, 54, 12, '#9fb8cc');
  // Score, time, rings under it.
  panel(ctx, W - 166, 84, 150, 44);
  text(ctx, `SCORE ${world.score}`, W - 154, 98, 13, '#ffffff');
  text(ctx, `RINGS ${world.ringsHit}/${COURSE.ringsPerLevel}`, W - 154, 118, 13, '#ffd166');
  text(ctx, `TIME ${Math.ceil(world.timeLeft)}s`, W - 28, 98, 13, world.timeLeft < 20 ? '#ff5d3c' : '#ffffff', 'bold', 'right');
  text(ctx, `VALLEY ${world.level}`, W - 28, 118, 13, '#9fb8cc', 'normal', 'right');

  // Instrument panel along the bottom.
  const py = H - 108;
  panel(ctx, W / 2 - 320, py, 640, 96);
  gauge(ctx, W / 2 - 252, py + 48, 40, 'AIRSPEED', kt, 0, 200, 'KT');
  attitude(ctx, W / 2 - 128, py + 48, 40, world);
  gauge(ctx, W / 2, py + 48, 40, 'ALTITUDE', altFt, 0, 3000, 'FT');
  gauge(ctx, W / 2 + 128, py + 48, 40, 'HEADING', headingDeg(p.heading), 0, 360, 'DEG', { start: -90, sweep: 360 });
  gauge(ctx, W / 2 + 252, py + 48, 40, 'VERT SPEED', vsi, -2000, 2000, 'FPM', { needle: '#37e08b' });

  // Warnings and messages only while flying: the title and end screens
  // carry their own text, and a toast over them reads as a mistake.
  if (world.screen === SCREEN_PLAY) {
    if (world.warning) {
      const blink = Math.sin(time * 10) > 0;
      if (blink) text(ctx, world.warning, W / 2, 150, 34, '#ff5d3c', 'bold', 'center');
    } else if (world.message && world.elapsed < world.messageUntil) {
      text(ctx, world.message, W / 2, 150, 24, '#ffffff', 'bold', 'center');
    }
  }

  // Next-ring diamond: where to fly.
  const ring = world.nextRingObj;
  if (ring && world.screen === SCREEN_PLAY) {
    // Projected in render space would need the camera; instead point with
    // a simple marker under the compass when the ring is ahead.
    const ahead = ring.z > p.z;
    if (ahead) {
      const dx = ring.x - p.x;
      const dy = ring.y - p.alt;
      const dist = Math.hypot(dx, dy, ring.z - p.z);
      text(ctx, `NEXT RING ${ring.index + 1} · ${Math.round(dist)}m`, W / 2, 96, 14, '#35f2c8', 'bold', 'center');
    }
  }
}

function overlay(ctx, alpha) {
  ctx.save();
  ctx.fillStyle = `rgba(6, 12, 22, ${alpha})`;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function titleBlock(ctx, y, main, sub, colour = '#ffffff') {
  text(ctx, main, W / 2, y, 84, colour, 'bold', 'center');
  text(ctx, sub, W / 2, y + 62, 22, '#ffd166', 'bold', 'center');
}

/** Title, game-over and level-clear screens, drawn over the staged scene. */
export function drawScreen(ctx, world, time) {
  if (world.screen === SCREEN_TITLE) {
    overlay(ctx, 0.42);
    titleBlock(ctx, 190, 'RIDGE RUNNER', 'A L P I N E   A I R   C O U R I E R');
    text(ctx, 'Fly the valley · Thread the rings · Beat the clock', W / 2, 300, 20, '#e8f2ff', 'normal', 'center');
    panel(ctx, W / 2 - 300, 350, 600, 132);
    text(ctx, 'ARROWS or WASD  —  steer (bank & climb)', W / 2, 378, 17, '#ffffff', 'normal', 'center');
    text(ctx, 'SHIFT / CTRL  —  throttle up / down', W / 2, 406, 17, '#ffffff', 'normal', 'center');
    text(ctx, 'Mouse  —  steer by position, click to start', W / 2, 434, 17, '#ffffff', 'normal', 'center');
    text(ctx, 'P pause · M sound · R restart', W / 2, 462, 17, '#9fb8cc', 'normal', 'center');
    const pulse = 0.65 + 0.35 * Math.sin(time * 3);
    ctx.save();
    ctx.globalAlpha = pulse;
    text(ctx, 'PRESS ENTER OR CLICK TO FLY', W / 2, 540, 26, '#37e08b', 'bold', 'center');
    ctx.restore();
    if (world.best > 0) text(ctx, `BEST  ${world.best}`, W / 2, 590, 16, '#ffd166', 'bold', 'center');
  } else if (world.screen === SCREEN_OVER) {
    overlay(ctx, 0.5);
    titleBlock(ctx, 220, 'FLIGHT OVER', world.crashReason ?? 'OUT OF TIME', '#ff5d3c');
    text(ctx, `SCORE  ${world.score}`, W / 2, 350, 30, '#ffffff', 'bold', 'center');
    text(ctx, `RINGS  ${world.ringsHit} / ${COURSE.ringsPerLevel}   ·   BEST  ${world.best}`, W / 2, 398, 18, '#ffd166', 'normal', 'center');
    text(ctx, 'PRESS R TO FLY AGAIN', W / 2, 470, 22, '#37e08b', 'bold', 'center');
  } else if (world.screen === SCREEN_WIN) {
    overlay(ctx, 0.42);
    titleBlock(ctx, 220, 'VALLEY CLEARED!', `TIME BONUS +${world.levelBonus ?? 0}`, '#37e08b');
    text(ctx, `SCORE  ${world.score}`, W / 2, 350, 30, '#ffffff', 'bold', 'center');
    text(ctx, `NEXT VALLEY — FASTER WIND, TIGHTER RINGS`, W / 2, 398, 18, '#ffd166', 'normal', 'center');
    text(ctx, 'PRESS ENTER FOR THE NEXT VALLEY', W / 2, 470, 22, '#37e08b', 'bold', 'center');
  }
}
