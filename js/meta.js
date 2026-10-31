// Meta progression: campaign funds, permanent upgrades (Campaign HQ), achievements and lifetime stats.
(() => {
  "use strict";
  const BR = (window.BR = window.BR || {});
  const KEY = "bre2-meta";

  const SHOP = [
    { id: "hp",     emoji: "💪", name: "Fitness Coach",      desc: "+10 max HP per level",               max: 5, base: 60 },
    { id: "dmg",    emoji: "📢", name: "Speechwriter",       desc: "+6% damage per level",               max: 5, base: 80 },
    { id: "speed",  emoji: "👟", name: "Sneaker Sponsor",    desc: "+4% move speed per level",           max: 5, base: 60 },
    { id: "magnet", emoji: "🧲", name: "Grassroots Network", desc: "+15% vote pickup range per level",   max: 5, base: 50 },
    { id: "cd",     emoji: "⏱️", name: "PR Team",            desc: "-6% special cooldown per level",     max: 5, base: 80 },
    { id: "luck",   emoji: "🍀", name: "Lucky Pin",          desc: "+20% power-up drops per level",      max: 5, base: 70 },
    { id: "reroll", emoji: "🎲", name: "Focus Group",        desc: "+1 upgrade reroll per run",          max: 3, base: 90 },
    { id: "start",  emoji: "🎓", name: "Head Start",         desc: "Start each run with +1 free upgrade", max: 3, base: 150 },
    { id: "funds",  emoji: "💰", name: "Donor Network",      desc: "+10% funds earned per level",        max: 5, base: 100 },
    { id: "revive", emoji: "❤️‍🩹", name: "Second Term",       desc: "Revive once per run at 50% HP",      max: 1, base: 400 },
  ];

  const prog = (cur, goal) => [Math.min(cur, goal), goal];
  const ACH = [
    { id: "firstwin",  emoji: "🏛️", name: "Elected!",            desc: "Win a campaign",                       reward: 100, p: s => prog(s.wins, 1) },
    { id: "hardwin",   emoji: "🔥", name: "Landslide",           desc: "Win on Hard",                          reward: 250, p: s => prog(s.hardWins, 1) },
    { id: "kills1k",   emoji: "💀", name: "Hater Hunter",        desc: "Defeat 1,000 haters in total",         reward: 100, p: s => prog(s.kills, 1000) },
    { id: "kills10k",  emoji: "☠️", name: "Ratio Machine",       desc: "Defeat 10,000 haters in total",        reward: 300, p: s => prog(s.kills, 10000) },
    { id: "combo50",   emoji: "⚡", name: "On Fire",             desc: "Reach a 50 kill combo",                reward: 60,  p: s => prog(s.bestCombo, 50) },
    { id: "combo150",  emoji: "🌋", name: "Unstoppable Aura",    desc: "Reach a 150 kill combo",               reward: 200, p: s => prog(s.bestCombo, 150) },
    { id: "lobbyist",  emoji: "💰", name: "Drain the Swamp",     desc: "Defeat The Lobbyist",                  reward: 60,  p: s => prog(s.bosses.lobbyist || 0, 1) },
    { id: "lizard",    emoji: "🦎", name: "Lizard Slayer",       desc: "Defeat the Lizard Overlord",           reward: 120, p: s => prog(s.bosses.lizard || 0, 1) },
    { id: "mogul",     emoji: "📺", name: "Cancel the Network",  desc: "Defeat the Media Mogul (Endless)",     reward: 200, p: s => prog(s.bosses.mogul || 0, 1) },
    { id: "algo",      emoji: "🧠", name: "Beat the Algorithm",  desc: "Defeat The Algorithm (Endless)",       reward: 300, p: s => prog(s.bosses.algorithm || 0, 1) },
    { id: "wave20",    emoji: "♾️", name: "Term Limits? Never",  desc: "Reach wave 20",                        reward: 250, p: s => prog(s.bestWave, 20) },
    { id: "elite50",   emoji: "✨", name: "Elite Hunter",        desc: "Defeat 50 elite haters",               reward: 120, p: s => prog(s.elites, 50) },
    { id: "level30",   emoji: "📈", name: "Poll Leader",         desc: "Reach level 30 in one run",            reward: 150, p: s => prog(s.bestLevel, 30) },
    { id: "world10",   emoji: "🌍", name: "World Tour",          desc: "Win with 10 different countries",      reward: 300, p: s => prog(Object.keys(s.winCountries).length, 10) },
    { id: "regions",   emoji: "🗺️", name: "Globalist",           desc: "Play a country from every region",     reward: 100, p: s => prog(Object.keys(s.regionsPlayed).length, 6) },
    { id: "powerups",  emoji: "🎁", name: "Free Stuff Enjoyer",  desc: "Collect 100 power-ups",                reward: 80,  p: s => prog(s.powerups, 100) },
    { id: "specials",  emoji: "🌀", name: "Special Interest",    desc: "Use your special 200 times",           reward: 80,  p: s => prog(s.specials, 200) },
    { id: "toolkit",   emoji: "🧰", name: "Full Toolkit",        desc: "Own all 4 bonus weapons in one run",   reward: 150, p: s => prog(s.maxWeapons, 4) },
    { id: "comeback",  emoji: "❤️‍🩹", name: "Comeback Kid",        desc: "Get revived by Second Term",           reward: 60,  p: s => prog(s.revives, 1) },
    { id: "rich",      emoji: "🤑", name: "Super PAC",           desc: "Earn 5,000 funds in total",            reward: 200, p: s => prog(s.fundsEarned, 5000) },
  ];

  const blankStats = () => ({
    runs: 0, kills: 0, wins: 0, hardWins: 0, bestCombo: 0, bosses: {}, bestWave: 0, elites: 0, bestLevel: 0,
    winCountries: {}, regionsPlayed: {}, powerups: 0, specials: 0, maxWeapons: 0, revives: 0, fundsEarned: 0, playFrames: 0,
  });

  function load() {
    let d = {};
    try { d = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { d = {}; }
    return {
      funds: Number(d.funds) || 0,
      shop: Object.assign({}, d.shop),
      ach: Object.assign({}, d.ach),
      stats: Object.assign(blankStats(), d.stats, {
        bosses: Object.assign({}, d.stats && d.stats.bosses),
        winCountries: Object.assign({}, d.stats && d.stats.winCountries),
        regionsPlayed: Object.assign({}, d.stats && d.stats.regionsPlayed),
      }),
    };
  }

  const M = (BR.Meta = { SHOP, ACH, data: load() });
  M.save = () => { try { localStorage.setItem(KEY, JSON.stringify(M.data)); } catch (e) { /* private mode */ } };
  M.level = id => M.data.shop[id] || 0;
  M.cost = id => {
    const it = SHOP.find(s => s.id === id);
    return Math.round(it.base * Math.pow(1.6, M.level(id)));
  };
  M.canBuy = id => {
    const it = SHOP.find(s => s.id === id);
    return M.level(id) < it.max && M.data.funds >= M.cost(id);
  };
  M.buy = id => {
    if (!M.canBuy(id)) return false;
    M.data.funds -= M.cost(id);
    M.data.shop[id] = M.level(id) + 1;
    M.save();
    return true;
  };
  M.refundAll = () => {
    let total = 0;
    for (const it of SHOP) {
      for (let l = 0; l < M.level(it.id); l++) total += Math.round(it.base * Math.pow(1.6, l));
    }
    M.data.funds += total;
    M.data.shop = {};
    M.save();
    return total;
  };

  // Check every achievement; returns the ones newly unlocked (rewards are added to funds)
  M.check = () => {
    const out = [];
    for (const a of ACH) {
      if (M.data.ach[a.id]) continue;
      const [cur, goal] = a.p(M.data.stats);
      if (cur >= goal) {
        M.data.ach[a.id] = Date.now();
        M.data.funds += a.reward;
        out.push(a);
      }
    }
    if (out.length) M.save();
    return out;
  };

  M.fundsFor = ({ votes, waves, won, elites, scoreMult }) =>
    Math.max(0, Math.round((votes / 40 + waves * 6 + (won ? 120 : 0) + elites * 3) * scoreMult * (1 + 0.1 * M.level("funds"))));

  // Commit the difference between the run's current counters and what was already committed.
  M.commitRun = run => {
    const s = M.data.stats;
    const c = run.committed || { kills: 0, elites: 0, powerups: 0, specials: 0, revives: 0, votes: 0, wave: 0, frames: 0, won: false };
    const d = k => run[k] - (c[k] || 0);
    s.kills += d("kills");
    s.elites += d("elites");
    s.powerups += d("powerups");
    s.specials += d("specials");
    s.revives += d("revives");
    s.playFrames += d("frames");
    if (!run.committed) { s.runs++; s.regionsPlayed[run.region] = 1; }
    s.bestCombo = Math.max(s.bestCombo, run.bestCombo);
    s.bestWave = Math.max(s.bestWave, run.wave);
    s.bestLevel = Math.max(s.bestLevel, run.level);
    s.maxWeapons = Math.max(s.maxWeapons, run.weapons);
    for (const [id, n] of Object.entries(run.bosses)) {
      const prev = (c.bosses && c.bosses[id]) || 0;
      s.bosses[id] = (s.bosses[id] || 0) + (n - prev);
    }
    const newWin = run.won && !c.won;
    if (newWin) {
      s.wins++;
      if (run.diff === "hard") s.hardWins++;
      s.winCountries[run.code] = 1;
    }
    const funds = M.fundsFor({ votes: d("votes"), waves: d("wave"), won: newWin, elites: d("elites"), scoreMult: run.scoreMult });
    M.data.funds += funds;
    s.fundsEarned += funds;
    run.committed = {
      kills: run.kills, elites: run.elites, powerups: run.powerups, specials: run.specials, revives: run.revives,
      votes: run.votes, wave: run.wave, frames: run.frames, won: run.won, bosses: Object.assign({}, run.bosses),
    };
    M.save();
    const unlocked = M.check();
    return { funds, unlocked };
  };
})();
