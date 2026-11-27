import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CUP, DRINKS, LEVELS, clone, daily, dayKey, full, generate, level, levelDrinks, pour, pourCount, solve, solved, stars,
  topRun,
} from '../games/kopi-sort/public/engine.mjs';

test('pouring: onto the same drink or an empty tray, as many matching cups as fit', () => {
  const s = [[0, 1, 1], [2, 1], [], [0, 0, 0, 0]];
  assert.equal(topRun(s[0]), 2);
  assert.equal(pourCount(s, 0, 1), 2, 'two teh onto teh (room for two)');
  assert.equal(pourCount(s, 0, 2), 2, 'onto an empty tray');
  assert.equal(pourCount(s, 1, 3), 0, 'a full tray takes nothing');
  assert.equal(pourCount(s, 3, 0), 0, 'kopi onto teh: no');
  assert.equal(pourCount(s, 2, 0), 0, 'nothing to pour from an empty tray');
  assert.equal(pourCount(s, 0, 0), 0);
  assert.equal(pour(s, 0, 1), 2);
  assert.deepEqual(s, [[0], [2, 1, 1, 1], [], [0, 0, 0, 0]]);
  assert.ok(full([3, 3, 3, 3]) && !full([3, 3, 3]) && !full([3, 3, 3, 2]));
  assert.ok(solved([[1, 1, 1, 1], [], [0, 0, 0, 0]]));
  assert.ok(!solved([[1, 1, 1], [1], [0, 0, 0, 0]]));
});

test('every level: the same for everyone, solvable, mixed up, harder as you go', () => {
  let last = 0;
  for (let n = 1; n <= LEVELS; n++) {
    const a = level(n), b = level(n);
    assert.deepEqual(a.trays, b.trays, `level ${n} is the same every time`);
    const drinks = levelDrinks(n);
    assert.ok(drinks >= last && drinks <= DRINKS.length);
    last = drinks;
    assert.equal(a.trays.length, drinks + 2, 'two spare trays');
    assert.equal(a.trays.flat().length, drinks * CUP);
    for (let d = 0; d < drinks; d++) assert.equal(a.trays.flat().filter(x => x === d).length, CUP);
    assert.ok(!solved(a.trays), 'not already sorted');
    assert.ok(a.trays.every(t => topRun(t) < 3), 'not too easy');
    const s = clone(a.trays);
    for (const [x, y] of a.solution) assert.ok(pour(s, x, y) > 0, 'every move of the solution is allowed');
    assert.ok(solved(s), `level ${n}'s solution solves it`);
    assert.equal(a.par, a.solution.length);
  }
  assert.equal(levelDrinks(1), 3);
  assert.equal(levelDrinks(LEVELS), DRINKS.length);
});

test('the daily tray: the same all day (Singapore time), new each day, numbered', () => {
  assert.equal(dayKey(new Date('2026-11-28T15:59:00Z')), '2026-11-28'); // 23:59 in Singapore
  assert.equal(dayKey(new Date('2026-11-28T16:01:00Z')), '2026-11-29'); // 00:01 the next day
  const a = daily('2026-11-28'), b = daily('2026-11-28'), c = daily('2026-11-29');
  assert.deepEqual(a.trays, b.trays);
  assert.notDeepEqual(a.trays, c.trays);
  assert.equal(daily('2026-11-27').number, 1, 'the first daily tray is #1');
  assert.equal(a.number, 2);
  assert.equal(c.number, 3);
  assert.equal(a.trays.length, 8, 'six drinks and two spare trays');
  for (let i = 0; i < 20; i++) {
    const d = daily(dayKey(new Date(Date.UTC(2026, 11, 1 + i, 4))));
    const s = clone(d.trays);
    for (const [x, y] of d.solution) pour(s, x, y);
    assert.ok(solved(s));
  }
});

test('the solver finds a way, and par is close to the fewest moves possible', () => {
  const key = s => s.map(t => t.join('')).sort().join('|');
  function fewest(start) {
    let frontier = [clone(start)], seen = new Set([key(start)]), depth = 0;
    while (frontier.length) {
      depth++;
      const next = [];
      for (const s of frontier) {
        for (let a = 0; a < s.length; a++) {
          for (let b = 0; b < s.length; b++) {
            if (!pourCount(s, a, b)) continue;
            const n = clone(s);
            pour(n, a, b);
            if (solved(n)) return depth;
            const k = key(n);
            if (!seen.has(k)) {
              seen.add(k);
              next.push(n);
            }
          }
        }
      }
      frontier = next;
    }
    return null;
  }
  for (let n = 1; n <= 9; n++) {
    const l = level(n);
    const best = fewest(l.trays);
    assert.ok(l.par >= best && l.par <= best + 2, `level ${n}: par ${l.par}, fewest ${best}`);
  }
  assert.equal(solve([[0, 0, 0, 0], []]).length, 0);
  assert.throws(() => generate('x', 1), /No puzzle/); // (one drink is always already sorted)
});

test('stars: three at or under par, two a little over, one for solving', () => {
  assert.equal(stars(10, 12), 3);
  assert.equal(stars(12, 12), 3);
  assert.equal(stars(15, 12), 2);
  assert.equal(stars(16, 12), 1);
  assert.equal(stars(6, 6), 3);
  assert.equal(stars(8, 6), 2);
  assert.equal(stars(9, 6), 1);
});
