"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Map } from "lucide-react";

type GoalsMapPoint = {
  league: string;
  country: string;
  slug: string;
  goalsPerGame: number;
  drawRate: number;
  gamesPlayed: number;
};

type GoalsMapResponse = {
  points: GoalsMapPoint[];
  total: number;
};

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};

// ── SVG constants (pattern FootballRankingGraph) ──
const W = 480;
const H = 320;
const M = { top: 24, right: 20, bottom: 40, left: 48 };
const PLOT_W = W - M.left - M.right;
const PLOT_H = H - M.top - M.bottom;

// ── Cluster colors ──
const CLUSTER_COLORS: Record<string, string> = {
  "Open, high-scoring": "#10b981",   // emerald-500
  "Early settled": "#f59e0b",        // amber-500
  "Home fortress": "#3b82f6",        // blue-500
  "Low-scoring": "#94a3b8",          // slate-400
};

function classify(gpg: number, dr: number): string {
  if (gpg >= 2.8 && dr < 28) return "Open, high-scoring";
  if (gpg >= 2.8 && dr >= 28) return "Early settled";
  if (gpg < 2.8 && dr < 28) return "Home fortress";
  return "Low-scoring";
}

// ── Scales ──
function makeScale(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const k = (r1 - r0) / (d1 - d0 || 1);
  return (v: number) => r0 + (v - d0) * k;
}

function regression(points: GoalsMapPoint[]): { slope: number; intercept: number } {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: 0 };
  let sx = 0, sy = 0, sxy = 0, sx2 = 0;
  for (const p of points) {
    sx += p.goalsPerGame;
    sy += p.drawRate;
    sxy += p.goalsPerGame * p.drawRate;
    sx2 += p.goalsPerGame * p.goalsPerGame;
  }
  const denom = n * sx2 - sx * sx;
  if (Math.abs(denom) < 1e-10) return { slope: 0, intercept: sy / n };
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  return { slope, intercept };
}

export function GoalsMapScatter() {
  const [hovered, setHovered] = useState<GoalsMapPoint | null>(null);

  const { data, error, isLoading } = useSWR<GoalsMapResponse>(
    "/api/v1/leagues-stats/goals-map",
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 600_000 },
  );

  const points = data?.points ?? [];

  const { scaleX, scaleY, regLine, xDomain, yDomain } = useMemo(() => {
    if (points.length === 0) {
      return {
        scaleX: makeScale([1.5, 4.5], [M.left, W - M.right]),
        scaleY: makeScale([10, 50], [H - M.bottom, M.top]),
        regLine: null,
        xDomain: [1.5, 4.5] as [number, number],
        yDomain: [10, 50] as [number, number],
      };
    }
    const gpgs = points.map((p) => p.goalsPerGame);
    const drs = points.map((p) => p.drawRate);
    const xMin = Math.floor(Math.min(...gpgs) * 10) / 10 - 0.2;
    const xMax = Math.ceil(Math.max(...gpgs) * 10) / 10 + 0.2;
    const yMin = Math.floor(Math.min(...drs)) - 3;
    const yMax = Math.ceil(Math.max(...drs)) + 3;

    const sx = makeScale([xMin, xMax], [M.left, W - M.right]);
    const sy = makeScale([yMin, yMax], [H - M.bottom, M.top]);
    const reg = regression(points);

    // fit line endpoints
    const line: [number, number, number, number] = [
      xMin,
      reg.slope * xMin + reg.intercept,
      xMax,
      reg.slope * xMax + reg.intercept,
    ];

    return { scaleX: sx, scaleY: sy, regLine: line, xDomain: [xMin, xMax], yDomain: [yMin, yMax] };
  }, [points]);

  // radius scale (min 3, max 8) based on gamesPlayed
  const maxGp = points.length > 0 ? Math.max(...points.map((p) => p.gamesPlayed)) : 1;
  const radiusOf = (gp: number) => 3 + (gp / maxGp) * 5;

  // axis ticks
  const xTicks = useMemo(() => {
    const [min, max] = xDomain;
    const step = Math.ceil((max - min) / 6 * 10) / 10;
    const ticks: number[] = [];
    for (let v = Math.ceil(min / step) * step; v <= max; v += step) ticks.push(Math.round(v * 10) / 10);
    return ticks;
  }, [xDomain]);

  const yTicks = useMemo(() => {
    const [min, max] = yDomain;
    const step = Math.ceil((max - min) / 5);
    const ticks: number[] = [];
    for (let v = Math.ceil(min / step) * step; v <= max; v += step) ticks.push(v);
    return ticks;
  }, [yDomain]);

  if (isLoading) {
    return <Skeleton className="h-80 w-full rounded-xl" />;
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/5 p-4 text-sm text-rose-700">
        <AlertCircle className="h-4 w-4" />
        <span>Erreur chargement Goals Map</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-white p-4 dark:bg-card">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Map className="h-4 w-4 text-emerald-500" />
          <span className="text-sm font-semibold">Goals Map — {points.length} ligues</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          {Object.entries(CLUSTER_COLORS).map(([label, color]) => (
            <span key={label} className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
              <span className="text-muted-foreground">{label}</span>
            </span>
          ))}
        </div>
      </div>

      {/* SVG scatter */}
      <div className="relative">
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          className="block w-full"
          aria-label="Scatter plot: buts par match vs taux de nul par ligue"
        >
          {/* grid lines */}
          {xTicks.map((v) => (
            <line
              key={`gx-${v}`}
              x1={scaleX(v)}
              y1={M.top}
              x2={scaleX(v)}
              y2={H - M.bottom}
              stroke="#f0f0f0"
              strokeWidth={1}
            />
          ))}
          {yTicks.map((v) => (
            <line
              key={`gy-${v}`}
              x1={M.left}
              y1={scaleY(v)}
              x2={W - M.right}
              y2={scaleY(v)}
              stroke="#f0f0f0"
              strokeWidth={1}
            />
          ))}

          {/* axes */}
          <line x1={M.left} y1={M.top} x2={M.left} y2={H - M.bottom} stroke="#e5e5e5" strokeWidth={1} />
          <line x1={M.left} y1={H - M.bottom} x2={W - M.right} y2={H - M.bottom} stroke="#e5e5e5" strokeWidth={1} />

          {/* axis labels */}
          {xTicks.map((v) => (
            <text
              key={`lx-${v}`}
              x={scaleX(v)}
              y={H - M.bottom + 16}
              textAnchor="middle"
              fontSize={10}
              fill="#9e9e9e"
              fontFamily="ui-monospace, monospace"
            >
              {v.toFixed(1)}
            </text>
          ))}
          {yTicks.map((v) => (
            <text
              key={`ly-${v}`}
              x={M.left - 8}
              y={scaleY(v) + 3}
              textAnchor="end"
              fontSize={10}
              fill="#9e9e9e"
              fontFamily="ui-monospace, monospace"
            >
              {v}%
            </text>
          ))}

          {/* axis titles */}
          <text x={M.left + PLOT_W / 2} y={H - 4} textAnchor="middle" fontSize={11} fill="#717171">
            Buts / match
          </text>
          <text
            x={14}
            y={M.top + PLOT_H / 2}
            textAnchor="middle"
            fontSize={11}
            fill="#717171"
            transform={`rotate(-90, 14, ${M.top + PLOT_H / 2})`}
          >
            Taux de nul
          </text>

          {/* regression line */}
          {regLine && (
            <line
              x1={scaleX(regLine[0])}
              y1={scaleY(regLine[1])}
              x2={scaleX(regLine[2])}
              y2={scaleY(regLine[3])}
              stroke="#fb923c"
              strokeWidth={1.5}
              strokeDasharray="6 4"
              opacity={0.7}
            />
          )}

          {/* data points */}
          {points.map((p) => {
            const cx = scaleX(p.goalsPerGame);
            const cy = scaleY(p.drawRate);
            const r = radiusOf(p.gamesPlayed);
            const cluster = classify(p.goalsPerGame, p.drawRate);
            const color = CLUSTER_COLORS[cluster] ?? "#94a3b8";
            const isHovered = hovered?.league === p.league;

            return (
              <g
                key={`${p.country}/${p.slug}`}
                onMouseEnter={() => setHovered(p)}
                onMouseLeave={() => setHovered(null)}
                className="cursor-pointer"
              >
                <circle
                  cx={cx}
                  cy={cy}
                  r={r + 2}
                  fill="transparent"
                  stroke="none"
                />
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? r + 1.5 : r}
                  fill={color}
                  opacity={isHovered ? 1 : 0.75}
                  stroke={isHovered ? "white" : "none"}
                  strokeWidth={isHovered ? 2 : 0}
                  style={{ transition: "r 150ms, opacity 150ms" }}
                />
                {isHovered && (
                  <circle cx={cx} cy={cy} r={r + 3} fill="none" stroke={color} strokeWidth={1} opacity={0.4} />
                )}
              </g>
            );
          })}

          {/* cluster separators (dashed) */}
          <line
            x1={scaleX(2.8)}
            y1={M.top}
            x2={scaleX(2.8)}
            y2={H - M.bottom}
            stroke="#d4d4d8"
            strokeWidth={1}
            strokeDasharray="4 4"
            opacity={0.5}
          />
          <line
            x1={M.left}
            y1={scaleY(28)}
            x2={W - M.right}
            y2={scaleY(28)}
            stroke="#d4d4d8"
            strokeWidth={1}
            strokeDasharray="4 4"
            opacity={0.5}
          />
        </svg>

        {/* tooltip */}
        {hovered && (
          <div
            className="pointer-events-none absolute z-10 rounded-lg border bg-white px-3 py-2 text-xs shadow-lg dark:bg-card"
            style={{
              left: `${(scaleX(hovered.goalsPerGame) / W) * 100}%`,
              top: `${(scaleY(hovered.drawRate) / H) * 100 - 12}%`,
              transform: "translate(-50%, -100%)",
            }}
          >
            <p className="font-semibold">{hovered.league}</p>
            <p className="text-muted-foreground">
              {hovered.goalsPerGame.toFixed(2)} buts/m · {hovered.drawRate.toFixed(1)}% nuls · {hovered.gamesPlayed} matchs
            </p>
            <p className="text-emerald-600">{classify(hovered.goalsPerGame, hovered.drawRate)}</p>
          </div>
        )}
      </div>
    </div>
  );
}
