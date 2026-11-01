// Brainrot Royale rig: smooth-shaded skeletal characters with procedural animation
// (idle breathing, walk / run / sprint cycles, strafing + backpedal, crouch, jump, landing, skydive,
// parachute, knocked crawl, death fall, emotes, rifle aim with two-hand IK, recoil, reload, sprint carry).
(() => {
  "use strict";
  const BR3 = window.BR3;
  const { M4, Geo, hex } = BR3;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const wrapA = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
  const app = (cur, tgt, rate, dt) => cur + (tgt - cur) * Math.min(1, rate * dt);

  // ---------------- profiles for Geo.lathe
  function capsule(r0, r1, len, capN = 4) {
    const p = [];
    for (let i = 0; i <= capN; i++) { const a = (Math.PI / 2) * (1 - i / capN); p.push([r0 * Math.cos(a), r0 * Math.sin(a), Math.cos(a), Math.sin(a)]); }
    const l = Math.hypot(len, r1 - r0), nr = len / l, ny = (r1 - r0) / l;
    p.push([r0, 0, nr, ny]); p.push([r1, -len, nr, ny]);
    for (let i = 0; i <= capN; i++) { const a = (-Math.PI / 2) * (i / capN); p.push([r1 * Math.cos(a), -len + r1 * Math.sin(a), Math.cos(a), Math.sin(a)]); }
    return p;
  }
  function ellip(ry, N = 8, a0 = Math.PI / 2, a1 = -Math.PI / 2) {
    const p = [];
    for (let i = 0; i <= N; i++) { const a = a0 + (a1 - a0) * (i / N); p.push([Math.cos(a), ry * Math.sin(a), Math.cos(a), Math.sin(a) / ry]); }
    return p;
  }

  const VEST_COL = [null, hex("#6b7280"), hex("#2563eb"), hex("#7c3aed")];
  const HELM_COL = [null, hex("#556b2f"), hex("#1d4ed8"), hex("#6d28d9")];
  const DARK = hex("#141820"), SHOE = hex("#e5e7eb"), PACK = hex("#d97706"), EYEW = hex("#f8fafc"), LIP = hex("#9f3a3a");
  const GOLD = hex("#facc15"), NAVY = hex("#1e3a8a"), RED = hex("#b91c1c"), CYAN = hex("#22d3ee"), BERET = hex("#14532d");
  const GUNC = hex("#2b2f36"), MASK = hex("#1f2430");

  BR3.makeRig = function (R, flagTex) {
    const WH = [1, 1, 1];
    const mk = fn => { const g = new Geo(); fn(g); return R.mesh(g); };
    const E = (g, cx, cy, cz, rx, ry, rz, o = {}) => g.lathe(cx, cy, cz, ellip(ry, o.N || 8, o.a0, o.a1), o.seg || 12, o.col || WH, { sx: rx, sz: rz, uv: o.uv });
    const C = (g, cx, cy, cz, r0, r1, len, seg = 10) => g.lathe(cx, cy, cz, capsule(r0, r1, len), seg, WH);
    const UA = 0.3, FA = 0.27; // arm lengths
    const M = {
      thigh: mk(g => C(g, 0, 0, 0, 0.108, 0.084, 0.43)),
      shin: mk(g => C(g, 0, 0, 0, 0.082, 0.062, 0.42)),
      shoe: mk(g => { E(g, 0, -0.04, 0.05, 0.072, 0.05, 0.14); E(g, 0, -0.074, 0.05, 0.076, 0.016, 0.148, { col: [0.35, 0.35, 0.38] }); }),
      pelvis: mk(g => E(g, 0, 0, 0, 0.175, 0.12, 0.13)),
      belly: mk(g => E(g, 0, 0.12, 0, 0.165, 0.16, 0.118)),
      chest: mk(g => g.lathe(0, 0.07, 0, ellip(0.19, 10), 16, WH, { sx: 0.235, sz: 0.148, uv: true })),
      vest: mk(g => E(g, 0, 0.035, 0.004, 0.25, 0.175, 0.168, { seg: 14 })),
      pack: mk(g => { E(g, 0, 0, 0, 0.16, 0.19, 0.085); E(g, 0, 0.18, 0.01, 0.14, 0.05, 0.075); E(g, 0, -0.05, -0.065, 0.1, 0.07, 0.03, { col: [0.75, 0.75, 0.75] }); }),
      neck: mk(g => E(g, 0, 0.05, 0, 0.06, 0.08, 0.062)),
      head: mk(g => E(g, 0, 0, 0, 0.112, 0.128, 0.118, { seg: 18, N: 10 })),
      ear: mk(g => E(g, 0, 0, 0, 0.016, 0.026, 0.018, { seg: 6, N: 4 })),
      eyeW: mk(g => E(g, 0, 0, 0, 0.021, 0.015, 0.012, { seg: 8, N: 4 })),
      pupil: mk(g => E(g, 0, 0, 0, 0.011, 0.011, 0.006, { seg: 6, N: 4 })),
      brow: mk(g => E(g, 0, 0, 0, 0.026, 0.0065, 0.009, { seg: 6, N: 3 })),
      nose: mk(g => E(g, 0, 0, 0, 0.015, 0.024, 0.02, { seg: 6, N: 4 })),
      mouth: mk(g => E(g, 0, 0, 0, 0.027, 0.0075, 0.008, { seg: 8, N: 3 })),
      upper: mk(g => C(g, 0, 0, 0, 0.07, 0.057, UA)),
      fore: mk(g => C(g, 0, 0, 0, 0.057, 0.045, FA)),
      hand: mk(g => E(g, 0, -0.05, 0.005, 0.045, 0.058, 0.032, { seg: 8, N: 5 })),
      hair: [0, 1, 2].map(st => mk(g => {
        E(g, 0, 0.028, -0.006, 0.12, 0.108, 0.126, { a1: 0.1, seg: 16 });
        E(g, 0, -0.01, -0.045, 0.113, 0.1, 0.086);
        if (st === 1) { for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; g.cone(Math.cos(a) * 0.06, 0.095, Math.sin(a) * 0.06 - 0.01, 0.045, 0.085, 5, WH); } g.cone(0, 0.11, 0.01, 0.05, 0.1, 5, WH); }
        if (st === 2) { E(g, 0, -0.09, -0.06, 0.116, 0.165, 0.07); E(g, 0.085, -0.04, 0.02, 0.03, 0.09, 0.05); E(g, -0.085, -0.04, 0.02, 0.03, 0.09, 0.05); }
      })),
      cap: mk(g => { E(g, 0, 0.035, 0, 0.123, 0.1, 0.13, { a1: 0.05, seg: 16 }); E(g, 0, 0.04, 0.1, 0.105, 0.012, 0.085); }),
      beret: mk(g => E(g, 0.02, 0.1, -0.01, 0.14, 0.035, 0.135, { seg: 14 })),
      hood: mk(g => E(g, 0, 0, -0.045, 0.15, 0.158, 0.15, { a1: -0.8, seg: 16 })),
      crown: mk(g => { g.cyl(0, 0.08, 0, 0.1, 0.108, 0.065, 14, WH, false); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.cone(Math.cos(a) * 0.1, 0.14, Math.sin(a) * 0.1, 0.022, 0.06, 4, WH); } }),
      band: mk(g => g.cyl(0, 0.025, 0, 0.122, 0.122, 0.038, 16, WH, false)),
      visor: mk(g => E(g, 0, 0.018, 0.06, 0.118, 0.032, 0.07, { seg: 14 })),
      mask: mk(g => E(g, 0, -0.052, 0.05, 0.104, 0.062, 0.08, { seg: 14 })),
      helmet: mk(g => { E(g, 0, 0.035, 0, 0.134, 0.122, 0.14, { a1: -0.05, seg: 16 }); E(g, 0, 0.03, 0.005, 0.142, 0.012, 0.148, { seg: 16 }); }),
      disc: mk(g => { for (let i = 0; i < 18; i++) { const a0 = (i / 18) * Math.PI * 2, a1 = ((i + 1) / 18) * Math.PI * 2; g.tri([0, 0, 0], [Math.cos(a0), 0, Math.sin(a0)], [Math.cos(a1), 0, Math.sin(a1)], [0, 1, 0], WH); } }),
    };
    // weapons (light parts get the skin tint, dark parts stay dark)
    function gun(len, o) {
      return mk(g => {
        const D = [0.2, 0.2, 0.22], Lt = [0.9, 0.9, 0.9];
        g.box(0, 0, len * 0.35, 0.062, 0.095, len * 0.55, Lt);
        g.box(0, 0.012, len * 0.8, 0.03, 0.03, len * 0.42, D);
        g.box(0, -0.075, 0, 0.04, 0.11, 0.05, D);
        if (o.mag) g.box(0, -0.1, len * 0.3, 0.048, 0.14, 0.07, D);
        if (o.stock) g.box(0, -0.012, -0.15, 0.052, 0.088, 0.24, Lt);
        if (o.scope) { g.box(0, 0.085, len * 0.35, 0.045, 0.045, 0.27, D); g.box(0, 0.05, len * 0.35, 0.02, 0.04, 0.03, D); }
        if (o.pump) g.box(0, -0.04, len * 0.55, 0.058, 0.05, 0.16, D);
        if (o.sight) g.box(0, 0.065, len * 0.3, 0.02, 0.035, 0.05, D);
      });
    }
    const rifle = { m: gun(0.62, { mag: 1, stock: 1, sight: 1 }), tip: 0.66, lh: [0, -0.052, 0.27] };
    const GUNS = {
      pistol: { m: gun(0.2, {}), tip: 0.2, lh: [0.012, -0.085, 0.03] },
      smg: { m: gun(0.4, { mag: 1, stock: 1, sight: 1 }), tip: 0.42, lh: [0, -0.05, 0.2] },
      shotgun: { m: gun(0.7, { stock: 1, pump: 1 }), tip: 0.72, lh: [0, -0.06, 0.38] },
      ar: rifle, m4: rifle, golden: rifle,
      dmr: { m: gun(0.78, { mag: 1, stock: 1, scope: 1 }), tip: 0.82, lh: [0, -0.052, 0.3] },
      sniper: { m: gun(0.88, { mag: 1, stock: 1, scope: 1 }), tip: 0.92, lh: [0, -0.052, 0.32] },
    };

    // ---------------- matrix helpers
    const pool = [];
    let pi = 0;
    const mat = () => { if (pi >= pool.length) pool.push(M4.create()); return pool[pi++]; };
    const TMP = M4.create();
    function bone(parent, tx, ty, tz, rx = 0, ry = 0, rz = 0) { M4.trs(TMP, tx, ty, tz, ry, rx, rz); const o = mat(); M4.mul(o, parent, TMP); return o; }
    const xf = (m, x, y, z) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
    // place a limb mesh (which extends along -y) from A toward B, uniformly scaled by s
    function seg(A, B, ref, s) {
      const o = mat();
      const dx = B[0] - A[0], dy = B[1] - A[1], dz = B[2] - A[2], l = Math.hypot(dx, dy, dz) || 1e-4;
      const Yx = -dx / l, Yy = -dy / l, Yz = -dz / l;
      let rx = ref[0], ry = ref[1], rz = ref[2];
      if (Math.abs(Yx * rx + Yy * ry + Yz * rz) > 0.92) { rx = 0; ry = 1; rz = 0; }
      let Xx = Yy * rz - Yz * ry, Xy = Yz * rx - Yx * rz, Xz = Yx * ry - Yy * rx;
      const xl = Math.hypot(Xx, Xy, Xz) || 1; Xx /= xl; Xy /= xl; Xz /= xl;
      const Zx = Xy * Yz - Xz * Yy, Zy = Xz * Yx - Xx * Yz, Zz = Xx * Yy - Xy * Yx;
      o[0] = Xx * s; o[1] = Xy * s; o[2] = Xz * s; o[3] = 0;
      o[4] = Yx * s; o[5] = Yy * s; o[6] = Yz * s; o[7] = 0;
      o[8] = Zx * s; o[9] = Zy * s; o[10] = Zz * s; o[11] = 0;
      o[12] = A[0]; o[13] = A[1]; o[14] = A[2]; o[15] = 1;
      return o;
    }
    // analytic two-bone IK: returns [elbow, hand]
    function ik(S, T, L1, L2, pole) {
      const dx = T[0] - S[0], dy = T[1] - S[1], dz = T[2] - S[2], d = Math.hypot(dx, dy, dz) || 1e-4;
      const dd = Math.min(d, (L1 + L2) * 0.999), ux = dx / d, uy = dy / d, uz = dz / d;
      const ca = clamp((L1 * L1 + dd * dd - L2 * L2) / (2 * L1 * dd), -1, 1), sa = Math.sqrt(1 - ca * ca);
      let px = pole[0], py = pole[1], pz = pole[2];
      const k = px * ux + py * uy + pz * uz; px -= ux * k; py -= uy * k; pz -= uz * k;
      const pl = Math.hypot(px, py, pz) || 1; px /= pl; py /= pl; pz /= pl;
      return [[S[0] + (ux * ca + px * sa) * L1, S[1] + (uy * ca + py * sa) * L1, S[2] + (uz * ca + pz * sa) * L1], [S[0] + ux * dd, S[1] + uy * dd, S[2] + uz * dd]];
    }

    // ---------------- draw helper with tint / hit flash / texture
    const T4 = [1, 1, 1, 1];
    let tm = 1, hitE = null;
    function D(m, mx, col, ex) {
      T4[0] = col[0] * tm; T4[1] = col[1] * tm; T4[2] = col[2] * tm; T4[3] = 1;
      const e = (ex && ex.emit) || hitE, t = ex && ex.tex;
      R.draw(m, mx, T4, e || t ? { emit: e || null, tex: t || null } : null);
    }

    // ---------------- animation state
    function anim(c) {
      const now = performance.now() / 1000;
      let a = c._anim;
      if (!a) a = c._anim = { last: now, t: Math.random() * 20, ph: Math.random() * 6, hipYaw: 0, walk: 0, run: 0, crouch: 0, airB: 0, air: 0, land: 0, grounded: true, kick: 0, prevCd: 0, shotT: 9, port: 0, rel: 0, relPh: 0, turn: 0, prevYaw: c.yaw, blink: 2 + Math.random() * 3, blinkT: 0, dt: 0 };
      const dt = clamp(now - a.last, 0, 0.1);
      a.last = now; a.t += dt; a.dt = dt;
      const vx = c.vx || 0, vz = c.vz || 0, sp = Math.hypot(vx, vz) * (c.knocked ? 2.6 : 1);
      const cy = Math.cos(c.yaw), sy = Math.sin(c.yaw), lx = vx * cy - vz * sy, lz = vx * sy + vz * cy;
      const grounded = c.phase === "ground" && c.onGround !== false;
      a.walk = app(a.walk, clamp(sp / 1.6, 0, 1), 9, dt);
      a.run = app(a.run, clamp((sp - 3.6) / 2.4, 0, 1), 6, dt);
      let dir = 1, hy = 0;
      if (sp > 0.4 && !c.knocked) {
        const ang = Math.atan2(lx, lz);
        if (Math.abs(ang) < 1.95) hy = clamp(ang, -0.8, 0.8); else { dir = -1; hy = clamp(wrapA(ang - Math.PI), -0.8, 0.8); }
      }
      a.hipYaw = app(a.hipYaw, hy, 8, dt);
      const stride = lerp(1.25, 2.3, a.run);
      if (sp > 0.12) a.ph += dir * 2 * Math.PI * (sp / stride) * dt;
      a.crouch = app(a.crouch, c.crouch && !c.knocked ? 1 : 0, 10, dt);
      if (c.phase === "ground" && !grounded) a.air += dt;
      if (grounded && !a.grounded && a.air > 0.3) a.land = 1;
      if (grounded) a.air = 0;
      a.airB = app(a.airB, c.phase === "ground" && !grounded && a.air > 0.12 ? 1 : 0, 10, dt);
      a.land = Math.max(0, a.land - dt * 3.2);
      a.grounded = grounded;
      const cd = c.fireCd || 0;
      if (cd > a.prevCd + 0.004) { a.kick = 1; a.shotT = 0; }
      a.prevCd = cd; a.kick = Math.max(0, a.kick - dt * 11); a.shotT += dt;
      a.rel = app(a.rel, c.reloadT > 0 ? 1 : 0, 8, dt);
      if (c.reloadT > 0) a.relPh += dt * 4;
      const yr = wrapA(c.yaw - a.prevYaw) / Math.max(dt, 1e-3);
      a.prevYaw = c.yaw;
      a.turn = app(a.turn, clamp(-yr * 0.04, -0.2, 0.2) * a.run, 6, dt);
      a.blink -= dt;
      if (a.blink < 0) { a.blinkT = 0.12; a.blink = 2 + Math.random() * 4; }
      a.blinkT = Math.max(0, a.blinkT - dt);
      return a;
    }

    const SH4 = [0, 0, 0, 0.36], SM = M4.create();

    function draw(c, dist) {
      pi = 0;
      const a = anim(c), dt = a.dt;
      const L = c.look, s = L.big ? 1.08 : 1, far = dist > 40, vfar = dist > 100;
      tm = c.dead ? 0.62 : 1;
      hitE = c.hitT > 0 && !c.dead ? [Math.min(1, c.hitT * 4) * 0.55, 0.02, 0.02] : null;
      const now = a.t, Wk = a.walk, Rn = a.run, ph = a.ph;

      // -------------------------------------------------------------- pose
      let lift = 0, pivot = 0, lean = 0, roll = 0;
      let pelY = 0.93, pelP = 0, pelR = 0, hipYaw = a.hipYaw, spLean = 0, twist = 0, chP = 0, aimTw = 0, hdP = 0, hdY = 0;
      const LG = [{ sw: 0, ab: 0.05, kn: 0.06, an: null }, { sw: 0, ab: 0.05, kn: 0.06, an: null }];
      const AR = [{ sw: 0.05, ab: 0.12, el: 0.2 }, { sw: 0.05, ab: 0.12, el: 0.2 }];
      const em = c.emote && !c.dead && !c.knocked ? c.emote : null;
      const wpn = c.weapon && !c.dead && !c.knocked && !em && c.phase === "ground" ? c.weapon : null;

      if (c.dead) {
        const k = Math.min(1, (c.deadT || 0) * 2.4);
        lean = -1.48 * k; pivot = 0.93; lift = lerp(0.93, 0.16, k); hipYaw = 0;
        AR.forEach(A => { A.ab = 0.25 + 0.75 * k; A.el = 0.3; A.sw = 0.2; });
        LG.forEach(G => { G.ab = 0.12; G.kn = 0.2 * k; G.an = 0.2; });
      } else if (c.knocked) {
        lean = 1.4; pivot = 0.93; lift = 0.22; hipYaw = 0;
        AR.forEach((A, i) => { const q = ph + (i ? Math.PI : 0); A.sw = 2.45 + Math.sin(q) * 0.5 * Wk; A.ab = 0.35; A.el = 0.5 + Math.max(0, Math.cos(q)) * 0.9 * Wk; });
        LG.forEach((G, i) => { const q = ph + (i ? 0 : Math.PI); G.sw = -0.1; G.ab = 0.12; G.kn = 0.25 + Math.max(0, Math.sin(q)) * 0.9 * Wk; G.an = 0.4; });
        hdP = -0.95;
      } else if (c.phase === "fall" && !c.para) {
        // skydive: flat, arms and legs spread
        lean = 1.25; pivot = 0.93; lift = 0.93; hipYaw = 0;
        const fl = Math.sin(now * 9) * 0.05;
        AR.forEach(A => { A.ab = 1.25 + fl; A.sw = 0.55; A.el = 1.05; });
        LG.forEach(G => { G.ab = 0.25 - fl; G.sw = -0.25; G.kn = 0.85; G.an = 0.3; });
        hdP = -1.0;
      } else if (c.para) {
        AR.forEach(A => { A.sw = 2.75; A.ab = 0.42; A.el = 0.45; });
        LG.forEach((G, i) => { G.sw = Math.sin(now * 1.7 + i * 2) * 0.16 + 0.12; G.kn = 0.32 + Math.sin(now * 1.7 + i) * 0.1; G.ab = 0.06; });
        hdP = 0.25;
      } else {
        // ---- locomotion
        for (let i = 0; i < 2; i++) {
          const p = ph + (i ? Math.PI : 0), amp = lerp(0.3, 0.8, Rn) * Wk * (1 - a.crouch * 0.45);
          LG[i].sw = Math.sin(p) * amp + 0.1 * Rn * Wk;
          LG[i].kn = 0.05 + Wk * lerp(0.35, 1.3, Rn) * Math.pow(Math.max(0, Math.cos(p)), 1.4) + 0.1 * Wk;
          AR[i].sw = -Math.sin(p) * lerp(0.3, 1.0, Rn) * Wk + 0.12 * Rn;
          AR[i].el = 0.2 + lerp(0.15, 1.35, Rn) * Wk;
          AR[i].ab = 0.1;
        }
        const bob = (0.012 + 0.045 * Rn) * Wk * Math.cos(2 * ph);
        pelY = 0.93 - 0.03 * Rn * Wk + bob;
        pelR = Math.sin(ph) * 0.045 * Wk + Math.sin(now * 0.6) * 0.02 * (1 - Wk);
        spLean = lerp(0.03, 0.24, Rn) * Wk;
        twist = -Math.sin(ph) * 0.16 * Wk;
        chP = Math.sin(now * 1.7) * 0.018 * (1 - Wk);
        roll = a.turn;
        const cr = a.crouch;
        if (cr > 0.01) { pelY -= 0.3 * cr; LG.forEach(G => { G.sw += 0.95 * cr; G.kn += 1.7 * cr; }); spLean += 0.3 * cr; }
        const ai = a.airB;
        if (ai > 0.01) {
          LG[0].sw = lerp(LG[0].sw, 0.75, ai); LG[0].kn = lerp(LG[0].kn, 1.15, ai);
          LG[1].sw = lerp(LG[1].sw, -0.05, ai); LG[1].kn = lerp(LG[1].kn, 0.6, ai);
          AR.forEach(A => { A.ab = lerp(A.ab, 0.55, ai); A.sw = lerp(A.sw, 0.35, ai); });
        }
        if (a.land > 0) { const k = a.land; pelY -= 0.14 * k; LG.forEach(G => { G.sw += 0.4 * k; G.kn += 0.8 * k; }); spLean += 0.18 * k; }
      }
      if (em) {
        const t = em.t || 0;
        if (em.type === "wave") Object.assign(AR[0], { sw: 2.6, ab: 0.35, el: 0.55 + Math.sin(t * 11) * 0.45 });
        else if (em.type === "victory") { AR.forEach(A => Object.assign(A, { sw: 2.95 + Math.sin(t * 7) * 0.15, ab: 0.3, el: 0.25 })); pelY += Math.abs(Math.sin(t * 7)) * 0.05; }
        else if (em.type === "salute") Object.assign(AR[0], { sw: 1.25, ab: 1.15, el: 2.3 });
        else {
          pelR = Math.sin(t * 6) * 0.14; twist = Math.sin(t * 3) * 0.45;
          Object.assign(AR[0], { sw: 1 + Math.sin(t * 6) * 0.9, ab: 0.5, el: 1.3 });
          Object.assign(AR[1], { sw: 1 - Math.sin(t * 6) * 0.9, ab: 0.5, el: 1.3 });
          LG.forEach((G, i) => { G.kn = 0.15 + Math.max(0, Math.sin(t * 6 + i * Math.PI)) * 0.6; G.sw = G.kn * 0.45; G.an = null; });
          pelY -= 0.05;
        }
      }
      const own = BR3.X && BR3.X.G && BR3.X.G.player === c;
      const ads = own && BR3.X.G.ads;
      if (wpn) {
        const port = Rn > 0.55 && a.shotT > 0.6 && !ads;
        a.port = app(a.port, port ? 1 : 0, 8, dt);
        aimTw = 0.3 * (1 - a.port); hdY = -0.3 * (1 - a.port);
        twist *= lerp(0.25, 1, a.port);
        chP += -clamp(c.pitch || 0, -0.9, 0.9) * 0.2 * (1 - a.port);
      }
      if (!c.dead && !c.knocked && !(c.phase === "fall" && !c.para)) hdP += -clamp(c.pitch || 0, -0.8, 0.8) * 0.55 - spLean * 0.7;

      // -------------------------------------------------------------- skeleton
      const root = mat();
      M4.trs(root, c.x, c.y + lift, c.z, c.yaw, lean, roll, s, s, s);
      const rt = pivot ? bone(root, 0, -pivot, 0) : root;
      const pel = bone(rt, 0, pelY, 0, pelP, hipYaw, pelR);
      const spn = bone(pel, 0, 0.06, 0, spLean, -hipYaw * 0.85 + twist * 0.5, -pelR * 0.7);
      const ch = bone(spn, 0, 0.24, 0, chP, twist * 0.5 + aimTw, 0);
      const nk = bone(ch, 0, 0.215, 0, hdP * 0.35, hdY * 0.35, 0);
      const hd = bone(nk, 0, 0.13, 0, hdP * 0.65, hdY * 0.65, 0);
      for (let i = 0; i < 11; i++) if (i % 4 !== 3) hd[i] *= 1.12; // stylized, slightly bigger head

      // -------------------------------------------------------------- colors
      const tex = !L.shirt ? flagTex(c.code) : null;
      const shirtCol = tex ? [1, 1, 1] : (L.shirt || c.color);
      const shirtOpt = tex ? { tex } : L.glow ? { emit: [L.glow[0] * 0.3, L.glow[1] * 0.3, L.glow[2] * 0.3] } : null;
      const sleeveCol = shirtCol, sleeveOpt = tex ? { tex } : null;
      const longSl = !L.shirt || L.longSleeve;
      const foreCol = longSl ? shirtCol : L.skin, foreOpt = longSl ? sleeveOpt : null;
      const handCol = L.gloves ? DARK : L.skin;

      R.material(0.28, 0.38);
      // legs
      for (let i = 0; i < 2; i++) {
        const side = i ? 1 : -1, G = LG[i];
        const th = bone(pel, side * 0.105, -0.04, 0, -G.sw, 0, side * G.ab);
        D(M.thigh, th, L.pants);
        const sh = bone(th, 0, -0.43, 0, G.kn);
        D(M.shin, sh, L.pants);
        if (!vfar) D(M.shoe, bone(sh, 0, -0.42, 0, G.an == null ? G.sw - G.kn : G.an), SHOE);
      }
      D(M.pelvis, pel, L.pants);
      D(M.belly, spn, shirtCol, shirtOpt);
      D(M.chest, ch, shirtCol, shirtOpt);
      if (c.vest) D(M.vest, ch, VEST_COL[c.vest]);
      if (!far) D(M.pack, bone(ch, 0, 0.05, -0.2), PACK);
      if (!vfar) D(M.neck, nk, L.skin);
      D(M.head, hd, L.skin);
      // face
      if (!far) {
        for (const side of [-1, 1]) {
          D(M.ear, bone(hd, side * 0.11, 0, -0.005), L.skin);
          if (a.blinkT <= 0) { D(M.eyeW, bone(hd, side * 0.042, 0.018, 0.1), EYEW); D(M.pupil, bone(hd, side * 0.042, 0.017, 0.111), DARK); }
          D(M.brow, bone(hd, side * 0.044, 0.05, 0.098, 0, 0, side * -0.12), L.hair);
        }
        D(M.nose, bone(hd, 0, -0.008, 0.11), L.skin);
        if (!L.mask) D(M.mouth, bone(hd, 0, -0.06, 0.098), LIP);
      }
      if (L.mask) D(M.mask, hd, L.hat === "bandana" ? RED : MASK);
      // hair / headwear
      if (c.helmet) D(M.helmet, hd, HELM_COL[c.helmet]);
      else if (L.hat === "hood") D(M.hood, hd, L.shirt || c.color);
      else {
        D(M.hair[L.hairStyle || 0], hd, L.hair);
        if (L.hat === "cap") D(M.cap, hd, L.shirt || RED);
        else if (L.hat === "beret") D(M.beret, hd, BERET);
        else if (L.hat === "crown") D(M.crown, hd, GOLD, { emit: [0.3, 0.22, 0] });
        else if (L.hat === "ninja") D(M.band, hd, NAVY);
        else if (L.hat === "bandana") D(M.band, hd, RED);
        else if (L.hat === "visor") D(M.visor, hd, CYAN, { emit: [0.1, 0.7, 0.8] });
      }
      // arms (+ weapon)
      const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), cyw = Math.cos(c.yaw), syw = Math.sin(c.yaw);
      const FWD = [fx, 0, fz];
      const rotY = v => [v[0] * cyw + v[2] * syw, v[1], -v[0] * syw + v[2] * cyw];
      if (wpn) {
        const GI = GUNS[wpn] || rifle;
        const pitch = clamp(c.pitch || 0, -1, 1), k = a.kick, port = a.port, rel = a.rel;
        const anc = xf(ch, lerp(-0.09, -0.02, port), lerp(0.08, -0.02, port), lerp(0.24, 0.26, port));
        const gunM = mat();
        M4.trs(gunM, anc[0] - fx * k * 0.05 * s, anc[1], anc[2] - fz * k * 0.05 * s, c.yaw + port * 0.85, lerp(-pitch, 0.6, port) - k * 0.12 + rel * 0.45, rel * 0.6, s, s, s);
        D(GI.m, gunM, c.gunColor || GUNC, c.gunGlow ? { emit: c.gunGlow } : null);
        c._mz = xf(gunM, 0, 0.012, GI.tip + 0.04); c._mzT = performance.now() / 1000;
        const rh = xf(gunM, 0, -0.075, 0);
        let lh = xf(gunM, GI.lh[0], GI.lh[1], GI.lh[2]);
        if (rel > 0.05) { const mg = xf(gunM, 0, -0.16 - Math.abs(Math.sin(a.relPh)) * 0.1, 0.12); lh = [lerp(lh[0], mg[0], rel), lerp(lh[1], mg[1], rel), lerp(lh[2], mg[2], rel)]; }
        for (const [side, T] of [[-1, rh], [1, lh]]) {
          const S = xf(ch, side * 0.225, 0.14, 0);
          const [El, H] = ik(S, T, UA * s, FA * s, rotY([side * 0.7, -1, -0.35]));
          D(M.upper, seg(S, El, FWD, s), sleeveCol, sleeveOpt);
          D(M.fore, seg(El, H, FWD, s), foreCol, foreOpt);
          if (!far) D(M.hand, seg(H, [2 * H[0] - El[0], 2 * H[1] - El[1], 2 * H[2] - El[2]], FWD, s), handCol);
        }
      } else {
        for (let i = 0; i < 2; i++) {
          const side = i ? 1 : -1, A = AR[i];
          const up = bone(ch, side * 0.225, 0.14, 0, -A.sw, 0, side * (A.ab + 0.06));
          D(M.upper, up, sleeveCol, sleeveOpt);
          const fo = bone(up, 0, -UA, 0, -A.el);
          D(M.fore, fo, foreCol, foreOpt);
          if (!far) D(M.hand, bone(fo, 0, -FA, 0), handCol);
        }
      }
      R.material(0, 0);

      // -------------------------------------------------------------- blob shadow
      const W = BR3.X && BR3.X.WORLD;
      const gy = W ? W.groundAt(c.x, c.z, c.y + 0.3) : c.y, hgt = Math.max(0, c.y - gy);
      if (hgt < 14 && !vfar) {
        const lying = c.dead || c.knocked, r = (lying ? 0.55 : 0.4) * s * (1 - Math.min(0.7, hgt / 10));
        M4.trs(SM, c.x + (c.knocked ? fx * 0.45 : c.dead ? -fx * 0.45 : 0), gy + 0.035, c.z + (c.knocked ? fz * 0.45 : c.dead ? -fz * 0.45 : 0), c.yaw, 0, 0, r, 1, lying ? r * 2 : r);
        R.blend(true); R.cull(false);
        R.draw(M.disc, SM, SH4, { unlit: true });
        R.cull(true); R.blend(false);
      }
    }
    // ---------------- smooth pets (scaled unit sphere + leg capsule)
    const SPH = mk(g => E(g, 0, 0, 0, 1, 1, 1, { seg: 14, N: 8 }));
    const LEG = mk(g => C(g, 0, 0, 0, 0.045, 0.04, 0.16, 8));
    const PCOL = {
      panda: { body: hex("#f8fafc"), dark: hex("#16181d") }, dog: { body: hex("#c58b45"), dark: hex("#6b4423") },
      fox: { body: hex("#ea6a1a"), dark: hex("#fff7ed") }, owl: { body: hex("#8b5a2b"), dark: hex("#fde68a") },
      penguin: { body: hex("#1f2430"), dark: hex("#f8fafc") }, robo: { body: hex("#b8c2d0"), dark: hex("#22d3ee") },
    };
    function blob(root, x, y, z, rx, ry, rz, col, e, rot = 0) { M4.trs(TMP, x, y, z, 0, rot, 0, rx, ry, rz); const o = mat(); M4.mul(o, root, TMP); R.draw(SPH, o, [col[0], col[1], col[2], 1], e ? { emit: e } : null); }
    function drawPet(kind, x, y, z, yaw, t, moving) {
      const C0 = PCOL[kind];
      if (!C0) return;
      pi = 0;
      const B = C0.body, Dk = C0.dark, EYE = hex("#0b0d12");
      const hover = kind === "owl" || kind === "robo";
      const bob = hover ? 0.7 + Math.sin(t * 3) * 0.08 : Math.abs(Math.sin(t * 9)) * 0.05 * moving;
      const root = mat();
      M4.trs(root, x, y + bob, z, yaw, 0, 0, 1, 1, 1);
      R.material(0.3, 0.35);
      if (kind === "panda" || kind === "dog" || kind === "fox") {
        const sw = Math.sin(t * 11) * 0.55 * moving;
        for (const [lx, lz, ph] of [[0.11, 0.15, 0], [-0.11, 0.15, Math.PI], [0.11, -0.15, Math.PI], [-0.11, -0.15, 0]]) {
          const lb = bone(root, lx, 0.2, lz, -Math.sin(ph) * sw - Math.cos(ph) * sw * 0);
          M4.trs(TMP, 0, 0, 0, 0, Math.sin(t * 11 + ph) * 0.55 * moving, 0); const o = mat(); M4.mul(o, lb, TMP);
          R.draw(LEG, o, [...(kind === "panda" ? Dk : kind === "fox" ? EYE : B), 1]);
        }
        blob(root, 0, 0.3, 0, 0.19, 0.16, 0.27, B);
        if (kind === "panda") blob(root, 0, 0.34, -0.02, 0.2, 0.09, 0.14, Dk);
        if (kind === "fox") { blob(root, 0, 0.36, -0.36, 0.08, 0.08, 0.18, B, null, -0.6 + Math.sin(t * 6) * 0.2); blob(root, 0, 0.4, -0.5, 0.06, 0.06, 0.07, Dk); blob(root, 0, 0.24, 0.12, 0.13, 0.08, 0.13, Dk); }
        if (kind === "dog") blob(root, 0, 0.42, -0.3, 0.035, 0.035, 0.12, B, null, -0.8 + Math.sin(t * 14) * 0.4);
        const hy = 0.5, hz = 0.27;
        blob(root, 0, hy, hz, 0.15, 0.14, 0.14, B);
        blob(root, 0, hy - 0.04, hz + 0.12, 0.07, 0.055, 0.07, kind === "panda" ? B : kind === "fox" ? Dk : hex("#e0b27a"));
        blob(root, 0, hy - 0.02, hz + 0.19, 0.022, 0.018, 0.015, EYE);
        for (const sd of [-1, 1]) {
          if (kind === "panda") { blob(root, sd * 0.11, hy + 0.12, hz - 0.02, 0.05, 0.05, 0.03, Dk); blob(root, sd * 0.055, hy + 0.02, hz + 0.115, 0.035, 0.045, 0.02, Dk); }
          else if (kind === "fox") blob(root, sd * 0.08, hy + 0.15, hz, 0.035, 0.08, 0.02, B, null, sd * 0.25);
          else blob(root, sd * 0.13, hy + 0.02, hz - 0.01, 0.03, 0.08, 0.05, Dk, null, sd * 0.3);
          blob(root, sd * 0.055, hy + 0.025, hz + 0.125, 0.018, 0.02, 0.012, EYE);
        }
      } else if (kind === "penguin") {
        const wd = Math.sin(t * 9) * 0.12 * moving;
        M4.trs(TMP, 0, 0, 0, 0, 0, wd); const r2 = mat(); M4.mul(r2, root, TMP);
        blob(r2, 0, 0.32, 0, 0.17, 0.27, 0.15, B);
        blob(r2, 0, 0.29, 0.06, 0.13, 0.22, 0.11, Dk);
        blob(r2, 0, 0.53, 0.13, 0.04, 0.025, 0.06, hex("#f97316"));
        for (const sd of [-1, 1]) {
          blob(r2, sd * 0.05, 0.58, 0.12, 0.022, 0.025, 0.012, EYE);
          blob(r2, sd * 0.17, 0.34, 0, 0.03, 0.15, 0.07, B, null, 0);
          blob(root, sd * 0.07, 0.03, 0.05 + (sd > 0 ? wd : -wd) * 0.5, 0.05, 0.02, 0.08, hex("#f97316"));
        }
      } else if (kind === "owl") {
        const fl = Math.sin(t * 14) * 0.6;
        blob(root, 0, 0.3, 0, 0.16, 0.2, 0.15, B);
        blob(root, 0, 0.27, 0.05, 0.11, 0.14, 0.11, hex("#d6b48c"));
        for (const sd of [-1, 1]) {
          blob(root, sd * 0.065, 0.38, 0.12, 0.05, 0.05, 0.02, Dk, [0.3, 0.25, 0]);
          blob(root, sd * 0.065, 0.38, 0.135, 0.022, 0.022, 0.01, EYE);
          blob(root, sd * 0.1, 0.5, 0.0, 0.03, 0.06, 0.03, B, null, sd * 0.3);
          M4.trs(TMP, sd * 0.17, 0.32, 0, 0, 0, sd * fl); const w = mat(); M4.mul(w, root, TMP);
          blob(w, sd * 0.1, 0, 0, 0.14, 0.03, 0.12, B);
        }
        blob(root, 0, 0.33, 0.15, 0.02, 0.03, 0.02, hex("#f59e0b"));
      } else {
        blob(root, 0, 0.3, 0, 0.2, 0.18, 0.2, B);
        blob(root, 0, 0.32, 0.15, 0.14, 0.05, 0.06, Dk, [0.1, 0.7, 0.85]);
        blob(root, 0, 0.5, 0, 0.015, 0.08, 0.015, hex("#475569"));
        blob(root, 0, 0.6, 0, 0.04, 0.04, 0.04, hex("#ef4444"), [0.6, 0.1, 0.1]);
        blob(root, 0, 0.1, 0, 0.12, 0.025, 0.12, Dk, [0.1, 0.6, 0.8]);
      }
      R.material(0, 0);
      // shadow
      M4.trs(SM, x, y + 0.03, z, yaw, 0, 0, 0.3, 1, 0.38);
      R.blend(true); R.cull(false); R.draw(M.disc, SM, SH4, { unlit: true }); R.cull(true); R.blend(false);
    }
    return { draw, drawPet, disc: M.disc };
  };
})();
