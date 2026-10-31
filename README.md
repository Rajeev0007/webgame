# 🗳️ Brainrot Election 2026

A browser survival game: pick a parody political party from any of **197 countries**, survive 10 waves of haters, beat the bosses and get elected.

> All parties, slogans and characters are fictional parody. No real politicians are depicted.

## Play

You don't need a build step or any installs. Do one of these:
- Open `index.html` in a browser, or
- Serve the folder with any static server, e.g. `npx serve .` or `python3 -m http.server`, or
- Turn on **GitHub Pages**: Settings → Pages → Deploy from branch → `/ (root)`.

Flags load from [flagcdn.com](https://flagcdn.com). If you're offline, each character falls back to a colored badge showing its country code.

## Features

- **197 countries**, each with a flag, a parody party, a mascot, a catchphrase, one of 5 archetypes (Balanced, Tank, Speedy, Glass Cannon, Gunner) and one of 8 specials. 38 of them have hand-written parodies (⭐ Featured).
- **Voices**: every candidate speaks with the browser's text-to-speech, in their country's language when the device has a matching voice. Pitch and speed are tuned per character.
- **Sound**: procedural music that speeds up for boss fights, plus synthesized sound effects. Music, effects and voices each have their own volume slider.
- **Specials**: Shockwave, Rizz Aura, Sigma Dash, Missile Barrage, Fanum Tax, Red Tape, Tariff Storm, Campaign Double.
- **Power-ups**: Filibuster 🛡️, Energy Drink ⚡, Free Pizza 🍕, Viral Tweet 📱, Double Votes 🗳️, Vote Magnet 🧲.
- **12 upgrades** to choose from on level-up, **6 enemy types**, **2 bosses**, and **Endless mode** after you win.
- **Easy / Normal / Hard**, a local leaderboard, 🏆 badges for countries you've won with, and saved settings.
- Fullscreen, auto-pause when the tab is hidden, safe-area support for phones with notches, and vibration plus controller rumble.

## Controls

| | Keyboard + Mouse | Touch | Gamepad |
|---|---|---|---|
| Move | WASD / Arrows | Drag on left half | Left stick / D-pad |
| Aim | Auto (or mouse with Manual aim) | Auto (or drag on right half with Manual aim) | Right stick (otherwise auto) |
| Special | Space / E / Right-click | Big round button | A / RB / RT / LB / LT |
| Upgrades | 1 / 2 / 3 or click | Tap | D-pad + A |
| Pause | P / Esc | ⏸ button | Start |
| Menus | Arrows / Tab + Enter | Tap | D-pad/stick + A, B = back |

Also: **M** mutes, **F** toggles fullscreen.

## Files

```
index.html             screens and HUD
css/style.css          styling and responsive layout
js/countries.js        all countries, parody parties, archetypes and specials
js/audio.js            sound effects, procedural music, character voices
js/input.js            keyboard, mouse, touch joysticks, gamepad
js/game.js             game engine and UI logic
```
