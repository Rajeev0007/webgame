// Brainrot Royale online server. Zero dependencies (Node 18+).
// - Serves the game files (so one deploy = game + multiplayer)
// - WebSocket endpoint at /ws with rooms, Free-for-all and Team Deathmatch, server-validated damage
//   Run:  node server/server.js        (PORT env var supported, default 8080)
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT) || 8080;
const MAX_PLAYERS = 16;
const TICK_MS = 50;                 // 20 snapshots per second
const RESPAWN_MS = 3000;
const MATCH = { ffa: { kills: 25, secs: 360 }, tdm: { kills: 40, secs: 420 } };
const MAX_HIT = 260;                // biggest single hit we accept (sniper headshot)
const MAX_DPS = 900;                // damage budget per attacker per second
const MAX_RANGE = 360;

// ------------------------------------------------------------------ static files
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "application/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".jpg": "image/jpeg", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav", ".glb": "model/gltf-binary", ".ico": "image/x-icon" };
const server = http.createServer((req, res) => {
  let url = decodeURIComponent((req.url || "/").split("?")[0]);
  if (url === "/health") { res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify({ ok: true, rooms: rooms.size, players: [...rooms.values()].reduce((s, r) => s + r.players.size, 0) })); }
  if (url.endsWith("/")) url += "index.html";
  const file = path.normalize(path.join(ROOT, url));
  if (!file.startsWith(ROOT) || file.includes(`${path.sep}.`) || file.startsWith(path.join(ROOT, "server"))) { res.writeHead(403); return res.end("forbidden"); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream", "cache-control": "no-cache" });
    res.end(data);
  });
});

// ------------------------------------------------------------------ minimal WebSocket (RFC 6455)
function wsAccept(req, socket) {
  const key = req.headers["sec-websocket-key"];
  if (!key || (req.headers.upgrade || "").toLowerCase() !== "websocket") { socket.destroy(); return null; }
  const acc = crypto.createHash("sha1").update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${acc}\r\n\r\n`);
  socket.setNoDelay(true);
  const ws = { socket, open: true, buf: Buffer.alloc(0), onmsg: null, onclose: null, frag: [] };
  ws.send = str => {
    if (!ws.open) return;
    const data = Buffer.from(str);
    let head;
    if (data.length < 126) head = Buffer.from([0x81, data.length]);
    else if (data.length < 65536) { head = Buffer.alloc(4); head[0] = 0x81; head[1] = 126; head.writeUInt16BE(data.length, 2); }
    else { head = Buffer.alloc(10); head[0] = 0x81; head[1] = 127; head.writeBigUInt64BE(BigInt(data.length), 2); }
    try { socket.write(Buffer.concat([head, data])); } catch (e) { /* closed */ }
  };
  ws.close = () => {
    if (!ws.open) return;
    ws.open = false;
    try { socket.end(Buffer.from([0x88, 0])); } catch (e) { /* ignore */ }
    if (ws.onclose) ws.onclose();
  };
  socket.on("data", chunk => {
    ws.buf = Buffer.concat([ws.buf, chunk]);
    if (ws.buf.length > 1 << 20) return ws.close(); // 1 MB guard
    while (ws.buf.length >= 2) {
      const b0 = ws.buf[0], b1 = ws.buf[1], op = b0 & 0x0f, fin = b0 & 0x80, masked = b1 & 0x80;
      let len = b1 & 0x7f, off = 2;
      if (len === 126) { if (ws.buf.length < 4) return; len = ws.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (ws.buf.length < 10) return; len = Number(ws.buf.readBigUInt64BE(2)); off = 10; }
      if (len > 1 << 16) return ws.close();
      const need = off + (masked ? 4 : 0) + len;
      if (ws.buf.length < need) return;
      let payload = ws.buf.subarray(off + (masked ? 4 : 0), need);
      if (masked) { const m = ws.buf.subarray(off, off + 4); payload = Buffer.from(payload); for (let i = 0; i < payload.length; i++) payload[i] ^= m[i & 3]; }
      ws.buf = ws.buf.subarray(need);
      if (op === 0x8) return ws.close();
      if (op === 0x9) { try { socket.write(Buffer.concat([Buffer.from([0x8a, payload.length]), payload])); } catch (e) { /* ignore */ } continue; }
      if (op === 0x1 || op === 0x0) {
        ws.frag.push(payload);
        if (fin) { const msg = Buffer.concat(ws.frag).toString("utf8"); ws.frag = []; if (ws.onmsg) ws.onmsg(msg); }
      }
    }
  });
  socket.on("close", () => { if (ws.open) { ws.open = false; if (ws.onclose) ws.onclose(); } });
  socket.on("error", () => socket.destroy());
  return ws;
}

// ------------------------------------------------------------------ game rooms
const rooms = new Map();
let nextId = 1;
const clean = (s, n) => String(s || "").replace(/[<>&"'`\\]/g, "").slice(0, n);
const num = (v, d = 0) => (typeof v === "number" && isFinite(v) ? v : d);

function makeRoom(name, mode, priv) {
  const r = { name, mode: mode === "tdm" ? "tdm" : "ffa", priv, seed: (Math.random() * 1e9) | 0, town: (Math.random() * 8) | 0, players: new Map(), startT: Date.now(), state: "play", endT: 0, teamKills: [0, 0] };
  rooms.set(name, r);
  return r;
}
function pickRoom(mode, code) {
  if (code) {
    const key = "p:" + clean(code, 8).toUpperCase();
    return rooms.get(key) || makeRoom(key, mode, true);
  }
  for (const r of rooms.values()) if (!r.priv && r.mode === mode && r.players.size < MAX_PLAYERS) return r;
  return makeRoom("q:" + Math.random().toString(36).slice(2, 8), mode, false);
}
function bcast(r, obj, except) { const s = JSON.stringify(obj); for (const p of r.players.values()) if (p !== except) p.ws.send(s); }
function pub(p) { return { id: p.id, name: p.name, code: p.code, outfit: p.outfit, wskin: p.wskin, team: p.team, kills: p.kills, deaths: p.deaths, hp: p.hp, alive: p.alive, x: p.x, y: p.y, z: p.z, yaw: p.yaw }; }

function join(ws, m) {
  const mode = m.mode === "tdm" ? "tdm" : "ffa";
  const r = pickRoom(mode, m.room);
  if (r.players.size >= MAX_PLAYERS) { ws.send(JSON.stringify({ t: "full" })); return null; }
  const p = {
    id: nextId++, ws, room: r, name: clean(m.name, 16) || "Player", code: clean(m.code, 2).toUpperCase() || "US",
    outfit: clean(m.outfit, 12) || "flag", wskin: clean(m.wskin, 12) || "none",
    team: 0, kills: 0, deaths: 0, hp: 100, alive: true, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, vx: 0, vz: 0, fl: 0, w: "", st: 0,
    dmgWindow: 0, dmgT: Date.now(), lastSeen: Date.now(),
  };
  if (r.mode === "tdm") { const c = [0, 0]; for (const o of r.players.values()) c[o.team]++; p.team = c[0] <= c[1] ? 0 : 1; }
  else p.team = p.id; // everyone is their own team
  r.players.set(p.id, p);
  ws.send(JSON.stringify({ t: "welcome", id: p.id, room: r.priv ? r.name.slice(2) : "", mode: r.mode, seed: r.seed, town: r.town, team: p.team, target: MATCH[r.mode].kills, endsAt: r.startT + MATCH[r.mode].secs * 1000 - Date.now(), teamKills: r.teamKills, players: [...r.players.values()].filter(o => o !== p).map(pub) }));
  bcast(r, { t: "join", p: pub(p) }, p);
  return p;
}
function leave(p) {
  const r = p.room;
  r.players.delete(p.id);
  bcast(r, { t: "leave", id: p.id });
  if (!r.players.size) rooms.delete(r.name);
}
function respawn(p) {
  const r = p.room;
  if (!r.players.has(p.id)) return;
  p.hp = 100; p.alive = true;
  bcast(r, { t: "spawn", id: p.id, sp: (Math.random() * 1000) | 0 });
}
function endMatch(r) {
  r.state = "end"; r.endT = Date.now() + 10000;
  const board = [...r.players.values()].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths).map(p => ({ id: p.id, name: p.name, code: p.code, team: p.team, kills: p.kills, deaths: p.deaths }));
  const winTeam = r.mode === "tdm" ? (r.teamKills[0] === r.teamKills[1] ? -1 : r.teamKills[0] > r.teamKills[1] ? 0 : 1) : board.length ? board[0].team : -1;
  bcast(r, { t: "end", board, winTeam, teamKills: r.teamKills });
}
function restartMatch(r) {
  r.state = "play"; r.startT = Date.now(); r.teamKills = [0, 0];
  for (const p of r.players.values()) { p.kills = 0; p.deaths = 0; p.hp = 100; p.alive = true; }
  bcast(r, { t: "restart", endsAt: MATCH[r.mode].secs * 1000, players: [...r.players.values()].map(pub) });
}

function onMessage(p, raw) {
  let m;
  try { m = JSON.parse(raw); } catch (e) { return; }
  if (!m || typeof m.t !== "string") return;
  const r = p.room;
  p.lastSeen = Date.now();
  switch (m.t) {
    case "st": // movement state
      p.x = num(m.x, p.x); p.y = num(m.y, p.y); p.z = num(m.z, p.z); p.yaw = num(m.yaw); p.pitch = num(m.pitch);
      p.vx = num(m.vx); p.vz = num(m.vz); p.fl = num(m.fl) | 0; p.w = clean(m.w, 8); p.st = 1;
      break;
    case "shot": // cosmetic: tracer + sound for everyone else
      if (p.alive) bcast(r, { t: "shot", id: p.id, a: (m.a || []).slice(0, 3).map(v => num(v)), b: (m.b || []).slice(0, 3).map(v => num(v)), w: clean(m.w, 8) }, p);
      break;
    case "hit": { // damage claim -> validate, apply, broadcast
      if (r.state !== "play" || !p.alive) return;
      const t = r.players.get(m.id | 0);
      if (!t || !t.alive || t === p) return;
      if (r.mode === "tdm" && t.team === p.team) return;
      const now = Date.now();
      if (now - p.dmgT > 1000) { p.dmgT = now; p.dmgWindow = 0; }
      let dmg = Math.round(Math.max(1, Math.min(MAX_HIT, num(m.dmg))));
      if (p.dmgWindow + dmg > MAX_DPS) return;
      if (Math.hypot(t.x - p.x, t.z - p.z) > MAX_RANGE) return;
      p.dmgWindow += dmg;
      t.hp -= dmg;
      bcast(r, { t: "dmg", id: t.id, by: p.id, dmg, hp: Math.max(0, t.hp), head: !!m.head });
      if (t.hp <= 0) {
        t.alive = false; t.hp = 0; t.deaths++; p.kills++;
        if (r.mode === "tdm") r.teamKills[p.team]++;
        bcast(r, { t: "kill", id: t.id, by: p.id, w: clean(m.w, 8), head: !!m.head, kills: p.kills, deaths: t.deaths, teamKills: r.teamKills });
        setTimeout(() => respawn(t), RESPAWN_MS);
        const goal = MATCH[r.mode].kills;
        if ((r.mode === "tdm" ? r.teamKills[p.team] : p.kills) >= goal) endMatch(r);
      }
      break;
    }
    case "fx": // grenades / gloo walls / emotes: relay to others
      bcast(r, { t: "fx", id: p.id, k: clean(m.k, 10), x: num(m.x), y: num(m.y), z: num(m.z), a: num(m.a), vx: num(m.vx), vy: num(m.vy), vz: num(m.vz), e: clean(m.e, 10) }, p);
      break;
    case "chat":
      bcast(r, { t: "chat", id: p.id, m: clean(m.m, 60) });
      break;
    case "ping":
      p.ws.send(JSON.stringify({ t: "pong", c: num(m.c) }));
      break;
  }
}

// snapshots + match timer
setInterval(() => {
  const now = Date.now();
  for (const r of rooms.values()) {
    for (const p of r.players.values()) if (now - p.lastSeen > 20000) { p.ws.close(); }
    if (r.state === "play" && now - r.startT > MATCH[r.mode].secs * 1000) endMatch(r);
    else if (r.state === "end" && now > r.endT) restartMatch(r);
    const s = [];
    for (const p of r.players.values()) if (p.st) s.push([p.id, +p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2), +p.yaw.toFixed(3), +p.pitch.toFixed(3), +p.vx.toFixed(2), +p.vz.toFixed(2), p.fl, p.w, p.hp]);
    if (s.length) bcast(r, { t: "snap", s });
  }
}, TICK_MS);

server.on("upgrade", (req, socket) => {
  if (!(req.url || "").startsWith("/ws")) return socket.destroy();
  const ws = wsAccept(req, socket);
  if (!ws) return;
  let p = null;
  ws.onmsg = raw => {
    if (!p) { let m; try { m = JSON.parse(raw); } catch (e) { return; } if (m && m.t === "hello") p = join(ws, m); return; }
    onMessage(p, raw);
  };
  ws.onclose = () => { if (p) leave(p); };
});

if (require.main === module) server.listen(PORT, () => console.log(`Brainrot Royale server on http://localhost:${PORT}  (WebSocket: /ws)`));
module.exports = { server, rooms };
