"use client";

import { cn } from "@/lib/utils";
import { useLiveTicker, type TickerMatch } from "@/hooks/use-live-ticker";
import { Sparkline } from "@/components/tennis/sparkline";
import { Zap } from "lucide-react";

/**
 * LiveTicker — Scores live intégrés dans le niveau 1 de la headbar.
 * Affiche 3 matchs live, rotation auto toutes les 8s.
 * Design compact, sport-specific colors.
 */

const SPORT_COLORS: Record<string, string> = {
  football: "text-emerald-400",
  tennis: "text-sky-400",
  basketball: "text-orange-400",
  hockey: "text-blue-400",
  rugby: "text-amber-400",
  mma: "text-red-400",
  f1: "text-red-500",
  baseball: "text-green-400",
  cs2: "text-purple-400",
};

function TickerItem({ match }: { match: TickerMatch }) {
  const color = SPORT_COLORS[match.sport] ?? "text-muted-foreground";

  return (
    <div className="flex items-center gap-1.5 text-xs whitespace-nowrap">
      {/* Live dot */}
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
      </span>

      {/* Score */}
      <span className={cn("font-semibold tabular-nums", color)}>
        {match.home} {match.score} {match.away}
      </span>

      {/* Sparkline odds */}
      {match.odds && match.odds.length >= 2 && (
        <Sparkline data={match.odds} width={36} height={12} />
      )}

      {/* Minute */}
      {match.minute && (
        <span className="text-[10px] text-muted-foreground">
          {match.minute}
        </span>
      )}
    </div>
  );
}

export function LiveTicker() {
  const { visible, total, page, totalPages, loading } = useLiveTicker();

  if (loading || total === 0) return null;

  return (
    <div className="hidden lg:flex items-center gap-3 overflow-hidden">
      <Zap className="h-3.5 w-3.5 shrink-0 text-emerald-500" />

      <div className="flex items-center gap-4 overflow-hidden">
        {visible.map((m) => (
          <TickerItem key={m.id} match={m} />
        ))}
      </div>

      {/* Pagination dots */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          {Array.from({ length: totalPages }, (_, i) => (
            <span
              key={i}
              className={cn(
                "h-1 w-1 rounded-full transition-colors",
                i === page ? "bg-emerald-500" : "bg-muted-foreground/30"
              )}
            />
          ))}
        </div>
      )}

      {/* Total live */}
      <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
        {total} live
      </span>
    </div>
  );
}
