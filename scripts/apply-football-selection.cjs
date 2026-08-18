// Modifications football-tab-content.tsx (CRLF-safe) :
// 1) Import filterLiveByWindow + filterBySelection.
// 2) liveMatches : filtre fenêtre live (timeRange) + filtre sélection.
// 3) prematchMatches : filtre sélection (en plus du temps existant).
const fs = require('fs');
const p = 'src/components/football/football-tab-content.tsx';
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

// 1) Import.
rep(
[
'import { filterByStartWindow, filterByToday, parseTimeFilter, type MatchViewMode } from "@/lib/match-view";',
],
[
'import {',
'  filterByStartWindow,',
'  filterByToday,',
'  filterBySelection,',
'  filterLiveByWindow,',
'  parseTimeFilter,',
'  type MatchViewMode,',
'} from "@/lib/match-view";',
]
);

// 2) liveMatches : filtre fenêtre live + sélection.
rep(
[
'  const liveMatches = useMemo(',
'    () => matches.filter((m) => m.live && (m.live.status === "LIVE" || m.live.status === "HT")),',
'    [matches],',
'  );',
],
[
'  const selectedMatchIds = useSportsSidebarStore((s) => s.selectedMatchIds);',
'',
'  const liveMatches = useMemo(() => {',
'    let list = matches.filter((m) => m.live && (m.live.status === "LIVE" || m.live.status === "HT"));',
'    if (timeRange !== null) list = filterLiveByWindow(list, timeRange, (m) => m.scheduledAt);',
'    else if (timeToday) list = filterByToday(list, (m) => m.scheduledAt);',
'    return filterBySelection(list, selectedMatchIds, (m) => m.id);',
'  }, [matches, timeRange, timeToday, selectedMatchIds]);',
]
);

// 3) prematchMatches : ajouter le filtre sélection à la fin (après tri ? non, avant tri).
rep(
[
'    // Filtre par heure de début (fenêtre glissante 1h → 24h ou jour calendaire).',
'    if (timeRange !== null) {',
'      list = filterByStartWindow(list, timeRange, (m) => m.scheduledAt);',
'    } else if (timeToday) {',
'      list = filterByToday(list, (m) => m.scheduledAt);',
'    }',
],
[
'    // Filtre par heure de début (fenêtre glissante 1h → 24h ou jour calendaire).',
'    if (timeRange !== null) {',
'      list = filterByStartWindow(list, timeRange, (m) => m.scheduledAt);',
'    } else if (timeToday) {',
'      list = filterByToday(list, (m) => m.scheduledAt);',
'    }',
'    // Sélection sidebar : ne montrer que les matchs choisis. Vide = pas de filtre.',
'    list = filterBySelection(list, selectedMatchIds, (m) => m.id);',
]
);

// 4) Dépendances du useMemo prematch : ajouter selectedMatchIds.
rep(
[
'  }, [matches, selectedLeague, presetFilter, cvData, adData, filter, activeAIFilter, sortByEdge, timeRange, timeToday]);',
],
[
'  }, [matches, selectedLeague, presetFilter, cvData, adData, filter, activeAIFilter, sortByEdge, timeRange, timeToday, selectedMatchIds]);',
]
);

fs.writeFileSync(p, s, 'utf8');
console.log('appliqués ' + ok + '/4');