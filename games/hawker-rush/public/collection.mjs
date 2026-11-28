// 🏆 Collections: dish mastery (serve a dish often enough for bronze, silver and gold), a sticker for every kind of
// customer you've served, and achievements. Each step pays a little into the wallet (small next to a shift's pay).
export const MASTERY = [{ at: 10, name: 'Bronze', pay: 5 }, { at: 30, name: 'Silver', pay: 10 }, { at: 75, name: 'Gold', pay: 20 }];
export const STICKER_GOLD = 20;

export const ACHIEVEMENTS = [
  { id: 'first', name: 'First customer', what: 'Serve your first customer', pay: 5 },
  { id: 'stars3', name: 'Three stars', what: 'Get 3 stars on a story day', pay: 15 },
  { id: 'combo10', name: 'On a roll', what: 'Reach a ×10 combo', pay: 20 },
  { id: 'early', name: 'Early night', what: 'Serve everyone and close early', pay: 15 },
  { id: 'spotless', name: 'Nobody left hungry', what: 'Serve 10 or more with nobody leaving', pay: 20 },
  { id: 'served100', name: 'Busy stall', what: 'Serve 100 customers', pay: 25 },
  { id: 'served500', name: 'Famous stall', what: 'Serve 500 customers', pay: 50 },
  { id: 'friends', name: 'Better together', what: 'Finish a shift with friends', pay: 10 },
  { id: 'daily', name: 'Daily regular', what: 'Play a Daily Rush', pay: 10 },
  { id: 'speed', name: 'Speedy', what: 'Finish a Speed Run', pay: 10 },
  { id: 'goals5', name: 'Goal getter', what: 'Complete 5 bonus goals', pay: 20 },
  { id: 'allDays', name: 'Hawker master', what: 'Clear all 15 story days', pay: 50 },
  { id: 'gift7', name: 'Every day', what: 'Open the daily gift 7 days in a row', pay: 20 },
  { id: 'album', name: 'Know your customers', what: 'Serve every kind of customer', pay: 15 },
];

export const masteryOf = n => MASTERY.filter(t => n >= t.at).length; // (0 none, 1 bronze, 2 silver, 3 gold)

/** Count a shift's dishes and customers into the collection; returns what's newly reached (with its pay). */
export function collect(collection, dishes = {}, people = {}) {
  const news = [];
  for (const [id, n] of Object.entries(dishes)) {
    const before = collection.dishes[id] ?? 0;
    collection.dishes[id] = before + n;
    for (let t = masteryOf(before); t < masteryOf(before + n); t++) news.push({ kind: 'mastery', id, tier: MASTERY[t] });
  }
  for (const [who, n] of Object.entries(people)) {
    const before = collection.people[who] ?? 0;
    collection.people[who] = before + n;
    if (before === 0) news.push({ kind: 'sticker', id: who });
    if (before < STICKER_GOLD && before + n >= STICKER_GOLD) news.push({ kind: 'gold-sticker', id: who });
  }
  return news;
}

/** Achievements newly earned. `facts`: what's true now (see the ids above); `owned`: { id: true }. */
export function newAchievements(owned, facts) {
  return ACHIEVEMENTS.filter(a => !owned[a.id] && facts[a.id]);
}
