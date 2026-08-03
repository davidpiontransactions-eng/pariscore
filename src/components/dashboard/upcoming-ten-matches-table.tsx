"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { usePrematchMatches } from "@/hooks/use-prematch-matches";
import { useFootballMatches } from "@/hooks/use-football-matches";
import { Skeleton } from "@/components/ui/skeleton";
import type { TennisMatch } from "@/lib/tennis-data";
import type { FootballMatch } from "@/lib/football-data";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type UpcomingMatch = {
  id: string;
  sport: "tennis" | "football";
  scheduledAt: string;
  matchName: string;
  oddsInfo: string;
  eloGap: number | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatHour(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatOddsTennis(m: TennisMatch): string {
  if (!m.odds) return "—";
  return `${m.odds.decimalA} / ${m.odds.decimalB}`;
}

function formatOddsFootball(m: FootballMatch): string {
  if (!m.odds) return "—";
  return `${m.odds.home} / ${m.odds.draw} / ${m.odds.away}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UpcomingTenMatchesTable({ className, id }: { className?: string; id?: string }) {
  const { data: tennisData, isLoading: tennisLoading } = usePrematchMatches();
  const { data: footData, isLoading: footLoading } = useFootballMatches();

  const upcoming = useMemo<UpcomingMatch[]>(() => {
    const now = Date.now();
    const items: UpcomingMatch[] = [];

    // Tennis : filtrer les matchs futurs
    for (const m of tennisData?.matches ?? []) {
      const t = new Date(m.scheduledAt).getTime();
      if (t < now) continue;
      items.push({
        id: m.id,
        sport: "tennis",
        scheduledAt: m.scheduledAt,
        matchName: `${m.playerA.shortName} vs ${m.playerB.shortName}`,
        oddsInfo: formatOddsTennis(m),
        eloGap: Math.abs(m.playerA.elo - m.playerB.elo),
      });
    }

    // Football : filtrer les matchs futurs (non-live, non-terminés)
    for (const m of footData?.matches ?? []) {
      const t = new Date(m.scheduledAt).getTime();
      if (t < now) continue;
      if (m.live) continue; // exclure les matchs en direct
      items.push({
        id: m.id,
        sport: "football",
        scheduledAt: m.scheduledAt,
        matchName: `${m.home.shortName} vs ${m.away.shortName}`,
        oddsInfo: formatOddsFootball(m),
        eloGap: null,
      });
    }

    return items
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
      .slice(0, 10);
  }, [tennisData?.matches, footData?.matches]);

  const isLoading = tennisLoading || footLoading;

  return (
    <section id={id} className={cn("space-y-3", className)}>
      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
        ⏱️ 10 PROCHAINS MATCHS
      </h3>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : upcoming.length === 0 ? (
        <div className="flex items-center justify-center rounded-xl border border-dashed border-border p-8 text-sm text-muted-foreground">
          Aucun match à venir pour le moment
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-muted/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2.5 font-medium">Heure</th>
                <th className="px-3 py-2.5 font-medium">Sport</th>
                <th className="px-3 py-2.5 font-medium">Rencontre</th>
                <th className="px-3 py-2.5 font-medium">Cotes</th>
                <th className="px-3 py-2.5 font-medium text-right">ΔElo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {upcoming.map((m) => (
                <tr
                  key={`${m.sport}-${m.id}`}
                  className="transition-colors hover:bg-emerald-500/5"
                >
                  <td className="px-3 py-2.5 font-mono text-xs tabular-nums whitespace-nowrap">
                    {formatHour(m.scheduledAt)}
                  </td>
                  <td className="px-3 py-2.5 text-lg">{m.sport === "tennis" ? "🎾" : "⚽"}</td>
                  <td className="px-3 py-2.5 max-w-[200px] truncate font-medium">
                    {m.matchName}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {m.oddsInfo}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums">
                    {m.eloGap != null ? (
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          m.eloGap >= 150
                            ? "bg-emerald-500/15 text-emerald-400"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {m.eloGap}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
