const fs = require('fs');
const lines = fs.readFileSync('pariscore.html', 'utf8').split('\n');
let stat = { emptyState: 0, varAssign: 0, other: 0 };
lines.forEach((l, i) => {
  if (!l.includes('.innerHTML')) return;
  if (l.includes('escapeHtml') || l.includes('textContent')) return;
  const t = l.trim();
  if (/= '<[^']*>'/.test(t) || t.includes("= 'Calcul...'") || t.includes("= 'Saisis")) { stat.emptyState++; return; }
  if (t.includes('= html') || t.includes('= _gHtml') || t.includes('= _msg')) { stat.varAssign++; return; }
  stat.other++;
  console.log((i + 1) + ': ' + t.slice(0, 150));
});
console.log('---');
console.log('empty states statiques:', stat.emptyState);
console.log('assignation de var html (échappé en amont):', stat.varAssign);
console.log('AUDITER (autres):', stat.other);
