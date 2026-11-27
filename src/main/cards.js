// Completed-thread cards: one per thread (its latest finished turn), newest first, and which are
// read or dismissed.
// Read and dismissed marks are saved in cards.json in Electron's userData folder (never under
// ~/.t3), so a restart does not bring dismissed cards back: at start-up the status source reports
// the last 24 hours of runs again. Marks older than that are dropped when the file is written.
// See docs/cards.md for the rules.
'use strict';
const fs = require('node:fs');

const CAP = 20; // cards held; the oldest drop off when a new one arrives
const KEEP_MS = 25 * 60 * 60 * 1000; // a little over the 24 hours the status source replays
const MAX_MARKS = 1000;
const MAX_BYTES = 256 * 1024;
const RUN_ID = /^[\w.:-]{1,200}$/;

const isId = (v) => typeof v === 'string' && RUN_ID.test(v);
const isTime = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;

// marks: { [runId]: completedAt } for each kind. Anything odd in the file is skipped.
function readMarks(file) {
  const empty = { read: new Map(), dismissed: new Map() };
  try {
    if (fs.statSync(file).size > MAX_BYTES) return empty;
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const kind of ['read', 'dismissed']) {
      const obj = raw && typeof raw[kind] === 'object' && raw[kind] ? raw[kind] : {};
      for (const [id, at] of Object.entries(obj)) if (isId(id) && isTime(at)) empty[kind].set(id, at);
    }
  } catch { /* missing or corrupt: start clean */ }
  return empty;
}

function writeMarks(file, marks, now) {
  const out = {};
  for (const kind of ['read', 'dismissed']) {
    const recent = [...marks[kind]].filter(([, at]) => now - at <= KEEP_MS)
      .sort((a, b) => b[1] - a[1]).slice(0, MAX_MARKS);
    marks[kind] = new Map(recent);
    out[kind] = Object.fromEntries(recent);
  }
  try {
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(out));
    fs.renameSync(tmp, file);
    return true;
  } catch {
    return false;
  }
}

// file: where marks are saved (null keeps them in memory, for tests). now: clock, for tests.
function createCardStore({ file = null, cap = CAP, now = Date.now } = {}) {
  const marks = file ? readMarks(file) : { read: new Map(), dismissed: new Map() };
  let cards = []; // { runId, threadId, title, status, completedAt, snippet }, newest first
  // One card per thread: the latest finished turn. latest remembers the newest turn seen for each
  // thread, dismissed ones included, so an older turn arriving later never comes back.
  const latest = new Map(); // thread key -> completedAt
  const keyOf = (run) => (typeof run.threadId === 'string' && run.threadId ? run.threadId : `run:${run.runId}`);

  const save = () => (file ? writeMarks(file, marks, now()) : true);

  return {
    // A finished run from the status source. A newer turn on a thread replaces that thread's card
    // (and is unread again, even if the older card was read or dismissed). Returns true if the
    // list changed.
    add(run) {
      if (!run || !isId(run.runId) || !isTime(run.completedAt)) return false;
      if (cards.some((c) => c.runId === run.runId)) return false;
      const key = keyOf(run);
      const seen = latest.get(key);
      if (seen !== undefined && run.completedAt <= seen) return false; // an older turn
      latest.set(key, run.completedAt);
      const before = cards.length;
      cards = cards.filter((c) => keyOf(c) !== key);
      const replaced = cards.length !== before;
      if (marks.dismissed.has(run.runId)) return replaced;
      const card = {
        runId: run.runId,
        threadId: run.threadId,
        title: String(run.title || 'Untitled thread'),
        status: run.status === 'failed' ? 'failed' : 'completed',
        completedAt: run.completedAt,
        snippet: String(run.snippet || ''),
      };
      cards = [...cards, card].sort((a, b) => b.completedAt - a.completedAt).slice(0, cap);
      return cards.includes(card) || replaced;
    },

    get(runId) { return cards.find((c) => c.runId === runId) || null; },

    markRead(runId) {
      const c = this.get(runId);
      if (!c || marks.read.has(runId)) return false;
      marks.read.set(runId, c.completedAt);
      save();
      return true;
    },

    markAllRead() {
      let changed = false;
      for (const c of cards) if (!marks.read.has(c.runId)) { marks.read.set(c.runId, c.completedAt); changed = true; }
      if (changed) save();
      return changed;
    },

    dismiss(runId) {
      const c = this.get(runId);
      if (!c) return false;
      cards = cards.filter((x) => x !== c);
      marks.dismissed.set(runId, c.completedAt);
      save();
      return true;
    },

    unread() { return cards.filter((c) => !marks.read.has(c.runId)).length; },

    // What the renderer gets: no thread ids (opening goes back through the main process).
    view() {
      return cards.map((c) => ({
        id: c.runId, title: c.title, status: c.status, completedAt: c.completedAt,
        snippet: c.snippet, read: marks.read.has(c.runId),
      }));
    },
  };
}

module.exports = { CAP, KEEP_MS, createCardStore, readMarks };
