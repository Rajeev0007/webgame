// Brainrot Royale modes: Battle Royale (classic/ranked, solo/duo/squad), Clash Squad (4v4 rounds), Training.
(() => {
  "use strict";
  const BR3 = window.BR3, BR = window.BR, SND = BR.Audio, X = BR3.X;
  if (!X.R) return;
  const { $, clamp, rand, pick, lerp, esc } = X;
  const WD = BR3.WEAPONS, AMMO = BR3.AMMO, ITEMS = BR3.ITEMS, ZONE = BR3.ZONE, PROG = BR3.Progress;

  function baseG(cfg) {
    const M = BR3.MODES[cfg.mode];
    let diff = Object.assign({}, BR3.DIFF[X.S.diff] || BR3.DIFF.normal);
    if (M.ranked) {
      const idx = PROG.rankOf(M.cs ? PROG.data.cs.pts : PROG.data.br.pts).idx;
      diff.aim *= Math.max(0.6, 1 - idx * 0.06); diff.react *= Math.max(0.6, 1 - idx * 0.05); diff.dmg = Math.min(1.1, diff.dmg + idx * 0.03);
    }
    return {
      cfg, mode: cfg.mode, M, teamSize: M.cs ? 4 : M.training || M.online ? 1 : cfg.team, t: 0, diff,
      fighters: [], loot: [], tracers: [], parts: [], grenades: [], gloos: [], dmgNums: [], indicators: [], pings: [],
      alive: 0, ads: false, adsToggle: false, prevFire: false, bloom: 0,
      cam: { x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 1, yaw: 0, pitch: -0.1, dist: 3.4 }, fov: 1.2,
      mapOpen: false, spec: null, placement: 0, killer: null, startT: performance.now(), shake: 0, hitmT: 0,
      plane: { t: 1, dur: 0, x: 0, z: 0, y: 0, yaw: 0, sx: 0, sz: 0, ex: 0, ez: 0 },
      zone: { x: 0, z: 0, r: 9999, nx: 0, nz: 0, nr: 9999, fx: 0, fz: 0, fr: 9999, phase: 0, mode: "done", t: 0, dps: 0 },
      cs: null, training: false, bounds: null, infinite: false, over: false, teamOut: false, resultsShown: false,
    };
  }

  X.makeG = cfg => baseG(cfg);
  // ================================================================ start
  X.startMatch = () => {
    SND.init();
    X.hideScreens();
    BR3.Input.clear();
    ["specBar", "mapFull", "scoreboard", "buyMenu", "emoteWheel"].forEach(id => $(id).classList.add("hidden"));
    $("feed").innerHTML = "";
    X.WORLD.dyn.length = 0;
    const cfg = { mode: X.S.mode, team: X.S.team };
    if (BR3.MODES[cfg.mode] && BR3.MODES[cfg.mode].online) { X.G = null; return BR3.Net.start(); }
    const G = (X.G = baseG(cfg));
    document.body.classList.toggle("cs", !!G.M.cs);
    if (G.M.cs) startCS(G);
    else if (G.M.training) startTraining(G);
    else startBR(G);
    G.alive = G.fighters.filter(f => f.alive).length;
    $("hud").classList.remove("hidden");
    $("shopBtn").classList.toggle("hidden", !G.M.cs);
    if (BR3.Input.mode === "desktop") X.requestLock();
  };

  // ---------------------------------------------------------------- battle royale
  function startBR(G) {
    const ts = G.teamSize, total = ts === 4 ? 48 : 50;
    const pool = BR.CHARACTERS.filter(c => c.code !== X.selected.code).sort(() => Math.random() - 0.5);
    const P = X.makeFighter(X.selected, true, 0, { team: 0 });
    G.player = P; G.fighters.push(P);
    for (let i = 1; i < total; i++) G.fighters.push(X.makeFighter(pool[i - 1], false, i, { team: Math.floor(i / ts) }));
    for (const sp of X.WORLD.lootSpots) {
      if (Math.random() > (sp.indoor ? 0.9 : 0.75)) continue;
      const o = X.lootFrom(X.rollLoot());
      X.addLoot(o, sp.x, sp.z, sp.y);
      if (o.kind === "weapon") { const a = WD[o.id].ammo; X.addLoot({ kind: "ammo", type: a, n: AMMO[a].box * 2 }, sp.x + rand(-0.8, 0.8), sp.z + rand(-0.8, 0.8), sp.y); }
    }
    const c = X.WORLD.center, a = Math.random() * Math.PI * 2;
    const dx = Math.cos(a), dz = Math.sin(a), off = rand(-110, 110);
    const sx = c.x - dx * 330 - dz * off, sz = c.z - dz * 330 + dx * off, ex = c.x + dx * 330 - dz * off, ez = c.z + dz * 330 + dx * off;
    const len = Math.hypot(ex - sx, ez - sz);
    G.plane = { sx, sz, ex, ez, len, dur: len / 42, t: 0, x: sx, z: sz, y: 135, yaw: Math.atan2(ex - sx, ez - sz) };
    const teamPlan = {};
    for (const f of G.fighters) {
      f.phase = "plane";
      if (f.isPlayer) continue;
      if (f.team === P.team) { f.dropT = G.plane.dur * 0.97; f.target = { x: c.x, z: c.z }; continue; } // mates follow the player
      if (!teamPlan[f.team]) {
        const spot = Math.random() < 0.65 ? pick(X.WORLD.towns) : X.randomLand();
        const tx = spot.x + rand(-25, 25), tz = spot.z + rand(-25, 25);
        const proj = ((tx - sx) * dx + (tz - sz) * dz) / len;
        teamPlan[f.team] = { tx, tz, dropT: clamp(proj + rand(-0.04, 0.04), 0.08, 0.92) * G.plane.dur };
      }
      const tp = teamPlan[f.team];
      f.dropT = tp.dropT + rand(0, 0.5);
      f.target = { x: tp.tx + rand(-8, 8), z: tp.tz + rand(-8, 8) };
    }
    let zx = c.x, zz = c.z;
    for (let i = 0; i < 30; i++) { const tx = c.x + rand(-60, 60), tz = c.z + rand(-60, 60); if (X.WORLD.heightAt(tx, tz) > 0.8) { zx = tx; zz = tz; break; } }
    G.zone = { x: zx, z: zz, r: 360, nx: zx, nz: zz, nr: 360, fx: zx, fz: zz, fr: 360, phase: 0, mode: "wait", t: G.plane.dur + 45, dps: ZONE[0].dps };
    chooseNextZone(G, true);
    G.cam.yaw = G.plane.yaw;
    X.state = "plane";
    $("dropBtn").classList.remove("hidden");
    SND.music.start(); SND.music.setIntense(false); SND.sfx("plane");
    const teamTxt = G.teamSize === 4 ? "SQUAD" : G.teamSize === 2 ? "DUO" : "SOLO";
    X.center(`${G.M.ranked ? "RANKED" : "CLASSIC"} · ${teamTxt}`, BR3.Input.mode === "touch" ? "Tap 🪂 JUMP over a good spot" : "Press SPACE to jump out", 4);
    X.speakAs(X.selected, X.selected.phrase, true);
  }
  function chooseNextZone(G, first) {
    const Z = G.zone, ph = ZONE[Z.phase];
    const nr = first ? 205 : Z.r * ph.frac;
    let nx = Z.x, nz = Z.z;
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * Math.max(0, Z.r - nr) * (first ? 0.4 : 1);
      const tx = Z.x + Math.cos(a) * d, tz = Z.z + Math.sin(a) * d;
      if (X.WORLD.heightAt(tx, tz) > 0.8 || i === 59) { nx = tx; nz = tz; break; }
    }
    Z.nx = nx; Z.nz = nz; Z.nr = nr;
  }
  X.updateZone = dt => {
    const G = X.G, Z = G.zone;
    if (G.cs || G.training || Z.mode === "done") return;
    Z.t -= dt;
    if (Z.mode === "wait") {
      if (Z.t <= 0) {
        Z.mode = "shrink"; Z.fx = Z.x; Z.fz = Z.z; Z.fr = Z.r;
        Z.t = ZONE[Z.phase].shrink; Z.dur = Z.t; Z.dps = ZONE[Z.phase].dps;
        SND.sfx("zone");
        X.center("⚠️ SAFE ZONE IS SHRINKING", "Get inside the white circle", 3);
      }
    } else if (Z.mode === "shrink") {
      const k = 1 - Math.max(0, Z.t) / Z.dur;
      Z.x = lerp(Z.fx, Z.nx, k); Z.z = lerp(Z.fz, Z.nz, k); Z.r = lerp(Z.fr, Z.nr, k);
      if (Z.t <= 0) {
        Z.x = Z.nx; Z.z = Z.nz; Z.r = Z.nr; Z.phase++;
        if (Z.phase >= ZONE.length || Z.r <= 1) { Z.mode = "done"; Z.dps = ZONE[ZONE.length - 1].dps; }
        else { Z.mode = "wait"; Z.t = ZONE[Z.phase].wait; chooseNextZone(G, false); X.toast(`🗺️ New safe zone marked · phase ${Z.phase + 1}`); }
      }
    }
  };
  X.outsideZone = f => Math.hypot(f.x - X.G.zone.x, f.z - X.G.zone.z) > X.G.zone.r;

  // ---------------------------------------------------------------- clash squad
  function startCS(G) {
    const W = X.WORLD;
    const towns = W.towns.slice().sort((a, b) => W.buildings.filter(x => x.town === b).length - W.buildings.filter(x => x.town === a).length);
    const T = pick(towns.slice(0, 3));
    let spawns = null;
    for (let i = 0; i < 24 && !spawns; i++) {
      const a = Math.random() * Math.PI * 2;
      const A = X.openSpot(T.x + Math.cos(a) * 38, T.z + Math.sin(a) * 38, 6, 3), B = X.openSpot(T.x - Math.cos(a) * 38, T.z - Math.sin(a) * 38, 6, 3);
      if (W.heightAt(A.x, A.z) > 1 && W.heightAt(B.x, B.z) > 1) spawns = [A, B];
    }
    if (!spawns) spawns = [{ x: T.x + 30, z: T.z }, { x: T.x - 30, z: T.z }];
    G.cs = { round: 0, score: [0, 0], target: 4, phase: "buy", t: 10, A: { x: T.x, z: T.z }, spawns, town: T.name, lastWinner: -1, roundsWon: 0 };
    G.bounds = { x: T.x, z: T.z, r: 88 };
    const pool = BR.CHARACTERS.filter(c => c.code !== X.selected.code).sort(() => Math.random() - 0.5);
    const P = X.makeFighter(X.selected, true, 0, { team: 0 });
    G.player = P; G.fighters.push(P);
    for (let i = 1; i < 8; i++) G.fighters.push(X.makeFighter(pool[i - 1], false, i, { team: i < 4 ? 0 : 1 }));
    for (const f of G.fighters) { f.phase = "ground"; f.coins = 800; f.onGround = true; }
    G.zone = { x: T.x, z: T.z, r: 85, nx: T.x, nz: T.z, nr: 14, fx: T.x, fz: T.z, fr: 85, phase: 0, mode: "cs", t: 0, dps: 6 };
    X.state = "play";
    X.csNewRound();
    SND.music.start(); SND.music.setIntense(true);
    X.speakAs(X.selected, X.selected.phrase, true);
  }
  function spawnAt(f, i, sp, A) {
    const a = Math.atan2(A.x - sp.x, A.z - sp.z), perp = a + Math.PI / 2, k = (i % 4) - 1.5;
    f.x = sp.x + Math.sin(perp) * k * 2.2; f.z = sp.z + Math.cos(perp) * k * 2.2;
    f.y = X.WORLD.groundAt(f.x, f.z, 99); f.yaw = a; f.vx = f.vy = f.vz = 0;
    f.spawn = { x: f.x, z: f.z };
    if (f.isPlayer) { X.G.cam.yaw = a; X.G.cam.pitch = -0.08; }
  }
  X.csNewRound = () => {
    const G = X.G, C = G.cs;
    C.round++; C.phase = "buy"; C.t = 10;
    G.loot = []; G.grenades = []; X.clearGloos(); G.tracers = []; G.parts = [];
    G.zone.r = 85;
    const idx = [0, 0];
    for (const f of G.fighters) {
      if (!f.alive) { f.slots = [null, null]; f.cur = -1; f.vest = 0; f.helmet = 0; for (const k in f.ammo) f.ammo[k] = 0; for (const k in f.items) f.items[k] = 0; }
      f.alive = true; f.dead = false; f.knocked = false; f.hp = 100; f.boost = 0; f.bleed = 0; f.useT = 0; f.reloadT = 0; f.reviveOf = null; f.emote = null; f.skillCd = Math.min(f.skillCd, 10);
      for (const k in f.buffs) f.buffs[k] = 0;
      if (C.round > 1) f.coins += 500 + (f.team === C.lastWinner ? 200 : 0);
      if (!f.slots[0] && !f.slots[1]) { f.slots[0] = { id: "pistol", mag: 15 }; f.cur = 0; }
      if (f.cur < 0) f.cur = f.slots[0] ? 0 : 1;
      f.ammo.light = Math.max(f.ammo.light, 60);
      f.items.gloo = Math.min(ITEMS.gloo.max, f.items.gloo + 2 + (f.pet === "robo" ? 2 : 0));
      f.items.bandage = Math.max(f.items.bandage, 2);
      spawnAt(f, idx[f.team]++, C.spawns[f.team], C.A);
      if (!f.isPlayer) botBuy(f);
      X.syncDraw(f);
    }
    G.alive = G.fighters.length;
    G.spec = null;
    $("specBar").classList.add("hidden");
    X.center(`ROUND ${C.round}`, "Buy phase · open the 🛒 shop", 2.2);
    SND.sfx("zone");
    if (G.player) { X.renderBuy(); $("buyMenu").classList.remove("hidden"); X.exitLock(); }
  };
  function botBuy(f) {
    const has = id => f.slots.some(s => s && s.id === id);
    const buy = (o) => { if (f.coins < o.cost) return false; X.applyBuy(f, o); return true; };
    const shop = BR3.CS_SHOP;
    if (!f.slots.some(s => s && s.id !== "pistol")) {
      const opts = shop.filter(o => o.kind === "weapon" && o.cost <= f.coins - 150).sort((a, b) => b.cost - a.cost);
      if (opts.length) buy(Math.random() < 0.7 ? opts[0] : pick(opts));
    }
    if (f.vest < 2) buy(shop.find(o => o.kind === "vest" && o.lvl === 2));
    if (f.helmet < 2 && Math.random() < 0.6) buy(shop.find(o => o.kind === "helmet" && o.lvl === 2));
    if (Math.random() < 0.5) buy(shop.find(o => o.kind === "item" && o.type === "gloo"));
    if (Math.random() < 0.3) buy(shop.find(o => o.kind === "item" && o.type === "grenade"));
    void has;
  }
  X.applyBuy = (f, o) => {
    if (f.coins < o.cost) return false;
    if (o.kind === "weapon") {
      if (f.slots.some(s => s && s.id === o.id)) return false;
      const empty = f.slots[0] ? (f.slots[1] ? -1 : 1) : 0;
      // replace the pistol / current gun when both slots are full
      const slot = empty >= 0 ? empty : (f.slots[0].id === "pistol" ? 0 : f.slots[1].id === "pistol" ? 1 : Math.max(0, f.cur));
      f.slots[slot] = { id: o.id, mag: WD[o.id].mag };
      f.cur = slot;
      const am = WD[o.id].ammo;
      f.ammo[am] = Math.min(AMMO[am].max, f.ammo[am] + WD[o.id].mag * 3);
    } else if (o.kind === "vest" || o.kind === "helmet") {
      if (f[o.kind] >= o.lvl) return false;
      f[o.kind] = o.lvl;
    } else {
      const max = ITEMS[o.type].max;
      if (f.items[o.type] >= max) return false;
      f.items[o.type] = Math.min(max, f.items[o.type] + o.n);
    }
    f.coins -= o.cost;
    X.syncDraw(f);
    return true;
  };
  X.renderBuy = () => {
    const G = X.G, P = G.player;
    if (!G.cs) return;
    $("buyCoins").textContent = P.coins;
    $("buyGrid").innerHTML = BR3.CS_SHOP.map((o, i) => {
      let label, icon, owned = false;
      if (o.kind === "weapon") { label = WD[o.id].name; icon = WD[o.id].icon; owned = P.slots.some(s => s && s.id === o.id); }
      else if (o.kind === "item") { label = `${ITEMS[o.type].name} ×${o.n}`; icon = ITEMS[o.type].icon; }
      else { label = `${BR3.ARMOR[o.kind].name} Lv.${o.lvl}`; icon = BR3.ARMOR[o.kind].icon; owned = P[o.kind] >= o.lvl; }
      return `<button data-i="${i}" class="${owned ? "owned" : ""}" ${P.coins < o.cost || owned || !P.alive ? "disabled" : ""}><span style="font-size:22px">${icon}</span><b>${esc(label)}</b><small>${owned ? "✓ owned" : "🪙 " + o.cost}</small></button>`;
    }).join("");
  };
  X.csUpdate = dt => {
    const G = X.G, C = G.cs;
    if (!C) return;
    C.t -= dt;
    if (C.phase === "buy") {
      for (const f of G.fighters) {
        if (!f.spawn) continue;
        const dx = f.x - f.spawn.x, dz = f.z - f.spawn.z, d = Math.hypot(dx, dz);
        if (d > 5) { f.x = f.spawn.x + (dx / d) * 5; f.z = f.spawn.z + (dz / d) * 5; }
      }
      $("buyTime").textContent = `⏱ ${Math.ceil(C.t)}s`;
      if (C.t <= 0) {
        C.phase = "fight"; C.t = 100;
        $("buyMenu").classList.add("hidden");
        X.center("FIGHT!", `Round ${C.round} · ${C.score[0]} - ${C.score[1]}`, 1.5);
        SND.sfx("knock");
        if (BR3.Input.mode === "desktop") X.requestLock();
      }
    } else if (C.phase === "fight") {
      const el = 100 - C.t;
      if (el > 40) G.zone.r = lerp(85, 14, clamp((el - 40) / 40, 0, 1));
      if (C.t <= 0) {
        const hp = team => G.fighters.filter(f => f.team === team && f.alive).reduce((s, f) => s + (f.knocked ? 0 : f.hp), 0);
        endRound(hp(0) >= hp(1) ? 0 : 1, "Time up!");
      }
    } else if (C.phase === "end") {
      if (C.t <= 0) {
        $("scoreboard").classList.add("hidden");
        if (C.score[0] >= C.target || C.score[1] >= C.target) X.showResults(C.score[0] >= C.target);
        else X.csNewRound();
      }
    }
  };
  function endRound(winner, why) {
    const G = X.G, C = G.cs;
    if (C.phase !== "fight") return;
    C.phase = "end"; C.t = 4.5;
    C.score[winner]++;
    C.lastWinner = winner;
    if (winner === 0) C.roundsWon++;
    const won = winner === G.player.team;
    X.center(won ? "🏆 ROUND WON" : "ROUND LOST", `${why ? why + " · " : ""}${C.score[0]} - ${C.score[1]}`, 3);
    SND.sfx(won ? "booyah" : "lose");
    X.renderScoreboard();
    $("scoreboard").classList.remove("hidden");
    if (C.score[0] >= C.target || C.score[1] >= C.target) { G.over = true; X.state = "over"; X.exitLock(); }
  }
  function csCheckRound() {
    const G = X.G, C = G.cs;
    if (C.phase !== "fight") return;
    const standing = t => G.fighters.some(f => f.team === t && f.alive && !f.knocked);
    if (!standing(0)) endRound(1, "Squad eliminated");
    else if (!standing(1)) endRound(0, "Enemy squad eliminated");
  }

  // ---------------------------------------------------------------- training
  function startTraining(G) {
    const W = X.WORLD;
    G.training = true; G.infinite = true;
    const T = W.towns[0];
    const spot = X.openSpot(T.x, T.z, 90, 9);
    const P = X.makeFighter(X.selected, true, 0, { team: 0 });
    G.player = P; G.fighters.push(P);
    P.phase = "ground"; P.x = spot.x; P.z = spot.z; P.y = W.groundAt(spot.x, spot.z, 99); P.onGround = true;
    // pick the direction with the longest clear view for the range
    let bestA = 0, bestD = 0;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, t = W.raycast(P.x, P.y + 1.2, P.z, Math.sin(a), 0, Math.cos(a), 120);
      const d = t === Infinity ? 120 : t;
      if (d > bestD) { bestD = d; bestA = a; }
    }
    P.yaw = bestA; G.cam.yaw = bestA; G.cam.pitch = -0.05;
    const pool = BR.CHARACTERS.filter(c => c.code !== X.selected.code).sort(() => Math.random() - 0.5);
    const dists = [8, 14, 22, 32, 45, 60, 80, Math.min(110, bestD - 5)];
    dists.forEach((d, i) => {
      const a = bestA + (i % 2 ? 1 : -1) * (0.08 + (i % 3) * 0.06);
      const f = X.makeFighter(pool[i], false, i + 1, { team: 1 });
      f.dummy = true; f.phase = "ground"; f.onGround = true;
      f.x = P.x + Math.sin(a) * d; f.z = P.z + Math.cos(a) * d; f.y = W.groundAt(f.x, f.z, P.y + 4);
      f.yaw = Math.atan2(P.x - f.x, P.z - f.z);
      f.home = { x: f.x, z: f.z };
      f.vest = i % 4; f.helmet = (i + 1) % 3;
      f.strafer = i === 2 || i === 5;
      f.name = `${d} m · ${f.ch.name}`;
      G.fighters.push(f);
    });
    // weapon rack behind the player
    const ids = Object.keys(WD);
    ids.forEach((id, i) => {
      const a = bestA + Math.PI + (i - (ids.length - 1) / 2) * 0.32;
      X.addLoot({ kind: "weapon", id, mag: WD[id].mag }, P.x + Math.sin(a) * 4, P.z + Math.cos(a) * 4);
    });
    for (const k in AMMO) P.ammo[k] = AMMO[k].max;
    P.items.gloo = 8; P.items.grenade = 4; P.items.bandage = 10; P.items.medkit = 3; P.items.drink = 5;
    P.vest = 3; P.helmet = 3;
    X.giveWeapon(P, { id: "ar", mag: 30 });
    X.state = "play";
    X.center("🎯 TRAINING GROUND", "Targets at 8–110 m · weapons behind you · unlimited ammo", 4);
  }
  X.updateTraining = dt => {
    const G = X.G, P = G.player;
    G.refillT = (G.refillT || 0) - dt;
    if (G.refillT <= 0) {
      G.refillT = 1;
      for (const k in AMMO) P.ammo[k] = AMMO[k].max;
      P.items.gloo = Math.max(P.items.gloo, 4); P.items.grenade = Math.max(P.items.grenade, 2);
      if (P.hp < 100 && G.t - P.hurtT > 3) P.hp = Math.min(100, P.hp + 10);
    }
    for (const f of G.fighters) {
      if (!f.dummy) continue;
      if (!f.alive) {
        f.respawnT -= dt;
        if (f.respawnT <= 0) { f.alive = true; f.dead = false; f.hp = 100; f.x = f.home.x; f.z = f.home.z; f.y = X.WORLD.groundAt(f.x, f.z, f.y + 3); G.alive++; }
        continue;
      }
      if (f.strafer) {
        const s = Math.sin(G.t * 0.9 + f.id);
        X.physics(f, Math.cos(f.yaw) * s, -Math.sin(f.yaw) * s, 3.2, dt);
        const dx = f.x - f.home.x, dz = f.z - f.home.z;
        if (Math.hypot(dx, dz) > 6) { f.x = f.home.x + dx * 0.98; f.z = f.home.z + dz * 0.98; }
      }
      f.yaw = Math.atan2(P.x - f.x, P.z - f.z);
      if (f.hitT > 0) f.hitT -= dt;
    }
  };

  // ================================================================ end of match
  X.checkEnd = () => {
    const G = X.G;
    if (!G || G.over || G.training || G.online) return;
    if (G.cs) return csCheckRound();
    const teams = new Set(G.fighters.filter(f => f.alive).map(f => f.team));
    G.teamsAlive = teams.size;
    const my = G.player.team;
    if (!teams.has(my) && !G.teamOut) {
      G.teamOut = true;
      G.placement = teams.size + 1;
      X.state = "dead";
      setTimeout(() => { if (X.G === G) { G.spec = null; X.showResults(false); } }, 2200);
    } else if (teams.size === 1 && teams.has(my)) {
      G.over = true; G.placement = 1; X.state = "over";
      SND.sfx("booyah"); SND.music.setIntense(true);
      X.speakAs(X.selected, pick(BR3.WIN_LINES), true);
      X.center("🏆 BOOYAH!", "WINNER WINNER, AURA DINNER", 4);
      for (const f of G.fighters) if (f.alive && f.team === my) f.emote = { type: "victory", t: 0 };
      setTimeout(() => X.showResults(true), 2400);
    }
  };
  X.playerDied = killer => {
    const G = X.G, P = G.player;
    G.killer = killer;
    G.mapOpen = false; $("mapFull").classList.add("hidden");
    SND.sfx("lose"); X.vibrate(250);
    const mate = G.fighters.find(f => f.alive && f.team === P.team && f !== P);
    if (G.cs) { X.center("YOU'RE OUT", mate ? `Spectating ${mate.name}` : "", 2); G.spec = mate || null; return; }
    X.exitLock();
    if (mate) {
      X.state = "dead";
      G.spec = mate;
      $("specBar").classList.remove("hidden");
      $("specName").textContent = "👁️ " + mate.name;
      X.center("YOU'RE OUT", "Your squad is still fighting", 2.5);
      return;
    }
    X.state = "dead";
    X.center("YOU GOT RATIO'D 💀", killer ? `by ${killer.name}` : "the zone got you", 3);
  };

  X.showResults = won => {
    const G = X.G;
    if (!G || G.resultsShown) return;
    G.resultsShown = true;
    X.exitLock();
    const P = G.player;
    const secs = Math.round((performance.now() - G.startT) / 1000);
    const C = G.cs;
    const teamsTotal = G.cs ? 2 : G.training ? 1 : Math.ceil(G.fighters.length / G.teamSize);
    const m = {
      mode: G.mode, ranked: !!G.M.ranked, cs: !!C, won, placement: G.placement || (won ? 1 : teamsTotal), total: teamsTotal,
      kills: P.kills, dmg: P.dmg, heads: P.heads, secs, rounds: C ? C.round : 0, roundsWon: C ? C.roundsWon : 0, score: C ? `${C.score[0]}-${C.score[1]}` : "", code: P.code,
    };
    const rw = BR3.Progress.reward(m);
    const pl = $("rPlace");
    pl.className = "place" + (won ? " win" : "");
    if (C) pl.innerHTML = `${C.score[0]}<small> - </small>${C.score[1]}`;
    else if (G.training) pl.innerHTML = `🎯`;
    else pl.innerHTML = `#${m.placement}<small>/${teamsTotal}</small>`;
    $("rTitle").textContent = G.training ? "Training complete" : won ? (C ? "🏆 VICTORY!" : "🏆 BOOYAH! WINNER WINNER, AURA DINNER") : C ? "DEFEAT" : m.placement <= 10 ? "So close! Top 10 🔥" : "You got ratio'd 💀";
    const mvp = G.fighters.filter(f => f.team === P.team).sort((a, b) => b.kills * 100 + b.dmg - (a.kills * 100 + a.dmg))[0];
    $("rSub").textContent = G.training ? `${P.kills} targets down · ${P.heads} headshots` : won ? `${X.selected.name} has been elected! MVP: ${mvp.isPlayer ? "You" : mvp.name}` : G.killer ? `Eliminated by ${G.killer.name}` : C ? "Better luck next match" : "The zone got you.";
    $("rStats").innerHTML = `<div>💀 Kills: <b>${P.kills}</b></div><div>💥 Damage: <b>${Math.round(P.dmg)}</b></div>
      <div>🎯 Headshots: <b>${P.heads}</b></div><div>⏱️ Time: <b>${Math.floor(secs / 60)}m ${secs % 60}s</b></div>`;
    const rp = m.ranked ? `<span class="${rw.pts >= 0 ? "up" : "down"}">🏆 ${rw.pts >= 0 ? "+" : ""}${rw.pts} RP</span>` : "";
    $("rRewards").innerHTML = `<span>⭐ +${rw.xp} XP</span><span>🪙 +${rw.coins}</span>${rw.diamonds ? `<span>💎 +${rw.diamonds}</span>` : ""}${rp}${rw.levelUps ? `<span class="up">⬆️ LEVEL ${BR3.Progress.data.level}!</span>` : ""}`;
    $("specBtn").classList.toggle("hidden", won || !G.fighters.some(f => f.alive) || !!C || G.training);
    $("specBar").classList.add("hidden");
    $("buyMenu").classList.add("hidden");
    $("scoreboard").classList.add("hidden");
    X.show("results");
  };
})();
