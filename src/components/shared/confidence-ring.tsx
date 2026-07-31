"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConfidenceRingSize = "sm" | "md" | "lg";

type ConfidenceRingProps = {
  /** Win probability (0–100). */
  prob: number;
  /** Model confidence (0–1). */
  confidence: number;
  /** Sport accent colour (used for the centre percentage text). */
  color: string;
  /** Ring size preset. Default "md". */
  size?: ConfidenceRingSize;
  /** Optional label displayed below the ring. */
  label?: string;
  className?: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SIZE_MAP: Record<ConfidenceRingSize, number> = {
  sm: 64,
  md: 80,
  lg: 96,
} as const;

const OUTER_STROKE = 3;
const INNER_STROKE = 2;
const RING_GAP = 2;

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

/** Linear interpolation between two hex colours. */
function lerpColor(c1: string, c2: string, t: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const r1 = parseInt(c1.slice(1, 3), 16);
  const g1 = parseInt(c1.slice(3, 5), 16);
  const b1 = parseInt(c1.slice(5, 7), 16);
  const r2 = parseInt(c2.slice(1, 3), 16);
  const g2 = parseInt(c2.slice(3, 5), 16);
  const b2 = parseInt(c2.slice(5, 7), 16);
  return `#${clamp(r1 + (r2 - r1) * t)
    .toString(16)
    .padStart(2, "0")}${clamp(g1 + (g2 - g1) * t)
    .toString(16)
    .padStart(2, "0")}${clamp(b1 + (b2 - b1) * t)
    .toString(16)
    .padStart(2, "0")}`;
}

/**
 * Probability → colour ramp.
 *   0–35:  red (#EF4444) → amber (#F59E0B)
 *  35–65:  amber (#F59E0B) → green (#22C55E)
 *  65–100: green (#22C55E)
 */
function getProbColor(value: number): string {
  const clamped = Math.max(0, Math.min(100, value));
  if (clamped <= 35) return lerpColor("#EF4444", "#F59E0B", clamped / 35);
  if (clamped <= 65)
    return lerpColor("#F59E0B", "#22C55E", (clamped - 35) / 30);
  return "#22C55E";
}

/**
 * Confidence → colour buckets.
 *   ≥ 0.7  → green  #22C55E
 *   ≥ 0.4  → amber  #F59E0B
 *   < 0.4  → red    #EF4444
 */
function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.7) return "#22C55E";
  if (confidence >= 0.4) return "#F59E0B";
  return "#EF4444";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConfidenceRing({
  prob,
  confidence,
  color,
  size = "md",
  label,
  className,
}: ConfidenceRingProps) {
  const pixelSize = SIZE_MAP[size];

  const probColor = getProbColor(prob);
  const confColor = getConfidenceColor(confidence);

  // ---- SVG geometry -------------------------------------------------------
  const center = pixelSize / 2;
  const outerRadius = (pixelSize - OUTER_STROKE) / 2;
  const innerRadius =
    outerRadius - OUTER_STROKE / 2 - RING_GAP - INNER_STROKE / 2;

  const outerCircumference = 2 * Math.PI * outerRadius;
  const innerCircumference = 2 * Math.PI * innerRadius;

  // Clamp input ranges
  const safeProb = Math.max(0, Math.min(100, prob));
  const safeConfFill = Math.max(0, Math.min(100, confidence * 100));

  const outerDashOffset = outerCircumference * (1 - safeProb / 100);
  const innerDashOffset = innerCircumference * (1 - safeConfFill / 100);

  // ---- Centre text sizing -------------------------------------------------
  const fontSizeClass =
    size === "sm" ? "text-sm" : size === "md" ? "text-lg" : "text-xl";

  return (
    <div className={cn("inline-flex flex-col items-center gap-1", className)}>
      {/* Ring */}
      <div
        className="relative inline-flex items-center justify-center"
        style={{ width: pixelSize, height: pixelSize }}
        role="img"
        aria-label={`Probability ${Math.round(prob)}%, Confidence ${Math.round(confidence * 100)}%`}
      >
        <svg
          width={pixelSize}
          height={pixelSize}
          viewBox={`0 0 ${pixelSize} ${pixelSize}`}
          className="-rotate-90"
        >
          {/* ---- Outer track (probability background) ---- */}
          <circle
            cx={center}
            cy={center}
            r={outerRadius}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.2}
            strokeWidth={OUTER_STROKE}
          />

          {/* ---- Outer ring (probability fill, animated) ---- */}
          <motion.circle
            cx={center}
            cy={center}
            r={outerRadius}
            fill="none"
            stroke={probColor}
            strokeWidth={OUTER_STROKE}
            strokeLinecap="round"
            strokeDasharray={outerCircumference}
            initial={{ strokeDashoffset: outerCircumference }}
            animate={{ strokeDashoffset: outerDashOffset }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          />

          {/* ---- Inner track (confidence background) ---- */}
          <circle
            cx={center}
            cy={center}
            r={innerRadius}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.2}
            strokeWidth={INNER_STROKE}
          />

          {/* ---- Inner ring (confidence fill, animated with slight delay) ---- */}
          <motion.circle
            cx={center}
            cy={center}
            r={innerRadius}
            fill="none"
            stroke={confColor}
            strokeWidth={INNER_STROKE}
            strokeLinecap="round"
            strokeDasharray={innerCircumference}
            initial={{ strokeDashoffset: innerCircumference }}
            animate={{ strokeDashoffset: innerDashOffset }}
            transition={{
              duration: 0.9,
              ease: [0.22, 1, 0.36, 1],
              delay: 0.15,
            }}
          />
        </svg>

        {/* ---- Centre percentage ---- */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={cn("font-bold tabular-nums leading-none", fontSizeClass)}
            style={{ color }}
          >
            {Math.round(prob)}%
          </span>
        </div>
      </div>

      {/* Optional label */}
      {label && (
        <span className="text-xs text-muted-foreground">{label}</span>
      )}
    </div>
  );
}
