"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { TennisMatch } from "@/lib/tennis-data";
import type { LiveMatchState } from "@/hooks/use-live-matches";
import { useBrowserTimeZone } from "@/lib/tennis-format";
import {
  FlashscoreMatchList,
  FlashscoreSkeleton,
  type FlashscoreLeague,
  type FlashscoreMatchRow,
} from "@/components/shared/flashscore-match-list";

type Props = {
  matches: TennisMatch[];
  liveStates?: Record<string, LiveMatchState>;
  favoriteIds?: Set<string>;
  onToggleFavorite?: (matchId: string) => void;
  onOpenDetail?: (match: TennisMatch) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onRefresh?: () => void;
  initialFilter?: import("@/components/shared/flashscore-match-list").FlashscoreFilter;
  className?: string;
};

/** Formatte l'heure dans la timezone passée (bug B7 : sans timeZone, le
 * rendu serveur tombait en UTC et affichait une heure fausse). */
function formatTime(iso: string, timeZone: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "??:??";
    return new Intl.DateTimeFormat("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
    }).format(d);
  } catch {
    return "??:??";
  }
}

/** Formatte le score tennis en une chaîne set-par-set (ex: "6-4, 3-6, 4-2*"). */
function formatTennisScore(
  liveState: LiveMatchState | undefined,
  isLive: boolean,
): string {
  if (!liveState || !isLive) return "";

  const setsA = liveState.scoreA.sets;
  const setsB = liveState.scoreB.sets;
  const maxSets = Math.max(setsA.length, setsB.length);

  if (maxSets === 0 && liveState.currentSet > 0) {
    // Match en cours, pas de sets terminés encore — afficher le score du jeu
    const gA = liveState.scoreA.games;
    const gB = liveState.scoreB.games;
    return `${gA}-${gB}*`;
  }

  const parts: string[] = [];
  for (let i = 0; i < maxSets; i++) {
    const a = setsA[i] ?? 0;
    const b = setsB[i] ?? 0;
    if (i === liveState.currentSet - 1 && liveState.scoreA.games + liveState.scoreB.games > 0) {
      // Set en cours : inclure le score du jeu en cours
      const gA = liveState.scoreA.games;
      const gB = liveState.scoreB.games;
      parts.push(`${a}-${b} (${gA}-${gB}*)`);
    } else {
      parts.push(`${a}-${b}`);
    }
  }
  return parts.join(", ");
}

/** Formatte les cotes courtes (12) pour le tennis. */
function formatTennisOdds(match: TennisMatch): string | null {
  if (!match.odds) return null;
  if (match.odds.decimalA == null || match.odds.decimalB == null) return null;
  return `${match.odds.decimalA.toFixed(2)} / ${match.odds.decimalB.toFixed(2)}`;
}

export function FlashscoreTennisList({
  matches,
  liveStates,
  favoriteIds,
  onToggleFavorite,
  onOpenDetail,
  isLoading,
  error,
  onRetry,
  onRefresh,
  initialFilter,
  className,
}: Props) {
  const browserTimeZone = useBrowserTimeZone();

  // Grouper par tournoi
  const leagues = useMemo(() => {
    const timeZone = browserTimeZone;
    const map = new Map<string, { league: FlashscoreLeague; matches: FlashscoreMatchRow[] }>();

    for (const m of matches) {
      const tournamentId = m.tournament.replace(/\s+/g, "_").toLowerCase();
      if (!map.has(tournamentId)) {
        map.set(tournamentId, {
          league: {
            id: tournamentId,
            name: m.tournament,
            country: m.playerA.country ?? m.playerB.country ?? null,
          },
          matches: [],
        });
      }

      const ls = liveStates?.[m.id];
      const isLive = ls?.isLive ?? false;
      const server = ls?.server?.toLowerCase() === "a" ? "home" as const
        : ls?.server?.toLowerCase() === "b" ? "away" as const : null;

      const row: FlashscoreMatchRow = {
        id: m.id,
        timeDisplay: isLive ? "" : formatTime(m.scheduledAt, timeZone),
        scheduledAt: m.scheduledAt,
        isLive,
        statusDetail: isLive
          ? (ls && ls.currentSet > 0 ? `Set ${ls.currentSet}` : "LIVE")
          : undefined,
        homeName: m.playerA.name,
        awayName: m.playerB.name,
        homeRank: m.playerA.rank || m.playerA.atpRank || m.playerA.wtaRank || null,
        awayRank: m.playerB.rank || m.playerB.atpRank || m.playerB.wtaRank || null,
        server,
        scoreDisplay: formatTennisScore(ls, isLive),
        oddsDisplay: formatTennisOdds(m),
      };

      map.get(tournamentId)!.matches.push(row);
    }

    // Pré-calculer la map de priorité (évite O(n²) via .find() dans le comparateur)
    const priorityMap = new Map<string, number>();
    for (const m of matches) {
      priorityMap.set(m.tournament.replace(/\s+/g, "_").toLowerCase(), m.tournamentPriority ?? 10);
    }

    // Trier par priorité tournoi
    return [...map.values()].sort((a, b) => {
      const pa = priorityMap.get(a.league.id) ?? 10;
      const pb = priorityMap.get(b.league.id) ?? 10;
      return pa - pb;
    });
  }, [matches, liveStates, browserTimeZone]);

  // Compteurs
  const liveCount = useMemo(
    () => matches.filter((m) => liveStates?.[m.id]?.isLive).length,
    [matches, liveStates],
  );
  const favCount = favoriteIds ? matches.filter((m) => favoriteIds.has(m.id)).length : 0;
  const valueCount = matches.filter((m) => m.odds != null).length;
  const upcomingCount = useMemo(() => {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    return matches.filter((m) => {
      if (!m.scheduledAt) return false;
      const t = new Date(m.scheduledAt).getTime();
      return t > now && t <= now + oneHour;
    }).length;
  }, [matches]);

  const [searchQuery, setSearchQuery] = useState("");

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
        upcomingCount={upcomingCount}
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
        onRefresh={onRefresh}
        initialFilter={initialFilter}
        sportLabel="Tennis"
      />
    </div>
  );
}
