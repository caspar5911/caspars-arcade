import { LEGACY_BOARD, candidates, checkPath, direction, normalizeRules } from './engine.mjs';
import { BOARDS, TUTORIAL, challengeHash, parseChallenge, ruleExplanation, ruleLabel } from './challenges.mjs';
import { watchForUpdates } from './updates.mjs';

const $ = id => document.getElementById(id);
let board = TUTORIAL;
let rules = [];
let path = [];
let ghost = [];
let ghostStop;
let blocked = [];
let message = '';
const mazeButtons = new Map();

for (const maze of BOARDS) {
  const button = document.createElement('button');
  button.textContent = maze.name;
  button.addEventListener('click', () => {
    if (maze !== board) openMaze(maze);
  });
  $('mazes').append(button);
  mazeButtons.set(maze, button);
}

const cells = Array.from({ length: 25 }, (_, index) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.addEventListener('click', () => attempt(index));
  $('grid').append(button);
  return button;
});

function challengeUrl() {
  const url = new URL(location.href);
  url.searchParams.delete('v');
  url.hash = challengeHash(board, rules);
  return url.href;
}

function updateHash() {
  const url = new URL(location.href);
  url.hash = challengeHash(board, rules);
  history.replaceState(null, '', url);
}

function restart() {
  path = [board.start];
  blocked = [];
}

function load() {
  try {
    ({ board, rules } = parseChallenge(location.hash));
    message = '';
  } catch (error) {
    ({ board, rules } = parseChallenge(''));
    message = error.message + ' Opened First escape instead.';
  }
  ghost = [];
  ghostStop = undefined;
  restart();
  render();
}

function openMaze(maze) {
  board = maze;
  rules = [];
  ghost = [];
  ghostStop = undefined;
  message = '';
  restart();
  updateHash();
  render();
  $('mazeTitle').focus();
}

function legalMove(from, to) {
  return direction(from, to) && checkPath([...path, to], rules, false, board).ok;
}

function attempt(tile) {
  if (path.at(-1) === board.exit) return;
  const next = [...path, tile];
  const result = checkPath(next, rules, false, board);
  blocked = result.tiles ?? [];
  if (!result.ok) {
    message = result.pair ? ruleExplanation(result.pair) : result.reason;
    render();
    return;
  }
  path = next;
  const won = tile === board.exit;
  message = won ? 'You reached the exit.' : '';
  if (!won && ![tile - 5, tile + 5, tile - 1, tile + 1].some(to => legalMove(tile, to))) {
    message = 'Dead end. Undo a move and try another route.';
  }
  render();
  if (won) $('winTitle').focus();
}

function addRuleLabel(element, rule, isChoice = false) {
  const { arrows, text } = ruleLabel(rule);
  const icon = document.createElement('span');
  icon.className = 'rule-arrows';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = arrows;
  const words = document.createElement('span');
  words.textContent = isChoice ? 'Ban ' + text : ruleExplanation(rule);
  element.append(icon, words);
}

function reap(rule) {
  rules = normalizeRules([...rules, rule]);
  const failure = checkPath(path, rules, true, board);
  ghostStop = failure.tiles[2];
  ghost = path.slice(0, path.indexOf(ghostStop));
  restart();
  message = ruleExplanation(rule) + ' Find another way to the exit.';
  updateHash();
  render();
  cells[board.start].focus();
}

function renderWin(won) {
  $('win').hidden = !won;
  $('choices').replaceChildren();
  $('nextMaze').hidden = true;
  if (!won) return;

  const options = candidates(path, rules, 100000, board).filter(option => option.status === 'solved');
  const next = BOARDS[BOARDS.indexOf(board) + 1];
  const tutorialCleared = board === TUTORIAL && rules.length > 0;
  $('winTitle').textContent = tutorialCleared ? 'You found another way out.' : 'You escaped.';
  $('winHelp').textContent = tutorialCleared
    ? 'Try the next maze, or ban another move pattern here.'
    : options.length
      ? 'Ban two moves you made in a row. Then try to escape the same maze with that rule.'
      : 'This route has no more moves you can ban. Share the maze or choose another.';
  if (tutorialCleared && !options.length) $('winHelp').textContent = 'You’re ready for the next maze.';
  for (const { rule } of options) {
    const button = document.createElement('button');
    addRuleLabel(button, rule, true);
    button.addEventListener('click', () => reap(rule));
    $('choices').append(button);
  }
  if (board !== LEGACY_BOARD && next && (board !== TUTORIAL || tutorialCleared || !options.length)) {
    $('nextMaze').textContent = 'Play ' + next.name;
    $('nextMaze').onclick = () => openMaze(next);
    $('nextMaze').hidden = false;
  }
}

function renderCell(tile, position, won) {
  const cell = cells[tile];
  const isWall = board.walls.includes(tile);
  const isCurrent = position === tile;
  const visited = path.includes(tile);
  const isExit = tile === board.exit;
  const isStart = tile === board.start;
  cell.className = 'cell';
  cell.classList.toggle('wall', isWall);
  cell.classList.toggle('visited', visited);
  cell.classList.toggle('current', isCurrent);
  cell.classList.toggle('exit', isExit);
  cell.classList.toggle('legal', !won && Boolean(legalMove(position, tile)));
  cell.classList.toggle('ghost', ghost.includes(tile));
  cell.classList.toggle('ghost-stop', ghostStop === tile);
  cell.classList.toggle('blocked', blocked.includes(tile));
  cell.classList.toggle('blocked-target', blocked.at(-1) === tile);
  cell.disabled = isWall;
  cell.textContent = isCurrent ? 'You' : isExit ? 'Exit' : isStart ? 'Start' : visited ? '•' : '';

  const labels = ['Row ' + (Math.floor(tile / 5) + 1), 'column ' + (tile % 5 + 1)];
  if (isWall) labels.push('wall');
  if (isStart) labels.push('start');
  if (isExit) labels.push('exit');
  if (isCurrent) labels.push('your position');
  else if (visited) labels.push('visited');
  if (ghostStop === tile) labels.push('old route breaks here');
  if (blocked.includes(tile)) labels.push('part of a blocked move pattern');
  cell.setAttribute('aria-label', labels.join(', '));
}

function render() {
  const position = path.at(-1);
  const won = position === board.exit;
  $('mazeTitle').textContent = board.name;
  for (const [maze, button] of mazeButtons) {
    button.setAttribute('aria-pressed', String(maze === board));
  }
  $('moves').textContent = path.length - 1;
  $('count').textContent = rules.length + ' / 8';
  $('rules').replaceChildren();
  for (const rule of rules) {
    const tag = document.createElement('div');
    tag.className = 'rule';
    addRuleLabel(tag, rule);
    $('rules').append(tag);
  }
  $('help').textContent = ghost.length
    ? 'The dashed trail is your old route. The × marks where the new rule stops it.'
    : board === TUTORIAL && !rules.length
      ? 'Tap the squares to the right or use the arrow keys to reach the exit.'
      : 'Tap a neighboring square or use the arrow keys. Visit each square once.';
  cells.forEach((_, tile) => renderCell(tile, position, won));
  $('status').textContent = message;
  $('undo').disabled = path.length <= 1;
  $('fresh').disabled = rules.length === 0;
  $('shareLink').value = challengeUrl();
  $('shareStatus').hidden = true;
  renderWin(won);
}

$('undo').onclick = () => {
  path.pop();
  blocked = [];
  message = 'Move undone.';
  render();
};
$('reset').onclick = () => {
  restart();
  message = 'Back at the start.';
  render();
};
$('fresh').onclick = () => openMaze(board);
$('share').onclick = async () => {
  try {
    await navigator.clipboard.writeText(challengeUrl());
    $('shareStatus').textContent = 'Challenge link copied.';
  } catch {
    $('shareLink').focus();
    $('shareLink').select();
    $('shareStatus').textContent = 'Select and copy the link manually.';
  }
  $('shareStatus').hidden = false;
};
window.addEventListener('hashchange', load);
window.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey ||
      ['INPUT', 'TEXTAREA'].includes(event.target?.tagName)) return;
  const move = { ArrowUp: -5, ArrowDown: 5, ArrowLeft: -1, ArrowRight: 1, w: -5, s: 5, a: -1, d: 1 }[event.key];
  if (move === undefined) return;
  event.preventDefault();
  attempt(path.at(-1) + move);
});

load();
watchForUpdates($('reloadVersion'));
