// 状态 → P1–P20 视觉参数（严格按「第二层：生理-视觉参数」的六层结构与权重）
// 六层权重：结构 .25 / 动态 .25 / 色彩 .20 / 形态 .15 / 密度 .10 / 材质 .05
// 门控：quality 决定变化幅度与更新节奏，质量低时收幅并放慢（规范「更新节奏」条）
//
// 主控 → 联动关系（规范「一对一多映射」）：
//   activation(activity) → 动态主控 .60，色彩/材质联动 .25
//   stability           → 结构主控 .60，形态联动 .25
//   complexity          → 密度主控 .50，形态/结构联动 .35
//   change(trend)       → 动态主控 .60，结构/色彩联动 .25
//   focus(中心-外围)     → 结构偏移，中心强调
//
// 本模块只产出参数，不含绘制、不含设备读取。

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, t) => a + (b - a) * t;

// 质量门控：质量低 → 变化幅度收紧、节奏放慢
const gate = (q) => clamp(0.35 + q * 0.65, 0.35, 1);

// ─────────── P1–P20 规范层 ───────────
// 全部返回 0..1 或可直接使用的数值，便于在同一份表里对照生理输入。
export function mapP(s) {
  const q = gate(s.quality);
  const act = s.activation * q;
  const stab = s.stability;
  const cplx = s.complexity * q;
  const chg = s.change * q;
  const foc = s.focus;

  return {
    // 色彩（权重 .20）
    P1_hue: 0.52 + 0.10 * stab - 0.06 * act,          // 色相：冷靛为基，稳定偏青、活跃偏暖
    P2_lightness: 0.34 + 0.26 * act,                  // 明度：活跃抬高
    P3_saturation: 0.18 + 0.34 * act,                 // 饱和度：活跃提高（深色底需低饱和才通透）
    P4_primaryRatio: 0.42 + 0.34 * stab,              // 主色比例：稳定时主色更集中
    P5_gradientDir: chg,                              // 色彩梯度：>0.5 中心向外生长，<0.5 外围向内收束

    // 形态（权重 .15）
    P6_straightRatio: 0.30 + 0.48 * stab,             // 直曲比例：稳定 → 直与规则边缘
    P7_curvature: 0.28 + 0.52 * cplx,                 // 曲率：复杂度 → 回旋增加
    P8_sharpness: 0.22 + 0.58 * act,                  // 尖锐度：活跃 → 尖角与对比

    // 密度（权重 .10）
    P9_coverage: 0.34 + 0.46 * act,                   // 覆盖率：活动/扩散 → 覆盖面积
    P10_grain: 0.22 + 0.62 * cplx,                    // 颗粒密度：复杂度/谱熵
    P11_layers: 0.30 + 0.50 * cplx + 0.20 * chg,      // 层数：复杂度 + 缓慢趋势
    P12_branching: 0.20 + 0.60 * cplx,                // 分叉数

    // 结构（权重 .25）
    P13_centerEmphasis: 0.38 + 0.50 * foc,            // 中心强调：集中度
    P14_radialRepeat: 0.34 + 0.52 * stab,             // 径向重复/对称阶数：稳定 → 秩序更清楚
    P15_ringGap: 0.58 - 0.34 * cplx,                  // 层间距：复杂度 → 层更密
    P16_closure: 0.30 + 0.58 * stab,                  // 边界闭合：稳定 → 边界完整

    // 材质（权重 .05，只做局部强化，不压过结构）
    P17_lineWidth: 0.36 + 0.30 * stab + 0.18 * act,   // 线宽：稳定时均匀，活跃时变化加大
    P18_metal: 0.20 + 0.55 * act,                     // 金属高光：峰值增强 → 金线变亮
    P19_transparency: 0.74 - 0.30 * act + 0.14 * stab,// 透明度：稳定 → 透明层增加（轻、远）

    // 动态（权重 .25）
    P20_rotSpeed: 0.10 + 0.55 * act,                  // 旋转速度
    P20_grow: chg,                                    // 生长/扩散（>0.5 向外）
    P20_jitter: 0.15 + 0.60 * chg,                    // 局部扰动
    P20_updateRate: 0.25 + 0.55 * q,                  // 更新节奏：质量低 → 放慢
  };
}

// ─────────── 三种形式语言 ───────────
// 图案由 mandala.js 统一生成，这里只产出"材质与形式"参数。
// 三者的 scale / hueShift / rot 全部走同一表达式，所以同一状态下
// 三版的图案大小与转速一致，差别只剩质感。

export function mapSilk(s) {
  const P = mapP(s);
  return {
    hueShift: P.P1_hue,
    sat: P.P3_saturation,
    light: P.P2_lightness,
    lw: 0.80 + P.P17_lineWidth * 1.9,      // P17 → 盘金线宽
    metal: P.P18_metal,                     // P18 → 金线亮度
    alpha: 0.90 + P.P19_transparency * 0.10,
    scale: 0.94 + P.P13_centerEmphasis * 0.10,
    spinScale: lerp(0.55, 1.35, P.P20_rotSpeed),
  };
}

export function mapLac(s) {
  const P = mapP(s);
  return {
    hueShift: P.P1_hue,
    sat: P.P3_saturation,
    light: P.P2_lightness,
    metal: P.P18_metal,
    trans: P.P19_transparency,
    scale: 0.94 + P.P13_centerEmphasis * 0.10,
    spinScale: lerp(0.55, 1.35, P.P20_rotSpeed),
  };
}

export function mapGlass(s) {
  const P = mapP(s);
  return {
    hueShift: P.P1_hue,
    sat: P.P3_saturation,
    light: P.P2_lightness,
    metal: P.P18_metal,
    trans: P.P19_transparency,
    dispersion: 0.20 + P.P8_sharpness * 0.75,
    bloom: 0.10 + P.P18_metal * 0.20,
    scale: 0.94 + P.P13_centerEmphasis * 0.10,
    spinScale: lerp(0.55, 1.35, P.P20_rotSpeed),
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
