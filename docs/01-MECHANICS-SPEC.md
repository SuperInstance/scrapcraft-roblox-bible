# PORT BIBLE 01 — MECHANICS SPEC (Scrapcraft → Roblox)

> **Source of truth:** `/home/eileen/projects/Scrapcraft/src/` (the JS game).
> Every number below is extracted from source, not guessed. Citations are
> `file:line` relative to `src/`. Where a value is a tuning constant, its
> exact name is given so a port can diff against upstream.
>
> **Companion doc:** phase2-vision lane owns the vision/UX; this spec is the
> mechanics/data side. Cross-refs into vision doc where relevant.

---

## 1. WORLD & TERRAIN

### 1.1 Dimensions and bands (`World.js:19-38`, `World.js:21-28`)
- World: **128 wide × 128 deep × 10 high** blocks (`World(width=128, depth=128, height=10)`, `World.js:19`).
- Four parallel bands along Z, each 32 deep (`World.js:21-28`):

| Band | Z range | Name | Ground mix (generate, `World.js:62-72`) |
|------|---------|------|------------------------------------------|
| 0 | 0–31 | The Yard Gate | 50% CONCRETE, 30% GRAVEL, 20% DIRT |
| 1 | 32–63 | Industrial Corridor | 65% CONCRETE, 35% GRAVEL |
| 2 | 64–95 | Circuit City | 70% CONCRETE, 30% GRAVEL |
| 3 | 96–127 | The Deep Yard | 45% DIRT, 25% CONCRETE, 30% GRAVEL |

- Three 3-wide concrete roads connect bands at **x = 8, 64, 120** (`World.js:79-86`).
- Deterministic generation: LCG `s = (s*1664525 + 1013904223) >>> 0` (`World.js:5-9`), default seed **42** (`World.js:35`).
- Buried signal caches: **6 per world** (one per sub-area), buried 1–2 deep, keys stored as `"x,z"` (`World.js:104-123`).

### 1.2 Block definitions (`data/blocks.js:1-33`)

| ID | Name | Hardness (s) | Drop (chance) | Alt drop (chance) | Notes |
|----|------|-------------|---------------|-------------------|-------|
| 1 | DIRT | 0.3 | — | — | |
| 2 | GRAVEL | 0.3 | — | — | |
| 3 | CONCRETE | 0.7 | — | — | |
| 4 | RUST_METAL | 0.45 | iron_scrap (1.0) | — | |
| 5 | CLEAN_METAL | 0.85 | iron_scrap (0.7) | — | |
| 6 | WOOD_PLANK | 0.35 | wood_plank (1.0) | — | |
| 7 | SCRAP_PILE | 0.4 | iron_scrap (0.8) | gear_small (0.35) | Lucky-find block |
| 8 | WORKBENCH | — | — | — | station: workbench |
| 9 | FORGE | — | — | — | station: forge |
| 10 | SMELTER | — | — | — | station: smelter |
| 11 | OIL_DRUM | 0.55 | fuel_can (0.9) | — | Lucky-find block |
| 12 | CRATE | 0.38 | circuit_board (0.5) | copper_wire (0.8) | |
| 13 | WALL_METAL | 0.95 | — | — | |
| 14 | ROOF_METAL | 0.95 | — | — | |
| 15 | JUNK_CAR | 1.1 | rubber_chunk (1.0) | gear_small (0.6) | Lucky-find block |
| 16 | POWER_BOX | 0.6 | copper_wire (1.0) | circuit_board (0.4) | |
| 17 | FLOODLIGHT | 0.5 | floodlight (1.0) | — | placeable |
| 18 | TRACK | 0.25 | track_strip (1.0) | — | placeable, emissive |
| 19 | CRYSTAL_ORE | 0.6 | glass_shard ×3 (1.0) | battery_dead (0.5) | emissive purple |
| 20 | SCRAP_CANNON | 1.2 | scrap_cannon (1.0) | — | station, placeable |
| 21 | ACID_PUDDLE | 0.1 | rubber_chunk (0.3) | — | hazard acid 4 DPS |
| 22 | BURIED_CACHE | 0.7 | special (`_lootBuriedCache`) | — | signal-radio discovery |
| 23 | HOT_SLAG | 0.1 | iron_scrap (0.6) | — | hazard fire 5 DPS |
| 24 | SOLAR_PANEL | 0.8 | solar_panel (1.0) | — | placeable |
| 25 | BEACON | 0.5 | signal_beacon (1.0) | — | placeable |

- Hardness = **seconds to mine holding left click** (`data/blocks.js:7` comment; `Game.js:1176-1177` `_mineProgress += dt / hardness`).
- **y=0 is unmineable** (`Game.js:1174`).

### 1.3 Mining & loot pipeline (`Game.js:1166-1290`)

- XP: **+2 XP per block mined** (`Game.js:1203`).
- Drop roll: `if (def.drop && Math.random() < def.dropChance)` → qty = `def.dropQty ?? 1` (`Game.js:1215-1218`); alt drop rolled separately.
- **Scrap Magnet** (held): +60% chance of bonus `def.drop` on metal blocks {SCRAP_PILE, RUST_METAL, CLEAN_METAL, WALL_METAL} (`Game.js:1221-1225`).
- **Lucky Find**: 3% base, **8% at night** on junk blocks {SCRAP_PILE, OIL_DRUM, JUNK_CAR} (`Game.js:1227-1240`). Pool: battery_pack, ir_module, circuit_board, ldr_module, spring, gear_small, crystal_fragment. First junk block EVER mined is a guaranteed lucky find (persisted, `first_lucky_find` delight). +5 XP.
- **Airdrop crates**: weighted loot ×3 draws (`Game.js:1248-1272`): circuit_board w3, battery_pack w3, crystal_fragment w2, ir_module w2, copper_wire w4, gear_small w3, scrap_grenade w1, fuel_can w2. +20 XP.
- Buried cache → `_lootBuriedCache` (radio-triggered, see equipment section).
- Night bonus: rare drop rate 8% from junk piles, HUD banner once per night (`Game.js:1235-1243`).

---

## 2. XP & LEVELS (`XPSystem.js`)

### 2.1 Curve (`XPSystem.js:6-11`, `XPSystem.js:110-112`)
```
level = floor(sqrt(xp / 10))
xpForLevel(n) = n² × 10
```

| Level | Total XP needed | Delta |
|-------|----------------|-------|
| 1 | 10 | 10 |
| 2 | 40 | 30 |
| 3 | 90 | 50 |
| 4 | 160 | 70 |
| 5 | 250 | 90 |
| 6 | 360 | 110 |
| 8 | 640 | — |
| 12 | 1440 | — |

### 2.2 XP sources
| Source | XP | Citation |
|--------|----|----------|
| Mine a block | 2 | `Game.js:1203` |
| Lucky find | 5 | `Game.js:1237` |
| Airdrop loot | 20 | `Game.js:1270` |
| First use of a sensor type | 8 (one-time) | `XPSystem.js:66-70` |
| First use of a distinct variable name | 10 (one-time each) | `XPSystem.js:75-84` |
| Quest rewards | 25–100 | `quests/data/*.json` (see §5) |

### 2.3 Skill unlocks (`XPSystem.js:16-83`)
| Level | Skill | Unlocks |
|-------|-------|---------|
| 1 | Tinkerer | Maker Lab (T key) |
| 2 | Scrapper | Mining faster quips |
| 3 | Programmer | Spark AI in Tile Editor |
| 4 | Bot Whisperer | Companion talk |
| 5 | Engineer | Second bot (Shift+B), both run |
| 6 | Data Head | Variable blocks in Tile Editor |
| 8 | Maker | Wokwi/wiring export buttons |
| 12 | Inventor | Vision Brain sensors |

---

## 3. ECONOMY — ITEMS, RECIPES, EXCHANGE

### 3.1 Items (`data/items.js`)
~60 item ids across categories: material, tool, device, vehicle, companion, wearable, utility, consumable, maker. Stack sizes: iron_scrap/copper_wire/track_strip 64; rubber/gear/wood/glass/spring 32; circuit/fuel/battery_dead 16; crafted devices 1–8; brains 1; modules 2–4. Tools are `tool: true` + `unlocks` tag (wrench→mechanical, hammer→structure, blowtorch→welding, pliers→electrical). Placeables: track_strip, floodlight, signal_beacon, scrap_cannon, solar_panel.

### 3.2 Crafting stations (`data/recipes.js`)
- Stations: `any`, `workbench`, `forge`, `smelter`; some recipes require a **tool** in inventory (wrench/hammer/pliers/blowtorch) and some an **unlockAfter** item (crafted-set gate).
- **Tiers**: 1 (hand tools/utility), 2 (devices), 3 (advanced/prestige).

**Tier 1:**
| Recipe | Output | Ingredients | Station/Tool |
|--------|--------|-------------|--------------|
| r_wrench | wrench | 3 iron_scrap + 1 wood_plank | any |
| r_hammer | hammer | 2 iron_scrap + 2 wood_plank | any |
| r_pliers | pliers | 2 iron_scrap + 1 copper_wire | any |
| r_blowtorch | blowtorch | 3 iron_scrap + 2 copper_wire + 1 fuel_can | workbench |
| r_repair_kit | repair_kit | 2 rubber + 1 copper_wire + 1 spring | any |
| r_signal_flare | signal_flare ×3 | 1 fuel_can + 2 copper_wire | any |
| r_steel_cable | steel_cable ×4 | 3 iron_scrap + 2 spring + 1 rubber | forge/hammer |
| r_glass_smelt | glass_shard ×4 | 1 rubber + 2 iron_scrap | smelter |
| r_track_strip | track_strip ×8 | 2 rubber + 1 iron_scrap | workbench |
| r_floodlight | floodlight | 2 glass_shard + 2 copper_wire + 3 iron_scrap | workbench |
| r_tin_brain | tin_brain | 2 circuit_board + 4 copper_wire + 3 iron_scrap | workbench/pliers |
| r_ultrasonic_module | ultrasonic_module | 1 circuit_board + 2 copper_wire | workbench |
| r_ldr_module | ldr_module ×2 | 1 circuit_board + 1 copper_wire | workbench |
| r_buzzer_module | buzzer_module ×2 | 1 gear_small + 1 copper_wire | workbench |
| r_motor_driver | motor_driver | 1 circuit_board + 2 iron_scrap | workbench |
| r_rubber_boots | rubber_boots | 4 rubber + 2 iron_scrap | workbench |
| r_waypoint_flag | waypoint_flag ×2 | 2 iron_scrap + 1 copper_wire + 1 rubber | workbench |

**Tier 2:**
| Recipe | Output | Ingredients | Station/Tool | Unlock |
|--------|--------|-------------|--------------|--------|
| r_pipe_cannon | pipe_cannon | 5 iron + 1 rubber + 2 spring | workbench/wrench | — |
| r_battery_pack | battery_pack ×2 | 2 battery_dead + 3 copper_wire + 1 rubber | workbench/pliers | — |
| r_spring_boots | spring_boots | 4 spring + 2 rubber + 2 iron | workbench/hammer | — |
| r_robot_arm | robot_arm | 4 iron + 3 gear + 2 copper_wire | forge/blowtorch | — |
| r_generator | generator | 6 iron + 4 gear + 2 fuel + 3 copper_wire | forge/wrench | — |
| r_radio_beacon | radio_beacon | 2 circuit + 4 copper_wire + 1 glass + 2 iron | workbench/pliers | — |
| r_night_goggles | night_goggles | 2 glass + 3 copper_wire + 1 circuit + 1 rubber | workbench/pliers | — |
| r_grapple_hook | grapple_hook | 2 steel_cable + 3 iron + 1 spring | workbench/wrench | r_steel_cable |
| r_charging_pad | charging_pad | 2 circuit + 2 battery_pack + 3 copper_wire + 2 iron | workbench/pliers | r_battery_pack |
| r_shock_absorber | spring_boots (2nd path) | 6 spring + 3 rubber + 2 iron | forge/hammer | r_steel_cable |
| r_gear_train | generator (2nd path) | 6 gear + 4 iron + 2 copper_wire + 2 spring | forge/wrench | r_generator |
| r_copper_spool | copper_wire ×8 | 2 gear + 3 iron + 1 rubber | forge/blowtorch | — |
| r_sensor_array | radio_beacon (alt) | ultrasonic + ldr + buzzer + 2 circuit | workbench/pliers | r_tin_brain |
| r_spark_brain | spark_brain | 1 tin_brain + 3 circuit + 6 copper_wire + 1 fuel | smelter/blowtorch | r_tin_brain |
| r_pir_module | pir_module | 1 circuit + 1 rubber | workbench | r_spark_brain |
| r_servo_module | servo_module | 2 gear + 2 copper_wire | workbench | r_spark_brain |
| r_ir_module | ir_module ×4 | 1 circuit + 2 copper_wire | workbench | — |
| r_antenna | antenna | 4 copper_wire + 2 iron + 1 glass | workbench | — |
| r_headlamp | headlamp | 1 glass + 2 copper_wire + 1 battery_pack + 2 iron | workbench/pliers | — |
| r_scrap_cannon | scrap_cannon ×2 | 6 iron + 3 spring + 2 gear + 1 rubber | forge/wrench | — |
| r_speed_coil | speed_coil | 3 spring + 2 copper_wire + 1 gear | workbench | — |
| r_signal_amp | signal_amp | 2 ir_module + 2 copper_wire + 1 circuit | workbench | — |
| r_flare_pack | flare_pack | 3 signal_flare + 1 rubber + 1 battery_dead | workbench | — |
| r_scrap_grenade | scrap_grenade ×3 | 3 iron + 1 fuel + 1 rubber | workbench | — |
| r_ore_scanner | ore_scanner | 2 ir_module + 1 circuit + 2 copper_wire | workbench | r_ir_module |
| r_signal_radio | signal_radio | 1 pir_module + 3 copper_wire + 1 antenna | workbench | r_pir_module |
| r_solar_panel | solar_panel | 4 glass + 3 copper_wire + 2 circuit + 2 iron | workbench/pliers | — |
| r_comm_relay | comm_relay | 1 signal_radio + 2 circuit + 3 copper_wire | workbench/pliers | r_signal_radio |
| r_signal_beacon | signal_beacon ×2 | 3 copper_wire + 1 crystal_fragment + 1 circuit | workbench/pliers | — |

**Tier 3:**
| Recipe | Output | Ingredients | Station/Tool | Unlock |
|--------|--------|-------------|--------------|--------|
| r_go_kart | go_kart | 8 iron + 4 rubber + 6 gear + 4 wood | forge/wrench | generator |
| r_robot_helper | robot_helper | 2 robot_arm + 4 circuit + 6 gear + 2 battery_pack + 5 copper_wire | smelter/blowtorch | robot_arm |
| r_robot_helper_starter | robot_helper_starter (Gate Edition) | SAME ingredients | workbench/wrench | robot_arm |
| r_flying_machine | flying_machine | 12 iron + 1 generator + 2 robot_arm + 6 circuit + 4 rubber + 4 fuel + 3 glass | smelter/blowtorch | go_kart |
| r_mega_battery | battery_pack ×4 | 6 battery_dead + 4 copper_wire + 2 rubber + 1 fuel | smelter/blowtorch | r_battery_pack |
| r_vision_brain | vision_brain | 1 spark_brain + 5 circuit + 3 glass + 2 fuel | smelter/blowtorch | r_spark_brain |
| r_camera_module | camera_module | 2 glass + 2 circuit | workbench | r_vision_brain |
| r_scrap_magnet | scrap_magnet | 4 iron + 3 copper_wire + 1 battery_pack | forge | — |
| r_magnet_gloves | magnet_gloves | 1 scrap_magnet + 2 rubber + 3 copper_wire + 2 spring | forge/blowtorch | r_scrap_magnet |
| r_steam_boiler | steam_boiler | 8 iron + 4 gear + 3 fuel + 3 copper_wire | forge/blowtorch | r_generator |
| r_pneumatic_drill | pneumatic_drill | 6 iron + 4 gear + 2 rubber + 3 spring | forge/wrench | r_steam_boiler |
| r_radar_dish | radar_dish | 3 circuit + 5 copper_wire + 1 antenna + 3 iron | workbench/pliers | r_antenna |

**Bot upgrade note:** `r_robot_helper_starter` = "Gate Edition" — same parts as smelter bot, weaker stats (see `data/botEditions.js`), craftable at gate workbench with wrench — closes cold-start friction.

### 3.3 Passive equipment effects (hold-in-inventory / hold-in-hand)
| Item | Effect | Citation |
|------|--------|----------|
| speed_coil | +40% bot speed | `data/items.js` (speed_coil desc) |
| signal_amp | ore scanner range 10 → 16 blocks | `maker/GameWorldAdapter.js:206` |
| flare_pack | doubles supply-drop frequency | `data/items.js` |
| rubber_boots | immune to acid puddles | `data/items.js` |
| scrap_magnet | pulls drops toward player | `data/items.js` |
| ore_scanner | compass arrow to crystal ore within 24 blocks | `data/items.js` |
| signal_radio | 433 MHz cache detector, signal bars + arrow | `data/items.js` |
| pneumatic_drill | 3× mine speed on metal/stone | `data/items.js` |
| magnet_gloves | pulls drops from 2 blocks | `data/items.js` |
| radar_dish | maps ore onto minimap | `data/items.js` |

### 3.4 Scrap Exchange — daily barter board (`ScrapExchange.js`)
- Position: **(14, 14)**, radius 6 (`ScrapExchange.js:76-79`).
- **3 deals per real-world day**, keyed `floor(Date.now()/86_400_000)`, deterministic per day via **Mulberry32** seeded RNG (`ScrapExchange.js:96-103`).
- Pool of **22 deals** (`ScrapExchange.js:13-71`), e.g.:
  - 12 iron_scrap → 1 circuit_board
  - 8 copper_wire → 1 battery_pack
  - 3 crystal_fragment → 1 vision_brain
  - 30 iron_scrap → 1 spark_brain
  - 20 copper_wire → 1 camera_module
- Trades counted (`tradesCompleted`, saved); no daily trade limit per player.

### 3.5 Daily Salvage Contract (`DailyContract.js`)
- One contract per calendar day, seeded pick from `CONTRACT_POOL` (`DailyContract.js:62-63`); chapter warmups feed candidates too.
- Pool (11+ types): collect (20 iron, 12 copper, 8 gear), mine_block (15 scrap piles, 12 rust heaps, 20 concrete, 8 barrels), craft 4 items, bot_run 120s, bot_lap 3 laps, spark ask 2, etc.
- Rewards 120–180 XP + items (2 battery_pack, circuit_board, gear ×3, crystal_fragment…). Target: **10–15 min**, splittable across two sittings (`DailyContract.js:119-121`).
- Day streak + daysPlayed persisted (see save schema §03).

### 3.6 Night Shift — idle bot scavenging (`NightShift.js`)
- Requires owning a brained bot (`NightShift.js:16-17`).
- **Min away: 20 min** (`NS_MIN_AWAY_MS`, `NightShift.js:32`) — below that, nothing.
- **1 iron_scrap per 3 min away** (`NS_RATE_MIN`, `NightShift.js:33`).
- **Guaranteed bonus find every 75 min** (`NS_BONUS_EVERY`, `NightShift.js:35`); pool: circuit_board, spring, gear_small, copper_wire (`NightShift.js:36`).
- **Hard cap 8 h** (`NS_CAP_MS`, `NightShift.js:34`).

### 3.7 Prestige — Earl's Back Room (`prestige/Prestige.js`)
- **Finite economy: 6 marks max** — 1 per completed companion arc (bolt/magma/juno/rivet) + 2 for the Midnight Race finale (`Prestige.js:9-13`, `MARK_AWARDS`, `Prestige.js:53-58`).
- Backroom catalog: paint schemes, yard decorations, lantern colors, bot slots (`BACKROOM_CATALOG`, `Prestige.js:32-37`).

---

## 4. COMPANION BOND SYSTEM (`companion/state.js`, `companion/personas.js`)

### 4.1 Tiers & thresholds (`state.js:33-35`)
```
stranger: 0    coworker: 30    friend: 120
```
Tiers are monotonic — bond never decreases, tiers never lost.

### 4.2 BOND_EVENTS — bond points per shared event (`state.js:24-45`)
| Event | Bond |
|-------|------|
| first_meet | 0 (staying is what counts) |
| block_mined | 1 |
| rare_loot | 3 |
| bot_built | 12 |
| program_run | 4 |
| lap_complete | 6 |
| race_run | 8 |
| crash_survived | 3 |
| flash_success | 10 |
| conversation | 5 |
| biome_first | 5 |
| repair_done | 4 |
| nudge_followed | 3 |
| ghost_beaten | 10 |
| spark_consult | 4 |

**Real events only — no timers, no pity points** (`state.js:23`).

### 4.3 Per-companion state (`state.js:56-86`)
- Storage key: `scrapcraft_companion_<personaId>` (Rivet legacy: `scrapcraft_rivet`), schema v1.
- State: bond, **traits** (persona-defined axes, start value from persona), **counters** (13: blocksMined, rareLoot, botsBuilt, programsRun, laps, races, crashes, flashes, conversations, repairs, nudgesFollowed, ghostsBeaten, sparkAsks), biomes[] (first visit = event), recent[] ring (cap 12), nudgesDone[], firstMetAt, banterRecent{}.
- Trait mechanics: event matching persona trait `def.events` → trait +`TRAIT_PUSH`, all others −`TRAIT_PULL` clamped at `TRAIT_FLOOR` (`state.js:136-143`; constants in `personas.js`).

### 4.4 Personas (`companion/personas.js`, 862 lines)
4 companions: **Bolt** (racer, oval), **Magma** (workshop/lifter), **Juno** (explorer/swarm), **Rivet** (yard keeper, legacy). Each defines trait axes, event affinities, banter banks. `registry.js` manages roster; story `quilt()` in `companion/entry.js` composes per-run narrative identity (saved as `story`).

### 4.5 Quest bond rewards
Companion arc quests award **+10 bond** each (bolt/magma/juno/rivet arcs, `quests/data/*-arc.json`), side quests +10/12/15 (escalating per persona).

---

## 5. QUEST CAMPAIGN — 65 QUESTS (`quests/data/`, `quests/schema.js`)

### 5.1 Composition (`quests/data/index.js:20-33`)
| File | Count | Notes |
|------|-------|-------|
| earl-chain.json | 20 | Earl's main chain, 3 acts |
| bolt-arc.json | 5 | racing arc |
| magma-arc.json | 5 | workshop arc |
| juno-arc.json | 5 | exploration arc |
| rivet-arc.json | 5 | yard arc |
| finale.json | 1 | Midnight Race (gated on 2 completed arcs) |
| chapter-quests.json | 9 | lived chapters ch7–9, Earl-voiced |
| side-quests.json | 14 | 3 beats × 4 personas, friend-gated + debug clinic + optimization dare |
| yard-arc.json | 1 | second-arc hook |

**Total: 65 quests.** XP reward range **25–100** (sum 2277). Finale reward: vision_brain ×1 + crystal_fragment ×10 + flag `yard_legend` (100 XP).

### 5.2 Quest schema (`quests/data/*.json` sample keys)
`id, arc, title, brief, affinity, objectives[], prerequisites[], rewards{loot[], xp, bond{}, flags[]}, teaching`

### 5.3 THE SPINE — 12 chapters (`quests/data/spine.json`, `quests/Spine.js`)
Chapter map over CAMPAIGN ids (data-only, no new quests):

| Ch | Act | Title | Band | Band name | Quests (carriers) | unlockBand |
|----|-----|-------|------|-----------|-------------------|------------|
| 1 | 1 | The Gate Is Never Locked | 0 | Yard Gate | earl-1, earl-3, earl-10 | 0 |
| 2 | 1 | Earn Your Tools | 0 | Yard Gate | earl-2, magma-1 | 0 |
| 3 | 1 | Something With Thumbs | 0 | Yard Gate | earl-4, earl-5, rivet-1 | 1 |
| 4 | 1 | One Knob at a Time | 0 | Yard Gate | earl-6, earl-7, juno-4 | 1 |
| 5 | 2 | The Oval Has Opinions | 2 | Circuit City | earl-9, juno-1, bolt-1 | 2 |
| 6 | 2 | The Library of Almosts | 3 | Deep Yard | earl-11, earl-16, juno-3 | 3 |
| 7 | 2 | The Same Robot, Real | 0 | Yard Gate | earl-8, magma-3, earl-18, earl-15 | 3 |
| 8 | 2 | Fail Loudly | 2 | Circuit City | juno-2, rivet-4, juno-5 | 3 |
| 9 | 2 | Candlelight at 11:58 | 2 | Circuit City | earl-12, bolt-3 | 3 |
| 10 | 2 | The Manifest of Midnights | 0 | Yard Gate | earl-13, rivet-3, earl-14, earl-17 | 3 |
| 11 | 3 | The Back Room | 0 | Yard Gate | rivet-2, earl-19, rivet-5 | 3 |
| 12 | 3 | The Midnight Race | 2 | Circuit City | bolt-5, magma-5, earl-20, finale-midnight-race | 3 |

- Each chapter: `openingLine`, `closingLine`, `skill` (learning goal), `delight` (payoff moment), `pullVector` (per-persona hook line).
- Spine state: chapter position (monotonic), ceremonies (once-ever per chapter, persisted `scrapcraft_spine_v1`), soft band unlocks (nudge, never a wall) (`Spine.js`).
- **Finale gate: any two completed companion arcs** (campaign doc, `quests/data/index.js:1-8`); spine-side failsafe: all pre-finale carriers done also unlocks it (`Spine.js:126-132`).

### 5.4 Earl chain (legacy QUESTS, `Foreman.js:380+`)
q1 Scrap Hunt (5 iron) → q2 First Tools (craft wrench) → q3 Power Up (craft generator) → q4 Build a Friend (robot_arm + robot_helper) → … (20 quests; merged into earl-chain.json campaign ids earl-1..20).

---

## 6. SCRAPBOT & BOT PROGRAMMING (`ScrapBot.js`, `maker/`)

### 6.1 Bot core stats (`ScrapBot.js:15-16`, `maker/kinematics.js:6-9`)
- `BOT_SPEED = 4.5` (follow speed), `FOLLOW_DIST = 3` (`ScrapBot.js:15-16`).
- Sim kinematics: `DRIVE_SPEED = 3.0` blocks/s at speed=1; `TURN_RATE = 180`°/s; `BOT_RADIUS = 0.3`; `SONAR_RANGE = 6.0` blocks (`kinematics.js:6-9`).
- Sensor range multiplier from bot upgrades (default 1.0, `ScrapBot.js:227-228`).

### 6.2 Bot hardware upgrades (`BotUpgrades.js:16-67`)
| Upgrade | Stat | Multiplier | Cost | Prereq | Lv |
|---------|------|-----------|------|--------|----|
| turbo_drive | speed | 1.3 | 3 gear_small + 2 motor_driver | — | 3 |
| extended_battery | battery_life | 2.0 | 3 battery_pack + 2 copper_wire | — | 3 |
| precision_encoder | precision | 1.25 | 2 circuit + 2 spring + 1 crystal_fragment | turbo_drive | 5 |
| wide_angle_sensors | sensor_range | 1.6 | 2 pir + 2 ultrasonic + 1 circuit | extended_battery | 5 |
| neural_optimizer | tick_speed | 1.4 | 3 circuit + 2 crystal_fragment + 1 spark_brain | precision + wide | 8 |

### 6.3 Brain tiers (`maker/primitives.js:660-663`)
- **tin** — Arduino Uno (ATmega328P), platform `uno`
- **spark** — ESP32, platform `esp32`
- **vision** — Jetson Nano, platform `jetson`

### 6.4 Sensor vocabulary (19) (`maker/primitives.js:35-436`)
brightness (LDR A0), distance_ahead (HC-SR04), bumped (bumper D4), is_dark, player_near, sees_color, target_bearing, target_distance, line_under (TCRT5000), compass, temperature, weather, color_sensor, waypoint_dist, waypoint_bearing, ore_nearby (magnetometer, 10 blocks / 16 with signal_amp), floor_type, battery, beacon_signal, sees_target.

### 6.5 Actuator vocabulary (11) (`maker/primitives.js:439-650`)
drive, turn, stop, beep, led, grab, speak, servo_angle, add_score, neopixel, (vision).

### 6.6 Tile program node types (`maker/TileProgram.js:50-91`)
action, wait, repeat, forever, if, if_else, macro, cond (sensor/cmp/value), not, set_var, change_var, varCond, varVsCond, repeat_until, break, print, comment, random_var, read_sensor, math_var (add/sub/mul/div), wait_until.
- Serialization: JSON schema v1; share via base64 `?brain=` (`toShareCode`/`fromShareCode`).
- Example programs: wall avoider, light runner, line follower, square, ore hunter, battery saver, waypoint nav, bump counter (`TileProgram.js:162-352`).
- Firmware export: Arduino (`toArduino`), MicroPython (`toMicroPython`), Wokwi diagram, wiring SVG (`maker/FirmwareGen.js`).

---

## 7. RACING & CHALLENGES

### 7.1 Race board (`RaceBoard.js`, `companion/` nudge)
- Oval: track rectangle x=30–46, z=14–22 with walled straightaways (built in `World.js:213-241`); June's baseline lap: "twenty-three flat" (`spine.json` ch05 openingLine).
- Ghost laps persisted (`_bestGhostFrames`, oval variants); beating a board name = `ghost_beaten` (10 bond).

### 7.2 Challenge system (`Challenge.js`, `ChallengeSystem.js`)
- Session challenges polled **every 60 s** from classroom worker (`ChallengeSystem.js:16`), types: collect (iron 5, rubber 3, crystal 2, copper 4, gear 3), mine_block (concrete 8, scrap_pile 6, rust_metal 5, oil_drum 4), craft 2–3, bot_run 20/60s, bot_on_track 30s, bot_charge 1, bot_sensor 1, bot_lap 1, bot_variable 1, bot_variable_cond 1 (`Challenge.js:8-99`).
- Grading A+/A/B/C/D with grade colors (`ChallengeSystem.js:17-18`); teacher leaderboard via worker (`/api/v1/class/{code}/leaderboard`).

---

## 8. DAY/NIGHT & WEATHER

### 8.1 Day cycle (`DayNight.js:4-21`)
- **Full cycle = 360 s (6 min)**. Start at t=0.35 (morning). 9 keyframes lerped: midnight(0), pre-dawn(0.20), sunrise(0.28), morning(0.35), noon(0.50), afternoon(0.65), sunset(0.75), dusk(0.82), midnight(1.00). 300 star particles.
- Night mechanics: +8% lucky-find chance, night mines stat, floodlight/headlamp usage.

### 8.2 Weather (`WeatherSystem.js:5-8`)
- Durations (seconds): clear 120–240, rain 40–90, storm 25–60. 1800-particle rain cloud, fall speed 16–28; lightning/thunder; 4 band ambiences (see asset inventory).

### 8.3 Hazards
- ACID_PUDDLE: 4 DPS (rubber_boots immune). HOT_SLAG: 5 DPS fire. Night goggles make night visible; floodlights push back dark.

---

## 9. PLAYER

- HP 100/max 100 (`Player.js:20-21`); 36-slot inventory (`Player.js:26`), hotbar 1–9 (`Player.js:44`).
- Movement: WASD + sprint (sprint sfx), jump, E interact, G plant waypoint/throw grenade, Shift+B second bot, T Maker Lab, right-click fire cannon.
- Mining target via renderer raycast; crack overlay + progress bar during mine (`Game.js:1181-1184`).

---

## 10. TUNING CONSTANTS INDEX (quick diff table)

| Constant | Value | File |
|----------|-------|------|
| World size | 128×128×10 | World.js:19 |
| Default seed | 42 | World.js:35 |
| Day cycle | 360 s | DayNight.js:5 |
| Hardness (per block) | 0.25–1.2 s | data/blocks.js |
| Mine XP | 2 | Game.js:1203 |
| XP formula | floor(√(xp/10)) | XPSystem.js:110-112 |
| Sensor first-use XP | 8 | XPSystem.js:66 |
| Variable first-use XP | 10 | XPSystem.js:75 |
| Lucky find | 3% / 8% night | Game.js:1228-1229 |
| Bond tiers | 0/30/120 | state.js:33 |
| Bond recent cap | 12 | state.js:47 |
| Night Shift min | 20 min | NightShift.js:32 |
| Night Shift rate | 1 iron/3 min | NightShift.js:33 |
| Night Shift bonus | every 75 min | NightShift.js:35 |
| Night Shift cap | 8 h | NightShift.js:34 |
| Autosave | 30 s | SaveSystem.js:10 |
| Exchange deals/day | 3 | ScrapExchange.js:90 |
| BOT_SPEED | 4.5 | ScrapBot.js:15 |
| SONAR_RANGE | 6.0 blocks | kinematics.js:9 |
| DRIVE_SPEED | 3.0 b/s | kinematics.js:6 |
| TURN_RATE | 180°/s | kinematics.js:7 |
| Ore scan range | 10 (16 w/ amp) | GameWorldAdapter.js:206 |
| Upgrade multipliers | 1.25–2.0 | BotUpgrades.js |
| Marks economy | 6 max | Prestige.js |
| Rain/storm/clear | 40–90/25–60/120–240 s | WeatherSystem.js:5-8 |

---

*Extracted 2026-08-23 from Scrapcraft HEAD (working tree at `/home/eileen/projects/Scrapcraft`). Verify against `git log` on the Scrapcraft repo before porting final numbers.*
