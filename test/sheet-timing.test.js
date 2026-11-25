'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DEFAULT_FPS, rowFps, oneShotSeconds } = require('../src/shared/sheet-timing');
const { ROW } = require('../src/shared/pet-rows');
const { loadPetFolder } = require('../src/main/pets');

const NAMES = Object.keys(ROW);

test('no fps means the default on every row', () => {
  const r = rowFps(undefined, NAMES, 9);
  assert.deepEqual(r.fps, new Array(9).fill(DEFAULT_FPS));
  assert.deepEqual(r.warnings, []);
});

test('a number applies to every row, including the extra v2 rows', () => {
  assert.deepEqual(rowFps(12, NAMES, 11).fps, new Array(11).fill(12));
});

test('an object sets named rows and leaves the rest at the default', () => {
  const r = rowFps({ running: 12, idle: 4 }, NAMES, 9);
  assert.equal(r.fps[ROW.running], 12);
  assert.equal(r.fps[ROW.idle], 4);
  assert.equal(r.fps[ROW.failed], DEFAULT_FPS);
  assert.deepEqual(r.warnings, []);
});

test('bad values fall back to the default and warn', () => {
  for (const bad of [0, 61, -3, NaN, Infinity, 'fast', [8], true]) {
    const r = rowFps(bad, NAMES, 9);
    assert.deepEqual(r.fps, new Array(9).fill(DEFAULT_FPS), String(bad));
    assert.equal(r.warnings.length, 1, String(bad));
  }
  const r = rowFps({ running: 'x', nonsense: 5, failed: 100, waving: 10 }, NAMES, 9);
  assert.equal(r.fps[ROW.waving], 10);
  assert.equal(r.fps[ROW.running], DEFAULT_FPS);
  assert.equal(r.fps[ROW.failed], DEFAULT_FPS);
  assert.equal(r.warnings.length, 3);
});

test('a one-shot lasts as long as the pet\'s own row, so pets differ', () => {
  assert.equal(oneShotSeconds(4, 8), 0.5);   // a short row
  assert.equal(oneShotSeconds(8, 8), 1);     // a long row
  assert.equal(oneShotSeconds(6, 12), 0.5);  // same frames, faster pet
  assert.equal(oneShotSeconds(0, 8), 0.125); // an empty row still counts as one frame
});

test('the loader returns per-row fps and warnings from pet.json', () => {
  const png = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png, 0);
  png.writeUInt32BE(13, 8); png.write('IHDR', 12, 'ascii'); png.writeUInt32BE(1536, 16); png.writeUInt32BE(1872, 20);
  const make = (fps) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't3pet-fps-'));
    fs.writeFileSync(path.join(dir, 'pet.json'), JSON.stringify({ id: 'x', spritesheetPath: 's.png', fps }));
    fs.writeFileSync(path.join(dir, 's.png'), png);
    return dir;
  };
  const a = make({ failed: 14 }), b = make(99);
  try {
    const pa = loadPetFolder(a), pb = loadPetFolder(b);
    assert.equal(pa.ok, true);
    assert.equal(pa.fps.length, 9);
    assert.equal(pa.fps[ROW.failed], 14);
    assert.deepEqual(pa.warnings, []);
    assert.equal(pb.fps[ROW.failed], DEFAULT_FPS);
    assert.equal(pb.warnings.length, 1);
  } finally {
    fs.rmSync(a, { recursive: true, force: true });
    fs.rmSync(b, { recursive: true, force: true });
  }
});
