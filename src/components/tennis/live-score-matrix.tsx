"use client";

// LiveScoreMatrix — reproduction du "Live score & matrix" Betfair Tennis
// Trader (Peter Webb, betfairtradingblog.com).
//
// Grille des points du jeu EN COURS : chaque cellule affiche la cote juste
// A/B (1/p) si le score atteint cet état → prédiction de l'évolution des
// cotes live (1xBet) selon le prochain point gagné/perdu. Rendu null hors
// live ou match terminé.

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TennisMatch } from "@/lib/tennis-data";
import type { LiveMatchState } from "@/hooks/use-live-matches";
import { useTennisLiveStats } from "@/hooks/use-tennis-live-stats";
import { estimateServePointsWon } from "@/lib/tennis-live-metrics";
import {
  predictTotalGames,
  type ServeStats,
  type LiveGamesContext,
} from "@/lib/prediction/total-games";
import {
  buildLiveMatrix,
  matrixBreakPointSide,
  type LiveMatrixModel,
} from "@/lib/prediction/live-matrix";

type Props = {
  match: TennisMatch;
  /** Présent uniquement si le match est live — le composant se masque sinon. */
  liveState?: LiveMatchState | null;
  serveStatsA?: ServeStats | null;
  serveStatsB?: ServeStats | null;
  className?: string;
};

/** Libellés de points de la grille (0, 15, 30, 40). */
const POINT_LABELS = ["0", "15", "30", "40"] as const;

/** Mappe surface UI (français) → surface modèle (anglais DB). */
function toModelSurface(s: string): "Hard" | "Clay" | "Grass" {
  if (s === "Gazon") return "Grass";
  if (s === "Terre battue") return "Clay";
  return "Hard";
}

/** Teinte de fond selon P(A gagne le match) — cohérente tennis-market-grid. */
function cellTint(p: number): string {
  if (p >= 0.65) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  if (p >= 0.5) return "bg-emerald-500/8 text-emerald-600 dark:text-emerald-400";
  if (p >= 0.35) return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
  return "bg-rose-500/10 text-rose-600 dark:text-rose-400";
}

/** Construit le contexte live (mêmes champs que les panneaux voisins). */
function buildLiveContext(state: LiveMatchState): LiveGamesContext {
  const completedSetsGames =
    state.scoreA.sets.reduce((a, b) => a + b, 0) +
    state.scoreB.sets.reduce((a, b) => a + b, 0);
  const currentSetGames = state.scoreA.games + state.scoreB.games;
  return {
    gamesPlayed: completedSetsGames + currentSetGames,
    setsWon: [state.scoreA.sets.length, state.scoreB.sets.length],
    currentSetGames: [state.scoreA.games, state.scoreB.games],
    liveProbA: state.liveProbA,
    liveProbB: state.liveProbB,
    server: state.server,
    currentPoints: [state.scoreA.points, state.scoreB.points],
  };
}

export function LiveScoreMatrix({
  match,
  liveState,
  serveStatsA,
  serveStatsB,
  className,
}: Props) {
  const t = useTranslations("liveMatrix");
  // Serve observé ce match (stats BSD via SSE partagé) → blend récence.
  const { stats: liveStats } = useTennisLiveStats(liveState?.matchId ?? "");

  const model: LiveMatrixModel | null = useMemo(() => {
    if (!liveState?.isLive) return null;

    const setsA = liveState.scoreA.sets.length;
    const setsB = liveState.scoreB.sets.length;
    // Match terminé (BO3) → la matrice n'a plus de sens.
    if (setsA >= 2 || setsB >= 2) return null;

    const stA: ServeStats = serveStatsA ?? { servePtsWonPct: null, returnPtsWonPct: null };
    const stB: ServeStats = serveStatsB ?? { servePtsWonPct: null, returnPtsWonPct: null };
    const liveCtx: LiveGamesContext = {
      ...buildLiveContext(liveState),
      observedServeA: liveStats ? estimateServePointsWon(liveStats, "A") : null,
      observedServeB: liveStats ? estimateServePointsWon(liveStats, "B") : null,
    };

    // pServeA/B (Barnett, blend récence si observedServe dispo) + holds.
    const tg = predictTotalGames(
      stA,
      stB,
      toModelSurface(match.stats?.surface ?? "Hard"),
      3,
      undefined,
      undefined,
      liveCtx,
    );

    return buildLiveMatrix({
      pServeA: tg.pServeA,
      pServeB: tg.pServeB,
      games: [liveState.scoreA.games, liveState.scoreB.games],
      sets: [setsA, setsB],
      points: [liveState.scoreA.points, liveState.scoreB.points],
      server: liveState.server,
      bo3: true,
    });
  }, [liveState, serveStatsA, serveStatsB, match, liveStats]);

  if (!liveState?.isLive || !model) return null;

  const { cells, current, server, games, sets } = model;
  const fairCur = cells[current.ptsA][current.ptsB];
  const bpSide = matrixBreakPointSide(
    liveState.scoreA.points,
    liveState.scoreB.points,
    server,
  );
  const bpPlayer =
    bpSide === "A" ? match.playerA?.shortName ?? "A" : match.playerB?.shortName ?? "B";

  // Value = cote juste (modèle) > cote payée (1xBet) → le marché sous-cote.
  const marketA = liveState.oddsA;
  const marketB = liveState.oddsB;
  const edgeA = marketA != null && marketA > 0 ? fairCur.fairOddA / marketA - 1 : null;
  const edgeB = marketB != null && marketB > 0 ? fairCur.fairOddB / marketB - 1 : null;

  const nameA = match.playerA?.shortName ?? "A";
  const nameB = match.playerB?.shortName ?? "B";

  return (
    <section
      className={cn("rounded-xl border bg-card p-3", className)}
      aria-label={t("title")}
    >
      {/* En-tête : titre + score + serveur + balle de break */}
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold">
          <Zap className="h-3.5 w-3.5 text-emerald-500" />
          {t("title")}
        </h3>
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {games[0]}-{games[1]} · {sets[0]}-{sets[1]} sets
        </span>
        <span className="text-[11px] text-muted-foreground">
          <span
            className={cn(
              "mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle",
              server === "A" ? "bg-sky-500" : "bg-rose-500",
            )}
            aria-hidden
          />
          {t("server")}:{" "}
          <span className="font-medium text-foreground">
            {server === "A" ? nameA : nameB}
          </span>
        </span>
        {bpSide && (
          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
            <Zap className="mr-0.5 inline h-3 w-3 align-[-2px]" />
            {t("breakPoint", { player: bpPlayer })}
          </span>
        )}
      </div>

      {/* Grille 4×4 — cotes justes A (principal) / B (secondaire) */}
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0.5 text-center">
          <caption className="sr-only">{t("subtitle")}</caption>
          <thead>
            <tr>
              <th scope="col" className="px-1 pb-1 text-[10px] font-medium text-muted-foreground">
                {t("points")} ↓ \ → {t("points")}
              </th>
              {POINT_LABELS.map((lb, j) => (
                <th
                  key={lb}
                  scope="col"
                  className={cn(
                    "pb-1 text-[10px] font-medium",
                    current.ptsB === j ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {lb}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {POINT_LABELS.map((lb, i) => (
              <tr key={lb}>
                <th
                  scope="row"
                  className={cn(
                    "pr-1.5 text-right text-[10px] font-medium",
                    current.ptsA === i ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {lb}
                </th>
                {POINT_LABELS.map((_, j) => {
                  const c = cells[i][j];
                  const isCurrent = current.ptsA === i && current.ptsB === j;
                  const reachable =
                    Math.abs(i - current.ptsA) + Math.abs(j - current.ptsB) === 1;
                  const score = `${POINT_LABELS[i]}-${POINT_LABELS[j]}`;
                  const player = c.pMatchA >= 0.5 ? nameA : nameB;
                  return (
                    <td key={j} className="p-0">
                      <div
                        className={cn(
                          "flex min-h-[36px] flex-col items-center justify-center rounded px-1 py-1",
                          cellTint(c.pMatchA),
                          isCurrent && "ring-2 ring-primary",
                          reachable && !isCurrent && "border border-primary/40",
                        )}
                        title={t("cellTip", {
                          score,
                          player,
                          prob: Math.round((c.pMatchA >= 0.5 ? c.pMatchA : 1 - c.pMatchA) * 100),
                          odd: c.fairOddA.toFixed(2),
                        })}
                      >
                        <span className="font-mono text-[11px] font-semibold leading-none tabular-nums">
                          {c.fairOddA.toFixed(2)}
                        </span>
                        <span className="mt-0.5 font-mono text-[9px] leading-none tabular-nums opacity-55">
                          {c.fairOddB.toFixed(2)}
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pied : marché 1xBet vs modèle — value éventuel sur la cellule courante */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-2 text-[11px]">
        <span className="text-muted-foreground">
          {t("market")} 1xBet:
          <span className="ml-1 font-mono font-semibold tabular-nums text-foreground">
            {marketA != null ? marketA.toFixed(2) : "—"}
          </span>
          <span className="mx-1 text-muted-foreground/50">/</span>
          <span className="font-mono font-semibold tabular-nums text-foreground">
            {marketB != null ? marketB.toFixed(2) : "—"}
          </span>
        </span>
        <span className="text-muted-foreground">
          {t("fair")} (courant):
          <span className="ml-1 font-mono font-semibold tabular-nums text-foreground">
            {fairCur.fairOddA.toFixed(2)}
          </span>
          <span className="mx-1 text-muted-foreground/50">/</span>
          <span className="font-mono font-semibold tabular-nums text-foreground">
            {fairCur.fairOddB.toFixed(2)}
          </span>
        </span>
        {edgeA != null && edgeB != null && (
          <>
            {edgeA > 0.03 && (
              <span className="rounded bg-emerald-600 px-1.5 py-px text-[10px] font-bold text-white">
                {t("valueA")} +{Math.round(edgeA * 100)}%
              </span>
            )}
            {edgeB > 0.03 && (
              <span className="rounded bg-emerald-600 px-1.5 py-px text-[10px] font-bold text-white">
                {t("valueB")} +{Math.round(edgeB * 100)}%
              </span>
            )}
          </>
        )}
        {marketA == null && marketB == null && (
          <span className="text-muted-foreground/60">{t("noOdds")}</span>
        )}
      </div>
    </section>
  );
}
