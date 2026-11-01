// Brainrot Royale combat: shooting, damage, knock/revive, kills, pickups, gloo walls, grenades, skills, physics.
(() => {
  "use strict";
  const BR3 = window.BR3, BR = window.BR, SND = BR.Audio, X = BR3.X;
  if (!X.R) return;
  const { $, clamp, rand, pick, lerp, esc, wrapA, fwd, rightOf } = X;
  const WD = BR3.WEAPONS, AMMO = BR3.AMMO, ITEMS = BR3.ITEMS, ARMOR = BR3.ARMOR, SK = BR3.SKILLS;

  // ------------------------------------------------------------------ ray helpers
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
  X.coneDir = (dx, dy, dz, deg) => {
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
  };
  X.muzzleOf = f => {
    // the rig stores the real gun-barrel tip every frame it draws the character
    if (f._mz && performance.now() / 1000 - f._mzT < 0.25) return f._mz.slice();
    const [fx, fz] = fwd(f.yaw), [rx, rz] = rightOf(f.yaw);
    return [f.x + fx * 0.6 + rx * 0.14, f.y + (f.crouch ? 0.98 : 1.38), f.z + fz * 0.6 + rz * 0.14];
  };

  // ------------------------------------------------------------------ shooting
  function traceShot(f, ox, oy, oz, d, range, w, mz) {
    const G = X.G, W = X.WORLD;
    const tObs = W.raycast(ox, oy, oz, d[0], d[1], d[2], range);
    const hitOb = W.lastHit;
    let best = tObs, hitF = null, hitY = 0;
    for (const o of G.fighters) {
      if (o === f || !o.alive || o.phase !== "ground" || !X.enemies(o, f)) continue; // bullets pass through teammates
      const ddx = o.x - ox, ddz = o.z - oz;
      if (ddx * ddx + ddz * ddz > (range + 2) * (range + 2)) continue;
      const t = rayCyl(ox, oy, oz, d[0], d[1], d[2], o.x, o.z, o.knocked ? 0.55 : 0.42, o.y, o.y + X.fHeight(o), Math.min(best, range));
      if (t < best) { best = t; hitF = o; hitY = oy + d[1] * t; }
    }
    const end = Math.min(best, range);
    const ex = ox + d[0] * end, ey = oy + d[1] * end, ez = oz + d[2] * end;
    G.tracers.push({ ax: mz[0], ay: mz[1], az: mz[2], bx: ex, by: ey, bz: ez, life: 0.07, col: f.tracer || (f.isPlayer ? [1, 0.9, 0.5] : [1, 0.75, 0.4]) });
    if (hitF) {
      const head = !hitF.knocked && hitY > hitF.y + X.fHeight(hitF) - 0.36;
      const dist = Math.hypot(hitF.x - f.x, hitF.z - f.z);
      X.damage(hitF, f, w.dmg * (dist > w.range ? 0.55 : 1), head, w.short, ex, ey, ez);
      for (let i = 0; i < 5; i++) G.parts.push({ x: ex, y: ey, z: ez, vx: rand(-2, 2), vy: rand(0, 3), vz: rand(-2, 2), life: 0.35, col: [0.75, 0.05, 0.05], s: 0.06 });
    } else if (tObs < range) {
      if (hitOb && hitOb.kind === "gloo") X.damageGloo(hitOb, w.dmg, ex, ey, ez);
      const col = hitOb && hitOb.kind === "gloo" ? [0.6, 1, 0.85] : [0.75, 0.7, 0.6];
      for (let i = 0; i < 4; i++) G.parts.push({ x: ex, y: ey, z: ez, vx: rand(-1.5, 1.5), vy: rand(0, 2.5), vz: rand(-1.5, 1.5), life: 0.4, col, s: 0.05 });
      if (f.isPlayer) X.sfxAt("bullethit", ex, ez, 0.6);
    }
  }
  X.fireWeapon = (f, ox, oy, oz, dx, dy, dz, spread) => {
    const G = X.G, slot = X.weaponOf(f), w = WD[slot.id];
    if (!(G.infinite && f.isPlayer)) slot.mag--;
    f.fireCd = 60 / w.rpm;
    f.emote = null;
    const mz = X.muzzleOf(f);
    for (let i = 0; i < w.pellets; i++) traceShot(f, ox, oy, oz, X.coneDir(dx, dy, dz, spread), w.range * 1.6, w, mz);
    X.sfxAt(w.sound, f.x, f.z, f.isPlayer ? 1 : 0.85);
    // muzzle flash (2 layers) + ejected shell casing
    G.parts.push({ x: mz[0], y: mz[1], z: mz[2], vx: 0, vy: 0, vz: 0, life: 0.05, col: [1, 0.95, 0.7], s: 0.12, g: 0 });
    G.parts.push({ x: mz[0], y: mz[1], z: mz[2], vx: 0, vy: 0, vz: 0, life: 0.06, col: f.tracer || [1, 0.6, 0.15], s: 0.26, g: 0 });
    if (X.hearVol(f.x, f.z) > 0.4) {
      const [rx, rz] = rightOf(f.yaw);
      G.parts.push({ x: mz[0] - Math.sin(f.yaw) * 0.4, y: mz[1], z: mz[2] - Math.cos(f.yaw) * 0.4, vx: rx * rand(1.5, 2.5), vy: rand(1.5, 2.5), vz: rz * rand(1.5, 2.5), life: 0.5, col: [0.85, 0.65, 0.2], s: 0.025 });
    }
    const P = G.player;
    if (X.enemies(f, P) && P.alive) {
      const range = P.pet === "owl" ? 220 : 110;
      if (Math.hypot(f.x - P.x, f.z - P.z) < range) G.pings.push({ x: f.x, z: f.z, t: 1.2 });
    }
    if (slot.mag <= 0 && f.ammo[w.ammo] > 0) X.startReload(f);
  };
  X.startReload = f => {
    const slot = X.weaponOf(f);
    if (!slot || f.reloadT > 0 || f.knocked) return;
    const w = WD[slot.id];
    if (slot.mag >= w.mag || f.ammo[w.ammo] <= 0) return;
    f.reloadT = w.reload * (X.has(f, "hands") ? 0.8 : 1);
    f.useT = 0; f.useItem = null;
    if (f.isPlayer) SND.sfx("reload");
  };
  X.finishReload = f => {
    const slot = X.weaponOf(f);
    if (!slot) return;
    const w = WD[slot.id], need = w.mag - slot.mag, take = Math.min(need, f.ammo[w.ammo]);
    slot.mag += take; f.ammo[w.ammo] -= take;
  };
  X.punch = f => {
    if (f.punchT > 0) return;
    f.punchT = 0.55;
    const [fx, fz] = fwd(f.yaw);
    for (const o of X.G.fighters) {
      if (o === f || !o.alive || o.phase !== "ground" || !X.enemies(o, f)) continue;
      const dx = o.x - f.x, dz = o.z - f.z, d = Math.hypot(dx, dz);
      if (d < 1.6 && (dx * fx + dz * fz) / (d || 1) > 0.5 && Math.abs(o.y - f.y) < 1.2) {
        X.damage(o, f, 14, false, "👊", o.x, o.y + 1.3, o.z);
        break;
      }
    }
    X.sfxAt("step", f.x, f.z);
  };

  // ------------------------------------------------------------------ damage / knock / kill
  X.teamMode = () => X.G && X.G.teamSize > 1;
  X.hasStandingMate = t => X.G.fighters.some(o => o !== t && o.team === t.team && X.standing(o));

  X.damage = (t, a, base, head, wname, hx, hy, hz) => {
    const G = X.G;
    if (!t.alive) return;
    if (a && a !== t && !X.enemies(a, t)) return; // no friendly fire
    let d = base;
    if (head) {
      const aw = a && X.weaponOf(a);
      d *= (aw ? WD[aw.id].head : 1.5) * (1 - ARMOR.helmet.reduce[t.helmet]) * (a && X.has(a, "hunter") ? 1.12 : 1);
    } else d *= 1 - ARMOR.vest.reduce[t.vest];
    if (a && !a.isPlayer) d *= G.diff.dmg;
    if (t.buffs.iron > 0) d *= 0.55;
    if (X.has(t, "thick")) d *= 0.92;
    d = Math.max(1, Math.round(d));
    t.hitT = 0.25; t.hurtT = G.t; t.emote = null;
    if (a) { a.dmg += d; t.lastHitBy = a; if (head) a.heads++; }
    if (t.isPlayer) {
      if (a) G.indicators.push({ a: Math.atan2(a.x - t.x, a.z - t.z), t: 1.2 });
      SND.sfx("hurt", 0.7);
      X.vibrate(40);
      G.shake = Math.max(G.shake, 0.25);
    }
    if (t.useT > 0) { t.useT = 0; t.useItem = null; }
    if (t.reviveOf) { t.reviveOf = null; t.reviveT = 0; }
    if (a && a.isPlayer) {
      G.dmgNums.push({ x: hx, y: hy + 0.3, z: hz, v: d, head, t: 0.8 });
      G.hitmT = 0.18; G.hitmKind = head ? "head" : "";
      SND.sfx(head ? "headshot" : "hitmark");
    }
    if (!t.isPlayer && a) { t.ai.enemy = a; t.ai.seenT = G.t; t.ai.react = Math.min(t.ai.react, 0.15); }
    if (t.knocked) {
      t.bleed -= d;
      if (t.bleed <= 0) X.kill(t, a || t.knockedBy, wname, head);
      return;
    }
    t.hp -= d;
    if (t.hp <= 0) {
      if (G.teamSize > 1 && !t.dummy && X.hasStandingMate(t)) X.knock(t, a, wname, head);
      else X.kill(t, a, wname, head);
    }
  };

  X.knock = (t, a, wname, head) => {
    const G = X.G;
    t.knocked = true; t.hp = 0; t.bleed = 100; t.knockedBy = a; t.useT = 0; t.reloadT = 0; t.crouch = false; t.emote = null; t.reviveOf = null;
    const who = a ? (a.isPlayer ? "You" : a.name) : "The zone";
    X.feed(`${esc(who)} <b>${esc(wname || "")}</b>${head ? " 🎯" : ""} 🔻 ${esc(t.isPlayer ? "You" : t.name)} <i>(knocked)</i>`, (a && a.isPlayer) || t.isPlayer || t.team === G.player.team);
    if (a && a.isPlayer) { SND.sfx("knock"); X.killBanner(head ? "🎯" : "🔻", head ? "HEADSHOT · KNOCKED" : "KNOCKED DOWN"); }
    if (t.isPlayer) { X.center("YOU'RE KNOCKED!", "Crawl to cover · a teammate can revive you", 3); SND.sfx("lose"); }
    else if (t.team === G.player.team) X.toast(`🩸 ${t.name} is knocked! Hold E / ➕ next to them to revive`);
  };

  X.revive = (t, by) => {
    t.knocked = false; t.hp = 30; t.bleed = 0; t.knockedBy = null; t.hitT = 0;
    by.reviveOf = null; by.reviveT = 0;
    X.feed(`${esc(by.isPlayer ? "You" : by.name)} ➕ revived ${esc(t.isPlayer ? "you" : t.name)}`, by.isPlayer || t.isPlayer);
    if (t.isPlayer || by.isPlayer) SND.sfx("heal");
    if (t.isPlayer) X.center("REVIVED!", `${by.name} picked you up`, 1.8);
  };

  X.kill = (t, a, wname, head) => {
    const G = X.G;
    if (!t.alive) return;
    t.alive = false; t.dead = true; t.deadT = 0; t.hp = 0; t.useT = 0; t.reloadT = 0; t.crouch = false; t.knocked = false; t.emote = null;
    t.deaths++;
    G.alive--;
    if (t.dummy) { t.respawnT = 2.5; }
    else {
      const drop = [];
      for (const s of t.slots) if (s) drop.push({ kind: "weapon", id: s.id, mag: s.mag });
      for (const k in t.ammo) if (t.ammo[k] > 0) drop.push({ kind: "ammo", type: k, n: t.ammo[k] });
      for (const k in t.items) if (t.items[k] > 0) drop.push({ kind: "item", type: k, n: t.items[k] });
      if (t.vest) drop.push({ kind: "vest", lvl: t.vest });
      if (t.helmet) drop.push({ kind: "helmet", lvl: t.helmet });
      drop.forEach((o, i) => {
        const ang = (i / Math.max(1, drop.length)) * Math.PI * 2;
        X.addLoot(o, t.x + Math.cos(ang) * 1.1, t.z + Math.sin(ang) * 1.1, Math.max(t.y, X.WORLD.groundAt(t.x, t.z, t.y + 1)));
      });
    }
    const how = a ? `${esc(a.isPlayer ? "You" : a.name)} <b>${esc(wname || "")}</b>${head ? " 🎯" : ""} 💀 ${esc(t.isPlayer ? "You" : t.name)}` : `${esc(t.isPlayer ? "You" : t.name)} got lost in the zone 🌀`;
    X.feed(how, (a && a.isPlayer) || t.isPlayer || t.team === G.player.team);
    if (a && a !== t) {
      a.kills++;
      a.streak = G.t - a.lastKillT < 9 ? a.streak + 1 : 1;
      a.lastKillT = G.t;
      if (G.cs) a.coins += 150;
      if (a.pet === "panda" && a.isPlayer) a.buffs.petHeal = 5;
    }
    if (a && a.isPlayer && !t.dummy) {
      SND.sfx("knock");
      G.hitmKind = "kill"; G.hitmT = 0.35;
      const firstBlood = !G.firstBlood;
      const label = BR3.STREAKS[Math.min(a.streak, BR3.STREAKS.length - 1)] || (head ? "HEADSHOT" : firstBlood ? "FIRST BLOOD" : "ELIMINATED");
      X.killBanner(head ? "🎯" : a.streak >= 2 ? "🔥" : "💀", label || "ELIMINATED");
      X.center(`💀 ${t.name.toUpperCase()}`, `${a.kills} kill${a.kills > 1 ? "s" : ""}${head ? " · HEADSHOT" : ""}`, 1.8);
      if (a.kills === 1 || Math.random() < 0.4) X.speakAs(X.selected, pick(BR3.KILL_LINES), false);
    } else if (a && a.isPlayer && t.dummy) { SND.sfx("knock"); G.hitmKind = "kill"; G.hitmT = 0.35; X.killBanner(head ? "🎯" : "💀", head ? "HEADSHOT" : "TARGET DOWN"); }
    G.firstBlood = true;
    if (t.isPlayer) X.playerDied(a);
    if (a && !a.isPlayer && a.alive && G.player.alive && Math.hypot(a.x - G.player.x, a.z - G.player.z) < 45 && Math.random() < 0.3) X.speakAs(a.ch, a.ch.phrase, false);
    // everyone left on that team is knocked -> they are eliminated too
    if (G.teamSize > 1 && !t.dummy) {
      const mates = G.fighters.filter(o => o.team === t.team && o.alive);
      if (mates.length && mates.every(o => o.knocked)) mates.forEach(o => X.kill(o, o.knockedBy, "🩸", false));
    }
    X.checkEnd();
  };

  // ------------------------------------------------------------------ items / loot
  X.canUse = (f, type) => {
    const n = f.items[type];
    if (!n || f.knocked) return false;
    if (type === "bandage") return f.hp < ITEMS.bandage.cap;
    if (type === "medkit") return f.hp < 100;
    if (type === "drink") return f.boost < 100;
    return false;
  };
  X.startUse = (f, type) => {
    if (!X.canUse(f, type) || f.useT > 0) return false;
    f.useItem = type; f.useT = f.useMax = ITEMS[type].time * (X.has(f, "medic") ? 0.65 : 1); f.reloadT = 0; f.emote = null;
    return true;
  };
  X.finishUse = f => {
    const it = f.useItem, I = ITEMS[it];
    f.items[it]--;
    if (it === "drink") f.boost = Math.min(100, f.boost + I.boost);
    else f.hp = Math.min(I.cap, f.hp + I.heal);
    if (f.isPlayer) SND.sfx("heal");
    f.useItem = null; f.useT = 0;
  };
  X.smartHeal = f => {
    if (f.hp < 45 && X.canUse(f, "medkit")) return X.startUse(f, "medkit");
    if (X.canUse(f, "bandage")) return X.startUse(f, "bandage");
    if (X.canUse(f, "medkit")) return X.startUse(f, "medkit");
    return false;
  };
  X.giveWeapon = (f, o) => {
    let slot = f.slots[0] ? (f.slots[1] ? -1 : 1) : 0;
    let dropped = null;
    if (slot < 0) { slot = f.cur >= 0 ? f.cur : 0; dropped = f.slots[slot]; }
    f.slots[slot] = { id: o.id, mag: o.mag != null ? o.mag : Math.min(WD[o.id].mag, Math.ceil(WD[o.id].mag * 0.5)) };
    if (f.cur < 0 || dropped || !f.slots[f.cur]) f.cur = slot;
    f.reloadT = 0;
    if (dropped) X.addLoot({ kind: "weapon", id: dropped.id, mag: dropped.mag }, f.x + rand(-0.6, 0.6), f.z + rand(-0.6, 0.6), f.y);
    o.taken = true;
    if (f.isPlayer) { SND.sfx("pick"); X.toast(`${WD[o.id].icon} ${WD[o.id].name}`); }
  };
  X.autoPickup = f => {
    const G = X.G;
    if (f.knocked) return;
    for (const o of G.loot) {
      if (o.taken) continue;
      const dx = o.x - f.x, dz = o.z - f.z;
      if (dx * dx + dz * dz > 2.6 || Math.abs(o.y - f.y) > 1.6) continue;
      if (o.kind === "ammo") {
        const room = AMMO[o.type].max - f.ammo[o.type];
        const gain = Math.round(o.n * (X.has(f, "scav") ? 1.3 : 1));
        const take = Math.min(room, gain);
        if (take <= 0) continue;
        f.ammo[o.type] += take; o.taken = true;
        if (f.isPlayer) { SND.sfx("pick", 0.6); X.toast(`${AMMO[o.type].icon} +${take} ${AMMO[o.type].name}`); }
        const w = X.weaponOf(f);
        if (w && w.mag === 0) X.startReload(f);
      } else if (o.kind === "item") {
        const room = ITEMS[o.type].max - f.items[o.type], take = Math.min(room, o.n);
        if (take <= 0) continue;
        f.items[o.type] += take; o.n -= take;
        if (o.n <= 0) o.taken = true;
        if (f.isPlayer) { SND.sfx("pick", 0.6); X.toast(`${ITEMS[o.type].icon} +${take} ${ITEMS[o.type].name}`); }
      } else if (o.kind === "vest" || o.kind === "helmet") {
        if (o.lvl <= f[o.kind]) continue;
        const old = f[o.kind];
        f[o.kind] = o.lvl; o.taken = true;
        if (old) X.addLoot({ kind: o.kind, lvl: old }, f.x + rand(-0.6, 0.6), f.z + rand(-0.6, 0.6), f.y);
        if (f.isPlayer) { SND.sfx("armor"); X.toast(`${ARMOR[o.kind].icon} ${ARMOR[o.kind].name} Lv.${o.lvl} equipped`); }
      } else if (o.kind === "weapon") {
        const has = f.slots.some(s => s && s.id === o.id);
        if (!has && (!f.slots[0] || !f.slots[1])) X.giveWeapon(f, o);
        else if (!f.isPlayer && !has) {
          const R = X.RARITY_ORDER;
          const worst = f.slots[0] && f.slots[1] ? (R.indexOf(WD[f.slots[0].id].rarity) <= R.indexOf(WD[f.slots[1].id].rarity) ? 0 : 1) : -1;
          if (worst >= 0 && R.indexOf(WD[o.id].rarity) > R.indexOf(WD[f.slots[worst].id].rarity)) { f.cur = worst; X.giveWeapon(f, o); }
        }
      }
    }
  };
  X.nearestWeaponLoot = (f, maxD = 2.3) => {
    let best = null, bd = maxD * maxD;
    for (const o of X.G.loot) {
      if (o.taken || o.kind !== "weapon") continue;
      const d = (o.x - f.x) ** 2 + (o.z - f.z) ** 2;
      if (d < bd && Math.abs(o.y - f.y) < 1.6) { bd = d; best = o; }
    }
    return best;
  };
  X.nearestKnockedMate = (f, maxD = 1.9) => {
    let best = null, bd = maxD * maxD;
    for (const o of X.G.fighters) {
      if (o === f || !o.alive || !o.knocked || o.team !== f.team) continue;
      const d = (o.x - f.x) ** 2 + (o.z - f.z) ** 2;
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  };
  X.reviveTime = f => (f.pet === "dog" ? 3.25 : 5);

  // ------------------------------------------------------------------ gloo walls
  X.placeGloo = (f, yaw, free = false) => {
    const G = X.G, W = X.WORLD;
    if (!free) { if (f.items.gloo <= 0 || f.knocked || f.phase !== "ground") return false; f.items.gloo--; }
    const hp = 140 * (X.has(f, "gloo") ? 1.4 : 1);
    const wall = { segs: [], life: 30, owner: f, grow: 0 };
    for (let i = -2; i <= 2; i++) {
      const a = yaw + i * 0.3, r = 2.5;
      const x = f.x + Math.sin(a) * r, z = f.z + Math.cos(a) * r;
      const gy = W.groundAt(x, z, f.y + 1);
      const seg = W.addDyn({ x0: x - 0.55, x1: x + 0.55, y0: gy - 0.3, y1: gy + 2.25, z0: z - 0.55, z1: z + 0.55, kind: "gloo", hp, max: hp, wall, cx: x, cz: z, gy });
      wall.segs.push(seg);
    }
    G.gloos.push(wall);
    X.sfxAt("armor", f.x, f.z, 1);
    for (let i = 0; i < 14; i++) G.parts.push({ x: f.x + Math.sin(yaw) * 2.5, y: f.y + rand(0.2, 2), z: f.z + Math.cos(yaw) * 2.5, vx: rand(-2, 2), vy: rand(0, 2), vz: rand(-2, 2), life: 0.5, col: [0.6, 1, 0.85], s: 0.1 });
    return true;
  };
  X.damageGloo = (seg, dmg, x, y, z) => {
    seg.hp -= dmg;
    if (seg.hp <= 0) {
      X.WORLD.removeDyn(seg);
      seg.broken = true;
      for (let i = 0; i < 10; i++) X.G.parts.push({ x: seg.cx, y: seg.gy + rand(0.2, 2), z: seg.cz, vx: rand(-3, 3), vy: rand(0, 4), vz: rand(-3, 3), life: 0.6, col: [0.6, 1, 0.85], s: 0.14 });
      X.sfxAt("bullethit", seg.cx, seg.cz, 1);
    }
  };
  X.updateGloos = dt => {
    const G = X.G;
    for (const g of G.gloos) {
      g.life -= dt; g.grow = Math.min(1, g.grow + dt * 5);
      if (g.life <= 0) g.segs.forEach(s => X.WORLD.removeDyn(s));
    }
    G.gloos = G.gloos.filter(g => g.life > 0 && g.segs.some(s => !s.broken));
  };
  X.clearGloos = () => { for (const g of X.G.gloos) g.segs.forEach(s => X.WORLD.removeDyn(s)); X.G.gloos = []; };

  // ------------------------------------------------------------------ grenades
  X.throwGrenade = (f, dx, dy, dz) => {
    if (f.items.grenade <= 0 || f.useT > 0 || f.knocked) return;
    f.items.grenade--;
    const m = X.muzzleOf(f), sp = 17;
    X.G.grenades.push({ x: m[0], y: m[1] + 0.2, z: m[2], vx: dx * sp, vy: dy * sp + 4.5, vz: dz * sp, fuse: 3, owner: f });
    X.sfxAt("pin", f.x, f.z);
  };
  X.updateGrenades = dt => {
    const G = X.G, W = X.WORLD;
    for (const g of G.grenades) {
      g.vy -= 18 * dt;
      const nx = g.x + g.vx * dt, nz = g.z + g.vz * dt, ny = g.y + g.vy * dt;
      const tmp = [];
      W.query(nx - 0.2, nz - 0.2, nx + 0.2, nz + 0.2, tmp);
      const blocked = tmp.some(o => nx > o.x0 && nx < o.x1 && nz > o.z0 && nz < o.z1 && ny > o.y0 && ny < o.y1);
      if (blocked) { g.vx *= -0.35; g.vz *= -0.35; } else { g.x = nx; g.z = nz; }
      g.y = ny;
      const gy = W.groundAt(g.x, g.z, g.y + 0.3);
      if (g.y < gy + 0.13) { g.y = gy + 0.13; g.vy = Math.abs(g.vy) > 2 ? -g.vy * 0.35 : 0; g.vx *= 0.7; g.vz *= 0.7; }
      g.fuse -= dt;
      if (g.fuse <= 0) explode(g);
    }
    G.grenades = G.grenades.filter(g => g.fuse > 0);
  };
  function explode(g) {
    const G = X.G;
    X.sfxAt("boom", g.x, g.z, 1.2);
    for (let i = 0; i < 40; i++) G.parts.push({ x: g.x, y: g.y + 0.3, z: g.z, vx: rand(-7, 7), vy: rand(1, 9), vz: rand(-7, 7), life: rand(0.4, 0.9), col: Math.random() < 0.5 ? [1, 0.55, 0.1] : [0.35, 0.33, 0.3], s: rand(0.12, 0.3) });
    for (const gl of G.gloos) for (const s of gl.segs) if (!s.broken && Math.hypot(s.cx - g.x, s.cz - g.z) < 5) X.damageGloo(s, 250, s.cx, s.gy + 1, s.cz);
    for (const f of G.fighters) {
      if (!f.alive || f.phase !== "ground") continue;
      if (g.owner && f !== g.owner && !X.enemies(f, g.owner)) continue;
      const d = Math.hypot(f.x - g.x, f.y + 0.9 - g.y, f.z - g.z);
      if (d > 8) continue;
      if (!X.WORLD.lineClear(g.x, g.y + 0.4, g.z, f.x, f.y + 1, f.z)) continue;
      X.damage(f, f === g.owner ? null : g.owner, 110 * (1 - d / 8), false, "💣", f.x, f.y + 1.2, f.z);
    }
    if (Math.hypot(G.player.x - g.x, G.player.z - g.z) < 25) G.shake = Math.max(G.shake, 0.6);
  }

  // ------------------------------------------------------------------ skills
  X.useSkill = f => {
    const G = X.G;
    if (f.skillCd > 0 || !f.alive || f.knocked || f.phase !== "ground") return false;
    const S = SK[f.skill];
    if (!S) return false;
    f.skillCd = S.cd;
    f.emote = null;
    switch (f.skill) {
      case "medic": f.buffs.medic = S.dur; break;
      case "turbo": f.buffs.turbo = S.dur; break;
      case "iron": f.buffs.iron = S.dur; break;
      case "radar": f.buffs.radar = S.dur; break;
      case "dome": for (let i = 0; i < 4; i++) X.placeGloo(f, f.yaw + i * Math.PI / 2, true); break;
      case "rush": {
        const w = X.weaponOf(f);
        if (w) { const wd = WD[w.id], take = Math.min(wd.mag - w.mag, f.ammo[wd.ammo]); w.mag += take; f.ammo[wd.ammo] -= take; f.reloadT = 0; }
        f.boost = Math.min(100, f.boost + 40); f.hp = Math.min(100, f.hp + 20);
        break;
      }
    }
    X.sfxAt(f.skill === "dome" ? "armor" : "heal", f.x, f.z, 0.9);
    for (let i = 0; i < 16; i++) G.parts.push({ x: f.x, y: f.y + rand(0.2, 1.8), z: f.z, vx: rand(-2, 2), vy: rand(0.5, 2.5), vz: rand(-2, 2), life: 0.6, col: [0.65, 0.5, 1], s: 0.08 });
    if (f.isPlayer) { X.toast(`${S.icon} ${S.name}!`); X.speakAs(X.selected, S.name + "!", false); }
    return true;
  };
  X.updateBuffs = (f, dt) => {
    const G = X.G, B = f.buffs;
    f.skillCd = Math.max(0, f.skillCd - dt);
    for (const k in B) B[k] = Math.max(0, B[k] - dt);
    if (B.medic > 0) for (const o of G.fighters) if (o.alive && !o.knocked && o.team === f.team && Math.hypot(o.x - f.x, o.z - f.z) < 6) o.hp = Math.min(100, o.hp + 7 * dt);
    if (B.petHeal > 0 && f.alive && !f.knocked) f.hp = Math.min(100, f.hp + 4 * dt);
  };

  // ------------------------------------------------------------------ physics
  X.physics = (f, wx, wz, speed, dt) => {
    const W = X.WORLD;
    const k = clamp((f.onGround ? 11 : 2.5) * dt, 0, 1);
    f.vx += (wx * speed - f.vx) * k;
    f.vz += (wz * speed - f.vz) * k;
    f.x += f.vx * dt; f.z += f.vz * dt;
    W.collide(f, 0.38, X.fHeight(f));
    if (X.G && X.G.bounds) {
      const b = X.G.bounds, dx = f.x - b.x, dz = f.z - b.z, d = Math.hypot(dx, dz);
      if (d > b.r) { f.x = b.x + (dx / d) * b.r; f.z = b.z + (dz / d) * b.r; }
    }
    f.vy -= 18 * dt;
    f.y += f.vy * dt;
    const g = W.groundAt(f.x, f.z, f.y + 0.05);
    if (f.y <= g) {
      if (!f.onGround && f.vy < -12 && f.isPlayer) SND.sfx("land", 0.6);
      if (!f.onGround && f.vy < -6 && X.G && X.hearVol(f.x, f.z) > 0.3) dust(f, 10, 2.2);
      f.y = g; f.vy = 0; f.onGround = true;
    } else if (f.y > g + 0.08) f.onGround = false;
    const sp = Math.hypot(f.vx, f.vz);
    f.moving = clamp(sp / 4.5, 0, 1);
    f.walk += sp * dt * 2.1;
    if (sp > 0.6 && f.emote) f.emote = null;
    if (f.onGround && sp > 1.5) {
      f.stepT -= dt * sp / 4.5;
      if (f.stepT <= 0) {
        f.stepT = 0.36;
        if (f.isPlayer) SND.sfx("step", 0.5); else X.sfxAt("step", f.x, f.z, 0.9);
        if (X.G && sp > 4 && X.hearVol(f.x, f.z) > 0.45) dust(f, 2, 0.6);
      }
    }
  };
  // floating dust puffs at the feet (g < 0 = drifts upward slowly)
  function dust(f, n, spd) {
    const P = X.G.parts;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      P.push({ x: f.x + Math.cos(a) * 0.2, y: f.y + 0.06, z: f.z + Math.sin(a) * 0.2, vx: Math.cos(a) * spd * rand(0.5, 1) - f.vx * 0.08, vy: rand(0.2, 0.6), vz: Math.sin(a) * spd * rand(0.5, 1) - f.vz * 0.08, life: rand(0.4, 0.7), col: [0.72, 0.65, 0.52], s: rand(0.06, 0.11), g: -0.4 });
    }
  }
  X.dust = dust;
  X.speedMul = f => (f.buffs.turbo > 0 ? 1.45 : 1) * (X.has(f, "sprint") ? 1.06 : 1) * (f.boost > 60 ? 1.06 : 1);
  X.updateFall = (f, wx, wz, dt, wantPara) => {
    const W = X.WORLD;
    const g = W.heightAt(f.x, f.z);
    if (!f.para && (wantPara || f.y - g < 50)) { f.para = true; if (f.isPlayer) SND.sfx("wind"); }
    const hs = f.para ? 9 : 17;
    f.vx += (wx * hs - f.vx) * clamp(2 * dt, 0, 1);
    f.vz += (wz * hs - f.vz) * clamp(2 * dt, 0, 1);
    f.vy = f.para ? lerp(f.vy, -5.2, clamp(3 * dt, 0, 1)) : Math.max(f.vy - 18 * dt, -34);
    f.x = clamp(f.x + f.vx * dt, 5, W.S - 5); f.z = clamp(f.z + f.vz * dt, 5, W.S - 5);
    f.y += f.vy * dt;
    if (wx || wz) f.yaw = Math.atan2(f.vx, f.vz);
    const gg = W.groundAt(f.x, f.z, f.y + 0.1, 3);
    if (f.y <= gg) {
      f.y = gg; f.vy = 0; f.phase = "ground"; f.para = false; f.onGround = true; f.landT = X.G.t;
      W.collide(f, 0.38, 1.85);
      if (f.pet === "robo") f.items.gloo = Math.min(ITEMS.gloo.max, f.items.gloo + 2);
      if (f.isPlayer) { SND.sfx("land"); SND.music.stop(); X.center("LANDED", "Find a weapon fast!", 1.8); }
    }
  };
  X.leavePlane = f => {
    const G = X.G;
    f.phase = "fall";
    f.x = G.plane.x + rand(-2, 2); f.z = G.plane.z + rand(-2, 2); f.y = G.plane.y - 3;
    f.vx = Math.sin(G.plane.yaw) * 20; f.vz = Math.cos(G.plane.yaw) * 20; f.vy = 0;
    if (f.isPlayer) {
      $("dropBtn").classList.add("hidden");
      SND.sfx("wind");
      X.center("🪂 FREEFALL", BR3.Input.mode === "touch" ? "Steer with the stick · tap JUMP to open the parachute" : "Steer with WASD · SPACE opens the parachute", 3);
      // squad mates jump right after you and follow you down
      let k = 0;
      for (const m of G.fighters) if (!m.isPlayer && m.team === f.team && m.phase === "plane") { m.dropT = G.plane.t + 0.35 + k * 0.3; m.followLeader = true; k++; }
    }
  };
})();
