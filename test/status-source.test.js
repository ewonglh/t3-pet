'use strict';
// Runs the polling source against a throwaway database file, never real T3 data.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { createStatusSource } = require('../src/status');
const { StatusSource } = require('../src/status/status-source');
const { makeSnippet } = require('../src/status/queries');

const HOUR = 3600000;

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't3pet-src-'));
  const file = path.join(dir, 'state.sqlite');
  const db = new DatabaseSync(file);
  db.exec(`
    CREATE TABLE orchestration_v2_projection_threads (thread_id TEXT, title TEXT, archived_at TEXT, deleted_at TEXT);
    CREATE TABLE orchestration_v2_projection_runs (run_id TEXT, thread_id TEXT, status TEXT, requested_at TEXT, completed_at TEXT);
    CREATE TABLE orchestration_v2_projection_runtime_requests (thread_id TEXT, created_at TEXT, status TEXT);
    CREATE TABLE orchestration_v2_projection_messages (message_id TEXT, thread_id TEXT, run_id TEXT, role TEXT, streaming INTEGER, created_at TEXT, payload_json TEXT);
  `);
  const addThread = (id, title, { archived = null, deleted = null } = {}) =>
    db.prepare('INSERT INTO orchestration_v2_projection_threads VALUES (?, ?, ?, ?)').run(id, title, archived, deleted);
  addThread('th-1', 'Fix login redirect');
  const src = createStatusSource({ dbPath: file, log: () => {} });
  const addRun = (id, status, completedMsAgo, thread = 'th-1') => {
    const now = Date.now();
    db.prepare('INSERT INTO orchestration_v2_projection_runs VALUES (?, ?, ?, ?, ?)').run(
      id, thread, status, new Date(now - completedMsAgo - 60000).toISOString(),
      status === 'running' ? null : new Date(now - completedMsAgo).toISOString());
  };
  const addMessage = (runId, role, text, { streaming = 0, at = Date.now() } = {}) =>
    db.prepare('INSERT INTO orchestration_v2_projection_messages VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      `m-${Math.random()}`, 'th-1', runId, role, streaming, new Date(at).toISOString(), JSON.stringify({ text }));
  const cleanup = () => { src.stop(); db.close(); fs.rmSync(dir, { recursive: true, force: true }); };
  return { src, addThread, addRun, addMessage, cleanup };
}

test('the polling source implements StatusSource', () => {
  const { src, cleanup } = setup();
  try { assert.ok(src instanceof StatusSource); } finally { cleanup(); }
});

test('onActivityChange fires on change only, and the returned function unsubscribes', () => {
  const { src, addRun, cleanup } = setup();
  try {
    const seen = [];
    const off = src.onActivityChange((s) => seen.push(s.state));
    src.start();
    src.tick();
    src.tick();
    assert.deepEqual(seen, ['idle']);
    addRun('r1', 'running', 5000);
    src.tick();
    assert.deepEqual(seen, ['idle', 'working']);
    off();
    addRun('r2', 'failed', 1000);
    src.tick();
    assert.deepEqual(seen, ['idle', 'working']);
  } finally { cleanup(); }
});

test('start-up reports runs inside the 24 hour window, oldest first, and skips older ones', () => {
  const { src, addRun, cleanup } = setup();
  try {
    addRun('too-old', 'completed', 25 * HOUR);
    addRun('earlier', 'completed', 3 * HOUR);
    addRun('later', 'failed', 1 * HOUR);
    const ids = [];
    src.onRunCompleted((r) => ids.push(r.runId));
    src.start();
    assert.deepEqual(ids, ['earlier', 'later']);
  } finally { cleanup(); }
});

test('each run is reported once, with its fields and answer snippet', () => {
  const { src, addRun, addMessage, cleanup } = setup();
  try {
    const runs = [];
    src.onRunCompleted((r) => runs.push(r));
    src.start();
    assert.deepEqual(runs, []);
    addRun('new', 'completed', 500);
    addMessage('new', 'user', 'please fix it');
    addMessage('new', 'assistant', 'Looking at the code first.', { at: Date.now() - 4000 });
    addMessage('new', 'assistant', '## Done\n\nFixed the **redirect** in `auth.js`.', { at: Date.now() - 1000 });
    addMessage('new', 'assistant', 'still streaming', { streaming: 1, at: Date.now() });
    src.tick();
    src.tick();
    assert.equal(runs.length, 1);
    const r = runs[0];
    assert.equal(r.runId, 'new');
    assert.equal(r.threadId, 'th-1');
    assert.equal(r.title, 'Fix login redirect');
    assert.equal(r.status, 'completed');
    assert.ok(Math.abs(r.completedAt - (Date.now() - 500)) < 5000);
    assert.equal(r.snippet, 'Done Fixed the redirect in auth.js.');
  } finally { cleanup(); }
});

test('a failed run reports status failed, and a run with no answer has an empty snippet', () => {
  const { src, addRun, cleanup } = setup();
  try {
    const runs = [];
    src.onRunCompleted((r) => runs.push(r));
    src.start();
    addRun('bad', 'failed', 300);
    src.tick();
    assert.equal(runs[0].status, 'failed');
    assert.equal(runs[0].snippet, '');
  } finally { cleanup(); }
});

test('runs on archived or deleted threads are skipped', () => {
  const { src, addThread, addRun, cleanup } = setup();
  try {
    addThread('th-arch', 'Archived', { archived: new Date().toISOString() });
    addThread('th-del', 'Deleted', { deleted: new Date().toISOString() });
    addRun('a', 'completed', HOUR, 'th-arch');
    addRun('d', 'completed', HOUR, 'th-del');
    addRun('missing', 'completed', HOUR, 'th-none');
    addRun('ok', 'completed', HOUR);
    const ids = [];
    src.onRunCompleted((r) => ids.push(r.runId));
    src.start();
    assert.deepEqual(ids, ['ok']);
  } finally { cleanup(); }
});

test('a missing database is demo mode with a null activity', () => {
  const src = createStatusSource({ dbPath: path.join(os.tmpdir(), 'does-not-exist.sqlite'), log: () => {} });
  const modes = [];
  const acts = [];
  src.onModeChange((m) => modes.push(m));
  src.onActivityChange((s) => acts.push(s));
  try {
    src.start();
    assert.deepEqual(modes, ['demo']);
    assert.deepEqual(acts, [null]);
    assert.equal(src.mode, 'demo');
  } finally { src.stop(); }
});

test('makeSnippet strips markdown, joins lines and truncates', () => {
  assert.equal(makeSnippet('- one\n- two\n\n[link](http://x.test) and `code`'), 'one two link and code');
  assert.equal(makeSnippet('before\n```js\nlet a = 1;\n```\nafter'), 'before after');
  assert.equal(makeSnippet(null), '');
  const long = makeSnippet('word '.repeat(100), 40);
  assert.equal(long.length, 40);
  assert.ok(long.endsWith('…'));
});
