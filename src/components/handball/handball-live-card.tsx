"use client";

import type { HandballMatch } from "@/lib/handball-data";
import { HandballLeagueBadge } from "@/components/handball/handball-league-badge";
import { HandballTeamLogo } from "@/components/handball/handball-team-logo";

export function HandballLiveCard({ match }: { match: HandballMatch }) {
  const isLive = match.status === "live" || match.status === "halftime";
  if (!isLive) return null;

  return (
    <div className="rounded-lg border-2 border-red-500/50 bg-card p-3 relative">
      <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded animate-pulse">
        {match.status === "halftime" ? "MT" : `${match.minute || 0}'`}
      </span>

      <div className="text-xs text-muted-foreground mb-2">
        <HandballLeagueBadge leagueName={match.league.name} country={match.league.country} />
      </div>

      <div className="flex items-center justify-between">
        <span className="font-medium text-sm flex-1 inline-flex items-center gap-1.5 min-w-0">
          <HandballTeamLogo name={match.home.name} size={20} />
          <span className="truncate">{match.home.name}</span>
        </span>
        {/* Score live : classe charte .score-hero (Archivo bold, tabular-nums) */}
        <span className="score-hero font-mono mx-3">
          {match.score?.home ?? 0} - {match.score?.away ?? 0}
        </span>
        <span className="font-medium text-sm flex-1 text-right inline-flex items-center justify-end gap-1.5 min-w-0">
          <span className="truncate">{match.away.name}</span>
          <HandballTeamLogo name={match.away.name} size={20} />
        </span>
      </div>

      {match.score?.homeHalf != null && (
        <div className="text-xs text-muted-foreground text-center mt-1">
          MT: {match.score.homeHalf} - {match.score.awayHalf}
        </div>
      )}

      {match.stats && (
        <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
          {match.stats.home7m != null && (
            <div className="flex justify-between">
              <span>7m</span>
              <span>
                {match.stats.home7m} - {match.stats.away7m}
              </span>
            </div>
          )}
          {match.stats.homeSaves != null && (
            <div className="flex justify-between">
              <span>Arrêts</span>
              <span>
                {match.stats.homeSaves} - {match.stats.awaySaves}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
