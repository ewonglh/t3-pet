// Playback timing for Petdex/Codex sheet pets. The contract does not say how fast to play a row,
// so a pet may add an optional `fps` to pet.json (a t3-pet extension; other apps ignore it):
//   "fps": 12                         every row at 12 frames per second
//   "fps": { "running": 12, "idle": 6 }   named rows; the rest use the default
// How long a one-shot animation lasts is never configured: it is the length of the pet's own row.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.T3SheetTiming = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DEFAULT_FPS = 8;
  const MIN_FPS = 1;
  const MAX_FPS = 60;

  const valid = (n) => typeof n === 'number' && Number.isFinite(n) && n >= MIN_FPS && n <= MAX_FPS;

  // raw: the `fps` value from pet.json (any type). rowNames: row names in sheet order.
  // Returns { fps, warnings } where fps has one number per row of the sheet (rowCount long).
  function rowFps(raw, rowNames, rowCount = rowNames.length) {
    const out = new Array(rowCount).fill(DEFAULT_FPS);
    const warnings = [];
    if (raw === undefined || raw === null) return { fps: out, warnings };
    if (typeof raw === 'number') {
      if (valid(raw)) out.fill(raw);
      else warnings.push(`fps ${raw} is outside ${MIN_FPS} to ${MAX_FPS}; using ${DEFAULT_FPS}`);
      return { fps: out, warnings };
    }
    if (typeof raw === 'object' && !Array.isArray(raw)) {
      for (const [name, v] of Object.entries(raw)) {
        const i = rowNames.indexOf(name);
        if (i < 0 || i >= rowCount) warnings.push(`fps names an unknown row "${name}"`);
        else if (valid(v)) out[i] = v;
        else warnings.push(`fps for "${name}" is not a number from ${MIN_FPS} to ${MAX_FPS}; using ${DEFAULT_FPS}`);
      }
      return { fps: out, warnings };
    }
    warnings.push(`fps must be a number or an object of row name to number; using ${DEFAULT_FPS}`);
    return { fps: out, warnings };
  }

  // Seconds to play every frame of a row once.
  function oneShotSeconds(frames, fps) {
    return Math.max(1, frames) / (valid(fps) ? fps : DEFAULT_FPS);
  }

  return { DEFAULT_FPS, MIN_FPS, MAX_FPS, rowFps, oneShotSeconds };
});
