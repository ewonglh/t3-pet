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

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't3pet-src-'));
  const file = path.join(dir, 'state.sqlite');
  const db = new DatabaseSync(file);
  db.exec(`
    CREATE TABLE orchestration_v2_projection_threads (thread_id TEXT, title TEXT, archived_at TEXT, deleted_at TEXT);
    CREATE TABLE orchestration_v2_projection_runs (run_id TEXT, thread_id TEXT, status TEXT, requested_at TEXT, completed_at TEXT);
    CREATE TABLE orchestration_v2_projection_runtime_requests (thread_id TEXT, created_at TEXT, status TEXT);
  `);
  db.prepare('INSERT INTO orchestration_v2_projection_threads (thread_id, title) VALUES (?, ?)').run('th-1', 'Fix login redirect');
  const src = createStatusSource({ dbPath: file, log: () => {} });
  // Force the in-process reader even if the environment asks for the child one.
  const addRun = (id, status, completedMsAgo) => {
    const now = Date.now();
    db.prepare('INSERT INTO orchestration_v2_projection_runs VALUES (?, ?, ?, ?, ?)').run(
      id, 'th-1', status, new Date(now - 60000).toISOString(),
      completedMsAgo == null ? null : new Date(now - completedMsAgo).toISOString());
  };
  const cleanup = () => { src.stop(); db.close(); fs.rmSync(dir, { recursive: true, force: true }); };
  return { src, addRun, cleanup };
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
    addRun('r1', 'running', null);
    src.tick();
    assert.deepEqual(seen, ['idle', 'working']);
    off();
    addRun('r2', 'failed', 1000);
    src.tick();
    assert.deepEqual(seen, ['idle', 'working']);
  } finally { cleanup(); }
});

test('onRunCompleted skips runs from before start and reports new ones once', () => {
  const { src, addRun, cleanup } = setup();
  try {
    addRun('old', 'completed', 600000);
    const runs = [];
    src.onRunCompleted((r) => runs.push(r));
    src.start();
    assert.deepEqual(runs, []);
    addRun('new', 'completed', 500);
    src.tick();
    src.tick();
    assert.equal(runs.length, 1);
    assert.equal(runs[0].runId, 'new');
    assert.equal(runs[0].threadId, 'th-1');
    assert.equal(runs[0].title, 'Fix login redirect');
    assert.equal(runs[0].outcome, 'completed');
  } finally { cleanup(); }
});

test('a failed run reports outcome failed', () => {
  const { src, addRun, cleanup } = setup();
  try {
    const runs = [];
    src.onRunCompleted((r) => runs.push(r));
    src.start();
    addRun('bad', 'failed', 300);
    src.tick();
    assert.equal(runs[0].outcome, 'failed');
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
