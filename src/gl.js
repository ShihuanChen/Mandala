// 最小 WebGL2 封装：全屏三角形、程序编译、离屏目标。
// 只服务于风格 A 的多趟合成，不做通用引擎。

const VS = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUv;
void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

export function createGL(canvas) {
  const gl = canvas.getContext('webgl2', {
    alpha: false, antialias: false, depth: false, stencil: false,
    preserveDrawingBuffer: true, powerPreference: 'high-performance',
  });
  if (!gl) return null;

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  return new GL(gl, vao);
}

class GL {
  constructor(gl, vao) {
    this.gl = gl;
    this.vao = vao;
    this.cache = new Map();
    this.targets = new Map();
    this.locs = new WeakMap();
  }

  program(fragSrc) {
    const gl = this.gl;
    if (this.cache.has(fragSrc)) return this.cache.get(fragSrc);

    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, VS);
    gl.compileShader(vs);
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fragSrc);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(fs));
    }

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog));
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    this.cache.set(fragSrc, prog);
    return prog;
  }

  // 离屏目标：RGBA8 + 线性过滤，尺寸变化时重建
  target(name, w, h) {
    const gl = this.gl;
    let t = this.targets.get(name);
    if (t && t.w === w && t.h === h) return t;
    if (t) {
      gl.deleteFramebuffer(t.fb);
      gl.deleteTexture(t.tex);
    }

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

    t = { fb, tex, w, h };
    this.targets.set(name, t);
    return t;
  }

  // u: { name: number | number[] | target }
  draw(prog, dst, u) {
    const gl = this.gl;
    gl.useProgram(prog);
    gl.bindVertexArray(this.vao);

    let unit = 0;
    let lm = this.locs.get(prog);
    if (!lm) { lm = new Map(); this.locs.set(prog, lm); }
    for (const k in u) {
      const v = u[k];
      let loc = lm.get(k);
      if (loc === undefined) {
        loc = gl.getUniformLocation(prog, k);
        lm.set(k, loc);
      }
      if (loc === null) continue;
      if (v && v.tex) {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, v.tex);
        gl.uniform1i(loc, unit);
        unit++;
      } else if (typeof v === 'number') {
        gl.uniform1f(loc, v);
      } else if (v.length === 2) {
        gl.uniform2f(loc, v[0], v[1]);
      } else if (v.length === 3) {
        gl.uniform3f(loc, v[0], v[1], v[2]);
      } else if (v.length === 4) {
        gl.uniform4f(loc, v[0], v[1], v[2], v[3]);
      }
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, dst ? dst.fb : null);
    gl.viewport(0, 0, dst ? dst.w : gl.drawingBufferWidth, dst ? dst.h : gl.drawingBufferHeight);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
