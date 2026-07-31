"use client";

import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Outcome = "W" | "L" | "D";

type FormTimelineProps = {
  /** Match outcomes ordered left (oldest) → right (most recent). */
  form: Outcome[];
  /** Override the Win-dot colour (defaults to emerald-500). */
  color?: string;
  /** Show the weighted form-index badge. */
  showIndex?: boolean;
  /** Dot size preset. */
  size?: "sm" | "md";
  /** Accessible label for the timeline. */
  ariaLabel?: string;
  className?: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INDEX_LABELS = [
  { min: 0.8, label: "Excellent", className: "text-emerald-500" },
  { min: 0.6, label: "Bon", className: "text-amber-500" },
  { min: 0.4, label: "Moyen", className: "text-muted-foreground" },
  { min: 0, label: "Faible", className: "text-red-500" },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Weighted form index with exponential decay (λ = 0.85).
 * Most recent matches influence the score more heavily.
 *
 *   weight_i = 0.85^(n - 1 − i)
 *   score    = Σ weight_i × val_i / Σ weight_i   where val = {W→1, D→0.5, L→0}
 */
function computeFormIndex(form: Outcome[]): number {
  const n = form.length;
  if (n === 0) return 0;

  let weightSum = 0;
  let scoreSum = 0;

  for (let i = 0; i < n; i++) {
    const weight = Math.pow(0.85, n - 1 - i);
    const val = form[i] === "W" ? 1 : form[i] === "D" ? 0.5 : 0;
    scoreSum += weight * val;
    weightSum += weight;
  }

  return weightSum > 0 ? scoreSum / weightSum : 0;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Horizontal timeline of coloured form dots with progressive opacity.
 *
 * - W → emerald-500 (win)
 * - L → red-500   (loss)
 * - D → amber-500  (draw)
 *
 * Rightmost (most recent) dot is at 100 % opacity / scale-100;
 * each step leftward fades toward ~40 % opacity and scale-95.
 */
export function FormTimeline({
  form,
  color,
  showIndex = false,
  size = "sm",
  ariaLabel,
  className,
}: FormTimelineProps) {
  const n = form.length;

  const dotSize = size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5";
  const gap = size === "sm" ? "gap-0.5" : "gap-1";

  const formIndex = computeFormIndex(form);
  const badge = INDEX_LABELS.find((t) => formIndex >= t.min)!;

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      {/* ---- Dot timeline ---- */}
      <div
        className={cn("flex items-center", gap)}
        role="img"
        aria-label={
          ariaLabel ??
          `Forme : ${form.join(", ")} — Indice ${Math.round(formIndex * 100)}%`
        }
      >
        {form.map((outcome, i) => {
          // Linear ramp: oldest ≈ 40 %, newest = 100 %
          const recencyRatio = n > 1 ? i / (n - 1) : 1;
          const opacity = 0.4 + 0.6 * recencyRatio;

          // Geometric decay: newest = 1.0, each step left ×0.95
          const scale = n > 1 ? Math.pow(0.95, n - 1 - i) : 1;

          // Determine background colour
          const winColor = color;
          const dotBg =
            outcome === "W" && winColor ? winColor : undefined;

          const dotClass =
            outcome === "W" && !winColor
              ? "bg-emerald-500"
              : outcome === "L"
                ? "bg-red-500"
                : outcome === "D"
                  ? "bg-amber-500"
                  : "";

          const title =
            outcome === "W"
              ? "Victoire"
              : outcome === "L"
                ? "Défaite"
                : "Nul";

          return (
            <span
              key={i}
              className={cn("rounded-full shrink-0", dotSize, dotClass)}
              style={{
                opacity,
                transform: `scale(${scale})`,
                ...(dotBg ? { background: dotBg } : {}),
              }}
              title={title}
            />
          );
        })}
      </div>

      {/* ---- Form-index badge ---- */}
      {showIndex && (
        <span
          className={cn(
            "text-xs font-medium whitespace-nowrap",
            badge.className,
          )}
        >
          {badge.label}
        </span>
      )}
    </div>
  );
}
