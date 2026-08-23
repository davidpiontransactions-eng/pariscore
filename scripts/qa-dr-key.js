const fs = require('fs');
const s = fs.readFileSync('scripts/scrape-tennis-dr.ts', 'utf8');
const i = s.indexOf('jsfrags');
console.log('=== jsfrags usage in scrape-tennis-dr.ts ===');
console.log(s.slice(Math.max(0, i - 800), i + 400));
console.log('\n=== href/key extraction ===');
for (const pat of ['href', 'p=', 'normalizeKey', 'playerKey', 'key:']) {
  const idx = s.indexOf(pat);
  if (idx !== -1) console.log(pat, '->', s.slice(Math.max(0, idx - 150), idx + 200).replace(/\s+/g, ' ').slice(0, 250));
}