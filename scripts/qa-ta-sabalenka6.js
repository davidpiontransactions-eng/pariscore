// scripts/qa-ta-sabalenka6.js - inspect classic page structure
const fs = require('fs');
const html = fs.readFileSync('scripts/tmp-classic-ArynaSabalenka.html', 'utf8');
console.log('len', html.length);
console.log('has tbody:', html.includes('<tbody'));
const tr = html.match(/<tr[\s\S]*?<\/tr>/g) || [];
console.log('tr count:', tr.length);
if (tr.length) {
  console.log('--- first 6 rows (stripped) ---');
  for (const t of tr.slice(0, 6)) {
    console.log(t.replace(/<[^>]+>/g, '|').replace(/&nbsp;/g, ' ').replace(/\s*\|\s*/g, ' | ').replace(/\s+/g, ' ').trim().slice(0, 180));
  }
}
// find date markers
console.log('has "Aug-2026":', html.includes('Aug-2026'));
console.log('has "20-Aug":', html.includes('20-Aug'));
const tables = html.match(/<table[\s\S]*?<\/table>/gs) || [];
console.log('tables:', tables.length);