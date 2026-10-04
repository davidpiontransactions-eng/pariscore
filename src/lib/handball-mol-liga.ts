// Couche « MOL Liga Women » (Europe, leagueId 140) du modèle Pariscore.
//
// Même source Vitibet, même conversion que les ligues danoises → la couche
// générique est dans `handball-vitibet-league.ts`. Ce module ne fait que
// lier les données et exposer le backtesting de la ligue.
//
// Base de buts MESURÉE sur la page du 2026-10-04 :
//   Σ GF = 1577 buts sur 27 matchs → 58.4 buts/MATCH, 29.2 par équipe.
// La spec annonçait « ~52 à 58 buts/match » pour le handball féminin européen :
// la valeur dérivée est au sommet de cette fourchette (début de saison, peu de
// journées), et c'est elle qui fait foi — une base écrite en dur se
// désynchroniserait du classement dès la première journée complète.

import {
  buildLeagueFromFixture,
  coveredLeagueBaseline,
  findCoveredLeague,
  findFixture,
  findTeamStats,
  type CoveredLeague,
  type LeagueMeta,
  type RawLeague,
} from "./handball-vitibet-league";
import {
  runPariscoreBacktest,
  type BacktestMatch,
  type BacktestResult,
} from "./handball-backtest-pariscore";
import MOL_FIXTURE from "./fixtures/mol-liga-women-2026.json";

export const MOL_LIGA_LEAGUE_ID = 140;

export const MOL_LIGA_META: LeagueMeta = {
  vitibetLeagueId: MOL_LIGA_LEAGUE_ID,
  name: "MOL Liga Women",
  url: "https://www.vitibet.com/handball/tips/mol-liga-women/europe/140/",
  country: "Europe",
  gender: "F",
  level: 1,
};

let cached: CoveredLeague | null = null;

/** La ligue MOL Liga Women, mémoïsée. */
export function getMolLiga(): CoveredLeague {
  if (cached) return cached;
  const raw = MOL_FIXTURE.league as unknown as RawLeague;
  cached = buildLeagueFromFixture(raw, MOL_LIGA_META);
  return cached;
}

/** Alias compatible avec l'API des ligues danoises (nom générique). */
export function findMolLigaLeague(leagueName: string): CoveredLeague | null {
  return findCoveredLeague(leagueName, [getMolLiga()]);
}

export function molLigaBaseline(leagueName: string): number | null {
  return coveredLeagueBaseline(leagueName, [getMolLiga()]);
}

/**
 * Historique terminé converti au format du moteur de backtesting.
 *
 * `date` est la clé de journée (`YYYY-MM-DD`) ; le tri du moteur est
 * chronologique donc l'ordre du JSON n'a pas d'importance.
 */
export function molLigaBacktestMatches(): BacktestMatch[] {
  return getMolLiga().results.map((r) => ({
    id: String(r.fixtureId),
    date: r.date,
    league: MOL_LIGA_META.name,
    home: r.home,
    away: r.away,
    homeGoals: r.homeGoals,
    awayGoals: r.awayGoals,
    synthetic: r.synthetic === true,
  }));
}

export { findFixture, findTeamStats, type CoveredLeague } from "./handball-vitibet-league";
