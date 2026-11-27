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
const refreshBoardButton = document.getElementById('refreshBoard');
const resultBox = document.getElementById('result');
const resultFloor = document.getElementById('resultFloor');
const resultBest = document.getElementById('resultBest');
const resultBadge = document.getElementById('resultBadge');
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
let lostAt = -1e9; // (the calm loop comes back a moment after the splash)
const CARD_DELAY = 950; // ms: the crash or splash plays out before the result card
const TAP_LOCK = 1150; // ms: taps right after losing don't restart (you were tapping fast); the card is up by then
let bestAtStart = 0; // (for "NEW BEST!")
let gameOverTune = null;
let view = { scale: 1, offset: 0, height: MIN_HEIGHT, ratio: 1 };
// 🏆 this run, for the leaderboard: its ticket (null: started offline), engine ticks since the start, and the taps
let currentTicket = null;
let nextTicket = null;
let fetchingTicket = false;
let ticks = 0;
let taps = [];
let boardData = null;
let toSave = null; // the finished run the Save button saves: {ticket, seed, taps, floor} (kept on the phone until saved)
let retryTimer = null; // (saving again by itself while the server is unreachable)
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
    lostAt = performance.now();
    const newBest = run.floor > bestAtStart && run.floor > 0;
    clearTimeout(gameOverTune);
    gameOverTune = setTimeout(() => feel.gameOver(newBest), 700); // (after the crash or splash)
  }
  if (to === 'running' && (from === 'ready' || from === 'lost')) danger = 0;
}

function updateInterface() {
  if (run.phase === previousPhase) return;
  if (previousPhase !== undefined) react(previousPhase, run.phase);
  updateScore();
  strike.dataset.phase = run.phase;
  overlay.dataset.mode = run.phase;
  // (after a run, the card waits for the crash or splash to play out: see frame())
  if (run.phase !== 'lost') overlay.dataset.show = String(run.phase === 'ready');
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
      showResult();
      offerSave();
      status.textContent = run.impact.reason === 'flooded' ? 'Splash! The flood caught you.'
        : run.impact.reason === 'early' ? 'Too early: solid concrete before the crack.'
          : 'Too late: solid concrete after the crack.';
      break;
    }
  }
  previousPhase = run.phase;
}

/** The result on the game-over card: the floor (counting up as the card appears), the best, NEW BEST! */
function showResult() {
  const newBest = run.floor > bestAtStart && run.floor > 0;
  resultBox.hidden = false;
  resultBadge.hidden = !newBest;
  resultBest.textContent = newBest ? (bestAtStart > 0 ? `Your old best was ${bestAtStart}.` : 'Your first record!')
    : `Your best: ${best}`;
  const target = run.floor;
  resultFloor.textContent = '0';
  const begin = performance.now() + CARD_DELAY;
  const count = now => {
    if (run.phase !== 'lost') return;
    const p = Math.min(1, Math.max(0, (now - begin) / 650));
    resultFloor.textContent = String(Math.round(target * (1 - (1 - p) ** 3)));
    if (p < 1) requestAnimationFrame(count);
  };
  requestAnimationFrame(count);
}

function takeInput() {
  // (just lost: the next taps don't restart straight away, so the crash can be seen)
  if (run.phase === 'lost' && performance.now() - lostAt < TAP_LOCK) return;
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
  bestAtStart = best;
  clearTimeout(gameOverTune);
  resultBox.hidden = true;
  if (currentTicket) run.seed = currentTicket.seed >>> 0; // (before any step: the tower is made from the seed)
  ticks = 0;
  taps = [];
  saveForm.hidden = true;
  boardPanel.hidden = true;
  stopRetrying();
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
    // (couldn't reach the server: keep trying quietly, so the next run can still be saved)
    if (!nextTicket) setTimeout(refillTicket, 8000);
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
  const waiting = lb.pending(); // (a score from earlier that couldn't be saved yet)
  if (run.floor <= 0 || !currentTicket) {
    saveForm.hidden = true;
    if (waiting) {
      toSave = waiting;
      openSave(`You still have an unsaved score: Floor ${waiting.floor}. Save it now?`);
      return;
    }
  }
  if (run.floor <= 0) return;
  if (!currentTicket) {
    saveForm.hidden = true;
    showNote("This run started while the leaderboard was offline, so it can't be saved.", true);
    return;
  }
  // this run, kept on the phone until it's saved (so a moment offline never loses it)
  const thisRun = { ticket: currentTicket.ticket, seed: currentTicket.seed >>> 0, taps: [...taps], floor: run.floor };
  currentTicket = null;
  lb.keepPending(thisRun);
  // (an earlier unsaved score that's better than this run: save that one)
  toSave = waiting && waiting.floor > thisRun.floor ? waiting : thisRun;
  openSave(toSave === waiting ? `Your unsaved Floor ${waiting.floor} from earlier is better: save that one?` : '');
}

function openSave(note = '') {
  saveForm.hidden = false;
  saveButton.disabled = false;
  saveButton.textContent = 'Save';
  if (!nameInput.value) nameInput.value = lb.savedName();
  if (note) showNote(note);
}

function stopRetrying() {
  clearTimeout(retryTimer);
  retryTimer = null;
}

async function saveNow(byItself = false) {
  const name = nameInput.value.trim();
  if (!toSave) return;
  if (name.length < 2) {
    if (!byItself) {
      showNote('Type a name (2 to 16 letters or numbers).', true);
      nameInput.focus();
    }
    return;
  }
  stopRetrying();
  lb.rememberName(name); // (remembered now, so a retry later, even after reopening the game, has it)
  saveButton.disabled = true;
  showNote(byItself ? 'Trying again…' : 'Saving…');
  const run = toSave;
  try {
    let board;
    try {
      board = await lb.save({ ...run, name });
    } catch (error) {
      // (it was saved, but the answer got lost on the way back: show the board)
      if (!/already saved/i.test(error.message)) throw error;
      board = { ...(await lb.top(name)), name };
    }
    lb.rememberName(board.name ?? name);
    nameInput.value = board.name ?? name;
    if (toSave === run) toSave = null;
    lb.clearPending();
    saveForm.hidden = true;
    const mine = (board.week ?? []).find(x => x.you);
    showNote(mine ? `Saved! You're #${mine.place} this week.` : 'Saved! Keep climbing to reach the top 10.');
    showBoard(board, 'week');
  } catch (error) {
    saveButton.disabled = false;
    if (error.offline) {
      // not lost: kept on this phone; try again (and keep trying by itself while the card is open)
      saveButton.textContent = 'Try again';
      showNote("Can't reach the leaderboard right now. Your score is kept on this phone: tap Try again, or it will " +
        'try by itself.', true);
      retryTimer = setTimeout(() => {
        if (!saveForm.hidden && overlay.dataset.show === 'true') saveNow(true);
      }, 20000);
    } else {
      // the server said no for good (too old, didn't check out, already saved elsewhere): nothing to keep
      if (!/name/i.test(error.message)) {
        lb.clearPending();
        if (toSave === run) toSave = null;
        saveForm.hidden = true;
      }
      showNote(error.message, true);
    }
  }
}

saveForm.addEventListener('submit', event => {
  event.preventDefault();
  saveNow();
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

async function loadBoard(button) {
  button.disabled = true;
  try {
    showBoard(await lb.top(lb.savedName()));
  } catch (error) {
    showNote(error.offline ? "Can't reach the leaderboard right now. Tap 🔄 Refresh to try again." : error.message, true);
    boardPanel.hidden = false; // (so the Refresh button is there)
  } finally {
    button.disabled = false;
  }
}

showBoardButton.addEventListener('click', () => loadBoard(showBoardButton));
refreshBoardButton.addEventListener('click', () => loadBoard(refreshBoardButton));

lb.connect().then(ok => {
  showBoardButton.hidden = !ok;
  if (!ok) return;
  refillTicket();
  // a score from earlier that couldn't be saved (the server was unreachable): offer it again
  const waiting = lb.pending();
  if (waiting && run.phase === 'ready') {
    toSave = waiting;
    openSave(`You have an unsaved score from earlier: Floor ${waiting.floor}. Save it now?`);
  }
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
    // 🎵 background music, once sound is allowed: the chase during a run (it follows the water), and a calm loop
    // on the start and game-over screens (back a moment after the splash)
    if (run.phase === 'running' || run.phase === 'smash') {
      if (!music.playing()) music.start(feel.output());
      else if (music.isCalm()) music.setCalm(false);
      danger += (music.dangerFrom(run.floor - run.flood, FLOOD_GAP_MAX) - danger) * Math.min(1, elapsed * 3);
      music.update(danger, run.floor);
    } else if (!music.playing() && time - lostAt > 1600) {
      music.start(feel.output(), true);
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
    if (run.phase === 'lost' && overlay.dataset.show !== 'true' && time - lostAt > CARD_DELAY) overlay.dataset.show = 'true';
    drawScene(context, run, {
      reducedMotion: motion.matches,
      time: time / 1000,
      height,
      landed: (time - landedAt) / 1000,
      lost: run.phase === 'lost' ? (time - lostAt) / 1000 : 0,
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
