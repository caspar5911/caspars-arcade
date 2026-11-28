// 📅 Story progress. A day cleared with at least one star keeps its best stars, whether you played it alone or helped
// friends with it. The next day opens only once every day before it is cleared: on day 2, helping friends clear day 8
// saves day 8's stars, and day 9 opens when you've cleared days 2 to 7 yourself (or with friends).
export function clearDay(save, day, stars) {
  if (!(stars > 0)) return null;
  save.best[day] = Math.max(save.best[day] ?? 0, stars);
  const was = save.day;
  while ((save.best[save.day] ?? 0) > 0 && save.day < Number.MAX_SAFE_INTEGER - 1) save.day++;
  return save.day > was ? save.day : null; // (the newly opened day, if any)
}

/** A day you can play: up to your next day, or any day you've already cleared (with friends, say). */
export const canPlay = (save, day) => day <= save.day || (save.best[day] ?? 0) > 0;
