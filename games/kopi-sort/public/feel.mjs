// Sounds and buzzes for Kopi Sort, made with Web Audio (no files). Sound starts after the first tap (browsers only
// allow it then); mute is remembered. Vibration where the phone allows it.

const muteKey = 'kopi-sort-muted';
let audio = null;
let master = null;
let muted = (() => {
  try {
    return localStorage.getItem(muteKey) === '1';
  } catch {
    return false;
  }
})();

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = value;
  try {
    localStorage.setItem(muteKey, value ? '1' : '0');
  } catch {
    // (private browsing)
  }
  if (master) master.gain.value = muted ? 0 : .9;
}

export function unlock() {
  try {
    if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback';
  } catch {
    // (not supported)
  }
  try {
    if (!audio) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return;
      audio = new Context();
      master = audio.createGain();
      master.gain.value = muted ? 0 : .9;
      master.connect(audio.destination);
    }
    if (audio.state === 'suspended') audio.resume();
  } catch {
    audio = null;
  }
}

function ready() {
  return audio && master && !muted && audio.state === 'running';
}

function buzz(pattern) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch {
    // (no vibration)
  }
}

function tone(type, from, to, seconds, volume, delay = 0) {
  const t = audio.currentTime + delay;
  const o = audio.createOscillator();
  const g = audio.createGain();
  o.type = type;
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(30, to), t + seconds);
  g.gain.setValueAtTime(volume, t);
  g.gain.exponentialRampToValueAtTime(.0001, t + seconds);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + seconds + .02);
}

let noise = null;
function splash(from, to, seconds, volume, delay = 0) {
  if (!noise) {
    noise = audio.createBuffer(1, audio.sampleRate / 2, audio.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = audio.currentTime + delay;
  const s = audio.createBufferSource();
  s.buffer = noise;
  const f = audio.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 3;
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(to, t + seconds);
  const g = audio.createGain();
  g.gain.setValueAtTime(volume, t);
  g.gain.exponentialRampToValueAtTime(.0001, t + seconds);
  s.connect(f).connect(g).connect(master);
  s.start(t, Math.random() * .2);
  s.stop(t + seconds + .02);
}

/** Picking up cups: a light glass clink. */
export function pick() {
  buzz(8);
  if (!ready()) return;
  tone('sine', 2100, 1900, .08, .12);
  tone('sine', 3150, 3000, .06, .05);
}

/** Pouring: a little "glug" per cup. */
export function pourSound(cups = 1) {
  buzz(12);
  if (!ready()) return;
  for (let i = 0; i < cups; i++) {
    splash(900, 300, .12, .5, i * .07);
    tone('sine', 420 - i * 40, 260, .1, .12, i * .07);
  }
}

/** A move that isn't allowed: a soft bump. */
export function nope() {
  buzz([30, 30, 30]);
  if (!ready()) return;
  tone('square', 150, 110, .12, .08);
}

/** A tray full of one drink: a bright ding. */
export function trayDone() {
  buzz(25);
  if (!ready()) return;
  tone('triangle', 1320, 1320, .35, .18);
  tone('sine', 2640, 2640, .3, .06, .02);
}

/** Solved: a happy little tune (C, E, G, C). */
export function solvedTune() {
  buzz([30, 50, 30, 50, 60]);
  if (!ready()) return;
  [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, .25, .17, i * .1));
  tone('sine', 2093, 2093, .5, .05, .42);
}
