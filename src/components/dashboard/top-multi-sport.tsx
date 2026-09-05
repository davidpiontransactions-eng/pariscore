"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { RefreshCw, Star } from "lucide-react";
import { countryFlag } from "@/lib/top-matches/types";

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
  country?: string;
  countryCode?: string;
  matches: TopMatch[];
}
interface TopMatchResponse {
  groups: TopLeague[];
  generated_at: string;
}



const CACHE_MS = 60_000;
const POLL_MS = 120_000;

type TimeFilter = "live" | "1h" | "2h" | "4h" | "8h" | "today" | "tomorrow" | "all";

const TIME_FILTERS: { id: TimeFilter; label: string; icon?: string }[] = [
  { id: "live", label: "Live", icon: "🔴" },
  { id: "1h", label: "1h" },
  { id: "2h", label: "2h" },
  { id: "4h", label: "4h" },
  { id: "8h", label: "8h" },
  { id: "today", label: "Auj." },
  { id: "tomorrow", label: "Dem." },
  { id: "all", label: "Tous" },
];

function isInTimeWindow(iso: string, filter: TimeFilter, status?: string): boolean {
  if (filter === "all") return true;
  if (filter === "live") return status === "live";
  // Les matchs live restent visibles quelle que soit la fenêtre temps
  if (status === "live") return true;
  const now = new Date();
  const kickoff = new Date(iso);
  if (isNaN(kickoff.getTime())) return true;
  if (filter === "today") {
    return kickoff.toDateString() === now.toDateString();
  }
  if (filter === "tomorrow") {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return kickoff.toDateString() === tomorrow.toDateString();
  }
  const hours = { "1h": 1, "2h": 2, "4h": 4, "8h": 8 }[filter] ?? 8;
  const diffMs = kickoff.getTime() - now.getTime();
  return diffMs >= 0 && diffMs <= hours * 3600_000;
}

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
function MatchRow({
  match,
  isFavorite,
  onToggleFavorite,
}: {
  match: TopMatch;
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
}) {
  const isLive = match.status === "live";
  return (
    <div className={cn(
      "flex items-center px-4 py-2.5 bg-white border-b border-[#EDE8F5] last:border-b-0 hover:bg-[#F8F5FC] transition-colors group",
      isLive && "bg-[#4CAF50]/5"
    )}>
      {/* Time / Live indicator */}
      <div className="w-14 text-center shrink-0">
        {isLive ? (
          <div className="flex flex-col items-center">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#4CAF50] text-white text-[9px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              LIVE
            </span>
            {match.score && (
              <span className="text-sm font-extrabold text-[#1A1145] mt-0.5 tabular-nums">{match.score}</span>
            )}
          </div>
        ) : (
          <>
            <div className="text-sm font-semibold text-[#1A1145]">
              {formatTime(match.kickoff)}
            </div>
            <div className="text-[10px] text-[#7B3FA0]">{formatDate(match.kickoff)}</div>
          </>
        )}
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
          <div className="text-sm font-bold text-[#1A1145]">
            {match.metric.value}{match.metric.max ? `/${match.metric.max}` : ""}
          </div>
          <div className="text-[10px] text-[#7B3FA0]">{match.metric.label}</div>
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

      {/* Favorite toggle */}
      <button
        onClick={() => onToggleFavorite?.(match.id)}
        className="ml-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-[#7B3FA0] hover:text-[#FF6D00]"
        title={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill={isFavorite ? "#FF6D00" : "none"}
          stroke="currentColor"
          strokeWidth={2}
          className="w-4 h-4"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
          />
        </svg>
      </button>
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
        <img src={team.logo} alt="" className="w-5 h-5 rounded-full border border-[#E0D8F0] object-cover" />
      )}
      <span className="text-[13px] font-semibold text-[#1A1145] truncate">
        {team.name}
        {team.rank != null && (
          <span className="text-[#7B3FA0] text-[10px] ml-1">#{team.rank}</span>
        )}
      </span>
      {score != null && (
        <span className="text-[#7B3FA0] text-[11px]">{score}</span>
      )}
      {isLive && (
        <span className="text-[#4CAF50] text-[10px] font-bold">LIVE</span>
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
          ? "bg-[#FF6D00] text-white"
          : "bg-[#EDE8F5] text-[#1A1145]"
      )}
    >
      {value}
    </span>
  );
}

/* ─── League Card ─── */
function LeagueCard({
  group,
  favorites,
  onToggleFavorite,
}: {
  group: TopLeague;
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
}) {
  const flag = group.country ? countryFlag(group.country) : '';
  return (
    <div className="rounded-xl overflow-hidden shadow-sm border border-[#E0D8F0] bg-white">
      {/* Header */}
      <div
        className="flex items-center px-4 py-2.5 text-white font-bold text-sm gap-2"
        style={{ background: group.leagueColor }}
      >
        <span>{group.leagueIcon}</span>
        <span>{group.league}</span>
        {flag && (
          <span className="text-[11px] ml-1 opacity-90">{flag} {group.country}</span>
        )}
        <div className="ml-auto flex gap-6 text-[11px] font-semibold opacity-80">
          <span className="text-white">1</span>
          <span className="text-white">N</span>
          <span className="text-white">2</span>
        </div>
      </div>
      {/* Matches */}
      {group.matches.map((m) => (
        <MatchRow
          key={m.id}
          match={m}
          isFavorite={favorites.has(m.id)}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
    </div>
  );
}

/* ─── Main Component ─── */
export function TopMultiSport() {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [groups, setGroups] = useState<TopLeague[]>([]);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const cacheRef = useRef<Map<string, { data: TopMatchResponse; ts: number }>>(new Map());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(
    async (skipCache = false) => {
      const key = "all";
      if (!skipCache) {
        const cached = cacheRef.current.get(key);
        if (cached && Date.now() - cached.ts < CACHE_MS) {
          setGroups(cached.data.groups);
          setLoading(false);
          return;
        }
      }
      try {
        const res = await fetch(`/api/v1/top-matches/all?limit=10`);
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

  // Filtrer les matchs finis + time filter
  const filteredGroups = groups
    .map((g) => ({
      ...g,
      matches: g.matches.filter(
        (m) => m.status !== "finished" && isInTimeWindow(m.kickoff, timeFilter, m.status)
      ),
    }))
    .filter((g) => g.matches.length > 0);

  // Favoris : tous les matchs favoris à travers les groupes
  const favoriteMatches = groups
    .flatMap((g) => g.matches.filter((m) => favorites.has(m.id)))
    .filter((m) => m.status !== "finished");

  const toggleFavorite = (matchId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(matchId)) next.delete(matchId);
      else next.add(matchId);
      return next;
    });
  };

  // Initial fetch + polling
  useEffect(() => {
    setLoading(true);
    fetchData(sport);
    pollRef.current = setInterval(() => fetchData(sport), POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchData]);

  const handleRefresh = () => {
    setSpinning(true);
    cacheRef.current.delete("all");
    fetchData(true);
    setTimeout(() => setSpinning(false), 500);
  };

  const totalMatches = filteredGroups.reduce((sum, g) => sum + g.matches.length, 0);

  return (
    <div className="w-full rounded-2xl p-5 mb-6 border border-[#E0D8F0] shadow-sm" style={{ background: "#F0ECF8" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-extrabold text-[#1A1145] tracking-tight">
            Top Matchs du Jour
          </h2>
          {totalMatches > 0 && (
            <span className="text-xs text-[#7B3FA0] font-mono">{totalMatches} matchs</span>
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
                    ? "bg-[#7B3FA0] text-white"
                    : "bg-white text-[#7B3FA0] hover:bg-[#EDE8F5]"
                )}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          {/* Refresh */}
          <button
            onClick={handleRefresh}
            className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[#7B3FA0] hover:bg-[#EDE8F5] transition-colors"
          >
            <RefreshCw className={cn("w-4 h-4", spinning && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Time filters */}
      <div className="flex gap-1 mb-4 overflow-x-auto scrollbar-none">
        {TIME_FILTERS.map((tf) => (
          <button
            key={tf.id}
            onClick={() => setTimeFilter(tf.id)}
            className={cn(
              "px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-colors",
              timeFilter === tf.id
                ? tf.id === "live"
                  ? "bg-[#4CAF50] text-white"
                  : "bg-[#FF6D00] text-white"
                : "bg-white text-[#7B3FA0] hover:bg-[#EDE8F5]"
            )}
          >
            {tf.icon && <span className="mr-1">{tf.icon}</span>}
            {tf.label}
          </button>
        ))}
      </div>

      {/* Favoris section */}
      {favoriteMatches.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-extrabold text-[#1A1145] mb-2 flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="#FF6D00"
              className="w-4 h-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
              />
            </svg>
            Favoris matchs
          </h3>
          <div className="rounded-xl overflow-hidden shadow-sm border border-[#E0D8F0] bg-white">
            {favoriteMatches.map((m) => (
              <MatchRow
                key={m.id}
                match={m}
                isFavorite
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="text-center py-10 text-[#7B3FA0] text-sm">Chargement...</div>
      ) : filteredGroups.length === 0 ? (
        <div className="text-center py-10 text-[#7B3FA0] text-sm">Aucun match top disponible.</div>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredGroups.map((g, i) => (
            <LeagueCard
              key={`${g.league}-${i}`}
              group={g}
              favorites={favorites}
              onToggleFavorite={toggleFavorite}
            />
          ))}
        </div>
      )}
    </div>
  );
}
