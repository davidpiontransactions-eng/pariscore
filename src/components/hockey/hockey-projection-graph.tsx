"use client";

/**
 * HockeyProjectionGraph — Graphe de projection de fin de saison pour KHL/NHL/Magnus.
 * Utilise les PPG actuels pour projeter les points finaux sur une saison complete.
 * Utilise recharts (deja dans le projet).
 */

import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

type TeamStanding = {
  rank: number;
  name: string;
  gp: number;
  tp: number;
  ppg: number;
};

type ProjectionGraphProps = {
  teams: TeamStanding[];
  leagueName: string;
  seasonLength?: number; // nombre total de matchs dans la saison
};

const TEAM_COLORS = [
  "#00e676", "#5fbfff", "#ff6b6b", "#ffd93d", "#c084fc",
  "#fb923c", "#38bdf8", "#a3e635", "#f472b6", "#67e8f9",
  "#e879f9", "#facc15", "#34d399", "#f87171", "#60a5fa",
];

export function HockeyProjectionGraph({
  teams,
  leagueName,
  seasonLength = 68,
}: ProjectionGraphProps) {
  const chartData = useMemo(() => {
    if (teams.length === 0) return [];

    // Prendre les top 10 equipes par PPG
    const top = [...teams]
      .sort((a, b) => b.ppg - a.ppg)
      .slice(0, 10);

    // Generer les points de projection: chaque 10 matchs jusqu'a seasonLength
    const checkpoints: number[] = [];
    for (let gp = 0; gp <= seasonLength; gp += 10) {
      checkpoints.push(gp);
    }
    // Ajouter la fin de saison si pas deja present
    if (checkpoints[checkpoints.length - 1] !== seasonLength) {
      checkpoints.push(seasonLength);
    }

    return checkpoints.map((gp) => {
      const point: { gp: number; [key: string]: number } = { gp };
      for (const t of top) {
        point[t.name] = Math.round((t.ppg * gp) * 10) / 10;
      }
      return point;
    });
  }, [teams, seasonLength]);

  const topTeams = useMemo(
    () => [...teams].sort((a, b) => b.ppg - a.ppg).slice(0, 10),
    [teams]
  );

  if (chartData.length === 0 || topTeams.length === 0) {
    return (
      <div className="text-center text-white/40 text-sm py-8">
        Aucune donnee de projection disponible
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="h-[350px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="gp"
              stroke="rgba(255,255,255,0.3)"
              tick={{ fontSize: 10, fill: "rgba(255,255,255,0.5)" }}
              label={{ value: "Matchs joues", position: "insideBottom", offset: -5, fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
            />
            <YAxis
              stroke="rgba(255,255,255,0.3)"
              tick={{ fontSize: 10, fill: "rgba(255,255,255,0.5)" }}
              label={{ value: "Points", angle: -90, position: "insideLeft", fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(10,22,40,0.95)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              labelStyle={{ color: "rgba(255,255,255,0.6)" }}
              itemStyle={{ color: "#fff" }}
              labelFormatter={(v) => `${v} matchs`}
            />
            <Legend
              wrapperStyle={{ fontSize: "10px", color: "rgba(255,255,255,0.6)" }}
              iconSize={8}
            />
            {topTeams.map((t, i) => (
              <Line
                key={t.name}
                type="monotone"
                dataKey={t.name}
                stroke={TEAM_COLORS[i % TEAM_COLORS.length]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[10px] text-white/30 mt-2 text-center">
        Projection basee sur le PPG actuel — {teams.length} equipes — Saison {seasonLength} matchs
      </p>
    </div>
  );
}
