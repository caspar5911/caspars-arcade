import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FINAL_FLOOR, MAX_ROLL_SPEED, MIN_ROLL_TIME, RULERS, TICK,
  aim, beginHold, cancelHold, createRun, finishHold, preview, step,
} from '../games/snap-ruler/public/engine.mjs';
import { checkpointFor, loadProgress } from '../games/snap-ruler/public/progress.mjs';

function ticks(run, count) {
  for (let index = 0; index < count; index++) step(run);
}

function advance(run, seconds) {
  ticks(run, Math.round(seconds / TICK));
}

function charge(run, heldTicks) {
  assert.equal(beginHold(run), true);
  ticks(run, heldTicks);
  return preview(run);
}

function fly(run) {
  assert.equal(finishHold(run), true);
  for (let tick = 0; tick < 300 && run.phase === 'flight'; tick++) step(run);
  return run;
}

test('the first ruler offers a steady single-floor shot and a two-floor skip', () => {
  const near = createRun();
  assert.equal(charge(near, 19).floor, 1);
  assert.equal(fly(near).floor, 1);

  const far = createRun();
  assert.equal(charge(far, 78).floor, 2);
  assert.equal(fly(far).floor, 2);
});

test('release farther along the same ruler adds horizontal speed', () => {
  const run = createRun();
  charge(run, 24);
  assert.ok(aim({ ...run, x: run.x + 45 }).vx > aim(run).vx + 25);
});

test('waiting without input keeps a starting or resumed shot available', () => {
  const run = createRun(975);
  const start = run.x;
  advance(run, 15);
  assert.equal(run.x, start);
  assert.equal(run.floor, 975);
  assert.equal(run.phase, 'ready');
});

test('a landing includes a reaction pause and a full roll window under the speed cap', () => {
  const run = createRun(973);
  const catchable = [...Array(48).keys()].map(n => n + 12).find(held => charge(createRun(973), held)?.floor === 974);
  charge(run, catchable);
  fly(run);
  assert.equal(run.phase, 'settling');
  advance(run, .20);
  assert.equal(run.phase, 'settling');
  while (run.phase === 'settling') step(run);
  assert.ok(run.rollSpeed <= MAX_ROLL_SPEED);
  assert.ok(Math.abs(RULERS[run.floor].tip - run.x) / run.rollSpeed >= MIN_ROLL_TIME - TICK);
  advance(run, MIN_ROLL_TIME - .02);
  assert.equal(run.phase, 'rolling');
});

test('a late release overshoots and rolling off the end remains a loss', () => {
  const overshot = createRun();
  beginHold(overshot);
  cancelHold(overshot);
  ticks(overshot, 212);
  assert.equal(charge(overshot, 28).reason, 'long');
  assert.equal(fly(overshot).reason, 'long');
  const rollOff = createRun();
  beginHold(rollOff);
  advance(rollOff, 6);
  assert.equal(rollOff.phase, 'lost');
  assert.equal(rollOff.reason, 'off-tip');
});

test('canceling a touch clears the charge without launching', () => {
  const run = createRun();
  charge(run, 54);
  cancelHold(run);
  assert.equal(finishHold(run), false);
  assert.equal(run.charge, 0);
  assert.equal(run.phase, 'rolling');
});

test('every floor has a forgiving single-floor release window and those windows vary', () => {
  assert.equal(FINAL_FLOOR, 1000);
  const safe = [];
  let minWindow = Infinity;
  for (let floor = 0; floor < FINAL_FLOOR; floor++) {
    let longest = [];
    let consecutive = [];
    const trial = createRun(floor);
    beginHold(trial);
    for (let held = 1; held <= 69; held++) {
      step(trial);
      if (held < 12) continue;
      const shot = preview(trial);
      if (shot.floor !== floor + 1) {
        consecutive = [];
        continue;
      }
      consecutive.push(held);
      if (consecutive.length > longest.length) longest = [...consecutive];
    }
    assert.ok(longest.length >= 19, 'No 150ms safe-shot window on floor ' + floor);
    safe.push(longest[Math.floor(longest.length / 2)]);
    minWindow = Math.min(minWindow, longest.at(-1) - longest[0]);
  }
  assert.ok(new Set(safe).size >= 4);
  assert.ok(minWindow * TICK >= .15 - Number.EPSILON);

  const run = createRun();
  for (let floor = 0; floor < FINAL_FLOOR; floor++) {
    while (run.phase === 'settling') step(run);
    const planned = charge(run, safe[floor]);
    fly(run);
    assert.equal(run.floor, floor + 1);
    assert.ok(Math.abs(run.x - planned.x) < .0001);
  }
  assert.equal(run.phase, 'won');
});

test('checkpoints preserve progress across a skipped floor and validate stored data', () => {
  assert.equal(checkpointFor(24), 0);
  assert.equal(checkpointFor(26), 25);
  assert.equal(checkpointFor(1000), 1000);
  assert.deepEqual(loadProgress('{"best":52,"checkpoint":50}', '10'), { best: 52, checkpoint: 50 });
  assert.deepEqual(loadProgress('{"best":52,"checkpoint":75}', '10'), { best: 52, checkpoint: 50 });
  assert.deepEqual(loadProgress('{"best":800,"checkpoint":0}', '10'), { best: 800, checkpoint: 0 });
  assert.deepEqual(loadProgress('bad-data', '10'), { best: 10, checkpoint: 0 });
  assert.deepEqual(loadProgress('{"best":1001,"checkpoint":1000}', '10'), { best: 10, checkpoint: 0 });
});

test('every available two-floor shortcut can be landed without an exact release tick', () => {
  for (let floor = 0; floor < FINAL_FLOOR - 1; floor++) {
    const run = createRun(floor);
    beginHold(run);
    let hits = 0;
    for (let held = 1; held <= 105; held++) {
      step(run);
      if (preview(run).floor === floor + 2) hits++;
    }
    assert.ok(hits >= 2, 'No reachable shortcut window on floor ' + floor);
  }
});

test('a short shot is diagnosed separately from an overshoot', () => {
  const run = createRun(6);
  assert.equal(charge(run, 12).reason, 'short');
  assert.equal(fly(run).reason, 'short');
});
