"use client";

import { useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  Activity,
  Bike,
  ChevronRight,
  Crosshair,
  Dribbble,
  Flag,
  ListFilter,
  Search,
  Shield,
  Swords,
  Trophy,
  Volleyball,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getFlagEmoji, getFlagUrl } from "@/lib/flag-utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { TIME_RANGE_OPTIONS, type MatchViewMode } from "@/lib/match-view";
import { applyTimeFilter, filterTreeByQuery } from "@/lib/sports-tree";
import type {
  CountryNode,
  LeagueNode,
  SportNode,
  SportTabId,
  TreeMatchSummary,
} from "@/types/sports-sidebar";
import {
  hydrateStoreFromUrl,
  syncStoreToUrl,
  useSportsSidebarStore,
} from "@/stores/use-sports-sidebar-store";
import { useSportsTree } from "@/hooks/use-sports-tree";

const SPORT_ICONS: Record<string, LucideIcon> = {
  Trophy,
  Activity,
  Crosshair,
  Dribbble,
  Swords,
  Bike,
  Flag,
  Volleyball,
  Shield,
};

/** Favoris par défaut tant que l'utilisateur n'a pas personnalisé. */
const DEFAULT_FAVORITE_PATTERNS = [
  "champions league",
  "premier league",
  "ligue 1",
  "grand slam",
];

function isDefaultFavorite(league: LeagueNode): boolean {
  if (league.id === "nba:nba") return true;
  const name = league.name.toLowerCase();
  return DEFAULT_FAVORITE_PATTERNS.some((p) => name.includes(p));
}

function formatKickoff(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ---------------------------------------------------------------------------
// Bloc 5 — Toggle Live / Avant-match (Line)
// ---------------------------------------------------------------------------

function LiveLineToggle({ sportId }: { sportId: string }) {
  const t = useTranslations("sportsSidebar");
  const mode = useSportsSidebarStore((s) => s.modes[sportId] ?? "live");
  const setMode = useSportsSidebarStore((s) => s.setMode);

  const options: Array<{ value: MatchViewMode; label: string }> = [
    { value: "live", label: t("live") },
    { value: "prematch", label: t("prematch") },
  ];

  return (
    <div
      role="group"
      aria-label={t("modeAria")}
      className="grid grid-cols-2 gap-1 rounded-lg bg-slate-900 p-1"
    >
      {options.map((opt) => {
        const active = mode === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => setMode(sportId, opt.value)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? "bg-slate-700 text-white shadow-sm" : "text-slate-400 hover:text-slate-200",
            )}
          >
            {opt.value === "live" ? (
              <span
                aria-hidden
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  active ? "animate-pulse bg-red-500" : "bg-slate-600",
                )}
              />
            ) : null}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bloc 1 — Recherche rapide
// ---------------------------------------------------------------------------

function SearchBar() {
  const t = useTranslations("sportsSidebar");
  const searchQuery = useSportsSidebarStore((s) => s.searchQuery);
  const setSearchQuery = useSportsSidebarStore((s) => s.setSearchQuery);

  return (
    <div className="relative">
      <Search
        aria-hidden
        className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500"
      />
      <input
        type="search"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder={t("searchPlaceholder")}
        aria-label={t("searchPlaceholder")}
        className={cn(
          "h-8 w-full rounded-md border border-slate-700/60 bg-slate-900 pl-8 pr-7 text-xs text-slate-200",
          "placeholder:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      />
      {searchQuery ? (
        <button
          type="button"
          onClick={() => setSearchQuery("")}
          aria-label={t("searchClear")}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-500 hover:text-slate-200"
        >
          <X aria-hidden className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bloc 2 — Filtre temporel (pills)
// ---------------------------------------------------------------------------

function TimePills() {
  const t = useTranslations("sportsSidebar");
  const selected = useSportsSidebarStore((s) => s.selectedTimeFilter);
  const setTimeFilter = useSportsSidebarStore((s) => s.setTimeFilter);

  const options = [
    { key: "all" as const, label: t("timeAll") },
    ...TIME_RANGE_OPTIONS.map((hours) => ({
      key: `${hours}h` as const,
      label: t("timeHour", { hours }),
    })),
    { key: "today" as const, label: t("timeToday") },
  ];

  return (
    <div
      role="group"
      aria-label={t("timeAria")}
      className="flex items-center gap-1 overflow-x-auto scrollbar-none"
    >
      {options.map((opt) => {
        const active = selected === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            aria-pressed={active}
            onClick={() => setTimeFilter(opt.key)}
            className={cn(
              "shrink-0 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-emerald-600 text-white"
                : "bg-slate-800/80 text-slate-400 hover:bg-slate-700/80 hover:text-slate-200",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Briques partagées
// ---------------------------------------------------------------------------

function CountBadge({ n, live }: { n: number; live?: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-1.5 py-0.5 font-mono text-[10px] leading-none tabular-nums",
        live ? "bg-red-500/15 text-red-400" : "bg-slate-800 text-slate-400",
      )}
    >
      {n}
    </span>
  );
}

function FavoriteStar({ league }: { league: LeagueNode }) {
  const t = useTranslations("sportsSidebar");
  const favoriteIds = useSportsSidebarStore((s) => s.favoriteLeagueIds);
  const customized = useSportsSidebarStore((s) => s.favoritesCustomized);
  const toggleFavorite = useSportsSidebarStore((s) => s.toggleFavoriteLeague);
  const isFav = customized ? favoriteIds.includes(league.id) : isDefaultFavorite(league);

  return (
    <button
      type="button"
      aria-label={t("toggleFavorite")}
      aria-pressed={isFav}
      onClick={(e) => {
        e.stopPropagation();
        toggleFavorite(league.id);
      }}
      className={cn(
        "rounded p-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isFav ? "text-amber-400" : "text-slate-600 hover:text-slate-300",
      )}
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5"
        fill={isFav ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    </button>
  );
}

function CountryFlag({ code, name }: { code: string; name: string }) {
  if (!code || code === "INT") {
    return (
      <span aria-hidden className="text-[13px] leading-none">
        🌐
      </span>
    );
  }
  return (
    <img
      src={getFlagUrl(code, 24, 18)}
      alt={name}
      loading="lazy"
      className="h-[11px] w-4 shrink-0 rounded-[2px] object-cover"
      onError={(e) => {
        e.currentTarget.replaceWith(
          Object.assign(document.createElement("span"), {
            textContent: getFlagEmoji(code),
            className: "text-[13px] leading-none",
          }),
        );
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Bloc 4 — Niveau 4 (matchs), 3 (ligues), 2 (pays), 1 (sports)
// ---------------------------------------------------------------------------

function MatchRow({
  match,
  league,
  onFallbackSport,
}: {
  match: TreeMatchSummary;
  league: LeagueNode;
  onFallbackSport: () => void;
}) {
  const t = useTranslations("sportsSidebar");

  const handleClick = () => {
    const sport = league.sportId;
    if (sport === "football" || sport === "tennis") {
      window.dispatchEvent(
        new CustomEvent("open-match-detail", {
          detail: { sport, matchId: match.id },
        }),
      );
    } else {
      onFallbackSport();
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={t("level4Open")}
      className={cn(
        "flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-[11px] text-slate-400",
        "transition-colors hover:bg-slate-800/80 hover:text-slate-200",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {match.isLive ? (
        <span aria-hidden className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-red-500" />
      ) : (
        <span className="w-8 shrink-0 font-mono text-[10px] tabular-nums text-slate-500">
          {formatKickoff(match.scheduledAt)}
        </span>
      )}
      <span className="truncate">
        {match.homeName}
        {match.awayName ? ` – ${match.awayName}` : ""}
      </span>
    </button>
  );
}

function LeagueRow({
  league,
  expanded,
  onToggle,
  selected,
  onSelect,
  onFallbackSport,
}: {
  league: LeagueNode;
  expanded: boolean;
  onToggle: () => void;
  selected: boolean;
  onSelect: () => void;
  onFallbackSport: () => void;
}) {
  const hasMatches = (league.matches?.length ?? 0) > 0;

  return (
    <li>
      <div
        className={cn(
          "flex w-full items-center gap-1.5 rounded-md py-1.5 pl-8 pr-2 text-left",
          "transition-colors",
          selected
            ? "border-l-2 border-emerald-400 bg-emerald-500/15 font-semibold text-emerald-300"
            : "border-l-2 border-transparent text-slate-300 hover:bg-slate-800/80",
        )}
      >
        {hasMatches ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-label={league.name}
            className="-ml-1 rounded p-0.5 text-slate-500 hover:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRight
              aria-hidden
              className={cn("h-3 w-3 transition-transform", expanded && "rotate-90")}
            />
          </button>
        ) : (
          <span className="-ml-1 inline-block h-4 w-4" aria-hidden />
        )}
        <button
          type="button"
          onClick={onSelect}
          className="min-w-0 flex-1 truncate rounded text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {league.name}
        </button>
        <CountBadge n={league.matchCount} />
        <FavoriteStar league={league} />
      </div>
      {expanded && hasMatches ? (
        <ul className="space-y-0.5 pb-1 pl-9 pr-1">
          {league.matches!.map((m) => (
            <li key={m.id}>
              <MatchRow match={m} league={league} onFallbackSport={onFallbackSport} />
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function CountryBlock({
  country,
  selectedLeagueId,
  onLeagueSelect,
  onSportSelect,
}: {
  country: CountryNode;
  selectedLeagueId: string | null;
  onLeagueSelect: (league: LeagueNode) => void;
  onSportSelect: (sportId: SportTabId) => void;
}) {
  const expanded = useSportsSidebarStore((s) => !!s.expandedCountries[country.id]);
  const expandedLeagues = useSportsSidebarStore((s) => s.expandedLeagues);
  const toggleCountry = useSportsSidebarStore((s) => s.toggleCountry);
  const toggleLeague = useSportsSidebarStore((s) => s.toggleLeague);

  return (
    <li>
      <button
        type="button"
        onClick={() => toggleCountry(country.id)}
        aria-expanded={expanded}
        className={cn(
          "flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 pl-5 text-left",
          "text-slate-300 transition-colors hover:bg-slate-800/80",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <ChevronRight
          aria-hidden
          className={cn("h-3 w-3 shrink-0 text-slate-500 transition-transform", expanded && "rotate-90")}
        />
        <CountryFlag code={country.countryCode} name={country.name} />
        <span className="min-w-0 flex-1 truncate text-xs font-medium">{country.name}</span>
        <CountBadge n={country.leagues.reduce((n, l) => n + l.matchCount, 0)} />
      </button>
      {expanded ? (
        <ul className="space-y-0.5 pb-1">
          {country.leagues.map((league) => (
            <LeagueRow
              key={league.id}
              league={league}
              expanded={!!expandedLeagues[league.id]}
              onToggle={() => toggleLeague(league.id)}
              selected={selectedLeagueId === league.id}
              onSelect={() => onLeagueSelect(league)}
              onFallbackSport={() => onSportSelect(league.sportId as SportTabId)}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function SportBlock({
  sport,
  selectedLeagueId,
  onLeagueSelect,
  onSportSelect,
}: {
  sport: SportNode;
  selectedLeagueId: string | null;
  onLeagueSelect: (league: LeagueNode) => void;
  onSportSelect: (sportId: SportTabId) => void;
}) {
  const t = useTranslations("sportsSidebar");
  const expanded = useSportsSidebarStore((s) => !!s.expandedSports[sport.id]);
  const toggleSport = useSportsSidebarStore((s) => s.toggleSport);
  const Icon = SPORT_ICONS[sport.icon] ?? Trophy;
  const sportLabel = t(`sport.${sport.id}`) || sport.name;

  return (
    <li>
      <button
        type="button"
        onClick={() => toggleSport(sport.id)}
        aria-expanded={expanded}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left",
          "transition-colors hover:bg-slate-800/80",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <Icon aria-hidden className="h-4 w-4 shrink-0 text-emerald-400" />
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-200">
          {sportLabel}
        </span>
        {sport.liveMatches > 0 ? <CountBadge n={sport.liveMatches} live /> : null}
        <CountBadge n={sport.totalMatches} />
        <ChevronRight
          aria-hidden
          className={cn("h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform", expanded && "rotate-90")}
        />
      </button>
      {expanded ? (
        <ul className="space-y-0.5 pb-1">
          {sport.countries.map((country) => (
            <CountryBlock
              key={country.id}
              country={country}
              selectedLeagueId={selectedLeagueId}
              onLeagueSelect={onLeagueSelect}
              onSportSelect={onSportSelect}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Bloc 3 — Favoris & Top championnats
// ---------------------------------------------------------------------------

function FavoritesBlock({
  tree,
  onLeagueSelect,
}: {
  tree: SportNode[];
  onLeagueSelect: (league: LeagueNode) => void;
}) {
  const t = useTranslations("sportsSidebar");
  const favoriteIds = useSportsSidebarStore((s) => s.favoriteLeagueIds);
  const customized = useSportsSidebarStore((s) => s.favoritesCustomized);

  const favorites = useMemo(() => {
    const found: LeagueNode[] = [];
    for (const sport of tree) {
      for (const country of sport.countries) {
        for (const league of country.leagues) {
          const isFav = customized
            ? favoriteIds.includes(league.id)
            : isDefaultFavorite(league);
          if (isFav) found.push(league);
        }
      }
    }
    return found.slice(0, 10);
  }, [tree, favoriteIds, customized]);

  if (favorites.length === 0) return null;

  return (
    <section aria-label={t("favorites")} className="border-b border-slate-800/80 pb-2">
      <h2 className="px-2.5 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {t("favorites")}
      </h2>
      <ul className="space-y-0.5">
        {favorites.map((league) => (
          <li
            key={league.id}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1 hover:bg-slate-800/80"
          >
            <button
              type="button"
              onClick={() => onLeagueSelect(league)}
              className="min-w-0 flex-1 truncate rounded text-left text-xs font-medium text-slate-300 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {league.name}
            </button>
            <CountBadge n={league.matchCount} />
            <FavoriteStar league={league} />
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Conteneur des 5 blocs (partagé desktop / drawer mobile)
// ---------------------------------------------------------------------------

export function SportsSidebarContent({
  activeSport,
  onSportChange,
  onNavigate,
}: {
  /** Onglet sport actuellement affiché au centre. */
  activeSport: string;
  /** Bascule l'onglet central (appelée quand la sélection change de sport). */
  onSportChange: (sportId: SportTabId) => void;
  /** Ferme le drawer mobile après navigation. */
  onNavigate?: () => void;
}) {
  const t = useTranslations("sportsSidebar");
  const { data: treeData } = useSportsTree();

  const searchQuery = useSportsSidebarStore((s) => s.searchQuery);
  const timeFilter = useSportsSidebarStore((s) => s.selectedTimeFilter);
  const selectedLeagueId = useSportsSidebarStore((s) => s.selectedLeagueId);
  const selectLeague = useSportsSidebarStore((s) => s.selectLeague);

  const tree = useMemo(() => {
    const base = treeData ?? [];
    return filterTreeByQuery(applyTimeFilter(base, timeFilter), searchQuery);
  }, [treeData, timeFilter, searchQuery]);

  const handleLeagueSelect = (league: LeagueNode) => {
    const sportId = league.sportId as SportTabId;
    selectLeague(league.id, sportId);
    if (sportId !== activeSport) onSportChange(sportId);
    onNavigate?.();
  };

  const handleSportSelect = (sportId: SportTabId) => {
    if (sportId !== activeSport) onSportChange(sportId);
    onNavigate?.();
  };

  const hasAnyMatch = tree.some((s) => s.totalMatches > 0);

  return (
    <div className="flex h-full w-full flex-col bg-[#0F172A] text-slate-200">
      <div className="space-y-2 border-b border-slate-800/80 p-2.5">
        <LiveLineToggle sportId={activeSport || "football"} />
        <SearchBar />
        <TimePills />
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-1 p-1.5">
          <FavoritesBlock tree={tree} onLeagueSelect={handleLeagueSelect} />
          {tree.length === 0 || !hasAnyMatch ? (
            <div className="px-2.5 py-6 text-center">
              <p className="text-xs font-medium text-slate-400">{t("emptyTree")}</p>
              <p className="mt-1 text-[11px] text-slate-500">{t("emptyTreeHint")}</p>
            </div>
          ) : (
            <ul className="space-y-0.5">
              {tree.map((sport) => (
                <SportBlock
                  key={sport.id}
                  sport={sport}
                  selectedLeagueId={selectedLeagueId}
                  onLeagueSelect={handleLeagueSelect}
                  onSportSelect={handleSportSelect}
                />
              ))}
            </ul>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exports publics : aside sticky desktop + drawer mobile + sync URL
// ---------------------------------------------------------------------------

export function SportsSidebar({
  activeSport,
  onSportChange,
}: {
  activeSport: string;
  onSportChange: (sportId: SportTabId) => void;
}) {
  const t = useTranslations("sportsSidebar");
  return (
    <aside
      aria-label={t("title")}
      className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 border-r border-slate-800 lg:block xl:w-64"
    >
      <SportsSidebarContent activeSport={activeSport} onSportChange={onSportChange} />
    </aside>
  );
}

export function SportsSidebarDrawer({
  activeSport,
  onSportChange,
}: {
  activeSport: string;
  onSportChange: (sportId: SportTabId) => void;
}) {
  const t = useTranslations("sportsSidebar");
  const open = useSportsSidebarStore((s) => s.drawerOpen);
  const setOpen = useSportsSidebarStore((s) => s.setDrawerOpen);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={t("openDrawer")}
          className="gap-1.5 px-2 text-xs text-zinc-300 hover:text-white lg:hidden"
        >
          <ListFilter className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[19rem] max-w-[85vw] border-slate-800 bg-[#0F172A] p-0"
      >
        <SheetTitle className="sr-only">{t("title")}</SheetTitle>
        <div className="h-full pt-10">
          <SportsSidebarContent
            activeSport={activeSport}
            onSportChange={onSportChange}
            onNavigate={() => setOpen(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Hydratation URL au montage + reflet store → URL (replaceState). */
export function SportsSidebarUrlSync() {
  const selectedLeagueId = useSportsSidebarStore((s) => s.selectedLeagueId);
  const selectedSportId = useSportsSidebarStore((s) => s.selectedSportId);
  const selectedTimeFilter = useSportsSidebarStore((s) => s.selectedTimeFilter);
  const searchQuery = useSportsSidebarStore((s) => s.searchQuery);
  const modes = useSportsSidebarStore((s) => s.modes);

  useEffect(() => {
    hydrateStoreFromUrl();
  }, []);

  useEffect(() => {
    syncStoreToUrl({ selectedLeagueId, selectedSportId, selectedTimeFilter, searchQuery, modes });
  }, [selectedLeagueId, selectedSportId, selectedTimeFilter, searchQuery, modes]);

  return null;
}
