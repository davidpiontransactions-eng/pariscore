"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { CalendarDateNav, parisDateKey, parisDateFull } from "@/components/football/calendar-date-nav";
import { parisKickoff } from "@/lib/football-time";
import { countryFlag } from "@/lib/bsd-football-fetcher";

// ─── Types ─────────
type BSTeam = { id: string; name: string; shortName: string; logo: string; color: string };
type BSLive = { homeScore: number; awayScore: number; minute: number; status: "LIVE" | "HT" | "FT" };
type BSLeague = { id: number; name: string; country: string; logo?: string };
type BSOdds = { home: number; draw: number; away: number };

type BSTMatch = {
  id: string; scheduledAt: string; home: BSTeam; away: BSTeam;
  league?: BSLeague; competition?: string; odds?: BSOdds; live?: BSLive;
};

type LeagueGroup = { leagueId: string; leagueName: string; country: string; logo?: string; matches: BSTMatch[]; };

type MatchFilter = "all" | "live" | "scheduled" | "finished";

// ─── Helpers ─────────
const BSD_TEAM_LOGO = "https://sports.bzzoiro.com/img/team/";
const BSD_LEAGUE_LOGO = "https://sports.bzzoiro.com/img/league/";

function getStatus(m: BSTMatch): "scheduled" | "LIVE" | "HT" | "FT" {
  if (!m.live) return "scheduled";
  return m.live.status || "scheduled";
}

function isLive(m: BSTMatch): boolean {
  const s = getStatus(m); return s === "LIVE" || s === "HT";
}

function getScoreText(m: BSTMatch): string {
  return m.live?.homeScore != null && m.live?.awayScore != null
    ? `${m.live.homeScore} - ${m.live.awayScore}` : "";
}

function getTimeText(m: BSTMatch): string {
  const s = getStatus(m);
  if (s === "FT") return "FT";
  if (s === "HT") return "MT";
  if (s === "LIVE") return `${m.live!.minute}'`;
  return parisKickoff(m.scheduledAt);
}

function teamLogoUrl(m: BSTMatch, side: "home" | "away"): string {
// ══════════════════════════════════════════
//  FotMob-style League Header
// ══════════════════════════════════════════

function FotMobLeagueHeader({
  league, matchCount, isCollapsed, onToggle,
}: {
  league: LeagueGroup; matchCount: number; isCollapsed: boolean; onToggle: () => void;
}) {
  return (
    <div className="group relative flex items-center justify-between overflow-hidden h-11 bg-slate-800/60 border border-slate-700/40 rounded-lg">
      <button type="button" onClick={onToggle}
        className="relative flex h-full w-full items-center gap-3 px-4 transition-colors hover:bg-slate-700/40 text-left"
      >
        <div className="shrink-0 text-lg">
          {league.country ? countryFlag(league.country) : "🏆"}
        </div>
        <span className="text-xs font-medium md:text-sm text-slate-200 truncate">
          {league.country ? `${league.country} - ${league.leagueName}` : league.leagueName}
        </span>
      </button>
      <div className="overflow-hidden transition-all duration-300 max-w-0 opacity-0 group-hover:max-w-[40px] group-hover:opacity-100">
        <span className="flex min-w-5 items-center justify-center rounded-xl px-1.5 py-0.5 text-[11px] font-medium text-white bg-slate-600">
          {matchCount}
        </span>
      </div>
      <button type="button" onClick={onToggle}
        className="relative flex h-full items-center rounded-sm px-3 transition-all hover:bg-slate-700/40"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none"
          className={cn("size-5 shrink-0 fill-current text-slate-400 transition-transform duration-300",
            !isCollapsed ? "rotate-0" : "rotate-180")}>
          <path d="M5.59613 11.0529L9.04513 7.59989C9.16849 7.47628 9.315 7.37822 9.4763 7.31131C9.6376 7.2444 9.81051 7.20996 9.98513 7.20996C10.1598 7.20996 10.3327 7.2444 10.494 7.31131C10.6553 7.37822 10.8018 7.47628 10.9251 7.59989L14.3781 11.0529C14.5644 11.2401 14.691 11.4783 14.7421 11.7374C14.7932 11.9964 14.7664 12.2649 14.6651 12.5087C14.5638 12.7526 14.3925 12.961 14.1729 13.1077C13.9533 13.2544 13.6952 13.3327 13.4311 13.3329H6.52513C6.26195 13.3306 6.00532 13.2505 5.78754 13.1027C5.56976 12.955 5.40056 12.746 5.30125 12.5023C5.20194 12.2586 5.17695 11.9909 5.22942 11.733C5.28189 11.4751 5.40948 11.2384 5.59613 11.0529Z"/>
        </svg>
      </button>
    </div>
  );
}
  const t = side === "home" ? m.home : m.away;
  if (t.logo) return t.logo;
  if (t.id) return `${BSD_TEAM_LOGO}${t.id}/`;
  return `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(t.name)}&backgroundType=gradientLinear`;
}
placeholder