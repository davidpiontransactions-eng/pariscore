"use client";

import { cn } from "@/lib/utils";
import { Target, CornerDownRight } from "lucide-react";

/**
 * Graphe de momentum type FotMob — aire horizontale 0'→90'.
 * Vert (domicile) au-dessus de la médiane, bleu (extérieur) en dessous.
 * Marqueurs ⚽ positionnés à la minute de chaque but.
 *
 * SVG inline pur (zéro dépendance). v ∈ [-100,+100] : + = domicile domine.
 */
const W = 940;
const H = 110;
const MID_Y = H / 2; // 55
const PAD_L = 4;
const PAD_R = 4;
const PLOT_W = W - PAD_L - PAD_R;
const MAX_MIN = 90;

type MomentumPoint = { minute: number; value: number };
type Goal = { minute: number; home: boolean; type: string };

function minuteToX(min: number): number {
  return PAD_L + (Math.max(0, Math.min(MAX_MIN, min)) / MAX_MIN) * PLOT_W;
}

function valueToY(v: number): number {
  // v ∈ [-100,+100] → y ∈ [0, H] (haut = +100 domicile, bas = -100 extérieur)
  return MID_Y - (v / 100) * (MID_Y - 6);
}

/** Construit le path d'une aire (polygone fermé sur l'axe médian). */
function buildAreaPath(
  points: MomentumPoint[],
  upper: boolean,
): string {
  if (points.length === 0) return "";
  // On ne garde que les points du bon côté (positive=upper/home, negative=lower/away)
  // + on force la valeur 0 aux points qui traversent (clamp sur la médiane).
  const seg = points
    .map((p) => ({ x: minuteToX(p.minute), y: valueToY(p.value), v: p.value }))
    .filter((p) => (upper ? p.v >= 0 : p.v <= 0));
  if (seg.length === 0) return "";

  const d: string[] = [];
  d.push(`M ${seg[0].x.toFixed(1)} ${MID_Y}`);
  for (const p of seg) d.push(`L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
  d.push(`L ${seg[seg.length - 1].x.toFixed(1)} ${MID_Y}`);
  d.push("Z");
  return d.join(" ");
}

export function MomentumChart({
  momentum,
  goals = [],
  pressure,
  liveStats,
  homeName = "Domicile",
  awayName = "Extérieur",
  className,
}: {
  momentum: MomentumPoint[];
  goals?: Goal[];
  pressure?: { homePct: number; awayPct: number };
  liveStats?: { homeCorners: number; awayCorners: number; homeSOT: number; awaySOT: number };
  homeName?: string;
  awayName?: string;
  className?: string;
}) {
  const sorted = [...momentum].sort((a, b) => a.minute - b.minute);
  const homePath = buildAreaPath(sorted, true);
  const awayPath = buildAreaPath(sorted, false);

  // Ticks : 0', 45' (HT), 90'
  const ticks = [0, 15, 30, 45, 60, 75, 90];

  if (sorted.length === 0) {
    return (
      <div className={cn("flex h-[110px] items-center justify-center rounded-lg bg-muted/40 text-xs text-muted-foreground", className)}>
        Momentum indisponible (match trop tôt ou données BSD absentes)
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      {/* Légende */}
      <div className="mb-1.5 flex items-center justify-between text-[10px] font-medium text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-emerald-500" />
          {homeName}
          {pressure && <span className="ml-1 tabular-nums text-emerald-400/70">{pressure.homePct}%</span>}
        </span>
        <span className="uppercase tracking-wider">Momentum</span>
        <span className="inline-flex items-center gap-1">
          {pressure && <span className="mr-1 tabular-nums text-blue-400/70">{pressure.awayPct}%</span>}
          {awayName}
          <span className="inline-block h-2 w-2 rounded-sm bg-blue-500" />
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" role="img" aria-label="Momentum du match">
        <defs>
          <linearGradient id="mom-home-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0.15" />
          </linearGradient>
          <linearGradient id="mom-away-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.55" />
          </linearGradient>
        </defs>

        {/* Lignes de ticks verticales (grille) */}
        {ticks.map((t) => (
          <line
            key={`tick-${t}`}
            x1={minuteToX(t)}
            y1={0}
            x2={minuteToX(t)}
            y2={H}
            stroke="currentColor"
            strokeOpacity={t === 45 ? 0.3 : 0.1}
            strokeWidth={t === 45 ? 1.5 : 1}
            className="text-muted-foreground"
          />
        ))}

        {/* Ligne médiane */}
        <line x1={PAD_L} y1={MID_Y} x2={W - PAD_R} y2={MID_Y} stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" className="text-muted-foreground" />

        {/* Aires */}
        {homePath && <path d={homePath} fill="url(#mom-home-grad)" stroke="#22c55e" strokeWidth="1.5" strokeOpacity="0.7" />}
        {awayPath && <path d={awayPath} fill="url(#mom-away-grad)" stroke="#3b82f6" strokeWidth="1.5" strokeOpacity="0.7" />}

        {/* Marqueurs de buts ⚽ */}
        {goals.map((g, i) => {
          const x = minuteToX(g.minute);
          const color = g.home ? "#22c55e" : "#3b82f6";
          const isOwn = g.type === "own";
          return (
            <g key={`goal-${i}`}>
              <line x1={x} y1={0} x2={x} y2={H} stroke={color} strokeOpacity="0.4" strokeWidth="1" strokeDasharray="2 3" />
              <circle cx={x} cy={g.home ? 10 : H - 10} r="7" fill={color} />
              <text x={x} y={g.home ? 14 : H - 6} fontSize="9" fontWeight="bold" fill="#fff" textAnchor="middle">
                {isOwn ? "⊘" : "⚽"}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Axe des minutes */}
      <div className="mt-1 flex justify-between text-[9px] text-muted-foreground/70">
        <span>1&apos;</span>
        <span>45&apos; HT</span>
        <span>90&apos;</span>
      </div>

      {/* Live stats summary — tirs cadrés + corners */}
      {liveStats && (liveStats.homeSOT > 0 || liveStats.awaySOT > 0 || liveStats.homeCorners > 0 || liveStats.awayCorners > 0) && (
        <div className="mt-2 flex items-center justify-center gap-6 border-t border-border/30 pt-2 text-[10px]">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1 text-emerald-400">
              <Target className="h-3 w-3" />
              <span className="tabular-nums font-semibold">{liveStats.homeSOT}</span>
              <span className="text-muted-foreground/60">tirs cd.</span>
            </span>
            <span className="text-muted-foreground/30">—</span>
            <span className="inline-flex items-center gap-1 text-blue-400">
              <span className="tabular-nums font-semibold">{liveStats.awaySOT}</span>
              <span className="text-muted-foreground/60">tirs cd.</span>
              <Target className="h-3 w-3" />
            </span>
          </div>
          <span className="text-muted-foreground/20">|</span>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1 text-emerald-400">
              <CornerDownRight className="h-3 w-3" />
              <span className="tabular-nums font-semibold">{liveStats.homeCorners}</span>
              <span className="text-muted-foreground/60">corn.</span>
            </span>
            <span className="text-muted-foreground/30">—</span>
            <span className="inline-flex items-center gap-1 text-blue-400">
              <span className="tabular-nums font-semibold">{liveStats.awayCorners}</span>
              <span className="text-muted-foreground/60">corn.</span>
              <CornerDownRight className="h-3 w-3" />
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
