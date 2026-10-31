// Brainrot Election 2026: game engine + UI
(() => {
  "use strict";
  const BR = window.BR;
  const SND = BR.Audio, IN = BR.Input, CHARS = BR.CHARACTERS;
  const $ = id => document.getElementById(id);
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // =====================================================================
  //  SAVE DATA & SETTINGS
  // =====================================================================
  const store = {
    get(k, d) { try { const v = localStorage.getItem("bre2-" + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("bre2-" + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  const DEFAULTS = { sfx: 0.7, music: 0.5, voice: 0.9, muted: false, shake: true, flash: true, aim: "auto", difficulty: "normal", haptics: true, dmgNumbers: true };
  const settings = Object.assign({}, DEFAULTS, store.get("settings", {}));
  function applySettings() {
    store.set("settings", settings);
    Object.assign(SND.settings, { sfx: settings.sfx, music: settings.music, voice: settings.voice, muted: settings.muted });
    SND.apply();
    IN.manualAimTouch = settings.aim === "manual";
    $("hud-mute").textContent = settings.muted ? "🔇" : "🔊";
  }

  const DIFFICULTY = {
    easy:   { label: "Easy",   enemyHp: 0.75, enemyDmg: 0.6, playerHp: 1.3, spawn: 0.8,  score: 0.75 },
    normal: { label: "Normal", enemyHp: 1,    enemyDmg: 1,   playerHp: 1,   spawn: 1,    score: 1 },
    hard:   { label: "Hard",   enemyHp: 1.35, enemyDmg: 1.4, playerHp: 0.9, spawn: 1.25, score: 1.5 },
  };

  let best = store.get("best", 0);
  let wins = store.get("wins", {});

  // =====================================================================
  //  GAME DATA
  // =====================================================================
  const ENEMIES = {
    fact:     { name: "Fact Checker", emoji: "🧐", hp: 18, speed: 1.4, dmg: 8,  r: 16, xp: 1, size: 32, info: "Chases you. Basic hater." },
    pap:      { name: "Paparazzi",    emoji: "📸", hp: 10, speed: 2.4, dmg: 5,  r: 14, xp: 1, size: 28, info: "Fast and fragile." },
    intern:   { name: "Intern",       emoji: "☕", hp: 8,  speed: 3.0, dmg: 4,  r: 12, xp: 1, size: 24, info: "Very fast, comes in swarms." },
    bot:      { name: "Troll Bot",    emoji: "🤖", hp: 42, speed: 1.0, dmg: 12, r: 18, xp: 2, size: 36, info: "Slow but tanky." },
    reporter: { name: "Reporter",     emoji: "🎤", hp: 26, speed: 1.1, dmg: 8,  r: 16, xp: 2, size: 32, shooter: true, info: "Keeps distance, throws ❓ questions." },
    scandal:  { name: "Scandal",      emoji: "💩", hp: 55, speed: 0.9, dmg: 14, r: 20, xp: 3, size: 40, splits: true, info: "Splits into 2 mini scandals." },
    mini:     { name: "Mini Scandal", emoji: "💩", hp: 12, speed: 1.9, dmg: 6,  r: 11, xp: 1, size: 22, info: "" },
  };
  const BOSS_DEFS = {
    lobbyist: { name: "THE LOBBYIST",       emoji: "💰", hp: 900,  speed: 0.75, dmg: 25, r: 44, xp: 40, size: 88,  bullet: "💵", voice: "The Lobbyist has entered the chat." },
    lizard:   { name: "LIZARD OVERLORD 👁️", emoji: "🦎", hp: 2200, speed: 0.9,  dmg: 30, r: 50, xp: 80, size: 100, bullet: "👁️", voice: "The Lizard Overlord is here. Your aura is mine." },
  };
  const WAVES = ["Town Hall", "Iowa Caucus", "Primary Season", "TV Debate", "Lobbyist Showdown",
    "Swing States", "Scandal Week", "October Surprise", "Final Debate", "ELECTION NIGHT"];
  const waveName = w => (w <= WAVES.length ? WAVES[w - 1] : `Re-election #${w - WAVES.length}`);
  function bossFor(w) {
    if (w % 5 !== 0) return null;
    const B = w % 10 === 0 ? BOSS_DEFS.lizard : BOSS_DEFS.lobbyist;
    return { ...B, hp: B.hp * (1 + Math.max(0, w - 10) * 0.18) };
  }

  const POWERUPS = {
    shield: { emoji: "🛡️", name: "Filibuster",   desc: "Invincible for 5s" },
    hype:   { emoji: "⚡", name: "Energy Drink", desc: "Faster + rapid fire for 6s" },
    pizza:  { emoji: "🍕", name: "Free Pizza",   desc: "Heals 35 HP" },
    viral:  { emoji: "📱", name: "Viral Tweet",  desc: "Damages every hater" },
    double: { emoji: "🗳️", name: "Double Votes", desc: "2x votes for 10s" },
    magnet: { emoji: "🧲", name: "Vote Magnet",  desc: "Pulls in every vote" },
  };

  const UPGRADES = [
    { id: "multi",  emoji: "💬", name: "More Talking Points", desc: "+1 projectile",            max: 6,  apply: p => p.projCount++ },
    { id: "dmg",    emoji: "📢", name: "Louder Mic",          desc: "+25% damage",              max: 10, apply: p => (p.dmg *= 1.25) },
    { id: "rate",   emoji: "☕", name: "Triple Espresso",     desc: "+15% fire rate",           max: 8,  apply: p => (p.fireRate *= 0.85) },
    { id: "speed",  emoji: "👟", name: "Campaign Sneakers",   desc: "+10% move speed",          max: 5,  apply: p => (p.speed *= 1.1) },
    { id: "hp",     emoji: "💪", name: "Thick Skin",          desc: "+25 max HP, full heal",    max: 10, apply: p => { p.maxHp += 25; p.hp = p.maxHp; } },
    { id: "orb",    emoji: "🌀", name: "Spin Doctor",         desc: "+1 orbiting spin orb",     max: 5,  apply: p => p.orbs++ },
    { id: "magnet", emoji: "🧲", name: "Grassroots Reach",    desc: "+40% vote pickup range",   max: 4,  apply: p => (p.magnet *= 1.4) },
    { id: "pierce", emoji: "🎯", name: "Hot Take",            desc: "Shots pierce +1 enemy",    max: 5,  apply: p => p.pierce++ },
    { id: "steal",  emoji: "🧛", name: "Super PAC Money",     desc: "Heal 1 HP per kill",       max: 5,  apply: p => p.lifesteal++ },
    { id: "cd",     emoji: "⏱️", name: "Spin Room",           desc: "-20% special cooldown",    max: 4,  apply: p => (p.cdMult *= 0.8) },
    { id: "regen",  emoji: "🩹", name: "Healthcare Plan",     desc: "+0.6 HP/sec regeneration", max: 5,  apply: p => (p.regen += 0.6) },
    { id: "crit",   emoji: "💥", name: "Viral Clip",          desc: "+10% crit chance (2x)",    max: 5,  apply: p => (p.crit += 0.1) },
  ];

  const KILL_WORDS = ["W", "+aura", "no cap", "ratio'd", "based", "sheesh", "skibidi", "fanum tax", "mewing", "cooked",
    "bussin", "sigma", "rizz", "NPC", "delulu", "it's giving", "slay", "L bozo", "touch grass", "+1000 aura", "mogged", "fr fr", "GG"];
  const HURT_WORDS = ["L", "cooked", "-aura", "not the vibe", "ratio'd", "😭"];
  const LEVEL_LINES = ["Sheesh!", "Polls are up!", "Let's go!", "Aura up!", "W!"];

  // =====================================================================
  //  CANVAS, SCALING, SPRITES
  // =====================================================================
  const canvas = $("game");
  const ctx = canvas.getContext("2d");
  const spriteCache = new Map();
  let SW = 0, SH = 0, DPR = 1, SCALE = 1, W = 0, H = 0;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    SW = window.innerWidth;
    SH = window.innerHeight;
    // Small screens see a zoomed-out arena so phones aren't cramped
    SCALE = Math.min(1, Math.min(SW, SH) / 620);
    W = SW / SCALE;
    H = SH / SCALE;
    canvas.width = Math.round(SW * DPR);
    canvas.height = Math.round(SH * DPR);
    canvas.style.width = SW + "px";
    canvas.style.height = SH + "px";
    spriteCache.clear();
    if (G) { G.p.x = clamp(G.p.x, 20, W - 20); G.p.y = clamp(G.p.y, 20, H - 20); }
  }
  IN.toLogical = (x, y) => ({ x: x / SCALE, y: y / SCALE });

  function sprite(emoji, size) {
    const key = emoji + "|" + size;
    let c = spriteCache.get(key);
    if (!c) {
      c = document.createElement("canvas");
      const s = Math.ceil(size * 1.35);
      const res = DPR * SCALE;
      c.width = c.height = Math.max(1, Math.ceil(s * res));
      c.logical = s;
      const g = c.getContext("2d");
      g.scale(res, res);
      g.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(emoji, s / 2, s / 2 + size * 0.06);
      if (spriteCache.size > 600) spriteCache.clear();
      spriteCache.set(key, c);
    }
    return c;
  }
  function drawSprite(emoji, x, y, size, rot = 0, alpha = 1) {
    const c = sprite(emoji, size), s = c.logical;
    if (alpha !== 1) ctx.globalAlpha = alpha;
    if (rot) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
      ctx.drawImage(c, -s / 2, -s / 2, s, s);
      ctx.restore();
    } else ctx.drawImage(c, x - s / 2, y - s / 2, s, s);
    if (alpha !== 1) ctx.globalAlpha = 1;
  }

  const flagCache = {};
  function flagImg(code) {
    let im = flagCache[code];
    if (!im) { im = new Image(); im.src = BR.flagUrl(code); flagCache[code] = im; }
    return im;
  }
  function drawAvatar(ch, x, y, r, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    const im = flagImg(ch.code);
    if (im.complete && im.naturalWidth) {
      ctx.save();
      ctx.clip();
      const h = r * 2, w = h * (im.naturalWidth / im.naturalHeight);
      ctx.drawImage(im, x - w / 2, y - r, w, h);
      ctx.restore();
    } else {
      ctx.fillStyle = ch.color;
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `900 ${r * 0.75}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(ch.code, x, y);
    }
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#fff";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    drawSprite(ch.mascot, x + r * 0.78, y + r * 0.72, r * 1.05, 0, alpha);
  }

  // =====================================================================
  //  STATE
  // =====================================================================
  let state = "menu"; // menu | playing | levelup | paused | over
  let G = null;
  let selected = CHARS.find(c => c.code === store.get("char", "US")) || CHARS[0];

  function voiceOf(ch, text, force) {
    SND.speak(text, { lang: ch.lang, pitch: ch.pitch, rate: ch.rate, force });
  }

  function newGame(ch) {
    const D = DIFFICULTY[settings.difficulty] || DIFFICULTY.normal;
    G = {
      ch, D, diff: settings.difficulty, runId: Date.now(),
      p: {
        x: W / 2, y: H / 2, r: 20,
        hp: ch.hp * D.playerHp, maxHp: ch.hp * D.playerHp, speed: ch.speed, dmg: ch.dmg, fireRate: ch.fireRate,
        fireT: 0, projCount: 1, pierce: 0, magnet: 90, orbs: 0, orbAngle: 0, regen: 0, crit: 0,
        iframes: 0, specialT: 120, cdMult: 1, dashT: 0, dashDir: { x: 1, y: 0 }, dashHits: null, dashDmg: 0,
        lifesteal: 0, mvx: 0, mvy: 0, aim: 0,
      },
      upgrades: {},
      enemies: [], bullets: [], eBullets: [], gems: [], powerups: [],
      texts: [], particles: [], rings: [], strikes: [], decoy: null,
      fx: { shield: 0, hype: 0, double: 0, charm: 0, slow: 0 },
      votes: 0, xp: 0, level: 1, xpNext: 8, kills: 0, pendingLevels: 0,
      wave: 0, toSpawn: 0, spawnT: 0, waveDelay: 0, boss: null, bossTimer: 0, bossSpawned: false,
      endless: false, shake: 0, flash: 0, powerT: 600, time: 0, lowHpWarned: false,
    };
    $("hud-flag").src = BR.flagUrl(ch.code);
    $("hud-name").textContent = ch.name;
    $("special-icon").textContent = ch.specialIcon;
    $("special-name").textContent = ch.specialName;
    nextWave();
  }

  // =====================================================================
  //  WAVES & SPAWNING
  // =====================================================================
  function nextWave() {
    G.wave++;
    if (G.wave > WAVES.length && !G.endless) { G.wave = WAVES.length; return endGame(true); }
    G.toSpawn = Math.round((10 + G.wave * 7) * G.D.spawn);
    G.spawnT = 90;
    const B = bossFor(G.wave);
    G.bossTimer = B ? 90 : 0;
    G.bossSpawned = false;
    showBanner(`WAVE ${G.wave}`, waveName(G.wave) + (B ? " · BOSS FIGHT" : ""));
    SND.music.setIntense(!!B);
  }

  function edgePoint(m = 40) {
    const side = Math.floor(Math.random() * 4);
    if (side === 0) return { x: rand(0, W), y: -m };
    if (side === 1) return { x: W + m, y: rand(0, H) };
    if (side === 2) return { x: rand(0, W), y: H + m };
    return { x: -m, y: rand(0, H) };
  }

  function enemyPool() {
    const w = G.wave;
    const pool = ["fact", "fact", "pap", "intern"];
    if (w >= 2) pool.push("pap", "bot");
    if (w >= 3) pool.push("bot", "scandal", "reporter");
    if (w >= 5) pool.push("reporter", "intern", "intern");
    if (w >= 7) pool.push("scandal", "bot", "reporter");
    return pool;
  }

  function spawnEnemy(type, at) {
    const T = ENEMIES[type];
    const pos = at || edgePoint();
    const scale = (1 + (G.wave - 1) * 0.14) * G.D.enemyHp;
    G.enemies.push({
      ...T, type, x: pos.x, y: pos.y,
      hp: T.hp * scale, maxHp: T.hp * scale,
      dmg: T.dmg * G.D.enemyDmg * (1 + (G.wave - 1) * 0.04),
      speed: T.speed * (1 + Math.min(G.wave - 1, 15) * 0.03),
      hit: 0, shootT: rand(90, 200), orbCd: 0, wobble: Math.random() * 6,
    });
  }

  function spawnBoss() {
    const B = bossFor(G.wave);
    if (!B) return;
    const hp = B.hp * (1 + Math.min(W, H) / 1400) * G.D.enemyHp;
    const boss = {
      ...B, type: "boss", boss: true, x: W / 2, y: -60, hp, maxHp: hp, dmg: B.dmg * G.D.enemyDmg,
      hit: 0, shootT: 120, summonT: 300, spiral: 0, orbCd: 0, wobble: 0,
    };
    G.enemies.push(boss);
    G.boss = boss;
    G.bossSpawned = true;
    $("boss-name").textContent = B.name;
    $("boss-bar").classList.remove("hidden");
    shake(20);
    SND.sfx("boss");
    SND.speak(B.voice, { lang: "en-US", pitch: 0.4, rate: 0.85, force: true });
    floatText(W / 2, H / 2 - 80, "BOSS INCOMING 😱", "#f87171", 30, 120);
  }

  // =====================================================================
  //  EFFECT HELPERS
  // =====================================================================
  function shake(n) { if (settings.shake) G.shake = Math.max(G.shake, n); }
  function flash(n = 1) { if (settings.flash) G.flash = n; }
  function vibrate(ms) {
    if (!settings.haptics) return;
    if (navigator.vibrate) try { navigator.vibrate(ms); } catch (e) { /* ignore */ }
    IN.rumble(ms, 0.6);
  }
  function floatText(x, y, text, color = "#fff", size = 18, life = 60) {
    if (G.texts.length > 80) G.texts.shift();
    G.texts.push({ x, y, text, color, size, life });
  }
  function burst(x, y, color, n = 8, spd = 4) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = rand(1, spd);
      G.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(20, 40), color, size: rand(2, 5) });
    }
    if (G.particles.length > 450) G.particles.splice(0, G.particles.length - 450);
  }
  function ring(x, y, max, color, life = 30) { G.rings.push({ x, y, r: 0, max, color, life, maxLife: life }); }

  let bannerTimer = null;
  function showBanner(title, sub = "") {
    const b = $("banner");
    b.innerHTML = `${esc(title)}${sub ? `<small>${esc(sub)}</small>` : ""}`;
    b.classList.remove("hidden");
    b.style.animation = "none";
    void b.offsetWidth;
    b.style.animation = "";
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => b.classList.add("hidden"), 2000);
  }
  let toastTimer = null;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add("hidden"), 2500);
  }

  // =====================================================================
  //  COMBAT
  // =====================================================================
  function damageEnemy(e, dmg, showNum = false) {
    if (e.dead) return;
    let crit = false;
    if (G.p.crit && Math.random() < G.p.crit) { dmg *= 2; crit = true; }
    if (G.fx.charm > 0) dmg *= 2;
    e.hp -= dmg;
    e.hit = 6;
    SND.sfx("hit");
    if (settings.dmgNumbers && (showNum || crit)) {
      floatText(e.x + rand(-10, 10), e.y - e.r, Math.round(dmg) + (crit ? "!" : ""), crit ? "#fb923c" : "#fde047", crit ? 18 : 14, 35);
    }
    if (e.hp <= 0) killEnemy(e);
  }

  function killEnemy(e) {
    e.dead = true;
    G.kills++;
    SND.sfx("kill");
    burst(e.x, e.y, e.boss ? "#facc15" : "#a78bfa", e.boss ? 60 : 10, e.boss ? 9 : 4);
    const n = Math.min(e.xp, 12), per = e.xp / n;
    for (let i = 0; i < n; i++) {
      const spread = n > 1 ? 14 : 0;
      G.gems.push({ x: e.x + rand(-spread, spread), y: e.y + rand(-spread, spread), v: per, big: !!e.boss });
    }
    if (G.p.lifesteal) G.p.hp = Math.min(G.p.maxHp, G.p.hp + G.p.lifesteal);
    if (Math.random() < 0.28) floatText(e.x, e.y - 10, pick(KILL_WORDS), pick(["#4ade80", "#f472b6", "#38bdf8", "#facc15"]), 18, 55);

    if (e.boss) {
      G.boss = null;
      $("boss-bar").classList.add("hidden");
      shake(30);
      flash(1);
      SND.sfx("explode");
      SND.music.setIntense(false);
      floatText(e.x, e.y - 40, `${e.name} GOT RATIO'D 💀`, "#facc15", 28, 140);
      voiceOf(G.ch, "Ratio! " + G.ch.phrase, true);
      spawnPowerup(e.x - 30, e.y);
      spawnPowerup(e.x + 30, e.y);
    } else if (Math.random() < 0.035) {
      spawnPowerup(e.x, e.y);
    }
    if (e.splits) for (let i = 0; i < 2; i++) spawnEnemy("mini", { x: e.x + rand(-15, 15), y: e.y + rand(-15, 15) });
  }

  function damagePlayer(d) {
    const p = G.p;
    if (p.iframes > 0 || G.fx.shield > 0 || p.dashT > 0 || state !== "playing") return;
    p.hp -= d;
    p.iframes = 45;
    shake(10);
    vibrate(60);
    SND.sfx("hurt");
    floatText(p.x, p.y - 30, pick(HURT_WORDS), "#f87171", 20, 50);
    burst(p.x, p.y, "#ef4444", 12, 5);
    if (!G.lowHpWarned && p.hp > 0 && p.hp < p.maxHp * 0.25) {
      G.lowHpWarned = true;
      voiceOf(G.ch, "I'm cooked! Somebody help!", true);
    }
    if (p.hp <= 0) { p.hp = 0; endGame(false); }
  }

  function nearestEnemy(x, y, maxD = Infinity) {
    let bestE = null, bd = maxD * maxD;
    for (const e of G.enemies) {
      if (e.dead) continue;
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d < bd) { bd = d; bestE = e; }
    }
    return bestE;
  }

  function aimAngle() {
    const p = G.p;
    const manual = IN.getAim(p.x, p.y, settings.aim === "manual");
    if (manual !== null) return { angle: manual, manual: true };
    const t = nearestEnemy(p.x, p.y, 750);
    return t ? { angle: Math.atan2(t.y - p.y, t.x - p.x), manual: false } : null;
  }

  function firePlayer() {
    const p = G.p;
    const aim = aimAngle();
    if (!aim) return false;
    p.aim = aim.angle;
    const n = p.projCount;
    for (let i = 0; i < n; i++) {
      const a = aim.angle + (i - (n - 1) / 2) * 0.17;
      G.bullets.push({
        x: p.x, y: p.y, vx: Math.cos(a) * 8.5, vy: Math.sin(a) * 8.5,
        dmg: p.dmg, pierce: p.pierce, life: 85, hits: new Set(), emoji: G.ch.bullet, size: 20,
      });
    }
    return true;
  }

  // =====================================================================
  //  POWER-UPS & SPECIALS
  // =====================================================================
  function spawnPowerup(x, y) {
    G.powerups.push({ type: pick(Object.keys(POWERUPS)), life: 900, bob: Math.random() * 6, x: x ?? rand(60, W - 60), y: y ?? rand(110, H - 70) });
  }

  function applyPowerup(type) {
    const p = G.p, P = POWERUPS[type];
    SND.sfx("power");
    floatText(p.x, p.y - 40, `${P.emoji} ${P.name.toUpperCase()}!`, "#facc15", 22, 80);
    switch (type) {
      case "shield": G.fx.shield = 300; break;
      case "hype": G.fx.hype = 360; break;
      case "pizza": p.hp = Math.min(p.maxHp, p.hp + 35); burst(p.x, p.y, "#4ade80", 16); break;
      case "double": G.fx.double = 600; break;
      case "magnet": for (const g of G.gems) g.pulled = true; break;
      case "viral":
        flash(1); shake(18);
        for (const e of G.enemies) damageEnemy(e, 60 + G.wave * 6);
        floatText(W / 2, H / 2, "IT WENT VIRAL 📱🔥", "#38bdf8", 34, 100);
        break;
    }
  }

  function useSpecial() {
    if (state !== "playing") return;
    const p = G.p;
    if (p.specialT > 0) { SND.sfx("click"); return; }
    p.specialT = G.ch.cd * p.cdMult;
    SND.sfx("special");
    vibrate(30);
    voiceOf(G.ch, G.ch.specialName + "!", true);
    const power = 1 + (G.level - 1) * 0.08;
    const label = `${G.ch.specialName.toUpperCase()} ${G.ch.specialIcon}`;

    switch (G.ch.special) {
      case "shockwave": {
        ring(p.x, p.y, 240, "#38bdf8", 35);
        shake(15);
        for (const e of G.enemies) {
          const d = Math.sqrt(dist2(e, p));
          if (d < 240) {
            const k = e.boss ? 40 : 160, nx = (e.x - p.x) / (d || 1), ny = (e.y - p.y) / (d || 1);
            e.x += nx * k; e.y += ny * k;
            damageEnemy(e, 45 * power, true);
          }
        }
        G.eBullets = G.eBullets.filter(b => dist2(b, p) > 240 * 240);
        break;
      }
      case "charm":
        G.fx.charm = 240;
        SND.sfx("charm");
        ring(p.x, p.y, Math.max(W, H), "#f472b6", 40);
        break;
      case "dash": {
        let dx = p.mvx, dy = p.mvy;
        if (!dx && !dy) { const t = nearestEnemy(p.x, p.y); if (t) { dx = t.x - p.x; dy = t.y - p.y; } else dx = 1; }
        const l = Math.hypot(dx, dy) || 1;
        p.dashDir = { x: dx / l, y: dy / l };
        p.dashT = 18;
        p.dashHits = new Set();
        p.dashDmg = 55 * power;
        SND.sfx("dash");
        break;
      }
      case "barrage":
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2;
          G.bullets.push({ x: p.x, y: p.y, vx: Math.cos(a) * 6, vy: Math.sin(a) * 6, dmg: 28 * power, pierce: 0, life: 200, hits: new Set(), emoji: G.ch.bullet, size: 26, homing: true });
        }
        break;
      case "drain": {
        let stolen = 0;
        for (const e of G.enemies) {
          if (e.x < -20 || e.x > W + 20 || e.y < -20 || e.y > H + 20) continue;
          stolen += 3;
          G.particles.push({ x: e.x, y: e.y, vx: (p.x - e.x) / 25, vy: (p.y - e.y) / 25, life: 25, color: "#facc15", size: 6 });
          damageEnemy(e, (e.boss ? 80 : 30) * power, true);
        }
        p.hp = Math.min(p.maxHp, p.hp + Math.min(stolen, 50));
        ring(p.x, p.y, 120, "#facc15", 25);
        break;
      }
      case "freeze":
        G.fx.slow = 360;
        ring(p.x, p.y, Math.max(W, H), "#93c5fd", 45);
        for (const e of G.enemies) damageEnemy(e, 12 * power);
        break;
      case "storm": {
        const targets = G.enemies.filter(e => e.x > 0 && e.x < W && e.y > 0 && e.y < H);
        for (let i = 0; i < 20; i++) {
          const t = targets.length ? pick(targets) : null;
          G.strikes.push({ x: t ? t.x + rand(-20, 20) : rand(40, W - 40), y: t ? t.y + rand(-20, 20) : rand(80, H - 40), t: 12 + i * 5, max: 12 + i * 5, dmg: 38 * power });
        }
        break;
      }
      case "decoy":
        G.decoy = { x: p.x, y: p.y, t: 360, dmg: 90 * power };
        break;
    }
    floatText(p.x, p.y - 50, label, "#fde68a", 24, 80);
  }

  // =====================================================================
  //  LEVEL UP
  // =====================================================================
  function gainXp(v) {
    G.xp += v;
    while (G.xp >= G.xpNext) {
      G.xp -= G.xpNext;
      G.level++;
      G.xpNext = Math.floor(G.xpNext * 1.3 + 4);
      G.pendingLevels++;
    }
    if (G.pendingLevels > 0 && state === "playing") openLevelUp();
  }

  let choices = [];
  function openLevelUp() {
    state = "levelup";
    IN.clearKeys();
    SND.sfx("level");
    voiceOf(G.ch, pick(LEVEL_LINES), false);
    const pool = UPGRADES.filter(u => (G.upgrades[u.id] || 0) < u.max);
    choices = [];
    for (let i = 0; i < 3 && pool.length; i++) choices.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    const list = $("upgrade-list");
    list.innerHTML = "";
    if (!choices.length) { // everything maxed: free heal instead
      G.p.hp = G.p.maxHp; G.pendingLevels = 0; state = "playing"; return;
    }
    choices.forEach((u, i) => {
      const b = document.createElement("button");
      b.className = "card";
      const lvl = G.upgrades[u.id] || 0;
      b.innerHTML = `<div class="emoji">${u.emoji}</div><div class="name">${i + 1}. ${esc(u.name)}</div><div class="desc">${esc(u.desc)}</div><div class="lvl">Lv ${lvl} → ${lvl + 1} / ${u.max}</div>`;
      b.addEventListener("click", () => chooseUpgrade(i));
      list.appendChild(b);
    });
    showScreen("levelup");
    // small delay so a held button/tap doesn't instantly pick
    list.style.pointerEvents = "none";
    setTimeout(() => { list.style.pointerEvents = ""; }, 350);
    if (IN.mode !== "touch") list.firstChild.focus();
  }

  function chooseUpgrade(i) {
    if (state !== "levelup" || !choices[i]) return;
    const u = choices[i];
    u.apply(G.p);
    G.upgrades[u.id] = (G.upgrades[u.id] || 0) + 1;
    SND.sfx("click");
    floatText(G.p.x, G.p.y - 40, `${u.emoji} ${u.name}`, "#a78bfa", 18, 70);
    G.pendingLevels--;
    hideScreen("levelup");
    state = "playing";
    blurAll();
    if (G.pendingLevels > 0) openLevelUp();
  }

  // =====================================================================
  //  UPDATE
  // =====================================================================
  function update(dt) {
    const p = G.p;
    G.time += dt;
    for (const k in G.fx) G.fx[k] = Math.max(0, G.fx[k] - dt);
    p.iframes = Math.max(0, p.iframes - dt);
    p.specialT = Math.max(0, p.specialT - dt);
    G.shake = Math.max(0, G.shake - dt);
    G.flash = Math.max(0, G.flash - 0.04 * dt);
    if (p.regen) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt / 60);

    // ---- movement ----
    const mv = IN.getMove();
    p.mvx = mv.x; p.mvy = mv.y;
    if (p.dashT > 0) {
      p.dashT -= dt;
      p.x += p.dashDir.x * 17 * dt;
      p.y += p.dashDir.y * 17 * dt;
      G.particles.push({ x: p.x, y: p.y, vx: 0, vy: 0, life: 18, color: "#e5e7eb", size: 8 });
      for (const e of G.enemies) {
        if (!p.dashHits.has(e) && dist2(e, p) < (e.r + 30) ** 2) { p.dashHits.add(e); damageEnemy(e, p.dashDmg, true); }
      }
    } else {
      const spd = p.speed * (G.fx.hype > 0 ? 1.5 : 1);
      p.x += mv.x * spd * dt;
      p.y += mv.y * spd * dt;
    }
    p.x = clamp(p.x, p.r, W - p.r);
    p.y = clamp(p.y, p.r, H - p.r);

    // ---- shooting ----
    p.fireT -= dt * (G.fx.hype > 0 ? 2 : 1);
    if (p.fireT <= 0 && firePlayer()) p.fireT = p.fireRate;

    // ---- spawning / wave flow ----
    const B = bossFor(G.wave);
    if (G.toSpawn > 0) {
      G.spawnT -= dt;
      if (G.spawnT <= 0) {
        const group = Math.min(G.toSpawn, 1 + Math.floor(G.wave / 3) + (Math.random() < 0.3 ? 1 : 0));
        const pool = enemyPool();
        for (let i = 0; i < group; i++) spawnEnemy(pick(pool));
        G.toSpawn -= group;
        G.spawnT = Math.max(14, 55 - G.wave * 4) * rand(0.7, 1.3) / G.D.spawn;
      }
    } else if (G.enemies.length === 0 && (!B || G.bossSpawned)) {
      G.waveDelay += dt;
      if (G.waveDelay > 90) { G.waveDelay = 0; nextWave(); if (state !== "playing") return; }
    }
    if (G.bossTimer > 0) { G.bossTimer -= dt; if (G.bossTimer <= 0) spawnBoss(); }

    G.powerT -= dt;
    if (G.powerT <= 0) { spawnPowerup(); G.powerT = rand(600, 900); }

    // ---- enemies ----
    const charmed = G.fx.charm > 0;
    const slow = G.fx.slow > 0 ? 0.25 : 1;
    const target = G.decoy || p;
    for (const e of G.enemies) {
      if (e.dead) continue;
      e.hit = Math.max(0, e.hit - dt);
      e.wobble += 0.1 * dt;
      const dx = target.x - e.x, dy = target.y - e.y, d = Math.hypot(dx, dy) || 1;
      if (!charmed) {
        let sp = e.speed * slow;
        const inArena = e.x > 40 && e.x < W - 40 && e.y > 40 && e.y < H - 40;
        if (e.shooter && d < 260 && inArena && !G.decoy) sp = -sp * 0.5;
        e.x += (dx / d) * sp * dt;
        e.y += (dy / d) * sp * dt;
      }
      const pd2 = dist2(e, p);
      if (!charmed && pd2 < (e.r + p.r) ** 2) damagePlayer(e.dmg);
      if (state !== "playing") return;

      const onScreen = e.x > 0 && e.x < W && e.y > 0 && e.y < H;
      if (!charmed && onScreen && (e.shooter || e.boss)) {
        e.shootT -= dt * slow;
        if (e.shootT <= 0) {
          const pdx = p.x - e.x, pdy = p.y - e.y, pd = Math.hypot(pdx, pdy) || 1;
          if (e.boss) {
            const n = G.wave % 10 === 0 ? 18 : 12, off = (e.spiral += 0.35);
            for (let i = 0; i < n; i++) {
              const a = (i / n) * Math.PI * 2 + off;
              G.eBullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3, life: 300, dmg: 12 * G.D.enemyDmg, emoji: e.bullet });
            }
            e.shootT = G.wave % 10 === 0 ? 70 : 100;
          } else {
            G.eBullets.push({ x: e.x, y: e.y, vx: (pdx / pd) * 3.6, vy: (pdy / pd) * 3.6, life: 240, dmg: 7 * G.D.enemyDmg, emoji: "❓" });
            e.shootT = rand(140, 220);
          }
        }
      }
      if (e.boss && !charmed) {
        e.summonT -= dt * slow;
        if (e.summonT <= 0) {
          for (let i = 0; i < 4; i++) spawnEnemy(pick(["intern", "pap", "fact"]), { x: e.x + rand(-50, 50), y: e.y + rand(-50, 50) });
          e.summonT = 360;
          floatText(e.x, e.y - e.r - 10, G.wave % 10 === 0 ? "summoning NPCs" : "*throws money*", "#4ade80", 16, 60);
        }
      }
    }

    // soft separation
    const es = G.enemies;
    for (let i = 0; i < es.length; i++) {
      for (let j = i + 1; j < es.length; j++) {
        const a = es[i], b = es[j];
        const dx = b.x - a.x, dy = b.y - a.y, min = a.r + b.r, dd = dx * dx + dy * dy;
        if (dd < min * min && dd > 0.01) {
          const dl = Math.sqrt(dd), push = ((min - dl) / 2) * 0.5, nx = dx / dl, ny = dy / dl;
          if (!a.boss) { a.x -= nx * push; a.y -= ny * push; }
          if (!b.boss) { b.x += nx * push; b.y += ny * push; }
        }
      }
    }

    // ---- orbs ----
    if (p.orbs > 0) {
      p.orbAngle += 0.07 * dt;
      for (const e of G.enemies) e.orbCd = Math.max(0, e.orbCd - dt);
      for (let i = 0; i < p.orbs; i++) {
        const a = p.orbAngle + (i / p.orbs) * Math.PI * 2, ox = p.x + Math.cos(a) * 75, oy = p.y + Math.sin(a) * 75;
        for (const e of G.enemies) {
          if (!e.dead && e.orbCd <= 0 && (e.x - ox) ** 2 + (e.y - oy) ** 2 < (e.r + 14) ** 2) { damageEnemy(e, p.dmg * 0.8); e.orbCd = 20; }
        }
      }
    }

    // ---- strikes (storm special) ----
    for (const s of G.strikes) {
      s.t -= dt;
      if (s.t <= 0 && !s.done) {
        s.done = true;
        ring(s.x, s.y, 70, "#fb923c", 18);
        burst(s.x, s.y, "#fb923c", 10, 5);
        SND.sfx("explode");
        shake(4);
        for (const e of G.enemies) if (dist2(e, s) < (70 + e.r) ** 2) damageEnemy(e, s.dmg);
      }
    }
    G.strikes = G.strikes.filter(s => !s.done);

    // ---- decoy ----
    if (G.decoy) {
      G.decoy.t -= dt;
      if (G.decoy.t <= 0) {
        const dc = G.decoy;
        ring(dc.x, dc.y, 180, "#f472b6", 30);
        burst(dc.x, dc.y, "#f472b6", 30, 7);
        SND.sfx("explode");
        shake(12);
        for (const e of G.enemies) if (dist2(e, dc) < (180 + e.r) ** 2) damageEnemy(e, dc.dmg, true);
        G.decoy = null;
      }
    }

    // ---- player bullets ----
    for (const b of G.bullets) {
      if (b.homing) {
        const t = nearestEnemy(b.x, b.y, 500);
        if (t) {
          const a = Math.atan2(t.y - b.y, t.x - b.x);
          b.vx += Math.cos(a) * 0.6 * dt; b.vy += Math.sin(a) * 0.6 * dt;
          const s = Math.hypot(b.vx, b.vy);
          if (s > 8) { b.vx = (b.vx / s) * 8; b.vy = (b.vy / s) * 8; }
        }
      }
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.x < -30 || b.x > W + 30 || b.y < -30 || b.y > H + 30) b.life = 0;
      for (const e of G.enemies) {
        if (b.life <= 0) break;
        if (e.dead || b.hits.has(e)) continue;
        if ((e.x - b.x) ** 2 + (e.y - b.y) ** 2 < (e.r + 8) ** 2) {
          b.hits.add(e);
          damageEnemy(e, b.dmg);
          if (b.pierce-- <= 0) b.life = 0;
        }
      }
    }
    G.bullets = G.bullets.filter(b => b.life > 0);

    // ---- enemy bullets ----
    for (const b of G.eBullets) {
      if (!charmed) { b.x += b.vx * dt * slow; b.y += b.vy * dt * slow; }
      b.life -= dt;
      if (b.x < -40 || b.x > W + 40 || b.y < -40 || b.y > H + 40) b.life = 0;
      if (b.life > 0 && dist2(b, p) < (p.r + 8) ** 2) {
        if (G.fx.shield <= 0 && p.dashT <= 0 && p.iframes <= 0) b.life = 0;
        damagePlayer(b.dmg);
        if (state !== "playing") return;
      }
    }
    G.eBullets = G.eBullets.filter(b => b.life > 0);
    G.enemies = G.enemies.filter(e => !e.dead);

    // ---- votes ----
    const mag2 = p.magnet * p.magnet;
    for (const g of G.gems) {
      const d2 = dist2(g, p);
      if (g.pulled || d2 < mag2) {
        g.pulled = true;
        const d = Math.sqrt(d2) || 1, sp = 9 * dt;
        g.x += ((p.x - g.x) / d) * Math.min(sp, d);
        g.y += ((p.y - g.y) / d) * Math.min(sp, d);
      }
      if (dist2(g, p) < (p.r + 6) ** 2) {
        g.taken = true;
        G.votes += Math.round(g.v * 10 * (G.fx.double > 0 ? 2 : 1) * G.D.score);
        SND.sfx("pickup");
        gainXp(g.v);
      }
    }
    G.gems = G.gems.filter(g => !g.taken);
    if (G.gems.length > 500) G.gems.splice(0, G.gems.length - 500);

    // ---- power-ups ----
    for (const pu of G.powerups) {
      pu.life -= dt; pu.bob += 0.08 * dt;
      if (dist2(pu, p) < (p.r + 20) ** 2) { pu.life = 0; applyPowerup(pu.type); }
    }
    G.powerups = G.powerups.filter(pu => pu.life > 0);

    // ---- cosmetics ----
    for (const pt of G.particles) { pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vx *= 0.94; pt.vy *= 0.94; pt.life -= dt; }
    G.particles = G.particles.filter(pt => pt.life > 0);
    for (const t of G.texts) { t.y -= 0.7 * dt; t.life -= dt; }
    G.texts = G.texts.filter(t => t.life > 0);
    for (const r of G.rings) { r.life -= dt; r.r = r.max * (1 - r.life / r.maxLife); }
    G.rings = G.rings.filter(r => r.life > 0);
  }

  // =====================================================================
  //  DRAW
  // =====================================================================
  function drawBackground(t) {
    ctx.fillStyle = "#11112b";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(167,139,250,0.08)";
    ctx.lineWidth = 1;
    const off = (t * 0.3) % 48;
    ctx.beginPath();
    for (let x = -48 + off; x < W; x += 48) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = -48 + off; y < H; y += 48) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = "#fff";
    ctx.font = `900 ${Math.min(W, H) * 0.18}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("VOTE", W / 2, H / 2);
    ctx.restore();
  }

  function drawStick(s, color) {
    const R = IN.JOY_R;
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(s.ox, s.oy, R, 0, Math.PI * 2); ctx.stroke();
    const dx = s.x - s.ox, dy = s.y - s.oy, l = Math.hypot(dx, dy), k = l > R ? R / l : 1;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(s.ox + dx * k, s.oy + dy * k, 24, 0, Math.PI * 2); ctx.fill();
  }

  function draw() {
    const t = G ? G.time : performance.now() / 16;
    ctx.setTransform(DPR * SCALE, 0, 0, DPR * SCALE, 0, 0);
    ctx.save();
    if (G && G.shake > 0 && state === "playing") ctx.translate(rand(-G.shake, G.shake) * 0.6, rand(-G.shake, G.shake) * 0.6);
    drawBackground(t);
    if (!G) { ctx.restore(); return; }
    const p = G.p;

    for (const g of G.gems) {
      ctx.fillStyle = g.big ? "#facc15" : "#38bdf8";
      ctx.beginPath(); ctx.arc(g.x, g.y, g.big ? 7 : 4.5, 0, Math.PI * 2); ctx.fill();
    }

    for (const pu of G.powerups) {
      if (pu.life < 180 && Math.floor(pu.life / 10) % 2 === 0) continue;
      const y = pu.y + Math.sin(pu.bob) * 5;
      ctx.fillStyle = "rgba(250,204,21,0.18)";
      ctx.beginPath(); ctx.arc(pu.x, y, 22 + Math.sin(pu.bob * 2) * 3, 0, Math.PI * 2); ctx.fill();
      drawSprite(POWERUPS[pu.type].emoji, pu.x, y, 28);
    }

    for (const r of G.rings) {
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = r.life / r.maxLife;
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    for (const s of G.strikes) {
      const k = 1 - s.t / s.max;
      ctx.strokeStyle = `rgba(248,113,113,${0.3 + k * 0.6})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(s.x, s.y, 70 * (1 - k * 0.5), 0, Math.PI * 2); ctx.stroke();
      if (s.t < 30) drawSprite("☄️", s.x + s.t * 4, s.y - s.t * 10, 30);
    }

    if (G.decoy) {
      const dc = G.decoy;
      drawAvatar(G.ch, dc.x, dc.y, 20, 0.55 + Math.sin(G.time * 0.3) * 0.2);
      drawSprite("🎭", dc.x, dc.y - 34, 20);
      ctx.strokeStyle = "#f472b6"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(dc.x, dc.y, 28, -Math.PI / 2, -Math.PI / 2 + (dc.t / 360) * Math.PI * 2); ctx.stroke();
    }

    const charmed = G.fx.charm > 0, slowed = G.fx.slow > 0;
    for (const e of G.enemies) {
      drawSprite(e.emoji, e.x, e.y, e.size, Math.sin(e.wobble) * 0.12);
      if (e.hit > 0) {
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill();
      }
      if (charmed) drawSprite("💕", e.x, e.y - e.r - 8, 16);
      else if (slowed) drawSprite("📜", e.x, e.y - e.r - 8, 14);
      if (!e.boss && e.hp < e.maxHp) {
        const w = e.r * 2;
        ctx.fillStyle = "#0008"; ctx.fillRect(e.x - w / 2, e.y + e.r + 3, w, 4);
        ctx.fillStyle = "#ef4444"; ctx.fillRect(e.x - w / 2, e.y + e.r + 3, w * Math.max(0, e.hp / e.maxHp), 4);
      }
    }

    for (const b of G.eBullets) drawSprite(b.emoji, b.x, b.y, 18);
    for (const b of G.bullets) drawSprite(b.emoji, b.x, b.y, b.size, b.homing ? Math.atan2(b.vy, b.vx) : 0);

    for (let i = 0; i < p.orbs; i++) {
      const a = p.orbAngle + (i / p.orbs) * Math.PI * 2;
      drawSprite("🌀", p.x + Math.cos(a) * 75, p.y + Math.sin(a) * 75, 24, p.orbAngle * 3);
    }

    ctx.strokeStyle = "rgba(56,189,248,0.08)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.magnet, 0, Math.PI * 2); ctx.stroke();

    // aim indicator
    ctx.strokeStyle = "rgba(250,204,21,0.5)"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(p.x, p.y, 30, p.aim - 0.3, p.aim + 0.3); ctx.stroke();

    if (G.fx.shield > 0) {
      ctx.fillStyle = "rgba(96,165,250,0.25)"; ctx.strokeStyle = "#60a5fa"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(p.x, p.y, 34 + Math.sin(G.time * 0.2) * 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    if (G.fx.hype > 0) {
      ctx.fillStyle = "rgba(250,204,21,0.2)";
      ctx.beginPath(); ctx.arc(p.x, p.y, 30, 0, Math.PI * 2); ctx.fill();
    }
    const flicker = p.iframes > 0 && Math.floor(p.iframes / 4) % 2 === 0;
    if (!flicker) drawAvatar(G.ch, p.x, p.y + (p.mvx || p.mvy ? Math.sin(G.time * 0.4) * 2 : 0), p.r);

    for (const pt of G.particles) {
      ctx.globalAlpha = Math.min(1, pt.life / 20);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;

    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
    for (const tx of G.texts) {
      ctx.globalAlpha = Math.min(1, tx.life / 20);
      ctx.font = `900 ${tx.size}px "Trebuchet MS", sans-serif`;
      ctx.lineWidth = 4; ctx.strokeStyle = "#000";
      ctx.strokeText(tx.text, tx.x, tx.y);
      ctx.fillStyle = tx.color;
      ctx.fillText(tx.text, tx.x, tx.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // ---- screen-space overlays ----
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (state === "playing" && IN.mode === "touch") {
      if (IN.joy.active) drawStick(IN.joy, "rgba(255,255,255,0.45)");
      else {
        ctx.globalAlpha = 0.35;
        drawStick({ ox: 90, oy: SH - 110, x: 90, y: SH - 110 }, "rgba(255,255,255,0.5)");
        ctx.fillStyle = "#fff"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center";
        ctx.fillText("DRAG TO MOVE", 90, SH - 40);
        ctx.globalAlpha = 1;
      }
      if (IN.aimJoy.active) drawStick(IN.aimJoy, "rgba(250,204,21,0.5)");
    }
    if (G.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${G.flash * 0.6})`;
      ctx.fillRect(0, 0, SW, SH);
    }
  }

  // =====================================================================
  //  HUD
  // =====================================================================
  const hudCache = {};
  function setHud(id, prop, val) {
    const key = id + prop;
    if (hudCache[key] === val) return;
    hudCache[key] = val;
    const el = $(id);
    if (prop === "text") el.textContent = val;
    else if (prop === "html") el.innerHTML = val;
    else el.style[prop] = val;
  }
  function updateHud() {
    const p = G.p;
    setHud("hp-fill", "width", ((p.hp / p.maxHp) * 100).toFixed(1) + "%");
    setHud("hp-text", "text", `${Math.ceil(p.hp)}/${Math.round(p.maxHp)} HP`);
    $("hp-fill").parentElement.classList.toggle("low", p.hp < p.maxHp * 0.25);
    setHud("xp-fill", "width", ((G.xp / G.xpNext) * 100).toFixed(1) + "%");
    setHud("lvl-text", "text", `LVL ${G.level}`);
    setHud("votes", "text", G.votes.toLocaleString());
    setHud("wave-text", "text", `Wave ${G.wave}${G.endless ? "" : "/" + WAVES.length} · ${waveName(G.wave)}`);
    const cdMax = G.ch.cd * p.cdMult;
    setHud("special-cd", "height", ((p.specialT / cdMax) * 100).toFixed(0) + "%");
    $("special-btn").classList.toggle("ready", p.specialT <= 0);
    const fx = [];
    if (G.fx.shield > 0) fx.push(`🛡️ ${Math.ceil(G.fx.shield / 60)}s`);
    if (G.fx.hype > 0) fx.push(`⚡ ${Math.ceil(G.fx.hype / 60)}s`);
    if (G.fx.double > 0) fx.push(`🗳️x2 ${Math.ceil(G.fx.double / 60)}s`);
    if (G.fx.charm > 0) fx.push(`💕 ${Math.ceil(G.fx.charm / 60)}s`);
    if (G.fx.slow > 0) fx.push(`📜 ${Math.ceil(G.fx.slow / 60)}s`);
    setHud("effects", "html", fx.map(f => `<span class="fx">${f}</span>`).join(""));
    if (G.boss) setHud("boss-fill", "width", Math.max(0, (G.boss.hp / G.boss.maxHp) * 100).toFixed(1) + "%");
  }

  // =====================================================================
  //  SCREENS & NAVIGATION
  // =====================================================================
  const SCREEN_ORDER = ["settings", "levelup", "pause", "gameover", "howto", "board", "select", "menu"];
  let settingsReturn = null;
  function showScreen(id) { $(id).classList.remove("hidden"); }
  function hideScreen(id) { $(id).classList.add("hidden"); }
  function hideAllScreens() { SCREEN_ORDER.forEach(hideScreen); }
  function topScreen() { for (const id of SCREEN_ORDER) if (!$(id).classList.contains("hidden")) return $(id); return null; }
  function blurAll() { if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); }
  function focusPrimary(scr) {
    if (!scr || IN.mode === "touch") return;
    const el = scr.querySelector("[data-primary]") || scr.querySelector("button");
    if (el) el.focus({ preventScroll: true });
  }
  function goTo(id) {
    hideAllScreens();
    showScreen(id);
    focusPrimary($(id));
  }

  function navigate(dir, source) {
    if (state === "playing") return;
    const scr = topScreen();
    if (!scr) return;
    const cur = document.activeElement;
    if (source === "key" && cur && cur.id === "sel-search") return;
    if (source === "pad" && cur && cur.type === "range" && (dir === "left" || dir === "right")) {
      cur.value = clamp(Number(cur.value) + (dir === "right" ? 1 : -1) * Number(cur.step || 0.1), Number(cur.min), Number(cur.max));
      cur.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    const els = [...scr.querySelectorAll("button, input")].filter(e => e.offsetParent !== null && !e.disabled);
    if (!els.length) return;
    if (!scr.contains(cur) || cur === document.body) { (scr.querySelector("[data-primary]") || els[0]).focus(); return; }
    const r = cur.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let bestEl = null, bs = Infinity;
    for (const e of els) {
      if (e === cur) continue;
      const q = e.getBoundingClientRect(), x = q.left + q.width / 2 - cx, y = q.top + q.height / 2 - cy;
      let main, cross;
      if (dir === "left") { main = -x; cross = y; } else if (dir === "right") { main = x; cross = y; }
      else if (dir === "up") { main = -y; cross = x; } else { main = y; cross = x; }
      if (main <= 4) continue;
      const s = main + Math.abs(cross) * 2.5;
      if (s < bs) { bs = s; bestEl = e; }
    }
    if (bestEl) { bestEl.focus(); bestEl.scrollIntoView({ block: "nearest", inline: "nearest" }); SND.sfx("click"); }
  }

  function back() {
    const scr = topScreen();
    if (!scr) return;
    switch (scr.id) {
      case "settings": closeSettings(); break;
      case "pause": togglePause(); break;
      case "select": case "howto": case "board": goTo("menu"); break;
      case "gameover": toMenu(); break;
    }
  }

  // ---------- main menu ----------
  function renderMenu() {
    $("best-score").textContent = best.toLocaleString();
    const featured = CHARS.filter(c => c.featured);
    const shown = [];
    while (shown.length < 6) { const c = pick(featured); if (!shown.includes(c)) shown.push(c); }
    $("title-flags").innerHTML = shown.map((c, i) => `<img src="${BR.flagUrl(c.code)}" alt="${esc(c.name)}" style="animation-delay:${i * 0.15}s">`).join("");
  }
  function toMenu() {
    state = "menu";
    G = null;
    SND.music.setIntense(false);
    $("hud").classList.add("hidden");
    $("banner").classList.add("hidden");
    $("boss-bar").classList.add("hidden");
    renderMenu();
    goTo("menu");
  }

  // ---------- character select ----------
  let selTab = "All", selQuery = "";
  function renderTabs() {
    const tabs = ["All", "⭐ Featured", ...BR.REGIONS];
    $("sel-tabs").innerHTML = tabs.map(t => `<button data-tab="${esc(t)}" class="${t === selTab ? "on" : ""}">${esc(t)}</button>`).join("");
  }
  function filteredChars() {
    const q = selQuery.trim().toLowerCase();
    return CHARS.filter(c =>
      (selTab === "All" || (selTab === "⭐ Featured" && c.featured) || c.region === selTab) &&
      (!q || c.name.toLowerCase().includes(q) || c.party.toLowerCase().includes(q) || c.code.toLowerCase() === q));
  }
  function renderGrid() {
    const list = filteredChars();
    $("sel-count").textContent = `${list.length} / ${CHARS.length} countries`;
    $("char-grid").innerHTML = list.length
      ? list.map(c => `<button class="ccard${c === selected ? " on" : ""}" data-code="${c.code}" title="${esc(c.party)}">
          ${c.featured ? '<span class="star">⭐</span>' : ""}<span class="m">${c.mascot}</span>
          <img loading="lazy" src="${BR.flagUrl(c.code)}" alt="" />
          <span class="n">${esc(c.name)}${wins[c.code] ? " 🏆" : ""}</span><span class="p">${esc(c.party)}</span></button>`).join("")
      : `<div class="empty">No country matches "${esc(selQuery)}"</div>`;
  }
  function statRow(label, v) { return `<div class="statrow"><span>${label}</span><div class="statbar"><div style="width:${Math.round(clamp(v, 0.05, 1) * 100)}%"></div></div></div>`; }
  function renderDetail() {
    const c = selected;
    $("sel-detail").innerHTML = `
      <div class="hero"><img src="${BR.flagUrl(c.code)}" alt="" /><span class="mascot">${c.mascot}</span>
        <div><div class="cname">${esc(c.name)}</div><div class="cparty">${esc(c.party)}<span class="typebadge">${c.typeLabel}</span></div></div></div>
      <div class="phrase">“${esc(c.phrase)}”</div>
      ${statRow("❤️ Health", c.hp / 150)}${statRow("👟 Speed", (c.speed - 2.4) / 1.5)}${statRow("💥 Damage", c.dmg / 16)}${statRow("🔫 Fire rate", 10 / c.fireRate)}
      <div class="special"><b>${c.specialIcon} ${esc(c.specialName)}</b><br />${esc(c.specialDesc)}</div>
      <div class="diff-row"><span>Difficulty</span><div class="seg" id="sel-diff">
        ${Object.entries(DIFFICULTY).map(([k, d]) => `<button data-diff="${k}" class="${settings.difficulty === k ? "on" : ""}">${d.label}</button>`).join("")}</div></div>
      <div class="sel-actions">
        <button class="big-btn secondary" id="sel-voice">🔊 Voice</button>
        <button class="big-btn secondary" id="sel-random">🎲 Random</button>
      </div>
      <button class="big-btn start" id="sel-start" data-primary>🗳️ START CAMPAIGN</button>`;
  }
  function selectChar(c, speak = true) {
    selected = c;
    store.set("char", c.code);
    document.querySelectorAll(".ccard.on").forEach(el => el.classList.remove("on"));
    const card = document.querySelector(`.ccard[data-code="${c.code}"]`);
    if (card) card.classList.add("on");
    renderDetail();
    if (speak) { SND.init(); voiceOf(c, c.phrase, true); }
  }
  function openSelect() {
    SND.init();
    SND.music.start();
    renderTabs();
    renderGrid();
    renderDetail();
    goTo("select");
    const card = document.querySelector(".ccard.on");
    if (card) card.scrollIntoView({ block: "center" });
  }

  // ---------- how to play / leaderboard ----------
  function renderHowto() {
    $("legend-powerups").innerHTML = Object.values(POWERUPS).map(p => `<div>${p.emoji} <b>${p.name}</b>: ${p.desc}</div>`).join("");
    $("legend-enemies").innerHTML = Object.values(ENEMIES).filter(e => e.info).map(e => `<div>${e.emoji} <b>${e.name}</b>: ${e.info}</div>`).join("") +
      Object.values(BOSS_DEFS).map(b => `<div>${b.emoji} <b>${esc(b.name)}</b>: boss</div>`).join("");
  }
  function renderBoard() {
    const board = store.get("board", []);
    $("board-body").innerHTML = board.length
      ? board.map((r, i) => `<tr><td>${i + 1}</td><td><img src="${BR.flagUrl(r.code)}" alt="">${esc(r.name)}${r.won ? " 🏆" : ""}</td><td>${r.votes.toLocaleString()}</td><td>${r.wave}</td><td>${esc(DIFFICULTY[r.diff] ? DIFFICULTY[r.diff].label : r.diff)}${r.endless ? " ♾️" : ""}</td></tr>`).join("")
      : `<tr><td colspan="5">No runs yet. Go farm some aura!</td></tr>`;
  }
  function recordRun(won) {
    const board = store.get("board", []).filter(r => r.id !== G.runId);
    board.push({ id: G.runId, votes: G.votes, code: G.ch.code, name: G.ch.name, wave: Math.min(G.wave, G.endless ? G.wave : WAVES.length), diff: G.diff, won: won || G.endless, endless: G.endless, date: Date.now() });
    board.sort((a, b) => b.votes - a.votes);
    store.set("board", board.slice(0, 15));
    if (G.votes > best) { best = G.votes; store.set("best", best); }
    if (won && !G.endless) { wins[G.ch.code] = (wins[G.ch.code] || 0) + 1; store.set("wins", wins); }
  }

  // ---------- settings ----------
  function renderSettings() {
    $("set-music").value = settings.music;
    $("set-sfx").value = settings.sfx;
    $("set-voice").value = settings.voice;
    $("set-muted").checked = settings.muted;
    $("set-shake").checked = settings.shake;
    $("set-flash").checked = settings.flash;
    $("set-dmgnum").checked = settings.dmgNumbers;
    $("set-haptics").checked = settings.haptics;
    document.querySelectorAll("#set-aim button").forEach(b => b.classList.toggle("on", b.dataset.v === settings.aim));
  }
  function openSettings() {
    settingsReturn = topScreen() ? topScreen().id : null;
    renderSettings();
    showScreen("settings");
    focusPrimary($("settings"));
  }
  function closeSettings() {
    hideScreen("settings");
    const scr = topScreen();
    focusPrimary(scr);
  }

  // ---------- game flow ----------
  function startGame(ch = selected) {
    SND.init();
    SND.music.start();
    hideAllScreens();
    $("boss-bar").classList.add("hidden");
    $("hud").classList.remove("hidden");
    IN.clearKeys();
    blurAll();
    newGame(ch);
    state = "playing";
    voiceOf(ch, ch.phrase, true);
  }

  function togglePause() {
    if (state === "playing") {
      state = "paused";
      IN.clearKeys();
      $("pause-stats").innerHTML = `<div>🗳️ Votes: <b>${G.votes.toLocaleString()}</b></div><div>🌊 Wave: <b>${G.wave}</b></div>
        <div>📈 Level: <b>${G.level}</b></div><div>💀 Haters: <b>${G.kills}</b></div>`;
      showScreen("pause");
      focusPrimary($("pause"));
    } else if (state === "paused") {
      if (!$("settings").classList.contains("hidden")) return;
      state = "playing";
      hideScreen("pause");
      blurAll();
    }
  }

  function endGame(won) {
    if (state === "over") return;
    state = "over";
    IN.clearKeys();
    recordRun(won);
    SND.sfx(won ? "win" : "lose");
    SND.music.setIntense(false);
    vibrate(won ? 200 : 300);
    $("go-flag").src = BR.flagUrl(G.ch.code);
    $("go-title").textContent = won ? "YOU GOT ELECTED 🏛️👑" : "YOU LOST THE ELECTION 💀";
    $("go-sub").textContent = won
      ? pick(["Absolute sigma. The people have spoken.", "Max aura achieved. Inauguration is bussin.", "W campaign, no cap."])
      : pick(["Absolutely cooked.", "Ratio'd by the electorate.", "Skill issue tbh.", "Your campaign got fanum taxed."]);
    $("go-stats").innerHTML = `
      <div>🗳️ Votes: <b>${G.votes.toLocaleString()}</b></div><div>🏆 Best: <b>${best.toLocaleString()}</b></div>
      <div>🌊 Wave: <b>${G.wave}</b></div><div>💀 Haters: <b>${G.kills}</b></div>
      <div>📈 Level: <b>${G.level}</b></div><div>🎚️ <b>${DIFFICULTY[G.diff].label}</b></div>`;
    $("endless-btn").classList.toggle("hidden", !(won && !G.endless));
    voiceOf(G.ch, won ? `We got elected! ${G.ch.phrase}` : "Ratio'd by the voters. I'm cooked.", true);
    setTimeout(() => {
      if (state !== "over") return;
      showScreen("gameover");
      const eb = $("endless-btn");
      if (IN.mode !== "touch") (eb.classList.contains("hidden") ? $("again-btn") : eb).focus();
    }, won ? 400 : 800);
  }

  function continueEndless() {
    if (!G) return;
    G.endless = true;
    G.p.hp = G.p.maxHp;
    hideScreen("gameover");
    state = "playing";
    blurAll();
    voiceOf(G.ch, "Four more waves! No, infinite waves!", true);
    nextWave();
  }

  function isFullscreen() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  function toggleFullscreen() {
    const el = document.documentElement;
    try {
      if (isFullscreen()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else {
        const req = el.requestFullscreen || el.webkitRequestFullscreen;
        const r = req && req.call(el, { navigationUI: "hide" });
        if (r && r.catch) r.catch(() => toast("Fullscreen not allowed here"));
      }
    } catch (e) { toast("Fullscreen not supported"); }
  }
  function toggleMute() {
    settings.muted = !settings.muted;
    applySettings();
    renderSettings();
    toast(settings.muted ? "🔇 Muted" : "🔊 Sound on");
  }

  // =====================================================================
  //  EVENT WIRING
  // =====================================================================
  const click = (id, fn) => $(id).addEventListener("click", e => { SND.init(); SND.sfx("click"); fn(e); });

  click("btn-play", openSelect);
  click("btn-howto", () => { renderHowto(); goTo("howto"); });
  click("btn-board", () => { renderBoard(); goTo("board"); });
  click("btn-settings", openSettings);
  click("btn-fs", toggleFullscreen);
  click("sel-back", () => goTo("menu"));
  document.querySelectorAll(".back-btn").forEach(b => b.addEventListener("click", () => { SND.sfx("click"); back(); }));
  click("board-reset", () => { if (confirm("Reset the leaderboard and best score?")) { store.set("board", []); store.set("best", 0); best = 0; renderBoard(); } });

  $("sel-tabs").addEventListener("click", e => {
    const b = e.target.closest("button[data-tab]");
    if (!b) return;
    SND.sfx("click");
    selTab = b.dataset.tab;
    renderTabs(); renderGrid();
    const nb = $("sel-tabs").querySelector(`[data-tab="${CSS.escape(selTab)}"]`);
    if (nb && IN.mode !== "touch") nb.focus();
  });
  $("sel-search").addEventListener("input", e => { selQuery = e.target.value; renderGrid(); });
  $("sel-search").addEventListener("keydown", e => {
    if (e.key === "Enter") { const first = document.querySelector(".ccard"); if (first) { selectChar(CHARS.find(c => c.code === first.dataset.code)); first.focus(); } }
  });
  $("char-grid").addEventListener("click", e => {
    const b = e.target.closest(".ccard");
    if (!b) return;
    SND.sfx("click");
    selectChar(CHARS.find(c => c.code === b.dataset.code));
  });
  $("sel-detail").addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b) return;
    SND.init();
    SND.sfx("click");
    if (b.dataset.diff) {
      settings.difficulty = b.dataset.diff;
      applySettings();
      document.querySelectorAll("#sel-diff button").forEach(x => x.classList.toggle("on", x === b));
    } else if (b.id === "sel-voice") voiceOf(selected, selected.phrase, true);
    else if (b.id === "sel-random") {
      const list = filteredChars().length ? filteredChars() : CHARS;
      selectChar(pick(list));
      const card = document.querySelector(".ccard.on");
      if (card) card.scrollIntoView({ block: "nearest" });
      if (IN.mode !== "touch") $("sel-random").focus();
    } else if (b.id === "sel-start") startGame(selected);
  });

  // settings controls
  [["set-music", "music"], ["set-sfx", "sfx"], ["set-voice", "voice"]].forEach(([id, key]) =>
    $(id).addEventListener("input", e => { settings[key] = Number(e.target.value); applySettings(); if (key === "sfx") SND.sfx("pickup"); }));
  [["set-muted", "muted"], ["set-shake", "shake"], ["set-flash", "flash"], ["set-dmgnum", "dmgNumbers"], ["set-haptics", "haptics"]].forEach(([id, key]) =>
    $(id).addEventListener("change", e => { settings[key] = e.target.checked; applySettings(); }));
  $("set-aim").addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b) return;
    settings.aim = b.dataset.v;
    applySettings();
    renderSettings();
    if (IN.mode !== "touch") b.focus();
  });
  click("test-voice", () => voiceOf(selected, selected.phrase, true));

  // HUD buttons: use pointerdown so they react instantly on touch and never steal keyboard focus
  const hudBtn = (id, fn) => {
    const el = $(id);
    el.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); SND.init(); fn(); });
    el.addEventListener("click", e => { if (e.detail === 0) fn(); }); // keyboard activation fallback
  };
  hudBtn("special-btn", useSpecial);
  hudBtn("hud-pause", togglePause);
  hudBtn("hud-mute", toggleMute);
  hudBtn("hud-fs", toggleFullscreen);

  click("resume-btn", togglePause);
  click("pause-settings", openSettings);
  click("restart-btn", () => startGame(G ? G.ch : selected));
  click("quit-btn", toMenu);
  click("again-btn", () => startGame(G ? G.ch : selected));
  click("change-btn", openSelect);
  click("menu-btn", toMenu);
  click("endless-btn", continueEndless);

  // unified inputs
  IN.on("special", (src, e) => {
    if (state === "playing") { if (e) e.preventDefault(); useSpecial(); }
  });
  IN.on("pause", () => {
    if (state === "playing" || state === "paused") {
      if (!$("settings").classList.contains("hidden")) closeSettings(); else togglePause();
    } else if (state !== "levelup") back();
  });
  IN.on("back", () => { if (state === "paused" || state === "menu" || state === "over") back(); });
  IN.on("choose", i => chooseUpgrade(i));
  IN.on("mute", toggleMute);
  IN.on("fullscreen", toggleFullscreen);
  IN.on("nav", navigate);
  IN.on("confirm", src => {
    if (state === "playing") return;
    const scr = topScreen();
    if (!scr) return;
    const a = document.activeElement;
    if (a && scr.contains(a) && (a.tagName === "BUTTON")) { if (src === "pad") a.click(); }
    else if (a && a.type === "checkbox" && src === "pad") a.click();
    else { const pr = scr.querySelector("[data-primary]") || scr.querySelector("button"); if (pr) pr.focus(); }
  });
  IN.on("gamepad", (on, id) => toast(on ? "🎮 Controller connected" : "🎮 Controller disconnected"));
  IN.on("mode", m => {
    if (m !== "touch" && state !== "playing") { const scr = topScreen(); if (scr && !scr.contains(document.activeElement)) focusPrimary(scr); }
  });
  // Space/Enter on menus should not double-fire specials; and any key unlocks audio
  window.addEventListener("pointerdown", () => SND.init(), { once: false, passive: true });

  // Auto-pause when the tab/app goes to background
  document.addEventListener("visibilitychange", () => { if (document.hidden && state === "playing") togglePause(); });
  window.addEventListener("blur", () => { IN.clearKeys(); if (state === "playing") togglePause(); });
  window.addEventListener("resize", resize);
  if (!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen)) {
    document.querySelectorAll(".fs-btn").forEach(b => b.classList.add("hidden"));
  }

  // =====================================================================
  //  MAIN LOOP
  // =====================================================================
  resize();
  IN.attachCanvas(canvas);
  applySettings();
  renderMenu();
  focusPrimary($("menu"));

  let last = performance.now();
  function loop(now) {
    const dt = Math.min((now - last) / (1000 / 60), 3);
    last = now;
    IN.poll();
    if (state === "playing") { update(dt); if (G && state !== "menu") updateHud(); }
    draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // debug/test hook
  window.__game = { get G() { return G; }, get state() { return state; }, settings, CHARS };
})();
