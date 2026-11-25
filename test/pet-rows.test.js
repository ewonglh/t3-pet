'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { ROW, ROW_FOR, rowFor } = require('../src/shared/pet-rows');

const ANIMS = ['idle', 'walk', 'run', 'sleep', 'working', 'waiting', 'done', 'error', 'picked', 'fall', 'land', 'petted', 'hurt', 'dizzy', 'ouch', 'wake'];

test('every built-in animation has an entry and every entry names a real row', () => {
  for (const a of ANIMS) assert.ok(ROW_FOR[a], `no row for ${a}`);
  for (const [a, r] of Object.entries(ROW_FOR)) assert.ok(r in ROW, `${a} -> unknown row ${r}`);
  assert.deepEqual(Object.keys(ROW_FOR).sort(), [...ANIMS].sort());
});

test('T3 activity maps to the contract rows', () => {
  assert.equal(rowFor('working'), ROW.running);
  assert.equal(rowFor('waiting'), ROW.waiting);
  assert.equal(rowFor('error'), ROW.failed);
  assert.equal(rowFor('idle'), ROW.idle);
  assert.equal(rowFor('sleep'), ROW.idle);
  assert.equal(rowFor('done'), ROW.waving);
});

test('moving follows the direction of travel', () => {
  assert.equal(rowFor('walk', { facing: 1 }), ROW['running-right']);
  assert.equal(rowFor('walk', { facing: -1 }), ROW['running-left']);
  assert.equal(rowFor('run', { facing: -1 }), ROW['running-left']);
  assert.equal(rowFor('run', {}), ROW['running-right']);
});

test('vertical motion jumps; petted and woken wave; hurt defaults to failed', () => {
  for (const a of ['picked', 'fall']) assert.equal(rowFor(a), ROW.jumping);
  for (const a of ['petted', 'wake']) assert.equal(rowFor(a), ROW.waving);
  for (const a of ['hurt', 'dizzy', 'ouch']) assert.equal(rowFor(a), ROW.failed);
});

test('unknown animations play idle', () => {
  assert.equal(rowFor('nonsense'), ROW.idle);
});
