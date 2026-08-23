const fs = require('fs');
const files = ['src/components/football/tennis-tab-content.tsx', 'src/components/nba/nba-tab-content.tsx', 'src/components/mma/mma-tab-content.tsx', 'src/components/wnba/wnba-tab-content.tsx', 'src/components/cs2/cs2-tab-content.tsx', 'src/components/rugby/rugby-tab-content.tsx'];
for (const f of files) {
  if (!fs.existsSync(f)) { console.log(f, 'MISSING'); continue; }
  const s = fs.readFileSync(f, 'utf8');
  // find the liveMatches useMemo block
  const m = s.match(/const liveMatches = useMemo\(\(\) => \{[\s\S]{0,500}?\}, \[/);
  if (m) {
    const block = m[0];
    const hasLeague = /selectedLeague|selectedLeagueId/.test(block);
    const hasLeagueFilter = /league\.id ===/.test(block);
    console.log(f, '| block present:', !!m, '| mentions league:', hasLeague, '| filters by league.id:', hasLeagueFilter);
  } else {
    console.log(f, '| no liveMatches useMemo');
  }
}