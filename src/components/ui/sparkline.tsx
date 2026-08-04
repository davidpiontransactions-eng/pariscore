"use client";

import { cn } from "@/lib/utils";

type SparklineProps = {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
  /** Couleur de la ligne (tailwind). Défaut: emerald-400 */
  color?: string;
};

/**
 * Mini graphique sparkline SVG — affiche une tendance sur N points.
 * Utilisé dans UpcomingTable pour les trends Elo.
 */
export function Sparkline({
  data,
  width = 60,
  height = 20,
  className,
  color = "emerald-400",
}: SparklineProps) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1; // éviter division par 0

  const padding = 1;
  const w = width - padding * 2;
  const h = height - padding * 2;

  const points = data
    .map((val, i) => {
      const x = padding + (i / (data.length - 1)) * w;
      const y = padding + h - ((val - min) / range) * h;
      return `${x},${y}`;
    })
    .join(" ");

  const colorMap: Record<string, string> = {
    "emerald-400": "#34d399",
    "rose-400": "#fb7185",
    "amber-400": "#fbbf24",
    "blue-400": "#60a5fa",
  };

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("shrink-0", className)}
      aria-label="Tendance Elo"
    >
      <polyline
        points={points}
        fill="none"
        stroke={colorMap[color] ?? color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Point final */}
      <circle
        cx={points.split(" ").pop()?.split(",")[0] ?? "0"}
        cy={points.split(" ").pop()?.split(",")[1] ?? "0"}
        r="2"
        fill={colorMap[color] ?? color}
      />
    </svg>
  );
}