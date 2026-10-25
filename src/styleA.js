// 风格 A：3D 材质 / 酸性新中式（先用 Canvas 2D 模拟材质，不依赖 Blender）。
// 约束：中心清楚、径向层数 ≤6、主要材质 ≤3 种、高饱和只作局部重点。
import { PAL, hsl } from './palette.js';

const A = PAL.a;
const TAU = Math.PI * 2;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function petalPath(g, len, wid) {
  g.beginPath();
  g.moveTo(0, 0);
  g.bezierCurveTo(wid * 0.9, -len * 0.28, wid * 0.5, -len * 0.86, 0, -len);
  g.bezierCurveTo(-wid * 0.5, -len * 0.86, -wid * 0.9, -len * 0.28, 0, 0);
  g.closePath();
}

function drawBackground(g, W, H) {
  const cx = W / 2, cy = H / 2;
  const R = Math.max(W, H) * 0.78;
  const bg = g.createRadialGradient(cx, cy, 0, cx, cy, R);
  bg.addColorStop(0, A.bg[0]);
  bg.addColorStop(0.55, A.bg[1]);
  bg.addColorStop(1, A.bg[2]);
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  // 环境光斑
  g.globalCompositeOperation = 'lighter';
  const blobs = [
    [-0.28, -0.18, 0.52, 316, 0.16],
    [0.30, 0.24, 0.46, 190, 0.13],
    [0.10, -0.34, 0.38, 44, 0.10],
  ];
  for (const [dx, dy, rr, hue, al] of blobs) {
    const x = cx + W * dx, y = cy + H * dy, r = Math.min(W, H) * rr;
    const gg = g.createRadialGradient(x, y, 0, x, y, r);
    gg.addColorStop(0, hsl(hue, 90, 60, al));
    gg.addColorStop(1, hsl(hue, 90, 60, 0));
    g.fillStyle = gg;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
  }
  g.globalCompositeOperation = 'source-over';
}

function drawGoldLines(g, R, p, t) {
  const n = 48;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + t * p.rotSpeed * 0.15;
    const jitter = Math.sin(i * 2.3) * p.distortion * 0.06;
    const r0 = R * (0.2 + 0.03 * Math.sin(i * 1.9));
    const r1 = R * (0.86 + 0.06 * Math.sin(i * 0.7));
    g.strokeStyle = A.gold;
    g.globalAlpha = (i % 4 === 0 ? 0.26 : 0.10) * p.opacity;
    g.lineWidth = i % 4 === 0 ? 1.1 : 0.55;
    g.beginPath();
    g.moveTo(Math.cos(a + jitter) * r0, Math.sin(a + jitter) * r0);
    g.lineTo(Math.cos(a + jitter) * r1, Math.sin(a + jitter) * r1);
    g.stroke();
  }
  g.globalAlpha = 1;
}

function drawRibbons(g, R, p, t) {
  for (let i = 0; i < p.ribbons; i++) {
    const a0 = (i / p.ribbons) * TAU + t * p.rotSpeed * 0.55;
    const sweep = 0.85 + 0.25 * Math.sin(i * 1.3);
    const r0 = R * 0.18, r1 = R * p.ribbonLen;
    const pts = [];
    for (let k = 0; k <= 44; k++) {
      const u = k / 44;
      const a = a0 + u * sweep;
      const r = r0 + (r1 - r0) * u;
      const lift = Math.sin(u * Math.PI) * R * 0.07;
      pts.push([Math.cos(a) * r, Math.sin(a) * r - lift]);
    }
    const trace = () => {
      g.beginPath();
      pts.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y)));
    };

    const grad = g.createLinearGradient(pts[0][0], pts[0][1], pts[44][0], pts[44][1]);
    grad.addColorStop(0, 'rgba(176,132,60,0.15)');
    grad.addColorStop(0.45, A.gold);
    grad.addColorStop(0.62, A.goldLight);
    grad.addColorStop(1, 'rgba(200,160,90,0.12)');

    g.globalAlpha = p.opacity;
    trace();
    g.strokeStyle = 'rgba(120,86,34,0.55)';
    g.lineWidth = R * 0.022;
    g.stroke();
    trace();
    g.strokeStyle = grad;
    g.lineWidth = R * 0.013;
    g.stroke();
    trace();
    g.strokeStyle = 'rgba(255,246,214,0.75)';
    g.lineWidth = R * 0.004;
    g.stroke();
  }
  g.globalAlpha = 1;
}

function drawPetalLayers(g, R, p, t) {
  for (let L = 0; L < p.layers; L++) {
    const r0 = R * (0.15 + L * 0.132);
    const cnt = p.petals;
    const dir = L % 2 ? -1 : 1;
    const off = t * p.rotSpeed * 0.35 * dir + L * 0.4;
    const len = R * (0.155 + L * 0.028);
    const wid = len * 0.62;

    for (let i = 0; i < cnt; i++) {
      const a = (i / cnt) * TAU + off + Math.sin(i * 1.7 + L) * p.distortion * 0.35;
      const hue = (A.hueBase[L % A.hueBase.length] + p.hueShift + i * 7 + t * 11) % 360;
      g.save();
      g.rotate(a);
      g.translate(0, -r0);

      const lg = g.createLinearGradient(0, 0, 0, -len);
      lg.addColorStop(0, hsl(hue, 88, 60, 0.62));
      lg.addColorStop(0.45, hsl(hue + 46, 92, 70, 0.40));
      lg.addColorStop(1, hsl(hue + 118, 96, 74, 0.04));

      g.globalCompositeOperation = 'lighter';
      petalPath(g, len, wid);
      g.fillStyle = lg;
      g.globalAlpha = p.opacity * 0.9;
      g.fill();

      // 玻璃边缘
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = p.opacity * 0.55;
      g.strokeStyle = hsl(hue + 20, 100, 82, 1);
      g.lineWidth = 0.8;
      g.stroke();

      // 高光条
      g.globalAlpha = p.opacity * 0.5;
      g.strokeStyle = 'rgba(255,255,255,0.85)';
      g.lineWidth = 0.7;
      g.beginPath();
      g.moveTo(wid * 0.10, -len * 0.12);
      g.quadraticCurveTo(wid * 0.34, -len * 0.52, wid * 0.06, -len * 0.82);
      g.stroke();
      g.restore();
    }
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
}

function drawOrbs(g, R, p, t) {
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < p.orbs; i++) {
    const a = (i / p.orbs) * TAU + t * 0.16 * (i % 2 ? 1 : -1);
    const rr = R * (0.70 + 0.13 * Math.sin(i * 2.1 + t * 0.5));
    const x = Math.cos(a) * rr;
    const y = Math.sin(a) * rr;
    const rad = R * (0.018 + 0.026 * (((i % 3) + 1) / 3));
    const hue = (A.hueBase[i % A.hueBase.length] + p.hueShift + i * 13) % 360;

    const og = g.createRadialGradient(x - rad * 0.32, y - rad * 0.32, rad * 0.04, x, y, rad);
    og.addColorStop(0, 'rgba(255,255,255,0.95)');
    og.addColorStop(0.32, hsl(hue, 96, 72, 0.55));
    og.addColorStop(0.72, hsl(hue + 40, 92, 62, 0.22));
    og.addColorStop(1, hsl(hue + 40, 92, 60, 0));

    g.globalAlpha = p.opacity;
    g.fillStyle = og;
    g.beginPath();
    g.arc(x, y, rad, 0, TAU);
    g.fill();

    g.globalAlpha = p.opacity * 0.35;
    g.strokeStyle = 'rgba(255,244,208,0.9)';
    g.lineWidth = 0.7;
    g.stroke();
  }
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
}

function drawParticles(g, R, p, t) {
  const rnd = rng(7717);
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < p.particles; i++) {
    const a = rnd() * TAU + t * 0.05;
    const rr = R * (0.72 + rnd() * 0.38);
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    const rad = 0.6 + rnd() * 1.6;
    const hue = (A.hueBase[i % A.hueBase.length] + p.hueShift) % 360;
    g.globalAlpha = (0.25 + rnd() * 0.5) * p.opacity;
    g.fillStyle = hsl(hue, 92, 76, 1);
    g.beginPath();
    g.arc(x, y, rad, 0, TAU);
    g.fill();
  }
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
}

function drawCore(g, R, p, t) {
  const coreR = R * p.coreScale;
  g.save();
  g.rotate(t * p.rotSpeed * 1.8);
  g.shadowColor = 'rgba(255,214,130,0.9)';
  g.shadowBlur = p.glow * 1.8;

  for (let i = 0; i < 3; i++) {
    const rr = coreR * (1 + i * 0.42);
    const sides = 6;
    const rot = i * 0.22;
    g.beginPath();
    for (let k = 0; k <= sides; k++) {
      const a = (k / sides) * TAU + rot;
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
      k ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.closePath();
    g.strokeStyle = hsl(46 + i * 52, 98, 72, 0.85 - i * 0.18);
    g.lineWidth = 1.5 - i * 0.25;
    g.globalAlpha = p.opacity;
    g.stroke();
  }
  g.shadowBlur = 0;

  const cg = g.createRadialGradient(0, 0, 0, 0, 0, coreR);
  cg.addColorStop(0, 'rgba(255,255,246,0.98)');
  cg.addColorStop(0.42, hsl(48, 98, 72, 0.72));
  cg.addColorStop(0.78, hsl(28, 96, 60, 0.26));
  cg.addColorStop(1, 'rgba(255,160,60,0)');
  g.globalAlpha = p.opacity;
  g.fillStyle = cg;
  g.beginPath();
  g.arc(0, 0, coreR, 0, TAU);
  g.fill();

  // 核心周围的小珠
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + t * 0.3;
    const rr = coreR * 1.75;
    g.globalAlpha = p.opacity * 0.8;
    g.fillStyle = 'rgba(255,238,190,0.95)';
    g.beginPath();
    g.arc(Math.cos(a) * rr, Math.sin(a) * rr, Math.max(1.2, coreR * 0.09), 0, TAU);
    g.fill();
  }
  g.restore();
  g.globalAlpha = 1;
}

export function drawA(ctx, W, H, st, p, t) {
  drawBackground(ctx, W, H);
  const cx = W / 2, cy = H / 2;
  const R = Math.min(W, H) / 2;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  drawGoldLines(ctx, R, p, t);
  drawRibbons(ctx, R, p, t);
  drawPetalLayers(ctx, R, p, t);
  drawOrbs(ctx, R, p, t);
  drawParticles(ctx, R, p, t);
  drawCore(ctx, R, p, t);
  ctx.restore();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  // 轻微暗角，压住外围、保证中心
  const vg = ctx.createRadialGradient(cx, cy, R * 0.5, cx, cy, R * 1.05);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}
