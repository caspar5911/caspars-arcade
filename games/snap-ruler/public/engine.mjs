export const WIDTH = 410;
export const TICK = 1 / 120;
export const FINAL_FLOOR = 1000;
export const MAX_ROLL_SPEED = 76;
export const MIN_ROLL_TIME = 1.25;
const SETTLE_TIME = .32;
const GRAVITY = 740;
const CHARGE_TIME = .7;

const opening = [
  [26, 269], [382, 118], [38, 305], [376, 149], [44, 257],
  [366, 116], [25, 302], [383, 182], [50, 262], [365, 144], [48, 248],
];
const stride = [76, 82, 73, 89, 74, 91, 69, 84];
const starts = [.10, .34, .25, .54, .11, .56, .27, .39];

function makeRulers() {
  const rulers = [];
  let y = 0;
  let lastRise = 0;
  for (let floor = 0; floor <= FINAL_FLOOR; floor++) {
    const difficulty = Math.min(3, Math.floor(floor / 120));
    const pattern = (floor + Math.floor(floor / 9) * 3) % stride.length;
    const direction = floor % 2 === 0 ? 1 : -1;
    const anchor = 24 + (floor * 11 % 29);
    const reach = 264 + (floor * 13 % 32);
    const [clamp, tip] = opening[floor] ?? (direction === 1 ? [anchor, reach] : [WIDTH - anchor, WIDTH - reach]);
    const rise = floor === 0 ? 0 : floor < opening.length ? 76 : Math.min(stride[pattern] + difficulty, 166 - lastRise);
    y += rise;
    lastRise = rise;

    let start = .23;
    if (floor >= opening.length) {
      start = .25 + (starts[pattern] - .25) * (.35 + difficulty * .20);
    }
    rulers.push({ clamp, tip, direction, floor, y, start: floor === 0 ? 72 : clamp + (tip - clamp) * start });
  }
  return rulers;
}

export const RULERS = makeRulers();

const fraction = (ruler, x) => (x - ruler.clamp) / (ruler.tip - ruler.clamp);
function rollSpeed(ruler) {
  const pace = fraction(ruler, ruler.start) > .45 ? 57 : MAX_ROLL_SPEED;
  return Math.min(pace, Math.abs(ruler.tip - ruler.start) / MIN_ROLL_TIME);
}

export function bendAt(ruler, x, charge) {
  return 26 * charge * fraction(ruler, x) ** 2;
}

export function createRun(floor = 0) {
  const ruler = RULERS[floor];
  return {
    phase: floor === FINAL_FLOOR ? 'won' : 'ready',
    floor, x: ruler.start, y: ruler.y, charge: 0, holding: false,
    rollSpeed: rollSpeed(ruler),
  };
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
  const lift = Math.max(0, (run.charge - .62) / .38);
  return {
    x: run.x,
    y: ruler.y - bendAt(ruler, run.x, run.charge),
    vx: ruler.direction * (32 + 214 * progress) * (1 - .87 * lift),
    vy: 350 + 166 * run.charge + 20 * (1 - progress),
  };
}

export function project(shot, time) {
  return {
    x: shot.x + shot.vx * time,
    y: shot.y + shot.vy * time - GRAVITY * time ** 2 / 2,
  };
}

function descendingTime(shot, y) {
  const discriminant = shot.vy ** 2 - 2 * GRAVITY * (y - shot.y);
  return discriminant < 0 ? null : (shot.vy + Math.sqrt(discriminant)) / GRAVITY;
}

function intersection(shot, ruler) {
  if (!ruler) return null;
  const time = descendingTime(shot, ruler.y);
  if (time === null) return null;
  return { floor: ruler.floor, x: shot.x + shot.vx * time, y: ruler.y, time };
}

function openingSkip(launcher, landing) {
  const halfWidth = Math.max(24, 41 - Math.floor(landing.floor / 100) * 2);
  const left = Math.min(landing.clamp, landing.tip);
  const right = Math.max(landing.clamp, landing.tip);
  for (let held = 76; held <= 102; held++) {
    const time = held * TICK;
    const shot = aim({
      floor: launcher.floor,
      x: launcher.start + launcher.direction * rollSpeed(launcher) * time,
      charge: Math.min(1, time / CHARGE_TIME),
    });
    const hit = intersection(shot, landing);
    if (hit && hit.x >= left + 7 && hit.x <= right - 7) {
      return [Math.max(left + 4, hit.x - halfWidth), Math.min(right - 4, hit.x + halfWidth)];
    }
  }
  return null;
}

for (let floor = 2; floor <= FINAL_FLOOR; floor++) {
  RULERS[floor].skip = openingSkip(RULERS[floor - 2], RULERS[floor]);
}

export function preview(run, shot = aim(run)) {
  const higher = RULERS[run.floor + 2];
  const skip = intersection(shot, higher);
  if (skip && higher.skip && skip.x >= higher.skip[0] && skip.x <= higher.skip[1]) return skip;

  const next = RULERS[run.floor + 1];
  const near = intersection(shot, next);
  if (near && fraction(next, near.x) >= 0 && fraction(next, near.x) <= .995) return near;

  const reason = near && (shot.vx > 0
    ? near.x > Math.max(next.clamp, next.tip)
    : near.x < Math.min(next.clamp, next.tip)) ? 'long' : 'short';
  const edge = shot.vx > 0 ? WIDTH + 12 : -12;
  const time = Math.min(descendingTime(shot, RULERS[run.floor].y - 46), (edge - shot.x) / shot.vx);
  return { ...project(shot, time), floor: null, time, reason };
}

export function finishHold(run) {
  if (run.phase !== 'rolling' || !run.holding) return false;
  const shot = aim(run);
  run.flight = { shot, result: preview(run, shot), elapsed: 0 };
  run.phase = 'flight';
  cancelHold(run);
  return true;
}

function lose(run, reason) {
  cancelHold(run);
  run.phase = 'lost';
  run.reason = reason;
}

function land(run, outcome) {
  const ruler = RULERS[outcome.floor];
  Object.assign(run, {
    x: outcome.x, y: ruler.y, floor: ruler.floor, rollSpeed: rollSpeed(ruler),
    phase: ruler.floor === FINAL_FLOOR ? 'won' : 'settling',
    settlingFrom: outcome.x, settled: 0,
  });
  run.flight = null;
}

export function step(run) {
  if (run.phase === 'settling') {
    const ruler = RULERS[run.floor];
    run.settled = Math.min(1, run.settled + TICK / SETTLE_TIME);
    const ease = run.settled ** 2 * (3 - 2 * run.settled);
    run.x = run.settlingFrom + (ruler.start - run.settlingFrom) * ease;
    if (run.settled === 1) run.phase = 'rolling';
    return;
  }

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
  const { shot, result } = run.flight;
  run.flight.elapsed += TICK;
  if (run.flight.elapsed >= result.time) {
    if (result.floor !== null) land(run, result);
    else {
      Object.assign(run, { x: result.x, y: result.y });
      lose(run, result.reason);
    }
    return;
  }
  Object.assign(run, project(shot, run.flight.elapsed));
}
