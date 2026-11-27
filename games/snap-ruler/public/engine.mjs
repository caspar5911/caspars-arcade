export const WIDTH = 410;
export const TICK = 1 / 120;
const PITCH = 76;
const GRAVITY = 740;
const CHARGE_TIME = .7;

export const RULERS = [
  [26, 269], [382, 118], [38, 305], [376, 149], [44, 257],
  [366, 116], [25, 302], [383, 182], [50, 262], [365, 144], [48, 248],
].map(([clamp, tip], floor) => ({ clamp, tip, floor, y: floor * PITCH, direction: Math.sign(tip - clamp) }));

export const FINAL_FLOOR = RULERS.length - 1;

const fraction = (ruler, x) => (x - ruler.clamp) / (ruler.tip - ruler.clamp);

export function bendAt(ruler, x, charge) {
  return 26 * charge * fraction(ruler, x) ** 2;
}

export function createRun() {
  return { phase: 'ready', floor: 0, x: 72, y: 0, vx: 0, vy: 0, charge: 0, holding: false, rollSpeed: 72 };
}

export function beginHold(run) {
  if (run.phase === 'ready') run.phase = 'rolling';
  if (run.phase !== 'rolling' || run.holding) return false;
  run.holding = true;
  return true;
}

export function cancelHold(run) {
  run.holding = false;
  run.charge = 0;
}

export function aim(run) {
  const ruler = RULERS[run.floor];
  const progress = fraction(ruler, run.x);
  return {
    x: run.x,
    y: ruler.y - bendAt(ruler, run.x, run.charge),
    vx: ruler.direction * (32 + 214 * progress),
    vy: 350 + 166 * run.charge + 20 * (1 - progress),
  };
}

export function project(shot, time) {
  return {
    x: shot.x + shot.vx * time,
    y: shot.y + shot.vy * time - GRAVITY * time ** 2 / 2,
  };
}

export function finishHold(run) {
  if (run.phase !== 'rolling' || !run.holding) return false;
  Object.assign(run, aim(run), { phase: 'flight' });
  cancelHold(run);
  return true;
}

function lose(run, reason) {
  cancelHold(run);
  run.phase = 'lost';
  run.reason = reason;
}

function land(run, ruler, x) {
  Object.assign(run, {
    x, y: ruler.y, floor: ruler.floor, phase: ruler.floor === FINAL_FLOOR ? 'won' : 'rolling',
    vx: 0, vy: 0, rollSpeed: Math.min(72 + ruler.floor * 3, Math.abs(ruler.tip - x) / 1.25),
  });
}

export function step(run) {
  if (run.phase === 'rolling') {
    const ruler = RULERS[run.floor];
    const nextX = run.x + ruler.direction * run.rollSpeed * TICK;
    if (fraction(ruler, nextX) >= 1) {
      run.x = ruler.tip;
      lose(run, 'off-tip');
      return;
    }
    run.x = nextX;
    if (run.holding) run.charge = Math.min(1, run.charge + TICK / CHARGE_TIME);
    run.y = ruler.y - bendAt(ruler, run.x, run.charge);
    return;
  }

  if (run.phase !== 'flight') return;
  const previous = { x: run.x, y: run.y };
  Object.assign(run, project(run, TICK));
  run.vy -= GRAVITY * TICK;
  if (run.vy < 0) {
    for (let floor = run.floor + 1; floor <= FINAL_FLOOR; floor++) {
      const ruler = RULERS[floor];
      if (previous.y < ruler.y || run.y > ruler.y) continue;
      const cross = (previous.y - ruler.y) / (previous.y - run.y);
      const x = previous.x + (run.x - previous.x) * cross;
      if (fraction(ruler, x) >= 0 && fraction(ruler, x) <= .995) {
        land(run, ruler, x);
        return;
      }
    }
  }
  if (run.x < -12 || run.x > WIDTH + 12 || run.y < RULERS[run.floor].y - 46) lose(run, 'missed');
}
