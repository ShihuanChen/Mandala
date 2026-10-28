// 风格 A：酸性新中式 · 玻璃材质径向构成（深色通透版）
// 对应参考图的特征：
//   1. 二面体折叠：atan 折进半扇区后取 abs，同时得到旋转复制与镜像
//   2. 三层环带三种单元：珠簇 / 玻璃管 / 空心球，形状各异
//   3. 折射：每趟从上一趟结果按法线偏移取样，元素内部能看到背后的东西
//   4. 色散：RGB 三通道取样偏移不同，边缘泛出彩边
//   5. 高透明叠加：由外向内逐层 composite，重叠处自然增亮
//   6. 中心涡流洞：暗芯 + 旋涡细环
//
// 本版改动（针对"廉价感"）：
//   - 去掉方向性高光（那是光源假设，会读成塑料球），改用菲涅尔细亮边 + 内部折射亮度
//   - 玻璃体本身压暗，只在边缘亮，深底上读作"通透"而不是"实心色块"
//   - 单元更小更密，靠数量而不是尺寸出精致度
import { createGL } from './gl.js';

const BAND_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;

uniform vec2 uRes;
uniform float uTime, uSpin, uBand, uN, uHue, uDensity, uDisp, uAct, uChange, uFocus, uQuality;
uniform float uMetal, uTrans;
uniform sampler2D uPrev;

const float PI = 3.141592653589793;

float hash(float n){ return fract(sin(n * 127.1) * 43758.5453); }

// 低饱和冷调色板：靛灰 / 青灰 / 香槟 / 藕 / 深蓝，深底上靠明度分层
vec3 pal(float t){
  t = fract(t) * 5.0;
  float i = floor(t);
  float f = fract(t);
  vec3 c0 = vec3(0.50, 0.62, 0.78);
  vec3 c1 = vec3(0.56, 0.76, 0.72);
  vec3 c2 = vec3(0.88, 0.78, 0.56);
  vec3 c3 = vec3(0.80, 0.62, 0.68);
  vec3 c4 = vec3(0.42, 0.50, 0.66);
  vec3 a = c0, b = c1;
  if(i < 0.5){ a = c0; b = c1; }
  else if(i < 1.5){ a = c1; b = c2; }
  else if(i < 2.5){ a = c2; b = c3; }
  else if(i < 3.5){ a = c3; b = c4; }
  else { a = c4; b = c0; }
  return mix(a, b, f);
}

vec3 refract3(vec2 uv, vec2 dOff, float R){
  vec2 o = dOff * R * min(uRes.x, uRes.y) / uRes;
  vec3 c;
  c.r = texture(uPrev, uv + o * 1.00).r;
  c.g = texture(uPrev, uv + o * 1.30).g;
  c.b = texture(uPrev, uv + o * 1.62).b;
  return c;
}

// 玻璃统一着色：暗体 + 菲涅尔亮边 + 折射亮度，不含方向光
vec3 glass(vec3 refr, vec3 tint, float nz, float edgePow){
  float lum = dot(refr, vec3(0.333));
  float rim = pow(1.0 - nz, edgePow);
  vec3 body = tint * (0.26 + 0.70 * lum) * mix(1.0, uTrans, 0.40);
  body += tint * 0.14;
  body += tint * rim * (0.72 + 0.65 * uMetal);
  body += vec3(0.90, 0.94, 1.0) * pow(rim, 3.0) * 0.30;
  return body;
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);
  float R = 0.500 * mix(1.0, 0.94, uFocus);

  if(uBand < -0.5){
    // 深底 + 中心微透的空间层次（不是光源）
    float d = smoothstep(1.05, 0.0, length(p));
    vec3 bg = vec3(0.030, 0.038, 0.048) + vec3(0.020, 0.026, 0.030) * d;
    outColor = vec4(bg, 1.0);
    return;
  }

  vec3 col = texture(uPrev, uv).rgb;

  float segH = PI / max(2.0, uN);
  float ang = atan(p.y, p.x) + uSpin;
  float mm = mod(ang + segH, 2.0 * segH) - segH;
  mm = abs(mm);
  float rr = length(p) / R;
  vec2 qf = vec2(cos(mm), sin(mm)) * rr;

  int band = int(uBand + 0.5);

  // ---- 外层空心球：更小更多，靠数量出细密 ----
  if(band == 3){
    int M = 3 + int(uDensity * 3.4);
    float r0 = 0.600, r1 = 1.00;
    float sp = (r1 - r0) / float(M);
    for(int j = 0; j < 7; j++){
      if(j >= M) break;
      float fj = float(j);
      float h = hash(fj * 7.31 + 1.7);
      float rj = r0 + sp * (fj + 0.5) + sp * 0.08 * (h - 0.5);
      float rad = min(sp * 0.42, rj * segH * 0.46);
      float aj = segH * (0.5 + 0.30 * (h - 0.5));
      vec2 c = vec2(cos(aj), sin(aj)) * rj;
      float dist = length(qf - c);
      float cov = smoothstep(rad, rad * 0.88, dist);
      if(cov <= 0.002) continue;
      vec2 d = (qf - c) / rad;
      float nz = sqrt(max(0.0, 1.0 - dot(d, d)));
      vec3 tint = pal(uHue + 0.17 * fj + 0.26 * h + 0.04);
      vec3 refr = refract3(uv, d * (0.085 + 0.060 * uDisp), R);
      vec3 e = glass(refr, tint, nz, 3.0);
      // 空心感：球心再压一点，边缘留亮
      e *= mix(0.72, 1.0, smoothstep(0.0, 0.95, length(d)));
      col = mix(col, e, cov * (0.86 + 0.12 * uQuality));
    }
  }

  // ---- 中层玻璃管：径向胶囊，填满 0.28–0.66 ----
  if(band == 2){
    int M = 3 + int(uDensity * 3.4);
    float r0 = 0.280, r1 = 0.660;
    float sp = (r1 - r0) / float(M);
    for(int j = 0; j < 7; j++){
      if(j >= M) break;
      float fj = float(j);
      float h = hash(fj * 5.13 + 2.9);
      float rj = r0 + sp * (fj + 0.5);
      float hl = sp * 0.60;
      float wd = min(sp * 0.36, rj * segH * 0.44);
      float tilt = 0.20 * (h - 0.5);
      float aj = segH * (0.5 + 0.18 * (h - 0.5));
      vec2 c = vec2(cos(aj), sin(aj)) * rj;
      vec2 dir = vec2(cos(aj + tilt), sin(aj + tilt));
      vec2 nrm = vec2(-dir.y, dir.x);
      vec2 dd = qf - c;
      float along = dot(dd, dir);
      float across = dot(dd, nrm);
      float dist = length(vec2(max(abs(along) - hl * (1.0 + 0.16 * uAct), 0.0), across)) - wd;
      float cov = smoothstep(0.0, -wd * 0.22, dist);
      if(cov <= 0.002) continue;
      float u = clamp(across / wd, -1.0, 1.0);
      float nz = sqrt(max(0.0, 1.0 - u * u));
      vec3 tint = pal(uHue + 0.30 * h + 0.11 * fj + 0.42);
      vec3 refr = refract3(uv, vec2(u, along / hl) * (0.060 + 0.045 * uDisp), R);
      vec3 e = glass(refr, tint, nz, 2.4);
      // 沿轴向的细密筋纹，让管壁不是一条平色
      float rib = 0.5 + 0.5 * sin(along / hl * 9.0 + h * 6.28);
      e *= 0.88 + 0.24 * rib;
      col = mix(col, e, cov * (0.84 + 0.12 * uQuality));
    }
  }

  // ---- 内层密珠簇 ----
  if(band == 1){
    int M = 3 + int(uDensity * 3.2);
    float r0 = 0.095, r1 = 0.280;
    float sp = (r1 - r0) / float(M);
    for(int k = 0; k < 7; k++){
      if(k >= M) break;
      float fk = float(k);
      float rj = r0 + sp * (fk + 0.5);
      float rad = min(sp * 0.40, rj * segH * 0.42);
      for(int s = 0; s < 2; s++){
        float fs = float(s);
        float h = hash(fk * 7.7 + fs * 3.3 + 0.9);
        float aj = segH * ((0.5 + 0.90 * (fs - 0.5)) + 0.18 * (h - 0.5));
        vec2 c = vec2(cos(aj), sin(aj)) * (rj + sp * 0.10 * (h - 0.5));
        float cov = smoothstep(rad, rad * 0.80, length(qf - c));
        if(cov <= 0.002) continue;
        vec2 d = (qf - c) / rad;
        float nz = sqrt(max(0.0, 1.0 - dot(d, d)));
        vec3 tint = mix(vec3(0.52, 0.55, 0.62), pal(uHue + 0.44 * h + 0.10 * fk + 0.66), 0.55);
        vec3 refr = refract3(uv, d * 0.030, R);
        vec3 e = glass(refr, tint, nz, 2.6);
        col = mix(col, e, cov * 0.90);
      }
    }
  }

  // ---- 中心涡流洞 ----
  if(band == 0){
    float rr2 = length(qf);
    float swAng = atan(qf.y, qf.x);
    float swirl = 0.5 + 0.5 * sin(swAng * 4.0 + rr2 * 52.0 - uTime * 0.7 + mm * 16.0);
    float hole = smoothstep(0.112, 0.028, rr2);
    vec3 tint = pal(uHue + 0.60);
    vec3 dark = vec3(0.020, 0.024, 0.030);
    vec3 e = mix(dark, tint * 0.55, 0.30 * swirl);
    float ring = smoothstep(0.008, 0.0, abs(rr2 - 0.086 - 0.010 * swirl));
    e += tint * ring * 0.55;
    col = mix(col, e, hole * 0.95);
    col += tint * 0.028 * smoothstep(0.26, 0.05, rr2);
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
  c *= 1.0 - 0.060 * dot(p, p);
  float d = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  outColor = vec4(c + d / 255.0, 1.0);
}`;

export function createStyleA(canvas) {
  let glc = null;
  let spin = 0;
  try {
    glc = createGL(canvas);
  } catch (e) {
    console.error('WebGL init failed:', e);
  }
  if (!glc) return null;

  return {
    draw(st, pr, t, dt = 0.016) {
      const gl = glc.gl;
      const cw = canvas.width;
      const ch = canvas.height;
      if (!cw || !ch) return;

      spin += dt * (pr.rotSpeed || 0);

      const bandProg = glc.program(BAND_FS);
      const brightProg = glc.program(BRIGHT_FS);
      const blurProg = glc.program(BLUR_FS);
      const addProg = glc.program(ADD_FS);

      const A = glc.target('a', cw, ch);
      const B = glc.target('b', cw, ch);
      const bl1 = glc.target('bl1', Math.max(1, cw >> 1), Math.max(1, ch >> 1));
      const bl2 = glc.target('bl2', Math.max(1, cw >> 1), Math.max(1, ch >> 1));

      const common = {
        uRes: [cw, ch], uTime: t, uSpin: spin,
        uN: pr.symmetry, uHue: pr.hueShift, uDensity: pr.density,
        uDisp: pr.dispersion, uAct: st.activation, uChange: st.change,
        uFocus: pr.zoom, uQuality: st.quality, uMetal: pr.metal, uTrans: pr.transparency,
      };

      // 逐层由外向内合成，内层从外层结果里折射
      glc.draw(bandProg, A, { ...common, uBand: -1 });
      glc.draw(bandProg, B, { ...common, uBand: 3, uPrev: A });
      glc.draw(bandProg, A, { ...common, uBand: 2, uPrev: B });
      glc.draw(bandProg, B, { ...common, uBand: 1, uPrev: A });
      glc.draw(bandProg, A, { ...common, uBand: 0, uPrev: B });

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
