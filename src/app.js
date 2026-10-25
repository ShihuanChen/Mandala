import { StateEngine, PRESETS } from './state.js';
import { mapB, mapA, lerpParams } from './mapping.js';
import { drawB } from './styleB.js';
import { drawA } from './styleA.js';
import { downloadPNG, downloadJSON, stamp } from './export.js';

const $ = (s) => document.querySelector(s);
const stageWrap = $('#stageWrap');
const canvas = $('#stage');
const ctx = canvas.getContext('2d', { alpha: false });

const engine = new StateEngine();

let style = 'B';
let motif = 'lotus';
let playing = true;
let params = null;
let W = 1, H = 1;
let last = performance.now();
let lastHud = 0;
let elapsed = 0;
let lastRec = -1;
let record = [];
let replay = null;

const MOTIF_LABEL = {
  lotus: '圆形花卉', mandala: '几何曼陀罗', phoenix: '简化凤凰',
  cloud: '传统云气', leaf: '传统花叶',
};

const STATE_ROWS = [
  ['activation', '激活度'], ['stability', '稳定度'], ['complexity', '复杂度'],
  ['change', '变化幅度'], ['focus', '集中度'], ['quality', '信号质量'],
];

const PARAM_META = {
  B: [['symmetry', '对称份数', 1], ['pointCount', '点数量', 1], ['lineCount', '线数量', 1],
      ['whitespace', '留白比例', 2], ['lw', '线宽', 2], ['rotSpeed', '旋转速度', 3]],
  A: [['layers', '径向层数', 1], ['petals', '每层花瓣', 1], ['orbs', '珠体数量', 1],
      ['ribbons', '丝带数量', 1], ['glow', '发光强度', 1], ['distortion', '局部扭曲', 2]],
};

// ---------- 状态行 ----------
const barsEl = $('#bars');
const rowEls = {};
for (const [key, label] of STATE_ROWS) {
  const row = document.createElement('div');
  row.className = 'state-row';
  row.innerHTML = `<span class="lbl">${label}</span><span class="val">—</span>
    <input type="range" min="0" max="1" step="0.01" disabled aria-label="${label}">`;
  const input = row.querySelector('input');
  input.addEventListener('input', () => engine.setManual(key, input.value));
  barsEl.appendChild(row);
  rowEls[key] = { input, val: row.querySelector('.val') };
}

// ---------- 模式 ----------
const modeSeg = $('#modeSeg');
const wsHint = $('#wsHint');

function setMode(mode) {
  engine.setMode(mode);
  modeSeg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === mode));
  const manual = mode === 'manual';
  for (const k in rowEls) rowEls[k].input.disabled = !manual;
  $('#manualHint').hidden = !manual;
  if (mode === 'sim') wsHint.textContent = '实时模式需先启动 WebSocket 服务（见 README）。';
  if (mode === 'manual') wsHint.textContent = '手动模式下，右侧六个滑块直接驱动视觉。';
  if (mode === 'realtime') wsHint.textContent = engine.wsStatus === 'connected'
    ? '已连接 ws://127.0.0.1:8765'
    : '正在连接 ws://127.0.0.1:8765 …（每 4 秒自动重试）';
}
modeSeg.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) setMode(b.dataset.v);
});

engine.onStatus = (status, mode) => {
  if (mode !== 'realtime') return;
  if (status === 'connected') wsHint.textContent = '已连接 ws://127.0.0.1:8765';
  else if (status === 'connecting') wsHint.textContent = '正在连接 ws://127.0.0.1:8765 …';
  else wsHint.textContent = '未连接，画面保持上一状态并显示「等待信号」；每 4 秒自动重试。';
};

setInterval(() => {
  if (engine.mode === 'realtime' && !engine.ws) engine.connect();
}, 4000);

// ---------- 风格 ----------
const styleSeg = $('#styleSeg');

function applyStyle() {
  stageWrap.classList.toggle('light', style === 'B');
  $('#motifSection').hidden = style !== 'B';
  $('#capStyle').textContent = style === 'B'
    ? `简约典雅 · ${MOTIF_LABEL[motif]}`
    : '材质对比 · 3D 材质 / 酸性新中式';
}
styleSeg.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || b.dataset.v === style) return;
  style = b.dataset.v;
  styleSeg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x.dataset.v === style));
  params = null; // 换风格时重建参数集合
  applyStyle();
});

$('#motifSelect').addEventListener('change', (e) => {
  motif = e.target.value;
  applyStyle();
});

// ---------- 预设 ----------
const presetChips = $('#presetChips');
presetChips.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  engine.setPreset(b.dataset.v);
  presetChips.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x.dataset.v === b.dataset.v));
});

// ---------- 播放 ----------
const btnPlay = $('#btnPlay');
btnPlay.addEventListener('click', () => {
  playing = !playing;
  btnPlay.textContent = playing ? '暂停' : '继续';
});

$('#btnReset').addEventListener('click', () => {
  engine.time = 0;
  engine.base = { ...PRESETS[engine.preset] };
  params = null;
  record = [];
  replay = null;
  elapsed = 0;
  lastRec = -1;
});

// ---------- 导出 ----------
$('#btnPng').addEventListener('click', () => {
  const tag = style === 'B' ? '典雅' : '材质';
  downloadPNG(canvas, `新中式-${tag}-${stamp()}.png`);
});
$('#btnJson').addEventListener('click', () => {
  downloadJSON({
    version: '0.1', style, motif, mode: engine.mode,
    state: engine.last, params,
  }, `state-${stamp()}.json`);
});
$('#btnSession').addEventListener('click', () => {
  if (record.length < 2) return flashHint('会话记录不足，先播放一会儿再保存。');
  downloadJSON({ version: '0.1', style, motif, frames: record }, `session-${stamp()}.json`);
});
$('#btnReplay').addEventListener('click', (e) => {
  if (record.length < 4) return flashHint('暂无可回放的记录。');
  replay = { frames: record.slice(), start: performance.now(), t0: record[0].t, idx: 0 };
  playing = true;
  btnPlay.textContent = '暂停';
  e.currentTarget.textContent = '回放中…';
  setTimeout(() => { e.currentTarget.textContent = '回放上一段'; }, 1200);
});
$('#btnDrop').addEventListener('click', () => engine.forceLowQuality(3));

let hintTimer = 0;
function flashHint(text) {
  wsHint.textContent = text;
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => { if (engine.mode === 'sim') wsHint.textContent = '实时模式需先启动 WebSocket 服务（见 README）。'; }, 2400);
}

// ---------- 尺寸 ----------
function resize() {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  W = Math.max(1, Math.round(r.width));
  H = Math.max(1, Math.round(r.height));
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// ---------- 记录 / 回放 ----------
function recordFrame(st) {
  if (elapsed - lastRec < 0.1) return;
  lastRec = elapsed;
  record.push({
    t: Number(elapsed.toFixed(3)),
    state: {
      quality: Number(st.quality.toFixed(3)), activation: Number(st.activation.toFixed(3)),
      stability: Number(st.stability.toFixed(3)), complexity: Number(st.complexity.toFixed(3)),
      change: Number(st.change.toFixed(3)), focus: Number(st.focus.toFixed(3)),
    },
  });
  if (record.length > 1200) record.shift();
}

function sampleReplay(now) {
  const r = replay;
  const el = r.t0 + (now - r.start) / 1000;
  const fs = r.frames;
  if (el > fs[fs.length - 1].t + 0.06) return null;
  let i = r.idx || 0;
  while (i < fs.length - 1 && fs[i + 1].t <= el) i++;
  r.idx = i;
  return { ...fs[i].state, time: el };
}

// ---------- 文案 ----------
function captionText(st) {
  if (st.quality < 0.35) return '信号微弱，画面正在保持';
  if (st.focus > 0.82) return '视线正在集中';
  if (st.activation > 0.68 && st.change > 0.32) return '结构正在向外展开';
  if (st.change > 0.48) return '线条正在寻找新的路径';
  if (st.stability > 0.74 && st.activation < 0.42) return '纹样正在安静下来';
  return '纹样正在缓慢呼吸';
}

const signalEl = $('#signal');
function updateHud(st) {
  for (const [key] of STATE_ROWS) {
    const el = rowEls[key];
    const v = st[key];
    el.val.textContent = v.toFixed(2);
    el.input.style.setProperty('--fill', `${Math.round(v * 100)}%`);
    if (el.input.disabled) el.input.value = v;
  }

  if (params) {
    const meta = PARAM_META[style];
    $('#params').innerHTML = meta.map(([k, label, dec]) => {
      const v = params[k];
      const text = dec === 1 ? String(Math.round(v)) : v.toFixed(dec);
      return `<div><span>${label}</span><b>${text}</b></div>`;
    }).join('');
  }

  $('#capLine').textContent = captionText(st);

  const waiting = engine.mode === 'realtime' && !engine.wsState;
  let text = '信号良好', warn = false;
  if (waiting) { text = '等待信号'; warn = true; }
  else if (st.quality < 0.35) { text = '信号微弱'; warn = true; }
  else if (st.quality < 0.7) { text = '信号一般'; warn = true; }
  signalEl.textContent = text;
  signalEl.classList.toggle('warn', warn);
}

// ---------- 主循环 ----------
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;

  let st = null;
  let isReplay = false;
  if (replay) {
    st = sampleReplay(now);
    isReplay = !!st;
    if (!st) replay = null;
  }
  if (!st) {
    if (playing) { elapsed += dt; st = engine.tick(dt); }
    else st = engine.last ? { ...engine.last } : engine.tick(0);
  }

  const target = style === 'B' ? mapB(st) : mapA(st);
  const alpha = isReplay ? 1 : 1 - Math.exp(-dt * (2 + st.quality * 7));
  params = params ? lerpParams(params, target, alpha) : { ...target };

  if (style === 'B') drawB(ctx, W, H, st, params, st.time, motif);
  else drawA(ctx, W, H, st, params, st.time);

  if (playing && !isReplay) recordFrame(st);
  if (now - lastHud > 110) { lastHud = now; updateHud(st); }

  requestAnimationFrame(frame);
}

// ---------- 启动 ----------
applyStyle();
resize();
new ResizeObserver(resize).observe(stageWrap);
setMode('sim');
requestAnimationFrame(frame);
