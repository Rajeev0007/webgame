// Brainrot Royale: weapons, loot, zone phases, map names.
(() => {
  "use strict";
  const BR3 = (window.BR3 = window.BR3 || {});

  // rarity -> glow color
  BR3.RARITY = {
    common:    { label: "Common",    color: "#d1d5db" },
    uncommon:  { label: "Uncommon",  color: "#4ade80" },
    rare:      { label: "Rare",      color: "#60a5fa" },
    epic:      { label: "Epic",      color: "#c084fc" },
    legendary: { label: "Legendary", color: "#facc15" },
  };

  // dmg per bullet, rpm = rounds per minute, spread in degrees (hip / aimed), range in metres
  BR3.WEAPONS = {
    pistol:  { name: "Talking Point P92", short: "P92",     icon: "🔫", ammo: "light",  mag: 15, rpm: 320, dmg: 22, head: 1.8, hip: 2.4, ads: 0.8,  range: 60,  reload: 1.4, auto: false, pellets: 1, recoil: 0.9, rarity: "common",    color: "#374151", zoom: 1.15, sound: "pistol" },
    smg:     { name: "Spin Doctor SMG",   short: "SMG",     icon: "🔫", ammo: "light",  mag: 30, rpm: 860, dmg: 15, head: 1.6, hip: 3.2, ads: 1.6,  range: 50,  reload: 2.0, auto: true,  pellets: 1, recoil: 0.5, rarity: "common",    color: "#1f2937", zoom: 1.2,  sound: "smg" },
    shotgun: { name: "Filibuster 12",     short: "S12",     icon: "💥", ammo: "shells", mag: 6,  rpm: 75,  dmg: 12, head: 1.5, hip: 6.5, ads: 5.0,  range: 22,  reload: 2.6, auto: false, pellets: 9, recoil: 2.6, rarity: "common",    color: "#7c2d12", zoom: 1.1,  sound: "shotgun" },
    ar:      { name: "AK-Aura",           short: "AK",      icon: "🔫", ammo: "heavy",  mag: 30, rpm: 600, dmg: 27, head: 2.0, hip: 3.0, ads: 0.7,  range: 120, reload: 2.4, auto: true,  pellets: 1, recoil: 1.2, rarity: "uncommon",  color: "#78350f", zoom: 1.5,  sound: "ar" },
    m4:      { name: "M4-Mandate",        short: "M4",      icon: "🔫", ammo: "heavy",  mag: 30, rpm: 720, dmg: 23, head: 2.0, hip: 2.6, ads: 0.5,  range: 130, reload: 2.2, auto: true,  pellets: 1, recoil: 0.8, rarity: "rare",      color: "#111827", zoom: 1.6,  sound: "ar" },
    dmr:     { name: "Recount DMR",       short: "DMR",     icon: "🎯", ammo: "heavy",  mag: 10, rpm: 230, dmg: 46, head: 2.2, hip: 4.0, ads: 0.2,  range: 220, reload: 2.8, auto: false, pellets: 1, recoil: 2.0, rarity: "epic",      color: "#14532d", zoom: 2.6,  sound: "dmr" },
    sniper:  { name: "Veto Sniper",       short: "VETO",    icon: "🎯", ammo: "sniper", mag: 5,  rpm: 45,  dmg: 95, head: 2.6, hip: 7.0, ads: 0.03, range: 320, reload: 3.2, auto: false, pellets: 1, recoil: 4.0, rarity: "epic",      color: "#1e3a8a", zoom: 4.5,  sound: "sniper" },
    golden:  { name: "Golden AK-Aura",    short: "GOLD AK", icon: "👑", ammo: "heavy",  mag: 40, rpm: 680, dmg: 31, head: 2.2, hip: 2.6, ads: 0.4,  range: 150, reload: 2.0, auto: true,  pellets: 1, recoil: 0.7, rarity: "legendary", color: "#ca8a04", zoom: 1.8,  sound: "ar" },
  };

  BR3.AMMO = {
    light:  { name: "Light ammo",  icon: "🟡", box: 30, max: 240 },
    heavy:  { name: "Heavy ammo",  icon: "🟠", box: 30, max: 240 },
    shells: { name: "Shells",      icon: "🔴", box: 10, max: 60 },
    sniper: { name: "Sniper ammo", icon: "🔵", box: 10, max: 40 },
  };

  BR3.ITEMS = {
    bandage: { name: "Bandage",       icon: "🩹", time: 2.5, heal: 15, cap: 75,  max: 10, rarity: "common" },
    medkit:  { name: "Med Kit",       icon: "🧰", time: 6.0, heal: 100, cap: 100, max: 3, rarity: "rare" },
    drink:   { name: "Energy Drink",  icon: "🥤", time: 3.0, boost: 40,           max: 5, rarity: "uncommon" },
    grenade: { name: "Hot Take Grenade", icon: "💣",                               max: 4, rarity: "uncommon" },
    gloo:    { name: "Gloo Wall",     icon: "🧊",                                 max: 8, rarity: "uncommon" },
  };

  // armor: damage reduction per level
  BR3.ARMOR = {
    vest:   { name: "Vest",   icon: "🦺", reduce: [0, 0.3, 0.42, 0.55] },
    helmet: { name: "Helmet", icon: "⛑️", reduce: [0, 0.3, 0.42, 0.55] },
  };
  BR3.LEVEL_RARITY = ["common", "common", "rare", "epic"];

  // loot table weights for ground loot
  BR3.LOOT_TABLE = [
    ["weapon:pistol", 17], ["weapon:smg", 14], ["weapon:shotgun", 12], ["weapon:ar", 11], ["weapon:m4", 6], ["weapon:dmr", 3], ["weapon:sniper", 1.5],
    ["ammo:light", 14], ["ammo:heavy", 13], ["ammo:shells", 6], ["ammo:sniper", 3],
    ["item:bandage", 12], ["item:medkit", 3], ["item:drink", 6], ["item:grenade", 5], ["item:gloo", 9],
    ["vest:1", 6], ["vest:2", 3], ["vest:3", 0.8], ["helmet:1", 6], ["helmet:2", 3], ["helmet:3", 0.8],
  ];

  // zone phases: wait (s), shrink (s), next radius as fraction of current, damage per second outside
  BR3.ZONE = [
    { wait: 60, shrink: 45, frac: 0.62, dps: 1 },
    { wait: 50, shrink: 40, frac: 0.6,  dps: 2 },
    { wait: 45, shrink: 35, frac: 0.55, dps: 4 },
    { wait: 40, shrink: 30, frac: 0.5,  dps: 6 },
    { wait: 35, shrink: 25, frac: 0.45, dps: 9 },
    { wait: 30, shrink: 25, frac: 0.0,  dps: 14 },
  ];

  BR3.TOWNS = ["Capitol Hill", "Spin City", "Lobby Town", "Ballot Bay", "Debate Docks", "Polling Plaza", "Swamp Village", "Filibuster Farm"];

  BR3.KILL_LINES = ["Ratio'd!", "Sit down!", "No cap, you're cooked!", "Touch grass!", "That's a W!", "Get mogged!", "Skill issue!", "Sheesh!"];
  BR3.WIN_LINES = ["Winner winner, aura dinner!", "Booyah! The people have spoken!", "Elected by landslide!"];

  // ---------------------------------------------------------------- character skills
  // price: coins (🪙). diamonds: premium currency (💎), earned in-game only.
  BR3.SKILLS = {
    medic: { name: "Medic Pulse",   icon: "💚", cd: 55, dur: 5, price: 0,    desc: "Heal you and teammates within 6 m by 35 HP over 5 s." },
    turbo: { name: "Turbo Run",     icon: "⚡", cd: 40, dur: 4, price: 800,  desc: "+45% move speed for 4 s." },
    iron:  { name: "Iron Will",     icon: "🛡️", cd: 55, dur: 5, price: 1200, desc: "Take 45% less damage for 5 s." },
    radar: { name: "Radar Pulse",   icon: "📡", cd: 45, dur: 6, price: 1500, desc: "Reveal enemies within 70 m (map + screen) for 6 s." },
    dome:  { name: "Gloo Fortress", icon: "🏰", cd: 70, dur: 0, price: 2000, desc: "Instantly surround yourself with gloo walls." },
    rush:  { name: "Adrenaline",    icon: "💉", cd: 60, dur: 0, price: 1800, desc: "Instant reload, +40 boost and +20 HP." },
  };
  BR3.PASSIVES = {
    thick:  { name: "Thick Skin",  icon: "🦏", price: 0,    desc: "Take 8% less damage." },
    hands:  { name: "Fast Hands",  icon: "🤲", price: 0,    desc: "Reload 20% faster." },
    sprint: { name: "Sprinter",    icon: "👟", price: 600,  desc: "Move 6% faster." },
    medic:  { name: "Field Medic", icon: "🩺", price: 700,  desc: "Use heals 35% faster." },
    hunter: { name: "Headhunter",  icon: "🎯", price: 1200, desc: "+12% headshot damage." },
    gloo:   { name: "Gloo Master", icon: "🧊", price: 900,  desc: "Your gloo walls have 40% more HP." },
    scav:   { name: "Scavenger",   icon: "🎒", price: 500,  desc: "+30% ammo from pickups." },
  };
  BR3.PETS = {
    none:    { name: "No pet",  animal: "none",    icon: "🚫", price: 0,    desc: "Travel light." },
    panda:   { name: "Bam",     animal: "panda",   icon: "🐼", price: 0,    desc: "Heals you 4 HP/s for 5 s after each kill." },
    dog:     { name: "Biscuit", animal: "dog",     icon: "🐶", price: 1200, desc: "Revive teammates 35% faster." },
    fox:     { name: "Ember",   animal: "fox",     icon: "🦊", price: 1500, desc: "Nearby guns show on your minimap." },
    owl:     { name: "Hoot",    animal: "owl",     icon: "🦉", price: 1800, desc: "See enemy gunshots on the minimap from twice as far." },
    penguin: { name: "Chilly",  animal: "penguin", icon: "🐧", price: 2000, desc: "Take 25% less zone damage." },
    robo:    { name: "Bolt",    animal: "robo",    icon: "🤖", price: 0, diamonds: 120, desc: "+2 gloo walls when you land and every Clash Squad round." },
  };
  // hat: none | cap | beanie | hood | crown | ninja | beret | visor | bandana
  BR3.OUTFITS = {
    flag:     { name: "Party Suit",    price: 0,    shirt: null,      pants: "#1f2937", hat: "none",    desc: "Your country's flag as a suit." },
    cap:      { name: "Rally Cap",     price: 500,  shirt: "#ef4444", pants: "#1e3a8a", hat: "cap",     desc: "Ready for the campaign trail." },
    hoodie:   { name: "Street Hoodie", price: 800,  shirt: "#ec4899", pants: "#111827", hat: "hood",    mask: true, desc: "Pink hoodie and face mask." },
    commando: { name: "Commando",      price: 1200, shirt: "#4d7c0f", pants: "#365314", hat: "beret",   desc: "Military green with a beret." },
    bandit:   { name: "Desert Bandit", price: 1500, shirt: "#d97706", pants: "#78350f", hat: "bandana", mask: true, desc: "Bandana and dusty orange." },
    ninja:    { name: "Shadow Ninja",  price: 2500, shirt: "#334155", pants: "#0f172a", hat: "ninja",   mask: true, desc: "Headband, mask and dark gear." },
    cyber:    { name: "Cyber Runner",  price: 3000, shirt: "#0891b2", pants: "#0f172a", hat: "visor",   glow: "#22d3ee", desc: "Glowing neon visor." },
    royal:    { name: "Royal Leader",  price: 4000, shirt: "#7c3aed", pants: "#3b0764", hat: "crown",   desc: "Purple robe and a golden crown." },
    golden:   { name: "Golden Aura",   price: 0, diamonds: 200, shirt: "#facc15", pants: "#a16207", hat: "crown", glow: "#facc15", desc: "Pure gold. Maximum aura." },
  };
  BR3.WSKINS = {
    none:    { name: "Factory",     price: 0,    color: null,      glow: null,      tracer: null },
    gold:    { name: "Gold Plated", price: 1500, color: "#d4a017", glow: "#facc15", tracer: [1, 0.85, 0.2] },
    neon:    { name: "Neon Rizz",   price: 2000, color: "#7e22ce", glow: "#c084fc", tracer: [0.8, 0.4, 1] },
    ice:     { name: "Frostbite",   price: 2500, color: "#0e7490", glow: "#67e8f9", tracer: [0.5, 0.9, 1] },
    toxic:   { name: "Toxic",       price: 0, diamonds: 100, color: "#3f6212", glow: "#a3e635", tracer: [0.6, 1, 0.2] },
    inferno: { name: "Inferno",     price: 0, diamonds: 150, color: "#b91c1c", glow: "#f97316", tracer: [1, 0.4, 0.1] },
  };
  BR3.EMOTES = {
    wave:    { name: "Wave",    icon: "👋" },
    dance:   { name: "Dance",   icon: "💃" },
    victory: { name: "Victory", icon: "🙌" },
    salute:  { name: "Salute",  icon: "🫡" },
  };
  // rank points thresholds (BR and CS use the same ladder)
  BR3.RANKS = [
    { name: "Bronze",      pts: 0,    icon: "🥉", color: "#b45309" },
    { name: "Silver",      pts: 1000, icon: "🥈", color: "#9ca3af" },
    { name: "Gold",        pts: 1600, icon: "🥇", color: "#eab308" },
    { name: "Platinum",    pts: 2200, icon: "💠", color: "#22d3ee" },
    { name: "Diamond",     pts: 2800, icon: "💎", color: "#60a5fa" },
    { name: "Heroic",      pts: 3400, icon: "🔥", color: "#ef4444" },
    { name: "Grandmaster", pts: 4200, icon: "👑", color: "#f59e0b" },
  ];
  BR3.MODES = {
    ranked:   { name: "RANKED GAME",         sub: "Battle Royale · rank points", icon: "🏆", br: true,  ranked: true },
    classic:  { name: "CLASSIC",             sub: "Battle Royale · Solo / Duo / Squad", icon: "🪂", br: true },
    cs:       { name: "CLASH SQUAD",         sub: "4v4 rounds · first to 4", icon: "⚔️", cs: true },
    csranked: { name: "CLASH SQUAD RANKED",  sub: "4v4 rounds · rank points", icon: "🏅", cs: true, ranked: true },
    training: { name: "TRAINING",            sub: "Shooting range · every gun", icon: "🎯", training: true },
  };
  // Clash Squad buy menu
  BR3.CS_SHOP = [
    { kind: "weapon", id: "smg", cost: 350 }, { kind: "weapon", id: "shotgun", cost: 400 }, { kind: "weapon", id: "ar", cost: 600 },
    { kind: "weapon", id: "m4", cost: 700 }, { kind: "weapon", id: "dmr", cost: 800 }, { kind: "weapon", id: "sniper", cost: 900 },
    { kind: "vest", lvl: 2, cost: 300 }, { kind: "vest", lvl: 3, cost: 550 }, { kind: "helmet", lvl: 2, cost: 250 }, { kind: "helmet", lvl: 3, cost: 450 },
    { kind: "item", type: "gloo", n: 3, cost: 200 }, { kind: "item", type: "grenade", n: 1, cost: 150 },
    { kind: "item", type: "medkit", n: 1, cost: 200 }, { kind: "item", type: "bandage", n: 4, cost: 100 },
  ];
  BR3.STREAKS = ["", "", "DOUBLE KILL", "TRIPLE KILL", "QUADRA KILL", "RAMPAGE", "UNSTOPPABLE"];

  BR3.DIFF = {
    easy:   { label: "Easy",   aim: 2.8, react: 1.0, dmg: 0.55 },
    normal: { label: "Normal", aim: 1.9, react: 0.65, dmg: 0.75 },
    hard:   { label: "Hard",   aim: 1.1, react: 0.35, dmg: 0.95 },
  };
})();
