"use client";

import useSWR from "swr";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { PlayerAvatar } from "@/components/ui/player-avatar";

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

type PickBet = { type: string; label: string; prob: number };

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
  scheduledAt?: string;
  player1PhotoUrl?: string;
  player2PhotoUrl?: string;
  bets: PickBet[];
};

type PicksResponse = {
  picks: TopPick[];
  total: number;
  minProb: number;
  generated_at: string | null;
  message?: string;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<PicksResponse>);

// ─── Format date/heure FR ──────────────────────────────────────────────────
function formatDateTimeFr(iso?: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("fr-FR", {
      weekday: "short", day: "numeric", month: "short",
      hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris",
    }).format(d);
  } catch { return ""; }
}

function probColor(p: number): string {
  if (p >= 0.70) return "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20";
  if (p >= 0.58) return "bg-amber-500/10 text-amber-400 ring-amber-500/20";
  return "bg-zinc-800/60 text-zinc-400 ring-zinc-700";
}

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
        <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400">
          🎯 Top Picks — Modèle prédictif
          <span className="ml-2 text-xs font-normal text-zinc-500">
            probabilité ≥ {Math.round((data?.minProb ?? 0.58) * 100)} %
          </span>
        </h3>
        {picks.length > 0 && (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-400 ring-1 ring-emerald-500/30">
            {picks.length} picks
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-muted-foreground">
          Erreur de chargement des picks prédictifs
        </div>
      ) : picks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 p-6 text-center">
          <p className="text-sm text-zinc-500/70">
            Aucun pick ≥ {Math.round((data?.minProb ?? 0.58) * 100)} % actuellement — le modèle attend des
            confrontations plus asymétriques.
          </p>
          {data?.message && <p className="mt-1 text-[11px] text-zinc-500/50">{data.message}</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {picks.map((pick, i) => {
            const isPickA = pick.pickSide === "A";
            const dt = formatDateTimeFr(pick.scheduledAt);
            return (
              <div
                key={pick.matchId}
                className="rounded-lg border border-zinc-800/60 bg-zinc-900/40 px-3 py-3 transition-all hover:border-emerald-500/30 hover:shadow-sm hover:shadow-emerald-500/10"
              >
                {/* Row 1: rank + players + date + prob */}
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-zinc-600 shrink-0 w-5">{i + 1}</span>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <PlayerAvatar name={pick.player1.name} photoUrl={pick.player1PhotoUrl} size="sm" sport="snooker" />
                    <span className="text-[10px] text-zinc-600">vs</span>
                    <PlayerAvatar name={pick.player2.name} photoUrl={pick.player2PhotoUrl} size="sm" sport="snooker" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 text-sm">
                      <span className={cn("truncate max-w-[100px]", isPickA ? "font-semibold text-emerald-400" : "text-zinc-300")}>
                        {pick.player1.name}
                      </span>
                      <span className="text-[10px] text-zinc-600">vs</span>
                      <span className={cn("truncate max-w-[100px]", !isPickA ? "font-semibold text-emerald-400" : "text-zinc-300")}>
                        {pick.player2.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-600">
                      <span>Elo {pick.player1.eloRating}/{pick.player2.eloRating}</span>
                      <ConfidenceDots value={pick.confidence} />
                    </div>
                  </div>

                  {dt && (
                    <span className="hidden sm:block text-[10px] font-mono text-zinc-400 shrink-0 min-w-[100px] text-right">
                      {dt}
                    </span>
                  )}

                  <div className="shrink-0 text-right">
                    <span className="font-mono text-sm font-semibold text-emerald-400">
                      {(pick.prob * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Row 2: 3 bet chips */}
                <div className="flex flex-wrap gap-1.5 mt-2 ml-7">
                  <span className="rounded-md px-2 py-0.5 text-[10px] font-medium ring-1 bg-emerald-500/10 text-emerald-400 ring-emerald-500/20">
                    🏆 {pick.pickName} — {(pick.prob * 100).toFixed(1)}%
                  </span>
                  {pick.bets.map((b) => (
                    <span key={b.type} className={cn("rounded-md px-2 py-0.5 text-[10px] font-medium ring-1", probColor(b.prob))}>
                      {b.label} · {Math.round(b.prob * 100)}%
                    </span>
                  ))}
                </div>
              </div>
            );
          })}

          <p className="pt-1 text-[10px] text-zinc-600">
            Modèle v1 : Elo dérivé des stats carrière CueTracker (rétrécies), logistique standard. 3 paris suggestifs
            calculés par heuristique (handicap, total frames, century). Ne constitue pas un conseil financier.
          </p>
        </div>
      )}
    </section>
  );
}