// Warm, synthesized sound design using the Web Audio API.
// Everything is generated live (mallets, bells, soft noise), with a gentle
// room reverb so nothing sounds flat or robotic.

let ctx = null, master = null, sfxBus = null, musicBus = null, verb = null;
let enabled = true, musicOn = true;
let musicTimer = null, musicStep = 0, nextNoteTime = 0, musicMood = 'menu';

const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);

function impulse(seconds = 2.2, decay = 3) {
  const rate = ctx.sampleRate, len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

export function init() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC({ latencyHint: 'interactive' });
  master = ctx.createGain(); master.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.2;
  master.connect(comp).connect(ctx.destination);

  verb = ctx.createConvolver(); verb.buffer = impulse();
  const verbGain = ctx.createGain(); verbGain.gain.value = 0.22;
  verb.connect(verbGain).connect(master);

  sfxBus = ctx.createGain(); sfxBus.gain.value = enabled ? 1 : 0;
  sfxBus.connect(master); sfxBus.connect(verb);
  musicBus = ctx.createGain(); musicBus.gain.value = 0;
  const musicLP = ctx.createBiquadFilter(); musicLP.type = 'lowpass'; musicLP.frequency.value = 2600;
  musicBus.connect(musicLP); musicLP.connect(master); musicLP.connect(verb);
}

export function setEnabled(v) { enabled = v; if (sfxBus) sfxBus.gain.setTargetAtTime(v ? 1 : 0, ctx.currentTime, 0.05); if (!v) stopMusic(); }
export function setMusic(v) { musicOn = v; if (!v) stopMusic(); }

// ---------- instruments ----------
function env(g, t, a, peak, d) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

// Marimba-like mallet: fundamental + 4th harmonic that dies quickly, slight detune.
function mallet(freq, t, vol = 0.35, len = 0.9, bus = sfxBus) {
  const out = ctx.createGain(); env(out, t, 0.004, vol, len);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.min(9000, freq * 6); lp.Q.value = 0.4;
  const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = freq;
  const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 4.01;
  const g2 = ctx.createGain(); env(g2, t, 0.002, 0.35, 0.12);
  const o3 = ctx.createOscillator(); o3.type = 'triangle'; o3.frequency.value = freq * 1.003;
  const g3 = ctx.createGain(); g3.gain.value = 0.25;
  o1.connect(out); o2.connect(g2).connect(out); o3.connect(g3).connect(out);
  out.connect(lp).connect(bus);
  [o1, o2, o3].forEach(o => { o.start(t); o.stop(t + len + 0.1); });
}

// Soft bell / glass: inharmonic partials with long tail.
function bell(freq, t, vol = 0.18, len = 1.8, bus = sfxBus) {
  const partials = [[1, 1], [2.0, 0.5], [2.76, 0.32], [5.4, 0.12]];
  partials.forEach(([m, a], i) => {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq * m;
    const g = ctx.createGain(); env(g, t, 0.003, vol * a, len / (1 + i * 0.6));
    o.connect(g).connect(bus); o.start(t); o.stop(t + len + 0.1);
  });
}

// Warm pad (two detuned triangles through a slow filter).
function pad(freq, t, dur, vol = 0.05, bus = musicBus) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + dur * 0.35);
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
  [-6, 6].forEach(c => {
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = freq; o.detune.value = c;
    o.connect(lp); o.start(t); o.stop(t + dur + 0.05);
  });
  lp.connect(g).connect(bus);
}

function noise(t, dur, { vol = 0.2, type = 'bandpass', f0 = 1200, f1 = f0, q = 0.8, attack = 0.003 } = {}) {
  const len = Math.ceil(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain(); env(g, t, attack, vol, dur);
  src.connect(f).connect(g).connect(sfxBus); src.start(t); src.stop(t + dur + 0.05);
}

function thump(t, freq = 140, vol = 0.5) {
  const o = ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(freq * 2, t); o.frequency.exponentialRampToValueAtTime(freq, t + 0.08);
  const g = ctx.createGain(); env(g, t, 0.003, vol, 0.25);
  o.connect(g).connect(sfxBus); o.start(t); o.stop(t + 0.35);
}

// ---------- public sound effects ----------
const now = () => ctx.currentTime + 0.01;
const ok = () => ctx && enabled;

export const sfx = {
  tap() { if (!ok()) return; const t = now(); noise(t, 0.04, { vol: 0.12, f0: 3200, q: 2 }); mallet(NOTE(84), t, 0.09, 0.15); },
  soft() { if (!ok()) return; mallet(NOTE(79), now(), 0.12, 0.3); },
  whoosh() { if (!ok()) return; noise(now(), 0.28, { vol: 0.06, type: 'bandpass', f0: 500, f1: 2600, q: 0.7, attack: 0.08 }); },
  correct() { if (!ok()) return; const t = now(); mallet(NOTE(76), t, 0.3, 0.6); mallet(NOTE(83), t + 0.085, 0.32, 0.9); bell(NOTE(95), t + 0.085, 0.05, 1.0); },
  wrong() { if (!ok()) return; const t = now(); mallet(NOTE(55), t, 0.28, 0.4); mallet(NOTE(54), t + 0.13, 0.26, 0.55); noise(t, 0.12, { vol: 0.05, type: 'lowpass', f0: 600 }); },
  tick() { if (!ok()) return; const t = now(); mallet(NOTE(72), t, 0.22, 0.25); noise(t, 0.03, { vol: 0.08, f0: 2500, q: 3 }); },
  go() { if (!ok()) return; const t = now(); [72, 76, 79, 84].forEach(n => mallet(NOTE(n), t, 0.16, 1.0)); bell(NOTE(96), t, 0.06, 1.4); },
  pen() { if (!ok()) return; noise(now(), 0.05, { vol: 0.025, f0: 4000, q: 1.5 }); },
  pop() { if (!ok()) return; const t = now(); const o = ctx.createOscillator(); o.frequency.setValueAtTime(500, t); o.frequency.exponentialRampToValueAtTime(1100, t + 0.07); const g = ctx.createGain(); env(g, t, 0.003, 0.18, 0.1); o.connect(g).connect(sfxBus); o.start(t); o.stop(t + 0.15); },
  stamp() { if (!ok()) return; const t = now(); thump(t, 110, 0.55); noise(t, 0.08, { vol: 0.12, type: 'lowpass', f0: 1800 }); bell(NOTE(88), t + 0.05, 0.08, 1.4); },
  flip() { if (!ok()) return; noise(now(), 0.09, { vol: 0.07, f0: 1800, f1: 900, q: 1 }); },
  fanfare() {
    if (!ok()) return; const t = now();
    [60, 64, 67, 72, 76, 79].forEach((n, i) => mallet(NOTE(n), t + i * 0.07, 0.22, 1.1));
    [72, 76, 79, 84].forEach(n => bell(NOTE(n + 12), t + 0.5, 0.06, 2.2));
    pad(NOTE(48), t + 0.4, 2.2, 0.08, sfxBus); pad(NOTE(55), t + 0.4, 2.2, 0.06, sfxBus);
  },
  sparkle() { if (!ok()) return; const t = now(); [88, 91, 95, 100].forEach((n, i) => bell(NOTE(n), t + i * 0.06, 0.05, 1.0)); },
  drumroll(sec = 1.6) {
    if (!ok()) return; const t = now(); const hits = Math.floor(sec * 22);
    for (let i = 0; i < hits; i++) noise(t + i * (sec / hits), 0.05, { vol: 0.03 + 0.12 * (i / hits), f0: 1600, q: 0.6 });
  },
  reveal() { if (!ok()) return; const t = now(); thump(t, 90, 0.6); [60, 67, 72, 76, 79, 84].forEach((n, i) => mallet(NOTE(n), t + i * 0.035, 0.2, 1.4)); bell(NOTE(96), t + 0.2, 0.08, 2.0); },
  note(i) { if (!ok()) return; const scale = [60, 62, 64, 67, 69, 72, 74, 76, 79]; mallet(NOTE(scale[i % scale.length] + 12), now(), 0.3, 0.7); },
};

// ---------- gentle generative menu music ----------
const PROG = [
  { root: 53, chord: [65, 69, 72, 76] }, // Fmaj7
  { root: 55, chord: [67, 71, 74, 77] }, // G7-ish
  { root: 52, chord: [64, 67, 71, 74] }, // Em7
  { root: 57, chord: [64, 69, 72, 76] }, // Am7
];
const PENTA = [72, 74, 76, 79, 81, 84, 86];

function scheduleMusic() {
  const spb = 60 / 84 / 2; // eighth notes at 84 bpm
  while (nextNoteTime < ctx.currentTime + 0.3) {
    const bar = Math.floor(musicStep / 8) % PROG.length, beat = musicStep % 8;
    const { root, chord } = PROG[bar];
    const t = nextNoteTime + (beat % 2 ? spb * 0.12 : 0); // light swing
    if (beat === 0) { pad(NOTE(root), t, spb * 8.2, 0.05); pad(NOTE(chord[1]), t, spb * 8.2, 0.025); mallet(NOTE(root - 12), t, 0.1, 1.4, musicBus); }
    if (beat === 4) mallet(NOTE(root - 5), t, 0.06, 1.0, musicBus);
    const chance = musicMood === 'menu' ? 0.42 : 0.25;
    if (Math.random() < chance) {
      const pool = Math.random() < 0.6 ? chord.map(n => n + 12) : PENTA;
      mallet(NOTE(pool[Math.floor(Math.random() * pool.length)]), t, 0.07 + Math.random() * 0.05, 0.9, musicBus);
    }
    nextNoteTime += spb; musicStep++;
  }
}

export function startMusic(mood = 'menu') {
  if (!ctx || !musicOn || !enabled) return;
  musicMood = mood;
  musicBus.gain.cancelScheduledValues(ctx.currentTime);
  musicBus.gain.setTargetAtTime(mood === 'menu' ? 0.85 : 0.5, ctx.currentTime, 0.6);
  if (musicTimer) return;
  nextNoteTime = ctx.currentTime + 0.1;
  musicTimer = setInterval(scheduleMusic, 80);
}

export function stopMusic() {
  if (!ctx || !musicTimer) return;
  musicBus.gain.setTargetAtTime(0, ctx.currentTime, 0.35);
  const timer = musicTimer; musicTimer = null;
  setTimeout(() => { if (!musicTimer) clearInterval(timer); else clearInterval(timer); }, 1200);
}

export function haptic(ms = 12) { try { navigator.vibrate && navigator.vibrate(ms); } catch {} }
