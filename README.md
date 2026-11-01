# 🪂 Brainrot Royale 3D

A **3D third-person battle royale** that runs in the browser on phones, tablets and PCs. **48–50 players** fly over an island and parachute down. You loot guns, armor and med kits, and survive a **shrinking zone** until you're the last squad standing. The offline modes fill the island with bots, and the **🌐 Online** mode lets you fight real people (up to 16 per room) once you deploy the included server.

You play as a parody candidate from any of **197 countries**, each with their own flag-pattern suit, voice line and party.

### 🆕 Modes and features
- **Mode select:** 🏆 Ranked Game, 🪂 Classic (Solo / Duo / Squad), ⚔️ Clash Squad 4v4, 🏅 Clash Squad Ranked, 🎯 Training, 🌐 Online.
- **🌐 Online multiplayer:** Free-for-all (first to 25 kills) or Team Deathmatch (first team to 40), quick play or a private room code for friends, 3 s respawns, quick chat, live ping. The server checks every hit, so players can't send fake damage. See [Play online with real people](#-play-online-with-real-people).
- **Squads:** bot teammates drop with you, follow you, loot, fight and **revive** you. Downed players are **knocked** and crawl while they bleed out. Hold E (or ➕ REVIVE) to pick a teammate up. A team list with HP bars sits under the minimap.
- **Clash Squad:** 4v4 rounds in a town arena, first to 4 wins.
  - Each round starts with a 10 s **buy phase**. The 🛒 shop sells guns, vests, helmets, gloo walls, grenades and heals, paid for with round coins.
  - Top score bar (`2 | 0:48 | 1 · Objective: 4`), a closing zone each round, and a **K / D / DMG scoreboard**.
- **🧊 Gloo walls:** throwable instant cover that blocks bullets until it's shot down. Bots use them too.
- **🦸 Character skills:** 1 active skill on the SKILL button (Medic Pulse, Turbo Run, Iron Will, Radar Pulse, Gloo Fortress, Adrenaline) and 2 passives (Thick Skin, Fast Hands, Sprinter, Field Medic, Headhunter, Gloo Master, Scavenger).
- **🐾 Pets** that follow you, each with a perk: Bam the panda, Biscuit, Ember, Hoot, Chilly and Bolt.
- **👕 Outfits** (hoodies, ninja, crown, cyber visor, golden aura…), **🔫 weapon skins** with glowing tracers, and **😀 emotes**.
- **🪪 Profile:** name, UID, level and XP, likes, **BR and CS rank badges** (Bronze → Grandmaster), stats (K/D, headshot %, Booyah rate) and match history.
- **🪙 Coins and 💎 diamonds** are earned in matches and spent in the 🛒 Store. There's also a **🎁 7-day daily login** reward.
- **Kill banners** (FIRST BLOOD, HEADSHOT, DOUBLE KILL… RAMPAGE), MVP, and Booyah results with XP, coins and rank-point rewards.
- **FF-style lobby:** your squad lined up with your pet, side menu, mode card and a big START button.

Everything is stored locally in your browser. There's no real-money shop, and the currencies can only be earned by playing.

The original 2D survival game is still included as **🕹️ Classic 2D** (`classic/`).

> All parties, slogans and characters are fictional parody. No real politicians are depicted.

---

## ▶️ Run the game on your computer

The game is plain HTML, CSS and JavaScript with its own small WebGL 3D engine. It has **no build step and no dependencies**. Pick any of these options.

### Option 1: just open it (quickest)
1. Download the repo: **Code → Download ZIP** on GitHub, then unzip it. Or clone it:
   ```bash
   git clone https://github.com/Rajeev0007/webgame.git
   cd webgame
   ```
2. Double-click **`index.html`**.

> Opened straight from a file, flags may show as plain colors and the mouse lock or controller may not work. Use a local server (below) for the full experience.

### Option 2: Node.js (`npm start`)
Requires [Node.js](https://nodejs.org) 18 or newer.
```bash
npm start
```
Then open **http://localhost:8080**. Stop the server with `Ctrl + C`.

This is the game's own server (`server/server.js`), so **online mode works too**. Open the page in two browser tabs (or on two devices on the same Wi-Fi), choose 🌐 Online in both, and you'll be in the same match. Use `PORT=3000 npm start` to pick another port.

### Option 3: Python
```bash
python3 -m http.server 8080
```
Then open **http://localhost:8080**.

### Option 4: VS Code
Install the **Live Server** extension, right-click `index.html`, and choose **Open with Live Server**.

### Play on your phone over the same Wi-Fi
1. Start a local server with Option 2 or 3 on your computer.
2. Find your computer's local IP address (`ipconfig` on Windows, `ifconfig` or `ip a` on Mac/Linux), e.g. `192.168.1.20`.
3. On your phone, open `http://192.168.1.20:8080`. Hold the phone **sideways** for the best controls.

---

## 🌍 Host it online (free)

Any static website host works, because the whole game is static files.

### GitHub Pages (recommended)
1. Push the code to a GitHub repository.
2. Go to **Settings → Pages**. On a phone, open this in the browser, not the GitHub app.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Pick the branch with the game (e.g. `brainrot-election` or `main`) and the **`/ (root)`** folder, then click **Save**.
5. After 1–2 minutes your game is live at:
   **`https://<your-username>.github.io/<repo-name>/`**
   For this repo: `https://rajeev0007.github.io/webgame/`. Classic mode is at `.../webgame/classic/`.

Every new push to that branch updates the site automatically.

> Static hosts (GitHub Pages, Netlify, Vercel, Cloudflare Pages, itch.io) run every offline mode. For 🌐 Online you also need the server, see the next section.

### Netlify
- **Drag and drop:** go to [app.netlify.com/drop](https://app.netlify.com/drop) and drop the project folder.
- **Or connect GitHub:** Add new site → Import from Git → pick the repo. Leave the build command empty and set the publish directory to `.`.

### Vercel
Go to [vercel.com/new](https://vercel.com/new) → import the repo → Framework preset **Other** → leave the build command empty → **Deploy**.

### Cloudflare Pages
Workers & Pages → Create → Pages → Connect to Git → pick the repo. Leave the build command empty and set the output directory to `/`.

### itch.io (game portal)
1. Zip the project's files. `index.html` must be at the top level of the zip.
2. On itch.io: **Upload new project** → Kind of project: **HTML** → upload the zip → check **This file will be played in the browser**.
3. Set the viewport to 1280×720, and enable **Fullscreen button** and **Mobile friendly** (landscape).

### Hosting tips
- Use **HTTPS**, which all the hosts above provide. Browsers only allow mouse lock, controllers and voices on secure pages.
- Flags load from [flagcdn.com](https://flagcdn.com). If they can't load, suits fall back to a solid color.
- Stats and settings are saved in the browser's `localStorage`, separately for each browser and device.

---

## 🌐 Play online with real people

Online mode needs the small game server in `server/server.js`. It is plain Node.js with **no npm packages**, and it serves the game files too, so one deploy gives you the website and the multiplayer at the same address.

### Step 1: deploy the server on Render (free)
1. Sign in at [render.com](https://render.com) with your GitHub account.
2. Click **New → Web Service** and pick this repository (`Rajeev0007/webgame`).
3. Fill in:
   | Field | Value |
   |---|---|
   | Branch | `brainrot-election` (the branch with the game) |
   | Runtime / Language | **Node** |
   | Build Command | leave empty, or `echo none` |
   | Start Command | `node server/server.js` |
   | Instance type | **Free** |
4. Click **Create Web Service** and wait until the log says `Brainrot Royale server on ...`.
5. Render gives you an address like **`https://webgame-xxxx.onrender.com`**. Check it works by opening `https://webgame-xxxx.onrender.com/health`. It should show `{"ok":true,...}`.

You can also click **New → Blueprint** and pick the repo. The included `render.yaml` fills in all of the above for you.

**Railway** works the same way: [railway.app](https://railway.app) → New Project → Deploy from GitHub repo → it detects `npm start` automatically → Settings → Networking → **Generate Domain**.

> The free Render plan goes to sleep after about 15 minutes with nobody playing. The first player after that waits roughly 30–60 seconds while it wakes up. If you see "Server didn't answer", wait a bit and press PLAY ONLINE again.

### Step 2: play
- **Easiest:** open your Render address (`https://webgame-xxxx.onrender.com`) and send the same link to friends. Online mode connects to it automatically.
- **From GitHub Pages:** GitHub Pages can't run a server, so tell the game where it is. Open ⚙️ **Settings → Online server** and paste `webgame-xxxx.onrender.com`. Every player who plays from the GitHub Pages link needs to do this once (it's saved in the browser).

### Step 3: in the game
1. Pick a candidate, then tap the **mode card → 🌐 ONLINE**.
2. Choose **Free-for-all** or **Team Deathmatch**.
3. **Quick play** puts you in any open room with free space. For friends only, tap **🔒 Private room**, type a code (e.g. `PARTY7`), and have your friends type the **same code**.
4. Press **PLAY ONLINE**.

| | Free-for-all | Team Deathmatch |
|---|---|---|
| Win | first to 25 kills, or most kills after 6 min | first team to 40 kills, or most after 7 min |
| Teams | everyone for themselves | 2 teams, balanced automatically |
| Players per room | up to 16 | up to 16 |

When you die you respawn after 3 seconds with a fresh loadout. After a match the scoreboard shows for 10 seconds, then a new match starts in the same room. Use 💬 for quick chat. Your ping shows at the top of the screen.

**How it's kept fair:** each player's own game decides where they move and whether their shot hit, and the server checks every hit before applying it (maximum damage per hit, damage per second and range, no team damage in TDM). Health, kills and respawns only change when the server says so.

---

## 🔊 Use real sound files (optional)

All sounds are generated live by the game (layered gunshots, echo, left/right panning, muffled far-away shots), so it works with no files. For studio-quality sound you can drop in real recordings:

1. Download free sounds, for example:
   - [Kenney.nl audio packs](https://kenney.nl/assets?q=audio) (CC0, free for any use)
   - [freesound.org](https://freesound.org) (check each file's license; CC0 is easiest)
   - [Sonniss GDC game audio bundles](https://sonniss.com/gameaudiogdc) (free, royalty-free)
2. Put the `.mp3`, `.ogg` or `.wav` files in **`assets/sounds/`**.
3. Edit **`assets/sounds/sounds.json`**. Map a sound name to your file name, and remove the `_` in front of any line you want to use:
   ```json
   {
     "ar": "ak-shot.mp3",
     "sniper": "awm.ogg",
     "step": "footstep-grass.wav"
   }
   ```
4. Commit and push. Any sound you don't list keeps the built-in version.

Sound names you can replace: `ar`, `m4`, `pistol`, `smg`, `shotgun`, `sniper`, `dmr`, `reload`, `step`, `land`, `boom`, `hurt`, `hitmark`, `headshot`, `knock`, `pick`, `heal`, `plane`, `wind`, `booyah`, `zone`, `click`.

Keep files short (gunshots under 1 second) and small (under 200 KB each) so the game loads fast on phones. Real files only load when the game runs from a web server (`npm start` or any host above), not from a double-clicked `index.html`.

---

## 🧍 Realistic characters (next step)

The characters are built and animated by code (`js/br/rig.js`). Free Fire and BGMI quality comes from artist-made 3D models with motion-captured animations. The game doesn't load those yet. If you want that upgrade, collect these files and I can add a model loader for them:

1. **Characters:** [Mixamo](https://www.mixamo.com) (free with an Adobe account). Pick a character, download as **FBX** or **glTF**, "T-pose". Or use [Quaternius](https://quaternius.com) "Ultimate Modular Characters" (CC0, already `.glb`).
2. **Animations:** on Mixamo, download these for the same character, **Without Skin**, 30 fps: idle rifle, run forward rifle, walk, sprint, crouch walk, jump, falling, rifle fire, reload, death, and skydive.
3. Put them in `assets/models/` (e.g. `assets/models/soldier.glb`, `assets/models/anim/run.fbx`) and push.

Use only models you have the rights to. Don't use files ripped from Free Fire, BGMI or other games.

---

## 🎮 How a match works

1. **🛫 Drop:** a plane flies across the island with all 50 players. Hit **JUMP** over a spot you like (the button turns orange when you're over land). Freefall, steer, then pop the parachute. It opens on its own near the ground.
2. **🔫 Loot:** 8 named towns full of enterable buildings, plus crates and loot scattered across the island:
   - **8 guns:** P92 pistol, Spin Doctor SMG, Filibuster 12 shotgun, AK-Aura, M4-Mandate, Recount DMR, Veto Sniper (scoped) and the rare 👑 Golden AK. They come in common, uncommon, rare, epic and legendary.
   - **4 ammo types:** light, heavy, shells and sniper.
   - **🦺 vests and ⛑️ helmets**, levels 1–3, which reduce damage.
   - **🩹 bandages** (heal up to 75), **🧰 med kits** (heal to full), **🥤 energy drinks** (boost that regenerates HP) and **💣 grenades**.
   - Ammo, heals and armor upgrades are picked up automatically. Guns go into empty slots automatically, and a full slot can be swapped with ✋ Pick up.
3. **🔵 Zone:** a blue wall shrinks over 6 phases. The white circle on the map shows where it's going next. Outside the zone you lose HP, faster every phase.
4. **🏆 Win:** be the last one alive. You get a **BOOYAH**, "Winner winner, aura dinner!" and your candidate's voice line.

**Combat:** shots travel instantly along the aim line, with spread, recoil and bloom. **Headshots** do bonus damage, and walls, rocks and trees stop bullets. **Bots** loot, fight each other, heal, run from the zone, strafe, crouch, and throw grenades at enemies behind cover. **Easy / Normal / Hard** changes how well bots aim, how fast they react and how much damage they do.

**HUD:** kill feed, players alive, kill count, zone timer, compass, minimap with zone circles and red gunshot markers, full island map, hit markers, damage numbers, red arrows showing which direction you're being shot from, and name tags with health bars. After you die you can **spectate** your killer or other players.

## 🕹️ Controls

| Action | 📱 Phone (landscape) | ⌨️ Keyboard + Mouse | 🎮 Controller |
|---|---|---|---|
| Move | Drag on the left side (push far to sprint) | WASD (+ Shift sprint) | Left stick (click to sprint) |
| Look / aim | Drag on the right side | Mouse (click the game to lock) | Right stick |
| Fire | 🔥 big button, which you can drag to aim while shooting. There's also a 2nd 🔥 on the left. | Left mouse | RT |
| Scope | 🎯 (tap on / off) | Right mouse (hold) | LT |
| Jump / skydive / parachute | ⤒ or 🪂 JUMP | Space | A |
| Crouch | ⤓ | C / Ctrl | B |
| Reload | ↻ | R | X |
| Pick up gun | ✋ button | E / F | X |
| Switch weapon | Tap a weapon slot | 1 / 2 / mouse wheel (X holsters) | Y |
| Heal / drink | 🩹 / 🥤 | H / B | RB |
| Grenade | 💣 | G | LB |
| Map | 🗺️ | M / Tab | View |
| Pause | ⏸ | Esc / P | Menu |

On phones and controllers, **aim assist** (on by default) gently pulls your aim onto enemies near the crosshair.

## ⚙️ Settings
Look sensitivity, aim assist, invert Y, graphics quality (Low / Medium / High changes resolution and view distance), music, sound effects and voice volume, vibration, an FPS counter, and **Online server** (the address of your game server, only needed when playing from a static host like GitHub Pages).

## 🗂️ Project structure

```
index.html              Brainrot Royale 3D (lobby, HUD, menus)
css/br.css              styles + mobile control layout
js/countries.js         197 countries, parody parties, voices (shared with classic)
js/audio.js             synthesized SFX (guns, footsteps, plane...), music, voices (shared)
js/br/engine.js         tiny WebGL renderer: shaders, meshes, fog, billboards
js/br/data.js           weapons, items, loot, zone, skills, pets, outfits, skins, ranks, modes, CS shop
js/br/progress.js       profile, level/XP, coins/diamonds, ranks, owned items, rewards, daily login
js/br/world.js          island terrain, towns, buildings, props, collision, ray casting, gloo obstacles
js/br/rig.js            smooth skeletal characters + pets with procedural animation and two-hand gun IK
js/br/character.js      looks (skin, hair, outfits), parachute, gloo, plane, loot models
js/br/input.js          touch (stick, look, buttons), mouse + pointer lock, keyboard, gamepad
js/br/core.js           shared state, settings, renderer setup, fighters, loot helpers, messages
js/br/combat.js         shooting, damage, knock/revive, kills, pickups, gloo walls, grenades, skills, physics
js/br/modes.js          Battle Royale, Clash Squad rounds + shop, Training, end of match + rewards
js/br/ai.js             bot brains: loot, fight, follow squad, revive, gloo, skills
js/br/game.js           player control, frame loop, camera, rendering, HUD, scoreboard, lobby scene
js/br/net.js            online client: connect, sync players, interpolation, hits, chat, scoreboard
js/br/ui.js             lobby menus: modes, store, vault, pets, skills, profile, daily rewards
server/server.js        Node game server (no dependencies): static files + WebSocket rooms on /ws
assets/sounds/          optional real sound files + sounds.json map
render.yaml             one-click Render deploy settings
classic/                the original 2D survival game
```

`npm start` runs the server (`PORT` env variable, default 8080). `GET /health` reports rooms and players.

Run `npm run check` to syntax-check every script.

## 🛠️ Troubleshooting

| Problem | Fix |
|---|---|
| Black screen / "can't run 3D graphics" | Your browser or device has WebGL turned off. Update the browser or enable hardware acceleration. Classic 2D still works. |
| Low FPS on phone | ⚙️ Settings → Graphics → **Low**. |
| Mouse doesn't turn the camera | Click inside the game once to lock the mouse. Press Esc to free it. |
| No sound | Tap or click once, because browsers block audio until you interact. Check the volume sliders. |
| Characters don't talk | Voices come from your device's text-to-speech. Install extra voices in your OS settings. |
| "Online needs a server address" | You're on GitHub Pages or a file. Deploy the server (see Play online) and put its address in ⚙️ Settings → Online server. |
| "Server didn't answer" | A free Render server is waking up. Wait 30–60 s and try again. Check `https://your-server/health`. |
| Friends end up in different matches | Use the same mode (FFA/TDM) and the same private room code. |
| Real sound files don't play | Run from a web server, check the file names in `sounds.json` match exactly, and remove the `_` in front of the name. |
| Controller not detected | Press any button after the page loads, and use `https://` or `http://localhost`. |
