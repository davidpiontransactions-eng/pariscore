"use client";

import { useEffect, useRef } from "react";

type TeamTrendData = {
  name: string;
  color: string;
  ppgHistory: number[]; // PPG après chaque journée (longueur = J jouées)
  currentPpg: number;
  rank: number;
  rankTotal: number;
  matchesPlayed: number;
};

type GraphProps = {
  homeTeam: TeamTrendData;
  awayTeam: TeamTrendData;
  leagueName: string;
  showProjection?: boolean;
};

const W = 320;
const H = 180;
const M = { top: 22, right: 16, bottom: 28, left: 32 };

function scaleY(values: number[]): { min: number; max: number; range: number; toY: (v: number) => number } {
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const range = max - min || 1;
  const plotH = H - M.top - M.bottom;
  return {
    min,
    max,
    range,
    toY: (v: number) => M.top + ((max - v) / range) * plotH,
  };
}

function pathFor(data: number[], toY: (v: number) => number): string {
  if (data.length === 0) return "";
  const plotW = W - M.left - M.right;
  const step = data.length > 1 ? plotW / (data.length - 1) : 0;
  return data.map((v, i) => `${i === 0 ? "M" : "L"}${(M.left + i * step).toFixed(1)} ${toY(v).toFixed(1)}`).join(" ");
}

function projectionPath(
  data: number[],
  toY: (v: number) => number,
  steps = 5,
): string {
  if (data.length < 2) return "";
  // pente linéaire sur les 5 dernières journées (régression simple)
  const n = Math.min(5, data.length - 1);
  const y0 = data[data.length - 1 - n];
  const y1 = data[data.length - 1];
  const slope = (y1 - y0) / n;
  const plotW = W - M.left - M.right;
  const step = data.length > 1 ? plotW / (data.length - 1) : plotW;
  const baseX = M.left + (data.length - 1) * step;
  const pts: string[] = [`M${baseX.toFixed(1)} ${toY(y1).toFixed(1)}`];
  for (let i = 1; i <= steps; i++) {
    const v = y1 + slope * i;
    pts.push(`L${(baseX + i * step).toFixed(1)} ${toY(v).toFixed(1)}`);
  }
  return pts.join(" ");
}

export function FootballRankingGraph({ homeTeam, awayTeam, leagueName, showProjection = true }: GraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Fallback si pas d'historique : on génère une droite plate depuis currentPpg
  const ppgH = homeTeam.ppgHistory.length > 0 ? homeTeam.ppgHistory : [homeTeam.currentPpg];
  const ppgA = awayTeam.ppgHistory.length > 0 ? awayTeam.ppgHistory : [awayTeam.currentPpg];
  const all = [...ppgH, ...ppgA];
  const { toY } = scaleY(all);

  const dH = pathFor(ppgH, toY);
  const dA = pathFor(ppgA, toY);
  const projH = showProjection ? projectionPath(ppgH, toY) : "";
  const projA = showProjection ? projectionPath(ppgA, toY) : "";

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = W * dpr;
    c.height = H * dpr;
    c.style.width = `${W}px`;
    c.style.height = `${H}px`;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    // grille
    ctx.strokeStyle = "#f0f0f0";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = M.top + (i * (H - M.top - M.bottom)) / 4;
      ctx.beginPath();
      ctx.moveTo(M.left, y);
      ctx.lineTo(W - M.right, y);
      ctx.stroke();
    }
    // axes
    ctx.strokeStyle = "#e5e5e5";
    ctx.beginPath();
    ctx.moveTo(M.left, M.top);
    ctx.lineTo(M.left, H - M.bottom);
    ctx.lineTo(W - M.right, H - M.bottom);
    ctx.stroke();
  }, [ppgH, ppgA, showProjection]);

  return (
    <div className="w-full rounded-xl border bg-white p-3" style={{ borderColor: "#f0f0f0" }}>
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-semibold" style={{ color: "#222" }}>{leagueName} — PPG / journée</span>
        <span style={{ color: "#717171" }}>J{Math.max(ppgH.length, ppgA.length)} • proj. {showProjection ? "5J" : "off"}</span>
      </div>

      <div className="relative">
        {/* SVG courbes (vectoriel, net) */}
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block w-full" aria-label={`Courbe PPG ${homeTeam.name} vs ${awayTeam.name}`}>
          {/* courbes histoire */}
          {dH && <path d={dH} fill="none" stroke={homeTeam.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
          {dA && <path d={dA} fill="none" stroke={awayTeam.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
          {/* projections pointillées */}
          {projH && <path d={projH} fill="none" stroke={homeTeam.color} strokeWidth={1.5} strokeDasharray="5 4" opacity={0.7} />}
          {projA && <path d={projA} fill="none" stroke={awayTeam.color} strokeWidth={1.5} strokeDasharray="5 4" opacity={0.7} />}
          {/* points actuels */}
          {ppgH.length > 0 && (
            <circle
              cx={M.left + (ppgH.length - 1) * ((W - M.left - M.right) / Math.max(ppgH.length - 1, 1))}
              cy={toY(ppgH[ppgH.length - 1])}
              r={3.5}
              fill={homeTeam.color}
              stroke="white"
              strokeWidth={1.5}
            />
          )}
          {ppgA.length > 0 && (
            <circle
              cx={M.left + (ppgA.length - 1) * ((W - M.left - M.right) / Math.max(ppgA.length - 1, 1))}
              cy={toY(ppgA[ppgA.length - 1])}
              r={3.5}
              fill={awayTeam.color}
              stroke="white"
              strokeWidth={1.5}
            />
          )}
        </svg>
        <canvas ref={canvasRef} width={W} height={H} className="pointer-events-none absolute inset-0 -z-10 opacity-0" aria-hidden />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs tabular-nums">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: homeTeam.color }} />
          <span className="font-semibold" style={{ color: "#222" }}>{homeTeam.name}</span>
          <span style={{ color: "#717171" }}>{homeTeam.currentPpg.toFixed(2)} PPG • #{homeTeam.rank}/{homeTeam.rankTotal} • {homeTeam.matchesPlayed}J</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: awayTeam.color }} />
          <span className="font-semibold" style={{ color: "#222" }}>{awayTeam.name}</span>
          <span style={{ color: "#717171" }}>{awayTeam.currentPpg.toFixed(2)} PPG • #{awayTeam.rank}/{awayTeam.rankTotal} • {awayTeam.matchesPlayed}J</span>
        </span>
        {showProjection && <span className="ml-auto" style={{ color: "#9e9e9e" }}>— projection linéaire 5J (tendance L5)</span>}
      </div>
    </div>
  );
}
