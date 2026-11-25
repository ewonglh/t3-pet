// Petdex / Codex spritesheet layout: 8 columns of 192x208 px frames, one row per state. Nine rows
// is the standard sheet; eleven is the v2 sheet (two extra rows). Pure functions, shared by the
// main process (validation) and the renderer (frame counting), and tested under node.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.T3SheetGrid = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const FRAME_W = 192;
  const FRAME_H = 208;
  const COLS = 8;
  const STANDARD_ROWS = 9;
  const V2_ROWS = 11;
  const SHEET_W = FRAME_W * COLS;

  // Row order of the standard sheet.
  const ROW_NAMES = ['idle', 'running-right', 'running-left', 'waving', 'jumping', 'failed', 'waiting', 'running', 'review'];

  // Number of rows for a sheet of this pixel size, or 0 if it is not a supported sheet.
  function rowsForSize(width, height) {
    if (width !== SHEET_W) return 0;
    if (height === FRAME_H * STANDARD_ROWS) return STANDARD_ROWS;
    if (height === FRAME_H * V2_ROWS) return V2_ROWS;
    return 0;
  }

  // Frames actually drawn on each row, plus the box around the painted pixels of the idle row
  // (frame px, inclusive: left, right, top, bottom). Sheets pad short animations with empty
  // frames, so a row's length is the position of its last non-empty frame plus one. The idle box
  // tells the renderer where the pet's feet, head and sides are. rgba is the whole sheet as RGBA.
  function scanSheet(rgba, width, height, rows, alphaMin = 8) {
    const framesPerRow = [];
    const box = { left: FRAME_W, right: -1, top: FRAME_H, bottom: -1 };
    for (let r = 0; r < rows; r++) {
      let last = -1;
      for (let c = 0; c < COLS; c++) {
        const x0 = c * FRAME_W, y0 = r * FRAME_H;
        let painted = false;
        for (let y = 0; y < FRAME_H; y++) {
          let i = ((y0 + y) * width + x0) * 4 + 3;
          for (let x = 0; x < FRAME_W; x++, i += 4) {
            if (rgba[i] > alphaMin) {
              painted = true;
              if (r === 0) {
                if (x < box.left) box.left = x;
                if (x > box.right) box.right = x;
                if (y < box.top) box.top = y;
                if (y > box.bottom) box.bottom = y;
              } else {
                break; // other rows only need to know the frame is not empty
              }
            }
          }
          if (painted && r !== 0) break;
        }
        if (painted) last = c;
      }
      framesPerRow.push(last + 1);
    }
    // An empty idle row: assume the whole frame, feet on the bottom edge.
    const idleBox = box.right < 0 ? { left: 0, right: FRAME_W - 1, top: 0, bottom: FRAME_H - 1 } : box;
    return { framesPerRow, idleBox };
  }

  return { FRAME_W, FRAME_H, COLS, STANDARD_ROWS, V2_ROWS, ROW_NAMES, rowsForSize, scanSheet };
});
