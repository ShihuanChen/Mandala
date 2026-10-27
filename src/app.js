import { StateEngine, PRESETS } from './state.js';
import { mapB, mapB2, mapA, lerpParams } from './mapping.js';
import { drawB } from './styleB.js';
import { drawB2 } from './styleB2.js';
import { createStyleA } from './styleA.js';
import { downloadPNG, downloadJSON, stamp } from './export.js';

const $ = (s) => document.querySelector(s);
const stageWrap = $('#stageWrap');
const canvas = $('#stage');
const glCanvas = $('#stageGL');
const ctx = canvas.getContext('2d', { alpha: false });

const engine = new StateEngine();

let style = 'B';
let motif = 'lotus';
let playing = true;
const paramsBy = {};
let W = 1, H = 1;
let last = performance.now();
let lastHud = 0;
let elapsed = 0;
let lastRec = -1;
let record = [];
let replay = null;
let rendererA = null;

const MOTIF_LABEL = {
  lotus: '花形', mandala: '八重', phoenix: '羽枝',
  cloud: '云气', leaf: '叶形',
};
const MOTIF_SEED = {
  lotus: 20261027, mandala: 7717, phoenix: 9091,
  cloud: 31415, leaf: 27182,
};

const STATE_ROWS = [
  ['activation', '激活度'], ['stability', '稳定度'], ['complexity', '复杂度'],
  ['change', '变化幅度'], ['focus', '集中度'], ['quality', '信号质量'],
];

const PARAM_META = {
  B: [['symmetry', '对称份数', 1], ['shapes', '图元数量', 1], ['lw', '描边宽度', 1],
      ['deform', '形变幅度', 2], ['scale', '主体缩放', 2], ['rotSpeed', '旋转速度', 3]],
  B2: [['sides', '多边形边数', 1], ['layers', '叠层数', 1], ['petals', '中心花瓣', 1],
       ['light', '光强', 2], ['open', '花瓣开合', 2], ['scale', '主体缩放', 2]],
  A: [['symmetry', '对称份数', 1], ['density', '单元密度', 2], ['dispersion', '色散强度', 2],
      ['zoom', '聚焦', 2], ['bloom', '泛光', 2], ['rotSpeed', '旋转速度', 3]],
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

const STYLE_LABEL = {
  B: '典雅 · 满幅平涂',
  B2: '典雅 · 同心投影',
  A: '材质 · 玻璃径向',
};

function applyStyle() {
  const isA = style === 'A';
  stageWrap.classList.toggle('light', !isA);
  canvas.hidden = isA;
  glCanvas.hidden = !isA;
  $('#motifSection').hidden = style !== 'B';
  $('#capStyle').textContent = style === 'B'
    ? `典雅 · 满幅平涂 · ${MOTIF_LABEL[motif]}`
    : STYLE_LABEL[style];
}
styleSeg.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || b.dataset.v === style) return;
  style = b.dataset.v;
  styleSeg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x.dataset.v === style));
  applyStyle();
  resize();
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
  for (const k in paramsBy) delete paramsBy[k];
  record = [];
  replay = null;
  elapsed = 0;
  lastRec = -1;
});

// ---------- 导出 ----------
$('#btnPng').addEventListener('click', () => {
  const tag = style === 'B' ? '平涂' : style === 'B2' ? '投影' : '玻璃';
  downloadPNG(style === 'A' ? glCanvas : canvas, `新中式-${tag}-${stamp()}.png`);
});
$('#btnJson').addEventListener('click', () => {
  downloadJSON({
    version: '0.2', style, motif, mode: engine.mode,
    state: engine.last, params: paramsBy[style] || null,
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
// 两块画布叠在同一舞台里：切到材质版时 2D 画布隐藏、WebGL 画布显示，
// 二者的显示尺寸一致，尺寸只跟舞台走，避免隐藏元素量到 0。
function resize() {
  const r = stageWrap.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  W = Math.max(1, Math.round(r.width));
  H = Math.max(1, Math.round(r.height));
  for (const cv of [canvas, glCanvas]) {
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
  }
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

  const pr = paramsBy[style];
  if (pr) {
    const meta = PARAM_META[style];
    $('#params').innerHTML = meta.map(([k, label, dec]) => {
      const v = pr[k];
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
// WebGL2 不可用时给出可见提示，避免舞台一片空白且无解释
function noticeNoWebGL() {
  if (noticeNoWebGL.done) return;
  noticeNoWebGL.done = true;
  ctx.save();
  ctx.fillStyle = '#E9E5DC';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#6B6355';
  ctx.font = '15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('当前浏览器未启用 WebGL2，材质·玻璃径向不可用', W / 2, H / 2 - 10);
  ctx.fillText('可改用典雅·平涂或典雅·同心投影', W / 2, H / 2 + 16);
  ctx.restore();
}

function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;

  let st = null;
  let isReplay = false;
  if (replay) {
    st = sampleReplay(now);
    isReplay = !!st;
    if (!st) replay = null;
  }  if (!st) {
    if (playing) { elapsed += dt; st = engine.tick(dt); }
    else st = engine.last ? { ...engine.last } : engine.tick(0);
  }

  const target = style === 'B' ? mapB(st) : style === 'B2' ? mapB2(st) : mapA(st);
  const alpha = isReplay ? 1 : 1 - Math.exp(-dt * (2 + st.quality * 7));
  const prev = paramsBy[style];
  const pr = prev ? lerpParams(prev, target, alpha) : { ...target };
  paramsBy[style] = pr;

  if (style === 'B') drawB(ctx, W, H, st, pr, st.time, MOTIF_SEED[motif]);
  else if (style === 'B2') drawB2(ctx, W, H, st, pr, st.time);
  else {
    if (!rendererA) rendererA = createStyleA(glCanvas);
    if (rendererA) rendererA.draw(st, pr, st.time, dt);
    else noticeNoWebGL();
  }

  if (playing && !isReplay) recordFrame(st);
  if (now - lastHud > 110) { lastHud = now; updateHud(st); }

  requestAnimationFrame(frame);
}

// ---------- 启动 ----------
// 支持 index.html?style=B2 直接进某个风格，便于截图与分享单版效果
const qStyle = new URLSearchParams(location.search).get('style');
if (['B', 'B2', 'A'].includes(qStyle)) {
  style = qStyle;
  styleSeg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x.dataset.v === style));
}
applyStyle();
resize();
new ResizeObserver(resize).observe(stageWrap);
setMode('sim');
requestAnimationFrame(frame);
