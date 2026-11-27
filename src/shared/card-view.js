// Small display rules for the card stack: relative times and each card's place in the deck.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.T3CardView = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const BEHIND = 3; // cards drawn behind the front one (four layers in all)

  // "now", "5m", "3h", "2d". Times in the future (clock skew) read as "now".
  function relTime(at, now) {
    const s = Math.max(0, (now - at) / 1000);
    if (s < 60) return 'now';
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    if (s < 86400) return `${Math.floor(s / 3600)}h`;
    return `${Math.floor(s / 86400)}d`;
  }

  // i: card index (0 = newest). cur: the card at the front. Matches data-d in design/pet.css.
  function depth(i, cur) {
    const rel = i - cur;
    if (rel < 0) return 'passed';
    if (rel > BEHIND) return 'far';
    return String(rel);
  }

  // After the list changes, keep the same card at the front if it is still there; otherwise stay
  // at the same position, clamped to the list.
  function keepFront(oldIds, newIds, cur) {
    const id = oldIds[cur];
    const at = id === undefined ? -1 : newIds.indexOf(id);
    if (at >= 0) return at;
    return Math.max(0, Math.min(cur, newIds.length - 1));
  }

  return { BEHIND, relTime, depth, keepFront };
});
