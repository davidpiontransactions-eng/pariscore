"use client";

import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  STRATEGY_FILTER_LABELS,
  STRATEGY_FILTERS_BY_SPORT,
  type StrategyFilter,
} from "@/lib/match-view";

interface StrategyFilterDropdownProps {
  sport: string;
  value: StrategyFilter;
  onChange: (filter: StrategyFilter) => void;
  /** Compteurs optionnels par filtre (ex: { value: 12, corners: 5 }) */
  counts?: Partial<Record<StrategyFilter, number>>;
  className?: string;
}

/**
 * Dropdown unifié de filtres de stratégie (football + tennis).
 * Utilise le type partagé StrategyFilter et affiche les filtres
 * pertinents selon le sport sélectionné.
 */
export function StrategyFilterDropdown({
  sport,
  value,
  onChange,
  counts,
  className,
}: StrategyFilterDropdownProps) {
  const filters = useMemo(() => {
    const keys = STRATEGY_FILTERS_BY_SPORT[sport] ?? STRATEGY_FILTERS_BY_SPORT.football;
    return keys.map((key) => ({
      key,
      label: STRATEGY_FILTER_LABELS[key],
      count: counts?.[key],
    }));
  }, [sport, counts]);

  return (
    <Select value={value} onValueChange={(v) => onChange(v as StrategyFilter)}>
      <SelectTrigger className={`w-[200px] text-xs font-semibold ${className ?? ""}`}>
        <SelectValue placeholder="Filtrer..." />
      </SelectTrigger>
      <SelectContent>
        {filters.map((f) => (
          <SelectItem key={f.key} value={f.key} className="text-xs">
            <span className="flex items-center gap-2">
              {f.label}
              {f.count !== undefined && f.count > 0 && (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {f.count}
                </span>
              )}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
