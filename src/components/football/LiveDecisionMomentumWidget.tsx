"use client";

// LiveDecisionMomentumWidget — Indicateurs de décision live In-Play.
// Affiche : indice de pression [-100,+100], alerte but imminent, marchés live.

import { useEffect, useState, useCallback } from "react";
import { Zap, AlertTriangle, Gauge } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScoreFlash } from "@/components/shared/score-flash";
import type { LiveMLPrediction } from "@/lib/prediction/football/prediction-ml-engine";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LiveDecisionMomentumProps = {
  live: LiveMLPrediction;
  /** Callback de rafraîchissement (polling 30-60s) */
  onRefresh?: () => void;
  refreshIntervalMs?: number;
  className?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pressureColor(val: number): string {
  const abs = Math.abs(val);
  if (abs > 70) return "text-red-500";
  if (abs > 40) return "text-amber-500";
  return "text-muted-foreground";
}

function pressureBg(val: number): string {
  const abs = Math.abs(val);
  if (abs > 70) return "bg-red-500";
  if (abs > 40) return "bg-amber-500";
  return "bg-blue-500";
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PressureGauge({ value }: { value: number }) {
  // -100 = full left (away pressure), +100 = full right (home pressure)
  const pct = Math.round(((value + 100) / 200) * 100);
  const side = value > 0 ? "Domicile" : value < 0 ? "Extérieur" : "Équilibré";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Gauge className="w-3.5 h-3.5" /> Indice de Pression
        </span>
        <span className={`text-sm font-bold tabular-nums ${pressureColor(value)}`}>
          {value > 0 ? "+" : ""}{value}
        </span>
      </div>
      <Progress value={pct} className="h-2.5" indicatorClassName={pressureBg(value)} />
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>Pression Ext.</span>
        <span className="font-medium">{side}</span>
        <span>Pression Dom.</span>
      </div>
    </div>
  );
}

function GoalAlertBadge({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <Badge variant="destructive" className="animate-pulse gap-1.5">
      <AlertTriangle className="w-3 h-3" /> Alerte But Imminent
    </Badge>
  );
}

function Live1X2Bar({ home, draw, away }: { home: number; draw: number; away: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">1X2 Live</span>
        <span className="text-muted-foreground tabular-nums">{Math.round(home)}% / {Math.round(draw)}% / {Math.round(away)}%</span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden bg-muted">
        <div className="bg-blue-500 transition-all" style={{ width: `${home}%` }} />
        <div className="bg-gray-400 transition-all" style={{ width: `${draw}%` }} />
        <div className="bg-red-500 transition-all" style={{ width: `${away}%` }} />
      </div>
    </div>
  );
}
// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function LiveDecisionMomentumWidget({
  live, onRefresh, refreshIntervalMs = 60000, className,
}: LiveDecisionMomentumProps) {
  const [elapsed, setElapsed] = useState(0);

  // Polling interne (30-60s)
  useEffect(() => {
    if (!onRefresh) return;
    const id = setInterval(() => { onRefresh(); setElapsed(0); }, refreshIntervalMs);
    return () => clearInterval(id);
  }, [onRefresh, refreshIntervalMs]);

  // Compteur secondes depuis dernier refresh
  useEffect(() => {
    const id = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const { minute, score, liveMarkets, pressureIndex, goalAlert } = live;
  const isLive = minute < 90;

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className={`w-4 h-4 ${isLive ? "text-green-500 animate-pulse" : "text-muted-foreground"}`} />
            Décision Live
          </CardTitle>
          <div className="flex items-center gap-2">
            <GoalAlertBadge active={goalAlert} />
            <Badge variant={isLive ? "default" : "secondary"} className="gap-1 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              {isLive ? `${minute}'` : "Terminé"}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Score */}
        <ScoreFlash scoreKey={`${score.home}-${score.away}`} className="flex items-center justify-center gap-4 py-1">
          <span className="text-2xl font-bold tabular-nums">{score.home}</span>
          <span className="text-lg text-muted-foreground">-</span>
          <span className="text-2xl font-bold tabular-nums">{score.away}</span>
        </ScoreFlash>

        {/* Indice de Pression */}
        <PressureGauge value={pressureIndex} />

        {/* 1X2 Live */}
        <Live1X2Bar home={liveMarkets.homeWin} draw={liveMarkets.draw} away={liveMarkets.awayWin} />

        {/* Marchés résiduels */}
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: "O 1.5", val: liveMarkets.over15 },
            { label: "O 2.5", val: liveMarkets.over25 },
            { label: "BTTS", val: liveMarkets.btts },
          ].map(({ label, val }) => (
            <div key={label} className="p-2 rounded-md bg-muted/50">
              <div className="text-[11px] text-muted-foreground">{label}</div>
              <div className="text-sm font-bold tabular-nums">{Math.round(val)}%</div>
            </div>
          ))}
        </div>

        {/* Footer : rafraîchissement */}
        {onRefresh && (
          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/50">
            <span>Refresh: {refreshIntervalMs / 1000}s</span>
            <span>{elapsed}s écoulées</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

