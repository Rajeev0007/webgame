# 🪂 Brainrot Royale 3D

A **3D third-person battle royale** that runs in the browser on phones, tablets and PCs. **50 players** fly over an island and parachute down. You loot guns, armor and med kits, and survive a **shrinking zone** until you're the last candidate standing. Your opponents are 49 bots.

You play as a parody candidate from any of **197 countries**, each with their own flag-pattern suit, voice line and party.

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
Look sensitivity, aim assist, invert Y, graphics quality (Low / Medium / High changes resolution and view distance), music, sound effects and voice volume, vibration, and an FPS counter.

## 🗂️ Project structure

```
index.html              Brainrot Royale 3D (lobby, HUD, menus)
css/br.css              styles + mobile control layout
js/countries.js         197 countries, parody parties, voices (shared with classic)
js/audio.js             synthesized SFX (guns, footsteps, plane...), music, voices (shared)
js/br/engine.js         tiny WebGL renderer: shaders, meshes, fog, billboards
js/br/data.js           weapons, ammo, items, armor, loot table, zone phases, difficulty
js/br/world.js          island terrain, towns, enterable buildings, trees, rocks, collision, ray casting
js/br/character.js      low-poly politicians, guns, armor, parachute, plane, loot models
js/br/input.js          touch (stick, look, buttons), mouse + pointer lock, keyboard, gamepad
js/br/game.js           match flow, player, bots AI, shooting, zone, HUD, menus
classic/                the original 2D survival game
```

Run `npm run check` to syntax-check every script.

## 🛠️ Troubleshooting

| Problem | Fix |
|---|---|
| Black screen / "can't run 3D graphics" | Your browser or device has WebGL turned off. Update the browser or enable hardware acceleration. Classic 2D still works. |
| Low FPS on phone | ⚙️ Settings → Graphics → **Low**. |
| Mouse doesn't turn the camera | Click inside the game once to lock the mouse. Press Esc to free it. |
| No sound | Tap or click once, because browsers block audio until you interact. Check the volume sliders. |
| Characters don't talk | Voices come from your device's text-to-speech. Install extra voices in your OS settings. |
| Controller not detected | Press any button after the page loads, and use `https://` or `http://localhost`. |
