"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  TrendingUp,
  TrendingDown,
  Trophy,
  Target,
  BarChart3,
  Calendar,
  Filter,
} from "lucide-react";
import { usePaperTrading } from "@/hooks/use-paper-trading";
import { cn } from "@/lib/utils";

/**
 * Historique de prédictions avec statistiques détaillées.
 *
 * Affiche :
 * - Liste des paris avec statut (pending/won/lost)
 * - Filtrage par sport, statut, période
 * - Stats agrégées (win rate, profit, ROI, CLV)
 * - Détail par pari (match, stake, odds, payout)
 *
 * Pattern The Athletic — données claires avec disclosure progressif.
 */

type FilterPeriod = "all" | "7d" | "30d" | "90d";
type FilterStatus = "all" | "pending" | "won" | "lost";

type Props = {
  className?: string;
};

export function PredictionHistory({ className }: Props) {
  const t = useTranslations("history");
  const { bets } = usePaperTrading();

  const stats = useMemo(() => {
    const settled = bets.filter((b) => b.status === "won" || b.status === "lost");
    const won = settled.filter((b) => b.status === "won");
    const totalStake = settled.reduce((acc, b) => acc + b.stake, 0);
    const totalPayout = settled.reduce((acc, b) => acc + (b.payout ?? 0), 0);
    const profit = totalPayout - totalStake;
    const roi = totalStake > 0 ? (profit / totalStake) * 100 : 0;
    const winRate = settled.length > 0 ? (won.length / settled.length) * 100 : 0;

    // Average odds
    const avgOdds =
      settled.length > 0
        ? settled.reduce((acc, b) => acc + b.odd, 0) / settled.length
        : 0;

    // CLV (Closing Line Value) - approximation
    const clvBets = settled.filter((b) => b.odd);
    const avgClv =
      clvBets.length > 0
        ? clvBets.reduce((acc, b) => {
            // Simplified CLV: (closing odds - average market odds) / average market odds
            return acc + (b.odd - 2.0) / 2.0; // placeholder
          }, 0) / clvBets.length
        : 0;

    return {
      totalBets: bets.length,
      settledBets: settled.length,
      pendingBets: bets.filter((b) => b.status === "pending").length,
      wonBets: won.length,
      lostBets: settled.filter((b) => b.status === "lost").length,
      winRate,
      profit,
      roi,
      avgOdds,
      clv: avgClv,
      totalStake,
      totalPayout,
    };
  }, [bets]);

  const recentBets = useMemo(() => {
    return [...bets]
      .sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime())
      .slice(0, 20);
  }, [bets]);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Historique des prédictions</h3>
        <span className="font-mono text-[10px] text-muted-foreground">
          {stats.settledBets} settlers
        </span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-border/50 bg-card/50 p-2.5 text-center">
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
            Win Rate
          </div>
          <div className="font-mono text-base font-bold tabular-nums">
            {stats.winRate.toFixed(1)}%
          </div>
          <div className="mt-0.5 flex items-center justify-center gap-1 text-[9px] text-muted-foreground">
            {stats.winRate > 50 ? (
              <TrendingUp className="h-2.5 w-2.5 text-emerald-500" />
            ) : (
              <TrendingDown className="h-2.5 w-2.5 text-red-500" />
            )}
            <span>{stats.wonBets}W / {stats.lostBets}L</span>
          </div>
        </div>

        <div className="rounded-lg border border-border/50 bg-card/50 p-2.5 text-center">
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
            Profit
          </div>
          <div className={cn(
            "font-mono text-base font-bold tabular-nums",
            stats.profit >= 0 ? "text-emerald-500" : "text-red-500"
          )}>
            {stats.profit >= 0 ? "+" : ""}{stats.profit.toFixed(0)}€
          </div>
          <div className="mt-0.5 text-[9px] text-muted-foreground">
            ROI {stats.roi >= 0 ? "+" : ""}{stats.roi.toFixed(1)}%
          </div>
        </div>

        <div className="rounded-lg border border-border/50 bg-card/50 p-2.5 text-center">
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
            Avg Odds
          </div>
          <div className="font-mono text-base font-bold tabular-nums">
            {stats.avgOdds.toFixed(2)}
          </div>
          <div className="mt-0.5 text-[9px] text-muted-foreground">
            {stats.pendingBets} en cours
          </div>
        </div>
      </div>

      {/* Bets list */}
      <div className="space-y-1.5">
        {recentBets.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/50 p-4 text-center">
            <Target className="mx-auto mb-2 h-6 w-6 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">
              Aucun pari enregistré. Placez votre premier pari pour commencer à suivre vos performances.
            </p>
          </div>
        ) : (
          recentBets.map((bet) => (
            <div
              key={bet.id}
              className={cn(
                "flex items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors",
                bet.status === "won" && "border-emerald-500/30 bg-emerald-500/5",
                bet.status === "lost" && "border-red-500/30 bg-red-500/5",
                bet.status === "pending" && "border-border/50 bg-card/50",
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold",
                  bet.status === "won" && "bg-emerald-500/20 text-emerald-500",
                  bet.status === "lost" && "bg-red-500/20 text-red-500",
                  bet.status === "pending" && "bg-muted text-muted-foreground",
                )}>
                  {bet.status === "won" ? "W" : bet.status === "lost" ? "L" : "…"}
                </div>
                <div>
                  <div className="font-medium">
                    {bet.playerA} vs {bet.playerB}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {bet.betOnName} • {bet.odd.toFixed(2)} • {formatDate(bet.placedAt)}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="font-mono text-xs tabular-nums">
                  {bet.stake}€
                </div>
                {bet.payout !== undefined && (
                  <div className={cn(
                    "font-mono text-[10px] tabular-nums",
                    bet.status === "won" ? "text-emerald-500" : "text-red-500",
                  )}>
                    {bet.status === "won" ? `+${bet.payout.toFixed(0)}€` : `-${bet.stake.toFixed(0)}€`}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
