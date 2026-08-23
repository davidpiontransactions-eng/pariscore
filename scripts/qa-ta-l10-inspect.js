// scripts/qa-ta-l10-inspect.js - inspect per-year table structure
const fs = require('fs');
const src = fs.readFileSync('scripts/tmp-ArynaSabalenka.js', 'utf8');
// find each table id + its thead
const tables = src.match(/<table[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/table>/gs) || [];
console.log('tables found:', tables.length);
for (const t of tables) {
  const id = (t.match(/id="([^"]+)"/) || [])[1];
  const thead = t.match(/<thead>([\s\S]*?)<\/thead>/);
  const heads = thead ? thead[1].replace(/<[^>]+>/g, '|').replace(/&nbsp;/g, ' ').replace(/\s*\|\s*/g, ' | ').replace(/\s+/g, ' ').trim().slice(0, 110) : '(no thead)';
  const trCount = (t.match(/<tr>/g) || []).length;
  console.log('\n-- table id=' + id + ' rows=' + trCount);
  console.log('   thead: ' + heads);
}
// print first data row of tour-years
const ty = tables.find((t) => /tour-years/.test(t)) || '';
if (ty) {
  const rows = ty.match(/<tr>([\s\S]*?)<\/tr>/gs) || [];
  if (rows.length > 1) {
    console.log('\n=== sample row from tour-years ===');
    console.log(rows[1].replace(/<[^>]+>/g, '|').replace(/&nbsp;/g, ' ').replace(/\s*\|\s*/g, ' | ').replace(/\s+/g, ' ').trim().slice(0, 220));
    console.log('RAW:', rows[1].slice(0, 600));
  }
}