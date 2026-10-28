// 风格 B · 京绣团花（Canvas 2D）
// 只画母题，不画底：底层由 atmos.js 提供通透空间，本层用 globalAlpha 叠上去，
// 因此空隙处能看见背景粒子在动，这是"通透"的一半。
//
// 团花定式（京绣），五个母题共用同一套环带骨架，只换环带里的针法：
//   边饰环  R 0.955–1.00  盘金双线 + 打籽点
//   外瓣环  R 0.60–0.955  长瓣，套针退晕，尖端起籽，瓣间云头
//   缠枝环  R 0.44–0.56   一条正弦波状的盘金主枝，沿枝生叶，节点压牡丹
//   内瓣环  R 0.22–0.41   宝相双裂瓣，退晕
//   中心    R 0–0.155     打籽饼 + 四瓣十字

import {
  JX, rgba, mixC, petalPath, roundPetal, twinPetalPath, cloudHeadPath,
  waveTeethPath, seedField, satinBands, contourSatin, threadGrain,
  goldEdge, flatGold, peony,
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

// 京绣重彩：绛红为骨、宝蓝为衬、明黄为筋、石绿为叶、藕荷为间
function palette(pr) {
  const hs = (pr.hueShift - 0.5) * 26;
  const sa = 0.86 + pr.sat * 0.30;
  const lg = 0.90 + pr.light * 0.28;
  const L = (v) => v * lg;
  return {
    scarletLo: hsl(4 + hs, 62 * sa, L(26)),
    scarlet: hsl(5 + hs, 70 * sa, L(36)),
    scarletHi: hsl(7 + hs, 74 * sa, L(48)),
    blueLo: hsl(222 + hs, 52 * sa, L(24)),
    blue: hsl(221 + hs, 56 * sa, L(34)),
    blueHi: hsl(218 + hs, 58 * sa, L(46)),
    greenLo: hsl(158 + hs, 32 * sa, L(22)),
    green: hsl(158 + hs, 34 * sa, L(31)),
    greenHi: hsl(156 + hs, 36 * sa, L(44)),
    lotus: hsl(332 + hs, 30 * sa, L(48)),
    lotusHi: hsl(330 + hs, 34 * sa, L(60)),
    gold: JX.gold,
    goldHi: JX.goldHi,
    ivory: hsl(44 + hs, 20 * sa, L(88)),
  };
}

const COL_IN = (p) => [p.scarlet, p.blue, p.scarlet, p.green];
const COL_ACC = (p) => [p.blue, p.lotus, p.scarlet, p.green];

// 单枚长瓣：套针底 + 尖端起籽 + 墨线压边 + 盘金
function longPetal(g, len, wid, curv, c0, c1, bands, goldW, rnd, seedN) {
  petalPath(g, len, wid, curv);
  g.fillStyle = rgba(c0, 0.94);
  g.fill();
  g.save();
  petalPath(g, len, wid, curv);
  g.clip();
  // 同心轮廓退晕：外深内亮，读作一层层压出来的针脚
  contourSatin(g, (gg, l, w) => petalPath(gg, l, w, curv), len, wid, bands,
    mixC(c1, JX.ivory, 0.30), mixC(c0, JX.ink, 0.46), 1);
  // 丝理
  threadGrain(g, len, wid, mixC(c0, JX.ink, 0.35), Math.max(1.6, len * 0.022), 0.20, rnd,
    mixC(c1, JX.ivory, 0.45));
  // 丝理
  threadGrain(g, len, wid, mixC(c0, JX.ink, 0.35), Math.max(1.6, len * 0.022), 0.20, rnd,
    mixC(c1, JX.ivory, 0.45));
  // 瓣根压暗：瓣从组织里长出来，根部不会和瓣尖一样亮
  const root = g.createLinearGradient(0, 0, len * 0.55, 0);
  root.addColorStop(0, 'rgba(6,10,16,0.42)');
  root.addColorStop(0.55, 'rgba(6,10,16,0.16)');
  root.addColorStop(1, 'rgba(6,10,16,0)');
  g.fillStyle = root;
  g.fillRect(-wid * 0.2, -wid, len, wid * 2);
  if (seedN > 0) {
    seedField(g, len * 0.60, -wid * 0.50, len * 1.02, wid * 0.50, seedN, len * 0.022, JX.goldHi, rnd, 0.90);
  }
  g.restore();
  petalPath(g, len, wid, curv);
  g.strokeStyle = rgba(JX.ink, 0.55);
  g.lineWidth = Math.max(1.4, goldW * 1.5);
  g.stroke();
  if (goldW > 0.4) goldEdge(g, goldW * 0.42, 0.92);
}

// 外瓣环：从内圈起笔向外展开
function ringOuter(g, R, pr, rnd, motif) {
  const n = Math.max(6, Math.round(pr.symmetry));
  const step = TAU / n;
  const p = pr.pal;
  const rIn = R * 0.600;
  const len = R * 0.350;
  const wid = R * step * 0.44;
  for (let i = 0; i < n; i++) {
    const a = i * step - Math.PI / 2;
    // 四分之一处换藕荷，避免整圈变成色轮
    const major = i % 4 === 0;
    const c0 = (i % 4 === 3) ? p.lotus : COL_IN(p)[i % 4];
    const c1 = i % 2 ? mixC(c0, JX.ivory, 0.24) : mixC(c0, p.gold, 0.20);
    g.save();
    g.rotate(a);
    g.translate(rIn, 0);
    g.globalAlpha = pr.alpha * 0.96;

    if (motif === 'fenghuang') {
      // 凤凰羽：三根细羽，端部压眼斑
      for (let k = -1; k <= 1; k++) {
        g.save();
        g.rotate(k * 0.085);
        longPetal(g, len * (1 - 0.09 * Math.abs(k)), wid * 0.30, 0.26, c0, c1, pr.layers * 0.8, pr.lw, rnd, 0);
        g.restore();
      }
      g.save();
      g.translate(len * 1.0, 0);
      const er = wid * 0.46;
      g.beginPath(); g.arc(0, 0, er, 0, TAU);
      g.fillStyle = rgba(p.gold, 0.90); g.fill();
      g.beginPath(); g.arc(0, 0, er * 0.52, 0, TAU);
      g.fillStyle = rgba(p.blueLo, 0.96); g.fill();
      goldEdge(g, pr.lw * 0.36, 0.9);
      g.restore();
    } else if (motif === 'haishui') {
      // 海水江崖：浪牙
      waveTeethPath(g, len * 0.16, len * 1.02, 3, 0.14);
      g.fillStyle = rgba(i % 2 ? p.blue : p.blueLo, 0.90);
      g.fill();
      if (pr.metal > 0.3) flatGold(g, -wid, -wid, len, wid, pr.lw * 2.4, a, 0.40 * pr.metal, rnd);
      goldEdge(g, pr.lw * 0.40, 0.85);
    } else {
      // 主瓣更长更宽，隔四瓣一次；再叠一点长度随机，避免读成一圈等距挂珠
      const jl = 0.93 + 0.13 * rnd();
      const ml = (major ? 1.10 : 0.94) * jl;
      const mw = (major ? 1.12 : 0.94) * (0.96 + 0.08 * jl);
      longPetal(g, len * ml, wid * mw, 0.36 + 0.34 * pr.deform, c0, c1,
        major ? pr.layers + 1 : pr.layers, pr.lw, rnd,
        Math.round(7 + pr.grain * 18));
      // 瓣间云头，京绣边饰的呼吸点
      g.save();
      g.rotate(step * 0.5);
      g.translate(-R * 0.030, 0);
      cloudHeadPath(g, R * 0.085, wid * 0.30);
      g.fillStyle = rgba(p.ivory, 0.22);
      g.fill();
      goldEdge(g, pr.lw * 0.30, 0.50);
      g.restore();
    }
    g.restore();
  }
}

// 缠枝环：一条正弦波状的盘金主枝 + 叶 + 节点牡丹
function ringVine(g, R, pr, rnd, motif) {
  const p = pr.pal;
  const lobes = Math.max(3, Math.round(pr.symmetry * 0.5));
  const rMid = R * 0.500;
  const amp = R * 0.048;
  const steps = 220;

  g.save();
  g.globalAlpha = pr.alpha * 0.92;
  g.beginPath();
  for (let i = 0; i <= steps; i++) {
    const th = (i / steps) * TAU;
    const rr = rMid + amp * Math.sin(lobes * th);
    const x = Math.cos(th) * rr;
    const y = Math.sin(th) * rr;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.strokeStyle = rgba(JX.goldLo, 0.55);
  g.lineWidth = Math.max(1.6, pr.lw * 1.5);
  g.stroke();
  g.strokeStyle = rgba(JX.gold, 0.80);
  g.lineWidth = Math.max(0.9, pr.lw * 0.7);
  g.stroke();
  g.restore();

  // 沿枝生叶
  const leaves = Math.max(8, lobes * 3);
  for (let i = 0; i < leaves; i++) {
    const th = (i / leaves) * TAU;
    const rr = rMid + amp * Math.sin(lobes * th);
    const side = i % 2 ? 1 : -1;
    g.save();
    g.translate(Math.cos(th) * rr, Math.sin(th) * rr);
    g.rotate(th + side * (0.55 + 0.35 * rnd()));
    g.globalAlpha = pr.alpha * 0.90;
    const lr = R * (0.055 + 0.022 * pr.slots);
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(lr * 0.34, -lr * 0.40, lr * 0.86, -lr * 0.22, lr, 0);
    g.bezierCurveTo(lr * 0.86, lr * 0.22, lr * 0.34, lr * 0.40, 0, 0);
    g.closePath();
    g.fillStyle = rgba(i % 3 === 0 ? p.greenHi : p.green, 0.86);
    g.fill();
    if (pr.lw > 1.1) goldEdge(g, pr.lw * 0.28, 0.55);
    g.restore();
  }

  // 节点牡丹
  for (let i = 0; i < lobes; i++) {
    const th = (i / lobes) * TAU + Math.PI / lobes;
    const rr = rMid + amp * Math.sin(lobes * th);
    g.save();
    g.translate(Math.cos(th) * rr, Math.sin(th) * rr);
    g.globalAlpha = pr.alpha * 0.97;
    if (motif === 'dazi') {
      const sr = R * 0.062;
      g.beginPath(); g.arc(0, 0, sr, 0, TAU);
      g.fillStyle = rgba(p.scarlet, 0.90); g.fill();
      g.save();
      g.beginPath(); g.arc(0, 0, sr, 0, TAU); g.clip();
      seedField(g, -sr, -sr, sr, sr, Math.round(12 + pr.grain * 26), sr * 0.11, JX.goldHi, rnd, 0.95);
      g.restore();
      g.beginPath(); g.arc(0, 0, sr, 0, TAU);
      goldEdge(g, pr.lw * 0.46, 0.92);
    } else {
      const pc = i % 2 ? p.scarlet : p.lotus;
      peony(g, R * 0.118, rnd, pc, mixC(pc, JX.ivory, 0.50), pr.lw, 0.98);
    }
    g.restore();
  }
}

// 内瓣环：宝相双裂瓣，从 0.22 起笔到 0.41
function ringInner(g, R, pr, rnd) {
  const p = pr.pal;
  const n = Math.max(8, Math.round(pr.symmetry * 0.85));
  const step = TAU / n;
  const cols = [p.gold, p.scarlet, p.lotusHi, p.blueHi];
  const len = R * 0.190;
  const wid = R * step * 0.40;
  for (let i = 0; i < n; i++) {
    const a = i * step + Math.PI / n;
    g.save();
    g.rotate(a);
    g.translate(R * 0.220, 0);
    g.globalAlpha = pr.alpha * 0.94;
    twinPetalPath(g, len, wid, 0.44 + 0.28 * pr.deform);
    g.fillStyle = rgba(cols[i % 4], 0.90);
    g.fill();
    g.save();
    g.clip();
    contourSatin(g, (gg, l, w) => twinPetalPath(gg, l, w, 0.44 + 0.28 * pr.deform),
      len, wid, Math.max(2, pr.layers * 0.7),
      mixC(cols[i % 4], JX.ivory, 0.34), mixC(cols[i % 4], JX.ink, 0.34), 1);
    g.restore();
    twinPetalPath(g, len, wid, 0.44 + 0.28 * pr.deform);
    g.strokeStyle = rgba(JX.ink, 0.5);
    g.lineWidth = Math.max(1.2, pr.lw * 1.3);
    g.stroke();
    goldEdge(g, pr.lw * 0.34, 0.85);
    g.restore();
  }

  g.globalAlpha = pr.alpha * 0.92;
  for (const rr of [R * 0.212, R * 0.408]) {
    g.beginPath();
    g.arc(0, 0, rr, 0, TAU);
    goldEdge(g, pr.lw * 0.40, 0.55 + 0.35 * pr.metal);
  }
}

// 中心打籽饼
function centerSeed(g, R, pr, rnd) {
  const p = pr.pal;
  const rr = R * 0.155;
  g.globalAlpha = pr.alpha * 0.98;
  g.beginPath();
  g.arc(0, 0, rr, 0, TAU);
  g.fillStyle = rgba(mixC(p.scarletLo, JX.ink, 0.28), 0.86);
  g.fill();
  g.save();
  g.beginPath();
  g.arc(0, 0, rr * 0.94, 0, TAU);
  g.clip();
  seedField(g, -rr, -rr, rr, rr, Math.round(34 + pr.grain * 70), rr * 0.062, JX.goldHi, rnd, 0.95);
  g.restore();
  g.beginPath();
  g.arc(0, 0, rr, 0, TAU);
  goldEdge(g, pr.lw * 0.62, 0.95);
  // 四瓣十字，收住视觉重心
  g.save();
  g.rotate(Math.PI / 4);
  for (let i = 0; i < 4; i++) {
    g.rotate(TAU / 4);
    petalPath(g, rr * 1.05, rr * 0.24, 0.72);
    g.fillStyle = rgba(p.gold, 0.42);
    g.fill();
    goldEdge(g, pr.lw * 0.30, 0.68);
  }
  g.restore();
}

// 边饰：盘金双线 + 打籽点 / 浪牙
function ringBorder(g, R, pr, rnd, motif) {
  const p = pr.pal;
  g.globalAlpha = pr.alpha * (0.50 + 0.50 * pr.closure);
  for (const rr of [R * 1.000, R * 0.952]) {
    g.beginPath();
    g.arc(0, 0, rr, 0, TAU);
    goldEdge(g, pr.lw * (rr > R * 0.99 ? 0.62 : 0.38), 0.50 + 0.40 * pr.metal);
  }
  if (motif === 'haishui') {
    const teeth = Math.max(18, Math.round(pr.symmetry * 3));
    waveTeethPath(g, R * 0.972, R * 1.058, teeth, 0.045);
    g.fillStyle = rgba(p.blueLo, 0.40);
    g.fill();
    goldEdge(g, pr.lw * 0.30, 0.55);
  } else {
    const dots = Math.round(pr.symmetry * 4 * (0.7 + pr.grain * 0.9));
    for (let i = 0; i < dots; i++) {
      const a = (i / dots) * TAU;
      const r = R * 0.976;
      g.beginPath();
      g.arc(Math.cos(a) * r, Math.sin(a) * r, pr.lw * (0.50 + 0.30 * rnd()), 0, TAU);
      g.fillStyle = rgba(i % 3 === 0 ? p.goldHi : p.gold, 0.50);
      g.fill();
    }
  }
  g.globalAlpha = 1;
}

export function drawB(ctx, W, H, st, pr, t, seed = 20261028) {
  const rnd = rand(seed);
  // 主体直径必须留出画幅边距：R 走短边，且 1.02R 不超过半幅
  const R = Math.min(W, H) * 0.385 * pr.scale;
  const p = palette(pr);
  pr.pal = p;

  const motif = pr.motif || 'tuanhua';
  const spin = t * pr.rotSpeed;

  ctx.save();
  ctx.translate(W * 0.5, H * 0.5);

  // 母题外的一层极弱辉光：让团花浮在空间里，而不是压上去
  const halo = ctx.createRadialGradient(0, 0, R * 0.12, 0, 0, R * 1.28);
  halo.addColorStop(0, `rgba(158, 138, 96, ${0.06 * pr.alpha})`);
  halo.addColorStop(0.55, `rgba(92, 118, 134, ${0.03 * pr.alpha})`);
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, R * 1.30, 0, TAU);
  ctx.fill();

  // 各环以不同角速度微差旋转，形成层次而不是整块转盘
  ctx.save(); ctx.rotate(spin * 0.16); ringBorder(ctx, R, pr, rnd, motif); ctx.restore();
  ctx.save(); ctx.rotate(spin * 0.30); ringOuter(ctx, R, pr, rnd, motif); ctx.restore();
  ctx.save(); ctx.rotate(-spin * 0.24); ringVine(ctx, R, pr, rnd, motif); ctx.restore();
  ctx.save(); ctx.rotate(spin * 0.48); ringInner(ctx, R, pr, rnd); ctx.restore();
  ctx.save(); ctx.rotate(-spin * 0.64); centerSeed(ctx, R, pr, rnd); ctx.restore();

  ctx.restore();
  ctx.globalAlpha = 1;
}
