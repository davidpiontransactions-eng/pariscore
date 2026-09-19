"use client";

import { useMemo } from "react";
import type { RugbyStrategyMatch } from "@/lib/rugby-strategy-top";

/* Teintes */
const C = {
  card: "#ffffff",
  cardBorder: "#f0f0f0",
  accent: "#00985f",
  gold: "#F59E0B",
  team: "#222222",
  time: "#717171",
} as const;

/** Paris kick-off en format court. */
function parisKickoff(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Paris",
    });
  } catch {
    return "";
  }
}

type Props = {
  /** Tous les matchs Top10 de toutes les stratégies (pour trouver le plus intéressant). */
  allTopMatches: RugbyStrategyMatch[];
  onMatchClick?: (matchId: string) => void;
};

/**
 * Match du Jour — affiche le match le plus intéressant basé sur
 * le nombre de stratégies Top10 dans lesquelles il apparaît.
 * Un match qui apparaît dans 3+ stratégies = très intéressant.
 */
export function RugbyMatchOfDay({ allTopMatches, onMatchClick }: Props) {
  const best = useMemo(() => {
    // Compter les occurrences par matchId
    const counts = new Map<string, { match: RugbyStrategyMatch; count: number }>();
    for (const m of allTopMatches) {
      const existing = counts.get(m.matchId);
      if (existing) {
        existing.count++;
      } else {
        counts.set(m.matchId, { match: m, count: 1 });
      }
    }

    // Trouver le match avec le plus de stratégies
    let bestEntry: { match: RugbyStrategyMatch; count: number } | null = null;
    for (const entry of counts.values()) {
      if (!bestEntry || entry.count > bestEntry.count) {
        bestEntry = entry;
      }
    }

    // Minimum 2 stratégies pour être "Match du Jour"
    return bestEntry && bestEntry.count >= 2 ? bestEntry : null;
  }, [allTopMatches]);

  if (!best) return null;

  const { match, count } = best;
  const pred = match.prediction;

  return (
    <div
      className="relative overflow-hidden rounded-2xl"
      style={{
        background: `linear-gradient(135deg, ${C.accent}08, ${C.gold}08)`,
        border: `1px solid ${C.cardBorder}`,
      }}
    >
      {/* Badge doré */}
      <div
        className="absolute top-0 right-0 rounded-bl-xl px-3 py-1 text-[11px] font-bold text-white"
        style={{ background: C.gold }}
      >
        ⭐ Match du jour
      </div>

      <button
        type="button"
        onClick={() => onMatchClick?.(match.matchId)}
        className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-black/[0.02]"
      >
        {/* Équipes */}
        <div className="flex flex-1 items-center gap-3">
          <div className="flex flex-col items-end gap-0.5 min-w-0 flex-1">
            <span className="truncate text-[14px] font-bold" style={{ color: C.team }}>
              {match.home.name}
            </span>
            {pred && (
              <span className="text-[11px]" style={{ color: C.time }}>
                {Math.round(pred.homeWinProb * 100)}%
              </span>
            )}
          </div>

          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[11px] font-medium" style={{ color: C.time }}>
              {parisKickoff(match.kickoff)}
            </span>
            <span className="text-[18px] font-black" style={{ color: C.accent }}>
              VS
            </span>
            {pred && (
              <span className="text-[11px]" style={{ color: C.time }}>
                {pred.mostLikelyScore}
              </span>
            )}
          </div>

          <div className="flex flex-col items-start gap-0.5 min-w-0 flex-1">
            <span className="truncate text-[14px] font-bold" style={{ color: C.team }}>
              {match.away.name}
            </span>
            {pred && (
              <span className="text-[11px]" style={{ color: C.time }}>
                {Math.round(pred.awayWinProb * 100)}%
              </span>
            )}
          </div>
        </div>

        {/* Stats rapides */}
        <div className="hidden sm:flex flex-col items-end gap-1">
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ background: `${C.accent}15`, color: C.accent }}
          >
            {count} stratégie{count > 1 ? "s" : ""} Top10
          </span>
          {pred?.overUnderLines?.[0]?.line && (
            <span className="text-[11px]" style={{ color: C.time }}>
              O/U {pred.overUnderLines[0].line}
            </span>
          )}
        </div>
      </button>
    </div>
  );
}
