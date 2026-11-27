'use strict';
// Uses made-up runs and a temp folder; never real T3 data.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createCardStore, KEEP_MS } = require('../src/main/cards');
const { relTime, depth, keepFront, wheelStepper, withLive } = require('../src/shared/card-view');

const H = 3600 * 1000;
const NOW = 1_800_000_000_000;
const run = (n, extra = {}) => ({ runId: `run-${n}`, threadId: `thread-${n}`, title: `Thread ${n}`, status: 'completed', completedAt: NOW - n * 60_000, snippet: `Answer ${n}`, ...extra });

test('cards: newest first, no duplicates, no thread ids in the view', () => {
  const s = createCardStore({ now: () => NOW });
  assert.equal(s.add(run(3)), true);
  assert.equal(s.add(run(1)), true);
  assert.equal(s.add(run(2, { status: 'failed' })), true);
  assert.equal(s.add(run(1)), false);
  const v = s.view();
  assert.deepEqual(v.map((c) => c.id), ['run-1', 'run-2', 'run-3']);
  assert.equal(v[1].status, 'failed');
  assert.ok(v.every((c) => !('threadId' in c)));
  assert.equal(s.get('run-2').threadId, 'thread-2');
});

test('cards: bad runs are ignored', () => {
  const s = createCardStore({ now: () => NOW });
  assert.equal(s.add(null), false);
  assert.equal(s.add(run(1, { runId: '../x y' })), false);
  assert.equal(s.add(run(1, { completedAt: 'soon' })), false);
  assert.equal(s.view().length, 0);
});

test('cards: cap keeps the newest; an older run arriving late does not push a newer one out', () => {
  const s = createCardStore({ cap: 3, now: () => NOW });
  for (const n of [5, 4, 3, 2]) s.add(run(n));
  assert.deepEqual(s.view().map((c) => c.id), ['run-2', 'run-3', 'run-4']);
  assert.equal(s.add(run(9)), false); // older than everything held
  assert.equal(s.add(run(1)), true);
  assert.deepEqual(s.view().map((c) => c.id), ['run-1', 'run-2', 'run-3']);
});

test('cards: read and unread count, mark all read, dismiss', () => {
  const s = createCardStore({ now: () => NOW });
  for (const n of [1, 2, 3]) s.add(run(n));
  assert.equal(s.unread(), 3);
  assert.equal(s.markRead('run-2'), true);
  assert.equal(s.markRead('run-2'), false);
  assert.equal(s.unread(), 2);
  assert.equal(s.view().find((c) => c.id === 'run-2').read, true);
  assert.equal(s.dismiss('run-1'), true);
  assert.equal(s.dismiss('run-1'), false);
  assert.equal(s.unread(), 1);
  assert.equal(s.markAllRead(), true);
  assert.equal(s.unread(), 0);
  assert.equal(s.markRead('nope'), false);
});

test('cards: marks survive a restart, so dismissed cards stay gone; old marks are dropped', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 't3pet-cards-'));
  const file = path.join(d, 'cards.json');
  try {
    let s = createCardStore({ file, now: () => NOW });
    for (const n of [1, 2, 3]) s.add(run(n));
    s.dismiss('run-1');
    s.markRead('run-2');
    // a restart: the status source replays the same runs
    s = createCardStore({ file, now: () => NOW });
    for (const n of [1, 2, 3]) s.add(run(n));
    assert.deepEqual(s.view().map((c) => [c.id, c.read]), [['run-2', true], ['run-3', false]]);
    // much later, the next write drops marks older than the replay window
    s = createCardStore({ file, now: () => NOW + KEEP_MS + H });
    s.add(run(0, { completedAt: NOW + KEEP_MS }));
    s.markRead('run-0');
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.deepEqual(Object.keys(saved.read), ['run-0']);
    assert.deepEqual(Object.keys(saved.dismissed), []);
    // a corrupt file just means no marks
    fs.writeFileSync(file, '{oops');
    s = createCardStore({ file, now: () => NOW });
    s.add(run(1));
    assert.equal(s.view().length, 1);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('cards: one card per thread, showing its latest turn', () => {
  const s = createCardStore({ now: () => NOW });
  const turn = (id, mins, extra = {}) => ({ runId: id, threadId: 'thread-a', title: 'Thread A', status: 'completed', completedAt: NOW - mins * 60_000, snippet: id, ...extra });
  s.add(run(50));
  assert.equal(s.add(turn('a1', 30)), true);
  assert.equal(s.add(turn('a2', 10)), true); // newer turn replaces the card
  assert.deepEqual(s.view().map((c) => c.id), ['a2', 'run-50']);
  assert.equal(s.add(turn('a0', 60)), false); // an older turn arriving late is ignored
  assert.deepEqual(s.view().map((c) => c.id), ['a2', 'run-50']);
  // a new turn after reading is unread again
  s.markRead('a2');
  assert.equal(s.unread(), 1);
  s.add(turn('a3', 1));
  assert.deepEqual(s.view().map((c) => [c.id, c.read]), [['a3', false], ['run-50', false]]);
  // a new turn after dismissing brings the thread back
  s.dismiss('a3');
  assert.equal(s.add(turn('a4', 0)), true);
  assert.equal(s.view()[0].id, 'a4');
});

test('cards: after a restart, a dismissed latest turn keeps older turns of that thread away', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 't3pet-cards-'));
  const file = path.join(d, 'cards.json');
  const turn = (id, mins) => ({ runId: id, threadId: 'thread-a', title: 'Thread A', status: 'completed', completedAt: NOW - mins * 60_000, snippet: '' });
  try {
    let s = createCardStore({ file, now: () => NOW });
    s.add(turn('a1', 30));
    s.add(turn('a2', 10));
    s.dismiss('a2');
    // restart: the status source replays oldest first
    s = createCardStore({ file, now: () => NOW });
    assert.equal(s.add(turn('a1', 30)), true);
    assert.equal(s.add(turn('a2', 10)), true); // dismissed, but it still removes the older card
    assert.deepEqual(s.view(), []);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('view: relative times', () => {
  assert.equal(relTime(NOW - 10_000, NOW), 'now');
  assert.equal(relTime(NOW + 60_000, NOW), 'now');
  assert.equal(relTime(NOW - 5 * 60_000, NOW), '5m');
  assert.equal(relTime(NOW - 3 * H, NOW), '3h');
  assert.equal(relTime(NOW - 50 * H, NOW), '2d');
});

test('view: deck depth and keeping the front card', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((i) => depth(i, 1)), ['passed', '0', '1', '2', '3', 'far']);
  assert.equal(keepFront(['a', 'b', 'c'], ['n', 'a', 'b', 'c'], 1), 2); // new card on top: b stays in front
  assert.equal(keepFront(['a', 'b', 'c'], ['a', 'c'], 1), 1); // b dismissed: c moves up
  assert.equal(keepFront(['a', 'b'], ['a'], 1), 0);
  assert.equal(keepFront([], [], 0), 0);
});

test('view: wheel steps one card per notch, adds up trackpad deltas, and paces a fling', () => {
  const step = wheelStepper({ threshold: 50, gap: 150, idle: 250 });
  assert.equal(step(100, 0, 0), 1); // mouse notch down: older card
  assert.equal(step(100, 0, 50), 0); // too soon after a step
  assert.equal(step(-100, 0, 400), -1); // notch up: back to newer
  assert.equal(step(0, 0, 410), 0); // sideways scroll does nothing

  const pad = wheelStepper({ threshold: 50, gap: 150, idle: 250 });
  assert.equal(pad(20, 0, 0), 0);
  assert.equal(pad(20, 0, 16), 0);
  assert.equal(pad(20, 0, 32), 1); // 60px adds up to one step
  assert.equal(pad(20, 0, 1000), 0); // a pause clears the partial scroll
  assert.equal(pad(-20, 0, 1016), 0); // a change of direction starts again
  assert.equal(pad(-40, 0, 1032), -1);

  const lines = wheelStepper();
  assert.equal(lines(3, 1, 0), 1); // line mode: 3 lines is 120px
});

test('view: the live card goes in front and hides the older card of its thread', () => {
  const list = [{ id: 'r1', thread: 't1' }, { id: 'r2', thread: 't2' }];
  assert.equal(withLive(list, null), list);
  const deck = withLive(list, { state: 'working', title: 'Fix it', more: 2, thread: 't2' });
  assert.deepEqual(deck.map((c) => c.id), ['live', 'r1']);
  assert.deepEqual(deck[0], { id: 'live', live: true, state: 'working', title: 'Fix it', more: 2, thread: 't2' });
  // a forced state has no thread: nothing is hidden
  assert.deepEqual(withLive(list, { state: 'waiting' }).map((c) => c.id), ['live', 'r1', 'r2']);
});
