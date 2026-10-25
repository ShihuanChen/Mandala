// 统一状态引擎：只产出 quality / activation / stability / complexity / change / focus。
// 三种输入模式：sim（模拟）、manual（滑块手动）、realtime（WebSocket）。
// 视觉层不得直接读取设备数据，只消费这里的状态。

const KEYS = ['activation', 'stability', 'complexity', 'change', 'focus'];

export const PRESETS = {
  calm: { activation: 0.28, stability: 0.88, complexity: 0.34, change: 0.07, focus: 0.62 },
  active: { activation: 0.82, stability: 0.56, complexity: 0.64, change: 0.38, focus: 0.55 },
  focused: { activation: 0.55, stability: 0.90, complexity: 0.40, change: 0.09, focus: 0.92 },
  unstable: { activation: 0.70, stability: 0.32, complexity: 0.68, change: 0.78, focus: 0.40 },
};

export const PRESET_LABEL = { calm: '安静', active: '展开', focused: '集中', unstable: '波动' };

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

export class StateEngine {
  constructor() {
    this.mode = 'sim';
    this.preset = 'calm';
    this.time = 0;
    this.base = { ...PRESETS.calm };
    this.manual = { activation: 0.5, stability: 0.78, complexity: 0.44, change: 0.14, focus: 0.66, quality: 0.95 };
    this.prevAct = PRESETS.calm.activation;
    this.ws = null;
    this.wsState = null;
    this.wsStatus = 'idle';
    this.lowUntil = 0;
    this.last = null;
    this.onStatus = null;
  }

  setMode(mode) {
    this.mode = mode;
    if (mode === 'realtime') this.connect();
    else this.disconnect();
    this.emit(this.wsStatus);
  }

  setPreset(preset) {
    if (!PRESETS[preset]) return;
    this.preset = preset;
    // 不直接跳变：base 逐帧趋近新预设
    this.emit(this.wsStatus);
  }

  setManual(key, value) {
    if (key in this.manual) this.manual[key] = clamp(Number(value));
  }

  forceLowQuality(seconds = 3) {
    this.lowUntil = performance.now() + seconds * 1000;
  }

  emit(status) {
    if (typeof this.onStatus === 'function') this.onStatus(status, this.mode);
  }

  connect() {
    if (this.ws) return;
    this.wsStatus = 'connecting';
    this.emit(this.wsStatus);
    let ws;
    try {
      ws = new WebSocket('ws://127.0.0.1:8765');
    } catch (e) {
      this.wsStatus = 'lost';
      this.emit(this.wsStatus);
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      this.wsStatus = 'connected';
      this.emit(this.wsStatus);
    };
    ws.onmessage = (ev) => {
      try {
        const d = JSON.parse(ev.data);
        if (!d || d.type !== 'state') return;
        const q = ['quality', 'activation', 'stability', 'complexity', 'change', 'focus']
          .every((k) => Number.isFinite(d[k]));
        if (!q) return; // 非法帧直接丢弃，不用 0 填充
        this.wsState = {
          quality: clamp(d.quality), activation: clamp(d.activation), stability: clamp(d.stability),
          complexity: clamp(d.complexity), change: clamp(d.change), focus: clamp(d.focus),
        };
      } catch (e) { /* 忽略坏帧，画面保持上一状态 */ }
    };
    ws.onclose = () => {
      this.ws = null;
      this.wsState = null;
      this.wsStatus = 'lost';
      this.emit(this.wsStatus);
    };
    ws.onerror = () => { /* onclose 会接着触发 */ };
  }

  disconnect() {
    if (this.ws) { try { this.ws.close(); } catch (e) {} this.ws = null; }
    this.wsState = null;
    if (this.wsStatus !== 'idle') this.wsStatus = 'idle';
  }

  // dt: 秒
  tick(dt) {
    dt = Math.min(0.06, Math.max(0, dt));
    this.time += dt;
    const t = this.time;

    let s;
    if (this.mode === 'manual') {
      s = { ...this.manual };
    } else if (this.mode === 'realtime') {
      s = this.wsState ? { ...this.wsState } : (this.last || this._sim(t, dt));
    } else {
      s = this._sim(t, dt);
    }

    // 模拟断流：压低质量，视觉层据此降权
    if (performance.now() < this.lowUntil) s.quality = 0.16;
    if (s.quality === undefined) s.quality = 1;

    for (const k of KEYS) s[k] = clamp(s[k]);
    s.quality = clamp(s.quality);
    s.time = t;
    this.prevAct = s.activation;
    this.last = s;
    return s;
  }

  _sim(t, dt) {
    const tgt = PRESETS[this.preset];
    const k = 1 - Math.exp(-dt * 0.9); // 预设切换平滑过渡
    for (const key of KEYS) this.base[key] += (tgt[key] - this.base[key]) * k;
    const b = this.base;

    const act = clamp(b.activation + 0.09 * Math.sin(t * 0.45 + 0.3) + b.change * 0.05 * Math.sin(t * 6.7));
    const stab = clamp(b.stability + 0.05 * Math.cos(t * 0.12 + 1.1));
    const cplx = clamp(b.complexity + 0.07 * Math.sin(t * 0.23 + 2.0));
    const foc = clamp(b.focus + 0.05 * Math.sin(t * 0.31 + 0.7));
    const dact = Math.abs(act - this.prevAct) / Math.max(dt, 0.001);
    const chg = clamp(b.change * 0.85 + Math.min(0.15, dact * 0.08));
    // 信号质量缓慢轻微起伏，偶发小幅下探，用于演示无效输入降权
    const q = clamp(0.94 - 0.05 * (0.5 + 0.5 * Math.sin(t * 0.17 + 2.4)));

    return { quality: q, activation: act, stability: stab, complexity: cplx, change: chg, focus: foc };
  }
}
