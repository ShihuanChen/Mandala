// ============================================================
// 形式语言二 · 叠影
// ------------------------------------------------------------
// 同一张图，用"多层套印错位"的方式表达。
// 每层整体微旋、微缩、微移，色温从冷到暖递进，边缘金线逐层减淡；
// 错位处露出前后两层轮廓，读作"重影"，而不是模糊。
// 这与绢本的区别不在图案，在于：绢本是单层、有台阶、有丝理；
// 叠影是多层、半透、靠轮廓重影出层次。
// 全部层都要留清晰的金线，否则错位会糊成色斑（上一版满地的教训）。
// ============================================================

import {
  JX, rgba, mixC, petalPath, twinPetalPath, cloudHeadPath, leafPath,
  seedField, goldEdge,
} from './jingxiu.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function hsl(h, s, l) {
  const ss = clamp(s, 0, 100) / 100;
  const ll = clamp(l, 0, 100) / 100;
  const k = (nn) => (nn + h / 30) % 12;
  const a = ss * Math.min(ll, 1 - ll);
  const f = (nn) => ll - a * Math.max(-1, Math.min(k(nn) - 3, Math.min(9 - k(nn), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

// 漆色：与绢本同一套色序（绛深 / 绛中 / 靛 / 赭浅），只把饱和度推满、明度压低，
// 让金线和重影轮廓去承担亮度。
function palette(pr) {
  const hs = (pr.hueShift - 0.5) * 26;
  const sa = 0.90 + pr.sat * 0.30;
  const lg = 0.92 + pr.light * 0.24;
  const L = (v) => v * lg;
  return {
    c: [
      hsl(5 + hs, 62 * sa, L(30)),
      hsl(9 + hs, 70 * sa, L(43)),
      hsl(216 + hs, 34 * sa, L(28)),
      hsl(26 + hs, 46 * sa, L(52)),
    ],
  };
}

// 冷/暖偏移：warm<0 往青蓝拉，warm>0 往金拉
function tone(c, warm) {
  return warm < 0 ? mixC(c, [46, 96, 132], -warm * 0.55) : mixC(c, [206, 166, 96], warm * 0.42);
}

// 简化瓣：色块 + 三层退晕 + 墨线 + 金线（不画丝理，丝理是绢本的语言）
function petalFlat(g, len, wid, curv, cBase, alpha, lineA) {
  const cDark = mixC(cBase, JX.ink, 0.42);
  const cLite = mixC(cBase, JX.ivory, 0.18);

  petalPath(g, len, wid, curv);
  g.fillStyle = rgba(cDark, alpha);
  g.fill();

  g.save();
  petalPath(g, len, wid, curv);
  g.clip();
  for (let k = 2; k >= 0; k--) {
    const f = k / 2;
    const sc = 0.30 + 0.70 * f;
    g.save();
    g.scale(sc, sc);
    petalPath(g, len, wid, curv);
    g.fillStyle = rgba(mixC(cLite, cDark, f), alpha * 0.72);
    g.fill();
    g.restore();
  }
  // 瓣根一道暗压，避免整瓣浮起来
  const root = g.createLinearGradient(0, 0, len * 0.42, 0);
  root.addColorStop(0, `rgba(6,10,16,${0.50 * alpha})`);
  root.addColorStop(1, 'rgba(6,10,16,0)');
  g.fillStyle = root;
  g.fillRect(-wid * 0.3, -wid * 1.1, len * 0.55, wid * 2.2);
  g.restore();

  petalPath(g, len, wid, curv);
  g.strokeStyle = rgba(JX.ink, 0.62 * lineA);
  g.lineWidth = 1.35;
  g.stroke();
  goldEdge(g, 0.85 * lineA + 0.25, 0.94 * lineA);
}

function pass(g, R, G, P, opt) {
  const { warm, alpha, lineA, rot, scale, dx, dy } = opt;
  const step = TAU / G.n;

  g.save();
  g.translate(dx, dy);
  g.rotate(rot);
  g.scale(scale, scale);

  // 边饰双环
  g.globalAlpha = 1;
  for (const f of G.border.rings) {
    g.beginPath();
    g.arc(0, 0, f * R, 0, TAU);
    goldEdge(g, (f > 0.99 ? 0.95 : 0.62) * lineA, 0.72 * lineA);
  }
  for (const d of G.border.dots) {
    const r = R * d.r;
    g.beginPath();
    g.arc(Math.cos(d.a) * r, Math.sin(d.a) * r, Math.max(0.9, d.rad * R), 0, TAU);
    g.fillStyle = rgba(JX.goldHi, 0.55 * lineA);
    g.fill();
  }

  // 外瓣：短瓣先画，长瓣压上
  const ordered = [...G.outer.petals].sort((a, b) => (a.minor ? 0 : 1) - (b.minor ? 0 : 1));
  for (const p of ordered) {
    const c = tone(P.c[p.cIdx], warm);
    g.save();
    g.rotate(p.a);
    g.translate(G.outer.rIn * R, 0);
    petalFlat(g, p.len * R, p.wid * R, p.curv, c, alpha * (p.minor ? 0.72 : 0.94), lineA);
    g.restore();
  }

  // 缠枝主枝
  const { rMid, amp, lobes, leaves, nodes } = G.vine;
  g.save();
  g.beginPath();
  for (let i = 0; i <= 220; i++) {
    const th = (i / 220) * TAU;
    const rr = (rMid + amp * Math.sin(lobes * th)) * R;
    const x = Math.cos(th) * rr;
    const y = Math.sin(th) * rr;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.strokeStyle = rgba(JX.goldLo, 0.52 * lineA);
  g.lineWidth = 1.6;
  g.stroke();
  g.strokeStyle = rgba(JX.gold, 0.86 * lineA);
  g.lineWidth = 0.9;
  g.stroke();
  g.restore();

  for (const L of leaves) {
    g.save();
    g.translate(Math.cos(L.a) * L.r * R, Math.sin(L.a) * L.r * R);
    g.rotate(L.ang);
    leafPath(g, L.len * R, L.wid * R, 0.46);
    g.fillStyle = rgba(tone(P.c[2], warm), alpha * 0.86);
    g.fill();
    g.strokeStyle = rgba(JX.ink, 0.44 * lineA);
    g.lineWidth = 0.9;
    g.stroke();
    g.restore();
  }

  for (const N of nodes) {
    g.save();
    g.translate(Math.cos(N.a) * N.r * R, Math.sin(N.a) * N.r * R);
    const rr = N.rad * R;
    g.beginPath();
    g.arc(0, 0, rr, 0, TAU);
    g.fillStyle = rgba(mixC(tone(P.c[0], warm), JX.ink, 0.50), alpha * 0.94);
    g.fill();
    g.strokeStyle = rgba(JX.ink, 0.52 * lineA);
    g.lineWidth = 1.1;
    g.stroke();
    goldEdge(g, 0.9 * lineA, 0.86 * lineA);
    g.restore();
  }

  // 内瓣
  for (const p of G.inner.petals) {
    const c = tone(P.c[p.cIdx], warm);
    g.save();
    g.rotate(p.a);
    g.translate(p.r0 * R, 0);
    const len = p.len * R;
    const wid = p.wid * R;
    twinPetalPath(g, len, wid, p.curv);
    g.fillStyle = rgba(mixC(c, JX.ink, 0.30), alpha * 0.94);
    g.fill();
    g.save();
    g.clip();
    for (let k = 1; k >= 0; k--) {
      const sc = 0.36 + 0.64 * k;
      g.save();
      g.scale(sc, sc);
      twinPetalPath(g, len, wid, p.curv);
      g.fillStyle = rgba(mixC(mixC(c, JX.ivory, 0.24), c, k), alpha * 0.62);
      g.fill();
      g.restore();
    }
    g.restore();
    twinPetalPath(g, len, wid, p.curv);
    g.strokeStyle = rgba(JX.ink, 0.52 * lineA);
    g.lineWidth = 1.15;
    g.stroke();
    goldEdge(g, 0.72 * lineA, 0.80 * lineA);
    g.restore();
  }
  for (const f of [G.inner.r0 * 0.94, G.inner.r0 + G.inner.petals[0].len]) {
    g.beginPath();
    g.arc(0, 0, f * R, 0, TAU);
    goldEdge(g, 0.78 * lineA, 0.70 * lineA);
  }

  // 中心
  const rr = G.center.r * R;
  g.beginPath();
  g.arc(0, 0, rr, 0, TAU);
  g.fillStyle = rgba(mixC(tone(P.c[0], warm), JX.ink, 0.44), alpha * 0.95);
  g.fill();
  g.save();
  g.beginPath();
  g.arc(0, 0, rr * 0.94, 0, TAU);
  g.clip();
  seedField(g, -rr, -rr, rr, rr, Math.round(24 + G.grain * 40), rr * 0.075,
    JX.goldHi, seedRnd(G.seed), 0.92 * alpha);
  g.restore();
  g.beginPath();
  g.arc(0, 0, rr, 0, TAU);
  g.strokeStyle = rgba(JX.ink, 0.58 * lineA);
  g.lineWidth = 1.5;
  g.stroke();
  goldEdge(g, 1.15 * lineA, 0.92 * lineA);

  for (const cr of G.center.cross) {
    g.save();
    g.rotate(cr.a);
    petalPath(g, cr.len * R, cr.wid * R, 0.74);
    g.fillStyle = rgba(JX.gold, 0.34 * alpha);
    g.fill();
    goldEdge(g, 0.6 * lineA, 0.62 * lineA);
    g.restore();
  }

  g.restore();
}

function seedRnd(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function drawLacquer(ctx, W, H, G, pr, t) {
  const P = palette(pr);
  const R = Math.min(W, H) * 0.435 * pr.scale;
  const spin = t * G.rot * 0.026 * pr.spinScale;
  const breathe = Math.sin(t * 0.13);

  ctx.save();
  ctx.translate(W * 0.5, H * 0.5);

  // 落影：整组在图下方投一层很淡的模糊暗块，说明它浮着，而不是贴在底上
  ctx.save();
  if ('filter' in ctx) ctx.filter = 'blur(16px)';
  ctx.translate(R * 0.012, R * 0.026);
  ctx.scale(1.01, 1.01);
  ctx.beginPath();
  ctx.arc(0, 0, R * 1.00, 0, TAU);
  ctx.fillStyle = 'rgba(3,6,11,0.62)';
  ctx.fill();
  ctx.restore();

  // 层栈：后层冷、淡、大；前层暖、实、正。
  // 每层必须够淡且错位够小，否则五层叠起来读作"五张图"，而不是"一张图印歪了"。
  const stack = [
    { rot: 0.016 + breathe * 0.002, scale: 1.020, dx: -R * 0.005, dy: -R * 0.004, warm: -0.50, alpha: 0.15, lineA: 0.30 },
    { rot: -0.011 - breathe * 0.002, scale: 1.011, dx: R * 0.004, dy: -R * 0.003, warm: -0.20, alpha: 0.18, lineA: 0.44 },
    { rot: 0.006 + breathe * 0.001, scale: 1.005, dx: -R * 0.002, dy: R * 0.003, warm: 0.06, alpha: 0.20, lineA: 0.58 },
  ];
  if (G.layers >= 5) {
    stack.unshift({ rot: 0.024, scale: 1.032, dx: -R * 0.008, dy: -R * 0.007, warm: -0.70, alpha: 0.12, lineA: 0.22 });
  }

  for (const L of stack) {
    pass(ctx, R, G, P, { ...L, rot: L.rot + spin * 0.22 });
  }
  // 主层：不参与错位，读作"套准"的那一层
  pass(ctx, R, G, P, { rot: spin * 0.22, scale: 1.0, dx: 0, dy: 0, warm: 0.16, alpha: 0.50, lineA: 0.80 });

  ctx.restore();
  ctx.globalAlpha = 1;
}
