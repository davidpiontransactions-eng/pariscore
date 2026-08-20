// scripts/qa-router-scan.js - find ALL useRouter().push/replace/refresh call sites with context
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

for (const f of walk('src')) {
  const c = fs.readFileSync(f, 'utf8');
  const lines = c.split(/\r?\n/);
  const hits = [];
  lines.forEach((l, i) => {
    if (/router\.(push|replace|refresh)\(/.test(l) || /useRouter\(\)/.test(l) || /usePathname\(\)/.test(l)) {
      hits.push('L' + (i + 1) + ': ' + l.trim().slice(0, 110));
    }
  });
  if (hits.length) {
    console.log('== ' + f.replace(/\\/g, '/'));
    console.log(hits.join('\n'));
  }
}