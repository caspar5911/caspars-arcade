import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, dailyPuzzle, createGame, cellsFor, canPlace, place, remove, undo, reset, isComplete, hint } from '../games/will-it-fit/public/engine.mjs';

const dominoes = () => ({ id: 'dominoes', title: 'Test bag', cols: 3, rows: 2, blocked: [], pieces: ['a', 'b', 'c'].map(id => ({ id, name: id, kind: 'book', color: '#123456', cells: [[0, 0], [1, 0]] })), solution: [{ id: 'a', x: 0, y: 0, rotation: 0 }, { id: 'b', x: 0, y: 1, rotation: 0 }, { id: 'c', x: 2, y: 0, rotation: 1 }] });
const snapshot = game => JSON.stringify({ placements: game.placements, moves: game.moves, history: game.history, hints: game.hints });

// Independent raster check catches an invalid supplied solution even if placement code also regresses.
function verifySolution(puzzle) {
  const covered = new Set(puzzle.blocked.map(([x, y]) => `${x},${y}`));
  const ids = new Set();
  for (const move of puzzle.solution) {
    assert.ok(!ids.has(move.id)); ids.add(move.id);
    const piece = puzzle.pieces.find(p => p.id === move.id);
    assert.ok(piece);
    const turns = ((move.rotation % 4) + 4) % 4;
    let cells = piece.cells.map(([x, y]) => [x, y]);
    for (let i = 0; i < turns; i++) cells = cells.map(([x, y]) => [-y, x]);
    const minX = Math.min(...cells.map(c => c[0])), minY = Math.min(...cells.map(c => c[1]));
    for (const [cx, cy] of cells) {
      const x = cx - minX + move.x, y = cy - minY + move.y, key = `${x},${y}`;
      assert.ok(x >= 0 && x < puzzle.cols && y >= 0 && y < puzzle.rows, `${puzzle.id}: bounds`);
      assert.ok(!covered.has(key), `${puzzle.id}: overlap at ${key}`);
      covered.add(key);
    }
  }
  assert.equal(ids.size, puzzle.pieces.length);
  assert.equal(covered.size, puzzle.cols * puzzle.rows, 'campaign fills every usable cell');
}

test('all twelve campaign solutions cover their bag exactly with connected, varied pieces', () => {
  assert.equal(LEVELS.length, 12);
  assert.equal(new Set(LEVELS.map(p => p.id)).size, 12);
  assert.ok(LEVELS[0].pieces.length <= 4);
  assert.ok(LEVELS.at(-1).pieces.length >= 7);
  assert.ok(LEVELS.some(p => p.blocked.length));
  const kinds = new Set();
  for (const puzzle of LEVELS) {
    verifySolution(puzzle);
    const game = createGame(puzzle);
    assert.equal(isComplete(game), false);
    for (const piece of puzzle.pieces) {
      kinds.add(piece.kind);
      const seen = new Set([piece.cells[0].join(',')]);
      let changed = true;
      while (changed) { changed = false; for (const [x, y] of piece.cells) if (!seen.has(`${x},${y}`) && [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].some(c => seen.has(c.join(',')))) { seen.add(`${x},${y}`); changed = true; } }
      assert.equal(seen.size, piece.cells.length, `${puzzle.id}/${piece.id} connected`);
    }
    for (const move of puzzle.solution) assert.equal(place(game, move.id, move.x, move.y, move.rotation), true);
    assert.equal(isComplete(game), true);
  }
  assert.ok(kinds.size >= 8);
});

test('quarter turns normalize cells without mutating the shape', () => {
  const piece = { cells: [[0,0],[0,1],[1,1]] };
  assert.deepEqual(cellsFor(piece, 1), [[0,0],[1,0],[0,1]]);
  assert.deepEqual(cellsFor(piece, -1), [[1,0],[0,1],[1,1]]);
  assert.deepEqual(cellsFor(piece, 4), [[0,0],[0,1],[1,1]]);
  assert.deepEqual(piece.cells, [[0,0],[0,1],[1,1]]);
  assert.throws(() => cellsFor(piece, 0.5), TypeError);
  assert.throws(() => cellsFor({ cells: [[0,0],[0,0]] }, 0), TypeError);
});

test('placement rejects overlap, bounds and invalid commands atomically', () => {
  const game = createGame(dominoes());
  assert.equal(place(game, 'a', 0, 0, 0), true);
  assert.equal(canPlace(game, 'a', 0, 0, 0), true, 'moving ignores its own old cells');
  const before = snapshot(game);
  for (const args of [['b',0,0,0],['a',-1,0,0],['a',2,0,0],['a',0,2,0],['a',0,0,NaN],['a',0.1,0,0],['missing',0,0,0],['__proto__',0,0,0],['a','0',0,0]]) {
    assert.equal(place(game, ...args), false);
    assert.equal(snapshot(game), before);
  }
  assert.equal(place(game, 'a', 0, 0, 0), false, 'same placement is not another move');
  assert.equal(place(game, 'a', 1, 0, 1), true);
  assert.deepEqual(game.placements.a, { x: 1, y: 0, rotation: 1 });
  assert.equal(game.moves, 2);
});

test('blocked pockets reject occupied cells even when the bounding box fits', () => {
  const puzzle = { ...dominoes(), cols: 4, blocked: [[3,0],[3,1]] };
  const game = createGame(puzzle);
  assert.equal(canPlace(game, 'a', 2, 0, 0), false);
  assert.equal(place(game, 'a', 2, 0, 1), true);
});

test('remove, undo and reset recover exact previous layouts and move counts', () => {
  const game = createGame(dominoes());
  assert.equal(undo(game), false);
  assert.equal(remove(game, 'a'), false);
  place(game, 'a', 0, 0, 0); place(game, 'b', 0, 1, 0);
  assert.equal(remove(game, 'a'), true);
  assert.equal(game.moves, 3);
  assert.equal(undo(game), true);
  assert.equal(game.moves, 2);
  assert.deepEqual(game.placements, { a: {x:0,y:0,rotation:0}, b: {x:0,y:1,rotation:0} });
  assert.equal(undo(game), true);
  assert.equal(game.moves, 1);
  assert.deepEqual(Object.keys(game.placements), ['a']);
  hint(game);
  reset(game);
  assert.deepEqual(game.placements, {});
  assert.equal(game.moves, 0); assert.equal(game.hints, 0); assert.equal(game.history.length, 0);
});

test('hints finish every campaign without overwriting player placements', () => {
  for (const puzzle of LEVELS) {
    const game = createGame(puzzle);
    for (let i = 0; i < puzzle.pieces.length; i++) {
      const old = structuredClone(game.placements), move = hint(game);
      assert.ok(move, puzzle.id);
      assert.ok(!Object.hasOwn(old, move.id));
      assert.deepEqual(game.placements, old, 'asking for a hint does not place anything');
      assert.equal(place(game, move.id, move.x, move.y, move.rotation), true);
    }
    assert.equal(isComplete(game), true);
    assert.equal(game.hints, puzzle.pieces.length);
    assert.equal(hint(game), null);
  }
});

test('a hint finds a completion after a legal placement outside the stored solution', () => {
  const game = createGame(dominoes());
  place(game, 'a', 1, 0, 1);
  const first = structuredClone(game.placements.a);
  while (!isComplete(game)) {
    const move = hint(game); assert.ok(move);
    assert.equal(place(game, move.id, move.x, move.y, move.rotation), true);
    assert.deepEqual(game.placements.a, first);
  }
});

test('a legal but impossible partial layout returns no misleading hint', () => {
  const puzzle = { id: 'dead-end', title: 'Dead end', cols: 4, rows: 2, blocked: [], pieces: [
    {id:'a',name:'a',kind:'book',color:'#000',cells:[[0,0],[1,0]]},
    {id:'b',name:'b',kind:'book',color:'#000',cells:[[0,0],[1,0],[2,0]]},
    {id:'c',name:'c',kind:'book',color:'#000',cells:[[0,0],[1,0],[2,0]]},
  ], solution: [{id:'a',x:3,y:0,rotation:1},{id:'b',x:0,y:0,rotation:0},{id:'c',x:0,y:1,rotation:0}] };
  const game = createGame(puzzle);
  assert.equal(place(game, 'a', 1, 0, 1), true);
  const before = snapshot(game);
  assert.equal(hint(game), null);
  assert.equal(snapshot(game), before);
});

test('daily selection is reproducible and changes at Singapore midnight', () => {
  const a = dailyPuzzle('2026-11-28'), b = dailyPuzzle(new Date('2026-11-28T15:59:59Z'));
  assert.deepEqual(a, b);
  assert.equal(a.id, 'daily-2026-11-28');
  const c = dailyPuzzle(new Date('2026-11-28T16:00:00Z'));
  assert.equal(c.id, 'daily-2026-11-29');
  assert.notDeepEqual(a, c);
  for (let day = 1; day <= 30; day++) verifySolution(dailyPuzzle(`2026-11-${String(day).padStart(2,'0')}`));
  assert.throws(() => dailyPuzzle('2026-02-30'), TypeError);
  assert.throws(() => dailyPuzzle(new Date('invalid')), TypeError);
});

test('external puzzles fail closed and source mutation cannot alter an active game', () => {
  const input = dominoes(), game = createGame(input);
  input.pieces[0].cells[0][0] = 99; input.blocked.push([0,0]);
  assert.equal(place(game, 'a', 0, 0, 0), true);
  for (const mutate of [p => p.cols = Infinity, p => p.rows = 0, p => p.pieces[0].cells = [], p => p.pieces[0].cells = [[0,0],[0,0]], p => p.pieces[0].cells = [[0,0],[2,0]], p => p.pieces[1].id = 'a', p => p.pieces[0].id = '__proto__', p => p.blocked = [[3,0]], p => p.solution[0].x = 9]) {
    const puzzle = dominoes(); mutate(puzzle);
    assert.throws(() => createGame(puzzle), TypeError);
  }
  assert.throws(() => createGame(null), TypeError);
  game.placements.a.x = -10;
  assert.equal(isComplete(game), false);
  assert.equal(hint(game), null);
  assert.equal(place(game, 'b', 0, 1, 0), false);
});
