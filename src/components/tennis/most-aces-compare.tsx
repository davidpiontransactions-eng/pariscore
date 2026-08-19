"use client";

// MostAcesCompare — comparaison A vs B (most aces) + Over/Under aces totaux.
//
// Affiche 2 blocs :
//   1. Matchup : P(A > B), P(=), P(B > A) en barre horizontale 3 segments.
//   2. Total : P(Over 9.5 / 12.5 / 15.5 aces) — 3 barres style PredictiveBets.
//
// Prematch : lit match.mostAcesPredictions (calculé par bsd-fetcher).
// Live     : recalcule à chaque poll via liveState (λ aces restant réduit
//            proportionnellement aux jeux de service restants).

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Zap, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TennisMatch } from "@/lib/tennis-data";
import type { LiveMatchState } from "@/hooks/use-live-matches";
import { predictMostAces, type AcesStats } from "@/lib/prediction/most-aces";
import type { PredictionSurface, LiveGamesContext } from "@/lib/prediction/total-games";

type Props = {
  match: TennisMatch;
  liveState?: LiveMatchState | null;
  serveStatsA?: AcesStats | null;
  serveStatsB?: AcesStats | null;
  className?: string;
};

function toModelSurface(s: string): PredictionSurface {
  if (s === "Gazon") return "Grass";
  if (s === "Terre battue") return "Clay";
  return "Hard";
}

function buildLiveContext(state: LiveMatchState): LiveGamesContext {
  const completedSetsGames =
    state.scoreA.sets.reduce((a, b) => a + b, 0) +
    state.scoreB.sets.reduce((a, b) => a + b, 0);
  const currentSetGames = state.scoreA.games + state.scoreB.games;
  return {
    gamesPlayed: completedSetsGames + currentSetGames,
    setsWon: [state.scoreA.sets.length, state.scoreB.sets.length],
    currentSetGames: [state.scoreA.games, state.scoreB.games],
  };
}

type Prediction = NonNullable<TennisMatch["mostAcesPredictions"]>;

export function MostAcesCompare({ match, liveState, serveStatsA, serveStatsB, className }: Props) {
  const t = useTranslations("mostAces");

  const prematch = match.mostAcesPredictions;
  // Hook appelé inconditionnellement (règles des hooks). Rend null si prematch
  // absent — le guard d'affichage est en dessous.
  const predictions: Prediction | null = useMemo(() => {
    if (!prematch || !liveState) return prematch ?? null;
    const modelSurface = toModelSurface(match.stats.surface);
    const liveCtx = buildLiveContext(liveState);
    const result = predictMostAces(
      serveStatsA ?? { acesPct: null, servePtsWonPct: null, returnPtsWonPct: null },
      serveStatsB ?? { acesPct: null, servePtsWonPct: null, returnPtsWonPct: null },
      modelSurface,
      3,
      liveCtx,
    );
    return {
      probAMoreAces: result.probAMoreAces,
      probBMoreAces: result.probBMoreAces,
      probTie: result.probTie,
      probAWinsMarket: result.probAWinsMarket,
      lambdaA: result.lambdaA,
      lambdaB: result.lambdaB,
      lambdaTotal: result.lambdaTotal,
      over9_5: result.over9_5,
      over12_5: result.over12_5,
      over15_5: result.over15_5,
      recommendedBet: result.recommendedBet,
      source: result.source,
    };
  }, [
    liveState?.scoreA.games,
    liveState?.scoreB.games,
    liveState?.scoreA.sets.length,
    liveState?.scoreB.sets.length,
    serveStatsA,
    serveStatsB,
  ]);

  if (match.synthetic || !prematch || !predictions) return null;

  const isLive = !!liveState;
  const isFallback = predictions.source !== "stats";
  const {
    probAMoreAces,
    probBMoreAces,
    probTie,
    recommendedBet: rec,
  } = predictions;

  // Reco label : matchup → "Sinner", total → "Over 12.5".
  const recLabel =
    rec.market === "matchup"
      ? rec.direction === "A"
        ? match.playerA.shortName
        : match.playerB.shortName
      : `${rec.direction === "over" ? t("over") : t("under")} ${rec.threshold}`;

  const thresholds: Array<{ threshold: number; prob: number; label: string }> = [
    { threshold: 9.5, prob: predictions.over9_5, label: "9.5" },
    { threshold: 12.5, prob: predictions.over12_5, label: "12.5" },
    { threshold: 15.5, prob: predictions.over15_5, label: "15.5" },
  ];

  return (
    <div
      className={cn(
        "rounded-lg border border-border/60 bg-muted/20 p-2.5",
        className,
      )}
    >
      <div className="mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          <Zap className="h-3 w-3" />
          {t("title")}
          {isLive && (
            <span className="ml-1 rounded bg-rose-600/90 px-1 py-px text-[8px] font-bold uppercase text-white">
              live
            </span>
          )}
        </span>
        {isFallback && (
          <span
            className="ml-1 rounded bg-amber-500/15 px-1 py-px text-[8px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400"
            title={t("fallbackHint")}
          >
            {t("fallbackBadge")}
          </span>
        )}
      </div>

      {/* Matchup A vs B vs tie — barre 3 segments */}
      <div className="mb-2">
        <div className="mb-0.5 flex h-1.5 overflow-hidden rounded-full bg-muted">
          <span
            className="h-full transition-all duration-500"
            style={{ width: `${probAMoreAces}%`, background: match.playerA.color }}
          />
          <span
            className="h-full bg-muted-foreground/40 transition-all duration-500"
            style={{ width: `${probTie}%` }}
          />
          <span
            className="h-full transition-all duration-500"
            style={{ width: `${probBMoreAces}%`, background: match.playerB.color }}
          />
        </div>
        <div className="flex justify-between text-[11px] font-mono tabular-nums">
          <div className="flex flex-col items-start leading-tight">
            <span>{match.playerA.shortName} {probAMoreAces}%</span>
            <span className="text-muted-foreground/50 text-[8px]">
              {isFallback ? t("fallbackAces") : `${predictions.lambdaA} ${t("acesPerMatch")}`}
            </span>
          </div>
          <span className="self-start text-muted-foreground/60">{t("tie")} {probTie}%</span>
          <div className="flex flex-col items-end leading-tight">
            <span>{match.playerB.shortName} {probBMoreAces}%</span>
            <span className="text-muted-foreground/50 text-[8px]">
              {isFallback ? t("fallbackAces") : `${predictions.lambdaB} ${t("acesPerMatch")}`}
            </span>
          </div>
        </div>
      </div>

      {/* Over/Under total — 3 barres style PredictiveBets */}
      <div className="space-y-1">
        {thresholds.map(({ threshold, prob, label }) => {
          const isRec = rec.market === "total" && rec.threshold === threshold;
          const colorClass =
            prob >= 60
              ? "bg-emerald-500"
              : prob >= 45
                ? "bg-amber-500"
                : "bg-muted-foreground/40";
          return (
            <button
              key={threshold}
              type="button"
              className={cn(
                "flex w-full items-center gap-2 rounded px-1 py-0.5 text-left transition-colors hover:bg-muted/40",
                isRec && "ring-1 ring-emerald-500/40",
              )}
              title={t("overTooltip", { threshold: label, prob })}
            >
              <span className="w-10 shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                O {label}
              </span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <span
                  className={cn("block h-full rounded-full transition-all duration-500", colorClass)}
                  style={{ width: `${prob}%` }}
                />
              </span>
              <span className="w-8 shrink-0 text-right font-mono text-[11px] font-semibold tabular-nums">
                {prob}%
              </span>
            </button>
          );
        })}
      </div>

      {/* Reco */}
      <div className="mt-1.5 flex items-center gap-1 border-t border-border/40 pt-1 text-[11px]">
        <TrendingUp className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
        <span className="text-muted-foreground">{t("reco")} :</span>
        <span className="font-semibold">{recLabel}</span>
        <span className="font-mono font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
          {rec.prob}%
        </span>
        {isLive && (
          <span className="ml-auto text-muted-foreground/60">
            {t("lambdaTotal", { n: predictions.lambdaTotal })}
          </span>
        )}
      </div>
    </div>
  );
}
