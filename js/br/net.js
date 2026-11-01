// Brainrot Royale online client: connects to server/server.js, syncs players, routes damage through the server.
(() => {
  "use strict";
  const BR3 = window.BR3, BR = window.BR, SND = BR.Audio, X = BR3.X;
  if (!X || !X.R) return;
  const { $, rand, pick, esc, clamp, lerp, wrapA } = X;
  const WD = BR3.WEAPONS, AMMO = BR3.AMMO, PROG = BR3.Progress;
  const N = (BR3.Net = { ws: null, id: 0, ping: 0, mode: "ffa" });
  const INTERP = 0.1; // seconds remote players are shown behind real time

  N.serverUrl = () => {
    let s = (X.S.server || "").trim();
    if (!s) {
      if (!/^https?:$/.test(location.protocol) || /github\.io$/.test(location.hostname)) return null;
      return `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;
    }
    s = s.replace(/^http/, "ws").replace(/\/+$/, "");
    if (!/^wss?:\/\//.test(s)) s = "wss://" + s;
    return /\/ws$/.test(s) ? s : s + "/ws";
  };
  const send = o => { if (N.ws && N.ws.readyState === 1) N.ws.send(JSON.stringify(o)); };
  N.send = send;

  // ------------------------------------------------------------ connect + start
  N.start = () => {
    const url = N.serverUrl();
    if (!url) { X.toast("🌐 Online needs a server address: ⚙️ Settings → Online server (see README)"); X.openSettings("lobby"); return; }
    X.hideScreens();
    $("loading").classList.remove("hidden");
    $("loadMsg").textContent = "Connecting to " + url.replace(/^wss?:\/\//, "").replace(/\/ws$/, "") + " …";
    let done = false;
    const fail = why => { if (done) return; done = true; try { ws.close(); } catch (e) { /* ignore */ } $("loading").classList.add("hidden"); X.toast("🌐 " + why); X.toLobby(); };
    let ws;
    try { ws = new WebSocket(url); } catch (e) { return fail("Bad server address"); }
    N.ws = ws;
    const timer = setTimeout(() => fail("Server didn't answer (it may be waking up, try again in 30 s)"), 9000);
    ws.onopen = () => {
      const e = PROG.data.equip;
      ws.send(JSON.stringify({ t: "hello", name: PROG.data.name, code: X.selected.code, outfit: e.outfit, wskin: e.wskin, mode: X.S.netMode || "ffa", room: X.S.room || "" }));
    };
    ws.onmessage = ev => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.t === "welcome") { clearTimeout(timer); done = true; $("loading").classList.add("hidden"); begin(m); }
      else if (m.t === "full") fail("Room is full (16 players)");
      else handle(m);
    };
    ws.onerror = () => fail("Could not connect to the server");
    ws.onclose = () => {
      clearTimeout(timer);
      if (!done) return fail("Connection closed");
      if (X.G && X.G.online && N.ws === ws) { X.toast("🌐 Disconnected from server"); N.ws = null; X.toLobby(); }
    };
  };
  N.stop = () => { const ws = N.ws; N.ws = null; if (ws) try { ws.close(); } catch (e) { /* ignore */ } };

  function begin(w) {
    const W0 = X.WORLD;
    if (!W0 || W0.seed !== w.seed) {
      X.WORLD = BR3.buildWorld(w.seed, X.R, "medium"); // same seed + quality => same island for everybody
      X.WORLD.seed = w.seed;
    }
    N.id = w.id; N.mode = w.mode;
    const G = (X.G = X.makeG({ mode: "online", team: 1 }));
    const W = X.WORLD, T = W.towns[w.town % W.towns.length];
    Object.assign(G, { online: true, netMode: w.mode, target: w.target, endsAt: performance.now() + w.endsAt, teamKills: w.teamKills || [0, 0], arena: T, bounds: { x: T.x, z: T.z, r: 92 }, matchEnd: false, sendT: 0, pingT: 0 });
    G.zone.mode = "done"; G.zone.r = 99999;
    const P = X.makeFighter(X.selected, true, w.id, { team: w.team });
    P.phase = "ground"; P.netId = w.id;
    G.player = P; G.fighters.push(P);
    for (const p of w.players) addRemote(p);
    spawnSelf();
    G.alive = G.fighters.filter(f => f.alive).length;
    X.state = "play";
    document.body.classList.remove("cs");
    $("hud").classList.remove("hidden");
    $("shopBtn").classList.add("hidden");
    $("chatBtn").classList.remove("hidden");
    $("feed").innerHTML = "";
    X.center(w.mode === "tdm" ? "🌐 TEAM DEATHMATCH" : "🌐 FREE FOR ALL", `${w.players.length + 1} player${w.players.length ? "s" : ""} online${w.room ? " · room " + w.room : ""} · first to ${w.target}`, 3.5);
    SND.music.start(); SND.music.setIntense(true);
    if (BR3.Input.mode === "desktop") X.requestLock();
  }

  function addRemote(p) {
    const G = X.G;
    if (G.fighters.some(f => f.netId === p.id)) return;
    const ch = BR.CHARACTERS.find(c => c.code === p.code) || pick(BR.CHARACTERS);
    const f = X.makeFighter(ch, false, p.id, { team: p.team, outfit: BR3.OUTFITS[p.outfit] ? p.outfit : "flag", wskin: BR3.WSKINS[p.wskin] ? p.wskin : "none" });
    Object.assign(f, { isRemote: true, netId: p.id, name: p.name, phase: "ground", onGround: true, kills: p.kills || 0, deaths: p.deaths || 0, hp: p.hp ?? 100, alive: p.alive !== false, dead: p.alive === false, x: p.x || 0, y: p.y || 0, z: p.z || 0, yaw: p.yaw || 0, net: [] });
    G.fighters.push(f);
    return f;
  }
  const byId = id => X.G && X.G.fighters.find(f => f.netId === id);

  // ------------------------------------------------------------ local player
  const PRIMARY = ["ar", "m4", "smg", "shotgun", "dmr", "ar", "m4", "sniper"];
  function loadout(P) {
    const pri = pick(PRIMARY);
    P.slots = [{ id: pri, mag: WD[pri].mag }, { id: "pistol", mag: WD.pistol.mag }];
    P.cur = 0;
    for (const k in AMMO) P.ammo[k] = AMMO[k].max;
    Object.assign(P.items, { bandage: 3, medkit: 1, drink: 1, grenade: 1, gloo: 3 });
    P.vest = 0; P.helmet = 0;
  }
  function spawnSelf() {
    const G = X.G, P = G.player, T = G.arena;
    const s = X.openSpot(T.x, T.z, 70, 2.5);
    P.x = s.x; P.z = s.z; P.y = X.WORLD.groundAt(s.x, s.z, 99) + 0.1;
    P.vx = P.vy = P.vz = 0; P.hp = 100; P.alive = true; P.dead = false; P.deadT = 0; P.knocked = false; P.boost = 0; P.useT = 0; P.reloadT = 0; P.skillCd = 0; P.streak = 0;
    for (const k in P.buffs) P.buffs[k] = 0;
    P.yaw = Math.atan2(T.x - P.x, T.z - P.z); G.cam.yaw = P.yaw; G.cam.pitch = -0.05;
    loadout(P);
    X.syncDraw(P);
  }

  // called every frame from game.js
  N.tick = dt => {
    const G = X.G;
    if (!G || !G.online) return;
    const P = G.player;
    G.sendT -= dt;
    if (G.sendT <= 0) {
      G.sendT = 0.05;
      send({ t: "st", x: +P.x.toFixed(2), y: +P.y.toFixed(2), z: +P.z.toFixed(2), yaw: +P.yaw.toFixed(3), pitch: +(P.pitch || 0).toFixed(3), vx: +P.vx.toFixed(2), vz: +P.vz.toFixed(2), fl: (P.onGround ? 1 : 0) | (P.crouch ? 2 : 0) | (P.reloadT > 0 ? 4 : 0), w: P.alive && P.weapon ? P.weapon : "" });
    }
    G.pingT -= dt;
    if (G.pingT <= 0) { G.pingT = 2; send({ t: "ping", c: performance.now() }); }
    G.alive = G.fighters.length;
  };
  // remote player interpolation
  N.updateRemote = (f, dt) => {
    const now = performance.now() / 1000 - INTERP, b = f.net;
    if (f.hitT > 0) f.hitT -= dt;
    if (f.dead) f.deadT += dt;
    if (f.emote) { f.emote.t += dt; if (f.emote.t > (f.emote.dur || 4)) f.emote = null; }
    while (b.length > 2 && b[1].t <= now) b.shift();
    if (!b.length) return;
    let s0 = b[0], s1 = b[1] || b[0];
    const k = s1.t > s0.t ? clamp((now - s0.t) / (s1.t - s0.t), 0, 1.2) : 1;
    f.x = lerp(s0.x, s1.x, k); f.y = lerp(s0.y, s1.y, k); f.z = lerp(s0.z, s1.z, k);
    f.yaw = s0.yaw + wrapA(s1.yaw - s0.yaw) * k; f.pitch = lerp(s0.pitch, s1.pitch, k);
    f.vx = s1.vx; f.vz = s1.vz; f.onGround = !!(s1.fl & 1); f.crouch = !!(s1.fl & 2); f.reloadT = s1.fl & 4 ? 1 : 0;
    f.weapon = f.alive && s1.w && WD[s1.w] ? s1.w : null;
    f.gunColor = f.weapon ? (f.skinColor || BR3.hex(WD[f.weapon].color)) : null;
    f.moving = clamp(Math.hypot(f.vx, f.vz) / 4.5, 0, 1);
  };
  // outgoing gameplay events (called from combat.js)
  N.hit = (t, dmg, head, w) => send({ t: "hit", id: t.netId, dmg: Math.round(dmg), head: !!head, w });
  N.shot = (a, b, w) => send({ t: "shot", a: a.map(v => +v.toFixed(2)), b: b.map(v => +v.toFixed(2)), w });
  N.fx = o => send(Object.assign({ t: "fx" }, o));
  N.chat = m => send({ t: "chat", m });

  // ------------------------------------------------------------ incoming
  function handle(m) {
    const G = X.G;
    if (!G || !G.online) return;
    const P = G.player;
    switch (m.t) {
      case "snap": {
        const t = performance.now() / 1000;
        for (const s of m.s) {
          if (s[0] === N.id) continue;
          const f = byId(s[0]);
          if (!f) continue;
          f.net.push({ t, x: s[1], y: s[2], z: s[3], yaw: s[4], pitch: s[5], vx: s[6], vz: s[7], fl: s[8], w: s[9] });
          if (f.net.length > 30) f.net.shift();
        }
        break;
      }
      case "join": { const f = addRemote(m.p); if (f) X.feed(`🌐 ${esc(f.name)} joined`, false); break; }
      case "leave": {
        const f = byId(m.id);
        if (f) { G.fighters.splice(G.fighters.indexOf(f), 1); X.feed(`🚪 ${esc(f.name)} left`, false); if (G.spec === f) G.spec = null; }
        break;
      }
      case "shot": {
        const f = byId(m.id);
        if (!f || m.a.length < 3 || m.b.length < 3) break;
        G.tracers.push({ ax: m.a[0], ay: m.a[1], az: m.a[2], bx: m.b[0], by: m.b[1], bz: m.b[2], life: 0.08, col: f.tracer || [1, 0.75, 0.4] });
        G.parts.push({ x: m.a[0], y: m.a[1], z: m.a[2], vx: 0, vy: 0, vz: 0, life: 0.06, col: [1, 0.7, 0.2], s: 0.24, g: 0 });
        f.fireCd = (f.fireCd || 0) + 0.25; // makes the rig play recoil
        const wd = Object.values(WD).find(w => w.short === m.w) || WD.ar;
        X.sfxAt(wd.sound, m.a[0], m.a[2], 0.95);
        if (Math.hypot(f.x - P.x, f.z - P.z) < 140) G.pings.push({ x: f.x, z: f.z, t: 1.2 });
        break;
      }
      case "dmg": {
        const t = m.id === N.id ? P : byId(m.id), a = byId(m.by);
        if (!t) break;
        t.hp = m.hp; t.hitT = 0.25;
        if (t === P) {
          t.hurtT = G.t;
          if (a) G.indicators.push({ a: Math.atan2(a.x - P.x, a.z - P.z), t: 1.2 });
          SND.sfx("hurt", 0.7); X.vibrate(40); G.shake = Math.max(G.shake, 0.25);
          if (P.useT > 0) { P.useT = 0; P.useItem = null; }
        }
        break;
      }
      case "kill": {
        const t = m.id === N.id ? P : byId(m.id), a = m.by === N.id ? P : byId(m.by);
        if (a) a.kills = m.kills;
        if (t) { t.deaths = m.deaths; t.alive = false; t.dead = true; t.deadT = 0; t.hp = 0; t.weapon = null; }
        G.teamKills = m.teamKills || G.teamKills;
        X.feed(`${esc(a ? (a === P ? "You" : a.name) : "?")} <b>${esc(m.w || "")}</b>${m.head ? " 🎯" : ""} 💀 ${esc(t ? (t === P ? "You" : t.name) : "?")}`, a === P || t === P);
        if (a === P) {
          a.streak = G.t - a.lastKillT < 9 ? a.streak + 1 : 1; a.lastKillT = G.t;
          SND.sfx("knock"); G.hitmKind = "kill"; G.hitmT = 0.35;
          X.killBanner(m.head ? "🎯" : a.streak >= 2 ? "🔥" : "💀", BR3.STREAKS[Math.min(a.streak, 6)] || (m.head ? "HEADSHOT" : "ELIMINATED"));
          if (a.kills === 1 || Math.random() < 0.35) X.speakAs(X.selected, pick(BR3.KILL_LINES), false);
        }
        if (t === P) { P.useT = 0; P.reloadT = 0; SND.sfx("lose"); X.vibrate(200); X.center("ELIMINATED 💀", `by ${a ? a.name : "?"} · respawning in 3…`, 2.8); }
        break;
      }
      case "spawn": {
        if (m.id === N.id) { spawnSelf(); X.center("RESPAWNED", "Back in the fight!", 1.2); break; }
        const f = byId(m.id);
        if (f) { f.alive = true; f.dead = false; f.hp = 100; f.net.length = 0; }
        break;
      }
      case "fx": {
        const f = byId(m.id);
        if (!f) break;
        if (m.k === "gren") G.grenades.push({ x: m.x, y: m.y, z: m.z, vx: m.vx, vy: m.vy, vz: m.vz, fuse: 3, owner: f });
        else if (m.k === "gloo") { const ox = f.x, oz = f.z, oy = f.y; f.x = m.x; f.z = m.z; f.y = m.y; f.items.gloo = 1; X.placeGloo(f, m.a, true); f.x = ox; f.z = oz; f.y = oy; }
        else if (m.k === "emote" && BR3.EMOTES[m.e]) f.emote = { type: m.e, t: 0, dur: 4 };
        break;
      }
      case "chat": {
        const f = m.id === N.id ? P : byId(m.id);
        X.feed(`💬 <b>${esc(f ? (f === P ? "You" : f.name) : "?")}</b>: ${esc(m.m)}`, f === P);
        SND.sfx("pick", 0.5);
        break;
      }
      case "pong": N.ping = Math.round(performance.now() - m.c); break;
      case "end": {
        G.matchEnd = true;
        const me = m.board.findIndex(b => b.id === N.id);
        const won = N.mode === "tdm" ? m.winTeam === P.team : me === 0;
        X.center(won ? "🏆 VICTORY!" : "MATCH OVER", N.mode === "tdm" ? `Team score ${m.teamKills[0]} – ${m.teamKills[1]}` : `Winner: ${m.board[0] ? m.board[0].name : "-"} · you placed #${me + 1}`, 6);
        SND.sfx(won ? "booyah" : "lose");
        X.renderScoreboard(); $("scoreboard").classList.remove("hidden");
        const rw = PROG.reward({ mode: "online", cs: true, won, kills: P.kills, dmg: P.dmg, heads: P.heads, secs: 300, rounds: 0, roundsWon: 0, placement: me + 1, total: m.board.length, code: P.code });
        X.toast(`⭐ +${rw.xp} XP · 🪙 +${rw.coins}${rw.diamonds ? " · 💎 +" + rw.diamonds : ""} · next match in 10 s`);
        break;
      }
      case "restart": {
        G.matchEnd = false; G.endsAt = performance.now() + m.endsAt; G.teamKills = [0, 0];
        for (const f of G.fighters) { f.kills = 0; f.deaths = 0; f.dmg = 0; }
        $("scoreboard").classList.add("hidden");
        spawnSelf();
        X.center("NEW MATCH", "Go go go!", 2);
        break;
      }
    }
  }
})();
