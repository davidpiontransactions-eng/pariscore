"use client";

import type { PariscorePrediction, PariscoreWinrate } from "@/lib/handball-pariscore";
import {
  PARISCORE_MIN_ODDS,
  PARISCORE_MIN_PROB_PCT,
} from "@/lib/handball-pariscore";

// ─── Winrate 1N2 ───

/** Couleurs 1N2 : emerald (dom) / amber (nul) / sky (ext). */
const SIDE_COLOR = {
  home: { bar: "bg-emerald-500", text: "text-emerald-500" },
  draw: { bar: "bg-amber-500", text: "text-amber-500" },
  away: { bar: "bg-sky-500", text: "text-sky-500" },
} as const;

type Side = keyof PariscoreWinrate;

/**
 * Side gagnante 1N2, avec sa probabilité.
 * « Pari Favori » exige P ≥ 65 % ET cote ≥ 1.15 (règles projet).
 */
function favoriteSide(
  winrate: PariscoreWinrate,
  odds: { home?: number; draw?: number; away?: number } | undefined,
): { side: Side; pct: number; isBet: boolean } | null {
  const sides: Side[] = ["home", "draw", "away"];
  const top = sides.reduce((a, b) => (winrate[b] > winrate[a] ? b : a));
  const pct = winrate[top];
  if (pct < PARISCORE_MIN_PROB_PCT) return { side: top, pct, isBet: false };
  const odd = odds?.[top];
  return { side: top, pct, isBet: odd == null || odd >= PARISCORE_MIN_ODDS };
}

/** Barre tri-couleur + probabilités % + cotes. null si aucune cote disponible. */
function WinrateCard({
  winrate,
  odds,
  homeName,
  awayName,
  hasSignal = true,
}: {
  winrate: PariscoreWinrate;
  odds?: { home?: number; draw?: number; away?: number };
  homeName: string;
  awayName: string;
  /** false → aucun résultat en base : pas de probabilité à publier. */
  hasSignal?: boolean;
}) {
  const fav = hasSignal ? favoriteSide(winrate, odds) : null;
  const rows: Array<{ side: Side; label: string }> = [
    { side: "home", label: homeName },
    { side: "draw", label: "Nul" },
    { side: "away", label: awayName },
  ];

  return (
    <section className="space-y-2 rounded-xl border border-[#f0f0f0] bg-white p-3 dark:border-white/10 dark:bg-white/[0.04]">
      <header className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-[#717171]">
          Winrate 1N2
        </h4>
        {fav?.isBet && (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-500 ring-1 ring-emerald-500/30">
            Pari Favori
          </span>
        )}
      </header>

      {/* Barre tri-couleur : les 3 parts sont larges même à proba faible pour
          garder la proportion lisible (largeur = % mais plancher visuel). */}
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-[#f0f0f0] dark:bg-white/10">
        {rows.map(({ side }) => (
          <div
            key={side}
            className={`${SIDE_COLOR[side].bar} ${fav?.side === side ? "" : "opacity-70"}`}
            style={{ width: `${Math.max(winrate[side], 2)}%` }}
            title={`${side} ${winrate[side]}%`}
          />
        ))}
      </div>

      {!hasSignal ? (
        <p className="text-[11px] leading-snug text-[#717171]">
          Données insuffisantes — le 1N2 affiché serait la moyenne de la ligue,
          pas une probabilité de ce match.
        </p>
      ) : (
        <ul className="space-y-1">
          {rows.map(({ side, label }) => (
            <li key={side} className="flex items-center justify-between gap-2 text-xs">
              <span className="flex min-w-0 items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={`inline-block h-2 w-2 shrink-0 rounded-full ${SIDE_COLOR[side].bar}`}
                />
                <span className="truncate text-[#717171]" title={label}>
                  {label}
                </span>
              </span>
              <span className="shrink-0 tabular-nums">
                <span className={`font-bold ${SIDE_COLOR[side].text}`}>
                  {winrate[side].toFixed(1)}%
                </span>
                <span className="ml-2 text-[#717171]">
                  {odds?.[side] != null ? odds[side]!.toFixed(2) : "—"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ─── Total de buts ───

/** Carte « Total Over Goals » : seuil optimal du modèle, ou motif de refus. */
function TotalCard({ prediction }: { prediction: PariscorePrediction }) {
  const { total } = prediction;
  const noSignal = !prediction.hasSignal;
  return (
    <section className="space-y-2 rounded-xl border border-[#f0f0f0] bg-white p-3 dark:border-white/10 dark:bg-white/[0.04]">
      <header className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-[#717171]">
          Total Over Goals
        </h4>
        {total?.qualifies && (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-500 ring-1 ring-emerald-500/30">
            Pari
          </span>
        )}
      </header>

      {noSignal ? (
        <p className="text-[11px] leading-snug text-[#717171]">
          Données insuffisantes — aucun résultat en base pour ces deux équipes,
          donc aucune probabilité de total n&apos;est calculable.
        </p>
      ) : total ? (
        <>
          <p className="font-mono text-2xl font-black leading-none tabular-nums text-[#222222] dark:text-white">
            {total.side === "over" ? "Over" : "Under"} {total.line}
          </p>
          <dl className="grid grid-cols-3 gap-1 text-center text-[11px]">
            <div>
              <dt className="text-[#717171]">Proba</dt>
              <dd className="font-bold tabular-nums">{total.prob.toFixed(1)}%</dd>
            </div>
            <div>
              <dt className="text-[#717171]">Cote</dt>
              <dd className="font-bold tabular-nums">
                {total.odds != null ? total.odds.toFixed(2) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[#717171]">Attendu</dt>
              <dd className="font-bold tabular-nums">{prediction.expectedTotal}</dd>
            </div>
          </dl>
          {!total.qualifies && (
            <p className="text-[10px] leading-snug text-amber-500">
              Cote {total.odds?.toFixed(2) ?? "—"} &lt; {PARISCORE_MIN_ODDS} : pari non
              retenu malgré la probabilité.
            </p>
          )}
        </>
      ) : (
        <p className="text-[11px] leading-snug text-[#717171]">
          Aucune ligne n&apos;atteint {PARISCORE_MIN_PROB_PCT} % de probabilité sur cette
          rencontre — aucun pari de total proposé.
        </p>
      )}
    </section>
  );
}

/**
 * Cartes Prédiction IA — Winrate 1N2 + Total de buts.
 *
 * Alimentent le pop-up match ET les pastilles du Calendrier quand le tip
 * Vitibet manque : le modèle parle toujours (prior neutre s'il n'y a vraiment
 * aucune donnée, voir `PariscorePrediction.hasSignal`).
 *
 * ⚠️ Plus de `MatchCard3D` ici : le score prédit est déjà dans l'en-tête bleu
 * (`HandballScoreBanner`). L'afficher une troisième fois dans le même écran —
 * étiquette « Score prédit Pariscore (CMP + Skellam) », 28 - 28 — était
 * exactement la redondance signalée : sur mobile il fallait faire défiler
 * 200 px pour lire un chiffre déjà lu 6 lignes plus haut.
 */
export function HandballPredictionCards({
  prediction,
  odds,
  homeName,
  awayName,
}: {
  prediction: PariscorePrediction;
  odds?: { home?: number; draw?: number; away?: number };
  homeName: string;
  awayName: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <WinrateCard
        winrate={prediction.winrate}
        odds={odds}
        homeName={homeName}
        awayName={awayName}
        hasSignal={prediction.hasSignal}
      />
      <TotalCard prediction={prediction} />
    </div>
  );
}