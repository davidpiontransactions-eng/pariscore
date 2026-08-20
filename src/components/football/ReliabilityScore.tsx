"use client";

import { Gauge, Check, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { STAKING_LABELS, type StakingMethod } from "@/lib/football-backtest";
import type { FootballBacktestState } from "@/hooks/use-football-backtest";

const WINDOW_OPTIONS = [30, 60, 120] as const;

function scoreColor(score: number): string {
  if (score >= 70) return "text-emerald-400";
  if (score >= 45) return "text-amber-400";
  return "text-rose-400";
}

function barColor(score: number): string {
  if (score >= 70) return "bg-emerald-400";
  if (score >= 45) return "bg-amber-400";
  return "bg-rose-400";
}

/**
 * Score de fiabilité (Phase 4) — note globale 0-100 sur 5 piliers + contrôles de
 * staking et de fenêtre glissante, calculés sur les matchs terminés réels.
 */
export function ReliabilityScore({ state, className }: { state: FootballBacktestState; className?: string }) {
  const { backtest, reliability, finishedCount, method, windowDays, setMethod, setWindowDays } = state;

  return (
    <section className={cn("rounded-2xl border border-border/70 bg-card p-4", className)} aria-label="Fiabilité du système">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Gauge className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
          Fiabilité du système
        </h3>
        <span className="text-xs text-muted-foreground">{finishedCount} match(s) terminé(s)</span>
      </header>

      {finishedCount === 0 ? (
        <p className="rounded-lg bg-muted/30 px-3 py-4 text-center text-xs text-muted-foreground">
          Aucun match terminé dans la fenêtre. Le backtest démarrera dès que des résultats seront disponibles.
        </p>
      ) : (
        <>
          {/* Contrôles */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as StakingMethod)}
              className="rounded-md border border-border bg-background px-2 py-1 text-xs"
              aria-label="Méthode de staking"
            >
              {(Object.keys(STAKING_LABELS) as StakingMethod[]).map((m) => (
                <option key={m} value={m}>
                  {STAKING_LABELS[m]}
                </option>
              ))}
            </select>
            <div className="flex rounded-md border border-border p-0.5">
              {WINDOW_OPTIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setWindowDays(d)}
                  className={cn(
                    "rounded px-2 py-0.5 text-xs font-semibold transition-colors",
                    windowDays === d ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {d}j
                </button>
              ))}
            </div>
          </div>

          {/* Note globale + résumé P&L */}
          <div className="mb-3 flex items-center gap-4">
            <div className="flex flex-col items-center">
              <span className={cn("flex items-center gap-1 text-3xl font-black tabular-nums", scoreColor(reliability.overall))}>
                <span aria-hidden="true">
                  {reliability.overall >= 70 ? (
                    <Check className="h-4 w-4" strokeWidth={3} />
                  ) : reliability.overall >= 45 ? (
                    <AlertTriangle className="h-4 w-4" strokeWidth={3} />
                  ) : (
                    <X className="h-4 w-4" strokeWidth={3} />
                  )}
                </span>
                {reliability.overall}
              </span>
              <span className="text-xs uppercase tracking-wider text-muted-foreground">/ 100</span>
            </div>
            <div className="grid flex-1 grid-cols-3 gap-2 text-center">
              <div>
                <p className={cn("text-sm font-bold tabular-nums", backtest.unitsProfit >= 0 ? "text-emerald-400" : "text-rose-400")}>
                  {backtest.unitsProfit >= 0 ? "+" : ""}
                  {backtest.unitsProfit.toFixed(1)}u
                </p>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Profit</p>
              </div>
              <div>
                <p className="text-sm font-bold tabular-nums text-foreground">{backtest.roi.toFixed(1)}%</p>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">ROI</p>
              </div>
              <div>
                <p className="text-sm font-bold tabular-nums text-foreground">
                  {backtest.wins}/{backtest.totalBets}
                </p>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Gagnés</p>
              </div>
            </div>
          </div>

          {/* Piliers */}
          <ul className="space-y-2">
            {reliability.pillars.map((p) => (
              <li key={p.key}>
                <div className="mb-0.5 flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-foreground">{p.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {p.score} · {p.detail}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full", barColor(p.score))} style={{ width: `${p.score}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
