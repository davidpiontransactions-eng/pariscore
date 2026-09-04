"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useFibaPlayers } from "@/hooks/use-fiba-players";
import type { FibaPlayer } from "@/app/api/fiba/players/route";

type FibaPlayerComparisonProps = {
  className?: string;
};

/**
 * Comparaison H2H entre 2 joueuses — radar overlay + tableau côte à côte.
 */
export function FibaPlayerComparison({ className }: FibaPlayerComparisonProps) {
  const { players, isLoading } = useFibaPlayers({ stat: "composite" });
  const [playerAId, setPlayerAId] = useState<string>("");
  const [playerBId, setPlayerBId] = useState<string>("");

  const playerA = useMemo(
    () => players.find((p) => p.playerId === playerAId) ?? null,
    [players, playerAId],
  );
  const playerB = useMemo(
    () => players.find((p) => p.playerId === playerBId) ?? null,
    [players, playerBId],
  );

  const radarPoints = useMemo(() => {
    if (!playerA || !playerB) return null;

    const axes = [
      { label: "Score", max: 25 },
      { label: "Rebonds", max: 12 },
      { label: "Passes", max: 10 },
      { label: "Interc.", max: 3 },
      { label: "Contres", max: 3 },
      { label: "Efficacité", max: 30 },
    ];

    const valuesA = [playerA.ppg, playerA.rpg, playerA.apg, playerA.steals, playerA.blocks, playerA.pir];
    const valuesB = [playerB.ppg, playerB.rpg, playerB.apg, playerB.steals, playerB.blocks, playerB.pir];

    const cx = 100, cy = 100, r = 70;
    const n = axes.length;

    const getPoints = (values: number[]) =>
      axes.map((axis, i) => {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
        const val = Math.min(1, Math.max(0, values[i] / axis.max));
        return {
          x: cx + r * val * Math.cos(angle),
          y: cy + r * val * Math.sin(angle),
          labelX: cx + (r + 14) * Math.cos(angle),
          labelY: cy + (r + 14) * Math.sin(angle),
          label: axis.label,
        };
      });

    return {
      axes,
      pointsA: getPoints(valuesA),
      pointsB: getPoints(valuesB),
      polygonA: getPoints(valuesA).map((p) => `${p.x},${p.y}`).join(" "),
      polygonB: getPoints(valuesB).map((p) => `${p.x},${p.y}`).join(" "),
    };
  }, [playerA, playerB]);

  const gridLevels = [0.25, 0.5, 0.75, 1];

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-12", className)}>
        <div className="text-sm text-muted-foreground animate-pulse">Chargement...</div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", className)}>
      <h3 className="text-sm font-bold mb-3">⚔️ Comparaison H2H</h3>

      {/* Player selectors */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <PlayerSelect
          label="Joueuse A"
          players={players}
          selected={playerAId}
          onChange={setPlayerAId}
          color="#00e676"
        />
        <PlayerSelect
          label="Joueuse B"
          players={players}
          selected={playerBId}
          onChange={setPlayerBId}
          color="#f44336"
        />
      </div>

      {/* Radar overlay */}
      {radarPoints && (
        <div className="flex justify-center mb-4">
          <svg width="200" height="200" viewBox="0 0 200 200">
            {/* Grid */}
            {gridLevels.map((level) => (
              <polygon
                key={level}
                points={radarPoints.axes
                  .map((_, i) => {
                    const angle = (Math.PI * 2 * i) / radarPoints.axes.length - Math.PI / 2;
                    return `${100 + 70 * level * Math.cos(angle)},${100 + 70 * level * Math.sin(angle)}`;
                  })
                  .join(" ")}
                fill="none"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="0.5"
              />
            ))}
            {/* Axes */}
            {radarPoints.axes.map((_, i) => {
              const angle = (Math.PI * 2 * i) / radarPoints.axes.length - Math.PI / 2;
              return (
                <line
                  key={i}
                  x1="100"
                  y1="100"
                  x2={100 + 70 * Math.cos(angle)}
                  y2={100 + 70 * Math.sin(angle)}
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="0.5"
                />
              );
            })}
            {/* Player A */}
            <polygon
              points={radarPoints.polygonA}
              fill="rgba(0, 230, 118, 0.12)"
              stroke="#00e676"
              strokeWidth="1.5"
            />
            {/* Player B */}
            <polygon
              points={radarPoints.polygonB}
              fill="rgba(244, 67, 54, 0.12)"
              stroke="#f44336"
              strokeWidth="1.5"
            />
            {/* Labels */}
            {radarPoints.pointsA.map((p, i) => (
              <text
                key={i}
                x={p.labelX}
                y={p.labelY}
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-[7px] fill-muted-foreground"
              >
                {p.label}
              </text>
            ))}
          </svg>
        </div>
      )}

      {/* Head-to-head table */}
      {playerA && playerB && (
        <div className="rounded-lg border border-white/[0.06] overflow-hidden">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="bg-white/[0.03]">
                <th className="px-2 py-1.5 text-left font-bold text-muted-foreground">Stat</th>
                <th className="px-2 py-1.5 text-center font-bold text-emerald-400">{playerA.name}</th>
                <th className="px-2 py-1.5 text-center font-bold text-red-400">{playerB.name}</th>
                <th className="px-2 py-1.5 text-center font-bold text-muted-foreground">Winner</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: "PPG", a: playerA.ppg, b: playerB.ppg },
                { label: "RPG", a: playerA.rpg, b: playerB.rpg },
                { label: "APG", a: playerA.apg, b: playerB.apg },
                { label: "STL", a: playerA.steals, b: playerB.steals },
                { label: "BLK", a: playerA.blocks, b: playerB.blocks },
                { label: "PIR", a: playerA.pir, b: playerB.pir },
                { label: "FG%", a: playerA.fgPct, b: playerB.fgPct },
                { label: "Score", a: playerA.composite, b: playerB.composite },
              ].map((row) => {
                const winner = row.a > row.b ? "A" : row.b > row.a ? "B" : "Tie";
                return (
                  <tr key={row.label} className="border-t border-white/[0.04]">
                    <td className="px-2 py-1.5 text-muted-foreground font-medium">{row.label}</td>
                    <td className={cn(
                      "px-2 py-1.5 text-center font-mono tabular-nums",
                      winner === "A" && "text-emerald-400 font-bold",
                    )}>
                      {row.a.toFixed(1)}
                    </td>
                    <td className={cn(
                      "px-2 py-1.5 text-center font-mono tabular-nums",
                      winner === "B" && "text-red-400 font-bold",
                    )}>
                      {row.b.toFixed(1)}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      {winner === "A" && <span className="text-emerald-400">✓</span>}
                      {winner === "B" && <span className="text-red-400">✓</span>}
                      {winner === "Tie" && <span className="text-muted-foreground">=</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!playerA && !playerB && (
        <div className="text-center py-6 text-xs text-muted-foreground">
          Sélectionnez deux joueuses pour les comparer
        </div>
      )}
    </div>
  );
}

function PlayerSelect({
  label,
  players,
  selected,
  onChange,
  color,
}: {
  label: string;
  players: FibaPlayer[];
  selected: string;
  onChange: (id: string) => void;
  color: string;
}) {
  return (
    <div>
      <label className="text-[9px] text-muted-foreground font-medium mb-1 block">{label}</label>
      <select
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white/[0.06] border border-white/[0.08] rounded-lg px-2 py-1.5 text-[11px] text-foreground appearance-none cursor-pointer"
        style={{ colorScheme: "dark" }}
      >
        <option value="">Choisir...</option>
        {players.slice(0, 30).map((p) => (
          <option key={p.playerId} value={p.playerId}>
            {p.name} ({p.teamAbbr})
          </option>
        ))}
      </select>
    </div>
  );
}
