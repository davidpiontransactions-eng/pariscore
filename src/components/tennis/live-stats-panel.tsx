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

function ServiceCircle({
  value,
  label,
  size = 80,
  strokeWidth = 6,
  color,
}: {
  value: number | null;
  label: string;
  size?: number;
  strokeWidth?: number;
  color: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = value ?? 0;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      <span className="text-sm font-bold tabular-nums">{value !== null ? `${value}%` : "--"}</span>
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

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

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <ServiceCircle
            value={stats.p1_first_pct}
            label="Service P1"
            color="#22c55e"
          />
          <ServiceCircle
            value={stats.p2_first_pct}
            label="Service P2"
            color="#3b82f6"
          />
          <ServiceCircle
            value={stats.p1_ret_won}
            label="Retour P1"
            color="#22c55e"
          />
          <ServiceCircle
            value={stats.p2_ret_won}
            label="Retour P2"
            color="#3b82f6"
          />
        </div>

        {stats.perSet.length > 0 && (
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Per-set breakdown
            </h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Set</TableHead>
                  <TableHead className="text-center">
                    {player1Name} Aces
                  </TableHead>
                  <TableHead className="text-center">
                    {player1Name} DF
                  </TableHead>
                  <TableHead className="text-center">
                    {player2Name} Aces
                  </TableHead>
                  <TableHead className="text-center">
                    {player2Name} DF
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.perSet.map((s, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{i + 1}</TableCell>
                    <TableCell className="text-center font-mono tabular-nums">
                      {s.p1_aces !== null ? s.p1_aces : "--"}
                    </TableCell>
                    <TableCell className="text-center font-mono tabular-nums">
                      {s.p1_df !== null ? s.p1_df : "--"}
                    </TableCell>
                    <TableCell className="text-center font-mono tabular-nums">
                      {s.p2_aces !== null ? s.p2_aces : "--"}
                    </TableCell>
                    <TableCell className="text-center font-mono tabular-nums">
                      {s.p2_df !== null ? s.p2_df : "--"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
