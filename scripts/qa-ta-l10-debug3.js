// scripts/qa-ta-l10-debug3.js - debug on SAVED file (no network)
const fs = require('fs');
const src = fs.readFileSync('scripts/tmp-ArynaSabalenka.js', 'utf8');
const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
function parseDate(s) {
  const m = s.match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/);
  if (!m) return null;
  const mo = MONTHS[m[2]];
  if (mo === undefined) return null;
  return new Date(Date.UTC(+m[3], mo, +m[1]));
}
let rows = 0, withDate = 0, hard = 0;
const samples = [];
for (const tbM of src.matchAll(/<tbody>([\s\S]*?)<\/tbody>/gs)) {
  const tb = tbM[1];
  for (const rm of tb.matchAll(/<tr>([\s\S]*?)<\/tr>/gs)) {
    const cells = rm[1].match(/<td[^>]*>[\s\S]*?<\/td>/g);
    if (!cells || cells.length < 8) continue;
    rows++;
    const date = cells[0].replace(/<[^>]+>/g, '').trim();
    const d = parseDate(date);
    if (d) withDate++;
    const surface = (cells[2] || '').replace(/<[^>]+>/g, '').trim();
    if (/hard/i.test(surface)) { hard++; if (samples.length < 6) samples.push({ date, surface }); }
  }
}
console.log('rows:', rows, 'withDate:', withDate, 'hard:', hard);
console.log('hard samples:', JSON.stringify(samples));