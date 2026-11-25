// Which sheet row a pet animation plays. PROVISIONAL: a first mapping so any Petdex pet moves
// sensibly; issue #7 replaces it with the full activity and physics mapping.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.T3PetRows = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const ROW = { idle: 0, 'running-right': 1, 'running-left': 2, waving: 3, jumping: 4, failed: 5, waiting: 6, running: 7, review: 8 };

  // anim: the name from PetController.pickAnim; ctx.facing is -1, 0 or 1 (direction of travel).
  function rowFor(anim, ctx = {}) {
    switch (anim) {
      case 'walk':
      case 'run': return ctx.facing < 0 ? ROW['running-left'] : ROW['running-right'];
      case 'working': return ROW.running;
      case 'waiting': return ROW.waiting;
      case 'error': return ROW.failed;
      case 'done':
      case 'petted': return ROW.waving;
      case 'picked':
      case 'fall': return ROW.jumping;
      case 'hurt':
      case 'dizzy':
      case 'ouch': return ROW.failed;
      default: return ROW.idle; // idle, sleep, wake, land
    }
  }

  return { ROW, rowFor };
});
