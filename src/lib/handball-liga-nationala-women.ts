// Couche « Liga Nationala Women (Roumanie) » du modèle Pariscore handball.
//
// Même architecture que `handball-superlig.ts` : ce module ne lie que les
// données, la conversion Vitibet → Pariscore vit dans
// `handball-vitibet-league.ts`.
//
// Base de buts DÉRIVÉE du classement (mesurée le 2026-10-05) :
//   Liga Nationala Women : 28.1 / équipe  (56.2 / match)
//
// ⚠️ AUCUNE PRÉDICTION PUBLIÉE PAR LA SOURCE — mesuré, pas supposé.
// Les 16 matchs collectés ont `tip`, `index_value`, `prob_home/draw/away` et
// `score_predit_*` à null : Vitibet ne fait pas de modèle prédictif sur cette
// ligue. D'où :
//   • `predictions_available` vaut `false` sur les 16 matchs ;
//   • `predictedHome/predictedAway` restent `null` ;
//   • le fixture et ce module le disent explicitement, pour qu'aucun appelant ne
//     présente une probabilité calculée comme si elle venait de Vitibet.
// Le calendrier et les résultats réels restent utilisables — c'est le seul
// apport de cette source pour cette ligue.
import {
  buildLeagueFromFixture,
  coveredLeagueBaseline,
  findCoveredLeague,
  type CoveredLeague,
  type LeagueMeta,
  type RawLeague,
} from "./handball-vitibet-league";
import LIGA_NA_WOMEN_FIXTURE from "./fixtures/liga-nationala-women-2026.json";

// ─── Ids Vitibet ───

export const LIGA_NA_WOMEN_LEAGUE_IDS = {
  ligaNationalaWomen: 88,
} as const;

export type LigaNaWomenLeagueKey = keyof typeof LIGA_NA_WOMEN_LEAGUE_IDS;

export const LIGA_NA_WOMEN_LEAGUE_META: Record<LigaNaWomenLeagueKey, LeagueMeta> = {
  ligaNationalaWomen: {
    vitibetLeagueId: 88,
    name: "Liga Nationala Women",
    url: "https://www.vitibet.com/handball/tips/liga-nationala-women/romania/88/",
    country: "Romania",
    gender: "F",
    level: 1,
  },
};

// ─── Assemblage ───

let cachedLeagues: CoveredLeague[] | null = null;

/**
 * La Liga Nationala Women, mémoïsée.
 *
 * 14 équipes classées, 60 matchs joués au moment du scrape. La base de 28.1
 * est proche de `CMP_NEUTRAL_LAMBDA` (28.5) — mais « proche » ne veut pas dire
 * « juste » : sur cette ligue, un repli générique serait faux de 1.4 %, et le
 * jour où la ligue aura une saison plus offensive il le sera bien davantage.
 */
export function getLigaNaWomenLeagues(): CoveredLeague[] {
  if (cachedLeagues) return cachedLeagues;
  const raw = LIGA_NA_WOMEN_FIXTURE.leagues as unknown as RawLeague[];
  cachedLeagues = raw.map((l) =>
    buildLeagueFromFixture(l, LIGA_NA_WOMEN_LEAGUE_META[l.key as LigaNaWomenLeagueKey]),
  );
  return cachedLeagues;
}

/** La Ligue par son nom (gère le préfixe pays du snapshot). */
export function findLigaNaWomenLeague(leagueName: string): CoveredLeague | null {
  return findCoveredLeague(leagueName, getLigaNaWomenLeagues());
}

/** Base de buts de la ligue, ou null si elle n'est pas couverte. */
export function ligaNaWomenLeagueBaseline(leagueName: string): number | null {
  return coveredLeagueBaseline(leagueName, getLigaNaWomenLeagues());
}

/** Base de buts MESURÉE sur le classement du fixture (28.1), ou null. */
export function ligaNaWomenMeasuredBaseline(): number | null {
  const l = getLigaNaWomenLeagues()[0];
  return l && l.standings.length > 0 ? l.baseline : null;
}

/**
 * Vitibet publie-t-il des prédictions sur cette ligue ?
 *
 * Renvoie `false` tant que la source n'en publie aucune. Ce n'est pas une
 * supposition : c'est recompté sur les fixtures à chaque appel, donc le jour où
 * Vitibet décidera de couvrir la ligue, la valeur bascule sans qu'on ait à
 * toucher au code.
 */
export function ligaNaWomenPredictionsPublished(): boolean {
  return ligaNaWomenPredictionCoverage().withPrediction > 0;
}

/** Couverture des prédictions sur les matchs collectés. */
export function ligaNaWomenPredictionCoverage(): {
  total: number;
  withPrediction: number;
  withoutPrediction: number;
} {
  const fixtures = getLigaNaWomenLeagues()[0]?.fixtures ?? [];
  const withPrediction = fixtures.filter((f) => f.predictionsAvailable === true).length;
  return {
    total: fixtures.length,
    withPrediction,
    withoutPrediction: fixtures.length - withPrediction,
  };
}

// Ré-export de l'API générique.
export {
  findFixture,
  findTeamStats,
  resolveLeagueMean,
  deriveLeagueBaseline,
  parseVitibetForm,
  parseVitibetScore,
  toPariscoreTeamStats,
  type CoveredLeague,
  type LeagueMeta,
  type SplitStats,
  type TeamSeasonStats,
  type VitibetFixtureRow,
  type VitibetStandingRow,
} from "./handball-vitibet-league";

export type LigaNaWomenLeague = CoveredLeague;