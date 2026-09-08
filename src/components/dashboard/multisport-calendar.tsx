"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { resolvePlayerPhoto } from "@/lib/player-photos";
import { useSportsSidebarStore } from "@/stores/use-sports-sidebar-store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SportFilter = "all" | "football" | "tennis" | "basketball" | "baseball" | "cycling" | "cs2" | "mma" | "f1" | "rugby";

type CalendarMatch = {
  id: string;
  sport: string;
  sportIcon: string;
  homeName: string;
  awayName: string;
  homePhoto?: string | null;
  awayPhoto?: string | null;
  scheduledAt: string;
  isLive: boolean;
  leagueName: string;
  countryName: string;
  edgePct?: number;
  odds?: { home: number; draw?: number; away: number };
  /** Indique si une dropping odds est détectée sur ce match */
  droppingOdds?: boolean;
};

/** Données brutes depuis /api/v1/calendar/matches */
type CalendarApiMatch = {
  id: string;
  sport: string;
  league: string;
  country: string;
  homeTeam: string;
  awayTeam: string;
  scheduledAt: string;
  status: "scheduled" | "live" | "finished";
  score?: { home: number; away: number };
  odds?: { home: number; draw?: number; away: number };
  edge?: number;
};

const SPORT_TABS: { key: SportFilter; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "football", label: "Football" },
  { key: "tennis", label: "Tennis" },
  { key: "basketball", label: "Basketball" },
  { key: "baseball", label: "Baseball" },
  { key: "cycling", label: "Cyclisme" },
  { key: "cs2", label: "CS2" },
  { key: "mma", label: "MMA" },
  { key: "rugby", label: "Rugby" },
];

/** Clé spéciale pour l'onglet "Dropping Odds" */
const DROPPING_ODDS_KEY = "__dropping_odds__" as SportFilter;

/** Vues non-sport (accueil, nav mobile) : pas de filtre sport via onglet. */
const NAV_VIEWS = new Set(["home", "live", "value", "favoris", "profil"]);

const SPORT_ICONS: Record<string, string> = {
  football: "⚽",
  tennis: "🎾",
  basketball: "🏀",
  baseball: "⚾",
  cycling: "🚴",
  cs2: "🔫",
  mma: "🥊",
  f1: "🏎️",
  rugby: "🏉",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatHour(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "??:??";
    return new Intl.DateTimeFormat("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Paris",
    }).format(d);
  } catch {
    return "??:??";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MultisportCalendar({
  className,
  activeTab,
}: {
  className?: string;
  /** Onglet central actif : filtre les matchs par sport (home = tous). */
  activeTab?: string;
}) {
  const selectedSportId = useSportsSidebarStore((s) => s.selectedSportId);
  const headerMode = useSportsSidebarStore((s) => s.headerMode ?? "prematch");
  const selectSport = useSportsSidebarStore((s) => s.selectSport);

  // Fetch scraped calendar data via SWR (refresh every 60s to catch new scrapes)
  const { data: apiData, isValidating: isValidatingLegacy } = useSWR<{
    scraped_at: string;
    source: string;
    total: number;
    matches: Array<{
      sport: string;
      country: string;
      league: string;
      time: string;
      home: string;
      away: string;
      odds: number[];
      score: string | null;
      isLive: boolean;
    }>;
  }>("/api/v1/multisport-calendar", {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
    dedupingInterval: 30_000,
    onError: () => {},
  });

  // Source secondaire : route /api/v1/calendar/matches (agrège BSD + Flashscore + BetExplorer)
  const { data: calendarData, isValidating: isValidatingCalendar } = useSWR<CalendarApiMatch[]>(
    "/api/v1/calendar/matches",
    {
      refreshInterval: 60_000,
      revalidateOnFocus: true,
      dedupingInterval: 30_000,
      onError: () => {},
    },
  );

  const isValidating = isValidatingLegacy || isValidatingCalendar;

  const allMatches = useMemo<CalendarMatch[]>(() => {
    // Clé de dédup par noms d'équipes normalisés
    const normalize = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
    const matchMap = new Map<string, CalendarMatch>();

    // 1) Source legacy : /api/v1/multisport-calendar
    if (apiData?.matches) {
      const legacyRaw = apiData.matches as Array<{
        sport: string;
        country: string;
        league: string;
        time: string;
        home: string;
        away: string;
        odds: number[];
        score: string | null;
        isLive: boolean;
      }>;
      for (const m of legacyRaw) {
        const key = `${normalize(m.home)}-${normalize(m.away)}`;
        matchMap.set(key, {
          id: `${m.sport}-${m.home}-${m.away}`,
          sport: m.sport,
          sportIcon: SPORT_ICONS[m.sport] ?? "🏆",
          homeName: m.home,
          awayName: m.away,
          homePhoto: resolvePlayerPhoto(m.home),
          awayPhoto: resolvePlayerPhoto(m.away),
          scheduledAt: m.time && /^\d{2}:\d{2}$/.test(m.time)
            ? (() => {
                const d = new Date();
                const [h, min] = m.time.split(":").map(Number);
                d.setHours(h, min, 0, 0);
                return d.toISOString();
              })()
            : new Date().toISOString(),
          isLive: m.isLive,
          leagueName: m.league,
          countryName: m.country,
          edgePct: undefined,
          odds: m.odds && m.odds.length >= 2
            ? { home: m.odds[0], draw: m.odds[1], away: m.odds[2] ?? m.odds[1] }
            : undefined,
        });
      }
    }

    // 2) Source secondaire : /api/v1/calendar/matches — fusionne ou ajoute
    if (calendarData) {
      for (const m of calendarData) {
        const key = `${normalize(m.homeTeam)}-${normalize(m.awayTeam)}`;
        const existing = matchMap.get(key);
        if (existing) {
          // Enrichir l'existant avec les données manquantes
          existing.odds = existing.odds ?? m.odds;
          existing.edgePct = existing.edgePct ?? m.edge;
          if (m.status === "live") existing.isLive = true;
        } else {
          matchMap.set(key, {
            id: m.id,
            sport: m.sport,
            sportIcon: SPORT_ICONS[m.sport] ?? "🏆",
            homeName: m.homeTeam,
            awayName: m.awayTeam,
            homePhoto: resolvePlayerPhoto(m.homeTeam),
            awayPhoto: resolvePlayerPhoto(m.awayTeam),
            scheduledAt: m.scheduledAt || new Date().toISOString(),
            isLive: m.status === "live",
            leagueName: m.league,
            countryName: m.country,
            edgePct: m.edge,
            odds: m.odds,
          });
        }
      }
    }

    const matches = Array.from(matchMap.values());

    // Détection dropping odds : un match a des cotes si edge > 0
    // (signal que le modèle détecte une valeur significative)
    for (const m of matches) {
      m.droppingOdds = (m.edgePct ?? 0) > 0;
    }

    return matches.sort((a, b) => (a.isLive === b.isLive ? 0 : a.isLive ? -1 : 1));
  }, [apiData, calendarData]);

  // L'onglet central prime : sur un sport précis, on ne montre que ce sport.
  // Sinon (home/vues nav) on utilise la sélection sidebar.
  const effectiveSport =
    activeTab && !NAV_VIEWS.has(activeTab) ? activeTab : (selectedSportId as SportFilter | null);

  const filtered = useMemo(() => {
    let result = allMatches;
    // Filtre sport depuis la sidebar / onglet
    if (effectiveSport && effectiveSport !== DROPPING_ODDS_KEY) {
      result = result.filter((m) => m.sport === effectiveSport);
    }
    // Filtre live/prematch depuis mode-toggle header
    if (headerMode === "live") {
      result = result.filter((m) => m.isLive);
    } else if (headerMode === "prematch") {
      result = result.filter((m) => !m.isLive);
    }
    // Filtre dropping odds : afficher uniquement les matchs avec dropping odds
    if (effectiveSport === DROPPING_ODDS_KEY) {
      result = result.filter((m) => m.droppingOdds);
    }
    return result;
  }, [allMatches, effectiveSport, headerMode]);

  const sportCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of allMatches) {
      counts[m.sport] = (counts[m.sport] ?? 0) + 1;
    }
    return counts;
  }, [allMatches]);

  const droppingOddsCount = useMemo(
    () => allMatches.filter((m) => m.droppingOdds).length,
    [allMatches],
  );

  if (isValidating && allMatches.length === 0) {
    return (
      <section className={cn("space-y-3", className)}>
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Calendrier du jour
        </h3>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Calendrier du jour ({allMatches.length})
        </h3>
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
          {SPORT_TABS.map((tab) => {
            const count = tab.key === "all" ? allMatches.length : (sportCounts[tab.key] ?? 0);
            if (tab.key !== "all" && count === 0) return null;
            const isActive = tab.key === "all" ? !effectiveSport : effectiveSport === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => selectSport(tab.key === "all" ? null : tab.key)}
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap",
                  isActive
                    ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {tab.label}
                {count > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
          {/* Onglet Dropping Odds */}
          {droppingOddsCount > 0 && selectedSportId !== DROPPING_ODDS_KEY && (
            <button
              type="button"
              onClick={() => selectSport(DROPPING_ODDS_KEY)}
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap",
                effectiveSport === DROPPING_ODDS_KEY
                  ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              📉 Dropping
              <span className="ml-1 inline-flex items-center justify-center rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                {droppingOddsCount}
              </span>
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex items-center justify-center rounded-xl border border-dashed border-border p-8 text-sm text-muted-foreground">
          Aucun match{" "}
          {headerMode === "live" ? "en direct" : "à venir"}{" "}
          {effectiveSport && effectiveSport !== DROPPING_ODDS_KEY ? `en ${effectiveSport}` : "aujourd'hui"}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-muted/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2.5 font-medium">Heure</th>
                <th className="px-3 py-2.5 font-medium">Match</th>
                <th className="px-3 py-2.5 font-medium">Compétition</th>
                <th className="px-3 py-2.5 font-medium text-right">Edge</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filtered.map((m) => {
                const isLive = m.isLive;
                return (
                  <tr
                    key={`${m.sport}-${m.id}`}
                    data-match-id={m.id}
                    data-sport={m.sport}
                    onClick={() => {
                      window.dispatchEvent(
                        new CustomEvent("open-match-detail", {
                          detail: { sport: m.sport, matchId: m.id },
                        }),
                      );
                    }}
                    className={cn(
                      "cursor-pointer transition-all hover:bg-slate-800/50",
                      isLive && "bg-rose-500/5 hover:bg-rose-500/10",
                    )}
                  >
                    <td className="px-3 py-2.5 font-mono text-xs tabular-nums whitespace-nowrap text-slate-400">
                      {isLive ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full scale-150 animate-pulse-soft rounded-full bg-rose-500 opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
                          </span>
                          <span className="text-[11px] font-bold uppercase text-rose-500">LIVE</span>
                        </span>
                      ) : (
                        formatHour(m.scheduledAt)
                      )}
                    </td>
                    <td className="px-3 py-2.5 min-w-[240px]">
                      <div className="flex items-center gap-2">
                        <PlayerAvatar
                          name={m.homeName}
                          photoUrl={m.homePhoto}
                          size="sm"
                          sport={m.sport as any}
                          className="shrink-0"
                        />
                        <span className="flex-1 truncate font-medium text-right text-slate-100 text-xs">
                          {m.homeName}
                        </span>
                        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-zinc-500 px-1">
                          VS
                        </span>
                        <span className="flex-1 truncate font-medium text-left text-slate-100 text-xs">
                          {m.awayName}
                        </span>
                        <PlayerAvatar
                          name={m.awayName}
                          photoUrl={m.awayPhoto}
                          size="sm"
                          sport={m.sport as any}
                          className="shrink-0"
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-400">
                      {m.leagueName}
                      {m.countryName !== "International" && (
                        <span className="ml-1 text-slate-500">· {m.countryName}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {m.droppingOdds && (
                          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] shrink-0">
                            📉 Drop
                          </Badge>
                        )}
                        {m.edgePct != null ? (
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold font-mono tabular-nums",
                              m.edgePct > 0
                                ? "bg-emerald-500/15 text-emerald-400"
                                : "bg-red-500/15 text-red-400",
                            )}
                          >
                            {m.edgePct > 0 ? "+" : ""}{m.edgePct}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
