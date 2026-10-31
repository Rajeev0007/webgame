// Brainrot Royale: low-poly 3D characters (outfits, hats, masks, weapon skins, poses, emotes), pets, props.
(() => {
  "use strict";
  const BR3 = window.BR3;
  const { M4, Geo, hex } = BR3;

  const SKINS = ["#f5d0b5", "#e8b896", "#d29a72", "#b97a50", "#8d5a3b", "#5e3b26"].map(hex);
  const HAIRS = ["#1f1f1f", "#3b2414", "#7a4a1f", "#c9a227", "#d4d4d4", "#a83232", "#2b2b6b"].map(hex);
  const VEST_COL = [null, hex("#6b7280"), hex("#2563eb"), hex("#7c3aed")];
  const HELM_COL = [null, hex("#4d5b3a"), hex("#1d4ed8"), hex("#6d28d9")];
  const DARK = hex("#111827"), SHOE = hex("#0b0f19"), PACK = hex("#b45309"), PACK2 = hex("#92400e"), GOLD = hex("#facc15"), WHITE = hex("#f8fafc");

  // look = skin/hair from the country code, outfit from the shop
  BR3.lookFor = (code, type, outfitId) => {
    const h = code.charCodeAt(0) * 31 + code.charCodeAt(1) * 7;
    const o = BR3.OUTFITS[outfitId] || BR3.OUTFITS.flag;
    return {
      skin: SKINS[h % SKINS.length], hair: HAIRS[(h >> 2) % HAIRS.length],
      shades: !o.mask && o.hat !== "visor" && (type === "speedy" || type === "glass"), big: type === "tank",
      outfit: outfitId || "flag", shirt: o.shirt ? hex(o.shirt) : null, pants: hex(o.pants), hat: o.hat, mask: !!o.mask, glow: o.glow ? hex(o.glow) : null,
    };
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

    // body-space part drawing: local (lx,ly,lz) rotated by lean (about x) then yaw
    let bx, by, bz, cy, sy, cl, sl, yaw, lean, tintMul, emit;
    function part(lx, ly, lz, pitch, sx, syy, sz, col, opt, roll = 0) {
      const y1 = ly * cl - lz * sl, z1 = ly * sl + lz * cl;
      const wx = bx + cy * lx + sy * z1, wy = by + y1, wz = bz - sy * lx + cy * z1;
      M4.trs(m, wx, wy, wz, yaw, lean + pitch, roll, sx, syy, sz);
      const t = [col[0] * tintMul, col[1] * tintMul, col[2] * tintMul, 1];
      const e = opt && opt.emit ? opt.emit : emit;
      R.draw(cube, m, t, e ? Object.assign({}, opt || {}, { emit: e }) : opt);
    }
    function limb(px, py, pz, a, len, w, d, col, opt) {
      part(px, py - (len / 2) * Math.cos(a), pz - (len / 2) * Math.sin(a), a, w, len, d, col, opt);
    }

    function draw(c, dist) {
      bx = c.x; by = c.y; bz = c.z;
      yaw = c.yaw;
      const L = c.look, s = L.big ? 1.08 : 1;
      const far = dist > 60;
      let bob = 0;
      if (c.dead) lean = -Math.min(1, c.deadT * 2.2) * Math.PI / 2;
      else if (c.knocked) { lean = 1.25; by += 0.12; }
      else lean = 0;
      const em = c.emote && !c.dead && !c.knocked ? c.emote : null;
      if (em && em.type === "dance") { bob = Math.abs(Math.sin(em.t * 8)) * 0.12; yaw += Math.sin(em.t * 4) * 0.5; }
      by += bob;
      cy = Math.cos(yaw); sy = Math.sin(yaw); cl = Math.cos(lean); sl = Math.sin(lean);
      tintMul = c.dead ? 0.6 : 1;
      emit = c.hitT > 0 && !c.dead ? [0.6 * c.hitT * 4, 0, 0] : null;
      const crouch = (c.crouch || c.knocked) && !c.dead ? 1 : 0;
      const hip = (0.9 - crouch * 0.32) * s;
      const moving = c.knocked ? c.moving * 0.5 : c.moving;
      const sw = Math.sin(c.walk) * 0.65 * moving * (c.onGround === false ? 0.2 : 1);
      const PANTS = L.pants;

      // legs
      if (crouch && !c.knocked) {
        limb(0.12 * s, hip, 0.1, -1.1, 0.5 * s, 0.2 * s, 0.22 * s, PANTS);
        limb(-0.12 * s, hip, 0.1, -0.7, 0.5 * s, 0.2 * s, 0.22 * s, PANTS);
      } else {
        limb(0.12 * s, hip, 0, sw, 0.86 * s, 0.2 * s, 0.22 * s, PANTS);
        limb(-0.12 * s, hip, 0, -sw, 0.86 * s, 0.2 * s, 0.22 * s, PANTS);
        if (!far) {
          part(0.12 * s, hip - 0.86 * s * Math.cos(sw) + 0.04, -0.86 * s * Math.sin(sw) + 0.05, 0, 0.2 * s, 0.1, 0.32 * s, SHOE);
          part(-0.12 * s, hip - 0.86 * s * Math.cos(-sw) + 0.04, -0.86 * s * Math.sin(-sw) + 0.05, 0, 0.2 * s, 0.1, 0.32 * s, SHOE);
        }
      }
      // torso: flag suit or outfit shirt
      const ty = hip + 0.32 * s;
      const glowE = L.glow ? [L.glow[0] * 0.35, L.glow[1] * 0.35, L.glow[2] * 0.35] : null;
      if (!L.shirt) {
        const tex = flagTex(c.code);
        if (tex) part(0, ty, 0, 0, 0.5 * s, 0.64 * s, 0.28 * s, [1, 1, 1], { tex });
        else part(0, ty, 0, 0, 0.5 * s, 0.64 * s, 0.28 * s, c.color);
      } else {
        part(0, ty, 0, 0, 0.5 * s, 0.64 * s, 0.28 * s, L.shirt, glowE ? { emit: glowE } : null);
        // small flag badge on the chest keeps the nationality visible
        const tex = !far && flagTex(c.code);
        if (tex) part(0.12 * s, ty + 0.15 * s, 0.145 * s, 0, 0.14, 0.09, 0.01, [1, 1, 1], { tex });
      }
      if (c.vest) part(0, ty - 0.12 * s, 0, 0, 0.54 * s, 0.32 * s, 0.32 * s, VEST_COL[c.vest]);
      if (!far) { part(0, ty + 0.02, -0.21 * s, 0, 0.38 * s, 0.46 * s, 0.16 * s, PACK); part(0, ty - 0.12, -0.3 * s, 0, 0.3 * s, 0.16 * s, 0.05, PACK2); }

      // arms
      const shY = ty + 0.26 * s, p = c.pitch || 0;
      if (em) {
        const t = em.t;
        if (em.type === "wave") {
          limb(-0.32 * s, shY, 0, -Math.PI + 0.35 + Math.sin(t * 10) * 0.35, 0.6 * s, 0.14 * s, 0.15 * s, L.skin);
          limb(0.32 * s, shY, 0, 0.1, 0.6 * s, 0.14 * s, 0.15 * s, L.skin);
        } else if (em.type === "victory") {
          limb(-0.32 * s, shY, 0, -Math.PI + 0.25, 0.6 * s, 0.14 * s, 0.15 * s, L.skin);
          limb(0.32 * s, shY, 0, -Math.PI + 0.25, 0.6 * s, 0.14 * s, 0.15 * s, L.skin);
        } else if (em.type === "salute") {
          limb(-0.32 * s, shY, 0.05, -2.5, 0.6 * s, 0.14 * s, 0.15 * s, L.skin);
          limb(0.32 * s, shY, 0, 0.05, 0.6 * s, 0.14 * s, 0.15 * s, L.skin);
        } else {
          limb(-0.32 * s, shY, 0, -Math.PI * 0.75 + Math.sin(t * 8) * 0.6, 0.6 * s, 0.14 * s, 0.15 * s, L.skin);
          limb(0.32 * s, shY, 0, -Math.PI * 0.75 - Math.sin(t * 8) * 0.6, 0.6 * s, 0.14 * s, 0.15 * s, L.skin);
        }
      } else if (c.weapon && !c.dead && !c.knocked) {
        // local -x is the character's right side (matches the over-the-right-shoulder camera)
        limb(-0.3 * s, shY, 0, -Math.PI / 2 - p - 0.1, 0.56 * s, 0.14 * s, 0.15 * s, L.skin);
        limb(0.26 * s, shY, 0.05, -Math.PI / 2 - p + 0.25, 0.6 * s, 0.14 * s, 0.15 * s, L.skin);
        const gx = -0.12 * s, gyy = shY - 0.05 + Math.sin(p) * 0.5, gz = Math.cos(p) * 0.5;
        const len = c.weapon === "sniper" || c.weapon === "dmr" ? 1.0 : c.weapon === "pistol" ? 0.38 : 0.78;
        const gopt = c.gunGlow ? { emit: c.gunGlow } : null;
        part(gx, gyy, gz, -p, 0.09, 0.14, len, c.gunColor || DARK, gopt);
        if (!far && len > 0.5) part(gx, gyy - 0.1, gz - 0.05, -p, 0.07, 0.16, 0.1, DARK);
      } else {
        const a = c.knocked ? -Math.PI * 0.8 + sw : -sw * 0.8;
        limb(0.32 * s, shY, 0, a, 0.6 * s, 0.14 * s, 0.15 * s, L.skin);
        limb(-0.32 * s, shY, 0, c.knocked ? -Math.PI * 0.8 - sw : sw * 0.8, 0.6 * s, 0.14 * s, 0.15 * s, L.skin);
      }
      // head
      const hy = ty + 0.52 * s;
      part(0, hy, 0, 0, 0.36 * s, 0.36 * s, 0.36 * s, L.skin);
      if (!far) {
        if (L.hat === "visor") part(0, hy + 0.03, 0.185 * s, 0, 0.36 * s, 0.08, 0.02, hex("#22d3ee"), { emit: [0.1, 0.8, 0.9] });
        else if (L.shades) part(0, hy + 0.03, 0.182 * s, 0, 0.3 * s, 0.07, 0.02, DARK);
        else { part(0.08 * s, hy + 0.03, 0.182 * s, 0, 0.06, 0.06, 0.02, DARK); part(-0.08 * s, hy + 0.03, 0.182 * s, 0, 0.06, 0.06, 0.02, DARK); }
        if (L.mask) part(0, hy - 0.08, 0.17 * s, 0, 0.38 * s, 0.17 * s, 0.06, L.hat === "bandana" ? hex("#991b1b") : DARK);
        else part(0, hy - 0.08, 0.182 * s, 0, 0.12, 0.03, 0.02, hex("#7f1d1d"));
      }
      if (c.helmet) part(0, hy + 0.19 * s, 0, 0, 0.42 * s, 0.16 * s, 0.42 * s, HELM_COL[c.helmet]);
      else drawHat(L, hy, s, far);
    }
    function drawHat(L, hy, s, far) {
      const top = hy + 0.2 * s;
      switch (L.hat) {
        case "cap":
          part(0, top, 0, 0, 0.4 * s, 0.1 * s, 0.4 * s, L.shirt || hex("#ef4444"));
          if (!far) part(0, top - 0.04, 0.26 * s, 0, 0.36 * s, 0.03, 0.2 * s, L.shirt || hex("#ef4444"));
          break;
        case "beret":
          part(0.04, top + 0.01, -0.02, 0, 0.44 * s, 0.08 * s, 0.42 * s, hex("#14532d"), null, 0.2);
          break;
        case "hood":
          part(0, top - 0.05, -0.04, 0, 0.44 * s, 0.16 * s, 0.44 * s, L.shirt);
          if (!far) part(0, hy - 0.02, -0.2 * s, 0, 0.44 * s, 0.44 * s, 0.08, L.shirt);
          break;
        case "crown":
          part(0, top, 0, 0, 0.4 * s, 0.09 * s, 0.4 * s, GOLD, { emit: [0.3, 0.22, 0] });
          if (!far) for (const [x, z] of [[0.14, 0.14], [-0.14, 0.14], [0.14, -0.14], [-0.14, -0.14], [0, 0.17]]) part(x * s, top + 0.09, z * s, 0, 0.07, 0.12, 0.07, GOLD, { emit: [0.3, 0.22, 0] });
          break;
        case "ninja":
          part(0, hy + 0.1, 0, 0, 0.39 * s, 0.08 * s, 0.39 * s, hex("#1e3a8a"));
          if (!far) part(0, hy + 0.1, 0.2 * s, 0, 0.14, 0.07, 0.02, hex("#9ca3af"));
          part(0, top + 0.02, 0, 0, 0.37 * s, 0.07, 0.37 * s, hex("#d4d4d8"));
          break;
        case "bandana":
          part(0, hy + 0.12, 0, 0, 0.39 * s, 0.07 * s, 0.39 * s, hex("#b91c1c"));
          part(0, top, -0.01, 0, 0.38 * s, 0.09 * s, 0.38 * s, L.hair);
          break;
        case "visor":
          part(0, top, -0.01, 0, 0.38 * s, 0.09 * s, 0.38 * s, L.hair);
          break;
        default:
          part(0, top, -0.01, 0, 0.38 * s, 0.09 * s, 0.38 * s, L.hair);
          if (!far) part(0, hy + 0.06, -0.17 * s, 0, 0.38 * s, 0.26 * s, 0.05, L.hair);
      }
    }

    // parachute drawn separately so it also works when the body is hidden
    function drawPara(c) {
      bx = c.x; by = c.y; bz = c.z; yaw = c.yaw; lean = 0;
      cy = Math.cos(yaw); sy = Math.sin(yaw); cl = 1; sl = 0; tintMul = 1; emit = null;
      const cols = [hex("#ef4444"), hex("#f8fafc"), hex("#3b82f6")];
      for (let i = -2; i <= 2; i++) {
        const a = i * 0.32;
        part(Math.sin(a) * 3, 4.2 + Math.cos(a) * 1.2, 0, 0, 1.25, 0.18, 2.4, cols[(i + 2) % 3], null, -a);
      }
      part(1.6, 2.6, 0, 0, 0.03, 2.6, 0.03, WHITE);
      part(-1.6, 2.6, 0, 0, 0.03, 2.6, 0.03, WHITE);
    }

    // ---------------- pets (yaw-only transform)
    function pb(lx, ly, lz, sx, syy, sz, col, e) {
      const wx = bx + cy * lx + sy * lz, wz = bz - sy * lx + cy * lz;
      M4.trs(m, wx, by + ly, wz, yaw, 0, 0, sx, syy, sz);
      R.draw(cube, m, col, e ? { emit: e } : null);
    }
    const PC = {
      panda: { body: hex("#f8fafc"), dark: hex("#111827") }, dog: { body: hex("#a16207"), dark: hex("#713f12") },
      fox: { body: hex("#ea580c"), dark: hex("#f8fafc") }, owl: { body: hex("#92400e"), dark: hex("#facc15") },
      penguin: { body: hex("#111827"), dark: hex("#f8fafc") }, robo: { body: hex("#94a3b8"), dark: hex("#22d3ee") },
    };
    function drawPet(kind, x, y, z, yw, t, moving) {
      if (!kind || kind === "none" || !PC[kind]) return;
      const C = PC[kind];
      bx = x; bz = z; yaw = yw; cy = Math.cos(yaw); sy = Math.sin(yaw);
      const hover = kind === "owl" || kind === "robo";
      by = y + (hover ? 0.7 + Math.sin(t * 3) * 0.08 : Math.abs(Math.sin(t * 9)) * 0.06 * moving);
      const leg = Math.sin(t * 12) * 0.08 * moving;
      if (kind === "panda") {
        pb(0, 0.32, 0, 0.42, 0.34, 0.55, C.body); pb(0, 0.36, -0.02, 0.44, 0.18, 0.3, C.dark);
        pb(0, 0.58, 0.3, 0.34, 0.3, 0.3, C.body);
        pb(0.13, 0.75, 0.3, 0.1, 0.1, 0.06, C.dark); pb(-0.13, 0.75, 0.3, 0.1, 0.1, 0.06, C.dark);
        pb(0.08, 0.6, 0.455, 0.09, 0.08, 0.02, C.dark); pb(-0.08, 0.6, 0.455, 0.09, 0.08, 0.02, C.dark);
        for (const [lx, lz] of [[0.14, 0.18], [-0.14, 0.18], [0.14, -0.18], [-0.14, -0.18]]) pb(lx, 0.1, lz + (lz > 0 ? leg : -leg), 0.12, 0.2, 0.12, C.dark);
      } else if (kind === "dog" || kind === "fox") {
        pb(0, 0.3, 0, 0.3, 0.26, 0.6, C.body);
        pb(0, 0.46, 0.34, 0.26, 0.24, 0.26, C.body);
        pb(0, 0.42, 0.5, 0.12, 0.1, 0.12, kind === "fox" ? C.dark : hex("#111827"));
        if (kind === "fox") { pb(0.09, 0.64, 0.32, 0.07, 0.14, 0.05, C.body); pb(-0.09, 0.64, 0.32, 0.07, 0.14, 0.05, C.body); pb(0, 0.36, -0.42, 0.14, 0.14, 0.34, C.body); pb(0, 0.36, -0.62, 0.1, 0.1, 0.08, C.dark); pb(0, 0.24, 0.15, 0.2, 0.08, 0.2, C.dark); }
        else { pb(0.14, 0.5, 0.3, 0.05, 0.16, 0.1, C.dark); pb(-0.14, 0.5, 0.3, 0.05, 0.16, 0.1, C.dark); pb(0, 0.42, -0.36, 0.06, 0.06, 0.2, C.body); }
        for (const [lx, lz] of [[0.1, 0.2], [-0.1, 0.2], [0.1, -0.2], [-0.1, -0.2]]) pb(lx, 0.09, lz + (lz > 0 ? leg : -leg), 0.08, 0.18, 0.08, kind === "fox" ? hex("#111827") : C.body);
      } else if (kind === "penguin") {
        pb(0, 0.36, 0, 0.36, 0.6, 0.3, C.body); pb(0, 0.32, 0.1, 0.26, 0.44, 0.14, C.dark);
        pb(0, 0.58, 0.18, 0.12, 0.05, 0.12, hex("#f97316"));
        pb(0.07, 0.66, 0.16, 0.05, 0.05, 0.02, C.dark); pb(-0.07, 0.66, 0.16, 0.05, 0.05, 0.02, C.dark);
        pb(0.08, 0.03, 0.06 + leg, 0.1, 0.05, 0.14, hex("#f97316")); pb(-0.08, 0.03, 0.06 - leg, 0.1, 0.05, 0.14, hex("#f97316"));
        pb(0.2, 0.4, 0, 0.05, 0.3, 0.14, C.body, null); pb(-0.2, 0.4, 0, 0.05, 0.3, 0.14, C.body);
      } else if (kind === "owl") {
        pb(0, 0.3, 0, 0.34, 0.42, 0.3, C.body);
        pb(0.08, 0.38, 0.155, 0.1, 0.1, 0.02, C.dark, [0.3, 0.25, 0]); pb(-0.08, 0.38, 0.155, 0.1, 0.1, 0.02, C.dark, [0.3, 0.25, 0]);
        pb(0.12, 0.54, 0, 0.06, 0.1, 0.06, C.body); pb(-0.12, 0.54, 0, 0.06, 0.1, 0.06, C.body);
        const f = Math.sin(t * 14) * 0.5;
        M4.trs(m, bx + cy * 0.24, by + 0.32, bz - sy * 0.24, yaw, 0, f, 0.28, 0.06, 0.24); R.draw(cube, m, C.body);
        M4.trs(m, bx - cy * 0.24, by + 0.32, bz + sy * 0.24, yaw, 0, -f, 0.28, 0.06, 0.24); R.draw(cube, m, C.body);
      } else if (kind === "robo") {
        pb(0, 0.3, 0, 0.4, 0.3, 0.4, C.body);
        pb(0, 0.32, 0.205, 0.26, 0.08, 0.02, C.dark, [0.1, 0.8, 0.9]);
        pb(0, 0.52, 0, 0.03, 0.16, 0.03, hex("#475569")); pb(0, 0.62, 0, 0.07, 0.07, 0.07, hex("#ef4444"), [0.6, 0.1, 0.1]);
        pb(0, 0.1, 0, 0.2, 0.04, 0.2, C.dark, [0.1, 0.6, 0.8]);
      }
    }

    // ---- loot / props meshes ----
    function lootMesh(kind) {
      const g2 = new Geo();
      if (kind === "weapon") { g2.box(0, 0, 0, 0.16, 0.18, 0.95, hex("#1f2937")); g2.box(0, -0.15, -0.12, 0.1, 0.24, 0.12, hex("#111827")); g2.box(0, -0.02, 0.32, 0.12, 0.08, 0.4, hex("#374151")); }
      else if (kind === "ammo") { g2.box(0, 0, 0, 0.5, 0.3, 0.32, hex("#4d7c0f"), { top: hex("#65a30d") }); }
      else if (kind === "heal") { g2.box(0, 0, 0, 0.5, 0.34, 0.34, hex("#f8fafc")); g2.box(0, 0.175, 0, 0.3, 0.02, 0.08, hex("#dc2626")); g2.box(0, 0.175, 0, 0.08, 0.02, 0.3, hex("#dc2626")); }
      else if (kind === "armor") { g2.box(0, 0, 0, 0.55, 0.5, 0.22, hex("#475569")); }
      else if (kind === "grenade") { g2.box(0, 0, 0, 0.22, 0.28, 0.22, hex("#3f6212")); g2.box(0, 0.18, 0, 0.08, 0.1, 0.08, hex("#9ca3af")); }
      else if (kind === "gloo") { g2.box(0, 0, 0, 0.3, 0.3, 0.3, hex("#6ee7b7")); g2.box(0, 0.2, 0, 0.1, 0.1, 0.1, hex("#065f46")); }
      return R.mesh(g2);
    }
    const loot = { weapon: lootMesh("weapon"), ammo: lootMesh("ammo"), heal: lootMesh("heal"), armor: lootMesh("armor"), grenade: lootMesh("grenade"), gloo: lootMesh("gloo") };

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

    // gloo wall chunk: lumpy ice block (unit size, scaled per segment)
    const gw = new Geo();
    const ice = hex("#6ee7b7"), ice2 = hex("#a7f3d0");
    gw.box(0, 0, 0, 1, 1, 1, ice, { top: ice2 });
    gw.box(0.15, 0.42, 0.05, 0.7, 0.3, 0.9, ice2);
    gw.box(-0.2, -0.1, 0.1, 0.5, 0.6, 1.05, ice);
    const gloo = R.mesh(gw);

    // training target board
    const gt = new Geo();
    gt.box(0, 0, 0, 1.2, 1.2, 0.12, hex("#f8fafc"));
    gt.box(0, 0, 0.07, 0.8, 0.8, 0.02, hex("#ef4444"));
    gt.box(0, 0, 0.09, 0.4, 0.4, 0.02, hex("#f8fafc"));
    gt.box(0, 0, 0.11, 0.15, 0.15, 0.02, hex("#ef4444"));
    gt.box(0, -1.2, -0.05, 0.1, 1.4, 0.1, hex("#78350f"));
    const target = R.mesh(gt);

    return { draw, drawPara, drawPet, cube, loot, plane, zoneWall, grenade, gloo, target, flagTex };
  };
})();
