// Filtre sélection sidebar dans nba/wnba/baseball (CRLF-safe).
const fs = require('fs');

const spec = [
  {
    p: 'src/components/nba/nba-tab-content.tsx',
    getId: '(m) => m.id',
    timeField: 'm.commence_time',
    old: [
'  const { prematch } = useMemo(() => splitLivePrematch(matches, () => false), [matches]);',
'',
'  const visiblePrematch = useMemo(() => {',
'    const scoped = timeToday ? filterByToday(prematch, (m) => m.commence_time) : prematch;',
'    const inWindow = filterByStartWindow(scoped, timeRange, (m) => m.commence_time);',
'    return [...inWindow].sort(',
'      (a, b) => new Date(a.commence_time ?? 0).getTime() - new Date(b.commence_time ?? 0).getTime(),',
'    );',
'  }, [prematch, timeRange, timeToday]);',
    ],
    new: [
'  const { prematch } = useMemo(() => splitLivePrematch(matches, () => false), [matches]);',
'  const selectedMatchIds = useSportsSidebarStore((s) => s.selectedMatchIds);',
'',
'  const visiblePrematch = useMemo(() => {',
'    const scoped = timeToday ? filterByToday(prematch, (m) => m.commence_time) : prematch;',
'    const inWindow = filterByStartWindow(scoped, timeRange, (m) => m.commence_time);',
'    const selected = filterBySelection(inWindow, selectedMatchIds, (m) => m.id);',
'    return [...selected].sort(',
'      (a, b) => new Date(a.commence_time ?? 0).getTime() - new Date(b.commence_time ?? 0).getTime(),',
'    );',
'  }, [prematch, timeRange, timeToday, selectedMatchIds]);',
    ],
  },
  {
    p: 'src/components/wnba/wnba-tab-content.tsx',
    getId: '(m) => m.id',
    timeField: 'm.commence_time',
    old: [
'  const { prematch } = useMemo(() => splitLivePrematch(matches, () => false), [matches]);',
'',
'  const visiblePrematch = useMemo(() => {',
'    const scoped = timeToday ? filterByToday(prematch, (m) => m.commence_time) : prematch;',
'    const inWindow = filterByStartWindow(scoped, timeRange, (m) => m.commence_time);',
'    return [...inWindow].sort(',
'      (a, b) => new Date(a.commence_time ?? 0).getTime() - new Date(b.commence_time ?? 0).getTime(),',
'    );',
'  }, [prematch, timeRange, timeToday]);',
    ],
    new: [
'  const { prematch } = useMemo(() => splitLivePrematch(matches, () => false), [matches]);',
'  const selectedMatchIds = useSportsSidebarStore((s) => s.selectedMatchIds);',
'',
'  const visiblePrematch = useMemo(() => {',
'    const scoped = timeToday ? filterByToday(prematch, (m) => m.commence_time) : prematch;',
'    const inWindow = filterByStartWindow(scoped, timeRange, (m) => m.commence_time);',
'    const selected = filterBySelection(inWindow, selectedMatchIds, (m) => m.id);',
'    return [...selected].sort(',
'      (a, b) => new Date(a.commence_time ?? 0).getTime() - new Date(b.commence_time ?? 0).getTime(),',
'    );',
'  }, [prematch, timeRange, timeToday, selectedMatchIds]);',
    ],
  },
  {
    p: 'src/components/baseball/MLBKBOFolderTab.tsx',
    getId: '(m) => m.game.id',
    timeField: 'm.game.gameDateIso',
    old: [
'  const { prematch } = useMemo(() => splitLivePrematch(matches, () => false), [matches]);',
'',
'  const visiblePrematch = useMemo(() => {',
'    const scoped = timeToday ? filterByToday(prematch, (m) => m.game.gameDateIso) : prematch;',
'    const inWindow = filterByStartWindow(scoped, timeRange, (m) => m.game.gameDateIso);',
'    return [...inWindow].sort(',
'      (a, b) => new Date(a.game.gameDateIso ?? 0).getTime() - new Date(b.game.gameDateIso ?? 0).getTime(),',
'    );',
'  }, [prematch, timeRange, timeToday]);',
    ],
    new: [
'  const { prematch } = useMemo(() => splitLivePrematch(matches, () => false), [matches]);',
'  const selectedMatchIds = useSportsSidebarStore((s) => s.selectedMatchIds);',
'',
'  const visiblePrematch = useMemo(() => {',
'    const scoped = timeToday ? filterByToday(prematch, (m) => m.game.gameDateIso) : prematch;',
'    const inWindow = filterByStartWindow(scoped, timeRange, (m) => m.game.gameDateIso);',
'    const selected = filterBySelection(inWindow, selectedMatchIds, (m) => m.game.id);',
'    return [...selected].sort(',
'      (a, b) => new Date(a.game.gameDateIso ?? 0).getTime() - new Date(b.game.gameDateIso ?? 0).getTime(),',
'    );',
'  }, [prematch, timeRange, timeToday, selectedMatchIds]);',
    ],
  },
];

const importOld = 'import { splitLivePrematch, filterByStartWindow, filterByToday, parseTimeFilter, type MatchViewMode } from "@/lib/match-view";';
const importNew = 'import { splitLivePrematch, filterByStartWindow, filterByToday, filterBySelection, parseTimeFilter, type MatchViewMode } from "@/lib/match-view";';

let applied = 0;
for (const t of spec) {
  let s = fs.readFileSync(t.p, 'utf8');
  const eol = s.includes('\r\n') ? '\r\n' : '\n';
  const io = importOld.replace(/\n/g, eol);
  if (s.includes(io)) { s = s.replace(io, importNew.replace(/\n/g, eol)); applied++; }
  else console.log('IMPORT MISS:', t.p);
  const o = t.old.join('\n').replace(/\n/g, eol);
  const n = t.new.join('\n').replace(/\n/g, eol);
  if (s.includes(o)) { s = s.replace(o, n); applied++; }
  else console.log('EDIT MISS:', t.p);
  fs.writeFileSync(t.p, s, 'utf8');
}
console.log('appliqués ' + applied + '/6');