"use client";

/**
 * BasketballLive — sous-onglet « Live » : matchs basketball en cours, triés par
 * compétition puis par écart de score, rafraîchissement automatique (les hooks
 * parents refetchent déjà toutes les 30-60 s : on ne refait pas de fetch, on
 * filtre le flux unifié matchs NBA/WNBA ESPN + EuroLeague/EuroCup api-live).
 * Charte FotMob light + badge pulsé.
 */

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { UnifiedMatch } from "./basketball-tab-content";

function pulsingDot() {
  return (
    <span className="relative inline-flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
    </span>
  );
}

function Clock({ scheduledAt }: { scheduledAt: string }) {
  const [, hh, mm] = scheduledAt.match(/T(\d{2}):(\d{2})/) ?? [];
  return <span className="tabular-nums text-[#717171]">{hh && mm ? `${hh}:${mm}` : "—"}</span>;
}

export function BasketballLive({
  matches,
  isLoading,
  className,
}: {
  matches: UnifiedMatch[];
  isLoading?: boolean;
  className?: string;
}) {
  const [onlyClose, setOnlyClose] = useState(false);

  const live = useMemo(() => {
    const rows = matches
      .filter((m) => m.status === "in-progress")
      .sort((a, b) => {
        const lg = a.league.localeCompare(b.league);
        if (lg !== 0) return lg;
        const gapA = Math.abs((a.home.score ?? 0) - (a.away.score ?? 0));
        const gapB = Math.abs((b.home.score ?? 0) - (b.away.score ?? 0));
        return gapA - gapB; // matchs serrés en premier
      });
    if (!onlyClose) return rows;
    return rows.filter((m) => Math.abs((m.home.score ?? 0) - (m.away.score ?? 0)) <= 10);
  }, [matches, onlyClose]);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#222]">
          {pulsingDot()} Live {live.length > 0 && <span className="text-[#717171]">({live.length})</span>}
        </div>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-[#717171]">
          <input
            type="checkbox"
            checked={onlyClose}
            onChange={(e) => setOnlyClose(e.target.checked)}
            className="h-3.5 w-3.5 accent-[#00985f]"
          />
          Matchs serrés (≤ 10 pts)
        </label>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-2" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-black/[0.05]" />
          ))}
        </div>
      )}

      {!isLoading && live.length === 0 && (
        <div className="rounded-xl border border-black/5 bg-white p-10 text-center">
          <div className="text-3xl">🏀</div>
          <p className="mt-2 text-sm font-medium text-[#222]">Aucun match en direct</p>
          <p className="mt-1 text-xs text-[#717171]">
            Les matchs en cours apparaissent ici automatiquement (ESPN + EuroLeague).
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {live.map((m) => {
          const hs = m.home.score ?? 0;
          const as = m.away.score ?? 0;
          const leader = hs === as ? null : hs > as ? "home" : "away";
          return (
            <div
              key={m.id}
              className="rounded-xl border border-black/5 bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
            >
              <div className="mb-2 flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5 font-medium text-[#00985f]">
                  {pulsingDot()} {m.league}
                </span>
                <Clock scheduledAt={m.scheduledAt} />
              </div>
              <div className="flex items-center justify-between gap-2">
                {([["home", m.home], ["away", m.away]] as const).map(([side, t]) => (
                  <div key={side} className="flex min-w-0 flex-1 items-center gap-2">
                    {side === "away" && <span className="hidden text-[10px] text-[#717171] sm:inline">vs</span>}
                    <span
                      className={cn(
                        "truncate text-sm",
                        leader === side ? "font-bold text-[#222]" : "font-medium text-[#545454]",
                      )}
                    >
                      {t.name}
                    </span>
                    <span
                      className={cn(
                        "ml-auto text-lg tabular-nums",
                        leader === side ? "font-bold text-[#222]" : "text-[#717171]",
                      )}
                    >
                      {t.score ?? 0}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
