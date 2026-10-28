// ============================================================
// 形式语言一 · 绢本
// ------------------------------------------------------------
// 不重新想图案，只回答"同一张图怎么用丝线画出来"。
// 特征是：平涂色块 + 分层退晕的台阶 + 白描墨线 + 盘金收边 + 丝理。
// 这里的关键不是配色，是"每一块颜色都有边、每一层都有台阶"——
// 没有边和台阶，再对的配色也只是矢量插画。
// ============================================================

import {
  JX, rgba, mixC, petalPath, twinPetalPath, cloudHeadPath, leafPath,
  seedField, contourSatin, threadGrain, goldEdge,
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

// 绢本调色：一个主色系（绛 / 赭）+ 一个点缀色（靛），靠明度分层。
// 四色等量轮转会立刻读成彩色拼盘，那是插画不是绣。
function palette(pr) {
  const hs = (pr.hueShift - 0.5) * 24;
  const sa = 0.80 + pr.sat * 0.24;
  const lg = 0.92 + pr.light * 0.26;
  const L = (v) => v * lg;
  return {
    c: [
      hsl(7 + hs, 46 * sa, L(33)),     // 绛 · 深
      hsl(10 + hs, 52 * sa, L(45)),    // 绛 · 中
      hsl(216 + hs, 26 * sa, L(27)),   // 墨青 · 点缀
      hsl(26 + hs, 32 * sa, L(54)),    // 赭 · 浅，主瓣
    ],
    gold: JX.gold,
    goldHi: JX.goldHi,
    ivory: JX.ivory,
    ink: JX.ink,
  };
}

// 单片长瓣：平涂底 → 同心退晕 → 瓣心提亮 → 丝理 → 瓣根收暗 → 瓣尖打籽 → 墨线 → 盘金
function longPetal(g, len, wid, curv, cBase, bands, lw, rnd, seedN, alpha) {
  const cDark = mixC(cBase, JX.ink, 0.34);
  const cLite = mixC(cBase, JX.ivory, 0.20);

  petalPath(g, len, wid, curv);
  g.fillStyle = rgba(cDark, alpha);
  g.fill();

  g.save();
  petalPath(g, len, wid, curv);
  g.clip();

  // 退晕：瓣缘暗、瓣脊亮（凸面受光的读法），层与层之间留台阶。
  // contourSatin 的 cOuter 对应最外圈、cInner 对应最内圈，参数顺序不能反。
  contourSatin(g, (gg, l, w) => petalPath(gg, l, w, curv), len, wid, bands,
    cDark, cLite, alpha);

  // 丝理：沿瓣长的细密短线，是"绣"与"填色"的分界
  threadGrain(g, len, wid, mixC(cBase, JX.ink, 0.30), Math.max(1.2, len * 0.020),
    0.16 * alpha, rnd, mixC(cBase, JX.ivory, 0.50));

  // 瓣根压暗：花瓣是从组织里长出来的，根部不会和瓣尖一样亮
  const root = g.createLinearGradient(0, 0, len * 0.52, 0);
  root.addColorStop(0, `rgba(8,12,18,${0.48 * alpha})`);
  root.addColorStop(0.50, `rgba(8,12,18,${0.15 * alpha})`);
  root.addColorStop(1, 'rgba(8,12,18,0)');
  g.fillStyle = root;
  g.fillRect(-wid * 0.3, -wid * 1.1, len * 1.05, wid * 2.2);

  // 瓣尖打籽：只在最外一小段，成撮不成片。铺满整瓣会读作撒了芝麻。
  if (seedN > 4) {
    seedField(g, len * 0.80, -wid * 0.30, len * 1.02, wid * 0.30,
      seedN, Math.max(0.8, len * 0.016), JX.goldHi, rnd, 0.80 * alpha);
  }
  g.restore();

  petalPath(g, len, wid, curv);
  g.strokeStyle = rgba(JX.ink, 0.58 * alpha);
  g.lineWidth = Math.max(1.0, lw * 1.45);
  g.stroke();
  if (lw > 0.35) goldEdge(g, lw * 0.58, 0.92 * alpha);
}

function ringBorder(g, R, G, pr, P, rnd) {
  g.globalAlpha = pr.alpha * (0.45 + 0.55 * G.border.closure);
  for (const f of G.border.rings) {
    g.beginPath();
    g.arc(0, 0, f * R, 0, TAU);
    goldEdge(g, pr.lw * (f > 0.99 ? 0.60 : 0.36), 0.46 + 0.42 * pr.metal);
  }
  for (const d of G.border.dots) {
    const r = R * d.r;
    g.beginPath();
    g.arc(Math.cos(d.a) * r, Math.sin(d.a) * r, Math.max(0.8, d.rad * R), 0, TAU);
    g.fillStyle = rgba(d.hi ? P.goldHi : P.gold, 0.46);
    g.fill();
  }
  g.globalAlpha = 1;
}

function ringOuter(g, R, G, pr, P, rnd) {
  const { rIn, petals } = G.outer;
  // 短瓣先画，长瓣后画压在上面，空隙才读作"两层瓣"而不是"一层瓣加空格"
  const order = [...petals].sort((a, b) => (a.minor ? 0 : 1) - (b.minor ? 0 : 1));
  for (const p of order) {
    const c = P.c[p.cIdx];
    g.save();
    g.rotate(p.a);
    g.translate(rIn * R, 0);
    g.globalAlpha = pr.alpha * (p.minor ? 0.82 : 0.97);
    longPetal(g, p.len * R, p.wid * R, p.curv, c, p.minor ? Math.max(3, G.layers - 2) : G.layers,
      pr.lw * (p.minor ? 0.8 : 1), rnd,
      p.minor ? 0 : Math.round(3 + G.grain * 7), pr.alpha);
    g.restore();
  }
}

function ringVine(g, R, G, pr, P) {
  const { rMid, amp, lobes, leaves, nodes } = G.vine;
  const steps = 260;
  g.save();
  g.globalAlpha = pr.alpha * 0.90;
  g.beginPath();
  for (let i = 0; i <= steps; i++) {
    const th = (i / steps) * TAU;
    const rr = (rMid + amp * Math.sin(lobes * th)) * R;
    const x = Math.cos(th) * rr;
    const y = Math.sin(th) * rr;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.strokeStyle = rgba(JX.goldLo, 0.48);
  g.lineWidth = Math.max(1.2, pr.lw * 1.3);
  g.stroke();
  g.strokeStyle = rgba(JX.gold, 0.72);
  g.lineWidth = Math.max(0.8, pr.lw * 0.62);
  g.stroke();
  g.restore();

  for (const L of leaves) {
    g.save();
    g.translate(Math.cos(L.a) * L.r * R, Math.sin(L.a) * L.r * R);
    g.rotate(L.ang);
    g.globalAlpha = pr.alpha * 0.86;
    leafPath(g, L.len * R, L.wid * R, 0.46);
    g.fillStyle = rgba(mixC(P.c[2], JX.ink, 0.18), 0.90);
    g.fill();
    g.strokeStyle = rgba(JX.ink, 0.40);
    g.lineWidth = Math.max(0.8, pr.lw * 0.9);
    g.stroke();
    if (pr.lw > 0.9) goldEdge(g, pr.lw * 0.20, 0.50);
    g.restore();
  }

  for (const N of nodes) {
    g.save();
    g.translate(Math.cos(N.a) * N.r * R, Math.sin(N.a) * N.r * R);
    g.globalAlpha = pr.alpha * 0.96;
    const rr = N.rad * R;
    g.beginPath();
    g.arc(0, 0, rr, 0, TAU);
    g.fillStyle = rgba(mixC(P.c[0], JX.ink, 0.52), 0.96);
    g.fill();
    g.save();
    g.beginPath();
    g.arc(0, 0, rr * 0.92, 0, TAU);
    g.clip();
    seedField(g, -rr, -rr, rr, rr, Math.round(7 + G.grain * 14), rr * 0.15,
      mixC(P.gold, P.goldHi, 0.45), rnd2(N.a), 0.78);
    g.restore();
    g.beginPath();
    g.arc(0, 0, rr, 0, TAU);
    g.strokeStyle = rgba(JX.ink, 0.62);
    g.lineWidth = Math.max(1.0, pr.lw * 1.2);
    g.stroke();
    goldEdge(g, pr.lw * 0.46, 0.92);
    g.restore();
  }
}

// 节点内的籽粒需要一个不随帧变化的随机源：用角度做种子
function rnd2(a) {
  let s = Math.round((a + Math.PI) * 99991) >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ringInner(g, R, G, pr, P) {
  for (const p of G.inner.petals) {
    const c = P.c[p.cIdx];
    g.save();
    g.rotate(p.a);
    g.translate(p.r0 * R, 0);
    g.globalAlpha = pr.alpha * 0.95;
    const len = p.len * R;
    const wid = p.wid * R;
    twinPetalPath(g, len, wid, p.curv);
    g.fillStyle = rgba(mixC(c, JX.ink, 0.36), pr.alpha);
    g.fill();
    g.save();
    g.clip();
    contourSatin(g, (gg, l, w) => twinPetalPath(gg, l, w, p.curv), len, wid,
      Math.max(2, G.layers - 1), mixC(c, JX.ink, 0.50), mixC(c, JX.ivory, 0.24), pr.alpha);
    g.restore();
    twinPetalPath(g, len, wid, p.curv);
    g.strokeStyle = rgba(JX.ink, 0.50);
    g.lineWidth = Math.max(1.0, pr.lw * 1.15);
    g.stroke();
    goldEdge(g, pr.lw * 0.32, 0.82);
    g.restore();
  }
  // 内环的两道金圈
  g.globalAlpha = pr.alpha * 0.88;
  for (const f of [G.inner.r0 * 0.94, G.inner.r0 + G.inner.petals[0].len]) {
    g.beginPath();
    g.arc(0, 0, f * R, 0, TAU);
    goldEdge(g, pr.lw * 0.36, 0.46 + 0.34 * pr.metal);
  }
  g.globalAlpha = 1;
}

function centerPad(g, R, G, pr, P, rnd) {
  const rr = G.center.r * R;
  g.globalAlpha = pr.alpha * 0.97;
  g.beginPath();
  g.arc(0, 0, rr, 0, TAU);
  g.fillStyle = rgba(mixC(P.c[0], JX.ink, 0.46), 0.92);
  g.fill();
  g.save();
  g.beginPath();
  g.arc(0, 0, rr * 0.95, 0, TAU);
  g.clip();
  seedField(g, -rr, -rr, rr, rr, Math.round(26 + G.grain * 58), rr * 0.058,
    mixC(P.goldHi, P.ivory, 0.14), rnd, 0.92);
  g.restore();
  g.beginPath();
  g.arc(0, 0, rr, 0, TAU);
  g.strokeStyle = rgba(JX.ink, 0.55);
  g.lineWidth = Math.max(1.2, pr.lw * 1.4);
  g.stroke();
  goldEdge(g, pr.lw * 0.56, 0.94);

  for (const cr of G.center.cross) {
    g.save();
    g.rotate(cr.a);
    petalPath(g, cr.len * R, cr.wid * R, 0.74);
    g.fillStyle = rgba(P.gold, 0.40 * pr.alpha);
    g.fill();
    goldEdge(g, pr.lw * 0.26, 0.66);
    g.restore();
  }
  g.globalAlpha = 1;
}

// 极淡的经纬：母题内部才有，不覆盖背景，读作"绣在绢上"
function clothWeave(g, R, pr) {
  g.save();
  g.beginPath();
  g.arc(0, 0, R * 1.02, 0, TAU);
  g.clip();
  g.globalAlpha = 0.055 * pr.alpha;
  g.strokeStyle = 'rgba(214,200,176,1)';
  g.lineWidth = 0.6;
  const step = Math.max(3, R * 0.012);
  for (let x = -R; x <= R; x += step) {
    g.beginPath();
    g.moveTo(x, -R);
    g.lineTo(x, R);
    g.stroke();
  }
  g.globalAlpha = 0.038 * pr.alpha;
  for (let y = -R; y <= R; y += step) {
    g.beginPath();
    g.moveTo(-R, y);
    g.lineTo(R, y);
    g.stroke();
  }
  g.restore();
  g.globalAlpha = 1;
}

export function drawSilk(ctx, W, H, G, pr, t) {
  const rnd = rnd2(G.seed);
  const P = palette(pr);
  const R = Math.min(W, H) * 0.435 * pr.scale * (1 + 0.014 * Math.sin(t * 0.19));
  const spin = t * G.rot * 0.026 * pr.spinScale;

  ctx.save();
  ctx.translate(W * 0.5, H * 0.5);

  // 极弱外晕：让母题浮在空间里，而不是压在背景上
  const halo = ctx.createRadialGradient(0, 0, R * 0.10, 0, 0, R * 1.30);
  halo.addColorStop(0, `rgba(170, 150, 108, ${0.055 * pr.alpha})`);
  halo.addColorStop(0.55, `rgba(88, 112, 128, ${0.028 * pr.alpha})`);
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, R * 1.32, 0, TAU);
  ctx.fill();

  clothWeave(ctx, R, pr);

  ctx.save(); ctx.rotate(spin * G.spin.border); ringBorder(ctx, R, G, pr, P, rnd); ctx.restore();
  ctx.save(); ctx.rotate(spin * G.spin.outer); ringOuter(ctx, R, G, pr, P, rnd); ctx.restore();
  ctx.save(); ctx.rotate(spin * G.spin.vine); ringVine(ctx, R, G, pr, P); ctx.restore();
  ctx.save(); ctx.rotate(spin * G.spin.inner); ringInner(ctx, R, G, pr, P); ctx.restore();
  ctx.save(); ctx.rotate(spin * G.spin.center); centerPad(ctx, R, G, pr, P, rnd); ctx.restore();

  ctx.restore();
  ctx.globalAlpha = 1;
}
