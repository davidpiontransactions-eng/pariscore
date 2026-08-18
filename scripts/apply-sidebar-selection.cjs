// Modifications sidebar (CRLF-safe) — chaînes construites sans template literals
// pour éviter le conflit avec les ${} du code TSX.
const fs = require('fs');
const p = 'src/components/layout/sports-sidebar.tsx';
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

// 1a) MatchRow : lire la sélection depuis le store.
rep(
[
'  const t = useTranslations("sportsSidebar");',
'',
'  const openDetail = (pick?: string) => {',
],
[
'  const t = useTranslations("sportsSidebar");',
'  const isSelected = useSportsSidebarStore((s) => s.selectedMatchIds.includes(match.id));',
'  const toggleSelection = useSportsSidebarStore((s) => s.toggleMatchSelection);',
'',
'  const openDetail = (pick?: string) => {',
]
);

// 1b) Ligne du match : fond sélection + clic nom = toggle sélection.
rep(
[
'  return (',
'    <div className="flex w-full items-center gap-1.5 rounded px-1 py-1 pl-0 text-[11px] text-slate-400 hover:bg-slate-800/80">',
'      {match.isLive ? (',
'        <span aria-hidden className="ml-1 h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-red-500" />',
'      ) : (',
'        <span className="ml-1 w-8 shrink-0 font-mono text-[10px] tabular-nums text-slate-500">',
'          {formatKickoff(match.scheduledAt)}',
'        </span>',
'      )}',
'      <button',
'        type="button"',
'        onClick={() => openDetail()}',
'        title={t("level4Open")}',
'        className="min-w-0 flex-1 truncate rounded px-1 text-left transition-colors hover:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"',
'      >',
'        {match.homeName}',
'        {match.awayName ? ` – ${match.awayName}` : ""}',
'      </button>',
],
[
'  return (',
'    <div',
'      className={cn(',
'        "flex w-full items-center gap-1.5 rounded px-1 py-1 pl-0 text-[11px]",',
'        isSelected',
'          ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/40"',
'          : "text-slate-400 hover:bg-slate-800/80",',
'      )}',
'    >',
'      {match.isLive ? (',
'        <span aria-hidden className="ml-1 h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-red-500" />',
'      ) : (',
'        <span className="ml-1 w-8 shrink-0 font-mono text-[10px] tabular-nums text-slate-500">',
'          {formatKickoff(match.scheduledAt)}',
'        </span>',
'      )}',
'      <button',
'        type="button"',
'        onClick={() => toggleSelection(match.id)}',
'        title={isSelected ? t("selectionRemove") : t("selectionAdd")}',
'        aria-pressed={isSelected}',
'        className="min-w-0 flex-1 truncate rounded px-1 text-left transition-colors hover:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"',
'      >',
'        {isSelected ? "✓ " : ""}',
'        {match.homeName}',
'        {match.awayName ? ` – ${match.awayName}` : ""}',
'      </button>',
]
);

// 2a) SportsSidebarContent : lire selectedMatchIds + clearMatchSelection.
rep(
[
'  const searchQuery = useSportsSidebarStore((s) => s.searchQuery);',
'  const timeFilter = useSportsSidebarStore((s) => s.selectedTimeFilter);',
'  const selectedLeagueId = useSportsSidebarStore((s) => s.selectedLeagueId);',
'  const selectLeague = useSportsSidebarStore((s) => s.selectLeague);',
],
[
'  const searchQuery = useSportsSidebarStore((s) => s.searchQuery);',
'  const timeFilter = useSportsSidebarStore((s) => s.selectedTimeFilter);',
'  const selectedLeagueId = useSportsSidebarStore((s) => s.selectedLeagueId);',
'  const selectLeague = useSportsSidebarStore((s) => s.selectLeague);',
'  const selectedMatchIds = useSportsSidebarStore((s) => s.selectedMatchIds);',
'  const clearMatchSelection = useSportsSidebarStore((s) => s.clearMatchSelection);',
]
);

// 2b) Bandeau sélection juste avant ScrollArea.
rep(
[
'      <ScrollArea className="min-h-0 flex-1">',
'        <div className="space-y-1 p-1.5">',
'          <QuickLinksBlock tree={tree} onFallbackSport={handleSportSelect} />',
],
[
'      {selectedMatchIds.length > 0 ? (',
'        <div className="flex items-center justify-between gap-2 border-b border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5">',
'          <span className="text-[11px] font-semibold text-emerald-300">',
'            {selectedMatchIds.length} match{selectedMatchIds.length > 1 ? "s" : ""} sélectionné{selectedMatchIds.length > 1 ? "s" : ""}',
'          </span>',
'          <button',
'            type="button"',
'            onClick={clearMatchSelection}',
'            className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"',
'          >',
'            {t("selectionClear")}',
'          </button>',
'        </div>',
'      ) : null}',
'',
'      <ScrollArea className="min-h-0 flex-1">',
'        <div className="space-y-1 p-1.5">',
'          <QuickLinksBlock tree={tree} onFallbackSport={handleSportSelect} />',
]
);

fs.writeFileSync(p, s, 'utf8');
console.log('appliqués ' + ok + '/4');