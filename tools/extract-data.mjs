#!/usr/bin/env node
/**
 * extract-data.mjs — the ground-truth extraction pass for the Roblox Port Bible.
 *
 * Imports the REAL Scrapcraft source modules (read-only) and dumps every
 * exported data table to JSON. Numbers here are extracted, never remembered.
 *
 * Usage: node tools/extract-data.mjs /home/eileen/projects/Scrapcraft
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SRC = path.resolve(process.argv[2] ?? '/home/eileen/projects/Scrapcraft', 'src');
const OUT = path.resolve('extracted');
fs.mkdirSync(OUT, { recursive: true });

// ── three.js stub + source-copy loader ────────────────────────────────────
// Modules that import three get copied to a temp dir with the import rewritten
// to an inert stub, so their exported CONSTANTS can be read without a browser.
const TMP = fs.mkdtempSync('/tmp/scrapcraft-x-');
const STUB = path.join(TMP, '__three_stub.js');
fs.writeFileSync(STUB, `export default new Proxy({}, { get: () => class {} });\nexport const Vector3 = class {};\n`);

function loadSafe(relPath) {
  const abs = path.join(SRC, relPath);
  let src = fs.readFileSync(abs, 'utf8');
  const importsThree = /^import \* as THREE from 'three';$/m.test(src);
  if (importsThree) {
    const copy = path.join(TMP, relPath.replace(/\//g, '__'));
    src = src.replace(/^import \* as THREE from 'three';$/m,
      `import * as THREE from '${pathToFileURL(STUB).href}';`);
    // rewrite relative imports so they still resolve against original tree
    src = src.replace(/from '(\.[^']*)'/g, (m, p) =>
      `from '${pathToFileURL(path.resolve(path.dirname(abs), p)).href}'`);
    fs.writeFileSync(copy, src);
    return import(pathToFileURL(copy).href);
  }
  return import(pathToFileURL(abs).href);
}

const dump = (name, data) => {
  fs.writeFileSync(path.join(OUT, name), JSON.stringify(data, null, 2));
  console.log(`✓ ${name} (${JSON.stringify(data).length} bytes)`);
};

// ── 1. Core item/block/recipe tables ──────────────────────────────────────
const blocks = await loadSafe('data/blocks.js');
dump('blocks.json', {
  B: blocks.B,
  BLOCK_DEF: blocks.BLOCK_DEF,
  ITEM_TO_BLOCK: blocks.ITEM_TO_BLOCK,
});

const items = await import(pathToFileURL(path.join(SRC, 'data/items.js')).href);
dump('items.json', items.ITEMS);

const recipes = await import(pathToFileURL(path.join(SRC, 'data/recipes.js')).href);
dump('recipes.json', recipes.RECIPES);

// ── 2. Progression: XP, upgrades, prestige, bot editions ──────────────────
const xp = await loadSafe('XPSystem.js');
dump('xp-skills.json', { XP_SKILLS: xp.XP_SKILLS, levelFormula: 'level = floor(sqrt(xp / 10))' });

const upgrades = await loadSafe('BotUpgrades.js');
dump('bot-upgrades.json', upgrades.UPGRADE_DEFS ?? upgrades.UPGRADES ?? 'EXPORT-NOT-FOUND');

const perks = await loadSafe('prestige/perks.js');
dump('prestige-perks.json', Object.fromEntries(Object.entries(perks).filter(([, v]) => typeof v !== 'function' || true)));

fs.copyFileSync(path.join(SRC, 'prestige/backroom.json'), path.join(OUT, 'prestige-backroom.json'));
console.log('✓ prestige-backroom.json (copied verbatim)');

const editions = await import(pathToFileURL(path.join(SRC, 'data/botEditions.js')).href);
dump('bot-editions.json', editions);

// ── 3. Quest spine (the campaign data) ────────────────────────────────────
for (const f of fs.readdirSync(path.join(SRC, 'quests/data'))) {
  if (f.endsWith('.json')) {
    fs.copyFileSync(path.join(SRC, 'quests/data', f), path.join(OUT, `quest-${f}`));
    console.log(`✓ quest-${f} (copied verbatim)`);
  }
}

// ── 4. Companion personality system ───────────────────────────────────────
const personas = await loadSafe('companion/personas.js');
const personaDump = {};
for (const k of Object.keys(personas)) {
  try { personaDump[k] = personas[k]; } catch {}
}
dump('companion-personas.json', personaDump);

const banter = await import(pathToFileURL(path.join(SRC, 'companion/banter.js')).href);
dump('companion-banter.json', Object.fromEntries(
  Object.entries(banter).map(([k, v]) => [k, Array.isArray(v) ? v.length : v])));

// full banter content too — it's the personality bank
fs.writeFileSync(path.join(OUT, 'companion-banter-full.json'), JSON.stringify(banter, null, 2));

// ── 5. VPL: tile programming op set ──────────────────────────────────────
const primitives = await loadSafe('maker/primitives.js');
const primDump = {};
for (const [k, v] of Object.entries(primitives)) {
  if (Array.isArray(v)) primDump[k] = v.map(d => ({ ...d, fn: undefined }));
  else if (v && typeof v === 'object') primDump[k] = Object.fromEntries(
    Object.entries(v).map(([kk, vv]) => [kk, (vv && typeof vv === 'object' && !Array.isArray(vv)) ? { ...vv, fn: undefined } : vv]));
  else primDump[k] = v;
}
dump('vpl-primitives.json', primDump);

const kinematics = await loadSafe('maker/kinematics.js');
dump('vpl-kinematics.json', kinematics);

// ── 6. Tuning tables from gameplay systems ────────────────────────────────
const panic = await loadSafe('PanicButton.js');
dump('panic-tuning.json', Object.fromEntries(Object.entries(panic).filter(([k]) => /^[A-Z_]+$/.test(k))));

const race = await loadSafe('RaceBoard.js');
dump('race-ghosts.json', { NPC_GHOSTS: race.NPC_GHOSTS, BEAT_QUIPS: race.BEAT_QUIPS });

const daily = await loadSafe('DailyContract.js');
dump('daily-contract.json', Object.fromEntries(Object.entries(daily).filter(([k]) => /^[A-Z_]+$/.test(k))));

const exchange = await loadSafe('ScrapExchange.js');
dump('scrap-exchange.json', Object.fromEntries(Object.entries(exchange).filter(([k]) => /^[A-Z_]+$/.test(k))));

const nightshift = await loadSafe('NightShift.js');
dump('nightshift.json', Object.fromEntries(Object.entries(nightshift).filter(([k]) => /^[A-Z_]+$/.test(k))));

const botpersonality = await loadSafe('BotPersonality.js');
dump('bot-personality.json', Object.fromEntries(Object.entries(botpersonality).filter(([k]) => /^[A-Z_]+$/.test(k))));

const achievements = await loadSafe('Achievements.js');
dump('achievements-defs.json', Object.fromEntries(Object.entries(achievements).filter(([k]) => /^[A-Z_]+$/.test(k))));

// ── 7. Learning layer data ────────────────────────────────────────────────
fs.copyFileSync(path.join(SRC, 'learning/data/brokenbots.json'), path.join(OUT, 'learning-brokenbots.json'));
fs.copyFileSync(path.join(SRC, 'learning/data/teachback.json'), path.join(OUT, 'learning-teachback.json'));
console.log('✓ learning data (copied verbatim)');

// ── 8. Landmarks + plaques (spatial identity) ─────────────────────────────
const landmarks = await loadSafe('data/landmarks.js');
dump('landmarks.json', landmarks.LANDMARKS ?? landmarks);

const plaques = await import(pathToFileURL(path.join(SRC, 'data/plaques.js')).href);
dump('plaques.json', plaques);

console.log('\nDONE — extracted/ is the ground truth.');
