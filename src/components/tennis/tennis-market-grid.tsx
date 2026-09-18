"use client";

// TennisMarketGrid — grille de marchés tennis avec probabilités.
//
// Affiche les marchés calculés par /api/v1/tennis/markets avec
// color-coding des value bets et liens vers bookmakers.

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Target, TrendingUp, TrendingDown, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

type MarketResult = {
  id: string;
  label: string;
  category: string;
  probA: number;
  probB: number;
  edge?: number;
  kelly?: number;
  recommended: boolean;
};

type Props = {
  markets: MarketResult[];
  className?: string;
};

/** Catégories avec icônes. */
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "match-winner": <Target className="h-4 w-4" />,
  "set-score": <Target className="h-4 w-4" />,
  "set-handicap": <TrendingUp className="h-4 w-4" />,
  "game-handicap": <TrendingUp className="h-4 w-4" />,
  "total-games": <TrendingUp className="h-4 w-4" />,
  "aces": <Zap className="h-4 w-4" />,
  "tiebreak": <Zap className="h-4 w-4" />,
  "first-set": <Target className="h-4 w-4" />,
  "double-result": <Target className="h-4 w-4" />,
  "live": <Zap className="h-4 w-4" />,
};

/** Labels de catégories (FR). */
const CATEGORY_LABELS: Record<string, string> = {
  "match-winner": "Vainqueur",
  "set-score": "Score exact",
  "set-handicap": "Handicap sets",
  "game-handicap": "Handicap jeux",
  "total-games": "Total jeux",
  "aces": "Aces",
  "tiebreak": "Tiebreak",
  "first-set": "1er set",
  "double-result": "Double résultat",
  "live": "Live",
};

/**
 * Couleur de fond selon la probabilité (value bet detection).
 * Vert foncé = très probable (>75%), Vert = probable (60-75%),
 * Jaune = modéré (45-60%), Rouge = improbable (<45%).
 */
function probColor(prob: number): string {
  if (prob >= 75) return "bg-emerald-600/20 text-emerald-300 border-emerald-500/30";
  if (prob >= 60) return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  if (prob >= 45) return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
  return "bg-red-500/10 text-red-400 border-red-500/20";
}

/**
 * Couleur du badge edge.
 */
function edgeColor(edge: number): string {
  if (edge >= 10) return "bg-emerald-600 text-white";
  if (edge >= 5) return "bg-emerald-500/80 text-white";
  if (edge >= 0) return "bg-yellow-500/80 text-white";
  return "bg-red-500/80 text-white";
}

export function TennisMarketGrid({ markets, className }: Props) {
  const t = useTranslations("tennis.markets");

  // Grouper par catégorie
  const grouped = useMemo(() => {
    const groups = new Map<string, MarketResult[]>();
    for (const m of markets) {
      const existing = groups.get(m.category) ?? [];
      existing.push(m);
      groups.set(m.category, existing);
    }
    return groups;
  }, [markets]);

  if (markets.length === 0) {
    return (
      <div className={cn("text-center py-8 text-muted-foreground", className)}>
        <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>{t("noMarkets", { defaultMessage: "Aucun marché disponible" })}</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {Array.from(grouped.entries()).map(([category, categoryMarkets]) => (
        <div key={category} className="space-y-2">
          {/* En-tête de catégorie */}
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            {CATEGORY_ICONS[category]}
            <span>{CATEGORY_LABELS[category] ?? category}</span>
            <span className="text-xs opacity-50">({categoryMarkets.length})</span>
          </div>

          {/* Grille de marchés */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {categoryMarkets.map((market) => (
              <MarketCard key={market.id} market={market} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Carte individuelle d'un marché. */
function MarketCard({ market }: { market: MarketResult }) {
  const maxProb = Math.max(market.probA, market.probB);
  const isA = market.probA >= market.probB;

  return (
    <div
      className={cn(
        "relative rounded-lg border p-3 transition-colors",
        "hover:bg-accent/50",
        probColor(maxProb),
      )}
    >
      {/* Badge reco */}
      {market.recommended && (
        <div className="absolute top-1 right-1">
          <span className="inline-flex items-center rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary">
            <Target className="mr-0.5 h-2.5 w-2.5" />
            Reco
          </span>
        </div>
      )}

      {/* Label */}
      <div className="text-xs font-medium mb-2 pr-12">{market.label}</div>

      {/* Probabilités */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("text-lg font-bold", isA ? "text-foreground" : "text-muted-foreground")}>
            {market.probA}%
          </span>
          <span className="text-xs text-muted-foreground">vs</span>
          <span className={cn("text-lg font-bold", !isA ? "text-foreground" : "text-muted-foreground")}>
            {market.probB}%
          </span>
        </div>

        {/* Barre de probabilité */}
        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${market.probA}%` }}
          />
        </div>
      </div>

      {/* Edge / Kelly */}
      {(market.edge !== undefined || market.kelly !== undefined) && (
        <div className="flex gap-2 mt-2">
          {market.edge !== undefined && (
            <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium", edgeColor(market.edge))}>
              {market.edge > 0 ? <TrendingUp className="mr-0.5 h-2.5 w-2.5" /> : <TrendingDown className="mr-0.5 h-2.5 w-2.5" />}
              Edge {market.edge > 0 ? "+" : ""}{market.edge}%
            </span>
          )}
          {market.kelly !== undefined && market.kelly > 0 && (
            <span className="inline-flex items-center rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-medium text-blue-400">
              <Zap className="mr-0.5 h-2.5 w-2.5" />
              Kelly {market.kelly}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}
