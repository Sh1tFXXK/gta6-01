// WebAudio synth for Solmar Nights 3D: engine hum, sirens, gunshots,
// pickups, thunder, rain wash and a tiny per-station radio sequencer.
// No audio files, no network — everything is synthesized.

import { S } from './state.js';
import { RADIO } from './config.js';

let ctx = null, master = null, engineOsc = null, engineGain = null;
let sirenOsc = null, sirenGain = null, rainSrc = null, rainGain = null;
let radioTimer = null, radioStep = 0;
let started = false;

export function ensureAudio() {
  if (started) return;
  started = true;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 50;
    engineGain = ctx.createGain(); engineGain.gain.value = 0;
    engineOsc.connect(engineGain); engineGain.connect(master); engineOsc.start();
    sirenOsc = ctx.createOscillator(); sirenOsc.type = 'sine'; sirenOsc.frequency.value = 700;
    sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain); sirenGain.connect(master); sirenOsc.start();
    // Rain wash: looped filtered noise.
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    rainSrc = ctx.createBufferSource(); rainSrc.buffer = buf; rainSrc.loop = true;
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 900;
    rainGain = ctx.createGain(); rainGain.gain.value = 0;
    rainSrc.connect(filt); filt.connect(rainGain); rainGain.connect(master); rainSrc.start();
  } catch { ctx = null; }
}

function beep(freq, dur, type = 'sine', vol = 0.2, slideTo = 0) {
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
  g.gain.setValueAtTime(vol, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  o.connect(g); g.connect(master); o.start(); o.stop(ctx.currentTime + dur);
}

function noiseBurst(dur, vol, freq = 1200) {
  if (!ctx) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
  const g = ctx.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(master); src.start();
}

export const sfx = {
  shoot() { noiseBurst(0.12, 0.35, 2600); beep(180, 0.08, 'square', 0.12, 60); },
  punch() { noiseBurst(0.08, 0.25, 500); },
  pickup() { beep(660, 0.09, 'sine', 0.18); setTimeout(() => beep(990, 0.12, 'sine', 0.18), 70); },
  cash() { beep(880, 0.08, 'triangle', 0.2); setTimeout(() => beep(1174, 0.1, 'triangle', 0.2), 60); setTimeout(() => beep(1568, 0.16, 'triangle', 0.2), 130); },
  mission() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.16, 'triangle', 0.2), i * 90)); },
  fail() { beep(220, 0.35, 'sawtooth', 0.16, 110); },
  horn() { beep(370, 0.22, 'square', 0.14); beep(466, 0.22, 'square', 0.1); },
  stunt() { beep(784, 0.1, 'sine', 0.18); setTimeout(() => beep(1046, 0.18, 'sine', 0.18), 90); },
  thunder() { noiseBurst(1.4, 0.4, 220); },
  explosion() { noiseBurst(0.9, 0.55, 300); beep(90, 0.7, 'sine', 0.3, 30); },
  bust() { beep(440, 0.3, 'square', 0.15, 330); setTimeout(() => beep(330, 0.5, 'square', 0.15), 280); },
  unlock() { [392, 523, 659].forEach((f, i) => setTimeout(() => beep(f, 0.14, 'triangle', 0.2), i * 80)); },
  click() { beep(1200, 0.03, 'square', 0.08); },
};

export function setEngine(speedKmh, on) {
  if (!ctx || !engineOsc) return;
  const target = on ? 0.05 + Math.min(0.16, speedKmh / 600) : 0;
  engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
  engineOsc.frequency.setTargetAtTime(45 + speedKmh * 1.1, ctx.currentTime, 0.08);
}

export function setSiren(on, t) {
  if (!ctx || !sirenOsc) return;
  sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, ctx.currentTime, 0.2);
  if (on) sirenOsc.frequency.setTargetAtTime(650 + Math.sin(t * 4) * 220, ctx.currentTime, 0.05);
}

export function setRain(level) {
  if (!ctx || !rainGain) return;
  rainGain.gain.setTargetAtTime(level * 0.12, ctx.currentTime, 0.4);
}

// Tiny radio: a looping bass + pluck pattern per station, different roots.
const RADIO_ROOTS = [110, 82.4, 98];
export function radioTick(dt) {
  if (!ctx || S.mode !== 'play') return;
  radioStep += dt;
  const root = RADIO_ROOTS[S.radio.station % RADIO_ROOTS.length];
  const beat = 0.42;
  if (radioStep >= beat) {
    radioStep -= beat;
    const step = Math.floor(S.time / beat) % 16;
    const bassNotes = [1, 1, 1.33, 1, 1.5, 1, 1.33, 1.78];
    const n = bassNotes[step % 8];
    if (step % 2 === 0) beep(root * n, 0.3, 'triangle', 0.07);
    if (S.radio.station === 0 && step % 4 === 2) beep(root * 4 * [1, 1.2, 1.5, 1.78][(step / 4 | 0) % 4], 0.22, 'sine', 0.05);
    if (S.radio.station === 1 && step % 4 === 0) noiseBurst(0.05, 0.06, 4000);
  }
  // Track changes every ~40 s.
  S.radio.trackT += dt;
  if (S.radio.trackT > 40) {
    S.radio.trackT = 0;
    S.radio.track = (S.radio.track + 1) % RADIO[S.radio.station].tracks.length;
  }
}
