"use client";

import { cn } from "@/lib/utils";
import type { GroupStats } from "@/lib/bet-manager/types";

const fmt = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

/** Liste de groupes (sport/bookmaker/type/mois/plage de cote) avec barres de proportion. */
export function BreakdownList({
  title,
  groups,
  showOdds = false,
}: {
  title: string;
  groups: GroupStats[];
  showOdds?: boolean;
}) {
  const top = groups.slice(0, 8);
  const maxProfit = Math.max(...top.map((g) => Math.abs(g.profit)), 1);

  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">{title}</h3>
      {top.length === 0 ? (
        <p className="py-6 text-center text-xs text-zinc-600">Aucun pari réglé pour l'instant.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {top.map((g) => {
            const width = Math.max(4, (Math.abs(g.profit) / maxProfit) * 100);
            return (
              <li key={g.key} className="group">
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="flex items-baseline gap-1.5 truncate text-xs text-zinc-300">
                    <span className="truncate">{g.label}</span>
                    <span className="shrink-0 font-mono text-[10px] text-zinc-600">
                      {g.won}/{g.settled} · {fmt(g.staked)} €
                    </span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 font-mono text-xs font-semibold",
                      g.profit > 0 ? "text-emerald-400" : g.profit < 0 ? "text-red-400" : "text-zinc-500"
                    )}
                  >
                    {g.profit > 0 ? "+" : ""}
                    {fmt(g.profit)} €
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      g.profit > 0 ? "bg-emerald-500/70" : g.profit < 0 ? "bg-red-500/70" : "bg-zinc-600"
                    )}
                    style={{ width: `${width}%` }}
                  />
                </div>
                <div className="mt-0.5 text-right font-mono text-[10px] text-zinc-600">
                  ROI {g.roi >= 0 ? "+" : ""}
                  {g.roi.toFixed(2)}%{showOdds ? " · WR " + g.winRate.toFixed(0) + "%" : ""}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}