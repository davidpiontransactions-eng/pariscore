"use client";

import { cn } from "@/lib/utils";

export const DEFAULT_FILTERS = [
  { key: "all", label: "Tous" },
  { key: "value", label: "💰 Value Bets (>8%)" },
  { key: "confidence", label: "📊 Confiance Élevée" },
  { key: "live", label: "⚡ Live" },
  { key: "favorites", label: "⭐ Favoris" },
  { key: "ai", label: "🔮 AI Insight" },
] as const;

type FilterItem = {
  key: string;
  label: string;
  icon?: string;
};

type Props = {
  filters: FilterItem[];
  activeFilter: string;
  onFilterChange: (key: string) => void;
  className?: string;
};

export function QuickValueFilters({
  filters,
  activeFilter,
  onFilterChange,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "mb-4 flex gap-2 overflow-x-auto snap-x scrollbar-none",
        className,
      )}
    >
      {filters.map((f) => (
        <button
          key={f.key}
          onClick={() => onFilterChange(f.key)}
          className={cn(
            "shrink-0 snap-start rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            activeFilter === f.key
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-background hover:bg-muted",
          )}
        >
          {f.icon && <span className="mr-1">{f.icon}</span>}
          {f.label}
        </button>
      ))}
    </div>
  );
}
