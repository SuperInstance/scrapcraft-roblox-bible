# MECHANICS-SPEC — Scrapcraft → Roblox Port Bible

**Ground truth: `/home/eileen/projects/Scrapcraft` (READ-ONLY).**
Every number in this document is extracted from source and cited `file:line`.
Machine-readable dumps live in `extracted/*.json`; this spec is the human map of them.

Extraction passes:
- **Pass 1** (`tools/extract-data.mjs`) — module-level export tables: items, blocks, recipes, quests, personas, banter, upgrades, achievements, VPL primitives.
- **Pass 2** (`tools/extract-tuning.mjs`, this finisher) — tuning that lives in class bodies and module-private consts: panic/nightshift, race timing, physics, day/night, weather, trait mechanics, XP award table.

---

## 1. Progression — XP, Levels, Skills

### Level curve — `src/XPSystem.js:140,142`

```
xpForLevel(n) = n² · 10        // XPSystem.js:140
level(xp)     = floor(sqrt(xp / 10))   // XPSystem.js:142
```

| Level | XP required | | Level | XP required |
|---|---|---|---|---|
| 1 | 10 | | 6 | 360 |
| 2 | 40 | | 8 | 640 |
| 3 | 90 | | 10 | 1000 |
| 4 | 160 | | 12 | 1440 |
| 5 | 250 | | 15 | 2250 |

### Skill unlock nodes — `src/XPSystem.js:11-77` (`XP_SKILLS`, dump: `extracted/xp-skills.json`)

| Level | Skill | Gate opened (Earl's own framing, abbreviated) |
|---|---|---|
| 1 | 🔧 Tinkerer | Maker Lab opens (`[T]`) |
| 2 | 🗜️ Scrapper | mining speed ramp (practice framing) |
| 3 | 💡 Programmer | Spark can write tile programs |
| 4 | 🤖 Bot Whisperer | talk-to-bot loop |
| 5 | ⚙️ Engineer | **second bot** (`robot_helper` #2, `Shift+B` own brain) |
| 6 | 📊 Data Head | variable blocks (state between loops) |
| 8 | 🔌 Maker | Wokwi + wiring export buttons |
| 12 | 👁️ Inventor | Vision Brain sensors (Jetson path) |

### XP award table — `extracted/xp-awards.json` (all citations inline)

Mine block +1 (`Game.js:1278`) · mine-drop pickup +2 (`:1189`) · crystal ore bonus +5 (`:1276`) · lucky find +5 (`:1225`) · place block +2 (`:1330`) · program run +15 (`:1042`,`:1579`) · **lap complete +20** (`:3345`) · exchange trade +20 (`:1349`) · airdrop loot +20 (`:1261`) · buried cache +40 (`:1777`) · **radio tower activated +200** (`:1835`) · bot upgrade +50 (`:1379`) · gallery save +50 (`BrainGallery.js:387`) · cannon fire +1 (`:1612`) · grenade +2/block destroyed (`:1648`) · waypoint flag placed +3 (`:1938`) · craft first-time +10 / repeat +3 (`:2057`) · new sensor type +8 (`XPSystem.js:103`) · new variable name +10 (`XPSystem.js:116`) · night-shift return `min(60, 10 + floor(min/30)·5)` (`Game.js:498`) · daily contract `reward.xp + streak bonus` (`DailyContract.js:389`) · challenge `r.xp` per challenge (`Challenge.js:209`) · quest steps carry per-step `rewards.xp` (`quests/data/*.json`).

---

## 2. Economy — items, blocks, recipes, exchange

- **Items:** 14 KB table, `src/data/items.js` → `extracted/items.json`.
- **Blocks:** id map + `BLOCK_DEF` + `ITEM_TO_BLOCK`, `src/data/blocks.js:2,33,101` → `extracted/blocks.json`. Key ids: `AIR=0 DIRT=1 GRAVEL=2 CONCRETE=3 RUST_METAL=4 CLEAN_METAL=5 WOOD_PLANK=6 SCRAP_PILE=7 WORKBENCH=8 FORGE=9 SMELTER=10 OIL_DRUM=11 CRATE=12` … `CRYSTAL_ORE=19 SCRAP_CANNON=20` (`blocks.js:2-31`).
- **Recipes — all 58**, `src/data/recipes.js` (602 lines) → `extracted/recipes.json`. Shape: `{id, output, qty, ingredients:{item:qty}, station, tier}`. Station values include `any` (e.g. wrench = 3 iron + 1 plank, tier 1, `recipes.json[0]`). Station gating (workbench/forge/smelter) is per-recipe.
- **Crafting XP hooks:** first-craft +10, repeat +3 (`Game.js:2057`).
- **ScrapExchange — daily barter board**, `src/ScrapExchange.js:17-43` → `extracted/scrap-exchange.json`:
  - Deal pool: 22 fixed give/get pairs (e.g. 12 iron_scrap → 1 circuit_board; 30 iron_scrap → 1 spark_brain; 3 crystal_fragment → 1 vision_brain).
  - 3 deals/day, deterministic by `floor(Date.now()/86_400_000)` — every player sees the same board (`ScrapExchange.js:15,52-58`).
  - Board at world x=14, z=14, interaction radius 6 (`:41-43`).
- **DailyContract:** daily task board, `src/DailyContract.js` → `extracted/daily-contract.json` (reward xp + streak bonus at `:389`).
- **Airdrops** (+20 XP, `Game.js:1261`), **buried caches** (+40 XP, `:1777`).

---

## 3. Quest spine — the campaign

**Architecture:** declarative quest data under `src/quests/data/*.json`, evaluated by `QuestSystem`/`Tracker`; the **Spine** (`src/quests/Spine.js`, `docs/SPINE.md`, dump `extracted/quest-spine.json`) is a 12-chapter map referencing existing quest ids — data-only, no new logic. Every chapter step carries `rewards: {loot[], xp, bond{persona:pts}, flags[]}` (e.g. bolt-arc step 1: motor_driver ×1, xp 35, bolt bond +10 — `quests/data/bolt-arc.json:14`).

**Arcs (dumps in `extracted/`):**
- `quest-earl-chain.json` (22 KB) — the main Earl tutorial→campaign chain.
- `quest-bolt-arc.json`, `quest-juno-arc.json`, `quest-magma-arc.json`, `quest-rivet-arc.json` — companion arcs (the elastic middle).
- `quest-chapter-quests.json` — chapter-gated quests (e.g. `ch7-1` "The Header": read a build receipt header).
- `quest-side-quests.json`, `quest-yard-arc.json`, `quest-finale.json`.

Chapter 1 excerpt (spine): `ch01 "The Gate Is Never Locked"`, act 1, band 0 "The Yard Gate", anchored to `worldbible/campaign.md · Act One · Ch 1`.

**Port note:** quest rewards write directly into the same XP and companion-bond systems cited above — no separate economy.

---

## 4. Companion system — personas, bond, traits

### Bond events — `src/companion/state.js:28-45` (`BOND_EVENTS`)

| Event | Bond | | Event | Bond |
|---|---|---|---|---|
| first_meet | 0 | | crash_survived | 3 |
| block_mined | 1 | | flash_success | 10 |
| rare_loot | 3 | | conversation | 5 |
| bot_built | 12 | | biome_first | 5 |
| program_run | 4 | | repair_done | 4 |
| lap_complete | 6 | | nudge_followed | 3 |
| race_run | 8 | | ghost_beaten | 10 |
| | | | spark_consult | 4 |

### Tiers — `state.js:47,96-98`

`stranger (0) → coworker (30) → friend (120)` — **never lost** once earned (derived, monotonic).

### Trait mechanics — `personas.js:32-34`, `state.js:150-163`

- `TRAIT_PUSH = 0.04`, `TRAIT_PULL = 0.008`, `TRAIT_FLOOR = 0.08` (`personas.js:32-34`).
- Event fires → if it's in an axis's `events` list, that axis `min(1, v+0.04)`; **every other axis** decays `max(0.08, v−0.008)` (`state.js:150-163`). Traits live in 0..1; `topTrait()` = strongest axis (`state.js:105`).
- Recent-events ring cap 12 (`state.js:50`), drives conversation prompts.

### Personas — `src/companion/personas.js` (dump: `extracted/companion-personas.json`, 2903 lines)

| Persona | Pull vector (mine/build/program/race/flash/explore/repair) | Trait axes (start) |
|---|---|---|
| 🔩 Rivet (default) | 1/1/1/1/1/1/1 — balanced curriculum | scrappy .15, competitive .15, curious .45 |
| ⚡ Bolt | 0.6/0.8/0.8/**3**/0.6/0.6/0.8 — racing | throttle .4, steely .3, trackside .15 |
| 🌋 Magma | 1.2/**3**/1/0.6/**3**/0.6/**3** — workshop | craftwork .45, patience .3, warmth .2 |
| ✨ Juno | 0.8/0.8/1.2/0.8/1/**3**/0.6 — exploration | curiosity .5, experiment .25, boldness .15 |

Per-persona: `pullVector` (curriculum nudge weights), `voice {rate,pitch}`, `colors {body,head,dark,glow}`, `shape {bodyScale, wingNubs, swarm…}` (swarm = Juno renders as orbiting micro-fliers, `avatar.js:18-33`). Banter banks are tier-gated (dump: `extracted/companion-banter-full.json`, 384 lines indexed by event; 506 lines field-trial QC'd at 90.3% per Rift manifesto).

Storage: per-companion key `scrapcraft_companion_<id>`; Rivet keeps legacy `scrapcraft_rivet` (`state.js:24,73`).

---

## 5. Panic Button — "Rocket Overdrive" — `src/PanicButton.js`

- Shows after **3 crashes** without a completed task (`:16`); one press per **5 min** cooldown (`:17`); any completed task (lap/waypoint/challenge) resets the crash count (`:26-29`, reset wiring `Game.js:2386`).
- Fire → **4 s** boost (`Game.js:2412`), speed ×3 (`ScrapBot.js:337,406`), brain tick ×3 (`ScrapBot.js:405-407`), smashes up to **5** smashable blocks within **radius 4**, y∈[1,3] (`PanicButton.js:70`), nearest-first.
- Smashable whitelist: `SCRAP_PILE, RUST_METAL, OIL_DRUM, JUNK_CAR, CONCRETE` (`:60`) — stations/track/ore are never toys.
- Loot cache (`:92-95`): iron_scrap 3+rand(0-2) guaranteed; 60% copper_wire 1-2; 35% small_gear 1. Salvage, not jackpot.
- Design intent (header comment `:1-13`): kids trigger it on purpose — that's the point.

---

## 6. Night Shift — away-time retention — `src/NightShift.js:23-27,61-76`

| Constant | Value | Cite |
|---|---|---|
| Min away | 20 min (below = no shift) | `:23` |
| Iron rate | 1 iron_scrap / 3 min away | `:24,65` |
| Cap | 8 h of earning | `:25` |
| Bonus | guaranteed find / 75 min, max 6 | `:26,67` |
| Bonus pool | circuit_board, spring, gear_small, copper_wire | `:27` |

Deterministic per-day seed (`mulberry32(hashStr('ns:'+dateKey))`, `:52-58,69`) — shareable results. **Requires a brained bot** (`:61`) — the retention hook itself pulls toward crafting. One payout per session start (`NightShiftClock.sessionStart`, `:139-152`).

---

## 7. Race & timing

### Solo ghosts — `src/RaceBoard.js:11-17` (dump: `extracted/race-ghosts.json`)

Earl Jr. 18.4 s · Ratchet 23.2 s · Scrapdog 28.9 s · Gearhead 35.1 s · Rookie Rex 44.8 s (each with bot name + note; Earl quips per beaten ghost at `:19-25`). Player PB merges into the board (`:53-70`), localStorage `sc_raceboard_v1` (`:7`).

### Lap timer (TRACK circuit) — `Game.js:3295-3360`

- Start/finish gate: **x 29.5–46.5, z 13.0–15.5** (y=0) (`:3323`); lap valid only if > **2000 ms** (`:3328`).
- Ghost replay records best lap at **10 Hz** as `[x, z, yaw, ms]` frames (`:3305-3312`); playback mesh = translucent teal bot (`:3395-3405`).
- Per lap: XP +20 (`:3345`), achievement, daily-contract + challenge hooks, confetti at gate center (38, 1.5, 14) (`:3338`), first-autonomous-lap delight ceremony (`:712-721`).
- Second circuit: **Circuit City oval** at x≈49, z≈84 (`:385`).
- Any completed lap resets the panic crash count (`:3343`).

### Multiplayer race Durable Object — `cloudflare/src/durable-bot-race.js` (already built!)

20 fps position broadcast (50 ms), 3-s countdown, 3 laps default, 300-s race timeout (`:30-34`). WebSocket protocol: join/position/lap_complete → race_state/position_update/lap_update/race_finished/countdown/ghost (`:17-30`). Ghost loaded from best historic run (Vectorize) — spectator API via GET `/state`.

---

## 8. Bot physics

### Follow mode — `ScrapBot.js:15-16,320-350`

- `BOT_SPEED = 4.5` blocks/s, follows at `FOLLOW_DIST = 3` (`:15-16`).
- Velocity lerp `5·dt` (`:346`), accel taper `min(1, dist−3+1)` (`:345`), speed_coil ×1.4 (`:342`), panic ×3 (`:337`).
- Wall avoidance: probe 0.9 blocks ahead → try ±45° (`:325-340`). Walk anim sine swing (`:355-360`).

### Brain mode (VPL sim) — `maker/kinematics.js:6-9` (shared by compiler AND simulator — one source of truth)

`DRIVE_SPEED = 3.0` blocks/s @ speed 1.0 · `TURN_RATE = 180°/s` · `BOT_RADIUS = 0.3` · `SONAR_RANGE = 6.0` blocks.

### Battery — `ScrapBot.js:381-410`

Start 100%. Drain: **0.4 %/s idle, 1.3 %/s driving** (`:386`), scaled by edition (`batteryDrainMult`: standard 1.0, gate 1.25 — `data/botEditions.js`), divided by `battery_life` upgrade. Warn at 15%, eyes orange ≤25%, red flash ≤10% (`:396-410`). Dead battery → brain clears, companion reassures, recovery step named (`:388-394`).

### Bot ledger & personality

Bonks become **dents** in a persistent BotLedger (`ScrapBot.js:425-440`); first dent is curriculum; crashes count as `crash_survived` bond for Rivet (`:435`). 27 idle voice lines (`:18-45`). Neopixel/LED effect maps (`:553-575`).

### Player physics — `Player.js:3-5,63,149,159`

`SPEED = 5.2`, `JUMP_VEL = 6.5`, `GRAVITY = −18`; speed ×3 with go_kart tool, ×1.8 sprint/fuel boost (`:149`).

---

## 9. Day/Night — `src/DayNight.js`

- Full cycle = **360 s** (6 real minutes) (`:4`); starts at t=0.35 morning (`:47`).
- 9 keyframes (t, sky, fog, ambient, intensities) at `:6-17` — midnight 0.0 → pre-dawn 0.20 → sunrise 0.28 (sky 0xff6633) → morning 0.35 → noon 0.50 (sun 1.4) → afternoon 0.65 → sunset 0.75 (0xff4422) → dusk 0.82 → midnight 1.0. Linear color lerp between keyframes (`:19-27,72-84`).
- `isNight = t<0.25 || t>0.78` (`:59`); label bands h<5 Night … h≥20 Night (`:60-70`).
- Sun arc: `angle = t·2π − π/2`, position `(cos·50, sin·50+10, 20)` (`:86-87`).
- Stars: 300 points, radius 90, size 0.4, alpha fades through night edges (`:40-57,88-91`).
- Dump: `extracted/daynight-weather.json` (keyframe table machine-readable).

## 10. Weather — `src/WeatherSystem.js`

- State durations: clear 120–240 s, rain 40–90 s, storm 25–60 s (`:5-9`). From clear: 55% rain / 45% storm (`:61`).
- Intensity targets: clear 0, rain 0.65, storm 1.0 (`:62-63`); lerp rate 0.25 up / 0.6 down (`:74`).
- Rain: **1800 points**, 52-block span, recycles outside ±28 of player, spawn y 22–26, fall speed `16 + intensity·12` (`:24,83-95`), opacity `intensity·0.55` (`:81`).
- Storm: thunder every 5–14 s (`:103`), crack + rumble synth (`AudioSystem.thunder`), lightning adds `flash·2.5` to ambient, flash decays `dt·6` (`:105-111`).

---

## 11. Systems cross-references (dumps, not re-derived here)

- **Achievements:** `extracted/achievements-defs.json` (447 lines, id/icon/name/desc + stat hooks).
- **Bot upgrades:** `extracted/bot-upgrades.json` — e.g. turbo_drive: speed ×1.3, 3 gear_small + 2 motor_driver, levelReq 3.
- **Prestige/perks + BackRoom:** `extracted/prestige-perks.json`, `prestige-backroom.json`.
- **VPL (tile programming):** `extracted/vpl-primitives.json` (19 KB op set), `vpl-kinematics.json` (the 4 constants above).
- **Learning layer:** `extracted/learning-brokenbots.json`, `learning-teachback.json`.
- **Landmarks/plaques:** `extracted/landmarks.json`, `plaques.json`.
- **Bot editions + names:** `extracted/bot-editions.json`, `bot-personality.json`.

## 12. Roblox port implications (short list)

1. XP curve and skill gates port 1:1 into Roblox leaderstats + RemoteFunction gates; the numbers are deliberately middle-school paced (level 5 = 250 XP ≈ 30–45 min).
2. All timing constants (race gates, cooldowns, day cycle) are seconds-based and deterministic — map directly to Roblox `RunService`/`os.clock`.
3. The VPL kinematics constants must match EXACTLY on Roblox server (anti-cheat + fair races) — treat `kinematics.js:6-9` as the contract.
4. Night Shift ports to server-side session timestamps — the 20-min/8-h/3-min-per-iron shape is the retention law; don't tune on the client.
5. BOND_EVENTS and trait push/pull are pure functions of an event stream — ideal for Roblox server-side validation with client-side prediction.
