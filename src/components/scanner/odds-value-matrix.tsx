"use client";

import { cn } from "@/lib/utils";

// ── types ────────────────────────────────────────────

type Match = {
  id: string;
  playerA: string;
  playerB: string;
  modelProbA: number;
};

type Bookmaker = {
  name: string;
  odds: Record<string, { decimalA: number; decimalB: number }>;
};

type OddsValueMatrixProps = {
  matches: Match[];
  bookmakers: Bookmaker[];
  className?: string;
};

// ── helpers ──────────────────────────────────────────

/**
 * Model edge for Player A.
 * Positive → model sees more win probability than bookmaker odds imply.
 */
function computeEdge(modelProbA: number, decimalA: number): number {
  return modelProbA - (1 / decimalA) * 100;
}

function formatEdge(edge: number): string {
  const sign = edge > 0 ? "+" : "";
  return `${sign}${edge.toFixed(1)}%`;
}

function edgeColorClass(edge: number): string {
  if (edge > 8) return "bg-emerald-500/20";
  if (edge >= 3) return "bg-amber-500/20";
  return "bg-red-500/20";
}

// ── component ────────────────────────────────────────

export function OddsValueMatrix({
  matches,
  bookmakers,
  className,
}: OddsValueMatrixProps) {
  return (
    <div
      className={cn(
        "overflow-x-auto rounded-lg border border-white/10 bg-card",
        className,
      )}
    >
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {/* Bookmaker column header — sticky */}
            <th
              scope="col"
              className={cn(
                "sticky left-0 z-20 bg-card",
                "border-b border-r border-white/10",
                "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/50",
              )}
            >
              Bookmaker
            </th>

            {/* Match column headers */}
            {matches.map((match) => (
              <th
                key={match.id}
                scope="col"
                className={cn(
                  "border-b border-white/10",
                  "px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-white/50",
                  "whitespace-nowrap",
                )}
              >
                <span className="text-white/80">{match.playerA}</span>
                <span className="mx-1 text-white/30">vs</span>
                <span className="text-white/80">{match.playerB}</span>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {bookmakers.map((bookmaker) => (
            <tr
              key={bookmaker.name}
              className="transition-colors hover:bg-white/[0.03]"
            >
              {/* Bookmaker name — sticky */}
              <td
                className={cn(
                  "sticky left-0 z-10 bg-card",
                  "border-r border-white/10",
                  "px-4 py-2.5 text-left font-medium text-white/80 whitespace-nowrap",
                )}
              >
                {bookmaker.name}
              </td>

              {/* Edge cells per match */}
              {matches.map((match) => {
                const oddsEntry = bookmaker.odds[match.id];

                if (!oddsEntry) {
                  return (
                    <td
                      key={match.id}
                      className="px-4 py-2.5 text-center text-white/25 tabular-nums"
                    >
                      &mdash;
                    </td>
                  );
                }

                const edge = computeEdge(
                  match.modelProbA,
                  oddsEntry.decimalA,
                );

                return (
                  <td
                    key={match.id}
                    className={cn(
                      "px-4 py-2.5 text-center font-mono text-sm tabular-nums",
                      "text-white/80",
                      edgeColorClass(edge),
                    )}
                  >
                    {formatEdge(edge)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
