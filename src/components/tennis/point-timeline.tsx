"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { PointOutcome } from "@/hooks/use-momentum-dr";
import { cn } from "@/lib/utils";

/**
 * PointTimeline — Compact horizontal timeline of the points played in the
 * current game. Each point is a coloured dot:
 *   - Filled dot of the winner's colour (P1 emerald / P2 rose)
 *   - Larger gold-ringed dot if it was a break point
 *   - Thick border if the receiver won (i.e. a break was converted or saved)
 *
 * Inspiration: condensed version of the in-game point-by-point strip shown
 * on Sofascore/Flashscore during live matches.
 *
 * Pure / presentational — receives a pre-filtered `points` array (the caller
 * filters pointHistory by set + game). If the caller prefers, they can pass
 * the full history + currentSet/currentGame and we filter here.
 */

type Props = {
  /** Points of the current game. If omitted, pass full history + current set/game. */
  points?: PointOutcome[];
  /** Full pointHistory — used when `points` is not provided, filtered by set+game. */
  history?: PointOutcome[];
  player1Name: string;
  player2Name: string;
  /** 1-based set number (used only when filtering `history`). */
  currentSet?: number;
  /** 1-based game number within the set (used only when filtering `history`). */
  currentGame?: number;
  player1Color?: string;
  player2Color?: string;
  className?: string;
};

export function PointTimeline({
  points,
  history,
  player1Name,
  player2Name,
  currentSet,
  currentGame,
  player1Color = "#00e676",
  player2Color = "#ff6b6b",
  className,
}: Props) {
  const t = useTranslations("tennis");

  const gamePoints = useMemo<PointOutcome[]>(() => {
    if (points && points.length) return points;
    if (!history?.length) return [];
    if (currentSet == null || currentGame == null) return history;
    return history.filter(
      (p) => p.set === currentSet && p.game === currentGame,
    );
  }, [points, history, currentSet, currentGame]);

  const p1Wins = gamePoints.filter((p) => p.winner === "A").length;
  const p2Wins = gamePoints.filter((p) => p.winner === "B").length;
  const breakPoints = gamePoints.filter((p) => p.wasBreakPoint).length;

  const ariaLabel = t("pointTimelineAria", {
    set: currentSet ?? "—",
    game: currentGame ?? "—",
    p1: player1Name,
    p1Count: p1Wins,
    p2: player2Name,
    p2Count: p2Wins,
    bp: breakPoints,
  });

  if (!gamePoints.length) {
    return (
      <section
        className={cn("w-full", className)}
        role="img"
        aria-label={ariaLabel}
      >
        <header className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {currentSet != null && currentGame != null
            ? t("gameInProgress", { set: currentSet, game: currentGame })
            : t("winProbability")}
        </header>
        <p className="text-xs text-muted-foreground/70">{t("noPointsYet")}</p>
      </section>
    );
  }

  return (
    <section
      className={cn("w-full", className)}
      role="img"
      aria-label={ariaLabel}
    >
      <header className="mb-1.5 flex items-baseline justify-between">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {currentSet != null && currentGame != null
            ? t("gameInProgress", { set: currentSet, game: currentGame })
            : t("pointTimeline")}
        </h4>
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {player1Name.slice(0, 3).toUpperCase()} {p1Wins} ·{" "}
          {player2Name.slice(0, 3).toUpperCase()} {p2Wins}
        </span>
      </header>

      <ol
        className="flex flex-wrap items-center gap-1.5"
        aria-hidden="true"
      >
        {gamePoints.map((p, i) => {
          const isP1 = p.winner === "A";
          const color = isP1 ? player1Color : player2Color;
          const receiverWon = p.winner !== p.server;
          return (
            <li
              key={i}
              title={t("pointTooltip", {
                winner: isP1 ? player1Name : player2Name,
                bp: p.wasBreakPoint ? t("breakPointShort") : "",
              })}
              className={cn(
                "flex items-center justify-center rounded-full transition-transform hover:scale-110",
                p.wasBreakPoint ? "h-3.5 w-3.5 ring-2 ring-amber-400/70" : "h-2.5 w-2.5",
                receiverWon && "ring-1 ring-offset-1 ring-offset-background",
              )}
              style={{
                backgroundColor: color,
                // Use the opponent's colour for the ring when receiver won —
                // visually flags a break/saved moment.
                boxShadow: receiverWon ? `0 0 0 1.5px ${color}` : undefined,
              }}
            />
          );
        })}
      </ol>

      {breakPoints > 0 && (
        <p className="mt-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
          {t("breakPointsInGame", { n: breakPoints })}
        </p>
      )}
    </section>
  );
}
