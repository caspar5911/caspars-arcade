// 👫 Co-op: up to four friends share one stall, live, each on their own phone.
// One phone opens a stall (the host) and runs the shift; friends join with its code. Friends' taps go to the host;
// several times a second the host sends every action it has applied (with the tick it happened on), so every phone
// replays exactly the same shift. The arcade server only passes messages along (it keeps rooms in memory).

import { arcadeServer } from './competition.mjs';

const path = '/ai/arcade/hawker-rush/room/';
let room = null; // { code, token, seat, players, state }
let listening = 0;
let queue = [];
let sending = false;

async function call(what, body, timeout = 8000) {
  const server = await arcadeServer();
  if (!server) throw Object.assign(new Error('Co-op needs the arcade server, which isn’t available here.'), { offline: true });
  let response;
  try {
    response = await fetch(server + path + what, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    });
  } catch {
    throw Object.assign(new Error("Can't reach the hawker centre right now."), { offline: true });
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(typeof data?.detail === 'string' ? data.detail : "Can't reach the hawker centre right now.");
    error.status = response.status;
    error.offline = response.status >= 500 || response.status === 429;
    throw error;
  }
  return data;
}

export const current = () => room;

/** Open a stall: you're the host (seat 0). */
export async function create(name) {
  const data = await call('create', { name });
  room = { ...data, after: 0 };
  return room;
}

/** Join a friend's stall with its code. */
export async function join(code, name) {
  const data = await call('join', { code: String(code).trim().toUpperCase(), name });
  room = { ...data, after: 0 };
  return room;
}

/** Send a message; messages go out one at a time, in order (the host's frames are merged while one is on its way). */
export function send(msg) {
  if (!room) return;
  // (never into the message already on its way, and never past what the server accepts in one message)
  const last = queue.length > (sending ? 1 : 0) ? queue[queue.length - 1] : null;
  if (msg.t === 'frames' && last?.t === 'frames' && last.actions.length + msg.actions.length <= 100) {
    last.upTo = msg.upTo;
    last.actions.push(...msg.actions);
  } else queue.push(msg.t === 'frames' ? { ...msg, actions: [...msg.actions] } : msg);
  pump();
}

async function pump() {
  if (sending) return;
  sending = true;
  while (queue.length && room) {
    const msg = queue[0];
    try {
      await call('send', { code: room.code, token: room.token, msg });
      queue.shift();
    } catch (error) {
      if (!error.offline) queue.shift(); // (a refused message is dropped; a lost connection is retried)
      else await new Promise(done => setTimeout(done, 400));
    }
  }
  sending = false;
}

/**
 * Hear the others: `on.messages(list)`, `on.info({players, state})`, `on.closed(reason)`. Returns a stop function.
 * Waits for news with short long-polls, one after another.
 */
export function listen(on) {
  const id = ++listening;
  (async () => {
    let failures = 0;
    while (room && id === listening) {
      try {
        const data = await call('pull', { code: room.code, token: room.token, after: room.after }, 15000);
        if (id !== listening || !room) return;
        failures = 0;
        const list = data.messages ?? [];
        room.after = list.length ? list[list.length - 1].seq : Math.max(room.after, data.seq ?? 0);
        room.players = data.players;
        room.state = data.state;
        on.info?.(data);
        if (list.length) on.messages?.(list);
      } catch (error) {
        if (id !== listening) return;
        if (error.status === 404 || error.status === 403) {
          room = null;
          on.closed?.(error.message);
          return;
        }
        failures++;
        on.trouble?.(failures);
        await new Promise(done => setTimeout(done, Math.min(3000, 300 * failures)));
      }
    }
  })();
  return () => {
    if (id === listening) listening++;
  };
}

/** Leave the stall (the host leaving closes it for everyone). */
export async function leave() {
  const was = room;
  room = null;
  listening++;
  queue = [];
  if (was) await call('leave', { code: was.code, token: was.token }).catch(() => {});
}

export const EMOTES = {
  nice: '👍 Nice!',
  help: '🆘 Help!',
  drinks: '☕ I’ll do drinks',
  cooking: '🍳 I’ll cook',
  hurry: '⏰ Hurry!',
  thanks: '🙏 Thanks!',
};
export const COLOURS = ['#ffcc6f', '#7fd0ff', '#ff8fb8', '#9ce0a1'];
