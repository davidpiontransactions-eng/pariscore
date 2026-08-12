/**
 * Loi Pythagoricienne de Bill James :
 *   Win% = RSˣ / (RSˣ + RAˣ)   avec x = 1,83
 *
 * Les runs attendus (RS/RA) sont fournis par la passe de calibrage du moteur
 * Monte Carlo (mêmes profils de frappe, matrice d'espérance de points) : le
 * prior est donc mathématiquement cohérent avec la distribution simulée.
 */

import { PYTHAGOREAN_EXPONENT } from "./constants";

export interface PythagorasResult {
  exponent: number;
  expectedHomeRuns: number;
  expectedAwayRuns: number;
  homeWinProb: number;
}

/** Win% attendu de l'équipe à domicile selon la loi de Bill James. */
export function billJamesWinProb(
  homeRuns: number,
  awayRuns: number,
  exponent: number = PYTHAGOREAN_EXPONENT,
): number {
  const hs = homeRuns ** exponent;
  const as = awayRuns ** exponent;
  return hs / (hs + as);
}

export function pythagoreanFromRuns(
  expectedHomeRuns: number,
  expectedAwayRuns: number,
): PythagorasResult {
  return {
    exponent: PYTHAGOREAN_EXPONENT,
    expectedHomeRuns,
    expectedAwayRuns,
    homeWinProb: billJamesWinProb(expectedHomeRuns, expectedAwayRuns),
  };
}
