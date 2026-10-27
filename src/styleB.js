// 风格 B1：典雅 · 满幅平涂万花筒
// 参考特征：二面体对称（旋转复制 + 镜像）、平涂色块 + 白色描边、完全不用渐变、
// 满幅无留白、底色大面积鲑鱼粉、橙/紫/绿做点缀、全部压在同一明度带。
// 做法：把一个半扇区切成若干同心环带，每环带放固定槽位的图元，
// 再按对称阶数旋转复制并镜像出去；图元朝外（局部 +X 为径向），便于拼出花瓣放射感。

const TAU = Math.PI * 2;

// 环带定义：r 为半径（相对画布半径），slots 为每个半扇区的槽位数
const RINGS = [
  { r: 0.085, size: 0.050, slots: 1, types: ['dot'], cols: ['deep', 'cream'] },
  { r: 0.165, size: 0.072, slots: 2, types: ['eye'], cols: ['violet', 'deep', 'cream'] },
  { r: 0.265, size: 0.076, slots: 2, types: ['petal'], cols: ['violet', 'coral', 'lilac'] },
  { r: 0.375, size: 0.084, slots: 3, types: ['eye'], cols: ['coral', 'orange', 'violet'] },
  { r: 0.495, size: 0.090, slots: 3, types: ['blade', 'petal'], cols: ['green', 'violet', 'coral'] },
  { r: 0.610, size: 0.096, slots: 3, types: ['eye'], cols: ['coral', 'orange', 'cream'] },
  { r: 0.725, size: 0.104, slots: 3, types: ['petal', 'blade'], cols: ['orange', 'coral', 'violet'] },
  { r: 0.855, size: 0.115, slots: 3, types: ['wedge'], cols: ['orange', 'coral'] },
  { r: 1.020, size: 0.135, slots: 2, types: ['wedge'], cols: ['coral', 'orange'] },
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

// 图元池按母题种子生成一次；绘制时按复杂度截取槽位，避免参数变化导致图元跳变
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
        r: ring.r + (rnd() - 0.5) * 0.02,
        a: (slot + 0.5) / ring.slots + (rnd() - 0.5) * 0.06,   // 0..1，乘半扇区
        size: ring.size * (1.15 + rnd() * 0.55),
        type: ring.types[Math.floor(rnd() * ring.types.length)],
        color: ring.cols[Math.floor(rnd() * ring.cols.length)],
        tilt: (rnd() - 0.5) * 0.16,
        wide: 0.80 + rnd() * 0.45,
        d1: rnd(),
        d2: rnd(),
        double: rnd() > 0.62,
      });
    }
  }
  list.sort((p, q) => q.r - p.r); // 外层先画
  pool = list;
}

const hsl = (h, s, l, a = 1) => `hsla(${h}, ${s}%, ${l}%, ${a})`;

function palette(hue, sat) {
  const s = (v) => Math.min(100, v * sat);
  return {
    ground: hsl(6 + hue, s(56), 73),
    orange: hsl(24 + hue, s(88), 55),
    coral: hsl(11 + hue, s(76), 64),
    violet: hsl(272 + hue, s(32), 42),
    green: hsl(92 + hue, s(40), 44),
    cream: hsl(40 + hue, s(52), 92),
    lilac: hsl(276 + hue, s(42), 76),
    deep: hsl(320 + hue, s(30), 18),
    white: hsl(36 + hue, s(40), 97),
  };
}

// 以下路径以局部 +X 为“朝外”。宽度由 draw 时按扇区弧长传入，
// 使相邻图元自然咬合，不随对称份数变化而散架。
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
  const R = Math.min(W, H) * 0.58;
  const C = palette(pr.hueShift * 20, pr.sat);
  const N = Math.max(3, Math.round(pr.symmetry));
  const segH = Math.PI / N;
  const slots = Math.min(3, Math.max(1, Math.round(pr.shapes / 28 * 3)));
  const spin = t * pr.rotSpeed;

  // 描边宽度跟随画布半径，保证不同窗口尺寸下观感一致
  const lw = pr.lw * (R / 620);

  g.save();
  g.fillStyle = C.ground;
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
        const wid = rad * segH * 0.62 * sh.wide;   // 按扇区弧长定宽，保证咬合

        g.save();
        g.translate(Math.cos(ang) * rad, Math.sin(ang) * rad);
        g.rotate(ang + sh.tilt);
        g.fillStyle = C[sh.color];

        if (sh.type === 'eye') eyePath(g, len, wid, d);
        else if (sh.type === 'petal') petalPath(g, len, wid, d);
        else if (sh.type === 'blade') bladePath(g, len, wid, d);
        else if (sh.type === 'wedge') {
          wedgePath(g, rad * 0.52, rad * (1.42 + 0.25 * d), segH * 0.97);
        } else {
          g.beginPath();
          g.arc(0, 0, Math.max(2, wid * 0.55), 0, TAU);
        }

        g.fill();
        g.lineWidth = lw;
        g.strokeStyle = C.white;
        g.stroke();
        if (sh.double) {
          g.lineWidth = lw * 0.5;
          g.strokeStyle = C.lilac;
          g.stroke();
        }
        g.restore();
      }
      g.restore();
    }
  }

  // 中心：一簇小花压住视觉重心（不要压成黑块）
  g.save();
  g.rotate(spin * 1.6);
  for (let i = 0; i < 6; i++) {
    g.save();
    g.rotate(i * TAU / 6);
    g.translate(0, -R * 0.012);
    g.fillStyle = i % 2 ? C.coral : C.violet;
    petalPath(g, R * 0.038, R * 0.026, 0.25);
    g.fill();
    g.lineWidth = lw * 0.9;
    g.strokeStyle = C.white;
    g.stroke();
    g.restore();
  }
  g.beginPath();
  g.arc(0, 0, R * 0.014, 0, TAU);
  g.fillStyle = C.cream;
  g.fill();
  g.restore();

  g.restore();

  if (pr.opacity < 1) {
    g.fillStyle = `rgba(255, 246, 240, ${(1 - pr.opacity) * 0.5})`;
    g.fillRect(0, 0, W, H);
  }
}
