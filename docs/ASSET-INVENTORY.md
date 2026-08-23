# ASSET-INVENTORY — Scrapcraft procedural assets → Roblox port

**Source of truth:** `/home/eileen/projects/Scrapcraft/src` (READ-ONLY). All cited `file:line`.

Scrapcraft has **zero binary assets** — every texture, sound, avatar, and particle is
generated procedurally at runtime. For the Roblox port each asset is either
**exportable** (we can dump it to a file today, headless) or **rebuild-native**
(cheaper to re-implement in Roblox primitives than to import). This doc is the
complete ledger of both, with exact generator parameters.

---

## 1. Block textures — `src/TextureGen.js` (354 lines)

**Generator:** 16×16 canvas, `NearestFilter` mag+min, `RepeatWrapping` (`TextureGen.js:6-15`).
Deterministic seeded RNG per texture: LCG `s = (s·1664525 + 1013904223)|0` (`:21-23`) —
**same seed → same texture**, which is what makes the headless dump byte-faithful.

**Verdict: EXPORTABLE — proven headless.** No GL, no browser needed: the generator only
uses `fillRect`, `strokeRect`, lines, and gradients on a 2D canvas. The bible ships
`tools/dump-textures.mjs` (canvas shim + pure-node PNG encoder using builtin zlib +
CRC32) which imports the real `TextureGen.js` and writes every texture to
`assets/textures/*.png`. On Roblox: upload PNGs as image assets, set `FilterMode=Nearest`.

Per-texture recipe card (all params from source):

| Block | Base | Deterministic features | Cite |
|---|---|---|---|
| DIRT | `#5C3D1A` | 40 blobs 2×2, `#7A5230`/`#3D2A0F`, seed 1 | `:30-38` |
| GRAVEL | `#6B6B6B` | 50 stones, 30% are 3px, ±25 gray jitter, seed 2 | `:40-50` |
| CONCRETE | `#888880` | 3 crack strokes `#555550` lw 0.5; noise ±15 α.18 seed 31 | `:52-64` |
| RUST_METAL | `#6B2A00` | 30 patches from 4-color rust ramp; sheen row y=6; seed 4 | `:66-80` |
| CLEAN_METAL | `#9DAAB5` | shine bands every 4px (white .12 / black .1); 4 rivets | `:82-96` |
| WOOD_PLANK | `#7A5230` | grain rows every 5 (dark .2 / light .08); noise seed 5 α.25 | `:98-108` |
| SCRAP_PILE | `#3A3A32` | 60 bits from 6-color junk ramp, 30% 2px, seed 6 | `:110-120` |
| WORKBENCH | `#9B7A3A` | 2 scratch strokes; `#D4A017` border; wrench silhouette | `:122-136` |
| FORGE | `#1A1A1A` | 8 horizontal ember gradients (orange, α .8); 10 ember dots; seed 8 | `:138-155` |
| SMELTER | `#2A2A18` | vent slits every 4px, orange gradient α .9; noise seed 10 α.15 | `:157-169` |
| OIL_DRUM | `#1A1A8A` | yellow `#FFCC00` hazard diagonals lw 3 step 6; 2 band rings | `:171-185` |
| CRATE | `#C09050` | `#7A5030` border 2px + X cross lw 1.5; 4 metal corners | `:187-201` |
| WALL_METAL | `#666868` | vertical corrugation every 3px (light .1/dark .15); rivet rows y+=8 | `:203-216` |
| ROOF_METAL | `#4A5848` | diagonal corrugation step 3; 8 rust patches α.4 seed 15 | `:218-230` |
| JUNK_CAR | `#2E2E1E` | 20 dark patches up to 4×3; 4 glass shards α.4 seed 16 | `:232-243` |
| POWER_BOX | `#DDCC00` | black hazard diagonals step 5; lightning bolt polygon | `:245-259` |
| CRYSTAL_ORE (19) | `#1a0530` | 7 crystal crosses from 5-purple ramp; 14 specular px; 10 crevasses; noise seed 191 α.2 | `:261-288` |
| SCRAP_CANNON (20) | `#1c1008` | spring bands every 3px; 6×6 barrel bore; radial muzzle glow; 12 rust patches; 4 rivets; seed 20 | `:290-325` |

Shared helpers: `noise()` overlay α-default 0.18 (`:25-36`), `rng()` LCG (`:21-23`).

## 2. Audio — `src/AudioSystem.js` (352 lines), zero sample files

**Verdict: REBUILD-NATIVE.** Every sound is Web Audio synth (osc + noise + biquad).
Port = Roblox `Sound` with generated WAVs, or simpler: keep the synth parameter table
below and re-render offline once (same headless trick as textures: sample the synth
params into PCM → WAV). Two primitives carry everything:

- `_osc(freq, type, start, dur, gainPeak)` — linear attack 0.01 s, exponential decay to 0.001 (`:29-42`)
- `_noise(dur, gainPeak, filterFreq)` — white noise buffer → bandpass Q=0.5 → exp decay (`:44-62`)
- Master gain 0.4 (`:16`)

Synth parameter table (freq/type/dur/gain per event, all `file:line`):

| Sound | Recipe | Cite |
|---|---|---|
| mine(blockId) | saw 300+(id·137%400)Hz .25s .4 + square ×1.5 .15s .2 + noise ×2 bandpass .12s | `:65-71` |
| pickup | sine 880 .15s .25 + sine 1320 @+.05s .1s .15 | `:74-78` |
| craft | 4 saws 200+i·80 step .07s .2 → chime sines 1047/1319/1568 | `:81-91` |
| questComplete | sine melody 523·659·784·1047 @.12s + triangle 1047 hold .5 | `:94-99` |
| earlSpeak | saw 120 .08s .15 + saw 100 .12s .12 | `:102-106` |
| achievement | sines 659/784/1047/1319 @.09s .3 | `:109-113` |
| spark | noise .08s bandpass 3–5 kHz | `:116-120` |
| footstep(surface) | dirt 80Hz .15 · metal 300Hz .2 · concrete 150Hz .18 (+saw ×0.7) | `:123-135` |
| place | noise .1s @180Hz .22 + saw 100 .07s | `:150-155` |
| error | saw 220 .1 + saw 180 @+.08 | `:158-163` |
| lapComplete(rec) | rec: 5-note arpeggio 523→1319 + triangle hold; else 523/784/1047 | `:166-179` |
| brainLoad/Stop | tri 440 + sine 660/880 rise · 440/330 fall | `:182-196` |
| floodOn | saw 120 + sine 240/360 hum startup | `:199-205` |
| thunder | crack noise .08s @220 .28 + rumbles 1.8s @60, 1.2s @100 | `:214-220` |
| rainStart/Stop | hiss noise @3000/6000 (start) / @4000 quieter (stop) | `:223-231` |
| ambient yard | craneCreak 48/51Hz saws 2.2s + tri squeak 880→660→520 · birdChirp 2300+500Hz ×2 + flutter · windGust noise 320/700 · catMew sines 620/540 | `:236-275` |
| zone ambients | 4 bands: gate birds / industrial 55+110Hz saws / Circuit City square chirps 800–2000 / Deep Yard 150Hz wind + 220/440 crystal sines; re-sting every 15 s | `:278-302`, tick `:304-335` |

## 3. Avatars — companion + bot meshes

**Verdict: REBUILD-NATIVE (Roblox parts are boxes anyway).**

### Companion avatar — `src/companion/avatar.js` (196 lines)

Voxel-style box rig, one look per persona from `personas.js` (`colors`, `shape`):
- Torso box 0.42×0.34×0.34 ×`bodyScale` (`:36-40`); head 0.30×0.22×0.26 slightly forward (`:43-47`); **one eye** lens 0.14×0.10 emissive glow (`:50-53` — a Rivet tell).
- Juno = swarm mode: small core + orbiting micro-fliers instead of torso (`:26-28`).
- Life: idle sine bob, head tracks player look-target, dismay dip on crash, hop on loot, pulsing speech dot while talking (`:1-15` header).
- Palettes (personas.js): Rivet copper `0xd9843b`/teal glow `0x3ee8c8` · Bolt steel `0x8a94a6`/yellow `0xffd23f` + racing stripe, bodyScale 0.85 · Magma red `0x9c3b2a`/orange `0xffa54d`, bodyScale 1.45, bigArms · Juno teal `0x6ee7d8`/pale `0xfff59a`, bodyScale 0.7, swarm (`personas.js:46-52,121-127,368-374,614-620`).

### ScrapBot mesh — `src/ScrapBot.js:154-232`

All `BoxGeometry`: body 0.5×0.55×0.35 @y0.8 (edition color, standard `8030874`, gate `9071178` — `data/botEditions.js`) · head 0.38×0.35×0.35 `0x8A9AAA` · eyes 2× 0.08² emissive cyan `0x00FFFF/0x00AAFF` (LED-colorable, `:545-551`) · antenna + orange tip · arms 0.15×0.45 · legs 0.16×0.35 (walk swing sine ×0.3 / brain-mode ×0.4) · cyan PointLight 0.8/3m. Neopixel body-tint map (`:566-575`): 9 named colors → emissive body + glow light.

## 4. Particles & weather visuals

- **ParticleSystem** (`src/ParticleSystem.js`): burst kinds referenced throughout Game.js — `pickup, confetti, circuit, smoke` (counts cited per call site, e.g. lap confetti 14/30 at `Game.js:3338`). REBUILD-NATIVE → Roblox `ParticleEmitter` presets.
- **Rain** point cloud 1800 pts (`WeatherSystem.js:24-38`) → Roblox `RainParticle` or equivalent; params in MECHANICS-SPEC §10.
- **Stars** 300 pts radius 90 (`DayNight.js:40-57`) → Roblox `Sky` star deck.

## 5. UI / icon assets

Item/block emoji icons are data (`data/items.js` icon strings) — on Roblox map to the
platform emoji or exported PNG sprites of the same 16×16 generator. Panels (Exchange,
Logbook, BackRoom, race HUD) are DOM/CSS — rebuild in Roblox GUI 1:1 from the dump
layouts (`extracted/*.json` content tables).

## 6. Headless dump proof — texture lane

`tools/dump-textures.mjs` (in this repo) proves the export path with **no browser, no
GL, no npm installs**:
1. Fake `document.createElement('canvas')` — a 2D-context shim implementing exactly the
   ops `TextureGen.js` uses (`fillRect`, `strokeRect`, paths→Bresenham lines with
   `lineWidth`, linear/radial gradients with `addColorStop`, source-over blending).
2. `three` import rewritten to a stub where `CanvasTexture` just captures the canvas
   (same loadSafe technique as `tools/extract-data.mjs`).
3. Canvas → real PNG via node builtin `zlib.deflateSync` + hand-rolled CRC32/chunk writer.
4. Output: `assets/textures/NN_NAME.png` + `assets/textures/manifest.json`.

Because the generator RNG is seeded per texture (`:21-23`), dumped PNGs are
byte-deterministic — the Roblox uploads can be diffed against future re-dumps as a
regression check.
