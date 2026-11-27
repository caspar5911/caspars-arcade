import { ceilingAt, doubleWindows, SMASH_SECONDS, WIDTH } from './engine.mjs';

export const HEIGHT = 348;
const FLOOR_H = 104; // from one floor to the next
const SLAB = 20; // a ceiling's thickness
const BASE = 292; // where the robot stands on screen
const HOLE = 44; // a broken hole's width

function block(ctx, x, y, width, height, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, height);
}

const easeOut = p => 1 - (1 - p) ** 3;
const easeInOut = p => (p < .5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2);

/** Where the robot is (in floors, may be between two) and where the camera is, during a smash too. */
function levels(run) {
  if (run.phase !== 'smash') return { robot: run.floor, cam: run.floor, progress: 0 };
  const p = Math.min(1, run.elapsed / SMASH_SECONDS);
  const { from, cleared } = run.impact;
  return { robot: from + cleared * easeOut(p), cam: from + cleared * easeInOut(p), progress: p };
}

function backdrop(ctx, cam) {
  const background = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  background.addColorStop(0, '#303d4b');
  background.addColorStop(1, '#1c2532');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  // the grid drifts down as you climb (a slower layer behind the floors)
  const drift = (cam * FLOOR_H * .45) % 24;
  ctx.strokeStyle = '#bdcde614';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 16; x < WIDTH; x += 24) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
  }
  for (let y = drift - 24; y < HEIGHT; y += 24) {
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
  }
  ctx.stroke();
}

function walls(ctx) {
  for (const x of [0, WIDTH - 16]) {
    block(ctx, x, 0, 16, HEIGHT, '#222631');
    block(ctx, x + 7, 0, 2, HEIGHT, '#7a8291');
  }
}

/** Slab k (its top surface at y): the ground for k = 0, else the ceiling above floor k - 1, with its cracks. */
function drawSlab(ctx, run, k, y, gold, holes) {
  ctx.save();
  ctx.beginPath();
  // (broken holes are cut out of the slab)
  let from = 16;
  for (const x of holes.map(h => h.x).sort((a, b) => a - b)) {
    const left = Math.max(16, x - HOLE / 2);
    if (left > from) ctx.rect(from, y, left - from, SLAB + 2);
    from = Math.max(from, Math.min(WIDTH - 16, x + HOLE / 2));
  }
  if (from < WIDTH - 16) ctx.rect(from, y, WIDTH - 16 - from, SLAB + 2);
  ctx.clip();
  if (k === 0) {
    block(ctx, 16, y, WIDTH - 32, 4, '#b0a69a');
    block(ctx, 16, y + 4, WIDTH - 32, SLAB, '#161e29');
  } else {
    block(ctx, 16, y, WIDTH - 32, SLAB, '#89939f');
    block(ctx, 16, y + SLAB, WIDTH - 32, 2, '#b4b7c0');
    for (let x = 36; x < WIDTH - 18; x += 40) block(ctx, x, y + 5, 2, 13, '#717a88');
    for (const [left, right] of ceilingAt(run.seed, k - 1)) {
      block(ctx, left, y, right - left, SLAB + 2, '#588e7f');
      block(ctx, left, y + SLAB - 1, right - left, 3, '#9fefd5');
      ctx.strokeStyle = '#243c41';
      ctx.lineWidth = 2;
      const middle = (left + right) / 2;
      ctx.beginPath();
      ctx.moveTo(middle - 8, y + 2);
      ctx.lineTo(middle + 5, y + 7);
      ctx.lineTo(middle - 4, y + 12);
      ctx.lineTo(middle + 6, y + 18);
      ctx.stroke();
    }
    for (const [left, right] of gold) {
      block(ctx, left, y, right - left, 4, '#ffc46c');
      block(ctx, left, y + SLAB - 1, right - left, 3, '#ffc46c');
    }
  }
  ctx.restore();
  // the floor number, on the wall
  if (k > 0) {
    ctx.fillStyle = '#c7d3e2a0';
    ctx.font = '700 11px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText(String(k), 19, y - 4);
  }
}

function guide(ctx, x, top, bottom) {
  ctx.save();
  ctx.strokeStyle = '#e2f8f967';
  ctx.lineWidth = 1.4;
  ctx.setLineDash([5, 6]);
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x, bottom);
  ctx.stroke();
  ctx.restore();
}

function drawRobot(ctx, x, y, direction, punch, running) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(direction, 1);
  const stride = running ? Math.sin(x / 4.8) * 5 : 0;
  block(ctx, -16, -6, 30, 26, '#121a22');
  block(ctx, -14, -5, 27, 21, '#f7a748');
  block(ctx, -11, -2, 21, 10, '#ffd18a');
  block(ctx, 1, 1, 8, 4, '#273743');
  block(ctx, 6, 1, 3, 4, '#a5f5d5');
  block(ctx, -12, 14 + stride * .4, 11, 7, '#697888');
  block(ctx, 1, 14 - stride * .4, 12, 7, '#8293a3');
  if (punch) {
    block(ctx, 7, -24, 8, 23, '#ee983c');
    block(ctx, 4, -28, 15, 10, '#ffd18a');
    block(ctx, 5, -30, 13, 3, '#fff2cf');
  } else {
    block(ctx, -19, 4, 8, 11, '#ed9342');
    block(ctx, 12, 3, 7, 8, '#ffd18a');
  }
  ctx.restore();
}

function burst(ctx, x, top, progress, reduced) {
  if (reduced) {
    block(ctx, x - 14, top - 1, 28, 4, '#ffd68c');
    return;
  }
  for (let bit = 0; bit < 12; bit++) {
    const side = bit % 2 === 0 ? -1 : 1;
    const distance = (14 + bit * 7) * progress;
    const bx = x + side * distance;
    const by = top + 10 - (8 + bit * 5) * progress + 60 * progress ** 2;
    const size = 3 + bit % 4;
    block(ctx, bx, by, size, size, bit % 3 === 0 ? '#ffc973' : '#d5dde1');
  }
}

function drawMiss(ctx, x, y) {
  ctx.strokeStyle = '#ff8e74';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, 16, 0, Math.PI * 2);
  ctx.moveTo(x - 6, y - 6);
  ctx.lineTo(x + 6, y + 6);
  ctx.moveTo(x + 6, y - 6);
  ctx.lineTo(x - 6, y + 6);
  ctx.stroke();
}

function drawFlood(ctx, surface, time, reduced, danger) {
  if (surface >= HEIGHT) return;
  const top = Math.max(-10, surface);
  ctx.save();
  ctx.fillStyle = danger ? '#2f8fd2d0' : '#2a7fc0b8';
  ctx.beginPath();
  ctx.moveTo(16, HEIGHT);
  for (let x = 16; x <= WIDTH - 16; x += 8) {
    const wave = reduced ? 0 : Math.sin(x / 22 + time * 4) * 3;
    ctx.lineTo(x, top + wave);
  }
  ctx.lineTo(WIDTH - 16, HEIGHT);
  ctx.closePath();
  ctx.fill();
  block(ctx, 16, top - 1, WIDTH - 32, 2, '#bfe6ff90');
  ctx.restore();
}

function flash(ctx, text, progress) {
  ctx.save();
  ctx.globalAlpha = 1 - progress * .6;
  ctx.textAlign = 'center';
  ctx.font = '900 20px system-ui';
  ctx.fillStyle = '#10161fcc';
  ctx.beginPath();
  ctx.roundRect(WIDTH / 2 - 70, 8, 140, 30, 10);
  ctx.fill();
  ctx.fillStyle = '#ffc46c';
  ctx.fillText(text, WIDTH / 2, 30);
  ctx.restore();
}

function banner(ctx, text, sub, color) {
  ctx.save();
  ctx.fillStyle = '#10161fcc';
  ctx.beginPath();
  ctx.roundRect(WIDTH / 2 - 150, 84, 300, sub ? 74 : 50, 14);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.font = '900 32px system-ui';
  ctx.fillText(text, WIDTH / 2, 120);
  if (sub) {
    ctx.font = '600 15px system-ui';
    ctx.fillStyle = '#e6f2ef';
    ctx.fillText(sub, WIDTH / 2, 146);
  }
  ctx.restore();
}

/** Draw the tower around the robot. `time` (seconds) only moves the water. */
export function drawScene(ctx, run, reducedMotion = false, time = 0) {
  const { robot, cam, progress } = levels(run);
  const smashing = run.phase === 'smash';
  const shake = smashing && !reducedMotion && progress < .35 ? (1 - progress / .35) * (run.impact.cleared === 2 ? 5 : 3) : 0;
  ctx.save();
  if (shake) ctx.translate(Math.sin(progress * 90) * shake, Math.cos(progress * 70) * shake * .6);
  backdrop(ctx, cam);
  const slabY = k => BASE - (k - cam) * FLOOR_H; // a slab's top surface on screen
  const gold = doubleWindows(run.seed, run.floor);
  for (let k = Math.max(0, Math.floor(cam) - 1); k <= Math.floor(cam) + 4; k++) {
    const y = slabY(k);
    if (y > HEIGHT + 4 || y < -SLAB - 4) continue;
    const showGold = run.phase !== 'lost' && (k === run.floor + 1 || k === run.floor + 2);
    drawSlab(ctx, run, k, y, showGold ? gold : [], run.holes.filter(h => h.slab === k));
  }
  if (run.phase === 'ready' || run.phase === 'running') guide(ctx, run.x, slabY(run.floor + 1) + SLAB + 2, BASE - 30);
  if (smashing) burst(ctx, run.impact.x, slabY(run.impact.from + 1), progress, reducedMotion);
  const robotY = BASE - 23 - (robot - cam) * FLOOR_H;
  drawRobot(ctx, run.x, robotY, run.direction, smashing && progress < .7, run.phase === 'running');
  const close = run.floor - run.flood < .7;
  drawFlood(ctx, slabY(run.flood), time, reducedMotion, close && run.phase === 'running');
  walls(ctx);
  ctx.restore();

  if (smashing && run.impact.cleared === 2) flash(ctx, 'DOUBLE! ×2', progress); // (small, at the top: the next ceilings stay clear)
  if (run.phase === 'ready') banner(ctx, 'TAP TO PUNCH', 'Climb before the flood catches you', '#ffc46c');
  if (run.phase === 'lost') {
    if (run.impact.reason === 'flooded') banner(ctx, 'SPLASH!', 'Floor ' + run.floor, '#9fd8ff');
    else drawMiss(ctx, run.impact.x, slabY(run.floor + 1) + SLAB / 2);
  }
}
