// 🏪 Hawker Rush accounts: sign in to keep your progress on any phone (and safe if the browser is cleared).
// Its own accounts (nothing to do with Hawker Haggle's), on the same server as the leaderboards. The phone keeps its
// login and which copy of the progress it has (`rev`); the progress itself stays in the game's usual save.
import { arcadeServer } from './competition.mjs';

const KEY = 'hawker-rush-account';
const GUEST_KEY = 'hawker-rush-save-guest'; // (this phone's own progress from before signing in, back on logging out)

export class AccountError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.status = status;
  }
}

/** The login on this phone: { token, username, rev, dirty } or null. */
export function current() {
  try {
    const a = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return a && typeof a.token === 'string' && a.token.startsWith('hr_') && typeof a.username === 'string'
      ? { token: a.token, username: a.username, rev: Number.isSafeInteger(a.rev) ? a.rev : 0, dirty: a.dirty === true } : null;
  } catch {
    return null;
  }
}

export function remember(a) {
  try {
    if (a) localStorage.setItem(KEY, JSON.stringify(a));
    else localStorage.removeItem(KEY);
  } catch {
    // (just for this visit)
  }
}

export function keepGuestCopy(data) {
  try {
    if (data && !localStorage.getItem(GUEST_KEY)) localStorage.setItem(GUEST_KEY, data);
  } catch {
    // (nothing to keep)
  }
}

/** This phone's own progress from before signing in (and forget it), or null. */
export function takeGuestCopy() {
  try {
    const data = localStorage.getItem(GUEST_KEY);
    localStorage.removeItem(GUEST_KEY);
    return data;
  } catch {
    return null;
  }
}

async function call(path, body = {}, token = null) {
  const server = await arcadeServer();
  if (!server) throw new AccountError('Can’t reach the game server right now. Check your connection and try again.');
  let response;
  try {
    response = await fetch(server + '/ai/arcade/hawker-rush/' + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
      body: JSON.stringify(body), signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new AccountError('Can’t reach the game server right now. Check your connection and try again.');
  }
  let data = {};
  try {
    data = await response.json();
  } catch {
    // (no body)
  }
  if (!response.ok) throw new AccountError(typeof data.detail === 'string' ? data.detail : 'Something went wrong. Try again.', response.status);
  return data;
}

export const signup = (username, password) => call('account/signup', { username, password });
export const login = (username, password) => call('account/login', { username, password });
export const logout = token => call('account/logout', {}, token).catch(() => {});
export const changePassword = (token, old, next) => call('account/password', { old, new: next }, token);
export const deleteAccount = (token, password) => call('account/delete', { password }, token);
export const load = token => call('progress', {}, token);
export const store = (token, data, rev) => call('progress/save', { data, rev }, token);
