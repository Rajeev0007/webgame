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
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      A.apply();
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
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  const SFX = {
    hit:     () => tone(240, 0.05, "square", 0.025, 120),
    kill:    () => tone(620 + Math.random() * 120, 0.09, "triangle", 0.06, 300),
    hurt:    () => { tone(170, 0.22, "sawtooth", 0.1, 60); noise(0.12, 0.08, 900); },
    pickup:  () => tone(900 + Math.random() * 250, 0.05, "sine", 0.05, 1400),
    power:   () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.12, "triangle", 0.08, 0, i * 0.06)),
    special: () => { noise(0.45, 0.14, 1400); tone(110, 0.5, "square", 0.09, 440); },
    level:   () => [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.16, "sine", 0.08, 0, i * 0.07)),
    boss:    () => { tone(70, 1.2, "sawtooth", 0.16, 40); noise(1.0, 0.1, 300); },
    explode: () => { noise(0.4, 0.22, 700); tone(90, 0.3, "sine", 0.12, 40); },
    click:   () => tone(700, 0.035, "square", 0.04, 900),
    win:     () => [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone(f, 0.25, "triangle", 0.1, 0, i * 0.12)),
    lose:    () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.35, "sawtooth", 0.07, f * 0.97, i * 0.22)),
    charm:   () => [880, 1108, 1318].forEach((f, i) => tone(f, 0.3, "sine", 0.07, 0, i * 0.08)),
    dash:    () => noise(0.25, 0.15, 2500, 0, sfxGain, "highpass"),
    pulse:   () => { tone(180, 0.25, "sine", 0.12, 60); noise(0.15, 0.06, 500); },
    zap:     () => { tone(1400, 0.08, "sawtooth", 0.04, 300); noise(0.06, 0.05, 6000, 0, sfxGain, "highpass"); },
    horn:    () => { tone(330, 0.35, "square", 0.05); tone(415, 0.35, "square", 0.05); },
    combo:   () => [784, 988, 1175].forEach((f, i) => tone(f, 0.1, "square", 0.05, 0, i * 0.05)),
    buy:     () => [660, 880, 1320].forEach((f, i) => tone(f, 0.12, "triangle", 0.08, 0, i * 0.06)),
    achieve: () => [523, 784, 1046, 1568].forEach((f, i) => tone(f, 0.22, "triangle", 0.09, 0, i * 0.09)),
    tele:    () => tone(300, 0.2, "sine", 0.06, 1500),
    error:   () => tone(150, 0.15, "square", 0.05, 110),
    // ---- battle royale ----
    pistol:  () => { noise(0.12, 0.35, 2600); tone(180, 0.09, "square", 0.06, 70); },
    smg:     () => { noise(0.07, 0.25, 3200); tone(240, 0.05, "square", 0.04, 110); },
    ar:      () => { noise(0.14, 0.4, 2000); tone(130, 0.12, "sawtooth", 0.07, 50); },
    dmr:     () => { noise(0.22, 0.45, 1500); tone(110, 0.2, "sawtooth", 0.08, 40); },
    sniper:  () => { noise(0.45, 0.55, 1100); tone(80, 0.4, "sawtooth", 0.1, 30); noise(0.6, 0.12, 400, 0.08); },
    shotgun: () => { noise(0.3, 0.55, 1300); tone(90, 0.25, "sawtooth", 0.1, 35); },
    reload:  () => { tone(900, 0.03, "square", 0.05); tone(500, 0.04, "square", 0.05, 0, 0.18); tone(1200, 0.03, "square", 0.05, 0, 0.4); },
    empty:   () => tone(1500, 0.02, "square", 0.04),
    hitmark: () => tone(1800, 0.04, "square", 0.05, 1600),
    headshot:() => { tone(2400, 0.06, "square", 0.06, 2000); tone(3000, 0.08, "sine", 0.05, 0, 0.04); },
    knock:   () => [988, 1318, 1760].forEach((f, i) => tone(f, 0.08, "square", 0.06, 0, i * 0.05)),
    bullethit: () => noise(0.05, 0.12, 4000, 0, OUT, "highpass"),
    pick:    () => tone(700, 0.06, "triangle", 0.06, 1100),
    armor:   () => { noise(0.12, 0.12, 900); tone(300, 0.1, "triangle", 0.06, 500); },
    heal:    () => [523, 784].forEach((f, i) => tone(f, 0.15, "sine", 0.06, 0, i * 0.1)),
    zone:    () => [440, 440, 440].forEach((f, i) => tone(f, 0.18, "square", 0.05, 0, i * 0.3)),
    plane:   () => noise(1.5, 0.08, 180),
    wind:    () => noise(1.0, 0.07, 900, 0, OUT, "bandpass"),
    boom:    () => { noise(0.9, 0.6, 500); tone(60, 0.7, "sine", 0.2, 25); },
    pin:     () => tone(2200, 0.04, "square", 0.04, 1800),
    step:    () => noise(0.04, 0.05, 700),
    land:    () => { noise(0.15, 0.2, 400); tone(80, 0.12, "sine", 0.1, 40); },
    booyah:  () => [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => tone(f, 0.3, "triangle", 0.11, 0, i * 0.11)),
  };
  const last = {};
  // vol: 0..1 (e.g. quieter for far-away gunshots)
  A.sfx = (name, vol = 1) => {
    if (!ctx || A.settings.muted || !SFX[name] || vol <= 0.01) return;
    const now = ctx.currentTime;
    if (last[name] && now - last[name] < 0.03) return; // throttle spammy sounds
    last[name] = now;
    if (vol < 0.99) {
      const g = ctx.createGain();
      g.gain.value = vol;
      g.connect(sfxGain);
      OUT = g;
      SFX[name]();
      OUT = sfxGain;
      setTimeout(() => g.disconnect(), 2000);
    } else SFX[name]();
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
