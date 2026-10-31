// Brainrot Royale: player profile, level, currencies, ranks, owned items, rewards, daily login.
(() => {
  "use strict";
  const BR3 = (window.BR3 = window.BR3 || {});
  const KEY = "brr-profile";

  function defaults() {
    const uid = String(Math.floor(1e9 + Math.random() * 8.9e9));
    return {
      name: "Player" + Math.floor(1000 + Math.random() * 9000), uid, level: 1, xp: 0,
      coins: 1500, diamonds: 60, likes: Math.floor(Math.random() * 40),
      br: { pts: 0, season: 1 }, cs: { pts: 0 },
      stats: { matches: 0, wins: 0, kills: 0, deaths: 0, dmg: 0, heads: 0, top10: 0, best: 0, csMatches: 0, csWins: 0, csKills: 0, csRounds: 0, timePlayed: 0 },
      history: [],
      owned: { outfit: ["flag"], wskin: ["none"], pet: ["none", "panda"], skill: ["medic"], passive: ["thick", "hands"] },
      equip: { outfit: "flag", wskin: "none", pet: "panda", skill: "medic", passives: ["thick", "hands"] },
      daily: { last: "", streak: 0 },
    };
  }
  function load() {
    const d = defaults();
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && typeof s === "object") {
        Object.assign(d, s);
        d.stats = Object.assign(defaults().stats, s.stats);
        d.owned = Object.assign(defaults().owned, s.owned);
        d.equip = Object.assign(defaults().equip, s.equip);
        d.br = Object.assign({ pts: 0, season: 1 }, s.br);
        d.cs = Object.assign({ pts: 0 }, s.cs);
        d.daily = Object.assign({ last: "", streak: 0 }, s.daily);
        if (!Array.isArray(d.history)) d.history = [];
      }
    } catch (e) { /* fresh profile */ }
    return d;
  }

  const P = (BR3.Progress = { data: load() });
  P.save = () => { try { localStorage.setItem(KEY, JSON.stringify(P.data)); } catch (e) { /* private mode */ } };
  P.xpNeed = lvl => 400 + lvl * 150;

  P.addXp = n => {
    const d = P.data;
    let ups = 0;
    d.xp += n;
    while (d.xp >= P.xpNeed(d.level)) { d.xp -= P.xpNeed(d.level); d.level++; ups++; d.coins += 200; d.diamonds += 10; }
    return ups;
  };

  P.rankOf = pts => {
    const R = BR3.RANKS;
    let i = 0;
    while (i + 1 < R.length && pts >= R[i + 1].pts) i++;
    const r = R[i], next = R[i + 1];
    const span = next ? next.pts - r.pts : 1000;
    const into = pts - r.pts;
    const sub = next ? Math.min(4, Math.floor((into / span) * 4) + 1) : 0;
    return { ...r, idx: i, sub, label: r.name + (sub ? " " + ["", "I", "II", "III", "IV"][sub] : ""), progress: next ? into / span : 1, next };
  };

  // catalog helpers: category -> data table
  const TABLE = { outfit: () => BR3.OUTFITS, wskin: () => BR3.WSKINS, pet: () => BR3.PETS, skill: () => BR3.SKILLS, passive: () => BR3.PASSIVES };
  P.item = (cat, id) => TABLE[cat]()[id];
  P.owns = (cat, id) => P.data.owned[cat].includes(id);
  P.priceOf = (cat, id) => { const it = P.item(cat, id); return it.diamonds ? { cur: "diamonds", n: it.diamonds } : { cur: "coins", n: it.price || 0 }; };
  P.canAfford = (cat, id) => { const p = P.priceOf(cat, id); return P.data[p.cur] >= p.n; };
  P.buy = (cat, id) => {
    if (P.owns(cat, id)) return true;
    const p = P.priceOf(cat, id);
    if (P.data[p.cur] < p.n) return false;
    P.data[p.cur] -= p.n;
    P.data.owned[cat].push(id);
    P.save();
    return true;
  };
  P.equip = (cat, id, slot) => {
    if (!P.owns(cat, id)) return false;
    const e = P.data.equip;
    if (cat === "passive") {
      if (e.passives.includes(id)) return true;
      const s = slot == null ? 1 : slot;
      e.passives[s] = id;
    } else e[cat] = id;
    P.save();
    return true;
  };

  // ---------------- daily login (7-day cycle)
  const today = () => new Date().toISOString().slice(0, 10);
  P.dailyRewards = [
    { coins: 300 }, { coins: 400 }, { diamonds: 20 }, { coins: 600 }, { coins: 800 }, { diamonds: 40 }, { coins: 1500, diamonds: 100 },
  ];
  P.dailyAvailable = () => P.data.daily.last !== today();
  P.dailyDay = () => {
    const d = P.data.daily;
    const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    const streak = d.last === y || d.last === today() ? d.streak : 0;
    return streak % 7;
  };
  P.claimDaily = () => {
    if (!P.dailyAvailable()) return null;
    const day = P.dailyDay();
    const r = P.dailyRewards[day];
    P.data.coins += r.coins || 0;
    P.data.diamonds += r.diamonds || 0;
    P.data.daily = { last: today(), streak: day + 1 };
    P.save();
    return { day: day + 1, ...r };
  };

  // ---------------- match rewards
  // m: { mode, ranked, won, placement, total, kills, dmg, heads, secs, rounds?, roundsWon? }
  P.reward = m => {
    const d = P.data, s = d.stats;
    const out = { xp: 0, coins: 0, diamonds: 0, pts: 0, levelUps: 0 };
    if (m.mode === "training") {
      out.xp = Math.min(150, Math.round(m.secs / 4));
      out.levelUps = P.addXp(out.xp);
      P.save();
      return out;
    }
    if (m.cs) {
      s.csMatches++; s.csKills += m.kills; s.csRounds += m.rounds || 0;
      if (m.won) s.csWins++;
      out.xp = 150 + m.kills * 35 + (m.roundsWon || 0) * 40 + (m.won ? 250 : 0);
      out.coins = 100 + m.kills * 25 + (m.won ? 300 : 60);
      if (m.won) out.diamonds = 3;
      if (m.ranked) { out.pts = (m.won ? 32 : -18) + m.kills * 3; d.cs.pts = Math.max(0, d.cs.pts + out.pts); }
    } else {
      s.matches++; s.kills += m.kills; s.dmg += Math.round(m.dmg); s.heads += m.heads || 0;
      if (!m.won) s.deaths++;
      if (m.won) s.wins++;
      if (m.placement <= 10) s.top10++;
      if (!s.best || m.placement < s.best) s.best = m.placement;
      const placeBonus = Math.max(0, Math.round((1 - (m.placement - 1) / Math.max(1, m.total - 1)) * 200));
      out.xp = 120 + m.kills * 45 + Math.round(m.secs / 3) + placeBonus + (m.won ? 400 : 0);
      out.coins = 80 + m.kills * 30 + Math.round(placeBonus * 0.8) + (m.won ? 500 : 0);
      if (m.won) out.diamonds = 5;
      if (m.ranked) {
        const table = [60, 45, 36, 28, 22, 16, 11, 7, 4, 2];
        const teams = m.total;
        const rel = (m.placement - 1) / Math.max(1, teams - 1);
        out.pts = (m.placement <= 10 ? table[m.placement - 1] : 0) + m.kills * 9 - (rel > 0.5 ? 15 : 5);
        d.br.pts = Math.max(0, d.br.pts + out.pts);
      }
    }
    s.timePlayed += m.secs;
    d.coins += out.coins;
    d.diamonds += out.diamonds;
    out.levelUps = P.addXp(out.xp);
    d.history.unshift({ t: Date.now(), mode: m.mode, ranked: !!m.ranked, won: !!m.won, placement: m.placement, total: m.total, kills: m.kills, dmg: Math.round(m.dmg || 0), score: m.score || "", code: m.code });
    d.history = d.history.slice(0, 20);
    P.save();
    return out;
  };
})();
