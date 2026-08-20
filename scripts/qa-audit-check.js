const fs = require('fs');
const s = fs.readFileSync('scripts/qa-visual-audit.js', 'utf8');
console.log('waitUntil:', JSON.stringify([...s.matchAll(/waitUntil[^,}]{0,40}/g)].map(m => m[0])));
console.log('--- goto lines ---');
s.split(/\r?\n/).forEach((l, i) => { if (l.includes('goto(')) console.log('L' + (i + 1) + ': ' + l.trim().slice(0, 130)); });