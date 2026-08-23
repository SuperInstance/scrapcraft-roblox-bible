#!/usr/bin/env node
/**
 * dump-textures.mjs — rasterize every procedural block texture from Scrapcraft's
 * TextureGen.js into real 16×16 PNGs, headless, with zero npm installs.
 *
 * A minimal canvas-2d shim (fillRect / strokeRect / path stroke+fill / gradients,
 * source-over alpha blending) backs a fake global document; the source tree is
 * READ-ONLY — TextureGen.js is copied to a temp dir with its three import
 * rewritten to an inert stub (same loadSafe technique as tools/extract-data.mjs).
 *
 * Usage: node tools/dump-textures.mjs /home/eileen/projects/Scrapcraft
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { pathToFileURL, fileURLToPath } from 'node:url';

const SRC = path.resolve(process.argv[2] ?? '/home/eileen/projects/Scrapcraft', 'src');
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'textures');
fs.mkdirSync(OUT, { recursive: true });

// ── three.js stub + source-copy loader (read-only safe) ────────────────────
const TMP = fs.mkdtempSync('/tmp/scrapcraft-tex-');
const STUB = path.join(TMP, '__three_stub.mjs');
fs.writeFileSync(STUB, `export class CanvasTexture { constructor(canvas) { this.canvas = canvas; } }
export const NearestFilter = 'NearestFilter';
export const LinearFilter = 'LinearFilter';
export const RepeatWrapping = 'RepeatWrapping';
export const ClampToEdgeWrapping = 'ClampToEdgeWrapping';
export default { CanvasTexture, NearestFilter, RepeatWrapping };
`);

function loadSafe(relPath) {
  const abs = path.join(SRC, relPath);
  let src = fs.readFileSync(abs, 'utf8');
  if (/^import \* as THREE from 'three';$/m.test(src)) {
    src = src.replace(/^import \* as THREE from 'three';$/m,
      `import * as THREE from '${pathToFileURL(STUB).href}';`);
    // rewrite relative imports so they still resolve against original tree
    src = src.replace(/from '(\.[^']*)'/g, (m, p) =>
      `from '${pathToFileURL(path.resolve(path.dirname(abs), p)).href}'`);
    const copy = path.join(TMP, relPath.replace(/\//g, '__'));
    fs.writeFileSync(copy, src);
    return import(pathToFileURL(copy).href);
  }
  return import(pathToFileURL(abs).href);
}

// ── color parsing + gradients ──────────────────────────────────────────────
const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

function parseColor(s) {
  if (typeof s !== 'string') return s;
  let m;
  if ((m = s.match(/^#([0-9a-f]{6})$/i))) {
    return { r: parseInt(m[1].slice(0, 2), 16), g: parseInt(m[1].slice(2, 4), 16), b: parseInt(m[1].slice(4, 6), 16), a: 1 };
  }
  if ((m = s.match(/^#([0-9a-f]{3})$/i))) {
    return { r: parseInt(m[1][0] + m[1][0], 16), g: parseInt(m[1][1] + m[1][1], 16), b: parseInt(m[1][2] + m[1][2], 16), a: 1 };
  }
  if ((m = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/))) {
    return { r: clamp255(+m[1]), g: clamp255(+m[2]), b: clamp255(+m[3]), a: m[4] === undefined ? 1 : Math.min(1, Math.max(0, +m[4])) };
  }
  return { r: 0, g: 0, b: 0, a: 1 };
}

class Gradient {
  constructor(type, coords) { this.type = type; this.coords = coords; this.stops = []; }
  addColorStop(off, col) { this.stops.push({ off, col: parseColor(col) }); }
  resolve(cx, cy) {
    const s = this.stops.slice().sort((a, b) => a.off - b.off);
    if (!s.length) return { r: 0, g: 0, b: 0, a: 0 };
    const last = s[s.length - 1];
    let t;
    if (this.type === 'linear') {
      const [x0, y0, x1, y1] = this.coords;
      const dx = x1 - x0, dy = y1 - y0;
      t = ((cx - x0) * dx + (cy - y0) * dy) / (dx * dx + dy * dy || 1);
    } else {
      const [x0, y0, r0, , , r1] = this.coords;
      t = (Math.hypot(cx - x0, cy - y0) - r0) / (r1 - r0 || 1);
    }
    if (t <= s[0].off) return s[0].col;
    if (t >= last.off) return last.col;
    for (let i = 0; i < s.length - 1; i++) {
      if (t >= s[i].off && t <= s[i + 1].off) {
        const f = (t - s[i].off) / (s[i + 1].off - s[i].off || 1);
        const l = (a, b) => a + (b - a) * f;
        return { r: l(s[i].col.r, s[i + 1].col.r), g: l(s[i].col.g, s[i + 1].col.g), b: l(s[i].col.b, s[i + 1].col.b), a: l(s[i].col.a, s[i + 1].col.a) };
      }
    }
    return last.col;
  }
}

// ── canvas 2d shim ─────────────────────────────────────────────────────────
class Ctx2D {
  constructor(canvas) {
    this.canvas = canvas;
    this._w = canvas.width;
    this._h = canvas.height;
    this.data = new Uint8ClampedArray(this._w * this._h * 4);
    this._fill = parseColor('#000');
    this._stroke = parseColor('#000');
    this.lineWidth = 1;
    this._subs = [];
  }
  set fillStyle(v) { this._fill = v instanceof Gradient ? v : parseColor(v); }
  get fillStyle() { return this._fill; }
  set strokeStyle(v) { this._stroke = v instanceof Gradient ? v : parseColor(v); }
  get strokeStyle() { return this._stroke; }

  createLinearGradient(x0, y0, x1, y1) { return new Gradient('linear', [x0, y0, x1, y1]); }
  createRadialGradient(x0, y0, r0, x1, y1, r1) { return new Gradient('radial', [x0, y0, r0, x1, y1, r1]); }

  _styleAt(style, cx, cy) { return style instanceof Gradient ? style.resolve(cx, cy) : style; }

  _blend(px, py, col) {
    const i = (py * this._w + px) * 4;
    const d = this.data;
    const sa = col.a;
    if (sa <= 0) return;
    const da = d[i + 3] / 255;
    const oa = sa + da * (1 - sa);
    d[i]     = (col.r * sa + d[i]     * da * (1 - sa)) / oa;
    d[i + 1] = (col.g * sa + d[i + 1] * da * (1 - sa)) / oa;
    d[i + 2] = (col.b * sa + d[i + 2] * da * (1 - sa)) / oa;
    d[i + 3] = oa * 255;
  }

  fillRect(x, y, w, h) {
    for (let py = 0; py < this._h; py++) for (let px = 0; px < this._w; px++) {
      const cx = px + 0.5, cy = py + 0.5;
      if (cx >= x && cx < x + w && cy >= y && cy < y + h) this._blend(px, py, this._styleAt(this._fill, cx, cy));
    }
  }

  strokeRect(x, y, w, h) {
    const o = this.lineWidth / 2;
    for (let py = 0; py < this._h; py++) for (let px = 0; px < this._w; px++) {
      const cx = px + 0.5, cy = py + 0.5;
      const outer = cx >= x - o && cx < x + w + o && cy >= y - o && cy < y + h + o;
      const inner = cx >= x + o && cx < x + w - o && cy >= y + o && cy < y + h - o;
      if (outer && !inner) this._blend(px, py, this._styleAt(this._stroke, cx, cy));
    }
  }

  beginPath() { this._subs = []; }
  moveTo(x, y) { this._subs.push({ pts: [[x, y]], closed: false }); }
  lineTo(x, y) {
    const s = this._subs[this._subs.length - 1];
    if (!s) return this.moveTo(x, y);
    s.pts.push([x, y]);
  }
  closePath() { const s = this._subs[this._subs.length - 1]; if (s) s.closed = true; }

  stroke() {
    const t = Math.max(1, Math.round(this.lineWidth));
    for (const s of this._subs) {
      const pts = s.pts;
      if (!pts.length) continue;
      if (pts.length === 1) { this._stamp(pts[0][0], pts[0][1], t); continue; }
      for (let i = 0; i + 1 < pts.length; i++) this._strokeSeg(pts[i], pts[i + 1], t);
      if (s.closed) this._strokeSeg(pts[pts.length - 1], pts[0], t);
    }
  }

  _strokeSeg(p0, p1, t) {
    let x0 = Math.round(p0[0]), y0 = Math.round(p0[1]);
    const x1 = Math.round(p1[0]), y1 = Math.round(p1[1]);
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this._stamp(x0, y0, t);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  _stamp(x, y, t) {
    const off = -(t >> 1);
    for (let dy = 0; dy < t; dy++) for (let dx = 0; dx < t; dx++) {
      const px = x + off + dx, py = y + off + dy;
      if (px < 0 || py < 0 || px >= this._w || py >= this._h) continue;
      this._blend(px, py, this._styleAt(this._stroke, px + 0.5, py + 0.5));
    }
  }

  fill() {
    const polys = this._subs.filter(s => s.pts.length >= 3);
    for (let py = 0; py < this._h; py++) for (let px = 0; px < this._w; px++) {
      const cx = px + 0.5, cy = py + 0.5;
      if (polys.some(s => pointInPolygon(cx, cy, s.pts))) this._blend(px, py, this._styleAt(this._fill, cx, cy));
    }
  }
}

function pointInPolygon(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

class CanvasShim {
  constructor() { this.width = 300; this.height = 150; this._ctx = null; }
  getContext(kind) {
    if (kind !== '2d') return null;
    if (!this._ctx) this._ctx = new Ctx2D(this);
    return this._ctx;
  }
}

globalThis.document = {
  createElement(tag) {
    if (tag !== 'canvas') throw new Error(`shim: document.createElement('${tag}') unsupported`);
    return new CanvasShim();
  },
};

// ── PNG encoder (IHDR/IDAT/IEND, filter 0, zlib) ───────────────────────────
let CRC_TABLE;
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xff];
  return (c ^ -1) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(w, h, rgba) {
  const stride = w * 4 + 1;
  const raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0; // filter type 0
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * stride + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── dump all textures ──────────────────────────────────────────────────────
const TextureGen = await loadSafe('TextureGen.js');
const { B, BLOCK_DEF } = await import(pathToFileURL(path.join(SRC, 'data/blocks.js')).href);
const idToKey = Object.fromEntries(Object.entries(B).map(([k, v]) => [v, k]));

const textures = TextureGen.buildTextures();
const manifest = [];
for (const [id, tex] of textures) {
  const ctx = tex.canvas.getContext('2d');
  const key = idToKey[id] ?? `BLOCK_${id}`;
  const file = `${String(id).padStart(2, '0')}_${key}.png`;
  const png = encodePNG(ctx._w, ctx._h, ctx.data);
  fs.writeFileSync(path.join(OUT, file), png);
  manifest.push({ file, blockId: id, name: BLOCK_DEF[id]?.name ?? key });
  console.log(`✓ ${file} (${ctx._w}×${ctx._h}, ${png.length} bytes)`);
}

fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
fs.rmSync(TMP, { recursive: true, force: true });
console.log(`\nDONE — ${manifest.length} textures + manifest.json → ${OUT}`);
