'use strict';
// tools/extract-js.js — Extract inline JS blocks from pariscore.html → pariscore.js
// Run: node tools/extract-js.js
// Keeps timing-critical inline scripts in place:
//   - 10373-10382: security banner (body data-attr before CSS applies)
//   - 11195-11208: sport-hub removal desktop (explicitly "avant paint")
//   - JSON-LD blocks (type=application/ld+json) — untouched
// All other script blocks concatenated into pariscore.js, loaded before </body>.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HTML_IN  = path.join(ROOT, 'pariscore.html');
const JS_OUT   = path.join(ROOT, 'pariscore.js');

// [startLine, endLine] — 1-indexed, inclusive, including <script> and </script> tags
const BLOCKS = [
  [10406, 10419],  // audio toggle boot sync (handles own DOMContentLoaded)
  [13080, 13204],  // world cup bracket module
  [13566, 14018],  // circuit / Roland Garros module
  [18130, 18167],  // newsletter form submit handler
  [18612, 38743],  // MAIN block — PariScore v2.0 frontend (20131 lines)
  [38781, 39495],  // Deep Analysis Pro terminal SSE
  [39498, 39815],  // bet tracking / cockpit module
  [39947, 41103],  // live dashboard + misc
  [41109, 41472],  // cf-sprint1
];

const content = fs.readFileSync(HTML_IN, 'utf8');
const lines = content.split('\n');

// ── Build pariscore.js ────────────────────────────────────────────────────────
const jsParts = [
  `/* pariscore.js — extracted from pariscore.html`,
  ` * Generated: ${new Date().toISOString()}`,
  ` * Source blocks: ${BLOCKS.map(([s,e]) => `${s}-${e}`).join(', ')}`,
  ` */\n`,
];

for (const [start, end] of BLOCKS) {
  // lines[] is 0-indexed; skip opening <script...> (start-1) and closing </script> (end-1)
  const inner = lines.slice(start, end - 1); // lines[start] to lines[end-2]
  jsParts.push(inner.join('\n'));
  jsParts.push('\n');
}

const jsContent = jsParts.join('\n');
fs.writeFileSync(JS_OUT, jsContent, 'utf8');
console.log(`✓ pariscore.js  ${(Buffer.byteLength(jsContent) / 1024).toFixed(0)} KB`);

// ── Build patched HTML ────────────────────────────────────────────────────────
const removeSet = new Set();
for (const [start, end] of BLOCKS) {
  for (let i = start; i <= end; i++) removeSet.add(i);
}

const out = [];
for (let i = 0; i < lines.length; i++) {
  const lineNo = i + 1; // 1-indexed
  if (removeSet.has(lineNo)) continue;
  const line = lines[i];
  // Insert <script> tag just before closing </body>
  if (line.trimStart().startsWith('</body>')) {
    out.push('<script src="/pariscore.js"></script>');
  }
  out.push(line);
}

const patchedHtml = out.join('\n');
fs.writeFileSync(HTML_IN, patchedHtml, 'utf8');
console.log(`✓ pariscore.html ${(Buffer.byteLength(patchedHtml) / 1024).toFixed(0)} KB  (was ${(Buffer.byteLength(content) / 1024).toFixed(0)} KB)`);
console.log(`  Removed ${removeSet.size} lines of inline JS`);

// Sanity check
const remaining = patchedHtml.match(/<script(?![^>]*type=["']application)/g) || [];
console.log(`  Remaining <script> blocks in HTML: ${remaining.length} (expected ~5: JSON-LD + 2 timing-critical + CDN refs)`);
