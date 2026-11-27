// The chase music: an original piece made live with Web Audio (no files), in D minor, that reacts to the flood.
// `danger` goes from 0 (the water is far below) to 1 (it's at your feet):
//   0    a pulsing bassline and a tense plucked arpeggio (D minor, B♭, C, A: chords that never quite settle) and a
//        slow heartbeat, all in the range a phone speaker plays (with a sub-octave for headphones)
//   0.15+ faster, brighter, grittier; a clock-like hi-hat ticking in
//   0.6+ the heartbeat doubles; a rising string drone swells
//   0.8+ a high two-note alarm pulse
// A gold double smash (the water falls back) lets it calm down again. It speeds up a little as you climb, too.

const ROOTS = [38, 34, 36, 33]; // MIDI: D2, B♭1, C2, A1 (one bar each)
// the plucked arpeggio's chord tones over each bar (mid range: what a phone speaker plays well)
const CHORDS = [[62, 65, 69, 74], [58, 62, 65, 70], [60, 64, 67, 72], [57, 61, 64, 69]]; // Dm, B♭, C, A
const ARP = [0, 1, 2, 3, 2, 1, 2, 3]; // which chord tone on each eighth
const THIRDS = [65, 62, 64, 61]; // the drone's notes over each bar (F4, D4, E4, C#4: tension over A)
const STEPS = 8; // eighth notes in a bar

const hz = midi => 440 * 2 ** ((midi - 69) / 12);

let state = null; // { audio, out, bus, nextTime, step, danger, floor, timer }

/** Danger from how far the water is below the robot (in floors; 0 = at your feet), smoothed by the caller. */
export function dangerFrom(gap, gapMax = 2.4) {
  return Math.min(1, Math.max(0, 1 - gap / gapMax));
}

export function tempo(danger, floor, calm = false) {
  if (calm) return 84; // (the start and game-over screens: a calm, uneasy loop)
  return 100 + 52 * danger + Math.min(18, floor * .4); // beats per minute
}

let noise = null;
function noiseBuffer(audio) {
  if (!noise || noise.sampleRate !== audio.sampleRate) {
    noise = audio.createBuffer(1, audio.sampleRate / 2, audio.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noise;
}

function envelope(audio, t, peak, attack, release) {
  const g = audio.createGain();
  g.gain.setValueAtTime(.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(.0001, t + attack + release);
  return g;
}

/** One eighth note of music at audio time t (also used to render it offline, for the checks). */
export function scheduleStep(audio, out, t, step, danger, floor = 0, calm = false) {
  const bar = Math.floor(step / STEPS) % ROOTS.length;
  const s = step % STEPS;
  const beat = 60 / tempo(danger, floor, calm);
  const soft = calm ? .6 : 1; // (calmer and quieter between runs)
  if (calm) danger = 0;
  const eighth = beat / 2;

  // bass: a driving eighth-note ostinato, the octave on the off-beats; brighter and grittier with danger. It sits an
  // octave up (phone speakers can't play deep bass), with a quiet sub-octave underneath for headphones.
  const root = ROOTS[bar] + 12 + (s === 3 || s === 7 ? 12 : 0);
  const bass = audio.createOscillator();
  bass.type = 'sawtooth';
  bass.frequency.setValueAtTime(hz(root), t);
  const lp = audio.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(800 + 2400 * danger ** 1.2, t);
  lp.Q.value = 3 + 6 * danger;
  const bassGain = envelope(audio, t, soft * (.3 + .08 * danger), .006, eighth * .8);
  bass.connect(lp).connect(bassGain).connect(out);
  bass.start(t);
  bass.stop(t + eighth + .05);
  const sub = audio.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(hz(root - 12), t);
  const subGain = envelope(audio, t, soft * .14, .01, eighth * .8);
  sub.connect(subGain).connect(out);
  sub.start(t);
  sub.stop(t + eighth + .05);

  // the plucked arpeggio: a tense minor figure, always there (the part you hear first on a phone)
  const pluck = audio.createOscillator();
  pluck.type = 'square';
  pluck.frequency.setValueAtTime(hz(CHORDS[bar][ARP[s]] + (danger > .7 ? 12 : 0)), t);
  const pf = audio.createBiquadFilter();
  pf.type = 'lowpass';
  pf.frequency.setValueAtTime(1800 + 2500 * danger, t);
  pf.frequency.exponentialRampToValueAtTime(600, t + eighth * .7);
  const pg = envelope(audio, t, soft * (.16 + .05 * danger), .004, eighth * .65);
  pluck.connect(pf).connect(pg).connect(out);
  pluck.start(t);
  pluck.stop(t + eighth);

  // heartbeat: "lub-dub" on beats 1 and 3; doubled when the water is close
  const beats = calm ? [] : danger > .6 ? [0, 2, 4, 6] : [0, 4];
  if (beats.includes(s)) {
    for (const [offset, peak] of [[0, .55], [.13, .32]]) {
      const k = audio.createOscillator();
      k.type = 'sine';
      k.frequency.setValueAtTime(170, t + offset);
      k.frequency.exponentialRampToValueAtTime(45, t + offset + .14);
      const g = envelope(audio, t + offset, peak * 1.3 * (.7 + .5 * danger), .004, .16);
      k.connect(g).connect(out);
      k.start(t + offset);
      k.stop(t + offset + .2);
      // (the "tuk" on top: what a phone speaker plays of a heartbeat)
      const tuk = audio.createBufferSource();
      tuk.buffer = noiseBuffer(audio);
      const tf = audio.createBiquadFilter();
      tf.type = 'bandpass';
      tf.frequency.value = 700;
      tf.Q.value = 1.4;
      const tg = envelope(audio, t + offset, peak * 1.1 * (.7 + .5 * danger), .002, .05);
      tuk.connect(tf).connect(tg).connect(out);
      tuk.start(t + offset, Math.random() * .3);
      tuk.stop(t + offset + .07);
    }
  }

  // ticking: sixteenth-note hi-hats, coming in as the water rises (a clock running out)
  if (!calm && danger > .15) {
    const level = (danger - .15) / .85;
    for (const half of [0, 1]) {
      const at = t + half * eighth / 2;
      const src = audio.createBufferSource();
      src.buffer = noiseBuffer(audio);
      const hp = audio.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 7000;
      const g = envelope(audio, at, (half ? .05 : .09) * level, .002, .04);
      src.connect(hp).connect(g).connect(out);
      src.start(at, Math.random() * .3);
      src.stop(at + .06);
    }
  }

  // the drone: two detuned strings at the start of each bar, swelling and rising when the water is close
  if (s === 0 && danger > .55) {
    const level = (danger - .55) / .45;
    for (const detune of [-9, 9]) {
      const o = audio.createOscillator();
      o.type = 'sawtooth';
      o.detune.value = detune;
      const len = eighth * STEPS;
      o.frequency.setValueAtTime(hz(THIRDS[bar]), t);
      o.frequency.linearRampToValueAtTime(hz(THIRDS[bar]) * (1 + .03 * level), t + len); // creeping up
      const f = audio.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 900 + 2200 * level;
      const g = audio.createGain();
      g.gain.setValueAtTime(.0001, t);
      g.gain.linearRampToValueAtTime(.08 * level, t + len * .6);
      g.gain.linearRampToValueAtTime(.0001, t + len);
      o.connect(f).connect(g).connect(out);
      o.start(t);
      o.stop(t + len + .02);
    }
  }

  // the alarm: a high minor second (A5, B♭5) on the last beat of each bar, at the very edge
  if (danger > .8 && (s === 6 || s === 7)) {
    const a = audio.createOscillator();
    a.type = 'square';
    a.frequency.setValueAtTime(hz(s === 6 ? 81 : 82), t);
    const f = audio.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 3000;
    const g = envelope(audio, t, .06 * (danger - .8) / .2 + .015, .005, eighth * .7);
    a.connect(f).connect(g).connect(out);
    a.start(t);
    a.stop(t + eighth);
  }
  return eighth;
}

/**
 * Start the music (after a tap: sound must be unlocked). `output` is feel.output(). `calm`: the gentler loop for the
 * start and game-over screens (the chase takes over with setCalm(false)).
 */
export function start(output, calm = false) {
  if (!output) return;
  stop(true);
  const { audio, out } = output;
  // a limiter on the music: loud on a phone speaker, never distorting
  const limiter = audio.createDynamicsCompressor();
  limiter.threshold.value = -16;
  limiter.knee.value = 6;
  limiter.ratio.value = 6;
  limiter.attack.value = .003;
  limiter.release.value = .2;
  const bus = audio.createGain();
  bus.gain.setValueAtTime(.0001, audio.currentTime);
  bus.gain.exponentialRampToValueAtTime(1, audio.currentTime + .6); // (a quick fade in)
  bus.connect(limiter).connect(out);
  state = { audio, out, bus, limiter, nextTime: audio.currentTime + .08, step: 0, danger: 0, floor: 0, calm };
  state.timer = setInterval(pump, 25);
  pump();
}

/** Switch between the calm loop and the chase (it carries on in time, no restart). */
export function setCalm(calm) {
  if (state) state.calm = calm;
}

export function isCalm() {
  return state?.calm ?? false;
}

/** Keep about 0.15 s of music scheduled ahead (steady timing even if a frame is slow). */
function pump() {
  if (!state) return;
  const { audio } = state;
  if (document.hidden) {
    state.nextTime = audio.currentTime + .1;
    return;
  }
  if (state.nextTime < audio.currentTime) state.nextTime = audio.currentTime + .02; // (fell behind: catch up)
  while (state.nextTime < audio.currentTime + .15) {
    state.nextTime += scheduleStep(audio, state.bus, state.nextTime, state.step++, state.danger, state.floor, state.calm);
  }
}

/** How close the water is now (0..1) and the floor; the music follows on its next notes. */
export function update(danger, floor) {
  if (!state) return;
  state.danger = danger;
  state.floor = floor;
}

/** Stop: a quick fade, or (caught by the water) a falling whoosh. */
export function stop(quick = false, caught = false) {
  if (!state) return;
  const { audio, out, bus, limiter, timer } = state;
  state = null;
  clearInterval(timer);
  const t = audio.currentTime;
  bus.gain.cancelScheduledValues(t);
  bus.gain.setValueAtTime(Math.max(.0001, bus.gain.value), t);
  bus.gain.exponentialRampToValueAtTime(.0001, t + (quick ? .08 : .9));
  setTimeout(() => {
    bus.disconnect();
    limiter.disconnect();
  }, 1200);
  if (!caught || quick) return;
  // the music sinks under the water (straight to the main output, not the fading music)
  const o = audio.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(hz(62), t);
  o.frequency.exponentialRampToValueAtTime(hz(26), t + 1.1);
  const f = audio.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(1800, t);
  f.frequency.exponentialRampToValueAtTime(120, t + 1.1);
  const g = audio.createGain();
  g.gain.setValueAtTime(.12, t);
  g.gain.exponentialRampToValueAtTime(.0001, t + 1.2);
  o.connect(f).connect(g).connect(out);
  o.start(t);
  o.stop(t + 1.25);
}

export function playing() {
  return state !== null;
}
