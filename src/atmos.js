// 通透空间层
// 「通透」不是把底色调亮，而是让背景具备可被看进去的深度：
//   1) 底不取纯黑，中心lifted、边缘压深，形成"空间在背后"的错觉
//   2) 2–3 团极缓漂移的雾（大半径、低不透明度、screen 混合）制造空气感
//   3) 三层景深粒子：远层细密暗淡、中层适度、近层少而柔（bokeh），
//      按 depth 分配速度形成视差；全部缓慢上浮，不闪烁
//   4) 边缘暗角 + 极弱颗粒，避免大面积渐变出现色带
// 本模块只吃状态（速度/密度/浊度），不读设备。

const TAU = Math.PI * 2;

const mulberry32 = (a) => () => {
  a |= 0; a = (a + 0x6D2B79F5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// 京绣色系抽样的微光颗粒：牙白 / 金 / 石绿 / 宝蓝 / 藕荷
const TINTS = [
  [236, 228, 208],
  [201, 162, 76],
  [136, 178, 158],
  [104, 138, 196],
  [186, 148, 172],
];

// ── 粒子精灵缓存 ──
const sprites = new Map();
function sprite(r, tint, soft) {
  const key = `${r.toFixed(1)}|${tint[0]}|${soft ? 1 : 0}`;
  const hit = sprites.get(key);
  if (hit) return hit;
  const pad = 1.5;
  const size = Math.ceil((r + pad) * 2);
  const cv = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(size, size)
    : Object.assign(document.createElement('canvas'), { width: size, height: size });
  const g = cv.getContext('2d');
  const c = size / 2;
  const grad = g.createRadialGradient(c, c, 0, c, c, c);
  const [R, G, B] = tint;
  if (soft) {
    // 近层：几乎没有实心核，全是晕
    grad.addColorStop(0, `rgba(${R},${G},${B},0.50)`);
    grad.addColorStop(0.42, `rgba(${R},${G},${B},0.16)`);
    grad.addColorStop(1, `rgba(${R},${G},${B},0)`);
  } else {
    grad.addColorStop(0, `rgba(${R},${G},${B},1)`);
    grad.addColorStop(0.34, `rgba(${R},${G},${B},0.72)`);
    grad.addColorStop(0.72, `rgba(${R},${G},${B},0.14)`);
    grad.addColorStop(1, `rgba(${R},${G},${B},0)`);
  }
  g.fillStyle = grad;
  g.beginPath();
  g.arc(c, c, c, 0, TAU);
  g.fill();
  sprites.set(key, cv);
  return cv;
}

// ── 颗粒贴图（避免渐变带纹）──
let grainTile = null;
function grain() {
  if (grainTile) return grainTile;
  const n = 128;
  const cv = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(n, n)
    : Object.assign(document.createElement('canvas'), { width: n, height: n });
  const g = cv.getContext('2d');
  const img = g.createImageData(n, n);
  const rnd = mulberry32(40127);
  for (let i = 0; i < n * n; i++) {
    const v = 118 + Math.floor(rnd() * 74);
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  grainTile = cv;
  return cv;
}

export function createAtmos(seed = 20261028) {
  const rnd = mulberry32(seed);
  const parts = [];
  const N = 420;

  const band = (n, d0, d1, r0, r1, a0, a1) => {
    for (let i = 0; i < n; i++) {
      const d = d0 + (d1 - d0) * rnd();
      parts.push({
        x: rnd(),
        y: rnd(),
        d,
        r: r0 + (r1 - r0) * rnd() * (0.4 + 0.6 * d),
        a: a0 + (a1 - a0) * rnd(),
        tint: TINTS[Math.floor(rnd() * TINTS.length)],
        soft: d > 0.74,
        // 上浮速度：近层快，远层慢 → 视差
        vy: (0.006 + 0.020 * d) * (0.6 + 0.8 * rnd()),
        // 横向摆动
        amp: 0.004 + 0.020 * rnd(),
        fr: 0.10 + 0.42 * rnd(),
        ph: rnd() * TAU,
        tw: 0.5 + rnd() * 1.6,  // 明灭频率，极低
      });
    }
  };

  band(270, 0.10, 0.42, 0.45, 1.05, 0.10, 0.28);  // 远层
  band(150, 0.42, 0.74, 0.90, 1.80, 0.12, 0.30);  // 中层
  band(26, 0.76, 1.00, 2.10, 4.20, 0.026, 0.062); // 近层

  // 雾团
  const haze = [];
  for (let i = 0; i < 3; i++) {
    haze.push({
      x: 0.28 + rnd() * 0.44,
      y: 0.30 + rnd() * 0.40,
      r: 0.46 + rnd() * 0.34,
      a: 0.030 + rnd() * 0.022,
      sx: 0.010 + rnd() * 0.014,
      sy: 0.007 + rnd() * 0.010,
      ph: rnd() * TAU,
      tint: i === 0 ? [96, 138, 168] : i === 1 ? [70, 104, 120] : [126, 108, 130],
    });
  }

  let lastW = 0, lastH = 0;
  let baked = null;

  // 底与雾变化极慢，按尺寸烘焙一次，避免每帧重算大半径渐变
  function bake(W, H) {
    if (baked && lastW === W && lastH === H) return baked;
    lastW = W; lastH = H;
    const cv = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(W, H)
      : Object.assign(document.createElement('canvas'), { width: W, height: H });
    const g = cv.getContext('2d');
    const cx = W * 0.5, cy = H * 0.46;

    // 底：中心抬亮，边缘压深，但始终保持偏青蓝的色相，不落到纯黑
    const base = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.80);
    base.addColorStop(0.00, '#12202F');
    base.addColorStop(0.30, '#0C1521');
    base.addColorStop(0.62, '#070D16');
    base.addColorStop(0.85, '#04070D');
    base.addColorStop(1.00, '#020408');
    g.fillStyle = base;
    g.fillRect(0, 0, W, H);

    // 背后的一层微光：让主体像漂浮在有光的空气里，而不是贴在黑板上
    g.globalCompositeOperation = 'screen';
    const halo = g.createRadialGradient(cx, cy * 0.98, 0, cx, cy * 0.98, Math.min(W, H) * 0.52);
    halo.addColorStop(0, 'rgba(104, 148, 176, 0.085)');
    halo.addColorStop(0.46, 'rgba(74, 116, 148, 0.038)');
    halo.addColorStop(1, 'rgba(74, 116, 148, 0)');
    g.fillStyle = halo;
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';

    baked = cv;
    return cv;
  }

  return {
    // st: 状态；speed 影响漂移，density 影响可见粒子数，hazeAmt 影响浊度
    draw(ctx, W, H, st, t, opts = {}) {
      const bg = bake(W, H);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(bg, 0, 0);

      const act = st ? st.activation : 0.4;
      const cplx = st ? st.complexity : 0.5;
      const airy = opts.airy ?? 1;          // 0..1，通透程度
      const speed = 0.45 + act * 1.55;
      const visible = 0.55 + cplx * 0.45;

      // 雾：screen 叠加，极低不透明度，慢到几乎察觉不到在动
      ctx.globalCompositeOperation = 'screen';
      for (const h of haze) {
        const x = (h.x + Math.sin(t * h.sx + h.ph) * 0.06) * W;
        const y = (h.y + Math.cos(t * h.sy + h.ph * 1.3) * 0.05) * H;
        const R = h.r * Math.min(W, H) * 1.25;
        const [r, gg, b] = h.tint;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, R);
        grad.addColorStop(0, `rgba(${r},${gg},${b},${h.a * airy})`);
        grad.addColorStop(0.55, `rgba(${r},${gg},${b},${h.a * 0.34 * airy})`);
        grad.addColorStop(1, `rgba(${r},${gg},${b},0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      }
      ctx.globalCompositeOperation = 'source-over';

      // 粒子：远→近绘制，近层最后，形成正确的前后关系
      const minDim = Math.min(W, H);
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if (p.d < 0.42 && i > N * visible) continue;   // 复杂度低时先裁远层
        // 位置：慢上浮 + 横向摆动，越界回绕
        let y = p.y - p.vy * t * speed * 0.06;
        y = ((y % 1) + 1) % 1;
        const x = p.x + Math.sin(t * p.fr * 0.22 + p.ph) * p.amp * speed;
        const px = ((x % 1) + 1) % 1 * W;
        const py = y * H;

        // 明灭幅度极小，避免闪
        const flick = 0.86 + 0.14 * Math.sin(t * p.tw * 0.5 + p.ph);
        const alpha = p.a * flick * (0.72 + 0.5 * airy);
        const rad = Math.max(0.55, p.r * (minDim / 900));

        const sp = sprite(rad, p.tint, p.soft);
        ctx.globalAlpha = Math.min(1, alpha);
        const half = sp.width / 2;
        ctx.drawImage(sp, px - half, py - half);
      }
      ctx.globalAlpha = 1;

      // 暗角：中心留亮，四角压深，但不压成死黑
      const vig = ctx.createRadialGradient(
        W * 0.5, H * 0.46, Math.min(W, H) * 0.18,
        W * 0.5, H * 0.46, Math.max(W, H) * 0.78,
      );
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(0.62, 'rgba(0,0,0,0.20)');
      vig.addColorStop(1, 'rgba(0,0,0,0.52)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);

      // 颗粒：打散色带
      const tile = grain();
      const pat = ctx.createPattern(tile, 'repeat');
      if (pat) {
        const ox = Math.floor((t * 13) % 128);
        const oy = Math.floor((t * 9) % 128);
        ctx.save();
        ctx.globalAlpha = 0.020;
        ctx.translate(-ox, -oy);
        ctx.fillStyle = pat;
        ctx.fillRect(0, 0, W + 128, H + 128);
        ctx.restore();
      }
    },
  };
}
