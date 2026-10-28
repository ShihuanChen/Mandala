// 京绣母题库与针法原语
// 京绣（宫廷绣）的辨识度不来自"造型好看"，来自四种针法留下的痕迹：
//   盘金  金线沿轮廓双线钉固，边缘一圈亮金属线，是京绣最硬的身份特征
//   打籽  线结成籽粒，密排成面，表面是颗粒而不是平涂
//   套针  同一花瓣内分层退晕，层与层之间有台阶，不是渐变
//   平金  金线满铺成面，金面有丝理方向的明暗
// 母题取京绣常用的五类：宝相团花、缠枝牡丹、凤凰羽、海水江崖、打籽团。
// 本模块只负责几何与针法，不含状态、不含映射。

const TAU = Math.PI * 2;

// 京绣用色：宫廷重彩，不取莫兰迪
export const JX = {
  gold: [201, 162, 76],
  goldHi: [236, 205, 138],
  goldLo: [138, 104, 44],
  scarlet: [166, 46, 36],
  scarletHi: [198, 84, 62],
  blue: [44, 78, 138],
  blueHi: [86, 122, 178],
  green: [70, 116, 96],
  greenHi: [116, 158, 132],
  lotus: [172, 128, 156],
  lotusHi: [204, 166, 186],
  ivory: [236, 228, 208],
  ink: [10, 14, 20],
};

export const rgba = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
export const mixC = (a, b, t) => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

// ─────────── 母题轮廓（局部坐标，+X 朝外） ───────────

// 莲瓣/宝相瓣：基部收窄，端部圆收，curv 控制侧腰外鼓
export function petalPath(g, len, wid, curv = 0.5) {
  const c = 0.30 + 0.42 * curv;
  g.beginPath();
  g.moveTo(0, 0);
  g.bezierCurveTo(len * 0.06, -wid * (0.55 + 0.5 * c), len * (0.66 + 0.10 * c), -wid * c, len, 0);
  g.bezierCurveTo(len * (0.66 + 0.10 * c), wid * c, len * 0.06, wid * (0.55 + 0.5 * c), 0, 0);
  g.closePath();
}

// 圆头瓣：端部收成一个圆弧，牡丹与团花外缘用这个
export function roundPetal(g, len, wid) {
  g.beginPath();
  g.moveTo(0, 0);
  g.bezierCurveTo(len * 0.22, -wid, len * 0.70, -wid * 0.82, len * 0.93, -wid * 0.32);
  g.quadraticCurveTo(len * 1.06, 0, len * 0.93, wid * 0.32);
  g.bezierCurveTo(len * 0.70, wid * 0.82, len * 0.22, wid, 0, 0);
  g.closePath();
}

// 宝相花的双裂瓣：端部开一个小凹口
export function twinPetalPath(g, len, wid, curv = 0.5) {
  const c = 0.32 + 0.36 * curv;
  const notch = len * 0.16;
  g.beginPath();
  g.moveTo(0, 0);
  g.bezierCurveTo(len * 0.10, -wid * 0.9, len * 0.72, -wid * c, len, 0);
  g.lineTo(len - notch, 0);
  g.lineTo(len * 0.74, wid * 0.10);
  g.lineTo(len - notch, 0);
  g.bezierCurveTo(len * 0.72, wid * c, len * 0.10, wid * 0.9, 0, 0);
  g.closePath();
}

// 云头：京绣边饰常用，三弧
export function cloudHeadPath(g, len, wid) {
  g.beginPath();
  g.moveTo(0, 0);
  g.bezierCurveTo(len * 0.20, -wid * 1.05, len * 0.62, -wid * 0.92, len * 0.72, -wid * 0.30);
  g.bezierCurveTo(len * 1.02, -wid * 0.42, len * 1.05, wid * 0.42, len * 0.72, wid * 0.30);
  g.bezierCurveTo(len * 0.62, wid * 0.92, len * 0.20, wid * 1.05, 0, 0);
  g.closePath();
}

// 缠枝叶：细长卷叶
export function leafPath(g, len, wid, curl = 0.4) {
  g.beginPath();
  g.moveTo(0, 0);
  g.bezierCurveTo(len * 0.30, -wid, len * (0.72 + 0.22 * curl), -wid * 0.52, len, 0);
  g.bezierCurveTo(len * (0.72 + 0.22 * curl), wid * 0.52, len * 0.30, wid, 0, 0);
  g.closePath();
}

// 海水江崖的浪牙：一牙一牙咬合的三角弧
export function waveTeethPath(g, rIn, rOut, n, amp) {
  g.beginPath();
  const step = TAU / n;
  g.moveTo(Math.cos(0) * rIn, Math.sin(0) * rIn);
  for (let i = 0; i < n; i++) {
    const a0 = i * step;
    const a1 = a0 + step * 0.5;
    const a2 = a0 + step;
    g.quadraticCurveTo(
      Math.cos(a1) * rOut * (1 + amp), Math.sin(a1) * rOut * (1 + amp),
      Math.cos(a2) * rIn, Math.sin(a2) * rIn,
    );
  }
  g.closePath();
}

// ─────────── 针法 ───────────

// 打籽：在给定矩形内撒籽粒。籽粒不是随机点，是抖动的六方排布，才有"绣"的秩序
export function seedField(g, x0, y0, x1, y1, n, dotR, color, rnd, alpha = 1) {
  const w = x1 - x0;
  const h = y1 - y0;
  if (w <= 0 || h <= 0) return;
  const cols = Math.max(1, Math.round(Math.sqrt((n * w) / Math.max(h, 1e-3))));
  const rows = Math.max(1, Math.ceil(n / cols));
  const dx = w / cols;
  const dy = h / rows;
  g.fillStyle = rgba(color, alpha);
  for (let j = 0; j < rows; j++) {
    const off = (j % 2) * 0.5;
    for (let i = 0; i < cols; i++) {
      const x = x0 + (i + off + 0.5 * (rnd() - 0.5)) * dx;
      const y = y0 + (j + 0.5 + 0.5 * (rnd() - 0.5)) * dy;
      const r = dotR * (0.72 + 0.56 * rnd());
      g.beginPath();
      g.arc(x, y, r, 0, TAU);
      g.fill();
      // 籽粒的高光点：只给一部分，避免整面发亮
      if (rnd() > 0.62) {
        g.fillStyle = rgba(JX.goldHi, 0.22 * alpha);
        g.beginPath();
        g.arc(x - r * 0.28, y - r * 0.32, r * 0.38, 0, TAU);
        g.fill();
        g.fillStyle = rgba(color, alpha);
      }
    }
  }
}

// 套针：矩形内分层退晕，层间留一道暗缝（这是台阶感的来源）
export function satinBands(g, x0, y0, x1, y1, bands, c0, c1, vertical, seamAlpha = 0.5) {
  const n = Math.max(2, Math.round(bands));
  if (vertical) {
    const w = (x1 - x0) / n;
    for (let i = 0; i < n; i++) {
      g.fillStyle = rgba(mixC(c0, c1, i / (n - 1)), 1);
      g.fillRect(x0 + i * w, y0, w + 0.6, y1 - y0);
      // 层缝
      g.fillStyle = rgba(JX.ink, seamAlpha * 0.30);
      g.fillRect(x0 + i * w + w - 0.9, y0, 1.0, y1 - y0);
    }
  } else {
    const h = (y1 - y0) / n;
    for (let i = 0; i < n; i++) {
      g.fillStyle = rgba(mixC(c0, c1, i / (n - 1)), 1);
      g.fillRect(x0, y0 + i * h, x1 - x0, h + 0.6);
      g.fillStyle = rgba(JX.ink, seamAlpha * 0.30);
      g.fillRect(x0, y0 + i * h + h - 0.9, x1 - x0, 1.0);
    }
  }
}

// 套针（退晕）：把同一瓣形按比例层层内缩，由外向内逐层加深。
// 矩形色带读作条纹，同心轮廓才读作"一层层压出来的针脚"。
export function contourSatin(g, buildFn, len, wid, bands, cOuter, cInner, alpha = 1) {
  const n = Math.max(2, Math.round(bands));
  for (let k = n - 1; k >= 0; k--) {
    const f = n === 1 ? 1 : k / (n - 1);       // 1 → 外，0 → 内
    const sc = 0.24 + 0.76 * f;
    g.save();
    g.scale(sc, sc);
    buildFn(g, len, wid);
    g.fillStyle = rgba(mixC(cInner, cOuter, f), alpha);
    g.fill();
    // 针脚台阶：每层收边一道暗线，层才数得出来
    g.strokeStyle = rgba(mixC(cInner, JX.ink, 0.55), 0.34 * alpha);
    g.lineWidth = 1.1 / sc;
    g.stroke();
    g.restore();
  }
}

// 丝理：沿瓣长的细密短线。这是"绣"和"填色"的分界——
// 没有丝理，再好的配色也只是矢量图形，一加丝理立刻有织物的反光。
export function threadGrain(g, len, wid, color, step, alpha, rnd, light) {
  g.lineWidth = 0.9;
  for (let x = 0; x < len; x += step) {
    const t = rnd();
    const y = wid * (1 - Math.pow(Math.abs(x / len - 0.5) * 2, 2) * 0.55);
    g.strokeStyle = rgba(t > 0.5 ? light : color, alpha * (0.45 + 0.55 * t));
    g.beginPath();
    g.moveTo(x, -y);
    g.lineTo(x, y);
    g.stroke();
  }
}

// 盘金：双线。内线亮、外线暗且粗，读作一根金线压出的边缘
export function goldEdge(g, w, alpha = 1) {
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.strokeStyle = rgba(JX.goldLo, 0.72 * alpha);
  g.lineWidth = w * 1.9;
  g.stroke();
  g.strokeStyle = rgba(JX.gold, 0.95 * alpha);
  g.lineWidth = w;
  g.stroke();
  g.strokeStyle = rgba(JX.goldHi, 0.70 * alpha);
  g.lineWidth = Math.max(0.4, w * 0.38);
  g.stroke();
}

// 平金：沿丝理方向铺短金线，靠方向性高光做出织物质感
export function flatGold(g, x0, y0, x1, y1, spacing, angle, alpha, rnd) {
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const w = x1 - x0;
  const h = y1 - y0;
  const diag = Math.hypot(w, h);
  const n = Math.max(4, Math.round(diag / Math.max(0.9, spacing)));
  g.lineWidth = Math.max(0.5, spacing * 0.34);
  for (let i = 0; i < n; i++) {
    const off = -diag / 2 + (i + 0.5) * (diag / n);
    const cx = (x0 + x1) / 2 + ca * off;
    const cy = (y0 + y1) / 2 + sa * off;
    const t = rnd();
    g.strokeStyle = rgba(mixC(JX.goldLo, JX.goldHi, 0.25 + 0.75 * t), alpha * (0.34 + 0.5 * t));
    g.beginPath();
    g.moveTo(cx - sa * diag * 0.5, cy + ca * diag * 0.5);
    g.lineTo(cx + sa * diag * 0.5, cy - ca * diag * 0.5);
    g.stroke();
  }
}

// 牡丹花头：三层小瓣 + 打籽花心
export function peony(g, R, rnd, cOuter, cInner, goldW, alpha = 1) {
  const rings = [
    { n: 7, len: R * 1.02, wid: R * 0.62, curv: 0.92, c: cOuter },
    { n: 6, len: R * 0.72, wid: R * 0.52, curv: 0.86, c: mixC(cOuter, cInner, 0.55) },
    { n: 4, len: R * 0.44, wid: R * 0.40, curv: 0.78, c: cInner },
  ];
  for (const ring of rings) {
    for (let i = 0; i < ring.n; i++) {
      const a = (i / ring.n) * TAU + (ring.n % 2 ? 0.3 : 0);
      g.save();
      g.rotate(a);
      g.globalAlpha = alpha;
      roundPetal(g, ring.len * 0.98, ring.wid);
      g.fillStyle = rgba(ring.c, 0.92);
      g.fill();
      if (goldW > 0.6) goldEdge(g, goldW * 0.5, 0.8);
      g.restore();
    }
  }
  // 花心打籽
  g.save();
  seedField(g, -R * 0.22, -R * 0.22, R * 0.22, R * 0.22, Math.max(14, Math.round(R * 1.6)), R * 0.042, JX.goldHi, rnd, 0.98);
  g.restore();
}

// 缠枝：从内到外的一条 S 形主枝，沿途生叶
export function vineScroll(g, r0, r1, a0, a1, leaves, rnd, goldW, alpha = 1) {
  const steps = 26;
  g.beginPath();
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const r = r0 + (r1 - r0) * f;
    // 沿半径方向做一次侧向摆动，形成缠枝的绕行感
    const a = a0 + (a1 - a0) * f + Math.sin(f * Math.PI * 2.0) * 0.10;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.strokeStyle = rgba(JX.gold, 0.55 * alpha);
  g.lineWidth = Math.max(0.7, goldW * 0.8);
  g.stroke();
  g.strokeStyle = rgba(JX.goldHi, 0.34 * alpha);
  g.lineWidth = Math.max(0.4, goldW * 0.34);
  g.stroke();

  for (let i = 0; i < leaves; i++) {
    const f = (i + 0.5) / leaves;
    const r = r0 + (r1 - r0) * f;
    const a = a0 + (a1 - a0) * f + Math.sin(f * Math.PI * 2.0) * 0.10;
    const side = i % 2 ? 1 : -1;
    const lr = (r1 - r0) * (0.16 + 0.10 * rnd());
    g.save();
    g.translate(Math.cos(a) * r, Math.sin(a) * r);
    g.rotate(a + side * (0.8 + 0.3 * rnd()));
    g.globalAlpha = alpha * 0.94;
    leafPath(g, lr, lr * 0.34, 0.5);
    g.fillStyle = rgba(i % 3 === 0 ? JX.greenHi : JX.green, 0.80);
    g.fill();
    if (goldW > 0.55) goldEdge(g, goldW * 0.34, 0.62);
    g.restore();
  }
}
