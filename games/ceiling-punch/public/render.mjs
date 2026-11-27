import { CEILINGS, doubleWindows, SMASH_SECONDS, TOP_FLOOR, WIDTH } from './engine.mjs';

export const HEIGHT = 348;
const UPPER = 82;
const LOWER = 148;
const GROUND = 302;

function block(ctx, x, y, width, height, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, height);
}

function backdrop(ctx) {
  const background = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  background.addColorStop(0, '#303d4b');
  background.addColorStop(1, '#1c2532');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.strokeStyle = '#bdcde614';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 16; x < WIDTH; x += 24) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
  }
  for (let y = 16; y < HEIGHT; y += 24) {
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
  }
  ctx.stroke();
  for (const x of [0, WIDTH - 16]) {
    block(ctx, x, 0, 16, HEIGHT, '#222631');
    block(ctx, x + 7, 0, 2, HEIGHT, '#7a8291');
  }
  block(ctx, 16, GROUND, WIDTH - 32, 4, '#b0a69a');
  block(ctx, 16, GROUND + 4, WIDTH - 32, 42, '#161e29');
  ctx.save();
  ctx.beginPath();
  ctx.rect(16, GROUND + 4, WIDTH - 32, 10);
  ctx.clip();
  ctx.strokeStyle = '#6a593b';
  ctx.lineWidth = 5;
  for (let x = 9; x < WIDTH; x += 20) {
    ctx.beginPath();
    ctx.moveTo(x, GROUND + 15);
    ctx.lineTo(x + 13, GROUND + 3);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCeiling(ctx, y, cracks, windows, hitX) {
  ctx.save();
  if (hitX !== undefined) {
    ctx.beginPath();
    ctx.rect(16, y, Math.max(0, hitX - 24 - 16), 22);
    const right = Math.min(WIDTH - 16, hitX + 24);
    ctx.rect(right, y, WIDTH - 16 - right, 22);
    ctx.clip();
  }
  block(ctx, 16, y, WIDTH - 32, 20, '#89939f');
  block(ctx, 16, y + 20, WIDTH - 32, 2, '#b4b7c0');
  for (let x = 36; x < WIDTH - 18; x += 40) {
    block(ctx, x, y + 5, 2, 15, '#717a88');
  }
  for (const [left, right] of cracks) {
    block(ctx, left, y, right - left, 22, '#588e7f');
    block(ctx, left, y + 19, right - left, 3, '#9fefd5');
    ctx.strokeStyle = '#243c41';
    ctx.lineWidth = 2;
    const middle = (left + right) / 2;
    ctx.beginPath();
    ctx.moveTo(middle - 10, y + 2);
    ctx.lineTo(middle + 5, y + 8);
    ctx.lineTo(middle - 4, y + 13);
    ctx.lineTo(middle + 7, y + 19);
    ctx.stroke();
  }
  for (const [left, right] of windows) {
    block(ctx, left, y + 1, right - left, 4, '#ffc46c');
    block(ctx, left, y + 19, right - left, 3, '#ffc46c');
  }
  ctx.restore();
}

function guide(ctx, x, y) {
  ctx.save();
  ctx.strokeStyle = '#e2f8f967';
  ctx.lineWidth = 1.4;
  ctx.setLineDash([5, 6]);
  ctx.beginPath();
  ctx.moveTo(x, y + 24);
  ctx.lineTo(x, GROUND - 41);
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

function burst(ctx, impact, progress, reduced) {
  const top = progress > .42 && impact.cleared === 2 ? UPPER : LOWER;
  if (reduced) {
    block(ctx, impact.x - 14, top - 1, 28, 4, '#ffd68c');
    return;
  }
  for (let bit = 0; bit < 9; bit++) {
    const direction = bit % 2 === 0 ? -1 : 1;
    const distance = (14 + bit * 8) * progress;
    const x = impact.x + direction * distance;
    const y = top - (11 + bit * 5) * progress + 23 * progress ** 2;
    const size = 3 + bit % 4;
    block(ctx, x, y, size, size, bit % 3 === 0 ? '#ffc973' : '#d5dde1');
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

export function drawScene(ctx, run, reducedMotion = false) {
  backdrop(ctx);
  const smashing = run.phase === 'smash';
  const view = smashing ? run.impact.from : run.floor;
  const current = CEILINGS[view];
  const next = CEILINGS[view + 1];
  const chain = doubleWindows(view);
  const progress = smashing ? Math.min(1, run.elapsed / SMASH_SECONDS) : 0;
  const hole = smashing ? run.impact.x : undefined;
  if (next) drawCeiling(ctx, UPPER, next, chain, progress > .42 && run.impact?.cleared === 2 ? hole : undefined);
  if (current) {
    drawCeiling(ctx, LOWER, current, chain, hole);
    if (run.phase === 'ready' || run.phase === 'running') guide(ctx, run.x, LOWER);
  }

  let y = GROUND - 23;
  if (smashing) {
    const rise = run.impact.cleared === 2 ? 222 : 156;
    y -= rise * Math.sin(progress * Math.PI / 2);
    burst(ctx, run.impact, progress, reducedMotion);
  } else if (run.phase === 'won') {
    ctx.fillStyle = '#ffc46c';
    ctx.textAlign = 'center';
    ctx.font = '900 35px system-ui';
    ctx.fillText('ROOF REACHED', WIDTH / 2, 139);
    ctx.font = '600 16px system-ui';
    ctx.fillStyle = '#c1dfdb';
    ctx.fillText('All ' + TOP_FLOOR + ' floors cleared', WIDTH / 2, 167);
  } else if (run.phase === 'lost') {
    drawMiss(ctx, run.impact.x, run.impact.reason === 'passed' ? GROUND - 48 : LOWER + 9);
  }
  drawRobot(ctx, run.phase === 'won' ? WIDTH / 2 : run.x, y, run.direction, smashing, run.phase === 'running');
}
