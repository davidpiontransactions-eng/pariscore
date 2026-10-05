/**
 * Point d'entrée UNIQUE des ligues handball couvertes par Vitibet.
 *
 * Chaque famille de ligues a son module (`handball-danish`, `handball-mol-liga`,
 * `handball-superlig`, `handball-liga-nationala-women`) et expose la MÊME paire
 * `find<Famille>(leagueName): CoveredLeague | null`. Le popup, le Team Power et
 * les prédictions n'ont pas à connaître cette liste : ils appellent
 * `findVitibetCoveredLeague`. Ajouter une ligue = ajouter UNE ligne dans
 * `RESOLVERS`.
 *
 * Ce module IMPORTE les modules de ligue, jamais l'inverse : ces modules
 * importent `handball-vitibet-league`, donc y ajouter un import vers eux
 * créerait un cycle.
 *
 * L'ordre de `RESOLVERS` n'est pas décoratif — deux modules ne doivent jamais
 * reconnaître la MÊME ligue, sinon le premier qui répond l'emporte et le
 * second devient inatteignable. `findCoveredLeague` tolère le préfixe pays du
 * snapshot via `leagueNameMatches`.
 */

import { findDanishLeague } from "./handball-danish";
import { findMolLigaLeague } from "./handball-mol-liga";
import { findSuperligLeague } from "./handball-superlig";
import { findLigaNaWomenLeague } from "./handball-liga-nationala-women";
import { findFixture, findTeamStats, type CoveredLeague } from "./handball-vitibet-league";
import { HAND_BALL_LEAGUES, normalizeHandballLeague } from "./handball-league-registry";

const RESOLVERS: ReadonlyArray<(leagueName: string) => CoveredLeague | null> = [
  findDanishLeague,
  findMolLigaLeague,
  findSuperligLeague,
  findLigaNaWomenLeague,
];

/**
 * La ligue Vitibet couverte correspondant à `leagueName`, ou `null`.
 *
 * `null` — et jamais une ligue par défaut — pour que l'appelant distingue
 * « ligue non couverte » de « ligue couverte mais sans donnée pour ce match ».
 */
export function findVitibetCoveredLeague(leagueName: string): CoveredLeague | null {
  for (const resolve of RESOLVERS) {
    const league = resolve(leagueName);
    if (league) return league;
  }
  return null;
}

/**
 * Base de buts MESURÉE de la ligue (par ÉQUIPE), ou `null`.
 *
 * `null` et non `CMP_NEUTRAL_LAMBDA` (28.5) : la Superlig vaut 33.5 et la Liga
 * NA Women 28.1 — un repli générique y serait faux de 17 % sur la première.
 * Une base absente doit rester absente pour que l'appelant puisse le dire.
 */
export function vitibetCoveredBaseline(leagueName: string): number | null {
  return findVitibetCoveredLeague(leagueName)?.baseline ?? null;
}

/**
 * Id de `handball_match_history` d'une ligue couverte par Vitibet, ou `null`.
 *
 * Les deux côtés ne s'appellent pas pareil : les modules de ligue sont indexés
 * par NOM (`Superlig`), la table et `/api/handball/backtest-db` par ID de
 * registre (`superlig`, issu du nom canonique `Turkey: Superlig`). Sans ce
 * pont, un panneau de synthèse ne peut pas joindre son backtest — et le seul
 * moyen de contourner serait de passer un autre championnat que celui affiché.
 *
 * `normalizeHandballLeague` absorbe les alias (`Superlig`, `Süper Lig`,
 * `Turkish Superlig`) ; `null` si la ligue n'est pas au registre, donc si elle
 * n'a aucun historique à mesurer.
 */
export function vitibetLeagueRegistryId(leagueName: string): string | null {
  const canonical = normalizeHandballLeague(leagueName);
  if (!canonical) return null;
  return HAND_BALL_LEAGUES.find((l) => l.name === canonical)?.id ?? null;
}

export { findFixture, findTeamStats };
export type { CoveredLeague };