"use client";

import useSWR from "swr";
import { Skeleton } from "@/components/ui/skeleton";

// ---------------------------------------------------------------------------
// Bannière « Top 10 Daily Picks (≥ 58 %) » — carousel horizontal de cartes
// avec jauge de certitude, badge de confiance et cote recommandée.
// Données : /api/v1/snooker/predictions (modèle Elo CueTracker × FlashScore).
// ---------------------------------------------------------------------------

type Pick = {
  matchId: string;
  pickName: string;
  prob: number;
  odds?: number;
  edge?: number;
  confidence: number;
  tournament: string;
  player1: { name: string };
  player2: { name: string };
};

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<{ picks: Pick[] }>);

function confLabel(c: number): string {
  if (c >= 4) return "Confiance Élevée";
  if (c >= 3) return "Confiance Moyenne";
  return "Confiance Faible";
}

export function SnookerTopPicksBanner() {
  const { data, isLoading } = useSWR("/api/v1/snooker/predictions", fetcher, {
    refreshInterval: 300_000,
    revalidateOnFocus: true,
  });

  if (isLoading && !data) return <Skeleton className="h-28 w-full rounded-xl" />;
  const picks = data?.picks ?? [];
  if (picks.length === 0) return null; // pas de pick ≥ 65 % → bannière masquée

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400">
          Top Picks du jour
        </h3>
        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 ring-1 ring-emerald-500/30">
          {picks.length} pick{picks.length > 1 ? "s" : ""} ≥ 58 %
        </span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-none">
        {picks.map((p) => (
          <div
            key={p.matchId}
            className="group snap-start min-w-[240px] max-w-[240px] rounded-xl border border-zinc-800/60 bg-zinc-900/60 backdrop-blur-sm p-3.5 shrink-0 transition-all hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/10"
          >
            {/* Glass shine */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent opacity-0 group-hover:opacity-100 rounded-xl" />
            <div className="relative z-10">
              <div className="mb-1 flex items-center justify-between">
                <span className="truncate text-[10px] uppercase tracking-wider font-medium text-zinc-500">
                  {p.tournament || "Snooker"}
                </span>
                {p.odds != null && (
                  <span className="font-mono text-[10px] text-amber-400 font-semibold">@{p.odds.toFixed(2)}</span>
                )}
              </div>
              <div className="truncate text-sm font-semibold text-zinc-100">{p.pickName}</div>
              <div className="mb-2 truncate text-[10px] text-zinc-500">
                {p.player1.name} vs {p.player2.name}
              </div>
              {/* Jauge de certitude néon */}
              <div className="mb-1.5 h-2 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300 shadow-sm shadow-emerald-500/30"
                  style={{ width: `${Math.round(p.prob * 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400 ring-1 ring-emerald-500/30">
                  {Math.round(p.prob * 100)} % — {confLabel(p.confidence)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}