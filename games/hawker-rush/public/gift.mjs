// 🎁 A small gift for opening the game each day; a streak of days in a row grows it over a week, then starts again.
export const GIFTS = [5, 10, 15, 20, 25, 30, 50];

const dayBefore = date => {
  const d = new Date(date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

/** Today's gift, if not opened yet: { gift: the new state, amount, streak }; null if already opened today. */
export function claimGift(gift, today) {
  if (gift?.last === today) return null;
  const streak = gift?.last === dayBefore(today) ? (gift.streak ?? 0) + 1 : 1;
  return { gift: { last: today, streak }, amount: GIFTS[(streak - 1) % GIFTS.length], streak };
}

/** The local date as YYYY-MM-DD. */
export const localDay = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
