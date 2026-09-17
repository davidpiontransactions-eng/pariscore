"use client";

import type { HandballMatch } from "@/lib/handball-data";

export function HandballMatchCard({ match }: { match: HandballMatch }) {
  return (
    <div className="rounded-lg border bg-card p-3 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
        <span>🤾 {match.league.name}</span>
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
          <span className="font-medium text-sm">{match.home.name}</span>
          {match.odds?.home && (
            <span className="text-xs bg-muted px-2 py-0.5 rounded">
              {match.odds.home}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm">{match.away.name}</span>
          {match.odds?.away && (
            <span className="text-xs bg-muted px-2 py-0.5 rounded">
              {match.odds.away}
            </span>
          )}
        </div>
      </div>

      {match.odds && (
        <div className="flex gap-1 mt-2">
          {match.odds.home && (
            <span className="flex-1 text-center text-xs bg-emerald-500/10 text-emerald-600 rounded py-0.5">
              1 {match.odds.home}
            </span>
          )}
          {match.odds.draw && (
            <span className="flex-1 text-center text-xs bg-yellow-500/10 text-yellow-600 rounded py-0.5">
              X {match.odds.draw}
            </span>
          )}
          {match.odds.away && (
            <span className="flex-1 text-center text-xs bg-blue-500/10 text-blue-600 rounded py-0.5">
              2 {match.odds.away}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
