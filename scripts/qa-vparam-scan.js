// scripts/qa-vparam-scan.js - find any logic reading the ?v= param (cache-busting clashes)
const fs = require('fs');
const path = require('path');

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const s = fs.statSync(p);
    if (s.isDirectory()) {
      if (f[0] !== '.' && f !== 'node_modules' && f !== '.next' && f !== 'ui') walk(p, out);
    } else if (/\.(tsx?|ts)$/.test(f)) out.push(p);
  }
  return out;
}

const PATTERNS = [
  /params\.get\(["']v["']\)/,
  /params\.has\(["']v["']\)/,
  /searchParams\.get\(["']v["']\)/,
  /searchParams\.has\(["']v["']\)/,
  /["'v["']/,
  /param["']v["']/,
  /v=/
];

for (const f of walk('src')) {
  const c = fs.readFileSync(f, 'utf8');
  const lines = c.split(/\r?\n/);
  lines.forEach((l, i) => {
    if (/(get|has|delete|set)\(["']v["']\)/.test(l) || /["']v["'][^)]*(reload|navigat|redirect)/.test(l)) {
      console.log(f.replace(/\\/g, '/') + ' L' + (i + 1) + ': ' + l.trim().slice(0, 110));
    }
  });
}
console.log('--- done ---');