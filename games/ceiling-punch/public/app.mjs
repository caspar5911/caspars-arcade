import { createRun, step, tap, TICK, WIDTH } from './engine.mjs';
import { drawScene, HEIGHT } from './render.mjs';

const board = document.getElementById('board');
const strike = document.getElementById('strike');
const score = document.getElementById('floor');
const bestScore = document.getElementById('best');
const status = document.getElementById('status');
const context = board.getContext('2d');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const storageKey = 'ceiling-punch-best';
const run = createRun(Math.floor(Math.random() * 2 ** 32)); // a new tower each time you play
let best = readBest();
let previousFrame;
let availableTime = 0;
let previousPhase;

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

function updateInterface() {
  if (run.phase === previousPhase) return;
  updateScore();
  strike.dataset.phase = run.phase;
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
    case 'lost':
      strike.textContent = 'Try again';
      status.textContent = run.impact.reason === 'flooded' ? `The flood caught you on floor ${run.floor}. Punch sooner!`
        : run.impact.reason === 'early' ? `Too early: solid concrete before the crack. Floor ${run.floor}.`
          : `Too late: solid concrete after the crack. Floor ${run.floor}.`;
      break;
  }
  previousPhase = run.phase;
}

function takeInput() {
  if (tap(run)) updateInterface();
}

for (const surface of [board, strike]) {
  surface.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    takeInput();
  });
}
strike.addEventListener('click', event => {
  if (event.detail === 0) takeInput();
});
window.addEventListener('keydown', event => {
  if (event.code !== 'Space' || event.target.closest?.('a, input, textarea') ||
      event.ctrlKey || event.altKey || event.metaKey) return;
  event.preventDefault();
  if (!event.repeat) takeInput();
});
window.addEventListener('storage', event => {
  if (event.key !== storageKey) return;
  best = Math.max(best, readBest());
  bestScore.textContent = best;
});

function resize() {
  const scale = Math.min(devicePixelRatio || 1, 2);
  board.width = Math.round(WIDTH * scale);
  board.height = Math.round(HEIGHT * scale);
  context.setTransform(board.width / WIDTH, 0, 0, board.height / HEIGHT, 0, 0);
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
    drawScene(context, run, motion.matches, time / 1000);
  } else {
    availableTime = 0;
  }
  requestAnimationFrame(frame);
}

window.addEventListener('resize', resize);
resize();
updateInterface();
requestAnimationFrame(frame);
