// Brainrot Royale 3D: match flow, player, bots, weapons, zone, HUD.
(() => {
  "use strict";
  const BR3 = window.BR3, BR = window.BR, SND = BR.Audio, IN = BR3.Input;
  const { M4, hex } = BR3;
  const WD = BR3.WEAPONS, AMMO = BR3.AMMO, ITEMS = BR3.ITEMS, ARMOR = BR3.ARMOR, ZONE = BR3.ZONE;
  const $ = id => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const lerp = (a, b, t) => a + (b - a) * t;
  const wrapA = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const RAR = Object.fromEntries(Object.entries(BR3.RARITY).map(([k, v]) => [k, hex(v.color)]));
  const RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary"];
  const N_PLAYERS = 50;

  // =================================================================== save + settings
  const store = {
    get(k, d) { try { const v = localStorage.getItem("brr-" + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("brr-" + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  const isTouch = matchMedia && matchMedia("(pointer: coarse)").matches;
  const S = Object.assign({ sens: 1, assist: true, invert: false, quality: isTouch ? "low" : "medium", music: 0.35, sfx: 0.8, voice: 0.9, vib: true, fps: false, diff: "normal", char: "US" }, store.get("settings", {}));
  const STATS = Object.assign({ matches: 0, wins: 0, kills: 0, best: 0, top10: 0, dmg: 0 }, store.get("stats", {}));
  const FOGS = { low: [80, 165], medium: [110, 225], high: [150, 300] };
  const QPR = { low: 0.7, medium: 1, high: 1.5 };

  // =================================================================== renderer
  const glc = $("gl"), ov = $("ov"), octx = ov.getContext("2d");
  let R;
  try { R = new BR3.Renderer(glc); }
  catch (e) {
    $("loadMsg").innerHTML = `Your browser can't run 3D graphics (WebGL): ${esc(e.message)}<br><br><a class="big" href="classic/">Play the 2D version instead</a>`;
    return;
  }
  let SW = 0, SH = 0, ODPR = 1;
  function resize() {
    SW = innerWidth; SH = innerHeight;
    const pr = clamp(Math.min(devicePixelRatio || 1, 2) * QPR[S.quality], 0.5, 2);
    R.resize(SW, SH, pr);
    ODPR = Math.min(devicePixelRatio || 1, 2);
    ov.width = Math.round(SW * ODPR); ov.height = Math.round(SH * ODPR);
    ov.style.width = SW + "px"; ov.style.height = SH + "px";
    octx.setTransform(ODPR, 0, 0, ODPR, 0, 0);
  }
  function applySettings() {
    store.set("settings", S);
    Object.assign(SND.settings, { music: S.music, sfx: S.sfx, voice: S.voice, muted: false });
    SND.apply();
    IN.sens = S.sens; IN.invertY = S.invert;
    R.fog = FOGS[S.quality].slice();
    resize();
  }
  addEventListener("resize", resize);

  const KIT = BR3.makeCharacterKit(R);
  let WORLD = null;
  let state = "loading"; // loading | lobby | plane | play | dead | over | paused
  let prevState = null;
  let G = null;
  let selected = BR.CHARACTERS.find(c => c.code === S.char) || BR.CHARACTERS[0];
  let preview = null;

  function hslRgb(str) {
    const m = /hsl\((\d+),(\d+)%,(\d+)%\)/.exec(str || "");
    if (!m) return [0.5, 0.5, 0.6];
    const h = +m[1] / 360, s = +m[2] / 100, l = +m[3] / 100;
    const f = n => { const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
    return [f(0), f(8), f(4)];
  }

  // =================================================================== fighters
  function makeFighter(ch, isPlayer, id) {
    return {
      id, isPlayer, ch, code: ch.code, name: isPlayer ? "You" : ch.name, look: BR3.lookFor(ch.code, ch.type), color: hslRgb(ch.color),
      x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, onGround: false, crouch: false, moving: 0, walk: 0, stepT: 0,
      hp: 100, boost: 0, vest: 0, helmet: 0, alive: true, dead: false, deadT: 0, hitT: 0,
      slots: [null, null], cur: -1, ammo: { light: 0, heavy: 0, shells: 0, sniper: 0 }, items: { bandage: 0, medkit: 0, drink: 0, grenade: 0 },
      reloadT: 0, fireCd: 0, useT: 0, useMax: 0, useItem: null, punchT: 0, kills: 0, dmg: 0,
      phase: "plane", para: false, dropT: 0, target: null, lastHitBy: null,
      ai: { think: Math.random() * 0.3, enemy: null, seenT: -99, strafe: 1, strafeT: 0, goal: null, goalT: 0, mode: "roam", stuckT: 0, lx: 0, lz: 0, detour: 0, react: 0, crouchT: 0 },
    };
  }
  const weaponOf = f => (f.cur >= 0 && f.slots[f.cur] ? f.slots[f.cur] : null);
  const fHeight = f => (f.crouch ? 1.3 : 1.85);
  const eyeY = f => f.y + (f.crouch ? 1.15 : 1.55);
  const fwd = yaw => [Math.sin(yaw), Math.cos(yaw)];
  const rightOf = yaw => [-Math.cos(yaw), Math.sin(yaw)];
  function syncDraw(f) {
    const w = weaponOf(f);
    f.weapon = w && f.useT <= 0 ? w.id : null;
    f.gunColor = w ? hex(WD[w.id].color) : null;
  }

  // =================================================================== audio helpers
  function hearVol(x, z) {
    const c = G ? G.cam : null;
    if (!c) return 1;
    const d = Math.hypot(x - c.x, z - c.z);
    return Math.pow(clamp(1 - d / 190, 0, 1), 1.6);
  }
  function sfxAt(name, x, z, scale = 1) { SND.sfx(name, hearVol(x, z) * scale); }
  function vibrate(ms) { if (S.vib && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) { /* ignore */ } }
  function speakAs(ch, text, force) { SND.speak(text, { lang: ch.lang, pitch: ch.pitch, rate: ch.rate, force }); }

  // =================================================================== match setup
  function rollLoot() {
    const T = BR3.LOOT_TABLE, total = T.reduce((s, e) => s + e[1], 0);
    let r = Math.random() * total;
    for (const [k, w] of T) { r -= w; if (r <= 0) return k; }
    return T[0][0];
  }
  function lootFrom(key) {
    const [kind, v] = key.split(":");
    if (kind === "weapon") return { kind: "weapon", id: Math.random() < 0.012 ? "golden" : v, mag: null };
    if (kind === "ammo") return { kind: "ammo", type: v, n: AMMO[v].box };
    if (kind === "item") return { kind: "item", type: v, n: v === "bandage" ? 3 : 1 };
    return { kind, lvl: +v };
  }
  function addLoot(o, x, z, y) {
    o.x = x; o.z = z; o.y = y != null ? y : WORLD.groundAt(x, z, 99);
    o.rot = Math.random() * 6.28;
    o.taken = false;
    G.loot.push(o);
    return o;
  }
  function lootRarity(o) {
    if (o.kind === "weapon") return WD[o.id].rarity;
    if (o.kind === "vest" || o.kind === "helmet") return BR3.LEVEL_RARITY[o.lvl];
    if (o.kind === "item") return ITEMS[o.type].rarity;
    return "common";
  }
  function lootLabel(o) {
    if (o.kind === "weapon") return `${WD[o.id].icon} ${WD[o.id].name}`;
    if (o.kind === "ammo") return `${AMMO[o.type].icon} ${AMMO[o.type].name} ×${o.n}`;
    if (o.kind === "item") return `${ITEMS[o.type].icon} ${ITEMS[o.type].name}${o.n > 1 ? " ×" + o.n : ""}`;
    return `${ARMOR[o.kind].icon} ${ARMOR[o.kind].name} Lv.${o.lvl}`;
  }

  function startMatch() {
    SND.init();
    hideScreens();
    IN.clear();
    $("specBar").classList.add("hidden");
    $("mapFull").classList.add("hidden");
    $("feed").innerHTML = "";
    const diff = BR3.DIFF[S.diff] || BR3.DIFF.normal;
    G = {
      t: 0, diff, fighters: [], loot: [], tracers: [], parts: [], grenades: [], dmgNums: [], indicators: [], pings: [], feed: [],
      alive: N_PLAYERS, ads: false, adsToggle: false, prevFire: false, bloom: 0, recoilP: 0,
      cam: { x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 1, yaw: 0, pitch: -0.1, dist: 3.4 }, fov: 1.2,
      mapOpen: false, spec: null, placement: 0, killer: null, startT: performance.now(), shake: 0, hitmT: 0,
    };
    // fighters
    const P = makeFighter(selected, true, 0);
    G.player = P;
    G.fighters.push(P);
    const pool = BR.CHARACTERS.filter(c => c.code !== selected.code).sort(() => Math.random() - 0.5);
    for (let i = 1; i < N_PLAYERS; i++) G.fighters.push(makeFighter(pool[i - 1], false, i));
    // loot
    for (const sp of WORLD.lootSpots) {
      if (Math.random() > (sp.indoor ? 0.9 : 0.75)) continue;
      const o = lootFrom(rollLoot());
      addLoot(o, sp.x, sp.z, sp.y);
      if (o.kind === "weapon") {
        const a = WD[o.id].ammo;
        addLoot({ kind: "ammo", type: a, n: AMMO[a].box * 2 }, sp.x + rand(-0.8, 0.8), sp.z + rand(-0.8, 0.8), sp.y);
      }
    }
    // plane path across the island
    const c = WORLD.center, a = Math.random() * Math.PI * 2;
    const dx = Math.cos(a), dz = Math.sin(a), off = rand(-110, 110);
    const sx = c.x - dx * 330 - dz * off, sz = c.z - dz * 330 + dx * off;
    const ex = c.x + dx * 330 - dz * off, ez = c.z + dz * 330 + dx * off;
    const len = Math.hypot(ex - sx, ez - sz);
    G.plane = { sx, sz, ex, ez, len, dur: len / 42, t: 0, x: sx, z: sz, y: 135, yaw: Math.atan2(ex - sx, ez - sz) };
    for (const f of G.fighters) {
      f.phase = "plane";
      if (!f.isPlayer) {
        const spot = Math.random() < 0.65 ? pick(WORLD.towns) : randomLand();
        const tx = spot.x + rand(-25, 25), tz = spot.z + rand(-25, 25);
        const proj = ((tx - sx) * dx + (tz - sz) * dz) / len;
        f.dropT = clamp(proj + rand(-0.04, 0.04), 0.06, 0.94) * G.plane.dur;
        f.target = { x: tx, z: tz };
      }
    }
    // zone
    let zx = c.x, zz = c.z;
    for (let i = 0; i < 30; i++) { const tx = c.x + rand(-60, 60), tz = c.z + rand(-60, 60); if (WORLD.heightAt(tx, tz) > 0.8) { zx = tx; zz = tz; break; } }
    G.zone = { x: zx, z: zz, r: 360, nx: zx, nz: zz, nr: 360, fx: zx, fz: zz, fr: 360, phase: 0, mode: "wait", t: G.plane.dur + 45, dps: ZONE[0].dps };
    chooseNextZone(true);
    G.cam.yaw = G.plane.yaw;
    state = "plane";
    $("hud").classList.remove("hidden");
    $("dropBtn").classList.remove("hidden");
    SND.music.start();
    SND.music.setIntense(false);
    SND.sfx("plane");
    center("DROP IN!", IN.mode === "touch" ? "Tap 🪂 JUMP over a good spot" : "Press SPACE to jump out", 4);
    speakAs(selected, selected.phrase, true);
    if (IN.mode === "desktop") requestLock();
  }
  function randomLand() {
    for (let i = 0; i < 80; i++) {
      const x = rand(60, WORLD.S - 60), z = rand(60, WORLD.S - 60);
      if (WORLD.heightAt(x, z) > 1) return { x, z };
    }
    return WORLD.center;
  }
  function chooseNextZone(first) {
    const Z = G.zone, ph = ZONE[Z.phase];
    const nr = first ? 205 : Z.r * ph.frac;
    let nx = Z.x, nz = Z.z;
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * Math.max(0, Z.r - nr) * (first ? 0.4 : 1);
      const tx = Z.x + Math.cos(a) * d, tz = Z.z + Math.sin(a) * d;
      if (WORLD.heightAt(tx, tz) > 0.8 || i === 59) { nx = tx; nz = tz; break; }
    }
    Z.nx = nx; Z.nz = nz; Z.nr = nr;
  }
  function updateZone(dt) {
    const Z = G.zone;
    if (Z.mode === "done") return;
    Z.t -= dt;
    if (Z.mode === "wait") {
      if (Z.t <= 0) {
        Z.mode = "shrink"; Z.fx = Z.x; Z.fz = Z.z; Z.fr = Z.r;
        Z.t = ZONE[Z.phase].shrink; Z.dur = Z.t;
        Z.dps = ZONE[Z.phase].dps;
        SND.sfx("zone");
        center("⚠️ ZONE IS SHRINKING", "Get inside the white circle", 3);
      } else if (Z.t < 10.05 && Z.t > 9.95) toast("⏳ Zone shrinks in 10 seconds");
    } else if (Z.mode === "shrink") {
      const k = 1 - Math.max(0, Z.t) / Z.dur;
      Z.x = lerp(Z.fx, Z.nx, k); Z.z = lerp(Z.fz, Z.nz, k); Z.r = lerp(Z.fr, Z.nr, k);
      if (Z.t <= 0) {
        Z.x = Z.nx; Z.z = Z.nz; Z.r = Z.nr;
        Z.phase++;
        if (Z.phase >= ZONE.length || Z.r <= 1) { Z.mode = "done"; Z.dps = ZONE[ZONE.length - 1].dps; }
        else { Z.mode = "wait"; Z.t = ZONE[Z.phase].wait; chooseNextZone(false); toast(`🗺️ New zone marked. Phase ${Z.phase + 1}`); }
      }
    }
  }
  const outsideZone = f => Math.hypot(f.x - G.zone.x, f.z - G.zone.z) > G.zone.r;

  // =================================================================== shooting
  function rayCyl(ox, oy, oz, dx, dy, dz, cx, cz, r, y0, y1, maxT) {
    const fx = ox - cx, fz = oz - cz, a = dx * dx + dz * dz;
    if (a < 1e-8) return Infinity;
    const b = 2 * (fx * dx + fz * dz), c = fx * fx + fz * fz - r * r, disc = b * b - 4 * a * c;
    if (disc < 0) return Infinity;
    const sq = Math.sqrt(disc);
    for (const t of [(-b - sq) / (2 * a), (-b + sq) / (2 * a)]) {
      if (t < 0 || t > maxT) continue;
      const y = oy + dy * t;
      if (y >= y0 && y <= y1) return t;
    }
    return Infinity;
  }
  function coneDir(dx, dy, dz, deg) {
    if (deg <= 0) return [dx, dy, dz];
    const a = (deg * Math.PI / 180) * Math.sqrt(Math.random()), th = Math.random() * Math.PI * 2;
    let ux = 0, uy = 1, uz = 0;
    if (Math.abs(dy) > 0.95) { ux = 1; uy = 0; }
    let r1x = dy * uz - dz * uy, r1y = dz * ux - dx * uz, r1z = dx * uy - dy * ux;
    let l = Math.hypot(r1x, r1y, r1z) || 1; r1x /= l; r1y /= l; r1z /= l;
    const r2x = dy * r1z - dz * r1y, r2y = dz * r1x - dx * r1z, r2z = dx * r1y - dy * r1x;
    const s = Math.sin(a), c = Math.cos(a), ct = Math.cos(th), st = Math.sin(th);
    let x = dx * c + (r1x * ct + r2x * st) * s, y = dy * c + (r1y * ct + r2y * st) * s, z = dz * c + (r1z * ct + r2z * st) * s;
    l = Math.hypot(x, y, z) || 1;
    return [x / l, y / l, z / l];
  }
  function muzzleOf(f) {
    const [fx, fz] = fwd(f.yaw), [rx, rz] = rightOf(f.yaw);
    return [f.x + fx * 0.6 + rx * 0.14, f.y + (f.crouch ? 0.98 : 1.38), f.z + fz * 0.6 + rz * 0.14];
  }
  // trace one bullet, apply damage, spawn visuals
  function traceShot(f, ox, oy, oz, d, range, w, mz) {
    const tObs = WORLD.raycast(ox, oy, oz, d[0], d[1], d[2], range);
    let best = tObs, hitF = null, hitY = 0;
    for (const o of G.fighters) {
      if (o === f || !o.alive || o.phase !== "ground") continue;
      const ddx = o.x - ox, ddz = o.z - oz;
      if (ddx * ddx + ddz * ddz > (range + 2) * (range + 2)) continue;
      const t = rayCyl(ox, oy, oz, d[0], d[1], d[2], o.x, o.z, 0.42, o.y, o.y + fHeight(o), Math.min(best, range));
      if (t < best) { best = t; hitF = o; hitY = oy + d[1] * t; }
    }
    const end = Math.min(best, range);
    const ex = ox + d[0] * end, ey = oy + d[1] * end, ez = oz + d[2] * end;
    G.tracers.push({ ax: mz[0], ay: mz[1], az: mz[2], bx: ex, by: ey, bz: ez, life: 0.07, col: f.isPlayer ? [1, 0.9, 0.5] : [1, 0.75, 0.4] });
    if (hitF) {
      const head = hitY > hitF.y + fHeight(hitF) - 0.36;
      const dist = Math.hypot(hitF.x - f.x, hitF.z - f.z);
      let dmg = w.dmg * (dist > w.range ? 0.55 : 1);
      damage(hitF, f, dmg, head, w.short, ex, ey, ez);
      for (let i = 0; i < 5; i++) G.parts.push({ x: ex, y: ey, z: ez, vx: rand(-2, 2), vy: rand(0, 3), vz: rand(-2, 2), life: 0.35, col: [0.75, 0.05, 0.05], s: 0.06 });
    } else if (tObs < range) {
      for (let i = 0; i < 4; i++) G.parts.push({ x: ex, y: ey, z: ez, vx: rand(-1.5, 1.5), vy: rand(0, 2.5), vz: rand(-1.5, 1.5), life: 0.4, col: [0.75, 0.7, 0.6], s: 0.05 });
      if (f.isPlayer) sfxAt("bullethit", ex, ez, 0.6);
    }
  }
  function fireWeapon(f, ox, oy, oz, dx, dy, dz, spread) {
    const slot = weaponOf(f), w = WD[slot.id];
    slot.mag--;
    f.fireCd = 60 / w.rpm;
    const mz = muzzleOf(f);
    for (let i = 0; i < w.pellets; i++) traceShot(f, ox, oy, oz, coneDir(dx, dy, dz, spread), w.range * 1.6, w, mz);
    sfxAt(w.sound, f.x, f.z, f.isPlayer ? 1 : 0.85);
    G.parts.push({ x: mz[0], y: mz[1], z: mz[2], vx: 0, vy: 0, vz: 0, life: 0.05, col: [1, 0.85, 0.3], s: 0.18 });
    if (!f.isPlayer && G.player.alive && Math.hypot(f.x - G.player.x, f.z - G.player.z) < 110) G.pings.push({ x: f.x, z: f.z, t: 1.2 });
    if (slot.mag <= 0 && f.ammo[w.ammo] > 0) startReload(f);
  }
  function startReload(f) {
    const slot = weaponOf(f);
    if (!slot || f.reloadT > 0) return;
    const w = WD[slot.id];
    if (slot.mag >= w.mag || f.ammo[w.ammo] <= 0) return;
    f.reloadT = w.reload;
    f.useT = 0; f.useItem = null;
    if (f.isPlayer) SND.sfx("reload");
  }
  function finishReload(f) {
    const slot = weaponOf(f);
    if (!slot) return;
    const w = WD[slot.id], need = w.mag - slot.mag, take = Math.min(need, f.ammo[w.ammo]);
    slot.mag += take; f.ammo[w.ammo] -= take;
  }
  function punch(f) {
    if (f.punchT > 0) return;
    f.punchT = 0.55;
    const [fx, fz] = fwd(f.yaw);
    for (const o of G.fighters) {
      if (o === f || !o.alive || o.phase !== "ground") continue;
      const dx = o.x - f.x, dz = o.z - f.z, d = Math.hypot(dx, dz);
      if (d < 1.6 && (dx * fx + dz * fz) / (d || 1) > 0.5 && Math.abs(o.y - f.y) < 1.2) {
        damage(o, f, 14, false, "👊", o.x, o.y + 1.3, o.z);
        break;
      }
    }
    sfxAt("step", f.x, f.z);
  }

  function damage(t, a, base, head, wname, hx, hy, hz) {
    if (!t.alive) return;
    let d = base;
    if (head) d *= (a && weaponOf(a) && WD[weaponOf(a).id] ? WD[weaponOf(a).id].head : 1.5) * (1 - ARMOR.helmet.reduce[t.helmet]);
    else d *= 1 - ARMOR.vest.reduce[t.vest];
    if (a && !a.isPlayer) d *= G.diff.dmg;
    d = Math.max(1, Math.round(d));
    t.hp -= d;
    t.hitT = 0.25;
    t.hurtT = G.t;
    if (a) { a.dmg += d; t.lastHitBy = a; }
    if (t.isPlayer) {
      if (a) G.indicators.push({ a: Math.atan2(a.x - t.x, a.z - t.z), t: 1.2 });
      SND.sfx("hurt", 0.7);
      vibrate(40);
      G.shake = Math.max(G.shake, 0.25);
      t.useT = 0; t.useItem = null; // getting hit interrupts healing
    }
    if (a && a.isPlayer) {
      G.dmgNums.push({ x: hx, y: hy + 0.3, z: hz, v: d, head, t: 0.8 });
      G.hitmT = 0.18; G.hitmKind = head ? "head" : "";
      SND.sfx(head ? "headshot" : "hitmark");
    }
    if (!t.isPlayer && a) {
      t.ai.enemy = a; t.ai.seenT = G.t; t.ai.react = Math.min(t.ai.react, 0.15);
    }
    if (t.hp <= 0) kill(t, a, wname, head);
  }

  function kill(t, a, wname, head) {
    t.alive = false; t.dead = true; t.deadT = 0; t.hp = 0; t.useT = 0; t.reloadT = 0; t.crouch = false;
    G.alive--;
    // drop everything
    const drop = [];
    for (const s of t.slots) if (s) drop.push({ kind: "weapon", id: s.id, mag: s.mag });
    for (const k in t.ammo) if (t.ammo[k] > 0) drop.push({ kind: "ammo", type: k, n: t.ammo[k] });
    for (const k in t.items) if (t.items[k] > 0) drop.push({ kind: "item", type: k, n: t.items[k] });
    if (t.vest) drop.push({ kind: "vest", lvl: t.vest });
    if (t.helmet) drop.push({ kind: "helmet", lvl: t.helmet });
    drop.forEach((o, i) => {
      const ang = (i / Math.max(1, drop.length)) * Math.PI * 2;
      addLoot(o, t.x + Math.cos(ang) * 1.1, t.z + Math.sin(ang) * 1.1, Math.max(t.y, WORLD.groundAt(t.x, t.z, t.y + 1)));
    });
    const how = a ? `${esc(a.isPlayer ? "You" : a.name)} <b>${esc(wname || "")}</b>${head ? " 🎯" : ""} ${esc(t.isPlayer ? "You" : t.name)}` : `${esc(t.isPlayer ? "You" : t.name)} got lost in the zone 🌀`;
    feed(how, (a && a.isPlayer) || t.isPlayer);
    if (a) a.kills++;
    if (a && a.isPlayer) {
      SND.sfx("knock");
      G.hitmKind = "kill"; G.hitmT = 0.35;
      center(`💀 ${t.name.toUpperCase()} ELIMINATED`, `${a.kills} kill${a.kills > 1 ? "s" : ""}${head ? " · HEADSHOT" : ""}`, 2.2);
      if (a.kills === 1 || Math.random() < 0.4) speakAs(selected, pick(BR3.KILL_LINES), false);
    }
    if (t.isPlayer) playerDied(a);
    if (a && !a.isPlayer && a.alive && G.player.alive && Math.hypot(a.x - G.player.x, a.z - G.player.z) < 45 && Math.random() < 0.35) speakAs(a.ch, a.ch.phrase, false);
    checkEnd();
  }

  function checkEnd() {
    if (G.over) return;
    if (G.player.alive && G.alive <= 1) {
      G.over = true;
      G.placement = 1;
      state = "over";
      SND.sfx("booyah");
      SND.music.setIntense(true);
      speakAs(selected, pick(BR3.WIN_LINES), true);
      center("🏆 BOOYAH!", "WINNER WINNER, AURA DINNER", 4);
      setTimeout(() => showResults(true), 2200);
    }
  }
  function playerDied(killer) {
    G.mapOpen = false;
    $("mapFull").classList.add("hidden");
    G.placement = G.alive + 1;
    G.killer = killer;
    state = "dead";
    exitLock();
    SND.sfx("lose");
    vibrate(250);
    center("YOU GOT RATIO'D 💀", killer ? `by ${killer.name}` : "the zone got you", 3);
    setTimeout(() => { if (state === "dead" && !G.spec) showResults(false); }, 2200);
  }

  // =================================================================== items / loot
  function canUse(f, type) {
    const n = f.items[type];
    if (!n) return false;
    if (type === "bandage") return f.hp < ITEMS.bandage.cap;
    if (type === "medkit") return f.hp < 100;
    if (type === "drink") return f.boost < 100;
    return false;
  }
  function startUse(f, type) {
    if (!canUse(f, type) || f.useT > 0) return false;
    f.useItem = type; f.useT = f.useMax = ITEMS[type].time; f.reloadT = 0;
    return true;
  }
  function finishUse(f) {
    const it = f.useItem, I = ITEMS[it];
    f.items[it]--;
    if (it === "drink") f.boost = Math.min(100, f.boost + I.boost);
    else f.hp = Math.min(I.cap, f.hp + I.heal);
    if (f.isPlayer) SND.sfx("heal");
    f.useItem = null; f.useT = 0;
  }
  function smartHeal(f) {
    if (f.hp < 45 && canUse(f, "medkit")) return startUse(f, "medkit");
    if (canUse(f, "bandage")) return startUse(f, "bandage");
    if (canUse(f, "medkit")) return startUse(f, "medkit");
    return false;
  }
  function giveWeapon(f, o) {
    let slot = f.slots[0] ? (f.slots[1] ? -1 : 1) : 0;
    let dropped = null;
    if (slot < 0) { slot = f.cur >= 0 ? f.cur : 0; dropped = f.slots[slot]; }
    f.slots[slot] = { id: o.id, mag: o.mag != null ? o.mag : Math.min(WD[o.id].mag, Math.ceil(WD[o.id].mag * 0.5)) };
    if (f.cur < 0 || dropped || !f.slots[f.cur]) f.cur = slot;
    f.reloadT = 0;
    if (dropped) addLoot({ kind: "weapon", id: dropped.id, mag: dropped.mag }, f.x + rand(-0.6, 0.6), f.z + rand(-0.6, 0.6), f.y);
    o.taken = true;
    if (f.isPlayer) { SND.sfx("pick"); toast(`${WD[o.id].icon} ${WD[o.id].name}`); }
  }
  // auto-pickup: ammo, heals, grenades, armor upgrades, and weapons into an empty slot
  function autoPickup(f) {
    for (const o of G.loot) {
      if (o.taken) continue;
      const dx = o.x - f.x, dz = o.z - f.z;
      if (dx * dx + dz * dz > 2.6 || Math.abs(o.y - f.y) > 1.6) continue;
      if (o.kind === "ammo") {
        const room = AMMO[o.type].max - f.ammo[o.type], take = Math.min(room, o.n);
        if (take <= 0) continue;
        f.ammo[o.type] += take; o.n -= take;
        if (o.n <= 0) o.taken = true;
        if (f.isPlayer) { SND.sfx("pick", 0.6); toast(`${AMMO[o.type].icon} +${take} ${AMMO[o.type].name}`); }
        const w = weaponOf(f);
        if (w && w.mag === 0) startReload(f);
      } else if (o.kind === "item") {
        const room = ITEMS[o.type].max - f.items[o.type], take = Math.min(room, o.n);
        if (take <= 0) continue;
        f.items[o.type] += take; o.n -= take;
        if (o.n <= 0) o.taken = true;
        if (f.isPlayer) { SND.sfx("pick", 0.6); toast(`${ITEMS[o.type].icon} +${take} ${ITEMS[o.type].name}`); }
      } else if (o.kind === "vest" || o.kind === "helmet") {
        if (o.lvl <= f[o.kind]) continue;
        const old = f[o.kind];
        f[o.kind] = o.lvl; o.taken = true;
        if (old) addLoot({ kind: o.kind, lvl: old }, f.x + rand(-0.6, 0.6), f.z + rand(-0.6, 0.6), f.y);
        if (f.isPlayer) { SND.sfx("armor"); toast(`${ARMOR[o.kind].icon} ${ARMOR[o.kind].name} Lv.${o.lvl} equipped`); }
      } else if (o.kind === "weapon") {
        const has = f.slots.some(s => s && s.id === o.id);
        if (!has && (!f.slots[0] || !f.slots[1])) giveWeapon(f, o);
        else if (!f.isPlayer && !has) {
          // bots swap their worst weapon for a better one
          const worst = f.slots[0] && f.slots[1] ? (RARITY_ORDER.indexOf(WD[f.slots[0].id].rarity) <= RARITY_ORDER.indexOf(WD[f.slots[1].id].rarity) ? 0 : 1) : -1;
          if (worst >= 0 && RARITY_ORDER.indexOf(WD[o.id].rarity) > RARITY_ORDER.indexOf(WD[f.slots[worst].id].rarity)) { f.cur = worst; giveWeapon(f, o); }
        }
      }
    }
  }
  function nearestWeaponLoot(f, maxD = 2.3) {
    let best = null, bd = maxD * maxD;
    for (const o of G.loot) {
      if (o.taken || o.kind !== "weapon") continue;
      const d = (o.x - f.x) ** 2 + (o.z - f.z) ** 2;
      if (d < bd && Math.abs(o.y - f.y) < 1.6) { bd = d; best = o; }
    }
    return best;
  }

  // grenades
  function throwGrenade(f, dx, dy, dz) {
    if (f.items.grenade <= 0 || f.useT > 0) return;
    f.items.grenade--;
    const m = muzzleOf(f);
    const sp = 17;
    G.grenades.push({ x: m[0], y: m[1] + 0.2, z: m[2], vx: dx * sp, vy: dy * sp + 4.5, vz: dz * sp, fuse: 3, owner: f });
    sfxAt("pin", f.x, f.z);
  }
  function updateGrenades(dt) {
    for (const g of G.grenades) {
      g.vy -= 18 * dt;
      const nx = g.x + g.vx * dt, nz = g.z + g.vz * dt, ny = g.y + g.vy * dt;
      const tmp = [];
      WORLD.query(nx - 0.2, nz - 0.2, nx + 0.2, nz + 0.2, tmp);
      const blocked = tmp.some(o => nx > o.x0 && nx < o.x1 && nz > o.z0 && nz < o.z1 && ny > o.y0 && ny < o.y1);
      if (blocked) { g.vx *= -0.35; g.vz *= -0.35; } else { g.x = nx; g.z = nz; }
      g.y = ny;
      const gy = WORLD.groundAt(g.x, g.z, g.y + 0.3);
      if (g.y < gy + 0.13) { g.y = gy + 0.13; g.vy = Math.abs(g.vy) > 2 ? -g.vy * 0.35 : 0; g.vx *= 0.7; g.vz *= 0.7; }
      g.fuse -= dt;
      if (g.fuse <= 0) explode(g);
    }
    G.grenades = G.grenades.filter(g => g.fuse > 0);
  }
  function explode(g) {
    sfxAt("boom", g.x, g.z, 1.2);
    for (let i = 0; i < 40; i++) G.parts.push({ x: g.x, y: g.y + 0.3, z: g.z, vx: rand(-7, 7), vy: rand(1, 9), vz: rand(-7, 7), life: rand(0.4, 0.9), col: Math.random() < 0.5 ? [1, 0.55, 0.1] : [0.35, 0.33, 0.3], s: rand(0.12, 0.3) });
    for (const f of G.fighters) {
      if (!f.alive || f.phase !== "ground") continue;
      const d = Math.hypot(f.x - g.x, f.y + 0.9 - g.y, f.z - g.z);
      if (d > 8) continue;
      if (!WORLD.lineClear(g.x, g.y + 0.4, g.z, f.x, f.y + 1, f.z)) continue;
      damage(f, g.owner && g.owner.alive ? g.owner : g.owner, 110 * (1 - d / 8), false, "💣", f.x, f.y + 1.2, f.z);
    }
    const p = G.player;
    if (Math.hypot(p.x - g.x, p.z - g.z) < 25) G.shake = Math.max(G.shake, 0.6);
  }

  // =================================================================== physics
  function physics(f, wx, wz, speed, dt) {
    const k = clamp((f.onGround ? 11 : 2.5) * dt, 0, 1);
    f.vx += (wx * speed - f.vx) * k;
    f.vz += (wz * speed - f.vz) * k;
    f.x += f.vx * dt; f.z += f.vz * dt;
    WORLD.collide(f, 0.38, fHeight(f));
    f.vy -= 18 * dt;
    f.y += f.vy * dt;
    const g = WORLD.groundAt(f.x, f.z, f.y + 0.05);
    if (f.y <= g) {
      if (!f.onGround && f.vy < -12 && f.isPlayer) SND.sfx("land", 0.6);
      f.y = g; f.vy = 0; f.onGround = true;
    } else if (f.y > g + 0.08) f.onGround = false;
    const sp = Math.hypot(f.vx, f.vz);
    f.moving = clamp(sp / 4.5, 0, 1);
    f.walk += sp * dt * 2.1;
    if (f.onGround && sp > 1.5) {
      f.stepT -= dt * sp / 4.5;
      if (f.stepT <= 0) { f.stepT = 0.36; if (f.isPlayer) SND.sfx("step", 0.5); else sfxAt("step", f.x, f.z, 0.9); }
    }
  }
  function updateFall(f, wx, wz, dt, wantPara) {
    const g = WORLD.heightAt(f.x, f.z);
    if (!f.para && (wantPara || f.y - g < 50)) { f.para = true; if (f.isPlayer) SND.sfx("wind"); }
    const hs = f.para ? 9 : 17;
    f.vx += (wx * hs - f.vx) * clamp(2 * dt, 0, 1);
    f.vz += (wz * hs - f.vz) * clamp(2 * dt, 0, 1);
    f.vy = f.para ? lerp(f.vy, -5.2, clamp(3 * dt, 0, 1)) : Math.max(f.vy - 18 * dt, -34);
    f.x = clamp(f.x + f.vx * dt, 5, WORLD.S - 5); f.z = clamp(f.z + f.vz * dt, 5, WORLD.S - 5);
    f.y += f.vy * dt;
    if (wx || wz) f.yaw = Math.atan2(f.vx, f.vz);
    const gg = WORLD.groundAt(f.x, f.z, f.y + 0.1, 3);
    if (f.y <= gg) {
      f.y = gg; f.vy = 0; f.phase = "ground"; f.para = false; f.onGround = true; f.landT = G.t;
      WORLD.collide(f, 0.38, 1.85);
      if (f.isPlayer) { SND.sfx("land"); SND.music.stop(); center("LANDED", "Find a weapon fast!", 1.8); }
    }
  }
  function leavePlane(f) {
    f.phase = "fall";
    f.x = G.plane.x + rand(-2, 2); f.z = G.plane.z + rand(-2, 2); f.y = G.plane.y - 3;
    f.vx = Math.sin(G.plane.yaw) * 20; f.vz = Math.cos(G.plane.yaw) * 20; f.vy = 0;
    if (f.isPlayer) { $("dropBtn").classList.add("hidden"); SND.sfx("wind"); center("🪂 FREEFALL", IN.mode === "touch" ? "Steer with the stick · tap JUMP to open the parachute" : "Steer with WASD · SPACE opens the parachute", 3); }
  }

  // =================================================================== player
  function updatePlayer(dt) {
    const P = G.player, C = G.cam;
    const L = IN.takeLook();
    const zoomS = G.ads ? 1 / (WD[(weaponOf(P) || { id: "pistol" }).id].zoom) : 1;
    C.yaw -= L.dx * zoomS;
    C.pitch = clamp(C.pitch - L.dy * zoomS, -1.15, 0.9);
    if (!P.alive) return;
    const mv = IN.move();
    const [fx, fz] = fwd(C.yaw), [rx, rz] = rightOf(C.yaw);
    let wx = fx * mv.y + rx * mv.x, wz = fz * mv.y + rz * mv.x;

    if (P.phase === "plane") { P.x = G.plane.x; P.z = G.plane.z; P.y = G.plane.y; return; }
    if (P.phase === "fall") { updateFall(P, wx, wz, dt, false); return; }

    // ---- ground ----
    const slot = weaponOf(P), w = slot ? WD[slot.id] : null;
    G.ads = !!(w && (IN.aiming() || G.adsToggle) && P.useT <= 0 && P.reloadT <= 0);
    $("touch").querySelector(".aim").classList.toggle("on", G.ads);
    let speed = 4.6;
    const sprint = IN.sprint() && mv.y > 0.3 && !G.ads && P.useT <= 0 && !P.crouch;
    if (sprint) speed = 6.7;
    if (P.crouch) speed = 2.5;
    if (G.ads) speed = 2.9;
    if (P.useT > 0) speed *= 0.55;
    if (P.boost > 60) speed *= 1.06;
    physics(P, wx, wz, speed, dt);
    // body faces the camera when armed, otherwise the walking direction
    const targetYaw = w || IN.firing() ? C.yaw : (Math.hypot(wx, wz) > 0.1 ? Math.atan2(wx, wz) : P.yaw);
    P.yaw += wrapA(targetYaw - P.yaw) * clamp(14 * dt, 0, 1);
    P.pitch = C.pitch;

    // aim assist for touch / controller
    if (S.assist && IN.mode !== "desktop" && w) aimAssist(dt);

    // timers
    P.fireCd -= dt; P.punchT -= dt;
    if (P.reloadT > 0) { P.reloadT -= dt; if (P.reloadT <= 0) finishReload(P); }
    if (P.useT > 0) { P.useT -= dt; if (P.useT <= 0) finishUse(P); }
    G.bloom = Math.max(0, G.bloom - dt * 6);

    // firing
    const want = IN.firing();
    if (want && G.mapOpen) { /* ignore while map is open */ }
    else if (want && P.useT > 0 && !G.prevFire) { P.useT = 0; P.useItem = null; }
    else if (want && !w) { if (!G.prevFire || P.punchT <= 0) punch(P); }
    else if (want && w && P.useT <= 0) {
      if (P.reloadT > 0) { /* reloading */ }
      else if (slot.mag <= 0) { if (!G.prevFire) { SND.sfx("empty"); startReload(P); } }
      else if (P.fireCd <= 0 && (w.auto || !G.prevFire)) {
        let spread = G.ads ? w.ads : w.hip;
        spread *= P.moving > 0.3 ? 1.6 : 1;
        if (P.crouch) spread *= 0.75;
        if (!P.onGround) spread *= 2.2;
        spread += G.bloom;
        const d = camDir();
        const c = G.cam;
        fireWeapon(P, c.x + d[0] * (c.dist + 0.4), c.y + d[1] * (c.dist + 0.4), c.z + d[2] * (c.dist + 0.4), d[0], d[1], d[2], spread);
        const rk = G.ads ? 0.6 : 1;
        C.pitch = clamp(C.pitch + w.recoil * 0.012 * rk, -1.15, 0.9);
        C.yaw += rand(-1, 1) * w.recoil * 0.005 * rk;
        G.bloom = Math.min(4, G.bloom + w.recoil * 0.35);
        G.shake = Math.max(G.shake, w.recoil * 0.03);
      }
    }
    G.prevFire = want;
    P.boost = Math.max(0, P.boost - dt * 1.2);
    if (P.boost > 0) P.hp = Math.min(100, P.hp + dt * (P.boost > 50 ? 1.6 : 0.8));
    autoPickup(P);
    syncDraw(P);
  }
  function camDir() {
    const C = G.cam, cp = Math.cos(C.pitch);
    return [Math.sin(C.yaw) * cp, Math.sin(C.pitch), Math.cos(C.yaw) * cp];
  }
  function aimAssist(dt) {
    const C = G.cam, d = camDir();
    let best = null, ba = 0.1;
    for (const o of G.fighters) {
      if (o.isPlayer || !o.alive || o.phase !== "ground") continue;
      const dx = o.x - C.x, dy = o.y + 1.2 - C.y, dz = o.z - C.z, dist = Math.hypot(dx, dy, dz);
      if (dist > 90) continue;
      const cos = (dx * d[0] + dy * d[1] + dz * d[2]) / dist;
      const ang = Math.acos(clamp(cos, -1, 1));
      if (ang < ba) { ba = ang; best = { o, dx, dy, dz, dist }; }
    }
    if (!best) return;
    if (!WORLD.lineClear(C.x, C.y, C.z, best.o.x, best.o.y + 1.2, best.o.z)) return;
    const ty = Math.atan2(best.dx, best.dz), tp = Math.asin(clamp(best.dy / best.dist, -1, 1));
    const k = clamp((IN.firing() ? 5 : 1.6) * dt, 0, 1);
    C.yaw += wrapA(ty - C.yaw) * k;
    C.pitch += (tp - C.pitch) * k * 0.7;
  }

  // =================================================================== bots
  function botThink(b) {
    const ai = b.ai, Z = G.zone, w = weaponOf(b);
    const longGun = b.slots.some(s => s && (s.id === "sniper" || s.id === "dmr"));
    const range = longGun ? 150 : 80;
    // find visible enemies (closest few)
    const cands = [];
    for (const o of G.fighters) {
      if (o === b || !o.alive || o.phase !== "ground") continue;
      const d2 = (o.x - b.x) ** 2 + (o.z - b.z) ** 2;
      if (d2 < range * range) cands.push([d2, o]);
    }
    cands.sort((a, c) => a[0] - c[0]);
    let vis = null;
    for (let i = 0; i < Math.min(3, cands.length); i++) {
      const o = cands[i][1];
      const crouchHide = o.crouch && cands[i][0] > 50 * 50 && Math.random() < 0.5;
      if (!crouchHide && WORLD.lineClear(b.x, eyeY(b), b.z, o.x, o.y + 1.2, o.z)) { vis = o; break; }
    }
    if (vis) {
      if (ai.enemy !== vis) ai.react = G.diff.react * rand(0.7, 1.4);
      ai.enemy = vis; ai.seenT = G.t; ai.lastX = vis.x; ai.lastZ = vis.z;
    } else if (ai.enemy && (G.t - ai.seenT > 5 || !ai.enemy.alive)) ai.enemy = null;
    ai.visible = !!vis;

    const dz = Math.hypot(b.x - Z.x, b.z - Z.z);
    const danger = dz > Z.r - 4 || (Z.mode === "shrink" || (Z.mode === "wait" && Z.t < 20)) && Math.hypot(b.x - Z.nx, b.z - Z.nz) > Z.nr - 6;
    const hasAmmo = w && (w.mag > 0 || b.ammo[WD[w.id].ammo] > 0);
    if (danger && !(ai.visible && dz < Z.r - 10)) {
      ai.mode = "run";
      const tx = Z.mode === "wait" || Z.mode === "shrink" ? Z.nx : Z.x, tz = Z.mode === "wait" || Z.mode === "shrink" ? Z.nz : Z.z;
      const rr = (Z.mode === "done" ? 0 : Math.max(5, (Z.mode === "shrink" || Z.t < 20 ? Z.nr : Z.r) * 0.5));
      if (!ai.goal || ai.goalT < G.t || Math.hypot(ai.goal.x - tx, ai.goal.z - tz) > rr + 5) {
        const a = Math.random() * Math.PI * 2, d = Math.random() * rr;
        ai.goal = { x: tx + Math.cos(a) * d, z: tz + Math.sin(a) * d }; ai.goalT = G.t + 12;
      }
    } else if (ai.enemy && (hasAmmo || (Math.hypot(ai.enemy.x - b.x, ai.enemy.z - b.z) < 3 && !weaponOf(ai.enemy))) &&
      // right after landing bots focus on looting unless they are shot at or someone is in their face
      (G.t - (b.landT || 0) > 18 || G.t - (b.hurtT || -99) < 4 || Math.hypot(ai.enemy.x - b.x, ai.enemy.z - b.z) < 12)) {
      // unarmed bots only brawl other unarmed players up close; otherwise they go find a gun
      ai.mode = "fight";
    } else if (b.hp < 70 && (canUse(b, "medkit") || canUse(b, "bandage")) && G.t - ai.seenT > 3) {
      ai.mode = "heal";
    } else {
      // loot if something useful is close
      const unarmed = !b.slots[0] && !b.slots[1];
      let best = null, bd = (unarmed ? 90 : 45) ** 2;
      for (const o of G.loot) {
        if (o.taken) continue;
        let d2 = (o.x - b.x) ** 2 + (o.z - b.z) ** 2;
        if (d2 > bd) continue;
        let useful = false;
        if (o.kind === "weapon") {
          useful = !b.slots[0] || !b.slots[1] || (RARITY_ORDER.indexOf(WD[o.id].rarity) >= 2 && !b.slots.some(s => s && s.id === o.id));
          if (useful && !b.slots[0] && !b.slots[1]) d2 *= 0.3; // unarmed: guns are top priority
        }
        else if (o.kind === "ammo") useful = b.slots.some(s => s && WD[s.id].ammo === o.type) && b.ammo[o.type] < AMMO[o.type].max * 0.5;
        else if (o.kind === "item") useful = b.items[o.type] < Math.min(3, ITEMS[o.type].max);
        else useful = o.lvl > b[o.kind];
        if (useful) { best = o; bd = d2; }
      }
      if (best) { ai.mode = "loot"; ai.goal = { x: best.x, z: best.z }; ai.goalT = G.t + 8; }
      else {
        ai.mode = "roam";
        if (!ai.goal || ai.goalT < G.t || Math.hypot(ai.goal.x - b.x, ai.goal.z - b.z) < 3) {
          const r = Math.max(10, (Z.mode === "done" ? Z.r : Math.min(Z.r, Z.nr + 30)) * 0.7);
          const a = Math.random() * Math.PI * 2, d = Math.random() * r;
          ai.goal = { x: clamp(Z.nx + Math.cos(a) * d, 10, WORLD.S - 10), z: clamp(Z.nz + Math.sin(a) * d, 10, WORLD.S - 10) };
          ai.goalT = G.t + rand(10, 20);
        }
      }
    }
    // weapon management
    if (w && w.mag <= 0 && b.ammo[WD[w.id].ammo] <= 0) {
      const other = b.cur === 0 ? 1 : 0;
      if (b.slots[other] && (b.slots[other].mag > 0 || b.ammo[WD[b.slots[other].id].ammo] > 0)) { b.cur = other; b.reloadT = 0; }
    }
    if (!w && (b.slots[0] || b.slots[1])) b.cur = b.slots[0] ? 0 : 1;
    if (w && w.mag < WD[w.id].mag * 0.3 && !ai.visible && b.ammo[WD[w.id].ammo] > 0) startReload(b);
    if (ai.mode === "heal" && b.useT <= 0) smartHeal(b);
    if (b.useT <= 0 && b.boost < 30 && canUse(b, "drink") && !ai.visible && Math.random() < 0.2) startUse(b, "drink");
    // grenade at enemies behind cover
    if (ai.enemy && !ai.visible && b.items.grenade > 0 && Math.random() < 0.04) {
      const dx = ai.lastX - b.x, dzz = ai.lastZ - b.z, d = Math.hypot(dx, dzz);
      if (d > 8 && d < 28) { b.yaw = Math.atan2(dx, dzz); throwGrenade(b, dx / d * 0.8, 0.25, dzz / d * 0.8); }
    }
    ai.strafeT -= 0.25;
    if (ai.strafeT <= 0) { ai.strafe = Math.random() < 0.5 ? -1 : 1; ai.strafeT = rand(0.6, 1.8); }
  }

  function updateBot(b, dt) {
    if (b.phase === "plane") {
      b.x = G.plane.x; b.z = G.plane.z; b.y = G.plane.y;
      if (G.plane.t >= b.dropT) leavePlane(b);
      return;
    }
    if (b.phase === "fall") {
      const dx = b.target.x - b.x, dz = b.target.z - b.z, d = Math.hypot(dx, dz);
      updateFall(b, d > 2 ? dx / d : 0, d > 2 ? dz / d : 0, dt, b.y - WORLD.heightAt(b.x, b.z) < 90 && d < 60);
      return;
    }
    const ai = b.ai;
    ai.think -= dt;
    if (ai.think <= 0) { ai.think = rand(0.2, 0.32); botThink(b); }
    b.fireCd -= dt; b.punchT -= dt; ai.react -= dt;
    if (b.reloadT > 0) { b.reloadT -= dt; if (b.reloadT <= 0) finishReload(b); }
    if (b.useT > 0) { b.useT -= dt; if (b.useT <= 0) finishUse(b); }
    b.boost = Math.max(0, b.boost - dt * 1.2);
    if (b.boost > 0) b.hp = Math.min(100, b.hp + dt * 0.8);

    let wx = 0, wz = 0, speed = 4.4;
    const w = weaponOf(b);
    b.crouch = false;
    if (ai.mode === "fight" && ai.enemy) {
      const e = ai.enemy, dx = e.x - b.x, dz = e.z - b.z, d = Math.hypot(dx, dz) || 1;
      b.yaw += wrapA(Math.atan2(dx, dz) - b.yaw) * clamp(9 * dt, 0, 1);
      const pref = !w ? 1 : w.id === "shotgun" ? 7 : w.id === "smg" || w.id === "pistol" ? 14 : w.id === "sniper" || w.id === "dmr" ? 55 : 26;
      const app = d > pref + 4 ? 1 : d < pref - 4 ? -0.7 : 0;
      const [px, pz] = [-dz / d, dx / d];
      wx = (dx / d) * app + px * ai.strafe * 0.8; wz = (dz / d) * app + pz * ai.strafe * 0.8;
      speed = 3.6;
      if (w && (w.id === "sniper" || w.id === "dmr") && d > 25) { wx *= 0.2; wz *= 0.2; b.crouch = true; }
      b.pitch = Math.atan2(e.y + 1.1 - eyeY(b), d);
      // shoot
      if (ai.visible && ai.react <= 0 && b.useT <= 0) {
        if (!w) { if (d < 1.8) punch(b); }
        else if (b.reloadT <= 0 && w.mag > 0 && b.fireCd <= 0) {
          const wd = WD[w.id];
          if (d < wd.range * 1.5) {
            const head = Math.random() < 0.18;
            const ty = e.y + (head ? fHeight(e) - 0.15 : fHeight(e) * 0.55);
            const ex = b.x + 0.0, ey = eyeY(b), ez = b.z;
            let ddx = e.x - ex, ddy = ty - ey, ddz = e.z - ez;
            const l = Math.hypot(ddx, ddy, ddz) || 1;
            const err = G.diff.aim * (1 + d / 55) * (b.moving > 0.4 ? 1.35 : 1) * (e.moving > 0.6 ? 1.25 : 1) + (wd.pellets > 1 ? wd.hip * 0.5 : 0);
            fireWeapon(b, ex, ey, ez, ddx / l, ddy / l, ddz / l, err);
            if (!wd.auto) b.fireCd += rand(0.05, 0.25);
            else if (Math.random() < 0.08) b.fireCd += rand(0.25, 0.6); // burst pauses
          }
        } else if (w.mag <= 0) startReload(b);
      }
    } else if (ai.goal) {
      const dx = ai.goal.x - b.x, dz = ai.goal.z - b.z, d = Math.hypot(dx, dz);
      if (d > 0.8) { wx = dx / d; wz = dz / d; }
      speed = ai.mode === "run" ? 6.4 : ai.mode === "loot" ? 5 : 4.4;
      if (ai.mode === "heal") { wx = wz = 0; b.crouch = true; }
      if (Math.hypot(wx, wz) > 0.1) b.yaw += wrapA(Math.atan2(wx, wz) - b.yaw) * clamp(6 * dt, 0, 1);
      b.pitch = 0;
    }
    // stuck handling: detour sideways and hop
    ai.stuckT += dt;
    if (ai.stuckT > 0.9) {
      const moved = Math.hypot(b.x - ai.lx, b.z - ai.lz);
      if (moved < 0.5 && Math.hypot(wx, wz) > 0.3) { ai.detour = (Math.random() < 0.5 ? -1 : 1) * rand(1, 1.6); if (b.onGround) b.vy = 6; }
      ai.lx = b.x; ai.lz = b.z; ai.stuckT = 0;
    }
    if (ai.detour) {
      const a = Math.atan2(wx, wz) + ai.detour;
      const m = Math.hypot(wx, wz);
      wx = Math.sin(a) * m; wz = Math.cos(a) * m;
      ai.detour *= Math.pow(0.2, dt);
      if (Math.abs(ai.detour) < 0.1) ai.detour = 0;
    }
    if (b.useT > 0) speed *= 0.5;
    physics(b, wx, wz, speed, dt);
    autoPickup(b);
    syncDraw(b);
  }

  // =================================================================== main update
  function update(dt) {
    G.t += dt;
    // plane
    const PL = G.plane;
    if (PL.t < PL.dur) {
      PL.t += dt;
      const k = Math.min(1, PL.t / PL.dur);
      PL.x = lerp(PL.sx, PL.ex, k); PL.z = lerp(PL.sz, PL.ez, k);
      if (PL.t >= PL.dur) for (const f of G.fighters) if (f.phase === "plane") leavePlane(f);
    }
    if (state === "plane" && G.player.phase !== "plane") state = "play";
    if (G.player.phase === "plane") {
      const over = Math.hypot(PL.x - WORLD.center.x, PL.z - WORLD.center.z) < 285;
      $("dropBtn").classList.toggle("off", !over);
      // last chance: leave automatically before the plane flies off the island
      if (PL.t > PL.dur * 0.5 && !over) leavePlane(G.player);
    }
    updateZone(dt);
    updatePlayer(dt);
    for (const f of G.fighters) {
      if (!f.isPlayer && f.alive) updateBot(f, dt);
      if (f.dead) f.deadT += dt;
      if (f.hitT > 0) f.hitT -= dt;
    }
    // zone damage
    G.zoneTick = (G.zoneTick || 0) - dt;
    if (G.zoneTick <= 0) {
      G.zoneTick = 1;
      for (const f of G.fighters) {
        if (!f.alive || f.phase !== "ground" || !outsideZone(f)) continue;
        f.hp -= G.zone.dps;
        f.hitT = 0.15;
        if (f.isPlayer) { SND.sfx("hurt", 0.35); vibrate(20); }
        if (f.hp <= 0) kill(f, null, "🌀", false);
      }
    }
    updateGrenades(dt);
    // effects
    for (const t of G.tracers) t.life -= dt;
    G.tracers = G.tracers.filter(t => t.life > 0);
    for (const p of G.parts) { p.vy -= 9 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.life -= dt; }
    G.parts = G.parts.filter(p => p.life > 0);
    if (G.parts.length > 400) G.parts.splice(0, G.parts.length - 400);
    for (const d of G.dmgNums) { d.t -= dt; d.y += dt * 0.8; }
    G.dmgNums = G.dmgNums.filter(d => d.t > 0);
    for (const i of G.indicators) i.t -= dt;
    G.indicators = G.indicators.filter(i => i.t > 0);
    for (const p of G.pings) p.t -= dt;
    G.pings = G.pings.filter(p => p.t > 0);
    if (G.loot.length > 1400) G.loot = G.loot.filter(o => !o.taken);
    G.shake = Math.max(0, G.shake - dt * 1.5);
    G.hitmT -= dt;
    // last few alive: intense music
    if (G.alive <= 5 && !G.intense && G.player.alive) { G.intense = true; SND.music.start(); SND.music.setIntense(true); toast(`🔥 Only ${G.alive} left!`); }
  }

  // =================================================================== camera + render
  function updateCamera() {
    const C = G.cam;
    let f = G.spec && G.spec.alive ? G.spec : G.player;
    if (G.spec && !G.spec.alive) { const n = G.fighters.find(o => o.alive); if (n) G.spec = f = n; }
    let px, py, pz, dist, sh = 0;
    let yaw = C.yaw, pitch = C.pitch;
    if (G.spec) { yaw = f.yaw; pitch = -0.2; }
    if (f.phase === "plane") { px = G.plane.x; py = G.plane.y + 4; pz = G.plane.z; dist = 30; }
    else if (f.phase === "fall") { px = f.x; py = f.y + 1.5; pz = f.z; dist = f.para ? 9 : 6; }
    else {
      px = f.x; py = eyeY(f) + 0.22 + (f.dead ? -0.6 : 0); pz = f.z;
      dist = G.ads && !G.spec ? 1.8 : 4.3;
      sh = G.ads && !G.spec ? 0.65 : 0.72;
    }
    const cp = Math.cos(pitch), d = [Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp];
    const [rx, rz] = rightOf(yaw);
    const ox = px + rx * sh, oy = py, oz = pz + rz * sh;
    let dd = dist;
    if (f.phase === "ground") {
      const t = WORLD.raycast(ox, oy, oz, -d[0], -d[1], -d[2], dist + 0.3);
      if (t !== Infinity) dd = Math.max(0.35, t - 0.3);
    }
    let cx = ox - d[0] * dd, cy = oy - d[1] * dd, cz = oz - d[2] * dd;
    const gmin = WORLD.heightAt(cx, cz) + 0.3;
    if (cy < gmin) cy = gmin;
    if (G.shake > 0) { cx += rand(-1, 1) * G.shake * 0.15; cy += rand(-1, 1) * G.shake * 0.15; }
    C.x = cx; C.y = cy; C.z = cz; C.dist = dd;
    C.tx = ox + d[0] * 30; C.ty = oy + d[1] * 30; C.tz = oz + d[2] * 30;
    const w = weaponOf(G.player);
    const targetFov = G.ads && w ? 1.2 / WD[w.id].zoom : f.phase === "plane" ? 1.3 : 1.2;
    G.fov += (targetFov - G.fov) * 0.25;
  }

  const MM = M4.create();
  function renderWorld(cam, fov, fighters, extra) {
    R.begin(cam, fov);
    const Wm = WORLD.meshes;
    R.draw(Wm.terrain);
    R.draw(Wm.water, null, [1, 1, 1, 1]);
    R.draw(Wm.statics);
    R.draw(Wm.trees);
    const fogFar = R.fog[1] + 10;
    for (const f of fighters) {
      const d = Math.hypot(f.x - cam.x, f.z - cam.z);
      if (d > fogFar || (f.phase === "plane")) continue;
      if (f.dead && f.deadT > 30) continue;
      // skip fighters behind the camera
      const p = R.project(f.x, f.y + 1, f.z, SW, SH);
      if (!p && d > 4) continue;
      KIT.draw(f, d);
    }
    if (extra) extra();
  }
  function render() {
    const C = G.cam;
    renderWorld(C, G.fov, G.fighters, () => {
      // plane
      const PL = G.plane;
      if (PL.t < PL.dur) { M4.trs(MM, PL.x, PL.y, PL.z, PL.yaw, 0, Math.sin(G.t) * 0.04); R.draw(KIT.plane, MM); }
      // loot
      const tt = G.t;
      for (const o of G.loot) {
        if (o.taken) continue;
        const d = Math.hypot(o.x - C.x, o.z - C.z);
        if (d > 70) continue;
        const rar = lootRarity(o), col = RAR[rar];
        const mesh = o.kind === "weapon" ? KIT.loot.weapon : o.kind === "ammo" ? KIT.loot.ammo : o.kind === "item" ? (o.type === "grenade" ? KIT.loot.grenade : KIT.loot.heal) : KIT.loot.armor;
        M4.trs(MM, o.x, o.y + 0.32 + Math.sin(tt * 2 + o.rot) * 0.06, o.z, o.rot + tt * 0.8, 0, 0);
        R.draw(mesh, MM, null, { emit: [col[0] * 0.35, col[1] * 0.35, col[2] * 0.35] });
        if (o.kind === "weapon" && RARITY_ORDER.indexOf(rar) >= 3 && d < 60) R.dynQuad(o.x, o.y, o.z, o.x, o.y + 6, o.z, 0.12, col);
      }
      // grenades
      for (const g of G.grenades) { M4.trs(MM, g.x, g.y, g.z, g.fuse * 5, g.fuse * 3, 0); R.draw(KIT.grenade, MM); }
      // tracers & particles
      for (const t of G.tracers) R.dynQuad(t.ax, t.ay, t.az, t.bx, t.by, t.bz, 0.025, t.col);
      for (const p of G.parts) R.dynPoint(p.x, p.y, p.z, p.s, p.col);
      R.flushDyn();
      // zone wall (translucent)
      const Z = G.zone;
      R.blend(true); R.cull(false);
      M4.trs(MM, Z.x, -15, Z.z, 0, 0, 0, Math.max(1, Z.r), 190, Math.max(1, Z.r));
      R.draw(KIT.zoneWall, MM, [0.2, 0.45, 1, 0.28], { unlit: true });
      R.blend(false); R.cull(true);
    });
  }
  // lobby: the chosen candidate posing on the island
  function renderLobby(t) {
    if (!preview || preview.code !== selected.code) {
      preview = makeFighter(selected, true, 0);
      // find an open grassy spot with nothing within 7 m so the orbit camera has a clear view
      let spot = WORLD.center;
      for (let i = 0; i < 400; i++) {
        const t = WORLD.towns[i % WORLD.towns.length];
        const x = t.x + rand(-80, 80), z = t.z + rand(-80, 80);
        if (WORLD.heightAt(x, z) < 1.5) continue;
        if (WORLD.query(x - 7, z - 7, x + 7, z + 7, []).length === 0) { spot = { x, z }; break; }
      }
      preview.x = spot.x; preview.z = spot.z; preview.y = WORLD.groundAt(spot.x, spot.z, 99);
      preview.phase = "ground"; preview.onGround = true;
      preview.weapon = "ar"; preview.gunColor = hex(WD.ar.color); preview.vest = 2; preview.helmet = 0;
    }
    const p = preview, a = t * 0.18;
    // the camera swings around slowly; the candidate turns to face it and poses
    p.yaw = a + Math.sin(t * 0.7) * 0.35;
    p.walk = 0; p.moving = 0; p.pitch = Math.sin(t * 0.9) * 0.1;
    const cam = { x: p.x + Math.sin(a) * 4.6, y: p.y + 1.7, z: p.z + Math.cos(a) * 4.6, tx: p.x, ty: p.y + 1.1, tz: p.z };
    renderWorld(cam, 1.0, [p]);
    octx.clearRect(0, 0, SW, SH);
  }

  // =================================================================== overlay (2D)
  function overlay() {
    const c = octx;
    c.clearRect(0, 0, SW, SH);
    const P = G.player, C = G.cam;
    // name tags + health bars of nearby enemies
    c.textAlign = "center"; c.font = "bold 11px sans-serif";
    for (const f of G.fighters) {
      if (f.isPlayer || !f.alive || f.phase === "plane") continue;
      const d = Math.hypot(f.x - C.x, f.z - C.z);
      const show = d < 22 || (f.hitT > 0 && d < 120) || (f.phase === "fall" && d < 120);
      if (!show) continue;
      const p = R.project(f.x, f.y + (f.phase === "fall" && f.para ? 6 : 2.15), f.z, SW, SH);
      if (!p) continue;
      c.fillStyle = "rgba(0,0,0,0.5)"; c.fillRect(p.x - 26, p.y - 2, 52, 5);
      c.fillStyle = f.hp > 50 ? "#f1f5f9" : f.hp > 25 ? "#fde047" : "#ef4444";
      c.fillRect(p.x - 26, p.y - 2, 52 * (f.hp / 100), 5);
      c.fillStyle = "#fff"; c.strokeStyle = "#000"; c.lineWidth = 3;
      c.strokeText(f.name, p.x, p.y - 6); c.fillText(f.name, p.x, p.y - 6);
    }
    // damage numbers
    c.font = "900 16px sans-serif";
    for (const d of G.dmgNums) {
      const p = R.project(d.x, d.y, d.z, SW, SH);
      if (!p) continue;
      c.globalAlpha = Math.min(1, d.t * 2);
      c.lineWidth = 3; c.strokeStyle = "#000";
      c.fillStyle = d.head ? "#ef4444" : "#fde047";
      c.strokeText(d.v, p.x, p.y); c.fillText(d.v, p.x, p.y);
    }
    c.globalAlpha = 1;
    // damage direction indicators
    for (const ind of G.indicators) {
      // yaw grows when turning left, so a positive relative angle means the attacker is on the left
      const ang = -wrapA(ind.a - C.yaw);
      c.save();
      c.translate(SW / 2, SH / 2);
      c.rotate(ang);
      c.globalAlpha = Math.min(1, ind.t);
      c.fillStyle = "#ef4444";
      c.beginPath(); c.moveTo(0, -120); c.lineTo(-22, -96); c.lineTo(22, -96); c.closePath(); c.fill();
      c.restore();
    }
    c.globalAlpha = 1;
    // low HP / outside zone vignette
    const out = P.alive && P.phase === "ground" && outsideZone(P);
    if (P.alive && (P.hp < 30 || out)) {
      const g = c.createRadialGradient(SW / 2, SH / 2, Math.min(SW, SH) * 0.3, SW / 2, SH / 2, Math.max(SW, SH) * 0.7);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, out ? "rgba(37,99,235,0.45)" : "rgba(220,38,38,0.4)");
      c.fillStyle = g; c.fillRect(0, 0, SW, SH);
    }
    // sniper scope
    const w = weaponOf(P);
    if (G.ads && w && WD[w.id].zoom > 2.4 && P.alive) {
      const r = Math.min(SW, SH) * 0.42;
      c.fillStyle = "#000";
      c.beginPath(); c.rect(0, 0, SW, SH); c.arc(SW / 2, SH / 2, r, 0, Math.PI * 2, true); c.fill();
      c.strokeStyle = "#000"; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(SW / 2 - r, SH / 2); c.lineTo(SW / 2 + r, SH / 2); c.moveTo(SW / 2, SH / 2 - r); c.lineTo(SW / 2, SH / 2 + r); c.stroke();
      c.fillStyle = "#ef4444"; c.beginPath(); c.arc(SW / 2, SH / 2, 2, 0, Math.PI * 2); c.fill();
    }
    drawCompass(c);
    drawMinimap(c);
    // touch move stick
    if (IN.mode === "touch" && IN.stick.active) {
      const s = IN.stick;
      c.strokeStyle = "rgba(255,255,255,0.45)"; c.lineWidth = 3;
      c.beginPath(); c.arc(s.ox, s.oy, IN.STICK_R, 0, Math.PI * 2); c.stroke();
      const dx = s.x - s.ox, dy = s.y - s.oy, l = Math.hypot(dx, dy), k = l > IN.STICK_R ? IN.STICK_R / l : 1;
      c.fillStyle = l > IN.STICK_R * 1.25 ? "rgba(250,204,21,0.6)" : "rgba(255,255,255,0.5)";
      c.beginPath(); c.arc(s.ox + dx * k, s.oy + dy * k, 26, 0, Math.PI * 2); c.fill();
    } else if (IN.mode === "touch" && state === "play") {
      c.globalAlpha = 0.35; c.strokeStyle = "#fff"; c.lineWidth = 3;
      c.beginPath(); c.arc(110, SH - 130, IN.STICK_R, 0, Math.PI * 2); c.stroke();
      c.fillStyle = "#fff"; c.font = "bold 11px sans-serif"; c.textAlign = "center";
      c.fillText("MOVE", 110, SH - 130 + 4);
      c.globalAlpha = 1;
    }
    if (S.fps) { c.fillStyle = "#0f0"; c.font = "12px monospace"; c.textAlign = "left"; c.fillText(`${fps} fps`, 8, SH - 8); }
  }
  function drawCompass(c) {
    const w = Math.min(360, SW * 0.5), x0 = SW / 2 - w / 2, y = 52;
    c.fillStyle = "rgba(0,0,0,0.35)"; c.fillRect(x0, y, w, 20);
    // bearing clockwise from map-north (-z) toward east (+x)
    let h = Math.atan2(Math.sin(G.cam.yaw), -Math.cos(G.cam.yaw)) * 180 / Math.PI;
    h = (h + 360) % 360;
    c.save(); c.beginPath(); c.rect(x0, y, w, 20); c.clip();
    c.textAlign = "center"; c.font = "bold 11px sans-serif";
    for (let a = Math.ceil((h - 90) / 15) * 15; a <= h + 90; a += 15) {
      const sx = SW / 2 + ((a - h) / 90) * (w / 2);
      const v = ((a % 360) + 360) % 360;
      const lbl = { 0: "N", 90: "E", 180: "S", 270: "W" }[v];
      c.fillStyle = lbl ? "#facc15" : "#fff";
      c.fillText(lbl || (v % 45 === 0 ? String(v) : "·"), sx, y + 14);
    }
    c.restore();
    c.fillStyle = "#fff"; c.fillRect(SW / 2 - 1, y + 18, 2, 6);
  }
  function drawMinimap(c) {
    const size = Math.min(150, SW * 0.3), x0 = 10, y0 = 10 + (IN.mode === "touch" ? 0 : 0);
    const P = G.spec || G.player, viewR = 110;
    const S0 = WORLD.S, img = WORLD.mapImage, k = img.width / S0;
    c.save();
    c.beginPath(); c.rect(x0, y0, size, size); c.clip();
    c.fillStyle = "#1e3a5f"; c.fillRect(x0, y0, size, size);
    const px = P.phase === "plane" ? G.plane.x : P.x, pz = P.phase === "plane" ? G.plane.z : P.z;
    const sx = (px - viewR) * k, sz = (pz - viewR) * k, sw = viewR * 2 * k;
    c.drawImage(img, sx, sz, sw, sw, x0, y0, size, size);
    const toM = (x, z) => [x0 + ((x - (px - viewR)) / (viewR * 2)) * size, y0 + ((z - (pz - viewR)) / (viewR * 2)) * size];
    const sc = size / (viewR * 2);
    const Z = G.zone;
    let [zx, zy] = toM(Z.x, Z.z);
    c.strokeStyle = "#60a5fa"; c.lineWidth = 2; c.beginPath(); c.arc(zx, zy, Z.r * sc, 0, Math.PI * 2); c.stroke();
    if (Z.mode !== "done") { [zx, zy] = toM(Z.nx, Z.nz); c.strokeStyle = "#fff"; c.lineWidth = 1.5; c.beginPath(); c.arc(zx, zy, Z.nr * sc, 0, Math.PI * 2); c.stroke(); }
    for (const p of G.pings) { const [mx, my] = toM(p.x, p.z); c.fillStyle = `rgba(239,68,68,${p.t})`; c.beginPath(); c.arc(mx, my, 3, 0, Math.PI * 2); c.fill(); }
    if (G.plane.t < G.plane.dur) {
      const [ax, ay] = toM(G.plane.sx, G.plane.sz), [bx, by] = toM(G.plane.ex, G.plane.ez);
      c.strokeStyle = "rgba(255,255,255,0.6)"; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke(); c.setLineDash([]);
    }
    // player arrow
    const [mx, my] = toM(px, pz);
    const a = G.spec ? P.yaw : G.cam.yaw;
    c.translate(mx, my); c.rotate(-a + Math.PI);
    c.fillStyle = "#facc15"; c.beginPath(); c.moveTo(0, -7); c.lineTo(5, 5); c.lineTo(-5, 5); c.closePath(); c.fill();
    c.restore();
    c.strokeStyle = "rgba(255,255,255,0.4)"; c.lineWidth = 1; c.strokeRect(x0, y0, size, size);
    // nearest town name
    const t = WORLD.towns.reduce((b, t2) => (Math.hypot(t2.x - px, t2.z - pz) < Math.hypot(b.x - px, b.z - pz) ? t2 : b), WORLD.towns[0]);
    if (t && Math.hypot(t.x - px, t.z - pz) < 60) { c.fillStyle = "#fff"; c.font = "bold 11px sans-serif"; c.textAlign = "left"; c.fillText("📍 " + t.name, x0 + 4, y0 + size + 14); }
  }
  function drawFullMap() {
    const cv = $("mapCanvas");
    const size = Math.round(cv.getBoundingClientRect().width * ODPR) || 600;
    if (cv.width !== size) { cv.width = size; cv.height = size; }
    const c = cv.getContext("2d"), k = size / WORLD.S;
    c.drawImage(WORLD.mapImage, 0, 0, size, size);
    const Z = G.zone;
    c.strokeStyle = "#60a5fa"; c.lineWidth = 3 * ODPR; c.beginPath(); c.arc(Z.x * k, Z.z * k, Z.r * k, 0, Math.PI * 2); c.stroke();
    if (Z.mode !== "done") { c.strokeStyle = "#fff"; c.lineWidth = 2 * ODPR; c.beginPath(); c.arc(Z.nx * k, Z.nz * k, Z.nr * k, 0, Math.PI * 2); c.stroke(); }
    if (G.plane.t < G.plane.dur) {
      c.strokeStyle = "rgba(255,255,255,0.8)"; c.setLineDash([8, 8]); c.lineWidth = 2 * ODPR;
      c.beginPath(); c.moveTo(G.plane.sx * k, G.plane.sz * k); c.lineTo(G.plane.ex * k, G.plane.ez * k); c.stroke(); c.setLineDash([]);
      c.fillStyle = "#fff"; c.font = `${16 * ODPR}px sans-serif`; c.fillText("✈️", G.plane.x * k - 8, G.plane.z * k + 6);
    }
    c.font = `bold ${12 * ODPR}px sans-serif`; c.textAlign = "center";
    for (const t of WORLD.towns) { c.fillStyle = "#000"; c.fillText(t.name, t.x * k + 1, t.z * k + 1); c.fillStyle = "#fff"; c.fillText(t.name, t.x * k, t.z * k); }
    const P = G.player;
    const px = P.phase === "plane" ? G.plane.x : P.x, pz = P.phase === "plane" ? G.plane.z : P.z;
    c.save(); c.translate(px * k, pz * k); c.rotate(-G.cam.yaw + Math.PI);
    c.fillStyle = "#facc15"; c.strokeStyle = "#000"; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, -12 * ODPR); c.lineTo(8 * ODPR, 8 * ODPR); c.lineTo(-8 * ODPR, 8 * ODPR); c.closePath(); c.fill(); c.stroke();
    c.restore();
  }

  // =================================================================== HUD (DOM)
  const hc = {};
  function setT(id, v) { if (hc[id] !== v) { hc[id] = v; $(id).textContent = v; } }
  function setC(el, cls, on) { el.classList.toggle(cls, !!on); }
  function hud() {
    const P = G.player, Z = G.zone;
    setT("aliveN", String(G.alive));
    setT("killsN", String(P.kills));
    const zt = Math.max(0, Math.ceil(Z.t));
    setT("zoneT", Z.mode === "done" ? "FINAL" : `${Math.floor(zt / 60)}:${String(zt % 60).padStart(2, "0")}`);
    setT("zoneL", Z.mode === "shrink" ? "shrinking" : Z.mode === "done" ? "zone" : "until shrink");
    setC($("zonePill"), "shrink", Z.mode === "shrink");
    $("hpfill").style.width = Math.max(0, P.hp) + "%";
    setC($("hpfill"), "mid", P.hp <= 60 && P.hp > 30);
    setC($("hpfill"), "low", P.hp <= 30);
    setT("hptext", String(Math.max(0, Math.ceil(P.hp))));
    $("boostfill").style.width = P.boost + "%";
    const v = $("vestI"), h = $("helmI");
    v.className = "armor " + (P.vest ? "l" + P.vest : "off"); setT("vestI", P.vest ? `🦺 Lv.${P.vest}` : "🦺 —");
    h.className = "armor " + (P.helmet ? "l" + P.helmet : "off"); setT("helmI", P.helmet ? `⛑️ Lv.${P.helmet}` : "⛑️ —");
    document.querySelectorAll("#slots .slot").forEach((el, i) => {
      const s = P.slots[i];
      const key = s ? `${s.id}|${s.mag}|${P.ammo[WD[s.id].ammo]}|${P.cur === i}` : `empty|${P.cur === i}`;
      if (el.dataset.k === key) return;
      el.dataset.k = key;
      el.className = "slot" + (P.cur === i ? " on" : "") + (s ? " r-" + WD[s.id].rarity : "");
      el.querySelector(".wname").textContent = s ? WD[s.id].short : "EMPTY";
      el.querySelector(".wammo").textContent = s ? `${s.mag} / ${P.ammo[WD[s.id].ammo]}` : "";
    });
    const w = weaponOf(P);
    setT("magT", w ? (P.reloadT > 0 ? "··" : String(w.mag)) : "👊");
    setT("resT", w ? `${AMMO[WD[w.id].ammo].icon} ${P.ammo[WD[w.id].ammo]}` : "fists");
    setC($("ammoBox"), "low", w && w.mag <= Math.ceil(WD[w.id].mag * 0.2));
    setT("bandC", String(P.items.bandage)); setT("medC", String(P.items.medkit)); setT("drinkC", String(P.items.drink)); setT("grenC", String(P.items.grenade));
    setT("grenC2", String(P.items.grenade)); setT("healC2", String(P.items.bandage + P.items.medkit)); setT("drinkC2", String(P.items.drink));
    // use / reload bar
    const ub = $("usebar");
    if (P.alive && (P.useT > 0 || P.reloadT > 0)) {
      ub.classList.remove("hidden");
      const tot = P.useT > 0 ? P.useMax : WD[w ? w.id : "pistol"].reload, left = P.useT > 0 ? P.useT : P.reloadT;
      $("usefill").style.width = (100 * (1 - left / tot)) + "%";
      setT("usetext", P.useT > 0 ? `${ITEMS[P.useItem].icon} Using ${ITEMS[P.useItem].name}… ${left.toFixed(1)}s` : `↻ Reloading… ${left.toFixed(1)}s`);
    } else ub.classList.add("hidden");
    // pickup prompt
    const near = P.alive && P.phase === "ground" ? nearestWeaponLoot(P) : null;
    const pr = $("prompt"), pb = $("pickBtn");
    if (near) {
      const full = P.slots[0] && P.slots[1];
      const txt = `${lootLabel(near)}${full ? " (swap)" : ""}`;
      if (IN.mode === "touch") { pr.classList.add("hidden"); pb.classList.remove("hidden"); setT("pickBtn", `✋ ${WD[near.id].short}${full ? " ⇄" : ""}`); }
      else { pb.classList.add("hidden"); pr.classList.remove("hidden"); setT("prompt", `[${IN.mode === "gamepad" ? "X" : "E"}] Pick up ${txt}`); }
    } else { pr.classList.add("hidden"); pb.classList.add("hidden"); }
    $("zoneWarn").classList.toggle("hidden", !(P.alive && P.phase === "ground" && outsideZone(P)));
    // crosshair spread
    const cr = $("cross");
    setC(cr, "hide", !P.alive || P.phase !== "ground" || (G.ads && w && WD[w.id].zoom > 2.4));
    const spread = w ? (G.ads ? WD[w.id].ads : WD[w.id].hip) * (P.moving > 0.3 ? 1.6 : 1) + G.bloom : 1;
    const gap = 4 + spread * 6;
    cr.children[0].style.top = (-gap - 8) + "px"; cr.children[1].style.top = gap + "px";
    cr.children[2].style.left = (-gap - 8) + "px"; cr.children[3].style.left = gap + "px";
    const hm = $("hitm");
    if (G.hitmT > 0) { hm.classList.remove("hidden"); hm.className = G.hitmKind || ""; } else hm.classList.add("hidden");
    setC($("touch").querySelector(".crouch"), "on", P.crouch);
    if (G.mapOpen) drawFullMap();
  }
  let centerTimer = null;
  function center(msg, sub, secs = 2) {
    const el = $("centerMsg");
    el.innerHTML = `${esc(msg)}${sub ? `<small>${esc(sub)}</small>` : ""}`;
    el.classList.remove("hidden");
    clearTimeout(centerTimer);
    centerTimer = setTimeout(() => el.classList.add("hidden"), secs * 1000);
  }
  let toastTimer = null;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add("hidden"), 1800);
  }
  IN.on("toast", toast);
  function feed(html, me) {
    const el = document.createElement("div");
    el.innerHTML = html;
    if (me) el.className = "me";
    const f = $("feed");
    f.prepend(el);
    while (f.children.length > 5) f.lastChild.remove();
    setTimeout(() => el.remove(), 6000);
  }

  // =================================================================== screens
  const SCREENS = ["lobby", "chars", "settings", "howto", "pause", "results", "loading"];
  function hideScreens() { SCREENS.forEach(s => $(s).classList.add("hidden")); }
  function show(id) { hideScreens(); $(id).classList.remove("hidden"); const p = $(id).querySelector("[data-primary]"); if (p && IN.mode !== "touch") p.focus({ preventScroll: true }); }
  let backTo = "lobby";
  function toLobby() {
    state = "lobby";
    G = null;
    exitLock();
    $("hud").classList.add("hidden");
    $("mapFull").classList.add("hidden");
    $("specBar").classList.add("hidden");
    renderCandidate();
    renderLobbyStats();
    show("lobby");
    SND.music.start();
    SND.music.setIntense(false);
  }
  function renderCandidate() {
    const c = selected;
    $("candCard").innerHTML = `
      <div class="top"><img src="${BR.flagUrl(c.code)}" alt=""><div><div class="nm">${esc(c.name)}</div><div class="pt">${esc(c.party)}</div></div></div>
      <div class="ph">“${esc(c.phrase)}”</div>
      <div class="row2"><button class="big secondary" id="voiceBtn">🔊 Voice</button><button class="big secondary" id="changeBtn">🌍 Change</button></div>`;
    $("voiceBtn").onclick = () => { SND.init(); speakAs(c, c.phrase, true); };
    $("changeBtn").onclick = openChars;
    $("diffSeg").innerHTML = Object.entries(BR3.DIFF).map(([k, d]) => `<button data-d="${k}" class="${S.diff === k ? "on" : ""}">${d.label}</button>`).join("");
  }
  function renderLobbyStats() {
    $("lobbyStats").innerHTML = `<div>🏆 Wins <b>${STATS.wins}</b></div><div>🎮 Matches <b>${STATS.matches}</b></div><div>💀 Kills <b>${STATS.kills}</b></div><div>🥇 Best <b>${STATS.best ? "#" + STATS.best : "—"}</b></div><div>🔟 Top 10 <b>${STATS.top10}</b></div>`;
  }
  let charTab = "All", charQ = "";
  function openChars() {
    $("charTabs").innerHTML = ["All", "⭐ Featured", ...BR.REGIONS].map(t => `<button data-t="${esc(t)}" class="${t === charTab ? "on" : ""}">${esc(t)}</button>`).join("");
    renderCharGrid();
    show("chars");
    const on = $("charGrid").querySelector(".on");
    if (on) on.scrollIntoView({ block: "center" });
  }
  function renderCharGrid() {
    const q = charQ.trim().toLowerCase();
    const list = BR.CHARACTERS.filter(c => (charTab === "All" || (charTab === "⭐ Featured" && c.featured) || c.region === charTab) && (!q || c.name.toLowerCase().includes(q) || c.party.toLowerCase().includes(q)));
    $("charCount").textContent = `${list.length} candidates`;
    $("charGrid").innerHTML = list.map(c => `<button class="cc${c === selected ? " on" : ""}" data-code="${c.code}"><span class="m">${c.mascot}</span><img loading="lazy" src="${BR.flagUrl(c.code)}" alt=""><span class="n">${esc(c.name)}</span><span class="p">${esc(c.party)}</span></button>`).join("");
  }
  function showResults(won) {
    exitLock();
    const P = G.player;
    const secs = Math.round((performance.now() - G.startT) / 1000);
    if (!G.saved) {
      G.saved = true;
      STATS.matches++; STATS.kills += P.kills; STATS.dmg += Math.round(P.dmg);
      if (won) STATS.wins++;
      if (G.placement <= 10) STATS.top10++;
      if (!STATS.best || G.placement < STATS.best) STATS.best = G.placement;
      store.set("stats", STATS);
    }
    const pl = $("rPlace");
    pl.className = "place" + (won ? " win" : "");
    pl.innerHTML = `#${G.placement}<small>/${N_PLAYERS}</small>`;
    $("rTitle").textContent = won ? "🏆 BOOYAH! WINNER WINNER, AURA DINNER" : G.placement <= 10 ? "So close! Top 10 🔥" : "You got ratio'd 💀";
    $("rSub").textContent = won ? `${selected.name} has been elected!` : G.killer ? `Eliminated by ${G.killer.name}` : "The zone got you.";
    $("rStats").innerHTML = `<div>💀 Kills: <b>${P.kills}</b></div><div>💥 Damage: <b>${Math.round(P.dmg)}</b></div>
      <div>⏱️ Survived: <b>${Math.floor(secs / 60)}m ${secs % 60}s</b></div><div>👥 Placement: <b>#${G.placement}</b></div>`;
    $("specBtn").classList.toggle("hidden", won || G.alive < 1);
    $("specBar").classList.add("hidden");
    show("results");
  }

  // =================================================================== pointer lock + pause
  function requestLock() {
    if (IN.mode !== "desktop") return;
    try { const r = glc.requestPointerLock && glc.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* not allowed */ }
  }
  function exitLock() { if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock(); }
  let lockedOnce = false;
  document.addEventListener("pointerlockchange", () => {
    if (document.pointerLockElement === glc) {
      lockedOnce = true;
      // a lock request can resolve late (e.g. after pausing or opening a menu): give the mouse back
      if (!(state === "play" || state === "plane") || (G && G.mapOpen)) exitLock();
      return;
    }
    if ((state === "play" || state === "plane") && lockedOnce && IN.mode === "desktop" && !G.mapOpen) pause();
  });
  function pause() {
    if (state !== "play" && state !== "plane") return;
    prevState = state;
    state = "paused";
    IN.clear();
    exitLock(); // free the mouse so the menu buttons can be clicked
    $("pauseInfo").textContent = `${G.alive} players left · ${G.player.kills} kills`;
    show("pause");
  }
  function resume() {
    if (state !== "paused") return;
    state = prevState || "play";
    hideScreens();
    requestLock();
  }
  document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); });

  // =================================================================== input wiring
  IN.attach(glc);
  IN.bindButtons($("hud"));
  IN.on("wantLock", () => { if (state === "play" || state === "plane") requestLock(); });
  const playing = () => (state === "play" || state === "plane") && G && G.player.alive;
  IN.on("jump", () => {
    if (!playing()) return;
    const P = G.player;
    if (P.phase === "plane") {
      if (Math.hypot(G.plane.x - WORLD.center.x, G.plane.z - WORLD.center.z) > 285) { toast("🌊 Wait until you're over the island!"); return; }
      leavePlane(P);
    }
    else if (P.phase === "fall") { if (!P.para) { P.para = true; SND.sfx("wind"); } }
    else if (P.onGround) { P.vy = 6.2; P.onGround = false; P.crouch = false; }
  });
  IN.on("crouch", () => { if (playing() && G.player.phase === "ground") G.player.crouch = !G.player.crouch; });
  IN.on("reload", () => { if (playing()) startReload(G.player); });
  IN.on("interact", () => {
    if (!playing()) return;
    const o = nearestWeaponLoot(G.player);
    if (o) giveWeapon(G.player, o);
  });
  const selSlot = i => { if (!playing()) return; const P = G.player; if (P.slots[i] && P.cur !== i) { P.cur = i; P.reloadT = 0; P.fireCd = 0.35; SND.sfx("pick", 0.5); } };
  IN.on("slot0", () => selSlot(0));
  IN.on("slot1", () => selSlot(1));
  IN.on("holster", () => { if (playing()) G.player.cur = -1; });
  IN.on("cycle", () => { if (!playing()) return; const P = G.player; const n = P.cur === 0 ? 1 : 0; if (P.slots[n]) selSlot(n); });
  IN.on("grenade", () => { if (playing() && G.player.phase === "ground") { const d = camDir(); throwGrenade(G.player, d[0], d[1] + 0.15, d[2]); } });
  IN.on("heal", () => { if (playing() && !smartHeal(G.player)) toast(G.player.hp >= 75 && G.player.items.medkit === 0 ? "Bandages only heal up to 75" : "Nothing to heal with"); });
  IN.on("drink", () => { if (playing() && !startUse(G.player, "drink")) toast("No energy drink (or boost full)"); });
  IN.on("aim", () => { if (playing()) G.adsToggle = !G.adsToggle; });
  IN.on("map", toggleMap);
  IN.on("pause", () => (state === "paused" ? resume() : pause()));
  IN.on("escape", () => { if (G && G.mapOpen) toggleMap(); else if (state === "paused") resume(); });
  function toggleMap() {
    if (!G || !(state === "play" || state === "plane" || state === "dead")) return;
    G.mapOpen = !G.mapOpen;
    $("mapFull").classList.toggle("hidden", !G.mapOpen);
    if (G.mapOpen) { exitLock(); drawFullMap(); } else requestLock();
  }
  $("mapBtn").onclick = toggleMap;
  $("mapClose").onclick = toggleMap;
  $("pauseBtn").onclick = () => (state === "paused" ? resume() : pause());
  document.querySelectorAll("#slots .slot").forEach(el => {
    const fn = e => { e.preventDefault(); e.stopPropagation(); selSlot(+el.dataset.slot); };
    el.addEventListener("touchstart", fn, { passive: false });
    el.addEventListener("mousedown", fn);
  });

  // menus
  const onClick = (id, fn) => $(id).addEventListener("click", e => { SND.init(); SND.sfx("click"); fn(e); });
  onClick("playBtn", startMatch);
  onClick("charsBtn", openChars);
  onClick("setBtn", () => { backTo = "lobby"; openSettings(); });
  onClick("howBtn", () => { $("wLegend").innerHTML = Object.values(WD).map(w => `<div>${w.icon} <b>${esc(w.name)}</b>: ${w.dmg}${w.pellets > 1 ? "×" + w.pellets : ""} dmg · ${w.rpm} rpm · mag ${w.mag} · <i>${BR3.RARITY[w.rarity].label}</i></div>`).join(""); show("howto"); });
  onClick("resumeBtn", resume);
  onClick("pauseSet", () => { backTo = "pause"; openSettings(); });
  onClick("quitBtn", toLobby);
  onClick("againBtn", startMatch);
  onClick("lobbyBtn", toLobby);
  onClick("specBtn", () => {
    G.spec = G.killer && G.killer.alive ? G.killer : G.fighters.find(f => f.alive);
    hideScreens();
    $("specBar").classList.remove("hidden");
    $("specName").textContent = "👁️ " + (G.spec ? G.spec.name : "");
  });
  onClick("specNext", () => {
    const alive = G.fighters.filter(f => f.alive);
    if (!alive.length) return;
    const i = alive.indexOf(G.spec);
    G.spec = alive[(i + 1) % alive.length];
    $("specName").textContent = "👁️ " + G.spec.name;
  });
  onClick("specLeave", () => { G.spec = null; showResults(false); });
  document.querySelectorAll("[data-back]").forEach(b => b.addEventListener("click", () => {
    SND.sfx("click");
    const scr = b.closest(".screen").id;
    if (scr === "settings" && backTo === "pause") show("pause"); else { show("lobby"); renderCandidate(); }
  }));
  $("diffSeg").addEventListener("click", e => { const b = e.target.closest("[data-d]"); if (!b) return; S.diff = b.dataset.d; applySettings(); renderCandidate(); });
  $("charTabs").addEventListener("click", e => { const b = e.target.closest("[data-t]"); if (!b) return; charTab = b.dataset.t; openChars(); });
  $("charSearch").addEventListener("input", e => { charQ = e.target.value; renderCharGrid(); });
  $("charGrid").addEventListener("click", e => {
    const b = e.target.closest(".cc");
    if (!b) return;
    selected = BR.CHARACTERS.find(c => c.code === b.dataset.code);
    S.char = selected.code; applySettings();
    SND.init(); speakAs(selected, selected.phrase, true);
    renderCharGrid();
    setTimeout(() => { show("lobby"); renderCandidate(); }, 250);
  });
  function openSettings() {
    $("sSens").value = S.sens; $("sAssist").checked = S.assist; $("sInvert").checked = S.invert;
    $("sMusic").value = S.music; $("sSfx").value = S.sfx; $("sVoice").value = S.voice; $("sVib").checked = S.vib; $("sFps").checked = S.fps;
    document.querySelectorAll("#sQuality button").forEach(b => b.classList.toggle("on", b.dataset.v === S.quality));
    show("settings");
  }
  [["sSens", "sens"], ["sMusic", "music"], ["sSfx", "sfx"], ["sVoice", "voice"]].forEach(([id, k]) => $(id).addEventListener("input", e => { S[k] = +e.target.value; applySettings(); }));
  [["sAssist", "assist"], ["sInvert", "invert"], ["sVib", "vib"], ["sFps", "fps"]].forEach(([id, k]) => $(id).addEventListener("change", e => { S[k] = e.target.checked; applySettings(); }));
  $("sQuality").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; S.quality = b.dataset.v; applySettings(); openSettings(); });
  addEventListener("pointerdown", () => SND.init(), { passive: true });

  // =================================================================== loop
  let last = performance.now(), fps = 60, fpsAcc = 0, fpsN = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    fpsAcc += dt; fpsN++;
    if (fpsAcc > 0.5) { fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
    IN.poll(dt);
    try {
      if (state === "lobby" || state === "loading") { if (WORLD) renderLobby(now / 1000); }
      else if (G) {
        if (state === "play" || state === "plane" || state === "dead" || state === "over") update(dt);
        updateCamera();
        render();
        overlay();
        hud();
      }
    } catch (err) {
      console.error(err);
      if (!frame.reported) { frame.reported = true; toast("⚠️ " + err.message); }
    }
    requestAnimationFrame(frame);
  }

  // =================================================================== boot
  applySettings();
  setTimeout(() => {
    try {
      WORLD = BR3.buildWorld((Math.random() * 1e9) | 0, R, S.quality);
    } catch (e) {
      $("loadMsg").textContent = "Failed to build the world: " + e.message;
      console.error(e);
      return;
    }
    $("loading").classList.add("hidden");
    toLobby();
  }, 30);
  requestAnimationFrame(frame);

  // debug/test hook: fast-forward the simulation by `secs` seconds
  const sim = secs => { for (let t = 0; t < secs && G && !G.over; t += 1 / 30) update(1 / 30); };
  window.__br = { get G() { return G; }, get state() { return state; }, get WORLD() { return WORLD; }, S, startMatch, sim };
})();
