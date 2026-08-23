const fs = require('fs');
console.log('=== .gitignore db entries ===');
const gi = fs.readFileSync('.gitignore', 'utf8');
gi.split(/\r?\n/).forEach((l) => { if (/db|sqlite|prisma/i.test(l) && l.trim() && !l.startsWith('#')) console.log(' ', l.trim()); });
console.log('=== update_vps.sh [4/6]..[6/6] ===');
const s = fs.readFileSync('scripts/update_vps.sh', 'utf8');
const lines = s.split(/\r?\n/);
console.log(lines.slice(60, 130).join('\n'));