// Filtre sélection sidebar dans cs2-tab-content (CRLF-safe).
const fs = require('fs');
const p = 'src/components/cs2/cs2-tab-content.tsx';
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
'  const { live, prematch } = useMemo(',
'    () => splitLivePrematch(matches, (m) => m.is_live === true),',
'    [matches],',
'  );',
],
[
'  const selectedMatchIds = useSportsSidebarStore((s) => s.selectedMatchIds);',
'  const { live, prematch } = useMemo(',
'    () => splitLivePrematch(matches, (m) => m.is_live === true),',
'    [matches],',
'  );',
]
);

rep(
[
'  const visiblePrematch = useMemo(() => {',
'    const scoped = timeToday ? filterByToday(prematchUpcoming, (m) => m.scheduled) : prematchUpcoming;',
'    const inWindow = filterByStartWindow(scoped, timeRange, (m) => m.scheduled);',
'    return [...inWindow].sort(',
'      (a, b) => new Date(a.scheduled ?? 0).getTime() - new Date(b.scheduled ?? 0).getTime(),',
'    );',
'  }, [prematchUpcoming, timeRange, timeToday]);',
],
[
'  const visiblePrematch = useMemo(() => {',
'    const scoped = timeToday ? filterByToday(prematchUpcoming, (m) => m.scheduled) : prematchUpcoming;',
'    const inWindow = filterByStartWindow(scoped, timeRange, (m) => m.scheduled);',
'    const selected = filterBySelection(inWindow, selectedMatchIds, (m) => m.id);',
'    return [...selected].sort(',
'      (a, b) => new Date(a.scheduled ?? 0).getTime() - new Date(b.scheduled ?? 0).getTime(),',
'    );',
'  }, [prematchUpcoming, timeRange, timeToday, selectedMatchIds]);',
]
);

rep(
[
'  // La liste rendue dépend de l\'onglet actif.',
'  const visibleMatches = mode === "live" ? live : visiblePrematch;',
],
[
'  // La liste rendue dépend de l\'onglet actif (live aussi filtré par sélection).',
'  const visibleMatches = mode === "live" ? filterBySelection(live, selectedMatchIds, (m) => m.id) : visiblePrematch;',
]
);

fs.writeFileSync(p, s, 'utf8');
console.log('appliqués ' + ok + '/4');