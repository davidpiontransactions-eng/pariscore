"use client";

/**
 * StatsIndicatorsGrid — Grille hiérarchique des indicateurs match
 *
 * Remplace la grille plate des 6 StatChip par une hiérarchie visuelle :
 *
 *   RANG PRIMAIRE (fond légèrement teinté) :
 *     [ Forme ]  [ Écart Elo ]  [ Surface ]
 *
 *   RANG SECONDAIRE (plus discret, plus petit) :
 *     [ H2H ]  [ IC 95% ]  [ Confiance ]
 *
 *   RANG TERTIAIRE (optionnel, via onOpenDetail) :
 *     [ Décomposition ]  [ Distribution ]
 *
 * La séparation primaire/secondaire donne un souffle visuel à la card
 * sans perdre aucune information. Les métriques importantes (Forme,
 * Écart Elo, Surface) sautent aux yeux ; les métriques d'incertitude
 * (IC, Confiance, H2H) sont disponibles pour ceux qui creusent.
 *
 * Utilisation :
 *   <StatsIndicatorsGrid stats={match.stats} />
 */

import type { ReactNode } from "react";
import {
  Activity,
  TrendingUp,
  MapPin,
  Swords,
  CircleDot,
  CheckCircle2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

// ────────────────────────────────────────────
// Types partagés
// ────────────────────────────────────────────

type MatchStats = {
  form: string;        // "5V-1D"
  eloGap: number;      // 293
  surface: string;     // "Dur" | "Terre battue" | "Gazon"
  h2h: string;         // "5-2"
  ic: [number, number]; // [78, 89]
  confidence: number;  // 0.81
};

type Props = {
  stats: MatchStats;
  /** Surface du match (peut différer de stats.surface si traduite) */
  surface?: string;
  /** Mode compact : supprime le padding interne */
  compact?: boolean;
  /** Cache le rang tertiaire (IC, Confiance) */
  hideTertiary?: boolean;
  /** Classes additionnelles */
  className?: string;
};

// ────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────

function confidenceColor(val: number): string {
  if (val >= 0.75) return "border-emerald-500/40 bg-emerald-500/5";
  if (val >= 0.6) return "border-amber-500/40 bg-amber-500/5";
  return "border-rose-500/40 bg-rose-500/5";
}

// ────────────────────────────────────────────
// Composant
// ────────────────────────────────────────────

export function StatsIndicatorsGrid({
  stats,
  surface,
  compact = false,
  hideTertiary = false,
  className,
}: Props) {
  const t = useTranslations("match");

  return (
    <div
      className={cn(
        "grid gap-2",
        // Mobile : 2 colonnes → 3 lignes
        // Desktop : 3 colonnes → 2 lignes (primaire + secondaire)
        "grid-cols-2 sm:grid-cols-3",
        compact && "gap-1.5",
        className,
      )}
    >
      {/* ──────── RANG PRIMAIRE : Forme ──────── */}
      <PrimaryChip
        label={t("form")}
        value={stats.form}
        icon={<Activity className="h-3 w-3" />}
        accent
        compact={compact}
      />

      {/* ──────── RANG PRIMAIRE : Écart Elo ──────── */}
      <PrimaryChip
        label={t("eloGap")}
        value={`+${stats.eloGap}`}
        icon={<TrendingUp className="h-3 w-3" />}
        compact={compact}
      />

      {/* ──────── RANG PRIMAIRE : Surface ──────── */}
      <PrimaryChip
        label={t("surface")}
        value={surface ?? stats.surface}
        icon={<MapPin className="h-3 w-3" />}
        compact={compact}
      />

      {/* ──────── RANG SECONDAIRE : H2H ──────── */}
      <SecondaryChip
        label={t("h2h")}
        value={stats.h2h}
        compact={compact}
      />

      {/* ──────── RANG SECONDAIRE : IC 95% ──────── */}
      <SecondaryChip
        label={t("ic95")}
        value={`[${stats.ic[0]}, ${stats.ic[1]}]`}
        compact={compact}
      />

      {/* ──────── RANG SECONDAIRE : Confiance ──────── */}
      {!hideTertiary && (
        <SecondaryChip
          label={t("confidence")}
          value={stats.confidence.toFixed(2)}
          className={confidenceColor(stats.confidence)}
          compact={compact}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────
// Sous-composants internes
// ────────────────────────────────────────────

/**
 * Chip primaire — fond légèrement plus prononcé, texte semi-gras,
 * icône décorative. Pour les 3 indicateurs les plus importants.
 */
function PrimaryChip({
  label,
  value,
  icon,
  accent = false,
  compact = false,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  accent?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 rounded-lg border",
        "transition-colors hover:bg-muted/70",
        accent
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-border/60 bg-muted/40",
        compact ? "px-2 py-1.5" : "px-3 py-2",
      )}
    >
      <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {icon && <span aria-hidden>{icon}</span>}
        {label}
      </span>
      <span
        className={cn(
          "font-mono font-bold tabular-nums text-foreground",
          compact ? "text-sm" : "text-sm sm:text-base",
        )}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Chip secondaire — plus discret, taille réduite, pour H2H/IC/Confiance.
 */
function SecondaryChip({
  label,
  value,
  className,
  compact = false,
}: {
  label: string;
  value: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 rounded-lg border border-border/40",
        "bg-muted/20 transition-colors hover:bg-muted/50",
        compact ? "px-2 py-1.5" : "px-3 py-2",
        className,
      )}
    >
      <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70">
        {label}
      </span>
      <span
        className="font-mono text-xs font-medium tabular-nums text-muted-foreground"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </span>
    </div>
  );
}
