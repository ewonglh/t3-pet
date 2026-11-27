'use strict';
// Builds a throwaway in-memory database with just the columns the queries use, so no real T3
// data is read.
const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { computeStatus } = require('../src/status/queries');

const NOW = Date.parse('2026-11-25T10:00:00Z');
const iso = (msAgo) => new Date(NOW - msAgo).toISOString();

function makeDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE orchestration_v2_projection_threads (thread_id TEXT, title TEXT, archived_at TEXT, deleted_at TEXT);
    CREATE TABLE orchestration_v2_projection_runs (run_id TEXT, thread_id TEXT, status TEXT, requested_at TEXT, completed_at TEXT);
    CREATE TABLE orchestration_v2_projection_runtime_requests (thread_id TEXT, created_at TEXT, status TEXT);
  `);
  db.prepare('INSERT INTO orchestration_v2_projection_threads (thread_id, title) VALUES (?, ?)').run('th-1', 'Fix login redirect');
  return db;
}
const run = (db, id, status, requestedAgo, completedAgo) =>
  db.prepare('INSERT INTO orchestration_v2_projection_runs VALUES (?, ?, ?, ?, ?)')
    .run(id, 'th-1', status, iso(requestedAgo), completedAgo == null ? null : iso(completedAgo));

test('idle has no thread id', () => {
  const s = computeStatus(makeDb(), NOW);
  assert.equal(s.state, 'idle');
  assert.equal(s.threadId, undefined);
});

test('working carries the thread id', () => {
  const db = makeDb();
  run(db, 'r1', 'running', 5000, null);
  const s = computeStatus(db, NOW);
  assert.equal(s.state, 'working');
  assert.equal(s.threadId, 'th-1');
  assert.equal(s.title, 'Fix login redirect');
});

test('a run that just completed is done, with its thread id', () => {
  const db = makeDb();
  run(db, 'r1', 'completed', 60000, 2000);
  const s = computeStatus(db, NOW);
  assert.equal(s.state, 'done');
  assert.equal(s.threadId, 'th-1');
});

test('a run that just failed is an error, with its thread id', () => {
  const db = makeDb();
  run(db, 'r1', 'failed', 60000, 1000);
  const s = computeStatus(db, NOW);
  assert.equal(s.state, 'error');
  assert.equal(s.threadId, 'th-1');
});

test('waiting needs a pending request on a thread with a running run', () => {
  const db = makeDb();
  run(db, 'r1', 'running', 5000, null);
  db.prepare('INSERT INTO orchestration_v2_projection_runtime_requests VALUES (?, ?, ?)').run('th-1', iso(1000), 'pending');
  const s = computeStatus(db, NOW);
  assert.equal(s.state, 'waiting');
  assert.equal(s.threadId, 'th-1');
});

test('an old completed run is idle again', () => {
  const db = makeDb();
  run(db, 'r1', 'completed', 600000, 300000);
  assert.equal(computeStatus(db, NOW).state, 'idle');
});

test('live: the running thread, kept while a finished run flashes done', () => {
  const db = makeDb();
  db.prepare('INSERT INTO orchestration_v2_projection_threads (thread_id, title) VALUES (?, ?)').run('th-2', 'Write docs');
  run(db, 'r1', 'completed', 60000, 2000); // th-1 just finished: the pet shows done
  db.prepare('INSERT INTO orchestration_v2_projection_runs VALUES (?, ?, ?, ?, ?)').run('r2', 'th-2', 'running', iso(5000), null);
  const s = computeStatus(db, NOW);
  assert.equal(s.state, 'done');
  assert.deepEqual(s.live, { state: 'working', title: 'Write docs', threadId: 'th-2', more: 0 });
});

test('live: waiting comes first, and other active threads are counted once each', () => {
  const db = makeDb();
  db.prepare('INSERT INTO orchestration_v2_projection_threads (thread_id, title) VALUES (?, ?)').run('th-2', 'Write docs');
  run(db, 'r1', 'running', 9000, null);
  db.prepare('INSERT INTO orchestration_v2_projection_runs VALUES (?, ?, ?, ?, ?)').run('r2', 'th-2', 'running', iso(5000), null);
  db.prepare('INSERT INTO orchestration_v2_projection_runtime_requests VALUES (?, ?, ?)').run('th-1', iso(1000), 'pending');
  const s = computeStatus(db, NOW);
  assert.deepEqual(s.live, { state: 'waiting', title: 'Fix login redirect', threadId: 'th-1', more: 1 });
  assert.equal(computeStatus(makeDb(), NOW).live, null);
});
