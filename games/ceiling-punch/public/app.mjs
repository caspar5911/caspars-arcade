import { createRun, FLOOD_GAP_MAX, step, tap, TICK, WIDTH } from './engine.mjs';
import { drawScene, MIN_HEIGHT } from './render.mjs';
import * as feel from './feel.mjs';
import * as music from './music.mjs';
import * as lb from './leaderboard.mjs';

const board = document.getElementById('board');
const strike = document.getElementById('strike');
const score = document.getElementById('floor');
const bestScore = document.getElementById('best');
const status = document.getElementById('status');
const overlay = document.getElementById('overlay');
const soundButton = document.getElementById('sound');
const fullButton = document.getElementById('full');
const saveForm = document.getElementById('save');
const nameInput = document.getElementById('name');
const saveButton = document.getElementById('saveButton');
const saveNote = document.getElementById('saveNote');
const boardPanel = document.getElementById('leaderboard');
const boardList = document.getElementById('boardList');
const showBoardButton = document.getElementById('showBoard');
const context = board.getContext('2d');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const coarse = matchMedia('(pointer: coarse)');
const storageKey = 'ceiling-punch-best';
const run = createRun(Math.floor(Math.random() * 2 ** 32)); // a new tower each time you play
let best = readBest();
let previousFrame;
let availableTime = 0;
let previousPhase;
let previousDirection = run.direction;
let landedAt = -1e9; // (for the landing squash)
let warnedFloor = -1; // (the flood warning, once a floor)
let danger = 0; // 🎵 how close the water is, smoothed (the music follows it)
let view = { scale: 1, offset: 0, height: MIN_HEIGHT, ratio: 1 };
// 🏆 this run, for the leaderboard: its ticket (null: started offline), engine ticks since the start, and the taps
let currentTicket = null;
let nextTicket = null;
let fetchingTicket = false;
let ticks = 0;
let taps = [];
let boardData = null;
let boardTab = 'week';

function readBest() {
  try {
    const value = Number(localStorage.getItem(storageKey));
    if (Number.isInteger(value) && value >= 0 && value <= 100000) return value;
  } catch {
    // The current run still works in private browsing.
  }
  return 0;
}

function updateScore() {
  score.textContent = run.floor;
  if (run.floor > best) {
    best = Math.max(readBest(), run.floor);
    try {
      localStorage.setItem(storageKey, String(best));
    } catch {
      // Save the score in memory for the current session.
    }
  }
  bestScore.textContent = best;
}

/** Sounds and buzzes for what just happened (a phase change). */
function react(from, to) {
  if (to === 'running' && (from === 'ready' || from === 'lost')) feel.start();
  if (to === 'smash') (run.impact.cleared === 2 ? feel.double : feel.smash)();
  if (to === 'running' && from === 'smash') landedAt = performance.now();
  if (to === 'lost') {
    (run.impact.reason === 'flooded' ? feel.splash : feel.miss)();
    music.stop(false, run.impact.reason === 'flooded'); // (caught by the water: the music sinks)
  }
  if (to === 'running' && (from === 'ready' || from === 'lost')) danger = 0;
}

function updateInterface() {
  if (run.phase === previousPhase) return;
  if (previousPhase !== undefined) react(previousPhase, run.phase);
  updateScore();
  strike.dataset.phase = run.phase;
  overlay.dataset.show = String(run.phase === 'ready' || run.phase === 'lost');
  switch (run.phase) {
    case 'ready':
      strike.textContent = 'Start';
      status.textContent = 'The robot never stops. Punch through a crack before the flood catches you.';
      break;
    case 'running':
      strike.textContent = 'Punch';
      if (previousPhase === 'ready' || previousPhase === 'lost') {
        status.textContent = 'Punch through a crack. Gold breaks two floors and sends the flood back.';
      }
      break;
    case 'smash':
      strike.textContent = 'Punch';
      status.textContent = run.impact.cleared === 2 ? 'Double smash! The flood falls back.' : 'Smash! Keep climbing.';
      break;
    case 'lost': {
      strike.textContent = 'Try again';
      offerSave();
      const record = run.floor > 0 && run.floor >= best ? ' New best!' : '';
      status.textContent = (run.impact.reason === 'flooded' ? `Splash! The flood caught you on floor ${run.floor}.`
        : run.impact.reason === 'early' ? `Too early: solid concrete before the crack. Floor ${run.floor}.`
          : `Too late: solid concrete after the crack. Floor ${run.floor}.`) + record;
      break;
    }
  }
  previousPhase = run.phase;
}

function takeInput() {
  feel.unlock(); // (sound is only allowed after a tap)
  if (run.phase === 'ready' && coarse.matches) goFullScreen(); // (on a phone, the first start fills the screen)
  const before = run.phase;
  if (before === 'running') taps.push(ticks); // (a punch, after this many engine ticks: the server replays it)
  if (!tap(run)) return;
  if (before === 'ready' || before === 'lost') startRun();
  updateInterface();
}

/** A new run: its tower comes from the server's ticket when there is one (so it can go on the board). */
function startRun() {
  currentTicket = nextTicket;
  nextTicket = null;
  if (currentTicket) run.seed = currentTicket.seed >>> 0; // (before any step: the tower is made from the seed)
  ticks = 0;
  taps = [];
  saveForm.hidden = true;
  boardPanel.hidden = true;
  showNote('');
  refillTicket();
}

function refillTicket() {
  if (nextTicket || fetchingTicket || !lb.available()) return;
  fetchingTicket = true;
  lb.ticket().then(t => {
    nextTicket = t;
  }).finally(() => {
    fetchingTicket = false;
  });
}

function showNote(text, bad = false) {
  saveNote.textContent = text;
  saveNote.dataset.bad = String(bad);
}

/** After a run: offer to save it (or say why it can't be). */
function offerSave() {
  boardPanel.hidden = true;
  if (!lb.available()) return;
  showBoardButton.hidden = false;
  if (run.floor <= 0) {
    saveForm.hidden = true;
    return;
  }
  if (!currentTicket) {
    saveForm.hidden = true;
    showNote("This run started while the leaderboard was offline, so it can't be saved.", true);
    return;
  }
  saveForm.hidden = false;
  saveButton.disabled = false;
  if (!nameInput.value) nameInput.value = lb.savedName();
}

saveForm.addEventListener('submit', async event => {
  event.preventDefault();
  const name = nameInput.value.trim();
  if (name.length < 2) {
    showNote('Type a name (2 to 16 letters or numbers).', true);
    nameInput.focus();
    return;
  }
  if (!currentTicket || run.phase !== 'lost') return;
  saveButton.disabled = true;
  showNote('Saving…');
  try {
    const board = await lb.save({ ticket: currentTicket.ticket, seed: currentTicket.seed, taps, floor: run.floor, name });
    lb.rememberName(board.name ?? name);
    nameInput.value = board.name ?? name;
    currentTicket = null; // (saved once)
    saveForm.hidden = true;
    const mine = (board.week ?? []).find(x => x.you);
    showNote(mine ? `Saved! You're #${mine.place} this week.` : 'Saved! Keep climbing to reach the top 10.');
    showBoard(board, 'week');
  } catch (error) {
    saveButton.disabled = false;
    showNote(error.message, true);
  }
});

function showBoard(board, tab = boardTab) {
  boardData = board;
  boardTab = tab;
  boardPanel.hidden = false;
  for (const b of boardPanel.querySelectorAll('[data-tab]')) b.setAttribute('aria-pressed', String(b.dataset.tab === tab));
  const rows = board[tab] ?? [];
  boardList.replaceChildren();
  if (!rows.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = tab === 'week' ? 'No one yet this week: be the first!' : 'No scores yet: be the first!';
    boardList.append(li);
    return;
  }
  for (const row of rows) {
    const li = document.createElement('li');
    if (row.you) li.dataset.you = 'true';
    for (const [cls, text] of [['place', row.place + '.'], ['who', row.name], ['floor', 'Floor ' + row.floor]]) {
      const span = document.createElement('span');
      span.className = cls;
      span.textContent = text; // (names are shown as text, never as page code)
      li.append(span);
    }
    boardList.append(li);
  }
}

for (const b of boardPanel.querySelectorAll('[data-tab]')) {
  b.addEventListener('click', () => boardData && showBoard(boardData, b.dataset.tab));
}

showBoardButton.addEventListener('click', async () => {
  showBoardButton.disabled = true;
  try {
    showBoard(await lb.top(lb.savedName()));
  } catch (error) {
    showNote(error.message, true);
  } finally {
    showBoardButton.disabled = false;
  }
});

lb.connect().then(ok => {
  showBoardButton.hidden = !ok;
  if (ok) refillTicket();
});

// tap anywhere: the game, the start card, the button
for (const surface of [board, overlay]) {
  surface.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    if (event.target.closest?.('a, .icon')) return;
    if (event.target.closest?.('.card') && !event.target.closest('#strike')) return; // (the name box, the board)
    event.preventDefault();
    takeInput();
  });
}
// 🔊 phones only allow sound after a finished tap (finger lifted) or a click: wake it then too
for (const type of ['pointerup', 'touchend', 'click', 'keydown']) {
  window.addEventListener(type, () => feel.unlock(), { capture: true, passive: true });
}
strike.addEventListener('click', event => {
  if (event.detail === 0) takeInput(); // (a keyboard press on the button)
});
window.addEventListener('keydown', event => {
  if (event.code !== 'Space' || event.target.closest?.('a, input, textarea, .icon, form, #leaderboard, .link') ||
      event.ctrlKey || event.altKey || event.metaKey) return;
  event.preventDefault();
  if (!event.repeat) takeInput();
});
window.addEventListener('storage', event => {
  if (event.key !== storageKey) return;
  best = Math.max(best, readBest());
  bestScore.textContent = best;
});

// 🔊 sound on or off (remembered)
function showSound() {
  const off = feel.isMuted();
  // (drawn, not emoji: every phone shows it)
  soundButton.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">' +
    '<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/>' +
    (off
      ? '<path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'
      : '<path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>') +
    '</svg>';
  soundButton.setAttribute('aria-label', off ? 'Sound off' : 'Sound on');
  soundButton.setAttribute('aria-pressed', String(!off));
}
soundButton.addEventListener('click', () => {
  feel.unlock();
  feel.setMuted(!feel.isMuted());
  showSound();
});
showSound();

// ⛶ full screen (where the browser allows it; the game already fills the window)
function goFullScreen() {
  const root = document.documentElement;
  if (document.fullscreenElement || !root.requestFullscreen) return;
  root.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
}
if (!document.documentElement.requestFullscreen) fullButton.hidden = true;
fullButton.addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else goFullScreen();
});

/** Fit the tower to the screen: full width on a phone, full height (centred) on a wide screen. */
function resize() {
  const width = innerWidth;
  const height = innerHeight;
  const ratio = Math.min(devicePixelRatio || 1, 2);
  const scale = Math.min(width / WIDTH, height / MIN_HEIGHT);
  view = { scale, offset: (width - WIDTH * scale) / 2, height: height / scale, ratio };
  board.width = Math.round(width * ratio);
  board.height = Math.round(height * ratio);
}

function frame(time) {
  const elapsed = Math.min(.05, (time - (previousFrame ?? time)) / 1000);
  previousFrame = time;
  if (!document.hidden) {
    availableTime += elapsed;
    while (availableTime >= TICK) {
      if (run.phase === 'running' || run.phase === 'smash') ticks++;
      step(run);
      availableTime -= TICK;
    }
    updateInterface();
    // 🎵 the chase music: starts with a run (once sound is allowed), follows the water
    if (run.phase === 'running' || run.phase === 'smash') {
      if (!music.playing()) music.start(feel.output());
      danger += (music.dangerFrom(run.floor - run.flood, FLOOD_GAP_MAX) - danger) * Math.min(1, elapsed * 3);
      music.update(danger, run.floor);
    }
    if (run.phase === 'running') {
      if (run.direction !== previousDirection) feel.bounce();
      if (run.floor - run.flood < .7 && warnedFloor !== run.floor) {
        warnedFloor = run.floor;
        feel.warn();
      }
    }
    previousDirection = run.direction;
    // the space beside the tower (on a wide screen), then the tower
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#151a22';
    context.fillRect(0, 0, board.width, board.height);
    const { scale, offset, height, ratio } = view;
    context.setTransform(scale * ratio, 0, 0, scale * ratio, offset * ratio, 0);
    drawScene(context, run, {
      reducedMotion: motion.matches,
      time: time / 1000,
      height,
      landed: (time - landedAt) / 1000,
    });
  } else {
    availableTime = 0;
  }
  requestAnimationFrame(frame);
}

window.addEventListener('resize', resize);
resize();
updateInterface();
requestAnimationFrame(frame);
