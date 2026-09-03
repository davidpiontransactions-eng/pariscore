import { useCallback, useMemo } from "react";
import { useFollowStore } from "@/stores/use-follow-store";

/**
 * Adapter unifié pour les favoris match.
 *
 * Remplace l'ancien useFavorites (localStorage isolé) en le
 * connectant au useFollowStore (store unifié). Même API :
 * - favorites: Set<string> (IDs matchs suivis)
 * - count: nombre de favoris
 * - toggle(matchId): basculer un match
 * - isFavorite(matchId): vérifier si favori
 * - clear(): tout supprimer
 *
 * Les favoris match sont stockés avec la catégorie "match"
 * dans useFollowStore, convention d'ID : `"match:{id}"`.
 */

const MATCH_PREFIX = "match:";

function toFollowId(matchId: string): string {
  return matchId.startsWith(MATCH_PREFIX) ? matchId : `${MATCH_PREFIX}${matchId}`;
}

function toMatchId(followId: string): string {
  return followId.startsWith(MATCH_PREFIX) ? followId.slice(MATCH_PREFIX.length) : followId;
}

export function useFavorites() {
  const follows = useFollowStore((s) => s.follows);
  const addFollow = useFollowStore((s) => s.add);
  const removeFollow = useFollowStore((s) => s.remove);
  const toggleFollow = useFollowStore((s) => s.toggle);
  const getByCategory = useFollowStore((s) => s.getByCategory);

  // Extraire les match IDs des follows de catégorie "match"
  const favorites = useMemo(() => {
    const matchFollows = Object.keys(follows).filter(
      (id) => follows[id]?.category === "match"
    );
    return new Set(matchFollows.map(toMatchId));
  }, [follows]);

  const toggle = useCallback(
    (matchId: string) => {
      const followId = toFollowId(matchId);
      toggleFollow({
        id: followId,
        category: "match",
        name: matchId,
        notifications: false,
      });
    },
    [toggleFollow]
  );

  const isFavorite = useCallback(
    (matchId: string) => favorites.has(matchId),
    [favorites]
  );

  const clear = useCallback(() => {
    const matchFollows = getByCategory("match");
    for (const entry of matchFollows) {
      removeFollow(entry.id);
    }
  }, [getByCategory, removeFollow]);

  return {
    favorites,
    count: favorites.size,
    toggle,
    isFavorite,
    clear,
  };
}
