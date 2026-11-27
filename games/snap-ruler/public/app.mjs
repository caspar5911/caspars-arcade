import { beginHold, cancelHold, createRun, FINAL_FLOOR, finishHold, RULERS, step, TICK, WIDTH } from './engine.mjs';
import { drawArena, HEIGHT } from './render.mjs';
import { CHECKPOINT_STEP, checkpointFor, loadProgress, PROGRESS_KEY } from './progress.mjs';

const canvas = document.getElementById('board');
const launch = document.getElementById('launch');
const action = document.getElementById('action');
const status = document.getElementById('status');
const floor = document.getElementById('floor');
const bestScore = document.getElementById('best');
const context = canvas.getContext('2d');
const checkpointText = document.getElementById('checkpoint');
const restartButton = document.getElementById('restart');
const format = new Intl.NumberFormat('en');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

let { best, checkpoint } = readProgress();
let retryFloor = checkpoint;
let run = createRun(retryFloor);
let camera = run.y;
let flash = 0;
let pointerId = null;
let spaceDown = false;
let previousTime;
let elapsed = 0;
let lastPhase;
let lastFloor;
let lastHolding;

function readProgress() {
  try {
    return loadProgress(localStorage.getItem(PROGRESS_KEY), localStorage.getItem('snap-ruler-best'));
  } catch {
    return { best: 0, checkpoint: 0 };
  }
}

function syncProgress() {
  try {
    const stored = readProgress();
    best = Math.max(best, stored.best);
    checkpoint = Math.max(checkpoint, stored.checkpoint);
    if (best > stored.best || checkpoint > stored.checkpoint) {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify({ best, checkpoint }));
    }
  } catch {
    // Keep the score and checkpoint in memory for this session.
  }
}

function renderProgress() {
  bestScore.textContent = format.format(best);
  checkpointText.textContent = checkpoint > 0
    ? 'Saved checkpoint ' + format.format(checkpoint)
    : 'Checkpoint every ' + CHECKPOINT_STEP + ' floors';
  restartButton.hidden = run.floor === 0 || checkpoint === 0;
}

function updateScore() {
  floor.textContent = format.format(run.floor);
  const reached = checkpointFor(run.floor);
  const save = run.floor > best || reached > checkpoint;
  best = Math.max(best, run.floor);
  checkpoint = Math.max(checkpoint, reached);
  retryFloor = Math.max(retryFloor, reached);
  if (save) syncProgress();
  renderProgress();
}

window.addEventListener('storage', event => {
  if (event.key !== PROGRESS_KEY || event.newValue === null) return;
  syncProgress();
  renderProgress();
});

function missMessage(reason) {
  if (reason === 'off-tip') return 'The marble rolled off the tip. Release earlier.';
  if (reason === 'long') return 'Overshot the ruler. Release sooner for a shorter shot.';
  return 'Came up short. Hold a little longer or release farther along.';
}

function display() {
  if (run.floor !== lastFloor) {
    if (run.floor > lastFloor) {
      flash = .36;
      if (checkpointFor(run.floor) > retryFloor && run.floor !== FINAL_FLOOR) {
        status.textContent = 'Checkpoint reached at floor ' + format.format(checkpointFor(run.floor)) + '.';
      } else {
        status.textContent = run.floor - lastFloor === 2
          ? 'Two floors in one shot.'
          : 'Floor ' + format.format(run.floor) + ' reached.';
      }
    }
    updateScore();
  }
  if (run.phase !== lastPhase) {
    launch.dataset.phase = run.phase;
    switch (run.phase) {
      case 'ready':
        status.textContent = run.floor > 0
          ? 'Ready at checkpoint ' + format.format(run.floor) + '.'
          : 'Land on the next ruler, or aim for the marked strip to skip a floor.';
        break;
      case 'lost':
        status.textContent = missMessage(run.reason);
        break;
      case 'won':
        status.textContent = 'Tower cleared. You reached floor ' + format.format(FINAL_FLOOR) + '!';
        break;
    }
  }
  if (run.phase !== lastPhase || run.holding !== lastHolding) {
    if (run.phase === 'lost') {
      action.textContent = retryFloor > 0 ? 'Retry from floor ' + format.format(retryFloor) : 'Try again';
    } else if (run.phase === 'won') {
      action.textContent = 'Start a new climb';
    } else if (run.phase === 'flight') {
      action.textContent = 'Marble in flight';
    } else if (run.phase === 'settling') {
      action.textContent = 'Marble settling';
    } else {
      action.textContent = run.holding ? 'Release to launch' : 'Hold to bend · Release to launch';
    }
  }
  launch.style.setProperty('--charge', run.charge.toFixed(3));
  lastPhase = run.phase;
  lastFloor = run.floor;
  lastHolding = run.holding;
}

function restart(start) {
  cancelInput();
  retryFloor = start;
  run = createRun(start);
  camera = run.y;
  flash = 0;
  display();
}

function press() {
  if (run.phase === 'lost' || run.phase === 'won') {
    restart(run.phase === 'won' ? 0 : retryFloor);
    return false;
  }
  return beginHold(run);
}

restartButton.addEventListener('click', () => {
  restart(0);
  launch.focus();
});

for (const surface of [canvas, launch]) {
  surface.addEventListener('pointerdown', event => {
    if (event.button !== 0 || pointerId !== null || spaceDown) return;
    event.preventDefault();
    if (!press()) return;
    pointerId = event.pointerId;
    surface.setPointerCapture(pointerId);
  });
  surface.addEventListener('pointerup', event => {
    if (pointerId !== event.pointerId) return;
    pointerId = null;
    finishHold(run);
  });
  surface.addEventListener('pointercancel', event => {
    if (pointerId !== event.pointerId) return;
    pointerId = null;
    cancelHold(run);
  });
}
launch.addEventListener('click', event => {
  if (event.detail === 0 && press()) finishHold(run);
});

window.addEventListener('keydown', event => {
  if (event.code !== 'Space' || event.target.closest?.('a, input, textarea, #restart') ||
      event.ctrlKey || event.altKey || event.metaKey) return;
  event.preventDefault();
  if (event.repeat || pointerId !== null) return;
  spaceDown = press();
});
window.addEventListener('keyup', event => {
  if (event.code !== 'Space' || !spaceDown) return;
  event.preventDefault();
  spaceDown = false;
  finishHold(run);
});
function cancelInput() {
  spaceDown = false;
  pointerId = null;
  cancelHold(run);
}
window.addEventListener('blur', cancelInput);
document.addEventListener('visibilitychange', cancelInput);

function resize() {
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(WIDTH * scale);
  canvas.height = Math.round(HEIGHT * scale);
  context.setTransform(canvas.width / WIDTH, 0, 0, canvas.height / HEIGHT, 0, 0);
}

function frame(time) {
  const delta = Math.min(.05, (time - (previousTime ?? time)) / 1000);
  previousTime = time;
  if (!document.hidden) {
    elapsed += delta;
    while (elapsed >= TICK) {
      step(run);
      elapsed -= TICK;
    }
    const target = Math.max(RULERS[run.floor].y, run.y - 105);
    camera += (target - camera) * (reducedMotion ? 1 : Math.min(1, delta * 8));
    flash = Math.max(0, flash - delta);
    display();
    drawArena(context, run, { camera, best, flash });
  } else {
    elapsed = 0;
  }
  requestAnimationFrame(frame);
}

window.addEventListener('resize', resize);
resize();
display();
requestAnimationFrame(frame);
