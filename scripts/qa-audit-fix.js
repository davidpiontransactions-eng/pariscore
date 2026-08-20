// scripts/qa-audit-fix.js - fix all networkidle -> domcontentloaded in qa-visual-audit.js
const fs = require('fs');
const p = require('path').join(__dirname, '..', 'scripts/qa-visual-audit.js');
let s = fs.readFileSync(p, 'utf8');
const before = (s.match(/networkidle/g) || []).length;
// Every networkidle -> domcontentloaded (polling odds/live every 15s breaks networkidle)
s = s.replace(/waitUntil: 'networkidle'/g, 'waitUntil: "domcontentloaded"');
// Ensure a settle wait after each home goto that had networkidle
s = s.replace(
  /await page\.goto\(BASE \+ BUST, \{ waitUntil: "domcontentloaded", timeout: 60000 \}\);/g,
  'await page.goto(BASE + BUST, { waitUntil: "domcontentloaded", timeout: 60000 });\n    await page.waitForTimeout(3500);'
);
fs.writeFileSync(p, s);
console.log('networkidle before:', before, '-> after:', (s.match(/networkidle/g) || []).length);