// 风格 B：简约典雅 / 点线面中式。
// 约束：单一主体、2–4 色、留白 ≥30%、低动态、主体轮廓不被状态变化破坏。
import { PAL } from './palette.js';

const B = PAL.b;
const TAU = Math.PI * 2;

// ---------- 纸面肌理（只生成一次） ----------
let tex = null;
function paperTexture() {
  if (tex) return tex;
  const N = 256;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  let seed = 20261024;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 900; i++) {
    const x = rnd() * N, y = rnd() * N, len = 6 + rnd() * 34;
    g.strokeStyle = `rgba(120,94,56,${0.02 + rnd() * 0.045})`;
    g.lineWidth = 0.5 + rnd() * 0.7;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (rnd() - 0.5) * 4, y + len);
    g.stroke();
  }
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(110,86,52,${0.02 + rnd() * 0.05})`;
    g.fillRect(rnd() * N, rnd() * N, 1.2, 1.2);
  }
  tex = c;
  return tex;
}
let patternCache = new WeakMap();

// ---------- 基础笔形 ----------
function petalPath(g, len, wid) {
  g.beginPath();
  g.moveTo(0, 0);
  g.bezierCurveTo(wid * 0.86, -len * 0.30, wid * 0.56, -len * 0.84, 0, -len);
  g.bezierCurveTo(-wid * 0.56, -len * 0.84, -wid * 0.86, -len * 0.30, 0, 0);
  g.closePath();
}

function leafPath(g, len, wid) {
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(wid, -len * 0.5, 0, -len);
  g.quadraticCurveTo(-wid, -len * 0.5, 0, 0);
  g.closePath();
}

function spiralPath(g, r, turns) {
  const steps = 64;
  g.beginPath();
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const a = turns * TAU * u;
    const rr = r * (1 - 0.62 * u);
    const x = Math.cos(a) * rr;
    const y = Math.sin(a) * rr - r * 0.22;
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
}

function dot(g, x, y, r, color, alpha) {
  g.globalAlpha = alpha;
  g.fillStyle = color;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
}

// ---------- 母题 ----------
function lotus(g, R, p) {
  const n = Math.round(p.symmetry);
  const step = TAU / n;
  // 三层花瓣锚定在不同半径上，避免全部汇聚到圆心形成墨团
  const rings = [
    { f: 0.95, off: 0, accent: true },
    { f: 0.70, off: step / 2, accent: false },
    { f: 0.46, off: 0, accent: false },
  ];
  for (const ring of rings) {
    const tip = R * ring.f;
    const inner = tip * 0.52;
    const len = tip - inner;
    const wid = len * 0.62;
    for (let i = 0; i < n; i++) {
      g.save();
      g.rotate(i * step + ring.off);
      g.translate(0, -inner);
      g.strokeStyle = B.ink;
      g.globalAlpha = 0.82;
      g.lineWidth = p.lw;
      petalPath(g, len, wid);
      g.stroke();
      g.strokeStyle = B.gold;
      g.globalAlpha = 0.55;
      g.lineWidth = Math.max(0.55, p.lw * 0.42);
      petalPath(g, len * 0.9, wid * 0.62);
      g.stroke();
      g.strokeStyle = B.ink;
      g.globalAlpha = 0.22;
      g.lineWidth = Math.max(0.4, p.lw * 0.32);
      g.beginPath();
      g.moveTo(0, -len * 0.10);
      g.lineTo(0, -len * 0.90);
      g.stroke();
      if (ring.accent) dot(g, 0, -len * 0.99, Math.max(1.1, p.lw * 0.9), B.accent, 0.9);
      g.restore();
    }
  }
  // 中心
  g.globalAlpha = 0.72;
  g.strokeStyle = B.ink;
  g.lineWidth = p.lw * 0.75;
  g.beginPath();
  g.arc(0, 0, R * 0.17, 0, TAU);
  g.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    g.globalAlpha = 0.35;
    g.beginPath();
    g.moveTo(Math.cos(a) * R * 0.19, Math.sin(a) * R * 0.19);
    g.lineTo(Math.cos(a) * R * 0.22, Math.sin(a) * R * 0.22);
    g.stroke();
  }
  dot(g, 0, 0, Math.max(1.8, R * 0.028), B.gold, 0.95);
}

function mandala(g, R, p) {
  const n = Math.round(p.symmetry);
  const step = TAU / n;
  const rings = [
    { f: 0.32, rot: 0 },
    { f: 0.62, rot: Math.PI / n },
    { f: 0.95, rot: 0 },
  ];
  for (const rg of rings) {
    const r = R * rg.f;
    g.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = i * step + rg.rot;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.closePath();
    g.strokeStyle = B.ink;
    g.globalAlpha = 0.78;
    g.lineWidth = p.lw;
    g.stroke();
  }
  for (let i = 0; i < n; i++) {
    const a = i * step;
    g.strokeStyle = B.gold;
    g.globalAlpha = 0.34;
    g.lineWidth = Math.max(0.55, p.lw * 0.45);
    g.beginPath();
    g.moveTo(Math.cos(a) * R * 0.32, Math.sin(a) * R * 0.32);
    g.lineTo(Math.cos(a) * R * 0.95, Math.sin(a) * R * 0.95);
    g.stroke();
    dot(g, Math.cos(a) * R * 0.95, Math.sin(a) * R * 0.95, Math.max(1.2, p.lw * 1.05), i % 2 ? B.gold : B.accent, 0.9);
  }
  g.globalAlpha = 0.8;
  g.strokeStyle = B.indigo;
  g.lineWidth = p.lw * 0.7;
  g.beginPath();
  g.arc(0, 0, R * 0.13, 0, TAU);
  g.stroke();
  dot(g, 0, 0, Math.max(1.6, R * 0.02), B.gold, 0.95);
}

function cloud(g, R, p) {
  const n = Math.max(4, Math.round(p.symmetry * 0.7));
  const step = TAU / n;
  for (let i = 0; i < n; i++) {
    g.save();
    g.rotate(i * step);
    g.translate(0, -R * 0.63);
    const r = R * 0.31;
    spiralPath(g, r, 2.2);
    g.strokeStyle = B.ink;
    g.globalAlpha = 0.80;
    g.lineWidth = p.lw;
    g.stroke();
    spiralPath(g, r * 0.72, 2.0);
    g.strokeStyle = B.gold;
    g.globalAlpha = 0.45;
    g.lineWidth = Math.max(0.55, p.lw * 0.45);
    g.stroke();
    g.restore();
  }
  g.globalAlpha = 0.7;
  g.strokeStyle = B.ink;
  g.lineWidth = p.lw * 0.8;
  g.beginPath();
  g.arc(0, 0, R * 0.20, 0, TAU);
  g.stroke();
  dot(g, 0, 0, Math.max(1.4, R * 0.018), B.accent, 0.9);
}

function phoenix(g, R, p) {
  const n = Math.max(5, Math.round(p.symmetry * 0.9));
  const step = TAU / n;
  for (let i = 0; i < n; i++) {
    g.save();
    g.rotate(i * step);
    for (let k = -1; k <= 1; k++) {
      g.save();
      g.rotate(k * 0.085);
      const len = R * (k === 0 ? 0.94 : 0.78);
      const wid = len * (k === 0 ? 0.15 : 0.12);
      // 羽片
      petalPath(g, len, wid);
      g.strokeStyle = k === 0 ? B.ink : B.gold;
      g.globalAlpha = k === 0 ? 0.82 : 0.45;
      g.lineWidth = k === 0 ? p.lw : Math.max(0.55, p.lw * 0.45);
      g.stroke();
      // 羽轴
      g.globalAlpha = 0.5;
      g.beginPath();
      g.moveTo(0, -len * 0.1);
      g.quadraticCurveTo(wid * 0.4, -len * 0.55, 0, -len * 0.95);
      g.stroke();
      // 羽枝
      for (let b = 1; b <= 4; b++) {
        const y = -len * (0.22 + b * 0.16);
        g.globalAlpha = 0.30;
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(wid * 1.9, y + len * 0.06);
        g.moveTo(0, y);
        g.lineTo(-wid * 1.9, y + len * 0.06);
        g.stroke();
      }
      if (k === 0) dot(g, 0, -len * 0.99, Math.max(1.2, p.lw), B.accent, 0.9);
      g.restore();
    }
    g.restore();
  }
  dot(g, 0, 0, Math.max(2.2, R * 0.03), B.gold, 0.95);
  g.globalAlpha = 0.7;
  g.strokeStyle = B.ink;
  g.lineWidth = p.lw * 0.7;
  g.beginPath();
  g.arc(0, 0, R * 0.10, 0, TAU);
  g.stroke();
}

function leaf(g, R, p) {
  const n = Math.max(4, Math.round(p.symmetry * 0.75));
  const step = TAU / n;
  for (let i = 0; i < n; i++) {
    g.save();
    g.rotate(i * step);
    g.strokeStyle = B.ink;
    g.globalAlpha = 0.68;
    g.lineWidth = p.lw * 0.85;
    g.beginPath();
    g.moveTo(0, -R * 0.16);
    g.quadraticCurveTo(R * 0.07, -R * 0.56, 0, -R * 0.94);
    g.stroke();
    for (let k = 1; k <= 3; k++) {
      const y = -R * (0.26 + k * 0.19);
      for (const s of [-1, 1]) {
        g.save();
        g.translate(0, y);
        g.rotate(s * 0.95);
        leafPath(g, R * 0.19, R * 0.075);
        g.fillStyle = B.green;
        g.globalAlpha = 0.42;
        g.fill();
        g.strokeStyle = B.ink;
        g.globalAlpha = 0.75;
        g.lineWidth = Math.max(0.55, p.lw * 0.6);
        g.stroke();
        g.restore();
      }
    }
    g.restore();
  }
  dot(g, 0, 0, Math.max(1.6, R * 0.02), B.gold, 0.9);
}

const MOTIFS = { lotus, mandala, cloud, phoenix, leaf };

// ---------- 辅助结构与针脚 ----------
function guides(g, R, p) {
  const n = Math.round(p.lineCount);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    g.strokeStyle = B.indigo;
    g.globalAlpha = 0.10;
    g.lineWidth = 0.6;
    g.beginPath();
    g.moveTo(Math.cos(a) * R * 0.12, Math.sin(a) * R * 0.12);
    g.lineTo(Math.cos(a) * R * 1.02, Math.sin(a) * R * 1.02);
    g.stroke();
  }
  g.strokeStyle = B.gold;
  g.globalAlpha = 0.18;
  g.lineWidth = 0.8;
  g.beginPath();
  g.arc(0, 0, R * 1.04, 0, TAU);
  g.stroke();
}

function stitches(g, R, p) {
  const n = Math.max(8, Math.round(p.pointCount * 0.12));
  const base = R * 1.10;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const wob = 1 + 0.035 * Math.sin(i * 1.7);
    const r = base * wob;
    const rad = i % 7 === 0 ? Math.max(1.3, p.lw * 1.0) : Math.max(0.7, p.lw * 0.5);
    dot(g, Math.cos(a) * r, Math.sin(a) * r, rad, i % 9 === 0 ? B.accent : B.ink, i % 9 === 0 ? 0.7 : 0.38);
  }
}

function seal(g, W, H, p) {
  const s = Math.min(46, Math.max(24, Math.min(W, H) * 0.042));
  g.save();
  g.translate(W - s * 1.6, H - s * 1.6);
  g.rotate(-0.05);
  g.globalAlpha = 0.86 * p.opacity;
  g.fillStyle = B.accent;
  g.fillRect(-s / 2, -s / 2, s, s);
  g.globalAlpha = 0.95 * p.opacity;
  g.fillStyle = '#F6EFE1';
  g.font = `600 ${s * 0.5}px "Songti SC","Noto Serif SC",serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('曼', 0, s * 0.03);
  g.restore();
}

// ---------- 主绘制 ----------
export function drawB(ctx, W, H, st, p, t, motif = 'lotus') {
  const cx = W / 2, cy = H / 2;
  const R = Math.min(W, H) / 2;

  ctx.save();
  ctx.fillStyle = B.paper;
  ctx.fillRect(0, 0, W, H);

  // 纸纤维
  const pat = patternCache.get(ctx) || ctx.createPattern(paperTexture(), 'repeat');
  patternCache.set(ctx, pat);
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;

  // 边缘暖调渐隐
  const vg = ctx.createRadialGradient(cx, cy, Math.min(W, H) * 0.22, cx, cy, Math.max(W, H) * 0.78);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, B.vignette);
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  const breathe = 1 + p.breath * Math.sin(t * p.breathSpeed + 0.6);
  const mr = R * p.motifScale * breathe;
  const rot = t * p.rotSpeed;

  ctx.globalAlpha = p.opacity;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  guides(ctx, mr, p);
  (MOTIFS[motif] || lotus)(ctx, mr, p);
  ctx.restore();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot * 0.5);
  stitches(ctx, mr, p);
  ctx.restore();

  seal(ctx, W, H, p);

  // 质量低时整体减淡，作为“信号不足”的视觉提示
  if (p.opacity < 0.99) {
    ctx.globalAlpha = (1 - p.opacity) * 0.9;
    ctx.fillStyle = B.paper;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}
