"use client";

import { useState, useEffect } from "react";

type StandingRow = {
  rank: number;
  team: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  ppg: number;
};

export function HandballRankings({
  leagueId,
  leagueName,
}: {
  leagueId?: number;
  leagueName?: string;
}) {
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!leagueId) return;
    setLoading(true);
    setError(false);
    fetch(`/api/handball/standings?league=${leagueId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.standings) setStandings(data.standings);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [leagueId]);

  if (!leagueId) return null;
  if (loading)
    return (
      <div className="text-center py-4 text-muted-foreground">
        Chargement classement...
      </div>
    );
  if (error)
    return (
      <div className="text-center py-4 text-red-500 text-sm">
        Erreur chargement classement
      </div>
    );
  if (standings.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">📊 Classement {leagueName}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground border-b">
              <th className="text-left py-1 px-1">#</th>
              <th className="text-left py-1 px-1">Équipe</th>
              <th className="text-center py-1 px-1">MJ</th>
              <th className="text-center py-1 px-1">V</th>
              <th className="text-center py-1 px-1">N</th>
              <th className="text-center py-1 px-1">D</th>
              <th className="text-center py-1 px-1">BP</th>
              <th className="text-center py-1 px-1">BC</th>
              <th className="text-center py-1 px-1">Diff</th>
              <th className="text-center py-1 px-1 font-bold">Pts</th>
              <th className="text-center py-1 px-1">PPG</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row) => {
              const diff = row.goalsFor - row.goalsAgainst;
              return (
                <tr key={row.rank} className="border-b hover:bg-muted/50">
                  <td className="py-1 px-1 font-medium">{row.rank}</td>
                  <td className="py-1 px-1 font-medium">{row.team}</td>
                  <td className="py-1 px-1 text-center">{row.played}</td>
                  <td className="py-1 px-1 text-center">{row.wins}</td>
                  <td className="py-1 px-1 text-center">{row.draws}</td>
                  <td className="py-1 px-1 text-center">{row.losses}</td>
                  <td className="py-1 px-1 text-center">{row.goalsFor}</td>
                  <td className="py-1 px-1 text-center">{row.goalsAgainst}</td>
                  <td
                    className={`py-1 px-1 text-center font-medium ${
                      diff > 0
                        ? "text-emerald-500"
                        : diff < 0
                          ? "text-red-500"
                          : ""
                    }`}
                  >
                    {diff > 0 ? "+" : ""}
                    {diff}
                  </td>
                  <td className="py-1 px-1 text-center font-bold">
                    {row.points}
                  </td>
                  <td className="py-1 px-1 text-center text-muted-foreground">
                    {row.ppg.toFixed(1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
