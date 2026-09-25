"use client";

import { useVitibetTop } from "@/hooks/use-vitibet-tips";
import { fmtIndex, indexTone } from "@/lib/vitibet/format";
import type { VitibetTip, VitibetTipValue } from "@/lib/vitibet/types";

// Couleurs via tokens du thème light (bg-*/text-*) — miroir handball-match-card.

const INDEX_CHIP_CLASS: Record<ReturnType<typeof indexTone>, string> = {
  home: "bg-emerald-500/10 text-emerald-600",
  away: "bg-red-500/10 text-red-600",
  neutral: "bg-muted text-muted-foreground",
};

const TIP_CHIP_CLASS: Record<VitibetTipValue, string> = {
  "1": "bg-emerald-500/10 text-emerald-600",
  X: "bg-yellow-500/10 text-yellow-600",
  "2": "bg-blue-500/10 text-blue-600",
};

/** Date « d MMM » compacte pour une date « AAAA-MM-JJ ». */
function fmtDay(dateMatch: string): string {
  const d = new Date(`${dateMatch}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? "–"
    : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", timeZone: "UTC" });
}

/** Score prédit « 36-31 » — « – » si absent (jamais de score inventé). */
function fmtScorePredit(tip: VitibetTip): string {
  return tip.scorePreditD != null && tip.scorePreditE != null
    ? `${tip.scorePreditD}-${tip.scorePreditE}`
    : "–";
}

/**
 * Section « Top 10 par INDEX » — les 10 pronostics J → J+3 les plus
 * déséquilibrés (|INDEX| décroissant) avec tip et score prédit.
 * Rendu silencieux si aucun pronostic (table vitibet_tips encore absente).
 */
export function HandballVitibetTop10() {
  const { tips, error, isLoading } = useVitibetTop(10);

  if (isLoading) {
    return (
      <section className="rounded border border-border bg-card p-3">
        <div className="py-3 text-center text-sm text-muted-foreground" aria-live="polite">
          Chargement des pronostics…
        </div>
      </section>
    );
  }

  // Dégradation gracieuse : pas de table / pas de données → section masquée.
  if (error || tips.length === 0) return null;

  return (
    <section className="space-y-2 rounded border border-border bg-card p-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="text-sm font-semibold text-foreground">🔮 Top 10 par INDEX</h3>
        <span className="text-xs text-muted-foreground">
          {tips.length} pronostic(s) · source vitibet.com
        </span>
      </div>

      {/* Mini-banner J → J+3 (pas de navigation de dates dans le calendrier) */}
      <div className="rounded bg-muted px-2 py-1 text-[11px] text-muted-foreground">
        📅 Pronostics J → J+3 — favoris les plus lourds selon l&apos;INDEX
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="py-1.5 pr-2 font-medium">Quand</th>
              <th className="py-1.5 pr-2 font-medium">Match</th>
              <th className="py-1.5 pr-2 font-medium">Tip</th>
              <th className="py-1.5 pr-2 font-medium">Score prédit</th>
              <th className="py-1.5 pr-2 text-right font-medium">INDEX</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {tips.map((t) => (
              <tr key={`${t.fixtureId}-${t.leagueId}-${t.dateMatch}`}>
                <td className="whitespace-nowrap py-1.5 pr-2 tabular-nums text-muted-foreground">
                  {fmtDay(t.dateMatch)} {t.heure ?? ""}
                </td>
                <td className="py-1.5 pr-2 text-foreground">
                  <span className="font-medium">{t.equipeDom}</span>{" "}
                  <span className="text-muted-foreground">vs</span>{" "}
                  <span className="font-medium">{t.equipeExt}</span>
                </td>
                <td className="py-1.5 pr-2">
                  {t.tip ? (
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono font-semibold tabular-nums ${TIP_CHIP_CLASS[t.tip]}`}
                    >
                      {t.tip}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">–</span>
                  )}
                </td>
                <td className="py-1.5 pr-2 font-mono tabular-nums text-muted-foreground">
                  {fmtScorePredit(t)}
                </td>
                <td className="py-1.5 pr-2 text-right">
                  <span
                    className={`rounded px-1.5 py-0.5 font-mono font-semibold tabular-nums ${INDEX_CHIP_CLASS[indexTone(t.indexValue)]}`}
                  >
                    {fmtIndex(t.indexValue)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
