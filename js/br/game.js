// Brainrot Royale 3D: player control, frame loop, camera, rendering, HUD, lobby scene, navigation, input wiring.
(() => {
  "use strict";
  const BR3 = window.BR3, BR = window.BR, SND = BR.Audio, IN = BR3.Input, X = BR3.X;
  if (!X.R) return;
  const { M4, hex } = BR3;
  const { $, clamp, rand, pick, lerp, wrapA, esc, fwd, rightOf } = X;
  const WD = BR3.WEAPONS, AMMO = BR3.AMMO, ITEMS = BR3.ITEMS, ARMOR = BR3.ARMOR, PROG = BR3.Progress;
  const R = X.R, KIT = X.KIT, glc = X.glc, octx = X.octx;
  const G_ = () => X.G;

  // =================================================================== player
  const camDir = () => { const C = X.G.cam, cp = Math.cos(C.pitch); return [Math.sin(C.yaw) * cp, Math.sin(C.pitch), Math.cos(C.yaw) * cp]; };
  function updatePlayer(dt) {
    const G = X.G, P = G.player, C = G.cam;
    const L = IN.takeLook();
    const zoomS = G.ads ? 1 / WD[(X.weaponOf(P) || { id: "pistol" }).id].zoom : 1;
    C.yaw -= L.dx * zoomS;
    C.pitch = clamp(C.pitch - L.dy * zoomS, -1.15, 0.9);
    if (!P.alive) return;
    const mv = IN.move();
    const [fx, fz] = fwd(C.yaw), [rx, rz] = rightOf(C.yaw);
    const wx = fx * mv.y + rx * mv.x, wz = fz * mv.y + rz * mv.x;
    if (P.phase === "plane") { P.x = G.plane.x; P.z = G.plane.z; P.y = G.plane.y; return; }
    if (P.phase === "fall") { X.updateFall(P, wx, wz, dt, false); return; }

    const slot = X.weaponOf(P), w = slot ? WD[slot.id] : null;
    const buyPhase = G.cs && G.cs.phase === "buy";
    G.ads = !!(w && !P.knocked && (IN.aiming() || G.adsToggle) && P.useT <= 0 && P.reloadT <= 0);
    $("touch").querySelector(".aim").classList.toggle("on", G.ads);
    let speed = 4.6;
    const sprint = IN.sprint() && mv.y > 0.3 && !G.ads && P.useT <= 0 && !P.crouch;
    if (sprint) speed = 6.7;
    if (P.crouch) speed = 2.5;
    if (G.ads) speed = 2.9;
    if (P.useT > 0) speed *= 0.55;
    if (P.knocked) speed = 1.1;
    if (P.reviveOf) speed = 0;
    X.physics(P, wx, wz, speed * (P.knocked ? 1 : X.speedMul(P)), dt);
    const targetYaw = (w && !P.knocked) || IN.firing() ? C.yaw : (Math.hypot(wx, wz) > 0.1 ? Math.atan2(wx, wz) : P.yaw);
    P.yaw += wrapA(targetYaw - P.yaw) * clamp(14 * dt, 0, 1);
    P.pitch = C.pitch;
    if (P.knocked) { X.syncDraw(P); return; }

    if (X.S.assist && IN.mode !== "desktop" && w) aimAssist(dt);
    P.fireCd -= dt; P.punchT -= dt;
    if (P.reloadT > 0) { P.reloadT -= dt; if (P.reloadT <= 0) X.finishReload(P); }
    if (P.useT > 0) { P.useT -= dt; if (P.useT <= 0) X.finishUse(P); }
    G.bloom = Math.max(0, G.bloom - dt * 6);
    if (P.emote) P.emote.t += dt;

    // hold to revive a knocked teammate
    const km = X.nearestKnockedMate(P);
    if (km && IN.holdUse()) {
      if (P.reviveOf !== km) { P.reviveOf = km; P.reviveT = 0; }
      P.reviveT += dt;
      if (P.reviveT >= X.reviveTime(P)) X.revive(km, P);
    } else { P.reviveOf = null; P.reviveT = 0; }

    // firing
    const want = IN.firing() && !buyPhase && !P.reviveOf;
    if (want && G.mapOpen) { /* ignore */ }
    else if (want && P.useT > 0 && !G.prevFire) { P.useT = 0; P.useItem = null; }
    else if (want && !w) { if (!G.prevFire || P.punchT <= 0) X.punch(P); }
    else if (want && w && P.useT <= 0) {
      if (P.reloadT > 0) { /* reloading */ }
      else if (slot.mag <= 0) { if (!G.prevFire) { SND.sfx("empty"); X.startReload(P); } }
      else if (P.fireCd <= 0 && (w.auto || !G.prevFire)) {
        let spread = G.ads ? w.ads : w.hip;
        spread *= P.moving > 0.3 ? 1.6 : 1;
        if (P.crouch) spread *= 0.75;
        if (!P.onGround) spread *= 2.2;
        spread += G.bloom;
        const d = camDir(), c = G.cam;
        X.fireWeapon(P, c.x + d[0] * (c.dist + 0.4), c.y + d[1] * (c.dist + 0.4), c.z + d[2] * (c.dist + 0.4), d[0], d[1], d[2], spread);
        const rk = G.ads ? 0.6 : 1;
        C.pitch = clamp(C.pitch + w.recoil * 0.012 * rk, -1.15, 0.9);
        C.yaw += rand(-1, 1) * w.recoil * 0.005 * rk;
        G.bloom = Math.min(4, G.bloom + w.recoil * 0.35);
        G.shake = Math.max(G.shake, w.recoil * 0.03);
      }
    }
    G.prevFire = IN.firing();
    P.boost = Math.max(0, P.boost - dt * 1.2);
    if (P.boost > 0) P.hp = Math.min(100, P.hp + dt * (P.boost > 50 ? 1.6 : 0.8));
    X.autoPickup(P);
    X.syncDraw(P);
  }
  function aimAssist(dt) {
    const G = X.G, C = G.cam, d = camDir();
    let best = null, ba = 0.1;
    for (const o of G.fighters) {
      if (!X.enemies(o, G.player) || !o.alive || o.phase !== "ground") continue;
      const dx = o.x - C.x, dy = o.y + (o.knocked ? 0.4 : 1.2) - C.y, dz = o.z - C.z, dist = Math.hypot(dx, dy, dz);
      if (dist > 90) continue;
      const ang = Math.acos(clamp((dx * d[0] + dy * d[1] + dz * d[2]) / dist, -1, 1));
      if (ang < ba) { ba = ang; best = { o, dx, dy, dz, dist }; }
    }
    if (!best || !X.WORLD.lineClear(C.x, C.y, C.z, best.o.x, best.o.y + 1.1, best.o.z)) return;
    const ty = Math.atan2(best.dx, best.dz), tp = Math.asin(clamp(best.dy / best.dist, -1, 1));
    const k = clamp((IN.firing() ? 5 : 1.6) * dt, 0, 1);
    C.yaw += wrapA(ty - C.yaw) * k;
    C.pitch += (tp - C.pitch) * k * 0.7;
  }

  // =================================================================== update
  function update(dt) {
    const G = X.G, P = G.player, PL = G.plane;
    G.t += dt;
    if (PL.dur > 0 && PL.t < PL.dur) {
      PL.t += dt;
      const k = Math.min(1, PL.t / PL.dur);
      PL.x = lerp(PL.sx, PL.ex, k); PL.z = lerp(PL.sz, PL.ez, k);
      if (PL.t >= PL.dur) for (const f of G.fighters) if (f.phase === "plane") X.leavePlane(f);
    }
    if (X.state === "plane" && P.phase !== "plane") X.state = "play";
    if (P.phase === "plane") {
      const over = Math.hypot(PL.x - X.WORLD.center.x, PL.z - X.WORLD.center.z) < 285;
      $("dropBtn").classList.toggle("off", !over);
      if (PL.t > PL.dur * 0.5 && !over) X.leavePlane(P);
    }
    X.updateZone(dt);
    X.csUpdate(dt);
    if (G.training) X.updateTraining(dt);
    updatePlayer(dt);
    for (const f of G.fighters) {
      if (!f.isPlayer && f.alive) X.updateBot(f, dt);
      if (f.alive) X.updateBuffs(f, dt);
      if (f.dead) f.deadT += dt;
      if (f.hitT > 0) f.hitT -= dt;
      if (f.alive && f.knocked) {
        f.bleed -= dt * (f.reviveOf || G.fighters.some(o => o.reviveOf === f) ? 0 : 3.6);
        if (f.bleed <= 0) X.kill(f, f.knockedBy, "🩸", false);
      }
    }
    // zone damage
    G.zoneTick = (G.zoneTick || 0) - dt;
    if (G.zoneTick <= 0 && !G.training && !(G.cs && G.cs.phase !== "fight")) {
      G.zoneTick = 1;
      for (const f of G.fighters) {
        if (!f.alive || f.phase !== "ground" || !X.outsideZone(f)) continue;
        const dps = G.zone.dps * (f.pet === "penguin" ? 0.75 : 1);
        if (f.knocked) { f.bleed -= dps * 2; continue; }
        f.hp -= dps; f.hitT = 0.15;
        if (f.isPlayer) { SND.sfx("hurt", 0.35); X.vibrate(20); }
        if (f.hp <= 0) {
          if (G.teamSize > 1 && X.hasStandingMate(f)) X.knock(f, null, "🌀", false);
          else X.kill(f, null, "🌀", false);
        }
      }
    }
    X.updateGrenades(dt);
    X.updateGloos(dt);
    for (const t of G.tracers) t.life -= dt;
    G.tracers = G.tracers.filter(t => t.life > 0);
    for (const p of G.parts) { p.vy -= (p.g ?? 9) * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.life -= dt; }
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
    // pet follows the player
    if (!G.pet) G.pet = { x: P.x, z: P.z, y: P.y, yaw: 0, moving: 0 };
    // pet trots beside you on the left, slightly ahead (stays out of the camera's way)
    const pdx = P.x + Math.sin(P.yaw) * 0.5 + Math.cos(P.yaw) * 1.25 - G.pet.x, pdz = P.z + Math.cos(P.yaw) * 0.5 - Math.sin(P.yaw) * 1.25 - G.pet.z;
    const pd = Math.hypot(pdx, pdz);
    if (pd > 12) { G.pet.x = P.x; G.pet.z = P.z; }
    else if (pd > 0.3) { const s = Math.min(pd, dt * (pd > 3 ? 8 : 4.5)); G.pet.x += (pdx / pd) * s; G.pet.z += (pdz / pd) * s; G.pet.yaw = Math.atan2(pdx, pdz); }
    G.pet.moving = clamp(pd / 1.5, 0, 1);
    G.pet.y = X.WORLD.groundAt(G.pet.x, G.pet.z, P.y + 1);
    if (!G.cs && G.alive <= 5 && !G.intense && P.alive && !G.training) { G.intense = true; SND.music.start(); SND.music.setIntense(true); X.toast(`🔥 Only ${G.alive} left!`); }
  }

  // =================================================================== camera + render
  function updateCamera() {
    const G = X.G, C = G.cam;
    let f = G.spec && G.spec.alive ? G.spec : G.player;
    if (G.spec && !G.spec.alive) { const n = G.fighters.find(o => o.alive && (!G.cs || o.team === G.player.team)) || G.fighters.find(o => o.alive); if (n) { G.spec = f = n; $("specName").textContent = "👁️ " + n.name; } }
    if (G.cs && !G.player.alive && !G.spec) { const m = G.fighters.find(o => o.alive && o.team === G.player.team); if (m) G.spec = f = m; }
    let px, py, pz, dist, sh = 0, yaw = C.yaw, pitch = C.pitch;
    if (G.spec && f !== G.player) { yaw = f.yaw; pitch = -0.2; }
    if (f.phase === "plane") { px = G.plane.x; py = G.plane.y + 4; pz = G.plane.z; dist = 30; }
    else if (f.phase === "fall") { px = f.x; py = f.y + 1.5; pz = f.z; dist = f.para ? 9 : 6; }
    else {
      px = f.x; py = X.eyeY(f) + 0.22 + (f.dead ? -0.6 : 0); pz = f.z;
      const own = f === G.player;
      dist = G.ads && own ? 1.8 : 4.3;
      sh = G.ads && own ? 0.65 : 0.72;
      // camera follows the body's motion: running bob + landing dip
      const an = f._anim;
      if (an && !G.ads) py += Math.sin(an.ph * 2) * 0.03 * an.run * an.walk - an.land * 0.12 - an.crouch * 0.05;
    }
    const cp = Math.cos(pitch), d = [Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp];
    const [rx, rz] = rightOf(yaw);
    const ox = px + rx * sh, oy = py, oz = pz + rz * sh;
    let dd = dist;
    if (f.phase === "ground") { const t = X.WORLD.raycast(ox, oy, oz, -d[0], -d[1], -d[2], dist + 0.3); if (t !== Infinity) dd = Math.max(0.35, t - 0.3); }
    let cx = ox - d[0] * dd, cy = oy - d[1] * dd, cz = oz - d[2] * dd;
    const gmin = X.WORLD.heightAt(cx, cz) + 0.3;
    if (cy < gmin) cy = gmin;
    if (G.shake > 0) { cx += rand(-1, 1) * G.shake * 0.15; cy += rand(-1, 1) * G.shake * 0.15; }
    C.x = cx; C.y = cy; C.z = cz; C.dist = dd;
    C.tx = ox + d[0] * 30; C.ty = oy + d[1] * 30; C.tz = oz + d[2] * 30;
    const w = X.weaponOf(G.player);
    const runK = f._anim && f === G.player ? f._anim.run * f._anim.walk : 0;
    const targetFov = G.ads && w ? 1.2 / WD[w.id].zoom : f.phase === "plane" ? 1.3 : f.phase === "fall" && !f.para ? 1.35 : 1.2 * (1 + 0.08 * runK);
    G.fov += (targetFov - G.fov) * 0.25;
  }

  const MM = M4.create();
  function renderWorld(cam, fov, fighters, extra, petList) {
    R.begin(cam, fov);
    R.drawSky(cam);
    const Wm = X.WORLD.meshes;
    R.draw(Wm.terrain); R.draw(Wm.water); R.draw(Wm.statics); R.draw(Wm.trees);
    const fogFar = R.fog[1] + 10, t = performance.now() / 1000;
    for (const f of fighters) {
      const d = Math.hypot(f.x - cam.x, f.z - cam.z);
      if (d > fogFar || f.phase === "plane") continue;
      if (f.dead && f.deadT > 30) continue;
      const p = R.project(f.x, f.y + 1, f.z, X.SW, X.SH);
      if (!p && d > 4) continue;
      KIT.draw(f, d);
      if (f.para) KIT.drawPara(f);
    }
    if (petList) for (const p of petList) KIT.drawPet(BR3.PETS[p.kind] ? BR3.PETS[p.kind].animal : "none", p.x, p.y, p.z, p.yaw, t, p.moving);
    if (extra) extra();
  }
  function render() {
    const G = X.G, C = G.cam, P = G.player;
    const pets = P.alive && P.phase === "ground" && G.pet ? [{ kind: P.pet, x: G.pet.x, y: G.pet.y, z: G.pet.z, yaw: G.pet.yaw, moving: G.pet.moving }] : null;
    renderWorld(C, G.fov, G.fighters, () => {
      const PL = G.plane;
      if (PL.dur > 0 && PL.t < PL.dur) { M4.trs(MM, PL.x, PL.y, PL.z, PL.yaw, 0, Math.sin(G.t) * 0.04); R.draw(KIT.plane, MM); }
      const tt = G.t;
      for (const o of G.loot) {
        if (o.taken) continue;
        const d = Math.hypot(o.x - C.x, o.z - C.z);
        if (d > 70) continue;
        const rar = X.lootRarity(o), col = X.RAR[rar];
        const mesh = o.kind === "weapon" ? KIT.loot.weapon : o.kind === "ammo" ? KIT.loot.ammo : o.kind === "item" ? (o.type === "grenade" ? KIT.loot.grenade : o.type === "gloo" ? KIT.loot.gloo : KIT.loot.heal) : KIT.loot.armor;
        M4.trs(MM, o.x, o.y + 0.32 + Math.sin(tt * 2 + o.rot) * 0.06, o.z, o.rot + tt * 0.8, 0, 0);
        R.draw(mesh, MM, null, { emit: [col[0] * 0.35, col[1] * 0.35, col[2] * 0.35] });
        if (o.kind === "weapon" && X.RARITY_ORDER.indexOf(rar) >= 3 && d < 60) R.dynQuad(o.x, o.y, o.z, o.x, o.y + 6, o.z, 0.12, col);
      }
      for (const g of G.grenades) { M4.trs(MM, g.x, g.y, g.z, g.fuse * 5, g.fuse * 3, 0); R.draw(KIT.grenade, MM); }
      for (const t of G.tracers) R.dynQuad(t.ax, t.ay, t.az, t.bx, t.by, t.bz, 0.025, t.col);
      for (const p of G.parts) R.dynPoint(p.x, p.y, p.z, p.s, p.col);
      R.flushDyn();
      // gloo walls (slightly translucent ice)
      R.blend(true);
      for (const gl of G.gloos) for (const s of gl.segs) {
        if (s.broken) continue;
        const h = (s.y1 - s.y0) * gl.grow, k = 0.6 + 0.4 * (s.hp / s.max);
        M4.trs(MM, s.cx, s.y0 + h / 2, s.cz, gl.segs.indexOf(s) * 0.7, 0, 0, 1.15, h, 1.15);
        R.draw(KIT.gloo, MM, [0.75 * k, 1, 0.85 * k, 0.82], { emit: [0.05, 0.18, 0.12] });
      }
      const Z = G.zone;
      if (Z.r < 2000) {
        R.cull(false);
        M4.trs(MM, Z.x, -15, Z.z, 0, 0, 0, Math.max(1, Z.r), 190, Math.max(1, Z.r));
        R.draw(KIT.zoneWall, MM, [0.2, 0.45, 1, 0.28], { unlit: true });
        R.cull(true);
      }
      R.blend(false);
    }, pets);
  }

  // =================================================================== lobby scene (your squad lined up)
  X.preview = null; // { outfit, wskin, pet } overrides while browsing the store
  let lobbyScene = null;
  function lobbyKey() { const e = PROG.data.equip, o = X.preview || {}; return [X.selected.code, o.outfit || e.outfit, o.wskin || e.wskin, o.pet || e.pet, X.S.mode, X.S.team].join("|"); }
  function buildLobbyScene() {
    const W = X.WORLD, e = PROG.data.equip, o = X.preview || {};
    const spot = lobbyScene ? lobbyScene.spot : X.openSpot(W.towns[0].x, W.towns[0].z, 80, 8);
    const gy = W.groundAt(spot.x, spot.z, 99);
    const face = lobbyScene ? lobbyScene.face : Math.random() * Math.PI * 2;
    const P = X.makeFighter(X.selected, true, 0, { outfit: o.outfit || e.outfit, wskin: o.wskin || e.wskin });
    const M = BR3.MODES[X.S.mode] || BR3.MODES.classic;
    const nMates = M.cs ? 3 : M.training ? 0 : X.S.team - 1;
    const oldMates = lobbyScene ? lobbyScene.mates : [];
    const mates = [];
    for (let i = 0; i < nMates; i++) mates.push(oldMates[i] || X.makeFighter(pick(BR.CHARACTERS), false, i + 1));
    const all = [P, ...mates];
    const offs = [0, -1.6, 1.6, -3.1];
    const [rx, rz] = rightOf(face), [fx, fz] = fwd(face);
    all.forEach((f, i) => {
      const back = i === 0 ? 0 : 0.9;
      f.x = spot.x + rx * offs[i] - fx * back; f.z = spot.z + rz * offs[i] - fz * back;
      f.y = W.groundAt(f.x, f.z, gy + 2); f.phase = "ground"; f.onGround = true; f.yaw = face;
      f.weapon = i === 0 ? "ar" : pick(["smg", "m4", "shotgun", "dmr"]);
      f.gunColor = f.skinColor || hex(WD[f.weapon].color);
      if (i > 0) f.vest = 1 + (i % 2);
    });
    lobbyScene = { key: lobbyKey(), spot, face, gy, P, mates, all, pet: o.pet || e.pet, emoteT: 4 };
  }
  X.lobbyEmote = type => { if (lobbyScene) lobbyScene.P.emote = { type, t: 0, dur: 3.5 }; SND.sfx("pick"); };
  X.refreshLobbyScene = () => { if (lobbyScene) lobbyScene.key = ""; };
  X.getLobbyScene = () => lobbyScene; // debug / tests
  function renderLobby(t, dt) {
    if (!lobbyScene || lobbyScene.key !== lobbyKey()) {
      const em = lobbyScene && lobbyScene.P.emote;
      buildLobbyScene();
      if (em) lobbyScene.P.emote = em;
    }
    const L = lobbyScene, [fx, fz] = fwd(L.face), [rx, rz] = rightOf(L.face);
    for (const f of L.all) {
      if (f.emote) { f.emote.t += dt; if (f.emote.t > (f.emote.dur || 3.5)) f.emote = null; }
      f.pitch = Math.sin(t * 0.8 + f.id) * 0.06;
    }
    L.emoteT -= dt;
    if (L.emoteT <= 0 && L.mates.length) { pick(L.mates).emote = { type: pick(Object.keys(BR3.EMOTES)), t: 0, dur: 3 }; L.emoteT = rand(5, 9); }
    const sway = Math.sin(t * 0.25) * 0.5;
    const dist = 4.6 + L.mates.length * 0.55;
    const cam = {
      x: L.spot.x + fx * dist + rx * sway, y: L.gy + 1.55 + Math.sin(t * 0.3) * 0.08, z: L.spot.z + fz * dist + rz * sway,
      tx: L.spot.x - rx * 0.6 * (BR3.Input.mode === "touch" ? 0 : 0.6), ty: L.gy + 1.05, tz: L.spot.z - rz * 0.6 * (BR3.Input.mode === "touch" ? 0 : 0.6),
    };
    const P = L.P;
    const pet = { kind: L.pet, x: P.x + rx * 1.0 + fx * 0.5, y: L.gy, z: P.z + rz * 1.0 + fz * 0.5, yaw: L.face + Math.sin(t) * 0.3, moving: 0.2 };
    pet.y = X.WORLD.groundAt(pet.x, pet.z, L.gy + 2);
    // glowing pulse ring under your character (lobby stage)
    const stage = () => {
      if (!KIT.disc) return;
      const pulse = 0.85 + Math.sin(t * 2.4) * 0.08;
      R.blend(true); R.cull(false);
      M4.trs(MM, P.x, P.y + 0.03, P.z, 0, 0, 0, pulse, 1, pulse);
      R.draw(KIT.disc, MM, [0.25, 0.85, 1, 0.28], { unlit: true });
      M4.trs(MM, P.x, P.y + 0.025, P.z, 0, 0, 0, 1.35, 1, 1.35);
      R.draw(KIT.disc, MM, [1, 0.75, 0.2, 0.12], { unlit: true });
      R.cull(true); R.blend(false);
    };
    renderWorld(cam, 0.95, L.all, stage, [pet]);
    octx.clearRect(0, 0, X.SW, X.SH);
  }

  // =================================================================== overlay (2D canvas)
  function overlay() {
    const G = X.G, c = octx, SW = X.SW, SH = X.SH;
    c.clearRect(0, 0, SW, SH);
    const P = G.player, C = G.cam;
    const radar = P.buffs.radar > 0;
    c.textAlign = "center"; c.font = "bold 11px sans-serif";
    for (const f of G.fighters) {
      if (f.isPlayer || !f.alive || f.phase === "plane") continue;
      const mate = f.team === P.team && !f.dummy;
      const d = Math.hypot(f.x - C.x, f.z - C.z);
      const show = mate || d < 22 || (f.hitT > 0 && d < 120) || (f.phase === "fall" && d < 120) || f.dummy || (radar && d < 70);
      if (!show) continue;
      const p = R.project(f.x, f.y + (f.phase === "fall" && f.para ? 6 : f.knocked ? 1.1 : 2.15), f.z, SW, SH);
      if (!p) continue;
      if (radar && !mate && d < 70) { c.fillStyle = "#ef4444"; c.beginPath(); c.moveTo(p.x, p.y - 14); c.lineTo(p.x + 7, p.y - 6); c.lineTo(p.x, p.y + 2); c.lineTo(p.x - 7, p.y - 6); c.closePath(); c.fill(); }
      c.fillStyle = "rgba(0,0,0,0.5)"; c.fillRect(p.x - 26, p.y - 2, 52, 5);
      const v = f.knocked ? f.bleed : f.hp;
      c.fillStyle = f.knocked ? "#ef4444" : mate ? "#38bdf8" : v > 50 ? "#f1f5f9" : v > 25 ? "#fde047" : "#ef4444";
      c.fillRect(p.x - 26, p.y - 2, 52 * (v / 100), 5);
      c.fillStyle = mate ? "#7dd3fc" : "#fff"; c.strokeStyle = "#000"; c.lineWidth = 3;
      const label = (f.knocked ? "🩸 " : "") + f.name + (mate && d > 25 ? ` · ${Math.round(d)}m` : "");
      c.strokeText(label, p.x, p.y - 6); c.fillText(label, p.x, p.y - 6);
    }
    c.font = "900 16px sans-serif";
    for (const d of G.dmgNums) {
      const p = R.project(d.x, d.y, d.z, SW, SH);
      if (!p) continue;
      c.globalAlpha = Math.min(1, d.t * 2); c.lineWidth = 3; c.strokeStyle = "#000"; c.fillStyle = d.head ? "#ef4444" : "#fde047";
      c.strokeText(d.v, p.x, p.y); c.fillText(d.v, p.x, p.y);
    }
    c.globalAlpha = 1;
    for (const ind of G.indicators) {
      const ang = -wrapA(ind.a - C.yaw);
      c.save(); c.translate(SW / 2, SH / 2); c.rotate(ang); c.globalAlpha = Math.min(1, ind.t);
      c.fillStyle = "#ef4444"; c.beginPath(); c.moveTo(0, -120); c.lineTo(-22, -96); c.lineTo(22, -96); c.closePath(); c.fill();
      c.restore();
    }
    c.globalAlpha = 1;
    const out = P.alive && P.phase === "ground" && X.outsideZone(P);
    if (P.alive && (P.hp < 30 || out || P.knocked)) {
      const g = c.createRadialGradient(SW / 2, SH / 2, Math.min(SW, SH) * 0.3, SW / 2, SH / 2, Math.max(SW, SH) * 0.7);
      g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, out ? "rgba(37,99,235,0.45)" : "rgba(220,38,38,0.45)");
      c.fillStyle = g; c.fillRect(0, 0, SW, SH);
    }
    const w = X.weaponOf(P);
    if (G.ads && w && WD[w.id].zoom > 2.4 && P.alive) {
      const r = Math.min(SW, SH) * 0.42;
      c.fillStyle = "#000"; c.beginPath(); c.rect(0, 0, SW, SH); c.arc(SW / 2, SH / 2, r, 0, Math.PI * 2, true); c.fill();
      c.strokeStyle = "#000"; c.lineWidth = 1.5; c.beginPath(); c.moveTo(SW / 2 - r, SH / 2); c.lineTo(SW / 2 + r, SH / 2); c.moveTo(SW / 2, SH / 2 - r); c.lineTo(SW / 2, SH / 2 + r); c.stroke();
      c.fillStyle = "#ef4444"; c.beginPath(); c.arc(SW / 2, SH / 2, 2, 0, Math.PI * 2); c.fill();
    }
    // speed lines when sprinting or skydiving
    const an = P._anim;
    const speedK = P.alive ? (P.phase === "fall" && !P.para ? 1 : an && !G.ads ? Math.max(0, an.run * an.walk - 0.5) * 2 : 0) : 0;
    if (speedK > 0.05) {
      c.strokeStyle = `rgba(255,255,255,${0.16 * speedK})`; c.lineWidth = 1.5;
      c.beginPath();
      for (let i = 0; i < 18; i++) {
        const ang = Math.random() * Math.PI * 2, r0 = Math.max(SW, SH) * (0.38 + Math.random() * 0.15), r1 = r0 + 40 + Math.random() * 90;
        c.moveTo(SW / 2 + Math.cos(ang) * r0, SH / 2 + Math.sin(ang) * r0);
        c.lineTo(SW / 2 + Math.cos(ang) * r1, SH / 2 + Math.sin(ang) * r1);
      }
      c.stroke();
    }
    drawCompass(c);
    drawMinimap(c);
    if (IN.mode === "touch" && IN.stick.active) {
      const s = IN.stick;
      c.strokeStyle = "rgba(255,255,255,0.45)"; c.lineWidth = 3; c.beginPath(); c.arc(s.ox, s.oy, IN.STICK_R, 0, Math.PI * 2); c.stroke();
      const dx = s.x - s.ox, dy = s.y - s.oy, l = Math.hypot(dx, dy), k = l > IN.STICK_R ? IN.STICK_R / l : 1;
      c.fillStyle = l > IN.STICK_R * 1.25 ? "rgba(250,204,21,0.6)" : "rgba(255,255,255,0.5)";
      c.beginPath(); c.arc(s.ox + dx * k, s.oy + dy * k, 26, 0, Math.PI * 2); c.fill();
    } else if (IN.mode === "touch" && X.state === "play") {
      c.globalAlpha = 0.35; c.strokeStyle = "#fff"; c.lineWidth = 3; c.beginPath(); c.arc(110, SH - 130, IN.STICK_R, 0, Math.PI * 2); c.stroke();
      c.fillStyle = "#fff"; c.font = "bold 11px sans-serif"; c.textAlign = "center"; c.fillText("MOVE", 110, SH - 126); c.globalAlpha = 1;
    }
    if (X.S.fps) { c.fillStyle = "#0f0"; c.font = "12px monospace"; c.textAlign = "left"; c.fillText(`${fps} fps`, 8, SH - 8); }
  }
  function drawCompass(c) {
    const SW = X.SW, w = Math.min(360, SW * 0.5), x0 = SW / 2 - w / 2, y = X.G.cs ? 58 : 52;
    c.fillStyle = "rgba(0,0,0,0.35)"; c.fillRect(x0, y, w, 20);
    let h = Math.atan2(Math.sin(X.G.cam.yaw), -Math.cos(X.G.cam.yaw)) * 180 / Math.PI;
    h = (h + 360) % 360;
    c.save(); c.beginPath(); c.rect(x0, y, w, 20); c.clip();
    c.textAlign = "center"; c.font = "bold 11px sans-serif";
    for (let a = Math.ceil((h - 90) / 15) * 15; a <= h + 90; a += 15) {
      const sx = SW / 2 + ((a - h) / 90) * (w / 2), v = ((a % 360) + 360) % 360;
      const lbl = { 0: "N", 90: "E", 180: "S", 270: "W" }[v];
      c.fillStyle = lbl ? "#facc15" : "#fff";
      c.fillText(lbl || (v % 45 === 0 ? String(v) : "·"), sx, y + 14);
    }
    c.restore();
    c.fillStyle = "#fff"; c.fillRect(SW / 2 - 1, y + 18, 2, 6);
  }
  function drawMinimap(c) {
    const G = X.G, W = X.WORLD, size = Math.min(150, X.SW * 0.3), x0 = 10, y0 = 10;
    const P = G.spec || G.player, viewR = G.cs ? 70 : 110, img = W.mapImage, k = img.width / W.S;
    c.save(); c.beginPath(); c.rect(x0, y0, size, size); c.clip();
    c.fillStyle = "#1e3a5f"; c.fillRect(x0, y0, size, size);
    const px = P.phase === "plane" ? G.plane.x : P.x, pz = P.phase === "plane" ? G.plane.z : P.z;
    c.drawImage(img, (px - viewR) * k, (pz - viewR) * k, viewR * 2 * k, viewR * 2 * k, x0, y0, size, size);
    const toM = (x, z) => [x0 + ((x - (px - viewR)) / (viewR * 2)) * size, y0 + ((z - (pz - viewR)) / (viewR * 2)) * size];
    const sc = size / (viewR * 2), Z = G.zone;
    if (Z.r < 2000) {
      let [zx, zy] = toM(Z.x, Z.z);
      c.strokeStyle = "#60a5fa"; c.lineWidth = 2; c.beginPath(); c.arc(zx, zy, Z.r * sc, 0, Math.PI * 2); c.stroke();
      if (Z.mode !== "done" && Z.mode !== "cs") { [zx, zy] = toM(Z.nx, Z.nz); c.strokeStyle = "#fff"; c.lineWidth = 1.5; c.beginPath(); c.arc(zx, zy, Z.nr * sc, 0, Math.PI * 2); c.stroke(); }
    }
    for (const p of G.pings) { const [mx, my] = toM(p.x, p.z); c.fillStyle = `rgba(239,68,68,${p.t})`; c.beginPath(); c.arc(mx, my, 3, 0, Math.PI * 2); c.fill(); }
    if (G.player.pet === "fox") { c.fillStyle = "#fbbf24"; for (const o of G.loot) if (!o.taken && o.kind === "weapon" && Math.hypot(o.x - px, o.z - pz) < 60) { const [mx, my] = toM(o.x, o.z); c.fillRect(mx - 1.5, my - 1.5, 3, 3); } }
    for (const f of G.fighters) {
      if (f === G.player || !f.alive || f.phase === "plane") continue;
      const mate = f.team === G.player.team && !f.dummy;
      if (!mate && !(G.player.buffs.radar > 0 && Math.hypot(f.x - px, f.z - pz) < 70)) continue;
      const [mx, my] = toM(f.x, f.z);
      c.fillStyle = mate ? (f.knocked ? "#ef4444" : "#38bdf8") : "#ef4444";
      c.beginPath(); c.arc(mx, my, 3.5, 0, Math.PI * 2); c.fill();
    }
    if (G.plane.dur > 0 && G.plane.t < G.plane.dur) {
      const [ax, ay] = toM(G.plane.sx, G.plane.sz), [bx, by] = toM(G.plane.ex, G.plane.ez);
      c.strokeStyle = "rgba(255,255,255,0.6)"; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke(); c.setLineDash([]);
    }
    const [mx, my] = toM(px, pz);
    c.translate(mx, my); c.rotate(-(G.spec ? P.yaw : G.cam.yaw) + Math.PI);
    c.fillStyle = "#facc15"; c.beginPath(); c.moveTo(0, -7); c.lineTo(5, 5); c.lineTo(-5, 5); c.closePath(); c.fill();
    c.restore();
    c.strokeStyle = "rgba(255,255,255,0.4)"; c.lineWidth = 1; c.strokeRect(x0, y0, size, size);
    const t = W.towns.reduce((b, t2) => (Math.hypot(t2.x - px, t2.z - pz) < Math.hypot(b.x - px, b.z - pz) ? t2 : b), W.towns[0]);
    if (t && Math.hypot(t.x - px, t.z - pz) < 60) { c.fillStyle = "#fff"; c.font = "bold 11px sans-serif"; c.textAlign = "left"; c.fillText("📍 " + t.name, x0 + 4, y0 + size + 13); }
  }
  function drawFullMap() {
    const G = X.G, W = X.WORLD, cv = $("mapCanvas");
    const size = Math.round(cv.getBoundingClientRect().width * X.ODPR) || 600;
    if (cv.width !== size) { cv.width = size; cv.height = size; }
    const c = cv.getContext("2d"), k = size / W.S, D = X.ODPR;
    c.drawImage(W.mapImage, 0, 0, size, size);
    const Z = G.zone;
    if (Z.r < 2000) {
      c.strokeStyle = "#60a5fa"; c.lineWidth = 3 * D; c.beginPath(); c.arc(Z.x * k, Z.z * k, Z.r * k, 0, Math.PI * 2); c.stroke();
      if (Z.mode !== "done" && Z.mode !== "cs") { c.strokeStyle = "#fff"; c.lineWidth = 2 * D; c.beginPath(); c.arc(Z.nx * k, Z.nz * k, Z.nr * k, 0, Math.PI * 2); c.stroke(); }
    }
    if (G.plane.dur > 0 && G.plane.t < G.plane.dur) {
      c.strokeStyle = "rgba(255,255,255,0.8)"; c.setLineDash([8, 8]); c.lineWidth = 2 * D;
      c.beginPath(); c.moveTo(G.plane.sx * k, G.plane.sz * k); c.lineTo(G.plane.ex * k, G.plane.ez * k); c.stroke(); c.setLineDash([]);
      c.fillStyle = "#fff"; c.font = `${16 * D}px sans-serif`; c.fillText("✈️", G.plane.x * k - 8, G.plane.z * k + 6);
    }
    c.font = `bold ${12 * D}px sans-serif`; c.textAlign = "center";
    for (const t of W.towns) { c.fillStyle = "#000"; c.fillText(t.name, t.x * k + 1, t.z * k + 1); c.fillStyle = "#fff"; c.fillText(t.name, t.x * k, t.z * k); }
    for (const f of G.fighters) if (f !== G.player && f.alive && f.team === G.player.team && f.phase !== "plane" && !f.dummy) { c.fillStyle = "#38bdf8"; c.beginPath(); c.arc(f.x * k, f.z * k, 5 * D, 0, Math.PI * 2); c.fill(); }
    const P = G.player, px = P.phase === "plane" ? G.plane.x : P.x, pz = P.phase === "plane" ? G.plane.z : P.z;
    c.save(); c.translate(px * k, pz * k); c.rotate(-G.cam.yaw + Math.PI);
    c.fillStyle = "#facc15"; c.strokeStyle = "#000"; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, -12 * D); c.lineTo(8 * D, 8 * D); c.lineTo(-8 * D, 8 * D); c.closePath(); c.fill(); c.stroke();
    c.restore();
  }

  // =================================================================== HUD (DOM)
  const hc = {};
  const setT = (id, v) => { if (hc[id] !== v) { hc[id] = v; $(id).textContent = v; } };
  const setH = (id, v) => { if (hc["h" + id] !== v) { hc["h" + id] = v; $(id).innerHTML = v; } };
  const setC = (el, cls, on) => el.classList.toggle(cls, !!on);
  const mmss = s => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
  function hud() {
    const G = X.G, P = G.player, Z = G.zone;
    setT("aliveN", String(G.alive));
    setT("killsN", String(P.kills));
    setT("aliveL", G.teamSize > 1 ? `alive · ${new Set(G.fighters.filter(f => f.alive).map(f => f.team)).size} squads` : "alive");
    if (G.training) { setT("zoneT", "∞"); setT("zoneL", "training"); }
    else { setT("zoneT", Z.mode === "done" ? "FINAL" : mmss(Z.t)); setT("zoneL", Z.mode === "shrink" ? "shrinking" : Z.mode === "done" ? "zone" : "until shrink"); }
    setC($("zonePill"), "shrink", Z.mode === "shrink");
    // banner like "Safe Zone will shrink in 00:45"
    const zb = $("zoneBanner");
    let bt = "";
    if (G.cs) { const C = G.cs; bt = C.phase === "buy" ? `🛒 BUY PHASE · ${Math.ceil(C.t)}s · Round ${C.round}` : C.phase === "fight" && 100 - C.t > 35 && 100 - C.t < 42 ? "⚠️ Zone is closing in!" : ""; }
    else if (!G.training && P.phase === "ground") bt = Z.mode === "wait" && Z.t < 60 ? `⏳ Safe Zone will shrink in ${mmss(Z.t)}` : Z.mode === "shrink" ? "⚠️ Safe Zone is shrinking!" : "";
    setT("zoneBanner", bt); setC(zb, "hidden", !bt); setC(zb, "warn", Z.mode === "shrink");
    // clash squad bar
    const cb = $("csBar");
    setC(cb, "hidden", !G.cs);
    if (G.cs) {
      const C = G.cs;
      setT("csA", String(C.score[0])); setT("csB", String(C.score[1]));
      setT("csTime", C.phase === "buy" ? `🛒 ${Math.ceil(C.t)}` : mmss(C.t)); setT("csObj", `Objective: ${C.target} · Round ${C.round}`);
      const dots = t => G.fighters.filter(f => f.team === t).map(f => `<i class="${!f.alive ? "dead" : f.knocked ? "kn" : ""}"></i>`).join("");
      setH("csDotsA", dots(0)); setH("csDotsB", dots(1));
    }
    // team list
    if (G.teamSize > 1) {
      setH("teamList", G.fighters.filter(f => f.team === P.team).map(f => {
        const v = f.knocked ? f.bleed : f.hp;
        return `<div class="tm${f.isPlayer ? " me" : ""}${!f.alive ? " dead" : f.knocked ? " kn" : ""}"><span>${f.knocked ? "🩸 " : !f.alive ? "💀 " : ""}${esc(f.isPlayer ? f.name + " (you)" : f.name)}</span><div class="tb2"><i style="width:${f.alive ? Math.max(0, v) : 0}%"></i></div></div>`;
      }).join(""));
    } else setH("teamList", "");
    $("hpfill").style.width = Math.max(0, P.hp) + "%";
    setC($("hpfill"), "mid", P.hp <= 60 && P.hp > 30); setC($("hpfill"), "low", P.hp <= 30);
    setT("hptext", String(Math.max(0, Math.ceil(P.hp))));
    $("boostfill").style.width = P.boost + "%";
    $("vestI").className = "armor " + (P.vest ? "l" + P.vest : "off"); setT("vestI", P.vest ? `🦺 Lv.${P.vest}` : "🦺 —");
    $("helmI").className = "armor " + (P.helmet ? "l" + P.helmet : "off"); setT("helmI", P.helmet ? `⛑️ Lv.${P.helmet}` : "⛑️ —");
    const pt = BR3.PETS[P.pet]; setT("petI", pt && P.pet !== "none" ? pt.icon : ""); setC($("petI"), "hidden", !pt || P.pet === "none");
    document.querySelectorAll("#slots .slot").forEach((el, i) => {
      const s = P.slots[i];
      const key = s ? `${s.id}|${s.mag}|${P.ammo[WD[s.id].ammo]}|${P.cur === i}` : `empty|${P.cur === i}`;
      if (el.dataset.k === key) return;
      el.dataset.k = key;
      el.className = "slot" + (P.cur === i ? " on" : "") + (s ? " r-" + WD[s.id].rarity : "");
      el.querySelector(".wname").textContent = s ? WD[s.id].short : "EMPTY";
      el.querySelector(".wammo").textContent = s ? `${s.mag} / ${P.ammo[WD[s.id].ammo]}` : "";
    });
    const w = X.weaponOf(P);
    setT("magT", w ? (P.reloadT > 0 ? "··" : String(w.mag)) : "👊");
    setT("resT", w ? `${AMMO[WD[w.id].ammo].icon} ${G.infinite ? "∞" : P.ammo[WD[w.id].ammo]}` : "fists");
    setC($("ammoBox"), "low", w && w.mag <= Math.ceil(WD[w.id].mag * 0.2));
    setT("bandC", String(P.items.bandage)); setT("medC", String(P.items.medkit)); setT("drinkC", String(P.items.drink)); setT("grenC", String(P.items.grenade)); setT("glooC", String(P.items.gloo));
    setT("grenC2", String(P.items.grenade)); setT("healC2", String(P.items.bandage + P.items.medkit)); setT("drinkC2", String(P.items.drink)); setT("glooC2", String(P.items.gloo));
    // skill button
    const sk = BR3.SKILLS[P.skill];
    setT("skillIco", sk ? sk.icon : "❔");
    $("skillCd").style.height = sk ? (100 * P.skillCd / sk.cd) + "%" : "0%";
    setC($("skillBtn"), "ready", P.skillCd <= 0 && P.alive && !P.knocked);
    // use / reload / revive bar
    const ub = $("usebar");
    if (P.alive && (P.useT > 0 || P.reloadT > 0 || P.reviveOf)) {
      ub.classList.remove("hidden");
      let tot, left, txt;
      if (P.reviveOf) { tot = X.reviveTime(P); left = tot - P.reviveT; txt = `➕ Reviving ${P.reviveOf.name}… ${left.toFixed(1)}s`; }
      else if (P.useT > 0) { tot = P.useMax; left = P.useT; txt = `${ITEMS[P.useItem].icon} Using ${ITEMS[P.useItem].name}… ${left.toFixed(1)}s`; }
      else { tot = WD[w ? w.id : "pistol"].reload; left = P.reloadT; txt = `↻ Reloading… ${left.toFixed(1)}s`; }
      $("usefill").style.width = (100 * clamp(1 - left / tot, 0, 1)) + "%";
      setT("usetext", txt);
    } else ub.classList.add("hidden");
    // knocked
    setC($("knockBar"), "hidden", !(P.alive && P.knocked));
    if (P.knocked) $("bleedFill").style.width = Math.max(0, P.bleed) + "%";
    // pick up / revive prompts
    const km = P.alive && !P.knocked && P.phase === "ground" ? X.nearestKnockedMate(P) : null;
    const near = !km && P.alive && !P.knocked && P.phase === "ground" ? X.nearestWeaponLoot(P) : null;
    const pr = $("prompt"), pb = $("pickBtn"), rb = $("reviveBtn");
    setC(rb, "hidden", !(km && IN.mode === "touch"));
    if (km) { pb.classList.add("hidden"); if (IN.mode !== "touch") { pr.classList.remove("hidden"); setT("prompt", `[Hold ${IN.mode === "gamepad" ? "X" : "E"}] Revive ${km.name}`); } else pr.classList.add("hidden"); }
    else if (near) {
      const full = P.slots[0] && P.slots[1];
      if (IN.mode === "touch") { pr.classList.add("hidden"); pb.classList.remove("hidden"); setT("pickBtn", `✋ ${WD[near.id].short}${full ? " ⇄" : ""}`); }
      else { pb.classList.add("hidden"); pr.classList.remove("hidden"); setT("prompt", `[${IN.mode === "gamepad" ? "X" : "E"}] Pick up ${X.lootLabel(near)}${full ? " (swap)" : ""}`); }
    } else { pr.classList.add("hidden"); pb.classList.add("hidden"); }
    $("zoneWarn").classList.toggle("hidden", !(P.alive && P.phase === "ground" && X.outsideZone(P) && !G.training));
    const cr = $("cross");
    setC(cr, "hide", !P.alive || P.phase !== "ground" || P.knocked || (G.ads && w && WD[w.id].zoom > 2.4));
    const spread = w ? (G.ads ? WD[w.id].ads : WD[w.id].hip) * (P.moving > 0.3 ? 1.6 : 1) + G.bloom : 1;
    const gap = 4 + spread * 6;
    cr.children[0].style.top = (-gap - 8) + "px"; cr.children[1].style.top = gap + "px";
    cr.children[2].style.left = (-gap - 8) + "px"; cr.children[3].style.left = gap + "px";
    const hm = $("hitm");
    if (G.hitmT > 0) { hm.classList.remove("hidden"); hm.className = G.hitmKind || ""; } else hm.classList.add("hidden");
    setC($("touch").querySelector(".crouch"), "on", P.crouch);
    if (G.mapOpen) drawFullMap();
    if (G.cs && !$("buyMenu").classList.contains("hidden")) { setT("buyCoins", String(P.coins)); }
  }

  // =================================================================== scoreboard
  X.renderScoreboard = () => {
    const G = X.G, P = G.player;
    let A, B, nA = "YOUR SQUAD", nB = "ENEMIES", sA, sB;
    if (G.cs) { A = G.fighters.filter(f => f.team === 0); B = G.fighters.filter(f => f.team === 1); sA = G.cs.score[0]; sB = G.cs.score[1]; nB = "ENEMY SQUAD"; }
    else if (G.teamSize > 1) {
      A = G.fighters.filter(f => f.team === P.team);
      B = G.fighters.filter(f => f.team !== P.team).sort((a, b) => b.kills - a.kills || b.dmg - a.dmg).slice(0, 4);
      sA = A.reduce((s, f) => s + f.kills, 0); sB = "🔝"; nB = "TOP ENEMIES";
    } else {
      A = G.fighters.slice().sort((a, b) => b.kills - a.kills || b.dmg - a.dmg).slice(0, 5);
      if (!A.includes(P)) A[4] = P;
      B = G.fighters.filter(f => !A.includes(f)).sort((a, b) => b.kills - a.kills || b.dmg - a.dmg).slice(0, 5);
      sA = "🔝"; sB = ""; nA = "TOP PLAYERS"; nB = "RUNNERS-UP";
    }
    const row = f => `<div class="sb-row${f.isPlayer ? " me" : ""}${!f.alive ? " dead" : ""}"><img src="${BR.flagUrl(f.code)}" alt=""><span class="nm">${esc(f.isPlayer ? f.name + " (you)" : f.name)}<small>${!f.alive ? "💀 eliminated" : f.knocked ? "🩸 knocked" : esc(f.ch.party)}</small></span><b>${f.kills}</b><b>${f.deaths}</b><b>${Math.round(f.dmg)}</b></div>`;
    const hdr = `<div class="sb-row hdr"><span></span><span>PLAYER</span><span>K</span><span>D</span><span>DMG</span></div>`;
    $("sbNameA").textContent = nA; $("sbNameB").textContent = nB;
    $("sbScoreA").textContent = sA; $("sbScoreB").textContent = sB;
    $("sbListA").innerHTML = hdr + A.map(row).join("");
    $("sbListB").innerHTML = hdr + B.map(row).join("");
  };

  // =================================================================== screens / navigation
  const SCREENS = ["lobby", "modes", "store", "skills", "profile", "daily", "chars", "settings", "howto", "pause", "results", "loading"];
  X.hideScreens = () => SCREENS.forEach(s => $(s).classList.add("hidden"));
  X.show = id => {
    X.hideScreens();
    $(id).classList.remove("hidden");
    const p = $(id).querySelector("[data-primary]");
    if (p && IN.mode !== "touch") p.focus({ preventScroll: true });
    if (id !== "store") { if (X.preview) { X.preview = null; X.refreshLobbyScene(); } }
  };
  let backTo = "lobby";
  X.back = () => {
    if (backTo === "pause" && X.state === "paused") { X.show("pause"); backTo = "lobby"; }
    else X.toLobby();
  };
  X.toLobby = () => {
    X.state = "lobby";
    X.G = null;
    X.exitLock();
    document.body.classList.remove("cs");
    $("hud").classList.add("hidden");
    ["mapFull", "specBar", "scoreboard", "buyMenu", "emoteWheel"].forEach(id => $(id).classList.add("hidden"));
    if (X.WORLD) X.WORLD.dyn.length = 0;
    X.show("lobby");
    if (BR3.UI) BR3.UI.refreshLobby();
    SND.music.start(); SND.music.setIntense(false);
  };
  let charTab = "All", charQ = "";
  X.openChars = () => {
    $("charTabs").innerHTML = ["All", "⭐ Featured", ...BR.REGIONS].map(t => `<button data-t="${esc(t)}" class="${t === charTab ? "on" : ""}">${esc(t)}</button>`).join("");
    renderCharGrid();
    X.show("chars");
    const on = $("charGrid").querySelector(".on");
    if (on) on.scrollIntoView({ block: "center" });
  };
  function renderCharGrid() {
    const q = charQ.trim().toLowerCase();
    const list = BR.CHARACTERS.filter(c => (charTab === "All" || (charTab === "⭐ Featured" && c.featured) || c.region === charTab) && (!q || c.name.toLowerCase().includes(q) || c.party.toLowerCase().includes(q)));
    $("charCount").textContent = `${list.length} candidates`;
    $("charGrid").innerHTML = list.map(c => `<button class="cc${c === X.selected ? " on" : ""}" data-code="${c.code}"><span class="m">${c.mascot}</span><img loading="lazy" src="${BR.flagUrl(c.code)}" alt=""><span class="n">${esc(c.name)}</span><span class="p">${esc(c.party)}</span></button>`).join("");
  }
  X.openSettings = from => {
    backTo = from || "lobby";
    const S = X.S;
    $("sName").value = PROG.data.name;
    $("sSens").value = S.sens; $("sAssist").checked = S.assist; $("sInvert").checked = S.invert;
    $("sMusic").value = S.music; $("sSfx").value = S.sfx; $("sVoice").value = S.voice; $("sVib").checked = S.vib; $("sFps").checked = S.fps;
    document.querySelectorAll("#sQuality button").forEach(b => b.classList.toggle("on", b.dataset.v === S.quality));
    X.show("settings");
  };
  X.openHowto = () => {
    $("wLegend").innerHTML = Object.values(WD).map(w => `<div>${w.icon} <b>${esc(w.name)}</b>: ${w.dmg}${w.pellets > 1 ? "×" + w.pellets : ""} dmg · ${w.rpm} rpm · mag ${w.mag} · <i>${BR3.RARITY[w.rarity].label}</i></div>`).join("");
    X.show("howto");
  };

  // =================================================================== pointer lock + pause
  X.requestLock = () => {
    if (IN.mode !== "desktop") return;
    try { const r = glc.requestPointerLock && glc.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* not allowed */ }
  };
  X.exitLock = () => { if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock(); };
  const lockable = () => (X.state === "play" || X.state === "plane") && X.G && !X.G.mapOpen && $("buyMenu").classList.contains("hidden") && $("emoteWheel").classList.contains("hidden");
  let lockedOnce = false;
  document.addEventListener("pointerlockchange", () => {
    if (document.pointerLockElement === glc) { lockedOnce = true; if (!lockable()) X.exitLock(); return; }
    if (lockable() && lockedOnce && IN.mode === "desktop") pause();
  });
  let prevState = null;
  function pause() {
    if (X.state !== "play" && X.state !== "plane") return;
    prevState = X.state; X.state = "paused";
    IN.clear(); X.exitLock();
    const G = X.G;
    $("pauseInfo").textContent = G.cs ? `Round ${G.cs.round} · ${G.cs.score[0]} - ${G.cs.score[1]}` : G.training ? "Training ground" : `${G.alive} players left · ${G.player.kills} kills`;
    X.show("pause");
  }
  function resume() {
    if (X.state !== "paused") return;
    X.state = prevState || "play";
    X.hideScreens();
    X.requestLock();
  }
  document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); });

  // =================================================================== input wiring
  IN.attach(glc);
  IN.bindButtons($("hud"));
  IN.on("wantLock", () => { if (lockable()) X.requestLock(); });
  const playing = () => (X.state === "play" || X.state === "plane") && X.G && X.G.player.alive;
  const ground = () => playing() && X.G.player.phase === "ground" && !X.G.player.knocked;
  IN.on("jump", () => {
    if (!playing()) return;
    const G = X.G, P = G.player;
    if (P.phase === "plane") {
      if (Math.hypot(G.plane.x - X.WORLD.center.x, G.plane.z - X.WORLD.center.z) > 285) { X.toast("🌊 Wait until you're over the island!"); return; }
      X.leavePlane(P);
    } else if (P.phase === "fall") { if (!P.para) { P.para = true; SND.sfx("wind"); } }
    else if (P.onGround && !P.knocked) { P.vy = 6.2; P.onGround = false; P.crouch = false; }
  });
  IN.on("crouch", () => { if (ground()) X.G.player.crouch = !X.G.player.crouch; });
  IN.on("reload", () => { if (ground()) X.startReload(X.G.player); });
  IN.on("interact", () => {
    if (!ground()) return;
    const P = X.G.player;
    if (X.nearestKnockedMate(P)) return; // holding E revives instead
    const o = X.nearestWeaponLoot(P);
    if (o) X.giveWeapon(P, o);
  });
  const selSlot = i => { if (!ground()) return; const P = X.G.player; if (P.slots[i] && P.cur !== i) { P.cur = i; P.reloadT = 0; P.fireCd = 0.35; SND.sfx("pick", 0.5); } };
  IN.on("slot0", () => selSlot(0));
  IN.on("slot1", () => selSlot(1));
  IN.on("holster", () => { if (ground()) X.G.player.cur = -1; });
  IN.on("cycle", () => { if (!ground()) return; const P = X.G.player, n = P.cur === 0 ? 1 : 0; if (P.slots[n]) selSlot(n); });
  IN.on("grenade", () => { if (ground() && !(X.G.cs && X.G.cs.phase === "buy")) { const d = camDir(); X.throwGrenade(X.G.player, d[0], d[1] + 0.15, d[2]); } });
  IN.on("gloo", () => { if (!ground()) return; if (!X.placeGloo(X.G.player, X.G.cam.yaw)) X.toast("🧊 No gloo walls left"); });
  IN.on("skill", () => {
    if (!ground()) return;
    const P = X.G.player;
    if (P.skillCd > 0) X.toast(`⏳ Skill ready in ${Math.ceil(P.skillCd)}s`); else X.useSkill(P);
  });
  IN.on("heal", () => { if (ground() && !X.smartHeal(X.G.player)) X.toast(X.G.player.hp >= 75 && X.G.player.items.medkit === 0 ? "Bandages only heal up to 75" : "Nothing to heal with"); });
  IN.on("drink", () => { if (ground() && !X.startUse(X.G.player, "drink")) X.toast("No energy drink (or boost full)"); });
  IN.on("aim", () => { if (playing()) X.G.adsToggle = !X.G.adsToggle; });
  IN.on("emote", toggleEmotes);
  IN.on("shop", toggleShop);
  IN.on("score", () => { if (X.G && X.state !== "lobby") { X.renderScoreboard(); $("scoreboard").classList.toggle("hidden"); } });
  IN.on("scoreUp", () => { if (X.G && !(X.G.cs && X.G.cs.phase === "end")) $("scoreboard").classList.add("hidden"); });
  IN.on("map", toggleMap);
  IN.on("pause", () => (X.state === "paused" ? resume() : pause()));
  IN.on("escape", () => {
    if (X.G && X.G.mapOpen) toggleMap();
    else if (!$("buyMenu").classList.contains("hidden")) toggleShop();
    else if (!$("scoreboard").classList.contains("hidden")) $("scoreboard").classList.add("hidden");
    else if (X.state === "paused") resume();
  });
  function toggleMap() {
    const G = X.G;
    if (!G || !(X.state === "play" || X.state === "plane" || X.state === "dead")) return;
    G.mapOpen = !G.mapOpen;
    $("mapFull").classList.toggle("hidden", !G.mapOpen);
    if (G.mapOpen) { X.exitLock(); drawFullMap(); } else X.requestLock();
  }
  function toggleShop() {
    const G = X.G;
    if (!G || !G.cs) return;
    const el = $("buyMenu");
    if (el.classList.contains("hidden")) {
      if (G.cs.phase !== "buy") { X.toast("🛒 The shop is open during the buy phase"); return; }
      X.renderBuy(); el.classList.remove("hidden"); X.exitLock();
    } else { el.classList.add("hidden"); X.requestLock(); }
  }
  function toggleEmotes() {
    const el = $("emoteWheel");
    if (!X.G) return;
    if (el.classList.contains("hidden")) {
      el.innerHTML = Object.entries(BR3.EMOTES).map(([k, e]) => `<button data-e="${k}" title="${e.name}">${e.icon}</button>`).join("");
      el.classList.remove("hidden"); X.exitLock();
    } else { el.classList.add("hidden"); X.requestLock(); }
  }
  $("emoteWheel").addEventListener("click", e => {
    const b = e.target.closest("[data-e]");
    if (!b || !ground()) return;
    X.G.player.emote = { type: b.dataset.e, t: 0, dur: 4 };
    $("emoteWheel").classList.add("hidden");
    X.requestLock();
  });
  $("buyGrid").addEventListener("click", e => {
    const b = e.target.closest("[data-i]");
    if (!b || !X.G || !X.G.cs) return;
    if (X.applyBuy(X.G.player, BR3.CS_SHOP[+b.dataset.i])) SND.sfx("pick"); else SND.sfx("empty");
    X.renderBuy();
  });
  $("buyClose").onclick = toggleShop;
  $("shopBtn").onclick = toggleShop;
  $("emoteBtn").onclick = toggleEmotes;
  $("scoreBtn").onclick = () => { if (X.G) { X.renderScoreboard(); $("scoreboard").classList.toggle("hidden"); } };
  $("scoreboard").addEventListener("click", () => { if (!(X.G && X.G.cs && X.G.cs.phase === "end")) $("scoreboard").classList.add("hidden"); });
  $("mapBtn").onclick = toggleMap;
  $("mapClose").onclick = toggleMap;
  $("pauseBtn").onclick = () => (X.state === "paused" ? resume() : pause());
  document.querySelectorAll("#slots .slot").forEach(el => {
    const fn = e => { e.preventDefault(); e.stopPropagation(); selSlot(+el.dataset.slot); };
    el.addEventListener("touchstart", fn, { passive: false });
    el.addEventListener("mousedown", fn);
  });

  // ---- menus that live here
  const onClick = (id, fn) => $(id).addEventListener("click", e => { SND.init(); SND.sfx("click"); fn(e); });
  onClick("resumeBtn", resume);
  onClick("pauseSet", () => X.openSettings("pause"));
  onClick("quitBtn", () => {
    const G = X.G;
    if (G && G.training) { X.state = "over"; X.showResults(false); return; }
    X.toLobby();
  });
  onClick("againBtn", X.startMatch);
  onClick("lobbyBtn", X.toLobby);
  onClick("specBtn", () => {
    const G = X.G;
    G.spec = G.killer && G.killer.alive ? G.killer : G.fighters.find(f => f.alive);
    X.hideScreens();
    $("specBar").classList.remove("hidden");
    $("specName").textContent = "👁️ " + (G.spec ? G.spec.name : "");
  });
  onClick("specNext", () => {
    const G = X.G, alive = G.fighters.filter(f => f.alive);
    if (!alive.length) return;
    G.spec = alive[(alive.indexOf(G.spec) + 1) % alive.length];
    $("specName").textContent = "👁️ " + G.spec.name;
  });
  onClick("specLeave", () => {
    const G = X.G;
    G.spec = null;
    if (!G.teamOut && !G.over) { G.placement = new Set(G.fighters.filter(f => f.alive).map(f => f.team)).size; }
    X.showResults(false);
  });
  document.querySelectorAll("[data-back]").forEach(b => b.addEventListener("click", () => { SND.sfx("click"); X.back(); }));
  $("charTabs").addEventListener("click", e => { const b = e.target.closest("[data-t]"); if (!b) return; charTab = b.dataset.t; X.openChars(); });
  $("charSearch").addEventListener("input", e => { charQ = e.target.value; renderCharGrid(); });
  $("charGrid").addEventListener("click", e => {
    const b = e.target.closest(".cc");
    if (!b) return;
    X.selected = BR.CHARACTERS.find(c => c.code === b.dataset.code);
    X.S.char = X.selected.code; X.applySettings();
    SND.init(); X.speakAs(X.selected, X.selected.phrase, true);
    renderCharGrid();
    setTimeout(X.toLobby, 250);
  });
  $("sName").addEventListener("change", e => { const v = e.target.value.trim().slice(0, 16); if (v) { PROG.data.name = v; PROG.save(); } });
  [["sSens", "sens"], ["sMusic", "music"], ["sSfx", "sfx"], ["sVoice", "voice"]].forEach(([id, k]) => $(id).addEventListener("input", e => { X.S[k] = +e.target.value; X.applySettings(); }));
  [["sAssist", "assist"], ["sInvert", "invert"], ["sVib", "vib"], ["sFps", "fps"]].forEach(([id, k]) => $(id).addEventListener("change", e => { X.S[k] = e.target.checked; X.applySettings(); }));
  $("sQuality").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; X.S.quality = b.dataset.v; X.applySettings(); X.openSettings(backTo); });
  onClick("resetBtn", () => { if (confirm("Delete your level, coins, items and stats?")) { localStorage.removeItem("brr-profile"); location.reload(); } });
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
      if (X.state === "lobby" || X.state === "loading") { if (X.WORLD) renderLobby(now / 1000, dt); }
      else if (X.G) {
        if (["play", "plane", "dead", "over"].includes(X.state)) update(dt);
        updateCamera(); render(); overlay(); hud();
      }
    } catch (err) {
      console.error(err);
      if (!frame.reported) { frame.reported = true; X.toast("⚠️ " + err.message); }
    }
    requestAnimationFrame(frame);
  }

  // =================================================================== boot
  X.applySettings();
  setTimeout(() => {
    try { X.WORLD = BR3.buildWorld((Math.random() * 1e9) | 0, R, X.S.quality); }
    catch (e) { $("loadMsg").textContent = "Failed to build the world: " + e.message; console.error(e); return; }
    $("loading").classList.add("hidden");
    X.toLobby();
  }, 30);
  requestAnimationFrame(frame);

  // debug/test hook: fast-forward the simulation
  const sim = secs => { for (let t = 0; t < secs && X.G && !X.G.resultsShown; t += 1 / 30) update(1 / 30); };
  window.__br = { get G() { return X.G; }, get state() { return X.state; }, get WORLD() { return X.WORLD; }, S: X.S, sim, X };
})();
