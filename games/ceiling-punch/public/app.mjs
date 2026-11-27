import { createRun, step, tap, TICK, WIDTH } from './engine.mjs';
import { drawScene, MIN_HEIGHT } from './render.mjs';
import * as feel from './feel.mjs';

const board = document.getElementById('board');
const strike = document.getElementById('strike');
const score = document.getElementById('floor');
const bestScore = document.getElementById('best');
const status = document.getElementById('status');
const overlay = document.getElementById('overlay');
const soundButton = document.getElementById('sound');
const fullButton = document.getElementById('full');
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
let view = { scale: 1, offset: 0, height: MIN_HEIGHT, ratio: 1 };

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
  if (to === 'lost') (run.impact.reason === 'flooded' ? feel.splash : feel.miss)();
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
  if (tap(run)) updateInterface();
}

// tap anywhere: the game, the start card, the button
for (const surface of [board, overlay]) {
  surface.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    if (event.target.closest?.('a, .icon')) return;
    event.preventDefault();
    takeInput();
  });
}
strike.addEventListener('click', event => {
  if (event.detail === 0) takeInput(); // (a keyboard press on the button)
});
window.addEventListener('keydown', event => {
  if (event.code !== 'Space' || event.target.closest?.('a, input, textarea, .icon') ||
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
      step(run);
      availableTime -= TICK;
    }
    updateInterface();
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
