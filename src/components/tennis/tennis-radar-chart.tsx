"use client";

import { useMemo } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipProps,
} from "recharts";
import { cn } from "@/lib/utils";
import type { PowerScore } from "@/lib/power-score";

/**
 * TennisRadarChart — spider chart FotMob-style comparant 2 joueurs sur
 * 6 axes issus du PowerScore (Service, Retour, Forme, Élo surface, SPS,
 * Fraîcheur). Version "waouh" du radar foot : animation d'apparition,
 * dégradés, badge central du duel. Données partiellement indisponibles →
 * axe à 50 + mention (jamais de valeur fabriquée silencieuse).
 */

export type TennisRadarInput = {
  powerA: PowerScore;
  powerB: PowerScore;
  nameA: string;
  nameB: string;
  colorA?: string | null;
  colorB?: string | null;
};

const AXES = [
  { key: "serve", label: "Service" },
  { key: "return", label: "Retour" },
  { key: "form", label: "Forme" },
  { key: "elo", label: "Élo surf." },
  { key: "sps", label: "SPS" },
  { key: "fresh", label: "Fraîcheur" },
] as const;

const FALLBACK_A = "#00d77e";
const FALLBACK_B = "#6aa6d0";

function axisValue(ps: PowerScore, key: string): { v: number; known: boolean } {
  const m = ps.metrics.find((x) => x.key === key);
  if (m?.value == null) return { v: 50, known: false };
  return { v: Math.round(m.value), known: true };
}

export function TennisRadarChart({ data, className }: { data: TennisRadarInput; className?: string }) {
  const colorA = data.colorA || FALLBACK_A;
  const colorB = data.colorB || FALLBACK_B;

  const chartData = useMemo(
    () =>
      AXES.map((ax) => {
        const a = axisValue(data.powerA, ax.key);
        const b = axisValue(data.powerB, ax.key);
        return { axis: ax.label, a: a.v, b: b.v, knownA: a.known, knownB: b.known };
      }),
    [data],
  );

  const knownCount = useMemo(
    () =>
      (["serve", "return", "form", "elo", "sps", "fresh"] as const).filter(
        (k) => axisValue(data.powerA, k).known || axisValue(data.powerB, k).known,
      ).length,
    [data],
  );
  const partial = knownCount < 6;

  return (
    <div
      className={cn("flex w-full flex-col items-center gap-1", className)}
      role="img"
      aria-label={`Spider comparatif ${data.nameA} vs ${data.nameB}`}
    >
      <div className="relative w-full">
        <ResponsiveContainer width="100%" height={250} minHeight={220}>
          <RadarChart data={chartData} outerRadius="68%" margin={{ top: 14, right: 36, bottom: 14, left: 36 }}>
            <defs>
              <linearGradient id="tennis-radar-a" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={colorA} stopOpacity={0.45} />
                <stop offset="100%" stopColor={colorA} stopOpacity={0.08} />
              </linearGradient>
              <linearGradient id="tennis-radar-b" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={colorB} stopOpacity={0.45} />
                <stop offset="100%" stopColor={colorB} stopOpacity={0.08} />
              </linearGradient>
            </defs>
            <PolarGrid stroke="#e0e0e0" strokeOpacity={0.6} strokeWidth={0.5} />
            <PolarAngleAxis
              dataKey="axis"
              tick={({ x, y, payload }) => {
                const d = chartData.find((dd) => dd.axis === payload?.value);
                const val = d ? `${d.a} / ${d.b}` : "";
                return (
                  <g transform={`translate(${x},${y})`}>
                    <text textAnchor="middle" dominantBaseline="hanging" fontSize={10} fill="#717171">
                      {payload?.value}
                    </text>
                    <text
                      textAnchor="middle"
                      dominantBaseline="hanging"
                      dy={11}
                      fontSize={10}
                      fontWeight={600}
                      fontFamily="var(--font-geist-mono)"
                      fill="#222222"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {val}
                    </text>
                  </g>
                );
              }}
            />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} tickCount={5} />
            <Tooltip content={<TennisRadarTooltip />} cursor={{ stroke: "#e0e0e0", strokeOpacity: 0.4 }} />
            <Radar
              name={data.nameA}
              dataKey="a"
              stroke={colorA}
              strokeWidth={2}
              fill="url(#tennis-radar-a)"
              dot={{ r: 2.5, fill: colorA, strokeWidth: 0 }}
              isAnimationActive
              animationDuration={700}
              animationEasing="ease-out"
            />
            <Radar
              name={data.nameB}
              dataKey="b"
              stroke={colorB}
              strokeWidth={2}
              fill="url(#tennis-radar-b)"
              dot={{ r: 2.5, fill: colorB, strokeWidth: 0 }}
              isAnimationActive
              animationDuration={700}
              animationEasing="ease-out"
            />
          </RadarChart>
        </ResponsiveContainer>

        {/* Badge central : duel PowerScore */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className="flex items-center gap-1.5 rounded-full border bg-white/95 px-2.5 py-1 shadow-sm"
            style={{ borderColor: "#f0f0f0" }}
            aria-hidden="true"
          >
            <span className="font-mono text-xs font-bold tabular-nums" style={{ color: colorA }}>
              {data.powerA.score}
            </span>
            <span className="text-[10px] font-semibold" style={{ color: "#717171" }}>
              PS
            </span>
            <span className="font-mono text-xs font-bold tabular-nums" style={{ color: colorB }}>
              {data.powerB.score}
            </span>
          </div>
        </div>
      </div>

      {/* Légende */}
      <div className="flex items-center justify-center gap-4 text-xs">
        <LegendItem color={colorA} name={data.nameA} />
        <LegendItem color={colorB} name={data.nameB} />
      </div>
      {partial && (
        <p className="text-center text-[10px]" style={{ color: "#717171" }}>
          Données partielles ({knownCount}/6 axes) — axes inconnus à 50, sans impact sur le score.
        </p>
      )}
    </div>
  );
}

function LegendItem({ color, name }: { color: string; name: string }) {
  const init = name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <span aria-hidden="true" className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="shrink-0 font-mono text-[11px] font-semibold tabular-nums" style={{ color }}>
        {init}
      </span>
      <span className="truncate" style={{ color: "#717171" }}>
        {name}
      </span>
    </div>
  );
}

function TennisRadarTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const axisLabel = payload[0]?.payload?.axis ?? "";
  return (
    <div className="flex flex-col gap-0.5 px-2 py-1 text-xs leading-tight" style={{ background: "#fff", border: "1px solid #f0f0f0" }}>
      <div className="font-semibold" style={{ color: "#222" }}>{axisLabel}</div>
      {payload.map((entry) => (
        <div key={String(entry.dataKey)} className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span style={{ color: "#717171" }}>{entry.name}</span>
          <span className="font-mono font-medium tabular-nums" style={{ color: "#222" }}>
            {typeof entry.value === "number" ? entry.value.toFixed(0) : "--"}
          </span>
        </div>
      ))}
    </div>
  );
}
