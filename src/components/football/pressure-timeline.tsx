"use client";

// PressureTimeline — timeline de pression minute par minute, style PackBall.
//
// Le MomentumChart (momentum-chart.tsx) montre une AIRE lissée 0'→90'.
// Cette timeline ajoute la lecture "barres divergentes par minute" :
//
//   domicile  → barres orange #fd855f vers le HAUT
//   extérieur → barres bleu  #00aaf7 vers le BAS
//   ─────────── ligne médiane (0 de pression)
//   superposition : ⚽ buts, 🚩 corners, 🟨🟥 cartons, ○ tirs
//
// En-tête : diff-bar de pression (ex. 94% - 6%) façon PackBall.
// Sélecteur de fenêtre : Plein / 10 dernières min / 5 dernières min.
// SVG inline pur (zéro dépendance), même contrat de données que MomentumChart
// (MomentumTimePoint + MatchEvent) — les couches absentes ne cassent rien.

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { FOT } from "./fotmob-theme";
import type { MatchEvent, MomentumTimePoint } from "@/lib/football-timeline";

const W = 940;
const H = 150;
/** Hauteur max allouée à une barre divergente (px, sur les 150 de hauteur). */
const BAR_MAX = 46;
/** Marge verticale au-dessus de la zone des barres pour les marqueurs. */
const MARKER_TOP = 4;
const PAD_L = 4;
const PAD_R = 4;
const PLOT_W = W - PAD_L - PAD_R;
const MAX_MIN = 120;
/** 3 px par minute → 90' = 270 px visibles, le reste scrollable. */
const PX_PER_MIN = 3;
const AXIS_H = 14;

const HOME_C = "#fd855f";
const AWAY_C = "#00aaf7";

type WinKey = "full" | "10" | "5";

/** Fenêtres disponibles → largeur en minutes (0 = match entier). */
const WINDOWS: { key: WinKey; label: string; minutes: number }[] = [
  { key: "full", label: "Plein", minutes: 0 },
  { key: "10", label: "10 derniers'", minutes: 10 },
  { key: "5", label: "5 derniers'", minutes: 5 },
];

function minuteToX(min: number): number {
  return PAD_L + Math.max(0, Math.min(MAX_MIN, min)) * PX_PER_MIN;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Hauteur de barre depuis la valeur momentum [-100,+100]. */
function barHeight(v: number): number {
  return (Math.abs(clamp(v, -100, 100)) / 100) * BAR_MAX;
}

function evTitle(e: MatchEvent, homeName: string, awayName: string): string {
  const side = e.side === "home" ? homeName : awayName;
  const base = `${Math.round(e.minute)}' ${side}`;
  if (e.kind === "goal") {
    const g = e.goalType === "own" ? "csc" : e.goalType === "penalty" ? "pén." : "";
    const sc = e.score ? ` ${e.score.home}-${e.score.away}` : "";
    return `${base} ⚽ ${e.scorer ?? ""}${g ? ` (${g})` : ""}${sc}`.trim();
  }
  if (e.kind === "corner") return `${base} 🚩 corner`;
  return `${base} ○ tir`;
}

/** Icône unicode d'un marqueur (accessible : le <title> porte le détail). */
function markerGlyph(kind: MatchEvent["kind"]): string {
  if (kind === "goal") return "⚽";
  if (kind === "corner") return "🚩";
  return "○";
}

interface PressureTimelineProps {
  momentum: MomentumTimePoint[];
  events?: MatchEvent[];
  pressure?: { homePct: number; awayPct: number };
  /** Minute courante (live) — clignotement sur la position « maintenant ». */
  currentMinute?: number;
  homeName?: string;
  awayName?: string;
  className?: string;
}

export function PressureTimeline({
  momentum,
  events = [],
  pressure,
  currentMinute,
  homeName = "Domicile",
  awayName = "Extérieur",
  className,
}: PressureTimelineProps) {
  const [win, setWin] = useState<WinKey>("full");

  // Fenêtre affichée : 0→90 (ou minute courante si live) / 10 dernières / 5 dernières.
  const view = useMemo(() => {
    const pts = [...(momentum ?? [])]
      .filter((p) => p && Number.isFinite(p.minute) && Number.isFinite(p.value))
      .sort((a, b) => a.minute - b.minute);
    const lastData = pts.length ? pts[pts.length - 1].minute : 90;
    const now = typeof currentMinute === "number" && Number.isFinite(currentMinute) && currentMinute > 0 ? currentMinute : lastData;
    const end = Math.max(5, Math.ceil(now));
    const width = WINDOWS.find((w) => w.key === win)?.minutes ?? 0;
    const start = width === 0 ? 0 : Math.max(0, end - width);
    return { pts, start, end };
  }, [momentum, win, currentMinute]);

  const visible = useMemo(
    () => view.pts.filter((p) => p.minute >= view.start - 2.5 && p.minute <= view.end + 2.5),
    [view],
  );

  const marks = useMemo(
    () =>
      (events ?? [])
        .filter((e) => e && Number.isFinite(e.minute))
        .filter((e) => e.minute >= view.start - 2.5 && e.minute <= view.end + 2.5),
    [events, view],
  );

  // Diff-bar de pression recalculée sur la fenêtre visible (PackBall-like).
  const diff = useMemo(() => {
    if (visible.length) {
      const homeDominant = visible.filter((p) => p.value > 5).length;
      const homePct = Math.round((homeDominant / visible.length) * 100);
      return { homePct, awayPct: 100 - homePct };
    }
    return pressure ?? { homePct: 50, awayPct: 50 };
  }, [visible, pressure]);

  if (!visible.length) {
    return (
      <div
        className={cn("flex h-[110px] items-center justify-center rounded-2xl border text-xs", className)}
        style={{ backgroundColor: FOT.card, borderColor: FOT.border, color: FOT.muted }}
      >
        Timeline de pression indisponible (match trop tôt)
      </div>
    );
  }

  const ticks: number[] = [];
  for (let m = view.start; m <= view.end; m += 15) ticks.push(m);
  if (ticks[ticks.length - 1] !== view.end) ticks.push(view.end);

  const viewW = (view.end - view.start) * PX_PER_MIN;

  return (
    <div
      className={cn("w-full rounded-2xl border p-3", className)}
      style={{ backgroundColor: FOT.card, borderColor: FOT.border }}
    >
      {/* ─── En-tête : diff-bar de pression + sélecteur de fenêtre ─── */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {/* Diff-bar proportionnelle */}
        <div className="flex min-w-[180px] flex-1 items-center gap-1.5">
          <span
            className="min-w-[34px] text-right text-[13px] font-bold tabular-nums"
            style={{ color: HOME_C }}
          >
            {diff.homePct}%
          </span>
          <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-muted/40">
            <div
              className="h-full transition-all duration-300"
              style={{ width: `${diff.homePct}%`, backgroundColor: HOME_C }}
            />
            <div className="h-full flex-1" style={{ backgroundColor: AWAY_C, opacity: 0.85 }} />
          </div>
          <span
            className="min-w-[34px] text-[13px] font-bold tabular-nums"
            style={{ color: AWAY_C }}
          >
            {diff.awayPct}%
          </span>
        </div>

        {/* Sélecteur de fenêtre temporelle */}
        <div role="group" aria-label="Fenêtre temporelle" className="flex items-center gap-1">
          {WINDOWS.map((w) => (
            <button
              key={w.key}
              type="button"
              aria-pressed={win === w.key}
              onClick={() => setWin(w.key)}
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors",
                win === w.key
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground/60 hover:text-muted-foreground",
              )}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Timeline scrollable (mobile : 3 px/min) ─── */}
      <div className="indiana-scroll-container overflow-x-auto">
        <svg
          viewBox={`0 0 ${Math.max(viewW + PAD_L + PAD_R, 120)} ${H}`}
          width={Math.max(viewW + PAD_L + PAD_R, 120)}
          height={H}
          role="img"
          aria-label="Timeline de pression du match"
          className="block"
        >
          {/* Marqueurs en haut (bics/événements) — séparés des barres */}
          <g>
            {marks.map((e, i) => {
              const x = minuteToX(e.minute);
              const color = e.side === "home" ? HOME_C : AWAY_C;
              const y = MARKER_TOP + (i % 2) * 13;
              return (
                <g key={`mk-${e.kind}-${e.minute}-${i}`}>
                  <title>{evTitle(e, homeName, awayName)}</title>
                  <circle cx={x} cy={y} r={5} fill={color} fillOpacity={e.kind === "goal" ? 0.95 : 0.3} />
                  <text x={x} y={y + 3.5} fontSize="7" textAnchor="middle" fill="#fff">
                    {markerGlyph(e.kind)}
                  </text>
                  {/* Trait vertical reliant le marqueur à sa minute */}
                  <line
                    x1={x}
                    y1={y + 6}
                    x2={x}
                    y2={H - AXIS_H}
                    stroke={color}
                    strokeOpacity={e.kind === "goal" ? 0.5 : 0.18}
                    strokeWidth={e.kind === "goal" ? 1.5 : 1}
                    strokeDasharray={e.kind === "goal" ? undefined : "2 2"}
                  />
                </g>
              );
            })}
          </g>

          {/* Zone des barres (au-dessus de l'axe des minutes) */}
          <g transform={`translate(0, ${MARKER_TOP + 30})`}>
            {/* Ligne médiane (0) */}
            <line
              x1={PAD_L}
              y1={BAR_MAX}
              x2={PAD_L + viewW}
              y2={BAR_MAX}
              stroke="currentColor"
              strokeOpacity="0.25"
              strokeWidth="1"
              className="text-muted-foreground"
            />

            {/* Grille verticale (tous les 15') */}
            {ticks.map((t) => (
              <line
                key={`g-${t}`}
                x1={minuteToX(t)}
                y1={0}
                x2={minuteToX(t)}
                y2={BAR_MAX * 2}
                stroke="currentColor"
                strokeOpacity={t % 45 === 0 ? 0.18 : 0.07}
                strokeWidth={t % 45 === 0 ? 1.5 : 1}
                className="text-muted-foreground"
              />
            ))}

            {/* Barres divergentes par point de pression */}
            {visible.map((p) => {
              const x = minuteToX(p.minute) - 1.2;
              const h = barHeight(p.value);
              const up = p.value >= 0;
              return (
                <g key={`b-${p.minute}`}>
                  <title>{`${Math.round(p.minute)}' — pression ${up ? homeName : awayName} ${Math.abs(Math.round(p.value))}`}</title>
                  <rect
                    x={x}
                    y={up ? BAR_MAX - h : BAR_MAX}
                    width={2.4}
                    height={Math.max(h, 1)}
                    rx={1}
                    fill={up ? HOME_C : AWAY_C}
                    fillOpacity={0.9}
                  />
                </g>
              );
            })}

            {/* Indicateur « maintenant » (live) */}
            {typeof currentMinute === "number" && Number.isFinite(currentMinute) && currentMinute > 0 && (
              <line
                x1={minuteToX(view.end)}
                y1={0}
                x2={minuteToX(view.end)}
                y2={BAR_MAX * 2}
                stroke="#e11d48"
                strokeWidth="2"
                strokeOpacity="0.7"
              />
            )}
          </g>

          {/* Axe des minutes */}
          <g transform={`translate(0, ${H - AXIS_H + 2})`}>
            {ticks.map((t) => (
              <text
                key={`t-${t}`}
                x={minuteToX(t)}
                y={0}
                fontSize="8"
                textAnchor="middle"
                className="text-muted-foreground/70"
                fill="currentColor"
              >
                {t}′
              </text>
            ))}
          </g>
        </svg>
      </div>

      {/* ─── Légende ─── */}
      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground/80">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: HOME_C }} />
          {homeName}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: AWAY_C }} />
          {awayName}
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5">
          <span aria-hidden="true">⚽</span> but
          <span aria-hidden="true">🚩</span> corner
          <span aria-hidden="true">○</span> tir
        </span>
      </div>
    </div>
  );
}
