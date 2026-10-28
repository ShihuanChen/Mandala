// 风格 B1：典雅 · 同心平涂（深色通透版）
// 结构：半扇区切同心环带，每环带放槽位图元，按对称阶数旋转复制 + 镜像。
// 材质：平涂 + 白描边，不用渐变、不用投影光；通透感来自图元半透明叠色，
//       深色底上叠得越多越亮，因此疏密直接决定明暗节奏。
// 疏密：环带条数、每环槽位、图元宽度三项共同控制；内圈密而小，外圈疏而大。

const TAU = Math.PI * 2;

// r 相对画布半径；size 相对画布半径；slots 为每半扇区槽位数
const RINGS = [
  { r: 0.070, size: 0.038, slots: 1, types: ['dot'], cols: ['cream', 'gold'] },
  { r: 0.130, size: 0.048, slots: 2, types: ['eye'], cols: ['violet', 'rose'] },
  { r: 0.198, size: 0.054, slots: 2, types: ['petal'], cols: ['rose', 'coral'] },
  { r: 0.270, size: 0.058, slots: 3, types: ['eye'], cols: ['celadon', 'violet', 'rose'] },
  { r: 0.344, size: 0.062, slots: 3, types: ['blade'], cols: ['celadon', 'coral'] },
  { r: 0.426, size: 0.068, slots: 3, types: ['petal'], cols: ['coral', 'gold', 'celadon'] },
  { r: 0.516, size: 0.074, slots: 3, types: ['eye'], cols: ['gold', 'violet', 'rose'] },
  { r: 0.614, size: 0.082, slots: 2, types: ['petal'], cols: ['celadon', 'rose'] },
  { r: 0.724, size: 0.092, slots: 2, types: ['blade'], cols: ['gold', 'celadon'] },
  { r: 0.848, size: 0.104, slots: 1, types: ['eye'], cols: ['rose', 'gold'] },
  { r: 0.952, size: 0.120, slots: 1, types: ['wedge'], cols: ['celadon', 'gold'] },
];

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 图元池按母题种子生成一次；绘制时按参数截取槽位，避免参数变化导致图元跳变
let pool = null;
let poolSeed = 0;
function ensurePool(seed) {
  if (pool && poolSeed === seed) return;
  poolSeed = seed;
  const rnd = mulberry32(seed);
  const list = [];
  for (let ri = 0; ri < RINGS.length; ri++) {
    const ring = RINGS[ri];
    for (let slot = 0; slot < 3; slot++) {
      if (slot >= ring.slots) continue;
      list.push({
        ring: ri,
        slot,
        r: ring.r + (rnd() - 0.5) * 0.018,
        a: (slot + 0.5) / ring.slots + (rnd() - 0.5) * 0.05,   // 0..1，乘半扇区
        size: ring.size * (1.10 + rnd() * 0.40),
        type: ring.types[Math.floor(rnd() * ring.types.length)],
        color: ring.cols[Math.floor(rnd() * ring.cols.length)],
        tilt: (rnd() - 0.5) * 0.14,
        wide: 0.72 + rnd() * 0.30,
        d1: rnd(),
        double: rnd() > 0.70,
      });
    }
  }
  list.sort((p, q) => q.r - p.r); // 外层先画，内层压在上面
  pool = list;
}

const hsl = (h, s, l, a = 1) => `hsla(${h}, ${s}%, ${l}%, ${a})`;

// 深底调色：低饱和、中高明度，靠叠色出层次，不靠光影
function palette(hue, sat, light) {
  const s = (v) => Math.min(96, v * sat);
  const l = (v) => Math.min(96, v * (0.80 + light * 0.30));
  return {
    ground: hsl(214 + hue * 18, 26, 7),
    gold: hsl(40 + hue * 22, s(52), l(72)),
    coral: hsl(13 + hue * 22, s(46), l(64)),
    celadon: hsl(168 + hue * 22, s(28), l(62)),
    violet: hsl(266 + hue * 22, s(26), l(68)),
    rose: hsl(336 + hue * 22, s(30), l(74)),
    cream: hsl(42 + hue * 22, s(24), l(90)),
    white: hsl(38 + hue * 22, s(20), l(92)),
  };
}

// 以下路径以局部 +X 为“朝外”
function eyePath(g, len, wid, d) {
  const h = len * (0.95 + 0.35 * d);
  const w = wid * (0.90 + 0.30 * d);
  g.beginPath();
  g.moveTo(-h * 0.22, 0);
  g.bezierCurveTo(h * 0.06, -w, h * 0.68, -w * 0.92, h, 0);
  g.bezierCurveTo(h * 0.68, w * 0.92, h * 0.06, w, -h * 0.22, 0);
  g.closePath();
}

function petalPath(g, len, wid, d) {
  const h = len * (1.45 + 0.40 * d);
  const w = wid * (0.78 + 0.28 * d);
  g.beginPath();
  g.moveTo(0, 0);
  g.bezierCurveTo(w * 1.25, h * 0.16, w * 0.52, h * 0.76, 0, h);
  g.bezierCurveTo(-w * 0.52, h * 0.76, -w * 1.25, h * 0.16, 0, 0);
  g.closePath();
}

function bladePath(g, len, wid, d) {
  const h = len * (1.45 + 0.40 * d);
  const w = wid * (0.45 + 0.20 * d);
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(w * 1.8, h * 0.50, 0, h);
  g.quadraticCurveTo(-w * 1.8, h * 0.50, 0, 0);
  g.closePath();
}

function wedgePath(g, r0, r1, a) {
  g.beginPath();
  g.moveTo(Math.cos(-a) * r0, Math.sin(-a) * r0);
  g.lineTo(Math.cos(-a) * r1, Math.sin(-a) * r1);
  g.arc(0, 0, r1, -a, a);
  g.lineTo(Math.cos(a) * r0, Math.sin(a) * r0);
  g.arc(0, 0, r0, a, -a, true);
  g.closePath();
}

export function drawB(ctx, W, H, st, pr, t, seed = 20261027) {
  ensurePool(seed);
  const g = ctx;
  const cx = W / 2;
  const cy = H / 2;
  const R = Math.min(W, H) * 0.455;
  const C = palette(pr.hueShift, pr.sat, pr.light);
  const N = Math.max(3, Math.round(pr.symmetry));
  const segH = Math.PI / N;
  const slots = Math.max(1, Math.min(3, Math.round(pr.slots)));
  const spin = t * pr.rotSpeed;

  // 描边宽度跟随画布半径，保证不同窗口尺寸下观感一致
  const lw = pr.lw * (R / 620);

  g.save();
  g.fillStyle = C.ground;
  g.fillRect(0, 0, W, H);

  // 通透空间感：中心略透出一点暖，向外收暗；这不是光源，是底色的空间层次
  const depth = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.62);
  depth.addColorStop(0, `rgba(190, 210, 226, ${0.055 + pr.light * 0.05})`);
  depth.addColorStop(0.55, 'rgba(140, 165, 190, 0.020)');
  depth.addColorStop(1, 'rgba(0, 0, 0, 0)');
  g.fillStyle = depth;
  g.fillRect(0, 0, W, H);

  g.translate(cx, cy);
  g.scale(pr.scale, pr.scale);
  g.rotate(spin);
  g.lineJoin = 'round';
  g.lineCap = 'round';

  for (let k = 0; k < N; k++) {
    for (let mir = 0; mir < 2; mir++) {
      g.save();
      g.rotate(k * 2 * segH);
      if (mir) g.scale(1, -1);

      for (let i = 0; i < pool.length; i++) {
        const sh = pool[i];
        if (sh.slot >= slots) continue;
        const rad = sh.r * R;
        const ang = sh.a * segH;
        const d = pr.deform * (0.55 + 0.45 * sh.d1) * 0.5;
        const len = sh.size * R;
        // 按扇区弧长定宽；再乘 0.74 让相邻图元之间留缝，形成疏密节奏
        const wid = rad * segH * 0.62 * sh.wide;

        g.save();
        g.translate(Math.cos(ang) * rad, Math.sin(ang) * rad);
        g.rotate(ang + sh.tilt);
        g.globalAlpha = pr.alpha;
        g.fillStyle = C[sh.color];

        if (sh.type === 'eye') eyePath(g, len, wid, d);
        else if (sh.type === 'petal') petalPath(g, len, wid, d);
        else if (sh.type === 'blade') bladePath(g, len, wid, d);
        else if (sh.type === 'wedge') {
          wedgePath(g, rad * 0.52, rad * (1.42 + 0.25 * d), segH * 0.94);
        } else {
          g.beginPath();
          g.arc(0, 0, Math.max(2, wid * 0.55), 0, TAU);
        }

        g.fill();
        g.lineWidth = lw;
        g.strokeStyle = C.white;
        g.stroke();
        if (sh.double) {
          g.lineWidth = lw * 0.42;
          g.strokeStyle = C.gold;
          g.stroke();
        }
        g.restore();
      }
      g.restore();
    }
  }

  // 边界闭合（P16）：稳定时外圈补一道收束线，防止动态生成失去整体形状
  if (pr.closure > 0.42) {
    g.globalAlpha = (pr.closure - 0.42) / 0.58 * 0.55;
    g.lineWidth = lw * 1.1;
    g.strokeStyle = C.white;
    g.beginPath();
    g.arc(0, 0, R * 1.03, 0, TAU);
    g.stroke();
    g.globalAlpha = 1;
  }

  // 中心：一簇小花压住视觉重心（中心强调 P13）
  g.save();
  g.rotate(spin * 1.4);
  const petalLen = R * (0.030 + pr.scale * 0.016);
  for (let i = 0; i < 6; i++) {
    g.save();
    g.rotate(i * TAU / 6);
    g.translate(0, -R * 0.010);
    g.globalAlpha = pr.alpha;
    g.fillStyle = i % 2 ? C.rose : C.violet;
    petalPath(g, petalLen, petalLen * 0.62, 0.25);
    g.fill();
    g.lineWidth = lw * 0.8;
    g.strokeStyle = C.white;
    g.stroke();
    g.restore();
  }
  g.globalAlpha = 1;
  g.beginPath();
  g.arc(0, 0, R * 0.012, 0, TAU);
  g.fillStyle = C.cream;
  g.fill();
  g.restore();

  g.restore();

  if (pr.opacity < 1) {
    g.fillStyle = `rgba(6, 9, 14, ${(1 - pr.opacity) * 0.6})`;
    g.fillRect(0, 0, W, H);
  }
}
