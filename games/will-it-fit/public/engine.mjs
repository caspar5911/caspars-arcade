/** Pure, deterministic suitcase rules. Rotations are clockwise quarter turns. */
const MAX_SIDE = 12;
const MAX_PIECES = 16;
const SEARCH_NODES = 30000;
const SEARCH_CHECKS = 1200000;
const games = new WeakMap();
const forbiddenIds = new Set(['__proto__', 'prototype', 'constructor']);
const integer = Number.isSafeInteger;
const turns = rotation => ((rotation % 4) + 4) % 4;
const key = ([x, y]) => `${x},${y}`;

function clonePlacements(placements) {
  return Object.fromEntries(
    Object.entries(placements).map(([id, value]) => [id, { ...value }]),
  );
}

function fail(message) {
  throw new TypeError(`Invalid packing puzzle: ${message}`);
}

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

function checkedCells(piece) {
  if (
    !piece ||
    !Array.isArray(piece.cells) ||
    !piece.cells.length ||
    piece.cells.length > MAX_SIDE * MAX_SIDE
  ) {
    fail('piece cells');
  }

  const cells = piece.cells.map(cell => {
    if (
      !Array.isArray(cell) ||
      cell.length !== 2 ||
      !cell.every(integer) ||
      cell.some(n => Math.abs(n) > MAX_SIDE)
    ) {
      fail('cell coordinates');
    }
    return [...cell];
  });
  if (new Set(cells.map(key)).size !== cells.length) {
    fail('duplicate cells');
  }

  const connected = new Set([key(cells[0])]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [x, y] of cells) {
      const neighbors = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
      if (
        !connected.has(`${x},${y}`) &&
        neighbors.some(cell => connected.has(key(cell)))
      ) {
        connected.add(`${x},${y}`);
        changed = true;
      }
    }
  }
  if (connected.size !== cells.length) {
    fail('disconnected piece');
  }
  return cells;
}

export function cellsFor(piece, rotation = 0) {
  if (!integer(rotation)) {
    fail('rotation must be an integer');
  }

  let cells = checkedCells(piece);
  for (let i = 0; i < turns(rotation); i++) {
    cells = cells.map(([x, y]) => [-y, x]);
  }
  const minX = Math.min(...cells.map(cell => cell[0]));
  const minY = Math.min(...cells.map(cell => cell[1]));
  return cells
    .map(([x, y]) => [x - minX, y - minY])
    .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

function maskAt(puzzle, cells, x, y) {
  if (!integer(x) || !integer(y) || x < 0 || y < 0) {
    return null;
  }

  let mask = 0n;
  for (const [cx, cy] of cells) {
    const px = x + cx;
    const py = y + cy;
    if (px < 0 || py < 0 || px >= puzzle.cols || py >= puzzle.rows) {
      return null;
    }
    mask |= 1n << BigInt(py * puzzle.cols + px);
  }
  return mask;
}

function prepare(puzzle) {
  if (
    !puzzle ||
    typeof puzzle !== 'object' ||
    !integer(puzzle.cols) ||
    !integer(puzzle.rows) ||
    puzzle.cols < 1 ||
    puzzle.rows < 1 ||
    puzzle.cols > MAX_SIDE ||
    puzzle.rows > MAX_SIDE
  ) {
    fail('board dimensions');
  }
  if (
    typeof puzzle.id !== 'string' ||
    !puzzle.id ||
    typeof puzzle.title !== 'string'
  ) {
    fail('identity');
  }
  if (
    !Array.isArray(puzzle.blocked) ||
    !Array.isArray(puzzle.pieces) ||
    !puzzle.pieces.length ||
    puzzle.pieces.length > MAX_PIECES ||
    !Array.isArray(puzzle.solution)
  ) {
    fail('board arrays');
  }

  const copy = { ...puzzle, blocked: [], pieces: [], solution: [] };
  let blockedMask = 0n;
  for (const cell of puzzle.blocked) {
    if (!Array.isArray(cell) || cell.length !== 2) {
      fail('blocked cell');
    }
    const mask = maskAt(puzzle, [[0, 0]], ...cell);
    if (mask === null || (mask & blockedMask)) {
      fail('blocked cell');
    }
    blockedMask |= mask;
    copy.blocked.push([...cell]);
  }

  const pieces = new Map();
  for (const piece of puzzle.pieces) {
    if (
      !piece ||
      typeof piece.id !== 'string' ||
      !piece.id ||
      piece.id.length > 80 ||
      forbiddenIds.has(piece.id) ||
      pieces.has(piece.id)
    ) {
      fail('piece identity');
    }
    if (
      typeof piece.name !== 'string' ||
      typeof piece.kind !== 'string' ||
      typeof piece.color !== 'string'
    ) {
      fail('piece description');
    }
    const cells = cellsFor(piece, 0);
    if (
      Math.max(...cells.map(cell => cell[0])) >= MAX_SIDE ||
      Math.max(...cells.map(cell => cell[1])) >= MAX_SIDE
    ) {
      fail('piece dimensions');
    }
    const item = { ...piece, cells };
    copy.pieces.push(item);
    const rotations = Array.from({ length: 4 }, (_, rotation) => cellsFor(item, rotation));
    pieces.set(item.id, { piece: item, rotations, candidates: null });
  }

  let occupied = blockedMask;
  const solved = new Set();
  for (const move of puzzle.solution) {
    if (
      !move ||
      !pieces.has(move.id) ||
      solved.has(move.id) ||
      !integer(move.rotation)
    ) {
      fail('solution identity or rotation');
    }
    const mask = maskAt(
      copy,
      pieces.get(move.id).rotations[turns(move.rotation)],
      move.x,
      move.y,
    );
    if (mask === null || (mask & occupied)) {
      fail('solution collision');
    }
    occupied |= mask;
    solved.add(move.id);
    copy.solution.push({ id: move.id, x: move.x, y: move.y, rotation: turns(move.rotation) });
  }
  if (solved.size !== pieces.size) {
    fail('incomplete solution');
  }
  return { puzzle: freeze(copy), pieces, blockedMask };
}

export function createGame(puzzle) {
  const meta = prepare(puzzle);
  const game = { puzzle: meta.puzzle, placements: {}, history: [], moves: 0, hints: 0 };
  games.set(game, meta);
  return game;
}

function current(game) {
  const meta = game && games.get(game);
  if (
    !meta ||
    game.puzzle !== meta.puzzle ||
    !game.placements ||
    typeof game.placements !== 'object' ||
    Array.isArray(game.placements) ||
    !Array.isArray(game.history) ||
    !integer(game.moves) ||
    game.moves < 0 ||
    !integer(game.hints) ||
    game.hints < 0
  ) {
    return null;
  }

  let occupied = meta.blockedMask;
  const masks = new Map();
  for (const [id, move] of Object.entries(game.placements)) {
    const piece = meta.pieces.get(id);
    if (!piece || !move || !integer(move.rotation)) {
      return null;
    }
    const mask = maskAt(meta.puzzle, piece.rotations[turns(move.rotation)], move.x, move.y);
    if (mask === null || (occupied & mask)) {
      return null;
    }
    occupied |= mask;
    masks.set(id, mask);
  }
  return { meta, occupied, masks };
}

export function canPlace(game, id, x, y, rotation = 0) {
  const state = current(game);
  if (!state || !state.meta.pieces.has(id) || !integer(rotation)) {
    return false;
  }
  const mask = maskAt(
    game.puzzle,
    state.meta.pieces.get(id).rotations[turns(rotation)],
    x,
    y,
  );
  const occupied = state.occupied ^ (state.masks.get(id) ?? 0n);
  return mask !== null && !(occupied & mask);
}

function remember(game) {
  game.history.push({ placements: clonePlacements(game.placements), moves: game.moves });
}

export function place(game, id, x, y, rotation = 0) {
  if (!canPlace(game, id, x, y, rotation)) {
    return false;
  }
  const normalized = turns(rotation);
  const previous = game.placements[id];
  if (previous && previous.x === x && previous.y === y && previous.rotation === normalized) {
    return false;
  }
  remember(game);
  game.placements[id] = { x, y, rotation: normalized };
  game.moves++;
  return true;
}

export function remove(game, id) {
  if (!current(game) || !Object.hasOwn(game.placements, id)) {
    return false;
  }
  remember(game);
  delete game.placements[id];
  game.moves++;
  return true;
}

export function undo(game) {
  if (!current(game) || !game.history.length) {
    return false;
  }
  const previous = game.history.at(-1);
  // History is public for UI inspection; validate externally modified snapshots before restoring.
  const restored = { ...game, placements: previous?.placements, moves: previous?.moves };
  games.set(restored, games.get(game));
  if (!current(restored)) {
    return false;
  }
  game.history.pop();
  game.placements = clonePlacements(previous.placements);
  game.moves = previous.moves;
  return true;
}

export function reset(game) {
  if (!games.has(game)) {
    return false;
  }
  game.puzzle = games.get(game).puzzle;
  game.placements = {};
  game.history = [];
  game.moves = 0;
  game.hints = 0;
  return true;
}

export function isComplete(game) {
  const state = current(game);
  return Boolean(state && state.masks.size === state.meta.pieces.size);
}

function candidatesFor(meta, piece) {
  if (piece.candidates) {
    return piece.candidates;
  }
  const candidates = [];
  const seen = new Set();
  for (let rotation = 0; rotation < 4; rotation++) {
    const cells = piece.rotations[rotation];
    const signature = JSON.stringify(cells);
    if (seen.has(signature)) {
      continue;
    }
    seen.add(signature);
    const width = Math.max(...cells.map(cell => cell[0])) + 1;
    const height = Math.max(...cells.map(cell => cell[1])) + 1;
    for (let y = 0; y <= meta.puzzle.rows - height; y++) {
      for (let x = 0; x <= meta.puzzle.cols - width; x++) {
        const mask = maskAt(meta.puzzle, cells, x, y);
        if (!(mask & meta.blockedMask)) {
          candidates.push({ id: piece.piece.id, x, y, rotation, mask });
        }
      }
    }
  }
  piece.candidates = candidates;
  return candidates;
}

/** Returns a move only after proving a complete extension. Never moves an existing item.
 * Search is finite (30k branches / 1.2m candidate checks); null also means budget exhausted.
 */
export function hint(game) {
  const state = current(game);
  if (!state || isComplete(game)) {
    return null;
  }
  const { meta } = state;
  const compatible = meta.puzzle.solution.every(move => {
    if (!state.masks.has(move.id)) {
      return true;
    }
    return state.masks.get(move.id) === maskAt(
      meta.puzzle,
      meta.pieces.get(move.id).rotations[move.rotation],
      move.x,
      move.y,
    );
  });
  if (compatible) {
    const next = meta.puzzle.solution.find(move => !state.masks.has(move.id));
    game.hints++;
    return { ...next };
  }

  const remaining = [...meta.pieces.values()].filter(piece => !state.masks.has(piece.piece.id));
  const lists = remaining.map(piece => candidatesFor(meta, piece));
  let nodes = 0;
  let checks = 0;
  let exhausted = false;
  const failed = new Set();

  function search(indices, occupied) {
    if (!indices.length) {
      return [];
    }
    if (++nodes > SEARCH_NODES || checks >= SEARCH_CHECKS) {
      exhausted = true;
      return null;
    }
    const memo = `${indices.join(',')}:${occupied}`;
    if (failed.has(memo)) {
      return null;
    }

    let chosen = -1;
    let options = null;
    for (const index of indices) {
      const available = [];
      for (const candidate of lists[index]) {
        if (++checks > SEARCH_CHECKS) {
          exhausted = true;
          return null;
        }
        if (!(candidate.mask & occupied)) {
          available.push(candidate);
        }
      }
      if (!available.length) {
        failed.add(memo);
        return null;
      }
      if (!options || available.length < options.length) {
        chosen = index;
        options = available;
      }
    }

    const rest = indices.filter(index => index !== chosen);
    for (const candidate of options) {
      const result = search(rest, occupied | candidate.mask);
      if (result) {
        return [candidate, ...result];
      }
      if (exhausted) {
        return null;
      }
    }
    failed.add(memo);
    return null;
  }

  const solution = search(lists.map((_, index) => index), state.occupied);
  if (!solution) {
    return null;
  }
  const { id, x, y, rotation } = solution[0];
  game.hints++;
  return { id, x, y, rotation };
}

// Each letter is a connected, hand-partitioned object; # is a suitcase wheel pocket.
// The partition is also a constructive proof of solvability, independent of the hint search.
const layouts = [
  ['Just the essentials', ['AAAB', 'CCBB', 'CCBB']],
  ['A little twist', ['AAAB', 'ACBB', 'CCDB', 'CDDD']],
  ['Weekend away', ['AAABB', 'ACCCB', 'ADCCB', 'DDDEE']],
  ['Mind the wheels', ['#AABB', 'AAACB', 'DCCCB', 'DDCEB', 'DDEEE']],
  ['One more thing', ['AAABBC', 'ADDBCC', 'ADDBEC', 'FFFEEE']],
  ['Carry-on only', ['AAABBC', 'ADBBCC', 'ADDECC', 'FDDEEC', 'FFGEEE']],
  ['Tight connections', ['#AABBC', 'AAABCC', 'DDEBBC', 'DDEECC', 'DFFEGG']],
  ['The long weekend', ['AAABBC', 'ADDBBC', 'ADDECC', 'FFDEEC', 'FGGEHH', 'FGGHHH']],
  ['Every corner counts', ['#AABBC', 'AAABCC', 'DDEBBC', 'DDEECC', 'DFFEGG', 'HHHGG#']],
  ['Overhead locker', ['AAABBCC', 'ADDBBCC', 'ADDEECC', 'FDDEGGG', 'FFHEEGG', 'HHHHEGG']],
  ['Souvenir space', ['#AABBCC', 'AAABCCC', 'DDEBBCC', 'DDEEGGC', 'DFFEGGG', 'HHHEEG#']],
  ['The final squeeze', ['#AABBCC', 'AAABCCC', 'DDEBBCC', 'DDEEGGC', 'DFFEGGG', 'HFFFHGG', 'HHHHHG#']],
];
const identities = [
  ['shoe', 'Trainers', '#ed7868'],
  ['camera', 'Camera', '#e6b94c'],
  ['book', 'Holiday read', '#63ada7'],
  ['headphones', 'Headphones', '#ab96d6'],
  ['shirt', 'Favourite tee', '#ed9fb3'],
  ['bottle', 'Water bottle', '#78b9d6'],
  ['keys', 'Keys', '#deb258'],
  ['mug', 'Travel mug', '#88b58b'],
  ['brush', 'Hairbrush', '#d99b73'],
];

function puzzleFromLayout(id, title, lines, offset = 0) {
  const cols = lines[0].length;
  const rows = lines.length;
  const cellsById = new Map();
  const blocked = [];
  for (let y = 0; y < rows; y++) {
    if (lines[y].length !== cols) {
      fail('authored layout width');
    }
    for (let x = 0; x < cols; x++) {
      const letter = lines[y][x];
      if (letter === '#') {
        blocked.push([x, y]);
        continue;
      }
      if (!cellsById.has(letter)) {
        cellsById.set(letter, []);
      }
      cellsById.get(letter).push([x, y]);
    }
  }

  const pieces = [];
  const solution = [];
  [...cellsById]
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([letter, cells], index) => {
      const x = Math.min(...cells.map(cell => cell[0]));
      const y = Math.min(...cells.map(cell => cell[1]));
      const local = cells.map(([cx, cy]) => [cx - x, cy - y]);
      const twist = offset === 0 ? 0 : (index + offset) % 4;
      const [kind, name, color] = identities[(index + offset) % identities.length];
      const pieceId = letter.toLowerCase();
      pieces.push({ id: pieceId, name, kind, color, cells: cellsFor({ cells: local }, twist) });
      solution.push({ id: pieceId, x, y, rotation: turns(-twist) });
    });
  return freeze({ id, title, cols, rows, blocked, pieces, solution });
}

export const LEVELS = freeze(
  layouts.map(([title, lines], index) => (
    puzzleFromLayout(`level-${index + 1}`, title, lines, index)
  )),
);

function singaporeDay(date) {
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const parsed = new Date(`${date}T00:00:00Z`);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
      fail('daily date');
    }
    return date;
  }
  const parsed = date === undefined ? new Date() : date instanceof Date ? date : new Date(date);
  if (!Number.isFinite(parsed.getTime())) {
    fail('daily date');
  }
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(parsed);
}

export function dailyPuzzle(date) {
  const day = singaporeDay(date);
  let seed = 2166136261;
  for (const char of day) {
    seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  }
  const index = 4 + seed % 8;
  let lines = [...layouts[index][1]];
  if (seed & 8) {
    lines = lines.map(line => [...line].reverse().join(''));
  }
  for (let turn = 0; turn < (seed >>> 5) % 4; turn++) {
    lines = Array.from({ length: lines[0].length }, (_, x) => (
      lines.map(line => line[x]).reverse().join('')
    ));
  }
  return puzzleFromLayout(`daily-${day}`, `Daily bag · ${day}`, lines, 1 + seed % 8);
}
