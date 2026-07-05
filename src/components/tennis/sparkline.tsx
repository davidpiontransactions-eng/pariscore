"use client";

type Props = {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  showArea?: boolean;
  ariaLabel?: string;
};

/**
 * Minimal inline SVG sparkline for Elo progression.
 * Pure SVG, no dependency. Accessible via aria-label.
 */
export function Sparkline({
  data,
  width = 80,
  height = 24,
  color = "#10B981",
  strokeWidth = 1.5,
  showArea = true,
  ariaLabel,
}: Props) {
  if (data.length < 2) {
    return (
      <svg width={width} height={height} aria-label={ariaLabel} role="img">
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="currentColor"
          strokeOpacity={0.2}
          strokeWidth={strokeWidth}
          strokeDasharray="2 2"
        />
      </svg>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);

  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return [x, y] as const;
  });

  const pathD = points
    .map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`))
    .join(" ");

  const areaD = `${pathD} L ${width} ${height} L 0 ${height} Z`;

  // Trend: up if last > first
  const isUp = data[data.length - 1] >= data[0];
  const trendColor = isUp ? color : "#F43F5E"; // rose for down

  return (
    <svg
      width={width}
      height={height}
      aria-label={ariaLabel}
      role="img"
      style={{ display: "block" }}
    >
      {showArea && (
        <path
          d={areaD}
          fill={trendColor}
          fillOpacity={0.12}
        />
      )}
      <path
        d={pathD}
        fill="none"
        stroke={trendColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
