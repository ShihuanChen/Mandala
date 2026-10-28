// 风格 B2：典雅 · 同心多边形（深色通透版）
// 结构：同心多边形逐层收缩，层间用错位旋转产生几何切分；中心由多排小花瓣拼成。
// 材质：半透明叠色，不设射灯、不做投影，通透感来自薄层叠加而非光照。
// 疏密：层数（P11）、每层单元数（P9）、中心花瓣数（P10）三项共同控制。
const TAU = Math.PI * 2;

const hsl = (h, s, l, a = 1) => `hsla(${h}, ${s}%, ${l}%, ${a})`;

function polyPath(g, n, r, rot) {
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const a = rot + i * TAU / n;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i) g.lineTo(x, y);
    else g.moveTo(x, y);
  }
  g.closePath();
}

function petalQuad(g, w, h) {
  g.beginPath();
  g.moveTo(0, 0);
  g.bezierCurveTo(w, -h * 0.45, w * 0.62, -h * 0.92, 0, -h);
  g.bezierCurveTo(-w * 0.62, -h * 0.92, -w, -h * 0.45, 0, 0);
  g.closePath();
}

// 冷 → 暖 → 藕 → 靛，低饱和，深底上靠叠色出层次
const RAMP = [
  [196, 46, 58],
  [40, 56, 76],
  [330, 38, 72],
  [230, 44, 60],
  [164, 40, 64],
];

export function drawB2(ctx, W, H, st, pr, t) {
  const g = ctx;
  const cx = W / 2;
  const cy = H * 0.5;
  const R = Math.min(W, H) * 0.52 * pr.scale;
  const hue = (pr.hueShift - 0.5) * 40;
  const spin = t * pr.rotSpeed;

  // 深底
  g.fillStyle = hsl(216 + hue, 30, 6);
  g.fillRect(0, 0, W, H);

  // 通透空间：中心略透，向外收暗（底色层次，不是光源）
  const depth = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.60);
  depth.addColorStop(0, `rgba(150, 178, 196, ${0.05 + pr.light * 0.06})`);
  depth.addColorStop(0.6, 'rgba(90, 118, 140, 0.02)');
  depth.addColorStop(1, 'rgba(0, 0, 0, 0)');
  g.fillStyle = depth;
  g.fillRect(0, 0, W, H);

  g.save();
  g.translate(cx, cy);

  const nLayers = Math.max(3, Math.round(pr.layers));
  const sides = Math.max(4, Math.round(pr.sides));
  const units = Math.max(4, Math.round(pr.units));
  const gap = pr.gap;

  // ---- 同心多边形层：由外向内，层距由 P15 控制 ----
  for (let i = 0; i < nLayers; i++) {
    const f = i / (nLayers - 1);
    // gap 越大层间距越疏；0.24–0.42 之间取，保证层与层之间留一条暗缝
    const r = R * (1.0 - f * (0.92 - gap * 0.35));
    const n = i % 2 === 0 ? sides : Math.max(4, Math.round(sides * 0.5));
    const rot = (i % 2 ? Math.PI / n : 0) + spin * (0.18 + i * 0.22);
    const [hh, ss, ll] = RAMP[i % RAMP.length];

    g.globalAlpha = pr.alpha * (0.85 - f * 0.25);
    g.fillStyle = hsl(hh + hue, ss, ll * (0.72 + pr.light * 0.32));
    polyPath(g, n, r, rot);
    g.fill();
    // 细亮边：把叠层从"色带"读成"棱线"，这是精致感的来源
    g.globalAlpha = Math.min(0.8, pr.alpha * 1.5);
    g.strokeStyle = hsl(hh + hue + 8, Math.min(60, ss * 0.8), 82);
    g.lineWidth = R * 0.0022;
    g.stroke();

    // 每条边中点落一个小单元，把层读成"环"而不是"面"
    g.globalAlpha = pr.alpha * (1.15 - f * 0.35);
    g.fillStyle = hsl(hh + hue + 12, ss * 0.9, Math.min(88, ll * 1.18));
    for (let k = 0; k < units; k++) {
      const a = rot + (k / units) * TAU;
      const rr = r * 0.985;
      g.save();
      g.translate(Math.cos(a) * rr, Math.sin(a) * rr);
      g.rotate(a);
      petalQuad(g, r * 0.020, r * 0.052 + r * 0.012 * Math.sin(i));
      g.fill();
      g.restore();
    }
  }

  // ---- 边界闭合（P16）：稳定时补一道收束环 ----
  if (pr.closure > 0.45) {
    g.globalAlpha = (pr.closure - 0.45) / 0.55 * 0.42;
    g.strokeStyle = hsl(44 + hue, 40, 78);
    g.lineWidth = R * 0.004;
    polyPath(g, sides, R * 1.02, spin * 0.1);
    g.stroke();
  }
  g.globalAlpha = 1;

  // ---- 中心拼花：多排花瓣，靠排数与瓣数控制密 ----
  const nP = Math.max(14, Math.round(pr.petals));
  for (let row = 0; row < 3; row++) {
    const rowScale = 1 - row * 0.30;
    const count = Math.max(8, Math.round(nP * (1 - row * 0.26)));
    const hr = R * (0.135 + 0.055 * pr.open) * rowScale;
    const orbit = R * (0.20 + 0.035 * row) * (0.9 + 0.2 * pr.scale);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + spin * (row % 2 ? -1.1 : 1) + row * 0.32;
      g.save();
      g.rotate(a);
      g.translate(0, -orbit);
      const [hh, ss, ll] = RAMP[(row + 1) % RAMP.length];
      g.globalAlpha = Math.min(1, pr.alpha * (1.5 - row * 0.15));
      g.fillStyle = hsl(hh + hue, ss, Math.min(90, ll * (0.92 + pr.light * 0.22)));
      petalQuad(g, hr * 0.30, hr);
      g.fill();
      g.restore();
    }
  }

  // 中心
  g.globalAlpha = Math.min(1, pr.alpha * 1.4);
  g.fillStyle = hsl(232 + hue, 32, 52);
  polyPath(g, 12, R * 0.075, spin * 0.5);
  g.fill();
  g.globalAlpha = Math.min(1, pr.alpha * 1.5);
  g.fillStyle = hsl(42 + hue, 48, 80);
  g.beginPath();
  g.arc(0, 0, R * 0.020, 0, TAU);
  g.fill();

  g.globalAlpha = 1;
  g.restore();

  if (pr.opacity < 1) {
    g.fillStyle = `rgba(6, 9, 14, ${(1 - pr.opacity) * 0.6})`;
    g.fillRect(0, 0, W, H);
  }
}
