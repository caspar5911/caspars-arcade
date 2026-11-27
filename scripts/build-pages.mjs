import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const [, , version, output = '_site'] = process.argv;
const build = Number(version);
if (!Number.isSafeInteger(build) || build <= 0 || String(build) !== version) {
  throw new Error('Pass a positive release number to build-pages.mjs.');
}

const assetUrl = './assets/' + build;
const assets = join(output, 'assets', version);
await mkdir(assets, { recursive: true });

const source = new URL('../', import.meta.url);
const modules = await readdir(new URL('src/', source));
for (const file of modules.filter(name => name.endsWith('.mjs'))) {
  await copyFile(new URL('src/' + file, source), join(assets, file));
}
await copyFile(new URL('style.css', source), join(assets, 'style.css'));

const index = await readFile(new URL('index.html', source), 'utf8');
const page = index
  .replace('name="rulereaper-build" content="development"', 'name="rulereaper-build" content="' + build + '"')
  .replace('./style.css', assetUrl + '/style.css')
  .replace('./src/app.mjs', assetUrl + '/app.mjs');
await writeFile(join(output, 'index.html'), page);
await writeFile(join(output, 'version.json'), JSON.stringify({ build }) + '\n');
await copyFile(new URL('.nojekyll', source), join(output, '.nojekyll'));
