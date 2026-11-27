import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeHtml, gameSlug } from './game-files.mjs';

const [, , slug = '', titleArg = ''] = process.argv;
const title = titleArg.trim();
if (!gameSlug.test(slug) || !title) {
  throw new Error('Usage: node scripts/new-game.mjs <kebab-case-slug> "Game Title"');
}

const games = fileURLToPath(new URL('../games/', import.meta.url));
const folder = join(games, slug);
const publicFiles = join(folder, 'public');
await mkdir(folder);
await mkdir(publicFiles);

const safeTitle = escapeHtml(title);
const page = '<!doctype html>\n<html lang="en">\n<head>\n' +
  '  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width,initial-scale=1">\n' +
  '  <title>' + safeTitle + '</title>\n</head>\n<body>\n' +
  '  <nav><a href="../../">All games</a></nav>\n  <main><h1>' + safeTitle + '</h1></main>\n' +
  '</body>\n</html>\n';
await writeFile(join(publicFiles, 'index.html'), page);
await writeFile(join(folder, 'game.json'), JSON.stringify({ title, summary: '', status: 'draft' }, null, 2) + '\n');
console.log('Draft created in games/' + slug + '/.');
