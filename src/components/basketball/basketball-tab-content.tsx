"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { cn } from "@/lib/utils";
import { MatchViewTabs } from "@/components/shared/match-view-tabs";
import { MatchEmptyState } from "@/components/shared/match-empty-state";
import { type MatchViewMode } from "@/lib/match-view";
import { selectBasketballView } from "@/lib/basketball-view";
import { useSportsSidebarStore } from "@/stores/use-sports-sidebar-store";
import { LeagueSelector } from "./basketball-league-selector";
import { BasketballMatchCard, BasketballMatchCardSkeleton } from "./basketball-match-card";
import { BasketballErrorBoundary } from "./basketball-error-boundary";
import { BasketballHeroHeader } from "./basketball-hero-header";
import { useBasketballMatches } from "@/hooks/use-basketball-matches";
import { useEuroLeagueMatches } from "@/hooks/use-euroleague-matches";
import { useVitibetPredictions } from "@/hooks/use-vitibet-predictions";
import { matchEuroLeagueFixture } from "@/lib/basketball-vitibet-euro-join";
import type { BasketballLeagueId } from "@/lib/basketball-data";
import type { BasketballMatch } from "@/hooks/use-basketball-matches";
import dynamic from "next/dynamic";

const BasketballMatchDetailDialog = dynamic(
  () => import("./basketball-match-detail-dialog").then((m) => m.BasketballMatchDetailDialog),
  { ssr: false },
);

const BasketballH2H = dynamic(
  () => import("./basketball-h2h").then((m) => m.BasketballH2H),
  { ssr: false },
);

const FibaScoreboard = dynamic(
  () => import("./fiba/fiba-scoreboard").then((m) => m.FibaScoreboard),
  { ssr: false },
);

const BasketballCalendar = dynamic(
  () => import("./basketball-calendar").then((m) => m.BasketballCalendar),
  { ssr: false },
);

const BasketballStandings = dynamic(
  () => import("./basketball-standings").then((m) => m.BasketballStandings),
  { ssr: false },
);

const BasketballLive = dynamic(
  () => import("./basketball-live").then((m) => m.BasketballLive),
  { ssr: false },
);

const BasketballBacktest = dynamic(
  () => import("./basketball-backtest").then((m) => m.BasketballBacktest),
  { ssr: false },
);

type BasketballTabContentProps = {
  className?: string;
};

/** Match unifié pour l'UI (source ESPN ou EuroLeague) — réexporté de basketball-types. */
export type UnifiedMatch = {
  id: string;
  league: string;
  scheduledAt: string;
  status: string;
  home: { abbr: string; name: string; score: number | null; record: string | null };
  away: { abbr: string; name: string; score: number | null; record: string | null };
  pHome: number | null;
  pAway: number | null;
  edgeElo: number | null;
  /**
   * true ⇔ une prédiction RÉELLEMENT publiée existe pour ce match. `false` ⇒
   * `pHome`/`pAway`/`edgeElo` sont `null` et l'UI masque tout signal financier.
   * Absent pour les matchs ESPN (qui portent déjà leur propre modèle).
   */
  predictionsAvailable?: boolean;
  /** Raison motivant l'absence de prédiction, si la source l'a fournie. */
  predictionsUnavailableReason?: string | null;
  /** Score prédit par la source 1xBet (« 90:83 »), null si non publié. */
  predictedScore?: string | null;
  /** Index Vitisport, null si non publié. */
  vitibetIndex?: number | null;
  /** Nombre de confrontations directes trouvées par la source. */
  h2hCount?: number | null;
  injuries?: BasketballMatch["injuries"];
  consensus?: BasketballMatch["consensus"];
};

type PageView = "matchs" | "calendrier" | "live" | "stats" | "backtest" | "h2h" | "fiba";

export function BasketballTabContent({ className }: BasketballTabContentProps) {
  // pageView piloté par le store (sportSubTabs.basketball) : le toggle interne
  // et la rangée SportSubTabs de la headbar restent synchronisés.
  const pageViewRaw = useSportsSidebarStore((s) => s.sportSubTabs.basketball);
  const pageView = (pageViewRaw as PageView | undefined) ?? "matchs";
  const setPageView = (v: PageView) => useSportsSidebarStore.getState().setSubTab("basketball", v);
  const [viewMode, setViewMode] = useState<MatchViewMode>("today");
  const [selectedLeagues, setSelectedLeagues] = useState<BasketballLeagueId[]>([
    "nba", "wnba", "euroleague", "eurocup",
  ]);
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
  const [detailMatch, setDetailMatch] = useState<BasketballMatch | null>(null);

  // Data fetching
  const { matches: nbaWnbaMatches, isLoading: nbaWnbaLoading, error: nbaWnbaError } = useBasketballMatches();
  const { matches: euroMatches, isLoading: euroLoading, apiError: euroError } = useEuroLeagueMatches("euroleague");
  const { matches: cupMatches, isLoading: cupLoading, apiError: cupError } = useEuroLeagueMatches("eurocup");
  // 1xBet (Vitibet) : source ENRICHISSANTE de l'EuroLeague uniquement. La NBA /
  // WNBA restent sur ESPN — mesuré, Vitibet ne publie aucune probabilité sur ces
  // deux ligues (0/16 et 1/1), donc y mélanger dégraderait le modèle ESPN.
  const { predictions: euroPredictions } = useVitibetPredictions("euroleague");
  /**
   * Raison de l'absence de prédiction, déduite de CE QUE LA SOURCE A DIT pour
   * les matchs de la série. On ne l'invente pas : si aucun match de la journée
   * n'a de proba, la source n'en publie pas pour cette ligue aujourd'hui.
   * Distingue « la source ne publie rien ici » de « la requête a échoué ».
   */
  const noEuroPredictionReason = useMemo(() => {
    if (euroPredictions.length === 0) {
      return "Aucune donnée 1xBet disponible pour l'EuroLeague — le flux Vitibet n'a rien publié sur la fenêtre en cours.";
    }
    if (euroPredictions.some((p) => p.predictionsAvailable)) {
      // Une partie de la série est prédite : l'absence sur CE match est une
      // sélection, pas une panne de source.
      return "Vitibet ne publie pas de probabilité pour ce match précis (cellules 0 % sur le pop-up).";
    }
    return euroPredictions[0].predictionsUnavailableReason ?? "La source ne publie aucune probabilité pour cette ligue.";
  }, [euroPredictions]);

  const isLoading = nbaWnbaLoading || euroLoading || cupLoading;
  const errors = [nbaWnbaError, euroError, cupError].filter(Boolean);

  // Index Vitibet → match API, résolu UNE fois par `matchEuroLeagueFixture`
  // (jamais par similarité floue). Les deux ordres de noms sont indexés : une
  // rencontre peut être listée domiciliation à l'envers d'une source à l'autre.
  const vitibetByPair = useMemo(() => {
    const apiFixtures = euroMatches.map((m) => ({
      home: { name: m.home.name },
      away: { name: m.away.name },
    }));
    const index = new Map<string, (typeof euroPredictions)[number]>();
    for (const pred of euroPredictions) {
      if (!pred.predictionsAvailable) continue;
      const hit = matchEuroLeagueFixture(
        { home: { name: pred.home.name }, away: { name: pred.away.name } },
        apiFixtures,
      );
      if (!hit) continue;
      index.set(`${hit.home.name}|${hit.away.name}`, pred);
      index.set(`${hit.away.name}|${hit.home.name}`, pred);
    }
    return index;
  }, [euroPredictions, euroMatches]);

  // Fusionner et filtrer par ligue sélectionnée
  const allMatches = useMemo(() => {
    const matches: UnifiedMatch[] = [];
    if (selectedLeagues.includes("nba") || selectedLeagues.includes("wnba")) {
      matches.push(...(nbaWnbaMatches ?? []).map((m) => ({
        id: m.id,
        league: m.league,
        scheduledAt: m.scheduledAt,
        status: m.status,
        home: m.home,
        away: m.away,
        pHome: m.pHome,
        pAway: m.pAway,
        edgeElo: m.edgeElo,
        injuries: m.injuries,
        consensus: m.consensus,
      })));
    }
    if (selectedLeagues.includes("euroleague")) {
      matches.push(...(euroMatches ?? []).map((m) => {
        // Prédiction 1xBet si elle existe ET si elle a été appariée à CETTE
        // rencontre. Sans appariement : null partout, jamais la proba d'un autre
        // match.
        const pred = vitibetByPair.get(`${m.home.name}|${m.away.name}`) ?? null;
        return {
        id: String(m.id),
        league: "EuroLeague",
        scheduledAt: m.startTime,
        status: m.status === "live" ? "in-progress" : m.status === "finished" ? "post" : "pre",
        home: { abbr: m.home.code, name: m.home.name, score: m.homeScore, record: null },
        away: { abbr: m.away.code, name: m.away.name, score: m.awayScore, record: null },
        pHome: pred?.probHome ?? null,
        pAway: pred?.probAway ?? null,
        edgeElo: pred?.index ?? null,
        predictionsAvailable: pred !== null,
        predictionsUnavailableReason: pred === null ? noEuroPredictionReason : null,
        predictedScore: pred?.predictedScore ?? null,
        vitibetIndex: pred?.index ?? null,
        h2hCount: pred ? pred.h2h.length : null,
      };
      }));
    }
    if (selectedLeagues.includes("eurocup")) {
      matches.push(...(cupMatches ?? []).map((m) => ({
        id: String(m.id),
        league: "EuroCup",
        scheduledAt: m.startTime,
        status: m.status === "live" ? "in-progress" : m.status === "finished" ? "post" : "pre",
        home: { abbr: m.home.code, name: m.home.name, score: m.homeScore, record: null },
        away: { abbr: m.away.code, name: m.away.name, score: m.awayScore, record: null },
        pHome: null,
        pAway: null,
        edgeElo: null,
      })));
    }
    return matches;
  }, [selectedLeagues, nbaWnbaMatches, euroMatches, cupMatches, vitibetByPair]);

  // Compteurs live/prematch
  const liveCount = useMemo(() => allMatches.filter((m) => m.status === "in-progress").length, [allMatches]);
  const prematchCount = useMemo(() => allMatches.filter((m) => m.status !== "in-progress").length, [allMatches]);

  // Filtrer par view mode
  // Fix debug 2026-09-23 : filterByStartWindow inconditionnel drop les live > 15 min
  const filteredMatches = useMemo(
    () => selectBasketballView(allMatches, viewMode),
    [viewMode, allMatches],
  );

  // Sidebar selection
  const selectedMatchIds = useSportsSidebarStore((s) => s.selectedMatchIds);

  // Ouvrir le dialog de détail quand un match basketball est sélectionné
  useEffect(() => {
    const handler = (e: Event) => {
      const evt = e as CustomEvent<{ sport?: string; matchId?: string }>;
      const { sport, matchId } = evt.detail ?? {};
      if (sport !== "basketball" || !matchId) return;
      // Chercher d'abord dans NBA/WNBA (données complètes), puis EuroLeague/EuroCup
      const match = (nbaWnbaMatches ?? []).find((m) => m.id === matchId)
        ?? (euroMatches ?? []).find((m) => String(m.id) === matchId) as unknown as BasketballMatch | undefined
        ?? (cupMatches ?? []).find((m) => String(m.id) === matchId) as unknown as BasketballMatch | undefined;
      if (match) setDetailMatch(match);
    };
    window.addEventListener("open-match-detail", handler);
    return () => window.removeEventListener("open-match-detail", handler);
    // Fix debug : deps euroMatches/cupMatches ajoutées (closure périmée sur les lookups euro)
  }, [nbaWnbaMatches, euroMatches, cupMatches]);

  return (
    <BasketballErrorBoundary>
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Hero — encart présentationnel dédié au sport (miroir football/hockey/handball).
          Affiché sur tous les sous-onglets ; les compteurs viennent de allMatches
          déjà chargés plus haut, donc aucun fetch supplémentaire. */}
      <BasketballHeroHeader
        liveCount={liveCount}
        upcomingCount={prematchCount}
        leagueCount={selectedLeagues.length}
        onCta={() => setPageView("matchs")}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Basket</h2>
        <div className="flex items-center gap-2">
          {/* Toggle Matchs / H2H / FIBA */}
          <div className="flex rounded-lg bg-white/[0.06] p-0.5">
            {([
              { id: "matchs" as const, label: "Matchs" },
              { id: "calendrier" as const, label: "Calendrier" },
              { id: "live" as const, label: "Live" },
              { id: "stats" as const, label: "Stats & Classements" },
              { id: "backtest" as const, label: "Backtest" },
              { id: "h2h" as const, label: "H2H" },
              { id: "fiba" as const, label: "FIBA WC" },
            ]).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setPageView(tab.id)}
                className={cn(
                  "rounded-md px-3 py-1 min-h-[36px] text-xs font-medium transition-all duration-150",
                  pageView === tab.id
                    ? "bg-primary/20 text-primary shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {pageView === "matchs" && (
            <MatchViewTabs
              active={viewMode}
              onChange={setViewMode}
              liveCount={liveCount}
              prematchCount={prematchCount}
              includeToday
              hideRankings
            />
          )}
        </div>
      </div>

      {/* League selector — visible en mode matchs */}
      {pageView === "matchs" && (
        <LeagueSelector
          selected={selectedLeagues}
          onChange={setSelectedLeagues}
        />
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
          {errors.map((e, i) => (
            <div key={i}>{String(e)}</div>
          ))}
        </div>
      )}

      {/* Vue Calendrier (style Flashscore/FotMob, 4 ligues) */}
      {pageView === "calendrier" && (
        <BasketballCalendar />
      )}

      {/* Vue Live (matchs en cours, rafraîchi) */}
      {pageView === "live" && (
        <BasketballLive
          matches={allMatches}
          isLoading={isLoading}
        />
      )}

      {/* Vue Stats & Classements (classement filtrable + heatmap rangs) */}
      {pageView === "stats" && (
        <BasketballStandings />
      )}

      {/* Vue Backtest (stratégies sur basketball_match_history) */}
      {pageView === "backtest" && (
        <BasketballBacktest />
      )}

      {/* Vue H2H */}
      {pageView === "h2h" && (
        <BasketballH2H defaultLeague="nba" />
      )}

      {/* Vue FIBA Women's World Cup */}
      {pageView === "fiba" && (
        <FibaScoreboard />
      )}

      {/* Vue Matchs */}
      {pageView === "matchs" && (
        <>
          {/* Loading */}
          {isLoading && (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-2" aria-busy="true">
              {Array.from({ length: 6 }).map((_, i) => (
                <BasketballMatchCardSkeleton key={`sk-${i}`} />
              ))}
            </div>
          )}

          {/* Empty */}
          {!isLoading && filteredMatches.length === 0 && (
            <MatchEmptyState mode={viewMode} />
          )}

          {/* Match cards */}
          {!isLoading && filteredMatches.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-2">
              {filteredMatches.map((match) => (
                <BasketballMatchCard
                  key={match.id}
                  match={match}
                  onClick={(m) => setExpandedMatch(m.id)}
                  onDetailRequest={(matchId) => {
                    window.dispatchEvent(
                      new CustomEvent("open-match-detail", {
                        detail: { sport: "basketball", matchId },
                      }),
                    );
                  }}
                  className={cn(
                    expandedMatch === match.id && "border-primary/50 ring-1 ring-primary/20",
                    selectedMatchIds.includes(match.id) && "border-primary",
                  )}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Dialog de détail basketball */}
      {detailMatch && (
        <Suspense fallback={null}>
          <BasketballMatchDetailDialog
            match={detailMatch}
            open
            onOpenChange={(open) => {
              if (!open) setDetailMatch(null);
            }}
          />
        </Suspense>
      )}
    </div>
    </BasketballErrorBoundary>
  );
}
