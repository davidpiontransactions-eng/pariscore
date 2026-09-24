// Moteur des marchés bonus handball (engineering loop G10) — zéro dépendance,
// 100 % dérivable de nos modèles existants (aucune source de données externe).
//
//   1. Résultat mi-temps (HT 1X2) : Skellam avec λ_MT = λ_match / 2 — 30 min =
//      demi-match, processus de Poisson homogène → tirages indépendants sur
//      intervalles disjoints. Hypothèses FR : buts des deux équipes
//      indépendants + homogénéité sur la durée (l'hypothèse « finish strong »
//      réelle est sacrifiée en moyenne, comme pour le 1X2 plein temps).
//   2. Écart de vainqueur (winning margin) : bandes 1-5 / 6-10 / 11+ lues sur
//      la Skellam pleine durée (mêmes λ que le handicap core) + issue nul
//      (P(diff = 0)) — les 7 issues couvrent exactement 100 %.
//   3. Race to X (10 / 15 / 20 buts) : course fermée entre deux processus de
//      Poisson — formule exacte dans raceToFirstProb (négative binomiale).
//
// λ : SOURCE UNIQUE = resolveLambdas exporté par handball-predictive-bets
// (même form-store, même prior neutre que les 3 paris core) — aucune 2e
// heuristique divergente.
//
// Garde-fous identiques au moteur core : jamais de throw, jamais de NaN,
// probs [0-100] à 1 décimale, odds/implied/edge/kelly = null tant que le
// snapshot ne fournit PAS la ligne COMPLÈTE du marché (jamais de cote
// inventée, jamais d'implied partiel → EV fabriquée).

import type { HandballMatch, HandballTeam } from "./handball-data";
import { skellamMatchProbs, skellamPmf } from "./handball-skellam";
import { buildFormStore } from "./handball-strategy-top8";
import { computeKellyStake } from "./kelly";
import {
  confidenceBand,
  pct1,
  resolveLambdas,
  validOdd,
  type HandballBetConfidence,
  type HandballFormStore,
} from "./handball-predictive-bets";

// ─── Types ───

export type BonusPick = {
  /** Libellé FR (ex : « Stuttgart mène à la mi-temps »). */
  label: string;
  /** Probabilité estimée [0-100], 1 décimale. */
  prob: number;
  /** Cote décimale, null si le marché n'est pas entièrement tarifé. */
  odds: number | null;
  /** Implicite dé-margé en %, null si odds absente. */
  impliedProb: number | null;
  /** Edge en points = prob − impliedProb, null si implied absent. */
  edge: number | null;
  /** Demi-Kelly en fraction de bankroll (cap 0.25 via computeKellyStake). */
  kelly: number | null;
  /** Bande de confiance (seuils identiques au moteur core). */
  confidence: HandballBetConfidence;
};

export type HandballBonusMarketsResult = {
  /** Résultat mi-temps — ordre : [home, nul, away] (3 issues). */
  htResult: BonusPick[];
  /** Écart de vainqueur — ordre : [home 1-5, home 6-10, home 11+, nul,
   *  away 1-5, away 6-10, away 11+] (7 issues, somme = 100). */
  margin: BonusPick[];
  /** Course à X — ordre : [home10, away10, home15, away15, home20, away20],
   *  chaque paire somme à 100. */
  raceTo: BonusPick[];
  /** Note de méthode FR (hypothèses + source des cotes). */
  note: string;
};

export type HandballBonusMarketsOpts = {
  /** Matchs terminés → form-store (ignoré si formStore fourni). */
  finished?: HandballMatch[];
  /** Form-store pré-construit (prioritaire — le dialog le mémoïse déjà). */
  formStore?: HandballFormStore;
};

// ─── Constantes ───

/** Cibles du marché « qui atteint X buts en premier ». */
export const RACE_TARGETS = [10, 15, 20] as const;

/** Clés d'une bande d'écart (champ openingOdds.winningMargin, G10). */
type MarginKey =
  | "home1_5"
  | "home6_10"
  | "home11"
  | "draw"
  | "away1_5"
  | "away6_10"
  | "away11";

// ─── Helpers ───

/** Nom affichable (shortName prioritaire) — miroir displayName du core. */
function teamName(t: HandballTeam): string {
  return t.shortName || t.name || "?";
}

/** Arrondi 4 décimales (fraction de Kelly). */
function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

/**
 * Devig proportionnel multi-issues : { odds, implied en % } indexés sur `keys`.
 * null si UN seul prix manque / est invalide → le marché n'est pas tarifé
 * complet, on n'affiche aucune cote (implied partiel = marge faussée).
 */
function devigMarket<T extends string>(
  rec: Partial<Record<T, number>> | undefined,
  keys: readonly T[],
): { odds: number[]; implied: number[] } | null {
  if (!rec) return null;
  const odds: number[] = [];
  for (const k of keys) {
    const v = validOdd(rec[k]);
    if (v == null) return null;
    odds.push(v);
  }
  let invSum = 0;
  for (const o of odds) invSum += 1 / o;
  if (!(invSum > 0) || !Number.isFinite(invSum)) return null;
  return { odds, implied: odds.map((o) => ((1 / o) / invSum) * 100) };
}

/** Construit un BonusPick : prob bornée, edge/kelly nulls si pas de cote. */
function bonusPick(
  label: string,
  probPct: number,
  odds: number | null,
  implied: number | null,
): BonusPick {
  const prob = pct1(probPct);
  const imp = implied != null ? pct1(implied) : null;
  return {
    label,
    prob,
    odds,
    impliedProb: imp,
    edge: imp != null ? pct1(prob - imp) : null,
    kelly: odds != null ? round4(computeKellyStake(prob, odds).pct / 100) : null,
    confidence: confidenceBand(prob),
  };
}

// ─── Formule race-to-X ───

/**
 * P(home atteint X buts avant away) — course fermée de deux Poisson.
 *
 * Formule exacte (« comptage mince ») : dans le processus combiné de taux
 * λh+λa, chaque but est marqué home avec p = λh/(λh+λa) ; home gagne la course
 * ssi, au moment où le X-ième but home tombe, away en a marqué j ≤ X−1. Ce
 * compteur j suit une négative binomiale NB(X, p) :
 *
 *   P(home gagne la course à X) = Σ_{j=0}^{X−1} C(X+j−1, j) · p^X · (1−p)^j
 *
 * Justification : exacte tant que les processus sont homogènes (l'hypothèse
 * qui sous-tend déjà notre Skellam), les deux côtés somment EXACTEMENT à 1
 * (pas de cas « ni l'un ni l'autre n'atteint X »), O(X) termes via la
 * récurrence t_j = t_{j−1}·(X+j−1)/j·(1−p) (pas de binomiales géantes).
 * Seule approximation : horizon 60' ignoré (les processus « continuent »
 * jusqu'à la décision) — double abandon ≈ 0,2 % à λ ≈ 29, X = 20, cas que
 * les bookmakers remboursent de toute façon.
 */
export function raceToFirstProb(lambdaH: number, lambdaA: number, target: number): number {
  const lh = Number.isFinite(lambdaH) ? Math.max(lambdaH, 1e-6) : 1e-6;
  const la = Number.isFinite(lambdaA) ? Math.max(lambdaA, 1e-6) : 1e-6;
  const p = lh / (lh + la);
  const q = 1 - p;
  const n = Math.max(1, Math.round(target));
  let term = Math.pow(p, n); // j = 0
  let sum = term;
  for (let j = 1; j < n; j++) {
    term *= ((n + j - 1) / j) * q;
    sum += term;
  }
  if (!Number.isFinite(sum)) return 0.5;
  return Math.max(0, Math.min(1, sum));
}

// ─── Note de méthode ───

function buildNote(hasForm: boolean, anyOdds: boolean): string {
  const head = hasForm
    ? "λ CMP sur forme (L10) —"
    : "λ prior neutre (forme indisponible) —";
  const method =
    "mi-temps Skellam (λ/2, Poisson indépendant), écart Skellam pleine durée, " +
    "course à X par négative binomiale (taux constants)";
  const tail = anyOdds
    ? "· cotes d'ouverture dévigées par marché."
    : "· probabilités modèle seules (snapshot sans cote bonus).";
  return `${head} ${method} ${tail}`;
}

// ─── Entry point ───

/**
 * Génère les 3 marchés bonus d'une rencontre handball :
 * HT result (3 issues) + winning margin (7 issues) + race to X (3×2 issues).
 * Ne throw jamais : odds absentes → model pur avec champs financiers null.
 */
export function computeHandballBonusMarkets(
  match: HandballMatch,
  opts: HandballBonusMarketsOpts = {},
): HandballBonusMarketsResult {
  const store =
    opts.formStore ??
    (opts.finished && opts.finished.length > 0 ? buildFormStore(opts.finished) : null);
  const { lambdas, hasForm } = resolveLambdas(match, store);
  const hn = teamName(match.home);
  const an = teamName(match.away);
  // Lignes bonus du snapshot (HandballOpeningOdds.htResult / winningMargin /
  // raceTo) : absentes → odds = null sur tout le marché (prob seule).
  const oo = match.openingOdds;
  let anyOdds = false;

  // ── 1) Résultat mi-temps : Skellam λ/2 (30 min, Poisson homogène) ──
  const ht = skellamMatchProbs(lambdas.lambdaH / 2, lambdas.lambdaE / 2);
  const htMkt = devigMarket(oo?.htResult, ["home", "draw", "away"] as const);
  if (htMkt) anyOdds = true;
  const htResult: BonusPick[] = [
    bonusPick(`${hn} mène à la mi-temps`, ht.home * 100, htMkt?.odds[0] ?? null, htMkt?.implied[0] ?? null),
    bonusPick("Égalité à la mi-temps", ht.draw * 100, htMkt?.odds[1] ?? null, htMkt?.implied[1] ?? null),
    bonusPick(`${an} mène à la mi-temps`, ht.away * 100, htMkt?.odds[2] ?? null, htMkt?.implied[2] ?? null),
  ];

  // ── 2) Écart de vainqueur : bandes Skellam pleine durée ──
  const { kMin, probs } = skellamPmf(lambdas.lambdaH, lambdas.lambdaE);
  const skellamBand = (from: number, to: number): number => {
    let s = 0;
    for (let i = 0; i < probs.length; i++) {
      const k = kMin + i;
      if (k >= from && k <= to) s += probs[i];
    }
    return s;
  };
  const marginSpec: { key: MarginKey; label: string; p: number }[] = [
    { key: "home1_5", label: `${hn} par 1-5 buts`, p: skellamBand(1, 5) },
    { key: "home6_10", label: `${hn} par 6-10 buts`, p: skellamBand(6, 10) },
    { key: "home11", label: `${hn} par 11+ buts`, p: skellamBand(11, Number.MAX_SAFE_INTEGER) },
    { key: "draw", label: "Match nul", p: skellamBand(0, 0) },
    { key: "away1_5", label: `${an} par 1-5 buts`, p: skellamBand(-5, -1) },
    { key: "away6_10", label: `${an} par 6-10 buts`, p: skellamBand(-10, -6) },
    { key: "away11", label: `${an} par 11+ buts`, p: skellamBand(Number.MIN_SAFE_INTEGER, -11) },
  ];
  const marginMkt = devigMarket(
    oo?.winningMargin,
    marginSpec.map((m) => m.key),
  );
  if (marginMkt) anyOdds = true;
  const margin: BonusPick[] = marginSpec.map((m, i) =>
    bonusPick(m.label, m.p * 100, marginMkt?.odds[i] ?? null, marginMkt?.implied[i] ?? null),
  );

  // ── 3) Race to X : négative binomiale (voir raceToFirstProb) ──
  // p.home + p.away = 1 exact (issue « aucun n'atteint X » hors modèle).
  const raceTo: BonusPick[] = [];
  for (const x of RACE_TARGETS) {
    const pHome = raceToFirstProb(lambdas.lambdaH, lambdas.lambdaE, x);
    const raceMkt = devigMarket(oo?.raceTo?.[String(x)], ["home", "away"] as const);
    if (raceMkt) anyOdds = true;
    raceTo.push(
      bonusPick(`${hn} atteint ${x} buts en premier`, pHome * 100, raceMkt?.odds[0] ?? null, raceMkt?.implied[0] ?? null),
      bonusPick(`${an} atteint ${x} buts en premier`, (1 - pHome) * 100, raceMkt?.odds[1] ?? null, raceMkt?.implied[1] ?? null),
    );
  }

  return { htResult, margin, raceTo, note: buildNote(hasForm, anyOdds) };
}
