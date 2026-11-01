// Brainrot Royale custom icon set: hand-drawn SVG glyphs (24x24) in a game-HUD style.
// Every emoji the game uses (HUD, buttons, menus, feed, toasts) is swapped for one of these at runtime,
// including text written later by JS (a MutationObserver converts new text). Icons with no emoji
// equivalent use Private Use Area characters (BR3.IC.*) so they also work inside plain strings.
(() => {
  "use strict";
  const BR3 = (window.BR3 = window.BR3 || {});
  const S = (d, w = 2.2) => `<path d="${d}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const F = (d, c, extra = "") => `<path d="${d}"${c ? ` fill="${c}"` : ""}${extra}/>`;
  const SHADE = c => `fill="#000" fill-opacity="${c || 0.3}"`;
  const circ = (cx, cy, r, c) => `<circle cx="${cx}" cy="${cy}" r="${r}"${c ? ` fill="${c}"` : ""}/>`;
  const person = `${circ(12, 4, 2.6)}${F("M9 8h6l1 7h-2.2l-.6 7h-2.4l-.6-7H8z")}`;
  const medal = (c, d) => `${F("M7 2h4l2 6H9zM13 2h4l-2 6h-4z", "#ef4444")}${circ(12, 15, 7, c)}${circ(12, 15, 4.6, d)}${F("M12 11.6l1 2.1 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.3z", c)}`;
  const ammo = c => `${F("M7 9.5c0-3 1.2-5 2.5-6.5C10.8 4.5 12 6.5 12 9.5V20H7z", c)}${F("M12 9.5c0-3 1.2-5 2.5-6.5C15.8 4.5 17 6.5 17 9.5V20h-5z", c, ' fill-opacity=".8"')}${F("M6.5 20h11v2h-11z", "#b45309")}`;
  const rifle = c => F("M1 10.2 4 8.6h5.2V7.6h2v1h8.3V7.4H21v1.8h2.2v2.2h-6.4l-.8 1.4h-3.2l1.2 5.6h-2.7l-1.6-5.3H9.4l-1.7 3.1H4.9l1-3.1H1z", c);
  const R = {
    // ---------------------------------------------------------------- HUD + controls
    players: `${circ(9, 7, 3.6)}${F("M2 20.5c0-4 3-7.3 7-7.3s7 3.3 7 7.3z")}<g opacity=".65">${circ(17, 7.8, 2.9)}${F("M15.2 13.4c4 .1 6.8 3.2 6.8 7.1h-4.6c0-2.7-.8-5.1-2.2-7.1z")}</g>`,
    skull: F("M12 2C7 2 3.5 5.6 3.5 10.2c0 2.8 1.3 4.8 3 5.9V19a1 1 0 0 0 1 1h1.6v-2.2h1.6V20h2.6v-2.2h1.6V20h1.6a1 1 0 0 0 1-1v-2.9c1.7-1.1 3-3.1 3-5.9C20.5 5.6 17 2 12 2zM8.6 9.2a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2zm6.8 0a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2zM12 13.6l-1.3 2.3h2.6z", null, ' fill-rule="evenodd"'),
    hourglass: F("M6 2h12v2.2h-1v2.3c0 2-1.4 3.6-3.3 4.5 1.9.9 3.3 2.5 3.3 4.5v2.3h1V20H6v-2.2h1v-2.3c0-2 1.4-3.6 3.3-4.5C8.4 10.1 7 8.5 7 6.5V4.2H6zm3 2.2v2.3c0 1 .7 2 1.8 2.6l1.2.7 1.2-.7C14.3 8.5 15 7.5 15 6.5V4.2z", null, ' fill-rule="evenodd"'),
    stopwatch: `${S("M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4.5l2.8 1.8M9.5 2h5M19 5.5l1.5-1.5")}`,
    zone: `${S("M12 21.5a9.5 9.5 0 1 0 0-19 9.5 9.5 0 0 0 0 19z", 2)}${S("M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z", 2)}${circ(12, 12, 1.6)}`,
    blood: F("M12 2.5S5.5 10 5.5 14.6a6.5 6.5 0 0 0 13 0C18.5 10 12 2.5 12 2.5z", "#ef4444"),
    warn: F("M12 2 1 21.5h22zM10.8 9h2.4v6.4h-2.4zm0 8.2h2.4v2.3h-2.4z", "#fbbf24", ' fill-rule="evenodd"'),
    vest: `${F("M8 2h2.3c.4 1.6 1 2.5 1.7 2.5S13.3 3.6 13.7 2H16l4 3.2V20a1 1 0 0 1-1 1h-5.3v-7.2h-3.4V21H5a1 1 0 0 1-1-1V5.2z")}${F("M6 9h4v2H6zm8 0h4v2h-4z", null, ` ${SHADE()}`)}`,
    helmet: `${F("M3 15.5a9 9 0 0 1 18 0v.8H3z")}${F("M1.5 17.5h21v1.8a.7.7 0 0 1-.7.7H2.2a.7.7 0 0 1-.7-.7z")}${F("M7 10h10v2H7z", null, ` ${SHADE(0.25)}`)}`,
    bandage: `<g transform="rotate(-45 12 12)"><rect x="1" y="8" width="22" height="8" rx="4" fill="#f3c48e"/><rect x="8.4" y="8" width="7.2" height="8" fill="#fde9cf"/><g fill="#c98b4f">${circ(4.5, 12, 0.8)}${circ(19.5, 12, 0.8)}</g></g>`,
    medkit: `${F("M9 3h6a1 1 0 0 1 1 1v2h4a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4V4a1 1 0 0 1 1-1zm1.2 1.8V6h3.6V4.8z", "#f8fafc", ' fill-rule="evenodd"')}${F("M10.8 9.2h2.4v2.7h2.7v2.4h-2.7V17h-2.4v-2.7H8.1v-2.4h2.7z", "#ef4444")}`,
    plus: F("M9.5 3h5v6.5H21v5h-6.5V21h-5v-6.5H3v-5h6.5z", "#4ade80"),
    drink: `${F("M7.2 5.6 8.2 3h7.6l1 2.6z", "#cbd5e1")}${F("M6.5 6.8h11L16.6 20a2 2 0 0 1-2 1.9H9.4a2 2 0 0 1-2-1.9z", "#22c55e")}${F("M13.2 9 9.8 13.8h2.3l-1 4.4 3.4-5h-2.3z", "#f8fafc")}`,
    grenade: `${circ(11, 14.2, 7)}${F("M8.8 4h5v3.4h-5z")}${S("M13.8 5.2h3.4A2.6 2.6 0 0 1 19.8 7.8V10", 1.8)}<path d="M5.2 12.2h11.6M5.2 16.2h11.6M11 7.6v13.4" stroke="#000" stroke-opacity=".3" stroke-width="1.3"/>`,
    gloo: `${F("M2.5 21V12a9.5 9.5 0 0 1 19 0v9z", "#bae6fd")}<path d="M2.5 15.5h19M2.5 11h19M8 21v-5.5M16 21v-5.5M12 15.5V11M6.5 11V7.2M17.5 11V7.2M12 6.8V2.6" stroke="#0369a1" stroke-opacity=".55" stroke-width="1.3" fill="none"/>`,
    list: `${F("M3 4h18v3.2H3zm0 6.4h18v3.2H3zm0 6.4h18V20H3z")}${F("M3 4h3v3.2H3zm0 6.4h3v3.2H3zm0 6.4h3V20H3z", "#facc15")}`,
    cart: `${S("M2 3h3l2.6 11.2a1.6 1.6 0 0 0 1.6 1.2h8.4a1.6 1.6 0 0 0 1.5-1.1L21.2 7H6.2")}${circ(9.5, 19.6, 1.9)}${circ(17.5, 19.6, 1.9)}`,
    smile: F("M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM8.5 7.6a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2zm7 0a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2zM6.6 13.4h10.8a5.4 5.4 0 0 1-10.8 0z", "#facc15", ' fill-rule="evenodd"'),
    chat: `${F("M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-8l-5 4.5V17H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z")}<g ${SHADE(0.35)}>${circ(8, 10, 1.4)}${circ(12, 10, 1.4)}${circ(16, 10, 1.4)}</g>`,
    map: `${F("M2 5.6 8 3l8 3 6-2.6v15L16 21l-8-3-6 2.6z")}<path d="M8 3v15M16 6v15" stroke="#000" stroke-opacity=".3" stroke-width="1.4"/>${F("M11 9.5a1.8 1.8 0 1 1 3.6 0c0 1.4-1.8 3.4-1.8 3.4S11 10.9 11 9.5z", "#ef4444")}`,
    pause: `<rect x="5.5" y="4" width="4.6" height="16" rx="1.2"/><rect x="13.9" y="4" width="4.6" height="16" rx="1.2"/>`,
    bullet: `${F("M12 1.5c2.3 1.8 3.4 4.3 3.4 7.4V16H8.6V8.9c0-3.1 1.1-5.6 3.4-7.4z", "#fcd34d")}${F("M8 17.2h8v5H8z", "#d97706")}`,
    scope: `${S("M12 19.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15zM12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5", 2.2)}${circ(12, 12, 1.7, "#ef4444")}`,
    jump: `${circ(12, 9.6, 2.4)}${F("M9.6 13h4.8l.7 4.4h-1.9l-.5 4.1h-1.4l-.5-4.1H8.9z")}${F("M12 1.2l4 4.3h-8z", "#facc15")}`,
    stand: person,
    crouch: `${circ(11, 7.2, 2.6)}${F("M8.4 10.7h5.2l1.5 4.3H18v3h-4.7l-1.1-2.3-1.7 4.3H7.8l1.7-5.4z")}${F("M2 21h20v1.5H2z", null, ' fill-opacity=".55"')}`,
    prone: `${circ(4.6, 14.8, 2.4)}${F("M8 13.4h12.6a1.5 1.5 0 0 1 0 3H8z")}${F("M15 16.4h3l1 2h-3z")}${F("M2 20h20v1.5H2z", null, ' fill-opacity=".55"')}`,
    leanL: `<g transform="rotate(-24 12 22)">${person}</g>${F("M20 2h2.5v20H20z", null, ' fill-opacity=".45"')}`,
    leanR: `<g transform="rotate(24 12 22)">${person}</g>${F("M1.5 2H4v20H1.5z", null, ' fill-opacity=".45"')}`,
    vault: `${F("M12.5 14.5h9.5V22h-9.5z", "#d97706")}${S("M2.5 19C4 10.5 9.5 7 16.5 9", 2.4)}${F("M15 5.5l5 3.8-5.4 2.6z")}`,
    sprint: S("M4 5l7 7-7 7M12 5l7 7-7 7", 2.8),
    reload: `${S("M19.8 12.8A8 8 0 1 1 17.4 6.2", 2.8)}${F("M21.4 2.8v7.4H14z")}`,
    hand: F("M8 11.2V4.6a1.5 1.5 0 0 1 3 0V10h.6V3a1.5 1.5 0 0 1 3 0v7h.6V4.6a1.5 1.5 0 0 1 3 0V14c0 4.4-2.9 8-7.2 8-2.6 0-4.4-1.3-5.7-3.4l-2.8-5a1.5 1.5 0 0 1 2.5-1.7L8 15z", "#fcd9b6"),
    parachute: `${F("M2 11a10 9 0 0 1 20 0c-1.7-1.2-3.3-1.2-5 0-1.7-1.2-3.3-1.2-5 0-1.7-1.2-3.3-1.2-5 0-1.7-1.2-3.3-1.2-5 0z", "#f97316")}<path d="M2.4 11.4l8.2 7.8M21.6 11.4l-8.2 7.8M7 11.2l4 7.8M17 11.2l-4 7.8" stroke="currentColor" stroke-width="1.2" fill="none"/><rect x="10" y="18.6" width="4" height="4" rx="1"/>`,
    heart: F("M12 21s-8.6-5.2-8.6-11.2A4.8 4.8 0 0 1 12 6.6a4.8 4.8 0 0 1 8.6 3.2C20.6 15.8 12 21 12 21z", "#4ade80"),
    question: `${S("M8.6 8.8a3.5 3.5 0 1 1 5.1 3.1c-1.1.6-1.7 1.4-1.7 2.8", 2.8)}${circ(12, 19.2, 1.7)}`,
    swap: S("M4 8h15l-4-4M20 16H5l4 4", 2.4),
    fist: `${F("M5.5 8A2.5 2.5 0 0 1 8 5.5h8.5A3.5 3.5 0 0 1 20 9v6a6 6 0 0 1-6 6h-3a5.5 5.5 0 0 1-5.5-5.5z", "#fcd9b6")}<path d="M10 5.8v4.4M14 5.8v4.4M5.6 11h8.6" stroke="#b47a4c" stroke-width="1.3"/>`,
    gun: rifle(),
    blast: F("M12 1l2.2 6.3L20.5 4l-2.9 6 5.4 2-5.6 2 3 6.5-6.4-3.4L12 23l-2-5.9-6.5 3.4 3-6.5L1 12l5.5-2-3-6 6.4 3.3z", "#fb923c"),
    crown: F("M2.5 7.5 7 12l5-7.2 5 7.2 4.5-4.5L20 18.2H4zM4 19.6h16V22H4z", "#facc15"),
    flame: `${F("M12 2c1 3.6 5.6 5.6 5.6 11.1a5.6 5.6 0 0 1-11.2 0c0-2.6 1.3-4.5 2.6-5.7.1 1.8.8 3.1 2 3.7C10.6 8.1 11 5.1 12 2z", "#f97316")}${F("M12 13.2c1.2 1.4 2.4 2.4 2.4 4.2a2.4 2.4 0 0 1-4.8 0c0-1.6.9-2.6 2.4-4.2z", "#fde047")}`,
    knock: F("M3 5h18l-9 15z", "#ef4444"),
    top: `${F("M12 3l8 8.5h-5V21H9v-9.5H4z", "#facc15")}`,
    globe: S("M12 21.5a9.5 9.5 0 1 0 0-19 9.5 9.5 0 0 0 0 19zM12 2.5c-2.5 2.6-3.8 5.8-3.8 9.5s1.3 6.9 3.8 9.5c2.5-2.6 3.8-5.8 3.8-9.5S14.5 5.1 12 2.5zM2.5 12h19", 1.8),
    door: F("M5 2h14v20H5zm9.8 9.2a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6z", null, ' fill-rule="evenodd"'),
    coin: `${circ(12, 12, 10, "#f59e0b")}${circ(12, 12, 7.4, "#fcd34d")}${F("M10.7 7.2h2.6v9.6h-2.6z", "#d97706")}`,
    gem: `${F("M6.5 3h11L22 9l-10 12L2 9z", "#38bdf8")}${F("M2 9h20L12 21z", "#0284c7")}${F("M8.6 9 12 3l3.4 6L12 21z", "#7dd3fc")}`,
    plat: `${F("M12 2l9 10-9 10-9-10z", "#a5b4fc")}${F("M12 6.5 17 12l-5 5.5L7 12z", "#e0e7ff")}`,
    star: F("M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 16.9 5.9 20.4l1.5-6.8L2.2 9l6.9-.7z", "#facc15"),
    trophy: F("M7 3h10v2h3.5v2.5a4.6 4.6 0 0 1-4.3 4.6A5 5 0 0 1 13.2 15v3H16v3H8v-3h2.8v-3a5 5 0 0 1-3-2.9A4.6 4.6 0 0 1 3.5 7.5V5H7zM5.4 7v.5c0 1.2.8 2.2 1.8 2.5A8 8 0 0 1 7 7zm13.2 0H17a8 8 0 0 1-.2 3 2.6 2.6 0 0 0 1.8-2.5z", "#facc15"),
    medal: medal("#facc15", "#fde68a"),
    gold: medal("#facc15", "#fde68a"),
    silver: medal("#cbd5e1", "#f1f5f9"),
    bronze: medal("#d97706", "#fbbf24"),
    gift: `${F("M3 8h18v4.2H3zM4.5 13.2h15V21h-15z", "#f472b6")}${F("M10.9 8h2.2v13h-2.2z", "#fde047")}${S("M12 8C10 4.2 6.6 4 6.6 6s2.4 2 5.4 2c3 0 5.4 0 5.4-2S14 4.2 12 8z", 1.8)}`,
    shirt: F("M8 3 2 6.6l2.5 4.6L7 10.2V21h10V10.2l2.5 1L22 6.6 16 3c-.6 1.6-2.2 2.5-4 2.5S8.6 4.6 8 3z"),
    paw: `<ellipse cx="12" cy="16.2" rx="5" ry="4.5"/><ellipse cx="5.8" cy="10" rx="2" ry="2.6"/><ellipse cx="9.8" cy="6.2" rx="2" ry="2.6"/><ellipse cx="14.2" cy="6.2" rx="2" ry="2.6"/><ellipse cx="18.2" cy="10" rx="2" ry="2.6"/>`,
    gamepad: F("M7 6h10a5 5 0 0 1 5 5v4.5a3.5 3.5 0 0 1-6.3 2.1L14.5 16h-5l-1.2 1.6A3.5 3.5 0 0 1 2 15.5V11a5 5 0 0 1 5-5zm0 3.2V11H5.2v2H7v1.8h2V13h1.8v-2H9V9.2zm9.5.2a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zm-2 2.8a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6z", null, ' fill-rule="evenodd"'),
    eye: F("M12 5C6.5 5 2.7 9 1.5 12c1.2 3 5 7 10.5 7s9.3-4 10.5-7C21.3 9 17.5 5 12 5zm0 3.4a3.6 3.6 0 1 1 0 7.2 3.6 3.6 0 0 1 0-7.2z", null, ' fill-rule="evenodd"'),
    lock: `${S("M7.2 10.5V7.6a4.8 4.8 0 0 1 9.6 0v2.9", 2.4)}<rect x="4" y="10.2" width="16" height="11.8" rx="2.2" fill="#facc15"/>`,
    check: S("M4 12.5l5 5L20 6.5", 3.2),
    close: S("M5.5 5.5l13 13M18.5 5.5l-13 13", 3.2),
    gear: `${S("M12 17.2a5.2 5.2 0 1 0 0-10.4 5.2 5.2 0 0 0 0 10.4z", 3.6)}<g>${[0, 45, 90, 135, 180, 225, 270, 315].map(a => `<rect x="10.3" y="1.2" width="3.4" height="4.6" rx=".9" transform="rotate(${a} 12 12)"/>`).join("")}</g>`,
    play: F("M7 4.5v15l12-7.5z"),
    back: S("M20 12H5M11 5l-7 7 7 7", 2.8),
    next: S("M4 12h15M13 5l7 7-7 7", 2.8),
    caret: F("M9 6l7 6-7 6z"),
    up: F("M12 3l8 9h-5v9H9v-9H4z", "#4ade80"),
    edit: `${F("M15.4 3.6l5 5L9 20H4v-5z")}${F("M13.4 5.6l5 5", null, ' stroke="#000" stroke-opacity=".3" stroke-width="1.4"')}`,
    home: F("M12 3 2 11.6h3V21h5.5v-6h3v6H19v-9.4h3z"),
    plane: F("M22 12c0-1-.8-1.6-1.8-1.6h-5.3L10 2.5H7.6l2.6 7.9H5.2L3.3 8H1.5l1.2 4-1.2 4h1.8l1.9-2.4h5l-2.6 7.9H10l4.9-7.9h5.3c1 0 1.8-.6 1.8-1.6z"),
    bolt: F("M13.6 1.5 4 13.6h6.6L9.4 22.5 20 9.4h-6.6z", "#facc15"),
    shield: `${F("M12 2 4 5v6.5c0 5 3.4 9 8 10.5 4.6-1.5 8-5.5 8-10.5V5z", "#60a5fa")}${F("M12 2v20c4.6-1.5 8-5.5 8-10.5V5z", "#3b82f6")}`,
    plate: `${F("M12 2 4 5v6.5c0 5 3.4 9 8 10.5 4.6-1.5 8-5.5 8-10.5V5z", "#94a3b8")}<path d="M6 9h12M6 13h12M7.5 17h9" stroke="#334155" stroke-width="1.5"/>`,
    radar: `${S("M4.9 19.1A10 10 0 1 1 19.1 19.1M8.1 15.9a5.5 5.5 0 1 1 7.8 0", 2)}${circ(12, 12, 2)}${S("M12 12l5.5-5.5", 2)}`,
    dome: `${F("M1.5 21V14a10.5 10.5 0 0 1 21 0v7z", "#bae6fd")}${F("M6 21v-6a6 6 0 0 1 12 0v6z", "#38bdf8")}`,
    syringe: `<g transform="rotate(45 12 12)">${F("M9.5 6h5v12h-5z", "#e2e8f0")}${F("M9.5 11h5v7h-5z", "#ef4444")}${F("M11.3 18h1.4v4.5h-1.4zM8 4h8v2H8zM11 1.5h2V4h-2z")}</g>`,
    shoe: F("M2 16.5c0-2 .8-4 1.5-6L6 11c1.6.8 3.2 1 4.5.2L12 9l2.5 2.8c2.2 1.5 5 1.6 7.5 2.4v2.3H2zM2 18h20v2.5H2z"),
    backpack: `${F("M9 2h6v3H9z")}${F("M6 6.5A3.5 3.5 0 0 1 9.5 3h5A3.5 3.5 0 0 1 18 6.5V20a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z", "#d97706")}${F("M8.5 13h7v5h-7z", null, ` ${SHADE()}`)}`,
    ban: `${S("M12 21.5a9.5 9.5 0 1 0 0-19 9.5 9.5 0 0 0 0 19zM5.3 5.3l13.4 13.4", 2.6)}`,
    thumb: F("M2 10h4v11H2zM7.5 10.5 11.8 3c1.6 0 2.7 1.3 2.4 2.9L13.6 9H20a2 2 0 0 1 2 2.3l-1.4 8A2 2 0 0 1 18.6 21H7.5z"),
    speaker: `${F("M3 9h4l5-4.5v15L7 15H3z")}${S("M15.5 8.5a5 5 0 0 1 0 7M18.2 5.8a8.8 8.8 0 0 1 0 12.4", 2)}`,
    monitor: `<rect x="2" y="3.5" width="20" height="13" rx="2"/>${F("M9 18h6l1 3H8z")}`,
    phone: `<rect x="6" y="1.5" width="12" height="21" rx="2.5"/>${F("M10 19h4v1.4h-4z", null, ` ${SHADE(0.4)}`)}`,
    vibrate: `<rect x="7" y="3" width="10" height="18" rx="2"/>${S("M3.5 8v8M20.5 8v8", 2)}`,
    chart: F("M3 13h4v8H3zM10 8h4v13h-4zM17 3h4v18h-4z"),
    tag: F("M2 3.5A1.5 1.5 0 0 1 3.5 2H11l11 11-9 9L2 11zM7 5.6a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z", null, ' fill-rule="evenodd"'),
    music: F("M9 4.5 21 2v13.2a3 3 0 1 1-2-2.8V6.3l-8 1.7v9.2a3 3 0 1 1-2-2.8z"),
    magnet: `${S("M5 3v8a7 7 0 0 0 14 0V3", 4.2)}${F("M2.9 2h4.2v3.5H2.9zM16.9 2h4.2v3.5h-4.2z", "#ef4444")}`,
    search: S("M10.5 17.5a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM15.6 15.6 21 21", 2.6),
    idcard: `<rect x="1.5" y="4" width="21" height="16" rx="2.5"/><g ${SHADE(0.35)}>${circ(8, 11, 2.5)}${F("M4 17c.4-2 2-3.2 4-3.2s3.6 1.2 4 3.2zM14 9h6v1.8h-6zm0 3.6h6v1.8h-6z")}</g>`,
    user: `${circ(12, 7.5, 4.5)}${F("M3 21.5c0-4.6 4-8.2 9-8.2s9 3.6 9 8.2z")}`,
    water: S("M2 8c2.5-2 5-2 7.5 0s5 2 7.5 0 3.7-1.5 5 0M2 14c2.5-2 5-2 7.5 0s5 2 7.5 0 3.7-1.5 5 0M2 20c2.5-2 5-2 7.5 0s5 2 7.5 0 3.7-1.5 5 0", 2),
    keyboard: `<rect x="1.5" y="5.5" width="21" height="13" rx="2"/><g ${SHADE(0.4)}>${F("M4.5 8.5h2v2h-2zm4 0h2v2h-2zm4 0h2v2h-2zm4 0h2v2h-2zM6.5 12.5h2v2h-2zm4 0h2v2h-2zm4 0h2v2h-2zM7 15.5h10v1.5H7z")}</g>`,
    flag: `${F("M4 2h2v20H4z")}${F("M6 3h13l-3 4.5L19 12H6z")}`,
    dot: circ(12, 12, 6.5, "#22c55e"),
    pin: F("M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 4.4a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2z", "#ef4444", ' fill-rule="evenodd"'),
    swords: `${S("M4 4l11 11M20 4 9 15", 2.6)}${S("M13 17l4-4M11 17l-4-4M15.5 15.5l4.5 4.5M8.5 15.5 4 20", 2.6)}`,
    cap: `${F("M3.5 15a8.5 8.5 0 0 1 17 0z")}${F("M12 15h10.5v2.6H12z", null, ' fill-opacity=".75"')}`,
    shades: `${F("M2 8h20v2.2l-1 .5-.6 4.3a2.6 2.6 0 0 1-2.6 2.2h-2.6a2.6 2.6 0 0 1-2.5-1.9L12 13l-.7 2.3a2.6 2.6 0 0 1-2.5 1.9H6.2a2.6 2.6 0 0 1-2.6-2.2L3 10.7l-1-.5z")}`,
    mask: `${F("M3 9c3-2 15-2 18 0v3.5c0 3.6-4 7.5-9 7.5s-9-3.9-9-7.5z")}${F("M6.5 10.5h4l-.8 2.2H7.2zm7 0h4l-.7 2.2h-2.5z", "#ef4444")}`,
    // ammo (colored by type)
    ammoL: ammo("#facc15"), ammoH: ammo("#fb923c"), ammoS: ammo("#ef4444"), ammoN: ammo("#60a5fa"),
    // guns
    pistol: F("M3 6.5h15.6l1 1v2.7h-2.2v1.2h-6.6l-1.3 1.2-1 6.4H4.7l1.7-7.6L3 10z"),
    smg: F("M2.5 9.2h3.2V8h12.2v1.5h3.4v2.2h-3.8l-.7 1.1h-2.3l1.1 5.2h-2.5l-1.3-5.2H9.4l-1.3 3.1H5.4l.9-3.1H2.5z"),
    shotgun: `${F("M1 10.6 5 9h17v1.4h1.2V12H10.5l-.8 1.2H7.2L6.4 16.2H3.6l.9-3.6H1z")}${F("M12.6 12.4h6.6v2h-6.6z", null, ' fill-opacity=".8"')}`,
    rifle: rifle(),
    golden: rifle("#facc15"),
    sniper: `${F("M1 11.2l3-1.6h19.2v2.2h-9.4l-.6 1h-2.8l1.1 4.6h-2.5l-1.2-4.6H6.5L5 15.4H2.6l.9-2.6H1z")}${F("M7.6 6.6h8v2.3h-8zM10.6 8.8h1.6v1h-1.6z")}`,
    dmr: `${F("M1 11.2l3-1.6h17.5v2.2h-7.7l-.6 1h-2.8l1.1 4.6h-2.5l-1.2-4.6H6.5L5 15.4H2.6l.9-2.6H1z")}${F("M8.2 7.2h6v2h-6zM15 12.2h2.4v3.6H15z")}`,
    // pets
    panda: `${circ(5.2, 5.6, 3, "#111")}${circ(18.8, 5.6, 3, "#111")}${circ(12, 13, 8.6, "#f8fafc")}<ellipse cx="8.6" cy="12.4" rx="2.3" ry="2.9" fill="#111"/><ellipse cx="15.4" cy="12.4" rx="2.3" ry="2.9" fill="#111"/>${circ(8.9, 12, 0.8, "#fff")}${circ(15.1, 12, 0.8, "#fff")}<ellipse cx="12" cy="16.6" rx="1.7" ry="1.1" fill="#111"/>`,
    dog: `<ellipse cx="4.6" cy="10" rx="2.8" ry="5.5" fill="#6b4423" transform="rotate(18 4.6 10)"/><ellipse cx="19.4" cy="10" rx="2.8" ry="5.5" fill="#6b4423" transform="rotate(-18 19.4 10)"/>${circ(12, 12, 7.6, "#c58b45")}<ellipse cx="12" cy="16" rx="4" ry="3.2" fill="#f1d3a6"/>${circ(9, 10.6, 1.2, "#111")}${circ(15, 10.6, 1.2, "#111")}<ellipse cx="12" cy="14.6" rx="1.7" ry="1.2" fill="#111"/>`,
    fox: `${F("M2 3l6 4h8l6-4-1.5 9.5L12 21 3.5 12.5z", "#ea6a1a")}${F("M5 12.5 12 21l7-8.5-4 1-3 2.5-3-2.5z", "#fff7ed")}${circ(8.6, 10.6, 1.2, "#111")}${circ(15.4, 10.6, 1.2, "#111")}${circ(12, 19.4, 1.2, "#111")}`,
    owl: `${F("M4 3l4 3h8l4-3v11a8 8 0 0 1-16 0z", "#8b5a2b")}${circ(8.6, 10.5, 3.2, "#fde68a")}${circ(15.4, 10.5, 3.2, "#fde68a")}${circ(8.6, 10.5, 1.4, "#111")}${circ(15.4, 10.5, 1.4, "#111")}${F("M12 13l1.6 2.2L12 17l-1.6-1.8z", "#f59e0b")}`,
    penguin: `<ellipse cx="12" cy="13" rx="8" ry="9" fill="#1f2430"/><ellipse cx="12" cy="15" rx="5.4" ry="6.6" fill="#f8fafc"/>${circ(9.4, 9.6, 1.1, "#fff")}${circ(14.6, 9.6, 1.1, "#fff")}${F("M10 12h4l-2 2.4z", "#f97316")}`,
    robot: `<rect x="11" y="1" width="2" height="4" fill="#94a3b8"/>${circ(12, 1.8, 1.6, "#ef4444")}<rect x="3.5" y="5" width="17" height="14" rx="3.5" fill="#b8c2d0"/><rect x="6" y="8.5" width="12" height="5" rx="2.5" fill="#0f172a"/>${circ(9.2, 11, 1.3, "#22d3ee")}${circ(14.8, 11, 1.3, "#22d3ee")}<rect x="8" y="15.5" width="8" height="1.6" rx=".8" fill="#64748b"/>`,
  };

  // emoji -> icon key (variation selectors are ignored)
  const EMOJI = {
    "👥": "players", "💀": "skull", "⏳": "hourglass", "⏱": "stopwatch", "🌀": "zone", "🩸": "blood", "⚠": "warn", "🆘": "warn",
    "🦺": "vest", "⛑": "helmet", "🩹": "bandage", "🧰": "medkit", "🩺": "plus", "➕": "plus", "🥤": "drink", "💣": "grenade", "🧊": "gloo",
    "📋": "list", "🛒": "cart", "😀": "smile", "😂": "smile", "💬": "chat", "🗺": "map", "⏸": "pause", "🔥": "flame", "🎯": "scope",
    "⤒": "jump", "⤓": "crouch", "↻": "reload", "🤲": "reload", "✋": "hand", "👋": "hand", "🪂": "parachute", "💚": "heart", "❓": "question", "❔": "question",
    "⇄": "swap", "👊": "fist", "🔫": "gun", "💥": "blast", "👑": "crown", "🔻": "knock", "🔝": "top", "🌐": "globe", "🌍": "globe", "🚪": "door",
    "🪙": "coin", "💎": "gem", "💠": "plat", "⭐": "star", "🎉": "star", "🙌": "star", "🏆": "trophy", "🏅": "medal", "🥇": "gold", "🥈": "silver", "🥉": "bronze",
    "🎖": "medal", "🫡": "medal", "🎁": "gift", "👕": "shirt", "🧥": "shirt", "🐾": "paw", "🎮": "gamepad", "🕹": "gamepad", "👁": "eye", "🔒": "lock",
    "✓": "check", "✕": "close", "⚙": "gear", "▶": "play", "▸": "caret", "◀": "back", "←": "back", "→": "next", "➡": "next", "⬆": "up",
    "✏": "edit", "✎": "edit", "⌂": "home", "✈": "plane", "⚡": "bolt", "🛡": "shield", "🦏": "plate", "📡": "radar", "🏰": "dome", "💉": "syringe",
    "👟": "shoe", "🎒": "backpack", "🚫": "ban", "👍": "thumb", "🤝": "thumb", "💃": "music", "🎵": "music", "🔊": "speaker", "🗣": "speaker",
    "🖥": "monitor", "📱": "phone", "📳": "vibrate", "📊": "chart", "🏷": "tag", "🧲": "magnet", "🔍": "search", "🪪": "idcard", "🦸": "user",
    "🌊": "water", "⌨": "keyboard", "🏳": "flag", "📍": "pin", "🟢": "dot", "⚔": "swords", "🧢": "cap", "🤠": "cap", "🕶": "shades", "🥷": "mask",
    "🟡": "ammoL", "🟠": "ammoH", "🔴": "ammoS", "🔵": "ammoN",
    "🐼": "panda", "🐶": "dog", "🦊": "fox", "🦉": "owl", "🐧": "penguin", "🤖": "robot", "↕": "swap",
  };
  // icons with no emoji: Private Use Area characters usable in any string
  const PUA = { bullet: "\uE001", stand: "\uE002", prone: "\uE004", leanL: "\uE005", leanR: "\uE006", vault: "\uE007", sprint: "\uE008", jump: "\uE009", crouch: "\uE00A",
    pistol: "\uE010", smg: "\uE011", shotgun: "\uE012", rifle: "\uE013", sniper: "\uE014", dmr: "\uE015", golden: "\uE016" };
  BR3.IC = PUA;
  for (const k in PUA) EMOJI[PUA[k]] = k;

  // ---------------------------------------------------------------- sprite + helpers
  const NS = "http://www.w3.org/2000/svg";
  const sprite = `<svg xmlns="${NS}" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true"><defs>${Object.entries(R).map(([k, v]) => `<symbol id="i-${k}" viewBox="0 0 24 24">${v}</symbol>`).join("")}</defs></svg>`;
  BR3.icon = (key, cls = "") => `<svg class="ico${cls ? " " + cls : ""}" aria-hidden="true"><use href="#i-${key}"/></svg>`;
  BR3.ICONS = R;
  const keys = Object.keys(EMOJI).sort((a, b) => b.length - a.length);
  const RE = new RegExp(`(${keys.join("|")})\\uFE0F?`, "gu");
  const SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, OPTION: 1, svg: 1, use: 1 };
  function mkIcon(key) {
    const s = document.createElementNS(NS, "svg");
    s.setAttribute("class", "ico");
    s.setAttribute("aria-hidden", "true");
    const u = document.createElementNS(NS, "use");
    u.setAttribute("href", "#i-" + key);
    s.appendChild(u);
    return s;
  }
  function convertText(node) {
    const t = node.data;
    RE.lastIndex = 0;
    if (!RE.test(t)) return;
    const p = node.parentNode;
    if (!p || SKIP[p.nodeName]) return;
    RE.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let last = 0, m;
    while ((m = RE.exec(t))) {
      if (m.index > last) frag.appendChild(document.createTextNode(t.slice(last, m.index)));
      frag.appendChild(mkIcon(EMOJI[m[1]]));
      last = m.index + m[0].length;
    }
    if (last < t.length) frag.appendChild(document.createTextNode(t.slice(last)));
    p.replaceChild(frag, node);
  }
  function iconize(root) {
    if (!root) return;
    if (root.nodeType === 3) return convertText(root);
    if (root.nodeType !== 1 || SKIP[root.nodeName]) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), list = [];
    let n;
    while ((n = w.nextNode())) list.push(n);
    for (const t of list) convertText(t);
  }
  BR3.iconize = iconize;
  // strip icons for places that can't show SVG (canvas text, <title>, prompts)
  BR3.plain = s => String(s).replace(RE, "").replace(/\s{2,}/g, " ").trim();

  function boot() {
    document.body.insertAdjacentHTML("afterbegin", sprite);
    iconize(document.body);
    new MutationObserver(muts => {
      for (const m of muts) {
        if (m.type === "characterData") convertText(m.target);
        else for (const n of m.addedNodes) iconize(n);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (document.body) boot(); else document.addEventListener("DOMContentLoaded", boot);
})();
