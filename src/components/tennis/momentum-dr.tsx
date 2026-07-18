"use client";

import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMomentumDR } from "@/hooks/use-momentum-dr";
import type { LiveMatchState } from "@/hooks/use-live-matches";
import { cn } from "@/lib/utils";

const DR_HISTORY_MAX = 36;
const SPARK_H = 72;
const SPARK_MARGIN = 2;
const DOT_R = 2.5;

interface TooltipData {
  x: number;
  y: number;
  dr: number;
  set: number;
  game: number;
  breakPoint: boolean;
}

interface MomentumDRProps {
  liveState: LiveMatchState;
  player1Name: string;
  player2Name: string;
  player1Color?: string;
  player2Color?: string;
  className?: string;
  momentumSeries?: {
    games: { n: number; w: number; brk: boolean; v: number; run: number; set: number }[];
  } | null;
}

function qualLabel(absDr: number, p1Dom: boolean): string {
  if (absDr < 0.12) return "Neutre";
  if (absDr < 0.30) return p1Dom ? "Léger avantage" : "Léger désavantage";
  if (absDr < 0.55) return p1Dom ? "Momentum" : "Sous pression";
  return p1Dom ? "Dominant" : "Dominé";
}

function buildPath(data: number[], w: number, h: number): string {
  if (data.length < 2) return "";
  const mid = h / 2;
  const range = h / 2 - SPARK_MARGIN;
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,
    y: mid - Math.max(-1, Math.min(1, v)) * range,
  }));
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const cp1x = p0.x + (p1.x - p0.x) / 2;
    d += ` C${cp1x},${p0.y} ${cp1x},${p1.y} ${p1.x},${p1.y}`;
  }
  return d;
}

export function MomentumDR({
  liveState,
  player1Name,
  player2Name,
  player1Color = "#22c55e",
  player2Color = "#3b82f6",
  className,
  momentumSeries,
}: MomentumDRProps) {
  const {
    momentumA,
    momentumB,
    dr,
    pointsTracked,
    pointHistory,
    drHistory,
    currentSet,
    setWinners,
    settled,
    server,
  } = useMomentumDR(liveState);

  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartW, setChartW] = useState(240);

  const p1Dom = momentumA > momentumB;
  const p2Dom = momentumB > momentumA;
  const isNeut = !p1Dom && !p2Dom;
  const absDr = Math.abs(dr);
  const label = useMemo(() => qualLabel(absDr, p1Dom), [absDr, p1Dom]);
  const p1Short = player1Name.split(" ").pop() || player1Name;
  const p2Short = player2Name.split(" ").pop() || player2Name;

  const labelColor = isNeut
    ? "text-muted-foreground"
    : p1Dom
    ? "text-emerald-500"
    : "text-blue-500";

  const barColorP1 = p1Dom ? player1Color : "hsl(var(--muted-foreground) / 0.25)";
  const barColorP2 = p2Dom ? player2Color : "hsl(var(--muted-foreground) / 0.25)";

  useEffect(() => {
    function resize() {
      if (containerRef.current) {
        setChartW(containerRef.current.clientWidth - 32);
      }
    }
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const setDividers = useMemo(() => {
    if (drHistory.length < 2) return [];
    const divs: { x: number; set: number }[] = [];
    const historiesBySet: number[][] = [];
    for (const pt of pointHistory) {
      while (pt.set > historiesBySet.length) historiesBySet.push([]);
      if (historiesBySet[pt.set - 1]) historiesBySet[pt.set - 1].push(pt.tick);
    }
    for (let s = 1; s < historiesBySet.length; s++) {
      const idx = historiesBySet.slice(0, s).reduce((sum, arr) => sum + arr.length, 0) - 1;
      if (idx >= 0 && idx < drHistory.length - 1) {
        divs.push({ x: ((idx + 1) / drHistory.length) * chartW, set: s });
      }
    }
    return divs;
  }, [drHistory, pointHistory, chartW]);

  const breakIndices = useMemo(() => {
    return pointHistory
      .map((pt, i) => (pt.wasBreakPoint ? i : null))
      .filter((i): i is number => i !== null);
  }, [pointHistory]);

  const serverLabel = server === "A" ? p1Short : p2Short;

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (drHistory.length < 2 || !containerRef.current) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      const svgW = rect.width;
      const idx = Math.round((relX / svgW) * (drHistory.length - 1));
      const clamped = Math.max(0, Math.min(drHistory.length - 1, idx));
      const pt = pointHistory[clamped];
      if (!pt) return;
      const y = SPARK_H / 2 - Math.max(-1, Math.min(1, drHistory[clamped])) * (SPARK_H / 2 - SPARK_MARGIN);
      setTooltip({
        x: (clamped / (drHistory.length - 1)) * svgW,
        y,
        dr: drHistory[clamped],
        set: pt.set,
        game: pt.game,
        breakPoint: pt.wasBreakPoint,
      });
    },
    [drHistory, pointHistory],
  );

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={cn(
        "rounded-lg border border-border/60 bg-muted/20 p-3",
        "transition-all duration-500",
        settled && pointsTracked > 8 ? "opacity-100" : "opacity-60",
        "sm:p-3 p-2",
        className,
      )}
      ref={containerRef}
    >
      {/* Header */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="mb-2 flex w-full items-center justify-between"
      >
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Momentum DR
        </span>
        <span className={cn("text-[10px] font-semibold uppercase tracking-wider", labelColor)}>
          {label}
        </span>
      </button>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            {/* Balance Bar */}
            <div className="relative mb-2 h-7 overflow-hidden rounded-md bg-muted-foreground/10">
              <motion.div
                className="absolute left-0 top-0 h-full"
                style={{ background: `linear-gradient(90deg, ${player1Color}88, ${player1Color}44)` }}
                animate={{ width: `${momentumA}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
              <motion.div
                className="absolute right-0 top-0 h-full"
                style={{ background: `linear-gradient(270deg, ${player2Color}88, ${player2Color}44)` }}
                animate={{ width: `${momentumB}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
              <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-muted-foreground/30" />
              <motion.div
                className="absolute top-0 flex h-full items-center justify-center"
                animate={{ left: `${50 + dr * 50}%` }}
                transition={{ duration: 0.3, ease: "easeOut", type: "spring", stiffness: 300, damping: 25 }}
              >
                <div
                  className={cn(
                    "h-5 w-0.5 rounded-full shadow-sm transition-colors duration-300",
                    p1Dom && "bg-emerald-400",
                    p2Dom && "bg-blue-400",
                    isNeut && "bg-muted-foreground/50",
                  )}
                />
              </motion.div>
            </div>

            {/* Labels row */}
            <div className="mb-2 flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: player1Color }} />
                <span className="truncate font-semibold text-foreground">{p1Short}</span>
                <span className={cn("shrink-0 font-mono font-bold tabular-nums", p1Dom ? "text-emerald-500" : "text-muted-foreground")}>
                  {momentumA}%
                </span>
              </div>
              <span className="mx-1 shrink-0 font-mono text-[10px] font-bold tabular-nums text-muted-foreground">
                {dr >= 0 ? "+" : ""}{(dr * 100).toFixed(0)}
              </span>
              <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
                <span className={cn("shrink-0 font-mono font-bold tabular-nums", p2Dom ? "text-blue-500" : "text-muted-foreground")}>
                  {momentumB}%
                </span>
                <span className="truncate font-semibold text-foreground">{p2Short}</span>
                <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: player2Color }} />
              </div>
            </div>

            {/* Serve indicator */}
            <div className="mb-1.5 text-center">
              <span className="rounded-full bg-muted-foreground/10 px-2 py-0.5 text-[8px] font-mono text-muted-foreground/60">
                Service: {serverLabel}
              </span>
            </div>

            {/* DR History Sparkline */}
            <div className="relative" style={{ height: SPARK_H }}>
              <svg
                width="100%"
                height={SPARK_H}
                viewBox={`0 0 ${chartW} ${SPARK_H}`}
                preserveAspectRatio="none"
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                className="cursor-crosshair overflow-visible"
              >
                {/* Grid lines */}
                {[-0.5, 0, 0.5].map((v) => (
                  <line
                    key={v}
                    x1={0}
                    y1={SPARK_H / 2 - v * (SPARK_H / 2 - SPARK_MARGIN)}
                    x2={chartW}
                    y2={SPARK_H / 2 - v * (SPARK_H / 2 - SPARK_MARGIN)}
                    stroke="hsl(var(--muted-foreground) / 0.12)"
                    strokeWidth={0.5}
                    strokeDasharray={v === 0 ? "none" : "2 3"}
                  />
                ))}

                {/* Set dividers */}
                {setDividers.map((d) => (
                  <line
                    key={`sd-${d.set}`}
                    x1={d.x}
                    y1={0}
                    x2={d.x}
                    y2={SPARK_H}
                    stroke="hsl(var(--muted-foreground) / 0.25)"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                  />
                ))}

                {/* Set labels */}
                {setDividers.map((d) => (
                  <text
                    key={`sl-${d.set}`}
                    x={d.x}
                    y={SPARK_H - 1}
                    fill="hsl(var(--muted-foreground) / 0.35)"
                    fontSize={7}
                    fontFamily="monospace"
                    textAnchor="middle"
                  >{`S${d.set + 1}`}</text>
                ))}

                {drHistory.length > 1 && (
                  <>
                    {/* Area fill */}
                    <path
                      d={
                        buildPath(drHistory, chartW, SPARK_H) +
                        ` L${chartW} ${SPARK_H / 2} L0 ${SPARK_H / 2} Z`
                      }
                      fill={dr >= 0 ? player1Color : player2Color}
                      fillOpacity={0.08}
                    />
                    {/* DR line */}
                    <motion.path
                      d={buildPath(drHistory, chartW, SPARK_H)}
                      fill="none"
                      stroke={dr >= 0 ? player1Color : player2Color}
                      strokeWidth={1.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.8, ease: "easeInOut" }}
                    />
                    {/* Break markers */}
                    {breakIndices.map((bi) => {
                      if (bi >= drHistory.length || drHistory.length < 2) return null;
                      const x = (bi / (drHistory.length - 1)) * chartW;
                      const y = SPARK_H / 2 - Math.max(-1, Math.min(1, drHistory[bi])) * (SPARK_H / 2 - SPARK_MARGIN);
                      return (
                        <g key={`brk-${bi}`}>
                          <circle cx={x} cy={y} r={DOT_R + 2} fill={drHistory[bi] >= 0 ? player1Color : player2Color} opacity={0.2} />
                          <circle cx={x} cy={y} r={DOT_R} fill={drHistory[bi] >= 0 ? player1Color : player2Color} stroke="#fff" strokeWidth={0.8} />
                        </g>
                      );
                    })}
                    {/* Data dots (every 4th) */}
                    {drHistory.map((v, i) => {
                      if (i % 4 !== 0 && i !== drHistory.length - 1) return null;
                      const x = (i / (drHistory.length - 1)) * chartW;
                      const y = SPARK_H / 2 - Math.max(-1, Math.min(1, v)) * (SPARK_H / 2 - SPARK_MARGIN);
                      return (
                        <circle
                          key={`dp-${i}`}
                          cx={x}
                          cy={y}
                          r={1.2}
                          fill={v >= 0 ? player1Color : player2Color}
                          opacity={0.5}
                        />
                      );
                    })}
                    {/* Current dot */}
                    <motion.circle
                      cx={chartW}
                      cy={SPARK_H / 2 - Math.max(-1, Math.min(1, dr)) * (SPARK_H / 2 - SPARK_MARGIN)}
                      r={3}
                      fill={dr >= 0 ? player1Color : player2Color}
                      stroke="hsl(var(--background))"
                      strokeWidth={1.5}
                      initial={{ r: 0 }}
                      animate={{ r: 3 }}
                      transition={{ duration: 0.3 }}
                    />
                  </>
                )}
              </svg>

              {/* Tooltip */}
              <AnimatePresence>
                {tooltip && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.15 }}
                    className="pointer-events-none absolute -translate-x-1/2 -translate-y-full"
                    style={{
                      left: tooltip.x,
                      top: tooltip.y - 8,
                    }}
                  >
                    <div className="rounded-md border border-border/60 bg-popover px-2 py-1 text-[10px] shadow-lg">
                      <div className="flex items-center gap-2 font-mono tabular-nums">
                        <span className={tooltip.dr >= 0 ? "text-emerald-500" : "text-blue-500"}>
                          DR {(tooltip.dr * 100).toFixed(0)}
                        </span>
                        <span className="text-muted-foreground/60">·</span>
                        <span className="text-muted-foreground">
                          S{tooltip.set} G{tooltip.game}
                        </span>
                        {tooltip.breakPoint && (
                          <>
                            <span className="text-muted-foreground/60">·</span>
                            <span className="text-amber-500 font-bold">BREAK</span>
                          </>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Y-axis labels */}
              <span className="absolute -top-0.5 right-0 text-[8px] font-mono text-muted-foreground/40">+1</span>
              <span className="absolute -bottom-0.5 right-0 text-[8px] font-mono text-muted-foreground/40">-1</span>
              <AnimatePresence>
                {setWinners.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute -top-0.5 left-0 flex gap-1"
                  >
                    {setWinners.map((w, i) => (
                      <span
                        key={i}
                        className={cn(
                          "inline-block rounded-sm px-1 text-[7px] font-bold leading-[12px]",
                          w === "A" && "bg-emerald-500/20 text-emerald-500",
                          w === "B" && "bg-blue-500/20 text-blue-500",
                          !w && "bg-muted-foreground/10 text-muted-foreground/50",
                        )}
                      >
                        S{i + 1} {w === "A" ? p1Short[0] : w === "B" ? p2Short[0] : "—"}
                      </span>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="mt-1 flex items-center justify-between text-[9px] text-muted-foreground/50">
              <span>{pointsTracked} pts suivis</span>
              {momentumSeries?.games && (
                <span>+ {momentumSeries.games.length} jeux (serveur)</span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
