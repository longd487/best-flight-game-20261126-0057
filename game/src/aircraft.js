// Ridge Runner — the aircraft, drawn in chase view: from behind and
// slightly above, wings spread, tail closest to the camera. The sprite
// sits at a fixed anchor on screen while the world scrolls past it.

import { VIEW } from './config.js';
import { terrainHeight } from './world.js';
import { project } from './render.js';

const { width: W, height: H } = VIEW;

// Where the aircraft sits on screen, as a fraction of the frame.
const ANCHOR_X = 0.5;
const ANCHOR_Y = 0.615;

/** A soft shadow on the ground below, when the aircraft is low. */
function drawGroundShadow(ctx, world) {
  const p = world.plane;
  const ground = terrainHeight(p.x, p.z, world.seed);
  const clearance = p.alt - ground;
  if (clearance > 260 || p.onGround) return;
  const cam = {
    x: p.x - Math.sin(p.heading) * 16,
    y: p.alt + 4.5,
    z: p.z - Math.cos(p.heading) * 16,
    heading: p.heading,
    pitch: p.pitch,
    roll: p.roll,
  };
  const g = project(cam, p.x, ground + 1, p.z);
  if (!g) return;
  const alpha = 0.32 * (1 - clearance / 260);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#1c2b1a';
  ctx.beginPath();
  ctx.ellipse(g.x, g.y, 52 * g.s, 12 * g.s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** One wing, from the fuselage out to a tip. `side` is -1 left, +1 right. */
function drawWing(ctx, side) {
  const s = side;
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(150 * s, -34);
  ctx.lineTo(168 * s, -26);
  ctx.lineTo(150 * s, -6);
  ctx.lineTo(28 * s, 6);
  ctx.closePath();
  ctx.fill();
  // Orange tip and a panel line.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(128 * s, -31);
  ctx.lineTo(150 * s, -34);
  ctx.lineTo(168 * s, -26);
  ctx.lineTo(150 * s, -6);
  ctx.lineTo(128 * s, -9);
  ctx.closePath();
  ctx.fillStyle = '#ff7a3c';
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = 'rgba(30,40,60,0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(20 * s, -2);
  ctx.lineTo(140 * s, -24);
  ctx.stroke();
  ctx.restore();
}

/** The bush plane, banking with the roll. */
export function drawPlane(ctx, world, time) {
  const p = world.plane;
  drawGroundShadow(ctx, world);
  const cx = W * ANCHOR_X;
  const cy = H * ANCHOR_Y;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(p.roll * 0.85);
  // A faint speed blur when fast.
  if (!p.onGround && p.speed > 62) {
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i += 1) {
      const yy = -120 + i * 60;
      ctx.beginPath();
      ctx.moveTo(-230, yy);
      ctx.lineTo(-180, yy);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(180, yy);
      ctx.lineTo(230, yy);
      ctx.stroke();
    }
    ctx.restore();
  }
  // Wings (far wing first so the fuselage overlaps it).
  ctx.fillStyle = '#f4f6f8';
  ctx.strokeStyle = '#2c3a4d';
  ctx.lineWidth = 2;
  drawWing(ctx, -1);
  ctx.fill();
  ctx.stroke();
  drawWing(ctx, 1);
  ctx.fill();
  ctx.stroke();
  // Fuselage: tail (near, wide) to nose (far, narrow), seen from behind.
  const body = ctx.createLinearGradient(-34, 0, 34, 0);
  body.addColorStop(0, '#e8ecf0');
  body.addColorStop(0.5, '#ffffff');
  body.addColorStop(1, '#d7dde3');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-30, 52);
  ctx.quadraticCurveTo(-34, -20, -16, -128);
  ctx.quadraticCurveTo(0, -140, 16, -128);
  ctx.quadraticCurveTo(34, -20, 30, 52);
  ctx.quadraticCurveTo(0, 64, -30, 52);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Orange cheatline down each side of the fuselage.
  ctx.fillStyle = '#ff7a3c';
  ctx.fillRect(-30, -8, 5, 52);
  ctx.fillRect(25, -8, 5, 52);
  // Canopy hump, catching the light.
  ctx.fillStyle = '#9fc4e8';
  ctx.beginPath();
  ctx.ellipse(0, -96, 13, 26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(44,58,77,0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Tailplane and fin.
  ctx.fillStyle = '#f4f6f8';
  ctx.beginPath();
  ctx.moveTo(-64, 34);
  ctx.lineTo(-8, 44);
  ctx.lineTo(-8, 56);
  ctx.lineTo(-64, 50);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(64, 34);
  ctx.lineTo(8, 44);
  ctx.lineTo(8, 56);
  ctx.lineTo(64, 50);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ff7a3c';
  ctx.beginPath();
  ctx.moveTo(-10, 50);
  ctx.lineTo(0, 4);
  ctx.lineTo(10, 50);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('RR', 0, 40);
  // Propeller disc at the nose, with a spinner.
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = '#c8d2dc';
  ctx.beginPath();
  ctx.ellipse(0, -132, 46, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#2c3a4d';
  ctx.beginPath();
  ctx.arc(0, -132, 5, 0, Math.PI * 2);
  ctx.fill();
  // Registration on the tail.
  ctx.fillStyle = '#2c3a4d';
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.fillText('N720RR', 0, 58);
  // Navigation lights: red port, green starboard, blinking with time.
  const blink = Math.sin(time * 6) > 0;
  ctx.fillStyle = blink ? '#ff3b30' : '#7a1a14';
  ctx.beginPath();
  ctx.arc(-166, -26, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = blink ? '#37e08b' : '#14532d';
  ctx.beginPath();
  ctx.arc(166, -26, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
