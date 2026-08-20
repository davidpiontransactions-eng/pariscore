// scripts/qa-query-scan.js - find query-string cleanup / router.replace in client code
const fs = require('fs');
const path = require('path');

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const s = fs.statSync(p);
    if (s.isDirectory()) {
      if (f[0] !== '.' && f !== 'node_modules' && f !== '.next' && f !== 'ui') walk(p, out);
    } else if (/\.tsx?$/.test(f)) out.push(p);
  }
  return out;
}

const PATTERNS = [
  /searchParams/,
  /useSearchParams/,
  /URLSearchParams/,
  /\.search\s*=/,
  /replace\(\s*`\$\{[^}]+\}?\$\{pathname/,
  /pathname[^;]{0,60}replace/,
  /delete\(["']v["']\)/,
];

for (const f of walk('src')) {
  const c = fs.readFileSync(f, 'utf8');
  const hits = [];
  for (const re of PATTERNS) {
    for (const m of c.match(re) || []) hits.push(m.replace(/\s+/g, ' ').slice(0, 50));
  }
  if (hits.length) {
    console.log(f.replace(/\\/g, '/'));
    console.log('  ' + [...new Set(hits)].join(' | '));
  }
}