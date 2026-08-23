const fs = require('fs');
for (const f of ['scripts/update_vps.sh', 'scripts/deploy.bat']) {
  if (!fs.existsSync(f)) { console.log(f, 'MISSING'); continue; }
  console.log('=== ' + f + ' ===');
  const s = fs.readFileSync(f, 'utf8');
  console.log(s.split(/\r?\n/).slice(0, 60).join('\n'));
}