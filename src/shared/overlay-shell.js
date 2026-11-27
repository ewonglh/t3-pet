// The pill and card stack that hang off the pet: which state they are in, and where they go.
// States: idle (pet alone, or just the front card at rest), hovered (pill), expanded (pill plus
// stack). The shell sits under the pet when there is room and above it otherwise (with gravity on,
// the pet stands on the bottom edge, so that means above). The side is decided on the expanded
// height, so expanding never makes it jump to the other side.
//
// The front card sits next to the pet; the peeking cards and the pill grow away from it. So when
// something is running or unread ("peek"), the front card shows at rest and hovering adds the rest
// around it without moving it.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.T3OverlayShell = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STATES = ['idle', 'hovered', 'expanded'];
  const GAP = 8; // between the pet and the pill
  const MARGIN = 8; // from the screen edges
  const LEAVE_MS = 350; // grace period, so the pointer can cross the gap between pet and pill

  // event: 'enter' (pointer over the pet or the shell), 'leave' (grace period over),
  // 'toggle' (bell or chevron clicked), 'hide' (drag started, or anything that dismisses it).
  // peek: a card is showing at rest, so hovering opens the whole stack around it.
  function nextState(state, event, { peek = false } = {}) {
    switch (event) {
      case 'enter': return state === 'idle' ? (peek ? 'expanded' : 'hovered') : state;
      case 'toggle': return state === 'hovered' ? 'expanded' : state === 'expanded' ? 'hovered' : state;
      case 'leave':
      case 'hide': return 'idle';
      default: return state;
    }
  }

  // What to draw: 'none' (pet alone), 'rest' (front card only), 'pill', or 'deck' (everything).
  // Nothing hangs off the pet while it is being carried.
  function view(state, { peek = false, drag = false } = {}) {
    if (state === 'expanded') return 'deck';
    if (state === 'hovered') return 'pill';
    return peek && !drag ? 'rest' : 'none';
  }

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  // box: the pet's hit box { l, r, t, b } in window pixels. w, h: window size.
  // width, height: the shell's current size. reserve: its height when expanded.
  // Returns { side: 'below' | 'above', left, top }.
  function place({ box, w, h, width, height, reserve = height, gap = GAP, margin = MARGIN }) {
    const below = box.b + gap + Math.max(reserve, height) + margin <= h;
    const cx = (box.l + box.r) / 2;
    const left = clamp(cx - width / 2, margin, Math.max(margin, w - width - margin));
    const top = below ? box.b + gap : box.t - gap - height;
    return { side: below ? 'below' : 'above', left, top: clamp(top, margin, Math.max(margin, h - height - margin)) };
  }

  function contains(rect, x, y, pad = 0) {
    return !!rect && x >= rect.left - pad && x <= rect.right + pad && y >= rect.top - pad && y <= rect.bottom + pad;
  }

  return { STATES, GAP, MARGIN, LEAVE_MS, nextState, view, place, contains };
});
