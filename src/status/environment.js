// Reads this machine's T3 Code environment id: a one-line text file in T3's user data folder.
// Reads that single file only. Nothing else in the folder is opened, listed or logged (the
// folder also holds secrets).
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function environmentIdPath() {
  return process.env.T3_ENVIRONMENT_ID_FILE || path.join(os.homedir(), '.t3', 'userdata', 'environment-id');
}

// Returns the id, or null when the file is missing, unreadable or empty.
function readEnvironmentId(file = environmentIdPath()) {
  try {
    const first = fs.readFileSync(file, 'utf8').split(/\r?\n/, 1)[0].trim();
    return first || null;
  } catch {
    return null;
  }
}

module.exports = { readEnvironmentId, environmentIdPath };
