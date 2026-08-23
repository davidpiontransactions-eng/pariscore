const fs = require('fs');
const bf = fs.readFileSync('src/lib/bsd-fetcher.ts', 'utf8');
// find history type/structure and extractForm
const idx = bf.indexOf('history');
console.log('=== context around "history" ===');
console.log(bf.slice(Math.max(0, idx - 300), idx + 1200).replace(/\r?\n/g, ' ').slice(0, 1500));
console.log('\n=== extractForm ===');
const ei = bf.indexOf('function extractForm');
console.log(ei === -1 ? 'not in bsd-fetcher' : bf.slice(ei, ei + 800));
// find MatchOutcome type
const mi = bf.indexOf('MatchOutcome');
console.log('\n=== MatchOutcome ===');
console.log(mi === -1 ? 'not found' : bf.slice(Math.max(0, mi - 200), mi + 400));
// TennisMatch enricher (eloMatch) — where does eloMatch come from
const em = bf.indexOf('eloMatch');
console.log('\n=== eloMatch context ===');
console.log(em === -1 ? 'not found' : bf.slice(Math.max(0, em - 400), em + 900));