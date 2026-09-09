"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import { RefreshCw, Star, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { countryFlag, type LiveMatchScore } from "@/lib/top-matches/types";
import { FotmobCalendarTable, type FotmobCalMatch } from "@/components/football/fotmob-calendar-table";
import { FootballMatchDetailDialog } from "@/components/football/football-match-detail-dialog";
import type { FootballMatch } from "@/lib/football-data";
import { FotmobFilterBar } from "@/components/football/fotmob-filter-bar";
import { filterByKickoffWindow, parisTodayKey, shiftDateKey } from "@/lib/fotmob-filter";
import { buildTopTags, topTagsForMatch } from "@/lib/top10-calendar-link";
import { useFootballTopN } from "@/hooks/use-football-top5";

/* ─── Types (local mirror) ─── */
interface TopTeam { name: string; logo?: string; rank?: number; }
interface TopOdds { home?: string; draw?: string; away?: string; best?: 'home' | 'draw' | 'away'; }
interface TopBadge { label: string; color: string; }
interface TopMatch {
  id: string; home: TopTeam; away: TopTeam; kickoff: string;
  status: 'scheduled' | 'live' | 'finished';
  score?: string; liveScore?: LiveMatchScore;
  odds?: TopOdds; badge?: TopBadge;
  round?: string; surface?: string;
  probPct?: number; ev?: number | null; trend?: number | null;
  confLabel?: string; confLevel?: 1 | 2 | 3;
}
interface TopLeague { league: string; leagueIcon: string; leagueColor: string; sport: string; country?: string; matches: TopMatch[]; }
interface TopMatchResponse { groups: TopLeague[]; generated_at: string; }

const CACHE_MS = 60_000;
const POLL_NORMAL_MS = 120_000;
const POLL_LIVE_MS = 20_000;

type TimeFilter = 'live' | '1h' | '2h' | '4h' | '8h' | 'today' | 'tomorrow' | 'all';
const TIME_FILTERS: { id: TimeFilter; label: string; icon?: string }[] = [
  { id: 'live', label: 'Live', icon: '🔴' }, { id: '1h', label: '1h' }, { id: '2h', label: '2h' },
  { id: '4h', label: '4h' }, { id: '8h', label: '8h' }, { id: 'today', label: 'Auj.' },
  { id: 'tomorrow', label: 'Dem.' }, { id: 'all', label: 'Tous' },
];

type SportFilter = "all" | "football" | "tennis" | "nba" | "fiba" | "cs2" | "mma" | "baseball" | "rugby" | "f1" | "cycling";

const SPORT_FILTERS: { id: SportFilter; icon: string; label: string }[] = [
  { id: "all", icon: "🏅", label: "Tous" },
  { id: "football", icon: "⚽", label: "Football" },
  { id: "tennis", icon: "🎾", label: "Tennis" },
  { id: "nba", icon: "🏀", label: "NBA" },
  { id: "fiba", icon: "🏀", label: "FIBA" },
  { id: "cs2", icon: "🎮", label: "CS2" },
  { id: "mma", icon: "🥊", label: "MMA" },
  { id: "baseball", icon: "⚾", label: "Baseball" },
  { id: "rugby", icon: "🏉", label: "Rugby" },
  { id: "f1", icon: "🏎️", label: "F1" },
  { id: "cycling", icon: "🚴", label: "Cyclisme" },
];

function isInTimeWindow(iso: string, filter: TimeFilter, status?: string, badgeLabel?: string): boolean {
  if (filter === "all") return true;
  // Filtre live : matchs en cours + imminents (< 30 min)
  if (filter === "live") {
    if (status === "live") return true;
    if (badgeLabel === "Imminent") return true;
    // Vérifier imminent côté client (sécurité)
    if (status === "scheduled" && iso) {
      const ms = new Date(iso).getTime() - Date.now();
      if (ms > 0 && ms < 30 * 60_000) return true;
    }
    return false;
  }
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
  if (!iso) return "--";
  const d = new Date(iso);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
}
function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const weekday = d.toLocaleDateString("fr-FR", { weekday: "short", timeZone: "UTC" }).replace(".", "");
  const day = d.getUTCDate();
  const month = d.toLocaleDateString("fr-FR", { month: "short", timeZone: "UTC" }).replace(".", "");
  const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  return `${weekday}. ${day} ${month} · ${time}`;
}
function formatDayHeader(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400_000);
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return "Demain";
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}
function getDayKey(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ─── Match Row ─── */
/* ─── Match Row (dark Behance) ─── */
function MatchRow({ match, sport, isFavorite, onToggleFavorite }: {
  match: TopMatch; sport: string; isFavorite?: boolean; onToggleFavorite?: (id: string) => void;
}) {
  const isLive = match.status === 'live';
  return (
    <div className={cn("flex items-center px-4 py-3 border-b border-slate-800/50 last:border-b-0 hover:bg-slate-800/40 transition-colors group", isLive && "bg-emerald-500/5")}>
      <div className="w-20 text-center shrink-0">
        {isLive ? (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> Live
          </span>
        ) : (
          <>
            <div className="text-sm font-bold text-white">{formatTime(match.kickoff)}</div>
            <div className="text-[10px] text-slate-400 font-medium">{formatDate(match.kickoff)}</div>
          </>
        )}
      </div>
      <div className="flex-1 ml-3 flex flex-col gap-1.5 min-w-0">
        <div className="flex items-center gap-2">
          <TeamLogoFallback name={match.home.name} logo={match.home.logo} size="sm" />
          <span className="text-sm font-semibold text-white truncate">{match.home.name}</span>
          {!isLive && match.score && <span className="text-slate-400 text-xs font-mono ml-auto">{match.score.split('-')[0]}</span>}
          {isLive && match.liveScore?.current && <span className="text-emerald-400 text-sm font-bold ml-auto">{match.liveScore.current}</span>}
        </div>
        <div className="flex items-center gap-2">
          <TeamLogoFallback name={match.away.name} logo={match.away.logo} size="sm" />
          <span className="text-sm font-semibold text-white truncate">{match.away.name}</span>
          {!isLive && match.score && <span className="text-slate-400 text-xs font-mono ml-auto">{match.score.split('-')[1]}</span>}
        </div>
        {(match.round || match.surface) && (
          <div className="flex items-center gap-1.5 mt-0.5">
            {match.round && <span className="text-[9px] text-cyan-400/70 font-medium truncate">{match.round}</span>}
            {match.surface && (
              <span className={cn("text-[8px] px-1.5 py-0.5 rounded font-bold uppercase",
                match.surface.toLowerCase().includes('clay') ? 'bg-orange-500/15 text-orange-400' :
                match.surface.toLowerCase().includes('grass') ? 'bg-green-500/15 text-green-400' :
                'bg-blue-500/15 text-blue-400'
              )}>{match.surface}</span>
            )}
          </div>
        )}
      </div>
      {match.odds && (
        <div className="flex gap-1.5 shrink-0 ml-2">
          {match.odds.home != null && <OddsButton value={match.odds.home} best={match.odds.best === 'home'} />}
          {match.odds.draw != null && <OddsButton value={match.odds.draw} best={match.odds.best === 'draw'} />}
          {match.odds.away != null && <OddsButton value={match.odds.away} best={match.odds.best === 'away'} />}
        </div>
      )}
      <ProbBadge pct={match.probPct} confLabel={match.confLabel} />
      <div className="flex items-center shrink-0 ml-2">
        <EvBadge ev={match.ev} />
        <TrendBadge trend={match.trend} />
      </div>
      {match.badge && (
        <span className="ml-2 shrink-0 px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase tracking-wide"
          style={{ background: match.badge.color }}>{match.badge.label}</span>
      )}
      <button onClick={() => onToggleFavorite?.(match.id)}
        className="ml-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-amber-400"
        title={isFavorite ? 'Retirer' : 'Ajouter'}>
        <Star className="w-4 h-4" fill={isFavorite ? '#f59e0b' : 'none'} strokeWidth={2} />
      </button>
    </div>
  );
}

/* ─── Sous-composants Behance ─── */

function TeamLogoFallback({ name, logo, size = 'md' }: { name: string; logo?: string; size?: 'sm' | 'md' }) {
  const [error, setError] = useState(false);
  const initials = (name || '?').slice(0, 2).toUpperCase();
  const px = size === 'sm' ? 16 : 24;
  const fs = size === 'sm' ? 7 : 10;
  const gradients = [
    ['#6366f1','#4338ca'], ['#00e676','#00c853'], ['#ff6d00','#e65100'],
    ['#0ea5e9','#0284c7'], ['#f59e0b','#d97706'], ['#ec4899','#db2777'],
    ['#8b5cf6','#7c3aed'], ['#14b8a6','#0d9488'],
  ];
  const [c1, c2] = gradients[name.length % gradients.length];
  if (error || !logo) return (
    <svg width={px} height={px} viewBox="0 0 24 24" className={`${size === 'sm' ? 'w-4 h-4' : 'w-6 h-6'} shrink-0`}>
      <defs><linearGradient id={`g-${name.length}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={c1} /><stop offset="100%" stopColor={c2} /></linearGradient></defs>
      <circle cx="12" cy="12" r="12" fill={`url(#g-${name.length})`} />
      <text x="12" y="12" textAnchor="middle" dominantBaseline="central" fill="white" fontSize={fs} fontWeight="bold" fontFamily="system-ui">{initials}</text>
    </svg>
  );
  return (<img src={logo} alt="" className={`${size === 'sm' ? 'w-4 h-4' : 'w-6 h-6'} rounded-full border border-slate-700/50 object-cover shrink-0`} onError={() => setError(true)} />);
}

function OddsButton({ value, best }: { value: string; best?: boolean }) {
  const v = typeof value === 'string' ? value : value != null ? String(value) : '';
  return (
    <button className={cn(
      "px-2.5 py-1 rounded-md text-xs font-bold min-w-[44px] text-center transition-all duration-150 cursor-pointer",
      "border border-emerald-500/30 hover:bg-emerald-500/20 hover:border-emerald-400/50 active:scale-95",
      best ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/60" : "bg-emerald-500/10 text-emerald-400"
    )}>{v}</button>
  );
}

function ProbBadge({ pct, confLabel }: { pct?: number; confLabel?: string }) {
  if (pct == null) return null;
  let color: string, bg: string;
  if (pct >= 78) { color = 'text-emerald-400'; bg = 'bg-emerald-500/15 border-emerald-500/30'; }
  else if (pct >= 65) { color = 'text-cyan-400'; bg = 'bg-cyan-500/15 border-cyan-500/30'; }
  else { color = 'text-amber-400'; bg = 'bg-amber-500/15 border-amber-500/30'; }
  return (
    <div className={`shrink-0 ml-2 px-2.5 py-1 rounded-lg border ${bg} ${color} text-center min-w-[72px]`}>
      <div className="text-sm font-bold leading-tight">{pct}%</div>
      <div className="text-[8px] font-semibold uppercase tracking-wider opacity-80">{confLabel || 'Confiance'}</div>
    </div>
  );
}

function TrendBadge({ trend }: { trend?: number | null }) {
  if (trend == null) return <Minus className="w-3 h-3 text-slate-600 shrink-0 ml-2" />;
  const isPos = trend > 0;
  return (
    <span className={`flex items-center gap-0.5 shrink-0 ml-2 text-[11px] font-bold ${isPos ? 'text-emerald-400' : 'text-red-400'}`}>
      {isPos ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {isPos ? '+' : ''}{(trend * 100).toFixed(1)}%
    </span>
  );
}

function EvBadge({ ev }: { ev?: number | null }) {
  if (ev == null) return <span className="text-slate-600 text-xs ml-2 shrink-0">—</span>;
  const isPos = ev > 0;
  return (
    <span className={`shrink-0 ml-2 text-xs font-bold px-2 py-0.5 rounded ${isPos ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
      {isPos ? '+' : ''}{ev.toFixed(2)}
    </span>
  );
}

/* ─── League Card (dark glassmorphism) ─── */
function LeagueCard({ group, favorites, onToggleFavorite }: {
  group: TopLeague; favorites: Set<string>; onToggleFavorite: (id: string) => void;
}) {
  const flag = group.country ? countryFlag(group.country) : '';
  const liveCount = group.matches.filter(m => m.status === 'live').length;
  return (
    <div className="rounded-2xl overflow-hidden border border-slate-700/50 bg-slate-900/80 backdrop-blur-sm shadow-2xl">
      <div className="flex items-center px-4 py-3 text-white font-bold text-sm gap-2"
        style={{ background: `linear-gradient(135deg, ${group.leagueColor}dd 0%, ${group.leagueColor}44 100%)` }}>
        <span>{group.leagueIcon}</span>
        <span className="drop-shadow-sm">{group.league}</span>
        {flag && <span className="text-xs opacity-80 ml-1">{flag} {group.country}</span>}
        <div className="ml-auto flex items-center gap-2">
          {liveCount > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/30 text-[10px] font-bold text-white">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> {liveCount} live
            </span>
          )}
          <span className="text-[10px] text-white/60">{group.matches.length} matchs</span>
        </div>
      </div>
      {group.matches.map(m => (
        <MatchRow key={m.id} match={m} sport={group.sport}
          isFavorite={favorites.has(m.id)} onToggleFavorite={onToggleFavorite} />
      ))}
    </div>
  );
}

/* ─── Main Component ─── */
export function TopMultiSport({ activeSport = "all", mode = "prematch" }: { activeSport?: string; mode?: "prematch" | "live" }) {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [sportFilter, setSportFilter] = useState<SportFilter>("all");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [groups, setGroups] = useState<TopLeague[]>([]);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  // Calendrier foot (réplique FotMob) : source /api/football/calendar quand
  // l'onglet actif est football — remplace les top-picks (vides hors edges).
  const [calMatches, setCalMatches] = useState<FotmobCalMatch[]>([]);
  const [calLoading, setCalLoading] = useState(false);
  // Filtres barre FotMob (remplacent pills masquées en mode foot).
  const [calDate, setCalDate] = useState<string>(() => parisTodayKey());
  const [calLiveOnly, setCalLiveOnly] = useState(false);
  const [calHours, setCalHours] = useState<number | null>(null);
  const [calQuery, setCalQuery] = useState("");
  // Toggle "Top stratégies" : ne garde que les matchs corrélés au Top10.
  const [calTopOnly, setCalTopOnly] = useState(false);
  // Match sélectionné (clic ligne calendrier → dialog d'analyse).
  // Les objets API sont des FootballMatch complets (typés subset côté UI).
  const [detailMatch, setDetailMatch] = useState<FootballMatch | null>(null);
  const fetchCal = useCallback(async (key?: string) => {
    setCalLoading(true);
    try {
      const res = await fetch(`/api/football/calendar?date=${key ?? parisTodayKey()}`);
      const data = await res.json();
      setCalMatches(Array.isArray(data.matches) ? data.matches : []);
    } catch {
      setCalMatches([]);
    }
    setCalLoading(false);
  }, []);
  const cacheRef = useRef<Map<string, { data: TopMatchResponse; ts: number }>>(new Map());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(
    async (skipCache = false) => {
      const sportParam = activeSport !== "all" ? activeSport : "all";
      const timeframe = mode === "live" ? "live" : "today";
      const key = `top-${sportParam}-${timeframe}`;
      if (!skipCache) {
        const cached = cacheRef.current.get(key);
        if (cached && Date.now() - cached.ts < CACHE_MS) {
          setGroups(cached.data.groups);
          setLoading(false);
          return;
        }
      }
      try {
        const res = await fetch(`/api/v1/top-matches/all?sport=${sportParam}&timeframe=${timeframe}&limit=10`);
        const data: TopMatchResponse = await res.json();
        cacheRef.current.set(key, { data, ts: Date.now() });
        setGroups(data.groups ?? []);
      } catch {
        setGroups([]);
      }
      setLoading(false);
    },
    [activeSport, mode]
  );

  // Filtrer les matchs finis + time filter + sport filter
  const filteredGroups = (groups ?? [])
    .map((g) => ({
      ...g,
      matches: (g.matches ?? []).filter(
        (m) => m.status !== "finished" && isInTimeWindow(m.kickoff, timeFilter, m.status, m.badge?.label)
      ),
    }))
    .filter((g) => g.matches.length > 0)
    .filter((g) => {
      if (activeSport !== "all" && g.sport !== activeSport) return false;
      if (sportFilter !== "all" && g.sport !== sportFilter) return false;
      return true;
    });

  // Compteur de matchs par sport (avant filtre sport)
  const sportCounts = (groups ?? [])
    .flatMap((g) => (g.matches ?? []).filter((m) => m.status !== "finished" && isInTimeWindow(m.kickoff, timeFilter, m.status, m.badge?.label)).map((m) => g.sport))
    .reduce((acc, sport) => { acc[sport] = (acc[sport] || 0) + 1; return acc; }, {} as Record<string, number>);
  sportCounts.all = Object.values(sportCounts).reduce((a, b) => a + b, 0);

  // Favoris : tous les matchs favoris à travers les groupes (avec sport)
  const favoriteMatches = (groups ?? [])
    .flatMap((g) => (g.matches ?? []).filter((m) => favorites.has(m.id)).map((m) => ({ ...m, sport: g.sport })))
    .filter((m) => m.status !== "finished");

  const toggleFavorite = (matchId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(matchId)) next.delete(matchId);
      else next.add(matchId);
      return next;
    });
  };

  // Initial fetch + polling (rapide quand filtre live actif)
  useEffect(() => {
    setLoading(true);
    fetchData();
    if (activeSport === "football") fetchCal(calDate);
    const pollMs = timeFilter === "live" ? POLL_LIVE_MS : POLL_NORMAL_MS;
    pollRef.current = setInterval(() => {
      fetchData();
      if (activeSport === "football") fetchCal(calDate);
    }, pollMs);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchData, fetchCal, timeFilter, activeSport, mode, calDate]);

  const handleRefresh = () => {
    setSpinning(true);
    const sportParam = activeSport !== "all" ? activeSport : "all";
    cacheRef.current.delete(`top-${sportParam}`);
    fetchData(true);
    if (activeSport === "football") fetchCal(calDate);
    setTimeout(() => setSpinning(false), 500);
  };

  // Corrélation Top10 (E pill) : 1 fetch SWR partagé avec le widget Top10
  // (dedupe 20min → 0 requête extra si widget monté). Jointure id normalisé
  // + repli noms normalisés (top10-calendar-link).
  const { data: top10 } = useFootballTopN(10, null);
  const topIdx = useMemo(() => buildTopTags(top10?.strategies), [top10]);
  const topTagsFor = useCallback((id: string) => {
    const m = calMatches.find((c) => c.id === id);
    return m ? topTagsForMatch(topIdx, m) : [];
  }, [calMatches, topIdx]);
  const topCalCount = useMemo(
    () => calMatches.filter((m) => topTagsForMatch(topIdx, m).length > 0).length,
    [calMatches, topIdx],
  );

  // Calendrier foot filtré par la barre FotMob (tous : live + prematch).
  const calStatus = (m: FotmobCalMatch): string =>
    m.live && (m.live.status === "LIVE" || m.live.status === "HT") ? "live" : "scheduled";
  const filteredCal = useMemo(() => {
    const q = calQuery.trim().toLowerCase();
    let list = calMatches ?? [];
    if (calLiveOnly) list = list.filter((m) => calStatus(m) === "live");
    list = filterByKickoffWindow(list, calHours);
    if (calTopOnly) list = list.filter((m) => topTagsForMatch(topIdx, m).length > 0);
    if (q) {
      list = list.filter(
        (m) => m.home.name.toLowerCase().includes(q) || m.away.name.toLowerCase().includes(q)
      );
    }
    return list;
  }, [calMatches, calLiveOnly, calHours, calQuery, calTopOnly, topIdx]);

  const totalMatches = filteredGroups.reduce((sum, g) => sum + (g.matches ?? []).length, 0);
  const headerCount = activeSport === "football" ? filteredCal.length : totalMatches;

  return (
    <div className="w-full rounded-2xl p-5 mb-6 border border-slate-800 bg-slate-900/60 backdrop-blur-sm shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-extrabold text-white tracking-tight">
            Calendrier des matchs
          </h2>
          {headerCount > 0 && (
            <span className="text-xs text-slate-400 font-mono">{headerCount} matchs</span>
          )}
        </div>
        <button
          onClick={handleRefresh}
          className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
        >
          <RefreshCw className={cn("w-4 h-4", spinning && "animate-spin")} />
        </button>
      </div>

      {/* Time filters (masqués en mode calendrier foot : barre FotMob) */}
      {activeSport !== "football" && (
      <div className="flex gap-1 mb-3 overflow-x-auto scrollbar-none">
        {TIME_FILTERS.map((tf) => (
          <button
            key={tf.id}
            onClick={() => setTimeFilter(tf.id)}
            className={cn(
              "px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-colors",
              timeFilter === tf.id
                ? tf.id === "live"
                  ? "bg-red-500/30 text-red-300 border border-red-500/40"
                  : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                : "bg-slate-800/80 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-slate-200"
            )}
          >
            {tf.icon && <span className="mr-1">{tf.icon}</span>}
            {tf.label}
          </button>
        ))}
      </div>
      )}

      {/* Sport filters (masqués en mode calendrier foot : barre FotMob) */}
      {activeSport !== "football" && (
      <div className="flex gap-1 mb-4 overflow-x-auto scrollbar-none">
        {SPORT_FILTERS.map((sf) => {
          const count = sportCounts[sf.id] || 0;
          if (sf.id !== "all" && count === 0) return null;
          return (
            <button
              key={sf.id}
              onClick={() => setSportFilter(sf.id)}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-colors",
                sportFilter === sf.id
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "bg-slate-800/80 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-slate-200"
              )}
            >
              <span>{sf.icon}</span>
              <span>{sf.label}</span>
              {count > 0 && (
                <span className={cn(
                  "ml-0.5 px-1.5 py-0 rounded-full text-[9px] font-bold",
                  sportFilter === sf.id
                    ? "bg-white/20 text-white"
                    : "bg-slate-700 text-slate-300"
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      )}

      {/* Favoris section */}
      {favoriteMatches.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-extrabold text-white mb-2 flex items-center gap-2">
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
          <div className="rounded-xl overflow-hidden border border-slate-700/50 bg-slate-900/80 backdrop-blur-sm">
            {favoriteMatches.map((m) => (
              <MatchRow
                key={m.id}
                match={m}
                sport={m.sport}
                isFavorite
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>
        </div>
      )}

      {/* Content — onglet football : tableau calendrier réplique FotMob */}
      {activeSport === "football" ? (
        calLoading && calMatches.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm">Chargement...</div>
        ) : (
          <>
            <FotmobFilterBar
              dateKey={calDate}
              todayKey={parisTodayKey()}
              onPrevDay={() => setCalDate((k) => shiftDateKey(k, -1))}
              onNextDay={() => setCalDate((k) => shiftDateKey(k, 1))}
              onPickDate={setCalDate}
              liveOnly={calLiveOnly}
              onToggleLive={() => setCalLiveOnly((v) => !v)}
              hours={calHours}
              onHours={setCalHours}
              query={calQuery}
              onQuery={setCalQuery}
              count={filteredCal.length}
              topOnly={calTopOnly}
              onToggleTop={() => setCalTopOnly((v) => !v)}
              topCount={topCalCount}
            />
            {/* Chip résumé V1 : toujours visible, bureau + mobile. */}
            <p className="mt-1.5 text-[11px] tabular-nums" style={{ color: "#717171" }} aria-live="polite">
              {filteredCal.length} match{filteredCal.length > 1 ? "s" : ""}
              {calHours != null ? ` · ≤${calHours}h` : ""}
              {calTopOnly ? " · ★ Top" : ""}
            </p>
            <div className="mt-2">
              <FotmobCalendarTable
                matches={filteredCal}
                onSelectMatch={(m) => setDetailMatch(m as unknown as FootballMatch)}
                topTagsFor={topTagsFor}
              />
            </div>
          </>
        )
      ) : loading ? (
        <div className="text-center py-10 text-slate-400 text-sm">Chargement...</div>
      ) : filteredGroups.length === 0 ? (
        <div className="text-center py-10 text-slate-400 text-sm">Aucun match top disponible.</div>
      ) : timeFilter === "all" ? (
        /* Regroupement par jour quand filtre "Tous" */
        <div className="flex flex-col gap-4">
          {(() => {
            // Aplatir tous les matchs avec leur league, trier par kickoff
            const allMatches = filteredGroups.flatMap((g) =>
              g.matches.map((m) => ({ ...m, league: g.league, leagueIcon: g.leagueIcon, leagueColor: g.leagueColor, sport: g.sport, country: g.country }))
            ).sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());
            // Regrouper par jour
            const byDay = new Map<string, typeof allMatches>();
            for (const m of allMatches) {
              const key = getDayKey(m.kickoff);
              if (!byDay.has(key)) byDay.set(key, []);
              byDay.get(key)!.push(m);
            }
            return Array.from(byDay.entries()).map(([dayKey, dayMatches]) => (
              <div key={dayKey}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-extrabold text-white">{formatDayHeader(dayMatches[0].kickoff)}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{dayMatches.length}</span>
                  <div className="flex-1 h-px bg-slate-700" />
                </div>
                <div className="flex flex-col gap-3">
                  {(() => {
                    // Regrouper par ligue dans ce jour
                    const byLeague = new Map<string, typeof dayMatches>();
                    for (const m of dayMatches) {
                      const key = m.league;
                      if (!byLeague.has(key)) byLeague.set(key, []);
                      byLeague.get(key)!.push(m);
                    }
                    return Array.from(byLeague.entries()).map(([league, leagueMatches]) => (
                      <div key={league} className="rounded-xl overflow-hidden shadow-sm border border-[#E0D8F0] bg-white">
                        <div
                          className="flex items-center px-3 py-2 text-white font-bold text-[11px] gap-1.5"
                          style={{ background: leagueMatches[0].leagueColor }}
                        >
                          <span>{leagueMatches[0].leagueIcon}</span>
                          <span>{league}</span>
                          {leagueMatches[0].country && (
                            <span className="text-[10px] ml-1 opacity-80">
                              {countryFlag(leagueMatches[0].country)} {leagueMatches[0].country}
                            </span>
                          )}
                          <span className="ml-auto text-[10px] opacity-70">{leagueMatches.length} matchs</span>
                        </div>
                        {leagueMatches.map((m) => (
                          <MatchRow
                            key={m.id}
                            match={m}
                            sport={m.sport}
                            isFavorite={favorites.has(m.id)}
                            onToggleFavorite={toggleFavorite}
                          />
                        ))}
                      </div>
                    ));
                  })()}
                </div>
              </div>
            ));
          })()}
        </div>
      ) : (
        /* Affichage classique (filtré) */
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
      {/* Détail match (analyse BeSoccer) — ouvert au clic d'une ligne calendrier */}
      <FootballMatchDetailDialog
        match={detailMatch}
        open={detailMatch !== null}
        onOpenChange={(o) => { if (!o) setDetailMatch(null); }}
      />
    </div>
  );
}
