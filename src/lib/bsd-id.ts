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