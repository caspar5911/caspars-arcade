// 🏆 The shared leaderboard. The server's address comes from the site build (arcade-config.json); without it, or if
// the server can't be reached, the game simply plays without a leaderboard.
// Fair play: each run's tower comes from the server (a one-use ticket), and saving sends the exact taps, which the
// server replays with the same rules to check the floor.

export const ENGINE = 1; // the rules version the server replays (server/hh/arcade.py ENGINE_VERSION)
const nameKey = 'ceiling-punch-name';
let server = null;

/** Find the leaderboard server (once). Returns whether there is one. */
export async function connect() {
  try {
    const r = await fetch('../../arcade-config.json', { cache: 'no-store' });
    if (!r.ok) return false;
    const config = await r.json();
    if (typeof config.server === 'string' && config.server.startsWith('https://')) server = config.server;
  } catch {
    server = null;
  }
  return server !== null;
}

export function available() {
  return server !== null;
}

async function call(path, body, timeout = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const r = await fetch(server + '/ai/arcade/ceiling-punch/' + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body ?? {}),
      signal: controller.signal,
    });
    let data = null;
    try {
      data = await r.json();
    } catch {
      data = null;
    }
    if (!r.ok) throw new Error(data?.detail ?? (r.status === 429 ? 'Too many tries. Wait a moment.' : 'The leaderboard is busy. Try again soon.'));
    return data;
  } catch (error) {
    if (error.name === 'AbortError' || error instanceof TypeError) throw new Error("Can't reach the leaderboard right now.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** A ticket for the next run's tower ({seed, ticket, engine}), or null (offline: the run can't be saved). */
export async function ticket() {
  if (!server) return null;
  try {
    const t = await call('ticket', {}, 5000);
    return t && Number.isInteger(t.seed) && typeof t.ticket === 'string' && t.engine === ENGINE ? t : null;
  } catch {
    return null;
  }
}

/** Save a run; returns the board ({week, all, name}), or throws with a friendly reason. */
export function save({ ticket: t, seed, taps, floor, name }) {
  return call('score', { ticket: t, seed, taps, floor, name, engine: ENGINE }, 15000);
}

/** The board: this week's and all-time top 10. */
export function top(name = '') {
  return call('top', { name });
}

export function savedName() {
  try {
    return localStorage.getItem(nameKey) ?? '';
  } catch {
    return '';
  }
}

export function rememberName(name) {
  try {
    localStorage.setItem(nameKey, name);
  } catch {
    // (private browsing: typed again next time)
  }
}
