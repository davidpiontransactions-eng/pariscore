"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Search, ChevronDown } from "lucide-react";
import { CalendarDateNav, parisDateKey, parisDateFull } from "@/components/football/calendar-date-nav";
import { parisKickoff } from "@/lib/football-time";
import { FollowButton } from "@/components/shared/follow-button";
import { countryFlag } from "@/lib/bsd-football-fetcher";

type BSTeam = { id: string; name: string; shortName?: string; logo?: string; color?: string };
type BSLive = { homeScore?: number; awayScore?: number; minute?: number; status?: string };
type BSLeague = { id?: number; name: string; country?: string; logo?: string };
type BSOdds = { home?: number; draw?: number; away?: number };

type BSTMatch = {
  id: string; scheduledAt: string; home: BSTeam; away: BSTeam;
  league?: BSLeague; competition?: string; odds?: BSOdds; live?: BSLive;
};

type LeagueGroup = { leagueId: string; leagueName: string; country: string; logo?: string; matches: BSTMatch[] };

const BSD_TEAM_LOGO = "https://sports.bzzoiro.com/img/team/";

function getStatus(m: BSTMatch): string {
  if (!m.live) return "scheduled";
  const s = m.live.status || "scheduled";
  if (s === "scheduled" || s === "notstarted") return "scheduled";
  return s;
}
function isLive(m: BSTMatch): boolean { const s = getStatus(m); return s === "LIVE" || s === "HT"; }
function getScoreText(m: BSTMatch): string {
  return m.live && m.live.homeScore != null && m.live.awayScore != null
    ? m.live.homeScore + " - " + m.live.awayScore : "";
}
function getTimeText(m: BSTMatch): string {
  const s = getStatus(m);
  if (s === "FT") return "Terminé";
  if (s === "HT") return "MT";
  if (s === "LIVE") return m.live && m.live.minute != null ? m.live.minute + "'" : "En direct";
  return parisKickoff(m.scheduledAt);
}
function teamLogoUrl(m: BSTMatch, side: string): string {
  const t = side === "home" ? m.home : m.away;
  if (t.logo) return t.logo;
  if (t.id) return BSD_TEAM_LOGO + t.id + "/";
  return "https://api.dicebear.com/9.x/initials/svg?seed=" + encodeURIComponent(t.name) + "&backgroundType=gradientLinear";
}

function FotMobLeagueHeader({
  league, matchCount, liveCount, isCollapsed, onToggle,
}: {
  league: LeagueGroup; matchCount: number; liveCount: number; isCollapsed: boolean; onToggle: () => void;
}) {
  return (
    <div className="group relative flex items-center justify-between overflow-hidden h-12 bg-slate-800/60 border border-slate-700/40 rounded-lg">
      <button type="button" onClick={onToggle} aria-expanded={!isCollapsed}
        className="relative flex h-full w-full items-center gap-3 px-4 transition-colors hover:bg-slate-700/40 text-left">
        <div className="shrink-0">
          {league.logo ? (
            <img src={league.logo} alt="" width="20" height="20" loading="lazy" className="size-5 shrink-0 rounded-full" />
          ) : (
            <span className="text-lg">{league.country ? countryFlag(league.country) : "🏆"}</span>
          )}
        </div>
        <span className="text-xs font-medium md:text-sm text-slate-200 truncate">
          {league.country ? league.country + " - " + league.leagueName : league.leagueName}
        </span>
      </button>
      <div className="flex items-center gap-1 px-2">
        <span className={cn(
          "flex min-w-5 items-center justify-center rounded-xl px-1.5 py-0.5 text-[11px] font-medium text-white tabular-nums",
          liveCount > 0 ? "bg-emerald-600" : "bg-slate-600"
        )}>
          {liveCount > 0 ? liveCount + "/" + matchCount : matchCount}
        </span>
      </div>
      <button type="button" onClick={onToggle}
        className="relative flex h-full items-center rounded-sm px-3 transition-colors hover:bg-slate-700/40 motion-reduce:transition-none"
        aria-expanded={!isCollapsed} aria-label={isCollapsed ? "Déployer" : "Réduire"}>
        <ChevronDown className={cn("size-5 shrink-0 fill-current text-slate-400 transition-transform duration-300 motion-reduce:transition-none", isCollapsed ? "" : "rotate-180")} />
      </button>
    </div>
  );
}

function MatchRow({ m }: { m: BSTMatch }) {
  const live = isLive(m);
  const score = getScoreText(m);
  const label = m.home.name + " - " + m.away.name;
  return (
    <div className="grid grid-cols-[1fr_auto_auto_1fr_auto] items-center gap-1 px-3 py-1.5 text-[13px] transition-colors hover:bg-slate-800/60">
      <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
        <span className="truncate text-right font-medium text-slate-200">{m.home.name}</span>
        <img src={teamLogoUrl(m, "home")} alt="" width="20" height="20" loading="lazy"
          className="size-5 shrink-0 rounded-full" />
      </div>
      {/* Minute live (pastille FotMob) — cellule vide sinon pour garder l'alignement */}
      <span className="w-7 shrink-0 text-center text-[11px] font-semibold tabular-nums text-emerald-400">
        {live && m.live?.minute != null ? m.live.minute + "’" : ""}
      </span>
      <div className="flex w-14 shrink-0 flex-col items-center tabular-nums">
        {live && score ? (
          <span className="text-sm font-bold text-white">{score}</span>
        ) : (
          <span className="text-xs font-semibold text-slate-300">{getTimeText(m)}</span>
        )}
      </div>
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <img src={teamLogoUrl(m, "away")} alt="" width="20" height="20" loading="lazy"
          className="size-5 shrink-0 rounded-full" />
        <span className="truncate font-medium text-slate-200">{m.away.name}</span>
      </div>
      <FollowButton
        id={m.id}
        name={label}
        category="match"
        sport="football"
        size="sm"
        className="shrink-0"
      />
    </div>
  );
}

type MatchFilter = "all" | "live" | "scheduled" | "finished";

export function FootballCalendar() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [filter, setFilter] = useState<MatchFilter>("all");
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const dateKey = parisDateKey(selectedDate);

  const { data, isValidating } = useSWR(
    "/api/football/calendar?date=" + dateKey,
    (url: string) => fetch(url).then((r) => r.json()),
    { refreshInterval: 60000, revalidateOnFocus: false }
  );

  const matches: BSTMatch[] = useMemo(() => (data as { matches?: BSTMatch[] })?.matches ?? [], [data]);

  const filtered = useMemo(() => {
    let out = matches;
    if (filter === "live") out = out.filter(isLive);
    else if (filter === "scheduled") out = out.filter((m) => getStatus(m) === "scheduled");
    else if (filter === "finished") out = out.filter((m) => getStatus(m) === "FT");
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      out = out.filter((m) => m.home.name.toLowerCase().includes(q) || m.away.name.toLowerCase().includes(q));
    }
    return out;
  }, [matches, filter, query]);

  const groups = useMemo(() => {
    const map: Record<string, LeagueGroup> = {};
    for (const m of filtered) {
      const key = m.league ? String(m.league.id ?? m.league.name) : "other";
      if (!map[key]) {
        map[key] = {
          leagueId: key,
          leagueName: m.league?.name || m.competition || "Autres ligues",
          country: m.league?.country || "",
          logo: m.league?.logo,
          matches: [],
        };
      }
      map[key].matches.push(m);
    }
    return Object.values(map).sort((a, b) => {
      const al = a.matches.filter(isLive).length;
      const bl = b.matches.filter(isLive).length;
      if (al !== bl) return bl - al;
      return a.leagueName.localeCompare(b.leagueName);
    });
  }, [filtered]);

  const liveCount = matches.filter(isLive).length;
  // Repli global (façon FotMob « Tout masquer ») : bascule toutes les ligues.
  const allCollapsed = groups.length > 0 && groups.every((g) => collapsed[g.leagueId] === true);
  const toggleAll = () => {
    if (allCollapsed) setCollapsed({});
    else setCollapsed(Object.fromEntries(groups.map((g) => [g.leagueId, true])));
  };
  const scheduledCount = matches.filter((m) => getStatus(m) === "scheduled").length;
  const counts: Record<MatchFilter, number> = {
    all: matches.length, live: liveCount, scheduled: scheduledCount, finished: matches.length - liveCount - scheduledCount,
  };
  const filters: { key: MatchFilter; label: string }[] = [
    { key: "all", label: "Tous" },
    { key: "live", label: "● En direct" },
    { key: "scheduled", label: "À venir" },
    { key: "finished", label: "Terminés" },
  ];

  return (
    <div className="w-full">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="inline-block size-2 rounded-full bg-emerald-400"></span>
          Calendrier Football
        </h2>
        <CalendarDateNav selectedDate={selectedDate} onSelect={setSelectedDate} />
        <p className="text-xs text-slate-400">{parisDateFull(selectedDate)}</p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <button key={f.key} type="button" onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              filter === f.key ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30"
                : "bg-slate-900/60 text-slate-400 border border-slate-700/40 hover:bg-slate-800"
            )}>
            {f.label} <span className="opacity-70">({counts[f.key]})</span>
          </button>
        ))}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une équipe…" aria-label="Filtrer matchs"
            className="pl-8 pr-3 py-1 text-xs rounded-full bg-slate-900/60 border border-slate-700/40 text-slate-300 placeholder:text-slate-600 w-48" />
        </div>
      </div>

      {isValidating && groups.length === 0 ? (
        <div className="mt-4 space-y-2">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : groups.length === 0 ? (
        <div className="mt-8 text-center py-10">
          <div className="text-5xl mb-2">🗓</div>
          <p className="text-slate-400">Aucun match pour cette journée.</p>
        </div>
      ) : (
        <>
          <div className="mt-3 flex justify-end">
            <button type="button" onClick={toggleAll} aria-expanded={!allCollapsed}
              className="text-xs font-medium text-slate-400 underline underline-offset-2 transition-colors hover:text-slate-200">
              {allCollapsed ? "Tout afficher" : "Tout masquer"}
            </button>
          </div>
          <div className="mt-2 space-y-1">
          {groups.map((g) => {
            const isCollapsed = collapsed[g.leagueId] === true;
            return (
              <section key={g.leagueId} data-testid="livescores-league"
                className="mb-1 rounded-lg overflow-hidden border border-slate-800/40 bg-slate-950/50 content-auto [contain-intrinsic-size:auto_300px]">
                <FotMobLeagueHeader
                  league={g}
                  matchCount={g.matches.length}
                  liveCount={g.matches.filter(isLive).length}
                  isCollapsed={isCollapsed}
                  onToggle={() => setCollapsed((prev) => ({ ...prev, [g.leagueId]: !isCollapsed }))}
                />
                <div className={cn(
                  "grid transition-[grid-template-rows] ease-out motion-reduce:transition-none",
                  isCollapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]"
                )} style={{ transitionDuration: "300ms" }}>
                  <div className="min-h-0 overflow-hidden">
                    {g.matches.map((m) => <MatchRow key={m.id} m={m} />)}
                  </div>
                </div>
              </section>
            );
          })}
          </div>
        </>
      )}
    </div>
  );
}
