"use client";

// Mma1xBetGrid — grille "offre 1xBet" style capture 1X2 (V1 / X / V2) par
// combat, enrichie du modèle prédictif PariScore :
//   · cote 1xBet + proba juste devigée (marché) sous chaque colonne
//   · proba modèle (ps_prob ensembliste) sur le côté le plus intéressant
//   · edge = p × (o − 1) − (1 − p)  (nul = défaite, cf. lib moneyline)
//   · Kelly fractional (cap 0.25) du côté à edge positif
// Tri par edge décroissant. Rendu null si aucune cote exploitable.

import { useMemo } from "react";
import { TrendingUp, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatGridTime } from "@/lib/mma-time";
import {
  devigMoneyline,
  modelEdge,
  kellyForSide,
} from "@/lib/prediction/mma/moneyline";
import type { MmaFight } from "./mma-fight-card";

type Props = {
  fights: MmaFight[];
  className?: string;
};

type GridRow = {
  fight: MmaFight;
  fair1: number;
  fairX: number;
  fair2: number;
  modelA: number;
  edge1: number;
  edge2: number;
  kellyPct: number;
  kellyCapped: boolean;
  bestSide: 1 | 2 | null;
  hour: string;
};

const pct = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`;

function formatHour(iso: string): string {
  return formatGridTime(iso);
}

export function Mma1xBetGrid({ fights, className }: Props) {
  const rows = useMemo<GridRow[]>(() => {
    const out: GridRow[] = [];
    for (const f of fights) {
      if (f.best_odds_a == null || f.best_odds_b == null) continue;
      if (f.ps_prob_a == null) continue;
      const fair = devigMoneyline(f.best_odds_a, f.draw_odds, f.best_odds_b);
      const edge = modelEdge(f.ps_prob_a, f.best_odds_a, f.draw_odds, f.best_odds_b);
      if (!fair || !edge) continue;
      const bestSide = edge.best?.side ?? null;
      const kelly =
        bestSide != null
          ? kellyForSide(f.ps_prob_a, bestSide, bestSide === 1 ? f.best_odds_a : f.best_odds_b)
          : { pct: 0, capped: false };
      out.push({
        fight: f,
        fair1: fair.fair1,
        fairX: fair.fairX,
        fair2: fair.fair2,
        modelA: f.ps_prob_a,
        edge1: edge.edge1,
        edge2: edge.edge2,
        kellyPct: kelly.pct,
        kellyCapped: kelly.capped,
        bestSide,
        hour: formatHour(f.commence_time),
      });
    }
    // Tri : edge positif d'abord (décroissant), puis horaire.
    return out.sort((a, b) => {
      const ea = Math.max(a.edge1, a.edge2);
      const eb = Math.max(b.edge1, b.edge2);
      if (ea !== eb) return eb - ea;
      return a.fight.commence_time.localeCompare(b.fight.commence_time);
    });
  }, [fights]);

  if (rows.length === 0) return null;

  const valueCount = rows.filter((r) => Math.max(r.edge1, r.edge2) > 0.03).length;

  return (
    <section
      className={cn("rounded-2xl border border-border bg-card p-4 shadow-sm", className)}
      aria-label="Grille des cotes 1xBet avec edge du modèle"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Wallet className="h-4 w-4 text-[var(--sport-mma)]" />
        <h3 className="text-sm font-bold text-foreground">Offre 1xBet · modèle</h3>
        <span className="text-[11px] text-muted-foreground">
          de-vig 1X2 + edge PariScore + Kelly
        </span>
        {valueCount > 0 && (
          <span className="ml-auto rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
            {valueCount} value{valueCount > 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-y-1 text-center">
          <thead>
            <tr className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-2 pb-1 text-left">
                Combat
              </th>
              <th scope="col" className="px-2 pb-1">
                V1
              </th>
              <th scope="col" className="px-2 pb-1">
                X
              </th>
              <th scope="col" className="px-2 pb-1">
                V2
              </th>
              <th scope="col" className="px-2 pb-1">
                Edge
              </th>
              <th scope="col" className="px-2 pb-1">
                Kelly
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const edgeBest = Math.max(r.edge1, r.edge2);
              const hasValue = edgeBest > 0.03;
              return (
                <tr
                  key={`${r.fight.fighter_a}-${r.fight.fighter_b}`}
                  className="align-middle"
                >
                  {/* Combat + heure */}
                  <td className="rounded-l-lg bg-muted/30 px-2 py-1.5 text-left">
                    <p className="max-w-[200px] truncate text-xs font-semibold text-foreground sm:max-w-none">
                      {r.fight.fighter_a} <span className="text-muted-foreground">vs</span>{" "}
                      {r.fight.fighter_b}
                    </p>
                    <p className="text-[10px] tabular-nums text-muted-foreground">{r.hour}</p>
                  </td>

                  {/* V1 : cote + juste + modèle */}
                  <td className="px-2 py-1.5">
                    <p
                      className={cn(
                        "text-sm font-bold tabular-nums",
                        r.bestSide === 1 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground",
                      )}
                    >
                      {r.fight.best_odds_a?.toFixed(2)}
                    </p>
                    <p className="text-[10px] tabular-nums text-muted-foreground">
                      {pct(r.fair1)} · mod {pct(r.modelA, 0)}
                    </p>
                  </td>

                  {/* X : cote + juste (modèle = 0 — hors ensembling) */}
                  <td className="px-2 py-1.5">
                    <p className="text-sm font-bold tabular-nums text-muted-foreground">
                      {r.fight.draw_odds != null ? r.fight.draw_odds.toFixed(2) : "—"}
                    </p>
                    <p className="text-[10px] tabular-nums text-muted-foreground/70">
                      {r.fairX > 0 ? pct(r.fairX) : "—"}
                    </p>
                  </td>

                  {/* V2 */}
                  <td className="px-2 py-1.5">
                    <p
                      className={cn(
                        "text-sm font-bold tabular-nums",
                        r.bestSide === 2 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground",
                      )}
                    >
                      {r.fight.best_odds_b?.toFixed(2)}
                    </p>
                    <p className="text-[10px] tabular-nums text-muted-foreground">
                      {pct(r.fair2)} · mod {pct(1 - r.modelA, 0)}
                    </p>
                  </td>

                  {/* Edge du meilleur côté */}
                  <td className="px-2 py-1.5">
                    {hasValue ? (
                      <span className="inline-flex items-center gap-0.5 rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        <TrendingUp className="h-3 w-3" />
                        {r.bestSide === 1
                          ? `V1 +${(r.edge1 * 100).toFixed(1)}%`
                          : `V2 +${(r.edge2 * 100).toFixed(1)}%`}
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
                        {edgeBest >= 0 ? "+" : ""}
                        {(edgeBest * 100).toFixed(1)}%
                      </span>
                    )}
                  </td>

                  {/* Kelly fractional du côté retenu */}
                  <td className="rounded-r-lg bg-muted/30 px-2 py-1.5">
                    {r.kellyPct > 0 ? (
                      <span className="text-xs font-bold tabular-nums text-foreground">
                        {r.kellyPct.toFixed(1)}%
                        {r.kellyCapped && <span className="text-amber-500">*</span>}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground/60">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground/70">
        Probas juste = dévig 1X2 du book · Modèle = blend PariScore (marché 55 % /
        DRatings 30 % / modèle 15 %) · Edge = p×(cote−1) − (1−p), nul compté comme
        défaite · Kelly fractional capé à 25 % (*).
      </p>
    </section>
  );
}
