import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { availableBuild, reloadUrl } from '../games/rulereaper/public/src/updates.mjs';
import { legacyGameUrl } from '../hub/legacy.mjs';

test('only a newer valid release offers a reload', () => {
  assert.equal(availableBuild('41', { build: 42 }), 42);
  assert.equal(availableBuild('41', { build: 41 }), null);
  assert.equal(availableBuild('41', { build: 40 }), null);
  assert.equal(availableBuild('41', { build: '42' }), null);
  assert.equal(availableBuild('development', { build: 42 }), null);
});

test('the update reload keeps the game path and challenge', () => {
  const current = 'https://example.com/RuleReaper/games/rulereaper/?v=41#v2=tutorial:RR';
  assert.equal(reloadUrl(current, 42), 'https://example.com/RuleReaper/games/rulereaper/?v=42#v2=tutorial:RR');
});

test('old challenge links and reload links reach the game without losing parameters', () => {
  const base = 'https://example.com/RuleReaper/';
  for (const tail of ['#v1=LD', '#v2=tutorial:RR', '?v=10', '?v=42#v2=tutorial:RR']) {
    assert.equal(legacyGameUrl(base + tail), base + 'games/rulereaper/' + tail);
  }
  assert.equal(legacyGameUrl(base), null);
  assert.equal(legacyGameUrl(base + '#games'), null);
});

test('the Pages artifact contains a hub and a versioned RuleReaper game', async t => {
  const output = await mkdtemp(join(tmpdir(), 'arcade-build-'));
  t.after(() => rm(output, { recursive: true }));
  const result = spawnSync(process.execPath, ['scripts/build-pages.mjs', '42', output], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);

  const hub = await readFile(join(output, 'index.html'), 'utf8');
  assert.match(hub, /<h1>Caspar.s Arcade<\/h1>/);
  assert.match(hub, /href="\.\/games\/rulereaper\/"/);
  assert.match(hub, /src="\.\/assets\/42\/legacy\.mjs"/);
  assert.ok((await readFile(join(output, 'games', 'rulereaper', 'cover.png'))).length > 0);

  const game = join(output, 'games', 'rulereaper');
  const index = await readFile(join(game, 'index.html'), 'utf8');
  assert.match(index, /name="rulereaper-build" content="42"/);
  assert.match(index, /src="\.\/assets\/42\/app\.mjs"/);
  assert.match(index, /href="\.\.\/\.\.\/"[^>]*>All games/);
  for (const path of [output, game]) {
    const manifest = JSON.parse(await readFile(join(path, 'version.json'), 'utf8'));
    assert.deepEqual(manifest, { build: 42 });
  }
  for (const asset of ['app.mjs', 'challenges.mjs', 'engine.mjs', 'updates.mjs', 'style.css']) {
    assert.ok((await readFile(join(game, 'assets', '42', asset))).length > 0, asset);
  }
  const snap = join(output, 'games', 'snap-ruler');
  const snapIndex = await readFile(join(snap, 'index.html'), 'utf8');
  assert.match(snapIndex, /name="snap-ruler-build" content="42"/);
  assert.match(snapIndex, /src="\.\/assets\/42\/app\.mjs"/);
  assert.match(snapIndex, /1,000/);
  for (const asset of ['app.mjs', 'engine.mjs', 'progress.mjs', 'render.mjs', 'style.css']) {
    assert.ok((await readFile(join(snap, 'assets', '42', asset))).length > 0, asset);
  }
  const punch = join(output, 'games', 'ceiling-punch');
  assert.match(hub, /href="\.\/games\/ceiling-punch\/"/);
  assert.match(await readFile(join(punch, 'index.html'), 'utf8'), /<h1>Ceiling <em>Punch<\/em><\/h1>/);
  for (const asset of ['app.mjs', 'engine.mjs', 'render.mjs', 'style.css', 'cover.png']) {
    assert.ok((await readFile(join(punch, asset))).length > 0, asset);
  }
});

test('the leaderboard server comes from the build, never the repo', async t => {
  const output = await mkdtemp(join(tmpdir(), 'arcade-build-'));
  t.after(() => rm(output, { recursive: true }));
  const env = { ...process.env, ARCADE_SERVER: 'https://scores.example.com/' };
  let result = spawnSync(process.execPath, ['scripts/build-pages.mjs', '7', output], { encoding: 'utf8', env });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(await readFile(join(output, 'arcade-config.json'), 'utf8')), { server: 'https://scores.example.com' });
  const plain = { ...process.env };
  delete plain.ARCADE_SERVER;
  result = spawnSync(process.execPath, ['scripts/build-pages.mjs', '8', output], { encoding: 'utf8', env: plain });
  assert.equal(result.status, 0, result.stderr);
  await assert.rejects(readFile(join(output, 'arcade-config.json')), 'no server, no config');
  result = spawnSync(process.execPath, ['scripts/build-pages.mjs', '9', output],
    { encoding: 'utf8', env: { ...plain, ARCADE_SERVER: 'http://insecure.example.com' } });
  assert.notEqual(result.status, 0, 'only https');
});
