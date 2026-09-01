"use client";

import { cn } from "@/lib/utils";

type OddsSparklineProps = {
  /** Historique des odds A (decimal) — ex: [2.1, 2.05, 1.95, 1.9] */
  dataA: number[];
  /** Historique des odds B (decimal) — ex: [1.75, 1.8, 1.85, 1.9] */
  dataB?: number[];
  width?: number;
  height?: number;
  className?: string;
  colorA?: string;
  colorB?: string;
  ariaLabel?: string;
};

/**
 * Mini sparkline SVG pour mouvement d'odds sur les cartes match.
 * Affiche l'évolution des odds A (+ odds B optionnel) sur les N dernières valeurs.
 * Style: ligne avec area fill semi-transparent, point final, tendance colorée.
 */
export function OddsSparkline({
  dataA,
  dataB,
  width = 80,
  height = 28,
  className,
  colorA = "#00e676",
  colorB = "#ff6b6b",
  ariaLabel,
}: OddsSparklineProps) {
  if (dataA.length < 2) return null;

  const padding = 2;
  const w = width - padding * 2;
  const h = height - padding * 2;

  // Calcul min/max sur toutes les données (A + B si présent)
  const allValues = dataB ? [...dataA, ...dataB] : dataA;
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;

  const toPoints = (data: number[]) =>
    data
      .map((val, i) => {
        const x = padding + (i / (data.length - 1)) * w;
        const y = padding + h - ((val - min) / range) * h;
        return `${x},${y}`;
      })
      .join(" ");

  const toPath = (data: number[]) =>
    data
      .map((val, i) => {
        const x = padding + (i / (data.length - 1)) * w;
        const y = padding + h - ((val - min) / range) * h;
        return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
      })
      .join(" ");

  const pathA = toPath(dataA);
  const areaA = `${pathA} L ${padding + w} ${padding + h} L ${padding} ${padding + h} Z`;

  // Trend: odds descending = value increasing (good for bettor)
  const isDown = dataA[dataA.length - 1] < dataA[0];
  const trendColor = isDown ? colorA : "#fbbf24"; // amber if odds rising (less value)

  const lastXA = padding + w;
  const lastYA = padding + h - ((dataA[dataA.length - 1] - min) / range) * h;

  const defaultLabel = `Odds: ${dataA[dataA.length - 1]?.toFixed(2)}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("shrink-0", className)}
      aria-label={ariaLabel ?? defaultLabel}
      role="img"
    >
      {/* Area fill A */}
      <path d={areaA} fill={trendColor} fillOpacity={0.12} />

      {/* Line A */}
      <path
        d={pathA}
        fill="none"
        stroke={trendColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Point final A */}
      <circle cx={lastXA} cy={lastYA} r={2} fill={trendColor} />

      {/* Line B (si fourni) */}
      {dataB && dataB.length >= 2 && (
        <>
          <path
            d={toPath(dataB)}
            fill="none"
            stroke={colorB}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="3 2"
          />
          <circle
            cx={padding + w}
            cy={padding + h - ((dataB[dataB.length - 1] - min) / range) * h}
            r={2}
            fill={colorB}
          />
        </>
      )}
    </svg>
  );
}
