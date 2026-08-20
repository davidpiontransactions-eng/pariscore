// scripts/qa-reload-scan.js - find all reload/redirect mechanisms in client code
const fs = require('fs');
const path = require('path');

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const s = fs.statSync(p);
    if (s.isDirectory()) {
      if (f[0] !== '.' && f !== 'node_modules' && f !== '.next' && f !== 'ui') walk(p, out);
    } else if (/\.(tsx?|js)$/.test(f)) out.push(p);
  }
  return out;
}

const PATTERNS = [
  /location\.reload\(\)/g,
  /location\.href\s*=/g,
  /location\.assign\(/g,
  /location\.replace\(/g,
  /router\.replace\(/g,
  /router\.push\(/g,
  /router\.refresh\(\)/g,
  /window\.location\s*=/g,
  /redirect\(/g,
  /navigate\(/g,
];

for (const f of walk('src')) {
  const c = fs.readFileSync(f, 'utf8');
  const hits = [];
  for (const re of PATTERNS) {
    for (const m of c.match(re) || []) hits.push(m);
  }
  if (hits.length) {
    const lines = c.split(/\r?\n/);
    const detail = [];
    hits.forEach(h => {
      const li = lines.findIndex(l => l.includes(h.replace('(', '(')));
      if (li >= 0) detail.push('  L' + (li + 1) + ': ' + lines[li].trim().slice(0, 100));
    });
    console.log(f.replace(/\\/g, '/') + ' [' + hits.join(', ') + ']');
    console.log(detail.join('\n'));
  }
}