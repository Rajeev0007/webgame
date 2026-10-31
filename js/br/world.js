// Brainrot Royale: island terrain, towns, buildings, props, collision and ray casting.
(() => {
  "use strict";
  const BR3 = (window.BR3 = window.BR3 || {});
  const { Geo, hex, rng } = BR3;

  const S = 640;            // map size in metres (x and z from 0..S)
  const N = 128;            // terrain grid cells per side
  const CELL = S / N;
  const OG = 16;            // obstacle grid cell size
  const OGN = Math.ceil(S / OG);

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  BR3.buildWorld = function (seed, R, quality) {
    const rnd = rng(seed);
    const W = { S, towns: [], obstacles: [], lootSpots: [], buildings: [], trees: [], rocks: [] };
    const cx = S / 2, cz = S / 2;
    const ph = [rnd() * 6, rnd() * 6, rnd() * 6];
    const mount = { x: cx + (rnd() - 0.5) * 220, z: cz + (rnd() - 0.5) * 220 };

    // ------------------------------------------------ raw height field
    function coastR(a) { return 262 + 24 * Math.sin(3 * a + ph[0]) + 15 * Math.sin(5 * a + ph[1]) + 9 * Math.sin(9 * a + ph[2]); }
    function rawH(x, z) {
      const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz);
      const t = d / coastR(Math.atan2(dz, dx));
      if (t > 1) return Math.max(-8, -1.5 - (t - 1) * 40);
      const inland = 1 - smooth(0.72, 1, t);
      let hills = 2.6 * Math.sin(x * 0.018 + ph[0]) * Math.cos(z * 0.015 + ph[1]) + 1.6 * Math.sin(x * 0.041 + z * 0.03) + 0.9 * Math.sin(z * 0.07 - x * 0.05);
      hills = Math.max(-0.5, hills);
      const md = Math.hypot(x - mount.x, z - mount.z);
      const mountain = 14 * Math.exp(-(md * md) / (2 * 55 * 55));
      return 0.6 + (1 - t) * 2.2 + (hills + 2) * inland * 1.1 + mountain * inland - smooth(0.93, 1, t) * 1.4;
    }
    const Hg = new Float32Array((N + 1) * (N + 1));
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) Hg[j * (N + 1) + i] = rawH(i * CELL, j * CELL);
    const gridH = (i, j) => Hg[clamp(j, 0, N) * (N + 1) + clamp(i, 0, N)];
    W.heightAt = (x, z) => {
      const fx = clamp(x / CELL, 0, N - 0.001), fz = clamp(z / CELL, 0, N - 0.001);
      const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
      // match the triangle split used by the mesh (diagonal from (i,j) to (i+1,j+1))
      const h00 = gridH(i, j), h10 = gridH(i + 1, j), h01 = gridH(i, j + 1), h11 = gridH(i + 1, j + 1);
      return u > v ? h00 + (h10 - h00) * u + (h11 - h10) * v : h00 + (h11 - h01) * u + (h01 - h00) * v;
    };
    W.isLand = (x, z) => x > 2 && z > 2 && x < S - 2 && z < S - 2 && W.heightAt(x, z) > 0.35;

    // ------------------------------------------------ towns (flatten terrain under them)
    const names = BR3.TOWNS.slice();
    for (let tries = 0; tries < 400 && W.towns.length < 8; tries++) {
      const a = rnd() * Math.PI * 2, d = rnd() * 205;
      const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (W.towns.some(t => Math.hypot(t.x - x, t.z - z) < 105)) continue;
      if (Math.hypot(x - mount.x, z - mount.z) < 60) continue;
      W.towns.push({ x, z, r: 42, name: names[W.towns.length] });
    }
    for (const t of W.towns) {
      t.h = Math.max(1.6, rawH(t.x, t.z));
      for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
        const d = Math.hypot(i * CELL - t.x, j * CELL - t.z);
        if (d < t.r + 22) {
          const k = 1 - smooth(t.r, t.r + 22, d);
          const idx = j * (N + 1) + i;
          Hg[idx] = Hg[idx] * (1 - k) + t.h * k;
        }
      }
    }

    // ------------------------------------------------ obstacle grid
    const grid = Array.from({ length: OGN * OGN }, () => []);
    let stamp = 1;
    function addOb(o) {
      o.id = W.obstacles.length;
      o.stamp = 0;
      W.obstacles.push(o);
      const i0 = clamp(Math.floor(o.x0 / OG), 0, OGN - 1), i1 = clamp(Math.floor(o.x1 / OG), 0, OGN - 1);
      const j0 = clamp(Math.floor(o.z0 / OG), 0, OGN - 1), j1 = clamp(Math.floor(o.z1 / OG), 0, OGN - 1);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) grid[j * OGN + i].push(o);
      return o;
    }
    const box = (x, y, z, w, h, d, kind) => addOb({ x0: x - w / 2, x1: x + w / 2, y0: y, y1: y + h, z0: z - d / 2, z1: z + d / 2, kind });
    function query(x0, z0, x1, z1, out) {
      stamp++;
      const i0 = clamp(Math.floor(x0 / OG), 0, OGN - 1), i1 = clamp(Math.floor(x1 / OG), 0, OGN - 1);
      const j0 = clamp(Math.floor(z0 / OG), 0, OGN - 1), j1 = clamp(Math.floor(z1 / OG), 0, OGN - 1);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const c = grid[j * OGN + i];
        for (let k = 0; k < c.length; k++) { const o = c[k]; if (o.stamp !== stamp) { o.stamp = stamp; out.push(o); } }
      }
      return out;
    }
    W.query = query;

    // ------------------------------------------------ geometry
    const gStatic = new Geo();  // buildings, rocks, crates
    const gTrees = new Geo();
    const PAL = ["#e5e7eb", "#fde68a", "#fca5a5", "#93c5fd", "#c4b5fd", "#fdba74", "#a7f3d0", "#f9a8d4"].map(hex);
    const ROOFS = ["#7f1d1d", "#1e3a8a", "#374151", "#14532d", "#78350f"].map(hex);
    const occupied = [];
    const free = (x, z, w, d, m) => !occupied.some(o => x + w / 2 + m > o.x0 && x - w / 2 - m < o.x1 && z + d / 2 + m > o.z0 && z - d / 2 - m < o.z1);
    const occupy = (x, z, w, d) => occupied.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });

    function wall(x0, z0, x1, z1, y0, y1, col) {
      const w = Math.abs(x1 - x0), d = Math.abs(z1 - z0);
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      gStatic.box(mx, (y0 + y1) / 2, mz, w, y1 - y0, d, col);
      addOb({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), y0, y1, z0: Math.min(z0, z1), z1: Math.max(z0, z1), kind: "wall" });
    }

    // hollow building with a door on one side (+ optional back door), roof and windows look
    function hollow(x, z, w, d, h, gy, town) {
      const col = PAL[Math.floor(rnd() * PAL.length)], roof = ROOFS[Math.floor(rnd() * ROOFS.length)];
      const T = 0.35, DW = 2.4, DH = 2.6, y0 = gy - 1, y1 = gy + h;
      const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
      const side = Math.floor(rnd() * 4);
      const doorSides = [side];
      if (w * d > 150) doorSides.push((side + 2) % 4);
      // side 0: +z wall, 1: -z, 2: +x, 3: -x
      const sideWall = (s) => {
        const door = doorSides.includes(s);
        if (s === 0 || s === 1) {
          const zz = s === 0 ? z1 - T / 2 : z0 + T / 2;
          if (!door) return wall(x0, zz - T / 2, x1, zz + T / 2, y0, y1, col);
          const dx = x + (rnd() - 0.5) * (w - DW - 2);
          wall(x0, zz - T / 2, dx - DW / 2, zz + T / 2, y0, y1, col);
          wall(dx + DW / 2, zz - T / 2, x1, zz + T / 2, y0, y1, col);
          wall(dx - DW / 2, zz - T / 2, dx + DW / 2, zz + T / 2, gy + DH, y1, col);
        } else {
          const xx = s === 2 ? x1 - T / 2 : x0 + T / 2;
          if (!door) return wall(xx - T / 2, z0 + T, xx + T / 2, z1 - T, y0, y1, col);
          const dz = z + (rnd() - 0.5) * (d - DW - 2);
          wall(xx - T / 2, z0 + T, xx + T / 2, dz - DW / 2, y0, y1, col);
          wall(xx - T / 2, dz + DW / 2, xx + T / 2, z1 - T, y0, y1, col);
          wall(xx - T / 2, dz - DW / 2, xx + T / 2, dz + DW / 2, gy + DH, y1, col);
        }
      };
      for (let s = 0; s < 4; s++) sideWall(s);
      // floor + roof
      gStatic.box(x, gy - 0.45, z, w - 0.1, 1, d - 0.1, hex("#a8a29e"), { noBottom: true });
      gStatic.box(x, y1 + 0.18, z, w + 0.6, 0.36, d + 0.6, roof);
      addOb({ x0: x0 - 0.3, x1: x1 + 0.3, y0: y1, y1: y1 + 0.36, z0: z0 - 0.3, z1: z1 + 0.3, kind: "roof" });
      // window strips (decorative)
      const win = hex("#1e293b");
      gStatic.box(x, gy + 1.9, z1 + 0.01, w * 0.5, 0.7, 0.02, win);
      gStatic.box(x, gy + 1.9, z0 - 0.01, w * 0.5, 0.7, 0.02, win);
      const b = { x, z, w, d, h, gy, hollow: true, town };
      W.buildings.push(b);
      const n = 2 + Math.floor(rnd() * 3) + (w * d > 150 ? 2 : 0);
      for (let i = 0; i < n; i++) W.lootSpots.push({ x: x + (rnd() - 0.5) * (w - 2.2), z: z + (rnd() - 0.5) * (d - 2.2), y: gy, indoor: true });
    }
    function tower(x, z, w, d, h, gy, town) {
      const col = PAL[Math.floor(rnd() * PAL.length)], roof = ROOFS[Math.floor(rnd() * ROOFS.length)];
      gStatic.box(x, gy + h / 2 - 0.5, z, w, h + 1, d, col, { top: roof });
      addOb({ x0: x - w / 2, x1: x + w / 2, y0: gy - 1, y1: gy + h, z0: z - d / 2, z1: z + d / 2, kind: "tower" });
      const win = hex("#1e293b");
      for (let fy = 2; fy < h - 1; fy += 3) {
        gStatic.box(x, gy + fy, z + d / 2 + 0.01, w * 0.7, 0.8, 0.02, win);
        gStatic.box(x, gy + fy, z - d / 2 - 0.01, w * 0.7, 0.8, 0.02, win);
        gStatic.box(x + w / 2 + 0.01, gy + fy, z, 0.02, 0.8, d * 0.7, win);
        gStatic.box(x - w / 2 - 0.01, gy + fy, z, 0.02, 0.8, d * 0.7, win);
      }
      W.buildings.push({ x, z, w, d, h, gy, hollow: false, town });
      for (let i = 0; i < 2; i++) {
        const s = rnd() < 0.5 ? 1 : -1;
        W.lootSpots.push({ x: x + s * (w / 2 + 1.4), z: z + (rnd() - 0.5) * d, y: gy });
      }
    }
    function crate(x, z, gy, big) {
      const s = big ? 1.8 : 1.3;
      gStatic.box(x, gy + s / 2, z, s, s, s, hex(big ? "#4d7c0f" : "#a16207"), { top: hex(big ? "#65a30d" : "#ca8a04") });
      box(x, gy, z, s, s, s, "crate");
      occupy(x, z, s, s);
    }

    for (const t of W.towns) {
      let placed = 0;
      for (let tries = 0; tries < 80 && placed < 8; tries++) {
        const a = rnd() * Math.PI * 2, d = 6 + rnd() * 32;
        const x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d;
        const kind = rnd();
        let w, dd, h;
        if (kind < 0.55) { w = 9 + rnd() * 4; dd = 9 + rnd() * 4; h = 3.8; }
        else if (kind < 0.8) { w = 14 + rnd() * 4; dd = 10 + rnd() * 3; h = 5; }
        else { w = 6 + rnd() * 2; dd = 6 + rnd() * 2; h = 10 + rnd() * 8; }
        if (!free(x, z, w, dd, 4)) continue;
        occupy(x, z, w, dd);
        if (kind < 0.8) hollow(x, z, w, dd, h, t.h, t); else tower(x, z, w, dd, h, t.h, t);
        placed++;
      }
      for (let i = 0; i < 5; i++) {
        const a = rnd() * Math.PI * 2, d = 10 + rnd() * 34;
        const x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d;
        if (free(x, z, 2, 2, 1)) { crate(x, z, t.h, rnd() < 0.3); W.lootSpots.push({ x: x + 1.6, z, y: t.h }); }
      }
    }

    // ------------------------------------------------ nature props
    const land = (x, z, margin = 0.9) => {
      const h = W.heightAt(x, z);
      return h > 0.9 && W.towns.every(t => Math.hypot(t.x - x, t.z - z) > t.r + 6) && W.isLand(x, z) && Math.hypot(x - cx, z - cz) < 268 * margin;
    };
    const nTrees = quality === "low" ? 170 : 260;
    for (let i = 0, tries = 0; i < nTrees && tries < 3000; tries++) {
      const x = 20 + rnd() * (S - 40), z = 20 + rnd() * (S - 40);
      if (!land(x, z) || !free(x, z, 1.2, 1.2, 1.5)) continue;
      const gy = W.heightAt(x, z);
      const pine = rnd() < 0.55, sc = 0.8 + rnd() * 0.6;
      gTrees.cyl(x, gy - 0.3, z, 0.3 * sc, 0.22 * sc, 2.4 * sc + 0.3, 5, hex("#6b4423"));
      if (pine) {
        const g1 = hex(rnd() < 0.5 ? "#166534" : "#15803d");
        gTrees.cone(x, gy + 1.4 * sc, z, 2.2 * sc, 3.2 * sc, 7, g1);
        gTrees.cone(x, gy + 3.0 * sc, z, 1.6 * sc, 2.6 * sc, 7, g1);
      } else {
        const g2 = hex(rnd() < 0.5 ? "#4d7c0f" : "#3f6212");
        gTrees.box(x, gy + 3.4 * sc, z, 3.2 * sc, 2.6 * sc, 3.2 * sc, g2);
        gTrees.box(x, gy + 4.6 * sc, z, 2 * sc, 1.2 * sc, 2 * sc, g2);
      }
      box(x, gy - 0.5, z, 0.7 * sc, 3.2 * sc, 0.7 * sc, "tree");
      occupy(x, z, 1, 1);
      W.trees.push({ x, z });
      i++;
    }
    for (let i = 0, tries = 0; i < 95 && tries < 2000; tries++) {
      const x = 20 + rnd() * (S - 40), z = 20 + rnd() * (S - 40);
      if (!land(x, z, 0.98) || !free(x, z, 3, 3, 1)) continue;
      const gy = W.heightAt(x, z), s = 1.2 + rnd() * 2.2;
      const dims = gStatic.rock(x, gy, z, s, hex(rnd() < 0.5 ? "#78716c" : "#a8a29e"), rnd);
      box(x, gy - 0.3, z, dims.w * 0.85, dims.h + 0.2, dims.d * 0.85, "rock");
      occupy(x, z, dims.w, dims.d);
      W.rocks.push({ x, z });
      i++;
    }
    for (let i = 0, tries = 0; i < 55 && tries < 1500; tries++) {
      const x = 20 + rnd() * (S - 40), z = 20 + rnd() * (S - 40);
      if (!land(x, z) || !free(x, z, 2, 2, 2)) continue;
      const gy = W.heightAt(x, z);
      crate(x, z, gy, rnd() < 0.35);
      W.lootSpots.push({ x: x + 1.7, z, y: gy });
      i++;
    }
    for (let i = 0, tries = 0; i < 70 && tries < 2000; tries++) {
      const x = 20 + rnd() * (S - 40), z = 20 + rnd() * (S - 40);
      if (!land(x, z)) continue;
      W.lootSpots.push({ x, z, y: W.heightAt(x, z) });
      i++;
    }

    // ------------------------------------------------ terrain mesh
    const gT = new Geo();
    const SAND = hex("#e7d29a"), GRASS = hex("#5f9e4c"), GRASS2 = hex("#4b8a3c"), ROCK = hex("#8a8d79"), WET = hex("#c9b27a"), DIRT = hex("#a3845a");
    const vcol = h => (h < 0.2 ? WET : h < 1.1 ? SAND : h < 5 ? GRASS : h < 9 ? GRASS2 : ROCK);
    const inTown = (x, z) => W.towns.some(t => Math.hypot(t.x - x, t.z - z) < t.r - 2);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x0 = i * CELL, x1 = x0 + CELL, z0 = j * CELL, z1 = z0 + CELL;
      const a = [x0, gridH(i, j), z0], b = [x1, gridH(i + 1, j), z0], c = [x1, gridH(i + 1, j + 1), z1], d = [x0, gridH(i, j + 1), z1];
      if (a[1] < -4 && b[1] < -4 && c[1] < -4 && d[1] < -4) continue;
      const v = (rnd() - 0.5) * 0.06;
      const jit = col => [col[0] + v, col[1] + v, col[2] + v];
      const town = inTown(x0 + CELL / 2, z0 + CELL / 2);
      const c1 = town ? jit(DIRT) : jit(vcol((a[1] + b[1] + c[1]) / 3));
      const c2 = town ? jit(DIRT) : jit(vcol((a[1] + c[1] + d[1]) / 3));
      // triangles (a, c, b) and (a, d, c): counter-clockwise when seen from above
      gT.tri(a, c, b, faceN(a, c, b), c1);
      gT.tri(a, d, c, faceN(a, d, c), c2);
    }
    function faceN(a, b, c) {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz) || 1;
      return [nx / l, ny / l, nz / l];
    }
    const gW = new Geo();
    const WC = hex("#2f86c9");
    gW.quad([-600, 0, S + 600], [S + 600, 0, S + 600], [S + 600, 0, -600], [-600, 0, -600], WC, [0, 1, 0]);

    W.meshes = {
      terrain: R.mesh(gT),
      water: R.mesh(gW),
      statics: R.mesh(gStatic),
      trees: R.mesh(gTrees),
    };

    // ------------------------------------------------ physics helpers
    const tmp = [];
    // push a vertical cylinder (radius r, feet at y, height h) out of obstacles
    W.collide = (p, r, h) => {
      tmp.length = 0;
      query(p.x - r - 1, p.z - r - 1, p.x + r + 1, p.z + r + 1, tmp);
      for (const o of tmp) {
        if (o.y1 <= p.y + 0.45 || o.y0 >= p.y + h) continue; // step over low things / walk under high things
        const nx = clamp(p.x, o.x0, o.x1), nz = clamp(p.z, o.z0, o.z1);
        let dx = p.x - nx, dz = p.z - nz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2), push = r - d;
          p.x += (dx / d) * push; p.z += (dz / d) * push;
        } else {
          // centre inside the box: push out along the smallest axis
          const l = p.x - o.x0, rr = o.x1 - p.x, f = p.z - o.z0, b = o.z1 - p.z, m = Math.min(l, rr, f, b);
          if (m === l) p.x = o.x0 - r; else if (m === rr) p.x = o.x1 + r; else if (m === f) p.z = o.z0 - r; else p.z = o.z1 + r;
        }
      }
      p.x = clamp(p.x, 4, S - 4);
      p.z = clamp(p.z, 4, S - 4);
    };
    // highest walkable surface under (x, z) that is not above feetY + step
    W.groundAt = (x, z, feetY, step = 0.6) => {
      let g = Math.max(W.heightAt(x, z), -0.9);
      tmp.length = 0;
      query(x - 0.3, z - 0.3, x + 0.3, z + 0.3, tmp);
      for (const o of tmp) {
        if (x >= o.x0 - 0.25 && x <= o.x1 + 0.25 && z >= o.z0 - 0.25 && z <= o.z1 + 0.25 && o.y1 <= feetY + step && o.y1 > g) g = o.y1;
      }
      return g;
    };

    // ray vs axis-aligned boxes; returns distance t (or Infinity)
    function rayBox(o, ox, oy, oz, dx, dy, dz, maxT) {
      let t0 = 0, t1 = maxT;
      for (let a = 0; a < 3; a++) {
        const org = a === 0 ? ox : a === 1 ? oy : oz, dir = a === 0 ? dx : a === 1 ? dy : dz;
        const lo = a === 0 ? o.x0 : a === 1 ? o.y0 : o.z0, hi = a === 0 ? o.x1 : a === 1 ? o.y1 : o.z1;
        if (Math.abs(dir) < 1e-9) { if (org < lo || org > hi) return Infinity; continue; }
        let ta = (lo - org) / dir, tb = (hi - org) / dir;
        if (ta > tb) { const s = ta; ta = tb; tb = s; }
        if (ta > t0) t0 = ta;
        if (tb < t1) t1 = tb;
        if (t0 > t1) return Infinity;
      }
      return t0;
    }
    const rayList = [];
    // cast a ray against obstacles and terrain; returns hit distance (Infinity if nothing within maxT)
    W.raycast = (ox, oy, oz, dx, dy, dz, maxT) => {
      let best = maxT;
      const step = 12;
      for (let s = 0; s < best; s += step) {
        const e = Math.min(best, s + step);
        const ax = ox + dx * s, az = oz + dz * s, bx = ox + dx * e, bz = oz + dz * e;
        rayList.length = 0;
        query(Math.min(ax, bx) - 0.5, Math.min(az, bz) - 0.5, Math.max(ax, bx) + 0.5, Math.max(az, bz) + 0.5, rayList);
        for (const o of rayList) {
          const t = rayBox(o, ox, oy, oz, dx, dy, dz, best);
          if (t < best) best = t;
        }
      }
      // terrain: march
      for (let t = 0.5; t < best; t += 2) {
        const x = ox + dx * t, y = oy + dy * t, z = oz + dz * t;
        if (y < W.heightAt(x, z)) { best = Math.max(0, t - 1); break; }
      }
      return best < maxT ? best : Infinity;
    };
    W.lineClear = (ax, ay, az, bx, by, bz) => {
      const dx = bx - ax, dy = by - ay, dz = bz - az, d = Math.hypot(dx, dy, dz) || 1;
      return W.raycast(ax, ay, az, dx / d, dy / d, dz / d, d - 0.3) === Infinity;
    };
    W.inBuilding = (x, z) => W.buildings.find(b => b.hollow && Math.abs(x - b.x) < b.w / 2 && Math.abs(z - b.z) < b.d / 2) || null;

    // ------------------------------------------------ 2D map image (minimap + full map)
    const mc = document.createElement("canvas");
    mc.width = mc.height = 512;
    const g = mc.getContext("2d");
    const img = g.createImageData(512, 512);
    for (let py = 0; py < 512; py++) for (let px = 0; px < 512; px++) {
      const x = (px / 512) * S, z = (py / 512) * S, h = W.heightAt(x, z);
      let c;
      if (h < 0) { const k = Math.max(0, 1 + h / 8); c = [30 + 20 * k, 100 + 40 * k, 170 + 30 * k]; }
      else if (h < 1.1) c = [222, 203, 150];
      else if (h < 5) c = [96, 150, 80];
      else if (h < 9) c = [80, 132, 66];
      else c = [140, 140, 122];
      if (h >= 0 && inTown(x, z)) c = [165, 137, 98];
      const o = (py * 512 + px) * 4;
      img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    g.fillStyle = "#4b5563";
    for (const b of W.buildings) g.fillRect(((b.x - b.w / 2) / S) * 512, ((b.z - b.d / 2) / S) * 512, (b.w / S) * 512, (b.d / S) * 512);
    g.fillStyle = "#14532d";
    for (const t of W.trees) g.fillRect((t.x / S) * 512 - 1, (t.z / S) * 512 - 1, 2, 2);
    W.mapImage = mc;

    W.center = { x: cx, z: cz };
    return W;
  };
})();
