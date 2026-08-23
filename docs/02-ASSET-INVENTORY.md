# PORT BIBLE 02 — ASSET INVENTORY (Procedural Assets)

> **Source:** `/home/eileen/projects/Scrapcraft/src/TextureGen.js` (354 lines),
> `AudioSystem.js` (352 lines). Scrapcraft ships **zero binary asset files** —
> every texture and every sound is generated at runtime. That is the single
> most port-relevant fact in this document: **the port can rebuild every asset
> from the recipes below**, or bake them once and ship as static assets.
>
> Roblox target: Roblox Studio. Textures → `Texture`/`Image` assets (or
> `Decal`/`SurfaceAppearance`); audio → `Sound`/`SoundGroup` assets.

---

## 1. TEXTURE GENERATOR (`TextureGen.js`)

### 1.1 Pipeline
- **16×16 pixel-art canvas**, `NearestFilter` min/mag, `RepeatWrapping` — "sharp and chunky at all distances" (`TextureGen.js:1-10`).
- Seeded RNG: LCG `s = (s*1664525 + 1013904223) | 0` (`TextureGen.js:15-18`) — every texture is **deterministic per seed constant**.
- Shared helper `noise(ctx, r, seed, alpha=0.18)`: per-pixel ±15 color jitter with 50% skip (`TextureGen.js:20-30`).

### 1.2 Texture recipes (all 16×16, seed constant in parens)

| Block | Base | Recipe | Seed |
|-------|------|--------|------|
| DIRT | #5C3D1A | 40× 2×2 patches (#7A5230/#3D2A0F) | 1 |
| GRAVEL | #6B6B6B | 50× 1–3px gray chips ±25 | 2 |
| CONCRETE | #888880 | 3 crack strokes + noise | 3 |
| RUST_METAL | #6B2A00 | 30× rust patches (4 colors) + sheen streak | 4 |
| CLEAN_METAL | #9DAAB5 | horizontal shine bands + 4 rivets | — |
| WOOD_PLANK | #7A5230 | grain lines every 5px + noise α.25 | 5 |
| SCRAP_PILE | #3A3A32 | 60× 6-color scrap bits | 6 |
| WORKBENCH | #9B7A3A | 2 scratches + yellow trim + wrench silhouette | — |
| FORGE | #1A1A1A | 8 glowing orange seam gradients + 10 embers | 8 |
| SMELTER | #2A2A18 | vent slits + noise α.15 | 10 |
| OIL_DRUM | #1A1A8A | diagonal hazard stripes + band rings | — |
| CRATE | #C09050 | border + X cross + 4 metal corners | — |
| WALL_METAL | #666868 | corrugation stripes + rivets | 14 |
| ROOF_METAL | #4A5848 | diagonal corrugation + 8 rust patches | 15 |
| JUNK_CAR | #2E2E1E | 20 body patches + 4 glass shards | 16 |
| POWER_BOX | #DDCC00 | black hazard stripes + yellow lightning bolt | — |
| CRYSTAL_ORE (19) | #1a0530 | 7 purple crystal crosses + 14 highlights + 10 crevasses + noise | 19 |
| SCRAP_CANNON (20) | #1c1008 | spring bands + barrel ring + radial glow + 12 rust + 4 rivets | 20 |

`buildTextures()` returns `Map<blockId, THREE.Texture>` for all 18 defined
entries (`TextureGen.js:340-345`). Note: only 18 of 26 block ids have custom
textures; the rest use geometry color + roughness from `BLOCK_DEF`
(`data/blocks.js` — `color`, `rough`, `emissive`, `emissiveIntensity`).

### 1.3 Roblox port mapping
- **Recommended: bake-once.** Run `TextureGen.js` in a headless canvas
  (node-canvas or a 20-line Playwright script) → 18 PNGs → upload as
  Roblox Image assets. `NearestFilter` ≈ Roblox `Image`/`Texture` with
  default linear filtering (set `ResamplingQuality`/use `SurfaceAppearance`
  for crispness; 16×16 upscaled ×4 = 64×64 recommended to avoid mip smear).
- **Alternative: runtime `Image` from base64** — Roblox cannot run the JS
  generator; replicate per-recipe draw calls in Luau would be absurd. Bake.
- Emissive blocks (FORGE, SMELTER, CRYSTAL_ORE, BEACON, FLOODLIGHT, HOT_SLAG,
  ACID_PUDDLE, TRACK, SCRAP_CANNON) → `SurfaceAppearance` + `EmissiveMap` or
  `PointLight` on part.

---

## 2. AUDIO GENERATOR (`AudioSystem.js`)

### 2.1 Pipeline
- **100% Web Audio synthesized — zero audio files** (`AudioSystem.js:1-3`).
- Two primitives: `_osc(freq, type, start, dur, gainPeak)` — oscillator with
  10ms attack + exponential decay; `_noise(dur, gainPeak, filterFreq, start)`
  — white-noise buffer through a bandpass biquad (Q=0.5).
- Master gain 0.4, toggleable (`AudioSystem.js:16-18, 24`).

### 2.2 Sound inventory (fully parametric — rebuild table)

| SFX | Recipe | Parameters |
|-----|--------|-----------|
| mine | sawtooth ring + square overtone + noise burst | f = 300 + (blockId×137 % 400); 0.25s/0.15s/0.12s |
| pickup | 2 sine chimes | 880 Hz then 1320 Hz (+0.05s) |
| craft | 4-step mechanical whirr + 3-note success ding | 200+80i Hz saw; 1047/1319/1568 Hz |
| questComplete | 4-note fanfare + held triangle | 523/659/784/1047 + 1047@0.55s |
| earlSpeak | 2 grunts | 120 Hz, 100 Hz sawtooth |
| achievement | ascending arpeggio | 659/784/1047/1319 |
| spark | bandpass noise burst | 3000–5000 Hz, 0.08s |
| footstep | noise + thud (3 surfaces) | dirt 80Hz/0.15, metal 300Hz/0.2, concrete 150Hz/0.18 |
| ambientTick | gentle hum | 60–100 Hz sine, 30% chance |
| place | thud | 180 Hz noise + 100 Hz saw |
| error | 2 descending saws | 220 → 180 Hz |
| lapComplete | 3-note finish / 5-note record + held note | 523/784/1047 vs 523/659/784/1047/1319 |
| brainLoad | 3-note bloop | 440/660/880 Hz |
| brainStop | 2-note stop | 440 → 330 Hz |
| floodOn | electrical hum startup | 120/240/360 Hz |
| sprint | noise burst + saw | 800 Hz noise, 300 Hz saw |
| thunder | crack + 2 rumbles | 220 Hz noise, 60/100 Hz long noise |
| rainStart/Stop | hiss swell/fade | 3000/6000 Hz bandpass |
| craneCreak | 2 detuned saws + 3-note squeak descent | 48/51 Hz + 880→520 Hz |
| birdChirp | 2 bright blips + wing flutter | 2300–2800 Hz sine |
| windGust | 2 low swells | 320/700 Hz noise |
| catMew | 2 sine mews | 620 → 540 Hz |

**Band ambiences** (`playBandAmbient(bandIdx)`, `AudioSystem.js:255-292`):
- Band 0 Yard Gate: distant birds + breeze (2400–3200 Hz blips, 800 Hz noise)
- Band 1 Industrial: machinery hum (55/110 Hz saws)
- Band 2 Circuit City: glitchy square chirps (800/1200/1600/2000 Hz)
- Band 3 Deep Yard: low wind + eerie crystal resonance (150 Hz noise, 220/440 Hz sines)

**Ambient lifecycle** (`tick`, `AudioSystem.js:294-319`): footsteps every 0.4s
on movement (surface detection by block id: metal = id 4–22 minus 6/19; stone
= 2/3), ambient hum occasionally, zone sting every ~15s.

### 2.3 Roblox port mapping
- **Option A (recommended): bake WAVs.** Run `AudioSystem.js` with a mock
  AudioContext (node + `audio-buffer` polyfill or a headless Chromium dump of
  each sfx to WAV) → upload as Roblox `Sound` assets. ~25 assets, tiny.
- **Option B: rebuild in Luau with SoundService** — Roblox has no Web Audio
  oscillator API; Luau `Sound` plays uploaded audio. Procedural synthesis is
  not feasible server-side. **Bake.**
- Roblox specifics: set `SoundGroup` per band for zone volume control; use
  `Sound.EmitterSize`/`RollOffMaxDistance` for positional SFX (footsteps,
  bird chirps); loop `ambientTick` via a `RunService.Heartbeat` timer (30%
  probability, matching JS) or schedule a looping ambient track.

---

## 3. RENDERER / VISUAL ASSETS (beyond textures)

| Asset | Source | Port note |
|-------|--------|-----------|
| 300-star skybox | DayNight.js:32-52 | Roblox `Atmosphere`/`StarField` |
| Day-night keyframes (9) | DayNight.js:7-16 | `Lighting` clock: full cycle 360s, lerp sky/fog/ambient/sun intensities |
| Rain particle cloud (1800) | WeatherSystem.js:24-32 | `ParticleEmitter` |
| Mine crack overlay | Game.js:1181 | `SurfaceAppearance` swap or decal on mine progress |
| Particle bursts (mine/pickup/confetti) | ParticleSystem.js | `ParticleEmitter` templates |
| Projectiles (scrap cannon) | ProjectileSystem.js | Roblox `Projectile`/custom `BallisticConstraints` |
| ScrapBot 3D model | ScrapBot.js:142-197 (procedural boxes) | Rebuild as `Model`/`RigidConstraints`; body 0.5×0.55×0.35, head 0.38×0.35×0.35, cyan eyes (0x00FFFF), antenna with orange tip (0xFF4400) |

---

## 4. EXPORT TOOLING STATUS (headless-feasible?)

| Asset class | Headless export possible? | How |
|-------------|--------------------------|-----|
| Textures (18) | ✅ Yes | node-canvas reimplementation of `TextureGen.js` (pure 2D canvas ops, no THREE needed except wrapper) — ~1h script |
| SFX (25) | ✅ Yes | mock AudioContext in Node (offline rendering) or headless Chromium `OfflineAudioContext` |
| Rain/particles | ✅ Yes | parameter tables above → Roblox `ParticleEmitter` config |
| 3D bot model | ✅ Yes | procedural boxes → explicit `Part` placement script |
| Day-night lighting | ✅ Yes | keyframe table → `Lighting` script |

**Verdict:** the entire asset surface is reproducible from source tables.
No art export pipeline exists in-repo (assets are code); port must bake.
Full parameter tables are in §1.2 and §2.2 — sufficient to regenerate without
re-reading the JS.

---

*Extracted 2026-08-23. All recipes verified against `TextureGen.js` /
`AudioSystem.js` at Scrapcraft working tree HEAD.*
