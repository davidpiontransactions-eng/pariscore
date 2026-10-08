/**
 * Identifiants BSD — convention partagée.
 *
 * Les IDs publics des entités BSD sont préfixés côté API (`bsd-<num>` pour les
 * matchs, `bsd-team-<num>` pour les équipes — voir `bsd-fetcher.ts`). Les
 * routes internes (`/api/tennis/bsd/matches/[id]`, `tournament-stats`) exigent
 * l'ID numérique brut. Ce module est la source unique du décodage.
 */

/** Extraire l'ID BSD numérique d'un matchId public (`bsd-45987` → 45987). */
export function parseBsdId(matchId: string): number | null {
  const m = /^bsd-(\d+)$/.exec(matchId);
  return m ? Number(m[1]) : null;
}

/** Décode l'ID numérique BSD quelle que soit la variante de préfixe.
 *  Les sources ne partagent pas la même convention : le flux live et
 *  l'arbre sidebar utilisent `bsd-<num>`, le calendrier et bzzoiro `bsd-tn-<num>`,
 *  le football `bsd-fb-<num>`. */
function bsdNumericId(matchId: string): number | null {
  const m = /^bsd-(?:tn-|fb-)?(\d+)$/.exec(matchId);
  return m ? Number(m[1]) : null;
}

/** Deux `matchId` désignent-ils le même match BSD, quel que soit le préfixe ?
 *  `bsd-45987` ≡ `bsd-tn-45987` → true. Les ids non-BSD (odds-api, calendar)
 *  ne sont comparés que par égalité stricte. */
export function sameBsdMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const na = bsdNumericId(a);
  const nb = bsdNumericId(b);
  return na !== null && nb !== null && na === nb;
}