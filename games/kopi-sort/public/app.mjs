import { daily, dayKey, DRINKS, full, level, LEVELS, pour, pourCount, solved, stars, topRun } from './engine.mjs';
import * as feel from './feel.mjs';

const $ = id => document.getElementById(id);
const menu = $('menu'), play = $('play'), win = $('win'), board = $('board');
const where = $('where'), movesLabel = $('moves'), hint = $('hint');
const progressKey = 'kopi-sort-progress';

// ---------------------------------------------------------------------------------------------------- progress
function load() {
  try {
    const p = JSON.parse(localStorage.getItem(progressKey) ?? '{}');
    return { stars: p.stars ?? {}, unlocked: Math.max(1, p.unlocked ?? 1), daily: p.daily ?? {}, streak: p.streak ?? {} };
  } catch {
    return { stars: {}, unlocked: 1, daily: {}, streak: {} };
  }
}

function save() {
  try {
    localStorage.setItem(progressKey, JSON.stringify(progress));
  } catch {
    // (private browsing: kept for this visit)
  }
}

const progress = load();

// ---------------------------------------------------------------------------------------------------- the game
let game = null; // { mode: 'level'|'daily', n, puzzle, trays, history: [[from, to, cups]], moves, selected }

function start(mode, n) {
  const puzzle = mode === 'daily' ? daily(n) : level(n);
  game = { mode, n, puzzle, trays: puzzle.trays.map(t => t.slice()), history: [], moves: 0, selected: null };
  menu.hidden = true;
  win.hidden = true;
  play.hidden = false;
  where.textContent = mode === 'daily' ? `Daily #${puzzle.number}` : `Level ${n}`;
  hint.textContent = 'Tap a tray, then tap where to pour.';
  render();
}

function render(arrived = -1, cups = 0) {
  movesLabel.textContent = `${game.moves} moves · par ${game.puzzle.par}`;
  $('undo').disabled = game.history.length === 0;
  board.replaceChildren();
  game.trays.forEach((tray, i) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'tray' + (game.selected === i ? ' selected' : '') + (full(tray) ? ' done' : '');
    el.dataset.tray = String(i);
    el.setAttribute('aria-label', `Tray ${i + 1}: ` + (tray.length ? tray.map(d => DRINKS[d].name).join(', ') : 'empty'));
    const lift = game.selected === i ? topRun(tray) : 0;
    tray.forEach((d, j) => {
      const cup = document.createElement('div');
      const drink = DRINKS[d];
      cup.className = 'cup' + (j >= tray.length - lift ? ' lift' : '') +
        (i === arrived && j >= tray.length - cups ? ' arrive' : '');
      cup.style.background = drink.color;
      cup.style.color = drink.ink;
      cup.textContent = drink.label;
      el.append(cup);
    });
    el.addEventListener('click', () => tapTray(i));
    board.append(el);
  });
}

function tapTray(i) {
  feel.unlock();
  const tray = game.trays[i];
  if (game.selected === null) {
    if (!tray.length || full(tray)) return;
    game.selected = i;
    feel.pick();
    render();
    return;
  }
  if (game.selected === i) {
    game.selected = null;
    render();
    return;
  }
  const from = game.selected;
  const n = pourCount(game.trays, from, i);
  if (!n) {
    // not allowed here: pick this tray up instead if it has cups, else a little bump
    feel.nope();
    const el = board.querySelector(`[data-tray="${i}"]`);
    el?.classList.add('nope');
    if (tray.length && !full(tray)) {
      game.selected = i;
      setTimeout(render, 220);
    }
    hint.textContent = tray.length >= 4 ? 'That tray is full.' : 'Only onto the same drink, or an empty tray.';
    return;
  }
  pour(game.trays, from, i);
  game.history.push([from, i, n]);
  game.moves++;
  game.selected = null;
  hint.textContent = '';
  feel.pourSound(n);
  render(i, n);
  if (full(game.trays[i])) setTimeout(feel.trayDone, 160);
  if (solved(game.trays)) setTimeout(finish, 450);
}

function undo() {
  const last = game.history.pop();
  if (!last) return;
  const [from, to, n] = last;
  for (let k = 0; k < n; k++) game.trays[from].push(game.trays[to].pop());
  game.moves = Math.max(0, game.moves - 1);
  game.selected = null;
  feel.pick();
  render(from, n);
}

function finish() {
  const got = stars(game.moves, game.puzzle.par);
  feel.solvedTune();
  $('winStars').textContent = '☕'.repeat(got) + '·'.repeat(3 - got);
  $('winMoves').textContent = `${game.moves} moves (par ${game.puzzle.par})` +
    (got < 3 ? ` · ${game.puzzle.par} moves for ☕☕☕` : ' · perfect!');
  const shareButton = $('share'), next = $('next');
  if (game.mode === 'level') {
    progress.stars[game.n] = Math.max(progress.stars[game.n] ?? 0, got);
    progress.unlocked = Math.max(progress.unlocked, Math.min(LEVELS, game.n + 1));
    $('winTitle').textContent = game.n === LEVELS ? 'All 20 levels sorted! 🎉' : 'Tray sorted!';
    next.hidden = game.n >= LEVELS;
    next.textContent = 'Next level';
    shareButton.hidden = true;
  } else {
    const first = progress.daily.day !== game.puzzle.day;
    if (first) {
      // the day's result is the first solve; a streak counts days in a row
      const yesterday = dayKey(new Date(Date.parse(game.puzzle.day + 'T12:00:00+08:00') - 86400000));
      progress.streak = { last: game.puzzle.day, count: progress.streak.last === yesterday ? (progress.streak.count ?? 0) + 1 : 1 };
      progress.daily = { day: game.puzzle.day, moves: game.moves, stars: got, number: game.puzzle.number };
    }
    $('winTitle').textContent = `Daily #${game.puzzle.number} sorted!`;
    next.hidden = true;
    shareButton.hidden = false;
  }
  save();
  win.hidden = false;
}

async function share() {
  const d = progress.daily;
  const text = `Kopi Sort #${d.number} ☕\n${'☕'.repeat(d.stars)}${'·'.repeat(3 - d.stars)} ${d.moves} moves` +
    `${progress.streak.count > 1 ? ` · 🔥${progress.streak.count} days` : ''}\n${location.href.split('#')[0]}`;
  try {
    if (navigator.share) {
      await navigator.share({ text });
      return;
    }
    await navigator.clipboard.writeText(text);
    $('share').textContent = 'Copied! Paste it to your friends';
  } catch {
    // (share sheet closed)
  }
}

// ---------------------------------------------------------------------------------------------------- the menu
function showMenu() {
  game = null;
  play.hidden = true;
  win.hidden = true;
  menu.hidden = false;
  where.textContent = 'Kopi Sort';
  movesLabel.textContent = '';
  const today = dayKey();
  const done = progress.daily.day === today;
  $('dailyInfo').textContent = done
    ? `Done! ${'☕'.repeat(progress.daily.stars)} in ${progress.daily.moves} moves · tap to play again`
    : 'Same puzzle for everyone today';
  const streakAlive = progress.streak.last === today ||
    progress.streak.last === dayKey(new Date(Date.now() - 86400000));
  $('streak').textContent = streakAlive && progress.streak.count > 1 ? `🔥 ${progress.streak.count}-day streak` : '';
  const grid = $('levels');
  grid.replaceChildren();
  for (let n = 1; n <= LEVELS; n++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.disabled = n > progress.unlocked;
    if (n === progress.unlocked) b.className = 'current';
    const s = progress.stars[n] ?? 0;
    b.innerHTML = `<span>${n}</span><small>${n > progress.unlocked ? '🔒' : s ? '☕'.repeat(s) : ''}</small>`;
    b.setAttribute('aria-label', `Level ${n}` + (n > progress.unlocked ? ', locked' : s ? `, ${s} stars` : ''));
    b.addEventListener('click', () => start('level', n));
    grid.append(b);
  }
}

// ---------------------------------------------------------------------------------------------------- buttons
$('dailyCard').addEventListener('click', () => start('daily', dayKey()));
$('undo').addEventListener('click', undo);
$('restart').addEventListener('click', () => start(game.mode, game.n));
$('toMenu').addEventListener('click', showMenu);
$('winMenu').addEventListener('click', showMenu);
$('next').addEventListener('click', () => start('level', game.n + 1));
$('share').addEventListener('click', share);
for (const type of ['pointerup', 'touchend', 'click', 'keydown']) {
  window.addEventListener(type, () => feel.unlock(), { capture: true, passive: true });
}

const soundButton = $('sound');
function showSound() {
  const off = feel.isMuted();
  soundButton.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">' +
    '<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/>' +
    (off
      ? '<path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'
      : '<path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>') +
    '</svg>';
  soundButton.setAttribute('aria-label', off ? 'Sound off' : 'Sound on');
}
soundButton.addEventListener('click', () => {
  feel.unlock();
  feel.setMuted(!feel.isMuted());
  showSound();
});
showSound();
showMenu();
