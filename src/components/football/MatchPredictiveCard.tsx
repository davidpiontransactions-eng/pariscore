"use client";

// MatchPredictiveCard — Analyse prédictive hybride (ML + statistique).
// Affiche badge tendance, résumé, 3 paris. ZERO lien externe.

import { TrendingUp, Target, Sparkles, Cpu } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MLPrediction, TrendLabel } from "@/lib/prediction/football/prediction-ml-engine";
import { usePredictionCompute } from "@/hooks/use-prediction-compute";

const TREND_STYLES: Record<TrendLabel, { variant: "default" | "secondary" | "destructive" | "outline"; emoji: string; label: string }> = {
  strong_home: { variant: "default", emoji: "🔥", label: "Forte domination domicile" },
  home_favored: { variant: "secondary", emoji: "📈", label: "Avantage domicile" },
  balanced: { variant: "outline", emoji: "⚖️", label: "Match équilibré" },
  away_favored: { variant: "secondary", emoji: "📉", label: "Avantage extérieur" },
  strong_away: { variant: "destructive", emoji: "❄️", label: "Forte domination extérieur" },
};

function TrendBadge({ trend }: { trend: TrendLabel }) {
  const s = TREND_STYLES[trend];
  return <Badge variant={s.variant} className="gap-1.5 px-3 py-1.5 text-sm font-semibold"><span>{s.emoji}</span><span>{s.label}</span></Badge>;
}

function BetRow({ icon, label, prob }: { icon: string; label: string; prob: number }) {
  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
      <span className="text-xl shrink-0 w-8 text-center">{icon}</span>
      <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{label}</p></div>
      <div className="shrink-0 text-right">
        <span className="text-lg font-bold tabular-nums">{Math.round(prob)}%</span>
        <span className="text-xs text-muted-foreground ml-1">proba</span>
      </div>
    </div>
  );
}

export type MatchPredictiveCardProps = {
  prediction: MLPrediction;
  className?: string;
  /** ID match pour déclencher le calcul ML via usePredictionCompute */
  matchId?: string;
};

export function MatchPredictiveCard({ prediction, className, matchId }: MatchPredictiveCardProps) {
  const { trend, summary, topBets, homeProb, drawProb, awayProb, sources } = prediction;

  // Prédiction ML compute (optionnelle — activée si matchId fourni)
  const { prediction: mlCompute, isLoading: mlLoading } = usePredictionCompute(
    matchId ? { matchId } : null,
  );
  const mlData = mlCompute?.ml;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" /> Analyse Prédictive
          </CardTitle>
          <TrendBadge trend={trend} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Résumé */}
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 border border-amber-200/50 dark:border-amber-800/30">
          <Target className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <p className="text-sm leading-relaxed">{summary}</p>
        </div>

        {/* 1X2 */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Domicile", p: homeProb, bg: "bg-blue-50 dark:bg-blue-950/30" },
            { label: "Nul", p: drawProb, bg: "bg-gray-50 dark:bg-gray-950/30" },
            { label: "Extérieur", p: awayProb, bg: "bg-red-50 dark:bg-red-950/30" },
          ].map(({ label, p, bg }) => (
            <div key={label} className={`text-center p-2 rounded-md ${bg}`}>
              <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
              <div className="text-xl font-bold tabular-nums">{Math.round(p)}%</div>
            </div>
          ))}
        </div>

        {/* ML Compute — indicateur optionnel si hook actif */}
        {mlData && (
          <div className="p-2.5 rounded-lg bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-950/20 dark:to-blue-950/15 border border-cyan-200/50 dark:border-cyan-800/30">
            <div className="flex items-center gap-2 mb-1.5">
              <Cpu className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-cyan-700 dark:text-cyan-300">
                ML Compute
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
              <div><span className="text-muted-foreground">Dom </span><span className="font-bold tabular-nums">{Math.round(mlData.homeProb * 100)}%</span></div>
              <div><span className="text-muted-foreground">Nul </span><span className="font-bold tabular-nums">{Math.round(mlData.drawProb * 100)}%</span></div>
              <div><span className="text-muted-foreground">Ext </span><span className="font-bold tabular-nums">{Math.round(mlData.awayProb * 100)}%</span></div>
            </div>
            {mlData.summary && (
              <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug">{mlData.summary}</p>
            )}
          </div>
        )}
        {mlLoading && matchId && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Cpu className="w-3 h-3 animate-pulse" />
            <span>Chargement ML Compute...</span>
          </div>
        )}

        {/* 3 Paris */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <span className="text-sm font-semibold">3 Paris Prédictifs</span>
          </div>
          <div className="space-y-1.5">
            {topBets.map((bet, i) => <BetRow key={i} {...bet} />)}
          </div>
        </div>

        {/* Sources */}
        <div className="flex items-center gap-3 pt-1 border-t border-border/50">
          <span className="text-[11px] text-muted-foreground">Sources :</span>
          {(["rf", "xgboost", "dixonColes"] as const).map(k => (
            <span key={k} className="font-mono text-[11px] uppercase tracking-wider bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
              {k === "rf" ? "RF" : k === "xgboost" ? "XGB" : "DC"} {Math.round(sources[k].home * 100)}%
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

