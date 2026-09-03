import { cn } from "@/lib/utils";

type ConfidenceLevel = "high" | "mid" | "low";

type ConfidenceBadgeProps = {
  /** Niveau de confiance du modèle */
  level: ConfidenceLevel;
  /** Pourcentage affiché (optionnel) */
  value?: number;
  /** Classe CSS supplémentaire */
  className?: string;
};

const levelStyles: Record<ConfidenceLevel, { ring: string; text: string; bg: string }> = {
  high: {
    ring: "ring-emerald-500/30",
    text: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  mid: {
    ring: "ring-slate-400/30",
    text: "text-slate-300",
    bg: "bg-slate-400/10",
  },
  low: {
    ring: "ring-red-400/30",
    text: "text-red-400",
    bg: "bg-red-400/10",
  },
};

/**
 * ConfidenceBadge — pill standardisé pour afficher la confiance du modèle.
 * Sémantique unique : % = probabilité modèle, "Edge +X%" = value vs marché.
 * Ne JAMAIS mélanger les deux (règle DESIGN_CHARTER.md §9).
 */
export function ConfidenceBadge({ level, value, className }: ConfidenceBadgeProps) {
  const styles = levelStyles[level];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-white/[0.06] px-2 py-0.5",
        "text-[11px] font-semibold tabular-nums",
        styles.bg,
        styles.text,
        styles.ring,
        "ring-1 ring-inset",
        className,
      )}
    >
      {value !== undefined && (
        <span className="tabular-nums">{value}%</span>
      )}
    </span>
  );
}
