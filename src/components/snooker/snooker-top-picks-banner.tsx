"use client";

import useSWR from "swr";
import { Skeleton } from "@/components/ui/skeleton";

// ---------------------------------------------------------------------------
// Bannière « Top 10 Daily Picks (≥ 65 %) » — carousel horizontal de cartes
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
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400">
          Top Picks du jour
        </h3>
        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
          {picks.length} pick{picks.length > 1 ? "s" : ""} ≥ 65 %
        </span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {picks.map((p) => (
          <div
            key={p.matchId}
            className="min-w-[230px] max-w-[230px] rounded-xl border border-zinc-800 bg-zinc-900/60 p-3"
          >
            <div className="mb-1 truncate text-[10px] uppercase tracking-wide text-zinc-500">
              {p.tournament || "Snooker"}
            </div>
            <div className="truncate text-sm font-semibold text-zinc-100">{p.pickName}</div>
            <div className="mb-2 truncate text-[10px] text-zinc-500">
              {p.player1.name} vs {p.player2.name}
            </div>
            {/* Jauge de certitude */}
            <div className="mb-1.5 h-1.5 rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${Math.round(p.prob * 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                {Math.round(p.prob * 100)} % — {confLabel(p.confidence)}
              </span>
              {p.odds != null && (
                <span className="font-mono text-[10px] text-amber-400">@{p.odds.toFixed(2)}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}