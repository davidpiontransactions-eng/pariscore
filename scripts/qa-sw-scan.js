// scripts/qa-sw-scan.js - scan public/sw.js for force-reload patterns
const fs = require('fs');
const s = fs.readFileSync('public/sw.js', 'utf8');
console.log('sw.js bytes:', s.length);
for (const kw of ['clients.claim', 'skipWaiting', 'navigate(', 'reload(', 'postMessage', 'controllerchange', 'SKIP_WAITING', 'matchAll']) {
  const idx = [];
  let i = -1;
  while ((i = s.indexOf(kw, i + 1)) !== -1) idx.push(i);
  console.log('== ' + kw + ' x' + idx.length);
  for (const j of idx.slice(0, 3)) {
    console.log('   @' + j + ':', JSON.stringify(s.slice(Math.max(0, j - 90), j + 160)));
  }
}