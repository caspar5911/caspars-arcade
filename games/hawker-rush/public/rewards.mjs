// 💰 Co-op pay. A team serves more customers than one cook does (the rules give a stall of `players` cooks
// 1 + 0.6 × (players - 1) times the customers), so the team's takings are bigger. Each cook gets what that shift would
// pay one cook (the takings ÷ that crowd size), plus a 50% bonus for playing together.
export const TEAM_BONUS = .5;
export const crowdFor = players => 1 + .6 * (Math.max(1, players) - 1);

/** One cook's pay from a co-op shift's takings (to the cent). */
export function teamPay(teamCoins, players) {
  if (!(teamCoins > 0)) return 0;
  const solo = teamCoins / crowdFor(players);
  return Math.round(solo * (players >= 2 ? 1 + TEAM_BONUS : 1) * 100) / 100;
}
