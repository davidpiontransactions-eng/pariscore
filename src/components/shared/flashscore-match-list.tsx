"use client";

import { useState, useMemo, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Star, BarChart2, Search } from "lucide-react";
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
export type FlashscoreFilter = "all" | "live" | "favorites" | "value";

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
  searchQuery,
  onSearchChange,
}: {
  activeFilter: FlashscoreFilter;
  onFilterChange: (f: FlashscoreFilter) => void;
  liveCount: number;
  favCount: number;
  valueCount: number;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}) {
  const filters: Array<{
    key: FlashscoreFilter; label: string; icon: string; count: number; accent: string;
  }> = [
    { key: "all", label: "Tous", icon: "", count: 0, accent: "" },
    { key: "live", label: "En direct", icon: "⚡", count: liveCount, accent: "bg-rose-500" },
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
                "ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums",
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
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Rechercher..."
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
      <span className="flex-1 truncate text-sm font-bold tracking-tight text-[#F0F0F0]">{league.name}</span>
      <Badge variant="secondary" className="font-mono text-[10px] tabular-nums text-white">{matchCount}</Badge>
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
          <span className="inline-flex items-center gap-1 rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />LIVE
          </span>
        ) : (
          <span className="font-mono font-semibold tabular-nums text-[#E0E0E0]">{match.timeDisplay}</span>
        )}
        {match.statusDetail && <span className="text-[10px] text-muted-foreground">{match.statusDetail}</span>}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-1.5 truncate">
          <span className="truncate font-medium text-[#F0F0F0]">{match.homeName}
            {match.homeRank != null && match.homeRank > 0 && <span className="ml-1 text-[10px] text-[#B0B0B0]">#{match.homeRank}</span>}
          </span>
          {match.server === "home" && <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" title="Au service" />}
        </div>
        <div className="flex items-center gap-1.5 truncate">
          <span className="truncate text-[#E0E0E0]">{match.awayName}
            {match.awayRank != null && match.awayRank > 0 && <span className="ml-1 text-[10px] text-[#A0A0A0]">#{match.awayRank}</span>}
          </span>
          {match.server === "away" && <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" title="Au service" />}
        </div>
      </div>
      <div className="flex w-[88px] shrink-0 items-center justify-center font-mono text-sm font-bold tabular-nums tracking-tight text-[#F0F0F0]">
        {match.scoreDisplay || "-"}
      </div>
      <div className="hidden w-[72px] shrink-0 text-center sm:block">
        {match.oddsDisplay ? (
          <span className="font-mono text-[11px] font-semibold tabular-nums text-[#F0F0F0]">{match.oddsDisplay}</span>
        ) : <span className="text-[10px] text-muted-foreground/40">—</span>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {onToggleFavorite && (
          <button onClick={(e) => { e.stopPropagation(); onToggleFavorite(match.id); }}
            className="rounded p-1 transition-colors hover:bg-muted-foreground/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}>
            <Star className={cn("h-3.5 w-3.5", isFavorite ? "fill-amber-400 text-amber-400" : "text-[#B0B0B0]")} />
          </button>
        )}
        {onOpenDetail && (
          <button onClick={(e) => { e.stopPropagation(); onOpenDetail(match.id); }}
            className="rounded p-1 text-[#B0B0B0] transition-colors hover:bg-muted-foreground/15 hover:text-[#F0F0F0] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
    <div className="space-y-1 rounded-lg border border-border/60">
      {[0, 1, 2].map((i) => <LeagueSkeleton key={i} />)}
    </div>
  );
}

/* ──────────────────────────────────────────
 *  Composant principal
 * ────────────────────────────────────────── */

export function FlashscoreMatchList({
  leagues, liveCount = 0, favCount = 0, valueCount = 0,
  favoriteIds, favoriteLeagueIds, onToggleFavorite,
  onToggleLeagueFavorite, onOpenDetail,
  searchQuery = "", onSearchChange, isLoading, error, onRetry,
  sportLabel = "Matchs", className,
}: FlashscoreMatchListProps) {
  const [filter, setFilter] = useState<FlashscoreFilter>("all");
  const [collapsedLeagues, setCollapsedLeagues] = useState<Set<string>>(new Set());

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

  return (
    <div className={cn("space-y-4", className)}>
      <FilterBar
        activeFilter={filter} onFilterChange={setFilter}
        liveCount={liveCount} favCount={favCount} valueCount={valueCount}
        searchQuery={searchQuery} onSearchChange={onSearchChange ?? (() => {})}
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
            filteredLeagues.map(({ league, matches }) => {
              const isCollapsed = collapsedLeagues.has(league.id);
              const isLeagueFav = favoriteLeagueIds?.has(league.id) ?? false;
              return (
                <div key={league.id}>
                  <LeagueHeader
                    league={league} matchCount={matches.length}
                    isCollapsed={isCollapsed} onToggleCollapse={() => toggleLeague(league.id)}
                    isFavorite={isLeagueFav}
                    onToggleFavorite={onToggleLeagueFavorite ? () => onToggleLeagueFavorite(league.id) : undefined}
                  />
                  {!isCollapsed && matches.map((match) => (
                    <MatchRow key={match.id} match={match}
                      isFavorite={favoriteIds?.has(match.id) ?? false}
                      onToggleFavorite={onToggleFavorite} onOpenDetail={onOpenDetail}
                    />
                  ))}
                </div>
              );
            })
          )}
        </div>
      )}

      {!isLoading && !error && filteredLeagues.length > 0 && (
        <p className="text-center text-[10px] text-muted-foreground/60">
          {filteredLeagues.length} compétition(s) · {totalMatches} match(s)
          {filter !== "all" && ` (filtré: ${filter})`}
        </p>
      )}
    </div>
  );
}

