// scripts/migrate-9px.js - text-[9px] -> text-[11px] (C4 policy, ASCII-only)
const fs = require('fs');
const path = require('path');

const roots = [path.join(__dirname, '..', 'src')];
const exts = ['.tsx', '.ts', '.jsx', '.js'];
let filesChanged = 0, occurrences = 0;

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (exts.includes(path.extname(p))) {
      const before = fs.readFileSync(p, 'utf8');
      const after = before.split('text-[9px]').join('text-[11px]');
      if (after !== before) {
        fs.writeFileSync(p, after);
        const n = (before.match(/text-\[9px\]/g) || []).length;
        filesChanged++; occurrences += n;
        console.log(n + 'x ' + path.relative(process.cwd(), p));
      }
    }
  }
}
walk(roots[0]);
console.log('DONE: ' + filesChanged + ' files, ' + occurrences + ' occurrences 9px->11px');