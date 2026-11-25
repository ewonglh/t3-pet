// The only entry point the rest of the app should import from src/status/.
// To try another data source, change what this returns.
'use strict';
const { PollingStatusSource } = require('./t3-status');

function createStatusSource(options) {
  return new PollingStatusSource(options);
}

module.exports = { createStatusSource };
