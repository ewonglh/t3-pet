// Builds the link that opens one thread in the T3 Code desktop app:
//   t3code://threads/<environmentId>/<threadId>        (t3code-dev:// for dev builds)
// Never build https:// links here: those open a browser landing page instead of the app.
// This file knows nothing about T3's storage; callers pass the ids in.
'use strict';

const SCHEMES = new Set(['t3code', 't3code-dev']);

// Ids are opaque strings. Reject empty, huge or control-character values; everything else is
// percent-encoded below, so odd characters cannot change the shape of the link.
function isUsableId(v) {
  return typeof v === 'string' && v.length > 0 && v.length <= 256 && !/[\u0000-\u001f\u007f]/.test(v);
}

function buildThreadLink({ scheme = 't3code', environmentId, threadId } = {}) {
  if (!SCHEMES.has(scheme) || !isUsableId(environmentId) || !isUsableId(threadId)) return null;
  return `${scheme}://threads/${encodeURIComponent(environmentId)}/${encodeURIComponent(threadId)}`;
}

module.exports = { buildThreadLink, isUsableId };
