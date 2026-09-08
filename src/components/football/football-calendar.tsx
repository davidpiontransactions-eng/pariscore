"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { resolvePlayerPhoto } from "@/lib/player-photos";
import { CalendarDateNav, parisDateKey, parisDateFull } from "@/components/football/calendar-date-nav";
import { parisKickoff } from "@/lib/football-time";
import { countryFlag } from "@/lib/bsd-football-fetcher";
import { Trophy } from "lucide-react";

type LeagueGroup = {
  leagueId: string;
  leagueName: string;
  country: string;
  logo?: string;
  matches: BSTMatch[];
};

function isLive(m: BSTMatch): boolean {
  return m.live?.status === "LIVE" || m.live?.status === "HT";
}
function formatScore(m: BSTMatch): string {
  return m.live?.homeScore != null && m.live?.awayScore != null
    ? `${m.live.homeScore} - ${m.live.awayScore}` : "";
}

function LeagueHeader({ league, matchCount, isCollapsed, onToggle }: {
  league: LeagueGroup; matchCount: number; isCollapsed: boolean; onToggle: () => void;
}) {
  return (
    <button type="button" onClick={onToggle}
      className="flex w-full items-center gap-2 rounded-xl px-4 py-3 bg-slate-900/50 border border-slate-800/40 hover:bg-slate-800/40 transition-colors text-left group"
    >
      <span className="text-lg shrink-0">{league.country ? countryFlag(league.country) : "🏆"}</span>
      <span className="flex-1 text-sm font-bold text-slate-100 truncate">{league.leagueName}</span>
      <Badge variant="outline" className="text-[10px] text-slate-500 border-slate-700">{matchCount}</Badge>
      <span className="text-slate-500 text-xs">{isCollapsed ? "▶" : "▼"}</span>
    </button>
  );
}

function MatchRow({ match }: { match: BSTMatch }) {
  const live = isLive(match);
  const score = formatScore(match);
  const hasOdds = match.odds && match.odds.home > 1;

  return (
    <div onClick={() => window.dispatchEvent(new CustomEvent("open-match-detail", { detail: { sport: "football", matchId: match.id } }))}
      className={cn(
        "group relative rounded-xl border transition-all cursor-pointer flex items-center gap-3 px-4 py-3",
        live ? "bg-gradient-to-r from-rose-500/5 via-slate-900/80 to-slate-900/80 border-rose-500/20 hover:border-rose-500/30"
          : "bg-slate-900/40 border-slate-800/40 hover:border-slate-700/60 hover:bg-slate-800/40",
      )}
    >
      {/* Time */}
      <div className="w-14 shrink-0 text-center">
        {live ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-bold text-rose-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full scale-150 animate-pulse-soft rounded-full bg-rose-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
            </span>
            {match.live?.minute}&apos;
          </span>
        ) : (
          <span className="text-[13px] font-mono font-bold tabular-nums text-slate-300">
            {parisKickoff(match.scheduledAt)}
          </span>
        )}
      </div>

      {/* Home */}
      <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
        <span className="text-sm font-medium text-slate-200 truncate text-right max-w-[120px]">{match.home.shortName || match.home.name}</span>
        <PlayerAvatar name={match.home.name} photoUrl={resolvePlayerPhoto(match.home.name)} size="xs" sport="football" className="shrink-0" />
      </div>

      {/* Score */}
      <div className="w-20 shrink-0 text-center">
        {score ? (
          <span className={cn("text-xl font-black font-mono tabular-nums leading-none", live ? "text-rose-400" : "text-slate-100")}>{score}</span>
        ) : (
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">VS</span>
        )}
      </div>

      {/* Away */}
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <PlayerAvatar name={match.away.name} photoUrl={resolvePlayerPhoto(match.away.name)} size="xs" sport="football" className="shrink-0" />
        <span className="text-sm font-medium text-slate-200 truncate max-w-[120px]">{match.away.shortName || match.away.name}</span>
      </div>

      {/* Odds */}
      <div className="hidden sm:flex items-center gap-1.5 shrink-0">
        {hasOdds ? (
          <>
            <span className="rounded-md px-2 py-1 text-[11px] font-bold font-mono tabular-nums bg-slate-800/60 text-slate-300 border border-slate-700/50">
              {match.odds!.home.toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-600 font-mono">{match.odds!.draw.toFixed(2)}</span>
            <span className="rounded-md px-2 py-1 text-[11px] font-bold font-mono tabular-nums bg-slate-800/60 text-slate-300 border border-slate-700/50">
              {match.odds!.away.toFixed(2)}
            </span>
          </>
        ) : <span className="text-[11px] text-slate-600">—</span>}
      </div>
    </div>
  );
}
type BSTMatch = {
  id: string;
  scheduledAt: string;
  status: string;
  home: { id: string; name: string; shortName: string; logo: string; color: string };
  away: { id: string; name: string; shortName: string; logo: string; color: string };
  league?: { id: number; name: string; country: string; logo?: string };
  competition?: string;
  odds?: { home: number; draw: number; away: number };
  live?: { homeScore: number; awayScore: number; minute: number; status: "LIVE" | "HT" | "FT" };
};

export function FootballCalendar({ className }: { className?: string }) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const dateKey = parisDateKey(selectedDate);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const { data, isValidating, error } = useSWR<{ matches: BSTMatch[]; source: string; degraded: boolean }>(
    `/api/football/calendar?date=${dateKey}`,
    { refreshInterval: 15_000, revalidateOnFocus: true, dedupingInterval: 10_000, keepPreviousData: true },
  );

  const toggle = (id: string) => {
    setCollapsed((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const leagues = useMemo<LeagueGroup[]>(() => {
    if (!data?.matches) return [];
    const map = new Map<string, LeagueGroup>();
    for (const m of data.matches) {
      const lid = m.league ? `${m.league.country || "INT"}:${m.league.name}` : m.competition || "unknown";
      if (!map.has(lid)) {
        map.set(lid, { leagueId: lid, leagueName: m.league?.name || m.competition || "?",
          country: m.league?.country || "", matches: [] });
      }
      map.get(lid)!.matches.push(m);
    }
    const sorted = Array.from(map.values()).sort((a, b) => {
      const aL = a.matches.some(isLive), bL = b.matches.some(isLive);
      return aL !== bL ? (aL ? -1 : 1) : b.matches.length - a.matches.length;
    });
    for (const lg of sorted) {
      lg.matches.sort((a, b) => (isLive(a) !== isLive(b) ? (isLive(a) ? -1 : 1)
        : new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()));
    }
    return sorted;
  }, [data]);

  const liveCount = useMemo(() => data?.matches?.filter(isLive).length ?? 0, [data]);

  if (isValidating && !data) {
    return <section className={cn("space-y-3", className)}>
      <div className="flex gap-2 pb-2 overflow-x-auto">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-14 rounded-xl shrink-0" />)}</div>
      <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
    </section>;
  }

  return (
    <section className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-100">Calendrier Football</h2>
          <p className="text-xs text-slate-500">{parisDateFull(selectedDate)}</p>
        </div>
        <Badge variant="outline" className={cn("text-xs", liveCount > 0
          ? "border-rose-500/30 text-rose-400 bg-rose-500/10" : "text-slate-500 border-slate-700")}>
          <span className={cn("inline-block h-1.5 w-1.5 rounded-full mr-1.5", liveCount > 0 ? "bg-rose-500 animate-pulse-soft" : "bg-slate-500")} />
          {liveCount} en direct
        </Badge>
      </div>

      <CalendarDateNav selectedDate={selectedDate} onSelect={setSelectedDate} />

      {error && <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2 text-xs text-amber-400">Données indisponibles...</div>}

      {leagues.length === 0 && !isValidating ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 p-12 text-center">
          <Trophy className="h-8 w-8 text-slate-600 mb-2" />
          <p className="text-sm text-slate-500">Aucun match programmé</p>
          <p className="text-xs text-slate-600 mt-1">Sélectionne une autre date</p>
        </div>
      ) : (
        <div className="space-y-2">
          {leagues.map((lg) => {
            const isCollapsed = collapsed.has(lg.leagueId);
            return (
              <div key={lg.leagueId} className="space-y-1">
                <LeagueHeader league={lg} matchCount={lg.matches.length} isCollapsed={isCollapsed} onToggle={() => toggle(lg.leagueId)} />
                {!isCollapsed && (
                  <div className="space-y-1 pl-2 pr-2">
                    {lg.matches.filter(isLive).length > 0 && (
                      <div className="flex items-center gap-2 px-2 py-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500">En direct</span>
                        <Badge className="bg-rose-500/15 text-rose-400 border-rose-500/20 text-[10px]">{lg.matches.filter(isLive).length}</Badge>
                      </div>
                    )}
                    {lg.matches.map((m) => <MatchRow key={m.id} match={m} />)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-center text-[11px] text-slate-600">
        {leagues.length} compétitions · {data?.matches?.length ?? 0} matchs · {data?.source ?? "—"}
      </p>
    </section>
  );
}