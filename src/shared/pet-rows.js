// Which sheet row a pet animation plays. One table (ROW_FOR), documented in docs/animations.md.
// To change what an animation looks like, change one line of ROW_FOR.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.T3PetRows = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // The nine rows of a Petdex/Codex sheet, in order. Sheets with 11 rows have two more that the
  // contract does not describe; they are never picked here.
  const ROW = { idle: 0, 'running-right': 1, 'running-left': 2, waving: 3, jumping: 4, failed: 5, waiting: 6, running: 7, review: 8 };

  // Animation name (from PetController.pickAnim) -> row name. 'walk' and 'run' are directional:
  // ROW_FOR holds the right-facing row and rowFor() swaps in the left one.
  const ROW_FOR = {
    idle: 'idle',
    sleep: 'idle',
    land: 'idle',
    working: 'running',        // active task work, thinking; not literal running
    waiting: 'waiting',        // needs approval, help or input
    error: 'failed',
    done: 'waving',            // the contract has no "done" row; 'review' is the alternative
    petted: 'waving',
    wake: 'waving',
    walk: 'running-right',     // following the cursor; left variant chosen by facing
    run: 'running-right',
    picked: 'jumping',         // dragged: vertical motion
    fall: 'jumping',
    hurt: 'failed',            // optional dedicated animation later, see docs/animations.md
    dizzy: 'failed',
    ouch: 'failed',
  };

  // anim: name from PetController.pickAnim; ctx.facing is -1, 0 or 1 (direction of travel).
  // Unknown names play idle.
  function rowFor(anim, ctx = {}) {
    let name = ROW_FOR[anim] || 'idle';
    if (name === 'running-right' && ctx.facing < 0) name = 'running-left';
    return ROW[name];
  }

  return { ROW, ROW_FOR, rowFor };
});
