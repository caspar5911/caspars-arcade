export const LEGACY_BOARD = Object.freeze({
  id: 'classic', name: 'Classic grid', start: 0, exit: 24, walls: Object.freeze([]),
});

export function normalizeRules(rules) {
  if (!Array.isArray(rules) || rules.length > 8 ||
      rules.some(rule => typeof rule !== 'string' ||
        !/^(UU|UL|UR|DD|DL|DR|LL|LU|LD|RR|RU|RD)$/.test(rule)) ||
      new Set(rules).size !== rules.length) {
    throw new Error('Invalid rules');
  }
  return [...rules].sort();
}

export function direction(from, to) {
  if (!Number.isInteger(from) || !Number.isInteger(to) ||
      from < 0 || from >= 25 || to < 0 || to >= 25) return null;
  if (to === from - 5) return 'U';
  if (to === from + 5) return 'D';
  if (to === from - 1 && from % 5 !== 0) return 'L';
  if (to === from + 1 && from % 5 !== 4) return 'R';
  return null;
}

export function checkPath(path, rules, requireWin = true, board = LEGACY_BOARD) {
  try {
    rules = normalizeRules(rules);
  } catch {
    return { ok: false, reason: 'Invalid rules' };
  }
  if (!Array.isArray(path) || !path.length || path.length > 25 || path[0] !== board.start) {
    return { ok: false, reason: 'Begin on the start tile.' };
  }

  let previous = '';
  const seen = new Set([board.start]);
  const pairs = [];
  for (let i = 1; i < path.length; i++) {
    const from = path[i - 1];
    const to = path[i];
    const move = direction(from, to);
    if (from === board.exit) return { ok: false, reason: 'The exit ends the run.' };
    if (!move) return { ok: false, reason: 'Move to a neighboring tile.' };
    if (board.walls.includes(to)) return { ok: false, reason: 'That tile is a wall.' };
    if (seen.has(to)) return { ok: false, reason: 'You already used that tile.' };
    if (previous) {
      const pair = previous + move;
      if (rules.includes(pair)) {
        return { ok: false, pair, tiles: path.slice(i - 2, i + 1) };
      }
      pairs.push(pair);
    }
    seen.add(to);
    previous = move;
  }
  if (requireWin && path.at(-1) !== board.exit) {
    return { ok: false, reason: 'Reach the exit first.' };
  }
  return { ok: true, pairs };
}

export function solve(rules, budget = 100000, board = LEGACY_BOARD) {
  const bans = new Set(normalizeRules(rules));
  if (!Number.isSafeInteger(budget) || budget < 0) throw new Error('Invalid budget');
  const walls = board.walls.reduce((mask, cell) => mask | (1 << cell), 0);
  const path = [board.start];
  let steps = 0;
  let unknown = false;

  function search(cell, previous, visited) {
    if (steps >= budget) {
      unknown = true;
      return null;
    }
    steps++;
    if (cell === board.exit) return [...path];

    for (const next of [cell + 1, cell + 5, cell - 1, cell - 5]) {
      const move = direction(cell, next);
      if (!move || (visited & (1 << next)) || (previous && bans.has(previous + move))) continue;
      path.push(next);
      const witness = search(next, move, visited | (1 << next));
      path.pop();
      if (witness || unknown) return witness;
    }
    return null;
  }

  const witness = search(board.start, '', walls | (1 << board.start));
  return { status: witness ? 'solved' : unknown ? 'unknown' : 'unsolvable', witness, steps };
}

export function candidates(path, rules, budget = 100000, board = LEGACY_BOARD) {
  const win = checkPath(path, rules, true, board);
  if (!win.ok) throw new Error(win.reason ?? 'The path uses a forbidden turn.');
  if (rules.length >= 8) return [];

  return [...new Set(win.pairs)].sort().map(rule => {
    const { status, witness } = solve([...rules, rule], budget, board);
    return { rule, status, witness };
  });
}
