"use client";

import { cn } from "@/lib/utils";
import type { PowerScore } from "@/lib/power-score";

/**
 * PowerScoreBar — score de puissance 0-100 : nombre + barre + tooltip
 * détaillant métriques et pondérations. Partagé tennis / foot.
 */
type Props = {
  score: PowerScore | number | null | undefined;
  /** Taille compacte (lignes calendrier) ou standard (dialogs). */
  size?: "sm" | "md";
  className?: string;
};

export function PowerScoreBar({ score, size = "sm", className }: Props) {
  if (score == null) return null;
  const value = typeof score === "number" ? Math.round(score) : score.score;
  const metrics = typeof score === "number" ? null : score.metrics;
  const title =
    metrics != null && metrics.length > 0
      ? `PowerScore ${value}/100\n` +
        metrics
          .map(
            (m) =>
              `• ${m.label} (${m.weight} %) : ${m.value == null ? "—" : `${Math.round(m.value)}${m.display ? ` — ${m.display}` : ""}`}`,
          )
          .join("\n")
      : `PowerScore ${value}/100`;
  const compact = size === "sm";
  return (
    <span
      className={cn("inline-flex items-center gap-1.5", className)}
      title={title}
      aria-label={`PowerScore ${value} sur 100`}
    >
      <span
        className={cn(
          "font-mono font-bold tabular-nums",
          compact ? "text-[10px]" : "text-xs",
        )}
        style={{ color: "#00985f" }}
      >
        {value}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "inline-block overflow-hidden rounded-full bg-black/10",
          compact ? "h-1 w-10" : "h-1.5 w-16",
        )}
      >
        <span
          className="block h-full rounded-full"
          style={{ width: `${value}%`, backgroundColor: "#00985f" }}
        />
      </span>
    </span>
  );
}
