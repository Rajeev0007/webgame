// Unified input: keyboard, mouse, touch (virtual joysticks) and gamepads.
(() => {
  "use strict";
  const BR = (window.BR = window.BR || {});
  const IN = (BR.Input = {
    keys: {},
    mode: "desktop",                 // desktop | touch | gamepad
    mouse: { x: 0, y: 0, known: false },
    joy: { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 },      // movement stick (left side)
    aimJoy: { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 },   // aim stick (right side, manual aim)
    pad: null,
    manualAimTouch: false,
    toLogical: (x, y) => ({ x, y }),
  });
  const JOY_R = 55;
  // resting spot of the on-screen joystick (bottom-left, above the safe area)
  IN.joyHome = { x: 100, y: window.innerHeight - 130 };
  const placeHome = () => { IN.joyHome.x = 100; IN.joyHome.y = window.innerHeight - 130; };
  window.addEventListener("resize", placeHome);

  // ---------- tiny event bus ----------
  const handlers = {};
  IN.on = (name, fn) => (handlers[name] = handlers[name] || []).push(fn);
  const emit = (name, ...a) => (handlers[name] || []).forEach(fn => fn(...a));

  IN.setMode = m => {
    if (IN.mode === m) return;
    IN.mode = m;
    document.body.classList.remove("mode-desktop", "mode-touch", "mode-gamepad");
    document.body.classList.add("mode-" + m);
    emit("mode", m);
  };
  document.body.classList.add("mode-desktop");
  if (window.matchMedia && matchMedia("(pointer: coarse)").matches) IN.setMode("touch");

  const isTyping = el => el && (el.tagName === "INPUT" && el.type !== "range" && el.type !== "checkbox" || el.tagName === "TEXTAREA");
  const isRange = el => el && el.tagName === "INPUT" && el.type === "range";

  // ---------- keyboard ----------
  const ARROWS = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
  window.addEventListener("keydown", e => {
    const typing = isTyping(e.target);
    if (typing && e.code !== "Escape") return;
    IN.setMode("desktop");
    IN.keys[e.code] = true;

    if (ARROWS[e.code]) {
      const dir = ARROWS[e.code];
      // left/right on a slider adjusts it natively
      if (!(isRange(document.activeElement) && (dir === "left" || dir === "right"))) emit("nav", dir, "key");
    }
    if (e.repeat) return;
    if (e.code === "Space" || e.code === "KeyE" || e.code === "KeyK") emit("special", "key", e);
    if (e.code === "KeyP" || e.code === "Escape") emit("pause");
    if (e.code === "KeyM") emit("mute");
    if (e.code === "KeyF") emit("fullscreen");
    if (e.code === "KeyR") emit("reroll");
    if (e.code === "ShiftLeft" || e.code === "ShiftRight" || e.code === "KeyQ" || e.code === "KeyL") emit("dash");
    if (e.code === "Digit1" || e.code === "Digit2" || e.code === "Digit3") emit("choose", Number(e.code.slice(-1)) - 1);
    if (e.code === "Enter" && !(document.activeElement && document.activeElement.tagName === "BUTTON")) emit("confirm");
  });
  window.addEventListener("keyup", e => { IN.keys[e.code] = false; });
  IN.clearKeys = () => { for (const k in IN.keys) IN.keys[k] = false; IN.joy.active = IN.aimJoy.active = false; };

  // ---------- mouse ----------
  let lastMouse = null;
  window.addEventListener("mousemove", e => {
    IN.mouse.x = e.clientX; IN.mouse.y = e.clientY; IN.mouse.known = true;
    if (lastMouse && Math.hypot(e.clientX - lastMouse.x, e.clientY - lastMouse.y) > 4) IN.setMode("desktop");
    lastMouse = { x: e.clientX, y: e.clientY };
  });

  // ---------- touch ----------
  IN.attachCanvas = canvas => {
    canvas.addEventListener("contextmenu", e => e.preventDefault());
    canvas.addEventListener("mousedown", e => { if (e.button === 2) emit("special", "mouse"); });

    canvas.addEventListener("touchstart", e => {
      e.preventDefault();
      IN.setMode("touch");
      emit("touch");
      for (const t of e.changedTouches) {
        const left = t.clientX < window.innerWidth * 0.5;
        const stick = left || !IN.manualAimTouch ? IN.joy : IN.aimJoy;
        if (stick.active) continue;
        // touching near the visible joystick grabs it in place; touching elsewhere makes a floating stick
        const h = IN.joyHome;
        const fixed = stick === IN.joy && Math.hypot(t.clientX - h.x, t.clientY - h.y) < JOY_R * 2.2;
        const ox = fixed ? h.x : t.clientX, oy = fixed ? h.y : t.clientY;
        Object.assign(stick, { active: true, fixed, id: t.identifier, ox, oy, x: t.clientX, y: t.clientY });
      }
    }, { passive: false });
    canvas.addEventListener("touchmove", e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        for (const s of [IN.joy, IN.aimJoy]) {
          if (s.active && s.id === t.identifier) {
            s.x = t.clientX; s.y = t.clientY;
            // floating stick: drag the base along if the finger goes far
            const dx = s.x - s.ox, dy = s.y - s.oy, d = Math.hypot(dx, dy);
            if (!s.fixed && d > JOY_R * 1.6) { s.ox = s.x - dx / d * JOY_R * 1.6; s.oy = s.y - dy / d * JOY_R * 1.6; }
          }
        }
      }
    }, { passive: false });
    const end = e => {
      for (const t of e.changedTouches) for (const s of [IN.joy, IN.aimJoy]) if (s.id === t.identifier) { s.active = false; s.id = null; }
    };
    canvas.addEventListener("touchend", end);
    canvas.addEventListener("touchcancel", end);
  };
  // stop iOS pinch/double-tap zoom
  document.addEventListener("gesturestart", e => e.preventDefault());
  document.addEventListener("dblclick", e => e.preventDefault());

  // ---------- gamepad ----------
  let prevButtons = [];
  let navHeld = null, navT = 0;
  window.addEventListener("gamepadconnected", e => emit("gamepad", true, e.gamepad.id));
  window.addEventListener("gamepaddisconnected", e => emit("gamepad", false, e.gamepad.id));

  IN.poll = () => {
    const pads = navigator.getGamepads ? [...navigator.getGamepads()] : [];
    const gp = pads.find(g => g && g.connected);
    if (!gp) { IN.pad = null; return; }
    const dz = v => (Math.abs(v) < 0.18 ? 0 : v);
    const ax = gp.axes;
    const b = gp.buttons.map(x => x.pressed || x.value > 0.5);
    let lx = dz(ax[0] || 0), ly = dz(ax[1] || 0);
    if (b[14]) lx = -1; if (b[15]) lx = 1; if (b[12]) ly = -1; if (b[13]) ly = 1;
    IN.pad = { lx, ly, rx: dz(ax[2] || 0), ry: dz(ax[3] || 0), gp };

    const edge = i => b[i] && !prevButtons[i];
    if (b.some(Boolean) || Math.abs(lx) + Math.abs(ly) + Math.abs(IN.pad.rx) + Math.abs(IN.pad.ry) > 0.5) IN.setMode("gamepad");

    // special first: it only acts while playing, so confirming a menu/upgrade never also fires it
    if (edge(0)) { emit("special", "pad-a"); emit("confirm", "pad"); }
    if (edge(1)) { emit("back"); emit("dash"); }
    if (edge(3)) emit("reroll");
    if (edge(5) || edge(7) || edge(2)) emit("special", "pad");
    if (edge(4) || edge(6)) emit("dash");
    if (edge(9) || edge(8)) emit("pause");

    // menu navigation with stick / d-pad (with key-repeat style timing)
    let dir = null;
    if (Math.abs(lx) > 0.55 || Math.abs(ly) > 0.55) dir = Math.abs(lx) > Math.abs(ly) ? (lx > 0 ? "right" : "left") : (ly > 0 ? "down" : "up");
    const now = performance.now();
    if (dir && (dir !== navHeld || now > navT)) {
      emit("nav", dir, "pad");
      navT = now + (dir !== navHeld ? 320 : 130);
    }
    navHeld = dir;
    prevButtons = b;
  };

  IN.rumble = (ms = 120, strong = 0.6) => {
    const gp = IN.pad && IN.pad.gp;
    if (gp && gp.vibrationActuator && gp.vibrationActuator.playEffect) {
      gp.vibrationActuator.playEffect("dual-rumble", { duration: ms, strongMagnitude: strong, weakMagnitude: strong / 2 }).catch(() => {});
    }
  };

  // ---------- queries used by the game ----------
  IN.getMove = () => {
    let x = 0, y = 0;
    const k = IN.keys;
    if (k.ArrowLeft || k.KeyA) x -= 1;
    if (k.ArrowRight || k.KeyD) x += 1;
    if (k.ArrowUp || k.KeyW) y -= 1;
    if (k.ArrowDown || k.KeyS) y += 1;
    if (IN.joy.active) {
      const dx = IN.joy.x - IN.joy.ox, dy = IN.joy.y - IN.joy.oy, d = Math.hypot(dx, dy);
      if (d > 6) { const m = Math.min(1, d / JOY_R); x = dx / d * m; y = dy / d * m; }
    }
    if (IN.pad && (IN.pad.lx || IN.pad.ly)) { x = IN.pad.lx; y = IN.pad.ly; }
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return { x, y };
  };

  // Returns an aim angle or null (null = use auto-aim)
  IN.getAim = (px, py, manualMouse) => {
    if (IN.pad && Math.hypot(IN.pad.rx, IN.pad.ry) > 0.35) return Math.atan2(IN.pad.ry, IN.pad.rx);
    if (IN.aimJoy.active) {
      const dx = IN.aimJoy.x - IN.aimJoy.ox, dy = IN.aimJoy.y - IN.aimJoy.oy;
      if (Math.hypot(dx, dy) > 10) return Math.atan2(dy, dx);
    }
    if (manualMouse && IN.mode === "desktop" && IN.mouse.known) {
      const m = IN.toLogical(IN.mouse.x, IN.mouse.y);
      return Math.atan2(m.y - py, m.x - px);
    }
    return null;
  };

  IN.JOY_R = JOY_R;
})();
