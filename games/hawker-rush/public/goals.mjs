// 🎯 A bonus goal for every story day: something to chase besides the stars. Its reward goes to your wallet the first
// time you manage it (solo or with friends). Daily Rush and Speed Run have none (their scores are leaderboard scores).
import { DAYS, DISHES } from './engine.mjs';

const TABLE = {
  1: { kind: 'dish', dish: 'kopi', n: 5 },
  2: { kind: 'dish', dish: 'toast', n: 3 },
  3: { kind: 'dish', dish: 'curryPuff', n: 3 },
  4: { kind: 'noBurn' },
  5: { kind: 'combo', n: 5 },
  6: { kind: 'dish', dish: 'prata', n: 3 },
  7: { kind: 'noLeave' },
  8: { kind: 'dish', dish: 'satay', n: 3 },
  9: { kind: 'perfect', n: 5 },
  10: { kind: 'tips', n: 25 },
  11: { kind: 'dish', dish: 'rotiTelur', n: 3 },
  12: { kind: 'combo', n: 8 },
  13: { kind: 'early' },
  14: { kind: 'noBurn' },
  15: { kind: 'noLeave' },
};
// (endless days take turns through these)
const ENDLESS = [{ kind: 'combo', n: 10 }, { kind: 'noBurn' }, { kind: 'perfect', n: 8 }, { kind: 'noLeave' },
  { kind: 'tips', n: 40 }, { kind: 'dish', dish: 'rotiTelur', n: 4 }, { kind: 'early' }, { kind: 'dish', dish: 'satay', n: 5 }];

/** The day's bonus goal: { kind, n?, dish?, text, reward }. */
export function bonusGoal(day) {
  const goal = TABLE[day] ?? ENDLESS[(day - DAYS - 1) % ENDLESS.length];
  const text = {
    dish: () => `Serve ${goal.n} ${DISHES[goal.dish].name}${/puff$/i.test(DISHES[goal.dish].name) ? 's' : ''}`,
    noBurn: () => 'Burn nothing all shift',
    combo: () => `Reach a ×${goal.n} combo`,
    noLeave: () => 'Nobody leaves unhappy',
    perfect: () => `${goal.n} perfect (quick) serves`,
    tips: () => `Earn $${goal.n} in tips`,
    early: () => 'Serve everyone and close early',
  }[goal.kind]();
  return { ...goal, text, reward: 15 + 2 * Math.min(day, DAYS) };
}

/**
 * How it's going. `s`: { served, burnt, lost, passed, bestCombo, tips, early, dishes: {id: n}, perfect, over }.
 * Returns { done, short } (short: a few characters for the shift's top bar).
 */
export function goalProgress(goal, s) {
  const count = (have, need) => ({ done: have >= need, short: `${Math.min(have, need)}/${need}` });
  switch (goal.kind) {
    case 'dish': return count(s.dishes?.[goal.dish] ?? 0, goal.n);
    case 'combo': return { done: s.bestCombo >= goal.n, short: `×${Math.min(s.bestCombo, goal.n)}/×${goal.n}` };
    case 'perfect': return count(s.perfect ?? 0, goal.n);
    case 'tips': return { done: s.tips >= goal.n, short: `$${Math.floor(Math.min(s.tips, goal.n))}/$${goal.n}` };
    case 'noBurn': return { done: Boolean(s.over && s.burnt === 0 && s.served >= 5), short: s.burnt ? '✗' : 'no burns' };
    case 'noLeave': return { done: Boolean(s.over && s.lost + s.passed === 0 && s.served >= 5), short: s.lost + s.passed ? '✗' : 'all happy' };
    case 'early': return { done: s.early > 0, short: s.early > 0 ? '✓' : 'close early' };
    default: return { done: false, short: '' };
  }
}
