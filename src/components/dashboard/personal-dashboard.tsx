"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  TrendingUp,
  TrendingDown,
  Target,
  BarChart3,
  Clock,
  Flame,
  Trophy,
  AlertCircle,
} from "lucide-react";
import { useFollowStore } from "@/stores/use-follow-store";
import { usePaperTrading } from "@/hooks/use-paper-trading";
import { cn } from "@/lib/utils";

/**
 * Dashboard personnel avec KPIs favoris.
 *
 * Affiche :
 * - Win rate (paper trading)
 * - Profit total
 * - Paris en cours
 * - Série de victoires actuelle
 * - Top 5 sport suivi
 * - Dernières prédictions
 *
 * Pattern The Athletic dashboard — données clés en nombres clairs,
 * pas de charts superflus (Tufte: data-ink ratio max).
 */

type KpiCardProps = {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  color?: string;
};

function KpiCard({ icon, label, value, subtitle, trend, color }: KpiCardProps) {
  return (
    <div className="rounded-lg border border-border/50 bg-card/50 p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <div className={cn("flex h-6 w-6 items-center justify-center rounded-md", color ?? "bg-muted")}>
          {icon}
        </div>
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="font-mono text-lg font-bold tabular-nums">
        {value}
      </div>
      {subtitle && (
        <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
          {trend === "up" && <TrendingUp className="h-3 w-3 text-emerald-500" />}
          {trend === "down" && <TrendingDown className="h-3 w-3 text-red-500" />}
          <span>{subtitle}</span>
        </div>
      )}
    </div>
  );
}

type Props = {
  className?: string;
};

export function PersonalDashboard({ className }: Props) {
  const t = useTranslations("dashboard");
  const { follows, getByCategory } = useFollowStore();
  const { bets } = usePaperTrading();

  const stats = useMemo(() => {
    const settledBets = bets.filter((b) => b.status === "won" || b.status === "lost");
    const wonBets = settledBets.filter((b) => b.status === "won");
    const totalStake = settledBets.reduce((acc, b) => acc + b.stake, 0);
    const totalPayout = settledBets.reduce((acc, b) => acc + (b.payout ?? 0), 0);
    const profit = totalPayout - totalStake;
    const winRate = settledBets.length > 0 ? (wonBets.length / settledBets.length) * 100 : 0;

    // Série de victoires actuelle
    let streak = 0;
    for (let i = settledBets.length - 1; i >= 0; i--) {
      if (settledBets[i].status === "won") {
        streak++;
      } else {
        break;
      }
    }

    // Paris en cours
    const pendingBets = bets.filter((b) => b.status === "pending");

    // Sport le plus suivi
    const sportCounts: Record<string, number> = {};
    for (const entry of Object.values(follows)) {
      if (entry.sport) {
        sportCounts[entry.sport] = (sportCounts[entry.sport] ?? 0) + 1;
      }
    }
    const topSport = Object.entries(sportCounts).sort((a, b) => b[1] - a[1])[0];

    // Follows par catégorie
    const playerCount = getByCategory("player").length;
    const teamCount = getByCategory("team").length;
    const leagueCount = getByCategory("league").length;

    return {
      winRate,
      profit,
      pendingCount: pendingBets.length,
      streak,
      topSport: topSport ? { name: topSport[0], count: topSport[1] } : null,
      playerCount,
      teamCount,
      leagueCount,
      totalBets: settledBets.length,
    };
  }, [bets, follows, getByCategory]);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Mon tableau de bord</h3>
        <span className="font-mono text-[10px] text-muted-foreground">
          {stats.totalBets} paris • {Object.keys(follows).length} follows
        </span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2">
        <KpiCard
          icon={<Target className="h-3.5 w-3.5" />}
          label="Win Rate"
          value={`${stats.winRate.toFixed(1)}%`}
          subtitle={stats.totalBets > 0 ? `${stats.totalBets} paris settlers` : "Pas encore de données"}
          trend={stats.winRate > 50 ? "up" : stats.winRate < 40 ? "down" : "neutral"}
          color="bg-emerald-500/15 text-emerald-600"
        />

        <KpiCard
          icon={<BarChart3 className="h-3.5 w-3.5" />}
          label="Profit"
          value={`${stats.profit >= 0 ? "+" : ""}${stats.profit.toFixed(0)}€`}
          subtitle={stats.totalBets > 0 ? `sur ${stats.totalBets} paris` : "Aucun pari settlers"}
          trend={stats.profit > 0 ? "up" : stats.profit < 0 ? "down" : "neutral"}
          color={stats.profit >= 0 ? "bg-emerald-500/15 text-emerald-600" : "bg-red-500/15 text-red-600"}
        />

        <KpiCard
          icon={<Clock className="h-3.5 w-3.5" />}
          label="En cours"
          value={stats.pendingCount}
          subtitle={stats.pendingCount > 0 ? "Paris actifs" : "Rien en attente"}
          color="bg-blue-500/15 text-blue-600"
        />

        <KpiCard
          icon={<Flame className="h-3.5 w-3.5" />}
          label="Série"
          value={stats.streak > 0 ? `+${stats.streak}` : "0"}
          subtitle={stats.streak > 3 ? "🔥 En feu !" : stats.streak > 0 ? "Victoires consécutives" : "Pas de série"}
          color={stats.streak > 0 ? "bg-amber-500/15 text-amber-600" : "bg-muted text-muted-foreground"}
        />
      </div>

      {/* Follows summary */}
      <div className="rounded-lg border border-border/50 bg-card/50 p-3">
        <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Mes follows
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="font-mono font-bold">{stats.playerCount}</span>
            <span className="text-muted-foreground">joueurs</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono font-bold">{stats.teamCount}</span>
            <span className="text-muted-foreground">équipes</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono font-bold">{stats.leagueCount}</span>
            <span className="text-muted-foreground">ligues</span>
          </div>
        </div>
        {stats.topSport && (
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Trophy className="h-3 w-3 text-emerald-500" />
            <span>
              Sport principal : <span className="font-medium text-foreground">{stats.topSport.name}</span> ({stats.topSport.count} follows)
            </span>
          </div>
        )}
      </div>

      {/* Empty state */}
      {Object.keys(follows).length === 0 && stats.totalBets === 0 && (
        <div className="rounded-lg border border-dashed border-border/50 p-4 text-center">
          <AlertCircle className="mx-auto mb-2 h-6 w-6 text-muted-foreground/30" />
          <p className="text-xs text-muted-foreground">
            Commencez à suivre des joueurs et à placer des paris pour voir vos stats ici.
          </p>
        </div>
      )}
    </div>
  );
}
