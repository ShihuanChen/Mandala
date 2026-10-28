// ============================================================
// 形式语言三 · 折光
// ------------------------------------------------------------
// 图案仍是 mandala.js 生成的那一份：环带、瓣数、瓣形、籽粒位置
// 全部由 uOut / uIn / uLeaf / uNode 四组 uniform 原样传进来，
// 所以三版比对时能够逐瓣对上。
// 这里换掉的只是"东西是什么做的"：折射、色散、菲涅尔亮边，
// 而且不做方向光高光——那是光源假设，会立刻读成塑料。
// ============================================================

import { createGL } from './gl.js';

const MAX_OUT = 48;
const MAX_IN = 24;
const MAX_LEAF = 32;
const MAX_NODE = 16;

const FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;

uniform vec2 uRes;
uniform float uTime, uSpin, uBand, uR, uHue, uSat, uLight, uDisp, uMetal, uTrans;
uniform sampler2D uPrev;

uniform int uN;
uniform vec4 uOut[${MAX_OUT}];
uniform float uOutC[${MAX_OUT}];
uniform float uOutRIn;

uniform int uN2;
uniform vec4 uIn[${MAX_IN}];
uniform float uInCurv;

uniform int uNL;
uniform vec4 uLeaf[${MAX_LEAF}];

uniform int uNN;
uniform vec4 uNode[${MAX_NODE}];

uniform float uVMid, uVAmp, uVLobes;
uniform float uCR;
uniform float uInR0, uInR1;
uniform float uDotN;

const float PI = 3.141592653589793;

float hash(float n){ return fract(sin(n * 127.1) * 43758.5453); }
float hash21(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise2(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i), b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
// 浮尘：极小亮点缓慢上浮。不发光、不闪烁，只提供"空气里还有东西"的证据
float dust(vec2 p, float t, float dens){
  vec2 g = p * 26.0;
  g.y += t * 0.055;
  vec2 id = floor(g);
  vec2 f = fract(g) - 0.5;
  float h = hash21(id);
  if(h < 1.0 - dens) return 0.0;
  vec2 off = vec2(hash21(id + 1.3), hash21(id + 2.7)) - 0.5;
  float d = length(f - off * 0.70);
  float tw = 0.70 + 0.30 * sin(t * 0.45 + h * 26.0);
  return smoothstep(0.11, 0.0, d) * (0.18 + 0.30 * hash21(id + 5.1)) * tw;
}

// 与绢本/叠影共用同一色序：0 绛深 1 绛中 2 墨青 3 赭浅
vec3 band4(float i){
  float k = mod(i, 4.0);
  if(k < 0.5) return vec3(0.480, 0.165, 0.155);
  if(k < 1.5) return vec3(0.640, 0.245, 0.195);
  if(k < 2.5) return vec3(0.200, 0.280, 0.400);
  return vec3(0.700, 0.490, 0.310);
}
vec3 pal(float t){
  float x = fract(t) * 4.0;
  float i = floor(x);
  return mix(band4(i), band4(i + 1.0), fract(x));
}

vec3 refract3(vec2 uv, vec2 dOff, float R){
  vec2 o = dOff * R * min(uRes.x, uRes.y) / uRes;
  vec3 c;
  c.r = texture(uPrev, uv + o * 1.00).r;
  c.g = texture(uPrev, uv + o * 1.34).g;
  c.b = texture(uPrev, uv + o * 1.72).b;
  return c;
}

// 玻璃统一着色：暗体 + 菲涅尔亮边 + 折射亮度，不含方向光。
// 体色必须比背景亮一档，否则玻璃在深底上会沉成灰块——这是上一版发闷的根因。
vec3 glass(vec3 refr, vec3 tint, float nz, float edgePow){
  float lum = dot(refr, vec3(0.333));
  float rim = pow(1.0 - nz, edgePow);
  vec3 body = tint * (0.62 + 2.0 * lum) * mix(1.0, uTrans, 0.44);
  body += tint * 0.18;
  body += tint * rim * (0.85 + 0.65 * uMetal);
  // 玻璃边是冷的，只有少量暖金；全金边会读成贴了金箔的塑料片
  vec3 rimTint = mix(vec3(1.0, 0.95, 0.86), vec3(1.0, 0.84, 0.52), 0.35);
  body += rimTint * pow(rim, 3.2) * (0.30 + 0.40 * uMetal);
  body *= vec3(1.06, 0.99, 0.93);
  body = mix(body, vec3(dot(body, vec3(0.333))), 0.06);
  return min(body, vec3(1.25));
}

// 单片瓣的覆盖与法线。局部坐标：x 沿径向、y 沿切向（已乘半径的弧长）
// 半宽必须复现 jingxiu.petalPath 的实际收窄量（bezier 最大半宽 ≈ wid·c·0.80），
// 否则同一组 wid 在折光版里会胖一倍，三版就对不上同一个图案了。
void petalHit(vec2 L, float len, float wid, float curv,
              out float cov, out float nz, out float t, out float edge){
  t = clamp(L.x / max(len, 1e-4), 0.0, 1.0);
  float cc = 0.30 + 0.42 * curv;
  float halfW = max(wid * cc * 0.80 * pow(max(sin(PI * t), 0.0), 0.70), 1e-4);
  float dv = abs(L.y) - halfW;
  float dd = max(max(dv, -L.x), L.x - len);
  cov = smoothstep(0.0035, -0.0035, dd);
  edge = smoothstep(0.010, 0.0, abs(dd));
  nz = sqrt(max(0.0, 1.0 - pow(clamp(L.y / halfW, -1.0, 1.0), 2.0)));
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);
  float rr = length(p) / uR;

  if(uBand < -0.5){
    // 通透空间：中心偏青蓝的微光，边缘压深，两层低频雾 + 浮尘
    float d = length(p) * 1.9;
    vec3 bg = mix(vec3(0.064, 0.100, 0.134), vec3(0.008, 0.013, 0.022), smoothstep(0.0, 0.92, d));
    bg += vec3(0.046, 0.074, 0.100) * exp(-d * d * 3.4);
    float n1 = noise2(p * 2.4 + vec2(uTime * 0.006, -uTime * 0.004));
    float n2 = noise2(p * 5.1 - vec2(uTime * 0.010, uTime * 0.007));
    bg += vec3(0.050, 0.068, 0.082) * (0.55 * n1 + 0.45 * n2) * exp(-d * d * 1.6);
    float du = dust(p, uTime, 0.40) + 0.6 * dust(p * 1.9 + 7.3, uTime * 1.2, 0.28);
    bg += vec3(0.78, 0.74, 0.60) * du;
    outColor = vec4(bg, 1.0);
    return;
  }

  vec3 col = texture(uPrev, uv).rgb;
  float ang = atan(p.y, p.x) + uSpin;
  int band = int(uBand + 0.5);

  // ── 外瓣环 + 边饰 ──
  if(band == 3){
    for(int i = 0; i < ${MAX_OUT}; i++){
      if(i >= uN) break;
      vec4 q = uOut[i];
      float a = q.x + uSpin;
      float d = ang - a;
      d = d - 2.0 * PI * floor(d / (2.0 * PI) + 0.5);
      vec2 L = vec2(rr - uOutRIn, rr * d);
      float cov, nz, t, edge;
      petalHit(L, q.y, q.z, q.w, cov, nz, t, edge);
      if(cov <= 0.002) continue;
      vec3 tint = pal(uHue + uOutC[i] * 0.25 + 0.05);
      vec2 nrm = vec2(0.0, sign(L.y + 1e-6));
      vec3 refr = refract3(uv, nrm * nz * (0.055 + 0.055 * uDisp), uR);
      vec3 e = glass(refr, tint, nz, 2.7);
      e *= mix(0.58, 1.0, smoothstep(0.0, 0.26, t));
      e += vec3(1.0, 0.84, 0.52) * edge * (0.34 + 0.50 * uMetal);
      col = mix(col, e, cov * 0.93);
    }
    // 边饰双环
    for(int k = 0; k < 2; k++){
      float r0 = k == 0 ? 1.000 : 0.952;
      float ring = smoothstep(0.006, 0.0, abs(rr - r0));
      col += vec3(0.82, 0.66, 0.36) * ring * (0.30 + 0.42 * uMetal);
    }
    // 边饰打籽
    float cnt = max(uDotN, 1.0);
    float seg = 6.2831853 / cnt;
    float di = floor((ang / seg) + 0.5);
    float da = ang - di * seg;
    vec2 Ld = vec2(rr - 0.976, 0.976 * da);
    float dr = 0.0055 + 0.0030 * hash(di * 3.7 + 1.1);
    float dcov = smoothstep(dr, dr * 0.72, length(Ld));
    float dn = sqrt(max(0.0, 1.0 - pow(clamp(length(Ld) / max(dr, 1e-4), 0.0, 1.0), 2.0)));
    vec3 de = glass(refract3(uv, vec2(0.0, 1.0) * dn * 0.03, uR),
                    vec3(0.92, 0.78, 0.44), dn, 2.2);
    col = mix(col, de, dcov * 0.85);
  }

  // ── 缠枝环：主枝 + 叶 + 节点 ──
  if(band == 2){
    float th = atan(p.y, p.x) + uSpin;
    float rv = uVMid + uVAmp * sin(uVLobes * th);
    float dv = rr - rv;
    float tube = smoothstep(0.009, 0.0, abs(dv));
    if(tube > 0.002){
      float nz = sqrt(max(0.0, 1.0 - pow(clamp(dv / 0.009, -1.0, 1.0), 2.0)));
      vec3 e = glass(refract3(uv, vec2(0.0, sign(dv)) * nz * 0.05, uR),
                     vec3(0.86, 0.70, 0.42), nz, 2.4);
      col = mix(col, e, tube * 0.86);
    }

    for(int i = 0; i < ${MAX_LEAF}; i++){
      if(i >= uNL) break;
      vec4 q = uLeaf[i];
      float a = q.x + uSpin;
      float d = ang - a;
      d = d - 2.0 * PI * floor(d / (2.0 * PI) + 0.5);
      // 叶在枝上，局部原点随角度移动：用极坐标近似圆心
      vec2 c = vec2(cos(a), sin(a)) * q.y;
      vec2 rel = vec2(rr * cos(ang), rr * sin(ang)) - c;
      vec2 Lr = vec2(rel.x * cos(q.z) + rel.y * sin(q.z),
                     -rel.x * sin(q.z) + rel.y * cos(q.z));
      float cov, nz, t, edge;
      petalHit(Lr, q.w, q.w * 0.34, 0.5, cov, nz, t, edge);
      if(cov <= 0.004) continue;
      vec3 tint = vec3(0.26, 0.50, 0.42);
      vec3 e = glass(refract3(uv, vec2(0.0, sign(Lr.y + 1e-6)) * nz * 0.04, uR), tint, nz, 2.4);
      col = mix(col, e, cov * 0.88);
    }

    for(int i = 0; i < ${MAX_NODE}; i++){
      if(i >= uNN) break;
      vec4 q = uNode[i];
      float a = q.x + uSpin;
      vec2 c = vec2(cos(a), sin(a)) * q.y;
      vec2 rel = vec2(rr * cos(ang), rr * sin(ang)) - c;
      float dist = length(rel);
      float cov = smoothstep(q.z, q.z * 0.94, dist);
      if(cov <= 0.004) continue;
      float nz = sqrt(max(0.0, 1.0 - pow(clamp(dist / max(q.z, 1e-4), 0.0, 1.0), 2.0)));
      vec3 tint = pal(uHue + (q.w < 0.5 ? 0.0 : 3.0) * 0.25 + 0.05);
      vec3 e = glass(refract3(uv, rel / max(q.z, 1e-4) * (0.05 + 0.05 * uDisp), uR), tint, nz, 2.8);
      float rim = smoothstep(0.004, 0.0, abs(dist - q.z));
      e += vec3(1.0, 0.84, 0.52) * rim * (0.20 + 0.40 * uMetal);
      col = mix(col, e, cov * 0.92);
    }
  }

  // ── 内瓣环 ──
  if(band == 1){
    for(int i = 0; i < ${MAX_IN}; i++){
      if(i >= uN2) break;
      vec4 q = uIn[i];
      float a = q.x + uSpin;
      float d = ang - a;
      d = d - 2.0 * PI * floor(d / (2.0 * PI) + 0.5);
      vec2 L = vec2(rr - q.y, rr * d);
      float cov, nz, t, edge;
      petalHit(L, q.z, q.w, uInCurv, cov, nz, t, edge);
      if(cov <= 0.002) continue;
      float ci = mod(float(i), 4.0) > 0.5 && mod(float(i), 4.0) < 1.5 ? 2.0 : 0.0;
      vec3 tint = pal(uHue + ci * 0.25 + 0.05);
      vec2 nrm = vec2(0.0, sign(L.y + 1e-6));
      vec3 e = glass(refract3(uv, nrm * nz * (0.045 + 0.05 * uDisp), uR), tint, nz, 2.5);
      e *= mix(0.66, 1.0, smoothstep(0.0, 0.30, t));
      e += vec3(1.0, 0.84, 0.52) * edge * (0.30 + 0.44 * uMetal);
      col = mix(col, e, cov * 0.92);
    }
    for(int k = 0; k < 2; k++){
      float r0 = k == 0 ? uInR0 : uInR1;
      float ring = smoothstep(0.005, 0.0, abs(rr - r0));
      col += vec3(0.80, 0.64, 0.34) * ring * (0.24 + 0.36 * uMetal);
    }
  }

  // ── 中心 ──
  if(band == 0){
    float dist = length(p) / uR;
    float cov = smoothstep(uCR, uCR * 0.97, dist);
    if(cov > 0.002){
      // 打籽：抖动的六方格
      vec2 q = vec2(rr * cos(ang), rr * sin(ang)) / uCR;
      vec2 gd = vec2(0.155, 0.178);
      vec2 gi = floor(q / gd + 0.5);
      vec2 gf = q / gd - gi;
      float h = hash21(gi * 1.7);
      vec3 base = vec3(0.10, 0.045, 0.045) + vec3(0.10, 0.06, 0.03) * h;
      float sd = length((gf - 0.5) * gd) - 0.030;
      float scov = smoothstep(0.008, -0.004, sd);
      float snz = sqrt(max(0.0, 1.0 - pow(clamp(length((gf - 0.5) * gd) / 0.034, 0.0, 1.0), 2.0)));
      vec3 se = glass(refract3(uv, vec2(0.0, 1.0) * snz * 0.03, uR),
                      vec3(0.90, 0.76, 0.44), snz, 2.4);
      vec3 body = mix(base, se, scov * 0.92);
      float nz = sqrt(max(0.0, 1.0 - pow(clamp(dist / uCR, 0.0, 1.0), 2.0)));
      vec3 e = glass(refract3(uv, vec2(0.0, 1.0) * nz * 0.05, uR), body, nz, 2.2);
      float rim = smoothstep(0.006, 0.0, abs(dist - uCR));
      e += vec3(1.0, 0.86, 0.56) * rim * (0.26 + 0.44 * uMetal);
      col = mix(col, e, cov * 0.95);
    }
    // 四瓣十字
    for(int i = 0; i < 4; i++){
      float a = PI * 0.25 + float(i) * PI * 0.5 + uSpin;
      float d = ang - a;
      d = d - 2.0 * PI * floor(d / (2.0 * PI) + 0.5);
      vec2 L = vec2(rr, rr * d);
      float cov2, nz2, t2, edge2;
      petalHit(L, uCR * 1.06, uCR * 0.22, 0.74, cov2, nz2, t2, edge2);
      if(cov2 <= 0.003) continue;
      vec3 e = vec3(0.62, 0.50, 0.28) * (0.5 + 0.5 * nz2);
      col = mix(col, e, cov2 * 0.55);
    }
  }

  outColor = vec4(col, 1.0);
}`;

const BRIGHT_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uSrc;
uniform float uThresh;
void main(){
  vec3 c = texture(uSrc, vUv).rgb;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  float k = max(l - uThresh, 0.0) / max(1.0 - uThresh, 0.001);
  outColor = vec4(c * k * k * 1.1, 1.0);
}`;

const BLUR_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uSrc;
uniform vec2 uDir;
uniform vec2 uRes;
void main(){
  vec2 t = uDir / uRes;
  vec3 c = texture(uSrc, vUv).rgb * 0.226;
  c += (texture(uSrc, vUv + t * 1.38).rgb + texture(uSrc, vUv - t * 1.38).rgb) * 0.316;
  c += (texture(uSrc, vUv + t * 3.23).rgb + texture(uSrc, vUv - t * 3.23).rgb) * 0.071;
  outColor = vec4(c, 1.0);
}`;

const ADD_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uBase;
uniform sampler2D uBloom;
uniform float uBloomAmt;
void main(){
  vec3 c = texture(uBase, vUv).rgb + texture(uBloom, vUv).rgb * uBloomAmt;
  vec2 p = vUv - 0.5;
  c *= 1.0 - 0.055 * dot(p, p);
  float d = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  outColor = vec4(c + d / 255.0, 1.0);
}`;

// G → 四组 uniform 数组（每帧一次，384 字节级别）
function packG(G) {
  const out = new Float32Array(MAX_OUT * 4);
  const outc = new Float32Array(MAX_OUT);
  const inn = new Float32Array(MAX_IN * 4);
  const leaf = new Float32Array(MAX_LEAF * 4);
  const node = new Float32Array(MAX_NODE * 4);

  const nOut = Math.min(G.outer.petals.length, MAX_OUT);
  for (let i = 0; i < nOut; i++) {
    const p = G.outer.petals[i];
    out.set([p.a, p.len, p.wid, p.curv], i * 4);
    outc[i] = p.cIdx;
  }
  const nIn = Math.min(G.inner.petals.length, MAX_IN);
  for (let i = 0; i < nIn; i++) {
    const p = G.inner.petals[i];
    inn.set([p.a, p.r0, p.len, p.wid], i * 4);
  }
  const nLeaf = Math.min(G.vine.leaves.length, MAX_LEAF);
  for (let i = 0; i < nLeaf; i++) {
    const L = G.vine.leaves[i];
    leaf.set([L.a, L.r, L.ang, L.len], i * 4);
  }
  const nNode = Math.min(G.vine.nodes.length, MAX_NODE);
  for (let i = 0; i < nNode; i++) {
    const N = G.vine.nodes[i];
    // node 需要笛卡尔坐标；着色器里按极坐标还原，这里传极坐标更省事
    node.set([N.a, N.r, N.rad, N.cIdx], i * 4);
  }
  return {
    uOut: out, uOutC: outc, nOut,
    uIn: inn, nIn,
    uLeaf: leaf, nLeaf,
    uNode: node, nNode,
  };
}

export function createGlass(canvas) {
  let glc = null;
  try {
    glc = createGL(canvas);
  } catch (e) {
    console.error('WebGL init failed:', e);
  }
  if (!glc) return null;

  const spins = [0, 0, 0, 0, 0];

  return {
    draw(G, pr, t, dt = 0.016, st) {
      const gl = glc.gl;
      const cw = canvas.width;
      const ch = canvas.height;
      if (!cw || !ch) return;

      const baseSpin = G.rot * 0.026 * pr.spinScale;
      spins[0] += dt * baseSpin * Math.abs(G.spin.center);
      spins[1] += dt * baseSpin * Math.abs(G.spin.inner);
      spins[2] += dt * baseSpin * Math.abs(G.spin.vine) * (G.spin.vine < 0 ? -1 : 1);
      spins[3] += dt * baseSpin * Math.abs(G.spin.outer);
      spins[4] += dt * baseSpin * Math.abs(G.spin.border);

      const bandProg = glc.program(FS);
      const brightProg = glc.program(BRIGHT_FS);
      const blurProg = glc.program(BLUR_FS);
      const addProg = glc.program(ADD_FS);

      const A = glc.target('a', cw, ch);
      const B = glc.target('b', cw, ch);
      const bl1 = glc.target('bl1', Math.max(1, cw >> 1), Math.max(1, ch >> 1));
      const bl2 = glc.target('bl2', Math.max(1, cw >> 1), Math.max(1, ch >> 1));

      const packed = packG(G);
      const common = {
        uRes: [cw, ch],
        uTime: t,
        uR: 0.435 * pr.scale,
        uHue: pr.hueShift + (pr.sat - 0.5) * 0.10,
        uSat: pr.sat,
        uLight: pr.light,
        uDisp: pr.dispersion,
        uMetal: pr.metal,
        uTrans: pr.trans,
        uOut: { v4: packed.uOut },
        uOutC: { v1: packed.uOutC },
        uN: { i: packed.nOut },
        uOutRIn: G.outer.rIn,
        uIn: { v4: packed.uIn },
        uN2: { i: packed.nIn },
        uInCurv: G.inner.petals.length ? G.inner.petals[0].curv : 0.5,
        uLeaf: { v4: packed.uLeaf },
        uNL: { i: packed.nLeaf },
        uNode: { v4: packed.uNode },
        uNN: { i: packed.nNode },
        uVMid: G.vine.rMid,
        uVAmp: G.vine.amp,
        uVLobes: G.vine.lobes,
        uCR: G.center.r,
        uInR0: G.inner.r0,
        uInR1: G.inner.r0 + (G.inner.petals.length ? G.inner.petals[0].len : 0.17),
        uDotN: G.border.dots.length,
      };

      // 由外向内逐层合成，内层从外层结果里折射
      glc.draw(bandProg, A, { ...common, uBand: -1, uSpin: 0 });
      glc.draw(bandProg, B, { ...common, uBand: 3, uSpin: spins[3], uPrev: A });
      glc.draw(bandProg, A, { ...common, uBand: 2, uSpin: spins[2], uPrev: B });
      glc.draw(bandProg, B, { ...common, uBand: 1, uSpin: spins[1], uPrev: A });
      glc.draw(bandProg, A, { ...common, uBand: 0, uSpin: spins[0], uPrev: B });

      glc.draw(brightProg, bl1, { uSrc: A, uThresh: 0.72 });
      glc.draw(blurProg, bl2, { uSrc: bl1, uDir: [1, 0], uRes: [bl1.w, bl1.h] });
      glc.draw(blurProg, bl1, { uSrc: bl2, uDir: [0, 1], uRes: [bl2.w, bl2.h] });
      glc.draw(blurProg, bl2, { uSrc: bl1, uDir: [2.2, 0], uRes: [bl1.w, bl1.h] });
      glc.draw(blurProg, bl1, { uSrc: bl2, uDir: [0, 2.2], uRes: [bl2.w, bl2.h] });

      glc.draw(addProg, null, { uBase: A, uBloom: bl1, uBloomAmt: pr.bloom });

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    },
  };
}
