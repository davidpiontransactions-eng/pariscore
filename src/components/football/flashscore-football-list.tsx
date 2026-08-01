"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { FootballMatch } from "@/lib/football-data";
import {
  FlashscoreMatchList,
  FlashscoreSkeleton,
  type FlashscoreLeague,
  type FlashscoreMatchRow,
} from "@/components/shared/flashscore-match-list";

type Props = {
  matches: FootballMatch[];
  favoriteIds?: Set<string>;
  onToggleFavorite?: (matchId: string) => void;
  onOpenDetail?: (match: FootballMatch) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
};

/** Formatte l'heure locale à partir d'un ISO timestamp. */
function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "??:??";
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "??:??";
  }
}

/** Formatte le score football (score live principal). */
function formatFootballScore(match: FootballMatch): string {
  if (match.live) {
    const ls = match.live;
    if (ls.status === "FT") return `${ls.homeScore} - ${ls.awayScore}`;
    if (ls.status === "HT") return `(MT) ${ls.homeScore} - ${ls.awayScore}`;
    if (ls.status === "LIVE") return `${ls.homeScore} - ${ls.awayScore}`;
    return `${ls.homeScore} - ${ls.awayScore}`;
  }
  return "-";
}

/** Formatte le statut détaillé (minute, période). */
function formatFootballStatus(match: FootballMatch): string | undefined {
  if (!match.live) return undefined;
  const ls = match.live;
  if (ls.status === "HT") return "Mi-temps";
  if (ls.status === "LIVE") {
    const period = ls.period === "2H" ? "2e" : ls.period === "1H" ? "1ère" : "";
    return `${ls.minute}'${period ? ` (${period})` : ""}`;
  }
  return undefined;
}

/** Formatte les cotes 1X2 courtes pour le foot. */
function formatFootballOdds(match: FootballMatch): string | null {
  if (!match.odds) return null;
  return `${match.odds.home.toFixed(2)} / ${match.odds.draw.toFixed(2)} / ${match.odds.away.toFixed(2)}`;
}

/** Priorité de ligue pour le tri (T1 en haut). */
function leaguePriority(tier: string): number {
  switch (tier) {
    case "T1": return 0;
    case "T2": return 1;
    case "CUP": return 2;
    default: return 3;
  }
}

export function FlashscoreFootballList({
  matches,
  favoriteIds,
  onToggleFavorite,
  onOpenDetail,
  isLoading,
  error,
  onRetry,
  className,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");

  // Grouper par ligue
  const leagues = useMemo(() => {
    const map = new Map<string, {
      league: FlashscoreLeague;
      tier: string;
      matches: FlashscoreMatchRow[];
    }>();

    for (const m of matches) {
      const leagueId = m.league.id;
      if (!map.has(leagueId)) {
        map.set(leagueId, {
          league: {
            id: leagueId,
            name: `${m.league.country ? m.league.country.toUpperCase() + " : " : ""}${m.league.name}`,
            country: m.league.country ?? null,
            logo: m.league.logo,
          },
          tier: m.league.tier,
          matches: [],
        });
      }

      const isLive = m.live?.status === "LIVE" || m.live?.status === "HT";
      const row: FlashscoreMatchRow = {
        id: m.id,
        timeDisplay: isLive ? "" : formatTime(m.scheduledAt),
        isLive,
        statusDetail: formatFootballStatus(m),
        homeName: m.home.name,
        awayName: m.away.name,
        homeRank: m.home.rank || null,
        awayRank: m.away.rank || null,
        scoreDisplay: formatFootballScore(m),
        oddsDisplay: formatFootballOdds(m),
      };

      map.get(leagueId)!.matches.push(row);
    }

    // Trier par tier puis par nom, strip `tier` après le tri
    return [...map.values()]
      .sort((a, b) => leaguePriority(a.tier) - leaguePriority(b.tier) || a.league.name.localeCompare(b.league.name))
      .map(({ league, matches }) => ({ league, matches }));
  }, [matches]);

  const liveCount = matches.filter((m) => m.live?.status === "LIVE" || m.live?.status === "HT").length;
  const favCount = favoriteIds ? matches.filter((m) => favoriteIds.has(m.id)).length : 0;
  const valueCount = matches.filter((m) => m.odds != null).length;

  if (isLoading) {
    return <FlashscoreSkeleton />;
  }

  return (
    <div className={cn(className)}>
      <FlashscoreMatchList
        leagues={leagues}
        liveCount={liveCount}
        favCount={favCount}
        valueCount={valueCount}
        favoriteIds={favoriteIds}
        onToggleFavorite={onToggleFavorite}
        onOpenDetail={(id) => {
          const match = matches.find((m) => m.id === id);
          if (match) onOpenDetail?.(match);
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
        sportLabel="Football"
      />
    </div>
  );
}
