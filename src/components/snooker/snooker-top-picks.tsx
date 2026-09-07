"use client";

import useSWR from "swr";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

// ---------------------------------------------------------------------------
// Types (miroir de /api/v1/snooker/predictions)
// ---------------------------------------------------------------------------

type PickPlayer = {
  name: string;
  eloRating: number;
  ranking?: number;
  winPct?: number;
  matchesPlayed: number;
};

type TopPick = {
  matchId: string;
  tournament: string;
  player1: PickPlayer;
  player2: PickPlayer;
  pickSide: "A" | "B";
  pickName: string;
  prob: number;
  probA: number;
  probB: number;
  odds?: number;
  edge?: number;
  kelly?: number;
  confidence: number;
};

type PicksResponse = {
  picks: TopPick[];
  total: number;
  minProb: number;
  generated_at: string | null;
  message?: string;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<PicksResponse>);

/** Grille partagée en-tête / lignes (mobile : 3 colonnes, desktop : 7). */
const GRID =
  "grid grid-cols-[28px_1fr_auto] md:grid-cols-[28px_minmax(0,1fr)_110px_84px_64px_72px_64px] gap-2 items-center";

function ConfidenceDots({ value }: { value: number }) {
  return (
    <span className="font-mono text-[10px] tracking-tight text-amber-400/80" title={`Confiance ${value}/5`}>
      {"●".repeat(value)}
      <span className="text-zinc-700">{"●".repeat(5 - value)}</span>
    </span>
  );
}

/**
 * Composant — Top-10 picks prédictifs (prob >= 65 %) sur les matchs snooker à venir.
 * Données : /api/v1/snooker/predictions (croisement FlashScore × CueTracker).
 */
export function SnookerTopPicks({ className }: { className?: string }) {
  const { data, isLoading, error } = useSWR<PicksResponse>(
    "/api/v1/snooker/predictions",
    fetcher,
    { refreshInterval: 600_000, revalidateOnFocus: true },
  );

  const picks = data?.picks ?? [];

  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          🎯 Top Picks — Modèle prédictif
          <span className="ml-2 text-xs font-normal text-muted-foreground/60">
            probabilité ≥ {Math.round((data?.minProb ?? 0.65) * 100)} %
          </span>
        </h3>
        {picks.length > 0 && (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-400">
            {picks.length} picks
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Erreur de chargement des picks prédictifs
        </div>
      ) : picks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <p className="text-sm text-muted-foreground/70">
            Aucun pick ≥ {Math.round((data?.minProb ?? 0.65) * 100)} % actuellement — le modèle attend des
            confrontations plus asymétriques.
          </p>
          {data?.message && <p className="mt-1 text-[11px] text-muted-foreground/50">{data.message}</p>}
        </div>
      ) : (
        <div className="space-y-1.5">
          {/* En-tête (desktop uniquement) */}
          <div className={cn(GRID, "hidden md:grid px-3 pb-1 text-[10px] uppercase tracking-wider text-zinc-500")}>
            <span>#</span>
            <span>Match</span>
            <span>Tournoi</span>
            <span>Modèle</span>
            <span className="text-right">Cote</span>
            <span className="text-right">Edge</span>
            <span className="text-right">Kelly</span>
          </div>

          {picks.map((pick, i) => {
            const isPickA = pick.pickSide === "A";
            return (
              <div
                key={pick.matchId}
                className={cn(
                  GRID,
                  "rounded-lg border border-zinc-800/60 bg-zinc-900/40 px-3 py-2.5 transition-colors hover:border-emerald-500/30",
                )}
              >
                <span className="font-mono text-xs text-zinc-600">{i + 1}</span>

                {/* Match — favori en vert */}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className={cn("truncate", isPickA ? "font-semibold text-emerald-400" : "text-zinc-300")}>
                      {pick.player1.name}
                    </span>
                    <span className="text-[10px] text-zinc-600">vs</span>
                    <span className={cn("truncate", !isPickA ? "font-semibold text-emerald-400" : "text-zinc-300")}>
                      {pick.player2.name}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] text-zinc-600">
                    <span>
                      Elo {pick.player1.eloRating} / {pick.player2.eloRating}
                    </span>
                    {pick.player1.ranking != null && pick.player2.ranking != null && (
                      <span>
                        #{pick.player1.ranking} vs #{pick.player2.ranking}
                      </span>
                    )}
                    <ConfidenceDots value={pick.confidence} />
                  </div>
                </div>

                {/* Tournoi (desktop) */}
                <span className="hidden md:block truncate text-[11px] text-zinc-500" title={pick.tournament}>
                  {pick.tournament}
                </span>

                {/* Probabilité modèle */}
                <div className="text-right md:text-left">
                  <span className="font-mono text-sm font-semibold text-emerald-400">
                    {(pick.prob * 100).toFixed(1)}%
                  </span>
                </div>

                {/* Cote du pick */}
                <span className="hidden md:block text-right font-mono text-xs text-zinc-400">
                  {pick.odds != null ? pick.odds.toFixed(2) : "—"}
                </span>

                {/* Edge vs marché */}
                <span
                  className={cn(
                    "hidden md:block text-right font-mono text-xs",
                    pick.edge == null ? "text-zinc-600" : pick.edge > 0 ? "text-emerald-400" : "text-rose-400",
                  )}
                >
                  {pick.edge != null ? `${pick.edge > 0 ? "+" : ""}${(pick.edge * 100).toFixed(1)}%` : "—"}
                </span>

                {/* Kelly */}
                <span className="hidden md:block text-right font-mono text-xs text-blue-400/80">
                  {pick.kelly != null && pick.kelly > 0 ? `${(pick.kelly * 100).toFixed(1)}%` : "—"}
                </span>
              </div>
            );
          })}

          <p className="pt-1 text-[10px] text-zinc-600">
            Modèle v1 : Elo dérivé des stats carrière CueTracker (rétrécies), logistique standard. Kelly = fraction
            de bankroll. Ne constitue pas un conseil financier.
          </p>
        </div>
      )}
    </section>
  );
}