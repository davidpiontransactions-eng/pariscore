"use client";

import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Crosshair,
  RefreshCw,
  AlertCircle,
  Swords,
  Map,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──
type Cs2Team = {
  name: string;
  logo?: string;
  rank?: number;
};

type Cs2MapOdds = {
  map: string;
  prob_team1: number;
  prob_team2: number;
};

type Cs2Match = {
  id: string;
  team1: Cs2Team;
  team2: Cs2Team;
  event?: string;
  format?: string;
  commence_time?: string;
  maps?: Cs2MapOdds[];
  bsd_team1_id?: string;
  bsd_team2_id?: string;
};

type ApiResponse = {
  matches: Cs2Match[];
  source?: string;
  cache?: string;
};

// ── Data fetching ──
function useCs2Data() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cs2/matches");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ApiResponse;
      setData(json);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 120_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return { data, loading, error, mutate: fetchData };
}

// ── Helpers ──
function getTeamInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

// ── Skeleton ──
function Cs2CardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-white/10 bg-[#1A1A2E] p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-white/10" />
          <div className="space-y-2">
            <div className="h-4 w-28 rounded bg-white/10" />
            <div className="h-3 w-16 rounded bg-white/10" />
          </div>
        </div>
        <div className="text-center">
          <div className="mx-auto mb-1 h-3 w-8 rounded bg-white/10" />
          <div className="h-5 w-8 rounded bg-white/10" />
        </div>
        <div className="flex items-center gap-3">
          <div className="space-y-2 text-right">
            <div className="ml-auto h-4 w-28 rounded bg-white/10" />
            <div className="ml-auto h-3 w-16 rounded bg-white/10" />
          </div>
          <div className="h-12 w-12 rounded-full bg-white/10" />
        </div>
      </div>
    </div>
  );
}

// ── CS2 Match Card ──
function Cs2MatchCard({ match, index }: { match: Cs2Match; index: number }) {
  const prob1 = match.maps?.[0]?.prob_team1 ?? 50;
  const prob2 = match.maps?.[0]?.prob_team2 ?? 50;
  const fav = prob1 >= prob2 ? match.team1 : match.team2;
  const dog = prob1 >= prob2 ? match.team2 : match.team1;
  const favProb = Math.round(Math.max(prob1, prob2) * 100);
  const dogProb = 100 - favProb;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="group rounded-2xl border border-white/10 bg-[#1A1A2E]/60 p-5 transition-all hover:border-[#00E676]/30 hover:shadow-lg hover:shadow-[#00E676]/5"
    >
      <div className="flex items-center justify-between gap-4">
        {/* Team 1 */}
        <div className="flex flex-1 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500/20 to-orange-600/10 text-sm font-bold text-orange-400 ring-1 ring-white/10">
            {match.team1.logo ? (
              <img src={match.team1.logo} alt={match.team1.name} className="h-8 w-8 rounded-full object-cover" />
            ) : (
              getTeamInitials(match.team1.name)
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              {match.team1.name}
            </p>
            {match.team1.rank && (
              <p className="text-[11px] text-zinc-500">#{match.team1.rank}</p>
            )}
          </div>
        </div>

        {/* VS + Prob */}
        <div className="flex shrink-0 flex-col items-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">VS</span>
          <span className="mt-1 font-mono text-lg font-bold tabular-nums text-[#00E676]">
            {favProb}%
          </span>
          {match.format && (
            <span className="mt-0.5 text-[10px] text-zinc-600">{match.format}</span>
          )}
        </div>

        {/* Team 2 */}
        <div className="flex flex-1 items-center justify-end gap-3">
          <div className="min-w-0 text-right">
            <p className="truncate text-sm font-semibold text-white">
              {match.team2.name}
            </p>
            {match.team2.rank && (
              <p className="text-[11px] text-zinc-500">#{match.team2.rank}</p>
            )}
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/20 to-blue-600/10 text-sm font-bold text-blue-400 ring-1 ring-white/10">
            {match.team2.logo ? (
              <img src={match.team2.logo} alt={match.team2.name} className="h-8 w-8 rounded-full object-cover" />
            ) : (
              getTeamInitials(match.team2.name)
            )}
          </div>
        </div>
      </div>

      {/* Maps row */}
      {match.maps && match.maps.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-white/5 pt-3">
          {match.maps.slice(0, 3).map((m, i) => {
            const mp = Math.round(m.prob_team1 * 100);
            return (
              <span
                key={m.map}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold tabular-nums",
                  i === 0
                    ? "bg-[#00E676]/10 text-[#00E676]"
                    : "bg-white/5 text-zinc-400"
                )}
              >
                <Map className="h-2.5 w-2.5" />
                {m.map} {mp}%–{100 - mp}%
              </span>
            );
          })}
        </div>
      )}

      {/* Event name */}
      {match.event && (
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-zinc-600">
          <Swords className="h-3 w-3" />
          {match.event}
        </p>
      )}
    </motion.div>
  );
}

// ── Error State ──
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <AlertCircle className="mb-4 h-12 w-12 text-red-400" />
      <p className="mb-1 text-lg font-semibold text-white">Données CS2 indisponibles</p>
      <p className="mb-6 text-sm text-zinc-400">L'API des matchs CS2 ne répond pas pour le moment.</p>
      <button
        onClick={onRetry}
        className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-2.5 text-sm font-medium text-red-300 transition hover:bg-red-500/20"
      >
        <RefreshCw className="h-4 w-4" /> Réessayer
      </button>
    </div>
  );
}

// ── Empty State ──
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Crosshair className="mb-4 h-12 w-12 text-zinc-600" />
      <p className="text-lg font-semibold text-white">Aucun match CS2 à venir</p>
      <p className="text-sm text-zinc-400">Revenez plus tard pour les prochains événements.</p>
    </div>
  );
}

// ── Main Component ──
export function Cs2TabContent() {
  const { data, loading, error, mutate } = useCs2Data();
  const matches = data?.matches ?? [];

  if (loading && !data) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-3 p-4">
        {[1, 2, 3].map((i) => <Cs2CardSkeleton key={i} />)}
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="mx-auto w-full max-w-6xl p-4">
        <ErrorState onRetry={mutate} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/15">
            <Crosshair className="h-5 w-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">CS2</h1>
            <p className="text-xs text-zinc-400">
              {matches.length > 0
                ? `${matches.length} match${matches.length > 1 ? "s" : ""} à venir`
                : "Counter-Strike 2"}
            </p>
          </div>
        </div>
        <button
          onClick={() => mutate()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-zinc-400 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
          Actualiser
        </button>
      </div>

      {/* Matches */}
      {matches.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {matches.map((m, i) => (
            <Cs2MatchCard key={m.id} match={m} index={i} />
          ))}
        </div>
      )}

      {/* Source */}
      {data?.source && (
        <p className="mt-4 text-center text-xs text-zinc-600">
          Source: {data.source} · Cache: {data.cache ?? "unknown"}
        </p>
      )}
    </div>
  );
}
