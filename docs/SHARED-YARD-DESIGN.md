# SHARED-YARD-DESIGN — Scrapcraft as a multiplayer Roblox yard

**Design bible for the co-op port.** Doctrine cross-refs: `/home/eileen/projects/Scrapcraft/docs/cns/RIFT-MANIFESTO.md` ("a game is not a product, a game is a **sensory organ**") and `docs/cns/MAPPING-SPEC-V2.md` (USCP: *Ingest → Enrichment → Sink*). Mechanically everything below anchors to cited single-player source — the shared yard is the same yard, with per-player state fanned out and one CNS watching all of it.

The Saddle/kennel doctrine, extended: **many organs, one CNS.** In single-player, Scrapcraft is one organ wired to the fleet through the Rift. A shared yard is a *litter* of organs — every kid a sensory surface, every lap and dent a nerve ending — feeding the same Quilt. The kennel rung ("the skill left the runtime and went into the blood," MAPPING-SPEC-V2 §equipment) is what makes this safe: tile programs are pure JSON genomes (reproduce, vary, share — gallery is already reproduction-with-variation), so multiplayer doesn't fork the skill system, it widens the gene pool.

---

## 1. Co-op mining

**Solo ground truth:** mining is per-block with XP +1 (`Game.js:1278`), drops +2 (`:1189`), crystal bonus +5 (`:1276`), lucky finds +5 (`:1225`), airdrops +20 (`:1261`), buried caches +40 (`:1777`). Blocks are a shared voxel grid (`World.js`, block ids `data/blocks.js:2-31`).

**Shared design:**
- **Grid is server-authoritative.** Roblox server holds the voxel world; clients mine via RemoteEvent, server validates reach (≈6 blocks, matching `EXCHANGE_RADIUS=6` interaction precedent, `ScrapExchange.js:43`) and tool, then broadcasts the block-break + drop.
- **Loot: helper-gets, not racing.** First-hit mines the block (kid-simple), but drops go to *whoever's inventory has room for the item type* with everyone in a 8-block radius getting the mining XP (+1 each — XP is not zero-sum; friendship is). Crystal ore's +5 bonus goes to the miner. This keeps two kids mining together *together*.
- **Panic Button stays personal** (3 crashes → 5-min cooldown, `PanicButton.js:16-17`) but Rocket Overdrive's smash radius 4 (`:70`) must be **server-side and can never target another player's placed blocks** — extend the existing whitelist doctrine (`SMASHABLE_BLOCKS`, `:60`: stations/track/ore "are NOT toys") with: *another player's build is not junk either*.
- **Airdrops/cache ceremonies scale:** one per yard, broadcast, first-come — but the +40 XP cache grants to everyone who participated in the dig (server tracks damage contributors).

## 2. Live race events + leaderboards

**Solo ground truth:** lap gate x 29.5–46.5, z 13.0–15.5, min-lap 2000 ms (`Game.js:3323,3328`), 10 Hz ghost frames (`:3305-3312`), +20 XP/lap (`:3345`); 5 NPC ghosts 18.4–44.8 s (`RaceBoard.js:12-16`).

**Already built:** `cloudflare/src/durable-bot-race.js` — the multiplayer race Durable Object: 20 fps position broadcast (`POSITION_BROADCAST_MS = 50`), 3-s countdown, 3 laps default, 300-s timeout (`:30-34`), WebSocket protocol `join/position/lap_complete → race_state/position_update/lap_finished/countdown/ghost` (`:17-30`), spectator API (`GET /state`), Vectorize ghost from best historic run. **This is the reference implementation; port its protocol semantics to Roblox server scripts.**

**Shared design:**
- **Scheduled race events** (hourly "Circuit City Nights"): server-created race lobby using the DO protocol shape; countdown + position updates at 20 Hz (Roblox: ~0.05 s heartbeat batch, matches existing constant).
- **Leaderboards:** yard-global OrderedDataStore (weekly PB board) + the 5 NPC ghosts preserved as the *training ladder* (`RaceBoard.js:11-17`) — a kid's first leaderboard win is beating Rookie Rex, not a stranger. Ghost-beaten stays a bond event (+10, `state.js:28-45`) and now emits yard-wide Earl fanfare.
- **Ghost replay:** keep the 10 Hz `[x,z,yaw,ms]` frame format (`Game.js:3305-3312`) as the shared ghost interchange; best historic runs feed the CNS ghost lane exactly as the DO already sketches (`/ghost` endpoint).

## 3. Per-player companions

**Solo ground truth:** one `CompanionState` per persona, per-player key `scrapcraft_companion_<id>` (`state.js:24,73`); bond from `BOND_EVENTS`, tiers 0/30/120 never lost (`:47`); traits push 0.04 / pull 0.008 / floor 0.08 (`personas.js:32-34`).

**Shared design:**
- Each player's companion state is **private state on their player object** (server-owned, replicated only to them). Bond is *earned by real events* (`state.js:27` — "no timers, no pity points") and events are server-validated, so bond is cheat-proof by construction.
- **Companions are visible to others** (the avatar rig, `avatar.js` — copper Rivet, swarm Juno, etc.) but only *converse* with their own kid. In a shared yard, other kids see your friend bobbing at your shoulder — social proof of the friendship system without exposing any dialogue.
- Per-persona pull vectors (Bolt→racing, Magma→workshop, Juno→exploration, `personas.js` pullVector) naturally **sort a crowd**: kids with Bolts cluster at the oval, Magmas at the forges. Design for this — place persona-flavored gathering spots.
- Banter banks are per-tier gated (`companion-banter-full.json`) — no change needed, just per-player instance state. VOICE-QC bar (`docs/VOICE-QC.md`, 90.3% field-trial pass) applies verbatim to any new multiplayer lines.

## 4. Earl NPC queue

**Solo ground truth:** Earl is the foreman voice — quest chain (`quest-earl-chain.json`, 22 KB), skill-unlock quips (`XPSystem.js:11-77`), ghost beat-quips (`RaceBoard.js:19-25`), event reactions via `Foreman.onEvent` (50+ call sites in Game.js).

**Shared design:**
- Earl is **one NPC, one server-side conversation queue** — first-come, everyone sees who's talking to Earl (a small physical queue at the office, kid-legible: you can *see* the line).
- **Quest handout is instanced** (Earl speaks to you from the queue window), but Earl's **yard-wide announcements are a broadcast lane**: race winners, weather changes (solo already fires Earl on weather change — `WeatherSystem.tick` returns `_changed` for exactly this, `WeatherSystem.js:54-58`), nightfall, cache discoveries.
- Rate-limit the queue with the same patience the solo game shows kids: no timed dismissal, but the queue UI shows "Earl's with [name] — you're #2" so waiting is a lesson, not a punishment. (Earl being busy is lore-consistent: 30 years running the yard, `XPSystem.js:55`.)

## 5. DataStore schema per player

**Ground truth:** `SaveSystem.js` — schema **version 6, additive, fail-soft** (`scrapcraft_save_v6`, `:23-26,33`; refuses only NEWER major v7+). Payload fields (from `toSaveData`, `:218-331`): xp, inventory, concepts ladder, story identity (`companions.quilt()`), quests (tracker + spine), botUpgrades, exchange, botPersonality + bot2Personality, daily, prestige, ovalBestMs, nightShift lastSeen.

**Roblox mapping — one `PlayerProfile` DataStore key per player, same additive discipline:**

```lua
PlayerProfile (DataStore "ScrapcraftYard_v1", key = UserId, version field first, fail-soft load):
  version: 6                      -- SaveSystem.js:23 additive contract, refuse only newer major
  xp:       { xp, level, skills[], seenSensors[] }          -- XPSystem.toSaveData (XPSystem.js:130-137)
  bots:     [ { personality, ledger: {dents[], laps, milestones[]} } ] -- bot(2)Personality, BotLedger
  companions: { [personaId]: { bond, traits, counters, biomes[], recent[], nudgesDone[], firstMetAt } }
                                                                  -- state.js _fresh()/toSave shape, :78-93
  quests:   { tracker, spine }                              -- SaveSystem.js:325-330
  upgrades: [upgradeIds]                                    -- :321
  daily:    { contractState }                               -- :328
  prestige: { perks, backroom }                             -- :331
  race:     { ovalBestMs, ghostFrames10Hz }                 -- :332; ghost frame format Game.js:3305-3312
  economy:  { inventory, exchange }                         -- :321-322
  story:    companions.quilt()                              -- :302-304
  nightshift: { lastSeen }                                  -- NightShift.js toSaveData; server-side clock
```

Rules ported verbatim: **night shift runs on server session timestamps** (the 20-min floor / 8-h cap / 1-iron-per-3-min law, `NightShift.js:23-27`, must not be client-tunable); **save on interval + on leave** (solo saves each markDirty → Roblox `BindToClose` + throttled autosave); profile update sessions batched (Roblox 6-s DataStore write cadence is fine — solo already coalesces).

## 6. Anti-grief basics for kids

Port the yard's existing laws, then extend for plurality:

1. **Whitelist chaos, protect structure.** Rocket Overdrive already forbids smashing stations, track, ore, structure (`PanicButton.js:60` + header "kid-safe chaos"). Shared yard adds: *no tool damages another player's placement*. Explosion-type effects (grenade, cannon — `Game.js:1612,1648`) are **block-only, never player-targeting** in the shared yard.
2. **Build claims.** Player-placed blocks enter a per-player claim set; only the owner (or an explicit co-owner invite) may remove them. Max claim volume per player scales with level (level 5 Engineer = second bot = bigger claim, reusing the existing gate, `XPSystem.js:44-49`).
3. **Race fairness is server math.** Lap validation (gate box + min-lap 2000 ms, `Game.js:3323,3328`) and kinematics constants (`kinematics.js:6-9` — DRIVE_SPEED 3.0, TURN_RATE 180, BOT_RADIUS 0.3, SONAR_RANGE 6.0) are **the server contract**; client sends intents, server simulates the bot brain (tile programs are pure JSON — trivially server-executable, `maker/TileProgram.js`).
4. **No trade scams: exchange is deterministic.** The daily exchange board is the same for everyone (`ScrapExchange.js:15,52-58`) — fixed give/get pairs, no player-to-player currency. Player-to-player *gifting* of items only (no currency exists to scam with).
5. **VHF doctrine for voice/chat** (`docs/VHF-DOCTRINE.md`, `radio/VhfRadio.js`): half-duplex push-to-talk, squelch at 8 s, `CHANNEL_BUSY` as law not error. Port this as the yard's chat discipline — one voice at a time, kids learn the protocol, and **protocol friction is itself telemetry** (MAPPING-SPEC-V2 §radio: every CHANNEL_BUSY is a data point).
6. **Companion privacy.** Other players can never read your companion's state, bond, or counters — only see the avatar. Failure kindness stays personal.
7. **Earl sees everything, quietly.** Foreman events (`Foreman.onEvent`) become the server audit lane — grief patterns (rapid place/remove of others' claims — impossible by rule 2, but attempt telemetry still fires) feed USCP as `YARD_FRICTION` signals for the CNS to read, not to punish with.

## 7. The CNS seam — USCP in the shared yard

MAPPING-SPEC-V2 already defines the social/equipment/progression transductions (`COMPANION_BOND_DELTA`, `COMPANION_TIER_CROSSED`, `RADIO_PROTOCOL`, tile-program lineage). The shared yard multiplies organs, not packets: every per-player event that solo Scrapcraft already emits keeps its shape; add exactly two plurality signals:

- `YARD_CENSUS {players, bands[], personasPresent}` — periodic (60 s) yard occupancy per zone band (band model exists: gate/industrial/circuit/deep — `AudioSystem.playBandAmbient`, `:278-302`).
- `RACE_EVENT {winner, field[], spreadMs, ghostBeaten[]}` — one packet per live race finish, folding the solo `ghost_beaten` bond events into a yard-level narrative Earl can announce.

Sink unchanged: Quilt Sheet groups + fleet memory (MAPPING-SPEC-V2 §consumers). The yard stays one nervous system per kid, and one CNS for the fleet — the Rift manifesto's loop (play → judge → merge, closed once at commit `c4afb31`) simply runs with more skin in the game.

---

**Port-order recommendation:** (1) grid + mining + profile datastore (§1, §5) → (2) races via the DO protocol (§2) → (3) companions visible + Earl queue (§3-4) → (4) USCP seam (§7). Anti-grief laws (§6) ship with step 1, not after.
