/**
 * Joint Vitibet → API EuroLeague, par NOM D'ÉQUIPE.
 *
 * ⚠️ Mesure préalable (2026-10-05, 7 matchs avec prédiction contre les 402 de
 * l'API) :
 *
 *   normalizeName seul .................. 0/7   ← AUCUN match
 *   sous-ensemble de tokens (1 équipe) .. 6/7   ← faux positifs, refusé
 *   sous-ensemble strict (2 équipes) .... 5/7
 *   + alias de marque ................... 7/7
 *
 * Les deux ratés du sous-ensemble strict ne sont PAS des sponsors mais des
 * changements de marque sans recouvrement de tokens :
 *   Vitibet « Lyon-Villeurbanne » → API « LDLC ASVEL VILLEURBANNE »
 *   Vitibet « Olimpia Milano »    → API « EA7 EMPORIO ARMANI MILAN »
 *
 * ⚠️ AUCUNE similarité floue ici. `similarity`/`jaroWinkler` existent dans
 * basketball-entity-match et sont volontairement écartés : un match approximatif
 * entre deux équipes de la même ligue affiche les probabilités d'un club sur la
 * fiche d'un autre, et rien ne le signale à l'écran. L'ambiguïté (plusieurs
 * candidats) est un REFUS, pas un tirage au sort.
 */

import { normalizeName } from "./basketball-entity-match";

/**
 * Alias Vitibet → nom API, pour les marques sans recouvrement de tokens.
 *
 * Clé = nom Vitibet normalisé. Valeur = nom API attendu. Chaque ligne existe
 * parce qu'elle a ÉCHOUÉ au sous-ensemble strict, mesuré sur la vraie réponse de
 * l'API — pas parce qu'elle « semble » évidente.
 */
const VITIBET_TEAM_ALIASES: Readonly<Record<string, string>> = {
  // « Villeurbanne » est le nom de la ville ; « ASVEL » est la marque du club
  // qui y joue. Aucun token commun.
  "lyon villeurbanne": "LDLC ASVEL VILLEURBANNE",
  "olimpia milano": "EA7 EMPORIO ARMANI MILAN",
};

function tokens(normalized: string): string[] {
  // Les tokens de moins de 3 caractères ne discriminent rien (« fc », « as »).
  return normalized.split(" ").filter((t) => t.length > 2);
}

/** true si les tokens de `a` sont tous présents dans `b`, ou l'inverse. */
function tokenSubset(a: string, b: string): boolean {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.length || !tb.length) return false;
  const setB = new Set(tb);
  const setA = new Set(ta);
  return ta.every((t) => setB.has(t)) || tb.every((t) => setA.has(t));
}

/**
 * Apparie un nom d'équipe Vitibet à un nom d'équipe API.
 *
 * Renvoie `null` si aucun candidat, ou si plusieurs — l'ambiguïté est un refus.
 */
export function matchEuroLeagueTeam(
  vitibetName: string,
  apiNames: readonly string[],
): string | null {
  const nv = normalizeName(vitibetName);

  const alias = VITIBET_TEAM_ALIASES[nv];
  if (alias && apiNames.some((n) => normalizeName(n) === normalizeName(alias))) {
    return alias;
  }

  const exact = apiNames.filter((n) => normalizeName(n) === nv);
  if (exact.length === 1) return exact[0];

  const subset = apiNames.filter((n) => tokenSubset(nv, normalizeName(n)));
  if (subset.length === 1) return subset[0];

  // 0 ou ≥2 candidats : aucun appariement défendable.
  return null;
}

/**
 * Apparie un MATCH Vitibet à un match API.
 *
 * Les DEUX équipes doivent s'apparier. Exiger une seule équipe acceptait des
 * faux positifs : c'est la mesure qui a fait passer le taux de 5/7 à un chiffre
 * flatteur sans garantie.
 */
export function matchEuroLeagueFixture<
  V extends { home: { name: string }; away: { name: string } },
>(
  vitibetMatch: V,
  apiMatches: readonly V[],
): V | null {
  const names = apiMatches.flatMap((m) => [m.home.name, m.away.name]);
  const home = matchEuroLeagueTeam(vitibetMatch.home.name, names);
  const away = matchEuroLeagueTeam(vitibetMatch.away.name, names);
  if (!home || !away) return null;

  // Même rencontre (dans les deux sens) ?
  return (
    apiMatches.find(
      (m) =>
        (m.home.name === home && m.away.name === away) ||
        (m.home.name === away && m.away.name === home),
    ) ?? null
  );
}

/** Alias déclarés, pour documentation et test. */
export function vitibetTeamAliases(): Readonly<Record<string, string>> {
  return VITIBET_TEAM_ALIASES;
}