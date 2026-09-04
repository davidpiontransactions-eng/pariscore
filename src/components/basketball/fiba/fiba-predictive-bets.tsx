"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { FibaMatch } from "@/app/api/fiba/scoreboard/route";
import type { HybridPrediction } from "@/lib/predictions/fiba-predictions";
import type { FibaTeamStats } from "@/app/api/fiba/stats/route";

type FibaPredictiveBetsProps = {
  match: FibaMatch;
  prediction: HybridPrediction;
  homeStats?: FibaTeamStats;
  awayStats?: FibaTeamStats;
  className?: string;
};

type BetSignal = {
  label: string;
  value: string;
  confidence: number;
  edge: number;
  type: "moneyline" | "total" | "spread";
  isValue: boolean;
};

/**
 * Génère 3 signaux prédictifs pour une carte de match FIBA.
 *
 * Prematch : Moneyline, Total O/U, Spread
 * Live : Live Winner, Live Total Adjusted, Momentum
 */
export function FibaPredictiveBets({
  match,
  prediction,
  homeStats,
  awayStats,
  className,
}: FibaPredictiveBetsProps) {
  const isLive = match.status === "in";
  const isPre = match.status === "pre";

  const bets = useMemo<BetSignal[]>(() => {
    if (isPre) return computePrematchBets(match, prediction, homeStats, awayStats);
    if (isLive) return computeLiveBets(match, prediction, homeStats, awayStats);
    return [];
  }, [match, prediction, homeStats, awayStats, isLive, isPre]);

  if (bets.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-1 mt-2 pt-2 border-t border-muted/30", className)}>
      <div className="flex items-center gap-1 mb-0.5">
        <span className="text-[9px] font-bold uppercase tracking-wider text-primary">
          {isLive ? "Live Predict" : "Pari Predict"}
        </span>
        <span className="text-[8px] text-muted-foreground">IA</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {bets.map((bet) => (
          <BetChip key={bet.type} bet={bet} />
        ))}
      </div>
    </div>
  );
}

function BetChip({ bet }: { bet: BetSignal }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-lg px-1.5 py-1 text-center transition-colors",
        bet.isValue
          ? "bg-emerald-500/10 border border-emerald-500/30"
          : "bg-white/[0.04] border border-white/[0.06]",
      )}
    >
      <span className="text-[8px] text-muted-foreground font-medium leading-none mb-0.5">
        {bet.label}
      </span>
      <span
        className={cn(
          "text-[11px] font-black leading-none",
          bet.isValue ? "text-emerald-400" : "text-foreground",
        )}
      >
        {bet.value}
      </span>
      <div className="flex items-center gap-0.5 mt-0.5">
        <span className="text-[8px] tabular-nums text-muted-foreground">
          {bet.confidence}%
        </span>
        {bet.edge !== 0 && (
          <span
            className={cn(
              "text-[8px] font-bold tabular-nums",
              bet.edge > 0 ? "text-emerald-500" : "text-red-400",
            )}
          >
            {bet.edge > 0 ? "+" : ""}
            {bet.edge}%
          </span>
        )}
      </div>
      {bet.isValue && (
        <span className="text-[7px] font-bold text-emerald-500 uppercase mt-0.5">
          Value
        </span>
      )}
    </div>
  );
}

// ─── Prematch Bets ──────────────────────────────────────────────────────────

function computePrematchBets(
  match: FibaMatch,
  prediction: HybridPrediction,
  homeStats?: FibaTeamStats,
  awayStats?: FibaTeamStats,
): BetSignal[] {
  const pHome = prediction.blendedPHome;
  const pAway = 1 - pHome;

  // 1. Moneyline — gagnant prédit
  const mlProb = Math.max(pHome, pAway);
  const mlTeam = pHome > pAway ? match.home.abbr : match.away.abbr;
  const mlEdge = Math.round((mlProb - 0.5) * 100);

  // 2. Total O/U — estimation basée sur pace + off ratings
  const avgPace = homeStats?.pace && awayStats?.pace
    ? (homeStats.pace + awayStats.pace) / 2
    : 70; // défaut FIBA (40 min, pace plus bas que NBA)
  const avgORtg = homeStats?.ORtg && awayStats?.ORtg
    ? (homeStats.ORtg + awayStats.ORtg) / 2
    : 105;
  const predictedTotal = Math.round(avgPace * avgORtg / 100 * 2 * 0.92); // FIBA 40min adjustment
  const totalLine = predictedTotal; // line = prediction
  const totalSignal = predictedTotal > 150 ? "OVER" : "UNDER";
  const totalConf = Math.min(95, Math.round(55 + Math.abs(predictedTotal - 148) * 0.8));

  // 3. Spread — marge prédite
  const spreadPred = Math.round((pHome - 0.5) * 30); // conversion prob → spread approx
  const spreadAbs = Math.abs(spreadPred);
  const spreadTeam = spreadPred > 0 ? match.home.abbr : match.away.abbr;
  const spreadConf = Math.min(92, Math.round(50 + Math.abs(spreadPred) * 1.5));

  return [
    {
      label: "Gagnant",
      value: mlTeam,
      confidence: Math.round(mlProb * 100),
      edge: mlEdge,
      type: "moneyline",
      isValue: mlProb > 0.58,
    },
    {
      label: `Total ${totalLine}`,
      value: totalSignal,
      confidence: totalConf,
      edge: Math.round((totalConf - 50) * 0.4),
      type: "total",
      isValue: totalConf > 60,
    },
    {
      label: `Spread`,
      value: `${spreadPred > 0 ? "+" : ""}${spreadPred} ${spreadTeam}`,
      confidence: spreadConf,
      edge: Math.round((spreadConf - 50) * 0.3),
      type: "spread",
      isValue: spreadAbs > 5,
    },
  ];
}

// ─── Live Bets ──────────────────────────────────────────────────────────────

function computeLiveBets(
  match: FibaMatch,
  prediction: HybridPrediction,
  homeStats?: FibaTeamStats,
  awayStats?: FibaTeamStats,
): BetSignal[] {
  const pHome = prediction.blendedPHome;
  const pAway = 1 - pHome;
  const quarter = match.period || 1;
  const elapsed = (quarter - 1) * 10; // minutes jouées approx

  // Ajuster les probabilités basé sur le score actuel
  const homeScore = match.home.score ?? 0;
  const awayScore = match.away.score ?? 0;
  const scoreDiff = homeScore - awayScore;

  // Bonus momentum basé sur l'écart de score
  const momentumBonus = scoreDiff * 0.015; // +1.5% par point d'avance
  const livePHome = Math.min(0.95, Math.max(0.05, pHome + momentumBonus));
  const livePAway = 1 - livePHome;

  // 1. Live Winner
  const liveProb = Math.max(livePHome, livePAway);
  const liveTeam = livePHome > livePAway ? match.home.abbr : match.away.abbr;
  const liveEdge = Math.round((liveProb - 0.5) * 100);

  // 2. Live Total Adjusted — pace actuel extrapolié
  const minutesPlayed = Math.min(40, elapsed + parseInt(match.clock?.split(":")[0] || "0"));
  const currentPace = minutesPlayed > 0 ? (homeScore + awayScore) / minutesPlayed * 40 : 70;
  const projectedTotal = Math.round(currentPace);
  const liveTotalSignal = projectedTotal > (homeScore + awayScore + 30) ? "OVER" : "UNDER";
  const totalConf = Math.min(90, Math.round(50 + Math.abs(projectedTotal - 148) * 0.6));

  // 3. Momentum — qui domine maintenant
  const momentumTeam = scoreDiff > 2 ? match.home.abbr : scoreDiff < -2 ? match.away.abbr : "ÉGAL";
  const momentumPct = Math.min(95, Math.round(50 + Math.abs(scoreDiff) * 2));

  return [
    {
      label: "Live Winner",
      value: liveTeam,
      confidence: Math.round(liveProb * 100),
      edge: liveEdge,
      type: "moneyline",
      isValue: liveProb > 0.65,
    },
    {
      label: `Live Total ~${projectedTotal}`,
      value: liveTotalSignal,
      confidence: totalConf,
      edge: Math.round((totalConf - 50) * 0.3),
      type: "total",
      isValue: totalConf > 58,
    },
    {
      label: "Momentum",
      value: momentumTeam,
      confidence: momentumPct,
      edge: scoreDiff !== 0 ? Math.round(Math.abs(scoreDiff) * 1.5) : 0,
      type: "spread",
      isValue: Math.abs(scoreDiff) > 8,
    },
  ];
}
