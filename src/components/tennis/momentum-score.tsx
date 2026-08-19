"use client";

// MomentumScore — gauge SVG 60×60 affichant le score 0-100 par joueur.
// Palette : 0-40 rouge, 40-60 orange, 60-100 vert.
// Format compact : cercle semi-circulaire avec score centré.
// Accessible : aria-label "Momentum Score: X/100".

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

type Props = {
  score: number | null | undefined;
  /** Taille en px (défaut 60). */
  size?: number;
  className?: string;
};

function scoreColor(s: number): string {
  if (s >= 60) return "#22c55e"; // vert
  if (s >= 40) return "#f59e0b"; // orange
  return "#ef4444"; // rouge
}

export function MomentumScore({ score, size = 60, className }: Props) {
  const t = useTranslations();

  if (score == null) return null;

  const r = (size - 8) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const strokeW = 5;

  // Arc : angle 0° (haut) → 180° (bas) = demi-cercle.
  // score 0 → angle 180°, score 100 → angle 0°.
  const angle = 180 - (score / 100) * 180;
  const rad = (angle * Math.PI) / 180;
  const x = cx + r * Math.cos(rad);
  const y = cy - r * Math.sin(rad);

  // Chemin arc : start top-left → end at angle (bottom-right si score bas).
  const startX = cx - r;
  const startY = cy;
  const largeArc = score < 50 ? 0 : 1;
  const d = `M ${startX} ${startY} A ${r} ${r} 0 ${largeArc} 1 ${x} ${y}`;

  const color = scoreColor(score);

  return (
    <div
      className={cn("inline-flex flex-col items-center gap-0.5", className)}
      title={t("tennis.momentumScore.title", { score })}
    >
      <svg
        width={size}
        height={size / 2 + 6}
        viewBox={`0 0 ${size} ${size / 2 + 2}`}
        aria-label={t("tennis.momentumScore.label", { score })}
        role="img"
      >
        {/* Arc fond */}
        <path
          d={`M ${startX} ${startY} A ${r} ${r} 0 0 1 ${cx + r} ${startY}`}
          fill="none"
          stroke="var(--border, #e5e7eb)"
          strokeWidth={strokeW}
          strokeLinecap="round"
        />
        {/* Arc coloré */}
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={strokeW}
          strokeLinecap="round"
        />
        {/* Score texte */}
        <text
          x={cx}
          y={cy - 2}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-foreground text-[11px] font-bold"
          style={{ fontFamily: "var(--font-mono, monospace)" }}
        >
          {score}
        </text>
      </svg>
    </div>
  );
}

/** Variante duo : affiche les deux scores A vs B côte à côte. */
export function MomentumScoreDuo({
  scoreA,
  scoreB,
  size = 56,
  className,
}: {
  scoreA: number | null | undefined;
  scoreB: number | null | undefined;
  size?: number;
  className?: string;
}) {
  if (scoreA == null && scoreB == null) return null;

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <MomentumScore score={scoreA} size={size} />
      <span className="text-[11px] text-muted-foreground font-medium">vs</span>
      <MomentumScore score={scoreB} size={size} />
    </div>
  );
}
