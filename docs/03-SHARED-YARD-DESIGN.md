# PORT BIBLE 03 — SHARED-YARD DESIGN (Data Layer)

> **Scope:** this is the mechanics/data side of the shared-yard multiplayer
> port. The phase2-vision lane owns the vision/UX of the shared yard; this
> doc defines the **datastore schema, per-player state, sync model, and
> persistence semantics** — all mapped 1:1 from the single-player JS save
> system so a Roblox port keeps parity.
>
> **Source:** `src/SaveSystem.js` (schema v6, 574 lines), `src/SaveBackend.js`
> (Cloudflare sync), `src/companion/state.js`, `src/quests/Spine.js`,
> `src/NightShift.js`, `src/prestige/Prestige.js`, `src/BotLedger.js`.

---

## 1. SINGLE-PLAYER SAVE SCHEMA (v6) — the port's data contract

Storage: `localStorage` key `scrapcraft_save_v6` (constant `SAVE_KEY`,
`SaveSystem.js:12`), schema version 6, additive forward-compat (unknown keys
survive round-trip via `_preserveUnknown`, `SaveSystem.js:20, 326-333`).
Newer major version (7+) refused on load (`SaveSystem.js:185-190`).

**Top-level payload (`_collect`, `SaveSystem.js:238-324`):**

```jsonc
{
  "version": 6,
  "lastSaved": "ISO-8601",
  "player": {
    "pos": {"x","y","z"}, "yaw": 0, "hp": 100,
    "inventory": [{"id","qty"} | null ×36],
    "crafted": ["itemId"...], "hotbarIndex": 0,
    "waypoint": null | {"x","z"}, "headlampOn": false
  },
  "achievements": {
    "unlocked": ["id"...],
    "stats": { "totalMined", "nightMines", "inventoryFill", "crafted": [...],
      "itemsCollected": {}, "itemsCrafted": {}, "questsCompleted",
      "recentCrafts", "programsRun", "blocksPlaced", "wokwiExported",
      "hardwareFlashes", "receiptViews", "botUpgradesInstalled",
      "exchangeTrades", "tracksPlaced", "floodlightsPlaced", "lapsCompleted",
      "brainsShared", "sparkPrograms", "uniqueSensorsUsed", "crystalMined",
      "headlampUsed", "cannonsFired", "waypointReached", "oreDetections",
      "grenadeMaxBlocks", "airdropLoots", "luckyFinds", "narrowEscapes",
      "challengesCompleted", "buriedCachesFound", "towerActivated",
      "botNamed", "botBondMax" }
  },
  "xp": { "xp", "level", "skills": [...], "seenSensors": [...] },
  "concepts": { /* concept ladder mastery */ },
  "story": { /* companion quilt: run identity */ },
  "quests": { "tracker": {...}, "spine": {...} },
  "companions": { "roster": {...}, "states": { "<personaId>": {...} } },
  "tileEditor": { /* TileProgram JSON, schema v1 */ },
  "earl": { "questIndex": 0, "history": [≤20] },
  "world": { "seed": 42, "minedBlocks": [{"x","y","z"}],
             "placedBlocks": [{"x","y","z","id"}],
             "signalCaches": ["x,z"...] },
  "tower": { "slots": {}, "activated": false },
  "botUpgrades": ["id"...],
  "exchange": { "trades": 0 },
  "botPersonality": {...}, "bot2Personality": {...},
  "daily": { /* DailyContract save */ },
  "prestige": { "v":1, "marks":0, "earned":{}, "owned":[] },
  "comeback": { "botName", "botBond", "botLaps", "botDents", "ovalBestMs",
                "questIndex", "daysPlayed", "dayStreak", "nightShiftLastSeen" },
  "ghostLap": [...], "ovalGhostLap": [...], "ovalBestMs": null,
  "fogMap": "base64 of Uint8Array"
}
```

**Side-channel localStorage keys (separate stores, each versioned):**

| Key | Owner | Content |
|-----|-------|---------|
| `scrapcraft_save_v6` | SaveSystem | full payload above |
| `scrapcraft_companion_<id>` | CompanionState | per-companion bond state (schema v1) |
| `scrapcraft_rivet` | RivetState (legacy) | Rivet's bond (kept for save survival) |
| `scrapcraft_spine_v1` | SpineState | {v, opened{}, bandNudged{}, completedCh{}, completedEver} |
| `scrapcraft_nightshift_v1` | NightShift | away-clock state |
| `scrapcraft_prestige_v1` | PrestigeSystem | {v, marks, earned, owned} |
| `scrapcraft_session` | SaveBackend | {sessionId, classCode, displayName} |
| `scrapcraft_onboarding_config` | onboarding | {cfWorkerUrl} |
| `scrapcraft_save_v6_veteran` / `scrapcraft.veteran.backup` / `scrapcraft.profile` | veteran lanes | returning-player provenance |

### Save timing rules (must survive porting) (`SaveSystem.js:1-11, 129-151`)
1. **Mutation hooks** — XP gain, inventory add/remove, damage/heal, achievement track/unlock mark dirty instantly.
2. **Drift signature** — every tick fingerprints 12 load-bearing fields (xp, level, questIndex, history len, inventory sum, hp, crafted size, unlocked size, active companion, bond, spine chapter, tower). Any drift re-dirties (`SaveSystem.js:87-104`).
3. **Milestones** — level-ups + quest completions save immediately (`saveMilestone`).
4. **Autosave** — every 30 s while dirty (`AUTOSAVE_INT`, `SaveSystem.js:10`).
5. **Exit** — beforeunload/pagehide/visibilitychange→hidden (`saveOnExit`).
6. Wipe suspends all writes for 800 ms (zone-gate P1, `SaveSystem.js:207-224`).

---

## 2. CLOUD LAYER (the model for Roblox DataStore)

`SaveBackend.js` mirrors exactly what Roblox DataStore should implement:

| JS | Roblox equivalent |
|----|-------------------|
| `localStorage` (sync, local-first) | `MemoryStore`/player-attached session (client keeps a local copy) |
| Worker `PUT /api/v1/save` (async, fire-and-forget) | `DataStoreService:SetAsync` via `HttpService` or official `DataStore` (server-side only) |
| Worker `GET /api/v1/save` (newest `lastSaved` wins) | `GetAsync` + `lastSaved` timestamp compare |
| `DELETE /api/v1/save` | `RemoveAsync` |
| `sendBeacon /api/v1/save/beacon` (unload-safe) | Server `BindToClose` flush + periodic autosave (no unload beacon possible) |
| Session token header `X-Scrapcraft-Session` | Roblox `UserId` (identity is implicit) |
| Classroom: `/api/v1/class/join`, `/create`, `/challenge`, `/leaderboard` | `OrderedDataStore` leaderboards + `DataStore` per class code |

Conflict rule (`SaveBackend.js:33-50`): **local copy wins for side-channels**
(tracker, spine, companions); cloud wins for the main payload when its
`lastSaved` is newer. Port note: Roblox DataStore has no local-vs-cloud split
— treat the server DataStore as the single truth, mirror client-side as a
cache, and keep the "local copy wins" rule only for per-session caches.

---

## 3. ROBLOX DATASTORE SCHEMA (proposed)

### 3.1 Key layout (per-player, profile-scoped)
```
DataStore "PlayerData_v1"   (profile-scoped, per UserId)
  Key:  "profile"           → the v6 payload (JSON, trimmed of pos/hotbar)
  Key:  "companion_<id>"    → per-companion bond state (or one key "companions")
  Key:  "spine"             → spine state
  Key:  "nightshift"        → away-clock
  Key:  "prestige"          → marks/owned
  Key:  "daily"             → contract + streak

DataStore "YardShared_v1"   (global-scoped — the shared yard)
  Key:  "world_<seed>"      → { seed, minedBlocks[], placedBlocks[],
                                 signalCaches[], towerSlots{}, towerActivated }
  Key:  "raceboard"         → { name → bestMs } ghost records
  Key:  "ovalGhost_<player>" → per-player ghost replay frames (or in profile)
  Key:  "class_<code>_leaderboard" → OrderedDataStore for classroom rankings
```

### 3.2 Per-player state (authoritative server copy)
Everything from §1 except transient client fields (`pos`, `yaw`, `hotbarIndex`,
`headlampOn` → keep client-side or in a lightweight `MemoryStore`; world
position in a shared yard is **world state**, not player state — see §4).

### 3.3 Data safety rules (porting checklist)
- **Write batching**: Roblox DataStore has rate limits — batch profile writes
  to a single `SetAsync` (the whole v6 payload is one JSON blob — natural fit),
  throttle to ≤1 write/player/10 s + forced write on `BindToClose`.
- **Ordering**: `lastSaved` monotonicity; server-side `UpdateAsync` for
  counters (raceboard bestMs, marks) to avoid lost updates.
- **Versioning**: keep `version` field + additive merge (mirror
  `_preserveUnknown`). Refuse version > current (like JS).
- **Corrupt-save tolerance**: every loader fail-softs to fresh state
  (companion `load()`, spine `load()`, prestige — all `try/catch` fresh-start).

---

## 4. SHARED-YARD STATE MODEL (mechanics side)

The JS world is single-player procedural; the shared yard makes world state
communal. Data-side design:

### 4.1 World state (one authoritative copy per yard instance/seed)
- `seed` (deterministic terrain — same generation code, one canonical seed).
- `minedBlocks[]` and `placedBlocks[]` **diffs only** — exactly like the JS
  save (`World.js:31-33`): the port regenerates terrain from seed, then
  applies diffs. Keeps DataStore small and generation deterministic.
- `signalCaches` set (`"x,z"` keys, 6 per world).
- Hazards/stations are block-state, so they ride the same diff model.
- **Conflict rule:** last-writer-wins per block coordinate; `UpdateAsync`
  keyed on the world key with a monotonic `rev` counter.

### 4.2 Shared economy surfaces
- **Raceboard**: `OrderedDataStore` bestMs per track; ghost replay frames per
  player (bounded: `_bestGhostFrames`, cap length in JS is array of frames —
  port must bound to ~1,000 frames/ghost).
- **Scrap Exchange**: already day-seeded deterministic (`ScrapExchange.js`) —
  all players see the same 3 deals per day; trades mutate player inventory
  only (no shared ledger needed).
- **Daily Contract**: per-player (seeded by day + player), not shared.

### 4.3 Ownership & anti-grief (mechanics constraints)
- Companions, XP, quests, prestige, bond: **per-player private** (never shared).
- Placed blocks: optional per-player claim (owner field in `placedBlocks`
  diff entries) — vision lane decides if griefing is allowed; the data model
  supports `owner` transparently.
- Tower slots: shared only if vision lane wants communal endgame; single-
  player semantics keep it per-profile by default.

---

## 5. SESSION & CLASSROOM

- Classroom join issues a `sessionId` + `classCode` + `displayName`
  (`SaveBackend.js:88-100`); Roblox equivalent: `UserId` + `Player:SetRankInGroup`
  or a `classCode` stored in profile; teacher challenges + leaderboard via
  `OrderedDataStore` (challenge grading A+..D, `ChallengeSystem.js:17-18`).
- **Graceful degradation** must be preserved: no worker configured → all
  writes stay local (Roblox: no DataStore access → session-only play with
  `StarterPlayer`-scoped saves or an explicit "guest" profile).

---

## 6. MIGRATION MAP (JS key → Roblox key)

| JS storage | Roblox |
|------------|--------|
| `scrapcraft_save_v6` | `PlayerData_v1:profile` |
| `scrapcraft_companion_<id>` ×4 | `PlayerData_v1:companions` (single JSON object) |
| `scrapcraft_spine_v1` | `PlayerData_v1:spine` |
| `scrapcraft_nightshift_v1` | `PlayerData_v1:nightshift` |
| `scrapcraft_prestige_v1` | `PlayerData_v1:prestige` |
| world mined/placed diffs | `YardShared_v1:world_<seed>` |
| `_bestGhostFrames`/`ovalBestMs` | `YardShared_v1:raceboard` / profile ghost keys |
| session/classroom | class-coded `OrderedDataStore` + profile `classCode` |

---

*Extracted 2026-08-23. Schema parity verified against `SaveSystem.js`,
`SaveBackend.js`, `companion/state.js`, `quests/Spine.js`.*
