// Brainrot Royale bots: looting, fighting (team-aware), following the squad, reviving, gloo walls, skills.
(() => {
  "use strict";
  const BR3 = window.BR3, X = BR3.X;
  if (!X.R) return;
  const { clamp, rand, pick, wrapA } = X;
  const WD = BR3.WEAPONS, AMMO = BR3.AMMO, ITEMS = BR3.ITEMS;

  function leaderOf(b) {
    const G = X.G;
    if (b.team !== G.player.team) return null;
    if (G.player.alive && G.player !== b) return G.player;
    return G.fighters.find(f => f.alive && !f.knocked && f.team === b.team && f !== b && f.id < b.id) || null;
  }

  function think(b) {
    const G = X.G, ai = b.ai, Z = G.zone, w = X.weaponOf(b);
    const longGun = b.slots.some(s => s && (s.id === "sniper" || s.id === "dmr"));
    const range = longGun ? 150 : G.cs ? 110 : 80;
    // ---- find the nearest visible enemies
    const cands = [];
    for (const o of G.fighters) {
      if (o === b || !o.alive || o.phase !== "ground" || !X.enemies(o, b)) continue;
      const d2 = (o.x - b.x) ** 2 + (o.z - b.z) ** 2;
      if (d2 < range * range) cands.push([d2, o]);
    }
    cands.sort((a, c) => a[0] - c[0]);
    let vis = null;
    for (let i = 0; i < Math.min(3, cands.length); i++) {
      const o = cands[i][1];
      const hide = o.crouch && cands[i][0] > 50 * 50 && Math.random() < 0.5;
      if (!hide && X.WORLD.lineClear(b.x, X.eyeY(b), b.z, o.x, o.y + 1.0, o.z)) { vis = o; break; }
    }
    if (vis) {
      if (ai.enemy !== vis) ai.react = G.diff.react * rand(0.7, 1.4);
      ai.enemy = vis; ai.seenT = G.t; ai.lastX = vis.x; ai.lastZ = vis.z;
    } else if (ai.enemy && (G.t - ai.seenT > 5 || !ai.enemy.alive)) ai.enemy = null;
    ai.visible = !!vis;

    if (b.knocked) { ai.mode = "crawl"; return; }
    if (G.cs && G.cs.phase === "buy") { ai.mode = "wait"; return; }

    const hasAmmo = w && (w.mag > 0 || b.ammo[WD[w.id].ammo] > 0);
    const dz = Math.hypot(b.x - Z.x, b.z - Z.z);
    const danger = !G.cs && Z.mode !== "done" && (dz > Z.r - 4 || ((Z.mode === "shrink" || (Z.mode === "wait" && Z.t < 20)) && Math.hypot(b.x - Z.nx, b.z - Z.nz) > Z.nr - 6));
    const csOut = G.cs && dz > Z.r - 3;
    const knockedMate = G.teamSize > 1 ? G.fighters.find(o => o.alive && o.knocked && o.team === b.team && Math.hypot(o.x - b.x, o.z - b.z) < 45) : null;
    const lead = leaderOf(b);
    const fresh = G.t - (b.landT || 0) < 18 && !G.cs;
    const close = ai.enemy && Math.hypot(ai.enemy.x - b.x, ai.enemy.z - b.z) < 12;

    if ((danger || csOut) && !(ai.visible && dz < Z.r - 10)) {
      ai.mode = "run";
      const tx = Z.mode === "wait" || Z.mode === "shrink" ? Z.nx : Z.x, tz = Z.mode === "wait" || Z.mode === "shrink" ? Z.nz : Z.z;
      const rr = G.cs ? Math.max(4, Z.r * 0.5) : Z.mode === "done" ? 0 : Math.max(5, (Z.mode === "shrink" || Z.t < 20 ? Z.nr : Z.r) * 0.5);
      if (!ai.goal || ai.goalT < G.t || Math.hypot(ai.goal.x - tx, ai.goal.z - tz) > rr + 5) {
        const a = Math.random() * Math.PI * 2, d = Math.random() * rr;
        ai.goal = { x: tx + Math.cos(a) * d, z: tz + Math.sin(a) * d }; ai.goalT = G.t + 12;
      }
    } else if (knockedMate && (!ai.visible || Math.hypot(ai.enemy.x - b.x, ai.enemy.z - b.z) > 35)) {
      ai.mode = "revive"; ai.goal = { x: knockedMate.x, z: knockedMate.z }; ai.reviveTarget = knockedMate;
    } else if (ai.enemy && (hasAmmo || (close && !X.weaponOf(ai.enemy))) && (!fresh || G.t - b.hurtT < 4 || close)) {
      ai.mode = "fight";
    } else if (b.hp < 70 && (X.canUse(b, "medkit") || X.canUse(b, "bandage")) && G.t - ai.seenT > 3) {
      ai.mode = "heal";
    } else if (G.cs) {
      // push toward the enemy side of the arena
      ai.mode = "roam";
      const enemySpawn = G.cs.spawns[1 - b.team];
      const tgt = ai.enemy && G.t - ai.seenT < 6 ? { x: ai.lastX, z: ai.lastZ } : { x: (G.cs.A.x + enemySpawn.x) / 2, z: (G.cs.A.z + enemySpawn.z) / 2 };
      if (!ai.goal || ai.goalT < G.t || Math.hypot(ai.goal.x - b.x, ai.goal.z - b.z) < 3) { ai.goal = { x: tgt.x + rand(-15, 15), z: tgt.z + rand(-15, 15) }; ai.goalT = G.t + rand(4, 8); }
    } else {
      // loot if something useful is close
      const unarmed = !b.slots[0] && !b.slots[1];
      let best = null, bd = (unarmed ? 90 : 45) ** 2;
      const leadFar = lead && Math.hypot(lead.x - b.x, lead.z - b.z) > 22;
      if (!leadFar) for (const o of G.loot) {
        if (o.taken) continue;
        let d2 = (o.x - b.x) ** 2 + (o.z - b.z) ** 2;
        if (d2 > bd) continue;
        let useful = false;
        if (o.kind === "weapon") {
          useful = !b.slots[0] || !b.slots[1] || (X.RARITY_ORDER.indexOf(WD[o.id].rarity) >= 2 && !b.slots.some(s => s && s.id === o.id));
          if (useful && unarmed) d2 *= 0.3;
        } else if (o.kind === "ammo") useful = b.slots.some(s => s && WD[s.id].ammo === o.type) && b.ammo[o.type] < AMMO[o.type].max * 0.5;
        else if (o.kind === "item") useful = b.items[o.type] < Math.min(3, ITEMS[o.type].max);
        else useful = o.lvl > b[o.kind];
        if (lead && Math.hypot(o.x - lead.x, o.z - lead.z) > 25) useful = false;
        if (useful) { best = o; bd = d2; }
      }
      if (best) { ai.mode = "loot"; ai.goal = { x: best.x, z: best.z }; ai.goalT = G.t + 8; }
      else if (lead) {
        ai.mode = "follow";
        const dl = Math.hypot(lead.x - b.x, lead.z - b.z);
        if (!ai.goal || dl > 12 || ai.goalT < G.t) {
          const a = lead.yaw + Math.PI + rand(-1.2, 1.2), r = rand(3, 7);
          ai.goal = { x: lead.x + Math.sin(a) * r, z: lead.z + Math.cos(a) * r }; ai.goalT = G.t + rand(3, 6);
        }
      } else {
        ai.mode = "roam";
        if (!ai.goal || ai.goalT < G.t || Math.hypot(ai.goal.x - b.x, ai.goal.z - b.z) < 3) {
          const r = Math.max(10, (Z.mode === "done" ? Z.r : Math.min(Z.r, Z.nr + 30)) * 0.7);
          const a = Math.random() * Math.PI * 2, d = Math.random() * r;
          ai.goal = { x: clamp(Z.nx + Math.cos(a) * d, 10, X.WORLD.S - 10), z: clamp(Z.nz + Math.sin(a) * d, 10, X.WORLD.S - 10) };
          ai.goalT = G.t + rand(10, 20);
        }
      }
    }
    // ---- weapon management
    if (w && w.mag <= 0 && b.ammo[WD[w.id].ammo] <= 0) {
      const other = b.cur === 0 ? 1 : 0;
      if (b.slots[other] && (b.slots[other].mag > 0 || b.ammo[WD[b.slots[other].id].ammo] > 0)) { b.cur = other; b.reloadT = 0; }
    }
    if (!w && (b.slots[0] || b.slots[1])) b.cur = b.slots[0] ? 0 : 1;
    if (w && w.mag < WD[w.id].mag * 0.3 && !ai.visible && b.ammo[WD[w.id].ammo] > 0) X.startReload(b);
    if (ai.mode === "heal" && b.useT <= 0) X.smartHeal(b);
    if (b.useT <= 0 && b.boost < 30 && X.canUse(b, "drink") && !ai.visible && Math.random() < 0.2) X.startUse(b, "drink");
    // ---- gloo wall when under fire in the open
    ai.glooCd -= 0.25;
    if (ai.mode === "fight" && ai.visible && b.items.gloo > 0 && ai.glooCd <= 0 && G.t - b.hurtT < 1.5 && b.hp < 75 && Math.random() < 0.55) {
      const e = ai.enemy;
      X.placeGloo(b, Math.atan2(e.x - b.x, e.z - b.z));
      ai.glooCd = rand(5, 9);
      ai.crouchT = 2.5;
    }
    // ---- grenade at enemies behind cover
    if (ai.enemy && !ai.visible && b.items.grenade > 0 && Math.random() < 0.04) {
      const dx = ai.lastX - b.x, dzz = ai.lastZ - b.z, d = Math.hypot(dx, dzz);
      if (d > 8 && d < 28) { b.yaw = Math.atan2(dx, dzz); X.throwGrenade(b, dx / d * 0.8, 0.25, dzz / d * 0.8); }
    }
    // ---- active skill
    ai.skillT -= 0.25;
    if (b.skillCd <= 0 && ai.skillT <= 0) {
      const s = b.skill;
      const use = (s === "turbo" && ai.mode === "run") || (s === "medic" && b.hp < 60) || ((s === "iron" || s === "rush") && ai.mode === "fight" && b.hp < 70) ||
        (s === "radar" && ai.mode === "roam") || (s === "dome" && ai.mode === "fight" && b.hp < 45);
      if (use) X.useSkill(b);
      ai.skillT = 1;
    }
    ai.strafeT -= 0.25;
    if (ai.strafeT <= 0) { ai.strafe = Math.random() < 0.5 ? -1 : 1; ai.strafeT = rand(0.6, 1.8); }
  }

  X.updateBot = (b, dt) => {
    const G = X.G, ai = b.ai;
    if (b.dummy) return;
    if (b.phase === "plane") {
      b.x = G.plane.x; b.z = G.plane.z; b.y = G.plane.y;
      if (G.plane.t >= b.dropT) X.leavePlane(b);
      return;
    }
    if (b.phase === "fall") {
      if (b.followLeader && G.player.alive) b.target = { x: G.player.x + (b.id % 3 - 1) * 4, z: G.player.z + 4 };
      const dx = b.target.x - b.x, dz = b.target.z - b.z, d = Math.hypot(dx, dz);
      X.updateFall(b, d > 2 ? dx / d : 0, d > 2 ? dz / d : 0, dt, b.followLeader ? G.player.para : b.y - X.WORLD.heightAt(b.x, b.z) < 90 && d < 60);
      return;
    }
    ai.think -= dt;
    if (ai.think <= 0) { ai.think = rand(0.2, 0.32); think(b); }
    b.fireCd -= dt; b.punchT -= dt; ai.react -= dt; ai.crouchT = (ai.crouchT || 0) - dt;
    if (b.reloadT > 0) { b.reloadT -= dt; if (b.reloadT <= 0) X.finishReload(b); }
    if (b.useT > 0) { b.useT -= dt; if (b.useT <= 0) X.finishUse(b); }
    b.boost = Math.max(0, b.boost - dt * 1.2);
    if (b.boost > 0) b.hp = Math.min(100, b.hp + dt * 0.8);

    let wx = 0, wz = 0, speed = 4.4;
    const w = X.weaponOf(b);
    b.crouch = ai.crouchT > 0;
    if (b.knocked) {
      // crawl away from the attacker toward a teammate
      const mate = G.fighters.find(o => o.alive && !o.knocked && o.team === b.team && o !== b);
      if (mate) { const dx = mate.x - b.x, dz = mate.z - b.z, d = Math.hypot(dx, dz); if (d > 1.5) { wx = dx / d; wz = dz / d; } }
      speed = 1.1;
      b.crouch = false;
    } else if (ai.mode === "wait") {
      wx = wz = 0;
    } else if (ai.mode === "revive" && ai.reviveTarget) {
      const t = ai.reviveTarget;
      if (!t.alive || !t.knocked) { ai.reviveTarget = null; b.reviveOf = null; b.reviveT = 0; }
      else {
        const dx = t.x - b.x, dz = t.z - b.z, d = Math.hypot(dx, dz);
        if (d > 1.4) { wx = dx / d; wz = dz / d; speed = 6; b.reviveOf = null; b.reviveT = 0; }
        else {
          b.reviveOf = t; b.reviveT += dt; b.crouch = true;
          if (b.reviveT >= X.reviveTime(b)) X.revive(t, b);
        }
        b.yaw += wrapA(Math.atan2(dx, dz) - b.yaw) * clamp(6 * dt, 0, 1);
      }
    } else if (ai.mode === "fight" && ai.enemy) {
      const e = ai.enemy, dx = e.x - b.x, dz = e.z - b.z, d = Math.hypot(dx, dz) || 1;
      b.yaw += wrapA(Math.atan2(dx, dz) - b.yaw) * clamp(9 * dt, 0, 1);
      const pref = !w ? 1 : w.id === "shotgun" ? 7 : w.id === "smg" || w.id === "pistol" ? 14 : w.id === "sniper" || w.id === "dmr" ? 55 : 26;
      const app = d > pref + 4 ? 1 : d < pref - 4 ? -0.7 : 0;
      const px = -dz / d, pz = dx / d;
      wx = (dx / d) * app + px * ai.strafe * 0.8; wz = (dz / d) * app + pz * ai.strafe * 0.8;
      speed = 3.6;
      if (b.crouch) { wx *= 0.3; wz *= 0.3; }
      if (w && (w.id === "sniper" || w.id === "dmr") && d > 25) { wx *= 0.2; wz *= 0.2; b.crouch = true; }
      b.pitch = Math.atan2(e.y + 1.1 - X.eyeY(b), d);
      if (ai.visible && ai.react <= 0 && b.useT <= 0) {
        if (!w) { if (d < 1.8) X.punch(b); }
        else if (b.reloadT <= 0 && w.mag > 0 && b.fireCd <= 0) {
          const wd = WD[w.id];
          if (d < wd.range * 1.5) {
            const head = Math.random() < 0.18;
            const ty = e.y + (head ? X.fHeight(e) - 0.15 : X.fHeight(e) * 0.55);
            const ex = b.x, ey = X.eyeY(b), ez = b.z;
            const ddx = e.x - ex, ddy = ty - ey, ddz = e.z - ez, l = Math.hypot(ddx, ddy, ddz) || 1;
            const err = G.diff.aim * (1 + d / 55) * (b.moving > 0.4 ? 1.35 : 1) * (e.moving > 0.6 ? 1.25 : 1) + (wd.pellets > 1 ? wd.hip * 0.5 : 0);
            X.fireWeapon(b, ex, ey, ez, ddx / l, ddy / l, ddz / l, err);
            if (!wd.auto) b.fireCd += rand(0.05, 0.25);
            else if (Math.random() < 0.08) b.fireCd += rand(0.25, 0.6);
          }
        } else if (w.mag <= 0) X.startReload(b);
      }
    } else if (ai.goal) {
      const dx = ai.goal.x - b.x, dz = ai.goal.z - b.z, d = Math.hypot(dx, dz);
      if (d > 0.8) { wx = dx / d; wz = dz / d; }
      speed = ai.mode === "run" ? 6.4 : ai.mode === "loot" ? 5 : ai.mode === "follow" ? (d > 10 ? 6.4 : 4.4) : 4.4;
      if (ai.mode === "heal") { wx = wz = 0; b.crouch = true; }
      if (Math.hypot(wx, wz) > 0.1) b.yaw += wrapA(Math.atan2(wx, wz) - b.yaw) * clamp(6 * dt, 0, 1);
      b.pitch = 0;
    }
    // stuck handling: detour sideways and hop
    ai.stuckT += dt;
    if (ai.stuckT > 0.9) {
      const moved = Math.hypot(b.x - ai.lx, b.z - ai.lz);
      if (moved < 0.5 && Math.hypot(wx, wz) > 0.3) { ai.detour = (Math.random() < 0.5 ? -1 : 1) * rand(1, 1.6); if (b.onGround && !b.knocked) b.vy = 6; }
      ai.lx = b.x; ai.lz = b.z; ai.stuckT = 0;
    }
    if (ai.detour) {
      const a = Math.atan2(wx, wz) + ai.detour, m = Math.hypot(wx, wz);
      wx = Math.sin(a) * m; wz = Math.cos(a) * m;
      ai.detour *= Math.pow(0.2, dt);
      if (Math.abs(ai.detour) < 0.1) ai.detour = 0;
    }
    if (b.useT > 0) speed *= 0.5;
    X.physics(b, wx, wz, speed * X.speedMul(b), dt);
    X.autoPickup(b);
    X.syncDraw(b);
  };
})();
