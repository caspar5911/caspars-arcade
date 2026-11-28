// Hawker Rush (v5): run a hawker stall. Customers sit at the counter and order; you build each dish yourself, step by
// step: a cup, then kopi, then condensed milk; a plate, then toast from the toaster (it burns!), kaya and butter...
// then serve it to the customer. Some dishes are built first and then cooked whole: a curry puff (pastry, potato,
// curry) goes into the wok to fry; roti prata goes on the griddle, and must be flipped halfway.
// Quick service earns tips; serving in a row builds a combo, and every 5th serve in a row starts Fever time (double
// tips for a few seconds). Now and then someone special comes: a food critic (serve them quickly for a glowing review,
// or lose a little if they storm off), a big group (three dishes, a big tip), or one of the regulars, who always
// order their favourite.
// A shift comes in waves (a quiet open, the lunch rush, a breather, the dinner rush). A free seat never sits empty for
// long: the next customer due soon walks straight in, so quick players get busier, and can close early for a bonus.
// Deterministic: a seed and the list of actions replay exactly (for checked leaderboards).

export const RULES = 5; // the rules version: the leaderboard server (ENGINE) and every phone in a co-op stall must agree
export const TICK = 1 / 30;
export const SEATS = 4;
export const QUEUE_MAX = 5;
export const DAYS = 15;
export const SHIFT = 120; // seconds in a story or daily shift
export const SPEED_CUSTOMERS = 15; // a speed run: serve them all, as fast as you can
export const MAX_PLAYERS = 4; // co-op: friends sharing one stall
// the waves of a shift: [from second, busyness] (busyness: customers per second, relative)
export const WAVES = [[0, .9, 'open'], [20, 1.9, 'lunch'], [55, .7, 'breather'], [70, 1.6, 'dinner'], [SHIFT - 20, 0, 'closing']];
export const WALK_IN = 15; // a free seat (and nobody queuing): the next customer due within this many seconds sits down
export const FEVER_EVERY = 5; // every 5th customer served in a row starts Fever time…
export const FEVER_TIME = 8; // …for this many seconds: tips are doubled (a customer storming off ends it)
export const CRITIC_FINE = 5; // a food critic who storms off writes a bad review: this much off the takings
// the regulars: the same faces come back, day after day, for their favourite
export const REGULARS = [
  { id: 'huat', name: 'Uncle Huat', who: 'uncle', fav: 'kopi' },
  { id: 'meiling', name: 'Mei Ling', who: 'student', fav: 'teh' },
  { id: 'lily', name: 'Little Lily', who: 'kid', fav: 'toast' },
  { id: 'siti', name: 'Kak Siti', who: 'auntie', fav: 'curryPuff' },
  { id: 'rajan', name: 'Mr Rajan', who: 'office', fav: 'prata' },
  { id: 'boon', name: 'Boon the builder', who: 'worker', fav: 'rice' },
];
export const EARLY_BONUS = .15; // closing early: up to this much per second left on the clock (all served)

// ---------------------------------------------------------------------------------------------------- the kitchen
// bases: what a dish is built in
export const BASES = { cup: { name: 'Cup' }, plate: { name: 'Plate' }, bowl: { name: 'Bowl' }, pastry: { name: 'Pastry' }, dough: { name: 'Dough' } };

// ingredients: what goes into which base (cooked ones come from a cooking station)
export const INGREDIENTS = {
  kopi: { name: 'Kopi', base: 'cup' },
  teh: { name: 'Teh', base: 'cup' },
  milk: { name: 'Condensed milk', base: 'cup' },
  ice: { name: 'Ice', base: 'cup' },
  toast: { name: 'Toast', base: 'plate', cooked: 'toaster' },
  kaya: { name: 'Kaya', base: 'plate' },
  butter: { name: 'Butter', base: 'plate' },
  eggs: { name: 'Soft-boiled eggs', base: 'bowl', cooked: 'pot' },
  soy: { name: 'Soy sauce', base: 'bowl' },
  rice: { name: 'Rice', base: 'plate' },
  chicken: { name: 'Chicken', base: 'plate' },
  cucumber: { name: 'Cucumber', base: 'plate' },
  chilli: { name: 'Chilli', base: 'plate' },
  satay: { name: 'Satay', base: 'plate', cooked: 'grill' },
  peanut: { name: 'Peanut sauce', base: 'plate' },
  potato: { name: 'Potato', base: 'pastry' },
  curry: { name: 'Curry', base: 'pastry' },
  egg: { name: 'Egg', base: 'dough' },
};

// cooking stations (it all burns if left ready too long). Most cook one ingredient (bread on the charcoal grill...);
// the wok and the griddle cook a whole dish you built first. The griddle's prata must be flipped halfway.
export const STATIONS = {
  toaster: { name: 'Toast grill', makes: 'toast', cook: 3.2, burn: 5, slots: 2 },
  pot: { name: 'Egg pot', makes: 'eggs', cook: 3.6, burn: 6, slots: 2 },
  grill: { name: 'Satay grill', makes: 'satay', cook: 4, burn: 4.5, slots: 2 },
  wok: { name: 'Wok', dishes: true, cook: 4, burn: 5, slots: 2 },
  griddle: { name: 'Prata griddle', dishes: true, flip: true, cook: 4, burn: 3.5, slots: 2 },
};

// dishes: a base and exactly these ingredients (in any order); `cook`: then cooked whole at that station;
// `day` it joins the menu
export const DISHES = {
  kopi: { name: 'Kopi', base: 'cup', has: ['kopi', 'milk'], price: 2, day: 1 },
  kopiO: { name: 'Kopi-O', base: 'cup', has: ['kopi'], price: 1.5, day: 2 },
  toast: { name: 'Kaya toast', base: 'plate', has: ['toast', 'kaya', 'butter'], price: 3, day: 2 },
  curryPuff: { name: 'Curry puff', base: 'pastry', has: ['potato', 'curry'], cook: 'wok', price: 3.5, day: 3 },
  eggs: { name: 'Soft-boiled eggs', base: 'bowl', has: ['eggs', 'soy'], price: 2, day: 4 },
  teh: { name: 'Teh', base: 'cup', has: ['teh', 'milk'], price: 2, day: 4 },
  kopiPeng: { name: 'Kopi peng', base: 'cup', has: ['kopi', 'milk', 'ice'], price: 2.5, day: 5 },
  prata: { name: 'Roti prata', base: 'dough', has: [], cook: 'griddle', price: 2.5, day: 6 },
  rice: { name: 'Chicken rice', base: 'plate', has: ['rice', 'chicken', 'cucumber'], price: 5, day: 7 },
  satay: { name: 'Satay', base: 'plate', has: ['satay', 'peanut'], price: 5, day: 8 },
  riceChilli: { name: 'Chicken rice + chilli', base: 'plate', has: ['rice', 'chicken', 'cucumber', 'chilli'], price: 5.5, day: 9 },
  tehPeng: { name: 'Teh peng', base: 'cup', has: ['teh', 'milk', 'ice'], price: 2.5, day: 10 },
  rotiTelur: { name: 'Roti telur', base: 'dough', has: ['egg'], cook: 'griddle', price: 3.5, day: 11 },
};

// the counter's prep spots (where dishes are built)
export const PREP = 3;

// customers (patience: a share of the usual)
export const PEOPLE = [
  { id: 'uncle', name: 'Uncle', patience: 1.15 },
  { id: 'auntie', name: 'Auntie', patience: 1.2 },
  { id: 'office', name: 'Office worker', patience: .8 },
  { id: 'student', name: 'Student', patience: 1 },
  { id: 'worker', name: 'Construction worker', patience: .9 },
  { id: 'kid', name: 'Kid', patience: .95 },
  { id: 'tourist', name: 'Tourist', patience: 1.1 },
];

export const UPGRADES = {
  prep: { name: 'Bigger counter', what: 'One more spot to build dishes on', costs: [120] },
  fast: { name: 'Faster stoves', what: 'Everything on the stove line cooks 15% faster (wok and griddle too)', costs: [80, 260, 520] },
  timer: { name: 'Kitchen timer', what: 'Food takes 2 s longer to burn', costs: [60, 200] },
  slots: { name: 'Extra burners', what: 'Every grill, pot, wok and griddle cooks one more at once', costs: [180, 520] },
  fan: { name: 'Standing fan', what: 'Customers wait 12% longer', costs: [90, 320, 640] },
  tipjar: { name: 'Tip jar', what: 'Tips are 20% bigger', costs: [110, 400] },
};

export const DECOR = {
  lanterns: { name: 'Red lanterns', cost: 300 },
  plants: { name: 'Potted plants', cost: 500 },
  sign: { name: 'Shop signboard', cost: 900 },
  neon: { name: 'Neon sign', cost: 1500 },
};

export const BURNT_COST = 1; // binning burnt food
export const WASTE_COST = .5; // binning a dish you built

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

// ---------------------------------------------------------------------------------------------------- menu and customers
export function menuFor(day) {
  return Object.keys(DISHES).filter(d => DISHES[d].day <= day);
}

export function newOn(day) {
  return Object.keys(DISHES).filter(d => DISHES[d].day === day);
}

/** The ingredients, bases and stations a day needs (the kitchen shows only these). */
export function kitchenFor(day) {
  const bases = new Set(), ingredients = new Set(), stations = new Set();
  for (const d of menuFor(day)) {
    bases.add(DISHES[d].base);
    if (DISHES[d].cook) stations.add(DISHES[d].cook);
    for (const i of DISHES[d].has) {
      if (INGREDIENTS[i].cooked) stations.add(INGREDIENTS[i].cooked);
      else ingredients.add(i);
    }
  }
  return { bases: [...bases], ingredients: [...ingredients], stations: [...stations] };
}

/** How many steps a dish takes (a base, each ingredient; cooking counts double): for patience. */
export function steps(dish) {
  const d = DISHES[dish];
  return 1 + d.has.reduce((n, i) => n + (INGREDIENTS[i].cooked ? 2 : 1), 0) + (d.cook ? 2 + (STATIONS[d.cook].flip ? 1 : 0) : 0);
}

/** How many friends share the stall (1 to MAX_PLAYERS). */
export function playersOf(spec) {
  const n = spec?.players;
  return Number.isInteger(n) && n >= 1 && n <= MAX_PLAYERS ? n : 1;
}
export const seatsFor = players => SEATS + (players >= 2 ? 1 : 0) + (players >= 4 ? 1 : 0);
export const prepFor = (players, upgrades = {}) => PREP + (upgrades.prep ?? 0) + Math.min(3, 2 * (players - 1));

/** How busy the stall is at second `t` (the waves, eased in on the first days). */
function busyness(t, day) {
  const ease = Math.min(1, day / 4);
  let w = 0;
  for (const [from, b] of WAVES) if (t >= from) w = b;
  return w === 0 ? 0 : 1 + ease * (w - 1);
}

/** When `count` customers arrive: spread by the waves (more in the rushes), each a little early or late. */
function arrivalTimes(count, day, rng) {
  const step = .5, end = SHIFT - 20, start = 1.5;
  const cum = [0];
  for (let t = start; t < end; t += step) cum.push(cum[cum.length - 1] + busyness(t, day) * step);
  const total = cum[cum.length - 1];
  const out = [];
  for (let i = 0; i < count; i++) {
    const u = total * (i + .15 + rng() * .7) / count;
    let k = 1;
    while (k < cum.length - 1 && cum[k] < u) k++;
    const t = start + (k - 1) * step + step * (u - cum[k - 1]) / Math.max(1e-9, cum[k] - cum[k - 1]);
    out.push(Math.min(end, Math.max(start, t)));
  }
  return out;
}

/**
 * The customers of a shift. `mode`: 'day' (a story or daily shift, in waves), or 'speed' (a speed run: a steady line
 * of customers, every dish on the menu). `players`: friends sharing the stall (more of them, more customers).
 */
export function schedule({ day = 1, seed = 1, mode = 'day', upgrades = {}, players = 1 } = {}) {
  const team = playersOf({ players });
  const rng = mulberry32(hash(`hawker-rush-3:${mode}:${seed}:${day}:${team}`));
  const speed = mode === 'speed';
  const menu = menuFor(speed ? DAYS : day);
  const fresh = speed ? [] : newOn(day);
  const solo = speed ? SPEED_CUSTOMERS : Math.min(30, 9 + Math.round(day * 1.3));
  const count = Math.round(solo * (1 + .6 * (team - 1)));
  const times = speed ? null : arrivalTimes(count, day, rng);
  if (times) times[0] = 1.5; // (someone is always waiting when the stall opens)
  const hard = speed ? .2 : Math.min(.3, day * .018);
  const people = [];
  const regularsToday = new Set();
  let at = 1.5;
  for (let i = 0; i < count; i++) {
    if (speed) {
      if (i > 0) at += 1.2 + rng() * 1.3;
    } else at = times[i];
    const big = speed ? (rng() < .35 ? 1 : 0) : day === 1 ? 0 : day < 4 ? (rng() < .3 ? 1 : 0) : (rng() < .2 ? 2 : rng() < .5 ? 1 : 0);
    const order = [];
    for (let k = 0; k <= big; k++) {
      order.push(fresh.length && rng() < .35 ? fresh[Math.floor(rng() * fresh.length)] : menu[Math.floor(rng() * menu.length)]);
    }
    let who = PEOPLE[Math.floor(rng() * PEOPLE.length)];
    // someone special? (story and daily shifts: a speed run is the same plain line for everyone)
    let kind = null, regular = null;
    if (!speed) {
      const roll = rng();
      const regulars = REGULARS.filter(r => menu.includes(r.fav) && !regularsToday.has(r.id));
      if (day >= 4 && roll < .05) kind = 'critic';
      else if (day >= 3 && roll < .11) {
        kind = 'group';
        while (order.length < 3) order.push(menu[Math.floor(rng() * menu.length)]);
      } else if (day >= 2 && roll < .22 && regulars.length) {
        kind = 'regular';
        regular = regulars[Math.floor(rng() * regulars.length)];
        regularsToday.add(regular.id);
        order[0] = regular.fav;
        who = PEOPLE.find(p => p.id === regular.who);
      }
    }
    const work = order.reduce((n, d) => n + steps(d), 0);
    const mood = kind === 'critic' ? .75 : kind === 'group' ? 1.35 : 1;
    const patience = (16 + 4 * work) * who.patience * mood * (1 - hard) * (1 + .12 * (upgrades.fan ?? 0));
    people.push({ id: i, at: round2(at), who: who.id, order, patience: round2(patience), ...(kind ? { kind } : {}), ...(regular ? { regular: regular.id } : {}) });
  }
  return people.sort((a, b) => a.at - b.at || a.id - b.id);
}

/** The stars of a day: a share of what every order is worth before tips. */
export function goals(people) {
  const worth = people.reduce((s, p) => s + p.order.reduce((t, d) => t + DISHES[d].price, 0), 0);
  return [Math.round(worth * .45), Math.round(worth * .8), Math.round(worth * 1.05)];
}

export function starsFor(coins, goal) {
  return goal.filter(g => coins >= g).length;
}

// ---------------------------------------------------------------------------------------------------- a shift
/** A new shift. `spec`: { day, seed, mode: 'day'|'speed', upgrades, players }. */
export function createShift(spec = {}) {
  const { day = 1, seed = 1, mode = 'day', upgrades = {} } = spec;
  const players = playersOf(spec);
  const people = schedule({ day, seed, mode, upgrades, players });
  const kitchen = kitchenFor(mode === 'speed' ? DAYS : day);
  const stations = {};
  for (const id of kitchen.stations) {
    stations[id] = { slots: Array.from({ length: STATIONS[id].slots + (upgrades.slots ?? 0) }, () => null) };
  }
  return {
    day, seed, mode, upgrades, kitchen, players,
    t: 0, ticks: 0, phase: 'running', wave: -1,
    arrivals: people, next: 0,
    seats: Array.from({ length: seatsFor(players) }, () => null),
    queue: [],
    prep: Array.from({ length: prepFor(players, upgrades) }, () => null),
    stations,
    coins: 0, tips: 0, served: 0, dishes: 0, lost: 0, passed: 0, burnt: 0, wasted: 0, combo: 0, bestCombo: 0,
    early: 0, earlyBonus: 0, feverUntil: 0, fevers: 0, reviews: 0,
    goal: goals(people),
    events: [],
  };
}

const cookTime = (shift, id) => STATIONS[id].cook * .85 ** (shift.upgrades.fast ?? 0);
const burnTime = (shift, id) => STATIONS[id].burn + 2 * (shift.upgrades.timer ?? 0);

const sameMix = (d, item) => d.base === item.base && d.has.length === item.has.length && d.has.every(i => item.has.includes(i));

/** What a dish on the counter is (a dish id when it's exactly a finished dish, else null). */
export function dishOf(item) {
  if (!item) return null;
  for (const [id, d] of Object.entries(DISHES)) {
    if (sameMix(d, item) && Boolean(d.cook) === Boolean(item.cooked)) return id;
  }
  return null;
}

/** A built dish waiting to be cooked whole (a curry puff for the wok...): its dish id, else null. */
export function readyToCook(item) {
  if (!item || item.cooked) return null;
  for (const [id, d] of Object.entries(DISHES)) if (d.cook && sameMix(d, item)) return id;
  return null;
}

/** Which dishes this item could still become (by adding more, or cooking it). */
export function couldBe(item) {
  if (item.cooked) return Object.keys(DISHES).filter(id => DISHES[id].cook && sameMix(DISHES[id], item));
  return Object.keys(DISHES).filter(id => {
    const d = DISHES[id];
    return d.base === item.base && item.has.every(i => d.has.includes(i));
  });
}

/** The dishes the seated customers still need (who needs it most first). */
export function wanted(shift) {
  const out = [];
  shift.seats.forEach((c, seat) => {
    if (!c || c.leaving) return;
    c.order.forEach((d, k) => {
      if (!c.got[k]) out.push({ dish: d, seat, left: c.left });
    });
  });
  return out.sort((a, b) => a.left - b.left);
}

/** Where a tapped ingredient should go: the best dish on the counter to add it to (or -1). */
export function autoSpot(shift, ingredient) {
  const base = INGREDIENTS[ingredient].base;
  const need = wanted(shift).map(w => w.dish);
  let best = -1, bestScore = -1;
  shift.prep.forEach((item, i) => {
    if (!item || item.cooked || item.base !== base || item.has.includes(ingredient)) return;
    const options = couldBe({ base, has: [...item.has, ingredient] });
    if (!options.length) return;
    // a dish someone is waiting for is best; then any dish it could still become
    const score = options.some(d => need.includes(d)) ? 2 : 1;
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  });
  return best;
}

/** Put a base (a cup, a plate, a bowl) on the counter. `spot`: which one (-1: the first free). */
export function placeBase(shift, base, spot = -1) {
  if (shift.phase !== 'running' || !shift.kitchen.bases.includes(base)) return false;
  const i = spot >= 0 ? spot : shift.prep.indexOf(null);
  if (i < 0 || i >= shift.prep.length || shift.prep[i]) {
    shift.events.push({ type: 'counter-full' });
    return false;
  }
  shift.prep[i] = { base, has: [] };
  shift.events.push({ type: 'base', spot: i, base });
  return true;
}

/** Add an ingredient (from its jar, or a cooked one from its station) to a dish on the counter. */
export function addIngredient(shift, ingredient, spot = -1) {
  if (shift.phase !== 'running') return false;
  const ing = INGREDIENTS[ingredient];
  if (!ing) return false;
  let slot = -1;
  if (ing.cooked) {
    const st = shift.stations[ing.cooked];
    if (!st) return false;
    st.slots.forEach((it, k) => { // (the ready one closest to burning)
      if (it && it.state === 'ready' && (slot < 0 || it.t > st.slots[slot].t)) slot = k;
    });
    if (slot < 0) return false;
  } else if (!shift.kitchen.ingredients.includes(ingredient)) return false;
  const i = spot >= 0 ? spot : autoSpot(shift, ingredient);
  const item = shift.prep[i];
  if (!item || item.cooked || item.base !== ing.base || item.has.includes(ingredient) ||
      !couldBe({ base: item.base, has: [...item.has, ingredient] }).length) {
    shift.events.push({ type: 'wrong', ingredient, spot: i });
    return false;
  }
  item.has.push(ingredient);
  if (ing.cooked) shift.stations[ing.cooked].slots[slot] = null;
  shift.events.push({ type: 'add', ingredient, spot: i, dish: dishOf(item) });
  return true;
}

/** Start cooking at a station (bread on the grill, eggs in the pot, satay on the grill). */
export function cook(shift, id) {
  if (shift.phase !== 'running' || !shift.stations[id] || STATIONS[id].dishes) return false;
  const slots = shift.stations[id].slots;
  const free = slots.indexOf(null);
  if (free < 0) {
    shift.events.push({ type: 'station-full', station: id });
    return false;
  }
  slots[free] = { t: 0, state: 'cooking' };
  shift.events.push({ type: 'cook', station: id, slot: free });
  return true;
}

/** Put a built dish into its station to cook whole (the curry puff into the wok, the prata onto the griddle). */
export function cookDish(shift, spot) {
  if (shift.phase !== 'running') return false;
  const item = shift.prep[spot];
  const dish = readyToCook(item);
  if (!dish) {
    shift.events.push({ type: 'not-ready', spot });
    return false;
  }
  const id = DISHES[dish].cook;
  const slots = shift.stations[id]?.slots;
  const free = slots ? slots.indexOf(null) : -1;
  if (free < 0) {
    shift.events.push({ type: 'station-full', station: id });
    return false;
  }
  slots[free] = { t: 0, state: 'cooking', item: { base: item.base, has: [...item.has] } };
  shift.prep[spot] = null;
  shift.events.push({ type: 'cook-dish', station: id, slot: free, spot, dish });
  return true;
}

/** Flip what's waiting to be flipped on the griddle. */
export function flip(shift, id) {
  const slots = shift.stations[id]?.slots;
  const k = slots && shift.phase === 'running' ? slots.findIndex(it => it && it.state === 'flip') : -1;
  if (k < 0) return false;
  slots[k] = { ...slots[k], state: 'cooking', t: 0, flipped: true };
  shift.events.push({ type: 'flip', station: id, slot: k });
  return true;
}

/** Take a cooked dish out of its station onto the counter (`spot`, or the first free one). */
export function takeOut(shift, id, spot = -1) {
  const slots = shift.stations[id]?.slots;
  if (!slots || !STATIONS[id].dishes || shift.phase !== 'running') return false;
  let k = -1;
  slots.forEach((it, j) => { // (the ready one closest to burning)
    if (it && it.state === 'ready' && (k < 0 || it.t > slots[k].t)) k = j;
  });
  if (k < 0) return false;
  const i = spot >= 0 ? spot : shift.prep.indexOf(null);
  if (i < 0 || i >= shift.prep.length || shift.prep[i]) {
    shift.events.push({ type: 'counter-full' });
    return false;
  }
  shift.prep[i] = { ...slots[k].item, cooked: true };
  slots[k] = null;
  shift.events.push({ type: 'take', station: id, spot: i, dish: dishOf(shift.prep[i]) });
  return true;
}

/** Bin burnt food at a station. */
export function binBurnt(shift, id) {
  const slots = shift.stations[id]?.slots;
  const k = slots ? slots.findIndex(it => it && it.state === 'burnt') : -1;
  if (k < 0 || shift.phase !== 'running') return false;
  slots[k] = null;
  shift.coins = round2(Math.max(0, shift.coins - BURNT_COST));
  shift.events.push({ type: 'bin-burnt', station: id, slot: k });
  return true;
}

/** Bin a dish from the counter (a mistake). */
export function binDish(shift, spot) {
  if (shift.phase !== 'running' || !shift.prep[spot]) return false;
  shift.prep[spot] = null;
  shift.coins = round2(Math.max(0, shift.coins - WASTE_COST));
  shift.wasted++;
  shift.events.push({ type: 'bin-dish', spot });
  return true;
}

/** Who should get a finished dish: `seat` if they want it, else whoever wants it and has least patience left. */
export function servingFor(shift, dish, seat = -1) {
  const wants = s => {
    const c = shift.seats[s];
    return c && !c.leaving && c.order.some((d, k) => d === dish && !c.got[k]);
  };
  if (seat >= 0) return wants(seat) ? seat : -1;
  let best = -1;
  shift.seats.forEach((c, s) => {
    if (wants(s) && (best < 0 || c.left < shift.seats[best].left)) best = s;
  });
  return best;
}

/** Serve a finished dish from the counter (to `seat`, or whoever needs it most). */
export function serve(shift, spot, seat = -1) {
  if (shift.phase !== 'running') return false;
  const dish = dishOf(shift.prep[spot]);
  const to = dish ? servingFor(shift, dish, seat) : -1;
  if (to < 0) {
    shift.events.push({ type: dish ? 'not-wanted' : 'not-ready', spot, seat });
    return false;
  }
  shift.prep[spot] = null;
  const c = shift.seats[to];
  c.got[c.order.findIndex((d, k) => d === dish && !c.got[k])] = true;
  shift.dishes++;
  shift.events.push({ type: 'serve', spot, seat: to, dish });
  if (c.got.every(Boolean)) pay(shift, to);
  return true;
}

function pay(shift, seat) {
  const c = shift.seats[seat];
  const base = c.order.reduce((s, d) => s + DISHES[d].price, 0);
  const quick = Math.max(0, c.left / c.patience);
  const fever = shift.t < shift.feverUntil;
  const tip = base * .6 * quick * (1 + .2 * (shift.upgrades.tipjar ?? 0)) *
    (c.kind === 'group' ? 1.5 : c.kind === 'regular' ? 1.25 : 1) * (fever ? 2 : 1);
  // the food critic: served quickly, a glowing review (worth the dishes' price again)
  const review = c.kind === 'critic' ? (quick > .5 ? 'great' : 'fine') : null;
  const combo = 1 + Math.min(.5, shift.combo * .1);
  const amount = round2((base + tip + (review === 'great' ? base : 0)) * combo);
  shift.coins = round2(shift.coins + amount);
  shift.tips = round2(shift.tips + amount - base);
  shift.served++;
  shift.combo++;
  shift.bestCombo = Math.max(shift.bestCombo, shift.combo);
  c.leaving = 'happy';
  c.leaveAt = shift.t + 1.2; // (a moment to eat and smile)
  if (review === 'great') shift.reviews++;
  shift.events.push({ type: 'paid', seat, amount, combo: shift.combo, perfect: quick > .6, fever,
    ...(c.kind ? { kind: c.kind } : {}), ...(c.regular ? { regular: c.regular } : {}), ...(review ? { review } : {}) });
  if (shift.combo % FEVER_EVERY === 0) {
    shift.feverUntil = round2(shift.t + FEVER_TIME);
    shift.fevers++;
    shift.events.push({ type: 'fever', until: shift.feverUntil });
  }
}

function seatSomeone(shift, person) {
  const free = shift.seats.indexOf(null);
  if (free < 0) return false;
  shift.seats[free] = { ...person, left: person.patience, got: person.order.map(() => false), since: shift.t };
  shift.events.push({ type: 'arrive', seat: free });
  return true;
}

/** One tick: customers arrive and wait, food cooks (and burns), the clock runs. */
export function step(shift) {
  if (shift.phase !== 'running') return;
  shift.ticks++;
  shift.t = shift.ticks / 30;
  if (shift.mode !== 'speed') {
    let w = -1;
    WAVES.forEach(([from], k) => { if (shift.t >= from) w = k; });
    if (w !== shift.wave) {
      shift.wave = w;
      if (w > 0) shift.events.push({ type: 'wave', wave: WAVES[w][2] });
    }
  }
  while (shift.next < shift.arrivals.length && shift.arrivals[shift.next].at <= shift.t) {
    const p = shift.arrivals[shift.next++];
    if (!seatSomeone(shift, p)) {
      if (shift.queue.length < QUEUE_MAX || shift.mode === 'speed') shift.queue.push(p);
      else {
        shift.passed++;
        shift.events.push({ type: 'passed' });
      }
    }
  }
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
      c.leaveAt = shift.t + 1;
      shift.lost++;
      shift.combo = 0;
      if (shift.feverUntil > shift.t) {
        shift.feverUntil = shift.t;
        shift.events.push({ type: 'fever-end' });
      }
      const fine = c.kind === 'critic' ? Math.min(CRITIC_FINE, shift.coins) : 0;
      shift.coins = round2(shift.coins - fine);
      shift.events.push({ type: 'angry', seat: i, ...(fine ? { review: 'bad', fine } : {}) });
    }
  });
  while (shift.queue.length && shift.seats.includes(null)) seatSomeone(shift, shift.queue.shift());
  // a free seat and nobody queuing: whoever is due soon walks straight in (no waiting around for the clock)
  while (shift.mode !== 'speed' && !shift.queue.length && shift.seats.includes(null) && shift.next < shift.arrivals.length &&
         shift.arrivals[shift.next].at <= shift.t + WALK_IN) seatSomeone(shift, shift.arrivals[shift.next++]);
  for (const [id, st] of Object.entries(shift.stations)) {
    st.slots.forEach((it, k) => {
      if (!it) return;
      it.t += TICK;
      const half = STATIONS[id].flip;
      if (it.state === 'cooking' && it.t >= cookTime(shift, id) * (half ? .5 : 1)) {
        it.state = half && !it.flipped ? 'flip' : 'ready';
        it.t = 0;
        shift.events.push({ type: it.state === 'flip' ? 'flip-me' : 'ready', station: id, slot: k });
      } else if ((it.state === 'ready' || it.state === 'flip') && it.t >= burnTime(shift, id)) {
        it.state = 'burnt';
        shift.burnt++;
        shift.events.push({ type: 'burnt', station: id, slot: k });
      }
    });
  }
  const everyoneDone = shift.next >= shift.arrivals.length && !shift.queue.length && shift.seats.every(c => !c);
  if (shift.mode !== 'speed' && everyoneDone && shift.t < SHIFT) {
    // everyone has been and gone: close early, with a bonus for the time left
    // (the bonus is for good service: it shrinks with every customer who left unhappy or walked past)
    const share = shift.served / Math.max(1, shift.served + shift.lost + shift.passed);
    shift.early = Math.floor(SHIFT - shift.t);
    shift.earlyBonus = round2(shift.early * EARLY_BONUS * share);
    shift.coins = round2(shift.coins + shift.earlyBonus);
    shift.phase = 'over';
    shift.events.push({ type: 'closed-early', seconds: shift.early, amount: shift.earlyBonus }, { type: 'over' });
  } else if ((shift.mode === 'speed' && everyoneDone) || (shift.mode !== 'speed' && shift.t >= SHIFT)) {
    shift.phase = 'over';
    shift.events.push({ type: 'over' });
  }
}

/** A cooking slot's progress: 0..1 while cooking; how close to burning while ready. */
export function progress(shift, id, it) {
  if (it.state === 'cooking') {
    if (!STATIONS[id].flip) return Math.min(1, it.t / cookTime(shift, id));
    return Math.min(1, (it.flipped ? .5 : 0) + it.t / cookTime(shift, id));
  }
  if (it.state === 'ready' || it.state === 'flip') return Math.min(1, it.t / burnTime(shift, id));
  return 1;
}

/** The speed run's time, in seconds (each customer who left angry, or walked past, adds 10 s). */
export function speedTime(shift) {
  return Math.round((shift.t + 10 * (shift.lost + shift.passed)) * 100) / 100;
}

// ---------------------------------------------------------------------------------------------------- actions and replays
/**
 * Every player action, as recorded for a replay: [tick, kind, a, b].
 * kinds: 'base' (base, spot), 'add' (ingredient, spot), 'cook' (station), 'serve' (spot, seat),
 * 'bin-dish' (spot), 'bin-burnt' (station), 'cook-dish' (spot: into its wok/griddle), 'flip' (station),
 * 'take' (station, spot: a cooked dish onto the counter).
 */
export function act(shift, kind, a, b = -1) {
  switch (kind) {
    case 'base': return placeBase(shift, a, b);
    case 'add': return addIngredient(shift, a, b);
    case 'cook': return cook(shift, a);
    case 'serve': return serve(shift, a, b);
    case 'bin-dish': return binDish(shift, a);
    case 'bin-burnt': return binBurnt(shift, a);
    case 'cook-dish': return cookDish(shift, a);
    case 'flip': return flip(shift, a);
    case 'take': return takeOut(shift, a, b);
    default: return false;
  }
}

/** Replay a shift from its actions (for checking a score). */
export function replay(spec, actions, limit = 30 * 60 * 30) {
  const shift = createShift(spec);
  let i = 0;
  while (shift.phase === 'running' && shift.ticks < limit) {
    while (i < actions.length && actions[i][0] <= shift.ticks) {
      const [, kind, a, b] = actions[i++];
      act(shift, kind, a, b);
    }
    step(shift);
    shift.events.length = 0;
  }
  return shift;
}

// ---------------------------------------------------------------------------------------------------- daily, speed run, shop
export function dayKey(date = new Date()) {
  return new Date(date.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}
export const FIRST_DAILY = '2026-11-27';

/** Today's daily rush: the same shift for everyone (every dish, a standard stall). */
export function daily(day = dayKey()) {
  return {
    key: day,
    number: Math.round((Date.parse(day) - Date.parse(FIRST_DAILY)) / 86400000) + 1,
    spec: { day: 12, seed: 'daily-' + day, mode: 'day', upgrades: {} },
  };
}

/** This week's speed run: the same 15 customers for everyone (Monday to Sunday, Singapore time). */
export function speedRun(date = new Date()) {
  const d = new Date(Date.parse(dayKey(date)));
  const monday = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86400000).toISOString().slice(0, 10);
  return { key: monday, spec: { day: DAYS, seed: 'speed-' + monday, mode: 'speed', upgrades: {} } };
}

export function upgradeCost(id, level = 0) {
  return UPGRADES[id].costs[level] ?? null;
}
