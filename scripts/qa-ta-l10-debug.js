// scripts/qa-ta-l10-debug.js - debug why 0 hard matches
const fs = require('fs');
const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
function parseDate(s) {
  const m = s.match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/);
  if (!m) return null;
  const mo = MONTHS[m[2]];
  if (mo === undefined) return null;
  return new Date(Date.UTC(+m[3], mo, +m[1]));
}
(async () => {
  const src = await (await fetch('https://www.tennisabstract.com/jsfrags/ArynaSabalenka.js', { headers: { 'user-agent': 'Mozilla/5.0' } })).text();
  let rows = 0, withDate = 0, hard = 0, samples = [];
  for (const tb of src.match(/<tbody>([\s\S]*?)<\/tbody>/gs) || []) {
    for (const rm of tb.match(/<tr>([\s\S]*?)<\/tr>/gs) || []) {
      const cells = rm[1].match(/<td[^>]*>[\s\S]*?<\/td>/g);
      if (!cells || cells.length < 8) continue;
      rows++;
      const date = cells[0].replace(/<[^>]+>/g, '').trim();
      const d = parseDate(date);
      if (d) withDate++;
      const surface = (cells[2] || '').replace(/<[^>]+>/g, '').trim();
      if (/hard/i.test(surface)) { hard++; if (samples.length < 8) samples.push({ date, surface, cells: cells.length }); }
    }
  }
  console.log('rows>=8cells:', rows, '| with valid date:', withDate, '| surface=Hard:', hard);
  console.log('hard samples:', JSON.stringify(samples));
  // print first 8 rows with cell counts and cell[0..3] raw
  let printed = 0;
  for (const tb of src.match(/<tbody>([\s\S]*?)<\/tbody>/gs) || []) {
    for (const rm of tb.match(/<tr>([\s\S]*?)<\/tr>/gs) || []) {
      const cells = rm[1].match(/<td[^>]*>[\s\S]*?<\/td>/g);
      if (!cells || cells.length < 8) continue;
      if (printed++ >= 8) break;
      console.log('row', printed, 'cells=' + cells.length, 'c0=' + cells[0].replace(/<[^>]+>/g, '').trim(), 'c2=' + (cells[2] || '').replace(/<[^>]+>/g, '').trim(), 'c3=' + (cells[3] || '').replace(/<[^>]+>/g, '').trim());
    }
  }
})();