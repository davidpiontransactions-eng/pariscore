/**
 * Moteur live BASKETBALL — marchés in-play.
 *
 * Modèle possessionnel : la probabilité d'un point est portée par la
 * POSSESSION, pas par la minute. Donc λ(points) = pace restant × points par
 * possession (PPP). Le PPP vient de l'eFG% live et de la part de tirs à
 * 3 points ; la pace du match est recalculée sur le temps ÉCOULÉ (48 min
 * NBA/WNBA) et non sur la somme des scores — un match qui va à 60-58 n'a pas
 * la même pace qu'un 100-80 au même quartier.
 *
 * Le marché « prochain panier » (2 pts / 3 pts / LF) est la seule granularité
 * sous la possession : c'est exactement ce que propose le bookmaker
 * (« prochain panier à 3 points »).
 */

import {
  clampRange,
  driver,
  market,
  raceToProb,
  resolvedMarket,
  type LiveBetsBundle,
  type LiveMarket,
} from "./live-common";

/** Durée d'un match NBA/WNBA : 4 × 12 min. */
const PERIOD_MINUTES = 12;
const PERIODS = 4;
/** Points par possession league moyen (NBA 2023-24 ≈ 1.13). */
const LEAGUE_PPP = 1.13;
/** eFG% league moyen (≈ 0.54). */
const LEAGUE_EFG = 0.54;
/** Part des tirs à 3 points (≈ 0.41 des tirs de champ). */
const LEAGUE_THREE_RATE = 0.41;
/** Pace league (possessions par 48 min). */
const LEAGUE_PACE = 99;
/** Tirs de champ par possession (les lancers francs occupent le reste). */
const FGA_PER_POSSESSION = 0.88;
/** Lancers francs par possession. */
const FT_PER_POSSESSION = 0.22;
/** Taux de réussite des 3 points (league : ≈ 36 %). */
const LEAGUE_THREE_PCT = 0.36;
/** Points par possession réactives, bornes de sécurité. */
const PPP_MIN = 0.85;
const PPP_MAX = 1.45;
/** Réussite des lancers francs moyenne. */
const FT_RATE = 0.78;
/** Profondeur de troncature des PMF résiduelles (points). */
const PMF_MAX = 30;

export type BasketballLiveInput = {
  /** Quartier en cours, 1-4 (5+ = prolongation). */
  period: number;
  /** Minutes restantes dans le quartier courant (float). */
  periodMinutesLeft: number;
  homeScore: number;
  awayScore: number;
  /** Tirs de champ tentés par camp ce match (optionnel → pace league). */
  homeFga?: number | null;
  awayFga?: number | null;
  /** eFG% live par camp (0-1, ex. 0.54). Optionnel → league. */
  homeEfg?: number | null;
  awayEfg?: number | null;
  /** Tirs à 3 points réussis par camp (marché « prochain panier »). */
  homeThreeMade?: number | null;
  awayThreeMade?: number | null;
  /** Tirs à 3 points tentés par camp (affine la part de 3 points). */
  homeThreeAtt?: number | null;
  awayThreeAtt?: number | null;
};

/**
 * Pace du match en possessions par 48 min.
 *
 * Les FGA sont la seule mesure de rythme disponible, mais ils dépendent de la
 * PHASE : une équipe qui tire beaucoup à cause d'un retard non-aws n'a pas
 * une pace élevée. On borne donc la mesure dans la plage physique d'un match
 * NBA (80-125 poss/48) avant de la ramener sur le temps joué : sans borne, un
 * match à 139 FGA en 29 min (ordre de grandeur correct) renvoyait 256
 * poss/48, valeur impossible et qui projetait 60 points restants.
 */
const PACE_MIN = 80;
const PACE_MAX = 125;

function observedPace(input: BasketballLiveInput): number | null {
  const fga = (input.homeFga ?? 0) + (input.awayFga ?? 0);
  if (!(fga > 0)) return null;
  const minutesPlayed = clampRange(
    PERIOD_MINUTES * (input.period - 1) + (PERIOD_MINUTES - input.periodMinutesLeft),
    1,
    PERIOD_MINUTES * PERIODS
  );
  const possessions = fga / FGA_PER_POSSESSION;
  const pace = (possessions * (PERIOD_MINUTES * PERIODS)) / minutesPlayed;
  return clampRange(pace, PACE_MIN, PACE_MAX);
}

/**
 * Points par possession à partir de l'eFG% et de la part de tirs à 3 points.
 *
 * eFG% = (2PM + 0.5·3PM) / FGA, donc en notant r la part des 3PA et α3 le
 * taux de réussite en 3 points :
 *
 *   pts/FGA = 2·2PM + 3·3PM = 2·eFG + 1.5·α3·r
 *
 * puis PPP = pts/FGA × FGA par possession + lancers francs × leur taux.
 *
 * ⚠️ PiègeRESOLU : une décomposition « deux parts proportionnelles à eFG »
 * donnait pts/FGA = 2(1−r) + 3r = 2 + r, INDEPENDANTE de l'eFG%. L'eFG% live
 * — l'un des trois drivers de la mission — n'avait donc AUCUN effet sur le
 * modèle : les deux équipes à eFG 0.68 et 0.48 obtenaient le même λ.
 */
function pointsPerPossession(
  efg: number | null | undefined,
  threeRate: number,
  threePct: number
): number {
  const e = clampRange(efg ?? LEAGUE_EFG, 0.35, 0.75);
  const r = clampRange(threeRate, 0.2, 0.65);
  const p3 = clampRange(threePct, 0.2, 0.55);
  const pointsPerFga = 2 * e + 1.5 * p3 * r;
  const ppp = pointsPerFga * FGA_PER_POSSESSION + FT_PER_POSSESSION * FT_RATE;
  return clampRange(ppp, PPP_MIN, PPP_MAX);
}

/** Part des tirs de champ tentés à 3 points, observée sinon league. */
function observedThreeRate(input: BasketballLiveInput): number {
  const threeMade = (input.homeThreeMade ?? 0) + (input.awayThreeMade ?? 0);
  const threeAtt = (input.homeThreeAtt ?? 0) + (input.awayThreeAtt ?? 0);
  if (threeAtt > 0) return clampRange(threeMade / threeAtt, 0.15, 0.6);
  if (threeMade > 0) return clampRange(threeMade, 0.05, 0.3);
  return LEAGUE_THREE_RATE;
}

/**
 * Minutes de match restantes, prolongation incluse.
 *
 * minutes_left = (périodes restantes après la courante) + fraction de la
 * courante.
 *
 * ⚠️ `(period − 1) × 12 + periodMinutesLeft` était faux : pour un match en
 * 4e période, il ne reste QUE `periodMinutesLeft` (les 36 minutes précédentes
 * sont jouées), pas 36 + le temps restant. Le calcul inversé projetait 107
 * points à 30 s de la fin du 4e quartier.
 */
function minutesLeft(input: BasketballLiveInput): number {
  const period = clampRange(input.period, 1, PERIODS + 3);
  const periodLeft = clampRange(input.periodMinutesLeft, 0, PERIOD_MINUTES);
  return Math.max(0, (PERIODS - period) * PERIOD_MINUTES) + periodLeft;
}

/** Taux de réussite des 3 points, observé sinon league. */
function observedThreePct(input: BasketballLiveInput): number {
  const threeMade = (input.homeThreeMade ?? 0) + (input.awayThreeMade ?? 0);
  const threeAtt = (input.homeThreeAtt ?? 0) + (input.awayThreeAtt ?? 0);
  if (threeAtt > 0) return clampRange(threeMade / threeAtt, 0.2, 0.55);
  return LEAGUE_THREE_PCT;
}

/** λ points marqués par camp sur le temps restant + pace observée. */
function remainingLambdas(input: BasketballLiveInput): {
  lambdaHome: number;
  lambdaAway: number;
  pace: number;
  minutesLeft: number;
} {
  const pace = observedPace(input) ?? LEAGUE_PACE;
  const minutes = minutesLeft(input);
  // Possessions restantes par camp = pace/2 par 48 min, au prorata du temps.
  const possessionsLeft = (pace / 2) * (minutes / (PERIOD_MINUTES * PERIODS));
  const threeRate = observedThreeRate(input);
  const threePct = observedThreePct(input);
  return {
    lambdaHome: possessionsLeft * pointsPerPossession(input.homeEfg, threeRate, threePct),
    lambdaAway: possessionsLeft * pointsPerPossession(input.awayEfg, threeRate, threePct),
    pace,
    minutesLeft: minutes,
  };
}

/** PMF de Poisson tronquée puis renormalisée (somme = 1 exactement). */
function poissonVector(lambda: number, max: number = PMF_MAX): number[] {
  const out = new Array<number>(max + 1).fill(0);
  if (!(lambda > 0)) {
    out[0] = 1;
    return out;
  }
  let p = Math.exp(-lambda);
  let sum = 0;
  for (let i = 0; i <= max; i++) {
    out[i] = p;
    sum += p;
    p *= (lambda as number) / (i + 1);
  }
  if (sum > 0) for (let i = 0; i <= max; i++) out[i] /= sum;
  return out;
}

/**
 * P(gagne, prolongation incluse) à partir du score courant et des λ.
 *
 * Le basket n'a pas de nul : une égalité mène à la prolongation, comptée
 * 50/50 — aucun avantage résiduel de terrain documenté au-delà de l'ordre de
 * tir, qui est déjà dans les λ.
 */
function winProb(
  scoreA: number,
  scoreB: number,
  lambdaA: number,
  lambdaB: number
): { a: number; b: number } {
  const pmfA = poissonVector(lambdaA);
  const pmfB = poissonVector(lambdaB);
  let a = 0;
  let b = 0;
  for (let i = 0; i < pmfA.length; i++) {
    for (let j = 0; j < pmfB.length; j++) {
      const p = pmfA[i] * pmfB[j];
      if (scoreA + i > scoreB + j) a += p;
      else if (scoreA + i < scoreB + j) b += p;
      // Égalité → prolongation, répartie ci-dessous.
    }
  }
  const tie = Math.min(1, Math.max(0, 1 - a - b));
  return { a: a + tie / 2, b: b + tie / 2 };
}

/**
 * P(total final > ligne), score courant inclus.
 *
 * `line` demi-point → jamais de push, les deux issues sont complémentaires.
 */
function probabilityTotalOver(
  currentTotal: number,
  lambdaHome: number,
  lambdaAway: number,
  line: number
): number {
  const pmfHome = poissonVector(lambdaHome);
  const pmfAway = poissonVector(lambdaAway);
  let over = 0;
  for (let i = 0; i < pmfHome.length; i++) {
    for (let j = 0; j < pmfAway.length; j++) {
      if (currentTotal + i + j > line) over += pmfHome[i] * pmfAway[j];
    }
  }
  return clampRange(over, 0, 1);
}

/** Projette les marchés live basket. */
export function basketballLiveMarkets(input: BasketballLiveInput): LiveBetsBundle {
  const period = clampRange(Math.round(input.period), 1, PERIODS + 3);
  const periodLeft = clampRange(input.periodMinutesLeft, 0, PERIOD_MINUTES);
  const { lambdaHome, lambdaAway, pace, minutesLeft: minutes } = remainingLambdas(input);

  const markets: LiveMarket[] = [];

  // ① Vainqueur du match (prolongation incluse).
  const match = winProb(input.homeScore, input.awayScore, lambdaHome, lambdaAway);
  markets.push(
    market(
      "match-winner",
      "match",
      "Vainqueur du match",
      `λ points restants = ${lambdaHome.toFixed(1)} / ${lambdaAway.toFixed(1)} (pace ${pace.toFixed(0)}/48, PPP dérivé de l'eFG% live). Égalité → prolongation comptée 50/50.`,
      [
        { id: "home", label: "Domicile", prob: match.a },
        { id: "away", label: "Extérieur", prob: match.b },
      ]
    )
  );

  // ② Vainqueur du quartier en cours.
  // λ proportionnels au temps restant DANS le quartier, et le score de DÉPART
  // est 0-0 : le marché se joue sur les POINTS MARQUÉS DANS LE QUARTIER, pas
  // sur le score cumulé. Avec le score cumulé (78-74) le marché affichait
  // 90 % pour le quartileur, ce qui ne veut rien dire.
  const quarterOwn = periodLeft / PERIOD_MINUTES;
  const quarter = winProb(0, 0, lambdaHome * quarterOwn, lambdaAway * quarterOwn);
  markets.push(
    market(
      "quarter-winner",
      "period",
      `Vainqueur du Q${period}`,
      `λ restreints au quartier : ${(lambdaHome * quarterOwn).toFixed(1)} / ${(lambdaAway * quarterOwn).toFixed(1)} points. Le marché se joue sur les points marqués DANS le quartier, pas sur le score cumulé (éégalité 0-0 au départ).`,
      [
        { id: "home", label: "Domicile", prob: quarter.a },
        { id: "away", label: "Extérieur", prob: quarter.b },
      ]
    )
  );

  // ③ Handicap live — marge finale comparée à la ligne. Convention 1xBet :
  // positif = le Domicile reçoit la ligne. Marge finale = ligne exacte → push
  // (void), donc non comptée gagnante d'un côté ni de l'autre.
  const spread = input.homeScore - input.awayScore;
  const expectedFinal = spread + (lambdaHome - lambdaAway);
  const line = Math.round(expectedFinal * 2) / 2; // ligne demi-point la plus proche
  const pmfA = poissonVector(lambdaHome);
  const pmfB = poissonVector(lambdaAway);
  let coverHome = 0;
  let coverAway = 0;
  for (let i = 0; i < pmfA.length; i++) {
    for (let j = 0; j < pmfB.length; j++) {
      const finalMargin = spread + i - j;
      const p = pmfA[i] * pmfB[j];
      if (finalMargin > line) coverHome += p;
      else if (finalMargin < line) coverAway += p;
    }
  }
  const signed = (v: number) => `${v > 0 ? "+" : ""}${v}`;
  markets.push(
    market(
      "handicap-live",
      "match",
      `Handicap ${signed(line)} (Domicile)`,
      `Marge finale espérée ${expectedFinal.toFixed(1)} pts. Convention 1xBet : positif = le Domicile reçoit la ligne. Marge finale = ligne exacte → push (void), non comptée ici.`,
      [
        { id: "home", label: `Domicile ${signed(line)}`, prob: coverHome },
        { id: "away", label: `Extérieur ${signed(-line)}`, prob: coverAway },
      ]
    )
  );

  // ④ Race to X points — seuil canonique : premier multiple de 5 au-dessus du
  // score le plus élevé, +5. Garantit un marché non trivial et jamais résolu.
  const target = Math.ceil((Math.max(input.homeScore, input.awayScore) + 5) / 5) * 5;
  const needHome = target - input.homeScore;
  const needAway = target - input.awayScore;
  const share = lambdaHome + lambdaAway > 0 ? lambdaHome / (lambdaHome + lambdaAway) : 0.5;
  const raceHome = raceToProb(share, needHome, needAway);
  markets.push(
    market(
      "race-to-x",
      "micro",
      `Race to ${target} points`,
      `Course indépendante : chaque point revient au Domicile avec p = ${(share * 100).toFixed(0)} % (part des λ résiduels). Il faut ${needHome} points au Domicile contre ${needAway} à l'Extérieur.`,
      [
        { id: "home", label: "Domicile atteint", prob: raceHome },
        { id: "away", label: "Extérieur atteint", prob: 1 - raceHome },
      ]
    )
  );

  // ⑤ Valeur du prochain panier — partage des points par valeur.
  // Issue = la VALEUR du prochain panier (2 ou 3) ou lancers : c'est le marché
  // réel du bookmaker, pas « panier ou pas ».
  const threeMade = (input.homeThreeMade ?? 0) + (input.awayThreeMade ?? 0);
  const threeAtt = (input.homeThreeAtt ?? 0) + (input.awayThreeAtt ?? 0);
  const totalScore = input.homeScore + input.awayScore;
  let share3: number;
  let shareFt: number;
  if (threeMade > 0 && totalScore > 0) {
    // Part des points déjà marqués par des 3 points (3 pt = 3 points chacun).
    share3 = clampRange((threeMade * 3) / totalScore, 0.1, 0.5);
    shareFt = clampRange((threeAtt - threeMade) * FT_RATE / Math.max(1, totalScore), 0.05, 0.3);
  } else {
    // Aucune donnée 3 pts : arithmétique du modèle de pace (3 PM par
    // possession au taux league), cohérent avec le PPP utilisé plus haut.
    share3 = clampRange((LEAGUE_THREE_RATE * LEAGUE_THREE_PCT * 3) / LEAGUE_PPP, 0.1, 0.5);
    shareFt = clampRange(FT_PER_POSSESSION * FT_RATE / LEAGUE_PPP, 0.05, 0.3);
  }
  const share2 = clampRange(1 - share3 - shareFt, 0.3, 0.85);
  markets.push(
    market(
      "next-basket-type",
      "micro",
      "Valeur du prochain panier",
      `Part des points marqués en 3 points = ${(share3 * 100).toFixed(0)} %, en 2 points = ${(share2 * 100).toFixed(0)} %, aux lancers = ${(shareFt * 100).toFixed(0)} %. On suppose que la distribution de la valeur reste celle du match en cours.`,
      [
        { id: "three", label: "Panier à 3 points", prob: share3 },
        { id: "two", label: "Panier à 2 points", prob: share2 },
        { id: "ft", label: "Lancers francs", prob: shareFt },
      ]
    )
  );

  // ⑥ Over/Under total points — marché RÉSOLU dès qu'il n'y a plus de temps :
  // à 30 s restantes, le total est de fait fixé, et un bornage afficherait un
  // « 2 % » là où l'issue est arithmétiquement certaine.
  const over = probabilityTotalOver(input.homeScore + input.awayScore, lambdaHome, lambdaAway, 210.5);
  const ouRows = [
    { id: "over", label: "Over 210.5", prob: over },
    { id: "under", label: "Under 210.5", prob: 1 - over },
  ];
  const ouHint =
    "Ligne fixe 210.5 (moyenne NBA) : utile quand le score est loin de la ligne et que le total est déjà fixé.";
  markets.push(
    // 1 min ou moins restante : le total est arithmétiquement fixé, aucun
    // bornage ne doit s'appliquer.
    periodLeft <= 1
      ? resolvedMarket("ou-total", "match", "Over/Under 210.5 points", ouHint, ouRows)
      : market("ou-total", "match", "Over/Under 210.5 points", ouHint, ouRows)
  );

  const efgHome = input.homeEfg ?? LEAGUE_EFG;
  const efgAway = input.awayEfg ?? LEAGUE_EFG;
  const lead = input.homeScore - input.awayScore;

  return {
    sport: "basketball",
    scoreA: input.homeScore,
    scoreB: input.awayScore,
    clock: `Q${period} ${Math.floor(periodLeft)}:${String(Math.floor((periodLeft % 1) * 60)).padStart(2, "0")}`,
    markets,
    drivers: [
      driver("Pace", pace / 120, `${pace.toFixed(0)} poss/48`),
      driver("eFG% domicile", efgHome, `${(efgHome * 100).toFixed(0)} %`),
      driver("eFG% extérieur", efgAway, `${(efgAway * 100).toFixed(0)} %`),
      driver("Écart", clampRange(0.5 + lead / 60, 0, 1), lead > 0 ? `+${lead}` : `${lead}`),
      driver(
        "Temps restant",
        clampRange(minutes / (PERIOD_MINUTES * PERIODS), 0, 1),
        `${minutes.toFixed(1)} min`
      ),
    ],
  };
}