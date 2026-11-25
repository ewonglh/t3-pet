'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildThreadLink } = require('../src/main/thread-link');
const { readEnvironmentId } = require('../src/status/environment');

test('builds a t3code thread link', () => {
  assert.equal(
    buildThreadLink({ environmentId: 'env-1', threadId: 'thread-2' }),
    't3code://threads/env-1/thread-2',
  );
});

test('uses the dev scheme when asked', () => {
  assert.equal(
    buildThreadLink({ scheme: 't3code-dev', environmentId: 'e', threadId: 't' }),
    't3code-dev://threads/e/t',
  );
});

test('percent-encodes both ids', () => {
  assert.equal(
    buildThreadLink({ environmentId: 'a b', threadId: 'x/y?z#1' }),
    't3code://threads/a%20b/x%2Fy%3Fz%231',
  );
});

test('refuses unknown schemes (never https)', () => {
  assert.equal(buildThreadLink({ scheme: 'https', environmentId: 'e', threadId: 't' }), null);
  assert.equal(buildThreadLink({ scheme: 'file', environmentId: 'e', threadId: 't' }), null);
});

test('refuses missing, empty, oversized or control-character ids', () => {
  assert.equal(buildThreadLink({ threadId: 't' }), null);
  assert.equal(buildThreadLink({ environmentId: 'e' }), null);
  assert.equal(buildThreadLink({ environmentId: '', threadId: 't' }), null);
  assert.equal(buildThreadLink({ environmentId: 'e', threadId: null }), null);
  assert.equal(buildThreadLink({ environmentId: 'e', threadId: 'x'.repeat(257) }), null);
  assert.equal(buildThreadLink({ environmentId: 'e', threadId: 'a\nb' }), null);
  assert.equal(buildThreadLink(), null);
});

test('readEnvironmentId reads the first line and trims it', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't3pet-env-'));
  try {
    const file = path.join(dir, 'environment-id');
    fs.writeFileSync(file, '  abc-123  \r\nsecond line ignored\n');
    assert.equal(readEnvironmentId(file), 'abc-123');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('readEnvironmentId returns null for a missing or empty file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't3pet-env-'));
  try {
    assert.equal(readEnvironmentId(path.join(dir, 'nope')), null);
    const empty = path.join(dir, 'empty');
    fs.writeFileSync(empty, '\n');
    assert.equal(readEnvironmentId(empty), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
