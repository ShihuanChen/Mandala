// ============================================================
// 曼陀罗几何 —— 全项目唯一的图案源
// ------------------------------------------------------------
// 三种风格不是三个图案。环带、瓣数、瓣形、籽粒位置全部在这里算一次，
// 三种渲法读同一份 G；差别只允许出现在上色方式、边缘处理、透光与叠加。
// 坐标全部归一化：外缘半径 = 1.0，渲染器乘自己的 R_px。
// 右侧色序 cIdx 也在这里定，三种调色板共用同一套色序，
// 于是"哪一片是红的"在三版里完全对得上。
// ============================================================

import { mapP } from './mapping.js';

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

// 状态 → 几何参数。只取六层里管"形"的那几项，
// 色彩（P1–P5）、材质（P17–P19）不进来，因为那才是三种风格的区别所在。
export function geometryParams(st) {
  const P = mapP(st);
  return {
    n: 2 * Math.round(7 + 4 * P.P14_radialRepeat),
    curv: P.P7_curvature,
    sharp: P.P8_sharpness,
    grain: P.P10_grain,
    layers: Math.round(3 + 2 * P.P11_layers),
    coverage: P.P9_coverage,
    ringGap: P.P15_ringGap,
    closure: P.P16_closure,
    center: P.P13_centerEmphasis,
    rot: P.P20_rotSpeed,
  };
}

// 籽粒：抖动的六方排布，落在圆内。不是随机点，否则读作噪点。
function seedCloud(r, n, dotR, rnd) {
  const out = [];
  if (r <= 0) return out;
  const dy = dotR * 1.78;
  const dx = dotR * 2.04;
  const rows = Math.ceil(r / dy) + 1;
  const cols = Math.ceil(r / dx) + 1;
  for (let j = -rows; j <= rows; j++) {
    for (let i = -cols; i <= cols; i++) {
      const x = (i + (j & 1) * 0.5) * dx + (rnd() - 0.5) * dotR * 0.30;
      const y = j * dy + (rnd() - 0.5) * dotR * 0.30;
      if (Math.hypot(x, y) > r - dotR * 0.75) continue;
      out.push({ x, y, rad: dotR * (0.80 + 0.34 * rnd()), ph: rnd() * TAU });
    }
  }
  // 太密就抽稀到目标数量附近，避免小半径处糊成一片
  if (out.length > n * 1.25) {
    const keep = Math.max(4, Math.round(n));
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    out.length = keep;
  }
  return out;
}

export function buildMandala(gp, seed = 20261028) {
  const rnd = rand(seed);
  const n = clamp(Math.round(gp.n), 6, 24);
  const step = TAU / n;
  const curv = gp.curv;
  const gap = clamp(gp.ringGap, 0, 1);

  // ── 外瓣环：长瓣，四分之一处一枚主瓣 ──
  // 环带半径是硬约束：内瓣末端 0.410 < 缠枝 0.420–0.536 < 外瓣根 0.545，
  // 三段之间各留 0.02 以上的空，否则中间会挤成一团。
  const outerRIn = 0.545 + 0.016 * (1 - gap);
  const outer = [];
  for (let i = 0; i < n; i++) {
    const major = i % 4 === 0;
    const jl = 0.93 + 0.13 * rnd();
    const ml = (major ? 1.18 : 0.94) * jl;
    const mw = (major ? 1.16 : 0.96) * (0.96 + 0.08 * jl);
    const accent = i % 8 === 7;
    outer.push({
      a: i * step - Math.PI / 2,
      len: 0.398 * ml,
      wid: step * 0.58 * mw,
      curv: 0.44 + 0.34 * curv,
      major,
      cIdx: accent ? 2 : (major ? 3 : (i % 2 ? 1 : 0)),
    });
    // 瓣间短瓣：团花不是"一圈挂珠"，空隙里要有第二层瓣把密度托住。
    // 长度只到长瓣的 45%，长短一拉开，外缘才有节奏，不然整圈一样高。
    outer.push({
      a: i * step + step * 0.5 - Math.PI / 2,
      len: 0.398 * 0.45 * jl,
      wid: step * 0.24,
      curv: 0.52 + 0.24 * curv,
      major: false,
      minor: true,
      cIdx: major ? 0 : 1,
    });
  }

  // ── 缠枝环：正弦主枝 + 沿枝叶 + 节点花 ──
  const lobes = Math.max(3, Math.round(n * 0.5));
  const rMid = 0.486;
  const amp = 0.032;
  const leaves = [];
  const leafN = Math.max(8, lobes * 3);
  for (let i = 0; i < leafN; i++) {
    const a = (i / leafN) * TAU;
    const side = i % 2 ? 1 : -1;
    leaves.push({
      a,
      r: rMid + amp * Math.sin(lobes * a),
      ang: a + side * (0.55 + 0.35 * rnd()),
      len: 0.044 + 0.020 * gp.coverage,
      wid: 0.016 + 0.008 * gp.coverage,
      cIdx: i % 3,
    });
  }
  const nodes = [];
  for (let i = 0; i < lobes; i++) {
    const a = (i / lobes) * TAU + Math.PI / lobes;
    nodes.push({
      a,
      r: rMid + amp * Math.sin(lobes * a),
      rad: 0.040 + 0.008 * curv,
      cIdx: i % 2,
    });
  }

  // ── 内瓣环：双裂瓣，与外瓣错开半格 ──
  const n2 = 2 * Math.max(4, Math.round(n * 0.42));
  const step2 = TAU / n2;
  const innerR0 = 0.240 + 0.008 * (1 - gap);
  const inner = [];
  for (let i = 0; i < n2; i++) {
    inner.push({
      a: i * step2 + Math.PI / n2,
      r0: innerR0,
      len: 0.186,
      wid: step2 * 0.36,
      curv: 0.44 + 0.28 * curv,
      // 内环整圈压深，只有 1/4 是墨青：外环暖亮、内环冷暗，视线才会被推向中心金盘
      cIdx: i % 4 === 1 ? 2 : 0,
    });
  }

  // ── 中心：打籽饼 + 四瓣十字 ──
  const cR = 0.142 * (0.94 + 0.14 * gp.center);
  const center = {
    r: cR,
    seeds: seedCloud(cR * 0.92, Math.round(30 + gp.grain * 66), cR * 0.078, rnd),
    cross: [],
  };
  for (let i = 0; i < 4; i++) {
    center.cross.push({
      a: Math.PI / 4 + (i / 4) * TAU,
      len: cR * 1.06,
      wid: cR * 0.22,
    });
  }

  // ── 边饰：双金环 + 打籽点 ──
  const dots = [];
  const dotN = Math.round(n * 4 * (0.7 + gp.grain * 0.9));
  for (let i = 0; i < dotN; i++) {
    dots.push({
      a: (i / dotN) * TAU,
      r: 0.976,
      rad: 0.0055 + 0.0042 * rnd(),
      hi: i % 3 === 0,
    });
  }
  const border = {
    rings: [1.000, 0.952],
    dots,
    closure: gp.closure,
  };

  return {
    seed,
    n,
    s: clamp(gp.sharp, 0, 1),
    grain: gp.grain,
    layers: gp.layers,
    coverage: gp.coverage,
    rot: gp.rot,
    // 各环角速度：三版共用同一张表，运动感才会一致
    spin: { border: 0.16, outer: 0.30, vine: -0.24, inner: 0.48, center: -0.64 },
    border,
    outer: { rIn: outerRIn, petals: outer },
    vine: { rMid, amp, lobes, leaves, nodes },
    inner: { r0: innerR0, petals: inner },
    center,
  };
}

// 环带局部坐标：把点转到某角度、某半径起点的瓣根坐标系
export function atPetal(g, a, r) {
  g.rotate(a);
  g.translate(r, 0);
}
