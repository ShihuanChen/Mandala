// 风格 B2：典雅 · 同心多边形投影花
// 参考特征：同心多边形层（八边形→方形→花形）逐层叠加靠正片叠底产生无意的几何切分、
// 顶部一盏射灯打锥形光斑、中心由几十片小花瓣拼成且每片有明暗两面、墙面留白。
const TAU = Math.PI * 2;

const hsl = (h, s, l, a = 1) => `hsla(${h}, ${s}%, ${l}%, ${a})`;

function polyPath(g, n, r, rot) {
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const a = rot + i * TAU / n;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i) g.lineTo(x, y);
    else g.moveTo(x, y);
  }
  g.closePath();
}

function petalQuad(g, w, h) {
  g.beginPath();
  g.moveTo(0, 0);
  g.bezierCurveTo(w, -h * 0.45, w * 0.62, -h * 0.92, 0, -h);
  g.bezierCurveTo(-w * 0.62, -h * 0.92, -w, -h * 0.45, 0, 0);
  g.closePath();
}

export function drawB2(ctx, W, H, st, pr, t) {
  const g = ctx;
  const cx = W / 2;
  const cy = H * 0.545;
  const R = Math.min(W, H * 1.35) * 0.52 * pr.scale;
  const hue = pr.hueShift * 24;
  const spin = t * pr.rotSpeed;

  // 墙面
  const wall = g.createLinearGradient(0, 0, 0, H);
  wall.addColorStop(0, hsl(17 + hue, 48, 80));
  wall.addColorStop(0.55, hsl(16 + hue, 46, 74));
  wall.addColorStop(1, hsl(14 + hue, 42, 64));
  g.fillStyle = wall;
  g.fillRect(0, 0, W, H);

  // 墙面微差：右侧一面墙的转角阴影
  const side = g.createLinearGradient(W * 0.78, 0, W, 0);
  side.addColorStop(0, 'rgba(90,70,40,0)');
  side.addColorStop(1, 'rgba(90,70,40,0.16)');
  g.fillStyle = side;
  g.fillRect(0, 0, W, H);

  // ---- 底层：两块交叉的方形暗面（先落底，只在外围透出交叠，不压中心） ----
  g.save();
  g.translate(cx, cy);

  // 裁到圆内，避免方形的直角穿出画面形成生硬切边
  g.beginPath();
  g.arc(0, 0, R * 1.02, 0, Math.PI * 2);
  g.clip();

  g.globalCompositeOperation = 'multiply';
  g.globalAlpha = 0.30;
  g.fillStyle = hsl(232 + hue, 40, 50);
  g.save();
  g.rotate(-spin * 0.4 + Math.PI / 4);
  g.fillRect(-R * 0.80, -R * 0.80, R * 1.60, R * 1.60);
  g.restore();

  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 0.22;
  g.fillStyle = hsl(26 + hue, 82, 64);
  g.save();
  g.rotate(spin * 0.6);
  g.fillRect(-R * 0.96, -R * 0.96, R * 1.92, R * 1.92);
  g.restore();

  g.restore();

  // ---- 同心多边形层：由外向内，外深内浅，中心保持干净 ----
  g.save();
  g.translate(cx, cy);

  const nLayers = Math.max(2, Math.round(pr.layers));
  const sides = Math.max(4, Math.round(pr.sides));
  // 三层配色：外靛蓝 → 中橙 → 内米白；层数更多时按此序列循环
  const RAMP = [[228, 46, 44], [24, 84, 62], [38, 70, 88]];

  for (let i = 0; i < nLayers; i++) {
    const f = nLayers === 1 ? 0 : i / (nLayers - 1);
    const r = R * (1.0 - f * 0.56);
    const n = i === 0 ? sides : (i % 2 === 0 ? sides : 4);
    const rot = (i % 2 ? Math.PI / n : 0) + spin * (0.25 + i * 0.35);
    const [hh, ss, ll] = RAMP[i % 3];
    // 最外层用正片叠底压暗，内层用正常叠加提亮，避免中心糊成灰绿
    g.globalCompositeOperation = i === 0 ? 'multiply' : 'source-over';
    g.globalAlpha = i === 0 ? 0.55 : 0.62 - f * 0.10;
    g.fillStyle = hsl(hh + hue, ss, ll);
    polyPath(g, n, r, rot);
    g.fill();
  }

  g.restore();

  // ---- 中心拼花 ----
  g.save();
  g.translate(cx, cy);
  g.globalCompositeOperation = 'source-over';

  // 花瓣底圈
  const nP = Math.max(8, Math.round(pr.petals));
  const open = pr.open;
  for (let row = 0; row < 2; row++) {
    const rowScale = row === 0 ? 1 : 0.62;
    const count = row === 0 ? nP : Math.round(nP * 0.66);
    const hr = R * (0.19 + 0.10 * open) * rowScale;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + spin * (row === 0 ? 1 : -1.3) + row * 0.4;
      g.save();
      g.rotate(a);
      g.translate(0, -R * (0.16 + 0.075 * row));
      g.globalAlpha = 0.92 - row * 0.08;
      // 亮面
      g.fillStyle = hsl(350 + hue, 42, 90 - row * 5);
      petalQuad(g, hr * 0.32, hr);
      g.fill();
      // 暗面：同形右半，偏移一点
      g.globalAlpha = 0.42;
      g.fillStyle = hsl(224 + hue, 40, 70);
      g.save();
      g.translate(hr * 0.09, 0);
      petalQuad(g, hr * 0.22, hr * 0.80);
      g.fill();
      g.restore();
      g.restore();
    }
  }

  // 中心小花
  g.globalAlpha = 0.92;
  g.fillStyle = hsl(212 + hue, 44, 58);
  polyPath(g, 8, R * 0.085, spin * 0.5);
  g.fill();
  g.globalAlpha = 0.85;
  g.fillStyle = hsl(350 + hue, 40, 90);
  for (let i = 0; i < 8; i++) {
    g.save();
    g.rotate((i / 8) * TAU - spin * 0.8);
    g.translate(0, -R * 0.042);
    petalQuad(g, R * 0.018, R * 0.045);
    g.fill();
    g.restore();
  }
  g.globalAlpha = 1;
  g.fillStyle = hsl(44 + hue, 60, 72);
  g.beginPath();
  g.arc(0, 0, R * 0.018, 0, TAU);
  g.fill();
  g.restore();

  // ---- 顶部射灯 ----
  const lightY = H * 0.045;
  const li = pr.light;

  g.save();
  g.globalCompositeOperation = 'lighter';

  // 灯具亮点
  const bulb = g.createRadialGradient(cx, lightY, 0, cx, lightY, Math.max(W, H) * 0.10);
  bulb.addColorStop(0, `rgba(255, 252, 240, ${0.52 * li})`);
  bulb.addColorStop(0.28, `rgba(255, 246, 222, ${0.18 * li})`);
  bulb.addColorStop(1, 'rgba(255, 246, 222, 0)');
  g.fillStyle = bulb;
  g.fillRect(0, 0, W, H);

  // 锥形光斑：先模糊再画，避免硬边
  g.filter = 'blur(22px)';
  const cone = g.createLinearGradient(0, lightY, 0, H * 0.95);
  cone.addColorStop(0, `rgba(255, 250, 232, ${0.17 * li})`);
  cone.addColorStop(0.45, `rgba(255, 248, 226, ${0.06 * li})`);
  cone.addColorStop(1, 'rgba(255, 248, 226, 0)');
  g.fillStyle = cone;
  g.beginPath();
  g.moveTo(cx - W * 0.022, lightY);
  g.lineTo(cx + W * 0.022, lightY);
  g.lineTo(cx + W * 0.34, H * 0.95);
  g.lineTo(cx - W * 0.34, H * 0.95);
  g.closePath();
  g.fill();
  g.filter = 'none';

  g.restore();

  // 边缘压暗，把注意力收回中心
  const vig = g.createRadialGradient(cx, cy, R * 0.72, cx, cy, Math.hypot(W, H) * 0.62);
  vig.addColorStop(0, 'rgba(74, 56, 30, 0)');
  vig.addColorStop(1, `rgba(74, 56, 30, ${0.30 + (1 - st.quality) * 0.2})`);
  g.fillStyle = vig;
  g.fillRect(0, 0, W, H);

  if (pr.opacity < 1) {
    g.fillStyle = `rgba(226, 212, 184, ${(1 - pr.opacity) * 0.5})`;
    g.fillRect(0, 0, W, H);
  }
}
