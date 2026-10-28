// 风格 B2 · 京绣满地（Canvas 2D）
// 结构：不是一枚团花，而是一片"满地"——同一枚小团花在斜向格点上重复，
//       按景深排序后由远及近叠加，远者弱小、近者实大。
// 材质：填充走 screen 混合。深底上 screen 让重叠处变亮，读作多层透光织物叠在一起；
//       盘金描边保持 source-over，才不会被叠亮冲掉。
// 疏密：格点间距（P15）、可见单元比例（P9）、籽粒密度（P10）三项控制。
//       间距必须大于单元直径，否则整片糊成光斑——上一版就是栽在这里。

import {
  JX, rgba, mixC, roundPetal, twinPetalPath, seedField, contourSatin, goldEdge,
} from './jingxiu.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function rand(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hsl(h, s, l) {
  const ss = clamp(s, 0, 100) / 100;
  const ll = clamp(l, 0, 100) / 100;
  const k = (n) => (n + h / 30) % 12;
  const a = ss * Math.min(ll, 1 - ll);
  const f = (n) => ll - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

function palette(pr) {
  const hs = (pr.hueShift - 0.5) * 26;
  const sa = 0.86 + pr.sat * 0.30;
  const lg = 0.90 + pr.light * 0.26;
  const L = (v) => v * lg;
  return [
    hsl(5 + hs, 68 * sa, L(38)),     // 绛
    hsl(221 + hs, 54 * sa, L(36)),   // 宝蓝
    hsl(158 + hs, 32 * sa, L(33)),   // 石绿
    hsl(332 + hs, 30 * sa, L(50)),   // 藕荷
    hsl(40 + hs, 50 * sa, L(52)),    // 金
  ];
}

// 一枚小团花：外瓣一圈（同心退晕）+ 内瓣一圈 + 金圈 + 打籽心
function medallion(g, R, n, bands, grain, goldW, cols, alpha, rnd) {
  const outer = cols.slice();
  g.globalCompositeOperation = 'source-over';

  // 外瓣
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const c = outer[i % outer.length];
    g.save();
    g.rotate(a);
    g.globalAlpha = alpha * 0.62;
    roundPetal(g, R, R * (TAU / n) * 0.62);
    g.fillStyle = rgba(mixC(c, JX.ink, 0.30), 0.9);
    g.fill();
    g.save();
    roundPetal(g, R, R * (TAU / n) * 0.62);
    g.clip();
    contourSatin(g, (gg, l, w) => roundPetal(gg, l, w), R, R * (TAU / n) * 0.62,
      bands, mixC(c, JX.ivory, 0.24), mixC(c, JX.ink, 0.52), 0.85);
    g.restore();
    g.restore();
  }

  // 内瓣：小一号，反向错开
  const ni = Math.max(4, Math.round(n * 0.75));
  for (let i = 0; i < ni; i++) {
    const a = (i / ni) * TAU + Math.PI / ni;
    g.save();
    g.rotate(a);
    g.globalAlpha = alpha * 0.52;
    twinPetalPath(g, R * 0.44, R * (TAU / ni) * 0.46, 0.55);
    g.fillStyle = rgba(cols[(i + 2) % cols.length], 0.85);
    g.fill();
    g.restore();
  }

  // 中心：金圈 + 少量籽
  g.save();
  g.globalAlpha = alpha * 0.85;
  g.beginPath();
  g.arc(0, 0, R * 0.26, 0, TAU);
  g.clip();
  seedField(g, -R * 0.28, -R * 0.28, R * 0.28, R * 0.28,
    Math.round(4 + grain * 9), Math.max(0.6, R * 0.030), JX.goldLo, rnd, 0.55);
  g.restore();

  // 盘金
  g.save();
  g.globalAlpha = alpha * 0.92;
  g.beginPath();
  g.arc(0, 0, R * 0.34, 0, TAU);
  goldEdge(g, 1.15 + goldW * 0.55, 0.75);
  if (goldW > 0.45) {
    for (let i = 0; i < n; i++) {
      g.save();
      g.rotate((i / n) * TAU);
      roundPetal(g, R, R * (TAU / n) * 0.62);
      goldEdge(g, 0.85 + goldW * 0.35, 0.62);
      g.restore();
    }
  }
  g.restore();
}

export function drawB2(ctx, W, H, st, pr, t) {
  const rnd = rand(70921);
  const cols = palette(pr);
  const minDim = Math.min(W, H);

  // 格点：间距必须大于单元直径，单元才不会互相吃掉
  const gap = clamp(pr.gap, 0.18, 0.95);
  const spacing = minDim * (0.175 + (1 - gap) * 0.055);
  const R = spacing * (0.40 + pr.open * 0.10);

  const driftX = ((t * pr.rotSpeed * 0.55) % 1) * spacing;
  const driftY = ((t * pr.rotSpeed * 0.32) % 1) * spacing;

  const colsN = Math.ceil(W / spacing) + 3;
  const rowsN = Math.ceil(H / (spacing * 0.88)) + 3;

  const items = [];
  for (let j = 0; j < rowsN; j++) {
    for (let i = 0; i < colsN; i++) {
      const off = (j % 2) * 0.5;
      const x = (i + off) * spacing - spacing * 1.4 + driftX;
      const y = j * spacing * 0.88 - spacing * 1.4 + driftY;
      items.push({ x, y, d: rnd(), ph: rnd() * TAU });
    }
  }
  items.sort((a, b) => a.d - b.d);

  for (const it of items) {
    const depth = it.d;
    // 只画被密度允许的部分，且近层一定保留
    if (depth < 0.55 && rnd() > pr.units) continue;

    const scale = 0.66 + depth * 0.52;
    const a = pr.alpha * (0.26 + depth * 0.62);
    if (a < 0.03) continue;

    ctx.save();
    ctx.translate(it.x, it.y);
    ctx.rotate(it.ph * 0.12 + t * pr.rotSpeed * (0.10 + depth * 0.34));
    ctx.scale(scale, scale);
    medallion(ctx, R,
      Math.max(5, Math.round(pr.sides * (0.62 + depth * 0.44))),
      Math.max(2, Math.round(pr.layers * (0.6 + depth * 0.7))),
      pr.grain, depth > 0.5 ? pr.goldW : 0, cols, a, rnd);
    ctx.restore();
  }

  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}
