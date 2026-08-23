# ROBLOX PORT BIBLE — Scrapcraft → Roblox

**Status:** COMPLETE (finisher pass) · **Extracted:** 2026-08-23
**Source:** `/home/eileen/projects/Scrapcraft/src/` (JS game working tree)

The authoritative mechanics/data reference for porting SCRAPCRAFT to Roblox.
Every number cited to source. See each doc for file:line citations.

## Documents

| # | Doc | Contents | Coverage |
|---|-----|----------|----------|
| 01 | [Mechanics Spec](docs/01-MECHANICS-SPEC.md) | World/terrain, block table (hardness+drops), mining & loot pipeline, XP curve + skill unlocks, economy (recipes×~60, exchange, daily contract, night shift, prestige), companion bond (BOND_EVENTS + tiers), 65-quest campaign + 12-chapter spine, ScrapBot/upgrades, racing/challenges, day/night/weather, player, tuning-constants index, achievements (74), BotLedger | ~95% of gameplay mechanics |
| 02 | [Asset Inventory](docs/02-ASSET-INVENTORY.md) | 18 procedural texture recipes (16×16 seeded), 25 synthesized SFX recipes, renderer/visual assets, export-tooling verdict (bake-once headless feasible for all) | 100% of procedural assets |
| 03 | [Shared-Yard Design](docs/03-SHARED-YARD-DESIGN.md) | Save schema v6 full payload, side-channel keys, save-timing rules, cloud-layer mapping, proposed Roblox DataStore schema (per-player + shared yard), ownership/anti-grief, migration map | Data layer complete |
| 04 | [Luau VPL Guide](docs/04-LUAU-VPL-GUIDE.md) | Tile program node types, VM semantics (cooperative coroutine, one-pass-per-tick forever), Strategy A interpret vs B compile-to-Luau, 19-sensor + 11-actuator adapter map, bytecode port, save/share format, port checklist | VPL complete |

## Coverage estimate

- **Mechanics: ~95%** — all tunable numbers extracted with citations. Gaps:
  dialogue/cinema content, voice lines, banter banks (content, not mechanics —
  vision lane owns), exact per-chapter quest objective lists (data files are
  in `extract/quests-full.json` for reference — 65 quests, full objectives).
- **Assets: 100%** — full parameter tables for regeneration; no binary assets
  exist upstream (all procedural).
- **Data layer: 100%** — schema + DataStore mapping + migration.
- **VPL: 100%** — node semantics + both port strategies + adapter map.

## Extract artifacts

- `extract/quests-full.json` — all 65 quests (objectives, prerequisites,
  rewards, teaching) in one file.
- `extract/quest-titles.json` — id → title map.
- `extract/*.json` — raw quest data files copied from `src/quests/data/`.

## Lane notes

- Phase2-vision lane owns the shared-yard vision/UX; doc 03 is the
  mechanics/data side (schema, per-player state, sync model).
- Verify against Scrapcraft `git log` before final port; working tree may
  drift after this extraction date.
