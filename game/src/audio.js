// audio.js — all sound is synthesised with WebAudio: no audio files, no network.
// One job: engine hum, siren, gunshots, pickups and a simple bass music loop.
export function createAudio() {
  let ctx = null, master = null, engineOsc = null, engineGain = null, musicTimer = null;
  let enabled = true, musicOn = false;
  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.35; master.connect(ctx.destination);
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 50;
      engineGain = ctx.createGain(); engineGain.gain.value = 0;
      const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 420;
      engineOsc.connect(filt); filt.connect(engineGain); engineGain.connect(master);
      engineOsc.start();
    } catch { return false; }
    return true;
  }
  function blip(freq, dur, type, vol, slideTo) {
    if (!enabled || !ensure()) return;
    try {
      const t = ctx.currentTime;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'square'; o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(vol || 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
    } catch { /* audio is best-effort */ }
  }
  function noise(dur, vol, freq) {
    if (!enabled || !ensure()) return;
    try {
      const t = ctx.currentTime, len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 1200;
      const g = ctx.createGain(); g.gain.value = vol || 0.3;
      src.connect(f); f.connect(g); g.connect(master); src.start(t);
    } catch { /* best-effort */ }
  }
  const bassLine = [55, 0, 55, 65.4, 0, 55, 49, 58.3, 55, 0, 55, 65.4, 73.4, 65.4, 49, 49];
  let beat = 0;
  return {
    unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume(); },
    toggleMute() { enabled = !enabled; if (master) master.gain.value = enabled ? 0.35 : 0; return enabled; },
    setEngine(speed01, on) {
      if (!ensure()) return;
      try {
        engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.06 : 0, ctx.currentTime, 0.1);
        engineOsc.frequency.setTargetAtTime(45 + speed01 * 130, ctx.currentTime, 0.08);
      } catch { /* best-effort */ }
    },
    shoot() { noise(0.12, 0.4, 2600); blip(180, 0.08, 'square', 0.15, 60); },
    punch() { noise(0.08, 0.3, 500); },
    pickup() { blip(660, 0.09, 'sine', 0.25); setTimeout(() => blip(990, 0.12, 'sine', 0.25), 90); },
    cash() { blip(880, 0.1, 'sine', 0.25); setTimeout(() => blip(1174, 0.14, 'sine', 0.25), 100); },
    explosion() { noise(0.7, 0.6, 300); blip(90, 0.5, 'sine', 0.4, 30); },
    siren() { blip(750, 0.35, 'sine', 0.10, 950); },
    horn() { blip(370, 0.25, 'square', 0.12); },
    missionOk() { [523, 659, 784].forEach((f, i) => setTimeout(() => blip(f, 0.16, 'triangle', 0.25), i * 120)); },
    missionFail() { [392, 330, 262].forEach((f, i) => setTimeout(() => blip(f, 0.2, 'triangle', 0.22), i * 140)); },
    startMusic() {
      if (musicOn || !ensure()) return; musicOn = true;
      musicTimer = setInterval(() => {
        if (!enabled || !ctx) return;
        const f = bassLine[beat % bassLine.length]; beat++;
        if (f) blip(f, 0.22, 'triangle', 0.16);
        if (beat % 4 === 0) noise(0.03, 0.08, 4000);
      }, 240);
    },
    stopMusic() { musicOn = false; if (musicTimer) clearInterval(musicTimer); },
  };
}
