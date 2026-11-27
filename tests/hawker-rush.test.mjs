import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TICK, SEATS, QUEUE_MAX, DAYS, SHIFT, SPEED_CUSTOMERS, PREP, BURNT_COST, WASTE_COST,
  DISHES, INGREDIENTS, STATIONS, UPGRADES, DECOR, menuFor, newOn, kitchenFor, schedule,
  goals, starsFor, createShift, dishOf, couldBe, placeBase, addIngredient, cook, binBurnt,
  binDish, serve, servingFor, step, progress, speedTime, act, replay, daily, dayKey, speedRun, upgradeCost,
} from '../games/hawker-rush/public/engine.mjs';

function advance(s, seconds) {
  for (let i = 0; i < Math.ceil(seconds / TICK); i++) step(s);
}
function customers(orders, options = {}) {
  const s = createShift({ day: 9, seed: 'test', ...options });
  s.arrivals = orders.map((order, id) => ({ id, at: 0, who: 'uncle', order, patience: 60 - id * 5 }));
  s.next = 0;
  step(s);
  return s;
}
function build(s, dish) {
  const recipe = DISHES[dish];
  const target = s.prep.indexOf(null);
  assert.equal(placeBase(s, recipe.base, target), true);
  for (const ingredient of recipe.has) {
    const station = INGREDIENTS[ingredient].cooked;
    if (station) {
      assert.equal(cook(s, station), true);
      advance(s, STATIONS[station].cook + .2);
    }
    assert.equal(addIngredient(s, ingredient, target), true);
  }
  return target;
}

test('menu and kitchen unlock the recipes over fifteen days', () => {
  assert.deepEqual(menuFor(1), ['kopi']);
  assert.deepEqual(newOn(2), ['kopiO', 'toast']);
  assert.deepEqual(newOn(15), []);
  assert.deepEqual(kitchenFor(1), { bases: ['cup'], ingredients: ['kopi', 'milk'], stations: [] });
  assert.deepEqual(new Set(menuFor(DAYS)), new Set(Object.keys(DISHES)));
  for (const [id, dish] of Object.entries(DISHES)) {
    assert.ok(menuFor(dish.day).includes(id));
    for (const ing of dish.has) assert.equal(INGREDIENTS[ing].base, dish.base);
  }
});

test('seeded schedules are reproducible, bounded and use available dishes', () => {
  const spec = { day: 9, seed: 'a' };
  assert.deepEqual(schedule(spec), schedule(spec));
  assert.notDeepEqual(schedule(spec), schedule({ ...spec, seed: 'b' }));
  const people = schedule(spec);
  assert.ok(people.every(p => p.at >= 0 && p.at < SHIFT && p.order.every(d => menuFor(9).includes(d))));
  assert.ok(schedule({ day: 1 }).every(p => p.order.length === 1 && p.order[0] === 'kopi'));
  const targets = goals(people);
  assert.ok(targets[0] < targets[1] && targets[1] < targets[2]);
  assert.equal(starsFor(targets[1], targets), 2);
});

test('every recipe matches exactly in either order; extra and missing ingredients do not', () => {
  for (const [id, recipe] of Object.entries(DISHES)) {
    assert.equal(dishOf({ base: recipe.base, has: [...recipe.has].reverse() }), id);
    assert.notEqual(dishOf({ base: recipe.base, has: recipe.has.slice(0, -1) }), id);
    assert.notEqual(dishOf({ base: recipe.base, has: [...recipe.has, recipe.has[0]] }), id);
    assert.ok(couldBe({ base: recipe.base, has: recipe.has.slice(0, 1) }).includes(id));
  }
  assert.equal(dishOf(null), null);
});

test('each recipe can be assembled through actual kitchen actions', () => {
  for (const id of Object.keys(DISHES)) {
    const s = customers([[id]]);
    const spot = build(s, id);
    assert.equal(dishOf(s.prep[spot]), id);
    assert.equal(serve(s, spot, 0), true);
    assert.equal(s.served, 1);
  }
});

test('wrong base, duplicate and impossible ingredients do not consume cooked food', () => {
  const s = customers([['toast']]);
  assert.equal(placeBase(s, 'cup', 0), true);
  assert.equal(addIngredient(s, 'kaya', 0), false);
  assert.equal(addIngredient(s, 'kopi', 0), true);
  assert.equal(addIngredient(s, 'kopi', 0), false);
  assert.equal(addIngredient(s, 'teh', 0), false);
  assert.equal(cook(s, 'toaster'), true);
  advance(s, STATIONS.toaster.cook + .2);
  assert.equal(addIngredient(s, 'toast', 0), false);
  assert.equal(s.stations.toaster.slots[0].state, 'ready');
  assert.equal(placeBase(s, 'plate', 1), true);
  assert.equal(addIngredient(s, 'toast', 1), true);
  assert.equal(s.stations.toaster.slots[0], null);
});

test('cooking, burning, binning, timing and capacity upgrades', () => {
  const s = customers([['toast']], { upgrades: { fast: 1, timer: 1, slots: 1, prep: 1 } });
  assert.equal(s.prep.length, PREP + 1);
  assert.equal(s.stations.toaster.slots.length, STATIONS.toaster.slots + 1);
  assert.equal(cook(s, 'toaster'), true);
  advance(s, STATIONS.toaster.cook * .85 + .1);
  const item = s.stations.toaster.slots[0];
  assert.equal(item.state, 'ready');
  assert.ok(progress(s, 'toaster', item) < .1);
  advance(s, STATIONS.toaster.burn + .2);
  assert.equal(item.state, 'ready');
  advance(s, 2);
  assert.equal(item.state, 'burnt');
  assert.equal(s.burnt, 1);
  s.coins = 5;
  assert.equal(binBurnt(s, 'toaster'), true);
  assert.equal(s.coins, 5 - BURNT_COST);
  assert.equal(binBurnt(s, 'toaster'), false);
  assert.equal(placeBase(s, 'plate'), true);
  assert.equal(binDish(s, 0), true);
  assert.equal(s.coins, 5 - BURNT_COST - WASTE_COST);
  assert.equal(s.wasted, 1);
});

test('explicit serving respects the chosen customer; automatic serving picks the most urgent', () => {
  const s = customers([['kopi', 'kopi'], ['kopi'], ['toast']]);
  assert.equal(servingFor(s, 'kopi'), 1);
  let spot = build(s, 'kopi');
  assert.equal(serve(s, spot, 2), false);
  assert.equal(serve(s, spot), true);
  assert.equal(s.served, 1);
  assert.equal(s.combo, 1);
  assert.ok(s.coins > DISHES.kopi.price);
  spot = build(s, 'kopi');
  assert.equal(serve(s, spot, 0), true);
  assert.equal(s.served, 1);
  spot = build(s, 'kopi');
  assert.equal(serve(s, spot, 0), true);
  assert.equal(s.served, 2);
  assert.equal(s.dishes, 3);
  assert.equal(s.combo, 2);
});

test('customers time out, queues are bounded, and day shifts close on time', () => {
  const s = customers(Array.from({ length: SEATS + QUEUE_MAX + 2 }, () => ['kopi']));
  assert.equal(s.queue.length, QUEUE_MAX);
  assert.equal(s.passed, 2);
  s.combo = 4;
  advance(s, 61);
  assert.ok(s.lost > 0);
  assert.equal(s.combo, 0);
  advance(s, SHIFT);
  assert.equal(s.phase, 'over');
  assert.equal(placeBase(s, 'cup'), false);
});

test('action logs replay a whole shift exactly and respect a tick limit', () => {
  const spec = { day: 1, seed: 'replay' };
  const live = createShift(spec);
  const actions = [];
  const perform = (kind, a, b = -1) => {
    actions.push([live.ticks, kind, a, b]);
    act(live, kind, a, b);
  };
  while (live.phase === 'running') {
    if (live.seats.some(c => c && !c.leaving) && live.prep.every(x => !x)) {
      perform('base', 'cup');
      perform('add', 'kopi');
      perform('add', 'milk');
      perform('serve', 0);
    }
    step(live);
    live.events.length = 0;
  }
  assert.ok(live.served > 0);
  assert.deepEqual(replay(spec, actions), live);
  assert.equal(replay(spec, actions, 100).ticks, 100);
});

test('speed run has a weekly seed, all dishes, 15 customers and loss penalties', () => {
  const a = speedRun(new Date('2026-11-27T12:00:00Z'));
  const b = speedRun(new Date('2026-11-29T12:00:00Z'));
  const c = speedRun(new Date('2026-11-30T00:00:00Z'));
  assert.equal(a.key, b.key);
  assert.notEqual(a.key, c.key);
  const s = createShift(a.spec);
  assert.equal(s.arrivals.length, SPEED_CUSTOMERS);
  assert.deepEqual(new Set(s.kitchen.stations), new Set(Object.keys(STATIONS)));
  while (s.phase === 'running') step(s);
  assert.equal(s.lost, SPEED_CUSTOMERS);
  assert.equal(s.passed, 0);
  assert.equal(speedTime(s), Math.round((s.t + 10 * SPEED_CUSTOMERS) * 100) / 100);
});

test('daily uses Singapore dates and standard stall; shop prices increase and cap', () => {
  assert.equal(dayKey(new Date('2026-11-27T15:59:00Z')), '2026-11-27');
  assert.equal(dayKey(new Date('2026-11-27T16:00:00Z')), '2026-11-28');
  const d = daily('2026-11-28');
  assert.equal(d.number, 2);
  assert.deepEqual(d.spec.upgrades, {});
  assert.deepEqual(schedule(d.spec), schedule(daily('2026-11-28').spec));
  for (const [id, upgrade] of Object.entries(UPGRADES)) {
    assert.ok(upgrade.costs.every((cost, i) => i === 0 || cost > upgrade.costs[i - 1]));
    assert.equal(upgradeCost(id, upgrade.costs.length), null);
  }
  assert.ok(Object.values(DECOR).every(d => d.cost > 0));
});

test('the leaderboard server replays with this exact copy of the rules', async () => {
  // The Hawker Haggle server keeps a copy at server/hh/hawker_rush_rules/engine.mjs to check saved runs.
  // If you change engine.mjs: copy it there too (and raise ENGINE in competition.mjs and hawker_rush.py if old runs
  // would replay differently), then update this fingerprint.
  const { createHash } = await import('node:crypto');
  const { readFile } = await import('node:fs/promises');
  const text = await readFile(new URL('../games/hawker-rush/public/engine.mjs', import.meta.url));
  assert.equal(createHash('sha256').update(text).digest('hex'), '3b6ba5240c4dcc949f13e370105cc504e472e252cceb9dd640539698fabcfd2e');
});
