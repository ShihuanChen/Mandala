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

// ─────────── 纹样层：状态 → 京绣母题 ───────────
// 只用京绣的五个定式，各自对应一种主导状态，避免母题与状态脱钩：
//   tuanhua   宝相团花：稳定、对称、中心收束（默认态）
//   mudan     缠枝牡丹：活跃但有序，生长连续
//   fenghuang 凤凰羽：高激活、尖锐、方向感强
//   haishui   海水江崖：高变化、低稳定，边界翻涌
//   dazi      打籽团：高复杂、低激活，靠颗粒密度承载信息
export function pickMotif(s) {
  const score = {
    tuanhua: 1.15 * s.stability + 0.55 * s.focus - 0.35 * s.change,
    mudan: 0.55 * s.activation + 0.45 * s.stability + 0.35 * s.complexity,
    fenghuang: 1.05 * s.activation + 0.45 * s.focus - 0.30 * Math.abs(0.5 - s.stability),
    haishui: 1.10 * s.change + 0.55 * (1 - s.stability) + 0.30 * s.complexity,
    dazi: 0.85 * s.complexity + 0.45 * (1 - s.activation) + 0.25 * s.stability,
  };
  let best = 'tuanhua';
  for (const k in score) if (score[k] > score[best]) best = k;
  return best;
}

// ─────────── 渲染层适配 ───────────
// 三个渲染器不读状态，只读各自的参数对象；适配只做量纲换算。

export function mapA(s) {
  const P = mapP(s);
  return {
    symmetry: Math.round(lerp(10, 26, P.P14_radialRepeat)),      // P14 → 二面体份数
    density: clamp(0.16 + P.P10_grain * 0.84, 0.16, 1),          // P10 → 每扇区单元数
    dispersion: 0.22 + P.P8_sharpness * 0.85,                     // P8 → 色散
    rotSpeed: lerp(0.006, 0.052, P.P20_rotSpeed),                 // 放慢
    zoom: clamp(0.30 + P.P13_centerEmphasis * 0.42, 0.3, 0.72),   // P13 → 主体尺度
    hueShift: P.P1_hue,
    bloom: 0.10 + P.P18_metal * 0.22,
    metal: P.P18_metal,
    transparency: P.P19_transparency,
    ringGap: P.P15_ringGap,
    closure: P.P16_closure,
  };
}

export function mapB(s) {
  const P = mapP(s);
  return {
    symmetry: Math.round(lerp(10, 20, P.P14_radialRepeat)),       // P14 → 外瓣数
    slots: P.P9_coverage > 0.74 ? 3 : (P.P9_coverage > 0.48 ? 2 : 1), // P9 → 缠枝密度
    scale: 0.90 + P.P13_centerEmphasis * 0.24,                    // P13 → 团花尺度
    lw: 0.85 + P.P17_lineWidth * 1.9,                             // P17 → 盘金线宽
    deform: 0.16 + P.P7_curvature * 0.72,                         // P7 → 瓣形曲率
    layers: Math.round(lerp(3, 7, P.P11_layers)),                 // P11 → 套针层数
    grain: P.P10_grain,                                           // P10 → 打籽密度
    rotSpeed: lerp(0.0025, 0.014, P.P20_rotSpeed),                // 放慢
    hueShift: P.P1_hue,
    sat: P.P3_saturation,                                         // P3
    light: P.P2_lightness,                                        // P2
    metal: P.P18_metal,                                           // P18 → 金线亮度
    alpha: 0.58 + P.P19_transparency * 0.40,                      // P19 → 母题不透明度
    closure: P.P16_closure,                                       // P16 → 边饰闭合
    opacity: 0.82 + s.quality * 0.18,
  };
}

export function mapB2(s) {
  const P = mapP(s);
  return {
    sides: Math.round(lerp(6, 16, P.P14_radialRepeat)),           // P14 → 单元瓣数
    layers: Math.round(lerp(2, 6, P.P11_layers)),                 // P11 → 退晕层数
    grain: P.P10_grain,                                           // P10 → 籽粒密度
    goldW: 0.30 + P.P18_metal * 0.85,                             // P18 → 金边
    units: 0.35 + P.P9_coverage * 0.62,                           // P9 → 可见单元比例
    gap: P.P15_ringGap,                                           // P15 → 格点间距
    open: P.P7_curvature,                                         // P7 → 单元开合
    alpha: 0.40 + (1 - P.P19_transparency) * 0.45,                // P19 → 叠层强度
    hueShift: P.P1_hue,
    sat: P.P3_saturation,
    light: P.P2_lightness,
    metal: P.P18_metal,
    rotSpeed: lerp(0.0016, 0.009, P.P20_rotSpeed),                // 放慢
    opacity: 0.8 + s.quality * 0.2,
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
