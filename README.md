# 🗳️ Brainrot Election 2026

A browser survival game: pick a parody political party from any of **197 countries**, survive 10 waves of haters, beat the bosses and get elected. Then keep going in Endless mode, earn funds, unlock achievements and upgrade your Campaign HQ.

> All parties, slogans and characters are fictional parody. No real politicians are depicted.

---

## ▶️ Run the game on your computer

The game is plain HTML, CSS and JavaScript. It has **no build step and no dependencies**. Pick any of these options.

### Option 1: just open it (quickest)
1. Download the repo: **Code → Download ZIP** on GitHub, then unzip it. Or clone it:
   ```bash
   git clone https://github.com/Rajeev0007/webgame.git
   cd webgame
   ```
2. Double-click **`index.html`**. It opens in your browser and you can play.

> Some browsers limit features on `file://` pages (gamepad, fullscreen, voices). If something doesn't work, use one of the local server options below.

### Option 2: Node.js (`npm start`)
Requires [Node.js](https://nodejs.org) 18 or newer.
```bash
npm start
```
Then open **http://localhost:8080**. Stop the server with `Ctrl + C`.

### Option 3: Python (installed on most Macs and Linux machines)
```bash
python3 -m http.server 8080
```
Then open **http://localhost:8080**.

### Option 4: VS Code
Install the **Live Server** extension, right-click `index.html`, and choose **Open with Live Server**.

### Play on your phone over the same Wi-Fi
1. Start a local server with Option 2 or 3 on your computer.
2. Find your computer's local IP address (`ipconfig` on Windows, `ifconfig` or `ip a` on Mac/Linux), e.g. `192.168.1.20`.
3. On your phone, open `http://192.168.1.20:8080`.

---

## 🌍 Host it online (free)

Any static website host works, because the whole game is static files.

### GitHub Pages (recommended)
1. Push the code to a GitHub repository.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Pick the branch with the game (e.g. `main` or `brainrot-election`) and the **`/ (root)`** folder, then click **Save**.
5. After about a minute your game is live at:
   **`https://<your-username>.github.io/<repo-name>/`**
   For this repo: `https://rajeev0007.github.io/webgame/`

Every new push to that branch updates the site automatically.

### Netlify
- **Drag and drop:** go to [app.netlify.com/drop](https://app.netlify.com/drop) and drop the project folder.
- **Or connect GitHub:** Add new site → Import from Git → pick the repo. Leave the build command empty and set the publish directory to `.`.

### Vercel
Go to [vercel.com/new](https://vercel.com/new) → import the GitHub repo → Framework preset **Other** → leave the build command empty → **Deploy**.

### Cloudflare Pages
Workers & Pages → Create → Pages → Connect to Git → pick the repo. Leave the build command empty and set the output directory to `/`.

### itch.io (game portal)
1. Zip the project's files. `index.html` must be at the top level of the zip.
2. On itch.io: **Upload new project** → Kind of project: **HTML** → upload the zip → check **This file will be played in the browser**.
3. Set the viewport to 1280×720 or larger and enable **Fullscreen button** and **Mobile friendly**.

### Hosting tips
- Use **HTTPS**, which all the hosts above provide. Browsers only allow gamepads, fullscreen and some voice features on secure pages.
- Flags load from [flagcdn.com](https://flagcdn.com). Offline, each candidate shows a colored badge with their country code instead.
- Progress (funds, achievements, upgrades, leaderboard, settings) is saved in the browser's `localStorage`, separately for each browser and device.

---

## 🎮 Features

**Candidates**
- 197 countries, each with a flag, a parody party, a mascot, a catchphrase, a play style (Balanced, Tank, Speedy, Glass Cannon, Gunner) and one of 8 specials. 38 of them have hand-written parodies (⭐ Featured).
- Every candidate **speaks** with the browser's text-to-speech, in their country's language when the device has a matching voice. Pitch and speed are tuned per character.

**Combat**
- **8 specials:** Shockwave, Rizz Aura, Sigma Dash, Missile Barrage, Fanum Tax, Red Tape, Tariff Storm, Campaign Double.
- **4 bonus weapons**, each with 5 levels: 🪃 Boomerang Policy, 🎤 Mic Drop, ⚡ Hot Mic Chain, 🚌 Campaign Bus.
- **16 upgrades** to choose from on level-up, with 🎲 rerolls.
- **6 power-ups:** Filibuster 🛡️, Energy Drink ⚡, Free Pizza 🍕, Viral Tweet 📱, Double Votes 🗳️, Vote Magnet 🧲.
- **🔥 Combo meter:** keep killing to multiply your votes up to x3. Getting hit resets it.

**Enemies**
- **10 hater types:** Fact Checker, Paparazzi, Intern, Protester mobs, Troll Bot, Reporter (shoots), Influencer (charges), Scandal (splits), Pollster (heals others), Hacker (teleports).
- **✨ Elite** golden versions that are much tougher and drop lots of votes and power-ups.
- **4 bosses**, each with its own attack pattern and an angrier **phase 2** at half HP: 💰 The Lobbyist (wave 5), 🦎 Lizard Overlord (wave 10), 📺 The Media Mogul (wave 15) and 🧠 The Algorithm (wave 20). After wave 20 they come back stronger.
- **🎲 Wave events:** Debate Night, Golden Hour, Breaking News, Low Turnout, Rally Day, Blackout.

**Progression**
- **💰 Campaign funds** are earned every run from votes, waves, elites, wins and achievements.
- **🏛️ Campaign HQ:** 10 permanent upgrades, including a revive (Second Term), Head Start and more rerolls. You can refund them any time.
- **🏅 20 achievements** with fund rewards, plus lifetime stats.
- **Easy / Normal / Hard**, Endless mode, a local leaderboard, and 🏆 badges for countries you've won with.

**Sound and polish**
- Procedural music that speeds up for boss fights, synthesized sound effects, and separate volume sliders for music, effects and voices.
- Fullscreen, auto-pause when you switch away, safe-area support for notched phones, phone vibration and controller rumble, first-run tips, and options to turn off screen shake and flashes.

## 🕹️ Controls

| | Keyboard + Mouse | Touch | Gamepad |
|---|---|---|---|
| Move | WASD / Arrows | Drag on left half | Left stick / D-pad |
| Aim | Auto (or mouse with Manual aim) | Auto (or drag on right half with Manual aim) | Right stick (otherwise auto) |
| Special | Space / E / Right-click | Big round button | A / RB / RT / LB / LT |
| Upgrades | 1 / 2 / 3 or click · R = reroll | Tap | D-pad + A · Y = reroll |
| Pause | P / Esc | ⏸ button | Start |
| Menus | Arrows / Tab + Enter | Tap | D-pad/stick + A, B = back |

Also: **M** mutes, **F** toggles fullscreen.

## 🗂️ Project structure

```
index.html             screens and HUD
css/style.css          styling and responsive layout
js/countries.js        all countries, parody parties, archetypes and specials
js/meta.js             funds, Campaign HQ upgrades, achievements, lifetime stats
js/audio.js            sound effects, procedural music, character voices
js/input.js            keyboard, mouse, touch joysticks, gamepad
js/game.js             game engine, enemies, bosses, weapons and UI logic
manifest.webmanifest   lets players "Add to Home Screen" on phones
```

Run `npm run check` to syntax-check every script.

## 🛠️ Troubleshooting

| Problem | Fix |
|---|---|
| No sound | Click or tap once first, because browsers block audio until you interact. Also check ⚙️ Settings and the 🔊 button. |
| Characters don't talk | Voices come from your device. Install extra voices in your OS settings, or check that the voice slider isn't at 0. |
| Gamepad not detected | Press any button on the controller after the page loads, and use an `http://localhost` or `https://` address. |
| Flags show as letters | The flag images couldn't load (offline or blocked). The game still works. |
| Want to reset progress | Open your browser's dev tools → Application → Local Storage → delete the `bre2-*` keys. |
