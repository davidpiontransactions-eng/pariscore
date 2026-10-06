/**
 * Lignes et écarts-types de marché mesurés sur `basketball_match_history`.
 *
 * Ces valeurs REMPLACENT les constantes inventées du backtest (ligne NBA
 * 215.5 + seuil 220 appliqués à toutes les ligues). Mesure réelle au
 * 2026-10-05 sur 7 313 matchs, prolongations exclues (4e quart-temps > 4) :
 * voir scripts/qa-basket-league-totals.ts.
 *
 *   ligue      n     médiane  σ total  σ marge  avance dom.  win dom.
 *   NBA      3986      227.0    20.7      16.4      +2.20     55.2 %
 *   WNBA      913      166.0    18.9      14.9      +2.33     55.2 %
 *   EuroL.   1338      165.0    16.9      12.6      +3.91     63.2 %
 *   EuroCup   739      166.0    17.9      15.0      +2.86     58.5 %
 *
 * ⚠️ Toute ligue absente de cette table n'a AUCUNE base mesurée : le backtest
 * doit alors renvoyer `predictions_available: false` pour cette ligue, jamais
 * une ligne extrapolée depuis une autre.
 */

export type BasketLeagueCalibration = {
  /** Ligne de total médiane mesurée (arrondie au .5). */
  totalLine: number;
  /** Écart-type du total (points). */
  sdTotal: number;
  /** Écart-type de la marge (points). */
  sdMargin: number;
  /** Avantage du terrain mesuré (points, positif = domicile). */
  homeEdgePts: number;
  /** Taux de victoire à domicile mesuré (0-1). */
  homeWinRate: number;
  /** Effectif de l'échantillon (matchs sans prolongation). */
  sampleSize: number;
};

export const BASKET_LEAGUE_CALIBRATION: Record<string, BasketLeagueCalibration> = {
  NBA: { totalLine: 227, sdTotal: 20.7, sdMargin: 16.4, homeEdgePts: 2.2, homeWinRate: 0.552, sampleSize: 3986 },
  WNBA: { totalLine: 166, sdTotal: 18.9, sdMargin: 14.9, homeEdgePts: 2.33, homeWinRate: 0.552, sampleSize: 913 },
  EuroLeague: { totalLine: 165, sdTotal: 16.9, sdMargin: 12.6, homeEdgePts: 3.91, homeWinRate: 0.632, sampleSize: 1338 },
  EuroCup: { totalLine: 166, sdTotal: 17.9, sdMargin: 15.0, homeEdgePts: 2.86, homeWinRate: 0.585, sampleSize: 739 },
};

/** Calibration d'une ligue, ou null si elle n'a aucune base mesurée. */
export function basketCalibration(league: string): BasketLeagueCalibration | null {
  return BASKET_LEAGUE_CALIBRATION[league] ?? null;
}