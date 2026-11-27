// Ceiling Punch: an endless, never-stopping one-tap climber.
// The robot runs and bounces between the walls without pause. Punch through a crack in the ceiling above to climb a
// floor (a gold spot, where this ceiling's crack lines up with the next one's, breaks both: two floors). Punch solid
// concrete and the run ends. A flood rises from below all the time, faster and faster, so you can't wait forever.
// Everything here is deterministic: a seed makes the same tower every time.

export const WIDTH = 416;
export const EDGE = 32;
export const END = WIDTH - EDGE;
export const TICK = 1 / 120;
export const SMASH_SECONDS = .26;

export const BASE_SPEED = 150; // px per second on floor 0
export const MAX_SPEED = 265;
export const SPEED_PER_FLOOR = 3.2;

export const FLOOD_START = -2; // floors below the robot at the start
export const FLOOD_BASE = .45; // floors per second at the start
export const FLOOD_MAX = 1.4;
export const FLOOD_RAMP = .012; // extra floors per second, per second
export const FLOOD_GAP_MAX = 2.4; // the flood is never further behind than this

const MARGIN = 50; // cracks keep this far from the walls
const MIN_GAP = 34; // between two cracks in one ceiling

export function speedAt(floor) {
  return Math.min(MAX_SPEED, BASE_SPEED + floor * SPEED_PER_FLOOR);
}

export function floodRate(time) {
  return Math.min(FLOOD_MAX, FLOOD_BASE + time * FLOOD_RAMP);
}

/** How hard ceiling n is, 0 (easy) to 1 (hardest), reached by ceiling 45. */
export function difficulty(n) {
  return Math.min(1, Math.max(0, n) / 45);
}

function mulberry32(a) {
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mix(seed, n) {
  let h = (seed ^ Math.imul(n + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

export function nextSeed(seed) {
  return (Math.imul(seed >>> 0, 1664525) + 1013904223) >>> 0;
}

const cache = new Map(); // `${seed}:${n}` -> spans

function fits(spans, left, right, below) {
  return left >= MARGIN && right <= WIDTH - MARGIN &&
    spans.every(([a, b]) => right + MIN_GAP <= a || left >= b + MIN_GAP) &&
    // (no gold by accident: only the crack placed on purpose lines up with the ceiling below)
    (below ?? []).every(([a, b]) => right < a || left > b);
}

function makeCeiling(seed, n, below) {
  const rng = mulberry32(mix(seed, n));
  const d = difficulty(n);
  const width = () => Math.round((58 - 32 * d) * (.85 + .3 * rng()));
  const roll = rng();
  const count = n < 6 ? 2 : roll < .25 * (1 - d) ? 3 : roll > 1 - .3 * d ? 1 : 2;
  const spans = [];
  // a gold chance: line one crack up with a crack of the ceiling below (both break with one punch)
  if (below && rng() < .5) {
    const [a, b] = below[Math.floor(rng() * below.length)];
    const w = width();
    // shifted a little, so the gold spot is part of both cracks: about two-thirds of a crack wide
    const centre = (a + b) / 2 + (rng() < .5 ? -1 : 1) * (.25 + .15 * rng()) * Math.min(w, b - a);
    const left = Math.round(Math.min(WIDTH - MARGIN - w, Math.max(MARGIN, centre - w / 2)));
    if (Math.min(left + w, b) - Math.max(left, a) >= 14) spans.push([left, left + w]);
  }
  for (let tries = 0; spans.length < count && tries < 60; tries++) {
    const w = width();
    const left = Math.round(MARGIN + rng() * (WIDTH - 2 * MARGIN - w));
    if (fits(spans, left, left + w, below)) spans.push([left, left + w]);
  }
  if (spans.length === 0) spans.push([WIDTH / 2 - 20, WIDTH / 2 + 20]); // (never happens in practice)
  return Object.freeze(spans.sort((p, q) => p[0] - q[0]).map(s => Object.freeze(s)));
}

/** The cracks in ceiling n (the one above floor n), sorted inclusive [left, right] spans. */
export function ceilingAt(seed, n) {
  seed >>>= 0;
  const key = k => seed + ':' + k;
  if (cache.has(key(n))) return cache.get(key(n));
  if (cache.size > 4000) cache.clear();
  let k = n;
  while (k > 0 && !cache.has(key(k - 1))) k--; // build up from the last one made (no deep recursion)
  for (; k <= n; k++) {
    cache.set(key(k), makeCeiling(seed, k, k > 0 ? cache.get(key(k - 1)) : null));
  }
  return cache.get(key(n));
}

/** Gold spots above floor n: where ceiling n's cracks overlap ceiling n+1's (one punch breaks both). */
export function doubleWindows(seed, floor) {
  const windows = [];
  for (const [left, right] of ceilingAt(seed, floor)) {
    for (const [nextLeft, nextRight] of ceilingAt(seed, floor + 1)) {
      const a = Math.max(left, nextLeft);
      const b = Math.min(right, nextRight);
      if (a <= b) windows.push([a, b]);
    }
  }
  return windows.sort((p, q) => p[0] - q[0]);
}

export function createRun(seed = 1) {
  return {
    phase: 'ready', floor: 0, x: EDGE, direction: 1, elapsed: 0, impact: null,
    seed: seed >>> 0, time: 0, flood: FLOOD_START, holes: [],
  };
}

function within(x, [left, right]) {
  return x >= left && x <= right;
}

function missReason(spans, x, direction) {
  const boundaries = spans.flatMap(([left, right]) => [left, right]);
  const boundary = boundaries.reduce((nearest, b) => (Math.abs(b - x) < Math.abs(nearest - x) ? b : nearest));
  if (direction > 0) return x < boundary ? 'early' : 'late';
  return x > boundary ? 'early' : 'late';
}

function restart(run, seed) {
  Object.assign(run, createRun(seed));
  run.phase = 'running';
}

/** One tap: start, punch, or (after a lost run) start a new tower. Returns whether it did anything. */
export function tap(run) {
  if (run.phase === 'ready') {
    restart(run, run.seed);
    return true;
  }
  if (run.phase === 'lost') {
    restart(run, nextSeed(run.seed));
    return true;
  }
  if (run.phase !== 'running') return false; // (mid-air: the punch is still going)

  const from = run.floor;
  const spans = ceilingAt(run.seed, from);
  if (!spans.some(span => within(run.x, span))) {
    run.phase = 'lost';
    run.impact = { x: run.x, from, cleared: 0, reason: missReason(spans, run.x, run.direction) };
    return true;
  }
  const cleared = doubleWindows(run.seed, from).some(w => within(run.x, w)) ? 2 : 1;
  run.floor = from + cleared;
  run.phase = 'smash';
  run.elapsed = 0;
  run.impact = { x: run.x, from, cleared, reason: null };
  for (let c = 1; c <= cleared; c++) run.holes.push({ slab: from + c, x: run.x });
  if (cleared === 2) run.flood = Math.min(run.flood, run.floor - FLOOD_GAP_MAX); // gold: the flood falls right back
  if (run.holes.length > 12) run.holes.splice(0, run.holes.length - 12);
  return true;
}

/** One fixed tick: the robot keeps running (bouncing off the walls), the flood keeps rising. */
export function step(run) {
  if (run.phase !== 'running' && run.phase !== 'smash') return;
  run.time += TICK;
  run.x += run.direction * speedAt(run.floor) * TICK;
  if (run.x > END) {
    run.x = END - (run.x - END);
    run.direction = -1;
  } else if (run.x < EDGE) {
    run.x = EDGE + (EDGE - run.x);
    run.direction = 1;
  }
  run.flood = Math.max(run.flood + floodRate(run.time) * TICK, run.floor - FLOOD_GAP_MAX);
  if (run.phase === 'smash') {
    run.elapsed += TICK;
    if (run.elapsed >= SMASH_SECONDS) {
      run.phase = 'running';
      run.elapsed = 0;
    }
    return;
  }
  if (run.flood >= run.floor) {
    run.phase = 'lost';
    run.impact = { x: run.x, from: run.floor, cleared: 0, reason: 'flooded' };
  }
}
