"use client";

// ShotQualityPanel — « Qualité des tirs » (parité PackBall, option 1 du plan
// T4). N'affiche que ce qui est dérivable des agrégats boxscore : répartition
// buts / sauvés / ratés, taux de conversion, xG moyen par tir, écart xG–réel.
//
// Règle d'honnêteté : les métriques xG sont masquées si la source ne fournit
// pas de xG (plan gratuit API-Football) — jamais de 0 affiché à la place.

import { useMemo } from "react";
import { Crosshair, Target, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { FOT } from "./fotmob-theme";
import { buildShotQuality, type ShotQualitySide } from "@/lib/football-shot-quality";
import type { FootballLiveState } from "@/lib/football-data";
import type { TimelineTotals } from "@/lib/football-timeline";

/** Barre empilée buts / sauvés / ratés (couleurs fixes, indépendant du camp). */
function ShotSplitBar({ s }: { s: ShotQualitySide }) {
  const total = s.goals + s.saved + s.offTarget;
  if (total <= 0) {
    return <div className="h-2.5 w-full rounded-full" style={{ backgroundColor: FOT.border }} />;
  }
  const seg = (n: number, bg: string) => (n > 0 ? (
    <div style={{ width: `${(n / total) * 100}%`, backgroundColor: bg }} />
  ) : null);
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full" title={`${s.goals} buts · ${s.saved} sauvés · ${s.offTarget} ratés`}>
      {seg(s.goals, "#22c55e")}
      {seg(s.saved, "#3b82f6")}
      {seg(s.offTarget, FOT.border)}
    </div>
  );
}

/** Une ligne de métrique : libellé, valeur home, valeur away. */
function Metric({
  label,
  home,
  away,
  icon: Icon,
  hint,
  flagHome,
  flagAway,
}: {
  label: string;
  home: string;
  away: string;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
  flagHome?: boolean;
  flagAway?: boolean;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-1 py-0.5">
      <span className="text-right text-[12px] font-bold tabular-nums" style={{ color: flagHome ? FOT.live : FOT.ink }}>
        {home}
        {flagHome && <span className="ml-1" style={{ color: FOT.live }}>▲</span>}
      </span>
      <span
        className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: FOT.muted }}
        title={hint}
      >
        <Icon className="h-3 w-3" />
        <span className="whitespace-nowrap">{label}</span>
      </span>
      <span className="text-[12px] font-bold tabular-nums" style={{ color: flagAway ? FOT.live : FOT.ink }}>
        {away}
        {flagAway && <span className="ml-1" style={{ color: FOT.live }}>▲</span>}
      </span>
    </div>
  );
}

export function ShotQualityPanel({
  live,
  totals,
  xgTotals,
  homeName = "Domicile",
  awayName = "Extérieur",
  className,
}: {
  live: FootballLiveState;
  /** Totaux boxscore (API-Football) — prioritaire sur `live` quand présents. */
  totals?: TimelineTotals | null;
  /** xG cumulés de la timeline. */
  xgTotals?: { home: number; away: number } | null;
  homeName?: string;
  awayName?: string;
  className?: string;
}) {
  const q = useMemo(
    () =>
      buildShotQuality({
        goals: { home: live.homeScore, away: live.awayScore },
        // Les totaux API-Football priment : le flux live BSD est parfois vide.
        shots: { home: totals?.shots?.home ?? live.homeShots, away: totals?.shots?.away ?? live.awayShots },
        sot: { home: totals?.sot?.home ?? live.homeShotsOnTarget, away: totals?.sot?.away ?? live.awayShotsOnTarget },
        xg: xgTotals ?? { home: live.homeXg, away: live.awayXg },
      }),
    [live, totals, xgTotals],
  );

  const noShots = q.home.shots + q.away.shots === 0;
  const pct = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)}%`);
  const dec = (v: number | null) => (v == null ? "—" : v.toFixed(2));

  // Écart xG–réel : on marque le camp qui surperforme le plus.
  const flagDelta = (s: ShotQualitySide, other: ShotQualitySide) => {
    if (s.xgDelta == null || other.xgDelta == null) return false;
    return Math.abs(s.xgDelta) > 0.3 && Math.abs(s.xgDelta) > Math.abs(other.xgDelta);
  };

  return (
    <div
      className={cn("rounded-2xl border p-3", className)}
      style={{ backgroundColor: FOT.card, borderColor: FOT.border }}
    >
      <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: FOT.muted }}>
        <Crosshair className="h-3.5 w-3.5" />
        Qualité des tirs
      </h3>

      {noShots ? (
        <p className="py-3 text-center text-xs" style={{ color: FOT.muted }}>
          Statistiques de tirs indisponibles pour ce match
        </p>
      ) : (
        <div className="space-y-2.5">
          {/* Répartition des tirs : but / sauvé / raté */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px]" style={{ color: FOT.muted }}>
              <span className="truncate">{homeName}</span>
              <span className="tabular-nums">
                {q.home.goals}⚽ · {q.home.saved}🧤 · {q.home.offTarget}✗
              </span>
            </div>
            <ShotSplitBar s={q.home} />
            <div className="flex items-center justify-between text-[10px]" style={{ color: FOT.muted }}>
              <span className="truncate">{awayName}</span>
              <span className="tabular-nums">
                {q.away.goals}⚽ · {q.away.saved}🧤 · {q.away.offTarget}✗
              </span>
            </div>
            <ShotSplitBar s={q.away} />
            <p className="text-[9px] leading-snug" style={{ color: FOT.muted }}>
              <span className="text-emerald-600">■</span> buts ·{" "}
              <span className="text-blue-600">■</span> sauvés · <span>■</span> ratés/blockés
            </p>
          </div>

          <div className="space-y-0.5 border-t pt-1.5" style={{ borderColor: FOT.border }}>
            <Metric
              label="Conversion"
              home={pct(q.home.conversionPct)}
              away={pct(q.away.conversionPct)}
              icon={Target}
              hint="Buts / tirs totaux"
            />
            <Metric
              label="Cadrement"
              home={pct(q.home.onTargetPct)}
              away={pct(q.away.onTargetPct)}
              icon={Crosshair}
              hint="Tirs cadrés / tirs totaux"
            />
            {q.hasXg ? (
              <>
                <Metric
                  label="xG / tir"
                  home={dec(q.home.xgPerShot)}
                  away={dec(q.away.xgPerShot)}
                  icon={Crosshair}
                  hint="xG cumulé / tirs totaux — qualité moyenne de chaque tentative"
                />
                <Metric
                  label="Écart xG"
                  home={q.home.xgDelta == null ? "—" : (q.home.xgDelta > 0 ? `+${dec(q.home.xgDelta)}` : dec(q.home.xgDelta))}
                  away={q.away.xgDelta == null ? "—" : (q.away.xgDelta > 0 ? `+${dec(q.away.xgDelta)}` : dec(q.away.xgDelta))}
                  icon={q.home.xgDelta != null && (q.home.xgDelta ?? 0) >= 0 ? TrendingUp : TrendingDown}
                  hint="Buts réels − xG. Positif = l'équipe marque plus que la qualité ne le justifiait."
                  flagHome={flagDelta(q.home, q.away)}
                  flagAway={flagDelta(q.away, q.home)}
                />
              </>
            ) : (
              <p className="px-1 pt-1 text-[9px] leading-snug" style={{ color: FOT.muted }}>
                xG non disponible sur ce plan — métriques de qualité masquées plutôt qu'approximées.
              </p>
            )}
          </div>

          {q.thinData && (
            <p className="text-[9px]" style={{ color: FOT.muted }}>
              Peu de tirs — ratios sensibles au bruit.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
