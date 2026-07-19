"use client";

import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Target,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  Loader2,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──
type NbaTeam = {
  id: string;
  name: string;
  abbreviation: string;
  logo?: string;
  record?: string;
};

type NbaMatch = {
  id: string;
  home: NbaTeam;
  away: NbaTeam;
  homeProb: number;
  awayProb: number;
  commence_time?: string;
  venue?: string;
};

type ApiResponse = {
  matches: NbaMatch[];
  topBets?: Array<{ id: string; prob: number; edge: number }>;
  source?: string;
};

// ── Data fetching ──
function useNbaData() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/nba/matches");
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
const NBA_TEAM_COLORS: Record<string, string> = {
  BOS: "#007A33", LAL: "#552583", GSW: "#1D428A", CHI: "#CE1141",
  MIA: "#98002E", MIL: "#00471B", PHX: "#1D1160", DEN: "#0E2240",
  PHI: "#006BB6", BKN: "#000000", NYK: "#F58426", DAL: "#002B5E",
  LAC: "#C8102E", MEM: "#5D76A9", CLE: "#860038", TOR: "#CE1141",
  SAS: "#C4CED4", UTA: "#002B5C", SAC: "#5A2D82", POR: "#E03A3E",
  OKC: "#007AC1", MIN: "#0C2340", DET: "#C8102E", HOU: "#CE1141",
  ATL: "#E03A3E", CHA: "#1D1160", ORL: "#0077C0", WAS: "#002B5C",
  IND: "#002D62", NOP: "#0C2340",
};

function teamColor(abbr: string): string {
  return NBA_TEAM_COLORS[abbr.toUpperCase()] ?? "#6366f1";
}

function teamInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

// ── Skeleton ──
function NbaCardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-white/10 bg-[#1A1A2E] p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-white/10" />
          <div className="space-y-2">
            <div className="h-4 w-24 rounded bg-white/10" />
            <div className="h-3 w-16 rounded bg-white/10" />
          </div>
        </div>
        <div className="h-10 w-16 rounded bg-white/10" />
        <div className="flex items-center gap-3">
          <div className="space-y-2 text-right">
            <div className="ml-auto h-4 w-24 rounded bg-white/10" />
            <div className="ml-auto h-3 w-16 rounded bg-white/10" />
          </div>
          <div className="h-12 w-12 rounded-full bg-white/10" />
        </div>
      </div>
    </div>
  );
}

// ── NBA Match Card ──
function NbaMatchCard({ match, index }: { match: NbaMatch; index: number }) {
  const colorHome = teamColor(match.home.abbreviation);
  const colorAway = teamColor(match.away.abbreviation);
  const favProb = Math.round(Math.max(match.homeProb, match.awayProb));
  const dogProb = 100 - favProb;
  const homeFav = match.homeProb >= match.awayProb;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="group rounded-2xl border border-white/10 bg-[#1A1A2E]/60 p-5 transition-all hover:border-sky-500/30 hover:shadow-lg hover:shadow-sky-500/5"
    >
      <div className="flex items-center justify-between gap-4">
        {/* Away team */}
        <div className="flex flex-1 items-center gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ring-2 ring-offset-2 ring-offset-[#0F0F1A]"
            style={{ backgroundColor: colorAway }}
          >
            {match.away.logo ? (
              <img src={match.away.logo} alt={match.away.name} className="h-8 w-8 rounded-full object-cover" />
            ) : (
              match.away.abbreviation
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              {match.away.name}
            </p>
            {match.away.record && (
              <p className="text-[11px] text-zinc-500">{match.away.record}</p>
            )}
          </div>
        </div>

        {/* VS + Prob */}
        <div className="flex shrink-0 flex-col items-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">@</span>
          <span className="mt-1 font-mono text-lg font-bold tabular-nums text-sky-400">
            {homeFav ? favProb : dogProb}%
          </span>
        </div>

        {/* Home team */}
        <div className="flex flex-1 items-center justify-end gap-3">
          <div className="min-w-0 text-right">
            <p className="truncate text-sm font-semibold text-white">
              {match.home.name}
            </p>
            {match.home.record && (
              <p className="text-[11px] text-zinc-500">{match.home.record}</p>
            )}
          </div>
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ring-2 ring-offset-2 ring-offset-[#0F0F1A]"
            style={{ backgroundColor: colorHome }}
          >
            {match.home.logo ? (
              <img src={match.home.logo} alt={match.home.name} className="h-8 w-8 rounded-full object-cover" />
            ) : (
              match.home.abbreviation
            )}
          </div>
        </div>
      </div>

      {/* Venue */}
      {match.venue && (
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-zinc-600">
          <MapPin className="h-3 w-3" />
          {match.venue}
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
      <p className="mb-1 text-lg font-semibold text-white">Données NBA indisponibles</p>
      <p className="mb-6 text-sm text-zinc-400">L'API des matchs NBA ne répond pas pour le moment.</p>
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
      <Target className="mb-4 h-12 w-12 text-zinc-600" />
      <p className="text-lg font-semibold text-white">Aucun match NBA à venir</p>
      <p className="text-sm text-zinc-400">Revenez plus tard pour les prochains matchs NBA.</p>
    </div>
  );
}

// ── Main Component ──
export function NbaTabContent() {
  const { data, loading, error, mutate } = useNbaData();
  const matches = data?.matches ?? [];

  if (loading && !data) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-3 p-4">
        {[1, 2, 3].map((i) => <NbaCardSkeleton key={i} />)}
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
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15">
            <Target className="h-5 w-5 text-sky-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">NBA</h1>
            <p className="text-xs text-zinc-400">
              {matches.length > 0
                ? `${matches.length} match${matches.length > 1 ? "s" : ""} à venir`
                : "National Basketball Association"}
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
            <NbaMatchCard key={m.id} match={m} index={i} />
          ))}
        </div>
      )}

      {/* Source */}
      {data?.source && (
        <p className="mt-4 text-center text-xs text-zinc-600">
          Source: {data.source}
        </p>
      )}
    </div>
  );
}
