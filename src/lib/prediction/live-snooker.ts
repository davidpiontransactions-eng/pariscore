/**
 * Moteur live SNOOKER — marchés in-play.
 *
 * Le snooker a une structure que les 5 autres sports n'ont pas : un break en
 * cours, des points SUR LA TABLE, et un retard qui se compte en POINTS, pas en
 * manches. Le marché « Vainqueur frame » n'est donc pas une course à l'infini :
 * c'est une course à un seuil de POINTS sur les seules billes encore en place.
 *
 * Réutilise `liveScoreDistribution` / `liveWinnerProb` de
 * `src/lib/snooker/live-distribution.ts` (log-binomiale) pour le vainqueur de
 * RENCONTRE — c'est le même modèle à la granularité frame, déjà testé.
 */

import {
  liveScoreDistribution,
  liveWinnerProb,
  type FinalScore,
} from "@/lib/snooker/live-distribution";
import {
  clampRange,
  driver,
  market,
  raceToProb,
  resolvedMarket,
  type LiveBetsBundle,
  type LiveMarket,
} from "./live-common";

/** Points d'une frame complète sans interruption (15 rouges + 15 noirs + couleurs). */
const MAX_FRAME_POINTS = 147;
/** Points par pot moyen : rouge (1) + couleur (7) = 8 ; on retient 7 (plancher). */
const AVG_POINTS_PER_POT = 7;
/** Taux de réussite des pots en circuit pro. */
const LEAGUE_POT_RATE = 0.94;
/**
 * Probabilité de reprendre la table depuis une position de défense (sécurité
 * adverse). 35 % : les pros reprennent la table environ un tiers du temps sur
 * une position longue, davantage sur une position courte.
 */
const TABLE_REGAIN_PROB = 0.35;
/** Facteur de pot en position de SNOOKER (bille sur le tapis, cuissons). */
const SNooker_POT_FACTOR = 0.35;

export type SnookerLiveInput = {
  /** Manches gagnées A / B. */
  framesA: number;
  framesB: number;
  /** Format de la rencontre (11 = best of 19, 13 = best of 25, 7 = best of 13). */
  bestOf: number;
  /** Points déjà marqués dans la frame en cours. */
  framePointsA: number;
  framePointsB: number;
  /** Points encore disponibles sur la table. */
  pointsOnTable: number;
  /** Le joueur A est-il à la table ? */
  playerATable: boolean;
  /** Taux de pot de A (0-1). Optionnel → league. */
  potRate?: number | null;
  /** Taux de pot de B (0-1). Optionnel → league. */
  opponentPotRate?: number | null;
  /** Le joueur à la table est-il dans un break de 50+ ? */
  inBreak?: boolean | null;
};

/** Points nécessaires à A pour emporter la frame. */
function pointsNeededForA(input: SnookerLiveInput): number {
  return input.framePointsB + 1 - input.framePointsA;
}

/** Points nécessaires à B pour emporter la frame. */
function pointsNeededForB(input: SnookerLiveInput): number {
  return input.framePointsA + 1 - input.framePointsB;
}

/** Taux de pot effectif, ajusté d'un break en cours (confiance). */
function effectivePotRate(input: SnookerLiveInput, forA: boolean): number {
  const raw = forA ? input.potRate : input.opponentPotRate;
  const rate = clampRange(raw ?? LEAGUE_POT_RATE, 0.6, 0.995);
  return clampRange(input.inBreak && forA ? rate * 1.02 : rate, 0.6, 0.995);
}

/**
 * Vainqueur de la frame : P(A emporte la frame avant B).
 *
 * A doit marquer `needA` points, B `needB`. Chaque point revient à A avec
 * probabilité `pShare` : sa part de pot rapportée à celle de l'adversaire,
 * inversée quand B est à la table (A joue moins de coups, donc marque moins).
 */
function frameWinProb(input: SnookerLiveInput): { a: number; b: number } {
  const needA = pointsNeededForA(input);
  const needB = pointsNeededForB(input);
  if (needA <= 0) return { a: 1, b: 0 };
  if (needB <= 0) return { a: 0, b: 1 };

  const potA = effectivePotRate(input, true);
  const potB = effectivePotRate(input, false);
  const pShare = clampRange(
    input.playerATable ? potA / (potA + potB) : potB / (potA + potB),
    0.02,
    0.98
  );
  const a = raceToProb(pShare, needA, needB);
  return { a, b: 1 - a };
}

/**
 * Century break : le joueur à la table atteint-il 100 points consécutifs ?
 *
 * Trois issues de modèle, dans l'ordre :
 *   1. Il lui faut `100 − pointsDuBreak`. S'il l'a déjà : probabilité 1.
 *   2. Les points sur table sont insuffisants : IMPOSSIBLE PHYSIQUE, donc 0.
 *      (Zéro réel, pas un 2 % de bornage — ici on renvoie 0 parce que la
   *      cause est arithmétique, pas un défaut de précision : aucun joueur ne
   *      peut marquer 100 points sur 40 points restants.)
 *   3. Sinon P = (taux de pot) ^ (points nécessaires / 7) × P(reprise de table).
 *      La reprise n'entre que si l'adversaire est À la table : le joueur qui
 *      vient de manquer doit d'abord la reprendre.
 */
function centuryBreakProb(input: SnookerLiveInput): number {
  const atTableIsA = input.playerATable;
  const breakPoints = atTableIsA ? input.framePointsA : input.framePointsB;
  const needed = 100 - breakPoints;
  if (needed <= 0) return 1;
  if (input.pointsOnTable < needed) return 0;

  const potAtTable = effectivePotRate(input, atTableIsA);
  const regain = atTableIsA ? 1 : TABLE_REGAIN_PROB;
  const potsNeeded = Math.max(1, Math.ceil(needed / AVG_POINTS_PER_POT));
  return clampRange(regain * Math.pow(potAtTable, potsNeeded), 0, 1);
}

/**
 * Prochaine bille empochée par le joueur à la table.
 *
 * Taux de pot effectif, réduit d'un facteur `SNooker_POT_FACTOR` quand le
 * joueur est derrière de plus de points qu'il n'en reste sur la table : il ne
 * peut plus gagner par les poquets, il doit jouer une sécurité et le retour de
 * table adverse devient l'événement dominant.
 */
function nextBallProb(input: SnookerLiveInput): { pot: number; miss: number; needsSnooker: boolean } {
  const atTablePoints = input.playerATable ? input.framePointsA : input.framePointsB;
  const otherPoints = input.playerATable ? input.framePointsB : input.framePointsA;
  const needed = otherPoints + 1 - atTablePoints;
  const needsSnooker = needed > input.pointsOnTable;
  const pot = effectivePotRate(input, input.playerATable);
  const p = needsSnooker ? pot * SNooker_POT_FACTOR : pot;
  return { pot: clampRange(p, 0, 1), miss: clampRange(1 - p, 0, 1), needsSnooker };
}

/** Projette les marchés live snooker. */
export function snookerLiveMarkets(input: SnookerLiveInput): LiveBetsBundle {
  const frame = frameWinProb(input);
  const century = centuryBreakProb(input);
  const nextBall = nextBallProb(input);

  // Vainqueur de rencontre : distribution log-binomiale existante, calée sur
  // la frame en cours (information plus fraîche que la force pré-match).
  const matchDist: FinalScore[] = liveScoreDistribution(
    clampRange(frame.a, 0.05, 0.95),
    input.bestOf,
    input.framesA,
    input.framesB
  );
  const matchFinished = matchDist.length === 0;
  const matchWinner = matchFinished
    ? input.framesA > input.framesB
      ? 1
      : 0
    : liveWinnerProb(matchDist, "p1") / 100;

  const atTableIsA = input.playerATable;
  const atTablePoints = input.playerATable ? input.framePointsA : input.framePointsB;
  const otherPoints = atTableIsA ? input.framePointsB : input.framePointsA;
  const atTableLabel = atTableIsA ? "Joueur A" : "Joueur B";
  const potA = effectivePotRate(input, true);
  const potB = effectivePotRate(input, false);
  const lead = input.framePointsA - input.framePointsB;

  const markets: LiveMarket[] = [];

  // ① Vainqueur de la frame en cours.
  const pShare = atTableIsA ? potA / (potA + potB) : potB / (potA + potB);
  markets.push(
    market(
      "frame-winner",
      "period",
      "Vainqueur de la frame",
      `A doit marquer ${pointsNeededForA(input)} points, B ${pointsNeededForB(input)}. Course de Bernoulli sur les points : chaque point revient à A avec p = ${(pShare * 100).toFixed(0)} % (${atTableIsA ? "A est à la table" : "B est à la table"}).`,
      [
        { id: "a", label: "Joueur A", prob: frame.a },
        { id: "b", label: "Joueur B", prob: frame.b },
      ]
    )
  );

  // ② Vainqueur de la rencontre.
  const matchRows = [
    { id: "a", label: "Joueur A", prob: matchWinner },
    { id: "b", label: "Joueur B", prob: 1 - matchWinner },
  ];
  const matchHint = matchFinished
    ? `Rencontre déjà tranchée (${input.framesA}-${input.framesB}) : marché archivé.`
    : `Distribution log-binomiale des scores finaux (format ${input.bestOf}, actuel ${input.framesA}-${input.framesB}), pFrame = ${frame.a.toFixed(3)} calée sur la frame en cours.`;
  markets.push(
    matchFinished
      ? resolvedMarket("match-winner", "match", "Vainqueur de la rencontre", matchHint, matchRows)
      : market("match-winner", "match", "Vainqueur de la rencontre", matchHint, matchRows)
  );

  // ③ Century break — `resolvedMarket` quand l'issue est TRANCHÉE (break déjà
  // centenaire, ou impossibilité physique), `market` quand elle se calcule.
  const breakPoints = atTablePoints;
  const neededForCentury = 100 - breakPoints;
  const centuryResolved = neededForCentury <= 0 || input.pointsOnTable < neededForCentury;
  const rows = [
    { id: "yes", label: "Century réalisé", prob: century },
    { id: "no", label: "Pas de century", prob: 1 - century },
  ];
  const centuryHint = `${atTableLabel} a besoin de ${neededForCentury} points consécutifs, il en reste ${input.pointsOnTable} sur la table. Impossible si les points sur table sont insuffisants → issue tranchée à 0. Sinon P = taux de pot ^ ${Math.ceil(Math.max(1, neededForCentury) / AVG_POINTS_PER_POT)} pots${atTableIsA ? "" : " × P(reprise de table)"}.`;
  markets.push(
    centuryResolved
      ? resolvedMarket("century-break", "micro", "Century break", centuryHint, rows)
      : market("century-break", "micro", "Century break", centuryHint, rows)
  );

  // ④ Prochaine bille empochée.
  markets.push(
    market(
      "next-ball",
      "micro",
      `Prochaine bille (${atTableLabel} à la table)`,
      nextBall.needsSnooker
        ? `${atTableLabel} a besoin de ${otherPoints + 1 - atTablePoints} points mais il n'en reste que ${input.pointsOnTable} sur la table : il DOUT jouer une sécurité, chaque bille devient une bille de snooker (taux de pot ÷ ${SNooker_POT_FACTOR}).`
        : `Taux de pot effectif de ${atTableLabel} = ${(effectivePotRate(input, input.playerATable) * 100).toFixed(0)} %. Position normale : la bille suivante se gagne à cette probabilité.`,
      [
        { id: "pot", label: "Bille empochée", prob: nextBall.pot },
        { id: "miss", label: "Bille manquée", prob: nextBall.miss },
      ]
    )
  );

  // Le total final de la frame est borné par le score courant + points sur
  // table : il sert de jauge, pas de marché (un O/U de frame n'a de sens
  // qu'une fois la frame terminée — l'UI affiche le max atteignable).
  const maxPossible = atTablePoints + input.pointsOnTable;

  return {
    sport: "snooker",
    scoreA: input.framesA,
    scoreB: input.framesB,
    clock: `Frame : ${input.framePointsA}-${input.framePointsB}`,
    markets,
    drivers: [
      driver("Points sur table", clampRange(input.pointsOnTable / MAX_FRAME_POINTS, 0, 1), `${input.pointsOnTable} pts`),
      driver("Points du break", clampRange(breakPoints / 100, 0, 1), `${breakPoints} pts`),
      driver("Taux de pot", potA, `${(potA * 100).toFixed(0)} %`),
      driver("Avance dans la frame", clampRange(0.5 + lead / 20, 0, 1), lead > 0 ? `+${lead}` : `${lead}`),
      driver(
        "Frames jouées",
        clampRange((input.framesA + input.framesB) / Math.ceil(input.bestOf / 2), 0, 1),
        `${input.framesA}-${input.framesB}`
      ),
      driver(
        "Max frame atteignable",
        clampRange(maxPossible / MAX_FRAME_POINTS, 0, 1),
        `${maxPossible} pts`
      ),
    ],
  };
}