// The pet's own settings file in Electron's userData folder (never under ~/.t3). Tolerant on read:
// a missing, corrupt or odd file gives the defaults. Written atomically.
'use strict';
const fs = require('node:fs');
const { PET_KEY } = require('./pets');

const DEFAULTS = { pet: null }; // pet: folder name of the chosen pet, or null for the built-in mascot
const MAX_BYTES = 16 * 1024;

function readSettings(file) {
  try {
    if (fs.statSync(file).size > MAX_BYTES) return { ...DEFAULTS };
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    const pet = raw && typeof raw.pet === 'string' && PET_KEY.test(raw.pet) ? raw.pet : null;
    return { pet };
  } catch {
    return { ...DEFAULTS };
  }
}

// Returns true when saved. A failure is not fatal: the choice then lasts for this run only.
function writeSettings(file, settings) {
  try {
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ pet: settings.pet || null }, null, 2));
    fs.renameSync(tmp, file);
    return true;
  } catch {
    return false;
  }
}

module.exports = { DEFAULTS, readSettings, writeSettings };
