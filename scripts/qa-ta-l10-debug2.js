// scripts/qa-ta-l10-debug2.js - compare fresh fetch vs saved file
const fs = require('fs');
(async () => {
  const res = await fetch('https://www.tennisabstract.com/jsfrags/ArynaSabalenka.js', { headers: { 'user-agent': 'Mozilla/5.0' } });
  const fresh = await res.text();
  const saved = fs.readFileSync('scripts/tmp-ArynaSabalenka.js', 'utf8');
  console.log('fresh len:', fresh.length, '| saved len:', saved.length);
  console.log('fresh has recent-results:', fresh.includes('recent-results'));
  console.log('fresh has player_frag:', fresh.includes('player_frag'));
  console.log('fresh first 300:', fresh.slice(0, 300));
  console.log('fresh tbody count:', (fresh.match(/<tbody>/g) || []).length);
  console.log('fresh tr count:', (fresh.match(/<tr>/g) || []).length);
})();