// Tiny WebGL 3D engine: math, shader, mesh builder, renderer. No external libraries.
(() => {
  "use strict";
  const BR3 = (window.BR3 = window.BR3 || {});

  // ---------------------------------------------------------------- math
  const M4 = {
    create() { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },
    perspective(o, fovy, aspect, near, far) {
      const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
      o.fill(0);
      o[0] = f / aspect; o[5] = f; o[10] = (far + near) * nf; o[11] = -1; o[14] = 2 * far * near * nf;
      return o;
    },
    lookAt(o, ex, ey, ez, tx, ty, tz) {
      let zx = ex - tx, zy = ey - ty, zz = ez - tz;
      let l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
      let xx = zz, xy = 0, xz = -zx; // up (0,1,0) x z
      l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
      const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
      o[0] = xx; o[1] = yx; o[2] = zx; o[3] = 0;
      o[4] = xy; o[5] = yy; o[6] = zy; o[7] = 0;
      o[8] = xz; o[9] = yz; o[10] = zz; o[11] = 0;
      o[12] = -(xx * ex + xy * ey + xz * ez);
      o[13] = -(yx * ex + yy * ey + yz * ez);
      o[14] = -(zx * ex + zy * ey + zz * ez);
      o[15] = 1;
      return o;
    },
    mul(o, a, b) {
      const r = M4._t;
      for (let c = 0; c < 4; c++) {
        const b0 = b[c * 4], b1 = b[c * 4 + 1], b2 = b[c * 4 + 2], b3 = b[c * 4 + 3];
        r[c * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
        r[c * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
        r[c * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
        r[c * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
      }
      o.set(r);
      return o;
    },
    // translation * Ry(yaw) * Rx(pitch) * Rz(roll) * scale
    trs(o, x, y, z, yaw = 0, pitch = 0, roll = 0, sx = 1, sy = 1, sz = 1) {
      const cy = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
      // R = Ry * Rx * Rz
      const r00 = cy * cr + syw * sp * sr, r01 = -cy * sr + syw * sp * cr, r02 = syw * cp;
      const r10 = cp * sr, r11 = cp * cr, r12 = -sp;
      const r20 = -syw * cr + cy * sp * sr, r21 = syw * sr + cy * sp * cr, r22 = cy * cp;
      o[0] = r00 * sx; o[1] = r10 * sx; o[2] = r20 * sx; o[3] = 0;
      o[4] = r01 * sy; o[5] = r11 * sy; o[6] = r21 * sy; o[7] = 0;
      o[8] = r02 * sz; o[9] = r12 * sz; o[10] = r22 * sz; o[11] = 0;
      o[12] = x; o[13] = y; o[14] = z; o[15] = 1;
      return o;
    },
    _t: new Float32Array(16),
  };
  BR3.M4 = M4;

  // ---------------------------------------------------------------- geometry builder
  // vertex layout: pos(3) normal(3) color(3) uv(2) = 11 floats
  class Geo {
    constructor() { this.v = []; }
    tri(a, b, c, n, col, ua = [0, 0], ub = [0, 0], uc = [0, 0]) {
      const v = this.v;
      v.push(a[0], a[1], a[2], n[0], n[1], n[2], col[0], col[1], col[2], ua[0], ua[1]);
      v.push(b[0], b[1], b[2], n[0], n[1], n[2], col[0], col[1], col[2], ub[0], ub[1]);
      v.push(c[0], c[1], c[2], n[0], n[1], n[2], col[0], col[1], col[2], uc[0], uc[1]);
    }
    // quad corners in counter-clockwise order (seen from the front)
    quad(a, b, c, d, col, n) {
      if (!n) n = faceNormal(a, b, c);
      this.tri(a, b, c, n, col, [0, 1], [1, 1], [1, 0]);
      this.tri(a, c, d, n, col, [0, 1], [1, 0], [0, 0]);
    }
    box(cx, cy, cz, w, h, d, col, opt = {}) {
      const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2, z0 = cz - d / 2, z1 = cz + d / 2;
      const top = opt.top || col, side = col, shade = c => [c[0] * 0.86, c[1] * 0.86, c[2] * 0.86];
      this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], top, [0, 1, 0]);               // top
      if (!opt.noBottom) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], shade(side), [0, -1, 0]);
      this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], side, [0, 0, 1]);               // front +z
      this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], side, [0, 0, -1]);              // back
      this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], shade(side), [1, 0, 0]);        // right
      this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], shade(side), [-1, 0, 0]);       // left
    }
    cone(cx, cy, cz, r, h, seg, col, colTop) {
      for (let i = 0; i < seg; i++) {
        const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
        const p0 = [cx + Math.cos(a0) * r, cy, cz + Math.sin(a0) * r];
        const p1 = [cx + Math.cos(a1) * r, cy, cz + Math.sin(a1) * r];
        const tip = [cx, cy + h, cz];
        this.tri(p0, tip, p1, faceNormal(p0, tip, p1), colTop || col);
        this.tri(p1, [cx, cy, cz], p0, [0, -1, 0], col);
      }
    }
    cyl(cx, cy, cz, r0, r1, h, seg, col, caps = true) {
      for (let i = 0; i < seg; i++) {
        const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
        const b0 = [cx + Math.cos(a0) * r0, cy, cz + Math.sin(a0) * r0];
        const b1 = [cx + Math.cos(a1) * r0, cy, cz + Math.sin(a1) * r0];
        const t0 = [cx + Math.cos(a0) * r1, cy + h, cz + Math.sin(a0) * r1];
        const t1 = [cx + Math.cos(a1) * r1, cy + h, cz + Math.sin(a1) * r1];
        const n = [Math.cos((a0 + a1) / 2), 0, Math.sin((a0 + a1) / 2)];
        this.tri(b0, t0, t1, n, col); this.tri(b0, t1, b1, n, col);
        if (caps) { this.tri([cx, cy + h, cz], t1, t0, [0, 1, 0], col); this.tri([cx, cy, cz], b0, b1, [0, -1, 0], col); }
      }
    }
    // low-poly boulder: box with jittered top corners
    rock(cx, cy, cz, s, col, rnd) {
      const j = () => (rnd() - 0.5) * s * 0.5;
      const w = s * (0.9 + rnd() * 0.5), d = s * (0.8 + rnd() * 0.5), h = s * (0.6 + rnd() * 0.5);
      const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, y0 = cy - 0.2, y1 = cy + h;
      const t = [[x0 + Math.abs(j()), y1 + j(), z1 - Math.abs(j())], [x1 - Math.abs(j()), y1 + j(), z1 - Math.abs(j())],
        [x1 - Math.abs(j()), y1 + j(), z0 + Math.abs(j())], [x0 + Math.abs(j()), y1 + j(), z0 + Math.abs(j())]];
      const b = [[x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0]];
      const dark = [col[0] * 0.8, col[1] * 0.8, col[2] * 0.8];
      this.quad(t[0], t[1], t[2], t[3], col);
      this.quad(b[0], b[1], t[1], t[0], dark);
      this.quad(b[1], b[2], t[2], t[1], col);
      this.quad(b[2], b[3], t[3], t[2], dark);
      this.quad(b[3], b[0], t[0], t[3], col);
      return { w, d, h };
    }
    // triangle with per-vertex normals / colors (smooth shading)
    triN(a, b, c, na, nb, nc, ca, cb, cc, ua = [0, 0], ub = [0, 0], uc = [0, 0]) {
      const v = this.v;
      v.push(a[0], a[1], a[2], na[0], na[1], na[2], ca[0], ca[1], ca[2], ua[0], ua[1]);
      v.push(b[0], b[1], b[2], nb[0], nb[1], nb[2], cb[0], cb[1], cb[2], ub[0], ub[1]);
      v.push(c[0], c[1], c[2], nc[0], nc[1], nc[2], cc[0], cc[1], cc[2], uc[0], uc[1]);
    }
    // surface of revolution around Y. prof = [[radius, y, normalRadial, normalY], ...] from top to bottom.
    // o.sx / o.sz squash the shape (ellipsoids), o.uv = front-projected UVs, o.colAt(t) = per-ring color
    lathe(cx, cy, cz, prof, seg, col, o = {}) {
      const sx = o.sx || 1, sz = o.sz || 1, n = prof.length;
      const P = (p, t) => [cx + p[0] * Math.cos(t) * sx, cy + p[1], cz + p[0] * Math.sin(t) * sz];
      const N = (p, t) => { const x = p[2] * Math.cos(t) / sx, y = p[3], z = p[2] * Math.sin(t) / sz, l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
      const U = (p, t, j) => (o.uv ? [0.5 + 0.5 * Math.cos(t) * Math.min(1, p[0] / (o.uvR || 1)), j / (n - 1)] : [0, 0]);
      for (let j = 0; j < n - 1; j++) {
        const p0 = prof[j], p1 = prof[j + 1];
        const c0 = o.colAt ? o.colAt(j / (n - 1)) : col, c1 = o.colAt ? o.colAt((j + 1) / (n - 1)) : col;
        for (let i = 0; i < seg; i++) {
          const t0 = (i / seg) * Math.PI * 2, t1 = ((i + 1) / seg) * Math.PI * 2;
          const A = P(p0, t0), B = P(p0, t1), C = P(p1, t1), D = P(p1, t0);
          const nA = N(p0, t0), nB = N(p0, t1), nC = N(p1, t1), nD = N(p1, t0);
          const uA = U(p0, t0, j), uB = U(p0, t1, j), uC = U(p1, t1, j + 1), uD = U(p1, t0, j + 1);
          this.triN(A, B, C, nA, nB, nC, c0, c0, c1, uA, uB, uC);
          this.triN(A, C, D, nA, nC, nD, c0, c1, c1, uA, uC, uD);
        }
      }
    }
    append(g) { for (let i = 0; i < g.v.length; i++) this.v.push(g.v[i]); }
    get count() { return this.v.length / 11; }
  }
  function faceNormal(a, b, c) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    return [nx / l, ny / l, nz / l];
  }
  BR3.Geo = Geo;
  BR3.hex = h => { const n = parseInt(h.replace("#", ""), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };

  // ---------------------------------------------------------------- renderer
  const VS = `
attribute vec3 aPos; attribute vec3 aNor; attribute vec3 aCol; attribute vec2 aUV;
uniform mat4 uVP; uniform mat4 uM;
varying vec3 vCol; varying vec3 vNor; varying vec2 vUV; varying vec3 vW;
void main(){
  vec4 w = uM * vec4(aPos, 1.0);
  vW = w.xyz; vNor = (uM * vec4(aNor, 0.0)).xyz; vCol = aCol; vUV = aUV;
  gl_Position = uVP * w;
}`;
  const FS = `
precision mediump float;
varying vec3 vCol; varying vec3 vNor; varying vec2 vUV; varying vec3 vW;
uniform vec3 uLight; uniform vec3 uFogCol; uniform vec2 uFog; uniform vec3 uCam;
uniform vec4 uTint; uniform float uUnlit; uniform sampler2D uTex; uniform float uTexMix; uniform vec3 uEmit;
uniform float uSpec; uniform float uRim; uniform float uNoFog;
void main(){
  vec3 base = vCol * uTint.rgb;
  if (uTexMix > 0.5) base = texture2D(uTex, vUV).rgb * uTint.rgb;
  vec3 c;
  if (uUnlit > 0.5) c = base + uEmit;
  else {
    vec3 n = normalize(vNor);
    vec3 v = normalize(uCam - vW);
    float d = max(dot(n, uLight), 0.0);
    // sky / ground hemisphere ambient + warm sun + soft specular + cool rim light
    vec3 amb = mix(vec3(0.40, 0.36, 0.31), vec3(0.50, 0.58, 0.70), n.y * 0.5 + 0.5);
    vec3 col = base * (amb + vec3(1.0, 0.94, 0.84) * d * 0.74);
    vec3 h = normalize(uLight + v);
    col += uSpec * pow(max(dot(n, h), 0.0), 28.0) * vec3(1.0, 0.95, 0.86);
    col += uRim * pow(1.0 - max(dot(n, v), 0.0), 3.0) * vec3(0.55, 0.66, 0.9);
    c = col + uEmit;
  }
  float f = uNoFog > 0.5 ? 0.0 : clamp((distance(vW, uCam) - uFog.x) / (uFog.y - uFog.x), 0.0, 1.0);
  gl_FragColor = vec4(mix(c, uFogCol, f), uTint.a);
}`;

  class Renderer {
    constructor(canvas) {
      const opts = { antialias: true, alpha: false, powerPreference: "high-performance", preserveDrawingBuffer: false };
      const gl = canvas.getContext("webgl", opts) || canvas.getContext("experimental-webgl", opts);
      if (!gl) throw new Error("WebGL is not available on this device/browser.");
      this.gl = gl;
      this.canvas = canvas;
      const sh = (type, src) => {
        const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      const p = gl.createProgram();
      gl.attachShader(p, sh(gl.VERTEX_SHADER, VS));
      gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      gl.useProgram(p);
      this.prog = p;
      this.a = {};
      for (const n of ["aPos", "aNor", "aCol", "aUV"]) { this.a[n] = gl.getAttribLocation(p, n); gl.enableVertexAttribArray(this.a[n]); }
      this.u = {};
      for (const n of ["uVP", "uM", "uLight", "uFogCol", "uFog", "uCam", "uTint", "uUnlit", "uTex", "uTexMix", "uEmit", "uSpec", "uRim", "uNoFog"]) this.u[n] = gl.getUniformLocation(p, n);
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.BACK);
      gl.uniform1i(this.u.uTex, 0);
      const l = [0.45, 0.8, 0.35], ll = Math.hypot(...l);
      gl.uniform3f(this.u.uLight, l[0] / ll, l[1] / ll, l[2] / ll);
      this.VP = M4.create();
      this.V = M4.create();
      this.P = M4.create();
      this.tmp = M4.create();
      this.ident = M4.create();
      this.bound = null;
      this.fog = [120, 240];
      this.fogCol = [0.62, 0.8, 0.95];
      // dynamic buffer for tracers / particles
      this.dynBuf = gl.createBuffer();
      this.dynData = new Float32Array(11 * 6 * 1200);
      this.dynCount = 0;
      this.whiteTex = this.texFromPixels(new Uint8Array([255, 255, 255, 255]), 1, 1);
    }
    mesh(geo, dynamic = false) {
      const gl = this.gl;
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geo.v), dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
      return { buf, count: geo.count };
    }
    texFromPixels(px, w, h) {
      const gl = this.gl, t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    }
    texFromImage(img) {
      const gl = this.gl, t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    }
    resize(w, h, pr) {
      const c = this.canvas;
      c.width = Math.max(1, Math.round(w * pr));
      c.height = Math.max(1, Math.round(h * pr));
      c.style.width = w + "px";
      c.style.height = h + "px";
      this.gl.viewport(0, 0, c.width, c.height);
      this.aspect = w / h;
    }
    begin(cam, fovy) {
      const gl = this.gl;
      M4.perspective(this.P, fovy, this.aspect, 0.1, this.fog[1] + 60);
      M4.lookAt(this.V, cam.x, cam.y, cam.z, cam.tx, cam.ty, cam.tz);
      M4.mul(this.VP, this.P, this.V);
      gl.clearColor(this.fogCol[0], this.fogCol[1], this.fogCol[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniformMatrix4fv(this.u.uVP, false, this.VP);
      gl.uniform3f(this.u.uCam, cam.x, cam.y, cam.z);
      gl.uniform3f(this.u.uFogCol, ...this.fogCol);
      gl.uniform2f(this.u.uFog, this.fog[0], this.fog[1]);
      gl.uniform3f(this.u.uEmit, 0, 0, 0);
      gl.uniform1f(this.u.uTexMix, 0);
      gl.uniform1f(this.u.uUnlit, 0);
      gl.uniform1f(this.u.uSpec, 0);
      gl.uniform1f(this.u.uRim, 0);
      gl.uniform1f(this.u.uNoFog, 0);
      this.cam = cam;
      this.bound = null;
    }
    // shiny / rim-lit material for characters (reset with material(0, 0))
    material(spec, rim) { this.gl.uniform1f(this.u.uSpec, spec); this.gl.uniform1f(this.u.uRim, rim); }
    // gradient sky dome that follows the camera
    drawSky(cam) {
      const gl = this.gl;
      if (!this.sky) {
        const g = new BR3.Geo(), top = [0.26, 0.5, 0.9], hor = this.fogCol.slice(), prof = [];
        const N = 12, a0 = Math.PI / 2, a1 = -0.4;
        for (let i = 0; i <= N; i++) { const a = a0 + (a1 - a0) * i / N; prof.push([Math.cos(a), Math.sin(a), Math.cos(a), Math.sin(a)]); }
        g.lathe(0, 0, 0, prof, 24, [1, 1, 1], { colAt: t => { const k = Math.min(1, t / 0.79), e = k * k * (3 - 2 * k); return [top[0] + (hor[0] - top[0]) * e, top[1] + (hor[1] - top[1]) * e, top[2] + (hor[2] - top[2]) * e]; } });
        this.sky = this.mesh(g);
      }
      const r = this.fog[1] + 20;
      M4.trs(this.tmp, cam.x, cam.y, cam.z, 0, 0, 0, r, r, r);
      gl.depthMask(false); gl.disable(gl.CULL_FACE);
      gl.uniform1f(this.u.uNoFog, 1);
      this.draw(this.sky, this.tmp, null, { unlit: true });
      gl.uniform1f(this.u.uNoFog, 0);
      gl.enable(gl.CULL_FACE); gl.depthMask(true);
    }
    bind(m) {
      if (this.bound === m.buf) return;
      const gl = this.gl, a = this.a, S = 44;
      gl.bindBuffer(gl.ARRAY_BUFFER, m.buf);
      gl.vertexAttribPointer(a.aPos, 3, gl.FLOAT, false, S, 0);
      gl.vertexAttribPointer(a.aNor, 3, gl.FLOAT, false, S, 12);
      gl.vertexAttribPointer(a.aCol, 3, gl.FLOAT, false, S, 24);
      gl.vertexAttribPointer(a.aUV, 2, gl.FLOAT, false, S, 36);
      this.bound = m.buf;
    }
    // draw a mesh with a model matrix; tint = [r,g,b,a]
    draw(m, model, tint, o) {
      const gl = this.gl, u = this.u;
      this.bind(m);
      gl.uniformMatrix4fv(u.uM, false, model || this.ident);
      const t = tint || WHITE;
      gl.uniform4f(u.uTint, t[0], t[1], t[2], t.length > 3 ? t[3] : 1);
      if (o) {
        if (o.tex) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, o.tex); gl.uniform1f(u.uTexMix, 1); }
        if (o.unlit) gl.uniform1f(u.uUnlit, 1);
        if (o.emit) gl.uniform3f(u.uEmit, o.emit[0], o.emit[1], o.emit[2]);
      }
      gl.drawArrays(gl.TRIANGLES, 0, m.count);
      if (o) {
        if (o.tex) gl.uniform1f(u.uTexMix, 0);
        if (o.unlit) gl.uniform1f(u.uUnlit, 0);
        if (o.emit) gl.uniform3f(u.uEmit, 0, 0, 0);
      }
    }
    // camera-facing quads for tracers / particles, flushed in one draw call
    dynQuad(ax, ay, az, bx, by, bz, width, col) {
      if (this.dynCount >= 1200) return;
      const c = this.cam;
      const dx = bx - ax, dy = by - ay, dz = bz - az;
      const mx = (ax + bx) / 2 - c.x, my = (ay + by) / 2 - c.y, mz = (az + bz) / 2 - c.z;
      let sx = dy * mz - dz * my, sy = dz * mx - dx * mz, sz = dx * my - dy * mx;
      const l = Math.hypot(sx, sy, sz) || 1;
      sx = (sx / l) * width; sy = (sy / l) * width; sz = (sz / l) * width;
      const d = this.dynData, o = this.dynCount * 66;
      const P = [[ax - sx, ay - sy, az - sz], [bx - sx, by - sy, bz - sz], [bx + sx, by + sy, bz + sz], [ax - sx, ay - sy, az - sz], [bx + sx, by + sy, bz + sz], [ax + sx, ay + sy, az + sz]];
      for (let i = 0; i < 6; i++) {
        const k = o + i * 11;
        d[k] = P[i][0]; d[k + 1] = P[i][1]; d[k + 2] = P[i][2];
        d[k + 3] = 0; d[k + 4] = 1; d[k + 5] = 0;
        d[k + 6] = col[0]; d[k + 7] = col[1]; d[k + 8] = col[2];
        d[k + 9] = 0; d[k + 10] = 0;
      }
      this.dynCount++;
    }
    // a billboard square (particle) of size s centred at p
    dynPoint(x, y, z, s, col) {
      const c = this.cam;
      // vertical billboard segment: from (y - s) to (y + s) widened toward camera-right
      this.dynQuad(x, y - s, z, x, y + s, z, s, col);
    }
    flushDyn() {
      if (!this.dynCount) return;
      const gl = this.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.dynBuf);
      gl.bufferData(gl.ARRAY_BUFFER, this.dynData.subarray(0, this.dynCount * 66), gl.DYNAMIC_DRAW);
      this.bound = null;
      this.bind({ buf: this.dynBuf });
      gl.uniformMatrix4fv(this.u.uM, false, this.ident);
      gl.uniform4f(this.u.uTint, 1, 1, 1, 1);
      gl.uniform1f(this.u.uUnlit, 1);
      gl.disable(gl.CULL_FACE);
      gl.drawArrays(gl.TRIANGLES, 0, this.dynCount * 6);
      gl.enable(gl.CULL_FACE);
      gl.uniform1f(this.u.uUnlit, 0);
      this.dynCount = 0;
      this.bound = null;
    }
    blend(on) {
      const gl = this.gl;
      if (on) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); }
      else { gl.disable(gl.BLEND); gl.depthMask(true); }
    }
    cull(on) { const gl = this.gl; if (on) gl.enable(gl.CULL_FACE); else gl.disable(gl.CULL_FACE); }
    // world -> screen (css pixels); returns null when behind camera
    project(x, y, z, w, h) {
      const m = this.VP;
      const cx = m[0] * x + m[4] * y + m[8] * z + m[12];
      const cy = m[1] * x + m[5] * y + m[9] * z + m[13];
      const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
      if (cw <= 0.05) return null;
      return { x: (cx / cw * 0.5 + 0.5) * w, y: (1 - (cy / cw * 0.5 + 0.5)) * h, d: cw };
    }
  }
  const WHITE = [1, 1, 1, 1];
  BR3.Renderer = Renderer;

  // seeded random
  BR3.rng = seed => {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
})();
