import assert from 'node:assert/strict';
import test from 'node:test';
import {
  challengeUrl, parseChallenge, readBoard, startRankedRun, submitScore,
} from '../games/hawker-rush/public/competition.mjs';
import { daily, speedRun } from '../games/hawker-rush/public/engine.mjs';

const gameUrl = 'https://arcade.example/games/hawker-rush/?previous=1#top';
const dailyKey = '2026-11-27';
const speedKey = '2026-11-23';

test('friend challenges carry the exact shared shift and score in integer hundredths', () => {
  const now = new Date('2026-11-28T00:00:00Z');
  for (const [mode, key, value, spec] of [
    ['daily', dailyKey, 6451, daily(dailyKey).spec],
    ['speed', speedKey, 4308, speedRun(now).spec],
  ]) {
    const url = new URL(challengeUrl({ mode, key, value }, gameUrl));
    assert.equal(url.pathname, '/games/hawker-rush/');
    assert.equal(url.searchParams.size, 1);
    assert.equal(url.hash, '');
    assert.deepEqual(parseChallenge(url, now), { mode, key, value, spec });
  }
});

test('challenge links reject unsupported versions, impossible periods and invalid scores', () => {
  const now = new Date('2026-12-18T00:00:00Z');
  for (const token of [
    'hr1.daily.2026-11-27.23', 'hr2.other.2026-11-27.23', 'hr2.speed.2026-11-24.1200',
    'hr2.speed.2026-11-23.0', 'hr2.daily.2026-12-99.100', 'hr2.daily.2027-01-01.1',
    'hr2.daily.2026-11-27.-5', 'hr2.daily.2026-11-27.1.5', 'hr2.daily.2026-11-27.9007199254740992',
  ]) {
    const url = new URL(gameUrl);
    url.searchParams.set('challenge', token);
    assert.equal(parseChallenge(url, now), null, token);
  }
  const duplicate = new URL('?challenge=hr2.daily.2026-11-27.200&challenge=hr2.daily.2026-11-27.100', gameUrl);
  assert.equal(parseChallenge(duplicate, now), null);
  assert.equal(parseChallenge(gameUrl, now), null);
});

test('online scores use the dated server ticket and the complete action log', async t => {
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url === '../../arcade-config.json') {
      return requests.length ? Response.json({ server: 'https://arcade.example/base/' }) : new Response('', { status: 404 });
    }
    const name = url.replace('https://arcade.example/base/ai/arcade/hawker-rush/', '');
    const body = JSON.parse(options.body);
    requests.push([name, body]);
    if (name === 'ticket') return Response.json({ mode: 'daily', period: dailyKey, engine: 2, ticket: 'test-ticket' });
    const data = { mode: 'daily', period: dailyKey, entries: [{ name: 'Mei', place: 1, value: 650 }] };
    return Response.json(name === 'score' ? { ...data, saved: true, name: 'Mei', value: 650 } : data);
  });

  assert.equal(await startRankedRun('daily', dailyKey), null);
  requests.push(['retry']);
  const ticket = await startRankedRun('daily', dailyKey);
  assert.deepEqual(ticket, { mode: 'daily', key: dailyKey, ticket: 'test-ticket' });
  assert.equal(await startRankedRun('speed', speedKey), null);
  const actions = [[1, 'base', 'cup', -1]];
  const result = await submitScore({ ...ticket, actions, name: 'Mei', value: 650 });
  assert.equal(result.saved, true);
  assert.deepEqual(result.entries, [{ name: 'Mei', place: 1, value: 650 }]);
  assert.deepEqual((await readBoard('daily', dailyKey)).entries, result.entries);
  await assert.rejects(() => readBoard('daily', '2026-11-28'), /no longer available/);
  assert.deepEqual(requests.slice(1), [
    ['ticket', { mode: 'daily', engine: 2 }],
    ['ticket', { mode: 'speed', engine: 2 }],
    ['score', { ticket: 'test-ticket', engine: 2, mode: 'daily', period: dailyKey, actions, name: 'Mei', value: 650 }],
    ['top', { mode: 'daily' }],
    ['top', { mode: 'daily' }],
  ]);
});
