"use client";

import { useEffect, useRef, useState } from "react";
import { useTennisLiveStats } from "@/hooks/use-tennis-live-stats";
import type { TennisLiveStats } from "@/hooks/use-tennis-live-stats";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ServeStatsBars } from "./serve-stats-bars";
import { BreakPointsGrid } from "./break-points-grid";
import { SetBySetTable } from "./set-by-set-table";

interface LiveStatsPanelProps {
  matchId: string;
  player1Name: string;
  player2Name: string;
  className?: string;
}

type StatRowDef = {
  p1Key: keyof TennisLiveStats;
  p2Key: keyof TennisLiveStats;
  label: string;
  suffix?: string;
  higherWins: boolean;
};

const STAT_ROWS: StatRowDef[] = [
  { p1Key: "p1_aces", p2Key: "p2_aces", label: "Aces", higherWins: true },
  { p1Key: "p1_df", p2Key: "p2_df", label: "Doubles fautes", higherWins: false },
  { p1Key: "p1_first_pct", p2Key: "p2_first_pct", label: "% 1er service", suffix: "%", higherWins: true },
  { p1Key: "p1_first_won", p2Key: "p2_first_won", label: "% pts gagnés 1er srv", suffix: "%", higherWins: true },
  { p1Key: "p1_bp_saved", p2Key: "p2_bp_saved", label: "Balles de break sauvées", higherWins: true },
  { p1Key: "p1_ret_won", p2Key: "p2_ret_won", label: "% pts gagnés au retour", suffix: "%", higherWins: true },
  { p1Key: "p1_total_pts", p2Key: "p2_total_pts", label: "% points gagnés", suffix: "%", higherWins: true },
];

export function LiveStatsPanel({
  matchId,
  player1Name,
  player2Name,
  className,
}: LiveStatsPanelProps) {
  const { stats, loading, error, isDemo, retry } = useTennisLiveStats(matchId);
  const lastUpdateRef = useRef<number | null>(null);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (stats) {
      lastUpdateRef.current = Date.now();
      setStale(false);
    }
  }, [stats]);

  useEffect(() => {
    if (!lastUpdateRef.current) return;
    const id = setInterval(() => {
      if (lastUpdateRef.current && Date.now() - lastUpdateRef.current > 30000) {
        setStale(true);
      }
    }, 5000);
    return () => clearInterval(id);
  }, []);

  if (loading) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <div className="flex justify-center gap-6">
            <Skeleton className="size-20 rounded-full" />
            <Skeleton className="size-20 rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && !stats) {
    return (
      <Card className={cn("w-full", className)}>
        <CardContent className="flex flex-col items-center gap-3 py-8">
          <p className="text-sm text-muted-foreground">{error}</p>
          <button
            type="button"
            onClick={retry}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Retry
          </button>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card className={cn("w-full", className)}>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No live stats available
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          Live Stats
          {isDemo && <Badge variant="outline">DEMO</Badge>}
          {stale && (
            <Badge variant="secondary" className="text-amber-600 dark:text-amber-400">
              Stale
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[35%]">{player1Name}</TableHead>
              <TableHead className="w-[30%] text-center text-xs">Stat</TableHead>
              <TableHead className="w-[35%] text-right">{player2Name}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {STAT_ROWS.map((row) => {
              const v1 = stats[row.p1Key] as number | null;
              const v2 = stats[row.p2Key] as number | null;
              if (v1 === null && v2 === null) return null;
              const display = (v: number | null) =>
                v !== null ? `${v}${row.suffix ?? ""}` : "--";
              const p1Wins =
                v1 !== null && v2 !== null
                  ? row.higherWins
                    ? v1 > v2
                    : v1 < v2
                  : null;
              const p2Wins = p1Wins !== null ? !p1Wins : null;
              return (
                <TableRow key={row.p1Key}>
                  <TableCell
                    className={cn(
                      "font-mono tabular-nums",
                      p1Wins === true && "font-semibold text-emerald-600 dark:text-emerald-400",
                      p1Wins === false && "text-muted-foreground",
                    )}
                  >
                    {display(v1)}
                  </TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground">
                    {row.label}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "font-mono tabular-nums text-right",
                      p2Wins === true && "font-semibold text-emerald-600 dark:text-emerald-400",
                      p2Wins === false && "text-muted-foreground",
                    )}
                  >
                    {display(v2)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {/* Phase 2 — Serve stats bars (style Sofascore "Performance").
            Remplace le tableau stats précédent pour les 3 métriques % (1st in, 1st won, ret won).
            Le tableau STAT_ROWS ci-dessus reste pour aces/DF/total (chiffres absolus). */}
        <ServeStatsBars
          stats={stats}
          player1Name={player1Name}
          player2Name={player2Name}
        />

        {/* Phase 2 — Break points matrix.
            Affiche bp_saved (cumul) sous forme de dots colorés.
            bp_faced n'est pas encore exposé par le hook → mode dégradé "saved only". */}
        <BreakPointsGrid
          bpSavedA={stats.p1_bp_saved}
          bpSavedB={stats.p2_bp_saved}
          player1Name={player1Name}
          player2Name={player2Name}
        />

        {/* Phase 2 — Set-by-set table Sofascore-like.
            Remplace l'ancien "Per-set breakdown" texte (aces/DF uniquement) par
            une table dense avec colonne Score (winner en gras emerald). */}
        {stats.perSet.length > 0 && (
          <SetBySetTable
            perSet={stats.perSet}
            player1Name={player1Name}
            player2Name={player2Name}
          />
        )}
      </CardContent>
    </Card>
  );
}
