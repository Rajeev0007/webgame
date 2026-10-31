// Brainrot Royale input: keyboard + mouse (pointer lock), touch (move stick, look drag, buttons), gamepad.
(() => {
  "use strict";
  const BR3 = window.BR3;
  const I = (BR3.Input = {
    mode: matchMedia && matchMedia("(pointer: coarse)").matches ? "touch" : "desktop",
    keys: {}, mouseDown: false, aimHeld: false, look: { dx: 0, dy: 0 },
    stick: { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 },
    lookTouch: { id: null, x: 0, y: 0 },
    fireTouch: { id: null, x: 0, y: 0 },
    btn: {},            // held on-screen buttons
    pad: null, padPrev: [],
    sens: 1, invertY: false,
  });
  const handlers = {};
  I.on = (n, f) => (handlers[n] = handlers[n] || []).push(f);
  const emit = (n, ...a) => (handlers[n] || []).forEach(f => f(...a));
  I.emit = emit;
  const STICK_R = 60;
  I.STICK_R = STICK_R;

  function setMode(m) {
    if (I.mode === m) return;
    I.mode = m;
    document.body.classList.remove("in-desktop", "in-touch", "in-gamepad");
    document.body.classList.add("in-" + m);
    emit("mode", m);
  }
  I.setMode = setMode;
  document.body.classList.add("in-" + I.mode);

  // ---------------- keyboard + mouse
  const typing = t => t && (t.tagName === "INPUT" && t.type !== "range" && t.type !== "checkbox");
  addEventListener("keydown", e => {
    if (typing(e.target)) return;
    setMode("desktop");
    I.keys[e.code] = true;
    if (["Space", "ArrowUp", "ArrowDown", "Tab"].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    const map = {
      KeyR: "reload", KeyE: "interact", KeyF: "interact", KeyC: "crouch", ControlLeft: "crouch", Space: "jump",
      Digit1: "slot0", Digit2: "slot1", Digit3: "slot2", KeyX: "holster", KeyG: "grenade", KeyH: "heal", Digit4: "heal",
      KeyM: "map", Tab: "score", KeyP: "pause", Escape: "escape", KeyB: "drink",
      KeyQ: "skill", KeyT: "gloo", KeyZ: "emote", KeyY: "shop",
    };
    if (map[e.code]) emit(map[e.code], "key");
  });
  addEventListener("keyup", e => { I.keys[e.code] = false; if (e.code === "Tab") emit("scoreUp"); });
  I.clear = () => {
    for (const k in I.keys) I.keys[k] = false;
    I.mouseDown = false; I.aimHeld = false; I.stick.active = false; I.lookTouch.id = null; I.fireTouch.id = null;
    for (const k in I.btn) I.btn[k] = false;
  };
  addEventListener("blur", I.clear);

  I.attach = canvas => {
    I.canvas = canvas;
    canvas.addEventListener("mousedown", e => {
      setMode("desktop");
      if (I.mode === "desktop" && document.pointerLockElement !== canvas) { emit("wantLock"); return; }
      if (e.button === 0) I.mouseDown = true;
      if (e.button === 2) { I.aimHeld = true; emit("aimDown"); }
    });
    addEventListener("mouseup", e => { if (e.button === 0) I.mouseDown = false; if (e.button === 2) { I.aimHeld = false; emit("aimUp"); } });
    canvas.addEventListener("contextmenu", e => e.preventDefault());
    addEventListener("mousemove", e => {
      if (document.pointerLockElement === canvas) {
        I.look.dx += e.movementX * 0.0022 * I.sens;
        I.look.dy += e.movementY * 0.0022 * I.sens * (I.invertY ? -1 : 1);
      }
    });
    addEventListener("wheel", e => { if (document.pointerLockElement === canvas) emit("cycle", e.deltaY > 0 ? 1 : -1); }, { passive: true });

    // ---------------- touch on the 3D view: left half = move stick, right half = look
    canvas.addEventListener("touchstart", e => {
      e.preventDefault();
      setMode("touch");
      for (const t of e.changedTouches) {
        if (t.clientX < innerWidth * 0.42 && !I.stick.active) {
          Object.assign(I.stick, { active: true, id: t.identifier, ox: t.clientX, oy: t.clientY, x: t.clientX, y: t.clientY });
        } else if (I.lookTouch.id === null) {
          Object.assign(I.lookTouch, { id: t.identifier, x: t.clientX, y: t.clientY });
        }
      }
    }, { passive: false });
    canvas.addEventListener("touchmove", e => {
      e.preventDefault();
      for (const t of e.changedTouches) moveTouch(t);
    }, { passive: false });
    const end = e => { for (const t of e.changedTouches) endTouch(t); };
    canvas.addEventListener("touchend", end);
    canvas.addEventListener("touchcancel", end);
  };
  function moveTouch(t) {
    if (I.stick.active && t.identifier === I.stick.id) {
      I.stick.x = t.clientX; I.stick.y = t.clientY;
      const dx = I.stick.x - I.stick.ox, dy = I.stick.y - I.stick.oy, d = Math.hypot(dx, dy);
      if (d > STICK_R * 1.5) { I.stick.ox = I.stick.x - (dx / d) * STICK_R * 1.5; I.stick.oy = I.stick.y - (dy / d) * STICK_R * 1.5; }
    }
    for (const L of [I.lookTouch, I.fireTouch]) {
      if (L.id === t.identifier) {
        I.look.dx += (t.clientX - L.x) * 0.0058 * I.sens;
        I.look.dy += (t.clientY - L.y) * 0.0058 * I.sens * (I.invertY ? -1 : 1);
        L.x = t.clientX; L.y = t.clientY;
      }
    }
  }
  function endTouch(t) {
    if (I.stick.id === t.identifier) { I.stick.active = false; I.stick.id = null; }
    if (I.lookTouch.id === t.identifier) I.lookTouch.id = null;
    if (I.fireTouch.id === t.identifier) { I.fireTouch.id = null; I.btn.fire = false; }
  }
  // global listeners so dragging from an on-screen button (fire) also turns the camera, Free Fire style
  addEventListener("touchmove", e => { for (const t of e.changedTouches) if (t.identifier === I.fireTouch.id) moveTouch(t); }, { passive: true });
  addEventListener("touchend", e => { for (const t of e.changedTouches) endTouch(t); });
  addEventListener("touchcancel", e => { for (const t of e.changedTouches) endTouch(t); });

  // on-screen buttons: data-btn="fire|aim|jump|crouch|reload|interact|heal|grenade|map|..."
  I.bindButtons = root => {
    root.querySelectorAll("[data-btn]").forEach(el => {
      const name = el.dataset.btn;
      el.addEventListener("touchstart", e => {
        e.preventDefault(); e.stopPropagation();
        setMode("touch");
        const t = e.changedTouches[0];
        I.btn[name] = true;
        el.classList.add("down");
        if (name === "fire" || name === "fire2") { Object.assign(I.fireTouch, { id: t.identifier, x: t.clientX, y: t.clientY }); I.btn.fire = true; }
        emit(name, "touch");
      }, { passive: false });
      const up = e => { I.btn[name] = false; el.classList.remove("down"); if (name === "fire" || name === "fire2") I.btn.fire = false; emit(name + "Up"); };
      el.addEventListener("touchend", up);
      el.addEventListener("touchcancel", up);
      // mouse fallback (desktop testing / hybrid devices)
      el.addEventListener("mousedown", e => { e.preventDefault(); e.stopPropagation(); I.btn[name] = true; el.classList.add("down"); if (name === "fire2") I.btn.fire = true; emit(name, "mouse"); });
      el.addEventListener("mouseup", e => { I.btn[name] = false; el.classList.remove("down"); if (name === "fire2") I.btn.fire = false; emit(name + "Up"); });
      el.addEventListener("mouseleave", () => { if (I.btn[name]) { I.btn[name] = false; el.classList.remove("down"); if (name === "fire2") I.btn.fire = false; } });
    });
  };

  // ---------------- gamepad
  addEventListener("gamepadconnected", () => emit("toast", "🎮 Controller connected"));
  I.poll = dt => {
    const pads = navigator.getGamepads ? [...navigator.getGamepads()] : [];
    const gp = pads.find(p => p && p.connected);
    if (!gp) { I.pad = null; return; }
    const dz = v => (Math.abs(v) < 0.16 ? 0 : v);
    const ax = gp.axes, b = gp.buttons.map(x => x.pressed || x.value > 0.4);
    I.pad = { lx: dz(ax[0] || 0), ly: dz(ax[1] || 0), rx: dz(ax[2] || 0), ry: dz(ax[3] || 0), b, gp };
    if (b.some(Boolean) || Math.abs(I.pad.lx) + Math.abs(I.pad.ly) + Math.abs(I.pad.rx) + Math.abs(I.pad.ry) > 0.4) setMode("gamepad");
    const rs = 2.6 * I.sens * dt;
    I.look.dx += I.pad.rx * Math.abs(I.pad.rx) * rs;
    I.look.dy += I.pad.ry * Math.abs(I.pad.ry) * rs * (I.invertY ? -1 : 1);
    const edge = i => b[i] && !I.padPrev[i];
    if (edge(0)) emit("jump", "pad");
    if (edge(1)) emit("crouch", "pad");
    if (edge(2)) emit("reload", "pad"), emit("interact", "pad");
    if (edge(3)) emit("cycle", 1);
    if (edge(4)) emit("grenade", "pad");
    if (edge(5)) emit("heal", "pad");
    if (edge(6)) emit("aimDown");
    if (!b[6] && I.padPrev[6]) emit("aimUp");
    if (edge(8)) emit("map", "pad");
    if (edge(9)) emit("pause", "pad");
    if (edge(12)) emit("slot0"); if (edge(13)) emit("slot1");
    if (edge(14)) emit("skill", "pad"); if (edge(15)) emit("gloo", "pad");
    I.padPrev = b;
  };

  // ---------------- queries
  I.move = () => {
    let x = 0, y = 0;
    const k = I.keys;
    if (k.KeyA || k.ArrowLeft) x -= 1;
    if (k.KeyD || k.ArrowRight) x += 1;
    if (k.KeyW || k.ArrowUp) y += 1;
    if (k.KeyS || k.ArrowDown) y -= 1;
    if (I.stick.active) {
      const dx = I.stick.x - I.stick.ox, dy = I.stick.y - I.stick.oy, d = Math.hypot(dx, dy);
      if (d > 8) { const m = Math.min(1, d / STICK_R); x = (dx / d) * m; y = (-dy / d) * m; }
    }
    if (I.pad && (I.pad.lx || I.pad.ly)) { x = I.pad.lx; y = -I.pad.ly; }
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return { x, y };
  };
  I.firing = () => I.mouseDown || I.btn.fire || (I.pad && I.pad.b[7]);
  // held "use" (revive a teammate): E/F key, the on-screen revive/pick button, or controller X
  I.holdUse = () => I.keys.KeyE || I.keys.KeyF || I.btn.interact || I.btn.revive || (I.pad && I.pad.b[2]);
  I.aiming = () => I.aimHeld || (I.pad && I.pad.b[6]);
  I.sprint = () => I.keys.ShiftLeft || I.keys.ShiftRight || (I.pad && I.pad.b[10]) || (I.stick.active && Math.hypot(I.stick.x - I.stick.ox, I.stick.y - I.stick.oy) > STICK_R * 1.25);
  I.takeLook = () => { const l = { dx: I.look.dx, dy: I.look.dy }; I.look.dx = I.look.dy = 0; return l; };
})();
