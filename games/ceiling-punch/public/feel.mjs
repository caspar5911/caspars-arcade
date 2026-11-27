// Sound and vibration for Ceiling Punch. Every sound is made here with Web Audio (no files to download).
// Sound starts on the first tap (browsers only allow audio after a tap) and can be muted; the choice is saved.
// Vibration works where the phone allows it (most Android phones; not iPhones).

const muteKey = 'ceiling-punch-muted';
let audio = null;
let master = null;
let muted = readMuted();

function readMuted() {
  try {
    return localStorage.getItem(muteKey) === '1';
  } catch {
    return false;
  }
}

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = value;
  try {
    localStorage.setItem(muteKey, value ? '1' : '0');
  } catch {
    // (private browsing: the choice lasts for this visit)
  }
  if (master) master.gain.value = muted ? 0 : .8;
}

/** Call on a tap: creates (or wakes) the audio, which browsers only allow after the player touches the page. */
export function unlock() {
  try {
    if (!audio) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return;
      audio = new Context();
      master = audio.createGain();
      master.gain.value = muted ? 0 : .8;
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

/** The audio output (for the music), once sound is unlocked: { audio, out }, else null. Mute applies to it too. */
export function output() {
  return audio && master && audio.state === 'running' ? { audio, out: master } : null;
}

let noiseBuffer = null;
function noise() {
  if (!noiseBuffer) {
    noiseBuffer = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const source = audio.createBufferSource();
  source.buffer = noiseBuffer;
  return source;
}

/** A tone that falls or rises, with a quick fade. */
function tone(type, from, to, seconds, volume, delay = 0) {
  const t = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + seconds);
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(.0001, t + seconds);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + seconds + .02);
}

/** A burst of filtered noise (crunch, splash, debris). */
function hiss(filterType, from, to, seconds, volume, delay = 0) {
  const t = audio.currentTime + delay;
  const source = noise();
  const filter = audio.createBiquadFilter();
  const gain = audio.createGain();
  filter.type = filterType;
  filter.frequency.setValueAtTime(from, t);
  filter.frequency.exponentialRampToValueAtTime(Math.max(40, to), t + seconds);
  filter.Q.value = 1.2;
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(.0001, t + seconds);
  source.connect(filter).connect(gain).connect(master);
  source.start(t, Math.random() * .5);
  source.stop(t + seconds + .02);
}

function buzz(pattern) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch {
    // (no vibration here)
  }
}

/** A punch through a crack: a thud and a concrete crunch. */
export function smash() {
  buzz(18);
  if (!ready()) return;
  tone('sine', 140, 45, .18, .9);
  hiss('lowpass', 2400, 300, .22, .55);
  hiss('bandpass', 900, 500, .12, .35, .03);
}

/** A gold double smash: two crunches and a rising chime. */
export function double() {
  buzz([20, 40, 35]);
  if (!ready()) return;
  tone('sine', 150, 45, .2, .95);
  hiss('lowpass', 2600, 300, .24, .6);
  hiss('lowpass', 2200, 260, .22, .5, .09);
  tone('triangle', 520, 1040, .25, .22, .05);
  tone('triangle', 780, 1560, .3, .16, .14);
}

/** Solid concrete: a clang and a jolt. */
export function miss() {
  buzz(120);
  if (!ready()) return;
  tone('square', 220, 160, .25, .2);
  tone('square', 333, 240, .2, .12);
  tone('sine', 90, 40, .3, .7);
}

/** The flood got you. */
export function splash() {
  buzz([60, 40, 90]);
  if (!ready()) return;
  hiss('lowpass', 3000, 200, .7, .7);
  hiss('bandpass', 600, 1800, .4, .3, .05);
  tone('sine', 260, 70, .5, .35);
}

/** The flood is close: a short warning beep. */
export function warn() {
  buzz(10);
  if (!ready()) return;
  tone('square', 880, 860, .07, .08);
  tone('square', 880, 860, .07, .08, .12);
}

/** Bouncing off a wall: a soft tick. */
export function bounce() {
  if (!ready()) return;
  tone('triangle', 300, 200, .05, .08);
}

/** Starting a run. */
export function start() {
  buzz(12);
  if (!ready()) return;
  tone('triangle', 330, 660, .12, .15);
  tone('triangle', 495, 990, .14, .1, .07);
}
