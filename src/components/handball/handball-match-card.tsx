"use client";

import type { HandballMatch } from "@/lib/handball-data";
import type { VitibetTip } from "@/lib/vitibet/types";
import { fmtIndex, indexTone } from "@/lib/vitibet/format";
import { HandballLeagueBadge } from "@/components/handball/handball-league-badge";
import { HandballTeamLogo } from "@/components/handball/handball-team-logo";

const INDEX_CHIP_CLASS: Record<ReturnType<typeof indexTone>, string> = {
  home: "bg-emerald-500/10 text-emerald-600",
  away: "bg-red-500/10 text-red-600",
  neutral: "bg-muted text-muted-foreground",
};

export function HandballMatchCard({
  match,
  onClick,
  tip,
}: {
  match: HandballMatch;
  /** Fix wiring UX : ouvre le dialog détail au clic */
  onClick?: (match: HandballMatch) => void;
  /** Pronostic Vitibet rapproché (badge INDEX + probas) — absent si non matché. */
  tip?: VitibetTip | null;
}) {
  return (
    // Carte cliquable accessible : bouton natif (clavier Enter/Espace inclus)
    <button
      type="button"
      className="rounded-lg border bg-card p-3 hover:shadow-md transition-shadow cursor-pointer hover:border-primary/30 focus-visible:ring-2 ring-[#00e676] text-left w-full"
      onClick={() => onClick?.(match)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick?.(match);
      }}
    >
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
        <HandballLeagueBadge leagueName={match.league.name} country={match.league.country} />
        <span>
          {new Date(match.kickoff).toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Europe/Paris",
          })}
        </span>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm inline-flex items-center gap-1.5 min-w-0">
            <HandballTeamLogo name={match.home.name} size={18} />
            <span className="truncate">{match.home.name}</span>
          </span>
          {match.odds?.home && (
            // Cote : chasse fixe pour alignement vertical
            <span className="text-xs bg-muted px-2 py-0.5 rounded font-mono tabular-nums">
              {match.odds.home}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm inline-flex items-center gap-1.5 min-w-0">
            <HandballTeamLogo name={match.away.name} size={18} />
            <span className="truncate">{match.away.name}</span>
          </span>
          {match.odds?.away && (
            // Cote : chasse fixe pour alignement vertical
            <span className="text-xs bg-muted px-2 py-0.5 rounded font-mono tabular-nums">
              {match.odds.away}
            </span>
          )}
        </div>
      </div>

      {match.odds && (
        <div className="flex gap-1 mt-2">
          {match.odds.home && (
            <span className="flex-1 text-center text-xs bg-emerald-500/10 text-emerald-600 rounded py-0.5 font-mono tabular-nums">
              1 {match.odds.home}
            </span>
          )}
          {match.odds.draw && (
            <span className="flex-1 text-center text-xs bg-yellow-500/10 text-yellow-600 rounded py-0.5 font-mono tabular-nums">
              X {match.odds.draw}
            </span>
          )}
          {match.odds.away && (
            <span className="flex-1 text-center text-xs bg-blue-500/10 text-blue-600 rounded py-0.5 font-mono tabular-nums">
              2 {match.odds.away}
            </span>
          )}
        </div>
      )}

      {/* Vitibet : badge INDEX (vert favori domicile / rouge extérieur) + probas 1/X/2 */}
      {tip && (
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 mt-2 text-[11px]">
          <span
            className={`rounded px-1.5 py-0.5 font-mono font-semibold tabular-nums ${INDEX_CHIP_CLASS[indexTone(tip.indexValue)]}`}
          >
            INDEX {fmtIndex(tip.indexValue)}
          </span>
          <span className="tabular-nums text-muted-foreground">
            1 {tip.probHome ?? "–"}% · X {tip.probDraw ?? "–"}% · 2 {tip.probAway ?? "–"}%
          </span>
        </div>
      )}
    </button>
  );
}
