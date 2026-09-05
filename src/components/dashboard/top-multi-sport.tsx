"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { RefreshCw } from "lucide-react";

/* ─── Types ─── */
interface TopTeam {
  name: string;
  logo?: string;
  rank?: number;
}
interface TopOdds {
  home?: string;
  draw?: string;
  away?: string;
  best?: "home" | "draw" | "away";
}
interface TopMetric {
  label: string;
  value: number | string;
  max?: number;
}
interface TopBadge {
  label: string;
  color: string;
}
interface TopMatch {
  id: string;
  home: TopTeam;
  away: TopTeam;
  kickoff: string;
  status: "scheduled" | "live" | "finished";
  score?: string;
  odds?: TopOdds;
  metric?: TopMetric;
  badge?: TopBadge;
}
interface TopLeague {
  league: string;
  leagueIcon: string;
  leagueColor: string;
  sport: string;
  matches: TopMatch[];
}
interface TopMatchResponse {
  groups: TopLeague[];
  generated_at: string;
}

type SportType = "all" | "football" | "tennis" | "nba" | "wnba" | "f1" | "cs2" | "mma" | "cycling";

const SPORT_TABS: { id: SportType; label: string; icon: string }[] = [
  { id: "all", label: "Tous", icon: "🔥" },
  { id: "football", label: "Football", icon: "⚽" },
  { id: "tennis", label: "Tennis", icon: "🎾" },
  { id: "nba", label: "NBA", icon: "🏀" },
  { id: "wnba", label: "WNBA", icon: "🏀" },
  { id: "f1", label: "F1", icon: "🏎️" },
  { id: "cs2", label: "CS2", icon: "🎮" },
  { id: "mma", label: "MMA", icon: "🥊" },
  { id: "cycling", label: "Cycling", icon: "🚴" },
];

const CACHE_MS = 60_000;
const POLL_MS = 120_000;

/* ─── Helpers ─── */
function formatTime(iso: string): string {
  if (!iso) return "--:--";
  const d = new Date(iso);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

/* ─── Match Row ─── */
function MatchRow({ match }: { match: TopMatch }) {
  const isLive = match.status === "live";
  return (
    <div className="flex items-center px-4 py-2.5 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 last:border-b-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
      {/* Time */}
      <div className="w-14 text-center shrink-0">
        <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {formatTime(match.kickoff)}
        </div>
        <div className="text-[10px] text-zinc-400">{formatDate(match.kickoff)}</div>
      </div>

      {/* Teams */}
      <div className="flex-1 ml-3 flex flex-col gap-1 min-w-0">
        <TeamLine team={match.home} score={match.score?.split("-")[0]} isLive={isLive} />
        <TeamLine team={match.away} score={match.score?.split("-")[1]} />
      </div>

      {/* Odds */}
      {match.odds && (
        <div className="flex gap-1.5 shrink-0 ml-2">
          {match.odds.home != null && (
            <OddsBox value={match.odds.home} best={match.odds.best === "home"} />
          )}
          {match.odds.draw != null && (
            <OddsBox value={match.odds.draw} best={match.odds.best === "draw"} />
          )}
          {match.odds.away != null && (
            <OddsBox value={match.odds.away} best={match.odds.best === "away"} />
          )}
        </div>
      )}

      {/* Metric */}
      {match.metric && (
        <div className="text-right shrink-0 ml-2 min-w-[60px]">
          <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            {match.metric.value}{match.metric.max ? `/${match.metric.max}` : ""}
          </div>
          <div className="text-[10px] text-zinc-400">{match.metric.label}</div>
        </div>
      )}

      {/* Badge */}
      {match.badge && (
        <span
          className="ml-2 shrink-0 px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase tracking-wide"
          style={{ background: match.badge.color }}
        >
          {match.badge.label}
        </span>
      )}
    </div>
  );
}

function TeamLine({
  team,
  score,
  isLive,
}: {
  team: TopTeam;
  score?: string;
  isLive?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      {team.logo && (
        <img src={team.logo} alt="" className="w-5 h-5 rounded-full border border-zinc-200 dark:border-zinc-700 object-cover" />
      )}
      <span className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 truncate">
        {team.name}
        {team.rank != null && (
          <span className="text-zinc-400 text-[10px] ml-1">#{team.rank}</span>
        )}
      </span>
      {score != null && (
        <span className="text-zinc-400 text-[11px]">{score}</span>
      )}
      {isLive && (
        <span className="text-red-500 text-[10px] font-bold">LIVE</span>
      )}
    </div>
  );
}

function OddsBox({ value, best }: { value: string; best?: boolean }) {
  return (
    <span
      className={cn(
        "px-2.5 py-1 rounded-md text-xs font-bold min-w-[44px] text-center",
        best
          ? "bg-emerald-500 text-white"
          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
      )}
    >
      {value}
    </span>
  );
}

/* ─── League Card ─── */
function LeagueCard({ group }: { group: TopLeague }) {
  return (
    <div className="rounded-xl overflow-hidden shadow-sm border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
      {/* Header */}
      <div
        className="flex items-center px-4 py-2.5 text-white font-bold text-sm gap-2"
        style={{ background: group.leagueColor }}
      >
        <span>{group.leagueIcon}</span>
        <span>{group.league}</span>
        <div className="ml-auto flex gap-6 text-[11px] font-semibold opacity-80">
          <span>1</span>
          <span>N</span>
          <span>2</span>
        </div>
      </div>
      {/* Matches */}
      {group.matches.map((m) => (
        <MatchRow key={m.id} match={m} />
      ))}
    </div>
  );
}

/* ─── Main Component ─── */
export function TopMultiSport() {
  const [sport, setSport] = useState<SportType>("all");
  const [groups, setGroups] = useState<TopLeague[]>([]);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const cacheRef = useRef<Map<string, { data: TopMatchResponse; ts: number }>>(new Map());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(
    async (s: SportType, skipCache = false) => {
      const key = s;
      if (!skipCache) {
        const cached = cacheRef.current.get(key);
        if (cached && Date.now() - cached.ts < CACHE_MS) {
          setGroups(cached.data.groups);
          setLoading(false);
          return;
        }
      }
      try {
        const res = await fetch(`/api/v1/top-matches/all?sport=${s}&limit=10`);
        const data: TopMatchResponse = await res.json();
        cacheRef.current.set(key, { data, ts: Date.now() });
        setGroups(data.groups);
      } catch {
        setGroups([]);
      }
      setLoading(false);
    },
    []
  );

  // Filtrer les matchs finis
  const filteredGroups = groups
    .map((g) => ({
      ...g,
      matches: g.matches.filter((m) => m.status !== "finished"),
    }))
    .filter((g) => g.matches.length > 0);

  // Initial fetch + polling
  useEffect(() => {
    setLoading(true);
    fetchData(sport);
    pollRef.current = setInterval(() => fetchData(sport), POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [sport, fetchData]);

  const handleSportChange = (s: SportType) => {
    setSport(s);
    setLoading(true);
    cacheRef.current.delete(s);
  };

  const handleRefresh = () => {
    setSpinning(true);
    cacheRef.current.delete(sport);
    fetchData(sport, true);
    setTimeout(() => setSpinning(false), 500);
  };

  const totalMatches = filteredGroups.reduce((sum, g) => sum + g.matches.length, 0);

  return (
    <div className="w-full bg-white dark:bg-zinc-900 rounded-2xl p-5 mb-6 border border-zinc-200 dark:border-zinc-800 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Top Matchs du Jour
          </h2>
          {totalMatches > 0 && (
            <span className="text-xs text-zinc-400 font-mono">{totalMatches} matchs</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Sport tabs */}
          <div className="flex gap-1 overflow-x-auto scrollbar-none">
            {SPORT_TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => handleSportChange(t.id)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors",
                  sport === t.id
                    ? "bg-violet-600 text-white"
                    : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-300 dark:hover:bg-zinc-700"
                )}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          {/* Refresh */}
          <button
            onClick={handleRefresh}
            className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
          >
            <RefreshCw className={cn("w-4 h-4", spinning && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-10 text-zinc-400 text-sm">Chargement...</div>
      ) : filteredGroups.length === 0 ? (
        <div className="text-center py-10 text-zinc-400 text-sm">Aucun match top disponible.</div>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredGroups.map((g, i) => (
            <LeagueCard key={`${g.league}-${i}`} group={g} />
          ))}
        </div>
      )}
    </div>
  );
}
