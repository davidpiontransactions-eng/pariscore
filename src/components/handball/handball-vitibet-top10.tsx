"use client";

import { useVitibetTop } from "@/hooks/use-vitibet-tips";
import { fmtIndex, indexTone } from "@/lib/vitibet/format";
import { bestOverLine } from "@/lib/vitibet/over";
import type { VitibetTip, VitibetTipValue } from "@/lib/vitibet/types";
import { HandballTableCaption } from "./handball-table-caption";

// Couleurs via tokens du thème light (bg-*/text-*) — miroir handball-match-card.

const INDEX_CHIP_CLASS: Record<ReturnType<typeof indexTone>, string> = {
  home: "bg-emerald-500/10 text-emerald-600",
  away: "bg-red-500/10 text-red-600",
  neutral: "bg-muted text-[#717171]",
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
  const { tips, scoreSigma, error, isLoading } = useVitibetTop(10);
  const sigma = scoreSigma?.sigma ?? null;

  if (isLoading) {
    return (
      <section className="rounded border border-[#f0f0f0] bg-white p-3">
        <div className="py-3 text-center text-sm text-[#717171]" aria-live="polite">
          Chargement des pronostics…
        </div>
      </section>
    );
  }

  // Dégradation gracieuse : pas de table / pas de données → section masquée.
  if (error || tips.length === 0) return null;

  return (
    <section className="space-y-2 rounded border border-[#f0f0f0] bg-white p-3 text-[#222222]">
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="text-sm font-semibold text-[#222222]">🔮 Top 10 par INDEX</h3>
        <span className="text-xs text-[#717171]">
          {tips.length} pronostic(s) · source vitibet.com
        </span>
      </div>

      {/* Mini-banner J → J+3 (pas de navigation de dates dans le calendrier) */}
      <div className="rounded bg-[#f5f5f5] px-2 py-1 text-[11px] text-[#717171]">
        📅 Pronostics J → J+3 — favoris les plus lourds selon l&apos;INDEX
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <HandballTableCaption>Pronostics Vitibet — J → J+3</HandballTableCaption>
          <thead>
            <tr className="border-b border-[#f0f0f0] text-left text-[#717171]">
              <th className="py-1.5 pr-2 font-medium">Quand</th>
              <th className="py-1.5 pr-2 font-medium">Match</th>
              <th className="py-1.5 pr-2 font-medium">Tip</th>
              <th className="py-1.5 pr-2 font-medium">Score prédit</th>
              <th className="py-1.5 pr-2 font-medium">Over conseillé</th>
              <th className="py-1.5 pr-2 text-right font-medium">INDEX</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0f0f0]">
            {tips.map((t) => {
              const predTotal =
                t.scorePreditD != null && t.scorePreditE != null
                  ? t.scorePreditD + t.scorePreditE
                  : null;
              const pick = predTotal != null ? bestOverLine(predTotal, sigma) : null;
              return (
              <tr key={`${t.fixtureId}-${t.leagueId}-${t.dateMatch}`}>
                <td className="whitespace-nowrap py-1.5 pr-2 tabular-nums text-[#717171]">
                  {fmtDay(t.dateMatch)} {t.heure ?? ""}
                </td>
                <td className="py-1.5 pr-2 text-foreground">
                  <span className="font-medium">{t.equipeDom}</span>{" "}
                  <span className="text-[#717171]">vs</span>{" "}
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
                    <span className="text-[#717171]">–</span>
                  )}
                </td>
                <td className="py-1.5 pr-2 font-mono tabular-nums text-[#717171]">
                  {fmtScorePredit(t)}
                </td>
                <td className="py-1.5 pr-2">
                  {pick ? (
                    <span
                      title={`P(total > ${pick.line}) = ${(pick.prob * 100).toFixed(0)} % — seuil 65 %`}
                      className="rounded px-1.5 py-0.5 font-mono font-semibold tabular-nums bg-emerald-500/10 text-emerald-600"
                    >
                      O{pick.line} · {(pick.prob * 100).toFixed(0)}%
                    </span>
                  ) : (
                    <span className="text-[#717171]">–</span>
                  )}
                </td>
                <td className="py-1.5 pr-2 text-right">
                  <span
                    className={`rounded px-1.5 py-0.5 font-mono font-semibold tabular-nums ${INDEX_CHIP_CLASS[indexTone(t.indexValue)]}`}
                  >
                    {fmtIndex(t.indexValue)}
                  </span>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
