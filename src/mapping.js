// 只做状态 → 视觉参数映射，不含绘制、不含设备读取。
// 三条路线共享同一份状态，便于“同一输入、不同审美输出”的对照。
//   mapA  → 材质玻璃（WebGL）
//   mapB  → 典雅·满幅平涂万花筒
//   mapB2 → 典雅·同心多边形投影花

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function mapA(s) {
  // 稳定度 → 对称份数（二面体折叠的 N）
  const symmetry = Math.round(11 + s.stability * 13);        // 11–24
  // 复杂度 → 单元密度（每扇区球/管/珠的数量）
  const density = clamp(0.15 + s.complexity * 0.85, 0.15, 1);
  // 变化 → 色散强度
  const dispersion = 0.35 + s.change * 1.15;
  // 激活度 → 旋转与单元尺寸
  const rotSpeed = 0.02 + s.activation * 0.16;
  // 集中度 → 缩放（越大越聚焦中心）
  const zoom = clamp(0.20 + s.focus * 0.55, 0.2, 0.75);
  // 稳定度 → 色相偏移
  const hueShift = s.stability * 0.45;
  // 信号质量 → 透明度与泛光
  const bloom = 0.14 + s.activation * 0.26;

  return { symmetry, density, dispersion, rotSpeed, zoom, hueShift, bloom };
}

export function mapB(s) {
  // 稳定度 → 对称份数（扇区数，每个扇区再镜像一次）
  const symmetry = Math.round(5 + s.stability * 9);           // 5–14
  // 复杂度 → 每扇区图元数量
  const shapes = Math.round(6 + s.complexity * 22);           // 6–28
  // 集中度 → 主纹样放大、描边加粗
  const scale = 0.86 + s.focus * 0.30;
  const lw = 1.6 + s.focus * 2.8;
  // 变化 → 形变幅度
  const deform = 0.25 + s.change * 0.85;
  // 激活度 → 缓慢旋转
  const rotSpeed = 0.008 + s.activation * 0.055;
  // 稳定度 → 色相与饱和度
  const hueShift = s.stability * 0.55;
  const sat = 0.88 + s.focus * 0.22;
  const opacity = 0.82 + s.quality * 0.18;

  return { symmetry, shapes, scale, lw, deform, rotSpeed, hueShift, sat, opacity };
}

export function mapB2(s) {
  // 稳定度 → 多边形边数
  const sides = Math.round(6 + s.stability * 6);              // 6–12
  // 复杂度 → 层数
  const layers = Math.round(2 + s.complexity * 2);            // 2–4
  // 复杂度 + 集中度 → 中心花瓣数
  const petals = Math.round(18 + s.complexity * 26 + s.focus * 10); // 18–54
  // 激活度 → 光强与呼吸
  const light = 0.45 + s.activation * 0.55;
  // 变化 → 花瓣开合
  const open = 0.35 + s.change * 0.75;
  // 集中度 → 主体缩放
  const scale = 0.72 + s.focus * 0.28;
  const hueShift = s.stability * 0.8;
  const opacity = 0.8 + s.quality * 0.2;
  const rotSpeed = 0.006 + s.activation * 0.03;

  return { sides, layers, petals, light, open, scale, hueShift, opacity, rotSpeed };
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
