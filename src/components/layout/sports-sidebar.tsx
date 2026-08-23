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
import {
  applyTimeFilter,
  collectQuickLinks,
  DEFAULT_FAVORITE_LEAGUES,
  filterTreeByQuery,
  findLeaguePath,
  isDefaultFavoriteLeague,
} from "@/lib/sports-tree";
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
import { FootballStrategyTop5Widget } from "@/components/football/football-strategy-top5-widget";
import { FootballLeagueRankingsWidget } from "@/components/football/football-league-rankings-widget";

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
        "rounded-full px-1.5 py-0.5 font-mono text-[11px] leading-none tabular-nums",
        live ? "bg-red-500/15 text-red-300" : "bg-slate-800 text-slate-400",
      )}
    >
      {n}
    </span>
  );
}

/**
 * Badge d'edge de valeur 1X2 moyen d'une ligue (P0-2) : « +2,1 » si le modèle
 * surpasse les cotes (value), « −1,3 » sinon. Vert quand value positive.
 */
function EdgeBadge({ value }: { value: number }) {
  const positive = Number.isFinite(value) && value > 0;
  return (
    <span
      className={cn(
        "shrink-0 rounded px-1 py-0.5 font-mono text-[11px] leading-none tabular-nums",
        positive ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/10 text-red-300/80",
      )}
    >
      {value > 0 ? `+ ${value.toFixed(1)}` : value.toFixed(1)}
    </span>
  );
}

function FavoriteStar({ league }: { league: LeagueNode }) {
  const t = useTranslations("sportsSidebar");
  const favoriteIds = useSportsSidebarStore((s) => s.favoriteLeagueIds);
  const customized = useSportsSidebarStore((s) => s.favoritesCustomized);
  const toggleFavorite = useSportsSidebarStore((s) => s.toggleFavoriteLeague);
  const isFav = customized ? favoriteIds.includes(league.id) : isDefaultFavoriteLeague(league.id);

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
        const span = document.createElement("span");
        span.setAttribute("aria-hidden", "true");
        span.textContent = getFlagEmoji(code);
        span.className = "text-[13px] leading-none";
        e.currentTarget.replaceWith(span);
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
  const isSelected = useSportsSidebarStore((s) => s.selectedMatchIds.includes(match.id));
  const toggleSelection = useSportsSidebarStore((s) => s.toggleMatchSelection);

  const openDetail = (pick?: string) => {
    const sport = league.sportId;
    if (sport === "football" || sport === "tennis") {
      window.dispatchEvent(
        new CustomEvent("open-match-detail", {
          detail: { sport, matchId: match.id, market: pick ?? "1X2" },
        }),
      );
    } else {
      onFallbackSport();
    }
  };

  // Cotes 1X2 (P0-1) avec repli sur les probabilités de modèle (P0-2).
  const hasOdds = !!match.odds;
  const cells: Array<{ label: string; value: string }> = hasOdds
    ? [
        { label: "1", value: match.odds!.home.toFixed(2) },
        { label: "X", value: match.odds!.draw.toFixed(2) },
        { label: "2", value: match.odds!.away.toFixed(2) },
      ]
    : match.prob
      ? [
          { label: "1", value: `${Math.round(match.prob.home)}%` },
          { label: "X", value: `${Math.round(match.prob.draw)}%` },
          { label: "2", value: `${Math.round(match.prob.away)}%` },
        ]
      : [];

  return (
    <div
      className={cn(
        "flex w-full items-center gap-1.5 rounded px-1 py-1 pl-0 text-[11px]",
        isSelected
          ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/40"
          : "text-slate-400 hover:bg-slate-800/80",
      )}
    >
      {match.isLive ? (
        <span aria-hidden className="ml-1 h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-red-500" />
      ) : (
        <span className="ml-1 w-8 shrink-0 font-mono text-[11px] tabular-nums text-slate-500">
          {formatKickoff(match.scheduledAt)}
        </span>
      )}
      <button
        type="button"
        onClick={() => toggleSelection(match.id)}
        title={isSelected ? t("selectionRemove") : t("selectionAdd")}
        aria-pressed={isSelected}
        className="min-w-0 flex-1 truncate rounded px-1 text-left transition-colors hover:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {isSelected ? "✓ " : ""}
        {match.homeName}
        {match.awayName ? ` – ${match.awayName}` : ""}
      </button>
      {cells.length ? (
        <span className="flex shrink-0 items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          {cells.map((c, i) => (
            <button
              key={c.label}
              type="button"
              aria-label={`${c.label} ${c.value}`}
              onClick={() => openDetail(c.label)}
              className={cn(
                "rounded bg-slate-800/80 px-1 py-0.5 font-mono text-[11px] tabular-nums transition-colors",
                "hover:bg-emerald-600/25 hover:text-emerald-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                i === bestCellIndex(cells) && hasOdds
                  ? "text-emerald-300"
                  : "text-slate-400",
              )}
            >
              {c.value}
            </button>
          ))}
        </span>
      ) : (
        <span />
      )}
    </div>
  );
}

/** Index de la « meilleure » cote (la plus basse = favori) pour la surbrillance. */
function bestCellIndex(cells: Array<{ label: string; value: string }>): number {
  const nums = cells.map((c) => parseFloat(c.value));
  if (nums.some((n) => !Number.isFinite(n))) return -1;
  return nums.indexOf(Math.min(...nums));
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
  const t = useTranslations("sportsSidebar");
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
            aria-label={t(expanded ? "collapseAria" : "expandAria", { name: league.name })}
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
        {league.edgePct != null && Number.isFinite(league.edgePct) ? (
          <EdgeBadge value={league.edgePct} />
        ) : null}
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
  active,
  forceExpanded,
  onLeagueSelect,
  onSportSelect,
}: {
  country: CountryNode;
  selectedLeagueId: string | null;
  /** Ancêtre direct de la ligue sélectionnée (chemin actif sport→pays→ligue). */
  active?: boolean;
  /** Recherche active : force l'affichage des ligues quel que soit le store. */
  forceExpanded?: boolean;
  onLeagueSelect: (league: LeagueNode) => void;
  onSportSelect: (sportId: SportTabId) => void;
}) {
  const t = useTranslations("sportsSidebar");
  const storeExpanded = useSportsSidebarStore((s) => !!s.expandedCountries[country.id]);
  const expanded = forceExpanded || storeExpanded;
  const expandedLeagues = useSportsSidebarStore((s) => s.expandedLeagues);
  const toggleCountry = useSportsSidebarStore((s) => s.toggleCountry);
  const toggleLeague = useSportsSidebarStore((s) => s.toggleLeague);

  return (
    <li>
      <button
        type="button"
        onClick={() => toggleCountry(country.id)}
        aria-expanded={expanded}
        aria-label={t(expanded ? "collapseAria" : "expandAria", { name: country.name })}
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
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-xs font-medium",
            active ? "font-semibold text-emerald-300" : "text-slate-300",
          )}
        >
          {country.name}
        </span>
        <CountBadge n={country.leagues.reduce((n, l) => n + l.matchCount, 0)} />
      </button>
      {expanded ? (
        <ul className="space-y-0.5 pb-1">
          {country.leagues.map((league) => (
            <LeagueRow
              key={league.id}
              league={league}
              expanded={forceExpanded || !!expandedLeagues[league.id]}
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
  activePath,
  forceExpanded,
  onLeagueSelect,
  onSportSelect,
}: {
  sport: SportNode;
  selectedLeagueId: string | null;
  /** Chemin actif sport→pays→ligue (P0-9) : marque le sport et le pays ancêtres. */
  activePath?: { sportId: string; countryId: string } | null;
  /** Recherche active : force l'affichage des pays/ligues quel que soit le store. */
  forceExpanded?: boolean;
  onLeagueSelect: (league: LeagueNode) => void;
  onSportSelect: (sportId: SportTabId) => void;
}) {
  const t = useTranslations("sportsSidebar");
  const storeExpanded = useSportsSidebarStore((s) => !!s.expandedSports[sport.id]);
  const expanded = forceExpanded || storeExpanded;
  const toggleSport = useSportsSidebarStore((s) => s.toggleSport);
  const Icon = SPORT_ICONS[sport.icon] ?? Trophy;
  const sportLabel = t(`sport.${sport.id}`) || sport.name;
  const active = activePath?.sportId === sport.id;

  return (
    <li>
      <button
        type="button"
        onClick={() => toggleSport(sport.id)}
        aria-expanded={expanded}
        aria-label={t(expanded ? "collapseAria" : "expandAria", { name: sportLabel })}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left",
          "transition-colors hover:bg-slate-800/80",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <Icon aria-hidden className="h-4 w-4 shrink-0 text-emerald-400" />
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-xs font-semibold",
            active ? "text-emerald-300" : "text-slate-200",
          )}
        >
          {sportLabel}
        </span>
        {sport.liveMatches > 0 ? <CountBadge n={sport.liveMatches} live /> : null}
        {sport.degraded && sport.totalMatches === 0 ? (
          <span
            title="Données indisponibles (API sport en erreur)"
            className="rounded-full border border-dashed border-amber-500/40 px-1.5 py-0.5 text-[11px] font-medium text-amber-400/80"
          >
            indispo
          </span>
        ) : (
          <CountBadge n={sport.totalMatches} />
        )}
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
              active={activePath?.countryId === country.id}
              forceExpanded={forceExpanded}
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
// Bloc 3bis — Quick-links « Prédictions » (P0-3, profondeur 4→1)
// ---------------------------------------------------------------------------

function QuickLinksBlock({
  tree,
  onFallbackSport,
}: {
  tree: SportNode[];
  onFallbackSport: (sportId: SportTabId) => void;
}) {
  const t = useTranslations("sportsSidebar");
  const quick = useMemo(() => collectQuickLinks(tree), [tree]);

  const rows: Array<{
    key: "live" | "value" | "today";
    label: string;
    items: Array<{ match: TreeMatchSummary; league: LeagueNode }>;
  }> = [
    { key: "live", label: t("quickLive"), items: quick.live },
    { key: "value", label: t("quickValue"), items: quick.value },
    { key: "today", label: t("quickToday"), items: quick.today },
  ];

  // Bloc masqué entièrement si aucune ligne n'a de match (arbre vide/dégradé).
  const visible = rows.filter((r) => r.items.length > 0);
  if (visible.length === 0) return null;

  return (
    <section aria-label={t("quickLinks")} className="border-b border-slate-800/80 pb-2">
      <h2 className="px-2.5 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
        {t("quickLinks")}
      </h2>
      <div className="space-y-1">
        {visible.map((row) => (
          <div key={row.key}>
            <p className="flex items-center gap-1 px-2.5 pb-0.5 text-[11px] font-semibold text-emerald-400/90">
              {row.key === "live" ? (
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-red-500" />
              ) : (
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-500/60" />
              )}
              {row.label}
            </p>
            <ul className="space-y-0.5">
              {row.items.map(({ match, league }) => (
                <li key={match.id}>
                  <MatchRow
                    match={match}
                    league={league}
                    onFallbackSport={() => onFallbackSport(league.sportId as SportTabId)}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
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

  // Bloc TOUJOURS visible (spec §2.1). Les favoris par défaut viennent du
  // catalogue statique détaché des données de match (BUG-2) : une ligue
  // manquante dans l'arbre (tennis 503 / NBA down) est affichée en nœud
  // synthétique à compteur 0, jamais masquée.
  const favorites = useMemo(() => {
    const byId = new Map<string, LeagueNode>();
    const byName = new Map<string, LeagueNode>();
    for (const sport of tree) {
      for (const country of sport.countries) {
        for (const league of country.leagues) {
          byId.set(league.id, league);
          byName.set(`${league.sportId}|${league.name.toLowerCase()}`, league);
        }
      }
    }

    // Les ids des nœuds réels de l'arbre (ex. football:42) diffèrent des ids
    // du catalogue statique (ex. football:champions-league) : on préfère
    // retrouver la ligue par nom pour conserver son vrai compteur de matchs.
    const resolve = (id: string): LeagueNode | null => {
      const exact = byId.get(id);
      if (exact) return exact;
      const def = DEFAULT_FAVORITE_LEAGUES.find((d) => d.id === id);
      if (!def) return null;
      const byNameHit = byName.get(`${def.sportId}|${def.name.toLowerCase()}`);
      return byNameHit ?? { id: def.id, name: def.name, matchCount: 0, sportId: def.sportId };
    };

    const ids = customized ? favoriteIds : DEFAULT_FAVORITE_LEAGUES.map((d) => d.id);
    const found: LeagueNode[] = [];
    for (const id of ids) {
      const node = resolve(id);
      if (node && !found.some((o) => o.id === node.id)) found.push(node);
    }
    // Favoris vides (utilisateur a tout retiré) : on retombe sur le catalogue
    // par défaut pour que le bloc reste visible sans trouer la sidebar.
    if (found.length === 0) {
      return DEFAULT_FAVORITE_LEAGUES.map((d) => ({
        id: d.id,
        name: d.name,
        matchCount: 0,
        sportId: d.sportId,
      }));
    }
    return found.slice(0, 10);
  }, [tree, favoriteIds, customized]);

  return (
    <section aria-label={t("favorites")} className="border-b border-slate-800/80 pb-2">
      <h2 className="px-2.5 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
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
  const selectedMatchIds = useSportsSidebarStore((s) => s.selectedMatchIds);
  const clearMatchSelection = useSportsSidebarStore((s) => s.clearMatchSelection);

  const tree = useMemo(() => {
    const base = treeData ?? [];
    return filterTreeByQuery(applyTimeFilter(base, timeFilter), searchQuery);
  }, [treeData, timeFilter, searchQuery]);

  // Recherche active (>= 2 lettres, seuil de filterTreeByQuery) : les branches
  // matchées sont affichées dépliées pour rendre les résultats visibles (P0-9).
  const searchActive = searchQuery.trim().length >= 2;

  // Chemin actif sport→pays→ligue (P0-9) : la ligue sélectionnée marque ses ancêtres.
  const activePath = useMemo(() => findLeaguePath(tree, selectedLeagueId), [tree, selectedLeagueId]);

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

      {selectedMatchIds.length > 0 ? (
        <div className="flex items-center justify-between gap-2 border-b border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5">
          <span className="text-[11px] font-semibold text-emerald-300">
            {selectedMatchIds.length} match{selectedMatchIds.length > 1 ? "s" : ""} sélectionné{selectedMatchIds.length > 1 ? "s" : ""}
          </span>
          <button
            type="button"
            onClick={clearMatchSelection}
            className="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("selectionClear")}
          </button>
        </div>
      ) : null}

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-1 p-1.5">
          {activeSport === "football" && <FootballStrategyTop5Widget />}
          {activeSport === "football" && <FootballLeagueRankingsWidget />}
          <QuickLinksBlock tree={tree} onFallbackSport={handleSportSelect} />
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
                  activePath={activePath}
                  forceExpanded={searchActive}
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
