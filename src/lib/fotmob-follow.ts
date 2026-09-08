import type { FotmobCalMatch } from "@/components/football/fotmob-calendar-table";

const PREFIX = "match:football:";

/** Id de suivi conventionnel (idempotent). */
export function toFollowId(rawId: string): string {
  return rawId.startsWith(PREFIX) ? rawId : PREFIX + rawId;
}

/** Vrai si l'id suivi (forme conventionnelle ou brute legacy) désigne le match. */
function matchesId(matchId: string, followedId: string): boolean {
  return followedId === matchId || followedId === PREFIX + matchId;
}

/**
 * Partitionne les matchs : suivis d'abord (ordre du flux préservé),
 * reste ensuite. Tolère les ids suivis bruts (legacy) et conventionnels.
 */
export function partitionFollowed(
  matches: FotmobCalMatch[],
  followedIds: string[],
): { followed: FotmobCalMatch[]; rest: FotmobCalMatch[] } {
  const followed: FotmobCalMatch[] = [];
  const rest: FotmobCalMatch[] = [];
  for (const m of matches) {
    (followedIds.some((fid) => matchesId(m.id, fid)) ? followed : rest).push(m);
  }
  return { followed, rest };
}
