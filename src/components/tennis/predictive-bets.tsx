"use client";

// PredictiveBets — 3 paris prédictifs Over/Under Total Games.
//
// Affiche les probabilités P(Over X.5) pour X ∈ {18, 19, 21} calculées par le
// modèle Barnett-Clarke + Poisson (src/lib/prediction/total-games.ts).
//
//   Prematch : lit directement `match.totalGamesPredictions` (calculé en
//              amont par bsd-fetcher au moment du fetch BSD).
//   Live     : recalcule à chaque rendu (le parent re-render à chaque poll 8s)
//              via `liveState` : λ_restant = espérance de games RESTANTS, pas
//              du total initial. Plus le match avance, plus la prédiction
//              converge vers la réalité.
//
// Composant compact : 3 barres horizontales + reco. Masqué si le match est
// synthétique (live-only sans données prematch) ou si predictions absent.

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Target, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TennisMatch } from "@/lib/tennis-data";
import type { LiveMatchState } from "@/hooks/use-live-matches";
import {
  predictTotalGames,
  type PredictionSurface,
  type LiveGamesContext,
  type ServeStats,
} from "@/lib/prediction/total-games";

type Props = {
  match: TennisMatch;
  /** Présent uniquement si le match est live. Déclenche le recalcul dynamique. */
  liveState?: LiveMatchState | null;
  /** Stats de service des 2 joueurs (résolues côté serveur via usePlayerStats).
   *  Évite d'importer lookupServeStats (node:fs) dans un composant client. */
  serveStatsA?: ServeStats | null;
  serveStatsB?: ServeStats | null;
  className?: string;
};

/** Mappe surface UI (français) → surface modèle (anglais DB). */
function toModelSurface(s: string): PredictionSurface {
  if (s === "Gazon") return "Grass";
  if (s === "Terre battue") return "Clay";
  return "Hard";
}

/** Construit le contexte live (games joués + sets + set en cours) pour le
 *  recalcul de λ_restant. Inclut liveProb (implicite marché) + server. */
function buildLiveContext(state: LiveMatchState): LiveGamesContext {
  const completedSetsGames =
    state.scoreA.sets.reduce((a, b) => a + b, 0) +
    state.scoreB.sets.reduce((a, b) => a + b, 0);
  const currentSetGames = state.scoreA.games + state.scoreB.games;
  return {
    gamesPlayed: completedSetsGames + currentSetGames,
    setsWon: [
      state.scoreA.sets.length,
      state.scoreB.sets.length,
    ],
    currentSetGames: [state.scoreA.games, state.scoreB.games],
    liveProbA: state.liveProbA,
    liveProbB: state.liveProbB,
    server: state.server,
  };
}

type Threshold = 18.5 | 19.5 | 21.5;

type Prediction = {
  over18_5: number;
  over19_5: number;
  over21_5: number;
  setOver75: number;
  setUnder125: number;
  lambda: number;
  recommendedBet: { threshold: Threshold; direction: "over" | "under"; prob: number };
  source: string;
};

export function PredictiveBets({ match, liveState, serveStatsA, serveStatsB, className }: Props) {
  const t = useTranslations("predictiveBets");

  // Masqué si match synthétique (live-only sans prematch) ou si prematch absent.
  const prematch = match.totalGamesPredictions;

  // En live : recalcule à chaque poll (le parent re-render toutes les 8s).
  // useMemo pour éviter le recalcul entre re-rendus sans changement de liveState.
  // Hook appelé inconditionnellement (règles des hooks) — rend null si prematch
  // absent, le guard d'affichage est en dessous.
  const predictions: Prediction | null = useMemo(() => {
    if (!prematch || !liveState) {
      if (!prematch) return null;
      // Prematch : setOver75/Under125 non calculés → baseline 0-0 set (≈ 50%)
      return { ...prematch, setOver75: 50, setUnder125: 50 };
    }
    // (Reset mémoïsations Markov géré dans adjustLambdaLive — couche modèle.)
    const modelSurface = toModelSurface(match.stats.surface);
    const liveCtx = buildLiveContext(liveState);
    const result = predictTotalGames(
      serveStatsA ?? { servePtsWonPct: null, returnPtsWonPct: null },
      serveStatsB ?? { servePtsWonPct: null, returnPtsWonPct: null },
      modelSurface,
      3, // best-of-3 ( marché cible )
      match.playerA.elo,
      match.playerB.elo,
      liveCtx,
    );
    return {
      over18_5: result.over18_5,
      over19_5: result.over19_5,
      over21_5: result.over21_5,
      setOver75: result.setOver75,
      setUnder125: result.setUnder125,
      lambda: result.lambda,
      recommendedBet: result.recommendedBet,
      source: result.source,
    };
  }, [
    prematch,
    liveState?.scoreA.games,
    liveState?.scoreB.games,
    liveState?.scoreA.sets.length,
    liveState?.scoreB.sets.length,
    liveState?.liveProbA,
    liveState?.liveProbB,
    liveState?.server,
    match.stats.surface,
    match.playerA.elo,
    match.playerB.elo,
    serveStatsA,
    serveStatsB,
  ]);

  if (match.synthetic || !prematch || !predictions) return null;

  const isLive = !!liveState;
  const thresholds: Array<{ threshold: Threshold; prob: number; label: string }> = [
    { threshold: 18.5, prob: predictions.over18_5, label: "18.5" },
    { threshold: 19.5, prob: predictions.over19_5, label: "19.5" },
    { threshold: 21.5, prob: predictions.over21_5, label: "21.5" },
  ];

  const { threshold: recThreshold, direction: recDirection, prob: recProb } =
    predictions.recommendedBet;

  return (
    <div
      className={cn(
        "rounded-lg border border-border/60 bg-muted/20 p-2.5",
        className,
      )}
    >
      <div className="mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          <Target className="h-3 w-3" />
          {t("title")}
          {isLive && (
            <span className="ml-1 rounded bg-rose-600/90 px-1 py-px text-[11px] font-bold uppercase text-white">
              live
            </span>
          )}
        </span>
        {predictions.source !== "stats" && (
          <span className="text-[11px] text-muted-foreground/60" title={t("fallbackHint")}>
            ~
          </span>
        )}
      </div>

      <div className="space-y-1">
        {thresholds.map(({ threshold, prob, label }) => {
          // Reco : on surligne le seuil recommandé.
          const isRec = threshold === recThreshold;
          // Couleur : emerald si >60% (value), ambre si 45-60% (incertain), neutre sinon.
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
                "flex w-full items-center gap-2 rounded px-1 py-0.5 min-h-11 text-left transition-colors hover:bg-muted/40",
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

      {/* Marchés par set — live seulement */}
      {isLive && (
        <div className="mt-1.5 space-y-1 border-t border-border/40 pt-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
            Set en cours
          </span>
          {[
            { label: "Over 7,5 jeux", prob: predictions.setOver75 },
            { label: "Under 12,5 jeux", prob: predictions.setUnder125 },
          ].map(({ label, prob }) => {
            const cClass =
              prob >= 65
                ? "bg-emerald-500"
                : prob >= 45
                  ? "bg-amber-500"
                  : "bg-muted-foreground/40";
            return (
              <div key={label} className="flex items-center gap-2 px-1 py-0.5">
                <span className="w-24 shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                  {label}
                </span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className={cn("block h-full rounded-full transition-all duration-500", cClass)}
                    style={{ width: `${prob}%` }}
                  />
                </span>
                <span className="w-8 shrink-0 text-right font-mono text-[10px] font-semibold tabular-nums">
                  {prob}%
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Reco : le seuil le plus proche de 60% (value sweet spot). */}
      <div className="mt-1.5 flex items-center gap-1 border-t border-border/40 pt-1 text-[11px]">
        {recDirection === "over" ? (
          <TrendingUp className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <TrendingDown className="h-3 w-3 text-amber-600 dark:text-amber-400" />
        )}
        <span className="text-muted-foreground">{t("reco")} :</span>
        <span className="font-semibold">
          {recDirection === "over" ? t("over") : t("under")} {recThreshold}
        </span>
        <span className="font-mono font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
          {recProb}%
        </span>
        {isLive && (
          <span className="ml-auto text-muted-foreground/60">
            {t("lambdaLive", { lambda: predictions.lambda })}
          </span>
        )}
      </div>
    </div>
  );
}
