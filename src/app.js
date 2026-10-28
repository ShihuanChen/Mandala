import { StateEngine, PRESETS } from './state.js';
import { mapSilk, mapLac, mapGlass, mapP, lerpParams } from './mapping.js';
import { buildMandala, geometryParams } from './mandala.js';
import { drawSilk } from './silk.js';
import { drawLacquer } from './lacquer.js';
import { createGlass } from './glass.js';
import { createAtmos } from './atmos.js';
import { downloadPNG, downloadJSON, stamp } from './export.js';

const $ = (s) => document.querySelector(s);
const stageWrap = $('#stageWrap');
const canvas = $('#stage');
const glCanvas = $('#stageGL');
const ctx = canvas.getContext('2d', { alpha: false });

const engine = new StateEngine();
const atmos = createAtmos(20261028);

// 一个图案，三种形式语言。silk = 绢本平涂，lac = 套印叠影，glass = 折光琉璃
let style = 'silk';
let playing = true;
const paramsBy = {};
let W = 1, H = 1;
let last = performance.now();
let lastHud = 0;
let elapsed = 0;
let lastRec = -1;
let record = [];
let replay = null;
let rendererGlass = null;

const SEED = 20261028;

const STYLE_LABEL = {
  silk: '平涂 · 绢本',
  lac: '叠影 · 套印',
  glass: '折光 · 琉璃',
};

const STATE_ROWS = [
  ['activation', '激活度'], ['stability', '稳定度'], ['complexity', '复杂度'],
  ['change', '变化幅度'], ['focus', '集中度'], ['quality', '信号质量'],
];

// 参数面板按规范的六层显示（P1–P20），证明映射链路是活的
const LAYER_ROWS = [
  ['色彩', [['P1_hue', '色相'], ['P3_saturation', '饱和'], ['P2_lightness', '明度']]],
  ['形态', [['P6_straightRatio', '直曲'], ['P7_curvature', '曲率'], ['P8_sharpness', '尖锐']]],
  ['密度', [['P9_coverage', '覆盖'], ['P10_grain', '颗粒'], ['P11_layers', '层数']]],
  ['结构', [['P13_centerEmphasis', '中心'], ['P14_radialRepeat', '径向'], ['P16_closure', '闭合']]],
  ['材质', [['P17_lineWidth', '线宽'], ['P18_metal', '高光'], ['P19_transparency', '透明']]],
  ['动态', [['P20_rotSpeed', '旋转'], ['P20_grow', '生长'], ['P20_jitter', '扰动']]],
];

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
  const isGlass = style === 'glass';
  canvas.hidden = isGlass;
  glCanvas.hidden = !isGlass;
  $('#capStyle').textContent = STYLE_LABEL[style];
}

styleSeg.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || b.dataset.v === style) return;
  style = b.dataset.v;
  styleSeg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x.dataset.v === style));
  applyStyle();
  resize();
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
  downloadPNG(style === 'glass' ? glCanvas : canvas, `新中式-${STYLE_LABEL[style]}-${stamp()}.png`);
});
$('#btnJson').addEventListener('click', () => {
  downloadJSON({
    version: '0.5', style, mode: engine.mode,
    state: engine.last, params: paramsBy[style] || null,
  }, `state-${stamp()}.json`);
});
$('#btnSession').addEventListener('click', () => {
  if (record.length < 2) return flashHint('会话记录不足，先播放一会儿再保存。');
  downloadJSON({ version: '0.2', style, frames: record }, `session-${stamp()}.json`);
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

  const P = mapP(st);
  $('#params').innerHTML = LAYER_ROWS.map(([layer, items]) => {
    const cells = items.map(([k, label]) =>
      `<span class="pcell">${label}<b>${P[k].toFixed(2)}</b></span>`).join('');
    return `<div class="player"><span>${layer}</span><div>${cells}</div></div>`;
  }).join('');

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
function noticeNoWebGL() {
  if (noticeNoWebGL.done) return;
  noticeNoWebGL.done = true;
  ctx.save();
  ctx.fillStyle = '#070A10';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#C8BFA8';
  ctx.font = '15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('当前浏览器未启用 WebGL2，折光版不可用', W / 2, H / 2 - 10);
  ctx.fillText('切到平涂或叠影即可', W / 2, H / 2 + 16);
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
  }
  if (!st) {
    if (playing) { elapsed += dt; st = engine.tick(dt); }
    else st = engine.last ? { ...engine.last } : engine.tick(0);
  }

  // 图案只有一份：三个渲染器读同一个 G
  const G = buildMandala(geometryParams(st), SEED);

  const target = style === 'silk' ? mapSilk(st) : style === 'lac' ? mapLac(st) : mapGlass(st);
  const alpha = isReplay ? 1 : 1 - Math.exp(-dt * (0.8 + st.quality * 1.5));
  const prev = paramsBy[style];
  const pr = prev ? lerpParams(prev, target, alpha) : { ...target };
  paramsBy[style] = pr;

  if (style === 'glass') {
    if (!rendererGlass) rendererGlass = createGlass(glCanvas);
    if (rendererGlass) rendererGlass.draw(G, pr, st.time, dt, st);
    else noticeNoWebGL();
  } else {
    atmos.draw(ctx, W, H, st, st.time, { airy: 0.72 });
    if (style === 'silk') drawSilk(ctx, W, H, G, pr, st.time);
    else drawLacquer(ctx, W, H, G, pr, st.time);
  }

  if (playing && !isReplay) recordFrame(st);
  if (now - lastHud > 110) { lastHud = now; updateHud(st); }

  requestAnimationFrame(frame);
}

// ---------- 启动 ----------
const qStyle = new URLSearchParams(location.search).get('style');
if (['silk', 'lac', 'glass'].includes(qStyle)) {
  style = qStyle;
  styleSeg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x.dataset.v === style));
}
applyStyle();
resize();
new ResizeObserver(resize).observe(stageWrap);
setMode('sim');
requestAnimationFrame(frame);
