// 🏆 The shared leaderboard. The server's address comes from the site build (arcade-config.json); without it, or if
// the server can't be reached, the game simply plays without a leaderboard.
// Fair play: each run's tower comes from the server (a one-use ticket), and saving sends the exact taps, which the
// server replays with the same rules to check the floor.

export const ENGINE = 1; // the rules version the server replays (server/hh/arcade.py ENGINE_VERSION)
const nameKey = 'ceiling-punch-name';
const pendingKey = 'ceiling-punch-pending'; // a finished run not saved yet (the server was unreachable)
const TICKET_MS = 3 * 3600 * 1000; // the server accepts a run for 3 hours after its ticket
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
    if (!r.ok) {
      const error = new Error(data?.detail ?? (r.status === 429 ? 'Too many tries. Wait a moment.' : "Can't reach the leaderboard right now."));
      error.offline = r.status >= 500 || r.status === 429 || !data?.detail; // (worth trying again later)
      throw error;
    }
    return data;
  } catch (error) {
    if (error.name === 'AbortError' || error instanceof TypeError) {
      const offline = new Error("Can't reach the leaderboard right now.");
      offline.offline = true;
      throw offline;
    }
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

/** When a run's ticket stops being accepted (ms since 1970), from the ticket itself ("seed.issued.signature"). */
function expires(ticket) {
  const issued = Number(String(ticket).split('.')[1]);
  return Number.isFinite(issued) ? issued * 1000 + TICKET_MS - 5 * 60 * 1000 : 0; // (5 minutes to spare)
}

/** Keep a finished run on this phone until it's saved (the better one, if there's already one waiting). */
export function keepPending(run) {
  const waiting = pending();
  if (waiting && waiting.floor >= run.floor) return;
  try {
    localStorage.setItem(pendingKey, JSON.stringify(run));
  } catch {
    // (private browsing: kept for this visit only, by the game)
  }
}

/** The run waiting to be saved, if it can still be saved: {ticket, seed, taps, floor}, else null. */
export function pending() {
  try {
    const run = JSON.parse(localStorage.getItem(pendingKey) ?? 'null');
    if (run && typeof run.ticket === 'string' && Number.isInteger(run.floor) && Array.isArray(run.taps) &&
        Date.now() < expires(run.ticket)) {
      return run;
    }
    localStorage.removeItem(pendingKey);
  } catch {
    // (nothing kept)
  }
  return null;
}

export function clearPending() {
  try {
    localStorage.removeItem(pendingKey);
  } catch {
    // (nothing kept)
  }
}
