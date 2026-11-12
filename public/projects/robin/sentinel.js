// Nightwatch Sentinel — access gate for the RL Michael (Robin) draft site.
// Faithful to the Nightwatch Sentinel pattern used elsewhere in this project:
//  - the page stores only the SHA-256 digest of the passcode (never the passcode),
//    so nothing sensitive is written to disk or logs;
//  - a correct entry unlocks the page for this browser session (sessionStorage);
//  - pure-JS SHA-256 is used (not crypto.subtle) so the gate also unlocks over
//    plain http://, not just https/localhost.
// Verified: DIGEST is the SHA-256 of the passcode (checked against Node crypto, 2026-11-11).
// ---------------------------------------------------------------------------

// SHA-256, pure JS (ASCII input -> lowercase hex). Verified against Node's crypto
// across 9 test vectors, including the empty-adjacent and multi-block cases.
function nwSha256hex(input) {
  var K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  function rr(v, a) { return (v >>> a) | (v << (32 - a)); }
  var ascii = String(input);
  var bytes = [];
  for (var i = 0; i < ascii.length; i++) bytes.push(ascii.charCodeAt(i) & 0xff);
  var bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  bytes.push(0, 0, 0, 0); // high 32 bits of the 64-bit bit-length (0 for messages under 512 MB)
  bytes.push((bitLen >>> 24) & 0xff, (bitLen >>> 16) & 0xff, (bitLen >>> 8) & 0xff, bitLen & 0xff);

  var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  for (var off = 0; off < bytes.length; off += 64) {
    var w = new Array(64);
    for (var t = 0; t < 16; t++) w[t] = ((bytes[off + t * 4] << 24) | (bytes[off + t * 4 + 1] << 16) | (bytes[off + t * 4 + 2] << 8) | bytes[off + t * 4 + 3]) | 0;
    for (var t = 16; t < 64; t++) {
      var s0 = rr(w[t - 15], 7) ^ rr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      var s1 = rr(w[t - 2], 17) ^ rr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
    }
    var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (var t = 0; t < 64; t++) {
      var S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25);
      var ch = (e & f) ^ ((~e) & g);
      var T1 = (h + S1 + ch + K[t] + w[t]) | 0;
      var S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22);
      var maj = (a & b) ^ (a & c) ^ (b & c);
      var T2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + T1) | 0; d = c; c = b; b = a; a = (T1 + T2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }
  var out = '';
  for (var i = 0; i < 8; i++) out += ('00000000' + (H[i] >>> 0).toString(16)).slice(-8);
  return out;
}
if (typeof globalThis !== 'undefined') globalThis.__nwSha256 = nwSha256hex; // exposed for automated checks only

// ---- the gate (browser only) ----
if (typeof document !== 'undefined') (function () {
  'use strict';

  var DIGEST = '753161de5a5c33e3f02606980858613823068fbecf7f73b5275007891171dadc'; // SHA-256 of the passcode
  var KEY = 'robin.sentinel';

  var EYE = '<svg viewBox="0 0 64 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<path d="M2 20C9 9 18 4 32 4s23 5 30 16c-7 11-16 16-30 16S9 31 2 20Z" stroke="currentColor" stroke-width="2.2"/>' +
    '<circle cx="32" cy="20" r="9.5" stroke="currentColor" stroke-width="2.2"/>' +
    '<circle cx="32" cy="20" r="3.4" fill="currentColor"/>' +
    '<path d="M32 8.5v-2M32 33.5v-2M20.5 11 19 9.5M43.5 11 45 9.5M14 20H12M52 20h-2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' +
    '</svg>';

  function isUnlocked() {
    try { return sessionStorage.getItem(KEY) === '1'; } catch (e) { return false; }
  }

  function buildOverlay() {
    var wrap = document.createElement('div');
    wrap.className = 'nw-sentinel';
    wrap.innerHTML =
      '<div class="nw-sentinel-card" role="dialog" aria-label="Nightwatch Sentinel access gate">' +
      '<div class="nw-sentinel-eye" aria-hidden="true">' + EYE + '</div>' +
      '<h1 class="nw-sentinel-title">NIGHTWATCH SENTINEL</h1>' +
      '<p class="nw-sentinel-sub">Private draft site. Enter the Sentinel passcode to continue.</p>' +
      '<form class="nw-sentinel-form">' +
      '<input class="nw-sentinel-pw" type="password" name="pw" autocomplete="off" placeholder="Sentinel passcode" aria-label="Sentinel passcode">' +
      '<button class="nw-sentinel-btn" type="submit">Unlock</button>' +
      '<p class="nw-sentinel-err" hidden>Incorrect passcode &mdash; try again.</p>' +
      '</form>' +
      '</div>';
    document.body.appendChild(wrap);

    var pw = wrap.querySelector('.nw-sentinel-pw');
    var form = wrap.querySelector('.nw-sentinel-form');
    var err = wrap.querySelector('.nw-sentinel-err');
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (nwSha256hex(pw.value) === DIGEST) {
        try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
        document.documentElement.classList.remove('nw-locked');
        if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      } else {
        err.hidden = false;
        pw.value = '';
        pw.focus();
      }
    });
    pw.focus();
  }

  function init() {
    if (isUnlocked()) return; // already authorized for this browser session
    document.documentElement.classList.add('nw-locked'); // belt & suspenders vs. the head script
    buildOverlay();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
