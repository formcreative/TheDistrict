// Tiny synthesized sound kit — no audio files needed. Starts on first touch.
let ac = null, master = null, noiseBuf = null, muted = false;
const last = {};

try { muted = localStorage.getItem('streetstory.muted') === '1'; } catch { /* storage blocked */ }

function throttle(key, ms) {
  const now = performance.now();
  if (last[key] && now - last[key] < ms) return false;
  last[key] = now;
  return true;
}

function tone(freq, dur, { type = 'triangle', vol = 0.2, when = 0, slide = 0 } = {}) {
  if (!ac) return;
  const t = ac.currentTime + when;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur, { freq = 3000, q = 1, type = 'highpass', vol = 0.15, sweepTo = 0 } = {}) {
  if (!ac) return;
  const t = ac.currentTime;
  const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = noiseBuf;
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  f.Q.value = q;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
  src.stop(t + dur + 0.02);
}

export const audio = {
  unlock() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain();
      master.gain.value = muted ? 0 : 0.55;
      master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.6, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch { ac = null; }
  },
  get muted() { return muted; },
  setMuted(m) {
    muted = m;
    if (master) master.gain.value = m ? 0 : 0.55;
    try { localStorage.setItem('streetstory.muted', m ? '1' : '0'); } catch { /* storage blocked */ }
  },
  snip() { if (throttle('snip', 35)) noise(0.07, { freq: 4200, vol: 0.12 }); },
  mower() { if (throttle('mower', 90)) tone(70 + Math.random() * 12, 0.1, { type: 'sawtooth', vol: 0.025 }); },
  coin(streak) {
    if (!throttle('coin', 28)) return;
    const f = 988 * Math.pow(2, Math.min(streak, 14) / 12);
    tone(f, 0.09, { type: 'square', vol: 0.05 });
    tone(f * 1.5, 0.16, { type: 'triangle', vol: 0.12, when: 0.045 });
  },
  tap() { tone(660, 0.08, { type: 'triangle', vol: 0.16, slide: 1.3 }); },
  pop() { tone(520, 0.12, { type: 'sine', vol: 0.18, slide: 1.8 }); },
  deny() { tone(220, 0.14, { type: 'square', vol: 0.06 }); tone(196, 0.16, { type: 'square', vol: 0.06, when: 0.1 }); },
  brew() { noise(0.6, { type: 'bandpass', freq: 900, sweepTo: 2400, q: 2, vol: 0.12 }); },
  ding() { tone(1568, 0.25, { type: 'sine', vol: 0.12 }); tone(2093, 0.35, { type: 'sine', vol: 0.08, when: 0.06 }); },
  praise() { tone(784, 0.1, { vol: 0.12 }); tone(1175, 0.18, { vol: 0.12, when: 0.07 }); },
  poof() { noise(0.45, { type: 'lowpass', freq: 2400, sweepTo: 180, vol: 0.35, q: 0.7 }); },
  thud() { tone(110, 0.18, { type: 'sine', vol: 0.25, slide: 0.6 }); },
  fanfare() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.22, { vol: 0.16, when: i * 0.08 }));
    tone(1568, 0.5, { vol: 0.12, when: 0.42 });
    tone(2093, 0.6, { type: 'sine', vol: 0.08, when: 0.5 });
  },
  chime() { tone(1319, 0.2, { type: 'sine', vol: 0.1 }); tone(1760, 0.3, { type: 'sine', vol: 0.08, when: 0.08 }); },
};
