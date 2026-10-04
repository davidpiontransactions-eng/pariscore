"use client";

import useSWR from "swr";
import { HandballTableCaption } from "./handball-table-caption";
import { HandballTeamLogo } from "./handball-team-logo";
import { HandballPariscoreBacktest } from "./handball-pariscore-backtest";
import { HandballSyncBadge } from "./handball-sync-badge";
import { useVitibetBacktest } from "@/hooks/use-vitibet-tips";
import type { HandballBacktestResult } from "@/lib/handball-backtest";
import type { DailyPick, DailyStrategyBacktest } from "@/lib/handball-backtest-today";

const fetchJson = <T,>(url: string): Promise<T> =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<T>;
  });

type TodayPayload = DailyStrategyBacktest & { source: "file" | "live" };

const fmtSigned = (v: number, digits = 1): string => {
  const s = v.toFixed(digits);
  return v > 0 ? `+${s}` : s;
};

/** Pastille verte / rouge selon le signe (ROI, profit). */
function SignPill({ value, suffix = "%" }: { value: number; suffix?: string }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 font-mono font-semibold tabular-nums ${
        value > 0 ? "bg-[#00e676]/15 text-[#00e676]" : "bg-red-500/15 text-red-500"
      }`}
    >
      {fmtSigned(value)}
      {suffix}
    </span>
  );
}

/** Tuile de synthèse (taux de réussite, ROI, volume). */
function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-[#f0f0f0] bg-white p-3 text-center dark:border-white/10 dark:bg-white/[0.04]">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#717171]">
        {label}
      </p>
      <p className="mt-1 font-mono text-xl font-black tabular-nums text-[#222222] dark:text-white">
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[10px] text-[#717171]">{hint}</p>}
    </div>
  );
}

function Loading({ what }: { what: string }) {
  return (
    <p className="py-6 text-center text-sm text-[#717171]" aria-live="polite">
      Chargement {what}…
    </p>
  );
}

function Unavailable({ what }: { what: string }) {
  return (
    <p className="py-6 text-center text-sm text-[#717171]">{what} indisponible.</p>
  );
}

/** Ligne d'un pick réglé : match, pick joué, résultat, profit. */
function PickRow({ pick }: { pick: DailyPick }) {
  const tone =
    pick.result === "won"
      ? "text-emerald-500"
      : pick.result === "lost"
        ? "text-red-500"
        : "text-[#717171]";
  const mark = pick.result === "won" ? "✅" : pick.result === "lost" ? "❌" : "⏹";
  return (
    <li className="flex items-center gap-2 border-t border-[#f0f0f0] py-1.5 first:border-t-0 dark:border-white/5">
      <span className="w-9 shrink-0 text-[10px] tabular-nums text-[#717171]">
        {pick.match.kickoff.slice(5, 10)}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <HandballTeamLogo name={pick.match.home} size={14} />
        <span className="truncate text-xs text-[#222222] dark:text-white">
          {pick.match.home} – {pick.match.away}
        </span>
        <HandballTeamLogo name={pick.match.away} size={14} />
      </span>
      <span className="shrink-0 font-mono text-xs tabular-nums text-[#717171]">
        {pick.match.score ?? "—"}
      </span>
      <span
        className="shrink-0 rounded bg-[#fafafa] px-1.5 py-0.5 text-[10px] font-semibold dark:bg-white/[0.06]"
        title={`${pick.pickLabel} @${pick.odds.toFixed(2)}`}
      >
        {pick.pickLabel}
      </span>
      <span className={`w-4 shrink-0 text-center text-xs ${tone}`} title={pick.result}>
        {mark}
      </span>
      <span className={`w-14 shrink-0 text-right font-mono text-xs tabular-nums ${tone}`}>
        {fmtSigned(pick.profitU, 2)}u
      </span>
    </li>
  );
}

/**
 * HandballBacktestingView — historique des prédictions passées, taux de
 * réussite des conseils TIP, ROI et résultats récents.
 *
 * Trois sources, toutes déjà en production (aucune requête nouvelle) :
 *   1. `/api/handball/backtest`      → walk-forward historique (ROI + stratégies)
 *   2. `/api/handball/backtest-today`→ picks réglés du jour (historique détaillé)
 *   3. `/api/v1/vitibet?backtest=1`  → taux de réussite des tips Vitibet
 */
export function HandballBacktestingView({ league = "all" }: { league?: string }) {
  const { data: hist, error: histError, isLoading: histLoading } = useSWR<HandballBacktestResult>(
    `/api/handball/backtest?league=${encodeURIComponent(league)}&mode=simulated`,
    fetchJson,
    { dedupingInterval: 10 * 60_000, revalidateOnFocus: false },
  );
  const { data: today, error: todayError, isLoading: todayLoading } = useSWR<TodayPayload>(
    "/api/handball/backtest-today",
    fetchJson,
    { dedupingInterval: 5 * 60_000, revalidateOnFocus: false },
  );
  const { backtest: vitibet } = useVitibetBacktest();

  // Picks réglés du jour, tous stratégies confondues, du plus récent au plus
  // ancien (capped : 20 lignes = hauteur d'onglet tenable sur mobile).
  const recentPicks = today
    ? today.strategies
        .flatMap((s) => s.picks)
        .sort((a, b) => b.match.kickoff.localeCompare(a.match.kickoff))
        .slice(0, 20)
    : [];

  const hitRate = hist?.global.hitRate != null ? hist.global.hitRate * 100 : null;
  const tipRate = vitibet ? vitibet.rate * 100 : null;
  // Fraîcheur de la source des résultats : les KPI ci-dessous valent autant que
  // le snapshot qui les alimente — le rappel doit être dans la même vue.
  const scrapedAt = today?.source === "file" ? (today.computed_at ?? null) : null;

  return (
    <div className="space-y-6">
      {/* Backtesting Pariscore dédié aux ligues couvertes par Vitibet
          (KPI + progression par journée + historique détaillé). Complet et
          synchrone — s'affiche avant les agrégats API, plus lents mais plus
          larges (multi-ligues). */}
      <section className="space-y-2">
        <HandballPariscoreBacktest />
      </section>

      {/* ── Synthèse (agrégat API, multi-ligues) ── */}
      <section className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-[#222222] dark:text-white">
            📉 Synthèse backtesting
          </h3>
          <HandballSyncBadge scrapedAt={scrapedAt} />
        </div>
        {histLoading ? (
          <Loading what="du backtest" />
        ) : histError || !hist ? (
          <Unavailable what="Backtest" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatTile
                label="Taux de réussite"
                value={hitRate != null ? `${hitRate.toFixed(1)}%` : "—"}
                hint={`${hist.global.wins} / ${hist.global.nBets} paris`}
              />
              <StatTile
                label="ROI"
                value={
                  hist.global.roiPct != null ? `${fmtSigned(hist.global.roiPct)}%` : "—"
                }
                hint={`${fmtSigned(hist.global.profitU, 2)}u`}
              />
              <StatTile
                label="Matchs"
                value={String(hist.nMatches)}
                hint={hist.league === "all" ? "toutes ligues" : hist.league}
              />
              <StatTile
                label="Tips TIP"
                value={tipRate != null ? `${tipRate.toFixed(1)}%` : "—"}
                hint={vitibet ? `${vitibet.hits} / ${vitibet.total} (Vitibet)` : "Vitibet"}
              />
            </div>
            <p className="text-[11px] leading-snug text-[#717171]">{hist.methodology}</p>
          </>
        )}
      </section>

      {/* ── ROI par stratégie (historique) ── */}
      {hist && hist.strategies.length > 0 && (
        <section className="space-y-2">
          <h4 className="text-sm font-semibold text-[#222222] dark:text-white">
            ROI par stratégie — backtest walk-forward
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <HandballTableCaption>
                ROI historique par stratégie — cotes simulées, hors cotes réelles
              </HandballTableCaption>
              <thead>
                <tr className="border-b border-[#f0f0f0] text-left text-[#717171] dark:border-white/10">
                  <th className="py-1.5 pr-2 font-medium">Stratégie</th>
                  <th className="py-1.5 pr-2 font-medium">Marché</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Paris</th>
                  <th className="py-1.5 pr-2 text-right font-medium">G / P</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Réussite</th>
                  <th className="py-1.5 text-right font-medium">ROI</th>
                </tr>
              </thead>
              <tbody>
                {hist.strategies.map((s) => (
                  <tr
                    key={s.key}
                    className="border-t border-[#f0f0f0]/70 dark:border-white/5"
                  >
                    <td className="whitespace-nowrap py-1.5 pr-2 font-medium text-[#222222] dark:text-white">
                      {s.emoji} {s.label}
                    </td>
                    <td className="whitespace-nowrap py-1.5 pr-2 text-[#717171]">{s.market}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{s.nBets}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">
                      {s.nBets > 0 ? `${s.wins} / ${s.nBets - s.wins}` : "—"}
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">
                      {s.hitRate != null ? `${(s.hitRate * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td className="py-1.5 text-right">
                      {s.roiPct != null ? <SignPill value={s.roiPct} /> : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hist.simulatedOdds && (
            <p className="text-[11px] font-medium text-amber-500">
              ⚠️ Cotes simulées (moyennes 1xbet) — ROI indicatif, pas un conseil de pari.
            </p>
          )}
        </section>
      )}

      {/* ── Tips Vitibet par type ── */}
      {vitibet && vitibet.total > 0 && (
        <section className="space-y-2">
          <h4 className="text-sm font-semibold text-[#222222] dark:text-white">
            Tips Vitibet par type de pronostic
          </h4>
          <div className="grid grid-cols-3 gap-2">
            {(["1", "X", "2"] as const).map((t) => {
              const seg = vitibet.byTip[t];
              return (
                <StatTile
                  key={t}
                  label={t === "1" ? "Domicile" : t === "X" ? "Nul" : "Extérieur"}
                  value={seg.total > 0 ? `${(seg.rate * 100).toFixed(0)}%` : "—"}
                  hint={`${seg.hits}/${seg.total}`}
                />
              );
            })}
          </div>
          <p className="text-[11px] text-[#717171]">
            Période : {vitibet.sampleDates[0] ?? "—"} → {vitibet.sampleDates.at(-1) ?? "—"} ·
            {vitibet.excludedNoTip} match(s) sans tip exclus du taux.
          </p>
        </section>
      )}

      {/* ── Historique des prédictions (picks réglés) ── */}
      <section className="space-y-2">
        <h4 className="text-sm font-semibold text-[#222222] dark:text-white">
          🗂 Historique des prédictions
        </h4>
        {todayLoading ? (
          <Loading what="de l'historique" />
        ) : todayError || !today ? (
          <Unavailable what="Historique" />
        ) : today.nFinishedToday === 0 ? (
          <p className="py-3 text-center text-sm text-[#717171]">
            Aucun match terminé aujourd&apos;hui — l&apos;historique se remplira à la fin de la
            journée.
          </p>
        ) : recentPicks.length === 0 ? (
          <p className="py-3 text-center text-sm text-[#717171]">
            Aucun pari réglé sur la journée.
          </p>
        ) : (
          <>
            <ul className="rounded-xl border border-[#f0f0f0] bg-white px-2 dark:border-white/10 dark:bg-white/[0.04]">
              {recentPicks.map((p) => (
                <PickRow
                  key={`${p.match.id}-${p.pickLabel}-${p.odds}`}
                  pick={p}
                />
              ))}
            </ul>
            <p className="text-[11px] text-[#717171]">
              {today.nFinishedToday} match(s) terminé(s) · {today.global.nBets} paris ·{" "}
              {today.global.won} gagnés · {today.global.lost} perdus ·{" "}
              {today.global.voids} annulés · ROI{" "}
              {today.global.roiPct != null ? `${fmtSigned(today.global.roiPct)}%` : "—"} · profit{" "}
              {fmtSigned(today.global.profitU, 2)}u
            </p>
          </>
        )}
      </section>
    </div>
  );
}