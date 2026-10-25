// 颜色方案集中在这里，绘制逻辑不写死颜色。
export const PAL = {
  b: {
    paper: '#F4EFE3',
    fiber: 'rgba(122,96,58,0.05)',
    vignette: 'rgba(96,72,40,0.10)',
    ink: '#242019',
    inkSoft: 'rgba(36,32,25,0.42)',
    gold: '#AE8850',
    accent: '#A2402F',
    indigo: '#2C4657',
    green: '#5C7252',
  },
  a: {
    bg: ['#171126', '#0B0913', '#05050A'],
    gold: '#E9C46A',
    goldLight: '#FFF0C2',
    goldDeep: '#B0843C',
    // 虹彩色相基准
    hueBase: [315, 272, 196, 44, 18],
  },
};

export function hsl(h, s, l, a = 1) {
  return `hsla(${((h % 360) + 360) % 360},${s}%,${l}%,${a})`;
}
