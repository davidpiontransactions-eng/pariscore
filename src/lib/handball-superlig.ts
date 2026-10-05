// Couche « Superlig (Turquie) » du modèle Pariscore handball.
//
// Ce module ne fait QUE lier les données : la conversion Vitibet → Pariscore
// (types, parsers, stats, baseline, lookups) vit dans
// `handball-vitibet-league.ts`, partagée avec les ligues danoises, la MOL Liga
// et la Liga Nationala Women.
//
// Source de vérité : deux scrapes réels du 2026-10-05.
//   - classements + forme  : scripts/scrape-vitibet-standings.mjs
//     (page ligue, panneaux lh-panel-total/home/away/form)
//   - calendrier           : scripts/build-vitibet-league-fixtures.mjs
//     (page tips, fenêtre J-10 → J+10)
//
// Base de buts DÉRIVÉE du classement (jamais écrite en dur, donc jamais
// désynchronisée des buts réels) :
//   Superlig : 33.5 / équipe  (67.0 / match)
//
// ⚠️ 28.5 « tous championnats » aurait été faux de 17 % sur cette ligue.
// C'est exactement ce qu'on refuse : d'où les contrôles `splitsAgree` /
// `perTeamAgree` dans le scraper, et l'exigence qu'un module ne soit jamais livré
// sans classement vérifié.
//
// ⚠️ COUVERTURE FAIBLE, ET C'EST LA SOURCE : 19 matchs sur 21 jours, étalés
// (8 dates actives, 0 à 4 par date) alors qu'une Superlig à 16 équipes joue 8
// matchs par journée. Contrôle fait en téléchargeant le HTML brut : le 07-10 la
// page liste 17 ligues et contient 0 occurrence de `league_id=120`. Vitibet ne
// publie donc qu'un sous-ensemble de cette ligue. Conséquence : cette source
// convient au flux temps réel, PAS au backtesting — l'historique vient de
// BetExplorer.
import {
  buildLeagueFromFixture,
  coveredLeagueBaseline,
  findCoveredLeague,
  type CoveredLeague,
  type LeagueMeta,
  type RawLeague,
} from "./handball-vitibet-league";
import SUPERLIG_FIXTURE from "./fixtures/superlig-2026.json";

// ─── Ids Vitibet ───

export const SUPERLIG_LEAGUE_IDS = {
  superlig: 120,
} as const;

export type SuperligLeagueKey = keyof typeof SUPERLIG_LEAGUE_IDS;

export const SUPERLIG_LEAGUE_META: Record<SuperligLeagueKey, LeagueMeta> = {
  superlig: {
    vitibetLeagueId: 120,
    name: "Superlig",
    url: "https://www.vitibet.com/handball/tips/superlig/turkey/120/",
    country: "Turkey",
    gender: "M",
    level: 1,
  },
};

// ─── Assemblage ───

let cachedLeagues: CoveredLeague[] | null = null;

/**
 * La Superlig, mémoïsée (calcul pur, appelé à chaque render du popup).
 *
 * `baseline` vient du classement Overall réellement scrapé : 33.5 buts/équipe sur
 * les 10 équipes classées, pas la constante 28.5.
 */
export function getSuperligLeagues(): CoveredLeague[] {
  if (cachedLeagues) return cachedLeagues;
  const raw = SUPERLIG_FIXTURE.leagues as unknown as RawLeague[];
  cachedLeagues = raw.map((l) =>
    buildLeagueFromFixture(l, SUPERLIG_LEAGUE_META[l.key as SuperligLeagueKey]),
  );
  return cachedLeagues;
}

/** La Superlig par son nom (gère le préfixe pays du snapshot). */
export function findSuperligLeague(leagueName: string): CoveredLeague | null {
  return findCoveredLeague(leagueName, getSuperligLeagues());
}

/** Base de buts de la Superlig, ou null si elle n'est pas couverte. */
export function superligLeagueBaseline(leagueName: string): number | null {
  return coveredLeagueBaseline(leagueName, getSuperligLeagues());
}

/**
 * Base de buts MESURÉE sur le fixture (33.5). Exposée pour un contrôle : si elle
 * retombe un jour sur `CMP_NEUTRAL_LAMBDA` (28.5), c'est que le classement a
 * disparu du fixture et que le Team Power est redevenu faux.
 */
export function superligMeasuredBaseline(): number | null {
  const l = getSuperligLeagues()[0];
  return l && l.standings.length > 0 ? l.baseline : null;
}

/**
 * La Superlig publie-t-elle des prédictions, et sur combien de matchs ?
 *
 * Réponse mesurée : oui, mais partiellement — 10 prédictions sur 19 matchs (les
 * 9 autres sont terminés). `predictions_available` est donc porté par le MATCH,
 * pas par la ligue : voir `VitibetFixtureRow.predictionsAvailable`.
 */
export function superligPredictionCoverage(): {
  total: number;
  withPrediction: number;
  withoutPrediction: number;
} {
  const fixtures = getSuperligLeagues()[0]?.fixtures ?? [];
  const withPrediction = fixtures.filter((f) => f.predictionsAvailable === true).length;
  return {
    total: fixtures.length,
    withPrediction,
    withoutPrediction: fixtures.length - withPrediction,
  };
}

// Ré-export de l'API générique : le popup importe tout d'un seul module, comme
// pour les ligues danoises.
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

// Une ligue Superlig EST une CoveredLeague. Alias pour la lisibilité.
export type SuperligLeague = CoveredLeague;