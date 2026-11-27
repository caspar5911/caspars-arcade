import { FINAL_FLOOR } from './engine.mjs';

export const CHECKPOINT_STEP = 25;
export const PROGRESS_KEY = 'snap-ruler-progress';

export function checkpointFor(floor) {
  return Math.floor(floor / CHECKPOINT_STEP) * CHECKPOINT_STEP;
}

export function loadProgress(raw, legacy) {
  const oldBest = Number(legacy);
  const best = Number.isSafeInteger(oldBest) && oldBest >= 0 && oldBest <= 10 ? oldBest : 0;
  try {
    const stored = JSON.parse(raw);
    if (!Number.isSafeInteger(stored?.best) || stored.best < 0 || stored.best > FINAL_FLOOR) {
      return { best, checkpoint: 0 };
    }
    const unlocked = checkpointFor(stored.best);
    const checkpoint = Number.isSafeInteger(stored.checkpoint) && stored.checkpoint >= 0 &&
      stored.checkpoint <= unlocked && stored.checkpoint % CHECKPOINT_STEP === 0
      ? stored.checkpoint : unlocked;
    return { best: stored.best, checkpoint };
  } catch {
    return { best, checkpoint: 0 };
  }
}
