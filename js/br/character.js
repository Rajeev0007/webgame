// Brainrot Royale: low-poly 3D politicians (flag suit, head, hair, limbs, gun, armor, parachute).
(() => {
  "use strict";
  const BR3 = window.BR3;
  const { M4, Geo, hex } = BR3;

  const SKINS = ["#f5d0b5", "#e8b896", "#d29a72", "#b97a50", "#8d5a3b", "#5e3b26"].map(hex);
  const HAIRS = ["#1f1f1f", "#3b2414", "#7a4a1f", "#c9a227", "#d4d4d4", "#a83232", "#2b2b6b"].map(hex);
  const VEST_COL = [null, hex("#6b7280"), hex("#2563eb"), hex("#7c3aed")];
  const HELM_COL = [null, hex("#4d5b3a"), hex("#1d4ed8"), hex("#6d28d9")];
  const DARK = hex("#111827"), PANTS = hex("#1f2937"), SHOE = hex("#0b0f19"), PACK = hex("#5b4636");

  BR3.lookFor = (code, type) => {
    const h = code.charCodeAt(0) * 31 + code.charCodeAt(1) * 7;
    return { skin: SKINS[h % SKINS.length], hair: HAIRS[(h >> 2) % HAIRS.length], shades: type === "speedy" || type === "glass", big: type === "tank" };
  };

  BR3.makeCharacterKit = function (R) {
    const g = new Geo();
    g.box(0, 0, 0, 1, 1, 1, [1, 1, 1]);
    const cube = R.mesh(g);
    const m = M4.create();
    const texCache = {};
    function flagTex(code) {
      if (code in texCache) return texCache[code];
      texCache[code] = null;
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = () => { try { texCache[code] = R.texFromImage(im); } catch (e) { texCache[code] = false; } };
      im.onerror = () => { texCache[code] = false; };
      im.src = window.BR.flagUrl(code);
      return null;
    }

    // part drawing helper: local point (lx,ly,lz) in body space, body rotated by yaw and lean (pitch)
    let bx, by, bz, cy, sy, cl, sl, yaw, lean, tintMul, emit;
    function part(lx, ly, lz, pitch, sx, syy, sz, col, opt) {
      const y1 = ly * cl - lz * sl, z1 = ly * sl + lz * cl;
      const wx = bx + cy * lx + sy * z1, wy = by + y1, wz = bz - sy * lx + cy * z1;
      M4.trs(m, wx, wy, wz, yaw, lean + pitch, 0, sx, syy, sz);
      const t = [col[0] * tintMul, col[1] * tintMul, col[2] * tintMul, 1];
      R.draw(cube, m, t, emit ? Object.assign({ emit }, opt || {}) : opt);
    }
    // limb hanging from a pivot, rotated by `a` about the local x axis
    function limb(px, py, pz, a, len, w, d, col) {
      part(px, py - (len / 2) * Math.cos(a), pz - (len / 2) * Math.sin(a), a, w, len, d, col);
    }

    function draw(c, dist) {
      bx = c.x; by = c.y; bz = c.z;
      yaw = c.yaw;
      lean = c.dead ? -Math.min(1, c.deadT * 2.2) * Math.PI / 2 : 0;
      cy = Math.cos(yaw); sy = Math.sin(yaw); cl = Math.cos(lean); sl = Math.sin(lean);
      tintMul = c.dead ? 0.6 : 1;
      emit = c.hitT > 0 && !c.dead ? [0.6 * c.hitT * 4, 0, 0] : null;
      const L = c.look, s = L.big ? 1.08 : 1;
      const far = dist > 60;
      const crouch = c.crouch && !c.dead ? 1 : 0;
      const hip = (0.9 - crouch * 0.32) * s;
      const sw = Math.sin(c.walk) * 0.65 * c.moving * (c.onGround === false ? 0.2 : 1);

      // legs
      if (crouch) {
        limb(0.12 * s, hip, 0.1, -1.1, 0.5 * s, 0.2 * s, 0.22 * s, PANTS);
        limb(-0.12 * s, hip, 0.1, -0.7, 0.5 * s, 0.2 * s, 0.22 * s, PANTS);
      } else {
        limb(0.12 * s, hip, 0, sw, 0.86 * s, 0.2 * s, 0.22 * s, PANTS);
        limb(-0.12 * s, hip, 0, -sw, 0.86 * s, 0.2 * s, 0.22 * s, PANTS);
        if (!far) {
          part(0.12 * s + 0, hip - 0.86 * s * Math.cos(sw) + 0.04, -0.86 * s * Math.sin(sw) + 0.05, 0, 0.2 * s, 0.1, 0.32 * s, SHOE);
          part(-0.12 * s, hip - 0.86 * s * Math.cos(-sw) + 0.04, -0.86 * s * Math.sin(-sw) + 0.05, 0, 0.2 * s, 0.1, 0.32 * s, SHOE);
        }
      }
      // torso with the flag as a suit
      const ty = hip + 0.32 * s;
      const tex = flagTex(c.code);
      if (tex) part(0, ty, 0, 0, 0.5 * s, 0.64 * s, 0.28 * s, [1, 1, 1], { tex });
      else part(0, ty, 0, 0, 0.5 * s, 0.64 * s, 0.28 * s, c.color);
      if (c.vest) part(0, ty - 0.12 * s, 0, 0, 0.54 * s, 0.32 * s, 0.32 * s, VEST_COL[c.vest]);
      if (!far) part(0, ty + 0.02, -0.2 * s, 0, 0.36 * s, 0.44 * s, 0.14 * s, PACK);
      // arms: holding the weapon toward the aim pitch, or swinging when unarmed
      const shY = ty + 0.26 * s, p = c.pitch || 0;
      if (c.weapon && !c.dead) {
        // local -x is the character's right side (matches the over-the-right-shoulder camera)
        limb(-0.3 * s, shY, 0, -Math.PI / 2 - p - 0.1, 0.56 * s, 0.14 * s, 0.15 * s, L.skin);
        limb(0.26 * s, shY, 0.05, -Math.PI / 2 - p + 0.25, 0.6 * s, 0.14 * s, 0.15 * s, L.skin);
        // gun
        const gx = -0.12 * s, gyy = shY - 0.05 + Math.sin(p) * 0.5, gz = Math.cos(p) * 0.5;
        const len = c.weapon === "sniper" || c.weapon === "dmr" ? 1.0 : c.weapon === "pistol" ? 0.38 : 0.78;
        part(gx, gyy, gz, -p, 0.09, 0.14, len, c.gunColor || DARK);
        if (!far && len > 0.5) part(gx, gyy - 0.1, gz - 0.05, -p, 0.07, 0.16, 0.1, DARK);
      } else {
        limb(0.32 * s, shY, 0, -sw * 0.8, 0.6 * s, 0.14 * s, 0.15 * s, L.skin);
        limb(-0.32 * s, shY, 0, sw * 0.8, 0.6 * s, 0.14 * s, 0.15 * s, L.skin);
      }
      // head
      const hy = ty + 0.52 * s;
      part(0, hy, 0, 0, 0.36 * s, 0.36 * s, 0.36 * s, L.skin);
      if (!far) {
        if (L.shades) part(0, hy + 0.03, 0.182 * s, 0, 0.3 * s, 0.07, 0.02, DARK);
        else { part(0.08 * s, hy + 0.03, 0.182 * s, 0, 0.06, 0.06, 0.02, DARK); part(-0.08 * s, hy + 0.03, 0.182 * s, 0, 0.06, 0.06, 0.02, DARK); }
        part(0, hy - 0.08, 0.182 * s, 0, 0.12, 0.03, 0.02, hex("#7f1d1d"));
      }
      if (c.helmet) part(0, hy + 0.19 * s, 0, 0, 0.42 * s, 0.16 * s, 0.42 * s, HELM_COL[c.helmet]);
      else {
        part(0, hy + 0.2 * s, -0.01, 0, 0.38 * s, 0.09 * s, 0.38 * s, L.hair);
        if (!far) part(0, hy + 0.06, -0.17 * s, 0, 0.38 * s, 0.26 * s, 0.05, L.hair);
      }
      // parachute
      if (c.para) {
        const ch = 4.2, cols = [hex("#ef4444"), hex("#f8fafc"), hex("#3b82f6")];
        for (let i = -2; i <= 2; i++) {
          const a = i * 0.32;
          part(Math.sin(a) * 3, ch + Math.cos(a) * 1.2, 0, 0, 1.25, 0.18, 2.4, cols[(i + 2) % 3]);
        }
        part(1.6, 2.6, 0, 0, 0.03, 2.6, 0.03, hex("#e5e7eb"));
        part(-1.6, 2.6, 0, 0, 0.03, 2.6, 0.03, hex("#e5e7eb"));
      }
    }

    // ---- other meshes ----
    // loot pickup model per category
    function lootMesh(kind) {
      const g2 = new Geo();
      if (kind === "weapon") { g2.box(0, 0, 0, 0.16, 0.18, 0.95, hex("#1f2937")); g2.box(0, -0.15, -0.12, 0.1, 0.24, 0.12, hex("#111827")); g2.box(0, -0.02, 0.32, 0.12, 0.08, 0.4, hex("#374151")); }
      else if (kind === "ammo") { g2.box(0, 0, 0, 0.5, 0.3, 0.32, hex("#4d7c0f"), { top: hex("#65a30d") }); }
      else if (kind === "heal") { g2.box(0, 0, 0, 0.5, 0.34, 0.34, hex("#f8fafc")); g2.box(0, 0.175, 0, 0.3, 0.02, 0.08, hex("#dc2626")); g2.box(0, 0.175, 0, 0.08, 0.02, 0.3, hex("#dc2626")); }
      else if (kind === "armor") { g2.box(0, 0, 0, 0.55, 0.5, 0.22, hex("#475569")); }
      else if (kind === "grenade") { g2.box(0, 0, 0, 0.22, 0.28, 0.22, hex("#3f6212")); g2.box(0, 0.18, 0, 0.08, 0.1, 0.08, hex("#9ca3af")); }
      else if (kind === "deathbox") { g2.box(0, 0, 0, 1.0, 0.7, 0.7, hex("#7c2d12"), { top: hex("#facc15") }); }
      return R.mesh(g2);
    }
    const loot = { weapon: lootMesh("weapon"), ammo: lootMesh("ammo"), heal: lootMesh("heal"), armor: lootMesh("armor"), grenade: lootMesh("grenade"), deathbox: lootMesh("deathbox") };

    const gp = new Geo();
    gp.box(0, 0, 0, 3.4, 3.2, 26, hex("#e5e7eb"));
    gp.box(0, 0.4, 0, 30, 0.4, 4.4, hex("#cbd5e1"));
    gp.box(0, 2.6, -11.5, 0.5, 4, 3, hex("#dc2626"));
    gp.box(0, 0.6, -11.5, 9, 0.3, 2.5, hex("#cbd5e1"));
    gp.box(0, 0.5, 13.2, 3, 2.4, 0.6, hex("#1e293b"));
    for (const x of [-7, 7]) gp.cyl(x, -1.5, 1, 0.9, 0.9, 2.2, 8, hex("#94a3b8"));
    const plane = R.mesh(gp);

    const gz = new Geo();
    gz.cyl(0, 0, 0, 1, 1, 1, 64, [1, 1, 1], false);
    const zoneWall = R.mesh(gz);

    const gg = new Geo();
    gg.box(0, 0, 0, 0.26, 0.3, 0.26, hex("#3f6212"));
    const grenade = R.mesh(gg);

    return { draw, cube, loot, plane, zoneWall, grenade, flagTex };
  };
})();
