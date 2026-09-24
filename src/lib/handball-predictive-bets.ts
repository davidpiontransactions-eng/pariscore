// Moteur des 3 paris prédictifs handball (popup prématch) — engineering loop G3.
//
// Pour chaque rencontre, génère exactement 3 pronostics :
//   Niveau 1 — Vainqueur (1X2) : devig des cotes Flashscore, ajusté par la
//              forme (blend CMP/Skellam) quand le form-store est fourni.
//   Niveau 2 — Total buts : ligne standard handball (~54.5, ou ligne de marché
//              la plus proche : Over 55.5 / Under 62.5), proba via CMP.
//   Niveau 3 — Handicap : écart de buts via Skellam, côté favori −N (ex: -3.5).
//
// Chaque bet porte : prob [0-100], cote, implicite dé-margé, edge, EV, Kelly,
// confiance (haute/moyenne/basse) et source tracée :
//   "model"         → CMP/Skellam fitted sur forme réelle (fenêtre L10)
//   "cotes"         → devig du marché 1X2 (ajusté forme si dispo)
//   "form-fallback" → repli prior CMP neutre (forme indisponible)
//   "elo-fallback"  → non émis en handball (pas d'Elo ; parité UI seulement)
//
// Garde-fous : odds absentes → bets calculés en model pur, odds/implied/edge/
// ev/kelly à null. Jamais de throw, jamais de NaN, valeurs bornées.

import type { HandballMatch, HandballTeam } from "./handball-data";
import {
  CMP_MIN_HISTORY,
  CMP_NEUTRAL_LAMBDA,
  matchLambdas,
  overUnderProb,
  teamStrength,
  type CmpTeam,
} from "./handball-cmp";
import { handicapProb, skellamMatchProbs } from "./handball-skellam";
import { buildFormStore } from "./handball-strategy-top8";
import { computeKellyStake } from "./kelly";
import type { PredictiveBetLevel } from "./prediction/predictive-bets-engine";

// ─── Types ───

export type HandballPredictiveBetSource =
  | "model" // CMP/Skellam sur forme réelle
  | "cotes" // devig marché 1X2 Flashscore
  | "elo-fallback" // non émis (pas d'Elo handball ; parité PredictiveBetSource)
  | "form-fallback"; // repli prior CMP neutre (forme indisponible)

export type HandballBetConfidence = "haute" | "moyenne" | "basse";

/** Form store tel que produit par buildFormStore (handball-strategy-top8). */
export type HandballFormStore = ReturnType<typeof buildFormStore>;

/** Probs 1X2 en % (somme = 100). */
export type HandballProbs1x2 = { home: number; draw: number; away: number };

export type HandballPredictiveBet = {
  level: PredictiveBetLevel;
  /** Icône affichée dans la pill (🏆 🤾 🏟️). */
  icon: string;
  /** Label court FR (ex: "Stuttgart gagne", "Over 54.5 buts", "Stuttgart -3.5"). */
  label: string;
  /** Probabilité estimée [0-100], 1 décimale. */
  prob: number;
  /** Cote décimale bookmaker, null si marché absent. */
  odds: number | null;
  /** Implicite dé-margé de la cote en %, null si odds absente. */
  impliedProb: number | null;
  /** Edge en points = prob − impliedProb, null si implied absent. */
  edge: number | null;
  /** EV en fraction (0.05 = +5 %), null si odds absente. */
  ev: number | null;
  /** Demi-Kelly en fraction de bankroll (cap 0.25 géré par computeKellyStake). */
  kelly: number | null;
  /** Bande de confiance : haute ≥ 65 %, moyenne ≥ 55 %, basse sinon. */
  confidence: HandballBetConfidence;
  source: HandballPredictiveBetSource;
};

export type HandballPredictiveBetsResult = {
  /** Favori de la rencontre (shortName ou nom). */
  favoriteName: string;
  /** Probabilité du favori [0-100], 1 décimale. */
  favoriteProb: number;
  /** Confiance globale [30-95] (formule prédictive moteur générique). */
  confidence: number;
  /** Ligne handicap, négative côté favori (ex: -3.5). */
  handicapLine: number;
  /** Ligne totale buts utilisée (ex: 54.5). */
  totalLine: number;
  /** Les 3 paris, triés par edge décroissant (nulls à la fin). */
  bets: HandballPredictiveBet[];
  /** Méthode courte en FR (ex: "Devig cotes 1X2 + ajustement forme…"). */
  modelNote: string;
};

export type HandballPredictiveBetsOpts = {
  /** Matchs terminés pour construire le form-store ( ignoré si formStore fourni ). */
  finished?: HandballMatch[];
  /** Form-store pré-construit (prioritaire sur finished). */
  formStore?: HandballFormStore;
  /** Ligne totale forcée (défaut : 54.5, ou ligne de marché la plus proche). */
  totalLine?: number;
  /** Ligne handicap forcée côté favori en valeur absolue (défaut 3.5, ou 4.5 si marché). */
  handicapLine?: number;
};

// ─── Constantes ───

/** Ligne totale standard handball par défaut. */
const DEFAULT_TOTAL_LINE = 54.5;
/** Lignes des marchés d'ouverture du snapshot (HandballOpeningOdds). */
const MARKET_OVER55_LINE = 55.5;
const MARKET_UNDER62_LINE = 62.5;
/** Handicap par défaut (mission : ex. ±3.5). */
const DEFAULT_HANDICAP_LINE = 3.5;
/** Ligne du marché d'ouverture handicap (1xBet : favori -4.5). */
const MARKET_HANDICAP_LINE = 4.5;
/** Poids de la forme dans le blend winner : devig 60 % / modèle 40 %. */
const FORM_BLEND = 0.4;
/** Avantage domicile en buts (Pollard & Gómez, miroir HOME_ADV strategy-top8). */
const HOME_ADV = 1.8;
/** Cote minimale valide (sous 1.01, marché jugé invalide). */
const MIN_VALID_ODDS = 1.01;
/** Marge bookmaker max réutilisée depuis le 1X2 pour les marchés 2-way. */
const MAX_MARKET_MARGIN = 0.15;

// ─── Helpers ───

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Arrondi 1 décimale. */
function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

/** Prob % bornée [0-100], 1 décimale — NaN → 0 (jamais de NaN exposé).
 *  Exportée : partagée avec handball-bonus-markets (mêmes bornes, G10). */
export function pct1(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return round1(clamp(v, 0, 100));
}

/** Cote valide : finie et > 1.01, sinon null.
 *  Exportée : partagée avec handball-bonus-markets (G10). */
export function validOdd(n: number | null | undefined): number | null {
  return n != null && Number.isFinite(n) && n > MIN_VALID_ODDS ? n : null;
}

/** Ligne forcée valide (finie, > 0), sinon null. */
function validLine(n: number | undefined): number | null {
  return n != null && Number.isFinite(n) && n > 0 ? n : null;
}

/** Nom affichable d'une équipe (shortName prioritaire). */
function displayName(t: HandballTeam): string {
  return t.shortName || t.name || "?";
}

/** Bande de confiance d'un bet depuis sa proba [0-100].
 *  Exportée : seuils identiques partagés avec handball-bonus-markets (G10). */
export function confidenceBand(prob: number): HandballBetConfidence {
  if (prob >= 65) return "haute";
  if (prob >= 55) return "moyenne";
  return "basse";
}

/** Cotes 1X2 résolues : odds courants, repli openingOdds.fav1x2 par outcome. */
type Odds1x2Resolved = { home: number; draw: number | null; away: number };

function resolve1x2Odds(match: HandballMatch): Odds1x2Resolved | null {
  const home = validOdd(match.odds?.home) ?? validOdd(match.openingOdds?.fav1x2?.home);
  const away = validOdd(match.odds?.away) ?? validOdd(match.openingOdds?.fav1x2?.away);
  if (home == null || away == null) return null;
  const draw = validOdd(match.odds?.draw) ?? validOdd(match.openingOdds?.fav1x2?.draw);
  return { home, draw, away };
}

/** Overround (somme des implicites bruts) d'un 1X2 résolu. */
function overroundOf(o: Odds1x2Resolved): number {
  return 1 / o.home + 1 / o.away + (o.draw != null ? 1 / o.draw : 0);
}

/**
 * Devig proportionnel des cotes 1X2 en % (somme = 100).
 * Retourne null si home/away absents ou invalides (bug snapshot odds=[]).
 */
export function devigHandball1x2(o: {
  home?: number | null;
  draw?: number | null;
  away?: number | null;
}): HandballProbs1x2 | null {
  const home = validOdd(o.home);
  const away = validOdd(o.away);
  if (home == null || away == null) return null;
  const draw = validOdd(o.draw);
  const invH = 1 / home;
  const invA = 1 / away;
  const invD = draw != null ? 1 / draw : 0;
  const sum = invH + invA + invD;
  if (!(sum > 0) || !Number.isFinite(sum)) return null;
  return { home: (invH / sum) * 100, draw: (invD / sum) * 100, away: (invA / sum) * 100 };
}

/**
 * Implicite d'un marché 2-way unique : la marge du 1X2 est retirée quand on
 * la connaît ; sinon implicite brut (pas d'autre côté à dé-viguer).
 */
function impliedSingleMarket(odds: number, overround: number | null): number | null {
  const raw = 1 / odds;
  if (!Number.isFinite(raw) || raw <= 0) return null;
  const margin =
    overround != null && Number.isFinite(overround)
      ? clamp(overround - 1, 0, MAX_MARKET_MARGIN)
      : 0;
  return pct1((raw / (1 + margin)) * 100);
}

type Lambdas = ReturnType<typeof matchLambdas>;

/** Fits CMP d'une équipe depuis le form-store, null si historique insuffisant. */
function cmpTeamOf(store: HandballFormStore | null, teamId: number): CmpTeam | null {
  if (!store) return null;
  const f = store.get(String(teamId));
  if (!f || f.gf.length < CMP_MIN_HISTORY) return null;
  return teamStrength(f.gf, f.ga);
}

/**
 * λh/λe du match : forces CMP attaque/défense si forme dispo (L10),
 * sinon prior neutre avec avantage domicile.
 * Exportée : source UNIQUE de λ pour les marchés bonus (handball-bonus-markets,
 * G10) — évite une 2e heuristique divergente.
 */
export function resolveLambdas(
  match: HandballMatch,
  store: HandballFormStore | null,
): { lambdas: Lambdas; hasForm: boolean } {
  const home = cmpTeamOf(store, match.home.id);
  const away = cmpTeamOf(store, match.away.id);
  if (home && away) return { lambdas: matchLambdas(home, away), hasForm: true };
  return {
    lambdas: {
      // Prior neutre en Poisson (ν = 1) : λ = moyenne directe. Un ν > 1 ici
      // serait faux car nos λs neutres sont des moyennes, pas des paramètres
      // CMP (seul fitCMP les convertit via E_θ[X] = mean observé).
      lambdaH: CMP_NEUTRAL_LAMBDA + HOME_ADV / 2,
      lambdaE: CMP_NEUTRAL_LAMBDA - HOME_ADV / 4,
      nuH: 1,
      nuE: 1,
    },
    hasForm: false,
  };
}

// ─── Niveau 1 : Vainqueur (1X2) ───

type WinnerCtx = {
  bet: HandballPredictiveBet;
  favSide: "home" | "away";
  favName: string;
  /** Prob arrondie du favori (cohérente avec bet.prob). */
  prob: number;
  hasForm: boolean;
};

function winnerBet(
  match: HandballMatch,
  o1x2: Odds1x2Resolved | null,
  lambdas: Lambdas,
  hasForm: boolean,
): WinnerCtx {
  const devig = o1x2 ? devigHandball1x2(o1x2) : null;
  const model = skellamMatchProbs(lambdas.lambdaH, lambdas.lambdaE);
  const modelPct: HandballProbs1x2 = {
    home: model.home * 100,
    draw: model.draw * 100,
    away: model.away * 100,
  };

  let probs: HandballProbs1x2;
  let source: HandballPredictiveBetSource;
  if (devig && hasForm) {
    // Ajustement forme : blend devig (60 %) ← → modèle CMP/Skellam (40 %).
    probs = {
      home: (1 - FORM_BLEND) * devig.home + FORM_BLEND * modelPct.home,
      draw: (1 - FORM_BLEND) * devig.draw + FORM_BLEND * modelPct.draw,
      away: (1 - FORM_BLEND) * devig.away + FORM_BLEND * modelPct.away,
    };
    source = "cotes";
  } else if (devig) {
    probs = devig;
    source = "cotes";
  } else if (hasForm) {
    probs = modelPct;
    source = "model";
  } else {
    probs = modelPct;
    source = "form-fallback";
  }

  const favSide: "home" | "away" = probs.home >= probs.away ? "home" : "away";
  const team = favSide === "home" ? match.home : match.away;
  const favName = displayName(team);
  const prob = pct1(probs[favSide]);
  const odds = o1x2 ? (favSide === "home" ? o1x2.home : o1x2.away) : null;
  const implied = devig ? pct1(devig[favSide]) : null;

  const bet: HandballPredictiveBet = {
    level: "winner",
    icon: "🏆",
    label: `${favName} gagne`,
    prob,
    odds,
    impliedProb: implied,
    edge: implied != null ? round1(prob - implied) : null,
    ev: odds != null ? round3((prob / 100) * odds - 1) : null,
    kelly: odds != null ? round4(computeKellyStake(prob, odds).pct / 100) : null,
    confidence: confidenceBand(prob),
    source,
  };
  return { bet, favSide, favName, prob, hasForm };
}

// ─── Niveau 2 : Total buts (Over/Under) ───

/**
 * Ligne totale : override opts, sinon ligne de marché la plus proche de 54.5
 * (Over 55.5 > Under 62.5 > défaut 54.5).
 */
function resolveTotalLine(match: HandballMatch, opts: HandballPredictiveBetsOpts): number {
  const forced = validLine(opts.totalLine);
  if (forced != null) return forced;
  const opening = match.openingOdds;
  if (validOdd(opening?.over55) != null) return MARKET_OVER55_LINE;
  if (validOdd(opening?.under62) != null) return MARKET_UNDER62_LINE;
  return DEFAULT_TOTAL_LINE;
}

function totalBet(
  match: HandballMatch,
  overround: number | null,
  lambdas: Lambdas,
  hasForm: boolean,
  opts: HandballPredictiveBetsOpts,
): { bet: HandballPredictiveBet; line: number } {
  const line = resolveTotalLine(match, opts);
  const { over, under } = overUnderProb(
    lambdas.lambdaH,
    lambdas.nuH,
    lambdas.lambdaE,
    lambdas.nuE,
    line,
  );
  const isOver = over >= 0.5;
  const prob = pct1((isOver ? over : under) * 100);

  // Cote uniquement si le côté joué correspond au marché stocké (jamais de
  // prix d'un autre côté/autre ligne : EV fabriquée — bug corrigé strategy-top8).
  const opening = match.openingOdds;
  let odds: number | null = null;
  if (isOver && line === MARKET_OVER55_LINE) odds = validOdd(opening?.over55);
  else if (!isOver && line === MARKET_UNDER62_LINE) odds = validOdd(opening?.under62);
  const implied = odds != null ? impliedSingleMarket(odds, overround) : null;

  const bet: HandballPredictiveBet = {
    level: "total",
    icon: "🤾",
    label: `${isOver ? "Over" : "Under"} ${line} buts`,
    prob,
    odds,
    impliedProb: implied,
    edge: implied != null ? round1(prob - implied) : null,
    ev: odds != null ? round3((prob / 100) * odds - 1) : null,
    kelly: odds != null ? round4(computeKellyStake(prob, odds).pct / 100) : null,
    confidence: confidenceBand(prob),
    source: hasForm ? "model" : "form-fallback",
  };
  return { bet, line };
}

// ─── Niveau 3 : Handicap ───

/**
 * Ligne handicap (valeur absolue) : override opts — lignes en .5 SEULEMENT
 * (une ligne entière autoriserait un push alors que prob = couverture la
 * suppose impossible) — sinon 4.5 si le marché « favori -4.5 » est présent,
 * sinon 3.5.
 */
function resolveHandicapLine(match: HandballMatch, opts: HandballPredictiveBetsOpts): number {
  const forced = validLine(opts.handicapLine);
  // Fix review G6-6 : ligne entière forcée → ignorée, on retombe sur la
  // résolution standard (marché 4.5, sinon défaut 3.5).
  if (forced != null && forced % 1 === 0.5) return forced;
  if (validOdd(match.openingOdds?.handicap) != null) return MARKET_HANDICAP_LINE;
  return DEFAULT_HANDICAP_LINE;
}

function handicapBet(
  match: HandballMatch,
  overround: number | null,
  lambdas: Lambdas,
  hasForm: boolean,
  favSide: "home" | "away",
  opts: HandballPredictiveBetsOpts,
): { bet: HandballPredictiveBet; line: number } {
  const line = resolveHandicapLine(match, opts);
  const hc = handicapProb(lambdas.lambdaH, lambdas.lambdaE, line);
  // Le favori couvre s'il gagne avec > line d'écart (lignes en .5 → pas de push).
  const favCover = favSide === "home" ? hc.home : hc.away;
  const fav = favSide === "home" ? match.home : match.away;
  const prob = pct1(favCover * 100);

  // Fix review G6-5 : le bet porte le côté FAVORI −N, le même que le marché
  // stocké `openingOdds.handicap` (« favori -4.5 ») → cote branchable, mais
  // uniquement à la ligne du marché (même pattern que le bet total) : toute
  // autre ligne serait un side/line mismatch → EV fabriquée.
  const odds = line === MARKET_HANDICAP_LINE ? validOdd(match.openingOdds?.handicap) : null;
  const implied = odds != null ? impliedSingleMarket(odds, overround) : null;

  const bet: HandballPredictiveBet = {
    level: "handicap",
    icon: "🏟️",
    label: `${displayName(fav)} -${line}`,
    prob,
    odds,
    impliedProb: implied,
    edge: implied != null ? round1(prob - implied) : null,
    ev: odds != null ? round3((prob / 100) * odds - 1) : null,
    kelly: odds != null ? round4(computeKellyStake(prob, odds).pct / 100) : null,
    confidence: confidenceBand(prob),
    source: hasForm ? "model" : "form-fallback",
  };
  return { bet, line };
}

// ─── Note de méthode ───

function buildModelNote(source: HandballPredictiveBetSource, hasForm: boolean): string {
  let head: string;
  if (source === "cotes") {
    head = hasForm
      ? "Devig cotes 1X2 + ajustement forme (CMP/Skellam L10)"
      : "Devig cotes 1X2";
  } else if (source === "model") {
    head = "CMP/Skellam sur forme (L10)";
  } else {
    head = "CMP prior neutre (forme indisponible)";
  }
  return `${head} — totaux CMP, handicap Skellam`;
}

// ─── Entry point ───

/**
 * Génère les 3 paris prédictifs d'une rencontre handball.
 * Toujours 3 bets (winner / total / handicap), triés par edge décroissant.
 * Ne throw jamais : odds absentes → model pur avec champs financiers null.
 */
export function computeHandballPredictiveBets(
  match: HandballMatch,
  opts: HandballPredictiveBetsOpts = {},
): HandballPredictiveBetsResult {
  const store =
    opts.formStore ?? (opts.finished && opts.finished.length > 0 ? buildFormStore(opts.finished) : null);
  const { lambdas, hasForm } = resolveLambdas(match, store);

  const o1x2 = resolve1x2Odds(match);
  const overround = o1x2 ? overroundOf(o1x2) : null;

  const winner = winnerBet(match, o1x2, lambdas, hasForm);
  const total = totalBet(match, overround, lambdas, hasForm, opts);
  const handicap = handicapBet(match, overround, lambdas, hasForm, winner.favSide, opts);

  const bets = [winner.bet, total.bet, handicap.bet];
  // Tri par edge décroissant, nulls à la fin (sort stable : ordre
  // winner → total → handicap préservé à edges égaux).
  bets.sort((a, b) => (b.edge ?? Number.NEGATIVE_INFINITY) - (a.edge ?? Number.NEGATIVE_INFINITY));

  // Confiance globale : formule du moteur générique (predictive-bets-engine).
  const confidence = Math.round(clamp((winner.prob - 50) * 1.4 + 40, 30, 95));

  return {
    favoriteName: winner.favName,
    favoriteProb: winner.prob,
    confidence,
    handicapLine: -handicap.line,
    totalLine: total.line,
    bets,
    modelNote: buildModelNote(winner.bet.source, hasForm),
  };
}
