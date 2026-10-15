'use strict';
// Drop-in for decode-uri-component@0.2.x without its super-linear fallback
// (GHSA-vcc3-ghjq-m6fr: a crafted link could freeze the app for minutes).
// Behaviour: decode what is valid, leave invalid %XX sequences as literal text.

var RUN = /(?:%[a-f0-9]{2})+/gi;
var MAX_UTF8_BYTES = 4;

function decodeRun(run) {
  try {
    return decodeURIComponent(run);
  } catch (_) {
    // Greedy, bounded: at each position try the longest valid UTF-8 sequence (≤4 bytes).
    var parts = run.match(/%[a-f0-9]{2}/gi);
    var out = '';
    var i = 0;
    while (i < parts.length) {
      var decoded = null;
      for (var len = Math.min(MAX_UTF8_BYTES, parts.length - i); len > 0; len--) {
        try {
          decoded = decodeURIComponent(parts.slice(i, i + len).join(''));
          i += len;
          break;
        } catch (_) {
          decoded = null;
        }
      }
      if (decoded === null) {
        out += parts[i] === '%FE' || parts[i] === '%FF' ? '�' : parts[i];
        i += 1;
      } else {
        out += decoded;
      }
    }
    return out;
  }
}

module.exports = function (encodedURI) {
  if (typeof encodedURI !== 'string') {
    throw new TypeError('Expected `encodedURI` to be of type `string`, got `' + typeof encodedURI + '`');
  }
  try {
    encodedURI = encodedURI.replace(/\+/g, ' ');
    return decodeURIComponent(encodedURI);
  } catch (_) {
    return encodedURI.replace(RUN, decodeRun);
  }
};
