// Métriques Pariscore handball — Index, Forme Calculée, Team Power.
//
// Ces trois métriques n'existent pas chez Vitibet (qui publie un INDEX signé
// global + des probabilités 1/X/2). On les décompose ici pour que le popup
// Calendrier ait des pastilles même quand le tip Vitibet est absent (match hors
// fenêtre J→J+3, ligue non modélisée, scrape cron en retard).
//
// Le SCORE PRÉDIT, lui, ne réinvente rien : il passe par les moteurs déjà en
// production (CMP handball-cmp.ts + Skellam handball-skellam.ts), donc cohérent
// avec les 3 paris prédictifs du popup et avec le backtest.

import {
  CMP_MIN_HISTORY,
  CMP_NEUTRAL_LAMBDA,
  cmpLambdaForMean,
  cmpMean,
  matchLambdas,
  overUnderProb,
  teamStrength,
  type CmpTeam,
} from "./handball-cmp";
import { matchLambdasFromSeries } from "./handball-history-stats";
import { skellamMatchProbs } from "./handball-skellam";
import { buildFormStore, type HandballFormStore } from "./handball-strategy-top8";
import type { HandballMatch } from "./handball-data";

// ─── Tunables ───

/** Fenêtre d'historique des 3 métriques (alignée sur CMP_HISTORY_WINDOW). */
export const PARISCORE_WINDOW = 10;
/** Décroissance de poids par match (dernier = 1, avant = 0.82…). */
const FORM_DECAY = 0.82;
/** Amplitude du bonus d'écart de buts : tanh(|écart| / 8) ∈ [0, 1[ — spec Danoises. */
const MARGIN_SCALE = 8;
/** Crédit d'une victoire à l'EXTÉRIEUR, rapporté à une victoire à domicile. */
const AWAY_CREDIT = 0.92;
/**
 * Avantage du terrain en points d'Index (spec mission Danoises : **+1.2**).
 * L'échelle de l'Index reste comparable à Vitibet (±45) : la contribution
 * différentielle (forme + power) domine, le terrain est un tie-breaker.
 */
export const HOME_ADVANTAGE_INDEX = 1.2;
/** Seuil de probabilité pour|●|un pari retenu (règle projet). */
export const PARISCORE_MIN_PROB_PCT = 65;
/**
 * Plafond de probabilité. Au-dessus, la ligne est dégénérée : à 75 buts
 * attendus (λ 45 + 30) la distribution CMP est si serrée qu'« Under 75.0 »
 * ressort à 100 % — mathématiquement vrai, mais invendable et sans valeur
 * (aucun bookmaker ne cote une ligne aussi extrême à 1.15+). On refuse donc de
 * publier une quasi-certitude plutôt que de la faire passer pour un pari.
 */
export const PARISCORE_MAX_PROB_PCT = 95;
/** Seuil de cote minimale pour valider un pari (règle projet). */
export const PARISCORE_MIN_ODDS = 1.15;
/** Demi-pas de scan des lignes de total (handball : lignes en .5). */
const LINE_STEP = 0.5;
/** Étendue du scan de lignes autour du total attendu (± en buts). */
const LINE_SCAN_HALF_WIDTH = 12;

// ─── Types ───

/** Séquence de forme brute des N derniers : "W"/"D"/"L" (W=victoire). */
export type PariscoreFormSeq = string;

export type PariscoreTeamMetrics = {
  /** Nom équipe (pour l'affichage du tableau). */
  name: string;
  /** Forme Calculée 0..100 (points/match pondérés, normalisés). */
  formPct: number;
  /** Team Power 0..100 (attaque + défense vs référence league). */
  power: number;
  /** Matchs réellement pris dans la fenêtre. */
  played: number;
  /** Buts marqués / match sur la fenêtre. */
  scoredAvg: number;
  /** Buts encaissés / match sur la fenêtre. */
  concededAvg: number;
  /** Séquence W/D/L brute (affichage converti V/N/D côté UI). */
  seq: PariscoreFormSeq;
};

export type PariscoreWinrate = { home: number; draw: number; away: number };

export type PariscoreTotalPick = {
  /** Ligne retenue (demi-valeur). */
  line: number;
  side: "over" | "under";
  /** Probabilité du côté retenu, 0..100. */
  prob: number;
  /** Cote du marché si la ligne correspond à une cote connue, sinon null. */
  odds: number | null;
  /**
   * Passe les règles projet (P ≥ 65 % ET, si cote disponible, cote ≥ 1.15).
   * false → affiché sans badge « Pari ».
   */
  qualifies: boolean;
};

export type PariscorePrediction = {
  /** Index Pariscore signé : > 0 = avantage domicile. Échelle ≈ ±45 (Vitibet). */
  index: number;
  home: PariscoreTeamMetrics | null;
  away: PariscoreTeamMetrics | null;
  /** Score prédit (arrondi entier) domicile / extérieur. */
  scoreHome: number;
  scoreAway: number;
  /** Winrate 1N2 en % (somme = 100). */
  winrate: PariscoreWinrate;
  /** Total moyen attendu (λh + λe), 1 décimale. */
  expectedTotal: number;
  /** Seuil Over/Under optimal, null si aucun seuil ne passe le seuil de proba. */
  total: PariscoreTotalPick | null;
  /** true si l'historique des 2 équipes est suffisant (≥ CMP_MIN_HISTORY). */
  hasForm: boolean;
  /**
   * true si au moins une équipe a au moins 1 résultat exploitable — donc si
   * les λs portent un signal. `false` ⇒ l'UI affiche un état NEUTRE
   * (« — : — », « Données insuffisantes ») au lieu de publier un 1N2 qui
   * serait la moyenne de ligue déguisée en prédiction.
   */
  hasSignal: boolean;
  /** Note de méthode affichée sous les métriques (traçabilité du calcul). */
  note: string;
};

// ─── Helpers ───

const LN2 = Math.log(2);

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

/** Poids de récence normalisé (dernier match = poids max). */
function recencyWeights(n: number): number[] {
  const w = new Array<number>(n);
  for (let i = 0; i < n; i++) w[i] = Math.pow(FORM_DECAY, n - 1 - i);
  return w;
}

/** Points officially : victoire 2, nul 1, défaite 0 (convention projet). */
function pointsOf(gf: number, ga: number): number {
  return gf > ga ? 2 : gf === ga ? 1 : 0;
}

// ─── Métriques d'équipe ───

/**
 * Forme Calculée (%) : points/match pondérés par la récence, ramenés sur 0..100.
 * Une équipe sans historique renvoie null (jamais de 0 inventé : « — » à l'UI).
 *
 * Variante simple (récence seule) — signature `computeFormPct`.
 */
export function computeFormPct(gf: number[], ga: number[]): number | null {
  const n = Math.min(gf.length, ga.length, PARISCORE_WINDOW);
  if (n === 0) return null;
  const w = recencyWeights(n);
  let pts = 0;
  let wSum = 0;
  for (let i = 0; i < n; i++) {
    wSum += w[i];
    pts += w[i] * pointsOf(gf[gf.length - n + i], ga[ga.length - n + i]);
  }
  if (wSum <= 0) return null;
  return round1(clamp((pts / (2 * wSum)) * 100, 0, 100));
}

/** Crédits au-delà duquel l'amplitude sature : 8 buts d'écart = 1 point plein. */
const MARGIN_FULL = 8;

/**
 * Forme Calculée (%) pondérée — **récence + lieu + écart de buts**
 * (spec mission Danoises, §2.B).
 *
 * Crédit d'un match, borné dans [0, 2] :
 *   - victoire d'écart Δ = gf − ga > 0 : `1 + min(1, Δ / 8)` → 1.125 pour une
 *     victoire d'un but, 2.0 à partir de 8 buts d'écart ;
 *   - nul : 1 ;
 *   - défaite d'écart Δ < 0 : `1 − min(1, −Δ / 8)` → 0.875 pour une défaite
 *     d'un but (un point de consolation : « battu de peu » n'est pas « écarté »),
 *     0.0 à partir de 8 buts. La symétrie avec la victoire est volontaire :
 *     100 % = « tous les points possibles » ;
 *   - le crédit est multiplié par la récence (0.82^(n−1−i), le dernier match pèse
 *     le plus) et par le lieu (1.0 à domicile, `AWAY_CREDIT` à l'extérieur).
 *
 * Normalisation par `2 · Σ(récence)` — le dénominateur ne dépend PAS du lieu,
 * c'est ce qui laisse la pénalité de terrain survivre à la normalisation :
 *   • série parfaite à domicile (écart ≥ 8) = 100 % ;
 *   • la même série à l'extérieur = 92 % (AWAY_CREDIT) ;
 *   • série mixte (2 dom. + 1 ext., tous ≥ 8 d'écart) ≈ 96.8 %.
 *
 * `atHome` vient du form-store (`TeamForm.atHome`). Tableau vide ou plus court
 * que gf/ga → lieu neutre (pas de pondération terrain), jamais d'erreur.
 */
export function computeFormPctWeighted(
  gf: number[],
  ga: number[],
  atHome?: boolean[],
): number | null {
  const n = Math.min(gf.length, ga.length, PARISCORE_WINDOW);
  if (n === 0) return null;
  const w = recencyWeights(n);
  let credits = 0;
  let wSum = 0;
  for (let i = 0; i < n; i++) {
    const j = gf.length - n + i;
    const d = gf[j] - ga[j];
    const amp = Math.min(1, Math.abs(d) / MARGIN_FULL);
    const base = d > 0 ? 1 + amp : d === 0 ? 1 : 1 - amp;
    const home = atHome?.[j];
    const venue = home === undefined ? 1 : home ? 1 : AWAY_CREDIT;
    credits += w[i] * venue * base;
    wSum += w[i];
  }
  if (wSum <= 0) return null;
  return round1(clamp((credits / (2 * wSum)) * 100, 0, 100));
}

/** Écart de buts (vs moyenne de ligue) qui sature le bonus : ±8 buts. */
const POWER_SCALE = 8;

/**
 * Team Power (/100) rapporté à la MOYENNE DE LA LIGUE : 50 = niveau moyen de
 * la ligue ; ±50 = équipe deux fois plus efficace en attaque ET en défense.
 *
 * ⚠️ La base de ligue doit entrer par un terme ABSOLU, pas par un rapport :
 * une version `50·(1 + 0.5·log₂(gf/ref) − 0.5·log₂(ga/ref))` s'annule
 * exactement (les termes se réduisent à log₂(gf/ga), ref disparaît) — la
 * mesure devenait insensible à la ligue, ce qui est précisément ce que la spec
 * Danoises §2.B refuse (« rapporté à la moyenne du championnat concerné »).
 *
 * D'où la forme retenue, en écarts ABSOLUS vs la moyenne de la ligue :
 *   - `attack = tanh((gfAvg − ref) / 8)` : buts marqués AU-DESSUS de la moyenne ;
 *   - `defense = tanh((ref − gaAvg) / 8)` : buts ÉCONOMISÉS vs la moyenne.
 *
 * Contrôle : `computePower([ref…], [ref…], ref) = 50` pour tout ref, y compris
 * les 3 bases danoises (25.6 / 28.5 / 31.8). Un même profil de buts absolu
 * obtient donc des indices différents selon la ligue — c'est l'effet recherché.
 */
export function computePower(
  gf: number[],
  ga: number[],
  leagueMean: number = CMP_NEUTRAL_LAMBDA,
): number | null {
  const n = Math.min(gf.length, ga.length, PARISCORE_WINDOW);
  if (n === 0) return null;
  const ref = leagueMean > 0 ? leagueMean : CMP_NEUTRAL_LAMBDA;
  const gfAvg = avg(gf.slice(-n));
  const gaAvg = avg(ga.slice(-n));
  if (gfAvg <= 0 || gaAvg <= 0) return null;
  const attack = Math.tanh((gfAvg - ref) / POWER_SCALE);
  const defense = Math.tanh((ref - gaAvg) / POWER_SCALE);
  return round1(clamp(50 + 25 * attack + 25 * defense, 0, 100));
}

function avg(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Séquence W/D/L brute des N derniers (ancien → récent). */
function seqOf(gf: number[], ga: number[], n: number): PariscoreFormSeq {
  const k = Math.min(gf.length, ga.length, n);
  let out = "";
  for (let i = gf.length - k; i < gf.length; i++) {
    out += gf[i] > ga[i] ? "W" : gf[i] === ga[i] ? "D" : "L";
  }
  return out;
}

/** Bloc métriques d'une équipe, null si aucun historique exploitable. */
export function teamPariscoreMetrics(
  name: string,
  form: { gf: number[]; ga: number[]; atHome?: boolean[] } | undefined,
  window = 5,
  leagueMean: number = CMP_NEUTRAL_LAMBDA,
): PariscoreTeamMetrics | null {
  if (!form || form.gf.length === 0) return null;
  const formPct = computeFormPctWeighted(form.gf, form.ga, form.atHome);
  const power = computePower(form.gf, form.ga, leagueMean);
  if (formPct == null || power == null) return null;
  const n = Math.min(form.gf.length, form.ga.length, PARISCORE_WINDOW);
  return {
    name,
    formPct,
    power,
    played: n,
    scoredAvg: round1(avg(form.gf.slice(-n))),
    concededAvg: round1(avg(form.ga.slice(-n))),
    seq: seqOf(form.gf, form.ga, window),
  };
}

/**
 * Index Pariscore : différentiel de Forme + différentiel de Team Power, signé
 * du point de vue de l'équipe à domicile (+ avantage du terrain = 1.2, spec
 * mission Danoises). Échelle ≈ ±45, comparable à l'INDEX Vitibet
 * (« +8.96 » / « −21.82 »).
 */
export function computePariscoreIndex(
  home: PariscoreTeamMetrics | null,
  away: PariscoreTeamMetrics | null,
  homeAdvantage: number = HOME_ADVANTAGE_INDEX,
): number {
  const formDiff = (home?.formPct ?? 50) - (away?.formPct ?? 50);
  const powerDiff = (home?.power ?? 50) - (away?.power ?? 50);
  return round1(homeAdvantage + 0.25 * formDiff + 0.2 * powerDiff);
}

// ─── Score prédit ───

/**
 * λs de la rencontre, en 3 régimes — du plus au moins contraint en données.
 *
 * 1. **AUCUNE équipe connue** → prior neutre symétrique en Poisson (ν = 1).
 *    Aucun signal, donc aucune différenciation à inventer : `hasSignal: false`
 *    et l'UI affiche un état neutre explicite (« — : — / Données
 *    insuffisantes ») au lieu de probas qui ressembleraient à une prédiction.
 *
 * 2. **Historique suffisant des DEUX côtés** (≥ `CMP_MIN_HISTORY`) → forces
 *    CMP (`teamStrength` + `matchLambdas`), λ = TAUX, ν ≈ 1.3. La moyenne
 *    affichée repasse par `cmpMean` (cf. `computePariscorePrediction`).
 *
 * 3. **Historique court mais réel** (1..`CMP_MIN_HISTORY` − 1, cas le plus
 *    fréquent en production : une équipe qui vient d'arriver, une fenêtre
 *    Flashscore de 8 jours qui n'a capté que 1-2 rencontres) → l'écart mesuré
 *    est réinjecté via `matchLambdasFromSeries` : moyennes d'attaque et de
 *    défense shrinkées vers la MOYENNE DE LA LIGUE (prior de 3 matchs, ν = 1
 *    donc λ = moyenne) + avantage du terrain.
 *
 * ⚠️ Le régime 3 est le correctif du bug « 28 : 28 / 47.4 %-5.3 %-47.4 % ».
 * L'ancien code exigeait 3 matchs des DEUX côtés et retombait sinon sur un
 * prior perfectly symétrique — alors que la Forme Calculée (2.6 % contre
 * 71.7 %) et le Team Power (31.6 contre 60.1) étaient déjà calculés et
 * affichés juste au-dessus. Un 10-10 cystique sur deux équipes aussi
 * dissymétriques est une absence de modèle, pas une prédiction. Le
 * shrinkage garantit qu'un seul match ne suffit pas à faire basculer un
 * écart de 20 buts : il pèse 25 %, la base de ligue 75 %.
 */
function resolveLambdas(
  homeForm: HandballFormStore | undefined,
  match: HandballMatch,
  leagueMean: number,
): {
  lambdaH: number;
  lambdaE: number;
  nuH: number;
  nuE: number;
  hasForm: boolean;
  hasSignal: boolean;
} {
  const h = homeForm?.get(String(match.home.id));
  const a = homeForm?.get(String(match.away.id));
  const neutral = leagueMean > 0 ? leagueMean : CMP_NEUTRAL_LAMBDA;
  if (!h || !a || h.gf.length === 0 || a.gf.length === 0) {
    return { lambdaH: neutral, lambdaE: neutral, nuH: 1, nuE: 1, hasForm: false, hasSignal: false };
  }
  if (h.gf.length >= CMP_MIN_HISTORY && a.gf.length >= CMP_MIN_HISTORY) {
    const home: CmpTeam = teamStrength(h.gf, h.ga);
    const away: CmpTeam = teamStrength(a.gf, a.ga);
    return { ...matchLambdas(home, away), hasForm: true, hasSignal: true };
  }
  const shrunk = matchLambdasFromSeries(
    { scored: h.gf, conceded: h.ga },
    { scored: a.gf, conceded: a.ga },
    neutral,
  );
  return {
    lambdaH: shrunk.lambdaH,
    lambdaE: shrunk.lambdaA,
    nuH: 1,
    nuE: 1,
    hasForm: false,
    hasSignal: true,
  };
}

/**
 * Seuil Over/Under optimal.
 *
 * Scan des demi-lignes autour du total attendu. On retient la ligne la PLUS
 * CONSERVATRICE qui passe la barre de probabilité — c'est-à-dire la plus proche
 * du total attendu, pas la plus sûre. « Over 53.5 à 67 % » est le pari
 * jouable ; « Over 45.5 à 99 % » est mathématiquement vrai mais sans valeur
 * (et au-delà de PARISCORE_MAX_PROB_PCT on ne le publie même plus).
 * null si aucune demi-ligne ne tient dans la bande [65 %, 95 %].
 *
 * ⚠️ `lambdaH`/`lambdaE` sont des TAUX CMP, pas des moyennes de buts (voir
 * cmpLambdaForMean). Passer une moyenne ici décale toute la distribution et
 * renvoie 0 % sur toutes les lignes. Utiliser computePariscorePrediction,
 * qui fait la conversion.
 */
export function pickTotalThreshold(
  lambdaH: number,
  nuH: number,
  lambdaE: number,
  nuE: number,
  oddsByLine?: Record<string, { over?: number; under?: number }>,
): PariscoreTotalPick | null {
  // Attendu exprimé en MOYENNE de buts (les λ ci-dessus sont des taux).
  const expected = cmpMean(lambdaH, nuH) + cmpMean(lambdaE, nuE);
  const base = Math.round(expected / LINE_STEP) * LINE_STEP;
  let best: PariscoreTotalPick | null = null;
  let bestDistance = Infinity;
  for (let line = base - LINE_SCAN_HALF_WIDTH; line <= base + LINE_SCAN_HALF_WIDTH; line += LINE_STEP) {
    const { over } = overUnderProb(lambdaH, nuH, lambdaE, nuE, line);
    for (const side of ["over", "under"] as const) {
      const p = side === "over" ? over : 1 - over;
      const prob = round1(p * 100);
      if (prob < PARISCORE_MIN_PROB_PCT || prob > PARISCORE_MAX_PROB_PCT) continue;
      const market = oddsByLine?.[String(line)];
      const odds = market?.[side] ?? null;
      const distance = Math.abs(line - expected);
      // Conservateur d'abord (ligne proche du total attendu) ; à distance
      // égale, on garde la proba la plus haute.
      const better =
        best == null ||
        distance < bestDistance ||
        (distance === bestDistance && prob > best.prob);
      if (!better) continue;
      bestDistance = distance;
      best = {
        line: round1(line),
        side,
        prob,
        odds,
        qualifies: odds == null || odds >= PARISCORE_MIN_ODDS,
      };
    }
  }
  return best;
}

// ─── Entry point ───

/**
 * Prédiction Pariscore complète d'une rencontre : métriques par équipe, Index,
 * score prédit, winrate 1N2 et seuil de total.
 *
 * Ne throw jamais : historique absent → λ neutre, `hasForm: false`,
 * `hasSignal: false`, note explicite. Les métriques d'équipe renvoient null
 * (affichage « — ») plutôt qu'un 0 qui ferait croire à une équipe nulle.
 */
export function computePariscorePrediction(
  match: HandballMatch,
  opts: {
    /** Form-store déjà calculé (dialog) ou dérivé des matchs terminés. */
    formStore?: HandballFormStore | null;
    finished?: HandballMatch[];
    /** Cotes de total par ligne ("57.5" → { over, under }). */
    totalOdds?: Record<string, { over?: number; under?: number }>;
    /**
     * Moyenne de buts par équipe et par match DE LA LIGUE du match. Calcule le
     * Team Power ET le prior neutre. Repli : CMP_NEUTRAL_LAMBDA (28.5,
     * toutes ligues). Les ligues danoises sont très étalées (25.6 → 31.8) :
     * passer la vraie base évite de décaler tout le modèle.
     */
    leagueMean?: number;
    /** Avantage du terrain en points d'Index (défaut : HOME_ADVANTAGE_INDEX). */
    homeAdvantage?: number;
  } = {},
): PariscorePrediction {
  const leagueMean =
    opts.leagueMean != null && opts.leagueMean > 0 ? opts.leagueMean : CMP_NEUTRAL_LAMBDA;
  const store =
    opts.formStore ?? (opts.finished?.length ? buildFormStore(opts.finished) : null);
  const { lambdaH, lambdaE, nuH, nuE, hasForm, hasSignal } = resolveLambdas(
    store ?? undefined,
    match,
    leagueMean,
  );

  const home = teamPariscoreMetrics(
    match.home.name,
    store?.get(String(match.home.id)),
    5,
    leagueMean,
  );
  const away = teamPariscoreMetrics(
    match.away.name,
    store?.get(String(match.away.id)),
    5,
    leagueMean,
  );

  // Sur le modèle ajusté, λ est un TAUX CMP et non une moyenne de buts : toute
// lecture de λ doit repasser par cmpMean, sinon on lit ~13 buts au lieu de
// ~30 (E[X](30, ν=1.3) = 13.6). (Au prior neutre ν = 1, cmpMean(λ) = λ.)
const meanH = cmpMean(lambdaH, nuH);
const meanE = cmpMean(lambdaE, nuE);

const total = pickTotalThreshold(lambdaH, nuH, lambdaE, nuE, opts.totalOdds);

// ⚠️ Skellam reçoit les MOYENNES, pas les taux CMP.
//
// Skellam est une différence de deux POISSON : son λ est la moyenne. Lui passer
// les taux produit un 1X2 qui peut CONTREDIRE le score affiché juste au-dessus.
// Mesuré sur CSM Bucuresti vs Minaur Baia Mare (14 matchs chacun, données
// réelles, base ligue 30.06) : le score sortait à 30:36 (défaite de CSM) mais le
// 1N2 à 99.3 % de victoire domicile.
//
// Pourquoi : λ est un taux, donc le RANGEMENT des λ en fonction de ν peut
// s'inverser par rapport à celui de leurs moyennes (un ν élevé exige un taux
// bien plus grand pour la même espérance). Or Skellam ne lit que le RAPPORT
// λh/λe. Les deux nt étaient inversés.
//
// Ce bug dormait parce que ce chemin était presque jamais atteint : le store
// descendait presque toujours sous CMP_MIN_HISTORY et le moteur tombait sur son
// prior neutre (28:28, 47.4 %-5.3 %-47.4 %). Le correctif de sourcing rend le
// chemin CMP-Fréquent — il aurait fallu corriger les deux ensemble.
const w = skellamMatchProbs(meanH, meanE);

const pct = (v: number) => round1(v * 100);
  const winrate: PariscoreWinrate = {
    home: pct(w.home),
    draw: pct(w.draw),
    away: pct(w.away),
  };

  const base = `base ligue ${leagueMean.toFixed(1)} buts`;
  return {
    index: computePariscoreIndex(home, away, opts.homeAdvantage ?? HOME_ADVANTAGE_INDEX),
    home,
    away,
    scoreHome: Math.round(meanH),
    scoreAway: Math.round(meanE),
    winrate,
    expectedTotal: round1(meanH + meanE),
    total,
    hasForm,
    hasSignal,
    note: hasForm
      ? `CMP/Skellam sur forme L${PARISCORE_WINDOW} pondérée (lieu + écart), ${base} — ${match.league.name}`
      : hasSignal
        ? `Moyennes d'attaque/défense shrinkées vers la ${base} (historique < ${CMP_MIN_HISTORY} matchs, ν = Poisson) — ${match.league.name}`
        : `Prior neutre ${base} — aucun résultat en base pour ces équipes — ${match.league.name}`,
  };
}
