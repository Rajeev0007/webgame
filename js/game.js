// Brainrot Election 2026: game engine + UI
(() => {
  "use strict";
  const BR = window.BR;
  const SND = BR.Audio, IN = BR.Input, CHARS = BR.CHARACTERS, META = BR.Meta;
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
    fact:       { name: "Fact Checker", emoji: "🧐", hp: 18, speed: 1.4,  dmg: 8,  r: 16, xp: 1, size: 32, info: "Chases you. Basic hater." },
    pap:        { name: "Paparazzi",    emoji: "📸", hp: 10, speed: 2.4,  dmg: 5,  r: 14, xp: 1, size: 28, info: "Fast and fragile." },
    intern:     { name: "Intern",       emoji: "☕", hp: 8,  speed: 3.0,  dmg: 4,  r: 12, xp: 1, size: 24, info: "Very fast, comes in swarms." },
    protester:  { name: "Protester",    emoji: "🪧", hp: 20, speed: 1.25, dmg: 7,  r: 15, xp: 1, size: 30, mob: true, info: "Shows up in mobs of 6." },
    bot:        { name: "Troll Bot",    emoji: "🤖", hp: 42, speed: 1.0,  dmg: 12, r: 18, xp: 2, size: 36, info: "Slow but tanky." },
    reporter:   { name: "Reporter",     emoji: "🎤", hp: 26, speed: 1.1,  dmg: 8,  r: 16, xp: 2, size: 32, shooter: true, info: "Keeps its distance and throws ❓ questions." },
    influencer: { name: "Influencer",   emoji: "🤳", hp: 24, speed: 1.3,  dmg: 11, r: 15, xp: 2, size: 30, charger: true, info: "Stops, flashes ❗, then charges at you." },
    scandal:    { name: "Scandal",      emoji: "💩", hp: 55, speed: 0.9,  dmg: 14, r: 20, xp: 3, size: 40, splits: true, info: "Splits into 2 mini scandals." },
    pollster:   { name: "Pollster",     emoji: "📊", hp: 34, speed: 0.85, dmg: 6,  r: 16, xp: 3, size: 32, healer: true, info: "Heals nearby haters. Kill it first!" },
    hacker:     { name: "Hacker",       emoji: "👾", hp: 16, speed: 1.2,  dmg: 9,  r: 14, xp: 2, size: 30, teleporter: true, info: "Flickers, then teleports next to you." },
    mini:       { name: "Mini Scandal", emoji: "💩", hp: 12, speed: 1.9,  dmg: 6,  r: 11, xp: 1, size: 22, info: "" },
  };
  const BOSS_DEFS = {
    lobbyist:  { id: "lobbyist",  name: "THE LOBBYIST",       emoji: "💰", hp: 900,  speed: 0.75, dmg: 25, r: 44, xp: 40,  size: 88,  bullet: "💵", pattern: "ring",    voice: "The Lobbyist has entered the chat." },
    lizard:    { id: "lizard",    name: "LIZARD OVERLORD 👁️", emoji: "🦎", hp: 2200, speed: 0.9,  dmg: 30, r: 50, xp: 80,  size: 100, bullet: "👁️", pattern: "spiral",  voice: "The Lizard Overlord is here. Your aura is mine." },
    mogul:     { id: "mogul",     name: "THE MEDIA MOGUL",    emoji: "📺", hp: 3400, speed: 0.8,  dmg: 30, r: 48, xp: 120, size: 96,  bullet: "📰", pattern: "streams", voice: "Breaking news. You are cancelled." },
    algorithm: { id: "algorithm", name: "THE ALGORITHM",      emoji: "🧠", hp: 4400, speed: 1.0,  dmg: 32, r: 46, xp: 160, size: 92,  bullet: "🔻", pattern: "fan",     voice: "The Algorithm has decided. You will not trend." },
  };
  const BOSS_ORDER = ["lobbyist", "lizard", "mogul", "algorithm"];
  const WAVES = ["Town Hall", "Iowa Caucus", "Primary Season", "TV Debate", "Lobbyist Showdown",
    "Swing States", "Scandal Week", "October Surprise", "Final Debate", "ELECTION NIGHT"];
  const waveName = w => (w <= WAVES.length ? WAVES[w - 1] : `Re-election #${w - WAVES.length}`);
  function bossFor(w) {
    if (w % 5 !== 0) return null;
    const n = w / 5 - 1;
    const B = BOSS_DEFS[BOSS_ORDER[n % BOSS_ORDER.length]];
    const cycle = Math.floor(n / BOSS_ORDER.length);
    return { ...B, hp: B.hp * (1 + cycle * 1.2 + Math.max(0, w - 10) * 0.05) };
  }

  const EVENTS = {
    debate:   { emoji: "📺", name: "Debate Night",  desc: "Haters move 30% faster" },
    golden:   { emoji: "✨", name: "Golden Hour",   desc: "Every vote counts double" },
    news:     { emoji: "📰", name: "Breaking News", desc: "Power-ups drop 3x as often" },
    turnout:  { emoji: "🌧️", name: "Low Turnout",   desc: "Fewer haters, but 3x elites" },
    rally:    { emoji: "🎉", name: "Rally Day",     desc: "+50% haters, +50% votes" },
    blackout: { emoji: "🕶️", name: "Blackout",      desc: "Lights out! You can only see near you" },
  };

  const POWERUPS = {
    shield: { emoji: "🛡️", name: "Filibuster",   desc: "Invincible for 5s" },
    hype:   { emoji: "⚡", name: "Energy Drink", desc: "Faster + rapid fire for 6s" },
    pizza:  { emoji: "🍕", name: "Free Pizza",   desc: "Heals 35 HP" },
    viral:  { emoji: "📱", name: "Viral Tweet",  desc: "Damages every hater" },
    double: { emoji: "🗳️", name: "Double Votes", desc: "2x votes for 10s" },
    magnet: { emoji: "🧲", name: "Vote Magnet",  desc: "Pulls in every vote" },
  };

  const WEAPONS = {
    boomerang: { emoji: "🪃", name: "Boomerang Policy", desc: "Throws boomerangs that fly out, come back, and pierce everything.", lvl: "+1 boomerang, +20% damage" },
    mic:       { emoji: "🎤", name: "Mic Drop",         desc: "A shockwave pulses out around you.",                            lvl: "Bigger, stronger, more often" },
    chain:     { emoji: "⚡", name: "Hot Mic Chain",    desc: "Lightning hits a hater and jumps to the next ones.",          lvl: "+2 jumps, +25% damage" },
    bus:       { emoji: "🚌", name: "Campaign Bus",     desc: "A campaign bus runs over every hater in its lane.",           lvl: "More buses, +30% damage" },
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
    ...Object.entries(WEAPONS).map(([id, w]) => ({ id, emoji: w.emoji, name: w.name, desc: w.desc, lvlDesc: w.lvl, max: 5, weapon: true, apply: p => p.weapons[id]++ })),
  ];

  const KILL_WORDS = ["W", "+aura", "no cap", "ratio'd", "based", "sheesh", "skibidi", "fanum tax", "mewing", "cooked",
    "bussin", "sigma", "rizz", "NPC", "delulu", "it's giving", "slay", "L bozo", "touch grass", "+1000 aura", "mogged", "fr fr", "GG"];
  const HURT_WORDS = ["L", "cooked", "-aura", "not the vibe", "ratio'd", "😭"];
  const LEVEL_LINES = ["Sheesh!", "Polls are up!", "Let's go!", "Aura up!", "W!"];
  const COMBO_LINES = ["Combo!", "On fire!", "Unstoppable!", "Aura overload!", "Sheesh, combo!"];

  // =====================================================================
  //  CANVAS, SCALING, SPRITES
  // =====================================================================
  const canvas = $("game");
  const ctx = canvas.getContext("2d");
  const spriteCache = new Map();
  let SW = 0, SH = 0, DPR = 1, SCALE = 1, W = 0, H = 0; // W/H = visible view size in world units
  // The world is a big map; the camera (top-left corner of the view) follows the player.
  const cam = { x: 0, y: 0 };
  const WORLD = { w: 2600, h: 2600 };
  const inView = (o, m = 0) => o.x > cam.x - m && o.x < cam.x + W + m && o.y > cam.y - m && o.y < cam.y + H + m;
  function updateCamera(dt, snap) {
    if (!G) return;
    const tx = clamp(G.p.x - W / 2, 0, Math.max(0, WORLD.w - W));
    const ty = clamp(G.p.y - H / 2, 0, Math.max(0, WORLD.h - H));
    const k = snap ? 1 : Math.min(1, 0.14 * dt);
    cam.x += (tx - cam.x) * k;
    cam.y += (ty - cam.y) * k;
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    SW = window.innerWidth;
    SH = window.innerHeight;
    // Small screens see a zoomed-out arena so phones aren't cramped
    SCALE = Math.min(1, Math.min(SW, SH) / 540);
    W = SW / SCALE;
    H = SH / SCALE;
    canvas.width = Math.round(SW * DPR);
    canvas.height = Math.round(SH * DPR);
    canvas.style.width = SW + "px";
    canvas.style.height = SH + "px";
    spriteCache.clear();
    if (G) updateCamera(1, true);
  }
  // screen pixels -> world coordinates (used for mouse aiming)
  IN.toLogical = (x, y) => ({ x: x / SCALE + cam.x, y: y / SCALE + cam.y });

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
  function drawSprite(emoji, x, y, size, rot = 0, alpha = 1, flip = false) {
    const c = sprite(emoji, Math.round(size)), s = c.logical;
    if (alpha !== 1) ctx.globalAlpha = alpha;
    if (rot || flip) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); if (flip) ctx.scale(-1, 1);
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

  // ---------- character look + map decoration ----------
  const SKINS = ["#f5d0b5", "#e8b896", "#d29a72", "#b97a50", "#8d5a3b", "#5e3b26"];
  const HAIRS = ["#1f1f1f", "#3b2414", "#7a4a1f", "#c9a227", "#d4d4d4", "#a83232", "#2b2b6b"];
  function lookFor(ch) {
    const h = ch.code.charCodeAt(0) * 31 + ch.code.charCodeAt(1) * 7;
    return {
      skin: SKINS[h % SKINS.length],
      hair: HAIRS[(h >> 2) % HAIRS.length],
      hairStyle: (h >> 4) % 3,          // 0 short, 1 spiky, 2 bald-with-sides
      shades: ch.type === "speedy" || ch.type === "glass",
      big: ch.type === "tank",
    };
  }
  const ROAD_GAP = 650;
  function makeProps() {
    const props = [];
    const kinds = [
      ["🌳", 46, 6], ["🌲", 44, 4], ["🌴", 44, 2], ["🌷", 22, 4], ["🌻", 24, 3], ["🪨", 30, 3],
      ["🏢", 78, 2], ["🏠", 60, 2], ["🏛️", 84, 1], ["⛲", 56, 1], ["🗳️", 34, 2], ["🚧", 32, 2], ["🎪", 70, 1],
    ];
    const bag = [];
    for (const [e, s, w] of kinds) for (let i = 0; i < w; i++) bag.push([e, s]);
    const n = Math.round((WORLD.w * WORLD.h) / 70000);
    for (let i = 0; i < n; i++) {
      const [emoji, size] = pick(bag);
      const x = rand(40, WORLD.w - 40), y = rand(40, WORLD.h - 40);
      const nearRoad = Math.abs(((x + ROAD_GAP / 2) % ROAD_GAP) - ROAD_GAP / 2) < 60 || Math.abs(((y + ROAD_GAP / 2) % ROAD_GAP) - ROAD_GAP / 2) < 60;
      const nearStart = Math.hypot(x - WORLD.w / 2, y - WORLD.h / 2) < 160;
      if (nearRoad || nearStart) continue;
      props.push({ x, y, emoji, size });
    }
    return props.sort((a, b) => a.y - b.y);
  }

  function voiceOf(ch, text, force) {
    SND.speak(text, { lang: ch.lang, pitch: ch.pitch, rate: ch.rate, force });
  }

  function newGame(ch) {
    const D = DIFFICULTY[settings.difficulty] || DIFFICULTY.normal;
    const L = id => META.level(id);
    WORLD.w = Math.round(Math.max(2400, W * 2.4));
    WORLD.h = Math.round(Math.max(2400, H * 2.4));
    const maxHp = (ch.hp + L("hp") * 10) * D.playerHp;
    G = {
      ch, D, diff: settings.difficulty, runId: Date.now(),
      p: {
        x: WORLD.w / 2, y: WORLD.h / 2, r: 18, vx: 0, vy: 0, face: 1, walkT: 0, rollT: 0, rollCd: 0, rollDir: { x: 1, y: 0 },
        hp: maxHp, maxHp, speed: ch.speed * (1 + L("speed") * 0.04), dmg: ch.dmg * (1 + L("dmg") * 0.06), fireRate: ch.fireRate,
        fireT: 0, projCount: 1, pierce: 0, magnet: 90 * (1 + L("magnet") * 0.15), orbs: 0, orbAngle: 0, regen: 0, crit: 0,
        iframes: 0, specialT: 120, cdMult: 1 - L("cd") * 0.06, dashT: 0, dashDir: { x: 1, y: 0 }, dashHits: null, dashDmg: 0,
        lifesteal: 0, mvx: 0, mvy: 0, aim: 0,
        weapons: { boomerang: 0, mic: 0, chain: 0, bus: 0 },
        wT: { boomerang: 60, mic: 90, chain: 40, bus: 120 },
      },
      luck: 1 + L("luck") * 0.2,
      revives: L("revive"),
      rerolls: 1 + L("reroll"),
      upgrades: {},
      enemies: [], bullets: [], eBullets: [], gems: [], powerups: [],
      texts: [], particles: [], rings: [], strikes: [], bolts: [], buses: [], decoy: null,
      fx: { shield: 0, hype: 0, double: 0, charm: 0, slow: 0 },
      votes: 0, xp: 0, level: 1, xpNext: 8, kills: 0, pendingLevels: L("start"),
      combo: 0, comboT: 0, bestCombo: 0,
      wave: 0, toSpawn: 0, spawnT: 0, waveDelay: 0, boss: null, bossTimer: 0, bossSpawned: false, event: null,
      endless: false, shake: 0, flash: 0, powerT: 600, time: 0, lowHpWarned: false,
      run: {
        code: ch.code, region: ch.region, diff: settings.difficulty, scoreMult: D.score,
        kills: 0, elites: 0, powerups: 0, specials: 0, revives: 0, votes: 0, wave: 0, frames: 0, level: 1,
        bestCombo: 0, weapons: 0, bosses: {}, won: false, committed: null,
      },
    };
    G.look = lookFor(ch);
    G.pet = { x: G.p.x - 40, y: G.p.y + 10 };
    G.props = makeProps();
    updateCamera(1, true);
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
    G.run.wave = G.wave;
    const B = bossFor(G.wave);
    G.event = null;
    if (G.wave >= 2 && !B && Math.random() < 0.45) G.event = pick(Object.keys(EVENTS));
    const evMul = G.event === "turnout" ? 0.7 : G.event === "rally" ? 1.5 : 1;
    G.toSpawn = Math.round((10 + G.wave * 7) * G.D.spawn * evMul);
    G.spawnT = 90;
    G.bossTimer = B ? 90 : 0;
    G.bossSpawned = false;
    const ev = G.event && EVENTS[G.event];
    showBanner(`WAVE ${G.wave}`, waveName(G.wave) + (B ? " · BOSS FIGHT" : "") + (ev ? ` · ${ev.emoji} ${ev.name}` : ""));
    if (ev) setTimeout(() => { if (G && G.event && state === "playing") toast(`${ev.emoji} ${ev.name}: ${ev.desc}`); }, 1400);
    SND.music.setIntense(!!B);
  }

  function edgePoint(m = 40) {
    const side = Math.floor(Math.random() * 4);
    // just outside the visible view, so haters walk in from every side of the player
    if (side === 0) return { x: rand(cam.x, cam.x + W), y: cam.y - m };
    if (side === 1) return { x: cam.x + W + m, y: rand(cam.y, cam.y + H) };
    if (side === 2) return { x: rand(cam.x, cam.x + W), y: cam.y + H + m };
    return { x: cam.x - m, y: rand(cam.y, cam.y + H) };
  }

  function enemyPool() {
    const w = G.wave;
    const pool = ["fact", "fact", "pap", "intern"];
    if (w >= 2) pool.push("pap", "bot", "protester");
    if (w >= 3) pool.push("bot", "scandal", "reporter");
    if (w >= 4) pool.push("influencer", "influencer");
    if (w >= 5) pool.push("reporter", "intern", "pollster");
    if (w >= 6) pool.push("hacker", "hacker", "protester");
    if (w >= 7) pool.push("scandal", "bot", "reporter", "influencer", "pollster");
    return pool;
  }

  function eliteChance() {
    let c = 0.04 + G.wave * 0.006;
    if (G.event === "turnout") c *= 3;
    return Math.min(0.3, c);
  }

  function spawnEnemy(type, at, opts = {}) {
    const T = ENEMIES[type];
    const pos = at || edgePoint();
    const scale = (1 + (G.wave - 1) * 0.14) * G.D.enemyHp;
    const e = {
      ...T, type, x: pos.x, y: pos.y,
      hp: T.hp * scale, maxHp: T.hp * scale,
      dmg: T.dmg * G.D.enemyDmg * (1 + (G.wave - 1) * 0.04),
      speed: T.speed * (1 + Math.min(G.wave - 1, 15) * 0.03),
      hit: 0, shootT: rand(90, 200), orbCd: 0, wobble: Math.random() * 6,
      mode: "walk", modeT: rand(100, 200), cdir: null, healT: rand(120, 200), tpT: rand(160, 260),
    };
    if (!opts.noElite && type !== "mini" && Math.random() < eliteChance()) {
      e.elite = true;
      e.hp *= 3.5; e.maxHp *= 3.5;
      e.size = Math.round(e.size * 1.3); e.r *= 1.25;
      e.dmg *= 1.3; e.xp *= 4;
    }
    G.enemies.push(e);
    return e;
  }

  function spawnMob() {
    const c = edgePoint(60);
    for (let i = 0; i < 6; i++) spawnEnemy("protester", { x: c.x + rand(-45, 45), y: c.y + rand(-45, 45) }, { noElite: i > 0 });
  }

  function spawnBoss() {
    const B = bossFor(G.wave);
    if (!B) return;
    const hp = B.hp * (1 + Math.min(W, H) / 1400) * G.D.enemyHp;
    const boss = {
      ...B, bossId: B.id, type: "boss", boss: true, x: cam.x + W / 2, y: cam.y - 60, hp, maxHp: hp, dmg: B.dmg * G.D.enemyDmg,
      hit: 0, shootT: 120, summonT: 300, spiral: 0, orbCd: 0, wobble: 0, tpT: 240, burstT: 150, enraged: false,
    };
    G.enemies.push(boss);
    G.boss = boss;
    G.bossSpawned = true;
    $("boss-name").textContent = B.name;
    $("boss-bar").classList.remove("hidden");
    shake(20);
    SND.sfx("boss");
    SND.speak(B.voice, { lang: "en-US", pitch: 0.4, rate: 0.85, force: true });
    floatText(cam.x + W / 2, cam.y + H / 2 - 80, "BOSS INCOMING 😱", "#f87171", 30, 120);
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
    bannerTimer = setTimeout(() => b.classList.add("hidden"), 2200);
  }

  // Toasts are queued so several (e.g. achievements) can show one after another
  const toastQueue = [];
  let toastBusy = false;
  function toast(msg, cls = "") {
    toastQueue.push({ msg, cls });
    if (!toastBusy) nextToast();
  }
  function nextToast() {
    const t = $("toast");
    const item = toastQueue.shift();
    if (!item) { toastBusy = false; t.classList.add("hidden"); return; }
    toastBusy = true;
    t.textContent = item.msg;
    t.className = "toast " + item.cls;
    setTimeout(nextToast, 2600);
  }

  // =====================================================================
  //  COMBAT
  // =====================================================================
  const comboMult = () => 1 + Math.min(2, Math.floor(G.combo / 10) * 0.1);
  const voteMult = () => (G.fx.double > 0 ? 2 : 1) * G.D.score * comboMult() *
    (G.event === "golden" ? 2 : G.event === "rally" ? 1.5 : 1);

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
    if (e.boss && !e.enraged && e.hp > 0 && e.hp < e.maxHp * 0.5) enrage(e);
    if (e.hp <= 0) killEnemy(e);
  }

  function enrage(e) {
    e.enraged = true;
    e.speed *= 1.3;
    shake(16);
    SND.sfx("boss");
    floatText(e.x, e.y - e.r - 20, "PHASE 2 😡", "#f87171", 28, 100);
    SND.speak("Phase two. Now I'm angry.", { lang: "en-US", pitch: 0.4, rate: 0.9, force: true });
    if (e.bossId === "algorithm" || e.bossId === "lizard") {
      for (let i = 0; i < 3; i++) {
        const m = spawnEnemy("bot", { x: e.x + rand(-60, 60), y: e.y + rand(-60, 60) }, { noElite: true });
        m.elite = true; m.hp *= 3; m.maxHp *= 3; m.size = 46; m.r = 22; m.xp *= 4;
      }
    }
  }

  function killEnemy(e) {
    e.dead = true;
    G.kills++;
    G.run.kills++;
    SND.sfx("kill");
    burst(e.x, e.y, e.boss ? "#facc15" : e.elite ? "#fde047" : "#a78bfa", e.boss ? 60 : e.elite ? 24 : 10, e.boss ? 9 : 4);

    // combo
    G.combo++;
    G.comboT = 150;
    if (G.combo > G.bestCombo) { G.bestCombo = G.combo; G.run.bestCombo = G.combo; }
    if (G.combo % 25 === 0) {
      SND.sfx("combo");
      floatText(G.p.x, G.p.y - 60, `${G.combo} COMBO! x${comboMult().toFixed(1)} 🔥`, "#fb923c", 26, 80);
      if (G.combo % 50 === 0) voiceOf(G.ch, pick(COMBO_LINES), false);
    }

    const n = Math.min(Math.ceil(e.xp), 14), per = e.xp / n;
    for (let i = 0; i < n; i++) {
      const spread = n > 1 ? 16 : 0;
      G.gems.push({ x: e.x + rand(-spread, spread), y: e.y + rand(-spread, spread), v: per, big: !!(e.boss || e.elite) });
    }
    if (G.p.lifesteal) G.p.hp = Math.min(G.p.maxHp, G.p.hp + G.p.lifesteal);
    if (Math.random() < 0.28) floatText(e.x, e.y - 10, pick(KILL_WORDS), pick(["#4ade80", "#f472b6", "#38bdf8", "#facc15"]), 18, 55);

    const dropMul = G.luck * (G.event === "news" ? 3 : 1);
    if (e.boss) {
      if (e === G.boss) { G.boss = null; $("boss-bar").classList.add("hidden"); }
      G.run.bosses[e.bossId] = (G.run.bosses[e.bossId] || 0) + 1;
      shake(30);
      flash(1);
      SND.sfx("explode");
      SND.music.setIntense(false);
      floatText(e.x, e.y - 40, `${e.name} GOT RATIO'D 💀`, "#facc15", 28, 140);
      voiceOf(G.ch, "Ratio! " + G.ch.phrase, true);
      for (let i = 0; i < 3; i++) spawnPowerup(e.x - 40 + i * 40, e.y);
    } else if (e.elite) {
      G.run.elites++;
      floatText(e.x, e.y - 24, "ELITE DOWN ✨", "#fde047", 18, 60);
      if (Math.random() < 0.35 * dropMul) spawnPowerup(e.x, e.y);
    } else if (Math.random() < 0.035 * dropMul) {
      spawnPowerup(e.x, e.y);
    }
    if (e.splits) for (let i = 0; i < 2; i++) spawnEnemy("mini", { x: e.x + rand(-15, 15), y: e.y + rand(-15, 15) });
  }

  function damagePlayer(d) {
    const p = G.p;
    if (p.iframes > 0 || G.fx.shield > 0 || p.dashT > 0 || p.rollT > 0 || state !== "playing") return;
    p.hp -= d;
    p.iframes = 45;
    shake(10);
    vibrate(60);
    SND.sfx("hurt");
    floatText(p.x, p.y - 30, pick(HURT_WORDS), "#f87171", 20, 50);
    burst(p.x, p.y, "#ef4444", 12, 5);
    if (G.combo >= 10) floatText(p.x, p.y - 55, "COMBO LOST", "#94a3b8", 16, 50);
    G.combo = 0;
    if (!G.lowHpWarned && p.hp > 0 && p.hp < p.maxHp * 0.25) {
      G.lowHpWarned = true;
      voiceOf(G.ch, "I'm cooked! Somebody help!", true);
    }
    if (p.hp <= 0) {
      if (G.revives > 0) return revive();
      p.hp = 0;
      endGame(false);
    }
  }

  function revive() {
    const p = G.p;
    G.revives--;
    G.run.revives++;
    p.hp = p.maxHp * 0.5;
    p.iframes = 150;
    G.fx.shield = 120;
    flash(1);
    shake(25);
    SND.sfx("level");
    ring(p.x, p.y, 320, "#4ade80", 40);
    for (const e of G.enemies) {
      const d = Math.sqrt(dist2(e, p)) || 1;
      if (d < 320 && !e.boss) { e.x += (e.x - p.x) / d * 180; e.y += (e.y - p.y) / d * 180; }
    }
    G.eBullets = [];
    floatText(p.x, p.y - 60, "SECOND TERM! ❤️‍🩹", "#4ade80", 30, 120);
    voiceOf(G.ch, "Second term, baby! I'm back!", true);
  }

  function nearestEnemy(x, y, maxD = Infinity, exclude) {
    let bestE = null, bd = maxD * maxD;
    for (const e of G.enemies) {
      if (e.dead || (exclude && exclude.has(e))) continue;
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
    // only auto-aim at haters you can (almost) see, so shots aren't wasted off-screen
    return t && inView(t, 80) ? { angle: Math.atan2(t.y - p.y, t.x - p.x), manual: false } : null;
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
  //  BONUS WEAPONS
  // =====================================================================
  function updateWeapons(dt) {
    const p = G.p, W8 = p.weapons;
    for (const k in p.wT) if (W8[k]) p.wT[k] -= dt;

    if (W8.boomerang && p.wT.boomerang <= 0) {
      const lvl = W8.boomerang;
      p.wT.boomerang = Math.max(50, 100 - lvl * 8);
      const base = aimAngle() ? aimAngle().angle : Math.random() * Math.PI * 2;
      for (let i = 0; i < lvl; i++) {
        const a = base + (i - (lvl - 1) / 2) * 0.5;
        G.bullets.push({
          x: p.x, y: p.y, vx: Math.cos(a) * 9, vy: Math.sin(a) * 9, boomer: true, t: 0, out: 34, returning: false,
          dmg: p.dmg * 1.6 * (1 + 0.2 * (lvl - 1)), pierce: Infinity, life: 240, hits: new Set(), emoji: "🪃", size: 28,
        });
      }
    }
    if (W8.mic && p.wT.mic <= 0) {
      const lvl = W8.mic;
      p.wT.mic = Math.max(60, 170 - lvl * 18);
      const R = 100 + lvl * 18, dmg = p.dmg * 1.3 * (1 + 0.3 * (lvl - 1));
      ring(p.x, p.y, R, "#f97316", 22);
      SND.sfx("pulse");
      for (const e of G.enemies) if (dist2(e, p) < (R + e.r) ** 2) damageEnemy(e, dmg);
    }
    if (W8.chain && p.wT.chain <= 0) {
      const lvl = W8.chain;
      const first = nearestEnemy(p.x, p.y, 420);
      if (first) {
        p.wT.chain = Math.max(40, 85 - lvl * 8);
        const jumps = 1 + lvl * 2, dmg = p.dmg * 1.4 * (1 + 0.25 * (lvl - 1));
        const hit = new Set();
        const pts = [{ x: p.x, y: p.y }];
        let cur = first;
        for (let i = 0; i < jumps && cur; i++) {
          hit.add(cur);
          pts.push({ x: cur.x, y: cur.y });
          damageEnemy(cur, dmg);
          cur = nearestEnemy(cur.x, cur.y, 170, hit);
        }
        G.bolts.push({ pts, life: 12 });
        SND.sfx("zap");
      } else p.wT.chain = 10;
    }
    if (W8.bus && p.wT.bus <= 0) {
      const lvl = W8.bus;
      p.wT.bus = Math.max(160, 420 - lvl * 45);
      const count = lvl >= 4 ? 3 : lvl >= 2 ? 2 : 1;
      const dmg = p.dmg * 4 * (1 + 0.3 * (lvl - 1));
      for (let i = 0; i < count; i++) {
        const dir = Math.random() < 0.5 ? 1 : -1;
        const y = i === 0 ? p.y : rand(cam.y + 60, cam.y + H - 60);
        G.buses.push({ x: dir > 0 ? cam.x - 90 : cam.x + W + 90, y, dir, dmg, hits: new Set(), warn: 40 });
      }
      SND.sfx("horn");
    }
  }

  // =====================================================================
  //  POWER-UPS & SPECIALS
  // =====================================================================
  function spawnPowerup(x, y) {
    G.powerups.push({
      type: pick(Object.keys(POWERUPS)), life: 900, bob: Math.random() * 6,
      x: clamp(x ?? rand(cam.x + 60, cam.x + W - 60), 30, WORLD.w - 30),
      y: clamp(y ?? rand(cam.y + 110, cam.y + H - 70), 30, WORLD.h - 30),
    });
  }

  function applyPowerup(type) {
    const p = G.p, P = POWERUPS[type];
    G.run.powerups++;
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
        floatText(cam.x + W / 2, cam.y + H / 2, "IT WENT VIRAL 📱🔥", "#38bdf8", 34, 100);
        break;
    }
  }

  const ROLL_CD = 75;
  function useRoll() {
    if (state !== "playing") return;
    const p = G.p;
    if (p.rollCd > 0 || p.rollT > 0 || p.dashT > 0) return;
    let dx = p.mvx, dy = p.mvy;
    if (Math.hypot(dx, dy) < 0.2) { dx = p.face; dy = 0; }
    const l = Math.hypot(dx, dy) || 1;
    p.rollDir = { x: dx / l, y: dy / l };
    p.rollT = 14;
    p.rollCd = ROLL_CD;
    p.vx = p.rollDir.x * p.speed;
    p.vy = p.rollDir.y * p.speed;
    SND.sfx("dash");
    vibrate(15);
  }

  function useSpecial() {
    if (state !== "playing") return;
    const p = G.p;
    if (p.specialT > 0) { SND.sfx("error"); return; }
    p.specialT = G.ch.cd * p.cdMult;
    G.run.specials++;
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
          if (!inView(e, 20)) continue;
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
        const targets = G.enemies.filter(e => inView(e));
        for (let i = 0; i < 20; i++) {
          const t = targets.length ? pick(targets) : null;
          G.strikes.push({ x: t ? t.x + rand(-20, 20) : rand(cam.x + 40, cam.x + W - 40), y: t ? t.y + rand(-20, 20) : rand(cam.y + 80, cam.y + H - 40), t: 12 + i * 5, max: 12 + i * 5, dmg: 38 * power });
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
      G.run.level = G.level;
      G.xpNext = Math.floor(G.xpNext * 1.3 + 4);
      G.pendingLevels++;
    }
    if (G.pendingLevels > 0 && state === "playing") openLevelUp();
  }

  let choices = [];
  function rollChoices() {
    const pool = UPGRADES.filter(u => (G.upgrades[u.id] || 0) < u.max);
    choices = [];
    for (let i = 0; i < 3 && pool.length; i++) choices.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  function renderChoices() {
    const list = $("upgrade-list");
    list.innerHTML = "";
    choices.forEach((u, i) => {
      const b = document.createElement("button");
      const lvl = G.upgrades[u.id] || 0;
      b.className = "card" + (u.weapon ? " weapon" : "");
      const desc = u.weapon && lvl > 0 ? u.lvlDesc : u.desc;
      b.innerHTML = `${u.weapon && lvl === 0 ? '<span class="tagnew">NEW WEAPON</span>' : ""}<div class="emoji">${u.emoji}</div>
        <div class="name">${i + 1}. ${esc(u.name)}</div><div class="desc">${esc(desc)}</div><div class="lvl">Lv ${lvl} → ${lvl + 1} / ${u.max}</div>`;
      b.addEventListener("click", () => chooseUpgrade(i));
      list.appendChild(b);
    });
    const rb = $("reroll-btn");
    rb.textContent = `🎲 Reroll (${G.rerolls} left)`;
    rb.disabled = G.rerolls <= 0;
    rb.classList.toggle("hidden", G.rerolls <= 0);
  }
  function openLevelUp() {
    rollChoices();
    if (!choices.length) { G.p.hp = G.p.maxHp; G.pendingLevels = 0; return; } // everything maxed: free heal
    state = "levelup";
    IN.clearKeys();
    SND.sfx("level");
    voiceOf(G.ch, pick(LEVEL_LINES), false);
    renderChoices();
    showScreen("levelup");
    // small delay so a held button/tap doesn't instantly pick
    const list = $("upgrade-list");
    list.style.pointerEvents = "none";
    setTimeout(() => { list.style.pointerEvents = ""; }, 350);
    if (IN.mode !== "touch") list.firstChild.focus();
  }
  function reroll() {
    if (state !== "levelup" || G.rerolls <= 0) return;
    G.rerolls--;
    SND.sfx("tele");
    rollChoices();
    renderChoices();
    if (IN.mode !== "touch") $("upgrade-list").firstChild.focus();
  }

  function chooseUpgrade(i) {
    if (state !== "levelup" || !choices[i]) return;
    const u = choices[i];
    u.apply(G.p);
    G.upgrades[u.id] = (G.upgrades[u.id] || 0) + 1;
    G.run.weapons = Object.values(G.p.weapons).filter(Boolean).length;
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
    G.run.frames += dt;
    for (const k in G.fx) G.fx[k] = Math.max(0, G.fx[k] - dt);
    p.iframes = Math.max(0, p.iframes - dt);
    p.specialT = Math.max(0, p.specialT - dt);
    G.shake = Math.max(0, G.shake - dt);
    G.flash = Math.max(0, G.flash - 0.04 * dt);
    if (p.regen) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt / 60);
    if (G.combo > 0) { G.comboT -= dt; if (G.comboT <= 0) G.combo = 0; }

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
    } else if (p.rollT > 0) {
      // dodge roll: fast, invincible, fixed direction
      p.rollT -= dt;
      p.x += p.rollDir.x * 10.5 * dt;
      p.y += p.rollDir.y * 10.5 * dt;
      if (Math.random() < 0.6) G.particles.push({ x: p.x + rand(-6, 6), y: p.y + 18, vx: -p.rollDir.x, vy: -0.5, life: 16, color: "#d6d3d1", size: 5 });
    } else {
      // smooth acceleration / deceleration
      const spd = p.speed * (G.fx.hype > 0 ? 1.5 : 1);
      const k = Math.min(1, 0.28 * dt);
      p.vx += (mv.x * spd - p.vx) * k;
      p.vy += (mv.y * spd - p.vy) * k;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    p.rollCd = Math.max(0, p.rollCd - dt);
    const sp = Math.hypot(p.vx, p.vy);
    if (Math.abs(p.vx) > 0.15) p.face = p.vx > 0 ? 1 : -1;
    p.walkT += sp * 0.09 * dt;
    p.x = clamp(p.x, p.r + 10, WORLD.w - p.r - 10);
    p.y = clamp(p.y, p.r + 24, WORLD.h - p.r - 10);
    updateCamera(dt);
    // the mascot pet trails behind the player
    G.pet.x += (p.x - p.face * 34 - G.pet.x) * Math.min(1, 0.08 * dt);
    G.pet.y += (p.y + 8 - G.pet.y) * Math.min(1, 0.08 * dt);

    // ---- shooting & weapons ----
    p.fireT -= dt * (G.fx.hype > 0 ? 2 : 1);
    if (p.fireT <= 0 && firePlayer()) p.fireT = p.fireRate;
    updateWeapons(dt);

    // ---- spawning / wave flow ----
    const B = bossFor(G.wave);
    if (G.toSpawn > 0) {
      G.spawnT -= dt;
      if (G.spawnT <= 0) {
        const group = Math.min(G.toSpawn, 1 + Math.floor(G.wave / 3) + (Math.random() < 0.3 ? 1 : 0));
        const pool = enemyPool();
        for (let i = 0; i < group; i++) {
          const t = pick(pool);
          if (t === "protester") spawnMob(); else spawnEnemy(t);
        }
        G.toSpawn -= group;
        G.spawnT = Math.max(14, 55 - G.wave * 4) * rand(0.7, 1.3) / G.D.spawn;
      }
    } else if (G.enemies.length === 0 && (!B || G.bossSpawned)) {
      G.waveDelay += dt;
      if (G.waveDelay > 90) { G.waveDelay = 0; nextWave(); if (state !== "playing") return; }
    }
    if (G.bossTimer > 0) { G.bossTimer -= dt; if (G.bossTimer <= 0) spawnBoss(); }

    G.powerT -= dt * (G.event === "news" ? 3 : 1) * G.luck;
    if (G.powerT <= 0) { spawnPowerup(); G.powerT = rand(600, 900); }

    // ---- enemies ----
    const charmed = G.fx.charm > 0;
    const slow = (G.fx.slow > 0 ? 0.25 : 1) * (G.event === "debate" ? 1.3 : 1);
    const target = G.decoy || p;
    for (const e of G.enemies) {
      if (e.dead) continue;
      e.hit = Math.max(0, e.hit - dt);
      e.wobble += 0.1 * dt;
      const dx = target.x - e.x, dy = target.y - e.y, d = Math.hypot(dx, dy) || 1;
      if (!charmed) {
        let sp = e.speed * slow;
        const inArena = inView(e, -40);
        // haters left far behind re-enter near the player so the pressure never drops
        if (!e.boss && (e.x - p.x) ** 2 + (e.y - p.y) ** 2 > (Math.max(W, H) * 1.25) ** 2) {
          const np = edgePoint();
          e.x = np.x; e.y = np.y;
        }
        if (e.shooter && d < 260 && inArena && !G.decoy) sp = -sp * 0.5;

        if (e.charger && inArena) {
          e.modeT -= dt;
          if (e.mode === "walk" && e.modeT <= 0) { e.mode = "wind"; e.modeT = 38; }
          else if (e.mode === "wind") {
            sp = 0;
            if (e.modeT <= 0) { e.mode = "charge"; e.modeT = 30; e.cdir = { x: dx / d, y: dy / d }; }
          } else if (e.mode === "charge") {
            e.x += e.cdir.x * 7.5 * slow * dt; e.y += e.cdir.y * 7.5 * slow * dt; sp = 0;
            if (e.modeT <= 0) { e.mode = "walk"; e.modeT = rand(110, 190); }
          }
        }
        if (e.teleporter && inArena) {
          e.tpT -= dt * slow;
          if (e.tpT <= 0) {
            burst(e.x, e.y, "#22d3ee", 10, 4);
            const a = Math.random() * Math.PI * 2, r = rand(110, 170);
            e.x = clamp(p.x + Math.cos(a) * r, 20, WORLD.w - 20);
            e.y = clamp(p.y + Math.sin(a) * r, 20, WORLD.h - 20);
            burst(e.x, e.y, "#22d3ee", 10, 4);
            SND.sfx("tele");
            e.tpT = rand(180, 260);
          }
        }
        if (e.healer) {
          e.healT -= dt * slow;
          if (e.healT <= 0) {
            e.healT = 170;
            let healed = 0;
            for (const o of G.enemies) {
              if (o === e || o.boss || o.dead || o.hp >= o.maxHp) continue;
              if (dist2(o, e) < 150 * 150) { o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.3); healed++; }
            }
            if (healed) { ring(e.x, e.y, 150, "#4ade80", 25); floatText(e.x, e.y - 24, "+HEAL", "#4ade80", 14, 40); }
          }
        }
        if (e.boss && e.bossId === "algorithm") {
          e.tpT -= dt * slow;
          if (e.tpT <= 0) {
            burst(e.x, e.y, "#f472b6", 30, 6);
            e.x = rand(cam.x + 120, cam.x + W - 120);
            e.y = rand(cam.y + 120, cam.y + H - 120);
            if (dist2(e, p) < 200 * 200) { e.x = 2 * cam.x + W - e.x; e.y = 2 * cam.y + H - e.y; }
            burst(e.x, e.y, "#f472b6", 30, 6);
            SND.sfx("tele");
            e.tpT = e.enraged ? 160 : 240;
          }
        }
        e.x += (dx / d) * sp * dt;
        e.y += (dy / d) * sp * dt;
      }
      const pd2 = dist2(e, p);
      if (!charmed && pd2 < (e.r + p.r) ** 2) damagePlayer(e.dmg);
      if (state !== "playing") return;

      const onScreen = inView(e);
      if (!charmed && onScreen && (e.shooter || e.boss)) {
        e.shootT -= dt * Math.min(1, slow);
        if (e.shootT <= 0) bossOrShooterFire(e);
      }
      if (e.boss && !charmed) {
        e.summonT -= dt * Math.min(1, slow);
        if (e.summonT <= 0) {
          for (let i = 0; i < 4; i++) spawnEnemy(pick(["intern", "pap", "fact", "hacker"]), { x: e.x + rand(-50, 50), y: e.y + rand(-50, 50) }, { noElite: true });
          e.summonT = e.enraged ? 260 : 360;
          floatText(e.x, e.y - e.r - 10, pick(["*throws money*", "summoning NPCs", "get 'em!", "fake news!"]), "#4ade80", 16, 60);
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

    // ---- buses ----
    for (const bus of G.buses) {
      if (bus.warn > 0) { bus.warn -= dt; continue; }
      bus.x += bus.dir * 15 * dt;
      for (const e of G.enemies) {
        if (e.dead || bus.hits.has(e)) continue;
        if (Math.abs(e.y - bus.y) < 34 + e.r && Math.abs(e.x - bus.x) < 46 + e.r) {
          bus.hits.add(e);
          damageEnemy(e, bus.dmg, true);
          if (!e.boss) e.y += (e.y >= bus.y ? 1 : -1) * 40;
        }
      }
      if ((bus.dir > 0 && bus.x > cam.x + W + 120) || (bus.dir < 0 && bus.x < cam.x - 120)) bus.done = true;
    }
    G.buses = G.buses.filter(b => !b.done);

    // ---- player bullets ----
    for (const b of G.bullets) {
      if (b.boomer) {
        b.t += dt;
        if (b.t < b.out) { b.vx *= Math.pow(0.97, dt); b.vy *= Math.pow(0.97, dt); }
        else {
          if (!b.returning) { b.returning = true; b.hits.clear(); }
          const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy) || 1;
          b.vx = (dx / d) * 10; b.vy = (dy / d) * 10;
          if (d < 22) b.life = 0;
        }
      } else if (b.homing) {
        const t = nearestEnemy(b.x, b.y, 500);
        if (t) {
          const a = Math.atan2(t.y - b.y, t.x - b.x);
          b.vx += Math.cos(a) * 0.6 * dt; b.vy += Math.sin(a) * 0.6 * dt;
          const s = Math.hypot(b.vx, b.vy);
          if (s > 8) { b.vx = (b.vx / s) * 8; b.vy = (b.vy / s) * 8; }
        }
      }
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (!b.boomer && !inView(b, 160)) b.life = 0;
      for (const e of G.enemies) {
        if (b.life <= 0) break;
        if (e.dead || b.hits.has(e)) continue;
        if ((e.x - b.x) ** 2 + (e.y - b.y) ** 2 < (e.r + 9) ** 2) {
          b.hits.add(e);
          damageEnemy(e, b.dmg);
          if (b.pierce-- <= 0) b.life = 0;
        }
      }
    }
    G.bullets = G.bullets.filter(b => b.life > 0);

    // ---- enemy bullets ----
    for (const b of G.eBullets) {
      if (!charmed) { b.x += b.vx * dt * Math.min(1, slow); b.y += b.vy * dt * Math.min(1, slow); }
      b.life -= dt;
      if (!inView(b, 80)) b.life = 0;
      if (b.life > 0 && dist2(b, p) < (p.r + 8) ** 2) {
        if (G.fx.shield <= 0 && p.dashT <= 0 && p.rollT <= 0 && p.iframes <= 0) b.life = 0;
        damagePlayer(b.dmg);
        if (state !== "playing") return;
      }
    }
    G.eBullets = G.eBullets.filter(b => b.life > 0);
    if (G.eBullets.length > 400) G.eBullets.splice(0, G.eBullets.length - 400);
    G.enemies = G.enemies.filter(e => !e.dead);

    // ---- votes ----
    const mag2 = p.magnet * p.magnet;
    for (const g of G.gems) {
      const d2 = dist2(g, p);
      g.age = (g.age || 0) + dt;
      if (g.age > 300) g.pulled = true; // uncollected votes find their way to you after ~5s
      if (g.pulled || d2 < mag2) {
        g.pulled = true;
        const d = Math.sqrt(d2) || 1, sp = 9 * dt;
        g.x += ((p.x - g.x) / d) * Math.min(sp, d);
        g.y += ((p.y - g.y) / d) * Math.min(sp, d);
      }
      if (dist2(g, p) < (p.r + 6) ** 2) {
        g.taken = true;
        const v = Math.round(g.v * 10 * voteMult());
        G.votes += v;
        G.run.votes = G.votes;
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
    for (const bo of G.bolts) bo.life -= dt;
    G.bolts = G.bolts.filter(bo => bo.life > 0);
  }

  function bossOrShooterFire(e) {
    const p = G.p;
    const pdx = p.x - e.x, pdy = p.y - e.y, pd = Math.hypot(pdx, pdy) || 1;
    const dmg = 12 * G.D.enemyDmg;
    const shoot = (a, s = 3) => G.eBullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 320, dmg, emoji: e.bullet });
    if (!e.boss) {
      G.eBullets.push({ x: e.x, y: e.y, vx: (pdx / pd) * 3.6, vy: (pdy / pd) * 3.6, life: 240, dmg: 7 * G.D.enemyDmg, emoji: "❓" });
      e.shootT = rand(140, 220);
      return;
    }
    const k = e.enraged ? 0.65 : 1;
    const aim = Math.atan2(pdy, pdx);
    switch (e.pattern) {
      case "ring": {
        const n = e.enraged ? 16 : 12;
        for (let i = 0; i < n; i++) shoot((i / n) * Math.PI * 2 + e.spiral);
        e.spiral += 0.2;
        e.shootT = 100 * k;
        break;
      }
      case "spiral": {
        const n = 18, off = (e.spiral += 0.35);
        for (let i = 0; i < n; i++) shoot((i / n) * Math.PI * 2 + off);
        e.shootT = 70 * k;
        break;
      }
      case "streams": {
        const arms = e.enraged ? 4 : 3;
        for (let i = 0; i < arms; i++) shoot(e.spiral + (i / arms) * Math.PI * 2, 3.2);
        e.spiral += 0.09;
        e.shootT = 7;
        e.burstT -= 7;
        if (e.burstT <= 0) {
          for (let i = -2; i <= 2; i++) shoot(aim + i * 0.12, 4.5);
          e.burstT = 150 * k;
        }
        break;
      }
      case "fan": {
        const n = e.enraged ? 9 : 7;
        for (let i = 0; i < n; i++) shoot(aim + (i - (n - 1) / 2) * 0.15, 4);
        e.shootT = 80 * k;
        break;
      }
    }
  }

  // =====================================================================
  //  DRAW
  // =====================================================================
  // ---------- world ground (drawn in world coordinates, only the visible part) ----------
  function drawWorld() {
    const x0 = cam.x, y0 = cam.y, x1 = cam.x + W, y1 = cam.y + H;
    // outside the map
    ctx.fillStyle = "#0b0b1a";
    ctx.fillRect(x0 - 60, y0 - 60, W + 120, H + 120);
    // grass with a soft checker pattern
    const gx0 = Math.max(0, x0), gy0 = Math.max(0, y0), gx1 = Math.min(WORLD.w, x1), gy1 = Math.min(WORLD.h, y1);
    ctx.fillStyle = "#1e3a2b";
    ctx.fillRect(gx0, gy0, gx1 - gx0, gy1 - gy0);
    const T = 80;
    ctx.fillStyle = "#21402f";
    for (let tx = Math.floor(gx0 / T) * T; tx < gx1; tx += T) {
      for (let ty = Math.floor(gy0 / T) * T; ty < gy1; ty += T) {
        if (((tx + ty) / T) % 2 === 0) ctx.fillRect(tx, ty, Math.min(T, gx1 - tx), Math.min(T, gy1 - ty));
      }
    }
    // roads
    ctx.fillStyle = "#2f3340";
    for (let rx = ROAD_GAP; rx < WORLD.w; rx += ROAD_GAP) if (rx + 40 > x0 && rx - 40 < x1) ctx.fillRect(rx - 34, gy0, 68, gy1 - gy0);
    for (let ry = ROAD_GAP; ry < WORLD.h; ry += ROAD_GAP) if (ry + 40 > y0 && ry - 40 < y1) ctx.fillRect(gx0, ry - 34, gx1 - gx0, 68);
    ctx.strokeStyle = "rgba(250,204,21,0.55)";
    ctx.lineWidth = 3;
    ctx.setLineDash([22, 18]);
    ctx.beginPath();
    for (let rx = ROAD_GAP; rx < WORLD.w; rx += ROAD_GAP) if (rx > x0 - 10 && rx < x1 + 10) { ctx.moveTo(rx, gy0); ctx.lineTo(rx, gy1); }
    for (let ry = ROAD_GAP; ry < WORLD.h; ry += ROAD_GAP) if (ry > y0 - 10 && ry < y1 + 10) { ctx.moveTo(gx0, ry); ctx.lineTo(gx1, ry); }
    ctx.stroke();
    ctx.setLineDash([]);
    // map border
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 8;
    ctx.setLineDash([30, 20]);
    ctx.strokeRect(0, 0, WORLD.w, WORLD.h);
    ctx.setLineDash([]);
    // props
    for (const pr of G.props) {
      if (pr.x < x0 - 60 || pr.x > x1 + 60 || pr.y < y0 - 60 || pr.y > y1 + 60) continue;
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath(); ctx.ellipse(pr.x, pr.y + pr.size * 0.42, pr.size * 0.38, pr.size * 0.12, 0, 0, Math.PI * 2); ctx.fill();
      drawSprite(pr.emoji, pr.x, pr.y, pr.size);
    }
  }

  // ---------- the playable character ----------
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function drawCharacter(ch, look, x, y, o = {}) {
    const face = o.face || 1, walk = o.walk || 0, moving = o.moving || 0, alpha = o.alpha ?? 1;
    const s = (look.big ? 1.12 : 1) * 1.3;
    const swing = Math.sin(walk) * 0.7 * moving;
    const bob = Math.abs(Math.sin(walk)) * 2.5 * moving;
    ctx.save();
    ctx.globalAlpha = alpha;
    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath(); ctx.ellipse(x, y + 25 * s, 15 * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.translate(x, y - bob);
    if (o.roll) ctx.rotate(o.roll * face);
    ctx.scale(face * s, s);

    // legs
    ctx.strokeStyle = "#1f2937"; ctx.lineWidth = 6; ctx.lineCap = "round";
    for (const dir of [1, -1]) {
      const a = swing * dir;
      ctx.beginPath(); ctx.moveTo(dir * 4, 10); ctx.lineTo(dir * 4 + Math.sin(a) * 11, 10 + Math.cos(a) * 12); ctx.stroke();
    }
    // shoes
    ctx.fillStyle = "#111827";
    for (const dir of [1, -1]) {
      const a = swing * dir;
      ctx.beginPath(); ctx.ellipse(dir * 4 + Math.sin(a) * 11 + 2, 22 + Math.cos(a) * 0.5, 4.5, 2.6, 0, 0, Math.PI * 2); ctx.fill();
    }
    // back arm
    ctx.strokeStyle = look.skin; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-6, -4); ctx.lineTo(-9 - Math.sin(swing) * 6, 8); ctx.stroke();

    // torso: suit made from the country's flag
    roundRect(-11, -10, 22, 22, 6);
    const im = flagImg(ch.code);
    if (im.complete && im.naturalWidth) {
      ctx.save(); ctx.clip();
      ctx.drawImage(im, -16, -10, 32, 22);
      ctx.restore();
    } else { ctx.fillStyle = ch.color; ctx.fill(); }
    ctx.strokeStyle = "rgba(0,0,0,0.55)"; ctx.lineWidth = 2;
    roundRect(-11, -10, 22, 22, 6); ctx.stroke();
    // shirt collar + tie
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.moveTo(-4, -10); ctx.lineTo(0, -5); ctx.lineTo(4, -10); ctx.fill();
    ctx.fillStyle = "#dc2626";
    ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(-2, 0); ctx.lineTo(0, 4); ctx.lineTo(2, 0); ctx.closePath(); ctx.fill();

    // head
    ctx.fillStyle = look.skin;
    ctx.beginPath(); ctx.arc(0, -19, 10, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 1.5; ctx.stroke();
    // hair
    ctx.fillStyle = look.hair;
    if (look.hairStyle === 0) { ctx.beginPath(); ctx.arc(0, -21, 10, Math.PI * 1.05, Math.PI * 1.95); ctx.fill(); ctx.fillRect(-10, -23, 5, 5); }
    else if (look.hairStyle === 1) { ctx.beginPath(); for (let i = -2; i <= 2; i++) { ctx.moveTo(i * 4 - 3, -26); ctx.lineTo(i * 4, -33); ctx.lineTo(i * 4 + 3, -26); } ctx.fill(); ctx.beginPath(); ctx.arc(0, -21, 10, Math.PI, Math.PI * 2); ctx.fill(); }
    else { ctx.fillRect(-10, -22, 3, 7); ctx.fillRect(7, -22, 3, 7); }
    // face (looks the way the character faces)
    if (look.shades) {
      ctx.fillStyle = "#111";
      roundRect(-1, -22, 6, 4, 1.5); ctx.fill(); roundRect(6, -22, 4, 4, 1.5); ctx.fill();
      ctx.fillRect(-2, -21, 12, 1.2);
    } else {
      ctx.fillStyle = "#111";
      ctx.beginPath(); ctx.arc(2, -20, 1.6, 0, Math.PI * 2); ctx.arc(7, -20, 1.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = "#7f1d1d"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(4, -15, 3, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    ctx.restore();

    // front arm holding a mic, pointing where the character aims (drawn unflipped, in world space)
    if (o.aim !== undefined) {
      const sx = x + face * 6 * s, sy = y - 4 * s - bob;
      const ax = Math.cos(o.aim), ay = Math.sin(o.aim);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = look.skin; ctx.lineWidth = 5; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + ax * 13, sy + ay * 13); ctx.stroke();
      ctx.restore();
      drawSprite("🎤", sx + ax * 17, sy + ay * 17, 14, o.aim + Math.PI / 4, alpha);
    }
  }

  function drawMinimap() {
    const size = Math.min(110, SW * 0.24), pad = 10;
    const mx = SW - size - pad, my = 134;
    const kx = size / WORLD.w, ky = size / WORLD.h;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(mx, my, size, size);
    ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1;
    ctx.strokeRect(mx, my, size, size);
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.strokeRect(mx + cam.x * kx, my + cam.y * ky, W * kx, H * ky);
    ctx.fillStyle = "#ef4444";
    for (let i = 0; i < G.enemies.length; i += 2) { const e = G.enemies[i]; ctx.fillRect(mx + e.x * kx - 1, my + e.y * ky - 1, e.boss ? 5 : 2, e.boss ? 5 : 2); }
    ctx.fillStyle = "#facc15";
    for (const pu of G.powerups) ctx.fillRect(mx + pu.x * kx - 1.5, my + pu.y * ky - 1.5, 3, 3);
    ctx.fillStyle = "#4ade80";
    ctx.beginPath(); ctx.arc(mx + G.p.x * kx, my + G.p.y * ky, 3, 0, Math.PI * 2); ctx.fill();
  }

  // arrow at the screen edge pointing to an off-screen boss
  function drawBossPointer() {
    const b = G.boss;
    if (!b || inView(b, -20)) return;
    const cx = SW / 2, cy = SH / 2;
    const bx = (b.x - cam.x) * SCALE, by = (b.y - cam.y) * SCALE;
    const a = Math.atan2(by - cy, bx - cx);
    const r = Math.min(SW, SH) / 2 - 50;
    const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
    ctx.save();
    ctx.translate(px, py); ctx.rotate(a);
    ctx.fillStyle = "#ef4444";
    ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-8, -10); ctx.lineTo(-8, 10); ctx.closePath(); ctx.fill();
    ctx.restore();
    drawSprite(b.emoji, px - Math.cos(a) * 26, py - Math.sin(a) * 26, 28);
  }

  function drawBackground(t) {
    ctx.fillStyle = "#11112b";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = G && G.event ? "rgba(250,204,21,0.07)" : "rgba(167,139,250,0.08)";
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
    if (!G) { drawBackground(t); ctx.restore(); return; }
    if (G.shake > 0 && state === "playing") ctx.translate(rand(-G.shake, G.shake) * 0.6, rand(-G.shake, G.shake) * 0.6);
    ctx.translate(-Math.round(cam.x), -Math.round(cam.y));
    drawWorld();
    const p = G.p;

    for (const g of G.gems) {
      ctx.fillStyle = g.big ? "#facc15" : "#38bdf8";
      ctx.beginPath(); ctx.arc(g.x, g.y, g.big ? 6.5 : 4.5, 0, Math.PI * 2); ctx.fill();
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

    // bus lanes (warning) + buses
    for (const bus of G.buses) {
      if (bus.warn > 0) {
        ctx.fillStyle = `rgba(249,115,22,${0.12 + 0.12 * Math.sin(G.time * 0.6)})`;
        ctx.fillRect(cam.x, bus.y - 34, W, 68);
        drawSprite("⚠️", bus.dir > 0 ? cam.x + 30 : cam.x + W - 30, bus.y, 26);
      } else drawSprite("🚌", bus.x, bus.y, 64, 0, 1, bus.dir > 0);
    }

    if (G.decoy) {
      const dc = G.decoy;
      drawCharacter(G.ch, G.look, dc.x, dc.y, { face: 1, walk: G.time * 0.3, moving: 1, alpha: 0.55 + Math.sin(G.time * 0.3) * 0.2 });
      drawSprite("🎭", dc.x, dc.y - 34, 20);
      ctx.strokeStyle = "#f472b6"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(dc.x, dc.y, 28, -Math.PI / 2, -Math.PI / 2 + (dc.t / 360) * Math.PI * 2); ctx.stroke();
    }

    const charmed = G.fx.charm > 0, slowed = G.fx.slow > 0;
    for (const e of G.enemies) {
      if (e.elite) {
        ctx.fillStyle = `rgba(250,204,21,${0.22 + 0.1 * Math.sin(G.time * 0.2 + e.wobble)})`;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 8, 0, Math.PI * 2); ctx.fill();
      }
      if (e.boss && e.enraged) {
        ctx.fillStyle = `rgba(239,68,68,${0.2 + 0.1 * Math.sin(G.time * 0.3)})`;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 14, 0, Math.PI * 2); ctx.fill();
      }
      const tpFlicker = e.teleporter && e.tpT < 40 && Math.floor(e.tpT / 4) % 2 === 0;
      const windShake = e.mode === "wind" ? rand(-2, 2) : 0;
      drawSprite(e.emoji, e.x + windShake, e.y, e.size, Math.sin(e.wobble) * 0.12, tpFlicker ? 0.35 : 1);
      if (e.hit > 0) {
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill();
      }
      if (e.mode === "wind") drawSprite("❗", e.x, e.y - e.r - 12, 18);
      else if (e.mode === "charge") { ctx.strokeStyle = "#f87171"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 4, 0, Math.PI * 2); ctx.stroke(); }
      if (charmed) drawSprite("💕", e.x, e.y - e.r - 8, 16);
      else if (slowed) drawSprite("📜", e.x, e.y - e.r - 8, 14);
      if (e.elite) drawSprite("👑", e.x, e.y - e.r - (charmed || slowed ? 22 : 8), 16);
      if (!e.boss && e.hp < e.maxHp) {
        const w = e.r * 2;
        ctx.fillStyle = "#0008"; ctx.fillRect(e.x - w / 2, e.y + e.r + 3, w, 4);
        ctx.fillStyle = e.elite ? "#facc15" : "#ef4444"; ctx.fillRect(e.x - w / 2, e.y + e.r + 3, w * Math.max(0, e.hp / e.maxHp), 4);
      }
    }

    for (const b of G.eBullets) drawSprite(b.emoji, b.x, b.y, 18);
    for (const b of G.bullets) drawSprite(b.emoji, b.x, b.y, b.size, b.boomer ? G.time * 0.5 : b.homing ? Math.atan2(b.vy, b.vx) : 0);

    // lightning
    for (const bo of G.bolts) {
      ctx.strokeStyle = `rgba(147,197,253,${bo.life / 12})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      bo.pts.forEach((pt, i) => {
        if (i === 0) { ctx.moveTo(pt.x, pt.y); return; }
        const prev = bo.pts[i - 1];
        ctx.lineTo((prev.x + pt.x) / 2 + rand(-10, 10), (prev.y + pt.y) / 2 + rand(-10, 10));
        ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();
    }

    for (let i = 0; i < p.orbs; i++) {
      const a = p.orbAngle + (i / p.orbs) * Math.PI * 2;
      drawSprite("🌀", p.x + Math.cos(a) * 75, p.y + Math.sin(a) * 75, 24, p.orbAngle * 3);
    }

    ctx.strokeStyle = "rgba(56,189,248,0.08)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.magnet, 0, Math.PI * 2); ctx.stroke();

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
    // mascot pet
    drawSprite(G.ch.mascot, G.pet.x, G.pet.y - 6 + Math.sin(G.time * 0.15) * 4, 26, 0, 1, p.face < 0);
    const flicker = p.iframes > 0 && Math.floor(p.iframes / 4) % 2 === 0;
    if (!flicker) {
      const moving = Math.min(1, Math.hypot(p.vx, p.vy) / Math.max(1, p.speed));
      const roll = p.rollT > 0 ? (1 - p.rollT / 14) * Math.PI * 2 : 0;
      drawCharacter(G.ch, G.look, p.x, p.y, { face: p.face, walk: p.walkT, moving, aim: p.rollT > 0 ? undefined : p.aim, roll });
    }

    for (const pt of G.particles) {
      ctx.globalAlpha = Math.min(1, pt.life / 20);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;

    // blackout event: darkness except around the player
    if (G.event === "blackout") {
      const gr = ctx.createRadialGradient(p.x, p.y, 140, p.x, p.y, 300);
      gr.addColorStop(0, "rgba(0,0,0,0)");
      gr.addColorStop(1, "rgba(0,0,0,0.93)");
      ctx.fillStyle = gr;
      ctx.fillRect(cam.x - 50, cam.y - 50, W + 100, H + 100);
    }

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
    if (state === "playing" || state === "paused" || state === "levelup") {
      drawMinimap();
      drawBossPointer();
    }
    if (state === "playing" && IN.mode === "touch") {
      const home = IN.joyHome;
      if (IN.joy.active) drawStick(IN.joy, "rgba(255,255,255,0.5)");
      else {
        ctx.globalAlpha = 0.5;
        drawStick({ ox: home.x, oy: home.y, x: home.x, y: home.y }, "rgba(255,255,255,0.55)");
        ctx.fillStyle = "#fff"; ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center";
        ctx.fillText("MOVE", home.x, home.y + IN.JOY_R + 16);
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
    setHud("hp-text", "text", `${Math.ceil(p.hp)}/${Math.round(p.maxHp)} HP${G.revives ? " · ❤️‍🩹" : ""}`);
    $("hp-fill").parentElement.classList.toggle("low", p.hp < p.maxHp * 0.25);
    setHud("xp-fill", "width", ((G.xp / G.xpNext) * 100).toFixed(1) + "%");
    setHud("lvl-text", "text", `LVL ${G.level}`);
    setHud("votes", "text", G.votes.toLocaleString());
    const ev = G.event ? ` · ${EVENTS[G.event].emoji} ${EVENTS[G.event].name}` : "";
    setHud("wave-text", "text", `Wave ${G.wave}${G.endless ? "" : "/" + WAVES.length} · ${waveName(G.wave)}${ev}`);
    const cdMax = G.ch.cd * p.cdMult;
    setHud("special-cd", "height", ((p.specialT / cdMax) * 100).toFixed(0) + "%");
    $("special-btn").classList.toggle("ready", p.specialT <= 0);
    setHud("dash-cd", "height", ((p.rollCd / ROLL_CD) * 100).toFixed(0) + "%");
    $("dash-btn").classList.toggle("ready", p.rollCd <= 0);
    const fx = [];
    if (G.fx.shield > 0) fx.push(`🛡️ ${Math.ceil(G.fx.shield / 60)}s`);
    if (G.fx.hype > 0) fx.push(`⚡ ${Math.ceil(G.fx.hype / 60)}s`);
    if (G.fx.double > 0) fx.push(`🗳️x2 ${Math.ceil(G.fx.double / 60)}s`);
    if (G.fx.charm > 0) fx.push(`💕 ${Math.ceil(G.fx.charm / 60)}s`);
    if (G.fx.slow > 0) fx.push(`📜 ${Math.ceil(G.fx.slow / 60)}s`);
    setHud("effects", "html", fx.map(f => `<span class="fx">${f}</span>`).join(""));
    const showCombo = G.combo >= 5;
    $("combo").classList.toggle("hidden", !showCombo);
    if (showCombo) {
      setHud("combo-text", "text", `🔥 ${G.combo} COMBO · x${comboMult().toFixed(1)}`);
      setHud("combo-fill", "width", ((G.comboT / 150) * 100).toFixed(0) + "%");
      $("combo").classList.toggle("hot", G.combo >= 50);
    }
    if (G.boss) setHud("boss-fill", "width", Math.max(0, (G.boss.hp / G.boss.maxHp) * 100).toFixed(1) + "%");
  }

  // =====================================================================
  //  SCREENS & NAVIGATION
  // =====================================================================
  const SCREEN_ORDER = ["settings", "levelup", "pause", "gameover", "howto", "board", "shop", "achievements", "select", "menu"];
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
      case "select": case "howto": case "board": case "shop": case "achievements": toMenu(); break;
      case "gameover": toMenu(); break;
    }
  }

  // ---------- main menu ----------
  function renderMenu() {
    $("best-score").textContent = best.toLocaleString();
    $("menu-funds").textContent = META.data.funds.toLocaleString();
    $("menu-ach").textContent = `${Object.keys(META.data.ach).length}/${META.ACH.length}`;
    const featured = CHARS.filter(c => c.featured);
    const shown = [];
    while (shown.length < 6) { const c = pick(featured); if (!shown.includes(c)) shown.push(c); }
    $("title-flags").innerHTML = shown.map((c, i) => `<img src="${BR.flagUrl(c.code)}" alt="${esc(c.name)}" style="animation-delay:${i * 0.15}s">`).join("");
  }
  function toMenu() {
    if (G && (state === "paused" || state === "levelup")) META.commitRun(G.run); // quit runs still count (only new progress is added)
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
    if (G && state === "over") G = null;
    state = "menu";
    $("hud").classList.add("hidden");
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
      Object.values(BOSS_DEFS).map((b, i) => `<div>${b.emoji} <b>${esc(b.name)}</b>: boss, wave ${(i + 1) * 5}${i >= 2 ? " (Endless)" : ""}</div>`).join("");
    $("legend-weapons").innerHTML = Object.values(WEAPONS).map(w => `<div>${w.emoji} <b>${w.name}</b>: ${w.desc}</div>`).join("");
    $("legend-events").innerHTML = Object.values(EVENTS).map(e => `<div>${e.emoji} <b>${e.name}</b>: ${e.desc}</div>`).join("");
  }
  function renderBoard() {
    const board = store.get("board", []);
    $("board-body").innerHTML = board.length
      ? board.map((r, i) => `<tr><td>${i + 1}</td><td><img src="${BR.flagUrl(r.code)}" alt="">${esc(r.name)}${r.won ? " 🏆" : ""}</td><td>${r.votes.toLocaleString()}</td><td>${r.wave}</td><td>${esc(DIFFICULTY[r.diff] ? DIFFICULTY[r.diff].label : r.diff)}${r.endless ? " ♾️" : ""}</td></tr>`).join("")
      : `<tr><td colspan="5">No runs yet. Go farm some aura!</td></tr>`;
  }
  function recordRun(won) {
    const board = store.get("board", []).filter(r => r.id !== G.runId);
    board.push({ id: G.runId, votes: G.votes, code: G.ch.code, name: G.ch.name, wave: G.wave, diff: G.diff, won: won || G.endless, endless: G.endless, date: Date.now() });
    board.sort((a, b) => b.votes - a.votes);
    store.set("board", board.slice(0, 15));
    if (G.votes > best) { best = G.votes; store.set("best", best); }
    if (won && !G.endless) { wins[G.ch.code] = (wins[G.ch.code] || 0) + 1; store.set("wins", wins); }
  }

  // ---------- Campaign HQ ----------
  function renderShop() {
    $("shop-funds").textContent = META.data.funds.toLocaleString();
    $("shop-list").innerHTML = META.SHOP.map(it => {
      const lvl = META.level(it.id), maxed = lvl >= it.max, cost = META.cost(it.id);
      return `<div class="shop-item${maxed ? " maxed" : ""}">
        <div class="top"><span class="ico">${it.emoji}</span><div><div class="nm">${esc(it.name)}</div><div class="ds">${esc(it.desc)}</div></div></div>
        <div class="pips">${Array.from({ length: it.max }, (_, i) => `<i class="${i < lvl ? "on" : ""}"></i>`).join("")}</div>
        <button data-buy="${it.id}" ${maxed || !META.canBuy(it.id) ? "disabled" : ""}>${maxed ? "MAXED ✓" : `Buy · 💰 ${cost.toLocaleString()}`}</button>
      </div>`;
    }).join("");
  }

  // ---------- Achievements ----------
  function renderAchievements() {
    const s = META.data.stats;
    const done = Object.keys(META.data.ach).length;
    $("ach-count").textContent = `${done} / ${META.ACH.length}`;
    const mins = Math.round(s.playFrames / 3600);
    $("life-stats").innerHTML = `
      <div>🎮 Runs: <b>${s.runs}</b></div><div>🏛️ Wins: <b>${s.wins}</b></div><div>💀 Haters: <b>${s.kills.toLocaleString()}</b></div>
      <div>🔥 Best combo: <b>${s.bestCombo}</b></div><div>🌊 Best wave: <b>${s.bestWave}</b></div><div>💰 Funds earned: <b>${s.fundsEarned.toLocaleString()}</b></div>
      <div>✨ Elites: <b>${s.elites}</b></div><div>🌍 Countries won: <b>${Object.keys(s.winCountries).length}</b></div><div>⏱️ Played: <b>${mins} min</b></div>`;
    $("ach-list").innerHTML = META.ACH.map(a => {
      const got = !!META.data.ach[a.id];
      const [cur, goal] = a.p(s);
      return `<div class="ach${got ? " done" : ""}"><span class="ico">${a.emoji}</span><div style="flex:1">
        <div class="nm">${esc(a.name)}</div><div class="ds">${esc(a.desc)}</div>
        <div class="pr"><div style="width:${Math.round((cur / goal) * 100)}%"></div></div>
        <div class="rw">${got ? "✓ Unlocked" : `${cur.toLocaleString()} / ${goal.toLocaleString()}`} · 💰 ${a.reward}</div></div></div>`;
    }).join("");
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
    renderSettings();
    showScreen("settings");
    focusPrimary($("settings"));
  }
  function closeSettings() {
    hideScreen("settings");
    focusPrimary(topScreen());
  }

  // ---------- pause build list ----------
  function renderBuild() {
    const parts = UPGRADES.filter(u => G.upgrades[u.id]).map(u => `<span class="${u.weapon ? "w" : ""}">${u.emoji} ${esc(u.name)} <b>${G.upgrades[u.id]}</b></span>`);
    $("pause-build").innerHTML = parts.join("");
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
    if (G.pendingLevels > 0) setTimeout(() => { if (G && state === "playing" && G.pendingLevels > 0) openLevelUp(); }, 600);
    showTips();
  }

  function showTips() {
    if (store.get("tips", false)) return;
    store.set("tips", true);
    const mode = IN.mode;
    const move = mode === "touch" ? "Drag on the left side to move" : mode === "gamepad" ? "Left stick to move" : "WASD / Arrow keys to move";
    const sp = mode === "touch" ? "Big button = special, 💨 button = dodge roll" : mode === "gamepad" ? "RB / A = special, B / LB = dodge roll" : "SPACE = special, SHIFT = dodge roll";
    setTimeout(() => toast(`🕹️ ${move}. You shoot automatically.`), 2400);
    setTimeout(() => toast(`🌟 ${sp}`), 5200);
    setTimeout(() => toast("🔵 Grab votes to level up. Keep killing for 🔥 combos!"), 8000);
  }

  function togglePause() {
    if (state === "playing") {
      state = "paused";
      IN.clearKeys();
      $("pause-stats").innerHTML = `<div>🗳️ Votes: <b>${G.votes.toLocaleString()}</b></div><div>🌊 Wave: <b>${G.wave}</b></div>
        <div>📈 Level: <b>${G.level}</b></div><div>💀 Haters: <b>${G.kills}</b></div>
        <div>🔥 Best combo: <b>${G.bestCombo}</b></div><div>🎲 Rerolls: <b>${G.rerolls}</b></div>`;
      renderBuild();
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
    if (won) G.run.won = true;
    recordRun(won);
    const res = META.commitRun(G.run);
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
      <div>📈 Level: <b>${G.level}</b></div><div>🔥 Best combo: <b>${G.bestCombo}</b></div>
      <div>✨ Elites: <b>${G.run.elites}</b></div><div>🎚️ <b>${DIFFICULTY[G.diff].label}</b></div>`;
    $("go-funds").textContent = `💰 +${res.funds.toLocaleString()} funds (total ${META.data.funds.toLocaleString()})`;
    $("go-ach").innerHTML = res.unlocked.map(a => `<div>🏅 <b>${esc(a.name)}</b>: ${esc(a.desc)} (+💰${a.reward})</div>`).join("");
    if (res.unlocked.length) setTimeout(() => SND.sfx("achieve"), 900);
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
  click("btn-shop", () => { renderShop(); goTo("shop"); });
  click("btn-ach", () => { renderAchievements(); goTo("achievements"); });
  click("btn-howto", () => { renderHowto(); goTo("howto"); });
  click("btn-board", () => { renderBoard(); goTo("board"); });
  click("btn-settings", openSettings);
  click("btn-fs", toggleFullscreen);
  click("sel-back", toMenu);
  document.querySelectorAll(".back-btn").forEach(b => b.addEventListener("click", () => { SND.sfx("click"); back(); }));
  click("board-reset", () => { if (confirm("Reset the leaderboard and best score?")) { store.set("board", []); store.set("best", 0); best = 0; renderBoard(); } });

  $("shop-list").addEventListener("click", e => {
    const b = e.target.closest("button[data-buy]");
    if (!b) return;
    SND.init();
    const id = b.dataset.buy;
    if (META.buy(id)) {
      SND.sfx("buy");
      const it = META.SHOP.find(s => s.id === id);
      toast(`${it.emoji} ${it.name} → level ${META.level(id)}`);
    } else SND.sfx("error");
    renderShop();
    const nb = $("shop-list").querySelector(`[data-buy="${id}"]`);
    if (nb && IN.mode !== "touch") (nb.disabled ? $("shop").querySelector("[data-primary]") : nb).focus();
  });
  click("shop-refund", () => {
    if (!confirm("Refund every Campaign HQ upgrade? You get all the funds back.")) return;
    const n = META.refundAll();
    toast(`↺ Refunded 💰 ${n.toLocaleString()}`);
    renderShop();
  });

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
  hudBtn("dash-btn", useRoll);
  hudBtn("hud-pause", togglePause);
  hudBtn("hud-mute", toggleMute);
  hudBtn("hud-fs", toggleFullscreen);

  click("reroll-btn", reroll);
  click("resume-btn", togglePause);
  click("pause-settings", openSettings);
  click("restart-btn", () => { if (G) META.commitRun(G.run); startGame(G ? G.ch : selected); });
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
  IN.on("reroll", reroll);
  IN.on("dash", () => { if (state === "playing") useRoll(); });
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
  IN.on("gamepad", on => toast(on ? "🎮 Controller connected" : "🎮 Controller disconnected"));
  IN.on("mode", m => {
    if (m !== "touch" && state !== "playing") { const scr = topScreen(); if (scr && !scr.contains(document.activeElement)) focusPrimary(scr); }
  });
  window.addEventListener("pointerdown", () => SND.init(), { passive: true });

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
  window.__game = { get G() { return G; }, get state() { return state; }, settings, CHARS, META };
})();
