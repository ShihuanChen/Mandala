// 只做状态 → 视觉参数映射，不含绘制、不含设备读取。
// 两套风格共享同一份状态，便于“同一输入、不同审美输出”的对照。

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function mapB(s) {
  // 稳定度 → 对称份数、结构完整度、留白
  const symmetry = Math.round(4 + s.stability * 12);        // 4–16
  const whitespace = clamp(0.30 + s.stability * 0.28, 0.30, 0.62);
  const motifScale = clamp(0.62 - whitespace * 0.24, 0.46, 0.58); // 纹样直径 / 短边

  // 复杂度 → 点/线/面数量
  const pointCount = Math.round(20 + s.complexity * 280);   // 20–300
  const lineCount = Math.round(4 + s.complexity * 28);      // 4–32
  const faceCount = Math.round(4 + s.complexity * 20);      // 4–24

  // 集中度 → 线宽、主体突出
  const lineWidth = 1.1 + s.focus * 2.6;                    // 1.1–3.7
  // 激活度 → 克制的生长/旋转速度
  const rotSpeed = 0.015 + s.activation * 0.09;
  // 变化幅度 → 呼吸与局部开合
  const breath = 0.006 + s.change * 0.05;
  const breathSpeed = 0.5 + s.activation * 0.7;
  // 质量 → 整体透明度与更新权重
  const opacity = 0.55 + s.quality * 0.45;

  return {
    symmetry, whitespace, motifScale,
    pointCount, lineCount, faceCount,
    lw: lineWidth, rotSpeed, breath, breathSpeed, opacity,
    contrast: 0.7 + s.focus * 0.3,
  };
}

export function mapA(s) {
  // 复杂度 → 层数/花瓣/珠体/粒子
  const layers = Math.round(3 + s.complexity * 3);          // 3–6
  const petals = Math.round(8 + s.stability * 8 + s.complexity * 4); // 8–20
  const orbs = Math.round(4 + s.complexity * 18);           // 4–22
  const ribbons = Math.round(3 + s.activation * 5);         // 3–8
  const particles = Math.round(10 + s.complexity * 50);     // 10–60

  // 激活度 → 旋转速度、丝带长度、发光
  const rotSpeed = 0.02 + s.activation * 0.30;
  const ribbonLen = 0.36 + s.activation * 0.46;
  const glow = 2 + s.activation * 12;
  // 变化 → 局部扭曲
  const distortion = s.change * 0.55;
  // 集中 → 核心比例与亮度
  const coreScale = 0.085 + s.focus * 0.085;
  const opacity = 0.55 + s.quality * 0.45;

  return {
    layers, petals, orbs, ribbons, particles,
    rotSpeed, ribbonLen, glow, distortion, coreScale, opacity,
    hueShift: s.stability * 60,
  };
}

// 帧间平滑：同一份参数对象原地插值，避免跳变
export function lerpParams(prev, target, alpha) {
  for (const k in target) {
    if (typeof target[k] === 'number') {
      prev[k] = prev[k] === undefined ? target[k] : prev[k] + (target[k] - prev[k]) * alpha;
    } else {
      prev[k] = target[k];
    }
  }
  return prev;
}
