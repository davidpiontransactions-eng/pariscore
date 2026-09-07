"use client";

import { useState } from "react";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

// ---------------------------------------------------------------------------
// Grille de paris prédictifs snooker — pre-match (handicap, O/U frames,
// century) & live (race to X, next frame, total frames, handicap in-play).
// Données : /api/v1/snooker/bets[?live=1] — filtre serveur prob ≥ 65 %.
// ---------------------------------------------------------------------------

type Bet = { type: string; label: string; prob: number };

type BetMatch = {
  matchId: string;
  bestOf: number;
  status: string;
  playerA: { name: string; elo: number };
  playerB: { name: string; elo: number };
  score: string;
  pWin: number;
  pFav: number;
  favourite: string;
  confidence: number;
  ev: number | null;
  bets: Bet[];
};

type BetsResponse = { mode: string; total: number; matches: BetMatch[] };

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<BetsResponse>);

function probColor(p: number): string {
  if (p >= 0.75) return "bg-emerald-500/15 text-emerald-400";
  if (p >= 0.65) return "bg-amber-500/15 text-amber-400";
  return "bg-zinc-800 text-zinc-400";
}

export function SnookerBetsPanel() {
  const [mode, setMode] = useState<"prematch" | "live">("prematch");
  const { data, isLoading } = useSWR(
    mode === "live" ? "/api/v1/snooker/bets?live=1" : "/api/v1/snooker/bets",
    fetcher,
    { refreshInterval: mode === "live" ? 60_000 : 300_000, revalidateOnFocus: true },
  );

  const matches = data?.matches ?? [];

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Paris prédictifs {mode === "live" && <span className="text-red-400">● LIVE</span>}
        </h3>
        <div className="flex rounded-lg border border-zinc-800 p-0.5 text-xs">
          {(["prematch", "live"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "rounded-md px-3 py-1 transition-colors",
                mode === m ? "bg-emerald-500/20 text-emerald-400" : "text-zinc-500 hover:text-zinc-300",
              )}
            >
              {m === "prematch" ? "Pre-match" : "Live"}
            </button>
          ))}
        </div>
      </div>

      {!data && !isLoading ? null : isLoading && !data ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : matches.length === 0 ? (
        <p className="text-sm text-muted-foreground/60">
          Aucun pari ≥ 65 % détecté {mode === "live" ? "sur les matchs en cours" : "au programme"}.
        </p>
      ) : (
        <div className="space-y-2">
          {matches.map((m) => (
            <div key={m.matchId} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {m.playerA.name} <span className="text-zinc-500">vs</span> {m.playerB.name}
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    Bo{m.bestOf}
                    {m.status === "live" && m.score !== "0-0" ? ` — ${m.score}` : ""} · Favori{" "}
                    <span className="text-emerald-400">{m.favourite}</span>{" "}
                    <span className="font-mono">{Math.round(m.pFav * 100)} %</span>
                  </div>
                </div>
                {m.ev != null && (
                  <span
                    className={cn(
                      "rounded-md px-2 py-0.5 font-mono text-[10px]",
                      m.ev > 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400",
                    )}
                    title="Expected Value vs cote marché"
                  >
                    EV {m.ev > 0 ? "+" : ""}
                    {(m.ev * 100).toFixed(1)} %
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {m.bets.length === 0 ? (
                  <span className="text-[11px] text-zinc-600">Aucun angle ≥ 65 % sur ce match.</span>
                ) : (
                  m.bets.map((b) => (
                    <span
                      key={`${b.type}-${b.label}`}
                      className={cn("rounded-md px-2 py-1 text-[11px] font-medium", probColor(b.prob))}
                    >
                      {b.label} · {Math.round(b.prob * 100)} %
                    </span>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}