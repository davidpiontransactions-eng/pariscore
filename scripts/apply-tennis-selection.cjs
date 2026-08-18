// Modifications tennis-tab-content.tsx (CRLF-safe) :
// 1) Import filterBySelection + filterLiveByWindow.
// 2) matchesWithScoped : filtre sélection (amont, avant curation).
// 3) Vue live : filtre fenêtre live par temps.
const fs = require('fs');
const p = 'src/components/football/tennis-tab-content.tsx';
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

// 1) Import (vérifier le pattern réel d'abord via findstr).
rep(
[
'import { filterByStartWindow, filterByToday, parseTimeFilter } from "@/lib/match-view";',
],
[
'import {',
'  filterByStartWindow,',
'  filterByToday,',
'  filterBySelection,',
'  filterLiveByWindow,',
'  parseTimeFilter,',
'} from "@/lib/match-view";',
]
);

// 2) matchesWithScoped : sélection amont.
rep(
[
'  const matchesWithScoped = useMemo(() => {',
'    if (!selectedTournament) return matchesWithLive;',
'    const target = selectedTournament.name.toLowerCase().trim();',
'    return matchesWithLive.filter(',
'      (m) =>',
'        m.tournament.toLowerCase().trim() === target ||',
'        m.tournament.toLowerCase().includes(target),',
'    );',
'  }, [matchesWithLive, selectedTournament]);',
],
[
'  const selectedMatchIds = useSportsSidebarStore((s) => s.selectedMatchIds);',
'',
'  const matchesWithScoped = useMemo(() => {',
'    let list = matchesWithLive;',
'    if (selectedTournament) {',
'      const target = selectedTournament.name.toLowerCase().trim();',
'      list = list.filter(',
'        (m) =>',
'          m.tournament.toLowerCase().trim() === target ||',
'          m.tournament.toLowerCase().includes(target),',
'      );',
'    }',
'    // Sélection sidebar : ne montrer que les matchs choisis. Vide = pas de filtre.',
'    return filterBySelection(list, selectedMatchIds, (m) => m.id);',
'  }, [matchesWithLive, selectedTournament, selectedMatchIds]);',
]
);

// 3) Vue live : fenêtre live par temps (subFiltered, restForGrid, featuredForMarquee).
rep(
[
'  const subFiltered = useMemo(() => {',
'    if (subTab === "live") {',
'      return filtered.filter((m) => liveStates[m.id]?.isLive);',
'    }',
'    return scopeByTime(filtered); // "today" = tout (hors filtre horaire)',
'  }, [subTab, filtered, liveStates, scopeByTime]);',
],
[
'  const subFiltered = useMemo(() => {',
'    if (subTab === "live") {',
'      const liveOnly = filtered.filter((m) => liveStates[m.id]?.isLive);',
'      if (timeRange !== null) return filterLiveByWindow(liveOnly, timeRange, (m) => m.scheduledAt);',
'      if (timeToday) return filterByToday(liveOnly, (m) => m.scheduledAt);',
'      return liveOnly;',
'    }',
'    return scopeByTime(filtered); // "today" = tout (hors filtre horaire)',
'  }, [subTab, filtered, liveStates, scopeByTime, timeRange, timeToday]);',
]
);

rep(
[
'  const restForGrid = useMemo(() => {',
'    if (subTab === "live") {',
'      return curation.rest.filter((m) => liveStates[m.id]?.isLive);',
'    }',
'    return scopeByTime(curation.rest);',
'  }, [subTab, curation.rest, liveStates, scopeByTime]);',
],
[
'  const restForGrid = useMemo(() => {',
'    if (subTab === "live") {',
'      const liveOnly = curation.rest.filter((m) => liveStates[m.id]?.isLive);',
'      if (timeRange !== null) return filterLiveByWindow(liveOnly, timeRange, (m) => m.scheduledAt);',
'      if (timeToday) return filterByToday(liveOnly, (m) => m.scheduledAt);',
'      return liveOnly;',
'    }',
'    return scopeByTime(curation.rest);',
'  }, [subTab, curation.rest, liveStates, scopeByTime, timeRange, timeToday]);',
]
);

rep(
[
'  const featuredForMarquee = useMemo(() => {',
'    if (subTab === "live") {',
'      return curation.featured.filter((m) => liveStates[m.id]?.isLive);',
'    }',
'    return scopeByTime(curation.featured);',
'  }, [subTab, curation.featured, liveStates, scopeByTime]);',
],
[
'  const featuredForMarquee = useMemo(() => {',
'    if (subTab === "live") {',
'      const liveOnly = curation.featured.filter((m) => liveStates[m.id]?.isLive);',
'      if (timeRange !== null) return filterLiveByWindow(liveOnly, timeRange, (m) => m.scheduledAt);',
'      if (timeToday) return filterByToday(liveOnly, (m) => m.scheduledAt);',
'      return liveOnly;',
'    }',
'    return scopeByTime(curation.featured);',
'  }, [subTab, curation.featured, liveStates, scopeByTime, timeRange, timeToday]);',
]
);

fs.writeFileSync(p, s, 'utf8');
console.log('appliqués ' + ok + '/4');