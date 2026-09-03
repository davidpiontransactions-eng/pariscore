"use client";

import { useState, useMemo, useRef, useCallback, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Star, BarChart2, Search, ArrowDown, RefreshCw } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";
import { CountryFlag } from "@/components/tennis/country-flag";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

/* ──────────────────────────────────────────
 *  Types partagés
 * ────────────────────────────────────────── */

/** Informations minimales sur une compétition/ligue pour le groupement. */
export type FlashscoreLeague = {
  id: string;
  name: string;
  country?: string | null;
  logo?: string;
};

/** Filtres communs à tous les sports. */
export type FlashscoreFilter = "all" | "live" | "favorites" | "value" | "upcoming";

/** Une ligne de match dans la liste Flashscore. */
export type FlashscoreMatchRow = {
  id: string;
  timeDisplay: string;
  isLive: boolean;
  statusDetail?: string;
  homeName: string;
  awayName: string;
  homeRank?: number | null;
  awayRank?: number | null;
  server?: "home" | "away" | null;
  scoreDisplay: string;
  oddsDisplay?: string | null;
  /** ISO timestamp for the match — used by "upcoming" filter. */
  scheduledAt?: string;
  extras?: ReactNode;
};

/** Props du composant principal. */
export type FlashscoreMatchListProps = {
  leagues: Array<{
    league: FlashscoreLeague;
    matches: Array<FlashscoreMatchRow>;
  }>;
  liveCount?: number;
  favCount?: number;
  valueCount?: number;
  /** Matchs prévus dans < 60 min (pour badge filtre "Prochain"). */
  upcomingCount?: number;
  favoriteIds?: Set<string>;
  favoriteLeagueIds?: Set<string>;
  onToggleFavorite?: (matchId: string) => void;
  onToggleLeagueFavorite?: (leagueId: string) => void;
  onOpenDetail?: (matchId: string) => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  /** Callback pour le pull-to-refresh (mobile). */
  onRefresh?: () => void;
  /** Filtre initial (permet de persister le filtre via URL params). */
  initialFilter?: FlashscoreFilter;
  sportLabel?: string;
  className?: string;
};


/* ──────────────────────────────────────────
 *  Sous-composants partagés
 * ────────────────────────────────────────── */

/** Barre de filtres rapides (Live / Favoris / Value / Recherche). */
function FilterBar({
  activeFilter,
  onFilterChange,
  liveCount,
  favCount,
  valueCount,
  upcomingCount,
  searchQuery,
  onSearchChange,
}: {
  activeFilter: FlashscoreFilter;
  onFilterChange: (f: FlashscoreFilter) => void;
  liveCount: number;
  favCount: number;
  valueCount: number;
  upcomingCount: number;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}) {
  const filters: Array<{
    key: FlashscoreFilter; label: string; icon: string; count: number; accent: string;
  }> = [
    { key: "all", label: "Tous", icon: "", count: 0, accent: "" },
    { key: "live", label: "En direct", icon: "⚡", count: liveCount, accent: "bg-rose-500" },
    { key: "upcoming", label: "Prochain", icon: "⏱️", count: upcomingCount, accent: "bg-sky-500" },
    { key: "favorites", label: "Favoris", icon: "⭐", count: favCount, accent: "bg-amber-500" },
    { key: "value", label: "Value Bets", icon: "💎", count: valueCount, accent: "bg-emerald-500" },
  ];

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => onFilterChange(f.key)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              activeFilter === f.key
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-background text-[#D0D0D0] hover:bg-muted hover:text-white",
            )}
          >
            {f.icon && <span aria-hidden>{f.icon}</span>}
            {f.label}
            {f.count > 0 && (
              <span className={cn(
                "ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-xs font-bold tabular-nums",
                activeFilter === f.key ? `${f.accent} text-white` : "bg-muted-foreground/30 text-[#D0D0D0]",
              )}>
                {f.count > 99 ? "99+" : f.count}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          name="search"
          autoComplete="off"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Rechercher…"
          className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-3 text-xs placeholder:text-muted-foreground/60 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring sm:w-48"
          aria-label="Rechercher un joueur ou un club"
        />
      </div>
    </div>
  );
}

/** En-tête de ligue/tournoi — bandeau sombre pliable avec étoile. */
function LeagueHeader({
  league, matchCount, isCollapsed, onToggleCollapse, isFavorite, onToggleFavorite,
}: {
  league: FlashscoreLeague; matchCount: number; isCollapsed: boolean;
  onToggleCollapse: () => void; isFavorite: boolean; onToggleFavorite?: () => void;
}) {
  return (
    <button
      onClick={onToggleCollapse}
      className="flex w-full items-center gap-2 bg-muted/50 px-3 py-2 text-left transition-colors hover:bg-muted/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      aria-expanded={!isCollapsed}
      aria-label={`${league.name} — ${matchCount} match(s)`}
    >
      {isCollapsed ? <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
      {league.country && <CountryFlag countryCode={league.country} size="sm" />}
      {league.logo && !league.country && <span className="text-sm" aria-hidden>{league.logo}</span>}
      <span className="flex-1 truncate text-sm font-bold tracking-tight text-[#F0F0F0]" title={league.name}>{league.name}</span>
      <Badge variant="secondary" className="font-mono text-xs tabular-nums text-white">{matchCount}</Badge>
      {onToggleFavorite && (
        <button onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
          className="rounded p-0.5 transition-colors hover:bg-muted-foreground/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}>
          <Star className={cn("h-3.5 w-3.5", isFavorite ? "fill-amber-400 text-amber-400" : "text-[#A0A0A0]")} />
        </button>
      )}
    </button>
  );
}

/** Une ligne de match compacte (style Flashscore). */
function MatchRow({
  match, isFavorite, onToggleFavorite, onOpenDetail,
}: {
  match: FlashscoreMatchRow; isFavorite: boolean;
  onToggleFavorite?: (id: string) => void; onOpenDetail?: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-border/40 px-3 py-2 text-xs transition-colors hover:bg-muted/30 last:border-b-0">
      <div className="flex w-14 shrink-0 flex-col items-start gap-0.5">
        {match.isLive ? (
          <span className="inline-flex items-center gap-1 rounded bg-rose-500/15 px-1.5 py-0.5 text-xs font-bold text-rose-600 dark:text-rose-400">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />LIVE
          </span>
        ) : (
          <span className="font-mono font-semibold tabular-nums text-[#E0E0E0]">{match.timeDisplay}</span>
        )}
        {match.statusDetail && <span className="text-xs text-muted-foreground">{match.statusDetail}</span>}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-1.5 truncate">
          <span className="truncate font-medium text-[#F0F0F0]">{match.homeName}
            {match.homeRank != null && match.homeRank > 0 && <span className="ml-1 text-xs text-[#B0B0B0]">#{match.homeRank}</span>}
          </span>
          {match.server === "home" && <span className="inline-block h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-emerald-400" title="Au service" />}
        </div>
        <div className="flex items-center gap-1.5 truncate">
          <span className="truncate text-[#E0E0E0]">{match.awayName}
            {match.awayRank != null && match.awayRank > 0 && <span className="ml-1 text-xs text-[#A0A0A0]">#{match.awayRank}</span>}
          </span>
          {match.server === "away" && <span className="inline-block h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-emerald-400" title="Au service" />}
        </div>
      </div>
      <div className="flex w-[88px] shrink-0 items-center justify-center font-mono text-sm font-bold tabular-nums tracking-tight text-[#F0F0F0]">
        {match.scoreDisplay || "-"}
      </div>
      <div className="hidden w-[72px] shrink-0 text-center sm:block">
        {match.oddsDisplay ? (
          <span className="font-mono text-xs font-semibold tabular-nums text-[#F0F0F0]">{match.oddsDisplay}</span>
        ) : <span className="text-xs text-muted-foreground/40">—</span>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {onToggleFavorite && (
          <button onClick={(e) => { e.stopPropagation(); onToggleFavorite(match.id); }}
            className="rounded p-2 min-w-[44px] min-h-[44px] transition-colors hover:bg-muted-foreground/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}>
            <Star className={cn("h-3.5 w-3.5", isFavorite ? "fill-amber-400 text-amber-400" : "text-[#C8C8C8]")} />
          </button>
        )}
        {onOpenDetail && (
          <button onClick={(e) => { e.stopPropagation(); onOpenDetail(match.id); }}
            className="rounded p-2 min-w-[44px] min-h-[44px] text-[#B0B0B0] transition-colors hover:bg-muted-foreground/15 hover:text-[#F0F0F0] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Voir les stats détaillées">
            <BarChart2 className="h-3.5 w-3.5" />
          </button>
        )}
        {match.extras}
      </div>
    </div>
  );
}



/* ──────────────────────────────────────────
 *  Squelettes
 * ────────────────────────────────────────── */

function LeagueSkeleton() {
  return (
    <div className="border-b border-border/40">
      <div className="flex items-center gap-2 bg-muted/30 px-3 py-2">
        <Skeleton className="h-4 w-4" /><Skeleton className="h-4 w-32" />
        <Skeleton className="ml-auto h-4 w-8 rounded-full" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-2 border-b border-border/30 px-3 py-2.5 last:border-b-0">
          <Skeleton className="h-3 w-12" />
          <div className="min-w-0 flex-1 space-y-1.5"><Skeleton className="h-3 w-28" /><Skeleton className="h-3 w-20" /></div>
          <Skeleton className="h-4 w-16" /><Skeleton className="h-4 w-12" /><Skeleton className="h-4 w-4" />
        </div>
      ))}
    </div>
  );
}

export function FlashscoreSkeleton() {
  return (
    <div
      className="space-y-1 rounded-lg border border-border/60"
      role="status"
      aria-busy="true"
      aria-label="Chargement des matchs"
    >
      {[0, 1, 2].map((i) => <LeagueSkeleton key={i} />)}
    </div>
  );
}

/* ──────────────────────────────────────────
 *  Composant principal
 * ────────────────────────────────────────── */

export function FlashscoreMatchList({
  leagues, liveCount = 0, favCount = 0, valueCount = 0, upcomingCount = 0,
  favoriteIds, favoriteLeagueIds, onToggleFavorite,
  onToggleLeagueFavorite, onOpenDetail,
  searchQuery = "", onSearchChange, isLoading, error, onRetry,
  onRefresh, initialFilter,
  sportLabel = "Matchs", className,
}: FlashscoreMatchListProps) {
  const [filter, setFilter] = useState<FlashscoreFilter>(initialFilter ?? "all");
  const [collapsedLeagues, setCollapsedLeagues] = useState<Set<string>>(new Set());
  const [pullState, setPullState] = useState<"idle" | "pulling" | "ready">("idle");
  const [pullDistance, setPullDistance] = useState(0);
  const pullStartY = useRef(0);
  const pullCurrentY = useRef(0);
  const isPulling = useRef(false);
  const noopRef = useRef<(_q: string) => void>(() => {});
  const onSearchChangeStable = onSearchChange ?? noopRef.current;

  const toggleLeague = (id: string) => {
    setCollapsedLeagues((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filteredLeagues = useMemo(() => {
    let result = leagues;
    if (filter === "live") {
      result = result.map((lg) => ({
        ...lg, matches: lg.matches.filter((m) => m.isLive),
      })).filter((lg) => lg.matches.length > 0);
    }
    if (filter === "favorites" && favoriteIds) {
      result = result.map((lg) => ({
        ...lg, matches: lg.matches.filter((m) => favoriteIds.has(m.id)),
      })).filter((lg) => lg.matches.length > 0);
    }
    if (filter === "value") {
      result = result.map((lg) => ({
        ...lg, matches: lg.matches.filter((m) => m.oddsDisplay != null),
      })).filter((lg) => lg.matches.length > 0);
    }
    if (filter === "upcoming") {
      const now = Date.now();
      const oneHour = 60 * 60 * 1000;
      result = result.map((lg) => ({
        ...lg, matches: lg.matches.filter((m) => {
          if (!m.scheduledAt) return false;
          const t = new Date(m.scheduledAt).getTime();
          return t > now && t <= now + oneHour;
        }),
      })).filter((lg) => lg.matches.length > 0);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.map((lg) => ({
        ...lg, matches: lg.matches.filter((m) =>
          m.homeName.toLowerCase().includes(q) || m.awayName.toLowerCase().includes(q)),
      })).filter((lg) => lg.matches.length > 0);
    }
    return result;
  }, [leagues, filter, searchQuery, favoriteIds]);

  const totalMatches = filteredLeagues.reduce((s, lg) => s + lg.matches.length, 0);

  // Flatten leagues into a single array for virtual scrolling.
  // Each item is either a league header or a match row.
  type FlatRow =
    | { type: "header"; leagueId: string; league: FlashscoreLeague; matchCount: number }
    | { type: "match"; matchId: string; match: FlashscoreMatchRow; leagueId: string };

  const flatRows = useMemo<FlatRow[]>(() => {
    const rows: FlatRow[] = [];
    for (const { league, matches } of filteredLeagues) {
      rows.push({ type: "header", leagueId: league.id, league, matchCount: matches.length });
      const collapsed = collapsedLeagues.has(league.id);
      if (!collapsed) {
        for (const m of matches) {
          rows.push({ type: "match", matchId: m.id, match: m, leagueId: league.id });
        }
      }
    }
    return rows;
  }, [filteredLeagues, collapsedLeagues]);

  // Virtualizer — estimate 40px for headers, 48px for match rows
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => (flatRows[i].type === "header" ? 40 : 48),
    overscan: 8,
  });

  const isLeagueFav = (leagueId: string) => favoriteLeagueIds?.has(leagueId) ?? false;

  // ── Pull-to-refresh (mobile) ──
  const PULL_THRESHOLD = 64;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const el = scrollRef.current;
    if (!el || el.scrollTop > 0) return;
    isPulling.current = true;
    pullStartY.current = e.touches[0].clientY;
    pullCurrentY.current = e.touches[0].clientY;
    setPullState("pulling");
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling.current) return;
    pullCurrentY.current = e.touches[0].clientY;
    const dist = Math.max(0, pullCurrentY.current - pullStartY.current);
    setPullDistance(dist);
    setPullState(dist >= PULL_THRESHOLD ? "ready" : "pulling");
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isPulling.current) return;
    isPulling.current = false;
    if (pullDistance >= PULL_THRESHOLD && onRefresh) {
      onRefresh();
    }
    setPullDistance(0);
    setPullState("idle");
  }, [pullDistance, onRefresh]);

  return (
    <div className={cn("space-y-4", className)}>
      <FilterBar
        activeFilter={filter} onFilterChange={setFilter}
        liveCount={liveCount} favCount={favCount} valueCount={valueCount} upcomingCount={upcomingCount}
        searchQuery={searchQuery} onSearchChange={onSearchChangeStable}
      />

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-rose-500/40 bg-rose-500/5 p-4 text-sm text-rose-700 dark:text-rose-300">
          <span className="mt-0.5 shrink-0">⚠️</span>
          <div>
            <p className="font-semibold">Erreur de chargement</p>
            <p className="mt-0.5 text-xs">{error}</p>
            {onRetry && <button onClick={onRetry} className="mt-2 underline font-semibold">Réessayer</button>}
          </div>
        </div>
      )}

      {isLoading && <FlashscoreSkeleton />}

      {!isLoading && (
        <div className="overflow-hidden rounded-lg border border-border/60">
          {filteredLeagues.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <BarChart2 className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">
                {filter !== "all" ? "Aucun match ne correspond à ce filtre" : `Aucun ${sportLabel.toLowerCase()} aujourd'hui`}
              </p>
              <p className="text-xs text-muted-foreground">Essayez un autre filtre ou revenez plus tard.</p>
            </div>
          ) : (
            <div className="relative">
              {/* Pull-to-refresh indicator */}
              {onRefresh && pullState !== "idle" && (
                <div
                  className="flex items-center justify-center gap-2 overflow-hidden border-b border-border/40 bg-muted/30 transition-all duration-200"
                  style={{ height: `${Math.min(pullDistance, PULL_THRESHOLD + 32)}px` }}
                >
                  {pullState === "ready" ? (
                    <>
                      <ArrowDown className="h-4 w-4 animate-bounce-soft text-emerald-400" />
                      <span className="text-xs font-semibold text-emerald-400">Relâcher pour actualiser</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Tirer pour actualiser</span>
                    </>
                  )}
                </div>
              )}
              <div
                ref={scrollRef}
                className="max-h-[calc(100vh-280px)] overflow-y-auto scrollable-list"
                onTouchStart={onRefresh ? handleTouchStart : undefined}
                onTouchMove={onRefresh ? handleTouchMove : undefined}
                onTouchEnd={onRefresh ? handleTouchEnd : undefined}
              >
              <div
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  width: "100%",
                  position: "relative",
                }}
              >
                {virtualizer.getVirtualItems().map((vi) => {
                  const row = flatRows[vi.index];
                  return (
                    <div
                      key={vi.key}
                      data-index={vi.index}
                      ref={virtualizer.measureElement}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${vi.start}px)`,
                      }}
                    >
                      {row.type === "header" ? (
                        <LeagueHeader
                          league={row.league}
                          matchCount={row.matchCount}
                          isCollapsed={collapsedLeagues.has(row.leagueId)}
                          onToggleCollapse={() => toggleLeague(row.leagueId)}
                          isFavorite={isLeagueFav(row.leagueId)}
                          onToggleFavorite={onToggleLeagueFavorite ? () => onToggleLeagueFavorite(row.leagueId) : undefined}
                        />
                      ) : (
                        <MatchRow
                          match={row.match}
                          isFavorite={favoriteIds?.has(row.matchId) ?? false}
                          onToggleFavorite={onToggleFavorite}
                          onOpenDetail={onOpenDetail}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            </div>
          )}
        </div>
      )}

      {!isLoading && !error && filteredLeagues.length > 0 && (
        <p className="text-center text-xs text-muted-foreground/60">
          {filteredLeagues.length} compétition(s) · {totalMatches} match(s)
          {filter !== "all" && ` (filtré: ${filter})`}
        </p>
      )}
    </div>
  );
}

