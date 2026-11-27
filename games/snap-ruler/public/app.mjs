import { beginHold, cancelHold, createRun, FINAL_FLOOR, finishHold, RULERS, step, TICK, WIDTH } from './engine.mjs';
import { drawArena, HEIGHT } from './render.mjs';

const canvas = document.getElementById('board');
const launch = document.getElementById('launch');
const action = document.getElementById('action');
const status = document.getElementById('status');
const floor = document.getElementById('floor');
const bestScore = document.getElementById('best');
const context = canvas.getContext('2d');
const bestKey = 'snap-ruler-best';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

let run = createRun();
let best = readBest();
let camera = 0;
let flash = 0;
let pointerId = null;
let spaceDown = false;
let previousTime;
let elapsed = 0;
let lastPhase;
let lastFloor;
let lastHolding;

function readBest() {
  try {
    const stored = Number(localStorage.getItem(bestKey));
    if (Number.isSafeInteger(stored) && stored >= 0 && stored <= FINAL_FLOOR) return stored;
  } catch {
    // A private browsing context can disable storage.
  }
  return 0;
}

function updateScore() {
  floor.textContent = run.floor;
  if (run.floor > best) {
    best = run.floor;
    try {
      localStorage.setItem(bestKey, String(best));
    } catch {
      // Keep the score in memory for this session.
    }
  }
  bestScore.textContent = best;
}

function display() {
  if (run.floor !== lastFloor) {
    if (run.floor > lastFloor) {
      flash = .36;
      status.textContent = run.floor - lastFloor === 2 ? 'Two floors in one shot.' : 'Floor ' + run.floor + ' reached.';
    }
    updateScore();
  }
  if (run.phase !== lastPhase) {
    launch.dataset.phase = run.phase;
    switch (run.phase) {
      case 'ready':
        status.textContent = 'Land on the next ruler, or aim high and skip a floor.';
        break;
      case 'lost':
        status.textContent = run.reason === 'off-tip'
          ? 'The marble rolled off the tip. Release earlier.'
          : 'The marble missed the ruler. Try a different hold or release point.';
        break;
      case 'won':
        status.textContent = 'Ten floors cleared.';
        break;
    }
  }
  if (run.phase !== lastPhase || run.holding !== lastHolding) {
    action.textContent = run.phase === 'lost' ? 'Try again'
    : run.phase === 'won' ? 'Play again'
    : run.phase === 'flight' ? 'Marble in flight'
    : run.holding ? 'Release to launch'
      : 'Hold to bend · Release to launch';
  }
  launch.style.setProperty('--charge', run.charge.toFixed(3));
  lastPhase = run.phase;
  lastFloor = run.floor;
  lastHolding = run.holding;
}

function press() {
  if (run.phase === 'lost' || run.phase === 'won') {
    run = createRun();
    camera = 0;
    flash = 0;
    display();
    return false;
  }
  return beginHold(run);
}

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
  if (event.code !== 'Space' || event.target.closest?.('a, input, textarea') ||
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
