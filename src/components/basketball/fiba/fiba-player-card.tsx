"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { FibaPlayer } from "@/app/api/fiba/players/route";

type FibaPlayerCardProps = {
  player: FibaPlayer;
  onBack?: () => void;
  className?: string;
};

/**
 * Card détaillée d'une joueuse FIBA avec radar chart 6 axes.
 */
export function FibaPlayerCard({ player, onBack, className }: FibaPlayerCardProps) {
  const radarData = useMemo(() => {
    const maxPts = 25;
    const maxReb = 12;
    const maxAst = 10;
    const maxStl = 3;
    const maxBlk = 3;
    const maxPir = 30;

    return [
      { label: "Score", value: player.ppg / maxPts, raw: player.ppg },
      { label: "Rebonds", value: player.rpg / maxReb, raw: player.rpg },
      { label: "Passes", value: player.apg / maxAst, raw: player.apg },
      { label: "Interc.", value: player.steals / maxStl, raw: player.steals },
      { label: "Contres", value: player.blocks / maxBlk, raw: player.blocks },
      { label: "Efficacité", value: player.pir / maxPir, raw: player.pir },
    ];
  }, [player]);

  const radarPoints = useMemo(() => {
    const cx = 75, cy = 75, r = 55;
    const n = radarData.length;
    return radarData.map((d, i) => {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      const val = Math.min(1, Math.max(0, d.value));
      return {
        x: cx + r * val * Math.cos(angle),
        y: cy + r * val * Math.sin(angle),
        labelX: cx + (r + 12) * Math.cos(angle),
        labelY: cy + (r + 12) * Math.sin(angle),
        label: d.label,
        raw: d.raw,
      };
    });
  }, [radarData]);

  const radarPolygon = radarPoints.map((p) => `${p.x},${p.y}`).join(" ");
  const gridLevels = [0.25, 0.5, 0.75, 1];

  return (
    <div className={cn("bg-card rounded-xl border p-4", className)}>
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        {onBack && (
          <button
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground text-xs mt-1"
          >
            ← Retour
          </button>
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {player.headshot ? (
              <img
                src={player.headshot}
                alt={player.name}
                className="h-12 w-12 rounded-full object-cover border-2"
                style={{ borderColor: `#${player.teamColor}` }}
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
            ) : (
              <div
                className="h-12 w-12 rounded-full flex items-center justify-center text-lg font-bold border-2"
                style={{ borderColor: `#${player.teamColor}`, backgroundColor: `#${player.teamColor}20` }}
              >
                {player.name.charAt(0)}
              </div>
            )}
            <div>
              <h3 className="text-lg font-bold">{player.name}</h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: `#${player.teamColor}` }}
                />
                <span>{player.team}</span>
                <span>•</span>
                <span>{player.position}</span>
                {player.jersey && (
                  <>
                    <span>•</span>
                    <span>#{player.jersey}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        {player.mvpRank <= 5 && (
          <Badge variant="default" className="bg-amber-500 text-[10px]">
            MVP #{player.mvpRank}
          </Badge>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <StatBox label="PPG" value={player.ppg.toFixed(1)} highlight />
        <StatBox label="RPG" value={player.rpg.toFixed(1)} />
        <StatBox label="APG" value={player.apg.toFixed(1)} />
        <StatBox label="PIR" value={player.pir.toFixed(1)} />
        <StatBox label="FG%" value={`${player.fgPct.toFixed(1)}%`} />
        <StatBox label="3P%" value={`${player.threePct.toFixed(1)}%`} />
        <StatBox label="STL" value={player.steals.toFixed(1)} />
        <StatBox label="BLK" value={player.blocks.toFixed(1)} />
      </div>

      {/* Radar Chart */}
      <div className="flex justify-center mb-4">
        <svg width="150" height="150" viewBox="0 0 150 150">
          {/* Grid */}
          {gridLevels.map((level) => (
            <polygon
              key={level}
              points={radarData
                .map((_, i) => {
                  const angle = (Math.PI * 2 * i) / radarData.length - Math.PI / 2;
                  const x = 75 + 55 * level * Math.cos(angle);
                  const y = 75 + 55 * level * Math.sin(angle);
                  return `${x},${y}`;
                })
                .join(" ")}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="0.5"
            />
          ))}
          {/* Axes */}
          {radarData.map((_, i) => {
            const angle = (Math.PI * 2 * i) / radarData.length - Math.PI / 2;
            const x = 75 + 55 * Math.cos(angle);
            const y = 75 + 55 * Math.sin(angle);
            return (
              <line
                key={i}
                x1="75"
                y1="75"
                x2={x}
                y2={y}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="0.5"
              />
            );
          })}
          {/* Data polygon */}
          <polygon
            points={radarPolygon}
            fill="rgba(0, 230, 118, 0.15)"
            stroke="#00e676"
            strokeWidth="1.5"
          />
          {/* Data points */}
          {radarPoints.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="2.5"
              fill="#00e676"
              stroke="#0a0f1a"
              strokeWidth="1"
            />
          ))}
          {/* Labels */}
          {radarPoints.map((p, i) => (
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

      {/* MVP Score Bar */}
      <div className="flex items-center gap-2 mt-2">
        <span className="text-[10px] text-muted-foreground font-medium">MVP Score</span>
        <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${Math.min(100, player.mvpScore)}%` }}
          />
        </div>
        <span className="text-[11px] font-bold text-primary tabular-nums">
          {player.mvpScore.toFixed(1)}
        </span>
      </div>

      {/* Composite Score */}
      <div className="flex items-center gap-2 mt-1">
        <span className="text-[10px] text-muted-foreground font-medium">Score Composite</span>
        <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500/60 rounded-full transition-all"
            style={{ width: `${Math.min(100, player.composite)}%` }}
          />
        </div>
        <span className="text-[11px] font-bold text-emerald-400 tabular-nums">
          {player.composite.toFixed(1)}
        </span>
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col items-center rounded-lg bg-white/[0.04] border border-white/[0.06] py-1.5">
      <span className="text-[8px] text-muted-foreground font-medium leading-none">{label}</span>
      <span
        className={cn(
          "text-[13px] font-black leading-none mt-0.5 tabular-nums",
          highlight ? "text-primary" : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}
