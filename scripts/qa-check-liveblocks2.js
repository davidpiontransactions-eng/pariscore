const fs = require('fs');
const files = ['src/components/football/tennis-tab-content.tsx', 'src/components/nba/nba-tab-content.tsx', 'src/components/mma/mma-tab-content.tsx', 'src/components/wnba/wnba-tab-content.tsx', 'src/components/cs2/cs2-tab-content.tsx', 'src/components/rugby/rugby-tab-content.tsx'];
for (const f of files) {
  if (!fs.existsSync(f)) { console.log(f, 'MISSING'); continue; }
  const s = fs.readFileSync(f, 'utf8');
  const idx = s.indexOf('liveMatches');
  if (idx === -1) { console.log(f, '| no liveMatches'); continue; }
  const block = s.slice(idx, idx + 600);
  const hasLeagueFilter = /league\.id ===|selectedLeague/.test(block);
  const hasTimeFilter = /filterLiveByWindow|filterByToday/.test(block);
  console.log(f, '| liveMatches: league filter:', hasLeagueFilter, '| time filter:', hasTimeFilter);
}