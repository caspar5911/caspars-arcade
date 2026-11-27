import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TICK, aim, beginHold, cancelHold, createRun, finishHold, step,
} from '../games/snap-ruler/public/engine.mjs';

function advance(run, seconds) {
  for (let n = 0; n < Math.round(seconds / TICK); n++) step(run);
}

function shoot(run, hold) {
  assert.equal(beginHold(run), true);
  advance(run, hold);
  assert.equal(finishHold(run), true);
  for (let n = 0; n < 240 && run.phase === 'flight'; n++) step(run);
  return run;
}

test('the first ruler has both a steady one-floor shot and a deliberate two-floor shot', () => {
  const near = shoot(createRun(), .16);
  const far = shoot(createRun(), .65);
  assert.equal(near.phase, 'rolling');
  assert.equal(near.floor, 1);
  assert.equal(far.phase, 'rolling');
  assert.equal(far.floor, 2);
});

test('release farther along the same ruler adds horizontal speed', () => {
  const run = createRun();
  beginHold(run);
  advance(run, .2);
  const early = aim(run);
  const later = aim({ ...run, x: run.x + 45 });
  assert.ok(later.vx > early.vx + 25);
});

test('waiting without input keeps the opening shot available', () => {
  const run = createRun();
  const start = run.x;
  advance(run, 15);
  assert.equal(run.x, start);
  assert.equal(run.phase, 'ready');
});

test('letting the marble roll off a ruler or missing a landing ends a run', () => {
  const rollOff = createRun();
  beginHold(rollOff);
  advance(rollOff, 6);
  assert.equal(rollOff.phase, 'lost');
  assert.equal(rollOff.reason, 'off-tip');
  const missed = createRun();
  beginHold(missed);
  advance(missed, 1.9);
  finishHold(missed);
  advance(missed, 3);
  assert.equal(missed.phase, 'lost');
  assert.equal(missed.reason, 'missed');
});

test('changing tabs or canceling a touch clears the charge without launching', () => {
  const run = createRun();
  beginHold(run);
  advance(run, .45);
  cancelHold(run);
  assert.equal(finishHold(run), false);
  assert.equal(run.charge, 0);
  assert.equal(run.phase, 'rolling');
});

test('a player can clear all ten floors one at a time', () => {
  const run = createRun();
  const shots = [
    [0, 42], [0, 12], [48, 48], [0, 12], [12, 54],
    [0, 12], [48, 54], [0, 12], [12, 54], [0, 12],
  ];
  for (let floor = 0; floor < shots.length; floor++) {
    const [waitTicks, heldTicks] = shots[floor];
    advance(run, waitTicks * TICK);
    shoot(run, heldTicks * TICK);
    assert.equal(run.floor, floor + 1);
  }
  assert.equal(run.phase, 'won');
});

test('releasing at maximum power on both opening rulers loses', () => {
  const run = shoot(createRun(), .7);
  assert.equal(run.floor, 2);
  shoot(run, .7);
  assert.equal(run.phase, 'lost');
  assert.equal(run.floor, 2);
});
