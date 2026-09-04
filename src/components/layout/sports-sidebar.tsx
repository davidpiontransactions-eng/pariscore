"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  Filter,
  Home,
  Layers,
  ListFilter,
  Radio,
  Search,
  Trophy,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { getFlagEmoji, getFlagUrl } from "@/lib/flag-utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { TIME_RANGE_OPTIONS, type MatchViewMode } from "@/lib/match-view";
import {
  applyTimeFilter,
  collectPicksConsensus,
  collectQuickLinks,
  DEFAULT_FAVORITE_LEAGUES,
  applyStatusFilter,
  filterTreeByQuery,
  findLeaguePath,
  isDefaultFavoriteLeague,
  sortSportsTreeChronological,
} from "@/lib/sports-tree";
import { LiveStatFilters, DEFAULT_LIVE_STAT_FILTERS, matchPassesStatFilters } from "@/lib/football-live-thresholds";
import { useLiveMatches } from "@/hooks/use-live-matches";
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
import { FootballLeagueRankingsWidget } from "@/components/football/football-league-rankings-widget";
import { MomentumSparkline } from "@/components/football/momentum-sparkline";


import {
  TennisPicto,
  FootballPicto,
  CrosshairPicto,
  MmaPicto,
  BasketballPicto,
  CyclingPicto,
  HelmetPicto,
  BaseballPicto,
  RugbyPicto,
} from "@/components/ui/sport-pictograms";

/**
 * Pictogrammes par sport — clé = nom d'icône envoyé par le payload arbre
 * (SPORT_META, src/lib/sports-tree.ts). Valeurs = pictos SVG maison.
 */
const SPORT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Trophy: FootballPicto,
  Activity: TennisPicto,
  Crosshair: CrosshairPicto,
  Dribbble: BasketballPicto,
  Swords: MmaPicto,
  Bike: CyclingPicto,
  Flag: HelmetPicto,
  Volleyball: BaseballPicto,
  Shield: RugbyPicto,
};

/** Couleurs de fond par sport pour les badges de la sidebar réduite. */
const SPORT_COLORS: Record<string, { bg: string; text: string }> = {
  football: { bg: "bg-emerald-500/15", text: "text-emerald-400" },
  tennis: { bg: "bg-blue-500/15", text: "text-blue-400" },
  basketball: { bg: "bg-orange-500/15", text: "text-orange-400" },
  mma: { bg: "bg-amber-500/15", text: "text-amber-400" },
  cs2: { bg: "bg-purple-500/15", text: "text-purple-400" },
  cycling: { bg: "bg-cyan-500/15", text: "text-cyan-400" },
  f1: { bg: "bg-red-500/15", text: "text-red-400" },
  baseball: { bg: "bg-yellow-500/15", text: "text-yellow-400" },
  rugby: { bg: "bg-teal-500/15", text: "text-teal-400" },
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
  const treeStatus = useSportsSidebarStore((s) => s.treeStatus ?? "all");
  const setTreeStatus = useSportsSidebarStore((s) => s.setTreeStatus);

  const { data: tree } = useSportsTree();

  const counts = useMemo(() => {
    if (!tree) return { total: 0, live: 0, prematch: 0 };
    let total = 0;
    let live = 0;
    for (const sport of tree) {
      for (const country of sport.countries) {
        for (const league of country.leagues) {
          for (const m of league.matches ?? []) {
            total++;
            if (m.isLive) live++;
          }
        }
      }
    }
    return { total, live, prematch: total - live };
  }, [tree]);

  type StatusOption = {
    value: "all" | "live" | "prematch";
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count: number;
  };
  const options: StatusOption[] = [
    { value: "all", label: t("all"), icon: Layers, count: counts.total },
    { value: "live", label: t("live"), icon: Radio, count: counts.live },
    { value: "prematch", label: t("prematch"), icon: Clock, count: counts.prematch },
  ];

  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
    const len = options.length;
    let next: number;
    switch (e.key) {
      case "ArrowRight":
        next = (idx + 1) % len;
        break;
      case "ArrowLeft":
        next = (idx - 1 + len) % len;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = len - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    setTreeStatus(options[next].value);
    if (options[next].value !== "all")
      setMode(sportId, options[next].value as MatchViewMode);
    btnRefs.current[next]?.focus();
  };

  return (
    <div
      role="group"
      aria-label={t("modeAria")}
      title="All = live + upcoming (within active time window)"
      className="grid grid-cols-3 gap-1 rounded-lg bg-slate-900 p-1"
    >
      {options.map((opt, idx) => {
        const active = treeStatus === opt.value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            ref={(el) => { btnRefs.current[idx] = el; }}
            type="button"
            aria-pressed={active}
            tabIndex={active ? 0 : -1}
            onClick={() => {
              setTreeStatus(opt.value);
              if (opt.value !== "all") setMode(sportId, opt.value as MatchViewMode);
            }}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={cn(
              "relative flex items-center justify-center gap-1.5 rounded-md px-1.5 py-1.5 text-xs font-semibold transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? "text-white shadow-sm" : "text-white/60 hover:text-slate-200",
            )}
          >
            {active && (
              <motion.div
                layoutId="filter-tree-indicator"
                className="absolute inset-0 rounded-md bg-slate-700"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5" />
              {opt.label}
              <span
                aria-live="polite"
                className="font-mono text-[10px] tabular-nums text-slate-400"
              >
                {opt.count > 0 ? `(${opt.count})` : "(—)"}
              </span>
              {opt.value === "live" ? (
                <span
                  aria-hidden
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    active ? "animate-pulse bg-red-500" : "bg-slate-600",
                  )}
                />
              ) : null}
            </span>
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
        className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
      />
      <input
        type="search"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder={t("searchPlaceholder")}
        aria-label={t("searchPlaceholder")}
        className={cn(
          "h-8 w-full rounded-md border border-slate-700/60 bg-slate-900 pl-8 pr-7 text-xs text-slate-200",
          "placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      />
      {searchQuery ? (
        <button
          type="button"
          onClick={() => setSearchQuery("")}
          aria-label={t("searchClear")}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-200"
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
    { key: "tomorrow" as const, label: t("timeTomorrow") },
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
                : "bg-slate-800/80 text-white/60 hover:bg-slate-700/80 hover:text-slate-200",
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
        live ? "bg-red-500/15 text-red-300 animate-pulse" : "bg-slate-800 text-white/60",
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
  const hideOdds = useSportsSidebarStore((s) => s.hideOdds);

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
          : "text-white/60 hover:bg-slate-800/80",
      )}
    >
      {match.isLive ? (
        <span aria-hidden className="ml-1 h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-red-500" />
      ) : (
        <span className="ml-1 w-8 shrink-0 font-mono text-[11px] tabular-nums text-white/50">
          {formatKickoff(match.scheduledAt)}
        </span>
      )}
      <button
        type="button"
        onClick={() => {
          toggleSelection(match.id);
          openDetail();
        }}
        title={isSelected ? t("selectionRemove") : t("selectionAdd")}
        aria-pressed={isSelected}
        className="min-w-0 flex-1 truncate rounded px-1 text-left transition-colors hover:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {isSelected ? "✓ " : ""}
        {match.homeName}
        {match.awayName ? ` – ${match.awayName}` : ""}
      </button>
      {cells.length && !hideOdds ? (
        <span className="flex shrink-0 items-center gap-0.5" role="presentation" onClick={(e) => e.stopPropagation()}>
          {cells.map((c, i) => (
            <button
              key={c.label}
              type="button"
              aria-label={`${c.label} ${c.value}`}
              onClick={() => openDetail(c.label)}
              className={cn(
                "rounded-md border px-1.5 py-0.5 font-mono text-[11px] tabular-nums transition-colors duration-150",
                i === bestCellIndex(cells) && hasOdds
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-slate-700/40 bg-slate-800/50 text-white/60 hover:border-emerald-500/30 hover:bg-emerald-500/15 hover:text-emerald-300",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              {c.value}
            </button>
          ))}
        </span>
      ) : cells.length && hideOdds ? (
        <span className="flex shrink-0 items-center gap-0.5" role="presentation" onClick={(e) => e.stopPropagation()}>
          <span className="rounded-md border border-slate-700/40 bg-slate-800/50 px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-slate-400">—</span>
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
  registerRef,
}: {
  league: LeagueNode;
  expanded: boolean;
  onToggle: () => void;
  selected: boolean;
  onSelect: () => void;
  onFallbackSport: () => void;
  registerRef?: (id: string, el: HTMLLIElement | null) => void;
}) {
  const t = useTranslations("sportsSidebar");
  const hasMatches = (league.matches?.length ?? 0) > 0;

  // Build momentum data from live matches in this league (P2)
  // Using edgePct as momentum proxy since live minute not in TreeMatchSummary
  const momentumData = useMemo(() => {
    if (!hasMatches) return [];
    const liveMatches = league.matches!.filter((m) => m.isLive);
    if (liveMatches.length < 2) return []; // Only show if 2+ live matches
    return liveMatches.map((m, idx) => ({
      minute: idx * 15, // Approximate timeline
      value: Math.max(-100, Math.min(100, (m.edgePct ?? 0) * 10)), // Scale edgePct to momentum range
    }));
  }, [league.matches, hasMatches]);

  return (
    <li ref={(el) => registerRef?.(league.id, el)}>
      <div
        className={cn(
          "flex w-full items-center gap-1.5 rounded-md py-1.5 pl-8 pr-2 text-left",
          "transition-colors",
          selected
            ? "border-l-2 border-emerald-400 bg-emerald-500/15 font-semibold text-emerald-300"
            : "border-l-2 border-transparent text-white/70 hover:bg-gradient-to-r hover:from-white/[0.03] hover:to-transparent",
        )}
      >
        {hasMatches ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-label={t(expanded ? "collapseAria" : "expandAria", { name: league.name })}
            className="-ml-1 rounded p-0.5 text-slate-400 hover:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
        {momentumData.length > 0 && (
          <MomentumSparkline data={momentumData} className="ml-1" />
        )}
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
  selectedCountryId,
  sportId,
  active,
  forceExpanded,
  onLeagueSelect,
  onSportSelect,
  leagueRefs,
}: {
  country: CountryNode;
  selectedLeagueId: string | null;
  selectedCountryId: string | null;
  sportId: string;
  /** Ancêtre direct de la ligue sélectionnée (chemin actif sport→pays→ligue). */
  active?: boolean;
  /** Recherche active : force l'affichage des pays/ligues quel que soit le store. */
  forceExpanded?: boolean;
  onLeagueSelect: (league: LeagueNode) => void;
  onSportSelect: (sportId: SportTabId) => void;
  leagueRefs?: React.RefObject<Map<string, HTMLLIElement>>;
}) {
  const t = useTranslations("sportsSidebar");
  const storeExpanded = useSportsSidebarStore((s) => !!s.expandedCountries[country.id]);
  const expanded = forceExpanded || storeExpanded;
  const expandedLeagues = useSportsSidebarStore((s) => s.expandedLeagues);
  const toggleCountry = useSportsSidebarStore((s) => s.toggleCountry);
  const toggleLeague = useSportsSidebarStore((s) => s.toggleLeague);
  const selectCountry = useSportsSidebarStore((s) => s.selectCountry);
  const isCountrySelected = selectedCountryId === country.id;

  const handleCountryClick = () => {
    toggleCountry(country.id);
    selectCountry(country.id, sportId);
  };

  return (
    <li>
      <button
        type="button"
        onClick={handleCountryClick}
        aria-expanded={expanded}
        aria-label={t(expanded ? "collapseAria" : "expandAria", { name: country.name })}
        className={cn(
          "flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 pl-5 text-left",
          "transition-all duration-150 hover:bg-gradient-to-r hover:from-white/[0.03] hover:to-transparent",
          isCountrySelected
            ? "bg-emerald-500/10 font-semibold text-emerald-300"
            : "text-white/70",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <ChevronRight
          aria-hidden
          className={cn("h-3 w-3 shrink-0 text-slate-400 transition-transform", expanded && "rotate-90")}
        />
        <CountryFlag code={country.countryCode} name={country.name} />
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-xs font-medium",
            active ? "font-semibold text-emerald-300" : "text-white/70",
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
              registerRef={(id, el) => {
                if (el) leagueRefs?.current?.set(id, el);
                else leagueRefs?.current?.delete(id);
              }}
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
  selectedCountryId,
  activePath,
  forceExpanded,
  onLeagueSelect,
  onSportSelect,
  leagueRefs,
}: {
  sport: SportNode;
  selectedLeagueId: string | null;
  selectedCountryId: string | null;
  /** Chemin actif sport→pays→ligue (P0-9) : marque le sport et le pays ancêtres. */
  activePath?: { sportId: string; countryId: string } | null;
  /** Recherche active : force l'affichage des pays/ligues quel que soit le store. */
  forceExpanded?: boolean;
  onLeagueSelect: (league: LeagueNode) => void;
  onSportSelect: (sportId: SportTabId) => void;
  leagueRefs?: React.RefObject<Map<string, HTMLLIElement>>;
}) {
  const t = useTranslations("sportsSidebar");
  const storeExpanded = useSportsSidebarStore((s) => !!s.expandedSports[sport.id]);
  const expanded = forceExpanded || storeExpanded;
  const toggleSport = useSportsSidebarStore((s) => s.toggleSport);
  const Icon = SPORT_ICONS[sport.icon] ?? Trophy;
  const sportLabel = (() => {
    const key = `sport.${sport.id}`;
    const translated = t(key);
    // Si la clé n'existe pas, next-intl retourne la clé elle-même → fallback sur sport.name
    return translated !== key && translated ? translated : sport.name;
  })();
  const active = activePath?.sportId === sport.id || sport.countries.some((c) => c.id === selectedCountryId);

  return (
    <li>
      <button
        type="button"
        onClick={() => {
          toggleSport(sport.id);
          onSportSelect(sport.id as SportTabId);
        }}
        aria-expanded={expanded}
        aria-label={t(expanded ? "collapseAria" : "expandAria", { name: sportLabel })}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left",
          "transition-all duration-150 hover:bg-gradient-to-r hover:from-white/[0.03] hover:to-transparent",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        {sport.liveMatches > 0 ? (
          <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-red-500" aria-label="Live" />
        ) : null}
        <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", SPORT_COLORS[sport.id]?.bg ?? "bg-slate-800/60")}>
          <Icon aria-hidden className={cn("h-4 w-4", SPORT_COLORS[sport.id]?.text ?? "text-slate-300")} />
        </span>
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
          className={cn("h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform", expanded && "rotate-90")}
        />
      </button>
      {expanded ? (
        <ul className="space-y-0.5 pb-1">
          {sport.countries.map((country) => (
            <CountryBlock
              key={country.id}
              country={country}
              selectedLeagueId={selectedLeagueId}
              selectedCountryId={selectedCountryId}
              sportId={sport.id}
              active={activePath?.countryId === country.id}
              forceExpanded={forceExpanded}
              onLeagueSelect={onLeagueSelect}
              onSportSelect={onSportSelect}
              leagueRefs={leagueRefs}
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
  const picks = useMemo(() => collectPicksConsensus(tree).slice(0, 6), [tree]);

  const rows: Array<{
    key: "live" | "value" | "today" | "picks";
    label: string;
    items: Array<{ match: TreeMatchSummary; league: LeagueNode }>;
  }> = [
    { key: "live", label: t("quickLive"), items: quick.live },
    { key: "value", label: t("quickValue"), items: quick.value },
    { key: "today", label: t("quickToday"), items: quick.today },
    { key: "picks", label: "Picks", items: picks },
  ];

  // Bloc masqué entièrement si aucune ligne n'a de match (arbre vide/dégradé).
  const visible = rows.filter((r) => r.items.length > 0);
  if (visible.length === 0) return null;

  return (
    <section aria-label={t("quickLinks")} className="border-b border-slate-800/80 pb-2">
      <h2 className="px-2.5 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-white/50">
        {t("quickLinks")}
      </h2>
      <div className="space-y-1">
        {visible.map((row) => (
          <div key={row.key}>
            <p className="flex items-center gap-1 px-2.5 pb-0.5 text-[11px] font-semibold">
              {row.key === "live" ? (
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-red-500" />
              ) : row.key === "picks" ? (
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-purple-500" />
              ) : (
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-500/60" />
              )}
              <span className={row.key === "picks" ? "text-purple-400" : "text-emerald-400/90"}>
                {row.label}
              </span>
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
// Bloc 3bis — My Teams (P2)
// ---------------------------------------------------------------------------

function MyTeamsBlock({
  followedTeamIds,
  onToggleFollow,
  tree,
}: {
  followedTeamIds: string[];
  onToggleFollow: (teamId: string) => void;
  tree: SportNode[];
}) {
  const t = useTranslations("sportsSidebar");

  // Build a map of teamId -> team name from tree
  const teamNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const sport of tree) {
      for (const country of sport.countries) {
        for (const league of country.leagues) {
          for (const m of league.matches ?? []) {
            if (m.homeName) map.set(`${sport.id}:${m.homeName}`, m.homeName);
            if (m.awayName) map.set(`${sport.id}:${m.awayName}`, m.awayName);
          }
        }
      }
    }
    return map;
  }, [tree]);

  if (followedTeamIds.length === 0) {
    return (
      <section aria-label="My Teams" className="border-b border-slate-800/80 pb-2">
        <h2 className="px-2.5 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-white/50">
          My Teams
        </h2>
        <p className="px-2.5 py-2 text-[11px] text-white/50 text-center">
          Follow teams to see them here
        </p>
      </section>
    );
  }

  return (
    <section aria-label="My Teams" className="border-b border-slate-800/80 pb-2">
      <h2 className="px-2.5 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-white/50">
        My Teams
      </h2>
      <ul className="space-y-0.5">
        {followedTeamIds.map((teamId) => {
          const name = teamNames.get(teamId) ?? teamId.split(":").pop() ?? teamId;
          return (
            <li key={teamId} className="flex items-center gap-1.5 rounded-md px-2.5 py-1 hover:bg-slate-800/80">
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-white/70">{name}</span>
              <button
                type="button"
                onClick={() => onToggleFollow(teamId)}
                aria-label="Unfollow team"
                className="p-0.5 text-slate-400 hover:text-red-400"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          );
        })}
      </ul>
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
      <h2 className="px-2.5 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-white/50">
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
              className="min-w-0 flex-1 truncate rounded text-left text-xs font-medium text-white/70 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
  const { data: treeData, isValidating } = useSportsTree();
  const { liveMatchList } = useLiveMatches();
  const liveCount = liveMatchList.filter((m) => m.isLive).length;
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const prevValidating = useRef(isValidating);
  useEffect(() => {
    // MAJ lastSyncTime à chaque cycle SWR (succès OU erreur) pour que
    // l'UI affiche "Last sync: HH:MM:SS" même si le fetch échoue —
    // l'utilisateur voit au moins que le système a tenté une synchro.
    if (prevValidating.current && !isValidating) {
      setLastSyncTime(new Date());
    }
    prevValidating.current = isValidating;
  }, [isValidating, treeData]);

  // Initialiser lastSyncTime au mount pour éviter "—" pendant le 1er cycle.
  useEffect(() => {
    if (!lastSyncTime && isValidating) {
      setLastSyncTime(new Date());
    }
  }, [lastSyncTime, isValidating]);

  const searchQuery = useSportsSidebarStore((s) => s.searchQuery);
  const timeFilter = useSportsSidebarStore((s) => s.selectedTimeFilter);
  const selectedLeagueId = useSportsSidebarStore((s) => s.selectedLeagueId);
  const selectLeague = useSportsSidebarStore((s) => s.selectLeague);
  const selectedCountryId = useSportsSidebarStore((s) => s.selectedCountryId);
  const selectedMatchIds = useSportsSidebarStore((s) => s.selectedMatchIds);
  const clearMatchSelection = useSportsSidebarStore((s) => s.clearMatchSelection);
  const hideOdds = useSportsSidebarStore((s) => s.hideOdds);
  const setHideOdds = useSportsSidebarStore((s) => s.setHideOdds);
  const followedTeamIds = useSportsSidebarStore((s) => s.followedTeamIds);
  const toggleFollowedTeam = useSportsSidebarStore((s) => s.toggleFollowedTeam);

  const treeStatus = useSportsSidebarStore((s) => s.treeStatus ?? "all");
  const [sortMode, setSortMode] = useState<"default" | "chrono">("default");
  const [statFilters, setStatFilters] = useState<LiveStatFilters>(DEFAULT_LIVE_STAT_FILTERS);
  const [showStatFilters, setShowStatFilters] = useState(false);

  const tree = useMemo(() => {
    const base = treeData ?? [];

    // Merge live-only tennis matches into the tree (SWR cache stale 5 min).
    // Without this, matches that just went live don't appear in the sidebar.
    const merged = base.map((sport) => {
      if (sport.id !== "tennis" || liveMatchList.length === 0) return sport;
      const existingIds = new Set(
        sport.countries.flatMap((c) => c.leagues.flatMap((l) => l.matches?.map((m) => m.id) ?? [])),
      );
      const liveOnly = liveMatchList.filter((m) => m.isLive && !existingIds.has(m.id));
      if (liveOnly.length === 0) return sport;
      // Group live-only matches by tournament (league) under "International" country
      const liveLeagues = new Map<string, { name: string; matches: typeof sport.countries[0]["leagues"][0]["matches"] }>();
      for (const lm of liveOnly) {
        const leagueName = lm.tournamentName || "Live";
        if (!liveLeagues.has(leagueName)) {
          liveLeagues.set(leagueName, { name: leagueName, matches: [] });
        }
        liveLeagues.get(leagueName)!.matches!.push({
          id: lm.id,
          homeName: lm.playerA.name,
          awayName: lm.playerB.name,
          scheduledAt: new Date().toISOString(),
          isLive: true,
          edgePct: undefined,
        });
      }
      const liveCountry = {
        id: "tennis:international",
        name: "International",
        countryCode: "INT",
        leagues: Array.from(liveLeagues.entries()).map(([slug, lg]) => ({
          id: `tennis:${slug.toLowerCase().replace(/\s+/g, "-")}`,
          name: lg.name,
          matchCount: lg.matches!.length,
          sportId: "tennis" as const,
          matches: lg.matches,
        })),
      };
      return {
        ...sport,
        totalMatches: sport.totalMatches + liveOnly.length,
        liveMatches: sport.liveMatches + liveOnly.length,
        countries: [liveCountry, ...sport.countries],
      };
    });

    let filtered = filterTreeByQuery(
      applyStatusFilter(applyTimeFilter(merged, timeFilter), treeStatus),
      searchQuery,
    );
    // Apply chronological sort if selected
    if (sortMode === "chrono") {
      filtered = sortSportsTreeChronological(filtered);
    }
    // Apply football live stat filters (P2 — funnel sliders enabled)
    if (activeSport === "football" && showStatFilters) {
      const hasActiveFilters = Object.values(statFilters).some((v) => v > 0);
      if (hasActiveFilters) {
        filtered = filtered.map((sport) => ({
          ...sport,
          countries: sport.countries.map((country) => ({
            ...country,
            leagues: country.leagues.map((league) => ({
              ...league,
              matches: league.matches?.filter((m) => matchPassesStatFilters(m, statFilters)) ?? [],
              matchCount: (league.matches?.filter((m) => matchPassesStatFilters(m, statFilters)) ?? []).length,
            })).filter((l) => (l.matches?.length ?? 0) > 0),
          })).filter((c) => (c.leagues?.length ?? 0) > 0),
        })).filter((s) => (s.countries?.length ?? 0) > 0);
      }
    }
    return filtered;
  }, [treeData, liveMatchList, timeFilter, searchQuery, treeStatus, sortMode, statFilters, showStatFilters, activeSport]);

  // Recherche active (>= 2 lettres, seuil de filterTreeByQuery) : les branches
  // matchées sont affichées dépliées pour rendre les résultats visibles (P0-9).
  const searchActive = searchQuery.trim().length >= 2;

  // Chemin actif sport→pays→ligue (P0-9) : la ligue sélectionnée marque ses ancêtres.
  const activePath = useMemo(() => findLeaguePath(tree, selectedLeagueId), [tree, selectedLeagueId]);

  // Auto-scroll vers la ligue active dans l'arbre (scroll-to-active)
  // Via refs React (pas de document.querySelector — evite XSS via URL params).
  const leagueRefs = useRef<Map<string, HTMLLIElement>>(new Map());
  useEffect(() => {
    if (!selectedLeagueId) return;
    const el = leagueRefs.current.get(selectedLeagueId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedLeagueId]);

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
    <div className="flex h-full w-full flex-col overflow-y-auto scrollable-list bg-[#0e121e] text-slate-200">
      {/* Header sidebar premium — gradient + live counter */}
      <div className="border-b border-slate-800/60 bg-gradient-to-b from-[#0e121e] via-[#0e121e] to-transparent">
        <div className="flex items-center justify-between px-3 py-3">
          <button
            type="button"
            onClick={() => handleSportSelect("home")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-bold transition-all duration-150",
              activeSport === "home"
                ? "bg-[#00e676]/10 text-[#00e676] shadow-sm shadow-[#00e676]/10"
                : "text-white/80 hover:bg-slate-800/60 hover:text-white",
            )}
          >
            <span className="text-base">⚽</span>
            <span className="tracking-tight">PariScore</span>
          </button>
          <div className="flex items-center gap-1.5">
            {liveCount > 0 && (
              <div className="flex items-center gap-1.5 rounded-full bg-red-500/15 px-2 py-0.5">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                <span className="text-[10px] font-bold tabular-nums text-red-300">{liveCount}</span>
              </div>
            )}

          </div>
        </div>
      </div>
      <div className="space-y-2 border-b border-slate-800/80 p-2.5">
        {/* Compteur live global : pulse + nombre total de matchs live */}
        {liveCount > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-2.5 py-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            <span className="text-xs font-semibold text-red-300">
              {liveCount} match{liveCount > 1 ? "s" : ""} live
            </span>
          </div>
        )}
        <LiveLineToggle sportId={activeSport && activeSport !== "home" ? activeSport : "football"} />
        <div className="flex items-center justify-between gap-2">
          <SearchBar />
          <button
            type="button"
            aria-label={hideOdds ? "Show odds" : "Hide odds"}
            onClick={() => setHideOdds(!hideOdds)}
            className={cn(
              "shrink-0 rounded-md p-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              hideOdds
                ? "text-emerald-400 hover:text-emerald-300"
                : "text-slate-400 hover:text-slate-300",
            )}
          >
            {hideOdds ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
        <TimePills />
        {activeSport === "football" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowStatFilters(!showStatFilters)}
                aria-label={showStatFilters ? "Hide stat filters" : "Show stat filters"}
                className={cn(
                  "shrink-0 rounded-md p-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  showStatFilters
                    ? "text-emerald-400 hover:text-emerald-300"
                    : "text-slate-400 hover:text-slate-300",
                )}
              >
                <Filter className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setSortMode(sortMode === "default" ? "chrono" : "default")}
                aria-label={sortMode === "chrono" ? "Sort by A-Z" : "Sort by kickoff time"}
                className={cn(
                  "shrink-0 rounded-md px-2 py-1 text-[10px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  sortMode === "chrono"
                    ? "bg-emerald-600/20 text-emerald-400"
                : "bg-slate-800/80 text-white/60 hover:bg-slate-700/80 hover:text-slate-200",
                )}
              >
                {sortMode === "chrono" ? "Time" : "A-Z"}
              </button>
            </div>
            {showStatFilters && (
              <div className="bg-slate-900 rounded-lg p-2 space-y-1.5 text-[11px]">
                <div>
                  <label className="flex items-center justify-between">
                    <span className="text-white/60">Pressure</span>
                    <span className="font-mono tabular-nums text-emerald-400">{statFilters.minPressure}%</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={statFilters.minPressure}
                    onChange={(e) => setStatFilters({ ...statFilters, minPressure: Number(e.target.value) })}
                    className="w-full h-1.5 accent-emerald-500"
                    aria-label="Minimum pressure percentage"
                  />
                </div>
                <div>
                  <label className="flex items-center justify-between">
                    <span className="text-white/60">Dangerous Attacks</span>
                    <span className="font-mono tabular-nums text-emerald-400">{statFilters.minDangerous}</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="1"
                    value={statFilters.minDangerous}
                    onChange={(e) => setStatFilters({ ...statFilters, minDangerous: Number(e.target.value) })}
                    className="w-full h-1.5 accent-emerald-500"
                    aria-label="Minimum dangerous attacks"
                  />
                </div>
                <div>
                  <label className="flex items-center justify-between">
                    <span className="text-white/60">xG</span>
                    <span className="font-mono tabular-nums text-emerald-400">{statFilters.minXg.toFixed(1)}</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="0.1"
                    value={statFilters.minXg}
                    onChange={(e) => setStatFilters({ ...statFilters, minXg: Number(e.target.value) })}
                    className="w-full h-1.5 accent-emerald-500"
                    aria-label="Minimum expected goals"
                  />
                </div>
                <div>
                  <label className="flex items-center justify-between">
                    <span className="text-white/60">Shots on Target</span>
                    <span className="font-mono tabular-nums text-emerald-400">{statFilters.minShotsOnTarget}</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="30"
                    step="1"
                    value={statFilters.minShotsOnTarget}
                    onChange={(e) => setStatFilters({ ...statFilters, minShotsOnTarget: Number(e.target.value) })}
                    className="w-full h-1.5 accent-emerald-500"
                    aria-label="Minimum shots on target"
                  />
                </div>
              </div>
            )}
          </div>
        )}
        <div className="flex items-center gap-1.5">
          {isValidating && (
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          )}
          <span className="text-[10px] text-muted-foreground/50 tabular-nums">
            Last sync: {lastSyncTime ? lastSyncTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
          </span>
        </div>
      </div>

      {selectedMatchIds.length > 0 ? (
        <div className="flex items-center justify-between gap-2 border-b border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5">
          <span className="text-[11px] font-semibold text-emerald-300">
            {selectedMatchIds.length} match{selectedMatchIds.length > 1 ? "s" : ""} sélectionné{selectedMatchIds.length > 1 ? "s" : ""}
          </span>
          <button
            type="button"
            onClick={clearMatchSelection}
            className="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] font-medium text-white/70 transition-colors hover:bg-slate-700 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("selectionClear")}
          </button>
        </div>
      ) : null}

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-1 p-1.5">
          {/* Top5 tennis retiré — remplacé par le Top10 central (tennis-tab-content). */}
          <QuickLinksBlock tree={tree} onFallbackSport={handleSportSelect} />
          <MyTeamsBlock followedTeamIds={followedTeamIds} onToggleFollow={toggleFollowedTeam} tree={tree} />
          <FavoritesBlock tree={tree} onLeagueSelect={handleLeagueSelect} />
          {tree.length === 0 || !hasAnyMatch ? (
            <div className="px-2.5 py-6 text-center">
              <p className="text-xs font-medium text-white/60">{t("emptyTree")}</p>
              <p className="mt-1 text-[11px] text-white/50">{t("emptyTreeHint")}</p>
            </div>
          ) : (
            <ul className="space-y-0.5">
              {tree.map((sport) => (
                <SportBlock
                  key={sport.id}
                  sport={sport}
                  selectedLeagueId={selectedLeagueId}
                  selectedCountryId={selectedCountryId}
                  activePath={activePath}
                  forceExpanded={searchActive}
                  onLeagueSelect={handleLeagueSelect}
                  onSportSelect={handleSportSelect}
                  leagueRefs={leagueRefs}
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
// Sidebar réduite — mode icônes seul (style 1xBet collapsed)
// ---------------------------------------------------------------------------

function CollapsedSidebar({
  activeSport,
  onSportChange,
}: {
  activeSport: string;
  onSportChange: (sportId: SportTabId) => void;
}) {
  const { data: tree } = useSportsTree();
  const { liveMatchList } = useLiveMatches();
  const toggleCollapsed = useSportsSidebarStore((s) => s.toggleCollapsed);
  const liveCount = liveMatchList.filter((m) => m.isLive).length;

  return (
    <div className="flex h-full w-full flex-col items-center bg-[#0e121e] py-2">
      {/* Toggle expand */}
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-label="Expand sidebar"
        className="mb-3 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <PanelLeftOpen className="h-4 w-4" />
      </button>

      {/* Home */}
      <button
        type="button"
        onClick={() => onSportChange("home")}
        className={`mb-1 rounded-lg p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          activeSport === "home"
            ? "bg-emerald-500/15 text-emerald-400"
            : "text-slate-400 hover:bg-slate-800/80 hover:text-white"
        }`}
        title="Accueil"
      >
        <Home className="h-4 w-4" />
      </button>

      {/* Live badge */}
      {liveCount > 0 && (
        <div className="relative mb-1">
          <button
            type="button"
            onClick={() => onSportChange("football")}
            className="rounded-lg p-2 text-red-400 transition-colors hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title={`${liveCount} matchs live`}
          >
            <Radio className="h-4 w-4" />
          </button>
          <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-0.5 text-[8px] font-bold text-white">
            {liveCount}
          </span>
        </div>
      )}

      {/* Separator */}
      <div className="mx-2 mb-1 h-px w-8 bg-slate-800" />

      {/* Sport icons */}
      {tree?.map((sport) => {
        const Icon = SPORT_ICONS[sport.icon] ?? Trophy;
        const colors = SPORT_COLORS[sport.id] ?? { bg: "bg-slate-800/60", text: "text-slate-300" };
        const isActive = activeSport === sport.id;
        return (
          <button
            key={sport.id}
            type="button"
            onClick={() => onSportChange(sport.id as SportTabId)}
            className={`relative mb-1 rounded-lg p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              isActive ? colors.bg + " " + colors.text : "text-slate-400 hover:bg-slate-800/80 hover:text-white"
            }`}
            title={sport.name}
          >
            <Icon className="h-4 w-4" />
            {sport.liveMatches > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-3 min-w-3 items-center justify-center rounded-full bg-red-500 px-0.5 text-[7px] font-bold text-white">
                {sport.liveMatches}
              </span>
            )}
          </button>
        );
      })}
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
  const collapsed = useSportsSidebarStore((s) => s.collapsed);
  const toggleCollapsed = useSportsSidebarStore((s) => s.toggleCollapsed);

  return (
    <aside
      aria-label={t("title")}
      className={cn(
        "sticky top-14 hidden h-[calc(100vh-3.5rem)] shrink-0 border-r border-slate-800/60 transition-all duration-300 lg:block",
        collapsed ? "w-[4.5rem]" : "w-64 xl:w-72",
      )}
    >
      {collapsed ? (
        <div className="flex h-full flex-col">
          <CollapsedSidebar activeSport={activeSport} onSportChange={onSportChange} />
        </div>
      ) : (
        <div className="flex h-full flex-col border-r border-slate-800/60">
          {/* Collapse toggle — header intégré */}
          <div className="flex items-center justify-end border-b border-slate-800/60 px-2 py-1">
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label="Collapse sidebar"
              className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-800/80 hover:text-slate-200"
            >
              <PanelLeftClose className="h-3.5 w-3.5" />
            </button>
          </div>
          <SportsSidebarContent activeSport={activeSport} onSportChange={onSportChange} />
        </div>
      )}
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
          className="gap-1.5 px-2 text-xs text-white/70 hover:text-white lg:hidden"
        >
          <ListFilter className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[19rem] max-w-[85vw] border-slate-800/60 bg-[#0e121e]/95 p-0 backdrop-blur-xl"
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
  const selectedCountryId = useSportsSidebarStore((s) => s.selectedCountryId);
  const selectedTimeFilter = useSportsSidebarStore((s) => s.selectedTimeFilter);
  const searchQuery = useSportsSidebarStore((s) => s.searchQuery);
  const modes = useSportsSidebarStore((s) => s.modes);
  const treeStatus = useSportsSidebarStore((s) => s.treeStatus);
  const selectedMatchIds = useSportsSidebarStore((s) => s.selectedMatchIds);

  useEffect(() => {
    hydrateStoreFromUrl();
  }, []);

  useEffect(() => {
    syncStoreToUrl({ selectedLeagueId, selectedSportId, selectedCountryId, selectedTimeFilter, searchQuery, modes, treeStatus, selectedMatchIds });
  }, [selectedLeagueId, selectedSportId, selectedCountryId, selectedTimeFilter, searchQuery, modes, treeStatus, selectedMatchIds]);

  return null;
}
