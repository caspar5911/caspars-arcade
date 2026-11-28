import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TICK, SEATS, QUEUE_MAX, DAYS, SHIFT, SPEED_CUSTOMERS, PREP, BURNT_COST, WASTE_COST,
  DISHES, INGREDIENTS, STATIONS, UPGRADES, DECOR, menuFor, newOn, kitchenFor, schedule,
  goals, starsFor, createShift, dishOf, couldBe, placeBase, addIngredient, cook, binBurnt,
  binDish, serve, servingFor, step, progress, speedTime, act, replay, daily, dayKey, speedRun, upgradeCost,
  WAVES, WALK_IN, EARLY_BONUS, seatsFor, prepFor, readyToCook, cookDish, flip, takeOut,
} from '../games/hawker-rush/public/engine.mjs';

function advance(s, seconds) {
  for (let i = 0; i < Math.ceil(seconds / TICK); i++) step(s);
}
function customers(orders, options = {}) {
  const s = createShift({ day: DAYS, seed: 'test', ...options });
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
  if (recipe.cook) {
    // built: into the wok / onto the griddle (flip it halfway), then back onto the counter
    assert.equal(readyToCook(s.prep[target]), dish);
    assert.equal(cookDish(s, target), true);
    advance(s, STATIONS[recipe.cook].cook / (STATIONS[recipe.cook].flip ? 2 : 1) + .2);
    if (STATIONS[recipe.cook].flip) {
      assert.equal(flip(s, recipe.cook), true);
      advance(s, STATIONS[recipe.cook].cook / 2 + .2);
    }
    assert.equal(takeOut(s, recipe.cook, target), true);
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
    const cooked = Boolean(recipe.cook);
    assert.equal(dishOf({ base: recipe.base, has: [...recipe.has].reverse(), cooked }), id);
    if (recipe.has.length) assert.notEqual(dishOf({ base: recipe.base, has: recipe.has.slice(0, -1), cooked }), id);
    if (recipe.has.length) assert.notEqual(dishOf({ base: recipe.base, has: [...recipe.has, recipe.has[0]], cooked }), id);
    assert.ok(couldBe({ base: recipe.base, has: recipe.has.slice(0, 1) }).includes(id));
    // a dish cooked whole isn't finished until it's cooked (and nothing goes into it after)
    if (cooked) {
      assert.equal(dishOf({ base: recipe.base, has: recipe.has }), null);
      assert.equal(readyToCook({ base: recipe.base, has: [...recipe.has].reverse() }), id);
    }
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

test('the wok and the griddle cook a built dish whole; prata must be flipped or it burns', () => {
  const s = customers([['curryPuff', 'prata']]);
  // the wok: not until it's built, then in it goes, and out it comes golden
  assert.equal(placeBase(s, 'pastry', 0), true);
  assert.equal(addIngredient(s, 'potato', 0), true);
  assert.equal(cookDish(s, 0), false, 'not built yet');
  assert.equal(addIngredient(s, 'curry', 0), true);
  assert.equal(cook(s, 'wok'), false, 'the wok cooks built dishes only');
  assert.equal(cookDish(s, 0), true);
  assert.equal(s.prep[0], null);
  assert.equal(takeOut(s, 'wok'), false, 'still frying');
  advance(s, STATIONS.wok.cook + .1);
  assert.equal(takeOut(s, 'wok', 1), true);
  assert.equal(dishOf(s.prep[1]), 'curryPuff');
  assert.equal(addIngredient(s, 'curry', 1), false, 'nothing goes into a cooked dish');
  // the griddle: halfway it waits to be flipped; left too long, it burns
  assert.equal(placeBase(s, 'dough', 0), true);
  assert.equal(cookDish(s, 0), true);
  advance(s, STATIONS.griddle.cook / 2 + .1);
  assert.equal(s.stations.griddle.slots[0].state, 'flip');
  assert.equal(takeOut(s, 'griddle'), false, 'flip it first');
  advance(s, STATIONS.griddle.burn + .1);
  assert.equal(s.stations.griddle.slots[0].state, 'burnt');
  assert.equal(flip(s, 'griddle'), false);
  assert.equal(act(s, 'bin-burnt', 'griddle'), true);
  assert.equal(act(s, 'flip', 'griddle'), false);
});

test('a shift comes in waves: busier in the lunch and dinner rushes, someone waiting at opening', () => {
  for (const day of [5, 8, 12]) {
    const people = schedule({ day, seed: 'waves' });
    const inWave = name => {
      const k = WAVES.findIndex(w => w[2] === name);
      return people.filter(p => p.at >= WAVES[k][0] && p.at < WAVES[k + 1][0]).length / (WAVES[k + 1][0] - WAVES[k][0]);
    };
    assert.equal(people[0].at, 1.5);
    assert.ok(inWave('lunch') > 1.8 * inWave('breather'), `day ${day}: the lunch rush is busier`);
    assert.ok(inWave('dinner') > 1.5 * inWave('open'), `day ${day}: the dinner rush is busier`);
    assert.ok(people.every((p, i) => i === 0 || p.at >= people[i - 1].at), 'in arrival order');
    assert.ok(people.every(p => p.at <= SHIFT - 20));
  }
  const s = createShift({ day: 8, seed: 'waves' });
  const waves = [];
  while (s.phase === 'running') {
    step(s);
    for (const e of s.events) if (e.type === 'wave') waves.push(e.wave);
    s.events.length = 0;
  }
  assert.deepEqual(waves, ['lunch', 'breather', 'dinner', 'closing']);
});

test('a free seat fills by itself: the next customer due soon walks straight in (not in a speed run)', () => {
  const s = createShift({ day: 3, seed: 'walk-in' });
  step(s);
  // at opening every seat is free: everyone due within WALK_IN seconds sits down at once
  const due = s.arrivals.filter(p => p.at <= s.t + WALK_IN).length;
  assert.equal(s.seats.filter(Boolean).length, Math.min(s.seats.length, due));
  // serve someone: their seat soon takes the next customer due, well before their timetable says
  const c = s.seats.findIndex(Boolean);
  for (const d of s.seats[c].order) {
    act(s, 'base', DISHES[d].base, -1);
    for (const i of DISHES[d].has) if (!INGREDIENTS[i].cooked) act(s, 'add', i, -1);
    if (DISHES[d].has.some(i => INGREDIENTS[i].cooked)) {
      for (const i of DISHES[d].has.filter(x => INGREDIENTS[x].cooked)) {
        act(s, 'cook', INGREDIENTS[i].cooked);
        advance(s, 4.5);
        act(s, 'add', i, -1);
      }
    }
    act(s, 'serve', s.prep.findIndex(x => dishOf(x) === d), c);
  }
  const next = s.arrivals[s.next];
  advance(s, 1.5);
  if (next.at > s.t + WALK_IN) assert.equal(s.next, s.arrivals.indexOf(next), 'not called in too early');
  else assert.ok(s.seats.some(x => x && x.id === next.id), 'walked in early');
  assert.equal(act(s, 'call', 0), false, 'no bell');
  // a speed run keeps its fixed line
  const speed = createShift(speedRun(new Date('2026-11-30T12:00:00Z')).spec);
  step(speed);
  assert.equal(speed.seats.filter(Boolean).length, speed.arrivals.filter(p => p.at <= speed.t).length);
});

test('serving everyone closes the stall early, with a bonus for the time left (less if some left unhappy)', () => {
  const s = createShift({ day: 1, seed: 'early' });
  for (let guard = 0; s.phase === 'running' && guard < 20000; guard++) {
    const c = s.seats.findIndex(x => x && !x.leaving);
    if (c >= 0 && !s.prep.some(Boolean)) {
      for (const d of s.seats[c].order) {
        act(s, 'base', DISHES[d].base, -1);
        for (const i of DISHES[d].has) act(s, 'add', i, -1);
        act(s, 'serve', s.prep.findIndex(Boolean), c);
      }
    }
    step(s);
  }
  assert.equal(s.phase, 'over');
  assert.equal(s.lost + s.passed, 0);
  assert.ok(s.early > 10, `closed ${s.early} s early`);
  assert.equal(s.earlyBonus, Math.round(s.early * EARLY_BONUS * 100) / 100);
  assert.ok(s.events.some(e => e.type === 'closed-early'));
  // nobody served: no bonus, whenever it ends
  const idle = createShift({ day: 1, seed: 'early' });
  while (idle.phase === 'running') step(idle);
  assert.equal(idle.coins, 0);
});

test('co-op stalls get more customers, seats and counter spots', () => {
  assert.deepEqual([1, 2, 3, 4].map(seatsFor), [4, 5, 5, 6]);
  assert.deepEqual([1, 2, 3, 4].map(n => prepFor(n)), [3, 5, 6, 6]);
  const solo = schedule({ day: 6, seed: 'team' }).length;
  assert.ok(schedule({ day: 6, seed: 'team', players: 2 }).length > 1.4 * solo);
  const s = createShift({ day: 6, seed: 'team', players: 2 });
  assert.equal(s.players, 2);
  assert.equal(s.seats.length, 5);
  assert.equal(s.prep.length, 5);
  assert.equal(createShift({ day: 6, players: 9 }).players, 1, 'out-of-range teams play solo');
});

test('the leaderboard server replays with this exact copy of the rules', async () => {
  // The Hawker Haggle server keeps a copy at server/hh/hawker_rush_rules/engine.mjs to check saved runs.
  // If you change engine.mjs: copy it there too (and raise ENGINE in competition.mjs and hawker_rush.py if old runs
  // would replay differently), then update this fingerprint.
  const { createHash } = await import('node:crypto');
  const { readFile } = await import('node:fs/promises');
  const text = await readFile(new URL('../games/hawker-rush/public/engine.mjs', import.meta.url));
  assert.equal(createHash('sha256').update(text).digest('hex'), 'abbdfa9f95395246df03d90221559209fdac5e9e4abf4f9f950645a0d7563fd3');
});

test('a phone showing an old copy moves to a newer release (and only a newer one)', async () => {
  const { newerBuild, updateUrl } = await import('../games/hawker-rush/public/updates.mjs');
  assert.equal(newerBuild('104', { build: 107 }), 107);
  assert.equal(newerBuild('107', { build: 107 }), null);
  assert.equal(newerBuild('108', { build: 107 }), null);
  assert.equal(newerBuild('development', { build: 107 }), null); // (a local copy never reloads)
  assert.equal(newerBuild('104', {}), null);
  assert.equal(updateUrl('https://x.test/games/hawker-rush/?room=ABCDE', 107), 'https://x.test/games/hawker-rush/?room=ABCDE&v=107');
});

test('helping friends clear a day saves it; the next day opens once every day before it is cleared', async () => {
  const { clearDay, canPlay } = await import('../games/hawker-rush/public/progress.mjs');
  const save = { day: 2, best: { 1: 3 } };
  assert.equal(clearDay(save, 8, 2), null); // (with friends, ahead of my own progress)
  assert.equal(save.best[8], 2);
  assert.equal(save.day, 2);
  assert.ok(canPlay(save, 8) && !canPlay(save, 9) && !canPlay(save, 5));
  for (const day of [2, 3, 4, 5, 6]) clearDay(save, day, 1);
  assert.equal(save.day, 7);
  assert.equal(clearDay(save, 7, 3), 9); // (clearing day 7 skips the day 8 already cleared)
  assert.ok(canPlay(save, 9) && !canPlay(save, 10));
  assert.equal(clearDay(save, 8, 1), null); // (a worse go keeps the best stars)
  assert.equal(save.best[8], 2);
  assert.equal(clearDay(save, 9, 0), null); // (no stars: not cleared)
  assert.equal(save.day, 9);
});
