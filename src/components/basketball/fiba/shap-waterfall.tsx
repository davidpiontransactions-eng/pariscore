"use client";

import { cn } from "@/lib/utils";
import type { HybridPrediction } from "@/lib/predictions/fiba-predictions";

type ShapWaterfallProps = {
  prediction: HybridPrediction;
  homeAbbr: string;
  awayAbbr: string;
  className?: string;
};

/**
 * SHAP Waterfall Chart — visualise l'impact de chaque feature sur la prédiction.
 * Format: barres horizontales colorées (vert = positif pour domicile, rouge = négatif).
 */
export function ShapWaterfall({ prediction, homeAbbr, awayAbbr, className }: ShapWaterfallProps) {
  const { shapValues, featureImportance } = prediction;
  
  if (!shapValues || !featureImportance) {
    return (
      <div className={cn("text-xs text-muted-foreground", className)}>
        SHAP values non disponibles
      </div>
    );
  }

  // Top 8 features par importance
  const topFeatures = featureImportance.slice(0, 8);
  
  // Labels des features en français
  const featureLabels: Record<string, string> = {
    eFG: "Eff. Field Goal %",
    dREB: "Rebonds déf.",
    TOV: "Turnovers",
    AST: "Passes déc.",
    FT: "Lancers francs",
    restDays: "Jours repos",
    isHome: "Domicile",
    rankDiff: "Diff. classement",
    offensiveRating: "Off. Rating",
    defensiveRating: "Def. Rating",
    pace: "Rythme (pace)",
    trueShooting: "True Shooting %",
    assistTurnoverRatio: "Ratio AST/TOV",
    benchPoints: "Points banc",
    pointsInPaint: "Points peinture",
    fastBreakPoints: "Points transition",
  };

  // Trouver la valeur max pour normaliser les barres
  const maxAbsValue = Math.max(...topFeatures.map((f) => Math.abs(f.importance)), 0.01);

  return (
    <div className={cn("space-y-1.5", className)}>
      {/* Header */}
      <div className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        <span>Impact sur la prédiction</span>
        <span className="flex items-center gap-2">
          <span className="flex items-center gap-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Fav. {homeAbbr}
          </span>
          <span className="flex items-center gap-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            Fav. {awayAbbr}
          </span>
        </span>
      </div>

      {/* Waterfall bars */}
      {topFeatures.map(({ feature, importance }) => {
        const shapVal = shapValues[feature as keyof typeof shapValues] ?? 0;
        const isPositive = shapVal > 0; // positif = avantage domicile
        const barWidth = Math.min((Math.abs(shapVal) / maxAbsValue) * 100, 100);
        
        return (
          <div key={feature} className="flex items-center gap-2">
            {/* Label */}
            <span className="w-28 text-[10px] text-right text-muted-foreground truncate" title={featureLabels[feature] ?? feature}>
              {featureLabels[feature] ?? feature}
            </span>
            
            {/* Bar */}
            <div className="flex-1 h-3 bg-muted/30 rounded-sm overflow-hidden relative">
              <div
                className={cn(
                  "h-full rounded-sm transition-all duration-300",
                  isPositive ? "bg-emerald-500/70" : "bg-red-500/70",
                )}
                style={{ width: `${barWidth}%` }}
              />
              {/* Centre line */}
              <div className="absolute inset-y-0 left-1/2 w-px bg-foreground/20" />
            </div>
            
            {/* Value */}
            <span className={cn(
              "w-12 text-[10px] font-mono tabular-nums text-right",
              isPositive ? "text-emerald-500" : "text-red-500",
            )}>
              {shapVal > 0 ? "+" : ""}{(shapVal * 100).toFixed(1)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
