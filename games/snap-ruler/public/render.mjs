import { aim, bendAt, FINAL_FLOOR, preview, project, RULERS, WIDTH } from './engine.mjs';

import { CHECKPOINT_STEP } from './progress.mjs';

export const HEIGHT = 418;
const BASE = HEIGHT - 76;
const MARBLE = 9;

function drawRuler(ctx, ruler, screenY, charge, active, canSkip) {
  const y = screenY(ruler.y);
  const goal = ruler.floor === FINAL_FLOOR;
  const wood = active ? '#ffce68' : goal ? '#c9f6bb' : '#c39867';
  const xAt = position => ruler.clamp + position * (ruler.tip - ruler.clamp);
  const yAt = x => y + bendAt(ruler, x, charge);

  ctx.lineCap = 'round';
  ctx.strokeStyle = '#120e1d';
  ctx.lineWidth = 14;
  ctx.beginPath();
  for (let index = 0; index <= 16; index++) {
    const x = xAt(index / 16);
    if (index === 0) ctx.moveTo(x, yAt(x) + 4);
    else ctx.lineTo(x, yAt(x) + 4);
  }
  ctx.stroke();

  ctx.strokeStyle = wood;
  ctx.lineWidth = 10;
  ctx.beginPath();
  for (let index = 0; index <= 16; index++) {
    const x = xAt(index / 16);
    if (index === 0) ctx.moveTo(x, yAt(x) + 2);
    else ctx.lineTo(x, yAt(x) + 2);
  }
  ctx.stroke();

  ctx.lineWidth = 1;
  ctx.strokeStyle = '#503521';
  for (let index = 1; index < 20; index++) {
    const x = xAt(index / 20);
    const top = yAt(x) - 2;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, top + (index % 5 === 0 ? 7 : 4));
    ctx.stroke();
  }

  if (canSkip && ruler.skip) {
    const [left, right] = ruler.skip;
    ctx.strokeStyle = '#aee6dc';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(left, y - 4);
    ctx.lineTo(right, y - 4);
    ctx.stroke();
    ctx.font = '800 12px system-ui';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#aee6dc';
    ctx.fillText('+2', (left + right) / 2, y - 23);
  }
  if (active) {
    ctx.fillStyle = '#fff2bc';
    ctx.fillRect(ruler.start - 2, yAt(ruler.start) + 5, 4, 7);
  }
  ctx.fillStyle = active ? '#fff2bc' : '#807291';
  ctx.fillRect(ruler.clamp - 6, y - 10, 13, 24);
  ctx.fillStyle = '#2e2343';
  ctx.fillRect(ruler.clamp - 3, y - 5, 7, 14);
  ctx.font = '700 12px system-ui';
  ctx.textAlign = ruler.direction === 1 ? 'left' : 'right';
  ctx.fillStyle = goal || active ? wood : '#cabbde';
  const label = goal ? '1,000 · Top' : ruler.floor > 0 && ruler.floor % CHECKPOINT_STEP === 0
    ? ruler.floor + ' · Checkpoint' : String(ruler.floor);
  ctx.fillText(label, ruler.clamp + 11 * ruler.direction, y + 26);
}

function drawGuide(ctx, run, screenY) {
  const shot = aim(run);
  const landing = preview(run, shot);
  const hit = landing.floor !== null;
  const color = hit ? '#d7fff0' : '#ffd0a3';
  ctx.fillStyle = color;
  for (let index = 1; index < 17; index++) {
    const point = project(shot, landing.time * index / 17);
    ctx.globalAlpha = .5 + .3 * index / 17;
    ctx.beginPath();
    ctx.arc(point.x, screenY(point.y) - MARBLE, index % 3 === 0 ? 3 : 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (!hit) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(landing.x, screenY(landing.y) - MARBLE, 8, 0, Math.PI * 2);
  ctx.stroke();
}

const towerColors = ['#2b2141', '#332343', '#203a49', '#462438', '#242d4c'];

export function drawArena(ctx, run, { camera, best, flash }) {
  const screenY = world => BASE - world + camera;
  const fill = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  fill.addColorStop(0, towerColors[Math.floor(run.floor / 100) % towerColors.length]);
  fill.addColorStop(1, '#1d162d');
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.lineWidth = 1;
  ctx.strokeStyle = '#3c334f';
  ctx.beginPath();
  for (let x = 8; x < WIDTH; x += 24) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
  }
  for (let y = (camera % 24 + 24) % 24; y < HEIGHT; y += 24) {
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
  }
  ctx.stroke();

  if (best > run.floor) {
    const y = screenY(RULERS[best].y);
    if (y > 22 && y < HEIGHT) {
      ctx.strokeStyle = '#82b6a7';
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.moveTo(0, y - 16);
      ctx.lineTo(WIDTH, y - 16);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = '700 11px system-ui';
      ctx.fillStyle = '#bbf0df';
      ctx.textAlign = 'center';
      ctx.fillText('PERSONAL BEST', WIDTH / 2, y - 22);
    }
  }

  const first = Math.max(0, run.floor - 2);
  const last = Math.min(FINAL_FLOOR, run.floor + 8);
  for (let floor = first; floor <= last; floor++) {
    const ruler = RULERS[floor];
    const y = screenY(ruler.y);
    if (y < -45 || y > HEIGHT + 45) continue;
    const active = floor === run.floor;
    drawRuler(ctx, ruler, screenY, active ? run.charge : 0, active, floor === run.floor + 2);
  }

  if (run.holding) drawGuide(ctx, run, screenY);

  const y = screenY(run.y) - MARBLE;
  if (flash > 0) {
    ctx.strokeStyle = 'rgba(187, 240, 223, ' + Math.min(1, flash * 3) + ')';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(run.x, y, 13 + (.36 - flash) * 45, 0, Math.PI * 2);
    ctx.stroke();
  }
  const ball = ctx.createRadialGradient(run.x - 3, y - 4, 1, run.x, y, MARBLE);
  ball.addColorStop(0, '#effff6');
  ball.addColorStop(.36, '#a3ffdd');
  ball.addColorStop(1, '#428e86');
  ctx.fillStyle = ball;
  ctx.beginPath();
  ctx.arc(run.x, y, MARBLE, 0, Math.PI * 2);
  ctx.fill();
}
