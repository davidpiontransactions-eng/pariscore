"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { runBacktest, type BacktestSummary } from "@/lib/predictions/fiba-backtest";
import { scanAllValueBets, type ValueBet } from "@/lib/predictions/fiba-value-bets";

type BacktestPanelProps = {
  className?: string;
};

export function BacktestPanel({ className }: BacktestPanelProps) {
  const summary = useMemo(() => runBacktest(), []);
  const valueBets = useMemo(() => scanAllValueBets(), []);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Backtest Summary */}
      <div className="rounded-xl border bg-card p-4">
        <h3 className="text-sm font-bold mb-3">Backtest — 24 matchs joués</h3>
        
        {/* Main metrics */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <MetricCard
            label="Accuracy"
            value={`${Math.round(summary.accuracy * 100)}%`}
            detail={`${summary.correctPredictions}/${summary.totalMatches}`}
            color={summary.accuracy > 0.6 ? "emerald" : summary.accuracy > 0.5 ? "yellow" : "red"}
          />
          <MetricCard
            label="Brier Score"
            value={summary.avgBrierScore.toFixed(3)}
            detail="lower = better"
            color={summary.avgBrierScore < 0.2 ? "emerald" : summary.avgBrierScore < 0.25 ? "yellow" : "red"}
          />
          <MetricCard
            label="ROI Moyen"
            value={`${(summary.roi * 100).toFixed(1)}%`}
            detail="if flat betting"
            color={summary.roi > 0 ? "emerald" : "red"}
          />
          <MetricCard
            label="Confiance"
            value={`${Math.round(summary.avgConfidence * 100)}%`}
            detail="avg confidence"
            color="blue"
          />
        </div>

        {/* By Confidence Level */}
        <div className="mb-4">
          <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Par niveau de confiance
          </h4>
          <div className="grid grid-cols-3 gap-2">
            <ConfidenceBucket
              label="Haute (>70%)"
              total={summary.byConfidence.high.total}
              correct={summary.byConfidence.high.correct}
              accuracy={summary.byConfidence.high.accuracy}
            />
            <ConfidenceBucket
              label="Moyenne (40-70%)"
              total={summary.byConfidence.medium.total}
              correct={summary.byConfidence.medium.correct}
              accuracy={summary.byConfidence.medium.accuracy}
            />
            <ConfidenceBucket
              label="Basse (<40%)"
              total={summary.byConfidence.low.total}
              correct={summary.byConfidence.low.correct}
              accuracy={summary.byConfidence.low.accuracy}
            />
          </div>
        </div>

        {/* By Edge Size */}
        <div>
          <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Par taille d'edge
          </h4>
          <div className="grid grid-cols-3 gap-2">
            <ConfidenceBucket
              label="Fort (>15%)"
              total={summary.byEdge.strong.total}
              correct={summary.byEdge.strong.correct}
              accuracy={summary.byEdge.strong.accuracy}
            />
            <ConfidenceBucket
              label="Modéré (5-15%)"
              total={summary.byEdge.moderate.total}
              correct={summary.byEdge.moderate.correct}
              accuracy={summary.byEdge.moderate.accuracy}
            />
            <ConfidenceBucket
              label="Faible (<5%)"
              total={summary.byEdge.weak.total}
              correct={summary.byEdge.weak.correct}
              accuracy={summary.byEdge.weak.accuracy}
            />
          </div>
        </div>
      </div>

      {/* Value Bets */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold">Value Bets détectés</h3>
          <Badge variant="default" className="bg-emerald-500 text-[10px]">
            {valueBets.length} opportunités
          </Badge>
        </div>

        {valueBets.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Aucune value bet détectée pour le moment
          </p>
        ) : (
          <div className="space-y-2">
            {valueBets.map((vb) => (
              <ValueBetCard key={vb.matchId} valueBet={vb} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value, detail, color }: {
  label: string;
  value: string;
  detail: string;
  color: "emerald" | "yellow" | "red" | "blue";
}) {
  const colors = {
    emerald: "text-emerald-500",
    yellow: "text-yellow-500",
    red: "text-red-500",
    blue: "text-blue-500",
  };

  return (
    <div className="rounded-lg bg-muted/50 p-2 text-center">
      <div className={cn("text-lg font-black", colors[color])}>{value}</div>
      <div className="text-[10px] font-semibold text-foreground">{label}</div>
      <div className="text-[9px] text-muted-foreground">{detail}</div>
    </div>
  );
}

function ConfidenceBucket({ label, total, correct, accuracy }: {
  label: string;
  total: number;
  correct: number;
  accuracy: number;
}) {
  return (
    <div className="rounded-lg bg-muted/30 p-2">
      <div className="text-[10px] font-semibold mb-1">{label}</div>
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground">{correct}/{total}</span>
        <span className={cn(
          "font-mono font-bold",
          accuracy > 0.6 ? "text-emerald-500" : accuracy > 0.5 ? "text-yellow-500" : "text-red-500",
        )}>
          {Math.round(accuracy * 100)}%
        </span>
      </div>
      <div className="mt-1 h-1 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full",
            accuracy > 0.6 ? "bg-emerald-500" : accuracy > 0.5 ? "bg-yellow-500" : "bg-red-500",
          )}
          style={{ width: `${accuracy * 100}%` }}
        />
      </div>
    </div>
  );
}

function ValueBetCard({ valueBet }: { valueBet: ValueBet }) {
  const isHome = valueBet.recommendation === "HOME";

  return (
    <div className="flex items-center gap-3 rounded-lg bg-muted/30 p-2">
      {/* Match */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold truncate">
          {valueBet.homeTeam} vs {valueBet.awayTeam}
        </div>
        <div className="text-[10px] text-muted-foreground">
          Cote: {isHome ? valueBet.homeOdds : valueBet.awayOdds}
        </div>
      </div>

      {/* Recommendation */}
      <Badge variant={isHome ? "default" : "secondary"} className="text-[10px]">
        {isHome ? valueBet.homeTeam : valueBet.awayTeam}
      </Badge>

      {/* Edge */}
      <div className="text-right">
        <div className={cn(
          "text-sm font-bold",
          valueBet.expectedValue > 0 ? "text-emerald-500" : "text-red-500",
        )}>
          +{(Math.max(valueBet.homeEdge, valueBet.awayEdge) * 100).toFixed(1)}%
        </div>
        <div className="text-[9px] text-muted-foreground">
          EV: {(valueBet.expectedValue * 100).toFixed(1)}%
        </div>
      </div>

      {/* Kelly */}
      <div className="text-right">
        <div className="text-[10px] font-mono">
          {(valueBet.kellyCapped * 100).toFixed(1)}%
        </div>
        <div className="text-[9px] text-muted-foreground">Kelly</div>
      </div>
    </div>
  );
}
