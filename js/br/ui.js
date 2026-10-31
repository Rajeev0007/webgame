// Brainrot Royale menus: lobby header, mode select, store / vault / pets, character skills, profile, daily rewards.
(() => {
  "use strict";
  const BR3 = window.BR3, BR = window.BR, SND = BR.Audio, X = BR3.X;
  if (!X || !X.R) return;
  const { $, esc } = X;
  const PROG = BR3.Progress;
  const UI = (BR3.UI = {});
  const click = (el, fn) => el.addEventListener("click", e => { SND.init(); SND.sfx("click"); fn(e); });

  // ------------------------------------------------------------ lobby
  UI.refreshLobby = () => {
    const d = PROG.data, S = X.S, M = BR3.MODES[S.mode] || BR3.MODES.classic, c = X.selected;
    $("lAvatar").src = BR.flagUrl(c.code);
    $("lName").textContent = d.name;
    $("lLvl").textContent = "Lv." + d.level;
    $("lXp").style.width = Math.round((d.xp / PROG.xpNeed(d.level)) * 100) + "%";
    const rk = PROG.rankOf(M.cs ? d.cs.pts : d.br.pts);
    $("lRank").textContent = `${rk.icon} ${rk.label}`;
    $("lCoins").textContent = d.coins.toLocaleString();
    $("lDia").textContent = d.diamonds.toLocaleString();
    $("dailyDot").classList.toggle("hidden", !PROG.dailyAvailable());
    $("mName").textContent = M.name;
    const teamTxt = M.cs ? "4v4 · first to 4" : M.training ? "Solo practice" : { 1: "Solo", 2: "Duo", 4: "Squad" }[S.team];
    $("mSub").textContent = `${M.icon} ${teamTxt}${M.ranked ? ` · ${rk.icon} ${rk.label}` : ""}`;
    $("teamSeg").classList.toggle("hidden", !M.br);
    document.querySelectorAll("#teamSeg button").forEach(b => b.classList.toggle("on", +b.dataset.t === S.team));
    $("diffSeg").innerHTML = Object.entries(BR3.DIFF).map(([k, v]) => `<button data-d="${k}" class="${S.diff === k ? "on" : ""}">${v.label}</button>`).join("");
    $("diffSeg").classList.toggle("hidden", !!M.training);
    const e = d.equip, sk = BR3.SKILLS[e.skill], pet = BR3.PETS[e.pet], of = BR3.OUTFITS[e.outfit], ws = BR3.WSKINS[e.wskin];
    $("lCand").innerHTML = `
      <div class="row"><img src="${BR.flagUrl(c.code)}" alt=""><div><b>${esc(c.name)}</b><div>${esc(c.party)}</div></div></div>
      <div><i>“${esc(c.phrase)}”</i></div>
      <div class="eq"><span>${sk.icon} ${esc(sk.name)}</span>${e.passives.map(p => `<span>${BR3.PASSIVES[p].icon} ${esc(BR3.PASSIVES[p].name)}</span>`).join("")}</div>
      <div class="eq"><span>👕 ${esc(of.name)}</span><span>🔫 ${esc(ws.name)}</span><span>${pet.icon} ${esc(pet.name)}</span></div>
      <button class="big secondary" id="lVoice" style="padding:6px">🔊 Voice line</button>`;
    $("lVoice").onclick = () => { SND.init(); X.speakAs(c, c.phrase, true); };
    $("lEmotes").innerHTML = Object.entries(BR3.EMOTES).map(([k, v]) => `<button data-e="${k}" title="${v.name}">${v.icon}</button>`).join("");
    $("playBtn").textContent = M.training ? "TRAIN" : "START";
    X.refreshLobbyScene();
  };
  $("teamSeg").addEventListener("click", e => { const b = e.target.closest("[data-t]"); if (!b) return; X.S.team = +b.dataset.t; X.applySettings(); UI.refreshLobby(); });
  $("diffSeg").addEventListener("click", e => { const b = e.target.closest("[data-d]"); if (!b) return; X.S.diff = b.dataset.d; X.applySettings(); UI.refreshLobby(); });
  $("lEmotes").addEventListener("click", e => { const b = e.target.closest("[data-e]"); if (b) X.lobbyEmote(b.dataset.e); });
  click($("playBtn"), () => X.startMatch());
  click($("modeCard"), () => openModes());
  click($("profBtn"), () => openProfile());
  click($("setBtn"), () => X.openSettings("lobby"));
  document.querySelectorAll(".lside [data-go]").forEach(b => click(b, () => {
    const g = b.dataset.go;
    if (g === "store") openStore("outfit", false);
    else if (g === "vault") openStore("outfit", true);
    else if (g === "pets") openStore("pet", false);
    else if (g === "skills") openSkills();
    else if (g === "chars") X.openChars();
    else if (g === "daily") openDaily();
    else if (g === "profile") openProfile();
    else if (g === "howto") X.openHowto();
  }));

  // ------------------------------------------------------------ modes
  function openModes() {
    const S = X.S, d = PROG.data;
    const br = PROG.rankOf(d.br.pts), cs = PROG.rankOf(d.cs.pts);
    const card = (k, cls) => {
      const M = BR3.MODES[k];
      const rank = k === "ranked" ? `<span class="rkb">${br.icon} ${br.label} · ${d.br.pts} RP</span>` : k === "csranked" ? `<span class="rkb">${cs.icon} ${cs.label} · ${d.cs.pts} RP</span>` : "";
      const seg = M.br ? `<div class="seg" data-mode="${k}">${[1, 2, 4].map(t => `<button data-t="${t}" class="${S.mode === k && S.team === t ? "on" : ""}">${{ 1: "Solo", 2: "Duo", 4: "Squad" }[t]}</button>`).join("")}</div>` : "";
      // a div (not a button) so the Solo/Duo/Squad buttons can live inside the card
      return `<div role="button" tabindex="0" class="mcard m-${k} ${cls || ""}${S.mode === k ? " on" : ""}" data-m="${k}">${rank}<span class="ic">${M.icon}</span><h3>${M.name}</h3><p>${esc(M.sub)}</p>${seg}</div>`;
    };
    $("modeGrid").innerHTML = card("ranked", "big1") + card("classic") + card("cs") + card("csranked") + card("training");
    X.show("modes");
  }
  $("modeGrid").addEventListener("click", e => {
    const t = e.target.closest("[data-t]"), m = e.target.closest("[data-m]");
    if (!m) return;
    SND.init(); SND.sfx("click");
    X.S.mode = m.dataset.m;
    if (t) X.S.team = +t.dataset.t;
    X.applySettings();
    X.toLobby();
  });

  // ------------------------------------------------------------ store / vault / pets
  let storeCat = "outfit", vaultOnly = false;
  const CAT_LABEL = { outfit: "👕 Outfits", wskin: "🔫 Weapon skins", pet: "🐾 Pets" };
  function priceTag(cat, id) {
    const p = PROG.priceOf(cat, id);
    return p.n === 0 ? "FREE" : p.cur === "diamonds" ? `💎 ${p.n}` : `🪙 ${p.n.toLocaleString()}`;
  }
  function swatch(cat, id, it) {
    if (cat === "outfit") return `<div class="sw" style="background:linear-gradient(135deg, ${it.shirt || "#16a34a"} 55%, ${it.pants} 55%)">${{ cap: "🧢", hood: "🧥", beret: "🎖️", bandana: "🤠", ninja: "🥷", visor: "🕶️", crown: "👑" }[it.hat] || "🏳️"}</div>`;
    if (cat === "wskin") return `<div class="sw" style="background:${it.color || "#374151"};box-shadow:inset 0 0 18px ${it.glow || "transparent"}">🔫</div>`;
    return `<div class="sw" style="background:#0f172a">${it.icon}</div>`;
  }
  function openStore(cat, vault) {
    storeCat = cat; vaultOnly = vault;
    $("storeTitle").textContent = vault ? "👕 Vault (owned)" : cat === "pet" ? "🐾 Pets" : "🛒 Store";
    renderStore();
    X.show("store");
  }
  function renderStore() {
    const d = PROG.data;
    document.querySelectorAll(".sCoins").forEach(e => (e.textContent = d.coins.toLocaleString()));
    document.querySelectorAll(".sDia").forEach(e => (e.textContent = d.diamonds.toLocaleString()));
    $("storeTabs").innerHTML = Object.entries(CAT_LABEL).map(([k, v]) => `<button data-c="${k}" class="${k === storeCat ? "on" : ""}">${v}</button>`).join("") +
      `<button data-v="1" class="${vaultOnly ? "on" : ""}">${vaultOnly ? "✓ Owned only" : "Owned only"}</button>`;
    const table = { outfit: BR3.OUTFITS, wskin: BR3.WSKINS, pet: BR3.PETS }[storeCat];
    const eqId = d.equip[storeCat];
    $("storeGrid").innerHTML = Object.entries(table).filter(([id]) => !vaultOnly || PROG.owns(storeCat, id)).map(([id, it]) => {
      const own = PROG.owns(storeCat, id), eq = eqId === id;
      const status = eq ? "✓ EQUIPPED" : own ? "OWNED · tap to equip" : priceTag(storeCat, id);
      return `<button class="sitem${eq ? " eq" : own ? " owned" : ""}" data-id="${id}">${swatch(storeCat, id, it)}<b>${esc(it.name)}</b><small>${esc(it.desc || (it.glow ? "Glowing finish" : "Classic finish"))}</small><span class="pr">${status}</span></button>`;
    }).join("") || `<p class="tag">Nothing owned here yet. Turn off "Owned only" to shop.</p>`;
  }
  $("storeTabs").addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b) return;
    SND.sfx("click");
    if (b.dataset.v) vaultOnly = !vaultOnly; else storeCat = b.dataset.c;
    X.preview = null; X.refreshLobbyScene();
    renderStore();
  });
  $("storeGrid").addEventListener("click", e => {
    const b = e.target.closest(".sitem");
    if (!b) return;
    SND.init();
    const id = b.dataset.id, cat = storeCat;
    X.preview = { [cat]: id };
    X.refreshLobbyScene();
    if (PROG.owns(cat, id)) { PROG.equip(cat, id); SND.sfx("pick"); X.toast(`Equipped ${PROG.item(cat, id).name}`); X.preview = null; }
    else {
      const p = PROG.priceOf(cat, id);
      if (!PROG.canAfford(cat, id)) { SND.sfx("error"); X.toast(`Previewing · need ${p.cur === "diamonds" ? "💎" : "🪙"} ${p.n} (play matches to earn more)`); }
      else if (confirm(`Buy ${PROG.item(cat, id).name} for ${p.cur === "diamonds" ? "💎" : "🪙"} ${p.n}?`)) {
        PROG.buy(cat, id); PROG.equip(cat, id); SND.sfx("buy"); X.toast(`🎉 Unlocked ${PROG.item(cat, id).name}!`); X.preview = null;
      }
    }
    X.refreshLobbyScene();
    renderStore();
  });

  // ------------------------------------------------------------ skills
  let passiveSlot = 0;
  function openSkills() { renderSkills(); X.show("skills"); }
  function renderSkills() {
    const d = PROG.data, e = d.equip;
    document.querySelectorAll(".sCoins").forEach(el => (el.textContent = d.coins.toLocaleString()));
    document.querySelectorAll(".sDia").forEach(el => (el.textContent = d.diamonds.toLocaleString()));
    const A = BR3.SKILLS[e.skill];
    $("skillSlots").innerHTML = `<div style="border-color:#a78bfa"><b>${A.icon}</b>ACTIVE<br>${esc(A.name)}</div>` +
      e.passives.map((p, i) => `<div data-slot="${i}" style="cursor:pointer;${passiveSlot === i ? "border-color:#facc15" : ""}"><b>${BR3.PASSIVES[p].icon}</b>PASSIVE ${i + 1}${passiveSlot === i ? " ✎" : ""}<br>${esc(BR3.PASSIVES[p].name)}</div>`).join("");
    const card = (cat, id, it, eq) => {
      const own = PROG.owns(cat, id);
      const extra = cat === "skill" ? ` · ⏱ ${it.cd}s` : "";
      return `<button class="sitem${eq ? " eq" : own ? " owned" : ""}" data-cat="${cat}" data-id="${id}"><div class="sw" style="background:#1e1b4b">${it.icon}</div><b>${esc(it.name)}</b><small>${esc(it.desc)}${extra}</small><span class="pr">${eq ? "✓ EQUIPPED" : own ? "OWNED · equip" : priceTag(cat, id)}</span></button>`;
    };
    $("activeGrid").innerHTML = Object.entries(BR3.SKILLS).map(([id, it]) => card("skill", id, it, e.skill === id)).join("");
    $("passiveGrid").innerHTML = Object.entries(BR3.PASSIVES).map(([id, it]) => card("passive", id, it, e.passives.includes(id))).join("");
  }
  $("skillSlots").addEventListener("click", e => { const b = e.target.closest("[data-slot]"); if (!b) return; passiveSlot = +b.dataset.slot; renderSkills(); });
  const onSkillPick = e => {
    const b = e.target.closest(".sitem");
    if (!b) return;
    SND.init();
    const cat = b.dataset.cat, id = b.dataset.id;
    if (!PROG.owns(cat, id)) {
      const p = PROG.priceOf(cat, id);
      if (!PROG.canAfford(cat, id)) { SND.sfx("error"); X.toast(`Need ${p.cur === "diamonds" ? "💎" : "🪙"} ${p.n}`); return; }
      if (!confirm(`Unlock ${PROG.item(cat, id).name} for ${p.cur === "diamonds" ? "💎" : "🪙"} ${p.n}?`)) return;
      PROG.buy(cat, id); SND.sfx("buy");
    }
    if (cat === "passive") {
      if (PROG.data.equip.passives.includes(id)) { X.toast("Already equipped"); return; }
      PROG.equip("passive", id, passiveSlot);
      passiveSlot = 1 - passiveSlot;
    } else PROG.equip("skill", id);
    SND.sfx("pick");
    renderSkills();
  };
  $("activeGrid").addEventListener("click", onSkillPick);
  $("passiveGrid").addEventListener("click", onSkillPick);

  // ------------------------------------------------------------ profile
  let profTab = "overview";
  function openProfile() { renderProfile(); X.show("profile"); }
  function renderProfile() {
    const d = PROG.data, s = d.stats, c = X.selected, e = d.equip;
    const br = PROG.rankOf(d.br.pts), cs = PROG.rankOf(d.cs.pts);
    document.querySelectorAll("#profTabs button").forEach(b => b.classList.toggle("on", b.dataset.p === profTab));
    const kd = (s.kills / Math.max(1, s.deaths)).toFixed(2), hs = s.kills ? Math.round((s.heads / Math.max(1, s.kills)) * 100) : 0;
    let body = "";
    if (profTab === "overview") body = `<div class="grid2">
        <div>Level<b>${d.level}</b></div><div>XP<b>${d.xp} / ${PROG.xpNeed(d.level)}</b></div>
        <div>BR matches<b>${s.matches}</b></div><div>Booyahs<b>${s.wins}</b></div>
        <div>CS matches<b>${s.csMatches}</b></div><div>CS wins<b>${s.csWins}</b></div>
        <div>Total kills<b>${s.kills + s.csKills}</b></div><div>Play time<b>${Math.round(s.timePlayed / 60)} min</b></div></div>`;
    else if (profTab === "br") body = `<div class="grid2">
        <div>Rank<b>${br.icon} ${br.label}</b></div><div>Rank points<b>${d.br.pts}</b></div>
        <div>Matches<b>${s.matches}</b></div><div>Booyah<b>${s.wins} (${s.matches ? Math.round((s.wins / s.matches) * 100) : 0}%)</b></div>
        <div>Top 10<b>${s.top10}</b></div><div>Best placement<b>${s.best ? "#" + s.best : "—"}</b></div>
        <div>K/D<b>${kd}</b></div><div>Headshot %<b>${hs}%</b></div>
        <div>Kills<b>${s.kills}</b></div><div>Avg damage<b>${s.matches ? Math.round(s.dmg / s.matches) : 0}</b></div></div>`;
    else if (profTab === "cs") body = `<div class="grid2">
        <div>CS rank<b>${cs.icon} ${cs.label}</b></div><div>Rank points<b>${d.cs.pts}</b></div>
        <div>Matches<b>${s.csMatches}</b></div><div>Wins<b>${s.csWins}</b></div>
        <div>Win rate<b>${s.csMatches ? Math.round((s.csWins / s.csMatches) * 100) : 0}%</b></div><div>Kills<b>${s.csKills}</b></div>
        <div>Rounds played<b>${s.csRounds}</b></div><div>Kills / match<b>${s.csMatches ? (s.csKills / s.csMatches).toFixed(1) : 0}</b></div></div>`;
    else body = d.history.length ? d.history.map(h => {
      const M = BR3.MODES[h.mode] || { name: h.mode, icon: "🎮" };
      const res = h.mode === "training" ? "Training" : h.score ? `${h.won ? "WIN" : "LOSS"} ${h.score}` : `#${h.placement}/${h.total}`;
      return `<div class="hist${h.won ? " win" : ""}"><span>${M.icon} ${esc(M.name)}</span><span>${res}</span><span>💀 ${h.kills} · 💥 ${h.dmg}</span><span>${new Date(h.t).toLocaleDateString()}</span></div>`;
    }).join("") : `<p class="tag">No matches yet. Hit START!</p>`;
    $("profBody").innerHTML = body;
    const pet = BR3.PETS[e.pet], ws = BR3.WSKINS[e.wskin];
    $("profCard").innerHTML = `
      <div class="pc-top"><img src="${BR.flagUrl(c.code)}" alt=""><div><b>${esc(d.name)} <button class="like" id="editName">✏️</button></b><small>UID: ${d.uid}</small><div>Lv.${d.level} · ${esc(c.name)}</div></div></div>
      <div>${esc(c.party)} · <i>“${esc(c.phrase)}”</i></div>
      <div class="pc-ranks">
        <div><span class="ic">${br.icon}</span>BR RANKED<br><b>${br.label}</b><div class="rp"><i style="width:${Math.round(br.progress * 100)}%"></i></div><small>${d.br.pts} RP</small></div>
        <div><span class="ic">${cs.icon}</span>CS RANKED<br><b>${cs.label}</b><div class="rp"><i style="width:${Math.round(cs.progress * 100)}%"></i></div><small>${d.cs.pts} RP</small></div>
      </div>
      <div class="pc-ranks"><div>${pet.icon}<br><small>Pet</small><br><b>${esc(pet.name)}</b></div><div>🔫<br><small>Weapon skin</small><br><b>${esc(ws.name)}</b></div><div>${BR3.SKILLS[e.skill].icon}<br><small>Skill</small><br><b>${esc(BR3.SKILLS[e.skill].name)}</b></div></div>
      <div style="display:flex;gap:6px;align-items:center"><button class="like" id="likeBtn">👍 ${d.likes}</button><span>🪙 ${d.coins.toLocaleString()} · 💎 ${d.diamonds}</span></div>`;
    $("likeBtn").onclick = () => { d.likes++; PROG.save(); SND.sfx("pick"); renderProfile(); };
    $("editName").onclick = () => { const n = prompt("New player name (max 16)", d.name); if (n && n.trim()) { d.name = n.trim().slice(0, 16); PROG.save(); renderProfile(); } };
  }
  $("profTabs").addEventListener("click", e => { const b = e.target.closest("[data-p]"); if (!b) return; SND.sfx("click"); profTab = b.dataset.p; renderProfile(); });

  // ------------------------------------------------------------ daily
  function openDaily() {
    const day = PROG.dailyDay(), avail = PROG.dailyAvailable();
    $("dailyGrid").innerHTML = PROG.dailyRewards.map((r, i) => {
      const cls = i < day || (!avail && i === day - 1) ? "done" : i === day && avail ? "today" : "";
      return `<div class="${cls}">Day ${i + 1}<b>${r.diamonds && !r.coins ? "💎" : r.diamonds ? "🎁" : "🪙"}</b>${r.coins ? `🪙 ${r.coins}` : ""}${r.coins && r.diamonds ? "<br>" : ""}${r.diamonds ? `💎 ${r.diamonds}` : ""}</div>`;
    }).join("");
    $("claimBtn").disabled = !avail;
    $("claimBtn").textContent = avail ? `CLAIM DAY ${day + 1}` : "Come back tomorrow ✓";
    X.show("daily");
  }
  click($("claimBtn"), () => {
    const r = PROG.claimDaily();
    if (!r) return;
    SND.sfx("booyah");
    X.toast(`🎁 Day ${r.day}: ${r.coins ? "🪙 +" + r.coins + " " : ""}${r.diamonds ? "💎 +" + r.diamonds : ""}`);
    openDaily();
  });
})();
