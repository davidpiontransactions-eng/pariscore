// Couche « ligues danoises » du modèle Pariscore handball.
//
// Ce module ne fait QUE lier les données : la conversion Vitibet → Pariscore
// (types, parsers, stats, baseline, lookups) vit dans
// `handball-vitibet-league.ts`, partagée avec la MOL Liga Women.
//
// Source de vérité : scraping Vitibet du 2026-10-04 (3 pages, leagueId 23 /
// 25 / 16). Les bases de buts DÉRIVÉES du classement sont très étalées :
//   Herre Handbold Ligaen  31.8 / équipe  (63.6 / match)
//   Bambusa Kvindeligaen   28.5 / équipe  (57.0 / match)
//   1. Division Women      25.6 / équipe  (51.2 / match)
// D'où l'importance de passer la vraie base au Team Power plutôt que le 28.5
// « tous championnats ».

import {
  buildLeagueFromFixture,
  coveredLeagueBaseline,
  findCoveredLeague,
  findFixture,
  findTeamStats,
  resolveLeagueMean,
  type CoveredLeague,
  type LeagueMeta,
  type RawLeague,
} from "./handball-vitibet-league";
import DANISH_FIXTURE from "./fixtures/danish-handball-2026.json";

// ─── Ids Vitibet des 3 ligues demandées ───

export const DANISH_LEAGUE_IDS = {
  herreHandboldLigaen: 23,
  bambusaKvindeligaen: 25,
  firstDivisionWomen: 16,
} as const;

export type DanishLeagueKey = keyof typeof DANISH_LEAGUE_IDS;

export const DANISH_LEAGUE_META: Record<DanishLeagueKey, LeagueMeta> = {
  herreHandboldLigaen: {
    vitibetLeagueId: 23,
    name: "Herre Handbold Ligaen",
    url: "https://www.vitibet.com/handball/tips/herre-handbold-ligaen/denmark/23/",
    country: "Denmark",
    gender: "M",
    level: 1,
  },
  bambusaKvindeligaen: {
    vitibetLeagueId: 25,
    name: "Bambusa Kvindeligaen",
    url: "https://www.vitibet.com/handball/tips/bambusa-kvindeligaen-women/denmark/25/",
    country: "Denmark",
    gender: "F",
    level: 1,
  },
  firstDivisionWomen: {
    vitibetLeagueId: 16,
    name: "1. Division Women",
    url: "https://www.vitibet.com/handball/tips/1-division-women/denmark/16/",
    country: "Denmark",
    gender: "F",
    level: 2,
  },
};

// ─── Assemblage ───

let cachedLeagues: CoveredLeague[] | null = null;

/**
 * Les 3 ligues danoises, mémoïsées (calcul pur, appelé à chaque render du
 * popup). L'ordre de `DANISH_LEAGUE_META` est celui de la fixture.
 */
export function getDanishLeagues(): CoveredLeague[] {
  if (cachedLeagues) return cachedLeagues;
  const raw = DANISH_FIXTURE.leagues as unknown as RawLeague[];
  cachedLeagues = raw.map((l) =>
    buildLeagueFromFixture(l, DANISH_LEAGUE_META[l.key as DanishLeagueKey]),
  );
  return cachedLeagues;
}

/** Ligue danoise par son nom (gère le préfixe pays du snapshot). */
export function findDanishLeague(leagueName: string): CoveredLeague | null {
  return findCoveredLeague(leagueName, getDanishLeagues());
}

/** Base de buts d'une ligue danoise, ou null si elle n'est pas couverte. */
export function danishLeagueBaseline(leagueName: string): number | null {
  return coveredLeagueBaseline(leagueName, getDanishLeagues());
}

// Ré-export de l'API générique : le popup danois importe tout d'un seul module,
// et la MOL Liga Women réutilise exactement les mêmes fonctions.
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

// `DanishLeague` n'est plus un type distinct : une ligue danoise EST une
// CoveredLeague. Alias conservé pour la lisibilité des appels danois.
export type DanishLeague = CoveredLeague;
