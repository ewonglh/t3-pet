'use strict';
// Uses generated stand-in folders in a temp directory; no real pet art is read or committed.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { listPets } = require('../src/main/pets');
const { readSettings, writeSettings } = require('../src/main/settings');

function fakePng(w, h) {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8); b.write('IHDR', 12, 'ascii'); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20);
  return b;
}
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 't3pet-list-'));
const rm = (d) => fs.rmSync(d, { recursive: true, force: true });
function addPet(root, folder, manifest, sheet = fakePng(1536, 1872)) {
  const dir = path.join(root, folder);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'pet.json'), JSON.stringify({ spritesheetPath: 's.png', ...manifest }));
  if (sheet) fs.writeFileSync(path.join(dir, 's.png'), sheet);
}

test('lists valid pets by display name, skipping broken folders', () => {
  const a = tmp();
  try {
    addPet(a, 'zed', { displayName: 'Zed' });
    addPet(a, 'amy', { displayName: 'Amy' }, fakePng(1536, 2288));
    addPet(a, 'wrong-size', { displayName: 'Wrong' }, fakePng(100, 100));
    addPet(a, 'no-sheet', { displayName: 'None' }, null);
    fs.mkdirSync(path.join(a, 'empty'));
    fs.writeFileSync(path.join(a, 'file.txt'), 'x');
    const list = listPets([a]);
    assert.deepEqual(list.map((p) => [p.key, p.name, p.rows]), [['amy', 'Amy', 11], ['zed', 'Zed', 9]]);
  } finally { rm(a); }
});

test('an earlier folder hides the same pet in a later one; missing roots are fine', () => {
  const a = tmp(), b = tmp();
  try {
    addPet(a, 'boba', { displayName: 'First' });
    addPet(b, 'boba', { displayName: 'Second' });
    addPet(b, 'keqing', { displayName: 'Keqing' });
    const list = listPets([a, path.join(a, 'nope'), b]);
    assert.deepEqual(list.map((p) => p.name), ['First', 'Keqing']);
  } finally { rm(a); rm(b); }
});

test('settings: round trip, defaults, and bad files', () => {
  const d = tmp();
  const file = path.join(d, 'settings.json');
  try {
    assert.deepEqual(readSettings(file), { pet: null });
    assert.equal(writeSettings(file, { pet: 'boba' }), true);
    assert.deepEqual(readSettings(file), { pet: 'boba' });
    assert.equal(writeSettings(file, { pet: null }), true);
    assert.deepEqual(readSettings(file), { pet: null });
    fs.writeFileSync(file, '{not json');
    assert.deepEqual(readSettings(file), { pet: null });
    fs.writeFileSync(file, JSON.stringify({ pet: '../../etc' }));
    assert.deepEqual(readSettings(file), { pet: null });
    fs.writeFileSync(file, JSON.stringify({ pet: 42 }));
    assert.deepEqual(readSettings(file), { pet: null });
    assert.equal(writeSettings(path.join(d, 'missing', 'settings.json'), { pet: 'x' }), false);
  } finally { rm(d); }
});
