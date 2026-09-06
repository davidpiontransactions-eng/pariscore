const fs = require('fs');
const c = JSON.parse(fs.readFileSync('/home/ubuntu/pariscore/src/lib/tennis-elo/abstract-cache.json', 'utf8'));
const p = c.players;
const keys = Object.keys(p);
console.log('Total:', keys.length);
let atp = 0, wta = 0;
keys.forEach(k => { if (p[k].tour === 'ATP') atp++; if (p[k].tour === 'WTA') wta++; });
console.log('ATP:', atp, 'WTA:', wta);
const wtaNames = keys.filter(k => p[k].tour === 'WTA').map(k => p[k].name);
console.log('WTA first 10:', wtaNames.slice(0, 10));
// Check for our players
const check = ['naomi osaka', 'alexandra eala', 'elise mertens', 'mirra andreeva'];
check.forEach(name => {
  const key = name.replace(/\s+/g, '_');
  const found = p[key];
  console.log(name + ':', found ? 'Elo=' + found.elo : 'NOT FOUND');
});
