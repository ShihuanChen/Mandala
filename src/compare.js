import { StateEngine } from './state.js';
import { mapSilk, mapLac, mapGlass, lerpParams } from './mapping.js';
import { buildMandala, geometryParams } from './mandala.js';
import { drawSilk } from './silk.js';
import { drawLacquer } from './lacquer.js';
import { createGlass } from './glass.js';
import { createAtmos } from './atmos.js';
import { downloadPNG, stamp } from './export.js';

const $ = (s) => document.querySelector(s);

const engine = new StateEngine();
const atmos = createAtmos(20261028);
let playing = true;
const params = { silk: null, lac: null, glass: null };
let last = performance.now();
const SEED = 20261028;

const cv1 = $('#cv1'), cv2 = $('#cv2'), cv3 = $('#cv3');
const ctx1 = cv1.getContext('2d', { alpha: false });
const ctx2 = cv2.getContext('2d', { alpha: false });
let rendererGlass = null;
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

  // 三栏共用一个图案实例：同一个 seed、同一套几何参数
  const G = buildMandala(geometryParams(st), SEED);

  params.silk = params.silk ? lerpParams(params.silk, mapSilk(st), alpha) : { ...mapSilk(st) };
  params.lac = params.lac ? lerpParams(params.lac, mapLac(st), alpha) : { ...mapLac(st) };
  params.glass = params.glass ? lerpParams(params.glass, mapGlass(st), alpha) : { ...mapGlass(st) };

  atmos.draw(ctx1, box.w, box.h, st, st.time, { airy: 0.72 });
  drawSilk(ctx1, box.w, box.h, G, params.silk, st.time);

  atmos.draw(ctx2, box.w, box.h, st, st.time, { airy: 0.72 });
  drawLacquer(ctx2, box.w, box.h, G, params.lac, st.time);

  if (!rendererGlass) rendererGlass = createGlass(cv3);
  if (rendererGlass) rendererGlass.draw(G, params.glass, st.time, dt, st);
  else if (!warned) {
    warned = true;
    const g3 = cv3.getContext('2d');
    if (g3) {
      g3.fillStyle = '#070A10';
      g3.fillRect(0, 0, cv3.width, cv3.height);
      g3.fillStyle = '#C8BFA8';
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
$('#cPng2').addEventListener('click', () => downloadPNG(cv2, `新中式-叠影-${stamp()}.png`));
$('#cPng3').addEventListener('click', () => downloadPNG(cv3, `新中式-折光-${stamp()}.png`));

resize();
new ResizeObserver(resize).observe(document.querySelector('.compare-body'));
requestAnimationFrame(frame);
