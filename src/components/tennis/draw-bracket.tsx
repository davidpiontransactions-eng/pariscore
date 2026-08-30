"use client";

import { cn } from "@/lib/utils";
import { RoundBadge } from "./round-badge";
import { DrawMatchRow } from "./draw-match-row";
import type { DrawMatch, DrawRound } from "@/lib/types/tennis-draw";
import { ROUND_ORDER } from "@/lib/types/tennis-draw";

type DrawBracketProps = {
  matches: DrawMatch[];
  rounds?: DrawRound[];
  onMatchClick?: (match: DrawMatch) => void;
  className?: string;
};

/** Rounds affichés dans le bracket (R32 → F). */
const BRACKET_ROUNDS: DrawRound[] = ["R32", "R16", "QF", "SF", "F"];

export function DrawBracket({
  matches,
  rounds = BRACKET_ROUNDS,
  onMatchClick,
  className,
}: DrawBracketProps) {
  // Grouper les matchs par round
  const grouped = new Map<DrawRound, DrawMatch[]>();
  for (const r of rounds) grouped.set(r, []);
  for (const m of matches) {
    const arr = grouped.get(m.round);
    if (arr) arr.push(m);
  }

  // Trier chaque round par position
  for (const arr of grouped.values()) {
    arr.sort((a, b) => a.position - b.position);
  }

  return (
    <div className={cn("overflow-x-auto pb-2", className)}>
      <div className="flex min-w-[700px] gap-0">
        {rounds.map((round, colIdx) => {
          const roundMatches = grouped.get(round) ?? [];
          const isLast = colIdx === rounds.length - 1;

          return (
            <div key={round} className="flex flex-1 flex-col">
              {/* En-tête round */}
              <div className="mb-2 flex justify-center">
                <RoundBadge round={round} isActive size="md" />
              </div>

              {/* Matchs */}
              <div className="flex flex-1 flex-col justify-around gap-2">
                {roundMatches.map((match) => (
                  <div
                    key={match.id ?? `${match.round}-${match.position}`}
                    className={cn(
                      "relative",
                      // Ligne de connexion (sauf premier round)
                      colIdx > 0 && "pl-3 before:absolute before:left-0 before:top-1/2 before:h-px before:w-3 before:bg-border/60",
                    )}
                  >
                    <DrawMatchRow
                      match={match}
                      onClick={() => onMatchClick?.(match)}
                    />
                  </div>
                ))}

                {/* Placeholder si pas de matchs */}
                {roundMatches.length === 0 && (
                  <div className="flex h-16 items-center justify-center text-[10px] text-muted-foreground/40">
                    —
                  </div>
                )}
              </div>

              {/* Séparateur vertical entre rounds (sauf dernier) */}
              {!isLast && (
                <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-px bg-border/30" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
