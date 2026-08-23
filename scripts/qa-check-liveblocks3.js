const fs = require('fs');
const files = ['src/components/football/tennis-tab-content.tsx', 'src/components/nba/nba-tab-content.tsx', 'src/components/mma/mma-tab-content.tsx', 'src/components/cs2/cs2-tab-content.tsx'];
for (const f of files) {
  if (!fs.existsSync(f)) continue;
  const s = fs.readFileSync(f, 'utf8');
  const m = s.match(/splitLivePrematch\([\s\S]{0,300}/);
  const liveM = s.match(/const live[\s\S]{0,200}?filterByStartWindow|\.live\b[\s\S]{0,150}?filterByStartWindow/);
  console.log('=== ' + f + ' ===');
  if (m) console.log('splitLivePrematch:', m[0].replace(/\s+/g, ' ').slice(0, 250));
  if (liveM) console.log('live:', liveM[0].replace(/\s+/g, ' ').slice(0, 250));
}