import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { availableBuild, reloadUrl } from '../src/updates.mjs';

test('only a newer valid release offers a reload', () => {
  assert.equal(availableBuild('41', { build: 42 }), 42);
  assert.equal(availableBuild('41', { build: 41 }), null);
  assert.equal(availableBuild('41', { build: 40 }), null);
  assert.equal(availableBuild('41', { build: '42' }), null);
  assert.equal(availableBuild('development', { build: 42 }), null);
});

test('the update reload keeps the challenge and requests a fresh document', () => {
  const current = 'https://example.com/RuleReaper/?v=41#v2=tutorial:RR';
  assert.equal(reloadUrl(current, 42), 'https://example.com/RuleReaper/?v=42#v2=tutorial:RR');
});

test('a Pages build stamps the document, serves the manifest and ships versioned modules', async t => {
  const output = await mkdtemp(join(tmpdir(), 'rule-reaper-build-'));
  t.after(() => rm(output, { recursive: true }));
  const result = spawnSync(process.execPath, ['scripts/build-pages.mjs', '42', output], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const manifest = JSON.parse(await readFile(join(output, 'version.json'), 'utf8'));
  const index = await readFile(join(output, 'index.html'), 'utf8');
  assert.deepEqual(manifest, { build: 42 });
  assert.match(index, /name="rulereaper-build" content="42"/);
  assert.match(index, /href="\.\/assets\/42\/style\.css"/);
  assert.match(index, /src="\.\/assets\/42\/app\.mjs"/);
  for (const asset of ['app.mjs', 'challenges.mjs', 'engine.mjs', 'updates.mjs', 'style.css']) {
    assert.ok((await readFile(join(output, 'assets', '42', asset))).length > 0, asset);
  }
});
