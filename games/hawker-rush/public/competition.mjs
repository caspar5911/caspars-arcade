import { FIRST_DAILY, daily, dayKey, speedRun } from './engine.mjs';

const engine = 1;
const challengeFormat = /^hr2\.(daily|speed)\.(\d{4}-\d{2}-\d{2})\.(0|[1-9]\d*)$/;
const boardPath = '/ai/arcade/hawker-rush/';
let connection;

function shiftFor(mode, key) {
  const date = new Date(key + 'T00:00:00Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== key) return null;
  if (mode === 'daily' && key >= FIRST_DAILY) return daily(key).spec;
  if (mode === 'speed' && date.getUTCDay() === 1) return speedRun(date).spec;
  return null;
}

function validValue(mode, value) {
  return Number.isSafeInteger(value) && value >= (mode === 'speed' ? 1 : 0);
}

/** Recreate the same shift on any device. The target is for friendly play. */
export function parseChallenge(href, now = new Date()) {
  const tokens = new URL(href).searchParams.getAll('challenge');
  if (tokens.length !== 1 || tokens[0].length > 38) return null;
  const match = challengeFormat.exec(tokens[0]);
  if (!match) return null;
  const [, mode, key, rawValue] = match;
  const spec = shiftFor(mode, key);
  const value = Number(rawValue);
  if (!spec || key > dayKey(now) || !validValue(mode, value)) return null;
  return { mode, key, value, spec };
}

export function challengeUrl({ mode, key, value }, href) {
  if (!shiftFor(mode, key) || !validValue(mode, value)) throw new Error('Invalid Hawker Rush challenge.');
  const url = new URL(href);
  url.search = new URLSearchParams({ challenge: ['hr2', mode, key, value].join('.') }).toString();
  url.hash = '';
  return url.href;
}

async function findServer() {
  try {
    const response = await fetch('../../arcade-config.json', { cache: 'no-store', signal: AbortSignal.timeout(4000) });
    if (!response.ok) return null;
    const { server } = await response.json();
    const url = new URL(server);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null;
    return url.origin + url.pathname.replace(/\/$/, '');
  } catch {
    return null;
  }
}

async function getServer() {
  const pending = connection ??= findServer();
  const server = await pending;
  if (!server && connection === pending) connection = null;
  return server;
}

function boardError(message = "Can't reach the leaderboard right now.") {
  return new Error(message);
}

async function call(path, body, timeout) {
  const server = await getServer();
  if (!server) throw boardError();
  let response;
  try {
    response = await fetch(server + boardPath + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    });
  } catch {
    throw boardError();
  }
  const data = await response.json().catch(() => null);
  if (response.status === 429) throw boardError('Too many tries. Wait a moment.');
  if (!response.ok || !data) {
    throw boardError(typeof data?.detail === 'string' && data.detail ? data.detail : undefined);
  }
  return data;
}

export async function startRankedRun(mode, key) {
  try {
    const data = await call('ticket', { mode, engine }, 3500);
    if (data.mode !== mode || data.period !== key || data.engine !== engine ||
        typeof data.ticket !== 'string' || !data.ticket) return null;
    return { ticket: data.ticket, mode, key };
  } catch {
    return null;
  }
}

function board(data, mode, key) {
  if (data.mode !== mode || data.period !== key || !Array.isArray(data.entries)) {
    throw boardError('That leaderboard period is no longer available.');
  }
  return {
    mode,
    key,
    entries: data.entries.filter(entry => entry && typeof entry.name === 'string' && validValue(mode, entry.value)),
  };
}

export async function readBoard(mode, key) {
  const data = await call('top', { mode }, 6000);
  return board(data, mode, key);
}

export async function submitScore({ ticket, mode, key, actions, name, value }) {
  const data = await call('score', { ticket, engine, mode, period: key, actions, name, value }, 12000);
  return { ...board(data, mode, key), saved: data.saved, name: data.name, value: data.value };
}
