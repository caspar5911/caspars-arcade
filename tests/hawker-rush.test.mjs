import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BURNT_COST, DAYS, DECOR, DISHES, SEATS, SHIFT, STATIONS, TICK, UPGRADES, cook, createShift, daily, dayKey, goals,
  menuFor, newDishOn, progress, replay, schedule, servingFor, starsFor, step, tapSlot, tapStation, upgradeCost,
} from '../games/hawker-rush/public/engine.mjs';

const seconds = (shift, s) => {
  for (let i = 0; i < Math.round(s / TICK); i++) step(shift);
};

/** A shift with one customer (who orders `order`) sitting at the first seat, and nobody else coming. */
function withCustomer(order, { day = 9, upgrades = {} } = {}) {
  const s = createShift({ day, seed: 'test', upgrades });
  s.arrivals = [{ id: 0, at: 0, who: 'uncle', emoji: '👴', order, patience: 30 }];
  s.next = 0;
  step(s);
  return s;
}

test('the menu grows day by day, a new dish is introduced on its day, every dish has a station', () => {
  assert.deepEqual(menuFor(1), ['kopi']);
  assert.deepEqual(menuFor(2), ['kopi', 'toast']);
  assert.equal(menuFor(9).length, Object.keys(DISHES).length);
  assert.equal(newDishOn(7), 'rice');
  assert.equal(newDishOn(8), null);
  for (const d of Object.keys(DISHES)) assert.equal(STATIONS[d].dish, d);
});

test('a shift is the same for the same seed, different for another, and busier on later days', () => {
  assert.deepEqual(schedule(5, 'a'), schedule(5, 'a'));
  assert.notDeepEqual(schedule(5, 'a'), schedule(5, 'b'));
  assert.ok(schedule(12, 'x').length > schedule(3, 'x').length);
  for (const p of schedule(12, 'x')) {
    assert.ok(p.order.every(d => menuFor(12).includes(d)), 'only what is on the menu');
    assert.ok(p.at >= 0 && p.at <= 76);
  }
  assert.ok(schedule(1, 'x').every(p => p.order.length === 1), 'day 1: one kopi each');
  const [one, two, three] = goals(schedule(8, 'y'));
  assert.ok(one < two && two < three);
});

test('cooking takes time; ready food is served to whoever needs it most, and paying adds tips and combos', () => {
  const s = withCustomer(['kopi', 'kopi']);
  assert.equal(cook(s, 'kopi'), true);
  assert.equal(cook(s, 'kopi'), true);
  assert.equal(cook(s, 'kopi'), false, 'the machine has two slots');
  assert.equal(s.stations.kopi.slots[0].state, 'cooking');
  assert.equal(tapSlot(s, 'kopi', 0), false, 'not ready yet');
  seconds(s, STATIONS.kopi.cook + .1);
  assert.equal(s.stations.kopi.slots[0].state, 'ready');
  assert.equal(tapSlot(s, 'kopi', 0), true);
  assert.equal(s.seats[0].got.filter(Boolean).length, 1);
  assert.equal(tapSlot(s, 'kopi', 1), true);
  assert.equal(s.served, 1);
  assert.ok(s.coins > DISHES.kopi.price * 2, 'a tip for quick service');
  assert.ok(s.coins <= DISHES.kopi.price * 2 * 1.5 + .01, 'tips are at most half');
  assert.equal(s.combo, 1);
  seconds(s, 1);
  assert.equal(s.seats[0], null, 'a happy customer leaves after a moment');
});

test('some food burns if left ready too long; burnt food can be thrown away (for a small cost)', () => {
  const s = withCustomer(['toast']);
  cook(s, 'toast');
  seconds(s, STATIONS.toast.cook + .1);
  assert.equal(s.stations.toast.slots[0].state, 'ready');
  seconds(s, STATIONS.toast.burn + .1);
  assert.equal(s.stations.toast.slots[0].state, 'burnt');
  assert.equal(s.burnt, 1);
  s.coins = 5;
  assert.equal(tapSlot(s, 'toast', 0), true);
  assert.equal(s.coins, 5 - BURNT_COST);
  assert.equal(s.stations.toast.slots[0], null);
  const k = withCustomer(['kopi']);
  cook(k, 'kopi');
  seconds(k, 30);
  assert.notEqual(k.stations.kopi.slots[0]?.state, 'burnt', 'drinks never burn');
});

test('the kitchen timer gives more time before burning; faster stoves cook faster; more burners', () => {
  const base = withCustomer(['toast']);
  const up = withCustomer(['toast'], { upgrades: { timer: 1, fast: 2, slots: 1 } });
  assert.equal(up.stations.toast.slots.length, STATIONS.toast.slots + 1);
  cook(base, 'toast');
  cook(up, 'toast');
  seconds(base, STATIONS.toast.cook * .8);
  seconds(up, STATIONS.toast.cook * .8);
  assert.equal(base.stations.toast.slots[0].state, 'cooking');
  assert.equal(up.stations.toast.slots[0].state, 'ready', '12% faster twice');
  seconds(up, STATIONS.toast.burn + .5);
  assert.equal(up.stations.toast.slots[0].state, 'ready', 'two more seconds before it burns');
  assert.ok(progress(up, 'toast', up.stations.toast.slots[0]) > .5);
});

test('a customer who waits too long leaves angry and breaks the combo; a full counter makes a queue', () => {
  const s = withCustomer(['rice']);
  s.combo = 4;
  seconds(s, 31);
  assert.equal(s.lost, 1);
  assert.equal(s.combo, 0);
  const busy = createShift({ day: 9, seed: 'q' });
  busy.arrivals = Array.from({ length: SEATS + 5 }, (_, i) => ({ id: i, at: 0, who: 'kid', emoji: '🧒', order: ['kopi'], patience: 40 }));
  step(busy);
  assert.ok(busy.seats.every(Boolean));
  assert.equal(busy.queue.length, 3, 'up to three wait in line');
  assert.equal(busy.passed, 2, 'the rest walk past');
});

test('the one-tap station: serves what is ready, else cooks, else bins burnt food; serves the most urgent first', () => {
  const s = withCustomer(['satay']);
  assert.equal(tapStation(s, 'satay'), 'cook');
  assert.equal(tapStation(s, 'satay'), 'cook');
  assert.equal(tapStation(s, 'satay'), null, 'both burners busy');
  seconds(s, STATIONS.satay.cook + .1);
  assert.equal(tapStation(s, 'satay'), 'serve');
  assert.equal(s.served, 1);
  seconds(s, STATIONS.satay.burn + .2);
  assert.equal(s.stations.satay.slots.filter(x => x?.state === 'burnt').length, 1);
  assert.equal(tapStation(s, 'satay'), 'cook', 'a free burner first');
  assert.equal(tapStation(s, 'satay'), 'trash', 'then the burnt one goes');
  // the most impatient customer gets served first
  const two = createShift({ day: 9, seed: 'u' });
  two.arrivals = [
    { id: 0, at: 0, who: 'uncle', emoji: '👴', order: ['kopi'], patience: 30 },
    { id: 1, at: 0, who: 'office', emoji: '🧑‍💼', order: ['kopi'], patience: 10 },
  ];
  step(two);
  assert.equal(servingFor(two, 'kopi'), 1);
});

test('the shift ends after 90 seconds, with stars against the goals', () => {
  const s = createShift({ day: 3, seed: 'end' });
  seconds(s, SHIFT + .1);
  assert.equal(s.phase, 'over');
  assert.equal(tapStation(s, 'kopi'), null, 'no cooking after closing');
  assert.equal(starsFor(0, [10, 20, 30]), 0);
  assert.equal(starsFor(25, [10, 20, 30]), 2);
});

test('a shift replays exactly from its taps (so scores can be checked)', () => {
  const live = createShift({ day: 9, seed: 'r', upgrades: { fast: 1 } });
  const taps = [];
  const ids = Object.keys(live.stations);
  let i = 0;
  while (live.phase === 'running') {
    if (live.ticks % 13 === 0) {
      const id = ids[i++ % ids.length];
      taps.push([live.ticks, 'station', id, 0]);
      tapStation(live, id);
    }
    step(live);
    live.events.length = 0;
  }
  const again = replay({ day: 9, seed: 'r', upgrades: { fast: 1 } }, taps);
  assert.equal(again.coins, live.coins);
  assert.equal(again.served, live.served);
  assert.equal(again.lost, live.lost);
  assert.equal(again.burnt, live.burnt);
});

test('the shop: prices rise, the top level has no price; decorations cost money; the daily rush', () => {
  for (const [id, u] of Object.entries(UPGRADES)) {
    assert.ok(u.costs.every((c, k) => k === 0 || c > u.costs[k - 1]), id);
    assert.equal(upgradeCost(id, u.costs.length), null);
  }
  assert.ok(Object.values(DECOR).every(d => d.cost > 0));
  assert.equal(DAYS, 15);
  const d = daily('2026-11-28');
  assert.equal(d.number, 2);
  assert.deepEqual(d.shift.upgrades, {}, 'everyone gets the same stall');
  assert.equal(dayKey(new Date('2026-11-28T15:59:00Z')), '2026-11-28');
});
