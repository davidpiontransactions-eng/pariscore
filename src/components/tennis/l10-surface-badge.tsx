"use client";

// L10SurfaceBadge — badge compact du score L10 Surface (spec PariScore).
//
// Score d'activité récente : 10 derniers matchs terminés, même surface,
// fenêtre 3 mois, Elo figé par semaine (snapshots TennisAbstract).
// Badge coloré par catégorie de performance (sous-performant / moyen /
// surperformance) + tooltip listant les matchs pris en compte (adversaire,
// tournoi, score, points). Réutilisé par PlayerStatline (prematch), la carte
// LIVE (match-card-broadcast) et les vues détail.

import { useTranslations } from "next-intl";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import type { L10SurfaceScoreResult } from "@/types/tennis-l10";
import { cn } from "@/lib/utils";

const EM_DASH = "—";

type Props = {
  /** Résultat L10 Surface calculé pour CE joueur (jamais null : le badge
   *  n'est rendu que si l10Surface != null && matches > 0 en amont). */
  stats: L10SurfaceScoreResult;
  /** Libellé surface du match (Dur / Terre battue / Gazon). */
  surface: string;
  /** Variante compacte (carte LIVE colonne) vs inline (statline prematch). */
  compact?: boolean;
};

const PERF_STYLES = {
  over: "border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  average: "border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-400",
  under: "border-rose-500/40 bg-rose-500/15 text-rose-600 dark:text-rose-400",
} as const;

const PERF_BG = {
  over: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  average: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  under: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
} as const;

export function L10SurfaceBadge({ stats, surface, compact = false }: Props) {
  const t = useTranslations("statline");

  // Si aucun match n'a pu être noté (snapshots Elo absents pour ces semaines),
  // le score 0 serait trompeur → on affiche « — » et on le dit dans le tooltip.
  const rated = stats.rated > 0;
  const scoreLabel = rated ? String(stats.score) : EM_DASH;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-0.5 rounded border px-1.5 py-px font-medium",
            PERF_STYLES[stats.performance],
          )}
          aria-label={t("l10Surface")}
        >
          <span className="tabular-nums">
            L10 {scoreLabel}
          </span>
          <span
            className={cn(
              "text-[10px] text-muted-foreground",
              compact && "hidden sm:inline",
            )}
          >
            {stats.wins}-{stats.losses}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        className="max-w-[380px] border bg-popover text-popover-foreground shadow-md"
      >
        <div className="space-y-1.5 py-0.5 text-[11px]">
          <p className="font-semibold">
            {t("l10Surface")} · {surface}
          </p>
          <p className="text-muted-foreground">
            {rated
              ? t("l10SurfaceDetail", {
                  score: stats.score,
                  wins: stats.wins,
                  losses: stats.losses,
                  matches: stats.matches,
                })
              : t("l10SurfaceUnrated", { matches: stats.matches })}
          </p>
          {rated && (
            <span
              className={cn(
                "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold",
                PERF_BG[stats.performance],
              )}
            >
              {t(
                stats.performance === "over"
                  ? "l10PerfOver"
                  : stats.performance === "average"
                    ? "l10PerfAverage"
                    : "l10PerfUnder",
              )}
            </span>
          )}
          <div className="max-h-56 space-y-0.5 overflow-y-auto border-t border-border/60 pt-1">
            {stats.details.map((m, i) => (
              <div
                key={i}
                title={`${new Date(m.date).toLocaleDateString()} · ${m.round}`}
                className="flex items-center gap-2 tabular-nums text-[10px]"
              >
                <span
                  className={
                    m.result === "W"
                      ? "w-3 shrink-0 font-bold text-emerald-500"
                      : "w-3 shrink-0 font-bold text-rose-500"
                  }
                >
                  {m.result}
                </span>
                <span className="min-w-0 flex-1 truncate">{m.opponentName}</span>
                <span className="min-w-0 max-w-[120px] flex-1 truncate text-muted-foreground/70">
                  {m.tournament}
                </span>
                <span className="shrink-0 text-muted-foreground/60">
                  {m.score || EM_DASH}
                </span>
                <span className="w-6 shrink-0 text-right text-muted-foreground/80">
                  {m.rated ? `+${m.points}` : "·"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}