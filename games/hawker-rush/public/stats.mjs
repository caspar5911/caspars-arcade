// 📊 Anonymous play stats, to balance the game from real play: which day you reach, stars, customers served and lost,
// how long you play. A random id made on this phone (no name, account or address), sent in the background (never in
// the way of a shift), skipped on a local copy of the game, and off if the player says "Don't" in More settings.
import { arcadeServer } from './competition.mjs';

const OPT_KEY = 'hawker-rush-stats';
const ID_KEY = 'hawker-rush-anon-id';

export function statsOn() {
  try {
    return localStorage.getItem(OPT_KEY) !== 'off';
  } catch {
    return false;
  }
}

export function setStats(on) {
  try {
    localStorage.setItem(OPT_KEY, on ? 'on' : 'off');
    if (!on) localStorage.removeItem(ID_KEY); // (switching off forgets this phone's id too)
  } catch {
    // (nothing kept)
  }
}

function phoneId() {
  let id = localStorage.getItem(ID_KEY);
  if (!/^[A-Za-z0-9_-]{16,40}$/.test(id ?? '')) {
    const bytes = crypto.getRandomValues(new Uint8Array(18));
    id = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    localStorage.setItem(ID_KEY, id);
  }
  return id;
}

const build = () => Number(document.querySelector('meta[name="hawker-rush-build"]')?.content);

/** Sends one event: { event: 'open' | 'shift', level, theme, ...for a shift: mode, stars, served, lost, seconds, quit, players }. */
export async function sendStat(event) {
  try {
    if (!statsOn() || !Number.isSafeInteger(build()) || build() <= 0) return; // (a local copy: never counted)
    const server = await arcadeServer();
    if (!server) return;
    await fetch(server + '/ai/arcade/hawker-rush/stats', {
      method: 'POST', headers: { 'content-type': 'application/json' }, keepalive: true,
      body: JSON.stringify({ id: phoneId(), build: build(), ...event }), signal: AbortSignal.timeout(5000),
    });
  } catch {
    // (offline, or the server's busy: it doesn't matter)
  }
}
