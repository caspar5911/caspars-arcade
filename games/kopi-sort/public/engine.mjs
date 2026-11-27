// Kopi Sort: the kopi uncle's trays got mixed up. Move cups between trays until each tray holds one drink only.
// A move pours the top cups of one tray (all the same drink, as many as fit) onto an empty tray or onto the same
// drink. Every puzzle is checked solvable by the solver here, which also sets "par" (a good number of moves).
// Everything is deterministic: the same seed makes the same trays on every phone.

export const CUP = 4; // cups per tray
export const DRINKS = [
  { id: 'kopi', name: 'Kopi', label: 'K', color: '#6b3e26', ink: '#fff3e6' },
  { id: 'teh', name: 'Teh', label: 'T', color: '#e08a2e', ink: '#2b1606' },
  { id: 'milo', name: 'Milo', label: 'M', color: '#2f9a52', ink: '#effff2' },
  { id: 'bandung', name: 'Bandung', label: 'B', color: '#f06ea0', ink: '#3a0b1d' },
  { id: 'barley', name: 'Barley', label: 'Ba', color: '#f1e3a6', ink: '#3b3110' },
  { id: 'chinchow', name: 'Chin chow', label: 'C', color: '#2b2523', ink: '#f3efe8' },
  { id: 'lime', name: 'Lime juice', label: 'L', color: '#cfe84a', ink: '#27300a' },
  { id: 'sirap', name: 'Sirap', label: 'S', color: '#d6333f', ink: '#fff0f0' },
];

export const LEVELS = 20;

/** How many drinks a level has (more as you go): 3, 3, 3, 4, 4, 4, 5 … up to 8. Always two spare trays. */
export function levelDrinks(level) {
  return Math.min(DRINKS.length, 3 + Math.floor((Math.max(1, level) - 1) / 3));
}

// ---------------------------------------------------------------------------------------------------- dice
function mulberry32(a) {
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

// ---------------------------------------------------------------------------------------------------- rules
/** A state is an array of trays; a tray is an array of drink indexes, bottom first. */
export function clone(state) {
  return state.map(t => t.slice());
}

/** How many cups of the same drink sit on top of a tray. */
export function topRun(tray) {
  if (!tray.length) return 0;
  const top = tray[tray.length - 1];
  let n = 0;
  for (let i = tray.length - 1; i >= 0 && tray[i] === top; i--) n++;
  return n;
}

export function full(tray) {
  return tray.length === CUP && topRun(tray) === CUP; // (one drink, all four)
}

/** How many cups would pour from tray a to tray b (0: not allowed). */
export function pourCount(state, a, b) {
  if (a === b) return 0;
  const from = state[a], to = state[b];
  if (!from || !to || !from.length || to.length >= CUP) return 0;
  if (to.length && to[to.length - 1] !== from[from.length - 1]) return 0;
  return Math.min(topRun(from), CUP - to.length);
}

/** Pour (changes the state). Returns how many cups moved. */
export function pour(state, a, b) {
  const n = pourCount(state, a, b);
  for (let i = 0; i < n; i++) state[b].push(state[a].pop());
  return n;
}

export function solved(state) {
  return state.every(t => t.length === 0 || full(t));
}

// ---------------------------------------------------------------------------------------------------- solver
const key = state => state.map(t => t.join('')).sort().join('|');

/** Each place where the drink changes inside a tray needs at least one move to fix (a lower bound). */
function estimate(state) {
  let h = 0;
  for (const t of state) for (let i = 1; i < t.length; i++) if (t[i] !== t[i - 1]) h++;
  return h;
}

/** Useful moves from here (no pointless ones: a whole one-drink tray into an empty one). */
function moves(state) {
  const out = [];
  for (let a = 0; a < state.length; a++) {
    const from = state[a];
    if (!from.length || full(from)) continue;
    const run = topRun(from);
    let emptyTried = false;
    for (let b = 0; b < state.length; b++) {
      const n = pourCount(state, a, b);
      if (!n) continue;
      if (state[b].length === 0) {
        if (run === from.length || emptyTried) continue; // (same as staying put, or the same as another empty)
        emptyTried = true;
      }
      out.push([a, b]);
    }
  }
  return out;
}

/**
 * A short solution (a list of [from, to] moves), or null if none was found within `limit` positions.
 * Weighted A*: quick, and usually close to the fewest moves.
 */
export function solve(start, limit = 60000) {
  if (solved(start)) return [];
  const seen = new Map([[key(start), 0]]);
  // a simple binary heap of [f, g, state, path]
  const heap = [[estimate(start) * 1.4, 0, clone(start), []]];
  const push = item => {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const popMin = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  let explored = 0;
  while (heap.length && explored < limit) {
    const [, g, state, path] = popMin();
    explored++;
    for (const [a, b] of moves(state)) {
      const next = clone(state);
      pour(next, a, b);
      const k = key(next);
      if (seen.has(k) && seen.get(k) <= g + 1) continue;
      seen.set(k, g + 1);
      const p = [...path, [a, b]];
      if (solved(next)) return p;
      push([g + 1 + estimate(next) * 1.4, g + 1, next, p]);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------- puzzles
/** Mixed-up trays for `drinks` drinks (plus `spare` empty trays), from a seed: always solvable. */
export function generate(seed, drinks, spare = 2) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const rng = mulberry32(hash(seed + ':' + attempt));
    const cups = [];
    for (let d = 0; d < drinks; d++) for (let i = 0; i < CUP; i++) cups.push(d);
    for (let i = cups.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [cups[i], cups[j]] = [cups[j], cups[i]];
    }
    const trays = [];
    for (let t = 0; t < drinks; t++) trays.push(cups.slice(t * CUP, t * CUP + CUP));
    for (let s = 0; s < spare; s++) trays.push([]);
    // not too easy: no tray already sorted, and no tray with three of one drink on top
    if (trays.some(t => t.length && topRun(t) >= 3)) continue;
    const solution = solve(trays);
    if (solution && solution.length >= drinks + 1) return { trays, par: solution.length, solution };
  }
  throw new Error('No puzzle found for ' + seed);
}

/** Level n (1 to 20): the same puzzle for everyone. */
export function level(n) {
  return generate('kopi-sort-level-' + n, levelDrinks(n));
}

/** The day (Singapore time) as YYYY-MM-DD. */
export function dayKey(date = new Date()) {
  return new Date(date.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

export const FIRST_DAY = '2026-11-27';

/** Today's tray: the same for everyone today, six drinks. Its number counts from the first one. */
export function daily(day = dayKey()) {
  const number = Math.round((Date.parse(day) - Date.parse(FIRST_DAY)) / 86400000) + 1;
  return { day, number, ...generate('kopi-sort-daily-' + day, 6) };
}

/** Stars for solving in `moves` (3: at or under par; 2: a little over; 1: solved). */
export function stars(moves, par) {
  if (moves <= par) return 3;
  if (moves <= par + Math.max(2, Math.ceil(par * .25))) return 2;
  return 1;
}
