'use strict';
// Uses generated stand-in files in a temp folder; no real pet art is read or committed.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readImageSize, loadPetFolder, resolvePet } = require('../src/main/pets');
const G = require('../src/shared/sheet-grid');
const { rowFor, ROW } = require('../src/shared/pet-rows');

// Just enough of a PNG for its header to be read.
function fakePng(w, h) {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12, 'ascii');
  b.writeUInt32BE(w, 16);
  b.writeUInt32BE(h, 20);
  return b;
}
// Just enough of a lossless WebP for its header to be read.
function fakeWebpL(w, h) {
  const b = Buffer.alloc(40);
  b.write('RIFF', 0, 'ascii'); b.write('WEBP', 8, 'ascii'); b.write('VP8L', 12, 'ascii');
  b[20] = 0x2f;
  b.writeUInt32LE(((w - 1) & 0x3fff) | (((h - 1) & 0x3fff) << 14), 21);
  return b;
}

function makePetDir(manifest, sheet, sheetName = 'spritesheet.webp') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't3pet-pet-'));
  if (manifest !== null) fs.writeFileSync(path.join(dir, 'pet.json'), typeof manifest === 'string' ? manifest : JSON.stringify(manifest));
  if (sheet) fs.writeFileSync(path.join(dir, sheetName), sheet);
  return dir;
}
const rm = (d) => fs.rmSync(d, { recursive: true, force: true });

test('reads PNG and WebP sizes, and rejects other data', () => {
  assert.deepEqual(readImageSize(fakePng(1536, 1872)), { width: 1536, height: 1872 });
  assert.deepEqual(readImageSize(fakeWebpL(1536, 2288)), { width: 1536, height: 2288 });
  assert.equal(readImageSize(Buffer.from('not an image at all, just text padding')), null);
  assert.equal(readImageSize(Buffer.alloc(4)), null);
});

test('only 1536 wide sheets of 9 or 11 rows are supported', () => {
  assert.equal(G.rowsForSize(1536, 1872), 9);
  assert.equal(G.rowsForSize(1536, 2288), 11);
  assert.equal(G.rowsForSize(1536, 2000), 0);
  assert.equal(G.rowsForSize(1024, 1872), 0);
});

test('loads a valid pet folder', () => {
  const dir = makePetDir({ id: 'boba', displayName: 'Boba', spritesheetPath: 'spritesheet.webp' }, fakeWebpL(1536, 2288));
  try {
    const p = loadPetFolder(dir);
    assert.equal(p.ok, true);
    assert.equal(p.id, 'boba');
    assert.equal(p.name, 'Boba');
    assert.equal(p.rows, 11);
    assert.equal(p.mime, 'image/webp');
    assert.ok(Buffer.isBuffer(p.bytes));
  } finally { rm(dir); }
});

test('name falls back to id, id falls back to the folder name', () => {
  const dir = makePetDir({ spritesheetPath: 'sheet.png' }, fakePng(1536, 1872), 'sheet.png');
  try {
    const p = loadPetFolder(dir);
    assert.equal(p.ok, true);
    assert.equal(p.id, path.basename(dir));
    assert.equal(p.name, p.id);
    assert.equal(p.mime, 'image/png');
  } finally { rm(dir); }
});

test('rejects bad pets with a reason instead of throwing', () => {
  const cases = [
    [null, null, /pet\.json/],
    ['{not json', null, /pet\.json/],
    [{ displayName: 'x' }, null, /spritesheetPath/],
    [{ spritesheetPath: '../outside.webp' }, null, /outside/],
    [{ spritesheetPath: 'C:\\Windows\\win.ini' }, null, /outside|\.webp or \.png/],
    [{ spritesheetPath: 'sheet.gif' }, fakePng(1536, 1872), /\.webp or \.png/],
    [{ spritesheetPath: 'spritesheet.webp' }, null, /cannot read spritesheet/],
    [{ spritesheetPath: 'spritesheet.webp' }, Buffer.from('this is not an image, only text for a test'), /not a readable/],
    [{ spritesheetPath: 'spritesheet.webp' }, fakeWebpL(512, 512), /expected 1536 wide/],
  ];
  for (const [manifest, sheet, pattern] of cases) {
    const dir = makePetDir(manifest, sheet);
    try {
      const p = loadPetFolder(dir);
      assert.equal(p.ok, false, JSON.stringify(manifest));
      assert.match(p.reason, pattern);
    } finally { rm(dir); }
  }
});

test('resolvePet finds a pet by id in the install folders, and refuses odd ids', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 't3pet-root-'));
  try {
    fs.mkdirSync(path.join(root, 'boba'));
    fs.writeFileSync(path.join(root, 'boba', 'pet.json'), JSON.stringify({ spritesheetPath: 'spritesheet.webp' }));
    fs.writeFileSync(path.join(root, 'boba', 'spritesheet.webp'), fakeWebpL(1536, 1872));
    assert.equal(resolvePet('boba', [path.join(root, 'nope'), root]).ok, true);
    assert.match(resolvePet('missing', [root]).reason, /no pet/);
    assert.match(resolvePet('..\\boba', [root]).reason, /letters, digits/);
    assert.match(resolvePet('', [root]).reason, /no pet chosen/);
    assert.equal(resolvePet(path.join(root, 'boba')).ok, true);
  } finally { rm(root); }
});

test('scanSheet counts frames per row, ignoring padding, and boxes the idle row', () => {
  const rows = G.STANDARD_ROWS;
  const width = G.FRAME_W * G.COLS, height = G.FRAME_H * rows;
  const rgba = new Uint8ClampedArray(width * height * 4);
  const paint = (row, col, x, y) => { rgba[(((row * G.FRAME_H + y) * width) + col * G.FRAME_W + x) * 4 + 3] = 255; };
  for (let c = 0; c < 6; c++) paint(0, c, 90 + c, 40 + c); // idle: 6 frames
  paint(0, 7, 100, 170); // a last idle frame, so idle has 8 and the box reaches y=170
  for (let c = 0; c < 4; c++) paint(3, c, 10, 10); // waving: 4 frames
  // row 1 is empty
  const scan = G.scanSheet(rgba, width, height, rows);
  assert.deepEqual(scan.framesPerRow, [8, 0, 0, 4, 0, 0, 0, 0, 0]);
  assert.deepEqual(scan.idleBox, { left: 90, right: 100, top: 40, bottom: 170 });
});

test('an empty idle row gets a whole-frame box', () => {
  const width = G.FRAME_W * G.COLS, height = G.FRAME_H * G.STANDARD_ROWS;
  const scan = G.scanSheet(new Uint8ClampedArray(width * height * 4), width, height, G.STANDARD_ROWS);
  assert.deepEqual(scan.idleBox, { left: 0, right: G.FRAME_W - 1, top: 0, bottom: G.FRAME_H - 1 });
});

test('rowFor picks a row from the animation and the direction of travel', () => {
  assert.equal(rowFor('walk', { facing: 1 }), ROW['running-right']);
  assert.equal(rowFor('run', { facing: -1 }), ROW['running-left']);
  assert.equal(rowFor('working'), ROW.running);
  assert.equal(rowFor('waiting'), ROW.waiting);
  assert.equal(rowFor('error'), ROW.failed);
  assert.equal(rowFor('done'), ROW.waving);
  assert.equal(rowFor('idle'), ROW.idle);
  assert.equal(rowFor('something-new'), ROW.idle);
});
