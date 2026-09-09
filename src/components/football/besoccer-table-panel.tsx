"use client";

import { useEffect, useMemo, useState } from "react";
import { simulateTable, type SimResult } from "@/lib/table-projection";

type TeamRow = { id: string; name: string; played: number; points: number; gf: number; ga: number };
type Fixture = { homeId: string; awayId: string };

type ProjectionData = { teams: TeamRow[]; fixtures: Fixture[] };

type Props = {
  leagueId: string;
  homeName: string;
  awayName: string;
};

function BarPct({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: "#f0f0f0" }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.round(pct)}%`, backgroundColor: color }} />
    </div>
  );
}

export function BesoccerTablePanel({ leagueId, homeName, awayName }: Props) {
  const [data, setData] = useState<ProjectionData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!leagueId) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/football/table-projection?leagueId=${encodeURIComponent(leagueId)}`)
      .then((r) => (r.ok ? r.json() as Promise<ProjectionData> : null))
      .then((d) => { if (!cancelled && d) setData(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [leagueId]);

  const sim = useMemo(() => {
    if (!data || data.teams.length < 2) return null;
    return simulateTable(data.teams, data.fixtures, 1500);
  }, [data]);

  const sorted = useMemo(() => {
    if (!sim || !data) return [];
    return [...data.teams]
      .map((t) => ({ ...t, ...(sim[t.id] as SimResult) }))
      .sort((a, b) => b.points - a.points || (b.gf - b.ga) - (a.gf - a.ga));
  }, [sim, data]);

  const homeTeam = data?.teams.find((t) => t.name === homeName);
  const awayTeam = data?.teams.find((t) => t.name === awayName);

  if (loading) {
    return (
      <div className="w-full rounded-2xl border p-4" style={{ backgroundColor: "#ffffff", borderColor: "#f0f0f0" }}>
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-40 rounded" style={{ backgroundColor: "#f0f0f0" }} />
          <div className="h-32 w-full rounded-lg" style={{ backgroundColor: "#f0f0f0" }} />
        </div>
      </div>
    );
  }

  if (!sim || sorted.length === 0) return null;

  const maxPts = Math.max(...sorted.map((t) => t.points + (t.expPts - t.points)), 1);
  const totalTeams = sorted.length;

  return (
    <div className="w-full rounded-2xl border p-4" style={{ backgroundColor: "#ffffff", borderColor: "#f0f0f0" }}>
      {/* Points box */}
      <div className="mb-4 flex items-center justify-between">
        <div className="text-center">
          <div className="text-2xl font-bold tabular-nums" style={{ color: "#222222" }}>
            {homeTeam?.points ?? "–"}
          </div>
          <div className="text-[11px]" style={{ color: "#717171" }}>pts</div>
        </div>
        <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#717171" }}>
          {homeName}
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold tabular-nums" style={{ color: "#222222" }}>
            {awayTeam?.points ?? "–"}
          </div>
          <div className="text-[11px]" style={{ color: "#717171" }}>pts</div>
        </div>
      </div>

      {/* Barre comparaison points */}
      <div className="mb-4">
        <div className="flex h-2 w-full overflow-hidden rounded-full">
          <div
            className="transition-all"
            style={{
              width: `${homeTeam && awayTeam ? ((homeTeam.points) / Math.max(homeTeam.points + awayTeam.points, 1)) * 100 : 50}%`,
              backgroundColor: "#16a34a",
            }}
          />
          <div
            className="transition-all"
            style={{
              width: `${homeTeam && awayTeam ? ((awayTeam.points) / Math.max(homeTeam.points + awayTeam.points, 1)) * 100 : 50}%`,
              backgroundColor: "#374151",
            }}
          />
        </div>
        <div className="mt-1 grid grid-cols-2 text-center text-[11px]">
          <span style={{ color: "#222222" }}>{homeTeam?.points ?? "–"} pts</span>
          <span style={{ color: "#222222" }}>{awayTeam?.points ?? "–"} pts</span>
        </div>
      </div>

      {/* Final Table */}
      <div className="mb-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "#717171" }}>
          Final table projection
        </div>
        <div className="space-y-1">
          {sorted.map((t, i) => {
            const isHome = t.name === homeName;
            const isAway = t.name === awayName;
            const isHighlight = isHome || isAway;
            const finalPts = Math.round(t.expPts);
            const barWidth = (finalPts / maxPts) * 100;
            return (
              <div
                key={t.id}
                className="flex items-center gap-2 rounded-lg px-2 py-1 text-[12px]"
                style={{
                  backgroundColor: isHighlight ? "#f0fdf4" : "transparent",
                  color: "#222222",
                }}
              >
                <span className="w-4 text-right font-semibold tabular-nums" style={{ color: "#717171" }}>
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{t.name}</span>
                <div className="w-24">
                  <BarPct pct={barWidth} color={isHome ? "#16a34a" : isAway ? "#374151" : "#bdbdbd"} />
                </div>
                <span className="w-8 text-right font-bold tabular-nums">{finalPts}</span>
                <span className="w-8 text-right tabular-nums" style={{ color: "#717171" }}>
                  {t.points}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex justify-end gap-3 text-[10px]" style={{ color: "#717171" }}>
          <span><span className="font-semibold" style={{ color: "#222222" }}>Final</span> / Current</span>
        </div>
      </div>

      {/* Expected probabilities */}
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "#717171" }}>
          Expected probabilities
        </div>
        <div className="space-y-2">
          {sorted.map((t) => {
            const isHome = t.name === homeName;
            const isAway = t.name === awayName;
            const isHighlight = isHome || isAway;
            return (
              <div
                key={t.id}
                className="rounded-lg px-2 py-1.5"
                style={{ backgroundColor: isHighlight ? "#f0fdf4" : "transparent" }}
              >
                <div className="mb-1 text-[11px] font-medium" style={{ color: "#222222" }}>
                  {t.name}
                </div>
                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <div>
                    <div className="flex items-center justify-between">
                      <span style={{ color: "#717171" }}>Title</span>
                      <span className="font-semibold tabular-nums" style={{ color: "#222222" }}>
                        {Math.round(t.titleProb * 100)}%
                      </span>
                    </div>
                    <BarPct pct={t.titleProb * 100} color="#16a34a" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <span style={{ color: "#717171" }}>Top 4</span>
                      <span className="font-semibold tabular-nums" style={{ color: "#222222" }}>
                        {Math.round(t.top4Prob * 100)}%
                      </span>
                    </div>
                    <BarPct pct={t.top4Prob * 100} color="#3b82f6" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <span style={{ color: "#717171" }}>Releg.</span>
                      <span className="font-semibold tabular-nums" style={{ color: "#222222" }}>
                        {Math.round(t.relegProb * 100)}%
                      </span>
                    </div>
                    <BarPct pct={t.relegProb * 100} color="#ef4444" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-3 text-center text-[10px]" style={{ color: "#717171" }}>
        Monte Carlo simulation — {sorted.length} teams, 1500 iterations
      </div>
    </div>
  );
}
