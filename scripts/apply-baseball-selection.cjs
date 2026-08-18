// Filtre sélection sidebar dans MLBKBOFolderTab.tsx (CRLF-safe).
const fs = require('fs');
const p = 'src/components/baseball/MLBKBOFolderTab.tsx';
let s = fs.readFileSync(p, 'utf8');
const eol = s.includes('\r\n') ? '\r\n' : '\n';
let ok = 0;

function rep(oldLines, newLines) {
  const o = oldLines.join('\n').replace(/\n/g, eol);
  const n = newLines.join('\n').replace(/\n/g, eol);
  const count = s.split(o).length - 1;
  if (count !== 1) { console.log('MISS (' + count + ') :', oldLines[0]); return; }
  s = s.replace(o, n);
  ok++;
}

rep(
['import { splitLivePrematch, filterByStartWindow, filterByToday, parseTimeFilter, type MatchViewMode } from "@/lib/match-view";'],
['import { splitLivePrematch, filterByStartWindow, filterByToday, filterBySelection, parseTimeFilter, type MatchViewMode } from "@/lib/match-view";']
);

rep(
[
'  const visiblePrematch = useMemo(() => {',
'    const scoped = timeToday ? filterByToday(prematch, (m) => m.game.gameDateIso) : prematch;',
'    const inWindow = filterByStartWindow(scoped, timeRange, (m) => m.game.gameDateIso);',
'    return [...inWindow].sort(',
'      (a, b) => new Date(a.game.gameDateIso).getTime() - new Date(b.game.gameDateIso).getTime(),',
'    );',
'  }, [prematch, timeRange, timeToday]);',
],
[
'  const selectedMatchIds = useSportsSidebarStore((s) => s.selectedMatchIds);',
'',
'  const visiblePrematch = useMemo(() => {',
'    const scoped = timeToday ? filterByToday(prematch, (m) => m.game.gameDateIso) : prematch;',
'    const inWindow = filterByStartWindow(scoped, timeRange, (m) => m.game.gameDateIso);',
'    const selected = filterBySelection(inWindow, selectedMatchIds, (m) => m.game.id);',
'    return [...selected].sort(',
'      (a, b) => new Date(a.game.gameDateIso).getTime() - new Date(b.game.gameDateIso).getTime(),',
'    );',
'  }, [prematch, timeRange, timeToday, selectedMatchIds]);',
]
);

rep(
[
'  const visibleMatches = mode === "live" ? live : visiblePrematch;',
],
[
'  const visibleMatches = mode === "live" ? filterBySelection(live, selectedMatchIds, (m) => m.game.id) : visiblePrematch;',
]
);

fs.writeFileSync(p, s, 'utf8');
console.log('appliqués ' + ok + '/3');