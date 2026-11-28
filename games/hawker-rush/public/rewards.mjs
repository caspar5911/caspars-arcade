// 💰 Co-op pay. A team serves more customers than one cook does (the rules give a stall of `players` cooks
// 1 + 0.6 × (players - 1) times the customers), so the team's takings are bigger. Each cook gets what that shift would
// pay one cook (the takings ÷ that crowd size), plus a bonus for playing together that grows with the team:
// +50% for 2 cooks, +60% for 3, +75% for 4 (bigger teams are harder to keep in step, and bring friends along).
export const teamBonus = players => players >= 4 ? .75 : players === 3 ? .6 : players === 2 ? .5 : 0;
export const crowdFor = players => 1 + .6 * (Math.max(1, players) - 1);

/** One cook's pay from a co-op shift's takings (to the cent). */
export function teamPay(teamCoins, players) {
  if (!(teamCoins > 0)) return 0;
  const solo = teamCoins / crowdFor(players);
  return Math.round(solo * (1 + teamBonus(players)) * 100) / 100;
}
