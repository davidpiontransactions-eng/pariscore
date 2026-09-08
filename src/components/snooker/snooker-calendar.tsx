"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { WatchButton } from "@/components/shared/watch-button";
import { PlayerAvatar } from "@/components/ui/player-avatar";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SnookerMatch = {
  id: string;
  tournament: string;
  player1: string;
  player2: string;
  player1PhotoUrl?: string;
  player2PhotoUrl?: string;
  scheduled_at: string | null;
  status: string | null;
  scoreA?: number;
  scoreB?: number;
  odds?: { player1: number; player2: number };
};

type SnookerApiResponse = {
  matches: SnookerMatch[];
  total: number;
  scraped_at: string | null;
  tournaments: string[];
  with_odds: number;
  message?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<SnookerApiResponse>);

function formatTime(iso: string | null): string {
  if (!iso) return "??:??";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "??:??";
    return new Intl.DateTimeFormat("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Paris",
    }).format(d);
  } catch {
    return "??:??";
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "short",
      timeZone: "Europe/Paris",
    }).format(d);
  } catch {
    return "";
  }
}

function isLive(match: SnookerMatch): boolean {
  const s = (match.status ?? "").toLowerCase();
  return s.includes("live") || s.includes("in_play") || s.includes("1st") || s.includes("2nd") || s.includes("frame");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SnookerCalendar({ className }: { className?: string }) {
  const [tournamentFilter, setTournamentFilter] = useState<string>("all");

  const { data, isLoading, error } = useSWR<SnookerApiResponse>(
    "/api/v1/snooker/matches",
    fetcher,
    { refreshInterval: 300_000, revalidateOnFocus: true },
  );

  const tournaments = useMemo(() => {
    if (!data?.tournaments) return [];
    return data.tournaments;
  }, [data?.tournaments]);

  const matches = useMemo(() => {
    if (!data?.matches) return [];
    let list = data.matches;
    if (tournamentFilter !== "all") {
      list = list.filter((m) => m.tournament === tournamentFilter);
    }
    return list;
  }, [data?.matches, tournamentFilter]);

  const liveCount = useMemo(
    () => (data?.matches ?? []).filter(isLive).length,
    [data?.matches],
  );

  if (isLoading) {
    return (
      <section className={cn("space-y-3", className)}>
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Snooker — Calendrier
        </h3>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className={cn("space-y-3", className)}>
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Snooker — Calendrier
        </h3>
        <div className="rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500">
          Erreur de chargement des données snooker
        </div>
      </section>
    );
  }

  if (!data) {
    return (
      <section className={cn("space-y-3", className)}>
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Snooker — Calendrier
        </h3>
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          <div className="text-[12px] text-emerald-400 mb-2">📡 Données en cours de chargement...</div>
          <p className="text-xs text-zinc-500">
            {"Aucun match snooker disponible — lancez le scraper : node scripts/scrape_flashscore_snooker.mjs"}
          </p>
          <div className="mt-3">
            <a
              href="https://github.com/davidpiontransactions-eng/pariscore/tree/main/scripts"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-emerald-400/60 hover:text-emerald-400 text-[10px]"
            >
              Scripts de scraping
            </a>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Snooker — Calendrier
          <span className="ml-2 text-xs font-normal text-muted-foreground/60">
            {data.with_odds} matchs avec cotes
          </span>
        </h3>
        {liveCount > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-bold text-rose-400">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-rose-500 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-500" />
            </span>
            {liveCount} LIVE
          </span>
        )}
      </div>

      {/* Filtres tournois */}
      {tournaments.length > 1 && (
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setTournamentFilter("all")}
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap",
              tournamentFilter === "all"
                ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            Tous ({data.matches.length})
          </button>
          {tournaments.map((t) => {
            const count = data.matches.filter((m) => m.tournament === t).length;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTournamentFilter(t)}
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap",
                  tournamentFilter === t
                    ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {t} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Tableau des matchs */}
      <div className="overflow-x-auto rounded-xl border border-zinc-800/60 bg-zinc-900/40 backdrop-blur-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800/40 bg-zinc-900/60 text-left text-[11px] uppercase tracking-wider text-zinc-500">
              <th className="px-3 py-2.5 font-medium">Heure</th>
              <th className="px-3 py-2.5 font-medium">Tournoi</th>
              <th className="px-3 py-2.5 font-medium">Joueurs</th>
              <th className="px-3 py-2.5 font-medium text-center">Cotes 1X2</th>
              <th className="px-3 py-2.5 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {matches.map((m) => {
              const live = isLive(m);
              return (
                <tr
                  key={m.id}
                  data-match-id={m.id}
                  className={cn(
                    "transition-all hover:bg-slate-800/50",
                    live && "bg-rose-500/5 hover:bg-rose-500/10",
                  )}
                >
                  <td className="px-3 py-2.5 font-mono text-xs tabular-nums whitespace-nowrap text-slate-400">
                    {live ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full scale-150 animate-pulse-soft rounded-full bg-rose-500 opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
                        </span>
                        <span className="text-[11px] font-bold uppercase text-rose-500">LIVE</span>
                      </span>
                    ) : (
                      <>
                        <span>{formatTime(m.scheduled_at)}</span>
                        {m.scheduled_at && (
                          <span className="ml-1 text-[10px] text-slate-500">{formatDate(m.scheduled_at)}</span>
                        )}
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-400">
                    {m.tournament}
                  </td>
                  <td className="px-3 py-2.5 min-w-[220px]">
                    <div className="flex items-center gap-2">
                      <PlayerAvatar name={m.player1} photoUrl={m.player1PhotoUrl} size="sm" sport="snooker" />
                      <div>
                        <div className="font-medium text-slate-100 text-sm">{m.player1}</div>
                        <div className="text-xs text-slate-400 flex items-center gap-1">
                          <span>vs</span>
                          <span>{m.player2}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {m.odds ? (
                      <div className="inline-flex items-center gap-1.5">
                        <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/20">
                          {m.odds.player1.toFixed(2)}
                        </span>
                        <span className="text-muted-foreground/40">/</span>
                        <span className="rounded bg-sky-500/10 px-1.5 py-0.5 font-mono text-xs font-semibold text-sky-300 ring-1 ring-sky-500/20">
                          {m.odds.player2.toFixed(2)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground/40">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <WatchButton
                      sport="snooker"
                      home={m.player1}
                      away={m.player2}
                      label="Stream"
                      variant="dark"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer : source + dernière MAJ */}
      <div className="flex items-center justify-between text-[11px] text-zinc-500/50">
        <span>Données source: FlashScore (odds à venir) {data.scraped_at ? `· ${new Date(data.scraped_at).toLocaleString("fr-FR")}` : ""}</span>
        <span>{data.total} matchs au total</span>
      </div>
    </section>
  );
}
