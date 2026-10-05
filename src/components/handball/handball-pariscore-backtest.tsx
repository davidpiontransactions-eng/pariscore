"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { HandballTableCaption } from "./handball-table-caption";
import { HandballTeamLogo } from "./handball-team-logo";
import type {
  BacktestDayRow,
  BacktestSegment,
  BacktestSettledBet,
} from "@/lib/handball-backtest-pariscore";
import type { BacktestDbPayload } from "@/app/api/handball/backtest-db/route";

const fetchJson = <T,>(url: string): Promise<T> =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<T>;
  });

// ─── Helpers ───

function fmtSigned(v: number, digits = 1): string {
  const s = v.toFixed(digits);
  return v > 0 ? `+${s}` : s;
}

function fmtPct(v: number | null | undefined): string {
  return v == null ? "—" : `${v.toFixed(1)}%`;
}

function fmtU(v: number): string {
  return `${fmtSigned(v, 2)}u`;
}

/** Pastille verte / rouge selon le signe d'un profit. */
function SignPill({ value, suffix }: { value: number; suffix: string }) {
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

/**
 * Barres de progression par journée.
 *
 * Échelle commune = max(|profit cumulé|) : une journée gagnée sort en vert,
 * une journée perdue en rouge, et la longueur est directement comparable d'une
 * journée à l'autre. Sous 1 journée affichée, la piste reste visible pour ne
 * pas laisser croire à un graphique vide.
 */
function ProgressionBars({ rows }: { rows: BacktestDayRow[] }) {
  const max = useMemo(
    () => Math.max(1, ...rows.map((r) => Math.abs(r.cumulativeProfitU))),
    [rows],
  );
  if (rows.length === 0) return null;
  return (
    <div
      className="flex items-end gap-1 overflow-x-auto pt-2"
      role="img"
      aria-label={`Profit cumulé par journée, ${rows.length} journées`}
    >
      {rows.map((r) => {
        const pct = (Math.abs(r.cumulativeProfitU) / max) * 100;
        const up = r.cumulativeProfitU >= 0;
        return (
          <div key={r.date} className="flex w-9 shrink-0 flex-col items-center gap-1">
            <span
              className={`font-mono text-[9px] tabular-nums ${
                up ? "text-[#00e676]" : "text-red-500"
              }`}
            >
              {fmtSigned(r.cumulativeProfitU)}
            </span>
            <div
              title={`${r.date} · ${r.segment.nBets} paris · ${fmtU(r.segment.profitU)}`}
              className={`w-full rounded-t ${up ? "bg-[#00e676]" : "bg-red-500"}`}
              style={{ height: `${Math.max(4, pct * 0.9)}px` }}
            />
            <span className="text-[9px] tabular-nums text-[#717171]">
              {r.date.slice(5)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Ligne d'historique : score prédit vs réel, cote, statut, profit. */
function HistoryRow({ bet }: { bet: BacktestSettledBet }) {
  const mark =
    bet.result === "won" ? "✅" : bet.result === "lost" ? "❌" : "⏹";
  const tone =
    bet.result === "won"
      ? "text-emerald-500"
      : bet.result === "lost"
        ? "text-red-500"
        : "text-[#717171]";
  return (
    <tr
      className={`border-t border-[#f0f0f0] dark:border-white/5 ${
        bet.syntheticMatch ? "opacity-70" : ""
      }`}
    >
      <td className="whitespace-nowrap py-2 pr-2 text-[10px] tabular-nums text-[#717171]">
        {bet.date.slice(5)}
        {bet.syntheticMatch && (
          <span
            className="ml-1 rounded bg-amber-500/15 px-1 text-[9px] font-semibold text-amber-500"
            title="Match synthétique : absent de la source Vitibet"
          >
            syn.
          </span>
        )}
      </td>
      {/* Cellule « Match ».
          Le `truncate` seul ne suffit pas : sans largeur bornée sur le `td` ni
          `min-w-0` sur l'élément tronqué, la boîte ellipsis se calcule à ~0 px
          dans un tableau `overflow-x-auto` — le nom devient invisible et le
          2e logo part à droite. `w-full` fait réellement consommer la largeur
          du `td` au conteneur flex, `min-w-0 flex-1` donne à l'élément tronqué
          une base qu'il peut réduire, et les bornes `min/max` fixent la colonne. */}
      <td className="py-2 pr-2 align-middle min-w-[210px] max-w-[290px]">
        <span className="flex w-full min-w-0 items-center gap-1.5">
          <HandballTeamLogo name={bet.home} size={13} />
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-[#222222] dark:text-white">
            {bet.home} – {bet.away}
          </span>
          <HandballTeamLogo name={bet.away} size={13} />
        </span>
      </td>
      <td className="whitespace-nowrap py-2 pr-2 text-[10px] text-[#717171]">
        {bet.market === "1N2" ? "1N2" : "Total"}
      </td>
      <td className="py-2 pr-2 text-[11px]">
        <span className="rounded bg-[#fafafa] px-1.5 py-0.5 dark:bg-white/[0.06]">
          {bet.pick}
        </span>
      </td>
      <td className="py-2 pr-2 text-right font-mono text-[11px] tabular-nums text-[#717171]">
        {bet.prob.toFixed(1)}%
      </td>
      <td className="py-2 pr-2 text-right font-mono text-[11px] tabular-nums text-[#717171]">
        {bet.odds.toFixed(2)}
      </td>
      <td className="py-2 pr-2 text-right font-mono text-[11px] tabular-nums text-[#717171]">
        {bet.predictedHome}:{bet.predictedAway}
      </td>
      <td className="py-2 text-center" title={bet.result}>
        <span className={tone} aria-label={bet.result}>
          {mark}
        </span>
      </td>
      <td className={`py-2 text-right font-mono text-[11px] tabular-nums ${tone}`}>
        {fmtU(bet.profitU)}
      </td>
    </tr>
  );
}

function MarketRow({ label, seg }: { label: string; seg: BacktestSegment }) {
  return (
    <tr className="border-t border-[#f0f0f0] dark:border-white/5">
      <td className="py-1.5 pr-2 font-medium text-[#222222] dark:text-white">{label}</td>
      <td className="py-1.5 pr-2 text-right tabular-nums">{seg.nBets}</td>
      <td className="py-1.5 pr-2 text-right tabular-nums">
        {seg.nBets > 0 ? `${seg.won} / ${seg.lost}` : "—"}
      </td>
      <td className="py-1.5 pr-2 text-right tabular-nums">{fmtPct(seg.winrate)}</td>
      <td className="py-1.5 text-right">
        {seg.roiPct != null ? <SignPill value={seg.roiPct} suffix="%" /> : "—"}
      </td>
    </tr>
  );
}

// ─── Composant ───

/**
 * HandballPariscoreBacktest — backtesting d'une ligue, sur le moteur
 * `runPariscoreBacktest` (walk-forward strict, flat 1u), alimenté par
 * `handball_match_history` via `/api/handball/backtest-db`.
 *
 * Source : 2 saisons réelles des 9 ligues du registre, avec les cotes 1X2
 * BetExplorer. Avant, ce composant était figé sur un fixture JSON MOL Liga dont
 * 9 matchs sur 15 étaient synthétiques ; la MOL Liga est maintenant une ligue
 * parmi les 9 du sélecteur, avec 67 matchs réels et leurs cotes.
 *
 * Garde-fous de lisibilité conservés :
 *   • un match synthétique serait marqué `syn.` et sa ligne atténuée — le
 *     compteur `nSyntheticMatches` resterait affiché juste au-dessus des KPI
 *     s'il était non nul (il vaut 0 sur cette source, le garde-fou reste actif) ;
 *   • la `methodology` du moteur est affichée en pied de section. Elle décrit
 *     désormais la provenance RÉELLE des cotes (« cotes simulées » quand la ligue
 *     n'en a aucune), donc elle ne peut pas être contredite par l'affichage ;
 *   • `nFormMatches` est exposé : sans forme ajustée, les KPI mesurent le prior
 *     neutre, pas le modèle.
 */
export function HandballPariscoreBacktest() {
  const [market, setMarket] = useState<"all" | "1N2" | "total">("all");
  const [leagueId, setLeagueId] = useState<string>("");

  // 1er appel sans `league` : la route renvoie la liste des ligues pour que le
  // sélecteur ait de quoi s'afficher. Ensuite on demande le backtest de la
  // ligue choisie.
  const { data: index } = useSWR<BacktestDbPayload>("/api/handball/backtest-db", fetchJson, {
    dedupingInterval: 30 * 60_000,
    revalidateOnFocus: false,
  });
  const leagues = index?.leagues ?? [];

  // Repli sur la ligue la plus fournie tant que l'utilisateur n'a pas choisi —
  // sinon le sélecteur démarrerait sur « aucune » et l'écran serait vide.
  const activeId = leagueId || leagues[0]?.id || "";
  const { data, isLoading } = useSWR<BacktestDbPayload>(
    activeId ? `/api/handball/backtest-db?league=${encodeURIComponent(activeId)}` : null,
    fetchJson,
    { dedupingInterval: 30 * 60_000, revalidateOnFocus: false },
  );

  const bt = data?.result ?? null;
  const league = data?.league ?? null;

  const rows = useMemo(() => {
    if (!bt) return [];
    return market === "all" ? bt.bets : bt.bets.filter((b) => b.market === market);
  }, [bt, market]);
  // Les 20 plus récents : le tableau reste lisible sur mobile, et le reste est
  // résumé par les KPI + la courbe qui portent l'ensemble.
  const recent = useMemo(
    () =>
      [...rows]
        .sort((a, b) => b.date.localeCompare(a.date) || a.market.localeCompare(b.market))
        .slice(0, 20),
    [rows],
  );
  const syntheticShown = recent.filter((b) => b.syntheticMatch).length;

  // ── Sélecteur de ligue ──
  const selector = (
    <div className="flex flex-wrap items-center gap-2">
      <label
        htmlFor="handball-backtest-league"
        className="text-[11px] font-medium text-[#717171]"
      >
        Ligue
      </label>
      <select
        id="handball-backtest-league"
        value={activeId}
        onChange={(e) => setLeagueId(e.target.value)}
        disabled={leagues.length === 0}
        className="rounded-lg border border-[#f0f0f0] bg-white px-2 py-1 text-[12px] font-medium text-[#222222] dark:border-white/10 dark:bg-white/[0.06] dark:text-white"
      >
        {leagues.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name} — {l.n} matchs
            {l.withOdds > 0 ? ` (${l.withOdds} cotés)` : " (sans cote)"}
          </option>
        ))}
      </select>
    </div>
  );

  if (leagues.length === 0 && !isLoading) {
    return (
      <div className="space-y-2">
        {selector}
        <p className="py-6 text-center text-sm text-[#717171]">
          Historique handball indisponible — la table <code>handball_match_history</code>{" "}
          n&apos;a pas encore été alimentée (cron <code>pariscore-cron-handball-history</code>).
        </p>
      </div>
    );
  }

  if (!bt) {
    return (
      <div className="space-y-2">
        {selector}
        <p className="py-6 text-center text-sm text-[#717171]">
          {isLoading
            ? "Chargement du backtest…"
            : (data?.reason ?? "Backtest indisponible pour cette ligue.")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {selector}
      {/* ── Cartes KPI ── */}
      <section className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-[#222222] dark:text-white">
            📉 Backtesting {league?.name ?? activeId}
          </h3>
          <span className="text-[10px] text-[#717171]">
            {bt.nMatches} match(s) terminé(s)
            {league?.goalsPerMatch != null && ` · base ${league.goalsPerMatch.toFixed(1)} buts/match`}
            {league?.minDate != null && ` · ${league.minDate} → ${league.maxDate}`}
          </span>
        </div>

        {bt.nSyntheticMatches > 0 && (
          <p className="rounded-lg bg-amber-500/10 px-2 py-1.5 text-[11px] leading-snug text-amber-500">
            ⚠️ {bt.nSyntheticMatches} des {bt.nMatches} matchs sont SYNTHÉTIQUES (absents de
            la source). Les KPI ci-dessous sont un jeu d&apos;essai, pas une performance
            mesurée.
          </p>
        )}

        {bt.nFormMatches === 0 && (
          <p className="rounded-lg bg-amber-500/10 px-2 py-1.5 text-[11px] leading-snug text-amber-500">
            ⚠️ Aucun match n&apos;a été prédit avec une FORME AJUSTÉE (il faut 3 matchs
            antérieurs par équipe) : les KPI ci-dessous mesurent le prior neutre, pas la
            qualité du modèle sur cette ligue.
          </p>
        )}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile
            label="Taux de réussite"
            value={fmtPct(bt.global.winrate)}
            hint={`${bt.global.won} / ${bt.global.won + bt.global.lost} gagnés`}
          />
          <StatTile
            label="ROI"
            value={bt.global.roiPct != null ? `${fmtSigned(bt.global.roiPct)}%` : "—"}
            hint={`${fmtU(bt.global.profitU)} sur ${bt.global.stakedU}u`}
          />
          <StatTile
            label="Paris"
            value={String(bt.global.nBets)}
            hint={`${bt.global.lost} perdus · ${bt.global.voided} annulés`}
          />
          <StatTile
            label="Matchs"
            value={String(bt.nMatches)}
            hint={`${bt.bets.length} paris retenus (P ≥ ${bt.thresholds.minProbPct}%)`}
          />
        </div>
      </section>

      {/* ── Progression par journée ── */}
      <section className="space-y-1.5">
        <h4 className="text-sm font-semibold text-[#222222] dark:text-white">
          Performance par journée
        </h4>
        <ProgressionBars rows={bt.byDay} />
      </section>

      {/* ── Comparaison des marchés ── */}
      <section className="space-y-2">
        <h4 className="text-sm font-semibold text-[#222222] dark:text-white">
          Marché 1N2 vs Total de buts
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <HandballTableCaption>Taux de réussite et ROI par marché</HandballTableCaption>
            <thead>
              <tr className="border-b border-[#f0f0f0] text-left text-[#717171] dark:border-white/10">
                <th className="py-1.5 pr-2 font-medium">Marché</th>
                <th className="py-1.5 pr-2 text-right font-medium">Paris</th>
                <th className="py-1.5 pr-2 text-right font-medium">G / P</th>
                <th className="py-1.5 pr-2 text-right font-medium">Réussite</th>
                <th className="py-1.5 text-right font-medium">ROI</th>
              </tr>
            </thead>
            <tbody>
              <MarketRow label="1N2 (favori modèle)" seg={bt.byMarket["1N2"]} />
              <MarketRow label="Total (seuil optimal)" seg={bt.byMarket.total} />
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Historique détaillé ── */}
      <section className="space-y-2">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-[#222222] dark:text-white">
            🗂 Historique des pronostics
          </h4>
          <div
            className="flex gap-1"
            role="group"
            aria-label="Filtrer l'historique par marché"
          >
            {(
              [
                ["all", "Tous"],
                ["1N2", "1N2"],
                ["total", "Total"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={market === id}
                onClick={() => setMarket(id)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  market === id
                    ? "bg-[#0A2E5C] text-white"
                    : "bg-[#f0f0f0] text-[#717171] hover:bg-[#e6e6e6] dark:bg-white/10 dark:text-[#717171] dark:hover:bg-white/20"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </header>

        {recent.length === 0 ? (
          <p className="py-3 text-center text-sm text-[#717171]">
            Aucun pari ne passe le seuil de probabilité sur cet échantillon.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <HandballTableCaption>
                  Score prédit vs réel, cote engagée et profit — {recent.length} paris
                  {syntheticShown > 0 ? ` (dont ${syntheticShown} sur match synthétique)` : ""}
                </HandballTableCaption>
                <thead>
                  <tr className="border-b border-[#f0f0f0] text-left text-[#717171] dark:border-white/10">
                    <th className="py-1.5 pr-2 font-medium">Date</th>
                    {/* Mêmes contraintes de largeur que la cellule « Match » : sans elles,
                        c'est l'en-tête qui dimensionne la colonne et le `truncate`
                        se recomprime. `py-2` aligne la hauteur d'en-tête sur les
                        lignes (aération). */}
                    <th className="py-2 pr-2 font-medium min-w-[210px] max-w-[290px]">
                      Match
                    </th>
                    <th className="py-1.5 pr-2 font-medium">Marché</th>
                    <th className="py-1.5 pr-2 font-medium">Pari</th>
                    <th className="py-1.5 pr-2 text-right font-medium">Proba</th>
                    <th className="py-1.5 pr-2 text-right font-medium">Cote</th>
                    <th className="py-1.5 pr-2 text-right font-medium">Prédit</th>
                    <th className="py-1.5 text-center font-medium">Rés.</th>
                    <th className="py-1.5 text-right font-medium">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((b, i) => (
                    <HistoryRow key={`${b.matchId}-${b.market}-${i}`} bet={b} />
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] leading-snug text-[#717171]">{bt.methodology}</p>
          </>
        )}
      </section>
    </div>
  );
}
