// 📋 Daily missions and 🏪 the stall level: reasons to come back each day, and to keep going.
// Missions: three small jobs for the day (the same all day, chosen when the day's first seen), each paying a little,
// plus a bonus for all three. They count every kind of shift: story, Daily Rush, Speed Run and co-op.
// The stall level grows with everything you do; each level pays a little, and some unlock a decoration for the stall.
import { DISHES, menuFor, DAYS } from './engine.mjs';

const hash = text => {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h;
};

const KINDS = [
  { kind: 'served', make: r => ({ need: [8, 12, 16][r % 3] }), text: m => `Serve ${m.need} customers`, pay: 15 },
  { kind: 'dish', make: (r, menu) => ({ dish: menu[r % menu.length], need: [3, 5][r % 2] }),
    text: m => `Serve ${m.need} ${DISHES[m.dish].name}${/puff$/i.test(DISHES[m.dish].name) ? 's' : ''}`, pay: 15 },
  { kind: 'fevers', make: r => ({ need: [1, 2][r % 2] }), text: m => m.need === 1 ? 'Start Fever time once' : `Start Fever time ${m.need} times`, pay: 20 },
  { kind: 'perfect', make: r => ({ need: [5, 8][r % 2] }), text: m => `${m.need} perfect (quick) serves`, pay: 15 },
  { kind: 'combo', make: r => ({ need: [5, 8][r % 2] }), text: m => `Reach a ×${m.need} combo`, pay: 15 },
  { kind: 'shifts', make: r => ({ need: [2, 3][r % 2] }), text: m => `Play ${m.need} shifts`, pay: 10 },
  { kind: 'threeStars', make: () => ({ need: 1 }), text: () => 'Get 3 stars on a story day', pay: 20 },
  { kind: 'regulars', make: () => ({ need: 1 }), text: () => 'Serve one of the regulars', pay: 15, from: 2 },
];
export const ALL_DONE_BONUS = 25;

/** The day's three missions (deterministic for the date and how far the player has got). */
export function dailyMissions(date, day) {
  const reach = Math.max(1, Math.min(DAYS, day));
  const menu = menuFor(reach);
  const pool = KINDS.filter(k => reach >= (k.from ?? 1));
  const picks = [];
  let r = hash('missions:' + date);
  while (picks.length < 3) {
    const k = pool[r % pool.length];
    r = hash(String(r));
    if (picks.some(p => p.kind === k.kind)) continue;
    const m = { kind: k.kind, ...k.make(r, menu), have: 0, done: false };
    m.text = k.text(m);
    m.pay = k.pay;
    picks.push(m);
  }
  return picks;
}

/** Today's missions in the save (kept for the day; a clock wound back keeps what's there). */
export function missionsFor(saved, date, day) {
  if (saved && typeof saved.date === 'string' && saved.date >= date && Array.isArray(saved.list)) return saved;
  return { date, list: dailyMissions(date, day), bonus: false };
}

/**
 * Count one shift into the missions. `s`: { served, dishes: {id: n}, fevers, perfect, bestCombo, threeStars, regulars }.
 * Returns the missions newly done (and whether the all-three bonus was just earned).
 */
export function progress(missions, s) {
  const done = [];
  for (const m of missions.list) {
    if (m.done) continue;
    const add = { served: s.served, dish: s.dishes?.[m.dish] ?? 0, fevers: s.fevers, perfect: s.perfect, shifts: 1,
      threeStars: s.threeStars ? 1 : 0, regulars: s.regulars }[m.kind];
    if (m.kind === 'combo') m.have = Math.max(m.have, s.bestCombo ?? 0);
    else m.have += add ?? 0;
    if (m.have >= m.need) {
      m.have = m.need;
      m.done = true;
      done.push(m);
    }
  }
  const bonus = !missions.bonus && missions.list.every(m => m.done);
  if (bonus) missions.bonus = true;
  return { done, bonus };
}

// ---------------------------------------------------------------------------------------------------- 🏪 stall level
/** XP for a shift: one for every customer served, three for every star, ten for a mission done. */
export const xpFor = ({ served = 0, stars = 0, missions = 0 }) => served + 3 * stars + 10 * missions;
/** The level at `xp`: level n needs 15·n·(n−1) XP (level 2 at 30, level 3 at 90, level 5 at 300…). */
export const levelAt = xp => Math.max(1, Math.floor((1 + Math.sqrt(1 + 4 * Math.max(0, xp) / 15)) / 2));
export const xpForLevel = n => 15 * n * (n - 1);
export const levelPay = n => Math.min(100, 10 * n);

// decorations the stall earns by levelling up (drawn with the stall; nothing to buy)
export const LEVEL_DECOR = [
  { id: 'bunting', name: 'Bunting flags', level: 3 },
  { id: 'fairy', name: 'Fairy lights', level: 5 },
  { id: 'flowers', name: 'Flower boxes', level: 8 },
  { id: 'star', name: 'A golden star', level: 12 },
];
export const decorAt = level => Object.fromEntries(LEVEL_DECOR.filter(d => level >= d.level).map(d => [d.id, true]));
