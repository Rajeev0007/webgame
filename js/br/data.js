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
    ["item:bandage", 12], ["item:medkit", 3], ["item:drink", 6], ["item:grenade", 5],
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

  BR3.DIFF = {
    easy:   { label: "Easy",   aim: 2.8, react: 1.0, dmg: 0.55 },
    normal: { label: "Normal", aim: 1.9, react: 0.65, dmg: 0.75 },
    hard:   { label: "Hard",   aim: 1.1, react: 0.35, dmg: 0.95 },
  };
})();
