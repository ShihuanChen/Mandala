import { StateEngine } from './state.js';
import { mapB, mapB2, mapA, lerpParams } from './mapping.js';
import { drawB } from './styleB.js';
import { drawB2 } from './styleB2.js';
import { createStyleA } from './styleA.js';
import { downloadPNG, stamp } from './export.js';

const $ = (s) => document.querySelector(s);

const engine = new StateEngine();
let playing = true;
const params = { B: null, B2: null, A: null };
let last = performance.now();

const cv1 = $('#cv1'), cv2 = $('#cv2'), cv3 = $('#cv3');
const ctx1 = cv1.getContext('2d', { alpha: false });
const ctx2 = cv2.getContext('2d', { alpha: false });
let rendererA = null;
let warned = false;
let box = { w: 1, h: 1 };

function fit(canvas, ctx) {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(1, Math.round(r.width));
  const h = Math.max(1, Math.round(r.height));
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w, h };
}

function resize() {
  box = fit(cv1, ctx1);
  fit(cv2, ctx2);
  fit(cv3);
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

  params.B = params.B ? lerpParams(params.B, mapB(st), alpha) : { ...mapB(st) };
  params.B2 = params.B2 ? lerpParams(params.B2, mapB2(st), alpha) : { ...mapB2(st) };
  params.A = params.A ? lerpParams(params.A, mapA(st), alpha) : { ...mapA(st) };

  drawB(ctx1, box.w, box.h, st, params.B, st.time, 20261027);
  drawB2(ctx2, box.w, box.h, st, params.B2, st.time);
  if (!rendererA) rendererA = createStyleA(cv3);
  if (rendererA) rendererA.draw(st, params.A, st.time, dt);
  else if (!warned) {
    warned = true;
    const g3 = cv3.getContext('2d');
    if (g3) {
      g3.fillStyle = '#E9E5DC';
      g3.fillRect(0, 0, cv3.width, cv3.height);
      g3.fillStyle = '#6B6355';
      g3.font = '14px system-ui, sans-serif';
      g3.textAlign = 'center';
      g3.fillText('浏览器未启用 WebGL2，此栏不可用', cv3.width / 2, cv3.height / 2);
    }
  }

  const text = caption(st);
  $('#cap1').textContent = text;
  $('#cap2').textContent = text;
  $('#cap3').textContent = text;

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

$('#cPng1').addEventListener('click', () => downloadPNG(cv1, `新中式-平涂-${stamp()}.png`));
$('#cPng2').addEventListener('click', () => downloadPNG(cv2, `新中式-投影-${stamp()}.png`));
$('#cPng3').addEventListener('click', () => downloadPNG(cv3, `新中式-玻璃-${stamp()}.png`));

resize();
new ResizeObserver(resize).observe(document.querySelector('.compare-body'));
requestAnimationFrame(frame);
