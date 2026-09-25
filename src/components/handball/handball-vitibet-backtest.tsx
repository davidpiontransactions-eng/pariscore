"use client";

import { useVitibetBacktest } from "@/hooks/use-vitibet-tips";
import type { VitibetBacktestSegment, VitibetTipValue } from "@/lib/vitibet/types";

// Backtest des tips Vitibet (résultat FT vs tip prédit) — style light
// miroir handball-vitibet-top10 (chips colorés, tokens du thème).

const TIP_CHIP_CLASS: Record<VitibetTipValue, string> = {
  "1": "bg-emerald-500/10 text-emerald-600",
  X: "bg-yellow-500/10 text-yellow-600",
  "2": "bg-blue-500/10 text-blue-600",
};

/** « 66.7 % » — jamais de NaN (rate vaut 0 si échantillon vide). */
function fmtRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

/** Période « 18 sept. → 24 sept. » à partir des dates évaluées (« AAAA-MM-JJ »). */
function fmtPeriode(dates: string[]): string {
  if (dates.length === 0) return "–";
  const fmt = (d: string): string =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      timeZone: "UTC",
    });
  return dates.length === 1
    ? fmt(dates[0])
    : `${fmt(dates[0])} → ${fmt(dates[dates.length - 1])}`;
}

/**
 * Section « Backtest Vitibet » : taux de réussite des tips sur les matchs
 * terminés (FT vs prédit), répartition 1/X/2 et période couverte.
 * État vide explicite (0/0 + message) si aucun match évaluable.
 */
export function HandballVitibetBacktest() {
  const { backtest, error, isLoading } = useVitibetBacktest();

  if (isLoading) {
    return (
      <section className="rounded border border-border bg-card p-3">
        <div className="py-3 text-center text-sm text-muted-foreground" aria-live="polite">
          Calcul du backtest Vitibet…
        </div>
      </section>
    );
  }

  if (error || !backtest) {
    return (
      <section className="rounded border border-border bg-card p-3">
        <div className="py-3 text-center text-sm text-muted-foreground" aria-live="polite">
          Backtest Vitibet indisponible
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-2 rounded border border-border bg-card p-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="text-sm font-semibold text-foreground">📈 Backtest Vitibet</h3>
        <span className="text-xs text-muted-foreground">
          {backtest.total} tip(s) évalué(s) · source vitibet.com
        </span>
      </div>

      {backtest.total === 0 ? (
        // État vide explicite : 0/0 + raison — jamais de taux fictif.
        <div className="rounded bg-muted px-2 py-2 text-xs text-muted-foreground" aria-live="polite">
          Taux de réussite : <span className="font-mono font-semibold">0/0</span> — aucun match
          terminé avec pronostic pour l&apos;instant ; le taux s&apos;affiche dès les premiers
          résultats FT.
          {backtest.excludedNoTip > 0 && (
            <span className="mt-1 block">
              {backtest.excludedNoTip} match(s) terminé(s) sans pronostic (exclus du taux).
            </span>
          )}
        </div>
      ) : (
        <>
          {/* Taux global + période couverte */}
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-2xl font-bold tabular-nums text-foreground">
              {fmtRate(backtest.rate)}
            </span>
            <span className="text-xs text-muted-foreground">
              <span className="font-mono tabular-nums">
                {backtest.hits}/{backtest.total}
              </span>{" "}
              tips justes
            </span>
            <span className="ml-auto text-[11px] text-muted-foreground">
              Période : {fmtPeriode(backtest.sampleDates)}
            </span>
          </div>

          {/* Répartition par type de tip (1 / X / 2) */}
          <div className="flex flex-wrap gap-2">
            {(["1", "X", "2"] as const).map((t) => {
              const s: VitibetBacktestSegment = backtest.byTip[t];
              return (
                <div
                  key={t}
                  className="flex items-center gap-1.5 rounded border border-border px-2 py-1 text-xs"
                >
                  <span
                    className={`rounded px-1.5 py-0.5 font-mono font-semibold ${TIP_CHIP_CLASS[t]}`}
                  >
                    {t}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    <span className="font-mono">
                      {s.hits}/{s.total}
                    </span>{" "}
                    · {fmtRate(s.rate)}
                  </span>
                </div>
              );
            })}
          </div>

          {backtest.excludedNoTip > 0 && (
            <p className="text-[11px] text-muted-foreground">
              {backtest.excludedNoTip} match(s) terminé(s) sans pronostic (exclus du taux).
            </p>
          )}
        </>
      )}

      <p className="text-[11px] font-medium text-amber-500">
        ⚠️ Pronostics Vitibet (résultat FT vs tip) — indicatif, pas un conseil de pari.
      </p>
    </section>
  );
}
