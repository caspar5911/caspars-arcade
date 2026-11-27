import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WIDTH, EDGE, SPEED, TICK, TOP_FLOOR, SMASH_SECONDS, CEILINGS,
  createRun, doubleWindows, step, tap,
} from '../games/ceiling-punch/public/engine.mjs';

const END = WIDTH - EDGE;

function ticks(run, count) {
  for (let i = 0; i < count; i++) step(run);
}

function startAt(run, x) {
  tap(run);
  run.x = x;
  return run;
}

function finishSmash(run) {
  while (run.phase === 'smash') step(run);
}

test('exports the fixed board and creates a ready run', () => {
  assert.equal(WIDTH, 416);
  assert.equal(EDGE, 32);
  assert.equal(SPEED, 152);
  assert.equal(TICK, 1 / 120);
  assert.equal(TOP_FLOOR, 6);
  assert.equal(SMASH_SECONDS, .22);
  assert.deepEqual(CEILINGS, [
    [[96, 157], [244, 302]],
    [[180, 213], [262, 322]],
    [[161, 220], [324, 354]],
    [[123, 151], [315, 372]],
    [[112, 167], [275, 312]],
    [[75, 104], [286, 344]],
  ]);
  assert.deepEqual(createRun(), {
    phase: 'ready', floor: 0, x: EDGE, direction: 1, elapsed: 0, impact: null,
  });
});

test('doubleWindows returns sorted inclusive intersections of upcoming ceilings', () => {
  assert.deepEqual(doubleWindows(0), [[262, 302]]);
  assert.deepEqual(doubleWindows(1), [[180, 213]]);
  assert.deepEqual(doubleWindows(2), [[324, 354]]);
  assert.deepEqual(doubleWindows(3), [[123, 151]]);
  assert.deepEqual(doubleWindows(4), [[286, 312]]);
  assert.deepEqual(doubleWindows(5), []);
  assert.deepEqual(doubleWindows(6), []);
});

test('a tap on either inclusive crack boundary starts a one-floor smash', () => {
  const run = startAt(createRun(), 96);
  assert.equal(tap(run), true);
  assert.equal(run.phase, 'smash');
  assert.equal(run.floor, 1);
  assert.deepEqual(run.impact, { x: 96, from: 0, cleared: 1, reason: null });
  assert.equal(tap(run), false);
  finishSmash(run);
  assert.equal(run.phase, 'running');
  assert.equal(run.floor, 1);
  assert.equal(run.x, END);
  assert.equal(run.direction, -1);
});

test('a crack shared by adjacent ceilings clears two floors and preserves strike x during smash', () => {
  const run = startAt(createRun(), 262);
  assert.equal(tap(run), true);
  assert.equal(run.phase, 'smash');
  assert.equal(run.floor, 2);
  assert.equal(run.x, 262);
  assert.deepEqual(run.impact, { x: 262, from: 0, cleared: 2, reason: null });
  ticks(run, Math.ceil(SMASH_SECONDS / TICK) - 1);
  assert.equal(run.phase, 'smash');
  assert.equal(run.x, 262);
  finishSmash(run);
  assert.equal(run.phase, 'running');
  assert.equal(run.x, EDGE);
  assert.equal(run.direction, 1);
});

test('a miss is classified early or late against the next directional crack boundary', () => {
  const early = startAt(createRun(), 95);
  assert.equal(tap(early), true);
  assert.deepEqual(early.impact, { x: 95, from: 0, cleared: 0, reason: 'early' });
  assert.equal(early.phase, 'lost');

  const late = startAt(createRun(), 158);
  assert.equal(tap(late), true);
  assert.deepEqual(late.impact, { x: 158, from: 0, cleared: 0, reason: 'late' });

  const reverse = createRun();
  tap(reverse);
  reverse.floor = 1;
  reverse.x = 214;
  reverse.direction = -1;
  assert.equal(tap(reverse), true);
  assert.deepEqual(reverse.impact, { x: 214, from: 1, cleared: 0, reason: 'early' });
});

test('running movement uses fixed ticks and passing the end loses with a passed impact', () => {
  const run = createRun();
  tap(run);
  step(run);
  assert.equal(run.x, EDGE + SPEED * TICK);
  ticks(run, Math.ceil((END - run.x) / (SPEED * TICK)) + 1);
  assert.equal(run.phase, 'lost');
  assert.equal(run.impact.reason, 'passed');
  assert.equal(run.impact.cleared, 0);
});

test('a terminal run retries immediately from floor zero', () => {
  const lost = startAt(createRun(), 95);
  tap(lost);
  assert.equal(lost.phase, 'lost');
  assert.equal(tap(lost), true);
  assert.deepEqual(lost, {
    phase: 'running', floor: 0, x: EDGE, direction: 1, elapsed: 0, impact: null,
  });

  const won = createRun();
  won.phase = 'won';
  won.floor = TOP_FLOOR;
  won.x = END;
  assert.equal(tap(won), true);
  assert.deepEqual(won, {
    phase: 'running', floor: 0, x: EDGE, direction: 1, elapsed: 0, impact: null,
  });
});

test('floor six is capped and a successful final hit enters won after the smash', () => {
  const run = createRun();
  tap(run);
  run.floor = 5;
  run.x = 286;
  run.direction = -1;
  assert.equal(tap(run), true);
  assert.equal(run.floor, TOP_FLOOR);
  assert.equal(run.phase, 'smash');
  finishSmash(run);
  assert.equal(run.phase, 'won');
  assert.equal(run.floor, TOP_FLOOR);
});

test('a complete single-floor route reaches floor six', () => {
  const route = [96, 262, 161, 315, 112, 286];
  const run = createRun();
  tap(run);
  for (const x of route) {
    run.x = x;
    assert.equal(tap(run), true);
    assert.equal(run.impact.cleared, 1);
    finishSmash(run);
    if (run.floor < TOP_FLOOR) assert.equal(run.phase, 'running');
  }
  assert.equal(run.floor, TOP_FLOOR);
  assert.equal(run.phase, 'won');
});

test('every available double-smash overlap clears exactly two floors', () => {
  for (let floor = 0; floor < TOP_FLOOR - 1; floor++) {
    const [window] = doubleWindows(floor);
    const run = createRun();
    tap(run);
    run.floor = floor;
    run.x = window[0];
    run.direction = floor % 2 === 0 ? 1 : -1;
    assert.equal(tap(run), true);
    assert.equal(run.impact.cleared, 2);
    assert.equal(run.floor, floor + 2);
  }
});
