# scrapcraft-roblox-bible

The Roblox port bible for **Scrapcraft** — the voxel scrapyard where middle schoolers
build robots, program them tile-by-tile, and race them on a floodlit oval.

**Source of truth:** `/home/eileen/projects/Scrapcraft` (READ-ONLY, never modified).
Every number in these docs is extracted from source and cited `file:line`.

## The bible

| Doc | Contents |
|---|---|
| `docs/MECHANICS-SPEC.md` | Progression curves (XP n²·10, skill gates), full economy (58 recipes, 22-deal exchange pool), quest spine, companion bond/traits, panic button, night shift, race timing, bot + player physics, day/night + weather constants |
| `docs/ASSET-INVENTORY.md` | Every procedural asset: 18 block textures (with per-texture recipe cards), full audio synth parameter table, avatar rigs + palettes, particles — exportable vs rebuild-native, with the headless PNG dump proof |
| `docs/SHARED-YARD-DESIGN.md` | Multiplayer design: co-op mining, live races (port of the existing Durable Object protocol), per-player companions, Earl NPC queue, per-player DataStore schema, kid-safe anti-grief, and the many-organs-one-CNS doctrine (cross-ref the Rift manifesto) |

## Ground-truth extracts

`extracted/*.json` — machine-readable dumps of every data table (pass 1: module
exports, `tools/extract-data.mjs`) and every tuning constant (pass 2: class bodies
and private consts, `tools/extract-tuning.mjs`).

## Proof artifacts

`assets/textures/*.png` — 18 byte-deterministic 16×16 block textures dumped headless
from the real `TextureGen.js` via `tools/dump-textures.mjs` (canvas shim + pure-node
PNG encoder, zero npm installs, no GL). Seeded RNG ⇒ re-dumps are regression checks.
