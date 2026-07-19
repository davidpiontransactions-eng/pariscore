"use client";

// PlayerStatline — ligne de stats compacte sous le nom du joueur.
//
// Affiche en permanence la statline PRIMAIRE :
//   `#85 · Elo 1845 · SPS 72 ⓘ`
// (ranking ATP/WTA + Elo standard + SPS), et révèle au survol (tooltip) les
// métriques SECONDAIRES liées à la surface :
//   - Elo Surface + son rang
//   - SPS + son rang + la confiance (nb matchs)
//
// Toute valeur manquante (joueur inconnu / base vide) affiche un fallback
// `—` propre plutôt que `#0` ou `Elo 1500`, qui sont trompeurs.
//
// Les données enrichies viennent du hook usePlayerStats (SWR). Le composant
// reçoit le `player` (pour le nom + la valeur Elo de base) et les stats
// résolues pour ce joueur.

import { useTranslations } from "next-intl";
import { Info } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import type { Player } from "@/lib/tennis-data";
import type { PlayerStats } from "@/lib/tennis-stats/types";
import { Sparkline } from "./sparkline";
import { fmtSPS } from "@/lib/tennis-stats/sps-utils";
import { cn } from "@/lib/utils";

const EM_DASH = "—";

function fmt(n: number | null | undefined): string {
  // Number = affiché tel quel ; null/undefined = em-dash.
  if (n == null || Number.isNaN(n)) return EM_DASH;
  return String(n);
}

type Props = {
  player: Player;
  /** Stats enrichies résolues pour CE joueur (depuis usePlayerStats). */
  stats?: PlayerStats | null;
  /** Surface du match (libellé UI : Dur / Terre battue / Gazon). */
  surface: string;
  /** Données sparkline Elo 30j (passées depuis match-card). */
  sparklineData?: number[];
  /** Largeur/hauteur sparkline héritées du mode terminal/simple. */
  sparkWidth?: number;
  sparkHeight?: number;
  terminalMode?: boolean;
};

export function PlayerStatline({
  player,
  stats,
  surface,
  sparklineData = [],
  sparkWidth,
  sparkHeight,
  terminalMode = false,
}: Props) {
  // Sparkline dimensions inherit from terminal mode when not explicit.
  const w = sparkWidth ?? (terminalMode ? 80 : 50);
  const h = sparkHeight ?? (terminalMode ? 22 : 16);
  const t = useTranslations("statline");

  // Résolution des valeurs : on privilégie les stats enrichies (DB), sinon
  // on retombe sur le `player.rank`/`player.elo` de la chaîne prematch
  // (qui peut être 0 / 1500 pour un joueur inconnu — auquel cas on affiche —).
  const elo = stats?.elo ?? player.elo;
  // Ranking : ATP si circuit ATP, WTA sinon. On prend le non-null.
  const rank = stats?.atpRank ?? stats?.wtaRank ?? null;
  const circuitLabel =
    stats?.atpRank != null ? "ATP" : stats?.wtaRank != null ? "WTA" : null;

  const eloSurface = stats?.eloSurface != null ? Math.round(stats.eloSurface) : null;
  const surfaceEloRank = stats?.surfaceEloRank ?? null;
  const sps = stats?.sps ?? null;
  const spsRank = stats?.spsRank ?? null;
  const spsConfidence = stats?.spsConfidence ?? null;
  const spsMatches = stats?.spsMatches ?? null;

  // Si on a au moins une métrique surface secondaire → on active le tooltip.
  const hasSurfaceDetail =
    eloSurface != null || surfaceEloRank != null || sps != null || spsRank != null;

  // Elo affiché : si la DB donne une vraie valeur ET qu'elle diffère du
  // fallback 1500, on l'utilise ; sinon on garde player.elo (mock case).
  const eloDisplay = stats?.elo != null ? Math.round(stats.elo) : elo;
  const eloIsFallback = stats?.elo == null && player.elo === 1500;

  return (
    <div
      className={cn(
        "mt-0.5 flex items-center gap-2 font-mono text-xs text-muted-foreground",
        terminalMode && "gap-1.5"
      )}
    >
      {/* Ranking ATP/WTA */}
      <span
        className="tabular-nums"
        title={circuitLabel ? `${circuitLabel} ${t("rank")}` : t("rankUnknown")}
      >
        {rank != null ? `#${rank}` : `#${EM_DASH}`}
      </span>
      <span className="text-border" aria-hidden>
        ·
      </span>
      {/* Elo standard */}
      <span
        className="tabular-nums"
        title={eloIsFallback ? t("eloUnknown") : t("elo")}
      >
        Elo {eloIsFallback ? EM_DASH : fmt(eloDisplay)}
      </span>
      {/* SPS (si dispo) */}
      {sps != null && (
        <>
          <span className="text-border" aria-hidden>
            ·
          </span>
          <span className="tabular-nums">SPS {fmtSPS(sps)}</span>
        </>
      )}
      {/* Indicateur tooltip + sparkline */}
      {hasSurfaceDetail && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="ml-0.5 inline-flex items-center text-muted-foreground/70 transition-colors hover:text-foreground"
              aria-label={t("surfaceDetails")}
            >
              <Info className="h-3 w-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            className="max-w-[220px] border bg-popover text-popover-foreground shadow-md"
          >
            <div className="space-y-1.5 py-0.5 text-[11px]">
              <p className="font-semibold">
                {t("surfaceTitle", { surface })}
              </p>
              <SurfaceMetric
                label={t("eloSurface")}
                value={fmt(eloSurface)}
                rank={surfaceEloRank != null ? `#${surfaceEloRank}` : null}
              />
              <SurfaceMetric
                label="SPS"
                value={fmtSPS(sps)}
                rank={spsRank != null ? `#${spsRank}` : null}
              />
              {spsMatches != null && (
                <p className="pt-0.5 text-muted-foreground">
                  {t("confidence", {
                    pct: spsConfidence ? Math.round(spsConfidence * 100) : 0,
                    n: spsMatches,
                  })}
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      )}
      {/* Sparkline Elo 30j — conservé à l'identique de l'ancien affichage */}
      {sparklineData.length > 1 && (
        <Sparkline
          data={sparklineData}
          width={w}
          height={h}
          color={player.color}
          strokeWidth={1.5}
          ariaLabel={t("sparklineAria", { name: player.name })}
        />
      )}
    </div>
  );
}

/** Ligne métrique surface : `Elo Surface    1820  #12`. */
function SurfaceMetric({
  label,
  value,
  rank,
}: {
  label: string;
  value: string;
  rank: string | null;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 tabular-nums">
        <span className="font-medium">{value}</span>
        {rank && (
          <span className="rounded bg-muted px-1 text-[10px] text-muted-foreground">
            {rank}
          </span>
        )}
      </span>
    </div>
  );
}
