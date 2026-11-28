import assert from 'node:assert/strict';
import test from 'node:test';
import * as Co from '../games/hawker-rush/public/coop.mjs';
import * as E from '../games/hawker-rush/public/engine.mjs';

const base = 'https://arcade.example/ai/arcade/hawker-rush/room/';

/** A fake room server: records every call; `pulls` are answered in turn. */
function fakeServer(t, { pulls = [], slowSend = 0 } = {}) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url === '../../arcade-config.json') return Response.json({ server: 'https://arcade.example' });
    const what = url.replace(base, '');
    const body = JSON.parse(options.body);
    calls.push([what, body]);
    if (what === 'create' || what === 'join') {
      return Response.json({ code: 'ABCDE', token: 'token-token-token-1', seat: what === 'create' ? 0 : 1, state: 'lobby', players: [{ seat: 0, name: 'Mei' }] });
    }
    if (what === 'send') {
      if (slowSend) await new Promise(done => setTimeout(done, slowSend));
      return Response.json({ seq: calls.length });
    }
    if (what === 'pull') {
      const next = pulls.shift();
      if (!next) return new Promise(() => {}); // (waits forever: the test is over)
      return next.status ? Response.json({ detail: next.detail }, { status: next.status }) : Response.json(next);
    }
    return Response.json({ ok: true });
  });
  return calls;
}

test('the host’s frames go out in order, merged while one is on its way, never changing the one in flight', async t => {
  const calls = fakeServer(t, { slowSend: 30 });
  await Co.create('Mei');
  Co.send({ t: 'frames', upTo: 10, actions: [[3, 'base', 'cup', -1, 0]] });
  Co.send({ t: 'frames', upTo: 15, actions: [[12, 'add', 'kopi', -1, 1]] });
  Co.send({ t: 'emote', e: 'help' });
  Co.send({ t: 'frames', upTo: 20, actions: [] });
  Co.send({ t: 'frames', upTo: 25, actions: [[22, 'serve', 0, -1, 0]] });
  await new Promise(done => setTimeout(done, 250));
  const sent = calls.filter(([what]) => what === 'send').map(([, body]) => body.msg);
  assert.deepEqual(sent, [
    { t: 'frames', upTo: 10, actions: [[3, 'base', 'cup', -1, 0]] },
    { t: 'frames', upTo: 15, actions: [[12, 'add', 'kopi', -1, 1]] },
    { t: 'emote', e: 'help' },
    { t: 'frames', upTo: 25, actions: [[22, 'serve', 0, -1, 0]] },
  ]);
  await Co.leave();
});

test('listening hears friends, keeps its place, and reports when the stall closes', async t => {
  const calls = fakeServer(t, {
    pulls: [
      { messages: [{ seq: 4, from: 1, t: 'act', kind: 'cook', a: 'toaster', b: -1 }], seq: 5, state: 'playing', players: [] },
      { messages: [], seq: 9, state: 'playing', players: [] },
      { status: 404, detail: 'The stall has closed.' },
    ],
  });
  await Co.join('abcde', 'Bo');
  const heard = [];
  const closed = await new Promise(done => Co.listen({ messages: list => heard.push(...list), closed: done }));
  assert.equal(closed, 'The stall has closed.');
  assert.deepEqual(heard.map(m => m.kind), ['cook']);
  assert.deepEqual(calls.filter(([what]) => what === 'pull').map(([, body]) => body.after), [0, 4, 9]);
  assert.equal(calls[0][1].code, 'ABCDE');
  assert.equal(Co.current(), null);
});

test('a friend’s phone replaying the host’s frames ends with exactly the host’s shift', () => {
  // The host plays (its own and friends' moves) and sends frames at uneven moments; a move made right after a frame
  // (on the frame's last tick) arrives with the next frame. The friend never runs past the last frame it heard.
  const spec = { day: 8, seed: 'coop-test', mode: 'day', players: 2 };
  const host = E.createShift(spec);
  const frames = [];
  let out = [];
  let k = 0, applied = 0;
  while (host.phase === 'running') {
    if (host.ticks % 7 === 3) {
      const moves = [['cook', 'toaster', -1], ['base', 'plate', -1], ['add', 'kaya', -1], ['base', 'cup', -1],
        ['add', 'kopi', -1], ['add', 'milk', -1], ['add', 'toast', -1], ['add', 'butter', -1]];
      for (let i = 0; i < E.prepFor(2); i++) if (E.dishOf(host.prep[i]) && E.servingFor(host, E.dishOf(host.prep[i])) >= 0) moves.unshift(['serve', i, -1]);
      const [kind, a, b] = moves[k++ % moves.length];
      if (E.act(host, kind, a, b)) {
        out.push([host.ticks, kind, a, b, k % 2]);
        applied++;
      }
    }
    if (host.ticks % 5 === 0 || host.ticks % 11 === 0) frames.push({ upTo: host.ticks, actions: out.splice(0) });
    E.step(host);
    host.events.length = 0;
  }
  frames.push({ upTo: host.ticks, actions: out.splice(0) });
  const guest = E.createShift(spec);
  const incoming = [];
  let upTo = 0;
  for (const f of frames) {
    incoming.push(...f.actions);
    upTo = f.upTo;
    while (guest.ticks < upTo && guest.phase === 'running') {
      while (incoming.length && incoming[0][0] <= guest.ticks) {
        const [, kind, a, b] = incoming.shift();
        assert.ok(E.act(guest, kind, a, b));
      }
      E.step(guest);
      guest.events.length = 0;
    }
  }
  assert.equal(guest.phase, 'over');
  for (const key of ['coins', 'served', 'lost', 'passed', 'ticks', 'burnt', 'next', 'earlyBonus']) assert.equal(guest[key], host[key], key);
  assert.ok(applied > 30 && host.served >= 1, `${applied} moves, ${host.served} served`);
});
