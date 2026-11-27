'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { nextState, view, place, contains } = require('../src/shared/overlay-shell');

test('state: hover shows the pill, the bell expands and collapses, leaving hides it', () => {
  assert.equal(nextState('idle', 'enter'), 'hovered');
  assert.equal(nextState('hovered', 'enter'), 'hovered');
  assert.equal(nextState('expanded', 'enter'), 'expanded');
  assert.equal(nextState('hovered', 'toggle'), 'expanded');
  assert.equal(nextState('expanded', 'toggle'), 'hovered');
  assert.equal(nextState('idle', 'toggle'), 'idle');
  assert.equal(nextState('expanded', 'leave'), 'idle');
  assert.equal(nextState('hovered', 'hide'), 'idle');
  assert.equal(nextState('hovered', 'nonsense'), 'hovered');
});

test('state: with the pill up at rest, hovering opens the stack', () => {
  assert.equal(nextState('idle', 'enter', { peek: true }), 'expanded');
  assert.equal(nextState('expanded', 'toggle', { peek: true }), 'hovered'); // the bell still folds it
  assert.equal(nextState('expanded', 'leave', { peek: true }), 'idle');
});

test('view: the pill shows at rest only when something is running or unread', () => {
  assert.equal(view('idle'), 'none');
  assert.equal(view('idle', { peek: true }), 'pill');
  assert.equal(view('idle', { peek: true, drag: true }), 'none');
  assert.equal(view('hovered', { peek: true }), 'pill');
  assert.equal(view('expanded'), 'deck');
});

const screen = { w: 1920, h: 1040 };

test('place: on the floor the shell goes above the pet, centred on it', () => {
  const box = { l: 900, r: 960, t: 920, b: 1030 };
  const p = place({ box, ...screen, width: 120, height: 38, reserve: 200 });
  assert.equal(p.side, 'above');
  assert.equal(p.left, 870);
  assert.equal(p.top, 920 - 8 - 38);
});

test('place: with room below it goes under the pet', () => {
  const box = { l: 900, r: 960, t: 200, b: 300 };
  const p = place({ box, ...screen, width: 120, height: 38, reserve: 200 });
  assert.equal(p.side, 'below');
  assert.equal(p.top, 308);
});

test('place: the side is chosen on the expanded height, so expanding does not flip it', () => {
  const box = { l: 900, r: 960, t: 700, b: 900 }; // room for the pill (38) below, not for 200
  const hovered = place({ box, ...screen, width: 120, height: 38, reserve: 200 });
  const expanded = place({ box, ...screen, width: 384, height: 200, reserve: 200 });
  assert.equal(hovered.side, 'above');
  assert.equal(expanded.side, 'above');
});

test('place: stays on screen at the edges', () => {
  const left = place({ box: { l: 0, r: 40, t: 920, b: 1030 }, ...screen, width: 384, height: 200 });
  assert.equal(left.left, 8);
  const right = place({ box: { l: 1880, r: 1920, t: 920, b: 1030 }, ...screen, width: 384, height: 200 });
  assert.equal(right.left, 1920 - 384 - 8);
  const top = place({ box: { l: 900, r: 960, t: 0, b: 100 }, w: 1920, h: 250, width: 384, height: 200 });
  assert.ok(top.top >= 8);
});

test('contains: rect hit test with padding', () => {
  const r = { left: 10, top: 10, right: 50, bottom: 30 };
  assert.ok(contains(r, 10, 10));
  assert.ok(!contains(r, 9, 10));
  assert.ok(contains(r, 6, 10, 4));
  assert.ok(!contains(null, 0, 0));
});
