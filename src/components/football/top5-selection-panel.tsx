"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StrategyMatchEntry, Side } from "@/lib/football-strategy-top5";
import { STRATEGIES } from "@/components/football/football-strategy-top5-widget";
import { useTop5SelectionStore } from "@/stores/use-top5-selection-store";

function formatKickoff(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function SideLine({
  entry,
  side,
}: {
  entry: StrategyMatchEntry;
  side: Side;
}) {
  const team = entry[side];
  const isPick = entry.pick === side;
  return (
    <span
      className={cn(
        "flex min-w-0 items-center gap-1 truncate text-[11px] font-medium",
        isPick ? "text-emerald-300" : "text-slate-300",
      )}
    >
      {isPick && (
        <span aria-hidden className="shrink-0 text-[9px]">
          ●
        </span>
      )}
      <span className="truncate">{team.shortName}</span>
    </span>
  );
}

/**
 * Panneau des matchs sélectionnés dans le Top5 — cards affichées à droite de
 * la page (rail sticky desktop ; bloc inline sous le contenu sur mobile).
 * Rend null quand la sélection est vide.
 */
export function Top5SelectionPanel({
  variant = "rail",
}: {
  variant?: "rail" | "inline";
}) {
  const items = useTop5SelectionStore((s) => s.items);
  const remove = useTop5SelectionStore((s) => s.remove);
  const clearAll = useTop5SelectionStore((s) => s.clearAll);

  const list = Object.entries(items);
  if (list.length === 0) return null;

  return (
    <div
      className={cn(
        variant === "rail"
          ? "flex w-full flex-col gap-2 p-2"
          : "mx-auto max-w-6xl w-full px-4 pb-4 sm:px-6",
      )}
    >
      {variant === "inline" && (
        <h2 className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">
          Sélection Top 5 ({list.length})
        </h2>
      )}
      {variant === "rail" && (
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
            Sélection ({list.length})
          </h3>
          <button
            type="button"
            onClick={clearAll}
            className="rounded px-1 text-[9px] font-semibold text-slate-400 transition-colors hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Tout effacer
          </button>
        </div>
      )}

      <ul className={cn("space-y-1.5", variant === "inline" && "grid gap-2 sm:grid-cols-2 lg:grid-cols-3")}>
        {list.map(([matchId, sel]) => {
          // Définition FIGÉE à la sélection — jamais la stratégie active courante.
          const selDef =
            STRATEGIES.find((s) => s.key === sel.strategy) ?? STRATEGIES[0];
          const entry = sel.entry;
          const probPct = selDef.isProb ? Math.round(entry.value) : null;
          return (
            <li
              key={matchId}
              className="relative rounded-lg border border-slate-700/60 bg-slate-900/80 p-2 pr-7 shadow-sm"
            >
              <button
                type="button"
                onClick={() => remove(matchId)}
                aria-label={`Retirer ${entry.home.shortName} contre ${entry.away.shortName} de la sélection`}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>

              <div className="flex items-center gap-1 pr-5 text-[8.5px] text-slate-500">
                <span className="font-mono tabular-nums">{formatKickoff(entry.kickoff)}</span>
                <span aria-hidden>·</span>
                <span className="truncate">
                  <span aria-hidden>{selDef.emoji}</span> {selDef.label}
                </span>
              </div>

              <div className="mt-1 flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <SideLine entry={entry} side="home" />
                  <SideLine entry={entry} side="away" />
                </div>
                <div className="shrink-0 text-right">
                  <span className="block rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums text-emerald-300">
                    {selDef.format(entry.value)}
                  </span>
                  {probPct != null && (
                    <span className="mt-0.5 block text-[8.5px] font-medium tabular-nums text-emerald-400">
                      P {probPct}%
                    </span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {variant === "inline" && (
        <button
          type="button"
          onClick={clearAll}
          className="self-start rounded px-1 text-[10px] font-semibold text-slate-400 transition-colors hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Tout effacer
        </button>
      )}
    </div>
  );
}
