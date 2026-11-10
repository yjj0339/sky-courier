/**
 * 浮空岛快递 · 合成音效（Web Audio，无外部音频文件）
 */

const STORE_KEY = 'skyCourier.sound';

function makeNoiseBuffer(ctx, seconds = 2) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

export class AudioEngine {
  constructor() {
    this.enabled = true;
    this.ctx = null;
    this.master = null;
    this.engine = null;
    this.noiseBuffer = null;
    try {
      const saved = localStorage.getItem(STORE_KEY);
      if (saved === '0' || saved === '1') this.enabled = saved === '1';
    } catch (_) { /* 隐私模式忽略 */ }
  }

  /** 必须由用户手势触发 */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 0.9 : 0;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 8;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      this.noiseBuffer = makeNoiseBuffer(this.ctx);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  setEnabled(on) {
    this.enabled = !!on;
    try { localStorage.setItem(STORE_KEY, this.enabled ? '1' : '0'); } catch (_) { /* 忽略 */ }
    if (this.master) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(this.enabled ? 0.9 : 0, t, 0.05);
    }
  }

  toggle() { this.setEnabled(!this.enabled); return this.enabled; }

  /* ─────────── 引擎循环音 ─────────── */
  startEngine() {
    if (!this.unlock() || this.engine) return;
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0.0;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 520;
    filter.Q.value = 3.2;

    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.value = 58;

    const osc2 = ctx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.value = 87;

    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = 29;

    const g1 = ctx.createGain(); g1.gain.value = 0.5;
    const g2 = ctx.createGain(); g2.gain.value = 0.22;
    const g3 = ctx.createGain(); g3.gain.value = 0.35;

    // 风噪（推进时更明显）
    const wind = ctx.createBufferSource();
    wind.buffer = this.noiseBuffer;
    wind.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 900;
    windFilter.Q.value = 0.8;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.0;

    osc1.connect(g1); g2 && osc2.connect(g2); sub.connect(g3);
    g1.connect(filter); g2.connect(filter); g3.connect(filter);
    filter.connect(out);
    wind.connect(windFilter); windFilter.connect(windGain); windGain.connect(out);
    out.connect(this.master);

    osc1.start(); osc2.start(); sub.start(); wind.start();
    out.gain.setTargetAtTime(0.16, ctx.currentTime, 0.4);

    this.engine = { out, filter, osc1, osc2, sub, windGain, windFilter, g1, g2, g3 };
  }

  stopEngine() {
    if (!this.engine) return;
    const e = this.engine;
    const t = this.ctx.currentTime;
    e.out.gain.setTargetAtTime(0, t, 0.12);
    const nodes = [e.osc1, e.osc2, e.sub];
    setTimeout(() => {
      try { nodes.forEach((n) => n.stop()); } catch (_) { /* 已停止 */ }
    }, 420);
    this.engine = null;
  }

  /** speedRatio 0..1，boost 0..1 */
  updateEngine(speedRatio, boost) {
    if (!this.engine || !this.ctx) return;
    const e = this.engine;
    const t = this.ctx.currentTime;
    const base = 52 + speedRatio * 42 + boost * 24;
    e.osc1.frequency.setTargetAtTime(base, t, 0.08);
    e.osc2.frequency.setTargetAtTime(base * 1.51, t, 0.08);
    e.sub.frequency.setTargetAtTime(base * 0.5, t, 0.08);
    e.filter.frequency.setTargetAtTime(420 + speedRatio * 620 + boost * 700, t, 0.1);
    e.windGain.gain.setTargetAtTime(0.012 + boost * 0.075 + speedRatio * 0.02, t, 0.12);
    e.windFilter.frequency.setTargetAtTime(760 + boost * 1100, t, 0.12);
    e.out.gain.setTargetAtTime(0.13 + boost * 0.1, t, 0.15);
  }

  /* ─────────── 事件音 ─────────── */
  _tone(freq, start, dur, type = 'sine', peak = 0.3) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak, start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  _noise(start, dur, freq, peak = 0.3, type = 'bandpass') {
    if (!this.ctx || !this.enabled || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, start);
    f.frequency.exponentialRampToValueAtTime(Math.max(120, freq * 0.35), start + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(start);
    src.stop(start + dur + 0.05);
  }

  ring(combo = 1) {
    if (!this.unlock()) return;
    const t = this.ctx.currentTime;
    const base = 880 * Math.pow(1.0595, Math.min(combo - 1, 8) * 2);
    this._tone(base, t, 0.34, 'sine', 0.26);
    this._tone(base * 1.5, t + 0.04, 0.26, 'sine', 0.16);
    this._tone(base * 2, t + 0.08, 0.2, 'triangle', 0.08);
  }

  deliver() {
    if (!this.unlock()) return;
    const t = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      this._tone(f, t + i * 0.085, 0.42, 'triangle', 0.3);
      this._tone(f * 2, t + i * 0.085, 0.22, 'sine', 0.1);
    });
  }

  crash() {
    if (!this.unlock()) return;
    const t = this.ctx.currentTime;
    this._noise(t, 0.42, 480, 0.34, 'lowpass');
    this._tone(70, t, 0.3, 'sine', 0.32);
    this._tone(46, t + 0.03, 0.36, 'sine', 0.24);
  }

  boost() {
    if (!this.unlock()) return;
    const t = this.ctx.currentTime;
    this._noise(t, 0.5, 620, 0.24);
    this._tone(220, t, 0.36, 'sawtooth', 0.12);
    this._tone(440, t + 0.05, 0.3, 'sine', 0.1);
  }

  click() {
    if (!this.unlock()) return;
    const t = this.ctx.currentTime;
    this._tone(660, t, 0.09, 'square', 0.14);
    this._tone(990, t + 0.02, 0.07, 'sine', 0.08);
  }

  countdown(final = false) {
    if (!this.unlock()) return;
    const t = this.ctx.currentTime;
    this._tone(final ? 880 : 520, t, final ? 0.5 : 0.16, 'square', final ? 0.24 : 0.16);
  }
}

export const audio = new AudioEngine();
