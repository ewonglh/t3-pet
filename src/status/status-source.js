// The one interface the rest of the app uses to learn what T3 Code is doing. Nothing outside
// src/status/ should know where the data comes from (SQLite polling today, maybe a WebSocket
// later), so a change in T3's storage or API is a one-file fix.
//
// A source emits three kinds of event. Each `on...` method returns a function that removes the
// handler.
//
//   onActivityChange(handler)  handler(status | null)
//     The current activity: { state: 'idle' | 'working' | 'waiting' | 'done' | 'error', title,
//     count, key, threadId, live }. Called when it changes, not on every poll. null means there is
//     no data (T3 not installed, or its database unreadable); see onModeChange.
//     live is the thread for the live card, or null: { state: 'working' | 'waiting', title,
//     threadId, more }, where more counts the other running or waiting threads. It ignores the
//     done and error flashes, so it still names a running thread while the pet shows "done".
//
//   onRunCompleted(handler)    handler({ runId, threadId, title, status, completedAt, snippet })
//     Called once per finished run, oldest first. status is 'completed' or 'failed'; completedAt
//     is epoch milliseconds; snippet is one plain-text line of the run's last answer ('' if none).
//     At start-up it also reports runs finished in the last 24 hours (while the pet was closed).
//     Runs on archived or deleted threads are skipped.
//
//   onModeChange(handler)      handler('starting' | 'live' | 'demo' | 'error')
//     live = reading T3 normally, demo = no T3 data found, error = data found but unreadable.
//
// Also: start(), stop(), and the read-only properties `mode` and `latestTitle`.
'use strict';
const { EventEmitter } = require('node:events');

class StatusSource extends EventEmitter {
  constructor() {
    super();
    this.mode = 'starting';
    this.latestTitle = '';
  }

  start() { throw new Error('StatusSource.start() not implemented'); }
  stop() { throw new Error('StatusSource.stop() not implemented'); }

  onActivityChange(handler) { return this.subscribe('activity', handler); }
  onRunCompleted(handler) { return this.subscribe('run-completed', handler); }
  onModeChange(handler) { return this.subscribe('mode', handler); }

  subscribe(event, handler) {
    this.on(event, handler);
    return () => this.off(event, handler);
  }
}

module.exports = { StatusSource };
