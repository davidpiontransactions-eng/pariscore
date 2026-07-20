import { useTranslations } from "next-intl";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TennisSetStats } from "@/hooks/use-tennis-live-stats";
import { cn } from "@/lib/utils";

/**
 * A single set's game score.
 *
 * `p1` / `p2` are the games won by each player in that set. `ongoing` flags
 * the in-progress (last) set — when true the score is rendered muted without
 * a winner highlight since the set is not yet decided.
 */
export type SetScore = {
  p1: number;
  p2: number;
  ongoing?: boolean;
};

type Props = {
  /** Per-set aces / double-faults for both players. */
  perSet: TennisSetStats[];
  /** Optional per-set game scores (from `LiveMatchState.scoreA.sets`). When
   *  omitted the "Score" column is hidden entirely. */
  setScores?: Array<{ p1: number; p2: number; ongoing?: boolean }>;
  player1Name: string;
  player2Name: string;
  className?: string;
};

const EM_DASH = "—";

function formatStatValue(v: number | null | undefined): string {
  if (v === null || v === undefined) return EM_DASH;
  return String(v);
}

/**
 * Sofascore-style set-by-set breakdown.
 *
 * Renders one row per set with the score (when `setScores` is provided) and
 * aces / double-faults for each player. The set winner is highlighted in
 * emerald bold; the in-progress (last) set stays muted.
 *
 * Pure / presentational — only calls `useTranslations` for labels, safe in
 * server components.
 *
 * @example
 * <SetBySetTable
 *   perSet={[
 *     { p1_aces: 3, p2_aces: 1, p1_df: 1, p2_df: 2 },
 *     { p1_aces: 0, p2_aces: 5, p1_df: 2, p2_df: 0 },
 *   ]}
 *   setScores={[
 *     { p1: 6, p2: 4 },
 *     { p1: 3, p2: 6 },
 *     { p1: 2, p2: 2, ongoing: true },
 *   ]}
 *   player1Name="Alcaraz"
 *   player2Name="Sinner"
 * />
 */
export function SetBySetTable({
  perSet,
  setScores,
  player1Name,
  player2Name,
  className,
}: Props) {
  const t = useTranslations("tennis");

  const showScoreColumn = Array.isArray(setScores) && setScores.length > 0;

  // The number of rows is driven by whichever input has the most entries —
  // in practice perSet and setScores should align, but we stay robust.
  const rowCount = Math.max(perSet.length, setScores?.length ?? 0);

  if (rowCount === 0) return null;

  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <Table aria-label={t("setBySet")}>
        <TableHeader>
          <TableRow>
            <TableHead
              scope="col"
              className="w-10 text-xs text-muted-foreground"
            >
              {t("set")}
            </TableHead>
            {showScoreColumn && (
              <TableHead
                scope="col"
                className="text-center text-xs text-muted-foreground"
              >
                {t("score")}
              </TableHead>
            )}
            <TableHead
              scope="col"
              className="text-center text-xs text-muted-foreground"
            >
              <span className="inline-block max-w-[7rem] truncate align-bottom">
                {player1Name}
              </span>{" "}
              {t("aces")}
            </TableHead>
            <TableHead
              scope="col"
              className="text-center text-xs text-muted-foreground"
            >
              <span className="inline-block max-w-[7rem] truncate align-bottom">
                {player1Name}
              </span>{" "}
              {t("doubleFaults")}
            </TableHead>
            <TableHead
              scope="col"
              className="text-center text-xs text-muted-foreground"
            >
              <span className="inline-block max-w-[7rem] truncate align-bottom">
                {player2Name}
              </span>{" "}
              {t("aces")}
            </TableHead>
            <TableHead
              scope="col"
              className="text-center text-xs text-muted-foreground"
            >
              <span className="inline-block max-w-[7rem] truncate align-bottom">
                {player2Name}
              </span>{" "}
              {t("doubleFaults")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rowCount }).map((_, i) => {
            const setStat = perSet[i];
            const score = setScores?.[i];
            const isOngoing = score?.ongoing === true;

            // Winner highlight: only when the set is finished (not ongoing)
            // and the games differ. A tiebreak 7-6 still has a clear winner.
            let p1Wins = false;
            let p2Wins = false;
            if (showScoreColumn && score && !isOngoing) {
              if (score.p1 > score.p2) p1Wins = true;
              else if (score.p2 > score.p1) p2Wins = true;
            }

            return (
              <TableRow key={i}>
                <TableCell className="text-xs font-medium text-muted-foreground">
                  {i + 1}
                </TableCell>

                {showScoreColumn && (
                  <TableCell className="text-center">
                    {score ? (
                      <span
                        className={cn(
                          "font-mono text-sm tabular-nums",
                          isOngoing && "text-muted-foreground",
                        )}
                      >
                        <span
                          className={cn(
                            p1Wins &&
                              "font-bold text-emerald-600 dark:text-emerald-400",
                          )}
                        >
                          {score.p1}
                        </span>
                        -
                        <span
                          className={cn(
                            p2Wins &&
                              "font-bold text-emerald-600 dark:text-emerald-400",
                          )}
                        >
                          {score.p2}
                        </span>
                      </span>
                    ) : (
                      <span className="font-mono text-sm tabular-nums text-muted-foreground">
                        {EM_DASH}
                      </span>
                    )}
                  </TableCell>
                )}

                <TableCell className="text-center font-mono text-sm tabular-nums">
                  {formatStatValue(setStat?.p1_aces)}
                </TableCell>
                <TableCell className="text-center font-mono text-sm tabular-nums">
                  {formatStatValue(setStat?.p1_df)}
                </TableCell>
                <TableCell className="text-center font-mono text-sm tabular-nums">
                  {formatStatValue(setStat?.p2_aces)}
                </TableCell>
                <TableCell className="text-center font-mono text-sm tabular-nums">
                  {formatStatValue(setStat?.p2_df)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
