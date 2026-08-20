// scripts/qa-11px-scan.js - count text-[11px] per file in src/
const fs = require('fs');
const path = require('path');

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const s = fs.statSync(p);
    if (s.isDirectory()) {
      if (f[0] !== '.' && f !== 'node_modules' && f !== '.next') walk(p, out);
    } else if (/\.tsx?$/.test(f)) out.push(p);
  }
  return out;
}

const counts = [];
for (const f of walk('src')) {
  const c = fs.readFileSync(f, 'utf8');
  const n = (c.match(/text-\[11px\]/g) || []).length;
  if (n > 0) counts.push([f.replace(/\\/g, '/'), n]);
}
counts.sort((a, b) => b[1] - a[1]);
console.log(counts.length + ' files, ' + counts.reduce((s, x) => s + x[1], 0) + ' occurrences');
console.log(counts.map(x => x[0] + ': ' + x[1]).join('\n'));