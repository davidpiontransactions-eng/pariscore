"use client";

// TennisMarketFilters — filtres pour les marchés tennis.
//
// Permet de filtrer par catégorie, probabilité minimum, et mode (live/prematch).

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type MarketCategory =
  | "match-winner"
  | "set-score"
  | "set-handicap"
  | "game-handicap"
  | "total-games"
  | "aces"
  | "tiebreak"
  | "first-set"
  | "double-result"
  | "live";

type Props = {
  selectedCategory: MarketCategory | "all";
  onCategoryChange: (category: MarketCategory | "all") => void;
  minProb: number;
  onMinProbChange: (prob: number) => void;
  showLiveOnly: boolean;
  onShowLiveOnlyChange: (live: boolean) => void;
  className?: string;
};

const CATEGORIES: Array<{ value: MarketCategory | "all"; label: string }> = [
  { value: "all", label: "Tous les marchés" },
  { value: "match-winner", label: "Vainqueur" },
  { value: "set-score", label: "Score exact" },
  { value: "set-handicap", label: "Handicap sets" },
  { value: "game-handicap", label: "Handicap jeux" },
  { value: "total-games", label: "Total jeux" },
  { value: "aces", label: "Aces" },
  { value: "tiebreak", label: "Tiebreak" },
  { value: "first-set", label: "1er set" },
  { value: "double-result", label: "Double résultat" },
  { value: "live", label: "Live" },
];

const PROB_THRESHOLDS = [
  { value: 0, label: "Tous" },
  { value: 50, label: "> 50%" },
  { value: 60, label: "> 60%" },
  { value: 70, label: "> 70%" },
  { value: 80, label: "> 80%" },
];

export function TennisMarketFilters({
  selectedCategory,
  onCategoryChange,
  minProb,
  onMinProbChange,
  showLiveOnly,
  onShowLiveOnlyChange,
  className,
}: Props) {
  const t = useTranslations("tennis.markets");

  const handleReset = useCallback(() => {
    onCategoryChange("all");
    onMinProbChange(0);
    onShowLiveOnlyChange(false);
  }, [onCategoryChange, onMinProbChange, onShowLiveOnlyChange]);

  const hasActiveFilters = selectedCategory !== "all" || minProb > 0 || showLiveOnly;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {/* Icône filtre */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Filter className="h-4 w-4" />
        <span>{t("filters", { defaultMessage: "Filtres" })}</span>
      </div>

      {/* Catégorie */}
      <Select value={selectedCategory} onValueChange={(v) => onCategoryChange(v as MarketCategory | "all")}>
        <SelectTrigger className="w-[180px] h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CATEGORIES.map((cat) => (
            <SelectItem key={cat.value} value={cat.value}>
              {cat.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Probabilité minimum */}
      <Select value={String(minProb)} onValueChange={(v) => onMinProbChange(Number(v))}>
        <SelectTrigger className="w-[120px] h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PROB_THRESHOLDS.map((threshold) => (
            <SelectItem key={threshold.value} value={String(threshold.value)}>
              {threshold.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Toggle live */}
      <Button
        variant={showLiveOnly ? "default" : "outline"}
        size="sm"
        className="h-8"
        onClick={() => onShowLiveOnlyChange(!showLiveOnly)}
      >
        {t("liveOnly", { defaultMessage: "Live uniquement" })}
      </Button>

      {/* Reset */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" className="h-8" onClick={handleReset}>
          <X className="mr-1 h-3 w-3" />
          {t("reset", { defaultMessage: "Réinitialiser" })}
        </Button>
      )}
    </div>
  );
}
