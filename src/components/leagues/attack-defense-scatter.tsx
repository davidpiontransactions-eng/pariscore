"use client";

import { useMemo, useState } from "react";
import { Crosshair } from "lucide-react";

type TeamPoint = {
  team: string;
  gfPg: number;  // goals for per game
  gaPg: number;  // goals against per game
  gp: number;
};

type Props = {
  teams: TeamPoint[];
  leagueName?: string;
};

// ── SVG constants (pattern FootballRankingGraph) ──
const W = 400;
const H = 300;
const M = { top: 20, right: 16, bottom: 36, left: 40 };
const PLOT_W = W - M.left - M.right;
const PLOT_H = H - M.top - M.bottom;

function makeScale(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const k = (r1 - r0) / (d1 - d0 || 1);
  return (v: number) => r0 + (v - d0) * k;
}

export function AttackDefenseScatter({ teams, leagueName }: Props) {
  const [hovered, setHovered] = useState<TeamPoint | null>(null);

  const { scaleX, scaleY, avgGF, avgGA } = useMemo(() => {
    if (teams.length === 0) {
      return {
        scaleX: makeScale([0, 3], [M.left, W - M.right]),
        scaleY: makeScale([0, 3], [H - M.bottom, M.top]),
        avgGF: 1.5,
        avgGA: 1.5,
      };
    }
    const gfs = teams.map((t) => t.gfPg);
    const gas = teams.map((t) => t.gaPg);

    const gfMin = Math.min(...gfs) - 0.2;
    const gfMax = Math.max(...gfs) + 0.2;
    const gaMin = Math.min(...gas) - 0.2;
    const gaMax = Math.max(...gas) + 0.2;

    // Note: Y axis inverted — lower GA = top of chart (better defense)
    const sx = makeScale([gfMin, gfMax], [M.left, W - M.right]);
    const sy = makeScale([gaMax, gaMin], [H - M.bottom, M.top]); // inverted

    const avgG = gfs.reduce((a, b) => a + b, 0) / gfs.length;
    const avgA = gas.reduce((a, b) => a + b, 0) / gas.length;

    return { scaleX: sx, scaleY: sy, avgGF: avgG, avgGA: avgA };
  }, [teams]);

  if (teams.length === 0) return null;

  return (
    <div className="rounded-xl border bg-white p-4 dark:bg-card">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Crosshair className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-semibold">Attack vs Defense{leagueName ? ` — ${leagueName}` : ""}</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            Top-right = elite
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-rose-500" />
            Bottom-left = faible
          </span>
        </div>
      </div>

      {/* SVG scatter */}
      <div className="relative">
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          className="block w-full"
          aria-label="Scatter plot: attaque vs défense par équipe"
        >
          {/* Quadrant backgrounds */}
          <rect x={scaleX(avgGF)} y={M.top} width={W - M.right - scaleX(avgGF)} height={scaleY(avgGA) - M.top} fill="#10b981" opacity={0.04} />
          <rect x={M.left} y={scaleY(avgGA)} width={scaleX(avgGF) - M.left} height={H - M.bottom - scaleY(avgGA)} fill="#ef4444" opacity={0.04} />

          {/* Grid */}
          {[0, 0.5, 1, 1.5, 2, 2.5, 3].filter(v => v > 0).map((v) => (
            <g key={`grid-${v}`}>
              <line x1={scaleX(v)} y1={M.top} x2={scaleX(v)} y2={H - M.bottom} stroke="#f0f0f0" strokeWidth={1} />
              <line x1={M.left} y1={scaleY(v)} x2={W - M.right} y2={scaleY(v)} stroke="#f0f0f0" strokeWidth={1} />
            </g>
          ))}

          {/* Axes */}
          <line x1={M.left} y1={M.top} x2={M.left} y2={H - M.bottom} stroke="#e5e5e5" strokeWidth={1} />
          <line x1={M.left} y1={H - M.bottom} x2={W - M.right} y2={H - M.bottom} stroke="#e5e5e5" strokeWidth={1} />

          {/* Average lines (dashed) */}
          <line x1={scaleX(avgGF)} y1={M.top} x2={scaleX(avgGF)} y2={H - M.bottom} stroke="#d4d4d8" strokeWidth={1} strokeDasharray="4 4" />
          <line x1={M.left} y1={scaleY(avgGA)} x2={W - M.right} y2={scaleY(avgGA)} stroke="#d4d4d8" strokeWidth={1} strokeDasharray="4 4" />

          {/* Quadrant labels */}
          <text x={W - M.right - 4} y={M.top + 14} textAnchor="end" fontSize={9} fill="#10b981" fontWeight="600">
            Elite
          </text>
          <text x={M.left + 4} y={H - M.bottom - 4} textAnchor="start" fontSize={9} fill="#ef4444" fontWeight="600">
            Faible
          </text>

          {/* Axis labels */}
          {([0.5, 1, 1.5, 2, 2.5, 3] as number[]).map((v) => (
            <text key={`lx-${v}`} x={scaleX(v)} y={H - M.bottom + 14} textAnchor="middle" fontSize={9} fill="#9e9e9e" fontFamily="ui-monospace, monospace">
              {v.toFixed(1)}
            </text>
          ))}
          {([0.5, 1, 1.5, 2, 2.5, 3] as number[]).map((v) => (
            <text key={`ly-${v}`} x={M.left - 6} y={scaleY(v) + 3} textAnchor="end" fontSize={9} fill="#9e9e9e" fontFamily="ui-monospace, monospace">
              {v.toFixed(1)}
            </text>
          ))}

          <text x={M.left + PLOT_W / 2} y={H - 4} textAnchor="middle" fontSize={10} fill="#717171">
            Buts marqués / match
          </text>
          <text x={12} y={M.top + PLOT_H / 2} textAnchor="middle" fontSize={10} fill="#717171" transform={`rotate(-90, 12, ${M.top + PLOT_H / 2})`}>
            Buts encaissés / match
          </text>

          {/* Data points */}
          {teams.map((t) => {
            const cx = scaleX(t.gfPg);
            const cy = scaleY(t.gaPg);
            const isHovered = hovered?.team === t.team;

            // Color: green if in top-right quadrant, red if bottom-left
            const isGood = t.gfPg >= avgGF && t.gaPg <= avgGA;
            const isBad = t.gfPg < avgGF && t.gaPg > avgGA;
            const color = isGood ? "#10b981" : isBad ? "#ef4444" : "#3b82f6";

            return (
              <g
                key={t.team}
                onMouseEnter={() => setHovered(t)}
                onMouseLeave={() => setHovered(null)}
                className="cursor-pointer"
              >
                <circle cx={cx} cy={cy} r={isHovered ? 6 : 4.5} fill={color} opacity={isHovered ? 1 : 0.8} stroke={isHovered ? "white" : "none"} strokeWidth={isHovered ? 2 : 0} />
                {isHovered && (
                  <circle cx={cx} cy={cy} r={8} fill="none" stroke={color} strokeWidth={1} opacity={0.4} />
                )}
              </g>
            );
          })}
        </svg>

        {/* Tooltip */}
        {hovered && (
          <div
            className="pointer-events-none absolute z-10 rounded-lg border bg-white px-3 py-2 text-xs shadow-lg dark:bg-card"
            style={{
              left: `${(scaleX(hovered.gfPg) / W) * 100}%`,
              top: `${(scaleY(hovered.gaPg) / H) * 100 - 10}%`,
              transform: "translate(-50%, -100%)",
            }}
          >
            <p className="font-semibold">{hovered.team}</p>
            <p className="text-muted-foreground">
              {hovered.gfPg.toFixed(2)} marqués · {hovered.gaPg.toFixed(2)} encaissés · {hovered.gp} matchs
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
