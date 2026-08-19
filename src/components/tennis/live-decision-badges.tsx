"use client";

import { Zap, TrendingUp, AlertTriangle, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CalculatedLiveMetrics } from "@/lib/tennis-live-metrics";

type Props = {
  metrics: CalculatedLiveMetrics;
  className?: string;
};

/**
 * Badges d'alerte décisionnelle pour les cartes live tennis (Variante A).
 *
 * Affiche jusqu'à 3 badges inline :
 *   ⚡ Vulnérabilité 2nd service (< 45%)
 *   🔥 Dominance Ratio (> 1.20)
 *   ⚠️ Risque de break / Pression service
 */
export function LiveDecisionBadges({ metrics, className }: Props) {
  const badges: Array<{
    key: string;
    icon: React.ReactNode;
    label: string;
    level: "critical" | "warning" | "info";
  }> = [];

  // Badge DR (si favorable ou mieux)
  const drShow = metrics.dr.drA > 1.15 ? "A" : metrics.dr.drB > 1.15 ? "B" : null;
  if (drShow) {
    const drVal = drShow === "A" ? metrics.dr.drA : metrics.dr.drB;
    const drLevel = drShow === "A" ? metrics.dr.levelA : metrics.dr.levelB;
    badges.push({
      key: "dr",
      icon: <TrendingUp className="h-3 w-3" />,
      label: `DR ${drVal.toFixed(2)}`,
      level: drLevel === "dominant" ? "critical" : drLevel === "favorable" ? "warning" : "info",
    });
  }

  // Badge 2nd service
  if (metrics.secondServeAlert.level !== "ok" && metrics.secondServeAlert.player) {
    badges.push({
      key: "2nd",
      icon: <Zap className="h-3 w-3" />,
      label: `2nd sv ${Math.round(metrics.secondServeAlert.pct)}%`,
      level: metrics.secondServeAlert.level === "critical" ? "critical" : "warning",
    });
  }

  // Badge BP save
  const bpShow =
    (metrics.bpExposure.p1SavePct != null && metrics.bpExposure.p1SavePct < 50) ? "A"
    : (metrics.bpExposure.p2SavePct != null && metrics.bpExposure.p2SavePct < 50) ? "B"
    : null;
  if (bpShow) {
    const bpVal = bpShow === "A" ? metrics.bpExposure.p1SavePct : metrics.bpExposure.p2SavePct;
    if (bpVal != null) {
      badges.push({
        key: "bp",
        icon: <Shield className="h-3 w-3" />,
        label: `BP ${Math.round(bpVal)}% sauvées`,
        level: "critical",
      });
    }
  }

  // Alerte fatigue / break imminent
  if (metrics.fatigueAlert.level !== "none") {
    badges.push({
      key: "fatigue",
      icon: <AlertTriangle className="h-3 w-3" />,
      label: metrics.fatigueAlert.level === "break_imminent" ? "⚠ Break risk" : "Pression",
      level: metrics.fatigueAlert.level === "break_imminent" ? "critical" : "warning",
    });
  }

  if (badges.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {badges.map((b) => (
        <span
          key={b.key}
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
            b.level === "critical" &&
              "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20",
            b.level === "warning" &&
              "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
            b.level === "info" &&
              "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
          )}
        >
          {b.icon}
          {b.label}
        </span>
      ))}
    </div>
  );
}
