// Sound effects + procedural music (WebAudio) and character voices (Web Speech API).
(() => {
  "use strict";
  const BR = (window.BR = window.BR || {});
  const A = (BR.Audio = {});

  A.settings = { sfx: 0.7, music: 0.5, voice: 0.9, muted: false };

  let ctx = null, master, sfxGain, musicGain, noiseBuf, OUT = null;

  A.init = () => {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.connect(ctx.destination);
      sfxGain = ctx.createGain();
      sfxGain.connect(master);
      musicGain = ctx.createGain();
      musicGain.connect(master);
      OUT = sfxGain;
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      A.apply();
      A.loadPack();
    }
    if (ctx.state === "suspended") ctx.resume();
  };

  A.apply = () => {
    if (ctx) {
      master.gain.value = A.settings.muted ? 0 : 1;
      sfxGain.gain.value = A.settings.sfx;
      musicGain.gain.value = A.settings.music * 0.45;
    }
    if (A.settings.muted && "speechSynthesis" in window) speechSynthesis.cancel();
  };

  // ---------- primitives ----------
  function tone(freq, dur, type, vol, endFreq, when = 0, dest = OUT) {
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, filterFreq, when = 0, dest = OUT, type = "lowpass") {
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random() * Math.max(0, 2.9 - dur));
    src.stop(t + dur + 0.05);
  }

  // ---------- layered battle-royale sounds ----------
  // gunshot = sharp crack (high noise) + body (band noise) + sub thump (sine drop) + mechanical click, with a reverb tail
  function gun(crack, body, sub, len, vol) {
    noise(0.035, 0.55 * vol, crack, 0, OUT, "highpass");
    noise(len, 0.7 * vol, body, 0, OUT, "lowpass");
    tone(sub, len * 0.9, "sine", 0.45 * vol, 32);
    tone(sub * 2.2, 0.05, "triangle", 0.18 * vol, sub);
    noise(len * 2.2, 0.16 * vol, body * 0.6, 0.02, OUT, "bandpass");
  }
  const SFX = {
    hit:     () => tone(240, 0.05, "square", 0.025, 120),
    kill:    () => tone(620 + Math.random() * 120, 0.09, "triangle", 0.06, 300),
    hurt:    () => { noise(0.09, 0.35, 900); tone(130, 0.18, "sine", 0.3, 55); noise(0.05, 0.2, 3500, 0, OUT, "highpass"); },
    pickup:  () => tone(900 + Math.random() * 250, 0.05, "sine", 0.05, 1400),
    power:   () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.12, "triangle", 0.08, 0, i * 0.06)),
    special: () => { noise(0.45, 0.14, 1400); tone(110, 0.5, "square", 0.09, 440); },
    level:   () => [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.16, "sine", 0.08, 0, i * 0.07)),
    boss:    () => { tone(70, 1.2, "sawtooth", 0.16, 40); noise(1.0, 0.1, 300); },
    explode: () => { noise(0.4, 0.22, 700); tone(90, 0.3, "sine", 0.12, 40); },
    click:   () => { tone(1100, 0.025, "square", 0.035, 1400); tone(2200, 0.015, "sine", 0.02); },
    win:     () => [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone(f, 0.25, "triangle", 0.1, 0, i * 0.12)),
    lose:    () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.35, "sawtooth", 0.07, f * 0.97, i * 0.22)),
    charm:   () => [880, 1108, 1318].forEach((f, i) => tone(f, 0.3, "sine", 0.07, 0, i * 0.08)),
    dash:    () => noise(0.25, 0.15, 2500, 0, OUT, "highpass"),
    pulse:   () => { tone(180, 0.25, "sine", 0.12, 60); noise(0.15, 0.06, 500); },
    zap:     () => { tone(1400, 0.08, "sawtooth", 0.04, 300); noise(0.06, 0.05, 6000, 0, OUT, "highpass"); },
    horn:    () => { tone(330, 0.35, "square", 0.05); tone(415, 0.35, "square", 0.05); },
    combo:   () => [784, 988, 1175].forEach((f, i) => tone(f, 0.1, "square", 0.05, 0, i * 0.05)),
    buy:     () => [660, 880, 1320].forEach((f, i) => tone(f, 0.12, "triangle", 0.08, 0, i * 0.06)),
    achieve: () => [523, 784, 1046, 1568].forEach((f, i) => tone(f, 0.22, "triangle", 0.09, 0, i * 0.09)),
    tele:    () => tone(300, 0.2, "sine", 0.06, 1500),
    error:   () => tone(150, 0.15, "square", 0.05, 110),
    pistol:  () => gun(5200, 2600, 150, 0.13, 0.85),
    smg:     () => gun(6000, 3200, 170, 0.08, 0.7),
    ar:      () => gun(4600, 1900, 110, 0.16, 1),
    dmr:     () => gun(4200, 1500, 95, 0.22, 1.05),
    sniper:  () => { gun(3800, 1100, 70, 0.4, 1.2); noise(0.9, 0.18, 380, 0.1, OUT, "lowpass"); },
    shotgun: () => { gun(3600, 1300, 80, 0.3, 1.25); noise(0.12, 0.3, 900, 0.01, OUT, "lowpass"); },
    reload:  () => { noise(0.03, 0.25, 3000, 0, OUT, "bandpass"); tone(420, 0.04, "square", 0.05, 300, 0.05); noise(0.04, 0.3, 2400, 0.42, OUT, "bandpass"); tone(900, 0.03, "square", 0.06, 700, 0.6); noise(0.05, 0.35, 1800, 0.62, OUT, "bandpass"); },
    empty:   () => { tone(1500, 0.02, "square", 0.05); noise(0.02, 0.15, 4000, 0, OUT, "highpass"); },
    hitmark: () => { tone(1900, 0.035, "square", 0.05, 1700); noise(0.02, 0.12, 5000, 0, OUT, "highpass"); },
    headshot:() => { tone(2600, 0.05, "square", 0.07, 2200); tone(3400, 0.09, "sine", 0.06, 0, 0.03); noise(0.03, 0.2, 6000, 0, OUT, "highpass"); },
    knock:   () => [988, 1318, 1760].forEach((f, i) => tone(f, 0.08, "square", 0.06, 0, i * 0.05)),
    bullethit: () => { noise(0.04, 0.22, 4500, 0, OUT, "highpass"); tone(2400 + Math.random() * 1500, 0.04, "sine", 0.03, 900); },
    pick:    () => { tone(700, 0.05, "triangle", 0.06, 1100); noise(0.03, 0.1, 2500, 0, OUT, "bandpass"); },
    armor:   () => { noise(0.12, 0.25, 900); tone(220, 0.1, "triangle", 0.08, 380); noise(0.05, 0.12, 3000, 0.06, OUT, "highpass"); },
    heal:    () => [523, 784, 1046].forEach((f, i) => tone(f, 0.15, "sine", 0.06, 0, i * 0.09)),
    zone:    () => [440, 554, 440].forEach((f, i) => tone(f, 0.22, "square", 0.05, 0, i * 0.3)),
    plane:   () => { noise(2.5, 0.12, 160); tone(55, 2.5, "sawtooth", 0.035, 52); },
    wind:    () => { noise(1.4, 0.16, 700, 0, OUT, "bandpass"); noise(1.4, 0.08, 2200, 0.2, OUT, "bandpass"); },
    boom:    () => { noise(0.06, 0.8, 3000, 0, OUT, "highpass"); noise(1.4, 0.9, 420); tone(55, 0.9, "sine", 0.55, 22); noise(2.2, 0.25, 220, 0.15, OUT, "lowpass"); },
    pin:     () => { tone(2200, 0.04, "square", 0.04, 1800); tone(1600, 0.05, "triangle", 0.03, 0, 0.08); },
    step:    () => { noise(0.05, 0.22, 650 + Math.random() * 300, 0, OUT, "lowpass"); noise(0.03, 0.06, 2800, 0.01, OUT, "bandpass"); },
    land:    () => { noise(0.18, 0.45, 380); tone(70, 0.16, "sine", 0.3, 38); },
    booyah:  () => [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => { tone(f, 0.35, "triangle", 0.11, 0, i * 0.11); tone(f / 2, 0.35, "sine", 0.06, 0, i * 0.11); }),
  };
  // sounds that get a big reverb tail (outdoor echo)
  const WET = { pistol: 0.35, smg: 0.3, ar: 0.45, dmr: 0.5, sniper: 0.7, shotgun: 0.5, boom: 0.8, hurt: 0.1, land: 0.15, step: 0.05, zone: 0.3 };

  // ---------- reverb (generated impulse response) ----------
  let reverb = null, revIn = null;
  function makeReverb() {
    const len = Math.floor(ctx.sampleRate * 2.2), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) { const t = i / len; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3.2) * (t < 0.01 ? t * 100 : 1); }
    }
    reverb = ctx.createConvolver(); reverb.buffer = ir;
    revIn = ctx.createGain(); revIn.gain.value = 1;
    const out = ctx.createGain(); out.gain.value = 0.55;
    revIn.connect(reverb).connect(out).connect(sfxGain);
  }

  // ---------- optional real sound files: assets/sounds/sounds.json -> { "ar": "ar.mp3", ... } ----------
  const SAMPLES = {};
  A.samplesLoaded = 0;
  A.loadPack = async (base = "assets/sounds/") => {
    if (!ctx || A.packTried) return;
    A.packTried = true;
    try {
      const res = await fetch(base + "sounds.json", { cache: "no-cache" });
      if (!res.ok) return;
      const map = await res.json();
      await Promise.all(Object.entries(map).map(async ([name, file]) => {
        if (!file || typeof file !== "string" || name.startsWith("_")) return;
        try {
          const r = await fetch(base + file);
          if (!r.ok) return;
          const buf = await r.arrayBuffer();
          SAMPLES[name] = await new Promise((ok, bad) => ctx.decodeAudioData(buf, ok, bad));
          A.samplesLoaded++;
        } catch (e) { /* skip bad file, keep synth sound */ }
      }));
    } catch (e) { /* no pack: use synthesized sounds */ }
  };

  const last = {};
  // vol: 0..1 (quieter + duller far away), pan: -1 (left) .. 1 (right)
  A.sfx = (name, vol = 1, pan = 0) => {
    if (!ctx || A.settings.muted || (!SFX[name] && !SAMPLES[name]) || vol <= 0.01) return;
    if (!reverb) makeReverb();
    const now = ctx.currentTime;
    if (last[name] && now - last[name] < 0.03) return; // throttle spammy sounds
    last[name] = now;
    const g = ctx.createGain();
    g.gain.value = Math.min(1.4, vol);
    let node = g;
    // distance: far sounds lose their highs
    if (vol < 0.75) { const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 900 + vol * 9000; g.connect(f); node = f; }
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); node.connect(p); node = p; }
    node.connect(sfxGain);
    const wet = WET[name] ? WET[name] * (1.25 - vol * 0.5) : 0;
    let wg = null;
    if (wet > 0) { wg = ctx.createGain(); wg.gain.value = wet * Math.min(1, vol + 0.3); node.connect(wg); wg.connect(revIn); }
    if (SAMPLES[name]) {
      const src = ctx.createBufferSource();
      src.buffer = SAMPLES[name];
      src.playbackRate.value = 0.96 + Math.random() * 0.08;
      src.connect(g); src.start();
    } else { OUT = g; SFX[name](); OUT = sfxGain; }
    setTimeout(() => { try { g.disconnect(); if (wg) wg.disconnect(); } catch (e) { /* ignore */ } }, 4000);
  };

  // ---------- procedural music ----------
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);
  const BASS = [45, 41, 43, 40];            // A2 F2 G2 E2
  const CHORDS = [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 56, 59]];
  const M = (A.music = { playing: false, intense: false, step: 0, next: 0, timer: null });

  function playStep(s, t) {
    const bar = Math.floor(s / 16) % 4;
    const w = t - ctx.currentTime;
    if (s % 4 === 0) {                         // kick
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g).connect(musicGain);
      o.start(t); o.stop(t + 0.2);
    }
    if (s % 8 === 4) noise(0.12, 0.18, 1800, w, musicGain, "bandpass");     // snare
    if (s % 2 === 1 || M.intense) noise(0.03, 0.06, 7000, w, musicGain, "highpass"); // hat
    if (s % 2 === 0) tone(midi(BASS[bar] + (s % 8 === 6 ? 12 : 0)), 0.18, "sawtooth", 0.09, 0, w, musicGain);
    const arpEvery = M.intense ? 1 : 2;
    if (s % arpEvery === 0) {
      const ch = CHORDS[bar];
      const n = ch[(s / arpEvery) % ch.length | 0] + 12;
      tone(midi(n), 0.12, M.intense ? "square" : "triangle", M.intense ? 0.035 : 0.04, 0, w, musicGain);
    }
  }
  function schedule() {
    const stepDur = 60 / (M.intense ? 150 : 122) / 4;
    while (M.next < ctx.currentTime + 0.15) {
      playStep(M.step, M.next);
      M.next += stepDur;
      M.step = (M.step + 1) % 64;
    }
  }
  M.start = () => {
    if (!ctx || M.playing) return;
    M.playing = true;
    M.next = ctx.currentTime + 0.05;
    M.timer = setInterval(schedule, 30);
  };
  M.stop = () => { M.playing = false; clearInterval(M.timer); };
  M.setIntense = v => { M.intense = !!v; };

  // ---------- voices ----------
  let voices = [];
  let lastSpeak = 0;
  const hasSpeech = "speechSynthesis" in window;
  if (hasSpeech) {
    const load = () => { voices = speechSynthesis.getVoices(); };
    load();
    speechSynthesis.addEventListener?.("voiceschanged", load);
  }
  function pickVoice(lang) {
    if (!voices.length) return null;
    const l = lang.toLowerCase();
    const norm = v => v.lang.toLowerCase().replace("_", "-");
    return voices.find(v => norm(v) === l) || voices.find(v => norm(v).startsWith(l.split("-")[0])) || null;
  }
  A.hasVoice = lang => !!pickVoice(lang);
  A.speak = (text, opts = {}) => {
    if (!hasSpeech || A.settings.muted || A.settings.voice <= 0) return;
    const now = performance.now();
    if (!opts.force && now - lastSpeak < 2500) return;
    lastSpeak = now;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const lang = opts.lang || "en-US";
    const v = pickVoice(lang) || (opts.fallbackEnglish !== false ? pickVoice("en-US") : null);
    if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = lang; }
    u.pitch = opts.pitch ?? 1;
    u.rate = opts.rate ?? 1;
    u.volume = A.settings.voice;
    speechSynthesis.speak(u);
  };
  A.stopVoice = () => { if (hasSpeech) speechSynthesis.cancel(); };
})();
