import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test('a draft is excluded from Pages until it is marked playable', async t => {
  const workspace = await mkdtemp(join(tmpdir(), 'arcade-scaffold-'));
  t.after(() => rm(workspace, { recursive: true, force: true }));
  for (const directory of ['scripts', 'hub', 'games']) {
    await cp(resolve(directory), join(workspace, directory), { recursive: true });
  }
  await cp(resolve('.nojekyll'), join(workspace, '.nojekyll'));

  const run = (...args) => spawnSync(process.execPath, args, { cwd: workspace, encoding: 'utf8' });
  const created = run('scripts/new-game.mjs', 'test-arcade', 'Test & Arcade');
  assert.equal(created.status, 0, created.stderr);
  assert.notEqual(run('scripts/new-game.mjs', 'test-arcade', 'Overwrite').status, 0);
  assert.notEqual(run('scripts/new-game.mjs', '../outside', 'Unsafe slug').status, 0);
  const folder = join(workspace, 'games', 'test-arcade');
  const metadata = JSON.parse(await readFile(join(folder, 'game.json'), 'utf8'));
  assert.equal(metadata.status, 'draft');
  assert.match(await readFile(join(folder, 'public', 'index.html'), 'utf8'), /Test &amp; Arcade/);

  const draft = run('scripts/build-pages.mjs', '100', '_draft');
  assert.equal(draft.status, 0, draft.stderr);
  assert.doesNotMatch(await readFile(join(workspace, '_draft', 'index.html'), 'utf8'), /test-arcade/);
  await assert.rejects(readFile(join(workspace, '_draft', 'games', 'test-arcade', 'index.html')), { code: 'ENOENT' });

  metadata.status = 'playable';
  metadata.summary = 'A playable test game.';
  await writeFile(join(folder, 'game.json'), JSON.stringify(metadata));
  await writeFile(join(folder, 'public', '.env'), 'example');
  const playable = run('scripts/build-pages.mjs', '101', '_playable');
  assert.equal(playable.status, 0, playable.stderr);
  assert.match(await readFile(join(workspace, '_playable', 'index.html'), 'utf8'), /href="\.\/games\/test-arcade\/"/);
  assert.match(await readFile(join(workspace, '_playable', 'games', 'test-arcade', 'index.html'), 'utf8'), /Test &amp; Arcade/);
  await assert.rejects(readFile(join(workspace, '_playable', 'games', 'test-arcade', '.env')), { code: 'ENOENT' });
});
