"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Target, CornerDownRight, ChevronRight } from "lucide-react";
import type { DangerousBucket, MatchEvent, MatchTimelineData } from "@/lib/football-timeline";

/**
 * Graphe de momentum type FotMob — aire horizontale 0'→90'.
 *
 * Couches (toggles interactifs) :
 *  - Momentum     : aire bicolore (vert > 0 domicile, bleu < 0 extérieur)
 *  - Attaques     : mini-histogramme fond (barres home ↑ / away ↓)
 *  - Buts & Buteurs : badges ⚽ + <title> (buteur, minute, score, xG)
 *  - Corners      : triangles colorés par camp sur la ligne des minutes
 *
 * SVG inline pur (zéro dépendance). v ∈ [-100,+100] : + = domicile domine.
 * Chaque couche est optionnelle — `layers` signale ce qui est réellement
 * disponible (données par minute non garanties sur toutes les ligues).
 */
const W = 940;
const H = 110;
const MID_Y = H / 2;
const PAD_L = 4;
const PAD_R = 4;
const PLOT_W = W - PAD_L - PAD_R;
const MAX_MIN = 90;
const BUCKET_W = PLOT_W / (MAX_MIN / 5);

type MomentumPoint = { minute: number; value: number };
type LayersState = { momentum: boolean; corners: boolean; goals: boolean; dangerous: boolean };

function minuteToX(min: number): number {
  return PAD_L + (Math.max(0, Math.min(MAX_MIN, min)) / MAX_MIN) * PLOT_W;
}

function valueToY(v: number): number {
  // v ∈ [-100,+100] → y ∈ [0, H] (haut = +100 domicile, bas = -100 extérieur)
  return MID_Y - (v / 100) * (MID_Y - 6);
}

/** Construit le path d'une aire (polygone fermé sur l'axe médian). */
function buildAreaPath(points: MomentumPoint[], upper: boolean): string {
  if (points.length === 0) return "";
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

function goalTitle(g: MatchEvent): string {
  const parts: string[] = [];
  if (g.scorer) parts.push(g.scorer);
  parts.push(`${Math.round(g.minute)}'`);
  if (g.goalType === "own") parts.push("csc");
  if (g.goalType === "penalty") parts.push("pen.");
  if (g.score) parts.push(`${g.score.home}-${g.score.away}`);
  if (g.xg != null && Number.isFinite(g.xg)) parts.push(`xG ${Number(g.xg).toFixed(2)}`);
  return parts.join(" · ");
}

// ─── Ticker d'événements agrégés (OddAlerts-style) ─────────────────────────
// « Corner × 4 (6', 6', 9', 11') » — contexte immédiat sans cliquer. On agrège
// les événements par (type × camp) et on liste les minutes cumulées.

const KIND_LABEL: Record<MatchEvent["kind"], string> = {
  goal: "But",
  corner: "Corner",
  shot: "Tir",
};

interface TickerLine {
  key: string;
  side: "home" | "away";
  label: string;
  minutes: number[];
}

/** Agrège les événements par type+camp → lignes du ticker (triées par fréquence). */
export function aggregateEventTicker(events: MatchEvent[]): TickerLine[] {
  const byKey = new Map<string, TickerLine>();
  for (const e of events ?? []) {
    if (!e || !Number.isFinite(e.minute)) continue;
    const key = `${e.kind}:${e.side}`;
    const line = byKey.get(key) ?? { key, side: e.side, label: KIND_LABEL[e.kind] ?? e.kind, minutes: [] };
    line.minutes.push(Math.round(e.minute));
    byKey.set(key, line);
  }
  return [...byKey.values()]
    .map((l) => ({ ...l, minutes: [...l.minutes].sort((a, b) => a - b) }))
    .sort((a, b) => b.minutes.length - a.minutes.length);
}

function TickerRow({ events, homeName, awayName }: { events: MatchEvent[]; homeName: string; awayName: string }) {
  const lines = useMemo(() => aggregateEventTicker(events), [events]);
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (lines.length <= 1) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % lines.length), 4000);
    return () => clearInterval(id);
  }, [lines.length]);
  if (!lines.length) return null;
  const active = lines[Math.min(idx, lines.length - 1)];
  const sideName = active.side === "home" ? homeName : awayName;
  const sideColor = active.side === "home" ? "text-emerald-400" : "text-sky-400";
  const minutesTxt = active.minutes.map((m) => `${m}'`).join(", ");
  const isMulti = active.minutes.length > 1;
  return (
    <div className="mt-1.5 flex items-center gap-1.5 rounded-md bg-muted/40 px-2 py-1 text-[11px]">
      <span className={cn("font-semibold truncate", sideColor)}>{sideName}</span>
      <span className="text-muted-foreground/80 whitespace-nowrap">
        {active.label}
        {isMulti ? ` × ${active.minutes.length}` : ""}
      </span>
      <span className="truncate tabular-nums text-muted-foreground/60">({minutesTxt})</span>
      {lines.length > 1 && (
        <button
          type="button"
          aria-label="Événement suivant"
          onClick={() => setIdx((i) => (i + 1) % lines.length)}
          className="ml-auto flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <ChevronRight className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function ToggleChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide transition-colors",
        active
          ? "border-border bg-muted text-foreground"
          : "border-transparent text-muted-foreground/50 hover:text-muted-foreground",
      )}
    >
      {label}
    </button>
  );
}

export function MomentumChart({
  momentum,
  events = [],
  dangerous = [],
  pressure,
  liveStats,
  layers,
  homeName = "Domicile",
  awayName = "Extérieur",
  className,
}: {
  momentum: MomentumPoint[];
  events?: MatchEvent[];
  dangerous?: DangerousBucket[];
  pressure?: { homePct: number; awayPct: number };
  liveStats?: { homeCorners: number; awayCorners: number; homeSOT: number; awaySOT: number };
  layers?: MatchTimelineData["layers"];
  homeName?: string;
  awayName?: string;
  className?: string;
}) {
  const [toggles, setToggles] = useState<LayersState>({
    momentum: true,
    corners: true,
    goals: true,
    dangerous: true,
  });

  const sorted = [...momentum].sort((a, b) => a.minute - b.minute);
  const homePath = toggles.momentum ? buildAreaPath(sorted, true) : "";
  const awayPath = toggles.momentum ? buildAreaPath(sorted, false) : "";
  const goals = (events ?? []).filter((e) => e.kind === "goal" && Number.isFinite(e.minute));
  const corners = (events ?? []).filter((e) => e.kind === "corner" && Number.isFinite(e.minute));
  const maxDanger = dangerous.reduce((mx, b) => Math.max(mx, b.home, b.away), 0);

  // Disponibilité réelle des couches (si le serveur signale les données).
  const layerOn = (key: "goals" | "corners" | "dangerous") =>
    (layers ? layers[key] : true) && toggles[key];

  const canShowGoals = layerOn("goals") && goals.length > 0;
  const canShowCorners = layerOn("corners") && corners.length > 0;
  const canShowDangerous = layerOn("dangerous") && dangerous.length > 0;
  const isEstimated = !layers?.perMinute;
  const ticks = [0, 15, 30, 45, 60, 75, 90];

  if (sorted.length === 0) {
    return (
      <div className={cn("flex h-[110px] items-center justify-center rounded-lg bg-muted/40 text-xs text-muted-foreground", className)}>
        Momentum indisponible (match trop tôt)
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      {/* Légende */}
      <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-muted-foreground">
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

      {/* Toggles de couches */}
      <div className="mb-1 flex flex-wrap items-center gap-1" role="group" aria-label="Couches du graphe">
        <ToggleChip label="Momentum" active={toggles.momentum} onClick={() => setToggles((t) => ({ ...t, momentum: !t.momentum }))} />
        <ToggleChip label="Attaques" active={canShowDangerous} onClick={() => setToggles((t) => ({ ...t, dangerous: !t.dangerous }))} />
        <ToggleChip label="Buts" active={canShowGoals} onClick={() => setToggles((t) => ({ ...t, goals: !t.goals }))} />
        <ToggleChip label="Corners" active={canShowCorners} onClick={() => setToggles((t) => ({ ...t, corners: !t.corners }))} />
        {isEstimated && (
          <span className="ml-auto text-[11px] italic text-muted-foreground/50">courbe estimée (pas de données par minute)</span>
        )}
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

        {/* Couche Attaques dangereuses : mini-histogramme (fond) */}
        {canShowDangerous &&
          dangerous.map((b) => {
            if (maxDanger <= 0) return null;
            const x = minuteToX(b.start);
            const hHome = Math.max(2, (b.home / maxDanger) * (MID_Y - 8));
            const hAway = Math.max(2, (b.away / maxDanger) * (MID_Y - 8));
            return (
              <g key={`danger-${b.start}`}>
                {b.home > 0 && (
                  <rect x={x} y={MID_Y - hHome} width={BUCKET_W - 1.5} height={hHome} fill="#22c55e" fillOpacity="0.14" />
                )}
                {b.away > 0 && (
                  <rect x={x} y={MID_Y} width={BUCKET_W - 1.5} height={hAway} fill="#3b82f6" fillOpacity="0.14" />
                )}
              </g>
            );
          })}

        {/* Couche Momentum : aires */}
        {homePath && <path d={homePath} fill="url(#mom-home-grad)" stroke="#22c55e" strokeWidth="1.5" strokeOpacity="0.7" />}
        {awayPath && <path d={awayPath} fill="url(#mom-away-grad)" stroke="#3b82f6" strokeWidth="1.5" strokeOpacity="0.7" />}

        {/* Couche Corners : drapeaux triangles sur la ligne des minutes */}
        {canShowCorners &&
          corners.map((c, i) => {
            const x = minuteToX(c.minute);
            const home = c.side === "home";
            const color = home ? "#22c55e" : "#3b82f6";
            const yBase = home ? H - 6 : 6;
            return (
              <g key={`corner-${i}`}>
                <title>{`Corner ${home ? homeName : awayName} ${Math.round(c.minute)}'`}</title>
                <polygon
                  points={home
                    ? `${x - 3.5},${yBase} ${x + 3.5},${yBase} ${x},${yBase - 6}`
                    : `${x - 3.5},${yBase} ${x + 3.5},${yBase} ${x},${yBase + 6}`}
                  fill={color}
                  fillOpacity="0.85"
                />
              </g>
            );
          })}

        {/* Couche Buts & Buteurs : badges ⚽ */}
        {canShowGoals &&
          goals.map((g, i) => {
            const x = minuteToX(g.minute);
            const home = g.side === "home";
            const color = home ? "#22c55e" : "#3b82f6";
            return (
              <g key={`goal-${i}`}>
                <title>{goalTitle(g)}</title>
                <line x1={x} y1={0} x2={x} y2={H} stroke={color} strokeOpacity="0.4" strokeWidth="1" strokeDasharray="2 3" />
                <circle cx={x} cy={home ? 10 : H - 10} r="7" fill={color} />
                <text x={x} y={home ? 14 : H - 6} fontSize="9" fontWeight="bold" fill="#fff" textAnchor="middle">
                  {g.goalType === "own" ? "⊘" : "⚽"}
                </text>
              </g>
            );
          })}
      </svg>

      {/* Axe des minutes */}
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground/70">
        <span>1&apos;</span>
        <span>45&apos; HT</span>
        <span>90&apos;</span>
      </div>

      {/* Ticker d'événements agrégés (Corner × 4 (6', 6', 9', 11')…) */}
      {events.length > 0 && <TickerRow events={events} homeName={homeName} awayName={awayName} />}

      {/* Live stats summary — tirs cadrés + corners */}
      {liveStats && (liveStats.homeSOT > 0 || liveStats.awaySOT > 0 || liveStats.homeCorners > 0 || liveStats.awayCorners > 0) && (
        <div className="mt-2 flex items-center justify-center gap-6 border-t border-border/30 pt-2 text-[11px]">
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