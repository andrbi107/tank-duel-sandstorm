---
name: tank-duel-sandstorm
description: A turn-based artillery tank duel PWA (canvas, vanilla JS) that teaches projectile physics, destructible terrain, wind-affected aiming, and a touch/keyboard/mouse control scheme.
---

# Tank Duel: Sandstorm

## What this skill gives the model

After reading this skill, the model understands:
- the genre and core loop of Tank Duel: Sandstorm (turn-based artillery duel, two tanks, one shell per turn)
- the exact mechanics (procedural destructible terrain, angle+power aiming, gravity+wind shell trajectory, HP and damage falloff, AI aim with difficulty-scaled error, best-of-1 / best-of-3 rounds)
- the controls (touch on-screen buttons + swipe, keyboard arrows/WASD/Space, mouse aim-by-cursor)
- the PWA structure required (manifest, service worker, icon) and the file layout
- how to deploy it on GitHub Pages with no build step
- the customization hooks (constants at the top of `main.js`) to retune physics, terrain, colors, difficulty, and match length

## Game design

Tank Duel: Sandstorm is a 2D turn-based artillery duel rendered on a single landscape HTML5 `<canvas>` that fills the viewport. Two tanks face off across a procedurally generated hilly desert: the player's tank on the left, the AI opponent's tank on the right. Each turn the active player adjusts an aim angle (0–90 degrees from horizontal) and a fire power (0–100), then launches a single shell. Gravity pulls the shell down and wind — re-rolled every turn to a value in the range -5..+5 — pushes it sideways, so the player must lead or hold back against the wind. The shell either scores a direct hit, lands close enough to deal splash damage, or misses entirely and blows a crater in the terrain. The first tank to reduce the other's HP from 100 to 0 wins the round.

The visual identity is desert warfare under a chosen sky. The player picks one of three palettes before the match: **day** (blue sky fading to white haze, bright sand), **dusk** (orange horizon fading up to deep purple, warm dunes), or **night** (near-black sky with twinkling stars, cool moonlit sand). The terrain is a filled polygon built from layered sine waves plus per-column random drift, drawn with a sand gradient and a lighter crest line. Tanks are small rounded rectangles with a turret circle and a barrel line that rotates to the aim angle; an HP bar floats above each tank. The shell is a small dot leaving a faint fading trail. Explosions are expanding orange→red rings with a puff of dust particles. A wind arrow sits top-center with its numeric value. Everything is canvas primitives — no external images, fonts, or libraries.

The objective is to win the round (drop the enemy to 0 HP) and, in Best-of-3 mode, to win two rounds before the enemy does. Each tank starts a round at 100 HP. A direct shell hit deals 25–40 damage scaled by how close to the tank center the shell landed; a near miss within the explosion radius deals 10–20. Craters carve the terrain, which can change the geometry of subsequent shots. After a round ends, a Round Over screen shows who won and the HP remaining, and either offers a Next Round button (Best-of-3) or flows straight to Match Over (Best-of-1). The Match Over screen shows the final match result, the persisted win/loss record, and Play Again / Home buttons.

The core loop is: Start screen (pick name, sky, difficulty, mode, Play) → Playing (aim, fire, watch shell fly, watch explosion, turn passes) → repeat until a tank hits 0 HP → Round Over → (Best-of-3: Next Round and replay, or Match Over after 2 wins) → Match Over → Play Again or Home. Difficulty (Easy / Normal / Hard) only affects the AI: it searches a grid of (angle, power) pairs in a physics simulation to find the best shot against the player, then adds a random error of Easy ±8°/+15 power, Normal ±4°/+8 power, Hard ±1°/+3 power. The player's record — wins, losses, and the hardest difficulty ever won — is persisted to `localStorage` under `tankDuel.record`. The player's optional name is persisted under `tankDuel.name` and shown in the HUD and victory text.

## Mechanics in detail

- **Terrain generation** (`generateTerrain` in `main.js`): a heightmap is an array of `y` values sampled every `TERRAIN_STEP` (8 px) across the canvas width. Each column's height is `base + sin(x*0.006)*amp1 + sin(x*0.014)*amp2 + sin(x*0.0024)*amp3 + drift`, where `base` is ~72% of canvas height and `drift` is a slowly random-walking offset clamped to keep terrain on screen. Regenerated every round.
- **Tank placement**: the player tank is placed at ~15% of canvas width, the enemy at ~82%, both snapped to the terrain height at their column. `player.dir = 1` (faces right), `enemy.dir = -1` (faces left).
- **Aiming**: angle 0–90 degrees measured from horizontal up. Keyboard Up/Down or W/S adjusts by ±1 per press (with auto-repeat held); touch ▲/▼ buttons do the same; on touch a vertical swipe near the player tank also nudges the angle. The barrel line is drawn at `(tank.x + dir*cos(angle)*len, tank.y - 15 - sin(angle)*len)`.
- **Power**: 0–100, adjusted with Left/Right or A/D (keyboard), ◀/▶ buttons (touch), or a slider. Power bar drawn bottom-left.
- **Mouse aim**: when the pointer is above the player tank, the angle is set from `atan2(dy, dx)` of the cursor relative to the turret, and the power is set from the horizontal distance clamped 0–100. This is an optional secondary scheme; keyboard remains the primary documented one.
- **Firing** (`fire`): velocity magnitude `v = power * POWER_SCALE + POWER_BASE` (see constants). Initial `vx = dir*cos(angle)*v`, `vy = -sin(angle)*v` (negative = up on canvas). Shell spawned at the muzzle tip. State goes to `firing`; input is locked.
- **Shell physics** (`updateShell`, called per frame with a fixed `dt`): `vx += wind * WIND_ACCEL * dt; vy += GRAVITY * dt; x += vx*dt; y += vy*dt`. A short trail of recent positions is kept and drawn fading. The shell is removed when it hits terrain (`y >= terrainY(x)`), hits a tank (distance to tank center < tank radius), or leaves the screen.
- **Impact & damage** (`explode`): on impact an explosion ring of radius `EXPLOSION_RADIUS` (~42 px) is spawned. For each tank, distance from blast center to tank center is computed. If `dist < TANK_HIT_RADIUS` (~14 px) it's a direct hit → damage 25–40 scaled by `1 - dist/TANK_HIT_RADIUS`. Else if `dist < EXPLOSION_RADIUS` it's a near miss → damage 10–20 scaled by `1 - dist/EXPLOSION_RADIUS`. HP clamped to 0. The terrain heightmap is lowered in a crater of radius `EXPLOSION_RADIUS * 0.8` around the impact (the crater function raises each column's `y` by up to `sqrt(r^2 - dx^2)`).
- **Wind**: re-rolled at the start of every turn to a random float in `[-5, 5]`. Drawn as an arrow at top-center whose length scales with `abs(wind)` and direction matches the sign; the numeric value is shown beside it.
- **Turn flow**: player fires → shell resolves (hit/miss) → check round over → if not over, after a short delay the AI takes its turn: it runs `findAIShot` (a grid search simulating trajectories with the current wind to find the (angle, power) that lands closest to the player), applies the difficulty-scaled random error, sets the enemy's angle/power, and fires. After the AI shell resolves, control returns to the player and wind is re-rolled.
- **AI** (`findAIShot`, `applyAIError`): for `angle` in a stepped range and `power` in a stepped range, simulate the shell forward with the current wind for up to N steps, record the closest approach distance to the player tank center. Pick the (angle, power) with the smallest closest-approach distance. Then add error: Easy `±8° / ±15 power`, Normal `±4° / ±8 power`, Hard `±1° / ±3 power`. Higher difficulty = tighter search step + smaller error.
- **HP & round end**: each tank starts at 100. When either hits 0, the round ends. The other tank wins the round; if both hit 0 simultaneously (rare, same blast) it's a draw round (no win awarded). Round winner gets +1 match win. In Best-of-3, the first to 2 round wins takes the match; in Best-of-1 the single round decides.
- **Record persistence**: on match end, `tankDuel.record` `{wins, losses, hardestDifficultyWon}` is updated — wins/losses incremented, and `hardestDifficultyWon` is upgraded if the player won on a harder difficulty than previously recorded (Hard > Normal > Easy). `tankDuel.name` stores the entered name (empty string allowed).
- **Screens**: Start, Playing, Paused (Resume / Restart / Home), Round Over (round winner + HP remaining + Next Round / Restart), Match Over (match winner + final tally + record + Play Again / Home).

## Controls

- **Touch**: ▲/▼ buttons adjust angle, ◀/▶ buttons adjust power, big FIRE button fires. A vertical swipe over the player tank also nudges the angle. The pause button (top-right) opens the pause menu. On-screen buttons are large and thumb-reachable in landscape.
- **Keyboard**: `↑`/`↓` or `W`/`S` adjust angle (hold to repeat); `←`/`→` or `A`/`D` adjust power; `Space` or `Enter` fires; `P` or `Esc` pauses; `R` restarts the current round from the pause menu.
- **Mouse**: move the cursor above the player tank — the angle follows the cursor direction and the power follows the horizontal distance from the tank (clamped 0–100). Click anywhere on the canvas to fire. Keyboard is the primary documented scheme; mouse is a convenience for desktop.

## File layout

- `index.html` — entry point: PWA meta tags, links `styles.css`, loads `main.js`, registers `sw.js`, hosts the overlay screens (start / pause / round-over / match-over / rotate-hint) and the in-game HUD + touch controls.
- `styles.css` — all styles: full-viewport canvas, overlay screens, HUD bars, touch buttons, responsive clamp-based sizing, portrait rotate-hint, safe-area insets.
- `main.js` — the entire game: constants, state, localStorage, terrain, tanks, shell physics, AI, rendering, input (keyboard/touch/mouse), screen flow, service-worker registration is in index.html.
- `manifest.json` — PWA manifest: `start_url: "./"`, `scope: "./"`, `orientation: "landscape"`, icon entry pointing at `icon.svg`.
- `sw.js` — service worker: precaches `./`, `index.html`, `styles.css`, `main.js`, `manifest.json`, `icon.svg`; serves from cache; falls back to `index.html` offline.
- `icon.svg` — app icon: a tank silhouette in front of a dune under a dusk-gradient sky.

## How to run / deploy

1. Open `index.html` directly in a browser (the service worker still registers and the game plays offline after first load), OR
2. Push the whole `tanks/` folder to a GitHub repo and enable Pages — the game runs from the repo root or a subfolder because every path is relative.

## PWA install

The manifest + service worker make the game installable on Android, iOS, and desktop. After the first load the shell is cached and the game runs fully offline. The manifest requests `orientation: landscape` and `display: fullscreen` so on mobile it launches straight into the duel without browser chrome.

## Customization hooks

All tuning lives in the `CONFIG` / constants block at the top of `main.js`:

- `GRAVITY`, `WIND_ACCEL`, `POWER_SCALE`, `POWER_BASE` — physics feel (shell speed, gravity strength, how much wind shoves the shell).
- `TERRAIN_STEP`, terrain amplitudes in `generateTerrain` — terrain roughness and resolution.
- `EXPLOSION_RADIUS`, `TANK_HIT_RADIUS`, direct/near-miss damage ranges — blast and damage balance.
- `TANK_HP` (100) — round length.
- `DIFFICULTY` table — AI aim error and search step per difficulty.
- `SKY_THEMES` — the three palettes (day / dusk / night) and their colors.
- `RECORD_KEY`, `NAME_KEY` — localStorage keys.
- Match length is chosen at runtime (Best-of-1 / Best-of-3) on the Start screen.
