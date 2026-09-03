"use client";

/**
 * Vue « Marchés » du domaine rugby :
 * - Tous les marchés par match à venir : spread (ligne + probabilité de
 *   couverture des deux côtés), total over/under, score probable, confiance.
 * - Couverture du spread mesurée par bande de probabilité (backtest honnête :
 *   la ligne est celle du moment de la prédiction, jamais recalculée).
 */

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useRugbyBacktest, useRugbyPredictions } from "@/lib/hooks/use-rugby";
import type { PredictedMatch } from "@/lib/rugby/types";
import {
  Card,
  RugbyTeamLogo,
  fmtDate,
  fmtHandicap,
  fmtTime,
  pct,
} from "./rugby-ui";

export function RugbyMarketsView({ slug }: { slug: string }) {
  const { data, isLoading } = useRugbyPredictions(slug);
  const { data: bt } = useRugbyBacktest(slug);

  const matches = data?.competition?.slug === slug ? data.matches : [];

  const rows = useMemo(() => {
    const out: { date: string; row: PredictedMatch }[] = [];
    for (const m of matches) {
      if (!m.prediction) continue;
      out.push({ date: m.match.date, row: m });
    }
    return out.sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [matches]);

  if (isLoading && !matches.length) {
    return <div className="h-72 animate-pulse rounded-2xl bg-[#12151f]" />;
  }

  return (
    <div className="space-y-6">
      {data?.degraded && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Données partielles : dernier cache valide affiché.
        </p>
      )}

      {/* Table des marchés par match */}
      <Card className="overflow-hidden">
        <div className="border-b border-white/5 px-4 py-3">
          <h3 className="text-sm font-extrabold text-white">Marchés par match</h3>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Spread, total et score probable pour chaque fixture à venir.
          </p>
        </div>
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead>
                <tr className="border-b border-white/5 text-[11px] font-black uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-3 py-2.5">Match</th>
                  <th className="px-3 py-2.5">Spread</th>
                  <th className="px-3 py-2.5">Total</th>
                  <th className="px-3 py-2.5">Score probable</th>
                  <th className="px-4 py-2.5 text-right">Confiance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ row }) => {
                  const { match, prediction } = row;
                  const p = prediction!;
                  const expectedTotal = p.expectedHomeScore + p.expectedAwayScore;
                  const ou = [...p.overUnderLines].sort(
                    (a, b) =>
                      Math.abs(a.line - expectedTotal) - Math.abs(b.line - expectedTotal)
                  )[0];
                  const homePct = Math.round(p.handicap.homeCoverProb * 100);
                  const awayPct = Math.round(p.handicap.awayCoverProb * 100);
                  return (
                    <tr
                      key={match.id}
                      className="border-b border-white/4 last:border-0 hover:bg-white/2"
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-slate-400">
                        <span className="block font-semibold text-slate-300">{fmtDate(match.date)}</span>
                        <span className="text-[11px] text-slate-400">{fmtTime(match.date)}</span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <RugbyTeamLogo src={match.home.logo} name={match.home.name} size={20} />
                          <span className="max-w-[110px] truncate font-bold text-slate-100">
                            {match.home.name}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <RugbyTeamLogo src={match.away.logo} name={match.away.name} size={20} />
                          <span className="max-w-[110px] truncate font-bold text-slate-100">
                            {match.away.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex rounded-lg bg-[#0b0e14] px-2 py-1 font-bold tabular-nums text-slate-200 ring-1 ring-white/8">
                          Domicile {fmtHandicap(p.handicap.line)}
                        </span>
                        <span className="mt-1.5 block text-[11px] font-semibold tabular-nums text-slate-400">
                          Domicile {homePct}% · Extérieur {awayPct}%
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex rounded-lg bg-[#0b0e14] px-2 py-1 font-bold tabular-nums text-slate-200 ring-1 ring-white/8">
                          {ou ? ou.line.toFixed(1) : "—"}
                        </span>
                        <span className="mt-1.5 block text-[11px] font-semibold tabular-nums text-slate-400">
                          {ou ? `O ${pct(ou.over)} / U ${pct(ou.under)}` : "—"}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-bold tabular-nums text-teal-300">
                        {p.mostLikelyScore}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-[11px] font-black tabular-nums ring-1",
                            p.confidence >= 0.62
                              ? "bg-teal-500/10 text-teal-300 ring-teal-500/30"
                              : "bg-slate-500/10 text-slate-400 ring-white/8"
                          )}
                        >
                          {pct(p.confidence)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-4 py-8 text-center text-sm text-slate-400">
            Aucune fixture à venir — revenez bientôt.
          </p>
        )}
      </Card>

      {/* Backtest de la couverture du spread */}
      <BacktestPanel bt={bt} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Backtest spread                                                      */
/* ------------------------------------------------------------------ */

function BacktestPanel({ bt }: { bt: ReturnType<typeof useRugbyBacktest>["data"] }) {
  const total = bt?.stats.total;
  const bands = bt?.stats.bands ?? [];
  const collecting = !total || total.n === 0;

  return (
    <Card>
      <div className="border-b border-white/5 px-4 py-3">
        <h3 className="text-sm font-extrabold text-white">Couverture du spread — backtest</h3>
        <p className="mt-0.5 text-[11px] text-slate-400">
          Ligne enregistrée au moment de la prédiction, résultat réel ensuite. Push exclus (lignes 0.5).
        </p>
      </div>
      {collecting ? (
        <p className="px-4 py-6 text-sm text-slate-400">
          Collecte des données en cours : le backtest démarre à la première prédiction enregistrée,
          puis se règle quand le match est terminé. Revenez après quelques journées.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead>
              <tr className="border-b border-white/5 text-[11px] font-black uppercase tracking-wider text-slate-400">
                <th className="px-4 py-2.5">Probabilité domicile</th>
                <th className="px-3 py-2.5 text-right">Matchs réglés</th>
                <th className="px-3 py-2.5 text-right">Couverture domicile</th>
                <th className="px-4 py-2.5 text-right">Couverture extérieur</th>
              </tr>
            </thead>
            <tbody>
              {bands.map((b) => (
                <tr key={b.label} className="border-b border-white/4 last:border-0">
                  <td className="px-4 py-2.5 font-bold text-slate-200">{b.label}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-400">{b.n}</td>
                  <td className="px-3 py-2.5 text-right">
                    <CoverRate value={b.homeCoverRate} invert={b.label === "≥ 60 %"} />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <CoverRate value={b.awayCoverRate} invert={b.label === "< 40 %"} />
                  </td>
                </tr>
              ))}
              <tr className="bg-white/3">
                <td className="px-4 py-2.5 font-black text-white">Total</td>
                <td className="px-3 py-2.5 text-right font-bold tabular-nums text-white">
                  {total?.n}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <CoverRate value={total?.homeCoverRate ?? null} />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <CoverRate value={total?.awayCoverRate ?? null} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <p className="border-t border-white/5 px-4 py-2.5 text-[11px] leading-relaxed text-slate-600">
        Une couverture &gt; 52 % sur une bande suggère un spread à valeur (le marché paie ~50 %).
        {bt?.stats.slug
          ? " Statistiques limitées à la compétition sélectionnée."
          : ""}
      </p>
    </Card>
  );
}

function CoverRate({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value === null) return <span className="text-slate-600">—</span>;
  const good = invert ? value <= 0.52 : value >= 0.52;
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 font-black tabular-nums ring-1",
        good
          ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30"
          : "bg-slate-500/10 text-slate-400 ring-white/8"
      )}
    >
      {pct(value, 1)}
    </span>
  );
}