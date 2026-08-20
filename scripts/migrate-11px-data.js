// scripts/migrate-11px-data.js - promote text-[11px] -> text-xs (12px) in high-visibility match data components
const fs = require('fs');
const path = require('path');

const TARGETS = [
  'src/components/football/football-match-card.tsx',
  'src/components/football/football-live-card.tsx',
  'src/components/football/football-round-groups.tsx',
  'src/components/tennis/pip-match-row.tsx',
  'src/components/tennis/pip-bet-panel.tsx',
  'src/components/shared/flashscore-match-list.tsx',
  'src/components/tennis/match-card-broadcast.tsx',
  'src/components/dashboard/best-matches-tabs.tsx',
  'src/components/football/MetricComparePanel.tsx',
  'src/components/football/ReliabilityScore.tsx',
];

let total = 0;
for (const rel of TARGETS) {
  const p = path.join(__dirname, '..', rel);
  if (!fs.existsSync(p)) { console.log('SKIP (absent): ' + rel); continue; }
  const s = fs.readFileSync(p, 'utf8');
  const n = (s.match(/text-\[11px\]/g) || []).length;
  if (n === 0) continue;
  const t = s.replace(/text-\[11px\]/g, 'text-xs');
  fs.writeFileSync(p, t);
  total += n;
  console.log(rel + ': ' + n + ' -> text-xs');
}
console.log('TOTAL: ' + total + ' occurrences promoted to 12px');