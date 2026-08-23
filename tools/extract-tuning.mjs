#!/usr/bin/env node
/**
 * extract-tuning.mjs — pass-2 ground-truth extraction.
 * Pass 1 only dumped uppercase module exports; the tuning below lives in
 * class bodies / module-private consts, so it is extracted by direct source
 * read of the READ-ONLY Scrapcraft tree. Every number cites file:line.
 */
import fs from 'node:fs';

const SRC = '/home/eileen/projects/Scrapcraft/src';
const OUT = 'extracted';
fs.mkdirSync(OUT, { recursive: true });

const dump = (name, data) => {
  fs.writeFileSync(`${OUT}/${name}`, JSON.stringify(data, null, 2));
  console.log(`✓ ${name}`);
};

// ── NightShift tuning (module-private consts — pass-1 dump was empty) ──────
// src/NightShift.js:23-27, 62-67
dump('nightshift.json', {
  _source: 'src/NightShift.js:23-27 (module-private; not exported)',
  NS_MIN_AWAY_MS: 20 * 60 * 1000,   // :23 below this, no shift
  NS_RATE_MIN: 3,                   // :24 minutes per iron_scrap
  NS_CAP_MS: 8 * 60 * 60 * 1000,    // :25 hard cap 8h
  NS_BONUS_EVERY: 75,               // :26 minutes per bonus find
  NS_BONUS_POOL: ['circuit_board', 'spring', 'gear_small', 'copper_wire'], // :27
  BONUS_CAP: 6,                     // :67 Math.min(6, ...)
  ironFormula: 'floor(minutes/3)',  // :65
  seededRng: 'mulberry32(hashStr(seedKey))', // :52-58,69 deterministic per-day
  LS_KEY: 'scrapcraft_nightshift_v1',
  requires: 'botHasBrain (a robot_helper with a loaded brain)', // :61
});

// ── PanicButton full tuning (pass-1 dump caught only 2 of the exports) ────
// src/PanicButton.js:16-17,60,70,92-95
dump('panic-tuning.json', {
  _source: 'src/PanicButton.js',
  PANIC_THRESHOLD: 3,                       // :16 crashes w/o completed task → button shows
  PANIC_COOLDOWN_MS: 300000,                // :17 5 min between presses
  ROCKET_OVERDRIVE: {
    boostMs: 4000,                          // Game.js:2412 performance.now()+4000
    speedMult: 3,                           // ScrapBot.js:337 (follow), :406 (brain tick)
    tickSpeedMult: 3,                       // ScrapBot.js:405-407
    smashMax: 5, smashRadius: 4,            // PanicButton.js:70
    yMin: 1, yMax: 3,                       // :70
    smashable: ['SCRAP_PILE', 'RUST_METAL', 'OIL_DRUM', 'JUNK_CAR', 'CONCRETE'], // :60
  },
  lootCache: {                              // :92-95 rollLootCache
    guaranteed: { id: 'iron_scrap', qty: '3 + floor(rand()*3)' },
    copperWire60pct: { id: 'copper_wire', qty: '1 + floor(rand()*2)', chance: 0.6 },
    smallGear35pct: { id: 'small_gear', qty: 1, chance: 0.35 },
  },
  resetRule: 'any completed task (lap/waypoint/challenge) zeroes crashCount', // :26-29, Game.js:2386
});

// ── ScrapExchange deal pool (pass-1 dump caught only EXCHANGE_POS) ────────
// src/ScrapExchange.js:17-39 + picker
{
  const src = fs.readFileSync(`${SRC}/ScrapExchange.js`, 'utf8');
  const poolMatch = src.match(/const DEAL_POOL = (\[[\s\S]*?\n\]);/);
  const DEAL_POOL = eval(poolMatch[1]); // literal table, read-only eval of matched text
  dump('scrap-exchange.json', {
    _source: 'src/ScrapExchange.js:17-39',
    DEAL_POOL,
    EXCHANGE_POS: { x: 14, z: 14 },   // :41
    EXCHANGE_RADIUS: 6,               // :43
    dealsPerDay: 3,                   // getDeals() :52-58
    dayKey: 'floor(Date.now()/86_400_000) — same deals for every player that day', // :15,55
  });
}

// ── Race + lap timing (class bodies in Game.js, RaceBoard ghosts) ─────────
dump('race-timing.json', {
  _source: 'src/Game.js:3295-3360, src/RaceBoard.js:11-17, src/quests/data',
  trackCircuit: {
    gate: 'x 29.5..46.5, z 13.0..15.5 (y=0)',   // Game.js:3323
    minLapMs: 2000,                              // :3328 anti-cheat debounce
    xpPerLap: 20,                                // :3345
    ghostRecording: '10 Hz frames [x, z, yaw, ms]', // :3305-3312
    confettiAt: { x: 38, y: 1.5, z: 14 },        // :3338
  },
  ovalCircuitCity: 'x≈49, z≈84 (Game.js:385)',
  npcGhosts: [                                    // RaceBoard.js:12-16
    { name: 'Earl Jr.',    ms: 18400 },
    { name: 'Ratchet',     ms: 23200 },
    { name: 'Scrapdog',    ms: 28900 },
    { name: 'Gearhead',    ms: 35100 },
    { name: 'Rookie Rex',  ms: 44800 },
  ],
  multiplayerDO: {                                // cloudflare/src/durable-bot-race.js:30-34
    POSITION_BROADCAST_MS: 50,                    // 20 fps
    COUNTDOWN_SECONDS: 3,
    DEFAULT_LAPS: 3,
    RACE_TIMEOUT_SECONDS: 300,
  },
});

// ── Player + bot physics (module-private consts) ──────────────────────────
dump('player-bot-physics.json', {
  _source: 'src/Player.js:3-5,149 · src/ScrapBot.js:15-16,345,386 · src/maker/kinematics.js:6-9',
  player: { SPEED: 5.2, JUMP_VEL: 6.5, GRAVITY: -18,
    speedMult: { go_kart: 3, sprint_or_fuelBoost: 1.8 } }, // Player.js:149
  scrapBotFollow: { BOT_SPEED: 4.5, FOLLOW_DIST: 3,       // ScrapBot.js:15-16
    velocityLerp: '5*dt',                                  // :346
    accelTaper: 'min(1, dist - FOLLOW_DIST + 1)',          // :345
    wallAvoid: 'probe 0.9 ahead; try ±45°',                // :325-340
    speedCoilMult: 1.4 },                                  // :342
  botBrainSim: { DRIVE_SPEED: 3.0, TURN_RATE: 180, BOT_RADIUS: 0.3, SONAR_RANGE: 6.0 }, // kinematics.js:6-9
  battery: { start: 100, drainIdlePerSec: 0.4, drainDrivingPerSec: 1.3, // ScrapBot.js:386
    lowWarnPct: 15, eyeOrangePct: 25, eyeRedFlashPct: 10,  // :396-410
    editionDrainMult: { standard: 1, gate: 1.25 } },       // data/botEditions.js
  botEditions: { standard: { speedMult: 1, batteryDrainMult: 1 }, gate: { speedMult: 0.8, batteryDrainMult: 1.25 } },
});

// ── Day/night + weather (class bodies) ────────────────────────────────────
dump('daynight-weather.json', {
  _source: 'src/DayNight.js:4,6-17,42-44 · src/WeatherSystem.js:5-9,24,61,81-84,103,111',
  dayNight: {
    cycleSeconds: 360, startTime: 0.35, // morning
    isNight: 't<0.25 || t>0.78',
    keyframes: [
      { t: 0.00, phase: 'midnight', sky: '0x0a0a1e', aI: 0.15, sI: 0.0 },
      { t: 0.20, phase: 'pre-dawn', sky: '0x1a1a3e', aI: 0.2,  sI: 0.1 },
      { t: 0.28, phase: 'sunrise',  sky: '0xff6633', aI: 0.5,  sI: 0.6 },
      { t: 0.35, phase: 'morning',  sky: '0x8aabbb', aI: 0.6,  sI: 1.2 },
      { t: 0.50, phase: 'noon',     sky: '0x6699cc', aI: 0.7,  sI: 1.4 },
      { t: 0.65, phase: 'afternoon',sky: '0x8aabbb', aI: 0.6,  sI: 1.1 },
      { t: 0.75, phase: 'sunset',   sky: '0xff4422', aI: 0.5,  sI: 0.5 },
      { t: 0.82, phase: 'dusk',     sky: '0x221133', aI: 0.2,  sI: 0.05 },
      { t: 1.00, phase: 'midnight', sky: '0x0a0a1e', aI: 0.15, sI: 0.0 },
    ],
    stars: { count: 300, radius: 90, size: 0.4 },
    sunArc: 'angle = t*2π − π/2; pos = (cos·50, sin·50+10, 20)',
  },
  weather: {
    durationsSec: { clear: [120, 240], rain: [40, 90], storm: [25, 60] },
    transitionFromClear: '55% rain / 45% storm',
    targetIntensity: { clear: 0, rain: 0.65, storm: 1.0 },
    rainParticles: 1800, cloudSpan: 52, recycleBand: 28, spawnY: '22+rand*4',
    fallSpeed: '16 + intensity*12',
    rainOpacity: 'intensity * 0.55',
    thunderGapSec: [5, 14], lightningAmbientBoost: 2.5, flashDecay: 'dt*6',
    lerpRate: { rampUp: 0.25, rampDown: 0.6 },
  },
});

// ── Companion trait mechanics (constants + per-persona axes) ──────────────
{
  const personasSrc = fs.readFileSync(`${SRC}/companion/personas.js`, 'utf8');
  const axes = {};
  for (const id of ['rivet', 'bolt', 'magma', 'juno']) {
    const re = new RegExp(`id: '${id}',[\\s\\S]*?traits: \\{([\\s\\S]*?)\\n  \\},`);
    const m = personasSrc.match(re);
    if (m) axes[id] = m[1].trim().split('\n').map(l => l.trim()).filter(Boolean);
  }
  dump('companion-trait-mechanics.json', {
    _source: 'src/companion/personas.js:32-34 · src/companion/state.js:28-50,96-98,150-163',
    TRAIT_PUSH: 0.04, TRAIT_PULL: 0.008, TRAIT_FLOOR: 0.08, // personas.js:32-34
    TIER_THRESHOLDS: { stranger: 0, coworker: 30, friend: 120 }, // state.js:47
    RECENT_CAP: 12, // state.js:50
    traitRule: 'event matches axis.events → axis = min(1, +0.04); all other axes = max(0.08, −0.008)', // state.js:150-163
    perPersonaAxesRaw: axes,
  });
}

// ── XP award table (scattered gain() calls in Game.js + systems) ──────────
dump('xp-awards.json', {
  _source: 'src/Game.js (line-cited) · XPSystem.js:103,116,140,142',
  formula: { xpForLevel: 'n²·10', level: 'floor(sqrt(xp/10))' },
  awards: [
    { what: 'mine block (any)', xp: 1, cite: 'Game.js:1278' },
    { what: 'mine item drop pickup', xp: 2, cite: 'Game.js:1189' },
    { what: 'crystal ore bonus', xp: 5, cite: 'Game.js:1276' },
    { what: 'lucky find', xp: 5, cite: 'Game.js:1225' },
    { what: 'place block', xp: 2, cite: 'Game.js:1330' },
    { what: 'program run (example or bot2)', xp: 15, cite: 'Game.js:1042,1579' },
    { what: 'lap complete', xp: 20, cite: 'Game.js:3345' },
    { what: 'exchange trade', xp: 20, cite: 'Game.js:1349' },
    { what: 'airdrop loot', xp: 20, cite: 'Game.js:1261' },
    { what: 'buried cache found', xp: 40, cite: 'Game.js:1777' },
    { what: 'radio tower activated', xp: 200, cite: 'Game.js:1835' },
    { what: 'bot upgrade purchased', xp: 50, cite: 'Game.js:1379' },
    { what: 'gallery program saved', xp: 50, cite: 'BrainGallery.js:387' },
    { what: 'cannon fire', xp: 1, cite: 'Game.js:1612' },
    { what: 'grenade per block destroyed', xp: 2, cite: 'Game.js:1648' },
    { what: 'waypoint flag placed (consumes item)', xp: 3, cite: 'Game.js:1938' },
    { what: 'craft (first time item)', xp: 10, cite: 'Game.js:2057' },
    { what: 'craft (repeat)', xp: 3, cite: 'Game.js:2057' },
    { what: 'new sensor type in program', xp: 8, cite: 'XPSystem.js:103' },
    { what: 'new variable name in program', xp: 10, cite: 'XPSystem.js:116' },
    { what: 'night shift return', xp: 'min(60, 10 + floor(min/30)·5)', cite: 'Game.js:498' },
    { what: 'daily contract', xp: 'reward.xp + streak bonus', cite: 'DailyContract.js:389' },
    { what: 'challenge complete', xp: 'per-challenge r.xp', cite: 'Challenge.js:209' },
    { what: 'quest step', xp: 'per-step rewards.xp (see quest-*.json)', cite: 'quests/data/*.json' },
  ],
});

console.log('\nDONE — pass-2 tuning extracted.');
