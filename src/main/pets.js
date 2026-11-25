// Loads a Petdex / Codex pet folder: pet.json plus a spritesheet (.webp or .png). Reads only those
// two files, checks the sheet size against the 8-column, 192x208 px layout, and returns the image
// bytes. Never throws; a bad pet gives { ok: false, reason } so the caller can fall back.
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { rowsForSize } = require('../shared/sheet-grid');
const { ROW } = require('../shared/pet-rows');
const { rowFps } = require('../shared/sheet-timing');

const MAX_JSON_BYTES = 64 * 1024;
const MAX_SHEET_BYTES = 16 * 1024 * 1024;
const MIME = { '.webp': 'image/webp', '.png': 'image/png' };

// Folders where Petdex and Codex install pets.
function petRoots() {
  const home = os.homedir();
  return [path.join(home, '.petdex', 'pets'), path.join(home, '.codex', 'pets')];
}

// Width and height from the image header, or null. Supports PNG and WebP (lossy, lossless, extended).
function readImageSize(buf) {
  if (buf.length >= 24 && buf.readUInt32BE(0) === 0x89504e47 && buf.toString('ascii', 12, 16) === 'IHDR') {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.length >= 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const kind = buf.toString('ascii', 12, 16);
    if (kind === 'VP8X') return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    if (kind === 'VP8L') {
      const v = buf.readUInt32LE(21);
      return { width: (v & 0x3fff) + 1, height: ((v >> 14) & 0x3fff) + 1 };
    }
    if (kind === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  }
  return null;
}

function fail(reason) { return { ok: false, reason }; }

function loadPetFolder(dir) {
  let manifest;
  try {
    const jsonPath = path.join(dir, 'pet.json');
    if (fs.statSync(jsonPath).size > MAX_JSON_BYTES) return fail('pet.json is too large');
    manifest = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch (e) {
    return fail(`cannot read pet.json (${e.code || e.message})`);
  }
  if (!manifest || typeof manifest !== 'object') return fail('pet.json is not an object');

  const rel = manifest.spritesheetPath;
  if (typeof rel !== 'string' || !rel) return fail('pet.json has no spritesheetPath');
  const sheetPath = path.resolve(dir, rel);
  const inside = path.relative(path.resolve(dir), sheetPath);
  if (inside.startsWith('..') || path.isAbsolute(inside)) return fail('spritesheetPath points outside the pet folder');
  const mime = MIME[path.extname(sheetPath).toLowerCase()];
  if (!mime) return fail('spritesheet must be .webp or .png');

  let bytes;
  try {
    if (fs.statSync(sheetPath).size > MAX_SHEET_BYTES) return fail('spritesheet is too large');
    bytes = fs.readFileSync(sheetPath);
  } catch (e) {
    return fail(`cannot read spritesheet (${e.code || e.message})`);
  }
  const size = readImageSize(bytes);
  if (!size) return fail('spritesheet is not a readable PNG or WebP');
  const rows = rowsForSize(size.width, size.height);
  if (!rows) return fail(`spritesheet is ${size.width}x${size.height}; expected 1536 wide and 1872 or 2288 tall`);

  const text = (v, fallback) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 80) : fallback);
  const id = text(manifest.id, path.basename(dir));
  const { fps, warnings } = rowFps(manifest.fps, Object.keys(ROW), rows);
  return { ok: true, id, name: text(manifest.displayName, id), rows, mime, bytes, fps, warnings };
}

// spec is an absolute folder path, or a pet id / folder name to look for in the install folders.
function resolvePet(spec, roots = petRoots()) {
  if (!spec) return fail('no pet chosen');
  if (path.isAbsolute(spec)) return loadPetFolder(spec);
  if (!/^[\w.-]+$/.test(spec)) return fail('pet id may only contain letters, digits, dot, dash and underscore');
  for (const root of roots) {
    const dir = path.join(root, spec);
    if (fs.existsSync(path.join(dir, 'pet.json'))) return loadPetFolder(dir);
  }
  return fail(`no pet "${spec}" in ${roots.join(' or ')}`);
}

module.exports = { petRoots, readImageSize, loadPetFolder, resolvePet };
