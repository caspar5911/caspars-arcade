import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WIDTH, EDGE, END, TICK, SMASH_SECONDS, FLOOD_START, FLOOD_GAP_MAX, FLOOD_MAX, MAX_SPEED,
  ceilingAt, createRun, difficulty, doubleWindows, floodRate, nextSeed, speedAt, step, tap,
} from '../games/ceiling-punch/public/engine.mjs';

function ticks(run, count) {
  for (let i = 0; i < count; i++) step(run);
}

/** Put a running robot at x, heading in a direction (as if it had run there). */
function placeAt(run, x, direction = 1) {
  if (run.phase === 'ready') tap(run);
  run.x = x;
  run.direction = direction;
  return run;
}

const middle = ([left, right]) => (left + right) / 2;

/** A plain crack above this floor that is not part of a gold spot. */
function plainCrackX(run) {
  const gold = doubleWindows(run.seed, run.floor);
  for (const span of ceilingAt(run.seed, run.floor)) {
    for (let x = span[0]; x <= span[1]; x++) {
      if (!gold.some(([a, b]) => x >= a && x <= b)) return x;
    }
  }
  return null;
}

/** A seed whose first ceiling has a gold spot. */
function seedWithGold() {
  for (let seed = 1; seed < 500; seed++) if (doubleWindows(seed, 0).length) return seed;
  throw new Error('no gold in 500 towers');
}

test('a new run is ready on floor 0 at the left wall, the flood below', () => {
  assert.deepEqual(createRun(7), {
    phase: 'ready', floor: 0, x: EDGE, direction: 1, elapsed: 0, impact: null,
    seed: 7, time: 0, flood: FLOOD_START, holes: [],
  });
  assert.equal(END, WIDTH - EDGE);
});

test('ceilings are endless, the same for a seed, sorted, apart, and away from the walls', () => {
  for (const seed of [1, 2, 99, 123456]) {
    for (let n = 0; n < 120; n++) {
      const spans = ceilingAt(seed, n);
      assert.ok(spans.length >= 1 && spans.length <= 3, `${seed}/${n}: 1 to 3 cracks`);
      for (const [i, [left, right]] of spans.entries()) {
        assert.ok(left < right, 'a crack has width');
        assert.ok(left >= 50 && right <= WIDTH - 50, 'away from the walls');
        if (i > 0) assert.ok(left - spans[i - 1][1] >= 34, 'cracks are apart');
      }
    }
  }
  // the same answer whichever order they're asked in (the cache never changes a tower)
  const late = ceilingAt(4242, 80);
  const early = ceilingAt(4242, 3);
  assert.deepEqual(ceilingAt(4242, 80), late);
  assert.deepEqual(ceilingAt(4242, 3), early);
  assert.notDeepEqual(ceilingAt(1, 10), ceilingAt(2, 10), 'different seeds, different towers');
});

test('it gets harder: narrower cracks and a faster robot, up to a limit', () => {
  const width = n => {
    let sum = 0, count = 0;
    for (let seed = 1; seed < 200; seed++) for (const [a, b] of ceilingAt(seed, n)) { sum += b - a; count++; }
    return sum / count;
  };
  assert.ok(width(0) > width(20) && width(20) > width(45));
  assert.ok(width(45) >= 22, 'still hittable at the top difficulty');
  assert.equal(difficulty(0), 0);
  assert.equal(difficulty(1000), 1);
  assert.ok(speedAt(0) < speedAt(10) && speedAt(10) < speedAt(30));
  assert.equal(speedAt(1000), MAX_SPEED);
});

test('gold spots are placed on purpose: about half the floors, never a thin sliver', () => {
  let floors = 0, gold = 0;
  for (let seed = 1; seed < 300; seed++) {
    for (let n = 0; n < 60; n++) {
      floors++;
      const windows = doubleWindows(seed, n);
      if (windows.length) gold++;
      assert.ok(windows.length <= 1, 'at most one gold spot');
      for (const [a, b] of windows) assert.ok(b - a >= 14, `${seed}/${n}: gold is at least 14 wide`);
    }
  }
  assert.ok(gold / floors > .35 && gold / floors < .65, `gold on ${Math.round(100 * gold / floors)}% of floors`);
});

test('the robot never stops: it bounces off the walls instead of losing', () => {
  const run = createRun(1);
  tap(run);
  run.flood = -1e9; // (no flood for this test)
  let bounces = 0;
  let direction = run.direction;
  for (let i = 0; i < 120 * 12; i++) {
    step(run);
    run.flood = -1e9;
    assert.equal(run.phase, 'running');
    assert.ok(run.x >= EDGE && run.x <= END);
    if (run.direction !== direction) {
      bounces++;
      direction = run.direction;
    }
  }
  assert.ok(bounces >= 4, `bounced ${bounces} times in 12 seconds`); // (about 2.3 s a crossing)
});

test('a punch through a crack climbs a floor and keeps running the same way, with no reset', () => {
  const run = placeAt(createRun(3), 0);
  const x = plainCrackX(run);
  run.x = x;
  run.direction = -1;
  assert.equal(tap(run), true);
  assert.equal(run.phase, 'smash');
  assert.equal(run.floor, 1);
  assert.deepEqual(run.impact, { x, from: 0, cleared: 1, reason: null });
  assert.equal(tap(run), false, 'mid-air taps are ignored');
  ticks(run, 2);
  assert.ok(run.x < x, 'still moving the same way during the smash');
  ticks(run, Math.ceil(SMASH_SECONDS / TICK));
  assert.equal(run.phase, 'running');
  assert.equal(run.direction, -1, 'no reset to a wall');
  assert.deepEqual(run.holes, [{ slab: 1, x }]);
});

test('a gold punch breaks two ceilings and sends the flood back', () => {
  const run = placeAt(createRun(seedWithGold()), 0);
  run.flood = -.2; // the flood right behind
  run.x = middle(doubleWindows(run.seed, 0)[0]);
  tap(run);
  assert.equal(run.floor, 2);
  assert.equal(run.impact.cleared, 2);
  assert.equal(run.flood, 2 - FLOOD_GAP_MAX);
  assert.equal(run.holes.length, 2);
});

test('solid concrete ends the run: early or late, by the nearest crack edge', () => {
  const run = placeAt(createRun(5), 0);
  const [left, right] = ceilingAt(5, 0)[0];
  placeAt(run, left - 3, 1);
  tap(run);
  assert.equal(run.phase, 'lost');
  assert.equal(run.impact.reason, 'early');
  const again = placeAt(createRun(5), right + 3, 1);
  tap(again);
  assert.equal(again.impact.reason, 'late');
  const back = placeAt(createRun(5), right + 3, -1);
  tap(back);
  assert.equal(back.impact.reason, 'early', 'running left, before the crack is to its right');
});

test('the flood rises faster and faster (up to a limit) and catches a robot that waits', () => {
  assert.ok(floodRate(0) < floodRate(30) && floodRate(30) <= FLOOD_MAX);
  assert.equal(floodRate(1e6), FLOOD_MAX);
  const run = createRun(1);
  tap(run);
  let seconds = 0;
  while (run.phase === 'running' && seconds < 30) {
    step(run);
    seconds += TICK;
  }
  assert.equal(run.phase, 'lost');
  assert.equal(run.impact.reason, 'flooded');
  assert.ok(seconds > 2 && seconds < 8, `caught after ${seconds.toFixed(1)} s of waiting`);
});

test('the flood is never far behind: climbing fast does not bank a huge lead', () => {
  const run = placeAt(createRun(1), 0);
  for (let floor = 0; floor < 20; floor++) {
    run.x = middle(ceilingAt(run.seed, run.floor)[0]);
    tap(run);
    while (run.phase === 'smash') step(run);
    assert.ok(run.floor - run.flood <= FLOOD_GAP_MAX + 1e-9);
    if (run.phase !== 'running') break;
  }
});

test('one tap starts; after a lost run one tap starts a new tower', () => {
  const run = createRun(11);
  assert.equal(tap(run), true);
  assert.equal(run.phase, 'running');
  assert.equal(run.seed, 11, 'the first run is the tower it was made with');
  placeAt(run, ceilingAt(11, 0)[0][0] - 3, 1);
  tap(run);
  assert.equal(run.phase, 'lost');
  assert.equal(tap(run), true);
  assert.equal(run.phase, 'running');
  assert.equal(run.floor, 0);
  assert.equal(run.seed, nextSeed(11));
  assert.equal(run.x, EDGE);
});
