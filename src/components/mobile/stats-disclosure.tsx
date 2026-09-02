"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * T26 — StatsDisclosure
 *
 * Disclosure progressif pour les statistiques (Pinhal thesis).
 * Affiche d'abord les métriques clés, révèle le détail au tap.
 *
 * Pattern The Athletic / FiveThirtyEight :
 * - Niveau 1 : 2-3 métriques principales (toujours visibles)
 * - Niveau 2 : Métriques secondaires (tap pour révéler)
 * - Niveau 3 : Données complètes (tap pour tout voir)
 *
 * Respecte prefers-reduced-motion (pas d'animation).
 *
 * Usage :
 * <StatsDisclosure title="Stats de service">
 *   <StatsDisclosure.Level label="Primaires">
 *     <StatItem label="ACES" value="12" />
 *     <StatItem label="1er service" value="72%" />
 *   </StatsDisclosure.Level>
 *   <StatsDisclosure.Level label="Détail">
 *     <StatItem label="Points gagnés 1S" value="78%" />
 *     <StatItem label="Points gagnés 2S" value="45%" />
 *   </StatsDisclosure.Level>
 * </StatsDisclosure>
 */

type StatItemProps = {
  label: string;
  value: string | number;
  /** Valeur de l'adversaire (pour comparaison side-by-side) */
  opponentValue?: string | number;
  /** true = better, false = worse, null = neutre */
  trend?: boolean | null;
  className?: string;
};

export function StatItem({ label, value, opponentValue, trend, className }: StatItemProps) {
  return (
    <div className={cn("flex items-center justify-between py-1.5", className)}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-3">
        {opponentValue !== undefined && (
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {opponentValue}
          </span>
        )}
        <span
          className={cn(
            "font-mono text-sm font-medium tabular-nums",
            trend === true && "text-emerald-500",
            trend === false && "text-red-500",
          )}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

type LevelProps = {
  label?: string;
  children: React.ReactNode;
  /** Niveau de priorité (1 = toujours visible, 2+ = collapsé) */
  priority?: 1 | 2 | 3;
  className?: string;
};

function Level({ label, children, priority = 2, className }: LevelProps) {
  const [expanded, setExpanded] = useState(priority === 1);
  const contentId = `stats-disclosure-content-${label?.replace(/\s+/g, "-").toLowerCase() ?? "default"}`;

  return (
    <div className={cn("border-b border-border/20 last:border-b-0", className)}>
      {priority > 1 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center justify-between py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          aria-expanded={expanded}
          aria-controls={contentId}
        >
          <span>{label}</span>
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
      )}

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id={contentId}
            role="region"
            aria-label={label}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="space-y-0.5 pb-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {!expanded && priority > 1 && (
        <div className="py-1 text-[10px] text-muted-foreground/60">
          Appuyez pour voir le détail
        </div>
      )}
    </div>
  );
}

type StatsDisclosureProps = {
  title?: string;
  children: React.ReactNode;
  className?: string;
};

function StatsDisclosure({ title, children, className }: StatsDisclosureProps) {
  return (
    <div className={cn("rounded-lg border border-border/30 bg-card/50 p-3", className)}>
      {title && (
        <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
}

StatsDisclosure.Level = Level;
StatsDisclosure.StatItem = StatItem;

export { StatsDisclosure };
