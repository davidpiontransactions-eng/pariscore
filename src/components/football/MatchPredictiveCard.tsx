"use client";

// MatchPredictiveCard — Analyse prédictive hybride (ML + statistique).
// Affiche badge tendance, résumé, 3 paris. ZERO lien externe.

import { TrendingUp, Target, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MLPrediction, TrendLabel } from "@/lib/prediction/football/prediction-ml-engine";

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

export type MatchPredictiveCardProps = { prediction: MLPrediction; className?: string };

export function MatchPredictiveCard({ prediction, className }: MatchPredictiveCardProps) {
  const { trend, summary, topBets, homeProb, drawProb, awayProb, sources } = prediction;

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
            <span key={k} className="font-mono text-[10px] uppercase tracking-wider bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
              {k === "rf" ? "RF" : k === "xgboost" ? "XGB" : "DC"} {Math.round(sources[k].home * 100)}%
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

