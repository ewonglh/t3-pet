// A loaded Petdex spritesheet: decodes the image once, counts the frames each row really has,
// and draws single frames. The main process has already validated the file and its size.
(function () {
  'use strict';
  const G = window.T3SheetGrid;

  class Sheet {
    constructor(image, rows, name) {
      this.image = image;
      this.rows = rows;
      this.name = name;
      const c = document.createElement('canvas');
      c.width = image.naturalWidth; c.height = image.naturalHeight;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(image, 0, 0);
      const scan = G.scanSheet(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height, rows);
      this.framesPerRow = scan.framesPerRow;
      this.box = scan.idleBox; // painted area of the idle row, in frame px
    }

    // Number of frames on a row (at least 1, so an empty row still shows something).
    frames(row) { return Math.max(1, this.framesPerRow[row] || 1); }

    // An empty row (a pet that leaves a state out) falls back to the idle row.
    usableRow(row) { return this.framesPerRow[row] > 0 ? row : 0; }

    draw(ctx, row, col) {
      ctx.clearRect(0, 0, G.FRAME_W, G.FRAME_H);
      ctx.drawImage(this.image, col * G.FRAME_W, row * G.FRAME_H, G.FRAME_W, G.FRAME_H, 0, 0, G.FRAME_W, G.FRAME_H);
    }
  }

  // info: { name, rows, dataUrl } from the main process. Resolves to a Sheet, or null on any problem.
  function load(info) {
    return new Promise((resolve) => {
      if (!info || !info.dataUrl || !G.rowsForSize(G.FRAME_W * G.COLS, G.FRAME_H * info.rows)) return resolve(null);
      const img = new Image();
      img.onload = () => {
        if (G.rowsForSize(img.naturalWidth, img.naturalHeight) !== info.rows) return resolve(null);
        try { resolve(new Sheet(img, info.rows, info.name)); } catch { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = info.dataUrl;
    });
  }

  window.T3Sheet = { load };
})();
