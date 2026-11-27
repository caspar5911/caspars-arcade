// Hawker Rush: run a hawker stall for a 90-second shift. Customers sit at the counter with an order and a patience
// bar; cook at the stations (some food burns if you leave it), tap what's ready to serve it to whoever needs it most,
// and earn money, tips and combos. Everything here is deterministic (a seed and a list of taps replay exactly), so
// a shift can be checked later for a leaderboard.

export const TICK = 1 / 30;
export const SHIFT = 90; // seconds in a shift
export const LAST_ORDER = 76; // no new customers after this
export const SEATS = 4;
export const QUEUE_MAX = 3; // more than this waiting, and passers-by walk on
export const DAYS = 15; // story days; after that, endless days

export const DISHES = {
  kopi: { name: 'Kopi', emoji: '☕\uFE0F', price: 2, day: 1 }, // (the colourful emoji, not the plain symbol)
  toast: { name: 'Kaya toast', emoji: '🍞', price: 3, day: 2 },
  egg: { name: 'Soft-boiled eggs', emoji: '🥚', price: 2, day: 3 },
  teh: { name: 'Teh tarik', emoji: '🍵', price: 3, day: 5 },
  rice: { name: 'Chicken rice', emoji: '🍗', price: 6, day: 7 },
  satay: { name: 'Satay', emoji: '🍢', price: 5, day: 9 },
};

// each station makes one dish; `burn`: seconds a ready dish waits before it's ruined (null: it never is)
export const STATIONS = {
  kopi: { dish: 'kopi', name: 'Kopi', cook: 2.4, burn: null, slots: 2 },
  toast: { dish: 'toast', name: 'Toast', cook: 3.2, burn: 4.5, slots: 2 },
  egg: { dish: 'egg', name: 'Eggs', cook: 3.8, burn: 6, slots: 2 },
  teh: { dish: 'teh', name: 'Teh', cook: 3, burn: null, slots: 2 },
  rice: { dish: 'rice', name: 'Rice', cook: 4.2, burn: null, slots: 2 },
  satay: { dish: 'satay', name: 'Satay', cook: 4.2, burn: 4, slots: 2 },
};

// the customers who come by (patience: how long they'll wait, as a share of the usual)
export const PEOPLE = [
  { id: 'uncle', emoji: '👴', patience: 1.15 },
  { id: 'auntie', emoji: '👵', patience: 1.25 },
  { id: 'office', emoji: '🧑‍💼', patience: .75 },
  { id: 'student', emoji: '🧑‍🎓', patience: 1 },
  { id: 'worker', emoji: '👷', patience: .9 },
  { id: 'kid', emoji: '🧒', patience: .95 },
  { id: 'tourist', emoji: '🧑‍🦰', patience: 1.1 },
];

// upgrades from the shop (levels: each costs more)
export const UPGRADES = {
  fast: { name: 'Faster stoves', what: 'Everything cooks 12% faster', emoji: '🔥', costs: [80, 300, 600] },
  slots: { name: 'Extra burners', what: 'Every station cooks one more at once', emoji: '➕', costs: [200, 650] },
  timer: { name: 'Kitchen timer', what: 'Food takes 2 s longer to burn', emoji: '⏲️', costs: [60, 220] },
  fan: { name: 'Standing fan', what: 'Customers wait 12% longer', emoji: '🌀', costs: [90, 350, 700] },
  tipjar: { name: 'Tip jar', what: 'Tips are 20% bigger', emoji: '🫙', costs: [110, 420] },
};

// stall decorations: just for looks (something to save up for), shown on your stall
export const DECOR = {
  lanterns: { name: 'Red lanterns', emoji: '🏮', cost: 300 },
  plants: { name: 'Potted plants', emoji: '🪴', cost: 500 },
  sign: { name: 'Shop signboard', emoji: '🪧', cost: 900 },
  neon: { name: 'Neon sign', emoji: '✨', cost: 1500 },
};

export const BURNT_COST = 1; // throwing away ruined food

// ---------------------------------------------------------------------------------------------------- dice
function mulberry32(a) {
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

const round2 = v => Math.round(v * 100) / 100;

// ---------------------------------------------------------------------------------------------------- a day
/** The dishes on the menu on a day (more as the days go on). */
export function menuFor(day) {
  return Object.keys(DISHES).filter(d => DISHES[d].day <= day);
}

/** The day that brings a new dish (to introduce it), else null. */
export function newDishOn(day) {
  return Object.keys(DISHES).find(d => DISHES[d].day === day) ?? null;
}

/** The customers of a shift: who, when, what they order and how patient they are. The same for a seed. */
export function schedule(day, seed, upgrades = {}) {
  const rng = mulberry32(hash('hawker-rush:' + seed + ':' + day));
  const menu = menuFor(day);
  const count = Math.min(40, 8 + Math.round(day * 2));
  const hard = Math.min(.35, day * .02); // later days: less patience
  const people = [];
  let at = 1.5;
  const gap = (LAST_ORDER - 1.5) / count;
  for (let i = 0; i < count; i++) {
    // mostly steady, now and then a group arrives together (a rush)
    at = i === 0 ? 1.5 : rng() < .22 ? at + .5 : at + gap * (.55 + rng() * .9);
    if (at > LAST_ORDER) break;
    const big = day === 1 ? 0 : day < 4 ? (rng() < .4 ? 1 : 0) : (rng() < .3 ? 2 : rng() < .55 ? 1 : 0);
    const order = [];
    for (let k = 0; k <= big; k++) {
      // the newest dish is a bit more popular on its first days (so you learn it)
      const fresh = newDishOn(day) ?? newDishOn(day - 1);
      order.push(fresh && rng() < .3 ? fresh : menu[Math.floor(rng() * menu.length)]);
    }
    const who = PEOPLE[Math.floor(rng() * PEOPLE.length)];
    const patience = (19 + 7 * (order.length - 1)) * who.patience * (1 - hard) * (1 + .12 * (upgrades.fan ?? 0));
    people.push({ id: i, at: round2(at), who: who.id, emoji: who.emoji, order, patience: round2(patience) });
  }
  return people;
}

/** What the stars cost on a shift: a share of what every order is worth (before tips). */
export function goals(people) {
  const worth = people.reduce((sum, p) => sum + p.order.reduce((s, d) => s + DISHES[d].price, 0), 0);
  return [Math.round(worth * .55), Math.round(worth * .85), Math.round(worth * 1.12)];
}

export function starsFor(coins, goal) {
  return goal.filter(g => coins >= g).length;
}

/** A new shift. `upgrades`: {fast, slots, timer, fan, tipjar} levels. */
export function createShift({ day = 1, seed = 1, upgrades = {} } = {}) {
  const people = schedule(day, seed, upgrades);
  const stations = {};
  for (const id of menuFor(day)) {
    const s = STATIONS[id];
    stations[id] = { slots: Array.from({ length: s.slots + (upgrades.slots ?? 0) }, () => null) };
  }
  return {
    day, seed, upgrades,
    t: 0, ticks: 0, phase: 'running',
    arrivals: people, next: 0,
    seats: Array.from({ length: SEATS }, () => null),
    queue: [],
    stations,
    coins: 0, tips: 0, served: 0, lost: 0, passed: 0, burnt: 0, combo: 0, bestCombo: 0,
    goal: goals(people),
    events: [],
  };
}

const cookTime = (shift, id) => STATIONS[id].cook * .88 ** (shift.upgrades.fast ?? 0);
const burnTime = (shift, id) => STATIONS[id].burn === null ? null : STATIONS[id].burn + 2 * (shift.upgrades.timer ?? 0);

/** Start cooking at a station (in its first free slot). */
export function cook(shift, id) {
  if (shift.phase !== 'running' || !shift.stations[id]) return false;
  const slots = shift.stations[id].slots;
  const free = slots.indexOf(null);
  if (free < 0) {
    shift.events.push({ type: 'full', station: id });
    return false;
  }
  slots[free] = { dish: STATIONS[id].dish, t: 0, state: 'cooking' };
  shift.events.push({ type: 'cook', station: id, slot: free });
  return true;
}

/** Who should get a dish: the seated customer who still needs it and has the least patience left. */
export function servingFor(shift, dish) {
  let best = -1;
  shift.seats.forEach((c, i) => {
    if (!c || c.leaving) return;
    if (!c.order.some((d, k) => d === dish && !c.got[k])) return;
    if (best < 0 || c.left < shift.seats[best].left) best = i;
  });
  return best;
}

/** Tap a slot: serve what's ready (to whoever needs it most), or throw away what burnt. */
export function tapSlot(shift, id, slot) {
  if (shift.phase !== 'running') return false;
  const item = shift.stations[id]?.slots[slot];
  if (!item) return false;
  if (item.state === 'burnt') {
    shift.stations[id].slots[slot] = null;
    shift.coins = round2(Math.max(0, shift.coins - BURNT_COST));
    shift.events.push({ type: 'trash', station: id, slot });
    return true;
  }
  if (item.state !== 'ready') return false;
  const seat = servingFor(shift, item.dish);
  if (seat < 0) {
    shift.events.push({ type: 'nobody', station: id, slot, dish: item.dish });
    return false;
  }
  shift.stations[id].slots[slot] = null;
  const c = shift.seats[seat];
  c.got[c.order.findIndex((d, k) => d === item.dish && !c.got[k])] = true;
  shift.events.push({ type: 'serve', station: id, slot, seat, dish: item.dish });
  if (c.got.every(Boolean)) pay(shift, seat);
  return true;
}

/**
 * One tap on a station (the way you play on a phone): serve a ready dish someone is waiting for; otherwise start
 * cooking if there's room; otherwise throw away burnt food. Returns what happened: 'serve', 'cook', 'trash' or null.
 */
export function tapStation(shift, id) {
  if (shift.phase !== 'running' || !shift.stations[id]) return null;
  const slots = shift.stations[id].slots;
  const dish = STATIONS[id].dish;
  if (servingFor(shift, dish) >= 0) {
    // (the dish closest to burning goes first)
    let pick = -1;
    slots.forEach((it, i) => {
      if (it && it.state === 'ready' && (pick < 0 || it.t > slots[pick].t)) pick = i;
    });
    if (pick >= 0 && tapSlot(shift, id, pick)) return 'serve';
  }
  if (slots.includes(null)) return cook(shift, id) ? 'cook' : null;
  const burnt = slots.findIndex(it => it && it.state === 'burnt');
  if (burnt >= 0 && tapSlot(shift, id, burnt)) return 'trash';
  // nothing to do: everything is cooking, or ready with nobody waiting for it
  const waiting = slots.some(it => it && it.state === 'ready');
  shift.events.push({ type: waiting ? 'nobody' : 'full', station: id, dish });
  return null;
}

function pay(shift, seat) {
  const c = shift.seats[seat];
  const base = c.order.reduce((s, d) => s + DISHES[d].price, 0);
  const tip = base * .5 * Math.max(0, c.left / c.patience) * (1 + .2 * (shift.upgrades.tipjar ?? 0));
  const combo = 1 + Math.min(.5, shift.combo * .1);
  const amount = round2((base + tip) * combo);
  shift.coins = round2(shift.coins + amount);
  shift.tips = round2(shift.tips + amount - base);
  shift.served++;
  shift.combo++;
  shift.bestCombo = Math.max(shift.bestCombo, shift.combo);
  c.leaving = 'happy';
  c.leaveAt = shift.t + .6; // (a moment to see them happy)
  shift.events.push({ type: 'paid', seat, amount, combo: shift.combo });
}

function seatSomeone(shift, person) {
  const free = shift.seats.indexOf(null);
  if (free < 0) return false;
  shift.seats[free] = { ...person, left: person.patience, got: person.order.map(() => false) };
  shift.events.push({ type: 'arrive', seat: free });
  return true;
}

/** One tick: customers arrive and lose patience, food cooks (and burns), the clock runs. */
export function step(shift) {
  if (shift.phase !== 'running') return;
  shift.ticks++;
  shift.t = shift.ticks / 30; // (exact: the clock is the tick count)
  // arrivals (a queue when every seat is taken)
  while (shift.next < shift.arrivals.length && shift.arrivals[shift.next].at <= shift.t) {
    const p = shift.arrivals[shift.next++];
    if (!seatSomeone(shift, p)) {
      if (shift.queue.length < QUEUE_MAX) shift.queue.push(p);
      else {
        shift.passed++;
        shift.events.push({ type: 'passed' });
      }
    }
  }
  // the counter
  shift.seats.forEach((c, i) => {
    if (!c) return;
    if (c.leaving) {
      if (shift.t >= c.leaveAt) shift.seats[i] = null;
      return;
    }
    c.left -= TICK;
    if (c.left <= 0) {
      c.left = 0;
      c.leaving = 'angry';
      c.leaveAt = shift.t + .8;
      shift.lost++;
      shift.combo = 0;
      shift.events.push({ type: 'angry', seat: i });
    }
  });
  while (shift.queue.length && shift.seats.includes(null)) seatSomeone(shift, shift.queue.shift());
  // the kitchen
  for (const [id, station] of Object.entries(shift.stations)) {
    const cookFor = cookTime(shift, id), burnAfter = burnTime(shift, id);
    station.slots.forEach((item, i) => {
      if (!item) return;
      item.t += TICK;
      if (item.state === 'cooking' && item.t >= cookFor) {
        item.state = 'ready';
        item.t = 0;
        shift.events.push({ type: 'ready', station: id, slot: i });
      } else if (item.state === 'ready' && burnAfter !== null && item.t >= burnAfter) {
        item.state = 'burnt';
        shift.burnt++;
        shift.events.push({ type: 'burnt', station: id, slot: i });
      }
    });
  }
  if (shift.t >= SHIFT) {
    shift.phase = 'over';
    shift.events.push({ type: 'over', stars: starsFor(shift.coins, shift.goal) });
  }
}

/** How far a dish is: 0..1 while cooking; how close to burning (0..1) while ready. */
export function progress(shift, id, item) {
  if (item.state === 'cooking') return Math.min(1, item.t / cookTime(shift, id));
  const b = burnTime(shift, id);
  return item.state === 'ready' && b !== null ? Math.min(1, item.t / b) : 0;
}

/** Replay a shift from its taps ([tick, 'station'|'cook'|'slot', station, slot]); returns the finished shift. */
export function replay({ day, seed, upgrades }, taps) {
  const shift = createShift({ day, seed, upgrades });
  let i = 0;
  while (shift.phase === 'running') {
    while (i < taps.length && taps[i][0] <= shift.ticks) {
      const [, kind, station, slot] = taps[i++];
      if (kind === 'station') tapStation(shift, station);
      else if (kind === 'cook') cook(shift, station);
      else tapSlot(shift, station, slot);
    }
    step(shift);
    shift.events.length = 0;
  }
  return shift;
}

/** The daily rush: the same shift for everyone today (all dishes, standard stall, no upgrades). */
export function dayKey(date = new Date()) {
  return new Date(date.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}
export const FIRST_DAILY = '2026-11-27';
export function daily(day = dayKey()) {
  return {
    key: day,
    number: Math.round((Date.parse(day) - Date.parse(FIRST_DAILY)) / 86400000) + 1,
    shift: { day: 12, seed: 'daily-' + day, upgrades: {} },
  };
}

/** The upgrade's next price, or null at its top level. */
export function upgradeCost(id, level = 0) {
  return UPGRADES[id].costs[level] ?? null;
}
