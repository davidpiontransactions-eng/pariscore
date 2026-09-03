"use client";

import { useMemo, useState } from "react";
import { LayoutGrid, Table, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardData } from "@/components/dashboard/dashboard-data-provider";
import { useBasketballMatches } from "@/hooks/use-basketball-matches";
import { useCs2Matches } from "@/hooks/use-cs2-matches";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { estimateFootballEloGap } from "@/lib/elo-utils";
import { parisKickoff } from "@/lib/football-time";
import {
  computeMatchScore,
  computeFootballScore,
  computeBasketballScore,
  computeCs2Score,
  type MatchScoreResult,
} from "@/lib/match-score";
import { TopMatchCard, type TopMatchData } from "@/components/tennis/top-match-card";
import { MultiSportMatchCard, type MultiSportMatchData } from "@/components/tennis/multi-sport-match-card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SportTab = "tennis" | "football" | "basketball" | "cs2" | "darts";

type BestMatchesTabsProps = { className?: string; id?: string };

type MatchCard = {
  id: string;
  sport: SportTab;
  matchName: string;
  detail1: string;
  detail2: string;
  scheduledAt: string;
};

/** Match tennis avec score 0-10 pour l'affichage "Meilleurs matchs". */
type ScoredTennisMatch = TopMatchData;

/** Match generique multi-sport avec score 0-10. */
type ScoredMultiSportMatch = MultiSportMatchData;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SPORT_ICONS: Record<SportTab, string> = {
  tennis: "🎾",
  football: "⚽",
  basketball: "🏀",
  cs2: "🔫",
  darts: "🎯",
};

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function MatchCardSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3" aria-busy="true">
      <Skeleton className="h-8 w-8 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-5 w-14 rounded-full" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BestMatchesTabs({ className, id }: BestMatchesTabsProps) {
  const [activeTab, setActiveTab] = useState<SportTab>("tennis");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [showFilters, setShowFilters] = useState(false);
  // Filtres avancés — seuils ajustables par l'utilisateur
  const [minEloGap, setMinEloGap] = useState(150);
  const [minSps, setMinSps] = useState(55);
  const { tennisData, tennisLoading, tennisError } = useDashboardData();
  const { footData, footLoading, footError } = useDashboardData();
  // Basket / CS2 — données réelles via les routes API v1 (SWR, poll 60s)
  const {
    matches: basketData,
    isLoading: basketLoading,
    error: basketError,
  } = useBasketballMatches();
  const {
    matches: cs2Data,
    isLoading: cs2Loading,
    error: cs2Error,
  } = useCs2Matches();

  // ── Tennis : ΔElo ≥ minEloGap OU SPS ≥ minSps ──
  const tennisMatches = useMemo<MatchCard[]>(() => {
    const matches = tennisData?.matches ?? [];
    return matches
      .filter((m) => {
        const eloGap = Math.abs(m.playerA.elo - m.playerB.elo);
        const maxSps = Math.max(m.playerA.sps ?? 0, m.playerB.sps ?? 0);
        return eloGap >= minEloGap || maxSps >= minSps;
      })
      .map((m) => {
        // ΔSPS dynamique : |sps1 − sps2| si les 2 existent (et diffèrent),
        // sinon valeur unique si > 0, sinon rien (jamais "SPS 0").
        const a = m.playerA.sps ?? null;
        const b = m.playerB.sps ?? null;
        const delta = a != null && b != null ? Math.abs(a - b) : 0;
        let spsTxt = "";
        if (delta > 0) {
          spsTxt = `ΔSPS ${Math.round(delta)}`;
        } else {
          const single = Math.max(a ?? 0, b ?? 0);
          if (single > 0) spsTxt = `SPS ${single}`;
        }
        return {
          id: m.id,
          sport: "tennis" as const,
          matchName: `${m.playerA.shortName} vs ${m.playerB.shortName}`,
          detail1: [`ΔElo ${Math.round(Math.abs(m.playerA.elo - m.playerB.elo))}`, spsTxt].filter(Boolean).join(" · "),
          detail2: m.tournament,
          scheduledAt: m.scheduledAt,
        };
      })
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }, [tennisData?.matches, minEloGap, minSps]);

  // ── Tennis avec score 0-10 pour "Meilleurs matchs" ──
  const scoredTennisMatches = useMemo<ScoredTennisMatch[]>(() => {
    const matches = tennisData?.matches ?? [];
    return matches
      .filter((m) => {
        const eloGap = Math.abs(m.playerA.elo - m.playerB.elo);
        const maxSps = Math.max(m.playerA.sps ?? 0, m.playerB.sps ?? 0);
        return eloGap >= minEloGap || maxSps >= minSps;
      })
      .map((m) => {
        const scoreResult = computeMatchScore({
          probA: m.probA ?? 50,
          eloA: m.playerA.elo ?? 1500,
          eloB: m.playerB.elo ?? 1500,
          rankA: m.playerA.rank ?? 999,
          rankB: m.playerB.rank ?? 999,
          formA: m.playerA.form,
          formB: m.playerB.form,
          tournament: m.tournament,
          round: m.round,
          h2hHistory: m.h2hHistory,
          playerAId: m.playerA.id,
        });

        return {
          id: m.id,
          playerA: {
            name: m.playerA.name,
            shortName: m.playerA.shortName,
            rank: m.playerA.rank,
            elo: m.playerA.elo,
            country: m.playerA.country,
            form: m.playerA.form,
            sps: m.playerA.sps,
          },
          playerB: {
            name: m.playerB.name,
            shortName: m.playerB.shortName,
            rank: m.playerB.rank,
            elo: m.playerB.elo,
            country: m.playerB.country,
            form: m.playerB.form,
            sps: m.playerB.sps,
          },
          tournament: m.tournament,
          round: m.round,
          scheduledAt: m.scheduledAt,
          probA: m.probA ?? 50,
          probB: m.probB ?? 50,
          odds: m.odds,
          matchScore: {
            score: scoreResult.score,
            label: scoreResult.label,
            labelColor: scoreResult.labelColor,
            labelBg: scoreResult.labelBg,
            breakdown: scoreResult.breakdown,
          },
        };
      })
      .sort((a, b) => b.matchScore.score - a.matchScore.score);
  }, [tennisData?.matches, minEloGap, minSps]);

  // ── Football avec score 0-10 ──
  const scoredFootballMatches = useMemo<ScoredMultiSportMatch[]>(() => {
    const matches = footData?.matches ?? [];
    return matches
      .filter((m) => {
        const gap = estimateFootballEloGap(m);
        return gap >= minEloGap;
      })
      .map((m) => {
        const scoreResult = computeFootballScore({
          homeProb: m.prediction.homeProb,
          drawProb: m.prediction.drawProb,
          awayProb: m.prediction.awayProb,
          homeRank: m.home.rank,
          awayRank: m.away.rank,
          homeForm: m.home.form,
          awayForm: m.away.form,
          league: m.league.name,
          round: m.round,
        });

        return {
          id: m.id,
          sport: "football" as const,
          teamA: {
            name: m.home.name,
            shortName: m.home.shortName,
            rank: m.home.rank,
            form: m.home.form,
          },
          teamB: {
            name: m.away.name,
            shortName: m.away.shortName,
            rank: m.away.rank,
            form: m.away.form,
          },
          competition: m.league.name,
          round: m.round,
          scheduledAt: m.scheduledAt,
          probA: m.prediction.homeProb,
          probB: m.prediction.awayProb,
          probDraw: m.prediction.drawProb,
          odds: m.odds ? { home: m.odds.home, draw: m.odds.draw, away: m.odds.away } : undefined,
          matchScore: {
            score: scoreResult.score,
            label: scoreResult.label,
            labelColor: scoreResult.labelColor,
            labelBg: scoreResult.labelBg,
            breakdown: scoreResult.breakdown,
          },
        };
      })
      .sort((a, b) => b.matchScore.score - a.matchScore.score);
  }, [footData?.matches, minEloGap]);

  // ── Basketball avec score 0-10 ──
  const scoredBasketballMatches = useMemo<ScoredMultiSportMatch[]>(() => {
    return (basketData ?? []).map((m) => {
      const scoreResult = computeBasketballScore({
        pHome: m.pHome,
        edgeElo: m.edgeElo,
        homeRecord: m.home.record,
        awayRecord: m.away.record,
        league: m.league,
      });

      return {
        id: m.id,
        sport: "basketball" as const,
        teamA: {
          name: m.home.name,
          shortName: m.home.abbr || m.home.name,
          record: m.home.record ?? undefined,
        },
        teamB: {
          name: m.away.name,
          shortName: m.away.abbr || m.away.name,
          record: m.away.record ?? undefined,
        },
        competition: m.league,
        scheduledAt: m.scheduledAt,
        probA: m.pHome != null ? m.pHome * 100 : null,
        probB: m.pAway != null ? m.pAway * 100 : null,
        matchScore: {
          score: scoreResult.score,
          label: scoreResult.label,
          labelColor: scoreResult.labelColor,
          labelBg: scoreResult.labelBg,
          breakdown: scoreResult.breakdown,
        },
      };
    });
  }, [basketData]);

  // ── CS2 avec score 0-10 ──
  const scoredCs2Matches = useMemo<ScoredMultiSportMatch[]>(() => {
    return (cs2Data ?? []).map((m) => {
      const scoreResult = computeCs2Score({
        team1Rank: m.team1.rank,
        team2Rank: m.team2.rank,
        bestOf: m.bestOf,
        tournament: m.tournament,
      });

      return {
        id: m.id,
        sport: "cs2" as const,
        teamA: {
          name: m.team1.name,
          shortName: m.team1.name,
          rank: m.team1.rank,
        },
        teamB: {
          name: m.team2.name,
          shortName: m.team2.name,
          rank: m.team2.rank,
        },
        competition: m.tournament,
        scheduledAt: m.scheduledAt,
        matchScore: {
          score: scoreResult.score,
          label: scoreResult.label,
          labelColor: scoreResult.labelColor,
          labelBg: scoreResult.labelBg,
          breakdown: scoreResult.breakdown,
        },
      };
    });
  }, [cs2Data]);

  // ── Football : ΔElo ≥ minEloGap ──
  const footballMatches = useMemo<MatchCard[]>(() => {
    const matches = footData?.matches ?? [];
    return matches
      .filter((m) => {
        const gap = estimateFootballEloGap(m);
        return gap >= minEloGap;
      })
      .map((m) => ({
        id: m.id,
        sport: "football" as const,
        matchName: `${m.home.shortName} vs ${m.away.shortName}`,
        detail1: `ΔElo ~${estimateFootballEloGap(m)} · ${m.prediction.homeProb}-${m.prediction.awayProb}`,
        detail2: `${m.league.name} · ${m.round}`,
        scheduledAt: m.scheduledAt,
      }))
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }, [footData?.matches, minEloGap]);

  // ── Basketball (NBA + WNBA) : modèle ESPN (blend) + écart Elo ──
  const basketballMatches = useMemo<MatchCard[]>(() => {
    return (basketData ?? []).map((m) => {
      const parts: string[] = [];
      if (m.edgeElo != null) parts.push(`ΔElo ${m.edgeElo}`);
      if (m.pHome != null) parts.push(`${m.pHome}-${m.pAway}`);
      return {
        id: m.id,
        sport: "basketball" as const,
        matchName: `${m.home.abbr || m.home.name} vs ${m.away.abbr || m.away.name}`,
        detail1: parts.join(" · ") || "—",
        detail2: m.home.record ? `${m.league} · ${m.home.record}` : m.league,
        scheduledAt: m.scheduledAt,
      };
    });
  }, [basketData]);

  // ── CS2 : classement HLTV + tournoi ──
  const cs2Matches = useMemo<MatchCard[]>(() => {
    return (cs2Data ?? []).map((m) => ({
      id: m.id,
      sport: "cs2" as const,
      matchName: `${m.team1.name} vs ${m.team2.name}`,
      detail1:
        m.team1.rank != null || m.team2.rank != null
          ? `HLTV #${m.team1.rank ?? "?"} · #${m.team2.rank ?? "?"}`
          : `BO${m.bestOf ?? 3}${m.currentMap ? ` · ${m.currentMap}` : ""}`,
      detail2: m.tournament,
      scheduledAt: m.scheduledAt,
    }));
  }, [cs2Data]);

  const allTabs: {
    key: SportTab;
    label: string;
    matches: MatchCard[];
    loading: boolean;
    error?: string;
  }[] = [
    { key: "tennis", label: "🎾 Tennis", matches: tennisMatches, loading: tennisLoading, error: tennisError?.message },
    { key: "football", label: "⚽ Football", matches: footballMatches, loading: footLoading, error: footError?.message },
    {
      key: "basketball",
      label: "🏀 Basketball",
      matches: basketballMatches,
      loading: basketLoading,
      error: basketError?.message,
    },
    {
      key: "cs2",
      label: "🔫 CS2",
      matches: cs2Matches,
      loading: cs2Loading,
      error: cs2Error?.message,
    },
  ];
  // Affiche un sport s'il a des données, charge, ou est en erreur (pour
  // pouvoir montrer l'état d'erreur). Darts est un onglet désactivé séparé.
  const tabs = allTabs.filter((t) => t.matches.length > 0 || t.loading || !!t.error);

  const current = tabs.find((t) => t.key === activeTab) ?? tabs[0];

  // Tous les sports en erreur ou vide : etat vide au lieu d'un crash page blanche.
  if (!current) {
    return (
      <section id={id} className={cn("scroll-mt-20 space-y-3", className)}>
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          MEILLEURS MATCHS DU JOUR
        </h3>
        <p className="text-sm text-muted-foreground">Aucun match disponible pour le moment. Reessayez dans quelques instants.</p>
      </section>
    );
  }

  return (
    <section id={id} className={cn("scroll-mt-20 space-y-3", className)}>
      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
        ⭐ MEILLEURS MATCHS DU JOUR
      </h3>

      {/* Filter toggle + panel */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            showFilters
              ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30"
              : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <SlidersHorizontal className="h-3 w-3" />
          Filtres
          {(minEloGap !== 150 || minSps !== 55) && (
            <span className="inline-flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-emerald-500/30 px-1 text-xs font-bold text-emerald-300">
              !
            </span>
          )}
        </button>
        {(minEloGap !== 150 || minSps !== 55) && (
          <button
            type="button"
            onClick={() => { setMinEloGap(150); setMinSps(55); }}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3 w-3" />
            Réinitialiser
          </button>
        )}
      </div>

      {showFilters && (
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">ΔElo minimum</label>
              <span className="text-xs font-mono font-semibold text-emerald-400 tabular-nums">{minEloGap}</span>
            </div>
            <Slider
              value={[minEloGap]}
              onValueChange={([v]) => setMinEloGap(v)}
              min={0}
              max={300}
              step={10}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground/60">
              <span>0 (tout)</span>
              <span>150 (défaut)</span>
              <span>300 (strict)</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">SPS minimum</label>
              <span className="text-xs font-mono font-semibold text-emerald-400 tabular-nums">{minSps}</span>
            </div>
            <Slider
              value={[minSps]}
              onValueChange={([v]) => setMinSps(v)}
              min={0}
              max={100}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground/60">
              <span>0 (tout)</span>
              <span>55 (défaut)</span>
              <span>100 (max)</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab bar + view toggle */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none flex-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              activeTab === tab.key
                ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {tab.label}
            {tab.matches.length > 0 && (
              <span className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-emerald-500/30 px-1 text-xs font-bold text-emerald-300">
                {tab.matches.length}
              </span>
            )}
          </button>
        ))}
          {/* Darts — aucune route API pour l'instant : onglet désactivé "Bientôt"
              (présent mais non cliquable, pas de code mort) */}
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="Bientôt disponible"
            className="shrink-0 cursor-not-allowed rounded-full bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground/60"
          >
            🎯 Darts
            <span className="ml-1.5 text-xs font-bold uppercase tracking-wider">
              Bientôt
            </span>
          </button>
        </div>

        {/* View toggle */}
        <div className="flex shrink-0 rounded-lg border border-border/60 bg-muted/30 p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={cn(
              "rounded-md p-1.5 transition-colors",
              viewMode === "grid"
                ? "bg-white/10 text-emerald-400"
                : "text-muted-foreground hover:text-foreground",
            )}
            title="Vue cartes"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={cn(
              "rounded-md p-1.5 transition-colors",
              viewMode === "table"
                ? "bg-white/10 text-emerald-400"
                : "text-muted-foreground hover:text-foreground",
            )}
            title="Vue tableau"
          >
            <Table className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      {current.loading ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <MatchCardSkeleton key={i} />
          ))}
        </div>
      ) : current.matches.length === 0 ? (
        <div className="flex items-center justify-center rounded-xl border border-dashed border-border p-8 text-sm text-muted-foreground">
          {current.error
            ? `Impossible de charger les données ${current.label}`
            : current.key === "tennis" || current.key === "football"
              ? "Aucun match avec fort écart Elo aujourd'hui"
              : `Données ${current.label} bientôt disponibles`}
        </div>
      ) : viewMode === "grid" ? (
        /* Vue cartes avec score 0-10 */
        <div className="flex flex-col gap-3 max-h-[600px] overflow-y-auto">
          {/* Tennis : TopMatchCard specifique */}
          {current.key === "tennis" && scoredTennisMatches.map((match) => (
            <TopMatchCard
              key={`tennis-${match.id}`}
              match={match}
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent("open-match-detail", {
                    detail: { sport: "tennis", matchId: match.id },
                  }),
                );
              }}
            />
          ))}
          {/* Football : MultiSportMatchCard */}
          {current.key === "football" && scoredFootballMatches.map((match) => (
            <MultiSportMatchCard
              key={`football-${match.id}`}
              match={match}
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent("open-match-detail", {
                    detail: { sport: "football", matchId: match.id },
                  }),
                );
              }}
            />
          ))}
          {/* Basketball : MultiSportMatchCard */}
          {current.key === "basketball" && scoredBasketballMatches.map((match) => (
            <MultiSportMatchCard
              key={`basketball-${match.id}`}
              match={match}
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent("open-match-detail", {
                    detail: { sport: "basketball", matchId: match.id },
                  }),
                );
              }}
            />
          ))}
          {/* CS2 : MultiSportMatchCard */}
          {current.key === "cs2" && scoredCs2Matches.map((match) => (
            <MultiSportMatchCard
              key={`cs2-${match.id}`}
              match={match}
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent("open-match-detail", {
                    detail: { sport: "cs2", matchId: match.id },
                  }),
                );
              }}
            />
          ))}
        </div>
      ) : (
        /* Vue tableau avec score */
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2.5 font-medium">Heure</th>
                <th className="px-3 py-2.5 font-medium">Sport</th>
                <th className="px-3 py-2.5 font-medium">Rencontre</th>
                <th className="px-3 py-2.5 font-medium">Score</th>
                <th className="px-3 py-2.5 font-medium text-right">Competition</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {/* Tennis */}
              {current.key === "tennis" && scoredTennisMatches.map((match) => (
                <tr
                  key={`tennis-${match.id}`}
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent("open-match-detail", {
                        detail: { sport: "tennis", matchId: match.id },
                      }),
                    );
                  }}
                  className="cursor-pointer transition-all hover:bg-slate-800/40"
                >
                  <td className="px-3 py-2.5 font-mono text-xs tabular-nums whitespace-nowrap">
                    {parisKickoff(match.scheduledAt)}
                  </td>
                  <td className="px-3 py-2.5 text-lg">{SPORT_ICONS.tennis}</td>
                  <td className="px-3 py-2.5 max-w-[200px] truncate font-medium">
                    {match.playerA.shortName} vs {match.playerB.shortName}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      match.matchScore.labelBg,
                      match.matchScore.labelColor,
                    )}>
                      {match.matchScore.label} {match.matchScore.score.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs text-muted-foreground">
                    {match.tournament}
                  </td>
                </tr>
              ))}
              {/* Football */}
              {current.key === "football" && scoredFootballMatches.map((match) => (
                <tr
                  key={`football-${match.id}`}
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent("open-match-detail", {
                        detail: { sport: "football", matchId: match.id },
                      }),
                    );
                  }}
                  className="cursor-pointer transition-all hover:bg-slate-800/40"
                >
                  <td className="px-3 py-2.5 font-mono text-xs tabular-nums whitespace-nowrap">
                    {parisKickoff(match.scheduledAt)}
                  </td>
                  <td className="px-3 py-2.5 text-lg">{SPORT_ICONS.football}</td>
                  <td className="px-3 py-2.5 max-w-[200px] truncate font-medium">
                    {match.teamA.shortName} vs {match.teamB.shortName}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      match.matchScore.labelBg,
                      match.matchScore.labelColor,
                    )}>
                      {match.matchScore.label} {match.matchScore.score.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs text-muted-foreground">
                    {match.competition}
                  </td>
                </tr>
              ))}
              {/* Basketball */}
              {current.key === "basketball" && scoredBasketballMatches.map((match) => (
                <tr
                  key={`basketball-${match.id}`}
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent("open-match-detail", {
                        detail: { sport: "basketball", matchId: match.id },
                      }),
                    );
                  }}
                  className="cursor-pointer transition-all hover:bg-slate-800/40"
                >
                  <td className="px-3 py-2.5 font-mono text-xs tabular-nums whitespace-nowrap">
                    {parisKickoff(match.scheduledAt)}
                  </td>
                  <td className="px-3 py-2.5 text-lg">{SPORT_ICONS.basketball}</td>
                  <td className="px-3 py-2.5 max-w-[200px] truncate font-medium">
                    {match.teamA.shortName} vs {match.teamB.shortName}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      match.matchScore.labelBg,
                      match.matchScore.labelColor,
                    )}>
                      {match.matchScore.label} {match.matchScore.score.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs text-muted-foreground">
                    {match.competition}
                  </td>
                </tr>
              ))}
              {/* CS2 */}
              {current.key === "cs2" && scoredCs2Matches.map((match) => (
                <tr
                  key={`cs2-${match.id}`}
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent("open-match-detail", {
                        detail: { sport: "cs2", matchId: match.id },
                      }),
                    );
                  }}
                  className="cursor-pointer transition-all hover:bg-slate-800/40"
                >
                  <td className="px-3 py-2.5 font-mono text-xs tabular-nums whitespace-nowrap">
                    {parisKickoff(match.scheduledAt)}
                  </td>
                  <td className="px-3 py-2.5 text-lg">{SPORT_ICONS.cs2}</td>
                  <td className="px-3 py-2.5 max-w-[200px] truncate font-medium">
                    {match.teamA.shortName} vs {match.teamB.shortName}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      match.matchScore.labelBg,
                      match.matchScore.labelColor,
                    )}>
                      {match.matchScore.label} {match.matchScore.score.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs text-muted-foreground">
                    {match.competition}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

