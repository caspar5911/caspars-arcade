// Sounds, music and buzzes for Hawker Rush, all made with Web Audio (no files). Sound starts after the first tap
// (browsers only allow it then); mute is remembered. Vibration where the phone allows it.

const muteKey = 'hawker-rush-muted';
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
  return audio && master && audio.state === 'running';
}

function buzz(pattern) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch {
    // (no vibration)
  }
}

function tone(type, from, to, seconds, volume, delay = 0, out = master) {
  const t = audio.currentTime + delay;
  const o = audio.createOscillator();
  const g = audio.createGain();
  o.type = type;
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(30, to), t + seconds);
  g.gain.setValueAtTime(.0001, t);
  g.gain.exponentialRampToValueAtTime(volume, t + .005);
  g.gain.exponentialRampToValueAtTime(.0001, t + seconds);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + seconds + .02);
}

let noiseBuf = null;
function hiss(type, from, to, seconds, volume, delay = 0, out = master) {
  if (!noiseBuf) {
    noiseBuf = audio.createBuffer(1, audio.sampleRate / 2, audio.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = audio.currentTime + delay;
  const s = audio.createBufferSource();
  s.buffer = noiseBuf;
  const f = audio.createBiquadFilter();
  f.type = type;
  f.Q.value = 1.5;
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(40, to), t + seconds);
  const g = audio.createGain();
  g.gain.setValueAtTime(volume, t);
  g.gain.exponentialRampToValueAtTime(.0001, t + seconds);
  s.connect(f).connect(g).connect(out);
  s.start(t, Math.random() * .2);
  s.stop(t + seconds + .02);
}

// ---------------------------------------------------------------------------------------------------- sounds
export const sfx = {
  cook() { buzz(8); if (ready()) { tone('square', 520, 380, .06, .06); hiss('highpass', 3000, 2000, .1, .08); } },
  ready() { if (ready()) { tone('sine', 1320, 1320, .12, .12); tone('sine', 1760, 1760, .1, .08, .07); } },
  serve() { buzz(10); if (ready()) { hiss('bandpass', 1400, 500, .15, .25); tone('triangle', 660, 880, .08, .1); } },
  paid(combo = 1) {
    buzz(18);
    if (!ready()) return;
    const up = 2 ** (Math.min(combo, 8) / 12); // (higher with every combo)
    tone('square', 1046 * up, 1046 * up, .08, .09);
    tone('square', 1568 * up, 1568 * up, .18, .08, .07);
    hiss('highpass', 6000, 5000, .12, .06, .02);
  },
  arrive() { if (ready()) { tone('sine', 1975, 1975, .25, .05); tone('sine', 2637, 2637, .3, .03, .1); } },
  burnt() { buzz([40, 40, 40]); if (ready()) { hiss('lowpass', 2500, 300, .5, .35); tone('square', 880, 880, .08, .05, .05); tone('square', 880, 880, .08, .05, .2); } },
  trash() { buzz(15); if (ready()) { hiss('lowpass', 900, 200, .2, .3); tone('square', 140, 90, .15, .08); } },
  angry() { buzz([60, 40, 60]); if (ready()) { tone('sawtooth', 220, 110, .35, .12); hiss('lowpass', 700, 200, .3, .15); } },
  nope() { buzz([25, 25, 25]); if (ready()) tone('square', 160, 120, .1, .07); },
  tick() { if (ready()) tone('square', 1500, 1500, .03, .04); },
  start() { buzz(20); if (ready()) [784, 988, 1175].forEach((f, i) => tone('triangle', f, f, .14, .14, i * .08)); },
  bell() {
    buzz([40, 60, 120]);
    if (!ready()) return;
    for (const [f, d] of [[1568, 0], [1318, .18], [1046, .36]]) tone('triangle', f, f, .5, .16, d);
  },
  stars(n) {
    if (!ready()) return;
    [523, 659, 784, 1047].slice(0, n + 1).forEach((f, i) => tone('triangle', f, f, .3, .16, .3 + i * .16));
  },
  buy() { buzz(20); if (ready()) { tone('square', 1318, 1318, .07, .08); tone('square', 1976, 1976, .2, .08, .06); } },
};

// ---------------------------------------------------------------------------------------------------- music
// A cheerful, bouncy hawker-centre groove (C major: C, A minor, F, G). `rush` (0..1) speeds it up and adds
// a busier hi-hat and a higher melody, for a full counter or the last seconds. In the phone speaker's range.
const BASS = [48, 45, 41, 43]; // C3, A2, F2, G2
const CHORDS = [[60, 64, 67, 72], [57, 60, 64, 69], [53, 57, 60, 65], [55, 59, 62, 67]];
const TUNE = [0, 2, 1, 3, 2, 1, 0, 2];
const hz = m => 440 * 2 ** ((m - 69) / 12);
let music = null;

function musicStep(step, rush) {
  const { bus, nextTime: t } = music;
  const bpm = 112 + 30 * rush;
  const eighth = 60 / bpm / 2;
  const bar = Math.floor(step / 8) % 4, s = step % 8;
  // bouncy bass: root on the beat, the octave on the off-beat
  if (s % 2 === 0 || rush > .5) {
    const o = audio.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(hz(BASS[bar] + 12 + (s % 2 ? 12 : 0)), t);
    const g = audio.createGain();
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(.26, t + .01);
    g.gain.exponentialRampToValueAtTime(.0001, t + eighth * .9);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + eighth);
  }
  // the melody: a plucky chord arpeggio, an octave up in a rush
  const note = CHORDS[bar][TUNE[s]] + (rush > .6 ? 12 : 0);
  const p = audio.createOscillator();
  p.type = 'square';
  p.frequency.setValueAtTime(hz(note), t);
  const f = audio.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(2600, t);
  f.frequency.exponentialRampToValueAtTime(700, t + eighth * .8);
  const pg = audio.createGain();
  pg.gain.setValueAtTime(.0001, t);
  pg.gain.exponentialRampToValueAtTime(.13, t + .006);
  pg.gain.exponentialRampToValueAtTime(.0001, t + eighth * .7);
  p.connect(f).connect(pg).connect(bus);
  p.start(t);
  p.stop(t + eighth);
  // a light clap on 2 and 4, hi-hats (busier in a rush)
  if (s === 2 || s === 6) hiss('bandpass', 1500, 1200, .09, .22, t - audio.currentTime, bus);
  if (s % 2 === 1 || rush > .4) hiss('highpass', 8000, 7000, .04, .07 + .05 * rush, t - audio.currentTime, bus);
  return eighth;
}

export function musicStart(calm = false) {
  if (!ready() || music) return;
  const bus = audio.createGain();
  const limiter = audio.createDynamicsCompressor();
  limiter.threshold.value = -16;
  limiter.ratio.value = 6;
  bus.gain.setValueAtTime(.0001, audio.currentTime);
  bus.gain.exponentialRampToValueAtTime(calm ? .45 : .8, audio.currentTime + .5);
  bus.connect(limiter).connect(master);
  music = { bus, limiter, nextTime: audio.currentTime + .05, step: 0, rush: 0, calm };
  music.timer = setInterval(() => {
    if (!music) return;
    if (document.hidden || music.paused) {
      music.nextTime = audio.currentTime + .1;
      return;
    }
    if (music.nextTime < audio.currentTime) music.nextTime = audio.currentTime + .02;
    while (music.nextTime < audio.currentTime + .15) music.nextTime += musicStep(music.step++, music.calm ? 0 : music.rush);
  }, 25);
}

export function musicRush(rush) {
  if (music) music.rush = Math.min(1, Math.max(0, rush));
}

export function musicPause(paused) {
  if (music) music.paused = paused;
}

export function musicPlaying() {
  return music !== null;
}

export function musicCalm() {
  return music?.calm ?? false;
}

export function musicStop() {
  if (!music) return;
  const { bus, limiter, timer } = music;
  music = null;
  clearInterval(timer);
  const t = audio.currentTime;
  bus.gain.cancelScheduledValues(t);
  bus.gain.setValueAtTime(Math.max(.0001, bus.gain.value), t);
  bus.gain.exponentialRampToValueAtTime(.0001, t + .4);
  setTimeout(() => {
    bus.disconnect();
    limiter.disconnect();
  }, 600);
}
