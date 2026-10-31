// Brainrot Royale core: shared namespace X, helpers, settings, renderer, fighters, loot, audio helpers.
(() => {
  "use strict";
  const BR3 = window.BR3, BR = window.BR;
  const X = (BR3.X = {});
  const { hex } = BR3;

  // ---------------- helpers
  X.$ = id => document.getElementById(id);
  X.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  X.rand = (a, b) => a + Math.random() * (b - a);
  X.pick = a => a[Math.floor(Math.random() * a.length)];
  X.lerp = (a, b, t) => a + (b - a) * t;
  X.wrapA = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
  X.esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  X.RAR = Object.fromEntries(Object.entries(BR3.RARITY).map(([k, v]) => [k, hex(v.color)]));
  X.RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary"];
  X.fwd = yaw => [Math.sin(yaw), Math.cos(yaw)];
  X.rightOf = yaw => [-Math.cos(yaw), Math.sin(yaw)];
  const { clamp } = X;

  // ---------------- settings
  X.store = {
    get(k, d) { try { const v = localStorage.getItem("brr-" + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("brr-" + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  const isTouch = matchMedia && matchMedia("(pointer: coarse)").matches;
  X.S = Object.assign({ sens: 1, assist: true, invert: false, quality: isTouch ? "low" : "medium", music: 0.35, sfx: 0.8, voice: 0.9, vib: true, fps: false, diff: "normal", char: "US", mode: "classic", team: 4 }, X.store.get("settings", {}));
  X.FOGS = { low: [80, 165], medium: [110, 225], high: [150, 300] };
  X.QPR = { low: 0.7, medium: 1, high: 1.5 };

  // ---------------- renderer
  const glc = X.$("gl"), ov = X.$("ov");
  X.glc = glc; X.ov = ov; X.octx = ov.getContext("2d");
  try { X.R = new BR3.Renderer(glc); }
  catch (e) {
    X.R = null;
    X.$("loadMsg").innerHTML = `Your browser can't run 3D graphics (WebGL): ${X.esc(e.message)}<br><br><a class="big" href="classic/">Play the 2D version instead</a>`;
    return;
  }
  X.SW = 0; X.SH = 0; X.ODPR = 1;
  X.resize = () => {
    X.SW = innerWidth; X.SH = innerHeight;
    const pr = clamp(Math.min(devicePixelRatio || 1, 2) * X.QPR[X.S.quality], 0.5, 2);
    X.R.resize(X.SW, X.SH, pr);
    X.ODPR = Math.min(devicePixelRatio || 1, 2);
    ov.width = Math.round(X.SW * X.ODPR); ov.height = Math.round(X.SH * X.ODPR);
    ov.style.width = X.SW + "px"; ov.style.height = X.SH + "px";
    X.octx.setTransform(X.ODPR, 0, 0, X.ODPR, 0, 0);
  };
  X.applySettings = () => {
    X.store.set("settings", X.S);
    Object.assign(BR.Audio.settings, { music: X.S.music, sfx: X.S.sfx, voice: X.S.voice, muted: false });
    BR.Audio.apply();
    BR3.Input.sens = X.S.sens; BR3.Input.invertY = X.S.invert;
    X.R.fog = X.FOGS[X.S.quality].slice();
    X.resize();
  };
  addEventListener("resize", () => X.resize());
  X.KIT = BR3.makeCharacterKit(X.R);

  // shared mutable state
  X.WORLD = null;
  X.G = null;
  X.state = "loading"; // loading | lobby | plane | play | dead | over | paused
  X.selected = BR.CHARACTERS.find(c => c.code === X.S.char) || BR.CHARACTERS[0];

  function hslRgb(str) {
    const m = /hsl\((\d+),(\d+)%,(\d+)%\)/.exec(str || "");
    if (!m) return [0.5, 0.5, 0.6];
    const h = +m[1] / 360, s = +m[2] / 100, l = +m[3] / 100;
    const f = n => { const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
    return [f(0), f(8), f(4)];
  }

  // ---------------- fighters
  const SKILL_KEYS = Object.keys(BR3.SKILLS), PASS_KEYS = Object.keys(BR3.PASSIVES), OUTFIT_KEYS = Object.keys(BR3.OUTFITS), WSKIN_KEYS = Object.keys(BR3.WSKINS);
  // opts: { team, outfit, wskin, pet, skill, passives }
  X.makeFighter = (ch, isPlayer, id, opts = {}) => {
    const P = BR3.Progress.data.equip;
    const outfit = opts.outfit || (isPlayer ? P.outfit : Math.random() < 0.55 ? "flag" : X.pick(OUTFIT_KEYS));
    const wskin = opts.wskin || (isPlayer ? P.wskin : Math.random() < 0.7 ? "none" : X.pick(WSKIN_KEYS));
    const f = {
      id, isPlayer, ch, code: ch.code, name: isPlayer ? BR3.Progress.data.name : ch.name, look: BR3.lookFor(ch.code, ch.type, outfit), color: hslRgb(ch.color),
      team: opts.team || 0, outfit, wskin, pet: opts.pet || (isPlayer ? P.pet : "none"),
      skill: opts.skill || (isPlayer ? P.skill : X.pick(SKILL_KEYS)),
      passives: opts.passives || (isPlayer ? P.passives.slice() : [X.pick(PASS_KEYS), X.pick(PASS_KEYS)]),
      x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, onGround: false, crouch: false, moving: 0, walk: 0, stepT: 0,
      hp: 100, boost: 0, vest: 0, helmet: 0, alive: true, dead: false, deadT: 0, hitT: 0,
      knocked: false, bleed: 0, knockedBy: null, reviveT: 0, reviveOf: null,
      slots: [null, null], cur: -1, ammo: { light: 0, heavy: 0, shells: 0, sniper: 0 }, items: { bandage: 0, medkit: 0, drink: 0, grenade: 0, gloo: 0 },
      reloadT: 0, fireCd: 0, useT: 0, useMax: 0, useItem: null, punchT: 0,
      kills: 0, deaths: 0, dmg: 0, heads: 0, assists: 0, streak: 0, lastKillT: -99, coins: 0,
      skillCd: 0, buffs: { medic: 0, turbo: 0, iron: 0, radar: 0, petHeal: 0 },
      phase: "plane", para: false, dropT: 0, target: null, lastHitBy: null, emote: null, landT: 0, hurtT: -99,
      ai: { think: Math.random() * 0.3, enemy: null, seenT: -99, strafe: 1, strafeT: 0, goal: null, goalT: 0, mode: "roam", stuckT: 0, lx: 0, lz: 0, detour: 0, react: 0, glooCd: 0, skillT: 3 + Math.random() * 5 },
    };
    X.applyWskin(f);
    return f;
  };
  X.applyWskin = f => {
    const sk = BR3.WSKINS[f.wskin] || BR3.WSKINS.none;
    f.skinColor = sk.color ? hex(sk.color) : null;
    f.gunGlow = sk.glow ? hex(sk.glow).map(v => v * 0.4) : null;
    f.tracer = sk.tracer || null;
  };
  X.has = (f, passive) => f.passives && f.passives.includes(passive);
  X.weaponOf = f => (f.cur >= 0 && f.slots[f.cur] ? f.slots[f.cur] : null);
  X.fHeight = f => (f.knocked ? 0.75 : f.crouch ? 1.3 : 1.85);
  X.eyeY = f => f.y + (f.knocked ? 0.5 : f.crouch ? 1.15 : 1.55);
  X.enemies = (a, b) => a.team !== b.team;
  X.standing = f => f.alive && !f.knocked;
  X.syncDraw = f => {
    const w = X.weaponOf(f);
    f.weapon = w && f.useT <= 0 && !f.knocked ? w.id : null;
    f.gunColor = w ? (f.skinColor || hex(BR3.WEAPONS[w.id].color)) : null;
  };

  // ---------------- audio helpers
  X.hearVol = (x, z) => {
    const c = X.G ? X.G.cam : null;
    if (!c) return 1;
    const d = Math.hypot(x - c.x, z - c.z);
    return Math.pow(clamp(1 - d / 190, 0, 1), 1.6);
  };
  X.sfxAt = (name, x, z, scale = 1) => BR.Audio.sfx(name, X.hearVol(x, z) * scale);
  X.vibrate = ms => { if (X.S.vib && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) { /* ignore */ } };
  X.speakAs = (ch, text, force) => BR.Audio.speak(text, { lang: ch.lang, pitch: ch.pitch, rate: ch.rate, force });

  // ---------------- loot
  const WD = BR3.WEAPONS, AMMO = BR3.AMMO, ITEMS = BR3.ITEMS, ARMOR = BR3.ARMOR;
  X.rollLoot = () => {
    const T = BR3.LOOT_TABLE, total = T.reduce((s, e) => s + e[1], 0);
    let r = Math.random() * total;
    for (const [k, w] of T) { r -= w; if (r <= 0) return k; }
    return T[0][0];
  };
  X.lootFrom = key => {
    const [kind, v] = key.split(":");
    if (kind === "weapon") return { kind: "weapon", id: Math.random() < 0.012 ? "golden" : v, mag: null };
    if (kind === "ammo") return { kind: "ammo", type: v, n: AMMO[v].box };
    if (kind === "item") return { kind: "item", type: v, n: v === "bandage" ? 3 : v === "gloo" ? 2 : 1 };
    return { kind, lvl: +v };
  };
  X.addLoot = (o, x, z, y) => {
    o.x = x; o.z = z; o.y = y != null ? y : X.WORLD.groundAt(x, z, 99);
    o.rot = Math.random() * 6.28;
    o.taken = false;
    X.G.loot.push(o);
    return o;
  };
  X.lootRarity = o => {
    if (o.kind === "weapon") return WD[o.id].rarity;
    if (o.kind === "vest" || o.kind === "helmet") return BR3.LEVEL_RARITY[o.lvl];
    if (o.kind === "item") return ITEMS[o.type].rarity;
    return "common";
  };
  X.lootLabel = o => {
    if (o.kind === "weapon") return `${WD[o.id].icon} ${WD[o.id].name}`;
    if (o.kind === "ammo") return `${AMMO[o.type].icon} ${AMMO[o.type].name} ×${o.n}`;
    if (o.kind === "item") return `${ITEMS[o.type].icon} ${ITEMS[o.type].name}${o.n > 1 ? " ×" + o.n : ""}`;
    return `${ARMOR[o.kind].icon} ${ARMOR[o.kind].name} Lv.${o.lvl}`;
  };
  X.randomLand = () => {
    for (let i = 0; i < 80; i++) {
      const x = X.rand(60, X.WORLD.S - 60), z = X.rand(60, X.WORLD.S - 60);
      if (X.WORLD.heightAt(x, z) > 1) return { x, z };
    }
    return X.WORLD.center;
  };
  // open flat spot with no obstacles within r metres
  X.openSpot = (cx, cz, spread, r = 7) => {
    for (let i = 0; i < 400; i++) {
      const x = cx + X.rand(-spread, spread), z = cz + X.rand(-spread, spread);
      if (X.WORLD.heightAt(x, z) < 1.4) continue;
      if (X.WORLD.query(x - r, z - r, x + r, z + r, []).length === 0) return { x, z };
    }
    return { x: cx, z: cz };
  };

  // ---------------- toasts / center messages / feed
  let centerTimer = null, toastTimer = null, bannerTimer = null;
  X.center = (msg, sub, secs = 2) => {
    const el = X.$("centerMsg");
    el.innerHTML = `${X.esc(msg)}${sub ? `<small>${X.esc(sub)}</small>` : ""}`;
    el.classList.remove("hidden");
    clearTimeout(centerTimer);
    centerTimer = setTimeout(() => el.classList.add("hidden"), secs * 1000);
  };
  X.toast = msg => {
    const t = X.$("toast");
    t.textContent = msg;
    t.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add("hidden"), 1900);
  };
  X.killBanner = (icon, text) => {
    const el = X.$("killBanner");
    el.innerHTML = `<div class="ico">${icon}</div><div class="txt">${X.esc(text)}</div>`;
    el.classList.remove("hidden");
    el.style.animation = "none"; void el.offsetWidth; el.style.animation = "";
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => el.classList.add("hidden"), 1800);
  };
  X.feed = (html, me) => {
    const el = document.createElement("div");
    el.innerHTML = html;
    if (me) el.className = "me";
    const f = X.$("feed");
    f.prepend(el);
    while (f.children.length > 5) f.lastChild.remove();
    setTimeout(() => el.remove(), 6000);
  };
  BR3.Input.on("toast", X.toast);
})();
