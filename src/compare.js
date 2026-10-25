import { StateEngine } from './state.js';
import { mapB, mapA, lerpParams } from './mapping.js';
import { drawB } from './styleB.js';
import { drawA } from './styleA.js';
import { downloadPNG, stamp } from './export.js';

const $ = (s) => document.querySelector(s);

const engine = new StateEngine();
let playing = true;
let paramsB = null;
let paramsA = null;
let last = performance.now();

const cvB = $('#cvB'), cvA = $('#cvA');
const ctxB = cvB.getContext('2d', { alpha: false });
const ctxA = cvA.getContext('2d', { alpha: false });
let boxB = { w: 1, h: 1 }, boxA = { w: 1, h: 1 };

function fit(canvas, ctx) {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(1, Math.round(r.width));
  const h = Math.max(1, Math.round(r.height));
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w, h };
}

function resize() {
  boxB = fit(cvB, ctxB);
  boxA = fit(cvA, ctxA);
}

function caption(st) {
  if (st.quality < 0.35) return '信号微弱，画面正在保持';
  if (st.focus > 0.82) return '视线正在集中';
  if (st.activation > 0.68 && st.change > 0.32) return '结构正在向外展开';
  if (st.change > 0.48) return '线条正在寻找新的路径';
  if (st.stability > 0.74 && st.activation < 0.42) return '纹样正在安静下来';
  return '纹样正在缓慢呼吸';
}

function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;

  const st = playing ? engine.tick(dt) : (engine.last ? { ...engine.last } : engine.tick(0));
  const alpha = 1 - Math.exp(-dt * (2 + st.quality * 7));

  const tB = mapB(st);
  const tA = mapA(st);
  paramsB = paramsB ? lerpParams(paramsB, tB, alpha) : { ...tB };
  paramsA = paramsA ? lerpParams(paramsA, tA, alpha) : { ...tA };

  drawB(ctxB, boxB.w, boxB.h, st, paramsB, st.time, 'lotus');
  drawA(ctxA, boxA.w, boxA.h, st, paramsA, st.time);

  const text = caption(st);
  $('#capB').textContent = text;
  $('#capA').textContent = text;

  requestAnimationFrame(frame);
}

$('#cPresets').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  engine.setPreset(b.dataset.v);
  $('#cPresets').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x.dataset.v === b.dataset.v));
});

$('#cPlay').addEventListener('click', (e) => {
  playing = !playing;
  e.currentTarget.textContent = playing ? '暂停' : '继续';
});

$('#cPngB').addEventListener('click', () => downloadPNG(cvB, `新中式-典雅-${stamp()}.png`));
$('#cPngA').addEventListener('click', () => downloadPNG(cvA, `新中式-材质-${stamp()}.png`));

resize();
new ResizeObserver(resize).observe(document.querySelector('.compare-body'));
requestAnimationFrame(frame);
