"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { Skeleton } from "@/components/ui/skeleton";
import { LiquidGlass } from "@/components/ui/liquid-glass";
import { SnookerCalendar } from "@/components/snooker/snooker-calendar";
import { SnookerMatchCard } from "@/components/snooker/snooker-match-card";
import { SnookerLiveTracker } from "@/components/snooker/snooker-live-tracker";
import { SnookerPlayerCard } from "@/components/snooker/snooker-player-card";
import { SnookerTopPicks } from "@/components/snooker/snooker-top-picks";
import { SnookerTopPicksBanner } from "@/components/snooker/snooker-top-picks-banner";
import { SnookerBetsPanel } from "@/components/snooker/snooker-bets-panel";

// ---------------------------------------------------------------------------
// Types consommés par les composants (miroir des réponses API)
// ---------------------------------------------------------------------------

type ApiMatch = {
  id: string;
  tournament: string;
  player1: string;
  player2: string;
  player1PhotoUrl?: string;
  player2PhotoUrl?: string;
  scheduled_at: string | null;
  status: "scheduled" | "live" | "finished";
  scoreA: number;
  scoreB: number;
  bestOf: number;
  odds?: { player1: number; player2: number };
};

type MatchesResponse = {
  matches: ApiMatch[];
  total: number;
  scraped_at: string | null;
};

type ApiPlayer = {
  id: string;
  name: string;
  nationality?: string;
  ranking?: number;
  eloRating: number;
  winPct?: number;
  centuryRate?: number;
  deciderWinPct?: number;
  avgBreak?: number;
  photoUrl?: string;
};

type PlayersResponse = {
  players: ApiPlayer[];
  total: number;
  scraped_at: string | null;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ---------------------------------------------------------------------------
// Onglet Snooker
// ---------------------------------------------------------------------------

export function SnookerTabContent() {
  const matchesRes = useSWR<MatchesResponse>(
    "/api/v1/snooker/matches",
    fetcher,
    { refreshInterval: 300_000, revalidateOnFocus: true },
  );
  const playersRes = useSWR<PlayersResponse>(
    "/api/v1/snooker/players",
    fetcher,
    { refreshInterval: 600_000, revalidateOnFocus: true },
  );

  const matches = useMemo(() => matchesRes.data?.matches ?? [], [matchesRes.data]);
  const players = useMemo(() => playersRes.data?.players ?? [], [playersRes.data]);

  // Tri : live d'abord, puis programmés, puis terminés ; par heure.
  const sorted = useMemo(() => {
    const order: Record<ApiMatch["status"], number> = { live: 0, scheduled: 1, finished: 2 };
    return [...matches].sort((a, b) => {
      const o = order[a.status] - order[b.status];
      if (o !== 0) return o;
      const ta = a.scheduled_at ?? "";
      const tb = b.scheduled_at ?? "";
      return ta.localeCompare(tb);
    });
  }, [matches]);

  const liveMatches = useMemo(() => matches.filter((m) => m.status === "live"), [matches]);

  return (
    <div className="space-y-6">
      {/* Hero avec bannière carousel */}
      <div className="relative overflow-hidden rounded-2xl border border-zinc-800/60 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(0,230,118,0.08)_0%,_transparent_60%)]" />
        <div className="relative z-10">
          <SnookerTopPicksBanner />
        </div>
      </div>

      <LiquidGlass tier="tier2" className="rounded-xl border border-zinc-800/50 p-4">
        <SnookerTopPicks />
      </LiquidGlass>

      <LiquidGlass tier="tier2" className="rounded-xl border border-zinc-800/50 p-4">
        <SnookerBetsPanel />
      </LiquidGlass>

      <LiquidGlass tier="tier2" className="rounded-xl border border-zinc-800/50 p-4">
        <SnookerCalendar />
      </LiquidGlass>

      {/* Cartes matchs */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Matchs — {matchesRes.data?.total ?? 0}
        </h3>
        {!matchesRes.data && !matchesRes.error ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <LiquidGlass tier="tier2" className="rounded-xl border border-dashed border-zinc-800 p-6 text-center">
            <p className="text-sm text-muted-foreground/60">
              Aucun match snooker actuellement — relancez le scraper FlashScore.
            </p>
          </LiquidGlass>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sorted.map((m) => (
              <SnookerMatchCard
                key={m.id}
                match={{
                  id: m.id,
                  playerA: { id: `p-a-${m.id}`, name: m.player1, photoUrl: m.player1PhotoUrl },
                  playerB: { id: `p-b-${m.id}`, name: m.player2, photoUrl: m.player2PhotoUrl },
                  tournament: m.tournament || "Snooker",
                  bestOf: m.bestOf,
                  scoreA: m.scoreA,
                  scoreB: m.scoreB,
                  status: m.status,
                  scheduledAt: m.scheduled_at ?? undefined,
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* Tracker live frame par frame */}
      {liveMatches.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400">
            En direct
          </h3>
          <div className="space-y-4">
            {liveMatches.map((m) => {
              const frames: Array<{
                frameNumber: number;
                winner: "A" | "B";
                scoreA: number;
                scoreB: number;
              }> = [];
              let fa = 0;
              let fb = 0;
              for (let i = 0; i < m.scoreA; i++) {
                fa++;
                frames.push({ frameNumber: frames.length + 1, winner: "A", scoreA: fa, scoreB: fb });
              }
              for (let i = 0; i < m.scoreB; i++) {
                fb++;
                frames.push({ frameNumber: frames.length + 1, winner: "B", scoreA: fa, scoreB: fb });
              }
              return (
                <LiquidGlass key={m.id} tier="tier2" className="rounded-xl border border-zinc-800/50 p-4">
                  <SnookerLiveTracker
                    frames={frames}
                    bestOf={m.bestOf}
                    playerAName={m.player1}
                    playerBName={m.player2}
                    isLive
                  />
                </LiquidGlass>
              );
            })}
          </div>
        </section>
      )}

      {/* Leaderboard joueurs */}
      {players.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Top joueurs — {players.length}
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {players.map((p) => (
              <SnookerPlayerCard
                key={p.id}
                player={{
                  id: p.id,
                  name: p.name,
                  nationality: p.nationality,
                  ranking: p.ranking,
                  eloRating: p.eloRating,
                  winPct: p.winPct,
                  centuryRate: p.centuryRate,
                  deciderWinPct: p.deciderWinPct,
                  avgBreak: p.avgBreak,
                  photoUrl: p.photoUrl,
                }}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}