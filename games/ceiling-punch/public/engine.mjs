export const WIDTH = 416;
export const EDGE = 32;
export const SPEED = 152;
export const TICK = 1 / 120;
export const TOP_FLOOR = 6;
export const SMASH_SECONDS = .22;

export const CEILINGS = [
  [[96, 157], [244, 302]],
  [[180, 213], [262, 322]],
  [[161, 220], [324, 354]],
  [[123, 151], [315, 372]],
  [[112, 167], [275, 312]],
  [[75, 104], [286, 344]],
].map(spans => spans.map(span => Object.freeze([...span]))).map(spans => Object.freeze(spans));

const END = WIDTH - EDGE;

export function createRun() {
  return { phase: 'ready', floor: 0, x: EDGE, direction: 1, elapsed: 0, impact: null };
}

export function doubleWindows(floor) {
  const current = CEILINGS[floor];
  const next = CEILINGS[floor + 1];
  if (!current || !next) return [];
  const windows = [];
  for (const [left, right] of current) {
    for (const [nextLeft, nextRight] of next) {
      const overlapLeft = Math.max(left, nextLeft);
      const overlapRight = Math.min(right, nextRight);
      if (overlapLeft <= overlapRight) windows.push([overlapLeft, overlapRight]);
    }
  }
  return windows.sort((a, b) => a[0] - b[0]);
}

function within(x, [left, right]) {
  return x >= left && x <= right;
}

function missReason(floor, x, direction) {
  const boundaries = CEILINGS[floor].flatMap(([left, right]) => [left, right]);
  const boundary = boundaries.reduce((nearest, candidate) =>
    Math.abs(candidate - x) < Math.abs(nearest - x) ? candidate : nearest, boundaries[0]);
  if (direction > 0) return x < boundary ? 'early' : 'late';
  return x > boundary ? 'early' : 'late';
}

function reset(run) {
  Object.assign(run, createRun());
}

export function tap(run) {
  if (run.phase === 'ready' || run.phase === 'lost' || run.phase === 'won') {
    reset(run);
    run.phase = 'running';
    return true;
  }
  if (run.phase !== 'running') return false;

  const from = run.floor;
  const spans = CEILINGS[from];
  const single = spans.some(span => within(run.x, span));
  if (!single) {
    run.phase = 'lost';
    run.impact = { x: run.x, from, cleared: 0, reason: missReason(from, run.x, run.direction) };
    return true;
  }

  const cleared = doubleWindows(from).some(window => within(run.x, window)) ? 2 : 1;
  run.floor = Math.min(TOP_FLOOR, from + cleared);
  run.phase = 'smash';
  run.elapsed = 0;
  run.impact = { x: run.x, from, cleared, reason: null };
  return true;
}

export function step(run) {
  if (run.phase === 'running') {
    const nextX = run.x + run.direction * SPEED * TICK;
    if ((run.direction > 0 && nextX > END) || (run.direction < 0 && nextX < EDGE)) {
      run.x = run.direction > 0 ? END : EDGE;
      run.phase = 'lost';
      run.impact = { x: run.x, from: run.floor, cleared: 0, reason: 'passed' };
      return;
    }
    run.x = nextX;
    run.elapsed += TICK;
    return;
  }

  if (run.phase !== 'smash') return;
  run.elapsed += TICK;
  if (run.elapsed < SMASH_SECONDS) return;
  if (run.floor >= TOP_FLOOR) {
    run.floor = TOP_FLOOR;
    run.phase = 'won';
    return;
  }
  run.x = run.floor % 2 === 0 ? EDGE : END;
  run.direction = run.floor % 2 === 0 ? 1 : -1;
  run.elapsed = 0;
  run.phase = 'running';
}
